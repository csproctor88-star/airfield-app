'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { initGoogleMaps, isGoogleMapsConfigured, GOOGLE_MAP_OPTIONS, type GMapWrapper, createGMapWrapper, pixelToLatLng, queryFeatureAtPoint, clearAllObjects } from '@/lib/google-map-adapter'
import { applyMapProvider } from '@/lib/map-providers'
import { toast } from 'sonner'
import { useGoogleMapRuler } from '@/hooks/use-google-map-ruler'
import { useInstallation } from '@/lib/installation-context'
import { baseDistanceUnit, fmtDistance } from '@/lib/distance-units'
import { formatCoordsDMS } from '@/lib/utils'
import { allAircraft } from '@/lib/aircraft-data'
import type { AircraftCharacteristics } from '@/lib/aircraft_database_schema'
import silhouetteManifest from '@/public/aircraft_silhouette_manifest.json'
import { NumberField } from '@/components/ui/number-field'
import { HeadingSlider } from '@/components/ui/heading-slider'
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
  findAllViolations,
  getAllClearanceResults,
  getClearanceDetail,
  parkingStandardForBase,
  generateClearanceZonePolygon,
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
import { sendPdfViaEmail } from '@/lib/email-pdf'
import EmailPdfModal from '@/components/ui/email-pdf-modal'
import {
  MoreVertical, Star,
  PanelLeft, PanelLeftClose, Maximize2, Minimize2, Ruler as RulerIcon,
  Plane, MapPin, Building2, Minus, Circle as CircleIcon,
  ArrowRight, ArrowLeftRight, Square,
  Lock, Unlock, Download, Mail, X,
} from 'lucide-react'

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

// Build an un-rotated, padded base canvas for an aircraft type. The image
// is centered inside a fixedDim × fixedDim canvas so that rotating around
// the canvas center rotates around the aircraft center.
async function buildBaseSilhouetteCanvas(
  aircraftName: string,
  wingspanFt: number,
  lengthFt: number,
): Promise<HTMLCanvasElement> {
  const result = await renderSilhouetteImage(aircraftName, wingspanFt, lengthFt)
  const imgData = result || renderFallbackIcon()
  const fixedDim = Math.max(imgData.width, imgData.height) + 16
  const canvas = document.createElement('canvas')
  canvas.width = fixedDim
  canvas.height = fixedDim
  const ctx = canvas.getContext('2d')!
  const ox = Math.round((fixedDim - imgData.width) / 2)
  const oy = Math.round((fixedDim - imgData.height) / 2)
  ctx.putImageData(imgData.imageData, ox, oy)
  return canvas
}

// Synchronously rotate a cached base canvas and return a data URL ready to
// hand to google.maps.Marker.setIcon. Canvas-to-canvas drawImage is sync
// (unlike Image.onload), so this runs in a few ms per call — fast enough
// to do 60×/sec during slider drag.
function rotateBaseCanvas(baseCanvas: HTMLCanvasElement, headingDeg: number): { url: string; fixedDim: number } {
  const fixedDim = baseCanvas.width
  const rotCanvas = document.createElement('canvas')
  rotCanvas.width = fixedDim
  rotCanvas.height = fixedDim
  const rotCtx = rotCanvas.getContext('2d')!
  rotCtx.translate(fixedDim / 2, fixedDim / 2)
  rotCtx.rotate((headingDeg * Math.PI) / 180)
  rotCtx.drawImage(baseCanvas, -fixedDim / 2, -fixedDim / 2)
  return { url: rotCanvas.toDataURL('image/png'), fixedDim }
}

// Ray-cast point-in-polygon. `vertices` is a closed quadrilateral (or any
// polygon) given in lat/lng. Used to filter parking spots / obstacles by
// whether they sit inside the on-screen capture frame after the four
// pixel corners have been projected to lat/lng — works correctly under
// map rotation because the projection has already applied it.
function pointInLatLngPolygon(
  point: { lat: number; lng: number },
  vertices: { lat: number; lng: number }[],
): boolean {
  let inside = false
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].lng, yi = vertices[i].lat
    const xj = vertices[j].lng, yj = vertices[j].lat
    const intersects = (yi > point.lat) !== (yj > point.lat)
      && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

// The capture pipeline temporarily resizes the map to CAPTURE_W × CAPTURE_H
// and snaps that. Because Google Maps keeps the same center lat/lng across
// a resize, the captured geographic area is a CAPTURE_W × CAPTURE_H pixel
// rectangle centered on the current map center — which corresponds to a
// rectangle of the same pixel dimensions centered in the live viewport.
const CAPTURE_W = 1600
const CAPTURE_H = 900

// Position of the actual captured area within the user's current viewport.
// Returns the outline rectangle in CSS pixels (may have negative x/y or
// extend past the viewport if the viewport is smaller than the capture —
// that's intentional, it tells the user the capture will include more
// than what's on screen).
function captureOutlineRect(viewportW: number, viewportH: number): { w: number; h: number; x: number; y: number } {
  return {
    w: CAPTURE_W,
    h: CAPTURE_H,
    x: Math.round((viewportW - CAPTURE_W) / 2),
    y: Math.round((viewportH - CAPTURE_H) / 2),
  }
}

/** Compute the icon-size scale factor to make a REF_ICON_SIZE image match
 *  the aircraft's real-world wingspan at the current map zoom.
 *  Derived purely from zoom + latitude via the Mercator meters-per-pixel
 *  formula — independent of map rotation. The previous implementation
 *  used gmap.getBounds() to derive pixels-per-degree, which returned the
 *  AABB of the rotated visible area (expanded by ~√2 at 45°), so icons
 *  rendered wrong-sized when the user rotated the map. */
function computeIconScale(wingspanFt: number, lengthFt: number, gmap: google.maps.Map): number {
  const center = gmap.getCenter()
  const zoom = gmap.getZoom()
  if (!center || zoom == null) return 0.1

  // Web Mercator meters-per-pixel: 156543.03392 at the equator at zoom 0,
  // scaled by cos(lat) for the projection and 1/2^Z for the zoom level.
  const lat = center.lat()
  const mpp = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom)
  if (!isFinite(mpp) || mpp <= 0) return 0.1

  // Wingspan in screen pixels at the current zoom.
  const wingspanM = wingspanFt * FT_TO_M
  const targetPx = wingspanM / mpp

  // Divide by SVG drawing width (w), not canvas width (w+8). Apply 1.03
  // overcompensation so silhouettes render slightly larger than actual —
  // SVG wing-tip artwork doesn't extend to the exact bounding box edge.
  // Oversized is safer than undersized for clearance planning.
  const aspect = lengthFt / wingspanFt
  const svgDrawW = aspect >= 1 ? Math.round(REF_ICON_SIZE / aspect) : REF_ICON_SIZE

  return Math.max(0.02, Math.min((targetPx / svgDrawW) * 1.03, 4.0))
}

// ── Main Page ──

