'use client'
import { useState } from 'react'

export default function SearchTester() {
  const [query, setQuery] = useState('coffee')
  const [city, setCity] = useState('Washington, DC')
  const [minRating, setMinRating] = useState<number | ''>('')
  const [maxDist, setMaxDist] = useState<number | ''>('')
  const [resp, setResp] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [latest, setLatest] = useState<any>(null)
  const [comps, setComps] = useState<any[]>([])

  const runPost = async () => {
    setLoading(true)
    setResp(null)
    try {
      const body: any = { query, city }
      if (minRating !== '') body.minRating = Number(minRating)
      if (maxDist !== '') body.maxDistanceMeters = Number(maxDist)

      const r = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await r.json()
      setResp(json)
    } finally {
      setLoading(false)
    }
  }

  const fetchRecent = async () => {
    const r = await fetch('/api/search')
    const j = await r.json()
    setLatest(j?.searches?.[0] ?? null)
  }

  const fetchCompetitors = async () => {
    if (!latest?.id) return
    const r = await fetch(`/api/competitors?search_id=${latest.id}`)
    const j = await r.json()
    setComps(j?.competitors ?? [])
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Search Tester</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          className="border rounded-xl p-3"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="query"
        />
        <input
          className="border rounded-xl p-3"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="city"
        />
        <input
          className="border rounded-xl p-3"
          type="number"
          min={0}
          max={5}
          step={0.1}
          value={minRating}
          onChange={(e) => setMinRating(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="minRating (optional)"
        />
        <input
          className="border rounded-xl p-3"
          type="number"
          min={100}
          step={100}
          value={maxDist}
          onChange={(e) => setMaxDist(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="maxDistanceMeters (optional)"
        />
      </div>

      <div className="flex gap-3">
        <button onClick={runPost} className="border rounded-xl px-4 py-2 shadow">
          {loading ? 'Posting…' : 'POST /api/search'}
        </button>
        <button onClick={fetchRecent} className="border rounded-xl px-4 py-2 shadow">
          GET recent /api/search
        </button>
        <button
          onClick={fetchCompetitors}
          className="border rounded-xl px-4 py-2 shadow"
          disabled={!latest?.id}
        >
          GET competitors for latest
        </button>
      </div>

      {resp && (
        <pre className="bg-black/5 p-3 rounded-xl overflow-x-auto text-sm">
          {JSON.stringify(resp, null, 2)}
        </pre>
      )}

      {latest && (
        <div className="space-y-2">
          <div className="font-medium">Latest search</div>
          <pre className="bg-black/5 p-3 rounded-xl overflow-x-auto text-sm">
            {JSON.stringify(latest, null, 2)}
          </pre>
        </div>
      )}

      {!!comps.length && (
        <div>
          <div className="font-medium mb-2">Competitors (top 10)</div>
          <ul className="space-y-2">
            {comps.slice(0, 10).map((c: any) => (
              <li key={`${c.source}-${c.place_id ?? c.id}`} className="border rounded-xl p-3">
                <div className="font-medium">{c.name}</div>
                <div className="text-sm opacity-80">{c.address}</div>
                <div className="text-xs mt-1">
                  src: {c.source} • rating: {c.rating ?? '—'}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
