'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { initGoogleMaps, isGoogleMapsConfigured, GOOGLE_MAP_OPTIONS } from '@/lib/google-maps'
import { applyMapProvider } from '@/lib/map-providers'
import { useInstallation } from '@/lib/installation-context'

type Props = {
  onPointSelected: (lat: number, lng: number) => void
  selectedLat: number | null
  selectedLng: number | null
  promptText?: string
  flyToPoint?: { lat: number; lng: number } | null
  markerColor?: string
  aspectRatio?: string
  maxHeight?: string
}

export default function LocationPickerMapGoogle({
  onPointSelected,
  selectedLat,
  selectedLng,
  promptText = 'Tap map to mark location',
  flyToPoint,
  markerColor = '#EF4444',
  aspectRatio = '3 / 4',
  maxHeight = '70vh',
}: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [apiReady, setApiReady] = useState(false)
  const { runways, installationId, mapProvider } = useInstallation()
  const hasApiKey = isGoogleMapsConfigured()

  const onPointSelectedRef = useRef(onPointSelected)
  onPointSelectedRef.current = onPointSelected

  useEffect(() => {
    if (!hasApiKey) return
    initGoogleMaps().then(() => setApiReady(true))
  }, [hasApiKey])

  // Initialize map
  useEffect(() => {
    if (!apiReady || !mapContainer.current) return

    const rwy = runways[0]
    const centerLat = rwy ? ((rwy.end1_latitude ?? 0) + (rwy.end2_latitude ?? 0)) / 2 : 42.6139
    const centerLng = rwy ? ((rwy.end1_longitude ?? 0) + (rwy.end2_longitude ?? 0)) / 2 : -82.8369

    const gmap = new google.maps.Map(mapContainer.current, {
      ...GOOGLE_MAP_OPTIONS,
      center: { lat: centerLat, lng: centerLng },
      zoom: 14,
      zoomControlOptions: { position: google.maps.ControlPosition.TOP_RIGHT },
    })

    applyMapProvider(gmap, mapProvider)

    gmap.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return
      onPointSelectedRef.current(e.latLng.lat(), e.latLng.lng())
    })

    mapRef.current = gmap
    setMapLoaded(true)

    return () => {
      mapRef.current = null
      setMapLoaded(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady, installationId, mapProvider])

  // Update marker
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setMap(null)
      markerRef.current = null
    }
    if (!mapRef.current || !mapLoaded || selectedLat == null || selectedLng == null) return

    markerRef.current = new google.maps.Marker({
      position: { lat: selectedLat, lng: selectedLng },
      map: mapRef.current,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: markerColor,
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 3,
      },
    })
  }, [selectedLat, selectedLng, mapLoaded, markerColor])

  // Fly to point
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !flyToPoint) return
    mapRef.current.panTo({ lat: flyToPoint.lat, lng: flyToPoint.lng })
    mapRef.current.setZoom(15)
  }, [flyToPoint, mapLoaded])

  if (!hasApiKey) {
    return (
      <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-mid)', borderRadius: 10, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 8 }}>Google Maps API Key Required</div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={mapContainer}
        style={{
          width: '100%',
          aspectRatio,
          maxHeight,
          minHeight: 220,
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid var(--color-border-mid)',
        }}
      />
      {!selectedLat && mapLoaded && (
        <div style={{
          position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(4, 7, 12, 0.88)', borderRadius: 6, padding: '4px 10px',
          fontSize: 'var(--fs-sm)', color: '#94A3B8', fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          {promptText}
        </div>
      )}
      {selectedLat != null && selectedLng != null && (
        <div style={{
          position: 'absolute', bottom: 8, left: 8,
          background: 'rgba(4, 7, 12, 0.88)', borderRadius: 6, padding: '4px 8px',
          fontSize: 'var(--fs-sm)', color: markerColor, fontWeight: 600, fontFamily: 'monospace',
        }}>
          {selectedLat.toFixed(5)}, {selectedLng.toFixed(5)}
        </div>
      )}
    </div>
  )
}
