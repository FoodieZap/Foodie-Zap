// lib/menu/fetcher.ts
// Swap this later with Apify/Yelp scraping. Keep the shape the same.

export type NormalizedMenu = {
  avg_price: number | null
  top_items: Array<{ name: string; price?: number | null; mentions?: number | null }>
  source: string
}

export async function fetchMenuForPlace(
  name: string | null,
  address: string | null,
  opts?: { cityHint?: string },
): Promise<NormalizedMenu | null> {
  // TODO: replace with real API call (Apify)
  // For now, return a plausible placeholder so UI flows work end-to-end.
  if (!name) return null

  // Fake data example
  return {
    avg_price: 12.25,
    top_items: [
      { name: 'Latte', price: 5.5, mentions: 42 },
      { name: 'Cappuccino', price: 5.0, mentions: 35 },
      { name: 'Americano', price: 4.2, mentions: 28 },
    ],
    source: 'placeholder',
  }
}
