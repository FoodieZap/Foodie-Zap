// app/api/watchlist/route.ts
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createSupabaseRoute } from '@/utils/supabase/route'

export async function GET() {
  const supabase = await createSupabaseRoute()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('watchlist')
    .select(
      `
      id, created_at, updated_at, competitor_id,
      competitors:competitor_id (
        id, search_id, name, source, rating, review_count, price_level, address, phone, website, lat, lng
      )
    `,
    )
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: Request) {
  const supabase = await createSupabaseRoute()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const competitor_id = typeof body?.competitor_id === 'string' ? body.competitor_id.trim() : ''
  if (!competitor_id) {
    return NextResponse.json({ error: 'competitor_id is required' }, { status: 400 })
  }

  // Insert with user_id explicitly to satisfy INSERT policy WITH CHECK (user_id = auth.uid()).
  const { error } = await supabase
    .from('watchlist')
    .upsert({ user_id: user.id, competitor_id }, { onConflict: 'user_id,competitor_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const supabase = await createSupabaseRoute()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const competitor_id = new URL(req.url).searchParams.get('competitor_id')?.trim()
  if (!competitor_id) {
    return NextResponse.json({ error: 'competitor_id is required' }, { status: 400 })
  }

  // Be explicit; RLS will also protect this.
  const { error } = await supabase
    .from('watchlist')
    .delete()
    .match({ user_id: user.id, competitor_id })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
