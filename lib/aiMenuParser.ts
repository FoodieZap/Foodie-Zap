// lib/aiMenuParser.ts
import OpenAI from 'openai'

const MAX_INPUT_CHARS = 180_000
const MAX_SECTIONS = 24
const MAX_ITEMS_TOTAL = 2000 // we’ll still trim later in the caller if needed
const MAX_ITEMS_PER_SECTION = 600

export type Section = {
  name: string
  source?: string
  items: Array<{ name: string; price?: number | null; source?: string }>
}

export type MenuRich = {
  sections: Section[]
  metrics: {
    avg_ticket: number | null
    by_section: Record<string, { avg: number; count: number }>
  }
}

function clampText(t: string) {
  return t.length <= MAX_INPUT_CHARS ? t : t.slice(0, MAX_INPUT_CHARS)
}

// --- taxonomy helpers -------------------------------------------------------
const CANON_SECTIONS = [
  'Breakfast',
  'Brunch',
  'Lunch',
  'Dinner',
  'Appetizers',
  'Starters',
  'Raw Bar',
  'Soups',
  'Salads',
  'Sandwiches',
  'Burgers',
  'Tacos',
  'Pizza',
  'Pasta',
  'Sushi',
  'Nigiri & Sashimi',
  'Maki',
  'Special Rolls',
  'Entrees',
  'Mains',
  'Seafood',
  'Steaks',
  'BBQ',
  'Ramen',
  'Bowls',
  'Sides',
  'Kids',
  'Desserts',
  'Bakery',
  'Coffee',
  'Tea',
  'Juices & Smoothies',
  'Drinks',
  'Cocktails',
  'Beer',
  'Wine',
  'Spirits',
  'Happy Hour',
  'Combos',
  'Catering',
]

function canonicalizeSectionName(name: string): string {
  const s = (name || '').trim()
  if (!s) return 'Menu'
  // try exact matches first
  for (const c of CANON_SECTIONS) {
    if (s.toLowerCase() === c.toLowerCase()) return c
  }
  // light normalization
  const m = s.toLowerCase()
  if (/kid/.test(m)) return 'Kids'
  if (/dessert/.test(m)) return 'Desserts'
  if (/side/.test(m)) return 'Sides'
  if (/app(etizer)?|starter/.test(m)) return 'Appetizers'
  if (/entree|main/.test(m)) return 'Entrees'
  if (/cocktail/.test(m)) return 'Cocktails'
  if (/\bwine\b/.test(m)) return 'Wine'
  if (/\bbeer\b/.test(m)) return 'Beer'
  if (/\bspirits?\b/.test(m)) return 'Spirits'
  if (/\bpizza\b/.test(m)) return 'Pizza'
  if (/\bpasta\b/.test(m)) return 'Pasta'
  if (/\bsalad/.test(m)) return 'Salads'
  if (/\bsoup/.test(m)) return 'Soups'
  if (/\bbreakfast\b/.test(m)) return 'Breakfast'
  if (/\bbrunch\b/.test(m)) return 'Brunch'
  if (/\blunch\b/.test(m)) return 'Lunch'
  if (/\bdinner\b/.test(m)) return 'Dinner'
  if (/\bcoffee\b/.test(m)) return 'Coffee'
  if (/\btea\b/.test(m)) return 'Tea'
  if (/ramen/.test(m)) return 'Ramen'
  if (/bowl/.test(m)) return 'Bowls'
  if (/sushi/.test(m)) return 'Sushi'
  if (/roll/.test(m)) return 'Special Rolls'
  if (/nigiri|sashimi/.test(m)) return 'Nigiri & Sashimi'
  if (/burger/.test(m)) return 'Burgers'
  if (/sandwich/.test(m)) return 'Sandwiches'
  if (/taco/.test(m)) return 'Tacos'
  if (/seafood/.test(m)) return 'Seafood'
  if (/steak/.test(m)) return 'Steaks'
  if (/bbq/.test(m)) return 'BBQ'
  if (/happy\s*hour/.test(m)) return 'Happy Hour'
  if (/combo/.test(m)) return 'Combos'
  if (/cater/.test(m)) return 'Catering'
  if (/drink|beverage/.test(m)) return 'Drinks'
  // otherwise keep the original (title case)
  return s
}

