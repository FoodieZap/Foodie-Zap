const YELP_BASE = 'https://api.yelp.com/v3'

type YelpBusiness = {
  id: string
  name?: string
  location?: { address1?: string; city?: string }
  display_phone?: string
  rating?: number
  review_count?: number
  price?: string
  categories?: { title: string }[]
  url?: string
  coordinates?: { latitude?: number; longitude?: number }
}

type Coords = { lat: number; lng: number }

export async function yelpSearch(
  term: string,
  loc: string | Coords,
  apiKey: string,
  opts?: { radius?: number; locale?: string },
) {
  const params = new URLSearchParams({ term, limit: '12' })
  if (typeof loc === 'string') {
    params.set('location', loc)
  } else {
    params.set('latitude', String(loc.lat))
    params.set('longitude', String(loc.lng))
    params.set('radius', String(opts?.radius ?? 10000)) // 10km default
  }
  if (opts?.locale) params.set('locale', opts.locale)

  try {
    const res = await fetch(`${YELP_BASE}/businesses/search?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    })
    if (!res.ok) return [] as YelpBusiness[]
    const json = await res.json()
    return (json.businesses ?? []) as YelpBusiness[]
  } catch {
    return [] as YelpBusiness[]
  }
}
