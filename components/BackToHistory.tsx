'use client'

import { useEffect, useState } from 'react'

/**
 * Looks for a location hash like:
 *   #fromHistory=%3Fq=pizza&sort=oldest
 * and renders a "Back to history" link that preserves those params.
 */
export default function BackToHistory() {
  const [href, setHref] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = window.location.hash || ''
      // Expect format: #fromHistory=<urlEncodedQueryStringStartingWith? or plain key=val>
      const match = raw.match(/^#fromHistory=(.+)$/)
      if (!match) return

      const decoded = decodeURIComponent(match[1])
      // Ensure it starts with "?" for safety
      const qs = decoded.startsWith('?') ? decoded : `?${decoded}`

      setHref(`/history${qs}`)
    } catch {
      // ignore
    }
  }, [])

  if (!href) return null

  return (
    <a href={href} className="text-sm underline text-blue-600">
      ← Back to history
    </a>
  )
}
