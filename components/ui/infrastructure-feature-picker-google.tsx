'use client'

import { useEffect, useRef, useState } from 'react'
import { initGoogleMaps, isGoogleMapsConfigured, GOOGLE_MAP_OPTIONS } from '@/lib/google-maps'
import { applyMapProvider } from '@/lib/map-providers'
import { useInstallation } from '@/lib/installation-context'
import { fetchInfrastructureFeatures } from '@/lib/supabase/infrastructure-features'
import { fetchAllComponentsForBase } from '@/lib/supabase/lighting-systems'
import type { InfrastructureFeature } from '@/lib/supabase/types'

type Props = {
  systemIds: string[]
  componentIds?: string[]
  baseId: string
  selectedFeatureIds: string[]
  onSelectionChange: (ids: string[]) => void
  onSelectedFeaturesChange?: (features: InfrastructureFeature[]) => void
}

export function InfrastructureFeaturePickerGoogle({
  systemIds,
  componentIds,
  baseId,
  selectedFeatureIds,
  onSelectionChange,
  onSelectedFeaturesChange,
}: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const [mapLoaded, setMapLoaded] = useState(false)
  const [apiReady, setApiReady] = useState(false)
  const [filteredFeatures, setFilteredFeatures] = useState<InfrastructureFeature[]>([])
  const [loading, setLoading] = useState(true)
  const { runways, installationId, mapProvider } = useInstallation()
  const hasApiKey = isGoogleMapsConfigured()
  const selectedRef = useRef<string[]>(selectedFeatureIds)
  selectedRef.current = selectedFeatureIds
  const filteredRef = useRef<InfrastructureFeature[]>([])
  filteredRef.current = filteredFeatures

  useEffect(() => {
    if (!hasApiKey) return
    initGoogleMaps().then(() => setApiReady(true))
  }, [hasApiKey])

  // Fetch and filter features
  useEffect(() => {
    if (!baseId || systemIds.length === 0) { setFilteredFeatures([]); setLoading(false); return }
    let cancelled = false
    async function load() {
      setLoading(true)
      const [features, components] = await Promise.all([
        fetchInfrastructureFeatures(baseId),
        fetchAllComponentsForBase(baseId),
      ])
      if (cancelled) return
      let matchingComponentIds: Set<string>
      if (componentIds && componentIds.length > 0) {
        matchingComponentIds = new Set(componentIds)
      } else {
        const systemIdSet = new Set(systemIds)
        matchingComponentIds = new Set(components.filter(c => systemIdSet.has(c.system_id)).map(c => c.id))
      }
      setFilteredFeatures(features.filter(f => f.system_component_id && matchingComponentIds.has(f.system_component_id)))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [baseId, systemIds, componentIds])

  // Initialize map
  useEffect(() => {
    if (!apiReady || !mapContainer.current) return

    const rwy = runways[0]
    const centerLat = rwy ? ((rwy.end1_latitude ?? 0) + (rwy.end2_latitude ?? 0)) / 2 : 42.6139
    const centerLng = rwy ? ((rwy.end1_longitude ?? 0) + (rwy.end2_longitude ?? 0)) / 2 : -82.8369

    const gmap = new google.maps.Map(mapContainer.current, {
      ...GOOGLE_MAP_OPTIONS,
      center: { lat: centerLat, lng: centerLng },
      zoom: 14,
      zoomControlOptions: { position: google.maps.ControlPosition.TOP_RIGHT },
    })

    applyMapProvider(gmap, mapProvider)

    mapRef.current = gmap
    setMapLoaded(true)

    return () => {
      markersRef.current.forEach(m => m.setMap(null))
      markersRef.current = []
      mapRef.current = null
      setMapLoaded(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiReady, installationId, mapProvider])

  // Render features as markers
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return

    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    if (filteredFeatures.length === 0) return

    const selectedSet = new Set(selectedFeatureIds)
    const bounds = new google.maps.LatLngBounds()

    for (const f of filteredFeatures) {
      const isSelected = selectedSet.has(f.id)
      const isInop = f.status === 'inoperative'

      const marker = new google.maps.Marker({
        position: { lat: f.latitude, lng: f.longitude },
        map: mapRef.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: isSelected ? 12 : 8,
          fillColor: isSelected ? '#22D3EE' : isInop ? '#EF4444' : '#22C55E',
          fillOpacity: 1,
          strokeColor: isSelected ? '#22D3EE' : '#FFFFFF',
          strokeWeight: isSelected ? 3 : 1.5,
        },
        cursor: 'pointer',
      })

      marker.addListener('click', () => {
        const current = [...selectedRef.current]
        const idx = current.indexOf(f.id)
        if (idx >= 0) current.splice(idx, 1)
        else current.push(f.id)
        onSelectionChange(current)
        if (onSelectedFeaturesChange) {
          const newSet = new Set(current)
          onSelectedFeaturesChange(filteredRef.current.filter(feat => newSet.has(feat.id)))
        }
      })

      bounds.extend({ lat: f.latitude, lng: f.longitude })
      markersRef.current.push(marker)
    }

    if (filteredFeatures.length > 1) {
      mapRef.current.fitBounds(bounds, 40)
      const listener = mapRef.current.addListener('idle', () => {
        if ((mapRef.current?.getZoom() ?? 0) > 17) mapRef.current?.setZoom(17)
        google.maps.event.removeListener(listener)
      })
    } else if (filteredFeatures.length === 1) {
      mapRef.current.setCenter({ lat: filteredFeatures[0].latitude, lng: filteredFeatures[0].longitude })
      mapRef.current.setZoom(16)
    }
  }, [mapLoaded, filteredFeatures, selectedFeatureIds, onSelectionChange, onSelectedFeaturesChange])

  if (!hasApiKey) {
    return (
      <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-mid)', borderRadius: 10, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-2)' }}>Google Maps API Key Required</div>
      </div>
    )
  }

  const totalFiltered = filteredFeatures.length
  const selectedCount = selectedFeatureIds.length

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <div ref={mapContainer} style={{ width: '100%', aspectRatio: '3 / 4', maxHeight: '70vh', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--color-border-mid)' }} />
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', borderRadius: 10 }}>
            <div style={{ color: '#fff', fontSize: 'var(--fs-md)', fontWeight: 600 }}>Loading features...</div>
          </div>
        )}
        {!loading && mapLoaded && totalFiltered > 0 && (
          <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', background: 'rgba(4, 7, 12, 0.88)', borderRadius: 6, padding: '4px 10px', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            Tap features to mark inoperative
          </div>
        )}
        {totalFiltered > 0 && (
          <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(4, 7, 12, 0.88)', borderRadius: 6, padding: '4px 8px', fontSize: 'var(--fs-sm)', color: selectedCount > 0 ? 'var(--color-cyan-bright)' : 'var(--color-text-3)', fontWeight: 600 }}>
            {selectedCount} of {totalFiltered} feature{totalFiltered !== 1 ? 's' : ''} selected
          </div>
        )}
        {totalFiltered > 0 && (
          <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(4, 7, 12, 0.88)', borderRadius: 6, padding: '4px 8px', display: 'flex', gap: 8, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-green)', display: 'inline-block' }} />OK</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-red)', display: 'inline-block' }} />Inop</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--color-cyan-bright)', display: 'inline-block', boxSizing: 'border-box' }} />Selected</span>
          </div>
        )}
      </div>
      {!loading && totalFiltered === 0 && (
        <div style={{ textAlign: 'center', padding: 16, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>
          No infrastructure features found for the linked systems. Assign features to system components on the Visual NAVAIDs page first.
        </div>
      )}
    </div>
  )
}