// --- data cleaning ----------------------------------------------------------
function toNumberOrNull(x: any): number | null {
  if (typeof x === 'number' && Number.isFinite(x)) return Number(x)
  if (typeof x === 'string') {
    // strip currency symbol, spaces, commas
    const t = x.replace(/[^\d.]/g, '')
    if (!t) return null
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function dedupeItems(items: Array<{ name: string; price?: number | null; source?: string }>) {
  const seen = new Set<string>()
  const out: typeof items = []
  for (const it of items) {
    const name = (it?.name || '').trim()
    if (!name) continue
    const price = typeof it.price === 'number' ? it.price : null
    const key = (name + '|' + (price ?? '')).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ name, price, source: it?.source })
  }
  return out
}

function cleanSections(raw: any, originHost?: string): Section[] {
  if (!Array.isArray(raw)) return []
  const out: Section[] = []
  for (const s of raw) {
    const name = canonicalizeSectionName(String(s?.name || '').trim() || 'Menu')
    const secSource = s?.source ? String(s.source).trim() : undefined
    const itemsRaw = Array.isArray(s?.items) ? s.items : []
    const cleanedItems = itemsRaw
      .map((it: any) => ({
        name: String(it?.name || '').trim(),
        price: toNumberOrNull(it?.price),
        source: it?.source ? String(it.source).trim() : undefined,
      }))
      .filter((it: any) => it.name.length >= 2)
    const deduped = dedupeItems(cleanedItems).slice(0, MAX_ITEMS_PER_SECTION)
    if (deduped.length) {
      out.push({
        name,
        source: secSource || originHost,
        items: deduped,
      })
    }
  }
  return out.slice(0, MAX_SECTIONS)
}

function computeAvg(nums: number[]): number | null {
  if (!nums.length) return null
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length
  return Number(avg.toFixed(2))
}

function buildSafeMetrics(sections: Section[]): MenuRich['metrics'] {
  const by_section: Record<string, { avg: number; count: number }> = {}
  const all: number[] = []
  for (const sec of sections) {
    const prices = sec.items
      .map((i) => (typeof i.price === 'number' ? i.price : NaN))
      .filter((n) => Number.isFinite(n)) as number[]
    if (prices.length) {
      const avg = computeAvg(prices)
      // avg is number by construction
      by_section[sec.name] = { avg: avg as number, count: prices.length }
      all.push(...prices)
    }
  }
  return {
    avg_ticket: computeAvg(all),
    by_section,
  }
}
function renderSourcesList(
  sources?: Array<{ url: string; title?: string; source?: string }>,
): string {
  if (!sources || sources.length === 0) return '(none)'
  return sources
    .map((s) => `- ${s.url}${s.title ? ` (${s.title})` : ''}${s.source ? ` [${s.source}]` : ''}`)
    .join('\n')
}

// --- prompt builder ---------------------------------------------------------
function buildSystemPrompt() {
  return [
    'You are a *restaurant menu extraction* assistant.',
    'Input is a large text snapshot built from a restaurant website (HTML and/or PDFs).',
    'Your job: return *only* dishes and beverages that appear in the text, with prices when shown.',
    'Absolutely forbid invented items or prices. If price is not shown, use null.',
    'Handle ANY venue type: coffee shop, bar, fast-casual, QSR, fine dining, bakery, sushi, pizzeria, etc.',
    'Handle multiple separate menus (breakfast, brunch, lunch, dinner, bar, happy hour, kids, desserts). Keep them as separate *sections*.',
    'If the text looks like multiple menu pages or PDFs were combined, include all relevant sections.',
    'When obvious, attach a short source hint (hostname or path) per section and optionally per item.',
    'Return only strict JSON (no commentary).',
  ].join(' ')
}

