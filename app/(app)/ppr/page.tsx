'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import { formatZuluDate } from '@/lib/utils'
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
  type PprColumn,
  type PprEntry,
  type PprCoordination,
  type PprStatus,
} from '@/lib/supabase/ppr'
import { fetchPprAgencies, type PprAgency } from '@/lib/supabase/ppr-agencies'
import { sendPdfViaEmail } from '@/lib/email-pdf'
import EmailPdfModal from '@/components/ui/email-pdf-modal'
import { PprFieldInput } from '@/components/ppr/ppr-field-input'
import type jsPDF from 'jspdf'

type StatusFilter = 'all' | 'pending_amops_triage' | 'pending_coordination' | 'pending_amops_approval' | 'approved' | 'denied'

// Color tokens used by the status chip + KPI pills.
const STATUS_META: Record<PprStatus, { label: string; bg: string; fg: string; border: string }> = {
  pending_amops_triage:    { label: 'Awaiting Triage',    bg: 'rgba(220,38,38,0.12)',  fg: '#ef4444', border: 'rgba(220,38,38,0.4)' },
  pending_coordination:    { label: 'In Coordination',    bg: 'rgba(56,189,248,0.10)', fg: 'var(--color-accent)', border: 'rgba(56,189,248,0.4)' },
  pending_amops_approval:  { label: 'Awaiting Approval',  bg: 'rgba(245,158,11,0.12)', fg: '#f59e0b', border: 'rgba(245,158,11,0.4)' },
  approved:                { label: 'Approved',           bg: 'rgba(34,197,94,0.10)',  fg: '#22c55e', border: 'rgba(34,197,94,0.4)' },
  denied:                  { label: 'Denied',             bg: 'rgba(220,38,38,0.10)',  fg: '#ef4444', border: 'rgba(220,38,38,0.4)' },
}

