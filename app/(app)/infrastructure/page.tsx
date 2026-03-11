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
  deleteInfrastructureFeature,
  type InfrastructureFeatureType,
} from '@/lib/supabase/infrastructure-features'
import type { InfrastructureFeature } from '@/lib/supabase/types'
import geojsonData from '@/lib/data/selfridge-lighting-signage.json'

// ── Layer configuration ──

type LayerConfig = {
  key: string
  label: string
  color: string
  types: string[]
  shape: 'circle' | 'square'
}

const LAYERS: LayerConfig[] = [
  { key: 'runway_lights',     label: 'Runway Lights',       color: '#FFFFFF',  types: ['runway_light'],            shape: 'circle' },
  { key: 'airfield_lighting', label: 'Airfield Lighting',   color: '#38BDF8',  types: ['airfield_light'],          shape: 'circle' },
  { key: 'taxi_edge_lights',  label: 'Taxi Edge Lights',    color: '#22D3EE',  types: ['taxi_edge_light', 'taxi_edge_light_elev'], shape: 'circle' },
  { key: 'taxilights',        label: 'Taxiway Lights',      color: '#34D399',  types: ['taxilight'],               shape: 'circle' },
  { key: 'signs',             label: 'Airfield Signs',      color: '#FBBF24',  types: ['airfield_sign'],           shape: 'square' },
  { key: 'markings',          label: 'Marking Labels',      color: '#F97316',  types: ['marking_label'],           shape: 'square' },
]

const FEATURE_TYPE_OPTIONS: { value: InfrastructureFeatureType; label: string }[] = [
  { value: 'runway_light', label: 'Runway Light' },
  { value: 'airfield_light', label: 'Airfield Light' },
  { value: 'taxi_edge_light', label: 'Taxi Edge Light' },
  { value: 'taxilight', label: 'Taxiway Light' },
  { value: 'airfield_sign', label: 'Airfield Sign' },
  { value: 'marking_label', label: 'Marking Label' },
]

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
  const [placementType, setPlacementType] = useState<InfrastructureFeatureType>('taxi_edge_light')
  const [saving, setSaving] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const editModeRef = useRef(false)
  const placementTypeRef = useRef<InfrastructureFeatureType>('taxi_edge_light')

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

  // Merge static + DB features
  const mergedGeoJson = useMemo<GeoJSON.FeatureCollection>(() => {
    const staticFeatures = (geojsonData as GeoJSON.FeatureCollection).features.map(f => ({
      ...f,
      properties: { ...f.properties, source: 'static' },
    }))
    const dbGeoFeatures: GeoJSON.Feature[] = dbFeatures.map(f => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [f.longitude, f.latitude] },
      properties: {
        type: f.feature_type,
        layer: f.layer || 'USER',
        block: f.block,
        text: f.label,
        id: f.id,
        source: 'db',
        notes: f.notes,
      },
    }))
    return { type: 'FeatureCollection', features: [...staticFeatures, ...dbGeoFeatures] }
  }, [dbFeatures])

  // Feature counts from merged data
  const featureCounts: Record<string, number> = {}
  for (const layer of LAYERS) {
    featureCounts[layer.key] = mergedGeoJson.features.filter(
      f => layer.types.includes(f.properties?.type)
    ).length
  }
  const totalFeatures = mergedGeoJson.features.length

  const toggleLayer = useCallback((key: string) => {
    setVisibleLayers(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  // Delete handler (exposed on window for popup buttons)
  const deleteHandlerRef = useRef<((id: string) => Promise<void>) | undefined>(undefined)
  deleteHandlerRef.current = async (id: string) => {
    if (!installationId) return
    const ok = await deleteInfrastructureFeature(id)
    if (ok) {
      const updated = await fetchInfrastructureFeatures(installationId)
      setDbFeatures(updated)
      toast.success('Feature deleted')
    } else {
      toast.error('Failed to delete feature')
    }
  }

  useEffect(() => {
    (window as any).__deleteInfraFeature = (id: string) => {
      deleteHandlerRef.current?.(id)
    }
    return () => { delete (window as any).__deleteInfraFeature }
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
      toast.success('Feature placed')
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

    m.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right')

    m.on('load', () => {
      m.addSource('infrastructure', {
        type: 'geojson',
        data: mergedGeoJson,
      })

      for (const layer of LAYERS) {
        const filterExpr: mapboxgl.Expression = layer.types.length === 1
          ? ['==', ['get', 'type'], layer.types[0]]
          : ['any', ...layer.types.map(t => ['==', ['get', 'type'], t])] as mapboxgl.Expression

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
            'circle-stroke-color': [
              'case',
              ['==', ['get', 'source'], 'db'], '#10B981',
              '#000000',
            ],
            'circle-stroke-width': [
              'case',
              ['==', ['get', 'source'], 'db'], 2,
              0.5,
            ],
          },
        })

        // Click handler for popups
        m.on('click', layer.key, (e) => {
          if (!e.features || e.features.length === 0) return
          e.originalEvent.stopPropagation()
          const feat = e.features[0]
          const coords = (feat.geometry as GeoJSON.Point).coordinates.slice() as [number, number]
          const props = feat.properties || {}
          const isDb = props.source === 'db'
          const isEditing = editModeRef.current

          let html = `<div style="font-family:system-ui;font-size:12px;color:#E2E8F0;">`
          html += `<div style="font-weight:700;font-size:13px;margin-bottom:4px;color:${layer.color}">${layer.label}</div>`
          if (isDb) {
            html += `<div style="font-size:10px;color:#10B981;margin-bottom:4px;">User-added feature</div>`
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
          if (isDb && isEditing) {
            html += `<button onclick="window.__deleteInfraFeature('${props.id}')" style="
              margin-top:8px;width:100%;padding:5px 0;border:none;border-radius:5px;
              background:#EF4444;color:white;font-size:12px;font-weight:600;cursor:pointer;
            ">Delete Feature</button>`
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

      // Click on empty map area — place feature in edit mode
      m.on('click', (e) => {
        if (!editModeRef.current) return
        // Check if we clicked on an existing feature (those handlers call stopPropagation)
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
      source.setData(mergedGeoJson)
    }
  }, [mergedGeoJson, mapLoaded])

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
            {dbFeatures.length > 0 && ` (${dbFeatures.length} user-added)`}
          </div>
        </div>
        {isAdmin && (
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

        {/* Edit mode toolbar */}
        {editMode && (
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
                <span style={{
                  width: 12,
                  height: 12,
                  borderRadius: layer.shape === 'circle' ? '50%' : 2,
                  background: layer.color,
                  border: '1px solid rgba(0,0,0,0.3)',
                  flexShrink: 0,
                }} />
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
