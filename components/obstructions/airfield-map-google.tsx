'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { useInstallation } from '@/lib/installation-context'
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
  offsetPoint,
} from '@/lib/calculations/geometry'
import { IMAGINARY_SURFACES } from '@/lib/calculations/obstructions'
import {
  getClearanceHalfWidth,
  getSafetyHalfWidth,
  TAXIWAY_SURFACES,
  type TaxiwayStandard,
  type RunwayClass,
  type ServiceBranch,
} from '@/lib/calculations/taxiway-criteria'

type TaxiwayLine = {
  id: string
  designator: string
  centerline: LatLon[]
  standard: TaxiwayStandard
  tdg?: number | null
  taxiwayType?: 'taxiway' | 'taxilane'
  runwayClass?: RunwayClass | null
  serviceBranch?: ServiceBranch | null
}

type Props = {
  onPointSelected: (point: LatLon) => void
  selectedPoint: LatLon | null
  surfaceAtPoint: string | null
  flyToPoint?: LatLon | null
  taxiways?: TaxiwayLine[]
}

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
  { id: 'outer-horizontal', color: IMAGINARY_SURFACES.outer_horizontal.color, opacity: 0.08 },
  { id: 'conical', color: IMAGINARY_SURFACES.conical.color, opacity: 0.1 },
  { id: 'inner-horizontal', color: IMAGINARY_SURFACES.inner_horizontal.color, opacity: 0.12 },
  { id: 'transitional-left', color: IMAGINARY_SURFACES.transitional.color, opacity: 0.15 },
  { id: 'transitional-right', color: IMAGINARY_SURFACES.transitional.color, opacity: 0.15 },
  { id: 'approach-end1', color: IMAGINARY_SURFACES.approach_departure.color, opacity: 0.14 },
  { id: 'approach-end2', color: IMAGINARY_SURFACES.approach_departure.color, opacity: 0.14 },
  { id: 'apz-ii-end1', color: IMAGINARY_SURFACES.apz_ii.color, opacity: 0.12 },
  { id: 'apz-ii-end2', color: IMAGINARY_SURFACES.apz_ii.color, opacity: 0.12 },
  { id: 'apz-i-end1', color: IMAGINARY_SURFACES.apz_i.color, opacity: 0.14 },
  { id: 'apz-i-end2', color: IMAGINARY_SURFACES.apz_i.color, opacity: 0.14 },
  { id: 'clear-zone-end1', color: IMAGINARY_SURFACES.clear_zone.color, opacity: 0.16 },
  { id: 'clear-zone-end2', color: IMAGINARY_SURFACES.clear_zone.color, opacity: 0.16 },
  { id: 'primary-surface', color: IMAGINARY_SURFACES.primary.color, opacity: 0.18 },
  { id: 'graded-area-end1', color: IMAGINARY_SURFACES.graded_area.color, opacity: 0.2 },
  { id: 'graded-area-end2', color: IMAGINARY_SURFACES.graded_area.color, opacity: 0.2 },
  { id: 'runway', color: '#FFFFFF', opacity: 0.5 },
]

// Map surface layer IDs to their toggle key
function getToggleKeyForLayer(layerId: string): ToggleKey | null {
  if (layerId === 'outer-horizontal') return 'outer-horizontal'
  if (layerId === 'conical') return 'conical'
  if (layerId === 'inner-horizontal') return 'inner-horizontal'
  if (layerId.startsWith('transitional')) return 'transitional'
  if (layerId.startsWith('approach')) return 'approach-departure'
  if (layerId === 'primary-surface') return 'primary-surface'
  if (layerId.startsWith('clear-zone')) return 'clear-zone'
  if (layerId.startsWith('graded-area')) return 'graded-area'
  if (layerId.startsWith('apz-i-')) return 'apz-i'
  if (layerId.startsWith('apz-ii')) return 'apz-ii'
  return null
}

function getDefaultVisibility(): Record<ToggleKey, boolean> {
  const v: Record<string, boolean> = {}
  for (const item of LEGEND_ITEMS) v[item.toggleKey] = item.defaultOn
  return v as Record<ToggleKey, boolean>
}

