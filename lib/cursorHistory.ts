// lib/cursorHistory.ts
// Cursor for history pages: { ts: ISO string, id: string }

function toBase64Url(s: string) {
  return Buffer.from(s, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function fromBase64Url(s: string) {
  const pad = s.length % 4 === 2 ? '==' : s.length % 4 === 3 ? '=' : ''
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  return Buffer.from(b64, 'base64').toString('utf8')
}

export type HistoryCursor = { ts: string; id: string } // ts = created_at ISO

export function encodeHistoryCursor(c: HistoryCursor): string {
  return toBase64Url(JSON.stringify(c))
}

export function decodeHistoryCursor(raw: string | null | undefined): HistoryCursor | null {
  if (!raw) return null
  try {
    const o = JSON.parse(fromBase64Url(raw))
    if (typeof o?.ts === 'string' && typeof o?.id === 'string') return o
  } catch {}
  return null
}
