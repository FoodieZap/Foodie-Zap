// lib/scrapeMenu.ts
import { load as loadHTML } from 'cheerio'
import { fetch } from 'undici'
import { discoverMenuLinks, type DiscoveredLink } from './menuDiscovery'
import { aiParseMenuRich } from './aiMenuParser'
import { aiExtractTextFromImage } from './aiOcr'
import { resolveMenuCandidatesAI } from './aiCandidates'

// NOTE: We will wire external provider scrapers later. For now, keep only local adapters.
// If/when you add files under lib/scrapers/*, uncomment these imports and remove the local duplicates.
// import { scrapeYelp } from './scrapers/yelp'
// import { scrapeDoordash } from './scrapers/doordash'
// import { scrapeUbereats } from './scrapers/ubereats'
// import { scrapeGrubhub } from './scrapers/grubhub'
// import { scrapeToast as scrapeToastExt } from './scrapers/toast'
// import { scrapeSquare as scrapeSquareExt } from './scrapers/square'
// import { scrapeClover } from './scrapers/clover'

/** ---------- helpers ---------- */
function looksBrunchOnly(urlOrLabel: string) {
  return /\bbrunch\b/i.test(urlOrLabel) && !/\b(dinner|lunch|all-?day)\b/i.test(urlOrLabel)
}

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
    const full = m[0]
    const idx = m.index ?? 0
    const next = text[idx + full.length] || ''
    const prev = text[idx - 1] || ''
    if (full.includes('%') || next === '%' || prev === '%') continue // drop percents
    const tail = text.slice(idx, idx + full.length + 6).toLowerCase()
    if (/\b(am|pm)\b/.test(tail) || /\d\s*(am|pm)/.test(tail)) continue // drop times
    const raw = m[1] ?? (m[2] ? `${m[2]}${m[3] ? '.' + m[3] : ''}` : '')
    if (!raw) continue
    const val = Number(String(raw).replace(',', '.'))
    if (!Number.isNaN(val) && val >= 1 && val <= 200) prices.push(val)
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
// Filters that kill hours, addresses, phones, legal cruft
const HOURS_RE =
  /\b(mon(day)?|tue(s(day)?)?|wed(nesday)?|thu(rs(day)?)?|fri(day)?|sat(urday)?|sun(day)?)\b.*\b(am|pm)\b/i
const TIME_ONLY_RE = /(^|[^0-9])[0-2]?\d\s*(:\s*\d{2})?\s*(am|pm)\b/i
const ADDRESS_RE =
  /\b(ave|avenue|st|street|rd|road|blvd|boulevard|suite|ste|fl|floor|hwy|highway|ct|court|dr|drive|miami|fl|tx|ca|ny|va)\b/i
const PHONE_RE = /\b\(?\+?1?\)?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/
const LEGAL_RE = /(all rights reserved|privacy|terms|cookie|skip to content|©|copyright)/i

function isJunkName(name: string) {
  const s = (name || '').replace(/\s+/g, ' ').trim()
  if (!s) return true
  if (s.length < 2 || s.length > 80) return true

  const HOURS_RE =
    /\b(mon(day)?|tue(s(day)?)?|wed(nesday)?|thu(rs(day)?)?|fri(day)?|sat(urday)?|sun(day)?)\b.*\b(am|pm)\b/i
  const TIME_ONLY_RE = /(^|[^0-9])[0-2]?\d\s*(:\s*\d{2})?\s*(am|pm)\b/i
  const ADDRESS_RE =
    /\b(ave|avenue|st|street|rd|road|blvd|boulevard|suite|ste|fl|floor|hwy|highway|ct|court|dr|drive|miami|fl|tx|ca|ny|va)\b/i
  const PHONE_RE = /\b\(?\+?1?\)?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/
  const LEGAL_RE = /(all rights reserved|privacy|terms|cookie|skip to content|©|copyright)/i

  if (HOURS_RE.test(s) || TIME_ONLY_RE.test(s)) return true
  if (ADDRESS_RE.test(s) || PHONE_RE.test(s) || LEGAL_RE.test(s)) return true
  if (/^only available\b/i.test(s)) return true
  if (/\bmade to order\b/i.test(s)) return true
  if (/\bcrafted with\b/i.test(s)) return true
  if (/\bserved with\b/i.test(s) && s.includes(',')) return true
  if (/[.!?]$/.test(s) && s.split(' ').length > 6) return true
  if (/^(order online|menu|menus|locations?|contact|about)$/i.test(s)) return true
  if (/[#]?\d{1,5}\b/.test(s) && /(?:st|ave|blvd|rd|dr|ct|miami|fl|hwy)/i.test(s)) return true
  return false
}

function sanitizeItems(items: Array<{ name: string; price?: number | null }>) {
  const out: Array<{ name: string; price?: number | null }> = []
  const seen = new Set<string>()
  for (const it of items) {
    const name = (it?.name || '').replace(/\s+/g, ' ').trim()
    if (!name || isJunkName(name)) continue
    const price = typeof it?.price === 'number' ? it.price : null
    const key = (name + '|' + (price ?? '')).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ name, price })
  }
  return out
}

