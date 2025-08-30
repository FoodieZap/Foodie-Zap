'use client'

import React, { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import ResultsTable from './ResultsTable'

const RawLeafletMap = dynamic(() => import('./RawLeafletMap'), { ssr: false })

type Competitor = {
  id?: string | null
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

type MenuRow = { competitor_id: string; avg_price: number | null; top_items: any[] | null }

type Props = {
  items: Competitor[]
  centerLat?: number | null
  centerLng?: number | null
  starredIds?: string[]
  initialMode?: 'list' | 'map'
  initialWatchlistIds?: string[]
  menus?: MenuRow[] // raw array from server
}

export default function ResultsView({
  items,
  centerLat = null,
  centerLng = null,
  starredIds = [],
  initialMode = 'list',
  initialWatchlistIds = [],
  menus = [],
}: Props) {
  const [mode, setMode] = useState<'list' | 'map'>(initialMode)
  const [mapVersion, setMapVersion] = useState(0) // bump to refresh the map when needed

  // Build a quick lookup { [competitor_id]: { avg_price, top_items } }
  const menusMap = useMemo(() => {
    const map: Record<string, { avg_price: number | null; top_items: any[] | null }> = {}
    for (const m of menus) {
      if (m && m.competitor_id) {
        map[m.competitor_id] = { avg_price: m.avg_price, top_items: m.top_items }
      }
    }
    return map
  }, [menus])

  return (
    <div className="space-y-3">
      {/* view toggle */}
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
          onClick={() => {
            setMode('map')
            // optional: force re-render of the map (helps when container size changed)
            setMapVersion((v) => v + 1)
          }}
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
          initialWatchlistIds={initialWatchlistIds}
          menusMap={menusMap} // ← pass it down
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
