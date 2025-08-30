'use client'
import { useEffect, useState } from 'react'

type Buckets = Record<string, number>
type Payload = {
  total: number
  coverage: { withWebsite: number; withMenu: number }
  medians: { rating: number | null; reviews: number | null; ticket: number | null }
  distributions: { ratingBuckets: Buckets; reviewBuckets: Buckets; priceMix: Buckets }
  menu: { topItems: Array<{ name: string; mentions: number }> }
}

export default function AnalyticsStrip({ searchId }: { searchId: string }) {
  const [data, setData] = useState<Payload | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/analytics?searchId=${encodeURIComponent(searchId)}`)
      .then((r) => r.json())
      .then((b) => alive && (b.error ? setErr(b.error) : setData(b)))
      .catch((e) => alive && setErr(e?.message || 'Error'))
    return () => {
      alive = false
    }
  }, [searchId])

  if (err) return <div className="rounded border p-3 text-sm text-rose-700 bg-rose-50">{err}</div>
  if (!data) return <div className="text-sm text-gray-600">Loading insights…</div>

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="rounded border p-3">
        <div className="text-xs text-gray-500 mb-1">Coverage</div>
        <div className="text-sm">
          Competitors: <b>{data.total}</b>
          <br />
          Websites: <b>{data.coverage.withWebsite}</b>
          <br />
          Menus: <b>{data.coverage.withMenu}</b>
        </div>
      </div>
      <div className="rounded border p-3">
        <div className="text-xs text-gray-500 mb-1">Medians</div>
        <div className="text-sm">
          Rating: <b>{data.medians.rating ?? '—'}</b>
          <br />
          Reviews: <b>{data.medians.reviews ?? '—'}</b>
          <br />
          Ticket: <b>{data.medians.ticket != null ? `$${data.medians.ticket.toFixed(2)}` : '—'}</b>
        </div>
      </div>
      <div className="rounded border p-3">
        <div className="text-xs text-gray-500 mb-1">Top Menu Items</div>
        <ul className="text-sm list-disc ml-4">
          {data.menu.topItems.length ? (
            data.menu.topItems.map((i) => (
              <li key={i.name}>
                {i.name} <span className="text-gray-500">· {i.mentions}</span>
              </li>
            ))
          ) : (
            <li className="list-none text-gray-600">No items yet</li>
          )}
        </ul>
      </div>
    </div>
  )
}
