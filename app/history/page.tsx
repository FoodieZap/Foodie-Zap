// app/history/page.tsx
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createSupabaseRSC } from '@/utils/supabase/server'

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createSupabaseRSC()
  const sp = await searchParams
  const page = sp?.page ? parseInt(sp.page as string, 10) : 1
  const pageSize = 10
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data: userData } = await supabase.auth.getUser()
  const user = userData?.user ?? null

  const { data: rows, error } = await supabase
    .from('searches')
    .select('id, created_at, city, query, status, total_competitors')
    .eq('user_id', user?.id ?? '__anon__')
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">History</h1>
        <p className="text-red-600">Error loading history: {error.message}</p>
      </main>
    )
  }

  return (
    <main className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">History</h1>
        <Link href="/new" className="text-sm px-3 py-1 rounded border hover:bg-gray-50">
          + New Analysis
        </Link>
      </div>

      {!rows?.length ? (
        <div className="border rounded p-6 text-gray-600">
          No saved runs yet. Start a{' '}
          <Link className="underline" href="/new">
            new analysis
          </Link>
          .
        </div>
      ) : (
        <div className="overflow-x-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">City</th>
                <th className="px-3 py-2">Query</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Competitors</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <Link className="underline" href={`/results/${r.id}`}>
                      {new Date(r.created_at).toLocaleString()}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{r.city ?? '-'}</td>
                  <td className="px-3 py-2 truncate max-w-[22ch]">
                    {typeof r.query === 'string' ? r.query : JSON.stringify(r.query)}
                  </td>
                  <td className="px-3 py-2">{r.status ?? 'ok'}</td>
                  <td className="px-3 py-2 text-right">{r.total_competitors ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Link
          className={`px-3 py-1 rounded border text-sm ${
            page === 1 ? 'opacity-50 pointer-events-none' : 'hover:bg-gray-50'
          }`}
          href={`?page=${page - 1}`}
        >
          ← Prev
        </Link>
        <span className="text-sm">Page {page}</span>
        <Link
          className={`px-3 py-1 rounded border text-sm ${
            rows && rows.length < pageSize ? 'opacity-50 pointer-events-none' : 'hover:bg-gray-50'
          }`}
          href={`?page=${page + 1}`}
        >
          Next →
        </Link>
      </div>
    </main>
  )
}
