// app/api/menus/status/route.ts
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createSupabaseAdmin } from '@/utils/supabase/admin'

const Query = z.object({
  competitorId: z.string().uuid(),
})

export async function GET(req: Request) {
  const url = new URL(req.url)
  const parsed = Query.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid query' }, { status: 400 })
  }

  const { competitorId } = parsed.data
  const sb = createSupabaseAdmin()

  try {
    const { data, error } = await sb
      .from('menus')
      .select('avg_price, top_items, source_url, updated_at')
      .eq('competitor_id', competitorId)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      ok: true,
      ready: !!data,
      avg_price: data?.avg_price ?? null,
      top_items: data?.top_items ?? null,
      source_url: data?.source_url ?? null,
      updated_at: data?.updated_at ?? null,
    })
  } catch (e: any) {
    console.error('status error:', e)
    return NextResponse.json({ ok: false, error: e?.message || 'Server error' }, { status: 500 })
  }
}
