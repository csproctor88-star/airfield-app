'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useInstallation } from '@/lib/installation-context'
import { isMapboxConfigured } from '@/lib/utils'
import { SEVERITY_CONFIG } from '@/lib/constants'
import type { DiscrepancyRow } from '@/lib/supabase/discrepancies'

type Props = {
  discrepancies: DiscrepancyRow[]
  daysOpenFn: (createdAt: string) => number
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: SEVERITY_CONFIG.critical.color,
  high: SEVERITY_CONFIG.high.color,
  medium: SEVERITY_CONFIG.medium.color,
  low: SEVERITY_CONFIG.low.color,
}

const NO_SEVERITY_COLOR = '#94A3B8'

export default function DiscrepancyMapView({ discrepancies, daysOpenFn }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const popupRef = useRef<mapboxgl.Popup | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const { runways } = useInstallation()

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const mapboxReady = isMapboxConfigured()

  // Filter discrepancies with GPS coordinates
  const geoDiscrepancies = discrepancies.filter(
    (d) => d.latitude != null && d.longitude != null,
  )

  const noGeoCount = discrepancies.length - geoDiscrepancies.length

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxReady || !token) return
    if (map.current) return

    mapboxgl.accessToken = token

    // Center on first runway or default
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

    map.current = m

    return () => {
      m.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Add/update markers when discrepancies or map changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // Close any open popup
    if (popupRef.current) {
      popupRef.current.remove()
      popupRef.current = null
    }

    // Remove existing markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    // Add markers for each geo-located discrepancy
    geoDiscrepancies.forEach((d) => {
      const lat = d.latitude!
      const lng = d.longitude!
      const color = SEVERITY_COLORS[d.severity] || NO_SEVERITY_COLOR
      const days = daysOpenFn(d.created_at)

      // Create marker element
      const el = document.createElement('div')
      el.style.width = '22px'
      el.style.height = '22px'
      el.style.borderRadius = '50%'
      el.style.border = '3px solid #FFFFFF'
      el.style.background = color
      el.style.boxShadow = '0 0 8px rgba(0,0,0,0.5)'
      el.style.cursor = 'pointer'
      el.style.transition = 'transform 0.15s ease'

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.3)'
      })
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)'
      })

      // Build popup HTML
      const sevLabel = SEVERITY_CONFIG[d.severity as keyof typeof SEVERITY_CONFIG]?.label || d.severity
      const popupHtml = `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:260px;line-height:1.4;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-size:11px;font-weight:800;color:#22D3EE;font-family:monospace;">${d.work_order_number || 'Pending'}</span>
            <span style="font-size:10px;font-weight:700;color:${color};background:${color}18;border:1px solid ${color}44;border-radius:4px;padding:1px 6px;">${sevLabel}</span>
          </div>
          <div style="font-size:13px;font-weight:700;color:#F1F5F9;margin-bottom:4px;">${d.title}</div>
          <div style="font-size:11px;color:#94A3B8;">
            ${d.location_text}${d.assigned_shop ? ' &bull; ' + d.assigned_shop : ''} &bull; ${days}d open
          </div>
          <a href="/discrepancies/${d.id}" style="display:inline-block;margin-top:6px;font-size:11px;font-weight:700;color:#22D3EE;text-decoration:none;">
            View Details &rarr;
          </a>
        </div>
      `

      const popup = new mapboxgl.Popup({
        offset: 14,
        closeButton: true,
        closeOnClick: false,
        maxWidth: '280px',
        className: 'discrepancy-map-popup',
      }).setHTML(popupHtml)

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map.current!)

      markersRef.current.push(marker)
    })

    // Fit bounds if we have multiple points
    if (geoDiscrepancies.length > 1) {
      const bounds = new mapboxgl.LngLatBounds()
      geoDiscrepancies.forEach((d) => {
        bounds.extend([d.longitude!, d.latitude!])
      })
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 800 })
    } else if (geoDiscrepancies.length === 1) {
      map.current.flyTo({
        center: [geoDiscrepancies[0].longitude!, geoDiscrepancies[0].latitude!],
        zoom: 15,
        duration: 800,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, discrepancies])

  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => !prev)
    setTimeout(() => {
      map.current?.resize()
    }, 50)
  }, [])

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
        <div style={{ fontSize: 'var(--fs-5xl)', marginBottom: 8 }}>&#x1F5FA;&#xFE0F;</div>
        <div
          style={{
            fontSize: 'var(--fs-md)',
            fontWeight: 700,
            color: 'var(--color-text-2)',
            marginBottom: 8,
          }}
        >
          Mapbox Token Required
        </div>
        <div
          style={{
            fontSize: 'var(--fs-base)',
            color: 'var(--color-text-3)',
            lineHeight: 1.5,
          }}
        >
          Add your Mapbox access token to{' '}
          <code style={{ color: 'var(--color-accent)' }}>.env.local</code>
          <br />
          <code style={{ color: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}>
            NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx
          </code>
        </div>
      </div>
    )
  }

  if (geoDiscrepancies.length === 0) {
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
        <div style={{ fontSize: 'var(--fs-3xl)', marginBottom: 8 }}>&#x1F4CD;</div>
        <div
          style={{
            fontSize: 'var(--fs-md)',
            fontWeight: 700,
            color: 'var(--color-text-2)',
            marginBottom: 8,
          }}
        >
          No GPS Coordinates
        </div>
        <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', lineHeight: 1.5 }}>
          None of the filtered discrepancies have GPS coordinates.
          <br />
          Pin a location when creating discrepancies to see them on the map.
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
          height: expanded ? '70vh' : '400px',
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
          {expanded ? '\u2296 Collapse' : '\u2295 Expand'}
        </button>
      )}
      {/* Legend */}
      {mapLoaded && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            background: 'rgba(4, 7, 12, 0.88)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: 6,
            padding: '6px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Severity
          </div>
          {(['critical', 'high', 'medium', 'low'] as const).map((sev) => (
            <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: SEVERITY_COLORS[sev],
                  border: '1.5px solid #fff',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: '10px', color: '#CBD5E1', fontWeight: 600 }}>
                {SEVERITY_CONFIG[sev].label}
              </span>
            </div>
          ))}
        </div>
      )}
      {/* Stats badge */}
      {mapLoaded && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            background: 'rgba(4, 7, 12, 0.88)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: '11px',
            color: '#94A3B8',
            fontWeight: 600,
          }}
        >
          {geoDiscrepancies.length} pinned
          {noGeoCount > 0 && (
            <span style={{ color: '#64748B' }}> &bull; {noGeoCount} no GPS</span>
          )}
        </div>
      )}

      {/* Popup dark-theme CSS override */}
      <style jsx global>{`
        .discrepancy-map-popup .mapboxgl-popup-content {
          background: rgba(15, 23, 42, 0.95) !important;
          border: 1px solid rgba(148, 163, 184, 0.2) !important;
          border-radius: 8px !important;
          padding: 10px 12px !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
        }
        .discrepancy-map-popup .mapboxgl-popup-close-button {
          color: #94A3B8 !important;
          font-size: 16px !important;
          right: 4px !important;
          top: 2px !important;
        }
        .discrepancy-map-popup .mapboxgl-popup-close-button:hover {
          color: #F1F5F9 !important;
          background: transparent !important;
        }
        .discrepancy-map-popup .mapboxgl-popup-tip {
          border-top-color: rgba(15, 23, 42, 0.95) !important;
        }
      `}</style>
    </div>
  )
}
