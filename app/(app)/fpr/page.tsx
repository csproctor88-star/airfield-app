'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Download, BookOpenCheck, Plus, CheckCircle2, Check } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import {
  fetchFprChecklistItems,
  fetchTodayFprChecks,
  fetchFprChecksInRange,
  deleteFprCheck,
  buildFprResultDrafts,
  buildFprSavePayload,
  sortFprHistory,
  summarizeFprCheck,
  deriveFprTodayCards,
  todayZuluDate,
  FPR_STATUS_LABELS,
  FPR_STATUS_COLORS,
  type FprItemStatus,
  type FprResultDraft,
  type FprChecklistItemRow,
  type FprCheckResultRow,
  type FprCheckWithResults,
} from '@/lib/supabase/fpr'
import { getActiveShifts, getShiftLabel, type ShiftKey } from '@/lib/shifts'
import { formatZuluDate, formatZuluTime } from '@/lib/utils'
import { getWriteQueue, WRITE_COMMITTED_EVENT, type WriteCommittedDetail } from '@/lib/sync/write-queue'
import type { FprSavePayload, FprSaveResult } from '@/lib/sync/handlers'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'

// History-row date format. Today / Yesterday / 'Mon, Jul 14'. Same idiom
// as /scn. FPR check_date is a YYYY-MM-DD Zulu date.
function formatFprHistoryDate(iso: string, todayIso: string): { primary: string; secondary: string | null } {
  const date = new Date(`${iso}T12:00:00Z`)
  const longLabel = date.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
  const today = new Date(`${todayIso}T12:00:00Z`)
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86400000)
  if (diffDays === 0) return { primary: 'Today', secondary: longLabel }
  if (diffDays === 1) return { primary: 'Yesterday', secondary: longLabel }
  return { primary: longLabel, secondary: null }
}

// Build the Events Log summary from a live draft (summarizeFprCheck reads
// only `results`, so a placeholder-header check object is enough). Used by
// the preview and the save payload so both render an identical line.
function draftSummary(draft: FprResultDraft[], shiftLabel: string): string {
  const now = new Date().toISOString()
  const results: FprCheckResultRow[] = draft.map((d, i) => ({
    id: `d${i}`,
    check_id: '',
    item_id: d.item_id,
    item_label: d.item_label,
    status: d.status,
    notes: d.notes.trim() || null,
    sort_order: d.sort_order,
    created_at: now,
  }))
  const check: FprCheckWithResults = {
    id: '', base_id: '', check_date: '', shift: 'day', started_at: now,
    completed_at: null, completed_by: null, completed_by_oi: null, notes: null,
    created_at: now, results,
  }
  return summarizeFprCheck(check, shiftLabel)
}

type ModalState = {
  shift: ShiftKey
  // The date this check belongs to: today's Zulu date for a new check, or
  // the edited check's own check_date. Threaded into the save payload so an
  // edit upserts onto the historical row, not onto today's (base, date, shift).
  checkDate: string
  draft: FprResultDraft[]
  notes: string
  // priorStatus: the row's status before the Issue dialog opened, so
  // "Cancel Issue" restores it (e.g. back to N/A) instead of forcing
  // satisfactory.
  issueDialog: { idx: number; priorStatus: FprItemStatus } | null
}

