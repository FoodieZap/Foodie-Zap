import { NormalizedMenu } from '../menu/fetcher'

export async function scrapeUbereats(html: string): Promise<NormalizedMenu | null> {
  const match = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.*?\});/)
  if (!match) return null

  try {
    const data = JSON.parse(match[1])
    const menu = data?.restaurant?.menu?.items || []
    const items = Object.values(menu).map((i: any) => ({
      name: i.title,
      price: i.price / 100,
    }))
    const prices = items.map((i: any) => i.price).filter(Boolean) as number[]
    const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null
    return { avg_price: avg, top_items: items.slice(0, 12), source: 'ubereats' }
  } catch {
    return null
  }
}
