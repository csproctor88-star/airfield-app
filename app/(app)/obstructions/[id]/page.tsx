'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useInstallation } from '@/lib/installation-context'
import { fetchObstructionEvaluation, deleteObstructionEvaluation, parsePhotoPaths, type ObstructionRow } from '@/lib/supabase/obstructions'
import { PhotoViewerModal } from '@/components/discrepancies/modals'

type SurfaceResult = {
  surfaceKey: string
  surfaceName: string
  isWithinBounds: boolean
  maxAllowableHeightAGL: number
  maxAllowableHeightMSL: number
  obstructionTopMSL: number
  violated: boolean
  penetrationFt: number
  ufcReference: string
  ufcCriteria: string
  baselineElevation?: number
  baselineLabel?: string
  calculationBreakdown?: string
}

const SURFACE_COLORS: Record<string, string> = {
  primary: '#EF4444',
  approach_departure: '#F97316',
  transitional: '#EAB308',
  inner_horizontal: '#22C55E',
  conical: '#3B82F6',
  outer_horizontal: '#8B5CF6',
  clear_zone: '#EC4899',
  graded_area: '#F43F5E',
  apz_i: '#D946EF',
  apz_ii: '#A78BFA',
}

export default function ObstructionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { currentInstallation } = useInstallation()
  const id = params.id as string
  const [evaluation, setEvaluation] = useState<ObstructionRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [showVerify, setShowVerify] = useState(false)

  useEffect(() => {
    async function load() {
      const data = await fetchObstructionEvaluation(id)
      setEvaluation(data)
      setLoading(false)
    }
    load()
  }, [id])

  const handleDelete = async () => {
    setDeleting(true)
    setShowDeleteConfirm(false)
    const { error } = await deleteObstructionEvaluation(id)
    if (error) {
      alert(error)
      setDeleting(false)
      return
    }
    router.push('/obstructions/history')
  }

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: 'center', paddingTop: 60 }}>
        <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-3)' }}>Loading evaluation...</div>
      </div>
    )
  }

  if (!evaluation) {
    return (
      <div style={{ padding: 16 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--color-cyan)', fontSize: 'var(--fs-md)', fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit' }}>
          ← Back
        </button>
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          <div style={{ fontSize: 'var(--fs-5xl)', marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-3)' }}>Evaluation not found</div>
        </div>
      </div>
    )
  }

  const results = (evaluation.results || []) as SurfaceResult[]
  const applicableResults = results.filter((r) => r.isWithinBounds)
  const violatedResults = results.filter((r) => r.violated)
  const createdAt = new Date(evaluation.created_at)
  const photoPaths = parsePhotoPaths(evaluation.photo_storage_path)

  return (
    <div style={{ padding: 16, paddingBottom: 120 }}>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>
          {evaluation.display_id}
        </span>
        <span
          style={{
            fontSize: 'var(--fs-xs)',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: 4,
            background: evaluation.has_violation ? '#EF444422' : '#22C55E22',
            color: evaluation.has_violation ? '#EF4444' : '#22C55E',
          }}
        >
          {evaluation.has_violation ? 'VIOLATION' : 'CLEAR'}
        </span>
        <span style={{ flex: 1 }} />
        <button
          onClick={() => router.push(`/obstructions?edit=${evaluation.id}`)}
          style={{
            background: 'var(--color-border-mid)',
            border: '1px solid var(--color-border-active)',
            borderRadius: 6,
            padding: '4px 12px',
            color: 'var(--color-accent)',
            fontSize: 'var(--fs-base)',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Edit
        </button>
      </div>
      <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, marginBottom: 4 }}>
        Obstruction Evaluation
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 14 }}>
        {createdAt.toLocaleDateString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}{' '}
        at{' '}
        {createdAt.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>

      {/* Photos — hero + thumbnail gallery */}
      {photoPaths.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {/* Hero image (first photo) */}
          <div
            style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--color-border-mid)', cursor: 'pointer' }}
            onClick={() => setViewerIndex(0)}
          >
            <img
              src={photoPaths[0]}
              alt="Obstruction"
              style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }}
            />
          </div>
          {/* Thumbnail row for remaining photos */}
          {photoPaths.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {photoPaths.slice(1).map((url, i) => (
                <div
                  key={i}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: '1px solid var(--color-border-mid)',
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}
                  onClick={() => setViewerIndex(i + 1)}
                >
                  <img
                    src={url}
                    alt={`Obstruction ${i + 2}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Summary Card */}
      <div className="card" style={{ marginBottom: 10 }}>
        <span className="section-label">Obstruction Details</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 'var(--fs-base)' }}>
          <div>
            <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>Height AGL</span>
            <div style={{ color: 'var(--color-text-1)', fontWeight: 700, fontFamily: 'monospace' }}>
              {evaluation.object_height_agl} ft
            </div>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>Top Elevation MSL</span>
            <div style={{ color: 'var(--color-text-1)', fontWeight: 700, fontFamily: 'monospace' }}>
              {evaluation.obstruction_top_msl?.toFixed(0) ?? '—'} ft
            </div>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>Ground Elevation MSL</span>
            <div style={{ color: 'var(--color-text-1)', fontWeight: 700, fontFamily: 'monospace' }}>
              {evaluation.object_elevation_msl?.toFixed(0) ?? (currentInstallation?.elevation_msl ?? 580)} ft
            </div>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>From Centerline</span>
            <div style={{ color: 'var(--color-text-1)', fontWeight: 700, fontFamily: 'monospace' }}>
              {evaluation.distance_from_centerline_ft?.toFixed(0) ?? '—'} ft
            </div>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>Coordinates</span>
            <div style={{ color: 'var(--color-text-1)', fontFamily: 'monospace', fontSize: 'var(--fs-sm)' }}>
              {evaluation.latitude?.toFixed(5)}°N, {evaluation.longitude ? Math.abs(evaluation.longitude).toFixed(5) : '—'}°W
            </div>
          </div>
          <div>
            <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>Runway</span>
            <div style={{ color: 'var(--color-text-1)', fontWeight: 700 }}>
              {evaluation.runway_class === 'Army_B' ? 'Army Class B' : `Class ${evaluation.runway_class}`}
            </div>
          </div>
        </div>

        {evaluation.notes && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
            <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>Description</span>
            <div style={{ color: 'var(--color-text-1)', fontSize: 'var(--fs-base)', marginTop: 2 }}>
              {evaluation.notes}
            </div>
          </div>
        )}
      </div>

      {/* Controlling Surface */}
      {evaluation.controlling_surface && (
        <div className="card" style={{ marginBottom: 10 }}>
          <span className="section-label">Controlling Surface</span>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text-1)' }}>
            {evaluation.controlling_surface}
          </div>
        </div>
      )}

      {/* Surface-by-surface results */}
      <div className="card" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <span className="section-label" style={{ margin: 0, flex: 1 }}>Surface Analysis</span>
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
        {applicableResults.map((s) => {
          const surfaceColor = SURFACE_COLORS[s.surfaceKey] || 'var(--color-text-2)'
          const isLandUseZone = s.maxAllowableHeightMSL === -1
          return (
            <div
              key={s.surfaceKey}
              style={{
                background: 'var(--color-bg-inset)',
                border: `1px solid ${s.violated ? 'rgba(239,68,68,0.3)' : isLandUseZone ? `${surfaceColor}33` : 'var(--color-border)'}`,
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
                    background: surfaceColor,
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
                      background: `${surfaceColor}22`,
                      color: surfaceColor,
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
                    Max allowable: <strong style={{ color: 'var(--color-text-1)' }}>
                      {s.maxAllowableHeightMSL.toFixed(0)} ft MSL
                    </strong>{' '}
                    ({s.maxAllowableHeightAGL.toFixed(0)} ft AGL)
                  </div>
                  {s.baselineLabel && (
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', marginTop: 2 }}>
                      Baseline: {s.baselineLabel}{s.baselineElevation != null ? ` (${s.baselineElevation.toLocaleString('en-US', { maximumFractionDigits: 1 })} ft MSL)` : ''}
                    </div>
                  )}
                  {s.violated && (
                    <div style={{ fontSize: 'var(--fs-sm)', color: '#EF4444', marginTop: 2 }}>
                      Penetration: {s.penetrationFt.toFixed(1)} ft above allowable height
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
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 4 }}>
                {s.ufcReference}
              </div>
              {!isLandUseZone && !showVerify && (
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2, lineHeight: 1.3, fontStyle: 'italic' }}>
                  {s.ufcCriteria}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Violated surfaces summary with guidance */}
      {violatedResults.length > 0 && (
        <div
          className="card"
          style={{
            borderColor: 'rgba(239, 68, 68, 0.2)',
            background: 'rgba(239, 68, 68, 0.04)',
          }}
        >
          <span className="section-label" style={{ color: '#EF4444' }}>
            Required Actions
          </span>
          <div style={{ fontSize: 'var(--fs-base)', color: '#EF4444', fontWeight: 700, marginBottom: 8 }}>
            OBSTRUCTION VIOLATION DETECTED — The following actions are required:
          </div>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', lineHeight: 1.6, paddingLeft: 8 }}>
            1. Submit Work Order to CES (Civil Engineering Squadron) for evaluation and corrective action.
          </div>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', lineHeight: 1.6, paddingLeft: 8 }}>
            2. Per DAFMAN 13-204 Vol. 1 — Document all known airfield obstructions and coordinate waivers.
          </div>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', lineHeight: 1.6, paddingLeft: 8 }}>
            3. Per DAFMAN 13-204, Para 1.14 — Coordinate with ATC/RAPCON regarding obstruction impact on flying operations.
          </div>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', lineHeight: 1.6, paddingLeft: 8 }}>
            4. Coordinate with BCE or Installation Community Planner to process a temporary or permanent waiver as required.
          </div>
          {violatedResults.map((v, i) => (
            <div key={i} style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-1)', lineHeight: 1.6, paddingLeft: 8, marginTop: 2 }}>
              5. {v.surfaceName} violation ({v.penetrationFt.toFixed(1)} ft) — {v.ufcReference}
            </div>
          ))}
        </div>
      )}

      {/* Delete */}
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleting}
          style={{
            background: 'none',
            border: 'none',
            color: '#EF4444',
            fontSize: 'var(--fs-base)',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            opacity: deleting ? 0.5 : 0.7,
            padding: '8px 16px',
          }}
        >
          {deleting ? 'Deleting...' : 'Delete Evaluation'}
        </button>
      </div>

      {/* Photo viewer modal */}
      {viewerIndex !== null && photoPaths.length > 0 && (
        <PhotoViewerModal
          photos={photoPaths.map((url, i) => ({ url, name: `Photo ${i + 1}` }))}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--color-overlay)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            padding: 32,
          }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            style={{
              background: 'var(--color-bg-surface-solid)',
              border: '1px solid var(--color-border-mid)',
              borderRadius: 12,
              padding: 24,
              maxWidth: 320,
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>
              Delete this Evaluation?
            </div>
            <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-2)', marginBottom: 20 }}>
              This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--color-border-mid)',
                  background: 'transparent',
                  color: 'var(--color-text-2)',
                  fontSize: 'var(--fs-md)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#EF4444',
                  color: '#fff',
                  fontSize: 'var(--fs-md)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
