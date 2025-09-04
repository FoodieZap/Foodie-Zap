// lib/menuDiscovery.ts
import { load as loadHTML } from 'cheerio'
import { fetch } from 'undici'

export type DiscoveredLink = { url: string; label?: string; score?: number }

const BAD_HOST_KEYWORDS =
  /(locations?|store|reservations?|book|hours?|contact|about|events?|gallery)/i
const MENU_HINT = /(menu|menus|order|eat|food|drinks?|beverage|cocktails?|wine|beer|bar|pdf)/i
const IMG_OK = /\.(?:jpe?g|png|webp)(?:$|\?)/i

function scoreUrl(u: URL, label: string) {
  const p = u.pathname.toLowerCase()
  let s = 0
  // Positive signals (menus)
  if (/\/menu(s)?\/?$/.test(p)) s += 8
  if (/\/(all-day|allday|main|dinner|lunch|brunch|drinks|beverage|bar|dessert|kids)\b/.test(p))
    s += 5
  if (MENU_HINT.test(p)) s += 3
  if (MENU_HINT.test(label)) s += 2
  if (/\.(pdf)$/.test(p)) s += 6
  if (IMG_OK.test(p)) s += 4

  // Negative: obvious location/index pages
  if (BAD_HOST_KEYWORDS.test(p) && !MENU_HINT.test(p)) s -= 6
  if (/\/(location|locations)\/[^/]+\/?$/.test(p)) s -= 8
  return s
}

export async function discoverMenuLinks(startUrl: string): Promise<DiscoveredLink[]> {
  const out: DiscoveredLink[] = []
  try {
    const res = await fetch(startUrl, { redirect: 'follow' })
    if (!res.ok) return [{ url: startUrl }]
    const html = await res.text()
    const $ = loadHTML(html)
    const base = new URL(startUrl)

    $('a[href], img[src]').each((_, el) => {
      const raw = $(el).attr('href') || $(el).attr('src') || ''
      if (!raw) return
      let abs: string
      try {
        abs = new URL(raw, base).toString()
      } catch {
        return
      }
      const u = new URL(abs)
      // stay on same site
      if (u.hostname !== base.hostname) return

      const label = ($(el).text() || $(el).attr('alt') || '').trim()
      const looksMenuish =
        MENU_HINT.test(u.pathname) || MENU_HINT.test(label) || IMG_OK.test(u.pathname)
      if (!looksMenuish) return

      const score = scoreUrl(u, label)
      out.push({ url: u.toString(), label, score })
    })

    // include homepage as fallback
    out.push({ url: startUrl, score: 0 })
  } catch {
    out.push({ url: startUrl, score: 0 })
  }

  // de-dupe + sort best first
  const seen = new Set<string>()
  const deduped = out.filter((l) => {
    const key = l.url.replace(/[#?].*$/, '')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  deduped.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  return deduped
}
