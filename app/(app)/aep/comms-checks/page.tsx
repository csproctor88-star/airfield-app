'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Radio, CheckCircle2, Check, Plus, Trash2 } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import {
  fetchCurrentMonthCheck,
  fetchChecksInRange,
  saveCommsCheck,
  deleteCommsCheck,
  summarizeCommsCheck,
  fetchResponseAgencies,
  todayZuluDate,
  AEP_COMMS_STATUS_LABELS,
  AEP_COMMS_STATUS_COLORS,
  AEP_AGENCY_ROLE_LABELS,
  type AepCommsCheckWithResults,
  type AepCommsCheckStatus,
  type AepCommsCheckPeriod,
  type AepResponseAgency,
} from '@/lib/supabase/aep'
import { formatZuluDate } from '@/lib/utils'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * /aep/comms-checks — Monthly AEP response-agency comms verification.
 *
 * Forked from app/(app)/scn/page.tsx with three key differences:
 *   - "This month's check" card (cadence monthly, not daily)
 *   - Status modal supports the additional 'not_reached' value
 *   - History panel groups by calendar month, last 12 months
 *
 * Each completed check writes an `aep_comms` Events Log entry summarized
 * via `summarizeCommsCheck()` and feeds the SMS SPI compute on the next
 * pg_cron run.
 */

type AgencyDraft = {
  agency_id: string | null
  agency_name: string
  agency_role: AepResponseAgency['agency_role']
  sort_order: number
  status: AepCommsCheckStatus
  notes: string
}

type ModalState = {
  period: AepCommsCheckPeriod
  draft: AgencyDraft[]
  notes: string
  oosDialog: { idx: number } | null
}

