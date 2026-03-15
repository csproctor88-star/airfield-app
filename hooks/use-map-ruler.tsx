import { useEffect, useRef, useCallback, useState } from 'react'
import mapboxgl from 'mapbox-gl'

type RulerPoint = { lng: number; lat: number }

const FT_PER_DEG_LAT = 364000 // approximate feet per degree latitude
const SRC_ID = 'ruler-src'
const LINE_LAYER = 'ruler-line'
const DOTS_LAYER = 'ruler-dots'
const LABEL_LAYER = 'ruler-labels'
const SEGMENT_LABEL_LAYER = 'ruler-segment-labels'

function haversineFt(a: RulerPoint, b: RulerPoint): number {
  const R = 6371000 // Earth radius in meters
  const toRad = Math.PI / 180
  const dLat = (b.lat - a.lat) * toRad
  const dLon = (b.lng - a.lng) * toRad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h)) * 3.28084 // meters to feet
}

function formatDist(ft: number): string {
  if (ft >= 5280) return `${(ft / 5280).toFixed(2)} mi`
  return `${Math.round(ft)} ft`
}

/**
 * Reusable map ruler hook. When `active` is true, clicks add measurement points.
 * Double-click finishes the current measurement. Press Escape or toggle off to clear.
 *
 * Returns: { active, toggle, clear, points, totalFt }
 */
export function useMapRuler(mapRef: React.RefObject<mapboxgl.Map | null>, enabled: boolean) {
  const [points, setPoints] = useState<RulerPoint[]>([])
  const [active, setActive] = useState(false)
  const pointsRef = useRef(points)
  pointsRef.current = points

  const clear = useCallback(() => {
    setPoints([])
  }, [])

  const toggle = useCallback(() => {
    setActive(prev => {
      if (prev) setPoints([]) // clear on deactivate
      return !prev
    })
  }, [])

  // Compute total distance
  let totalFt = 0
  for (let i = 1; i < points.length; i++) {
    totalFt += haversineFt(points[i - 1], points[i])
  }

  // Segment distances for labels
  const segments: { midpoint: RulerPoint; distFt: number }[] = []
  for (let i = 1; i < points.length; i++) {
    const d = haversineFt(points[i - 1], points[i])
    segments.push({
      midpoint: {
        lng: (points[i - 1].lng + points[i].lng) / 2,
        lat: (points[i - 1].lat + points[i].lat) / 2,
      },
      distFt: d,
    })
  }

  // Click handler
  useEffect(() => {
    const m = mapRef.current
    if (!m || !active || !enabled) return

    const onClick = (e: mapboxgl.MapMouseEvent) => {
      // Don't intercept double-clicks
      setPoints(prev => [...prev, { lng: e.lngLat.lng, lat: e.lngLat.lat }])
    }

    const onDblClick = (e: mapboxgl.MapMouseEvent) => {
      e.preventDefault()
      // Finish measurement — don't add the double-click point (it was already added by onClick)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPoints([])
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        setPoints(prev => prev.slice(0, -1))
      }
    }

    m.on('click', onClick)
    m.on('dblclick', onDblClick)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      m.off('click', onClick)
      m.off('dblclick', onDblClick)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [mapRef, active, enabled])

  // Cursor
  useEffect(() => {
    const m = mapRef.current
    if (!m) return
    if (active && enabled) {
      m.getCanvas().style.cursor = 'crosshair'
      return () => { m.getCanvas().style.cursor = '' }
    }
  }, [mapRef, active, enabled])

  // Render ruler layers
  useEffect(() => {
    const m = mapRef.current
    if (!m) return

    const render = () => {
      // Clean previous
      if (m.getLayer(SEGMENT_LABEL_LAYER)) m.removeLayer(SEGMENT_LABEL_LAYER)
      if (m.getLayer(LABEL_LAYER)) m.removeLayer(LABEL_LAYER)
      if (m.getLayer(DOTS_LAYER)) m.removeLayer(DOTS_LAYER)
      if (m.getLayer(LINE_LAYER)) m.removeLayer(LINE_LAYER)
      if (m.getSource(SRC_ID)) m.removeSource(SRC_ID)

      if (points.length === 0) return

      const features: GeoJSON.Feature[] = []

      // Line
      if (points.length >= 2) {
        features.push({
          type: 'Feature' as const,
          properties: { type: 'line' },
          geometry: {
            type: 'LineString' as const,
            coordinates: points.map(p => [p.lng, p.lat]),
          },
        })
      }

      // Dots at each point with index
      for (let i = 0; i < points.length; i++) {
        features.push({
          type: 'Feature' as const,
          properties: { type: 'dot', index: i + 1 },
          geometry: {
            type: 'Point' as const,
            coordinates: [points[i].lng, points[i].lat],
          },
        })
      }

      // Segment midpoint labels
      for (const seg of segments) {
        features.push({
          type: 'Feature' as const,
          properties: { type: 'segment', dist: formatDist(seg.distFt) },
          geometry: {
            type: 'Point' as const,
            coordinates: [seg.midpoint.lng, seg.midpoint.lat],
          },
        })
      }

      m.addSource(SRC_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features },
      })

      // Dashed line
      if (points.length >= 2) {
        m.addLayer({
          id: LINE_LAYER,
          type: 'line',
          source: SRC_ID,
          filter: ['==', ['get', 'type'], 'line'],
          paint: {
            'line-color': '#FFFFFF',
            'line-width': 2,
            'line-dasharray': [6, 3],
          },
        })
      }

      // Dots
      m.addLayer({
        id: DOTS_LAYER,
        type: 'circle',
        source: SRC_ID,
        filter: ['==', ['get', 'type'], 'dot'],
        paint: {
          'circle-radius': 5,
          'circle-color': '#FFFFFF',
          'circle-stroke-color': '#000',
          'circle-stroke-width': 2,
        },
      })

      // Point index labels
      m.addLayer({
        id: LABEL_LAYER,
        type: 'symbol',
        source: SRC_ID,
        filter: ['==', ['get', 'type'], 'dot'],
        layout: {
          'text-field': ['to-string', ['get', 'index']],
          'text-size': 10,
          'text-offset': [0, -1.4],
          'text-anchor': 'bottom',
          'text-allow-overlap': true,
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
        },
        paint: {
          'text-color': '#FFFFFF',
          'text-halo-color': '#000',
          'text-halo-width': 1.5,
        },
      })

      // Segment distance labels
      if (segments.length > 0) {
        m.addLayer({
          id: SEGMENT_LABEL_LAYER,
          type: 'symbol',
          source: SRC_ID,
          filter: ['==', ['get', 'type'], 'segment'],
          layout: {
            'text-field': ['get', 'dist'],
            'text-size': 12,
            'text-offset': [0, 0],
            'text-anchor': 'center',
            'text-allow-overlap': true,
            'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          },
          paint: {
            'text-color': '#FFD700',
            'text-halo-color': '#000',
            'text-halo-width': 2,
          },
        })
      }
    }

    // Only render when style is loaded
    if (m.isStyleLoaded()) {
      render()
    } else {
      m.once('styledata', render)
    }

    return () => {
      // Cleanup on unmount
      try {
        if (m.getLayer(SEGMENT_LABEL_LAYER)) m.removeLayer(SEGMENT_LABEL_LAYER)
        if (m.getLayer(LABEL_LAYER)) m.removeLayer(LABEL_LAYER)
        if (m.getLayer(DOTS_LAYER)) m.removeLayer(DOTS_LAYER)
        if (m.getLayer(LINE_LAYER)) m.removeLayer(LINE_LAYER)
        if (m.getSource(SRC_ID)) m.removeSource(SRC_ID)
      } catch { /* map may be destroyed */ }
    }
  }, [mapRef, points, segments])

  return { active, toggle, clear, points, totalFt, segments }
}

