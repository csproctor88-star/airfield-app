'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { INSTALLATION } from '@/lib/constants'
import {
  type LatLon,
  type RunwayGeometry,
  getRunwayGeometry,
  generateRunwayPolygon,
  generatePrimarySurfacePolygon,
  generateApproachDeparturePolygons,
  generateStadiumPolygon,
  generateTransitionalPolygons,
} from '@/lib/calculations/geometry'
import { IMAGINARY_SURFACES } from '@/lib/calculations/obstructions'

type Props = {
  onPointSelected: (point: LatLon) => void
  selectedPoint: LatLon | null
  surfaceAtPoint: string | null
}

const SURFACE_LAYERS = [
  { id: 'outer-horizontal', label: 'Outer Horizontal', color: IMAGINARY_SURFACES.outer_horizontal.color, opacity: 0.08 },
  { id: 'conical', label: 'Conical', color: IMAGINARY_SURFACES.conical.color, opacity: 0.1 },
  { id: 'inner-horizontal', label: 'Inner Horizontal', color: IMAGINARY_SURFACES.inner_horizontal.color, opacity: 0.12 },
  { id: 'transitional-left', label: 'Transitional', color: IMAGINARY_SURFACES.transitional.color, opacity: 0.15 },
  { id: 'transitional-right', label: 'Transitional', color: IMAGINARY_SURFACES.transitional.color, opacity: 0.15 },
  { id: 'approach-end1', label: 'Approach-Departure', color: IMAGINARY_SURFACES.approach_departure.color, opacity: 0.14 },
  { id: 'approach-end2', label: 'Approach-Departure', color: IMAGINARY_SURFACES.approach_departure.color, opacity: 0.14 },
  { id: 'primary-surface', label: 'Primary Surface', color: IMAGINARY_SURFACES.primary.color, opacity: 0.18 },
  { id: 'runway', label: 'Runway', color: '#FFFFFF', opacity: 0.5 },
]

function getRwy(): RunwayGeometry {
  return getRunwayGeometry(INSTALLATION.runways[0])
}

function buildSurfaceGeoJSON(rwy: RunwayGeometry) {
  const features: GeoJSON.Feature[] = []

  // Derive radii from UFC constants
  const innerHRadius = IMAGINARY_SURFACES.inner_horizontal.criteria.radius
  const conicalExtent = IMAGINARY_SURFACES.conical.criteria.horizontalExtent
  const outerHRadius = IMAGINARY_SURFACES.outer_horizontal.criteria.radius

  // Outer horizontal stadium
  const outerH = generateStadiumPolygon(rwy, outerHRadius, 64)
  features.push({
    type: 'Feature',
    properties: { id: 'outer-horizontal' },
    geometry: { type: 'Polygon', coordinates: [outerH] },
  })

  // Conical ring — draw full stadium; inner horizontal visually overlaps
  const conical = generateStadiumPolygon(rwy, innerHRadius + conicalExtent, 64)
  features.push({
    type: 'Feature',
    properties: { id: 'conical' },
    geometry: { type: 'Polygon', coordinates: [conical] },
  })

  // Inner horizontal stadium
  const innerH = generateStadiumPolygon(rwy, innerHRadius, 64)
  features.push({
    type: 'Feature',
    properties: { id: 'inner-horizontal' },
    geometry: { type: 'Polygon', coordinates: [innerH] },
  })

  // Transitional surfaces (left and right)
  const transitional = generateTransitionalPolygons(rwy)
  features.push({
    type: 'Feature',
    properties: { id: 'transitional-left' },
    geometry: { type: 'Polygon', coordinates: [transitional.left] },
  })
  features.push({
    type: 'Feature',
    properties: { id: 'transitional-right' },
    geometry: { type: 'Polygon', coordinates: [transitional.right] },
  })

  // Approach-departure trapezoids
  const approach = generateApproachDeparturePolygons(rwy)
  features.push({
    type: 'Feature',
    properties: { id: 'approach-end1' },
    geometry: { type: 'Polygon', coordinates: [approach.end1] },
  })
  features.push({
    type: 'Feature',
    properties: { id: 'approach-end2' },
    geometry: { type: 'Polygon', coordinates: [approach.end2] },
  })

  // Primary surface
  const primary = generatePrimarySurfacePolygon(rwy)
  features.push({
    type: 'Feature',
    properties: { id: 'primary-surface' },
    geometry: { type: 'Polygon', coordinates: [primary] },
  })

  // Runway pavement
  const runway = generateRunwayPolygon(rwy)
  features.push({
    type: 'Feature',
    properties: { id: 'runway' },
    geometry: { type: 'Polygon', coordinates: [runway] },
  })

  return {
    type: 'FeatureCollection' as const,
    features,
  }
}

