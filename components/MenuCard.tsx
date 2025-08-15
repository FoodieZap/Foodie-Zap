export default function MenuCard({
  menus,
}: {
  menus: { competitor_id: string; avg_price: number | null; top_items: any[] | null }[]
}) {
  const avg =
    menus.length === 0
      ? null
      : Math.round(
          (menus.reduce((s, m) => s + (Number(m.avg_price) || 0), 0) / menus.length) * 100,
        ) / 100

  return (
    <div className="rounded border bg-white p-4">
      <div className="font-semibold">Menu & Pricing</div>
      <div className="text-sm text-gray-600">
        {avg ? <>Average competitor ticket: ${avg}</> : <>No menu data yet.</>}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {menus.slice(0, 6).map((m) => (
          <div key={m.competitor_id} className="rounded border p-3">
            <div className="text-sm font-medium">Top items</div>
            <ul className="mt-1 text-sm text-gray-700 list-disc pl-5">
              {(m.top_items ?? []).slice(0, 5).map((it: any, idx: number) => (
                <li key={idx}>
                  {it.name} — ${it.est_price} ({it.mentions} mentions)
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
