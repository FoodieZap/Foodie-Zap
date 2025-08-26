'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

type Note = {
  id: string
  content: string
  created_at: string
}

export default function NotesCard({
  competitorId,
  initialNotes,
}: {
  competitorId: string
  initialNotes: Note[]
}) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [newNote, setNewNote] = useState('')

  async function addNote() {
    if (!newNote.trim()) return
    const res = await fetch('/api/watchlist/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ competitor_id: competitorId, content: newNote }),
    })
    if (res.ok) {
      const saved = await res.json()
      setNotes([...notes, saved])
      setNewNote('')
    }
  }

  async function deleteNote(id: string) {
    const ok = window.confirm('Delete this note?')
    if (!ok) return
    const res = await fetch(`/api/watchlist/notes?id=${id}`, { method: 'DELETE' })
    if (res.ok) setNotes(notes.filter((n) => n.id !== id))
  }

  return (
    <div className="rounded border bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-2 font-medium hover:bg-gray-50"
      >
        <span>Notes</span>
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
      </button>

      {open && (
        <div className="p-4 space-y-3 border-t">
          {notes.length === 0 && <div className="text-gray-500 text-sm">No notes yet.</div>}

          {notes.map((n) => (
            <div key={n.id} className="flex items-center justify-between border-b pb-1 mb-1">
              <div>
                <div className="text-sm">{n.content}</div>
                <div className="text-xs text-gray-500">
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => deleteNote(n.id)}
                className="text-red-500 text-xs hover:underline"
              >
                Delete
              </button>
            </div>
          ))}

          <div className="flex items-center gap-2">
            <input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note..."
              className="flex-1 border rounded px-2 py-1 text-sm"
            />
            <button
              onClick={addNote}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
