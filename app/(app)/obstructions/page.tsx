'use client'

import { Suspense, useState, useRef, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import type { LatLon, RunwayGeometry } from '@/lib/calculations/geometry'
import { getRunwayGeometry, pointToRunwayRelation, distanceFt } from '@/lib/calculations/geometry'
import {
  evaluateObstruction,
  evaluateObstructionAllRunways,
  evaluateObstructionTaxiways,
  identifySurface,
  type ObstructionAnalysis,
  type MultiRunwayAnalysis,
  type TaxiwayGeometry,
  type TaxiwaySurfaceEvaluation,
} from '@/lib/calculations/obstructions'
import { fetchTaxiways } from '@/lib/supabase/taxiways'
import { fetchElevation } from '@/lib/calculations/geometry'
import {
  createObstructionEvaluation,
  updateObstructionEvaluation,
  fetchObstructionEvaluation,
  parsePhotoPaths,
} from '@/lib/supabase/obstructions'
import { PhotoPickerButton } from '@/components/ui/photo-picker-button'

// Dynamic import for Mapbox (client-only, no SSR)
const AirfieldMap = dynamic(
  () => import('@/components/obstructions/airfield-map'),
  { ssr: false },
)

type PointInfo = {
  point: LatLon
  groundElevMSL: number | null
  distFromCenterline: number
  distFromThreshold: number
  nearerEnd: 'end1' | 'end2'
  closestRunwayLabel: string
  closestRunwayIndex: number
  surfaceName: string
  loadingElev: boolean
  withinApproachDeparture: boolean
}

export default function ObstructionsPage() {
  return (
    <Suspense>
      <ObstructionsContent />
    </Suspense>
  )
}

function ObstructionsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { installationId, currentInstallation, runways } = useInstallation()

  // Airfield elevation from base config
  const airfieldElevMSL = currentInstallation?.elevation_msl ?? 580

  // Runway class from base runway config
  const runwayClass: 'B' | 'Army_B' = runways.length > 0
    ? ((runways[0].runway_class === 'Army_B' ? 'Army_B' : 'B') as 'B' | 'Army_B')
    : 'B'

  // Edit mode
  const editId = searchParams.get('edit')

  // Build runway geometries from ALL base runways
  const getAllRunways = useCallback((): { label: string; geometry: RunwayGeometry }[] => {
    if (runways.length > 0) {
      return runways.map((rwy) => ({
        label: rwy.runway_id ?? 'Unknown',
        geometry: getRunwayGeometry({
          end1: { latitude: rwy.end1_latitude ?? 0, longitude: rwy.end1_longitude ?? 0 },
          end2: { latitude: rwy.end2_latitude ?? 0, longitude: rwy.end2_longitude ?? 0 },
          length_ft: rwy.length_ft ?? 9000,
          width_ft: rwy.width_ft ?? 150,
          true_heading: rwy.true_heading ?? undefined,
          end1_elevation_msl: rwy.end1_elevation_msl,
          end2_elevation_msl: rwy.end2_elevation_msl,
          end1_designator: rwy.end1_designator,
          end2_designator: rwy.end2_designator,
        }),
      }))
    }
    return [{
      label: 'Default',
      geometry: getRunwayGeometry({
        end1: { latitude: 0, longitude: 0 },
        end2: { latitude: 0, longitude: 0 },
        length_ft: 9000,
        width_ft: 150,
      }),
    }]
  }, [runways])

  // Convenience: first runway geometry (for backward-compatible single-runway operations)
  const getRunway = useCallback((): RunwayGeometry => getAllRunways()[0].geometry, [getAllRunways])

  // Map / point state
  const [pointInfo, setPointInfo] = useState<PointInfo | null>(null)

  // Form state
  const [height, setHeight] = useState('')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<{ file?: File; url: string }[]>([])

  // GPS location state
  const [gpsLoading, setGpsLoading] = useState(false)
  const [flyToPoint, setFlyToPoint] = useState<LatLon | null>(null)

  // Evaluation result — supports multi-runway
  const [multiAnalysis, setMultiAnalysis] = useState<MultiRunwayAnalysis | null>(null)
  // Convenience: first runway's full analysis (for save payload backward compat)
  const analysis: ObstructionAnalysis | null = multiAnalysis?.perRunway[0]?.analysis ?? null
  const [saving, setSaving] = useState(false)
  const [showVerify, setShowVerify] = useState(false)

  // Taxiway evaluation
  const [taxiwayGeometries, setTaxiwayGeometries] = useState<TaxiwayGeometry[]>([])
  const [taxiwayResults, setTaxiwayResults] = useState<TaxiwaySurfaceEvaluation[]>([])

  // Load taxiway centerlines on mount
  useEffect(() => {
    if (!installationId) return
    fetchTaxiways(installationId).then(tws => {
      setTaxiwayGeometries(tws.map(tw => ({
        id: tw.id,
        designator: tw.designator,
        taxiwayType: tw.taxiway_type as 'taxiway' | 'taxilane',
        tdg: tw.tdg,
        centerline: ((tw.centerline_coords as [number, number][]) || []).map(c => ({ lat: c[1], lon: c[0] })),
        standard: (tw.standard || 'faa') as 'faa' | 'ufc',
        runwayClass: tw.runway_class as 'A' | 'B' | null,
        serviceBranch: tw.service_branch as 'army' | 'air_force' | 'navy_mc' | null,
      })))
    })
  }, [installationId])

  // Helper: find the closest runway to a point
  const findClosestRunway = useCallback((point: LatLon) => {
    const allRwys = getAllRunways()
    let closestIdx = 0
    let closestDist = Infinity
    for (let i = 0; i < allRwys.length; i++) {
      const rel = pointToRunwayRelation(point, allRwys[i].geometry)
      if (rel.distanceFromCenterline < closestDist) {
        closestDist = rel.distanceFromCenterline
        closestIdx = i
      }
    }
    return { index: closestIdx, ...allRwys[closestIdx] }
  }, [getAllRunways])

  // Load existing evaluation in edit mode and auto-run analysis
  useEffect(() => {
    if (!editId) return
    async function loadExisting() {
      const existing = await fetchObstructionEvaluation(editId!)
      if (!existing) {
        toast.error('Evaluation not found')
        return
      }
      const h = Number(existing.object_height_agl)
      setHeight(String(h))
      setDescription(existing.notes || existing.description || '')
      const existingPhotos = parsePhotoPaths(existing.photo_storage_path)
      if (existingPhotos.length) {
        setPhotos(existingPhotos.map((url) => ({ url })))
      }
      if (existing.latitude && existing.longitude) {
        const point: LatLon = { lat: existing.latitude, lon: existing.longitude }
        const allRwys = getAllRunways()
        const allGeometries = allRwys.map((r) => r.geometry)
        const surfaceName = identifySurface(point, allGeometries, airfieldElevMSL, runwayClass)
        const groundElev = existing.object_elevation_msl ?? airfieldElevMSL
        const closest = findClosestRunway(point)
        const relation = pointToRunwayRelation(point, closest.geometry)
        const nearerThreshold = relation.nearerEnd === 'end1' ? closest.geometry.end1 : closest.geometry.end2
        const distToThreshold = distanceFt(point, nearerThreshold)
        const withinAD = allRwys.some(({ geometry }) => {
          const a = evaluateObstruction(point, 0, null, geometry, airfieldElevMSL, runwayClass)
          return a.surfaces.some((s) => s.surfaceKey === 'approach_departure' && s.isWithinBounds)
        })
        setPointInfo({
          point,
          groundElevMSL: groundElev,
          distFromCenterline: existing.distance_from_centerline_ft ?? 0,
          distFromThreshold: distToThreshold,
          nearerEnd: relation.nearerEnd,
          closestRunwayLabel: closest.label,
          closestRunwayIndex: closest.index,
          surfaceName,
          loadingElev: false,
          withinApproachDeparture: withinAD,
        })
        // Auto-run evaluation against all runways
        if (h > 0) {
          const result = evaluateObstructionAllRunways(point, h, groundElev, allRwys, airfieldElevMSL, runwayClass)
          setMultiAnalysis(result)
          if (taxiwayGeometries.length > 0) {
            setTaxiwayResults(evaluateObstructionTaxiways(point, taxiwayGeometries))
          }
        }
      }
    }
    loadExisting()
  }, [editId])

  // Handle map click
  const handlePointSelected = useCallback(async (point: LatLon) => {
    const allRwys = getAllRunways()
    const allGeometries = allRwys.map((r) => r.geometry)
    const surfaceName = identifySurface(point, allGeometries, airfieldElevMSL, runwayClass)
    // Find closest runway for distance display
    const closest = findClosestRunway(point)
    const relation = pointToRunwayRelation(point, closest.geometry)
    const nearerThreshold = relation.nearerEnd === 'end1' ? closest.geometry.end1 : closest.geometry.end2
    const distToThreshold = distanceFt(point, nearerThreshold)
    const withinAD = allRwys.some(({ geometry }) => {
      const a = evaluateObstruction(point, 0, null, geometry, airfieldElevMSL, runwayClass)
      return a.surfaces.some((s) => s.surfaceKey === 'approach_departure' && s.isWithinBounds)
    })
    setPointInfo({
      point,
      groundElevMSL: null,
      distFromCenterline: relation.distanceFromCenterline,
      distFromThreshold: distToThreshold,
      nearerEnd: relation.nearerEnd,
      closestRunwayLabel: closest.label,
      closestRunwayIndex: closest.index,
      surfaceName,
      loadingElev: true,
      withinApproachDeparture: withinAD,
    })
    setMultiAnalysis(null)

    // Fetch real elevation
    const elev = await fetchElevation(point)
    setPointInfo((prev) =>
      prev
        ? {
            ...prev,
            groundElevMSL: elev ?? airfieldElevMSL,
            loadingElev: false,
          }
        : prev,
    )

    if (elev) {
      toast.success(`Elevation: ${elev.toFixed(0)} ft MSL`)
    } else {
      toast(`Using airfield elevation (${airfieldElevMSL} ft MSL)`, { description: 'Open-Elevation API unavailable' })
    }
  }, [getAllRunways, findClosestRunway, airfieldElevMSL, runwayClass])

  // Use device GPS to select location
  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      return
    }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point: LatLon = { lat: position.coords.latitude, lon: position.coords.longitude }
        setFlyToPoint(point)
        handlePointSelected(point)
        setGpsLoading(false)
        toast.success('Location acquired')
      },
      (error) => {
        setGpsLoading(false)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error('Location access denied. Enable location permissions and try again.')
            break
          case error.POSITION_UNAVAILABLE:
            toast.error('Location unavailable. Make sure GPS is enabled.')
            break
          case error.TIMEOUT:
            toast.error('Location request timed out. Try again.')
            break
          default:
            toast.error('Unable to get your location')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }, [handlePointSelected])

  // Run the evaluation against all runways
  const runEvaluation = () => {
    if (!pointInfo) {
      toast.error('Select a point on the map first')
      return
    }
    const h = parseFloat(height)
    if (isNaN(h) || h <= 0) {
      toast.error('Enter a valid obstruction height')
      return
    }

    const result = evaluateObstructionAllRunways(
      pointInfo.point,
      h,
      pointInfo.groundElevMSL,
      getAllRunways(),
      airfieldElevMSL,
      runwayClass,
    )
    setMultiAnalysis(result)

    // Taxiway evaluation
    const twResults = taxiwayGeometries.length > 0
      ? evaluateObstructionTaxiways(pointInfo.point, taxiwayGeometries)
      : []
    setTaxiwayResults(twResults)

    const twViolations = twResults.filter(r => r.violated)
    const totalViolations = result.violatedSurfaces.length + twViolations.length

    if (result.hasViolation || twViolations.length > 0) {
      toast.error(`VIOLATION — ${totalViolations} surface(s) penetrated`)
    } else {
      toast.success('No violations detected')
    }
  }

  // Read file as data URL via FileReader (reliable for preview)
  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  // Compress a data URL to keep it small enough for DB storage
  const compressDataUrl = (dataUrl: string, maxDim = 800, quality = 0.7): Promise<string> =>
    new Promise((resolve) => {
      const timer = setTimeout(() => {
        console.warn('compressDataUrl: timed out after 10s, using original')
        resolve(dataUrl)
      }, 10000)
      const img = document.createElement('img')
      img.onload = () => {
        clearTimeout(timer)
        try {
          let w = img.naturalWidth
          let h = img.naturalHeight
          if (w > maxDim || h > maxDim) {
            const scale = maxDim / Math.max(w, h)
            w = Math.round(w * scale)
            h = Math.round(h * scale)
          }
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            console.warn('compressDataUrl: canvas context unavailable, using original')
            resolve(dataUrl)
            return
          }
          ctx.drawImage(img, 0, 0, w, h)
          resolve(canvas.toDataURL('image/jpeg', quality))
        } catch (err) {
          console.warn('compressDataUrl: compression failed, using original', err)
          resolve(dataUrl)
        }
      }
      img.onerror = () => {
        clearTimeout(timer)
        console.warn('compressDataUrl: image load failed, using original')
        resolve(dataUrl)
      }
      img.src = dataUrl
    })

  // Handle photo — use FileReader for immediate preview
  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList?.length) return
    // Copy files before clearing input (some browsers invalidate FileList on reset)
    const fileArray = Array.from(fileList)
    e.target.value = ''
    for (const file of fileArray) {
      try {
        const dataUrl = await readFileAsDataUrl(file)
        setPhotos((prev) => [...prev, { file, url: dataUrl }])
      } catch {
        toast.error('Failed to read photo')
      }
    }
    toast.success(fileArray.length > 1 ? `${fileArray.length} photos attached` : 'Photo attached')
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  // Save to database
  const handleSave = async () => {
    if (!multiAnalysis || !analysis || !pointInfo) return
    setSaving(true)

    // Compress new photos (with File) for DB storage; keep existing URLs as-is
    let photoUrls: string[] = []
    try {
      for (const p of photos) {
        if (p.file) {
          photoUrls.push(await compressDataUrl(p.url))
        } else {
          photoUrls.push(p.url)
        }
      }
    } catch (err) {
      console.error('Photo compression failed:', err)
      // Fall back to raw data URLs for any remaining photos
      photoUrls = photos.map((p) => p.url)
    }

    // Collect surface results across all runways (tagged with runway label)
    const allSurfaceResults = multiAnalysis.perRunway.flatMap(({ runwayLabel, analysis: rwyAnalysis }) =>
      rwyAnalysis.surfaces.map((s) => ({
        surfaceKey: s.surfaceKey,
        surfaceName: s.surfaceName,
        runwayLabel,
        isWithinBounds: s.isWithinBounds,
        maxAllowableHeightAGL: s.maxAllowableHeightAGL,
        maxAllowableHeightMSL: s.maxAllowableHeightMSL,
        obstructionTopMSL: s.obstructionTopMSL,
        violated: s.violated,
        penetrationFt: s.penetrationFt,
        ufcReference: s.ufcReference,
        ufcCriteria: s.ufcCriteria,
        baselineElevation: s.baselineElevation,
        baselineLabel: s.baselineLabel,
        calculationBreakdown: s.calculationBreakdown,
      })),
    )

    const evaluationPayload = {
      object_height_agl: multiAnalysis.obstructionHeightAGL,
      object_distance_ft: pointInfo.distFromCenterline,
      distance_from_centerline_ft: pointInfo.distFromCenterline,
      object_elevation_msl: multiAnalysis.groundElevationMSL,
      obstruction_top_msl: multiAnalysis.obstructionTopMSL,
      latitude: multiAnalysis.point.lat,
      longitude: multiAnalysis.point.lon,
      description: description || null,
      photo_storage_paths: photoUrls,
      results: allSurfaceResults,
      controlling_surface: multiAnalysis.controllingSurface
        ? `${multiAnalysis.controllingSurface.surfaceName}${multiAnalysis.controllingSurface.runwayLabel ? ` (RWY ${multiAnalysis.controllingSurface.runwayLabel})` : ''}`
        : null,
      violated_surfaces: multiAnalysis.violatedSurfaces.map((s) =>
        `${s.surfaceName}${s.runwayLabel ? ` (RWY ${s.runwayLabel})` : ''}`,
      ),
      has_violation: multiAnalysis.hasViolation,
      notes: description || null,
    }

    let data, error
    if (editId) {
      ({ data, error } = await updateObstructionEvaluation(editId, evaluationPayload))
    } else {
      ({ data, error } = await createObstructionEvaluation({
        runway_class: runwayClass,
        ...evaluationPayload,
        base_id: installationId,
      }))
    }

    if (error || !data) {
      toast.error(error || 'Failed to save evaluation')
      setSaving(false)
      return
    }

    toast.success(editId ? 'Evaluation updated!' : 'Evaluation saved!')
    setSaving(false)
    router.push(`/obstructions/${data.id}`)
  }

  const surfaceAtPoint = multiAnalysis
    ? multiAnalysis.hasViolation
      ? 'violation'
      : 'No violation'
    : pointInfo?.surfaceName ?? null

  return (
    <div className="page-container" style={{ paddingBottom: 120 }}>
      {/* Header */}
      <button
        onClick={() => router.back()}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--color-cyan)',
          fontSize: 'var(--fs-md)',
          fontWeight: 600,
          cursor: 'pointer',
          padding: 0,
          marginBottom: 12,
          fontFamily: 'inherit',
        }}
      >
        ← Back
      </button>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, flex: 1 }}>
          {editId ? 'Edit Evaluation' : 'Obstruction Evaluation'}
        </div>
        <button
          onClick={() => router.push('/obstructions/history')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-accent)',
            fontSize: 'var(--fs-base)',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            padding: 0,
            whiteSpace: 'nowrap',
          }}
        >
          History →
        </button>
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 10 }}>
        UFC 3-260-01, Chapter 3 — Imaginary Surface Analysis
      </div>

      {/* Map */}
      <AirfieldMap
        onPointSelected={handlePointSelected}
        selectedPoint={pointInfo?.point ?? null}
        surfaceAtPoint={surfaceAtPoint}
        flyToPoint={flyToPoint}
        taxiways={taxiwayGeometries.map(tw => ({
          id: tw.id,
          designator: tw.designator,
          centerline: tw.centerline,
          standard: tw.standard,
        }))}
      />

      {/* Use My Location */}
      <button
        type="button"
        onClick={useMyLocation}
        disabled={gpsLoading}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          width: '100%',
          marginTop: 8,
          padding: '10px 16px',
          borderRadius: 8,
          border: '1px solid var(--color-border-active)',
          background: 'var(--color-border)',
          color: 'var(--color-accent)',
          fontSize: 'var(--fs-md)',
          fontWeight: 600,
          cursor: gpsLoading ? 'wait' : 'pointer',
          fontFamily: 'inherit',
          opacity: gpsLoading ? 0.6 : 1,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
        {gpsLoading ? 'Getting Location...' : 'Use My Location'}
      </button>

      {/* Point Info Card */}
      {pointInfo && (
        <div className="card" style={{ marginTop: 10 }}>
          <span className="section-label">Selected Location</span>
          <div className="detail-grid-2" style={{ fontSize: 'var(--fs-base)' }}>
            <div>
              <span style={{ color: 'var(--color-text-3)' }}>Coordinates</span>
              <div style={{ fontFamily: 'monospace', color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', marginTop: 2 }}>
                {pointInfo.point.lat.toFixed(5)}°N, {Math.abs(pointInfo.point.lon).toFixed(5)}°W
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-3)' }}>From Centerline</span>
              <div style={{ color: 'var(--color-text-1)', fontFamily: 'monospace', fontSize: 'var(--fs-sm)', marginTop: 2 }}>
                {pointInfo.distFromCenterline.toFixed(0)} ft
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-3)' }}>From Nearest Threshold</span>
              <div style={{ color: 'var(--color-text-1)', fontFamily: 'monospace', fontSize: 'var(--fs-sm)', marginTop: 2 }}>
                {pointInfo.distFromThreshold.toFixed(0)} ft (RWY {pointInfo.nearerEnd === 'end1'
                  ? (runways[pointInfo.closestRunwayIndex]?.end1_designator ?? '01')
                  : (runways[pointInfo.closestRunwayIndex]?.end2_designator ?? '19')})
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-3)' }}>Ground Elevation</span>
              <div style={{ color: 'var(--color-text-1)', fontFamily: 'monospace', fontSize: 'var(--fs-sm)', marginTop: 2 }}>
                {pointInfo.loadingElev
                  ? 'Fetching...'
                  : `${(pointInfo.groundElevMSL ?? airfieldElevMSL).toFixed(0)} ft MSL`}
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-3)' }}>Surface Zone</span>
              <div
                style={{
                  color: 'var(--color-text-1)',
                  fontSize: 'var(--fs-sm)',
                  marginTop: 2,
                  fontWeight: 600,
                }}
              >
                {pointInfo.surfaceName}
              </div>
            </div>
            {pointInfo.withinApproachDeparture && (() => {
              const rwy = runways[pointInfo.closestRunwayIndex]
              const thresholdElev = pointInfo.nearerEnd === 'end1'
                ? rwy?.end1_elevation_msl
                : rwy?.end2_elevation_msl
              const designator = pointInfo.nearerEnd === 'end1'
                ? (rwy?.end1_designator ?? 'End 1')
                : (rwy?.end2_designator ?? 'End 2')
              return (
                <div>
                  <span style={{ color: 'var(--color-text-3)' }}>Nearest Threshold Elev</span>
                  <div style={{ color: 'var(--color-text-1)', fontFamily: 'monospace', fontSize: 'var(--fs-sm)', marginTop: 2 }}>
                    {thresholdElev != null
                      ? `${thresholdElev.toLocaleString('en-US', { maximumFractionDigits: 1 })} ft MSL (RWY ${designator})`
                      : `Not set (using ${airfieldElevMSL} ft airfield elev)`}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Evaluation Form */}
      <div className="card" style={{ marginTop: 10 }}>
        <span className="section-label">Obstruction Details</span>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Obstruction Height (ft AGL) *
          </label>
          <input
            type="number"
            className="input-dark"
            placeholder="e.g. 75"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            min="0"
            step="0.1"
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Obstruction Description
          </label>
          <textarea
            className="input-dark"
            rows={2}
            style={{ resize: 'vertical' }}
            placeholder="e.g. Cell tower, construction crane, tree..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Photos */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handlePhoto}
          style={{ display: 'none' }}
        />
        <div style={{ marginBottom: 10 }}>
          <PhotoPickerButton
            onUpload={() => fileInputRef.current?.click()}
          />
          {photos.length > 0 && (
            <div className="photo-grid" style={{ marginTop: 8 }}>
              {photos.map((p, i) => (
                <div
                  key={i}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: '1px solid var(--color-border-active)',
                    flexShrink: 0,
                    position: 'relative',
                  }}
                >
                  <img src={p.url} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: 'var(--color-overlay)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#fff',
                      fontSize: 'var(--fs-sm)',
                      lineHeight: '16px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={runEvaluation}
          disabled={!pointInfo || !height}
          style={{ opacity: !pointInfo || !height ? 0.5 : 1 }}
        >
          Evaluate Obstruction
        </button>
      </div>

      {/* Results */}
      {multiAnalysis && (
        <>
          {/* Summary Banner */}
          <div
            className="card"
            style={{
              marginTop: 10,
              borderColor: multiAnalysis.hasViolation
                ? 'rgba(239, 68, 68, 0.3)'
                : 'rgba(34, 197, 94, 0.3)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: multiAnalysis.hasViolation ? '#EF444422' : '#22C55E22',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--fs-2xl)',
                  flexShrink: 0,
                }}
              >
                {multiAnalysis.hasViolation ? '⚠️' : '✅'}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 'var(--fs-lg)',
                    fontWeight: 800,
                    color: multiAnalysis.hasViolation ? '#EF4444' : '#22C55E',
                  }}
                >
                  {multiAnalysis.hasViolation ? 'VIOLATION DETECTED' : 'NO VIOLATION'}
                </div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
                  {multiAnalysis.controllingSurface
                    ? `Controlling surface: ${multiAnalysis.controllingSurface.surfaceName}${multiAnalysis.controllingSurface.runwayLabel ? ` (RWY ${multiAnalysis.controllingSurface.runwayLabel})` : ''}`
                    : 'Outside all imaginary surfaces'}
                </div>
              </div>
            </div>

            {/* Quick stats */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 6,
                fontSize: 'var(--fs-sm)',
                marginTop: 4,
              }}
            >
              <div style={{ background: 'var(--color-bg-inset)', borderRadius: 6, padding: '6px 8px' }}>
                <div style={{ color: 'var(--color-text-3)', marginBottom: 2 }}>Total Obstruction Height MSL</div>
                <div style={{ color: 'var(--color-text-1)', fontWeight: 700, fontFamily: 'monospace' }}>
                  {multiAnalysis.obstructionTopMSL.toFixed(0)} ft MSL
                </div>
              </div>
              <div style={{ background: 'var(--color-bg-inset)', borderRadius: 6, padding: '6px 8px' }}>
                <div style={{ color: 'var(--color-text-3)', marginBottom: 2 }}>Max Allowable</div>
                <div style={{ color: 'var(--color-text-1)', fontWeight: 700, fontFamily: 'monospace' }}>
                  {multiAnalysis.controllingSurface
                    ? `${multiAnalysis.controllingSurface.maxAllowableHeightMSL.toFixed(0)} ft MSL`
                    : 'N/A'}
                </div>
              </div>
              <div style={{ background: 'var(--color-bg-inset)', borderRadius: 6, padding: '6px 8px' }}>
                <div style={{ color: 'var(--color-text-3)', marginBottom: 2 }}>CL Distance</div>
                <div style={{ color: 'var(--color-text-1)', fontWeight: 700, fontFamily: 'monospace' }}>
                  {pointInfo?.distFromCenterline.toFixed(0) ?? '—'} ft
                </div>
              </div>
            </div>
          </div>

          {/* Per-runway surface analysis */}
          {multiAnalysis.perRunway.map(({ runwayLabel, analysis: rwyAnalysis }) => (
            <div className="card" style={{ marginTop: 10 }} key={runwayLabel}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                <span className="section-label" style={{ margin: 0, flex: 1 }}>
                  {multiAnalysis.perRunway.length > 1
                    ? `Surface Analysis — RWY ${runwayLabel}`
                    : 'Surface Analysis'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowVerify((v) => !v)}
                  style={{
                    background: showVerify ? 'var(--color-accent)' : 'var(--color-border)',
                    border: `1px solid ${showVerify ? 'var(--color-accent)' : 'var(--color-border-active)'}`,
                    borderRadius: 6,
                    padding: '3px 8px',
                    color: showVerify ? '#fff' : 'var(--color-text-2)',
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {showVerify ? 'Hide math' : 'Verify the numbers'}
                </button>
              </div>
              {rwyAnalysis.surfaces
                .filter((s) => s.isWithinBounds)
                .map((s) => {
                  const isLandUseZone = s.maxAllowableHeightMSL === -1
                  return (
                    <div
                      key={s.surfaceKey}
                      style={{
                        background: 'var(--color-bg-inset)',
                        border: `1px solid ${s.violated ? 'rgba(239,68,68,0.3)' : isLandUseZone ? `${s.color}33` : 'var(--color-border)'}`,
                        borderRadius: 8,
                        padding: 10,
                        marginBottom: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 2,
                            background: s.color,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-1)', flex: 1 }}>
                          {s.surfaceName}
                        </span>
                        {isLandUseZone ? (
                          <span
                            style={{
                              fontSize: 'var(--fs-xs)',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: `${s.color}22`,
                              color: s.color,
                            }}
                          >
                            WITHIN ZONE
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: 'var(--fs-xs)',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: s.violated ? '#EF444422' : '#22C55E22',
                              color: s.violated ? '#EF4444' : '#22C55E',
                            }}
                          >
                            {s.violated ? `VIOLATION (${s.penetrationFt.toFixed(1)} ft)` : 'CLEAR'}
                          </span>
                        )}
                      </div>
                      {isLandUseZone ? (
                        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', lineHeight: 1.5 }}>
                          {s.ufcCriteria}
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', lineHeight: 1.4 }}>
                            Max allowable: <strong style={{ color: 'var(--color-text-1)' }}>{s.maxAllowableHeightMSL.toFixed(0)} ft MSL</strong>
                            {' '}({s.maxAllowableHeightAGL.toFixed(0)} ft AGL)
                          </div>
                          {s.baselineLabel && (
                            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', marginTop: 2 }}>
                              Baseline: {s.baselineLabel}{s.baselineElevation != null ? ` (${s.baselineElevation.toLocaleString('en-US', { maximumFractionDigits: 1 })} ft MSL)` : ''}
                            </div>
                          )}
                          {showVerify && s.calculationBreakdown && (
                            <div
                              style={{
                                marginTop: 6,
                                padding: '6px 8px',
                                background: 'var(--color-bg-surface)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 6,
                              }}
                            >
                              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: 3 }}>
                                Verify the numbers
                              </div>
                              <div style={{ fontSize: 'var(--fs-sm)', fontFamily: 'monospace', color: 'var(--color-text-1)', lineHeight: 1.5 }}>
                                {s.calculationBreakdown}
                              </div>
                              <div style={{ fontSize: 'var(--fs-xs)', fontFamily: 'monospace', color: 'var(--color-text-2)', marginTop: 2 }}>
                                Obstruction top: {s.obstructionTopMSL.toFixed(1)} ft MSL
                                {s.violated
                                  ? ` — exceeds by ${s.penetrationFt.toFixed(1)} ft`
                                  : ` — ${(s.maxAllowableHeightMSL - s.obstructionTopMSL).toFixed(1)} ft clear`}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 4, fontStyle: 'italic' }}>
                        {s.ufcReference}
                      </div>
                    </div>
                  )
                })}

              {/* Surfaces the point is NOT within */}
              {rwyAnalysis.surfaces.filter((s) => !s.isWithinBounds).length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 4 }}>
                    NOT APPLICABLE AT THIS LOCATION:
                  </div>
                  {rwyAnalysis.surfaces
                    .filter((s) => !s.isWithinBounds)
                    .map((s) => (
                      <div
                        key={s.surfaceKey}
                        style={{
                          fontSize: 'var(--fs-sm)',
                          color: 'var(--color-text-3)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          paddingLeft: 4,
                          marginBottom: 2,
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: 2, background: s.color, opacity: 0.3, flexShrink: 0 }} />
                        {s.surfaceName}
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}

          {/* Taxiway Surface Analysis */}
          {taxiwayResults.length > 0 && (
            <div className="card" style={{ marginTop: 10 }}>
              <span className="section-label" style={{ margin: 0, marginBottom: 6 }}>
                Taxiway Surface Analysis
              </span>
              {taxiwayResults
                .filter(r => r.isWithinBounds)
                .map((r, i) => (
                  <div
                    key={`${r.taxiwayId}-${r.surfaceKey}-${i}`}
                    style={{
                      background: 'var(--color-bg-inset)',
                      border: `1px solid ${r.violated ? 'rgba(245,158,11,0.3)' : 'var(--color-border)'}`,
                      borderRadius: 8,
                      padding: 10,
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-1)', flex: 1 }}>
                        {r.surfaceName}
                      </span>
                      <span style={{
                        fontSize: 'var(--fs-xs)', fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                        background: r.violated ? '#F59E0B22' : '#22C55E22',
                        color: r.violated ? '#F59E0B' : '#22C55E',
                      }}>
                        {r.violated ? 'WITHIN OFA' : 'CLEAR'}
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
                      Distance from centerline: <strong style={{ color: 'var(--color-text-1)' }}>{r.distanceFromCenterlineFt} ft</strong>
                      {' '}| OFA boundary: {r.halfWidthFt} ft
                    </div>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 4, fontStyle: 'italic' }}>
                      {r.ufcReference}
                    </div>
                  </div>
                ))}
              {taxiwayResults.filter(r => !r.isWithinBounds).length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 4 }}>
                    OUTSIDE TAXIWAY SURFACES:
                  </div>
                  {taxiwayResults
                    .filter(r => !r.isWithinBounds)
                    .map((r, i) => (
                      <div
                        key={`${r.taxiwayId}-${r.surfaceKey}-outside-${i}`}
                        style={{
                          fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)',
                          display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 4, marginBottom: 2,
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: 2, background: r.color, opacity: 0.3, flexShrink: 0 }} />
                        {r.surfaceName} ({r.distanceFromCenterlineFt} ft from CL)
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* UFC References (only if violations) */}
          {multiAnalysis.hasViolation && (
            <div
              className="card"
              style={{
                marginTop: 10,
                borderColor: 'rgba(239, 68, 68, 0.2)',
                background: 'rgba(239, 68, 68, 0.04)',
              }}
            >
              <span className="section-label" style={{ color: '#EF4444' }}>
                Applicable UFC References
              </span>
              {multiAnalysis.violatedSurfaces.map((vs, i) => (
                <div
                  key={`${vs.surfaceKey}-${vs.runwayLabel ?? i}`}
                  style={{
                    background: 'rgba(239, 68, 68, 0.06)',
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                    borderRadius: 6,
                    padding: '8px 10px',
                    marginBottom: 6,
                  }}
                >
                  <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 4 }}>
                    {vs.ufcReference}
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', lineHeight: 1.4 }}>
                    {vs.surfaceName}{vs.runwayLabel ? ` (RWY ${vs.runwayLabel})` : ''} — {vs.penetrationFt.toFixed(1)} ft penetration
                  </div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', marginTop: 4, fontStyle: 'italic', lineHeight: 1.4 }}>
                    {vs.ufcCriteria}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Save Evaluation */}
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving...' : editId ? 'Update Evaluation' : 'Save Evaluation'}
            </button>
          </div>
        </>
      )}

    </div>
  )
}
