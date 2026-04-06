'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchHeatmapData } from '@/lib/supabase/wildlife'
import { initGoogleMaps, isGoogleMapsConfigured, GOOGLE_MAP_OPTIONS } from '@/lib/google-maps'
import { useInstallation } from '@/lib/installation-context'

type Props = {
  baseId?: string | null
}

export function WildlifeHeatmapGoogle({ baseId }: Props) {
  const { runways } = useInstallation()
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const heatmapLayerRef = useRef<google.maps.visualization.HeatmapLayer | null>(null)
  const pointMarkersRef = useRef<google.maps.Marker[]>([])
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const [filterDays, setFilterDays] = useState(30)
  const [dataType, setDataType] = useState<'all' | 'sightings' | 'strikes'>('all')
  const [pointCount, setPointCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [apiReady, setApiReady] = useState(false)
  const hasApiKey = isGoogleMapsConfigured()

  useEffect(() => {
    if (!hasApiKey) return
    initGoogleMaps().then(async () => {
      // Also load the visualization library for HeatmapLayer
      const { importLibrary } = await import('@googlemaps/js-api-loader')
      await importLibrary('visualization')
      setApiReady(true)
    })
  }, [hasApiKey])

  const loadHeatmap = useCallback(async () => {
    if (!mapRef.current) return

    setLoading(true)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - filterDays)

    const points = await fetchHeatmapData(baseId, startDate.toISOString(), undefined, dataType)
    setPointCount(points.length)

    // Update heatmap
    const heatmapData = points.map(p => ({
      location: new google.maps.LatLng(p.lat, p.lng),
      weight: p.weight,
    }))

    if (heatmapLayerRef.current) {
      heatmapLayerRef.current.setData(heatmapData)
    } else {
      heatmapLayerRef.current = new google.maps.visualization.HeatmapLayer({
        data: heatmapData,
        map: mapRef.current,
        radius: 25,
        opacity: 0.7,
        gradient: [
          'rgba(0,0,0,0)',
          '#10B981',
          '#22D3EE',
          '#FBBF24',
          '#F97316',
          '#EF4444',
        ],
      })
    }

    // Update point markers (visible at high zoom)
    pointMarkersRef.current.forEach(m => m.setMap(null))
    pointMarkersRef.current = []

    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow()
    }

    for (const p of points) {
      const marker = new google.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map: mapRef.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: p.type === 'strike' ? '#EF4444' : '#10B981',
          fillOpacity: 0.8,
          strokeColor: '#FFFFFF',
          strokeWeight: 1,
        },
        visible: (mapRef.current?.getZoom() ?? 0) >= 14,
      })

      marker.addListener('click', () => {
        infoWindowRef.current?.setContent(`
          <div style="font-size:12px;color:#1E293B;">
            <strong>${p.species}</strong><br/>
            Type: ${p.type}<br/>
            Count: ${p.weight}
          </div>
        `)
        infoWindowRef.current?.open(mapRef.current!, marker)
      })

      pointMarkersRef.current.push(marker)
    }

    setLoading(false)
  }, [baseId, filterDays, dataType])

  // Initialize map
  useEffect(() => {
    if (!apiReady || !mapContainer.current) return

    const rwy = runways?.[0]
    const centerLat = rwy ? ((rwy.end1_latitude ?? 0) + (rwy.end2_latitude ?? 0)) / 2 : 39.8
    const centerLng = rwy ? ((rwy.end1_longitude ?? 0) + (rwy.end2_longitude ?? 0)) / 2 : -98.5

    const gmap = new google.maps.Map(mapContainer.current, {
      ...GOOGLE_MAP_OPTIONS,
      center: { lat: centerLat, lng: centerLng },
      zoom: 14,
    })

    // Toggle point marker visibility based on zoom
    gmap.addListener('zoom_changed', () => {
      const zoom = gmap.getZoom() ?? 0
      const visible = zoom >= 14
      pointMarkersRef.current.forEach(m => m.setVisible(visible))
    })

    mapRef.current = gmap
    loadHeatmap()

    return () => {
      heatmapLayerRef.current?.setMap(null)
      heatmapLayerRef.current = null
      pointMarkersRef.current.forEach(m => m.setMap(null))
      pointMarkersRef.current = []
      mapRef.current = null
    }
  }, [apiReady]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mapRef.current) loadHeatmap()
  }, [loadHeatmap])

  if (!hasApiKey) {
    return (
      <div style={{
        textAlign: 'center', padding: 40, background: 'var(--color-bg-surface)',
        borderRadius: 12, border: '1px solid var(--color-border)',
      }}>
        <div style={{ fontSize: 'var(--fs-xl)', marginBottom: 8 }}>🗺️</div>
        <div style={{ fontWeight: 700 }}>Google Maps API Key Required</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterDays} onChange={e => setFilterDays(Number(e.target.value))} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text)', fontSize: 'var(--fs-base)' }}>
          <option value={7}>7 days</option>
          <option value={30}>30 days</option>
          <option value={90}>90 days</option>
          <option value={365}>12 months</option>
        </select>
        <select value={dataType} onChange={e => setDataType(e.target.value as typeof dataType)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text)', fontSize: 'var(--fs-base)' }}>
          <option value="all">All Activity</option>
          <option value="sightings">Sightings Only</option>
          <option value="strikes">Strikes Only</option>
        </select>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
          {loading ? 'Loading...' : `${pointCount} data point${pointCount !== 1 ? 's' : ''}`}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', alignItems: 'center' }}>
        <span>Density:</span>
        <div style={{ display: 'flex', background: 'linear-gradient(to right, #10B981, #22D3EE, #FBBF24, #F97316, #EF4444)', width: 120, height: 10, borderRadius: 4 }} />
        <span>Low &rarr; High</span>
      </div>
      <div ref={mapContainer} style={{ width: '100%', aspectRatio: '3/4', maxHeight: '70vh', borderRadius: 12, border: '1px solid var(--color-border)', overflow: 'hidden' }} />
      <div style={{ marginTop: 8, fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)' }}>
        DAFI 91-212 Wildlife Hazard Depiction &mdash; Concentrated activity areas shown via heatmap overlay
      </div>
    </div>
  )
}
