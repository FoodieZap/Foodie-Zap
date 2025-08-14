export const dynamic = 'force-dynamic'

// app/page.tsx
import { createSupabaseRSC } from '@/utils/supabase/server'
import { signOut } from '@/app/(auth)/actions'

export default async function Home() {
  // Create read-only Supabase client for Server Components
  const supabase = createSupabaseRSC()

  // Safely read the current user (do not attempt cookie writes here)
  let user = null as null | { id: string; email?: string | null }
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user as any
  } catch {
    // ignore refresh errors in RSC – page will treat as logged out
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
          Foodie‑Zap
        </span>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">
          Next.js + TypeScript + Tailwind + Supabase ✅
        </h1>
        <p className="mt-2 text-gray-600">
          If you can see this with proper spacing and colors, Tailwind is working.
        </p>

        {/* Top buttons change based on auth state */}
        <div className="mt-8 flex flex-wrap gap-3">
          {user ? (
            <>
              <a
                href="/dashboard"
                className="rounded-md border border-gray-300 px-4 py-2 text-gray-800 hover:bg-gray-100"
              >
                Go to Dashboard
              </a>

              {/* Sign out uses a Server Action so cookies are modified legally */}
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-800"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <a
                href="/auth/login"
                className="rounded-md bg-gray-900 px-4 py-2 text-white hover:bg-gray-800"
              >
                Log in
              </a>
              <a
                href="/auth/signup"
                className="rounded-md bg-white px-4 py-2 text-gray-900 ring-1 ring-gray-300 hover:bg-gray-50"
              >
                Sign up
              </a>
            </>
          )}
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-base font-semibold text-gray-900">Tailwind check</h2>
            <p className="mt-1 text-sm text-gray-600">
              This card has rounded corners, border, and spacing — all Tailwind.
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-base font-semibold text-gray-900">Next.js App Router</h2>
            <p className="mt-1 text-sm text-gray-600">
              You’re viewing <code className="font-mono text-xs">app/page.tsx</code>.
            </p>
            {user && (
              <p className="mt-2 text-sm text-emerald-700">
                Signed in as <span className="font-medium">{user.email ?? user.id}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