/**
 * Ruler toggle button + readout. Drop this into any map overlay.
 */
export function RulerButton({
  active,
  toggle,
  clear,
  totalFt,
  points,
  segments,
  style,
}: {
  active: boolean
  toggle: () => void
  clear: () => void
  totalFt: number
  points: RulerPoint[]
  segments: { midpoint: RulerPoint; distFt: number }[]
  style?: React.CSSProperties
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
      <button
        onClick={toggle}
        title={active ? 'Disable ruler (Esc to clear)' : 'Measure distance'}
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          border: active ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.3)',
          background: active ? 'rgba(255,215,0,0.2)' : 'rgba(0,0,0,0.6)',
          color: active ? '#FFD700' : '#FFF',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          fontWeight: 700,
          fontFamily: 'inherit',
          lineHeight: 1,
          padding: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 22L22 2" />
          <path d="M6 18L8 16" />
          <path d="M10 14L12 12" />
          <path d="M14 10L16 8" />
          <path d="M18 6L20 4" />
          <circle cx="2" cy="22" r="1" fill="currentColor" />
          <circle cx="22" cy="2" r="1" fill="currentColor" />
        </svg>
      </button>
      {active && points.length >= 2 && (
        <div style={{
          background: 'rgba(0,0,0,0.8)',
          borderRadius: 6,
          padding: '4px 8px',
          fontSize: 11,
          fontWeight: 700,
          color: '#FFD700',
          whiteSpace: 'nowrap',
          fontFamily: 'monospace',
          border: '1px solid rgba(255,215,0,0.3)',
        }}>
          {formatDist(totalFt)}
          {points.length > 2 && (
            <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 400, marginLeft: 4 }}>
              ({points.length - 1} seg)
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); clear() }}
            style={{
              marginLeft: 6,
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              fontSize: 11,
              padding: 0,
              fontFamily: 'inherit',
            }}
            title="Clear measurement"
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
