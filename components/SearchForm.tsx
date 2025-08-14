'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  defaultCity?: string
}

export default function SearchForm({ defaultCity = '' }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [city, setCity] = useState(defaultCity)
  const [minRating, setMinRating] = useState<number | ''>('' as any)
  const [maxDistanceMeters, setMaxDistanceMeters] = useState<number | ''>('' as any)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!query.trim() || !city.trim()) {
      setError('Please enter both a service/keyword and a city.')
      return
    }

    setLoading(true)
    try {
      const payload: any = { query: query.trim(), city: city.trim() }
      if (minRating !== '' && !Number.isNaN(minRating)) payload.minRating = Number(minRating)
      if (maxDistanceMeters !== '' && !Number.isNaN(maxDistanceMeters))
        payload.maxDistanceMeters = Number(maxDistanceMeters)

      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'Search failed')
      }

      // redirect to results page
      if (data?.id) {
        router.push(`/results/${data.id}`)
      } else {
        setError('Search created but no id returned.')
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='e.g. "coffee", "pizza", "sushi"'
            className="w-full rounded border px-3 py-2"
          />
        </label>

        <label className="block">
          <div className="text-sm text-gray-700 mb-1">City</div>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder='e.g. "Austin, TX"'
            className="w-full rounded border px-3 py-2"
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
            value={minRating as any}
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
            value={maxDistanceMeters as any}
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
