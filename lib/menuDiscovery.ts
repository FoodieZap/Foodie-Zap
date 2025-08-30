// lib/menuDiscovery.ts
import * as cheerio from 'cheerio'
import type { Provider } from './menuTargets'

export type Discovered = { url: string; provider: Provider }

const PROVIDER_PATTERNS: Array<[Provider, RegExp]> = [
  ['yelp', /https?:\/\/(www\.)?yelp\.com\/(?:biz|menu)\/[^\s"']+/i],
  ['doordash', /https?:\/\/(www\.)?doordash\.com\/[^\s"']+/i],
  ['ubereats', /https?:\/\/(www\.)?ubereats\.com\/[^\s"']+/i],
  ['grubhub', /https?:\/\/(www\.)?grubhub\.com\/[^\s"']+/i],
  ['toast', /https?:\/\/(www\.)?toasttab\.com\/[^\s"']+/i],
  ['square', /https?:\/\/(www\.)?square\.site\/[^\s"']+/i],
  ['clover', /https?:\/\/(www\.)?clover\.com\/[^\s"']+/i],
  ['menu', /\/menu(\/|$|\?)/i],
]

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'

export async function discoverMenuLinks(siteUrl: string, timeoutMs = 8000): Promise<Discovered[]> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(siteUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
    })
    const html = await res.text()
    const $ = cheerio.load(html)

    const candidates = new Set<string>()
    $('a[href]').each((_, a) => {
      const href = String($(a).attr('href') || '').trim()
      if (!href) return
      const abs = new URL(href, siteUrl).toString()
      candidates.add(abs)
    })
    $('script[type="application/ld+json"]').each((_, s) => {
      try {
        const data = JSON.parse($(s).contents().text())
        const urls = JSON.stringify(data).match(/https?:\/\/[^\s"']+/g) || []
        urls.forEach((u) => candidates.add(u))
      } catch {}
    })

    const out: Discovered[] = []
    for (const href of candidates) {
      for (const [provider, re] of PROVIDER_PATTERNS) {
        if (re.test(href)) {
          out.push({ url: href, provider })
          break
        }
      }
    }
    return out.length ? out : [{ url: siteUrl, provider: 'site' }]
  } catch {
    return [{ url: siteUrl, provider: 'site' }]
  } finally {
    clearTimeout(id)
  }
}
