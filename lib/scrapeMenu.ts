// lib/scrapeMenu.ts
import { load as loadHTML } from 'cheerio'
import { fetch } from 'undici'
import { fetchHtml } from './http'
import { discoverMenuUrl } from './menuDiscovery'

// NOTE: We will wire external provider scrapers later. For now, keep only local adapters.
// If/when you add files under lib/scrapers/*, uncomment these imports and remove the local duplicates.
// import { scrapeYelp } from './scrapers/yelp'
// import { scrapeDoordash } from './scrapers/doordash'
// import { scrapeUbereats } from './scrapers/ubereats'
// import { scrapeGrubhub } from './scrapers/grubhub'
// import { scrapeToast as scrapeToastExt } from './scrapers/toast'
// import { scrapeSquare as scrapeSquareExt } from './scrapers/square'
// import { scrapeClover } from './scrapers/clover'

export type ScrapedMenu = {
  avg_price: number | null
  top_items: Array<{ name: string; price?: number | null; description?: string }> | null
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

/** ---------- LOCAL domain adapters (safe now) ---------- */
// If you later un-comment external imports above, delete these duplicates.

async function scrapeSquareLocal(url: string, html: string): Promise<ScrapedMenu | null> {
  const $ = loadHTML(html)
  const items: Array<{ name: string; price?: number | null }> = []
  $('.ProductItem, [data-item-name], .grid-item, [data-test="item-card"]').each((_, el) => {
    const name = cleanItemName(
      $(el).attr('data-item-name') ||
        $(el).find('.name, .title, [data-test="item-name"]').first().text(),
    )

    const priceText = $(el)
      .find('.price, [datna-item-price], [data-test="item-price"]')
      .first()
      .text()
    const priceMatch = parsePricesFromText(priceText)[0] ?? null
    if (name) items.push({ name, price: priceMatch ?? null })
  })
  if (!items.length) return null
  const avg = computeAvg(items.map((i) => i.price!).filter(Boolean) as number[])
  return { avg_price: avg, top_items: items.slice(0, 12), source: 'square' }
}

async function scrapeToastLocal(url: string, html: string): Promise<ScrapedMenu | null> {
  const $ = loadHTML(html)
  const items: Array<{ name: string; price?: number | null }> = []
  $('[data-testid], .menuItem, .menu-item, .MenuItem, .menu-item-container').each((_, el) => {
    const name = cleanItemName(
      $(el).find('.name, .menuItemName, [data-testid*="name"], .menu-item-name').text(),
    )
    const priceText = $(el)
      .find('.price, .menuItemPrice, [data-testid*="price"], .menu-item-price')
      .text()
    const price = parsePricesFromText(priceText)[0] ?? null
    if (name) items.push({ name, price })
  })
  if (!items.length) return null
  const avg = computeAvg(items.map((i) => i.price!).filter(Boolean) as number[])
  return { avg_price: avg, top_items: items.slice(0, 12), source: 'toast' }
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
    if (items.length >= 12) break
  }
  if (!items.length && avg == null) return null
  return { avg_price: avg, top_items: items.slice(0, 12), source: 'pdf' }
}

/** ---------- generic fallback ---------- */

async function scrapeGeneric(html: string): Promise<ScrapedMenu | null> {
  const $ = loadHTML(html)

  $('script, style, noscript, svg, iframe').remove()

  const MENU_WORDS =
    /(menu|entrees|mains|starters|appetizers|pizzas?|burgers?|sandwich(?:es)?|salads?|drinks?|beverages?|sides?|desserts?)/i

  type Cand = { el: any; score: number }
  const candidates: Cand[] = []

  $('body *').each((_, el) => {
    const t = $(el)
      .text()
      .replace(/\s{2,}/g, ' ')
      .trim()
    if (!t || t.length < 30) return

    const priceTokens = t.match(/\$?\d[\d.,]*/g) || []
    const hasMenuWord = MENU_WORDS.test(t)

    // Must show *some* evidence it's a menu block
    if (priceTokens.length < 2 && !(priceTokens.length >= 1 && hasMenuWord)) return

    // Score price density higher, penalize giant blobs
    const score = priceTokens.length * 3 + (hasMenuWord ? 1 : 0) - Math.max(0, t.length / 2000)
    if (score >= 3) candidates.push({ el, score })
  })

  candidates.sort((a, b) => b.score - a.score)
  const top = candidates.slice(0, 6)

  const items: Array<{ name: string; price?: number | null; description?: string }> = []
  const pricesForAvg: number[] = []

  for (const c of top) {
    const lines = loadHTML($(c.el).html() || '')('body')
      .text()
      .replace(/\r/g, '')
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean)

    let currentSection: string | undefined

    for (const line of lines) {
      // Section-like heading
      if (
        /^[A-Z][A-Za-z0-9 '&-]{2,30}$/.test(line) &&
        MENU_WORDS.test(line) &&
        !/\$?\d[\d.,]*/.test(line)
      ) {
        currentSection = line
        continue
      }

      // Item line containing a price
      if (/\$?\d[\d.,]*/.test(line)) {
        const price = parsePricesFromText(line)[0] ?? null
        let name = cleanItemName(
          line
            .replace(/\$?\d[\d.,]*/g, '')
            .replace(/[•\-–—|]+/g, ' ')
            .trim(),
        )
        if (name && name.length <= 120) {
          items.push({ name, price })
          if (price != null) pricesForAvg.push(price)
        }
        continue
      }

      // Description line right after item
      c // before pushing items, ignore obvious non-menu lines
      const HOURS =
        /\b(mon(day)?|tue(s(day)?)?|wed(nesday)?|thu(rs(day)?)?|fri(day)?|sat(urday)?|sun(day)?)\b.*\b(am|pm)\b/i
      const TIME_ONLY = /(^|[^0-9])[0-2]?\d\s*(:\s*\d{2})?\s*(am|pm)\b/i
      const ADDRESSY =
        /\b(ave|avenue|st|street|rd|road|blvd|boulevard|suite|ste|fl|floor|miami|fl|tx|ca|ny|va)\b/i
      const LEGAL = /(all rights reserved|privacy|terms|cookie|skip to content)/i

      // Lines containing a price → treat as item rows (BUT filter junk)
      const hasPrice = /\$?\d[\d.,]*/.test(line)
      if (hasPrice) {
        if (HOURS.test(line) || TIME_ONLY.test(line) || LEGAL.test(line) || ADDRESSY.test(line))
          continue
        const price = parsePricesFromText(line)[0] ?? null
        let name = cleanItemName(
          line
            .replace(/\$?\d[\d.,]*/g, '')
            .replace(/[•\-–—|]+/g, ' ')
            .trim(),
        )
        if (name && name.length <= 120) {
          items.push({ name, price })
          if (price != null) pricesForAvg.push(price)
        }
        continue
      }

      // Short description line that immediately follows an item (but avoid hours/addresses)
      const prev = items.at(-1)
      if (
        prev &&
        !/\$?\d[\d.,]*/.test(line) &&
        line.length <= 160 &&
        !LEGAL.test(line) &&
        !HOURS.test(line) &&
        !TIME_ONLY.test(line) &&
        !ADDRESSY.test(line)
      ) {
        if (!prev.description && !/^\p{P}+$/u.test(line)) {
          prev.description = line
        }
      }
    }
  }

  // dedupe by name+price
  const seen = new Set<string>()
  const uniq: Array<{ name: string; price?: number | null; description?: string }> = []
  for (const it of items) {
    const key = (it.name + '|' + (it.price ?? '')).toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      uniq.push(it)
    }
  }

  const avg = computeAvg(pricesForAvg)
  if (avg == null && !uniq.length) return null
  return { avg_price: avg, top_items: uniq.slice(0, 12), source: 'generic' }
}

