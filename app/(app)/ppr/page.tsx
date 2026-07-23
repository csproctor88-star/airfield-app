'use client'

import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import { formatZuluDate, formatZuluDateTimeWithLocal } from '@/lib/utils'
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
  reopenPprEntry,
  markPprDeparted,
  clearPprDeparted,
  fetchPprCoordinationForEntries,
  fetchPendingTriageCount,
  fetchPendingApprovalCount,
  fetchPendingCoordinationCounts,
  fetchPprRemarks,
  fetchPprRemarksForEntries,
  addPprRemark,
  updatePprRemark,
  deletePprRemark,
  cancelPprEntry,
  addPprCoordinationAgencies,
  fetchPprEntryById,
  isSummaryColumn,
  isActivePpr,
  formatPprColumnValue,
  type PprColumn,
  type PprEntry,
  type PprCoordination,
  type PprRemark,
  type PprStatus,
} from '@/lib/supabase/ppr'
import { computePprChanges, type PprChange } from '@/lib/ppr-changes'
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
  Route, Check, CheckSquare, Bookmark, Link as LinkIcon,
  List, Calendar as CalendarIcon, ChevronLeft, ChevronRight,
} from 'lucide-react'

type StatusFilter = 'all' | 'pending_amops_triage' | 'pending_coordination' | 'pending_amops_approval' | 'approved' | 'denied' | 'canceled'

