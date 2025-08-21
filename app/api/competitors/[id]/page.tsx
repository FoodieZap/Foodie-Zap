// app/competitors/[id]/page.tsx
import { createSupabaseRSC } from '@/utils/supabase/server'
import Link from 'next/link'

type Params = { id: string }

export default async function CompetitorDetail({ params }: { params: Params }) {
  const supabase = await createSupabaseRSC()

  // fetch competitor (RLS will enforce access via parent search)
  const { data: competitor, error } = await supabase
    .from('competitors')
    .select(
      'id, search_id, name, source, rating, review_count, price_level, address, phone, website, lat, lng, data',
    )
    .eq('id', params.id)
    .single()

  if (error || !competitor) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <p className="mb-2 font-medium">Competitor not found or not accessible.</p>
        <Link href="/history" className="text-blue-600 underline">
          Back to history
        </Link>
      </main>
    )
  }

  // build a simple map embed URL (no API key required)
  const mapUrl =
    competitor.lat != null && competitor.lng != null
      ? `https://www.google.com/maps?q=${competitor.lat},${competitor.lng}&z=15&output=embed`
      : null

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/results/${competitor.search_id}`} className="text-blue-600 underline">
          ← Back to results
        </Link>
        <Link href="/history" className="text-blue-600 underline">
          History
        </Link>
      </div>

      <div className="rounded border bg-white p-5 space-y-2">
        <h1 className="text-xl font-semibold">{competitor.name ?? 'Unknown'}</h1>
        <div className="text-sm text-gray-600">
          Source: {competitor.source ?? '—'} • Rating: {competitor.rating ?? '—'} • Reviews:{' '}
          {competitor.review_count ?? '—'} • Price: {competitor.price_level ?? '—'}
        </div>
        <div className="text-sm text-gray-600">{competitor.address ?? '—'}</div>
        <div className="text-sm text-gray-600">
          {competitor.phone && (
            <span className="mr-3">
              📞{' '}
              <a className="underline" href={`tel:${competitor.phone}`}>
                {competitor.phone}
              </a>
            </span>
          )}
          {competitor.website && (
            <span>
              🌐{' '}
              <a className="underline" href={competitor.website} target="_blank" rel="noreferrer">
                Website
              </a>
            </span>
          )}
        </div>
      </div>

      {mapUrl ? (
        <div className="rounded border overflow-hidden">
          <iframe
            src={mapUrl}
            className="w-full"
            style={{ height: 360, border: 0 }}
            loading="lazy"
          />
        </div>
      ) : (
        <div className="rounded border bg-white p-4 text-gray-600">
          No map available (missing coordinates).
        </div>
      )}

      {/* optional: render any extra data you stored */}
      {competitor.data && (
        <div className="rounded border bg-white p-4">
          <div className="font-medium mb-2">Raw data (debug)</div>
          <pre className="text-xs overflow-auto">{JSON.stringify(competitor.data, null, 2)}</pre>
        </div>
      )}
    </main>
  )
}
