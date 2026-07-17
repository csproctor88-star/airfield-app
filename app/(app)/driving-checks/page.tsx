'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Download, Car, Plus, CheckCircle2, Check, Search, X } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import {
  fetchDrivingCheckItems,
  fetchDrivingChecksInRange,
  deleteDrivingCheck,
  deriveOverallResult,
  summarizeDrivingCheck,
  computeAobStats,
  buildDrivingCheckDrafts,
  distinctCheckers,
  filterDrivingChecks,
  fetchDriverLicenses,
  driverLicenseDisplayName,
  FORM_483_LABELS,
  DRIVING_RESULT_LABELS,
  DRIVING_RESULT_COLORS,
  VEHICLE_TYPE_LABELS,
  DRIVING_ITEM_STATUS_LABELS,
  DRIVING_ITEM_STATUS_COLORS,
  type Form483Status,
  type VehicleType,
  type DrivingItemStatus,
  type DrivingCheckResult,
  type DrivingCheckDraft,
  type DrivingCheckItemRow,
  type DrivingCheckWithResults,
  type DriverLicenseRow,
} from '@/lib/supabase/driving-checks'
import { fetchActiveContractors, type ContractorRow } from '@/lib/supabase/contractors'
import { formatZuluTime } from '@/lib/utils'
import { getWriteQueue, WRITE_COMMITTED_EVENT, type WriteCommittedDetail } from '@/lib/sync/write-queue'
import type {
  DrivingCheckSavePayload,
  DrivingCheckSaveResult,
  DrivingCheckUpdatePayload,
  DrivingCheckUpdateResult,
} from '@/lib/sync/handlers'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'

// ── Date helpers (Zulu) ──
function todayZuluDate(): string {
  return new Date().toISOString().slice(0, 10)
}
function daysAgoZuluDate(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
}
// checked_at is a full timestamptz; a YYYY-MM-DD range maps to the whole
// day in Zulu (start-of-day inclusive → end-of-day inclusive).
function rangeToIso(startDate: string, endDate: string): { startIso: string; endIso: string } {
  return { startIso: `${startDate}T00:00:00.000Z`, endIso: `${endDate}T23:59:59.999Z` }
}

