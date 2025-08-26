export const dynamic = 'force-dynamic'

//import Link from 'next/link'
import ResultsView from '@/components/ResultsView'
import MenuCard from '@/components/MenuCard'
import ActionsCard from '@/components/ActionsCard'
import GeneratePlaceholders from '@/components/GeneratePlaceholders'
import { createSupabaseRSC } from '@/utils/supabase/server'
import { encodeCursor, decodeCursor } from '@/lib/cursor'
import Pagination from '@/components/Pagination'
import { redirect } from 'next/navigation'
import BackToHistory from '@/components/BackToHistory'

interface PageProps {
  params: Promise<{ searchId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const PAGE_SIZE = 20

export default async function ResultsPage({ params, searchParams }: PageProps) {
  const supabase = await createSupabaseRSC()

  // Next 15: await the dynamic params/searchParams
  const { searchId } = await params
  const sp = await searchParams
  const view = sp.view === 'map' ? 'map' : 'list'
  const afterRaw = typeof sp.after === 'string' ? sp.after : undefined
  const beforeRaw = typeof sp.before === 'string' ? sp.before : undefined
  const after = decodeCursor(afterRaw)
  const before = decodeCursor(beforeRaw)

  // 1) Validate search belongs to user (RLS will enforce too)
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

  // 2) Build competitors query (keyset pagination)
  let query = supabase
    .from('competitors')
    .select('id, name, source, rating, review_count, price_level, address, lat, lng, data')
    .eq('search_id', searchId)
    .order('review_count', { ascending: false })
    .order('id', { ascending: true })
    .limit(PAGE_SIZE + 1)

  // AFTER (next page)
  if (after) {
    // (review_count < rc) OR (review_count = rc AND id > id)
    // Supabase .or accepts comma-separated disjuncts
    query = query.or(
      `review_count.lt.${after.rc},and(review_count.eq.${after.rc},id.gt.${after.id})`,
    )
  }

  // BEFORE (prev page)
  if (before && !after) {
    // (review_count > rc) OR (review_count = rc AND id < id)
    query = query.or(
      `review_count.gt.${before.rc},and(review_count.eq.${before.rc},id.lt.${before.id})`,
    )
  }

  const { data: compsRaw, error: compErr } = await query

  if (compErr) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-semibold">Error loading results</h1>
        <pre className="mt-2 text-sm text-red-600">{compErr.message}</pre>
      </main>
    )
  }

  let hasPrev = Boolean(before) // if you came with a "before", you definitely have newer pages
  let hasNext = Boolean(after) // if you came with an "after", you definitely have older pages
  let pageItems = compsRaw ?? []

  // We fetched PAGE_SIZE+1 to detect more
  if (pageItems.length > PAGE_SIZE) {
    if (before && !after) {
      // We asked for items "before" the cursor (earlier in the sorted list).
      // Keep the LAST PAGE_SIZE items; there exists even earlier -> hasPrev = true
      hasPrev = true
      pageItems = pageItems.slice(-PAGE_SIZE)
    } else {
      // Initial load or "after": keep the FIRST PAGE_SIZE items; more exist -> hasNext = true
      hasNext = true
      pageItems = pageItems.slice(0, PAGE_SIZE)
    }
  }

  // 3) Derive cursors for Prev/Next links from first/last item of this page
  const first = pageItems[0]
  const last = pageItems[pageItems.length - 1]

  const mkHref = (params: Record<string, string | undefined>) => {
    const usp = new URLSearchParams()
    // only include cursor we set (after or before)
    if (params.after) usp.set('after', params.after)
    if (params.before) usp.set('before', params.before)
    const qs = usp.toString()
    return qs ? `?${qs}` : ''
  }

  const prevHref =
    first && hasPrev
      ? mkHref({ before: encodeCursor({ rc: first.review_count ?? 0, id: first.id }) })
      : null

  const nextHref =
    last && hasNext
      ? mkHref({ after: encodeCursor({ rc: last.review_count ?? 0, id: last.id }) })
      : null

  // 4) Build starredIds ONLY for items on this page
  // 4) Build starredIds ONLY for items on this page (persist across *any* search)
  const compIds = (pageItems ?? [])
    .map((c: any) => c.id)
    .filter((x: any): x is string => typeof x === 'string')

  let starredIds: string[] = []
  if (compIds.length) {
    const { data: starredRows } = await supabase
      .from('watchlist')
      .select('competitor_id')
      .in('competitor_id', compIds) // RLS ensures current user
    // NOTE: do NOT filter by search_id here — we want stars to show across searches
    starredIds = (starredRows ?? []).map((r: any) => r.competitor_id as string)
  }

  // If we overshot and got no items, auto-fallback to previous cursor
  if ((pageItems?.length ?? 0) === 0) {
    if (after) {
      // Tried to go forward but nothing there → go back one step
      redirect(
        `?before=${encodeCursor({ rc: after.rc, id: after.id })}${
          view === 'map' ? '&view=map' : ''
        }`,
      )
    }
    if (before) {
      // Tried to go backward but nothing there → go forward one step
      redirect(
        `?after=${encodeCursor({ rc: before.rc, id: before.id })}${
          view === 'map' ? '&view=map' : ''
        }`,
      )
    }
    // No cursors at all (strange edge) — fall back to base view
    redirect(view === 'map' ? '?view=map' : '?')
  }

  // 5) Load menus for items on this page
  const { data: menus } = await supabase
    .from('menus')
    .select('competitor_id, avg_price, top_items')
    .in('competitor_id', compIds)

  // 6) Load insights (one row per search)
  const { data: insightRow } = await supabase
    .from('insights')
    .select('summary, actions')
    .eq('search_id', search.id)
    .maybeSingle()

  // 7) Surface score if stored in data._score (optional)
  const items = (pageItems ?? []).map((c: any) => {
    let score: number | null = null
    try {
      const s = (c as any)?.data?._score
      if (typeof s === 'number') score = s
    } catch {}
    return { ...c, _score: score }
  })

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            Results for: {search.query} — {search.city}
          </h1>

          <div className="text-sm text-gray-600">
            {new Date(search.created_at as any).toLocaleString()}
          </div>

          <div className="flex items-center gap-3">
            {/* Back to history (only appears if the hash is present) */}
            <br></br>
            <BackToHistory />
          </div>
          {/* Keep your existing back to dashboard link if you like */}
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-sm underline text-blue-600">
              ← Back to dashboard
            </a>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/api/export-csv?search_id=${search.id}`}
            className="rounded bg-gray-900 text-white px-3 py-1.5 text-sm hover:bg-gray-800"
          >
            Export CSV
          </a>
          <a
            href={`/api/export/xlsx?searchId=${search.id}`}
            className="rounded bg-gray-900 text-white px-3 py-1.5 text-sm hover:bg-gray-800"
          >
            Export XLSX
          </a>
        </div>
      </div>

      <div className="flex gap-2">
        <GeneratePlaceholders searchId={search.id} />
        {/* If you add Trends or true Insights later, add buttons here */}
      </div>

      <ResultsView
        items={items as any}
        centerLat={search.latitude}
        centerLng={search.longitude}
        initialMode={view}
        initialWatchlistIds={starredIds}
      />

      {view !== 'map' && (
        <Pagination
          prevHref={prevHref}
          nextHref={nextHref}
          hasPrev={Boolean(prevHref)}
          hasNext={Boolean(nextHref)}
        />
      )}

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
