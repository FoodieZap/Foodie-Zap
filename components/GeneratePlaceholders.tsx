'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function GeneratePlaceholders({ searchId }: { searchId: string }) {
  const router = useRouter()
  const [busyMenus, startMenus] = useTransition()
  const [busyInsights, startInsights] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  async function post(url: string) {
    setMsg(null)
    const res = await fetch(url, { method: 'POST' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j?.error || `Request failed (${res.status})`)
    }
    return res.json().catch(() => ({}))
  }

  function generateMenus() {
    startMenus(async () => {
      try {
        await post(`/api/menus/placeholder?searchId=${searchId}`)
        setMsg('Menus generated.')
        router.refresh() // re-fetch server data on this page
      } catch (e: any) {
        setMsg(e.message || 'Failed to generate menus.')
      }
    })
  }

  function generateInsights() {
    startInsights(async () => {
      try {
        await post(`/api/insights/placeholder?searchId=${searchId}`)
        setMsg('Insights generated.')
        router.refresh()
      } catch (e: any) {
        setMsg(e.message || 'Failed to generate insights.')
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={generateMenus}
        disabled={busyMenus}
        className="rounded border px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-60"
      >
        {busyMenus ? 'Generating…' : 'Generate Menus (placeholder)'}
      </button>

      <button
        onClick={generateInsights}
        disabled={busyInsights}
        className="rounded border px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-60"
      >
        {busyInsights ? 'Generating…' : 'Generate Insights (placeholder)'}
      </button>

      {msg && <span className="text-sm text-gray-600 ml-2">{msg}</span>}
    </div>
  )
}
