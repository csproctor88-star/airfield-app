'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import { isMapboxConfigured } from '@/lib/utils'
import { useMapRuler, RulerButton } from '@/hooks/use-map-ruler'
import { fetchTaxiways, createTaxiway, updateTaxiway, deleteTaxiway } from '@/lib/supabase/taxiways'
import {
  TAXIWAY_CRITERIA,
  getTaxiwayCriteria,
  getOFAHalfWidth,
  getClearanceHalfWidth,
  getClearanceLabel,
  getUfcCriteria,
  UFC_TAXIWAY_CRITERIA,
  type TaxiwayStandard,
  type RunwayClass,
  type ServiceBranch,
} from '@/lib/calculations/taxiway-criteria'
import type { BaseTaxiway } from '@/lib/supabase/types'

const TDG_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const

const SERVICE_LABELS: Record<ServiceBranch, string> = {
  army: 'Army',
  air_force: 'Air Force',
  navy_mc: 'Navy/MC',
}

export default function TaxiwayEditor() {
  const { installationId, runways } = useInstallation()
  const mapContainer = useRef<HTMLDivElement | null>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [mapboxReady, setMapboxReady] = useState(false)
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  // Data
  const [taxiways, setTaxiways] = useState<BaseTaxiway[]>([])
  const [loading, setLoading] = useState(true)

  // Drawing state
  const [drawing, setDrawing] = useState(false)
  const ruler = useMapRuler(map, !drawing)
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([])
  const [newDesignator, setNewDesignator] = useState('')
  const [newType, setNewType] = useState<'taxiway' | 'taxilane'>('taxiway')
  const [newStandard, setNewStandard] = useState<TaxiwayStandard>('ufc')
  const [newTdg, setNewTdg] = useState(3)
  const [newRunwayClass, setNewRunwayClass] = useState<RunwayClass>('B')
  const [newServiceBranch, setNewServiceBranch] = useState<ServiceBranch>('air_force')
  const [newWidthFt, setNewWidthFt] = useState('')

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDesignator, setEditDesignator] = useState('')
  const [editType, setEditType] = useState<'taxiway' | 'taxilane'>('taxiway')
  const [editStandard, setEditStandard] = useState<TaxiwayStandard>('ufc')
  const [editTdg, setEditTdg] = useState(3)
  const [editRunwayClass, setEditRunwayClass] = useState<RunwayClass>('B')
  const [editServiceBranch, setEditServiceBranch] = useState<ServiceBranch>('air_force')
  const [editWidthFt, setEditWidthFt] = useState('')

  // Import state
  const [importOpen, setImportOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Visibility
  const [showOFA, setShowOFA] = useState(true)

  // ── Load taxiways ──
  const loadTaxiways = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    const data = await fetchTaxiways(installationId)
    setTaxiways(data)
    setLoading(false)
  }, [installationId])

  useEffect(() => { loadTaxiways() }, [loadTaxiways])

  // ── Mapbox init ──
  useEffect(() => {
    if (typeof window !== 'undefined' && isMapboxConfigured()) setMapboxReady(true)
  }, [])

  useEffect(() => {
    if (!mapContainer.current || !mapboxReady || !token || !installationId) return

    mapboxgl.accessToken = token

    // Center on first runway midpoint or default
    let center: [number, number] = [-98.5, 39.8]
    let zoom = 4
    const rwy = runways[0]
    if (rwy?.end1_latitude && rwy?.end1_longitude && rwy?.end2_latitude && rwy?.end2_longitude) {
      center = [
        (rwy.end1_longitude + rwy.end2_longitude) / 2,
        (rwy.end1_latitude + rwy.end2_latitude) / 2,
      ]
      zoom = 14
    }

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-v9',
      center,
      zoom,
      attributionControl: false,
    })

    m.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right')
    map.current = m

    m.on('load', () => {
      // Sources will be updated when taxiways data changes
      renderLayers(m)
    })

    return () => { m.remove(); map.current = null }
  }, [mapboxReady, token, installationId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helper: get clearance half-width for any taxiway ──
  const getHalfWidth = (tw: BaseTaxiway): number => {
    return getClearanceHalfWidth({
      standard: (tw.standard || 'faa') as TaxiwayStandard,
      tdg: tw.tdg,
      taxiwayType: tw.taxiway_type as 'taxiway' | 'taxilane',
      runwayClass: tw.runway_class as RunwayClass | null,
      serviceBranch: tw.service_branch as ServiceBranch | null,
    })
  }

  // ── Render taxiway layers whenever data changes ──
  const renderLayers = useCallback((m: mapboxgl.Map) => {
    // Clean up existing layers/sources
    const cleanIds = [
      'taxiway-lines', 'taxiway-labels', 'taxiway-vertices',
      'taxiway-ofa-fills', 'taxiway-ofa-outlines',
      'drawing-line', 'drawing-vertices',
    ]
    for (const id of cleanIds) {
      if (m.getLayer(id)) m.removeLayer(id)
    }
    const cleanSrcs = ['taxiway-src', 'taxiway-ofa-src', 'drawing-src']
    for (const id of cleanSrcs) {
      if (m.getSource(id)) m.removeSource(id)
    }
  }, [])

  // Update map when taxiways or drawing state changes
  useEffect(() => {
    const m = map.current
    if (!m || !m.isStyleLoaded()) return

    // Clean previous layers
    renderLayers(m)

    // ── Taxiway centerlines GeoJSON ──
    const lineFeatures: GeoJSON.Feature[] = taxiways.map(tw => ({
      type: 'Feature' as const,
      properties: { id: tw.id, designator: tw.designator, tdg: tw.tdg, type: tw.taxiway_type, standard: tw.standard },
      geometry: {
        type: 'LineString' as const,
        coordinates: (tw.centerline_coords as [number, number][]) || [],
      },
    })).filter(f => (f.geometry.coordinates as number[][]).length >= 2)

    // ── Clearance buffer polygons (OFA for FAA, Clearance Line for UFC) ──
    const ofaFeatures: GeoJSON.Feature[] = taxiways.flatMap(tw => {
      const coords = (tw.centerline_coords as [number, number][]) || []
      if (coords.length < 2) return []
      const halfWidth = getHalfWidth(tw)
      return [buildBufferPolygon(coords, halfWidth, tw.id, tw.designator)]
    })

    // ── Drawing line ──
    const drawFeatures: GeoJSON.Feature[] = []
    if (drawingPoints.length >= 1) {
      drawFeatures.push({
        type: 'Feature' as const,
        properties: {},
        geometry: drawingPoints.length >= 2
          ? { type: 'LineString' as const, coordinates: drawingPoints }
          : { type: 'Point' as const, coordinates: drawingPoints[0] },
      })
    }

    // Add sources
    m.addSource('taxiway-src', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: lineFeatures },
    })

    m.addSource('taxiway-ofa-src', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: ofaFeatures },
    })

    m.addSource('drawing-src', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: drawFeatures },
    })

    // ── OFA/Clearance fill + outline ──
    if (showOFA) {
      m.addLayer({
        id: 'taxiway-ofa-fills',
        type: 'fill',
        source: 'taxiway-ofa-src',
        paint: { 'fill-color': '#F59E0B', 'fill-opacity': 0.12 },
      })
      m.addLayer({
        id: 'taxiway-ofa-outlines',
        type: 'line',
        source: 'taxiway-ofa-src',
        paint: { 'line-color': '#F59E0B', 'line-width': 1, 'line-dasharray': [4, 4] },
      })
    }

    // ── Taxiway centerlines ──
    m.addLayer({
      id: 'taxiway-lines',
      type: 'line',
      source: 'taxiway-src',
      paint: {
        'line-color': '#22D3EE',
        'line-width': 3,
      },
    })

    // ── Taxiway labels ──
    m.addLayer({
      id: 'taxiway-labels',
      type: 'symbol',
      source: 'taxiway-src',
      layout: {
        'symbol-placement': 'line-center',
        'text-field': ['get', 'designator'],
        'text-size': 13,
        'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#22D3EE',
        'text-halo-color': '#000',
        'text-halo-width': 1.5,
      },
    })

    // ── Vertex dots for taxiway centerlines ──
    const vertexFeatures: GeoJSON.Feature[] = taxiways.flatMap(tw => {
      const coords = (tw.centerline_coords as [number, number][]) || []
      return coords.map(c => ({
        type: 'Feature' as const,
        properties: { id: tw.id },
        geometry: { type: 'Point' as const, coordinates: c },
      }))
    })
    if (m.getSource('taxiway-vertex-src')) {
      if (m.getLayer('taxiway-vertices')) m.removeLayer('taxiway-vertices')
      m.removeSource('taxiway-vertex-src')
    }
    m.addSource('taxiway-vertex-src', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: vertexFeatures },
    })
    m.addLayer({
      id: 'taxiway-vertices',
      type: 'circle',
      source: 'taxiway-vertex-src',
      paint: {
        'circle-radius': 4,
        'circle-color': '#22D3EE',
        'circle-stroke-color': '#000',
        'circle-stroke-width': 1,
      },
    })

    // ── Drawing preview ──
    if (drawingPoints.length >= 2) {
      m.addLayer({
        id: 'drawing-line',
        type: 'line',
        source: 'drawing-src',
        paint: { 'line-color': '#4ADE80', 'line-width': 3, 'line-dasharray': [4, 2] },
      })
    }
    if (drawingPoints.length >= 1) {
      // Drawing vertices as separate source for all points
      if (m.getSource('drawing-vertex-src')) {
        if (m.getLayer('drawing-vertices')) m.removeLayer('drawing-vertices')
        m.removeSource('drawing-vertex-src')
      }
      m.addSource('drawing-vertex-src', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: drawingPoints.map(c => ({
            type: 'Feature' as const,
            properties: {},
            geometry: { type: 'Point' as const, coordinates: c },
          })),
        },
      })
      m.addLayer({
        id: 'drawing-vertices',
        type: 'circle',
        source: 'drawing-vertex-src',
        paint: {
          'circle-radius': 6,
          'circle-color': '#4ADE80',
          'circle-stroke-color': '#FFF',
          'circle-stroke-width': 2,
        },
      })
    }

  }, [taxiways, drawingPoints, showOFA, renderLayers]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Map click handler for drawing ──
  useEffect(() => {
    const m = map.current
    if (!m) return

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      if (!drawing) return
      const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat]
      setDrawingPoints(prev => [...prev, pt])
    }

    m.on('click', handleClick)
    return () => { m.off('click', handleClick) }
  }, [drawing])

  // ── Change cursor in drawing mode ──
  useEffect(() => {
    const m = map.current
    if (!m) return
    m.getCanvas().style.cursor = drawing ? 'crosshair' : ''
  }, [drawing])

  // ── Save new taxiway ──
  const handleSave = async () => {
    if (!installationId || !newDesignator.trim() || drawingPoints.length < 2) return

    const result = await createTaxiway(installationId, {
      designator: newDesignator.trim(),
      taxiway_type: newType,
      tdg: newStandard === 'faa' ? newTdg : null,
      width_ft: newWidthFt ? parseFloat(newWidthFt) : null,
      centerline_coords: drawingPoints,
      standard: newStandard,
      runway_class: newStandard === 'ufc' ? newRunwayClass : null,
      service_branch: newStandard === 'ufc' ? newServiceBranch : null,
    })

    if (result) {
      toast.success(`Taxiway ${newDesignator.trim()} created`)
      setTaxiways(prev => [...prev, result])
      cancelDrawing()
    } else {
      toast.error('Failed to save taxiway')
    }
  }

  const cancelDrawing = () => {
    setDrawing(false)
    setDrawingPoints([])
    setNewDesignator('')
    setNewType('taxiway')
    setNewTdg(3)
    setNewWidthFt('')
  }

  const undoLastPoint = () => {
    setDrawingPoints(prev => prev.slice(0, -1))
  }

  // ── Edit taxiway ──
  const startEdit = (tw: BaseTaxiway) => {
    setEditingId(tw.id)
    setEditDesignator(tw.designator)
    setEditType(tw.taxiway_type as 'taxiway' | 'taxilane')
    setEditStandard((tw.standard || 'faa') as TaxiwayStandard)
    setEditTdg(tw.tdg ?? 3)
    setEditRunwayClass((tw.runway_class || 'B') as RunwayClass)
    setEditServiceBranch((tw.service_branch || 'air_force') as ServiceBranch)
    setEditWidthFt(tw.width_ft?.toString() ?? '')
  }

  const saveEdit = async () => {
    if (!editingId) return
    const result = await updateTaxiway(editingId, {
      designator: editDesignator.trim(),
      taxiway_type: editType,
      standard: editStandard,
      tdg: editStandard === 'faa' ? editTdg : null,
      runway_class: editStandard === 'ufc' ? editRunwayClass : null,
      service_branch: editStandard === 'ufc' ? editServiceBranch : null,
      width_ft: editWidthFt ? parseFloat(editWidthFt) : null,
    })
    if (result) {
      toast.success(`Taxiway ${editDesignator} updated`)
      setTaxiways(prev => prev.map(t => t.id === editingId ? result : t))
      setEditingId(null)
    } else {
      toast.error('Failed to update taxiway')
    }
  }

  // ── Delete taxiway ──
  const handleDelete = async (tw: BaseTaxiway) => {
    if (!confirm(`Delete taxiway ${tw.designator}? This cannot be undone.`)) return
    const ok = await deleteTaxiway(tw.id)
    if (ok) {
      toast.success(`Taxiway ${tw.designator} deleted`)
      setTaxiways(prev => prev.filter(t => t.id !== tw.id))
    } else {
      toast.error('Failed to delete taxiway')
    }
  }

  // ── Fly to taxiway ──
  const flyToTaxiway = (tw: BaseTaxiway) => {
    const m = map.current
    const coords = (tw.centerline_coords as [number, number][]) || []
    if (!m || coords.length === 0) return
    const mid = coords[Math.floor(coords.length / 2)]
    m.flyTo({ center: mid, zoom: 15 })
  }

  // ── Import KML/GeoJSON ──
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !installationId) return

    try {
      const text = await file.text()
      const ext = file.name.split('.').pop()?.toLowerCase()
      const lines: [number, number][][] = []

      if (ext === 'geojson' || ext === 'json') {
        const gj = JSON.parse(text) as GeoJSON.FeatureCollection | GeoJSON.Feature | GeoJSON.Geometry
        const features = 'features' in gj ? gj.features : [gj as GeoJSON.Feature]
        for (const f of features) {
          const geom = 'geometry' in f ? f.geometry : f
          if (geom.type === 'LineString') {
            lines.push((geom as GeoJSON.LineString).coordinates.map(c => [c[0], c[1]]))
          } else if (geom.type === 'MultiLineString') {
            for (const line of (geom as GeoJSON.MultiLineString).coordinates) {
              lines.push(line.map(c => [c[0], c[1]]))
            }
          } else if (geom.type === 'Polygon') {
            lines.push((geom as GeoJSON.Polygon).coordinates[0].map(c => [c[0], c[1]]))
          }
        }
      } else {
        // KML parsing
        const parser = new DOMParser()
        const doc = parser.parseFromString(text, 'text/xml')
        const placemarks = doc.getElementsByTagName('Placemark')

        for (let i = 0; i < placemarks.length; i++) {
          const coordEls = placemarks[i].getElementsByTagName('coordinates')
          for (let j = 0; j < coordEls.length; j++) {
            const raw = coordEls[j].textContent?.trim()
            if (!raw) continue
            const pts = raw.split(/\s+/).map(s => {
              const parts = s.split(',')
              if (parts.length < 2) return null
              const lng = parseFloat(parts[0])
              const lat = parseFloat(parts[1])
              if (isNaN(lng) || isNaN(lat)) return null
              return [lng, lat] as [number, number]
            }).filter((p): p is [number, number] => p !== null)

            if (pts.length >= 2) {
              lines.push(pts)
            }
          }
        }
      }

      if (lines.length === 0) {
        toast.error('No line features found in file')
        return
      }

      // Create a taxiway for each line using current standard settings
      let created = 0
      for (let i = 0; i < lines.length; i++) {
        const designator = `Import-${i + 1}`
        const result = await createTaxiway(installationId, {
          designator,
          taxiway_type: 'taxiway',
          standard: newStandard,
          tdg: newStandard === 'faa' ? newTdg : null,
          runway_class: newStandard === 'ufc' ? newRunwayClass : null,
          service_branch: newStandard === 'ufc' ? newServiceBranch : null,
          centerline_coords: lines[i],
        })
        if (result) {
          setTaxiways(prev => [...prev, result])
          created++
        }
      }

      if (created > 0) {
        toast.success(`Imported ${created} taxiway centerline${created > 1 ? 's' : ''}`)
        if (lines[0].length > 0) {
          const mid = lines[0][Math.floor(lines[0].length / 2)]
          map.current?.flyTo({ center: mid, zoom: 15 })
        }
      } else {
        toast.error('Failed to import taxiways')
      }

      setImportOpen(false)
    } catch {
      toast.error('Failed to parse import file')
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Helpers ──

  /** Get clearance info string for a taxiway */
  const getInfoString = (tw: BaseTaxiway): string => {
    const std = (tw.standard || 'faa') as TaxiwayStandard
    if (std === 'ufc') {
      const rc = (tw.runway_class || 'A') as RunwayClass
      const sb = (tw.service_branch || 'air_force') as ServiceBranch
      const crit = getUfcCriteria(rc, sb)
      return `${crit.label} | CL: ${crit.clearanceLineFt}ft`
    }
    const tdg = tw.tdg ?? 3
    const criteria = getTaxiwayCriteria(tdg)
    return `TDG-${tdg} | OFA: ${getOFAHalfWidth(tdg, tw.taxiway_type as 'taxiway' | 'taxilane') * 2}ft | Safety: ${criteria.safetyAreaHalfWidth * 2}ft`
  }

  /** Get the current new-taxiway clearance half-width for display */
  const getNewClearanceHalf = (): number => {
    return getClearanceHalfWidth({
      standard: newStandard,
      tdg: newTdg,
      taxiwayType: newType,
      runwayClass: newRunwayClass,
      serviceBranch: newServiceBranch,
    })
  }

  const fieldStyle: React.CSSProperties = {
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-inset)',
    color: 'var(--color-text-1)',
    fontSize: 'var(--fs-sm)',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  }

  const lblStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 'var(--fs-xs)',
    fontWeight: 600,
    color: 'var(--color-text-3)',
    letterSpacing: '0.06em',
    marginBottom: 2,
  }

  // ── Standard toggle component ──
  const StandardToggle = ({
    value, onChange, style: wrapStyle,
  }: {
    value: TaxiwayStandard
    onChange: (v: TaxiwayStandard) => void
    style?: React.CSSProperties
  }) => (
    <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border)', ...wrapStyle }}>
      {(['ufc', 'faa'] as const).map(s => (
        <button
          key={s}
          onClick={() => onChange(s)}
          style={{
            flex: 1, padding: '4px 10px', border: 'none',
            background: value === s ? (s === 'ufc' ? '#0369A122' : '#F59E0B22') : 'transparent',
            color: value === s ? (s === 'ufc' ? 'var(--color-accent-secondary)' : '#F59E0B') : 'var(--color-text-3)',
            cursor: 'pointer', fontSize: 'var(--fs-xs)', fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          {s === 'ufc' ? 'UFC 3-260-01' : 'FAA AC 150'}
        </button>
      ))}
    </div>
  )

  // ── Criteria fields for the selected standard ──
  const CriteriaFields = ({
    standard, tdg, setTdg, runwayClass, setRunwayClass, serviceBranch, setServiceBranch, type,
  }: {
    standard: TaxiwayStandard
    tdg: number; setTdg: (v: number) => void
    runwayClass: RunwayClass; setRunwayClass: (v: RunwayClass) => void
    serviceBranch: ServiceBranch; setServiceBranch: (v: ServiceBranch) => void
    type: 'taxiway' | 'taxilane'
  }) => {
    if (standard === 'ufc') {
      const crit = getUfcCriteria(runwayClass, serviceBranch)
      return (
        <>
          <div>
            <label style={lblStyle}>Runway Class</label>
            <select value={runwayClass} onChange={e => setRunwayClass(e.target.value as RunwayClass)} style={fieldStyle}>
              <option value="A">Class A</option>
              <option value="B">Class B</option>
            </select>
          </div>
          <div>
            <label style={lblStyle}>Service</label>
            <select value={serviceBranch} onChange={e => setServiceBranch(e.target.value as ServiceBranch)} style={fieldStyle}>
              <option value="army">Army</option>
              <option value="air_force">Air Force</option>
              <option value="navy_mc">Navy/MC</option>
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1', fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: -4 }}>
            Clearance Line: {crit.clearanceLineFt}ft | Pavement: {crit.pavementWidthFt}ft | Shoulder: {crit.shoulderWidthFt}ft
            <span style={{ color: 'var(--color-text-3)', opacity: 0.6, marginLeft: 6 }}>
              (UFC 3-260-01, Table 5-1, Item 10)
            </span>
          </div>
        </>
      )
    }
    // FAA
    const criteria = getTaxiwayCriteria(tdg)
    return (
      <>
        <div>
          <label style={lblStyle}>TDG</label>
          <select value={tdg} onChange={e => setTdg(parseInt(e.target.value))} style={fieldStyle}>
            {TDG_OPTIONS.map(t => (
              <option key={t} value={t}>TDG-{t} — {TAXIWAY_CRITERIA[t].adgRange}</option>
            ))}
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1', fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: -4 }}>
          OFA: {getOFAHalfWidth(tdg, type) * 2}ft | Safety: {criteria.safetyAreaHalfWidth * 2}ft | {criteria.adgRange}
          <span style={{ color: 'var(--color-text-3)', opacity: 0.6, marginLeft: 6 }}>
            (FAA AC 150/5300-13A, Table 4-1)
          </span>
        </div>
      </>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)', margin: 0 }}>
          Taxiway Centerlines
        </h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setShowOFA(!showOFA)}
            style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)',
              background: showOFA ? 'rgba(245,158,11,0.15)' : 'var(--color-bg-inset)',
              color: showOFA ? '#F59E0B' : 'var(--color-text-3)',
              fontSize: 'var(--fs-xs)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Clearance
          </button>
          <button
            onClick={() => setImportOpen(!importOpen)}
            disabled={drawing}
            style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)',
              background: 'var(--color-bg-inset)',
              color: 'var(--color-accent)', fontSize: 'var(--fs-xs)', fontWeight: 600,
              cursor: drawing ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              opacity: drawing ? 0.5 : 1,
            }}
          >
            Import KML/GeoJSON
          </button>
        </div>
      </div>

      <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 12 }}>
        Draw taxiway centerlines on the map for obstruction evaluation.
        Supports UFC 3-260-01 (military) and FAA AC 150/5300-13A (civil/joint-use) clearance standards.
      </p>

      {/* Import panel */}
      {importOpen && (
        <div style={{
          padding: 12, background: 'var(--color-bg-inset)', borderRadius: 8,
          marginBottom: 12, border: '1px solid var(--color-border)',
        }}>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 8 }}>
            Import Taxiway Centerlines
          </div>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 8 }}>
            Upload a KML or GeoJSON file containing LineString features. Each line will be imported as a separate taxiway centerline.
            You can rename and set the standard after import.
          </p>
          <div style={{ marginBottom: 8 }}>
            <StandardToggle value={newStandard} onChange={setNewStandard} style={{ maxWidth: 280 }} />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".kml,.kmz,.geojson,.json"
            onChange={handleImportFile}
            style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}
          />
          <button
            onClick={() => setImportOpen(false)}
            style={{
              marginLeft: 8, padding: '4px 10px', borderRadius: 6,
              border: '1px solid var(--color-border)', background: 'none',
              color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Map */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <div
          ref={mapContainer}
          style={{
            width: '100%',
            height: 400,
            borderRadius: 10,
            border: drawing ? '2px solid #4ADE80' : '1px solid var(--color-border)',
            overflow: 'hidden',
          }}
        />
        <RulerButton
          active={ruler.active}
          toggle={ruler.toggle}
          clear={ruler.clear}
          totalFt={ruler.totalFt}
          points={ruler.points}
          segments={ruler.segments}
          style={{ position: 'absolute', bottom: 12, left: 10, zIndex: 5 }}
        />
      </div>

      {/* Drawing mode controls */}
      {drawing && (
        <div style={{
          padding: 12, background: 'rgba(74,222,128,0.08)', borderRadius: 8,
          border: '1px solid rgba(74,222,128,0.3)', marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: '#4ADE80' }}>
              Drawing Mode — Click the map to place centerline points
            </div>
            <StandardToggle value={newStandard} onChange={setNewStandard} style={{ maxWidth: 240 }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 4 }}>
            <div>
              <label style={lblStyle}>Designator</label>
              <input
                value={newDesignator}
                onChange={e => setNewDesignator(e.target.value)}
                placeholder="A"
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={lblStyle}>Type</label>
              <select value={newType} onChange={e => setNewType(e.target.value as any)} style={fieldStyle}>
                <option value="taxiway">Taxiway</option>
                <option value="taxilane">Taxilane</option>
              </select>
            </div>
            <CriteriaFields
              standard={newStandard}
              tdg={newTdg} setTdg={setNewTdg}
              runwayClass={newRunwayClass} setRunwayClass={setNewRunwayClass}
              serviceBranch={newServiceBranch} setServiceBranch={setNewServiceBranch}
              type={newType}
            />
            <div>
              <label style={lblStyle}>Width (ft)</label>
              <input
                type="number"
                value={newWidthFt}
                onChange={e => setNewWidthFt(e.target.value)}
                placeholder="auto"
                style={fieldStyle}
              />
            </div>
          </div>

          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 8 }}>
            Points placed: {drawingPoints.length} | Clearance envelope: {getNewClearanceHalf() * 2} ft wide
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSave}
              disabled={drawingPoints.length < 2 || !newDesignator.trim()}
              style={{
                padding: '8px 16px', borderRadius: 8, border: 'none',
                background: drawingPoints.length >= 2 && newDesignator.trim() ? 'linear-gradient(135deg, #059669, #10B981)' : 'var(--color-bg-inset)',
                color: drawingPoints.length >= 2 && newDesignator.trim() ? '#fff' : 'var(--color-text-3)',
                fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: drawingPoints.length >= 2 && newDesignator.trim() ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              Save Taxiway ({drawingPoints.length} pts)
            </button>
            <button
              onClick={undoLastPoint}
              disabled={drawingPoints.length === 0}
              style={{
                padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)',
                background: 'var(--color-bg-inset)', color: 'var(--color-text-2)',
                fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: drawingPoints.length > 0 ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit', opacity: drawingPoints.length > 0 ? 1 : 0.5,
              }}
            >
              Undo Point
            </button>
            <button
              onClick={cancelDrawing}
              style={{
                padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)',
                background: 'var(--color-bg-inset)', color: 'var(--color-danger)',
                fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Taxiway list */}
      {loading ? (
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>Loading taxiways...</p>
      ) : taxiways.length === 0 && !drawing ? (
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)', marginBottom: 12 }}>
          No taxiway centerlines configured yet.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {taxiways.map(tw => {
            const coords = (tw.centerline_coords as [number, number][]) || []
            const isEditing = editingId === tw.id
            const std = (tw.standard || 'faa') as TaxiwayStandard

            if (isEditing) {
              return (
                <div key={tw.id} style={{
                  padding: 10, background: 'var(--color-bg-inset)', borderRadius: 8,
                  border: '1px solid var(--color-accent)',
                }}>
                  <div style={{ marginBottom: 8 }}>
                    <StandardToggle value={editStandard} onChange={setEditStandard} style={{ maxWidth: 280 }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={lblStyle}>Designator</label>
                      <input value={editDesignator} onChange={e => setEditDesignator(e.target.value)} style={fieldStyle} />
                    </div>
                    <div>
                      <label style={lblStyle}>Type</label>
                      <select value={editType} onChange={e => setEditType(e.target.value as any)} style={fieldStyle}>
                        <option value="taxiway">Taxiway</option>
                        <option value="taxilane">Taxilane</option>
                      </select>
                    </div>
                    <CriteriaFields
                      standard={editStandard}
                      tdg={editTdg} setTdg={setEditTdg}
                      runwayClass={editRunwayClass} setRunwayClass={setEditRunwayClass}
                      serviceBranch={editServiceBranch} setServiceBranch={setEditServiceBranch}
                      type={editType}
                    />
                    <div>
                      <label style={lblStyle}>Width (ft)</label>
                      <input type="number" value={editWidthFt} onChange={e => setEditWidthFt(e.target.value)} style={fieldStyle} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={saveEdit} style={{
                      padding: '6px 12px', borderRadius: 6, border: 'none',
                      background: 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
                      color: '#fff', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{
                      padding: '6px 12px', borderRadius: 6, border: '1px solid var(--color-border)',
                      background: 'none', color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit',
                    }}>Cancel</button>
                  </div>
                </div>
              )
            }

            return (
              <div key={tw.id} style={{
                padding: 10, background: 'var(--color-bg-inset)', borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}>
                <div
                  style={{ flex: 1, cursor: 'pointer' }}
                  onClick={() => flyToTaxiway(tw)}
                >
                  <div style={{ fontWeight: 700, fontSize: 'var(--fs-md)', color: 'var(--color-text-1)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    TWY {tw.designator}
                    <span style={{
                      fontSize: 9, padding: '1px 5px', borderRadius: 3, fontWeight: 600,
                      background: std === 'ufc' ? '#0369A122' : '#F59E0B22',
                      color: std === 'ufc' ? 'var(--color-accent-secondary)' : '#F59E0B',
                    }}>
                      {std === 'ufc' ? 'UFC' : 'FAA'}
                    </span>
                    <span style={{ fontWeight: 400, fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
                      {tw.taxiway_type === 'taxilane' ? 'Taxilane' : 'Taxiway'} | {coords.length} pts
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
                    {getInfoString(tw)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => startEdit(tw)} style={{
                    background: 'none', border: 'none', color: 'var(--color-accent)',
                    cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 600, padding: '4px 8px',
                  }}>Edit</button>
                  <button onClick={() => handleDelete(tw)} style={{
                    background: 'none', border: 'none', color: 'var(--color-danger)',
                    cursor: 'pointer', fontSize: 'var(--fs-xl)', padding: '0 4px',
                  }}>&times;</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add taxiway button */}
      {!drawing && (
        <button
          onClick={() => setDrawing(true)}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 8,
            border: '1px dashed var(--color-border)', background: 'none',
            color: 'var(--color-accent)', cursor: 'pointer',
            fontSize: 'var(--fs-md)', fontWeight: 600, fontFamily: 'inherit',
          }}
        >
          + Draw Taxiway Centerline
        </button>
      )}

      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 8 }}>
        <strong>UFC 3-260-01</strong> (military): Table 5-1, Item 10 — Taxiway Clearance Line by runway class and service branch.
        <br />
        <strong>FAA AC 150/5300-13A</strong> (civil/joint-use): Table 4-1 — OFA and Safety Area by Taxiway Design Group (TDG).
        <br />
        Taxilanes have narrower clearance requirements than taxiways.
      </p>
    </div>
  )
}

/**
 * Build a buffer polygon around a polyline (simplified: offset each segment left/right).
 * This produces a reasonable clearance envelope visualization without a full geometric buffering library.
 */
function buildBufferPolygon(
  coords: [number, number][],
  halfWidthFt: number,
  id: string,
  designator: string,
): GeoJSON.Feature {
  if (coords.length < 2) {
    return {
      type: 'Feature',
      properties: { id, designator },
      geometry: { type: 'Polygon', coordinates: [[]] },
    }
  }

  // Convert halfWidthFt to approximate degrees
  const midLat = coords.reduce((s, c) => s + c[1], 0) / coords.length
  const ftPerDegLat = 364000
  const ftPerDegLon = ftPerDegLat * Math.cos(midLat * Math.PI / 180)
  const dLat = halfWidthFt / ftPerDegLat
  const dLon = halfWidthFt / ftPerDegLon

  // Build left and right offset lines
  const leftSide: [number, number][] = []
  const rightSide: [number, number][] = []

  for (let i = 0; i < coords.length; i++) {
    let dx = 0, dy = 0
    if (i < coords.length - 1) {
      dx += coords[i + 1][0] - coords[i][0]
      dy += coords[i + 1][1] - coords[i][1]
    }
    if (i > 0) {
      dx += coords[i][0] - coords[i - 1][0]
      dy += coords[i][1] - coords[i - 1][1]
    }

    const len = Math.sqrt(dx * dx + dy * dy)
    if (len === 0) {
      leftSide.push(coords[i])
      rightSide.push(coords[i])
      continue
    }

    const nx = -dy / len
    const ny = dx / len

    leftSide.push([
      coords[i][0] + nx * dLon,
      coords[i][1] + ny * dLat,
    ])
    rightSide.push([
      coords[i][0] - nx * dLon,
      coords[i][1] - ny * dLat,
    ])
  }

  const ring = [...leftSide, ...rightSide.reverse(), leftSide[0]]

  return {
    type: 'Feature',
    properties: { id, designator },
    geometry: { type: 'Polygon', coordinates: [ring] },
  }
}
