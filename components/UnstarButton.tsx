'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function UnstarButton({ competitorId }: { competitorId: string }) {
  const router = useRouter()
  const [busy, start] = useTransition()

  return (
    <button
      type="button"
      disabled={busy}
      className="px-2 py-1 rounded border hover:bg-gray-100 disabled:opacity-50"
      onClick={() =>
        start(async () => {
          const res = await fetch(
            `/api/watchlist?competitor_id=${encodeURIComponent(competitorId)}`,
            {
              method: 'DELETE',
            },
          )
          if (res.ok) router.refresh()
          else console.error('Failed to unstar', await res.text())
        })
      }
    >
      {busy ? 'Unstarring…' : 'Unstar'}
    </button>
  )
}
