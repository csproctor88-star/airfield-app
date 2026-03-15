'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import { isMapboxConfigured } from '@/lib/utils'
import { allAircraft } from '@/lib/aircraft-data'
import type { AircraftCharacteristics } from '@/lib/aircraft_database_schema'
import silhouetteManifest from '@/public/aircraft_silhouette_manifest.json'
import {
  fetchParkingPlans,
  createParkingPlan,
  updateParkingPlan,
  deleteParkingPlan,
  setActivePlan,
  fetchParkingSpots,
  createParkingSpot,
  updateParkingSpot,
  deleteParkingSpot,
  bulkUpdateSpotPositions,
  fetchParkingObstacles,
  createParkingObstacle,
  updateParkingObstacle,
  deleteParkingObstacle,
  fetchParkingTaxilanes,
  createParkingTaxilane,
  updateParkingTaxilane,
  deleteParkingTaxilane,
  fetchApronBoundaries,
  createApronBoundary,
  updateApronBoundary,
  deleteApronBoundary,
  type ParkingPlan,
  type ParkingSpot,
  type ParkingObstacle,
  type ParkingTaxilane,
  type ParkingApronBoundary,
} from '@/lib/supabase/parking'
import {
  getADGFromWingspan,
  getWingtipClearance,
  getWingtipClearanceDetail,
  findAllViolations,
  getAllClearanceResults,
  generateClearanceZonePolygon,
  getWingtipPositions,
  APRON_CONTEXT_LABELS,
  TABLE_6_1A_ITEMS,
  getTaxilaneEnvelopeHalfWidth,
  generateTaxilaneEnvelopePolygon,
  checkTaxilaneClearance,
  type ADGGroup,
  type ApronContext,
  type SpotWithAircraft,
  type ClearanceResult,
  type TaxilaneForCheck,
  getAircraftCenter,
  spotCenter,
} from '@/lib/calculations/parking-clearance'
import { offsetPoint } from '@/lib/calculations/geometry'
import { DEMO_PARKING_PLAN, DEMO_PARKING_SPOTS, DEMO_PARKING_OBSTACLES } from '@/lib/demo-data'

// ── Silhouette manifest lookup ──

const manifest = silhouetteManifest as Record<string, { base_name: string; path: string; filename: string }>

function findSilhouettePath(aircraftName: string): string | null {
  const normalize = (s: string) => s.replace(/[-\s_]/g, '').toLowerCase()
  const entries = Object.entries(manifest)

  // Helper: check normalized name against all manifest keys/base_names
  const tryMatch = (candidate: string): string | null => {
    const norm = normalize(candidate)
    for (const [key, entry] of entries) {
      if (normalize(key) === norm || normalize(entry.base_name) === norm) {
        return entry.path
      }
    }
    return null
  }

  // 1) Exact full name
  const exact = tryMatch(aircraftName)
  if (exact) return exact

  // 2) Extract military-style designation: "C-17A Globemaster III" → "C-17A"
  //    Also handles "KC-135R", "F/A-18F", "Boeing 737-800", etc.
  const desigMatch = aircraftName.match(/^([A-Z][A-Z/]*-?\d+\w*)/i)
  if (desigMatch) {
    const desig = desigMatch[1]  // e.g. "C-17A"

    // Try designation as-is
    const d1 = tryMatch(desig)
    if (d1) return d1

    // Strip variant letter suffix: "C-17A" → "C-17", "KC-135R" → "KC-135"
    const stripped = desig.replace(/([0-9])[A-Z]$/i, '$1')
    if (stripped !== desig) {
      const d2 = tryMatch(stripped)
      if (d2) return d2
    }
  }

  // 3) Progressive word trimming from the right
  //    "Boeing 747-400" → try "Boeing 747", then "Boeing"
  const words = aircraftName.split(/\s+/)
  for (let len = words.length - 1; len >= 1; len--) {
    const prefix = words.slice(0, len).join(' ')
    const r = tryMatch(prefix)
    if (r) return r
  }

  // 4) Try each individual word/token: catches "Airbus A380-800" → "A380"
  for (const word of words) {
    // Try the word itself and also strip trailing dash-numbers (A380-800 → A380)
    const r = tryMatch(word) || tryMatch(word.replace(/-\d+$/, ''))
    if (r) return r
  }

  // 5) Try just the numeric part: "Boeing 737-800" → "737"
  const numMatch = aircraftName.match(/\b(\d{2,4})\b/)
  if (numMatch) {
    const r = tryMatch(numMatch[1])
    if (r) return r
  }

  return null
}

function parseNum(v: string | undefined): number {
  if (!v) return 0
  return parseFloat(v.replace(/,/g, '')) || 0
}

// ── ADG Badge colors ──

const ADG_COLORS: Record<ADGGroup, string> = {
  I: '#22C55E', II: '#3B82F6', III: '#F59E0B', IV: '#EF4444', V: '#A855F7', VI: '#EC4899',
}

// ── Status colors ──

const STATUS_COLORS: Record<string, string> = {
  ok: '#22C55E',
  warning: '#F59E0B',
  violation: '#EF4444',
}

// ── SVG Silhouette rendering engine ──

const svgCache = new Map<string, SVGElement>()
const FT_TO_M = 0.3048

/** Fetch and parse an SVG file, caching the result */
async function loadSvgElement(path: string): Promise<SVGElement | null> {
  if (svgCache.has(path)) return svgCache.get(path)!
  try {
    const res = await fetch(path)
    if (!res.ok) return null
    const text = await res.text()
    const parser = new DOMParser()
    const doc = parser.parseFromString(text, 'image/svg+xml')
    const svg = doc.documentElement as unknown as SVGElement
    svgCache.set(path, svg)
    return svg
  } catch {
    return null
  }
}

// Fixed reference size for SVG rendering — Mapbox icon-size handles scaling
const REF_ICON_SIZE = 256

/** Tighten an SVG's viewBox to the actual content bounding box.
 *  All silhouette SVGs use a fixed 80×80 viewBox, but smaller aircraft
 *  only occupy a fraction of it. This crops to the actual path content. */
function tightenSvgViewBox(svg: SVGElement): SVGElement {
  const clone = svg.cloneNode(true) as SVGElement

  // Temporarily insert into DOM to use getBBox()
  const container = document.createElement('div')
  container.style.position = 'absolute'
  container.style.left = '-9999px'
  container.style.top = '-9999px'
  container.style.width = '200px'
  container.style.height = '200px'
  document.body.appendChild(container)

  // Need an actual SVGSVGElement in the DOM for getBBox
  const svgNs = 'http://www.w3.org/2000/svg'
  const tempSvg = document.createElementNS(svgNs, 'svg') as SVGSVGElement
  tempSvg.setAttribute('viewBox', clone.getAttribute('viewBox') || '0 0 80 80')
  tempSvg.innerHTML = clone.innerHTML
  container.appendChild(tempSvg)

  try {
    // Get bounding box of all content
    const paths = tempSvg.querySelectorAll('path, circle, rect, ellipse, polygon, polyline, line')
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    paths.forEach(el => {
      try {
        const bbox = (el as SVGGraphicsElement).getBBox()
        minX = Math.min(minX, bbox.x)
        minY = Math.min(minY, bbox.y)
        maxX = Math.max(maxX, bbox.x + bbox.width)
        maxY = Math.max(maxY, bbox.y + bbox.height)
      } catch { /* skip elements that can't compute bbox */ }
    })

    if (minX < Infinity) {
      const pad = 0.5  // small SVG-unit padding
      clone.setAttribute('viewBox', `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`)
    }
  } finally {
    document.body.removeChild(container)
  }

  return clone
}

/** Render an SVG silhouette to a fixed-size canvas image.
 *  Scaling to real-world size is handled by icon-size in the symbol layer. */
async function renderSilhouetteImage(
  aircraftName: string,
  wingspanFt: number,
  lengthFt: number,
): Promise<{ imageData: ImageData; width: number; height: number } | null> {
  const svgPath = findSilhouettePath(aircraftName)
  if (!svgPath) return null

  const svg = await loadSvgElement(svgPath)
  if (!svg) return null

  // Tighten viewBox so aircraft fills the image (SVGs share a fixed 80×80 viewBox)
  const tightSvg = tightenSvgViewBox(svg)

  // Render to a fixed canvas — aspect ratio from aircraft dimensions
  const aspect = lengthFt / wingspanFt
  let w: number, h: number
  if (aspect >= 1) {
    h = REF_ICON_SIZE
    w = Math.round(REF_ICON_SIZE / aspect)
  } else {
    w = REF_ICON_SIZE
    h = Math.round(REF_ICON_SIZE * aspect)
  }

  const canvas = document.createElement('canvas')
  const padding = 4
  canvas.width = w + padding * 2
  canvas.height = h + padding * 2
  const ctx = canvas.getContext('2d')!

  const svgMarkup = new XMLSerializer().serializeToString(tightSvg)
  const recolored = svgMarkup
    .replace(/fill="[^"]*"/g, 'fill="#E0E7FF"')
    .replace(/stroke="[^"]*"/g, 'stroke="#1E293B"')

  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      ctx.filter = 'drop-shadow(0px 0px 2px rgba(0,0,0,0.8))'
      ctx.drawImage(img, padding, padding, w, h)
      ctx.filter = 'none'

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      resolve({ imageData, width: canvas.width, height: canvas.height })
    }
    img.onerror = () => resolve(null)
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(recolored)
  })
}

