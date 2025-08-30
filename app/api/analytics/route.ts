// app/api/analytics/route.ts
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createSupabaseRoute } from '@/utils/supabase/route'

type Buckets = Record<string, number>

function bucketizeRating(r: number | null): string {
  if (r == null) return 'unknown'
  // buckets like "4.5–4.9"
  const floor = Math.max(0, Math.min(5, Math.floor(r * 2) / 2)) // 0.0, 0.5, 1.0 ...
  const hi = Math.min(5, floor + 0.4)
  return `${floor.toFixed(1)}–${hi.toFixed(1)}`
}

function bucketizeReviews(n: number | null): string {
  if (!n || n < 1) return '0'
  if (n <= 50) return '1–50'
  if (n <= 200) return '51–200'
  if (n <= 500) return '201–500'
  if (n <= 1000) return '501–1k'
  return '1k+'
}

export async function GET(req: Request) {
  const supabase = await createSupabaseRoute()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const u = new URL(req.url)
  const searchId = (u.searchParams.get('searchId') || '').trim()
  if (!searchId) return NextResponse.json({ error: 'searchId required' }, { status: 400 })

  // Get competitors for this search
  const { data: comps, error } = await supabase
    .from('competitors')
    .select('id, rating, review_count, price_level, website, data')
    .eq('search_id', searchId)
    .limit(2000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Join menu rows for the same set of competitors
  const ids = (comps ?? []).map((c) => c.id)
  let menus: Array<{ competitor_id: string; avg_price: number | null; top_items: any[] | null }> =
    []
  if (ids.length) {
    const { data: ms } = await supabase
      .from('menus')
      .select('competitor_id, avg_price, top_items')
      .in('competitor_id', ids)
    menus = ms ?? []
  }
  const menuById = new Map(menus.map((m) => [m.competitor_id, m]))

  // Overview stats
  const total = comps?.length ?? 0
  const withWebsite = (comps ?? []).filter((c) => !!c.website).length
  const withMenu = (comps ?? []).filter((c) => menuById.has(c.id)).length

  const ratings = (comps ?? []).map((c) => Number(c.rating)).filter((n) => Number.isFinite(n))
  const reviews = (comps ?? []).map((c) => Number(c.review_count)).filter((n) => Number.isFinite(n))
  const priceLevels = (comps ?? [])
    .map((c) => (c.price_level || '').toString().trim())
    .filter(Boolean)

  const tickets = menus.map((m) => Number(m.avg_price)).filter((n) => Number.isFinite(n))

  const median = (arr: number[]) => {
    if (!arr.length) return null
    const s = [...arr].sort((a, b) => a - b)
    const mid = Math.floor(s.length / 2)
    return s.length % 2 ? s[mid] : Number(((s[mid - 1] + s[mid]) / 2).toFixed(2))
  }

  // Distributions
  const ratingBuckets: Buckets = {}
  for (const r of ratings) {
    const b = bucketizeRating(r)
    ratingBuckets[b] = (ratingBuckets[b] || 0) + 1
  }
  const reviewBuckets: Buckets = {}
  for (const n of reviews) {
    const b = bucketizeReviews(n)
    reviewBuckets[b] = (reviewBuckets[b] || 0) + 1
  }
  const priceMix: Buckets = {}
  for (const p of priceLevels) {
    priceMix[p] = (priceMix[p] || 0) + 1
  }

  // Top items (simple text union with dedupe)
  const nameCount = new Map<string, number>()
  for (const m of menus) {
    const items = Array.isArray(m.top_items) ? m.top_items : []
    for (const it of items) {
      const raw = (it?.name || '').toString().trim()
      if (!raw) continue
      const looksLikeCode = /function|\bvar\s|=>|\{|\}|<[^>]+>/.test(raw)
      if (looksLikeCode) continue
      const key = raw.toLowerCase()
      nameCount.set(key, (nameCount.get(key) || 0) + 1)
    }
  }
  const topItems = [...nameCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, mentions]) => ({ name, mentions }))

  return NextResponse.json({
    total,
    coverage: {
      withWebsite,
      withMenu,
    },
    medians: {
      rating: median(ratings),
      reviews: median(reviews),
      ticket: median(tickets),
    },
    distributions: {
      ratingBuckets,
      reviewBuckets,
      priceMix,
    },
    menu: {
      topItems,
    },
    // quick flags
    flags: {
      noWebsite: (comps ?? []).filter((c) => !c.website).map((c) => c.id),
      noMenu: (comps ?? []).filter((c) => !menuById.has(c.id)).map((c) => c.id),
      leaders: (comps ?? [])
        .filter((c) => (c.rating ?? 0) >= 4.5 && (c.review_count ?? 0) >= 300)
        .map((c) => c.id),
    },
  })
}