function qualityLooksMenuLike(items: Array<{ name: string; price?: number | null }>) {
  const kept = items.length
  if (kept >= 5) return true
  const priced = items.filter((i) => typeof i.price === 'number').length
  return kept >= 3 && priced >= 1
}
// ---------- DEDUPE & MERGE HELPERS (sections/items) ----------
type ItemLite = { name: string; price?: number | null }
type SectionLite = { name: string; items: ItemLite[] }

function normName(s: string) {
  return s
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ') // drop punctuation/symbols
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function itemKey(it: ItemLite) {
  const n = normName(it.name)
  // Price is optional; use empty string when absent to still dedupe by name
  const p = typeof it.price === 'number' ? String(it.price) : ''
  return `${n}|${p}`
}

function dedupeItems(items: ItemLite[]): ItemLite[] {
  const seen = new Set<string>()
  const out: ItemLite[] = []
  for (const it of items) {
    const key = itemKey(it)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(it)
  }
  return out
}

// Jaccard overlap on item names (ignore price) → how similar two sections are
function sectionOverlap(a: SectionLite, b: SectionLite) {
  const setA = new Set(a.items.map((x) => normName(x.name)))
  const setB = new Set(b.items.map((x) => normName(x.name)))
  if (setA.size === 0 || setB.size === 0) return 0
  let inter = 0
  for (const n of setA) if (setB.has(n)) inter++
  // We want to know “is one basically a duplicate of the other?”
  // Use overlap vs the smaller set.
  const denom = Math.min(setA.size, setB.size)
  return inter / denom
}

function betterSectionName(a: string, b: string) {
  // Prefer the “cleaner”/shorter with fewer stop words, else pick the shorter one
  const stop = /\b(morning|food|menu|the)\b/gi
  const aa = a.replace(stop, '').trim()
  const bb = b.replace(stop, '').trim()
  if (aa && bb) {
    if (aa.length !== bb.length) return aa.length <= bb.length ? a : b
  }
  return a.length <= b.length ? a : b
}

function mergeTwoSections(base: SectionLite, extra: SectionLite): SectionLite {
  // Combine and dedupe items, keep a sensible name
  const name = betterSectionName(base.name, extra.name)
  const items = dedupeItems([...base.items, ...extra.items])
  return { name, items }
}

/**
 * 1) Dedupes items inside each section
 * 2) Merges sections whose item lists heavily overlap (>= 0.85 of the smaller)
 * 3) Drops sections that end up empty
 */
function dedupeAndMergeSections(sections: SectionLite[]): SectionLite[] {
  // Step 1: item-level dedupe inside each section
  let cleaned = sections
    .map((s) => ({
      name: s.name || 'Menu',
      items: dedupeItems(s.items || []),
    }))
    .filter((s) => s.items.length > 0)

  if (cleaned.length <= 1) return cleaned

  // Step 2: merge near-duplicates
  const merged: SectionLite[] = []
  for (const sec of cleaned) {
    // try to merge into an existing bucket
    let mergedInto = false
    for (let i = 0; i < merged.length; i++) {
      const ov = sectionOverlap(merged[i], sec)
      // If 85% of the smaller section’s items are in the other, treat as duplicate bucket
      if (ov >= 0.85) {
        merged[i] = mergeTwoSections(merged[i], sec)
        mergedInto = true
        break
      }
    }
    if (!mergedInto) merged.push(sec)
  }

  // Step 3: final trim
  return merged.filter((s) => s.items.length > 0)
}

/**
 * Build a cross-section, de-duplicated item list for top_items
 * (so the same item doesn’t appear twice if present in multiple sections)
 */
function buildUniqueTopItems(allSections: SectionLite[], cap = 500): ItemLite[] {
  const out: ItemLite[] = []
  const seen = new Set<string>()
  for (const s of allSections) {
    for (const it of s.items) {
      const key = itemKey(it)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(it)
      if (out.length >= cap) return out
    }
  }
  return out
}
// --- deterministic fetch helpers --------------------------------------------
const STABLE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.8',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
}