export default function ParkingPage() {
  const { installationId, currentInstallation, runways, defaultPdfEmail, mapProvider } = useInstallation()
  // Base display unit for parking dimensions + clearances. Values are STORED in
  // feet (UFC engine works in feet); this only reformats them for display, so an
  // overseas metric base sees metres everywhere. Feet is the identity case.
  const resultUnit = baseDistanceUnit(currentInstallation)
  // Parking clearance standard follows the base's obstruction standard (UFC
  // wingtip / ICAO code-letter / USAFE 32-1007). Drives clearances + citations.
  const parkingStandard = parkingStandardForBase(currentInstallation)
  const stdLabel = parkingStandard === 'icao' ? 'ICAO' : parkingStandard === 'usafe_32_1007' ? '32-1007' : 'UFC'

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
  const [showEditPlan, setShowEditPlan] = useState(false)
  const [editPlanName, setEditPlanName] = useState('')
  const [editPlanDesc, setEditPlanDesc] = useState('')
  const [savingPlanEdit, setSavingPlanEdit] = useState(false)
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
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>({ aircraft: true, obstacles: true, taxilanes: true, boundaries: true, clearance: true, labels: true })
  const toggleLayerVisibility = (key: string) => setVisibleLayers(prev => ({ ...prev, [key]: !prev[key] }))
  const toggleSection = (key: string) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  const [aircraftCategoryFilter, setAircraftCategoryFilter] = useState<'all' | 'military' | 'commercial'>('all')
  const [editingTaxilane, setEditingTaxilane] = useState<ParkingTaxilane | null>(null)
  const [editingBoundary, setEditingBoundary] = useState<ParkingApronBoundary | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  // Map heading — drives counter-rotation of aircraft icons so they stay
  // visually screen-anchored (West always points the same way on screen
  // regardless of how the map is rotated).
  const [mapHeadingDeg, setMapHeadingDeg] = useState(0)
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
  // Tracks whether the silent warm-up cycle has primed Google Maps's internal
  // tile cache for the export's resize-to-1600x900 target. Without this prime,
  // the first export after page load returns gray tiles because the WebGL
  // drawing buffer behind the vector renderer is cleared between frames.
  // Real user interaction (pan/zoom/placement) primes it naturally; the
  // effect below does the same thing programmatically once on map mount.
  const [mapWarmedUp, setMapWarmedUp] = useState(false)
  // PDF capture framing mode. When non-null, an overlay shows the 16:9
  // capture frame + a Cancel / Confirm banner. The user pans/zooms to
  // position content inside the frame, then confirms — which runs the
  // capture pipeline. Set by handleExportPdf / handleEmailPdf.
  const [framingMode, setFramingMode] = useState<'pdf' | 'email' | null>(null)
  // Live map-container pixel size — drives the frame overlay so it
  // matches the actual mapDiv dimensions.
  const [mapSize, setMapSize] = useState<{ w: number; h: number } | null>(null)
  // Queue of captured aprons accumulated via Add Apron. Single-apron
  // exports leave this empty; multi-apron exports build it up while the
  // user repositions between Add Apron clicks and finalize on Confirm.
  type PendingApron = {
    label: string
    mapDataUrl: string | null
    spots: ParkingSpot[]
    spotsWithAircraft: SpotWithAircraft[]
    allResults: ClearanceResult[]
    violations: ClearanceResult[]
    warnings: ClearanceResult[]
  }
  const [pendingAprons, setPendingAprons] = useState<PendingApron[]>([])
  const [apronNamePrompt, setApronNamePrompt] = useState<{ open: boolean; draft: string; intent: 'add' | 'confirm' }>({ open: false, draft: '', intent: 'add' })

  // Lock mode — prevents dragging when locked
  const [planLocked, setPlanLocked] = useState(false)
  const planLockedRef = useRef(planLocked)
  planLockedRef.current = planLocked
  const [obstaclesLocked, setObstaclesLocked] = useState(true) // obstacles locked by default
  const obstaclesLockedRef = useRef(obstaclesLocked)
  obstaclesLockedRef.current = obstaclesLocked

  // Sidebar tab navigation
  const [sidebarTab, setSidebarTab] = useState<'aircraft' | 'environment' | 'clearance' | 'settings'>('aircraft')

  // Tour-driven UI hooks. The OnboardingTour engine fires
  // glidepath:tour-parking-* events on each step's `dispatchOnEnter`;
  // the parking module is the only consumer that actually mutates
  // page state from a tour step (most pages just need anchors). This
  // lets the tour walk a user through opening the panel, switching
  // tabs, and showing the aircraft picker so they see the actual
  // surfaces being explained instead of a static screenshot.
  useEffect(() => {
    const openPanel = () => setSidebarCollapsed(false)
    const closePanel = () => setSidebarCollapsed(true)
    const setTab = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail === 'aircraft' || detail === 'environment' || detail === 'clearance' || detail === 'settings') {
        // Close the picker if it's open. The picker is a fullscreen modal
        // overlay; without this, switching tabs from a step that just
        // showed the picker leaves the modal covering the tab bar so the
        // tour spotlight has nothing to anchor on.
        setShowAircraftPicker(false)
        setSidebarCollapsed(false)
        setSidebarTab(detail)
      }
    }
    const showPicker = () => { setSidebarCollapsed(false); setShowAircraftPicker(true) }
    const hidePicker = () => setShowAircraftPicker(false)
    window.addEventListener('glidepath:tour-parking-open-panel', openPanel)
    window.addEventListener('glidepath:tour-parking-close-panel', closePanel)
    window.addEventListener('glidepath:tour-parking-set-tab', setTab)
    window.addEventListener('glidepath:tour-parking-show-picker', showPicker)
    window.addEventListener('glidepath:tour-parking-hide-picker', hidePicker)
    return () => {
      window.removeEventListener('glidepath:tour-parking-open-panel', openPanel)
      window.removeEventListener('glidepath:tour-parking-close-panel', closePanel)
      window.removeEventListener('glidepath:tour-parking-set-tab', setTab)
      window.removeEventListener('glidepath:tour-parking-show-picker', showPicker)
      window.removeEventListener('glidepath:tour-parking-hide-picker', hidePicker)
    }
  }, [])

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
  // Cache the un-rotated, padded base canvas per aircraft type. Used by
  // imperativeRotateSpot to spin the icon synchronously during slider drag
  // (bypassing the React → map effect → async SVG re-render chain).
  // Key: `${aircraftName}-${wingspanFt}-${lengthFt}`.
  const baseSilhouetteCanvasRef = useRef<Map<string, HTMLCanvasElement>>(new Map())
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
  const mapHeadingDegRef = useRef(0)
  mapHeadingDegRef.current = mapHeadingDeg

  // Synchronously spin one spot's icon by setting a freshly-rotated icon URL
  // straight on the google.maps.Marker. Skips React + the async map effect
  // entirely — used by the slider drag preview so the aircraft rotates
  // smoothly under the cursor without waiting for a Supabase round-trip
  // or an SVG re-render. Returns true if the icon was updated, false if
  // the base canvas isn't cached yet (caller should fall back to setSpots).
  const imperativeRotateSpot = useCallback((spotId: string, headingDeg: number): boolean => {
    const w = map.current
    if (!w) return false
    const spot = spotsWithAircraftRef.current.find(s => s.id === spotId)
    if (!spot) return false
    const marker = spotMarkersMapRef.current.get(spotId)
    if (!marker) return false
    const baseKey = `${spot.aircraft_name || '__fallback'}-${spot.wingspan_ft}-${spot.length_ft}`
    const baseCanvas = baseSilhouetteCanvasRef.current.get(baseKey)
    if (!baseCanvas) return false
    const effective = ((headingDeg - mapHeadingDegRef.current + 360) % 360)
    const { url, fixedDim } = rotateBaseCanvas(baseCanvas, effective)
    const iconScale = computeIconScale(spot.wingspan_ft, spot.length_ft, w.gmap)
    const displayDim = Math.min(800, Math.max(8, Math.round(fixedDim * iconScale)))
    marker.setIcon({
      url,
      scaledSize: new google.maps.Size(displayDim, displayDim),
      anchor: new google.maps.Point(displayDim / 2, displayDim / 2),
    } as google.maps.Icon)
    return true
  }, [])

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
    () => getAllClearanceResults(spotsWithAircraft, obstacles, apronContext, taxilanesForCheck.length > 0 ? taxilanesForCheck : undefined, parkingStandard),
    [spotsWithAircraft, obstacles, apronContext, taxilanesForCheck, parkingStandard]
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
      // Vector Map ID enables smooth arbitrary heading rotation (Ctrl+drag).
      // Tile capture in PDF exports works after a warm-up cycle that mimics
      // the natural user interactions (pan/zoom/resize) that prime Google's
      // internal tile cache — see the warm-up effect below. Without the
      // warm-up, the first export after page load returns gray tiles
      // because Google's vector renderer draws to a WebGL canvas without
      // preserveDrawingBuffer set.
      mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_VECTOR_MAP_ID,
      tilt: 0, // locked at 0 — tilt breaks aircraft icon scaling
      rotateControl: true,
      heading: 0,
    })

    applyMapProvider(gmap, mapProvider)

    const wrapper = createGMapWrapper(gmap)
    map.current = wrapper
    gmapRawRef.current = gmap

    // Google Maps is ready immediately after construction — tiles load async
    google.maps.event.addListenerOnce(gmap, 'tilesloaded', () => {
      setMapLoaded(true)
    })

    // Track map container pixel size for the capture-frame overlay
    const el = mapContainer.current
    let resizeObs: ResizeObserver | null = null
    if (el) {
      const update = () => setMapSize({ w: el.clientWidth, h: el.clientHeight })
      update()
      if (typeof ResizeObserver !== 'undefined') {
        resizeObs = new ResizeObserver(update)
        resizeObs.observe(el)
      }
    }

    return () => {
      if (resizeObs) resizeObs.disconnect()
      if (map.current) {
        clearAllObjects(map.current)
        map.current = null
        setMapLoaded(false)
      }
    }
  }, [googleReady, installationId, runways, mapProvider])

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
            toast.success(`Circle placed (${fmtDistance(radius, resultUnit)} radius)`)
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
            toast.success(`Building placed (${fmtDistance(widthFt, resultUnit, { withUnit: false })}×${fmtDistance(lengthFt, resultUnit)})`)
          }
        }
        setDrawingObsType(null)
        setDrawingObsStart(null)
        setDrawingObsCurrent(null)
        return
      }

      if (placingAircraft && selectedPlanId && installationId) {
        const ws = parseNum(placingAircraft.wing_span_ft)
        const clearance = getWingtipClearance(ws, apronContext, placingAircraft.aircraft, parkingStandard)
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
        const clearanceFt = spot.clearance_ft ?? getWingtipClearance(spot.wingspan_ft, apronContext, spot.aircraft_name, parkingStandard)
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
      const { halfWidth } = getTaxilaneEnvelopeHalfWidth(tlForCheck, parkingStandard)
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
  }, [mapLoaded, spotsWithAircraft, obstacles, taxilanes, apronBoundaries, allResults, showClearances, apronContext, visibleLayers, resultUnit])

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

    // Fast path: same set of spots (same IDs + aircraft names) and every
    // base canvas already cached, meaning any heading change can be applied
    // synchronously without a full marker rebuild. Position-only changes
    // also flow through here (the heading branch is just skipped per spot).
    const prevRendered = renderedSpotsRef.current
    const sameSet = spotsWithAircraft.length === prevRendered.size &&
      spotsWithAircraft.every(s => {
        const prev = prevRendered.get(s.id)
        return prev != null && prev.name === (s.aircraft_name || '')
      })
    const allBasesCached = sameSet && spotsWithAircraft.every(s => {
      const baseKey = `${s.aircraft_name || '__fallback'}-${s.wingspan_ft}-${s.length_ft}`
      return baseSilhouetteCanvasRef.current.has(baseKey)
    })

    if (allBasesCached && spotMarkersMapRef.current.size > 0) {
      for (const spot of spotsWithAircraft) {
        const marker = spotMarkersMapRef.current.get(spot.id)
        if (!marker) continue
        const c = spotCenter(spot)
        marker.setPosition({ lat: c.lat, lng: c.lon })
        marker.setLabel(visibleLayers.labels ? {
          text: `${spot.spot_name || spot.aircraft_name || 'Aircraft'}${spot.tail_number ? '\n' + spot.tail_number : ''}`,
          color: '#FFFFFF',
          fontSize: '11px',
          fontWeight: 'bold',
          className: 'parking-ac-label',
        } : null)

        const effective = Math.round(((spot.heading_deg || 0) - mapHeadingDeg + 360) % 360)
        const prev = prevRendered.get(spot.id)
        if (prev && prev.heading !== effective) {
          // Heading changed — re-rotate the cached base canvas and swap the
          // marker's icon in place. No async work, no marker re-creation.
          const baseKey = `${spot.aircraft_name || '__fallback'}-${spot.wingspan_ft}-${spot.length_ft}`
          const baseCanvas = baseSilhouetteCanvasRef.current.get(baseKey)!
          const { url, fixedDim } = rotateBaseCanvas(baseCanvas, effective)
          const iconScale = computeIconScale(spot.wingspan_ft, spot.length_ft, gmap)
          const displayDim = Math.min(800, Math.max(8, Math.round(fixedDim * iconScale)))
          marker.setIcon({
            url,
            scaledSize: new google.maps.Size(displayDim, displayDim),
            anchor: new google.maps.Point(displayDim / 2, displayDim / 2),
          } as google.maps.Icon)
          const cacheKey = `${spot.id}-${effective}`
          spotMetaRef.current.set(spot.id, { fixedDim, wingspanFt: spot.wingspan_ft, lengthFt: spot.length_ft, cacheKey })
          if (!silhouetteCacheRef.current.has(cacheKey)) {
            silhouetteCacheRef.current.set(cacheKey, { url, fixedDim, heading: effective })
          }
        }
        w.featureIndex.set(`spot-${spot.id}`, { lat: c.lat, lng: c.lon, type: 'aircraft', props: { spotId: spot.id, heading: spot.heading_deg } })
      }
      const spotsWithNoseGear = spotsWithAircraft.filter(s => s.pivot_point_ft > 0)
      spotsWithNoseGear.forEach((spot, i) => {
        if (noseGearMarkersRef.current[i]) noseGearMarkersRef.current[i].setPosition({ lat: spot.latitude, lng: spot.longitude })
      })
      for (const s of spotsWithAircraft) {
        const effective = Math.round(((s.heading_deg || 0) - mapHeadingDeg + 360) % 360)
        renderedSpotsRef.current.set(s.id, { lat: s.latitude, lng: s.longitude, heading: effective, name: s.aircraft_name || '' })
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
        // Effective rotation = aircraft compass heading MINUS map heading.
        // Google Maps applies map.heading on top of our pre-rotated canvas,
        // so subtracting it here cancels out and the icon stays screen-fixed.
        const effectiveHeading = ((spot.heading_deg || 0) - mapHeadingDeg + 360) % 360
        const cacheKey = `${spot.id}-${Math.round(effectiveHeading)}`

        // Use computeIconScale — same formula that worked in Mapbox
        const iconScale = computeIconScale(spot.wingspan_ft, spot.length_ft, gmap)

        // Get or build the un-rotated base canvas for this aircraft type.
        // Shared across all spots of the same aircraft so the heavy SVG
        // render only runs once per type, not once per spot.
        const baseKey = `${spot.aircraft_name || '__fallback'}-${spot.wingspan_ft}-${spot.length_ft}`
        let baseCanvas = baseSilhouetteCanvasRef.current.get(baseKey)
        if (!baseCanvas) {
          baseCanvas = await buildBaseSilhouetteCanvas(spot.aircraft_name || '', spot.wingspan_ft, spot.length_ft)
          baseSilhouetteCanvasRef.current.set(baseKey, baseCanvas)
        }
        if (renderCancelRef.current !== renderToken) return

        // Synchronous rotation now that the base is cached.
        let cached = silhouetteCacheRef.current.get(cacheKey)
        if (!cached) {
          const { url, fixedDim } = rotateBaseCanvas(baseCanvas, effectiveHeading)
          cached = { url, fixedDim, heading: effectiveHeading }
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
          label: visibleLayers.labels ? {
            text: `${spot.spot_name || spot.aircraft_name || 'Aircraft'}${spot.tail_number ? '\n' + spot.tail_number : ''}`,
            color: '#FFFFFF',
            fontSize: '11px',
            fontWeight: 'bold',
            className: 'parking-ac-label',
          } : undefined,
        })
        spotMarkersMapRef.current.set(spot.id, marker)
        spotMetaRef.current.set(spot.id, { fixedDim: cached.fixedDim, wingspanFt: spot.wingspan_ft, lengthFt: spot.length_ft, cacheKey })
        w.featureIndex.set(`spot-${spot.id}`, { lat: c.lat, lng: c.lon, type: 'aircraft', props: { spotId: spot.id, heading: spot.heading_deg } })
        renderedSpotsRef.current.set(spot.id, { lat: spot.latitude, lng: spot.longitude, heading: Math.round(effectiveHeading), name: spot.aircraft_name || '' })
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
  }, [mapLoaded, spotsWithAircraft, visibleLayers.aircraft, visibleLayers.labels, mapHeadingDeg])

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

      // Track how many pool slots are used this frame. Hide any extra at end.
      let usedLabels = 0
      let usedLines = 0

      // Show clearance distance labels + connecting lines during aircraft drag
      if (dragSpotId.current && map.current) {
        const sid = dragSpotId.current
        const draggedSpot = spotsWithAircraftRef.current.find(s => s.id === sid)
        if (draggedSpot) {
          const movedSpot = { ...draggedSpot, longitude: lng, latitude: lat }
          const movedCenter = spotCenter(movedSpot)

          // Where does a ray from an aircraft's center toward a target exit
          // the aircraft's bounding rectangle? Returns that exit point so
          // distance lines attach to the wingtip / nose / tail edge in line
          // with the target — not a fixed cardinal anchor.
          const rectExitPoint = (
            cLat: number, cLon: number, headingDeg: number,
            halfLenFt: number, halfSpanFt: number,
            tLat: number, tLng: number,
          ): { lat: number; lon: number } => {
            const cosCenterLat = Math.cos(cLat * Math.PI / 180)
            const dEast = (tLng - cLon) * 364567 * cosCenterLat
            const dNorth = (tLat - cLat) * 364567
            const hRad = headingDeg * Math.PI / 180
            const sinH = Math.sin(hRad)
            const cosH = Math.cos(hRad)
            // Body frame: forward (along nose) and lateral (right of nose)
            const fwd = dEast * sinH + dNorth * cosH
            const lat = dEast * cosH - dNorth * sinH
            if (fwd === 0 && lat === 0) return { lat: cLat, lon: cLon }
            const tLatHit = lat === 0 ? Infinity : halfSpanFt / Math.abs(lat)
            const tFwdHit = fwd === 0 ? Infinity : halfLenFt / Math.abs(fwd)
            const tEdge = Math.min(tLatHit, tFwdHit, 1)
            const eFwd = fwd * tEdge
            const eLat = lat * tEdge
            const eEast = eFwd * sinH + eLat * cosH
            const eNorth = eFwd * cosH - eLat * sinH
            return {
              lat: cLat + eNorth / 364567,
              lon: cLon + eEast / (364567 * cosCenterLat),
            }
          }

          // Reuse polyline + label marker instances across frames. Creating
          // new google.maps.Marker / Polyline per move tick allocates DOM
          // nodes and stalls the main thread — the choppiness during drag.
          const addLabel = (fromLat: number, fromLng: number, toLat: number, toLng: number, text: string, color: string) => {
            const path = [{ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng }]
            let line = dragLineRef.current[usedLines]
            if (line) {
              line.setOptions({ path, strokeColor: color })
              if (line.getMap() !== gmap) line.setMap(gmap)
            } else {
              line = new google.maps.Polyline({
                path, strokeColor: color, strokeWeight: 1.5, strokeOpacity: 0.6,
                map: gmap, clickable: false, zIndex: 9998,
              })
              dragLineRef.current.push(line)
            }
            usedLines++

            const fillColor = color === '#22C55E' ? 'rgba(0,80,0,0.85)' : color === '#F59E0B' ? 'rgba(120,80,0,0.85)' : 'rgba(120,0,0,0.85)'
            const position = { lat: (fromLat + toLat) / 2, lng: (fromLng + toLng) / 2 }
            const label = { text, color: '#FFFFFF', fontWeight: 'bold', fontSize: '12px', className: 'parking-drag-label' }
            const icon = {
              path: 'M -30,-10 L 30,-10 L 30,10 L -30,10 Z',
              fillColor, fillOpacity: 1, strokeColor: color, strokeWeight: 1.5, scale: 0.6,
              anchor: new google.maps.Point(0, 0),
            }
            let lbl = dragLabelMarkersRef.current[usedLabels]
            if (lbl) {
              lbl.setPosition(position)
              lbl.setLabel(label)
              lbl.setIcon(icon)
              if (lbl.getMap() !== gmap) lbl.setMap(gmap)
            } else {
              lbl = new google.maps.Marker({
                position, map: gmap, label, icon, clickable: false, zIndex: 9999,
              })
              dragLabelMarkersRef.current.push(lbl)
            }
            usedLabels++
          }

          // Check distances to other aircraft
          for (const other of spotsWithAircraftRef.current) {
            if (other.id === sid) continue
            const dx = (lng - other.longitude) * 364567 * Math.cos(lat * Math.PI / 180)
            const dy = (lat - other.latitude) * 364567
            if (Math.sqrt(dx * dx + dy * dy) > 500) continue
            const result = getAllClearanceResults([movedSpot, other], [], apronContextRef.current, undefined, parkingStandard)
            if (result.length > 0) {
              const r = result[0]
              const color = r.status === 'violation' ? '#EF4444' : r.status === 'warning' ? '#F59E0B' : '#22C55E'
              // Exit point of moved aircraft toward the other's center, and
              // exit point of the other aircraft toward the moved center.
              const otherCenter = spotCenter(other)
              const fromA = rectExitPoint(
                movedCenter.lat, movedCenter.lon, movedSpot.heading_deg,
                movedSpot.length_ft / 2, movedSpot.wingspan_ft / 2,
                otherCenter.lat, otherCenter.lon,
              )
              const toA = rectExitPoint(
                otherCenter.lat, otherCenter.lon, other.heading_deg,
                other.length_ft / 2, other.wingspan_ft / 2,
                movedCenter.lat, movedCenter.lon,
              )
              addLabel(fromA.lat, fromA.lon, toA.lat, toA.lon, `${fmtDistance(r.distance_ft, resultUnit, { withUnit: false })}/${fmtDistance(r.required_ft, resultUnit)}`, color)
            }
          }

          // Check distances to obstacles (single-point target — find the
          // moved-aircraft rectangle's exit point along the line to the obs)
          for (const obs of obstaclesRef.current) {
            const dx = (lng - obs.longitude) * 364567 * Math.cos(lat * Math.PI / 180)
            const dy = (lat - obs.latitude) * 364567
            if (Math.sqrt(dx * dx + dy * dy) > 500) continue
            const result = getAllClearanceResults([movedSpot], [obs], apronContextRef.current, undefined, parkingStandard)
            if (result.length > 0) {
              const r2 = result[0]
              const color = r2.status === 'violation' ? '#EF4444' : r2.status === 'warning' ? '#F59E0B' : '#22C55E'
              const fromA = rectExitPoint(
                movedCenter.lat, movedCenter.lon, movedSpot.heading_deg,
                movedSpot.length_ft / 2, movedSpot.wingspan_ft / 2,
                obs.latitude, obs.longitude,
              )
              addLabel(fromA.lat, fromA.lon, obs.latitude, obs.longitude, `${fmtDistance(r2.distance_ft, resultUnit, { withUnit: false })}/${fmtDistance(r2.required_ft, resultUnit)}`, color)
            }
          }
        }
      }

      // Hide any unused pool slots from this frame (keep the instances alive
      // so subsequent frames / drags can reuse them).
      for (let i = usedLabels; i < dragLabelMarkersRef.current.length; i++) {
        if (dragLabelMarkersRef.current[i].getMap()) dragLabelMarkersRef.current[i].setMap(null)
      }
      for (let i = usedLines; i < dragLineRef.current.length; i++) {
        if (dragLineRef.current[i].getMap()) dragLineRef.current[i].setMap(null)
      }

      mapDiv.style.cursor = 'grabbing'
    }

    const onMouseUp = async (upLat: number, upLng: number) => {
      // Hide pooled drag labels and lines (keep instances for next drag)
      dragLabelMarkersRef.current.forEach(m => { if (m.getMap()) m.setMap(null) })
      dragLineRef.current.forEach(l => { if (l.getMap()) l.setMap(null) })

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
          const { ok, error } = await bulkUpdateSpotPositions(updates)
          if (!ok) {
            toast.error(`Couldn't save new positions: ${error ?? 'unknown error'}. Reverting.`)
            // Snap every moved spot back to its pre-drag position.
            setSpots(prev => prev.map(s => {
              const start = groupSnapshot.get(s.id)
              return start ? { ...s, longitude: start.lng, latitude: start.lat } : s
            }))
          }
          return
        }
        groupDragStartRef.current = new Map()
        const prevSpot = spotsRef.current.find(s => s.id === sid)
        setSpots(prev => prev.map(s => s.id === sid ? { ...s, longitude: lng, latitude: lat } : s))
        const { error: spotErr } = await updateParkingSpot(sid, { longitude: lng, latitude: lat })
        if (spotErr && prevSpot) {
          toast.error(`Couldn't save new position: ${spotErr}. Reverting.`)
          setSpots(prev => prev.map(s => s.id === sid ? { ...s, longitude: prevSpot.longitude, latitude: prevSpot.latitude } : s))
        }
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
          const { error: obsErr } = await updateParkingObstacle(oid, updates)
          if (obsErr) {
            toast.error(`Couldn't save new position: ${obsErr}. Reverting.`)
            setObstacles(prev => prev.map(o => o.id === oid ? obs : o))
          }
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
      const prevSpot = editingSpot
      const pt = offsetPoint({ lat: editingSpot.latitude, lon: editingSpot.longitude }, bearing, dist)
      const updated = { ...editingSpot, longitude: pt.lon, latitude: pt.lat }
      setEditingSpot(updated)
      setSpots(prev => prev.map(s => s.id === updated.id ? { ...s, longitude: pt.lon, latitude: pt.lat } : s))
      const { error: nudgeErr } = await updateParkingSpot(updated.id, { longitude: pt.lon, latitude: pt.lat })
      if (nudgeErr) {
        toast.error(`Couldn't save new position: ${nudgeErr}. Reverting.`)
        setEditingSpot(prevSpot)
        setSpots(prev => prev.map(s => s.id === prevSpot.id ? { ...s, longitude: prevSpot.longitude, latitude: prevSpot.latitude } : s))
      }
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
      gmap.setOptions({ draggable: true, gestureHandling: 'greedy' })
      mapDiv.style.cursor = ''
    }
  }, [boxSelectActive, mapLoaded])

  // ── Ctrl+drag heading rotation ──
  // gestureHandling: 'greedy' suppresses the built-in rotation gesture, so
  // we implement it explicitly: hold Ctrl (or Shift) and drag horizontally
  // to rotate. Tilt is intentionally NOT supported — at non-flat tilts the
  // aircraft SVG icons stop scaling correctly (Google Maps projects them
  // through the tilted camera and our icon-scale calc only handles the
  // overhead case). Parking laydowns don't need perspective, so we keep
  // the camera locked at tilt: 0 and only let the user adjust heading.
  useEffect(() => {
    if (!mapLoaded) return
    const w = map.current
    if (!w) return
    const gmap = w.gmap
    const mapDiv = gmap.getDiv()

    let active = false
    let startX = 0, startHeading = 0
    let pending: number | null = null
    let rafId: number | null = null

    const flush = () => {
      rafId = null
      if (pending != null) {
        gmap.setHeading(pending)
        pending = null
      }
    }

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      if (!e.ctrlKey && !e.shiftKey) return
      active = true
      startX = e.clientX
      startHeading = gmap.getHeading() ?? 0
      // Defensive: snap any accidental non-zero tilt back to flat.
      if ((gmap.getTilt() ?? 0) !== 0) gmap.setTilt(0)
      gmap.setOptions({ draggable: false })
      mapDiv.style.cursor = 'grabbing'
      e.preventDefault()
      e.stopPropagation()
    }
    const onMove = (e: MouseEvent) => {
      if (!active) return
      const dx = e.clientX - startX
      pending = (startHeading + dx / 2 + 360) % 360
      if (rafId == null) rafId = requestAnimationFrame(flush)
    }
    const onUp = () => {
      if (!active) return
      active = false
      if (rafId != null) { cancelAnimationFrame(rafId); rafId = null }
      if (pending != null) { gmap.setHeading(pending); pending = null }
      gmap.setOptions({ draggable: true })
      mapDiv.style.cursor = ''
    }

    mapDiv.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)

    return () => {
      mapDiv.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (rafId != null) cancelAnimationFrame(rafId)
      gmap.setOptions({ draggable: true })
    }
  }, [mapLoaded])

  // Resize map when sidebar collapses/expands or fullscreen toggles
  useEffect(() => {
    setTimeout(() => {
      if (map.current) {
        google.maps.event.trigger(map.current.gmap, 'resize')
      }
    }, 200)
  }, [isFullscreen])

  // Silent warm-up after the map's initial tile load. Runs the same
  // frame-area html2canvas read the real export will run, and discards
  // the output. The discarded first capture warms whatever it is that
  // makes the second capture in a session always succeed (empirically,
  // an actual html2canvas read is what primes the WebGL / browser GPU
  // state — the resize cycle wasn't required, it just happened to be
  // bundled with the read in the previous implementation). Setting
  // mapWarmedUp to true unblocks the export buttons.
  useEffect(() => {
    if (!mapLoaded || mapWarmedUp) return
    let cancelled = false
    const run = async () => {
      const w = map.current
      if (!w) return
      const gmap = w.gmap
      const mapDiv = gmap.getDiv()
      const parent = mapDiv.parentElement
      if (!parent) { setMapWarmedUp(true); return }
      const origStyle = {
        position: parent.style.position,
        top: parent.style.top,
        left: parent.style.left,
        width: parent.style.width,
        height: parent.style.height,
        zIndex: parent.style.zIndex,
        flex: parent.style.flex,
      }
      const preCenter = gmap.getCenter()
      const preZoom = gmap.getZoom()
      try {
        parent.style.position = 'fixed'
        parent.style.top = '0'
        parent.style.left = '0'
        parent.style.width = '1600px'
        parent.style.height = '900px'
        parent.style.zIndex = '10000'
        parent.style.flex = 'none'
        google.maps.event.trigger(gmap, 'resize')
        if (preCenter) gmap.setCenter(preCenter)
        if (preZoom != null) gmap.setZoom(preZoom)
        await new Promise<void>(resolve => {
          google.maps.event.addListenerOnce(gmap, 'idle', () => resolve())
          setTimeout(resolve, 3000)
        })
        if (cancelled) return
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
        const html2canvas = (await import('html2canvas')).default
        await html2canvas(mapDiv, {
          useCORS: true,
          allowTaint: true,
          backgroundColor: null,
          scale: 1, // lower scale since output is discarded — faster warm-up
          logging: false,
          width: mapDiv.clientWidth,
          height: mapDiv.clientHeight,
        })
        if (cancelled) return
      } catch (err) {
        console.warn('Map capture warm-up failed:', err)
      } finally {
        parent.style.position = origStyle.position
        parent.style.top = origStyle.top
        parent.style.left = origStyle.left
        parent.style.width = origStyle.width
        parent.style.height = origStyle.height
        parent.style.zIndex = origStyle.zIndex
        parent.style.flex = origStyle.flex
        google.maps.event.trigger(gmap, 'resize')
        if (preCenter) gmap.setCenter(preCenter)
        if (preZoom != null) gmap.setZoom(preZoom)
      }
      await new Promise<void>(resolve => {
        google.maps.event.addListenerOnce(gmap, 'idle', () => resolve())
        setTimeout(resolve, 1500)
      })
      if (!cancelled) setMapWarmedUp(true)
    }
    run()
    return () => { cancelled = true }
  }, [mapLoaded, mapWarmedUp])

  // ── Sync mapHeadingDeg with the gmap's heading ──
  // Listens to heading_changed; updates state so renderAircraft can
  // counter-rotate icons. We sync on every change (cheap state update);
  // the icon regeneration is what's debounced via React's render batching.
  useEffect(() => {
    if (!mapLoaded) return
    const w = map.current
    if (!w) return
    const gmap = w.gmap
    const listener = gmap.addListener('heading_changed', () => {
      const h = gmap.getHeading() ?? 0
      setMapHeadingDeg(prev => (Math.abs(prev - h) > 0.5 ? h : prev))
    })
    // Initialize from current gmap state
    setMapHeadingDeg(gmap.getHeading() ?? 0)
    return () => { google.maps.event.removeListener(listener) }
  }, [mapLoaded])

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
    } else {
      toast.error('Failed to duplicate the parking plan — no changes were saved.')
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

  const openEditPlan = () => {
    if (!selectedPlan) return
    setEditPlanName(selectedPlan.plan_name)
    setEditPlanDesc(selectedPlan.description || '')
    setShowEditPlan(true)
  }

  const handleSavePlanEdit = async () => {
    if (!selectedPlan || !installationId) return
    const trimmedName = editPlanName.trim()
    if (!trimmedName) { toast.error('Plan name is required'); return }
    setSavingPlanEdit(true)
    const updated = await updateParkingPlan(
      selectedPlan.id,
      { plan_name: trimmedName, description: editPlanDesc.trim() || null },
      installationId,
    )
    setSavingPlanEdit(false)
    if (updated) {
      setPlans(prev => prev.map(p => p.id === updated.id ? updated : p))
      setShowEditPlan(false)
      toast.success('Plan updated')
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
    const ok = await setActivePlan(selectedPlan.id, installationId)
    if (!ok) {
      toast.error('Could not set the active plan — please try again.')
      return
    }
    setPlans(prev => prev.map(p => ({ ...p, is_active: p.id === selectedPlan.id })))
    toast.success(`"${selectedPlan.plan_name}" set as active plan`)
  }

  // ── PDF export ──

  // Snap the current map view through html2canvas, project the frame's
  // pixel corners to lat/lng, and filter the plan's spots / obstacles /
  // clearance results to only those inside that polygon. Returns a
  // PendingApron ready to be appended to the export queue or exported on
  // its own. `label` is the apron header — pass null for single-apron
  // exports (no per-section header rendered in the PDF).
  const captureCurrentFrame = async (label: string | null): Promise<PendingApron | null> => {
    if (!selectedPlan) return null
    const w = map.current
    let mapDataUrl: string | null = null
    // Polygon of lat/lng corners corresponding to the captured map area
    // (the 1600×900 viewport after resize). Used to filter PDF tables.
    let framePolygon: { lat: number; lng: number }[] | null = null

    if (w) {
      // Force the parent out of flex layout with position: fixed so the
      // 1600x900 dimensions are actually honored — without this, the flex
      // container keeps the parent at its current height (usually ~viewport
      // height, not 900), so the "1600x900 capture" actually captures the
      // viewport's pixel dimensions. The on-screen outline IS 1600x900, so
      // the PDF then shows extra geographic area below/above the outline.
      // Matches the original Mapbox capture pipeline (pre-Apr 2026).
      // Brief visible flash during capture is acceptable (~1s).
      const gmap = w.gmap
      const mapDiv = gmap.getDiv()
      const parent = mapDiv.parentElement
      const origStyle = {
        position: parent?.style.position || '',
        top: parent?.style.top || '',
        left: parent?.style.left || '',
        width: parent?.style.width || '',
        height: parent?.style.height || '',
        zIndex: parent?.style.zIndex || '',
        flex: parent?.style.flex || '',
      }
      const preCenter = gmap.getCenter()
      const preZoom = gmap.getZoom()

      try {
        if (parent) {
          parent.style.position = 'fixed'
          parent.style.top = '0'
          parent.style.left = '0'
          parent.style.width = '1600px'
          parent.style.height = '900px'
          parent.style.zIndex = '10000'
          parent.style.flex = 'none'
        }
        google.maps.event.trigger(gmap, 'resize')
        // Force the resized map back to the exact pre-resize center + zoom
        // so the capture matches what the on-screen outline is promising.
        if (preCenter) gmap.setCenter(preCenter)
        if (preZoom != null) gmap.setZoom(preZoom)
        await new Promise<void>(resolve => {
          google.maps.event.addListenerOnce(gmap, 'idle', () => resolve())
          setTimeout(resolve, 3000)
        })
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

        // Project the four corners of the (now actually 1600x900) viewport
        // to lat/lng. This is the geographic area actually in the PDF map
        // page, so the filter accurately matches what's visible.
        const liveW = mapDiv.clientWidth
        const liveH = mapDiv.clientHeight
        const tl = pixelToLatLng(w, 0, 0)
        const tr = pixelToLatLng(w, liveW, 0)
        const br = pixelToLatLng(w, liveW, liveH)
        const bl = pixelToLatLng(w, 0, liveH)
        if (tl && tr && br && bl) framePolygon = [tl, tr, br, bl]
      } catch (err) {
        console.warn('Map capture error:', err)
        toast.error('Map capture failed')
        mapDataUrl = null
      } finally {
        if (parent) {
          parent.style.position = origStyle.position
          parent.style.top = origStyle.top
          parent.style.left = origStyle.left
          parent.style.width = origStyle.width
          parent.style.height = origStyle.height
          parent.style.zIndex = origStyle.zIndex
          parent.style.flex = origStyle.flex
        }
        google.maps.event.trigger(gmap, 'resize')
        // Restore the live viewport's center + zoom too, so the user lands
        // back exactly where they were before the export.
        if (preCenter) gmap.setCenter(preCenter)
        if (preZoom != null) gmap.setZoom(preZoom)
      }
    }

    // Strict filter: only aircraft, obstacles, and clearance results whose
    // every referenced entity is inside the captured frame end up in the PDF.
    // If projection failed, framePolygon is null and we fall back to the
    // full plan arrays (degraded but still produces a usable export).
    let spotsForPdf = spots
    let spotsWithAircraftForPdf = spotsWithAircraft
    let allResultsForPdf = allResults
    let violationsForPdf = violations
    let warningsForPdf = warnings
    if (framePolygon) {
      const poly = framePolygon
      // Use the visible body center (offset from the stored nose coords by
      // half the aircraft length along the heading), so a spot counts as
      // "in frame" exactly when its body sits inside the dashed rectangle.
      const spotInFrame = (s: SpotWithAircraft) => {
        const c = spotCenter(s)
        return pointInLatLngPolygon({ lat: c.lat, lng: c.lon }, poly)
      }
      const inSpotIds = new Set<string>()
      spotsWithAircraftForPdf = spotsWithAircraft.filter(s => {
        if (spotInFrame(s)) { inSpotIds.add(s.id); return true }
        return false
      })
      spotsForPdf = spots.filter(s => inSpotIds.has(s.id))
      const inObstacleIds = new Set<string>()
      for (const o of obstacles) {
        if (pointInLatLngPolygon({ lat: o.latitude, lng: o.longitude }, poly)) {
          inObstacleIds.add(o.id)
        }
      }
      allResultsForPdf = allResults.filter(r => {
        if (r.spot_a_id && !inSpotIds.has(r.spot_a_id)) return false
        if (r.spot_b_id && !inSpotIds.has(r.spot_b_id)) return false
        if (r.obstacle_id && !inObstacleIds.has(r.obstacle_id)) return false
        return true
      })
      violationsForPdf = allResultsForPdf.filter(r => r.status === 'violation')
      warningsForPdf = allResultsForPdf.filter(r => r.status === 'warning')
    }

    return {
      label: label || '',
      mapDataUrl,
      spots: spotsForPdf,
      spotsWithAircraft: spotsWithAircraftForPdf,
      allResults: allResultsForPdf,
      violations: violationsForPdf,
      warnings: warningsForPdf,
    }
  }

  // Run the multi-section generator for one or more captures and either
  // save the PDF directly (mode === 'pdf') or open the email modal
  // (mode === 'email').
  const exportSections = async (sections: PendingApron[], mode: 'pdf' | 'email') => {
    if (!selectedPlan || sections.length === 0) return
    const { generateParkingPdf } = await import('@/lib/parking-pdf')
    const result = await generateParkingPdf({
      plan: selectedPlan,
      apronContext,
      baseName: currentInstallation?.name,
      baseIcao: currentInstallation?.icao,
      distanceUnit: resultUnit,
      parkingStandard,
      sections: sections.map(s => ({
        label: s.label || null,
        spots: s.spots,
        spotsWithAircraft: s.spotsWithAircraft,
        allResults: s.allResults,
        violations: s.violations,
        warnings: s.warnings,
        mapDataUrl: s.mapDataUrl,
      })),
    })
    if (mode === 'pdf') {
      result.doc.save(result.filename)
      toast.success(sections.length > 1 ? `PDF exported (${sections.length} aprons)` : 'PDF exported')
    } else {
      setEmailPdfData(result)
      setEmailModalOpen(true)
    }
  }

  // The toolbar buttons enter framing mode; the actual capture runs in
  // handleConfirmCapture once the user positions the map inside the frame.
  const handleExportPdf = () => {
    if (!selectedPlan) return
    setFramingMode('pdf')
  }

  const handleEmailPdf = () => {
    if (!selectedPlan) return
    setFramingMode('email')
  }

  const handleCancelCapture = () => {
    setFramingMode(null)
    setPendingAprons([])
    setApronNamePrompt({ open: false, draft: '', intent: 'add' })
  }

  // Add Apron always prompts for a name. Confirm prompts only when there
  // are already queued aprons (the current frame becomes the final, named
  // apron). With an empty queue, Confirm runs the single-apron, no-label
  // export path.
  const handleAddApron = () => {
    if (!framingMode) return
    setApronNamePrompt({ open: true, draft: `Apron ${pendingAprons.length + 1}`, intent: 'add' })
  }

  const handleConfirmCapture = async () => {
    const mode = framingMode
    if (!mode || !selectedPlan) { handleCancelCapture(); return }
    setExportingPdf(true)
    try {
      // Non-empty queue: ship the queued aprons as-is. Don't capture
      // the current view again — Add Apron is the explicit add gesture.
      if (pendingAprons.length > 0) {
        const sections = [...pendingAprons]
        setFramingMode(null)
        setPendingAprons([])
        await exportSections(sections, mode)
        return
      }
      // Empty queue: single-apron path — capture current view + export.
      const capture = await captureCurrentFrame(null)
      setFramingMode(null)
      if (!capture) return
      await exportSections([capture], mode)
    } catch (err) {
      toast.error(mode === 'pdf' ? 'Failed to export PDF' : 'Failed to generate PDF')
      console.error(err)
    } finally {
      setExportingPdf(false)
    }
  }

  // Add Apron flow: captures the current frame under the typed name
  // and appends to the queue. Framing mode stays open so the user can
  // position the next apron and Add Apron again, or Confirm & Export
  // to ship the queue.
  const handleApronNamePromptSave = async () => {
    const fallback = `Apron ${pendingAprons.length + 1}`
    const name = (apronNamePrompt.draft.trim() || fallback)
    setApronNamePrompt({ open: false, draft: '', intent: 'add' })
    setExportingPdf(true)
    try {
      const capture = await captureCurrentFrame(name)
      if (!capture) return
      setPendingAprons(prev => [...prev, capture])
      toast.success(`Added "${name}" — position the next apron`)
    } catch (err) {
      toast.error('Failed to capture apron')
      console.error(err)
    } finally {
      setExportingPdf(false)
    }
  }

  const handleApronNamePromptCancel = () => {
    setApronNamePrompt({ open: false, draft: '', intent: 'add' })
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
    const { data: updated, error } = await updateParkingSpot(spotId, updates)
    if (error) { toast.error(error); return }
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
    const { data: updated, error } = await updateParkingObstacle(obsId, updates)
    if (error) { toast.error(error); return }
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
    const { data: updated, error } = await updateParkingObstacle(drawingLineObsId, { line_coords: drawingLinePoints })
    if (error) {
      toast.error(error)
    } else if (updated) {
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
      // Show favorites first, then the rest. Render the full roster (~210
      // aircraft) — no cap, so every type is reachable by scrolling, not just
      // by searching.
      const favs = list.filter(a => favoriteAircraft.includes(a.aircraft))
      const rest = list.filter(a => !favoriteAircraft.includes(a.aircraft))
      return [...favs, ...rest]
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
    return [...favs, ...rest]
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
            {!mobile && (
              <button
                onClick={() => setSidebarCollapsed(true)}
                title="Hide panel"
                aria-label="Hide panel"
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 22, height: 22, marginLeft: 2, padding: 0, borderRadius: 4,
                  background: 'transparent', border: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <X size={13} />
              </button>
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
                  disabled={exportingPdf || !mapWarmedUp}
                  title={mapWarmedUp ? 'Export PDF' : 'Preparing export — a few seconds…'}
                  style={{
                    padding: '4px 8px', borderRadius: 4, fontSize: 'var(--fs-xs)',
                    background: 'var(--color-bg)', color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                    cursor: exportingPdf ? 'wait' : (mapWarmedUp ? 'pointer' : 'wait'),
                    fontWeight: 600, opacity: (exportingPdf || !mapWarmedUp) ? 0.5 : 1,
                  }}
                >
                  {exportingPdf ? '...' : 'PDF'}
                </button>
                <button
                  onClick={handleEmailPdf}
                  disabled={exportingPdf || !mapWarmedUp}
                  title={mapWarmedUp ? 'Email PDF' : 'Preparing export — a few seconds…'}
                  style={{
                    padding: '4px 8px', borderRadius: 4, fontSize: 'var(--fs-xs)',
                    background: 'var(--color-bg)', color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border)',
                    cursor: exportingPdf ? 'wait' : (mapWarmedUp ? 'pointer' : 'wait'),
                    fontWeight: 600, opacity: (exportingPdf || !mapWarmedUp) ? 0.5 : 1,
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
                    <button onClick={() => { openEditPlan(); setShowActionMenu(false) }} style={{
                      width: '100%', padding: '8px 12px', textAlign: 'left',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'var(--color-cyan)', fontSize: 11, fontWeight: 600,
                      fontFamily: 'inherit',
                    }}>
                      Edit Details
                    </button>
                    <button onClick={() => { handleToggleTemplate(); setShowActionMenu(false) }} style={{
                      width: '100%', padding: '8px 12px', textAlign: 'left',
                      background: 'transparent', border: 'none',
                      borderTop: '1px solid var(--color-border)', cursor: 'pointer',
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
        <div data-tour="parking-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
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
                      <HeadingSlider
                        value={allSameHeading ? firstHeading : 0}
                        onPreview={deg => { for (const s of selSpots) imperativeRotateSpot(s.id, deg) }}
                        onCommit={deg => { for (const s of selSpots) handleUpdateSpot(s.id, { heading_deg: deg }) }}
                        style={{ flex: 1 }}
                      />
                      <NumberField
                        min={0} max={360} step={1}
                        allowEmpty={false}
                        value={allSameHeading ? firstHeading : null}
                        placeholder={allSameHeading ? '' : 'mixed'}
                        onCommit={v => {
                          if (v == null) return
                          for (const s of selSpots) handleUpdateSpot(s.id, { heading_deg: v })
                        }}
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
                          {val ? fmtDistance(val, resultUnit) : 'UFC'}
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
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-sm)', padding: '6px 12px', margin: 0, lineHeight: 1.5 }}>
                  Select or create a plan to add aircraft
                </p>
              )}
              {spots.length === 0 && selectedPlanId && (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-xs)', padding: '6px 12px', margin: 0, lineHeight: 1.5 }}>
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
                          <HeadingSlider
                            value={groupSpots[0]?.heading_deg ?? 0}
                            onPreview={deg => { for (const s of groupSpots) imperativeRotateSpot(s.id, deg) }}
                            onCommit={deg => { for (const s of groupSpots) handleUpdateSpot(s.id, { heading_deg: deg }) }}
                            style={{ flex: 1 }}
                          />
                          <NumberField
                            min={0} max={360} step={1}
                            allowEmpty={false}
                            value={groupSpots[0]?.heading_deg ?? 0}
                            onCommit={v => {
                              if (v == null) return
                              for (const s of groupSpots) handleUpdateSpot(s.id, { heading_deg: v })
                            }}
                            style={{ width: 44, padding: '2px 3px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-cyan)', fontSize: 'var(--fs-xs)', textAlign: 'center', fontWeight: 700 }}
                          />
                          <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-secondary)' }}>°</span>
                        </div>
                      )}

                      {/* Individual spots within group */}
                      {isGroupOpen && groupSpots.map(s => {
                        const clearanceDetail = s.clearance_ft != null
                          ? { clearance_ft: s.clearance_ft, ufc_item: 'Manual', description: 'Override' }
                          : getClearanceDetail(ws, apronContext, s.aircraft_name, parkingStandard)
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
                                {fmtDistance(clearance, resultUnit)} &middot; {s.heading_deg}°
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
                                    Aircraft Label
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
                                    <HeadingSlider
                                      value={s.heading_deg}
                                      onPreview={deg => imperativeRotateSpot(s.id, deg)}
                                      onCommit={deg => handleUpdateSpot(s.id, { heading_deg: deg })}
                                      style={{ width: '100%' }}
                                    />
                                  </label>
                                  <NumberField min={0} max={360} step={1} allowEmpty={false} value={s.heading_deg}
                                    onCommit={v => { if (v != null) handleUpdateSpot(s.id, { heading_deg: v }) }}
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
                                      {val ? fmtDistance(val, resultUnit) : `${stdLabel} (${fmtDistance(getWingtipClearance(ws, apronContext, s.aircraft_name, parkingStandard), resultUnit)})`}
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
                {(['aircraft', 'labels', 'obstacles', 'taxilanes', 'boundaries'] as const).map(lk => (
                  <button
                    key={lk}
                    onClick={() => toggleLayerVisibility(lk)}
                    title={`${visibleLayers[lk] ? 'Hide' : 'Show'} ${lk === 'labels' ? 'aircraft labels' : lk}`}
                    style={{
                      padding: '2px 4px', border: 'none', cursor: 'pointer', background: 'transparent',
                      fontSize: 11, color: visibleLayers[lk] ? 'var(--color-cyan)' : 'var(--color-text-secondary)',
                      opacity: visibleLayers[lk] ? 1 : 0.3,
                    }}
                  >
                    {lk === 'aircraft' ? 'AC' : lk === 'labels' ? 'LBL' : lk === 'obstacles' ? 'OB' : lk === 'taxilanes' ? 'TL' : 'AB'}
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
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-xs)', padding: '6px 12px', margin: 0, lineHeight: 1.5 }}>
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
                        borderLeft: '3px solid var(--color-orange)',
                      }}
                    >
                      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-primary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {obs.name || 'Unnamed'}
                      </span>
                      {obs.obstacle_type === 'building' && (
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                          {fmtDistance(obs.width_ft || 0, resultUnit, { withUnit: false })}x{fmtDistance(obs.length_ft || 0, resultUnit)}
                        </span>
                      )}
                      {obs.obstacle_type === 'circle' && (
                        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                          r={fmtDistance(obs.radius_ft || 0, resultUnit)}
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
                              <NumberField min={0} allowEmpty={false} value={obs.width_ft ?? 0} onCommit={v => { if (v != null) handleUpdateObstacle(obs.id, { width_ft: v }) }} style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }} />
                            </label>
                            <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', flex: 1 }}>
                              Length (ft)
                              <NumberField min={0} allowEmpty={false} value={obs.length_ft ?? 0} onCommit={v => { if (v != null) handleUpdateObstacle(obs.id, { length_ft: v }) }} style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }} />
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                              <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', flex: 1 }}>
                                Rotation
                                <HeadingSlider
                                  value={obs.rotation_deg ?? 0}
                                  onCommit={deg => handleUpdateObstacle(obs.id, { rotation_deg: deg })}
                                  style={{ width: '100%' }}
                                />
                              </label>
                              <NumberField min={0} max={360} step={1} allowEmpty={false} value={obs.rotation_deg ?? 0} onCommit={v => { if (v != null) handleUpdateObstacle(obs.id, { rotation_deg: v }) }} style={{ width: 52, padding: '3px 4px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)', textAlign: 'center' }} />
                              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>°</span>
                            </div>
                          </div>
                        )}
                        {obs.obstacle_type === 'circle' && (
                          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                            Radius (ft)
                            <NumberField min={0} allowEmpty={false} value={obs.radius_ft ?? 0} onCommit={v => { if (v != null) handleUpdateObstacle(obs.id, { radius_ft: v }) }} style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }} />
                          </label>
                        )}
                        {obs.obstacle_type === 'point' && (
                          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                            Height (ft)
                            <NumberField min={0} allowEmpty={false} value={obs.height_ft ?? 0} onCommit={v => { if (v != null) handleUpdateObstacle(obs.id, { height_ft: v }) }} style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }} />
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
                    background: 'color-mix(in srgb, var(--color-blue) 7%, transparent)', border: '1px dashed var(--color-blue)',
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
                    background: 'color-mix(in srgb, var(--color-violet) 7%, transparent)', border: '1px dashed var(--color-violet)',
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
                    background: 'color-mix(in srgb, var(--color-success) 7%, transparent)', border: '1px dashed var(--color-success)',
                    color: 'var(--color-success)', cursor: selectedPlanId ? 'pointer' : 'not-allowed',
                    opacity: selectedPlanId ? 1 : 0.5,
                  }}
                >
                  + Apron Boundary
                </button>
              </div>

              {taxilanes.length === 0 && apronBoundaries.length === 0 && (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-xs)', padding: '6px 12px', margin: 0, lineHeight: 1.5 }}>
                  No taxilanes or boundaries defined. Draw centerlines to verify clearance envelopes.
                </p>
              )}

              {/* Taxilane list */}
              {taxilanes.map(tl => {
                const isEditing = editingTaxilane?.id === tl.id
                const tlForCheck: TaxilaneForCheck = { id: tl.id, name: tl.name, taxilane_type: tl.taxilane_type, design_wingspan_ft: tl.design_wingspan_ft, line_coords: tl.line_coords, is_transient: tl.is_transient }
                const { halfWidth, detail } = getTaxilaneEnvelopeHalfWidth(tlForCheck, parkingStandard)
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
                        {detail.ufc_item} &middot; {fmtDistance(halfWidth, resultUnit)} env
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
                                <option key={ac.aircraft} value={ac.aircraft}>{ac.aircraft} ({fmtDistance(Number(ac.wing_span_ft), resultUnit)})</option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', flex: 1 }}>
                            Design Wingspan (ft)
                            <NumberField min={0} value={tl.design_wingspan_ft ?? null} placeholder="100" onCommit={v => handleUpdateTaxilane(tl.id, { design_wingspan_ft: (v ?? null) as any })} style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }} />
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
                          Envelope: 0.5 × {fmtDistance(tl.design_wingspan_ft || 100, resultUnit)} + {fmtDistance(detail.clearance_ft, resultUnit)} ({detail.ufc_item}) = {fmtDistance(halfWidth, resultUnit)} half-width
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
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-xs)', padding: '6px 12px', margin: 0, lineHeight: 1.5 }}>
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
                    {fmtDistance(r.distance_ft, resultUnit, { digits: 1, withUnit: false })} / {fmtDistance(r.required_ft, resultUnit)}
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
    <div data-tour="parking-header" style={{
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
          {/* PDF capture framing overlay — shows the exact 1600×900 area the
              capture will produce, centered in the viewport. If the viewport
              is smaller than the capture, the outline extends past the
              visible edges (intentional — tells the user the capture will
              include more than what's on screen). Box-shadow dims everything
              outside the outline. Confirm runs the capture; Cancel exits. */}
          {framingMode && mapSize && mapSize.w > 0 && mapSize.h > 0 && selectedPlanId && (() => {
            const o = captureOutlineRect(mapSize.w, mapSize.h)
            const verb = framingMode === 'pdf' ? 'Export PDF' : 'Email PDF'
            return (
              <>
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5, overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', left: o.x, top: o.y, width: o.w, height: o.h,
                    border: '2px dashed var(--color-cyan)', boxSizing: 'border-box',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                  }} />
                </div>
                {/* Instruction banner — Cancel / Add Apron / Confirm. Inline-
                    switches to a name prompt while the user is naming an apron. */}
                <div style={{
                  position: 'absolute', zIndex: 6,
                  top: 14, left: '50%', transform: 'translateX(-50%)',
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px',
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-cyan)',
                  borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                  maxWidth: 'calc(100% - 28px)', flexWrap: 'wrap',
                }}>
                  {apronNamePrompt.open ? (
                    <>
                      <span style={{
                        fontSize: 'var(--fs-xs)', fontWeight: 600,
                        color: 'var(--color-text-primary)', whiteSpace: 'nowrap',
                      }}>Apron name:</span>
                      <input
                        autoFocus
                        value={apronNamePrompt.draft}
                        onChange={e => setApronNamePrompt(p => ({ ...p, draft: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); handleApronNamePromptSave() }
                          else if (e.key === 'Escape') { e.preventDefault(); handleApronNamePromptCancel() }
                        }}
                        style={{
                          width: 200, padding: '5px 8px', borderRadius: 4, fontFamily: 'inherit',
                          background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                          color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)',
                        }}
                      />
                      <button
                        onClick={handleApronNamePromptCancel}
                        disabled={exportingPdf}
                        style={{
                          padding: '5px 12px', borderRadius: 4, fontFamily: 'inherit',
                          background: 'transparent', border: '1px solid var(--color-border)',
                          color: 'var(--color-text-secondary)', cursor: exportingPdf ? 'wait' : 'pointer',
                          fontSize: 'var(--fs-xs)', fontWeight: 600,
                        }}
                      >Cancel</button>
                      <button
                        onClick={handleApronNamePromptSave}
                        disabled={exportingPdf}
                        style={{
                          padding: '5px 14px', borderRadius: 4, fontFamily: 'inherit',
                          background: 'var(--color-cyan)', border: '1px solid var(--color-cyan)',
                          color: '#000', cursor: exportingPdf ? 'wait' : 'pointer',
                          fontSize: 'var(--fs-xs)', fontWeight: 700, opacity: exportingPdf ? 0.6 : 1,
                        }}
                      >{exportingPdf ? 'Capturing…' : 'Save Apron'}</button>
                    </>
                  ) : (
                    <>
                      <span style={{
                        fontSize: 'var(--fs-xs)', fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        whiteSpace: isMobile ? 'normal' : 'nowrap',
                      }}>
                        {pendingAprons.length === 0
                          ? `Position the map inside the frame, then confirm to ${verb.toLowerCase()}.`
                          : `${pendingAprons.length} apron${pendingAprons.length === 1 ? '' : 's'} queued — position the next one.`}
                      </span>
                      {pendingAprons.length > 0 && (
                        <span style={{
                          fontSize: 'var(--fs-2xs)', fontWeight: 600,
                          color: 'var(--color-cyan)',
                          maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }} title={pendingAprons.map(a => a.label).join(', ')}>
                          {pendingAprons.map(a => a.label).join(', ')}
                        </span>
                      )}
                      <button
                        onClick={handleCancelCapture}
                        disabled={exportingPdf}
                        style={{
                          padding: '5px 12px', borderRadius: 4, fontFamily: 'inherit',
                          background: 'transparent', border: '1px solid var(--color-border)',
                          color: 'var(--color-text-secondary)', cursor: exportingPdf ? 'wait' : 'pointer',
                          fontSize: 'var(--fs-xs)', fontWeight: 600,
                        }}
                      >Cancel</button>
                      <button
                        onClick={handleAddApron}
                        disabled={exportingPdf}
                        title="Capture this apron and keep framing more"
                        style={{
                          padding: '5px 12px', borderRadius: 4, fontFamily: 'inherit',
                          background: 'color-mix(in srgb, var(--color-cyan) 12%, transparent)',
                          border: '1px solid var(--color-cyan)',
                          color: 'var(--color-cyan)', cursor: exportingPdf ? 'wait' : 'pointer',
                          fontSize: 'var(--fs-xs)', fontWeight: 700,
                        }}
                      >+ Add Apron</button>
                      <button
                        onClick={handleConfirmCapture}
                        disabled={exportingPdf}
                        style={{
                          padding: '5px 14px', borderRadius: 4, fontFamily: 'inherit',
                          background: 'var(--color-cyan)', border: '1px solid var(--color-cyan)',
                          color: '#000', cursor: exportingPdf ? 'wait' : 'pointer',
                          fontSize: 'var(--fs-xs)', fontWeight: 700,
                        }}
                      >Confirm & {verb}</button>
                    </>
                  )}
                </div>
              </>
            )
          })()}
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
              <div data-tour="parking-panel" style={{
                position: 'absolute', top: 10, left: 80, zIndex: 10,
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
          {/* Toolbar rail — desktop: single vertical column at left.
              Mobile: edit-tool strip across the top + small view/output cluster bottom-right.
              Full / Ruler / PDF / Email aren't core to plan editing, so on mobile they
              live in a separate cluster from the parking-edit tools. */}
          {(() => {
            const railBtnBase: React.CSSProperties = {
              width: 52, height: 48, borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              fontSize: 'var(--fs-2xs)', fontWeight: 600,
              background: 'transparent', border: '1px solid transparent',
              color: 'var(--color-text-1)',
              flexShrink: 0,
            }
            const activeStyle = (color: string): React.CSSProperties => ({
              border: `1px solid ${color}`,
              background: `color-mix(in srgb, ${color} 12%, transparent)`,
              color,
            })
            const VDivider = () => (
              <div style={{ background: 'var(--color-border)', flexShrink: 0, width: 1, alignSelf: 'stretch', margin: '0 4px' }} />
            )
            const HDivider = () => (
              <div style={{ background: 'var(--color-border)', flexShrink: 0, height: 1, margin: '4px 4px' }} />
            )

            // Reusable button factories. Mobile uses a bottom sheet for the
            // panel (sheetExpanded); desktop uses a floating side panel
            // (sidebarCollapsed). PanelBtn drives whichever is active so
            // mobile users get a one-tap open / close from the toolbar
            // rather than only the bottom-sheet drag handle.
            const panelOpen = isMobile ? sheetExpanded : !sidebarCollapsed
            const PanelBtn = (
              <button
                key="panel"
                onClick={() => isMobile ? setSheetExpanded(s => !s) : setSidebarCollapsed(c => !c)}
                title={panelOpen ? 'Hide panel' : 'Show panel'}
                style={{ ...railBtnBase, ...(panelOpen ? activeStyle('var(--color-cyan)') : {}) }}
              >
                {panelOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
                <span>{panelOpen ? 'Hide' : 'Panel'}</span>
              </button>
            )
            const FullBtn = (
              <button
                key="full"
                onClick={() => setIsFullscreen(f => !f)}
                title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                style={{ ...railBtnBase, ...(isFullscreen ? activeStyle('var(--color-cyan)') : {}) }}
              >
                {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                <span>{isFullscreen ? 'Exit' : 'Full'}</span>
              </button>
            )
            const RulerBtn = (
              <button
                key="ruler"
                onClick={() => setRulerActive(r => !r)}
                title={rulerActive ? (ruler.totalFt > 0 ? ruler.formatDist(ruler.totalFt) : 'Click to measure') : 'Measure distance'}
                style={{ ...railBtnBase, ...(rulerActive ? activeStyle('var(--color-cyan)') : {}) }}
              >
                <RulerIcon size={18} />
                <span>{rulerActive && ruler.totalFt > 0 ? ruler.formatDist(ruler.totalFt) : 'Ruler'}</span>
              </button>
            )
            const PdfBtn = (
              <button
                key="pdf"
                onClick={handleExportPdf}
                disabled={exportingPdf || !mapWarmedUp}
                title={mapWarmedUp ? 'Export PDF' : 'Preparing export — a few seconds…'}
                style={{
                  ...railBtnBase,
                  opacity: (exportingPdf || !mapWarmedUp) ? 0.5 : 1,
                  cursor: exportingPdf ? 'wait' : (mapWarmedUp ? 'pointer' : 'wait'),
                }}
              >
                <Download size={18} />
                <span>{exportingPdf ? '...' : 'PDF'}</span>
              </button>
            )
            const EmailBtn = (
              <button
                key="email"
                onClick={handleEmailPdf}
                disabled={exportingPdf || !mapWarmedUp}
                title={mapWarmedUp ? 'Email PDF' : 'Preparing export — a few seconds…'}
                style={{
                  ...railBtnBase,
                  opacity: (exportingPdf || !mapWarmedUp) ? 0.5 : 1,
                  cursor: exportingPdf ? 'wait' : (mapWarmedUp ? 'pointer' : 'wait'),
                }}
              >
                <Mail size={18} />
                <span>Email</span>
              </button>
            )

            const editTools = selectedPlanId ? (
              <>
                <button
                  onClick={() => setShowAircraftPicker(true)}
                  title="Add aircraft"
                  style={{ ...railBtnBase, ...activeStyle('var(--color-cyan)') }}
                >
                  <Plane size={18} />
                  <span>Aircraft</span>
                </button>
                {(['point', 'building', 'line', 'circle'] as const).map(type => {
                  const Icon = type === 'point' ? MapPin : type === 'building' ? Building2 : type === 'line' ? Minus : CircleIcon
                  const active = placingObstacle === type
                  return (
                    <button
                      key={type}
                      onClick={() => { setPlacingObstacle(type); setPlacingAircraft(null) }}
                      title={`Place ${type} obstacle`}
                      style={{ ...railBtnBase, ...(active ? activeStyle('var(--color-orange)') : {}) }}
                    >
                      <Icon size={18} />
                      <span style={{ textTransform: 'capitalize' }}>{type}</span>
                    </button>
                  )
                })}
                {isMobile ? <VDivider /> : <HDivider />}
                <button
                  onClick={() => handleStartTaxilane('interior')}
                  disabled={!!drawingTaxilaneId}
                  title="Draw interior taxilane"
                  style={{ ...railBtnBase, color: 'var(--color-blue)', opacity: drawingTaxilaneId ? 0.4 : 1, cursor: drawingTaxilaneId ? 'default' : 'pointer' }}
                >
                  <ArrowRight size={18} />
                  <span>Int Tax</span>
                </button>
                <button
                  onClick={() => handleStartTaxilane('peripheral')}
                  disabled={!!drawingTaxilaneId}
                  title="Draw peripheral taxilane"
                  style={{ ...railBtnBase, color: 'var(--color-violet)', opacity: drawingTaxilaneId ? 0.4 : 1, cursor: drawingTaxilaneId ? 'default' : 'pointer' }}
                >
                  <ArrowLeftRight size={18} />
                  <span>Per Tax</span>
                </button>
                <button
                  onClick={handleStartBoundary}
                  disabled={!!drawingBoundaryId}
                  title="Draw apron boundary"
                  style={{ ...railBtnBase, color: 'var(--color-success)', opacity: drawingBoundaryId ? 0.4 : 1, cursor: drawingBoundaryId ? 'default' : 'pointer' }}
                >
                  <Square size={18} />
                  <span>Boundary</span>
                </button>
                {isMobile ? <VDivider /> : <HDivider />}
                <button
                  onClick={() => setPlanLocked(l => !l)}
                  title={planLocked ? 'Aircraft locked — click to enable dragging' : 'Aircraft unlocked — click to lock'}
                  style={{ ...railBtnBase, ...activeStyle(planLocked ? 'var(--color-danger)' : 'var(--color-success)') }}
                >
                  {planLocked ? <Lock size={18} /> : <Unlock size={18} />}
                  <span>AC</span>
                </button>
                <button
                  onClick={() => setObstaclesLocked(l => !l)}
                  title={obstaclesLocked ? 'Obstacles locked — click to enable dragging' : 'Obstacles unlocked — click to lock'}
                  style={{ ...railBtnBase, ...activeStyle(obstaclesLocked ? 'var(--color-orange)' : 'var(--color-success)') }}
                >
                  {obstaclesLocked ? <Lock size={18} /> : <Unlock size={18} />}
                  <span>OB</span>
                </button>
              </>
            ) : null

            if (isMobile) {
              return (
                <>
                  {/* Top strip — plan-edit tools (only when a plan is loaded) */}
                  {selectedPlanId && (
                    <div style={{
                      position: 'absolute', zIndex: 5,
                      top: 10, left: 10, right: 10,
                      display: 'flex', flexDirection: 'row', gap: 2,
                      padding: 6, borderRadius: 8,
                      background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                      overflowX: 'auto', overflowY: 'hidden',
                      maxWidth: 'calc(100vw - 20px)',
                    }}>
                      {editTools}
                    </div>
                  )}
                  {/* Bottom-right cluster — view + output (always visible) */}
                  <div style={{
                    position: 'absolute', zIndex: 5,
                    bottom: 10, right: 10,
                    display: 'flex', flexDirection: 'row', gap: 2,
                    padding: 6, borderRadius: 8,
                    background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                  }}>
                    {PanelBtn}
                    {FullBtn}
                    {RulerBtn}
                    {selectedPlanId && (
                      <>
                        <VDivider />
                        {PdfBtn}
                        {EmailBtn}
                      </>
                    )}
                  </div>
                </>
              )
            }

            // Desktop — single vertical rail at left
            return (
              <div data-tour="parking-toolbar" style={{
                position: 'absolute', zIndex: 5,
                top: 10, left: 10,
                display: 'flex', flexDirection: 'column', gap: 2,
                padding: 6, borderRadius: 8,
                background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                overflowY: 'auto',
                maxHeight: 'calc(100vh - 20px)',
              }}>
                {PanelBtn}
                {FullBtn}
                {RulerBtn}
                {selectedPlanId && (
                  <>
                    <HDivider />
                    {editTools}
                    <HDivider />
                    {PdfBtn}
                    {EmailBtn}
                  </>
                )}
              </div>
            )
          })()}

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
                {/* Aircraft Label / Tail # / Callsign */}
                <div style={{ display: 'flex', gap: 4 }}>
                  <label style={{ flex: 1 }}>
                    <span style={ctxLabelStyle}>Aircraft Label</span>
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
                  <HeadingSlider
                    value={s.heading_deg}
                    onPreview={deg => imperativeRotateSpot(s.id, deg)}
                    onCommit={deg => handleUpdateSpot(s.id, { heading_deg: deg })}
                    style={{ flex: 1 }}
                  />
                  <NumberField min={0} max={360} step={1} allowEmpty={false} value={s.heading_deg}
                    onCommit={v => { if (v != null) handleUpdateSpot(s.id, { heading_deg: v }) }}
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
                      {val ? fmtDistance(val, resultUnit) : `${stdLabel} (${fmtDistance(getWingtipClearance(ws, apronContext, s.aircraft_name, parkingStandard), resultUnit)})`}
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
            data-tour="parking-aircraft-picker"
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
                    <NumberField
                      min={0} max={359} allowEmpty={false} value={placementHeading}
                      onCommit={v => { if (v != null) setPlacementHeading(((v % 360) + 360) % 360) }}
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
                            {fmtDistance(ws, resultUnit)} wingspan
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

      {/* Edit Plan Details Modal */}
      {showEditPlan && selectedPlan && (
        <div
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowEditPlan(false) }}
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
              Edit Plan Details
            </h3>
            <label style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
              Plan Name *
              <input
                autoFocus
                value={editPlanName}
                onChange={e => setEditPlanName(e.target.value)}
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
                value={editPlanDesc}
                onChange={e => setEditPlanDesc(e.target.value)}
                rows={3}
                placeholder="Renders below the title block on the PDF export."
                style={{
                  width: '100%', padding: '6px 10px', borderRadius: 4, marginTop: 4,
                  border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                  color: 'var(--color-text-primary)', fontSize: 'var(--fs-sm)', resize: 'vertical',
                }}
              />
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowEditPlan(false)}
                disabled={savingPlanEdit}
                style={{ padding: '6px 16px', borderRadius: 4, background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', cursor: savingPlanEdit ? 'default' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSavePlanEdit}
                disabled={savingPlanEdit || !editPlanName.trim()}
                style={{
                  padding: '6px 16px', borderRadius: 4, border: 'none',
                  cursor: (savingPlanEdit || !editPlanName.trim()) ? 'default' : 'pointer',
                  background: editPlanName.trim() ? 'var(--color-cyan)' : 'var(--color-border)',
                  color: editPlanName.trim() ? '#fff' : 'var(--color-text-secondary)',
                  fontWeight: 500, opacity: savingPlanEdit ? 0.6 : 1,
                }}
              >
                {savingPlanEdit ? 'Saving…' : 'Save'}
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
