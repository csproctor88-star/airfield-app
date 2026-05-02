'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import { formatZuluDate, formatZuluDateTime } from '@/lib/utils'
import { PERM, usePermissions } from '@/lib/permissions'
import {
  fetchPprColumns,
  fetchPprEntries,
  createPprEntry,
  updatePprEntry,
  deletePprEntry,
  triagePprEntry,
  coordinatePprEntry,
  approvePprEntry,
  denyPprEntry,
  fetchPprCoordinationForEntries,
  fetchPendingTriageCount,
  fetchPendingApprovalCount,
  fetchPendingCoordinationCounts,
  fetchPprRemarks,
  addPprRemark,
  cancelPprEntry,
  isSummaryColumn,
  formatPprColumnValue,
  type PprColumn,
  type PprEntry,
  type PprCoordination,
  type PprRemark,
  type PprStatus,
} from '@/lib/supabase/ppr'
import { fetchPprAgencies, type PprAgency } from '@/lib/supabase/ppr-agencies'
import { fetchAgencyCoordinatorCounts } from '@/lib/supabase/ppr-agency-members'
import { sendPdfViaEmail } from '@/lib/email-pdf'
import EmailPdfModal from '@/components/ui/email-pdf-modal'
import { PprFieldInput } from '@/components/ppr/ppr-field-input'
import type jsPDF from 'jspdf'
import {
  Plus, FileText, Mail, Search, SlidersHorizontal, X,
  Inbox, MailQuestion, Clock, CheckCircle2, XCircle, Hourglass,
  CheckCircle, AlertTriangle, AlertCircle,
  Route, Check, CheckSquare, Bookmark,
} from 'lucide-react'

type StatusFilter = 'all' | 'pending_amops_triage' | 'pending_coordination' | 'pending_amops_approval' | 'approved' | 'denied' | 'canceled'

// Color tokens used by the status chip + KPI pills.
const STATUS_META: Record<PprStatus, { label: string; bg: string; fg: string; border: string }> = {
  pending_amops_triage:    { label: 'Awaiting Review',    bg: 'rgba(220,38,38,0.12)',  fg: '#ef4444', border: 'rgba(220,38,38,0.4)' },
  pending_coordination:    { label: 'In Coordination',    bg: 'rgba(56,189,248,0.10)', fg: 'var(--color-accent)', border: 'rgba(56,189,248,0.4)' },
  pending_amops_approval:  { label: 'Awaiting Approval',  bg: 'rgba(245,158,11,0.12)', fg: '#f59e0b', border: 'rgba(245,158,11,0.4)' },
  approved:                { label: 'Approved',           bg: 'rgba(34,197,94,0.10)',  fg: '#22c55e', border: 'rgba(34,197,94,0.4)' },
  denied:                  { label: 'Denied',             bg: 'rgba(220,38,38,0.10)',  fg: '#ef4444', border: 'rgba(220,38,38,0.4)' },
  canceled:                { label: 'Canceled',           bg: 'rgba(148,163,184,0.10)', fg: '#94a3b8', border: 'rgba(148,163,184,0.4)' },
}