/** ---------- entry points ---------- */
scrapeGeneric
// Main: fetches the URL (handles PDF vs HTML) and routes to adapters → generic
export async function scrapeMenuFromUrl(url: string): Promise<ScrapedMenu> {
  // refuse marketplaces in this MVP (fast + clear UX)
  if (/ubereats\.com|doordash\.com|grubhub\.com/i.test(url)) {
    return { avg_price: null, top_items: null, source: 'unsupported' }
  }

  // If it's a bare homepage, try to jump to an actual menu
  try {
    const u = new URL(url)
    if (u.pathname === '/' || u.pathname.length <= 1) {
      const discovered = await discoverMenuUrl(url)
      if (discovered) url = discovered
    }
  } catch {}

  const { html, contentType } = await fetchHtml(url)
  if (contentType.includes('application/pdf')) {
    const res = await fetch(url)
    const buf = Buffer.from(await res.arrayBuffer())
    const pdf = await scrapePdf(buf)
    return pdf ?? { avg_price: null, top_items: null, source: 'pdf' }
  }

  return await scrapeMenuUsingHtml(url, html)
}

// Alternate entry: caller already has HTML
export async function scrapeMenuUsingHtml(url: string, html: string): Promise<ScrapedMenu> {
  const host = new URL(url).hostname

  // Minimal Yelp adapter (works on /menu pages and many biz pages that render menu items)
  if (/yelp\.com$/i.test(host) || host.endsWith('.yelp.com')) {
    const $ = loadHTML(html)
    const items: Array<{ name: string; price?: number | null }> = []

    // Try structured menu blocks
    $('.menu-item, [data-testid="menu-item"]').each((_, el) => {
      const name =
        cleanItemName(
          $(el).find('.menu-item-name, [data-testid="menu-item-name"], h4, h3').first().text(),
        ) || ''
      const priceText =
        $(el)
          .find(
            '.menu-item-price-amount, [data-testid="menu-item-price"], .price, .menu-item-price',
          )
          .first()
          .text() || ''
      const price = parsePricesFromText(priceText)[0] ?? null
      if (name) items.push({ name, price })
    })

    // Fallback: scan priced list rows
    if (items.length < 3) {
      $('[class*="menu"], ul li, .list__09f24__ynIEd').each((_, el) => {
        const t = $(el).text().trim()
        if (!/\$?\d[\d.,]*/.test(t)) return
        const price = parsePricesFromText(t)[0] ?? null
        const name = cleanItemName(t.replace(/\$?\d[\d.,]*/g, '').trim())
        if (name) items.push({ name, price })
      })
    }

    const prices = items.map((i) => i.price ?? NaN).filter((n) => Number.isFinite(n)) as number[]
    const avg = computeAvg(prices)

    if (items.length >= 2) {
      return { avg_price: avg, top_items: items.slice(0, 12), source: 'generic' }
    }
    // fall through to generic if Yelp CSS changed
  }

  if (/square\.site$|\.square\.site$/i.test(host)) {
    const sq = await scrapeSquareLocal(url, html)
    if (sq && (sq.top_items?.length ?? 0) >= 2) return sq
  }
  if (/toasttab\.com$/i.test(host) || host.includes('.toasttab.')) {
    const tt = await scrapeToastLocal(url, html)
    if (tt && (tt.top_items?.length ?? 0) >= 2) return tt
  }

  const gen = await scrapeGeneric(html)
  if (gen && (gen.top_items?.length ?? 0) >= 2) return gen

  return { avg_price: null, top_items: null, source: 'generic' }
}

// Backward-compat alias (some code may import { scrapeMenu }):
export async function scrapeMenu(url: string): Promise<ScrapedMenu> {
  return scrapeMenuFromUrl(url)
}
