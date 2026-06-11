'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { initGoogleMaps, isGoogleMapsConfigured, GOOGLE_MAP_OPTIONS } from '@/lib/google-maps'
import { applyMapProvider } from '@/lib/map-providers'
import { useInstallation } from '@/lib/installation-context'
import { WAIVER_CLASSIFICATIONS, WAIVER_STATUS_CONFIG } from '@/lib/constants'
import type { WaiverRow } from '@/lib/supabase/waivers'
import { escapeHtml } from '@/lib/utils'

type Props = {
  waivers: WaiverRow[]
}

const CLASS_EMOJI: Record<string, string> = Object.fromEntries(
  WAIVER_CLASSIFICATIONS.map((c) => [c.value, c.emoji]),
)

function getClassEmoji(classification: string): string {
  return CLASS_EMOJI[classification] || '\uD83D\uDCCB'
}

function getClassLabel(classification: string): string {
  const c = WAIVER_CLASSIFICATIONS.find((t) => t.value === classification)
  return c ? c.label : classification
}

export default function WaiverMapViewGoogle({ waivers }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([])
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)
  const [activeClassFilter, setActiveClassFilter] = useState<string | null>(null)
  const { runways, installationId, mapProvider } = useInstallation()

  const configured = isGoogleMapsConfigured()

  // Stable callback refs
  const waiversRef = useRef(waivers)
  waiversRef.current = waivers
  const activeClassFilterRef = useRef(activeClassFilter)
  activeClassFilterRef.current = activeClassFilter

  // Filter waivers with GPS coordinates
  const geoWaivers = waivers.filter(
    (w) => w.location_lat != null && w.location_lng != null,
  )

  // Apply classification filter from legend
  const visibleWaivers = activeClassFilter
    ? geoWaivers.filter((w) => w.classification === activeClassFilter)
    : geoWaivers

  const noGeoCount = waivers.length - geoWaivers.length

  // Initialize map
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
        mapId: 'waiver-map',
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

  // Add/update markers when waivers, classification filter, or map changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    // Remove existing markers
    markersRef.current.forEach((m) => (m.map = null))
    markersRef.current = []
    infoWindowRef.current?.close()

    const bounds = new google.maps.LatLngBounds()

    visibleWaivers.forEach((w) => {
      const lat = w.location_lat!
      const lng = w.location_lng!
      const emoji = getClassEmoji(w.classification)
      const classLabel = getClassLabel(w.classification)
      const statusConf = WAIVER_STATUS_CONFIG[w.status as keyof typeof WAIVER_STATUS_CONFIG]

      // Build marker element
      const el = document.createElement('div')
      el.style.cursor = 'pointer'
      el.style.width = '30px'
      el.style.height = '30px'
      el.style.borderRadius = '50%'
      el.style.border = '2px solid #FFFFFF'
      el.style.background = 'rgba(15, 23, 42, 0.85)'
      el.style.boxShadow = '0 0 8px rgba(0,0,0,0.5)'
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

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current!,
        position: { lat, lng },
        content: el,
      })

      // InfoWindow content
      const statusBadge = statusConf
        ? `<span style="font-size:10px;font-weight:800;padding:1px 6px;border-radius:4px;background:${statusConf.bg};color:${statusConf.color};">${statusConf.label}</span>`
        : ''

      const infoContent = `
        <div style="font-family:system-ui,-apple-system,sans-serif;min-width:240px;max-width:340px;line-height:1.4;">
          <div style="margin-bottom:6px;">
            <span style="font-size:13px;font-weight:800;color:#F59E0B;font-family:monospace;display:block;margin-bottom:4px;">${escapeHtml(w.waiver_number)}</span>
            <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">
              ${statusBadge}
              <span style="font-size:11px;font-weight:600;color:#CBD5E1;background:rgba(148,163,184,0.12);border:1px solid rgba(148,163,184,0.2);border-radius:4px;padding:1px 6px;">${emoji} ${classLabel}</span>
            </div>
          </div>
          <div style="font-size:14px;font-weight:700;color:#1E293B;margin-bottom:6px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;line-height:1.4;">${escapeHtml(w.description)}</div>
          <div style="font-size:12px;color:#64748B;">
            ${escapeHtml(w.location_description || '')}${w.proponent ? ' &bull; ' + escapeHtml(w.proponent) : ''}
          </div>
          ${w.criteria_impact ? `<div style="font-size:11px;color:#D97706;margin-top:3px;">${escapeHtml(w.criteria_impact)}</div>` : ''}
          <a href="/waivers/${w.id}" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:700;color:#0891B2;text-decoration:none;">
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
    if (visibleWaivers.length > 1) {
      mapRef.current.fitBounds(bounds, 60)
    } else if (visibleWaivers.length === 1) {
      mapRef.current.setCenter({
        lat: visibleWaivers[0].location_lat!,
        lng: visibleWaivers[0].location_lng!,
      })
      mapRef.current.setZoom(14)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, waivers, activeClassFilter])

  const handleLegendClick = useCallback((classValue: string) => {
    setActiveClassFilter((prev) => (prev === classValue ? null : classValue))
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

  if (geoWaivers.length === 0) {
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
          None of the filtered waivers have GPS coordinates.
          <br />
          Pin a location when creating waivers to see them on the map.
        </div>
      </div>
    )
  }

  // Build legend entries from the classification types actually present
  const presentClasses = new Set(geoWaivers.map((w) => w.classification))
  const legendItems = WAIVER_CLASSIFICATIONS.filter((c) => presentClasses.has(c.value))

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
      {/* Legend — top-left, clickable classification filter */}
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
            style={{ fontSize: '9px', fontWeight: 700, color: '#64748B', marginBottom: legendOpen ? 2 : 0, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}
          >
            Filter by Type
            <span style={{ fontSize: '8px' }}>{legendOpen ? '\u25B2' : '\u25BC'}</span>
          </div>
          {legendOpen && (
            <>
              {legendItems.map((c) => {
                const isActive = activeClassFilter === c.value
                const isDimmed = activeClassFilter !== null && !isActive
                return (
                  <div
                    key={c.value}
                    onClick={() => handleLegendClick(c.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '2px 4px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      background: isActive ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
                      opacity: isDimmed ? 0.4 : 1,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '12px', flexShrink: 0, width: 16, textAlign: 'center' }}>{c.emoji}</span>
                    <span style={{ fontSize: '10px', color: isActive ? '#F59E0B' : '#CBD5E1', fontWeight: 600 }}>{c.label}</span>
                  </div>
                )
              })}
              {activeClassFilter && (
                <div
                  onClick={() => setActiveClassFilter(null)}
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
          {visibleWaivers.length}{activeClassFilter ? ` / ${geoWaivers.length}` : ''} pinned
          {noGeoCount > 0 && (
            <span style={{ color: '#64748B' }}> &bull; {noGeoCount} no GPS</span>
          )}
        </div>
      )}
    </div>
  )
}
