export const dynamic = 'force-dynamic'

import ResultsView from '@/components/ResultsView'
import MenuCard from '@/components/MenuCard'
import ActionsCard from '@/components/ActionsCard'
import GeneratePlaceholders from '@/components/GeneratePlaceholders'
import { createSupabaseRSC } from '@/utils/supabase/server'
import { encodeCursor, decodeCursor } from '@/lib/cursor'
import Pagination from '@/components/Pagination'
import { redirect } from 'next/navigation'
import BackToHistory from '@/components/BackToHistory'
import FetchMenusButton from '@/components/FetchMenusButton'
import NicheMenuCard from '@/components/NicheMenuCard'
import AnalyticsStrip from '@/components/AnalyticsStrip'

type PageProps = {
  params: Promise<{ searchId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const PAGE_SIZE = 20

export default async function ResultsPage({ params, searchParams }: PageProps) {
  const supabase = await createSupabaseRSC()

  // ⬇️ Next 15 requires awaiting the promisified props
  const { searchId } = await params
  const sp = await searchParams
  const view = sp.view === 'map' ? 'map' : 'list'
  const afterRaw = typeof sp.after === 'string' ? sp.after : undefined
  const beforeRaw = typeof sp.before === 'string' ? sp.before : undefined
  const after = decodeCursor(afterRaw)
  const before = decodeCursor(beforeRaw)

  // 1) Validate search belongs to user
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

  if (after) {
    query = query.or(
      `review_count.lt.${after.rc},and(review_count.eq.${after.rc},id.gt.${after.id})`,
    )
  }
  if (before && !after) {
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

  let hasPrev = Boolean(before)
  let hasNext = Boolean(after)
  let pageItems = compsRaw ?? []

  if (pageItems.length > PAGE_SIZE) {
    if (before && !after) {
      hasPrev = true
      pageItems = pageItems.slice(-PAGE_SIZE)
    } else {
      hasNext = true
      pageItems = pageItems.slice(0, PAGE_SIZE)
    }
  }

  const first = pageItems[0]
  const last = pageItems[pageItems.length - 1]
  const mkHref = (p: Record<string, string | undefined>) => {
    const usp = new URLSearchParams()
    if (p.after) usp.set('after', p.after)
    if (p.before) usp.set('before', p.before)
    if (view === 'map') usp.set('view', 'map')
    return usp.toString() ? `?${usp.toString()}` : ''
  }
  const prevHref =
    first && hasPrev
      ? mkHref({ before: encodeCursor({ rc: first.review_count ?? 0, id: first.id }) })
      : null
  const nextHref =
    last && hasNext
      ? mkHref({ after: encodeCursor({ rc: last.review_count ?? 0, id: last.id }) })
      : null

  const compIds = (pageItems ?? [])
    .map((c: any) => c.id)
    .filter((x: any): x is string => typeof x === 'string')

  let starredIds: string[] = []
  if (compIds.length) {
    const { data: starredRows } = await supabase
      .from('watchlist')
      .select('competitor_id')
      .in('competitor_id', compIds)
    starredIds = (starredRows ?? []).map((r: any) => r.competitor_id as string)
  }

  if ((pageItems?.length ?? 0) === 0) {
    if (after)
      redirect(
        `?before=${encodeCursor({ rc: after.rc, id: after.id })}${
          view === 'map' ? '&view=map' : ''
        }`,
      )
    if (before)
      redirect(
        `?after=${encodeCursor({ rc: before.rc, id: before.id })}${
          view === 'map' ? '&view=map' : ''
        }`,
      )
    redirect(view === 'map' ? '?view=map' : '?')
  }

  // 5) Menus for items on this page
  const { data: menus } = await supabase
    .from('menus')
    .select('competitor_id, avg_price, top_items')
    .in('competitor_id', compIds)

  // 6) Insights
  const { data: insightRow } = await supabase
    .from('insights')
    .select('summary, actions')
    .eq('search_id', search.id)
    .maybeSingle()

  // 7) Attach score if present in data._score
  const items = (pageItems ?? []).map((c: any) => {
    const s = (c as any)?.data?._score
    return { ...c, _score: typeof s === 'number' ? s : null }
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
            <br />
            <BackToHistory />
          </div>
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
        <FetchMenusButton searchId={search.id} />
      </div>
      <ResultsView
        items={items as any}
        centerLat={search.latitude}
        centerLng={search.longitude}
        starredIds={starredIds}
        initialMode={view}
        initialWatchlistIds={starredIds}
        menus={menus ?? []}
      />

      {view !== 'map' && (
        <Pagination
          prevHref={prevHref}
          nextHref={nextHref}
          hasPrev={Boolean(prevHref)}
          hasNext={Boolean(nextHref)}
        />
      )}

      <AnalyticsStrip searchId={search.id} />
      <NicheMenuCard menus={menus ?? []} />
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
