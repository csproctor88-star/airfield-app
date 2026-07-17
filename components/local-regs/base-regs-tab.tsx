'use client'

// Base Regs — recurring review of standing local regulations (base OIs, wing
// instructions, local supplements). Managers (local_regs:manage) upload PDFs;
// reviewers (local_regs:view) re-review each on a monthly / quarterly cadence.
// Sibling of the Read File module (app/(app)/read-file/page.tsx) — the doc
// list, upload/replace dialogs, PII/CUI banner, and roster-compliance idioms
// are pattern-matched to it. Recurrence + version semantics come from the pure
// helpers in lib/local-regs/review-status.ts.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import {
  BookMarked, CheckCircle2, RefreshCw, ShieldAlert, Upload, FileDown,
  ExternalLink, FileText, Archive, ArchiveRestore, Paperclip, X,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import {
  fetchLocalRegs, fetchMyRegReviews, fetchAllRegReviews, fetchLocalRegReviewers,
  getLocalRegUrl, addLocalReg, replaceLocalReg, setLocalRegArchived, setLocalRegInterval,
  type LocalRegulationRow, type LocalRegReviewRow, type LocalRegReviewer,
} from '@/lib/supabase/local-regulations'
import { getRegReviewStatus, partitionCompliance, type RegReviewState } from '@/lib/local-regs/review-status'
import { getWriteQueue, WRITE_COMMITTED_EVENT, type WriteCommittedDetail } from '@/lib/sync/write-queue'
import type { LocalRegReviewPayload, LocalRegReviewResult } from '@/lib/sync/handlers'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import { Btn, Field } from '@/components/amtr/ui'
import { EmptyState } from '@/components/ui/empty-state'

type ReviewInterval = 'monthly' | 'quarterly'
const MAX_BYTES = 25 * 1024 * 1024

function humanFileSize(bytes: number | null): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function intervalLabel(i: ReviewInterval): string {
  return i === 'monthly' ? 'Monthly' : 'Quarterly'
}

function displayName(r: Pick<LocalRegReviewer, 'name' | 'rank'>): string {
  return r.rank ? `${r.rank} ${r.name}` : r.name
}

// Conservative check: does this CRUD/queue error message look like the doc
// was superseded out from under the user? The version-equality WITH CHECK on
// local_regulation_reviews_insert surfaces as an RLS violation, which
// friendlyError() collapses to the generic "You do not have permission…"
// text; a signed-URL failure on a replaced storage object reads "Object not
// found". A viewer on the Base Regs tab already holds local_regs:view (they
// can see the row), so a permission/RLS/not-found error there is almost
// always a stale edition, not a real authorization gap. Anything else (e.g. a
// network error) falls through to the generic message.
function isLikelyStaleEditionError(message: string | null | undefined): boolean {
  if (!message) return false
  const m = message.toLowerCase()
  return (
    m.includes('permission') ||
    m.includes('row-level security') ||
    m.includes('violates') ||
    m.includes('policy') ||
    m.includes('not found')
  )
}

const STALE_EDITION_MSG =
  'This document was updated to a new edition — open and review the current version.'

// Amber / danger metadata for the not-current review states.
const STATE_META: Record<Exclude<RegReviewState, 'current'>, { label: string; danger: boolean }> = {
  never: { label: 'Never reviewed', danger: true },
  overdue: { label: 'Overdue', danger: true },
  updated: { label: 'Updated — review required', danger: false },
}

