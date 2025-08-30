// lib/http.ts
import { fetch as undiciFetch } from 'undici'

const UAS = [
  // rotate a few common desktop UAs
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 12_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
]

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function fetchHtml(
  url: string,
  maxAttempts = 3,
): Promise<{ html: string; contentType: string }> {
  const origin = (() => {
    try {
      return new URL(url).origin
    } catch {
      return undefined
    }
  })()
  let lastErr: any
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ua = UAS[(attempt - 1) % UAS.length]
    try {
      const res = await undiciFetch(url, {
        redirect: 'follow',
        headers: {
          'user-agent': ua,
          accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
          'cache-control': 'no-cache',
          pragma: 'no-cache',
          ...(origin ? { referer: origin } : {}),
        },
      })
      const contentType = res.headers.get('content-type') || ''
      if (!res.ok) throw new Error(`fetch failed (${res.status})`)
      const html = await res.text()
      return { html, contentType }
    } catch (e) {
      lastErr = e
      // jittered backoff to dodge rate limits
      await sleep(250 * attempt + Math.floor(Math.random() * 200))
    }
  }
  throw lastErr
}
