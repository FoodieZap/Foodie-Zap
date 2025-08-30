import { NormalizedMenu } from '../menu/fetcher'

export async function scrapeDoordash(html: string): Promise<NormalizedMenu | null> {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/)
  if (!match) return null

  try {
    const data = JSON.parse(match[1])
    const menuItems = data.props?.pageProps?.menu?.menu_items || []
    const items = menuItems.map((i: any) => ({
      name: i.name,
      price: i.price ? i.price / 100 : null,
    }))
    const prices = items.map((i: any) => i.price).filter(Boolean) as number[]
    const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null
    return { avg_price: avg, top_items: items.slice(0, 12), source: 'doordash' }
  } catch {
    return null
  }
}
