// app/api/health/route.ts
import { NextResponse } from 'next/server'
import { hasEnv } from '@/lib/supabaseClient'

export const revalidate = 0 // always fresh

export async function GET() {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }

  // We’re not pinging the network here—just confirming config presence.
  const status =
    env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'ok' : 'missing_env'

  return NextResponse.json(
    {
      ok: status === 'ok',
      status,
      env,
      time: new Date().toISOString(),
    },
    { status: status === 'ok' ? 200 : 500 },
  )
}
