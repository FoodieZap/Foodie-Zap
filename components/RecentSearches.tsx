// components/RecentSearches.tsx
export const dynamic = 'force-dynamic'

import { createSupabaseRSC } from '@/utils/supabase/server'

type Row = {
  id: string
  query: string | null
  city: string | null
  status: string | null
  created_at: string
}

export default async function RecentSearches() {
  const supabase = await createSupabaseRSC()

  const { data: rows, error } = await supabase
    .from('searches')
    .select('id, query, city, status, created_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(5)

  if (error) {
    return (
      <div className="rounded border p-4">
        <div className="font-semibold mb-2">Recent Searches</div>
        <div className="text-sm text-red-600">Failed to load: {error.message}</div>
      </div>
    )
  }

  return (
    <div className="rounded border">
      <div className="flex items-center justify-between p-3">
        <div className="font-semibold">Recent Searches</div>
        <a href="/history" className="text-sm text-blue-600 underline">
          View all →
        </a>
      </div>

      {!rows || rows.length === 0 ? (
        <div className="p-4 text-sm text-gray-600">
          No recent searches. Try a sample query from the dashboard.
        </div>
      ) : (
        <div className="divide-y">
          {rows.map((r: Row) => (
            <div key={r.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {r.query ?? '—'} <span className="text-gray-500">· {r.city ?? '—'}</span>
                </div>
                <div className="text-xs text-gray-600">
                  {new Date(r.created_at as any).toLocaleString()}
                </div>
                {r.status && (
                  <span
                    className={`inline-block mt-1 text-[11px] px-2 py-0.5 rounded border ${
                      r.status === 'complete'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : r.status === 'running'
                        ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    {r.status}
                  </span>
                )}
              </div>

              <div className="shrink-0">
                <a
                  href={`/results/${r.id}`}
                  className="px-3 py-1.5 rounded border text-sm hover:bg-gray-100"
                >
                  Open
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
