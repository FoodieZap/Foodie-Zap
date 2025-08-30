'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function GeneratePlaceholders({ searchId }: { searchId: string }) {
  const router = useRouter()
  const [busyMenus, startMenus] = useTransition()
  const [busyInsights, startInsights] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  async function post(url: string) {
    const res = await fetch(url, { method: 'POST' })
    // Try to parse JSON (best-effort)
    let body: any = null
    try {
      body = await res.json()
    } catch {}
    if (!res.ok) {
      const reason = body?.error || `Request failed (${res.status})`
      throw new Error(reason)
    }
    return body
  }

  function generateMenus() {
    setMsg(null)
    startMenus(async () => {
      try {
        await post(`/api/menus/placeholder?searchId=${encodeURIComponent(searchId)}`)
        setMsg('✅ Menus generated.')
        router.refresh()
      } catch (e: any) {
        setMsg(`❌ Menus failed: ${e?.message || 'Unknown error'}`)
      }
    })
  }

  function generateInsights() {
    setMsg(null)
    startInsights(async () => {
      try {
        await post(`/api/insights?searchId=${encodeURIComponent(searchId)}`)
        setMsg('✅ Insights generated.')
        router.refresh()
      } catch (e: any) {
        setMsg(`❌ Insights failed: ${e?.message || 'Unknown error'}`)
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
        {busyMenus ? 'Generating…' : 'Generate Menus'}
      </button>

      <button
        onClick={generateInsights}
        disabled={busyInsights}
        className="px-3 py-1.5 rounded border text-sm hover:bg-gray-100 disabled:opacity-60"
      >
        {busyInsights ? 'Generating…' : 'Generate Insights'}
      </button>

      {msg && <span className="text-sm ml-2">{msg}</span>}
    </div>
  )
}
