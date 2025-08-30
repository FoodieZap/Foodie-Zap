// components/MenuSection.tsx
import { createSupabaseRSC } from '@/utils/supabase/server'
import FetchMenuForCompetitorButton from '@/components/FetchMenuForCompetitorButton'

export default async function MenuSection({ competitorId }: { competitorId: string }) {
  const supabase = await createSupabaseRSC()

  const { data: menu } = await supabase
    .from('menus')
    .select('avg_price, top_items, source, fetched_at')
    .eq('competitor_id', competitorId)
    .maybeSingle()

  return (
    <div className="rounded border bg-white">
      <details className="p-4" open>
        <summary className="cursor-pointer font-medium">Menu</summary>

        {!menu && (
          <div className="mt-2 flex items-center justify-between">
            <div className="text-sm text-gray-600">No menu fetched yet.</div>
            <FetchMenuForCompetitorButton competitorId={competitorId} />
          </div>
        )}

        {menu && (
          <div className="mt-3 space-y-3">
            <div className="text-sm text-gray-700">
              {menu.avg_price != null ? (
                <>
                  Average ticket: <b>${Number(menu.avg_price).toFixed(2)}</b>
                </>
              ) : (
                <>Average ticket: —</>
              )}
              {menu.source && <> · Source: {menu.source}</>}
              {menu.fetched_at && (
                <> · Fetched {new Date(menu.fetched_at as any).toLocaleString()}</>
              )}
            </div>

            {Array.isArray(menu.top_items) && menu.top_items.length > 0 ? (
              <ul className="grid sm:grid-cols-2 gap-2">
                {menu.top_items.map((t: any, i: number) => {
                  const name = String(t?.name || '').trim()
                  if (!name || name.length < 2 || name.length > 80) return null
                  return (
                    <li
                      key={i}
                      className="rounded border px-3 py-2 text-sm flex items-center justify-between"
                    >
                      <span className="truncate">{name}</span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="text-sm text-gray-600">No top items available.</div>
            )}

            <div className="pt-2">
              <FetchMenuForCompetitorButton competitorId={competitorId} />
            </div>
          </div>
        )}
      </details>
    </div>
  )
}
