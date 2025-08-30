// app/api/search/[id]/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseRoute } from '@/utils/supabase/route'

export async function GET(req: Request, ctx: any) {
  const { id: searchId } = (ctx?.params ?? {}) as { id: string }

  const supabase = await createSupabaseRoute()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Search (RLS enforces ownership)
  const { data: search, error: sErr } = await supabase
    .from('searches')
    .select('*')
    .eq('id', searchId)
    .single()

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 404 })

  // Competitors
  const { data: competitors } = await supabase
    .from('competitors')
    .select(
      'id, source, place_id, name, address, phone, website, rating, review_count, price_level, cuisine',
    )
    .eq('search_id', searchId)

  // Menus (by competitor ids)
  let menus: any[] = []
  if (competitors?.length) {
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
    .eq('search_id', searchId)
    .maybeSingle()

  return NextResponse.json({
    search,
    competitors: competitors ?? [],
    menus,
    insights: insights ?? null,
  })
}
