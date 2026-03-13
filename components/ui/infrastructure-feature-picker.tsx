'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useInstallation } from '@/lib/installation-context'
import { isMapboxConfigured } from '@/lib/utils'
import { fetchInfrastructureFeatures } from '@/lib/supabase/infrastructure-features'
import { fetchAllComponentsForBase } from '@/lib/supabase/lighting-systems'
import type { InfrastructureFeature } from '@/lib/supabase/types'

type Props = {
  systemIds: string[]
  /** When provided, only show features from these specific components (instead of all components in the system) */
  componentIds?: string[]
  baseId: string
  selectedFeatureIds: string[]
  onSelectionChange: (ids: string[]) => void
  /** Called with the full feature objects whenever the selected features change */
  onSelectedFeaturesChange?: (features: InfrastructureFeature[]) => void
}

// ── Canvas icon helpers (simplified from infrastructure page) ──

function createCanvasIcon(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  return [c, c.getContext('2d')!]
}

function createCircleIcon(color: string, size: number = 20): ImageData {
  const [, ctx] = createCanvasIcon(size)
  const r = size / 2 - 2, cx = size / 2, cy = size / 2
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 1.5
  ctx.stroke()
  return ctx.getImageData(0, 0, size, size)
}

function createSelectedIcon(size: number = 28): ImageData {
  const [, ctx] = createCanvasIcon(size)
  const r = size / 2 - 2, cx = size / 2, cy = size / 2
  // Cyan ring
  ctx.strokeStyle = '#22D3EE'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
  // Inner dot
  ctx.fillStyle = '#22D3EE'
  ctx.beginPath()
  ctx.arc(cx, cy, 4, 0, Math.PI * 2)
  ctx.fill()
  return ctx.getImageData(0, 0, size, size)
}

