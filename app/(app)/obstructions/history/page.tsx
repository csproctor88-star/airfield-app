'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchObstructionEvaluations, deleteObstructionEvaluation, parsePhotoPaths, type ObstructionRow } from '@/lib/supabase/obstructions'
import { useInstallation } from '@/lib/installation-context'
import { formatDistanceToNow } from 'date-fns'

function matchesSearch(ev: ObstructionRow, query: string): boolean {
  const q = query.toLowerCase()
  const fields: string[] = [
    ev.display_id,
    ev.notes ?? '',
    ev.description ?? '',
    ev.controlling_surface ?? '',
    ev.runway_class,
    ev.has_violation ? 'violation' : 'clear',
    ev.object_height_agl != null ? `${ev.object_height_agl}` : '',
    ev.distance_from_centerline_ft != null ? `${ev.distance_from_centerline_ft}` : '',
    ev.object_elevation_msl != null ? `${ev.object_elevation_msl}` : '',
    ev.obstruction_top_msl != null ? `${ev.obstruction_top_msl}` : '',
    ev.latitude != null ? `${ev.latitude}` : '',
    ev.longitude != null ? `${ev.longitude}` : '',
    ...(ev.violated_surfaces ?? []),
    new Date(ev.created_at).toLocaleDateString(),
  ]
  return fields.some((f) => f.toLowerCase().includes(q))
}

export default function ObstructionHistoryPage() {
  const router = useRouter()
  const { installationId } = useInstallation()
  const [evaluations, setEvaluations] = useState<ObstructionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const data = await fetchObstructionEvaluations(installationId)
      setEvaluations(data)
      setLoading(false)
    }
    load()
  }, [installationId])

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setConfirmDeleteId(id)
  }

  const confirmDelete = async () => {
    if (!confirmDeleteId) return
    setDeletingId(confirmDeleteId)
    setConfirmDeleteId(null)
    const { error } = await deleteObstructionEvaluation(confirmDeleteId)
    if (error) {
      alert(error)
      setDeletingId(null)
      return
    }
    setEvaluations((prev) => prev.filter((ev) => ev.id !== confirmDeleteId))
    setDeletingId(null)
  }

  const filtered = search.trim()
    ? evaluations.filter((ev) => matchesSearch(ev, search.trim()))
    : evaluations

  return (
    <div className="page-container" style={{ paddingBottom: 120 }}>
      {/* Header */}
      <button
        onClick={() => router.push('/obstructions')}
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
        ← New Evaluation
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, flex: 1 }}>
          Evaluation History
        </div>
        {!loading && (
          <span
            style={{
              fontSize: 'var(--fs-sm)',
              fontWeight: 700,
              color: 'var(--color-text-2)',
              background: 'var(--color-border-mid)',
              padding: '2px 8px',
              borderRadius: 10,
            }}
          >
            {search.trim() ? `${filtered.length} / ${evaluations.length}` : evaluations.length}
          </span>
        )}
      </div>

      {/* Search */}
      {!loading && evaluations.length > 0 && (
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input
            type="text"
            className="input-dark"
            placeholder="Search evaluations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 32, paddingRight: search ? 32 : undefined }}
          />
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-text-3)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--color-text-3)',
                fontSize: 'var(--fs-2xl)',
                cursor: 'pointer',
                padding: '0 4px',
                lineHeight: 1,
                fontFamily: 'inherit',
              }}
            >
              ×
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-3)' }}>Loading...</div>
        </div>
      ) : evaluations.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          <div style={{ fontSize: 'var(--fs-5xl)', marginBottom: 8 }}>🗺️</div>
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-3)', marginBottom: 4 }}>
            No evaluations yet
          </div>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>
            Saved obstruction evaluations will appear here.
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-3)', marginBottom: 4 }}>
            No evaluations match &ldquo;{search.trim()}&rdquo;
          </div>
          <button
            type="button"
            onClick={() => setSearch('')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-accent)',
              fontSize: 'var(--fs-base)',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: 0,
            }}
          >
            Clear search
          </button>
        </div>
      ) : (
        filtered.map((ev) => {
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
                  : 'var(--color-border)',
                fontFamily: 'inherit',
              }}
            >
              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 'var(--fs-sm)',
                    color: 'var(--color-text-3)',
                  }}
                >
                  {ev.display_id}
                </span>
                <span
                  style={{
                    fontSize: 'var(--fs-xs)',
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
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
                  {formatDistanceToNow(createdAt, { addSuffix: true })}
                </span>
              </div>

              {/* Description */}
              {ev.notes && (
                <div
                  style={{
                    fontSize: 'var(--fs-md)',
                    fontWeight: 600,
                    color: 'var(--color-text-1)',
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
              <div style={{ display: 'flex', gap: 12, fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
                <span>
                  <strong style={{ color: 'var(--color-text-1)' }}>{ev.object_height_agl}</strong> ft AGL
                </span>
                <span>
                  <strong style={{ color: 'var(--color-text-1)' }}>
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
                  <span style={{ color: 'var(--color-text-3)' }}>
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
                        fontSize: 'var(--fs-xs)',
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

              {/* Photo thumbnails */}
              {parsePhotoPaths(ev.photo_storage_path).length > 0 && (
                <div className="photo-grid" style={{ marginTop: 6, alignItems: 'center' }}>
                  {parsePhotoPaths(ev.photo_storage_path).slice(0, 4).map((url, pi) => (
                    <div
                      key={pi}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 6,
                        overflow: 'hidden',
                        border: '1px solid var(--color-border-mid)',
                        flexShrink: 0,
                      }}
                    >
                      <img
                        src={url}
                        alt={`Photo ${pi + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  ))}
                  {parsePhotoPaths(ev.photo_storage_path).length > 4 && (
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                      +{parsePhotoPaths(ev.photo_storage_path).length - 4} more
                    </span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); router.push(`/obstructions?edit=${ev.id}`) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); router.push(`/obstructions?edit=${ev.id}`) } }}
                  style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-accent)', cursor: 'pointer' }}
                >
                  Edit
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => handleDelete(e, ev.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleDelete(e as unknown as React.MouseEvent, ev.id) }}
                  style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: '#EF4444', cursor: 'pointer', opacity: deletingId === ev.id ? 0.5 : 1 }}
                >
                  {deletingId === ev.id ? 'Deleting...' : 'Delete'}
                </span>
              </div>
            </button>
          )
        })
      )}

      {/* Delete confirmation dialog */}
      {confirmDeleteId && (
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
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            style={{
              background: 'var(--color-bg-surface-solid)',
              border: '1px solid var(--color-border-mid)',
              borderRadius: 12,
              padding: 24,
              maxWidth: 'min(90vw, 400px)',
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
                onClick={() => setConfirmDeleteId(null)}
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
                onClick={confirmDelete}
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