async function fetchStable(href: string, timeoutMs = 10000) {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(href, {
      redirect: 'follow',
      headers: STABLE_HEADERS as any,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(t)
  }
}

/** ---------- LOCAL domain adapters (safe now) ---------- */
// If you later un-comment external imports above, delete these duplicates.
type LocalParseResult = {
  avg_price: number | null
  top_items: Array<{ name: string; price?: number | null }> | null
  source: 'generic' | 'square' | 'toast' | 'pdf'
}
async function scrapeSquareLocal(url: string, html: string): Promise<LocalParseResult | null> {
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

async function scrapeToastLocal(url: string, html: string): Promise<LocalParseResult | null> {
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

async function scrapePdf(buffer: Buffer): Promise<LocalParseResult | null> {
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

async function scrapeGeneric(html: string): Promise<LocalParseResult | null> {
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
      // before pushing items, ignore obvious non-menu lines
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
  const cleaned = sanitizeItems(uniq)
  if (!qualityLooksMenuLike(cleaned)) return null
  return {
    avg_price:
      computeAvg(cleaned.map((i) => i.price ?? NaN).filter(Number.isFinite) as number[]) ?? avg,
    top_items: cleaned.slice(0, 12),
    source: 'generic',
  }
}

/** ---------- entry points ---------- */
// Main: fetches the URL (handles PDF vs HTML) and routes to adapters → generic
// Main: discovers a better URL (menu/order/pdf), fetches HTML (or PDF), routes to adapters → generic → AI fallback

// --- metrics helpers (put near top of file) ---
type Section = {
  name: string
  items: Array<{ name: string; price?: number | null }>
}
type Metrics = {
  avg_ticket: number | null
  by_section: Record<string, { avg: number; count: number }>
}

function computeAvgStrict(nums: number[]) {
  if (!nums || nums.length === 0) return null
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length
  return Number(avg.toFixed(2))
}
function numericPrices(items: Array<{ price?: number | null }>) {
  return (items ?? [])
    .map((i) => (typeof i?.price === 'number' ? i.price : NaN))
    .filter((n) => Number.isFinite(n)) as number[]
}
function buildMetrics(sections: Section[], overall: number | null): Metrics {
  const by_section: Record<string, { avg: number; count: number }> = {}
  for (const s of sections) {
    const prices = numericPrices(s.items)
    const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : NaN
    by_section[s.name] = {
      avg: Number.isFinite(avg) ? Number(avg.toFixed(2)) : 0,
      count: s.items.length,
    }
  }
  return { avg_ticket: overall, by_section }
}

// gather good text blocks from HTML to feed to AI
function extractBestBlocksFromHtml(html: string): string | null {
  const $ = loadHTML(html)
  $('script,style,noscript,svg,iframe').remove()

  const MENU_WORDS =
    /(menu|entrees|mains|starters|appetizers|pizzas?|burgers?|sandwich(?:es)?|salads?|drinks?|beverages?|sides?|desserts?)/i

  type Cand = { t: string; score: number }
  const cands: Cand[] = []

  $('body *').each((_, el) => {
    const t = $(el)
      .text()
      .replace(/\s{2,}/g, ' ')
      .trim()
    if (!t || t.length < 30) return
    const priceTokens = t.match(/\$?\d[\d.,]*/g) || []
    const hasMenuWord = MENU_WORDS.test(t)
    if (priceTokens.length < 1 && !hasMenuWord) return
    const score = priceTokens.length * 3 + (hasMenuWord ? 1 : 0) - Math.max(0, t.length / 2000)
    if (score >= 2) cands.push({ t, score })
  })

  cands.sort((a, b) => b.score - a.score)
  const best = cands
    .slice(0, 6)
    .map((c) => c.t)
    .join('\n')
  return best && best.length > 100 ? best : null
}
// --- NEW: structured JSON + best-text extractor -----------------------------
// --- structured-first extractor with deterministic ordering ------------------
type BlockKind = 'ldjson' | 'next' | 'apollo' | 'priced_text'
const KIND_WEIGHT: Record<BlockKind, number> = {
  ldjson: 4,
  next: 3,
  apollo: 2,
  priced_text: 1,
}

/**
 * Returns menu-like text blocks, already *sorted*:
 *   schema.org (ldjson) > Next.js payload > Apollo cache > priced text
 * then by length desc. This makes TOP-3 stable.
 */
function extractBlocksFromHtml(html: string): string[] {
  const $ = loadHTML(html)
  const out: Array<{ text: string; kind: BlockKind; len: number }> = []

  const pushBlock = (text: string, kind: BlockKind) => {
    const t = (text || '').trim()
    if (t.length > 80) out.push({ text: t, kind, len: t.length })
  }

  // 1) schema.org ld+json menus
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text()
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      const blocks = flattenLdJsonToMenuBlocks(parsed)
      for (const b of blocks) pushBlock(b, 'ldjson')
    } catch {}
  })

  // 2) Next.js JSON blobs (__NEXT_DATA__ or inline)
  $('script').each((_, el) => {
    const txt = $(el).text() || ''
    if (!txt) return
    const m = txt.match(/__NEXT_DATA__\s*=\s*({[\s\S]+?});?<\/script>|^({[\s\S]+})$/)
    const jsonStr = m?.[1] || m?.[2]
    if (!jsonStr) return
    try {
      const obj = JSON.parse(jsonStr)
      const blocks = greedyWalkForMenuBlocks(obj)
      for (const b of blocks) pushBlock(b, 'next')
    } catch {}
  })

  // 3) Apollo cache
  $('script').each((_, el) => {
    const txt = $(el).text() || ''
    if (!txt) return
    const m =
      txt.match(/__APOLLO_STATE__\s*=\s*({[\s\S]+?});?<\/script>/) ||
      txt.match(/window\.__APOLLO_STATE__\s*=\s*({[\s\S]+?});?/)
    const jsonStr = m?.[1]
    if (!jsonStr) return
    try {
      const obj = JSON.parse(jsonStr)
      const blocks = greedyWalkForMenuBlocks(obj)
      for (const b of blocks) pushBlock(b, 'apollo')
    } catch {}
  })

  // 4) fallback: priced text
  const priced = extractBestBlocksFromHtml(html)
  if (priced) pushBlock(priced, 'priced_text')

  // deterministic ordering
  out.sort((a, b) => {
    const kw = KIND_WEIGHT[b.kind] - KIND_WEIGHT[a.kind]
    if (kw !== 0) return kw
    if (b.len !== a.len) return b.len - a.len
    // final tiebreaker = lexical to be fully stable
    return a.text.localeCompare(b.text)
  })

  return out.map((x) => x.text)
}

// Helpers used above ---------------------------------------------------------

// a) Flatten schema.org ld+json structures to text blocks
function flattenLdJsonToMenuBlocks(parsed: any): string[] {
  const blocks: string[] = []
  const collect = (menuObj: any, label?: string) => {
    // Menu with hasMenuSection / hasMenuItem
    const lines: string[] = []
    if (label) lines.push(label)
    const secs = toArray(menuObj?.hasMenuSection)
    if (secs.length) {
      for (const sec of secs) {
        const secName = str(sec?.name) || 'Menu'
        lines.push(secName)
        const items = toArray(sec?.hasMenuItem)
        for (const it of items) {
          const nm = str(it?.name)
          const price =
            numberish(it?.offers?.price) ??
            numberish(it?.offers?.priceSpecification?.price) ??
            numberish(it?.price)
          if (nm) lines.push(price != null ? `${nm} - ${price}` : nm)
        }
      }
    } else {
      // Flat items directly on menu
      const items = toArray(menuObj?.hasMenuItem)
      for (const it of items) {
        const nm = str(it?.name)
        const price =
          numberish(it?.offers?.price) ??
          numberish(it?.offers?.priceSpecification?.price) ??
          numberish(it?.price)
        if (nm) lines.push(price != null ? `${nm} - ${price}` : nm)
      }
    }
    if (lines.length > 3) blocks.push(lines.join('\n'))
  }

  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return
    const t = str(node['@type'])
    if (t?.toLowerCase() === 'menu') {
      collect(node, str(node?.name) || undefined)
    } else if (Array.isArray(node)) {
      for (const v of node) walk(v)
    } else {
      for (const k of Object.keys(node)) walk(node[k])
    }
  }
  walk(parsed)
  return blocks
}

