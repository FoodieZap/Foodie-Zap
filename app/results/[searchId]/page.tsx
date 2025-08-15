export const dynamic = 'force-dynamic'

// app/results/[searchId]/page.tsx
import { createSupabaseRSC } from '@/utils/supabase/server'
import ResultsTable from '@/components/ResultsTable'
import Link from 'next/link'
import ResultsView from '@/components/ResultsView'
import { Space } from 'lucide-react'
import MenuCard from '@/components/MenuCard'
import ActionsCard from '@/components/ActionsCard'
import GeneratePlaceholders from '@/components/GeneratePlaceholders'

interface PageProps {
  params: { searchId: string }
  // Next.js App Router passes query params here; values can be string or string[]
  searchParams?: { [key: string]: string | string[] | undefined }
}

const ITEMS_PER_PAGE = 10 // adjust to 20/25 if you prefer

export default async function ResultsPage({ params, searchParams }: PageProps) {
  const supabase = createSupabaseRSC()
  const searchId = params.searchId // <-- MUST come from params

  // 1) Ensure we can access the search (RLS enforces ownership)
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
          Double‑check the link or open from your{' '}
          <a className="underline text-blue-600" href="/history">
            History
          </a>
          .
        </p>
      </main>
    )
  }

  // 2) Parse ?page=... safely (string or string[] or undefined)
  const pageParam = searchParams?.page
  const page = pageParam ? parseInt(pageParam as string, 10) : 1
  const pageSize = 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  // 3) Fetch this page of competitors + total count
  const {
    data: competitors,
    error: compErr,
    count,
  } = await supabase
    .from('competitors')
    .select('id, name, source, rating, review_count, price_level, address, lat, lng, data', {
      count: 'exact',
    })
    .eq('search_id', searchId) // <-- CRITICAL: use the param
    .order('review_count', { ascending: false })
    .range(from, to)
  const { data: starredRows } = await supabase
    .from('watchlist')
    .select('competitor_id')
    .eq('search_id', search.id)
    .order('rating', { ascending: false })
    .range(from, to)
  // Which competitors are starred by this user?
  // const { data: starredRows } = await supabase.from('watchlist').select('competitor_id')
  // Load menus (for competitors in this search)
  const { data: menus } = await supabase
    .from('menus')
    .select('competitor_id, avg_price, top_items')
    .in(
      'competitor_id',
      (competitors ?? []).map((c: any) => c.id),
    )

  // Load insights for this search
  const { data: insightRow } = await supabase
    .from('insights')
    .select('summary, actions')
    .eq('search_id', search.id)
    .maybeSingle()

  const starredIds = (starredRows ?? []).map((r: any) => r.competitor_id as string)

  // 4) Surface score if you stored it inside data._score (optional)
  const items = (competitors ?? []).map((c) => {
    let score: number | null = null
    try {
      const s = (c as any)?.data?._score
      if (typeof s === 'number') score = s
    } catch {}
    return { ...c, _score: score }
  })

  const total = count ?? items.length
  const totalPages = total > 0 ? Math.ceil(total / ITEMS_PER_PAGE) : 1
  const hasPrev = page > 1
  const hasNext = page < totalPages

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <div>
        <Link href="/history" className="text-blue-600 underline">
          ← Back to history
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
      <div className="flex gap-2">
        {/* <form action={`/api/menus/placeholder?searchId=${search.id}`} method="post">
          <button className="rounded border px-3 py-1.5 text-sm hover:bg-gray-100" type="submit">
            Generate Menus (placeholder)
          </button>
        </form> */}
        <GeneratePlaceholders searchId={search.id} />
        {/* <form action={`/api/insights/placeholder?searchId=${search.id}`} method="post">
          <button className="rounded border px-3 py-1.5 text-sm hover:bg-gray-100" type="submit">
            Generate Insights (placeholder)
          </button>
        </form> */}
      </div>

      {/* The paged list */}

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
