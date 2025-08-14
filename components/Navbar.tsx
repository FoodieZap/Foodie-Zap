// components/Navbar.tsx  (SERVER component – no 'use client')
import Link from 'next/link'
import { logout } from '@/app/auth/logout/actions'
import { createSupabaseRSC } from '@/utils/supabase/server'

export default async function Navbar() {
  // Create the read-only client (no cookie writes)
  const supabase = createSupabaseRSC()

  // Safely try to read the user; if refresh token is bad, just treat as logged out
  let user: { id: string; email?: string | null } | null = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data && data.user ? (data.user as any) : null
  } catch {
    user = null
  }

  return (
    <nav className="sticky top-0 z-40 flex items-center justify-between border-b bg-white/80 backdrop-blur px-4 py-3">
      <Link href="/" className="text-lg font-semibold">
        Foodie-Zap
      </Link>

      <div className="flex items-center gap-2">
        {user ? (
          <>
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Dashboard
            </Link>
            {/* <Link
              href="/watchlist"
              className="inline-flex items-center rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Watchlist
            </Link> */}
            <a href="/watchlist" className="inline-flex items-center rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
              Watchlist
            </a>
            <form action={logout}>
              <button
                type="submit"
                className="inline-flex items-center rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                Sign out
              </button>
            </form>
          </>
        ) : (
          <>
            <Link
              href="/auth/login"
              className="inline-flex items-center rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Log in
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex items-center rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
