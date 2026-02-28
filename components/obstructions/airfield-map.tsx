'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useInstallation } from '@/lib/installation-context'
import { isMapboxConfigured } from '@/lib/utils'
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
  /** When set, the map will fly to this point. Used for GPS "Use My Location". */
  flyToPoint?: LatLon | null
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

// Surface layer IDs that are runway-specific (generated per runway).
// Airfield-wide surfaces (outer-horizontal, conical, inner-horizontal) are
// computed from the first runway and are not filterable by runway.
const RUNWAY_SPECIFIC_IDS = new Set([
  'transitional-left', 'transitional-right',
  'approach-end1', 'approach-end2',
  'apz-ii-end1', 'apz-ii-end2',
  'apz-i-end1', 'apz-i-end2',
  'clear-zone-end1', 'clear-zone-end2',
  'primary-surface',
  'graded-area-end1', 'graded-area-end2',
  'runway',
])

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

/**
 * Build GeoJSON for all imaginary surfaces across one or more runways.
 * Airfield-wide surfaces (outer horizontal, conical, inner horizontal) use the
 * first runway only — for parallel runways the radii are large enough that the
 * difference is negligible. Runway-specific surfaces generate features for every
 * runway; each feature carries a `rwyIndex` property so Mapbox filters can
 * show/hide individual runways.
 */
