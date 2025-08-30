// lib/menuQuality.ts

export type RawItem = { name?: string; price?: number | null }
export type ScrapeResult = {
  competitorId: string
  url: string
  provider: 'yelp' | 'doordash' | 'ubereats' | 'grubhub' | 'site'
  avg_price: number | null
  top_items: RawItem[] | null
  ok?: boolean
  error?: string | null
}

function isSanePrice(p: any) {
  const n = Number(p)
  return Number.isFinite(n) && n >= 1 && n <= 200 // tweak if needed
}

function cleanName(s: any): string {
  const name = String(s ?? '').trim()
  if (!name) return ''
  // filter obvious junk / code fragments
  if (/[{}<>]/.test(name) || /function|\bvar\s|=>/.test(name)) return ''
  // overly long / short
  if (name.length < 2 || name.length > 80) return ''
  return name
}

export function scoreScrape(r: ScrapeResult): number {
  if (!r || r.error) return 0
  const items = Array.isArray(r.top_items) ? r.top_items : []
  const cleaned = items
    .map((i) => ({
      name: cleanName(i?.name),
      price: isSanePrice(i?.price) ? Number(i?.price) : null,
    }))
    .filter((i) => i.name) // drop empty

  const count = cleaned.length
  if (count === 0) return 0

  const withPrice = cleaned.filter((i) => i.price != null).length
  const priceCoverage = withPrice / count // 0..1

  // price sanity: use avg_price if present, else compute from priced items
  let avg = r.avg_price
  if (!isSanePrice(avg)) {
    const ps = cleaned.map((i) => i.price).filter((p): p is number => typeof p === 'number')
    avg = ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : null
  }
  const avgOk = isSanePrice(avg) ? 1 : 0

  // name diversity: penalize duplicates
  const uniqNames = new Set(cleaned.map((i) => i.name.toLowerCase())).size
  const diversity = uniqNames / count // 0..1

  // Simple weighted score
  // items count (cap at 10) + coverage + diversity + price sanity
  const countScore = Math.min(count, 10) / 10 // 0..1
  return countScore * 0.35 + priceCoverage * 0.35 + diversity * 0.2 + avgOk * 0.1
}

export function pickBestByCompetitor(results: ScrapeResult[]) {
  // Group by competitorId
  const map = new Map<string, ScrapeResult[]>()
  for (const r of results) {
    if (!r?.competitorId) continue
    const arr = map.get(r.competitorId) ?? []
    arr.push(r)
    map.set(r.competitorId, arr)
  }

  // pick highest score in each group
  const winners: Array<{ competitorId: string; best: ScrapeResult; score: number }> = []
  for (const [competitorId, arr] of map) {
    let best = arr[0]
    let bestScore = scoreScrape(arr[0] || ({} as any))
    for (let i = 1; i < arr.length; i++) {
      const sc = scoreScrape(arr[i])
      if (sc > bestScore) {
        best = arr[i]
        bestScore = sc
      }
    }
    winners.push({ competitorId, best, score: bestScore })
  }
  return winners
}
