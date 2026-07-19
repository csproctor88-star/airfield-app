'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import {
  FileCog, Plus, Download, ChevronDown, ChevronRight, Paperclip,
  ClipboardCheck, Trash2, Pencil, X, AlertTriangle, Info,
} from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import {
  RECORD_TYPE_LABELS, RECORD_TYPE_SHORT_LABELS, STATUSES_BY_TYPE, STATUS_COLORS,
  MOS_CATEGORIES, MOS_NOT_APPLICABLE, ARFF_PETITION_CONTENTS, ARFF_ADVANCE_FILING_DAYS,
  APPROVAL_AUTHORITY_LABELS, ATTACHMENT_KIND_LABELS, REVIEW_RECOMMENDATION_LABELS,
  statusLabel, isExpired, isDecidedRelief, reviewDueState, deviationNotificationOverdue,
  deviationNotifyDeadline, reconsiderationDeadline,
  type ModsExemptionRecordType, type ModsExemptionStatus,
  type ModsExemptionAttachmentKind, type ApprovalAuthority, type ReviewRecommendation,
} from '@/lib/mods-exemptions/constants'
import {
  fetchModsExemptions, fetchModsExemptionReviews, fetchModsExemptionAttachments,
  createModsExemption, updateModsExemption, deleteModsExemption,
  addModsExemptionReview, addModsExemptionAttachment, deleteModsExemptionAttachment,
  getModsExemptionAttachmentUrl,
  type ModsExemptionRow, type ModsExemptionReviewRow, type ModsExemptionAttachmentRow,
  type ModsExemptionInput,
} from '@/lib/supabase/mods-exemptions'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'

function todayLocalIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// The editable form state, one shape across all three record types; the
// rendered fields depend on record_type.
type FormState = {
  editId: string | null
  record_type: ModsExemptionRecordType
  title: string
  status: ModsExemptionStatus
  standard_reference: string
  baseline_summary: string
  relief_summary: string
  justification: string
  public_interest: string
  safety_justification: string
  mos_category: string
  mos_subcategory: string
  approval_authority: '' | ApprovalAuthority
  agis_tracking: string
  docket_number: string
  arff_small_airport: boolean
  date_submitted: string
  date_decided: string
  effective_date: string
  expiration_date: string
  decision_summary: string
  decision_conditions: string
  next_review_due: string
  deviation_date: string
  notified_date: string
  written_notice_requested: boolean
  written_notice_provided: boolean
  notes: string
}

function emptyForm(recordType: ModsExemptionRecordType): FormState {
  return {
    editId: null,
    record_type: recordType,
    title: '',
    status: recordType === 'deviation' ? 'notification_pending' : 'draft',
    standard_reference: '',
    baseline_summary: '',
    relief_summary: '',
    justification: '',
    public_interest: '',
    safety_justification: '',
    mos_category: '',
    mos_subcategory: '',
    approval_authority: '',
    agis_tracking: '',
    docket_number: '',
    arff_small_airport: false,
    date_submitted: '',
    date_decided: '',
    effective_date: '',
    expiration_date: '',
    decision_summary: '',
    decision_conditions: '',
    next_review_due: '',
    deviation_date: recordType === 'deviation' ? todayLocalIso() : '',
    notified_date: '',
    written_notice_requested: false,
    written_notice_provided: false,
    notes: '',
  }
}

function formFromRow(r: ModsExemptionRow): FormState {
  return {
    editId: r.id,
    record_type: r.record_type,
    title: r.title,
    status: r.status,
    standard_reference: r.standard_reference,
    baseline_summary: r.baseline_summary ?? '',
    relief_summary: r.relief_summary ?? '',
    justification: r.justification ?? '',
    public_interest: r.public_interest ?? '',
    safety_justification: r.safety_justification ?? '',
    mos_category: r.mos_category ?? '',
    mos_subcategory: r.mos_subcategory ?? '',
    approval_authority: r.approval_authority ?? '',
    agis_tracking: r.agis_tracking ?? '',
    docket_number: r.docket_number ?? '',
    arff_small_airport: r.arff_small_airport,
    date_submitted: r.date_submitted ?? '',
    date_decided: r.date_decided ?? '',
    effective_date: r.effective_date ?? '',
    expiration_date: r.expiration_date ?? '',
    decision_summary: r.decision_summary ?? '',
    decision_conditions: r.decision_conditions ?? '',
    next_review_due: r.next_review_due ?? '',
    deviation_date: r.deviation_date ?? '',
    notified_date: r.notified_date ?? '',
    written_notice_requested: r.written_notice_requested,
    written_notice_provided: r.written_notice_provided,
    notes: r.notes ?? '',
  }
}

