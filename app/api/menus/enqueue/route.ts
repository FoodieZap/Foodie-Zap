export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createSupabaseRoute } from '@/utils/supabase/route'
import { targetsForSearch } from '@/lib/menuTargets'

export async function POST(req: Request) {
  const supabase = await createSupabaseRoute()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const u = new URL(req.url)
  const searchId = (u.searchParams.get('searchId') || '').trim()
  if (!searchId) return NextResponse.json({ error: 'searchId is required' }, { status: 400 })

  const { data: comps, error } = await supabase
    .from('competitors')
    .select('id, website, data')
    .eq('search_id', searchId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const targets = await targetsForSearch((comps ?? []) as any)
  if (!targets.length) return NextResponse.json({ queued: 0 })

  const rows = targets.map((t) => ({
    user_id: user.id,
    competitor_id: t.id,
    url: t.url,
    provider: t.provider,
  }))
  const { error: insErr } = await supabase.from('menu_jobs').insert(rows)
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  return NextResponse.json({ queued: rows.length })
}
