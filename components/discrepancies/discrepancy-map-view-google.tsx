'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { initGoogleMaps, isGoogleMapsConfigured, GOOGLE_MAP_OPTIONS } from '@/lib/google-maps'
import { useInstallation } from '@/lib/installation-context'
import { DISCREPANCY_TYPES } from '@/lib/constants'
import { renderLucideToSvgString } from '@/lib/render-lucide-svg'
import { ClipboardList, type LucideIcon } from 'lucide-react'
import type { DiscrepancyRow } from '@/lib/supabase/discrepancies'

type Props = {
  discrepancies: DiscrepancyRow[]
  daysOpenFn: (createdAt: string) => number
  photoMap?: Record<string, string> // discrepancy_id -> first photo URL
  /** Controlled type filter -- when provided, the map uses this instead of internal state */
  activeTypeFilter?: string | null
  /** Callback when legend item is clicked */
  onTypeFilterChange?: (typeValue: string | null) => void
}

// Map discrepancy type value -> lucide icon component from constants
const TYPE_ICON: Record<string, LucideIcon> = Object.fromEntries(
  DISCREPANCY_TYPES.map((t) => [t.value, t.icon]),
)
const TYPE_COLOR: Record<string, string> = Object.fromEntries(
  DISCREPANCY_TYPES.map((t) => [t.value, t.color]),
)

function getTypeIcon(typeStr: string): LucideIcon {
  const first = typeStr.split(',')[0]?.trim()
  return TYPE_ICON[first || ''] || ClipboardList
}

