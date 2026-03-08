'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useInstallation } from '@/lib/installation-context'
import { isMapboxConfigured } from '@/lib/utils'
import { WAIVER_CLASSIFICATIONS, WAIVER_STATUS_CONFIG } from '@/lib/constants'
import type { WaiverRow } from '@/lib/supabase/waivers'

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

export default function WaiverMapView({ waivers }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)
  const [activeClassFilter, setActiveClassFilter] = useState<string | null>(null)
  const { runways, installationId } = useInstallation()

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const mapboxReady = isMapboxConfigured()

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
  }, [token, installationId])

  // Add/update markers when waivers, classification filter, or map changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // Remove existing markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    visibleWaivers.forEach((w) => {
      const lat = w.location_lat!
      const lng = w.location_lng!
      const emoji = getClassEmoji(w.classification)
      const classLabel = getClassLabel(w.classification)
      const statusConf = WAIVER_STATUS_CONFIG[w.status as keyof typeof WAIVER_STATUS_CONFIG]

      // Use inner div for scale so we don't overwrite Mapbox's transform
      const el = document.createElement('div')
      el.style.cursor = 'pointer'
      const inner = document.createElement('div')
      inner.style.width = '30px'
      inner.style.height = '30px'
      inner.style.borderRadius = '50%'
      inner.style.border = '2px solid #FFFFFF'
      inner.style.background = 'rgba(15, 23, 42, 0.85)'
      inner.style.boxShadow = '0 0 8px rgba(0,0,0,0.5)'
      inner.style.transition = 'transform 0.15s ease'
      inner.style.display = 'flex'
      inner.style.alignItems = 'center'
      inner.style.justifyContent = 'center'
      inner.style.fontSize = '15px'
      inner.style.lineHeight = '1'
      inner.textContent = emoji
      el.appendChild(inner)

      el.addEventListener('mouseenter', () => {
        inner.style.transform = 'scale(1.3)'
      })
      el.addEventListener('mouseleave', () => {
        inner.style.transform = 'scale(1)'
      })

      const statusBadge = statusConf
        ? `<span style="font-size:10px;font-weight:800;padding:1px 6px;border-radius:4px;background:${statusConf.bg};color:${statusConf.color};">${statusConf.label}</span>`
        : ''

      const popupHtml = `
        <div style="font-family:system-ui,-apple-system,sans-serif;min-width:240px;max-width:340px;line-height:1.4;">
          <div style="margin-bottom:6px;">
            <span style="font-size:13px;font-weight:800;color:#F59E0B;font-family:monospace;display:block;margin-bottom:4px;">${w.waiver_number}</span>
            <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">
              ${statusBadge}
              <span style="font-size:11px;font-weight:600;color:#CBD5E1;background:rgba(148,163,184,0.12);border:1px solid rgba(148,163,184,0.2);border-radius:4px;padding:1px 6px;">${emoji} ${classLabel}</span>
            </div>
          </div>
          <div style="font-size:14px;font-weight:700;color:#F1F5F9;margin-bottom:6px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;line-height:1.4;">${w.description}</div>
          <div style="font-size:12px;color:#94A3B8;">
            ${w.location_description || ''}${w.proponent ? ' &bull; ' + w.proponent : ''}
          </div>
          ${w.criteria_impact ? `<div style="font-size:11px;color:#F59E0B;margin-top:3px;">${w.criteria_impact}</div>` : ''}
          <a href="/waivers/${w.id}" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:700;color:#22D3EE;text-decoration:none;">
            View Details &rarr;
          </a>
        </div>
      `

      const popup = new mapboxgl.Popup({
        offset: 18,
        closeButton: true,
        closeOnClick: false,
        maxWidth: '360px',
        className: 'waiver-map-popup',
      }).setHTML(popupHtml)

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map.current!)

      markersRef.current.push(marker)
    })

    // Fit bounds
    if (visibleWaivers.length > 1) {
      const bounds = new mapboxgl.LngLatBounds()
      visibleWaivers.forEach((w) => {
        bounds.extend([w.location_lng!, w.location_lat!])
      })
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 800 })
    } else if (visibleWaivers.length === 1) {
      map.current.flyTo({
        center: [visibleWaivers[0].location_lng!, visibleWaivers[0].location_lat!],
        zoom: 14,
        duration: 800,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, waivers, activeClassFilter])

  const handleLegendClick = useCallback((classValue: string) => {
    setActiveClassFilter((prev) => (prev === classValue ? null : classValue))
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
          }}
        >
          <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748B', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Filter by Type
          </div>
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
          {visibleWaivers.length}{activeClassFilter ? ` / ${geoWaivers.length}` : ''} pinned
          {noGeoCount > 0 && (
            <span style={{ color: '#64748B' }}> &bull; {noGeoCount} no GPS</span>
          )}
        </div>
      )}

      {/* Popup dark-theme CSS + hide Mapbox branding */}
      <style jsx global>{`
        .waiver-map-popup .mapboxgl-popup-content {
          background: rgba(15, 23, 42, 0.95) !important;
          border: 1px solid rgba(148, 163, 184, 0.2) !important;
          border-radius: 8px !important;
          padding: 10px 12px !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
        }
        .waiver-map-popup .mapboxgl-popup-close-button {
          color: #94A3B8 !important;
          font-size: 16px !important;
          right: 4px !important;
          top: 2px !important;
        }
        .waiver-map-popup .mapboxgl-popup-close-button:hover {
          color: #F1F5F9 !important;
          background: transparent !important;
        }
        .waiver-map-popup .mapboxgl-popup-tip {
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
