'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchObstructionEvaluations, deleteObstructionEvaluation, type ObstructionRow } from '@/lib/supabase/obstructions'
import { formatDistanceToNow } from 'date-fns'

export default function ObstructionHistoryPage() {
  const router = useRouter()
  const [evaluations, setEvaluations] = useState<ObstructionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const data = await fetchObstructionEvaluations()
      setEvaluations(data)
      setLoading(false)
    }
    load()
  }, [])

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('Delete this evaluation? This cannot be undone.')) return
    setDeletingId(id)
    const { error } = await deleteObstructionEvaluation(id)
    if (error) {
      alert(error)
      setDeletingId(null)
      return
    }
    setEvaluations((prev) => prev.filter((ev) => ev.id !== id))
    setDeletingId(null)
  }

  return (
    <div style={{ padding: 16, paddingBottom: 120 }}>
      {/* Header */}
      <button
        onClick={() => router.push('/obstructions')}
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
        ← New Evaluation
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 800, flex: 1 }}>
          Evaluation History
        </div>
        {!loading && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#94A3B8',
              background: 'rgba(56,189,248,0.1)',
              padding: '2px 8px',
              borderRadius: 10,
            }}
          >
            {evaluations.length}
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          <div style={{ fontSize: 12, color: '#64748B' }}>Loading...</div>
        </div>
      ) : evaluations.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🗺️</div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>
            No evaluations yet
          </div>
          <div style={{ fontSize: 11, color: '#475569' }}>
            Saved obstruction evaluations will appear here.
          </div>
        </div>
      ) : (
        evaluations.map((ev) => {
          const createdAt = new Date(ev.created_at)
          const violatedCount = (ev.violated_surfaces || []).length

          return (
            <button
              key={ev.id}
              className="card"
              onClick={() => router.push(`/obstructions/${ev.id}`)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                cursor: 'pointer',
                marginBottom: 8,
                borderColor: ev.has_violation
                  ? 'rgba(239,68,68,0.15)'
                  : 'rgba(56,189,248,0.06)',
                fontFamily: 'inherit',
              }}
            >
              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 10,
                    color: '#64748B',
                  }}
                >
                  {ev.display_id}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: ev.has_violation ? '#EF444422' : '#22C55E22',
                    color: ev.has_violation ? '#EF4444' : '#22C55E',
                  }}
                >
                  {ev.has_violation ? 'VIOLATION' : 'CLEAR'}
                </span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 10, color: '#475569' }}>
                  {formatDistanceToNow(createdAt, { addSuffix: true })}
                </span>
              </div>

              {/* Description */}
              {ev.notes && (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#F1F5F9',
                    marginBottom: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ev.notes}
                </div>
              )}

              {/* Stats row */}
              <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#94A3B8' }}>
                <span>
                  <strong style={{ color: '#CBD5E1' }}>{ev.object_height_agl}</strong> ft AGL
                </span>
                <span>
                  <strong style={{ color: '#CBD5E1' }}>
                    {ev.distance_from_centerline_ft?.toFixed(0) ?? '—'}
                  </strong>{' '}
                  ft from CL
                </span>
                {ev.has_violation && (
                  <span style={{ color: '#EF4444' }}>
                    {violatedCount} surface{violatedCount !== 1 ? 's' : ''} violated
                  </span>
                )}
                {ev.controlling_surface && (
                  <span style={{ color: '#64748B' }}>
                    {ev.controlling_surface}
                  </span>
                )}
              </div>

              {/* Violation details */}
              {ev.has_violation && ev.violated_surfaces && ev.violated_surfaces.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {ev.violated_surfaces.map((s, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 9,
                        background: '#EF444414',
                        color: '#EF4444',
                        padding: '1px 6px',
                        borderRadius: 4,
                        border: '1px solid #EF444422',
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}

              {/* Photo indicator */}
              {ev.photo_storage_path && (
                <div style={{ marginTop: 4, fontSize: 10, color: '#38BDF8' }}>
                  📸 Photo attached
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(56,189,248,0.06)' }}>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); router.push(`/obstructions?edit=${ev.id}`) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); router.push(`/obstructions?edit=${ev.id}`) } }}
                  style={{ fontSize: 10, fontWeight: 600, color: '#38BDF8', cursor: 'pointer' }}
                >
                  Edit
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => handleDelete(e, ev.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleDelete(e as unknown as React.MouseEvent, ev.id) }}
                  style={{ fontSize: 10, fontWeight: 600, color: '#EF4444', cursor: 'pointer', opacity: deletingId === ev.id ? 0.5 : 1 }}
                >
                  {deletingId === ev.id ? 'Deleting...' : 'Delete'}
                </span>
              </div>
            </button>
          )
        })
      )}
    </div>
  )
}