// Color tokens used by the status chip + KPI pills.
const STATUS_META: Record<PprStatus, { label: string; bg: string; fg: string; border: string }> = {
  pending_amops_triage:    { label: 'Awaiting Review',    bg: 'rgba(220,38,38,0.12)',  fg: 'var(--color-danger)', border: 'rgba(220,38,38,0.4)' },
  pending_coordination:    { label: 'In Coordination',    bg: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', fg: 'var(--color-accent)', border: 'color-mix(in srgb, var(--color-accent) 40%, transparent)' },
  pending_amops_approval:  { label: 'Awaiting Approval',  bg: 'rgba(245,158,11,0.12)', fg: 'var(--color-amber)', border: 'rgba(245,158,11,0.4)' },
  approved:                { label: 'Approved',           bg: 'rgba(34,197,94,0.10)',  fg: 'var(--color-green)', border: 'rgba(34,197,94,0.4)' },
  denied:                  { label: 'Denied',             bg: 'rgba(220,38,38,0.10)',  fg: 'var(--color-danger)', border: 'rgba(220,38,38,0.4)' },
  canceled:                { label: 'Canceled',           bg: 'rgba(148,163,184,0.10)', fg: '#94a3b8', border: 'rgba(148,163,184,0.4)' },
}

// Local-time YYYY-MM-DD. Used for the calendar's month-boundary fetch
// window and cell keys — NOT toISOString(), which is UTC and can shift
// the day across the date line. arrival_date is a plain DATE, so cells
// and the fetch range must both reason in local calendar days.
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function PprContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
  // 'all' (the default) = today and forward, every status, no upper
  // bound. The other modes stay forward-looking windows.
  const [dateMode, setDateMode] = useState<'all' | 'today' | '7d' | '30d' | 'custom'>('all')

  // View mode — Log (table) vs Calendar (month grid). Calendar shows the
  // displayed month's active + pending PPRs; clicking one opens the same
  // detail card the Log uses.
  const [viewMode, setViewMode] = useState<'log' | 'calendar'>('log')
  // First-of-month anchor for the calendar's displayed month.
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  // Day whose "all PPRs" popover is open (date string), or null.
  const [calDayOpen, setCalDayOpen] = useState<string | null>(null)

  // Filter chips
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [agencyFilter, setAgencyFilter] = useState<string | null>(null)

  // Search + filter dropdown (mirrors /discrepancies pattern)
  const [searchQuery, setSearchQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Create/Edit modal
  const [showModal, setShowModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState<PprEntry | null>(null)
  // "Notify coordinated agencies of this change" dialog (informational, after edit).
  const [updateNotify, setUpdateNotify] = useState<{
    entryId: string
    pprNumber: string
    changes: PprChange[]
    agencies: { agencyId: string; agencyName: string; status: PprCoordination['status'] }[]
    selected: Set<string>
  } | null>(null)
  const [sendingUpdate, setSendingUpdate] = useState(false)
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

  // Re-open (denied → coordination) modal
  const [reopenEntry, setReopenEntry] = useState<PprEntry | null>(null)
  const [reopenAgencyIds, setReopenAgencyIds] = useState<string[]>([])
  const [reopenBusy, setReopenBusy] = useState(false)
  const [decideBusy, setDecideBusy] = useState(false)

  // Detail card modal — opened by clicking a row, shows full info
  // including dynamic columns, coordination history, and audit fields.
  // All row-level actions (Edit / Delete / Review / Coordinate / Decide)
  // live here; the table list itself is purely a summary.
  const [detailEntry, setDetailEntry] = useState<PprEntry | null>(null)
  const [detailRemarks, setDetailRemarks] = useState<PprRemark[]>([])
  const [remarkInput, setRemarkInput] = useState('')
  const [remarkBusy, setRemarkBusy] = useState(false)
  // Current user id — gates the Edit/Delete affordances to the author's
  // own remarks. Set alongside the operating initials fetch.
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  // Inline remark edit: the remark being edited + its draft text.
  const [editingRemarkId, setEditingRemarkId] = useState<string | null>(null)
  const [editingRemarkText, setEditingRemarkText] = useState('')
  // Two-click delete confirm: id of the remark whose delete is armed.
  const [confirmDeleteRemarkId, setConfirmDeleteRemarkId] = useState<string | null>(null)

  // Row selection for exporting a specific PPR or a subset. Holds entry
  // ids; the export paths intersect this with the currently visible
  // (filtered) rows so a stale id from a since-hidden row can't leak in.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // PDF export
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailPdfData, setEmailPdfData] = useState<{ doc: jsPDF; filename: string } | null>(null)
  const [sendingEmail, setSendingEmail] = useState(false)

  async function preparePdf(entriesOverride?: PprEntry[]) {
    const { generatePprPdf } = await import('@/lib/ppr-pdf')
    // Default export honors the active filters (status / agency /
    // search) via `filteredEntries`. When an override is supplied
    // (single-PPR or selection export) those exact rows are used and
    // the subtitle/filename are scoped accordingly.
    const exportEntries = entriesOverride ?? filteredEntries
    // Fetch the remark threads for every exported PPR so the PDF
    // carries the same audit trail the staff page shows in the
    // detail card. Run in parallel — these are independent reads.
    const remarksByEntry: Record<string, PprRemark[]> =
      exportEntries.length > 0
        ? await fetchPprRemarksForEntries(exportEntries.map((e) => e.id))
        : {}

    let subtitle: string | undefined
    let filename: string | undefined
    if (entriesOverride) {
      if (entriesOverride.length === 1) {
        const e = entriesOverride[0]
        subtitle = `PPR ${e.ppr_number}`
        filename = `ppr-${e.ppr_number.replace(/[^a-zA-Z0-9_-]/g, '') || 'entry'}.pdf`
      } else {
        subtitle = `Selected PPRs (${entriesOverride.length})`
        filename = `ppr-selection-${entriesOverride.length}.pdf`
      }
    }

    return generatePprPdf({
      columns,
      entries: exportEntries,
      dateFrom,
      dateTo,
      baseName: currentInstallation?.name,
      baseIcao: currentInstallation?.icao || undefined,
      timezone: baseTimezone,
      remarksByEntry,
      coordsByEntry,
      subtitle,
      filename,
    })
  }

  async function handleExportPdf(entriesOverride?: PprEntry[]) {
    setGeneratingPdf(true)
    try {
      const { doc, filename } = await preparePdf(entriesOverride)
      doc.save(filename)
      toast.success('PDF exported')
    } catch (err) {
      console.error('PPR PDF export failed:', err)
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`PDF failed: ${msg}`)
    } finally {
      setGeneratingPdf(false)
    }
  }

  async function handleEmailPdf(entriesOverride?: PprEntry[]) {
    setGeneratingPdf(true)
    try {
      const result = await preparePdf(entriesOverride)
      setEmailPdfData(result)
      setEmailModalOpen(true)
    } catch (err) {
      console.error('PPR PDF email prep failed:', err)
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`PDF failed: ${msg}`)
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
      setCurrentUserId(user.id)
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

  // Calendar mode fetches exactly the displayed month and takes
  // precedence over both the Log's date chips and the pending-queue
  // override — switching to Calendar always shows that month. In Log
  // mode: 'all' = today→forward (open-ended upper bound); pending
  // queues drop the date window entirely (existing behavior).
  const calFrom = ymd(calMonth)
  const calTo = ymd(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0))
  const effectiveFrom = viewMode === 'calendar'
    ? calFrom
    : ignoreDateFilter ? undefined : dateFrom
  const effectiveTo = viewMode === 'calendar'
    ? calTo
    : (ignoreDateFilter || dateMode === 'all') ? undefined : dateTo

  const loadData = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    const [cols, ags, ents, triageCount, approvalCount, agencyCounts, coordCounts] = await Promise.all([
      fetchPprColumns(installationId),
      // coordinatingOnly: info-only recipient groups are hidden from the
      // per-PPR coordinator picker (they only receive the approval email).
      fetchPprAgencies(installationId, true, true),
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
      setEditingRemarkId(null)
      setEditingRemarkText('')
      setConfirmDeleteRemarkId(null)
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

  // Deep-link: ?detail=<entry-id> → auto-open the full detail dialog.
  // Fires once per param value (tracked via ref). Falls back to a
  // single-entry fetch when the entry is outside the loaded date range.
  const handledDetailParam = useRef<string | null>(null)
  useEffect(() => {
    const paramId = searchParams.get('detail')
    if (!paramId || loading) return
    if (handledDetailParam.current === paramId) return
    handledDetailParam.current = paramId
    let cancelled = false
    ;(async () => {
      let entry = entries.find(e => e.id === paramId) ?? null
      if (!entry) entry = await fetchPprEntryById(paramId)
      if (!cancelled && entry) setDetailEntry(entry)
      if (!cancelled) router.replace('/ppr')
    })()
    return () => { cancelled = true }
  }, [searchParams, entries, loading, router])

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

  // Whether the current user may edit/delete a given remark: their own,
  // and not a system-mirrored entry. Coordination decisions and re-open
  // snapshots are inserted with a "[…]" prefix and are part of the audit
  // timeline, so they stay locked even for their author.
  function canEditRemark(r: PprRemark): boolean {
    if (!currentUserId || r.created_by !== currentUserId) return false
    return !/^\s*\[/.test(r.remark)
  }

  function startEditRemark(r: PprRemark) {
    setConfirmDeleteRemarkId(null)
    setEditingRemarkId(r.id)
    setEditingRemarkText(r.remark)
  }

  function cancelEditRemark() {
    setEditingRemarkId(null)
    setEditingRemarkText('')
  }

  async function handleUpdateRemark() {
    if (!detailEntry || !editingRemarkId) return
    const text = editingRemarkText.trim()
    if (!text) return
    setRemarkBusy(true)
    const { ok, error } = await updatePprRemark({ id: editingRemarkId, remark: text })
    if (!ok) {
      toast.error(error || 'Failed to update remark')
      setRemarkBusy(false)
      return
    }
    setEditingRemarkId(null)
    setEditingRemarkText('')
    const rows = await fetchPprRemarks(detailEntry.id)
    setDetailRemarks(rows)
    setRemarkBusy(false)
  }

  async function handleDeleteRemark(id: string) {
    if (!detailEntry) return
    setRemarkBusy(true)
    const { ok, error } = await deletePprRemark({ id })
    if (!ok) {
      toast.error(error || 'Failed to delete remark')
      setRemarkBusy(false)
      return
    }
    setConfirmDeleteRemarkId(null)
    const rows = await fetchPprRemarks(detailEntry.id)
    setDetailRemarks(rows)
    setRemarkBusy(false)
    toast.success('Remark deleted')
  }

  // Date mode changes. PPRs are inherently future-leaning — an aircraft
  // is requesting permission to arrive at some future date — so the
  // 7d / 30d windows look forward from today, not backward. (Backward
  // looking range was the prior behavior and hid approved-but-not-yet-
  // arrived PPRs.) For historical lookups, use the Custom range.
  useEffect(() => {
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    if (dateMode === 'today' || dateMode === 'all') {
      // 'all' anchors the lower bound at today; effectiveTo is forced
      // undefined elsewhere, so the upper bound stays open.
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

  const dateActive = dateMode !== 'all'
  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (agencyFilter ? 1 : 0) +
    (dateActive ? 1 : 0)
  const hasAnyFilter = activeFilterCount > 0 || searchQuery.trim().length > 0
  const clearAllFilters = () => {
    setStatusFilter('all')
    setAgencyFilter(null)
    setDateMode('all')
    setSearchQuery('')
  }

  // Selected rows, intersected with what's currently visible so a
  // selection made before a filter change can't carry hidden rows into
  // an export.
  const selectedEntries = useMemo(
    () => filteredEntries.filter((e) => selectedIds.has(e.id)),
    [filteredEntries, selectedIds],
  )
  const allVisibleSelected = filteredEntries.length > 0 && filteredEntries.every((e) => selectedIds.has(e.id))
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      if (filteredEntries.every((e) => prev.has(e.id))) {
        const next = new Set(prev)
        filteredEntries.forEach((e) => next.delete(e.id))
        return next
      }
      const next = new Set(prev)
      filteredEntries.forEach((e) => next.add(e.id))
      return next
    })
  }
  const clearSelection = () => setSelectedIds(new Set())

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

  // ── Calendar view derived data ────────────────────────────────────
  // Only active + pending PPRs land on the calendar (isActivePpr already
  // excludes denied + canceled). The shared status/agency/search filters
  // still apply via filteredEntries.
  const calendarEntries = useMemo(
    () => filteredEntries.filter((e) => isActivePpr(e.status)),
    [filteredEntries],
  )
  const calByDate = useMemo(() => {
    const m: Record<string, PprEntry[]> = {}
    for (const e of calendarEntries) {
      (m[e.arrival_date] ??= []).push(e)
    }
    return m
  }, [calendarEntries])
  // Month matrix: leading blanks to the first weekday, one cell per day,
  // trailing blanks to fill the final week row.
  const calCells = useMemo(() => {
    const year = calMonth.getFullYear()
    const month = calMonth.getMonth()
    const firstWeekday = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: Array<{ date: string; day: number } | null> = []
    for (let i = 0; i < firstWeekday; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: ymd(new Date(year, month, d)), day: d })
    }
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [calMonth])
  const monthLabel = useMemo(
    () => calMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    [calMonth],
  )
  const shiftMonth = useCallback((delta: number) => {
    setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  }, [])
  // Chip label: first non-empty summary column (Callsign / Aircraft),
  // else the requester name, else the PPR number.
  const chipLabel = useCallback((e: PprEntry): string => {
    for (const col of summaryColumns) {
      const raw = (e.column_values || {})[col.id]
      if (raw && String(raw).trim()) {
        return formatPprColumnValue(col, raw, { tz: baseTimezone, dateISO: e.arrival_date })
      }
    }
    return e.requester_name || e.ppr_number
  }, [summaryColumns, baseTimezone])
  // Local-day key for the calendar's "today" highlight (cells use local
  // ymd(); the page's `today` is UTC and can disagree in the evening).
  const todayKey = ymd(new Date())

  // Copy the public PPR request URL to clipboard. Prefers the short
  // ICAO-based URL when the base has an ICAO; falls back to the
  // legacy UUID URL otherwise (mirrors generatePublicQr in
  // base-config/setup).
  const publicPprUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const icao = (currentInstallation as { icao?: string | null } | null)?.icao
    if (icao) return `${window.location.origin}/${icao.toLowerCase()}/ppr-request`
    if (installationId) return `${window.location.origin}/ppr-request/${installationId}`
    return ''
  }, [currentInstallation, installationId])
  const handleCopyPublicUrl = async () => {
    if (!publicPprUrl) { toast.error("Base ICAO isn't configured yet."); return }
    try {
      await navigator.clipboard.writeText(publicPprUrl)
      toast.success('Public PPR URL copied')
    } catch {
      toast.error('Could not copy — clipboard unavailable')
    }
  }

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
  const handleSendUpdate = async () => {
    if (!updateNotify) return
    const agencyIds = Array.from(updateNotify.selected)
    if (agencyIds.length === 0) { setUpdateNotify(null); return }
    setSendingUpdate(true)
    try {
      const res = await fetch('/api/send-ppr-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: updateNotify.entryId, agencyIds, changes: updateNotify.changes }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error || 'Failed to send update'); return }
      const sent = data.agencies?.sent ?? 0
      const skipped = data.agencies?.skipped ?? 0
      toast.success(skipped > 0
        ? `Update sent to ${sent} agency(ies); ${skipped} had no coordinators on file`
        : `Update sent to ${sent} agency(ies)`)
      setUpdateNotify(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send update')
    } finally {
      setSendingUpdate(false)
    }
  }

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

      // Sequential: profile data updates first, then any newly-selected
      // coordinating agencies. Keeps the toast order intuitive — the
      // "agencies added" message only appears when agencies were
      // actually added.
      let agencyMessage: string | null = null
      if (updated && formAgencyIds.length > 0) {
        const result = await addPprCoordinationAgencies({
          entryId: editingEntry.id,
          baseId: installationId,
          agencyIds: formAgencyIds,
        })
        if (result.ok && result.addedCount > 0) {
          agencyMessage = result.statusReverted
            ? `Added ${result.addedCount} agency(ies); status reverted to pending coordination`
            : `Added ${result.addedCount} agency(ies) for coordination`
        } else if (!result.ok) {
          toast.error(result.error || 'Failed to add coordinating agencies')
        }
      }

      if (updated) {
        toast.success(agencyMessage || 'PPR updated')
        setShowModal(false)

        // Offer to notify already-coordinated agencies of the change
        // (informational — not a re-coordination). Skipped when new agencies
        // were just added: that path is its own coordination flow.
        if (formAgencyIds.length === 0) {
          const changes = computePprChanges(
            { arrival_date: editingEntry.arrival_date, column_values: editingEntry.column_values || {}, notes: editingEntry.notes },
            { arrival_date: formDate, column_values: formValues, notes: formNotes.trim() || null },
            columns,
            { tz: baseTimezone },
          )
          const agencies = (coordsByEntry[editingEntry.id] || [])
            .filter((c) => c.agency_id)
            .map((c) => ({ agencyId: c.agency_id as string, agencyName: c.agency_name, status: c.status }))
          const coordinated = agencies.filter((a) => a.status === 'concur' || a.status === 'non_concur')
          if (changes.length > 0 && coordinated.length > 0) {
            setUpdateNotify({
              entryId: editingEntry.id,
              pprNumber: editingEntry.ppr_number,
              changes,
              agencies,
              selected: new Set(coordinated.map((a) => a.agencyId)),
            })
          }
        }

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

  // Re-open a denied PPR for coordination. Pre-checks the agencies that
  // were previously on the entry (if any), so the common case is one click.
  const openReopen = (entry: PprEntry) => {
    const prior = (coordsByEntry[entry.id] ?? [])
      .map((c) => c.agency_id)
      .filter((id): id is string => Boolean(id))
    setReopenAgencyIds(prior)
    setReopenEntry(entry)
  }
  const submitReopen = async () => {
    if (!reopenEntry || !installationId) return
    if (reopenAgencyIds.length === 0) {
      toast.error('Select at least one agency to coordinate with')
      return
    }
    setReopenBusy(true)
    const res = await reopenPprEntry({
      entryId: reopenEntry.id,
      baseId: installationId,
      agencyIds: reopenAgencyIds,
    })
    setReopenBusy(false)
    if (res.ok) {
      toast.success(`PPR ${reopenEntry.ppr_number} re-opened for coordination`)
      // The detail card (where Re-open is triggered) shows the now-stale
      // denied state — close it so the user sees the refreshed row.
      if (detailEntry?.id === reopenEntry.id) setDetailEntry(null)
      setReopenEntry(null)
      loadData()
    } else {
      toast.error(res.error || 'Re-open failed')
    }
  }

  // Departed / On-field toggle (Transient Aircraft board membership).
  const handleDeparted = async (entry: PprEntry) => {
    if (!installationId) return
    const res = await markPprDeparted(entry.id, installationId)
    if (res.ok) {
      toast.success(`PPR ${entry.ppr_number} marked departed`)
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('glidepath:write-committed'))
      loadData()
    } else {
      toast.error(res.error || 'Could not mark departed')
    }
  }
  const handleUndepart = async (entry: PprEntry) => {
    if (!installationId) return
    const res = await clearPprDeparted(entry.id, installationId)
    if (res.ok) {
      toast.success(`PPR ${entry.ppr_number} returned to field`)
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('glidepath:write-committed'))
      loadData()
    } else {
      toast.error(res.error || 'Could not update')
    }
  }

  // Resend the coordination request to just the agencies still showing
  // pending — a reminder nudge for a PPR stuck in coordination.
  const handleRemindPending = async (entry: PprEntry) => {
    if (!installationId) return
    const coords = coordsByEntry[entry.id] ?? []
    const pendingAgencyIds = Array.from(new Set(
      coords.filter((c) => c.status === 'pending' && c.agency_id).map((c) => c.agency_id as string),
    ))
    if (pendingAgencyIds.length === 0) {
      toast.info('All agencies have already responded.')
      return
    }
    if (!window.confirm(`Send a coordination reminder to ${pendingAgencyIds.length} pending agenc${pendingAgencyIds.length === 1 ? 'y' : 'ies'} for PPR ${entry.ppr_number}?`)) return
    try {
      const res = await fetch('/api/send-ppr-coordination-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: entry.id, agencyIds: pendingAgencyIds, reminder: true }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        toast.error(body?.error || 'Could not send reminder')
        return
      }
      const sentCount = Array.isArray(body?.sent) ? body.sent.length : 0
      const skippedCount = Array.isArray(body?.skipped) ? body.skipped.length : 0
      if (sentCount === 0) {
        toast.warning('No reminders sent — pending agencies have no coordinators or emails configured.')
      } else {
        toast.success(`Reminder sent to ${sentCount} agenc${sentCount === 1 ? 'y' : 'ies'}${skippedCount ? ` (${skippedCount} skipped — no recipients)` : ''}`)
      }
    } catch {
      toast.error('Could not send reminder')
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
      acts.push({ label: 'Review', color: 'var(--color-danger)', onClick: () => openTriage(entry) })
    }
    if (canCoordinate && entry.status === 'pending_coordination' && hasPendingCoord) {
      acts.push({ label: 'Coordinate', color: 'var(--color-accent)', onClick: () => openCoordinate(entry) })
    }
    // Nudge the agencies still showing pending — only meaningful while a
    // PPR is awaiting coordination and at least one row is unresolved.
    if (canTriage && entry.status === 'pending_coordination' && hasPendingCoord) {
      acts.push({ label: 'Remind', color: 'var(--color-amber)', onClick: () => handleRemindPending(entry) })
    }
    if (canApprove && entry.status === 'pending_amops_approval') {
      acts.push({ label: 'Decide', color: 'var(--color-amber)', onClick: () => openDecide(entry) })
    }
    // A denial isn't always final — let approval authority re-open it
    // back into coordination.
    if (canApprove && entry.status === 'denied') {
      acts.push({ label: 'Re-open', color: 'var(--color-green)', onClick: () => openReopen(entry) })
    }
    // Transient Aircraft board membership — active, not-yet-departed PPRs
    // can be marked departed; departed ones can be returned to the field.
    if (canWrite && isActivePpr(entry.status) && !entry.departed_at) {
      acts.push({ label: 'Departed', color: 'var(--color-text-3)', onClick: () => handleDeparted(entry) })
    }
    if (canWrite && entry.departed_at) {
      acts.push({ label: 'On Field', color: 'var(--color-accent)', onClick: () => handleUndepart(entry) })
    }
    if (canWrite) {
      acts.push({ label: 'Edit', color: 'var(--color-accent)', onClick: () => handleEdit(entry) })
    }
    // Cancel is a soft state flip — only meaningful on non-terminal
    // entries. Already-denied or already-canceled rows skip it.
    if (canWrite && entry.status !== 'denied' && entry.status !== 'canceled') {
      acts.push({ label: 'Cancel', color: 'var(--color-text-4)', onClick: () => handleCancel(entry) })
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
        borderBottom: '1px solid var(--color-border-active)',
      }}>
        <div style={{
          fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-3)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          PPR Log
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={handleCopyPublicUrl}
            disabled={!publicPprUrl}
            title={publicPprUrl ? `Copy public PPR request URL — ${publicPprUrl}` : "Base ICAO isn't configured"}
            style={utilityBtnStyle(!publicPprUrl)}
          >
            <LinkIcon size={14} color="var(--color-accent)" />
            Copy Public URL
          </button>
          <button
            onClick={() => handleExportPdf()}
            disabled={generatingPdf || filteredEntries.length === 0}
            title={filteredEntries.length === 0 ? 'No entries in the selected range' : 'Export all visible PPRs to PDF'}
            style={utilityBtnStyle(generatingPdf || filteredEntries.length === 0)}
          >
            <FileText size={14} color="var(--color-accent)" />
            {generatingPdf ? 'Generating…' : 'PDF'}
          </button>
          <button
            onClick={() => handleEmailPdf()}
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
                border: '1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)',
                background: noColumns ? 'var(--color-border)' : 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
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
          <div data-tour="ppr-kpi-band" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {showTriage && (
              <KpiPill
                count={pendingTriage}
                label="Awaiting Review"
                icon={<Inbox size={14} />}
                colorBg="rgba(220,38,38,0.12)"
                colorFg="var(--color-danger)"
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
                colorFg="var(--color-amber)"
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
                  colorBg="color-mix(in srgb, var(--color-accent) 10%, transparent)"
                  colorFg="var(--color-accent)"
                  colorBorder="color-mix(in srgb, var(--color-accent) 40%, transparent)"
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
        {/* Log | Calendar view toggle. */}
        <div style={{ display: 'inline-flex', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', overflow: 'hidden', flexShrink: 0 }}>
          {(['log', 'calendar'] as const).map(m => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              title={m === 'log' ? 'Log view' : 'Calendar view'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '8px 12px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 'var(--fs-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                background: viewMode === m ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : 'var(--color-bg-surface)',
                color: viewMode === m ? 'var(--color-accent)' : 'var(--color-text-3)',
              }}
            >
              {m === 'log' ? <><List size={14} /> Log</> : <><CalendarIcon size={14} /> Calendar</>}
            </button>
          ))}
        </div>
        <button
          onClick={() => setFiltersOpen(o => !o)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 'var(--radius-sm)',
            border: `1px solid ${filtersOpen || activeFilterCount > 0 ? 'var(--color-accent)' : 'var(--color-border)'}`,
            background: filtersOpen ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'var(--color-bg-surface)',
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
                {(['all', 'today', '7d', '30d', 'custom'] as const).map(mode => {
                  const disabled = ignoreDateFilter || viewMode === 'calendar'
                  return (
                  <button
                    key={mode}
                    onClick={() => setDateMode(mode)}
                    disabled={disabled}
                    title={viewMode === 'calendar' ? 'Calendar shows the selected month'
                      : ignoreDateFilter ? 'Date range is ignored when viewing pending queues' : undefined}
                    style={{
                      ...chipStyle(dateMode === mode),
                      opacity: disabled ? 0.4 : 1,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {mode === 'all' ? 'All' : mode === 'today' ? 'Today' : mode === '7d' ? 'Next 7d' : mode === '30d' ? 'Next 30d' : 'Custom'}
                  </button>
                  )
                })}
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
              label={`Date: ${dateMode === 'today' ? 'Today' : dateMode === '7d' ? 'Next 7d' : dateMode === '30d' ? 'Next 30d' : 'Custom'}`}
              onClear={() => setDateMode('all')}
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

      {/* ── Calendar view ───────────────────────────────────────── */}
      {viewMode === 'calendar' ? (
        <div data-tour="ppr-calendar">
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 10 }}>
            <button
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              style={calNavBtnStyle}
            >
              <ChevronLeft size={18} />
            </button>
            <div style={{ minWidth: 180, textAlign: 'center', fontSize: 'var(--fs-md)', fontWeight: 800, color: 'var(--color-text-1)' }}>
              {monthLabel}
            </div>
            <button
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              style={calNavBtnStyle}
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={() => setCalMonth(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })}
              style={{
                marginLeft: 4, padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
                color: 'var(--color-text-2)', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 'var(--fs-2xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              }}
            >
              Today
            </button>
          </div>

          {/* Weekday header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 0' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, opacity: loading ? 0.5 : 1 }}>
            {calCells.map((cell, i) => {
              if (!cell) return <div key={`b${i}`} style={{ minHeight: 92, borderRadius: 'var(--radius-sm)', background: 'transparent' }} />
              const dayEntries = calByDate[cell.date] ?? []
              const shown = dayEntries.slice(0, 3)
              const overflow = dayEntries.length - shown.length
              const isToday = cell.date === todayKey
              return (
                <div
                  key={cell.date}
                  style={{
                    minHeight: 92, padding: 4, borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${isToday ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    background: 'var(--color-bg-surface)',
                    display: 'flex', flexDirection: 'column', gap: 3,
                  }}
                >
                  <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, color: isToday ? 'var(--color-accent)' : 'var(--color-text-3)', textAlign: 'right', lineHeight: 1 }}>
                    {cell.day}
                  </div>
                  {shown.map(e => {
                    const meta = STATUS_META[e.status] ?? STATUS_META.approved
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setDetailEntry(e)}
                        title={`${e.ppr_number} — ${meta.label}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4, width: '100%',
                          padding: '2px 4px', borderRadius: 4, border: `1px solid ${meta.border}`,
                          background: meta.bg, cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-1)',
                          textAlign: 'left', overflow: 'hidden',
                        }}
                      >
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.fg, flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chipLabel(e)}</span>
                      </button>
                    )
                  })}
                  {overflow > 0 && (
                    <button
                      type="button"
                      onClick={() => setCalDayOpen(cell.date)}
                      style={{
                        background: 'none', border: 'none', padding: '0 4px', cursor: 'pointer',
                        fontFamily: 'inherit', fontSize: 'var(--fs-2xs)', fontWeight: 700,
                        color: 'var(--color-accent)', textAlign: 'left',
                      }}
                    >
                      +{overflow} more
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {!loading && calendarEntries.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', marginTop: 12 }}>
              No active or pending PPRs in {monthLabel}.
            </p>
          )}

          {/* Day popover — full list for a day with overflow. */}
          {calDayOpen && (
            <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setCalDayOpen(null) }}>
              <div onClick={e => e.stopPropagation()} style={{ ...modalCardStyle, maxWidth: 420 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 'var(--fs-md)', color: 'var(--color-text-1)' }}>
                    {formatZuluDate(calDayOpen + 'T00:00:00Z')}
                  </h3>
                  <button onClick={() => setCalDayOpen(null)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)' }}>
                    <X size={18} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(calByDate[calDayOpen] ?? []).map(e => {
                    const meta = STATUS_META[e.status] ?? STATUS_META.approved
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => { setCalDayOpen(null); setDetailEntry(e) }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                          padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
                          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                        }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.fg, flexShrink: 0 }} />
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-accent)', fontSize: 'var(--fs-xs)' }}>{e.ppr_number}</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--fs-xs)', color: 'var(--color-text-1)' }}>{chipLabel(e)}</span>
                        <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, color: meta.fg, textTransform: 'uppercase' }}>{meta.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : loading ? (
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
                  border: '1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)',
                  background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', color: 'var(--color-accent)',
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
        <>
          {/* Selection action bar — appears once any row is checked.
              Exports/emails just the selected PPRs (single or many). */}
          {selectedEntries.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
              padding: '8px 12px', marginBottom: 8,
              borderRadius: 'var(--radius-sm)',
              border: '1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)',
              background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)',
            }}>
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-accent)' }}>
                {selectedEntries.length} selected
              </span>
              <div style={{ flex: 1 }} />
              <button
                onClick={() => handleExportPdf(selectedEntries)}
                disabled={generatingPdf}
                style={utilityBtnStyle(generatingPdf)}
              >
                <FileText size={14} color="var(--color-accent)" />
                {generatingPdf ? 'Generating…' : 'Export PDF'}
              </button>
              <button
                onClick={() => handleEmailPdf(selectedEntries)}
                disabled={generatingPdf}
                style={utilityBtnStyle(generatingPdf)}
              >
                <Mail size={14} color="var(--color-accent)" />
                Email
              </button>
              <button onClick={clearSelection} style={utilityBtnStyle(false)}>
                <X size={14} />
                Clear
              </button>
            </div>
          )}
          <div data-tour="ppr-list" style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-elevated)', borderBottom: '2px solid var(--color-border)' }}>
                <th style={{ ...thStyle, width: 36, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all visible PPRs"
                    style={{ cursor: 'pointer' }}
                  />
                </th>
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
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(entry.id)}
                        onChange={() => toggleSelect(entry.id)}
                        aria-label={`Select PPR ${entry.ppr_number}`}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
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
                      const formatted = formatPprColumnValue(col, (entry.column_values || {})[col.id], { tz: baseTimezone, dateISO: entry.arrival_date })
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
        </>
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
                  timezone={baseTimezone}
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

            {/* Existing coordination + add more agencies (edit mode only).
                Shows current coord row state read-only; lets a user with
                ppr:triage add additional agencies while the PPR is still
                in a coord-eligible status. */}
            {editingEntry && (() => {
              const existingCoords = coordsByEntry[editingEntry.id] || []
              const existingAgencyIds = new Set(existingCoords.map((c) => c.agency_id).filter((id): id is string => Boolean(id)))
              const canAddAgencies = canTriage
                && (editingEntry.status === 'pending_coordination' || editingEntry.status === 'pending_amops_approval')
              const addableAgencies = agencies.filter((a) => !existingAgencyIds.has(a.id))

              if (existingCoords.length === 0 && !canAddAgencies) return null

              return (
                <div style={{ marginBottom: 12, paddingTop: 8, borderTop: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 6 }}>
                    COORDINATION
                  </div>

                  {existingCoords.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: canAddAgencies && addableAgencies.length > 0 ? 12 : 0 }}>
                      {existingCoords.map((c) => {
                        const label = c.status === 'concur' ? 'Concur'
                          : c.status === 'non_concur' ? 'Non-concur'
                          : 'Pending'
                        const color = c.status === 'concur' ? 'var(--color-status-pass)'
                          : c.status === 'non_concur' ? 'var(--color-status-fail)'
                          : 'var(--color-text-3)'
                        return (
                          <div key={c.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)',
                            padding: '4px 0',
                          }}>
                            <span>{c.agency_name}</span>
                            <span style={{ fontWeight: 600, color }}>{label}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {canAddAgencies && addableAgencies.length > 0 && (
                    <div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 6 }}>
                        Add coordinating agencies:
                        {editingEntry.status === 'pending_amops_approval' && (
                          <span style={{ marginLeft: 6, color: 'var(--color-warning)' }}>
                            (will revert this PPR from Pending Approval back to Coordinating)
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {addableAgencies.map((a) => {
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

                  {canAddAgencies && addableAgencies.length === 0 && existingCoords.length > 0 && (
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontStyle: 'italic' }}>
                      All configured agencies are already on this PPR.
                    </div>
                  )}
                </div>
              )
            })()}

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

            <SubmittedSummary entry={triageEntry} columns={columns} tz={baseTimezone} />

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

            <SubmittedSummary entry={coordEntry} columns={columns} tz={baseTimezone} />

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
                        color: row.status === 'concur' ? 'var(--color-green)' : row.status === 'non_concur' ? 'var(--color-danger)' : 'var(--color-text-3)',
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

            <SubmittedSummary entry={decideEntry} columns={columns} tz={baseTimezone} />

            <div style={{ margin: '12px 0' }}>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 6, fontWeight: 600 }}>
                Coordination summary:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(coordsByEntry[decideEntry.id] ?? []).map((row) => (
                  <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '4px 8px', background: 'var(--color-bg-inset)', borderRadius: 4 }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-1)' }}>{row.agency_name}</span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: row.status === 'concur' ? 'var(--color-green)' : row.status === 'non_concur' ? 'var(--color-danger)' : 'var(--color-text-3)' }}>
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

      {/* Re-open modal — denied → coordination. */}
      {reopenEntry && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setReopenEntry(null) }}>
          <div onClick={e => e.stopPropagation()} style={modalCardStyle}>
            <h3 style={{ margin: '0 0 4px', fontSize: 'var(--fs-lg)', color: 'var(--color-text-1)' }}>
              Re-open PPR {reopenEntry.ppr_number}
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
              This denied PPR will return to <strong>In Coordination</strong>. Pick which agencies must (re)coordinate — the prior denial reason and any earlier coordination are preserved in the remarks thread. The requester isn&apos;t emailed until the next decision.
            </p>

            <SubmittedSummary entry={reopenEntry} columns={columns} tz={baseTimezone} />

            {(() => {
              const orphans = reopenAgencyIds.filter((id) => (agencyCoordCounts[id] ?? 0) === 0)
              const orphanNames = orphans
                .map((id) => agencies.find((a) => a.id === id)?.agency_name)
                .filter(Boolean) as string[]
              return (
                <div style={{ margin: '12px 0' }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 6 }}>
                    Coordinating agencies:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {agencies.length === 0 ? (
                      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
                        No agencies configured. Add them in Base Setup → PPR.
                      </span>
                    ) : agencies.map((a) => {
                      const selected = reopenAgencyIds.includes(a.id)
                      const noCoords = (agencyCoordCounts[a.id] ?? 0) === 0
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setReopenAgencyIds(selected ? reopenAgencyIds.filter((id) => id !== a.id) : [...reopenAgencyIds, a.id])}
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
                      marginTop: 8, padding: '8px 10px',
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid var(--color-warning, #f59e0b)',
                      borderRadius: 4, fontSize: 'var(--fs-xs)', color: 'var(--color-text-1)',
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

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setReopenEntry(null)} style={cancelBtnStyle}>Cancel</button>
              <button
                onClick={submitReopen}
                disabled={reopenBusy || reopenAgencyIds.length === 0}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 16px', borderRadius: 4, border: 'none',
                  background: (reopenBusy || reopenAgencyIds.length === 0) ? 'var(--color-border)' : 'var(--color-success)',
                  color: '#fff',
                  cursor: (reopenBusy || reopenAgencyIds.length === 0) ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontFamily: 'inherit',
                }}
              >
                <Route size={14} />
                {reopenBusy ? 'Re-opening…' : 'Re-open for Coordination'}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => handleExportPdf([detailEntry])}
                    disabled={generatingPdf}
                    title="Export this PPR to PDF"
                    style={utilityBtnStyle(generatingPdf)}
                  >
                    <FileText size={14} color="var(--color-accent)" />
                    {generatingPdf ? 'Generating…' : 'PDF'}
                  </button>
                  <button
                    onClick={() => setDetailEntry(null)}
                    aria-label="Close"
                    style={{ background: 'none', border: 'none', color: 'var(--color-text-3)', cursor: 'pointer', fontSize: 24, lineHeight: 1, padding: 0 }}
                  >
                    ×
                  </button>
                </div>
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
                    .map((c) => ({ label: c.column_name, value: formatPprColumnValue(c, (detailEntry.column_values || {})[c.id], { tz: baseTimezone, dateISO: detailEntry.arrival_date }) }))
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
                    borderBottom: '1px solid var(--color-border-active)',
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
                  borderBottom: '1px solid var(--color-border-active)',
                }}>
                  Remarks
                </div>
                {detailRemarks.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                    {detailRemarks.map((r) => {
                      const editable = canEditRemark(r)
                      const isEditing = editingRemarkId === r.id
                      const armed = confirmDeleteRemarkId === r.id
                      return (
                      <div
                        key={r.id}
                        style={{
                          border: '1px solid var(--color-border)',
                          borderRadius: 6,
                          overflow: 'hidden',
                          background: 'var(--color-bg-elevated)',
                        }}
                      >
                        {/* Header strip — author + Zulu(+local) timestamp
                            visually separated from the remark body by a
                            divider and a subtler background. */}
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                          padding: '6px 10px',
                          background: 'var(--color-bg-inset)',
                          borderBottom: '1px solid var(--color-border)',
                          fontSize: 'var(--fs-xs)',
                        }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-text-2)' }}>
                            {r.user_rank ? `${r.user_rank} ${r.user_name}` : (r.user_name || 'Unknown')}
                            {r.updated_at && (
                              <span style={{ fontWeight: 400, fontStyle: 'italic', color: 'var(--color-text-3)', marginLeft: 6 }}>
                                (edited)
                              </span>
                            )}
                          </span>
                          <span style={{ color: 'var(--color-text-3)', fontFamily: 'monospace' }}>
                            {formatZuluDateTimeWithLocal(r.created_at, baseTimezone)}
                          </span>
                        </div>
                        {/* Body — read view, or an inline editor when the
                            author is editing their own remark. */}
                        {isEditing ? (
                          <div style={{ padding: '8px 10px' }}>
                            <textarea
                              value={editingRemarkText}
                              onChange={(e) => setEditingRemarkText(e.target.value)}
                              rows={3}
                              disabled={remarkBusy}
                              autoFocus
                              style={{
                                width: '100%', padding: '6px 10px', borderRadius: 4,
                                border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                                color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
                                resize: 'vertical', minHeight: 56, boxSizing: 'border-box',
                              }}
                            />
                            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                              <button
                                onClick={handleUpdateRemark}
                                disabled={remarkBusy || !editingRemarkText.trim()}
                                style={{
                                  padding: '4px 12px', borderRadius: 4,
                                  border: '1px solid var(--color-accent)',
                                  background: remarkBusy || !editingRemarkText.trim() ? 'transparent' : 'var(--color-accent)',
                                  color: remarkBusy || !editingRemarkText.trim() ? 'var(--color-accent)' : 'var(--color-bg)',
                                  cursor: remarkBusy || !editingRemarkText.trim() ? 'not-allowed' : 'pointer',
                                  fontWeight: 600, fontSize: 'var(--fs-xs)', fontFamily: 'inherit',
                                }}
                              >
                                {remarkBusy ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                onClick={cancelEditRemark}
                                disabled={remarkBusy}
                                style={{
                                  padding: '4px 12px', borderRadius: 4,
                                  border: '1px solid var(--color-border)', background: 'transparent',
                                  color: 'var(--color-text-3)', cursor: 'pointer',
                                  fontWeight: 600, fontSize: 'var(--fs-xs)', fontFamily: 'inherit',
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
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
                            {editable && (
                              <div style={{
                                display: 'flex', gap: 12, alignItems: 'center',
                                padding: '0 10px 8px', fontSize: 'var(--fs-xs)',
                              }}>
                                <button
                                  onClick={() => startEditRemark(r)}
                                  disabled={remarkBusy}
                                  style={remarkActionBtnStyle}
                                >
                                  Edit
                                </button>
                                {armed ? (
                                  <>
                                    <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>Delete?</span>
                                    <button
                                      onClick={() => handleDeleteRemark(r.id)}
                                      disabled={remarkBusy}
                                      style={{ ...remarkActionBtnStyle, color: 'var(--color-danger)', fontWeight: 700 }}
                                    >
                                      Yes
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteRemarkId(null)}
                                      disabled={remarkBusy}
                                      style={remarkActionBtnStyle}
                                    >
                                      No
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => { cancelEditRemark(); setConfirmDeleteRemarkId(r.id) }}
                                    disabled={remarkBusy}
                                    style={{ ...remarkActionBtnStyle, color: 'var(--color-danger)' }}
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      )
                    })}
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
                  ...(detailEntry.triaged_at ? [{ label: 'Reviewed At', value: formatZuluDateTimeWithLocal(detailEntry.triaged_at, baseTimezone) }] : []),
                  ...(detailEntry.approval_at ? [{ label: 'Approved At', value: formatZuluDateTimeWithLocal(detailEntry.approval_at, baseTimezone) }] : []),
                  ...(detailEntry.denial_reason ? [{ label: 'Denial Reason', value: detailEntry.denial_reason }] : []),
                  ...(detailEntry.cancellation_reason ? [{ label: 'Cancellation Reason', value: detailEntry.cancellation_reason }] : []),
                  ...(detailEntry.departed_at ? [{ label: 'Departed At', value: formatZuluDateTimeWithLocal(detailEntry.departed_at, baseTimezone) }] : []),
                  ...(detailEntry.created_at ? [{ label: 'Submitted At', value: formatZuluDateTimeWithLocal(detailEntry.created_at, baseTimezone) }] : []),
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

      {updateNotify && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !sendingUpdate) setUpdateNotify(null) }}>
          <div style={{ ...modalCardStyle, width: 560 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 4 }}>
              Notify Coordinated Agencies
            </div>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 16, lineHeight: 1.5 }}>
              PPR <span style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 700, color: 'var(--color-text-2)' }}>{updateNotify.pprNumber}</span> changed.
              Send the coordinating agencies the latest details — for their awareness, no re-coordination needed.
            </div>

            <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-3)', marginBottom: 6 }}>What changed</div>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '8px 12px', marginBottom: 16, background: 'var(--color-bg-inset)' }}>
              {updateNotify.changes.map((c, i) => (
                <div key={i} style={{ fontSize: 'var(--fs-sm)', padding: '2px 0', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-text-1)' }}>{c.label}:</span>
                  <span style={{ color: 'var(--color-text-3)' }}>{c.from || '(blank)'}</span>
                  <span style={{ color: 'var(--color-text-4)' }}>&rarr;</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-1)' }}>{c.to || '(blank)'}</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-3)', marginBottom: 6 }}>Recipients</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
              {updateNotify.agencies.map((a) => {
                const checked = updateNotify.selected.has(a.agencyId)
                const statusLabel = a.status === 'concur' ? 'Concurred' : a.status === 'non_concur' ? 'Non-concur' : 'Pending'
                return (
                  <label key={a.agencyId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', background: checked ? 'color-mix(in srgb, var(--color-accent) 6%, transparent)' : 'var(--color-bg)' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setUpdateNotify((prev) => {
                        if (!prev) return prev
                        const next = new Set(prev.selected)
                        if (next.has(a.agencyId)) next.delete(a.agencyId); else next.add(a.agencyId)
                        return { ...prev, selected: next }
                      })}
                    />
                    <span style={{ flex: 1, fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-1)' }}>{a.agencyName}</span>
                    <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, color: a.status === 'pending' ? 'var(--color-text-4)' : 'var(--color-text-3)' }}>{statusLabel}</span>
                  </label>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setUpdateNotify(null)} disabled={sendingUpdate} style={cancelBtnStyle}>Skip</button>
              <button onClick={handleSendUpdate} disabled={sendingUpdate || updateNotify.selected.size === 0} style={primaryBtnStyle(!sendingUpdate && updateNotify.selected.size > 0)}>
                {sendingUpdate ? 'Sending…' : `Send Update (${updateNotify.selected.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PprPage() {
  return (
    <Suspense>
      <PprContent />
    </Suspense>
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
              background: selected ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'transparent',
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
      background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
      border: '1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)',
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
        borderBottom: '1px solid var(--color-border-active)',
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

function SubmittedSummary({ entry, columns, tz }: { entry: PprEntry; columns: PprColumn[]; tz?: string }) {
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
        // record of what was submitted, not a Log view. Passing tz +
        // the arrival date pairs time columns as "1500Z (1000L)".
        const v = formatPprColumnValue(c, (entry.column_values || {})[c.id], { tz, dateISO: entry.arrival_date })
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

// Text-link buttons under a remark (Edit / Delete / confirm). Kept
// visually light so the remark body stays the focus.
const remarkActionBtnStyle: React.CSSProperties = {
  padding: 0, border: 'none', background: 'transparent',
  color: 'var(--color-text-3)', cursor: 'pointer',
  fontSize: 'var(--fs-xs)', fontWeight: 600, fontFamily: 'inherit',
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
    background: active ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'var(--color-bg)',
    color: active ? 'var(--color-accent)' : 'var(--color-text-3)',
    cursor: 'pointer', fontFamily: 'inherit',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  }
}

const calNavBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 32, height: 32, borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
  color: 'var(--color-text-2)', cursor: 'pointer',
}

function chipBtn(selected: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: 16, fontSize: 'var(--fs-sm)', fontWeight: 600,
    border: selected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
    background: selected ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'var(--color-bg)',
    color: selected ? 'var(--color-accent)' : 'var(--color-text-3)',
    cursor: 'pointer', fontFamily: 'inherit',
  }
}

const modalCardStyle: React.CSSProperties = {
  width: 720, maxWidth: '92vw', maxHeight: '85vh', overflow: 'auto',
  background: 'var(--color-bg-surface)', borderRadius: 8,
  border: '1px solid var(--color-border)', padding: 20,
}
