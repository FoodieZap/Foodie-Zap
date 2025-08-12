'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewSearchPage() {
  const [query, setQuery] = useState('')
  const [city, setCity] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, city }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      router.push(`/s/${json.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-10">
      <h1 className="text-2xl font-semibold">New Search</h1>
      <p className="text-sm text-gray-600 mt-1">Enter a service/keyword and a city.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <input
          className="w-full rounded-xl border border-gray-300 px-3 py-2"
          placeholder='e.g. "pizza", "coffee"'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          required
        />
        <input
          className="w-full rounded-xl border border-gray-300 px-3 py-2"
          placeholder="City (e.g., miami)"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={loading}
          className="rounded-xl bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 disabled:opacity-60"
        >
          {loading ? 'Creating…' : 'Run search'}
        </button>
      </form>
    </main>
  )
}
