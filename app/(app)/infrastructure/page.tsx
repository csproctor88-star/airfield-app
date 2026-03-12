'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import { isMapboxConfigured } from '@/lib/utils'
import {
  fetchInfrastructureFeatures,
  createInfrastructureFeature,
  updateInfrastructureFeature,
  deleteInfrastructureFeature,
  updateFeatureStatus,
  bulkShiftFeatures,
  bulkShiftByIds,
  bulkRelayerFeatures,
  bulkCreateInfrastructureFeatures,
  type InfrastructureFeatureType,
} from '@/lib/supabase/infrastructure-features'
import { createDiscrepancy } from '@/lib/supabase/discrepancies'
import { createOutageEvent } from '@/lib/supabase/outage-events'
import { fetchLightingSystems, fetchAllComponentsForBase, fetchLightingSystemWithComponents } from '@/lib/supabase/lighting-systems'
import { calculateAllSystemHealth, type SystemHealth } from '@/lib/outage-rules'
import SystemHealthPanel from '@/components/infrastructure/system-health-panel'
import { offsetPoint, normalizeBearing } from '@/lib/calculations/geometry'
import type { InfrastructureFeature } from '@/lib/supabase/types'

// ── Layer configuration ──

type LayerConfig = {
  key: string
  label: string
  color: string
  types: string[]
  renderType: 'circle' | 'symbol'
  group: string
  legendIcon?: 'circle' | 'rect' | 'rect-arrow' | 'split-circle' | 'triangle' | 'cone' | 'dot-cluster'
  legendBorder?: string
  legendInner?: string
}

const LAYER_GROUPS = ['Signs', 'Taxiway Lights', 'Runway Lights', 'Miscellaneous'] as const

const LAYERS: LayerConfig[] = [
  // Signs
  { key: 'location_signs',      label: 'Location Signs',      color: '#FBBF24',  types: ['location_sign'],       renderType: 'symbol', group: 'Signs', legendIcon: 'rect', legendBorder: '#000000', legendInner: '#FBBF24' },
  { key: 'directional_signs',   label: 'Directional Signs',   color: '#FBBF24',  types: ['directional_sign'],    renderType: 'symbol', group: 'Signs', legendIcon: 'rect-arrow', legendBorder: '#FBBF24', legendInner: '#000000' },
  { key: 'informational_signs', label: 'Informational Signs', color: '#FBBF24',  types: ['informational_sign'],  renderType: 'symbol', group: 'Signs', legendIcon: 'rect', legendBorder: '#FBBF24', legendInner: '#000000' },
  { key: 'mandatory_signs',     label: 'Mandatory Signs',     color: '#EF4444',  types: ['mandatory_sign'],      renderType: 'symbol', group: 'Signs', legendIcon: 'rect', legendBorder: '#EF4444', legendInner: '#FFFFFF' },
  // Taxiway Lights
  { key: 'taxiway_lights',      label: 'Taxiway Lights',      color: '#2563EB',  types: ['taxiway_light'],       renderType: 'circle', group: 'Taxiway Lights', legendIcon: 'circle' },
  { key: 'taxiway_end_lights',  label: 'Taxiway End Lights',  color: '#F59E0B',  types: ['taxiway_end_light'],   renderType: 'circle', group: 'Taxiway Lights', legendIcon: 'circle' },
  // Runway Lights
  { key: 'runway_edge_lights',  label: 'Runway Edge Lights',  color: '#FFFFFF',  types: ['runway_edge_light'],   renderType: 'circle', group: 'Runway Lights', legendIcon: 'circle' },
  { key: 'runway_distance_markers', label: 'Distance Markers', color: '#FFFFFF', types: ['runway_distance_marker'], renderType: 'symbol', group: 'Signs', legendIcon: 'rect', legendBorder: '#FFFFFF', legendInner: '#000000' },
  { key: 'papi_lights',         label: 'PAPI',                color: '#EF4444',  types: ['papi'],                renderType: 'symbol', group: 'Runway Lights', legendIcon: 'split-circle', legendBorder: '#EF4444', legendInner: '#FFFFFF' },
  { key: 'threshold_lights',    label: 'Threshold Lights',    color: '#22C55E',  types: ['threshold_light'],     renderType: 'symbol', group: 'Runway Lights', legendIcon: 'split-circle', legendBorder: '#EF4444', legendInner: '#22C55E' },
  { key: 'pre_threshold_lights', label: 'Pre-Threshold Lights', color: '#EF4444', types: ['pre_threshold_light'], renderType: 'circle', group: 'Runway Lights', legendIcon: 'circle' },
  { key: 'terminating_bar_lights', label: 'Terminating Bar',  color: '#EF4444',  types: ['terminating_bar_light'], renderType: 'circle', group: 'Runway Lights', legendIcon: 'circle' },
  { key: 'centerline_bar_lights', label: 'Centerline Bar Lights', color: '#FBBF24', types: ['centerline_bar_light'], renderType: 'circle', group: 'Runway Lights', legendIcon: 'circle' },
  { key: 'thousand_ft_bar_lights', label: "1000' Bar Lights",  color: '#F59E0B', types: ['thousand_ft_bar_light'], renderType: 'circle', group: 'Runway Lights', legendIcon: 'circle' },
  { key: 'sequenced_flashers',  label: 'Sequenced Flashers',  color: '#7DD3FC',  types: ['sequenced_flasher'],   renderType: 'circle', group: 'Runway Lights', legendIcon: 'circle' },
  { key: 'reil_lights',         label: 'REIL',                color: '#EC4899',  types: ['reil'],                renderType: 'symbol', group: 'Runway Lights', legendIcon: 'rect', legendBorder: '#EC4899', legendInner: '#EC4899' },
  // Miscellaneous
  { key: 'obstruction_lights',  label: 'Obstruction Lights',  color: '#EF4444',  types: ['obstruction_light'],   renderType: 'symbol', group: 'Miscellaneous', legendIcon: 'triangle' },
  { key: 'windcones',           label: 'Windcone',            color: '#F97316',  types: ['windcone'],            renderType: 'symbol', group: 'Miscellaneous', legendIcon: 'cone' },
  { key: 'stadium_lights',      label: 'Stadium Lights',      color: '#D4D4D8',  types: ['stadium_light'],       renderType: 'symbol', group: 'Miscellaneous', legendIcon: 'dot-cluster' },
]

const FEATURE_TYPE_OPTIONS: { value: InfrastructureFeatureType; label: string }[] = [
  { value: 'runway_edge_light', label: 'Runway Edge Light' },
  { value: 'taxiway_light', label: 'Taxiway Light' },
  { value: 'taxiway_end_light', label: 'Taxiway End Light' },
  { value: 'approach_light', label: 'Approach Light' },
  { value: 'runway_threshold', label: 'Runway Threshold' },
  { value: 'location_sign', label: 'Location Sign' },
  { value: 'directional_sign', label: 'Directional Sign' },
  { value: 'informational_sign', label: 'Informational Sign' },
  { value: 'mandatory_sign', label: 'Mandatory Sign' },
  { value: 'obstruction_light', label: 'Obstruction Light' },
  { value: 'runway_distance_marker', label: 'Runway Distance Marker' },
  { value: 'papi', label: 'PAPI' },
  { value: 'threshold_light', label: 'Threshold Light' },
  { value: 'pre_threshold_light', label: 'Pre-Threshold Light' },
  { value: 'terminating_bar_light', label: 'Terminating Bar Light' },
  { value: 'centerline_bar_light', label: 'Centerline Bar Light' },
  { value: 'thousand_ft_bar_light', label: "1000' Bar Light" },
  { value: 'sequenced_flasher', label: 'Sequenced Flasher' },
  { value: 'reil', label: 'REIL' },
  { value: 'windcone', label: 'Windcone' },
  { value: 'stadium_light', label: 'Stadium Light' },
]

// ── Generate map icons for signs and obstruction lights ──

function createCanvasIcon(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  return [c, c.getContext('2d')!]
}

function createSignIcon(outerColor: string, innerColor: string, size: number = 24): ImageData {
  const [, ctx] = createCanvasIcon(size)
  ctx.fillStyle = outerColor
  ctx.fillRect(1, 3, size - 2, size - 6)
  ctx.fillStyle = innerColor
  const inset = 7
  ctx.fillRect(inset, inset, size - inset * 2, size - inset * 2)
  return ctx.getImageData(0, 0, size, size)
}

function createDirectionalSignIcon(size: number = 24): ImageData {
  const [, ctx] = createCanvasIcon(size)
  // Yellow rectangle background
  ctx.fillStyle = '#FBBF24'
  ctx.fillRect(1, 3, size - 2, size - 6)
  // Black arrow pointing right
  ctx.fillStyle = '#000000'
  const cx = size / 2, cy = size / 2
  ctx.beginPath()
  ctx.moveTo(cx - 6, cy - 5)
  ctx.lineTo(cx + 6, cy)
  ctx.lineTo(cx - 6, cy + 5)
  ctx.closePath()
  ctx.fill()
  return ctx.getImageData(0, 0, size, size)
}

function createSplitCircleIcon(leftColor: string, rightColor: string, size: number = 24): ImageData {
  const [, ctx] = createCanvasIcon(size)
  const r = size / 2 - 2, cx = size / 2, cy = size / 2
  // Left half
  ctx.fillStyle = leftColor
  ctx.beginPath()
  ctx.arc(cx, cy, r, Math.PI * 0.5, Math.PI * 1.5)
  ctx.closePath()
  ctx.fill()
  // Right half
  ctx.fillStyle = rightColor
  ctx.beginPath()
  ctx.arc(cx, cy, r, Math.PI * 1.5, Math.PI * 0.5)
  ctx.closePath()
  ctx.fill()
  // Outline
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  return ctx.getImageData(0, 0, size, size)
}

function createSquareIcon(color: string, size: number = 24): ImageData {
  const [, ctx] = createCanvasIcon(size)
  ctx.fillStyle = color
  ctx.fillRect(2, 2, size - 4, size - 4)
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 1.5
  ctx.strokeRect(2, 2, size - 4, size - 4)
  return ctx.getImageData(0, 0, size, size)
}

function createWindconeIcon(size: number = 24): ImageData {
  const [, ctx] = createCanvasIcon(size)
  // Sideways cone pointing right — orange/white striped windsock
  const cy = size / 2
  ctx.beginPath()
  ctx.moveTo(3, cy - 7)
  ctx.lineTo(size - 4, cy - 2)
  ctx.lineTo(size - 4, cy + 2)
  ctx.lineTo(3, cy + 7)
  ctx.closePath()
  ctx.fillStyle = '#F97316'
  ctx.fill()
  // White stripes
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 1.5
  for (let x = 7; x < size - 6; x += 5) {
    const t = (x - 3) / (size - 7)
    const halfH = 7 - t * 5
    ctx.beginPath()
    ctx.moveTo(x, cy - halfH)
    ctx.lineTo(x, cy + halfH)
    ctx.stroke()
  }
  // Outline
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(3, cy - 7)
  ctx.lineTo(size - 4, cy - 2)
  ctx.lineTo(size - 4, cy + 2)
  ctx.lineTo(3, cy + 7)
  ctx.closePath()
  ctx.stroke()
  return ctx.getImageData(0, 0, size, size)
}

function createStadiumLightIcon(size: number = 24): ImageData {
  const [, ctx] = createCanvasIcon(size)
  const color = '#D4D4D8'
  // Cluster of 4 small circles
  const r = 3.5
  const positions = [
    [size / 2 - 4, size / 2 - 4],
    [size / 2 + 4, size / 2 - 4],
    [size / 2 - 4, size / 2 + 4],
    [size / 2 + 4, size / 2 + 4],
  ]
  for (const [x, y] of positions) {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 0.8
    ctx.stroke()
  }
  return ctx.getImageData(0, 0, size, size)
}

function createTriangleIcon(color: string, size: number = 24): ImageData {
  const [, ctx] = createCanvasIcon(size)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(size / 2, 2)
  ctx.lineTo(size - 2, size - 2)
  ctx.lineTo(2, size - 2)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 1.5
  ctx.stroke()
  return ctx.getImageData(0, 0, size, size)
}

