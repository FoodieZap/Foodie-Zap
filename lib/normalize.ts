export type Competitor = {
  id?: string;
  source: 'google' | 'yelp';
  place_id?: string;
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  review_count?: number;
  price_level?: string;
  cuisine?: string;
  data?: any;
};

export function normalizeGooglePlace(p: any): Competitor {
  return {
    source: 'google',
    place_id: p.place_id,
    name: p.name,
    address: p.formatted_address,
    phone: p.formatted_phone_number,
    website: p.website,
    rating: p.rating,
    review_count: p.user_ratings_total,
    price_level: p.price_level != null ? '$'.repeat(p.price_level) : undefined,
    cuisine: p.types?.[0],
    data: p
  };
}

export function normalizeYelp(b: any): Competitor {
  return {
    source: 'yelp',
    place_id: b.id,
    name: b.name,
    address: b.location?.display_address?.join(', '),
    phone: b.display_phone,
    website: b.url,
    rating: b.rating,
    review_count: b.review_count,
    price_level: b.price,
    cuisine: b.categories?.[0]?.title,
    data: b
  };
}
