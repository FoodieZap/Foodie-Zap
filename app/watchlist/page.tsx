export const dynamic = 'force-dynamic'

import { createSupabaseRSC } from '@/utils/supabase/server'
import NoteCell from '@/components/NoteCell'
import UnstarButton from '@/components/UnstarButton'
import NotesList from '@/components/NotesList'
import { Link } from 'lucide-react'

export default async function WatchlistPage() {
  const supabase = await createSupabaseRSC()

  // 🔒 Soft-gate when logged out
  let user: { id: string; email?: string | null } | null = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch {
    user = null
  }

  if (!user) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-2">Watchlist</h1>
        <p className="text-gray-700">You need to be logged in to view your watchlist.</p>
        <div className="mt-4 flex items-center gap-3">
          <a href="/auth/login" className="px-3 py-1.5 rounded border text-sm hover:bg-gray-100">
            <button>Log in</button>
          </a>

          <a href="/dashboard" className="text-sm underline text-blue-600">
            <button>← Back to dashboard</button>
          </a>
        </div>
      </main>
    )
  }

  const { data: rows, error } = await supabase
    .from('watchlist')
    .select(
      `
      competitor_id,
      note,
      created_at,
      competitors:competitor_id (
        id, name, source, rating, review_count, price_level, address
      )
    `,
    )
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return (
      <main className="max-w-5xl mx-auto p-6">
        <h1 className="text-xl font-semibold">Watchlist</h1>
        <p className="text-red-600 mt-2">{error.message}</p>
      </main>
    )
  }

  const list = rows ?? []

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Watchlist</h1>
        <a href="/dashboard" className="text-sm underline text-blue-600">
          ← Back to dashboard
        </a>
      </div>

      {list.length === 0 ? (
        <div className="rounded border p-6 text-gray-600">
          Your watchlist is empty. Star any location from results to add it here.
        </div>
      ) : (
        <div className="rounded border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Rating</th>
                <th className="px-3 py-2">Reviews</th>
                <th className="px-3 py-2">Price</th>

                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((w: any) => {
                const c = w.competitors
                return (
                  <tr key={w.competitor_id}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{c?.name ?? 'Unknown'}</div>
                      <div className="text-xs text-gray-500">
                        {c?.source ?? '—'} · {c?.address ?? '—'}
                      </div>
                    </td>
                    <td className="px-3 py-2">{c?.rating ?? '—'}</td>
                    <td className="px-3 py-2">{c?.review_count ?? '—'}</td>
                    <td className="px-3 py-2">{c?.price_level ?? '—'}</td>

                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <a
                          href={`/competitors/${w.competitor_id}`}
                          className="px-2 py-1 rounded border hover:bg-gray-100"
                        >
                          View
                        </a>
                        <UnstarButton competitorId={w.competitor_id} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
  //type shit bratukha
}