function buildUserPrompt(
  combinedText: string,
  opts: {
    url?: string
    restaurantName?: string
    city?: string
    address?: string
    sources?: Array<{ url: string; title?: string; source?: string }>
  },
) {
  // We instruct the model to keep everything real and as complete as possible.
  const schema = `{
  "sections": [
    {
      "name": "Dinner",
      "source": "example.com/menu/dinner",
      "items": [
        { "name": "Margherita Pizza", "price": 15 },
        { "name": "Cacio e Pepe", "price": 22 },
        { "name": "Grilled Salmon", "price": 28 }
      ]
    },
    {
      "name": "Cocktails",
      "source": "example.com/menu/cocktails",
      "items": [
        { "name": "Old Fashioned", "price": 14 },
        { "name": "Negroni", "price": 13 }
      ]
    }
  ],
  "metrics": {
    "avg_ticket": 27.5,
    "by_section": {
      "Dinner": { "avg": 21.67, "count": 3 },
      "Cocktails": { "avg": 13.5, "count": 2 }
    }
  }
}`

  const rules = [
    '- Return *only* items present in the text snapshot.',
    '- Do not infer or invent missing menu items or prices.',
    '- If sizes/variants are listed (e.g., Small/Large), choose the most representative price or include multiple entries.',
    '- If the same dish appears in multiple sections, include it in each relevant section.',
    '- Keep section names as they appear (Dinner/Lunch/Brunch/Drinks/etc). If the name is non-standard, keep it (we canonicalize later).',
    '- Include as many valid items as possible; this is for analysis, not brevity.',
    '- Price must be a number (no currency symbols). If not shown, use null.',
    `- Hard cap: up to ${MAX_SECTIONS} sections and ${MAX_ITEMS_PER_SECTION} items per section.`,
  ].join('\n')

  const provenance = [
    `BUSINESS: ${opts.restaurantName ?? 'unknown'}`,
    `CITY: ${opts.city ?? 'unknown'}`,
    `ADDRESS: ${opts.address ?? 'unknown'}`,
    `ORIGIN URL (hint): ${opts.url ?? 'unknown'}`,
    '',
    'SNAPSHOT SOURCES (provenance):',
    renderSourcesList(opts.sources),
  ].join('\n')

  return [
    provenance,
    '',
    'TEXT SNAPSHOT START',
    clampText(combinedText),
    'TEXT SNAPSHOT END',
    '',
    'Extract a *complete* structured menu as strict JSON matching this shape:',
    schema,
    '',
    'Rules:',
    rules,
  ].join('\n')
}

// --- main API ---------------------------------------------------------------
export async function aiParseMenuRich(
  combinedText: string,
  opts: {
    url?: string
    restaurantName?: string
    city?: string
    address?: string
    sources?: Array<{ url: string; title?: string; source?: string }>
  } = {},
): Promise<MenuRich> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY missing')

  const client = new OpenAI({ apiKey })

  const system = buildSystemPrompt()
  const user = buildUserPrompt(combinedText, {
    url: opts.url,
    restaurantName: opts.restaurantName,
    city: opts.city,
    address: opts.address,
    sources: opts.sources,
  })

  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    top_p: 1,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
  })

  const txt = resp.choices?.[0]?.message?.content || '{}'
  let parsed: any = {}
  try {
    parsed = JSON.parse(txt)
  } catch {
    parsed = {}
  }

  // Sanitize + normalize
  const originHost = (() => {
    try {
      return opts.url ? new URL(opts.url).hostname : undefined
    } catch {
      return undefined
    }
  })()

  const rawSections = Array.isArray(parsed.sections) ? parsed.sections : []
  let sections = cleanSections(rawSections, originHost)

  // Trim totals
  if (sections.length > MAX_SECTIONS) sections = sections.slice(0, MAX_SECTIONS)
  const totalItems = sections.reduce((n, s) => n + s.items.length, 0)
  if (totalItems > MAX_ITEMS_TOTAL) {
    // simple truncation across sections to respect total cap
    let remaining = MAX_ITEMS_TOTAL
    sections = sections.map((s) => {
      if (remaining <= 0) return { ...s, items: [] }
      const take = Math.min(s.items.length, Math.max(0, remaining))
      remaining -= take
      return { ...s, items: s.items.slice(0, take) }
    })
  }

  // Build safe metrics (numbers only)
  const metrics = buildSafeMetrics(sections)

  return {
    sections,
    metrics,
  }
}
