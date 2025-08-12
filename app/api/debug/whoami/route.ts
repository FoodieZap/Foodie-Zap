import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/utils/supabase/server'

export async function GET() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  return NextResponse.json({ user, error })
}