// History-row date format. Today / Yesterday / 'Mon, Jul 14'. Same idiom
// as /scn and /fpr. checked_at is a full ISO timestamp.
function formatHistoryDate(ts: string, todayIso: string): { primary: string; secondary: string | null } {
  const iso = ts.slice(0, 10)
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

// Green Valid / amber Expired / red Not in possession + None issued.
function form483Color(status: Form483Status): string {
  if (status === 'valid') return 'var(--color-success)'
  if (status === 'expired') return 'var(--color-warning)'
  return 'var(--color-danger)'
}

const FORM_483_ORDER: Form483Status[] = ['valid', 'expired', 'not_in_possession', 'none']
const VEHICLE_ORDER: VehicleType[] = ['government', 'contractor', 'pov', 'other']

// The modal's editable form state — a superset of the draft rows plus the
// driver / 483 / vehicle / outcome fields.
type ModalState = {
  // null → a new check; else the check id being edited (drives create vs update
  // enqueue). Editing preserves the row's checked_at (we never re-thread it).
  editId: string | null
  driverName: string
  driverRank: string
  driverUnit: string
  driverOfficeSymbol: string
  driverPhone: string
  driver483Number: string
  contractorId: string | null
  form483Status: Form483Status
  form483Expires: string
  vehicleType: VehicleType | null
  vehicleId: string
  povPassNumber: string
  draft: DrivingCheckDraft[]
  location: string
  violationFlag: boolean
  violationDescription: string
  notes: string
  // discrepancyDialog: the required-notes dialog for a Discrepancy row, with
  // the pre-discrepancy status so "Cancel" restores it (mirrors FPR's fixed
  // issue-dialog prior-status restore).
  discrepancyDialog: { idx: number; priorStatus: DrivingItemStatus } | null
  contractorPickerOpen: boolean
  contractorQuery: string
  driverPickerOpen: boolean
  driverQuery: string
}

// Build a DrivingCheckWithResults shape from the live modal draft so the
// summary preview and the saved Events Log line render identically
// (summarizeDrivingCheck reads only these fields).
function draftToCheck(m: ModalState, overallResult: DrivingCheckResult): DrivingCheckWithResults {
  const now = new Date().toISOString()
  return {
    id: '', base_id: '',
    checked_at: now,
    driver_name: m.driverName.trim(),
    driver_rank: m.driverRank.trim() || null,
    driver_unit: m.driverUnit.trim() || null,
    driver_office_symbol: m.driverOfficeSymbol.trim() || null,
    driver_phone: m.driverPhone.trim() || null,
    driver_483_number: m.driver483Number.trim() || null,
    contractor_id: m.contractorId,
    form_483_status: m.form483Status,
    form_483_expires: m.form483Expires || null,
    vehicle_type: m.vehicleType,
    vehicle_id: m.vehicleId.trim() || null,
    pov_pass_number: m.povPassNumber.trim() || null,
    location: m.location.trim(),
    overall_result: overallResult,
    violation_description: m.violationFlag ? m.violationDescription.trim() || null : null,
    notes: m.notes.trim() || null,
    completed_by: null, completed_by_oi: null, completed_by_name: null,
    created_at: now, updated_at: now,
    results: m.draft.map((d, i) => ({
      id: `d${i}`, check_id: '', item_id: d.item_id, item_label: d.item_label,
      status: d.status, notes: d.notes.trim() || null, sort_order: d.sort_order, created_at: now,
    })),
  }
}

function eventsLogLine(m: ModalState, overallResult: DrivingCheckResult): string {
  return `Airfield Driving Spot Check — ${summarizeDrivingCheck(draftToCheck(m, overallResult))}`
}

export default function DrivingChecksPage() {
  const { installationId, currentInstallation, areas } = useInstallation()
  const { has } = usePermissions()
  const [loaded, setLoaded] = useState(false)
  const [items, setItems] = useState<DrivingCheckItemRow[]>([])
  const [rangeChecks, setRangeChecks] = useState<DrivingCheckWithResults[]>([])
  const [operatingInitials, setOperatingInitials] = useState<string | null>(null)
  const [completedByName, setCompletedByName] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [contractors, setContractors] = useState<ContractorRow[]>([])
  const [driverLicenses, setDriverLicenses] = useState<DriverLicenseRow[]>([])

  // History filters
  const [startDate, setStartDate] = useState<string>(() => daysAgoZuluDate(30))
  const [endDate, setEndDate] = useState<string>(() => todayZuluDate())
  const [resultFilter, setResultFilter] = useState<DrivingCheckResult | 'all'>('all')
  const [checkerFilter, setCheckerFilter] = useState<string>('all')

  // PDF export card (own range; defaults to the last 30 days)
  const [exportStart, setExportStart] = useState<string>(() => daysAgoZuluDate(30))
  const [exportEnd, setExportEnd] = useState<string>(() => todayZuluDate())

  const [modal, setModal] = useState<ModalState | null>(null)
  const [saving, setSaving] = useState(false)

  const canWrite = has(PERM.DRIVING_CHECKS_WRITE)

  const load = useCallback(async () => {
    if (!installationId) return
    const { startIso, endIso } = rangeToIso(startDate, endDate)
    const [its, rows] = await Promise.all([
      fetchDrivingCheckItems(installationId, true),
      fetchDrivingChecksInRange(installationId, startIso, endIso),
    ])
    setItems(its)
    setRangeChecks(rows)
    setLoaded(true)
  }, [installationId, startDate, endDate])

  useEffect(() => { load() }, [load])

  // Signed-in user's id (queue ownership) + attribution (initials + name snapshot).
  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      supabase
        .from('profiles')
        .select('operating_initials, name')
        .eq('id', data.user.id)
        .single()
        .then(({ data: profile }) => {
          const p = profile as { operating_initials?: string; name?: string } | null
          if (p?.operating_initials) setOperatingInitials(p.operating_initials)
          if (p?.name) setCompletedByName(p.name)
        })
    })
  }, [])

  // Active contractors for the lookup (hidden entirely on empty/failed fetch).
  useEffect(() => {
    if (!installationId) return
    fetchActiveContractors(installationId).then(setContractors).catch(() => setContractors([]))
  }, [installationId])

  // Imported Airfield Licenses roster for the driver lookup (empty → lookup hidden).
  useEffect(() => {
    if (!installationId) return
    fetchDriverLicenses(installationId).then(setDriverLicenses).catch(() => setDriverLicenses([]))
  }, [installationId])

  // Re-fetch when a queued driving_check_save / _update drains offline.
  useEffect(() => {
    const onCommit = (e: Event) => {
      const detail = (e as CustomEvent<WriteCommittedDetail>).detail
      if (detail?.type === 'driving_check_save' || detail?.type === 'driving_check_update') load()
    }
    window.addEventListener(WRITE_COMMITTED_EVENT, onCommit)
    return () => window.removeEventListener(WRITE_COMMITTED_EVENT, onCommit)
  }, [load])

  // Checker dropdown always lists every checker in the fetched range (not the
  // narrowed set — otherwise selecting one would drop the rest from the list).
  const checkerOptions = useMemo(() => distinctCheckers(rangeChecks), [rangeChecks])
  // filteredChecks = the fetched range narrowed by result + checker, newest-first.
  // Both the stat strip and the visible list read from it, so the strip reflects
  // exactly what's shown; the PDF export computes its own range through the same
  // computeAobStats function (single source of truth).
  const filteredChecks = useMemo(
    () => filterDrivingChecks(rangeChecks, { result: resultFilter, checker: checkerFilter })
      .slice()
      .sort((a, b) => b.checked_at.localeCompare(a.checked_at)),
    [rangeChecks, resultFilter, checkerFilter],
  )
  const stats = useMemo(() => computeAobStats(filteredChecks), [filteredChecks])

  const hasContractors = contractors.length > 0
  const hasLicenses = driverLicenses.length > 0

  function openModal(edit?: DrivingCheckWithResults) {
    const draft = buildDrivingCheckDrafts(items, edit?.results ?? null)
    setModal({
      editId: edit?.id ?? null,
      driverName: edit?.driver_name ?? '',
      driverRank: edit?.driver_rank ?? '',
      driverUnit: edit?.driver_unit ?? '',
      driverOfficeSymbol: edit?.driver_office_symbol ?? '',
      driverPhone: edit?.driver_phone ?? '',
      driver483Number: edit?.driver_483_number ?? '',
      contractorId: edit?.contractor_id ?? null,
      form483Status: edit?.form_483_status ?? 'valid',
      form483Expires: edit?.form_483_expires ?? '',
      vehicleType: edit?.vehicle_type ?? null,
      vehicleId: edit?.vehicle_id ?? '',
      povPassNumber: edit?.pov_pass_number ?? '',
      draft,
      location: edit?.location ?? '',
      violationFlag: !!edit?.violation_description,
      violationDescription: edit?.violation_description ?? '',
      notes: edit?.notes ?? '',
      discrepancyDialog: null,
      contractorPickerOpen: false,
      contractorQuery: '',
      driverPickerOpen: false,
      driverQuery: '',
    })
  }

  function setItemStatus(idx: number, status: DrivingItemStatus) {
    setModal(m => {
      if (!m) return m
      const prior = m.draft[idx].status
      const next = [...m.draft]
      next[idx] = { ...next[idx], status }
      // Selecting Discrepancy with no notes yet → open the required-notes
      // dialog, remembering the pre-discrepancy status so "Cancel" restores it.
      if (status === 'discrepancy' && !next[idx].notes) {
        return { ...m, draft: next, discrepancyDialog: { idx, priorStatus: prior === 'discrepancy' ? 'pass' : prior } }
      }
      return { ...m, draft: next }
    })
  }

  function setItemNotes(idx: number, notes: string) {
    setModal(m => {
      if (!m) return m
      const next = [...m.draft]
      next[idx] = { ...next[idx], notes }
      return { ...m, draft: next }
    })
  }

  function applyContractor(c: ContractorRow) {
    setModal(m => {
      if (!m) return m
      const exp = c.af_form_483_expiration || ''
      // Prefill the observed 483 status from the credential on file (edge case:
      // an expired card pre-selects Expired; the checker confirms from the card).
      const form483Status: Form483Status = exp ? (exp < todayZuluDate() ? 'expired' : 'valid') : m.form483Status
      return {
        ...m,
        driverName: c.contact_name || m.driverName,
        driverUnit: c.company_name || m.driverUnit,
        contractorId: c.id,
        form483Expires: exp || m.form483Expires,
        form483Status,
        vehicleType: m.vehicleType ?? 'contractor',
        contractorPickerOpen: false,
        contractorQuery: '',
      }
    })
  }

  function applyDriverLicense(l: DriverLicenseRow) {
    setModal(m => {
      if (!m) return m
      return {
        ...m,
        driverName: driverLicenseDisplayName(l) || m.driverName,
        driverRank: l.grade_rank || m.driverRank,
        driverUnit: l.unit || m.driverUnit,
        driverOfficeSymbol: l.office || m.driverOfficeSymbol,
        driver483Number: l.af_483_number || m.driver483Number,
        driverPickerOpen: false,
        driverQuery: '',
      }
    })
  }

  async function handleSaveModal() {
    if (!modal || !installationId) return
    if (!modal.driverName.trim()) { toast.error('Driver name is required.'); return }
    if (modal.violationFlag && !modal.violationDescription.trim()) {
      toast.error('Describe the airfield driving violation before saving.'); return
    }
    const missing = modal.draft.find(d => d.status === 'discrepancy' && !d.notes.trim())
    if (missing) {
      toast.error(`"${missing.item_label}" is a Discrepancy — add notes before saving.`); return
    }

    const overallResult = deriveOverallResult(modal.form483Status, modal.draft, modal.violationFlag)
    const items_ = modal.draft.map(d => ({
      item_id: d.item_id,
      item_label: d.item_label,
      status: d.status,
      notes: d.notes.trim() || null,
      sort_order: d.sort_order,
    }))
    setSaving(true)

    try {
      if (modal.editId) {
        // Edit: driving_check_update — no attribution, no re-log, checked_at
        // preserved (checkedAt omitted → buildDrivingCheckFields keeps the original).
        const payload: DrivingCheckUpdatePayload = {
          id: modal.editId,
          driverName: modal.driverName,
          driverRank: modal.driverRank,
          driverUnit: modal.driverUnit,
          driverOfficeSymbol: modal.driverOfficeSymbol,
          driverPhone: modal.driverPhone,
          driver483Number: modal.driver483Number,
          contractorId: modal.contractorId,
          form483Status: modal.form483Status,
          form483Expires: modal.form483Expires || null,
          vehicleType: modal.vehicleType,
          vehicleId: modal.vehicleId,
          povPassNumber: modal.povPassNumber,
          location: modal.location,
          overallResult,
          violationDescription: modal.violationFlag ? modal.violationDescription : null,
          notes: modal.notes,
          items: items_,
        }
        const result = await getWriteQueue().enqueueOrExecute<DrivingCheckUpdatePayload, DrivingCheckUpdateResult>(
          'driving_check_update', payload, { baseId: installationId, userId: userId || '' },
        )
        if (result.status === 'committed') {
          setSaving(false)
          if (!result.data) { toast.error('Failed to save check'); return }
          toast.success('Spot check updated')
          setModal(null)
          load()
        } else {
          setSaving(false)
          setModal(null)
          toast.success('Edit queued — will save automatically when the network returns.', { duration: 8000 })
        }
      } else {
        // New check: driving_check_save. checkedAt set to now so a delayed
        // offline drain doesn't misdate the check. The handler writes the
        // Events Log entry from `summary` after the insert commits.
        const summary = eventsLogLine(modal, overallResult)
        const payload: DrivingCheckSavePayload = {
          baseId: installationId,
          checkedAt: new Date().toISOString(),
          driverName: modal.driverName,
          driverRank: modal.driverRank,
          driverUnit: modal.driverUnit,
          driverOfficeSymbol: modal.driverOfficeSymbol,
          driverPhone: modal.driverPhone,
          driver483Number: modal.driver483Number,
          contractorId: modal.contractorId,
          form483Status: modal.form483Status,
          form483Expires: modal.form483Expires || null,
          vehicleType: modal.vehicleType,
          vehicleId: modal.vehicleId,
          povPassNumber: modal.povPassNumber,
          location: modal.location,
          overallResult,
          violationDescription: modal.violationFlag ? modal.violationDescription : null,
          notes: modal.notes,
          operatingInitials,
          completedByName,
          items: items_,
          summary,
        }
        const result = await getWriteQueue().enqueueOrExecute<DrivingCheckSavePayload, DrivingCheckSaveResult>(
          'driving_check_save', payload, { baseId: installationId, userId: userId || '' },
        )
        if (result.status === 'committed') {
          setSaving(false)
          if (!result.data) { toast.error('Failed to save check'); return }
          toast.success('Spot check logged')
          setModal(null)
          load()
        } else {
          setSaving(false)
          setModal(null)
          toast.success('Check queued — will save automatically when the network returns.', { duration: 8000 })
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(`Failed to save: ${message}`)
      setSaving(false)
    }
  }

  async function handleDelete(check: DrivingCheckWithResults) {
    const who = [check.driver_rank, check.driver_name].filter(Boolean).join(' ') || 'this driver'
    if (!confirm(`Delete the spot check for ${who}?`)) return
    const { error } = await deleteDrivingCheck(check.id)
    if (error) { toast.error(error); return }
    toast.success('Spot check deleted')
    load()
  }

  const handleExportPdf = async () => {
    if (!installationId) return
    if (exportStart > exportEnd) { toast.error('Start date must be on or before the end date.'); return }
    try {
      const { startIso, endIso } = rangeToIso(exportStart, exportEnd)
      const rows = await fetchDrivingChecksInRange(installationId, startIso, endIso)
      const exportStats = computeAobStats(rows)
      const { generateDrivingCheckReportPdf } = await import('@/lib/driving-check-pdf')
      const { doc, filename } = generateDrivingCheckReportPdf({
        startDate: exportStart,
        endDate: exportEnd,
        checks: rows,
        stats: exportStats,
        baseName: currentInstallation?.name || undefined,
        baseIcao: currentInstallation?.icao || undefined,
      })
      doc.save(filename)
      toast.success('Driving spot check report downloaded')
    } catch (e) {
      console.error(e)
      toast.error('Failed to generate PDF')
    }
  }

  if (!loaded) {
    return (
      <div className="page-container">
        <LoadingState message="Loading Airfield Driving Spot Checks..." />
      </div>
    )
  }

  const overallResult = modal
    ? deriveOverallResult(modal.form483Status, modal.draft, modal.violationFlag)
    : 'pass'
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
          <Car size={16} color="var(--color-cyan)" />
          <div style={{
            fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>Airfield Driving Spot Checks</div>
        </div>
        {canWrite && (
          <button
            onClick={() => openModal()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 'var(--radius-md)',
              border: '1px solid color-mix(in srgb, var(--color-cyan) 45%, transparent)',
              background: 'color-mix(in srgb, var(--color-cyan) 14%, transparent)',
              color: 'var(--color-cyan)',
              fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <Plus size={14} /> Start Spot Check
          </button>
        )}
      </div>

      {/* Summary stats table */}
      <div style={{ overflowX: 'auto', marginBottom: 18 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--color-border)' }}>
          <thead>
            <tr>
              {['Checks', 'Pass Rate', 'Discrepancies', 'Violations'].map(h => (
                <th key={h} style={statThStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...statTdStyle, color: 'var(--color-cyan)' }}>{stats.total.toLocaleString()}</td>
              <td style={{ ...statTdStyle, color: 'var(--color-success)' }}>{stats.passRate === null ? '—' : `${Math.round(stats.passRate * 100)}%`}</td>
              <td style={{ ...statTdStyle, color: 'var(--color-warning)' }}>{stats.discrepancyCount.toLocaleString()}</td>
              <td style={{ ...statTdStyle, color: 'var(--color-danger)' }}>{stats.violationCount.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end',
        padding: '12px 14px', borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', marginBottom: 14,
      }}>
        <FilterField label="From">
          <input type="date" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)} style={dateInputStyle} />
        </FilterField>
        <FilterField label="To">
          <input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} style={dateInputStyle} />
        </FilterField>
        <FilterField label="Result">
          <select value={resultFilter} onChange={e => setResultFilter(e.target.value as DrivingCheckResult | 'all')} style={selectStyle}>
            <option value="all">All</option>
            <option value="pass">Pass</option>
            <option value="discrepancy">Discrepancy</option>
            <option value="violation">Violation</option>
          </select>
        </FilterField>
        <FilterField label="Checker">
          <select value={checkerFilter} onChange={e => setCheckerFilter(e.target.value)} style={selectStyle}>
            <option value="all">All checkers</option>
            {checkerOptions.map(c => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </FilterField>
      </div>

      {/* History */}
      <div style={{ marginBottom: 20 }}>
        {filteredChecks.length === 0 ? (
          <EmptyState message="No airfield driving spot checks match the current filters." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredChecks.map(c => (
              <HistoryRow
                key={c.id}
                check={c}
                onEdit={canWrite ? () => openModal(c) : undefined}
                onDelete={canWrite ? () => handleDelete(c) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Export card */}
      <div style={{
        padding: '12px 14px', borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', fontWeight: 700, alignSelf: 'center' }}>
          Export Report
        </div>
        <FilterField label="From">
          <input type="date" value={exportStart} max={exportEnd} onChange={e => setExportStart(e.target.value)} style={dateInputStyle} />
        </FilterField>
        <FilterField label="To">
          <input type="date" value={exportEnd} min={exportStart} onChange={e => setExportEnd(e.target.value)} style={dateInputStyle} />
        </FilterField>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleExportPdf}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
            background: 'var(--color-bg-inset)', color: 'var(--color-text-2)',
            fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <Download size={14} /> Export Report (PDF)
        </button>
      </div>

      {/* Check modal */}
      {modal && (
        <ModalOverlay onClose={() => setModal(null)}>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 4 }}>
            {modal.editId ? 'Edit Spot Check' : 'Start Spot Check'}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 14 }}>
            Airfield driving spot check · attribution: {operatingInitials || '—'}
          </div>

          {/* Driver identification */}
          <SectionLabel>Driver</SectionLabel>
          {(hasLicenses || hasContractors) && !modal.driverPickerOpen && !modal.contractorPickerOpen && (
            <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {hasLicenses && (
                <button
                  onClick={() => setModal(m => m ? { ...m, driverPickerOpen: true } : m)}
                  style={ghostButtonStyle}
                >
                  <Search size={13} /> Look up driver
                </button>
              )}
              {hasContractors && (
                <button
                  onClick={() => setModal(m => m ? { ...m, contractorPickerOpen: true } : m)}
                  style={ghostButtonStyle}
                >
                  <Search size={13} /> Look up contractor
                </button>
              )}
            </div>
          )}
          {modal.driverPickerOpen && (
            <div style={{ marginBottom: 10 }}>
              <DriverPicker
                licenses={driverLicenses}
                query={modal.driverQuery}
                onQuery={q => setModal(m => m ? { ...m, driverQuery: q } : m)}
                onPick={applyDriverLicense}
                onClose={() => setModal(m => m ? { ...m, driverPickerOpen: false, driverQuery: '' } : m)}
              />
            </div>
          )}
          {modal.contractorPickerOpen && (
            <div style={{ marginBottom: 10 }}>
              <ContractorPicker
                contractors={contractors}
                query={modal.contractorQuery}
                onQuery={q => setModal(m => m ? { ...m, contractorQuery: q } : m)}
                onPick={applyContractor}
                onClose={() => setModal(m => m ? { ...m, contractorPickerOpen: false, contractorQuery: '' } : m)}
              />
            </div>
          )}
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 6 }}>
            <LabeledInput label="Name (required)" value={modal.driverName} onChange={v => setModal(m => m ? { ...m, driverName: v } : m)} placeholder="e.g. SSgt Snuffy" />
            <LabeledInput label="Rank" value={modal.driverRank} onChange={v => setModal(m => m ? { ...m, driverRank: v } : m)} placeholder="e.g. SSgt" />
            <LabeledInput label="Unit / Squadron" value={modal.driverUnit} onChange={v => setModal(m => m ? { ...m, driverUnit: v } : m)} placeholder="e.g. 100 ARW/SE" />
            <LabeledInput label="Office Symbol" value={modal.driverOfficeSymbol} onChange={v => setModal(m => m ? { ...m, driverOfficeSymbol: v } : m)} placeholder="e.g. SE" />
          </div>

          {/* AF Form 483 */}
          <SectionLabel>AF Form 483</SectionLabel>
          <Segmented
            options={FORM_483_ORDER.map(s => ({ value: s, label: FORM_483_LABELS[s], color: form483Color(s) }))}
            value={modal.form483Status}
            onChange={v => setModal(m => m ? { ...m, form483Status: v as Form483Status } : m)}
          />
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginTop: 8, marginBottom: 6 }}>
            <LabeledInput label="AF Form 483 #" value={modal.driver483Number} onChange={v => setModal(m => m ? { ...m, driver483Number: v } : m)} placeholder="e.g. 0046-1502" />
            <LabeledInput label="Observed card expiration (optional)" type="date" value={modal.form483Expires} onChange={v => setModal(m => m ? { ...m, form483Expires: v } : m)} />
          </div>

          {/* Vehicle */}
          <SectionLabel>Vehicle</SectionLabel>
          <Segmented
            options={VEHICLE_ORDER.map(v => ({ value: v, label: VEHICLE_TYPE_LABELS[v], color: 'var(--color-cyan)' }))}
            value={modal.vehicleType ?? ''}
            onChange={v => setModal(m => m ? { ...m, vehicleType: v as VehicleType } : m)}
          />
          {modal.vehicleType === 'pov' && (
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginTop: 8, marginBottom: 6 }}>
              <LabeledInput label="POV pass number" value={modal.povPassNumber} onChange={v => setModal(m => m ? { ...m, povPassNumber: v } : m)} />
            </div>
          )}

          {/* Check items */}
          <SectionLabel>Check Items</SectionLabel>
          {modal.draft.length === 0 ? (
            <div style={{
              padding: '12px 14px', borderRadius: 'var(--radius-md)', marginBottom: 10,
              background: 'color-mix(in srgb, var(--color-cyan) 8%, var(--color-bg-surface))',
              border: '1px solid color-mix(in srgb, var(--color-cyan) 30%, transparent)',
              fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)',
            }}>
              No check items configured. Driver identity, AF Form 483, and location still make a valid check.
              Admins can build the list in <Link href="/base-config/setup" style={{ color: 'var(--color-cyan)', textDecoration: 'none' }}>Base Setup → Driving Check Items</Link>.
            </div>
          ) : (
            <>
              {modal.draft.some(d => d.status !== 'pass') && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <button
                    onClick={() => setModal(m => m
                      ? { ...m, draft: m.draft.map(d => ({
                          ...d,
                          status: 'pass' as DrivingItemStatus,
                          notes: d.status === 'discrepancy' ? '' : d.notes,
                        })) }
                      : m)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 14px', borderRadius: 'var(--radius-md)',
                      border: '1px solid color-mix(in srgb, var(--color-success) 35%, transparent)',
                      background: 'color-mix(in srgb, var(--color-success) 12%, transparent)',
                      color: 'var(--color-success)',
                      fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <Check size={13} strokeWidth={3} /> Mark All Pass
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 6 }}>
                {modal.draft.map((d, i) => (
                  <ItemRow
                    key={d.item_id ?? d.item_label}
                    draft={d}
                    guidance={d.item_id ? (guidanceByItemId.get(d.item_id) ?? null) : null}
                    onChange={status => setItemStatus(i, status)}
                    onOpenNotes={() => setModal(m => {
                      if (!m) return m
                      const prior = m.draft[i].status
                      return { ...m, discrepancyDialog: { idx: i, priorStatus: prior === 'discrepancy' ? 'pass' : prior } }
                    })}
                  />
                ))}
              </div>
            </>
          )}

          {/* Location */}
          <SectionLabel>Location (optional)</SectionLabel>
          <input
            list="driving-check-areas"
            value={modal.location}
            onChange={e => setModal(m => m ? { ...m, location: e.target.value } : m)}
            placeholder="e.g. Taxiway A near EOR"
            style={{ ...textInputStyle, marginBottom: 6 }}
          />
          <datalist id="driving-check-areas">
            {areas.map(a => <option key={a} value={a} />)}
          </datalist>

          {/* Outcome */}
          <SectionLabel>Outcome</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>Result:</span>
            <span style={{
              display: 'inline-block', padding: '3px 12px', borderRadius: 'var(--radius-full)',
              background: `color-mix(in srgb, ${DRIVING_RESULT_COLORS[overallResult]} 16%, transparent)`,
              border: `1px solid color-mix(in srgb, ${DRIVING_RESULT_COLORS[overallResult]} 45%, transparent)`,
              color: DRIVING_RESULT_COLORS[overallResult],
              fontSize: 'var(--fs-sm)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {DRIVING_RESULT_LABELS[overallResult]}
            </span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
            <input
              type="checkbox"
              checked={modal.violationFlag}
              onChange={e => setModal(m => m ? { ...m, violationFlag: e.target.checked, violationDescription: e.target.checked ? m.violationDescription : '' } : m)}
            />
            Airfield driving violation
          </label>
          {modal.violationFlag && (
            <textarea
              value={modal.violationDescription}
              onChange={e => setModal(m => m ? { ...m, violationDescription: e.target.value } : m)}
              rows={2}
              placeholder="Describe the violation (required)..."
              style={{ ...textareaStyle, marginBottom: 6, borderColor: modal.violationDescription.trim() ? 'var(--color-border)' : 'color-mix(in srgb, var(--color-danger) 45%, var(--color-border))' }}
            />
          )}

          {/* Notes */}
          <SectionLabel>Notes (optional)</SectionLabel>
          <textarea
            value={modal.notes}
            onChange={e => setModal(m => m ? { ...m, notes: e.target.value } : m)}
            rows={2}
            placeholder="Any additional observations about the check..."
            style={{ ...textareaStyle, marginBottom: 12 }}
          />

          {/* Events Log preview */}
          <SummaryPreview text={eventsLogLine(modal, overallResult)} result={overallResult} />

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
                background: saving ? 'var(--color-bg-elevated)' : 'color-mix(in srgb, var(--color-cyan) 14%, transparent)',
                color: saving ? 'var(--color-text-4)' : 'var(--color-cyan)',
                fontSize: 'var(--fs-md)', fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <CheckCircle2 size={16} />
              {saving ? 'Saving…' : modal.editId ? 'Save Changes' : 'Log Spot Check'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* Discrepancy notes dialog */}
      {modal?.discrepancyDialog && (() => {
        const { idx, priorStatus } = modal.discrepancyDialog!
        const d = modal.draft[idx]
        return (
          <ModalOverlay onClose={() => setModal(m => m ? { ...m, discrepancyDialog: null } : m)} tightZ>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 4 }}>
              {d.item_label} — Discrepancy
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 10 }}>
              Describe the discrepancy. This note is logged in the check results and appears in the report PDF.
            </div>
            <textarea
              autoFocus
              value={d.notes}
              onChange={e => setItemNotes(idx, e.target.value)}
              rows={3}
              placeholder="e.g. Rotating beacon inoperative; driver advised to correct before next operation."
              style={textareaStyle}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => { setItemStatus(idx, priorStatus); setItemNotes(idx, ''); setModal(m => m ? { ...m, discrepancyDialog: null } : m) }}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
                  color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel Discrepancy
              </button>
              <button
                onClick={() => setModal(m => m ? { ...m, discrepancyDialog: null } : m)}
                disabled={!d.notes.trim()}
                style={{
                  flex: 2, padding: '8px 12px', borderRadius: 'var(--radius-md)',
                  border: '1px solid color-mix(in srgb, var(--color-warning) 45%, transparent)',
                  background: d.notes.trim() ? 'color-mix(in srgb, var(--color-warning) 14%, transparent)' : 'var(--color-bg-elevated)',
                  color: d.notes.trim() ? 'var(--color-warning)' : 'var(--color-text-4)',
                  fontSize: 'var(--fs-sm)', fontWeight: 700,
                  cursor: d.notes.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
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

// ── Style tokens ──
const dateInputStyle: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 'var(--radius-sm)',
  background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)',
  color: 'var(--color-text-1)', fontFamily: 'inherit', fontSize: 'var(--fs-sm)',
}
const selectStyle: React.CSSProperties = { ...dateInputStyle }
const textInputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '8px 10px', borderRadius: 'var(--radius-sm)',
  background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)',
  color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
}
const textareaStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '8px 10px', borderRadius: 'var(--radius-sm)',
  background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)',
  color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit', resize: 'vertical',
}
const ghostButtonStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
  background: 'var(--color-bg-inset)', color: 'var(--color-text-2)',
  fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}

