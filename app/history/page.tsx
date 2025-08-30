// app/history/page.tsx
export const dynamic = 'force-dynamic'

import { createSupabaseRSC } from '@/utils/supabase/server'
import { decodeHistoryCursor, encodeHistoryCursor } from '@/lib/cursorHistory'
import Pagination from '@/components/Pagination'
import { redirect } from 'next/navigation'

type PageProps = {
  params: Promise<Record<string, never>>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const PAGE_SIZE = 20

export default async function HistoryPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseRSC()

  // ⬇️ Next 15: await the promisified searchParams
  const sp = await searchParams

  // Filters
  const rawQ = typeof sp.q === 'string' ? sp.q.trim() : ''
  const q = rawQ.replace(/,/g, ' ')
  const sort = sp.sort === 'oldest' ? 'oldest' : 'newest' // default newest
  const afterRaw = typeof sp.after === 'string' ? sp.after : undefined
  const beforeRaw = typeof sp.before === 'string' ? sp.before : undefined
  const after = decodeHistoryCursor(afterRaw)
  const before = decodeHistoryCursor(beforeRaw)

  // Base query
  let query = supabase
    .from('searches')
    .select('id, query, city, status, created_at')
    .order('created_at', { ascending: sort === 'oldest' })
    .order('id', { ascending: true })
    .limit(PAGE_SIZE + 1)

  if (q) {
    query = query.or(`query.ilike.%${q}%,city.ilike.%${q}%`)
  }

  // Keyset pagination helpers
  const cmp = (dir: 'lt' | 'gt', ts: string, op: 'gt' | 'lt', id: string) =>
    `created_at.${dir}.${ts},and(created_at.eq.${ts},id.${op}.${id})`

  if (after && !before) {
    query =
      sort === 'newest'
        ? query.or(cmp('lt', after.ts, 'gt', after.id)) // older
        : query.or(cmp('gt', after.ts, 'gt', after.id)) // newer
  }
  if (before && !after) {
    query =
      sort === 'newest'
        ? query.or(cmp('gt', before.ts, 'lt', before.id)) // newer
        : query.or(cmp('lt', before.ts, 'lt', before.id)) // older
  }

  const { data: rowsRaw, error } = await query
  if (error) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-xl font-semibold">History</h1>
        <p className="mt-3 text-red-600">{error.message}</p>
      </main>
    )
  }

  let rows = rowsRaw ?? []
  let hasPrev = Boolean(before)
  let hasNext = Boolean(after)

  if (rows.length > PAGE_SIZE) {
    if (before && !after) {
      hasPrev = true
      rows = rows.slice(-PAGE_SIZE)
    } else {
      hasNext = true
      rows = rows.slice(0, PAGE_SIZE)
    }
  }

  // If overshot to emptiness, bounce back one step (preserve filters)
  if ((rows?.length ?? 0) === 0) {
    const suffix =
      q || sort === 'oldest'
        ? `&${new URLSearchParams({
            ...(q ? { q } : {}),
            ...(sort === 'oldest' ? { sort } : {}),
          }).toString()}`
        : ''
    if (after) redirect(`?before=${encodeHistoryCursor(after)}${suffix}`)
    if (before) redirect(`?after=${encodeHistoryCursor(before)}${suffix}`)
    redirect(suffix ? `?${suffix.slice(1)}` : '?')
  }

  const first = rows[0]
  const last = rows[rows.length - 1]

  const mkHref = (opts: { after?: string; before?: string }) => {
    const usp = new URLSearchParams()
    if (opts.after) usp.set('after', opts.after)
    if (opts.before) usp.set('before', opts.before)
    if (q) usp.set('q', q)
    if (sort === 'oldest') usp.set('sort', 'oldest')
    const s = usp.toString()
    return s ? `?${s}` : ''
  }

  const prevHref =
    first && hasPrev
      ? mkHref({ before: encodeHistoryCursor({ ts: first.created_at as string, id: first.id }) })
      : null
  const nextHref =
    last && hasNext
      ? mkHref({ after: encodeHistoryCursor({ ts: last.created_at as string, id: last.id }) })
      : null

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">History</h1>
        <a href="/dashboard" className="text-sm underline text-blue-600">
          ← Back to dashboard
        </a>
      </div>

      {/* Filters */}
      <form method="get" className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Filter by query or city…"
          className="px-3 py-1.5 rounded border text-sm w-56"
        />
        <select name="sort" defaultValue={sort} className="px-3 py-1.5 rounded border text-sm">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        <button className="px-3 py-1.5 rounded border text-sm hover:bg-gray-100" type="submit">
          Apply
        </button>
        {(q || sort === 'oldest') && (
          <a href="/history" className="px-3 py-1.5 rounded border text-sm hover:bg-gray-100">
            Clear
          </a>
        )}
      </form>

      {/* List */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Showing {rows.length} result{rows.length === 1 ? '' : 's'}
        </span>
        {q && <span>Filtered by “{q}”</span>}
      </div>

      <div className="rounded border divide-y">
        {rows.map((r) => (
          <div key={r.id} className="p-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">
                {r.query} <span className="text-gray-500">· {r.city}</span>
              </div>
              <div className="text-sm text-gray-600">
                {new Date(r.created_at as any).toLocaleString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
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
            <div className="flex items-center gap-2">
              {(() => {
                const backParams = new URLSearchParams()
                if (q) backParams.set('q', q)
                if (sort === 'oldest') backParams.set('sort', 'oldest')
                const backQS = backParams.toString() ? `?${backParams.toString()}` : ''
                return (
                  <a
                    href={`/results/${r.id}${
                      backQS ? `#fromHistory=${encodeURIComponent(backQS)}` : ''
                    }`}
                    className="px-3 py-1.5 rounded border text-sm hover:bg-gray-100"
                  >
                    Open
                  </a>
                )
              })()}
            </div>
          </div>
        ))}

        {rows.length === 0 && (
          <div className="p-6 text-gray-500">
            No searches yet. Try running one from the dashboard.
          </div>
        )}
      </div>

      {/* Pagination */}
      <Pagination
        prevHref={prevHref}
        nextHref={nextHref}
        hasPrev={Boolean(prevHref)}
        hasNext={Boolean(nextHref)}
      />
    </main>
  )
}
