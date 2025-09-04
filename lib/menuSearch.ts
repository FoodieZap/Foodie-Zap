// lib/menuSearch.ts
import { webSearchMenuQueries } from './webSearch'

export type Candidate = { url: string; label?: string; score?: number }

const BLOCK = /(doordash|ubereats|grubhub|postmates|seamless|chownow)\.com/i

const COMMON_MENU_PATHS = [
  '/menu',
  '/menus',
  '/our-menu',
  '/dining-menu',
  '/lunch-menu',
  '/dinner-menu',
  '/brunch-menu',
  '/bar-menu',
  '/drinks',
  '/beverages',
  '/wine',
  '/cocktails',
  '/happy-hour',
]

function dedupe(urls: Candidate[]) {
  const seen = new Set<string>()
  const out: Candidate[] = []
  for (const u of urls) {
    const key = u.url.replace(/[#?].*$/, '')
    if (BLOCK.test(key)) continue
    if (!/^https?:\/\//i.test(key)) continue
    if (!seen.has(key)) {
      seen.add(key)
      out.push(u)
    }
  }
  return out
}

function hostFrom(u?: string | null) {
  try {
    return u ? new URL(u).hostname.toLowerCase() : ''
  } catch {
    return ''
  }
}

export async function resolveMenuCandidates(input: {
  name: string
  city?: string
  address?: string
  website?: string
}): Promise<Candidate[]> {
  const { name, city, address, website } = input

  const host = hostFrom(website)
  const seeds: Candidate[] = []

  // 1) If we have a website, propose common menu paths on that host
  if (host) {
    const base = new URL(website!)
    for (const p of COMMON_MENU_PATHS) {
      try {
        seeds.push({ url: new URL(p, base).toString(), label: 'site-path', score: 9 })
      } catch {}
    }
    // homepage last
    seeds.push({ url: base.toString(), label: 'site-home', score: 3 })
  }

  // 2) Web search (Tavily/Serp) for “name city menu” etc
  const qCity = [name, city].filter(Boolean).join(' ')
  const hits = await webSearchMenuQueries(name, city, host || undefined).catch(() => [])
  for (const h of hits) {
    // prefer same host when present
    const s = host && hostFrom(h.url) === host ? 10 : 6
    seeds.push({ url: h.url, label: h.title ?? 'search', score: s })
  }

  // 3) Promote obvious menu/PDF pages
  const ranked = seeds
    .map((c) => {
      const u = c.url.toLowerCase()
      let bonus = 0
      if (/\/menu|\/menus|\/our-menu/.test(u)) bonus += 4
      if (/\/dinner|\/lunch|\/brunch|\/drinks|\/bar/.test(u)) bonus += 2
      if (/\.(pdf|jpg|jpeg|png|webp)(?:$|\?)/.test(u)) bonus += 2
      if (host && hostFrom(c.url) === host) bonus += 2
      return { ...c, score: (c.score ?? 0) + bonus }
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

  // 4) de-dupe and cap
  return dedupe(ranked).slice(0, 12)
}
