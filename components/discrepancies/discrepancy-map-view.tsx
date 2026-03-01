'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useInstallation } from '@/lib/installation-context'
import { isMapboxConfigured } from '@/lib/utils'
import { DISCREPANCY_TYPES } from '@/lib/constants'
import type { DiscrepancyRow } from '@/lib/supabase/discrepancies'

type Props = {
  discrepancies: DiscrepancyRow[]
  daysOpenFn: (createdAt: string) => number
  photoMap?: Record<string, string> // discrepancy_id → first photo URL
}

// Map discrepancy type value → emoji from constants
const TYPE_EMOJI: Record<string, string> = Object.fromEntries(
  DISCREPANCY_TYPES.map((t) => [t.value, t.emoji]),
)

function getTypeEmoji(typeStr: string): string {
  const first = typeStr.split(',')[0]?.trim()
  return TYPE_EMOJI[first] || '\u{1F4CB}'
}

function getTypeLabel(typeStr: string): string {
  return typeStr
    .split(',')
    .map((v) => {
      const t = DISCREPANCY_TYPES.find((dt) => dt.value === v.trim())
      return t ? t.label : v.trim()
    })
    .join(', ')
}

function getTypes(typeStr: string): string[] {
  return typeStr.split(',').map((v) => v.trim())
}

