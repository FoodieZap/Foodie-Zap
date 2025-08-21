// app/api/export-csv/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseRoute } from '@/utils/supabase/route'
import { haversine } from '@/lib/geo' // you already use this in /api/search

function toPriceSymbols(input?: string | null) {
  // Normalize price level to $, $$, $$$, or blank
  if (!input) return ''
  const s = String(input).trim()
  if (/^\$+$/.test(s)) return s
  // Sometimes APIs give "1","2","3" – map those
  if (s === '1') return '$'
  if (s === '2') return '$$'
  if (s === '3') return '$$$'
  if (s === '4') return '$$$$'
  return s
}

function formatPhone(raw?: string | null) {
  if (!raw) return ''
  const digits = raw.replace(/[^\d+]/g, '')
  // Leave international numbers as-is if they start with '+'
  if (digits.startsWith('+')) return digits
  // Try to format as US‑style if 10 digits, else return cleaned
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return digits
}

function hostname(url?: string | null) {
  if (!url) return ''
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function csvEscape(v: unknown) {
  const s = v == null ? '' : String(v)
  return `"${s.replace(/"/g, '""')}"`
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const searchId = searchParams.get('searchId') ?? searchParams.get('search_id')
  if (!searchId) {
    return NextResponse.json({ error: 'searchId is required' }, { status: 400 })
  }
  const includeLatLng = searchParams.get('raw') === 'true' // optional: ?raw=true to include lat/lng

  if (!searchId) {
    return NextResponse.json({ error: 'Missing search_id' }, { status: 400 })
  }

  const supabase = await createSupabaseRoute()

  // auth check (RLS still protects rows)
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // fetch the search to get center (for distance)
  const { data: search } = await supabase
    .from('searches')
    .select('id, city, latitude, longitude, created_at')
    .eq('id', searchId)
    .single()

  // fetch competitors for this search_id
  const { data: comps, error } = await supabase
    .from('competitors')
    .select(
      'id, name, source, rating, review_count, price_level, address, phone, website, lat, lng',
    )
    .eq('search_id', searchId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const center =
    search && typeof search.latitude === 'number' && typeof search.longitude === 'number'
      ? { lat: search.latitude as number, lng: search.longitude as number }
      : null

  // compute distance & prepare rows
  const prepared = (comps ?? []).map((c) => {
    const dist_m =
      center && typeof c.lat === 'number' && typeof c.lng === 'number'
        ? haversine(center, { lat: c.lat as number, lng: c.lng as number })
        : null

    return {
      // for sorting
      _rating: typeof c.rating === 'number' ? c.rating : 0,
      _reviews: typeof c.review_count === 'number' ? c.review_count : 0,
      _dist: typeof dist_m === 'number' ? dist_m : Number.POSITIVE_INFINITY,

      Name: c.name ?? '',
      Rating: typeof c.rating === 'number' ? Number(c.rating.toFixed(1)) : '',
      Reviews: c.review_count ?? '',
      Price: toPriceSymbols(c.price_level),
      Address: c.address ?? '',
      Phone: formatPhone(c.phone),
      Website: hostname(c.website),
      'Distance (km)': typeof dist_m === 'number' ? (dist_m / 1000).toFixed(1) : '',
      Source: c.source ?? '',
      ...(includeLatLng ? { Lat: c.lat ?? '', Lng: c.lng ?? '' } : {}),
    }
  })

  // human‑friendly sort: rating desc, reviews desc, distance asc
  const sorted = prepared.sort((a, b) => {
    if (b._rating !== a._rating) return b._rating - a._rating
    if (b._reviews !== a._reviews) return b._reviews - a._reviews
    return a._dist - b._dist
  })

  // add Rank
  const rowsWithRank = sorted.map((r, i) => {
    const { _rating, _reviews, _dist, ...rest } = r
    return { Rank: i + 1, ...rest }
  })

  // headers
  const headers = Object.keys(
    rowsWithRank[0] ?? {
      Rank: '',
      Name: '',
      Rating: '',
      Reviews: '',
      Price: '',
      Address: '',
      Phone: '',
      Website: '',
      'Distance (km)': '',
      Source: '',
    },
  )

  // build CSV
  const csvLines = [
    headers.join(','), // header row
    ...rowsWithRank.map((row) => headers.map((h) => csvEscape((row as any)[h])).join(',')),
  ]
  const csv = csvLines.join('\n')

  const fileNameCity = search?.city
    ? search.city.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
    : 'city'
  const fileName = `results-${fileNameCity}-${searchId}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
