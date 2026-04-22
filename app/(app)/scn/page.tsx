'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Download, Mail, Radio, Plus, CheckCircle2 } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import {
  fetchTodayChecks,
  fetchChecksInRange,
  saveCheck,
  deleteCheck,
  summarizeCheck,
  todayZuluDate,
  SCN_STATUS_LABELS,
  SCN_STATUS_COLORS,
  type ScnCheckType,
  type ScnAgencyStatus,
  type ScnCheckWithResults,
} from '@/lib/supabase/scn'
import { fetchScnAgencies, type ScnAgency } from '@/lib/supabase/scn-agencies'
import { formatZuluDate, formatZuluTime } from '@/lib/utils'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'

type AgencyDraft = { agency_id: string | null; agency_name: string; sort_order: number; status: ScnAgencyStatus; notes: string }

export default function ScnPage() {
  const { installationId } = useInstallation()
  const { has } = usePermissions()
  const [loaded, setLoaded] = useState(false)
  const [agencies, setAgencies] = useState<ScnAgency[]>([])
  const [todayChecks, setTodayChecks] = useState<ScnCheckWithResults[]>([])
  const [history, setHistory] = useState<ScnCheckWithResults[]>([])
  const [operatingInitials, setOperatingInitials] = useState<string | null>(null)

  // Modal state
  const [modal, setModal] = useState<{ type: ScnCheckType; draft: AgencyDraft[]; notes: string; oosDialog: { idx: number } | null } | null>(null)
  const [saving, setSaving] = useState(false)

  // Monthly PDF range (default: this calendar month in Zulu)
  const [pdfMonth, setPdfMonth] = useState<string>(() => todayZuluDate().slice(0, 7)) // YYYY-MM

  const canWrite = has(PERM.SCN_WRITE)

  const load = useCallback(async () => {
    if (!installationId) return
    const [ags, today] = await Promise.all([
      fetchScnAgencies(installationId, true),
      fetchTodayChecks(installationId),
    ])
    setAgencies(ags)
    setTodayChecks(today)

    // 30-day rolling history below today's card
    const end = todayZuluDate()
    const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const rows = await fetchChecksInRange(installationId, start, end)
    // Keep only rows from strictly before today for the history panel
    setHistory(rows.filter(r => r.check_date !== end))

    setLoaded(true)
  }, [installationId])

  // Load user's operating initials for attribution
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

  const primaryToday = todayChecks.find(c => c.check_type === 'primary')
  const backupToday = todayChecks.find(c => c.check_type === 'backup')

  function openModal(type: ScnCheckType, edit?: ScnCheckWithResults) {
    if (agencies.length === 0) {
      toast.error('Configure SCN agencies in Base Setup before starting a check.')
      return
    }
    const existingByName = new Map<string, { status: ScnAgencyStatus; notes: string }>()
    if (edit) {
      for (const r of edit.results) existingByName.set(r.agency_name, { status: r.status, notes: r.notes || '' })
    }
    const draft: AgencyDraft[] = agencies.map((a, i) => {
      const prior = existingByName.get(a.agency_name)
      return {
        agency_id: a.id,
        agency_name: a.agency_name,
        sort_order: a.sort_order || i,
        status: prior?.status ?? 'loud_clear',
        notes: prior?.notes ?? '',
      }
    })
    setModal({ type, draft, notes: edit?.notes || '', oosDialog: null })
  }

  function setAgencyStatus(idx: number, status: ScnAgencyStatus) {
    setModal(m => {
      if (!m) return m
      const next = [...m.draft]
      next[idx] = { ...next[idx], status }
      // When switching to OOS, open the notes dialog for that agency
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
    // Block save if an OOS row has no notes
    const missing = modal.draft.find(d => d.status === 'oos' && !d.notes.trim())
    if (missing) {
      toast.error(`"${missing.agency_name}" is Out of Service — add notes before saving.`)
      return
    }
    setSaving(true)
    const res = await saveCheck({
      baseId: installationId,
      checkDate: todayZuluDate(),
      checkType: modal.type,
      operatingInitials,
      notes: modal.notes.trim() || null,
      agencies: modal.draft.map(d => ({
        agency_id: d.agency_id,
        agency_name: d.agency_name,
        status: d.status,
        notes: d.notes || null,
        sort_order: d.sort_order,
      })),
    })
    setSaving(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    toast.success(modal.type === 'backup' ? 'Monthly Back-up SCN check logged' : 'Daily SCN check logged')
    setModal(null)
    load()
  }

  async function handleDelete(check: ScnCheckWithResults) {
    if (!confirm(`Delete the ${check.check_type === 'backup' ? 'monthly' : 'daily'} SCN check for ${check.check_date}Z?`)) return
    const { error } = await deleteCheck(check.id)
    if (error) { toast.error(error); return }
    toast.success('Check deleted')
    load()
  }

  const handleDownloadPdf = async () => {
    if (!installationId) return
    try {
      const { generateScnMonthlyPdf } = await import('@/lib/scn-pdf')
      const [y, m] = pdfMonth.split('-').map(n => parseInt(n, 10))
      const start = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10)
      const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
      const checks = await fetchChecksInRange(installationId, start, end)
      const allAgencies = await fetchScnAgencies(installationId)
      const { doc, filename } = generateScnMonthlyPdf({
        baseName: 'SCN Daily Check Log',
        monthYyyyMm: pdfMonth,
        checks,
        agencies: allAgencies.map(a => a.agency_name),
      })
      doc.save(filename)
      toast.success('Monthly Back-up SCN PDF downloaded')
    } catch (e) {
      console.error(e)
      toast.error('Failed to generate PDF')
    }
  }

  if (!loaded) {
    return (
      <div className="page-container">
        <LoadingState message="Loading SCN log..." />
      </div>
    )
  }

  return (
    <div className="page-container">
      <Link href="/more" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-text-3)', textDecoration: 'none', fontSize: 'var(--fs-sm)', marginBottom: 10 }}>
        <ArrowLeft size={14} /> Back
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, background: 'var(--color-warning)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
        }}>
          <Radio size={22} />
        </div>
        <div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>Secondary Crash Net</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>Daily check log — {formatZuluDate(todayZuluDate())}</div>
        </div>
      </div>

      {/* No agencies warning */}
      {agencies.length === 0 && (
        <div style={{
          marginTop: 14, padding: '12px 14px', borderRadius: 'var(--radius-md)',
          background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.35)',
          fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)',
        }}>
          <strong style={{ color: 'var(--color-warning)' }}>No agencies configured.</strong>{' '}
          Admins can add SCN agencies in <Link href="/settings/base-setup" style={{ color: 'var(--color-cyan)', textDecoration: 'none' }}>Base Setup → SCN Agencies</Link>.
        </div>
      )}

      {/* Today's primary check card */}
      <div style={{ marginTop: 14, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <TodayCheckCard
          label="Daily SCN Check"
          check={primaryToday}
          onStart={() => openModal('primary')}
          onEdit={(c) => openModal('primary', c)}
          onDelete={canWrite ? handleDelete : undefined}
          canWrite={canWrite}
          hasAgencies={agencies.length > 0}
        />
        <TodayCheckCard
          label="Monthly Back-up SCN Check"
          check={backupToday}
          onStart={() => openModal('backup')}
          onEdit={(c) => openModal('backup', c)}
          onDelete={canWrite ? handleDelete : undefined}
          canWrite={canWrite}
          hasAgencies={agencies.length > 0}
        />
      </div>

      {/* Monthly PDF export */}
      <div style={{
        marginTop: 20, padding: '12px 14px', borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', fontWeight: 600 }}>
          Monthly Report
        </div>
        <input
          type="month"
          value={pdfMonth}
          onChange={e => setPdfMonth(e.target.value)}
          style={{
            padding: '6px 10px', borderRadius: 'var(--radius-sm)',
            background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)',
            color: 'var(--color-text-1)', fontFamily: 'inherit', fontSize: 'var(--fs-sm)',
          }}
        />
        <div style={{ flex: 1 }} />
        <button
          onClick={handleDownloadPdf}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
            background: 'var(--color-bg-inset)', color: 'var(--color-text-2)',
            fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <Download size={14} /> Download PDF
        </button>
      </div>

      {/* 30-day history */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>
          Past 30 Days
        </div>
        {history.length === 0 ? (
          <EmptyState message="No primary or backup SCN checks recorded in the past 30 days." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(h => (
              <HistoryRow key={h.id} check={h} onEdit={canWrite ? (c) => openModal(c.check_type, c) : undefined} onDelete={canWrite ? handleDelete : undefined} />
            ))}
          </div>
        )}
      </div>

      {/* Check modal */}
      {modal && (
        <ModalOverlay onClose={() => setModal(null)}>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 4 }}>
            {modal.type === 'backup' ? 'Monthly Back-up SCN Check' : 'Daily SCN Check'}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 14 }}>
            {formatZuluDate(todayZuluDate())} · attribution: {operatingInitials || '—'}
          </div>

          {/* Opening script — daily check only */}
          {modal.type === 'primary' && (
            <ScriptBlock title="Opening call">
              All agencies stand-by <em>(3X)</em>. This is Airfield Management with the daily Secondary
              Crash Phone check. All agencies respond with line clarity and initials when your agency
              is called.
            </ScriptBlock>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {modal.draft.map((d, i) => (
              <AgencyRow
                key={d.agency_name}
                draft={d}
                onChange={(status) => setAgencyStatus(i, status)}
                onOpenOosNotes={() => setModal(m => m ? { ...m, oosDialog: { idx: i } } : m)}
              />
            ))}
          </div>

          {/* Closing script — daily check only */}
          {modal.type === 'primary' && (
            <ScriptBlock title="Closing call">
              All agencies are loud and clear <em>(with the exception of if necessary)</em>. Please
              secure the net.
            </ScriptBlock>
          )}

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

          {/* Summary preview */}
          <SummaryPreview draft={modal.draft} type={modal.type} />

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              onClick={() => setModal(null)}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-sm)',
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
                flex: 2, padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
                background: 'linear-gradient(135deg, var(--color-cyan), var(--color-accent))',
                color: '#fff', fontSize: 'var(--fs-md)', fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                opacity: saving ? 0.6 : 1,
              }}
            >
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
                  flex: 2, padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
                  background: 'var(--color-danger)', color: '#fff',
                  fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: d.notes.trim() ? 'pointer' : 'not-allowed',
                  opacity: d.notes.trim() ? 1 : 0.5, fontFamily: 'inherit',
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

