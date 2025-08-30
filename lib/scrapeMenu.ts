import { load as loadHTML } from 'cheerio'
import { fetch } from 'undici'

export type ScrapedMenu = {
  avg_price: number | null
  top_items: Array<{ name: string; price?: number | null }> | null
  source: 'generic' | 'square' | 'toast' | 'pdf' | 'unsupported'
}

/** ---------- helpers ---------- */
function computeAvg(prices: number[]) {
  if (!prices.length) return null
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length
  return Number(avg.toFixed(2))
}

function parsePricesFromText(text: string): number[] {
  const prices: number[] = []
  const re = /(?:[$€£]\s?(\d{1,3}(?:[.,]\d{2})?)|\b(\d{1,3})(?:[.,](\d{2}))?\b)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const raw = m[1] ?? (m[2] ? `${m[2]}${m[3] ? '.' + m[3] : ''}` : '')
    if (!raw) continue
    const val = Number(String(raw).replace(',', '.'))
    if (!Number.isNaN(val) && val > 1 && val < 500) prices.push(val)
  }
  return prices
}

function cleanItemName(s: string) {
  const name = s.replace(/\s+/g, ' ').trim()
  if (!name || name.length < 2 || name.length > 80) return ''
  // filter obvious JS/CSS blobs
  if (/function|\bvar\s|=>|{.*}|<\/?[a-z]/i.test(name)) return ''
  return name
}

/** ---------- domain adapters ---------- */

async function scrapeSquare(url: string, html: string): Promise<ScrapedMenu | null> {
  // Square sites have structured sections; the generic parser often works well already,
  // but we can be a little smarter by preferring ".ProductItem" blocks.
  const $ = loadHTML(html)
  const items: Array<{ name: string; price?: number | null }> = []
  $('.ProductItem, [data-item-name], .grid-item').each((_, el) => {
    const name = cleanItemName(
      $(el).attr('data-item-name') || $(el).find('.name, .title').first().text(),
    )
    const priceText = $(el).find('.price, [data-item-price]').first().text()
    const priceMatch = parsePricesFromText(priceText)[0] ?? null
    if (name) items.push({ name, price: priceMatch ?? null })
  })
  if (!items.length) return null
  const avg = computeAvg(items.map((i) => i.price!).filter(Boolean) as number[])
  return { avg_price: avg, top_items: items.slice(0, 8), source: 'square' }
}

async function scrapeToast(url: string, html: string): Promise<ScrapedMenu | null> {
  const $ = loadHTML(html)
  const items: Array<{ name: string; price?: number | null }> = []
  $('[data-testid], .menuItem, .menu-item, .MenuItem').each((_, el) => {
    const name = cleanItemName($(el).find('.name, .menuItemName, [data-testid*="name"]').text())
    const priceText = $(el).find('.price, .menuItemPrice, [data-testid*="price"]').text()
    const price = parsePricesFromText(priceText)[0] ?? null
    if (name) items.push({ name, price })
  })
  if (!items.length) return null
  const avg = computeAvg(items.map((i) => i.price!).filter(Boolean) as number[])
  return { avg_price: avg, top_items: items.slice(0, 8), source: 'toast' }
}

async function scrapePdf(buffer: Buffer): Promise<ScrapedMenu | null> {
  const pdfParse = (await import('pdf-parse')).default
  const data = await pdfParse(buffer)
  const text = data.text || ''
  const prices = parsePricesFromText(text)
  const avg = computeAvg(prices)

  // crude “top items”: take lines that contain a price and keep left part as name
  const lines = text.split('\n')
  const items: Array<{ name: string; price?: number | null }> = []
  for (const line of lines) {
    if (!/\d/.test(line)) continue
    const name = cleanItemName(line.replace(/\$?\d[\d.,]*/g, '').trim())
    const price = parsePricesFromText(line)[0] ?? null
    if (name) items.push({ name, price })
    if (items.length >= 10) break
  }
  if (!items.length && avg == null) return null
  return { avg_price: avg, top_items: items.slice(0, 10), source: 'pdf' }
}

/** ---------- generic fallback ---------- */

async function scrapeGeneric(html: string): Promise<ScrapedMenu | null> {
  const $ = loadHTML(html)
  const bodyText = $('body').text() || ''
  const prices = parsePricesFromText(bodyText)
  const avg = computeAvg(prices)

  // Try to pair nearby names with prices by scanning simple list-like elements
  const items: Array<{ name: string; price?: number | null }> = []
  $('li, p, .menu-item, .MenuItem, .item, .product').each((_, el) => {
    const text = $(el).text()
    const price = parsePricesFromText(text)[0] ?? null
    const pieces = text.split(/\s{2,}| - | – | — /)
    const name = cleanItemName(pieces[0] || '')
    if (name) items.push({ name, price })
    if (items.length >= 10) return false
  })

  if (avg == null && !items.length) return null
  return { avg_price: avg, top_items: items.length ? items : null, source: 'generic' }
}

/** ---------- entry point ---------- */

export async function scrapeMenuFromUrl(url: string): Promise<ScrapedMenu> {
  // refuse marketplaces in this MVP (fast + clear UX)
  if (/ubereats\.com|doordash\.com|grubhub\.com/i.test(url)) {
    return { avg_price: null, top_items: null, source: 'unsupported' }
  }

  const res = await fetch(url, { redirect: 'follow' })
  const contentType = res.headers.get('content-type') || ''
  if (!res.ok) throw new Error(`fetch failed (${res.status})`)

  // PDF?
  if (contentType.includes('application/pdf')) {
    const buf = Buffer.from(await res.arrayBuffer())
    const pdf = await scrapePdf(buf)
    if (pdf) return pdf
    return { avg_price: null, top_items: null, source: 'pdf' }
  }

  // HTML
  const html = await res.text()
  const host = new URL(url).hostname

  // adapters first
  if (/square\.site$|\.square\.site$/i.test(host)) {
    const sq = await scrapeSquare(url, html)
    if (sq) return sq
  }
  if (/toasttab\.com$/i.test(host) || host.includes('.toasttab.')) {
    const tt = await scrapeToast(url, html)
    if (tt) return tt
  }

  // fallback
  const gen = await scrapeGeneric(html)
  return gen ?? { avg_price: null, top_items: null, source: 'generic' }
}