// Generate a labeled sign image that looks like a real airfield sign
function createLabeledSign(
  text: string,
  bgColor: string,
  textColor: string,
  borderColor: string,
): ImageData {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  // Measure text to size the canvas
  const fontSize = 14
  const fontBold = `bold ${fontSize}px system-ui, sans-serif`
  ctx.font = fontBold
  const metrics = ctx.measureText(text)
  const textW = Math.ceil(metrics.width)

  const padX = 8, padY = 5, borderW = 2
  const w = textW + padX * 2 + borderW * 2
  const h = fontSize + padY * 2 + borderW * 2

  canvas.width = w
  canvas.height = h

  // Border
  ctx.fillStyle = borderColor
  ctx.fillRect(0, 0, w, h)

  // Background
  ctx.fillStyle = bgColor
  ctx.fillRect(borderW, borderW, w - borderW * 2, h - borderW * 2)

  // Text
  ctx.font = fontBold
  ctx.fillStyle = textColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2, h / 2)

  return ctx.getImageData(0, 0, w, h)
}

// Sign type → colors for labeled signs
const SIGN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  location_sign:      { bg: '#000000', text: '#FBBF24', border: '#FBBF24' },
  mandatory_sign:     { bg: '#CC0000', text: '#FFFFFF', border: '#FFFFFF' },
  directional_sign:   { bg: '#FBBF24', text: '#000000', border: '#000000' },
  informational_sign:      { bg: '#FBBF24', text: '#000000', border: '#000000' },
  runway_distance_marker:  { bg: '#FFFFFF', text: '#000000', border: '#000000' },
}

// Register labeled sign images with the map, returns set of registered image names
function registerLabeledSigns(m: mapboxgl.Map, features: InfrastructureFeature[]): Set<string> {
  const registered = new Set<string>()
  const pr = { pixelRatio: 1 }

  for (const f of features) {
    if (!f.label || !SIGN_COLORS[f.feature_type]) continue
    const imgName = `sign-label-${f.id}`
    const colors = SIGN_COLORS[f.feature_type]

    // Remove old image if it exists (label may have changed)
    if (m.hasImage(imgName)) m.removeImage(imgName)

    const img = createLabeledSign(f.label, colors.bg, colors.text, colors.border)
    m.addImage(imgName, img, pr)
    registered.add(imgName)
  }

  return registered
}

function addMapIcons(m: mapboxgl.Map) {
  const s = 24, pr = { pixelRatio: 1 }
  m.addImage('icon-location-sign', createSignIcon('#000000', '#FBBF24', s), pr)
  m.addImage('icon-directional-sign', createDirectionalSignIcon(s), pr)
  m.addImage('icon-informational-sign', createSignIcon('#FBBF24', '#000000', s), pr)
  m.addImage('icon-mandatory-sign', createSignIcon('#EF4444', '#FFFFFF', s), pr)
  m.addImage('icon-approach-light', createSplitCircleIcon('#FFFFFF', '#FBBF24', s), pr)
  m.addImage('icon-runway-threshold', createSplitCircleIcon('#EF4444', '#22C55E', s), pr)
  m.addImage('icon-obstruction-light', createTriangleIcon('#EF4444', s), pr)
  m.addImage('icon-runway-distance-marker', createSignIcon('#FFFFFF', '#000000', s), pr)
  m.addImage('icon-papi', createSplitCircleIcon('#EF4444', '#FFFFFF', s), pr)
  m.addImage('icon-threshold-light', createSplitCircleIcon('#EF4444', '#22C55E', s), pr)
  m.addImage('icon-reil', createSquareIcon('#EC4899', s), pr)
  m.addImage('icon-windcone', createWindconeIcon(s), pr)
  m.addImage('icon-stadium-light', createStadiumLightIcon(s), pr)
}

const dirBtnStyle: React.CSSProperties = {
  padding: '8px 0',
  borderRadius: 6,
  border: '1px solid rgba(168,85,247,0.3)',
  background: 'rgba(168,85,247,0.1)',
  color: '#C084FC',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
}

const ICON_MAP: Record<string, string> = {
  approach_light: 'icon-approach-light',
  runway_threshold: 'icon-runway-threshold',
  location_sign: 'icon-location-sign',
  directional_sign: 'icon-directional-sign',
  informational_sign: 'icon-informational-sign',
  mandatory_sign: 'icon-mandatory-sign',
  obstruction_light: 'icon-obstruction-light',
  runway_distance_marker: 'icon-runway-distance-marker',
  papi: 'icon-papi',
  threshold_light: 'icon-threshold-light',
  reil: 'icon-reil',
  windcone: 'icon-windcone',
  stadium_light: 'icon-stadium-light',
}