/** Reuse the same buildSurfaceGeoJSON logic from the Mapbox version */
function buildSurfacePolygons(runways: RunwayGeometry[]) {
  const features: { id: string; coords: [number, number][]; rwyIndex: number }[] = []
  const primaryRwy = runways[0]

  const innerHRadius = IMAGINARY_SURFACES.inner_horizontal.criteria.radius
  const conicalExtent = IMAGINARY_SURFACES.conical.criteria.horizontalExtent
  const outerHRadius = IMAGINARY_SURFACES.outer_horizontal.criteria.radius

  features.push({ id: 'outer-horizontal', coords: generateStadiumPolygon(primaryRwy, outerHRadius, 64), rwyIndex: -1 })
  features.push({ id: 'conical', coords: generateStadiumPolygon(primaryRwy, innerHRadius + conicalExtent, 64), rwyIndex: -1 })
  features.push({ id: 'inner-horizontal', coords: generateStadiumPolygon(primaryRwy, innerHRadius, 64), rwyIndex: -1 })

  for (let ri = 0; ri < runways.length; ri++) {
    const rwy = runways[ri]
    const trans = generateTransitionalPolygons(rwy)
    features.push({ id: 'transitional-left', coords: trans.left, rwyIndex: ri })
    features.push({ id: 'transitional-right', coords: trans.right, rwyIndex: ri })

    const appDep = generateApproachDeparturePolygons(rwy)
    features.push({ id: 'approach-end1', coords: appDep.end1, rwyIndex: ri })
    features.push({ id: 'approach-end2', coords: appDep.end2, rwyIndex: ri })

    const apz = generateAPZPolygons(rwy)
    features.push({ id: 'apz-i-end1', coords: apz.apz_i_end1, rwyIndex: ri })
    features.push({ id: 'apz-i-end2', coords: apz.apz_i_end2, rwyIndex: ri })
    features.push({ id: 'apz-ii-end1', coords: apz.apz_ii_end1, rwyIndex: ri })
    features.push({ id: 'apz-ii-end2', coords: apz.apz_ii_end2, rwyIndex: ri })

    const cz = generateClearZonePolygons(rwy)
    features.push({ id: 'clear-zone-end1', coords: cz.end1, rwyIndex: ri })
    features.push({ id: 'clear-zone-end2', coords: cz.end2, rwyIndex: ri })

    features.push({ id: 'primary-surface', coords: generatePrimarySurfacePolygon(rwy), rwyIndex: ri })

    const graded = generateGradedAreaPolygons(rwy)
    features.push({ id: 'graded-area-end1', coords: graded.end1, rwyIndex: ri })
    features.push({ id: 'graded-area-end2', coords: graded.end2, rwyIndex: ri })

    features.push({ id: 'runway', coords: generateRunwayPolygon(rwy), rwyIndex: ri })
  }

  return features
}

