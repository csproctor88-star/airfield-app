'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchHeatmapData } from '@/lib/supabase/wildlife'
import { isMapboxConfigured } from '@/lib/utils'

type Props = {
  baseId?: string | null
}

export function WildlifeHeatmap({ baseId }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const [filterDays, setFilterDays] = useState(30)
  const [dataType, setDataType] = useState<'all' | 'sightings' | 'strikes'>('all')
  const [pointCount, setPointCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const loadHeatmap = useCallback(async () => {
    if (!mapRef.current) return

    setLoading(true)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - filterDays)

    const points = await fetchHeatmapData(baseId, startDate.toISOString(), undefined, dataType)
    setPointCount(points.length)

    const map = mapRef.current

    // Update or create heatmap source
    const source = map.getSource('wildlife-heat')
    const geojson = {
      type: 'FeatureCollection' as const,
      features: points.map(p => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        properties: { weight: p.weight, species: p.species, type: p.type },
      })),
    }

    if (source) {
      source.setData(geojson)
    } else {
      map.addSource('wildlife-heat', { type: 'geojson', data: geojson })

      map.addLayer({
        id: 'wildlife-heat-layer',
        type: 'heatmap',
        source: 'wildlife-heat',
        paint: {
          'heatmap-weight': ['get', 'weight'],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 1, 18, 3],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.1, '#10B981',
            0.3, '#22D3EE',
            0.5, '#FBBF24',
            0.7, '#F97316',
            1, '#EF4444',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 15, 18, 30],
          'heatmap-opacity': 0.7,
        },
      })

      // Point layer at high zoom
      map.addLayer({
        id: 'wildlife-points',
        type: 'circle',
        source: 'wildlife-heat',
        minzoom: 14,
        paint: {
          'circle-radius': 6,
          'circle-color': [
            'case',
            ['==', ['get', 'type'], 'strike'], '#EF4444',
            '#10B981',
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff',
          'circle-opacity': 0.8,
        },
      })

      // Popup on click
      map.on('click', 'wildlife-points', (e: any) => {
        if (!e.features?.length) return
        const f = e.features[0]
        const popup = new (window as any).mapboxgl.Popup({ offset: 10 })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="font-size:12px;">
              <strong>${f.properties.species}</strong><br/>
              Type: ${f.properties.type}<br/>
              Count: ${f.properties.weight}
            </div>
          `)
          .addTo(map)
      })

      map.on('mouseenter', 'wildlife-points', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'wildlife-points', () => { map.getCanvas().style.cursor = '' })
    }

    setLoading(false)
  }, [baseId, filterDays, dataType])

  useEffect(() => {
    if (!mapContainer.current || !isMapboxConfigured()) return

    const mapboxgl = require('mapbox-gl')
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-v9',
      center: [-98.5, 39.8], // Center of US — will be overridden by data
      zoom: 14,
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    mapRef.current = map

    map.on('load', () => {
      loadHeatmap()
    })

    return () => { map.remove(); mapRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mapRef.current?.isStyleLoaded()) {
      loadHeatmap()
    }
  }, [loadHeatmap])

  if (!isMapboxConfigured()) {
    return (
      <div style={{
        textAlign: 'center', padding: 40, background: 'var(--color-bg-surface)',
        borderRadius: 12, border: '1px solid var(--color-border)',
      }}>
        <div style={{ fontSize: 'var(--fs-xl)', marginBottom: 8 }}>🗺️</div>
        <div style={{ fontWeight: 700 }}>Mapbox not configured</div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
          Set NEXT_PUBLIC_MAPBOX_TOKEN to enable the wildlife heatmap
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={filterDays}
          onChange={e => setFilterDays(Number(e.target.value))}
          style={{
            padding: '6px 10px', borderRadius: 6,
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-surface)', color: 'var(--color-text)',
            fontSize: 'var(--fs-base)',
          }}
        >
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
          <option value={365}>12 months</option>
        </select>
        <select
          value={dataType}
          onChange={e => setDataType(e.target.value as 'all' | 'sightings' | 'strikes')}
          style={{
            padding: '6px 10px', borderRadius: 6,
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-surface)', color: 'var(--color-text)',
            fontSize: 'var(--fs-base)',
          }}
        >
          <option value="all">All Activity</option>
          <option value="sightings">Sightings Only</option>
          <option value="strikes">Strikes Only</option>
        </select>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
          {loading ? 'Loading...' : `${pointCount} data point${pointCount !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 10, fontSize: 'var(--fs-xs)',
        color: 'var(--color-text-3)', alignItems: 'center',
      }}>
        <span>Density:</span>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 2,
          background: 'linear-gradient(to right, #10B981, #22D3EE, #FBBF24, #F97316, #EF4444)',
          width: 120, height: 10, borderRadius: 4,
        }} />
        <span>Low → High</span>
      </div>

      {/* Map container */}
      <div
        ref={mapContainer}
        style={{
          width: '100%', aspectRatio: '3/4', maxHeight: '70vh',
          borderRadius: 12, border: '1px solid var(--color-border)',
          overflow: 'hidden',
        }}
      />

      <div style={{ marginTop: 8, fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)' }}>
        DAFI 91-212 Wildlife Hazard Depiction — Concentrated activity areas shown via heatmap overlay
      </div>
    </div>
  )
}
