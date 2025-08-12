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
  data?: any
}

export function fromGoogle(text: any, details: any): Competitor {
  return {
    source: 'google',
    place_id: text.place_id,
    name: text.name,
    address: text.formatted_address,
    phone: details?.formatted_phone_number,
    website: details?.website,
    rating: text.rating,
    review_count: text.user_ratings_total,
    price_level: text.price_level != null ? '$'.repeat(Number(text.price_level)) : undefined,
    cuisine: Array.isArray(details?.types) ? details.types[0] : undefined,
    data: { text, details },
  }
}

export function fromYelp(biz: any): Competitor {
  return {
    source: 'yelp',
    place_id: biz.id,
    name: biz.name,
    address: [biz.location?.address1, biz.location?.city].filter(Boolean).join(', '),
    phone: biz.display_phone,
    website: biz.url,
    rating: biz.rating,
    review_count: biz.review_count,
    price_level: biz.price,
    cuisine: biz.categories?.[0]?.title,
    data: biz,
  }
}

/** naive dedupe: keep unique by website or name+address */
export function dedupeCompetitors(list: Competitor[]): Competitor[] {
  const seen = new Set<string>()
  const out: Competitor[] = []
  for (const c of list) {
    const key = (c.website?.toLowerCase() ||
      `${c.name?.toLowerCase()}|${c.address?.toLowerCase()}`)!
    if (key && !seen.has(key)) {
      seen.add(key)
      out.push(c)
    }
  }
  return out
}

// export function normalizeCompetitors(raw: Competitor[]): Competitor[] {
//   return raw
// }
