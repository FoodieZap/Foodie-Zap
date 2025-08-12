import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { type CookieOptions, createServerClient } from '@supabase/ssr'
import { NewSearchSchema } from '@/lib/validators'
import { gpTextSearch, gpPlaceDetails } from '@/lib/external/google'
import { yelpSearch, yelpDetails } from '@/lib/external/yelp'
import { fromGoogle, fromYelp, dedupeCompetitors } from '@/lib/normalize'

const DAILY_LIMIT = 30

function serverClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(n: string) {
          return cookieStore.get(n)?.value
        },
        set(n: string, v: string, o: CookieOptions) {
          cookieStore.set({ name: n, value: v, ...o })
        },
        remove(n: string, o: CookieOptions) {
          cookieStore.set({ name: n, value: '', ...o })
        },
      },
    },
  )
}

export async function POST(req: Request) {
  const supabase = serverClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = NewSearchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.format() },
      { status: 400 },
    )
  }
  const { query, city } = parsed.data

  // rate limit (primitive)
  const { count } = await supabase
    .from('searches')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
  if ((count ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json({ error: 'Daily search limit reached' }, { status: 429 })
  }

  // create the search row
  const { data: search, error: insErr } = await supabase
    .from('searches')
    .insert({ user_id: user.id, query, city, status: 'pending' })
    .select('id')
    .single()
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })

  // MOCK shortcut
  if (process.env.MOCK_MODE === 'true') {
    await supabase.from('competitors').insert([
      {
        search_id: search.id,
        source: 'google',
        place_id: 'g_demo_1',
        name: 'Cafe Demo',
        address: '123 Main St',
        rating: 4.5,
        review_count: 812,
        price_level: '$$',
        cuisine: 'Cafe',
        data: { demo: true },
      },
      {
        search_id: search.id,
        source: 'yelp',
        place_id: 'y_demo_2',
        name: 'Brew Bros',
        address: '456 Oak Ave',
        rating: 4.2,
        review_count: 410,
        price_level: '$$',
        cuisine: 'Cafe',
        data: { demo: true },
      },
    ])
    await supabase.from('searches').update({ status: 'ok' }).eq('id', search.id)
    return NextResponse.json({ id: search.id, status: 'ok' })
  }

  // REAL fetch
  try {
    const gpKey = process.env.GOOGLE_PLACES_API_KEY!
    const yelpKey = process.env.YELP_API_KEY!

    // Google: text search → details per place
    const gpText = await gpTextSearch(query, city, gpKey)
    const gpComps = await Promise.all(
      gpText.map(async (t) => {
        const d = await gpPlaceDetails(t.place_id, gpKey)
        return fromGoogle(t, d)
      }),
    )

    // Yelp: search → details per biz (optional; often not needed)
    const yelpBiz = await yelpSearch(query, city, yelpKey)
    // (details call is optional; skipping for speed)
    const yelpComps = yelpBiz.map(fromYelp)

    // merge, dedupe, then insert
    const all = dedupeCompetitors([...gpComps, ...yelpComps])
    if (all.length) {
      await supabase.from('competitors').insert(all.map((c) => ({ ...c, search_id: search.id })))
    }

    await supabase.from('searches').update({ status: 'ok' }).eq('id', search.id)

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      route: '/api/search',
      status: 200,
      meta: { query, city, inserted: all.length },
    })

    return NextResponse.json({ id: search.id, status: 'ok' })
  } catch (e: any) {
    await supabase
      .from('searches')
      .update({ status: 'error', error: e?.message ?? 'fetch failed' })
      .eq('id', search.id)
    return NextResponse.json({ id: search.id, status: 'error', error: e?.message }, { status: 500 })
  }
}
