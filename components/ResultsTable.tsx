'use client'
//components/ResultsTable.tsx
import { useEffect, useMemo, useState, useTransition } from 'react'

type Row = {
  id?: string | null
  name: string | null
  source: string | null
  rating: number | null
  review_count: number | null
  price_level: string | null
  address: string | null
  lat: number | null
  lng: number | null
  _score?: number | null
}

type ResultsTableProps = {
  items: Row[]
  centerLat?: number | null
  centerLng?: number | null
  initialWatchlistIds?: string[]
  menusMap?: Record<string, { avg_price: number | null; top_items: any[] | null }>
}

function distKm(
  aLat?: number | null,
  aLng?: number | null,
  bLat?: number | null,
  bLng?: number | null,
) {
  if (aLat == null || aLng == null || bLat == null || bLng == null) return Infinity
  const toRad = (v: number) => (v * Math.PI) / 180
  const R = 6371
  const dLat = toRad((bLat as number) - (aLat as number))
  const dLng = toRad((bLng as number) - (aLng as number))
  const lat1 = toRad(aLat as number)
  const lat2 = toRad(bLat as number)
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

export default function ResultsTable({
  items,
  centerLat,
  centerLng,
  initialWatchlistIds = [],
  menusMap = {}, // 👈 default
}: ResultsTableProps) {
  // UI state
  const [minRating, setMinRating] = useState<number | ''>('')
  const [sortBy, setSortBy] = useState<'score' | 'rating' | 'reviews'>('score')
  const [price, setPrice] = useState<string>('')
  const [maxDistanceKm, setMaxDistanceKm] = useState<string>('')

  // watchlist + transition
  const [stars, setStars] = useState<Set<string>>(new Set(initialWatchlistIds))
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition() // ✅ correct order

  useEffect(() => {
    setStars(new Set(initialWatchlistIds))
  }, [initialWatchlistIds])

  const filtered = useMemo(() => {
    let list = [...(items ?? [])]

    if (minRating !== '') list = list.filter((x) => (x.rating ?? 0) >= Number(minRating))
    if (price) list = list.filter((x) => (x.price_level ?? '') === price)

    const maxD = Number(maxDistanceKm)
    if (!Number.isNaN(maxD) && maxD > 0 && centerLat != null && centerLng != null) {
      list = list.filter((x) => distKm(centerLat, centerLng, x.lat, x.lng) <= maxD)
    }

    list.sort((a, b) => {
      if (sortBy === 'score') return (b._score ?? 0) - (a._score ?? 0)
      if (sortBy === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
      if (sortBy === 'reviews') return (b.review_count ?? 0) - (a.review_count ?? 0)
      return 0
    })

    return list
  }, [items, minRating, price, maxDistanceKm, sortBy, centerLat, centerLng])

  async function toggleStar(id?: string | null) {
    if (!id || busyId) return
    const alreadyStarred = stars.has(id)

    // If user is un-starring, warn them first
    if (alreadyStarred) {
      const ok = window.confirm(
        'Are you sure you want to remove this from your watchlist? All notes for this location will be deleted.',
      )
      if (!ok) return
    }

    setBusyId(id)

    // optimistic flip
    setStars((prev) => {
      const next = new Set(prev)
      if (alreadyStarred) next.delete(id)
      else next.add(id)
      return next
    })

    try {
      if (alreadyStarred) {
        // DELETE (remove + notes)
        const res = await fetch(`/api/watchlist?competitor_id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        })
        if (!res.ok) throw new Error(await res.text())
      } else {
        // Guard against double-save on client
        // (server should also enforce unique (user_id, competitor_id))
        const res = await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ competitor_id: id }),
        })
        if (!res.ok) throw new Error(await res.text())
      }
    } catch (e) {
      // rollback on failure
      setStars((prev) => {
        const next = new Set(prev)
        if (alreadyStarred) next.add(id) // we tried to remove but failed
        else next.delete(id) // we tried to add but failed
        return next
      })
      console.error('Star toggle failed', e)
      alert('Sorry, something went wrong. Please try again.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="rounded border bg-white">
      <div className="px-4 py-2 border-b flex items-center gap-3">
        <div className="font-medium">Competitors (List)</div>

        <div className="ml-auto flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span>Min rating</span>
            <input
              type="number"
              step="0.1"
              min={0}
              max={5}
              value={minRating as any}
              onChange={(e) => setMinRating(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-20 rounded border px-2 py-1"
            />
          </label>

          <label className="flex items-center gap-2">
            <span>Sort by</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded border px-2 py-1"
            >
              <option value="score">Score</option>
              <option value="rating">Rating</option>
              <option value="reviews">Reviews</option>
            </select>
          </label>

          <label className="text-sm">
            Price:&nbsp;
            <select
              className="border rounded px-2 py-1 text-sm"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            >
              <option value="">Any</option>
              <option value="$">$</option>
              <option value="$$">$$</option>
              <option value="$$$">$$$</option>
              <option value="$$$$">$$$$</option>
            </select>
          </label>

          <label className="text-sm">
            Max Distance (km):&nbsp;
            <input
              className="border rounded px-2 py-1 w-24 text-sm"
              type="number"
              min="0"
              step="0.1"
              value={maxDistanceKm}
              onChange={(e) => setMaxDistanceKm(e.target.value)}
              placeholder="—"
            />
          </label>
        </div>
      </div>

      <div className="divide-y">
        {filtered.length === 0 && (
          <div className="p-4 text-gray-500">No competitors matching your filters.</div>
        )}

        {filtered.map((c) => {
          const id = c.id ?? undefined
          const isStar = id ? stars.has(id) : false

          return (
            <div key={id ?? `${c.name}-${Math.random()}`} className="p-4">
              {/* top line */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleStar(id)}
                  disabled={!id || busyId === id || isPending}
                  title={isStar ? 'Unstar' : 'Star'}
                  aria-label={isStar ? 'Unstar' : 'Star'}
                  className={`text-lg ${
                    isStar ? 'text-amber-500' : 'text-gray-400 hover:text-gray-600'
                  } disabled:opacity-50`}
                >
                  {isStar ? '★' : '☆'}
                </button>

                <div className="font-medium">
                  {c.name ?? 'Unknown'}{' '}
                  <span className="text-xs text-gray-500">({c.source ?? '—'})</span>
                </div>

                {id && (
                  <a href={`/competitors/${id}`} className="text-blue-600 text-sm underline">
                    View
                  </a>
                )}
              </div>

              {/* second line — with yellow rating star */}
              <div className="text-sm text-gray-700 mt-1 flex flex-wrap items-center gap-2">
                {typeof c.rating === 'number' && (
                  <span className="inline-flex items-center gap-1">
                    <span className="text-yellow-500">★</span>
                    <span>{c.rating.toFixed(1)}</span>
                  </span>
                )}
                {typeof c.review_count === 'number' && (
                  <span className="text-gray-600">· {c.review_count} reviews</span>
                )}
                {c.price_level && <span className="text-gray-600">· {c.price_level}</span>}
                {c.address && <span className="text-gray-600">· {c.address}</span>}
              </div>
              {/* menu teaser (one-line preview) */}
              {(() => {
                const id = c.id ?? undefined
                const m = id ? menusMap?.[id] : undefined
                if (!m) return null
                const first =
                  Array.isArray(m.top_items) && m.top_items.length
                    ? m.top_items[0]?.name ?? null
                    : null
                return (
                  <div className="text-xs text-gray-600 mt-0.5">
                    {first ? <>Top item: {first}</> : <>Menu available</>}
                    {m.avg_price != null && <> · Avg ticket ${Number(m.avg_price).toFixed(2)}</>}
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>
    </div>
  )
}
