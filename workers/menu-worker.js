// workers/menu-worker.js

const cheerio = require('cheerio')
const { createClient } = require('@supabase/supabase-js')

// --- ENV ---
const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env')
  process.exit(1)
}

// Supabase client with service role (server-only)
const sb = createClient(SUPABASE_URL, SERVICE_ROLE)

// Basic desktop UA
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'

// ---- Queue helpers ----
async function pickJob() {
  const { data, error } = await sb
    .from('menu_jobs')
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('pickJob error:', error.message)
    return null
  }
  return data || null
}

async function updateJob(id, patch) {
  const { error } = await sb.from('menu_jobs').update(patch).eq('id', id)
  if (error) console.error('updateJob error:', error.message)
}

// ---- Scraper (simple, fast, no Apify) ----
async function parseHttp(url) {
  const controller = new AbortController()
  const to = setTimeout(() => controller.abort(), 15000)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    const $ = cheerio.load(html)

    // 1) Try schema.org Menus in JSON-LD
    let items = []
    $('script[type="application/ld+json"]').each((_, s) => {
      try {
        const data = JSON.parse($(s).contents().text())
        const arr = Array.isArray(data) ? data : [data]
        for (const d of arr) {
          if (d && d['@type'] === 'Menu' && Array.isArray(d.hasMenuSection)) {
            for (const sec of d.hasMenuSection) {
              if (Array.isArray(sec.hasMenuItem)) {
                for (const it of sec.hasMenuItem) {
                  const name = String(it?.name || '').trim()
                  if (name) items.push({ name })
                }
              }
            }
          }
        }
      } catch {}
    })

    // 2) Fallback: visible text “name $price” style
    if (!items.length) {
      const body = $('body').text()
      const lines = body
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean)
      const seen = new Set()
      for (const line of lines) {
        // capture a readable chunk preceding the first price-like token
        const m = line.match(/(.{3,60})\s(?:[$€£]\s?\d{1,3}(?:[.,]\d{2})?)/)
        if (m && m[1]) {
          const name = m[1].replace(/\s+/g, ' ').trim()
          if (name && !seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase())
            items.push({ name })
            if (items.length >= 12) break
          }
        }
      }
    }

    // 3) Rough avg price
    const prices = (html.match(/[$€£]\s?\d{1,3}(?:[.,]\d{2})?/g) || [])
      .map((s) => Number(s.replace(/[^0-9.]/g, '')))
      .filter((n) => n > 1 && n < 500)

    const avg_price = prices.length
      ? Number((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2))
      : null

    return {
      avg_price,
      top_items: items.slice(0, 10),
    }
  } finally {
    clearTimeout(to)
  }
}

async function handleJob(job) {
  await updateJob(job.id, { status: 'running' })
  try {
    const out = await parseHttp(job.url)

    const { error: upErr } = await sb.from('menus').upsert(
      {
        user_id: job.user_id,
        competitor_id: job.competitor_id,
        avg_price: out.avg_price,
        top_items: out.top_items,
        fetched_at: new Date().toISOString(),
        source: job.provider,
      },
      { onConflict: 'user_id,competitor_id' },
    )
    if (upErr) throw new Error(upErr.message)

    await updateJob(job.id, { status: 'done', error: null })
  } catch (e) {
    await updateJob(job.id, { status: 'failed', error: String(e?.message || e).slice(0, 500) })
  }
}

async function loop() {
  try {
    const job = await pickJob()
    if (job) await handleJob(job)
  } catch (e) {
    console.error('worker loop error:', e?.message || e)
  } finally {
    setTimeout(loop, 2000)
  }
}

console.log('Menu worker started.')
loop()
