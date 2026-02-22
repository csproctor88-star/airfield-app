'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { INSTALLATION } from '@/lib/constants'
import {
  type LatLon,
  type RunwayGeometry,
  getRunwayGeometry,
  generateRunwayPolygon,
  generatePrimarySurfacePolygon,
  generateClearZonePolygons,
  generateGradedAreaPolygons,
  generateApproachDeparturePolygons,
  generateStadiumPolygon,
  generateTransitionalPolygons,
  generateAPZPolygons,
} from '@/lib/calculations/geometry'
import { IMAGINARY_SURFACES } from '@/lib/calculations/obstructions'

type Props = {
  onPointSelected: (point: LatLon) => void
  selectedPoint: LatLon | null
  surfaceAtPoint: string | null
}

// Toggle group keys used for visibility state
type ToggleKey =
  | 'outer-horizontal'
  | 'conical'
  | 'inner-horizontal'
  | 'transitional'
  | 'approach-departure'
  | 'primary-surface'
  | 'clear-zone'
  | 'graded-area'
  | 'apz-i'
  | 'apz-ii'

// Map each toggle key to the Mapbox layer IDs it controls
const TOGGLE_LAYER_IDS: Record<ToggleKey, string[]> = {
  'outer-horizontal': ['fill-outer-horizontal', 'line-outer-horizontal'],
  'conical': ['fill-conical', 'line-conical'],
  'inner-horizontal': ['fill-inner-horizontal', 'line-inner-horizontal'],
  'transitional': ['fill-transitional-left', 'line-transitional-left', 'fill-transitional-right', 'line-transitional-right'],
  'approach-departure': ['fill-approach-end1', 'line-approach-end1', 'fill-approach-end2', 'line-approach-end2'],
  'primary-surface': ['fill-primary-surface', 'line-primary-surface'],
  'clear-zone': ['fill-clear-zone-end1', 'line-clear-zone-end1', 'fill-clear-zone-end2', 'line-clear-zone-end2'],
  'graded-area': ['fill-graded-area-end1', 'line-graded-area-end1', 'fill-graded-area-end2', 'line-graded-area-end2'],
  'apz-i': ['fill-apz-i-end1', 'line-apz-i-end1', 'fill-apz-i-end2', 'line-apz-i-end2'],
  'apz-ii': ['fill-apz-ii-end1', 'line-apz-ii-end1', 'fill-apz-ii-end2', 'line-apz-ii-end2'],
}

// Legend items: label, color, toggleKey, default visibility
const LEGEND_ITEMS: { label: string; color: string; toggleKey: ToggleKey; defaultOn: boolean }[] = [
  { label: 'Outer Horizontal', color: IMAGINARY_SURFACES.outer_horizontal.color, toggleKey: 'outer-horizontal', defaultOn: true },
  { label: 'Conical', color: IMAGINARY_SURFACES.conical.color, toggleKey: 'conical', defaultOn: true },
  { label: 'Inner Horizontal', color: IMAGINARY_SURFACES.inner_horizontal.color, toggleKey: 'inner-horizontal', defaultOn: true },
  { label: 'Transitional', color: IMAGINARY_SURFACES.transitional.color, toggleKey: 'transitional', defaultOn: true },
  { label: 'Approach/Departure', color: IMAGINARY_SURFACES.approach_departure.color, toggleKey: 'approach-departure', defaultOn: true },
  { label: 'Primary', color: IMAGINARY_SURFACES.primary.color, toggleKey: 'primary-surface', defaultOn: true },
  { label: 'Clear Zone', color: IMAGINARY_SURFACES.clear_zone.color, toggleKey: 'clear-zone', defaultOn: false },
  { label: 'Graded Portion of CZ', color: IMAGINARY_SURFACES.graded_area.color, toggleKey: 'graded-area', defaultOn: false },
  { label: 'APZ I', color: IMAGINARY_SURFACES.apz_i.color, toggleKey: 'apz-i', defaultOn: false },
  { label: 'APZ II', color: IMAGINARY_SURFACES.apz_ii.color, toggleKey: 'apz-ii', defaultOn: false },
]

