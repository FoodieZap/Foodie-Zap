'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Note = { id: string; body: string; created_at: string }

export default function NotesList({ competitorId }: { competitorId: string }) {
  const router = useRouter()
  const [items, setItems] = useState<Note[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, start] = useTransition()

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/watchlist/notes?competitor_id=${encodeURIComponent(competitorId)}`,
      )
      const j = await res.json()
      setItems(Array.isArray(j.items) ? j.items : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [competitorId])

  function add() {
    if (!text.trim()) return
    start(async () => {
      const res = await fetch('/api/watchlist/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitor_id: competitorId, body: text.trim() }),
      })
      if (res.ok) {
        setText('')
        load()
        router.refresh()
      } else {
        console.error('Failed to add note', await res.text())
      }
    })
  }

  function remove(id: string) {
    start(async () => {
      const res = await fetch(`/api/watchlist/notes?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setItems((xs) => xs.filter((n) => n.id !== id))
        router.refresh()
      } else {
        console.error('Failed to delete note', await res.text())
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a note…"
          className="flex-1 px-2 py-1 border rounded text-sm"
        />
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="px-2 py-1 text-sm rounded border hover:bg-gray-100 disabled:opacity-50"
        >
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>
      <div className="space-y-2">
        {loading ? (
          <div className="text-xs text-gray-500">Loading notes…</div>
        ) : items.length === 0 ? (
          <div className="text-xs text-gray-500">No notes yet.</div>
        ) : (
          items.map((n) => (
            <div key={n.id} className="rounded border px-2 py-1">
              <div className="text-sm whitespace-pre-wrap">{n.body}</div>
              <div className="text-[11px] text-gray-500 flex items-center justify-between mt-1">
                <span>{new Date(n.created_at).toLocaleString()}</span>
                <button
                  type="button"
                  onClick={() => remove(n.id)}
                  disabled={busy}
                  className="underline hover:no-underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
