import { createSupabaseRSC } from '@/utils/supabase/server'
import SearchForm from '@/components/SearchForm'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createSupabaseRSC()

  // who is logged in?
  let user: { id: string; email?: string | null } | null = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data && data.user ? (data.user as any) : null
  } catch {
    user = null
  }

  if (!user) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-3">Dashboard</h1>
        <p className="mb-2">You are not logged in.</p>
        <p>
          <a href="/auth/login" className="underline text-blue-600">
            Log in
          </a>{' '}
          to continue.
        </p>
      </main>
    )
  }

  // recent searches (RLS ensures only this user's)
  const { data: searches } = await supabase
    .from('searches')
    .select('id, query, city, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <SearchForm defaultCity="" />

      <div className="rounded border bg-white">
        <div className="px-4 py-2 border-b font-medium">Recent searches</div>
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
              <Link className="text-blue-600 underline" href={`/results/${s.id}`}>
                View results
              </Link>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
