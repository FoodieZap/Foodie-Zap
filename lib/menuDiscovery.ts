// lib/menuDiscovery.ts
import { load as loadHTML } from 'cheerio'
import { fetchHtml } from './http'

const CANDIDATE_KEYWORDS = [
  'menu',
  'our-menu',
  'food',
  'drinks',
  'beverages',
  'order',
  'order-online',
  'order-now',
  'eat',
  'dine',
  'breakfast',
  'lunch',
  'dinner',
]

const BAD_EXT = /\.(jpg|jpeg|png|gif|svg|webp|css|js|ico|woff2?|ttf|eot)(\?.*)?$/i

function isCandidateAnchorText(t: string) {
  const s = t.toLowerCase()
  if (s.length < 3) return false
  return CANDIDATE_KEYWORDS.some((k) => s.includes(k))
}

function scoreHref(href: string) {
  const h = href.toLowerCase()
  if (BAD_EXT.test(h)) return -10
  let score = 0
  for (const k of CANDIDATE_KEYWORDS) if (h.includes(k)) score += 2
  if (h.includes('/menu')) score += 4
  if (h.includes('/order')) score += 3
  if (h.endsWith('.pdf')) score += 5
  return score
}

export async function discoverMenuUrl(seedUrl: string): Promise<string | null> {
  try {
    const base = new URL(seedUrl)
    const { html } = await fetchHtml(seedUrl)
    const $ = loadHTML(html)

    // JSON-LD: look for Restaurant w/ hasMenu/menu
    let best: string | null = null
    let bestScore = -1

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const obj = JSON.parse($(el).text() || '{}')
        const arr = Array.isArray(obj) ? obj : [obj]
        for (const node of arr) {
          const maybe = node?.hasMenu || node?.menu
          const candidates = Array.isArray(maybe) ? maybe : maybe ? [maybe] : []
          for (const m of candidates) {
            const href = typeof m === 'string' ? m : m?.url
            if (!href) continue
            const abs = new URL(href, base).toString()
            const sc = scoreHref(abs) + 6 // JSON-LD bonus
            if (sc > bestScore) {
              bestScore = sc
              best = abs
            }
          }
        }
      } catch {}
    })

    // Anchors with menu-like text/href
    $('a[href]').each((_, a) => {
      const href = $(a).attr('href')!
      const text = $(a).text() || ''
      const abs = new URL(href, base).toString()
      let sc = scoreHref(abs)
      if (isCandidateAnchorText(text)) sc += 3
      if (sc > bestScore) {
        bestScore = sc
        best = abs
      }
    })

    return best
  } catch {
    return null
  }
}
