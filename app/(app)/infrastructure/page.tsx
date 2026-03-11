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
  type InfrastructureFeatureType,
} from '@/lib/supabase/infrastructure-features'
import type { InfrastructureFeature } from '@/lib/supabase/types'

// ── Layer configuration ──

type LayerConfig = {
  key: string
  label: string
  color: string
  types: string[]
  renderType: 'circle' | 'symbol'
  legendIcon?: 'circle' | 'rect' | 'rect-arrow' | 'split-circle' | 'triangle'
  legendBorder?: string
  legendInner?: string
}

const LAYERS: LayerConfig[] = [
  { key: 'runway_edge_lights',  label: 'Runway Edge Lights',  color: '#FFFFFF',  types: ['runway_edge_light'],   renderType: 'circle', legendIcon: 'circle' },
  { key: 'taxiway_lights',      label: 'Taxiway Lights',      color: '#2563EB',  types: ['taxiway_light'],       renderType: 'circle', legendIcon: 'circle' },
  { key: 'taxiway_end_lights',  label: 'Taxiway End Lights',  color: '#F59E0B',  types: ['taxiway_end_light'],   renderType: 'circle', legendIcon: 'circle' },
  { key: 'approach_lights',     label: 'Approach Lights',     color: '#FBBF24',  types: ['approach_light'],      renderType: 'symbol', legendIcon: 'split-circle', legendBorder: '#FFFFFF', legendInner: '#FBBF24' },
  { key: 'runway_thresholds',   label: 'Runway Thresholds',   color: '#22C55E',  types: ['runway_threshold'],    renderType: 'symbol', legendIcon: 'split-circle', legendBorder: '#EF4444', legendInner: '#22C55E' },
  { key: 'location_signs',      label: 'Location Signs',      color: '#FBBF24',  types: ['location_sign'],       renderType: 'symbol', legendIcon: 'rect', legendBorder: '#000000', legendInner: '#FBBF24' },
  { key: 'directional_signs',   label: 'Directional Signs',   color: '#FBBF24',  types: ['directional_sign'],    renderType: 'symbol', legendIcon: 'rect-arrow', legendBorder: '#FBBF24', legendInner: '#000000' },
  { key: 'informational_signs', label: 'Informational Signs', color: '#FBBF24',  types: ['informational_sign'],  renderType: 'symbol', legendIcon: 'rect', legendBorder: '#FBBF24', legendInner: '#000000' },
  { key: 'mandatory_signs',     label: 'Mandatory Signs',     color: '#EF4444',  types: ['mandatory_sign'],      renderType: 'symbol', legendIcon: 'rect', legendBorder: '#EF4444', legendInner: '#FFFFFF' },
  { key: 'obstruction_lights',  label: 'Obstruction Lights',  color: '#EF4444',  types: ['obstruction_light'],   renderType: 'symbol', legendIcon: 'triangle' },
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

function addMapIcons(m: mapboxgl.Map) {
  const s = 24, pr = { pixelRatio: 1 }
  m.addImage('icon-location-sign', createSignIcon('#000000', '#FBBF24', s), pr)
  m.addImage('icon-directional-sign', createDirectionalSignIcon(s), pr)
  m.addImage('icon-informational-sign', createSignIcon('#FBBF24', '#000000', s), pr)
  m.addImage('icon-mandatory-sign', createSignIcon('#EF4444', '#FFFFFF', s), pr)
  m.addImage('icon-approach-light', createSplitCircleIcon('#FFFFFF', '#FBBF24', s), pr)
  m.addImage('icon-runway-threshold', createSplitCircleIcon('#EF4444', '#22C55E', s), pr)
  m.addImage('icon-obstruction-light', createTriangleIcon('#EF4444', s), pr)
}

const ICON_MAP: Record<string, string> = {
  approach_light: 'icon-approach-light',
  runway_threshold: 'icon-runway-threshold',
  location_sign: 'icon-location-sign',
  directional_sign: 'icon-directional-sign',
  informational_sign: 'icon-informational-sign',
  mandatory_sign: 'icon-mandatory-sign',
  obstruction_light: 'icon-obstruction-light',
}

export default function InfrastructureMapPage() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [legendOpen, setLegendOpen] = useState(true)
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>(
    () => Object.fromEntries(LAYERS.map(l => [l.key, true]))
  )
  const { runways, installationId, userRole } = useInstallation()

  // Edit mode
  const [editMode, setEditMode] = useState(false)
  const [dbFeatures, setDbFeatures] = useState<InfrastructureFeature[]>([])
  const [placementType, setPlacementType] = useState<InfrastructureFeatureType>('taxiway_light')
  const [saving, setSaving] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const draggingRef = useRef<{ id: string; startLngLat: [number, number] } | null>(null)
  const dragMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const editModeRef = useRef(false)
  const placementTypeRef = useRef<InfrastructureFeatureType>('taxiway_light')

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const mapboxReady = isMapboxConfigured()

  const isAdmin = userRole === 'sys_admin' || userRole === 'base_admin'
    || userRole === 'airfield_manager' || userRole === 'namo'

  // Keep refs in sync
  useEffect(() => { editModeRef.current = editMode }, [editMode])
  useEffect(() => { placementTypeRef.current = placementType }, [placementType])

  // Fetch DB features
  useEffect(() => {
    if (!installationId) return
    fetchInfrastructureFeatures(installationId).then(setDbFeatures)
  }, [installationId])

  const [importing, setImporting] = useState(false)

  // Build GeoJSON from DB features
  const featureGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    const geoFeatures: GeoJSON.Feature[] = dbFeatures.map(f => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [f.longitude, f.latitude] },
      properties: {
        type: f.feature_type,
        layer: f.layer || 'USER',
        block: f.block,
        text: f.label,
        id: f.id,
        source: f.source,
        notes: f.notes,
      },
    }))
    return { type: 'FeatureCollection', features: geoFeatures }
  }, [dbFeatures])

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

  useEffect(() => {
    (window as any).__deleteInfraFeature = (id: string) => {
      deleteHandlerRef.current?.(id)
    }
    ;(window as any).__moveInfraFeature = (id: string, lng: number, lat: number) => {
      moveHandlerRef.current?.(id, lng, lat)
    }
    return () => {
      delete (window as any).__deleteInfraFeature
      delete (window as any).__moveInfraFeature
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
          m.addLayer({
            id: layer.key,
            type: 'symbol',
            source: 'infrastructure',
            filter: filterExpr,
            layout: {
              'icon-image': iconName,
              'icon-size': [
                'interpolate', ['linear'], ['zoom'],
                12, 0.4,
                14, 0.7,
                16, 1,
                18, 1.4,
              ],
              'icon-allow-overlap': true,
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
              'circle-color': layer.color,
              'circle-opacity': 0.85,
              'circle-stroke-color': '#000000',
              'circle-stroke-width': 0.5,
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
          html += `<div style="font-weight:700;font-size:13px;margin-bottom:4px;color:${layer.color}">${layer.label}</div>`
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
          if (props.id && isEditing) {
            html += `<div style="display:flex;gap:6px;margin-top:8px;">`
            html += `<button onclick="window.__moveInfraFeature('${props.id}',${coords[0]},${coords[1]})" style="
              flex:1;padding:5px 0;border:none;border-radius:5px;
              background:#3B82F6;color:white;font-size:12px;font-weight:600;cursor:pointer;
            ">Move</button>`
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

      // Click on empty map area — place feature in edit mode (skip if dragging)
      m.on('click', (e) => {
        if (!editModeRef.current || draggingRef.current) return
        const layerIds = LAYERS.map(l => l.key)
        const clicked = m.queryRenderedFeatures(e.point, { layers: layerIds })
        if (clicked.length > 0) return

        placeFeatureRef.current?.(e.lngLat.lng, e.lngLat.lat)
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

  // Update map source when merged data changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return
    const source = map.current.getSource('infrastructure') as mapboxgl.GeoJSONSource | undefined
    if (source) {
      source.setData(featureGeoJson)
    }
  }, [featureGeoJson, mapLoaded])

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
    map.current.getCanvas().style.cursor = editMode ? 'crosshair' : ''
  }, [editMode, mapLoaded])

  if (!mapboxReady) {
    return (
      <div className="page-container">
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 14 }}>
          Airfield Infrastructure
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
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        flexShrink: 0,
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>Airfield Infrastructure</div>
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
              onClick={() => setEditMode(prev => !prev)}
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

            <div style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap' }}>
              {saving ? 'Saving...' : 'Tap map to place'}
            </div>
          </div>
        )}

        {/* Legend toggle button */}
        <button
          onClick={() => setLegendOpen(prev => !prev)}
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            zIndex: 10,
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
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Layers
            </div>
            {LAYERS.map(layer => (
              <label
                key={layer.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 0',
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
                    width: 14,
                    height: 10,
                    borderRadius: 1,
                    background: layer.legendBorder || '#FBBF24',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}>
                    <span style={{
                      width: 8,
                      height: 5,
                      background: layer.legendInner || '#000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <span style={{ color: layer.legendBorder || '#FBBF24', fontSize: 7, lineHeight: 1, fontWeight: 900 }}>▶</span>
                    </span>
                  </span>
                ) : layer.legendIcon === 'rect' ? (
                  <span style={{
                    width: 14,
                    height: 10,
                    borderRadius: 1,
                    background: layer.legendBorder || layer.color,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <span style={{
                      width: 8,
                      height: 5,
                      background: layer.legendInner || '#000',
                    }} />
                  </span>
                ) : (
                  <span style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: layer.color,
                    border: '1px solid rgba(0,0,0,0.3)',
                    flexShrink: 0,
                  }} />
                )}
                <span style={{ color: '#E2E8F0', fontSize: 12, flex: 1 }}>{layer.label}</span>
                <span style={{ color: '#64748B', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                  {featureCounts[layer.key]}
                </span>
              </label>
            ))}
            <div style={{
              borderTop: '1px solid rgba(148, 163, 184, 0.15)',
              marginTop: 8,
              paddingTop: 6,
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              color: '#94A3B8',
            }}>
              <span>Total</span>
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
