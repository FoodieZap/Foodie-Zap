// lib/webSearch.ts
import { fetch } from 'undici'

export type WebHit = { url: string; title?: string; source?: 'serpapi' | 'tavily' | 'google' }

const BLOCK = /(doordash|ubereats|grubhub|postmates|seamless|chownow)\.com/i

function dedupe(urls: WebHit[]) {
  const seen = new Set<string>()
  const out: WebHit[] = []
  for (const u of urls) {
    const key = u.url.replace(/[#?].*$/, '')
    if (BLOCK.test(key)) continue
    if (!seen.has(key)) {
      seen.add(key)
      out.push(u)
    }
  }
  return out
}

export async function webSearchMenuQueries(
  name: string,
  city?: string,
  websiteHost?: string,
): Promise<WebHit[]> {
  const qBase = [name, city].filter(Boolean).join(' ').trim()

  const queries: string[] = [`${qBase} menu`, `${qBase} menu pdf`, `${qBase} dinner menu`]
  if (websiteHost) {
    queries.unshift(`${qBase} site:${websiteHost} menu`)
  }

  const hits: WebHit[] = []

  const MAX_HITS = 12 // stop once we have enough de-duped candidates
  function shouldStop() {
    return dedupe(hits).length >= MAX_HITS
  }

  const haveSerp = !!process.env.SERPAPI_KEY
  const haveTavily = !!process.env.TAVILY_API_KEY
  const haveG = !!process.env.GOOGLE_CSE_KEY && !!process.env.GOOGLE_CSE_CX

  for (const q of queries) {
    // SerpAPI
    if (haveSerp) {
      try {
        const u = new URL('https://serpapi.com/search.json')
        u.searchParams.set('engine', 'google')
        u.searchParams.set('q', q)
        u.searchParams.set('api_key', process.env.SERPAPI_KEY!)
        u.searchParams.set('hl', 'en')
        u.searchParams.set('gl', 'us')
        const r = await fetch(u, { redirect: 'follow' })
        const j: any = r.ok ? await r.json() : null
        const arr: WebHit[] = (j?.organic_results ?? []).map((o: any) => ({
          url: o.link,
          title: o.title,
          source: 'serpapi',
        }))
        hits.push(...arr)
        if (shouldStop()) break
      } catch {}
    }

    if (shouldStop()) break

    // Tavily
    if (haveTavily) {
      try {
        const r = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
          },
          body: JSON.stringify({
            query: q,
            include_answer: false,
            max_results: 5,
            num_results: 5,
            topic: 'general',
            search_depth: 'basic',
          }),
        })
        const j: any = r.ok ? await r.json() : null
        const arr: WebHit[] = (j?.results ?? []).map((o: any) => ({
          url: o.url,
          title: o.title,
          source: 'tavily',
        }))
        hits.push(...arr)
        if (shouldStop()) break
      } catch {}
    }

    if (shouldStop()) break

    // Google CSE (optional)
    if (haveG) {
      try {
        const u = new URL('https://www.googleapis.com/customsearch/v1')
        u.searchParams.set('key', process.env.GOOGLE_CSE_KEY!)
        u.searchParams.set('cx', process.env.GOOGLE_CSE_CX!)
        u.searchParams.set('q', q)
        const r = await fetch(u, { redirect: 'follow' })
        const j: any = r.ok ? await r.json() : null
        const arr: WebHit[] = (j?.items ?? []).map((o: any) => ({
          url: o.link,
          title: o.title,
          source: 'google',
        }))
        hits.push(...arr)
        if (shouldStop()) break
      } catch {}
    }

    if (shouldStop()) break
  }

  // de-dupe + keep only http(s) and not marketplaces
  return dedupe(hits.filter((h) => /^https?:\/\//i.test(h.url)))
}
