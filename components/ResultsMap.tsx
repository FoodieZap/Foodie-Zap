'use client'

import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useMemo } from 'react'

type Competitor = {
  id: string
  name: string | null
  source: string | null
  rating: number | null
  review_count: number | null
  address: string | null
  lat: number | null
  lng: number | null
}

function FitBounds({ points, center }: { points: [number, number][]; center?: [number, number] }) {
  const map = useMap()

  useEffect(() => {
    if (!map) return

    if (points.length >= 2) {
      let bounds = L.latLngBounds(points[0], points[0])
      for (let i = 1; i < points.length; i++) {
        bounds = bounds.extend(points[i])
      }
      map.fitBounds(bounds.pad(0.2))
    } else if (points.length === 1) {
      map.setView(points[0], 14)
    } else if (center) {
      map.setView(center, 12)
    } else {
      map.setView([0, 0], 2)
    }
  }, [map, points, center])

  return null
}

export default function ResultsMap({
  items,
  centerLat,
  centerLng,
}: {
  items: Competitor[]
  centerLat?: number | null
  centerLng?: number | null
}) {
  const points = useMemo(
    () =>
      items
        .filter((c) => typeof c.lat === 'number' && typeof c.lng === 'number')
        .map((c) => [c.lat as number, c.lng as number] as [number, number]),
    [items],
  )

  const center =
    typeof centerLat === 'number' && typeof centerLng === 'number'
      ? ([centerLat, centerLng] as [number, number])
      : undefined

  return (
    <div className="rounded border overflow-hidden">
      <MapContainer
        style={{ height: 420, width: '100%' }}
        center={center ?? [0, 0]}
        zoom={center ? 12 : 2}
        scrollWheelZoom
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds points={points} center={center} />

        {items.map((c) => {
          if (typeof c.lat !== 'number' || typeof c.lng !== 'number') return null
          return (
            <CircleMarker key={c.id} center={[c.lat, c.lng]} radius={8}>
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontWeight: 600 }}>{c.name ?? 'Unknown'}</div>
                  <div style={{ fontSize: 12, color: '#555' }}>
                    {c.source ?? '—'} • Rating {c.rating ?? '—'} • Reviews {c.review_count ?? '—'}
                  </div>
                  {c.address && <div style={{ fontSize: 12, marginTop: 4 }}>{c.address}</div>}
                  <div style={{ marginTop: 6 }}>
                    <a
                      href={`/competitors/${c.id}`}
                      style={{ color: '#2563eb', textDecoration: 'underline', fontSize: 12 }}
                    >
                      View details
                    </a>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}
