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
}

export async function yelpSearch(term: string, location: string, apiKey: string) {
  const params = new URLSearchParams({ term, location, limit: '12' })
  const res = await fetch(`${YELP_BASE}/businesses/search?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Yelp Search failed')
  const json = await res.json()
  return (json.businesses ?? []) as YelpBusiness[]
}

export async function yelpDetails(id: string, apiKey: string) {
  const res = await fetch(`${YELP_BASE}/businesses/${id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Yelp Details failed')
  return (await res.json()) as YelpBusiness
}
