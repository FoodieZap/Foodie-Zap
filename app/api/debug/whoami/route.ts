import { NextResponse } from 'next/server'
import { createSupabaseRoute } from '@/utils/supabase/route'

export async function GET() {
  const supabase = await createSupabaseRoute()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  return NextResponse.json({ user, error })
}