export function BaseRegsTab() {
  const { installationId, currentInstallation } = useInstallation()
  const { has } = usePermissions()
  const canManage = has(PERM.LOCAL_REGS_MANAGE)
  const [generatingReport, setGeneratingReport] = useState(false)

  const [regs, setRegs] = useState<LocalRegulationRow[]>([])
  const [myReviews, setMyReviews] = useState<LocalRegReviewRow[]>([])
  const [allReviews, setAllReviews] = useState<LocalRegReviewRow[]>([])
  const [reviewers, setReviewers] = useState<LocalRegReviewer[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  // Session-scoped set of reg ids the user opened this page session. Drives
  // the open-then-attest soft gate below. NOT a security control — the RLS
  // insert policy is the real attestation guard; this only nudges the user to
  // actually open the PDF before clicking "Mark reviewed".
  const [openedDocs, setOpenedDocs] = useState<Set<string>>(new Set())

  const [attestingId, setAttestingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [replaceFor, setReplaceFor] = useState<LocalRegulationRow | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [expandedCompliance, setExpandedCompliance] = useState<string | null>(null)

  // Responsive: table ≥720px, stacked cards below (read-file responsive treatment).
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(max-width: 720px)')
    const update = () => setNarrow(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => { if (data.user) setUserId(data.user.id) })
  }, [])

  const load = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    const [r, mine] = await Promise.all([
      fetchLocalRegs(installationId),
      fetchMyRegReviews(installationId),
    ])
    setRegs(r)
    setMyReviews(mine)
    if (canManage) {
      const [all, roster] = await Promise.all([
        fetchAllRegReviews(installationId),
        fetchLocalRegReviewers(installationId),
      ])
      setAllReviews(all)
      setReviewers(roster)
    }
    setLoading(false)
  }, [installationId, canManage])
  useEffect(() => { load() }, [load])

  // House pattern (see app/(app)/fpr/page.tsx): when a queued local_reg_review
  // commits at drain, its optimistic UI can't reflect the server row — reload
  // so the just-committed review flips the row to green. Filtered to our
  // write type so unrelated commits don't churn this list.
  useEffect(() => {
    const onCommit = (e: Event) => {
      const detail = (e as CustomEvent<WriteCommittedDetail>).detail
      if (detail?.type === 'local_reg_review') load()
    }
    window.addEventListener(WRITE_COMMITTED_EVENT, onCommit)
    return () => window.removeEventListener(WRITE_COMMITTED_EVENT, onCommit)
  }, [load])

  // Latest review per reg for the current user (drives the per-row status pill).
  const myLatestByReg = useMemo(() => {
    const m = new Map<string, LocalRegReviewRow>()
    for (const rev of myReviews) {
      const ex = m.get(rev.regulation_id)
      if (!ex || new Date(rev.reviewed_at).getTime() > new Date(ex.reviewed_at).getTime()) {
        m.set(rev.regulation_id, rev)
      }
    }
    return m
  }, [myReviews])

  const reviewerById = useMemo(() => {
    const m = new Map<string, LocalRegReviewer>()
    for (const rv of reviewers) m.set(rv.user_id, rv)
    return m
  }, [reviewers])

  const active = regs.filter(r => !r.is_archived)
  const archived = regs.filter(r => r.is_archived)

  const open = async (r: LocalRegulationRow) => {
    const { url, error } = await getLocalRegUrl(r.storage_path)
    if (!url) {
      // A null URL for a doc the user can see most often means the stored
      // object was superseded by a replace since this row loaded — refresh so
      // the row picks up the new edition/path, and say so plainly instead of
      // the generic "download link" failure.
      if (isLikelyStaleEditionError(error)) {
        toast.error(STALE_EDITION_MSG)
        await load()
      } else {
        toast.error('Could not generate a download link')
      }
      return
    }
    // Mark opened this session — enables the soft-gated "Mark reviewed" button.
    setOpenedDocs(prev => new Set(prev).add(r.id))
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const attest = async (r: LocalRegulationRow) => {
    if (!installationId || !userId) return
    setAttestingId(r.id)
    try {
      // Route through the offline write queue with the CURRENT version pinned.
      // The local_reg_review handler does NOT re-read version at drain time, so
      // a queued review that drains after the doc was replaced fails
      // NonRetriable (RLS version-equality rejects it) and surfaces in the queue
      // inspector — by design: the edition changed, the user must re-review.
      const res = await getWriteQueue().enqueueOrExecute<LocalRegReviewPayload, LocalRegReviewResult>(
        'local_reg_review',
        { baseId: installationId, regulationId: r.id, version: r.version },
        { baseId: installationId, userId, optimisticEntityId: r.id },
      )
      if (res.status === 'queued') {
        toast.success('Review queued — will record when back online')
      } else {
        toast.success('Marked reviewed')
      }
      window.dispatchEvent(new Event('glidepath:badges-refresh'))
      await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      // The version-equality RLS rejection (doc replaced since the user
      // opened it) reaches here as a NonRetriableError whose message
      // friendlyError already flattened to "You do not have permission…".
      // Surface the honest cause and refresh so the row flips to Updated.
      if (isLikelyStaleEditionError(msg)) {
        toast.error(STALE_EDITION_MSG)
        await load()
      } else {
        toast.error(msg || 'Could not record your review')
      }
    } finally {
      setAttestingId(null)
    }
  }

  const archive = async (r: LocalRegulationRow) => {
    const next = !r.is_archived
    if (next && !window.confirm(`Archive "${r.title}"? It drops off the review list and badge but stays in the compliance history.`)) return
    const { error } = await setLocalRegArchived(r.id, next)
    if (error) { toast.error(error); return }
    toast.success(next ? 'Archived' : 'Restored')
    window.dispatchEvent(new Event('glidepath:badges-refresh'))
    load()
  }

  const changeInterval = async (r: LocalRegulationRow, next: ReviewInterval) => {
    if (next === r.review_interval) return
    // Shortening the window (quarterly → monthly) can flip reviewers whose last
    // review is older than the new window straight to Overdue — confirm first.
    if (next === 'monthly' && r.review_interval === 'quarterly') {
      if (!window.confirm(
        `Switch "${r.title}" to Monthly review? The window shrinks from 90 to 30 days — anyone whose last review is older than 30 days will immediately show as Overdue.`,
      )) return
    }
    const { error } = await setLocalRegInterval(r.id, next)
    if (error) { toast.error(error); return }
    toast.success('Review interval updated')
    // Interval change can flip due status, so refresh the badge / tab chip too.
    window.dispatchEvent(new Event('glidepath:badges-refresh'))
    load()
  }

  // ── Per-doc compliance (manager) — roster partition for the current cycle ──
  const complianceFor = useCallback((reg: LocalRegulationRow) => {
    const reviewsForReg = allReviews.filter(rev => rev.regulation_id === reg.id)
    const { reviewed, outstanding } = partitionCompliance(reg, reviewers, reviewsForReg)
    const rosterIds = new Set(reviewers.map(rv => rv.user_id))
    const reviewedRoster = reviewers.filter(rv => reviewed.has(rv.user_id))
    // Out-of-roster reviewers folded into `reviewed` (e.g. a per-user view
    // grant) — the PDF renders these as extra rows; mirror them in the panel
    // so the two surfaces agree. Never counted in X/Y.
    const foldIns = Array.from(reviewed.entries())
      .filter(([uid]) => !rosterIds.has(uid))
      .map(([user_id, info]) => ({ user_id, ...info }))
    return { reviewed, outstanding, reviewedRoster, foldIns, total: reviewers.length, version: reg.version }
  }, [allReviews, reviewers])

  // ── Compliance report (manager) — same reviewed/outstanding partition as
  // the on-screen Compliance panels, so the PDF never disagrees with the chips.
  const runReport = async () => {
    setGeneratingReport(true)
    try {
      const { generateLocalRegsReviewPdf } = await import('@/lib/local-regs-review-pdf')
      const { doc, filename } = await generateLocalRegsReviewPdf({
        baseName: currentInstallation?.name,
        baseIcao: currentInstallation?.icao,
        regs: active,
        archivedRegs: archived,
        reviewers,
        reviews: allReviews,
        generatedAtIso: new Date().toISOString(),
      })
      doc.save(filename)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not generate the compliance report')
    } finally {
      setGeneratingReport(false)
    }
  }

  return (
    <div>
      {/* Header row: intro + manager actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <BookMarked size={18} style={{ color: 'var(--color-accent)' }} />
          <strong style={{ fontSize: 16 }}>Base Regs</strong>
        </div>
        {canManage && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn variant="secondary" onClick={runReport} disabled={generatingReport}>
              <FileDown size={15} /> {generatingReport ? 'Generating…' : 'Compliance report'}
            </Btn>
            <Btn variant="primary" onClick={() => setShowAdd(true)}>
              <Upload size={15} /> Add regulation
            </Btn>
          </div>
        )}
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 12 }}>
        Standing local regulations that airfield management personnel re-review on a recurring cadence. Your review records your name, operating initials, and the date. When a document is replaced, it must be re-reviewed.
      </div>

      {/* PII / CUI disclaimer — commercial-cloud system, not an authorized enclave.
          Reused verbatim from app/(app)/read-file/page.tsx:129-141. */}
      <div role="alert" style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', marginBottom: 14,
        borderRadius: 8, border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)',
        background: 'color-mix(in srgb, var(--color-danger) 12%, transparent)',
        color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)', lineHeight: 1.45,
      }}>
        <ShieldAlert size={18} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: 1 }} />
        <span>
          <strong style={{ color: 'var(--color-danger)' }}>Do not upload PII or CUI.</strong>{' '}
          This system is not an authorized repository for Personally Identifiable Information or Controlled Unclassified Information. Redact sensitive data before uploading.
        </span>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 16, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>Loading…</div>
      ) : active.length === 0 ? (
        <EmptyState message="No local regulations yet." />
      ) : narrow ? (
        // ── Stacked cards (< 720px) ──
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {active.map(r => (
            <RegCard
              key={r.id}
              reg={r}
              status={getRegReviewStatus(r, myLatestByReg.get(r.id) ?? null)}
              opened={openedDocs.has(r.id)}
              attesting={attestingId === r.id}
              canManage={canManage}
              compliance={canManage ? complianceFor(r) : null}
              reviewerById={reviewerById}
              expanded={expandedCompliance === r.id}
              onToggleExpand={() => setExpandedCompliance(id => (id === r.id ? null : r.id))}
              onOpen={() => open(r)}
              onAttest={() => attest(r)}
              onReplace={() => setReplaceFor(r)}
              onArchive={() => archive(r)}
              onInterval={(next) => changeInterval(r, next)}
            />
          ))}
        </div>
      ) : (
        // ── Table (≥ 720px) ──
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={th}>Document</th>
                <th style={th}>Interval</th>
                <th style={th}>Your status</th>
                {canManage && <th style={th}>Compliance</th>}
                {canManage && <th style={th} />}
              </tr>
            </thead>
            <tbody>
              {active.map(r => {
                const status = getRegReviewStatus(r, myLatestByReg.get(r.id) ?? null)
                const comp = canManage ? complianceFor(r) : null
                const isExpanded = expandedCompliance === r.id
                return (
                  <RegRowGroup key={r.id}>
                    <tr style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--color-border)' }}>
                      <td style={td}>
                        <DocButton reg={r} onOpen={() => open(r)} />
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        {canManage ? (
                          <IntervalSelect value={r.review_interval} onChange={(next) => changeInterval(r, next)} />
                        ) : (
                          <IntervalPill interval={r.review_interval} />
                        )}
                      </td>
                      <td style={td}>
                        <StatusCell
                          status={status}
                          opened={openedDocs.has(r.id)}
                          attesting={attestingId === r.id}
                          onAttest={() => attest(r)}
                        />
                      </td>
                      {canManage && comp && (
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => setExpandedCompliance(id => (id === r.id ? null : r.id))}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                              background: 'none', border: 'none', padding: 0, fontFamily: 'inherit',
                            }}
                          >
                            <ComplianceChip reviewed={comp.reviewedRoster.length} total={comp.total} />
                            {isExpanded ? <ChevronUp size={14} style={{ color: 'var(--color-text-3)' }} /> : <ChevronDown size={14} style={{ color: 'var(--color-text-3)' }} />}
                          </button>
                        </td>
                      )}
                      {canManage && (
                        <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-flex', gap: 6 }}>
                            <button onClick={() => setReplaceFor(r)} title="Replace file (re-triggers review)" style={iconBtn}><RefreshCw size={14} /></button>
                            <button onClick={() => archive(r)} title="Archive" style={iconBtn}><Archive size={14} /></button>
                          </span>
                        </td>
                      )}
                    </tr>
                    {canManage && comp && isExpanded && (
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td colSpan={5} style={{ padding: '0 14px 14px', background: 'var(--color-bg-inset)' }}>
                          <CompliancePanel comp={comp} reviewerById={reviewerById} />
                        </td>
                      </tr>
                    )}
                  </RegRowGroup>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Archived (manager) */}
      {canManage && archived.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setShowArchived(s => !s)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', fontWeight: 600, padding: 0 }}>
            {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
          </button>
          {showArchived && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
                <tbody>
                  {archived.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={td}>
                        <button onClick={() => open(r)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-2)', fontFamily: 'inherit', fontSize: 'inherit' }}>
                          <FileText size={16} style={{ color: 'var(--color-danger)' }} /> {r.title}
                        </button>
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <button onClick={() => archive(r)} title="Restore" style={iconBtn}><ArchiveRestore size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showAdd && installationId && (
        <RegUploadDialog
          mode="add"
          title="Add regulation"
          onClose={() => setShowAdd(false)}
          onSubmit={async (file, meta) => {
            const { error } = await addLocalReg(installationId, file, {
              title: meta.title, description: meta.description, reviewInterval: meta.reviewInterval,
            })
            return error
          }}
          onDone={() => { window.dispatchEvent(new Event('glidepath:badges-refresh')); load() }}
        />
      )}
      {replaceFor && (
        <RegUploadDialog
          mode="replace"
          title={`Replace "${replaceFor.title}"`}
          onClose={() => setReplaceFor(null)}
          onSubmit={async (file) => {
            const { error } = await replaceLocalReg(replaceFor, file)
            return error
          }}
          onDone={() => { window.dispatchEvent(new Event('glidepath:badges-refresh')); load() }}
        />
      )}
    </div>
  )
}

// Fragment wrapper so a reg can render its main row + an expandable row.
function RegRowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

// ── Document button (title + filename + version) ──
function DocButton({ reg, onOpen }: { reg: LocalRegulationRow; onOpen: () => void }) {
  return (
    <button onClick={onOpen}
      style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-1)', fontFamily: 'inherit', fontSize: 'inherit', textAlign: 'left' }}>
      <span style={{ marginTop: 1, flexShrink: 0 }}><FileText size={16} style={{ color: 'var(--color-danger)' }} /></span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {reg.title}
          {reg.version > 1 && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>v{reg.version}</span>}
          <ExternalLink size={12} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
        </span>
        {reg.description && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{reg.description}</span>}
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{reg.file_name}{reg.file_size_bytes != null ? ` · ${humanFileSize(reg.file_size_bytes)}` : ''}</span>
      </span>
    </button>
  )
}

