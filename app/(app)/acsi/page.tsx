'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { ACSI_STATUS_CONFIG } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { fetchAcsiInspections, deleteAcsiInspection, reopenAcsiInspection } from '@/lib/supabase/acsi-inspections'
import { WRITE_COMMITTED_EVENT, type WriteCommittedDetail } from '@/lib/sync/write-queue'
import { DEMO_ACSI_INSPECTIONS } from '@/lib/demo-data'
import { useInstallation } from '@/lib/installation-context'
import { getAirportType } from '@/lib/airport-mode'
import { usePermissions, PERM } from '@/lib/permissions'
import { toast } from 'sonner'
import type { AcsiInspection, AcsiStatus } from '@/lib/supabase/types'
import { Plus, ShieldCheck, Edit, RotateCcw, Trash2 } from 'lucide-react'

const FILTERS = ['all', 'draft', 'in_progress', 'completed', 'staffed'] as const
const FILTER_LABELS: Record<string, string> = {
  all: 'All',
  draft: 'Draft',
  in_progress: 'In Progress',
  completed: 'Completed',
  staffed: 'Staffed',
}

export default function AcsiListPage() {
  const router = useRouter()
  const { installationId, currentInstallation } = useInstallation()
  const { has } = usePermissions()
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [inspections, setInspections] = useState<AcsiInspection[]>([])
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // ACSI edit/delete gates driven by the permission matrix.
  const canEdit = has(PERM.ACSI_WRITE)
  const isAdmin = has(PERM.ACSI_DELETE)

  const load = useCallback(async () => {
    const supabase = createClient()
    if (!supabase) {
      setUsingDemo(true)
      setLoading(false)
      return
    }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)
    } catch { /* ignore */ }
    const data = await fetchAcsiInspections(installationId)
    setInspections(data)
    setLoading(false)
  }, [installationId])

  useEffect(() => {
    load()
  }, [load])

  // Re-fetch the list when an acsi_submit drains from the offline queue —
  // realtime doesn't catch UPDATE so the row's status flip would otherwise
  // stay invisible until manual refresh.
  useEffect(() => {
    const onCommit = (e: Event) => {
      const detail = (e as CustomEvent<WriteCommittedDetail>).detail
      if (detail?.type === 'acsi_submit') void load()
    }
    window.addEventListener(WRITE_COMMITTED_EVENT, onCommit)
    return () => window.removeEventListener(WRITE_COMMITTED_EVENT, onCommit)
  }, [load])

  const allItems = (usingDemo ? DEMO_ACSI_INSPECTIONS : inspections) as AcsiInspection[]
  const q = search.toLowerCase()

  const filtered = allItems.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false
    if (q && !item.display_id.toLowerCase().includes(q) && !item.airfield_name.toLowerCase().includes(q) && !(item.inspector_name || '').toLowerCase().includes(q)) return false
    return true
  })

  // KPI counts
  const totalCount = allItems.length
  const completedCount = allItems.filter(i => i.status === 'completed' || i.status === 'staffed').length
  const inProgressCount = allItems.filter(i => i.status === 'in_progress').length
  const draftCount = allItems.filter(i => i.status === 'draft').length

  // Mode-aware header: FAA Part 139 airports run the annual certification
  // inspection (14 CFR Part 139); USAF bases run the ACSI (DAFMAN 13-204v2).
  const isFaaMode = getAirportType(currentInstallation) === 'faa_part139'
  const inspectionTitle = isFaaMode
    ? 'Part 139 Annual Inspection'
    : 'Airfield Compliance and Safety Inspection'
  const inspectionCite = isFaaMode ? '14 CFR Part 139' : 'DAFMAN 13-204v2, Para 5.4.3'
  const inspNoun = isFaaMode ? 'Part 139' : 'ACSI'

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)', margin: 0 }}>
            {inspectionTitle}
          </h1>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', margin: '4px 0 0' }}>
            {inspectionCite}
          </p>
        </div>
        <Link href="/acsi/new" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 16px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-cyan)',
          background: 'color-mix(in srgb, var(--color-cyan) 14%, var(--color-bg-surface))',
          color: 'var(--color-cyan)',
          textDecoration: 'none',
          fontWeight: 700,
          fontSize: 'var(--fs-sm)',
        }}>
          <Plus size={14} /> Start New {inspNoun} Inspection
        </Link>
      </div>

      {/* KPI Badges */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total', value: totalCount, color: 'var(--color-text-1)' },
          { label: 'Completed', value: completedCount, color: 'var(--color-green)' },
          { label: 'In Progress', value: inProgressCount, color: 'var(--color-blue)' },
          { label: 'Drafts', value: draftCount, color: 'var(--color-text-3)' },
        ].map(kpi => (
          <div key={kpi.label} style={{
            padding: '12px 20px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-surface)',
            textAlign: 'center',
            minWidth: 100,
          }}>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, color: kpi.color }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
              {kpi.label}
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search inspections..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-input)',
            color: 'var(--color-text-1)',
            fontSize: 'var(--fs-sm)',
            flex: 1,
            minWidth: 200,
          }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(f => {
            const selected = filter === f
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '6px 13px',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'inherit',
                  border: selected ? '1px solid var(--color-cyan)' : '1px solid var(--color-border)',
                  background: selected
                    ? 'color-mix(in srgb, var(--color-cyan) 14%, var(--color-bg-surface))'
                    : 'var(--color-bg-inset)',
                  color: selected ? 'var(--color-cyan)' : 'var(--color-text-2)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {FILTER_LABELS[f]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-3)' }}>
          Loading inspections...
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: 60,
          color: 'var(--color-text-3)',
          border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius-md)',
        }}>
          <ShieldCheck size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 500 }}>No {inspNoun} inspections found</div>
          <div style={{ fontSize: 'var(--fs-sm)', marginTop: 4 }}>Click &ldquo;Start New {inspNoun} Inspection&rdquo; to begin the annual inspection</div>
        </div>
      )}

      {/* Card list */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(insp => {
            const statusCfg = ACSI_STATUS_CONFIG[insp.status as AcsiStatus] || ACSI_STATUS_CONFIG.draft
            const total = insp.passed_count + insp.failed_count + insp.na_count
            const pct = insp.total_items > 0 ? Math.round((total / insp.total_items) * 100) : 0
            const isFiled = insp.status === 'completed' || insp.status === 'staffed'
            const isFiler = currentUserId && (insp.filed_by_id === currentUserId || insp.saved_by_id === currentUserId || insp.inspector_id === currentUserId)
            const showReopen = isFiled && (canEdit || isFiler)
            const showEdit = !isFiled && (canEdit || isFiler)
            const showDelete = isAdmin || (canEdit && !isFiled) || (isFiler && !isFiled)
            const isBusy = actionLoading === insp.id

            return (
              <div
                key={insp.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  rowGap: 8,
                  padding: '14px 18px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  borderLeft: `3px solid ${statusCfg.color}`,
                  background: 'var(--color-bg-surface-solid)',
                  flexWrap: 'wrap',
                }}
              >
                {/* Display ID + airfield — clickable link */}
                <Link
                  href={isFiled ? `/acsi/${insp.id}` : `/acsi/new?resume=${insp.id}`}
                  style={{ flex: 1, minWidth: 160, textDecoration: 'none', color: 'var(--color-text-1)' }}
                >
                  <div style={{ fontWeight: 600, fontSize: 'var(--fs-base)' }}>
                    {insp.display_id}
                  </div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>
                    {insp.airfield_name || 'Unnamed'} — {insp.fiscal_year}
                  </div>
                </Link>

                {/* Secondary metadata. For drafts with zero responses
                    the 0% / 0P 0F 0NA cluster is visual noise — render
                    a single 'Not started' anchor instead so the row
                    reads cleanly until work begins. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}>
                    {insp.inspection_date}
                  </div>
                  {total === 0 ? (
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                      Not started
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', whiteSpace: 'nowrap', minWidth: 40, textAlign: 'right' }}>
                        {pct}%
                      </div>
                      <div style={{ display: 'flex', gap: 6, fontSize: 'var(--fs-xs)' }}>
                        <span style={{ color: 'var(--color-green)', fontWeight: 600 }}>{insp.passed_count}P</span>
                        <span style={{ color: 'var(--color-red)', fontWeight: 600 }}>{insp.failed_count}F</span>
                        <span style={{ color: 'var(--color-text-3)', fontWeight: 600 }}>{insp.na_count}NA</span>
                      </div>
                    </>
                  )}
                  <Badge label={statusCfg.label} color={statusCfg.color} />
                  <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>
                    {insp.inspector_name || '—'}
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {showEdit && (
                    <button
                      onClick={() => router.push(`/acsi/new?resume=${insp.id}`)}
                      disabled={isBusy}
                      title="Edit"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-cyan)', background: 'transparent',
                        color: 'var(--color-cyan)', fontSize: 'var(--fs-xs)', fontWeight: 600,
                        cursor: 'pointer', opacity: isBusy ? 0.5 : 1,
                      }}
                    >
                      <Edit size={12} /> Edit
                    </button>
                  )}
                  {showReopen && (
                    <button
                      onClick={async () => {
                        if (!confirm(`Reopen this ${inspNoun} inspection for editing?`)) return
                        setActionLoading(insp.id)
                        const { error } = await reopenAcsiInspection(insp.id)
                        setActionLoading(null)
                        if (error) {
                          toast.error(`Reopen failed: ${error}`)
                        } else {
                          toast.success(`${inspNoun} inspection reopened`)
                          router.push(`/acsi/new?resume=${insp.id}`)
                        }
                      }}
                      disabled={isBusy}
                      title="Reopen for Editing"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-cyan)', background: 'transparent',
                        color: 'var(--color-cyan)', fontSize: 'var(--fs-xs)', fontWeight: 600,
                        cursor: 'pointer', opacity: isBusy ? 0.5 : 1,
                      }}
                    >
                      <RotateCcw size={12} /> Reopen
                    </button>
                  )}
                  {showDelete && (
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete this ${inspNoun} inspection? This cannot be undone.`)) return
                        setActionLoading(insp.id)
                        const { error } = await deleteAcsiInspection(insp.id)
                        setActionLoading(null)
                        if (error) {
                          toast.error(`Delete failed: ${error}`)
                        } else {
                          toast.success(`${inspNoun} inspection deleted`)
                          setInspections(prev => prev.filter(i => i.id !== insp.id))
                        }
                      }}
                      disabled={isBusy}
                      title="Delete"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-red)', background: 'transparent',
                        color: 'var(--color-red)', fontSize: 'var(--fs-xs)', fontWeight: 600,
                        cursor: 'pointer', opacity: isBusy ? 0.5 : 1,
                      }}
                    >
                      <Trash2 size={12} /> Del
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
