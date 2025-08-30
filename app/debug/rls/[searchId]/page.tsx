// app/debug/rls/[searchId]/page.tsx
import { createSupabaseRSC } from '@/utils/supabase/server'
import Link from 'next/link'

type Params = { searchId: string }

export default async function RlsSearchDetail({ params }: { params: Promise<Params> }) {
  const { searchId } = await params
  const supabase = await createSupabaseRSC()

  // Optional: ensure we are logged in (nice message)
  let user: { id: string; email?: string | null } | null = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data && data.user ? (data.user as any) : null
  } catch {
    user = null
  }
  if (!user) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <p className="mb-4">
          Not logged in.{' '}
          <a href="/auth/login" className="underline">
            Log in
          </a>
          .
        </p>
      </main>
    )
  }

  // 1) fetch the search (RLS should allow if you own it)
  const { data: search, error: searchErr } = await supabase
    .from('searches')
    .select('id, query, city, created_at')
    .eq('id', searchId)
    .single()

  if (searchErr || !search) {
    return (
      <main className="max-w-3xl mx_auto p-6">
        <p className="mb-2 font-medium">Search not found or not accessible.</p>
        <p className="text-sm text-gray-600 mb-4">
          If this search belongs to another user, RLS will block access.
        </p>
        <Link className="text-blue-600 underline" href="/debug/rls">
          Back
        </Link>
      </main>
    )
  }

  // 2) fetch competitors for this search (RLS chained via parent search)
  const { data: competitors, error: compErr } = await supabase
    .from('competitors')
    .select('id, name, source, rating, review_count, price_level, address, lat, lng')
    .eq('search_id', search.id)
    .order('rating', { ascending: false })
    .limit(200)

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="mb-4">
        <Link href="/debug/rls" className="text-blue-600 underline">
          ← Back
        </Link>
      </div>

      <h1 className="text-xl font-semibold mb-1">
        Competitors for: {search.query} — {search.city}
      </h1>
      <p className="text-sm text-gray-600 mb-6">
        Search ID: <code className="bg-gray-100 px-1 py-0.5 rounded">{search.id}</code>
      </p>

      {compErr && (
        <div className="mb-4 rounded bg-rose-50 text-rose-700 p-3">
          Error loading competitors: {compErr.message}
        </div>
      )}

      <div className="rounded border bg-white">
        <div className="px-4 py-2 border-b font-medium">Top competitors</div>
        <div className="divide-y">
          {(!competitors || competitors.length === 0) && (
            <div className="p-4 text-gray-500">No competitors saved for this search.</div>
          )}
          {competitors?.map((c) => (
            <div key={c.id} className="p-4">
              <div className="font-medium">
                {c.name} <span className="text-xs text-gray-500">({c.source})</span>
              </div>
              <div className="text-sm text-gray-600">
                Rating: {c.rating ?? '—'} • Reviews: {c.review_count ?? '—'} • Price:{' '}
                {c.price_level ?? '—'}
              </div>
              <div className="text-sm text-gray-600">{c.address ?? '—'}</div>
              <div className="text-xs text-gray-500">
                Lat/Lng: {c.lat ?? '—'}, {c.lng ?? '—'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
