'use client'
import { useState, useEffect } from 'react'

export default function FetchMenuForCompetitorButton({ competitorId }: { competitorId: string }) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function enqueue() {
    setLoading(true)
    setMsg(null)
    try {
      const res = await fetch('/api/menus/enqueue-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitorId }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Failed to queue')
      setMsg('Fetching…')
      // start polling for result
      poll()
    } catch (e: any) {
      setMsg(e?.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  async function poll() {
    const res = await fetch(`/api/menus/status?competitorId=${competitorId}`)
    const j = await res.json()
    if (j?.menu) {
      setMsg('Menu updated')
      // quick reload so MenuSection re-renders with data
      setTimeout(() => window.location.reload(), 500)
      return
    }
    // keep polling until a terminal state
    const st = j?.job?.status
    if (st === 'failed') {
      setMsg(j?.job?.error || 'Failed')
      return
    }
    setTimeout(poll, 2000)
  }

  return (
    <button
      type="button"
      onClick={enqueue}
      disabled={loading || !competitorId}
      className="rounded border px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-60"
    >
      {loading ? 'Fetching…' : 'Fetch menu'}
    </button>
  )
}
