'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { INSTALLATION } from '@/lib/constants'

type Props = {
  onPointSelected: (lat: number, lng: number) => void
  selectedLat: number | null
  selectedLng: number | null
  promptText?: string
}

export default function DiscrepancyLocationMap({ onPointSelected, selectedLat, selectedLng, promptText }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const marker = useRef<mapboxgl.Marker | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  const handleClick = useCallback(
    (e: mapboxgl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat
      onPointSelected(lat, lng)
    },
    [onPointSelected],
  )

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !token || token === 'your-mapbox-token-here') return
    if (map.current) return

    mapboxgl.accessToken = token

    const rwy = INSTALLATION.runways[0]
    const centerLat = (rwy.end1.latitude + rwy.end2.latitude) / 2
    const centerLng = (rwy.end1.longitude + rwy.end2.longitude) / 2

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

  if (!token || token === 'your-mapbox-token-here') {
    return (
      <div
        style={{
          background: 'rgba(10, 16, 28, 0.92)',
          border: '1px solid rgba(56, 189, 248, 0.1)',
          borderRadius: 10,
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 24, marginBottom: 8 }}>🗺️</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', marginBottom: 8 }}>
          Mapbox Token Required
        </div>
        <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>
          Add your Mapbox access token to <code style={{ color: '#38BDF8' }}>.env.local</code>
          <br />
          <code style={{ color: '#38BDF8', fontSize: 11 }}>NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx</code>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={mapContainer}
        style={{
          width: '100%',
          height: 280,
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid rgba(56, 189, 248, 0.1)',
        }}
      />
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
            fontSize: 11,
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
            fontSize: 11,
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