function getTypeColor(typeStr: string): string {
  const first = typeStr.split(',')[0]?.trim()
  return TYPE_COLOR[first || ''] || '#FFFFFF'
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

export default function DiscrepancyMapViewGoogle({
  discrepancies,
  daysOpenFn,
  photoMap,
  activeTypeFilter: controlledTypeFilter,
  onTypeFilterChange,
}: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([])
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)
  const [internalTypeFilter, setInternalTypeFilter] = useState<string | null>(null)
  const { runways, installationId } = useInstallation()

  // Use controlled filter if provided, otherwise internal
  const activeTypeFilter =
    controlledTypeFilter !== undefined ? controlledTypeFilter : internalTypeFilter

  // Refs for callbacks to avoid stale closures
  const daysOpenFnRef = useRef(daysOpenFn)
  daysOpenFnRef.current = daysOpenFn
  const photoMapRef = useRef(photoMap)
  photoMapRef.current = photoMap

  const configured = isGoogleMapsConfigured()

  // Filter discrepancies with GPS coordinates
  const geoDiscrepancies = discrepancies.filter(
    (d) => d.latitude != null && d.longitude != null,
  )

  // Apply type filter from legend
  const visibleDiscrepancies = activeTypeFilter
    ? geoDiscrepancies.filter((d) => getTypes(d.type).includes(activeTypeFilter))
    : geoDiscrepancies

  const noGeoCount = discrepancies.length - geoDiscrepancies.length

  // Initialize map -- re-create when installation changes
  useEffect(() => {
    if (!mapContainer.current || !configured) return

    let cancelled = false

    // Clean up previous map
    if (mapRef.current) {
      markersRef.current.forEach((m) => (m.map = null))
      markersRef.current = []
      if (infoWindowRef.current) infoWindowRef.current.close()
      mapRef.current = null
      setMapLoaded(false)
    }

    const rwy = runways[0]
    const centerLat = rwy
      ? ((rwy.end1_latitude ?? 0) + (rwy.end2_latitude ?? 0)) / 2
      : 42.6139
    const centerLng = rwy
      ? ((rwy.end1_longitude ?? 0) + (rwy.end2_longitude ?? 0)) / 2
      : -82.8369

    initGoogleMaps()
      .then(() => {
        if (cancelled || !mapContainer.current) return

        const m = new google.maps.Map(mapContainer.current, {
          ...GOOGLE_MAP_OPTIONS,
          center: { lat: centerLat, lng: centerLng },
          zoom: 12,
          mapId: 'discrepancy-map',
        })

        mapRef.current = m
        infoWindowRef.current = new google.maps.InfoWindow({ maxWidth: 360 })

        m.addListener('tilesloaded', () => {
          if (!cancelled) setMapLoaded(true)
        })
      })
      .catch((err) => {
        console.error('Google Maps init failed:', err)
      })

    return () => {
      cancelled = true
      if (mapRef.current) {
        markersRef.current.forEach((m) => (m.map = null))
        markersRef.current = []
        if (infoWindowRef.current) infoWindowRef.current.close()
        mapRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, installationId])

  // Add/update markers when discrepancies, type filter, or map changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    // Remove existing markers
    markersRef.current.forEach((m) => (m.map = null))
    markersRef.current = []

    if (infoWindowRef.current) infoWindowRef.current.close()

    const map = mapRef.current
    const iw = infoWindowRef.current!

    visibleDiscrepancies.forEach((d) => {
      const lat = d.latitude!
      const lng = d.longitude!
      const Icon = getTypeIcon(d.type)
      const color = getTypeColor(d.type)

      // Build marker element -- 30px circle with lucide icon
      const el = document.createElement('div')
      el.style.width = '30px'
      el.style.height = '30px'
      el.style.borderRadius = '50%'
      el.style.border = '2px solid #FFFFFF'
      el.style.background = 'rgba(15, 23, 42, 0.85)'
      el.style.boxShadow = '0 0 8px rgba(0,0,0,0.5)'
      el.style.display = 'flex'
      el.style.alignItems = 'center'
      el.style.justifyContent = 'center'
      el.style.cursor = 'pointer'
      el.style.transition = 'transform 0.15s ease'
      el.innerHTML = renderLucideToSvgString(Icon, { size: 16, color })

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.3)'
      })
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)'
      })

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat, lng },
        content: el,
      })

      marker.addListener('click', () => {
        const days = daysOpenFnRef.current(d.created_at)
        const typeLabel = getTypeLabel(d.type)
        const photoUrl = photoMapRef.current?.[d.id]

        const photoHtml = photoUrl
          ? `<img src="${photoUrl}" alt="photo" style="width:100%;max-height:120px;object-fit:cover;border-radius:6px;margin-bottom:6px;display:block;" onerror="this.style.display='none'" />`
          : ''

        const html = `
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

        iw.setContent(html)
        iw.open({ anchor: marker, map })
      })

      markersRef.current.push(marker)
    })

    // Fit bounds
    if (visibleDiscrepancies.length > 1) {
      const bounds = new google.maps.LatLngBounds()
      visibleDiscrepancies.forEach((d) => {
        bounds.extend({ lat: d.latitude!, lng: d.longitude! })
      })
      map.fitBounds(bounds, 80)
      // Clamp max zoom after fitBounds
      const listener = google.maps.event.addListenerOnce(map, 'idle', () => {
        const z = map.getZoom()
        if (z != null && z > 14) map.setZoom(14)
      })
      // Safety cleanup
      setTimeout(() => google.maps.event.removeListener(listener), 3000)
    } else if (visibleDiscrepancies.length === 1) {
      map.panTo({
        lat: visibleDiscrepancies[0].latitude!,
        lng: visibleDiscrepancies[0].longitude!,
      })
      map.setZoom(14)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, discrepancies, photoMap, activeTypeFilter])

  const handleLegendClick = useCallback(
    (typeValue: string) => {
      const next = activeTypeFilter === typeValue ? null : typeValue
      if (onTypeFilterChange) {
        onTypeFilterChange(next)
      } else {
        setInternalTypeFilter(next)
      }
    },
    [activeTypeFilter, onTypeFilterChange],
  )

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
        <div
          style={{
            fontSize: 'var(--fs-md)',
            fontWeight: 700,
            color: 'var(--color-text-2)',
            marginBottom: 8,
          }}
        >
          Google Maps API Key Required
        </div>
        <div
          style={{
            fontSize: 'var(--fs-base)',
            color: 'var(--color-text-3)',
            lineHeight: 1.5,
          }}
        >
          Add your Google Maps API key to{' '}
          <code style={{ color: 'var(--color-accent)' }}>.env.local</code>
        </div>
      </div>
    )
  }

  // Build legend entries from the discrepancy types actually present in the data
  const presentTypes = new Set(geoDiscrepancies.flatMap((d) => getTypes(d.type)))
  const legendItems = DISCREPANCY_TYPES.filter((t) => presentTypes.has(t.value))

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
          transition: 'height 0.3s ease',
        }}
      />
      {/* Legend -- top-left, clickable type filter */}
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
            zIndex: 1,
          }}
        >
          <div
            onClick={() => setLegendOpen((o) => !o)}
            style={{
              fontSize: '9px',
              fontWeight: 700,
              color: '#64748B',
              marginBottom: legendOpen ? 2 : 0,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
            }}
          >
            Filter by Type
            <span style={{ fontSize: '8px' }}>{legendOpen ? '\u25B2' : '\u25BC'}</span>
          </div>
          {legendOpen && (
            <>
              {legendItems.map((t) => {
                const isActive = activeTypeFilter === t.value
                const isDimmed = activeTypeFilter !== null && !isActive
                const Icon = t.icon
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
                      background: isActive
                        ? 'rgba(34, 211, 238, 0.12)'
                        : 'transparent',
                      opacity: isDimmed ? 0.4 : 1,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        width: 16,
                        height: 12,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: t.color,
                        opacity: isDimmed ? 0.5 : 1,
                      }}
                    >
                      <Icon size={12} strokeWidth={2.25} />
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        color: isActive ? '#22D3EE' : '#CBD5E1',
                        fontWeight: 600,
                      }}
                    >
                      {t.label}
                    </span>
                  </div>
                )
              })}
              {activeTypeFilter && (
                <div
                  onClick={() =>
                    onTypeFilterChange
                      ? onTypeFilterChange(null)
                      : setInternalTypeFilter(null)
                  }
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
      {/* Empty overlay -- shown when no geo-coded discrepancies match */}
      {mapLoaded && visibleDiscrepancies.length === 0 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 10,
            background: 'rgba(4, 7, 12, 0.75)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 5,
            pointerEvents: 'none',
          }}
        >
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
          <div
            style={{
              fontSize: 'var(--fs-base)',
              color: 'var(--color-text-3)',
              lineHeight: 1.5,
              textAlign: 'center',
              maxWidth: 280,
            }}
          >
            {geoDiscrepancies.length === 0
              ? 'None of the filtered discrepancies have GPS coordinates attached.'
              : 'No discrepancies match the selected type filter.'}
          </div>
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
          {visibleDiscrepancies.length}
          {activeTypeFilter ? ` / ${geoDiscrepancies.length}` : ''} pinned
          {noGeoCount > 0 && (
            <span style={{ color: '#64748B' }}> &bull; {noGeoCount} no GPS</span>
          )}
        </div>
      )}

      {/* Dark-theme InfoWindow styling — close-button overlay rules
          live in app/globals.css; here we only set the dark chrome. */}
      <style jsx global>{`
        .gm-style-iw-c {
          background: rgba(15, 23, 42, 0.95) !important;
          border: 1px solid rgba(148, 163, 184, 0.2) !important;
          border-radius: 8px !important;
          padding: 0 !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
        }
        .gm-style-iw-d {
          overflow: auto !important;
          padding: 10px 30px 10px 12px !important;
        }
        .gm-style-iw-tc::after {
          background: rgba(15, 23, 42, 0.95) !important;
        }
        .gm-ui-hover-effect {
          filter: invert(0.6) !important;
        }
      `}</style>
    </div>
  )
}
