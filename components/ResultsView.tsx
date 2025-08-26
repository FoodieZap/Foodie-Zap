'use client'

import { useState, useMemo } from 'react'
import ResultsTable from './ResultsTable'
import dynamic from 'next/dynamic'
import type { Competitor as NormalizedCompetitor } from '@/lib/normalize'
import { useRouter, useSearchParams } from 'next/navigation'

///dynamic import, ssr off
// ... (Competitor type + props unchanged)
type MapPoint = {
  id?: string | null
  name?: string | null
  lat?: number | null
  lng?: number | null
}

type RawLeafletMapProps = {
  items?: MapPoint[]
  centerLat?: number | null
  centerLng?: number | null
  version?: number
}

const RawLeafletMap = dynamic<RawLeafletMapProps>(() => import('./RawLeafletMap'), { ssr: false })
type Competitor = NormalizedCompetitor & {
  id?: string | null
  _score?: number | null
}
export default function ResultsView({
  items,
  centerLat: centerLatProp = null,
  centerLng: centerLngProp = null,
  watchlistIds = [],
  starredIds = [],
  initialWatchlistIds = [],
  initialMode = 'list',
}: {
  items: Competitor[]
  centerLat?: number | null
  centerLng?: number | null
  starredIds?: string[]
  watchlistIds?: string[]
  initialWatchlistIds?: string[]
  initialMode?: 'list' | 'map'
}) {
  const router = useRouter()
  const sp = useSearchParams()
  const [mapVersion, setMapVersion] = useState(0)
  const [mode, setMode] = useState<'list' | 'map'>(initialMode)

  function setView(next: 'list' | 'map') {
    setMode(next)
    const params = new URLSearchParams(sp ? Array.from(sp.entries()) : [])
    if (next === 'list') params.delete('view')
    else params.set('view', 'map')
    router.push(`?${params.toString()}`)
  }

  const { centerLat, centerLng } = useMemo(() => {
    if (centerLatProp != null && centerLngProp != null)
      return { centerLat: centerLatProp, centerLng: centerLngProp }

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
          onClick={() => setView('list')}
          className={`px-3 py-1.5 rounded border text-sm ${
            mode === 'list' ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'
          }`}
          data-testid="btn-list"
        >
          List
        </button>

        <button
          type="button"
          onClick={() => setView('map')}
          className={`px-3 py-1.5 rounded border text-sm ${
            mode === 'map' ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'
          }`}
          data-testid="btn-map"
        >
          Map
        </button>

        {mode === 'map' && (
          <button
            type="button"
            onClick={() => setMapVersion((v) => v + 1)} // manual reset button
            className="ml-2 px-3 py-1.5 rounded border text-sm hover:bg-gray-100"
          >
            Reset Map
          </button>
        )}
      </div>

      {mode === 'list' ? (
        <ResultsTable
          items={items as any}
          centerLat={centerLat}
          centerLng={centerLng}
          //initialWatchlistIds={watchlistIds}
          initialWatchlistIds={initialWatchlistIds}
        />
      ) : (
        <RawLeafletMap
          items={items}
          centerLat={centerLat}
          centerLng={centerLng}
          version={mapVersion}
        />
      )}
    </div>
  )
}
