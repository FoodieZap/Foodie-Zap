// app/api/insights/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseRoute } from '@/utils/supabase/route'

export const dynamic = 'force-dynamic'

// POST /api/insights?searchId=...
export async function POST(req: Request) {
  const supabase = await createSupabaseRoute()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const searchId = searchParams.get('searchId')
  if (!searchId) return NextResponse.json({ error: 'searchId is required' }, { status: 400 })

  // Pull competitors for this run
  const { data: comps, error: compErr } = await supabase
    .from('competitors')
    .select('rating, review_count, price_level')
    .eq('search_id', searchId)
    .limit(500)

  if (compErr) return NextResponse.json({ error: compErr.message }, { status: 500 })

  const list = comps ?? []
  const ratings = list.map((c) => Number(c.rating ?? 0)).filter((n) => !Number.isNaN(n))
  const reviews = list.map((c) => Number(c.review_count ?? 0)).filter((n) => !Number.isNaN(n))
  const prices = list.map((c) => String(c.price_level ?? '').trim()).filter(Boolean)

  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
  const avgReviews = reviews.length ? reviews.reduce((a, b) => a + b, 0) / reviews.length : 0

  const priceCounts = prices.reduce<Record<string, number>>((acc, p) => {
    acc[p] = (acc[p] ?? 0) + 1
    return acc
  }, {})
  const dominantPrice = Object.entries(priceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''

  const actions: string[] = []

  // Simple, deterministic suggestions
  if (avgRating < 4.5) {
    actions.push('Operations: Close service gaps to push average rating above 4.5.')
  }
  if (avgReviews < 200) {
    actions.push('Marketing: Run a 4-week UGC + Reels push to lift review volume.')
  }
  if (dominantPrice === '$') {
    actions.push('Pricing: Introduce a premium add-on (oat milk, extra shot, specialty sides).')
  } else if (dominantPrice === '$$$' || dominantPrice === '$$$$') {
    actions.push('Pricing: Add an entry-level value item to capture price-sensitive traffic.')
  } else {
    actions.push('Menu: Feature top 3 sellers with price overlay in short-form video.')
  }

  const summary = `Market avg rating ~${avgRating.toFixed(2)}, avg reviews ~${Math.round(
    avgReviews,
  )}, most common price: ${dominantPrice || 'n/a'}.`

  // Upsert into insights table
  const { error: upErr } = await supabase
    .from('insights')
    .upsert(
      { search_id: searchId, user_id: user.id, summary, actions },
      { onConflict: 'search_id' },
    )

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, summary, actions })
}
