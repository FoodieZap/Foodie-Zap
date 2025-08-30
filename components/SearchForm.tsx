'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = { defaultCity?: string }

export default function SearchForm({ defaultCity = '' }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [city, setCity] = useState(defaultCity)
  const [minRating, setMinRating] = useState<number | ''>('')
  const [maxDistanceMeters, setMaxDistanceMeters] = useState<number | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)

    try {
      const payload: {
        query: string
        city: string
        minRating?: number
        maxDistanceMeters?: number
      } = { query: query.trim(), city: city.trim() }

      if (minRating !== '') payload.minRating = Math.max(0, Math.min(5, Number(minRating)))
      if (maxDistanceMeters !== '')
        payload.maxDistanceMeters = Math.max(0, Number(maxDistanceMeters))

      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({} as any))

      if (!res.ok) {
        setError(typeof body?.error === 'string' ? body.error : 'Search failed.')
        return
      }

      const searchId: string | undefined = body?.searchId ?? body?.id
      if (!searchId) {
        setError('Search created but no id returned.')
        return
      }
      router.push(`/results/${encodeURIComponent(searchId)}`)
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unexpected error.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded border bg-white p-4 space-y-3">
      <div className="font-medium">New Search</div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <div className="text-sm text-gray-700 mb-1">Service / Keyword</div>
          <input
            name="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='e.g. "coffee", "pizza", "sushi"'
            className="w-full rounded border px-3 py-2"
            required
          />
        </label>

        <label className="block">
          <div className="text-sm text-gray-700 mb-1">City</div>
          <input
            name="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder='e.g. "Austin, TX"'
            className="w-full rounded border px-3 py-2"
            required
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <div className="text-sm text-gray-700 mb-1">Min Rating (0–5, optional)</div>
          <input
            type="number"
            step="0.1"
            min={0}
            max={5}
            name="minRating"
            value={minRating === '' ? '' : String(minRating)}
            onChange={(e) => setMinRating(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full rounded border px-3 py-2"
          />
        </label>

        <label className="block">
          <div className="text-sm text-gray-700 mb-1">Max Distance (meters, optional)</div>
          <input
            type="number"
            step="50"
            min={1}
            name="maxDistanceMeters"
            value={maxDistanceMeters === '' ? '' : String(maxDistanceMeters)}
            onChange={(e) =>
              setMaxDistanceMeters(e.target.value === '' ? '' : Number(e.target.value))
            }
            className="w-full rounded border px-3 py-2"
          />
        </label>
      </div>

      {error && <div className="text-sm text-rose-700 bg-rose-50 rounded p-2">{error}</div>}

      <button
        type="submit"
        disabled={loading}
        className="rounded bg-gray-900 text-white px-4 py-2 disabled:opacity-60"
      >
        {loading ? 'Searching…' : 'Run Search'}
      </button>
    </form>
  )
}
