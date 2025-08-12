const GP_BASE = 'https://maps.googleapis.com/maps/api/place'

type GPTextResult = {
  place_id: string
  name?: string
  formatted_address?: string
  rating?: number
  user_ratings_total?: number
  price_level?: number
  geometry?: { location: { lat: number; lng: number } }
}

type GPDetailResult = {
  formatted_phone_number?: string
  website?: string
  types?: string[]
}

export async function gpTextSearch(query: string, city: string, apiKey: string) {
  // Bias by city name; we will still post-filter by radius later.
  const q = encodeURIComponent(`${query} ${city}`)
  const url = `${GP_BASE}/textsearch/json?query=${q}&key=${apiKey}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error('Google TextSearch failed')
  const json = await res.json()
  const results = (json.results ?? []) as GPTextResult[]
  return results.slice(0, 20)
}

// include formatted_address (and intl phone) in details fields
export async function gpPlaceDetails(placeId: string, apiKey: string) {
  const fields = [
    'formatted_phone_number',
    'international_phone_number',
    'website',
    'types',
    'formatted_address', // <-- add this
  ].join(',')
  const url = `${GP_BASE}/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error('Google PlaceDetails failed')
  const json = await res.json()
  return (json.result ?? {}) as GPDetailResult
}

/** Get city center coordinates via Text Search */
export async function gpCityCenter(city: string, apiKey: string) {
  const q = encodeURIComponent(city)
  const url = `${GP_BASE}/textsearch/json?query=${q}&type=locality&key=${apiKey}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const json = await res.json()
  const first = json.results?.[0]
  const loc = first?.geometry?.location
  if (loc?.lat != null && loc?.lng != null) return { lat: loc.lat, lng: loc.lng }
  return null
}

/** Strictly bound Google results to a radius around a center */
export async function gpNearbySearch(
  keyword: string,
  center: { lat: number; lng: number },
  radiusMeters: number,
  apiKey: string,
) {
  const url = `${GP_BASE}/nearbysearch/json?location=${center.lat},${
    center.lng
  }&radius=${radiusMeters}&keyword=${encodeURIComponent(keyword)}&key=${apiKey}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error('Google NearbySearch failed')
  const json = await res.json()
  const results = (json.results ?? []) as GPTextResult[]
  return results.slice(0, 20)

  // add 'vicinity' to GPTextResult so we can use it as fallback
  type GPTextResult = {
    place_id: string
    name?: string
    formatted_address?: string
    vicinity?: string
    rating?: number
    user_ratings_total?: number
    price_level?: number
    geometry?: { location: { lat: number; lng: number } }
  }
}