export default function AirfieldMap({ onPointSelected, selectedPoint, surfaceAtPoint }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const marker = useRef<mapboxgl.Marker | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  const handleClick = useCallback(
    (e: mapboxgl.MapMouseEvent) => {
      const { lng, lat } = e.lngLat
      onPointSelected({ lat, lon: lng })
    },
    [onPointSelected],
  )

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !token || token === 'your-mapbox-token-here') return
    if (map.current) return

    mapboxgl.accessToken = token

    const rwy = getRwy()

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: [rwy.midpoint.lon, rwy.midpoint.lat],
      zoom: 13,
      pitch: 0,
      bearing: 0,
    })

    m.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right')

    m.on('load', () => {
      const geojson = buildSurfaceGeoJSON(rwy)

      // Add each surface as a separate layer for individual styling
      for (const layer of SURFACE_LAYERS) {
        const featureForLayer = geojson.features.find(
          (f) => f.properties?.id === layer.id,
        )
        if (!featureForLayer) continue

        const sourceId = `source-${layer.id}`
        m.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [featureForLayer],
          },
        })

        // Fill layer
        m.addLayer({
          id: `fill-${layer.id}`,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': layer.color,
            'fill-opacity': layer.opacity,
          },
        })

        // Outline layer
        m.addLayer({
          id: `line-${layer.id}`,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': layer.color,
            'line-opacity': Math.min(1, layer.opacity * 3),
            'line-width': layer.id === 'runway' ? 2 : 1,
          },
        })
      }

      // Add runway end labels
      const rwy01 = INSTALLATION.runways[0].end1
      const rwy19 = INSTALLATION.runways[0].end2

      m.addSource('rwy-labels', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { label: '01' },
              geometry: { type: 'Point', coordinates: [rwy01.longitude, rwy01.latitude] },
            },
            {
              type: 'Feature',
              properties: { label: '19' },
              geometry: { type: 'Point', coordinates: [rwy19.longitude, rwy19.latitude] },
            },
          ],
        },
      })

      m.addLayer({
        id: 'rwy-labels',
        type: 'symbol',
        source: 'rwy-labels',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 14,
          'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#FFFFFF',
          'text-halo-color': '#000000',
          'text-halo-width': 2,
        },
      })

      setMapLoaded(true)
    })

    m.on('click', handleClick)
    map.current = m

    return () => {
      m.off('click', handleClick)
      m.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Update click handler when callback changes
  useEffect(() => {
    const m = map.current
    if (!m || !mapLoaded) return

    m.off('click', handleClick)
    m.on('click', handleClick)

    return () => {
      m.off('click', handleClick)
    }
  }, [handleClick, mapLoaded])

  // Update marker when selectedPoint changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    if (marker.current) {
      marker.current.remove()
      marker.current = null
    }

    if (selectedPoint) {
      const el = document.createElement('div')
      el.style.width = '24px'
      el.style.height = '24px'
      el.style.borderRadius = '50%'
      el.style.border = '3px solid #FFFFFF'
      el.style.background = surfaceAtPoint === 'No violation' ? '#22C55E' : '#EF4444'
      el.style.boxShadow = '0 0 8px rgba(0,0,0,0.5)'
      el.style.cursor = 'pointer'

      marker.current = new mapboxgl.Marker({ element: el })
        .setLngLat([selectedPoint.lon, selectedPoint.lat])
        .addTo(map.current)
    }
  }, [selectedPoint, mapLoaded, surfaceAtPoint])

  if (!token || token === 'your-mapbox-token-here') {
    return (
      <div
        style={{
          background: 'rgba(10, 16, 28, 0.92)',
          border: '1px solid rgba(56, 189, 248, 0.1)',
          borderRadius: 10,
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 24, marginBottom: 8 }}>🗺️</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', marginBottom: 8 }}>
          Mapbox Token Required
        </div>
        <div style={{ fontSize: 11, color: '#64748B', lineHeight: 1.5 }}>
          Add your Mapbox access token to <code style={{ color: '#38BDF8' }}>.env.local</code>
          <br />
          <code style={{ color: '#38BDF8', fontSize: 10 }}>NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx</code>
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
          height: 360,
          borderRadius: 10,
          overflow: 'hidden',
          border: '1px solid rgba(56, 189, 248, 0.1)',
        }}
      />
      {/* Surface legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: 8,
          background: 'rgba(4, 7, 12, 0.88)',
          borderRadius: 8,
          padding: '6px 8px',
          fontSize: 9,
          lineHeight: 1.6,
          maxWidth: 160,
        }}
      >
        {[
          { color: IMAGINARY_SURFACES.primary.color, label: 'Primary' },
          { color: IMAGINARY_SURFACES.approach_departure.color, label: 'Approach/Departure' },
          { color: IMAGINARY_SURFACES.transitional.color, label: 'Transitional' },
          { color: IMAGINARY_SURFACES.inner_horizontal.color, label: 'Inner Horizontal' },
          { color: IMAGINARY_SURFACES.conical.color, label: 'Conical' },
          { color: IMAGINARY_SURFACES.outer_horizontal.color, label: 'Outer Horizontal' },
        ].map((s) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: s.color,
                flexShrink: 0,
                opacity: 0.8,
              }}
            />
            <span style={{ color: '#CBD5E1' }}>{s.label}</span>
          </div>
        ))}
      </div>
      {!selectedPoint && mapLoaded && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(4, 7, 12, 0.88)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: 10,
            color: '#94A3B8',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          Tap map to place obstruction
        </div>
      )}
    </div>
  )
}
