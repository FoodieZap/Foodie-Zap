'use client'

import { useEffect, useMemo, useState } from 'react'

type MenuItem = { name: string; price?: number | null }
type StatusResp = {
  ok: boolean
  ready: boolean
  avg_price: number | null
  top_items: MenuItem[] | null
  source_url: string | null
  updated_at: string | null
}
type ScrapeResp = {
  ok: boolean
  competitorId: string | null
  targetUrl: string
  avg_price: number | null
  top_items: MenuItem[] | null
  source: string
  item_count: number
}

export default function MenuSection({ competitorId }: { competitorId: string }) {
  const [avg, setAvg] = useState<number | null>(null)
  const [items, setItems] = useState<MenuItem[] | null>(null)
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const [lastItemCount, setLastItemCount] = useState<number | null>(null)

  async function readStatus() {
    const r = await fetch(`/api/menus/status?competitorId=${competitorId}`, { cache: 'no-store' })
    const j: StatusResp = await r.json()

    // ⬇️ Only update UI if the DB actually has something (ready),
    // or the payload contains data (defensive in case of partial writes).
    const hasData =
      j.ready || j.avg_price != null || (Array.isArray(j.top_items) && j.top_items.length > 0)

    if (j.ok && hasData) {
      setAvg(j.avg_price ?? null)
      setItems(j.top_items ?? null)
      setSourceUrl(j.source_url ?? null)
      setUpdatedAt(j.updated_at ?? null)
    }

    return Boolean(j.ready)
  }

  async function runScrape() {
    try {
      setLoading(true)
      setError(null)
      setLastItemCount(null)

      // Kick off scrape for THIS competitor
      const res = await fetch('/api/menus/scrape-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitorId }),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(`Scrape failed (${res.status}) ${t}`)
      }

      // IMMEDIATE RENDER from POST result
      const s: ScrapeResp = await res.json()
      setAvg(s.avg_price ?? null)
      setItems(s.top_items ?? null)
      setSourceUrl(s.targetUrl ?? null)
      setLastItemCount(typeof s.item_count === 'number' ? s.item_count : null)

      // Then poll DB until we confirm it’s saved (or we time out)
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

  // Load any existing menu when the page opens
  useEffect(() => {
    readStatus().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitorId])

  const hasMenu = useMemo(() => (items?.length ?? 0) > 0 || avg != null, [items, avg])

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

      {/* tiny debug/status line to help you validate */}
      {(lastItemCount != null || sourceUrl) && (
        <p className="text-xs text-gray-500">
          {lastItemCount != null ? <>Found {lastItemCount} items.</> : null}{' '}
          {sourceUrl ? (
            <>
              Source:{' '}
              <a className="underline" href={sourceUrl} target="_blank" rel="noreferrer">
                {sourceUrl}
              </a>
            </>
          ) : null}
        </p>
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

          {items && items.length > 0 && (
            <div className="divide-y rounded border">
              {items.slice(0, 20).map((it, idx) => (
                <div key={idx} className="flex items-baseline justify-between px-3 py-2">
                  <div className="text-sm">{it.name}</div>
                  {it.price != null && (
                    <div className="text-sm tabular-nums">${Number(it.price).toFixed(2)}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
