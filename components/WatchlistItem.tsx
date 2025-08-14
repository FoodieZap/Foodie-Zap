'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Competitor = {
  id: string
  search_id: string
  name: string | null
  source: string | null
  rating: number | null
  review_count: number | null
  price_level: string | null
  address: string | null
  phone: string | null
  website: string | null
}

export default function WatchlistItem({
  id,
  competitor,
  note: initialNote,
}: {
  id: string
  competitor: Competitor
  note: string
}) {
  const router = useRouter()
  const [note, setNote] = useState(initialNote)
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function saveNote() {
    await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ competitor_id: competitor.id, note }),
    })
    // Refresh server data, exit edit mode
    startTransition(() => {
      setEditing(false)
      router.refresh()
    })
  }

  async function deleteNote() {
    // Keep the star, just clear the note (note: null)
    await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ competitor_id: competitor.id, note: null }),
    })
    startTransition(() => {
      setNote('')
      setEditing(false)
      router.refresh()
    })
  }

  async function unstar() {
    await fetch(`/api/watchlist?competitor_id=${competitor.id}`, { method: 'DELETE' })
    startTransition(() => router.refresh())
  }

  return (
    <div className="rounded border bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">
            {competitor.name ?? 'Unknown'}{' '}
            <span className="text-xs text-gray-500">({competitor.source ?? '—'})</span>
          </div>
          <div className="text-sm text-gray-600">
            Rating: {competitor.rating ?? '—'} • Reviews: {competitor.review_count ?? '—'} • Price:{' '}
            {competitor.price_level ?? '—'}
          </div>
          <div className="text-sm text-gray-600">{competitor.address ?? '—'}</div>
        </div>
        <div className="flex items-center gap-3">
          <a className="text-blue-600 underline" href={`/results/${competitor.search_id}`}>
            View in results
          </a>
          <button
            onClick={unstar}
            disabled={isPending}
            className="rounded border px-3 py-1.5 text-sm hover:bg-gray-100"
            title="Remove from watchlist"
          >
            Unstar
          </button>
        </div>
      </div>

      {/* Note section */}
      <div className="mt-4">
        <div className="text-sm font-medium text-gray-800 mb-1">Note</div>

        {!editing ? (
          note ? (
            // Read view: pretty note box + Edit/Delete Note
            <div className="rounded border border-gray-200 bg-gray-50 p-3">
              <div className="whitespace-pre-wrap text-sm text-gray-800">{note}</div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => setEditing(true)}
                  className="rounded bg-gray-900 text-white px-3 py-1.5 text-sm"
                >
                  Edit note
                </button>
                <button
                  onClick={deleteNote}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-gray-100"
                >
                  Delete note
                </button>
              </div>
            </div>
          ) : (
            // No note yet
            <div className="rounded border border-dashed bg-white p-3 text-sm text-gray-500">
              No note yet.
              <button onClick={() => setEditing(true)} className="ml-2 underline text-blue-600">
                Add a note
              </button>
            </div>
          )
        ) : (
          // Edit mode
          <div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              className="w-full rounded border px-3 py-2"
              placeholder="Why did you save this place? pricing, vibe, menu ideas..."
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={saveNote}
                disabled={isPending}
                className="rounded bg-gray-900 text-white px-3 py-1.5 text-sm disabled:opacity-60"
              >
                Save note
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded border px-3 py-1.5 text-sm hover:bg-gray-100"
              >
                Cancel
              </button>
              {note && (
                <button
                  onClick={deleteNote}
                  disabled={isPending}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-gray-100"
                >
                  Delete note
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