export default function InfrastructureMapPage() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [legendOpen, setLegendOpen] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    () => Object.fromEntries(LAYER_GROUPS.map(g => [g, false]))
  )
  const [expandedLocGroups, setExpandedLocGroups] = useState<Record<string, boolean>>({})
  // Location tracking
  const [trackingLocation, setTrackingLocation] = useState(false)
  const locationMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const watchIdRef = useRef<number | null>(null)

  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>(
    () => Object.fromEntries(LAYERS.map(l => [l.key, true]))
  )
  const [visibleSourceLayers, setVisibleSourceLayers] = useState<Record<string, boolean>>({})
  const { runways, installationId, userRole } = useInstallation()

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false)
  const pageRef = useRef<HTMLDivElement>(null)

  // Edit mode
  const [editMode, setEditMode] = useState(false)
  const [dbFeatures, setDbFeatures] = useState<InfrastructureFeature[]>([])
  const [systemHealths, setSystemHealths] = useState<SystemHealth[]>([])
  const [healthLoading, setHealthLoading] = useState(true)
  const [lightingSystemsList, setLightingSystemsList] = useState<{ id: string; name: string; system_type: string }[]>([])
  const [allComponentsList, setAllComponentsList] = useState<{ id: string; system_id: string; label: string; system_name: string }[]>([])
  const allComponentsRef = useRef<typeof allComponentsList>([])
  allComponentsRef.current = allComponentsList
  const [placementType, setPlacementType] = useState<InfrastructureFeatureType>('taxiway_light')
  const [saving, setSaving] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const draggingRef = useRef<{ id: string; startLngLat: [number, number] } | null>(null)
  const dragMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const editModeRef = useRef(false)
  const placementTypeRef = useRef<InfrastructureFeatureType>('taxiway_light')

  // Free move mode
  const [freeMoveActive, setFreeMoveActive] = useState(false)
  const freeMoveRef = useRef(false)
  const freeMoveMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const [pendingMoves, setPendingMoves] = useState<Map<string, { lng: number; lat: number }>>(new Map())
  const [savingFreeMove, setSavingFreeMove] = useState(false)

  // Bulk shift mode
  const [bulkShiftOpen, setBulkShiftOpen] = useState(false)
  const [shiftLayer, setShiftLayer] = useState<string>('all')
  const [shiftFeet, setShiftFeet] = useState(5)
  const [shifting, setShifting] = useState(false)

  // Bar placement mode
  type BarType = 'threshold' | 'pre_threshold' | 'terminating' | 'centerline' | 'thousand_ft'
  const BAR_SPECS: Record<BarType, { featureType: InfrastructureFeatureType; count: number; spacing: number; label: string }> = {
    threshold:     { featureType: 'threshold_light',       count: 31, spacing: 5, label: 'Threshold Bar (150\')' },
    pre_threshold: { featureType: 'pre_threshold_light',   count: 5,  spacing: 5, label: 'Pre-Threshold Bar' },
    terminating:   { featureType: 'terminating_bar_light', count: 5,  spacing: 5, label: 'Terminating Bar' },
    centerline:    { featureType: 'centerline_bar_light',  count: 5,  spacing: 5, label: 'Centerline Bar' },
    thousand_ft:   { featureType: 'thousand_ft_bar_light', count: 11, spacing: 5, label: "1000' Bar" },
  }
  const [barPlacement, setBarPlacement] = useState<{ type: BarType; rotation: number } | null>(null)
  const barPlacementRef = useRef<{ type: BarType; rotation: number } | null>(null)

  // Box select mode
  const [boxSelectActive, setBoxSelectActive] = useState(false)
  const boxSelectRef = useRef(false)
  const boxStartRef = useRef<{ x: number; y: number } | null>(null)
  const boxElRef = useRef<HTMLDivElement | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [relayerName, setRelayerName] = useState('')
  const [relayering, setRelayering] = useState(false)

  // Feet-to-degrees conversion at ~42.6°N
  const FT_TO_LNG = 0.00000410
  const FT_TO_LAT = 0.00000274

  // Unique layers from DB features for the layer picker
  const uniqueLayers = useMemo(() => {
    const layers = new Map<string, number>()
    for (const f of dbFeatures) {
      const key = f.layer || 'USER'
      layers.set(key, (layers.get(key) || 0) + 1)
    }
    // Sort alphabetically so related locations group together (TWY B, TWY K, etc.)
    return Array.from(layers.entries()).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
  }, [dbFeatures])

  // Build system-based legend grouping: systems → components with counts, plus unassigned by layer
  const systemLegendGroups = useMemo(() => {
    // Count features per component
    const compCounts = new Map<string, number>()
    let unassignedCount = 0
    const unassignedByLayer = new Map<string, number>()
    for (const f of dbFeatures) {
      if (f.system_component_id) {
        compCounts.set(f.system_component_id, (compCounts.get(f.system_component_id) || 0) + 1)
      } else {
        unassignedCount++
        const layerKey = f.layer || 'USER'
        unassignedByLayer.set(layerKey, (unassignedByLayer.get(layerKey) || 0) + 1)
      }
    }

    // Group components by system
    const systems: { id: string; name: string; components: { id: string; label: string; count: number; type: string }[]; totalCount: number }[] = []
    const sysMap = new Map<string, typeof systems[0]>()
    for (const c of allComponentsList) {
      let sys = sysMap.get(c.system_id)
      if (!sys) {
        sys = { id: c.system_id, name: c.system_name, components: [], totalCount: 0 }
        sysMap.set(c.system_id, sys)
        systems.push(sys)
      }
      const count = compCounts.get(c.id) || 0
      sys.components.push({ id: c.id, label: c.label, count, type: 'component' })
      sys.totalCount += count
    }

    const unassignedLayers = Array.from(unassignedByLayer.entries())
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))

    return { systems, unassignedCount, unassignedLayers }
  }, [dbFeatures, allComponentsList])

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const mapboxReady = isMapboxConfigured()

  const isAdmin = userRole === 'sys_admin' || userRole === 'base_admin'
    || userRole === 'airfield_manager' || userRole === 'namo'

  // Keep refs in sync
  useEffect(() => { editModeRef.current = editMode }, [editMode])
  useEffect(() => { placementTypeRef.current = placementType }, [placementType])
  useEffect(() => { boxSelectRef.current = boxSelectActive }, [boxSelectActive])
  useEffect(() => { freeMoveRef.current = freeMoveActive }, [freeMoveActive])
  useEffect(() => { barPlacementRef.current = barPlacement }, [barPlacement])

  // Keyboard shortcuts: ESC toggles box select, Space toggles fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if typing in an input/select/textarea
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === ' ') {
        e.preventDefault()
        setIsFullscreen(prev => !prev)
      }
      if (e.key === 'Escape') {
        if (freeMoveActive && pendingMoves.size > 0) return
        if (freeMoveActive) { cancelFreeMove(); return }
        if (editMode) {
          setBoxSelectActive(prev => {
            if (prev) { setSelectedIds(new Set()); return false }
            return true
          })
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editMode, freeMoveActive, pendingMoves])

  // Fullscreen: resize map when toggling
  useEffect(() => {
    setTimeout(() => map.current?.resize(), 50)
  }, [isFullscreen])

  // Fetch DB features
  useEffect(() => {
    if (!installationId) return
    fetchInfrastructureFeatures(installationId).then(setDbFeatures)
  }, [installationId])

  // Load lighting systems + components and compute health
  useEffect(() => {
    if (!installationId) return
    setHealthLoading(true)
    Promise.all([
      fetchLightingSystems(installationId),
      fetchAllComponentsForBase(installationId),
    ]).then(([systems, allComponents]) => {
      // Group components by system
      const compsBySystem = new Map<string, typeof allComponents>()
      for (const c of allComponents) {
        const arr = compsBySystem.get(c.system_id) || []
        arr.push(c)
        compsBySystem.set(c.system_id, arr)
      }
      const healths = calculateAllSystemHealth(systems, compsBySystem, dbFeatures)
      setSystemHealths(healths)
      setHealthLoading(false)

      // Build flat list for popup dropdown
      setLightingSystemsList(systems.map(s => ({ id: s.id, name: s.name, system_type: s.system_type })))
      const sysNameMap = new Map(systems.map(s => [s.id, s.name]))
      setAllComponentsList(allComponents
        .filter(c => c.component_type !== 'overall')  // "Overall" aggregates automatically — not assignable
        .map(c => ({
          id: c.id,
          system_id: c.system_id,
          label: c.label,
          system_name: sysNameMap.get(c.system_id) || '',
        })))
    })
  }, [installationId, dbFeatures])

  const [importing, setImporting] = useState(false)

  // Build GeoJSON from DB features, filtered by visible source layers
  const featureGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    const hasFilter = Object.values(visibleSourceLayers).some(v => v === false)
    const geoFeatures: GeoJSON.Feature[] = dbFeatures
      .filter(f => {
        if (!hasFilter) return true
        if (f.system_component_id) {
          // Check component visibility (keyed as "comp:ID")
          return visibleSourceLayers[`comp:${f.system_component_id}`] !== false
        }
        // Unassigned: check layer visibility (keyed as "layer:NAME")
        const layerName = f.layer || 'USER'
        return visibleSourceLayers[`layer:${layerName}`] !== false
      })
      .map(f => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [f.longitude, f.latitude] },
        properties: {
          type: f.feature_type,
          layer: f.layer || 'USER',
          block: f.block,
          text: f.label,
          id: f.id,
          source: f.source,
          status: f.status || 'operational',
          notes: f.notes,
          rotation: f.rotation || 0,
          system_component_id: f.system_component_id || '',
          signIcon: f.label && SIGN_COLORS[f.feature_type] ? `sign-label-${f.id}` : null,
        },
      }))
    return { type: 'FeatureCollection', features: geoFeatures }
  }, [dbFeatures, visibleSourceLayers])

  // Import static GeoJSON into DB
  const handleImport = useCallback(async () => {
    if (!installationId) return
    setImporting(true)
    try {
      const res = await fetch(`/api/infrastructure-import?baseId=${installationId}`, { method: 'POST' })
      const result = await res.json()
      if (res.ok) {
        toast.success(`Imported ${result.inserted} features`)
        const updated = await fetchInfrastructureFeatures(installationId)
        setDbFeatures(updated)
      } else {
        toast.error(result.error || 'Import failed')
      }
    } catch {
      toast.error('Import failed')
    }
    setImporting(false)
  }, [installationId])

  // Feature counts from merged data
  const featureCounts: Record<string, number> = {}
  for (const layer of LAYERS) {
    featureCounts[layer.key] = featureGeoJson.features.filter(
      f => layer.types.includes(f.properties?.type)
    ).length
  }
  const totalFeatures = featureGeoJson.features.length

  const toggleLayer = useCallback((key: string) => {
    setVisibleLayers(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  // Delete handler (exposed on window for popup buttons)
  const deleteHandlerRef = useRef<((id: string) => Promise<void>) | undefined>(undefined)
  deleteHandlerRef.current = async (id: string) => {
    if (!installationId) return
    // Close popup immediately
    document.querySelectorAll('.mapboxgl-popup').forEach(p => p.remove())
    const ok = await deleteInfrastructureFeature(id)
    if (ok) {
      const updated = await fetchInfrastructureFeatures(installationId)
      setDbFeatures(updated)
      toast.success('Feature deleted')
    } else {
      toast.error('Failed to delete feature')
    }
  }

  // Move handler (exposed on window for popup buttons)
  const moveHandlerRef = useRef<((id: string, lng: number, lat: number) => void) | undefined>(undefined)
  moveHandlerRef.current = (id: string, lng: number, lat: number) => {
    if (!map.current || !editModeRef.current) return
    // Close any open popups
    document.querySelectorAll('.mapboxgl-popup').forEach(p => p.remove())

    // Create a draggable marker at the feature's current position
    const el = document.createElement('div')
    el.style.width = '20px'
    el.style.height = '20px'
    el.style.borderRadius = '50%'
    el.style.background = '#10B981'
    el.style.border = '3px solid #FFFFFF'
    el.style.boxShadow = '0 0 12px rgba(16,185,129,0.6)'
    el.style.cursor = 'grab'

    const marker = new mapboxgl.Marker({ element: el, draggable: true })
      .setLngLat([lng, lat])
      .addTo(map.current)

    // Attach Save/Cancel popup to the marker
    const popup = new mapboxgl.Popup({
      offset: 20,
      closeButton: false,
      closeOnClick: false,
      className: 'infrastructure-map-popup',
      anchor: 'bottom',
    })
      .setHTML(`
        <div style="display:flex;gap:6px;padding:2px;">
          <button id="__drag-save" style="
            padding:5px 14px;border:none;border-radius:6px;
            background:#10B981;color:white;font-size:12px;font-weight:600;cursor:pointer;
          ">Save</button>
          <button id="__drag-cancel" style="
            padding:5px 14px;border:none;border-radius:6px;
            background:transparent;border:1px solid rgba(148,163,184,0.3);
            color:#94A3B8;font-size:12px;font-weight:600;cursor:pointer;
          ">Cancel</button>
        </div>
      `)
    marker.setPopup(popup)
    popup.addTo(map.current)

    // Wire up buttons via DOM after popup renders
    setTimeout(() => {
      document.getElementById('__drag-save')?.addEventListener('click', () => {
        saveDragRef.current?.()
      })
      document.getElementById('__drag-cancel')?.addEventListener('click', () => {
        cancelDrag()
      })
    }, 0)

    dragMarkerRef.current = marker
    setDraggingId(id)
    draggingRef.current = { id, startLngLat: [lng, lat] }

    // Disable map drag while moving a feature
    map.current.dragPan.disable()
    map.current.touchZoomRotate.disable()
  }

  // Save drag position
  const saveDragRef = useRef<(() => Promise<void>) | undefined>(undefined)
  saveDragRef.current = async () => {
    if (!draggingRef.current || !dragMarkerRef.current || !installationId) return
    const { id } = draggingRef.current
    const lngLat = dragMarkerRef.current.getLngLat()

    setSaving(true)
    const ok = await updateInfrastructureFeature(id, {
      longitude: lngLat.lng,
      latitude: lngLat.lat,
    })
    if (ok) {
      const updated = await fetchInfrastructureFeatures(installationId)
      setDbFeatures(updated)
      toast.success('Feature moved')
    } else {
      toast.error('Failed to move feature')
    }
    setSaving(false)
    cancelDrag()
  }

  const cancelDrag = useCallback(() => {
    if (dragMarkerRef.current) {
      const popup = dragMarkerRef.current.getPopup()
      if (popup) popup.remove()
      dragMarkerRef.current.remove()
      dragMarkerRef.current = null
    }
    draggingRef.current = null
    setDraggingId(null)
    if (map.current) {
      map.current.dragPan.enable()
      map.current.touchZoomRotate.enable()
    }
  }, [])

  // Free move: click a feature to make it draggable, accumulate moves, bulk save
  const addFreeMoveMarker = useCallback((id: string, lng: number, lat: number) => {
    if (!map.current || freeMoveMarkersRef.current.has(id)) return

    const el = document.createElement('div')
    el.style.width = '18px'
    el.style.height = '18px'
    el.style.borderRadius = '50%'
    el.style.background = '#F59E0B'
    el.style.border = '2px solid #FFFFFF'
    el.style.boxShadow = '0 0 10px rgba(245,158,11,0.5)'
    el.style.cursor = 'grab'

    const marker = new mapboxgl.Marker({ element: el, draggable: true })
      .setLngLat([lng, lat])
      .addTo(map.current)

    marker.on('dragend', () => {
      const pos = marker.getLngLat()
      setPendingMoves(prev => {
        const next = new Map(prev)
        next.set(id, { lng: pos.lng, lat: pos.lat })
        return next
      })
    })

    freeMoveMarkersRef.current.set(id, marker)
    setPendingMoves(prev => {
      const next = new Map(prev)
      next.set(id, { lng, lat })
      return next
    })
  }, [])

  const saveAllFreeMoves = useCallback(async () => {
    if (!installationId || pendingMoves.size === 0) return
    setSavingFreeMove(true)

    const promises = Array.from(pendingMoves.entries()).map(([id, pos]) =>
      updateInfrastructureFeature(id, { longitude: pos.lng, latitude: pos.lat })
    )
    const results = await Promise.all(promises)
    const successCount = results.filter(Boolean).length

    // Clean up markers
    freeMoveMarkersRef.current.forEach(m => m.remove())
    freeMoveMarkersRef.current.clear()
    setPendingMoves(new Map())

    const updated = await fetchInfrastructureFeatures(installationId)
    setDbFeatures(updated)

    if (successCount > 0) toast.success(`Saved ${successCount} feature${successCount > 1 ? 's' : ''}`)
    if (successCount < pendingMoves.size) toast.error(`${pendingMoves.size - successCount} failed to save`)
    setSavingFreeMove(false)
  }, [installationId, pendingMoves])

  const cancelFreeMove = useCallback(() => {
    freeMoveMarkersRef.current.forEach(m => m.remove())
    freeMoveMarkersRef.current.clear()
    setPendingMoves(new Map())
    setFreeMoveActive(false)
  }, [])

  // Expose free move click handler on window for popups
  const freeMoveClickRef = useRef<((id: string, lng: number, lat: number) => void) | undefined>(undefined)
  freeMoveClickRef.current = (id: string, lng: number, lat: number) => {
    addFreeMoveMarker(id, lng, lat)
    document.querySelectorAll('.mapboxgl-popup').forEach(p => p.remove())
  }

  // Save label handler
  const savePropsRef = useRef<((id: string, label: string, rotation: number) => Promise<void>) | undefined>(undefined)
  savePropsRef.current = async (id: string, label: string, rotation: number) => {
    if (!installationId) return
    const ok = await updateInfrastructureFeature(id, {
      label: label || undefined,
      rotation: rotation || 0,
    })
    if (ok) {
      const updated = await fetchInfrastructureFeatures(installationId)
      setDbFeatures(updated)
      document.querySelectorAll('.mapboxgl-popup').forEach(p => p.remove())
      toast.success('Feature updated')
    } else {
      toast.error('Failed to update feature')
    }
  }

  // Report Outage handler — marks feature inoperative + auto-creates discrepancy
  const reportOutageRef = useRef<((id: string) => Promise<void>) | undefined>(undefined)
  reportOutageRef.current = async (id: string) => {
    if (!installationId) return
    document.querySelectorAll('.mapboxgl-popup').forEach(p => p.remove())

    const feature = dbFeatures.find(f => f.id === id)
    if (!feature) return

    const updated = await updateFeatureStatus(id, 'inoperative')
    if (!updated) {
      toast.error('Failed to report outage')
      return
    }

    // Find the layer config for display label
    const layerCfg = LAYERS.find(l => l.types.includes(feature.feature_type))
    const featureLabel = feature.label || layerCfg?.label || feature.feature_type

    // Auto-create discrepancy
    const { data: disc } = await createDiscrepancy({
      title: `${featureLabel} — Inoperative`,
      description: `Visual NAVAID marked inoperative from infrastructure map. Feature type: ${layerCfg?.label || feature.feature_type}.${feature.layer ? ` Layer: ${feature.layer}.` : ''}`,
      location_text: feature.layer || 'Airfield',
      type: 'lighting',
      latitude: feature.latitude,
      longitude: feature.longitude,
      base_id: installationId,
      infrastructure_feature_id: id,
      assigned_shop: 'Airfield Management',
    })

    // Create outage event
    await createOutageEvent({
      base_id: installationId,
      feature_id: id,
      system_component_id: feature.system_component_id || undefined,
      event_type: 'reported',
      discrepancy_id: disc?.id || undefined,
      notes: `${featureLabel} reported inoperative`,
    })

    const refreshed = await fetchInfrastructureFeatures(installationId)
    setDbFeatures(refreshed)

    if (disc) {
      toast.success(`Outage reported — Discrepancy ${disc.display_id} created`)
    } else {
      toast.success('Outage reported')
    }
  }

  // Mark Operational handler — restores feature status
  const markOperationalRef = useRef<((id: string) => Promise<void>) | undefined>(undefined)
  markOperationalRef.current = async (id: string) => {
    if (!installationId) return
    document.querySelectorAll('.mapboxgl-popup').forEach(p => p.remove())

    const feature = dbFeatures.find(f => f.id === id)
    if (!feature) return

    const updated = await updateFeatureStatus(id, 'operational')
    if (!updated) {
      toast.error('Failed to mark operational')
      return
    }

    const layerCfg = LAYERS.find(l => l.types.includes(feature.feature_type))
    const featureLabel = feature.label || layerCfg?.label || feature.feature_type

    // Create outage event
    await createOutageEvent({
      base_id: installationId,
      feature_id: id,
      system_component_id: feature.system_component_id || undefined,
      event_type: 'resolved',
      notes: `${featureLabel} restored to operational`,
    })

    const refreshed = await fetchInfrastructureFeatures(installationId)
    setDbFeatures(refreshed)
    toast.success('Feature marked operational')
  }

  // Assign component handler
  const assignComponentRef = useRef<((featureId: string, componentId: string | null) => Promise<void>) | undefined>(undefined)
  assignComponentRef.current = async (featureId: string, componentId: string | null) => {
    if (!installationId) return
    const ok = await updateInfrastructureFeature(featureId, {
      system_component_id: componentId || null,
    })
    if (ok) {
      const refreshed = await fetchInfrastructureFeatures(installationId)
      setDbFeatures(refreshed)
      toast.success(componentId ? 'Component assigned' : 'Component unassigned')
    } else {
      toast.error('Failed to assign component')
    }
    document.querySelectorAll('.mapboxgl-popup').forEach(p => p.remove())
  }

  useEffect(() => {
    (window as any).__deleteInfraFeature = (id: string) => {
      deleteHandlerRef.current?.(id)
    }
    ;(window as any).__freeMoveFeature = (id: string, lng: number, lat: number) => {
      freeMoveClickRef.current?.(id, lng, lat)
    }
    ;(window as any).__moveInfraFeature = (id: string, lng: number, lat: number) => {
      moveHandlerRef.current?.(id, lng, lat)
    }
    ;(window as any).__saveFeatureProps = (id: string, label: string, rotation: number) => {
      savePropsRef.current?.(id, label, rotation)
    }
    ;(window as any).__reportOutage = (id: string) => {
      reportOutageRef.current?.(id)
    }
    ;(window as any).__markOperational = (id: string) => {
      markOperationalRef.current?.(id)
    }
    ;(window as any).__assignComponent = (featureId: string, componentId: string) => {
      assignComponentRef.current?.(featureId, componentId || null)
    }
    return () => {
      delete (window as any).__deleteInfraFeature
      delete (window as any).__moveInfraFeature
      delete (window as any).__freeMoveFeature
      delete (window as any).__saveFeatureProps
      delete (window as any).__reportOutage
      delete (window as any).__markOperational
      delete (window as any).__assignComponent
    }
  }, [])

  // Place feature handler
  const placeFeatureRef = useRef<((lng: number, lat: number) => Promise<void>) | undefined>(undefined)
  placeFeatureRef.current = async (lng: number, lat: number) => {
    if (!installationId || saving) return
    setSaving(true)
    const result = await createInfrastructureFeature({
      baseId: installationId,
      feature_type: placementTypeRef.current,
      longitude: lng,
      latitude: lat,
    })
    if (result) {
      const updated = await fetchInfrastructureFeatures(installationId)
      setDbFeatures(updated)

      // Show popup at placed location with type selector
      if (map.current) {
        const optionsHtml = FEATURE_TYPE_OPTIONS.map(opt =>
          `<option value="${opt.value}" ${opt.value === placementTypeRef.current ? 'selected' : ''}>${opt.label}</option>`
        ).join('')

        const popup = new mapboxgl.Popup({
          offset: 12,
          closeButton: true,
          closeOnClick: true,
          className: 'infrastructure-map-popup',
          maxWidth: '220px',
        })
          .setLngLat([lng, lat])
          .setHTML(`
            <div style="font-family:system-ui;font-size:12px;color:#E2E8F0;">
              <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:#10B981;">Feature Placed</div>
              <select id="__placed-type" style="
                width:100%;background:rgba(30,41,59,0.9);border:1px solid rgba(148,163,184,0.2);
                border-radius:6px;padding:5px 8px;color:#E2E8F0;font-size:12px;cursor:pointer;
              ">${optionsHtml}</select>
            </div>
          `)
          .addTo(map.current)

        setTimeout(() => {
          const sel = document.getElementById('__placed-type') as HTMLSelectElement | null
          sel?.addEventListener('change', async () => {
            const newType = sel.value as InfrastructureFeatureType
            const ok = await updateInfrastructureFeature(result.id, { feature_type: newType })
            if (ok) {
              const refreshed = await fetchInfrastructureFeatures(installationId)
              setDbFeatures(refreshed)
              setPlacementType(newType)
              placementTypeRef.current = newType
              toast.success(`Changed to ${FEATURE_TYPE_OPTIONS.find(o => o.value === newType)?.label}`)
            }
            popup.remove()
          })
        }, 0)
      }
    } else {
      toast.error('Failed to place feature')
    }
    setSaving(false)
  }

  // GPS capture
  const handleGpsCapture = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not available')
      return
    }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        await placeFeatureRef.current?.(longitude, latitude)
        map.current?.flyTo({ center: [longitude, latitude], zoom: 17, duration: 1500 })
        setGpsLoading(false)
      },
      (err) => {
        setGpsLoading(false)
        toast.error(`GPS error: ${err.message}`)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  // Location tracking — live GPS marker
  const toggleLocationTracking = useCallback(() => {
    if (trackingLocation) {
      // Stop tracking
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      locationMarkerRef.current?.remove()
      locationMarkerRef.current = null
      setTrackingLocation(false)
      return
    }

    if (!navigator.geolocation) {
      toast.error('Geolocation not available')
      return
    }

    setTrackingLocation(true)

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        const lngLat: [number, number] = [longitude, latitude]

        if (!locationMarkerRef.current && map.current) {
          // Create a pulsing blue dot marker
          const el = document.createElement('div')
          el.style.cssText = `
            width: 18px; height: 18px; border-radius: 50%;
            background: #3B82F6; border: 3px solid #FFFFFF;
            box-shadow: 0 0 8px rgba(59,130,246,0.6), 0 0 20px rgba(59,130,246,0.3);
          `
          locationMarkerRef.current = new mapboxgl.Marker({ element: el })
            .setLngLat(lngLat)
            .addTo(map.current)

          // Fly to first position
          map.current.flyTo({ center: lngLat, zoom: 17, duration: 1500 })
        } else {
          locationMarkerRef.current?.setLngLat(lngLat)
        }
      },
      (err) => {
        toast.error(`GPS error: ${err.message}`)
        setTrackingLocation(false)
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    )
  }, [trackingLocation])

  // Clean up watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      locationMarkerRef.current?.remove()
    }
  }, [])

  // Bar placement handler — creates a bar of lights at clicked location
  const placeBarRef = useRef<((lng: number, lat: number) => Promise<void>) | undefined>(undefined)
  placeBarRef.current = async (lng: number, lat: number) => {
    const bp = barPlacementRef.current
    if (!installationId || saving || !bp) return
    setSaving(true)
    const spec = BAR_SPECS[bp.type]
    const center = { lat, lon: lng }
    // Bar extends perpendicular to the rotation direction
    const perpBearing = normalizeBearing(bp.rotation + 90)
    const halfWidth = ((spec.count - 1) * spec.spacing) / 2

    const features: { feature_type: InfrastructureFeatureType; longitude: number; latitude: number; rotation?: number }[] = []
    for (let i = 0; i < spec.count; i++) {
      const offset = -halfWidth + i * spec.spacing
      if (Math.abs(offset) < 0.01) {
        features.push({ feature_type: spec.featureType, longitude: lng, latitude: lat, rotation: bp.rotation })
      } else {
        const dir = offset < 0 ? normalizeBearing(perpBearing + 180) : perpBearing
        const pt = offsetPoint(center, dir, Math.abs(offset))
        features.push({ feature_type: spec.featureType, longitude: pt.lon, latitude: pt.lat, rotation: bp.rotation })
      }
    }

    const inserted = await bulkCreateInfrastructureFeatures(installationId, features as any)
    if (inserted > 0) {
      const updated = await fetchInfrastructureFeatures(installationId)
      setDbFeatures(updated)
      toast.success(`Placed ${spec.label} (${inserted} lights)`)
    } else {
      toast.error('Failed to place bar')
    }
    setSaving(false)
  }

  // Bulk shift apply
  const handleBulkShift = useCallback(async (direction: 'N' | 'S' | 'E' | 'W') => {
    if (!installationId || shifting) return
    const lngOffset = direction === 'E' ? shiftFeet * FT_TO_LNG
      : direction === 'W' ? -shiftFeet * FT_TO_LNG : 0
    const latOffset = direction === 'N' ? shiftFeet * FT_TO_LAT
      : direction === 'S' ? -shiftFeet * FT_TO_LAT : 0

    const filter: { layer?: string } = {}
    if (shiftLayer !== 'all') filter.layer = shiftLayer

    setShifting(true)
    const count = await bulkShiftFeatures(installationId, lngOffset, latOffset, filter)
    if (count > 0) {
      const updated = await fetchInfrastructureFeatures(installationId)
      setDbFeatures(updated)
      toast.success(`Shifted ${count} features ${shiftFeet}ft ${direction}`)
    } else {
      toast.error('No features shifted')
    }
    setShifting(false)
  }, [installationId, shifting, shiftFeet, shiftLayer])

  // Shift selected features by direction
  const handleSelectionShift = useCallback(async (direction: 'N' | 'S' | 'E' | 'W') => {
    if (!installationId || shifting || selectedIds.size === 0) return
    const lngOffset = direction === 'E' ? shiftFeet * FT_TO_LNG
      : direction === 'W' ? -shiftFeet * FT_TO_LNG : 0
    const latOffset = direction === 'N' ? shiftFeet * FT_TO_LAT
      : direction === 'S' ? -shiftFeet * FT_TO_LAT : 0

    setShifting(true)
    const count = await bulkShiftByIds(Array.from(selectedIds), lngOffset, latOffset)
    if (count > 0) {
      const updated = await fetchInfrastructureFeatures(installationId)
      setDbFeatures(updated)
      toast.success(`Shifted ${count} selected features ${shiftFeet}ft ${direction}`)
    } else {
      toast.error('No features shifted')
    }
    setShifting(false)
  }, [installationId, shifting, shiftFeet, selectedIds])

  // Re-layer selected features
  const handleRelayer = useCallback(async () => {
    if (!installationId || relayering || selectedIds.size === 0 || !relayerName.trim()) return
    setRelayering(true)
    const count = await bulkRelayerFeatures(Array.from(selectedIds), relayerName.trim())
    if (count > 0) {
      const updated = await fetchInfrastructureFeatures(installationId)
      setDbFeatures(updated)
      toast.success(`Re-layered ${count} features to "${relayerName.trim()}"`)
      setRelayerName('')
    } else {
      toast.error('Failed to re-layer features')
    }
    setRelayering(false)
  }, [installationId, relayering, selectedIds, relayerName])

  // Assign selected features to a component
  const [assignCompId, setAssignCompId] = useState('')
  const [assigningSelected, setAssigningSelected] = useState(false)
  const handleAssignSelected = useCallback(async () => {
    if (!installationId || assigningSelected || selectedIds.size === 0) return
    setAssigningSelected(true)
    const supabase = (await import('@/lib/supabase/client')).createClient()
    if (supabase) {
      const ids = Array.from(selectedIds)
      let updated = 0
      for (let i = 0; i < ids.length; i += 200) {
        const batch = ids.slice(i, i + 200)
        const { error } = await supabase
          .from('infrastructure_features')
          .update({
            system_component_id: assignCompId || null,
            updated_at: new Date().toISOString(),
          } as any)
          .in('id', batch)
        if (!error) updated += batch.length
      }
      if (updated > 0) {
        // Update component total_count
        if (assignCompId) {
          const { count } = await supabase
            .from('infrastructure_features')
            .select('*', { count: 'exact', head: true })
            .eq('system_component_id', assignCompId)
          if (count !== null) {
            await supabase
              .from('lighting_system_components')
              .update({ total_count: count } as any)
              .eq('id', assignCompId)
          }
        }
        const refreshed = await fetchInfrastructureFeatures(installationId)
        setDbFeatures(refreshed)
        toast.success(assignCompId
          ? `Assigned ${updated} feature(s) to component`
          : `Unlinked ${updated} feature(s) from components`)
      }
    }
    setAssigningSelected(false)
  }, [installationId, assigningSelected, selectedIds, assignCompId])

  // Re-type selected features
  const [retypeName, setRetypeName] = useState('')
  const [retyping, setRetyping] = useState(false)
  const handleRetype = useCallback(async () => {
    if (!installationId || retyping || selectedIds.size === 0 || !retypeName) return
    setRetyping(true)
    const supabase = (await import('@/lib/supabase/client')).createClient()
    if (supabase) {
      const ids = Array.from(selectedIds)
      let updated = 0
      for (let i = 0; i < ids.length; i += 200) {
        const batch = ids.slice(i, i + 200)
        const { error } = await supabase
          .from('infrastructure_features')
          .update({ feature_type: retypeName, updated_at: new Date().toISOString() } as any)
          .in('id', batch)
        if (!error) updated += batch.length
      }
      if (updated > 0) {
        const refreshed = await fetchInfrastructureFeatures(installationId)
        setDbFeatures(refreshed)
        toast.success(`Re-typed ${updated} feature(s) to "${retypeName.replace(/_/g, ' ')}"`)
        setRetypeName('')
      } else {
        toast.error('Failed to re-type features')
      }
    }
    setRetyping(false)
  }, [installationId, retyping, selectedIds, retypeName])

  // Delete all selected features
  const [deletingSelected, setDeletingSelected] = useState(false)
  const handleDeleteSelected = useCallback(async () => {
    if (!installationId || deletingSelected || selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} selected feature${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`)) return
    setDeletingSelected(true)
    const promises = Array.from(selectedIds).map(id => deleteInfrastructureFeature(id))
    const results = await Promise.all(promises)
    const deleted = results.filter(Boolean).length
    if (deleted > 0) {
      const updated = await fetchInfrastructureFeatures(installationId)
      setDbFeatures(updated)
      setSelectedIds(new Set())
      toast.success(`Deleted ${deleted} feature${deleted > 1 ? 's' : ''}`)
    } else {
      toast.error('Failed to delete features')
    }
    setDeletingSelected(false)
  }, [installationId, deletingSelected, selectedIds])

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
      zoom: 14,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    })

    m.addControl(new mapboxgl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right')

    // Enable touch rotation and pitch
    m.touchZoomRotate.enableRotation()
    m.touchPitch.enable()

    m.on('load', () => {
      addMapIcons(m)

      m.addSource('infrastructure', {
        type: 'geojson',
        data: featureGeoJson,
      })

      for (const layer of LAYERS) {
        const filterExpr: mapboxgl.Expression = layer.types.length === 1
          ? ['==', ['get', 'type'], layer.types[0]]
          : ['any', ...layer.types.map(t => ['==', ['get', 'type'], t])] as mapboxgl.Expression

        if (layer.renderType === 'symbol') {
          const iconName = ICON_MAP[layer.types[0]]
          const isSignLayer = SIGN_COLORS[layer.types[0]] !== undefined
          m.addLayer({
            id: layer.key,
            type: 'symbol',
            source: 'infrastructure',
            filter: filterExpr,
            layout: {
              'icon-image': isSignLayer
                ? ['coalesce', ['get', 'signIcon'], iconName] as any
                : iconName,
              'icon-size': [
                'interpolate', ['linear'], ['zoom'],
                12, 0.2,
                14, 0.4,
                16, 0.7,
                18, 1,
              ],
              'icon-allow-overlap': true,
              'icon-rotate': ['get', 'rotation'],
              'icon-rotation-alignment': 'map',
            },
          })
        } else {
          m.addLayer({
            id: layer.key,
            type: 'circle',
            source: 'infrastructure',
            filter: filterExpr,
            paint: {
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                12, 2,
                14, 4,
                16, 6,
                18, 10,
              ],
              'circle-color': [
                'case',
                ['==', ['get', 'status'], 'inoperative'], '#EF4444',
                layer.color,
              ] as any,
              'circle-opacity': 0.85,
              'circle-stroke-color': [
                'case',
                ['==', ['get', 'status'], 'inoperative'], '#FFFFFF',
                '#000000',
              ] as any,
              'circle-stroke-width': [
                'case',
                ['==', ['get', 'status'], 'inoperative'], 1.5,
                0.5,
              ] as any,
            },
          })
        }

        // Click handler for popups
        m.on('click', layer.key, (e) => {
          if (!e.features || e.features.length === 0) return
          e.originalEvent.stopPropagation()
          const feat = e.features[0]
          const coords = (feat.geometry as GeoJSON.Point).coordinates.slice() as [number, number]
          const props = feat.properties || {}
          const isEditing = editModeRef.current

          let html = `<div style="font-family:system-ui;font-size:12px;color:#E2E8F0;">`
          html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">`
          html += `<div style="font-weight:700;font-size:13px;color:${layer.color}">${layer.label}</div>`
          const isInop = props.status === 'inoperative'
          html += `<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;background:${isInop ? '#EF4444' : '#10B981'};color:white;">${isInop ? 'INOP' : 'OP'}</span>`
          html += `</div>`
          if (props.source === 'user') {
            html += `<div style="font-size:10px;color:#10B981;margin-bottom:4px;">User-added</div>`
          }
          html += `<div style="color:#94A3B8;font-size:11px;">Lat: ${coords[1].toFixed(6)}</div>`
          html += `<div style="color:#94A3B8;font-size:11px;">Lon: ${coords[0].toFixed(6)}</div>`
          if (props.block) {
            html += `<div style="margin-top:4px;color:#CBD5E1;">Fixture: ${props.block}</div>`
          }
          if (props.text) {
            html += `<div style="margin-top:4px;color:#CBD5E1;">Label: ${props.text}</div>`
          }
          if (props.notes) {
            html += `<div style="margin-top:4px;color:#CBD5E1;">Notes: ${props.notes}</div>`
          }
          if (props.rotation) {
            html += `<div style="margin-top:4px;color:#CBD5E1;">Rotation: ${props.rotation}°</div>`
          }
          // Component assignment (always visible)
          if (props.id && allComponentsRef.current.length > 0) {
            const currentCompId = props.system_component_id || ''
            const currentComp = allComponentsRef.current.find(c => c.id === currentCompId)
            if (currentComp) {
              html += `<div style="margin-top:6px;font-size:10px;color:#94A3B8;">${currentComp.system_name} &mdash; ${currentComp.label}</div>`
            }
            const compOptions = allComponentsRef.current.map(c =>
              `<option value="${c.id}" ${c.id === currentCompId ? 'selected' : ''}>${c.system_name} — ${c.label}</option>`
            ).join('')
            html += `<select onchange="window.__assignComponent('${props.id}',this.value)" style="
              margin-top:4px;width:100%;padding:4px 6px;border-radius:4px;
              border:1px solid rgba(148,163,184,0.2);background:rgba(30,41,59,0.9);
              color:#E2E8F0;font-size:11px;cursor:pointer;
            "><option value="">— Assign to component —</option>${compOptions}</select>`
          }
          // Status toggle button (always visible, not just in edit mode)
          if (props.id) {
            if (isInop) {
              html += `<button onclick="window.__markOperational('${props.id}')" style="
                margin-top:8px;width:100%;padding:6px 0;border:none;border-radius:4px;
                background:#10B981;color:white;font-size:11px;font-weight:600;cursor:pointer;
              ">Mark Operational</button>`
            } else {
              html += `<button onclick="window.__reportOutage('${props.id}')" style="
                margin-top:8px;width:100%;padding:6px 0;border:none;border-radius:4px;
                background:#EF4444;color:white;font-size:11px;font-weight:600;cursor:pointer;
              ">Report Outage</button>`
            }
          }
          if (props.id && isEditing) {
            // Label edit field
            const escapedLabel = (props.text || '').replace(/'/g, "\\'").replace(/"/g, '&quot;')
            const currentRotation = props.rotation || 0
            html += `<div style="margin-top:8px;">`
            html += `<input id="__label-input" type="text" value="${escapedLabel}" placeholder="Label..." style="
              width:100%;padding:4px 6px;border-radius:4px;box-sizing:border-box;
              border:1px solid rgba(148,163,184,0.2);background:rgba(30,41,59,0.9);
              color:#E2E8F0;font-size:12px;outline:none;margin-bottom:6px;
            " />`
            // Rotation slider with compass
            html += `<div style="display:flex;align-items:center;gap:8px;">`
            html += `<div style="flex-shrink:0;"><svg width="32" height="32" viewBox="0 0 32 32">`
            html += `<circle cx="16" cy="16" r="14" fill="none" stroke="#475569" stroke-width="1"/>`
            html += `<text x="16" y="8" text-anchor="middle" font-size="7" fill="#94A3B8">N</text>`
            html += `<line id="__compass-needle" x1="16" y1="16" x2="16" y2="5" stroke="#EF4444" stroke-width="2" transform="rotate(${currentRotation},16,16)"/>`
            html += `</svg></div>`
            html += `<div style="flex:1;">`
            html += `<div style="display:flex;justify-content:space-between;margin-bottom:2px;">`
            html += `<span style="font-size:10px;color:#94A3B8;">Rotation</span>`
            html += `<span id="__rotation-value" style="font-size:10px;color:#CBD5E1;">${currentRotation}°</span>`
            html += `</div>`
            html += `<input id="__rotation-input" type="range" min="0" max="359" value="${currentRotation}" oninput="document.getElementById('__rotation-value').textContent=this.value+'°';document.getElementById('__compass-needle').setAttribute('transform','rotate('+this.value+',16,16)');" style="width:100%;accent-color:#10B981;cursor:pointer;" />`
            html += `</div></div>`
            // Save button
            html += `<button onclick="window.__saveFeatureProps('${props.id}',document.getElementById('__label-input').value,parseInt(document.getElementById('__rotation-input').value))" style="
              margin-top:6px;width:100%;padding:5px 0;border:none;border-radius:4px;
              background:#10B981;color:white;font-size:11px;font-weight:600;cursor:pointer;
            ">Save</button>`
            html += `</div>`

            // Action buttons
            html += `<div style="display:flex;gap:6px;margin-top:6px;">`
            if (freeMoveRef.current) {
              html += `<button onclick="window.__freeMoveFeature('${props.id}',${coords[0]},${coords[1]})" style="
                flex:1;padding:5px 0;border:none;border-radius:5px;
                background:#F59E0B;color:black;font-size:12px;font-weight:600;cursor:pointer;
              ">Grab</button>`
            } else {
              html += `<button onclick="window.__moveInfraFeature('${props.id}',${coords[0]},${coords[1]})" style="
                flex:1;padding:5px 0;border:none;border-radius:5px;
                background:#3B82F6;color:white;font-size:12px;font-weight:600;cursor:pointer;
              ">Move</button>`
            }
            html += `<button onclick="window.__deleteInfraFeature('${props.id}')" style="
              flex:1;padding:5px 0;border:none;border-radius:5px;
              background:#EF4444;color:white;font-size:12px;font-weight:600;cursor:pointer;
            ">Delete</button>`
            html += `</div>`
          }
          html += `</div>`

          new mapboxgl.Popup({
            offset: 12,
            closeButton: true,
            closeOnClick: true,
            maxWidth: '240px',
            className: 'infrastructure-map-popup',
          })
            .setLngLat(coords)
            .setHTML(html)
            .addTo(m)
        })

        m.on('mouseenter', layer.key, () => { m.getCanvas().style.cursor = 'pointer' })
        m.on('mouseleave', layer.key, () => { m.getCanvas().style.cursor = '' })
      }

      // Inoperative overlay — red pulsing ring for all inoperative features (symbols)
      m.addLayer({
        id: 'inoperative-overlay',
        type: 'circle',
        source: 'infrastructure',
        filter: ['==', ['get', 'status'], 'inoperative'],
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            12, 4,
            14, 7,
            16, 10,
            18, 14,
          ],
          'circle-color': 'transparent',
          'circle-stroke-color': '#EF4444',
          'circle-stroke-width': 2,
          'circle-opacity': 0.9,
        },
      })

      // Click on empty map area — place feature or bar in edit mode (skip if dragging or box selecting)
      m.on('click', (e) => {
        if (!editModeRef.current || draggingRef.current || boxSelectRef.current || freeMoveRef.current) return
        const layerIds = LAYERS.map(l => l.key)
        const clicked = m.queryRenderedFeatures(e.point, { layers: layerIds })
        if (clicked.length > 0) return

        if (barPlacementRef.current) {
          placeBarRef.current?.(e.lngLat.lng, e.lngLat.lat)
        } else {
          placeFeatureRef.current?.(e.lngLat.lng, e.lngLat.lat)
        }
      })

      // Box select: shared helpers for mouse + touch
      function boxStart(clientX: number, clientY: number) {
        if (!boxSelectRef.current) return
        m.dragPan.disable()
        m.touchZoomRotate.disable()

        const canvas = m.getCanvasContainer()
        const rect = canvas.getBoundingClientRect()
        boxStartRef.current = { x: clientX - rect.left, y: clientY - rect.top }

        const box = document.createElement('div')
        box.style.position = 'absolute'
        box.style.border = '2px dashed #A855F7'
        box.style.background = 'rgba(168, 85, 247, 0.1)'
        box.style.pointerEvents = 'none'
        box.style.zIndex = '20'
        canvas.appendChild(box)
        boxElRef.current = box
      }

      function boxMove(clientX: number, clientY: number) {
        if (!boxStartRef.current || !boxElRef.current) return
        const canvas = m.getCanvasContainer()
        const rect = canvas.getBoundingClientRect()
        const curX = clientX - rect.left
        const curY = clientY - rect.top

        boxElRef.current.style.left = Math.min(boxStartRef.current.x, curX) + 'px'
        boxElRef.current.style.top = Math.min(boxStartRef.current.y, curY) + 'px'
        boxElRef.current.style.width = Math.abs(curX - boxStartRef.current.x) + 'px'
        boxElRef.current.style.height = Math.abs(curY - boxStartRef.current.y) + 'px'
      }

      function boxEnd(clientX: number, clientY: number) {
        if (!boxStartRef.current || !boxElRef.current) return
        const canvas = m.getCanvasContainer()
        const rect = canvas.getBoundingClientRect()
        const endX = clientX - rect.left
        const endY = clientY - rect.top

        boxElRef.current.remove()
        boxElRef.current = null

        const minX = Math.min(boxStartRef.current.x, endX)
        const maxX = Math.max(boxStartRef.current.x, endX)
        const minY = Math.min(boxStartRef.current.y, endY)
        const maxY = Math.max(boxStartRef.current.y, endY)
        boxStartRef.current = null

        m.dragPan.enable()
        m.touchZoomRotate.enable()

        if (maxX - minX < 10 || maxY - minY < 10) return

        const layerIds = LAYERS.map(l => l.key)
        const features = m.queryRenderedFeatures(
          [[minX, minY], [maxX, maxY]] as [mapboxgl.PointLike, mapboxgl.PointLike],
          { layers: layerIds }
        )

        const ids = new Set<string>()
        for (const f of features) {
          if (f.properties?.id) ids.add(f.properties.id)
        }

        if (ids.size > 0) {
          setSelectedIds(ids)
        }
      }

      // Mouse events
      m.on('mousedown', (e) => {
        if (!boxSelectRef.current) return
        e.preventDefault()
        boxStart(e.originalEvent.clientX, e.originalEvent.clientY)
      })

      m.on('mousemove', (e) => {
        boxMove(e.originalEvent.clientX, e.originalEvent.clientY)
      })

      m.on('mouseup', (e) => {
        boxEnd(e.originalEvent.clientX, e.originalEvent.clientY)
      })

      // Touch events (on the canvas container directly)
      const canvasEl = m.getCanvasContainer()

      canvasEl.addEventListener('touchstart', (e) => {
        if (!boxSelectRef.current || e.touches.length !== 1) return
        e.preventDefault()
        boxStart(e.touches[0].clientX, e.touches[0].clientY)
      }, { passive: false })

      canvasEl.addEventListener('touchmove', (e) => {
        if (!boxStartRef.current) return
        e.preventDefault()
        boxMove(e.touches[0].clientX, e.touches[0].clientY)
      }, { passive: false })

      canvasEl.addEventListener('touchend', (e) => {
        if (!boxStartRef.current) return
        const touch = e.changedTouches[0]
        boxEnd(touch.clientX, touch.clientY)
      })

      setMapLoaded(true)
    })

    map.current = m

    return () => {
      m.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, installationId])

  // Register labeled sign images and update map source when data changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return
    registerLabeledSigns(map.current, dbFeatures)
    const source = map.current.getSource('infrastructure') as mapboxgl.GeoJSONSource | undefined
    if (source) {
      source.setData(featureGeoJson)
    }
  }, [featureGeoJson, dbFeatures, mapLoaded])

  // Sync layer visibility
  useEffect(() => {
    if (!map.current || !mapLoaded) return
    const m = map.current
    for (const layer of LAYERS) {
      if (m.getLayer(layer.key)) {
        m.setLayoutProperty(layer.key, 'visibility', visibleLayers[layer.key] ? 'visible' : 'none')
      }
    }
  }, [visibleLayers, mapLoaded])

  // Update cursor in edit mode
  useEffect(() => {
    if (!map.current || !mapLoaded) return
    map.current.getCanvas().style.cursor = boxSelectActive ? 'crosshair' : editMode ? 'crosshair' : ''
  }, [editMode, boxSelectActive, mapLoaded])

  // Highlight selected layer during bulk shift (dim others)
  useEffect(() => {
    if (!map.current || !mapLoaded) return
    const m = map.current
    const highlighting = bulkShiftOpen && shiftLayer !== 'all'

    for (const layer of LAYERS) {
      if (!m.getLayer(layer.key)) continue
      if (layer.renderType === 'circle') {
        if (highlighting) {
          // Check if this layer's types have any features with the selected CAD layer
          const hasMatch = dbFeatures.some(
            f => layer.types.includes(f.feature_type) && f.layer === shiftLayer
          )
          m.setPaintProperty(layer.key, 'circle-opacity', hasMatch ? 0.95 : 0.15)
        } else {
          m.setPaintProperty(layer.key, 'circle-opacity', 0.85)
        }
      } else {
        if (highlighting) {
          const hasMatch = dbFeatures.some(
            f => layer.types.includes(f.feature_type) && f.layer === shiftLayer
          )
          m.setPaintProperty(layer.key, 'icon-opacity', hasMatch ? 1 : 0.15)
        } else {
          m.setPaintProperty(layer.key, 'icon-opacity', 1)
        }
      }
    }
  }, [bulkShiftOpen, shiftLayer, mapLoaded, dbFeatures])

  // Highlight selected features with a ring overlay
  useEffect(() => {
    if (!map.current || !mapLoaded) return
    const m = map.current

    const selectedGeoJson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: dbFeatures
        .filter(f => selectedIds.has(f.id))
        .map(f => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [f.longitude, f.latitude] },
          properties: { id: f.id },
        })),
    }

    const source = m.getSource('selection-highlight') as mapboxgl.GeoJSONSource | undefined
    if (source) {
      source.setData(selectedGeoJson)
    } else if (selectedIds.size > 0) {
      m.addSource('selection-highlight', { type: 'geojson', data: selectedGeoJson })
      m.addLayer({
        id: 'selection-highlight-ring',
        type: 'circle',
        source: 'selection-highlight',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 6, 14, 10, 16, 14, 18, 20],
          'circle-color': 'transparent',
          'circle-stroke-color': '#A855F7',
          'circle-stroke-width': 2.5,
        },
      })
    }
  }, [selectedIds, dbFeatures, mapLoaded])

  if (!mapboxReady) {
    return (
      <div className="page-container">
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 14 }}>
          Airfield Visual NAVAIDs
        </div>
        <div style={{
          padding: 40,
          textAlign: 'center',
          color: 'var(--color-text-3)',
          background: 'var(--color-bg-surface)',
          borderRadius: 12,
          border: '1px solid var(--color-border)',
        }}>
          Mapbox is not configured. Add NEXT_PUBLIC_MAPBOX_TOKEN to your environment.
        </div>
      </div>
    )
  }

  return (
    <div
      ref={pageRef}
      className={isFullscreen ? '' : 'page-container'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: isFullscreen ? '100vh' : 'calc(100vh - 60px)',
        ...(isFullscreen ? { position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--color-bg)', padding: 0 } : {}),
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: isFullscreen ? 0 : 10,
        padding: isFullscreen ? '8px 14px' : 0,
        flexShrink: 0,
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>Airfield Visual NAVAIDs</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>
            {totalFeatures.toLocaleString()} features
          </div>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {dbFeatures.length === 0 && (
              <button
                onClick={handleImport}
                disabled={importing}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid rgba(249, 115, 22, 0.3)',
                  background: 'rgba(249, 115, 22, 0.15)',
                  color: '#F97316',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 700,
                  cursor: importing ? 'wait' : 'pointer',
                  opacity: importing ? 0.6 : 1,
                }}
              >
                {importing ? 'Importing...' : 'Import Base Data'}
              </button>
            )}
            <button
              onClick={() => { setEditMode(prev => !prev); setBulkShiftOpen(false); setBoxSelectActive(false); setSelectedIds(new Set()); setBarPlacement(null) }}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: editMode ? '2px solid #10B981' : '1px solid var(--color-border)',
                background: editMode ? 'rgba(16, 185, 129, 0.15)' : 'var(--color-bg-surface)',
                color: editMode ? '#10B981' : 'var(--color-text-2)',
                fontSize: 'var(--fs-sm)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {editMode ? 'Exit Edit Mode' : 'Edit Mode'}
            </button>
          </div>
        )}
      </div>

      {/* System Health Panel */}
      {!editMode && (
        <div style={{ flexShrink: 0, marginBottom: isFullscreen ? 0 : 8 }}>
          <SystemHealthPanel healths={systemHealths} loading={healthLoading} />
        </div>
      )}

      {/* Map + Overlays */}
      <div style={{ flex: 1, position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

        {/* Loading overlay */}
        {!mapLoaded && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-bg-surface)',
            color: 'var(--color-text-3)',
            fontSize: 'var(--fs-lg)',
          }}>
            Loading map...
          </div>
        )}

        {/* Edit mode toolbar (placement only — drag Save/Cancel is on the marker popup) */}
        {editMode && !draggingId && (
          <div style={{
            position: 'absolute',
            bottom: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            background: 'rgba(15, 23, 42, 0.94)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 12,
            padding: '10px 14px',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            justifyContent: 'center',
            maxWidth: 'calc(100% - 28px)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#10B981', whiteSpace: 'nowrap' }}>
              EDIT MODE
            </div>

            <select
              value={placementType}
              onChange={e => setPlacementType(e.target.value as InfrastructureFeatureType)}
              style={{
                background: 'rgba(30, 41, 59, 0.9)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: 6,
                padding: '5px 8px',
                color: '#E2E8F0',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {FEATURE_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <button
              onClick={handleGpsCapture}
              disabled={gpsLoading || saving}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: '1px solid rgba(56, 189, 248, 0.3)',
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38BDF8',
                fontSize: 12,
                fontWeight: 600,
                cursor: gpsLoading ? 'wait' : 'pointer',
                opacity: gpsLoading ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {gpsLoading ? 'Getting GPS...' : 'Use My GPS'}
            </button>

            <div style={{ width: 1, height: 20, background: 'rgba(148,163,184,0.2)' }} />

            <button
              onClick={() => setBulkShiftOpen(prev => !prev)}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: bulkShiftOpen ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(148,163,184,0.2)',
                background: bulkShiftOpen ? 'rgba(168,85,247,0.2)' : 'transparent',
                color: bulkShiftOpen ? '#A855F7' : '#94A3B8',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Bulk Shift
            </button>

            <button
              onClick={() => {
                setBoxSelectActive(prev => {
                  if (prev) setSelectedIds(new Set())
                  return !prev
                })
              }}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: boxSelectActive ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(148,163,184,0.2)',
                background: boxSelectActive ? 'rgba(168,85,247,0.2)' : 'transparent',
                color: boxSelectActive ? '#A855F7' : '#94A3B8',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {boxSelectActive ? `Selected (${selectedIds.size})` : 'Box Select'}
            </button>

            <button
              onClick={() => {
                setFreeMoveActive(prev => {
                  if (prev) { cancelFreeMove(); return false }
                  return true
                })
              }}
              style={{
                padding: '5px 12px',
                borderRadius: 6,
                border: freeMoveActive ? '1px solid rgba(245,158,11,0.5)' : '1px solid rgba(148,163,184,0.2)',
                background: freeMoveActive ? 'rgba(245,158,11,0.2)' : 'transparent',
                color: freeMoveActive ? '#F59E0B' : '#94A3B8',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {freeMoveActive ? `Free Move (${pendingMoves.size})` : 'Free Move'}
            </button>

            <div style={{ width: 1, height: 20, background: 'rgba(148,163,184,0.2)' }} />

            {/* Bar placement buttons */}
            {(['threshold', 'pre_threshold', 'terminating', 'centerline', 'thousand_ft'] as BarType[]).map(bt => {
              const active = barPlacement?.type === bt
              return (
                <button
                  key={bt}
                  onClick={() => setBarPlacement(active ? null : { type: bt, rotation: barPlacement?.rotation ?? 0 })}
                  style={{
                    padding: '5px 8px',
                    borderRadius: 6,
                    border: active ? '1px solid rgba(251,191,36,0.5)' : '1px solid rgba(148,163,184,0.2)',
                    background: active ? 'rgba(251,191,36,0.2)' : 'transparent',
                    color: active ? '#FBBF24' : '#94A3B8',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {BAR_SPECS[bt].label}
                </button>
              )
            })}

            {/* Bar rotation input */}
            {barPlacement && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: '#FBBF24' }}>Rot:</span>
                <input
                  type="number"
                  min={0}
                  max={359}
                  value={barPlacement.rotation}
                  onChange={e => setBarPlacement({ ...barPlacement, rotation: parseInt(e.target.value) || 0 })}
                  style={{
                    width: 48,
                    padding: '3px 6px',
                    borderRadius: 4,
                    border: '1px solid rgba(251,191,36,0.3)',
                    background: 'rgba(30,41,59,0.9)',
                    color: '#FBBF24',
                    fontSize: 12,
                    textAlign: 'center',
                  }}
                />
                <span style={{ fontSize: 10, color: '#94A3B8' }}>°</span>
              </div>
            )}

            <div style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap' }}>
              {saving || shifting ? 'Saving...' : barPlacement ? `Tap map to place ${BAR_SPECS[barPlacement.type].label}` : freeMoveActive ? 'Tap features to grab' : 'Tap map to place'}
            </div>
          </div>
        )}

        {/* Free move save bar */}
        {editMode && freeMoveActive && pendingMoves.size > 0 && (
          <div style={{
            position: 'absolute',
            top: 10,
            right: 60,
            zIndex: 11,
            background: 'rgba(15, 23, 42, 0.96)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: 10,
            padding: '8px 14px',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B' }}>
              {pendingMoves.size} moved
            </div>
            <button
              onClick={saveAllFreeMoves}
              disabled={savingFreeMove}
              style={{
                padding: '5px 14px',
                borderRadius: 6,
                border: 'none',
                background: '#10B981',
                color: 'white',
                fontSize: 12,
                fontWeight: 600,
                cursor: savingFreeMove ? 'wait' : 'pointer',
                opacity: savingFreeMove ? 0.6 : 1,
              }}
            >
              {savingFreeMove ? 'Saving...' : 'Save All'}
            </button>
            <button
              onClick={cancelFreeMove}
              style={{
                padding: '5px 14px',
                borderRadius: 6,
                border: '1px solid rgba(148,163,184,0.3)',
                background: 'transparent',
                color: '#94A3B8',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Bulk shift panel */}
        {editMode && bulkShiftOpen && !draggingId && (
          <div style={{
            position: 'absolute',
            bottom: 70,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 11,
            background: 'rgba(15, 23, 42, 0.96)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            borderRadius: 12,
            padding: '14px 16px',
            backdropFilter: 'blur(8px)',
            minWidth: 260,
            maxWidth: 'calc(100% - 28px)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#A855F7', marginBottom: 10 }}>
              BULK SHIFT
            </div>

            {/* Layer selector */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Layer</div>
              <select
                value={shiftLayer}
                onChange={e => setShiftLayer(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(30, 41, 59, 0.9)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: 6,
                  padding: '6px 8px',
                  color: '#E2E8F0',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                <option value="all">All layers ({dbFeatures.length})</option>
                {uniqueLayers.map(([layer, count]) => (
                  <option key={layer} value={layer}>{layer} ({count})</option>
                ))}
              </select>
            </div>

            {/* Distance */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Distance (feet)</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 2, 5, 10, 20, 50].map(ft => (
                  <button
                    key={ft}
                    onClick={() => setShiftFeet(ft)}
                    style={{
                      flex: 1,
                      padding: '4px 0',
                      borderRadius: 5,
                      border: shiftFeet === ft ? '1px solid #A855F7' : '1px solid rgba(148,163,184,0.15)',
                      background: shiftFeet === ft ? 'rgba(168,85,247,0.2)' : 'transparent',
                      color: shiftFeet === ft ? '#C084FC' : '#94A3B8',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {ft}
                  </button>
                ))}
              </div>
            </div>

            {/* Direction pad */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gridTemplateRows: '1fr 1fr 1fr',
              gap: 4,
              width: 140,
              margin: '0 auto',
            }}>
              <div />
              <button onClick={() => handleBulkShift('N')} disabled={shifting} style={dirBtnStyle}>N</button>
              <div />
              <button onClick={() => handleBulkShift('W')} disabled={shifting} style={dirBtnStyle}>W</button>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: '#64748B',
              }}>
                {shiftFeet}ft
              </div>
              <button onClick={() => handleBulkShift('E')} disabled={shifting} style={dirBtnStyle}>E</button>
              <div />
              <button onClick={() => handleBulkShift('S')} disabled={shifting} style={dirBtnStyle}>S</button>
              <div />
            </div>

            {shifting && (
              <div style={{ textAlign: 'center', fontSize: 11, color: '#A855F7', marginTop: 8 }}>
                Shifting...
              </div>
            )}
          </div>
        )}

        {/* Selection action panel (box select) */}
        {editMode && boxSelectActive && selectedIds.size > 0 && !draggingId && (
          <div style={{
            position: 'absolute',
            bottom: 70,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 11,
            background: 'rgba(15, 23, 42, 0.96)',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            borderRadius: 12,
            padding: '14px 16px',
            backdropFilter: 'blur(8px)',
            minWidth: 280,
            maxWidth: 'calc(100% - 28px)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#A855F7' }}>
                {selectedIds.size} FEATURES SELECTED
              </div>
              <button
                onClick={() => setSelectedIds(new Set())}
                style={{
                  padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(148,163,184,0.2)',
                  background: 'transparent', color: '#94A3B8', fontSize: 11, cursor: 'pointer',
                }}
              >
                Clear
              </button>
            </div>

            {/* Shift controls */}
            <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Shift selected</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {[1, 2, 5, 10, 20, 50].map(ft => (
                <button
                  key={ft}
                  onClick={() => setShiftFeet(ft)}
                  style={{
                    flex: 1, padding: '4px 0', borderRadius: 5,
                    border: shiftFeet === ft ? '1px solid #A855F7' : '1px solid rgba(148,163,184,0.15)',
                    background: shiftFeet === ft ? 'rgba(168,85,247,0.2)' : 'transparent',
                    color: shiftFeet === ft ? '#C084FC' : '#94A3B8',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {ft}
                </button>
              ))}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gridTemplateRows: '1fr 1fr 1fr',
              gap: 4, width: 140, margin: '0 auto 12px',
            }}>
              <div />
              <button onClick={() => handleSelectionShift('N')} disabled={shifting} style={dirBtnStyle}>N</button>
              <div />
              <button onClick={() => handleSelectionShift('W')} disabled={shifting} style={dirBtnStyle}>W</button>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#64748B' }}>
                {shiftFeet}ft
              </div>
              <button onClick={() => handleSelectionShift('E')} disabled={shifting} style={dirBtnStyle}>E</button>
              <div />
              <button onClick={() => handleSelectionShift('S')} disabled={shifting} style={dirBtnStyle}>S</button>
              <div />
            </div>

            {/* Re-layer controls */}
            <div style={{ borderTop: '1px solid rgba(148,163,184,0.15)', paddingTop: 10 }}>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Re-layer selected</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  value={relayerName}
                  onChange={e => setRelayerName(e.target.value)}
                  placeholder="New layer name..."
                  style={{
                    flex: 1, padding: '6px 8px', borderRadius: 6,
                    border: '1px solid rgba(148,163,184,0.2)',
                    background: 'rgba(30, 41, 59, 0.9)', color: '#E2E8F0',
                    fontSize: 12, outline: 'none',
                  }}
                />
                <button
                  onClick={handleRelayer}
                  disabled={relayering || !relayerName.trim()}
                  style={{
                    padding: '6px 14px', borderRadius: 6,
                    border: '1px solid rgba(168,85,247,0.3)',
                    background: relayerName.trim() ? 'rgba(168,85,247,0.2)' : 'transparent',
                    color: relayerName.trim() ? '#C084FC' : '#64748B',
                    fontSize: 12, fontWeight: 600, cursor: relayerName.trim() ? 'pointer' : 'default',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {relayering ? 'Saving...' : 'Apply'}
                </button>
              </div>
              {/* Quick-pick from existing layers */}
              {uniqueLayers.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap', maxHeight: 100, overflowY: 'auto' }}>
                  {uniqueLayers.map(([layer]) => (
                    <button
                      key={layer}
                      onClick={() => setRelayerName(layer)}
                      style={{
                        padding: '2px 8px', borderRadius: 4,
                        border: '1px solid rgba(148,163,184,0.15)',
                        background: relayerName === layer ? 'rgba(168,85,247,0.15)' : 'transparent',
                        color: '#94A3B8', fontSize: 10, cursor: 'pointer',
                      }}
                    >
                      {layer}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Assign to component */}
            <div style={{ borderTop: '1px solid rgba(148,163,184,0.15)', paddingTop: 10, marginTop: 10 }}>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Assign to component</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <select
                  value={assignCompId}
                  onChange={e => setAssignCompId(e.target.value)}
                  style={{
                    flex: 1, padding: '6px 8px', borderRadius: 6,
                    border: '1px solid rgba(148,163,184,0.2)',
                    background: 'rgba(30, 41, 59, 0.9)', color: '#E2E8F0',
                    fontSize: 11, outline: 'none', fontFamily: 'inherit',
                  }}
                >
                  <option value="">— Unlink from component —</option>
                  {allComponentsList.map(c => (
                    <option key={c.id} value={c.id}>{c.system_name} — {c.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleAssignSelected}
                  disabled={assigningSelected}
                  style={{
                    padding: '6px 14px', borderRadius: 6,
                    border: '1px solid rgba(56,189,248,0.3)',
                    background: 'rgba(56,189,248,0.2)',
                    color: '#38BDF8',
                    fontSize: 12, fontWeight: 600, cursor: assigningSelected ? 'wait' : 'pointer',
                    whiteSpace: 'nowrap',
                    opacity: assigningSelected ? 0.6 : 1,
                  }}
                >
                  {assigningSelected ? 'Saving...' : 'Apply'}
                </button>
              </div>
            </div>

            {/* Re-type selected */}
            <div style={{ borderTop: '1px solid rgba(148,163,184,0.15)', paddingTop: 10, marginTop: 10 }}>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Re-type selected</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <select
                  value={retypeName}
                  onChange={e => setRetypeName(e.target.value)}
                  style={{
                    flex: 1, padding: '6px 8px', borderRadius: 6,
                    border: '1px solid rgba(148,163,184,0.2)',
                    background: 'rgba(30, 41, 59, 0.9)', color: '#E2E8F0',
                    fontSize: 11, outline: 'none', fontFamily: 'inherit',
                  }}
                >
                  <option value="">Select type...</option>
                  {FEATURE_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleRetype}
                  disabled={retyping || !retypeName}
                  style={{
                    padding: '6px 14px', borderRadius: 6,
                    border: '1px solid rgba(168,85,247,0.3)',
                    background: retypeName ? 'rgba(168,85,247,0.2)' : 'transparent',
                    color: retypeName ? '#C084FC' : '#64748B',
                    fontSize: 12, fontWeight: 600, cursor: retypeName ? 'pointer' : 'default',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {retyping ? 'Saving...' : 'Apply'}
                </button>
              </div>
            </div>

            {/* Delete selected */}
            <div style={{ borderTop: '1px solid rgba(148,163,184,0.15)', paddingTop: 10, marginTop: 10 }}>
              <button
                onClick={handleDeleteSelected}
                disabled={deletingSelected}
                style={{
                  width: '100%',
                  padding: '7px 0',
                  borderRadius: 6,
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#EF4444',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: deletingSelected ? 'wait' : 'pointer',
                  opacity: deletingSelected ? 0.6 : 1,
                }}
              >
                {deletingSelected ? 'Deleting...' : `Delete ${selectedIds.size} Selected`}
              </button>
            </div>

            {shifting && (
              <div style={{ textAlign: 'center', fontSize: 11, color: '#A855F7', marginTop: 8 }}>
                Shifting...
              </div>
            )}
          </div>
        )}

        {/* Top-left controls: Legend + Fullscreen */}
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, display: 'flex', gap: 6 }}>
          <button
            onClick={() => setLegendOpen(prev => !prev)}
            style={{
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: 8,
              padding: '6px 12px',
              color: '#E2E8F0',
              fontSize: 'var(--fs-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 14 }}>{legendOpen ? '◀' : '▶'}</span>
            Legend
          </button>
          <button
            onClick={() => setIsFullscreen(prev => !prev)}
            style={{
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: 8,
              padding: '6px 10px',
              color: '#E2E8F0',
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? '⊗' : '⛶'}
          </button>
          <button
            onClick={toggleLocationTracking}
            style={{
              background: trackingLocation ? 'rgba(59, 130, 246, 0.3)' : 'rgba(15, 23, 42, 0.9)',
              border: trackingLocation ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: 8,
              padding: '6px 10px',
              color: trackingLocation ? '#3B82F6' : '#E2E8F0',
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            title={trackingLocation ? 'Stop tracking' : 'Find my location'}
          >
            ◎
          </button>
        </div>

        {/* Legend panel */}
        {legendOpen && (
          <div style={{
            position: 'absolute',
            top: 44,
            left: 10,
            zIndex: 10,
            background: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: 10,
            padding: '10px 12px',
            minWidth: 200,
            backdropFilter: 'blur(8px)',
          }}>
            {LAYER_GROUPS.map(groupName => {
              const groupLayers = LAYERS.filter(l => l.group === groupName)
              const groupCount = groupLayers.reduce((sum, l) => sum + (featureCounts[l.key] || 0), 0)
              const expanded = expandedGroups[groupName]
              const allVisible = groupLayers.every(l => visibleLayers[l.key])
              const noneVisible = groupLayers.every(l => !visibleLayers[l.key])
              return (
                <div key={groupName}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 0',
                      cursor: 'pointer',
                      borderTop: groupName !== LAYER_GROUPS[0] ? '1px solid rgba(148,163,184,0.1)' : undefined,
                      marginTop: groupName !== LAYER_GROUPS[0] ? 4 : 0,
                      paddingTop: groupName !== LAYER_GROUPS[0] ? 6 : 5,
                    }}
                    onClick={() => setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }))}
                  >
                    <span style={{ fontSize: 9, color: '#64748B', width: 10, textAlign: 'center' }}>
                      {expanded ? '▼' : '▶'}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: noneVisible ? '#475569' : '#94A3B8',
                        flex: 1,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {groupName}
                    </span>
                    <span
                      style={{ fontSize: 10, color: '#64748B', cursor: 'pointer', padding: '0 2px' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        const newVal = !allVisible
                        setVisibleLayers(prev => {
                          const next = { ...prev }
                          groupLayers.forEach(l => { next[l.key] = newVal })
                          return next
                        })
                      }}
                      title={allVisible ? 'Hide all' : 'Show all'}
                    >
                      {groupCount}
                    </span>
                  </div>
                  {expanded && groupLayers.map(layer => (
                    <label
                      key={layer.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '3px 0 3px 16px',
                        cursor: 'pointer',
                        opacity: visibleLayers[layer.key] ? 1 : 0.4,
                        transition: 'opacity 0.15s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={visibleLayers[layer.key]}
                        onChange={() => toggleLayer(layer.key)}
                        style={{ display: 'none' }}
                      />
                      {layer.legendIcon === 'triangle' ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0 }}>
                          <polygon points="6,1 11,11 1,11" fill={layer.color} stroke="#FFF" strokeWidth="0.5" />
                        </svg>
                      ) : layer.legendIcon === 'split-circle' ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0 }}>
                          <path d="M6,1 A5,5 0 0,0 6,11 Z" fill={layer.legendBorder || '#FFF'} />
                          <path d="M6,1 A5,5 0 0,1 6,11 Z" fill={layer.legendInner || '#FFF'} />
                          <circle cx="6" cy="6" r="5" fill="none" stroke="#FFF" strokeWidth="0.5" />
                        </svg>
                      ) : layer.legendIcon === 'rect-arrow' ? (
                        <span style={{
                          width: 14, height: 10, borderRadius: 1,
                          background: layer.legendBorder || '#FBBF24', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{
                            width: 8, height: 5, background: layer.legendInner || '#000',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <span style={{ color: layer.legendBorder || '#FBBF24', fontSize: 7, lineHeight: 1, fontWeight: 900 }}>▶</span>
                          </span>
                        </span>
                      ) : layer.legendIcon === 'cone' ? (
                        <svg width="14" height="12" viewBox="0 0 14 12" style={{ flexShrink: 0 }}>
                          <polygon points="1,10 13,6 1,2" fill="#F97316" stroke="#FFF" strokeWidth="0.5" />
                          <line x1="4" y1="3.5" x2="4" y2="8.5" stroke="#FFF" strokeWidth="0.8" />
                          <line x1="7" y1="4.5" x2="7" y2="7.5" stroke="#FFF" strokeWidth="0.8" />
                        </svg>
                      ) : layer.legendIcon === 'dot-cluster' ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" style={{ flexShrink: 0 }}>
                          <circle cx="4" cy="4" r="2.5" fill={layer.color} stroke="#FFF" strokeWidth="0.4" />
                          <circle cx="8" cy="4" r="2.5" fill={layer.color} stroke="#FFF" strokeWidth="0.4" />
                          <circle cx="4" cy="8" r="2.5" fill={layer.color} stroke="#FFF" strokeWidth="0.4" />
                          <circle cx="8" cy="8" r="2.5" fill={layer.color} stroke="#FFF" strokeWidth="0.4" />
                        </svg>
                      ) : layer.legendIcon === 'rect' ? (
                        <span style={{
                          width: 14, height: 10, borderRadius: 1,
                          background: layer.legendBorder || layer.color, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{ width: 8, height: 5, background: layer.legendInner || '#000' }} />
                        </span>
                      ) : (
                        <span style={{
                          width: 12, height: 12, borderRadius: '50%',
                          background: layer.color, border: '1px solid rgba(0,0,0,0.3)', flexShrink: 0,
                        }} />
                      )}
                      <span style={{ color: '#E2E8F0', fontSize: 12, flex: 1 }}>{layer.label}</span>
                      <span style={{ color: '#64748B', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                        {featureCounts[layer.key]}
                      </span>
                    </label>
                  ))}
                </div>
              )
            })}
            {/* Systems section — from Base Config */}
            {(systemLegendGroups.systems.length > 0 || systemLegendGroups.unassignedCount > 0) && (
              <>
                <div style={{
                  borderTop: '1px solid rgba(148, 163, 184, 0.15)',
                  marginTop: 8,
                  paddingTop: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#94A3B8',
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  Systems
                </div>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {systemLegendGroups.systems.map(sys => {
                    const expanded = expandedLocGroups[`sys:${sys.id}`] === true
                    const allVisible = sys.components.every(c => visibleSourceLayers[`comp:${c.id}`] !== false)
                    return (
                      <div key={sys.id}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '4px 0',
                            cursor: 'pointer',
                          }}
                          onClick={() => setExpandedLocGroups(prev => ({ ...prev, [`sys:${sys.id}`]: !expanded }))}
                        >
                          <span style={{ fontSize: 8, color: '#64748B', width: 10, textAlign: 'center' }}>
                            {expanded ? '▼' : '▶'}
                          </span>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#94A3B8',
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {sys.name}
                          </span>
                          <span
                            style={{ fontSize: 9, color: '#64748B', cursor: 'pointer', padding: '0 2px' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              const newVal = !allVisible
                              setVisibleSourceLayers(prev => {
                                const next = { ...prev }
                                sys.components.forEach(c => { next[`comp:${c.id}`] = newVal })
                                return next
                              })
                            }}
                            title={allVisible ? 'Hide all' : 'Show all'}
                          >
                            {sys.totalCount}
                          </span>
                        </div>
                        {expanded && sys.components.map(comp => {
                          const isVisible = visibleSourceLayers[`comp:${comp.id}`] !== false
                          return (
                            <label
                              key={comp.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '2px 0 2px 16px',
                                cursor: 'pointer',
                                opacity: isVisible ? 1 : 0.4,
                                transition: 'opacity 0.15s',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isVisible}
                                onChange={() => setVisibleSourceLayers(prev => ({ ...prev, [`comp:${comp.id}`]: !isVisible }))}
                                style={{ display: 'none' }}
                              />
                              <span style={{
                                width: 8, height: 8, borderRadius: 2,
                                background: isVisible ? '#64748B' : 'transparent',
                                border: '1px solid #64748B', flexShrink: 0,
                              }} />
                              <span style={{ color: '#CBD5E1', fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {comp.label}
                              </span>
                              <span style={{ color: '#64748B', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>
                                {comp.count}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    )
                  })}
                  {/* Unassigned features grouped by layer */}
                  {systemLegendGroups.unassignedCount > 0 && (
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '4px 0',
                          cursor: 'pointer',
                        }}
                        onClick={() => setExpandedLocGroups(prev => ({ ...prev, '__unassigned': !prev['__unassigned'] }))}
                      >
                        <span style={{ fontSize: 8, color: '#64748B', width: 10, textAlign: 'center' }}>
                          {expandedLocGroups['__unassigned'] ? '▼' : '▶'}
                        </span>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#64748B',
                          flex: 1,
                          fontStyle: 'italic',
                        }}>
                          Unassigned
                        </span>
                        <span
                          style={{ fontSize: 9, color: '#64748B', cursor: 'pointer', padding: '0 2px' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            const allVisible = systemLegendGroups.unassignedLayers.every(([n]) => visibleSourceLayers[`layer:${n}`] !== false)
                            const newVal = !allVisible
                            setVisibleSourceLayers(prev => {
                              const next = { ...prev }
                              systemLegendGroups.unassignedLayers.forEach(([n]) => { next[`layer:${n}`] = newVal })
                              return next
                            })
                          }}
                          title="Toggle unassigned"
                        >
                          {systemLegendGroups.unassignedCount}
                        </span>
                      </div>
                      {expandedLocGroups['__unassigned'] && systemLegendGroups.unassignedLayers.map(([layerName, count]) => {
                        const isVisible = visibleSourceLayers[`layer:${layerName}`] !== false
                        return (
                          <label
                            key={layerName}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '2px 0 2px 16px',
                              cursor: 'pointer',
                              opacity: isVisible ? 1 : 0.4,
                              transition: 'opacity 0.15s',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isVisible}
                              onChange={() => setVisibleSourceLayers(prev => ({ ...prev, [`layer:${layerName}`]: !isVisible }))}
                              style={{ display: 'none' }}
                            />
                            <span style={{
                              width: 8, height: 8, borderRadius: 2,
                              background: isVisible ? '#64748B' : 'transparent',
                              border: '1px solid #64748B', flexShrink: 0,
                            }} />
                            <span style={{ color: '#CBD5E1', fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {layerName}
                            </span>
                            <span style={{ color: '#64748B', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>
                              {count}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            <div style={{
              borderTop: '1px solid rgba(148, 163, 184, 0.15)',
              marginTop: 8,
              paddingTop: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 11,
              color: '#94A3B8',
            }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => {
                    setVisibleLayers(Object.fromEntries(LAYERS.map(l => [l.key, true])))
                    setVisibleSourceLayers({})
                  }}
                  style={{
                    background: 'none', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 4,
                    color: '#94A3B8', fontSize: 10, padding: '2px 6px', cursor: 'pointer',
                  }}
                >
                  Show All
                </button>
                <button
                  onClick={() => {
                    setVisibleLayers(Object.fromEntries(LAYERS.map(l => [l.key, false])))
                    const allOff: Record<string, boolean> = {}
                    systemLegendGroups.systems.forEach(sys => {
                      sys.components.forEach(c => { allOff[`comp:${c.id}`] = false })
                    })
                    systemLegendGroups.unassignedLayers.forEach(([n]) => { allOff[`layer:${n}`] = false })
                    setVisibleSourceLayers(allOff)
                  }}
                  style={{
                    background: 'none', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 4,
                    color: '#94A3B8', fontSize: 10, padding: '2px 6px', cursor: 'pointer',
                  }}
                >
                  Hide All
                </button>
              </div>
              <span style={{ fontWeight: 700 }}>{totalFeatures.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Popup styles */}
      <style>{`
        .infrastructure-map-popup .mapboxgl-popup-content {
          background: rgba(15, 23, 42, 0.95) !important;
          border: 1px solid rgba(148, 163, 184, 0.2) !important;
          border-radius: 8px !important;
          padding: 10px 12px !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
        }
        .infrastructure-map-popup .mapboxgl-popup-close-button {
          color: #94A3B8 !important;
          font-size: 16px !important;
          right: 4px !important;
          top: 4px !important;
        }
        .infrastructure-map-popup .mapboxgl-popup-tip {
          border-top-color: rgba(15, 23, 42, 0.95) !important;
        }
      `}</style>
    </div>
  )
}