// b) Greedy walk for menu-like arrays in app payloads (Next/Apollo/etc.)
function greedyWalkForMenuBlocks(root: any): string[] {
  const blocks: string[] = []
  const seen = new Set<any>()

  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return
    if (seen.has(node)) return
    seen.add(node)

    if (Array.isArray(node)) {
      // if array looks like items [{name, price}] or [{title,...}]
      if (node.length >= 2 && looksLikeItemArray(node)) {
        const lines: string[] = []
        // optional: try to find an upper-level "section" name nearby
        // (skip—too site-specific; AI can section later)
        for (const it of node) {
          const nm = str(it?.name) || str(it?.title) || ''
          const price =
            numberish(it?.price) ??
            numberish(it?.amount) ??
            numberish(it?.priceAmount) ??
            numberish(it?.amountMoney?.amount) ??
            numberish(it?.money?.amount)
          if (nm) lines.push(price != null ? `${nm} - ${price}` : nm)
        }
        if (lines.length > 3) blocks.push(lines.join('\n'))
      } else {
        for (const v of node) visit(v)
      }
      return
    }

    for (const k of Object.keys(node)) {
      const v = node[k]
      // common submenu keys
      if (/menu|items|sections|categories|dishes|products|foods|beverages/i.test(k)) {
        if (Array.isArray(v) && looksLikeItemArray(v)) {
          const lines: string[] = []
          for (const it of v) {
            const nm = str(it?.name) || str(it?.title) || ''
            const price =
              numberish(it?.price) ??
              numberish(it?.amount) ??
              numberish(it?.priceAmount) ??
              numberish(it?.amountMoney?.amount) ??
              numberish(it?.money?.amount)
            if (nm) lines.push(price != null ? `${nm} - ${price}` : nm)
          }
          if (lines.length > 3) blocks.push(lines.join('\n'))
        }
      }
      visit(v)
    }
  }

  visit(root)
  return blocks
}

