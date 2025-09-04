'use client'

import { useEffect, useMemo, useState } from 'react'

type MenuItem = { name: string; price?: number | null }
type Section = { name: string; items: Array<{ name: string; price?: number | null }> }
type Metrics = {
  avg_ticket: number | null
  by_section: Record<string, { avg: number; count: number }>
}
type SourceHit = { url: string; title?: string; source?: string }

type StatusResp = {
  ok: boolean
  ready: boolean
  avg_price: number | null
  top_items: MenuItem[] | null
  source_url: string | null
  updated_at: string | null
  sectioned_menu?: Section[] | null
  metrics?: Metrics | null
  sources?: Array<{ url: string; title?: string; source?: string }> | null
}

type ScrapeResp = {
  ok: boolean
  competitorId: string | null
  targetUrl: string
  avg_price: number | null
  top_items: MenuItem[] | null
  source: string
  item_count: number
  sectioned_menu?: Section[] | null
  metrics?: Metrics | null
  sources?: Array<{ url: string; title?: string; source?: string }> | null
}

export default function MenuSection({ competitorId }: { competitorId: string }) {
  const [avg, setAvg] = useState<number | null>(null)
  const [items, setItems] = useState<MenuItem[] | null>(null)
  const [sections, setSections] = useState<Section[] | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [sources, setSources] = useState<Array<{
    url: string
    title?: string
    source?: string
  }> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const [lastItemCount, setLastItemCount] = useState<number | null>(null)

  async function readStatus() {
    const r = await fetch(`/api/menus/status?competitorId=${competitorId}`, { cache: 'no-store' })
    const j: StatusResp = await r.json()

    const hasData =
      j.ready ||
      j.avg_price != null ||
      (Array.isArray(j.top_items) && j.top_items.length > 0) ||
      (Array.isArray(j.sectioned_menu) && j.sectioned_menu.length > 0)

    if (j.ok && hasData) {
      setAvg(j.avg_price ?? null)
      setItems(j.top_items ?? null)
      setSections(j.sectioned_menu ?? null)
      setMetrics(j.metrics ?? null)
      setSourceUrl(j.source_url ?? null)
      setUpdatedAt(j.updated_at ?? null)
      setSources(j.sources ?? null)
    }
    return Boolean(j.ready)
  }

  async function runScrape() {
    try {
      setLoading(true)
      setError(null)
      setLastItemCount(null)

      const res = await fetch('/api/menus/scrape-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitorId }),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(`Scrape failed (${res.status}) ${t}`)
      }

      const s: ScrapeResp = await res.json()
      setAvg(s.avg_price ?? null)
      setItems(s.top_items ?? null)
      setSections(s.sectioned_menu ?? null)
      setMetrics(s.metrics ?? null)
      setSourceUrl(s.targetUrl ?? null)
      setSources(s.sources ?? null)
      setLastItemCount(typeof s.item_count === 'number' ? s.item_count : null)

      // poll status briefly to catch DB upsert updates
      setPolling(true)
      let ready = false
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 1100))
        ready = await readStatus()
        if (ready) break
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch menu')
    } finally {
      setPolling(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    readStatus().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitorId])

  const hasMenu = useMemo(() => {
    return (items?.length ?? 0) > 0 || (sections?.length ?? 0) > 0 || avg != null
  }, [items, sections, avg])

  return (
    <section className="rounded border bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Menu</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={runScrape}
            disabled={loading || polling}
            className="rounded bg-gray-900 text-white px-3 py-1.5 text-sm hover:bg-gray-800 disabled:opacity-50"
          >
            {loading || polling ? 'Fetching…' : 'Fetch menu'}
          </button>
          <button
            onClick={() => readStatus()}
            disabled={loading || polling}
            className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            title="Refresh status"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!hasMenu && !error && (
        <p className="text-sm text-gray-600">
          No menu found yet. Click <em>Fetch menu</em> to try scraping this restaurant’s site.
        </p>
      )}

      {(lastItemCount != null || sourceUrl || (sources?.length ?? 0) > 0) && (
        <div className="text-xs text-gray-500 space-y-1">
          {lastItemCount != null ? <p>Found {lastItemCount} items.</p> : null}
          {sourceUrl ? (
            <p>
              Primary source:{' '}
              <a className="underline" href={sourceUrl} target="_blank" rel="noreferrer">
                {sourceUrl}
              </a>
            </p>
          ) : null}
          {(sources?.length ?? 0) > 0 ? (
            <div className="flex flex-wrap gap-2">
              {sources!.slice(0, 8).map((s, i) => (
                <a
                  key={i}
                  className="underline truncate max-w-[22rem]"
                  href={s.url}
                  title={s.title || s.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {(s.source ? s.source + ': ' : '') + (s.title || s.url)}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {hasMenu && (
        <div className="space-y-3">
          {avg != null && (
            <p className="text-sm">
              Avg ticket: <strong>${avg.toFixed(2)}</strong>
              {updatedAt ? (
                <span className="text-gray-500 ml-2">
                  (updated {new Date(updatedAt).toLocaleString()})
                </span>
              ) : null}
            </p>
          )}

          {sections && sections.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-semibold">Full menu (AI)</h3>
              <div className="rounded border divide-y">
                {sections.map((sec, i) => (
                  <details key={i} className="px-3 py-2">
                    <summary className="cursor-pointer text-sm font-medium">
                      {sec.name} <span className="text-gray-500">({sec.items.length})</span>
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {sec.items.map((it, j) => (
                        <li key={j} className="flex items-baseline justify-between text-sm">
                          <span>{it.name}</span>
                          {typeof it.price === 'number' && (
                            <span className="tabular-nums">${it.price.toFixed(2)}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
