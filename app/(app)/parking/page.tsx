'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { initGoogleMaps, isGoogleMapsConfigured, GOOGLE_MAP_OPTIONS, type GMapWrapper, createGMapWrapper, pixelToLatLng, queryFeatureAtPoint, clearAllObjects } from '@/lib/google-map-adapter'
import { toast } from 'sonner'
import { useGoogleMapRuler } from '@/hooks/use-google-map-ruler'
import { useInstallation } from '@/lib/installation-context'
import { formatCoordsDMS } from '@/lib/utils'
import { allAircraft } from '@/lib/aircraft-data'
import type { AircraftCharacteristics } from '@/lib/aircraft_database_schema'
import silhouetteManifest from '@/public/aircraft_silhouette_manifest.json'
import {
  fetchParkingPlans,
  createParkingPlan,
  updateParkingPlan,
  deleteParkingPlan,
  setActivePlan,
  duplicateParkingPlan,
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
import { generateParkingPdf } from '@/lib/parking-pdf'
import { sendPdfViaEmail } from '@/lib/email-pdf'
import EmailPdfModal from '@/components/ui/email-pdf-modal'
import { MoreVertical, Star } from 'lucide-react'

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

// Fixed reference size for SVG rendering — marker icon scaling handles display size
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
 *  the aircraft's real-world wingspan at the current map zoom.
 *  Uses Google Maps projection to convert real-world distance to pixels. */
function computeIconScale(wingspanFt: number, lengthFt: number, gmap: google.maps.Map): number {
  // Directly measure how many pixels the wingspan should occupy by projecting
  // two real-world points and measuring their screen distance.
  // This matches the Mapbox approach exactly.
  const bounds = gmap.getBounds()
  const div = gmap.getDiv()
  if (!bounds || !div) return 0.1

  const center = gmap.getCenter()
  if (!center) return 0.1

  const ne = bounds.getNorthEast()
  const sw = bounds.getSouthWest()
  const mapWidthPx = div.clientWidth
  if (mapWidthPx <= 0) return 0.1

  // Degrees of longitude visible in the map
  const lngSpan = ne.lng() - sw.lng()
  if (lngSpan <= 0) return 0.1

  // Pixels per degree of longitude
  const pxPerDegLng = mapWidthPx / lngSpan

  // Wingspan in degrees of longitude at this latitude
  const wingspanM = wingspanFt * FT_TO_M
  const wingspanDegLng = wingspanM / (111319.9 * Math.cos(center.lat() * Math.PI / 180))

  // Target screen pixels for the wingspan
  const targetPx = wingspanDegLng * pxPerDegLng

  // Divide by SVG drawing width (w), not canvas width (w+8). Apply 1.03 overcompensation
  // so silhouettes render slightly larger than actual — SVG wing tip artwork doesn't extend
  // to the exact bounding box edge. Oversized is safer than undersized for clearance planning.
  const aspect = lengthFt / wingspanFt
  const svgDrawW = aspect >= 1 ? Math.round(REF_ICON_SIZE / aspect) : REF_ICON_SIZE

  return Math.max(0.02, Math.min((targetPx / svgDrawW) * 1.03, 4.0))
}

// ── Main Page ──

export default function ParkingPage() {
  const { installationId, currentInstallation, runways, defaultPdfEmail } = useInstallation()

  // ── State ──
  const [plans, setPlans] = useState<ParkingPlan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [spots, setSpots] = useState<ParkingSpot[]>([])
  const spotsRef = useRef<ParkingSpot[]>([])
  spotsRef.current = spots
  const [obstacles, setObstacles] = useState<ParkingObstacle[]>([])
  const [taxilanes, setTaxilanes] = useState<ParkingTaxilane[]>([])
  const [apronBoundaries, setApronBoundaries] = useState<ParkingApronBoundary[]>([])
  const [loading, setLoading] = useState(true)
  const [mapLoaded, setMapLoaded] = useState(false)
  // UI state
  const [showNewPlan, setShowNewPlan] = useState(false)
  const [newPlanName, setNewPlanName] = useState('')
  const [newPlanDesc, setNewPlanDesc] = useState('')
  const [newPlanIsTemplate, setNewPlanIsTemplate] = useState(false)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [duplicateName, setDuplicateName] = useState('')
  const [duplicateDesc, setDuplicateDesc] = useState('')
  const [duplicateAsTemplate, setDuplicateAsTemplate] = useState(false)
  const [showAircraftPicker, setShowAircraftPicker] = useState(false)
  const [aircraftSearch, setAircraftSearch] = useState('')
  const [bulkAddCount, setBulkAddCount] = useState<number | ''>(1)
  const [placementHeading, setPlacementHeading] = useState(0)
  const [contextMenuSpot, setContextMenuSpot] = useState<{ spot: ParkingSpot; x: number; y: number } | null>(null)
  const contextMenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 344
    const saved = parseInt(localStorage.getItem('glidepath_parking_panel_width') || '', 10)
    return Number.isFinite(saved) && saved >= 260 && saved <= 640 ? saved : 344
  })
  const [panelHeight, setPanelHeight] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    const saved = parseInt(localStorage.getItem('glidepath_parking_panel_height') || '', 10)
    return Number.isFinite(saved) && saved >= 240 ? saved : null
  })
  const panelResizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number; dir: 'w' | 'h' | 'wh' } | null>(null)
  const [showActionMenu, setShowActionMenu] = useState(false)
  const [clearanceFilter, setClearanceFilter] = useState<'all' | 'violations' | 'warnings' | 'ok'>('all')
  const [favoriteAircraft, setFavoriteAircraft] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('glidepath_fav_aircraft') || '[]') } catch { return [] }
  })

  // Multi-select state for aircraft
  const [selectedSpotIds, setSelectedSpotIds] = useState<Set<string>>(new Set())
  const selectedSpotIdsRef = useRef<Set<string>>(new Set())
  selectedSpotIdsRef.current = selectedSpotIds
  const editingSpotRef = useRef<ParkingSpot | null>(null)
  editingSpotRef.current = editingSpot
  const [boxSelectActive, setBoxSelectActive] = useState(false)
  const boxSelectActiveRef = useRef(false)
  boxSelectActiveRef.current = boxSelectActive

  // Taxilane point-editing mode
  const [editingTaxilanePoints, setEditingTaxilanePoints] = useState(false)
  const vertexMarkersRef = useRef<google.maps.Marker[]>([])
  const midpointMarkersRef = useRef<google.maps.Marker[]>([])

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

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false)
  const [sheetExpanded, setSheetExpanded] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // PDF export & email
  const [exportingPdf, setExportingPdf] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailPdfData, setEmailPdfData] = useState<{ doc: any; filename: string } | null>(null)
  const [sendingEmail, setSendingEmail] = useState(false)

  // Lock mode — prevents dragging when locked
  const [planLocked, setPlanLocked] = useState(false)
  const planLockedRef = useRef(planLocked)
  planLockedRef.current = planLocked
  const [obstaclesLocked, setObstaclesLocked] = useState(true) // obstacles locked by default
  const obstaclesLockedRef = useRef(obstaclesLocked)
  obstaclesLockedRef.current = obstaclesLocked

  // Sidebar tab navigation
  const [sidebarTab, setSidebarTab] = useState<'aircraft' | 'environment' | 'clearance' | 'settings'>('aircraft')

  // Placement mode
  const isPlacing = !!(placingAircraft || placingObstacle || drawingLineObsId || drawingTaxilaneId || drawingBoundaryId || drawingObsType)
  const isPlacingRef = useRef(isPlacing)
  isPlacingRef.current = isPlacing

  // Google Maps ready state
  const hasGoogleMaps = isGoogleMapsConfigured()
  const [googleReady, setGoogleReady] = useState(false)

  // Map refs
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<GMapWrapper | null>(null)
  const dragSpotId = useRef<string | null>(null)
  const dragObstacleId = useRef<string | null>(null)
  const isDraggingRef = useRef(false)
  const dragOffsetRef = useRef<{ dLng: number; dLat: number }>({ dLng: 0, dLat: 0 })
  const dragStartPt = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  // Group drag: snapshot initial positions of all selected spots to translate as a unit
  const groupDragStartRef = useRef<Map<string, { lng: number; lat: number }>>(new Map())
  const dragLabelMarkersRef = useRef<google.maps.Marker[]>([])
  const dragLineRef = useRef<google.maps.Polyline[]>([])

  // Ruler tool
  const [rulerActive, setRulerActive] = useState(false)
  const gmapRawRef = useRef<google.maps.Map | null>(null)
  const ruler = useGoogleMapRuler(gmapRawRef, rulerActive)
  const spotMarkersMapRef = useRef<Map<string, google.maps.Marker>>(new Map())
  // Per-spot metadata for zoom rescaling (avoids full re-render)
  const spotMetaRef = useRef<Map<string, { fixedDim: number; wingspanFt: number; lengthFt: number; cacheKey: string }>>(new Map())
  // Selection ring — managed separately from main render
  const selectionRingRef = useRef<google.maps.Circle | null>(null)
  // Cache rotated silhouette data URLs to avoid re-rendering on every zoom change
  const silhouetteCacheRef = useRef<Map<string, { url: string; fixedDim: number; heading: number }>>(new Map())
  // Nose gear markers — managed with aircraft layer
  const noseGearMarkersRef = useRef<google.maps.Marker[]>([])
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

  // ── Google Maps initialization ──

  useEffect(() => {
    if (!hasGoogleMaps) return
    initGoogleMaps().then(() => setGoogleReady(true)).catch(() => {})
  }, [hasGoogleMaps])

  useEffect(() => {
    if (!mapContainer.current || !googleReady || !installationId) return

    if (map.current) {
      clearAllObjects(map.current)
      map.current = null
      setMapLoaded(false)
    }

    const rwy = runways[0]
    const centerLat = rwy
      ? ((rwy.end1_latitude ?? 0) + (rwy.end2_latitude ?? 0)) / 2
      : 42.6139
    const centerLng = rwy
      ? ((rwy.end1_longitude ?? 0) + (rwy.end2_longitude ?? 0)) / 2
      : -82.8369

    const gmap = new google.maps.Map(mapContainer.current, {
      ...GOOGLE_MAP_OPTIONS,
      center: { lat: centerLat, lng: centerLng },
      zoom: 15,
      scaleControl: true,
    })

    const wrapper = createGMapWrapper(gmap)
    map.current = wrapper
    gmapRawRef.current = gmap

    // Google Maps is ready immediately after construction — tiles load async
    google.maps.event.addListenerOnce(gmap, 'tilesloaded', () => {
      setMapLoaded(true)
    })

    return () => {
      if (map.current) {
        clearAllObjects(map.current)
        map.current = null
        setMapLoaded(false)
      }
    }
  }, [googleReady, installationId, runways])

  // ── Map click handler for placing aircraft/obstacles ──

  useEffect(() => {
    const w = map.current
    if (!w || !mapLoaded) return
    const gmap = w.gmap

    const listener = gmap.addListener('click', async (e: google.maps.MapMouseEvent) => {
      if (isDraggingRef.current) return
      if (!e.latLng) return

      const lat = e.latLng.lat()
      const lng = e.latLng.lng()

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
        const acName = placingAircraft.aircraft

        // Compute sequential number for this aircraft type — read via ref so
        // rapid successive clicks see prior placements before React's state
        // commits (the click listener captures `spots` stale from its useEffect deps).
        const currentSpots = spotsRef.current
        const existingSeqs = currentSpots
          .filter(s => s.aircraft_name === acName)
          .map(s => {
            const m = (s.spot_name || '').match(/#(\d+)$/)
            return m ? parseInt(m[1], 10) : 0
          })
        const nextStart = existingSeqs.length > 0 ? Math.max(...existingSeqs) + 1 : 1
        const placedSpots: ParkingSpot[] = []
        const count = (typeof bulkAddCount === 'number' && bulkAddCount > 1) ? bulkAddCount : 1

        // Auto-space: wingspan + required wingtip clearance on each side
        // Place perpendicular to aircraft heading (wingtip-to-wingtip direction)
        const spacingFt = ws + clearance * 2
        // Perpendicular bearing = heading + 90° (spacing along the wing line)
        const perpBearing = (placementHeading + 90) % 360

        for (let i = 0; i < count; i++) {
          const seqNum = nextStart + i
          // First aircraft at click point, subsequent spaced perpendicular to heading
          const origin = i === 0
            ? { lat, lon: lng }
            : offsetPoint({ lat, lon: lng }, perpBearing, spacingFt * i)
          const spot = await createParkingSpot({
            plan_id: selectedPlanId,
            base_id: installationId,
            aircraft_name: acName,
            spot_name: `${acName} #${seqNum}`,
            longitude: origin.lon,
            latitude: origin.lat,
            heading_deg: placementHeading,
            clearance_ft: clearance,
            spot_type: 'apron',
            status: 'available',
          })
          if (spot) placedSpots.push(spot)
        }

        if (placedSpots.length > 0) {
          setSpots(prev => [...prev, ...placedSpots])
          setEditingSpot(placedSpots[placedSpots.length - 1])
          setOpenSections(prev => ({ ...prev, aircraft: true }))
          toast.success(`Placed ${placedSpots.length}× ${acName}`)
        } else {
          toast.error('Failed to place aircraft')
        }
        setPlacingAircraft(null)
        setBulkAddCount(1)
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
    })

    return () => { google.maps.event.removeListener(listener) }
  }, [mapLoaded, placingAircraft, placingObstacle, selectedPlanId, installationId, obstacles.length, drawingLineObsId, drawingTaxilaneId, drawingBoundaryId, drawingObsType, drawingObsStart])

  // ── Layer 1: Static geometry (obstacles, taxilanes, boundaries, clearance zones) ──
  const geomObjectsRef = useRef<{
    polygons: google.maps.Polygon[]
    polylines: google.maps.Polyline[]
    markers: google.maps.Marker[]
  }>({ polygons: [], polylines: [], markers: [] })

  useEffect(() => {
    const w = map.current
    if (!w || !mapLoaded) return
    const gmap = w.gmap

    // Clean up previous geometry
    const prev = geomObjectsRef.current
    prev.polygons.forEach(p => p.setMap(null))
    prev.polylines.forEach(p => p.setMap(null))
    prev.markers.forEach(m => m.setMap(null))
    geomObjectsRef.current = { polygons: [], polylines: [], markers: [] }
    const objs = geomObjectsRef.current

    // Remove obstacle entries from feature index (keep aircraft entries)
    for (const key of Array.from(w.featureIndex.keys())) {
      if (key.startsWith('obs-')) w.featureIndex.delete(key)
    }

    // ── Clearance zones ──
    if (showClearances && visibleLayers.clearance) {
      for (const spot of spotsWithAircraft) {
        const clearanceFt = spot.clearance_ft ?? getWingtipClearance(spot.wingspan_ft, apronContext, spot.aircraft_name)
        const polygon = generateClearanceZonePolygon(spot, clearanceFt)
        const spotResults = allResults.filter(r => r.spot_a_id === spot.id || r.spot_b_id === spot.id)
        const hasViolation = spotResults.some(r => r.status === 'violation')
        const hasWarning = spotResults.some(r => r.status === 'warning')
        const color = hasViolation ? '#EF4444' : hasWarning ? '#F59E0B' : '#22C55E'

        const poly = new google.maps.Polygon({
          paths: polygon.map(([lng, lat]) => ({ lat, lng })),
          fillColor: color, fillOpacity: 0.15,
          strokeColor: color, strokeWeight: 1.5, strokeOpacity: 0.6,
          map: gmap, clickable: false, zIndex: 1,
        })
        objs.polygons.push(poly)
      }
    }

    // ── Obstacles ──
    if (visibleLayers.obstacles) {
      for (const obs of obstacles) {
        if (obs.obstacle_type === 'point') {
          const marker = new google.maps.Marker({
            position: { lat: obs.latitude, lng: obs.longitude },
            map: gmap,
            icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#F97316', fillOpacity: 1, strokeColor: '#FFF', strokeWeight: 1.5 },
            zIndex: 5,
            label: obs.name ? { text: obs.name, color: '#F97316', fontSize: '11px', fontWeight: 'bold', className: 'parking-obs-label' } : undefined,
          })
          objs.markers.push(marker)
          w.featureIndex.set(`obs-${obs.id}`, { lat: obs.latitude, lng: obs.longitude, type: 'obstacle', props: { obsId: obs.id, type: obs.obstacle_type } })
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
          const poly = new google.maps.Polygon({
            paths: corners.map(c => ({ lat: c.lat, lng: c.lon })),
            fillColor: '#F97316', fillOpacity: 0.35,
            strokeColor: '#F97316', strokeWeight: 2,
            map: gmap, zIndex: 3,
          })
          objs.polygons.push(poly)
          w.featureIndex.set(`obs-${obs.id}`, { lat: obs.latitude, lng: obs.longitude, type: 'obstacle', props: { obsId: obs.id, type: obs.obstacle_type } })
        } else if (obs.obstacle_type === 'circle') {
          const center = { lat: obs.latitude, lon: obs.longitude }
          const radius = obs.radius_ft || 50
          const segs = 48
          const coords: { lat: number; lng: number }[] = []
          for (let i = 0; i <= segs; i++) {
            const bearing = (360 * i) / segs
            const pt = offsetPoint(center, bearing, radius)
            coords.push({ lat: pt.lat, lng: pt.lon })
          }
          const poly = new google.maps.Polygon({
            paths: coords,
            fillColor: '#F97316', fillOpacity: 0.35,
            strokeColor: '#F97316', strokeWeight: 2,
            map: gmap, zIndex: 3,
          })
          objs.polygons.push(poly)
          w.featureIndex.set(`obs-${obs.id}`, { lat: obs.latitude, lng: obs.longitude, type: 'obstacle', props: { obsId: obs.id, type: obs.obstacle_type } })
        } else if (obs.obstacle_type === 'line' && obs.line_coords) {
          const line = new google.maps.Polyline({
            path: obs.line_coords.map(([lng, lat]) => ({ lat, lng })),
            strokeColor: '#F97316', strokeWeight: 3,
            map: gmap, zIndex: 3,
          })
          objs.polylines.push(line)
          w.featureIndex.set(`obs-${obs.id}`, { lat: obs.latitude, lng: obs.longitude, type: 'obstacle', props: { obsId: obs.id, type: obs.obstacle_type } })
        }
      }
    }

    // ── Taxilane envelopes + centerlines ──
    for (const tl of taxilanes) {
      if (!tl.line_coords || tl.line_coords.length < 2) continue
      const tlForCheck: TaxilaneForCheck = { id: tl.id, name: tl.name, taxilane_type: tl.taxilane_type, design_wingspan_ft: tl.design_wingspan_ft, line_coords: tl.line_coords, is_transient: tl.is_transient }
      const { halfWidth } = getTaxilaneEnvelopeHalfWidth(tlForCheck)
      const envelope = generateTaxilaneEnvelopePolygon(tl.line_coords, halfWidth)

      const hasViolation = spotsWithAircraft.some(s => checkTaxilaneClearance(s, tlForCheck).status === 'violation')
      const hasWarning = !hasViolation && spotsWithAircraft.some(s => checkTaxilaneClearance(s, tlForCheck).status === 'warning')
      const envelopeColor = hasViolation ? '#EF4444' : hasWarning ? '#F59E0B' : tl.taxilane_type === 'peripheral' ? '#8B5CF6' : '#3B82F6'

      if (showClearances && visibleLayers.taxilanes && envelope.length > 0) {
        const poly = new google.maps.Polygon({
          paths: envelope.map(([lng, lat]) => ({ lat, lng })),
          fillColor: envelopeColor, fillOpacity: 0.1,
          strokeColor: envelopeColor, strokeWeight: 1.5,
          map: gmap, zIndex: 2, clickable: false,
        })
        objs.polygons.push(poly)
      }

      if (visibleLayers.taxilanes) {
        const lineColor = tl.taxilane_type === 'peripheral' ? '#8B5CF6' : '#3B82F6'
        const centerline = new google.maps.Polyline({
          path: tl.line_coords.map(([lng, lat]) => ({ lat, lng })),
          strokeColor: lineColor, strokeWeight: 2.5, strokeOpacity: 0.8,
          map: gmap, zIndex: 3,
        })
        objs.polylines.push(centerline)

        if (tl.name) {
          const midIdx = Math.floor(tl.line_coords.length / 2)
          const midPt = tl.line_coords[midIdx]
          const lbl = new google.maps.Marker({
            position: { lat: midPt[1], lng: midPt[0] },
            map: gmap,
            label: { text: tl.name, color: '#FFFFFF', fontWeight: 'bold', fontSize: '12px', className: 'parking-ac-label' },
            icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
            clickable: false, zIndex: 4,
          })
          objs.markers.push(lbl)
        }
      }
    }

    // ── Apron boundaries ──
    if (visibleLayers.boundaries) {
      for (const ab of apronBoundaries) {
        if (!ab.polygon_coords || ab.polygon_coords.length < 3) continue
        const poly = new google.maps.Polygon({
          paths: ab.polygon_coords.map(([lng, lat]) => ({ lat, lng })),
          fillColor: '#10B981', fillOpacity: 0.06,
          strokeColor: '#10B981', strokeWeight: 2,
          map: gmap, zIndex: 2, clickable: false,
        })
        objs.polygons.push(poly)
      }
    }
  }, [mapLoaded, spotsWithAircraft, obstacles, taxilanes, apronBoundaries, allResults, showClearances, apronContext, visibleLayers])

  // ── Layer 2: Aircraft silhouette markers (separate from geometry) ──
  // Uses incremental updates: reuses existing markers when only positions change (e.g. drag),
  // only does full rebuild when aircraft are added/removed/heading changed.
  const renderCancelRef = useRef(0)
  // Track what's currently rendered to detect position-only changes
  const renderedSpotsRef = useRef<Map<string, { lat: number; lng: number; heading: number; name: string }>>(new Map())

  useEffect(() => {
    const w = map.current
    if (!w || !mapLoaded) return
    const gmap = w.gmap

    if (!visibleLayers.aircraft) {
      spotMarkersMapRef.current.forEach(m => m.setMap(null))
      spotMarkersMapRef.current.clear()
      spotMetaRef.current.clear()
      noseGearMarkersRef.current.forEach(m => m.setMap(null))
      noseGearMarkersRef.current = []
      renderedSpotsRef.current.clear()
      for (const key of Array.from(w.featureIndex.keys())) {
        if (key.startsWith('spot-')) w.featureIndex.delete(key)
      }
      return
    }

    // Detect position-only update
    const prevRendered = renderedSpotsRef.current
    const isPositionOnlyUpdate = spotsWithAircraft.length === prevRendered.size &&
      spotsWithAircraft.every(s => {
        const prev = prevRendered.get(s.id)
        return prev && prev.heading === (s.heading_deg || 0) && prev.name === (s.aircraft_name || '')
      })

    if (isPositionOnlyUpdate && spotMarkersMapRef.current.size > 0) {
      for (const spot of spotsWithAircraft) {
        const c = spotCenter(spot)
        const marker = spotMarkersMapRef.current.get(spot.id)
        if (marker) marker.setPosition({ lat: c.lat, lng: c.lon })
        w.featureIndex.set(`spot-${spot.id}`, { lat: c.lat, lng: c.lon, type: 'aircraft', props: { spotId: spot.id, heading: spot.heading_deg } })
      }
      const spotsWithNoseGear = spotsWithAircraft.filter(s => s.pivot_point_ft > 0)
      spotsWithNoseGear.forEach((spot, i) => {
        if (noseGearMarkersRef.current[i]) noseGearMarkersRef.current[i].setPosition({ lat: spot.latitude, lng: spot.longitude })
      })
      for (const s of spotsWithAircraft) {
        renderedSpotsRef.current.set(s.id, { lat: s.latitude, lng: s.longitude, heading: s.heading_deg || 0, name: s.aircraft_name || '' })
      }
      return
    }

    // Full rebuild
    const renderToken = ++renderCancelRef.current
    spotMarkersMapRef.current.forEach(m => m.setMap(null))
    spotMarkersMapRef.current.clear()
    spotMetaRef.current.clear()
    noseGearMarkersRef.current.forEach(m => m.setMap(null))
    noseGearMarkersRef.current = []
    renderedSpotsRef.current.clear()
    for (const key of Array.from(w.featureIndex.keys())) {
      if (key.startsWith('spot-')) w.featureIndex.delete(key)
    }

    const renderAircraft = async () => {
      for (const spot of spotsWithAircraft) {
        if (renderCancelRef.current !== renderToken) return
        const c = spotCenter(spot)
        const heading = spot.heading_deg || 0
        const cacheKey = `${spot.id}-${heading}`

        // Use computeIconScale — same formula that worked in Mapbox
        const iconScale = computeIconScale(spot.wingspan_ft, spot.length_ft, gmap)

        // Get or create cached rotated image
        let cached = silhouetteCacheRef.current.get(cacheKey)
        if (!cached) {
          const result = await renderSilhouetteImage(spot.aircraft_name || '', spot.wingspan_ft, spot.length_ft)
          const imgData = result || renderFallbackIcon()

          const canvas = document.createElement('canvas')
          canvas.width = imgData.width
          canvas.height = imgData.height
          const ctx = canvas.getContext('2d')!
          ctx.putImageData(imgData.imageData, 0, 0)
          const dataUrl = canvas.toDataURL('image/png')

          const fixedDim = Math.max(imgData.width, imgData.height) + 16
          const rotCanvas = document.createElement('canvas')
          rotCanvas.width = fixedDim
          rotCanvas.height = fixedDim
          const rotCtx = rotCanvas.getContext('2d')!
          rotCtx.translate(fixedDim / 2, fixedDim / 2)
          rotCtx.rotate(heading * Math.PI / 180)
          const img = new Image()
          img.src = dataUrl
          await new Promise<void>(resolve => { img.onload = () => resolve(); img.onerror = () => resolve() })
          rotCtx.drawImage(img, -imgData.width / 2, -imgData.height / 2, imgData.width, imgData.height)

          cached = { url: rotCanvas.toDataURL('image/png'), fixedDim, heading }
          silhouetteCacheRef.current.set(cacheKey, cached)
        }

        if (renderCancelRef.current !== renderToken) return

        // displayDim = fixedDim * iconScale (iconScale is targetPx / imageWidthPx from computeIconScale)
        const displayDim = Math.min(800, Math.max(8, Math.round(cached.fixedDim * iconScale)))
        const marker = new google.maps.Marker({
          position: { lat: c.lat, lng: c.lon },
          map: gmap,
          icon: {
            url: cached.url,
            scaledSize: new google.maps.Size(displayDim, displayDim),
            anchor: new google.maps.Point(displayDim / 2, displayDim / 2),
          } as google.maps.Icon,
          zIndex: 10,
          label: {
            text: `${spot.aircraft_name || 'Aircraft'}${spot.tail_number ? '\n' + spot.tail_number : ''}`,
            color: '#FFFFFF',
            fontSize: '11px',
            fontWeight: 'bold',
            className: 'parking-ac-label',
          },
        })
        spotMarkersMapRef.current.set(spot.id, marker)
        spotMetaRef.current.set(spot.id, { fixedDim: cached.fixedDim, wingspanFt: spot.wingspan_ft, lengthFt: spot.length_ft, cacheKey })
        w.featureIndex.set(`spot-${spot.id}`, { lat: c.lat, lng: c.lon, type: 'aircraft', props: { spotId: spot.id, heading: spot.heading_deg } })
        renderedSpotsRef.current.set(spot.id, { lat: spot.latitude, lng: spot.longitude, heading, name: spot.aircraft_name || '' })
      }

      // Nose gear markers
      if (renderCancelRef.current !== renderToken) return
      for (const spot of spotsWithAircraft.filter(s => s.pivot_point_ft > 0)) {
        const marker = new google.maps.Marker({
          position: { lat: spot.latitude, lng: spot.longitude },
          map: gmap,
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 5, fillColor: '#FFD700', fillOpacity: 1, strokeColor: '#000', strokeWeight: 1.5 },
          zIndex: 9,
        })
        noseGearMarkersRef.current.push(marker)
      }
    }
    renderAircraft()
  }, [mapLoaded, spotsWithAircraft, visibleLayers.aircraft])

  // ── Layer 3: Zoom rescaling — fires on 'idle' (after zoom animation settles),
  // not on 'zoom_changed' (which fires during animation and causes flicker).
  useEffect(() => {
    const w = map.current
    if (!w || !mapLoaded) return
    const gmap = w.gmap
    let lastZoom = gmap.getZoom() ?? 15

    const onIdle = () => {
      const zoom = gmap.getZoom() ?? 15
      if (zoom === lastZoom) return // pan-only — no rescale needed
      lastZoom = zoom

      spotMetaRef.current.forEach((meta, spotId) => {
        const marker = spotMarkersMapRef.current.get(spotId)
        if (!marker) return
        const cached = silhouetteCacheRef.current.get(meta.cacheKey)
        if (!cached) return

        const iconScale = computeIconScale(meta.wingspanFt, meta.lengthFt, gmap)
        const displayDim = Math.min(800, Math.max(8, Math.round(meta.fixedDim * iconScale)))

        marker.setIcon({
          url: cached.url,
          scaledSize: new google.maps.Size(displayDim, displayDim),
          anchor: new google.maps.Point(displayDim / 2, displayDim / 2),
        } as google.maps.Icon)
      })
    }

    const listener = gmap.addListener('idle', onIdle)
    return () => { google.maps.event.removeListener(listener) }
  }, [mapLoaded])

  // ── Layer 4: Selection rings (single editingSpot + multi-select) ──
  const multiRingsRef = useRef<google.maps.Circle[]>([])
  useEffect(() => {
    // Clean up previous rings
    if (selectionRingRef.current) {
      selectionRingRef.current.setMap(null)
      selectionRingRef.current = null
    }
    multiRingsRef.current.forEach(c => c.setMap(null))
    multiRingsRef.current = []

    const w = map.current
    if (!w || !mapLoaded) return

    // Build highlighted id set
    const highlighted = new Set<string>(selectedSpotIds)
    if (editingSpot) highlighted.add(editingSpot.id)

    // Update marker opacity
    spotMarkersMapRef.current.forEach((marker, spotId) => {
      const isHi = highlighted.has(spotId)
      marker.setOpacity(isHi ? 0.5 : 1)
      marker.setZIndex(isHi ? 20 : 10)
    })

    if (highlighted.size === 0) return

    // Render single cyan ring for editingSpot (primary)
    if (editingSpot) {
      const spot = spotsWithAircraft.find(s => s.id === editingSpot.id)
      if (spot) {
        const c = spotCenter(spot)
        const wingspanM = spot.wingspan_ft * FT_TO_M
        selectionRingRef.current = new google.maps.Circle({
          center: { lat: c.lat, lng: c.lon },
          radius: wingspanM / 2 + 5,
          map: w.gmap,
          fillColor: 'transparent', fillOpacity: 0,
          strokeColor: '#22D3EE', strokeWeight: 3,
          clickable: false, zIndex: 15,
        })
      }
    }

    // Render purple rings for multi-select members
    for (const sid of Array.from(selectedSpotIds)) {
      if (editingSpot && sid === editingSpot.id) continue
      const spot = spotsWithAircraft.find(s => s.id === sid)
      if (!spot) continue
      const c = spotCenter(spot)
      const wingspanM = spot.wingspan_ft * FT_TO_M
      const ring = new google.maps.Circle({
        center: { lat: c.lat, lng: c.lon },
        radius: wingspanM / 2 + 5,
        map: w.gmap,
        fillColor: 'transparent', fillOpacity: 0,
        strokeColor: '#A855F7', strokeWeight: 3,
        clickable: false, zIndex: 15,
      })
      multiRingsRef.current.push(ring)
    }

    return () => {
      spotMarkersMapRef.current.forEach(marker => {
        marker.setOpacity(1)
        marker.setZIndex(10)
      })
    }
  }, [mapLoaded, editingSpot, selectedSpotIds, spotsWithAircraft])

  // ── Aircraft + Obstacle drag interaction ──
  // Uses refs to avoid re-registering listeners on every data change.
  // Uses pixelToLatLng from adapter for coordinate conversion.

  useEffect(() => {
    const w = map.current
    if (!w || !mapLoaded) return
    const gmap = w.gmap
    const mapDiv = gmap.getDiv()

    const toLatLng = (x: number, y: number): { lat: number; lng: number } | null => {
      return pixelToLatLng(w, x, y)
    }

    // Throttle drag label updates — labels are expensive to create/destroy on every move frame
    let lastLabelUpdate = 0
    const LABEL_THROTTLE_MS = 80

    const onMouseDown = (clickLat: number, clickLng: number, clientX: number, clientY: number, preventDefault: () => void, shiftKey: boolean = false) => {
      if (isPlacingRef.current) return
      dragStartPt.current = { x: clientX, y: clientY }

      // Check aircraft via spatial index
      const acHit = queryFeatureAtPoint(w, clickLat, clickLng, 15)
      if (acHit && acHit.type === 'aircraft') {
        const spotId = acHit.props.spotId
        const spot = spotsWithAircraftRef.current.find(s => s.id === spotId)
        if (spot) {
          if (shiftKey) {
            // Toggle spot in multi-select; add current editingSpot if leaving single mode
            setSelectedSpotIds(prev => {
              const next = new Set(prev)
              const currentEditing = editingSpotRef.current
              if (next.size === 0 && currentEditing && currentEditing.id !== spotId) {
                next.add(currentEditing.id)
              }
              if (next.has(spotId)) next.delete(spotId)
              else next.add(spotId)
              return next
            })
            setEditingSpot(null)
            setOpenSections(prev => ({ ...prev, aircraft: true }))
            setSidebarTab('aircraft')
            preventDefault()
            return
          }
          // Plain click: if spot is in multi-select, start group drag; else single select
          const isInSelection = selectedSpotIdsRef.current.has(spotId)
          if (!isInSelection) {
            setSelectedSpotIds(new Set())
            setEditingSpot(spot)
          }
          setOpenSections(prev => ({ ...prev, aircraft: true }))
          setSidebarTab('aircraft')
        }
        if (!planLockedRef.current && spot && !shiftKey) {
          dragOffsetRef.current = { dLng: spot.longitude - clickLng, dLat: spot.latitude - clickLat }
          isDraggingRef.current = true
          dragSpotId.current = spotId
          dragObstacleId.current = null
          mapDiv.style.cursor = 'grabbing'
          gmap.setOptions({ draggable: false })
          // If spot is part of multi-select, snapshot all selected positions for group drag
          groupDragStartRef.current.clear()
          if (selectedSpotIdsRef.current.has(spotId)) {
            Array.from(selectedSpotIdsRef.current).forEach(sid => {
              const s = spotsWithAircraftRef.current.find(x => x.id === sid)
              if (s) groupDragStartRef.current.set(sid, { lng: s.longitude, lat: s.latitude })
            })
          }
          preventDefault()
        }
        return
      }

      // Clicked empty map: clear multi-select (unless shift held or box-select active)
      if (!shiftKey && !boxSelectActiveRef.current && selectedSpotIdsRef.current.size > 0) {
        setSelectedSpotIds(new Set())
      }

      // Check obstacles via spatial index
      if (obstaclesLockedRef.current) return
      const obsHit = queryFeatureAtPoint(w, clickLat, clickLng, 15)
      if (obsHit && obsHit.type === 'obstacle') {
        const matchObs = obstaclesRef.current.find(o => o.id === obsHit.props.obsId)
        if (matchObs) {
          dragOffsetRef.current = { dLng: matchObs.longitude - clickLng, dLat: matchObs.latitude - clickLat }
          isDraggingRef.current = true
          dragObstacleId.current = matchObs.id
          dragSpotId.current = null
          mapDiv.style.cursor = 'grabbing'
          gmap.setOptions({ draggable: false })
          preventDefault()
        }
      }
    }

    const onMouseMove = (moveLat: number, moveLng: number) => {
      // Freeform obstacle drawing
      if (drawingObsTypeRef.current && drawingObsStartRef.current) {
        setDrawingObsCurrent([moveLng, moveLat])
        return
      }
      if (!isDraggingRef.current) return

      const lng = moveLng + dragOffsetRef.current.dLng
      const lat = moveLat + dragOffsetRef.current.dLat

      // Move the dragged marker(s) visually
      if (dragSpotId.current) {
        const primarySpot = spotsWithAircraftRef.current.find(s => s.id === dragSpotId.current)
        const isGroupDrag = groupDragStartRef.current.size > 1 && primarySpot && groupDragStartRef.current.has(primarySpot.id)
        if (isGroupDrag && primarySpot) {
          const startPrimary = groupDragStartRef.current.get(primarySpot.id)!
          const dLng = lng - startPrimary.lng
          const dLat = lat - startPrimary.lat
          groupDragStartRef.current.forEach((start, sid) => {
            const marker = spotMarkersMapRef.current.get(sid)
            const s = spotsWithAircraftRef.current.find(x => x.id === sid)
            if (marker && s) {
              const nLng = start.lng + dLng
              const nLat = start.lat + dLat
              const c = getAircraftCenter(nLng, nLat, s.heading_deg, s.length_ft, s.pivot_point_ft)
              marker.setPosition({ lat: c.lat, lng: c.lon })
            }
          })
        } else {
          const marker = spotMarkersMapRef.current.get(dragSpotId.current)
          if (marker) {
            if (primarySpot) {
              const c = getAircraftCenter(lng, lat, primarySpot.heading_deg, primarySpot.length_ft, primarySpot.pivot_point_ft)
              marker.setPosition({ lat: c.lat, lng: c.lon })
            } else {
              marker.setPosition({ lat, lng })
            }
          }
        }
      }

      // Throttle drag label updates — marker position is already updated above
      const now = Date.now()
      if (now - lastLabelUpdate < LABEL_THROTTLE_MS) return
      lastLabelUpdate = now

      // Clear old drag labels and lines
      dragLabelMarkersRef.current.forEach(m => m.setMap(null))
      dragLabelMarkersRef.current = []
      dragLineRef.current.forEach(l => l.setMap(null))
      dragLineRef.current = []

      // Show clearance distance labels + connecting lines during aircraft drag
      if (dragSpotId.current && map.current) {
        const sid = dragSpotId.current
        const draggedSpot = spotsWithAircraftRef.current.find(s => s.id === sid)
        if (draggedSpot) {
          const movedSpot = { ...draggedSpot, longitude: lng, latitude: lat }

          const addLabel = (otherLat: number, otherLng: number, text: string, color: string) => {
            // Connecting line
            const line = new google.maps.Polyline({
              path: [{ lat, lng }, { lat: otherLat, lng: otherLng }],
              strokeColor: color, strokeWeight: 1.5, strokeOpacity: 0.6,
              map: gmap, clickable: false, zIndex: 9998,
            })
            dragLineRef.current.push(line)

            // Distance label at midpoint with dark background for readability
            const lbl = new google.maps.Marker({
              position: { lat: (lat + otherLat) / 2, lng: (lng + otherLng) / 2 },
              map: gmap,
              label: { text, color: '#FFFFFF', fontWeight: 'bold', fontSize: '12px', className: 'parking-drag-label' },
              icon: {
                path: 'M -30,-10 L 30,-10 L 30,10 L -30,10 Z',
                fillColor: color === '#22C55E' ? 'rgba(0,80,0,0.85)' : color === '#F59E0B' ? 'rgba(120,80,0,0.85)' : 'rgba(120,0,0,0.85)',
                fillOpacity: 1, strokeColor: color, strokeWeight: 1.5, scale: 0.6,
                anchor: new google.maps.Point(0, 0),
              },
              clickable: false, zIndex: 9999,
            })
            dragLabelMarkersRef.current.push(lbl)
          }

          // Check distances to other aircraft
          for (const other of spotsWithAircraftRef.current) {
            if (other.id === sid) continue
            const dx = (lng - other.longitude) * 364567 * Math.cos(lat * Math.PI / 180)
            const dy = (lat - other.latitude) * 364567
            if (Math.sqrt(dx * dx + dy * dy) > 500) continue
            const result = getAllClearanceResults([movedSpot, other], [], apronContextRef.current)
            if (result.length > 0) {
              const r = result[0]
              const color = r.status === 'violation' ? '#EF4444' : r.status === 'warning' ? '#F59E0B' : '#22C55E'
              addLabel(other.latitude, other.longitude, `${r.distance_ft.toFixed(0)}/${r.required_ft}ft`, color)
            }
          }

          // Check distances to obstacles
          for (const obs of obstaclesRef.current) {
            const dx = (lng - obs.longitude) * 364567 * Math.cos(lat * Math.PI / 180)
            const dy = (lat - obs.latitude) * 364567
            if (Math.sqrt(dx * dx + dy * dy) > 500) continue
            const result = getAllClearanceResults([movedSpot], [obs], apronContextRef.current)
            if (result.length > 0) {
              const r2 = result[0]
              const color = r2.status === 'violation' ? '#EF4444' : r2.status === 'warning' ? '#F59E0B' : '#22C55E'
              addLabel(obs.latitude, obs.longitude, `${r2.distance_ft.toFixed(0)}/${r2.required_ft}ft`, color)
            }
          }
        }
      }

      mapDiv.style.cursor = 'grabbing'
    }

    const onMouseUp = async (upLat: number, upLng: number) => {
      // Clean up drag labels and lines
      dragLabelMarkersRef.current.forEach(m => m.setMap(null))
      dragLabelMarkersRef.current = []
      dragLineRef.current.forEach(l => l.setMap(null))
      dragLineRef.current = []

      if (!isDraggingRef.current) return

      const lng = upLng + dragOffsetRef.current.dLng
      const lat = upLat + dragOffsetRef.current.dLat

      if (dragSpotId.current) {
        const sid = dragSpotId.current
        isDraggingRef.current = false
        dragSpotId.current = null
        gmap.setOptions({ draggable: true })
        mapDiv.style.cursor = ''
        const groupSnapshot = groupDragStartRef.current
        const isGroupDrag = groupSnapshot.size > 1 && groupSnapshot.has(sid)
        if (isGroupDrag) {
          const startPrimary = groupSnapshot.get(sid)!
          const dLng = lng - startPrimary.lng
          const dLat = lat - startPrimary.lat
          const updates: { id: string; longitude: number; latitude: number; heading_deg: number }[] = []
          setSpots(prev => prev.map(s => {
            const start = groupSnapshot.get(s.id)
            if (!start) return s
            const nLng = start.lng + dLng
            const nLat = start.lat + dLat
            updates.push({ id: s.id, longitude: nLng, latitude: nLat, heading_deg: s.heading_deg })
            return { ...s, longitude: nLng, latitude: nLat }
          }))
          groupDragStartRef.current = new Map()
          await bulkUpdateSpotPositions(updates)
          return
        }
        groupDragStartRef.current = new Map()
        setSpots(prev => prev.map(s => s.id === sid ? { ...s, longitude: lng, latitude: lat } : s))
        await updateParkingSpot(sid, { longitude: lng, latitude: lat })
        return
      }

      if (dragObstacleId.current) {
        const oid = dragObstacleId.current
        isDraggingRef.current = false
        dragObstacleId.current = null
        gmap.setOptions({ draggable: true })
        mapDiv.style.cursor = ''

        const obs = obstaclesRef.current.find(o => o.id === oid)
        if (obs) {
          const updates: Partial<ParkingObstacle> = { longitude: lng, latitude: lat }
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

    // Mouse events on the map div
    const onCanvasMouseDown = (ev: MouseEvent) => {
      // Ctrl+click → context menu (replaces right-click which Google Maps intercepts)
      if (ev.button === 0 && (ev.ctrlKey || ev.metaKey)) {
        ev.preventDefault()
        ev.stopPropagation()
        const rect = mapDiv.getBoundingClientRect()
        const pos = toLatLng(ev.clientX - rect.left, ev.clientY - rect.top)
        if (!pos) return
        const acHit = queryFeatureAtPoint(w, pos.lat, pos.lng, 15)
        if (acHit && acHit.type === 'aircraft') {
          const spot = spotsWithAircraftRef.current.find(s => s.id === acHit.props.spotId)
          if (spot) {
            setContextMenuSpot({ spot, x: ev.clientX, y: ev.clientY })
            setEditingSpot(spot)
          }
        }
        return
      }
      if (ev.button !== 0) return
      const rect = mapDiv.getBoundingClientRect()
      const pos = toLatLng(ev.clientX - rect.left, ev.clientY - rect.top)
      if (!pos) return
      onMouseDown(pos.lat, pos.lng, ev.clientX, ev.clientY, () => ev.preventDefault(), ev.shiftKey)
    }

    const onCanvasMouseMove = (ev: MouseEvent) => {
      const rect = mapDiv.getBoundingClientRect()
      const pos = toLatLng(ev.clientX - rect.left, ev.clientY - rect.top)
      if (!pos) return
      onMouseMove(pos.lat, pos.lng)
    }

    const onCanvasMouseUp = (ev: MouseEvent) => {
      const rect = mapDiv.getBoundingClientRect()
      const pos = toLatLng(ev.clientX - rect.left, ev.clientY - rect.top)
      if (!pos) return
      onMouseUp(pos.lat, pos.lng)
    }

    // Touch events
    const onCanvasTouchStart = (ev: TouchEvent) => {
      if (ev.touches.length !== 1) return
      const touch = ev.touches[0]
      const rect = mapDiv.getBoundingClientRect()
      const pos = toLatLng(touch.clientX - rect.left, touch.clientY - rect.top)
      if (!pos) return

      // Long-press detection for context menu
      if (contextMenuTimerRef.current) clearTimeout(contextMenuTimerRef.current)
      contextMenuTimerRef.current = setTimeout(() => {
        const acHit = queryFeatureAtPoint(w, pos.lat, pos.lng, 15)
        if (acHit && acHit.type === 'aircraft') {
          const spotId = acHit.props.spotId
          const spot = spotsWithAircraftRef.current.find(s => s.id === spotId)
          if (spot) {
            setContextMenuSpot({ spot, x: touch.clientX, y: touch.clientY })
            setEditingSpot(spot)
          }
        }
      }, 500)

      onMouseDown(pos.lat, pos.lng, touch.clientX, touch.clientY, () => ev.preventDefault())
    }
    const onTouchMove = (ev: TouchEvent) => {
      if (contextMenuTimerRef.current) { clearTimeout(contextMenuTimerRef.current); contextMenuTimerRef.current = null }
      if (!isDraggingRef.current || ev.touches.length !== 1) return
      ev.preventDefault()
      const touch = ev.touches[0]
      const rect = mapDiv.getBoundingClientRect()
      const pos = toLatLng(touch.clientX - rect.left, touch.clientY - rect.top)
      if (!pos) return
      onMouseMove(pos.lat, pos.lng)
    }
    const onTouchEnd = (ev: TouchEvent) => {
      if (!isDraggingRef.current) return
      const touch = ev.changedTouches[0]
      const rect = mapDiv.getBoundingClientRect()
      const pos = toLatLng(touch.clientX - rect.left, touch.clientY - rect.top)
      if (!pos) return
      onMouseUp(pos.lat, pos.lng)
    }

    mapDiv.addEventListener('mousedown', onCanvasMouseDown)
    mapDiv.addEventListener('mousemove', onCanvasMouseMove)
    mapDiv.addEventListener('mouseup', onCanvasMouseUp)
    mapDiv.addEventListener('touchstart', onCanvasTouchStart, { passive: false })
    mapDiv.addEventListener('touchmove', onTouchMove, { passive: false })
    mapDiv.addEventListener('touchend', onTouchEnd)

    return () => {
      mapDiv.removeEventListener('mousedown', onCanvasMouseDown)
      mapDiv.removeEventListener('mousemove', onCanvasMouseMove)
      mapDiv.removeEventListener('mouseup', onCanvasMouseUp)
      mapDiv.removeEventListener('touchstart', onCanvasTouchStart)
      mapDiv.removeEventListener('touchmove', onTouchMove)
      mapDiv.removeEventListener('touchend', onTouchEnd)
    }
  }, [mapLoaded]) // Only re-register on map load — refs handle current data

  // ── Keyboard shortcuts: arrow nudge + spacebar fullscreen + ESC box-select ──
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignore if typing in an input/select/textarea
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      // ESC: toggle box-select mode (or cancel multi-selection)
      if (e.key === 'Escape') {
        e.preventDefault()
        if (boxSelectActive) {
          setBoxSelectActive(false)
        } else if (selectedSpotIds.size > 0) {
          setSelectedSpotIds(new Set())
        } else {
          setBoxSelectActive(true)
          toast.success('Box-select: drag to select aircraft. ESC to cancel.')
        }
        return
      }

      // Spacebar toggles fullscreen
      if (e.key === ' ') {
        e.preventDefault()
        setIsFullscreen(f => !f)
        return
      }

      // Delete / Backspace: remove all selected spots
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedSpotIds.size > 0) {
        e.preventDefault()
        if (!confirm(`Remove ${selectedSpotIds.size} aircraft?`)) return
        for (const sid of Array.from(selectedSpotIds)) {
          await handleDeleteSpot(sid)
        }
        setSelectedSpotIds(new Set())
        return
      }

      if (!editingSpot) return
      const arrows: Record<string, number> = { ArrowUp: 0, ArrowRight: 90, ArrowDown: 180, ArrowLeft: 270 }
      const bearing = arrows[e.key]
      if (bearing === undefined) return
      e.preventDefault()
      const dist = e.shiftKey ? 5 : 1 // feet
      const pt = offsetPoint({ lat: editingSpot.latitude, lon: editingSpot.longitude }, bearing, dist)
      const updated = { ...editingSpot, longitude: pt.lon, latitude: pt.lat }
      setEditingSpot(updated)
      setSpots(prev => prev.map(s => s.id === updated.id ? { ...s, longitude: pt.lon, latitude: pt.lat } : s))
      await updateParkingSpot(updated.id, { longitude: pt.lon, latitude: pt.lat })
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editingSpot, boxSelectActive, selectedSpotIds])

  // ── Taxilane point editing: vertex + midpoint drag/insert markers ──
  useEffect(() => {
    const w = map.current
    if (!w || !mapLoaded) return
    // Clear prior markers
    vertexMarkersRef.current.forEach(m => m.setMap(null))
    vertexMarkersRef.current = []
    midpointMarkersRef.current.forEach(m => m.setMap(null))
    midpointMarkersRef.current = []
    if (!editingTaxilanePoints || !editingTaxilane) return
    const tl = taxilanes.find(t => t.id === editingTaxilane.id)
    if (!tl || !tl.line_coords || tl.line_coords.length < 2) return
    const gmap = w.gmap

    const persist = async (newCoords: [number, number][]) => {
      setTaxilanes(prev => prev.map(x => x.id === tl.id ? { ...x, line_coords: newCoords } : x))
      setEditingTaxilane(prev => prev && prev.id === tl.id ? { ...prev, line_coords: newCoords } : prev)
      await updateParkingTaxilane(tl.id, { line_coords: newCoords })
    }

    // Vertex markers — draggable, shift+click to delete
    tl.line_coords.forEach((pt, idx) => {
      const marker = new google.maps.Marker({
        position: { lat: pt[1], lng: pt[0] },
        map: gmap,
        draggable: true,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: '#3B82F6',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
        zIndex: 100,
        title: `Vertex ${idx + 1} — drag to move, shift+click to delete`,
      })
      marker.addListener('click', (ev: google.maps.MapMouseEvent & { domEvent?: MouseEvent }) => {
        const shift = (ev.domEvent as MouseEvent | undefined)?.shiftKey
        if (!shift) return
        const current = taxilanes.find(t => t.id === tl.id)
        if (!current || !current.line_coords || current.line_coords.length <= 2) {
          toast.error('Taxilane must have at least 2 points')
          return
        }
        const next = current.line_coords.filter((_, i) => i !== idx)
        persist(next)
      })
      marker.addListener('dragend', () => {
        const pos = marker.getPosition()
        if (!pos) return
        const current = taxilanes.find(t => t.id === tl.id)
        if (!current) return
        const next = current.line_coords.map((c, i) => i === idx ? [pos.lng(), pos.lat()] as [number, number] : c)
        persist(next)
      })
      vertexMarkersRef.current.push(marker)
    })

    // Midpoint markers — click to insert new vertex
    for (let i = 0; i < tl.line_coords.length - 1; i++) {
      const a = tl.line_coords[i]
      const b = tl.line_coords[i + 1]
      const midLng = (a[0] + b[0]) / 2
      const midLat = (a[1] + b[1]) / 2
      const marker = new google.maps.Marker({
        position: { lat: midLat, lng: midLng },
        map: gmap,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 4,
          fillColor: '#FFFFFF',
          fillOpacity: 0.8,
          strokeColor: '#3B82F6',
          strokeWeight: 2,
        },
        zIndex: 99,
        title: 'Click to insert vertex',
      })
      const insertIdx = i + 1
      marker.addListener('click', () => {
        const current = taxilanes.find(t => t.id === tl.id)
        if (!current) return
        const next = [...current.line_coords]
        next.splice(insertIdx, 0, [midLng, midLat])
        persist(next)
      })
      midpointMarkersRef.current.push(marker)
    }

    return () => {
      vertexMarkersRef.current.forEach(m => m.setMap(null))
      vertexMarkersRef.current = []
      midpointMarkersRef.current.forEach(m => m.setMap(null))
      midpointMarkersRef.current = []
    }
  }, [editingTaxilanePoints, editingTaxilane, taxilanes, mapLoaded])

  // Exit taxilane-points mode when the selected taxilane is cleared
  useEffect(() => {
    if (!editingTaxilane && editingTaxilanePoints) setEditingTaxilanePoints(false)
  }, [editingTaxilane, editingTaxilanePoints])

  // ── Box-select: drag rectangle on map to select aircraft ──
  useEffect(() => {
    if (!boxSelectActive || !mapLoaded) return
    const w = map.current
    if (!w) return
    const gmap = w.gmap
    const mapDiv = gmap.getDiv()

    // Disable map pan while boxing
    gmap.setOptions({ draggable: false, gestureHandling: 'none' })
    mapDiv.style.cursor = 'crosshair'

    let boxDiv: HTMLDivElement | null = null
    let startX = 0, startY = 0
    let active = false

    const onDown = (ev: MouseEvent) => {
      if (ev.button !== 0) return
      ev.preventDefault()
      ev.stopPropagation()
      const rect = mapDiv.getBoundingClientRect()
      startX = ev.clientX - rect.left
      startY = ev.clientY - rect.top
      active = true
      boxDiv = document.createElement('div')
      boxDiv.style.cssText = `position:absolute;left:${startX}px;top:${startY}px;width:0;height:0;border:2px dashed var(--color-purple);background:color-mix(in srgb, var(--color-purple) 10%, transparent);pointer-events:none;z-index:9999;`
      mapDiv.appendChild(boxDiv)
    }

    const onMove = (ev: MouseEvent) => {
      if (!active || !boxDiv) return
      const rect = mapDiv.getBoundingClientRect()
      const x = ev.clientX - rect.left
      const y = ev.clientY - rect.top
      const left = Math.min(startX, x)
      const top = Math.min(startY, y)
      const width = Math.abs(x - startX)
      const height = Math.abs(y - startY)
      boxDiv.style.left = `${left}px`
      boxDiv.style.top = `${top}px`
      boxDiv.style.width = `${width}px`
      boxDiv.style.height = `${height}px`
    }

    const onUp = (ev: MouseEvent) => {
      if (!active) return
      active = false
      const rect = mapDiv.getBoundingClientRect()
      const endX = ev.clientX - rect.left
      const endY = ev.clientY - rect.top
      if (boxDiv) { boxDiv.remove(); boxDiv = null }

      // Convert corners to lat/lng
      const p1 = pixelToLatLng(w, Math.min(startX, endX), Math.min(startY, endY))
      const p2 = pixelToLatLng(w, Math.max(startX, endX), Math.max(startY, endY))
      if (!p1 || !p2) return

      const bounds = new google.maps.LatLngBounds(
        { lat: Math.min(p1.lat, p2.lat), lng: Math.min(p1.lng, p2.lng) },
        { lat: Math.max(p1.lat, p2.lat), lng: Math.max(p1.lng, p2.lng) },
      )

      const hits = new Set<string>()
      for (const spot of spotsWithAircraftRef.current) {
        const c = spotCenter(spot)
        if (bounds.contains({ lat: c.lat, lng: c.lon })) hits.add(spot.id)
      }

      if (hits.size === 0) {
        toast.info('No aircraft in selection')
      } else {
        setSelectedSpotIds(prev => {
          const next = new Set(prev)
          hits.forEach(id => next.add(id))
          return next
        })
        setEditingSpot(null)
        toast.success(`Selected ${hits.size} aircraft`)
      }
      setBoxSelectActive(false)
    }

    mapDiv.addEventListener('mousedown', onDown, true)
    mapDiv.addEventListener('mousemove', onMove, true)
    mapDiv.addEventListener('mouseup', onUp, true)

    return () => {
      mapDiv.removeEventListener('mousedown', onDown, true)
      mapDiv.removeEventListener('mousemove', onMove, true)
      mapDiv.removeEventListener('mouseup', onUp, true)
      if (boxDiv) boxDiv.remove()
      gmap.setOptions({ draggable: true, gestureHandling: 'auto' })
      mapDiv.style.cursor = ''
    }
  }, [boxSelectActive, mapLoaded])

  // Resize map when sidebar collapses/expands or fullscreen toggles
  useEffect(() => {
    setTimeout(() => {
      if (map.current) {
        google.maps.event.trigger(map.current.gmap, 'resize')
      }
    }, 200)
  }, [isFullscreen])

  // ── Plan actions ──

  const handleCreatePlan = async () => {
    if (!installationId || !newPlanName.trim()) return
    const plan = await createParkingPlan({
      base_id: installationId,
      plan_name: newPlanName.trim(),
      description: newPlanDesc.trim() || undefined,
      is_template: newPlanIsTemplate || undefined,
    })
    if (plan) {
      setPlans(prev => [plan, ...prev])
      setSelectedPlanId(plan.id)
      setShowNewPlan(false)
      setNewPlanName('')
      setNewPlanDesc('')
      setNewPlanIsTemplate(false)
      toast.success(newPlanIsTemplate ? 'Template created' : 'Plan created')
    }
  }

  const handleDuplicatePlan = async () => {
    if (!selectedPlan || !installationId || !duplicateName.trim()) return
    const newPlan = await duplicateParkingPlan(
      selectedPlan.id,
      installationId,
      duplicateName.trim(),
      duplicateDesc.trim() || undefined,
      duplicateAsTemplate,
    )
    if (newPlan) {
      setPlans(prev => [newPlan, ...prev])
      setSelectedPlanId(newPlan.id)
      setShowDuplicateModal(false)
      setDuplicateName('')
      setDuplicateDesc('')
      setDuplicateAsTemplate(false)
      toast.success(`Duplicated "${selectedPlan.plan_name}" → "${newPlan.plan_name}"`)
    }
  }

  const handleToggleTemplate = async () => {
    if (!selectedPlan || !installationId) return
    const updated = await updateParkingPlan(selectedPlan.id, { is_template: !selectedPlan.is_template }, installationId)
    if (updated) {
      setPlans(prev => prev.map(p => p.id === updated.id ? updated : p))
      toast.success(updated.is_template ? 'Saved as template' : 'Converted to plan')
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

  // ── PDF export ──

  const buildParkingPdf = async () => {
    if (!selectedPlan) return null
    const w = map.current
    let mapDataUrl: string | null = null

    if (w) {
      // Temporarily resize map to landscape for a wider capture
      const gmap = w.gmap
      const mapDiv = gmap.getDiv()
      const parent = mapDiv.parentElement
      const origWidth = parent?.style.width || ''
      const origHeight = parent?.style.height || ''

      try {
        // Expand to 1600×900 for high-quality landscape capture
        if (parent) {
          parent.style.width = '1600px'
          parent.style.height = '900px'
        }
        google.maps.event.trigger(gmap, 'resize')
        // Wait for tiles to load at new size
        await new Promise<void>(resolve => {
          google.maps.event.addListenerOnce(gmap, 'idle', () => resolve())
          setTimeout(resolve, 3000) // fallback timeout
        })
        // Extra frame for rendering
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

        const html2canvas = (await import('html2canvas')).default
        const canvas = await html2canvas(mapDiv, {
          useCORS: true,
          allowTaint: true,
          backgroundColor: null,
          scale: 2,
          logging: false,
          width: mapDiv.clientWidth,
          height: mapDiv.clientHeight,
        })
        mapDataUrl = canvas.toDataURL('image/jpeg', 0.9)
      } catch (err) {
        console.warn('Map capture error:', err)
        toast.error('Map capture failed')
        mapDataUrl = null
      } finally {
        // Restore original size
        if (parent) {
          parent.style.width = origWidth
          parent.style.height = origHeight
        }
        google.maps.event.trigger(gmap, 'resize')
      }
    }

    return generateParkingPdf({
      plan: selectedPlan, spots, spotsWithAircraft,
      allResults, violations, warnings, apronContext, mapDataUrl,
      baseName: currentInstallation?.name, baseIcao: currentInstallation?.icao,
    })
  }

  const handleExportPdf = async () => {
    if (!selectedPlan) return
    setExportingPdf(true)
    try {
      const result = await buildParkingPdf()
      if (result) {
        result.doc.save(result.filename)
        toast.success('PDF exported')
      }
    } catch (err) {
      toast.error('Failed to export PDF')
      console.error(err)
    } finally {
      setExportingPdf(false)
    }
  }

  const handleEmailPdf = async () => {
    if (!selectedPlan) return
    setExportingPdf(true)
    try {
      const result = await buildParkingPdf()
      if (result) {
        setEmailPdfData(result)
        setEmailModalOpen(true)
      }
    } catch (err) {
      toast.error('Failed to generate PDF')
      console.error(err)
    } finally {
      setExportingPdf(false)
    }
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

  const handleDuplicateSpot = async (spot: ParkingSpot) => {
    if (!selectedPlanId) return
    // Offset 50ft to the right (east) so it doesn't stack exactly on top
    const offset = offsetPoint({ lat: spot.latitude, lon: spot.longitude }, 90, 50)
    const newSpot = await createParkingSpot({
      plan_id: selectedPlanId,
      base_id: installationId || '',
      aircraft_name: spot.aircraft_name || undefined,
      tail_number: spot.tail_number || undefined,
      unit_callsign: spot.unit_callsign || undefined,
      spot_name: spot.spot_name || undefined,
      heading_deg: spot.heading_deg,
      clearance_ft: spot.clearance_ft ?? undefined,
      status: spot.status,
      latitude: offset.lat,
      longitude: offset.lon,
    })
    if (newSpot) {
      setSpots(prev => [...prev, newSpot])
      toast.success(`Duplicated ${spot.aircraft_name || 'aircraft'}`)
    }
  }

  const toggleFavoriteAircraft = (name: string) => {
    setFavoriteAircraft(prev => {
      const next = prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
      localStorage.setItem('glidepath_fav_aircraft', JSON.stringify(next))
      return next
    })
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
    setDrawingLineObsId(null); setDrawingLinePoints([])
    setDrawingBoundaryId(null); setDrawingBoundaryPoints([])
    setDrawingObsType(null); setDrawingObsStart(null); setDrawingObsCurrent(null)
    // ruler removed in Google Maps version
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
    setDrawingLineObsId(null); setDrawingLinePoints([])
    setDrawingTaxilaneId(null); setDrawingTaxilanePoints([])
    setDrawingObsType(null); setDrawingObsStart(null); setDrawingObsCurrent(null)
    // ruler removed in Google Maps version
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

  // ── Render drawing line preview on Google Maps ──

  const drawingLineObjsRef = useRef<{ line: google.maps.Polyline | null; dots: google.maps.Marker[] }>({ line: null, dots: [] })

  useEffect(() => {
    const w = map.current
    if (!w || !mapLoaded) return
    const gmap = w.gmap

    // Clean previous
    drawingLineObjsRef.current.line?.setMap(null)
    drawingLineObjsRef.current.dots.forEach(m => m.setMap(null))
    drawingLineObjsRef.current = { line: null, dots: [] }

    if (drawingLinePoints.length >= 2) {
      drawingLineObjsRef.current.line = new google.maps.Polyline({
        path: drawingLinePoints.map(([lng, lat]) => ({ lat, lng })),
        strokeColor: '#F97316', strokeWeight: 3,
        map: gmap, zIndex: 20,
      })
    }
    for (const [lng, lat] of drawingLinePoints) {
      const dot = new google.maps.Marker({
        position: { lat, lng }, map: gmap,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 5, fillColor: '#F97316', fillOpacity: 1, strokeColor: '#FFF', strokeWeight: 1.5 },
        zIndex: 21,
      })
      drawingLineObjsRef.current.dots.push(dot)
    }
  }, [mapLoaded, drawingLinePoints])

  // ── Render taxilane/boundary drawing preview on Google Maps ──

  const drawingTlBdObjsRef = useRef<{ lines: google.maps.Polyline[]; polygons: google.maps.Polygon[]; dots: google.maps.Marker[] }>({ lines: [], polygons: [], dots: [] })

  useEffect(() => {
    const w = map.current
    if (!w || !mapLoaded) return
    const gmap = w.gmap

    // Clean previous
    drawingTlBdObjsRef.current.lines.forEach(l => l.setMap(null))
    drawingTlBdObjsRef.current.polygons.forEach(p => p.setMap(null))
    drawingTlBdObjsRef.current.dots.forEach(m => m.setMap(null))
    drawingTlBdObjsRef.current = { lines: [], polygons: [], dots: [] }
    const objs = drawingTlBdObjsRef.current

    const tlColor = drawingTaxilaneType === 'peripheral' ? '#8B5CF6' : '#3B82F6'

    // Taxilane drawing preview
    if (drawingTaxilanePoints.length >= 2) {
      objs.lines.push(new google.maps.Polyline({
        path: drawingTaxilanePoints.map(([lng, lat]) => ({ lat, lng })),
        strokeColor: tlColor, strokeWeight: 3,
        map: gmap, zIndex: 20,
      }))
    }
    for (const [lng, lat] of drawingTaxilanePoints) {
      objs.dots.push(new google.maps.Marker({
        position: { lat, lng }, map: gmap,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 5, fillColor: tlColor, fillOpacity: 1, strokeColor: '#FFF', strokeWeight: 1.5 },
        zIndex: 21,
      }))
    }

    // Boundary drawing preview
    if (drawingBoundaryPoints.length >= 3) {
      objs.polygons.push(new google.maps.Polygon({
        paths: drawingBoundaryPoints.map(([lng, lat]) => ({ lat, lng })),
        fillColor: '#10B981', fillOpacity: 0.15,
        strokeColor: '#10B981', strokeWeight: 2,
        map: gmap, zIndex: 20,
      }))
    } else if (drawingBoundaryPoints.length >= 2) {
      objs.lines.push(new google.maps.Polyline({
        path: drawingBoundaryPoints.map(([lng, lat]) => ({ lat, lng })),
        strokeColor: '#10B981', strokeWeight: 2,
        map: gmap, zIndex: 20,
      }))
    }
    for (const [lng, lat] of drawingBoundaryPoints) {
      objs.dots.push(new google.maps.Marker({
        position: { lat, lng }, map: gmap,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 5, fillColor: '#10B981', fillOpacity: 1, strokeColor: '#FFF', strokeWeight: 1.5 },
        zIndex: 21,
      }))
    }
  }, [mapLoaded, drawingTaxilanePoints, drawingTaxilaneType, drawingBoundaryPoints])

  // ── Render freeform obstacle drawing preview on Google Maps ──

  const drawingObsObjsRef = useRef<{ polygons: google.maps.Polygon[] }>({ polygons: [] })

  useEffect(() => {
    const w = map.current
    if (!w || !mapLoaded) return
    const gmap = w.gmap

    // Clean previous
    drawingObsObjsRef.current.polygons.forEach(p => p.setMap(null))
    drawingObsObjsRef.current = { polygons: [] }

    if (drawingObsType && drawingObsStart && drawingObsCurrent) {
      const [startLng, startLat] = drawingObsStart
      const [curLng, curLat] = drawingObsCurrent

      if (drawingObsType === 'circle') {
        const dEast = (curLng - startLng) * 111319.9 * Math.cos(startLat * Math.PI / 180) * 3.28084
        const dNorth = (curLat - startLat) * 111319.9 * 3.28084
        const radiusFt = Math.sqrt(dEast * dEast + dNorth * dNorth)
        if (radiusFt > 1) {
          const center = { lat: startLat, lon: startLng }
          const segs = 48
          const coords: { lat: number; lng: number }[] = []
          for (let i = 0; i <= segs; i++) {
            const bearing = (360 * i) / segs
            const pt = offsetPoint(center, bearing, radiusFt)
            coords.push({ lat: pt.lat, lng: pt.lon })
          }
          drawingObsObjsRef.current.polygons.push(new google.maps.Polygon({
            paths: coords,
            fillColor: '#F97316', fillOpacity: 0.3,
            strokeColor: '#F97316', strokeWeight: 2,
            map: gmap, zIndex: 20,
          }))
        }
      } else if (drawingObsType === 'building') {
        drawingObsObjsRef.current.polygons.push(new google.maps.Polygon({
          paths: [
            { lat: startLat, lng: startLng },
            { lat: startLat, lng: curLng },
            { lat: curLat, lng: curLng },
            { lat: curLat, lng: startLng },
          ],
          fillColor: '#F97316', fillOpacity: 0.3,
          strokeColor: '#F97316', strokeWeight: 2,
          map: gmap, zIndex: 20,
        }))
      }
    }
  }, [mapLoaded, drawingObsType, drawingObsStart, drawingObsCurrent])

  // ── Fly to clearance result ──

  const flyToResult = (result: ClearanceResult) => {
    if (!map.current) return
    const gmap = map.current.gmap
    const spotA = spotsWithAircraft.find(s => s.id === result.spot_a_id)

    if (spotA) {
      if (result.spot_b_id) {
        const spotB = spotsWithAircraft.find(s => s.id === result.spot_b_id)
        if (spotB) {
          const lat = (spotA.latitude + spotB.latitude) / 2
          const lng = (spotA.longitude + spotB.longitude) / 2
          gmap.panTo({ lat, lng }); gmap.setZoom(17)
        }
      } else if (result.obstacle_id) {
        const obs = obstacles.find(o => o.id === result.obstacle_id)
        if (obs) {
          const lat = (spotA.latitude + obs.latitude) / 2
          const lng = (spotA.longitude + obs.longitude) / 2
          gmap.panTo({ lat, lng }); gmap.setZoom(17)
        }
      }
    } else if (result.obstacle_id && result.spot_b_id) {
      const obs = obstacles.find(o => o.id === result.obstacle_id)
      if (obs) {
        gmap.panTo({ lat: obs.latitude, lng: obs.longitude }); gmap.setZoom(17)
      }
    }
  }

  // ── Aircraft picker filtering ──

  const filteredAircraft = useMemo(() => {
    let list = allAircraft
    if (aircraftCategoryFilter !== 'all') {
      list = list.filter(a => a.category === aircraftCategoryFilter)
    }
    if (!aircraftSearch.trim()) {
      // Show favorites first, then the rest
      const favs = list.filter(a => favoriteAircraft.includes(a.aircraft))
      const rest = list.filter(a => !favoriteAircraft.includes(a.aircraft))
      return [...favs, ...rest].slice(0, 50)
    }
    const q = aircraftSearch.toLowerCase()
    const results = list.filter(a =>
      a.aircraft.toLowerCase().includes(q) ||
      (a.manufacturer && a.manufacturer.toLowerCase().includes(q)) ||
      (a.category && a.category.toLowerCase().includes(q))
    )
    // Favorites first in search results too
    const favs = results.filter(a => favoriteAircraft.includes(a.aircraft))
    const rest = results.filter(a => !favoriteAircraft.includes(a.aircraft))
    return [...favs, ...rest].slice(0, 50)
  }, [aircraftSearch, aircraftCategoryFilter, favoriteAircraft])

  // ── Render ──

  if (!hasGoogleMaps) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        <h2 style={{ color: 'var(--color-text-primary)', marginBottom: 8 }}>Aircraft Parking</h2>
        <p>Google Maps API key not configured. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your environment.</p>
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
          padding: isMobile ? '12px 14px' : '7px 10px', border: 'none', cursor: 'pointer',
          background: 'transparent',
          color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)', fontWeight: 600,
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{openSections[id] ? '\u25BC' : '\u25B6'}</span>
        {label}
        {count != null && count > 0 && (
          <span style={{ fontSize: 10, padding: '0 5px', borderRadius: 8, background: `color-mix(in srgb, ${color || 'var(--color-cyan)'} 13%, transparent)`, color: color || 'var(--color-cyan)' }}>
            {count}
          </span>
        )}
        {badge && (
          <span style={{ fontSize: 10, padding: '0 5px', borderRadius: 8, marginLeft: 'auto', background: `color-mix(in srgb, ${color || 'var(--color-danger)'} 13%, transparent)`, color: color || 'var(--color-danger)', fontWeight: 700 }}>
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

  // ── Sidebar content (shared between desktop sidebar and mobile bottom sheet) ──
  const sidebarContent = (mobile?: boolean) => (
    <>
        {/* Sidebar header — plan selector */}
        <div style={{ padding: mobile ? '10px 12px' : '8px 10px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <h1 style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, margin: 0, color: 'var(--color-text-primary)', flex: 1 }}>
              Aircraft Parking
            </h1>
            {selectedPlan && (
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 3,
                background: selectedPlan.is_template ? 'color-mix(in srgb, var(--color-purple) 13%, transparent)' : selectedPlan.is_active ? 'color-mix(in srgb, var(--color-success) 13%, transparent)' : 'var(--color-bg)',
                color: selectedPlan.is_template ? 'var(--color-purple)' : selectedPlan.is_active ? 'var(--color-success)' : 'var(--color-text-secondary)',
                border: `1px solid ${selectedPlan.is_template ? 'color-mix(in srgb, var(--color-purple) 30%, transparent)' : selectedPlan.is_active ? 'color-mix(in srgb, var(--color-success) 30%, transparent)' : 'var(--color-border)'}`,
              }}>
                {selectedPlan.is_template ? 'Template' : selectedPlan.is_active ? 'Active' : 'Draft'}
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
              {plans.filter(p => !p.is_template).length > 0 && (
                <optgroup label="Plans">
                  {plans.filter(p => !p.is_template).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.plan_name}{p.is_active ? ' (Active)' : ''}
                    </option>
                  ))}
                </optgroup>
              )}
              {plans.filter(p => p.is_template).length > 0 && (
                <optgroup label="Templates">
                  {plans.filter(p => p.is_template).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.plan_name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {selectedPlan && (
              <>
                <button
                  onClick={handleExportPdf}
                  disabled={exportingPdf}
                  title="Export PDF"
                  style={{
                    padding: '4px 8px', borderRadius: 4, fontSize: 'var(--fs-xs)',
                    background: 'var(--color-bg)', color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)', cursor: exportingPdf ? 'wait' : 'pointer',
                    fontWeight: 600, opacity: exportingPdf ? 0.5 : 1,
                  }}
                >
                  {exportingPdf ? '...' : 'PDF'}
                </button>
                <button
                  onClick={handleEmailPdf}
                  disabled={exportingPdf}
                  title="Email PDF"
                  style={{
                    padding: '4px 8px', borderRadius: 4, fontSize: 'var(--fs-xs)',
                    background: 'var(--color-bg)', color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)', cursor: exportingPdf ? 'wait' : 'pointer',
                    fontWeight: 600, opacity: exportingPdf ? 0.5 : 1,
                  }}
                >
                  ✉
                </button>
              </>
            )}
            <button
              onClick={() => setShowNewPlan(true)}
              style={{
                padding: '4px 8px', borderRadius: 4, fontSize: 'var(--fs-xs)',
                background: 'var(--color-cyan)', color: '#fff', border: 'none',
                cursor: 'pointer', fontWeight: 600,
              }}
            >
              +
            </button>
          </div>
          {selectedPlan && (
            <div style={{ position: 'relative', display: 'flex', gap: 4, marginTop: 4 }}>
              {!selectedPlan.is_active && !selectedPlan.is_template && (
                <button onClick={handleSetActive} title="Make this the active parking plan" style={{
                  flex: 1, padding: '5px 8px', borderRadius: 4,
                  background: 'var(--color-success)', border: 'none', color: '#fff',
                  cursor: 'pointer', fontSize: 10, fontWeight: 700, fontFamily: 'inherit',
                }}>Set Active</button>
              )}
              <button onClick={() => { setDuplicateName(`${selectedPlan.plan_name} (Copy)`); setShowDuplicateModal(true) }} title="Duplicate this plan" style={{
                flex: 1, padding: '5px 8px', borderRadius: 4,
                background: 'color-mix(in srgb, var(--color-cyan) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-cyan) 40%, transparent)',
                color: 'var(--color-cyan)', cursor: 'pointer', fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
              }}>Duplicate</button>
              <button onClick={() => setShowActionMenu(s => !s)} title="More actions" style={{
                padding: '5px 6px', borderRadius: 4,
                background: showActionMenu ? 'color-mix(in srgb, var(--color-cyan) 10%, transparent)' : 'transparent',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <MoreVertical size={14} />
              </button>
              {showActionMenu && (
                <>
                  <div onClick={() => setShowActionMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 14 }} />
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 15,
                    minWidth: 170, background: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border)', borderRadius: 6,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)', overflow: 'hidden',
                  }}>
                    <button onClick={() => { handleToggleTemplate(); setShowActionMenu(false) }} style={{
                      width: '100%', padding: '8px 12px', textAlign: 'left',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'var(--color-purple)', fontSize: 11, fontWeight: 600,
                      fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <Star size={12} fill="currentColor" />
                      {selectedPlan.is_template ? 'Convert to Plan' : 'Save as Template'}
                    </button>
                    <button onClick={() => { handleDeletePlan(); setShowActionMenu(false) }} style={{
                      width: '100%', padding: '8px 12px', textAlign: 'left',
                      background: 'transparent', border: 'none',
                      borderTop: '1px solid var(--color-border)', cursor: 'pointer',
                      color: 'var(--color-danger)', fontSize: 11, fontWeight: 600,
                      fontFamily: 'inherit',
                    }}>
                      Delete plan
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Tab bar — active indicator unified to cyan; count badges reserve danger/warning for Clearance only when there's something wrong */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          {([
            { key: 'aircraft' as const, label: 'Aircraft', count: spots.length, color: 'var(--color-cyan)', countColor: 'var(--color-cyan)' },
            { key: 'environment' as const, label: 'Environment', count: obstacles.length + taxilanes.length + apronBoundaries.length, color: 'var(--color-cyan)', countColor: 'var(--color-cyan)' },
            { key: 'clearance' as const, label: 'Clearance', count: violations.length + warnings.length, color: 'var(--color-cyan)', countColor: violations.length > 0 ? 'var(--color-danger)' : warnings.length > 0 ? 'var(--color-warning)' : 'var(--color-cyan)' },
            { key: 'settings' as const, label: 'Settings', color: 'var(--color-cyan)', countColor: 'var(--color-cyan)' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setSidebarTab(tab.key)}
              style={{
                flex: 1, padding: isMobile ? '10px 4px' : '7px 4px', border: 'none', cursor: 'pointer',
                background: 'transparent', fontSize: 'var(--fs-xs)', fontWeight: 600,
                color: sidebarTab === tab.key ? tab.color : 'var(--color-text-secondary)',
                borderBottom: sidebarTab === tab.key ? `2px solid ${tab.color}` : '2px solid transparent',
                opacity: sidebarTab === tab.key ? 1 : 0.6,
              }}
            >
              {tab.label}
              {'count' in tab && tab.count != null && tab.count > 0 && (
                <span style={{
                  marginLeft: 3, fontSize: 9, padding: '0 4px', borderRadius: 6,
                  background: `color-mix(in srgb, ${tab.countColor} 13%, transparent)`, color: tab.countColor,
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Scrollable tab content */}
        <div style={{ flex: 1, overflow: 'auto' }}>

          {/* ── Aircraft Tab ── */}
          {sidebarTab === 'aircraft' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {selectedPlanId && (
                <div style={{ display: 'flex', gap: 4, padding: '4px 8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setShowAircraftPicker(true)}
                    style={{
                      padding: '5px 12px', borderRadius: 4,
                      background: 'color-mix(in srgb, var(--color-cyan) 7%, transparent)', border: '1px dashed var(--color-cyan)',
                      color: 'var(--color-cyan)', cursor: 'pointer', fontSize: 'var(--fs-xs)',
                    }}
                  >
                    + Add Aircraft
                  </button>
                  <button
                    onClick={() => setBoxSelectActive(v => !v)}
                    title="Drag a box on the map to select multiple aircraft (ESC)"
                    style={{
                      padding: '5px 10px', borderRadius: 4,
                      background: boxSelectActive ? 'color-mix(in srgb, var(--color-purple) 20%, transparent)' : 'var(--color-bg-surface)',
                      border: `1px solid ${boxSelectActive ? 'var(--color-purple)' : 'var(--color-border)'}`,
                      color: boxSelectActive ? 'var(--color-purple)' : 'var(--color-text-secondary)',
                      cursor: 'pointer', fontSize: 'var(--fs-xs)', fontWeight: 600,
                    }}
                  >
                    {boxSelectActive ? 'Drawing Box…' : 'Box Select'}
                  </button>
                  {selectedSpotIds.size > 0 && (
                    <button
                      onClick={() => setSelectedSpotIds(new Set())}
                      style={{
                        padding: '5px 10px', borderRadius: 4,
                        background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                        color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 'var(--fs-xs)',
                      }}
                    >
                      Clear ({selectedSpotIds.size})
                    </button>
                  )}
                </div>
              )}

              {/* Multi-select operations panel */}
              {selectedSpotIds.size > 1 && (() => {
                const selSpots = spotsWithAircraft.filter(s => selectedSpotIds.has(s.id))
                const firstHeading = selSpots[0]?.heading_deg ?? 0
                const allSameHeading = selSpots.every(s => s.heading_deg === firstHeading)
                const selViolations = allResults.filter(r =>
                  (r.spot_a_id && selectedSpotIds.has(r.spot_a_id)) ||
                  (r.spot_b_id && selectedSpotIds.has(r.spot_b_id))
                )
                return (
                  <div style={{
                    padding: '8px 10px', background: 'color-mix(in srgb, var(--color-purple) 8%, transparent)',
                    borderBottom: '2px solid var(--color-purple)', display: 'flex', flexDirection: 'column', gap: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-purple)' }}>
                        {selectedSpotIds.size} aircraft selected
                      </span>
                      {selViolations.length > 0 && (
                        <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-danger)', fontWeight: 700 }}>
                          {selViolations.filter(v => v.status === 'violation').length} violations
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                        Heading:
                      </span>
                      <input
                        type="range" min={0} max={360} step={1}
                        value={allSameHeading ? firstHeading : 0}
                        onChange={e => {
                          const deg = Number(e.target.value)
                          for (const s of selSpots) handleUpdateSpot(s.id, { heading_deg: deg })
                        }}
                        style={{ flex: 1 }}
                      />
                      <input
                        type="number" min={0} max={360} step={1}
                        value={allSameHeading ? firstHeading : ''}
                        placeholder={allSameHeading ? '' : 'mixed'}
                        onChange={e => {
                          const raw = e.target.value; if (raw === '') return
                          const deg = Math.min(360, Math.max(0, Number(raw)))
                          if (!isNaN(deg)) for (const s of selSpots) handleUpdateSpot(s.id, { heading_deg: deg })
                        }}
                        onFocus={e => e.target.select()}
                        style={{ width: 50, padding: '2px 3px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-purple)', fontSize: 'var(--fs-xs)', textAlign: 'center', fontWeight: 700 }}
                      />
                      <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-secondary)' }}>°</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-secondary)' }}>Clearance:</span>
                      {[null, 10, 15, 25].map(val => (
                        <button
                          key={val ?? 'adg'}
                          onClick={() => { for (const s of selSpots) handleUpdateSpot(s.id, { clearance_ft: val as any }) }}
                          style={{
                            padding: '2px 6px', borderRadius: 3, fontSize: 'var(--fs-2xs)', border: '1px solid var(--color-border)',
                            background: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)', cursor: 'pointer',
                          }}
                        >
                          {val ? `${val}ft` : 'UFC'}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => {
                          setClearanceFilter('all')
                          setSidebarTab('clearance')
                        }}
                        style={{ padding: '4px 8px', borderRadius: 3, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}
                      >
                        View Clearance
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Remove ${selectedSpotIds.size} aircraft?`)) return
                          for (const sid of Array.from(selectedSpotIds)) await handleDeleteSpot(sid)
                          setSelectedSpotIds(new Set())
                        }}
                        style={{ padding: '4px 8px', borderRadius: 3, background: 'color-mix(in srgb, var(--color-danger) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 'var(--fs-xs)', marginLeft: 'auto' }}
                      >
                        Delete All
                      </button>
                    </div>
                  </div>
                )
              })()}

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

              {/* Grouped by aircraft type */}
              {(() => {
                const groups: Record<string, ParkingSpot[]> = {}
                for (const s of spots) {
                  const key = s.aircraft_name || 'Unknown'
                  if (!groups[key]) groups[key] = []
                  groups[key].push(s)
                }
                const [expandedGroups, setExpandedGroups] = [openSections, setOpenSections] // reuse openSections state
                return Object.entries(groups).map(([acName, groupSpots]) => {
                  const ac = allAircraft.find(a => a.aircraft === acName)
                  const ws = ac ? parseNum(ac.wing_span_ft) : 50
                  const adg = getADGFromWingspan(ws)
                  const groupKey = `acgroup_${acName}`
                  const isGroupOpen = expandedGroups[groupKey] !== false // default open
                  const groupViolations = allResults.filter(r =>
                    groupSpots.some(s => s.id === r.spot_a_id || s.id === r.spot_b_id) && r.status !== 'ok'
                  )

                  return (
                    <div key={acName}>
                      {/* Group header — tertiary section header tier */}
                      <div
                        onClick={() => setExpandedGroups(prev => ({ ...prev, [groupKey]: !isGroupOpen }))}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: isMobile ? '10px 12px' : '8px 10px', cursor: 'pointer',
                          background: 'var(--color-bg-inset)',
                          borderTop: '1px solid var(--color-border)',
                          borderBottom: '1px solid color-mix(in srgb, var(--color-cyan) 20%, transparent)',
                        }}
                      >
                        <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{isGroupOpen ? '\u25BC' : '\u25B6'}</span>
                        <span style={{
                          fontSize: 10, padding: '1px 5px', borderRadius: 3,
                          background: `color-mix(in srgb, ${ADG_COLORS[adg]} 13%, transparent)`, color: ADG_COLORS[adg],
                          fontWeight: 700, flexShrink: 0, letterSpacing: '0.04em',
                        }}>
                          {adg}
                        </span>
                        <span style={{
                          fontSize: 'var(--fs-xs)', fontWeight: 700,
                          color: 'var(--color-text-primary)',
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {acName}
                        </span>
                        <span style={{
                          fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '0 6px', borderRadius: 10,
                          background: 'color-mix(in srgb, var(--color-cyan) 13%, transparent)', color: 'var(--color-cyan)',
                          flexShrink: 0,
                        }}>
                          {groupSpots.length}
                        </span>
                        {groupViolations.length > 0 && (
                          <span title={`${groupViolations.length} clearance issue${groupViolations.length !== 1 ? 's' : ''}`} style={{ color: 'var(--color-danger)', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>!</span>
                        )}
                      </div>

                      {/* Group heading control — de-emphasized sub-control under the group header */}
                      {isGroupOpen && groupSpots.length > 1 && (
                        <div
                          onClick={e => e.stopPropagation()}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: isMobile ? '5px 12px 5px 28px' : '3px 8px 3px 24px',
                            background: 'transparent', borderBottom: '1px solid var(--color-border)',
                            opacity: 0.85,
                          }}
                        >
                          <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>All {groupSpots.length} hdg</span>
                          <input
                            type="range" min={0} max={360} step={1}
                            value={groupSpots[0]?.heading_deg ?? 0}
                            onChange={e => {
                              const deg = Number(e.target.value)
                              for (const s of groupSpots) handleUpdateSpot(s.id, { heading_deg: deg })
                            }}
                            style={{ flex: 1 }}
                          />
                          <input
                            type="number" min={0} max={360} step={1}
                            value={groupSpots[0]?.heading_deg ?? 0}
                            onChange={e => {
                              const raw = e.target.value; if (raw === '') return
                              const deg = Math.min(360, Math.max(0, Number(raw)))
                              if (!isNaN(deg)) for (const s of groupSpots) handleUpdateSpot(s.id, { heading_deg: deg })
                            }}
                            onFocus={e => e.target.select()}
                            style={{ width: 44, padding: '2px 3px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-cyan)', fontSize: 'var(--fs-xs)', textAlign: 'center', fontWeight: 700 }}
                          />
                          <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-secondary)' }}>°</span>
                        </div>
                      )}

                      {/* Individual spots within group */}
                      {isGroupOpen && groupSpots.map(s => {
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
                            <div
                              title={s.spot_name || acName}
                              onClick={e => {
                                if (e.shiftKey) {
                                  setSelectedSpotIds(prev => {
                                    const next = new Set(prev)
                                    if (next.size === 0 && editingSpot && editingSpot.id !== s.id) next.add(editingSpot.id)
                                    if (next.has(s.id)) next.delete(s.id); else next.add(s.id)
                                    return next
                                  })
                                  setEditingSpot(null)
                                } else {
                                  setSelectedSpotIds(new Set())
                                  setEditingSpot(isEditing ? null : s)
                                }
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: isMobile ? '8px 12px 8px 24px' : '4px 8px 4px 20px', cursor: 'pointer',
                                background: selectedSpotIds.has(s.id)
                                  ? 'color-mix(in srgb, var(--color-purple) 14%, transparent)'
                                  : isEditing
                                    ? 'color-mix(in srgb, var(--color-cyan) 8%, transparent)'
                                    : 'transparent',
                                borderBottom: '1px solid var(--color-border)',
                                borderLeft: selectedSpotIds.has(s.id)
                                  ? '3px solid var(--color-purple)'
                                  : isEditing
                                    ? '3px solid var(--color-cyan)'
                                    : spotViolations.length > 0
                                      ? '3px solid var(--color-danger)'
                                      : '3px solid transparent',
                              }}
                            >
                              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: isEditing ? 600 : 500, color: isEditing ? 'var(--color-cyan)' : 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                                {s.spot_name || acName}
                              </span>
                              {s.tail_number && (
                                <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                                  {s.tail_number}
                                </span>
                              )}
                              <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', marginLeft: 'auto' }}>
                                {clearance}ft &middot; {s.heading_deg}°
                              </span>
                              {spotViolations.length > 0 && (
                                <span style={{ color: 'var(--color-danger)', fontSize: 10, fontWeight: 700 }}>!</span>
                              )}
                            </div>

                            {isEditing && (
                              <div
                                onClick={e => e.stopPropagation()}
                                style={{ padding: '8px 8px 8px 20px', display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}
                              >
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', flex: 1 }}>
                                    Spot Name
                                    <input value={s.spot_name || ''} onChange={e => handleUpdateSpot(s.id, { spot_name: e.target.value })} style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }} />
                                  </label>
                                  <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', flex: 1 }}>
                                    Tail #
                                    <input value={s.tail_number || ''} onChange={e => handleUpdateSpot(s.id, { tail_number: e.target.value })} style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }} />
                                  </label>
                                  <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', flex: 1 }}>
                                    Callsign
                                    <input value={s.unit_callsign || ''} onChange={e => handleUpdateSpot(s.id, { unit_callsign: e.target.value })} style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }} />
                                  </label>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
                                  <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-secondary)' }}>Nose:</span>
                                  <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-cyan)', fontFamily: 'monospace', letterSpacing: '0.02em' }}>
                                    {formatCoordsDMS(s.latitude, s.longitude)}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', flex: 1 }}>
                                    Heading
                                    <input type="range" min={0} max={360} step={1} value={s.heading_deg} onChange={e => handleUpdateSpot(s.id, { heading_deg: Number(e.target.value) })} style={{ width: '100%' }} />
                                  </label>
                                  <input type="number" min={0} max={360} step={1} value={s.heading_deg}
                                    onChange={e => { const raw = e.target.value; if (raw === '') return; const v = Math.min(360, Math.max(0, Number(raw))); if (!isNaN(v)) handleUpdateSpot(s.id, { heading_deg: v }) }}
                                    onFocus={e => e.target.select()}
                                    style={{ width: 48, padding: '3px 4px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)', textAlign: 'center' }}
                                  />
                                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>°</span>
                                </div>
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', flexShrink: 0 }}>Clearance:</span>
                                  {[null, 10, 15, 25].map(val => (
                                    <button key={val ?? 'adg'} onClick={() => handleUpdateSpot(s.id, { clearance_ft: val as any })} style={{
                                      padding: '2px 6px', borderRadius: 3, fontSize: 'var(--fs-xs)', border: '1px solid var(--color-border)',
                                      background: s.clearance_ft === val ? 'color-mix(in srgb, var(--color-cyan) 13%, transparent)' : 'var(--color-bg-surface)',
                                      color: s.clearance_ft === val ? 'var(--color-cyan)' : 'var(--color-text-secondary)', cursor: 'pointer',
                                    }}>
                                      {val ? `${val}ft` : `UFC (${getWingtipClearance(ws, apronContext, s.aircraft_name)}ft)`}
                                    </button>
                                  ))}
                                  <select value={s.status} onChange={e => handleUpdateSpot(s.id, { status: e.target.value as ParkingSpot['status'] })}
                                    style={{ marginLeft: 'auto', padding: '2px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }}>
                                    <option value="available">Available</option>
                                    <option value="occupied">Occupied</option>
                                    <option value="reserved">Reserved</option>
                                  </select>
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button onClick={() => (() => { map.current?.gmap.panTo({ lat: s.latitude, lng: s.longitude }); map.current?.gmap.setZoom(19) })()} style={{ padding: '4px 8px', borderRadius: 3, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}>Fly To</button>
                                  <button onClick={() => handleDuplicateSpot(s)} style={{ padding: '4px 8px', borderRadius: 3, background: 'color-mix(in srgb, var(--color-cyan) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyan) 30%, transparent)', color: 'var(--color-cyan)', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}>Duplicate</button>
                                  <button onClick={() => handleDeleteSpot(s.id)} style={{ padding: '4px 8px', borderRadius: 3, background: 'color-mix(in srgb, var(--color-danger) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}>Remove</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })
              })()}
            </div>
          )}

          {/* ── Environment Tab (Obstacles + Taxilanes + Boundaries) ── */}
          {sidebarTab === 'environment' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Obstacle lock toggle */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: isMobile ? '10px 12px' : '6px 10px',
                borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)',
              }}>
                <button
                  onClick={() => setObstaclesLocked(l => !l)}
                  style={{
                    padding: isMobile ? '8px 12px' : '4px 10px', borderRadius: 4, fontSize: 'var(--fs-xs)', fontWeight: 600,
                    background: obstaclesLocked ? 'color-mix(in srgb, var(--color-orange) 13%, transparent)' : 'color-mix(in srgb, var(--color-success) 13%, transparent)',
                    border: `1px solid ${obstaclesLocked ? 'color-mix(in srgb, var(--color-orange) 30%, transparent)' : 'color-mix(in srgb, var(--color-success) 30%, transparent)'}`,
                    color: obstaclesLocked ? 'var(--color-orange)' : 'var(--color-success)',
                    cursor: 'pointer', flex: 1,
                  }}
                >
                  {obstaclesLocked ? 'Obstacles Locked' : 'Obstacles Unlocked — Drag Enabled'}
                </button>
                {(['aircraft', 'obstacles', 'taxilanes', 'boundaries'] as const).map(lk => (
                  <button
                    key={lk}
                    onClick={() => toggleLayerVisibility(lk)}
                    title={`${visibleLayers[lk] ? 'Hide' : 'Show'} ${lk}`}
                    style={{
                      padding: '2px 4px', border: 'none', cursor: 'pointer', background: 'transparent',
                      fontSize: 11, color: visibleLayers[lk] ? 'var(--color-cyan)' : 'var(--color-text-secondary)',
                      opacity: visibleLayers[lk] ? 1 : 0.3,
                    }}
                  >
                    {lk === 'aircraft' ? 'AC' : lk === 'obstacles' ? 'OB' : lk === 'taxilanes' ? 'TL' : 'AB'}
                  </button>
                ))}
              </div>

              {/* Obstacles sub-section */}
              <SectionHeader id="obstacles" label="Obstacles" count={obstacles.length} color="#F97316" layerKey="obstacles" />
              {openSections.obstacles && (
              <div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4, padding: '4px 8px' }}>
                {(['point', 'building', 'line', 'circle'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => { setPlacingObstacle(type); setPlacingAircraft(null) }}
                    style={{
                      padding: '4px 10px', borderRadius: 4, fontSize: 'var(--fs-xs)',
                      background: placingObstacle === type ? 'color-mix(in srgb, var(--color-orange) 13%, transparent)' : 'var(--color-bg)',
                      border: `1px solid ${placingObstacle === type ? 'var(--color-orange)' : 'var(--color-border)'}`,
                      color: placingObstacle === type ? 'var(--color-orange)' : 'var(--color-text-secondary)',
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

              {(['building', 'point', 'line', 'circle'] as const).map(obsType => {
                const group = obstacles.filter(o => o.obstacle_type === obsType)
                if (group.length === 0) return null
                const groupOpen = openSections[`obs_${obsType}`] !== false
                return (
                  <div key={obsType}>
                    <div
                      onClick={() => setOpenSections(prev => ({ ...prev, [`obs_${obsType}`]: !groupOpen }))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
                        cursor: 'pointer', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)',
                        fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-orange)', textTransform: 'capitalize',
                      }}
                    >
                      <span style={{ fontSize: 10 }}>{groupOpen ? '\u25BC' : '\u25B6'}</span>
                      {obsType}s
                      <span style={{ fontSize: 10, padding: '0 5px', borderRadius: 8, background: 'color-mix(in srgb, var(--color-orange) 13%, transparent)', color: 'var(--color-orange)' }}>{group.length}</span>
                    </div>
                    {groupOpen && group.map(obs => {
                const isEditing = editingObstacle?.id === obs.id
                return (
                  <div key={obs.id}>
                    <div
                      onClick={() => setEditingObstacle(isEditing ? null : obs)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: isMobile ? '10px 12px 10px 20px' : '4px 8px 4px 20px', cursor: 'pointer',
                        background: isEditing ? 'var(--color-bg)' : 'transparent',
                        borderBottom: '1px solid var(--color-border)',
                        borderLeft: '3px solid #F97316',
                      }}
                    >
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
                          <button onClick={() => (() => { map.current?.gmap.panTo({ lat: obs.latitude, lng: obs.longitude }); map.current?.gmap.setZoom(17) })()} style={{ padding: '4px 8px', borderRadius: 3, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}>Fly To</button>
                          <button onClick={() => handleDeleteObstacle(obs.id)} style={{ padding: '4px 8px', borderRadius: 3, background: 'color-mix(in srgb, var(--color-danger) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}>Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
                  </div>
                )
              })}
            </div>
          )}

              {/* Taxilanes sub-section */}
              <SectionHeader id="taxilanes" label="Taxilanes" count={taxilanes.length} color="#3B82F6" layerKey="taxilanes" badge={allResults.filter(r => r.spot_b_id && taxilanes.some(t => t.id === r.spot_b_id) && r.status !== 'ok').length > 0 ? `${allResults.filter(r => r.spot_b_id && taxilanes.some(t => t.id === r.spot_b_id) && r.status !== 'ok').length}!` : undefined} />
              {openSections.taxilanes && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap', padding: '4px 8px' }}>
                <button
                  onClick={() => handleStartTaxilane('interior')}
                  disabled={!selectedPlanId || !!drawingTaxilaneId}
                  style={{
                    padding: '4px 10px', borderRadius: 4, fontSize: 'var(--fs-xs)',
                    background: 'color-mix(in srgb, var(--color-blue) 7%, transparent)', border: '1px dashed #3B82F6',
                    color: 'var(--color-status-inwork)', cursor: selectedPlanId ? 'pointer' : 'not-allowed',
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
                    background: 'color-mix(in srgb, var(--color-violet) 7%, transparent)', border: '1px dashed #8B5CF6',
                    color: 'var(--color-purple)', cursor: selectedPlanId ? 'pointer' : 'not-allowed',
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
                    background: 'color-mix(in srgb, var(--color-success) 7%, transparent)', border: '1px dashed #10B981',
                    color: 'var(--color-success)', cursor: selectedPlanId ? 'pointer' : 'not-allowed',
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
                        padding: isMobile ? '10px 12px' : '4px 8px', cursor: 'pointer',
                        background: isEditing ? 'var(--color-bg)' : 'transparent',
                        borderBottom: '1px solid var(--color-border)',
                        borderLeft: `3px solid ${tlViolations.length > 0 ? 'var(--color-danger)' : tl.taxilane_type === 'peripheral' ? 'var(--color-purple)' : 'var(--color-status-inwork)'}`,
                      }}
                    >
                      <span style={{
                        fontSize: 10, padding: '1px 4px', borderRadius: 3,
                        background: tl.taxilane_type === 'peripheral' ? 'color-mix(in srgb, var(--color-violet) 13%, transparent)' : 'color-mix(in srgb, var(--color-blue) 13%, transparent)',
                        color: tl.taxilane_type === 'peripheral' ? 'var(--color-purple)' : 'var(--color-status-inwork)',
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
                        <span style={{ color: 'var(--color-danger)', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>!</span>
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
                            <select
                              value={tl.design_aircraft || ''}
                              onChange={e => {
                                const acName = e.target.value
                                const ac = allAircraft.find(a => a.aircraft === acName)
                                const ws = ac ? parseNum(ac.wing_span_ft) : null
                                handleUpdateTaxilane(tl.id, {
                                  design_aircraft: acName || null as any,
                                  ...(ws ? { design_wingspan_ft: ws } : {}),
                                })
                              }}
                              style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }}
                            >
                              <option value="">Select aircraft...</option>
                              {allAircraft.map(ac => (
                                <option key={ac.aircraft} value={ac.aircraft}>{ac.aircraft} ({ac.wing_span_ft}ft)</option>
                              ))}
                            </select>
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
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-danger)', padding: '2px 0' }}>
                            {tlViolations.length} violation{tlViolations.length === 1 ? '' : 's'} in taxilane envelope
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                          <button onClick={() => { if (tl.line_coords?.length > 0) { map.current?.gmap.panTo({ lat: tl.line_coords[0][1], lng: tl.line_coords[0][0] }); map.current?.gmap.setZoom(17) } }} style={{ padding: '4px 8px', borderRadius: 3, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}>Fly To</button>
                          <button
                            onClick={() => setEditingTaxilanePoints(v => !v)}
                            style={{
                              padding: '4px 8px', borderRadius: 3,
                              background: editingTaxilanePoints ? 'color-mix(in srgb, var(--color-blue) 20%, transparent)' : 'var(--color-bg-surface)',
                              border: `1px solid ${editingTaxilanePoints ? 'var(--color-blue)' : 'var(--color-border)'}`,
                              color: editingTaxilanePoints ? 'var(--color-blue)' : 'var(--color-text-secondary)',
                              cursor: 'pointer', fontSize: 'var(--fs-xs)', fontWeight: editingTaxilanePoints ? 700 : 400,
                            }}
                          >
                            {editingTaxilanePoints ? 'Exit Edit Points' : 'Edit Points'}
                          </button>
                          {editingTaxilanePoints && (
                            <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-secondary)', flex: 1 }}>
                              Drag blue dots to move · click white dots to insert · shift+click to delete
                            </span>
                          )}
                          <button onClick={() => handleDeleteTaxilane(tl.id)} style={{ padding: '4px 8px', borderRadius: 3, background: 'color-mix(in srgb, var(--color-danger) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 'var(--fs-xs)', marginLeft: 'auto' }}>Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Apron boundary list */}
              {apronBoundaries.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', fontSize: 'var(--fs-xs)', color: 'var(--color-success)', fontWeight: 600, padding: '6px 8px 2px', marginTop: taxilanes.length > 0 ? 4 : 0 }}>
                  <span style={{ flex: 1 }}>Apron Boundaries</span>
                  <button
                    onClick={() => toggleLayerVisibility('boundaries')}
                    title={visibleLayers.boundaries ? 'Hide on map' : 'Show on map'}
                    style={{ padding: '0 4px', border: 'none', cursor: 'pointer', background: 'transparent', fontSize: 12, color: visibleLayers.boundaries ? 'var(--color-success)' : 'var(--color-text-secondary)', opacity: visibleLayers.boundaries ? 1 : 0.4 }}
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
                        padding: isMobile ? '10px 12px' : '4px 8px', cursor: 'pointer',
                        background: isEditing ? 'var(--color-bg)' : 'transparent',
                        borderBottom: '1px solid var(--color-border)',
                        borderLeft: '3px solid var(--color-success)',
                      }}
                    >
                      <span style={{
                        fontSize: 10, padding: '1px 4px', borderRadius: 3,
                        background: 'color-mix(in srgb, var(--color-success) 13%, transparent)', color: 'var(--color-success)', flexShrink: 0,
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
                          <button onClick={() => { if (ab.polygon_coords?.length > 0) { map.current?.gmap.panTo({ lat: ab.polygon_coords[0][1], lng: ab.polygon_coords[0][0] }); map.current?.gmap.setZoom(17) } }} style={{ padding: '4px 8px', borderRadius: 3, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}>Fly To</button>
                          <button onClick={() => handleDeleteBoundary(ab.id)} style={{ padding: '4px 8px', borderRadius: 3, background: 'color-mix(in srgb, var(--color-danger) 13%, transparent)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}>Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
            </div>
          )}

          {/* ── Clearance Tab ── */}
          {sidebarTab === 'clearance' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Layer visibility toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', flex: 1 }}>Show clearance zones on map</span>
                <button
                  onClick={() => toggleLayerVisibility('clearance')}
                  style={{
                    padding: '2px 8px', border: 'none', cursor: 'pointer', background: 'transparent',
                    fontSize: 14, color: visibleLayers.clearance ? 'var(--color-cyan)' : 'var(--color-text-secondary)',
                    opacity: visibleLayers.clearance ? 1 : 0.4,
                  }}
                >
                  {visibleLayers.clearance ? '\u25C9' : '\u25CB'}
                </button>
              </div>
              {allResults.length > 0 && (
                <div style={{ display: 'flex', gap: 3, padding: '4px 8px', borderBottom: '1px solid var(--color-border)' }}>
                  {(['all', 'violations', 'warnings', 'ok'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setClearanceFilter(f)}
                      style={{
                        flex: 1, padding: '2px 4px', borderRadius: 3, fontSize: 10,
                        border: `1px solid ${clearanceFilter === f ? (f === 'violations' ? 'color-mix(in srgb, var(--color-danger) 30%, transparent)' : f === 'warnings' ? 'color-mix(in srgb, var(--color-amber) 30%, transparent)' : f === 'ok' ? 'color-mix(in srgb, var(--color-success) 30%, transparent)' : 'var(--color-border)') : 'var(--color-border)'}`,
                        background: clearanceFilter === f ? (f === 'violations' ? 'color-mix(in srgb, var(--color-danger) 13%, transparent)' : f === 'warnings' ? 'color-mix(in srgb, var(--color-amber) 13%, transparent)' : f === 'ok' ? 'color-mix(in srgb, var(--color-success) 13%, transparent)' : 'var(--color-bg)') : 'var(--color-bg)',
                        color: clearanceFilter === f ? (f === 'violations' ? 'var(--color-danger)' : f === 'warnings' ? 'var(--color-warning)' : f === 'ok' ? 'var(--color-success)' : 'var(--color-text-primary)') : 'var(--color-text-secondary)',
                        cursor: 'pointer', textTransform: 'capitalize',
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
              {allResults.length === 0 && (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-xs)', padding: '4px 0', margin: 0 }}>
                  Place at least 2 aircraft or 1 aircraft + 1 obstacle to see clearance checks.
                </p>
              )}

              {allResults.filter(r => clearanceFilter === 'all' || (clearanceFilter === 'violations' && r.status === 'violation') || (clearanceFilter === 'warnings' && r.status === 'warning') || (clearanceFilter === 'ok' && r.status === 'ok')).map((r, i) => (
                <div
                  key={i}
                  onClick={() => flyToResult(r)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: isMobile ? '10px 12px' : '4px 8px', cursor: 'pointer',
                    borderBottom: '1px solid var(--color-border)',
                    borderLeft: `3px solid ${STATUS_COLORS[r.status]}`,
                    background: r.status !== 'ok' ? `color-mix(in srgb, ${STATUS_COLORS[r.status]} 3%, transparent)` : 'transparent',
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
                  {r.status === 'violation' && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-danger)', fontWeight: 600, flexShrink: 0 }}>VIOLATION</span>}
                  {r.status === 'warning' && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-warning)', fontWeight: 600, flexShrink: 0 }}>WARNING</span>}
                  {r.status === 'ok' && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-success)', flexShrink: 0 }}>OK</span>}
                  <span style={{ fontSize: 10, color: 'var(--color-text-tertiary, #6B7280)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {r.ufc_item}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ── Settings Tab ── */}
          {sidebarTab === 'settings' && (
            <div>
            <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--color-border)' }}>
              <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                UFC 3-260-01 Table 6-1a Context
                <select
                  value={apronContext}
                  onChange={e => setApronContext(e.target.value as ApronContext)}
                  style={{
                    width: '100%', padding: '6px 8px', borderRadius: 4, fontSize: 'var(--fs-xs)', marginTop: 2,
                    border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {(Object.entries(APRON_CONTEXT_LABELS) as [ApronContext, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setPlanLocked(l => !l)}
                  style={{
                    flex: 1, padding: isMobile ? '10px 8px' : '6px 8px', borderRadius: 4, fontSize: 'var(--fs-xs)',
                    background: planLocked ? 'color-mix(in srgb, var(--color-danger) 13%, transparent)' : 'color-mix(in srgb, var(--color-success) 13%, transparent)',
                    border: `1px solid ${planLocked ? 'color-mix(in srgb, var(--color-danger) 30%, transparent)' : 'color-mix(in srgb, var(--color-success) 30%, transparent)'}`,
                    color: planLocked ? 'var(--color-danger)' : 'var(--color-success)',
                    cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  {planLocked ? 'All Locked — No Dragging' : 'Aircraft Unlocked — Drag Enabled'}
                </button>
                <button
                  onClick={() => setObstaclesLocked(l => !l)}
                  style={{
                    flex: 1, padding: isMobile ? '10px 8px' : '6px 8px', borderRadius: 4, fontSize: 'var(--fs-xs)',
                    background: obstaclesLocked ? 'color-mix(in srgb, var(--color-orange) 13%, transparent)' : 'color-mix(in srgb, var(--color-success) 13%, transparent)',
                    border: `1px solid ${obstaclesLocked ? 'color-mix(in srgb, var(--color-orange) 30%, transparent)' : 'color-mix(in srgb, var(--color-success) 30%, transparent)'}`,
                    color: obstaclesLocked ? 'var(--color-orange)' : 'var(--color-success)',
                    cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  {obstaclesLocked ? 'Obstacles Locked' : 'Obstacles Unlocked'}
                </button>
              </div>
            </div>

            {/* UFC Reference */}
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
                    background: item.applicable_to_2d ? 'color-mix(in srgb, var(--color-cyan) 13%, transparent)' : 'var(--color-bg)',
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

            {/* Disclaimer */}
            <div style={{
              padding: '8px 10px', marginTop: 8,
              fontSize: 'var(--fs-2xs)', color: 'var(--color-text-secondary, var(--color-text-3))',
              lineHeight: 1.5, borderTop: '1px solid var(--color-border)',
            }}>
              Aircraft silhouettes are rendered to-scale using dimensions from the aircraft database. SVG artwork may not extend to exact wing tip edges, resulting in visual measurements up to ~2% smaller than actual. All clearance calculations use precise database dimensions, not visual rendering.
            </div>

            </div>
          )}

        </div>
    </>
  )

  return (
    <div style={{
      display: 'flex', height: isFullscreen ? '100vh' : 'calc(100vh - 60px)', overflow: 'hidden', background: 'var(--color-bg)',
      ...(isFullscreen ? { position: 'fixed', inset: 0, zIndex: 9999 } : {}),
    }}>
      {/* ── Map + overlay area (full width) ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Placement mode indicator — above map */}
        {(placingAircraft || placingObstacle || drawingLineObsId || drawingTaxilaneId || drawingBoundaryId || drawingObsType) && (
          <div style={{
            padding: '6px 12px',
            background: drawingTaxilaneId ? (drawingTaxilaneType === 'peripheral' ? 'color-mix(in srgb, var(--color-violet) 13%, transparent)' : 'color-mix(in srgb, var(--color-blue) 13%, transparent)') : drawingBoundaryId ? 'color-mix(in srgb, var(--color-success) 13%, transparent)' : drawingObsType ? 'color-mix(in srgb, var(--color-orange) 13%, transparent)' : 'color-mix(in srgb, var(--color-amber) 13%, transparent)',
            borderBottom: `1px solid ${drawingTaxilaneId ? (drawingTaxilaneType === 'peripheral' ? 'color-mix(in srgb, var(--color-violet) 30%, transparent)' : 'color-mix(in srgb, var(--color-blue) 30%, transparent)') : drawingBoundaryId ? 'color-mix(in srgb, var(--color-success) 30%, transparent)' : 'color-mix(in srgb, var(--color-amber) 30%, transparent)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: 'var(--fs-sm)',
            color: drawingTaxilaneId ? (drawingTaxilaneType === 'peripheral' ? 'var(--color-purple)' : 'var(--color-status-inwork)') : drawingBoundaryId ? 'var(--color-success)' : drawingObsType ? 'var(--color-orange)' : 'var(--color-warning)',
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
                <button onClick={handleFinishTaxilane} style={{ background: drawingTaxilaneType === 'peripheral' ? 'var(--color-purple)' : 'var(--color-status-inwork)', border: 'none', color: '#fff', cursor: 'pointer', padding: '2px 10px', borderRadius: 4, fontWeight: 700, fontSize: 'var(--fs-xs)' }}>Finish</button>
              )}
              {drawingBoundaryId && (
                <button onClick={handleFinishBoundary} style={{ background: 'var(--color-success)', border: 'none', color: '#fff', cursor: 'pointer', padding: '2px 10px', borderRadius: 4, fontWeight: 700, fontSize: 'var(--fs-xs)' }}>Finish</button>
              )}
              {drawingLineObsId && (
                <button onClick={handleFinishLine} style={{ background: 'var(--color-orange)', border: 'none', color: '#000', cursor: 'pointer', padding: '2px 10px', borderRadius: 4, fontWeight: 600, fontSize: 'var(--fs-xs)' }}>Finish</button>
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

        <div style={{ flex: 1, minHeight: 0, position: 'relative', paddingBottom: isMobile && !isFullscreen ? 48 : 0 }}>
          <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
          {/* ── Floating panel — anchored top-left under the controls toolbar, desktop only ── */}
          {!isMobile && !sidebarCollapsed && (() => {
            const startResize = (dir: 'w' | 'h' | 'wh') => (e: React.MouseEvent) => {
              e.preventDefault()
              e.stopPropagation()
              panelResizeRef.current = {
                startX: e.clientX, startY: e.clientY,
                startW: panelWidth,
                startH: panelHeight ?? (typeof window !== 'undefined' ? window.innerHeight - 140 : 600),
                dir,
              }
              const onMove = (ev: MouseEvent) => {
                const ref = panelResizeRef.current
                if (!ref) return
                if (ref.dir === 'w' || ref.dir === 'wh') {
                  // Anchor is left edge; drag right to widen, left to narrow
                  const next = Math.min(640, Math.max(260, ref.startW + (ev.clientX - ref.startX)))
                  setPanelWidth(next)
                }
                if (ref.dir === 'h' || ref.dir === 'wh') {
                  const next = Math.min(typeof window !== 'undefined' ? window.innerHeight - 60 : 1000, Math.max(240, ref.startH + (ev.clientY - ref.startY)))
                  setPanelHeight(next)
                }
              }
              const onUp = () => {
                window.removeEventListener('mousemove', onMove)
                window.removeEventListener('mouseup', onUp)
                setPanelWidth(w => { try { localStorage.setItem('glidepath_parking_panel_width', String(w)) } catch { /* noop */ } return w })
                setPanelHeight(h => { try { if (h != null) localStorage.setItem('glidepath_parking_panel_height', String(h)) } catch { /* noop */ } return h })
                panelResizeRef.current = null
              }
              window.addEventListener('mousemove', onMove)
              window.addEventListener('mouseup', onUp)
            }
            return (
              <div style={{
                position: 'absolute', top: 50, left: 10, zIndex: 10,
                width: panelWidth,
                maxHeight: panelHeight != null ? panelHeight : 'calc(100vh - 140px)',
                display: 'flex', flexDirection: 'column',
                background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.5)', overflow: 'hidden',
                wordBreak: 'break-word',
              }}>
                {sidebarContent()}
                {/* Resize handles — right edge for width, bottom edge for height, bottom-right corner for both */}
                <div onMouseDown={startResize('w')} title="Drag to resize width"
                  style={{ position: 'absolute', top: 8, right: 0, width: 6, bottom: 14, cursor: 'ew-resize', zIndex: 11 }} />
                <div onMouseDown={startResize('h')} title="Drag to resize height"
                  style={{ position: 'absolute', bottom: 0, left: 8, right: 14, height: 6, cursor: 'ns-resize', zIndex: 11 }} />
                <div onMouseDown={startResize('wh')} title="Drag to resize"
                  style={{ position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, cursor: 'nwse-resize', zIndex: 12 }} />
              </div>
            )
          })()}
          {/* Ruler removed in Google Maps version */}
          {/* Map controls — top left */}
          <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 5, display: 'flex', gap: 4 }}>
            {!isMobile && (
              <button
                onClick={() => setSidebarCollapsed(c => !c)}
                title={sidebarCollapsed ? 'Show panel' : 'Hide panel'}
                style={{
                  padding: '6px 10px', borderRadius: 4, fontSize: 'var(--fs-xs)', fontWeight: 600,
                  background: 'var(--color-bg-surface)',
                  border: `1px solid ${sidebarCollapsed ? 'var(--color-border)' : 'var(--color-cyan)'}`,
                  color: sidebarCollapsed ? 'var(--color-text-primary)' : 'var(--color-cyan)',
                  cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }}
              >
                {sidebarCollapsed ? '\u25B6 Panel' : '\u25C0 Hide'}
              </button>
            )}
            <button
              onClick={() => setIsFullscreen(f => !f)}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              style={{
                padding: '6px 10px', borderRadius: 4, fontSize: 'var(--fs-xs)', fontWeight: 600,
                background: 'var(--color-bg-surface)',
                border: `1px solid ${isFullscreen ? 'var(--color-cyan)' : 'var(--color-border)'}`,
                color: isFullscreen ? 'var(--color-cyan)' : 'var(--color-text-primary)',
                cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }}
            >
              {isFullscreen ? '\u2716 Exit' : '\u26F6'}
            </button>
            <button
              onClick={() => setRulerActive(r => !r)}
              title={rulerActive ? 'Disable ruler' : 'Measure distance'}
              style={{
                padding: '6px 10px', borderRadius: 4, fontSize: 'var(--fs-xs)', fontWeight: 600,
                background: 'var(--color-bg-surface)',
                border: `1px solid ${rulerActive ? 'var(--color-cyan)' : 'var(--color-border)'}`,
                color: rulerActive ? 'var(--color-cyan)' : 'var(--color-text-primary)',
                cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }}
            >
              📏 {rulerActive ? (ruler.totalFt > 0 ? ruler.formatDist(ruler.totalFt) : 'Click to measure') : 'Ruler'}
            </button>
            {selectedPlan && (
              <>
                <button
                  onClick={handleExportPdf}
                  disabled={exportingPdf}
                  title="Export PDF"
                  style={{
                    padding: '6px 10px', borderRadius: 4, fontSize: 'var(--fs-xs)', fontWeight: 600,
                    background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)', cursor: exportingPdf ? 'wait' : 'pointer',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)', opacity: exportingPdf ? 0.5 : 1,
                  }}
                >
                  {exportingPdf ? '...' : 'PDF'}
                </button>
                <button
                  onClick={handleEmailPdf}
                  disabled={exportingPdf}
                  title="Email PDF"
                  style={{
                    padding: '6px 10px', borderRadius: 4, fontSize: 'var(--fs-xs)', fontWeight: 600,
                    background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                    color: 'var(--color-text-primary)', cursor: exportingPdf ? 'wait' : 'pointer',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)', opacity: exportingPdf ? 0.5 : 1,
                  }}
                >
                  ✉
                </button>
              </>
            )}
          </div>

          {/* Floating toolbar — visible when sidebar is hidden, fullscreen, or mobile.
              Sits below the top-left app-controls toolbar (Panel/Fullscreen/Ruler/PDF/Email)
              so they read as a vertical stack of controls anchored to the top-left. */}
          {(sidebarCollapsed || isMobile) && selectedPlanId && (
            <div style={{
              position: 'absolute', top: 50, left: 10, zIndex: 5,
              display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px 10px', borderRadius: 6,
              background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              maxWidth: 'calc(100vw - 20px)',
            }}>
              <button
                onClick={() => setShowAircraftPicker(true)}
                style={{
                  padding: '4px 10px', borderRadius: 4, fontSize: 'var(--fs-xs)', fontWeight: 600,
                  background: 'color-mix(in srgb, var(--color-cyan) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--color-cyan) 30%, transparent)',
                  color: 'var(--color-cyan)', cursor: 'pointer',
                }}
              >
                + Aircraft
              </button>
              {(['point', 'building', 'line', 'circle'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => { setPlacingObstacle(type); setPlacingAircraft(null) }}
                  style={{
                    padding: '4px 8px', borderRadius: 4, fontSize: 'var(--fs-xs)',
                    background: placingObstacle === type ? 'color-mix(in srgb, var(--color-orange) 13%, transparent)' : 'transparent',
                    border: `1px solid ${placingObstacle === type ? 'var(--color-orange)' : 'var(--color-border)'}`,
                    color: placingObstacle === type ? 'var(--color-orange)' : 'var(--color-text-secondary)',
                    cursor: 'pointer', textTransform: 'capitalize',
                  }}
                >
                  {type}
                </button>
              ))}
              <div style={{ width: 1, background: 'var(--color-border)', margin: '0 2px' }} />
              <button
                onClick={() => handleStartTaxilane('interior')}
                disabled={!!drawingTaxilaneId}
                title="Draw an interior taxilane"
                style={{
                  padding: '4px 8px', borderRadius: 4, fontSize: 'var(--fs-xs)',
                  background: 'color-mix(in srgb, var(--color-blue) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--color-blue) 30%, transparent)',
                  color: 'var(--color-status-inwork)', cursor: 'pointer',
                  opacity: drawingTaxilaneId ? 0.5 : 1,
                }}
              >
                + Interior Taxilane
              </button>
              <button
                onClick={() => handleStartTaxilane('peripheral')}
                disabled={!!drawingTaxilaneId}
                title="Draw a peripheral taxilane"
                style={{
                  padding: '4px 8px', borderRadius: 4, fontSize: 'var(--fs-xs)',
                  background: 'color-mix(in srgb, var(--color-violet) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--color-violet) 30%, transparent)',
                  color: 'var(--color-violet)', cursor: 'pointer',
                  opacity: drawingTaxilaneId ? 0.5 : 1,
                }}
              >
                + Peripheral Taxilane
              </button>
              <button
                onClick={handleStartBoundary}
                disabled={!!drawingBoundaryId}
                style={{
                  padding: '4px 8px', borderRadius: 4, fontSize: 'var(--fs-xs)',
                  background: 'color-mix(in srgb, var(--color-success) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--color-success) 30%, transparent)',
                  color: 'var(--color-success)', cursor: 'pointer',
                  opacity: drawingBoundaryId ? 0.5 : 1,
                }}
              >
                + Boundary
              </button>
              <div style={{ width: 1, background: 'var(--color-border)', margin: '0 2px' }} />
              <button
                onClick={() => setPlanLocked(l => !l)}
                title={planLocked ? 'Aircraft locked — click to enable dragging' : 'Aircraft unlocked — click to lock'}
                style={{
                  padding: '4px 8px', borderRadius: 4, fontSize: 'var(--fs-xs)', fontWeight: 600,
                  background: planLocked ? 'color-mix(in srgb, var(--color-danger) 13%, transparent)' : 'color-mix(in srgb, var(--color-success) 13%, transparent)',
                  border: `1px solid ${planLocked ? 'color-mix(in srgb, var(--color-danger) 30%, transparent)' : 'color-mix(in srgb, var(--color-success) 30%, transparent)'}`,
                  color: planLocked ? 'var(--color-danger)' : 'var(--color-success)',
                  cursor: 'pointer',
                }}
              >
                {planLocked ? 'AC Locked' : 'AC Unlocked'}
              </button>
              <button
                onClick={() => setObstaclesLocked(l => !l)}
                title={obstaclesLocked ? 'Obstacles locked — click to enable dragging' : 'Obstacles unlocked — click to lock'}
                style={{
                  padding: '4px 8px', borderRadius: 4, fontSize: 'var(--fs-xs)', fontWeight: 600,
                  background: obstaclesLocked ? 'color-mix(in srgb, var(--color-orange) 13%, transparent)' : 'color-mix(in srgb, var(--color-success) 13%, transparent)',
                  border: `1px solid ${obstaclesLocked ? 'color-mix(in srgb, var(--color-orange) 30%, transparent)' : 'color-mix(in srgb, var(--color-success) 30%, transparent)'}`,
                  color: obstaclesLocked ? 'var(--color-orange)' : 'var(--color-success)',
                  cursor: 'pointer',
                }}
              >
                {obstaclesLocked ? 'OB Locked' : 'OB Unlocked'}
              </button>
            </div>
          )}

          {/* Violation summary — bottom right when panel hidden or fullscreen (desktop only) */}
          {!isMobile && sidebarCollapsed && (violations.length > 0 || warnings.length > 0) && (
            <div style={{
              position: 'absolute', bottom: 24, right: 10, zIndex: 5,
              padding: '6px 12px', borderRadius: 6,
              background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              display: 'flex', gap: 8, fontSize: 'var(--fs-xs)', fontWeight: 600,
            }}>
              {violations.length > 0 && <span style={{ color: 'var(--color-danger)' }}>{violations.length} Violation{violations.length !== 1 ? 's' : ''}</span>}
              {warnings.length > 0 && <span style={{ color: 'var(--color-warning)' }}>{warnings.length} Warning{warnings.length !== 1 ? 's' : ''}</span>}
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile Bottom Sheet ── */}
      {isMobile && !isFullscreen && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
          display: 'flex', flexDirection: 'column',
          maxHeight: sheetExpanded ? '75vh' : 48,
          transition: 'max-height 0.25s ease',
          background: 'var(--color-bg-surface)',
          borderTop: '1px solid var(--color-border)',
          boxShadow: '0 -2px 12px rgba(0,0,0,0.4)',
          borderRadius: '12px 12px 0 0',
          overflow: 'hidden',
        }}>
          {/* Drag handle + summary bar */}
          <div
            onClick={() => setSheetExpanded(e => !e)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
              cursor: 'pointer', flexShrink: 0, minHeight: 48,
            }}
          >
            <div style={{
              width: 36, height: 4, borderRadius: 2, background: 'var(--color-text-secondary)',
              opacity: 0.4, flexShrink: 0,
            }} />
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-primary)', flex: 1 }}>
              {selectedPlan?.plan_name || 'No Plan'}
            </span>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>{spots.length} AC</span>
            {violations.length > 0 && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-danger)', fontWeight: 600 }}>{violations.length} Viol</span>}
            {warnings.length > 0 && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-warning)', fontWeight: 600 }}>{warnings.length} Warn</span>}
            <span style={{ fontSize: 14, color: 'var(--color-text-secondary)', transform: sheetExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>&#9650;</span>
          </div>
          {/* Expandable content */}
          {sheetExpanded && (
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
              {sidebarContent(true)}
            </div>
          )}
        </div>
      )}

      {/* Context Menu — right-click / long-press on aircraft silhouette */}
      {contextMenuSpot && editingSpot && (() => {
        const s = editingSpot
        const swa = spotsWithAircraft.find(sw => sw.id === s.id)
        const ws = swa?.wingspan_ft ?? 0
        const ctxInputStyle: React.CSSProperties = { width: '100%', padding: '4px 6px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)', fontFamily: 'inherit' }
        const ctxLabelStyle: React.CSSProperties = { fontSize: 'var(--fs-2xs)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 2 }
        return (
          <div
            onClick={() => setContextMenuSpot(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 999 }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'fixed',
                left: Math.min(contextMenuSpot.x, (typeof window !== 'undefined' ? window.innerWidth - 260 : 300)),
                top: Math.min(contextMenuSpot.y, (typeof window !== 'undefined' ? window.innerHeight - 380 : 400)),
                width: 250, background: 'var(--color-bg-surface)', borderRadius: 10,
                border: '1px solid var(--color-border)', overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            >
              {/* Header */}
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-cyan)' }}>
                {s.aircraft_name || 'Aircraft'}
              </div>

              <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Spot Name / Tail # / Callsign */}
                <div style={{ display: 'flex', gap: 4 }}>
                  <label style={{ flex: 1 }}>
                    <span style={ctxLabelStyle}>Spot Name</span>
                    <input value={s.spot_name || ''} onChange={e => handleUpdateSpot(s.id, { spot_name: e.target.value })} style={ctxInputStyle} />
                  </label>
                  <label style={{ flex: 1 }}>
                    <span style={ctxLabelStyle}>Tail #</span>
                    <input value={s.tail_number || ''} onChange={e => handleUpdateSpot(s.id, { tail_number: e.target.value })} style={ctxInputStyle} />
                  </label>
                </div>
                <label>
                  <span style={ctxLabelStyle}>Callsign</span>
                  <input value={s.unit_callsign || ''} onChange={e => handleUpdateSpot(s.id, { unit_callsign: e.target.value })} style={ctxInputStyle} />
                </label>

                {/* Heading */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ ...ctxLabelStyle, marginBottom: 0, flexShrink: 0 }}>Heading</span>
                  <input type="range" min={0} max={360} step={1} value={s.heading_deg} onChange={e => handleUpdateSpot(s.id, { heading_deg: Number(e.target.value) })} style={{ flex: 1 }} />
                  <input type="number" min={0} max={360} step={1} value={s.heading_deg}
                    onChange={e => { const v = Math.min(360, Math.max(0, Number(e.target.value) || 0)); handleUpdateSpot(s.id, { heading_deg: v }) }}
                    style={{ width: 40, padding: '2px 4px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)', textAlign: 'center' }}
                  />
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>°</span>
                </div>

                {/* Clearance */}
                <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-secondary)', flexShrink: 0 }}>Clearance:</span>
                  {[null, 10, 15, 25].map(val => (
                    <button key={val ?? 'adg'} onClick={() => handleUpdateSpot(s.id, { clearance_ft: val as any })} style={{
                      padding: '2px 5px', borderRadius: 3, fontSize: 'var(--fs-2xs)', border: '1px solid var(--color-border)',
                      background: s.clearance_ft === val ? 'color-mix(in srgb, var(--color-cyan) 13%, transparent)' : 'var(--color-bg-inset)',
                      color: s.clearance_ft === val ? 'var(--color-cyan)' : 'var(--color-text-secondary)', cursor: 'pointer',
                    }}>
                      {val ? `${val}ft` : `UFC (${getWingtipClearance(ws, apronContext, s.aircraft_name)}ft)`}
                    </button>
                  ))}
                </div>

                {/* Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-secondary)' }}>Status:</span>
                  <select value={s.status} onChange={e => handleUpdateSpot(s.id, { status: e.target.value as ParkingSpot['status'] })}
                    style={{ flex: 1, padding: '3px 6px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)', fontFamily: 'inherit' }}>
                    <option value="available">Available</option>
                    <option value="occupied">Occupied</option>
                    <option value="reserved">Reserved</option>
                  </select>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 0, borderTop: '1px solid var(--color-border)' }}>
                <button onClick={() => { (() => { map.current?.gmap.panTo({ lat: s.latitude, lng: s.longitude }); map.current?.gmap.setZoom(19) })(); setContextMenuSpot(null) }}
                  style={{ flex: 1, padding: '8px 0', border: 'none', borderRight: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: 'var(--fs-xs)', cursor: 'pointer', fontFamily: 'inherit' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-inset)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  Fly To
                </button>
                <button onClick={() => { handleDuplicateSpot(s); setContextMenuSpot(null) }}
                  style={{ flex: 1, padding: '8px 0', border: 'none', borderRight: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-cyan)', fontSize: 'var(--fs-xs)', cursor: 'pointer', fontFamily: 'inherit' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-inset)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  Duplicate
                </button>
                <button onClick={() => { handleDeleteSpot(s.id); setContextMenuSpot(null); setEditingSpot(null) }}
                  style={{ flex: 1, padding: '8px 0', border: 'none', background: 'transparent', color: 'var(--color-danger)', fontSize: 'var(--fs-xs)', cursor: 'pointer', fontFamily: 'inherit' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in srgb, var(--color-danger) 8%, transparent)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  Remove
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Aircraft Picker Modal */}
      {showAircraftPicker && (
        <div
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowAircraftPicker(false) }}
          className="modal-overlay"
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 'var(--fs-base)', color: 'var(--color-text-primary)' }}>
                  Select Aircraft
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>Hdg:</span>
                    <input
                      type="number" min={0} max={359} value={placementHeading}
                      onChange={e => {
                        const n = parseInt(e.target.value, 10)
                        if (!isNaN(n)) setPlacementHeading(((n % 360) + 360) % 360)
                      }}
                      onFocus={e => e.target.select()}
                      style={{
                        width: 48, padding: '3px 4px', borderRadius: 4, textAlign: 'center',
                        border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                        color: placementHeading !== 0 ? 'var(--color-cyan)' : 'var(--color-text-primary)',
                        fontSize: 'var(--fs-sm)', fontWeight: 700,
                      }}
                    />
                    <span style={{ fontSize: 9, color: 'var(--color-text-secondary)' }}>&deg;</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>Qty:</span>
                    <input
                      type="number" min={1} max={50} value={bulkAddCount}
                      onChange={e => {
                        const raw = e.target.value
                        if (raw === '') { setBulkAddCount(''); return }
                        const n = parseInt(raw, 10)
                        if (!isNaN(n)) setBulkAddCount(Math.min(50, n))
                      }}
                      onBlur={() => { if (bulkAddCount === '' || bulkAddCount < 1) setBulkAddCount(1) }}
                      onFocus={e => e.target.select()}
                      style={{
                        width: 48, padding: '3px 4px', borderRadius: 4, textAlign: 'center',
                        border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                        color: (bulkAddCount || 0) > 1 ? 'var(--color-cyan)' : 'var(--color-text-primary)',
                        fontSize: 'var(--fs-sm)', fontWeight: 700,
                      }}
                    />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {(['all', 'military', 'commercial'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setAircraftCategoryFilter(cat)}
                    style={{
                      flex: 1, padding: '4px 8px', borderRadius: 4, fontSize: 'var(--fs-xs)',
                      border: `1px solid ${aircraftCategoryFilter === cat ? 'var(--color-cyan)' : 'var(--color-border)'}`,
                      background: aircraftCategoryFilter === cat ? 'color-mix(in srgb, var(--color-cyan) 7%, transparent)' : 'var(--color-bg)',
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
                const isFav = favoriteAircraft.includes(ac.aircraft)
                return (
                  <div
                    key={ac.aircraft}
                    style={{
                      display: 'flex', alignItems: 'center', width: '100%',
                      borderBottom: '1px solid var(--color-border)',
                      background: isFav ? 'color-mix(in srgb, var(--color-cyan) 3%, transparent)' : 'transparent',
                    }}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavoriteAircraft(ac.aircraft) }}
                      title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                      style={{
                        padding: '8px 4px 8px 12px', border: 'none', background: 'transparent',
                        cursor: 'pointer', fontSize: 16, color: isFav ? 'var(--color-warning)' : 'var(--color-text-secondary)',
                        opacity: isFav ? 1 : 0.3, flexShrink: 0,
                      }}
                    >
                      {isFav ? '\u2605' : '\u2606'}
                    </button>
                    <button
                      onClick={() => {
                        setPlacingAircraft(ac)
                        setShowAircraftPicker(false)
                        setAircraftSearch('')
                        setPlacingObstacle(null)
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, flex: 1,
                        padding: '8px 16px 8px 6px', border: 'none',
                        background: 'transparent', cursor: 'pointer', textAlign: 'left',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 500 }}>{ac.aircraft}</div>
                        {ws > 0 && (
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                            {ws}ft wingspan
                          </div>
                        )}
                      </div>
                      {adg && (
                        <span style={{
                          fontSize: 10, padding: '1px 6px', borderRadius: 3,
                          background: `color-mix(in srgb, ${ADG_COLORS[adg]} 13%, transparent)`, color: ADG_COLORS[adg],
                          fontWeight: 600,
                        }}>
                          ADG {adg}
                        </span>
                      )}
                    </button>
                  </div>
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
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowNewPlan(false) }}
          className="modal-overlay"
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
            <label style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)', marginBottom: 16, cursor: 'pointer' }}>
              <span
                onClick={() => setNewPlanIsTemplate(!newPlanIsTemplate)}
                style={{
                  width: 18, height: 18, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${newPlanIsTemplate ? 'var(--color-purple)' : 'var(--color-border)'}`,
                  background: newPlanIsTemplate ? 'color-mix(in srgb, var(--color-purple) 13%, transparent)' : 'var(--color-bg)',
                  color: 'var(--color-purple)', fontSize: 12, fontWeight: 700,
                }}
              >
                {newPlanIsTemplate ? '\u2713' : ''}
              </span>
              <span onClick={() => setNewPlanIsTemplate(!newPlanIsTemplate)}>
                Create as reusable template
              </span>
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowNewPlan(false); setNewPlanIsTemplate(false) }}
                style={{ padding: '6px 16px', borderRadius: 4, background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlan}
                disabled={!newPlanName.trim()}
                style={{
                  padding: '6px 16px', borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: newPlanName.trim() ? (newPlanIsTemplate ? 'var(--color-purple)' : 'var(--color-cyan)') : 'var(--color-border)',
                  color: newPlanName.trim() ? '#fff' : 'var(--color-text-secondary)',
                  fontWeight: 500,
                }}
              >
                {newPlanIsTemplate ? 'Create Template' : 'Create Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Plan Modal */}
      {showDuplicateModal && selectedPlan && (
        <div
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowDuplicateModal(false) }}
          className="modal-overlay"
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 400, background: 'var(--color-bg-surface)',
              borderRadius: 8, border: '1px solid var(--color-border)', padding: 20,
            }}
          >
            <h3 style={{ margin: '0 0 4px', fontSize: 'var(--fs-base)', color: 'var(--color-text-primary)' }}>
              Duplicate Plan
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
              Copies all aircraft, taxilanes, and apron boundaries from &ldquo;{selectedPlan.plan_name}&rdquo;
            </p>
            <label style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
              New Plan Name *
              <input
                autoFocus
                value={duplicateName}
                onChange={e => setDuplicateName(e.target.value)}
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 4, marginTop: 4,
                  border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                  color: 'var(--color-text-primary)', fontSize: 'var(--fs-sm)',
                }}
              />
            </label>
            <label style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
              Description
              <textarea
                value={duplicateDesc}
                onChange={e => setDuplicateDesc(e.target.value)}
                rows={2}
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 4, marginTop: 4,
                  border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                  color: 'var(--color-text-primary)', fontSize: 'var(--fs-sm)', resize: 'vertical',
                }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)', marginBottom: 16, cursor: 'pointer' }}>
              <span
                onClick={() => setDuplicateAsTemplate(!duplicateAsTemplate)}
                style={{
                  width: 18, height: 18, borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${duplicateAsTemplate ? 'var(--color-purple)' : 'var(--color-border)'}`,
                  background: duplicateAsTemplate ? 'color-mix(in srgb, var(--color-purple) 13%, transparent)' : 'var(--color-bg)',
                  color: 'var(--color-purple)', fontSize: 12, fontWeight: 700,
                }}
              >
                {duplicateAsTemplate ? '\u2713' : ''}
              </span>
              <span onClick={() => setDuplicateAsTemplate(!duplicateAsTemplate)}>
                Duplicate as template
              </span>
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowDuplicateModal(false); setDuplicateName(''); setDuplicateDesc(''); setDuplicateAsTemplate(false) }}
                style={{ padding: '6px 16px', borderRadius: 4, background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDuplicatePlan}
                disabled={!duplicateName.trim()}
                style={{
                  padding: '6px 16px', borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: duplicateName.trim() ? 'var(--color-cyan)' : 'var(--color-border)',
                  color: duplicateName.trim() ? '#fff' : 'var(--color-text-secondary)',
                  fontWeight: 500,
                }}
              >
                Duplicate
              </button>
            </div>
          </div>
        </div>
      )}

      <EmailPdfModal
        open={emailModalOpen}
        onClose={() => { setEmailModalOpen(false); setEmailPdfData(null) }}
        onSend={async (email: string) => {
          if (!emailPdfData) return
          setSendingEmail(true)
          const result = await sendPdfViaEmail(emailPdfData.doc, emailPdfData.filename, email, `Parking Plan: ${selectedPlan?.plan_name || 'Export'}`)
          if (result.success) {
            toast.success('Email sent successfully')
            setEmailModalOpen(false)
            setEmailPdfData(null)
          } else {
            toast.error(result.error || 'Failed to send email')
          }
          setSendingEmail(false)
        }}
        sending={sendingEmail}
        filename={emailPdfData?.filename}
        defaultEmail={defaultPdfEmail}
      />
      {/* Global styles for map labels */}
      <style>{`
        .parking-ac-label {
          text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 -1px 0 #000, 0 1px 0 #000, -1px 0 0 #000, 1px 0 0 #000;
        }
        .parking-drag-label {
          text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
        }
      `}</style>
    </div>
  )
}
