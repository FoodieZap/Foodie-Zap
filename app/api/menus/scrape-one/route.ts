export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseAdmin } from '@/utils/supabase/admin'
import { targetForCompetitor } from '@/lib/menuTargets'
import { scrapeMenuForBusiness, scrapeMenuFromUrl } from '@/lib/scrapeMenu'

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
  const extPick = chooseFromExternal(comp.external_urls)
  if (extPick) return extPick
  const links = (comp?.data?.links ?? []) as Array<string | { url: string }>
  if (Array.isArray(links) && links.length) {
    const first = links[0]
    if (typeof first === 'string') return first
    if (first && typeof first === 'object' && 'url' in first && (first as any).url)
      return String((first as any).url)
  }
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
    let userId: string | null = null
    let comp: any = null

    // We require a competitor to resolve user_id (menus.user_id is NOT NULL)
    if (!targetUrl && !competitorId) {
      return NextResponse.json(
        { ok: false, error: 'competitorId or url required' },
        { status: 400 },
      )
    }

    if (competitorId) {
      const res = await sb
        .from('competitors')
        .select('id, name, website, external_urls, data, search_id, address')
        .eq('id', competitorId)
        .maybeSingle()
      if (res.error) throw res.error
      comp = res.data
      if (!comp)
        return NextResponse.json({ ok: false, error: 'Competitor not found' }, { status: 404 })

      if (comp.search_id) {
        const { data: searchRow, error: searchErr } = await sb
          .from('searches')
          .select('user_id')
          .eq('id', comp.search_id)
          .maybeSingle()
        if (searchErr) throw searchErr
        userId = (searchRow?.user_id as string) ?? null
      }
      if (!userId) {
        return NextResponse.json(
          { ok: false, error: 'Could not resolve user_id for this competitor/search' },
          { status: 400 },
        )
      }

      const tgt = await targetForCompetitor(comp as any).catch(() => null)
      targetUrl = resolveTargetUrl(tgt, comp as any) ?? targetUrl
    }

    if (!targetUrl && comp?.website) targetUrl = comp.website
    if (!targetUrl) {
      return NextResponse.json(
        { ok: false, error: 'No target URL resolved (missing url/external_urls/website)' },
        { status: 400 },
      )
    }

    // Build business context for the aggregator
    const businessInfo = {
      name: String(comp?.name || '').trim(),
      city: (comp?.data?.city || comp?.data?.address_city || '').trim() || null,
      address: (comp?.data?.address_full || comp?.data?.address || '').trim() || null,
      website: (targetUrl || comp?.website || '').trim() || null,
    }

    // Try business-aware aggregator first (multi-source)
    let menu: any = await scrapeMenuForBusiness(businessInfo)

    // Fallback to the single URL if needed
    if (!menu?.top_items || menu.top_items.length === 0) {
      menu = await scrapeMenuFromUrl(businessInfo.website || targetUrl)
    }

    const extraSections = (menu as any).__sections ?? null
    const extraMetrics = (menu as any).__metrics ?? null
    const extraSources = (menu as any).__sources ?? null

    const items = Array.isArray(menu.top_items) ? menu.top_items : []
    const itemCount = items.length
    // --- don’t-regress guard: if we already have more/better data, keep it
    let prev: any = null
    if (competitorId) {
      const { data: existing, error: exErr } = await sb
        .from('menus')
        .select('avg_price, top_items, sectioned_menu, metrics, source_url')
        .eq('competitor_id', competitorId)
        .maybeSingle()
      if (!exErr && existing) prev = existing
    }

    if (prev) {
      const prevCount = Array.isArray(prev.top_items) ? prev.top_items.length : 0
      const prevSections = Array.isArray(prev.sectioned_menu) ? prev.sectioned_menu.length : 0
      const newSections = Array.isArray(menu.__sections) ? menu.__sections.length : 0

      // keep previous if new is clearly worse
      const clearlyWorse =
        (itemCount < prevCount && prevCount >= 8) ||
        (newSections === 1 && /brunch/i.test(menu.__sections?.[0]?.name || '') && prevSections >= 2)

      if (clearlyWorse) {
        return NextResponse.json({
          ok: true,
          competitorId: competitorId ?? null,
          targetUrl: prev.source_url ?? null,
          source: 'cache',
          avg_price: prev.avg_price ?? null,
          top_items: prev.top_items ?? [],
          item_count: prevCount,
          saved: false,
          reason: 'regressed_keep_previous',
          sectioned_menu: prev.sectioned_menu ?? null,
          metrics: prev.metrics ?? null,
          sources: null,
        })
      }
    }

    const savedSourceUrl =
      (Array.isArray(extraSources) && extraSources[0]?.url) ||
      businessInfo.website ||
      targetUrl ||
      null

    let saved = false
    let reason: string | null = null

    if (competitorId && itemCount >= 1) {
      const payload: any = {
        competitor_id: competitorId,
        user_id: userId, // required by schema
        source_url: savedSourceUrl,
        avg_price: menu.avg_price,
        top_items: menu.top_items,
        updated_at: new Date().toISOString(),
      }
      if (extraSections) payload.sectioned_menu = extraSections
      if (extraMetrics) payload.metrics = extraMetrics
      if (extraSources) payload.sources = extraSources

      const { error: upErr } = await sb
        .from('menus')
        .upsert(payload, { onConflict: 'competitor_id' })
      if (upErr) {
        console.error('scrape-one upsert error:', upErr.message)
      } else {
        saved = true
      }
    } else if (itemCount === 0) {
      reason = 'no-items'
    }

    return NextResponse.json({
      ok: true,
      competitorId: competitorId ?? null,
      targetUrl: savedSourceUrl ?? targetUrl,
      source: menu.source,
      avg_price: menu.avg_price ?? null,
      top_items: menu.top_items ?? [],
      item_count: itemCount,
      saved,
      reason,
      sectioned_menu: menu.__sections ?? null,
      metrics: menu.__metrics ?? null,
      sources: menu.__sources ?? null,
    })
  } catch (e: any) {
    console.error('scrape-one error:', e?.message ?? e)
    return NextResponse.json({ ok: false, error: e?.message || 'Server error' }, { status: 500 })
  }
}
