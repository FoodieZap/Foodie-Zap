// lib/menuTargets.ts
import { discoverMenuLinks } from './menuDiscovery'

type CompRow = {
  id: string
  website?: string | null
  data?: any | null
}

export type Provider =
  | 'yelp'
  | 'doordash'
  | 'ubereats'
  | 'grubhub'
  | 'toast'
  | 'square'
  | 'clover'
  | 'menu'
  | 'site'

export type MenuTarget = {
  id: string
  url: string
  provider: Provider
}

const providerScore: Record<Provider, number> = {
  doordash: 10,
  ubereats: 9,
  grubhub: 8,
  yelp: 7,
  toast: 6,
  square: 5,
  clover: 5,
  menu: 4,
  site: 1,
}

function explicitFromData(c: CompRow): MenuTarget | null {
  const d = c?.data || {}
  if (d?.yelp_url)
    return { id: c.id, url: String(d.yelp_url).replace(/\/+$/, '') + '/menu', provider: 'yelp' }
  if (d?.doordash_url) return { id: c.id, url: String(d.doordash_url), provider: 'doordash' }
  if (d?.ubereats_url) return { id: c.id, url: String(d.ubereats_url), provider: 'ubereats' }
  if (d?.grubhub_url) return { id: c.id, url: String(d.grubhub_url), provider: 'grubhub' }
  return null
}

export async function targetsForSearch(comps: CompRow[]): Promise<MenuTarget[]> {
  const out: MenuTarget[] = []
  for (const c of comps) {
    const t = explicitFromData(c)
    if (t) {
      out.push(t)
      continue
    }
    const site = (c.website || '').trim()
    if (!site) continue
    const discovered = await discoverMenuLinks(site)
    const best = discovered.sort(
      (a, b) => (providerScore[b.provider] ?? 0) - (providerScore[a.provider] ?? 0),
    )[0]
    out.push(
      best
        ? { id: c.id, url: best.url, provider: best.provider }
        : { id: c.id, url: site, provider: 'site' },
    )
  }
  return out
}

export async function targetForCompetitor(c: CompRow): Promise<MenuTarget | null> {
  const t = explicitFromData(c)
  if (t) return t
  const site = (c.website || '').trim()
  if (!site) return null
  const discovered = await discoverMenuLinks(site)
  const best = discovered.sort(
    (a, b) => (providerScore[b.provider] ?? 0) - (providerScore[a.provider] ?? 0),
  )[0]
  return best
    ? { id: c.id, url: best.url, provider: best.provider }
    : { id: c.id, url: site, provider: 'site' }
}
