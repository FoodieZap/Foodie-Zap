// app/api/competitors/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseRoute } from '@/utils/supabase/route'

export async function GET(req: Request) {
  const supabase = await createSupabaseRoute()

  const { searchParams } = new URL(req.url)
  const searchId = searchParams.get('search_id')
  if (!searchId) return NextResponse.json({ error: 'missing search_id' }, { status: 400 })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('competitors')
    .select('*')
    .eq('search_id', searchId)
    .order('rating', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ competitors: data ?? [] })
}
