// 'use client'

// import { useEffect, useMemo, useState } from 'react'
// import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
// import type { LatLngExpression } from 'leaflet'
// import 'leaflet/dist/leaflet.css'

// type Competitor = { id: string; name: string | null; lat: number | null; lng: number | null }
// export default function ResultsMapStub() { return null }
// export default function ResultsMap({
//   items = [],
//   centerLat = null,
//   centerLng = null,
//   mapKey = 'map-0', // <<< NEW
// }: {
//   items?: Competitor[]
//   centerLat?: number | null
//   centerLng?: number | null
//   mapKey?: string
// }) {
//   const [mounted, setMounted] = useState(false)
//   useEffect(() => setMounted(true), [])

//   const points = useMemo(
//     () =>
//       (items ?? [])
//         .filter((c) => typeof c.lat === 'number' && typeof c.lng === 'number')
//         .map((c) => [c.lat as number, c.lng as number, c] as [number, number, Competitor]),
//     [items],
//   )

//   const center = useMemo<LatLngExpression | null>(() => {
//     if (centerLat != null && centerLng != null) return [centerLat, centerLng]
//     if (!points.length) return null
//     const [latSum, lngSum] = points.reduce((acc, [la, ln]) => [acc[0] + la, acc[1] + ln], [0, 0])
//     return [latSum / points.length, lngSum / points.length]
//   }, [centerLat, centerLng, points])

//   if (!mounted) return <div className="rounded border" style={{ height: 420 }} />

//   return (
//     <div className="rounded border overflow-hidden" style={{ height: 420 }}>
//       <MapContainer
//         key={mapKey} // <<< forces a brand-new Leaflet map instance
//         style={{ height: '100%', width: '100%' }}
//         center={(center ?? [0, 0]) as LatLngExpression}
//         zoom={13}
//         scrollWheelZoom
//       >
//         <TileLayer
//           attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
//           url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
//         />
//         {points.map(([la, ln, c]) => (
//           <Marker key={c.id} position={[la, ln] as LatLngExpression}>
//             <Popup>
//               <div className="text-sm">
//                 <div className="font-semibold">{c.name ?? 'Unknown'}</div>
//                 <div className="text-gray-600">
//                   ({la.toFixed(5)}, {ln.toFixed(5)})
//                 </div>
//               </div>
//             </Popup>
//           </Marker>
//         ))}
//       </MapContainer>
//     </div>
//   )
// }
