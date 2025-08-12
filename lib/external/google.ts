const GP_BASE = 'https://maps.googleapis.com/maps/api/place'

type GPTextResult = {
  place_id: string
  name?: string
  formatted_address?: string
  rating?: number
  user_ratings_total?: number
  price_level?: number
}

type GPDetailResult = {
  formatted_phone_number?: string
  website?: string
  types?: string[]
}

export async function gpTextSearch(query: string, city: string, apiKey: string) {
  const q = encodeURIComponent(`${query} ${city}`)
  const url = `${GP_BASE}/textsearch/json?query=${q}&key=${apiKey}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error('Google TextSearch failed')
  const json = await res.json()
  const results = (json.results ?? []) as GPTextResult[]
  return results.slice(0, 12)
}

export async function gpPlaceDetails(placeId: string, apiKey: string) {
  const fields = ['formatted_phone_number', 'website', 'types'].join(',')
  const url = `${GP_BASE}/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error('Google PlaceDetails failed')
  const json = await res.json()
  return (json.result ?? {}) as GPDetailResult
}