/** Generate a fallback circle icon for aircraft without silhouettes */
function renderFallbackIcon(): { imageData: ImageData; width: number; height: number } {
  const size = REF_ICON_SIZE
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cx = size / 2
  ctx.beginPath()
  ctx.arc(cx, cx, size / 2 - 4, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(56, 189, 248, 0.5)'
  ctx.fill()
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 2
  ctx.stroke()
  return { imageData: ctx.getImageData(0, 0, size, size), width: size, height: size }
}

/** Compute the icon-size scale factor to make a REF_ICON_SIZE image match
 *  the aircraft's real-world wingspan at the current map zoom. */
function computeIconScale(wingspanFt: number, lengthFt: number, mapInstance: mapboxgl.Map): number {
  const center = mapInstance.getCenter()
  const p0 = mapInstance.project(center)

  // Measure how many CSS pixels the wingspan should occupy
  const wingspanM = wingspanFt * FT_TO_M
  const dLng = wingspanM / (111319.9 * Math.cos(center.lat * Math.PI / 180))
  const pW = mapInstance.project([center.lng + dLng, center.lat])
  const targetCssPx = Math.abs(pW.x - p0.x)

  // The icon image is REF_ICON_SIZE px wide (for the wider dimension)
  // Figure out which dimension is wider in the image
  const aspect = lengthFt / wingspanFt
  const imageWidthPx = aspect >= 1 ? Math.round(REF_ICON_SIZE / aspect) + 8 : REF_ICON_SIZE + 8

  return targetCssPx / imageWidthPx
}

// ── Main Page ──

export default function ParkingPage() {
  const { installationId, currentInstallation, runways } = useInstallation()

  // ── State ──
  const [plans, setPlans] = useState<ParkingPlan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [spots, setSpots] = useState<ParkingSpot[]>([])
  const [obstacles, setObstacles] = useState<ParkingObstacle[]>([])
  const [taxilanes, setTaxilanes] = useState<ParkingTaxilane[]>([])
  const [apronBoundaries, setApronBoundaries] = useState<ParkingApronBoundary[]>([])
  const [loading, setLoading] = useState(true)
  const [mapLoaded, setMapLoaded] = useState(false)

  // UI state
  const [showNewPlan, setShowNewPlan] = useState(false)
  const [newPlanName, setNewPlanName] = useState('')
  const [newPlanDesc, setNewPlanDesc] = useState('')
  const [showAircraftPicker, setShowAircraftPicker] = useState(false)
  const [aircraftSearch, setAircraftSearch] = useState('')
  const [showObstacleMenu, setShowObstacleMenu] = useState(false)
  const [placingAircraft, setPlacingAircraft] = useState<AircraftCharacteristics | null>(null)
  const [placingObstacle, setPlacingObstacle] = useState<ParkingObstacle['obstacle_type'] | null>(null)
  const [editingSpot, setEditingSpot] = useState<ParkingSpot | null>(null)
  const [editingObstacle, setEditingObstacle] = useState<ParkingObstacle | null>(null)
  const [showClearances, setShowClearances] = useState(true)
  const [apronContext, setApronContext] = useState<ApronContext>('parking')
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ aircraft: true, obstacles: false, taxilanes: false, clearance: true, settings: false, reference: false })
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({ aircraft: true, obstacles: true, taxilanes: true, boundaries: true, clearance: true })
  const toggleLayerVisibility = (key: string) => setVisibleLayers(prev => ({ ...prev, [key]: !prev[key] }))
  const toggleSection = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  const [aircraftCategoryFilter, setAircraftCategoryFilter] = useState<'all' | 'military' | 'commercial'>('all')
  const [editingTaxilane, setEditingTaxilane] = useState<ParkingTaxilane | null>(null)
  const [editingBoundary, setEditingBoundary] = useState<ParkingApronBoundary | null>(null)

  // Line drawing state
  const [drawingLinePoints, setDrawingLinePoints] = useState<[number, number][]>([])
  const [drawingLineObsId, setDrawingLineObsId] = useState<string | null>(null)

  // Taxilane drawing state
  const [drawingTaxilanePoints, setDrawingTaxilanePoints] = useState<[number, number][]>([])
  const [drawingTaxilaneId, setDrawingTaxilaneId] = useState<string | null>(null)
  const [drawingTaxilaneType, setDrawingTaxilaneType] = useState<'interior' | 'peripheral'>('interior')

  // Apron boundary drawing state
  const [drawingBoundaryPoints, setDrawingBoundaryPoints] = useState<[number, number][]>([])
  const [drawingBoundaryId, setDrawingBoundaryId] = useState<string | null>(null)

  // Freeform obstacle drawing state (circle drag / building drag)
  const [drawingObsType, setDrawingObsType] = useState<'circle' | 'building' | null>(null)
  const [drawingObsStart, setDrawingObsStart] = useState<[number, number] | null>(null) // [lng, lat] mousedown point
  const [drawingObsCurrent, setDrawingObsCurrent] = useState<[number, number] | null>(null) // [lng, lat] current mouse
  const drawingObsTypeRef = useRef(drawingObsType)
  drawingObsTypeRef.current = drawingObsType
  const drawingObsStartRef = useRef(drawingObsStart)
  drawingObsStartRef.current = drawingObsStart

  // Lock mode — prevents dragging when locked
  const [planLocked, setPlanLocked] = useState(false)
  const planLockedRef = useRef(planLocked)
  planLockedRef.current = planLocked

  // Map refs
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const dragSpotId = useRef<string | null>(null)
  const dragObstacleId = useRef<string | null>(null)
  const isDraggingRef = useRef(false)
  const silhouetteImagesRef = useRef<Set<string>>(new Set()) // track registered image names
  // ── Derived data ──

  const selectedPlan = useMemo(
    () => plans.find(p => p.id === selectedPlanId) || null,
    [plans, selectedPlanId]
  )

  const spotsWithAircraft: SpotWithAircraft[] = useMemo(() => {
    return spots.map(s => {
      const ac = allAircraft.find(a => a.aircraft === s.aircraft_name)
      return {
        ...s,
        wingspan_ft: ac ? parseNum(ac.wing_span_ft) : 50,
        length_ft: ac ? parseNum(ac.length_ft) : 60,
        pivot_point_ft: ac ? parseNum(ac.nose_gear_ft) : 0,
      }
    })
  }, [spots])

  // Stable refs for drag handler (avoids re-registering listeners on data change)
  const spotsWithAircraftRef = useRef(spotsWithAircraft)
  spotsWithAircraftRef.current = spotsWithAircraft
  const obstaclesRef = useRef(obstacles)
  obstaclesRef.current = obstacles
  const taxilanesRef = useRef(taxilanes)
  taxilanesRef.current = taxilanes
  const apronContextRef = useRef(apronContext)
  apronContextRef.current = apronContext

  const taxilanesForCheck: TaxilaneForCheck[] = useMemo(
    () => taxilanes.map(t => ({
      id: t.id,
      name: t.name,
      taxilane_type: t.taxilane_type,
      design_wingspan_ft: t.design_wingspan_ft,
      line_coords: t.line_coords,
      is_transient: t.is_transient,
    })),
    [taxilanes]
  )

  const allResults: ClearanceResult[] = useMemo(
    () => getAllClearanceResults(spotsWithAircraft, obstacles, apronContext, taxilanesForCheck.length > 0 ? taxilanesForCheck : undefined),
    [spotsWithAircraft, obstacles, apronContext, taxilanesForCheck]
  )

  const violations = useMemo(
    () => allResults.filter(r => r.status === 'violation'),
    [allResults]
  )
  const warnings = useMemo(
    () => allResults.filter(r => r.status === 'warning'),
    [allResults]
  )

  // ── Data loading ──

  const isDemo = !installationId

  const loadPlans = useCallback(async () => {
    if (!installationId) {
      setPlans([DEMO_PARKING_PLAN as ParkingPlan])
      if (!selectedPlanId) setSelectedPlanId(DEMO_PARKING_PLAN.id)
      return
    }
    const data = await fetchParkingPlans(installationId)
    setPlans(data)
    if (data.length > 0 && !selectedPlanId) {
      const active = data.find(p => p.is_active)
      setSelectedPlanId(active?.id || data[0].id)
    }
  }, [installationId, selectedPlanId])

  const loadSpots = useCallback(async () => {
    if (!selectedPlanId) { setSpots([]); return }
    if (isDemo) {
      setSpots(DEMO_PARKING_SPOTS as ParkingSpot[])
      return
    }
    const data = await fetchParkingSpots(selectedPlanId)
    setSpots(data)
  }, [selectedPlanId, isDemo])

  const loadObstacles = useCallback(async () => {
    if (isDemo) {
      setObstacles(DEMO_PARKING_OBSTACLES as ParkingObstacle[])
      return
    }
    if (!installationId) { setObstacles([]); return }
    const data = await fetchParkingObstacles(installationId)
    setObstacles(data)
  }, [installationId, isDemo])

  useEffect(() => {
    setLoading(true)
    loadPlans().finally(() => setLoading(false))
  }, [loadPlans])

  const loadTaxilanes = useCallback(async () => {
    if (!selectedPlanId || isDemo) { setTaxilanes([]); return }
    const data = await fetchParkingTaxilanes(selectedPlanId)
    setTaxilanes(data)
  }, [selectedPlanId, isDemo])

  const loadApronBoundaries = useCallback(async () => {
    if (!selectedPlanId || isDemo) { setApronBoundaries([]); return }
    const data = await fetchApronBoundaries(selectedPlanId)
    setApronBoundaries(data)
  }, [selectedPlanId, isDemo])

  useEffect(() => { loadSpots() }, [loadSpots])
  useEffect(() => { loadObstacles() }, [loadObstacles])
  useEffect(() => { loadTaxilanes() }, [loadTaxilanes])
  useEffect(() => { loadApronBoundaries() }, [loadApronBoundaries])

  // ── Map initialization ──

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

  useEffect(() => {
    if (!mapContainer.current || !token || !installationId) return

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
      zoom: 15,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    })

    m.addControl(new mapboxgl.NavigationControl(), 'bottom-right')
    m.addControl(new mapboxgl.ScaleControl({ unit: 'imperial' }), 'bottom-left')

    m.on('load', () => {
      setMapLoaded(true)
    })

    map.current = m

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
        setMapLoaded(false)
      }
    }
  }, [token, installationId, runways])

  // ── Map click handler for placing aircraft/obstacles ──

  useEffect(() => {
    const m = map.current
    if (!m || !mapLoaded) return

    const handleClick = async (e: mapboxgl.MapMouseEvent) => {
      // Ignore clicks that are part of a drag operation
      if (isDraggingRef.current) return

      const { lng, lat } = e.lngLat

      // ── Freeform obstacle drawing — second click finalizes ──
      if (drawingObsType && drawingObsStart && installationId) {
        const [startLng, startLat] = drawingObsStart
        const { distanceFt } = await import('@/lib/calculations/geometry')

        if (drawingObsType === 'circle') {
          const radius = distanceFt({ lat: startLat, lon: startLng }, { lat, lon: lng })
          if (radius < 5) { toast.error('Drag further to set radius'); return }
          const obs = await createParkingObstacle({
            base_id: installationId,
            obstacle_type: 'circle',
            longitude: startLng,
            latitude: startLat,
            radius_ft: Math.round(radius),
            name: `Circle ${obstacles.length + 1}`,
          })
          if (obs) {
            setObstacles(prev => [...prev, obs])
            setEditingObstacle(obs)
            setOpenSections(prev => ({ ...prev, obstacles: true }))
            toast.success(`Circle placed (${Math.round(radius)}ft radius)`)
          }
        } else if (drawingObsType === 'building') {
          // Compute width/length from start→current in local frame
          const dEastFt = (lng - startLng) * 111319.9 * Math.cos(((startLat + lat) / 2) * Math.PI / 180) * 3.28084
          const dNorthFt = (lat - startLat) * 111319.9 * 3.28084
          const widthFt = Math.abs(dEastFt)
          const lengthFt = Math.abs(dNorthFt)
          if (widthFt < 5 && lengthFt < 5) { toast.error('Drag further to set size'); return }
          // Center is midpoint
          const centerLng = (startLng + lng) / 2
          const centerLat = (startLat + lat) / 2
          const obs = await createParkingObstacle({
            base_id: installationId,
            obstacle_type: 'building',
            longitude: centerLng,
            latitude: centerLat,
            width_ft: Math.round(Math.max(widthFt, 10)),
            length_ft: Math.round(Math.max(lengthFt, 10)),
            name: `Building ${obstacles.length + 1}`,
          })
          if (obs) {
            setObstacles(prev => [...prev, obs])
            setEditingObstacle(obs)
            setOpenSections(prev => ({ ...prev, obstacles: true }))
            toast.success(`Building placed (${Math.round(widthFt)}×${Math.round(lengthFt)}ft)`)
          }
        }
        setDrawingObsType(null)
        setDrawingObsStart(null)
        setDrawingObsCurrent(null)
        return
      }

      if (placingAircraft && selectedPlanId && installationId) {
        const ws = parseNum(placingAircraft.wing_span_ft)
        const clearance = getWingtipClearance(ws, apronContext, placingAircraft.aircraft)

        const spot = await createParkingSpot({
          plan_id: selectedPlanId,
          base_id: installationId,
          aircraft_name: placingAircraft.aircraft,
          longitude: lng,
          latitude: lat,
          heading_deg: 0,
          clearance_ft: clearance,
          spot_type: 'apron',
          status: 'available',
        })

        if (spot) {
          setSpots(prev => [...prev, spot])
          setEditingSpot(spot)
          setOpenSections(prev => ({ ...prev, aircraft: true }))
          toast.success(`Placed ${placingAircraft.aircraft}`)
        } else {
          toast.error('Failed to place aircraft')
        }
        setPlacingAircraft(null)
        return
      }

      // Line drawing mode — accumulate points
      if (drawingLineObsId) {
        setDrawingLinePoints(prev => [...prev, [lng, lat]])
        return
      }

      // Taxilane drawing mode — accumulate points
      if (drawingTaxilaneId) {
        setDrawingTaxilanePoints(prev => [...prev, [lng, lat]])
        return
      }

      // Apron boundary drawing mode — accumulate points
      if (drawingBoundaryId) {
        setDrawingBoundaryPoints(prev => [...prev, [lng, lat]])
        return
      }

      if (placingObstacle && installationId) {
        if (placingObstacle === 'line') {
          // Start line drawing: create obstacle at first click, enter drawing mode
          const obs = await createParkingObstacle({
            base_id: installationId,
            obstacle_type: 'line',
            longitude: lng,
            latitude: lat,
            name: `Line ${obstacles.length + 1}`,
          })
          if (obs) {
            setObstacles(prev => [...prev, obs])
            setDrawingLineObsId(obs.id)
            setDrawingLinePoints([[lng, lat]])
            toast.success('Click to add points. Double-click or press Finish to complete.')
          }
          setPlacingObstacle(null)
          return
        }

        // Building & circle: enter freeform drag-draw mode
        if (placingObstacle === 'building' || placingObstacle === 'circle') {
          setDrawingObsType(placingObstacle)
          setDrawingObsStart([lng, lat])
          setDrawingObsCurrent([lng, lat])
          setPlacingObstacle(null)
          toast.success(`Click and drag to set ${placingObstacle === 'circle' ? 'radius' : 'size'}. Release to confirm.`)
          return
        }

        // Point: instant place
        const obs = await createParkingObstacle({
          base_id: installationId,
          obstacle_type: placingObstacle,
          longitude: lng,
          latitude: lat,
          name: `Obstacle ${obstacles.length + 1}`,
        })

        if (obs) {
          setObstacles(prev => [...prev, obs])
          toast.success(`Placed ${placingObstacle} obstacle`)
          setEditingObstacle(obs)
        }
        setPlacingObstacle(null)
        return
      }
    }

    m.on('click', handleClick)
    return () => { m.off('click', handleClick) }
  }, [mapLoaded, placingAircraft, placingObstacle, selectedPlanId, installationId, obstacles.length, drawingLineObsId, drawingTaxilaneId, drawingBoundaryId, drawingObsType, drawingObsStart])

  // ── Render aircraft on map ──

  useEffect(() => {
    const m = map.current
    if (!m || !mapLoaded) return

    // Clean up old sources/layers
    const cleanIds = ['parking-clearance-fill', 'parking-clearance-line', 'parking-obstacles-fill', 'parking-obstacles-line', 'parking-obstacles-points', 'parking-obstacles-labels', 'parking-obstacles-lines-stroke', 'parking-aircraft-symbols', 'parking-aircraft-labels', 'parking-nose-gear-markers', 'parking-nose-gear-labels', 'parking-drag-labels', 'parking-drawing-line-layer', 'parking-drawing-line-dots', 'parking-taxilane-envelope-fill', 'parking-taxilane-envelope-line', 'parking-taxilane-centerline', 'parking-taxilane-labels', 'parking-apron-boundary-fill', 'parking-apron-boundary-line', 'parking-apron-boundary-labels']
    for (const id of cleanIds) {
      if (m.getLayer(id)) m.removeLayer(id)
    }
    if (m.getSource('parking-clearance')) m.removeSource('parking-clearance')
    if (m.getSource('parking-obstacles-src')) m.removeSource('parking-obstacles-src')
    if (m.getSource('parking-aircraft')) m.removeSource('parking-aircraft')
    if (m.getSource('parking-drag-labels')) m.removeSource('parking-drag-labels')
    if (m.getSource('parking-drawing-line')) m.removeSource('parking-drawing-line')
    if (m.getSource('parking-taxilane-envelopes')) m.removeSource('parking-taxilane-envelopes')
    if (m.getSource('parking-taxilane-centerlines')) m.removeSource('parking-taxilane-centerlines')
    if (m.getSource('parking-apron-boundaries-src')) m.removeSource('parking-apron-boundaries-src')
    if (m.getSource('parking-nose-gear')) m.removeSource('parking-nose-gear')

    // Clean up old silhouette images
    Array.from(silhouetteImagesRef.current).forEach(imgName => {
      if (m.hasImage(imgName)) m.removeImage(imgName)
    })
    silhouetteImagesRef.current.clear()

    // Build clearance zone GeoJSON
    const clearanceFeatures: GeoJSON.Feature[] = []
    for (const spot of spotsWithAircraft) {
      const clearanceFt = spot.clearance_ft ?? getWingtipClearance(spot.wingspan_ft, apronContext, spot.aircraft_name)
      const polygon = generateClearanceZonePolygon(spot, clearanceFt)

      // Determine status for this aircraft
      const spotResults = allResults.filter(
        r => r.spot_a_id === spot.id || r.spot_b_id === spot.id
      )
      const hasViolation = spotResults.some(r => r.status === 'violation')
      const hasWarning = spotResults.some(r => r.status === 'warning')
      const color = hasViolation ? '#EF4444' : hasWarning ? '#F59E0B' : '#22C55E'

      clearanceFeatures.push({
        type: 'Feature',
        properties: { color, spotId: spot.id },
        geometry: { type: 'Polygon', coordinates: [polygon] },
      })
    }

    if (showClearances && visibleLayers.clearance && clearanceFeatures.length > 0) {
      m.addSource('parking-clearance', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: clearanceFeatures },
      })

      m.addLayer({
        id: 'parking-clearance-fill',
        type: 'fill',
        source: 'parking-clearance',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.15,
        },
      })

      m.addLayer({
        id: 'parking-clearance-line',
        type: 'line',
        source: 'parking-clearance',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 1.5,
          'line-opacity': 0.6,
          'line-dasharray': [4, 4],
        },
      })
    }

    // Build obstacle GeoJSON
    const obstacleFeatures: GeoJSON.Feature[] = []
    for (const obs of obstacles) {
      if (obs.obstacle_type === 'point') {
        obstacleFeatures.push({
          type: 'Feature',
          properties: { name: obs.name, type: obs.obstacle_type, obsId: obs.id },
          geometry: { type: 'Point', coordinates: [obs.longitude, obs.latitude] },
        })
      } else if (obs.obstacle_type === 'building') {
        const halfW = (obs.width_ft || 50) / 2
        const halfL = (obs.length_ft || 50) / 2
        const rot = obs.rotation_deg || 0
        const center = { lat: obs.latitude, lon: obs.longitude }
        const corners = [
          offsetPoint(offsetPoint(center, rot, halfL), (rot + 90) % 360, halfW),
          offsetPoint(offsetPoint(center, rot, halfL), (rot - 90 + 360) % 360, halfW),
          offsetPoint(offsetPoint(center, (rot + 180) % 360, halfL), (rot - 90 + 360) % 360, halfW),
          offsetPoint(offsetPoint(center, (rot + 180) % 360, halfL), (rot + 90) % 360, halfW),
        ]
        obstacleFeatures.push({
          type: 'Feature',
          properties: { name: obs.name, type: obs.obstacle_type, obsId: obs.id },
          geometry: {
            type: 'Polygon',
            coordinates: [corners.map(c => [c.lon, c.lat]).concat([[corners[0].lon, corners[0].lat]])],
          },
        })
      } else if (obs.obstacle_type === 'circle') {
        const center = { lat: obs.latitude, lon: obs.longitude }
        const radius = obs.radius_ft || 50
        const segs = 48
        const coords: [number, number][] = []
        for (let i = 0; i <= segs; i++) {
          const bearing = (360 * i) / segs
          const pt = offsetPoint(center, bearing, radius)
          coords.push([pt.lon, pt.lat])
        }
        obstacleFeatures.push({
          type: 'Feature',
          properties: { name: obs.name, type: obs.obstacle_type, obsId: obs.id },
          geometry: { type: 'Polygon', coordinates: [coords] },
        })
      } else if (obs.obstacle_type === 'line' && obs.line_coords) {
        obstacleFeatures.push({
          type: 'Feature',
          properties: { name: obs.name, type: obs.obstacle_type, obsId: obs.id },
          geometry: { type: 'LineString', coordinates: obs.line_coords },
        })
      }
    }

    if (obstacleFeatures.length > 0 && visibleLayers.obstacles) {
      m.addSource('parking-obstacles-src', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: obstacleFeatures },
      })

      // Polygon obstacles
      m.addLayer({
        id: 'parking-obstacles-fill',
        type: 'fill',
        source: 'parking-obstacles-src',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': '#F97316',
          'fill-opacity': 0.35,
        },
      })

      m.addLayer({
        id: 'parking-obstacles-line',
        type: 'line',
        source: 'parking-obstacles-src',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'line-color': '#F97316',
          'line-width': 2,
        },
      })

      // Point obstacles — circle layer
      m.addLayer({
        id: 'parking-obstacles-points',
        type: 'circle',
        source: 'parking-obstacles-src',
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 6,
          'circle-color': '#F97316',
          'circle-stroke-color': '#FFF',
          'circle-stroke-width': 1.5,
        },
      })

      // Line obstacles — stroke layer
      m.addLayer({
        id: 'parking-obstacles-lines-stroke',
        type: 'line',
        source: 'parking-obstacles-src',
        filter: ['==', '$type', 'LineString'],
        paint: {
          'line-color': '#F97316',
          'line-width': 3,
        },
      })

      // Obstacle labels
      m.addLayer({
        id: 'parking-obstacles-labels',
        type: 'symbol',
        source: 'parking-obstacles-src',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#F97316',
          'text-halo-color': '#000',
          'text-halo-width': 1,
        },
      })
    }

    // Build taxilane envelopes + centerlines GeoJSON
    const taxilaneEnvelopeFeatures: GeoJSON.Feature[] = []
    const taxilaneCenterlineFeatures: GeoJSON.Feature[] = []
    for (const tl of taxilanes) {
      if (!tl.line_coords || tl.line_coords.length < 2) continue
      const tlForCheck: TaxilaneForCheck = { id: tl.id, name: tl.name, taxilane_type: tl.taxilane_type, design_wingspan_ft: tl.design_wingspan_ft, line_coords: tl.line_coords, is_transient: tl.is_transient }
      const { halfWidth, detail } = getTaxilaneEnvelopeHalfWidth(tlForCheck)
      const envelope = generateTaxilaneEnvelopePolygon(tl.line_coords, halfWidth)

      // Check if any aircraft violates this taxilane
      const hasViolation = spotsWithAircraft.some(s => {
        const r = checkTaxilaneClearance(s, tlForCheck)
        return r.status === 'violation'
      })
      const hasWarning = !hasViolation && spotsWithAircraft.some(s => {
        const r = checkTaxilaneClearance(s, tlForCheck)
        return r.status === 'warning'
      })
      const envelopeColor = hasViolation ? '#EF4444' : hasWarning ? '#F59E0B' : tl.taxilane_type === 'peripheral' ? '#8B5CF6' : '#3B82F6'

      if (envelope.length > 0) {
        taxilaneEnvelopeFeatures.push({
          type: 'Feature',
          properties: { color: envelopeColor, name: tl.name || (tl.taxilane_type === 'peripheral' ? 'Peripheral' : 'Interior'), halfWidth: Math.round(halfWidth), item: detail.ufc_item },
          geometry: { type: 'Polygon', coordinates: [envelope] },
        })
      }
      taxilaneCenterlineFeatures.push({
        type: 'Feature',
        properties: { name: tl.name || (tl.taxilane_type === 'peripheral' ? 'Peripheral' : 'Interior'), type: tl.taxilane_type, item: detail.ufc_item, halfWidth: Math.round(halfWidth) },
        geometry: { type: 'LineString', coordinates: tl.line_coords },
      })
    }

    if (taxilaneEnvelopeFeatures.length > 0 && showClearances && visibleLayers.taxilanes) {
      m.addSource('parking-taxilane-envelopes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: taxilaneEnvelopeFeatures },
      })
      m.addLayer({
        id: 'parking-taxilane-envelope-fill', type: 'fill', source: 'parking-taxilane-envelopes',
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.1 },
      })
      m.addLayer({
        id: 'parking-taxilane-envelope-line', type: 'line', source: 'parking-taxilane-envelopes',
        paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-dasharray': [6, 3] },
      })
    }

    if (taxilaneCenterlineFeatures.length > 0 && visibleLayers.taxilanes) {
      m.addSource('parking-taxilane-centerlines', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: taxilaneCenterlineFeatures },
      })
      m.addLayer({
        id: 'parking-taxilane-centerline', type: 'line', source: 'parking-taxilane-centerlines',
        paint: {
          'line-color': ['match', ['get', 'type'], 'peripheral', '#8B5CF6', '#3B82F6'],
          'line-width': 2.5,
          'line-dasharray': [8, 4],
        },
      })
      m.addLayer({
        id: 'parking-taxilane-labels', type: 'symbol', source: 'parking-taxilane-centerlines',
        layout: {
          'symbol-placement': 'line-center',
          'text-field': ['concat', ['get', 'name'], ' (', ['get', 'item'], ')'],
          'text-size': 11,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': ['match', ['get', 'type'], 'peripheral', '#8B5CF6', '#3B82F6'],
          'text-halo-color': '#000',
          'text-halo-width': 1,
        },
      })
    }

    // Build apron boundary GeoJSON
    const apronBoundaryFeatures: GeoJSON.Feature[] = []
    for (const ab of apronBoundaries) {
      if (!ab.polygon_coords || ab.polygon_coords.length < 3) continue
      const coords = [...ab.polygon_coords, ab.polygon_coords[0]]
      apronBoundaryFeatures.push({
        type: 'Feature',
        properties: { name: ab.name || 'Apron Boundary' },
        geometry: { type: 'Polygon', coordinates: [coords] },
      })
    }

    if (apronBoundaryFeatures.length > 0 && visibleLayers.boundaries) {
      m.addSource('parking-apron-boundaries-src', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: apronBoundaryFeatures },
      })
      m.addLayer({
        id: 'parking-apron-boundary-fill', type: 'fill', source: 'parking-apron-boundaries-src',
        paint: { 'fill-color': '#10B981', 'fill-opacity': 0.06 },
      })
      m.addLayer({
        id: 'parking-apron-boundary-line', type: 'line', source: 'parking-apron-boundaries-src',
        paint: { 'line-color': '#10B981', 'line-width': 2, 'line-dasharray': [4, 2] },
      })
      m.addLayer({
        id: 'parking-apron-boundary-labels', type: 'symbol', source: 'parking-apron-boundaries-src',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#10B981', 'text-halo-color': '#000', 'text-halo-width': 1 },
      })
    }

    // Build aircraft GeoJSON with to-scale silhouettes
    // Position = aircraft center (offset from nose gear block by pivot_point)
    const aircraftFeatures: GeoJSON.Feature[] = spotsWithAircraft.map(s => {
      const c = spotCenter(s)
      return {
        type: 'Feature',
        properties: {
          spotId: s.id,
          name: s.aircraft_name || 'Aircraft',
          wingspan: s.wingspan_ft,
          length: s.length_ft,
          heading: s.heading_deg,
          tailNumber: s.tail_number || '',
          adg: getADGFromWingspan(s.wingspan_ft),
          iconId: `sil-${s.id}`,
          iconScale: computeIconScale(s.wingspan_ft, s.length_ft, m),
        },
        geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
      }
    })

    // Nose gear block markers (small diamond at the stored spot position)
    const noseGearFeatures: GeoJSON.Feature[] = spotsWithAircraft
      .filter(s => s.pivot_point_ft > 0)
      .map(s => ({
        type: 'Feature',
        properties: { spotId: s.id, name: s.spot_name || s.aircraft_name || '' },
        geometry: { type: 'Point', coordinates: [s.longitude, s.latitude] },
      }))

    if (aircraftFeatures.length > 0 && visibleLayers.aircraft) {
      m.addSource('parking-aircraft', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: aircraftFeatures },
      })

      // Register silhouette images for each aircraft at current zoom
      const registerImages = async () => {
        for (const spot of spotsWithAircraft) {
          const imgName = `sil-${spot.id}`

          // Remove old image if exists
          if (m.hasImage(imgName)) {
            m.removeImage(imgName)
          }

          const result = await renderSilhouetteImage(
            spot.aircraft_name || '',
            spot.wingspan_ft,
            spot.length_ft,
          )

          if (result) {
            m.addImage(imgName, result.imageData, { sdf: false })
            silhouetteImagesRef.current.add(imgName)
          } else {
            const fallback = renderFallbackIcon()
            m.addImage(imgName, fallback.imageData, { sdf: false })
            silhouetteImagesRef.current.add(imgName)
          }
        }

        // Add symbol layer with data-driven icon-size for to-scale rendering
        if (!m.getLayer('parking-aircraft-symbols')) {
          m.addLayer({
            id: 'parking-aircraft-symbols',
            type: 'symbol',
            source: 'parking-aircraft',
            layout: {
              'icon-image': ['get', 'iconId'],
              'icon-rotate': ['get', 'heading'],
              'icon-rotation-alignment': 'map',
              'icon-allow-overlap': true,
              'icon-size': ['get', 'iconScale'],
            },
          })
        }

        // Labels layer on top
        if (!m.getLayer('parking-aircraft-labels')) {
          m.addLayer({
            id: 'parking-aircraft-labels',
            type: 'symbol',
            source: 'parking-aircraft',
            layout: {
              'text-field': ['concat', ['get', 'name'], '\n', ['get', 'tailNumber']],
              'text-size': 11,
              'text-offset': [0, 2],
              'text-anchor': 'top',
              'text-allow-overlap': true,
            },
            paint: {
              'text-color': '#FFFFFF',
              'text-halo-color': '#000000',
              'text-halo-width': 1,
            },
          })
        }
      }

      registerImages()
    }

    // Nose gear block markers
    if (noseGearFeatures.length > 0 && visibleLayers.aircraft) {
      m.addSource('parking-nose-gear', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: noseGearFeatures },
      })
      m.addLayer({
        id: 'parking-nose-gear-markers',
        type: 'circle',
        source: 'parking-nose-gear',
        paint: {
          'circle-radius': 5,
          'circle-color': '#FFD700',
          'circle-stroke-color': '#000',
          'circle-stroke-width': 1.5,
        },
      })
      m.addLayer({
        id: 'parking-nose-gear-labels',
        type: 'symbol',
        source: 'parking-nose-gear',
        layout: {
          'text-field': 'NG',
          'text-size': 9,
          'text-offset': [0, -1.2],
          'text-anchor': 'bottom',
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#FFD700', 'text-halo-color': '#000', 'text-halo-width': 1 },
      })
    }
  }, [mapLoaded, spotsWithAircraft, obstacles, taxilanes, apronBoundaries, allResults, showClearances, apronContext, visibleLayers])

  // ── Update icon scale on zoom change ──
  // Images are fixed-size; only the iconScale property needs updating on zoom.

  useEffect(() => {
    const m = map.current
    if (!m || !mapLoaded || spotsWithAircraft.length === 0) return

    const onZoomEnd = () => {
      const src = m.getSource('parking-aircraft') as mapboxgl.GeoJSONSource | undefined
      if (src) {
        src.setData({
          type: 'FeatureCollection',
          features: spotsWithAircraft.map(s => {
            const c = spotCenter(s)
            return {
              type: 'Feature' as const,
              properties: {
                spotId: s.id,
                name: s.aircraft_name || 'Aircraft',
                wingspan: s.wingspan_ft,
                length: s.length_ft,
                heading: s.heading_deg,
                tailNumber: s.tail_number || '',
                adg: getADGFromWingspan(s.wingspan_ft),
                iconId: `sil-${s.id}`,
                iconScale: computeIconScale(s.wingspan_ft, s.length_ft, m),
              },
              geometry: { type: 'Point' as const, coordinates: [c.lon, c.lat] },
            }
          }),
        })
      }
    }

    m.on('zoomend', onZoomEnd)
    return () => { m.off('zoomend', onZoomEnd) }
  }, [mapLoaded, spotsWithAircraft])

  // ── Aircraft + Obstacle drag interaction ──
  // Uses refs to avoid re-registering listeners on every data change.
  // Updates GeoJSON sources directly during drag for smooth movement.

  useEffect(() => {
    const m = map.current
    if (!m || !mapLoaded) return

    // Build a tolerance bounding box around a point for easier click targets
    const hitBox = (pt: mapboxgl.Point, tolerance = 8): [mapboxgl.PointLike, mapboxgl.PointLike] => [
      [pt.x - tolerance, pt.y - tolerance],
      [pt.x + tolerance, pt.y + tolerance],
    ]

    const onMouseDown = (e: mapboxgl.MapMouseEvent) => {
      // Don't start drag when plan is locked
      if (planLockedRef.current) return

      const box = hitBox(e.point)

      // Check aircraft layer first
      if (m.getLayer('parking-aircraft-symbols')) {
        const acFeatures = m.queryRenderedFeatures(box, { layers: ['parking-aircraft-symbols'] })
        if (acFeatures.length) {
          const spotId = acFeatures[0].properties?.spotId
          if (spotId) {
            isDraggingRef.current = true
            dragSpotId.current = spotId
            dragObstacleId.current = null
            m.getCanvas().style.cursor = 'grabbing'
            m.dragPan.disable()
            e.preventDefault()
            return
          }
        }
      }

      // Check obstacle layers (points, polygon fills, lines, labels)
      const obsLayers: string[] = []
      if (m.getLayer('parking-obstacles-points')) obsLayers.push('parking-obstacles-points')
      if (m.getLayer('parking-obstacles-fill')) obsLayers.push('parking-obstacles-fill')
      if (m.getLayer('parking-obstacles-lines-stroke')) obsLayers.push('parking-obstacles-lines-stroke')
      if (m.getLayer('parking-obstacles-labels')) obsLayers.push('parking-obstacles-labels')
      if (m.getLayer('parking-obstacles-line')) obsLayers.push('parking-obstacles-line')
      if (obsLayers.length > 0) {
        const obsFeatures = m.queryRenderedFeatures(box, { layers: obsLayers })
        if (obsFeatures.length) {
          const matchId = obsFeatures[0].properties?.obsId
          const matchObs = matchId ? obstaclesRef.current.find(o => o.id === matchId) : null
          if (matchObs) {
            isDraggingRef.current = true
            dragObstacleId.current = matchObs.id
            dragSpotId.current = null
            m.getCanvas().style.cursor = 'grabbing'
            m.dragPan.disable()
            e.preventDefault()
            return
          }
        }
      }
    }

    const buildObstacleGeoJSON = (currentObs: ParkingObstacle[], dragId: string | null, newLng: number, newLat: number): GeoJSON.FeatureCollection => {
      const features: GeoJSON.Feature[] = []
      for (const obs of currentObs) {
        const isDragged = obs.id === dragId
        const lng = isDragged ? newLng : obs.longitude
        const lat = isDragged ? newLat : obs.latitude
        if (obs.obstacle_type === 'point') {
          features.push({ type: 'Feature', properties: { name: obs.name, type: obs.obstacle_type, obsId: obs.id }, geometry: { type: 'Point', coordinates: [lng, lat] } })
        } else if (obs.obstacle_type === 'building') {
          const halfW = (obs.width_ft || 50) / 2
          const halfL = (obs.length_ft || 50) / 2
          const rot = obs.rotation_deg || 0
          const center = { lat, lon: lng }
          const corners = [
            offsetPoint(offsetPoint(center, rot, halfL), (rot + 90) % 360, halfW),
            offsetPoint(offsetPoint(center, rot, halfL), (rot - 90 + 360) % 360, halfW),
            offsetPoint(offsetPoint(center, (rot + 180) % 360, halfL), (rot - 90 + 360) % 360, halfW),
            offsetPoint(offsetPoint(center, (rot + 180) % 360, halfL), (rot + 90) % 360, halfW),
          ]
          features.push({ type: 'Feature', properties: { name: obs.name, type: obs.obstacle_type, obsId: obs.id }, geometry: { type: 'Polygon', coordinates: [corners.map(c => [c.lon, c.lat]).concat([[corners[0].lon, corners[0].lat]])] } })
        } else if (obs.obstacle_type === 'circle') {
          const center = { lat, lon: lng }
          const radius = obs.radius_ft || 50
          const segs = 48
          const coords: [number, number][] = []
          for (let i = 0; i <= segs; i++) {
            const bearing = (360 * i) / segs
            const pt = offsetPoint(center, bearing, radius)
            coords.push([pt.lon, pt.lat])
          }
          features.push({ type: 'Feature', properties: { name: obs.name, type: obs.obstacle_type, obsId: obs.id }, geometry: { type: 'Polygon', coordinates: [coords] } })
        } else if (obs.obstacle_type === 'line' && obs.line_coords) {
          // For line obstacles, offset all line coords by the delta
          if (isDragged) {
            const dLng = newLng - obs.longitude
            const dLat = newLat - obs.latitude
            const movedCoords = obs.line_coords.map(c => [c[0] + dLng, c[1] + dLat] as [number, number])
            features.push({ type: 'Feature', properties: { name: obs.name, type: obs.obstacle_type, obsId: obs.id }, geometry: { type: 'LineString', coordinates: movedCoords } })
          } else {
            features.push({ type: 'Feature', properties: { name: obs.name, type: obs.obstacle_type, obsId: obs.id }, geometry: { type: 'LineString', coordinates: obs.line_coords } })
          }
        }
      }
      return { type: 'FeatureCollection', features }
    }

    const onMouseMove = (e: mapboxgl.MapMouseEvent) => {
      // ── Freeform obstacle drawing ──
      if (drawingObsTypeRef.current && drawingObsStartRef.current) {
        setDrawingObsCurrent([e.lngLat.lng, e.lngLat.lat])
        return
      }

      if (!isDraggingRef.current) return

      const { lng, lat } = e.lngLat

      // ── Aircraft drag ──
      if (dragSpotId.current) {
        const sid = dragSpotId.current
        const src = m.getSource('parking-aircraft') as mapboxgl.GeoJSONSource | undefined
        if (src) {
          const currentSpots = spotsWithAircraftRef.current
          src.setData({
            type: 'FeatureCollection',
            features: currentSpots.map(s => {
              // During drag, lng/lat is the new nose gear block position
              const isBeingDragged = s.id === sid
              const ngsLon = isBeingDragged ? lng : s.longitude
              const ngsLat = isBeingDragged ? lat : s.latitude
              const c = getAircraftCenter(ngsLon, ngsLat, s.heading_deg, s.length_ft, s.pivot_point_ft)
              return {
                type: 'Feature' as const,
                properties: {
                  spotId: s.id,
                  name: s.aircraft_name || 'Aircraft',
                  wingspan: s.wingspan_ft,
                  length: s.length_ft,
                  heading: s.heading_deg,
                  tailNumber: s.tail_number || '',
                  adg: getADGFromWingspan(s.wingspan_ft),
                  iconId: `sil-${s.id}`,
                  iconScale: computeIconScale(s.wingspan_ft, s.length_ft, m),
                },
                geometry: {
                  type: 'Point' as const,
                  coordinates: [c.lon, c.lat],
                },
              }
            }),
          })

          // Also update nose gear markers during drag
          const ngSrc = m.getSource('parking-nose-gear') as mapboxgl.GeoJSONSource | undefined
          if (ngSrc) {
            ngSrc.setData({
              type: 'FeatureCollection',
              features: currentSpots.filter(s => s.pivot_point_ft > 0).map(s => ({
                type: 'Feature' as const,
                properties: { spotId: s.id },
                geometry: { type: 'Point' as const, coordinates: s.id === sid ? [lng, lat] : [s.longitude, s.latitude] },
              })),
            })
          }
        }

        // Show clearance distance labels
        const draggedSpot = spotsWithAircraftRef.current.find(s => s.id === sid)
        if (draggedSpot) {
          const movedSpot = { ...draggedSpot, longitude: lng, latitude: lat }
          const labelFeatures: GeoJSON.Feature[] = []

          for (const other of spotsWithAircraftRef.current) {
            if (other.id === sid) continue
            const dx = (lng - other.longitude) * 364567 * Math.cos(lat * Math.PI / 180)
            const dy = (lat - other.latitude) * 364567
            if (Math.sqrt(dx * dx + dy * dy) > 500) continue
            const result = getAllClearanceResults([movedSpot, other], [], apronContextRef.current)
            if (result.length > 0) {
              const r = result[0]
              labelFeatures.push({ type: 'Feature', properties: { label: `${r.distance_ft.toFixed(0)}/${r.required_ft}ft`, color: r.status === 'violation' ? '#EF4444' : r.status === 'warning' ? '#F59E0B' : '#22C55E' }, geometry: { type: 'Point', coordinates: [(lng + other.longitude) / 2, (lat + other.latitude) / 2] } })
            }
          }

          for (const obs of obstaclesRef.current) {
            const dx = (lng - obs.longitude) * 364567 * Math.cos(lat * Math.PI / 180)
            const dy = (lat - obs.latitude) * 364567
            if (Math.sqrt(dx * dx + dy * dy) > 500) continue
            const result = getAllClearanceResults([movedSpot], [obs], apronContextRef.current)
            if (result.length > 0) {
              const r2 = result[0]
              labelFeatures.push({ type: 'Feature', properties: { label: `${r2.distance_ft.toFixed(0)}/${r2.required_ft}ft`, color: r2.status === 'violation' ? '#EF4444' : r2.status === 'warning' ? '#F59E0B' : '#22C55E' }, geometry: { type: 'Point', coordinates: [(lng + obs.longitude) / 2, (lat + obs.latitude) / 2] } })
            }
          }

          showDragLabels(m, labelFeatures)
        }
      }

      // ── Obstacle drag ──
      if (dragObstacleId.current) {
        const obsSrc = m.getSource('parking-obstacles-src') as mapboxgl.GeoJSONSource | undefined
        if (obsSrc) {
          obsSrc.setData(buildObstacleGeoJSON(obstaclesRef.current, dragObstacleId.current, lng, lat))
        }
      }
    }

    const showDragLabels = (mapInst: mapboxgl.Map, labelFeatures: GeoJSON.Feature[]) => {
      const dragSrc = mapInst.getSource('parking-drag-labels') as mapboxgl.GeoJSONSource | undefined
      const dragData: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: labelFeatures }
      if (dragSrc) {
        dragSrc.setData(dragData)
      } else {
        mapInst.addSource('parking-drag-labels', { type: 'geojson', data: dragData })
        mapInst.addLayer({
          id: 'parking-drag-labels',
          type: 'symbol',
          source: 'parking-drag-labels',
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 13,
            'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
          },
          paint: {
            'text-color': ['get', 'color'],
            'text-halo-color': '#000',
            'text-halo-width': 1.5,
          },
        })
      }
    }

    const removeDragLabels = () => {
      if (m.getLayer('parking-drag-labels')) m.removeLayer('parking-drag-labels')
      if (m.getSource('parking-drag-labels')) m.removeSource('parking-drag-labels')
    }

    const onMouseUp = async (e: mapboxgl.MapMouseEvent) => {
      if (!isDraggingRef.current) return

      const { lng, lat } = e.lngLat

      // ── Aircraft drag end ──
      if (dragSpotId.current) {
        const sid = dragSpotId.current
        isDraggingRef.current = false
        dragSpotId.current = null
        m.dragPan.enable()
        m.getCanvas().style.cursor = ''
        removeDragLabels()
        setSpots(prev => prev.map(s => s.id === sid ? { ...s, longitude: lng, latitude: lat } : s))
        await updateParkingSpot(sid, { longitude: lng, latitude: lat })
        return
      }

      // ── Obstacle drag end ──
      if (dragObstacleId.current) {
        const oid = dragObstacleId.current
        isDraggingRef.current = false
        dragObstacleId.current = null
        m.dragPan.enable()
        m.getCanvas().style.cursor = ''
        removeDragLabels()

        const obs = obstaclesRef.current.find(o => o.id === oid)
        if (obs) {
          const updates: Partial<ParkingObstacle> = { longitude: lng, latitude: lat }
          // For line obstacles, also shift line_coords
          if (obs.obstacle_type === 'line' && obs.line_coords) {
            const dLng = lng - obs.longitude
            const dLat = lat - obs.latitude
            updates.line_coords = obs.line_coords.map(c => [c[0] + dLng, c[1] + dLat] as [number, number])
          }
          setObstacles(prev => prev.map(o => o.id === oid ? { ...o, ...updates } : o))
          await updateParkingObstacle(oid, updates)
        }
        return
      }
    }

    // Bind mousedown on canvas (not specific layer) so we can check multiple layers
    const canvas = m.getCanvas()
    const onCanvasMouseDown = (ev: MouseEvent) => {
      const point = new mapboxgl.Point(ev.offsetX, ev.offsetY)
      const lngLat = m.unproject(point)
      onMouseDown({ point, lngLat, originalEvent: ev, preventDefault: () => ev.preventDefault() } as any)
    }
    canvas.addEventListener('mousedown', onCanvasMouseDown)
    m.on('mousemove', onMouseMove as any)
    m.on('mouseup', onMouseUp as any)

    // Hover cursor for both aircraft and obstacles
    const onAcEnter = () => { if (!isDraggingRef.current && !planLockedRef.current) m.getCanvas().style.cursor = 'grab' }
    const onAcLeave = () => { if (!isDraggingRef.current) m.getCanvas().style.cursor = '' }
    const onObsEnter = () => { if (!isDraggingRef.current && !planLockedRef.current) m.getCanvas().style.cursor = 'grab' }
    const onObsLeave = () => { if (!isDraggingRef.current) m.getCanvas().style.cursor = '' }
    m.on('mouseenter', 'parking-aircraft-symbols', onAcEnter)
    m.on('mouseleave', 'parking-aircraft-symbols', onAcLeave)
    m.on('mouseenter', 'parking-obstacles-points', onObsEnter)
    m.on('mouseleave', 'parking-obstacles-points', onObsLeave)
    m.on('mouseenter', 'parking-obstacles-fill', onObsEnter)
    m.on('mouseleave', 'parking-obstacles-fill', onObsLeave)
    m.on('mouseenter', 'parking-obstacles-labels', onObsEnter)
    m.on('mouseleave', 'parking-obstacles-labels', onObsLeave)
    m.on('mouseenter', 'parking-obstacles-lines-stroke', onObsEnter)
    m.on('mouseleave', 'parking-obstacles-lines-stroke', onObsLeave)

    return () => {
      canvas.removeEventListener('mousedown', onCanvasMouseDown)
      m.off('mousemove', onMouseMove as any)
      m.off('mouseup', onMouseUp as any)
      m.off('mouseenter', 'parking-aircraft-symbols', onAcEnter)
      m.off('mouseleave', 'parking-aircraft-symbols', onAcLeave)
      m.off('mouseenter', 'parking-obstacles-points', onObsEnter)
      m.off('mouseleave', 'parking-obstacles-points', onObsLeave)
      m.off('mouseenter', 'parking-obstacles-fill', onObsEnter)
      m.off('mouseleave', 'parking-obstacles-fill', onObsLeave)
      m.off('mouseenter', 'parking-obstacles-labels', onObsEnter)
      m.off('mouseleave', 'parking-obstacles-labels', onObsLeave)
      m.off('mouseenter', 'parking-obstacles-lines-stroke', onObsEnter)
      m.off('mouseleave', 'parking-obstacles-lines-stroke', onObsLeave)
    }
  }, [mapLoaded]) // Only re-register on map load — refs handle current data

  // ── Plan actions ──

  const handleCreatePlan = async () => {
    if (!installationId || !newPlanName.trim()) return
    const plan = await createParkingPlan({
      base_id: installationId,
      plan_name: newPlanName.trim(),
      description: newPlanDesc.trim() || undefined,
    })
    if (plan) {
      setPlans(prev => [plan, ...prev])
      setSelectedPlanId(plan.id)
      setShowNewPlan(false)
      setNewPlanName('')
      setNewPlanDesc('')
      toast.success('Plan created')
    }
  }

  const handleDeletePlan = async () => {
    if (!selectedPlan) return
    if (!confirm(`Delete plan "${selectedPlan.plan_name}"? All aircraft in this plan will be removed.`)) return
    const ok = await deleteParkingPlan(selectedPlan.id, selectedPlan.plan_name, installationId || undefined)
    if (ok) {
      setPlans(prev => prev.filter(p => p.id !== selectedPlan.id))
      setSelectedPlanId(plans.find(p => p.id !== selectedPlan.id)?.id || null)
      setSpots([])
      toast.success('Plan deleted')
    }
  }

  const handleSetActive = async () => {
    if (!selectedPlan || !installationId) return
    await setActivePlan(selectedPlan.id, installationId)
    setPlans(prev => prev.map(p => ({ ...p, is_active: p.id === selectedPlan.id })))
    toast.success(`"${selectedPlan.plan_name}" set as active plan`)
  }

  // ── Spot actions ──

  const handleDeleteSpot = async (spotId: string) => {
    const ok = await deleteParkingSpot(spotId)
    if (ok) {
      setSpots(prev => prev.filter(s => s.id !== spotId))
      if (editingSpot?.id === spotId) setEditingSpot(null)
      toast.success('Aircraft removed')
    }
  }

  const handleUpdateSpot = async (spotId: string, updates: Partial<ParkingSpot>) => {
    const updated = await updateParkingSpot(spotId, updates)
    if (updated) {
      setSpots(prev => prev.map(s => s.id === spotId ? updated : s))
      if (editingSpot?.id === spotId) setEditingSpot(updated)
    }
  }

  // ── Obstacle actions ──

  const handleDeleteObstacle = async (obsId: string) => {
    const ok = await deleteParkingObstacle(obsId)
    if (ok) {
      setObstacles(prev => prev.filter(o => o.id !== obsId))
      if (editingObstacle?.id === obsId) setEditingObstacle(null)
      toast.success('Obstacle removed')
    }
  }

  const handleUpdateObstacle = async (obsId: string, updates: Partial<ParkingObstacle>) => {
    const updated = await updateParkingObstacle(obsId, updates)
    if (updated) {
      setObstacles(prev => prev.map(o => o.id === obsId ? updated : o))
      if (editingObstacle?.id === obsId) setEditingObstacle(updated)
    }
  }

  // ── Taxilane actions ──

  const handleStartTaxilane = (type: 'interior' | 'peripheral') => {
    setDrawingTaxilaneType(type)
    setPlacingAircraft(null)
    setPlacingObstacle(null)
    toast.success('Click on the map to draw taxilane centerline. Double-click or press Finish to complete.')
    // We'll create the DB record when finishing
    setDrawingTaxilaneId('pending')
    setDrawingTaxilanePoints([])
  }

  const handleFinishTaxilane = useCallback(async () => {
    if (drawingTaxilanePoints.length < 2) {
      toast.error('A taxilane needs at least 2 points')
      return
    }
    if (!selectedPlanId || !installationId) return

    const tl = await createParkingTaxilane({
      base_id: installationId,
      plan_id: selectedPlanId,
      name: `${drawingTaxilaneType === 'peripheral' ? 'Peripheral' : 'Interior'} Taxilane ${taxilanes.length + 1}`,
      taxilane_type: drawingTaxilaneType,
      line_coords: drawingTaxilanePoints,
    })
    if (tl) {
      setTaxilanes(prev => [...prev, tl])
      toast.success('Taxilane created')
      setEditingTaxilane(tl)
      setOpenSections(prev => ({ ...prev, taxilanes: true }))
    }
    setDrawingTaxilaneId(null)
    setDrawingTaxilanePoints([])
  }, [drawingTaxilanePoints, drawingTaxilaneType, selectedPlanId, installationId, taxilanes.length])

  const handleDeleteTaxilane = async (id: string) => {
    const ok = await deleteParkingTaxilane(id)
    if (ok) {
      setTaxilanes(prev => prev.filter(t => t.id !== id))
      if (editingTaxilane?.id === id) setEditingTaxilane(null)
      toast.success('Taxilane removed')
    }
  }

  const handleUpdateTaxilane = async (id: string, updates: Partial<ParkingTaxilane>) => {
    const updated = await updateParkingTaxilane(id, updates)
    if (updated) {
      setTaxilanes(prev => prev.map(t => t.id === id ? updated : t))
      if (editingTaxilane?.id === id) setEditingTaxilane(updated)
    }
  }

  // ── Apron boundary actions ──

  const handleStartBoundary = () => {
    setPlacingAircraft(null)
    setPlacingObstacle(null)
    toast.success('Click on the map to draw apron boundary. Double-click or press Finish to complete.')
    setDrawingBoundaryId('pending')
    setDrawingBoundaryPoints([])
  }

  const handleFinishBoundary = useCallback(async () => {
    if (drawingBoundaryPoints.length < 3) {
      toast.error('A boundary needs at least 3 points')
      return
    }
    if (!selectedPlanId || !installationId) return

    const ab = await createApronBoundary({
      base_id: installationId,
      plan_id: selectedPlanId,
      name: `Apron Boundary ${apronBoundaries.length + 1}`,
      polygon_coords: drawingBoundaryPoints,
    })
    if (ab) {
      setApronBoundaries(prev => [...prev, ab])
      toast.success('Apron boundary created')
      setEditingBoundary(ab)
    }
    setDrawingBoundaryId(null)
    setDrawingBoundaryPoints([])
  }, [drawingBoundaryPoints, selectedPlanId, installationId, apronBoundaries.length])

  const handleDeleteBoundary = async (id: string) => {
    const ok = await deleteApronBoundary(id)
    if (ok) {
      setApronBoundaries(prev => prev.filter(b => b.id !== id))
      if (editingBoundary?.id === id) setEditingBoundary(null)
      toast.success('Boundary removed')
    }
  }

  const handleUpdateBoundary = async (id: string, updates: Partial<ParkingApronBoundary>) => {
    const updated = await updateApronBoundary(id, updates)
    if (updated) {
      setApronBoundaries(prev => prev.map(b => b.id === id ? updated : b))
      if (editingBoundary?.id === id) setEditingBoundary(updated)
    }
  }

  // ── Finish line drawing ──

  const handleFinishLine = useCallback(async () => {
    if (!drawingLineObsId || drawingLinePoints.length < 2) {
      toast.error('A line needs at least 2 points')
      return
    }
    const updated = await updateParkingObstacle(drawingLineObsId, { line_coords: drawingLinePoints })
    if (updated) {
      setObstacles(prev => prev.map(o => o.id === drawingLineObsId ? updated : o))
      toast.success('Line obstacle saved')
    }
    setDrawingLineObsId(null)
    setDrawingLinePoints([])
  }, [drawingLineObsId, drawingLinePoints])

  // ── Render drawing line preview on map ──

  useEffect(() => {
    const m = map.current
    if (!m || !mapLoaded) return

    const srcId = 'parking-drawing-line'
    const layerId = 'parking-drawing-line-layer'
    const dotsId = 'parking-drawing-line-dots'

    if (drawingLinePoints.length >= 1) {
      const data: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          ...(drawingLinePoints.length >= 2 ? [{
            type: 'Feature' as const,
            properties: {},
            geometry: { type: 'LineString' as const, coordinates: drawingLinePoints },
          }] : []),
          ...drawingLinePoints.map(pt => ({
            type: 'Feature' as const,
            properties: {},
            geometry: { type: 'Point' as const, coordinates: pt },
          })),
        ],
      }

      const src = m.getSource(srcId) as mapboxgl.GeoJSONSource | undefined
      if (src) {
        src.setData(data)
      } else {
        m.addSource(srcId, { type: 'geojson', data })
        m.addLayer({
          id: layerId, type: 'line', source: srcId,
          paint: { 'line-color': '#F97316', 'line-width': 3, 'line-dasharray': [4, 3] },
        })
        m.addLayer({
          id: dotsId, type: 'circle', source: srcId,
          filter: ['==', '$type', 'Point'],
          paint: { 'circle-radius': 5, 'circle-color': '#F97316', 'circle-stroke-color': '#FFF', 'circle-stroke-width': 1.5 },
        })
      }
    } else {
      if (m.getLayer(layerId)) m.removeLayer(layerId)
      if (m.getLayer(dotsId)) m.removeLayer(dotsId)
      if (m.getSource(srcId)) m.removeSource(srcId)
    }
  }, [mapLoaded, drawingLinePoints])

  // ── Render taxilane/boundary drawing preview on map ──

  useEffect(() => {
    const m = map.current
    if (!m || !mapLoaded) return

    const tlSrcId = 'parking-drawing-taxilane'
    const tlLineId = 'parking-drawing-taxilane-line'
    const tlDotsId = 'parking-drawing-taxilane-dots'
    const bdSrcId = 'parking-drawing-boundary'
    const bdFillId = 'parking-drawing-boundary-fill'
    const bdLineId = 'parking-drawing-boundary-line'
    const bdDotsId = 'parking-drawing-boundary-dots'

    // Taxilane drawing preview
    if (drawingTaxilanePoints.length >= 1) {
      const data: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          ...(drawingTaxilanePoints.length >= 2 ? [{
            type: 'Feature' as const, properties: {},
            geometry: { type: 'LineString' as const, coordinates: drawingTaxilanePoints },
          }] : []),
          ...drawingTaxilanePoints.map(pt => ({
            type: 'Feature' as const, properties: {},
            geometry: { type: 'Point' as const, coordinates: pt },
          })),
        ],
      }
      const src = m.getSource(tlSrcId) as mapboxgl.GeoJSONSource | undefined
      if (src) {
        src.setData(data)
      } else {
        m.addSource(tlSrcId, { type: 'geojson', data })
        m.addLayer({ id: tlLineId, type: 'line', source: tlSrcId, paint: { 'line-color': drawingTaxilaneType === 'peripheral' ? '#8B5CF6' : '#3B82F6', 'line-width': 3, 'line-dasharray': [6, 3] } })
        m.addLayer({ id: tlDotsId, type: 'circle', source: tlSrcId, filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 5, 'circle-color': drawingTaxilaneType === 'peripheral' ? '#8B5CF6' : '#3B82F6', 'circle-stroke-color': '#FFF', 'circle-stroke-width': 1.5 } })
      }
    } else {
      if (m.getLayer(tlLineId)) m.removeLayer(tlLineId)
      if (m.getLayer(tlDotsId)) m.removeLayer(tlDotsId)
      if (m.getSource(tlSrcId)) m.removeSource(tlSrcId)
    }

    // Boundary drawing preview
    if (drawingBoundaryPoints.length >= 1) {
      const coords = drawingBoundaryPoints.length >= 3
        ? [...drawingBoundaryPoints, drawingBoundaryPoints[0]]
        : drawingBoundaryPoints
      const data: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          ...(drawingBoundaryPoints.length >= 3 ? [{
            type: 'Feature' as const, properties: {},
            geometry: { type: 'Polygon' as const, coordinates: [coords] },
          }] : drawingBoundaryPoints.length >= 2 ? [{
            type: 'Feature' as const, properties: {},
            geometry: { type: 'LineString' as const, coordinates: drawingBoundaryPoints },
          }] : []),
          ...drawingBoundaryPoints.map(pt => ({
            type: 'Feature' as const, properties: {},
            geometry: { type: 'Point' as const, coordinates: pt },
          })),
        ],
      }
      const src = m.getSource(bdSrcId) as mapboxgl.GeoJSONSource | undefined
      if (src) {
        src.setData(data)
      } else {
        m.addSource(bdSrcId, { type: 'geojson', data })
        m.addLayer({ id: bdFillId, type: 'fill', source: bdSrcId, filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#10B981', 'fill-opacity': 0.15 } })
        m.addLayer({ id: bdLineId, type: 'line', source: bdSrcId, paint: { 'line-color': '#10B981', 'line-width': 2, 'line-dasharray': [4, 2] } })
        m.addLayer({ id: bdDotsId, type: 'circle', source: bdSrcId, filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#10B981', 'circle-stroke-color': '#FFF', 'circle-stroke-width': 1.5 } })
      }
    } else {
      if (m.getLayer(bdFillId)) m.removeLayer(bdFillId)
      if (m.getLayer(bdLineId)) m.removeLayer(bdLineId)
      if (m.getLayer(bdDotsId)) m.removeLayer(bdDotsId)
      if (m.getSource(bdSrcId)) m.removeSource(bdSrcId)
    }
  }, [mapLoaded, drawingTaxilanePoints, drawingTaxilaneType, drawingBoundaryPoints])

  // ── Render freeform obstacle drawing preview ──

  useEffect(() => {
    const m = map.current
    if (!m || !mapLoaded) return

    const srcId = 'parking-drawing-obs'
    const fillId = 'parking-drawing-obs-fill'
    const lineId = 'parking-drawing-obs-line'

    if (drawingObsType && drawingObsStart && drawingObsCurrent) {
      const [startLng, startLat] = drawingObsStart
      const [curLng, curLat] = drawingObsCurrent
      let features: GeoJSON.Feature[] = []

      if (drawingObsType === 'circle') {
        // Preview circle from center to cursor
        const dEast = (curLng - startLng) * 111319.9 * Math.cos(startLat * Math.PI / 180) * 3.28084
        const dNorth = (curLat - startLat) * 111319.9 * 3.28084
        const radiusFt = Math.sqrt(dEast * dEast + dNorth * dNorth)
        if (radiusFt > 1) {
          const center = { lat: startLat, lon: startLng }
          const segs = 48
          const coords: [number, number][] = []
          for (let i = 0; i <= segs; i++) {
            const bearing = (360 * i) / segs
            const pt = offsetPoint(center, bearing, radiusFt)
            coords.push([pt.lon, pt.lat])
          }
          features.push({
            type: 'Feature', properties: { label: `${Math.round(radiusFt)}ft` },
            geometry: { type: 'Polygon', coordinates: [coords] },
          })
        }
      } else if (drawingObsType === 'building') {
        // Preview rectangle from corner to corner
        features.push({
          type: 'Feature', properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [startLng, startLat],
              [curLng, startLat],
              [curLng, curLat],
              [startLng, curLat],
              [startLng, startLat],
            ]],
          },
        })
      }

      const data: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features }
      const src = m.getSource(srcId) as mapboxgl.GeoJSONSource | undefined
      if (src) {
        src.setData(data)
      } else {
        m.addSource(srcId, { type: 'geojson', data })
        m.addLayer({ id: fillId, type: 'fill', source: srcId, paint: { 'fill-color': '#F97316', 'fill-opacity': 0.3 } })
        m.addLayer({ id: lineId, type: 'line', source: srcId, paint: { 'line-color': '#F97316', 'line-width': 2, 'line-dasharray': [4, 3] } })
      }
    } else {
      if (m.getLayer(fillId)) m.removeLayer(fillId)
      if (m.getLayer(lineId)) m.removeLayer(lineId)
      if (m.getSource(srcId)) m.removeSource(srcId)
    }
  }, [mapLoaded, drawingObsType, drawingObsStart, drawingObsCurrent])

  // ── Fly to clearance result ──

  const flyToResult = (result: ClearanceResult) => {
    const spotA = spotsWithAircraft.find(s => s.id === result.spot_a_id)
    if (!spotA || !map.current) return

    if (result.spot_b_id) {
      const spotB = spotsWithAircraft.find(s => s.id === result.spot_b_id)
      if (spotB) {
        const lat = (spotA.latitude + spotB.latitude) / 2
        const lng = (spotA.longitude + spotB.longitude) / 2
        map.current.flyTo({ center: [lng, lat], zoom: 17 })
      }
    } else if (result.obstacle_id) {
      const obs = obstacles.find(o => o.id === result.obstacle_id)
      if (obs) {
        const lat = (spotA.latitude + obs.latitude) / 2
        const lng = (spotA.longitude + obs.longitude) / 2
        map.current.flyTo({ center: [lng, lat], zoom: 17 })
      }
    }
  }

  // ── Aircraft picker filtering ──

  const filteredAircraft = useMemo(() => {
    let list = allAircraft
    if (aircraftCategoryFilter !== 'all') {
      list = list.filter(a => a.category === aircraftCategoryFilter)
    }
    if (!aircraftSearch.trim()) return list.slice(0, 50)
    const q = aircraftSearch.toLowerCase()
    return list.filter(a =>
      a.aircraft.toLowerCase().includes(q) ||
      (a.manufacturer && a.manufacturer.toLowerCase().includes(q)) ||
      (a.category && a.category.toLowerCase().includes(q))
    ).slice(0, 50)
  }, [aircraftSearch, aircraftCategoryFilter])

  // ── Render ──

  if (!isMapboxConfigured()) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        <h2 style={{ color: 'var(--color-text-primary)', marginBottom: 8 }}>Aircraft Parking</h2>
        <p>Mapbox token not configured. Add NEXT_PUBLIC_MAPBOX_TOKEN to your environment.</p>
      </div>
    )
  }

  // Collapsible section header helper
  const SectionHeader = ({ id, label, count, color, badge, layerKey }: { id: string; label: string; count?: number; color?: string; badge?: string; layerKey?: string }) => (
    <div style={{
      display: 'flex', alignItems: 'center', width: '100%',
      background: openSections[id] ? 'var(--color-bg)' : 'transparent',
      borderBottom: '1px solid var(--color-border)',
    }}>
      <button
        onClick={() => toggleSection(id)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, flex: 1,
          padding: '7px 10px', border: 'none', cursor: 'pointer',
          background: 'transparent',
          color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)', fontWeight: 600,
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{openSections[id] ? '\u25BC' : '\u25B6'}</span>
        {label}
        {count != null && count > 0 && (
          <span style={{ fontSize: 10, padding: '0 5px', borderRadius: 8, background: `${color || 'var(--color-cyan)'}22`, color: color || 'var(--color-cyan)' }}>
            {count}
          </span>
        )}
        {badge && (
          <span style={{ fontSize: 10, padding: '0 5px', borderRadius: 8, marginLeft: 'auto', background: `${color || '#EF4444'}22`, color: color || '#EF4444', fontWeight: 700 }}>
            {badge}
          </span>
        )}
      </button>
      {layerKey && (
        <button
          onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layerKey) }}
          title={visibleLayers[layerKey] ? 'Hide on map' : 'Show on map'}
          style={{
            padding: '4px 8px', border: 'none', cursor: 'pointer', background: 'transparent',
            fontSize: 14, lineHeight: 1, color: visibleLayers[layerKey] ? 'var(--color-cyan)' : 'var(--color-text-secondary)',
            opacity: visibleLayers[layerKey] ? 1 : 0.4,
          }}
        >
          {visibleLayers[layerKey] ? '\u25C9' : '\u25CB'}
        </button>
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--color-bg)' }}>
      {/* ── Left Sidebar ── */}
      <div style={{
        width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column',
        borderRight: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
        overflow: 'hidden',
      }}>
        {/* Sidebar header — plan selector */}
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <h1 style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, margin: 0, color: 'var(--color-text-primary)', flex: 1 }}>
              Aircraft Parking
            </h1>
            {selectedPlan && (
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 3,
                background: selectedPlan.is_active ? '#22C55E22' : 'var(--color-bg)',
                color: selectedPlan.is_active ? '#22C55E' : 'var(--color-text-secondary)',
                border: `1px solid ${selectedPlan.is_active ? '#22C55E44' : 'var(--color-border)'}`,
              }}>
                {selectedPlan.is_active ? 'Active' : 'Draft'}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <select
              value={selectedPlanId || ''}
              onChange={e => setSelectedPlanId(e.target.value || null)}
              style={{
                flex: 1, padding: '4px 6px', borderRadius: 4, fontSize: 'var(--fs-xs)',
                background: 'var(--color-bg)', color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)', cursor: 'pointer',
              }}
            >
              <option value="">No Plan Selected</option>
              {plans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.plan_name}{p.is_active ? ' (Active)' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowNewPlan(true)}
              style={{
                padding: '4px 8px', borderRadius: 4, fontSize: 'var(--fs-xs)',
                background: 'var(--color-cyan)', color: '#000', border: 'none',
                cursor: 'pointer', fontWeight: 600,
              }}
            >
              +
            </button>
          </div>
          {selectedPlan && (
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {!selectedPlan.is_active && (
                <button onClick={handleSetActive} style={{ flex: 1, padding: '3px 6px', borderRadius: 3, background: '#22C55E22', border: '1px solid #22C55E44', color: '#22C55E', cursor: 'pointer', fontSize: 10 }}>Set Active</button>
              )}
              <button onClick={handleDeletePlan} style={{ padding: '3px 6px', borderRadius: 3, background: '#EF444422', border: '1px solid #EF444444', color: '#EF4444', cursor: 'pointer', fontSize: 10 }}>Delete</button>
            </div>
          )}
        </div>

        {/* Status summary */}
        <div style={{ display: 'flex', gap: 8, padding: '5px 10px', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--fs-xs)', flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>{spots.length} AC</span>
          {taxilanes.length > 0 && <span style={{ color: '#3B82F6' }}>{taxilanes.length} TL</span>}
          <span style={{ color: violations.length > 0 ? '#EF4444' : 'var(--color-text-secondary)' }}>{violations.length} Viol</span>
          <span style={{ color: warnings.length > 0 ? '#F59E0B' : 'var(--color-text-secondary)' }}>{warnings.length} Warn</span>
        </div>

        {/* Scrollable section content */}
        <div style={{ flex: 1, overflow: 'auto' }}>

          {/* ── Aircraft Section ── */}
          <SectionHeader id="aircraft" label="Aircraft" count={spots.length} color="var(--color-cyan)" layerKey="aircraft" />
          {openSections.aircraft && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {selectedPlanId && (
                <button
                  onClick={() => setShowAircraftPicker(true)}
                  style={{
                    padding: '5px 12px', borderRadius: 4, marginBottom: 4, alignSelf: 'flex-start',
                    background: 'var(--color-cyan)11', border: '1px dashed var(--color-cyan)',
                    color: 'var(--color-cyan)', cursor: 'pointer', fontSize: 'var(--fs-xs)',
                  }}
                >
                  + Add Aircraft
                </button>
              )}

              {spots.length === 0 && !selectedPlanId && (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-sm)', padding: '4px 0', margin: 0 }}>
                  Select or create a plan to add aircraft
                </p>
              )}
              {spots.length === 0 && selectedPlanId && (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-xs)', padding: '4px 0', margin: 0 }}>
                  No aircraft placed yet.
                </p>
              )}

              {spots.map(s => {
                const ac = allAircraft.find(a => a.aircraft === s.aircraft_name)
                const ws = ac ? parseNum(ac.wing_span_ft) : 50
                const adg = getADGFromWingspan(ws)
                const clearanceDetail = s.clearance_ft != null
                  ? { clearance_ft: s.clearance_ft, ufc_item: 'Manual', description: 'Override' }
                  : getWingtipClearanceDetail(ws, apronContext, s.aircraft_name)
                const clearance = clearanceDetail.clearance_ft
                const spotViolations = allResults.filter(r =>
                  (r.spot_a_id === s.id || r.spot_b_id === s.id) && r.status !== 'ok'
                )
                const isEditing = editingSpot?.id === s.id

                return (
                  <div key={s.id}>
                    {/* Compact row */}
                    <div
                      onClick={() => setEditingSpot(isEditing ? null : s)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 8px', cursor: 'pointer',
                        background: isEditing ? 'var(--color-bg)' : 'transparent',
                        borderBottom: '1px solid var(--color-border)',
                        borderLeft: spotViolations.length > 0 ? '3px solid #EF4444' : '3px solid transparent',
                      }}
                    >
                      <span style={{
                        fontSize: 10, padding: '1px 4px', borderRadius: 3,
                        background: `${ADG_COLORS[adg]}22`, color: ADG_COLORS[adg],
                        fontWeight: 600, flexShrink: 0,
                      }}>
                        {adg}
                      </span>
                      <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.aircraft_name || 'Unknown'}
                      </span>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                        {s.tail_number || ''}
                      </span>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
                        {clearance}ft {clearanceDetail.ufc_item} &middot; {s.heading_deg}°
                      </span>
                      {spotViolations.length > 0 && (
                        <span style={{ color: '#EF4444', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>!</span>
                      )}
                      <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', flexShrink: 0 }}>{isEditing ? '\u25B2' : '\u25BC'}</span>
                    </div>

                    {/* Expanded edit form below the row */}
                    {isEditing && (
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{ padding: '8px 8px 8px 16px', display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}
                      >
                        <div style={{ display: 'flex', gap: 6 }}>
                          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', flex: 1 }}>
                            Spot Name
                            <input value={s.spot_name || ''} onChange={e => handleUpdateSpot(s.id, { spot_name: e.target.value })} style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }} />
                          </label>
                          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', flex: 1 }}>
                            Tail Number
                            <input value={s.tail_number || ''} onChange={e => handleUpdateSpot(s.id, { tail_number: e.target.value })} style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }} />
                          </label>
                          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', flex: 1 }}>
                            Callsign
                            <input value={s.unit_callsign || ''} onChange={e => handleUpdateSpot(s.id, { unit_callsign: e.target.value })} style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }} />
                          </label>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', flex: 1 }}>
                            Heading
                            <input type="range" min={0} max={360} step={1} value={s.heading_deg} onChange={e => handleUpdateSpot(s.id, { heading_deg: Number(e.target.value) })} style={{ width: '100%' }} />
                          </label>
                          <input
                            type="number" min={0} max={360} step={1} value={s.heading_deg}
                            onChange={e => { const v = Math.min(360, Math.max(0, Number(e.target.value) || 0)); handleUpdateSpot(s.id, { heading_deg: v }) }}
                            style={{ width: 52, padding: '3px 4px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)', textAlign: 'center' }}
                          />
                          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>°</span>
                        </div>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', flexShrink: 0 }}>Clearance:</span>
                          {[null, 10, 15, 25].map(val => (
                            <button
                              key={val ?? 'adg'}
                              onClick={() => handleUpdateSpot(s.id, { clearance_ft: val as any })}
                              style={{
                                padding: '2px 6px', borderRadius: 3, fontSize: 'var(--fs-xs)',
                                border: '1px solid var(--color-border)',
                                background: s.clearance_ft === val ? 'var(--color-cyan)22' : 'var(--color-bg-surface)',
                                color: s.clearance_ft === val ? 'var(--color-cyan)' : 'var(--color-text-secondary)',
                                cursor: 'pointer',
                              }}
                            >
                              {val ? `${val}ft` : `UFC (${getWingtipClearance(ws, apronContext, s.aircraft_name)}ft)`}
                            </button>
                          ))}
                          <select
                            value={s.status}
                            onChange={e => handleUpdateSpot(s.id, { status: e.target.value as ParkingSpot['status'] })}
                            style={{ marginLeft: 'auto', padding: '2px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }}
                          >
                            <option value="available">Available</option>
                            <option value="occupied">Occupied</option>
                            <option value="reserved">Reserved</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => map.current?.flyTo({ center: [s.longitude, s.latitude], zoom: 17 })} style={{ padding: '4px 8px', borderRadius: 3, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}>Fly To</button>
                          <button onClick={() => handleDeleteSpot(s.id)} style={{ padding: '4px 8px', borderRadius: 3, background: '#EF444422', border: '1px solid #EF444444', color: '#EF4444', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}>Remove</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Obstacles Section ── */}
          <SectionHeader id="obstacles" label="Obstacles" count={obstacles.length} color="#F97316" layerKey="obstacles" />
          {openSections.obstacles && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                {(['point', 'building', 'line', 'circle'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => { setPlacingObstacle(type); setPlacingAircraft(null) }}
                    style={{
                      padding: '4px 10px', borderRadius: 4, fontSize: 'var(--fs-xs)',
                      background: placingObstacle === type ? '#F5730622' : 'var(--color-bg)',
                      border: `1px solid ${placingObstacle === type ? '#F97316' : 'var(--color-border)'}`,
                      color: placingObstacle === type ? '#F97316' : 'var(--color-text-secondary)',
                      cursor: 'pointer', textTransform: 'capitalize',
                    }}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {obstacles.length === 0 && (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-xs)', padding: '4px 0', margin: 0 }}>
                  No obstacles defined.
                </p>
              )}

              {obstacles.map(obs => {
                const isEditing = editingObstacle?.id === obs.id
                return (
                  <div key={obs.id}>
                    <div
                      onClick={() => setEditingObstacle(isEditing ? null : obs)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 8px', cursor: 'pointer',
                        background: isEditing ? 'var(--color-bg)' : 'transparent',
                        borderBottom: '1px solid var(--color-border)',
                        borderLeft: '3px solid #F97316',
                      }}
                    >
                      <span style={{
                        fontSize: 10, padding: '1px 4px', borderRadius: 3,
                        background: '#F9731622', color: '#F97316',
                        textTransform: 'capitalize', flexShrink: 0,
                      }}>
                        {obs.obstacle_type}
                      </span>
                      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-primary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {obs.name || 'Unnamed'}
                      </span>
                      {obs.obstacle_type === 'building' && (
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                          {obs.width_ft || 0}x{obs.length_ft || 0}ft
                        </span>
                      )}
                      {obs.obstacle_type === 'circle' && (
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                          r={obs.radius_ft || 0}ft
                        </span>
                      )}
                      <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', flexShrink: 0 }}>{isEditing ? '\u25B2' : '\u25BC'}</span>
                    </div>

                    {isEditing && (
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{ padding: '8px 8px 8px 16px', display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}
                      >
                        <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                          Name
                          <input value={obs.name || ''} onChange={e => handleUpdateObstacle(obs.id, { name: e.target.value })} style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }} />
                        </label>
                        {obs.obstacle_type === 'building' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', flex: 1 }}>
                              Width (ft)
                              <input type="number" value={obs.width_ft || 0} onChange={e => handleUpdateObstacle(obs.id, { width_ft: Number(e.target.value) })} style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }} />
                            </label>
                            <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', flex: 1 }}>
                              Length (ft)
                              <input type="number" value={obs.length_ft || 0} onChange={e => handleUpdateObstacle(obs.id, { length_ft: Number(e.target.value) })} style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }} />
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                              <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', flex: 1 }}>
                                Rotation
                                <input type="range" min={0} max={360} step={1} value={obs.rotation_deg || 0} onChange={e => handleUpdateObstacle(obs.id, { rotation_deg: Number(e.target.value) })} style={{ width: '100%' }} />
                              </label>
                              <input type="number" min={0} max={360} step={1} value={obs.rotation_deg || 0} onChange={e => { const v = Math.min(360, Math.max(0, Number(e.target.value) || 0)); handleUpdateObstacle(obs.id, { rotation_deg: v }) }} style={{ width: 52, padding: '3px 4px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)', textAlign: 'center' }} />
                              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>°</span>
                            </div>
                          </div>
                        )}
                        {obs.obstacle_type === 'circle' && (
                          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                            Radius (ft)
                            <input type="number" value={obs.radius_ft || 0} onChange={e => handleUpdateObstacle(obs.id, { radius_ft: Number(e.target.value) })} style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }} />
                          </label>
                        )}
                        {obs.obstacle_type === 'point' && (
                          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                            Height (ft)
                            <input type="number" value={obs.height_ft || 0} onChange={e => handleUpdateObstacle(obs.id, { height_ft: Number(e.target.value) })} style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }} />
                          </label>
                        )}
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => map.current?.flyTo({ center: [obs.longitude, obs.latitude], zoom: 17 })} style={{ padding: '4px 8px', borderRadius: 3, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}>Fly To</button>
                          <button onClick={() => handleDeleteObstacle(obs.id)} style={{ padding: '4px 8px', borderRadius: 3, background: '#EF444422', border: '1px solid #EF444444', color: '#EF4444', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}>Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Taxilanes Section ── */}
          <SectionHeader id="taxilanes" label="Taxilanes" count={taxilanes.length} color="#3B82F6" layerKey="taxilanes" badge={allResults.filter(r => r.spot_b_id && taxilanes.some(t => t.id === r.spot_b_id) && r.status !== 'ok').length > 0 ? `${allResults.filter(r => r.spot_b_id && taxilanes.some(t => t.id === r.spot_b_id) && r.status !== 'ok').length}!` : undefined} />
          {openSections.taxilanes && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleStartTaxilane('interior')}
                  disabled={!selectedPlanId || !!drawingTaxilaneId}
                  style={{
                    padding: '4px 10px', borderRadius: 4, fontSize: 'var(--fs-xs)',
                    background: '#3B82F611', border: '1px dashed #3B82F6',
                    color: '#3B82F6', cursor: selectedPlanId ? 'pointer' : 'not-allowed',
                    opacity: selectedPlanId ? 1 : 0.5,
                  }}
                >
                  + Interior Taxilane
                </button>
                <button
                  onClick={() => handleStartTaxilane('peripheral')}
                  disabled={!selectedPlanId || !!drawingTaxilaneId}
                  style={{
                    padding: '4px 10px', borderRadius: 4, fontSize: 'var(--fs-xs)',
                    background: '#8B5CF611', border: '1px dashed #8B5CF6',
                    color: '#8B5CF6', cursor: selectedPlanId ? 'pointer' : 'not-allowed',
                    opacity: selectedPlanId ? 1 : 0.5,
                  }}
                >
                  + Peripheral Taxilane
                </button>
                <button
                  onClick={handleStartBoundary}
                  disabled={!selectedPlanId || !!drawingBoundaryId}
                  style={{
                    padding: '4px 10px', borderRadius: 4, fontSize: 'var(--fs-xs)',
                    background: '#10B98111', border: '1px dashed #10B981',
                    color: '#10B981', cursor: selectedPlanId ? 'pointer' : 'not-allowed',
                    opacity: selectedPlanId ? 1 : 0.5,
                  }}
                >
                  + Apron Boundary
                </button>
              </div>

              {taxilanes.length === 0 && apronBoundaries.length === 0 && (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-xs)', padding: '4px 0', margin: 0 }}>
                  No taxilanes or boundaries defined. Draw centerlines to verify clearance envelopes.
                </p>
              )}

              {/* Taxilane list */}
              {taxilanes.map(tl => {
                const isEditing = editingTaxilane?.id === tl.id
                const tlForCheck: TaxilaneForCheck = { id: tl.id, name: tl.name, taxilane_type: tl.taxilane_type, design_wingspan_ft: tl.design_wingspan_ft, line_coords: tl.line_coords, is_transient: tl.is_transient }
                const { halfWidth, detail } = getTaxilaneEnvelopeHalfWidth(tlForCheck)
                const tlViolations = allResults.filter(r => r.spot_b_id === tl.id && r.status !== 'ok')

                return (
                  <div key={tl.id}>
                    <div
                      onClick={() => setEditingTaxilane(isEditing ? null : tl)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 8px', cursor: 'pointer',
                        background: isEditing ? 'var(--color-bg)' : 'transparent',
                        borderBottom: '1px solid var(--color-border)',
                        borderLeft: `3px solid ${tlViolations.length > 0 ? '#EF4444' : tl.taxilane_type === 'peripheral' ? '#8B5CF6' : '#3B82F6'}`,
                      }}
                    >
                      <span style={{
                        fontSize: 10, padding: '1px 4px', borderRadius: 3,
                        background: tl.taxilane_type === 'peripheral' ? '#8B5CF622' : '#3B82F622',
                        color: tl.taxilane_type === 'peripheral' ? '#8B5CF6' : '#3B82F6',
                        textTransform: 'capitalize', flexShrink: 0,
                      }}>
                        {tl.taxilane_type}
                      </span>
                      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-primary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tl.name || 'Unnamed'}
                      </span>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                        {detail.ufc_item} &middot; {Math.round(halfWidth)}ft env
                      </span>
                      {tlViolations.length > 0 && (
                        <span style={{ color: '#EF4444', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>!</span>
                      )}
                      <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', flexShrink: 0 }}>{isEditing ? '\u25B2' : '\u25BC'}</span>
                    </div>

                    {isEditing && (
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{ padding: '8px 8px 8px 16px', display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}
                      >
                        <div style={{ display: 'flex', gap: 6 }}>
                          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', flex: 1 }}>
                            Name
                            <input value={tl.name || ''} onChange={e => handleUpdateTaxilane(tl.id, { name: e.target.value })} style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }} />
                          </label>
                          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', flex: 1 }}>
                            Design Aircraft
                            <input value={tl.design_aircraft || ''} onChange={e => handleUpdateTaxilane(tl.id, { design_aircraft: e.target.value })} style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }} />
                          </label>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', flex: 1 }}>
                            Design Wingspan (ft)
                            <input type="number" value={tl.design_wingspan_ft || ''} placeholder="100" onChange={e => handleUpdateTaxilane(tl.id, { design_wingspan_ft: Number(e.target.value) || null as any })} style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }} />
                          </label>
                          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                            <input type="checkbox" checked={tl.is_transient} onChange={e => handleUpdateTaxilane(tl.id, { is_transient: e.target.checked })} />
                            {' '}Transient
                          </label>
                          <select
                            value={tl.taxilane_type}
                            onChange={e => handleUpdateTaxilane(tl.id, { taxilane_type: e.target.value as any })}
                            style={{ padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }}
                          >
                            <option value="interior">Interior</option>
                            <option value="peripheral">Peripheral</option>
                          </select>
                        </div>
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', padding: '2px 0' }}>
                          Envelope: 0.5 × {tl.design_wingspan_ft || 100}ft + {detail.clearance_ft}ft ({detail.ufc_item}) = {Math.round(halfWidth)}ft half-width
                        </div>
                        {tlViolations.length > 0 && (
                          <div style={{ fontSize: 'var(--fs-xs)', color: '#EF4444', padding: '2px 0' }}>
                            {tlViolations.length} aircraft intrude{tlViolations.length === 1 ? 's' : ''} into taxilane envelope
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => { if (tl.line_coords?.length > 0) map.current?.flyTo({ center: tl.line_coords[0] as [number, number], zoom: 17 }) }} style={{ padding: '4px 8px', borderRadius: 3, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}>Fly To</button>
                          <button onClick={() => handleDeleteTaxilane(tl.id)} style={{ padding: '4px 8px', borderRadius: 3, background: '#EF444422', border: '1px solid #EF444444', color: '#EF4444', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}>Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Apron boundary list */}
              {apronBoundaries.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', fontSize: 'var(--fs-xs)', color: '#10B981', fontWeight: 600, padding: '6px 8px 2px', marginTop: taxilanes.length > 0 ? 4 : 0 }}>
                  <span style={{ flex: 1 }}>Apron Boundaries</span>
                  <button
                    onClick={() => toggleLayerVisibility('boundaries')}
                    title={visibleLayers.boundaries ? 'Hide on map' : 'Show on map'}
                    style={{ padding: '0 4px', border: 'none', cursor: 'pointer', background: 'transparent', fontSize: 12, color: visibleLayers.boundaries ? '#10B981' : 'var(--color-text-secondary)', opacity: visibleLayers.boundaries ? 1 : 0.4 }}
                  >
                    {visibleLayers.boundaries ? '\u25C9' : '\u25CB'}
                  </button>
                </div>
              )}
              {apronBoundaries.map(ab => {
                const isEditing = editingBoundary?.id === ab.id
                return (
                  <div key={ab.id}>
                    <div
                      onClick={() => setEditingBoundary(isEditing ? null : ab)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 8px', cursor: 'pointer',
                        background: isEditing ? 'var(--color-bg)' : 'transparent',
                        borderBottom: '1px solid var(--color-border)',
                        borderLeft: '3px solid #10B981',
                      }}
                    >
                      <span style={{
                        fontSize: 10, padding: '1px 4px', borderRadius: 3,
                        background: '#10B98122', color: '#10B981', flexShrink: 0,
                      }}>
                        boundary
                      </span>
                      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-primary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ab.name || 'Unnamed'}
                      </span>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                        {ab.polygon_coords?.length || 0} pts
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', flexShrink: 0 }}>{isEditing ? '\u25B2' : '\u25BC'}</span>
                    </div>

                    {isEditing && (
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{ padding: '8px 8px 8px 16px', display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}
                      >
                        <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                          Name
                          <input value={ab.name || ''} onChange={e => handleUpdateBoundary(ab.id, { name: e.target.value })} style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }} />
                        </label>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => { if (ab.polygon_coords?.length > 0) map.current?.flyTo({ center: ab.polygon_coords[0] as [number, number], zoom: 17 }) }} style={{ padding: '4px 8px', borderRadius: 3, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}>Fly To</button>
                          <button onClick={() => handleDeleteBoundary(ab.id)} style={{ padding: '4px 8px', borderRadius: 3, background: '#EF444422', border: '1px solid #EF444444', color: '#EF4444', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}>Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Clearance Section ── */}
          <SectionHeader id="clearance" label="Clearance" count={violations.length + warnings.length} color={violations.length > 0 ? '#EF4444' : '#F59E0B'} layerKey="clearance" />
          {openSections.clearance && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {allResults.length === 0 && (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-xs)', padding: '4px 0', margin: 0 }}>
                  Place at least 2 aircraft or 1 aircraft + 1 obstacle to see clearance checks.
                </p>
              )}

              {allResults.map((r, i) => (
                <div
                  key={i}
                  onClick={() => flyToResult(r)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 8px', cursor: 'pointer',
                    borderBottom: '1px solid var(--color-border)',
                    borderLeft: `3px solid ${STATUS_COLORS[r.status]}`,
                    background: r.status !== 'ok' ? `${STATUS_COLORS[r.status]}08` : 'transparent',
                  }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: STATUS_COLORS[r.status],
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.aircraft_a} / {r.aircraft_b}
                  </span>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
                    {r.distance_ft.toFixed(1)}ft / {r.required_ft}ft
                  </span>
                  {r.status === 'violation' && <span style={{ fontSize: 'var(--fs-xs)', color: '#EF4444', fontWeight: 600, flexShrink: 0 }}>VIOLATION</span>}
                  {r.status === 'warning' && <span style={{ fontSize: 'var(--fs-xs)', color: '#F59E0B', fontWeight: 600, flexShrink: 0 }}>WARNING</span>}
                  {r.status === 'ok' && <span style={{ fontSize: 'var(--fs-xs)', color: '#22C55E', flexShrink: 0 }}>OK</span>}
                  <span style={{ fontSize: 10, color: 'var(--color-text-tertiary, #6B7280)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {r.ufc_item}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ── Settings Section ── */}
          <SectionHeader id="settings" label="Settings" />
          {openSections.settings && (
            <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6, borderBottom: '1px solid var(--color-border)' }}>
              <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                UFC 3-260-01 Table 6-1a Context
                <select
                  value={apronContext}
                  onChange={e => setApronContext(e.target.value as ApronContext)}
                  style={{
                    width: '100%', padding: '4px 6px', borderRadius: 3, fontSize: 'var(--fs-xs)', marginTop: 2,
                    border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {(Object.entries(APRON_CONTEXT_LABELS) as [ApronContext, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  onClick={() => setPlanLocked(l => !l)}
                  style={{
                    flex: 1, padding: '4px 8px', borderRadius: 3, fontSize: 'var(--fs-xs)',
                    background: planLocked ? '#EF444422' : '#22C55E22',
                    border: `1px solid ${planLocked ? '#EF444444' : '#22C55E44'}`,
                    color: planLocked ? '#EF4444' : '#22C55E',
                    cursor: 'pointer', fontWeight: 500,
                  }}
                >
                  {planLocked ? 'Locked — No Dragging' : 'Unlocked — Drag Enabled'}
                </button>
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                Use the eye toggles on each section header to show/hide layers on the map.
              </div>
            </div>
          )}

          {/* ── Reference Section ── */}
          <SectionHeader id="reference" label="UFC Reference" />
          {openSections.reference && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <p style={{ margin: '0 0 4px', fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                UFC 3-260-01 Table 6-1a — A/AF Apron Clearances (4 Feb 2019, Change 3)
              </p>
              {TABLE_6_1A_ITEMS.map(item => (
                <div
                  key={item.item}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '4px 8px',
                    borderBottom: '1px solid var(--color-border)',
                    opacity: item.applicable_to_2d ? 1 : 0.5,
                  }}
                >
                  <span style={{
                    fontSize: 10, padding: '1px 6px', borderRadius: 3,
                    background: item.applicable_to_2d ? 'var(--color-cyan)22' : 'var(--color-bg)',
                    color: item.applicable_to_2d ? 'var(--color-cyan)' : 'var(--color-text-secondary)',
                    fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap',
                  }}>
                    {item.item}{item.letter ? `(${item.letter})` : ''}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 1 }}>
                      {item.values}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>{/* end scrollable sections */}
      </div>{/* end sidebar */}

      {/* ── Map + overlay area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Placement mode indicator — above map */}
        {(placingAircraft || placingObstacle || drawingLineObsId || drawingTaxilaneId || drawingBoundaryId || drawingObsType) && (
          <div style={{
            padding: '6px 12px',
            background: drawingTaxilaneId ? (drawingTaxilaneType === 'peripheral' ? '#8B5CF622' : '#3B82F622') : drawingBoundaryId ? '#10B98122' : drawingObsType ? '#F9731622' : '#F59E0B22',
            borderBottom: `1px solid ${drawingTaxilaneId ? (drawingTaxilaneType === 'peripheral' ? '#8B5CF644' : '#3B82F644') : drawingBoundaryId ? '#10B98144' : '#F59E0B44'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: 'var(--fs-sm)',
            color: drawingTaxilaneId ? (drawingTaxilaneType === 'peripheral' ? '#8B5CF6' : '#3B82F6') : drawingBoundaryId ? '#10B981' : drawingObsType ? '#F97316' : '#F59E0B',
            flexShrink: 0,
          }}>
            <span>
              {drawingObsType
                ? `Drawing ${drawingObsType} — move mouse to set ${drawingObsType === 'circle' ? 'radius' : 'size'}, click to confirm`
                : drawingTaxilaneId
                ? `Drawing ${drawingTaxilaneType} taxilane (${drawingTaxilanePoints.length} pts)`
                : drawingBoundaryId
                ? `Drawing apron boundary (${drawingBoundaryPoints.length} pts)`
                : drawingLineObsId
                ? `Drawing line obstacle (${drawingLinePoints.length} pts)`
                : `Click map to place ${placingAircraft ? placingAircraft.aircraft : `${placingObstacle} obstacle`}`
              }
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {drawingTaxilaneId && (
                <button onClick={handleFinishTaxilane} style={{ background: drawingTaxilaneType === 'peripheral' ? '#8B5CF6' : '#3B82F6', border: 'none', color: '#FFF', cursor: 'pointer', padding: '2px 10px', borderRadius: 4, fontWeight: 600, fontSize: 'var(--fs-xs)' }}>Finish</button>
              )}
              {drawingBoundaryId && (
                <button onClick={handleFinishBoundary} style={{ background: '#10B981', border: 'none', color: '#FFF', cursor: 'pointer', padding: '2px 10px', borderRadius: 4, fontWeight: 600, fontSize: 'var(--fs-xs)' }}>Finish</button>
              )}
              {drawingLineObsId && (
                <button onClick={handleFinishLine} style={{ background: '#F97316', border: 'none', color: '#000', cursor: 'pointer', padding: '2px 10px', borderRadius: 4, fontWeight: 600, fontSize: 'var(--fs-xs)' }}>Finish</button>
              )}
              <button
                onClick={() => {
                  setPlacingAircraft(null)
                  setPlacingObstacle(null)
                  if (drawingLineObsId) { handleDeleteObstacle(drawingLineObsId); setDrawingLineObsId(null); setDrawingLinePoints([]) }
                  if (drawingTaxilaneId) { setDrawingTaxilaneId(null); setDrawingTaxilanePoints([]) }
                  if (drawingBoundaryId) { setDrawingBoundaryId(null); setDrawingBoundaryPoints([]) }
                  if (drawingObsType) { setDrawingObsType(null); setDrawingObsStart(null); setDrawingObsCurrent(null) }
                }}
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', textDecoration: 'underline', fontSize: 'var(--fs-xs)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div ref={mapContainer} style={{ flex: 1, minHeight: 0 }} />
      </div>

      {/* Aircraft Picker Modal */}
      {showAircraftPicker && (
        <div
          onClick={() => setShowAircraftPicker(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 480, maxHeight: '80vh', background: 'var(--color-bg-surface)',
              borderRadius: 8, border: '1px solid var(--color-border)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 'var(--fs-base)', color: 'var(--color-text-primary)' }}>
                Select Aircraft
              </h3>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {(['all', 'military', 'commercial'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setAircraftCategoryFilter(cat)}
                    style={{
                      flex: 1, padding: '4px 8px', borderRadius: 4, fontSize: 'var(--fs-xs)',
                      border: `1px solid ${aircraftCategoryFilter === cat ? 'var(--color-cyan)' : 'var(--color-border)'}`,
                      background: aircraftCategoryFilter === cat ? 'var(--color-cyan)11' : 'var(--color-bg)',
                      color: aircraftCategoryFilter === cat ? 'var(--color-cyan)' : 'var(--color-text-secondary)',
                      cursor: 'pointer', textTransform: 'capitalize',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <input
                autoFocus
                placeholder="Search aircraft..."
                value={aircraftSearch}
                onChange={e => setAircraftSearch(e.target.value)}
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 4,
                  border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                  color: 'var(--color-text-primary)', fontSize: 'var(--fs-sm)',
                }}
              />
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {filteredAircraft.map(ac => {
                const ws = parseNum(ac.wing_span_ft)
                const adg = ws > 0 ? getADGFromWingspan(ws) : null
                return (
                  <button
                    key={ac.aircraft}
                    onClick={() => {
                      setPlacingAircraft(ac)
                      setShowAircraftPicker(false)
                      setAircraftSearch('')
                      setPlacingObstacle(null)
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '8px 16px', border: 'none', borderBottom: '1px solid var(--color-border)',
                      background: 'transparent', cursor: 'pointer', textAlign: 'left',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 500 }}>{ac.aircraft}</div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                        {ac.manufacturer || 'Unknown'} &middot;{' '}
                        {ws > 0 ? `${ws}ft span` : 'No wingspan data'}
                        {ac.turn_radius_ft ? ` &middot; ${ac.turn_radius_ft}ft turn` : ''}
                      </div>
                    </div>
                    {adg && (
                      <span style={{
                        fontSize: 10, padding: '1px 6px', borderRadius: 3,
                        background: `${ADG_COLORS[adg]}22`, color: ADG_COLORS[adg],
                        fontWeight: 600,
                      }}>
                        ADG {adg}
                      </span>
                    )}
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 3,
                      background: ac.category === 'military' ? '#22C55E22' : '#3B82F622',
                      color: ac.category === 'military' ? '#22C55E' : '#3B82F6',
                      textTransform: 'capitalize',
                    }}>
                      {ac.category}
                    </span>
                  </button>
                )
              })}
              {filteredAircraft.length === 0 && (
                <p style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--fs-sm)' }}>
                  No aircraft match your search.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Plan Modal */}
      {showNewPlan && (
        <div
          onClick={() => setShowNewPlan(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 400, background: 'var(--color-bg-surface)',
              borderRadius: 8, border: '1px solid var(--color-border)', padding: 20,
            }}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 'var(--fs-base)', color: 'var(--color-text-primary)' }}>
              New Parking Plan
            </h3>
            <label style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
              Plan Name *
              <input
                autoFocus
                value={newPlanName}
                onChange={e => setNewPlanName(e.target.value)}
                placeholder="e.g., Exercise Plan A, Max Surge"
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 4, marginTop: 4,
                  border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                  color: 'var(--color-text-primary)', fontSize: 'var(--fs-sm)',
                }}
              />
            </label>
            <label style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)', marginBottom: 16 }}>
              Description
              <textarea
                value={newPlanDesc}
                onChange={e => setNewPlanDesc(e.target.value)}
                rows={2}
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 4, marginTop: 4,
                  border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                  color: 'var(--color-text-primary)', fontSize: 'var(--fs-sm)', resize: 'vertical',
                }}
              />
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowNewPlan(false)}
                style={{ padding: '6px 16px', borderRadius: 4, background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlan}
                disabled={!newPlanName.trim()}
                style={{
                  padding: '6px 16px', borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: newPlanName.trim() ? 'var(--color-cyan)' : 'var(--color-border)',
                  color: newPlanName.trim() ? '#000' : 'var(--color-text-secondary)',
                  fontWeight: 500,
                }}
              >
                Create Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