export default function DiscrepancyMapView({ discrepancies, daysOpenFn, photoMap }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [activeTypeFilter, setActiveTypeFilter] = useState<string | null>(null)
  const { runways } = useInstallation()

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const mapboxReady = isMapboxConfigured()

  // Filter discrepancies with GPS coordinates
  const geoDiscrepancies = discrepancies.filter(
    (d) => d.latitude != null && d.longitude != null,
  )

  // Apply type filter from legend
  const visibleDiscrepancies = activeTypeFilter
    ? geoDiscrepancies.filter((d) => getTypes(d.type).includes(activeTypeFilter))
    : geoDiscrepancies

  const noGeoCount = discrepancies.length - geoDiscrepancies.length

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
      zoom: 12,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
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

  // Add/update markers when discrepancies, type filter, or map changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // Remove existing markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    visibleDiscrepancies.forEach((d) => {
      const lat = d.latitude!
      const lng = d.longitude!
      const emoji = getTypeEmoji(d.type)
      const typeLabel = getTypeLabel(d.type)
      const days = daysOpenFn(d.created_at)
      const photoUrl = photoMap?.[d.id]

      const el = document.createElement('div')
      el.style.width = '30px'
      el.style.height = '30px'
      el.style.borderRadius = '50%'
      el.style.border = '2px solid #FFFFFF'
      el.style.background = 'rgba(15, 23, 42, 0.85)'
      el.style.boxShadow = '0 0 8px rgba(0,0,0,0.5)'
      el.style.cursor = 'pointer'
      el.style.transition = 'transform 0.15s ease'
      el.style.display = 'flex'
      el.style.alignItems = 'center'
      el.style.justifyContent = 'center'
      el.style.fontSize = '15px'
      el.style.lineHeight = '1'
      el.textContent = emoji

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.3)'
      })
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)'
      })

      const photoHtml = photoUrl
        ? `<img src="${photoUrl}" alt="photo" style="width:100%;max-height:120px;object-fit:cover;border-radius:6px;margin-bottom:6px;display:block;" onerror="this.style.display='none'" />`
        : ''

      const popupHtml = `
        <div style="font-family:system-ui,-apple-system,sans-serif;min-width:240px;max-width:340px;line-height:1.4;">
          ${photoHtml}
          <div style="margin-bottom:6px;">
            <span style="font-size:13px;font-weight:800;color:#22D3EE;font-family:monospace;display:block;margin-bottom:4px;">${d.work_order_number || 'Pending'}</span>
            <span style="font-size:11px;font-weight:600;color:#CBD5E1;background:rgba(148,163,184,0.12);border:1px solid rgba(148,163,184,0.2);border-radius:4px;padding:1px 6px;">${typeLabel}</span>
          </div>
          <div style="font-size:14px;font-weight:700;color:#F1F5F9;margin-bottom:6px;line-height:1.4;">${d.title}</div>
          <div style="font-size:12px;color:#94A3B8;">
            ${d.location_text}${d.assigned_shop ? ' &bull; ' + d.assigned_shop : ''} &bull; ${days}d open
          </div>
          <a href="/discrepancies/${d.id}" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:700;color:#22D3EE;text-decoration:none;">
            View Details &rarr;
          </a>
        </div>
      `

      const popup = new mapboxgl.Popup({
        offset: 18,
        closeButton: true,
        closeOnClick: true,
        maxWidth: '360px',
        className: 'discrepancy-map-popup',
      }).setHTML(popupHtml)

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map.current!)

      markersRef.current.push(marker)
    })

    // Fit bounds
    if (visibleDiscrepancies.length > 1) {
      const bounds = new mapboxgl.LngLatBounds()
      visibleDiscrepancies.forEach((d) => {
        bounds.extend([d.longitude!, d.latitude!])
      })
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 800 })
    } else if (visibleDiscrepancies.length === 1) {
      map.current.flyTo({
        center: [visibleDiscrepancies[0].longitude!, visibleDiscrepancies[0].latitude!],
        zoom: 13,
        duration: 800,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, discrepancies, photoMap, activeTypeFilter])

  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => !prev)
    setTimeout(() => {
      map.current?.resize()
    }, 50)
  }, [])

  const handleLegendClick = useCallback((typeValue: string) => {
    setActiveTypeFilter((prev) => (prev === typeValue ? null : typeValue))
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
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 8 }}>
          Mapbox Token Required
        </div>
        <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', lineHeight: 1.5 }}>
          Add your Mapbox access token to{' '}
          <code style={{ color: 'var(--color-accent)' }}>.env.local</code>
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
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 8 }}>
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

  // Build legend entries from the discrepancy types actually present in the data
  const presentTypes = new Set(
    geoDiscrepancies.flatMap((d) => getTypes(d.type)),
  )
  const legendItems = DISCREPANCY_TYPES.filter((t) => presentTypes.has(t.value))

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
          {expanded ? '\u2296 Collapse' : '\u2295 Expand'}
        </button>
      )}
      {/* Legend — top-left, clickable type filter */}
      {mapLoaded && legendItems.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            background: 'rgba(4, 7, 12, 0.88)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: 6,
            padding: '6px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748B', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Filter by Type
          </div>
          {legendItems.map((t) => {
            const isActive = activeTypeFilter === t.value
            const isDimmed = activeTypeFilter !== null && !isActive
            return (
              <div
                key={t.value}
                onClick={() => handleLegendClick(t.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '2px 4px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: isActive ? 'rgba(34, 211, 238, 0.12)' : 'transparent',
                  opacity: isDimmed ? 0.4 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: '12px', flexShrink: 0, width: 16, textAlign: 'center' }}>{t.emoji}</span>
                <span style={{ fontSize: '10px', color: isActive ? '#22D3EE' : '#CBD5E1', fontWeight: 600 }}>{t.label}</span>
              </div>
            )
          })}
          {activeTypeFilter && (
            <div
              onClick={() => setActiveTypeFilter(null)}
              style={{
                fontSize: '9px',
                fontWeight: 700,
                color: '#94A3B8',
                cursor: 'pointer',
                textAlign: 'center',
                marginTop: 2,
                padding: '2px 4px',
                borderRadius: 4,
                borderTop: '1px solid rgba(148,163,184,0.15)',
              }}
            >
              Show All
            </div>
          )}
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
          {visibleDiscrepancies.length}{activeTypeFilter ? ` / ${geoDiscrepancies.length}` : ''} pinned
          {noGeoCount > 0 && (
            <span style={{ color: '#64748B' }}> &bull; {noGeoCount} no GPS</span>
          )}
        </div>
      )}

      {/* Popup dark-theme CSS + hide Mapbox branding */}
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
        .mapboxgl-ctrl-logo,
        .mapboxgl-ctrl-attrib {
          display: none !important;
        }
      `}</style>
    </div>
  )
}
