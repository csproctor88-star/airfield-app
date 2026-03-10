'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useInstallation } from '@/lib/installation-context'
import { isMapboxConfigured } from '@/lib/utils'
import { Trash2 } from 'lucide-react'

type Pin = { lat: number; lng: number }

type Props = {
  pins: Pin[]
  onPinsChange: (pins: Pin[]) => void
}

export default function AcsiLocationMap({ pins, onPinsChange }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)
  const { runways, installationId } = useInstallation()

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const mapboxReady = isMapboxConfigured()

  // Stable ref for pins to avoid re-registering click handler
  const pinsRef = useRef(pins)
  pinsRef.current = pins
  const onPinsChangeRef = useRef(onPinsChange)
  onPinsChangeRef.current = onPinsChange

  const handleClick = useCallback((e: mapboxgl.MapMouseEvent) => {
    const { lng, lat } = e.lngLat
    onPinsChangeRef.current([...pinsRef.current, { lat, lng }])
  }, [])

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxReady || !token) return
    if (map.current) {
      map.current.remove()
      map.current = null
      setMapLoaded(false)
    }

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
      attributionControl: false,
    })

    m.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right')
    m.on('load', () => setMapLoaded(true))
    m.on('click', handleClick)
    map.current = m

    return () => {
      m.off('click', handleClick)
      m.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, installationId])

  // Sync markers with pins array
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // Remove old markers
    for (const m of markersRef.current) m.remove()
    markersRef.current = []

    // Add new markers
    for (let i = 0; i < pins.length; i++) {
      const pin = pins[i]
      const el = document.createElement('div')
      el.style.width = '24px'
      el.style.height = '24px'
      el.style.borderRadius = '50%'
      el.style.border = '3px solid #FFFFFF'
      el.style.background = '#EF4444'
      el.style.boxShadow = '0 0 8px rgba(0,0,0,0.5)'
      el.style.cursor = 'pointer'
      el.style.display = 'flex'
      el.style.alignItems = 'center'
      el.style.justifyContent = 'center'
      el.style.fontSize = '10px'
      el.style.fontWeight = '700'
      el.style.color = '#fff'
      el.textContent = String(i + 1)

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map.current)

      markersRef.current.push(marker)
    }
  }, [pins, mapLoaded])

  const removePin = (index: number) => {
    onPinsChange(pins.filter((_, i) => i !== index))
  }

  if (!mapboxReady) {
    return (
      <div style={{
        background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
        borderRadius: 10, padding: 20, textAlign: 'center',
      }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 6 }}>
          Mapbox Token Required
        </div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', lineHeight: 1.5 }}>
          Add <code style={{ color: 'var(--color-accent)' }}>NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx</code> to <code style={{ color: 'var(--color-accent)' }}>.env.local</code>
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

      {/* Pin list with remove */}
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
