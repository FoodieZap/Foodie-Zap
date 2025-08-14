export const dynamic = 'force-dynamic'

// app/results/page.tsx
import { createSupabaseRSC } from '@/utils/supabase/server'
import Link from 'next/link'

export default async function RlsDebugPage() {
  const supabase = createSupabaseRSC()

  // 1) get current user (safe read-only)
  let user: { id: string; email?: string | null } | null = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data && data.user ? (data.user as any) : null
  } catch {
    user = null
  }

  if (!user) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-2">Search History</h1>
        <p className="text-gray-700">
          You are not logged in. Please{' '}
          <a href="/auth/login" className="underline">
            log in
          </a>{' '}
          and reload.
        </p>
      </main>
    )
  }

  // 2) list the user's searches (RLS should enforce this)
  const { data: searches, error } = await supabase
    .from('searches')
    .select('id, query, city, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-2">Search History</h1>
      <p className="text-sm text-gray-600 mb-6">
        Signed in as <span className="font-medium">{user.email ?? user.id}</span>
      </p>

      {error && (
        <div className="mb-4 rounded bg-rose-50 text-rose-700 p-3">
          Error loading searches: {error.message}
        </div>
      )}

      <div className="rounded border bg-white">
        <div className="px-4 py-2 border-b font-medium">Your last 50 searches</div>
        <div className="divide-y">
          {(!searches || searches.length === 0) && (
            <div className="p-4 text-gray-500">No searches yet.</div>
          )}
          {searches?.map((s) => (
            <div key={s.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">
                  {s.query} — {s.city}
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(s.created_at as any).toLocaleString()} • {s.status}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link className="text-blue-600 underline" href={`/results/${s.id}`}>
                  View competitors
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 text-sm text-gray-600">
        Tip: open this page in a normal window as <b>User A</b> and in an <b>Incognito</b> window as{' '}
        <b>User B</b>. Each side should only see their own rows here.
      </div>
    </main>
  )
}