// ── Sub-components ──

const statThStyle: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left', fontSize: 'var(--fs-2xs)', fontWeight: 700,
  color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em',
  background: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border)',
}
const statTdStyle: React.CSSProperties = {
  padding: '10px 12px', fontSize: 'var(--fs-xl)', fontWeight: 800, fontVariantNumeric: 'tabular-nums',
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 6, marginBottom: 6 }}>
      {children}
    </div>
  )
}

function LabeledInput({ label, value, onChange, placeholder, type }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)' }}>{label}</span>
      <input
        type={type || 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={textInputStyle}
      />
    </label>
  )
}

function Segmented({ options, value, onChange }: {
  options: Array<{ value: string; label: string; color: string }>
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{
      display: 'flex', gap: 6, flexWrap: 'wrap',
      padding: 4, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
    }}>
      {options.map(o => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              flex: '1 1 auto', minWidth: 90, minHeight: 44, padding: '8px 10px', borderRadius: 'var(--radius-sm)',
              background: active ? `color-mix(in srgb, ${o.color} 18%, transparent)` : 'transparent',
              border: active ? `1px solid color-mix(in srgb, ${o.color} 50%, transparent)` : '1px solid transparent',
              color: active ? o.color : 'var(--color-text-2)',
              fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              textTransform: 'uppercase', letterSpacing: '0.03em', transition: 'all 0.12s',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function ItemRow({ draft, guidance, onChange, onOpenNotes }: {
  draft: DrivingCheckDraft
  guidance: string | null
  onChange: (status: DrivingItemStatus) => void
  onOpenNotes: () => void
}) {
  const statuses: DrivingItemStatus[] = ['pass', 'discrepancy', 'na']
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
        {statuses.map(sKey => {
          const active = draft.status === sKey
          const color = DRIVING_ITEM_STATUS_COLORS[sKey]
          return (
            <button
              key={sKey}
              onClick={() => onChange(sKey)}
              style={{
                padding: '14px 10px', borderRadius: 'var(--radius-md)', minHeight: 60,
                background: active ? `color-mix(in srgb, ${color} 18%, transparent)` : 'transparent',
                border: active ? `1px solid color-mix(in srgb, ${color} 50%, transparent)` : '1px solid var(--color-border)',
                color: active ? color : 'var(--color-text-2)',
                fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                textTransform: 'uppercase', letterSpacing: '0.04em', transition: 'all 0.12s',
              }}
            >
              {DRIVING_ITEM_STATUS_LABELS[sKey]}
            </button>
          )
        })}
      </div>
      {draft.status === 'discrepancy' && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 150, fontSize: 'var(--fs-sm)', color: draft.notes ? 'var(--color-text-2)' : 'var(--color-danger)', fontStyle: 'italic' }}>
            {draft.notes || 'Notes required — describe the discrepancy'}
          </div>
          <button onClick={onOpenNotes} style={ghostButtonStyle}>
            {draft.notes ? 'Edit notes' : 'Add notes'}
          </button>
        </div>
      )}
    </div>
  )
}

