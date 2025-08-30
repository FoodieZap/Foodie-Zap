export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createSupabaseRoute } from '@/utils/supabase/route'
import { scrapeMenuFromUrl } from '@/lib/scrapeMenu'

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseRoute()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { competitorId } = (await req.json().catch(() => ({}))) as { competitorId?: string }
    if (!competitorId)
      return NextResponse.json({ error: 'competitorId is required' }, { status: 400 })

    // get the website for this competitor
    const { data: comp, error: cErr } = await supabase
      .from('competitors')
      .select('id, website')
      .eq('id', competitorId)
      .maybeSingle()
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 })
    if (!comp?.website) {
      return NextResponse.json({ error: 'No website on competitor' }, { status: 400 })
    }

    const scraped = await scrapeMenuFromUrl(String(comp.website))

    // upsert so UI always reflects latest attempt
    const { error: upErr } = await supabase.from('menus').upsert(
      {
        user_id: user.id,
        competitor_id: competitorId,
        avg_price: scraped.avg_price,
        top_items: scraped.top_items,
      },
      { onConflict: 'user_id,competitor_id' },
    )
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, competitorId, ...scraped })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'scrape failed' }, { status: 500 })
  }
}
