'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useGoogleMapRuler } from '@/hooks/use-google-map-ruler'
import { initGoogleMaps, isGoogleMapsConfigured, GOOGLE_MAP_OPTIONS } from '@/lib/google-maps'
import { applyMapProvider } from '@/lib/map-providers'
import { useInstallation } from '@/lib/installation-context'
import UseMyLocationButton from '@/components/ui/use-my-location-button'
import {
  type LatLon,
  getRunwayGeometry,
  offsetPoint,
} from '@/lib/calculations/geometry'
import {
  type FaaApproachType,
  type SurfaceSet,
  type IcaoApproachClassification,
  type IcaoCodeNumber,
} from '@/lib/calculations/obstructions'
import {
  SURFACE_SET_REGISTRY,
  type LegendItem,
  type UfcRunwayClass,
  type SurfaceRunwayInput,
} from '@/lib/calculations/surface-standards'
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
  surfaceSet: SurfaceSet
  runwayClass?: UfcRunwayClass | null
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

// FAA Part 77 (§77.19) toggle keys. The legend/layer constants + colors now
// live in lib/calculations/surface-standards.ts; the map selects them per
// surface set via SURFACE_SET_REGISTRY.
type Part77ToggleKey =
  | 'p77-horizontal'
  | 'p77-conical'
  | 'p77-transitional'
  | 'p77-approach'
  | 'p77-primary'

// ICAO Annex 14 toggle keys — one per phase-1 legend row. The legend/layer
// constants + colors live in lib/calculations/surface-standards.ts.
type Annex14ToggleKey =
  | 'a14-conical'
  | 'a14-inner-horizontal'
  | 'a14-transitional'
  | 'a14-approach'
  | 'a14-takeoff-climb'

type AnyToggleKey = ToggleKey | Part77ToggleKey | Annex14ToggleKey

// Map a Part 77 layer id to its toggle key. The transitional/approach/segment-
// break variants fold onto their base toggle; segment-break toggles with approach.
function getPart77ToggleKeyForLayer(layerId: string): Part77ToggleKey | null {
  if (layerId === 'p77-horizontal') return 'p77-horizontal'
  if (layerId === 'p77-conical') return 'p77-conical'
  if (layerId.startsWith('p77-transitional')) return 'p77-transitional'
  if (layerId.startsWith('p77-approach')) return 'p77-approach'
  if (layerId.startsWith('p77-segment-break')) return 'p77-approach'
  if (layerId === 'p77-primary') return 'p77-primary'
  return null
}

// Map an ICAO Annex 14 layer id to its toggle key. The left/right transitional
// and end1/end2 approach + take-off-climb variants fold onto their base toggle,
// mirroring the Part 77 mapper — without this the a14-* layers resolve to a null
// toggle key and the ICAO legend rows are inert.
function getAnnex14ToggleKeyForLayer(layerId: string): Annex14ToggleKey | null {
  if (layerId === 'a14-conical') return 'a14-conical'
  if (layerId === 'a14-inner-horizontal') return 'a14-inner-horizontal'
  if (layerId.startsWith('a14-transitional')) return 'a14-transitional'
  if (layerId.startsWith('a14-approach')) return 'a14-approach'
  if (layerId.startsWith('a14-takeoff-climb')) return 'a14-takeoff-climb'
  return null
}

