export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createSupabaseRoute } from '@/utils/supabase/route'
import { targetForCompetitor } from '@/lib/menuTargets'

export async function POST(req: Request) {
  const supabase = await createSupabaseRoute()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const json = (await req.json().catch(() => ({}))) as { competitorId?: string }
  const competitorId = (json?.competitorId || '').trim()
  if (!competitorId)
    return NextResponse.json({ error: 'competitorId is required' }, { status: 400 })

  const { data: c, error } = await supabase
    .from('competitors')
    .select('id, website, data')
    .eq('id', competitorId)
    .maybeSingle()
  if (error || !c) return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })

  const target = await targetForCompetitor(c as any)
  if (!target) return NextResponse.json({ error: 'No target URL' }, { status: 400 })

  const { error: insErr } = await supabase.from('menu_jobs').insert({
    user_id: user.id,
    competitor_id: competitorId,
    url: target.url,
    provider: target.provider,
  })
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  return NextResponse.json({ queued: true })
}
