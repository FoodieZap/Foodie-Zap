// app/api/insights/placeholder/route.ts
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createSupabaseRoute } from '@/utils/supabase/route'

export async function POST(req: Request) {
  const supabase = createSupabaseRoute()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const searchId = searchParams.get('searchId')
  if (!searchId) {
    return NextResponse.json({ error: 'searchId is required' }, { status: 400 })
  }

  // 1) Load competitors (rating/reviews/price)
  const { data: comps, error: compErr } = await supabase
    .from('competitors')
    .select('id, name, rating, review_count, price_level, cuisine')
    .eq('search_id', searchId)
    .limit(200)
  if (compErr) return NextResponse.json({ error: compErr.message }, { status: 500 })

  // 2) Load menus we just created (if any)
  const { data: menus, error: menuErr } = await supabase
    .from('menus')
    .select('competitor_id, avg_price, top_items')
  if (menuErr) return NextResponse.json({ error: menuErr.message }, { status: 500 })

  // Join menus by competitor_id
  const menuByComp = new Map<string, any>()
  for (const m of menus ?? []) menuByComp.set(m.competitor_id, m)

  // Simple aggregates
  const N = (comps ?? []).length
  const avgRating =
    N === 0
      ? 0
      : Math.round(((comps ?? []).reduce((s, x) => s + (x.rating ?? 0), 0) / N) * 100) / 100
  const avgPrice =
    N === 0
      ? 0
      : Math.round(
          ((comps ?? []).reduce((s, c) => s + (menuByComp.get(c.id)?.avg_price ?? 0), 0) / N) * 100,
        ) / 100

  // Build a rule-based summary + actions
  const summary =
    N === 0
      ? 'No competitors found yet.'
      : `Market has ~${N} competitors. Average rating ~${avgRating}, avg ticket ~$${
          avgPrice || '—'
        }.`

  const actions: string[] = []

  if (avgRating >= 4.5)
    actions.push('Operations: Market expectations are high; maintain top-tier service consistency.')
  else if (avgRating >= 4.0)
    actions.push('Operations: Narrow service gaps to push average rating above 4.5.')
  else actions.push('Operations: Prioritize quality fixes; aim for 4.0+ baseline.')

  if (avgPrice && avgPrice >= 15)
    actions.push('Pricing: Consider value combos/half portions to improve entry price.')
  else if (avgPrice && avgPrice <= 8)
    actions.push('Pricing: Add premium upsells (extra shot, oat milk, specialty pies).')
  else actions.push('Pricing: Keep core items near market avg; test a premium seasonal item.')

  // menu-based suggestion
  const allItems = []
  for (const c of comps ?? []) {
    const m = menuByComp.get(c.id)
    if (m?.top_items) {
      for (const it of m.top_items as any[]) allItems.push((it.name ?? '').toLowerCase())
    }
  }
  const hasMatcha = allItems.some((n) => n.includes('matcha'))
  const hasCold = allItems.some((n) => n.includes('cold brew'))
  if (!hasMatcha) actions.push('Menu: Add an iced matcha (trend & photogenic).')
  if (!hasCold) actions.push('Menu: Add a signature cold brew or cold foam variant.')

  actions.push(
    'Marketing: Feature top 3 items in Reels/TikTok with price overlay and city hashtag.',
  )

  // Upsert single insights row per search_id
  const payload = {
    search_id: searchId,
    summary,
    actions,
    data: { placeholder: true },
  }

  const { error: upErr } = await supabase
    .from('insights')
    .upsert(payload, { onConflict: 'search_id' })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, summary, actions })
}
