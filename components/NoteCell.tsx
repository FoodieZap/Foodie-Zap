'use client'

import { useState } from 'react'

export default function NoteCell({
  competitorId,
  initial,
}: {
  competitorId: string
  initial: string | null
}) {
  const [note, setNote] = useState(initial ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<'idle' | 'ok' | 'err'>('idle')

  async function save() {
    try {
      setSaving(true)
      setSaved('idle')
      const res = await fetch('/api/watchlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitor_id: competitorId, note }),
      })
      if (!res.ok) throw new Error(await res.text())
      setSaved('ok')
    } catch (e) {
      console.error(e)
      setSaved('err')
    } finally {
      setSaving(false)
    }
  }

  function revert() {
    setNote(initial ?? '')
    setSaved('idle')
  }

  return (
    <div className="flex flex-col gap-1">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="w-full px-2 py-1 border rounded text-sm"
        placeholder="Add a quick note…"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-2 py-1 text-sm rounded border hover:bg-gray-100 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={revert}
          disabled={saving}
          className="px-2 py-1 text-sm rounded border hover:bg-gray-100 disabled:opacity-50"
        >
          Revert
        </button>
        {saved === 'ok' && <span className="text-xs text-emerald-600">Saved ✓</span>}
        {saved === 'err' && <span className="text-xs text-red-600">Failed</span>}
      </div>
    </div>
  )
}
