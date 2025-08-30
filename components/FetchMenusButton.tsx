'use client'

import { useEffect, useRef, useState } from 'react'

export default function FetchMenusButton({ searchId }: { searchId: string }) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const inFlight = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      inFlight.current?.abort()
    }
  }, [])

  async function run() {
    if (!searchId) {
      setMsg('Missing searchId')
      return
    }
    if (loading) return

    setLoading(true)
    setMsg(null)

    const ctrl = new AbortController()
    inFlight.current = ctrl
    const t = setTimeout(() => ctrl.abort('Timeout'), 60000) // 60s guard

    try {
      const res = await fetch(`/api/menus/fetch?searchId=${encodeURIComponent(searchId)}`, {
        method: 'POST',
        signal: ctrl.signal,
        // no body → our API reads searchId from the query
      })

      const body = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error(body?.error || 'Fetch failed')

      const updated = body?.updated ?? 0
      const errs = Array.isArray(body?.errors) ? body.errors.length : 0
      setMsg(`Menus updated: ${updated}${errs ? ` • Errors: ${errs}` : ''}`)

      // light refresh so ResultsView picks up new menus
      setTimeout(() => window.location.reload(), 500)
    } catch (e: any) {
      setMsg(e?.message === 'Timeout' ? 'Timed out. Try again.' : e?.message || 'Error')
    } finally {
      clearTimeout(t)
      setLoading(false)
      inFlight.current = null
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={loading || !searchId}
        className="rounded border px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-60"
      >
        {loading ? 'Fetching menus…' : 'Fetch menus'}
      </button>
      {msg && <span className="text-xs text-gray-600">{msg}</span>}
    </div>
  )
}