function getDefaultVisibilityFor(set: SurfaceSet): Record<string, boolean> {
  const v: Record<string, boolean> = {}
  for (const item of SURFACE_SET_REGISTRY[set].legendItems) v[item.toggleKey] = item.defaultOn
  return v
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

export default function AirfieldMapGoogle({ onPointSelected, selectedPoint, surfaceAtPoint, flyToPoint, taxiways = [], surfaceSet, runwayClass }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const [rulerActive, setRulerActive] = useState(false)
  const ruler = useGoogleMapRuler(mapRef, rulerActive)
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | google.maps.Marker | null>(null)
  const polygonsRef = useRef<google.maps.Polygon[]>([])
  const taxiwayPolygonsRef = useRef<google.maps.Polygon[]>([])
  const labelsRef = useRef<google.maps.Marker[]>([])
  const userMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const userAccuracyRef = useRef<google.maps.Circle | null>(null)

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => getDefaultVisibilityFor(surfaceSet))
  const [runwayVisibility, setRunwayVisibility] = useState<Record<number, boolean>>({})
  const [legendOpen, setLegendOpen] = useState(false)
  const [showTaxiways, setShowTaxiways] = useState(false)
  const [apiReady, setApiReady] = useState(false)
  const onPointSelectedRef = useRef(onPointSelected)
  onPointSelectedRef.current = onPointSelected

  const { runways: installationRunways, installationId, mapProvider } = useInstallation()

  const hasApiKey = isGoogleMapsConfigured()

  const runwayLabels = installationRunways.length > 0
    ? installationRunways.map(rwy => rwy.runway_id ?? 'Unknown')
    : []
  const isMultiRunway = runwayLabels.length > 1

  // Active-set legend (UFC vs Part 77) drives the legend UI + show/hide-all.
  const legendItems: LegendItem[] = SURFACE_SET_REGISTRY[surfaceSet].legendItems

  // Part 77 only: runways with no faa_approach_type fall back to the
  // non-utility non-precision (<¾ mi) default — surfaced as a legend footer note.
  const unconfiguredRunwayCount = surfaceSet === 'faa_part77'
    ? installationRunways.filter(rwy => !rwy.faa_approach_type).length
    : 0

  // ICAO only: runways with no icao_strip_width_m draw their transitional surface
  // from the runway edge (an approximation) rather than the graded strip edge —
  // surfaced as a legend footer note (never a silent wrong answer).
  const stripApproxRunwayCount = surfaceSet === 'icao_annex14'
    ? installationRunways.filter(rwy => rwy.icao_strip_width_m == null).length
    : 0

  // Pair each runway's geometry with its faa_approach_type (Part 77) and its
  // icao_* variant (Annex 14) so the active set's builder can size per-runway
  // surfaces; the UFC builder consumes only the geometries (`.map(r => r.geometry)`).
  const getAllRunways = useCallback((): SurfaceRunwayInput[] => {
    if (installationRunways.length === 0) return []
    return installationRunways.map(rwy => ({
      geometry: getRunwayGeometry({
        end1: { latitude: rwy.end1_latitude ?? 0, longitude: rwy.end1_longitude ?? 0 },
        end2: { latitude: rwy.end2_latitude ?? 0, longitude: rwy.end2_longitude ?? 0 },
        length_ft: rwy.length_ft ?? 9000,
        width_ft: rwy.width_ft ?? 150,
        true_heading: rwy.true_heading ?? undefined,
        end1_elevation_msl: rwy.end1_elevation_msl,
        end2_elevation_msl: rwy.end2_elevation_msl,
      }),
      approachType: (rwy.faa_approach_type as FaaApproachType | null) ?? null,
      classification: (rwy.icao_approach_classification as IcaoApproachClassification | null) ?? null,
      codeNumber: (rwy.icao_code_number as IcaoCodeNumber | null) ?? null,
      stripWidthM: rwy.icao_strip_width_m ?? null,
    }))
  }, [installationRunways])

  // Load Google Maps API
  useEffect(() => {
    if (!hasApiKey) return
    initGoogleMaps().then(() => setApiReady(true))
  }, [hasApiKey])

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

    const runwaysWithTypes = getAllRunways()
    const allRwys = runwaysWithTypes.map(r => r.geometry)
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
      ...GOOGLE_MAP_OPTIONS,
      center,
      zoom: 13,
      zoomControlOptions: { position: google.maps.ControlPosition.TOP_RIGHT },
      mapId: 'glidepath-obstruction',
    })

    applyMapProvider(gmap, mapProvider)

    mapRef.current = gmap

    // Click handler — use ref to avoid stale closure
    gmap.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return
      onPointSelectedRef.current({ lat: e.latLng.lat(), lon: e.latLng.lng() })
    })

    // Build surface polygons through the surface-standards registry. Each set's
    // builder emits the shared 'runway' outline; the UFC builder draws at the
    // evaluated runway class (defaults to 'B' when the prop is absent — today's
    // pixel-identical behavior). The Part 77 builder ignores the class arg.
    if (allRwys.length > 0) {
      const registryEntry = SURFACE_SET_REGISTRY[surfaceSet]
      const surfaces = registryEntry.buildPolygons(runwaysWithTypes, runwayClass ?? 'B')
      const activeLayers = registryEntry.surfaceLayers
      const activeLegend: LegendItem[] = registryEntry.legendItems
      const toggleKeyForLayer: (layerId: string) => AnyToggleKey | null =
        surfaceSet === 'faa_part77'
          ? getPart77ToggleKeyForLayer
          : surfaceSet === 'icao_annex14'
            ? getAnnex14ToggleKeyForLayer
            : getToggleKeyForLayer

      for (const layer of activeLayers) {
        const matching = surfaces.filter(s => s.id === layer.id)
        for (const surface of matching) {
          const toggleKey = toggleKeyForLayer(surface.id)
          const initiallyVisible = toggleKey ? (activeLegend.find(l => l.toggleKey === toggleKey)?.defaultOn ?? true) : true

          const poly = new google.maps.Polygon({
            paths: surface.coords.map(([lng, lat]) => ({ lat, lng })),
            fillColor: layer.color,
            fillOpacity: layer.opacity,
            strokeColor: layer.color,
            strokeOpacity: Math.min(1, layer.opacity * 3),
            strokeWeight: surface.id === 'runway' ? 2 : 1,
            visible: initiallyVisible,
            clickable: false,
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
  }, [apiReady, installationId, mapProvider, surfaceSet, runwayClass])

  // Reset layer visibility to the active set's defaults whenever the surface
  // set flips (UFC ↔ Part 77); the two sets have disjoint toggle keys, so
  // stale keys would otherwise hide every polygon. Skip the mount run — the
  // useState initializer already seeds the correct defaults.
  const surfaceSetMountedRef = useRef(false)
  useEffect(() => {
    if (!surfaceSetMountedRef.current) {
      surfaceSetMountedRef.current = true
      return
    }
    setVisibility(getDefaultVisibilityFor(surfaceSet))
  }, [surfaceSet])

  // Sync surface visibility
  useEffect(() => {
    for (const poly of polygonsRef.current) {
      const toggleKey = (poly as any)._toggleKey as AnyToggleKey | null
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
          clickable: false,
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
            clickable: false,
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

    // Wrapper div to offset the anchor point — AdvancedMarkerElement anchors at bottom-center,
    // so we shift the circle down by half its height to center it on the click point
    const wrapper = document.createElement('div')
    wrapper.style.position = 'relative'
    wrapper.style.width = '24px'
    wrapper.style.height = '24px'
    wrapper.style.marginTop = '12px'
    const el = document.createElement('div')
    el.style.width = '24px'
    el.style.height = '24px'
    el.style.borderRadius = '50%'
    el.style.border = '3px solid #FFFFFF'
    el.style.background = surfaceAtPoint === 'No violation' ? '#22C55E' : '#EF4444'
    el.style.boxShadow = '0 0 8px rgba(0,0,0,0.5)'
    el.style.cursor = 'pointer'
    wrapper.appendChild(el)

    try {
      const advMarker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: selectedPoint.lat, lng: selectedPoint.lon },
        map: mapRef.current,
        content: wrapper,
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

  // Render / update the user-location overlay (purely informational —
  // separate from selectedPoint, which is the evaluation point set by
  // the inline "Use My Location" button in the sidebar).
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return
    if (!userLocation) {
      if (userMarkerRef.current) { userMarkerRef.current.map = null; userMarkerRef.current = null }
      if (userAccuracyRef.current) { userAccuracyRef.current.setMap(null); userAccuracyRef.current = null }
      return
    }

    const map = mapRef.current

    const el = document.createElement('div')
    el.style.width = '18px'
    el.style.height = '18px'
    el.style.borderRadius = '50%'
    el.style.background = '#22D3EE'
    el.style.border = '3px solid #FFFFFF'
    el.style.boxShadow = '0 0 0 1px rgba(15, 23, 42, 0.6), 0 0 12px rgba(34, 211, 238, 0.7)'
    el.title = `Your location (±${Math.round(userLocation.accuracy)} m)`

    if (userMarkerRef.current) userMarkerRef.current.map = null
    userMarkerRef.current = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: { lat: userLocation.lat, lng: userLocation.lng },
      content: el,
      zIndex: 9999,
    })

    if (userAccuracyRef.current) userAccuracyRef.current.setMap(null)
    userAccuracyRef.current = new google.maps.Circle({
      map,
      center: { lat: userLocation.lat, lng: userLocation.lng },
      radius: userLocation.accuracy,
      strokeColor: '#22D3EE',
      strokeOpacity: 0.6,
      strokeWeight: 1,
      fillColor: '#22D3EE',
      fillOpacity: 0.12,
      clickable: false,
    })

    map.panTo({ lat: userLocation.lat, lng: userLocation.lng })
    if ((map.getZoom() ?? 0) < 15) map.setZoom(16)
  }, [userLocation, mapLoaded])

  const toggleLayer = (key: string) => {
    setVisibility(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleRunway = (index: number) => {
    setRunwayVisibility(prev => ({ ...prev, [index]: prev[index] !== false ? false : true }))
  }

  const allVisible = legendItems.every(item => visibility[item.toggleKey])
  const toggleAll = () => {
    const nextVal = !allVisible
    setVisibility(prev => {
      const next = { ...prev }
      for (const item of legendItems) next[item.toggleKey] = nextVal
      return next
    })
  }

  if (!hasApiKey) {
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
      {/* Ruler + Use My Location — top right */}
      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
        <button
          onClick={() => setRulerActive(r => !r)}
          title={rulerActive ? 'Disable ruler (Esc to clear)' : 'Measure distance'}
          style={{
            padding: '6px 10px', borderRadius: 6, fontSize: 'var(--fs-xs)', fontWeight: 600,
            background: 'rgba(4, 7, 12, 0.88)',
            border: `1px solid ${rulerActive ? '#22D3EE' : 'rgba(255,255,255,0.3)'}`,
            color: rulerActive ? '#22D3EE' : '#FFF',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          📏 {rulerActive ? (ruler.totalFt > 0 ? ruler.formatDist(ruler.totalFt) : 'Click to measure') : 'Ruler'}
        </button>
        {rulerActive && ruler.points.length >= 2 && (
          <button
            onClick={() => ruler.clear()}
            style={{
              padding: '3px 8px', borderRadius: 4, fontSize: 'var(--fs-2xs)', fontWeight: 600,
              background: 'rgba(4, 7, 12, 0.88)', border: '1px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit',
            }}
          >Clear</button>
        )}
        {mapLoaded && (
          <UseMyLocationButton
            variant="overlay"
            acquired={!!userLocation}
            onLocation={(c) => setUserLocation(c)}
            onClear={() => setUserLocation(null)}
          />
        )}
      </div>
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
            {legendItems.map(item => (
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
            {surfaceSet === 'faa_part77' && unconfiguredRunwayCount > 0 && (
              <div style={{
                marginTop: 6, padding: '5px 7px', borderRadius: 6,
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                color: '#F59E0B', fontSize: 'var(--fs-2xs)', lineHeight: 1.4,
              }}>
                {unconfiguredRunwayCount} runway(s) not configured — using non-utility non-precision (&lt;¾ mi) defaults
              </div>
            )}
            {surfaceSet === 'icao_annex14' && stripApproxRunwayCount > 0 && (
              <div style={{
                marginTop: 6, padding: '5px 7px', borderRadius: 6,
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                color: '#F59E0B', fontSize: 'var(--fs-2xs)', lineHeight: 1.4,
              }}>
                {stripApproxRunwayCount} runway(s): strip width not configured — transitional surface approximate (drawn from the runway edge)
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