function IntervalPill({ interval }: { interval: ReviewInterval }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: 'var(--fs-2xs)', fontWeight: 700, padding: '3px 9px',
      borderRadius: 12, background: 'var(--color-bg-inset)', color: 'var(--color-text-2)',
      border: '1px solid var(--color-border)', textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>{intervalLabel(interval)}</span>
  )
}

function IntervalSelect({ value, onChange }: { value: ReviewInterval; onChange: (next: ReviewInterval) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ReviewInterval)}
      style={{
        padding: '5px 8px', background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-sm)', color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)',
        fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
      }}
    >
      <option value="monthly">Monthly</option>
      <option value="quarterly">Quarterly</option>
    </select>
  )
}

// ── Your-status cell ──
function StatusCell({ status, opened, attesting, onAttest }: {
  status: ReturnType<typeof getRegReviewStatus>
  opened: boolean; attesting: boolean; onAttest: () => void
}) {
  if (status.state === 'current') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-success)', fontWeight: 600 }}>
        <CheckCircle2 size={15} /> Reviewed {status.reviewedAt?.slice(0, 10)}
      </span>
    )
  }
  const meta = STATE_META[status.state]
  const color = meta.danger ? 'var(--color-danger)' : 'var(--color-amber)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', fontSize: 'var(--fs-2xs)', fontWeight: 700,
        padding: '3px 9px', borderRadius: 12, textTransform: 'uppercase', letterSpacing: '0.05em',
        color, border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}>{meta.label}</span>
      <Btn
        variant="primary"
        onClick={onAttest}
        disabled={!opened || attesting}
        title={opened ? undefined : 'Open the document first to enable this'}
      >
        <CheckCircle2 size={14} /> {attesting ? 'Recording…' : 'Mark reviewed'}
      </Btn>
    </div>
  )
}