export default function AepCommsChecksPage() {
  const { installationId } = useInstallation()
  const { has } = usePermissions()
  const [loaded, setLoaded] = useState(false)
  const [agencies, setAgencies] = useState<AepResponseAgency[]>([])
  const [thisMonth, setThisMonth] = useState<AepCommsCheckWithResults | null>(null)
  const [history, setHistory] = useState<AepCommsCheckWithResults[]>([])
  const [operatingInitials, setOperatingInitials] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [saving, setSaving] = useState(false)

  const canWrite = has(PERM.AEP_WRITE)

  const load = useCallback(async () => {
    if (!installationId) return
    const [ags, current] = await Promise.all([
      fetchResponseAgencies(installationId, true),
      fetchCurrentMonthCheck(installationId),
    ])
    setAgencies(ags)
    setThisMonth(current)

    // Trailing 12 months of history (excluding the current month's row,
    // which is shown in the top card already).
    const end = todayZuluDate()
    const start = new Date(Date.UTC(new Date().getUTCFullYear() - 1, new Date().getUTCMonth(), 1))
      .toISOString().slice(0, 10)
    const rows = await fetchChecksInRange(installationId, start, end)
    const currentId = current?.id ?? null
    setHistory(rows.filter(r => r.id !== currentId))
    setLoaded(true)
  }, [installationId])

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase
        .from('profiles')
        .select('operating_initials')
        .eq('id', data.user.id)
        .single()
        .then(({ data: profile }) => {
          const oi = (profile as { operating_initials?: string } | null)?.operating_initials
          if (oi) setOperatingInitials(oi)
        })
    })
  }, [])

  useEffect(() => { load() }, [load])

  function openModal(period: AepCommsCheckPeriod, edit?: AepCommsCheckWithResults) {
    if (agencies.length === 0) {
      toast.error('Add response agencies first under /aep/agencies.')
      return
    }
    const existingByName = new Map<string, { status: AepCommsCheckStatus; notes: string }>()
    if (edit) {
      for (const r of edit.results) existingByName.set(r.agency_name, { status: r.status, notes: r.notes || '' })
    }
    const draft: AgencyDraft[] = agencies.map((a, i) => {
      const prior = existingByName.get(a.agency_name)
      return {
        agency_id: a.id,
        agency_name: a.agency_name,
        agency_role: a.agency_role,
        sort_order: a.sort_order || i,
        status: prior?.status ?? 'loud_clear',
        notes: prior?.notes ?? '',
      }
    })
    setModal({ period, draft, notes: edit?.notes || '', oosDialog: null })
  }

  function setAgencyStatus(idx: number, status: AepCommsCheckStatus) {
    setModal(m => {
      if (!m) return m
      const next = [...m.draft]
      next[idx] = { ...next[idx], status }
      if (status === 'oos' && !next[idx].notes) {
        return { ...m, draft: next, oosDialog: { idx } }
      }
      return { ...m, draft: next }
    })
  }

  function setOosNotes(idx: number, notes: string) {
    setModal(m => {
      if (!m) return m
      const next = [...m.draft]
      next[idx] = { ...next[idx], notes }
      return { ...m, draft: next }
    })
  }

  async function handleSaveModal() {
    if (!modal || !installationId) return
    const missingNotes = modal.draft.find(d => d.status === 'oos' && !d.notes.trim())
    if (missingNotes) {
      toast.error(`"${missingNotes.agency_name}" is Out of Service — add notes before saving.`)
      return
    }
    setSaving(true)
    const res = await saveCommsCheck({
      baseId: installationId,
      checkDate: todayZuluDate(),
      checkPeriod: modal.period,
      operatingInitials,
      notes: modal.notes.trim() || null,
      agencies: modal.draft.map(d => ({
        agency_id: d.agency_id,
        agency_name: d.agency_name,
        agency_role: d.agency_role,
        status: d.status,
        notes: d.notes || null,
        sort_order: d.sort_order,
      })),
    })
    setSaving(false)
    if (res.error) { toast.error(res.error); return }
    toast.success('AEP comms check logged')
    setModal(null)
    load()
  }

  async function handleDelete(check: AepCommsCheckWithResults) {
    if (!confirm(`Delete the ${check.check_period} comms check for ${check.check_date}Z?`)) return
    const { error } = await deleteCommsCheck(check.id)
    if (error) { toast.error(error); return }
    toast.success('Check deleted')
    load()
  }

  if (!loaded) return <LoadingState message="Loading AEP comms log..." />

  return (
    <div className="page-container" style={{ maxWidth: 1000 }}>
      <Link href="/aep" style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        color: 'var(--color-text-3)', textDecoration: 'none',
        fontSize: 'var(--fs-sm)', marginBottom: 12,
      }}>
        <ArrowLeft size={14} /> Airport Emergency Plan
      </Link>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        paddingBottom: 12, marginBottom: 18,
        borderBottom: '1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)',
      }}>
        <Radio size={22} color="var(--color-warning)" />
        <div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>AEP Comms Checks</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
            Monthly response-agency comms verification — AC 150/5200-31C §2.3
          </div>
        </div>
      </div>

      {agencies.length === 0 && (
        <div style={{
          padding: 14, borderRadius: 'var(--radius-md)',
          background: 'color-mix(in srgb, var(--color-warning) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)',
          fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', marginBottom: 16,
        }}>
          <strong style={{ color: 'var(--color-warning)' }}>No response agencies configured.</strong>{' '}
          Add them at <Link href="/aep/agencies" style={{ color: 'var(--color-accent)' }}>Response Agencies</Link> before running a comms check.
        </div>
      )}

      {/* This month's check card */}
      <MonthlyCheckCard
        check={thisMonth}
        canWrite={canWrite && agencies.length > 0}
        onStart={() => openModal('monthly')}
        onEdit={(c) => openModal(c.check_period, c)}
        onDelete={canWrite ? handleDelete : undefined}
        agencyCount={agencies.length}
      />

      {/* History */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>
          Past 12 Months
        </div>
        {history.length === 0 ? (
          <EmptyState message="No prior AEP comms checks logged." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(h => (
              <HistoryRow
                key={h.id}
                check={h}
                onEdit={canWrite ? () => openModal(h.check_period, h) : undefined}
                onDelete={canWrite ? () => handleDelete(h) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Check modal */}
      {modal && (
        <ModalOverlay onClose={() => setModal(null)}>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 4 }}>
            {modal.period === 'monthly' ? 'Monthly Comms Check'
              : modal.period === 'quarterly' ? 'Quarterly Comms Check'
              : 'Ad-Hoc Comms Check'}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 14 }}>
            {formatZuluDate(todayZuluDate())} · attribution: {operatingInitials || '—'}
          </div>

          {modal.draft.some(d => d.status !== 'loud_clear') && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                onClick={() => setModal(m => m
                  ? { ...m, draft: m.draft.map(d => ({ ...d, status: 'loud_clear' as AepCommsCheckStatus })) }
                  : m)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 'var(--radius-md)',
                  border: '1px solid color-mix(in srgb, var(--color-success) 35%, transparent)',
                  background: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
                  color: 'var(--color-success)',
                  fontSize: 'var(--fs-sm)', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <Check size={13} strokeWidth={3} /> Mark All Loud &amp; Clear
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {modal.draft.map((d, i) => (
              <AgencyStatusRow
                key={`${d.agency_name}-${i}`}
                draft={d}
                onChange={(status) => setAgencyStatus(i, status)}
                onOpenOosNotes={() => setModal(m => m ? { ...m, oosDialog: { idx: i } } : m)}
              />
            ))}
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Overall Notes (optional)
            </div>
            <textarea
              value={modal.notes}
              onChange={e => setModal(m => m ? { ...m, notes: e.target.value } : m)}
              rows={2}
              placeholder="Any additional observations about the check..."
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)',
                color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit', resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              onClick={() => setModal(null)}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
                color: 'var(--color-text-2)', fontSize: 'var(--fs-md)', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <button
              disabled={saving}
              onClick={handleSaveModal}
              style={{
                flex: 2, padding: '10px 14px', borderRadius: 'var(--radius-md)',
                border: '1px solid color-mix(in srgb, var(--color-warning) 45%, transparent)',
                background: saving
                  ? 'var(--color-bg-elevated)'
                  : 'color-mix(in srgb, var(--color-warning) 20%, transparent)',
                color: saving ? 'var(--color-text-4)' : 'rgb(180,83,9)',
                fontSize: 'var(--fs-md)', fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <CheckCircle2 size={16} />
              {saving ? 'Saving…' : 'Log Check'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* OOS notes dialog */}
      {modal?.oosDialog && (() => {
        const { idx } = modal.oosDialog
        const d = modal.draft[idx]
        return (
          <ModalOverlay onClose={() => setModal(m => m ? { ...m, oosDialog: null } : m)} tightZ>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 4 }}>
              {d.agency_name} — Out of Service
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 10 }}>
              Explain why this agency is out of service. This note is logged in the check results and appears in the monthly PDF.
            </div>
            <textarea
              autoFocus
              value={d.notes}
              onChange={e => setOosNotes(idx, e.target.value)}
              rows={3}
              placeholder="e.g. Radio fault, land-line only. ETR unknown."
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)',
                color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit', resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => { setAgencyStatus(idx, 'loud_clear'); setOosNotes(idx, ''); setModal(m => m ? { ...m, oosDialog: null } : m) }}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
                  color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel OOS
              </button>
              <button
                onClick={() => setModal(m => m ? { ...m, oosDialog: null } : m)}
                disabled={!d.notes.trim()}
                style={{
                  flex: 2, padding: '8px 12px', borderRadius: 'var(--radius-md)',
                  border: '1px solid color-mix(in srgb, var(--color-danger) 45%, transparent)',
                  background: d.notes.trim()
                    ? 'color-mix(in srgb, var(--color-danger) 14%, transparent)'
                    : 'var(--color-bg-elevated)',
                  color: d.notes.trim() ? 'var(--color-danger)' : 'var(--color-text-4)',
                  fontSize: 'var(--fs-sm)', fontWeight: 700,
                  cursor: d.notes.trim() ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                }}
              >
                Save Notes
              </button>
            </div>
          </ModalOverlay>
        )
      })()}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Cards / rows
// ────────────────────────────────────────────────────────────────

function MonthlyCheckCard({
  check, canWrite, onStart, onEdit, onDelete, agencyCount,
}: {
  check: AepCommsCheckWithResults | null
  canWrite: boolean
  onStart: () => void
  onEdit: (c: AepCommsCheckWithResults) => void
  onDelete?: (c: AepCommsCheckWithResults) => void
  agencyCount: number
}) {
  const complete = !!check?.completed_at
  return (
    <div style={{
      padding: 14, borderRadius: 'var(--radius-md)',
      background: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border)',
      borderLeft: `3px solid ${complete ? 'var(--color-success)' : 'var(--color-warning)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Radio size={14} color={complete ? 'var(--color-success)' : 'var(--color-warning)'} />
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)' }}>
          This Month&apos;s Comms Check
        </div>
        {complete && (
          <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-success)', fontSize: 'var(--fs-xs)', fontWeight: 700 }}>
            <CheckCircle2 size={12} /> Complete
          </div>
        )}
      </div>

      {complete && check ? (
        <>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', lineHeight: 1.55, marginBottom: 8 }}>
            {summarizeCommsCheck(check)}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)', marginBottom: 10 }}>
            Logged {check.completed_at ? formatZuluDate(check.completed_at.slice(0, 10)) : '—'}
            {check.completed_by_oi ? ` · ${check.completed_by_oi}` : ''}
          </div>
          {canWrite && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => onEdit(check)} style={secondaryBtnStyle}>Edit Check</button>
              {onDelete && (
                <button onClick={() => onDelete(check)} style={{ ...secondaryBtnStyle, color: 'var(--color-danger)' }}>
                  <Trash2 size={12} style={{ marginRight: 4 }} /> Delete
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', marginBottom: 10 }}>
            {agencyCount === 0
              ? 'Add response agencies to enable comms checks.'
              : `Run a comms check against your ${agencyCount} active agencies.`}
          </div>
          {canWrite && (
            <button onClick={onStart} disabled={agencyCount === 0} style={agencyCount === 0 ? disabledBtnStyle : primaryBtnStyle}>
              <Plus size={14} style={{ marginRight: 4 }} /> Run Check
            </button>
          )}
        </>
      )}
    </div>
  )
}

function HistoryRow({ check, onEdit, onDelete }: {
  check: AepCommsCheckWithResults
  onEdit?: () => void
  onDelete?: () => void
}) {
  const exceptions = check.results.filter(r => r.status !== 'loud_clear').length
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
      display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center',
    }}>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', fontWeight: 600, minWidth: 120 }}>
        {formatZuluDate(check.check_date)}
      </div>
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
        {check.check_period} · {check.results.length} agencies
        {exceptions > 0 && (
          <span style={{ color: 'var(--color-warning)', marginLeft: 6 }}>
            ({exceptions} exception{exceptions === 1 ? '' : 's'})
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {onEdit && <button onClick={onEdit} style={smallBtnStyle}>Edit</button>}
        {onDelete && <button onClick={onDelete} style={{ ...smallBtnStyle, color: 'var(--color-danger)' }}>Delete</button>}
      </div>
    </div>
  )
}

function AgencyStatusRow({ draft, onChange, onOpenOosNotes }: {
  draft: AgencyDraft
  onChange: (status: AepCommsCheckStatus) => void
  onOpenOosNotes: () => void
}) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto', gap: 8,
      padding: '8px 10px', borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-1)' }}>
          {draft.agency_name}
        </div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 1 }}>
          {AEP_AGENCY_ROLE_LABELS[draft.agency_role]}
        </div>
        {draft.status === 'oos' && draft.notes && (
          <div
            onClick={onOpenOosNotes}
            style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-danger)', marginTop: 4, cursor: 'pointer', fontStyle: 'italic' }}
          >
            OOS: {draft.notes}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {(['loud_clear', 'no_response', 'oos', 'not_reached'] as AepCommsCheckStatus[]).map(s => (
          <button
            key={s}
            onClick={() => onChange(s)}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${draft.status === s ? AEP_COMMS_STATUS_COLORS[s] : 'var(--color-border)'}`,
              background: draft.status === s
                ? `color-mix(in srgb, ${AEP_COMMS_STATUS_COLORS[s]} 18%, transparent)`
                : 'transparent',
              color: draft.status === s ? AEP_COMMS_STATUS_COLORS[s] : 'var(--color-text-3)',
              fontSize: 'var(--fs-xs)', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {AEP_COMMS_STATUS_LABELS[s]}
          </button>
        ))}
      </div>
    </div>
  )
}

function ModalOverlay({ children, onClose, tightZ }: { children: React.ReactNode; onClose: () => void; tightZ?: boolean }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: tightZ ? 1001 : 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '5vh 10px',
        overflow: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 640, width: '100%',
          padding: 18, borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg-surface-solid)',
          border: '1px solid var(--color-border)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  padding: '8px 16px', borderRadius: 'var(--radius-sm)',
  border: '1px solid color-mix(in srgb, var(--color-warning) 50%, transparent)',
  background: 'color-mix(in srgb, var(--color-warning) 20%, transparent)',
  color: 'rgb(180,83,9)',
  fontSize: 'var(--fs-sm)', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
}

const disabledBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  opacity: 0.5, cursor: 'not-allowed',
}

const secondaryBtnStyle: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
  color: 'var(--color-text-2)', fontSize: 'var(--fs-xs)', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center',
}

const smallBtnStyle: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)',
  color: 'var(--color-text-2)', fontSize: 'var(--fs-xs)', cursor: 'pointer', fontFamily: 'inherit',
}
