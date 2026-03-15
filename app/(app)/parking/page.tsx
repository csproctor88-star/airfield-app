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
  type ParkingPlan,
  type ParkingSpot,
  type ParkingObstacle,
} from '@/lib/supabase/parking'
import {
  getADGFromWingspan,
  getDefaultClearance,
  findAllViolations,
  getAllClearanceResults,
  generateClearanceZonePolygon,
  getWingtipPositions,
  type ADGGroup,
  type SpotWithAircraft,
  type ClearanceResult,
} from '@/lib/calculations/parking-clearance'
import { offsetPoint } from '@/lib/calculations/geometry'

// ── Silhouette manifest lookup ──

const manifest = silhouetteManifest as Record<string, { base_name: string; path: string; filename: string }>

function findSilhouettePath(aircraftName: string): string | null {
  // Try exact match first, then strip variant suffixes
  const normalize = (s: string) => s.replace(/[-\s]/g, '').toLowerCase()
  const norm = normalize(aircraftName)

  for (const [key, entry] of Object.entries(manifest)) {
    if (normalize(key) === norm || normalize(entry.base_name) === norm) {
      return entry.path
    }
  }

  // Try matching by stripping suffix (e.g., "C-17A Globemaster III" → "C-17")
  const parts = aircraftName.split(/[\s-]/)
  for (let len = parts.length; len >= 1; len--) {
    const prefix = normalize(parts.slice(0, len).join(''))
    for (const [key, entry] of Object.entries(manifest)) {
      if (normalize(key) === prefix || normalize(entry.base_name) === prefix) {
        return entry.path
      }
    }
  }

  // Try matching just the base designation (e.g., "C17" from "C-17A Globemaster III")
  const baseDesig = aircraftName.replace(/[^A-Za-z0-9]/g, '').replace(/[A-Z][a-z]+.*$/, '')
  for (const [key] of Object.entries(manifest)) {
    if (normalize(key) === normalize(baseDesig)) {
      return manifest[key].path
    }
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

// ── Main Page ──

export default function ParkingPage() {
  const { installationId, currentInstallation, runways, userRole } = useInstallation()
  const canWrite = userRole && ['admin', 'airfield_manager', 'operator', 'inspector'].includes(userRole)

  // ── State ──
  const [plans, setPlans] = useState<ParkingPlan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [spots, setSpots] = useState<ParkingSpot[]>([])
  const [obstacles, setObstacles] = useState<ParkingObstacle[]>([])
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
  const [panelTab, setPanelTab] = useState<'aircraft' | 'obstacles' | 'clearance'>('aircraft')

  // Map refs
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const dragSpotId = useRef<string | null>(null)
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

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
      }
    })
  }, [spots])

  const allResults: ClearanceResult[] = useMemo(
    () => getAllClearanceResults(spotsWithAircraft, obstacles),
    [spotsWithAircraft, obstacles]
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

  const loadPlans = useCallback(async () => {
    if (!installationId) return
    const data = await fetchParkingPlans(installationId)
    setPlans(data)
    if (data.length > 0 && !selectedPlanId) {
      const active = data.find(p => p.is_active)
      setSelectedPlanId(active?.id || data[0].id)
    }
  }, [installationId, selectedPlanId])

  const loadSpots = useCallback(async () => {
    if (!selectedPlanId) { setSpots([]); return }
    const data = await fetchParkingSpots(selectedPlanId)
    setSpots(data)
  }, [selectedPlanId])

  const loadObstacles = useCallback(async () => {
    if (!installationId) { setObstacles([]); return }
    const data = await fetchParkingObstacles(installationId)
    setObstacles(data)
  }, [installationId])

  useEffect(() => {
    setLoading(true)
    loadPlans().finally(() => setLoading(false))
  }, [loadPlans])

  useEffect(() => { loadSpots() }, [loadSpots])
  useEffect(() => { loadObstacles() }, [loadObstacles])

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
      const { lng, lat } = e.lngLat

      if (placingAircraft && selectedPlanId && installationId) {
        const ws = parseNum(placingAircraft.wing_span_ft)
        const adg = getADGFromWingspan(ws)
        const clearance = getDefaultClearance(adg)

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
          toast.success(`Placed ${placingAircraft.aircraft}`)
        } else {
          toast.error('Failed to place aircraft')
        }
        setPlacingAircraft(null)
        return
      }

      if (placingObstacle && installationId) {
        const obs = await createParkingObstacle({
          base_id: installationId,
          obstacle_type: placingObstacle,
          longitude: lng,
          latitude: lat,
          name: `Obstacle ${obstacles.length + 1}`,
          width_ft: placingObstacle === 'building' ? 100 : undefined,
          length_ft: placingObstacle === 'building' ? 200 : undefined,
          radius_ft: placingObstacle === 'circle' ? 50 : undefined,
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
  }, [mapLoaded, placingAircraft, placingObstacle, selectedPlanId, installationId, obstacles.length])

  // ── Render aircraft on map ──

  useEffect(() => {
    const m = map.current
    if (!m || !mapLoaded) return

    // Clean up old sources/layers
    const cleanIds = ['parking-clearance-fill', 'parking-clearance-line', 'parking-obstacles-fill', 'parking-obstacles-line', 'parking-aircraft-circles', 'parking-aircraft-labels']
    for (const id of cleanIds) {
      if (m.getLayer(id)) m.removeLayer(id)
    }
    if (m.getSource('parking-clearance')) m.removeSource('parking-clearance')
    if (m.getSource('parking-obstacles-src')) m.removeSource('parking-obstacles-src')
    if (m.getSource('parking-aircraft')) m.removeSource('parking-aircraft')

    // Build clearance zone GeoJSON
    const clearanceFeatures: GeoJSON.Feature[] = []
    for (const spot of spotsWithAircraft) {
      const adg = getADGFromWingspan(spot.wingspan_ft)
      const clearanceFt = spot.clearance_ft ?? getDefaultClearance(adg)
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

    if (showClearances && clearanceFeatures.length > 0) {
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
          properties: { name: obs.name, type: obs.obstacle_type },
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
          properties: { name: obs.name, type: obs.obstacle_type },
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
          properties: { name: obs.name, type: obs.obstacle_type },
          geometry: { type: 'Polygon', coordinates: [coords] },
        })
      } else if (obs.obstacle_type === 'line' && obs.line_coords) {
        obstacleFeatures.push({
          type: 'Feature',
          properties: { name: obs.name, type: obs.obstacle_type },
          geometry: { type: 'LineString', coordinates: obs.line_coords },
        })
      }
    }

    if (obstacleFeatures.length > 0) {
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
        paint: {
          'line-color': '#F97316',
          'line-width': 2,
        },
      })
    }

    // Build aircraft GeoJSON (circles for now, silhouettes later)
    const aircraftFeatures: GeoJSON.Feature[] = spotsWithAircraft.map(s => ({
      type: 'Feature',
      properties: {
        spotId: s.id,
        name: s.aircraft_name || 'Aircraft',
        wingspan: s.wingspan_ft,
        heading: s.heading_deg,
        tailNumber: s.tail_number || '',
        adg: getADGFromWingspan(s.wingspan_ft),
      },
      geometry: { type: 'Point', coordinates: [s.longitude, s.latitude] },
    }))

    if (aircraftFeatures.length > 0) {
      m.addSource('parking-aircraft', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: aircraftFeatures },
      })

      m.addLayer({
        id: 'parking-aircraft-circles',
        type: 'circle',
        source: 'parking-aircraft',
        paint: {
          'circle-radius': 8,
          'circle-color': '#38BDF8',
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2,
        },
      })

      m.addLayer({
        id: 'parking-aircraft-labels',
        type: 'symbol',
        source: 'parking-aircraft',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, 1.5],
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
  }, [mapLoaded, spotsWithAircraft, obstacles, allResults, showClearances])

  // ── Aircraft drag interaction ──

  useEffect(() => {
    const m = map.current
    if (!m || !mapLoaded) return

    let isDragging = false

    const onMouseDown = (e: mapboxgl.MapMouseEvent) => {
      const features = m.queryRenderedFeatures(e.point, { layers: ['parking-aircraft-circles'] })
      if (!features.length) return

      const spotId = features[0].properties?.spotId
      if (!spotId) return

      isDragging = true
      dragSpotId.current = spotId
      m.getCanvas().style.cursor = 'grabbing'
      m.dragPan.disable()

      e.preventDefault()
    }

    const onMouseMove = (e: mapboxgl.MapMouseEvent) => {
      if (!isDragging || !dragSpotId.current) return

      const { lng, lat } = e.lngLat
      setSpots(prev =>
        prev.map(s =>
          s.id === dragSpotId.current ? { ...s, longitude: lng, latitude: lat } : s
        )
      )
    }

    const onMouseUp = async () => {
      if (!isDragging || !dragSpotId.current) return

      isDragging = false
      m.dragPan.enable()
      m.getCanvas().style.cursor = ''

      const spot = spots.find(s => s.id === dragSpotId.current)
      if (spot) {
        await updateParkingSpot(spot.id, {
          longitude: spot.longitude,
          latitude: spot.latitude,
        })
      }
      dragSpotId.current = null
    }

    m.on('mousedown', 'parking-aircraft-circles', onMouseDown as any)
    m.on('mousemove', onMouseMove as any)
    m.on('mouseup', onMouseUp)
    m.on('mouseleave', onMouseUp)

    // Hover cursor
    m.on('mouseenter', 'parking-aircraft-circles', () => {
      if (!isDragging) m.getCanvas().style.cursor = 'grab'
    })
    m.on('mouseleave', 'parking-aircraft-circles', () => {
      if (!isDragging) m.getCanvas().style.cursor = ''
    })

    return () => {
      m.off('mousedown', 'parking-aircraft-circles', onMouseDown as any)
      m.off('mousemove', onMouseMove as any)
      m.off('mouseup', onMouseUp)
    }
  }, [mapLoaded, spots])

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
    if (!aircraftSearch.trim()) return allAircraft.slice(0, 50)
    const q = aircraftSearch.toLowerCase()
    return allAircraft.filter(a =>
      a.aircraft.toLowerCase().includes(q) ||
      (a.manufacturer && a.manufacturer.toLowerCase().includes(q)) ||
      (a.category && a.category.toLowerCase().includes(q))
    ).slice(0, 50)
  }, [aircraftSearch])

  // ── Render ──

  if (!isMapboxConfigured()) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        <h2 style={{ color: 'var(--color-text-primary)', marginBottom: 8 }}>Aircraft Parking</h2>
        <p>Mapbox token not configured. Add NEXT_PUBLIC_MAPBOX_TOKEN to your environment.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--color-bg)' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg-surface)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontSize: 'var(--fs-lg)', fontWeight: 600, margin: 0, color: 'var(--color-text-primary)' }}>
            Aircraft Parking
          </h1>
          {selectedPlan && (
            <span style={{
              fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 4,
              background: selectedPlan.is_active ? '#22C55E22' : 'var(--color-bg)',
              color: selectedPlan.is_active ? '#22C55E' : 'var(--color-text-secondary)',
              border: `1px solid ${selectedPlan.is_active ? '#22C55E44' : 'var(--color-border)'}`,
            }}>
              {selectedPlan.is_active ? 'Active' : 'Draft'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Plan selector */}
          <select
            value={selectedPlanId || ''}
            onChange={e => setSelectedPlanId(e.target.value || null)}
            style={{
              padding: '4px 8px', borderRadius: 4, fontSize: 'var(--fs-sm)',
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
              padding: '4px 12px', borderRadius: 4, fontSize: 'var(--fs-sm)',
              background: 'var(--color-cyan)', color: '#000', border: 'none',
              cursor: 'pointer', fontWeight: 500,
            }}
          >
            + New Plan
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '4px 16px', borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg-surface)', fontSize: 'var(--fs-sm)', flexShrink: 0,
      }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>
          {spots.length} Aircraft
        </span>
        <span style={{ color: violations.length > 0 ? '#EF4444' : 'var(--color-text-secondary)' }}>
          {violations.length} Violation{violations.length !== 1 ? 's' : ''}
        </span>
        <span style={{ color: warnings.length > 0 ? '#F59E0B' : 'var(--color-text-secondary)' }}>
          {warnings.length} Warning{warnings.length !== 1 ? 's' : ''}
        </span>
        <div style={{ flex: 1 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showClearances} onChange={e => setShowClearances(e.target.checked)} />
          Show Clearances
        </label>
      </div>

      {/* Placement mode indicator */}
      {(placingAircraft || placingObstacle) && (
        <div style={{
          padding: '6px 16px', background: '#F59E0B22', borderBottom: '1px solid #F59E0B44',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 'var(--fs-sm)', color: '#F59E0B', flexShrink: 0,
        }}>
          <span>
            Click on the map to place {placingAircraft ? placingAircraft.aircraft : `${placingObstacle} obstacle`}
          </span>
          <button
            onClick={() => { setPlacingAircraft(null); setPlacingObstacle(null) }}
            style={{ background: 'none', border: 'none', color: '#F59E0B', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Main content: side panel + map */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Side panel */}
        <div style={{
          width: 300, flexShrink: 0, borderRight: '1px solid var(--color-border)',
          background: 'var(--color-bg-surface)', overflow: 'auto',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Panel tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)' }}>
            {(['aircraft', 'obstacles', 'clearance'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setPanelTab(tab)}
                style={{
                  flex: 1, padding: '8px 4px', border: 'none', cursor: 'pointer',
                  fontSize: 'var(--fs-xs)', textTransform: 'capitalize',
                  background: panelTab === tab ? 'var(--color-bg)' : 'transparent',
                  color: panelTab === tab ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  borderBottom: panelTab === tab ? '2px solid var(--color-cyan)' : '2px solid transparent',
                }}
              >
                {tab}
                {tab === 'clearance' && (violations.length + warnings.length > 0) && (
                  <span style={{
                    marginLeft: 4, fontSize: 10, padding: '0 4px', borderRadius: 8,
                    background: violations.length > 0 ? '#EF444422' : '#F59E0B22',
                    color: violations.length > 0 ? '#EF4444' : '#F59E0B',
                  }}>
                    {violations.length + warnings.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
            {/* Aircraft tab */}
            {panelTab === 'aircraft' && (
              <>
                {canWrite && selectedPlanId && (
                  <button
                    onClick={() => setShowAircraftPicker(true)}
                    style={{
                      width: '100%', padding: '8px 12px', marginBottom: 8, borderRadius: 4,
                      background: 'var(--color-cyan)11', border: '1px dashed var(--color-cyan)',
                      color: 'var(--color-cyan)', cursor: 'pointer', fontSize: 'var(--fs-sm)',
                    }}
                  >
                    + Add Aircraft
                  </button>
                )}

                {!selectedPlanId && (
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-sm)', textAlign: 'center', padding: 16 }}>
                    Select or create a plan to add aircraft
                  </p>
                )}

                {spots.map(s => {
                  const ac = allAircraft.find(a => a.aircraft === s.aircraft_name)
                  const ws = ac ? parseNum(ac.wing_span_ft) : 50
                  const adg = getADGFromWingspan(ws)
                  const clearance = s.clearance_ft ?? getDefaultClearance(adg)
                  const spotViolations = allResults.filter(r =>
                    (r.spot_a_id === s.id || r.spot_b_id === s.id) && r.status !== 'ok'
                  )

                  return (
                    <div
                      key={s.id}
                      onClick={() => setEditingSpot(editingSpot?.id === s.id ? null : s)}
                      style={{
                        padding: '8px 10px', marginBottom: 4, borderRadius: 4, cursor: 'pointer',
                        background: editingSpot?.id === s.id ? 'var(--color-bg)' : 'transparent',
                        border: `1px solid ${spotViolations.length > 0 ? '#EF444444' : 'var(--color-border)'}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 10, padding: '1px 4px', borderRadius: 3,
                          background: `${ADG_COLORS[adg]}22`, color: ADG_COLORS[adg],
                          fontWeight: 600,
                        }}>
                          {adg}
                        </span>
                        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--color-text-primary)', flex: 1 }}>
                          {s.aircraft_name || 'Unknown'}
                        </span>
                        {spotViolations.length > 0 && (
                          <span style={{ color: '#EF4444', fontSize: 12 }}>!</span>
                        )}
                      </div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                        {s.spot_name || s.spot_type || 'Unassigned'} &middot; {clearance}ft clearance
                        {s.tail_number && <> &middot; {s.tail_number}</>}
                      </div>

                      {/* Expanded edit form */}
                      {editingSpot?.id === s.id && (
                        <div
                          onClick={e => e.stopPropagation()}
                          style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}
                        >
                          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                            Spot Name
                            <input
                              value={s.spot_name || ''}
                              onChange={e => handleUpdateSpot(s.id, { spot_name: e.target.value })}
                              style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }}
                            />
                          </label>
                          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                            Tail Number
                            <input
                              value={s.tail_number || ''}
                              onChange={e => handleUpdateSpot(s.id, { tail_number: e.target.value })}
                              style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }}
                            />
                          </label>
                          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                            Callsign
                            <input
                              value={s.unit_callsign || ''}
                              onChange={e => handleUpdateSpot(s.id, { unit_callsign: e.target.value })}
                              style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }}
                            />
                          </label>
                          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                            Heading ({s.heading_deg}°)
                            <input
                              type="range" min={0} max={360} step={5}
                              value={s.heading_deg}
                              onChange={e => handleUpdateSpot(s.id, { heading_deg: Number(e.target.value) })}
                              style={{ width: '100%' }}
                            />
                          </label>
                          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                            Clearance Override (ft)
                            <div style={{ display: 'flex', gap: 4 }}>
                              {[null, 10, 15, 25].map(val => (
                                <button
                                  key={val ?? 'adg'}
                                  onClick={() => handleUpdateSpot(s.id, { clearance_ft: val as any })}
                                  style={{
                                    flex: 1, padding: '3px 4px', borderRadius: 3, fontSize: 'var(--fs-xs)',
                                    border: '1px solid var(--color-border)',
                                    background: s.clearance_ft === val ? 'var(--color-cyan)22' : 'var(--color-bg)',
                                    color: s.clearance_ft === val ? 'var(--color-cyan)' : 'var(--color-text-secondary)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {val ? `${val}ft` : `ADG (${getDefaultClearance(adg)}ft)`}
                                </button>
                              ))}
                            </div>
                          </label>
                          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                            Status
                            <select
                              value={s.status}
                              onChange={e => handleUpdateSpot(s.id, { status: e.target.value as ParkingSpot['status'] })}
                              style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }}
                            >
                              <option value="available">Available</option>
                              <option value="occupied">Occupied</option>
                              <option value="reserved">Reserved</option>
                            </select>
                          </label>
                          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                            <button
                              onClick={() => {
                                map.current?.flyTo({ center: [s.longitude, s.latitude], zoom: 17 })
                              }}
                              style={{ flex: 1, padding: '4px 8px', borderRadius: 3, background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}
                            >
                              Fly To
                            </button>
                            <button
                              onClick={() => handleDeleteSpot(s.id)}
                              style={{ padding: '4px 8px', borderRadius: 3, background: '#EF444422', border: '1px solid #EF444444', color: '#EF4444', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {spots.length === 0 && selectedPlanId && (
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-xs)', textAlign: 'center', padding: 16 }}>
                    No aircraft placed yet. Click &quot;+ Add Aircraft&quot; to get started.
                  </p>
                )}
              </>
            )}

            {/* Obstacles tab */}
            {panelTab === 'obstacles' && (
              <>
                {canWrite && (
                  <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                    {(['point', 'building', 'line', 'circle'] as const).map(type => (
                      <button
                        key={type}
                        onClick={() => { setPlacingObstacle(type); setPlacingAircraft(null) }}
                        style={{
                          flex: 1, padding: '6px 4px', borderRadius: 4, fontSize: 'var(--fs-xs)',
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
                )}

                {obstacles.map(obs => (
                  <div
                    key={obs.id}
                    onClick={() => setEditingObstacle(editingObstacle?.id === obs.id ? null : obs)}
                    style={{
                      padding: '8px 10px', marginBottom: 4, borderRadius: 4, cursor: 'pointer',
                      background: editingObstacle?.id === obs.id ? 'var(--color-bg)' : 'transparent',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontSize: 10, padding: '1px 4px', borderRadius: 3,
                        background: '#F9731622', color: '#F97316',
                        textTransform: 'capitalize',
                      }}>
                        {obs.obstacle_type}
                      </span>
                      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-primary)', flex: 1 }}>
                        {obs.name || 'Unnamed'}
                      </span>
                    </div>

                    {editingObstacle?.id === obs.id && (
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}
                      >
                        <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                          Name
                          <input
                            value={obs.name || ''}
                            onChange={e => handleUpdateObstacle(obs.id, { name: e.target.value })}
                            style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }}
                          />
                        </label>
                        {obs.obstacle_type === 'building' && (
                          <>
                            <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                              Width (ft)
                              <input
                                type="number" value={obs.width_ft || 0}
                                onChange={e => handleUpdateObstacle(obs.id, { width_ft: Number(e.target.value) })}
                                style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }}
                              />
                            </label>
                            <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                              Length (ft)
                              <input
                                type="number" value={obs.length_ft || 0}
                                onChange={e => handleUpdateObstacle(obs.id, { length_ft: Number(e.target.value) })}
                                style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }}
                              />
                            </label>
                            <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                              Rotation ({obs.rotation_deg || 0}°)
                              <input
                                type="range" min={0} max={360} step={5}
                                value={obs.rotation_deg || 0}
                                onChange={e => handleUpdateObstacle(obs.id, { rotation_deg: Number(e.target.value) })}
                                style={{ width: '100%' }}
                              />
                            </label>
                          </>
                        )}
                        {obs.obstacle_type === 'circle' && (
                          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                            Radius (ft)
                            <input
                              type="number" value={obs.radius_ft || 0}
                              onChange={e => handleUpdateObstacle(obs.id, { radius_ft: Number(e.target.value) })}
                              style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }}
                            />
                          </label>
                        )}
                        {obs.obstacle_type === 'point' && (
                          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)' }}>
                            Height (ft)
                            <input
                              type="number" value={obs.height_ft || 0}
                              onChange={e => handleUpdateObstacle(obs.id, { height_ft: Number(e.target.value) })}
                              style={{ width: '100%', padding: '3px 6px', borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-primary)', fontSize: 'var(--fs-xs)' }}
                            />
                          </label>
                        )}
                        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                          <button
                            onClick={() => map.current?.flyTo({ center: [obs.longitude, obs.latitude], zoom: 17 })}
                            style={{ flex: 1, padding: '4px 8px', borderRadius: 3, background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}
                          >
                            Fly To
                          </button>
                          <button
                            onClick={() => handleDeleteObstacle(obs.id)}
                            style={{ padding: '4px 8px', borderRadius: 3, background: '#EF444422', border: '1px solid #EF444444', color: '#EF4444', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {obstacles.length === 0 && (
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-xs)', textAlign: 'center', padding: 16 }}>
                    No obstacles defined. Obstacles are shared across all plans for this installation.
                  </p>
                )}
              </>
            )}

            {/* Clearance tab */}
            {panelTab === 'clearance' && (
              <>
                {allResults.length === 0 && (
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-xs)', textAlign: 'center', padding: 16 }}>
                    Place at least 2 aircraft or 1 aircraft + 1 obstacle to see clearance checks.
                  </p>
                )}

                {allResults.map((r, i) => (
                  <div
                    key={i}
                    onClick={() => flyToResult(r)}
                    style={{
                      padding: '8px 10px', marginBottom: 4, borderRadius: 4, cursor: 'pointer',
                      border: `1px solid ${STATUS_COLORS[r.status]}44`,
                      background: `${STATUS_COLORS[r.status]}11`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: STATUS_COLORS[r.status],
                        flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-primary)', flex: 1 }}>
                        {r.aircraft_a} / {r.aircraft_b}
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', marginTop: 2, marginLeft: 14 }}>
                      {r.distance_ft.toFixed(1)}ft actual &middot; {r.required_ft}ft required
                      {r.status === 'violation' && <span style={{ color: '#EF4444', marginLeft: 4 }}>VIOLATION</span>}
                      {r.status === 'warning' && <span style={{ color: '#F59E0B', marginLeft: 4 }}>WARNING</span>}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Plan info/actions at bottom */}
          {selectedPlan && (
            <div style={{
              padding: 8, borderTop: '1px solid var(--color-border)',
              display: 'flex', gap: 4, flexShrink: 0,
            }}>
              {!selectedPlan.is_active && canWrite && (
                <button
                  onClick={handleSetActive}
                  style={{ flex: 1, padding: '6px 8px', borderRadius: 4, background: '#22C55E22', border: '1px solid #22C55E44', color: '#22C55E', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}
                >
                  Set Active
                </button>
              )}
              {canWrite && (
                <button
                  onClick={handleDeletePlan}
                  style={{ padding: '6px 8px', borderRadius: 4, background: '#EF444422', border: '1px solid #EF444444', color: '#EF4444', cursor: 'pointer', fontSize: 'var(--fs-xs)' }}
                >
                  Delete Plan
                </button>
              )}
            </div>
          )}
        </div>

        {/* Map */}
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
