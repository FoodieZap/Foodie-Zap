// app/watchlist/page.tsx
export const dynamic = 'force-dynamic'

import { createSupabaseRSC } from '@/utils/supabase/server'
import WatchlistItem from '@/components/WatchlistItem'

export default async function WatchlistPage() {
  const supabase = createSupabaseRSC()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-2">Watchlist</h1>
        <p>You are not logged in.</p>
      </main>
    )
  }

  const { data, error } = await supabase
    .from('watchlist')
    .select(
      `
      id, note, created_at, updated_at, competitor_id,
      competitors:competitor_id (
        id, search_id, name, source, rating, review_count, price_level, address, phone, website, lat, lng
      )
    `,
    )
    .order('created_at', { ascending: false })

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Watchlist</h1>
        <div>
          <a
            href="/api/export/xlsx?watchlist=1"
            className="rounded border px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            Export XLSX
          </a>
        </div>
      </div>

      {error && <div className="rounded bg-rose-50 text-rose-700 p-3">Error: {error.message}</div>}

      {!data || data.length === 0 ? (
        <div className="rounded border bg-white p-4 text-gray-600">
          Nothing saved yet. Go to a{' '}
          <a className="underline text-blue-600" href="/history">
            search
          </a>{' '}
          and star a few competitors.
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((row) => (
            <WatchlistItem
              key={row.id}
              id={row.id}
              competitor={row.competitors as any}
              note={(row.note ?? '') as string}
            />
          ))}
        </div>
      )}
    </main>
  )
}
