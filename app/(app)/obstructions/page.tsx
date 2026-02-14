'use client'

import { Suspense, useState, useRef, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { INSTALLATION } from '@/lib/constants'
import type { LatLon, RunwayGeometry } from '@/lib/calculations/geometry'
import { getRunwayGeometry } from '@/lib/calculations/geometry'
import {
  evaluateObstruction,
  identifySurface,
  type ObstructionAnalysis,
} from '@/lib/calculations/obstructions'
import { fetchElevation } from '@/lib/calculations/geometry'
import {
  createObstructionEvaluation,
  updateObstructionEvaluation,
  fetchObstructionEvaluation,
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

  // Edit mode
  const editId = searchParams.get('edit')

  // Build runway geometry
  const getRunway = useCallback((): RunwayGeometry => {
    return getRunwayGeometry(INSTALLATION.runways[0])
  }, [])

  // Map / point state
  const [pointInfo, setPointInfo] = useState<PointInfo | null>(null)

  // Form state
  const [height, setHeight] = useState('')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null)

  // Evaluation result
  const [analysis, setAnalysis] = useState<ObstructionAnalysis | null>(null)
  const [saving, setSaving] = useState(false)

  // Load existing evaluation in edit mode
  useEffect(() => {
    if (!editId) return
    async function loadExisting() {
      const existing = await fetchObstructionEvaluation(editId!)
      if (!existing) {
        toast.error('Evaluation not found')
        return
      }
      setHeight(String(existing.object_height_agl))
      setDescription(existing.notes || existing.description || '')
      if (existing.latitude && existing.longitude) {
        const point: LatLon = { lat: existing.latitude, lon: existing.longitude }
        const rwy = getRunwayGeometry(INSTALLATION.runways[0])
        const surfaceName = identifySurface(point, rwy)
        setPointInfo({
          point,
          groundElevMSL: existing.object_elevation_msl,
          distFromCenterline: existing.distance_from_centerline_ft ?? 0,
          surfaceName,
          loadingElev: false,
        })
      }
    }
    loadExisting()
  }, [editId])

  // Handle map click
  const handlePointSelected = useCallback(async (point: LatLon) => {
    const rwy = getRunway()
    const surfaceName = identifySurface(point, rwy)
    setPointInfo({
      point,
      groundElevMSL: null,
      distFromCenterline: 0,
      surfaceName,
      loadingElev: true,
    })
    setAnalysis(null)

    // Quick pre-evaluation at 0 height to get centerline distance
    const preEval = evaluateObstruction(point, 0, null, rwy)
    setPointInfo((prev) =>
      prev
        ? { ...prev, distFromCenterline: preEval.distanceFromCenterline }
        : prev,
    )

    // Fetch real elevation
    const elev = await fetchElevation(point)
    setPointInfo((prev) =>
      prev
        ? {
            ...prev,
            groundElevMSL: elev ?? INSTALLATION.elevation_msl,
            loadingElev: false,
          }
        : prev,
    )

    if (elev) {
      toast.success(`Elevation: ${elev.toFixed(0)} ft MSL`)
    } else {
      toast(`Using airfield elevation (${INSTALLATION.elevation_msl} ft MSL)`, { description: 'Open-Elevation API unavailable' })
    }
  }, [getRunway])

  // Run the evaluation
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

    const result = evaluateObstruction(
      pointInfo.point,
      h,
      pointInfo.groundElevMSL,
      getRunway(),
    )
    setAnalysis(result)

    if (result.hasViolation) {
      toast.error(`VIOLATION — ${result.violatedSurfaces.length} surface(s) penetrated`)
    } else {
      toast.success('No violations detected')
    }
  }

  // Handle photo — convert to data URL immediately so it can be saved with the record
  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const reader = new FileReader()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      setPhoto({ file, url: dataUrl })
      toast.success('Photo attached')
    } catch {
      toast.error('Failed to read photo')
    }
  }

  // Save to database
  const handleSave = async () => {
    if (!analysis || !pointInfo) return
    setSaving(true)

    const evaluationPayload = {
      object_height_agl: analysis.obstructionHeightAGL,
      object_distance_ft: analysis.distanceFromCenterline,
      distance_from_centerline_ft: analysis.distanceFromCenterline,
      object_elevation_msl: analysis.groundElevationMSL,
      obstruction_top_msl: analysis.obstructionTopMSL,
      latitude: analysis.point.lat,
      longitude: analysis.point.lon,
      description: description || null,
      photo_storage_path: photo?.url ?? null,
      results: analysis.surfaces.map((s) => ({
        surfaceKey: s.surfaceKey,
        surfaceName: s.surfaceName,
        isWithinBounds: s.isWithinBounds,
        maxAllowableHeightAGL: s.maxAllowableHeightAGL,
        maxAllowableHeightMSL: s.maxAllowableHeightMSL,
        obstructionTopMSL: s.obstructionTopMSL,
        violated: s.violated,
        penetrationFt: s.penetrationFt,
        ufcReference: s.ufcReference,
        ufcCriteria: s.ufcCriteria,
      })),
      controlling_surface: analysis.controllingSurface?.surfaceName ?? null,
      violated_surfaces: analysis.violatedSurfaces.map((s) => s.surfaceName),
      has_violation: analysis.hasViolation,
      notes: description || null,
    }

    let data, error
    if (editId) {
      ({ data, error } = await updateObstructionEvaluation(editId, evaluationPayload))
    } else {
      ({ data, error } = await createObstructionEvaluation({
        runway_class: 'B',
        ...evaluationPayload,
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

  const surfaceAtPoint = analysis
    ? analysis.hasViolation
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
          color: '#22D3EE',
          fontSize: 12,
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
            color: '#38BDF8',
            fontSize: 11,
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
      <div style={{ fontSize: 10, color: '#64748B', marginBottom: 10 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
            <div>
              <span style={{ color: '#64748B' }}>Coordinates</span>
              <div style={{ fontFamily: 'monospace', color: '#CBD5E1', fontSize: 10, marginTop: 2 }}>
                {pointInfo.point.lat.toFixed(5)}°N, {Math.abs(pointInfo.point.lon).toFixed(5)}°W
              </div>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>From Centerline</span>
              <div style={{ color: '#CBD5E1', fontFamily: 'monospace', fontSize: 10, marginTop: 2 }}>
                {pointInfo.distFromCenterline.toFixed(0)} ft
              </div>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>Ground Elevation</span>
              <div style={{ color: '#CBD5E1', fontFamily: 'monospace', fontSize: 10, marginTop: 2 }}>
                {pointInfo.loadingElev
                  ? 'Fetching...'
                  : `${(pointInfo.groundElevMSL ?? INSTALLATION.elevation_msl).toFixed(0)} ft MSL`}
              </div>
            </div>
            <div>
              <span style={{ color: '#64748B' }}>Surface Zone</span>
              <div
                style={{
                  color: '#CBD5E1',
                  fontSize: 10,
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
          <label style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: 4 }}>
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
          <label style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, display: 'block', marginBottom: 4 }}>
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

        {/* Photo */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhoto}
          style={{ display: 'none' }}
        />
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              flex: 1,
              background: '#38BDF814',
              border: '1px solid #38BDF833',
              borderRadius: 8,
              padding: 10,
              color: '#38BDF8',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              minHeight: 44,
            }}
          >
            {photo ? '✓ Photo Attached' : '📸 Add Photo'}
          </button>
          {photo && (
            <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', border: '1px solid #38BDF833', flexShrink: 0 }}>
              <img src={photo.url} alt="Obstruction" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
      {analysis && (
        <>
          {/* Summary Banner */}
          <div
            className="card"
            style={{
              marginTop: 10,
              borderColor: analysis.hasViolation
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
                  background: analysis.hasViolation ? '#EF444422' : '#22C55E22',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                {analysis.hasViolation ? '⚠️' : '✅'}
              </div>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: analysis.hasViolation ? '#EF4444' : '#22C55E',
                  }}
                >
                  {analysis.hasViolation ? 'VIOLATION DETECTED' : 'NO VIOLATION'}
                </div>
                <div style={{ fontSize: 10, color: '#94A3B8' }}>
                  {analysis.controllingSurface
                    ? `Controlling surface: ${analysis.controllingSurface.surfaceName}`
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
                fontSize: 10,
                marginTop: 4,
              }}
            >
              <div style={{ background: 'rgba(4,7,12,0.6)', borderRadius: 6, padding: '6px 8px' }}>
                <div style={{ color: '#64748B', marginBottom: 2 }}>Obstruction Top</div>
                <div style={{ color: '#F1F5F9', fontWeight: 700, fontFamily: 'monospace' }}>
                  {analysis.obstructionTopMSL.toFixed(0)} ft MSL
                </div>
              </div>
              <div style={{ background: 'rgba(4,7,12,0.6)', borderRadius: 6, padding: '6px 8px' }}>
                <div style={{ color: '#64748B', marginBottom: 2 }}>Max Allowable</div>
                <div style={{ color: '#F1F5F9', fontWeight: 700, fontFamily: 'monospace' }}>
                  {analysis.controllingSurface
                    ? `${analysis.controllingSurface.maxAllowableHeightMSL.toFixed(0)} ft MSL`
                    : 'N/A'}
                </div>
              </div>
              <div style={{ background: 'rgba(4,7,12,0.6)', borderRadius: 6, padding: '6px 8px' }}>
                <div style={{ color: '#64748B', marginBottom: 2 }}>CL Distance</div>
                <div style={{ color: '#F1F5F9', fontWeight: 700, fontFamily: 'monospace' }}>
                  {analysis.distanceFromCenterline.toFixed(0)} ft
                </div>
              </div>
            </div>
          </div>

          {/* Surface-by-surface results */}
          <div className="card" style={{ marginTop: 10 }}>
            <span className="section-label">Surface Analysis</span>
            {analysis.surfaces
              .filter((s) => s.isWithinBounds)
              .map((s) => (
                <div
                  key={s.surfaceKey}
                  style={{
                    background: 'rgba(4,7,12,0.6)',
                    border: `1px solid ${s.violated ? 'rgba(239,68,68,0.3)' : 'rgba(56,189,248,0.06)'}`,
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
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#F1F5F9', flex: 1 }}>
                      {s.surfaceName}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: s.violated ? '#EF444422' : '#22C55E22',
                        color: s.violated ? '#EF4444' : '#22C55E',
                      }}
                    >
                      {s.violated ? `VIOLATION (${s.penetrationFt.toFixed(1)} ft)` : 'CLEAR'}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: '#94A3B8', lineHeight: 1.4 }}>
                    Max allowable: <strong style={{ color: '#CBD5E1' }}>{s.maxAllowableHeightMSL.toFixed(0)} ft MSL</strong>
                    {' '}({s.maxAllowableHeightAGL.toFixed(0)} ft AGL)
                  </div>
                  <div style={{ fontSize: 9, color: '#64748B', marginTop: 4, fontStyle: 'italic' }}>
                    {s.ufcReference}
                  </div>
                </div>
              ))}

            {/* Surfaces the point is NOT within */}
            {analysis.surfaces.filter((s) => !s.isWithinBounds).length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 9, color: '#475569', fontWeight: 600, marginBottom: 4 }}>
                  NOT APPLICABLE AT THIS LOCATION:
                </div>
                {analysis.surfaces
                  .filter((s) => !s.isWithinBounds)
                  .map((s) => (
                    <div
                      key={s.surfaceKey}
                      style={{
                        fontSize: 10,
                        color: '#475569',
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

          {/* Waiver Guidance (only if violations) */}
          {analysis.hasViolation && (
            <div
              className="card"
              style={{
                marginTop: 10,
                borderColor: 'rgba(239, 68, 68, 0.2)',
                background: 'rgba(239, 68, 68, 0.04)',
              }}
            >
              <span className="section-label" style={{ color: '#EF4444' }}>
                Required Actions
              </span>
              {analysis.waiverGuidance.map((line, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 11,
                    color: i === 0 ? '#EF4444' : '#CBD5E1',
                    fontWeight: i === 0 ? 700 : 400,
                    lineHeight: 1.5,
                    marginBottom: i === 0 ? 8 : 4,
                    paddingLeft: i === 0 ? 0 : 8,
                  }}
                >
                  {line}
                </div>
              ))}

              {/* Submit W/O to CES button */}
              <button
                type="button"
                onClick={() => {
                  router.push(
                    `/discrepancies/new?type=obstruction&title=${encodeURIComponent(
                      `Obstruction: ${description || 'Imaginary Surface Violation'}`,
                    )}&description=${encodeURIComponent(
                      analysis.violatedSurfaces
                        .map(
                          (v) =>
                            `${v.surfaceName}: ${v.penetrationFt.toFixed(1)} ft penetration. Ref: ${v.ufcReference}`,
                        )
                        .join('\n'),
                    )}`,
                  )
                }}
                style={{
                  marginTop: 10,
                  width: '100%',
                  background: 'linear-gradient(135deg, #B91C1C, #EF4444)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  minHeight: 44,
                }}
              >
                Submit W/O to CES
              </button>
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