function buildSurfaceGeoJSON(runways: RunwayGeometry[]) {
  const features: GeoJSON.Feature[] = []
  const primaryRwy = runways[0]

  // Derive radii from UFC constants
  const innerHRadius = IMAGINARY_SURFACES.inner_horizontal.criteria.radius
  const conicalExtent = IMAGINARY_SURFACES.conical.criteria.horizontalExtent
  const outerHRadius = IMAGINARY_SURFACES.outer_horizontal.criteria.radius

  // Airfield-wide surfaces — use first runway (negligible difference for parallel runways)
  const outerH = generateStadiumPolygon(primaryRwy, outerHRadius, 64)
  features.push({
    type: 'Feature',
    properties: { id: 'outer-horizontal', rwyIndex: -1 },
    geometry: { type: 'Polygon', coordinates: [outerH] },
  })

  const conical = generateStadiumPolygon(primaryRwy, innerHRadius + conicalExtent, 64)
  features.push({
    type: 'Feature',
    properties: { id: 'conical', rwyIndex: -1 },
    geometry: { type: 'Polygon', coordinates: [conical] },
  })

  const innerH = generateStadiumPolygon(primaryRwy, innerHRadius, 64)
  features.push({
    type: 'Feature',
    properties: { id: 'inner-horizontal', rwyIndex: -1 },
    geometry: { type: 'Polygon', coordinates: [innerH] },
  })

  // Runway-specific surfaces — generate for every runway, tagged with rwyIndex
  for (let ri = 0; ri < runways.length; ri++) {
    const rwy = runways[ri]

    const transitional = generateTransitionalPolygons(rwy)
    features.push({
      type: 'Feature',
      properties: { id: 'transitional-left', rwyIndex: ri },
      geometry: { type: 'Polygon', coordinates: [transitional.left] },
    })
    features.push({
      type: 'Feature',
      properties: { id: 'transitional-right', rwyIndex: ri },
      geometry: { type: 'Polygon', coordinates: [transitional.right] },
    })

    const approach = generateApproachDeparturePolygons(rwy)
    features.push({
      type: 'Feature',
      properties: { id: 'approach-end1', rwyIndex: ri },
      geometry: { type: 'Polygon', coordinates: [approach.end1] },
    })
    features.push({
      type: 'Feature',
      properties: { id: 'approach-end2', rwyIndex: ri },
      geometry: { type: 'Polygon', coordinates: [approach.end2] },
    })

    const apz = generateAPZPolygons(rwy)
    features.push({
      type: 'Feature',
      properties: { id: 'apz-ii-end1', rwyIndex: ri },
      geometry: { type: 'Polygon', coordinates: [apz.apz_ii_end1] },
    })
    features.push({
      type: 'Feature',
      properties: { id: 'apz-ii-end2', rwyIndex: ri },
      geometry: { type: 'Polygon', coordinates: [apz.apz_ii_end2] },
    })
    features.push({
      type: 'Feature',
      properties: { id: 'apz-i-end1', rwyIndex: ri },
      geometry: { type: 'Polygon', coordinates: [apz.apz_i_end1] },
    })
    features.push({
      type: 'Feature',
      properties: { id: 'apz-i-end2', rwyIndex: ri },
      geometry: { type: 'Polygon', coordinates: [apz.apz_i_end2] },
    })

    const clearZones = generateClearZonePolygons(rwy)
    features.push({
      type: 'Feature',
      properties: { id: 'clear-zone-end1', rwyIndex: ri },
      geometry: { type: 'Polygon', coordinates: [clearZones.end1] },
    })
    features.push({
      type: 'Feature',
      properties: { id: 'clear-zone-end2', rwyIndex: ri },
      geometry: { type: 'Polygon', coordinates: [clearZones.end2] },
    })

    const primary = generatePrimarySurfacePolygon(rwy)
    features.push({
      type: 'Feature',
      properties: { id: 'primary-surface', rwyIndex: ri },
      geometry: { type: 'Polygon', coordinates: [primary] },
    })

    const gradedAreas = generateGradedAreaPolygons(rwy)
    features.push({
      type: 'Feature',
      properties: { id: 'graded-area-end1', rwyIndex: ri },
      geometry: { type: 'Polygon', coordinates: [gradedAreas.end1] },
    })
    features.push({
      type: 'Feature',
      properties: { id: 'graded-area-end2', rwyIndex: ri },
      geometry: { type: 'Polygon', coordinates: [gradedAreas.end2] },
    })

    const runway = generateRunwayPolygon(rwy)
    features.push({
      type: 'Feature',
      properties: { id: 'runway', rwyIndex: ri },
      geometry: { type: 'Polygon', coordinates: [runway] },
    })
  }

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

export default function AirfieldMap({ onPointSelected, selectedPoint, surfaceAtPoint, flyToPoint }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const marker = useRef<mapboxgl.Marker | null>(null)
  const numRunwaysRef = useRef(1)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [visibility, setVisibility] = useState<Record<ToggleKey, boolean>>(getDefaultVisibility)
  const [runwayVisibility, setRunwayVisibility] = useState<Record<number, boolean>>({})
  const [legendOpen, setLegendOpen] = useState(false)
  const { runways: installationRunways } = useInstallation()

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const mapboxReady = isMapboxConfigured()

  // Derived: runway labels and multi-runway flag
  const runwayLabels = installationRunways.length > 0
    ? installationRunways.map((rwy) => rwy.runway_id ?? 'Unknown')
    : []
  const isMultiRunway = runwayLabels.length > 1

  const getAllRunways = useCallback((): RunwayGeometry[] => {
    if (installationRunways.length > 0) {
      return installationRunways.map((rwy) =>
        getRunwayGeometry({
          end1: { latitude: rwy.end1_latitude ?? 0, longitude: rwy.end1_longitude ?? 0 },
          end2: { latitude: rwy.end2_latitude ?? 0, longitude: rwy.end2_longitude ?? 0 },
          length_ft: rwy.length_ft ?? 9000,
          width_ft: rwy.width_ft ?? 150,
          true_heading: rwy.true_heading ?? undefined,
          end1_elevation_msl: rwy.end1_elevation_msl,
          end2_elevation_msl: rwy.end2_elevation_msl,
        }),
      )
    }
    // No runways configured — return empty; map will show base center or default view
    return []
  }, [installationRunways])

  const handleClick = useCallback(
    (e: mapboxgl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat
      onPointSelected({ lat, lon: lng })
    },
    [onPointSelected],
  )

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxReady || !token) return
    if (map.current) return

    mapboxgl.accessToken = token

    const allRwys = getAllRunways()
    const primaryRwy = allRwys[0]
    numRunwaysRef.current = allRwys.length

    // Default center: first runway midpoint, or first installation runway midpoint, or 0,0
    const defaultCenter: [number, number] = primaryRwy
      ? [primaryRwy.midpoint.lon, primaryRwy.midpoint.lat]
      : installationRunways.length > 0
        ? [((installationRunways[0].end1_longitude ?? 0) + (installationRunways[0].end2_longitude ?? 0)) / 2,
           ((installationRunways[0].end1_latitude ?? 0) + (installationRunways[0].end2_latitude ?? 0)) / 2]
        : [0, 0]

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: defaultCenter,
      zoom: 13,
      pitch: 0,
      bearing: 0,
    })

    m.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right')

    m.on('load', () => {
      const geojson = buildSurfaceGeoJSON(allRwys)

      // Add each surface as a separate layer for individual styling
      for (const layer of SURFACE_LAYERS) {
        const featuresForLayer = geojson.features.filter(
          (f) => f.properties?.id === layer.id,
        )
        if (featuresForLayer.length === 0) continue

        const sourceId = `source-${layer.id}`
        m.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: featuresForLayer,
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

      // Add runway end labels for all runways (tagged with rwyIndex for filtering)
      const labelFeatures: GeoJSON.Feature[] = []
      for (let i = 0; i < allRwys.length; i++) {
        const rwy = allRwys[i]
        const instRwy = installationRunways[i]
        labelFeatures.push({
          type: 'Feature',
          properties: { label: instRwy?.end1_designator ?? '01', rwyIndex: i },
          geometry: { type: 'Point', coordinates: [rwy.end1.lon, rwy.end1.lat] },
        })
        labelFeatures.push({
          type: 'Feature',
          properties: { label: instRwy?.end2_designator ?? '19', rwyIndex: i },
          geometry: { type: 'Point', coordinates: [rwy.end2.lon, rwy.end2.lat] },
        })
      }
      m.addSource('rwy-labels', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: labelFeatures,
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

  // Sync surface-type toggle visibility to Mapbox layers
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

  // Sync per-runway visibility via Mapbox filters (multi-runway only)
  useEffect(() => {
    const m = map.current
    if (!m || !mapLoaded) return
    const numRwys = numRunwaysRef.current
    if (numRwys <= 1) return

    // Build list of visible runway indices (treat undefined as visible)
    const visibleIndices = Array.from({ length: numRwys }, (_, i) => i)
      .filter((i) => runwayVisibility[i] !== false)
    const allVisible = visibleIndices.length === numRwys

    // Build the Mapbox filter expression
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = allVisible
      ? null
      : visibleIndices.length === 0
        ? ['==', ['get', 'rwyIndex'], -999] // match nothing
        : ['any', ...visibleIndices.map((i) => ['==', ['get', 'rwyIndex'], i])]

    // Apply to runway-specific surface layers
    for (const layer of SURFACE_LAYERS) {
      if (!RUNWAY_SPECIFIC_IDS.has(layer.id)) continue
      const fillId = `fill-${layer.id}`
      const lineId = `line-${layer.id}`
      if (m.getLayer(fillId)) m.setFilter(fillId, filter)
      if (m.getLayer(lineId)) m.setFilter(lineId, filter)
    }

    // Apply to runway labels
    if (m.getLayer('rwy-labels')) m.setFilter('rwy-labels', filter)
  }, [runwayVisibility, mapLoaded])

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

  // Fly to a point when flyToPoint changes (GPS location)
  useEffect(() => {
    if (!map.current || !mapLoaded || !flyToPoint) return
    map.current.flyTo({ center: [flyToPoint.lon, flyToPoint.lat], zoom: 16, duration: 1500 })
  }, [flyToPoint, mapLoaded])

  const toggleLayer = (key: ToggleKey) => {
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleRunway = (index: number) => {
    setRunwayVisibility((prev) => ({
      ...prev,
      [index]: prev[index] !== false ? false : true,
    }))
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
        <div style={{ fontSize: 'var(--fs-5xl)', marginBottom: 8 }}>🗺️</div>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 8 }}>
          Mapbox Token Required
        </div>
        <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', lineHeight: 1.5 }}>
          Add your Mapbox access token to <code style={{ color: 'var(--color-accent)' }}>.env.local</code>
          <br />
          <code style={{ color: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}>NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx</code>
        </div>
      </div>
    )
  }

  const handleToggleExpand = useCallback(() => {
    setExpanded(prev => !prev)
    setTimeout(() => { map.current?.resize() }, 50)
  }, [])

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={mapContainer}
        style={{
          width: '100%',
          height: expanded ? 'var(--obs-map-height-expanded)' : 'var(--obs-map-height)',
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
          {expanded ? '⊖ Collapse' : '⊕ Expand'}
        </button>
      )}
      {/* Collapsible surface legend with toggles */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          background: 'rgba(4, 7, 12, 0.88)',
          borderRadius: 8,
          fontSize: 'var(--fs-base)',
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
          <span style={{ fontSize: 'var(--fs-sm)' }}>Layers</span>
          {legendOpen && (
            <span
              onClick={(e) => { e.stopPropagation(); toggleAll() }}
              style={{
                fontSize: 'var(--fs-2xs)',
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
          <span style={{ fontSize: 'var(--fs-2xs)', marginLeft: legendOpen ? 0 : 'auto' }}>{legendOpen ? '▲' : '▼'}</span>
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
            {/* Runway toggles (multi-runway only) */}
            {isMultiRunway && (
              <div style={{ paddingBottom: 5, marginBottom: 5, borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
                <div style={{ fontSize: 'var(--fs-2xs)', color: '#64748B', fontWeight: 700, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Runways
                </div>
                {runwayLabels.map((label, i) => (
                  <div
                    key={i}
                    onClick={() => toggleRunway(i)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      padding: '1px 0',
                      opacity: runwayVisibility[i] !== false ? 1 : 0.4,
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: runwayVisibility[i] !== false ? '#FFFFFF' : 'transparent',
                        border: '1.5px solid #FFFFFF',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ color: '#CBD5E1' }}>{label}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Surface type toggles */}
            {isMultiRunway && (
              <div style={{ fontSize: 'var(--fs-2xs)', color: '#64748B', fontWeight: 700, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Surfaces
              </div>
            )}
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
            fontSize: 'var(--fs-sm)',
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
