export type Competitor = {
  source: 'google' | 'yelp'
  place_id?: string
  name?: string
  address?: string
  phone?: string
  website?: string
  rating?: number
  review_count?: number
  price_level?: string
  cuisine?: string
  lat?: number
  lng?: number
  data?: any
}

export function fromGoogle(text: any, details: any): Competitor {
  const loc = text?.geometry?.location
  const address =
    text?.formatted_address ||
    text?.vicinity || // Nearby Search fallback
    details?.formatted_address || // Details fallback
    undefined

  const phone = details?.formatted_phone_number || details?.international_phone_number

  return {
    source: 'google',
    place_id: text.place_id,
    name: text.name,
    address,
    phone,
    website: details?.website,
    rating: text.rating,
    review_count: text.user_ratings_total,
    price_level: text.price_level != null ? '$'.repeat(Number(text.price_level)) : undefined,
    cuisine: Array.isArray(details?.types) ? details.types[0] : undefined,
    lat: loc?.lat,
    lng: loc?.lng,
    data: { text, details },
  }
}

export function fromYelp(biz: any): Competitor {
  const coords = biz?.coordinates
  const displayAddress = Array.isArray(biz?.location?.display_address)
    ? biz.location.display_address.join(', ')
    : undefined

  const address =
    displayAddress ||
    [biz.location?.address1, biz.location?.city].filter(Boolean).join(', ') || // fallback
    undefined

  return {
    source: 'yelp',
    place_id: biz.id,
    name: biz.name,
    address,
    phone: biz.display_phone,
    website: biz.url,
    rating: biz.rating,
    review_count: biz.review_count,
    price_level: biz.price,
    cuisine: biz.categories?.[0]?.title,
    lat: coords?.latitude,
    lng: coords?.longitude,
    data: biz,
  }
}

/** naive dedupe: keep unique by website or name+address */
export function dedupeCompetitors(list: Competitor[]): Competitor[] {
  const seen = new Set<string>()
  const out: Competitor[] = []
  for (const c of list) {
    const key =
      (c.website?.toLowerCase() || `${c.name?.toLowerCase()}|${c.address?.toLowerCase()}`) ?? ''
    if (key && !seen.has(key)) {
      seen.add(key)
      out.push(c)
    }
  }
  return out
}

/** Distance (km) between two lat/lng points */
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const sLat1 = Math.sin(dLat / 2),
    sLng1 = Math.sin(dLng / 2)
  const aa =
    sLat1 * sLat1 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sLng1 * sLng1
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(aa)))
}

/** Keep only competitors within radiusKm of center; drop those without coords */
export function filterByRadius(
  list: Competitor[],
  center: { lat: number; lng: number },
  radiusKm: number,
) {
  return list.filter(
    (c) =>
      c.lat != null &&
      c.lng != null &&
      haversineKm(center, { lat: c.lat!, lng: c.lng! }) <= radiusKm,
  )
}

// export function normalizeCompetitors(raw: Competitor[]): Competitor[] {
//   return raw
// }
