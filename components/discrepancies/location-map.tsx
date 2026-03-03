'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useInstallation } from '@/lib/installation-context'
import { isMapboxConfigured } from '@/lib/utils'

type Props = {
  onPointSelected: (lat: number, lng: number) => void
  selectedLat: number | null
  selectedLng: number | null
  promptText?: string
  flyToPoint?: { lat: number; lng: number } | null
}

export default function DiscrepancyLocationMap({ onPointSelected, selectedLat, selectedLng, promptText, flyToPoint }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const marker = useRef<mapboxgl.Marker | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const { runways } = useInstallation()

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const mapboxReady = isMapboxConfigured()

  const handleClick = useCallback(
    (e: mapboxgl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat
      onPointSelected(lat, lng)
    },
    [onPointSelected],
  )

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxReady || !token) return
    if (map.current) return

    mapboxgl.accessToken = token

    const rwy = runways[0]
    const centerLat = rwy
      ? ((rwy.end1_latitude ?? 0) + (rwy.end2_latitude ?? 0)) / 2
      : 42.6139
    const centerLng = rwy
      ? ((rwy.end1_longitude ?? 0) + (rwy.end2_longitude ?? 0)) / 2
      : -82.8369

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: [centerLng, centerLat],
      zoom: 14,
      pitch: 0,
      bearing: 0,
    })

    m.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right')

    m.on('load', () => {
      setMapLoaded(true)
    })

    m.on('click', handleClick)
    map.current = m

    return () => {
      m.off('click', handleClick)
      m.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Update click handler when callback changes
  useEffect(() => {
    const m = map.current
    if (!m || !mapLoaded) return
    m.off('click', handleClick)
    m.on('click', handleClick)
    return () => {
      m.off('click', handleClick)
    }
  }, [handleClick, mapLoaded])

  // Update marker when selected point changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    if (marker.current) {
      marker.current.remove()
      marker.current = null
    }

    if (selectedLat != null && selectedLng != null) {
      const el = document.createElement('div')
      el.style.width = '28px'
      el.style.height = '28px'
      el.style.borderRadius = '50%'
      el.style.border = '3px solid #FFFFFF'
      el.style.background = '#EF4444'
      el.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)'
      el.style.cursor = 'pointer'

      marker.current = new mapboxgl.Marker({ element: el })
        .setLngLat([selectedLng, selectedLat])
        .addTo(map.current)
    }
  }, [selectedLat, selectedLng, mapLoaded])

  // Fly to point when GPS location is captured
  useEffect(() => {
    if (!map.current || !mapLoaded || !flyToPoint) return
    map.current.flyTo({ center: [flyToPoint.lng, flyToPoint.lat], zoom: 15, duration: 1500 })
  }, [flyToPoint, mapLoaded])

  if (!mapboxReady) {
    return (
      <div
        style={{
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-mid)',
          borderRadius: 10,
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 'var(--fs-5xl)', marginBottom: 8 }}>🗺️</div>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 8 }}>
          Mapbox Token Required
        </div>
        <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', lineHeight: 1.5 }}>
          Add your Mapbox access token to <code style={{ color: 'var(--color-accent)' }}>.env.local</code>
          <br />
          <code style={{ color: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}>NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx</code>
        </div>
      </div>
    )
  }

  const handleToggleExpand = useCallback(() => {
    setExpanded(prev => !prev)
    // Resize map after the container height changes
    setTimeout(() => { map.current?.resize() }, 50)
  }, [])

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={mapContainer}
        style={{
          width: '100%',
          height: expanded ? 'var(--map-height-expanded)' : 'var(--map-height)',
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid var(--color-border-mid)',
          transition: 'height 0.3s ease',
        }}
      />
      {/* Expand / Collapse toggle */}
      {mapLoaded && (
        <button
          onClick={handleToggleExpand}
          style={{
            position: 'absolute',
            top: 8,
            right: 48,
            background: 'rgba(4, 7, 12, 0.88)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 'var(--fs-sm)',
            color: '#94A3B8',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {expanded ? '⊖ Collapse' : '⊕ Expand'}
        </button>
      )}
      {!selectedLat && mapLoaded && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(4, 7, 12, 0.88)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 'var(--fs-sm)',
            color: '#94A3B8',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {promptText || 'Tap map to mark location'}
        </div>
      )}
      {selectedLat != null && selectedLng != null && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            background: 'rgba(4, 7, 12, 0.88)',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 'var(--fs-sm)',
            color: '#34D399',
            fontWeight: 600,
            fontFamily: 'monospace',
          }}
        >
          {selectedLat.toFixed(5)}, {selectedLng.toFixed(5)}
        </div>
      )}
    </div>
  )
}
