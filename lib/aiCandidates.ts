// lib/aiCandidates.ts
import { aiWebSearchMenuUrls } from './openaiWeb'
import { discoverMenuLinks, type DiscoveredLink } from './menuDiscovery'

const MENU_HINT = /(menu|menus|food|drinks|beverage|bar|happy[-\s]?hour|pdf)/i
function rank(u: string, label?: string): number {
  let score = 0
  const s = (u + ' ' + (label ?? '')).toLowerCase()
  if (/(^|\/)(menu|menus)(\/|$)/.test(s)) score += 8
  if (/\/(food|drinks|bar)(\/|$)/.test(s)) score += 5
  if (/happy[\s-]?hour/.test(s)) score += 3
  if (/\.pdf(\?|$)/.test(s)) score += 6
  if (/\/locations?\//.test(s) && !/menu|pdf/.test(s)) score -= 6
  if (/\?cmpid=/.test(s)) score -= 3
  return score
}

export async function resolveMenuCandidatesAI(args: {
  name: string
  city?: string
  address?: string
  website?: string
}): Promise<DiscoveredLink[]> {
  const web = await aiWebSearchMenuUrls(args).catch(() => [])
  const out: DiscoveredLink[] = []

  for (const r of web) {
    if (!r?.url) continue
    // Soft skip obvious location indexes unless they contain menu/pdf
    if (/\/(locations?|store)\//i.test(r.url) && !/menu|pdf/i.test(r.url)) continue
    out.push({ url: r.url, label: r.title, score: MENU_HINT.test(r.url) ? 2 : 1 })
  }

  // If we have an official website hint, mine intra-site menu links too
  if (args.website) {
    try {
      const sameSite = await discoverMenuLinks(args.website)
      for (const c of sameSite) {
        if (!c?.url) continue
        if (/\/(locations?|store)\//i.test(c.url) && !/menu|pdf/i.test(c.url)) continue
        out.push({ url: c.url, label: c.label, score: c.score })
      }
    } catch {}
  }

  // dedupe by URL without hash/query
  const seen = new Set<string>()
  const deduped = out.filter((x) => {
    const key = x.url.replace(/[#?].*$/, '')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Prefer higher score, then host, then path (stable)
  deduped.sort((a, b) => {
    const as = a.score ?? 0
    const bs = b.score ?? 0
    if (bs !== as) return bs - as
    const au = new URL(a.url)
    const bu = new URL(b.url)
    if (au.hostname !== bu.hostname) return au.hostname.localeCompare(bu.hostname)
    return au.pathname.localeCompare(bu.pathname)
  })

  return deduped.slice(0, 20)
}
