'use client'

import { useEffect, useState, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { fetchObstructionEvaluations, deleteObstructionEvaluation, parsePhotoPaths, type ObstructionRow } from '@/lib/supabase/obstructions'
import { useInstallation } from '@/lib/installation-context'
import { formatDistanceToNow } from 'date-fns'
import { Map, List, History as HistoryIcon, ArrowLeft, Search, X, Trash2 } from 'lucide-react'
import { formatZuluDate } from '@/lib/utils'
import { getSurfaceSet } from '@/lib/airport-mode'
import type { SurfaceSet } from '@/lib/calculations/obstructions'
import { resolveStandardLabel } from '@/lib/calculations/surface-standards'
import { baseDistanceUnit, fmtDistance } from '@/lib/distance-units'

const ObstructionMapView = lazy(() => import('@/components/obstructions/obstruction-map-view-google'))

// Searched in place of a bare runway_class — NULL-safe (Part 77 rows may
// carry NULL) and matches on the resolved standard label ("UFC 3-260-01 —
// Air Force Class A", "FAA Part 77 (14 CFR §77.19)") instead of the raw enum.
function matchesSearch(ev: ObstructionRow, query: string, standardLabel: string): boolean {
  const q = query.toLowerCase()
  const fields: string[] = [
    ev.display_id ?? '',
    ev.notes ?? '',
    ev.description ?? '',
    ev.controlling_surface ?? '',
    standardLabel,
    ev.has_violation ? 'violation' : 'clear',
    ev.object_height_agl != null ? `${ev.object_height_agl}` : '',
    ev.distance_from_centerline_ft != null ? `${ev.distance_from_centerline_ft}` : '',
    ev.object_elevation_msl != null ? `${ev.object_elevation_msl}` : '',
    ev.obstruction_top_msl != null ? `${ev.obstruction_top_msl}` : '',
    ev.latitude != null ? `${ev.latitude}` : '',
    ev.longitude != null ? `${ev.longitude}` : '',
    ...(ev.violated_surfaces ?? []),
    formatZuluDate(new Date(ev.created_at)),
  ]
  return fields.some((f) => f.toLowerCase().includes(q))
}

export default function ObstructionHistoryPage() {
  const router = useRouter()
  const { installationId, currentInstallation } = useInstallation()
  // Base display unit for the stats row (feet is identity for US bases).
  const resultUnit = baseDistanceUnit(currentInstallation)
  const [evaluations, setEvaluations] = useState<ObstructionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'map'>('map')

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

  // Legacy rows (NULL surface_set) fall back to the base's current default —
  // mirrors the [id] detail page's `pinnedSet ?? base default` idiom, so
  // search never disagrees with what the detail page displays.
  const standardLabelFor = (ev: ObstructionRow): string =>
    resolveStandardLabel(
      (ev.surface_set as SurfaceSet | null | undefined) ?? getSurfaceSet(currentInstallation),
      ev.runway_class,
    )

  const filtered = search.trim()
    ? evaluations.filter((ev) => matchesSearch(ev, search.trim(), standardLabelFor(ev)))
    : evaluations

  return (
    <div className="page-container" style={{ paddingBottom: 120 }}>
      {/* Back link */}
      <button
        onClick={() => router.push('/obstructions')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)',
          padding: 0, marginBottom: 12, fontFamily: 'inherit',
        }}
      >
        <ArrowLeft size={14} /> New Evaluation
      </button>

      {/* Page header — tertiary tier-label + cyan accent rule */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, paddingBottom: 8, marginBottom: 14, flexWrap: 'wrap',
        borderBottom: '1px solid color-mix(in srgb, var(--color-cyan) 30%, transparent)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <HistoryIcon size={16} color="var(--color-cyan)" />
          <div style={{
            fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>Evaluation History</div>
          {!loading && (
            <span style={{
              fontSize: 'var(--fs-2xs)', fontWeight: 700,
              padding: '2px 9px', borderRadius: 'var(--radius-full)',
              background: 'color-mix(in srgb, var(--color-cyan) 14%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-cyan) 35%, transparent)',
              color: 'var(--color-cyan)', letterSpacing: '0.04em',
            }}>
              {search.trim() ? `${filtered.length} / ${evaluations.length}` : evaluations.length}
            </span>
          )}
        </div>
      </div>

      {/* Search + Map/List toggle */}
      {!loading && evaluations.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'stretch' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              className="input-dark"
              placeholder="Search evaluations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 32, paddingRight: search ? 32 : undefined, height: '100%' }}
            />
            <Search
              size={14}
              color="var(--color-text-3)"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-3)',
                  cursor: 'pointer',
                  padding: 4,
                  lineHeight: 1,
                  fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div style={{ display: 'flex', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
            <button
              onClick={() => setViewMode('map')}
              title="Map view"
              aria-label="Map view"
              style={{
                background: viewMode === 'map'
                  ? 'color-mix(in srgb, var(--color-cyan) 14%, transparent)'
                  : 'transparent',
                border: 'none',
                borderRight: '1px solid var(--color-border)',
                padding: '6px 10px',
                color: viewMode === 'map' ? 'var(--color-cyan)' : 'var(--color-text-3)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              <Map size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="List view"
              aria-label="List view"
              style={{
                background: viewMode === 'list'
                  ? 'color-mix(in srgb, var(--color-cyan) 14%, transparent)'
                  : 'transparent',
                border: 'none',
                padding: '6px 10px',
                color: viewMode === 'list' ? 'var(--color-cyan)' : 'var(--color-text-3)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-3)' }}>Loading...</div>
        </div>
      ) : evaluations.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 40 }}>
          <div style={{ fontSize: 'var(--fs-5xl)', marginBottom: 8 }}>&#x1F5FA;&#xFE0F;</div>
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--color-text-3)', marginBottom: 4 }}>
            No evaluations yet
          </div>
          <div style={{ fontSize: 'var(--fs-base)', color: 'var(--color-text-3)' }}>
            Saved obstruction evaluations will appear here.
          </div>
        </div>
      ) : (
        <>
          {/* Map view */}
          {viewMode === 'map' && (
            <Suspense
              fallback={
                <div className="card" style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>
                  Loading map...
                </div>
              }
            >
              <ObstructionMapView evaluations={filtered} />
            </Suspense>
          )}

          {/* List heading when map is shown */}
          {viewMode === 'map' && filtered.length > 0 && (
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-3)', marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              All Evaluations ({filtered.length})
            </div>
          )}

          {filtered.length === 0 ? (
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
                  ? 'color-mix(in srgb, var(--color-danger) 25%, transparent)'
                  : 'var(--color-border)',
                borderLeft: ev.has_violation
                  ? '3px solid var(--color-danger)'
                  : '3px solid var(--color-success)',
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
                    fontSize: 'var(--fs-2xs)',
                    fontWeight: 700,
                    padding: '1px 9px',
                    borderRadius: 'var(--radius-full)',
                    background: ev.has_violation
                      ? 'color-mix(in srgb, var(--color-danger) 14%, transparent)'
                      : 'color-mix(in srgb, var(--color-success) 14%, transparent)',
                    border: ev.has_violation
                      ? '1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)'
                      : '1px solid color-mix(in srgb, var(--color-success) 35%, transparent)',
                    color: ev.has_violation ? 'var(--color-danger)' : 'var(--color-success)',
                    letterSpacing: '0.04em',
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
                  <strong style={{ color: 'var(--color-text-1)' }}>{fmtDistance(ev.object_height_agl, resultUnit, { withUnit: false })}</strong> {resultUnit} AGL
                </span>
                <span>
                  <strong style={{ color: 'var(--color-text-1)' }}>
                    {ev.distance_from_centerline_ft != null ? fmtDistance(ev.distance_from_centerline_ft, resultUnit, { withUnit: false }) : '—'}
                  </strong>{' '}
                  {resultUnit} from CL
                </span>
                {ev.has_violation && (
                  <span style={{ color: 'var(--color-danger)' }}>
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
                        fontSize: 'var(--fs-2xs)', fontWeight: 700,
                        background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
                        color: 'var(--color-danger)',
                        padding: '1px 8px',
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)',
                        letterSpacing: '0.04em',
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
                  style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-danger)', cursor: 'pointer', opacity: deletingId === ev.id ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <Trash2 size={12} />
                  {deletingId === ev.id ? 'Deleting...' : 'Delete'}
                </span>
              </div>
            </button>
          )
        })
          )}
        </>
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
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid color-mix(in srgb, var(--color-danger) 45%, transparent)',
                  background: 'color-mix(in srgb, var(--color-danger) 18%, transparent)',
                  color: 'var(--color-danger)',
                  fontSize: 'var(--fs-md)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
