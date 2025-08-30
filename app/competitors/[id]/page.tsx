// app/competitors/[id]page.tsx
import { createSupabaseRSC } from '@/utils/supabase/server'
import Link from 'next/link'
import { Star } from 'lucide-react'
import WatchlistToggle from '@/components/WatchlistToggle'
import NotesCard from '@/components/NotesCard'
import MenuSection from '@/components/MenuSection'

type ParamsPromise = Promise<{ id: string }>
export default async function CompetitorDetail({ params }: { params: ParamsPromise }) {
  const { id } = await params
  const supabase = await createSupabaseRSC()

  // 1) Competitor
  const { data: competitor, error } = await supabase
    .from('competitors')
    .select(
      'id, search_id, name, source, rating, review_count, price_level, address, phone, website, lat, lng, data',
    )
    .eq('id', id)
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

  // 2) Notes for this competitor (used for preload + mini indicator)
  const { data: notes } = await supabase
    .from('notes')
    .select('id, content, created_at')
    .eq('competitor_id', competitor.id)
    .order('created_at', { ascending: true })

  const notesCount = notes?.length ?? 0

  // 3) Is in watchlist?
  const { data: watchlistRow } = await supabase
    .from('watchlist')
    .select('id')
    .eq('competitor_id', competitor.id)
    .maybeSingle()
  const isStarred = !!watchlistRow

  // 4) Map
  const mapUrl =
    competitor.lat != null && competitor.lng != null
      ? `https://www.google.com/maps?q=${competitor.lat},${competitor.lng}&z=15&output=embed`
      : null

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Back Links */}
      <div className="flex items-center gap-3 text-sm">
        <Link href={`/results/${competitor.search_id}`} className="text-blue-600 underline">
          ← Back to results
        </Link>
        <Link href="/history" className="text-blue-600 underline">
          History
        </Link>
      </div>

      {/* Main Card */}
      <div className="rounded border bg-white p-5 space-y-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold flex-1">{competitor.name ?? 'Unknown'}</h1>

          {/* 📝 mini notes indicator */}
          <span
            title="Notes count"
            className="text-xs px-2 py-1 rounded border bg-gray-50 text-gray-700"
          >
            📝 {notesCount}
          </span>

          {/* ⭐ watchlist toggle (unchanged behavior) */}
          <WatchlistToggle competitorId={competitor.id} initialStarred={isStarred} />
        </div>

        {/* Rating Row */}
        <div className="flex items-center gap-2 text-sm text-gray-700">
          {typeof competitor.rating === 'number' && (
            <span className="flex items-center gap-1">
              <Star size={14} className="text-yellow-500 fill-yellow-500" />
              {competitor.rating.toFixed(1)}
            </span>
          )}
          {competitor.review_count && (
            <span className="text-gray-600">· {competitor.review_count} reviews</span>
          )}
          {competitor.price_level && (
            <span className="text-gray-600">· {competitor.price_level}</span>
          )}
          {competitor.source && <span className="text-gray-600">· {competitor.source}</span>}
        </div>

        {/* Address + Contact (now with emojis) */}
        <div className="text-sm text-gray-600">{competitor.address ?? '—'}</div>
        <div className="text-sm text-gray-600 flex flex-wrap items-center gap-4">
          {competitor.phone && (
            <a
              href={`tel:${competitor.phone}`}
              className="underline inline-flex items-center gap-1"
            >
              ☎️ <span>{competitor.phone}</span>
            </a>
          )}
          {competitor.website && (
            <a
              href={competitor.website}
              target="_blank"
              rel="noreferrer"
              className="underline inline-flex items-center gap-1"
            >
              🌐 <span>Website</span>
            </a>
          )}
        </div>
      </div>

      {/* Map Section */}
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
      <MenuSection competitorId={competitor.id} />
      {/* Notes dropdown (preloaded) */}
      <NotesCard competitorId={competitor.id} initialNotes={notes ?? []} />
    </main>
  )
}
