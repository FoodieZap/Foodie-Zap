'use client'

import { useState } from 'react'
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
  centerLat,
  centerLng,
  starredIds = [],
}: {
  items: Competitor[]
  centerLat?: number | null
  centerLng?: number | null
  starredIds?: string[]
}) {
  const [mode, setMode] = useState<'list' | 'map'>('list')

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
        <ResultsTable items={items} starredIds={starredIds} />
      ) : (
        <ResultsMap items={items} centerLat={centerLat} centerLng={centerLng} />
      )}
    </div>
  )
}
