'use client'

import { useMemo, useState, useEffect } from 'react'

type Competitor = {
  id: string
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
  items: Competitor[]
  centerLat?: number | null
  centerLng?: number | null
  initialWatchlistIds?: string[]
}

type Props = {
  items: Competitor[]
  /** list of competitor ids that are starred in DB (server-provided) */
  starredIds?: string[]
}

export default function ResultsTable({
  items,
  centerLat = null,
  centerLng = null,
  initialWatchlistIds = [],
}: ResultsTableProps) {
  const [minRating, setMinRating] = useState<number | ''>('')
  const [sortBy, setSortBy] = useState<'score' | 'rating' | 'reviews'>('score')
  const [stars, setStars] = useState<Set<string>>(new Set())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [maxDistanceKm, setMaxDistanceKm] = useState<string>('')
  const [price, setPrice] = useState<string>('')
  const [localWatchlist, setLocalWatchlist] = useState<Set<string>>(
    () => new Set(initialWatchlistIds),
  )

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

  // 🔁 Keep local set in sync with server prop whenever it changes
  // useEffect(() => {
  //   setStars(new Set(starredIds))
  // }, [starredIds])

  const filtered = useMemo(() => {
    let list = [...(items ?? [])]

    // rating
    if (minRating !== '') {
      list = list.filter((x) => (x.rating ?? 0) >= Number(minRating))
    }

    // price
    if (price) {
      list = list.filter((x) => (x.price_level ?? '') === price)
    }

    // distance
    const maxD = Number(maxDistanceKm)
    if (!Number.isNaN(maxD) && maxD > 0 && centerLat != null && centerLng != null) {
      list = list.filter((x) => distKm(centerLat, centerLng, x.lat ?? null, x.lng ?? null) <= maxD)
    }

    // sort
    const sorted = [...list].sort((a, b) => {
      if (sortBy === 'score') return (b._score ?? 0) - (a._score ?? 0)
      if (sortBy === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
      if (sortBy === 'reviews') return (b.review_count ?? 0) - (a.review_count ?? 0)
      return 0
    })

    return sorted
  }, [items, minRating, price, maxDistanceKm, sortBy, centerLat, centerLng])

  async function addToWatchlist(id: string) {
    // optimistic
    setLocalWatchlist((prev) => new Set([...prev, id]))
    const res = await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ competitor_id: id }),
    })
    if (!res.ok) {
      // rollback
      setLocalWatchlist((prev) => {
        const copy = new Set(prev)
        copy.delete(id)
        return copy
      })
    }
  }

  async function removeFromWatchlist(id: string) {
    // optimistic
    setLocalWatchlist((prev) => {
      const copy = new Set(prev)
      copy.delete(id)
      return copy
    })
    const res = await fetch(`/api/watchlist?competitor_id=${id}`, { method: 'DELETE' })
    if (!res.ok) {
      // rollback
      setLocalWatchlist((prev) => new Set([...prev, id]))
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
          const isStar = stars.has(c.id)
          function toggleStar(id: string): void {
            throw new Error('Function not implemented.')
          }

          return (
            <div key={c.id} className="p-4">
              <div className="font-medium flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleStar(c.id)}
                  disabled={busyId === c.id}
                  title={isStar ? 'Unstar' : 'Star'}
                  className={`text-lg ${isStar ? 'text-yellow-500' : 'text-gray-400'}`}
                >
                  {isStar ? '★' : '☆'}
                </button>
                <span>
                  {c.name ?? 'Unknown'}{' '}
                  <span className="text-xs text-gray-500">({c.source ?? '—'})</span>
                </span>
                {c.id && (
                  <a href={`/competitors/${c.id}`} className="text-blue-600 text-sm underline">
                    View
                  </a>
                )}
              </div>
              <div className="text-sm text-gray-600">
                Rating: {c.rating ?? '—'} • Reviews: {c.review_count ?? '—'} • Price:{' '}
                {c.price_level ?? '—'}
                {typeof c._score === 'number' && <> • Score: {c._score.toFixed(3)}</>}
              </div>
              <div className="text-sm text-gray-600">{c.address ?? '—'}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
