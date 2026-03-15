'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import { isMapboxConfigured } from '@/lib/utils'
import { useMapRuler, RulerButton } from '@/hooks/use-map-ruler'
import { fetchTaxiways, createTaxiway, updateTaxiway, deleteTaxiway } from '@/lib/supabase/taxiways'
import { TAXIWAY_CRITERIA, TAXILANE_CRITERIA, getTaxiwayCriteria, getOFAHalfWidth } from '@/lib/calculations/taxiway-criteria'
import type { BaseTaxiway } from '@/lib/supabase/types'

const TDG_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const

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
  const [newTdg, setNewTdg] = useState(3)
  const [newWidthFt, setNewWidthFt] = useState('')

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDesignator, setEditDesignator] = useState('')
  const [editType, setEditType] = useState<'taxiway' | 'taxilane'>('taxiway')
  const [editTdg, setEditTdg] = useState(3)
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
      properties: { id: tw.id, designator: tw.designator, tdg: tw.tdg, type: tw.taxiway_type },
      geometry: {
        type: 'LineString' as const,
        coordinates: (tw.centerline_coords as [number, number][]) || [],
      },
    })).filter(f => (f.geometry.coordinates as number[][]).length >= 2)

    // ── OFA buffer polygons ──
    const ofaFeatures: GeoJSON.Feature[] = taxiways.flatMap(tw => {
      const coords = (tw.centerline_coords as [number, number][]) || []
      if (coords.length < 2) return []
      const halfWidth = getOFAHalfWidth(tw.tdg, tw.taxiway_type as 'taxiway' | 'taxilane')
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

    // ── OFA fill + outline ──
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

  }, [taxiways, drawingPoints, showOFA, renderLayers])

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
      tdg: newTdg,
      width_ft: newWidthFt ? parseFloat(newWidthFt) : null,
      centerline_coords: drawingPoints,
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
    setEditTdg(tw.tdg)
    setEditWidthFt(tw.width_ft?.toString() ?? '')
  }

  const saveEdit = async () => {
    if (!editingId) return
    const result = await updateTaxiway(editingId, {
      designator: editDesignator.trim(),
      taxiway_type: editType,
      tdg: editTdg,
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
            // Use outer ring as a line
            lines.push((geom as GeoJSON.Polygon).coordinates[0].map(c => [c[0], c[1]]))
          }
        }
      } else {
        // KML parsing
        const parser = new DOMParser()
        const doc = parser.parseFromString(text, 'text/xml')
        const placemarks = doc.getElementsByTagName('Placemark')

        for (let i = 0; i < placemarks.length; i++) {
          const name = placemarks[i].getElementsByTagName('name')[0]?.textContent || ''
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

      // Create a taxiway for each line
      let created = 0
      for (let i = 0; i < lines.length; i++) {
        const designator = lines.length === 1 ? `Import-${i + 1}` : `Import-${i + 1}`
        const result = await createTaxiway(installationId, {
          designator,
          taxiway_type: 'taxiway',
          tdg: 3,
          centerline_coords: lines[i],
        })
        if (result) {
          setTaxiways(prev => [...prev, result])
          created++
        }
      }

      if (created > 0) {
        toast.success(`Imported ${created} taxiway centerline${created > 1 ? 's' : ''}`)
        // Fly to first imported line
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

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
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

  const criteria = getTaxiwayCriteria(drawing ? newTdg : 3)

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
            OFA
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
        Draw taxiway centerlines on the map for UFC 3-260-01 obstruction evaluation.
        Each taxiway&apos;s Taxiway Design Group (TDG) determines OFA and safety area widths.
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
            You can rename and set the TDG after import.
          </p>
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
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: '#4ADE80', marginBottom: 8 }}>
            Drawing Mode — Click the map to place centerline points
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
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
            <div>
              <label style={lblStyle}>TDG</label>
              <select value={newTdg} onChange={e => setNewTdg(parseInt(e.target.value))} style={fieldStyle}>
                {TDG_OPTIONS.map(t => (
                  <option key={t} value={t}>TDG-{t} — {TAXIWAY_CRITERIA[t].adgRange}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lblStyle}>Width (ft)</label>
              <input
                type="number"
                value={newWidthFt}
                onChange={e => setNewWidthFt(e.target.value)}
                placeholder={`${criteria.pavementWidth}`}
                style={fieldStyle}
              />
            </div>
          </div>

          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 8 }}>
            Points placed: {drawingPoints.length} | OFA: {getOFAHalfWidth(newTdg, newType) * 2} ft wide | Safety Area: {criteria.safetyAreaHalfWidth * 2} ft wide
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
            const tdgCriteria = getTaxiwayCriteria(tw.tdg)

            if (isEditing) {
              return (
                <div key={tw.id} style={{
                  padding: 10, background: 'var(--color-bg-inset)', borderRadius: 8,
                  border: '1px solid var(--color-accent)',
                }}>
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
                    <div>
                      <label style={lblStyle}>TDG</label>
                      <select value={editTdg} onChange={e => setEditTdg(parseInt(e.target.value))} style={fieldStyle}>
                        {TDG_OPTIONS.map(t => (
                          <option key={t} value={t}>TDG-{t}</option>
                        ))}
                      </select>
                    </div>
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
                  <div style={{ fontWeight: 700, fontSize: 'var(--fs-md)', color: 'var(--color-text-1)' }}>
                    TWY {tw.designator}
                    <span style={{ fontWeight: 400, fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginLeft: 8 }}>
                      {tw.taxiway_type === 'taxilane' ? 'Taxilane' : 'Taxiway'} | TDG-{tw.tdg} | {coords.length} pts
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
                    OFA: {getOFAHalfWidth(tw.tdg, tw.taxiway_type as 'taxiway' | 'taxilane') * 2} ft | Safety: {tdgCriteria.safetyAreaHalfWidth * 2} ft | {tdgCriteria.adgRange}
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
        Taxiway Design Group (TDG) determines the Object Free Area and Safety Area widths per UFC 3-260-01, Table 3-1.
        Taxilanes have narrower clearance requirements than taxiways.
      </p>
    </div>
  )
}

/**
 * Build a buffer polygon around a polyline (simplified: offset each segment left/right).
 * This produces a reasonable OFA visualization without a full geometric buffering library.
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
  // At typical latitudes (30-50°N), 1 degree lat ≈ 364,000 ft
  const midLat = coords.reduce((s, c) => s + c[1], 0) / coords.length
  const ftPerDegLat = 364000
  const ftPerDegLon = ftPerDegLat * Math.cos(midLat * Math.PI / 180)
  const dLat = halfWidthFt / ftPerDegLat
  const dLon = halfWidthFt / ftPerDegLon

  // Build left and right offset lines
  const leftSide: [number, number][] = []
  const rightSide: [number, number][] = []

  for (let i = 0; i < coords.length; i++) {
    // Compute perpendicular direction at this vertex
    let dx = 0, dy = 0
    if (i < coords.length - 1) {
      dx += coords[i + 1][0] - coords[i][0]
      dy += coords[i + 1][1] - coords[i][1]
    }
    if (i > 0) {
      dx += coords[i][0] - coords[i - 1][0]
      dy += coords[i][1] - coords[i - 1][1]
    }

    // Perpendicular (rotate 90° CW for right, CCW for left)
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len === 0) {
      leftSide.push(coords[i])
      rightSide.push(coords[i])
      continue
    }

    const nx = -dy / len // perpendicular unit vector (left)
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

  // Close the polygon: left forward, right reversed
  const ring = [...leftSide, ...rightSide.reverse(), leftSide[0]]

  return {
    type: 'Feature',
    properties: { id, designator },
    geometry: { type: 'Polygon', coordinates: [ring] },
  }
}
