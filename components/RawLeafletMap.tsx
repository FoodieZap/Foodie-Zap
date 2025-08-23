'use client'

import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Cluster plugin (JS + CSS)
import 'leaflet.markercluster/dist/leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

type MapPoint = {
  id?: string | null
  name?: string | null
  lat?: number | null
  lng?: number | null
  rating?: number | null
  review_count?: number | null
  price_level?: string | null
  address?: string | null
}

export default function RawLeafletMap({
  items = [],
  centerLat = null,
  centerLng = null,
  version = 0,
}: {
  items?: MapPoint[]
  centerLat?: number | null
  centerLng?: number | null
  version?: number
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)

  const points = useMemo(
    () =>
      (items ?? [])
        .filter((c) => typeof c?.lat === 'number' && typeof c?.lng === 'number')
        .map((c) => [c!.lat as number, c!.lng as number, c] as [number, number, MapPoint]),
    [items],
  )

  const center = useMemo<[number, number] | null>(() => {
    if (centerLat != null && centerLng != null) return [centerLat, centerLng]
    if (!points.length) return null
    const [latSum, lngSum] = points.reduce((acc, [la, ln]) => [acc[0] + la, acc[1] + ln], [0, 0])
    return [latSum / points.length, lngSum / points.length]
  }, [centerLat, centerLng, points])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Tear down any previous map instance
    if (mapRef.current) {
      try {
        mapRef.current.remove()
      } catch {}
      mapRef.current = null
    }
    if ((el as any)._leaflet_id) {
      try {
        delete (el as any)._leaflet_id
      } catch {}
    }

    // ---- Base layers -------------------------------------------------------
    const light = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap, © CARTO',
      maxZoom: 20,
    })
    const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap, © CARTO',
      maxZoom: 20,
    })
    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles © Esri', maxZoom: 19 },
    )

    // ---- Create map --------------------------------------------------------
    const map = L.map(el, {
      center: center ?? [0, 0],
      zoom: 13,
      zoomControl: false,
      layers: [light],
    })
    mapRef.current = map

    // Controls
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.control
      .layers(
        { Light: light, Dark: dark, Satellite: satellite },
        {},
        {
          position: 'topright',
          collapsed: true,
        },
      )
      .addTo(map)

    // ---- Clustered markers (THIS IS THE LOOP YOU ASKED ABOUT) -------------
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cluster: any = (L as any).markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      spiderfyOnEveryZoom: false,
      iconCreateFunction: function (cluster: any) {
        const count = cluster.getChildCount()
        return L.divIcon({
          html: `<div class="fz-cluster">${count}</div>`,
          className: 'fz-pin-wrap', // no extra background
          iconSize: [34, 34],
        })
      },
    })

    const markers: L.Marker[] = []
    function buildInfoHtml(c: MapPoint) {
      const name = c?.name ?? 'Unknown'
      const rating = typeof c?.rating === 'number' ? c!.rating!.toFixed(1) : null
      const reviews = typeof c?.review_count === 'number' ? c!.review_count : null
      const price = (c?.price_level ?? '').trim()
      const address = (c?.address ?? '').trim()

      return `
    <div style="font-size:12px; line-height:1.25; max-width: 260px;">
      <div style="font-weight:600; margin-bottom:6px">${name}</div>
      ${
        rating || reviews
          ? `<div>⭐ ${rating ?? '—'}${reviews != null ? ` · ${reviews} reviews` : ''}</div>`
          : ''
      }
      ${price ? `<div>${price}</div>` : ''}
      ${
        address
          ? `<div style="color:#6b7280; white-space:normal; word-break:break-word; overflow-wrap:anywhere;">${address}</div>`
          : ''
      }
      ${
        c?.id
          ? `<div style="margin-top:6px">
               <a href="/competitors/${c.id}" style="color:#2563eb; text-decoration:underline;">View details</a>
             </div>`
          : ''
      }
    </div>
  `
    }

    points.forEach(([la, ln, c]) => {
      //const m = L.marker([la, ln])

      // Build popup content (click)
      const name = c?.name ?? 'Unknown'
      const rating = typeof c?.rating === 'number' ? c!.rating!.toFixed(1) : null
      const reviews = typeof c?.review_count === 'number' ? c!.review_count : null
      const price = (c?.price_level ?? '').trim()
      const address = (c?.address ?? '').trim()
      const pinIcon = L.divIcon({
        className: 'fz-pin-wrap',
        html: '<div class="fz-pin"></div>',
        iconSize: [18, 24], // visual size incl. pointer
        iconAnchor: [9, 18], // tip sits on the coordinate
        popupAnchor: [0, -18],
        tooltipAnchor: [0, -18],
      })
      const m = L.marker([la, ln], { icon: pinIcon })

      const lines: string[] = []
      if (rating || reviews) {
        const ratingPart = rating ? `⭐ ${rating}` : ''
        const reviewsPart = reviews != null ? ` · ${reviews} reviews` : ''
        lines.push(`<div>${ratingPart}${reviewsPart}</div>`)
      }
      if (price) lines.push(`<div>${price}</div>`)
      if (address) lines.push(`<div style="color:#6b7280">${address}</div>`)

      const popupHtml = `
        <div style="font-weight:600;margin-bottom:4px">${name}</div>
        ${lines.join('')}
        ${
          c?.id
            ? `<div style="margin-top:6px">
          <a href="/competitors/${c.id}" style="color:#2563eb;text-decoration:underline;">View details</a>
        </div>`
            : ''
        }
      `
      m.bindPopup(popupHtml, { closeButton: true })

      // Hover tooltip (lightweight info card)
      const tooltipHtml = `
        <div style="
          font-size:20px;
          background:rgba(255,255,255,0.95);
          border:1px solid #e5e7eb;
          border-radius:8px;
          box-shadow:0 4px 10px rgba(0,0,0,0.12);
          padding:8px 40px;
          max-width:260px;
          pointer-events:none;">
          <div style="font-weight:600;margin-bottom:2px">${name}</div>
          ${
            rating || reviews
              ? `<div>⭐ ${rating ?? '—'}${reviews != null ? ` · ${reviews} reviews` : ''}</div>`
              : ''
          }
          ${price ? `<div>${price}</div>` : ''}
          ${address ? `<div style="color:#6b7280">${address}</div>` : ''}
        </div>
      `
      const html = buildInfoHtml(c)

      m.bindPopup(html, { closeButton: true, autoPan: true })

      m.bindTooltip(html, {
        direction: 'top',
        offset: L.point(0, -14),
        opacity: 1,
        sticky: true,
        className: 'fz-tip', // uses your CSS that prevents overflow
        interactive: false, // tooltip is read-only; click still opens popup
      })

      // Subtle hover lift
      m.on('mouseover', () => m.setZIndexOffset(1000))
      m.on('mouseout', () => m.setZIndexOffset(0))

      markers.push(m)
      cluster.addLayer(m)
    })

    map.addLayer(cluster)

    // ---- Fit to results (or center) ---------------------------------------
    const fitToResults = () => {
      if (markers.length === 0) {
        if (center) map.setView(center, 12)
        return
      }
      const group = new L.FeatureGroup(markers)
      map.fitBounds(group.getBounds().pad(0.2), { animate: true })
    }

    // Initial fit
    fitToResults()

    // ---- Custom controls: Fit + Locate ------------------------------------
    const ControlBtn = L.Control.extend({
      onAdd: function () {
        const btn = L.DomUtil.create('button')
        btn.className = 'leaflet-bar leaflet-control py-1 px-2 bg-white hover:bg-gray-100'
        btn.style.border = '1px solid #ccc'
        btn.style.borderRadius = '6px'
        btn.style.margin = '6px'
        btn.style.cursor = 'pointer'
        return btn
      },
    }) as unknown as new (opts?: L.ControlOptions) => L.Control

    // Fit button (bottom-left)
    const fitCtrl = new ControlBtn({ position: 'bottomleft' })
    fitCtrl.addTo(map)
    const fitEl = (fitCtrl as any)._container as HTMLButtonElement
    fitEl.title = 'Fit to results'
    fitEl.textContent = 'Fit'
    L.DomEvent.on(fitEl, 'click', (e: any) => {
      L.DomEvent.stopPropagation(e)
      fitToResults()
    })

    // Locate button (bottom-left)
    const locCtrl = new ControlBtn({ position: 'bottomleft' })
    locCtrl.addTo(map)
    const locEl = (locCtrl as any)._container as HTMLButtonElement
    locEl.title = 'Locate me'
    locEl.textContent = 'Locate'
    L.DomEvent.on(locEl, 'click', (e: any) => {
      L.DomEvent.stopPropagation(e)
      if (!navigator.geolocation) return
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          const p = L.latLng(latitude, longitude)
          map.setView(p, 14)
          L.circleMarker(p, { radius: 6, color: '#2563eb' }).addTo(map)
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000 },
      )
    })

    // Cleanup on unmount
    return () => {
      try {
        map.remove()
      } catch {}
      mapRef.current = null
    }
  }, [version, JSON.stringify(points), center?.[0], center?.[1]])

  return (
    <div
      ref={containerRef}
      className="rounded border overflow-hidden"
      style={{ height: 420, width: '100%' }}
    />
  )
}
