// lib/menuTargets.ts
import { discoverMenuLinks } from './menuDiscovery'

type CompRow = {
  id: string
  name?: string | null
  website?: string | null
  external_urls?: any | null
  data?: any | null
}

// prefer marketplaces with structured menus, then toast/square/clover, then discovered links, then website
const ORDER = ['doordash', 'ubereats', 'grubhub', 'yelp', 'toast', 'square', 'clover']

function pickFromExternal(external?: any): string | null {
  if (!external) return null
  const toUrl = (v: any) => (typeof v === 'string' ? v : v?.url ? String(v.url) : null)
  for (const key of ORDER) {
    const v = external[key]
    if (!v) continue
    if (Array.isArray(v)) {
      const first = toUrl(v[0])
      if (first) return first
    } else {
      const u = toUrl(v)
      if (u) return u
    }
  }
  return null
}

export async function targetForCompetitor(comp: CompRow): Promise<string | null> {
  // 1) external_urls preferred
  const ext = pickFromExternal(comp.external_urls)
  if (ext) return ext

  // 2) data.links fallback (legacy shape)
  const links = (comp?.data?.links ?? []) as Array<string | { url: string }>
  if (Array.isArray(links) && links.length) {
    const first = links[0]
    if (typeof first === 'string') return first
    if (first && typeof first === 'object' && 'url' in first && (first as any).url)
      return String((first as any).url)
  }

  // 3) try to discover a menu URL from the website
  if (comp.website) {
    const list = await discoverMenuLinks(comp.website)
    if (list.length) return list[0].url
    return comp.website
  }

  return null
}
