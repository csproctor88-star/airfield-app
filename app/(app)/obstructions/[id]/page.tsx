'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { INSTALLATION } from '@/lib/constants'
import { fetchObstructionEvaluation, deleteObstructionEvaluation, type ObstructionRow } from '@/lib/supabase/obstructions'

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
}

const SURFACE_COLORS: Record<string, string> = {
  primary: '#EF4444',
  approach_departure: '#F97316',
  transitional: '#EAB308',
  inner_horizontal: '#22C55E',
  conical: '#3B82F6',
  outer_horizontal: '#8B5CF6',
}

export default function ObstructionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [evaluation, setEvaluation] = useState<ObstructionRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

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
        <div style={{ fontSize: 12, color: '#64748B' }}>Loading evaluation...</div>
      </div>
    )
  }

  if (!evaluation) {
    return (
      <div style={{ padding: 16 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#22D3EE', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'inherit' }}>
          ← Back
        </button>
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>Evaluation not found</div>
        </div>
      </div>
    )
  }

  const results = (evaluation.results || []) as SurfaceResult[]
  const applicableResults = results.filter((r) => r.isWithinBounds)
  const violatedResults = results.filter((r) => r.violated)
  const createdAt = new Date(evaluation.created_at)

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

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748B' }}>
          {evaluation.display_id}
        </span>
        <span
          style={{
            fontSize: 9,
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
            background: 'rgba(56,189,248,0.1)',
            border: '1px solid rgba(56,189,248,0.2)',
            borderRadius: 6,
            padding: '4px 12px',
            color: '#38BDF8',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Edit
        </button>
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
        Obstruction Evaluation
      </div>
      <div style={{ fontSize: 10, color: '#64748B', marginBottom: 14 }}>
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

      {/* Photos */}
      {evaluation.photo_storage_paths?.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {evaluation.photo_storage_paths.length === 1 ? (
            <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(56,189,248,0.1)' }}>
              <img
                src={evaluation.photo_storage_paths[0]}
                alt="Obstruction"
                style={{ width: '100%', maxHeight: 200, objectFit: 'cover' }}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
              {evaluation.photo_storage_paths.map((url: string, i: number) => (
                <div
                  key={i}
                  style={{
                    width: 120,
                    height: 90,
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: '1px solid rgba(56,189,248,0.1)',
                    flexShrink: 0,
                  }}
                >
                  <img
                    src={url}
                    alt={`Obstruction ${i + 1}`}
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11 }}>
          <div>
            <span style={{ color: '#64748B', fontSize: 10 }}>Height AGL</span>
            <div style={{ color: '#F1F5F9', fontWeight: 700, fontFamily: 'monospace' }}>
              {evaluation.object_height_agl} ft
            </div>
          </div>
          <div>
            <span style={{ color: '#64748B', fontSize: 10 }}>Top Elevation MSL</span>
            <div style={{ color: '#F1F5F9', fontWeight: 700, fontFamily: 'monospace' }}>
              {evaluation.obstruction_top_msl?.toFixed(0) ?? '—'} ft
            </div>
          </div>
          <div>
            <span style={{ color: '#64748B', fontSize: 10 }}>Ground Elevation MSL</span>
            <div style={{ color: '#F1F5F9', fontWeight: 700, fontFamily: 'monospace' }}>
              {evaluation.object_elevation_msl?.toFixed(0) ?? INSTALLATION.elevation_msl} ft
            </div>
          </div>
          <div>
            <span style={{ color: '#64748B', fontSize: 10 }}>From Centerline</span>
            <div style={{ color: '#F1F5F9', fontWeight: 700, fontFamily: 'monospace' }}>
              {evaluation.distance_from_centerline_ft?.toFixed(0) ?? '—'} ft
            </div>
          </div>
          <div>
            <span style={{ color: '#64748B', fontSize: 10 }}>Coordinates</span>
            <div style={{ color: '#CBD5E1', fontFamily: 'monospace', fontSize: 10 }}>
              {evaluation.latitude?.toFixed(5)}°N, {evaluation.longitude ? Math.abs(evaluation.longitude).toFixed(5) : '—'}°W
            </div>
          </div>
          <div>
            <span style={{ color: '#64748B', fontSize: 10 }}>Runway</span>
            <div style={{ color: '#F1F5F9', fontWeight: 700 }}>
              01/19 (Class B)
            </div>
          </div>
        </div>

        {evaluation.notes && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(56,189,248,0.06)' }}>
            <span style={{ color: '#64748B', fontSize: 10 }}>Description</span>
            <div style={{ color: '#CBD5E1', fontSize: 11, marginTop: 2 }}>
              {evaluation.notes}
            </div>
          </div>
        )}
      </div>

      {/* Controlling Surface */}
      {evaluation.controlling_surface && (
        <div className="card" style={{ marginBottom: 10 }}>
          <span className="section-label">Controlling Surface</span>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>
            {evaluation.controlling_surface}
          </div>
        </div>
      )}

      {/* Surface-by-surface results */}
      <div className="card" style={{ marginBottom: 10 }}>
        <span className="section-label">Surface Analysis</span>
        {applicableResults.map((s) => (
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
                  background: SURFACE_COLORS[s.surfaceKey] || '#94A3B8',
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
              Max allowable: <strong style={{ color: '#CBD5E1' }}>
                {s.maxAllowableHeightMSL.toFixed(0)} ft MSL
              </strong>{' '}
              ({s.maxAllowableHeightAGL.toFixed(0)} ft AGL)
            </div>
            {s.violated && (
              <div style={{ fontSize: 10, color: '#EF4444', marginTop: 2 }}>
                Penetration: {s.penetrationFt.toFixed(1)} ft above allowable height
              </div>
            )}
            <div style={{ fontSize: 9, color: '#64748B', marginTop: 4 }}>
              {s.ufcReference}
            </div>
            <div style={{ fontSize: 9, color: '#475569', marginTop: 2, lineHeight: 1.3, fontStyle: 'italic' }}>
              {s.ufcCriteria}
            </div>
          </div>
        ))}
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
          <div style={{ fontSize: 11, color: '#EF4444', fontWeight: 700, marginBottom: 8 }}>
            OBSTRUCTION VIOLATION DETECTED — The following actions are required:
          </div>
          <div style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.6, paddingLeft: 8 }}>
            1. Submit Work Order to CES (Civil Engineering Squadron) for evaluation and corrective action.
          </div>
          <div style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.6, paddingLeft: 8 }}>
            2. Per DAFI 13-213, Para 3.5 — Document all known airfield obstructions and coordinate waivers.
          </div>
          <div style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.6, paddingLeft: 8 }}>
            3. Per DAFMAN 13-204, Para 1.14 — Coordinate with ATC/RAPCON regarding obstruction impact on flying operations.
          </div>
          <div style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.6, paddingLeft: 8 }}>
            4. Submit a work order to CES and coordinate with the BCE to request a Permanent or Temporary Airspace Criteria Waiver.
          </div>
          {violatedResults.map((v, i) => (
            <div key={i} style={{ fontSize: 11, color: '#CBD5E1', lineHeight: 1.6, paddingLeft: 8, marginTop: 2 }}>
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
            fontSize: 11,
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

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
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
              background: '#0F172A',
              border: '1px solid rgba(56,189,248,0.15)',
              borderRadius: 12,
              padding: 24,
              maxWidth: 320,
              width: '100%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', marginBottom: 8 }}>
              Delete this Evaluation?
            </div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 20 }}>
              This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: '1px solid rgba(56,189,248,0.15)',
                  background: 'transparent',
                  color: '#94A3B8',
                  fontSize: 12,
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
                  fontSize: 12,
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
