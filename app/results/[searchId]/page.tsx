export const dynamic = 'force-dynamic'

// app/results/[searchId]/page.tsx
import { createSupabaseRSC } from '@/utils/supabase/server'
import Link from 'next/link'
import ResultsView from '@/components/ResultsView'
import MenuCard from '@/components/MenuCard'
import ActionsCard from '@/components/ActionsCard'
import GeneratePlaceholders from '@/components/GeneratePlaceholders'

const PAGE_SIZE = 20

export default async function ResultsPage({
  params,
  searchParams,
}: {
  // Next 15: these are Promises, must be awaited
  params: Promise<{ searchId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // read params & query
  const { searchId } = await params
  const sp = await searchParams

  const supabase = await createSupabaseRSC()

  // 1) Load the search row (RLS ensures ownership)
  const { data: search, error: searchErr } = await supabase
    .from('searches')
    .select('id, query, city, latitude, longitude, status, created_at')
    .eq('id', searchId)
    .single()

  if (searchErr || !search) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-semibold">Search not found or not accessible.</h1>
        <p className="mt-2 text-gray-600">
          Double-check the link or open from your{' '}
          <a className="underline text-blue-600" href="/history">
            History
          </a>
          .
        </p>
      </main>
    )
  }

  // 2) Paging
  const pageParam = sp?.page
  const page = pageParam ? parseInt(pageParam as string, 10) || 1 : 1
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  // 3) Competitors for this search
  const {
    data: competitors,
    error: compErr,
    count,
  } = await supabase
    .from('competitors')
    .select('id, name, source, rating, review_count, price_level, address, lat, lng, data', {
      count: 'exact',
    })
    .eq('search_id', searchId)
    .order('review_count', { ascending: false })
    .range(from, to)

  // 4) Watchlist (starred)
  // (ordering by rating here is harmless; remove if your watchlist table doesn't have that column)
  const { data: starredRows } = await supabase
    .from('watchlist')
    .select('competitor_id')
    .eq('search_id', search.id)

  const starredIds = (starredRows ?? []).map((r: any) => r.competitor_id as string)

  // 5) Menus for the competitors on this search
  const { data: menus } = await supabase
    .from('menus')
    .select('competitor_id, avg_price, top_items')
    .in(
      'competitor_id',
      (competitors ?? []).map((c: any) => c.id),
    )

  // 6) Insights (summary + actions) for this search
  const { data: insightRow } = await supabase
    .from('insights')
    .select('summary, actions')
    .eq('search_id', search.id)
    .maybeSingle()

  // 7) Surface data._score (optional)
  const items = (competitors ?? []).map((c) => {
    let score: number | null = null
    try {
      const s = (c as any)?.data?._score
      if (typeof s === 'number') score = s
    } catch {}
    return { ...c, _score: score }
  })

  // 8) Pagination summary
  const total = count ?? items.length
  const totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1
  const hasPrev = page > 1
  const hasNext = page < totalPages

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      {/* <div>
        <Link href="/history" className="text-blue-600 underline">
          ← Back to history
        </Link>
      </div> */}
      <div>
        <Link href="/dashboard" className="text-blue-600 underline">
          ← ← Back to Dashboard
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            Results for: {search.query} — {search.city}
          </h1>
          <div className="text-sm text-gray-600">
            {new Date(search.created_at as any).toLocaleString()}
          </div>
        </div>

        <div>
          <a
            href={`/api/export-csv?search_id=${search.id}`}
            className="rounded bg-gray-900 text-white px-3 py-1.5 text-sm hover:bg-gray-800 mr-1"
          >
            Export CSV
          </a>

          <a
            href={`/api/export/xlsx?searchId=${search.id}`}
            className="rounded bg-gray-900 text-white px-3 py-1.5 text-sm hover:bg-gray-800 mr-1"
          >
            Export XLSX
          </a>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <GeneratePlaceholders searchId={search.id} />
      </div>

      {/* Results list / map */}
      <ResultsView
        items={items as any}
        centerLat={search.latitude}
        centerLng={search.longitude}
        starredIds={starredIds}
      />

      {/* Pagination Controls */}
      <div className="flex items-center justify-center gap-3 mt-2">
        {hasPrev ? (
          <a
            href={`?page=${page - 1}`}
            className="px-3 py-1 rounded border text-sm hover:bg-gray-100"
          >
            ← Prev
          </a>
        ) : (
          <span className="px-3 py-1 rounded border text-sm opacity-50 cursor-not-allowed">
            ← Prev
          </span>
        )}

        <span className="text-sm">
          Page {page} of {totalPages}
        </span>

        {hasNext ? (
          <a
            href={`?page=${page + 1}`}
            className="px-3 py-1 rounded border text-sm hover:bg-gray-100"
          >
            Next →
          </a>
        ) : (
          <span className="px-3 py-1 rounded border text-sm opacity-50 cursor-not-allowed">
            Next →
          </span>
        )}
      </div>

      <MenuCard menus={menus ?? []} />

      <div className="mt-4">
        <ActionsCard
          summary={(insightRow?.summary as string) ?? null}
          actions={(insightRow?.actions as string[]) ?? null}
        />
      </div>
    </main>
  )
}
