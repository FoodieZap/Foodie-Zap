// app/api/search/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseRoute } from '@/utils/supabase/route'

import { NewSearchSchema } from '@/lib/validators'
import { gpTextSearch, gpPlaceDetails, gpCityCenter, gpNearbySearch } from '@/lib/external/google'
import { yelpSearch } from '@/lib/external/yelp'
import { fromGoogle, fromYelp, dedupeCompetitors, filterByRadius } from '@/lib/normalize'
import { haversine } from '@/lib/geo'

/** GET /api/search → list recent searches for the user */
export async function GET() {
  const supabase = createSupabaseRoute()

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
// weights you can tune later
function scoreItem(x: any, center: { lat: number; lng: number }) {
  const dist = x.lat && x.lng ? haversine(center, { lat: x.lat, lng: x.lng }) : 999999
  const rating = x.rating ?? 0
  // Higher rating, closer distance = better score
  const ratingComponent = rating / 5 // 0..1
  const distanceComponent = Math.max(0, 1 - dist / 3000) // 3km sweet spot
  return ratingComponent * 0.7 + distanceComponent * 0.3
}

function applyFilters<
  T extends { lat?: number | null; lng?: number | null; rating?: number | null },
>(
  list: T[],
  center: { lat: number; lng: number },
  opts: { minRating?: number; maxDistanceMeters?: number } = {},
) {
  const { minRating = 0, maxDistanceMeters } = opts
  return list.filter((x) => {
    const r = x.rating ?? 0
    const okRating = r >= minRating

    if (!maxDistanceMeters) return okRating

    const hasCoords =
      typeof x.lat === 'number' &&
      typeof x.lng === 'number' &&
      !Number.isNaN(x.lat) &&
      !Number.isNaN(x.lng)

    if (!hasCoords) return false

    const d = haversine(center, { lat: x.lat as number, lng: x.lng as number })
    return okRating && d <= maxDistanceMeters
  })
}

/** POST /api/search → create search, fetch competitors, insert rows */
export async function POST(req: Request) {
  const supabase = createSupabaseRoute()

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

    // ====== NEW: filters + scoring on competitors ======
    const { minRating, maxDistanceMeters } = parsed.data as {
      minRating?: number
      maxDistanceMeters?: number
    }

    // Apply rating + (if we have a center) distance filter
    // If we don't have a center, distance filtering won't run (only rating will).
    const filteredCompetitors = center
      ? applyFilters(scoped, center, { minRating, maxDistanceMeters })
      : applyFilters(scoped, { lat: 0, lng: 0 } as any, { minRating })

    // Score (when center exists) and sort descending
    const rankedCompetitors = (
      center
        ? filteredCompetitors.map((c: any) => ({ ...c, _score: scoreItem(c, center) }))
        : filteredCompetitors.map((c: any) => ({ ...c, _score: null }))
    ).sort((a: any, b: any) => {
      if (a._score == null && b._score == null) return 0
      if (a._score == null) return 1
      if (b._score == null) return -1
      return b._score - a._score
    })
    // ================================================
    // After you have "center" and before you insert competitors (or before final update):
    if (center) {
      await supabase
        .from('searches')
        .update({ latitude: center.lat, longitude: center.lng })
        .eq('id', search.id)
    }

    // Insert into DB only if we have something after filtering
    if (rankedCompetitors.length) {
      const payload = rankedCompetitors.map((c: any) => ({
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
        lat: c.lat ?? null,
        lng: c.lng ?? null,
        data: c.data ?? null,
        // Optional: persist score for debugging / analytics (if you added a column)
        // score: c._score ?? null,
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
