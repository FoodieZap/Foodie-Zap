// components/Navbar.tsx  (SERVER component – no 'use client')
import Link from 'next/link'
import { createServerSupabase } from '@/utils/supabase/server'
import { logout } from '@/app/auth/logout/actions'

export default async function Navbar() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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
