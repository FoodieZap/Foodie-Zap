import { load } from 'cheerio'
import { NormalizedMenu } from '../menu/fetcher'

export async function scrapeYelp(html: string): Promise<NormalizedMenu | null> {
  const $ = load(html)

  const items: { name: string; price?: number }[] = []
  const prices: number[] = []

  $('.menu-item').each((_, el) => {
    const name = $(el).find('.menu-item-name').text().trim()
    const priceText = $(el).find('.menu-item-price-amount').text().trim()
    if (name) {
      const price = priceText ? parseFloat(priceText.replace(/[^0-9.]/g, '')) : undefined
      items.push({ name, price })
      if (price != null) prices.push(price)
    }
  })

  if (!items.length) return null
  const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null
  return { avg_price: avg, top_items: items.slice(0, 12), source: 'yelp' }
}
