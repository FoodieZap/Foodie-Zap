'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function GeneratePlaceholders({ searchId }: { searchId: string }) {
  const router = useRouter()
  const [busyMenus, startMenus] = useTransition()
  const [busyInsights, startInsights] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  // Reusable POST helper with JSON/error handling
  async function post(url: string) {
    setMsg(null)
    const res = await fetch(url, { method: 'POST' })
    if (!res.ok) {
      // Try to parse JSON error, fallback to text/status
      const text = await res.text().catch(() => '')
      let err = text
      try {
        const j = JSON.parse(text || '{}')
        err = j?.error || text
      } catch {}
      throw new Error(err || `Request failed (${res.status})`)
    }
    try {
      return await res.json()
    } catch {
      return {}
    }
  }

  function generateMenus() {
    startMenus(async () => {
      try {
        await post(`/api/menus/placeholder?searchId=${searchId}`)
        setMsg('Menus generated.')
        router.refresh() // re-fetch server data on this page
      } catch (e: any) {
        setMsg(e?.message || 'Failed to generate menus.')
        console.error(e)
      }
    })
  }

  function generateInsights() {
    startInsights(async () => {
      try {
        await post(`/api/insights?searchId=${searchId}`)
        setMsg('Insights generated.')
        router.refresh() // picks up insights row immediately
      } catch (e: any) {
        setMsg(e?.message || 'Failed to generate insights.')
        console.error(e)
      }
    })
  }

  const disabled = busyMenus || busyInsights

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={generateMenus}
        disabled={disabled}
        className="rounded border px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-60"
      >
        {busyMenus ? 'Generating…' : 'Generate Menus (placeholder)'}
      </button>

      <button
        onClick={generateInsights}
        disabled={disabled}
        className="px-3 py-1.5 rounded border text-sm hover:bg-gray-100 disabled:opacity-60"
      >
        {busyInsights ? 'Generating…' : 'Generate Insights'}
      </button>

      {msg && <span className="text-sm text-gray-600 ml-2">{msg}</span>}
    </div>
  )
}