const SURFACE_LAYERS = [
  { id: 'outer-horizontal', label: 'Outer Horizontal', color: IMAGINARY_SURFACES.outer_horizontal.color, opacity: 0.08 },
  { id: 'conical', label: 'Conical', color: IMAGINARY_SURFACES.conical.color, opacity: 0.1 },
  { id: 'inner-horizontal', label: 'Inner Horizontal', color: IMAGINARY_SURFACES.inner_horizontal.color, opacity: 0.12 },
  { id: 'transitional-left', label: 'Transitional', color: IMAGINARY_SURFACES.transitional.color, opacity: 0.15 },
  { id: 'transitional-right', label: 'Transitional', color: IMAGINARY_SURFACES.transitional.color, opacity: 0.15 },
  { id: 'approach-end1', label: 'Approach-Departure', color: IMAGINARY_SURFACES.approach_departure.color, opacity: 0.14 },
  { id: 'approach-end2', label: 'Approach-Departure', color: IMAGINARY_SURFACES.approach_departure.color, opacity: 0.14 },
  { id: 'apz-ii-end1', label: 'APZ II', color: IMAGINARY_SURFACES.apz_ii.color, opacity: 0.12 },
  { id: 'apz-ii-end2', label: 'APZ II', color: IMAGINARY_SURFACES.apz_ii.color, opacity: 0.12 },
  { id: 'apz-i-end1', label: 'APZ I', color: IMAGINARY_SURFACES.apz_i.color, opacity: 0.14 },
  { id: 'apz-i-end2', label: 'APZ I', color: IMAGINARY_SURFACES.apz_i.color, opacity: 0.14 },
  { id: 'clear-zone-end1', label: 'Clear Zone', color: IMAGINARY_SURFACES.clear_zone.color, opacity: 0.16 },
  { id: 'clear-zone-end2', label: 'Clear Zone', color: IMAGINARY_SURFACES.clear_zone.color, opacity: 0.16 },
  { id: 'primary-surface', label: 'Primary Surface', color: IMAGINARY_SURFACES.primary.color, opacity: 0.18 },
  { id: 'graded-area-end1', label: 'Graded Portion of Clear Zone', color: IMAGINARY_SURFACES.graded_area.color, opacity: 0.2 },
  { id: 'graded-area-end2', label: 'Graded Portion of Clear Zone', color: IMAGINARY_SURFACES.graded_area.color, opacity: 0.2 },
  { id: 'runway', label: 'Runway', color: '#FFFFFF', opacity: 0.5 },
]

function getRwy(): RunwayGeometry {
  return getRunwayGeometry(INSTALLATION.runways[0])
}

function buildSurfaceGeoJSON(rwy: RunwayGeometry) {
  const features: GeoJSON.Feature[] = []

  // Derive radii from UFC constants
  const innerHRadius = IMAGINARY_SURFACES.inner_horizontal.criteria.radius
  const conicalExtent = IMAGINARY_SURFACES.conical.criteria.horizontalExtent
  const outerHRadius = IMAGINARY_SURFACES.outer_horizontal.criteria.radius

  // Outer horizontal stadium
  const outerH = generateStadiumPolygon(rwy, outerHRadius, 64)
  features.push({
    type: 'Feature',
    properties: { id: 'outer-horizontal' },
    geometry: { type: 'Polygon', coordinates: [outerH] },
  })

  // Conical ring — draw full stadium; inner horizontal visually overlaps
  const conical = generateStadiumPolygon(rwy, innerHRadius + conicalExtent, 64)
  features.push({
    type: 'Feature',
    properties: { id: 'conical' },
    geometry: { type: 'Polygon', coordinates: [conical] },
  })

  // Inner horizontal stadium
  const innerH = generateStadiumPolygon(rwy, innerHRadius, 64)
  features.push({
    type: 'Feature',
    properties: { id: 'inner-horizontal' },
    geometry: { type: 'Polygon', coordinates: [innerH] },
  })

  // Transitional surfaces (left and right)
  const transitional = generateTransitionalPolygons(rwy)
  features.push({
    type: 'Feature',
    properties: { id: 'transitional-left' },
    geometry: { type: 'Polygon', coordinates: [transitional.left] },
  })
  features.push({
    type: 'Feature',
    properties: { id: 'transitional-right' },
    geometry: { type: 'Polygon', coordinates: [transitional.right] },
  })

  // Approach-departure trapezoids
  const approach = generateApproachDeparturePolygons(rwy)
  features.push({
    type: 'Feature',
    properties: { id: 'approach-end1' },
    geometry: { type: 'Polygon', coordinates: [approach.end1] },
  })
  features.push({
    type: 'Feature',
    properties: { id: 'approach-end2' },
    geometry: { type: 'Polygon', coordinates: [approach.end2] },
  })

  // APZ II (behind APZ I for correct z-ordering)
  const apz = generateAPZPolygons(rwy)
  features.push({
    type: 'Feature',
    properties: { id: 'apz-ii-end1' },
    geometry: { type: 'Polygon', coordinates: [apz.apz_ii_end1] },
  })
  features.push({
    type: 'Feature',
    properties: { id: 'apz-ii-end2' },
    geometry: { type: 'Polygon', coordinates: [apz.apz_ii_end2] },
  })

  // APZ I
  features.push({
    type: 'Feature',
    properties: { id: 'apz-i-end1' },
    geometry: { type: 'Polygon', coordinates: [apz.apz_i_end1] },
  })
  features.push({
    type: 'Feature',
    properties: { id: 'apz-i-end2' },
    geometry: { type: 'Polygon', coordinates: [apz.apz_i_end2] },
  })

  // Clear zones (3,000 ft x 3,000 ft at each end)
  const clearZones = generateClearZonePolygons(rwy)
  features.push({
    type: 'Feature',
    properties: { id: 'clear-zone-end1' },
    geometry: { type: 'Polygon', coordinates: [clearZones.end1] },
  })
  features.push({
    type: 'Feature',
    properties: { id: 'clear-zone-end2' },
    geometry: { type: 'Polygon', coordinates: [clearZones.end2] },
  })

  // Primary surface
  const primary = generatePrimarySurfacePolygon(rwy)
  features.push({
    type: 'Feature',
    properties: { id: 'primary-surface' },
    geometry: { type: 'Polygon', coordinates: [primary] },
  })

  // Graded areas (1,000 ft x 1,000 ft at each end)
  const gradedAreas = generateGradedAreaPolygons(rwy)
  features.push({
    type: 'Feature',
    properties: { id: 'graded-area-end1' },
    geometry: { type: 'Polygon', coordinates: [gradedAreas.end1] },
  })
  features.push({
    type: 'Feature',
    properties: { id: 'graded-area-end2' },
    geometry: { type: 'Polygon', coordinates: [gradedAreas.end2] },
  })

  // Runway pavement
  const runway = generateRunwayPolygon(rwy)
  features.push({
    type: 'Feature',
    properties: { id: 'runway' },
    geometry: { type: 'Polygon', coordinates: [runway] },
  })

  return {
    type: 'FeatureCollection' as const,
    features,
  }
}