// c) tiny utils
function toArray(x: any): any[] {
  return Array.isArray(x) ? x : x ? [x] : []
}
function str(x: any): string | undefined {
  return typeof x === 'string' ? x.trim() : undefined
}
function numberish(x: any): number | null {
  if (x == null) return null
  if (typeof x === 'number' && Number.isFinite(x)) return Number(x)
  if (typeof x === 'string') {
    const t = x.replace(/[^\d.]/g, '')
    if (!t) return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }
  return null
}
function looksLikeItemArray(arr: any[]): boolean {
  // at least 2 entries with names/titles and some price-like field
  let named = 0
  let priced = 0
  for (const it of arr.slice(0, 12)) {
    if (!it || typeof it !== 'object') continue
    const nm = str(it?.name) || str(it?.title)
    if (nm) named++
    if (
      numberish(it?.price) != null ||
      numberish(it?.amount) != null ||
      numberish(it?.priceAmount) != null ||
      numberish(it?.amountMoney?.amount) != null ||
      numberish(it?.money?.amount) != null
    ) {
      priced++
    }
  }
  return named >= 2 && priced >= 1
}

export type ScrapedMenu = {
  avg_price: number | null
  top_items: Array<{ name: string; price?: number | null }> | null
  source: 'ai' | 'unsupported'
  __sections?: Array<{ name: string; items: Array<{ name: string; price?: number | null }> }>
  __metrics?: {
    avg_ticket: number | null
    by_section: Record<string, { avg: number; count: number }>
  }
  __sources?: Array<{ url: string; title?: string; source?: string }>
}
export async function scrapeMenuForBusiness(info: {
  name: string
  city?: string | null
  address?: string | null
  website?: string | null
}): Promise<ScrapedMenu> {
  const { name, city, address, website } = info

  const candidates = await resolveMenuCandidatesAI({
    name,
    city: city ?? undefined,
    address: address ?? undefined,
    website: website ?? undefined,
  })

  // Pull text from those pages (HTML/PDF/IMG) → feed to AI

  const used: Array<{ url: string; title?: string; source?: string }> = []

  const textsForAi: string[] = []

  const MAX_CANDIDATES = 8
  for (const c of candidates.slice(0, MAX_CANDIDATES)) {
    const href = c.url
    if (/\/(locations?|store)\//i.test(href) && !/menu|pdf/i.test(href)) continue
    try {
      const res = await fetchStable(href)

      if (!res.ok) continue
      const ct = (res.headers.get('content-type') || '').toLowerCase()

      // PDF
      if (ct.includes('application/pdf') || /\.pdf($|\?)/i.test(href)) {
        const buf = Buffer.from(await res.arrayBuffer())
        try {
          const pdfParse = (await import('pdf-parse')).default
          const data = await pdfParse(buf)
          const text = (data.text || '').trim()
          if (text.length > 200) textsForAi.push(text)
        } catch {}
        continue
      }

      // IMAGE (jpg/jpeg/png/webp)
      if (ct.startsWith('image/') || /\.(?:jpe?g|png|webp)(?:$|\?)/i.test(href)) {
        const buf = Buffer.from(await res.arrayBuffer())
        try {
          const text = await aiExtractTextFromImage(buf, { url: href })
          if (text && text.length > 50) textsForAi.push(text)
        } catch {}
        continue
      }

      // HTML
      if (ct.includes('text/html')) {
        const html = await res.text()
        // NEW
        const blocks = extractBlocksFromHtml(html)
        textsForAi.push(...blocks)

        continue
      }
    } catch {
      // ignore this candidate
    }
  }

  // If nothing found, at least try the official website raw (if provided)
  if (textsForAi.length === 0 && website) {
    try {
      const res = await fetch(website, { redirect: 'follow' })
      if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) {
        const html = await res.text()
        const block = extractBestBlocksFromHtml(html)
        if (block) {
          textsForAi.push(block)
          used.push({ url: website, source: 'site:home', title: 'Homepage' })
        }
      }
    } catch {}
  }

  if (textsForAi.length === 0) {
    // As a final fallback, try the website/homepage raw if present
    if (website) {
      try {
        const res = await fetch(website, { redirect: 'follow' })
        if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) {
          const html = await res.text()
          const block = extractBestBlocksFromHtml(html)
          if (block) {
            textsForAi.push(block)
            used.push({ url: website, source: 'site', title: 'Homepage' })
          }
        }
      } catch {}
    }
  }

  if (textsForAi.length) {
    const combined = textsForAi
      .sort((a, b) => b.length - a.length)
      .slice(0, 3)
      .join('\n\n---\n\n')
    try {
      const rich = await aiParseMenuRich(combined, {
        url: website ?? undefined,
      })

      let sections = (rich.sections || [])
        .map((s: any) => ({
          name: String(s?.name || '').trim() || 'Menu',
          items: (Array.isArray(s?.items) ? s.items : [])
            .map((it: any) => ({
              name: String(it?.name || '').trim(),
              price: typeof it?.price === 'number' ? it.price : null,
            }))
            .filter((it: any) => it.name && it.name.length >= 2),
        }))
        .filter((s: any) => s.items.length > 0)

      // 🔑 new: collapse duplicates and near-duplicates
      sections = dedupeAndMergeSections(sections)

      const allItems = buildUniqueTopItems(sections, 500)
      const prices = allItems
        .map((i) => i.price ?? NaN)
        .filter((n) => Number.isFinite(n)) as number[]
      const avg_ticket = prices.length
        ? Number((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2))
        : typeof rich.metrics?.avg_ticket === 'number'
        ? rich.metrics.avg_ticket
        : null

      // Convert metrics to numeric-only per-section to satisfy TS + charts
      const by_section: Record<string, { avg: number; count: number }> = {}
      for (const s of sections) {
        const ps = s.items
          .map((i: { price: any }) => i.price ?? NaN)
          .filter((n: unknown) => Number.isFinite(n)) as number[]
        const av = ps.length ? Number((ps.reduce((a, b) => a + b, 0) / ps.length).toFixed(2)) : 0
        by_section[s.name] = { avg: av, count: s.items.length }
      }

      return {
        avg_price: avg_ticket,
        top_items: allItems,
        source: 'ai',
        __sections: sections,
        __metrics: { avg_ticket, by_section },
        __sources: used,
      }
    } catch (e) {
      console.warn('aiParseMenuRich failed:', (e as any)?.message ?? e)
    }
  }

  return { avg_price: null, top_items: null, source: 'ai', __sources: used }
}

