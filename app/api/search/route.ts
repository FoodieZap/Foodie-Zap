// app/api/search/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { type CookieOptions, createServerClient } from '@supabase/ssr'
import { NewSearchSchema } from '@/lib/validators'
import { gpTextSearch, gpPlaceDetails, gpCityCenter, gpNearbySearch } from '@/lib/external/google'
import { yelpSearch } from '@/lib/external/yelp'
import { fromGoogle, fromYelp, dedupeCompetitors, filterByRadius } from '@/lib/normalize'

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

/** GET /api/search → list recent searches for the user */
export async function GET() {
  const supabase = serverClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('searches')
    .select('id, query, city, status, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ searches: data })
}

/** POST /api/search → create search, fetch competitors, insert rows */
export async function POST(req: Request) {
  const supabase = serverClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Validate input
  const body = await req.json().catch(() => null)
  const parsed = NewSearchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.format() },
      { status: 400 },
    )
  }
  const { query, city } = parsed.data

  // ---- Rate limit (per user/day, env-configurable, dev bypass) ----
  const LIMIT = Number(process.env.SEARCH_DAILY_LIMIT ?? '30')
  const BYPASS = process.env.NODE_ENV !== 'production' && process.env.SEARCH_LIMIT_BYPASS === 'true'

  if (!BYPASS) {
    const startOfDayIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
    const { count } = await supabase
      .from('searches')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', startOfDayIso)
    if ((count ?? 0) >= LIMIT) {
      return NextResponse.json({ error: 'Daily search limit reached' }, { status: 429 })
    }
  }
  // -----------------------------------------------------------------

  // Create the search row
  const { data: search, error: insErr } = await supabase
    .from('searches')
    .insert({ user_id: user.id, query, city, status: 'pending' })
    .select('id')
    .single()

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 400 })
  }

  // Mock mode (fast demo)
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

  // Real fetch (Google + Yelp, radius scoped)
  try {
    const gpKey = process.env.GOOGLE_PLACES_API_KEY!
    const yelpKey = process.env.YELP_API_KEY!
    const radiusKm = Number(process.env.SEARCH_RADIUS_KM ?? '15')
    const radiusM = Math.min(Math.max(Math.floor(radiusKm * 1000), 1000), 40000)

    // 1) City center
    const center = await gpCityCenter(city, gpKey).catch(() => null)

    // 2) Google results (Nearby preferred, fallback to Text)
    let gpResults: any[] = []
    if (center) {
      gpResults = await gpNearbySearch(query, center, radiusM, gpKey)
      if (!gpResults.length) {
        const text = await gpTextSearch(query, city, gpKey)
        gpResults = text
      }
    } else {
      gpResults = await gpTextSearch(query, city, gpKey)
    }

    const gpComps = await Promise.all(
      gpResults.map(async (t: any) => {
        const d = await gpPlaceDetails(t.place_id, gpKey)
        return fromGoogle(t, d)
      }),
    )

    // 3) Yelp (coords first, fallback to string; fail-soft)
    let yelpComps: any[] = []
    if (yelpKey) {
      if (center) {
        yelpComps = (
          await yelpSearch(query, center, yelpKey, { radius: radiusM, locale: 'en_US' })
        ).map(fromYelp)
        if (!yelpComps.length) {
          yelpComps = (await yelpSearch(query, city, yelpKey, { locale: 'en_US' })).map(fromYelp)
        }
      } else {
        yelpComps = (await yelpSearch(query, city, yelpKey, { locale: 'en_US' })).map(fromYelp)
      }
    }

    // 4) Merge, dedupe, and hard-filter to radius if we have a center
    const merged = dedupeCompetitors([...gpComps, ...yelpComps])
    const scoped = center ? filterByRadius(merged, center, radiusKm) : merged

    // if (scoped.length) {
    //   await supabase.from('competitors').insert(scoped.map((c) => ({ ...c, search_id: search.id })))
    // }
    // NEW — paste this block
    if (scoped.length) {
      const payload = scoped.map((c) => ({
        search_id: search.id,
        source: c.source,
        place_id: c.place_id ?? null,
        name: c.name ?? null,
        address: c.address ?? null,
        phone: c.phone ?? null,
        website: c.website ?? null,
        rating: c.rating ?? null,
        review_count: c.review_count ?? null,
        price_level: c.price_level ?? null,
        cuisine: c.cuisine ?? null,
        lat: c.lat ?? null, // requires DB columns lat/lng (see Step 1)
        lng: c.lng ?? null,
        data: c.data ?? null,
      }))

      const { error: insertErr } = await supabase.from('competitors').insert(payload)
      if (insertErr) {
        await supabase
          .from('searches')
          .update({ status: 'error', error: `insert competitors: ${insertErr.message}` })
          .eq('id', search.id)

        return NextResponse.json(
          { id: search.id, status: 'error', error: insertErr.message },
          { status: 500 },
        )
      }
    }

    await supabase.from('searches').update({ status: 'ok' }).eq('id', search.id)
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      route: '/api/search',
      status: 200,
      meta: { query, city, inserted: scoped.length, radius_km: radiusKm },
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