// Build default toggle state from LEGEND_ITEMS
function getDefaultVisibility(): Record<ToggleKey, boolean> {
  const state = {} as Record<ToggleKey, boolean>
  for (const item of LEGEND_ITEMS) {
    state[item.toggleKey] = item.defaultOn
  }
  return state
}

export default function AirfieldMap({ onPointSelected, selectedPoint, surfaceAtPoint }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const marker = useRef<mapboxgl.Marker | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [visibility, setVisibility] = useState<Record<ToggleKey, boolean>>(getDefaultVisibility)
  const [legendOpen, setLegendOpen] = useState(false)

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  const handleClick = useCallback(
    (e: mapboxgl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat
      onPointSelected({ lat, lon: lng })
    },
    [onPointSelected],
  )

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !token || token === 'your-mapbox-token-here') return
    if (map.current) return

    mapboxgl.accessToken = token

    const rwy = getRwy()

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: [rwy.midpoint.lon, rwy.midpoint.lat],
      zoom: 13,
      pitch: 0,
      bearing: 0,
    })

    m.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right')

    m.on('load', () => {
      const geojson = buildSurfaceGeoJSON(rwy)

      // Add each surface as a separate layer for individual styling
      for (const layer of SURFACE_LAYERS) {
        const featureForLayer = geojson.features.find(
          (f) => f.properties?.id === layer.id,
        )
        if (!featureForLayer) continue

        const sourceId = `source-${layer.id}`
        m.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [featureForLayer],
          },
        })

        // Determine initial visibility based on toggle state
        const toggleKey = LEGEND_ITEMS.find((li) =>
          TOGGLE_LAYER_IDS[li.toggleKey]?.includes(`fill-${layer.id}`),
        )?.toggleKey
        const initiallyVisible = toggleKey ? visibility[toggleKey] : true

        // Fill layer
        m.addLayer({
          id: `fill-${layer.id}`,
          type: 'fill',
          source: sourceId,
          layout: {
            visibility: initiallyVisible ? 'visible' : 'none',
          },
          paint: {
            'fill-color': layer.color,
            'fill-opacity': layer.opacity,
          },
        })

        // Outline layer
        m.addLayer({
          id: `line-${layer.id}`,
          type: 'line',
          source: sourceId,
          layout: {
            visibility: initiallyVisible ? 'visible' : 'none',
          },
          paint: {
            'line-color': layer.color,
            'line-opacity': Math.min(1, layer.opacity * 3),
            'line-width': layer.id === 'runway' ? 2 : 1,
          },
        })
      }

      // Add runway end labels
      const rwy01 = INSTALLATION.runways[0].end1
      const rwy19 = INSTALLATION.runways[0].end2

      m.addSource('rwy-labels', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { label: '01' },
              geometry: { type: 'Point', coordinates: [rwy01.longitude, rwy01.latitude] },
            },
            {
              type: 'Feature',
              properties: { label: '19' },
              geometry: { type: 'Point', coordinates: [rwy19.longitude, rwy19.latitude] },
            },
          ],
        },
      })

      m.addLayer({
        id: 'rwy-labels',
        type: 'symbol',
        source: 'rwy-labels',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 14,
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#FFFFFF',
          'text-halo-color': '#000000',
          'text-halo-width': 2,
        },
      })

      setMapLoaded(true)
    })

    m.on('click', handleClick)
    map.current = m

    return () => {
      m.off('click', handleClick)
      m.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Update click handler when callback changes
  useEffect(() => {
    const m = map.current
    if (!m || !mapLoaded) return

    m.off('click', handleClick)
    m.on('click', handleClick)

    return () => {
      m.off('click', handleClick)
    }
  }, [handleClick, mapLoaded])

  // Sync toggle visibility to Mapbox layers
  useEffect(() => {
    const m = map.current
    if (!m || !mapLoaded) return

    for (const [key, layerIds] of Object.entries(TOGGLE_LAYER_IDS)) {
      const vis = visibility[key as ToggleKey] ? 'visible' : 'none'
      for (const layerId of layerIds) {
        if (m.getLayer(layerId)) {
          m.setLayoutProperty(layerId, 'visibility', vis)
        }
      }
    }
  }, [visibility, mapLoaded])

  // Update marker when selectedPoint changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    if (marker.current) {
      marker.current.remove()
      marker.current = null
    }

    if (selectedPoint) {
      const el = document.createElement('div')
      el.style.width = '24px'
      el.style.height = '24px'
      el.style.borderRadius = '50%'
      el.style.border = '3px solid #FFFFFF'
      el.style.background = surfaceAtPoint === 'No violation' ? '#22C55E' : '#EF4444'
      el.style.boxShadow = '0 0 8px rgba(0,0,0,0.5)'
      el.style.cursor = 'pointer'

      marker.current = new mapboxgl.Marker({ element: el })
        .setLngLat([selectedPoint.lon, selectedPoint.lat])
        .addTo(map.current)
    }
  }, [selectedPoint, mapLoaded, surfaceAtPoint])

  const toggleLayer = (key: ToggleKey) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const allVisible = LEGEND_ITEMS.every((item) => visibility[item.toggleKey])
  const toggleAll = () => {
    const nextVal = !allVisible
    setVisibility((prev) => {
      const next = { ...prev }
      for (const item of LEGEND_ITEMS) {
        next[item.toggleKey] = nextVal
      }
      return next
    })
  }

  if (!token || token === 'your-mapbox-token-here') {
    return (
      <div
        style={{
          background: 'rgba(10, 16, 28, 0.92)',
          border: '1px solid rgba(56, 189, 248, 0.1)',
          borderRadius: 10,
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 24, marginBottom: 8 }}>🗺️</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', marginBottom: 8 }}>
          Mapbox Token Required
        </div>
        <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>
          Add your Mapbox access token to <code style={{ color: '#38BDF8' }}>.env.local</code>
          <br />
          <code style={{ color: '#38BDF8', fontSize: 11 }}>NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx</code>
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
          height: 500,
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid rgba(56, 189, 248, 0.1)',
        }}
      />
      {/* Collapsible surface legend with toggles */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          background: 'rgba(4, 7, 12, 0.88)',
          borderRadius: 8,
          fontSize: 12,
          maxWidth: 200,
          userSelect: 'none',
        }}
      >
        <div
          onClick={() => setLegendOpen((o) => !o)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 10px',
            cursor: 'pointer',
            color: '#94A3B8',
            fontWeight: 600,
          }}
        >
          <span style={{ fontSize: 11 }}>Layers</span>
          {legendOpen && (
            <span
              onClick={(e) => { e.stopPropagation(); toggleAll() }}
              style={{
                fontSize: 9,
                marginLeft: 'auto',
                marginRight: 6,
                color: '#38BDF8',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {allVisible ? 'Hide All' : 'Show All'}
            </span>
          )}
          <span style={{ fontSize: 9, marginLeft: legendOpen ? 0 : 'auto' }}>{legendOpen ? '▲' : '▼'}</span>
        </div>
        {legendOpen && (
          <div
            style={{
              padding: '0 10px 8px',
              lineHeight: 1.7,
              maxHeight: 420,
              overflowY: 'auto',
            }}
          >
            {LEGEND_ITEMS.map((item) => (
              <div
                key={item.toggleKey}
                onClick={() => toggleLayer(item.toggleKey)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  padding: '1px 0',
                  opacity: visibility[item.toggleKey] ? 1 : 0.4,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    background: visibility[item.toggleKey] ? item.color : 'transparent',
                    border: `1.5px solid ${item.color}`,
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: '#CBD5E1' }}>{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {!selectedPoint && mapLoaded && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(4, 7, 12, 0.88)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 11,
            color: '#94A3B8',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          Tap map to place obstruction
        </div>
      )}
    </div>
  )
}
