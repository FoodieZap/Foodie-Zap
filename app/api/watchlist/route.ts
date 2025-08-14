// app/api/watchlist/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseRoute } from '@/utils/supabase/route'

export async function GET() {
  const supabase = createSupabaseRoute()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Join to competitors so the UI has everything it needs
  const { data, error } = await supabase
    .from('watchlist')
    .select(
      `
      id, note, created_at, updated_at, competitor_id,
      competitors:competitor_id (
        id, search_id, name, source, rating, review_count, price_level, address, phone, website, lat, lng
      )
    `,
    )
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data })
}

export async function POST(req: Request) {
  const supabase = createSupabaseRoute()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const competitor_id = body?.competitor_id as string | undefined
  const note = (body?.note ?? null) as string | null
  if (!competitor_id) {
    return NextResponse.json({ error: 'competitor_id is required' }, { status: 400 })
  }

  // Upsert (insert or update note)
  const { data, error } = await supabase
    .from('watchlist')
    .upsert({ user_id: user.id, competitor_id, note }, { onConflict: 'user_id,competitor_id' })
    .select('id, competitor_id, note')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, item: data })
}

export async function DELETE(req: Request) {
  const supabase = createSupabaseRoute()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const competitor_id = searchParams.get('competitor_id')
  if (!competitor_id) {
    return NextResponse.json({ error: 'competitor_id is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('watchlist')
    .delete()
    .match({ user_id: user.id, competitor_id })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