function formToInput(f: FormState): ModsExemptionInput {
  const opt = (v: string) => v.trim() || null
  return {
    record_type: f.record_type,
    title: f.title.trim(),
    status: f.status,
    standard_reference: f.standard_reference.trim(),
    baseline_summary: opt(f.baseline_summary),
    relief_summary: opt(f.relief_summary),
    justification: opt(f.justification),
    public_interest: f.record_type === 'exemption' ? opt(f.public_interest) : null,
    safety_justification: opt(f.safety_justification),
    mos_category: f.record_type === 'mos' ? opt(f.mos_category) : null,
    mos_subcategory: f.record_type === 'mos' ? opt(f.mos_subcategory) : null,
    approval_authority: f.record_type === 'mos' && f.approval_authority ? f.approval_authority : null,
    agis_tracking: f.record_type === 'mos' ? opt(f.agis_tracking) : null,
    docket_number: f.record_type === 'exemption' ? opt(f.docket_number) : null,
    arff_small_airport: f.record_type === 'exemption' ? f.arff_small_airport : false,
    date_submitted: f.record_type !== 'deviation' ? opt(f.date_submitted) : null,
    date_decided: f.record_type !== 'deviation' ? opt(f.date_decided) : null,
    effective_date: f.record_type !== 'deviation' ? opt(f.effective_date) : null,
    expiration_date: f.record_type !== 'deviation' ? opt(f.expiration_date) : null,
    decision_summary: f.record_type !== 'deviation' ? opt(f.decision_summary) : null,
    decision_conditions: f.record_type !== 'deviation' ? opt(f.decision_conditions) : null,
    next_review_due: f.record_type !== 'deviation' ? opt(f.next_review_due) : null,
    deviation_date: f.record_type === 'deviation' ? opt(f.deviation_date) : null,
    notified_date: f.record_type === 'deviation' ? opt(f.notified_date) : null,
    written_notice_requested: f.record_type === 'deviation' ? f.written_notice_requested : false,
    written_notice_provided: f.record_type === 'deviation' ? f.written_notice_provided : false,
    notes: opt(f.notes),
  }
}

type ReviewFormState = {
  record: ModsExemptionRow
  review_date: string
  justification_still_valid: boolean
  recommendation: '' | ReviewRecommendation
  notes: string
}

const inputCls = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-2 text-sm text-[var(--color-text-1)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]'
const labelCls = 'block text-xs font-medium text-[var(--color-text-3)] mb-1'
const btnPrimary = 'inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50'
const btnGhost = 'inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-2)] hover:bg-[var(--color-bg-2)]'