export async function scrapeMenuFromUrl(url: string): Promise<ScrapedMenu> {
  // Block marketplaces
  if (/ubereats\.com|doordash\.com|grubhub\.com|postmates\.com/i.test(url)) {
    return { avg_price: null, top_items: null, source: 'ai' } // ai-only mode; treat as no data
  }

  // Discover same-site menu/order/pdf/image pages
  let raw: unknown
  try {
    raw = await discoverMenuLinks(url)
  } catch {
    raw = [{ url }]
  }

  // Normalize to DiscoveredLink[]
  const candidates: DiscoveredLink[] = (Array.isArray(raw) ? raw : [raw])
    .map((c: any) => {
      if (!c) return null
      if (typeof c === 'string') return { url: c } as DiscoveredLink
      if (typeof c === 'object') {
        const u = c.url ?? (typeof c.href === 'string' ? c.href : null)
        if (!u) return null
        return {
          url: String(u),
          label: c.label ? String(c.label) : undefined,
          score: typeof c.score === 'number' ? c.score : undefined,
        } as DiscoveredLink
      }
      return null
    })
    .filter((x): x is DiscoveredLink => !!x)
  if (candidates.length === 0) candidates.push({ url })

  // stable candidate ordering even if discoverer returns ties
  candidates.sort((a, b) => {
    const as = a.score ?? 0
    const bs = b.score ?? 0
    if (bs !== as) return bs - as
    const au = new URL(a.url)
    const bu = new URL(b.url)
    if (au.hostname !== bu.hostname) return au.hostname.localeCompare(bu.hostname)
    return au.pathname.localeCompare(bu.pathname)
  })

  // 2) Pull blocks/text from up to N candidates
  const textsForAi: string[] = []
  const used: Array<{ url: string; title?: string; source?: string }> = []
  const MAX_CANDIDATES = 8

  // First pass: take best-ranked pages (sorted in discoverMenuLinks)
  for (const c of candidates.slice(0, MAX_CANDIDATES)) {
    const href = c.url
    const label = c.label ?? ''

    if (!href) continue
    if (/\/(locations?|store)\//i.test(href) && !/menu|pdf/i.test(href)) continue
    // Soft avoid obvious location pages

    try {
      const res = await fetchStable(href)
      if (!res.ok) continue
      const ct = (res.headers.get('content-type') || '').toLowerCase()

      if (ct.includes('application/pdf') || /\.pdf($|\?)/i.test(href)) {
        const buf = Buffer.from(await res.arrayBuffer())
        try {
          const pdfParse = (await import('pdf-parse')).default
          const data = await pdfParse(buf)
          const text = (data.text || '').trim()
          if (text.length > 200) {
            textsForAi.push(text)
            used.push({ url: href, source: 'pdf' })
          }
        } catch {}
        continue
      }

      if (ct.startsWith('image/') || /\.(?:jpe?g|png|webp)(?:$|\?)/i.test(href)) {
        const buf = Buffer.from(await res.arrayBuffer())
        try {
          const text = await aiExtractTextFromImage(buf, { url: href })
          if (text && text.length > 50) {
            textsForAi.push(text)
            used.push({ url: href, source: 'img' })
          }
        } catch {}
        continue
      }

      if (ct.includes('text/html')) {
        const html = await res.text()
        const blocks = extractBlocksFromHtml(html)
        textsForAi.push(...blocks)
        if (blocks.length) {
          used.push({ url: href, source: label ? `site:${label}` : 'site' })
        }
        continue
      }
    } catch {
      // ignore
    }
  }

  // If nothing found, try homepage raw
  if (textsForAi.length === 0) {
    try {
      const res = await fetchStable(url)
      if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) {
        const html = await res.text()
        // NEW
        const blocks = extractBlocksFromHtml(html)
        textsForAi.push(...blocks)

        used.push({ url, source: 'site:home' })
      }
    } catch {}
  }

  // 3) AI pass #1
  const runAi = async (blocks: string[], opts: any) => {
    const combined = blocks.slice(0, 3).join('\n\n---\n\n')

    const rich = await aiParseMenuRich(combined, opts)
    let sections = (rich.sections || [])
      .map((s: any) => ({
        name: String(s?.name || '').trim() || 'Menu',
        items: (Array.isArray(s?.items) ? s.items : [])
          .map((it: any) => ({
            name: String(it?.name || '').trim(),
            price: typeof it?.price === 'number' ? it.price : null,
          }))
          .filter((it: any) => it.name && it.name.length >= 2),
      }))
      .filter((s: any) => s.items.length > 0)

    // 🔑 new: collapse duplicates and near-duplicates
    sections = dedupeAndMergeSections(sections)

    const allItems = buildUniqueTopItems(sections, 500)
    const prices = allItems.map((i) => i.price ?? NaN).filter(Number.isFinite) as number[]
    const avg_ticket = prices.length
      ? Number((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2))
      : typeof rich.metrics?.avg_ticket === 'number'
      ? rich.metrics.avg_ticket
      : null

    // numeric-only per section
    const by_section: Record<string, { avg: number; count: number }> = {}
    for (const s of sections) {
      const ps = s.items
        .map((i: { price: any }) => i.price ?? NaN)
        .filter(Number.isFinite) as number[]
      const av = ps.length ? Number((ps.reduce((a, b) => a + b, 0) / ps.length).toFixed(2)) : 0
      by_section[s.name] = { avg: av, count: s.items.length }
    }

    return {
      sections,
      allItems,
      avg_ticket,
      metrics: { avg_ticket, by_section },
      top_items: allItems,
    }
  }

  let result: {
    sections: Array<{ name: string; items: any[] }>
    allItems: any[]
    avg_ticket: number | null
    metrics: {
      avg_ticket: number | null
      by_section: Record<string, { avg: number; count: number }>
    }
  } | null = null

  if (textsForAi.length) {
    try {
      result = await runAi(textsForAi, { url, sources: used })
    } catch (e) {
      console.warn('AI pass #1 failed:', (e as any)?.message ?? e)
    }
  }

  // 4) If first pass looks “brunch-only thin”, try a second pass excluding brunch pages and
  //    favoring dinner/lunch/all-day/drinks URLs
  const looksThinBrunch =
    result &&
    result.sections.length === 1 &&
    /brunch/i.test(result.sections[0].name) &&
    result.allItems.length < 15

  if ((!result || looksThinBrunch) && candidates.length > 1) {
    const nonBrunch = candidates
      .filter((c) => !looksBrunchOnly(c.url) && !looksBrunchOnly(c.label ?? ''))
      .slice(0, MAX_CANDIDATES)

    const secondBlocks: string[] = []
    const secondUsed: typeof used = []

    for (const c of nonBrunch) {
      const href = c.url
      if (!href) continue
      if (/\/(locations?|store)\//i.test(href) && !/menu|pdf/i.test(href)) continue
      try {
        const res = await fetchStable(href)
        if (!res.ok) continue
        const ct = (res.headers.get('content-type') || '').toLowerCase()
        if (ct.includes('application/pdf') || /\.pdf($|\?)/i.test(href)) {
          const buf = Buffer.from(await res.arrayBuffer())
          try {
            const pdfParse = (await import('pdf-parse')).default
            const data = await pdfParse(buf)
            const text = (data.text || '').trim()
            if (text.length > 200) {
              secondBlocks.push(text)
              secondUsed.push({ url: href, source: 'pdf' })
            }
          } catch {}
          continue
        }
        if (ct.startsWith('image/') || /\.(?:jpe?g|png|webp)(?:$|\?)/i.test(href)) {
          const buf = Buffer.from(await res.arrayBuffer())
          try {
            const text = await aiExtractTextFromImage(buf, { url: href })
            if (text && text.length > 50) {
              secondBlocks.push(text)
              secondUsed.push({ url: href, source: 'img' })
            }
          } catch {}
          continue
        }
        if (ct.includes('text/html')) {
          const html = await res.text()
          const block = extractBestBlocksFromHtml(html)
          if (block) {
            secondBlocks.push(block)
            secondUsed.push({ url: href, source: 'site' })
          }
        }
      } catch {}
    }

    if (secondBlocks.length) {
      try {
        result = await runAi(secondBlocks, { url, sources: [...used, ...secondUsed] })
      } catch (e) {
        console.warn('AI pass #2 failed:', (e as any)?.message ?? e)
      }
    }
  }

  // 5) Return AI-only payload
  if (result && result.allItems.length > 0) {
    return {
      avg_price: result.avg_ticket ?? null,
      top_items: result.allItems.slice(0, 500),

      source: 'ai',
      __sections: result.sections,
      __metrics: result.metrics,
    }
  }

  return { avg_price: null, top_items: null, source: 'ai' }
}

// Alternate entry: caller already has HTML → we still produce AI-only output
export async function scrapeMenuUsingHtml(url: string, html: string): Promise<ScrapedMenu> {
  // Use local parsers only to harvest items, then relabel to AI on the return
  const host = new URL(url).hostname.toLowerCase()
  let collected: Array<{ name: string; price?: number | null }> = []

  if (host.endsWith('square.site')) {
    const sq = await scrapeSquareLocal(url, html)
    if (sq?.top_items?.length) collected.push(...sq.top_items)
  } else if (host.includes('toasttab.com')) {
    const tt = await scrapeToastLocal(url, html)
    if (tt?.top_items?.length) collected.push(...tt.top_items)
  } else {
    const gen = await scrapeGeneric(html)
    if (gen?.top_items?.length) collected.push(...gen.top_items)
  }

  const items = sanitizeItems(collected)
  if (items.length === 0) {
    return { avg_price: null, top_items: null, source: 'ai' }
  }
  const prices = items.map((i) => i.price ?? NaN).filter(Number.isFinite) as number[]
  const avg = prices.length
    ? Number((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2))
    : null

  return { avg_price: avg, top_items: items.slice(0, 50), source: 'ai' }
}

// Backward-compat alias (some code may import { scrapeMenu }):
export async function scrapeMenu(url: string): Promise<ScrapedMenu> {
  return scrapeMenuFromUrl(url)
}
