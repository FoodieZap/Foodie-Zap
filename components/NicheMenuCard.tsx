// components/NicheMenuCard.tsx
type MenuRow = {
  competitor_id: string
  avg_price: number | null
  top_items: Array<{ name?: string; price?: number; mentions?: number }> | null
  source?: string | null
  fetched_at?: string | null
}

export default function NicheMenuCard({ menus }: { menus: MenuRow[] }) {
  if (!menus?.length) {
    return (
      <div className="rounded border bg-white p-4">
        <div className="font-medium mb-1">Niche menu insights</div>
        <div className="text-sm text-gray-600">No menu data yet. Try “Fetch menus”.</div>
      </div>
    )
  }

  // 1) median average ticket across competitors (ignore nulls, clamp to sane range)
  const prices = menus
    .map((m) => (typeof m.avg_price === 'number' ? m.avg_price : null))
    .filter((x): x is number => x != null)
    .filter((x) => x > 1 && x < 500)
    .sort((a, b) => a - b)

  const median =
    prices.length === 0
      ? null
      : prices.length % 2
      ? prices[(prices.length - 1) / 2]
      : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2

  // 2) top items across competitors (simple frequency on normalized names)
  const freq = new Map<string, number>()
  const examples = new Map<string, string>() // keep one display casing
  for (const m of menus) {
    if (!Array.isArray(m.top_items)) continue
    const seen = new Set<string>() // avoid double-counting same item within one competitor
    for (const t of m.top_items) {
      const raw = (t?.name || '').trim()
      if (!raw) continue
      const key = raw.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      freq.set(key, (freq.get(key) || 0) + 1)
      if (!examples.has(key)) examples.set(key, raw)
    }
  }
  const top = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key, count]) => ({ name: examples.get(key) || key, count }))

  return (
    <div className="rounded border bg-white p-4">
      <div className="font-medium mb-2">Niche menu insights</div>

      <div className="text-sm text-gray-700 mb-3">
        Median avg ticket: <b>{median != null ? `$${median.toFixed(2)}` : '—'}</b>{' '}
        <span className="text-gray-500">
          ({prices.length} competitor{prices.length === 1 ? '' : 's'})
        </span>
      </div>

      <div>
        <div className="text-sm font-medium mb-1">Most-mentioned items</div>
        {top.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {top.map((t) => (
              <li
                key={t.name}
                className="rounded border px-3 py-2 text-sm flex items-center justify-between"
              >
                <span className="truncate">{t.name}</span>
                <span className="text-gray-600">{t.count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-gray-600">Not enough menu items yet.</div>
        )}
      </div>
    </div>
  )
}