export default function PprPage() {
  const { installationId, currentInstallation, defaultPdfEmail } = useInstallation()
  const { has: hasPerm } = usePermissions()

  const canTriage = hasPerm(PERM.PPR_TRIAGE)
  const canApprove = hasPerm(PERM.PPR_APPROVE)
  const canCoordinate = hasPerm(PERM.PPR_COORDINATE)
  const canWrite = hasPerm(PERM.PPR_WRITE)
  const canDelete = hasPerm(PERM.PPR_DELETE)

  const [columns, setColumns] = useState<PprColumn[]>([])
  const [entries, setEntries] = useState<PprEntry[]>([])
  const [agencies, setAgencies] = useState<PprAgency[]>([])
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

  // Create/Edit modal
  const [showModal, setShowModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState<PprEntry | null>(null)
  const [formDate, setFormDate] = useState(today)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [formNotes, setFormNotes] = useState('')
  const [formAgencyIds, setFormAgencyIds] = useState<string[]>([])
  const [formSkipCoord, setFormSkipCoord] = useState(false)

  // Triage modal
  const [triageEntry, setTriageEntry] = useState<PprEntry | null>(null)
  const [triageAgencyIds, setTriageAgencyIds] = useState<string[]>([])
  const [triageSkip, setTriageSkip] = useState(false)
  const [triageBusy, setTriageBusy] = useState(false)

  // Coordinate modal
  const [coordEntry, setCoordEntry] = useState<PprEntry | null>(null)
  const [coordSelections, setCoordSelections] = useState<Record<string, { status: 'concur' | 'non_concur'; comment: string }>>({})
  const [coordBusy, setCoordBusy] = useState(false)

  // Approve / Deny modal
  const [decideEntry, setDecideEntry] = useState<PprEntry | null>(null)
  const [denyReason, setDenyReason] = useState('')
  const [decideBusy, setDecideBusy] = useState(false)

  // PDF export
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailPdfData, setEmailPdfData] = useState<{ doc: jsPDF; filename: string } | null>(null)
  const [sendingEmail, setSendingEmail] = useState(false)

  async function preparePdf() {
    const { generatePprPdf } = await import('@/lib/ppr-pdf')
    return generatePprPdf({
      columns,
      entries,
      dateFrom,
      dateTo,
      baseName: currentInstallation?.name,
      baseIcao: currentInstallation?.icao || undefined,
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
    const [cols, ags, ents, triageCount, approvalCount, agencyCounts] = await Promise.all([
      fetchPprColumns(installationId),
      fetchPprAgencies(installationId, true),
      fetchPprEntries(installationId, effectiveFrom, effectiveTo),
      fetchPendingTriageCount(installationId),
      fetchPendingApprovalCount(installationId),
      fetchPendingCoordinationCounts(installationId),
    ])
    setColumns(cols)
    setAgencies(ags)
    setEntries(ents)
    setPendingTriage(triageCount)
    setPendingApproval(approvalCount)
    setPendingByAgency(agencyCounts)

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

  // Date mode changes
  useEffect(() => {
    const now = new Date()
    if (dateMode === 'today') {
      const d = now.toISOString().slice(0, 10)
      setDateFrom(d)
      setDateTo(d)
    } else if (dateMode === '7d') {
      const from = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10)
      setDateFrom(from)
      setDateTo(now.toISOString().slice(0, 10))
    } else if (dateMode === '30d') {
      const from = new Date(now.getTime() - 29 * 86400000).toISOString().slice(0, 10)
      setDateFrom(from)
      setDateTo(now.toISOString().slice(0, 10))
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
    return rows
  }, [entries, statusFilter, agencyFilter, coordsByEntry])

  // Open create modal
  const handleNew = () => {
    setEditingEntry(null)
    setFormDate(today)
    setFormValues({})
    setFormNotes('')
    setFormAgencyIds([])
    setFormSkipCoord(agencies.length === 0)
    setShowModal(true)
  }

  // Open edit modal
  const handleEdit = (entry: PprEntry) => {
    setEditingEntry(entry)
    setFormDate(entry.arrival_date)
    setFormValues(entry.column_values || {})
    setFormNotes(entry.notes || '')
    setFormAgencyIds([])
    setFormSkipCoord(false)
    setShowModal(true)
  }

  // Save (create or update)
  const handleSave = async () => {
    if (!installationId) return

    if (editingEntry) {
      const updated = await updatePprEntry(editingEntry.id, {
        arrival_date: formDate,
        column_values: formValues,
        notes: formNotes.trim() || undefined,
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
      const skip = formSkipCoord || formAgencyIds.length === 0
      if (!skip && !canTriage) {
        toast.error('Routing to coordination requires the PPR Triage permission')
        return
      }
      const entry = await createPprEntry({
        base_id: installationId,
        arrival_date: formDate,
        column_values: formValues,
        notes: formNotes.trim() || undefined,
        approver_oi: userOI,
        agencyIds: skip ? [] : formAgencyIds,
      })
      if (entry) {
        toast.success(skip ? `PPR ${entry.ppr_number} created (pre-coordinated)` : `PPR ${entry.ppr_number} sent to coordination`)
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

  // Triage
  const openTriage = (entry: PprEntry) => {
    setTriageEntry(entry)
    setTriageAgencyIds([])
    setTriageSkip(false)
  }
  const submitTriage = async () => {
    if (!triageEntry || !installationId) return
    if (!triageSkip && triageAgencyIds.length === 0) {
      toast.error('Pick at least one agency, or check "Pre-coordinated"')
      return
    }
    setTriageBusy(true)
    const res = await triagePprEntry({
      entryId: triageEntry.id,
      baseId: installationId,
      agencyIds: triageSkip ? [] : triageAgencyIds,
      approver_oi: triageSkip ? userOI : undefined,
    })
    setTriageBusy(false)
    if (res.ok) {
      toast.success(triageSkip ? 'PPR approved (pre-coordinated)' : 'Routed to coordination')
      setTriageEntry(null)
      loadData()
    } else {
      toast.error(res.error || 'Triage failed')
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
      acts.push({ label: 'Triage', color: '#ef4444', onClick: () => openTriage(entry) })
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
    if (canDelete) {
      acts.push({ label: 'Del', color: 'var(--color-danger)', onClick: () => handleDelete(entry) })
    }
    return acts
  }

  return (
    <div className="page-container" style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 'var(--fs-3xl)', fontWeight: 700, color: 'var(--color-text-1)', margin: 0 }}>
          Prior Permission Required
        </h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={handleExportPdf}
            disabled={generatingPdf || filteredEntries.length === 0}
            title={filteredEntries.length === 0 ? 'No entries in the selected range' : 'Export PDF'}
            style={pdfBtnStyle(generatingPdf || filteredEntries.length === 0)}
          >
            {generatingPdf ? 'Generating…' : 'Export PDF'}
          </button>
          <button
            onClick={handleEmailPdf}
            disabled={generatingPdf || filteredEntries.length === 0}
            style={pdfBtnStyle(generatingPdf || filteredEntries.length === 0)}
          >
            Email PDF
          </button>
          {canWrite && (
            <button
              onClick={handleNew}
              disabled={noColumns}
              title={noColumns ? 'Configure PPR columns in Base Setup first' : 'New PPR'}
              style={{
                padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
                background: noColumns ? 'var(--color-border)' : 'linear-gradient(135deg, #0369A1, var(--color-accent-secondary))',
                color: noColumns ? 'var(--color-text-3)' : '#fff',
                cursor: noColumns ? 'not-allowed' : 'pointer', fontSize: 'var(--fs-md)', fontWeight: 700, fontFamily: 'inherit',
              }}
            >
              + New PPR
            </button>
          )}
        </div>
      </div>

      {/* KPI badges. Triage / approval pills surface for any user with the
          ppr:triage / ppr:approve permission (AFM, NAMO, AMOPS, base_admin,
          sys_admin by default). Per-agency pills are visible to every PPR
          user — the badge is the filter, not a per-row permission. */}
      {(canTriage || canApprove || agencies.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {canTriage && pendingTriage > 0 && (
            <KpiPill
              label={`${pendingTriage} AWAITING TRIAGE`}
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
          {canApprove && pendingApproval > 0 && (
            <KpiPill
              label={`${pendingApproval} AWAITING APPROVAL`}
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
          {agencies.map((a) => {
            const n = pendingByAgency[a.id] ?? 0
            const isActive = agencyFilter === a.id
            return (
              <KpiPill
                key={a.id}
                label={`${n} PENDING ${a.agency_name.toUpperCase()}`}
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
      )}

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

      {/* Status filter chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {(['all', 'pending_amops_triage', 'pending_coordination', 'pending_amops_approval', 'approved', 'denied'] as StatusFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => { setStatusFilter(f); setAgencyFilter(null) }}
            style={{
              padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-xs)', fontWeight: 600,
              border: `1px solid ${statusFilter === f ? 'var(--color-accent)' : 'var(--color-border)'}`,
              background: statusFilter === f ? 'rgba(56,189,248,0.08)' : 'var(--color-bg)',
              color: statusFilter === f ? 'var(--color-accent)' : 'var(--color-text-3)',
              cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '0.04em',
            }}
          >
            {f === 'all' ? 'All'
              : f === 'pending_amops_triage' ? 'Triage'
              : f === 'pending_coordination' ? 'Coordination'
              : f === 'pending_amops_approval' ? 'Approval'
              : f === 'approved' ? 'Approved'
              : 'Denied'}
          </button>
        ))}
      </div>

      {/* Date filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['today', '7d', '30d', 'custom'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setDateMode(mode)}
            style={{
              padding: '5px 12px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--fs-sm)', fontWeight: 600,
              border: `1px solid ${dateMode === mode ? 'var(--color-accent)' : 'var(--color-border)'}`,
              background: dateMode === mode ? 'rgba(56,189,248,0.08)' : 'var(--color-bg)',
              color: dateMode === mode ? 'var(--color-accent)' : 'var(--color-text-3)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {mode === 'today' ? 'Today' : mode === '7d' ? '7 Days' : mode === '30d' ? '30 Days' : 'Custom'}
          </button>
        ))}
        {dateMode === 'custom' && (
          <>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)' }}
            />
            <span style={{ color: 'var(--color-text-3)' }}>to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)' }}
            />
          </>
        )}
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginLeft: 4 }}>
          {filteredEntries.length} PPR{filteredEntries.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* PPR Table */}
      {loading ? (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-3)' }}>Loading...</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-md)' }}>No PPRs match these filters.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-inset)', borderBottom: '2px solid var(--color-border)' }}>
                <th style={thStyle}>PPR #</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Requester</th>
                {columns.map(col => (
                  <th key={col.id} style={thStyle}>{col.column_name}</th>
                ))}
                <th style={thStyle}>Notes</th>
                <th style={{ ...thStyle, width: 200 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map(entry => {
                const meta = STATUS_META[entry.status] ?? STATUS_META.approved
                const coords = coordsByEntry[entry.id] ?? []
                const nonConcur = coords.some((c) => c.status === 'non_concur')
                return (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 700, color: 'var(--color-accent)', fontFamily: 'monospace' }}>
                        {entry.ppr_number}
                      </span>
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
                        <span style={{ marginLeft: 6, color: '#ef4444', fontSize: 'var(--fs-xs)', fontWeight: 700 }} title="At least one agency non-concurred">
                          ⚠ NON-CONCUR
                        </span>
                      )}
                    </td>
                    <td style={tdStyle}>{formatZuluDate(entry.arrival_date + 'T00:00:00Z')}</td>
                    <td style={tdStyle}>
                      {entry.requester_name ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontWeight: 600 }}>{entry.requester_name}</span>
                          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{entry.requester_email}</span>
                        </div>
                      ) : '—'}
                    </td>
                    {columns.map(col => (
                      <td key={col.id} style={tdStyle}>
                        {(entry.column_values || {})[col.id] || '—'}
                      </td>
                    ))}
                    <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.notes || '—'}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {rowActions(entry).map((a, i) => (
                          <button
                            key={i}
                            onClick={a.onClick}
                            style={{ background: 'none', border: 'none', color: a.color, cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 600, padding: '2px 4px' }}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </td>
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

            <label style={labelStyle}>
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
              />
            ))}

            <label style={{ ...labelStyle, marginBottom: 12 }}>
              Notes
              <textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                rows={2}
                style={{ ...textInputStyle, resize: 'vertical' as const }}
              />
            </label>

            {/* Coordination picker (create only) */}
            {!editingEntry && agencies.length > 0 && (
              <div style={{ marginBottom: 12, padding: 10, border: '1px solid var(--color-border)', borderRadius: 4, background: 'var(--color-bg-inset)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', fontWeight: 600, marginBottom: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formSkipCoord}
                    onChange={e => setFormSkipCoord(e.target.checked)}
                  />
                  Pre-coordinated — no agencies needed
                </label>
                {!formSkipCoord && (
                  <>
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
                  </>
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
                {editingEntry ? 'Save Changes' : (formSkipCoord || formAgencyIds.length === 0 ? 'Approve PPR' : 'Send to Coordination')}
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
              Triage PPR {triageEntry.ppr_number}
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
              Public submission from <strong>{triageEntry.requester_name}</strong> ({triageEntry.requester_email}).
              Pick the agencies that need to coordinate, or mark pre-coordinated.
            </p>

            <SubmittedSummary entry={triageEntry} columns={columns} />

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', fontWeight: 600, margin: '12px 0 8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={triageSkip}
                onChange={e => setTriageSkip(e.target.checked)}
              />
              Pre-coordinated — no agencies needed (approve immediately)
            </label>

            {!triageSkip && (
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
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setTriageAgencyIds(selected ? triageAgencyIds.filter((id) => id !== a.id) : [...triageAgencyIds, a.id])}
                        style={chipBtn(selected)}
                      >
                        {a.agency_name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setTriageEntry(null)} style={cancelBtnStyle}>Cancel</button>
              <button
                onClick={submitTriage}
                disabled={triageBusy}
                style={primaryBtnStyle(!triageBusy)}
              >
                {triageBusy ? 'Saving…' : (triageSkip ? 'Approve' : 'Route to Coordination')}
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
                          {(['concur', 'non_concur'] as const).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setCoordSelections((prev) => ({
                                ...prev,
                                [row.id]: { status: opt, comment: prev[row.id]?.comment ?? '' },
                              }))}
                              style={{
                                flex: 1, padding: '6px 8px', borderRadius: 4, fontSize: 'var(--fs-sm)', fontWeight: 600,
                                cursor: 'pointer',
                                border: sel?.status === opt
                                  ? `2px solid ${opt === 'concur' ? '#22c55e' : '#ef4444'}`
                                  : '1px solid var(--color-border)',
                                background: sel?.status === opt
                                  ? (opt === 'concur' ? 'rgba(34,197,94,0.10)' : 'rgba(220,38,38,0.10)')
                                  : 'var(--color-bg)',
                                color: sel?.status === opt
                                  ? (opt === 'concur' ? '#22c55e' : '#ef4444')
                                  : 'var(--color-text-3)',
                              }}
                            >
                              {opt === 'concur' ? 'Concur' : 'Non-concur'}
                            </button>
                          ))}
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
                  padding: '6px 16px', borderRadius: 4, border: '1px solid #ef4444',
                  background: 'transparent', color: '#ef4444',
                  cursor: decideBusy ? 'not-allowed' : 'pointer', fontWeight: 600,
                }}
              >
                Deny
              </button>
              <button
                onClick={submitApprove}
                disabled={decideBusy}
                style={{
                  padding: '6px 16px', borderRadius: 4, border: 'none',
                  background: '#22c55e', color: '#fff',
                  cursor: decideBusy ? 'not-allowed' : 'pointer', fontWeight: 700,
                }}
              >
                {decideBusy ? '…' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

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
  label,
  colorBg,
  colorFg,
  colorBorder,
  active,
  onClick,
}: {
  label: string
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
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 999,
        background: colorBg,
        border: `1px solid ${active ? colorFg : colorBorder}`,
        color: colorFg,
        fontSize: 'var(--fs-xs)', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.04em',
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 3, background: colorFg }} />
      {label}
    </button>
  )
}

function SubmittedSummary({ entry, columns }: { entry: PprEntry; columns: PprColumn[] }) {
  return (
    <div style={{ padding: 10, background: 'var(--color-bg-inset)', borderRadius: 4, border: '1px solid var(--color-border)', fontSize: 'var(--fs-xs)', color: 'var(--color-text-1)' }}>
      <div><strong>Arrival:</strong> {entry.arrival_date}</div>
      {columns.map((c) => {
        const v = (entry.column_values || {})[c.id]
        if (!v) return null
        return <div key={c.id}><strong>{c.column_name}:</strong> {v}</div>
      })}
      {entry.notes && <div><strong>Notes:</strong> {entry.notes}</div>}
    </div>
  )
}

// ── Style helpers ──

const thStyle: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', fontWeight: 700,
  color: 'var(--color-text-3)', fontSize: 'var(--fs-xs)',
  textTransform: 'uppercase', letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '8px 10px', color: 'var(--color-text-1)',
  whiteSpace: 'nowrap',
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
  width: 520, maxHeight: '85vh', overflow: 'auto',
  background: 'var(--color-bg-surface)', borderRadius: 8,
  border: '1px solid var(--color-border)', padding: 20,
}
