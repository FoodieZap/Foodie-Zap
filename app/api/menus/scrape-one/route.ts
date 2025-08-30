export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseAdmin } from '@/utils/supabase/admin'
import { scrapeMenuFromUrl } from '@/lib/scrapeMenu'
import { targetForCompetitor } from '@/lib/menuTargets'

const Body = z.object({
  competitorId: z.string().uuid().optional(),
  url: z.string().url().optional(),
})

function chooseFromExternal(external: any): string | null {
  if (!external) return null
  const toUrl = (v: any) => (typeof v === 'string' ? v : v?.url ? String(v.url) : null)
  const tryList = (key: string) => {
    const v = external[key]
    if (Array.isArray(v)) return toUrl(v[0])
    return toUrl(v)
  }
  // preference order
  return (
    tryList('doordash') ||
    tryList('ubereats') ||
    tryList('grubhub') ||
    tryList('yelp') ||
    tryList('toast') ||
    tryList('square') ||
    tryList('clover') ||
    null
  )
}

function resolveTargetUrl(
  target: unknown,
  comp: { website?: string | null; external_urls?: any; data?: any },
): string | null {
  // targetForCompetitor result (string | {url} | array)
  if (typeof target === 'string') return target
  if (Array.isArray(target)) {
    const first = target[0]
    if (typeof first === 'string') return first
    if (first && typeof first === 'object' && 'url' in first && (first as any).url)
      return String((first as any).url)
  }
  if (target && typeof target === 'object' && 'url' in (target as any) && (target as any).url) {
    return String((target as any).url)
  }

  // external_urls column (preferred)
  const extPick = chooseFromExternal(comp.external_urls)
  if (extPick) return extPick

  // old data.links fallback
  const links = (comp?.data?.links ?? []) as Array<string | { url: string }>
  if (Array.isArray(links) && links.length) {
    const first = links[0]
    if (typeof first === 'string') return first
    if (first && typeof first === 'object' && 'url' in first && (first as any).url)
      return String((first as any).url)
  }

  // website last
  if (comp.website) return comp.website
  return null
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}))
  const parsed = Body.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid body', details: parsed.error.flatten(), received: json },
      { status: 400 },
    )
  }

  const { competitorId, url } = parsed.data
  const sb = createSupabaseAdmin()

  try {
    let targetUrl = url ?? null

    if (!targetUrl && competitorId) {
      const { data: comp, error } = await sb
        .from('competitors')
        .select('id, name, website, external_urls, data')
        .eq('id', competitorId)
        .maybeSingle()

      if (error) throw error
      if (!comp) {
        return NextResponse.json({ ok: false, error: 'Competitor not found' }, { status: 404 })
      }

      const tgt = await targetForCompetitor(comp as any).catch(() => null)
      targetUrl = resolveTargetUrl(tgt, comp as any)
    }

    if (!targetUrl) {
      return NextResponse.json(
        { ok: false, error: 'No target URL resolved (missing url/external_urls/website)' },
        { status: 400 },
      )
    }

    const menu = await scrapeMenuFromUrl(targetUrl)

    // ⬇️ Dedupe items here
    const items = Array.isArray(menu.top_items) ? menu.top_items : []
    const seen = new Set<string>()
    const deduped = items.filter((it) => {
      const key = (it.name || '') + '|' + (it.price ?? '')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Replace in payload used for saving/returning
    ;(menu as any).top_items = deduped
    const itemCount = deduped.length

    // ...within POST handler, after `const menu = await scrapeMenuFromUrl(targetUrl)`

    // NEW: count items safely
    // Count items safely

    // Quick quality check: avoid saving obvious boilerplate-only menus.
    // Heuristics: require at least 1 of:
    //  - a price present, OR
    //  - >= 3 items with reasonably long names
    const hasAnyPrice = items.some((i) => typeof i?.price === 'number')
    const has3Names = items.filter((i) => (i?.name || '').trim().length >= 3).length >= 3
    const looksMenuLike = hasAnyPrice || has3Names

    let saved = false
    let reason: string | null = null

    if (!competitorId) {
      reason = 'no-competitor'
    } else if (itemCount === 0) {
      reason = 'no-items'
    } else if (!looksMenuLike) {
      reason = 'low-quality-items'
    } else {
      const { error: upErr } = await sb.from('menus').upsert(
        {
          competitor_id: competitorId,
          source_url: targetUrl,
          avg_price: menu.avg_price,
          top_items: menu.top_items,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'competitor_id' },
      )
      if (upErr) {
        console.error('scrape-one upsert error:', upErr.message)
        reason = 'upsert-failed'
      } else {
        saved = true
      }
    }

    return NextResponse.json({
      ok: true,
      competitorId: competitorId ?? null,
      targetUrl,
      avg_price: menu.avg_price,
      top_items: menu.top_items,
      source: menu.source,
      item_count: itemCount,
      saved,
      reason, // helps us debug in the client/devtools
    })
  } catch (e: any) {
    console.error('scrape-one error:', e?.message ?? e)
    return NextResponse.json({ ok: false, error: e?.message || 'Server error' }, { status: 500 })
  }
}
