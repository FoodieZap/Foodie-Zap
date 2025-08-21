'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import ResultsTable from './ResultsTable'

const ResultsMap = dynamic(() => import('./ResultsMap'), { ssr: false })

type Competitor = {
  id: string
  name: string | null
  source: string | null
  rating: number | null
  review_count: number | null
  price_level: string | null
  address: string | null
  lat: number | null
  lng: number | null
  _score?: number | null
}

export default function ResultsView({
  items,
  centerLat: centerLatProp = null,
  centerLng: centerLngProp = null,
  watchlistIds = [],
  starredIds = [], // ok to keep even if unused
}: {
  items: Competitor[]
  centerLat?: number | null
  centerLng?: number | null
  starredIds?: string[]
  watchlistIds?: string[]
}) {
  const [mode, setMode] = useState<'list' | 'map'>('list')

  // If center not provided, compute a fallback from item coordinates
  const { centerLat, centerLng } = useMemo(() => {
    if (centerLatProp != null && centerLngProp != null) {
      return { centerLat: centerLatProp, centerLng: centerLngProp }
    }
    const coords = (items ?? []).filter(
      (c) => typeof c.lat === 'number' && typeof c.lng === 'number',
    ) as Array<Required<Pick<Competitor, 'lat' | 'lng'>>>

    if (coords.length === 0) return { centerLat: null, centerLng: null }

    const { latSum, lngSum } = coords.reduce(
      (acc, c) => ({
        latSum: acc.latSum + (c.lat as number),
        lngSum: acc.lngSum + (c.lng as number),
      }),
      { latSum: 0, lngSum: 0 },
    )

    return { centerLat: latSum / coords.length, centerLng: lngSum / coords.length }
  }, [items, centerLatProp, centerLngProp])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">View:</span>

        <button
          type="button"
          onClick={() => setMode('list')}
          className={`px-3 py-1.5 rounded border text-sm ${
            mode === 'list' ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'
          }`}
          data-testid="btn-list"
        >
          List
        </button>

        <button
          type="button"
          onClick={() => setMode('map')}
          className={`px-3 py-1.5 rounded border text-sm ${
            mode === 'map' ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'
          }`}
          data-testid="btn-map"
        >
          Map
        </button>
      </div>

      {mode === 'list' ? (
        <ResultsTable
          items={items}
          centerLat={centerLat}
          centerLng={centerLng}
          initialWatchlistIds={watchlistIds}
        />
      ) : (
        <ResultsMap items={items} centerLat={centerLat} centerLng={centerLng} />
      )}
    </div>
  )
}
