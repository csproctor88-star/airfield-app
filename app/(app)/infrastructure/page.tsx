'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useInstallation } from '@/lib/installation-context'
import { isMapboxConfigured } from '@/lib/utils'
import geojsonData from '@/lib/data/selfridge-lighting-signage.json'

// ── Layer configuration ──

type LayerConfig = {
  key: string
  label: string
  color: string
  types: string[]      // feature property "type" values
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

export default function InfrastructureMapPage() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [legendOpen, setLegendOpen] = useState(true)
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>(
    () => Object.fromEntries(LAYERS.map(l => [l.key, true]))
  )
  const { runways, installationId } = useInstallation()

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const mapboxReady = isMapboxConfigured()

  // Count features per layer
  const featureCounts: Record<string, number> = {}
  for (const layer of LAYERS) {
    featureCounts[layer.key] = (geojsonData as GeoJSON.FeatureCollection).features.filter(
      f => layer.types.includes(f.properties?.type)
    ).length
  }
  const totalFeatures = (geojsonData as GeoJSON.FeatureCollection).features.length

  // Toggle a layer
  const toggleLayer = useCallback((key: string) => {
    setVisibleLayers(prev => ({ ...prev, [key]: !prev[key] }))
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
      // Add the GeoJSON source
      m.addSource('infrastructure', {
        type: 'geojson',
        data: geojsonData as GeoJSON.FeatureCollection,
      })

      // Add a layer for each category
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
            'circle-stroke-color': '#000000',
            'circle-stroke-width': 0.5,
          },
        })

        // Click handler for popups
        m.on('click', layer.key, (e) => {
          if (!e.features || e.features.length === 0) return
          const feat = e.features[0]
          const coords = (feat.geometry as GeoJSON.Point).coordinates as [number, number]
          const props = feat.properties || {}

          let html = `<div style="font-family:system-ui;font-size:12px;color:#E2E8F0;">`
          html += `<div style="font-weight:700;font-size:13px;margin-bottom:4px;color:${layer.color}">${layer.label}</div>`
          html += `<div style="color:#94A3B8;font-size:11px;">Lat: ${coords[1].toFixed(6)}</div>`
          html += `<div style="color:#94A3B8;font-size:11px;">Lon: ${coords[0].toFixed(6)}</div>`
          if (props.block) {
            html += `<div style="margin-top:4px;color:#CBD5E1;">Fixture: ${props.block}</div>`
          }
          if (props.text) {
            html += `<div style="margin-top:4px;color:#CBD5E1;">Label: ${props.text}</div>`
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

        // Pointer cursor on hover
        m.on('mouseenter', layer.key, () => { m.getCanvas().style.cursor = 'pointer' })
        m.on('mouseleave', layer.key, () => { m.getCanvas().style.cursor = '' })
      }

      setMapLoaded(true)
    })

    map.current = m

    return () => {
      m.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, installationId])

  // Sync layer visibility when toggles change
  useEffect(() => {
    if (!map.current || !mapLoaded) return
    const m = map.current
    for (const layer of LAYERS) {
      if (m.getLayer(layer.key)) {
        m.setLayoutProperty(layer.key, 'visibility', visibleLayers[layer.key] ? 'visible' : 'none')
      }
    }
  }, [visibleLayers, mapLoaded])

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
      }}>
        <div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>Airfield Infrastructure</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>
            {totalFeatures.toLocaleString()} features extracted from airfield engineering drawings
          </div>
        </div>
      </div>

      {/* Map + Legend */}
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
