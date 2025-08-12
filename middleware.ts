import { NextResponse, type NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // This refreshes the auth cookies if needed, keeping the session alive
  const supabase = createMiddlewareClient({ req, res })
  await supabase.auth.getSession()

  return res
}

// Run on all routes (cheap), or restrict to protected routes only
export const config = {
  matcher: ['/(.*)'],
  // if you prefer just protected pages: matcher: ['/dashboard/:path*']
}
