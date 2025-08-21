import { redirect } from 'next/navigation'
import { createSupabaseRSC } from '@/utils/supabase/server'

export default async function SearchDetails({ params }: { params: { id: string } }) {
  const supabase = await createSupabaseRSC()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // 1) The search row (RLS ensures ownership)
  const { data: search, error: sErr } = await supabase
    .from('searches')
    .select('*')
    .eq('id', params.id)
    .single()
  if (sErr) {
    return <main className="p-6">Search not found.</main>
  }

  // 2) Competitors for this search
  const { data: competitors } = await supabase
    .from('competitors')
    .select(
      'id, source, place_id, name, address, phone, website, rating, review_count, price_level, cuisine',
    )
    .eq('search_id', params.id)

  // 3) Menus for those competitors
  let menus: any[] = []
  if (competitors && competitors.length) {
    const ids = competitors.map((c) => c.id)
    const { data } = await supabase
      .from('menus')
      .select('competitor_id, avg_price, currency, top_items')
      .in('competitor_id', ids)
    menus = data ?? []
  }

  // 4) Insights
  const { data: insights } = await supabase
    .from('insights')
    .select('summary, actions')
    .eq('search_id', params.id)
    .maybeSingle()

  return (
    <main className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {search.query} • {search.city}
          </h1>
          <p className="text-sm text-gray-600">Status: {search.status}</p>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border p-4">
          <h2 className="font-medium mb-2">Competitors</h2>
          {!competitors?.length ? (
            <p className="text-sm text-gray-600">No competitors yet.</p>
          ) : (
            <ul className="space-y-2">
              {competitors.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-gray-600">{c.address}</div>
                  </div>
                  <div className="text-sm">{c.rating ?? '—'} ⭐</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border p-4">
          <h2 className="font-medium mb-2">Menu & Pricing</h2>
          <p className="text-sm text-gray-600">Add chart + top items in Step 14.</p>
        </div>

        <div className="rounded-xl border p-4">
          <h2 className="font-medium mb-2">Trends</h2>
          <p className="text-sm text-gray-600">Coming in Week 2.</p>
        </div>

        <div className="rounded-xl border p-4">
          <h2 className="font-medium mb-2">Action Steps</h2>
          <p className="text-sm text-gray-600">Generated in Step 15.</p>
        </div>
      </section>
    </main>
  )
}