// ── Sub-components ──

function TodayCheckCard({
  label, check, onStart, onEdit, onDelete, canWrite, hasAgencies,
}: {
  label: string
  check: ScnCheckWithResults | undefined
  onStart: () => void
  onEdit: (c: ScnCheckWithResults) => void
  onDelete?: (c: ScnCheckWithResults) => void
  canWrite: boolean
  hasAgencies: boolean
}) {
  const complete = !!check?.completed_at

  return (
    <div style={{
      padding: 14, borderRadius: 'var(--radius-md)',
      background: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border)',
      borderLeft: `3px solid ${complete ? 'var(--color-success)' : 'var(--color-warning)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Radio size={14} color={complete ? 'var(--color-success)' : 'var(--color-warning)'} />
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)' }}>
          {label}
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
            {summarizeCheck(check)}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 10 }}>
            {check.completed_at && formatZuluTime(check.completed_at)}Z
            {check.completed_by_oi ? ` · ${check.completed_by_oi}` : ''}
          </div>
          {canWrite && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => onEdit(check)}
                style={{
                  flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-inset)', color: 'var(--color-text-2)',
                  fontSize: 'var(--fs-xs)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Re-run / Edit
              </button>
              {onDelete && (
                <button
                  onClick={() => onDelete(check)}
                  style={{
                    padding: '6px 10px', borderRadius: 6, border: '1px solid var(--color-border)',
                    background: 'transparent', color: 'var(--color-danger)',
                    fontSize: 'var(--fs-xs)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 10 }}>
            {label.toLowerCase().includes('monthly') ? 'Not yet completed this month.' : 'Not yet completed today.'}
          </div>
          {canWrite && hasAgencies && (
            <button
              onClick={onStart}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
                background: 'linear-gradient(135deg, var(--color-cyan), var(--color-accent))',
                color: '#fff', fontSize: 'var(--fs-sm)', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <Plus size={14} /> Start Check
            </button>
          )}
        </>
      )}
    </div>
  )
}

function AgencyRow({ draft, onChange, onOpenOosNotes }: {
  draft: AgencyDraft
  onChange: (status: ScnAgencyStatus) => void
  onOpenOosNotes: () => void
}) {
  const statuses: ScnAgencyStatus[] = ['loud_clear', 'no_response', 'oos']
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 'var(--radius-md)',
      background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)',
    }}>
      <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 10, letterSpacing: '0.01em' }}>
        {draft.agency_name}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {statuses.map(s => {
          const active = draft.status === s
          const color = SCN_STATUS_COLORS[s]
          return (
            <button
              key={s}
              onClick={() => onChange(s)}
              style={{
                padding: '14px 10px', borderRadius: 10, minHeight: 60,
                background: active ? color : 'transparent',
                border: `2px solid ${active ? color : 'var(--color-border)'}`,
                color: active ? '#fff' : 'var(--color-text-2)',
                fontSize: 'var(--fs-sm)', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                textTransform: 'uppercase', letterSpacing: '0.04em',
                boxShadow: active ? `0 2px 8px ${color}55` : 'none',
                transition: 'all 0.12s',
              }}
            >
              {SCN_STATUS_LABELS[s]}
            </button>
          )
        })}
      </div>
      {draft.status === 'oos' && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 150, fontSize: 'var(--fs-sm)', color: draft.notes ? 'var(--color-text-2)' : 'var(--color-danger)', fontStyle: 'italic' }}>
            {draft.notes || 'Notes required — describe why this agency is out of service'}
          </div>
          <button
            onClick={onOpenOosNotes}
            style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid var(--color-border)',
              background: 'var(--color-bg-surface)', color: 'var(--color-text-2)',
              fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {draft.notes ? 'Edit notes' : 'Add notes'}
          </button>
        </div>
      )}
    </div>
  )
}

function SummaryPreview({ draft, type }: { draft: AgencyDraft[]; type: ScnCheckType }) {
  const exceptions = draft.filter(d => d.status !== 'loud_clear')
  const label = type === 'backup' ? 'Monthly Back-up SCN check complete' : 'Daily SCN check complete'
  const text = exceptions.length === 0
    ? `${label} — all agencies loud & clear`
    : `${label} — all loud & clear except ${exceptions.map(e => `${e.agency_name} (${SCN_STATUS_LABELS[e.status]}${e.notes ? `: ${e.notes}` : ''})`).join(', ')}`
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 'var(--radius-sm)',
      background: exceptions.length === 0 ? 'rgba(34,197,94,0.06)' : 'rgba(234,179,8,0.06)',
      border: `1px solid ${exceptions.length === 0 ? 'rgba(34,197,94,0.25)' : 'rgba(234,179,8,0.28)'}`,
    }}>
      <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        Events Log preview
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', lineHeight: 1.5 }}>{text.toUpperCase()}</div>
    </div>
  )
}

function HistoryRow({ check, onEdit, onDelete }: { check: ScnCheckWithResults; onEdit?: (c: ScnCheckWithResults) => void; onDelete?: (c: ScnCheckWithResults) => void }) {
  const [expanded, setExpanded] = useState(false)
  const exceptions = check.results.filter(r => r.status !== 'loud_clear')
  const label = check.check_type === 'backup' ? 'Monthly' : 'Daily'
  const allClear = exceptions.length === 0

  return (
    <div style={{
      padding: '10px 12px', borderRadius: 'var(--radius-sm)',
      background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
      borderLeft: `3px solid ${allClear ? 'var(--color-success)' : 'var(--color-warning)'}`,
    }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit', textAlign: 'left',
        }}
      >
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-1)', minWidth: 90 }}>
          {formatZuluDate(check.check_date)}Z
        </div>
        <div style={{
          padding: '2px 8px', borderRadius: 4, fontSize: 'var(--fs-2xs)', fontWeight: 700,
          background: check.check_type === 'backup' ? 'rgba(167,139,250,0.15)' : 'rgba(56,189,248,0.12)',
          color: check.check_type === 'backup' ? '#A78BFA' : '#38BDF8',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {label}
        </div>
        <div style={{ flex: 1, fontSize: 'var(--fs-sm)', color: allClear ? 'var(--color-success)' : 'var(--color-warning)' }}>
          {allClear ? 'All loud & clear' : `${exceptions.length} agency${exceptions.length === 1 ? '' : 'ies'} not clear`}
        </div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
          {check.completed_by_oi || '—'}
        </div>
      </button>
      {expanded && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 4 }}>
            {check.results.map(r => (
              <DisplayRow key={r.id} name={r.agency_name} status={r.status} notes={r.notes} />
            ))}
          </div>
          {check.notes && (
            <div style={{ marginTop: 8, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
              <strong>Notes:</strong> {check.notes}
            </div>
          )}
          {(onEdit || onDelete) && (
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              {onEdit && (
                <button
                  onClick={() => onEdit(check)}
                  style={{
                    padding: '5px 10px', borderRadius: 4, border: '1px solid var(--color-border)',
                    background: 'var(--color-bg-inset)', color: 'var(--color-text-2)',
                    fontSize: 'var(--fs-xs)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(check)}
                  style={{
                    padding: '5px 10px', borderRadius: 4, border: '1px solid var(--color-border)',
                    background: 'transparent', color: 'var(--color-danger)',
                    fontSize: 'var(--fs-xs)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DisplayRow({ name, status, notes }: { name: string; status: ScnAgencyStatus; notes: string | null }) {
  return (
    <>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', padding: '3px 0' }}>
        {name}
        {notes && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontStyle: 'italic' }}>{notes}</div>}
      </div>
      <div style={{ padding: '3px 0', textAlign: 'right' }}>
        <span style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: 4,
          background: `${SCN_STATUS_COLORS[status]}22`, color: SCN_STATUS_COLORS[status],
          fontSize: 'var(--fs-2xs)', fontWeight: 700,
        }}>
          {SCN_STATUS_LABELS[status]}
        </span>
      </div>
    </>
  )
}

function ScriptBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      marginBottom: 14, padding: '10px 12px', borderRadius: 'var(--radius-md)',
      background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.25)',
    }}>
      <div style={{
        fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-cyan)',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
      }}>
        {title}
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', lineHeight: 1.55 }}>
        &ldquo;{children}&rdquo;
      </div>
    </div>
  )
}

function ModalOverlay({ children, onClose, tightZ }: { children: React.ReactNode; onClose: () => void; tightZ?: boolean }) {
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ padding: 24, zIndex: tightZ ? 1100 : undefined }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-bg-surface-solid)',
          borderRadius: 'var(--radius-lg)', padding: 20,
          width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
          border: '1px solid var(--color-border-mid)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
