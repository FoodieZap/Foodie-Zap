// lib/openaiWeb.ts
import OpenAI from 'openai'

type MenuSource = 'brand' | 'menu_hub' | 'map' | 'news' | 'other'
export type WebMenuUrl = { url: string; title?: string; source?: MenuSource }

/**
 * Uses OpenAI Responses + built-in web_search to find the BEST candidate menu URLs
 * across the public internet, prioritizing brand-owned sites and real menus (HTML/PDF/images).
 */
export async function aiWebSearchMenuUrls(args: {
  name: string
  city?: string
  address?: string
  website?: string
}): Promise<WebMenuUrl[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY missing')

  const client = new OpenAI({ apiKey })

  // Build a tight instruction for JSON-only output
  const sys =
    'You are a web research agent that finds restaurant menu URLs. Prefer brand-owned pages, then menu hubs (ToastTab, Square, BentoBox, SpotHopper, Popmenu), then PDFs/images hosted by the brand, then reputable maps when they host FULL menus. Exclude delivery marketplaces (DoorDash, UberEats, Grubhub, Postmates) unless they are the ONLY available full menu. Return strict JSON only.'

  const qParts = [args.name]
  if (args.city) qParts.push(args.city)
  if (args.address) qParts.push(args.address)
  const query = qParts.filter(Boolean).join(' ')

  const user = [
    `Find public internet pages that contain the FULL restaurant/cafe menu for: ${query}.`,
    args.website ? `Official website hint: ${args.website}` : '',
    '',
    'Rules:',
    '- Return 6–12 high-quality URLs.',
    '- Prioritize: brand menu pages, “/menu” URLs, PDFs, order pages (ToastTab, Square, BentoBox, SpotHopper, Popmenu).',
    '- Include menu images/PDFs if present.',
    '- Only include Yelp/Google if they embed full image/PDF menus or deep-linked hosted menus.',
    '- Avoid pure “locations” index pages.',
    '- Exclude marketplaces (DoorDash/UberEats/Grubhub/Postmates) unless NO other source shows a full menu.',
    '- Prefer location-specific pages matching the given city/address.',
    '',
    'Return strict JSON only in this shape:',
    `{"urls":[{"url":"https://...","title":"...","source":"brand|menu_hub|map|news|other"}]}`,
  ]
    .filter(Boolean)
    .join('\n')

  const resp = await client.responses.create({
    model: 'gpt-4o',
    tools: [{ type: 'web_search_preview' }],
    tool_choice: { type: 'web_search_preview' }, // <-- must be an object, not a string
    input: [
      { role: 'system', content: [{ type: 'input_text', text: sys }] },
      { role: 'user', content: [{ type: 'input_text', text: user }] },
    ],
  })

  // The Responses API exposes a convenience accessor:
  const txt = (resp as any).output_text?.trim?.() || ''
  if (!txt) return []

  let parsed: any
  try {
    parsed = JSON.parse(txt)
  } catch {
    return []
  }

  const arr = Array.isArray(parsed?.urls) ? parsed.urls : []
  const out: WebMenuUrl[] = []
  for (const u of arr) {
    if (!u || typeof u !== 'object') continue
    const href = typeof u.url === 'string' ? u.url.trim() : ''
    if (!href) continue
    out.push({
      url: href,
      title: typeof u.title === 'string' ? u.title.trim() : undefined,
      source:
        u.source === 'brand' ||
        u.source === 'menu_hub' ||
        u.source === 'map' ||
        u.source === 'news' ||
        u.source === 'other'
          ? u.source
          : undefined,
    })
  }
  return out
}
