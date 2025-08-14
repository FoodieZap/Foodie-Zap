import { NextResponse } from 'next/server'
import { createSupabaseRoute } from '@/utils/supabase/route'

import { type CookieOptions, createServerClient } from '@supabase/ssr'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseRoute()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Search (ownership enforced by RLS)
  const { data: search, error: sErr } = await supabase
    .from('searches')
    .select('*')
    .eq('id', params.id)
    .single()

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 404 })

  // Competitors
  //   const { data: competitors } = await supabase
  //     .from('competitors')
  //     .select(
  //       'id, source, place_id, name, address, phone, website, rating, review_count, price_level, cuisine',
  //     )

  const { data: competitors } = await supabase
    .from('competitors')
    .select(
      'id, source, place_id, name, address, phone, website, rating, review_count, price_level, cuisine',
    )
    .eq('search_id', params.id)
  // Menus (by competitor ids)
  let menus: any[] = []
  if (competitors && competitors.length) {
    const ids = competitors.map((c) => c.id)
    const { data } = await supabase
      .from('menus')
      .select('competitor_id, avg_price, currency, top_items')
      .in('competitor_id', ids)
    menus = data ?? []
  }

  // Insights
  const { data: insights } = await supabase
    .from('insights')
    .select('summary, actions')
    .eq('search_id', params.id)
    .maybeSingle()

  return NextResponse.json({
    search,
    competitors: competitors ?? [],
    menus,
    insights: insights ?? null,
  })
}
