import { NextResponse } from 'next/server'
import { createSupabaseRoute } from '@/utils/supabase/route'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createSupabaseRoute()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!user) return NextResponse.json({ user: null })
  return NextResponse.json({ user: { id: user.id, email: user.email } })
}