export default function PprPage() {
  const { installationId, currentInstallation, defaultPdfEmail } = useInstallation()
  const baseTimezone = (currentInstallation as { timezone?: string | null } | null)?.timezone || 'UTC'
  const { has: hasPerm } = usePermissions()

  const canTriage = hasPerm(PERM.PPR_TRIAGE)
  const canApprove = hasPerm(PERM.PPR_APPROVE)
  const canCoordinate = hasPerm(PERM.PPR_COORDINATE)
  const canWrite = hasPerm(PERM.PPR_WRITE)
  const canDelete = hasPerm(PERM.PPR_DELETE)

  const [columns, setColumns] = useState<PprColumn[]>([])
  const [entries, setEntries] = useState<PprEntry[]>([])
  const [agencies, setAgencies] = useState<PprAgency[]>([])
  const [agencyCoordCounts, setAgencyCoordCounts] = useState<Record<string, number>>({})
  const [coordsByEntry, setCoordsByEntry] = useState<Record<string, PprCoordination[]>>({})
  const [pendingTriage, setPendingTriage] = useState(0)
  const [pendingApproval, setPendingApproval] = useState(0)
  const [pendingByAgency, setPendingByAgency] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [userOI, setUserOI] = useState('')

  // Date filter
  const today = new Date().toISOString().slice(0, 10)
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo, setDateTo] = useState(today)
  const [dateMode, setDateMode] = useState<'today' | '7d' | '30d' | 'custom'>('today')

  // Filter chips
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [agencyFilter, setAgencyFilter] = useState<string | null>(null)

  // Search + filter dropdown (mirrors /discrepancies pattern)
  const [searchQuery, setSearchQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Create/Edit modal
  const [showModal, setShowModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState<PprEntry | null>(null)
  const [formDate, setFormDate] = useState(today)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [formNotes, setFormNotes] = useState('')
  const [formApproverOi, setFormApproverOi] = useState('')
  const [formAgencyIds, setFormAgencyIds] = useState<string[]>([])
  // Three mutually-exclusive create-time outcomes:
  //   pending  → status='pending_amops_approval', no in-app coord;
  //              AMOPS coordinates externally and approves later.
  //   preCoord → status='approved' (no coord needed at all).
  //   route    → status='pending_coordination' with selected agencies;
  //              requires ppr:triage so non-triagers can't bypass.
  type CreateMode = 'pending' | 'preCoord' | 'route'
  const [formCreateMode, setFormCreateMode] = useState<CreateMode>('preCoord')

  // Triage modal — three outcomes:
  //   route     → status='pending_coordination' with selected agencies
  //   preCoord  → status='approved' (no coord needed)
  //   deny      → status='denied' with the entered reason
  type TriageMode = 'route' | 'preCoord' | 'deny'
  const [triageEntry, setTriageEntry] = useState<PprEntry | null>(null)
  const [triageMode, setTriageMode] = useState<TriageMode>('route')
  const [triageAgencyIds, setTriageAgencyIds] = useState<string[]>([])
  const [triageDenyReason, setTriageDenyReason] = useState('')
  const [triageBusy, setTriageBusy] = useState(false)

  // Coordinate modal
  const [coordEntry, setCoordEntry] = useState<PprEntry | null>(null)
  const [coordSelections, setCoordSelections] = useState<Record<string, { status: 'concur' | 'non_concur'; comment: string }>>({})
  const [coordBusy, setCoordBusy] = useState(false)

  // Approve / Deny modal
  const [decideEntry, setDecideEntry] = useState<PprEntry | null>(null)
  const [denyReason, setDenyReason] = useState('')
  const [decideBusy, setDecideBusy] = useState(false)

  // Detail card modal — opened by clicking a row, shows full info
  // including dynamic columns, coordination history, and audit fields.
  // All row-level actions (Edit / Delete / Review / Coordinate / Decide)
  // live here; the table list itself is purely a summary.
  const [detailEntry, setDetailEntry] = useState<PprEntry | null>(null)
  const [detailRemarks, setDetailRemarks] = useState<PprRemark[]>([])
  const [remarkInput, setRemarkInput] = useState('')
  const [remarkBusy, setRemarkBusy] = useState(false)

  // PDF export
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailPdfData, setEmailPdfData] = useState<{ doc: jsPDF; filename: string } | null>(null)
  const [sendingEmail, setSendingEmail] = useState(false)

  async function preparePdf() {
    const { generatePprPdf } = await import('@/lib/ppr-pdf')
    // Fetch the remark threads for every PPR in the export window so
    // the PDF carries the same audit trail the staff page shows in
    // the detail card. Run in parallel — these are independent reads.
    const remarksByEntry: Record<string, PprRemark[]> = {}
    if (entries.length > 0) {
      const threads = await Promise.all(entries.map((e) => fetchPprRemarks(e.id)))
      entries.forEach((e, i) => {
        if (threads[i].length > 0) remarksByEntry[e.id] = threads[i]
      })
    }
    return generatePprPdf({
      columns,
      entries,
      dateFrom,
      dateTo,
      baseName: currentInstallation?.name,
      baseIcao: currentInstallation?.icao || undefined,
      timezone: baseTimezone,
      remarksByEntry,
      coordsByEntry,
    })
  }

  async function handleExportPdf() {
    setGeneratingPdf(true)
    try {
      const { doc, filename } = await preparePdf()
      doc.save(filename)
      toast.success('PDF exported')
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate PDF')
    } finally {
      setGeneratingPdf(false)
    }
  }

  async function handleEmailPdf() {
    setGeneratingPdf(true)
    try {
      const result = await preparePdf()
      setEmailPdfData(result)
      setEmailModalOpen(true)
    } catch (err) {
      console.error(err)
      toast.error('Failed to generate PDF')
    } finally {
      setGeneratingPdf(false)
    }
  }

  async function handleSendEmail(email: string) {
    if (!emailPdfData) return
    setSendingEmail(true)
    try {
      await sendPdfViaEmail(emailPdfData.doc, emailPdfData.filename, email, 'PPR Log')
      toast.success(`Emailed to ${email}`)
      setEmailModalOpen(false)
      setEmailPdfData(null)
    } catch (err) {
      console.error(err)
      toast.error('Email failed')
    } finally {
      setSendingEmail(false)
    }
  }

  // Load current user's operating initials
  useEffect(() => {
    async function loadOI() {
      const supabase = createClient()
      if (!supabase) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('operating_initials').eq('id', user.id).single()
      if (data?.operating_initials) setUserOI(data.operating_initials)
    }
    loadOI()
  }, [])

  // The table fetch normally honors the date chip (Today / 7d / 30d /
  // custom). But pending queues — Awaiting Triage, In Coordination,
  // Awaiting Approval, and per-agency filters — should always be
  // visible regardless of arrival_date, since the KPI counts above
  // are base-scoped without a date filter and we don't want a
  // mismatch where the pill says "1 awaiting" but the table is empty
  // because the requested arrival is outside today's range.
  const ignoreDateFilter =
    statusFilter === 'pending_amops_triage'
    || statusFilter === 'pending_coordination'
    || statusFilter === 'pending_amops_approval'
    || agencyFilter !== null
  const effectiveFrom = ignoreDateFilter ? undefined : dateFrom
  const effectiveTo = ignoreDateFilter ? undefined : dateTo

  const loadData = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    const [cols, ags, ents, triageCount, approvalCount, agencyCounts, coordCounts] = await Promise.all([
      fetchPprColumns(installationId),
      fetchPprAgencies(installationId, true),
      fetchPprEntries(installationId, effectiveFrom, effectiveTo),
      fetchPendingTriageCount(installationId),
      fetchPendingApprovalCount(installationId),
      fetchPendingCoordinationCounts(installationId),
      fetchAgencyCoordinatorCounts(installationId),
    ])
    setColumns(cols)
    setAgencies(ags)
    setEntries(ents)
    setPendingTriage(triageCount)
    setPendingApproval(approvalCount)
    setPendingByAgency(agencyCounts)
    setAgencyCoordCounts(coordCounts)

    // Coordination rows for the visible entries.
    if (ents.length > 0) {
      const coords = await fetchPprCoordinationForEntries(ents.map((e) => e.id))
      const grouped: Record<string, PprCoordination[]> = {}
      for (const c of coords) {
        if (!grouped[c.entry_id]) grouped[c.entry_id] = []
        grouped[c.entry_id].push(c)
      }
      setCoordsByEntry(grouped)
    } else {
      setCoordsByEntry({})
    }

    setLoading(false)

    // Nudge the sidebar badge to recount. Every page-level mutation
    // calls loadData() afterward, so this single dispatch covers
    // approve / deny / triage / coordinate / create / edit without
    // depending on the realtime websocket (which has been observed
    // to silently fail on prod).
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('glidepath:badges-refresh'))
    }
  }, [installationId, effectiveFrom, effectiveTo])

  useEffect(() => { loadData() }, [loadData])

  // Realtime: refresh on any ppr_entries / ppr_coordination change for this base.
  useEffect(() => {
    if (!installationId) return
    const supabase = createClient()
    if (!supabase) return

    const channel = supabase
      .channel(`ppr-${installationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ppr_entries', filter: `base_id=eq.${installationId}` }, () => {
        loadData()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ppr_coordination' }, () => {
        // Coordination rows aren't base-scoped at the row level (entry_id only),
        // so we always refresh — cheap, and the table layer drops anything that
        // doesn't belong to this base.
        loadData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [installationId, loadData])

  // Load the remark thread whenever the detail card opens for a new entry.
  // Closing the card resets the input so a half-typed remark on one entry
  // doesn't surface on the next.
  useEffect(() => {
    if (!detailEntry) {
      setDetailRemarks([])
      setRemarkInput('')
      return
    }
    let cancelled = false
    ;(async () => {
      const rows = await fetchPprRemarks(detailEntry.id)
      if (!cancelled) setDetailRemarks(rows)
    })()
    return () => {
      cancelled = true
    }
  }, [detailEntry])

  async function handleAddRemark() {
    if (!detailEntry || !installationId) return
    const text = remarkInput.trim()
    if (!text) return
    setRemarkBusy(true)
    const { ok, error } = await addPprRemark({
      entryId: detailEntry.id,
      baseId: installationId,
      remark: text,
    })
    if (!ok) {
      toast.error(error || 'Failed to save remark')
      setRemarkBusy(false)
      return
    }
    setRemarkInput('')
    const rows = await fetchPprRemarks(detailEntry.id)
    setDetailRemarks(rows)
    setRemarkBusy(false)
  }

  // Date mode changes. PPRs are inherently future-leaning — an aircraft
  // is requesting permission to arrive at some future date — so the
  // 7d / 30d windows look forward from today, not backward. (Backward
  // looking range was the prior behavior and hid approved-but-not-yet-
  // arrived PPRs.) For historical lookups, use the Custom range.
  useEffect(() => {
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    if (dateMode === 'today') {
      setDateFrom(todayStr)
      setDateTo(todayStr)
    } else if (dateMode === '7d') {
      setDateFrom(todayStr)
      setDateTo(new Date(now.getTime() + 6 * 86400000).toISOString().slice(0, 10))
    } else if (dateMode === '30d') {
      setDateFrom(todayStr)
      setDateTo(new Date(now.getTime() + 29 * 86400000).toISOString().slice(0, 10))
    }
  }, [dateMode])

  // Filtered entries
  const filteredEntries = useMemo(() => {
    let rows = entries
    if (statusFilter !== 'all') {
      rows = rows.filter((e) => e.status === statusFilter)
    }
    if (agencyFilter) {
      rows = rows.filter((e) => {
        const coords = coordsByEntry[e.id] ?? []
        return coords.some((c) => c.agency_id === agencyFilter && c.status === 'pending')
      })
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      rows = rows.filter((e) => {
        if (e.ppr_number?.toLowerCase().includes(q)) return true
        if (e.notes?.toLowerCase().includes(q)) return true
        if (e.requester_name?.toLowerCase().includes(q)) return true
        // Match against any column value (covers Callsign / Aircraft Type
        // and any base-defined column the admin chose to surface).
        const vals = e.column_values || {}
        return Object.values(vals).some((v) => String(v ?? '').toLowerCase().includes(q))
      })
    }
    return rows
  }, [entries, statusFilter, agencyFilter, coordsByEntry, searchQuery])

  const dateActive = dateMode !== 'today'
  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (agencyFilter ? 1 : 0) +
    (dateActive ? 1 : 0)
  const hasAnyFilter = activeFilterCount > 0 || searchQuery.trim().length > 0
  const clearAllFilters = () => {
    setStatusFilter('all')
    setAgencyFilter(null)
    setDateMode('today')
    setSearchQuery('')
  }

  // Columns that hold a per-PPR value AND the admin chose to surface
  // on the PPR Log (table + detail card + PDF). info_only is excluded
  // because it has no per-entry value; show_on_log is the explicit gate
  // (replacing the legacy "always show every input column" default).
  const dataColumns = useMemo(
    () => columns.filter((c) => c.show_on_log && c.column_type !== 'info_only'),
    [columns],
  )

  // PPR Log table stays intentionally narrow — only the spine fields
  // (PPR # / Status / Arrival Date) plus the Callsign + Aircraft Type
  // admin columns when those exist AND have show_on_log enabled. The
  // full set of show_on_log columns lives in the detail card.
  const summaryColumns = useMemo(
    () => dataColumns.filter((c) => isSummaryColumn(c.column_name)),
    [dataColumns],
  )

  // Open create modal
  const handleNew = () => {
    setEditingEntry(null)
    setFormDate(today)
    setFormValues({})
    setFormNotes('')
    setFormApproverOi('')
    setFormAgencyIds([])
    // Default mode mirrors the prior checkbox behavior: route to
    // coord when the base has agencies configured AND the user can
    // triage; otherwise pre-coordinate. Save-pending is opt-in so
    // we don't surprise a user expecting the legacy two-button flow.
    setFormCreateMode(agencies.length > 0 && canTriage ? 'route' : 'preCoord')
    setShowModal(true)
  }

  // Open edit modal
  const handleEdit = (entry: PprEntry) => {
    setEditingEntry(entry)
    setFormDate(entry.arrival_date)
    setFormValues(entry.column_values || {})
    setFormNotes(entry.notes || '')
    setFormApproverOi(entry.approver_oi || '')
    setFormAgencyIds([])
    setFormCreateMode('preCoord')
    setShowModal(true)
  }

  // Save (create or update)
  const handleSave = async () => {
    if (!installationId) return

    if (editingEntry) {
      // Only send approver_oi when the user can approve AND the entry
      // is already approved — that's the case where the OI segment of
      // the PPR# may need rewriting. Otherwise leave it untouched.
      const canEditOi = canApprove && editingEntry.status === 'approved'
      const trimmedOi = formApproverOi.trim().toUpperCase()
      const updated = await updatePprEntry(editingEntry.id, {
        arrival_date: formDate,
        column_values: formValues,
        notes: formNotes.trim() || undefined,
        ...(canEditOi && trimmedOi ? { approver_oi: trimmedOi } : {}),
      }, installationId)
      if (updated) {
        toast.success('PPR updated')
        setShowModal(false)
        loadData()
      }
    } else {
      if (!userOI) {
        toast.error('Set your Operating Initials in Settings before creating PPRs')
        return
      }
      if (formCreateMode === 'route' && !canTriage) {
        toast.error('Routing to coordination requires the PPR Review permission')
        return
      }
      if (formCreateMode === 'route' && formAgencyIds.length === 0) {
        toast.error('Pick at least one coordinating agency, or switch to a different save mode')
        return
      }
      const entry = await createPprEntry({
        base_id: installationId,
        arrival_date: formDate,
        column_values: formValues,
        notes: formNotes.trim() || undefined,
        approver_oi: userOI,
        agencyIds: formCreateMode === 'route' ? formAgencyIds : [],
        manualCoordPending: formCreateMode === 'pending',
      })
      if (entry) {
        const msg = formCreateMode === 'pending'
          ? `PPR ${entry.ppr_number} saved — pending manual coordination`
          : formCreateMode === 'preCoord'
            ? `PPR ${entry.ppr_number} created (pre-coordinated)`
            : `PPR ${entry.ppr_number} sent to coordination`
        toast.success(msg)
        setShowModal(false)
        loadData()
      }
    }
  }

  const handleDelete = async (entry: PprEntry) => {
    if (!confirm(`Delete PPR ${entry.ppr_number}?`)) return
    const ok = await deletePprEntry(entry.id, entry.ppr_number, installationId || undefined)
    if (ok) {
      toast.success('PPR deleted')
      loadData()
    }
  }

  // Soft-cancel — keeps the row + audit trail, flips status. Reason
  // captured via window.prompt to keep this lightweight; if cancel
  // becomes a frequent enough action we can lift it into a modal.
  const handleCancel = async (entry: PprEntry) => {
    if (!installationId) return
    const reason = window.prompt(`Cancel PPR ${entry.ppr_number}?\n\nEnter a reason (required):`)
    if (reason === null) return // user dismissed
    const trimmed = reason.trim()
    if (!trimmed) {
      toast.error('A cancellation reason is required')
      return
    }
    const { ok, error } = await cancelPprEntry({
      entryId: entry.id,
      baseId: installationId,
      reason: trimmed,
    })
    if (!ok) {
      toast.error(error || 'Failed to cancel PPR')
      return
    }
    toast.success(`PPR ${entry.ppr_number} canceled`)
    setDetailEntry(null)
    loadData()
  }

  // Triage
  const openTriage = (entry: PprEntry) => {
    setTriageEntry(entry)
    setTriageMode('route')
    setTriageAgencyIds([])
    setTriageDenyReason('')
  }
  const submitTriage = async () => {
    if (!triageEntry || !installationId) return

    if (triageMode === 'deny') {
      const reason = triageDenyReason.trim()
      if (!reason) {
        toast.error('Enter a denial reason')
        return
      }
      setTriageBusy(true)
      const res = await denyPprEntry({
        entryId: triageEntry.id,
        baseId: installationId,
        reason,
      })
      setTriageBusy(false)
      if (res.ok) {
        toast.success('PPR denied')
        setTriageEntry(null)
        loadData()
      } else {
        toast.error(res.error || 'Deny failed')
      }
      return
    }

    if (triageMode === 'route' && triageAgencyIds.length === 0) {
      toast.error('Pick at least one agency, or switch to Pre-coordinated')
      return
    }

    setTriageBusy(true)
    const res = await triagePprEntry({
      entryId: triageEntry.id,
      baseId: installationId,
      agencyIds: triageMode === 'preCoord' ? [] : triageAgencyIds,
      approver_oi: triageMode === 'preCoord' ? userOI : undefined,
    })
    setTriageBusy(false)
    if (res.ok) {
      toast.success(triageMode === 'preCoord' ? 'PPR approved (pre-coordinated)' : 'Routed to coordination')
      setTriageEntry(null)
      loadData()
    } else {
      toast.error(res.error || 'Review failed')
    }
  }

  // Coordinate
  const openCoordinate = (entry: PprEntry) => {
    setCoordEntry(entry)
    setCoordSelections({})
  }
  const submitCoordination = async () => {
    if (!coordEntry || !installationId) return
    const coords = coordsByEntry[coordEntry.id] ?? []
    const pending = coords.filter((c) => c.status === 'pending')
    const acted = pending.filter((c) => coordSelections[c.id])
    if (acted.length === 0) {
      toast.error('Pick concur or non-concur on at least one agency row')
      return
    }
    setCoordBusy(true)
    let allOk = true
    for (const row of acted) {
      const sel = coordSelections[row.id]
      const res = await coordinatePprEntry({
        coordinationId: row.id,
        entryId: coordEntry.id,
        baseId: installationId,
        status: sel.status,
        comment: sel.comment || undefined,
      })
      if (!res.ok) {
        allOk = false
        toast.error(res.error || `Failed on ${row.agency_name}`)
      }
    }
    setCoordBusy(false)
    if (allOk) {
      toast.success('Coordination saved')
      setCoordEntry(null)
      loadData()
    }
  }

  // Approve / Deny
  const openDecide = (entry: PprEntry) => {
    setDecideEntry(entry)
    setDenyReason('')
  }
  const submitApprove = async () => {
    if (!decideEntry || !installationId) return
    setDecideBusy(true)
    const res = await approvePprEntry({
      entryId: decideEntry.id,
      baseId: installationId,
      approver_oi: userOI || undefined,
    })
    setDecideBusy(false)
    if (res.ok) {
      toast.success('PPR approved — requester notified')
      setDecideEntry(null)
      loadData()
    } else {
      toast.error(res.error || 'Approval failed')
    }
  }
  const submitDeny = async () => {
    if (!decideEntry || !installationId) return
    if (!denyReason.trim()) {
      toast.error('Denial reason is required')
      return
    }
    setDecideBusy(true)
    const res = await denyPprEntry({
      entryId: decideEntry.id,
      baseId: installationId,
      reason: denyReason.trim(),
    })
    setDecideBusy(false)
    if (res.ok) {
      toast.success('PPR denied')
      setDecideEntry(null)
      loadData()
    } else {
      toast.error(res.error || 'Deny failed')
    }
  }

  const noColumns = columns.length === 0

  // Per-row affordances. Anyone with the relevant permission gets
  // the button — the back-end RLS still enforces the actual write.
  function rowActions(entry: PprEntry) {
    const coords = coordsByEntry[entry.id] ?? []
    const hasPendingCoord = coords.some((c) => c.status === 'pending')
    const acts: { label: string; color: string; onClick: () => void }[] = []
    if (canTriage && entry.status === 'pending_amops_triage') {
      acts.push({ label: 'Review', color: '#ef4444', onClick: () => openTriage(entry) })
    }
    if (canCoordinate && entry.status === 'pending_coordination' && hasPendingCoord) {
      acts.push({ label: 'Coordinate', color: 'var(--color-accent)', onClick: () => openCoordinate(entry) })
    }
    if (canApprove && entry.status === 'pending_amops_approval') {
      acts.push({ label: 'Decide', color: '#f59e0b', onClick: () => openDecide(entry) })
    }
    if (canWrite) {
      acts.push({ label: 'Edit', color: 'var(--color-accent)', onClick: () => handleEdit(entry) })
    }
    // Cancel is a soft state flip — only meaningful on non-terminal
    // entries. Already-denied or already-canceled rows skip it.
    if (canWrite && entry.status !== 'denied' && entry.status !== 'canceled') {
      acts.push({ label: 'Cancel', color: '#94a3b8', onClick: () => handleCancel(entry) })
    }
    if (canDelete) {
      acts.push({ label: 'Del', color: 'var(--color-danger)', onClick: () => handleDelete(entry) })
    }
    return acts
  }

  return (
    <div className="page-container" style={{ maxWidth: 1200 }}>
      {/* Page header — tertiary tier label + utility/primary action cluster
          + accent underline. Mirrors /discrepancies. */}
      <div data-tour="ppr-header" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 8,
        paddingBottom: 8, marginBottom: 12,
        borderBottom: '1px solid rgba(56,189,248,0.20)',
      }}>
        <div style={{
          fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-3)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          PPR Log
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={handleExportPdf}
            disabled={generatingPdf || filteredEntries.length === 0}
            title={filteredEntries.length === 0 ? 'No entries in the selected range' : 'Export PDF'}
            style={utilityBtnStyle(generatingPdf || filteredEntries.length === 0)}
          >
            <FileText size={14} color="var(--color-accent)" />
            {generatingPdf ? 'Generating…' : 'PDF'}
          </button>
          <button
            onClick={handleEmailPdf}
            disabled={generatingPdf || filteredEntries.length === 0}
            style={utilityBtnStyle(generatingPdf || filteredEntries.length === 0)}
          >
            <Mail size={14} color="var(--color-accent)" />
            Email
          </button>
          {canWrite && (
            <button
              onClick={handleNew}
              disabled={noColumns}
              title={noColumns ? 'Configure PPR columns in Base Setup first' : 'New PPR'}
              data-tour="ppr-primary-action"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                border: '1px solid rgba(56,189,248,0.40)',
                background: noColumns ? 'var(--color-border)' : 'rgba(56,189,248,0.10)',
                color: noColumns ? 'var(--color-text-3)' : 'var(--color-accent)',
                cursor: noColumns ? 'not-allowed' : 'pointer',
                fontSize: 'var(--fs-xs)', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                fontFamily: 'inherit',
              }}
            >
              <Plus size={14} />
              New
            </button>
          )}
        </div>
      </div>

      {/* KPI badges. Only render pills with > 0 pending so the bar
          stays clean when queues are empty. Triage/approval pills
          require ppr:triage / ppr:approve; agency pills are visible
          to anyone with ppr:view (the per-agency filter is just a
          shortcut, not a per-row permission). When everything is
          zero the row collapses entirely. */}
      {(() => {
        const showTriage = canTriage && pendingTriage > 0
        const showApproval = canApprove && pendingApproval > 0
        const visibleAgencies = agencies.filter((a) => (pendingByAgency[a.id] ?? 0) > 0)
        if (!showTriage && !showApproval && visibleAgencies.length === 0) return null
        return (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {showTriage && (
              <KpiPill
                count={pendingTriage}
                label="Awaiting Review"
                icon={<Inbox size={14} />}
                colorBg="rgba(220,38,38,0.12)"
                colorFg="#ef4444"
                colorBorder="rgba(220,38,38,0.4)"
                active={statusFilter === 'pending_amops_triage'}
                onClick={() => {
                  setStatusFilter(statusFilter === 'pending_amops_triage' ? 'all' : 'pending_amops_triage')
                  setAgencyFilter(null)
                }}
              />
            )}
            {showApproval && (
              <KpiPill
                count={pendingApproval}
                label="Awaiting Approval"
                icon={<Clock size={14} />}
                colorBg="rgba(245,158,11,0.12)"
                colorFg="#f59e0b"
                colorBorder="rgba(245,158,11,0.4)"
                active={statusFilter === 'pending_amops_approval'}
                onClick={() => {
                  setStatusFilter(statusFilter === 'pending_amops_approval' ? 'all' : 'pending_amops_approval')
                  setAgencyFilter(null)
                }}
              />
            )}
            {visibleAgencies.map((a) => {
              const n = pendingByAgency[a.id] ?? 0
              const isActive = agencyFilter === a.id
              return (
                <KpiPill
                  key={a.id}
                  count={n}
                  label={a.agency_name}
                  icon={<MailQuestion size={14} />}
                  colorBg="rgba(56,189,248,0.10)"
                  colorFg="var(--color-accent)"
                  colorBorder="rgba(56,189,248,0.4)"
                  active={isActive}
                  onClick={() => {
                    setAgencyFilter(isActive ? null : a.id)
                    setStatusFilter(isActive ? 'all' : 'pending_coordination')
                  }}
                />
              )
            })}
          </div>
        )
      })()}

      {noColumns && (
        <div className="card" style={{ padding: 20, textAlign: 'center', marginBottom: 16 }}>
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)', margin: '0 0 8px' }}>
            No PPR columns configured for this installation.
          </p>
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', margin: 0 }}>
            Go to Settings &rarr; Base Configuration to set up your PPR fields.
          </p>
        </div>
      )}

      {/* Search + Filters cluster. Mirrors /discrepancies — search
          input promoted to top, filters tucked into a dropdown, and
          an active-filter chip strip below for one-click dismissal. */}
      <div data-tour="ppr-filters" style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', position: 'relative' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} color="var(--color-text-3)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search PPR #, callsign, aircraft, notes…"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '8px 10px 8px 30px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)', color: 'var(--color-text-1)',
              fontSize: 'var(--fs-sm)', fontFamily: 'inherit', outline: 'none',
            }}
          />
        </div>
        <button
          onClick={() => setFiltersOpen(o => !o)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 'var(--radius-sm)',
            border: `1px solid ${filtersOpen || activeFilterCount > 0 ? 'var(--color-accent)' : 'var(--color-border)'}`,
            background: filtersOpen ? 'rgba(56,189,248,0.08)' : 'var(--color-bg-surface)',
            color: filtersOpen || activeFilterCount > 0 ? 'var(--color-accent)' : 'var(--color-text-2)',
            cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 'var(--fs-xs)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}
        >
          <SlidersHorizontal size={14} />
          Filters
          {activeFilterCount > 0 && (
            <span style={{
              minWidth: 18, padding: '0 5px', borderRadius: 9, lineHeight: '18px',
              background: 'var(--color-accent)', color: 'var(--color-bg)',
              fontSize: 'var(--fs-2xs)', fontWeight: 800, textAlign: 'center',
            }}>
              {activeFilterCount}
            </span>
          )}
        </button>

        {filtersOpen && (
          <div
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 30,
              minWidth: 320, padding: 12, borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}
          >
            <div>
              <div style={{
                fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-3)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
              }}>
                Status
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(['all', 'pending_amops_triage', 'pending_coordination', 'pending_amops_approval', 'approved', 'denied', 'canceled'] as StatusFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => { setStatusFilter(f); setAgencyFilter(null) }}
                    style={chipStyle(statusFilter === f)}
                  >
                    {f === 'all' ? 'All'
                      : f === 'pending_amops_triage' ? 'Review'
                      : f === 'pending_coordination' ? 'Coordination'
                      : f === 'pending_amops_approval' ? 'Approval'
                      : f === 'approved' ? 'Approved'
                      : f === 'denied' ? 'Denied'
                      : 'Canceled'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{
                fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-3)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
              }}>
                Date Range
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(['today', '7d', '30d', 'custom'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setDateMode(mode)}
                    disabled={ignoreDateFilter}
                    title={ignoreDateFilter ? 'Date range is ignored when viewing pending queues' : undefined}
                    style={{
                      ...chipStyle(dateMode === mode),
                      opacity: ignoreDateFilter ? 0.4 : 1,
                      cursor: ignoreDateFilter ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {mode === 'today' ? 'Today' : mode === '7d' ? 'Next 7d' : mode === '30d' ? 'Next 30d' : 'Custom'}
                  </button>
                ))}
              </div>
              {dateMode === 'custom' && !ignoreDateFilter && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-1)', fontSize: 'var(--fs-xs)' }}
                  />
                  <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-xs)' }}>to</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-1)', fontSize: 'var(--fs-xs)' }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTop: '1px solid var(--color-border)' }}>
              <button
                onClick={clearAllFilters}
                disabled={!hasAnyFilter}
                style={{
                  background: 'none', border: 'none',
                  color: hasAnyFilter ? 'var(--color-accent)' : 'var(--color-text-3)',
                  fontSize: 'var(--fs-xs)', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  cursor: hasAnyFilter ? 'pointer' : 'default', padding: 0,
                }}
              >
                Clear all
              </button>
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                {filteredEntries.length} PPR{filteredEntries.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Active-filter chip strip — only when something is set. */}
      {hasAnyFilter && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, alignItems: 'center' }}>
          {searchQuery.trim() && (
            <ActiveFilterChip label={`"${searchQuery.trim()}"`} onClear={() => setSearchQuery('')} />
          )}
          {statusFilter !== 'all' && (
            <ActiveFilterChip
              label={`Status: ${statusFilter === 'pending_amops_triage' ? 'Review'
                : statusFilter === 'pending_coordination' ? 'Coordination'
                : statusFilter === 'pending_amops_approval' ? 'Approval'
                : statusFilter === 'approved' ? 'Approved'
                : statusFilter === 'denied' ? 'Denied'
                : 'Canceled'}`}
              onClear={() => setStatusFilter('all')}
            />
          )}
          {agencyFilter && (
            <ActiveFilterChip
              label={`Agency: ${agencies.find(a => a.id === agencyFilter)?.agency_name || ''}`}
              onClear={() => setAgencyFilter(null)}
            />
          )}
          {dateActive && (
            <ActiveFilterChip
              label={`Date: ${dateMode === '7d' ? 'Next 7d' : dateMode === '30d' ? 'Next 30d' : 'Custom'}`}
              onClear={() => setDateMode('today')}
            />
          )}
          <button
            onClick={clearAllFilters}
            style={{
              background: 'none', border: 'none', padding: 0,
              color: 'var(--color-accent)', cursor: 'pointer',
              fontSize: 'var(--fs-xs)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* PPR Table */}
      {loading ? (
        <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-elevated)', borderBottom: '2px solid var(--color-border)' }}>
                <th style={thStyle}>PPR #</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Arrival Date</th>
                {summaryColumns.map(col => (
                  <th key={col.id} style={dynamicThStyle}>{col.column_name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={tdStyle}><span className="weather-skeleton" style={{ display: 'inline-block', width: 80, height: 14, borderRadius: 4 }} /></td>
                  <td style={tdStyle}><span className="weather-skeleton" style={{ display: 'inline-block', width: 100, height: 18, borderRadius: 9 }} /></td>
                  <td style={tdStyle}><span className="weather-skeleton" style={{ display: 'inline-block', width: 90, height: 14, borderRadius: 4 }} /></td>
                  {summaryColumns.map(col => (
                    <td key={col.id} style={dynamicTdStyle}><span className="weather-skeleton" style={{ display: 'inline-block', width: 70, height: 14, borderRadius: 4 }} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-2)', fontSize: 'var(--fs-md)', margin: '0 0 12px' }}>
            {hasAnyFilter ? 'No PPRs match the current filters.' : 'No PPRs in the selected range.'}
          </p>
          <div style={{ display: 'inline-flex', gap: 8, justifyContent: 'center' }}>
            {hasAnyFilter && (
              <button
                onClick={clearAllFilters}
                style={{
                  padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-surface)', color: 'var(--color-text-2)',
                  cursor: 'pointer', fontSize: 'var(--fs-xs)', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  fontFamily: 'inherit',
                }}
              >
                Clear all filters
              </button>
            )}
            {canWrite && !noColumns && (
              <button
                onClick={handleNew}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(56,189,248,0.40)',
                  background: 'rgba(56,189,248,0.10)', color: 'var(--color-accent)',
                  cursor: 'pointer', fontSize: 'var(--fs-xs)', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  fontFamily: 'inherit',
                }}
              >
                <Plus size={14} />
                New PPR
              </button>
            )}
          </div>
        </div>
      ) : (
        <div data-tour="ppr-list" style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-elevated)', borderBottom: '2px solid var(--color-border)' }}>
                <th style={thStyle}>PPR #</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Arrival Date</th>
                {summaryColumns.map(col => (
                  <th key={col.id} style={dynamicThStyle}>{col.column_name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map(entry => {
                const meta = STATUS_META[entry.status] ?? STATUS_META.approved
                const coords = coordsByEntry[entry.id] ?? []
                const nonConcur = coords.some((c) => c.status === 'non_concur')
                return (
                  <tr
                    key={entry.id}
                    className="ppr-log-row"
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      // Soft-cancel visual: strike + dim. Detail dialog
                      // still renders without strikethrough.
                      textDecoration: entry.status === 'canceled' ? 'line-through' : undefined,
                      opacity: entry.status === 'canceled' ? 0.55 : 1,
                    }}
                  >
                    <td style={tdStyle}>
                      {/* Only the PPR # is clickable so users can scroll
                          and read the rest of the row without
                          accidentally opening the detail card. */}
                      <button
                        type="button"
                        onClick={() => setDetailEntry(entry)}
                        style={{
                          fontWeight: 700, color: 'var(--color-accent)', fontFamily: 'monospace',
                          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                          textDecoration: 'underline', textUnderlineOffset: 3,
                        }}
                      >
                        {entry.ppr_number}
                      </button>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 12,
                        fontSize: 'var(--fs-xs)', fontWeight: 700,
                        background: meta.bg, color: meta.fg, border: `1px solid ${meta.border}`,
                        textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap',
                      }}>
                        {meta.label}
                      </span>
                      {nonConcur && entry.status !== 'approved' && entry.status !== 'denied' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 6, color: 'var(--color-danger)', fontSize: 'var(--fs-xs)', fontWeight: 700 }} title="At least one agency non-concurred">
                          <AlertTriangle size={12} />
                          NON-CONCUR
                        </span>
                      )}
                    </td>
                    <td style={tdStyle}>{formatZuluDate(entry.arrival_date + 'T00:00:00Z')}</td>
                    {summaryColumns.map(col => {
                      const formatted = formatPprColumnValue(col, (entry.column_values || {})[col.id], { tz: baseTimezone })
                      return (
                        <td key={col.id} style={dynamicTdStyle}>
                          {formatted || '—'}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit modal */}
      {showModal && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div onClick={e => e.stopPropagation()} style={modalCardStyle}>
            <h3 style={{ margin: '0 0 4px', fontSize: 'var(--fs-lg)', color: 'var(--color-text-1)' }}>
              {editingEntry ? `Edit PPR ${editingEntry.ppr_number}` : 'New PPR'}
            </h3>
            {!editingEntry && (
              <p style={{ margin: '0 0 12px', fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                PPR # auto-generated.
              </p>
            )}

            {/* Form fields in a 2-col grid. Arrival Date / Notes /
                Approver OI span both columns; the dynamic
                PprFieldInput cells naturally fill the grid one per
                cell. Modal widened to 720px to give the columns
                breathing room (~330px each after padding). */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              columnGap: 12,
              rowGap: 0,
            }}>
              <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
                Arrival Date *
                <input
                  type="date"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  style={textInputStyle}
                />
              </label>

              {columns.map(col => (
                <PprFieldInput
                  key={col.id}
                  columnId={col.id}
                  columnName={col.column_name}
                  columnType={col.column_type || 'text'}
                  isRequired={col.is_required}
                  value={formValues[col.id] || ''}
                  onChange={(v) => setFormValues(prev => ({ ...prev, [col.id]: v }))}
                  infoText={col.info_text}
                  timeDisplay={col.time_display}
                />
              ))}

              <label style={{ ...labelStyle, marginBottom: 12, gridColumn: '1 / -1' }}>
                Notes
                <textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  rows={2}
                  style={{ ...textInputStyle, resize: 'vertical' as const }}
                />
              </label>

              {editingEntry && canApprove && editingEntry.status === 'approved' && (
                <label style={{ ...labelStyle, marginBottom: 12, gridColumn: '1 / -1' }}>
                  Approver OI
                  <input
                    type="text"
                    value={formApproverOi}
                    onChange={e => setFormApproverOi(e.target.value.toUpperCase().slice(0, 4))}
                    maxLength={4}
                    placeholder={editingEntry.approver_oi || 'XX'}
                    style={textInputStyle}
                  />
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 4, fontWeight: 'normal' }}>
                    Changing this rewrites the OI segment of the PPR# (e.g. {editingEntry.ppr_number}).
                  </span>
                </label>
              )}
            </div>

            {/* Save-mode picker (create only) — three mutually
                exclusive outcomes. Card-based segmented control so
                the selected outcome is visually unambiguous. */}
            {!editingEntry && (
              <div style={{ marginBottom: 12 }}>
                <SegmentedCard<CreateMode>
                  name="create-mode"
                  value={formCreateMode}
                  onChange={setFormCreateMode}
                  options={[
                    ...(agencies.length > 0 ? [{
                      value: 'route' as const,
                      label: canTriage ? 'Send to coordination' : 'Send to coordination (requires PPR Review)',
                      help: 'Pick the agencies that must concur. They get an email with a link back into Glidepath.',
                      icon: <Route size={18} />,
                      disabled: !canTriage,
                    }] : []),
                    {
                      value: 'preCoord' as const,
                      label: 'Pre-coordinated — approve now',
                      help: 'No coordination needed. Approves immediately and mints the PPR number with your OI.',
                      icon: <CheckSquare size={18} />,
                    },
                    {
                      value: 'pending' as const,
                      label: 'Save pending — coordinating manually',
                      help: 'Saves at "Pending Approval" with no in-app coordination. Use when you\'ll coordinate by phone, email, or in person and finalize later via Decide → Approve.',
                      icon: <Bookmark size={18} />,
                    },
                  ]}
                />

                {/* Agency picker only shows when 'route' is selected. */}
                {formCreateMode === 'route' && agencies.length > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 6 }}>
                      Required coordinating agencies:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {agencies.map((a) => {
                        const selected = formAgencyIds.includes(a.id)
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setFormAgencyIds(selected ? formAgencyIds.filter((id) => id !== a.id) : [...formAgencyIds, a.id])}
                            style={chipBtn(selected)}
                          >
                            {a.agency_name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!editingEntry && (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 12, padding: '6px 10px', background: 'var(--color-bg-inset)', borderRadius: 4 }}>
                Approver: <strong style={{ color: 'var(--color-text-1)' }}>{userOI || 'No OI set'}</strong>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={cancelBtnStyle}>Cancel</button>
              <button
                onClick={handleSave}
                disabled={!formDate || (!editingEntry && !userOI)}
                style={primaryBtnStyle(Boolean(formDate))}
              >
                {editingEntry
                  ? 'Save Changes'
                  : formCreateMode === 'pending'
                    ? 'Save Pending'
                    : formCreateMode === 'preCoord'
                      ? 'Approve PPR'
                      : 'Send to Coordination'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Triage modal */}
      {triageEntry && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setTriageEntry(null) }}>
          <div onClick={e => e.stopPropagation()} style={modalCardStyle}>
            <h3 style={{ margin: '0 0 8px', fontSize: 'var(--fs-lg)', color: 'var(--color-text-1)' }}>
              Review PPR {triageEntry.ppr_number}
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
              Public submission from <strong>{triageEntry.requester_name}</strong> ({triageEntry.requester_email}
              {triageEntry.requester_phone ? ` · ${triageEntry.requester_phone}` : ''}).
            </p>

            <SubmittedSummary entry={triageEntry} columns={columns} />

            {/* Action picker — three mutually-exclusive outcomes. */}
            <div style={{ margin: '12px 0' }}>
              <SegmentedCard<TriageMode>
                name="triage-mode"
                value={triageMode}
                onChange={setTriageMode}
                options={[
                  { value: 'route',    label: 'Route to coordination',    help: 'Select coordinating agencies; AMOPS approves after they concur.', icon: <Route size={18} /> },
                  { value: 'preCoord', label: 'Pre-coordinated — approve now', help: 'No agency coordination needed. Approves immediately and emails the requester.', icon: <Check size={18} /> },
                  { value: 'deny',     label: 'Deny request',             help: 'Reject the PPR with a reason. Emails the requester.', icon: <XCircle size={18} /> },
                ]}
              />
            </div>

            {triageMode === 'route' && (() => {
              const orphans = triageAgencyIds.filter((id) => (agencyCoordCounts[id] ?? 0) === 0)
              const orphanNames = orphans
                .map((id) => agencies.find((a) => a.id === id)?.agency_name)
                .filter(Boolean) as string[]
              return (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 6 }}>
                    Required coordinating agencies:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {agencies.length === 0 ? (
                      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
                        No agencies configured. Add them in Base Setup → PPR.
                      </span>
                    ) : agencies.map((a) => {
                      const selected = triageAgencyIds.includes(a.id)
                      const noCoords = (agencyCoordCounts[a.id] ?? 0) === 0
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setTriageAgencyIds(selected ? triageAgencyIds.filter((id) => id !== a.id) : [...triageAgencyIds, a.id])}
                          style={chipBtn(selected)}
                          title={noCoords ? 'No coordinators assigned — email will be skipped for this agency' : undefined}
                        >
                          {a.agency_name}
                          {noCoords && <AlertTriangle size={12} color="var(--color-warning, #f59e0b)" style={{ marginLeft: 6, verticalAlign: '-2px' }} />}
                        </button>
                      )
                    })}
                  </div>
                  {orphanNames.length > 0 && (
                    <div style={{
                      marginTop: 8,
                      padding: '8px 10px',
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid var(--color-warning, #f59e0b)',
                      borderRadius: 4,
                      fontSize: 'var(--fs-xs)',
                      color: 'var(--color-text-1)',
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                    }}>
                      <AlertCircle size={14} color="var(--color-warning, #f59e0b)" style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>
                        <strong>No coordinators</strong> for {orphanNames.join(', ')}. The coordination-request email will be skipped for {orphanNames.length === 1 ? 'this agency' : 'these agencies'}; assign coordinators in Base Setup → PPR Columns or notify them out-of-band.
                      </span>
                    </div>
                  )}
                </div>
              )
            })()}

            {triageMode === 'deny' && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 6 }}>
                  Reason for denial (required):
                </div>
                <textarea
                  value={triageDenyReason}
                  onChange={e => setTriageDenyReason(e.target.value)}
                  rows={3}
                  placeholder="Explain why this PPR is being denied — visible to internal staff in the audit trail."
                  style={{ ...textInputStyle, resize: 'vertical' as const }}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setTriageEntry(null)} style={cancelBtnStyle}>Cancel</button>
              <button
                onClick={submitTriage}
                disabled={triageBusy}
                style={triageMode === 'deny'
                  ? { ...primaryBtnStyle(!triageBusy), background: triageBusy ? 'var(--color-border)' : 'var(--color-danger)' }
                  : primaryBtnStyle(!triageBusy)}
              >
                {triageBusy
                  ? 'Saving…'
                  : triageMode === 'deny'
                    ? 'Deny PPR'
                    : triageMode === 'preCoord'
                      ? 'Approve'
                      : 'Route to Coordination'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coordinate modal */}
      {coordEntry && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setCoordEntry(null) }}>
          <div onClick={e => e.stopPropagation()} style={modalCardStyle}>
            <h3 style={{ margin: '0 0 4px', fontSize: 'var(--fs-lg)', color: 'var(--color-text-1)' }}>
              Coordinate PPR {coordEntry.ppr_number}
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
              Concur or non-concur on each agency row your office covers. Comments are optional.
            </p>

            <SubmittedSummary entry={coordEntry} columns={columns} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '12px 0' }}>
              {(coordsByEntry[coordEntry.id] ?? []).map((row) => {
                const isPending = row.status === 'pending'
                const sel = coordSelections[row.id]
                return (
                  <div key={row.id} style={{ padding: 10, border: '1px solid var(--color-border)', borderRadius: 4, background: isPending ? 'var(--color-bg)' : 'var(--color-bg-inset)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <strong style={{ color: 'var(--color-text-1)' }}>{row.agency_name}</strong>
                      <span style={{
                        fontSize: 'var(--fs-xs)', fontWeight: 700, textTransform: 'uppercase',
                        color: row.status === 'concur' ? '#22c55e' : row.status === 'non_concur' ? '#ef4444' : 'var(--color-text-3)',
                      }}>
                        {row.status === 'pending' ? 'PENDING' : row.status === 'concur' ? 'CONCUR' : 'NON-CONCUR'}
                      </span>
                    </div>
                    {!isPending && (
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                        {row.comment ? `Comment: ${row.comment}` : 'No comment'}
                      </div>
                    )}
                    {isPending && (
                      <>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                          {(['concur', 'non_concur'] as const).map((opt) => {
                            const isSel = sel?.status === opt
                            const tier = opt === 'concur' ? 'var(--color-success)' : 'var(--color-danger)'
                            const tierBg = opt === 'concur' ? 'rgba(34,197,94,0.10)' : 'rgba(220,38,38,0.10)'
                            const Icon = opt === 'concur' ? CheckCircle2 : XCircle
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setCoordSelections((prev) => ({
                                  ...prev,
                                  [row.id]: { status: opt, comment: prev[row.id]?.comment ?? '' },
                                }))}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                  flex: 1, padding: '8px 8px', borderRadius: 8, fontSize: 'var(--fs-sm)', fontWeight: 600,
                                  cursor: 'pointer', fontFamily: 'inherit',
                                  border: isSel ? `2px solid ${tier}` : '1px solid var(--color-border)',
                                  background: isSel ? tierBg : 'var(--color-bg)',
                                  color: isSel ? tier : 'var(--color-text-3)',
                                }}
                              >
                                <Icon size={14} />
                                {opt === 'concur' ? 'Concur' : 'Non-concur'}
                              </button>
                            )
                          })}
                        </div>
                        <textarea
                          placeholder="Comment (optional)"
                          value={sel?.comment ?? ''}
                          onChange={e => setCoordSelections((prev) => ({
                            ...prev,
                            [row.id]: { status: prev[row.id]?.status ?? 'concur', comment: e.target.value },
                          }))}
                          rows={2}
                          style={{ ...textInputStyle, resize: 'vertical' as const }}
                        />
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setCoordEntry(null)} style={cancelBtnStyle}>Close</button>
              <button onClick={submitCoordination} disabled={coordBusy} style={primaryBtnStyle(!coordBusy)}>
                {coordBusy ? 'Saving…' : 'Submit Coordination'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decide (approve / deny) modal */}
      {decideEntry && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setDecideEntry(null) }}>
          <div onClick={e => e.stopPropagation()} style={modalCardStyle}>
            <h3 style={{ margin: '0 0 4px', fontSize: 'var(--fs-lg)', color: 'var(--color-text-1)' }}>
              Decide PPR {decideEntry.ppr_number}
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
              All agency coordination is in. Approve to notify the requester (with PPR #), or deny with a reason.
            </p>

            <SubmittedSummary entry={decideEntry} columns={columns} />

            <div style={{ margin: '12px 0' }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 6, fontWeight: 600 }}>
                Coordination summary:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(coordsByEntry[decideEntry.id] ?? []).map((row) => (
                  <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '4px 8px', background: 'var(--color-bg-inset)', borderRadius: 4 }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-1)' }}>{row.agency_name}</span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: row.status === 'concur' ? '#22c55e' : row.status === 'non_concur' ? '#ef4444' : 'var(--color-text-3)' }}>
                        {row.status === 'concur' ? 'CONCUR' : row.status === 'non_concur' ? 'NON-CONCUR' : 'PENDING'}
                      </span>
                      {row.comment && (
                        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>{row.comment}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <label style={labelStyle}>
              Denial reason (only used if you Deny)
              <textarea
                value={denyReason}
                onChange={e => setDenyReason(e.target.value)}
                rows={2}
                placeholder="Optional unless denying"
                style={{ ...textInputStyle, resize: 'vertical' as const }}
              />
            </label>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDecideEntry(null)} style={cancelBtnStyle}>Cancel</button>
              <button
                onClick={submitDeny}
                disabled={decideBusy}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 16px', borderRadius: 4, border: '1px solid var(--color-danger)',
                  background: 'transparent', color: 'var(--color-danger)',
                  cursor: decideBusy ? 'not-allowed' : 'pointer', fontWeight: 600,
                  fontFamily: 'inherit',
                }}
              >
                <XCircle size={14} />
                Deny
              </button>
              <button
                onClick={submitApprove}
                disabled={decideBusy}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 16px', borderRadius: 4, border: 'none',
                  background: 'var(--color-success)', color: '#fff',
                  cursor: decideBusy ? 'not-allowed' : 'pointer', fontWeight: 700,
                  fontFamily: 'inherit',
                }}
              >
                <CheckCircle2 size={14} />
                {decideBusy ? '…' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail card — opened by clicking a row in the table. Houses
          all dynamic-column data, coordination history, audit info,
          and every action that's currently allowed for this entry.
          Action buttons close this modal and open the relevant
          action modal (Review / Coordinate / Decide / Edit). Delete
          confirms inline. */}
      {detailEntry && (() => {
        const meta = STATUS_META[detailEntry.status] ?? STATUS_META.approved
        const coords = coordsByEntry[detailEntry.id] ?? []
        const acts = rowActions(detailEntry)
        const closeAndRun = (fn: () => void) => () => { setDetailEntry(null); fn() }
        return (
          <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setDetailEntry(null) }}>
            <div onClick={e => e.stopPropagation()} style={{ ...modalCardStyle, width: 600 }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-accent)' }}>
                    PPR {detailEntry.ppr_number}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span style={{
                      display: 'inline-block', padding: '4px 12px', borderRadius: 12,
                      fontSize: 'var(--fs-sm)', fontWeight: 700,
                      background: meta.bg, color: meta.fg, border: `1px solid ${meta.border}`,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      {meta.label}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setDetailEntry(null)}
                  aria-label="Close"
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-3)', cursor: 'pointer', fontSize: 24, lineHeight: 1, padding: 0 }}
                >
                  ×
                </button>
              </div>

              {/* Requester */}
              {detailEntry.requester_name && (
                <DetailSection
                  title="Requester"
                  rows={[
                    { label: 'Name', value: detailEntry.requester_name },
                    { label: 'Email', value: detailEntry.requester_email || '—' },
                    { label: 'Phone', value: detailEntry.requester_phone || '—' },
                  ]}
                  footnote={detailEntry.public_submission ? 'Submitted via public request form.' : undefined}
                />
              )}

              {/* Schedule + form data */}
              <DetailSection
                title="Request Details"
                rows={[
                  { label: 'Arrival Date', value: detailEntry.arrival_date },
                  ...dataColumns
                    .map((c) => ({ label: c.column_name, value: formatPprColumnValue(c, (detailEntry.column_values || {})[c.id], { tz: baseTimezone }) }))
                    .filter((r) => r.value),
                  ...(detailEntry.notes ? [{ label: 'Notes', value: detailEntry.notes }] : []),
                ]}
              />

              {/* Coordination — bordered tiles with semantic per-row left
                  border. Concur green, Non-Concur red, Pending neutral. */}
              {coords.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{
                    fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)',
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    paddingBottom: 6, marginBottom: 8,
                    borderBottom: '1px solid rgba(56,189,248,0.20)',
                  }}>
                    Coordination
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {coords.map((row) => {
                      const isConcur = row.status === 'concur'
                      const isNonConcur = row.status === 'non_concur'
                      const accent = isConcur ? 'var(--color-success)'
                        : isNonConcur ? 'var(--color-danger)'
                        : 'var(--color-text-4)'
                      const StatusIcon = isConcur ? CheckCircle : isNonConcur ? XCircle : Hourglass
                      return (
                        <div
                          key={row.id}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--color-bg-inset)',
                            border: '1px solid var(--color-border)',
                            borderLeft: `2px solid ${accent}`,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 600, color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)' }}>
                              {row.agency_name}
                            </span>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontSize: 'var(--fs-2xs)', fontWeight: 700,
                              textTransform: 'uppercase', letterSpacing: '0.06em',
                              color: accent,
                            }}>
                              <StatusIcon size={12} />
                              {row.status === 'concur' ? 'Concur' : row.status === 'non_concur' ? 'Non-Concur' : 'Pending'}
                            </span>
                          </div>
                          {row.comment && (
                            <div style={{
                              marginTop: 4, fontSize: 'var(--fs-sm)',
                              color: 'var(--color-text-2)', lineHeight: 1.4,
                            }}>
                              {row.comment}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Remarks — free-form thread, any viewer can post. Coord
                  comments are mirrored in here automatically by
                  coordinatePprEntry, so this is a single timeline. */}
              <div style={{ marginBottom: 14 }}>
                <div style={{
                  fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  paddingBottom: 6, marginBottom: 8,
                  borderBottom: '1px solid rgba(56,189,248,0.20)',
                }}>
                  Remarks
                </div>
                {detailRemarks.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                    {detailRemarks.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          border: '1px solid var(--color-border)',
                          borderRadius: 6,
                          overflow: 'hidden',
                          background: 'var(--color-bg-elevated)',
                        }}
                      >
                        {/* Header strip — author + Zulu timestamp visually
                            separated from the remark body by a divider
                            and a subtler background. */}
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                          padding: '6px 10px',
                          background: 'var(--color-bg-inset)',
                          borderBottom: '1px solid var(--color-border)',
                          fontSize: 'var(--fs-xs)',
                        }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-text-2)' }}>
                            {r.user_rank ? `${r.user_rank} ${r.user_name}` : (r.user_name || 'Unknown')}
                          </span>
                          <span style={{ color: 'var(--color-text-3)', fontFamily: 'monospace' }}>
                            {formatZuluDateTime(r.created_at)}
                          </span>
                        </div>
                        {/* Body */}
                        <div style={{
                          padding: '8px 10px',
                          color: 'var(--color-text-1)',
                          fontSize: 'var(--fs-sm)',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          lineHeight: 1.5,
                        }}>
                          {r.remark}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <textarea
                    value={remarkInput}
                    onChange={(e) => setRemarkInput(e.target.value)}
                    placeholder="Add a remark..."
                    rows={2}
                    disabled={remarkBusy}
                    style={{
                      flex: 1, padding: '6px 10px', borderRadius: 4,
                      border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                      color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
                      resize: 'vertical', minHeight: 40,
                    }}
                  />
                  <button
                    onClick={handleAddRemark}
                    disabled={remarkBusy || !remarkInput.trim()}
                    style={{
                      padding: '6px 14px', borderRadius: 4,
                      border: '1px solid var(--color-accent)',
                      background: remarkBusy || !remarkInput.trim() ? 'transparent' : 'var(--color-accent)',
                      color: remarkBusy || !remarkInput.trim() ? 'var(--color-accent)' : 'var(--color-bg)',
                      cursor: remarkBusy || !remarkInput.trim() ? 'not-allowed' : 'pointer',
                      fontWeight: 600, fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
                      alignSelf: 'flex-start',
                    }}
                  >
                    {remarkBusy ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Audit */}
              <DetailSection
                title="Audit"
                rows={[
                  ...(detailEntry.approver_oi ? [{ label: 'Approver OI', value: detailEntry.approver_oi }] : []),
                  ...(detailEntry.triaged_at ? [{ label: 'Reviewed At', value: formatZuluDateTime(detailEntry.triaged_at) }] : []),
                  ...(detailEntry.approval_at ? [{ label: 'Approved At', value: formatZuluDateTime(detailEntry.approval_at) }] : []),
                  ...(detailEntry.denial_reason ? [{ label: 'Denial Reason', value: detailEntry.denial_reason }] : []),
                  ...(detailEntry.cancellation_reason ? [{ label: 'Cancellation Reason', value: detailEntry.cancellation_reason }] : []),
                  ...(detailEntry.created_at ? [{ label: 'Submitted At', value: formatZuluDateTime(detailEntry.created_at) }] : []),
                ]}
              />

              {/* Actions */}
              {acts.length > 0 && (
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                  {acts.map((a, i) => (
                    <button
                      key={i}
                      onClick={closeAndRun(a.onClick)}
                      style={{
                        padding: '6px 14px', borderRadius: 4, border: `1px solid ${a.color}`,
                        background: 'transparent', color: a.color,
                        cursor: 'pointer', fontWeight: 600, fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
                      }}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      <EmailPdfModal
        open={emailModalOpen}
        onClose={() => { setEmailModalOpen(false); setEmailPdfData(null) }}
        onSend={handleSendEmail}
        sending={sendingEmail}
        filename={emailPdfData?.filename || 'ppr-log.pdf'}
        defaultEmail={defaultPdfEmail}
      />
    </div>
  )
}

// ── Subcomponents ──

function KpiPill({
  count,
  label,
  icon,
  colorBg,
  colorFg,
  colorBorder,
  active,
  onClick,
}: {
  count: number
  label: string
  icon: React.ReactNode
  colorBg: string
  colorFg: string
  colorBorder: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', borderRadius: 999,
        background: colorBg,
        border: `${active ? 2 : 1}px solid ${active ? colorFg : colorBorder}`,
        color: colorFg,
        fontFamily: 'inherit', cursor: 'pointer',
      }}
    >
      <span style={{ display: 'inline-flex', color: colorFg }}>{icon}</span>
      <span style={{ fontSize: 'var(--fs-md)', fontWeight: 800, color: colorFg, lineHeight: 1 }}>
        {count}
      </span>
      <span style={{
        fontSize: 'var(--fs-2xs)', fontWeight: 700,
        color: 'var(--color-text-3)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        {label}
      </span>
    </button>
  )
}

// Card-based segmented control. Used by the Create, Triage, and other
// PPR modals so operators have an unambiguous selected state for
// outcome pickers (where the wrong choice = wrong submission).
function SegmentedCard<T extends string>({
  options,
  value,
  onChange,
  name,
}: {
  options: {
    value: T
    label: string
    help?: string
    icon: React.ReactNode
    disabled?: boolean
  }[]
  value: T
  onChange: (next: T) => void
  name: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {options.map((opt) => {
        const selected = value === opt.value
        const disabled = !!opt.disabled
        return (
          <label
            key={opt.value}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '12px 14px', borderRadius: 12,
              border: selected ? '2px solid var(--color-accent)' : '2px solid var(--color-border)',
              background: selected ? 'rgba(56,189,248,0.08)' : 'transparent',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <input
              type="radio"
              name={name}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(opt.value)}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            />
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 18, height: 18, marginTop: 1, flexShrink: 0,
              color: selected ? 'var(--color-accent)' : 'var(--color-text-3)',
            }}>
              {opt.icon}
            </span>
            <span style={{ flex: 1 }}>
              <span style={{
                display: 'block',
                fontSize: 'var(--fs-sm)', fontWeight: 600,
                color: selected ? 'var(--color-text-1)' : 'var(--color-text-2)',
              }}>
                {opt.label}
              </span>
              {opt.help && (
                <span style={{
                  display: 'block', marginTop: 3,
                  fontSize: 'var(--fs-xs)',
                  color: selected ? 'var(--color-text-2)' : 'var(--color-text-3)',
                  lineHeight: 1.45,
                }}>
                  {opt.help}
                </span>
              )}
            </span>
          </label>
        )
      })}
    </div>
  )
}

function ActiveFilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 4px 3px 10px', borderRadius: 999,
      background: 'rgba(56,189,248,0.10)',
      border: '1px solid rgba(56,189,248,0.40)',
      color: 'var(--color-accent)',
      fontSize: 'var(--fs-2xs)', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear ${label}`}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 16, height: 16, borderRadius: 8,
          background: 'transparent', border: 'none', color: 'inherit',
          cursor: 'pointer', padding: 0,
        }}
      >
        <X size={11} />
      </button>
    </span>
  )
}

