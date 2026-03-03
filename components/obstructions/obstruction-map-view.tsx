'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useInstallation } from '@/lib/installation-context'
import { isMapboxConfigured } from '@/lib/utils'
import { parsePhotoPaths, type ObstructionRow } from '@/lib/supabase/obstructions'
import { formatDistanceToNow } from 'date-fns'

type Props = {
  evaluations: ObstructionRow[]
}

type StatusFilter = 'all' | 'violation' | 'clear'

export default function ObstructionMapView({ evaluations }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const { runways } = useInstallation()

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const mapboxReady = isMapboxConfigured()

  // Filter evaluations with GPS coordinates
  const geoEvaluations = evaluations.filter(
    (e) => e.latitude != null && e.longitude != null,
  )

  // Apply status filter
  const visibleEvaluations =
    statusFilter === 'all'
      ? geoEvaluations
      : statusFilter === 'violation'
        ? geoEvaluations.filter((e) => e.has_violation)
        : geoEvaluations.filter((e) => !e.has_violation)

  const noGeoCount = evaluations.length - geoEvaluations.length
  const violationCount = geoEvaluations.filter((e) => e.has_violation).length
  const clearCount = geoEvaluations.length - violationCount

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
      zoom: 13,
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

  // Add/update markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    visibleEvaluations.forEach((ev) => {
      const lat = ev.latitude!
      const lng = ev.longitude!
      const isViolation = ev.has_violation
      const violatedCount = (ev.violated_surfaces || []).length
      const photos = parsePhotoPaths(ev.photo_storage_path)
      const firstPhoto = photos[0]

      // Marker element — use inner div for scale so we don't overwrite Mapbox's transform
      const el = document.createElement('div')
      el.style.cursor = 'pointer'
      const inner = document.createElement('div')
      inner.style.width = '26px'
      inner.style.height = '26px'
      inner.style.borderRadius = '50%'
      inner.style.border = '2.5px solid #FFFFFF'
      inner.style.background = isViolation ? '#EF4444' : '#22C55E'
      inner.style.boxShadow = '0 0 8px rgba(0,0,0,0.5)'
      inner.style.transition = 'transform 0.15s ease'
      inner.style.display = 'flex'
      inner.style.alignItems = 'center'
      inner.style.justifyContent = 'center'
      inner.style.fontSize = '13px'
      inner.style.lineHeight = '1'
      inner.textContent = isViolation ? '\u26A0' : '\u2713'
      el.appendChild(inner)

      el.addEventListener('mouseenter', () => {
        inner.style.transform = 'scale(1.3)'
      })
      el.addEventListener('mouseleave', () => {
        inner.style.transform = 'scale(1)'
      })

      // Photo HTML
      const photoHtml = firstPhoto
        ? `<img src="${firstPhoto}" alt="photo" style="width:100%;max-height:110px;object-fit:cover;border-radius:6px;margin-bottom:6px;display:block;" onerror="this.style.display='none'" />`
        : ''

      // Violated surfaces badges
      const violatedHtml =
        isViolation && ev.violated_surfaces && ev.violated_surfaces.length > 0
          ? `<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:4px;">
              ${ev.violated_surfaces
                .map(
                  (s) =>
                    `<span style="font-size:9px;background:#EF444414;color:#EF4444;padding:1px 5px;border-radius:3px;border:1px solid #EF444422;">${s}</span>`,
                )
                .join('')}
            </div>`
          : ''

      const statusBadge = isViolation
        ? `<span style="font-size:10px;font-weight:800;padding:1px 6px;border-radius:4px;background:#EF444422;color:#EF4444;">VIOLATION</span>`
        : `<span style="font-size:10px;font-weight:800;padding:1px 6px;border-radius:4px;background:#22C55E22;color:#22C55E;">CLEAR</span>`

      const popupHtml = `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:260px;line-height:1.4;">
          ${photoHtml}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-size:11px;font-weight:700;color:#94A3B8;font-family:monospace;">${ev.display_id}</span>
            ${statusBadge}
          </div>
          ${ev.notes ? `<div style="font-size:13px;font-weight:700;color:#F1F5F9;margin-bottom:4px;">${ev.notes}</div>` : ''}
          <div style="font-size:11px;color:#94A3B8;">
            <strong style="color:#CBD5E1;">${ev.object_height_agl}</strong> ft AGL
            &bull; <strong style="color:#CBD5E1;">${ev.distance_from_centerline_ft?.toFixed(0) ?? '\u2014'}</strong> ft from CL
            ${isViolation ? ` &bull; <span style="color:#EF4444;">${violatedCount} violated</span>` : ''}
          </div>
          ${ev.controlling_surface ? `<div style="font-size:10px;color:#64748B;margin-top:2px;">Controlling: ${ev.controlling_surface}</div>` : ''}
          ${violatedHtml}
          <a href="/obstructions/${ev.id}" style="display:inline-block;margin-top:6px;font-size:11px;font-weight:700;color:#22D3EE;text-decoration:none;">
            View Details &rarr;
          </a>
        </div>
      `

      const popup = new mapboxgl.Popup({
        offset: 16,
        closeButton: true,
        closeOnClick: false,
        maxWidth: '280px',
        className: 'obstruction-map-popup',
      }).setHTML(popupHtml)

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map.current!)

      markersRef.current.push(marker)
    })

    // Fit bounds
    if (visibleEvaluations.length > 1) {
      const bounds = new mapboxgl.LngLatBounds()
      visibleEvaluations.forEach((e) => {
        bounds.extend([e.longitude!, e.latitude!])
      })
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 800 })
    } else if (visibleEvaluations.length === 1) {
      map.current.flyTo({
        center: [visibleEvaluations[0].longitude!, visibleEvaluations[0].latitude!],
        zoom: 14,
        duration: 800,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, evaluations, statusFilter])

  const handleToggleExpand = useCallback(() => {
    setExpanded((prev) => !prev)
    setTimeout(() => {
      map.current?.resize()
    }, 50)
  }, [])

  const handleLegendClick = useCallback((filter: StatusFilter) => {
    setStatusFilter((prev) => (prev === filter ? 'all' : filter))
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

  if (geoEvaluations.length === 0) {
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
          None of the evaluations have GPS coordinates.
          <br />
          Pin a location when creating evaluations to see them on the map.
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
          height: expanded ? 'var(--map-height-expanded)' : 'var(--map-height)',
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid var(--color-border-mid)',
          transition: 'height 0.3s ease',
        }}
      />
      {/* Expand / Collapse */}
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
      {/* Legend — top-left, clickable status filter */}
      {mapLoaded && (
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
            Filter by Status
          </div>
          {([
            { key: 'violation' as StatusFilter, label: 'Violation', color: '#EF4444', icon: '\u26A0', count: violationCount },
            { key: 'clear' as StatusFilter, label: 'Clear', color: '#22C55E', icon: '\u2713', count: clearCount },
          ]).map((item) => {
            const isActive = statusFilter === item.key
            const isDimmed = statusFilter !== 'all' && !isActive
            return (
              <div
                key={item.key}
                onClick={() => handleLegendClick(item.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '2px 4px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  background: isActive ? `${item.color}18` : 'transparent',
                  opacity: isDimmed ? 0.4 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: item.color,
                    border: '1.5px solid #fff',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '8px',
                    lineHeight: '1',
                    color: '#fff',
                  }}
                >
                  {item.icon}
                </div>
                <span style={{ fontSize: '10px', color: isActive ? item.color : '#CBD5E1', fontWeight: 600 }}>
                  {item.label} ({item.count})
                </span>
              </div>
            )
          })}
          {statusFilter !== 'all' && (
            <div
              onClick={() => setStatusFilter('all')}
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
          {visibleEvaluations.length}{statusFilter !== 'all' ? ` / ${geoEvaluations.length}` : ''} pinned
          {noGeoCount > 0 && (
            <span style={{ color: '#64748B' }}> &bull; {noGeoCount} no GPS</span>
          )}
        </div>
      )}

      {/* Popup dark-theme CSS + hide Mapbox branding */}
      <style jsx global>{`
        .obstruction-map-popup .mapboxgl-popup-content {
          background: rgba(15, 23, 42, 0.95) !important;
          border: 1px solid rgba(148, 163, 184, 0.2) !important;
          border-radius: 8px !important;
          padding: 10px 12px !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
        }
        .obstruction-map-popup .mapboxgl-popup-close-button {
          color: #94A3B8 !important;
          font-size: 16px !important;
          right: 4px !important;
          top: 2px !important;
        }
        .obstruction-map-popup .mapboxgl-popup-close-button:hover {
          color: #F1F5F9 !important;
          background: transparent !important;
        }
        .obstruction-map-popup .mapboxgl-popup-tip {
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
