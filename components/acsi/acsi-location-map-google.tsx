'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { initGoogleMaps, isGoogleMapsConfigured, GOOGLE_MAP_OPTIONS } from '@/lib/google-maps'
import { useInstallation } from '@/lib/installation-context'
import { Trash2 } from 'lucide-react'

type Pin = { lat: number; lng: number }

type Props = {
  pins: Pin[]
  onPinsChange: (pins: Pin[]) => void
}

export default function AcsiLocationMapGoogle({ pins, onPinsChange }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)
  const [apiReady, setApiReady] = useState(false)
  const { runways, installationId } = useInstallation()
  const hasApiKey = isGoogleMapsConfigured()

  const pinsRef = useRef(pins)
  pinsRef.current = pins
  const onPinsChangeRef = useRef(onPinsChange)
  onPinsChangeRef.current = onPinsChange

  useEffect(() => {
    if (!hasApiKey) return
    initGoogleMaps().then(() => setApiReady(true))
  }, [hasApiKey])

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

    gmap.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return
      onPinsChangeRef.current([...pinsRef.current, { lat: e.latLng.lat(), lng: e.latLng.lng() }])
    })

    mapRef.current = gmap
    setMapLoaded(true)

    return () => {
      markersRef.current.forEach(m => m.setMap(null))
      markersRef.current = []
      mapRef.current = null
      setMapLoaded(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady, installationId])

  // Sync markers
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    for (let i = 0; i < pins.length; i++) {
      const pin = pins[i]
      const marker = new google.maps.Marker({
        position: { lat: pin.lat, lng: pin.lng },
        map: mapRef.current,
        label: {
          text: String(i + 1),
          color: '#FFFFFF',
          fontWeight: 'bold',
          fontSize: '10px',
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#EF4444',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 3,
        },
      })
      markersRef.current.push(marker)
    }
  }, [pins, mapLoaded])

  const removePin = (index: number) => {
    onPinsChange(pins.filter((_, i) => i !== index))
  }

  if (!hasApiKey) {
    return (
      <div style={{
        background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
        borderRadius: 10, padding: 20, textAlign: 'center',
      }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-2)' }}>
          Google Maps API Key Required
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <div
          ref={mapContainer}
          style={{
            width: '100%',
            aspectRatio: '1 / 1',
            maxHeight: '50vh',
            borderRadius: 10,
            overflow: 'hidden',
            border: '1px solid var(--color-border)',
          }}
        />
        {pins.length === 0 && mapLoaded && (
          <div style={{
            position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(4, 7, 12, 0.88)', borderRadius: 6, padding: '4px 10px',
            fontSize: 'var(--fs-sm)', color: '#94A3B8', fontWeight: 600, whiteSpace: 'nowrap',
          }}>
            Tap map to add location pins
          </div>
        )}
      </div>

      {pins.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {pins.map((pin, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)',
              padding: '3px 6px', borderRadius: 4,
              background: 'var(--color-bg-sunken)',
            }}>
              <span style={{ fontWeight: 700, color: '#EF4444', minWidth: 16 }}>{i + 1}</span>
              <span style={{ fontFamily: 'monospace', color: '#34D399' }}>
                {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
              </span>
              <button
                type="button"
                onClick={() => removePin(i)}
                style={{
                  marginLeft: 'auto', background: 'none', border: 'none',
                  color: 'var(--color-text-3)', cursor: 'pointer', padding: 2,
                }}
                title="Remove pin"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
