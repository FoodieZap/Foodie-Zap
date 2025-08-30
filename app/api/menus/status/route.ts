export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createSupabaseRoute } from '@/utils/supabase/route'

export async function GET(req: Request) {
  const supabase = await createSupabaseRoute()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const u = new URL(req.url)
  const competitorId = (u.searchParams.get('competitorId') || '').trim()
  if (!competitorId)
    return NextResponse.json({ error: 'competitorId is required' }, { status: 400 })

  const { data: menu } = await supabase
    .from('menus')
    .select('avg_price, top_items, fetched_at, source')
    .eq('competitor_id', competitorId)
    .maybeSingle()

  const { data: job } = await supabase
    .from('menu_jobs')
    .select('status, error, updated_at')
    .eq('competitor_id', competitorId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ menu: menu ?? null, job: job ?? null })
}