function ContractorPicker({ contractors, query, onQuery, onPick, onClose }: {
  contractors: ContractorRow[]
  query: string
  onQuery: (q: string) => void
  onPick: (c: ContractorRow) => void
  onClose: () => void
}) {
  const q = query.trim().toLowerCase()
  const filtered = q
    ? contractors.filter(c =>
        (c.company_name || '').toLowerCase().includes(q) ||
        (c.contact_name || '').toLowerCase().includes(q) ||
        (c.callsign || '').toLowerCase().includes(q))
    : contractors
  return (
    <div style={{ padding: 10, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <input
          autoFocus
          value={query}
          onChange={e => onQuery(e.target.value)}
          placeholder="Search contractors by company, contact, or callsign..."
          style={{ ...textInputStyle }}
        />
        <button onClick={onClose} style={{ ...ghostButtonStyle, padding: '8px 10px' }} aria-label="Close contractor lookup">
          <X size={14} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', padding: '6px 4px' }}>No matching contractors.</div>
        ) : filtered.map(c => (
          <button
            key={c.id}
            onClick={() => onPick(c)}
            style={{
              textAlign: 'left', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
              color: 'var(--color-text-1)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)',
            }}
          >
            <div style={{ fontWeight: 700 }}>{c.company_name}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
              {[c.contact_name, c.callsign].filter(Boolean).join(' · ') || 'No contact on file'}
              {c.af_form_483_expiration ? ` · 483 exp ${c.af_form_483_expiration}` : ''}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function DriverPicker({ licenses, query, onQuery, onPick, onClose }: {
  licenses: DriverLicenseRow[]
  query: string
  onQuery: (q: string) => void
  onPick: (l: DriverLicenseRow) => void
  onClose: () => void
}) {
  const q = query.trim().toLowerCase()
  const filtered = (q
    ? licenses.filter(l =>
        (l.last_name || '').toLowerCase().includes(q) ||
        (l.first_name || '').toLowerCase().includes(q) ||
        (l.unit || '').toLowerCase().includes(q))
    : licenses
  ).slice(0, 50)
  return (
    <div style={{ padding: 10, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <input
          autoFocus
          value={query}
          onChange={e => onQuery(e.target.value)}
          placeholder="Search drivers by last name, first name, or unit..."
          style={{ ...textInputStyle }}
        />
        <button onClick={onClose} style={{ ...ghostButtonStyle, padding: '8px 10px' }} aria-label="Close driver lookup">
          <X size={14} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
        {licenses.length === 0 ? (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', padding: '6px 4px' }}>
            No Airfield Licenses imported yet — add the ADDx report in Base Setup → Driving Check Items.
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', padding: '6px 4px' }}>No matching drivers.</div>
        ) : filtered.map(l => (
          <button
            key={l.id}
            onClick={() => onPick(l)}
            style={{
              textAlign: 'left', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
              color: 'var(--color-text-1)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)',
            }}
          >
            <div style={{ fontWeight: 700 }}>
              {[l.last_name, l.first_name].filter(Boolean).join(', ')}{l.grade_rank ? ` · ${l.grade_rank}` : ''}
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
              {[l.unit, l.office].filter(Boolean).join(' · ') || 'No unit on file'}
              {l.af_483_number ? ` · 483 #${l.af_483_number}` : ''}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function SummaryPreview({ text, result }: { text: string; result: DrivingCheckResult }) {
  const color = DRIVING_RESULT_COLORS[result]
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 'var(--radius-md)',
      background: `color-mix(in srgb, ${color} 8%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
    }}>
      <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        Events Log preview
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', lineHeight: 1.5 }}>{text.toUpperCase()}</div>
    </div>
  )
}

function HistoryRow({ check, onEdit, onDelete }: {
  check: DrivingCheckWithResults
  onEdit?: () => void
  onDelete?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const dateLabel = formatHistoryDate(check.checked_at, todayZuluDate())
  const resultColor = DRIVING_RESULT_COLORS[check.overall_result]
  const badgeColor = form483Color(check.form_483_status)
  const driver = [check.driver_rank, check.driver_name].filter(Boolean).join(' ') || check.driver_name

  return (
    <div style={{
      padding: '10px 12px', borderRadius: 'var(--radius-sm)',
      background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
      borderLeft: `3px solid ${resultColor}`,
    }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'inherit', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 132, flexShrink: 0, fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-1)' }}>
          <span>{dateLabel.primary}</span>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 500 }}>
            {formatZuluTime(check.checked_at)}Z
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {driver}{check.driver_unit ? <span style={{ color: 'var(--color-text-3)', fontWeight: 500 }}> · {check.driver_unit}</span> : null}
          </div>
        </div>
        <span style={{
          padding: '2px 9px', borderRadius: 'var(--radius-full)', fontSize: 'var(--fs-2xs)', fontWeight: 700, whiteSpace: 'nowrap',
          background: `color-mix(in srgb, ${badgeColor} 14%, transparent)`,
          border: `1px solid color-mix(in srgb, ${badgeColor} 35%, transparent)`,
          color: badgeColor,
        }}>
          483 {FORM_483_LABELS[check.form_483_status]}
        </span>
        <span style={{
          padding: '2px 9px', borderRadius: 'var(--radius-full)', fontSize: 'var(--fs-2xs)', fontWeight: 700, whiteSpace: 'nowrap',
          background: `color-mix(in srgb, ${resultColor} 14%, transparent)`,
          border: `1px solid color-mix(in srgb, ${resultColor} 35%, transparent)`,
          color: resultColor, textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {DRIVING_RESULT_LABELS[check.overall_result]}
        </span>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', minWidth: 28, textAlign: 'right' }}>
          {check.completed_by_oi || '—'}
        </span>
      </button>
      {expanded && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 6, marginBottom: 10 }}>
            <DetailField label="Driver" value={driver} />
            {check.driver_unit && <DetailField label="Unit" value={check.driver_unit} />}
            {check.driver_office_symbol && <DetailField label="Office" value={check.driver_office_symbol} />}
            <DetailField label="AF Form 483" value={(check.driver_483_number ? `#${check.driver_483_number} · ` : '') + FORM_483_LABELS[check.form_483_status] + (check.form_483_expires ? ` (exp ${check.form_483_expires})` : '')} />
            {check.vehicle_type && <DetailField label="Vehicle" value={VEHICLE_TYPE_LABELS[check.vehicle_type] + (check.vehicle_id ? ` · ${check.vehicle_id}` : '')} />}
            {check.pov_pass_number && <DetailField label="POV pass" value={check.pov_pass_number} />}
            <DetailField label="Location" value={check.location} />
          </div>

          {check.results.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 4, marginBottom: 8 }}>
              {check.results.map(r => (
                <ResultDisplayRow key={r.id} label={r.item_label} status={r.status} notes={r.notes} />
              ))}
            </div>
          )}

          {check.overall_result === 'violation' && check.violation_description && (
            <div style={{ marginBottom: 8, fontSize: 'var(--fs-xs)', color: 'var(--color-danger)' }}>
              <strong>Violation:</strong> {check.violation_description}
            </div>
          )}
          {check.notes && (
            <div style={{ marginBottom: 8, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
              <strong>Notes:</strong> {check.notes}
            </div>
          )}

          {check.contractor_id && (
            <div style={{ marginBottom: 8, fontSize: 'var(--fs-xs)' }}>
              <Link href="/contractors" style={{ color: 'var(--color-cyan)', textDecoration: 'none' }}>
                Linked contractor record →
              </Link>
            </div>
          )}

          {(onEdit || onDelete) && (
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              {onEdit && (
                <button onClick={onEdit} style={{
                  padding: '5px 10px', borderRadius: 4, border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-inset)', color: 'var(--color-text-2)',
                  fontSize: 'var(--fs-xs)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  Edit
                </button>
              )}
              {onDelete && (
                <button onClick={onDelete} style={{
                  padding: '5px 10px', borderRadius: 4, border: '1px solid var(--color-border)',
                  background: 'transparent', color: 'var(--color-danger)',
                  fontSize: 'var(--fs-xs)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>
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

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}>{value}</div>
    </div>
  )
}

function ResultDisplayRow({ label, status, notes }: { label: string; status: DrivingItemStatus; notes: string | null }) {
  const color = DRIVING_ITEM_STATUS_COLORS[status]
  return (
    <>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', padding: '3px 0' }}>
        {label}
        {notes && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontStyle: 'italic' }}>{notes}</div>}
      </div>
      <div style={{ padding: '3px 0', textAlign: 'right' }}>
        <span style={{
          display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-full)',
          background: `color-mix(in srgb, ${color} 14%, transparent)`,
          border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
          color, fontSize: 'var(--fs-2xs)', fontWeight: 700,
        }}>
          {DRIVING_ITEM_STATUS_LABELS[status]}
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
