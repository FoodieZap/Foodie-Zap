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

type Props = {
  items: Competitor[]
  /** list of competitor ids that are starred in DB (server-provided) */
  starredIds?: string[]
}

export default function ResultsTable({ items, starredIds = [] }: Props) {
  const [minRating, setMinRating] = useState<number | ''>('')
  const [sortBy, setSortBy] = useState<'score' | 'rating' | 'reviews'>('score')
  const [stars, setStars] = useState<Set<string>>(new Set(starredIds))
  const [busyId, setBusyId] = useState<string | null>(null)

  // 🔁 Keep local set in sync with server prop whenever it changes
  useEffect(() => {
    setStars(new Set(starredIds))
  }, [starredIds])

  const filtered = useMemo(() => {
    let list = items
    if (minRating !== '') {
      list = list.filter((x) => (x.rating ?? 0) >= Number(minRating))
    }
    const sorted = [...list].sort((a, b) => {
      if (sortBy === 'score') return (b._score ?? 0) - (a._score ?? 0)
      if (sortBy === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
      return (b.review_count ?? 0) - (a.review_count ?? 0)
    })
    return sorted
  }, [items, minRating, sortBy])

  async function toggleStar(id: string) {
    try {
      setBusyId(id)
      if (stars.has(id)) {
        // unstar
        const res = await fetch(`/api/watchlist?competitor_id=${id}`, { method: 'DELETE' })
        if (res.status === 401) {
          window.location.href = '/auth/login'
          return
        }
        if (!res.ok) throw new Error('Failed to unstar')
        const next = new Set(stars)
        next.delete(id)
        setStars(next)
      } else {
        // star
        const res = await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ competitor_id: id, note: null }),
        })
        if (res.status === 401) {
          window.location.href = '/auth/login'
          return
        }
        if (!res.ok) throw new Error('Failed to star')
        const next = new Set(stars)
        next.add(id)
        setStars(next)
      }
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
        </div>
      </div>

      <div className="divide-y">
        {filtered.length === 0 && (
          <div className="p-4 text-gray-500">No competitors matching your filters.</div>
        )}
        {filtered.map((c) => {
          const isStar = stars.has(c.id)
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