export function InfrastructureFeaturePicker({
  systemIds,
  componentIds,
  baseId,
  selectedFeatureIds,
  onSelectionChange,
  onSelectedFeaturesChange,
}: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [filteredFeatures, setFilteredFeatures] = useState<InfrastructureFeature[]>([])
  const [loading, setLoading] = useState(true)
  const { runways, installationId } = useInstallation()
  const selectedRef = useRef<string[]>(selectedFeatureIds)
  selectedRef.current = selectedFeatureIds

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const mapboxReady = isMapboxConfigured()

  // ── Fetch and filter features ──
  useEffect(() => {
    if (!baseId || systemIds.length === 0) {
      setFilteredFeatures([])
      setLoading(false)
      return
    }

    let cancelled = false
    async function load() {
      setLoading(true)
      const [features, components] = await Promise.all([
        fetchInfrastructureFeatures(baseId),
        fetchAllComponentsForBase(baseId),
      ])

      if (cancelled) return

      // If specific component IDs are provided, use those directly;
      // otherwise fall back to all components in the specified systems
      let matchingComponentIds: Set<string>
      if (componentIds && componentIds.length > 0) {
        matchingComponentIds = new Set(componentIds)
      } else {
        const systemIdSet = new Set(systemIds)
        matchingComponentIds = new Set(
          components
            .filter(c => systemIdSet.has(c.system_id))
            .map(c => c.id)
        )
      }

      // Filter features to those assigned to matching components
      const filtered = features.filter(
        f => f.system_component_id && matchingComponentIds.has(f.system_component_id)
      )
      setFilteredFeatures(filtered)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [baseId, systemIds, componentIds])

  // ── Initialize map ──
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

    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

    m.on('load', () => {
      // Add icons
      const pr = { pixelRatio: 1 }
      m.addImage('fp-operational', createCircleIcon('#22C55E', 20), pr)
      m.addImage('fp-inoperative', createCircleIcon('#EF4444', 20), pr)
      m.addImage('fp-selected', createSelectedIcon(28), pr)
      setMapLoaded(true)
    })

    map.current = m

    return () => {
      m.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, installationId])

  // ── Render features on map ──
  useEffect(() => {
    const m = map.current
    if (!m || !mapLoaded || filteredFeatures.length === 0) return

    // Remove old layers/sources
    for (const id of ['fp-features', 'fp-selected-ring']) {
      if (m.getLayer(id)) m.removeLayer(id)
      if (m.getSource(id)) m.removeSource(id)
    }

    const selectedSet = new Set(selectedFeatureIds)

    // All features source
    m.addSource('fp-features', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: filteredFeatures.map(f => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [f.longitude, f.latitude] },
          properties: {
            id: f.id,
            status: f.status,
            label: f.label || f.feature_type,
            selected: selectedSet.has(f.id),
          },
        })),
      },
    })

    // Base layer: color by status
    m.addLayer({
      id: 'fp-features',
      type: 'symbol',
      source: 'fp-features',
      layout: {
        'icon-image': ['case',
          ['get', 'selected'], 'fp-selected',
          ['==', ['get', 'status'], 'inoperative'], 'fp-inoperative',
          'fp-operational',
        ],
        'icon-allow-overlap': true,
        'icon-size': 1,
      },
    })

    // Fit bounds to filtered features
    if (filteredFeatures.length > 0) {
      const bounds = new mapboxgl.LngLatBounds()
      for (const f of filteredFeatures) {
        bounds.extend([f.longitude, f.latitude])
      }
      m.fitBounds(bounds, { padding: 40, maxZoom: 17, duration: 500 })
    }

    // Click handler
    const handleClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.GeoJSONFeature[] }) => {
      const features = m.queryRenderedFeatures(e.point, { layers: ['fp-features'] })
      if (!features.length) return

      const fId = features[0].properties?.id as string
      if (!fId) return

      const current = [...selectedRef.current]
      const idx = current.indexOf(fId)
      if (idx >= 0) {
        current.splice(idx, 1)
      } else {
        current.push(fId)
      }
      onSelectionChange(current)
      if (onSelectedFeaturesChange) {
        const selectedSet = new Set(current)
        onSelectedFeaturesChange(filteredFeatures.filter(f => selectedSet.has(f.id)))
      }
    }

    m.on('click', 'fp-features', handleClick)

    // Change cursor on hover
    m.on('mouseenter', 'fp-features', () => { m.getCanvas().style.cursor = 'pointer' })
    m.on('mouseleave', 'fp-features', () => { m.getCanvas().style.cursor = '' })

    return () => {
      m.off('click', 'fp-features', handleClick)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, filteredFeatures, selectedFeatureIds])

  // ── Update feature data when selection changes (without rebuilding layers) ──
  useEffect(() => {
    const m = map.current
    if (!m || !mapLoaded) return
    const source = m.getSource('fp-features') as mapboxgl.GeoJSONSource | undefined
    if (!source) return

    const selectedSet = new Set(selectedFeatureIds)
    source.setData({
      type: 'FeatureCollection',
      features: filteredFeatures.map(f => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [f.longitude, f.latitude] },
        properties: {
          id: f.id,
          status: f.status,
          label: f.label || f.feature_type,
          selected: selectedSet.has(f.id),
        },
      })),
    })
  }, [selectedFeatureIds, filteredFeatures, mapLoaded])

  if (!mapboxReady) {
    return (
      <div style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-mid)',
        borderRadius: 10,
        padding: 24,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-2)' }}>
          Mapbox Token Required
        </div>
      </div>
    )
  }

  const totalFiltered = filteredFeatures.length
  const selectedCount = selectedFeatureIds.length

  return (
    <div>
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

        {/* Loading overlay */}
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)', borderRadius: 10,
          }}>
            <div style={{ color: '#fff', fontSize: 'var(--fs-md)', fontWeight: 600 }}>
              Loading features...
            </div>
          </div>
        )}

        {/* Prompt */}
        {!loading && mapLoaded && totalFiltered > 0 && (
          <div style={{
            position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(4, 7, 12, 0.88)', borderRadius: 6,
            padding: '4px 10px', fontSize: 'var(--fs-sm)', color: '#94A3B8',
            fontWeight: 600, whiteSpace: 'nowrap',
          }}>
            Tap features to mark inoperative
          </div>
        )}

        {/* Count badge */}
        {totalFiltered > 0 && (
          <div style={{
            position: 'absolute', bottom: 8, left: 8,
            background: 'rgba(4, 7, 12, 0.88)', borderRadius: 6,
            padding: '4px 8px', fontSize: 'var(--fs-sm)',
            color: selectedCount > 0 ? '#22D3EE' : 'var(--color-text-3)',
            fontWeight: 600,
          }}>
            {selectedCount} of {totalFiltered} feature{totalFiltered !== 1 ? 's' : ''} selected
          </div>
        )}

        {/* Legend */}
        {totalFiltered > 0 && (
          <div style={{
            position: 'absolute', bottom: 8, right: 8,
            background: 'rgba(4, 7, 12, 0.88)', borderRadius: 6,
            padding: '4px 8px', display: 'flex', gap: 8,
            fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
              OK
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', display: 'inline-block' }} />
              Inop
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #22D3EE', display: 'inline-block', boxSizing: 'border-box' }} />
              Selected
            </span>
          </div>
        )}
      </div>

      {/* No features message */}
      {!loading && totalFiltered === 0 && (
        <div style={{
          textAlign: 'center', padding: 16, color: 'var(--color-text-3)',
          fontSize: 'var(--fs-sm)',
        }}>
          No infrastructure features found for the linked systems.
          Assign features to system components on the Visual NAVAIDs page first.
        </div>
      )}
    </div>
  )
}