function ComplianceChip({ reviewed, total }: { reviewed: number; total: number }) {
  const done = total > 0 && reviewed >= total
  const color = total === 0 ? 'var(--color-text-3)' : done ? 'var(--color-success)' : 'var(--color-amber)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', fontSize: 'var(--fs-2xs)', fontWeight: 700,
      padding: '3px 9px', borderRadius: 12, color,
      border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
      background: `color-mix(in srgb, ${color} 10%, transparent)`, whiteSpace: 'nowrap',
    }}>
      {total === 0 ? 'No reviewers' : `Reviewed ${reviewed}/${total} this cycle`}
    </span>
  )
}

type ComplianceFoldIn = { user_id: string; reviewed_at: string; initials: string | null; version_at_review: number }

type ComplianceData = {
  reviewed: Map<string, { reviewed_at: string; initials: string | null; version_at_review: number }>
  outstanding: string[]
  reviewedRoster: LocalRegReviewer[]
  /** Reviewers who attested but aren't on the required roster — shown for
   *  parity with the PDF, never counted toward X/Y. */
  foldIns: ComplianceFoldIn[]
  total: number
  /** Live document version — fold-ins whose edition lags it get a "(edition v{n})" tag. */
  version: number
}

function CompliancePanel({ comp, reviewerById }: {
  comp: ComplianceData
  reviewerById: Map<string, LocalRegReviewer>
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, paddingTop: 12 }}>
      <div>
        <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-success)', marginBottom: 6 }}>
          Reviewed this cycle ({comp.reviewedRoster.length})
        </div>
        {comp.reviewedRoster.length === 0 && comp.foldIns.length === 0 ? (
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>None yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {comp.reviewedRoster.map(rv => {
              const info = comp.reviewed.get(rv.user_id)!
              const initials = info.initials ?? rv.operating_initials
              return (
                <div key={rv.user_id} style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)' }}>
                  {displayName(rv)}{initials ? ` (${initials})` : ''} · {info.reviewed_at.slice(0, 10)}
                </div>
              )
            })}
            {/* Out-of-roster fold-ins — same rows the PDF folds in. Labeled,
                excluded from X/Y, and edition-tagged when the reviewed version
                lags the live doc. */}
            {comp.foldIns.map(f => {
              const stale = f.version_at_review < comp.version
              return (
                <div key={f.user_id} style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontStyle: 'italic' }}>
                  Reviewer outside required roster{f.initials ? ` (${f.initials})` : ''} · {f.reviewed_at.slice(0, 10)}
                  {stale ? ` (edition v${f.version_at_review})` : ''}
                </div>
              )
            })}
          </div>
        )}
      </div>
      <div>
        <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-danger)', marginBottom: 6 }}>
          Outstanding ({comp.outstanding.length})
        </div>
        {comp.outstanding.length === 0 ? (
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>All required reviewers are current.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {comp.outstanding.map(uid => {
              const rv = reviewerById.get(uid)
              return (
                <div key={uid} style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)' }}>
                  {rv ? displayName(rv) : '(unknown)'}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Stacked card (narrow) ──
function RegCard({
  reg, status, opened, attesting, canManage, compliance, reviewerById, expanded,
  onToggleExpand, onOpen, onAttest, onReplace, onArchive, onInterval,
}: {
  reg: LocalRegulationRow
  status: ReturnType<typeof getRegReviewStatus>
  opened: boolean; attesting: boolean; canManage: boolean
  compliance: ComplianceData | null
  reviewerById: Map<string, LocalRegReviewer>
  expanded: boolean
  onToggleExpand: () => void
  onOpen: () => void; onAttest: () => void; onReplace: () => void; onArchive: () => void
  onInterval: (next: ReviewInterval) => void
}) {
  return (
    <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <DocButton reg={reg} onOpen={onOpen} />
        {canManage && (
          <span style={{ display: 'inline-flex', gap: 6, flexShrink: 0 }}>
            <button onClick={onReplace} title="Replace file (re-triggers review)" style={iconBtn}><RefreshCw size={14} /></button>
            <button onClick={onArchive} title="Archive" style={iconBtn}><Archive size={14} /></button>
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {canManage ? <IntervalSelect value={reg.review_interval} onChange={onInterval} /> : <IntervalPill interval={reg.review_interval} />}
        <StatusCell status={status} opened={opened} attesting={attesting} onAttest={onAttest} />
      </div>
      {canManage && compliance && (
        <div>
          <button
            onClick={onToggleExpand}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontFamily: 'inherit' }}
          >
            <ComplianceChip reviewed={compliance.reviewedRoster.length} total={compliance.total} />
            {expanded ? <ChevronUp size={14} style={{ color: 'var(--color-text-3)' }} /> : <ChevronDown size={14} style={{ color: 'var(--color-text-3)' }} />}
          </button>
          {expanded && (
            <div style={{ marginTop: 10, borderTop: '1px solid var(--color-border)' }}>
              <CompliancePanel comp={compliance} reviewerById={reviewerById} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Upload dialog — Add (title + description + interval + PDF) / Replace (PDF only) ──
function RegUploadDialog({ mode, title, onClose, onSubmit, onDone }: {
  mode: 'add' | 'replace'
  title: string
  onClose: () => void
  onSubmit: (file: File, meta: { title: string; description?: string; reviewInterval: ReviewInterval }) => Promise<string | null>
  onDone: () => void
}) {
  const [docTitle, setDocTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [interval, setIntervalState] = useState<ReviewInterval>('monthly')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
    if (!isPdf) { toast.error(`${f.name}: only PDF files are accepted`); return }
    if (f.size > MAX_BYTES) { toast.error(`${f.name}: exceeds 25 MB`); return }
    setFile(f)
    if (mode === 'add') setDocTitle(t => (t.trim() ? t : f.name.replace(/\.[^.]+$/, '')))
  }

  const requireTitle = mode === 'add'
  const canSubmit = !!file && !busy && (!requireTitle || !!docTitle.trim())

  const submit = async () => {
    if (!file || busy) return
    if (requireTitle && !docTitle.trim()) return
    setBusy(true)
    // addLocalReg / replaceLocalReg enforce PDF-only + 25 MB and return the
    // optimistic-lock reload message on a concurrent replace — surface both.
    const error = await onSubmit(file, { title: docTitle.trim(), description: desc, reviewInterval: interval })
    setBusy(false)
    if (error) { toast.error(error); return }
    toast.success('Saved')
    onDone(); onClose()
  }

  const close = () => { if (!busy) onClose() }

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 480, maxWidth: '100%', padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <Upload size={16} style={{ color: 'var(--color-accent)' }} />
          <strong style={{ fontSize: 15 }}>{title}</strong>
          <button onClick={close} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)' }}><X size={18} /></button>
        </div>
        <div style={{ padding: 16, display: 'grid', gap: 14 }}>
          {requireTitle && (
            <>
              <Field label="Document title *">
                <input className="input-dark" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="e.g. Local OI 13-204 — Airfield Operations" autoFocus />
              </Field>
              <Field label="Description (optional)">
                <input className="input-dark" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short context for reviewers" />
              </Field>
              <Field label="Review cadence *">
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['monthly', 'quarterly'] as ReviewInterval[]).map(opt => {
                    const on = interval === opt
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setIntervalState(opt)}
                        style={{
                          flex: 1, padding: '8px 0', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                          fontSize: 'var(--fs-sm)', fontWeight: 700, fontFamily: 'inherit',
                          background: on ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)' : 'var(--color-bg-inset)',
                          border: on ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                          color: on ? 'var(--color-accent)' : 'var(--color-text-2)',
                        }}
                      >
                        {intervalLabel(opt)}
                      </button>
                    )
                  })}
                </div>
              </Field>
            </>
          )}
          <Field label="File *">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Btn variant="secondary" onClick={() => fileRef.current?.click()}>
                <Paperclip size={14} /> {file ? 'Change file' : 'Attach PDF'}
              </Btn>
              {file ? (
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={16} style={{ color: 'var(--color-danger)' }} /> {file.name} · {humanFileSize(file.size)}
                </span>
              ) : (
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>No file selected</span>
              )}
              <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={pick} />
            </div>
          </Field>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>PDF only — up to 25 MB.</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--color-border)' }}>
          <Btn variant="ghost" onClick={close} disabled={busy}>Cancel</Btn>
          <Btn variant="primary" onClick={submit} disabled={!canSubmit}>
            <Upload size={14} /> {busy ? 'Uploading…' : mode === 'add' ? 'Upload' : 'Replace'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)', fontWeight: 700 }
const td: React.CSSProperties = { padding: '10px 12px', verticalAlign: 'top' }
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', padding: 2, display: 'inline-flex' }
