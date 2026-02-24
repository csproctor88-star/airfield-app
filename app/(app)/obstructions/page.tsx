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
  identifySurface,
  type ObstructionAnalysis,
  type MultiRunwayAnalysis,
} from '@/lib/calculations/obstructions'
import { fetchElevation } from '@/lib/calculations/geometry'
import {
  createObstructionEvaluation,
  updateObstructionEvaluation,
  fetchObstructionEvaluation,
  parsePhotoPaths,
} from '@/lib/supabase/obstructions'

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
  const cameraInputRef = useRef<HTMLInputElement>(null)
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

  // Evaluation result — supports multi-runway
  const [multiAnalysis, setMultiAnalysis] = useState<MultiRunwayAnalysis | null>(null)
  // Convenience: first runway's full analysis (for save payload backward compat)
  const analysis: ObstructionAnalysis | null = multiAnalysis?.perRunway[0]?.analysis ?? null
  const [saving, setSaving] = useState(false)

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
        })
        // Auto-run evaluation against all runways
        if (h > 0) {
          const result = evaluateObstructionAllRunways(point, h, groundElev, allRwys, airfieldElevMSL, runwayClass)
          setMultiAnalysis(result)
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

    if (result.hasViolation) {
      toast.error(`VIOLATION — ${result.violatedSurfaces.length} surface(s) penetrated`)
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
    <div style={{ padding: 16, paddingBottom: 120 }}>
      {/* Header */}
      <button
        onClick={() => router.back()}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--color-cyan)',
          fontSize: 13,
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
        <div style={{ fontSize: 16, fontWeight: 800, flex: 1 }}>
          {editId ? 'Edit Evaluation' : 'Obstruction Evaluation'}
        </div>
        <button
          onClick={() => router.push('/obstructions/history')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-accent)',
            fontSize: 12,
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
      <div style={{ fontSize: 11, color: 'var(--color-text-3)', marginBottom: 10 }}>
        UFC 3-260-01, Chapter 3 — Imaginary Surface Analysis
      </div>

      {/* Map */}
      <AirfieldMap
        onPointSelected={handlePointSelected}
        selectedPoint={pointInfo?.point ?? null}
        surfaceAtPoint={surfaceAtPoint}
      />

      {/* Point Info Card */}
      {pointInfo && (
        <div className="card" style={{ marginTop: 10 }}>
          <span className="section-label">Selected Location</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
            <div>
              <span style={{ color: 'var(--color-text-3)' }}>Coordinates</span>
              <div style={{ fontFamily: 'monospace', color: 'var(--color-text-1)', fontSize: 11, marginTop: 2 }}>
                {pointInfo.point.lat.toFixed(5)}°N, {Math.abs(pointInfo.point.lon).toFixed(5)}°W
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-3)' }}>From Centerline</span>
              <div style={{ color: 'var(--color-text-1)', fontFamily: 'monospace', fontSize: 11, marginTop: 2 }}>
                {pointInfo.distFromCenterline.toFixed(0)} ft
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-3)' }}>From Nearest Threshold</span>
              <div style={{ color: 'var(--color-text-1)', fontFamily: 'monospace', fontSize: 11, marginTop: 2 }}>
                {pointInfo.distFromThreshold.toFixed(0)} ft (RWY {pointInfo.nearerEnd === 'end1'
                  ? (runways[pointInfo.closestRunwayIndex]?.end1_designator ?? '01')
                  : (runways[pointInfo.closestRunwayIndex]?.end2_designator ?? '19')})
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-3)' }}>Ground Elevation</span>
              <div style={{ color: 'var(--color-text-1)', fontFamily: 'monospace', fontSize: 11, marginTop: 2 }}>
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
                  fontSize: 11,
                  marginTop: 2,
                  fontWeight: 600,
                }}
              >
                {pointInfo.surfaceName}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evaluation Form */}
      <div className="card" style={{ marginTop: 10 }}>
        <span className="section-label">Obstruction Details</span>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: 'var(--color-text-2)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
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
          <label style={{ fontSize: 11, color: 'var(--color-text-2)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
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
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhoto}
          style={{ display: 'none' }}
        />
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: 'var(--color-border)',
                border: '1px solid var(--color-border-active)',
                borderRadius: 8,
                padding: 10,
                color: 'var(--color-accent)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                minHeight: 44,
              }}
            >
              🖼️ Upload Photo
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              style={{
                background: 'var(--color-border)',
                border: '1px solid var(--color-border-active)',
                borderRadius: 8,
                padding: 10,
                color: 'var(--color-accent)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                minHeight: 44,
              }}
            >
              📸 Take Photo
            </button>
          </div>
          {photos.length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
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
                      fontSize: 11,
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
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                {multiAnalysis.hasViolation ? '⚠️' : '✅'}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: multiAnalysis.hasViolation ? '#EF4444' : '#22C55E',
                  }}
                >
                  {multiAnalysis.hasViolation ? 'VIOLATION DETECTED' : 'NO VIOLATION'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-2)' }}>
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
                fontSize: 11,
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
              <span className="section-label">
                {multiAnalysis.perRunway.length > 1
                  ? `Surface Analysis — RWY ${runwayLabel}`
                  : 'Surface Analysis'}
              </span>
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
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-1)', flex: 1 }}>
                          {s.surfaceName}
                        </span>
                        {isLandUseZone ? (
                          <span
                            style={{
                              fontSize: 10,
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
                              fontSize: 10,
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
                        <div style={{ fontSize: 11, color: 'var(--color-text-2)', lineHeight: 1.5 }}>
                          {s.ufcCriteria}
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--color-text-2)', lineHeight: 1.4 }}>
                          Max allowable: <strong style={{ color: 'var(--color-text-1)' }}>{s.maxAllowableHeightMSL.toFixed(0)} ft MSL</strong>
                          {' '}({s.maxAllowableHeightAGL.toFixed(0)} ft AGL)
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: 'var(--color-text-3)', marginTop: 4, fontStyle: 'italic' }}>
                        {s.ufcReference}
                      </div>
                    </div>
                  )
                })}

              {/* Surfaces the point is NOT within */}
              {rwyAnalysis.surfaces.filter((s) => !s.isWithinBounds).length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 10, color: 'var(--color-text-3)', fontWeight: 600, marginBottom: 4 }}>
                    NOT APPLICABLE AT THIS LOCATION:
                  </div>
                  {rwyAnalysis.surfaces
                    .filter((s) => !s.isWithinBounds)
                    .map((s) => (
                      <div
                        key={s.surfaceKey}
                        style={{
                          fontSize: 11,
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
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 4 }}>
                    {vs.ufcReference}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-1)', lineHeight: 1.4 }}>
                    {vs.surfaceName}{vs.runwayLabel ? ` (RWY ${vs.runwayLabel})` : ''} — {vs.penetrationFt.toFixed(1)} ft penetration
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-2)', marginTop: 4, fontStyle: 'italic', lineHeight: 1.4 }}>
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