/** Helper: bearing between two LatLon points */
function bearingBetween(a: LatLon, b: LatLon): number {
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

function generateCenterlineBuffer(centerline: LatLon[], halfWidthFt: number): [number, number][] {
  if (centerline.length < 2 || halfWidthFt <= 0) return []
  const left: LatLon[] = []
  const right: LatLon[] = []
  for (let i = 0; i < centerline.length; i++) {
    const pt = centerline[i]
    let bearing: number
    if (i === 0) bearing = bearingBetween(centerline[0], centerline[1])
    else if (i === centerline.length - 1) bearing = bearingBetween(centerline[i - 1], centerline[i])
    else {
      const b1 = bearingBetween(centerline[i - 1], centerline[i])
      const b2 = bearingBetween(centerline[i], centerline[i + 1])
      const r1 = (b1 * Math.PI) / 180
      const r2 = (b2 * Math.PI) / 180
      bearing = (Math.atan2((Math.sin(r1) + Math.sin(r2)) / 2, (Math.cos(r1) + Math.cos(r2)) / 2) * 180) / Math.PI
      bearing = (bearing + 360) % 360
    }
    left.push(offsetPoint(pt, (bearing - 90 + 360) % 360, halfWidthFt))
    right.push(offsetPoint(pt, (bearing + 90) % 360, halfWidthFt))
  }
  const coords: [number, number][] = [
    ...left.map(p => [p.lon, p.lat] as [number, number]),
    ...right.reverse().map(p => [p.lon, p.lat] as [number, number]),
  ]
  coords.push(coords[0])
  return coords
}

export default function AirfieldMapGoogle({ onPointSelected, selectedPoint, surfaceAtPoint, flyToPoint, taxiways = [] }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | google.maps.Marker | null>(null)
  const polygonsRef = useRef<google.maps.Polygon[]>([])
  const taxiwayPolygonsRef = useRef<google.maps.Polygon[]>([])
  const labelsRef = useRef<google.maps.Marker[]>([])

  const [mapLoaded, setMapLoaded] = useState(false)
  const [visibility, setVisibility] = useState<Record<ToggleKey, boolean>>(getDefaultVisibility)
  const [runwayVisibility, setRunwayVisibility] = useState<Record<number, boolean>>({})
  const [legendOpen, setLegendOpen] = useState(false)
  const [showTaxiways, setShowTaxiways] = useState(false)
  const [apiReady, setApiReady] = useState(false)

  const { runways: installationRunways, installationId } = useInstallation()

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_ELEVATION_API_KEY || ''

  const runwayLabels = installationRunways.length > 0
    ? installationRunways.map(rwy => rwy.runway_id ?? 'Unknown')
    : []
  const isMultiRunway = runwayLabels.length > 1

  const getAllRunways = useCallback((): RunwayGeometry[] => {
    if (installationRunways.length === 0) return []
    return installationRunways.map(rwy =>
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
  }, [installationRunways])

  // Load Google Maps API
  useEffect(() => {
    if (!apiKey) return
    setOptions({ key: apiKey, v: 'weekly' })
    Promise.all([
      importLibrary('maps'),
      importLibrary('marker'),
    ]).then(() => {
      setApiReady(true)
    })
  }, [apiKey])

  // Initialize map
  useEffect(() => {
    if (!apiReady || !mapContainer.current) return

    // Cleanup previous
    if (mapRef.current) {
      polygonsRef.current.forEach(p => p.setMap(null))
      polygonsRef.current = []
      labelsRef.current.forEach(l => l.setMap(null))
      labelsRef.current = []
      taxiwayPolygonsRef.current.forEach(p => p.setMap(null))
      taxiwayPolygonsRef.current = []
    }

    const allRwys = getAllRunways()
    const primaryRwy = allRwys[0]

    const center = primaryRwy
      ? { lat: primaryRwy.midpoint.lat, lng: primaryRwy.midpoint.lon }
      : installationRunways.length > 0
        ? {
          lat: ((installationRunways[0].end1_latitude ?? 0) + (installationRunways[0].end2_latitude ?? 0)) / 2,
          lng: ((installationRunways[0].end1_longitude ?? 0) + (installationRunways[0].end2_longitude ?? 0)) / 2,
        }
        : { lat: 0, lng: 0 }

    const gmap = new google.maps.Map(mapContainer.current, {
      center,
      zoom: 13,
      mapTypeId: 'satellite',
      tilt: 0,
      disableDefaultUI: true,
      zoomControl: true,
      zoomControlOptions: { position: google.maps.ControlPosition.TOP_RIGHT },
      gestureHandling: 'greedy',
      mapId: 'glidepath-obstruction',
    })

    mapRef.current = gmap

    // Click handler
    gmap.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return
      onPointSelected({ lat: e.latLng.lat(), lon: e.latLng.lng() })
    })

    // Build surface polygons
    if (allRwys.length > 0) {
      const surfaces = buildSurfacePolygons(allRwys)

      for (const layer of SURFACE_LAYERS) {
        const matching = surfaces.filter(s => s.id === layer.id)
        for (const surface of matching) {
          const toggleKey = getToggleKeyForLayer(surface.id)
          const initiallyVisible = toggleKey ? (LEGEND_ITEMS.find(l => l.toggleKey === toggleKey)?.defaultOn ?? true) : true

          const poly = new google.maps.Polygon({
            paths: surface.coords.map(([lng, lat]) => ({ lat, lng })),
            fillColor: layer.color,
            fillOpacity: layer.opacity,
            strokeColor: layer.color,
            strokeOpacity: Math.min(1, layer.opacity * 3),
            strokeWeight: surface.id === 'runway' ? 2 : 1,
            visible: initiallyVisible,
            map: gmap,
          })
          ;(poly as any)._surfaceId = surface.id
          ;(poly as any)._rwyIndex = surface.rwyIndex
          ;(poly as any)._toggleKey = toggleKey
          polygonsRef.current.push(poly)
        }
      }

      // Runway end labels
      for (let i = 0; i < allRwys.length; i++) {
        const rwy = allRwys[i]
        const instRwy = installationRunways[i]
        const ends = [
          { pos: rwy.end1, label: instRwy?.end1_designator ?? '01' },
          { pos: rwy.end2, label: instRwy?.end2_designator ?? '19' },
        ]
        for (const end of ends) {
          const lbl = new google.maps.Marker({
            position: { lat: end.pos.lat, lng: end.pos.lon },
            map: gmap,
            label: {
              text: end.label,
              color: '#FFFFFF',
              fontWeight: 'bold',
              fontSize: '14px',
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 0,
            },
          })
          ;(lbl as any)._rwyIndex = i
          labelsRef.current.push(lbl)
        }
      }
    }

    setMapLoaded(true)

    return () => {
      polygonsRef.current.forEach(p => p.setMap(null))
      polygonsRef.current = []
      labelsRef.current.forEach(l => l.setMap(null))
      labelsRef.current = []
      taxiwayPolygonsRef.current.forEach(p => p.setMap(null))
      taxiwayPolygonsRef.current = []
      mapRef.current = null
      setMapLoaded(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady, installationId])

  // Sync surface visibility
  useEffect(() => {
    for (const poly of polygonsRef.current) {
      const toggleKey = (poly as any)._toggleKey as ToggleKey | null
      const rwyIdx = (poly as any)._rwyIndex as number
      if (!toggleKey) continue
      const surfaceVisible = visibility[toggleKey]
      const rwyVisible = rwyIdx === -1 || runwayVisibility[rwyIdx] !== false
      poly.setVisible(surfaceVisible && rwyVisible)
    }
  }, [visibility, runwayVisibility])

  // Sync runway label visibility
  useEffect(() => {
    for (const lbl of labelsRef.current) {
      const rwyIdx = (lbl as any)._rwyIndex as number
      lbl.setVisible(runwayVisibility[rwyIdx] !== false)
    }
  }, [runwayVisibility])

  // Render taxiway envelopes
  useEffect(() => {
    taxiwayPolygonsRef.current.forEach(p => p.setMap(null))
    taxiwayPolygonsRef.current = []

    if (!mapRef.current || !mapLoaded || taxiways.length === 0 || !showTaxiways) return

    for (const tw of taxiways) {
      if (tw.centerline.length < 2) continue
      const config = {
        standard: tw.standard,
        tdg: tw.tdg,
        taxiwayType: tw.taxiwayType,
        runwayClass: tw.runwayClass,
        serviceBranch: tw.serviceBranch,
      }

      const ofaHalf = getClearanceHalfWidth(config)
      const ofaCoords = generateCenterlineBuffer(tw.centerline, ofaHalf)
      if (ofaCoords.length > 0) {
        const poly = new google.maps.Polygon({
          paths: ofaCoords.map(([lng, lat]) => ({ lat, lng })),
          fillColor: TAXIWAY_SURFACES.taxiway_ofa.color,
          fillOpacity: 0.12,
          strokeColor: TAXIWAY_SURFACES.taxiway_ofa.color,
          strokeWeight: 1.5,
          strokeOpacity: 0.6,
          map: mapRef.current,
        })
        taxiwayPolygonsRef.current.push(poly)
      }

      const safetyHalf = getSafetyHalfWidth(config)
      if (safetyHalf) {
        const safetyCoords = generateCenterlineBuffer(tw.centerline, safetyHalf)
        if (safetyCoords.length > 0) {
          const poly = new google.maps.Polygon({
            paths: safetyCoords.map(([lng, lat]) => ({ lat, lng })),
            fillColor: TAXIWAY_SURFACES.taxiway_safety_area.color,
            fillOpacity: 0.15,
            strokeColor: TAXIWAY_SURFACES.taxiway_safety_area.color,
            strokeWeight: 1,
            strokeOpacity: 0.5,
            map: mapRef.current,
          })
          taxiwayPolygonsRef.current.push(poly)
        }
      }
    }
  }, [taxiways, mapLoaded, showTaxiways])

  // Update selected point marker
  useEffect(() => {
    if (markerRef.current) {
      if ((markerRef.current as any).setMap) (markerRef.current as any).setMap(null)
      markerRef.current = null
    }
    if (!mapRef.current || !mapLoaded || !selectedPoint) return

    const el = document.createElement('div')
    el.style.width = '24px'
    el.style.height = '24px'
    el.style.borderRadius = '50%'
    el.style.border = '3px solid #FFFFFF'
    el.style.background = surfaceAtPoint === 'No violation' ? '#22C55E' : '#EF4444'
    el.style.boxShadow = '0 0 8px rgba(0,0,0,0.5)'
    el.style.cursor = 'pointer'
    el.style.transform = 'translate(-50%, -50%)'

    try {
      const advMarker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: selectedPoint.lat, lng: selectedPoint.lon },
        map: mapRef.current,
        content: el,
      })
      markerRef.current = advMarker as any
    } catch {
      // Fallback to classic marker if AdvancedMarker not available
      const m = new google.maps.Marker({
        position: { lat: selectedPoint.lat, lng: selectedPoint.lon },
        map: mapRef.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: surfaceAtPoint === 'No violation' ? '#22C55E' : '#EF4444',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 3,
        },
      })
      markerRef.current = m
    }
  }, [selectedPoint, mapLoaded, surfaceAtPoint])

  // Fly to point
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !flyToPoint) return
    mapRef.current.panTo({ lat: flyToPoint.lat, lng: flyToPoint.lon })
    mapRef.current.setZoom(15)
  }, [flyToPoint, mapLoaded])

  const toggleLayer = (key: ToggleKey) => {
    setVisibility(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleRunway = (index: number) => {
    setRunwayVisibility(prev => ({ ...prev, [index]: prev[index] !== false ? false : true }))
  }

  const allVisible = LEGEND_ITEMS.every(item => visibility[item.toggleKey])
  const toggleAll = () => {
    const nextVal = !allVisible
    setVisibility(prev => {
      const next = { ...prev }
      for (const item of LEGEND_ITEMS) next[item.toggleKey] = nextVal
      return next
    })
  }

  if (!apiKey) {
    return (
      <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-mid)', borderRadius: 10, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--fs-5xl)', marginBottom: 8 }}>🗺️</div>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 8 }}>Google Maps API Key Required</div>
        <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)', lineHeight: 1.5 }}>
          Add <code style={{ color: 'var(--color-accent)' }}>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to <code style={{ color: 'var(--color-accent)' }}>.env.local</code>
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
      {/* Legend */}
      <div style={{
        position: 'absolute', top: 8, left: 8,
        background: 'rgba(4, 7, 12, 0.88)', borderRadius: 8,
        fontSize: 'var(--fs-base)', maxWidth: 200, userSelect: 'none',
      }}>
        <div
          onClick={() => setLegendOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', cursor: 'pointer', color: '#94A3B8', fontWeight: 600 }}
        >
          <span style={{ fontSize: 'var(--fs-sm)' }}>Layers</span>
          {legendOpen && (
            <span onClick={e => { e.stopPropagation(); toggleAll() }} style={{ fontSize: 'var(--fs-2xs)', marginLeft: 'auto', marginRight: 6, color: '#38BDF8', cursor: 'pointer', fontWeight: 500 }}>
              {allVisible ? 'Hide All' : 'Show All'}
            </span>
          )}
          <span style={{ fontSize: 'var(--fs-2xs)', marginLeft: legendOpen ? 0 : 'auto' }}>{legendOpen ? '▲' : '▼'}</span>
        </div>
        {legendOpen && (
          <div style={{ padding: '0 10px 8px', lineHeight: 1.7, maxHeight: 420, overflowY: 'auto' }}>
            {isMultiRunway && (
              <div style={{ paddingBottom: 5, marginBottom: 5, borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
                <div style={{ fontSize: 'var(--fs-2xs)', color: '#64748B', fontWeight: 700, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Runways</div>
                {runwayLabels.map((label, i) => (
                  <div key={i} onClick={() => toggleRunway(i)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '1px 0', opacity: runwayVisibility[i] !== false ? 1 : 0.4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: runwayVisibility[i] !== false ? '#FFFFFF' : 'transparent', border: '1.5px solid #FFFFFF', flexShrink: 0 }} />
                    <span style={{ color: '#CBD5E1' }}>{label}</span>
                  </div>
                ))}
              </div>
            )}
            {isMultiRunway && (
              <div style={{ fontSize: 'var(--fs-2xs)', color: '#64748B', fontWeight: 700, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Surfaces</div>
            )}
            {LEGEND_ITEMS.map(item => (
              <div key={item.toggleKey} onClick={() => toggleLayer(item.toggleKey)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '1px 0', opacity: visibility[item.toggleKey] ? 1 : 0.4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: visibility[item.toggleKey] ? item.color : 'transparent', border: `1.5px solid ${item.color}`, flexShrink: 0 }} />
                <span style={{ color: '#CBD5E1' }}>{item.label}</span>
              </div>
            ))}
            {taxiways.length > 0 && (
              <div style={{ paddingTop: 5, marginTop: 5, borderTop: '1px solid rgba(148,163,184,0.15)' }}>
                <div onClick={() => setShowTaxiways(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '1px 0', opacity: showTaxiways ? 1 : 0.4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: showTaxiways ? TAXIWAY_SURFACES.taxiway_ofa.color : 'transparent', border: `1.5px solid ${TAXIWAY_SURFACES.taxiway_ofa.color}`, flexShrink: 0 }} />
                  <span style={{ color: '#CBD5E1' }}>Taxiway Clearance ({taxiways.length})</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {!selectedPoint && mapLoaded && (
        <div style={{
          position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(4, 7, 12, 0.88)', borderRadius: 6, padding: '4px 10px',
          fontSize: 'var(--fs-sm)', color: '#94A3B8', fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          Tap map to place obstruction
        </div>
      )}
    </div>
  )
}