export default function ModificationsExemptionsPage() {
  const { installationId, currentInstallation } = useInstallation()
  const { has } = usePermissions()
  const canWrite = has(PERM.MODS_EXEMPTIONS_WRITE)

  const [loaded, setLoaded] = useState(false)
  const [records, setRecords] = useState<ModsExemptionRow[]>([])
  const [reviews, setReviews] = useState<ModsExemptionReviewRow[]>([])
  const [attachments, setAttachments] = useState<ModsExemptionAttachmentRow[]>([])
  const [typeFilter, setTypeFilter] = useState<ModsExemptionRecordType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending' | 'history'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [reviewForm, setReviewForm] = useState<ReviewFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadKind, setUploadKind] = useState<ModsExemptionAttachmentKind>('decision_letter')

  const todayIso = todayLocalIso()

  const load = useCallback(async () => {
    if (!installationId) return
    const [recs, revs, atts] = await Promise.all([
      fetchModsExemptions(installationId),
      fetchModsExemptionReviews(installationId),
      fetchModsExemptionAttachments(installationId),
    ])
    setRecords(recs)
    setReviews(revs)
    setAttachments(atts)
    setLoaded(true)
  }, [installationId])

  useEffect(() => { load() }, [load])

  // ── Derived ──
  const stats = useMemo(() => {
    const activeMos = records.filter((r) => r.record_type === 'mos' && isDecidedRelief(r.status) && !isExpired(r, todayIso)).length
    const activeEx = records.filter((r) => r.record_type === 'exemption' && isDecidedRelief(r.status) && !isExpired(r, todayIso)).length
    const pending = records.filter((r) => r.status === 'submitted' || r.status === 'under_review').length
    const reviewsDue = records.filter((r) => reviewDueState(r, todayIso) !== null).length
    const expired = records.filter((r) => isExpired(r, todayIso)).length
    return { activeMos, activeEx, pending, reviewsDue, expired }
  }, [records, todayIso])

  const visible = useMemo(() => {
    return records.filter((r) => {
      if (typeFilter !== 'all' && r.record_type !== typeFilter) return false
      if (statusFilter === 'active') {
        return isDecidedRelief(r.status) && !isExpired(r, todayIso)
      }
      if (statusFilter === 'pending') {
        return r.status === 'draft' || r.status === 'submitted' || r.status === 'under_review' || r.status === 'notification_pending'
      }
      if (statusFilter === 'history') {
        return r.status === 'denied' || r.status === 'withdrawn' || r.status === 'closed' || isExpired(r, todayIso)
      }
      return true
    })
  }, [records, typeFilter, statusFilter, todayIso])

  // ── Actions ──
  const saveForm = async () => {
    if (!installationId || !form) return
    if (!form.title.trim() || !form.standard_reference.trim()) {
      toast.error('Title and the standard / requirement reference are required.')
      return
    }
    setSaving(true)
    const input = formToInput(form)
    const result = form.editId
      ? await updateModsExemption(form.editId, input)
      : await createModsExemption(installationId, input)
    setSaving(false)
    if (result.error) { toast.error(result.error); return }
    toast.success(form.editId ? 'Record updated.' : 'Record created.')
    setForm(null)
    load()
  }

  const removeRecord = async (r: ModsExemptionRow) => {
    if (!window.confirm(`Delete "${r.title}"? Attachments on file are removed with it. This cannot be undone.`)) return
    const { error } = await deleteModsExemption(r, attachments)
    if (error) { toast.error(error); return }
    toast.success('Record deleted.')
    if (expandedId === r.id) setExpandedId(null)
    load()
  }

  const saveReview = async () => {
    if (!reviewForm) return
    setSaving(true)
    const { error } = await addModsExemptionReview(reviewForm.record, {
      review_date: reviewForm.review_date,
      justification_still_valid: reviewForm.justification_still_valid,
      recommendation: reviewForm.recommendation || null,
      notes: reviewForm.notes,
    })
    setSaving(false)
    if (error) { toast.error(error); return }
    toast.success('Annual review logged.')
    setReviewForm(null)
    load()
  }

  const uploadAttachment = async (record: ModsExemptionRow, file: File) => {
    const { error } = await addModsExemptionAttachment(record, file, uploadKind)
    if (error) { toast.error(error); return }
    toast.success('Attachment uploaded.')
    load()
  }

  const openAttachment = async (a: ModsExemptionAttachmentRow) => {
    const { url, error } = await getModsExemptionAttachmentUrl(a.file_path)
    if (!url) { toast.error(error ?? 'Could not open the file.'); return }
    window.open(url, '_blank', 'noopener')
  }

  const removeAttachment = async (a: ModsExemptionAttachmentRow) => {
    if (!window.confirm(`Remove attachment "${a.file_name}"?`)) return
    const { error } = await deleteModsExemptionAttachment(a)
    if (error) { toast.error(error); return }
    load()
  }

  const downloadRegister = async () => {
    const { generateModsExemptionsRegisterPdf } = await import('@/lib/mods-exemptions-pdf')
    const { doc, filename } = await generateModsExemptionsRegisterPdf({
      baseName: currentInstallation?.name,
      baseIcao: currentInstallation?.icao,
      records, reviews,
      generatedAtIso: new Date().toISOString(),
    })
    doc.save(filename)
  }

  const downloadDetail = async (record: ModsExemptionRow) => {
    const { generateModsExemptionDetailPdf } = await import('@/lib/mods-exemptions-pdf')
    const { doc, filename } = await generateModsExemptionDetailPdf({
      baseName: currentInstallation?.name,
      baseIcao: currentInstallation?.icao,
      record, reviews, attachments,
      generatedAtIso: new Date().toISOString(),
    })
    doc.save(filename)
  }

  if (!loaded) return <LoadingState message="Loading Modifications & Exemptions..." />

  // ── Render helpers ──
  const statusChip = (r: ModsExemptionRow) => {
    const expired = isExpired(r, todayIso)
    return (
      <span className="inline-flex items-center gap-1.5">
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ color: STATUS_COLORS[r.status], border: `1px solid ${STATUS_COLORS[r.status]}` }}
        >
          {statusLabel(r.record_type, r.status)}
        </span>
        {expired && (
          <span className="rounded-full border border-[var(--color-danger)] px-2 py-0.5 text-xs font-medium text-[var(--color-danger)]">
            Expired
          </span>
        )}
      </span>
    )
  }

  const dueChip = (r: ModsExemptionRow) => {
    const due = reviewDueState(r, todayIso)
    const devOverdue = deviationNotificationOverdue(r, todayIso)
    if (!due && !devOverdue) return null
    const overdue = due === 'overdue' || devOverdue
    return (
      <span
        className="rounded-full px-2 py-0.5 text-xs font-medium"
        style={{
          color: overdue ? 'var(--color-danger)' : 'var(--color-warning)',
          border: `1px solid ${overdue ? 'var(--color-danger)' : 'var(--color-warning)'}`,
        }}
      >
        {devOverdue ? 'RADM notice overdue' : due === 'overdue' ? 'Annual review overdue' : 'Review due soon'}
      </span>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <FileCog className="h-6 w-6 text-[var(--color-accent)]" />
          <div>
            <h1 className="text-xl font-semibold text-[var(--color-text-1)]">Modifications &amp; Exemptions</h1>
            <p className="text-sm text-[var(--color-text-3)]">
              Modification of Standards requests (FAA Order 5300.1G), Part 139 exemption petitions
              (&sect;139.111 / 14 CFR Part 11), and &sect;139.113 emergency deviations.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className={btnGhost} onClick={downloadRegister}>
            <Download className="h-4 w-4" /> Register PDF
          </button>
          {canWrite && (
            <button className={btnPrimary} onClick={() => setForm(emptyForm('mos'))}>
              <Plus className="h-4 w-4" /> New record
            </button>
          )}
        </div>
      </div>

      {/* Stat strip */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          { label: 'Active MOS', value: stats.activeMos },
          { label: 'Active exemptions', value: stats.activeEx },
          { label: 'Decision pending', value: stats.pending },
          { label: 'Reviews due', value: stats.reviewsDue },
          { label: 'Expired', value: stats.expired },
        ].map((sItem) => (
          <div key={sItem.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-1)] px-3 py-2">
            <div className="text-lg font-semibold text-[var(--color-text-1)]">{sItem.value}</div>
            <div className="text-xs text-[var(--color-text-3)]">{sItem.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className={`${inputCls} w-auto`} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}>
          <option value="all">All types</option>
          <option value="mos">{RECORD_TYPE_LABELS.mos}</option>
          <option value="exemption">{RECORD_TYPE_LABELS.exemption}</option>
          <option value="deviation">{RECORD_TYPE_LABELS.deviation}</option>
        </select>
        <select className={`${inputCls} w-auto`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="all">All statuses</option>
          <option value="active">Active relief (approved / granted)</option>
          <option value="pending">Draft / pending decision</option>
          <option value="history">History (denied, withdrawn, expired, closed)</option>
        </select>
      </div>

      {/* Record list */}
      {records.length === 0 ? (
        <EmptyState message="No modification, exemption, or deviation records yet. A Modification of Standards tracks a deviation from an FAA design, construction, material, or equipment standard (FAA Order 5300.1G); a Part 139 exemption is petitioned under 14 CFR 139.111 via Part 11. An inspector's pre-inspection document list includes this register." />
      ) : visible.length === 0 ? (
        <EmptyState message="No records match the current filters." />
      ) : (
        <div className="space-y-2">
          {visible.map((r) => {
            const expanded = expandedId === r.id
            const recAttachments = attachments.filter((a) => a.record_id === r.id)
            const recReviews = reviews.filter((v) => v.record_id === r.id)
            return (
              <div key={r.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-1)]">
                <button
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  onClick={() => setExpandedId(expanded ? null : r.id)}
                >
                  {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-text-3)]" /> : <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-3)]" />}
                  <span className="rounded bg-[var(--color-bg-2)] px-2 py-0.5 text-xs font-semibold text-[var(--color-text-2)]">
                    {RECORD_TYPE_SHORT_LABELS[r.record_type]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--color-text-1)]">{r.title}</span>
                    <span className="block truncate text-xs text-[var(--color-text-3)]">{r.standard_reference}</span>
                  </span>
                  {dueChip(r)}
                  {statusChip(r)}
                </button>

                {expanded && (
                  <div className="border-t border-[var(--color-border)] px-4 py-3">
                    {/* Key dates + type-specific summary */}
                    <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                      {r.record_type !== 'deviation' && (
                        <>
                          <Field label="Submitted" value={r.date_submitted} />
                          <Field label="Decided" value={r.date_decided} />
                          <Field label="Effective" value={r.effective_date} />
                          <Field label="Expires" value={r.expiration_date} />
                          <Field label="Last annual review" value={r.last_reviewed_date} />
                          <Field label="Next review due" value={r.next_review_due} />
                        </>
                      )}
                      {r.record_type === 'mos' && (
                        <>
                          <Field label="Category" value={r.mos_category ? `${r.mos_category}${r.mos_subcategory ? ` — ${r.mos_subcategory}` : ''}` : null} wide />
                          <Field label="Authority" value={r.approval_authority ? APPROVAL_AUTHORITY_LABELS[r.approval_authority] : null} />
                          <Field label="AGIS / airspace case" value={r.agis_tracking} />
                        </>
                      )}
                      {r.record_type === 'exemption' && (
                        <>
                          <Field label="Docket" value={r.docket_number} />
                          {r.arff_small_airport && <Field label="Petition path" value={`ARFF small-airport (§139.111(b)) — file ${ARFF_ADVANCE_FILING_DAYS} days ahead`} wide />}
                          {r.status === 'denied' && r.date_decided && (
                            <Field label="Reconsideration window (§11.101)" value={`FAA must receive it by ${reconsiderationDeadline(r.date_decided)}`} wide />
                          )}
                        </>
                      )}
                      {r.record_type === 'deviation' && (
                        <>
                          <Field label="Deviation date" value={r.deviation_date} />
                          <Field label="Notify RADM by" value={r.deviation_date ? deviationNotifyDeadline(r.deviation_date) : null} />
                          <Field label="RADM notified" value={r.notified_date} />
                          <Field label="Written notice" value={r.written_notice_requested ? (r.written_notice_provided ? 'Requested — provided' : 'Requested — NOT provided yet') : 'Not requested'} />
                        </>
                      )}
                    </div>
                    {(r.relief_summary || r.decision_summary || r.decision_conditions) && (
                      <div className="mb-3 space-y-1 text-sm">
                        {r.relief_summary && <Field label="Relief / difference" value={r.relief_summary} wide block />}
                        {r.decision_summary && <Field label="Decision" value={r.decision_summary} wide block />}
                        {r.decision_conditions && <Field label="Conditions" value={r.decision_conditions} wide block />}
                      </div>
                    )}

                    {/* Reviews */}
                    {r.record_type !== 'deviation' && (
                      <div className="mb-3">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-3)]">
                            Annual reviews ({recReviews.length})
                          </span>
                          {canWrite && isDecidedRelief(r.status) && (
                            <button
                              className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
                              onClick={() => setReviewForm({ record: r, review_date: todayIso, justification_still_valid: true, recommendation: '', notes: '' })}
                            >
                              <ClipboardCheck className="h-3.5 w-3.5" /> Log annual review
                            </button>
                          )}
                        </div>
                        {recReviews.length === 0 ? (
                          <p className="text-xs text-[var(--color-text-3)]">
                            No reviews logged. Approved relief is reviewed annually for currency (FAA Order 5280.5D &sect;2.12.2).
                          </p>
                        ) : (
                          <ul className="space-y-1 text-sm">
                            {recReviews.map((v) => (
                              <li key={v.id} className="flex flex-wrap items-center gap-2">
                                <span className="text-[var(--color-text-2)]">{v.review_date}</span>
                                <span className={v.justification_still_valid ? 'text-[var(--color-success)]' : 'font-semibold text-[var(--color-danger)]'}>
                                  {v.justification_still_valid ? 'Justification still valid' : 'Justification NOT valid'}
                                </span>
                                {v.recommendation && <span className="text-[var(--color-text-3)]">{REVIEW_RECOMMENDATION_LABELS[v.recommendation]}</span>}
                                {v.notes && <span className="text-[var(--color-text-3)]">— {v.notes}</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {/* Attachments */}
                    <div className="mb-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-3)]">
                          Attachments ({recAttachments.length})
                        </span>
                        {canWrite && (
                          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[var(--color-accent)]">
                            <select
                              className="rounded border border-[var(--color-border)] bg-[var(--color-bg-2)] px-1 py-0.5 text-xs"
                              value={uploadKind}
                              onChange={(e) => setUploadKind(e.target.value as ModsExemptionAttachmentKind)}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {(Object.keys(ATTACHMENT_KIND_LABELS) as ModsExemptionAttachmentKind[]).map((k) => (
                                <option key={k} value={k}>{ATTACHMENT_KIND_LABELS[k]}</option>
                              ))}
                            </select>
                            <span className="hover:underline">Upload PDF</span>
                            <input
                              type="file"
                              accept="application/pdf,.pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) uploadAttachment(r, file)
                                e.target.value = ''
                              }}
                            />
                          </label>
                        )}
                      </div>
                      {recAttachments.length === 0 ? (
                        <p className="text-xs text-[var(--color-text-3)]">No documents on file. PDF only, 25 MB max.</p>
                      ) : (
                        <ul className="space-y-1">
                          {recAttachments.map((a) => (
                            <li key={a.id} className="flex items-center gap-2 text-sm">
                              <Paperclip className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-3)]" />
                              <button className="truncate text-[var(--color-accent)] hover:underline" onClick={() => openAttachment(a)}>
                                {a.file_name}
                              </button>
                              <span className="shrink-0 text-xs text-[var(--color-text-3)]">{ATTACHMENT_KIND_LABELS[a.kind]}</span>
                              {canWrite && (
                                <button className="shrink-0 text-[var(--color-text-3)] hover:text-[var(--color-danger)]" onClick={() => removeAttachment(a)} aria-label={`Remove ${a.file_name}`}>
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Row actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button className={btnGhost} onClick={() => downloadDetail(r)}>
                        <Download className="h-4 w-4" /> Record PDF
                      </button>
                      {canWrite && (
                        <>
                          <button className={btnGhost} onClick={() => setForm(formFromRow(r))}>
                            <Pencil className="h-4 w-4" /> Edit
                          </button>
                          <button className={`${btnGhost} text-[var(--color-danger)]`} onClick={() => removeRecord(r)}>
                            <Trash2 className="h-4 w-4" /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Create / edit modal ── */}
      {form && (
        <Modal onClose={() => setForm(null)} title={form.editId ? 'Edit record' : 'New record'}>
          <div className="space-y-3">
            {!form.editId && (
              <div>
                <label className={labelCls}>Record type</label>
                <div className="flex flex-wrap gap-2">
                  {(['mos', 'exemption', 'deviation'] as ModsExemptionRecordType[]).map((t) => (
                    <button
                      key={t}
                      className={`rounded-lg border px-3 py-1.5 text-sm ${form.record_type === t ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'border-[var(--color-border)] text-[var(--color-text-2)]'}`}
                      onClick={() => setForm(emptyForm(t))}
                    >
                      {RECORD_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* MOS not-applicable hint (5300.1G ¶8.i) */}
            {form.record_type === 'mos' && !form.editId && (
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] p-3 text-xs text-[var(--color-text-3)]">
                <div className="mb-1 flex items-center gap-1.5 font-medium text-[var(--color-text-2)]">
                  <Info className="h-3.5 w-3.5" /> A MOS is not applicable for (FAA Order 5300.1G &para;8.i):
                </div>
                <ul className="list-inside list-disc space-y-0.5">
                  {MOS_NOT_APPLICABLE.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            )}

            <div>
              <label className={labelCls}>Title *</label>
              <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={form.record_type === 'deviation' ? 'e.g., ARFF vehicle out of service during hangar fire response' : 'e.g., Taxiway A object free area — light poles'} />
            </div>

            <div>
              <label className={labelCls}>
                {form.record_type === 'mos' ? 'Standard being modified *' : form.record_type === 'exemption' ? 'Regulation section(s) (§11.81(b)) *' : 'Requirement deviated from (Subpart D / ACM) *'}
              </label>
              <input className={inputCls} value={form.standard_reference} onChange={(e) => setForm({ ...form, standard_reference: e.target.value })} placeholder={form.record_type === 'mos' ? 'e.g., AC 150/5300-13B — Taxiway Object Free Area (TOFA)' : form.record_type === 'exemption' ? 'e.g., 14 CFR §139.319(h)(1)' : 'e.g., §139.319(h) / ACM §4.2'} />
            </div>

            {/* Status — constrained to the record type's track */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Status</label>
                <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ModsExemptionStatus })}>
                  {STATUSES_BY_TYPE[form.record_type].map((sVal) => (
                    <option key={sVal} value={sVal}>{statusLabel(form.record_type, sVal)}</option>
                  ))}
                </select>
                {form.record_type === 'mos' && (form.status === 'approved') && (
                  <p className="mt-1 text-xs text-[var(--color-text-3)]">
                    An approved MOS cannot be modified — submit a new MOS if changes are needed (5300.1G &para;8.g).
                  </p>
                )}
              </div>
              {form.record_type === 'mos' && (
                <div>
                  <label className={labelCls}>Review authority</label>
                  <select className={inputCls} value={form.approval_authority} onChange={(e) => setForm({ ...form, approval_authority: e.target.value as FormState['approval_authority'] })}>
                    <option value="">—</option>
                    {(Object.keys(APPROVAL_AUTHORITY_LABELS) as ApprovalAuthority[]).map((a) => (
                      <option key={a} value={a}>{APPROVAL_AUTHORITY_LABELS[a]}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* MOS taxonomy */}
            {form.record_type === 'mos' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Category (Order 5300.1G App. A)</label>
                  <select className={inputCls} value={form.mos_category} onChange={(e) => setForm({ ...form, mos_category: e.target.value, mos_subcategory: '' })}>
                    <option value="">—</option>
                    {Object.keys(MOS_CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Subcategory</label>
                  <select className={inputCls} value={form.mos_subcategory} onChange={(e) => setForm({ ...form, mos_subcategory: e.target.value })} disabled={!form.mos_category}>
                    <option value="">—</option>
                    {(MOS_CATEGORIES[form.mos_category] ?? []).map((sc) => <option key={sc} value={sc}>{sc}</option>)}
                  </select>
                </div>
              </div>
            )}

            {form.record_type !== 'deviation' && (
              <>
                <div>
                  <label className={labelCls}>Baseline — what the standard requires</label>
                  <textarea className={inputCls} rows={2} value={form.baseline_summary} onChange={(e) => setForm({ ...form, baseline_summary: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>{form.record_type === 'exemption' ? 'Extent of relief sought and why (§11.81(c))' : 'Proposed modification — what differs'}</label>
                  <textarea className={inputCls} rows={2} value={form.relief_summary} onChange={(e) => setForm({ ...form, relief_summary: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>{form.record_type === 'mos' ? 'Justification (unique local conditions, cost, efficiency — ¶11.a certifications)' : 'Justification'}</label>
                  <textarea className={inputCls} rows={2} value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} />
                </div>
                {form.record_type === 'exemption' && (
                  <div>
                    <label className={labelCls}>Public interest — how it benefits the public (§11.81(d))</label>
                    <textarea className={inputCls} rows={2} value={form.public_interest} onChange={(e) => setForm({ ...form, public_interest: e.target.value })} />
                  </div>
                )}
                <div>
                  <label className={labelCls}>
                    {form.record_type === 'exemption'
                      ? 'Safety — no adverse effect, or equivalent level of safety (§11.81(e))'
                      : 'Safety — acceptable level of safety (5300.1G ¶11.a(b))'}
                  </label>
                  <textarea className={inputCls} rows={2} value={form.safety_justification} onChange={(e) => setForm({ ...form, safety_justification: e.target.value })} />
                </div>
              </>
            )}

            {/* Exemption specifics */}
            {form.record_type === 'exemption' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>FAA docket number (§11.91)</label>
                    <input className={inputCls} value={form.docket_number} onChange={(e) => setForm({ ...form, docket_number: e.target.value })} placeholder="e.g., FAA-2026-xxxx" />
                  </div>
                  <label className="mt-5 inline-flex items-center gap-2 text-sm text-[var(--color-text-2)]">
                    <input type="checkbox" checked={form.arff_small_airport} onChange={(e) => setForm({ ...form, arff_small_airport: e.target.checked })} />
                    ARFF small-airport petition (§139.111(b))
                  </label>
                </div>
                {form.arff_small_airport && (
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] p-3 text-xs text-[var(--color-text-3)]">
                    <div className="mb-1 flex items-center gap-1.5 font-medium text-[var(--color-text-2)]">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      File at least {ARFF_ADVANCE_FILING_DAYS} days before the proposed effective date. The petition must include (§139.111(b)(2)):
                    </div>
                    <ul className="list-inside list-disc space-y-0.5">
                      {ARFF_PETITION_CONTENTS.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                )}
              </>
            )}

            {form.record_type === 'mos' && (
              <div>
                <label className={labelCls}>AGIS MOS id / NRA airspace case number</label>
                <input className={inputCls} value={form.agis_tracking} onChange={(e) => setForm({ ...form, agis_tracking: e.target.value })} />
              </div>
            )}

            {/* Dates + decision */}
            {form.record_type !== 'deviation' ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div><label className={labelCls}>Submitted</label><input type="date" className={inputCls} value={form.date_submitted} onChange={(e) => setForm({ ...form, date_submitted: e.target.value })} /></div>
                  <div><label className={labelCls}>Decided</label><input type="date" className={inputCls} value={form.date_decided} onChange={(e) => setForm({ ...form, date_decided: e.target.value })} /></div>
                  <div><label className={labelCls}>Effective</label><input type="date" className={inputCls} value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} /></div>
                  <div>
                    <label className={labelCls}>Expires</label>
                    <input type="date" className={inputCls} value={form.expiration_date} onChange={(e) => setForm({ ...form, expiration_date: e.target.value })} />
                  </div>
                </div>
                {form.record_type === 'mos' && (
                  <p className="text-xs text-[var(--color-text-3)]">
                    Design-standard MOS expire no later than 5 years from approval and must be re-submitted for extension (5300.1G &para;8.f). Take the dates from the approval letter.
                  </p>
                )}
                <div>
                  <label className={labelCls}>Decision summary</label>
                  <textarea className={inputCls} rows={2} value={form.decision_summary} onChange={(e) => setForm({ ...form, decision_summary: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Conditions in the decision letter (5300.1G &para;9)</label>
                  <textarea className={inputCls} rows={2} value={form.decision_conditions} onChange={(e) => setForm({ ...form, decision_conditions: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Next annual review due</label>
                    <input type="date" className={inputCls} value={form.next_review_due} onChange={(e) => setForm({ ...form, next_review_due: e.target.value })} />
                    <p className="mt-1 text-xs text-[var(--color-text-3)]">Set automatically when a review is logged; set manually for the first cycle.</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Deviation date *</label><input type="date" className={inputCls} value={form.deviation_date} onChange={(e) => setForm({ ...form, deviation_date: e.target.value })} /></div>
                  <div><label className={labelCls}>RADM notified on</label><input type="date" className={inputCls} value={form.notified_date} onChange={(e) => setForm({ ...form, notified_date: e.target.value })} /></div>
                </div>
                {form.deviation_date && (
                  <p className="text-xs text-[var(--color-text-3)]">
                    Notify the Regional Airports Division Manager of the nature, extent, and duration by <strong>{deviationNotifyDeadline(form.deviation_date)}</strong> (within 14 days — &sect;139.113).
                  </p>
                )}
                <div>
                  <label className={labelCls}>Nature, extent, and duration of the deviation</label>
                  <textarea className={inputCls} rows={3} value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} />
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-2)]">
                    <input type="checkbox" checked={form.written_notice_requested} onChange={(e) => setForm({ ...form, written_notice_requested: e.target.checked })} />
                    RADM requested written notification
                  </label>
                  {form.written_notice_requested && (
                    <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-2)]">
                      <input type="checkbox" checked={form.written_notice_provided} onChange={(e) => setForm({ ...form, written_notice_provided: e.target.checked })} />
                      Written notification provided
                    </label>
                  )}
                </div>
              </>
            )}

            <div>
              <label className={labelCls}>Notes</label>
              <textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button className={btnGhost} onClick={() => setForm(null)}>Cancel</button>
              <button className={btnPrimary} onClick={saveForm} disabled={saving}>
                {saving ? 'Saving…' : form.editId ? 'Save changes' : 'Create record'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Annual review modal ── */}
      {reviewForm && (
        <Modal onClose={() => setReviewForm(null)} title={`Log annual review — ${reviewForm.record.title}`}>
          <div className="space-y-3">
            <p className="text-xs text-[var(--color-text-3)]">
              Each exemption must be reviewed annually for currency, extension, or renewal (FAA Order 5280.5D &sect;2.12.2).
              This answers the certification-inspection item &ldquo;Justification Still Valid&rdquo; (Form 5280-4, &sect;139.111).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Review date</label>
                <input type="date" className={inputCls} value={reviewForm.review_date} onChange={(e) => setReviewForm({ ...reviewForm, review_date: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Recommendation</label>
                <select className={inputCls} value={reviewForm.recommendation} onChange={(e) => setReviewForm({ ...reviewForm, recommendation: e.target.value as ReviewFormState['recommendation'] })}>
                  <option value="">—</option>
                  {(Object.keys(REVIEW_RECOMMENDATION_LABELS) as ReviewRecommendation[]).map((k) => (
                    <option key={k} value={k}>{REVIEW_RECOMMENDATION_LABELS[k]}</option>
                  ))}
                </select>
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text-2)]">
              <input
                type="checkbox"
                checked={reviewForm.justification_still_valid}
                onChange={(e) => setReviewForm({ ...reviewForm, justification_still_valid: e.target.checked })}
              />
              Justification is still valid
            </label>
            <div>
              <label className={labelCls}>Notes</label>
              <textarea className={inputCls} rows={2} value={reviewForm.notes} onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className={btnGhost} onClick={() => setReviewForm(null)}>Cancel</button>
              <button className={btnPrimary} onClick={saveReview} disabled={saving || !reviewForm.review_date}>
                {saving ? 'Saving…' : 'Log review'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Field({ label, value, wide, block }: { label: string; value: string | null; wide?: boolean; block?: boolean }) {
  if (!value) return null
  return (
    <div className={wide ? 'col-span-2' : undefined}>
      <span className="text-xs text-[var(--color-text-3)]">{label}: </span>
      <span className={`text-[var(--color-text-1)] ${block ? 'block' : ''}`}>{value}</span>
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div
        className="my-8 w-full max-w-2xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-1)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-text-1)]">{title}</h2>
          <button className="text-[var(--color-text-3)] hover:text-[var(--color-text-1)]" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