type DetailRow = { label: string; value: string }

function DetailSection({ title, rows, footnote }: { title: string; rows: DetailRow[]; footnote?: string }) {
  if (rows.length === 0 && !footnote) return null
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        paddingBottom: 6, marginBottom: 8,
        borderBottom: '1px solid rgba(56,189,248,0.20)',
      }}>
        {title}
      </div>
      {rows.length > 0 && (
        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)',
          borderRadius: 4, overflow: 'hidden', border: '1px solid var(--color-border)',
        }}>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.label}-${i}`}
                style={{ background: i % 2 === 0 ? 'var(--color-bg-inset)' : 'transparent' }}
              >
                <td style={{
                  padding: '6px 10px', color: 'var(--color-text-3)',
                  width: 170, verticalAlign: 'top',
                }}>
                  {r.label}
                </td>
                <td style={{
                  padding: '6px 10px', color: 'var(--color-text-1)',
                  wordBreak: 'break-word',
                }}>
                  {r.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {footnote && (
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontStyle: 'italic', marginTop: 6 }}>
          {footnote}
        </div>
      )}
    </div>
  )
}

function SubmittedSummary({ entry, columns }: { entry: PprEntry; columns: PprColumn[] }) {
  return (
    <div style={{ padding: 10, background: 'var(--color-bg-inset)', borderRadius: 4, border: '1px solid var(--color-border)', fontSize: 'var(--fs-xs)', color: 'var(--color-text-1)' }}>
      <div>
        <strong>Arrival:</strong> {entry.arrival_date}
      </div>
      {columns.map((c) => {
        // info_only columns have no per-entry value; skip.
        if (c.column_type === 'info_only') return null
        // SubmittedSummary intentionally renders every input column the
        // requester provided regardless of show_on_log — it's the
        // record of what was submitted, not a Log view. Time columns
        // still respect time_display via the column metadata; we just
        // don't have a tz here so they fall through as Zulu.
        const v = formatPprColumnValue(c, (entry.column_values || {})[c.id])
        if (!v) return null
        return <div key={c.id}><strong>{c.column_name}:</strong> {v}</div>
      })}
      {entry.notes && <div><strong>Notes:</strong> {entry.notes}</div>}
    </div>
  )
}

// ── Style helpers ──

const thStyle: React.CSSProperties = {
  padding: '6px 8px', textAlign: 'center', fontWeight: 700,
  color: 'var(--color-text-3)', fontSize: 'var(--fs-xs)',
  textTransform: 'uppercase', letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
}

// Dynamic / long-label columns (admin-configured + Notes) — wrap the
// header onto multiple lines and cap cell width so an admin-defined
// column like "Point of Contact Name (if different than above)" can't
// blow out the table to 4× the viewport. Long cell values wrap too.
const dynamicThStyle: React.CSSProperties = {
  ...thStyle,
  whiteSpace: 'normal',
  verticalAlign: 'middle',
  maxWidth: 120,
}

const tdStyle: React.CSSProperties = {
  padding: '6px 8px', color: 'var(--color-text-1)',
  whiteSpace: 'nowrap', textAlign: 'center',
}

const dynamicTdStyle: React.CSSProperties = {
  ...tdStyle,
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  verticalAlign: 'middle',
  maxWidth: 160,
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 10,
}

const textInputStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '6px 10px', borderRadius: 4, marginTop: 4,
  border: '1px solid var(--color-border)', background: 'var(--color-bg)',
  color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)',
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '6px 16px', borderRadius: 4, background: 'var(--color-bg)',
  border: '1px solid var(--color-border)', color: 'var(--color-text-3)', cursor: 'pointer',
}

function primaryBtnStyle(enabled: boolean): React.CSSProperties {
  return {
    padding: '6px 16px', borderRadius: 4, border: 'none', cursor: enabled ? 'pointer' : 'not-allowed',
    background: enabled ? 'var(--color-accent)' : 'var(--color-border)',
    color: enabled ? '#fff' : 'var(--color-text-3)',
    fontWeight: 600,
  }
}

function pdfBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 14px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-surface)', color: 'var(--color-text-1)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 'var(--fs-sm)', fontWeight: 600, fontFamily: 'inherit',
    opacity: disabled ? 0.6 : 1,
  }
}

function utilityBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 10px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-surface)', color: 'var(--color-text-2)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 'var(--fs-xs)', fontWeight: 700, fontFamily: 'inherit',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    opacity: disabled ? 0.5 : 1,
  }
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-xs)', fontWeight: 600,
    border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
    background: active ? 'rgba(56,189,248,0.08)' : 'var(--color-bg)',
    color: active ? 'var(--color-accent)' : 'var(--color-text-3)',
    cursor: 'pointer', fontFamily: 'inherit',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  }
}

function chipBtn(selected: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: 16, fontSize: 'var(--fs-sm)', fontWeight: 600,
    border: selected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
    background: selected ? 'rgba(56,189,248,0.10)' : 'var(--color-bg)',
    color: selected ? 'var(--color-accent)' : 'var(--color-text-3)',
    cursor: 'pointer', fontFamily: 'inherit',
  }
}

const modalCardStyle: React.CSSProperties = {
  width: 720, maxWidth: '92vw', maxHeight: '85vh', overflow: 'auto',
  background: 'var(--color-bg-surface)', borderRadius: 8,
  border: '1px solid var(--color-border)', padding: 20,
}
