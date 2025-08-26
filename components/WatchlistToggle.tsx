'use client'

import { useState, useTransition } from 'react'

export default function WatchlistToggle({
  competitorId,
  initialStarred,
}: {
  competitorId: string
  initialStarred: boolean
}) {
  const [isStarred, setIsStarred] = useState(initialStarred)
  const [busy, startTransition] = useTransition()

  async function toggle() {
    if (busy) return

    if (isStarred) {
      const ok = window.confirm(
        'Are you sure you want to remove this from your watchlist? All notes for this location will be deleted.',
      )
      if (!ok) return
    }

    startTransition(async () => {
      try {
        if (isStarred) {
          const res = await fetch(`/api/watchlist?competitor_id=${competitorId}`, {
            method: 'DELETE',
          })
          if (!res.ok) throw new Error(await res.text())
          setIsStarred(false)
        } else {
          const res = await fetch('/api/watchlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ competitor_id: competitorId }),
          })
          if (!res.ok) throw new Error(await res.text())
          setIsStarred(true)
        }
      } catch (err) {
        console.error('Watchlist toggle failed', err)
        alert('Something went wrong, please try again.')
      }
    })
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={toggle}
      title={isStarred ? 'Remove from watchlist' : 'Add to watchlist'}
      className={`text-2xl ${
        isStarred ? 'text-amber-500' : 'text-gray-400 hover:text-gray-600'
      } disabled:opacity-50`}
    >
      {isStarred ? '★' : '☆'}
    </button>
  )
}
