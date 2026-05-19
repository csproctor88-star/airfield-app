'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { initGoogleMaps, isGoogleMapsConfigured, GOOGLE_MAP_OPTIONS } from '@/lib/google-maps'
import { applyMapProvider } from '@/lib/map-providers'
import { useInstallation } from '@/lib/installation-context'
import { parsePhotoPaths, type ObstructionRow } from '@/lib/supabase/obstructions'

type Props = {
  evaluations: ObstructionRow[]
}

type StatusFilter = 'all' | 'violation' | 'clear'

export default function ObstructionMapViewGoogle({ evaluations }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([])
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const { runways, installationId, mapProvider } = useInstallation()

  const configured = isGoogleMapsConfigured()

  // Stable callback refs
  const evaluationsRef = useRef(evaluations)
  evaluationsRef.current = evaluations
  const statusFilterRef = useRef(statusFilter)
  statusFilterRef.current = statusFilter

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

  // Initialize map — re-create when installation changes
  useEffect(() => {
    if (!mapContainer.current || !configured) return

    let cancelled = false

    initGoogleMaps().then(() => {
      if (cancelled || !mapContainer.current) return

      // Clean up previous
      if (mapRef.current) {
        markersRef.current.forEach((m) => (m.map = null))
        markersRef.current = []
        infoWindowRef.current?.close()
      }

      const rwy = runways[0]
      const centerLat = rwy
        ? ((rwy.end1_latitude ?? 0) + (rwy.end2_latitude ?? 0)) / 2
        : 42.6139
      const centerLng = rwy
        ? ((rwy.end1_longitude ?? 0) + (rwy.end2_longitude ?? 0)) / 2
        : -82.8369

      const m = new google.maps.Map(mapContainer.current!, {
        ...GOOGLE_MAP_OPTIONS,
        center: { lat: centerLat, lng: centerLng },
        zoom: 13,
        mapId: 'obstruction-map',
      })

      applyMapProvider(m, mapProvider)

      mapRef.current = m
      infoWindowRef.current = new google.maps.InfoWindow()
      setMapLoaded(true)
    })

    return () => {
      cancelled = true
      markersRef.current.forEach((m) => (m.map = null))
      markersRef.current = []
      infoWindowRef.current?.close()
      mapRef.current = null
      setMapLoaded(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, installationId, mapProvider])

  // Add/update markers
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    // Remove existing markers
    markersRef.current.forEach((m) => (m.map = null))
    markersRef.current = []
    infoWindowRef.current?.close()

    const bounds = new google.maps.LatLngBounds()

    visibleEvaluations.forEach((ev) => {
      const lat = ev.latitude!
      const lng = ev.longitude!
      const isViolation = ev.has_violation
      const violatedCount = (ev.violated_surfaces || []).length
      const photos = parsePhotoPaths(ev.photo_storage_path)
      const firstPhoto = photos[0]

      // Build marker element
      const el = document.createElement('div')
      el.style.cursor = 'pointer'
      el.style.width = '26px'
      el.style.height = '26px'
      el.style.borderRadius = '50%'
      el.style.border = '2.5px solid #FFFFFF'
      el.style.background = isViolation ? '#EF4444' : '#22C55E'
      el.style.boxShadow = '0 0 8px rgba(0,0,0,0.5)'
      el.style.transition = 'transform 0.15s ease'
      el.style.display = 'flex'
      el.style.alignItems = 'center'
      el.style.justifyContent = 'center'
      el.style.fontSize = '13px'
      el.style.lineHeight = '1'
      el.textContent = isViolation ? '\u26A0' : '\u2713'

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.3)'
      })
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)'
      })

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current!,
        position: { lat, lng },
        content: el,
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

      const infoContent = `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:260px;line-height:1.4;">
          ${photoHtml}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-size:11px;font-weight:700;color:#64748B;font-family:monospace;">${ev.display_id}</span>
            ${statusBadge}
          </div>
          ${ev.notes ? `<div style="font-size:13px;font-weight:700;color:#1E293B;margin-bottom:4px;">${ev.notes}</div>` : ''}
          <div style="font-size:11px;color:#64748B;">
            <strong style="color:#334155;">${ev.object_height_agl}</strong> ft AGL
            &bull; <strong style="color:#334155;">${ev.distance_from_centerline_ft?.toFixed(0) ?? '\u2014'}</strong> ft from CL
            ${isViolation ? ` &bull; <span style="color:#EF4444;">${violatedCount} violated</span>` : ''}
          </div>
          ${ev.controlling_surface ? `<div style="font-size:10px;color:#94A3B8;margin-top:2px;">Controlling: ${ev.controlling_surface}</div>` : ''}
          ${violatedHtml}
          <a href="/obstructions/${ev.id}" style="display:inline-block;margin-top:6px;font-size:11px;font-weight:700;color:#0891B2;text-decoration:none;">
            View Details &rarr;
          </a>
        </div>
      `

      marker.addListener('click', () => {
        infoWindowRef.current?.setContent(infoContent)
        infoWindowRef.current?.open({
          anchor: marker,
          map: mapRef.current,
        })
      })

      markersRef.current.push(marker)
      bounds.extend({ lat, lng })
    })

    // Fit bounds
    if (visibleEvaluations.length > 1) {
      mapRef.current.fitBounds(bounds, 60)
    } else if (visibleEvaluations.length === 1) {
      mapRef.current.setCenter({
        lat: visibleEvaluations[0].latitude!,
        lng: visibleEvaluations[0].longitude!,
      })
      mapRef.current.setZoom(14)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, evaluations, statusFilter])

  const handleLegendClick = useCallback((filter: StatusFilter) => {
    setStatusFilter((prev) => (prev === filter ? 'all' : filter))
  }, [])

  if (!configured) {
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
          Google Maps API Key Required
        </div>
        <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', lineHeight: 1.5 }}>
          Add your Google Maps API key to{' '}
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
          aspectRatio: '3 / 4',
          maxHeight: '70vh',
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid var(--color-border-mid)',
        }}
      />
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
            zIndex: 1,
          }}
        >
          <div
            onClick={() => setLegendOpen((o) => !o)}
            style={{ fontSize: '9px', fontWeight: 700, color: '#64748B', marginBottom: legendOpen ? 2 : 0, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}
          >
            Filter by Status
            <span style={{ fontSize: '8px' }}>{legendOpen ? '\u25B2' : '\u25BC'}</span>
          </div>
          {legendOpen && (
            <>
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
            </>
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
            zIndex: 1,
          }}
        >
          {visibleEvaluations.length}{statusFilter !== 'all' ? ` / ${geoEvaluations.length}` : ''} pinned
          {noGeoCount > 0 && (
            <span style={{ color: '#64748B' }}> &bull; {noGeoCount} no GPS</span>
          )}
        </div>
      )}
    </div>
  )
}
