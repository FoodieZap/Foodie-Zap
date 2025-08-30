import { NormalizedMenu } from '../menu/fetcher'

export async function scrapeGrubhub(html: string): Promise<NormalizedMenu | null> {
  const match = html.match(/<script id="ghs-init-data"[^>]*>(.*?)<\/script>/)
  if (!match) return null

  try {
    const data = JSON.parse(match[1])
    const items = (data?.menuItems || []).map((i: any) => ({
      name: i.name,
      price: i.price,
    }))
    const prices = items.map((i: any) => i.price).filter(Boolean) as number[]
    const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null
    return { avg_price: avg, top_items: items.slice(0, 12), source: 'grubhub' }
  } catch {
    return null
  }
}
