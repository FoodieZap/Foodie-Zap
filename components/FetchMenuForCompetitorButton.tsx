'use client'
import { useEffect, useState } from 'react'

export default function FetchMenuForCompetitorButton({
  competitorId,
  className,
}: {
  competitorId: string
  className?: string
}) {
  const [loading, setLoading] = useState(false)
  const [avg, setAvg] = useState<number | null>(null)
  const [items, setItems] = useState<Array<{ name: string; price?: number | null }> | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchOnce() {
    const r = await fetch(`/api/menus/status?competitorId=${competitorId}`)
    const j = await r.json()
    if (j.ok) {
      setAvg(j.avg_price ?? null)
      setItems(j.top_items ?? null)
    }
  }

  async function run() {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/menus/scrape-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitorId }),
      })
      if (!res.ok) throw new Error(`Scrape failed (${res.status})`)
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 1200))
        await fetchOnce()
      }
    } catch (e: any) {
      setError(e.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOnce()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={run}
        disabled={loading}
        className={
          className ||
          'rounded bg-gray-900 text-white px-3 py-1.5 text-sm hover:bg-gray-800 disabled:opacity-50'
        }
      >
        {loading ? 'Fetching…' : 'Fetch menu'}
      </button>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {avg != null && (
        <p className="text-sm">
          Avg ticket: <strong>${avg.toFixed(2)}</strong>
        </p>
      )}
      {items && items.length > 0 && (
        <ul className="text-sm list-disc pl-5 space-y-1">
          {items.slice(0, 10).map((i, idx) => (
            <li key={idx}>
              {i.name}
              {i.price != null ? ` — $${Number(i.price).toFixed(2)}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