export default function FprPage() {
  const { installationId, currentInstallation } = useInstallation()
  const { has } = usePermissions()
  const [loaded, setLoaded] = useState(false)
  const [items, setItems] = useState<FprChecklistItemRow[]>([])
  const [todayChecks, setTodayChecks] = useState<FprCheckWithResults[]>([])
  const [history, setHistory] = useState<FprCheckWithResults[]>([])
  const [operatingInitials, setOperatingInitials] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const [modal, setModal] = useState<ModalState | null>(null)
  const [saving, setSaving] = useState(false)

  // Monthly PDF range (default: this calendar month in Zulu)
  const [pdfMonth, setPdfMonth] = useState<string>(() => todayZuluDate().slice(0, 7)) // YYYY-MM

  const canWrite = has(PERM.FPR_WRITE)

  const load = useCallback(async () => {
    if (!installationId) return
    const [its, today] = await Promise.all([
      fetchFprChecklistItems(installationId, true),
      fetchTodayFprChecks(installationId),
    ])
    setItems(its)
    setTodayChecks(today)

    const end = todayZuluDate()
    const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const rows = await fetchFprChecksInRange(installationId, start, end)
    // Newest-first for display (fetch order is check_date ASC / shift alpha).
    setHistory(sortFprHistory(rows.filter(r => r.check_date !== end)))

    setLoaded(true)
  }, [installationId])

  // Load the signed-in user's id (queue ownership) + operating initials (attribution).
  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
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

  // Refresh when a queued fpr_save drains (mirrors /checks) — a check that
  // committed offline flips its today card green once the queue drains.
  useEffect(() => {
    const onCommit = (e: Event) => {
      const detail = (e as CustomEvent<WriteCommittedDetail>).detail
      if (detail?.type === 'fpr_save') load()
    }
    window.addEventListener(WRITE_COMMITTED_EVENT, onCommit)
    return () => window.removeEventListener(WRITE_COMMITTED_EVENT, onCommit)
  }, [load])

  const activeShifts = getActiveShifts(currentInstallation)
  const todayCards = deriveFprTodayCards(activeShifts, todayChecks)

  function openModal(shift: ShiftKey, edit?: FprCheckWithResults) {
    if (items.length === 0) {
      toast.error('Configure the Flight Planning Room checklist in Base Setup before starting a check.')
      return
    }
    const draft = buildFprResultDrafts(items, edit?.results ?? null)
    setModal({
      shift,
      checkDate: edit?.check_date ?? todayZuluDate(),
      draft,
      notes: edit?.notes || '',
      issueDialog: null,
    })
  }

  function setItemStatus(idx: number, status: FprItemStatus) {
    setModal(m => {
      if (!m) return m
      const prior = m.draft[idx].status
      const next = [...m.draft]
      next[idx] = { ...next[idx], status }
      // Selecting Issue with no notes yet → open the required-notes dialog,
      // remembering the pre-issue status so "Cancel Issue" restores it.
      if (status === 'issue' && !next[idx].notes) {
        return { ...m, draft: next, issueDialog: { idx, priorStatus: prior === 'issue' ? 'satisfactory' : prior } }
      }
      return { ...m, draft: next }
    })
  }

  function setIssueNotes(idx: number, notes: string) {
    setModal(m => {
      if (!m) return m
      const next = [...m.draft]
      next[idx] = { ...next[idx], notes }
      return { ...m, draft: next }
    })
  }

  async function handleSaveModal() {
    if (!modal || !installationId) return
    // Block save while an Issue row has empty notes.
    const missing = modal.draft.find(d => d.status === 'issue' && !d.notes.trim())
    if (missing) {
      toast.error(`"${missing.item_label}" is an Issue — add notes before saving.`)
      return
    }
    setSaving(true)
    const shiftLabel = getShiftLabel(currentInstallation, modal.shift)
    const summary = draftSummary(modal.draft, shiftLabel)
    const payload: FprSavePayload = buildFprSavePayload({
      baseId: installationId,
      // modal.checkDate — today for a new check, the edited check's own date
      // for an edit (NOT hardcoded today, which overwrote today's real check).
      checkDate: modal.checkDate,
      shift: modal.shift,
      operatingInitials,
      notes: modal.notes,
      draft: modal.draft,
      // Carried so the queue handler can write the Events Log entry after
      // the save commits (not from lib/supabase/fpr.ts, and not on enqueue).
      summary,
    })
    try {
      const result = await getWriteQueue().enqueueOrExecute<FprSavePayload, FprSaveResult>(
        'fpr_save',
        payload,
        { baseId: installationId, userId: userId || '' },
      )
      if (result.status === 'committed') {
        setSaving(false)
        if (!result.data) {
          toast.error('Failed to save check')
          return
        }
        toast.success(`${shiftLabel} Flight Planning Room check logged`)
        setModal(null)
        load()
      } else {
        // Queued offline — the handler commits the save and writes the
        // Events Log entry at drain; the WRITE_COMMITTED_EVENT listener
        // refreshes the today card.
        setSaving(false)
        setModal(null)
        toast.success('Check queued — will save automatically when the network returns.', { duration: 8000 })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(`Failed to save: ${message}`)
      setSaving(false)
    }
  }

  async function handleDelete(check: FprCheckWithResults) {
    const shiftLabel = getShiftLabel(currentInstallation, check.shift)
    if (!confirm(`Delete the ${shiftLabel} Flight Planning Room check for ${check.check_date}Z?`)) return
    const { error } = await deleteFprCheck(check.id)
    if (error) { toast.error(error); return }
    toast.success('Check deleted')
    load()
  }

  const handleDownloadPdf = async () => {
    if (!installationId) return
    try {
      const { generateFprMonthlyPdf } = await import('@/lib/fpr-pdf')
      const [yy, mm] = pdfMonth.split('-').map(n => parseInt(n, 10))
      const start = new Date(Date.UTC(yy, mm - 1, 1)).toISOString().slice(0, 10)
      const end = new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10)
      const monthChecks = await fetchFprChecksInRange(installationId, start, end)
      const shiftLabels: Record<ShiftKey, string> = {
        day: getShiftLabel(currentInstallation, 'day'),
        swing: getShiftLabel(currentInstallation, 'swing'),
        mid: getShiftLabel(currentInstallation, 'mid'),
      }
      const { doc, filename } = generateFprMonthlyPdf({
        monthYyyyMm: pdfMonth,
        checks: monthChecks,
        shiftLabels,
        baseName: currentInstallation?.name || undefined,
      })
      doc.save(filename)
      toast.success('Monthly Flight Planning Room check log downloaded')
    } catch (e) {
      console.error(e)
      toast.error('Failed to generate PDF')
    }
  }

  if (!loaded) {
    return (
      <div className="page-container">
        <LoadingState message="Loading Flight Planning Room checks..." />
      </div>
    )
  }

  const modalShiftLabel = modal ? getShiftLabel(currentInstallation, modal.shift) : ''
  // Guidance is looked up from the active template by item_id — the draft
  // rows (buildFprResultDrafts) deliberately don't carry it.
  const guidanceByItemId = new Map(items.map(it => [it.id, it.guidance]))

  return (
    <div className="page-container">
      <Link href="/more" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-text-3)', textDecoration: 'none', fontSize: 'var(--fs-sm)', marginBottom: 12 }}>
        <ArrowLeft size={14} /> Back
      </Link>

      {/* Page header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, paddingBottom: 8, marginBottom: 14,
        borderBottom: '1px solid color-mix(in srgb, var(--color-cyan) 30%, transparent)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BookOpenCheck size={16} color="var(--color-cyan)" />
          <div style={{
            fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>Flight Planning Room</div>
        </div>
        <div style={{
          fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {formatZuluDate(todayZuluDate())}
        </div>
      </div>

      {/* No checklist configured warning */}
      {items.length === 0 && (
        <div style={{
          marginTop: 14, padding: '12px 14px', borderRadius: 'var(--radius-md)',
          background: 'color-mix(in srgb, var(--color-warning) 8%, var(--color-bg-surface))',
          border: '1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)',
          fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)',
        }}>
          <strong style={{ color: 'var(--color-warning)' }}>No checklist configured.</strong>{' '}
          Admins can build the checklist in <Link href="/settings/base-setup" style={{ color: 'var(--color-cyan)', textDecoration: 'none' }}>Base Setup → Flight Planning Room Checklist</Link>.
        </div>
      )}

      {/* Today's per-shift cards */}
      <div style={{ marginTop: 14, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {todayCards.map(card => (
          <TodayCheckCard
            key={card.shift}
            label={card.label}
            check={card.check}
            onStart={() => openModal(card.shift)}
            onEdit={(c) => openModal(c.shift, c)}
            onDelete={canWrite ? handleDelete : undefined}
            canWrite={canWrite}
            hasItems={items.length > 0}
          />
        ))}
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
          <EmptyState message="No Flight Planning Room checks recorded in the past 30 days." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(h => (
              <HistoryRow
                key={h.id}
                check={h}
                shiftLabel={getShiftLabel(currentInstallation, h.shift)}
                onEdit={canWrite ? (c) => openModal(c.shift, c) : undefined}
                onDelete={canWrite ? handleDelete : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Check modal */}
      {modal && (
        <ModalOverlay onClose={() => setModal(null)}>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 4 }}>
            {modalShiftLabel} Flight Planning Room Check
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 14 }}>
            {formatZuluDate(modal.checkDate)} · attribution: {operatingInitials || '—'}
          </div>

          {/* Quick-fill — hidden once every item is already satisfactory. */}
          {modal.draft.some(d => d.status !== 'satisfactory') && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button
                onClick={() => setModal(m => m
                  ? { ...m, draft: m.draft.map(d => ({
                      ...d,
                      status: 'satisfactory' as FprItemStatus,
                      // Clear a row's issue notes as it leaves 'issue' — stale
                      // issue text must not persist onto a satisfactory row.
                      notes: d.status === 'issue' ? '' : d.notes,
                    })) }
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
                <Check size={13} strokeWidth={3} /> Mark All Satisfactory
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {modal.draft.map((d, i) => (
              <FprItemRow
                key={d.item_id ?? d.item_label}
                draft={d}
                guidance={d.item_id ? (guidanceByItemId.get(d.item_id) ?? null) : null}
                onChange={(status) => setItemStatus(i, status)}
                onOpenIssueNotes={() => setModal(m => {
                  if (!m) return m
                  const prior = m.draft[i].status
                  // Editing an already-'issue' row: backing out with "Cancel
                  // Issue" un-flags to satisfactory (no earlier state to keep).
                  return { ...m, issueDialog: { idx: i, priorStatus: prior === 'issue' ? 'satisfactory' : prior } }
                })}
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

          {/* Events Log preview */}
          <SummaryPreview draft={modal.draft} shiftLabel={modalShiftLabel} />

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
                border: '1px solid color-mix(in srgb, var(--color-cyan) 45%, transparent)',
                background: saving
                  ? 'var(--color-bg-elevated)'
                  : 'color-mix(in srgb, var(--color-cyan) 14%, transparent)',
                color: saving ? 'var(--color-text-4)' : 'var(--color-cyan)',
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

      {/* Issue notes dialog */}
      {modal?.issueDialog && (() => {
        const { idx, priorStatus } = modal.issueDialog
        const d = modal.draft[idx]
        return (
          <ModalOverlay onClose={() => setModal(m => m ? { ...m, issueDialog: null } : m)} tightZ>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 4 }}>
              {d.item_label} — Issue
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 10 }}>
              Describe the issue. This note is logged in the check results and appears in the monthly PDF.
            </div>
            <textarea
              autoFocus
              value={d.notes}
              onChange={e => setIssueNotes(idx, e.target.value)}
              rows={3}
              placeholder="e.g. Enroute charts — superseded edition on the rack. Replacement ordered."
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)',
                color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit', resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => { setItemStatus(idx, priorStatus); setIssueNotes(idx, ''); setModal(m => m ? { ...m, issueDialog: null } : m) }}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
                  color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel Issue
              </button>
              <button
                onClick={() => setModal(m => m ? { ...m, issueDialog: null } : m)}
                disabled={!d.notes.trim()}
                style={{
                  flex: 2, padding: '8px 12px', borderRadius: 'var(--radius-md)',
                  border: '1px solid color-mix(in srgb, var(--color-warning) 45%, transparent)',
                  background: d.notes.trim()
                    ? 'color-mix(in srgb, var(--color-warning) 14%, transparent)'
                    : 'var(--color-bg-elevated)',
                  color: d.notes.trim() ? 'var(--color-warning)' : 'var(--color-text-4)',
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

// ── Sub-components ──

function TodayCheckCard({
  label, check, onStart, onEdit, onDelete, canWrite, hasItems,
}: {
  label: string
  check: FprCheckWithResults | undefined
  onStart: () => void
  onEdit: (c: FprCheckWithResults) => void
  onDelete?: (c: FprCheckWithResults) => void
  canWrite: boolean
  hasItems: boolean
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
        <BookOpenCheck size={14} color={complete ? 'var(--color-success)' : 'var(--color-warning)'} />
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
            {summarizeFprCheck(check, label)}
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
            Not yet completed this shift.
          </div>
          {canWrite && hasItems && (
            <button
              onClick={onStart}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 'var(--radius-md)',
                border: '1px solid color-mix(in srgb, var(--color-cyan) 45%, transparent)',
                background: 'color-mix(in srgb, var(--color-cyan) 14%, transparent)',
                color: 'var(--color-cyan)',
                fontSize: 'var(--fs-sm)', fontWeight: 700,
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

function FprItemRow({ draft, guidance, onChange, onOpenIssueNotes }: {
  draft: FprResultDraft
  guidance: string | null
  onChange: (status: FprItemStatus) => void
  onOpenIssueNotes: () => void
}) {
  const statuses: FprItemStatus[] = ['satisfactory', 'issue', 'na']
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 'var(--radius-md)',
      background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)',
    }}>
      <div style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: guidance ? 2 : 10, letterSpacing: '0.01em' }}>
        {draft.item_label}
      </div>
      {guidance && (
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 10, lineHeight: 1.45 }}>
          {guidance}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
        {statuses.map(s => {
          const active = draft.status === s
          const color = FPR_STATUS_COLORS[s]
          return (
            <button
              key={s}
              onClick={() => onChange(s)}
              style={{
                padding: '14px 10px', borderRadius: 'var(--radius-md)', minHeight: 60,
                background: active
                  ? `color-mix(in srgb, ${color} 18%, transparent)`
                  : 'transparent',
                border: active
                  ? `1px solid color-mix(in srgb, ${color} 50%, transparent)`
                  : '1px solid var(--color-border)',
                color: active ? color : 'var(--color-text-2)',
                fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                textTransform: 'uppercase', letterSpacing: '0.04em',
                transition: 'all 0.12s',
              }}
            >
              {FPR_STATUS_LABELS[s]}
            </button>
          )
        })}
      </div>
      {draft.status === 'issue' && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 150, fontSize: 'var(--fs-sm)', color: draft.notes ? 'var(--color-text-2)' : 'var(--color-danger)', fontStyle: 'italic' }}>
            {draft.notes || 'Notes required — describe the issue'}
          </div>
          <button
            onClick={onOpenIssueNotes}
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

function SummaryPreview({ draft, shiftLabel }: { draft: FprResultDraft[]; shiftLabel: string }) {
  const hasIssues = draft.some(d => d.status === 'issue')
  const text = draftSummary(draft, shiftLabel)
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 'var(--radius-md)',
      background: hasIssues
        ? 'color-mix(in srgb, var(--color-warning) 8%, transparent)'
        : 'color-mix(in srgb, var(--color-success) 8%, transparent)',
      border: hasIssues
        ? '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)'
        : '1px solid color-mix(in srgb, var(--color-success) 30%, transparent)',
    }}>
      <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        Events Log preview
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', lineHeight: 1.5 }}>{text.toUpperCase()}</div>
    </div>
  )
}

function HistoryRow({ check, shiftLabel, onEdit, onDelete }: {
  check: FprCheckWithResults
  shiftLabel: string
  onEdit?: (c: FprCheckWithResults) => void
  onDelete?: (c: FprCheckWithResults) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const issues = check.results.filter(r => r.status === 'issue')
  const allSatisfactory = issues.length === 0
  const todayIso = todayZuluDate()
  const dateLabel = formatFprHistoryDate(check.check_date, todayIso)

  return (
    <div style={{
      padding: '10px 12px', borderRadius: 'var(--radius-sm)',
      background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
      borderLeft: `3px solid ${allSatisfactory ? 'var(--color-success)' : 'var(--color-warning)'}`,
    }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit', textAlign: 'left',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 6,
          fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-1)',
          minWidth: 130, flexShrink: 0,
        }}>
          <span>{dateLabel.primary}</span>
          {dateLabel.secondary && (
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 500 }}>
              {dateLabel.secondary}
            </span>
          )}
        </div>
        <div style={{
          padding: '2px 9px', borderRadius: 'var(--radius-full)', fontSize: 'var(--fs-2xs)', fontWeight: 700,
          background: 'color-mix(in srgb, var(--color-cyan) 14%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-cyan) 35%, transparent)',
          color: 'var(--color-cyan)',
          textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
        }}>
          {shiftLabel}
        </div>
        <div style={{ flex: 1, fontSize: 'var(--fs-sm)', color: allSatisfactory ? 'var(--color-success)' : 'var(--color-warning)' }}>
          {allSatisfactory ? 'All satisfactory' : `${issues.length} issue${issues.length === 1 ? '' : 's'}`}
        </div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
          {check.completed_by_oi || '—'}
        </div>
      </button>
      {expanded && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 4 }}>
            {check.results.map(r => (
              <DisplayRow key={r.id} name={r.item_label} status={r.status} notes={r.notes} />
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

function DisplayRow({ name, status, notes }: { name: string; status: FprItemStatus; notes: string | null }) {
  return (
    <>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', padding: '3px 0' }}>
        {name}
        {notes && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontStyle: 'italic' }}>{notes}</div>}
      </div>
      <div style={{ padding: '3px 0', textAlign: 'right' }}>
        <span style={{
          display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-full)',
          background: `color-mix(in srgb, ${FPR_STATUS_COLORS[status]} 14%, transparent)`,
          border: `1px solid color-mix(in srgb, ${FPR_STATUS_COLORS[status]} 35%, transparent)`,
          color: FPR_STATUS_COLORS[status],
          fontSize: 'var(--fs-2xs)', fontWeight: 700,
        }}>
          {FPR_STATUS_LABELS[status]}
        </span>
      </div>
    </>
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
