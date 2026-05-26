'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft, CloudSnow, Plus, Copy, RefreshCw, Trash2, AlertTriangle, ChevronDown, ChevronRight,
} from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import {
  fetchActiveByRunway,
  fetchRecentHistory,
  createReport,
  deleteReport,
  type FieldConditionReportWithThirds,
  type ThirdInput,
} from '@/lib/supabase/field-conditions'
import {
  deriveRwycc,
  buildFiconNotamText,
  CONTAMINANT_LABELS,
  CONTAMINANT_NOTAM_TOKENS,
  CONTAMINANT_ORDER,
  TREATMENT_LABELS,
  TREATMENT_ORDER,
  THIRD_LABELS,
  THIRD_ORDER,
  rwyccColor,
  rwyccDescriptor,
  type Contaminant,
  type RwyccCode,
  type Third,
  type Treatment,
  type FiconThird,
} from '@/lib/calculations/rwycc'
import { formatZuluDate, formatZuluTime } from '@/lib/utils'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * /field-conditions — TALPA Field Condition Reports per AC 150/5200-30D.
 *
 * Three regions:
 *   1. Header with "+ New Report"
 *   2. Active reports per runway (one card each, with placeholder for
 *      runways without an active FCR)
 *   3. Trailing 30-day history, grouped by Zulu date
 *
 * New Report modal is a single-screen form (not a wizard) to keep the
 * common winter-shift cadence fast — operators are typing in cold trucks
 * with gloved fingers; minimizing screen transitions matters.
 */

type RunwaySummary = {
  id: string
  runway_id: string                  // designator like "13/31"
}

type ModalState = {
  runway_id: string
  runway_designator: string
  temperatureF: string                // input string
  treatments: Set<Treatment>
  validUntil: string                   // datetime-local string
  notes: string
  thirds: Record<Third, ThirdDraft>
}

type ThirdDraft = {
  contaminant: Contaminant
  depthInches: string                 // input string
  coveragePercent: number             // 0-100 slider
  rwyccOverride: RwyccCode | null     // null = use derived
  overrideReason: string
}

function emptyThirdDraft(): ThirdDraft {
  return {
    contaminant: 'dry',
    depthInches: '',
    coveragePercent: 100,
    rwyccOverride: null,
    overrideReason: '',
  }
}

export default function FieldConditionsPage() {
  const { installationId, currentInstallation, runways } = useInstallation()
  const { has } = usePermissions()
  const [loaded, setLoaded] = useState(false)
  const [active, setActive] = useState<FieldConditionReportWithThirds[]>([])
  const [history, setHistory] = useState<FieldConditionReportWithThirds[]>([])
  const [operatingInitials, setOperatingInitials] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState | null>(null)
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const canWrite = has(PERM.FIELD_CONDITIONS_WRITE)

  const reload = useCallback(async () => {
    if (!installationId) return
    const [a, h] = await Promise.all([
      fetchActiveByRunway(installationId),
      fetchRecentHistory(installationId, 30),
    ])
    setActive(a)
    // History excludes anything in the active set so cards aren't duplicated
    const activeIds = new Set(a.map(r => r.id))
    setHistory(h.filter(r => !activeIds.has(r.id)))
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

  useEffect(() => { reload() }, [reload])

  const runwaySummaries: RunwaySummary[] = useMemo(
    () => runways.map(r => ({ id: r.id, runway_id: r.runway_id ?? 'Unknown' })),
    [runways],
  )

  function openNewReport(prefillRunwayId?: string, basedOn?: FieldConditionReportWithThirds) {
    if (runwaySummaries.length === 0) {
      toast.error('Add runways in Base Setup before issuing a field condition report.')
      return
    }
    const runway = prefillRunwayId
      ? runwaySummaries.find(r => r.id === prefillRunwayId) ?? runwaySummaries[0]
      : runwaySummaries[0]

    // Default valid_until: +8 hours from now (typical operator window)
    const validUntilDate = new Date(Date.now() + 8 * 3600_000)
    // datetime-local input format: YYYY-MM-DDTHH:MM (no seconds, no Z)
    const validUntilLocal = new Date(validUntilDate.getTime() - validUntilDate.getTimezoneOffset() * 60_000)
      .toISOString().slice(0, 16)

    const thirds: Record<Third, ThirdDraft> = {
      touchdown: emptyThirdDraft(),
      midpoint: emptyThirdDraft(),
      rollout: emptyThirdDraft(),
    }
    if (basedOn) {
      // Pre-fill from the supersede source (Issue Update)
      for (const t of basedOn.thirds) {
        thirds[t.third as Third] = {
          contaminant: t.contaminant as Contaminant,
          depthInches: t.depth_in?.toString() ?? '',
          coveragePercent: t.coverage_percent ?? 100,
          rwyccOverride: t.rwycc_manual_override ? (t.rwycc as RwyccCode) : null,
          overrideReason: t.override_reason ?? '',
        }
      }
    }

    setModal({
      runway_id: runway.id,
      runway_designator: runway.runway_id,
      temperatureF: basedOn?.temperature_f?.toString() ?? '',
      treatments: new Set((basedOn?.treatments ?? []) as Treatment[]),
      validUntil: validUntilLocal,
      notes: basedOn?.notes ?? '',
      thirds,
    })
  }

  async function handleSave() {
    if (!modal || !installationId) return
    const tempF = modal.temperatureF.trim() ? parseFloat(modal.temperatureF) : null

    const thirdInputs: ThirdInput[] = THIRD_ORDER.map(t => {
      const d = modal.thirds[t]
      const depth = d.depthInches.trim() ? parseFloat(d.depthInches) : null
      const derived = deriveRwycc({
        contaminant: d.contaminant,
        depthInches: depth,
        temperatureC: tempF !== null ? (tempF - 32) * 5 / 9 : null,
      })
      const isOverride = d.rwyccOverride !== null && d.rwyccOverride !== derived
      return {
        third: t,
        contaminant: d.contaminant,
        depth_in: depth,
        coverage_percent: d.coveragePercent,
        rwycc_override: isOverride ? d.rwyccOverride : null,
        override_reason: isOverride ? d.overrideReason.trim() || null : null,
      }
    })

    // Override-reason validation
    const missingReason = thirdInputs.find(t => t.rwycc_override !== null && !t.override_reason)
    if (missingReason) {
      toast.error(`Override reason required for ${THIRD_LABELS[missingReason.third]} third`)
      return
    }

    setSaving(true)
    const res = await createReport({
      base_id: installationId,
      runway_id: modal.runway_id,
      runway_designator: modal.runway_designator,
      valid_until: new Date(modal.validUntil).toISOString(),
      temperature_f: tempF,
      treatments: Array.from(modal.treatments),
      notes: modal.notes.trim() || null,
      operating_initials: operatingInitials,
      thirds: thirdInputs,
    })
    setSaving(false)
    if (!res.ok || !res.report) {
      toast.error(res.error || 'Failed to save report')
      return
    }

    // Auto-copy FICON text for operator convenience
    try {
      await navigator.clipboard.writeText(res.report.ficon_text)
      toast.success('Field Condition Report saved · FICON text copied to clipboard')
    } catch {
      toast.success('Field Condition Report saved')
    }

    setModal(null)
    reload()
  }

  async function handleCopyFicon(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('FICON text copied to clipboard')
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  async function handleDelete(report: FieldConditionReportWithThirds) {
    if (!installationId) return
    if (!confirm(`Delete the field condition report for RWY ${report.runway_designator}? This is meant for pre-publish drafts only — once you've pasted to FAA NOTAM Manager, issue a new report instead.`)) return
    const res = await deleteReport(report.id, installationId)
    if (!res.ok) { toast.error(res.error || 'Delete failed'); return }
    toast.success('Report deleted')
    reload()
  }

  if (!loaded) return <LoadingState />

  return (
    <div className="page-container" style={{ maxWidth: 1000 }}>
      <Link href="/more" style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        color: 'var(--color-text-3)', textDecoration: 'none',
        fontSize: 'var(--fs-sm)', marginBottom: 12,
      }}>
        <ArrowLeft size={14} /> Back
      </Link>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, paddingBottom: 12, marginBottom: 18,
        borderBottom: '1px solid color-mix(in srgb, var(--color-cyan) 25%, transparent)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CloudSnow size={22} color="var(--color-cyan)" />
          <div>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>
              Field Conditions / TALPA
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
              14 CFR §139.313 · AC 150/5200-30D — per-third RwyCC + FICON NOTAM text
            </div>
          </div>
        </div>
        {canWrite && (
          <button onClick={() => openNewReport()} style={primaryBtnStyle}>
            <Plus size={14} style={{ marginRight: 4 }} /> New Report
          </button>
        )}
      </div>

      {/* Active reports per runway */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {runwaySummaries.length === 0 ? (
          <EmptyState message="No runways configured. Add runways in Base Setup before issuing field condition reports." />
        ) : runwaySummaries.map(r => {
          const reportForRunway = active.find(a => a.runway_id === r.id)
          return (
            <RunwayCard
              key={r.id}
              runway={r}
              report={reportForRunway}
              canWrite={canWrite}
              onIssue={() => openNewReport(r.id)}
              onIssueUpdate={() => reportForRunway && openNewReport(r.id, reportForRunway)}
              onCopyFicon={() => reportForRunway && handleCopyFicon(reportForRunway.ficon_text)}
              onDelete={() => reportForRunway && handleDelete(reportForRunway)}
            />
          )
        })}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => setShowHistory(s => !s)}
            style={{
              background: 'none', border: 'none', padding: 0,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)',
              marginBottom: 8,
            }}
          >
            {showHistory ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Past 30 Days ({history.length})
          </button>
          {showHistory && <HistoryList items={history} />}
        </div>
      )}

      {/* New Report modal */}
      {modal && (
        <NewReportModal
          state={modal}
          runways={runwaySummaries}
          onChange={setModal}
          onCancel={() => setModal(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Runway card — active report or placeholder
// ────────────────────────────────────────────────────────────────

function RunwayCard({
  runway, report, canWrite, onIssue, onIssueUpdate, onCopyFicon, onDelete,
}: {
  runway: RunwaySummary
  report: FieldConditionReportWithThirds | undefined
  canWrite: boolean
  onIssue: () => void
  onIssueUpdate: () => void
  onCopyFicon: () => void
  onDelete: () => void
}) {
  if (!report) {
    // No active FCR — assume dry (per AC 30D, absence of report = presumed dry)
    return (
      <div style={{
        padding: 14, borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border)',
        borderLeft: '3px solid var(--color-success)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}>
        <div>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)' }}>
            RWY {runway.runway_id}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
            No active report — conditions presumed dry (RwyCC 6/6/6)
          </div>
        </div>
        {canWrite && (
          <button onClick={onIssue} style={secondaryBtnStyle}>
            <Plus size={12} style={{ marginRight: 4 }} /> Issue Report
          </button>
        )}
      </div>
    )
  }

  const validUntilDate = new Date(report.valid_until)
  const hoursLeft = Math.max(0, (validUntilDate.getTime() - Date.now()) / 3600_000)
  const sortedThirds = [...report.thirds].sort(
    (a, b) => THIRD_ORDER.indexOf(a.third as Third) - THIRD_ORDER.indexOf(b.third as Third),
  )
  const rwyccTuple = sortedThirds.map(t => t.rwycc).join(' / ')

  return (
    <div style={{
      padding: 14, borderRadius: 'var(--radius-md)',
      background: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border)',
      borderLeft: '3px solid var(--color-warning)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)' }}>
            RWY {runway.runway_id} — current
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
            Issued {formatZuluTime(report.generated_at)} by {report.generated_by_oi || '—'}
            {' · '}
            valid until {formatZuluTime(report.valid_until)} ({hoursLeft.toFixed(1)}h)
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {sortedThirds.map(t => (
            <div
              key={t.third}
              style={{
                width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                background: `color-mix(in srgb, ${rwyccColor(t.rwycc as RwyccCode)} 14%, transparent)`,
                border: `1px solid color-mix(in srgb, ${rwyccColor(t.rwycc as RwyccCode)} 50%, transparent)`,
                color: rwyccColor(t.rwycc as RwyccCode),
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'var(--fs-md)', fontWeight: 800,
              }}
              title={`${THIRD_LABELS[t.third as Third]}: RwyCC ${t.rwycc} (${rwyccDescriptor(t.rwycc as RwyccCode)})`}
            >
              {t.rwycc}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sortedThirds.map(t => (
          <div key={t.third} style={{
            display: 'grid', gridTemplateColumns: '90px 1fr auto', gap: 8, alignItems: 'baseline',
            fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)',
          }}>
            <div style={{ color: 'var(--color-text-3)' }}>{THIRD_LABELS[t.third as Third]}</div>
            <div>
              {CONTAMINANT_LABELS[t.contaminant as Contaminant]}
              {t.coverage_percent !== null ? ` ${t.coverage_percent}%` : ''}
              {t.depth_in ? ` · ${t.depth_in}IN` : ''}
              {t.rwycc_manual_override && (
                <span style={{ color: 'var(--color-warning)', marginLeft: 6 }}>
                  · override {t.rwycc_derived} → {t.rwycc}
                </span>
              )}
            </div>
            <div style={{ color: 'var(--color-text-4)' }}>
              derived {t.rwycc_derived}
            </div>
          </div>
        ))}
      </div>

      {report.treatments.length > 0 && (
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
          <span style={{ color: 'var(--color-text-4)' }}>Treatments:</span>{' '}
          {report.treatments.map(t => TREATMENT_LABELS[t as Treatment] ?? t).join(' · ')}
          {report.temperature_f !== null && ` · ${report.temperature_f}°F`}
        </div>
      )}

      {report.notes && (
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', fontStyle: 'italic' }}>
          {report.notes}
        </div>
      )}

      {/* FICON NOTAM body */}
      <div>
        <div style={{
          fontSize: 'var(--fs-2xs)', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.06em', color: 'var(--color-text-3)', marginBottom: 4,
        }}>
          FICON NOTAM (paste into FAA NOTAM Manager)
        </div>
        <div style={{
          padding: '10px 12px', borderRadius: 'var(--radius-sm)',
          background: 'var(--color-bg-inset)',
          border: '1px solid var(--color-border)',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, Monaco, "Cascadia Code", monospace',
          fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)',
          wordBreak: 'break-word',
        }}>
          {report.ficon_text}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={onCopyFicon} style={primaryBtnStyle}>
          <Copy size={12} style={{ marginRight: 4 }} /> Copy FICON
        </button>
        {canWrite && (
          <>
            <button onClick={onIssueUpdate} style={secondaryBtnStyle}>
              <RefreshCw size={12} style={{ marginRight: 4 }} /> Issue Update
            </button>
            <button onClick={onDelete} style={{ ...secondaryBtnStyle, color: 'var(--color-danger)' }}>
              <Trash2 size={12} style={{ marginRight: 4 }} /> Delete
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// History list — grouped by Zulu date
// ────────────────────────────────────────────────────────────────

function HistoryList({ items }: { items: FieldConditionReportWithThirds[] }) {
  // Group by YYYY-MM-DD Zulu of generated_at
  const groups = useMemo(() => {
    const m = new Map<string, FieldConditionReportWithThirds[]>()
    for (const r of items) {
      const day = r.generated_at.slice(0, 10)
      const arr = m.get(day) ?? []
      arr.push(r)
      m.set(day, arr)
    }
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [items])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {groups.map(([day, rows]) => (
        <div key={day}>
          <div style={{
            fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)',
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
          }}>
            {formatZuluDate(day)}
          </div>
          {rows.map(r => {
            const sorted = [...r.thirds].sort(
              (a, b) => THIRD_ORDER.indexOf(a.third as Third) - THIRD_ORDER.indexOf(b.third as Third),
            )
            const rwyccTuple = sorted.map(t => t.rwycc).join('/')
            return (
              <div key={r.id} style={{
                padding: '8px 12px', marginBottom: 4,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                display: 'grid', gridTemplateColumns: '60px 100px 1fr', gap: 10, alignItems: 'baseline',
                fontSize: 'var(--fs-xs)',
              }}>
                <div style={{ color: 'var(--color-text-3)' }}>{formatZuluTime(r.generated_at)}</div>
                <div style={{ color: 'var(--color-text-1)', fontWeight: 600 }}>
                  RWY {r.runway_designator} <span style={{ fontFamily: 'monospace', color: 'var(--color-text-2)' }}>{rwyccTuple}</span>
                </div>
                <div style={{ color: 'var(--color-text-3)', fontFamily: 'monospace', fontSize: 'var(--fs-2xs)' }}>
                  {r.ficon_text}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// New Report modal
// ────────────────────────────────────────────────────────────────

function NewReportModal({
  state, runways, onChange, onCancel, onSave, saving,
}: {
  state: ModalState
  runways: RunwaySummary[]
  onChange: (s: ModalState) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
}) {
  const tempC = state.temperatureF.trim()
    ? (parseFloat(state.temperatureF) - 32) * 5 / 9
    : null

  // Live FICON preview from the current draft
  const ficonPreview = useMemo(() => {
    const ficonThirds: FiconThird[] = THIRD_ORDER.map(t => {
      const d = state.thirds[t]
      const depth = d.depthInches.trim() ? parseFloat(d.depthInches) : null
      const derived = deriveRwycc({
        contaminant: d.contaminant,
        depthInches: depth,
        temperatureC: tempC,
      })
      const rwycc = d.rwyccOverride !== null ? d.rwyccOverride : derived
      return {
        third: t,
        contaminant: d.contaminant,
        coveragePercent: d.coveragePercent,
        depthInches: depth,
        rwycc,
      }
    })
    return buildFiconNotamText({
      runwayDesignator: state.runway_designator,
      thirds: ficonThirds,
      treatments: Array.from(state.treatments),
    })
  }, [state.thirds, state.treatments, state.runway_designator, tempC])

  function updateThird(t: Third, patch: Partial<ThirdDraft>) {
    onChange({
      ...state,
      thirds: { ...state.thirds, [t]: { ...state.thirds[t], ...patch } },
    })
  }
  function toggleTreatment(t: Treatment) {
    const next = new Set(state.treatments)
    if (next.has(t)) next.delete(t); else next.add(t)
    onChange({ ...state, treatments: next })
  }

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '5vh 10px',
        overflow: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 720, width: '100%',
          padding: 18, borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg-surface-solid)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 4 }}>
          New Field Condition Report
        </div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 14 }}>
          Per AC 150/5200-30D — assess each runway third, document treatments, copy FICON to FAA NOTAM Manager.
        </div>

        {/* Runway + temp + validity */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: 10, marginBottom: 14 }}>
          <Field label="Runway *">
            <select
              value={state.runway_id}
              onChange={e => {
                const r = runways.find(rr => rr.id === e.target.value)
                if (r) onChange({ ...state, runway_id: r.id, runway_designator: r.runway_id })
              }}
              style={inputStyle}
            >
              {runways.map(r => <option key={r.id} value={r.id}>{r.runway_id}</option>)}
            </select>
          </Field>
          <Field label="Temp (°F)">
            <input
              type="number"
              value={state.temperatureF}
              onChange={e => onChange({ ...state, temperatureF: e.target.value })}
              placeholder="28"
              style={inputStyle}
            />
          </Field>
          <Field label="Valid Until (local)">
            <input
              type="datetime-local"
              value={state.validUntil}
              onChange={e => onChange({ ...state, validUntil: e.target.value })}
              style={inputStyle}
            />
          </Field>
        </div>

        {/* Per-third assessment */}
        <div style={{
          fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)',
          marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          Per-Third Assessment
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {THIRD_ORDER.map(t => (
            <ThirdRow
              key={t}
              third={t}
              draft={state.thirds[t]}
              temperatureC={tempC}
              onChange={patch => updateThird(t, patch)}
            />
          ))}
        </div>

        {/* Treatments */}
        <Field label="Treatments Applied">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TREATMENT_ORDER.filter(t => t !== 'none').map(t => {
              const active = state.treatments.has(t)
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTreatment(t)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${active ? 'color-mix(in srgb, var(--color-cyan) 55%, transparent)' : 'var(--color-border)'}`,
                    background: active ? 'color-mix(in srgb, var(--color-cyan) 14%, transparent)' : 'var(--color-bg-inset)',
                    color: active ? 'var(--color-cyan)' : 'var(--color-text-3)',
                    fontSize: 'var(--fs-xs)', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {TREATMENT_LABELS[t]}
                </button>
              )
            })}
          </div>
        </Field>

        {/* Notes */}
        <div style={{ marginTop: 10 }}>
          <Field label="Notes (optional)">
            <textarea
              value={state.notes}
              onChange={e => onChange({ ...state, notes: e.target.value })}
              rows={2}
              placeholder="Optional observations, pilot reports, weather trend..."
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>
        </div>

        {/* Live FICON preview */}
        <div style={{
          marginTop: 14, padding: '10px 12px',
          borderRadius: 'var(--radius-sm)',
          background: 'color-mix(in srgb, var(--color-cyan) 6%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-cyan) 35%, transparent)',
        }}>
          <div style={{
            fontSize: 'var(--fs-2xs)', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.06em', color: 'var(--color-cyan)', marginBottom: 4,
          }}>
            FICON Preview
          </div>
          <div style={{
            fontFamily: 'ui-monospace, "SF Mono", Menlo, Monaco, "Cascadia Code", monospace',
            fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', wordBreak: 'break-word',
          }}>
            {ficonPreview}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
            color: 'var(--color-text-2)', fontSize: 'var(--fs-md)', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            style={{
              flex: 2, padding: '10px 14px', borderRadius: 'var(--radius-md)',
              border: '1px solid color-mix(in srgb, var(--color-cyan) 45%, transparent)',
              background: saving ? 'var(--color-bg-elevated)' : 'color-mix(in srgb, var(--color-cyan) 18%, transparent)',
              color: saving ? 'var(--color-text-4)' : 'var(--color-cyan)',
              fontSize: 'var(--fs-md)', fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {saving ? 'Saving…' : 'Issue Report'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Per-third row inside the modal
// ────────────────────────────────────────────────────────────────

function ThirdRow({
  third, draft, temperatureC, onChange,
}: {
  third: Third
  draft: ThirdDraft
  temperatureC: number | null
  onChange: (patch: Partial<ThirdDraft>) => void
}) {
  const depth = draft.depthInches.trim() ? parseFloat(draft.depthInches) : null
  const derived = deriveRwycc({
    contaminant: draft.contaminant,
    depthInches: depth,
    temperatureC,
  })
  const isOverride = draft.rwyccOverride !== null && draft.rwyccOverride !== derived

  return (
    <div style={{
      padding: '10px 12px', borderRadius: 'var(--radius-sm)',
      background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '90px 1fr 80px 90px auto', gap: 8, alignItems: 'baseline',
      }}>
        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-2)' }}>
          {THIRD_LABELS[third]}
        </div>
        <select
          value={draft.contaminant}
          onChange={e => onChange({ contaminant: e.target.value as Contaminant })}
          style={inputStyle}
        >
          {CONTAMINANT_ORDER.map(c => (
            <option key={c} value={c}>{CONTAMINANT_LABELS[c]}</option>
          ))}
        </select>
        <input
          type="number"
          step="0.1"
          value={draft.depthInches}
          onChange={e => onChange({ depthInches: e.target.value })}
          placeholder="Depth IN"
          style={inputStyle}
        />
        <input
          type="number"
          min="0"
          max="100"
          value={draft.coveragePercent}
          onChange={e => onChange({ coveragePercent: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
          style={inputStyle}
        />
        <div style={{
          width: 36, height: 36, borderRadius: 'var(--radius-sm)',
          background: `color-mix(in srgb, ${rwyccColor(isOverride ? (draft.rwyccOverride as RwyccCode) : derived)} 14%, transparent)`,
          border: `1px solid color-mix(in srgb, ${rwyccColor(isOverride ? (draft.rwyccOverride as RwyccCode) : derived)} 50%, transparent)`,
          color: rwyccColor(isOverride ? (draft.rwyccOverride as RwyccCode) : derived),
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 'var(--fs-md)', fontWeight: 800,
        }}>
          {isOverride ? draft.rwyccOverride : derived}
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginTop: 6,
        fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)',
      }}>
        <span>Derived: <strong style={{ color: rwyccColor(derived) }}>{derived}</strong> ({rwyccDescriptor(derived)})</span>
        <span>·</span>
        <span>Override:</span>
        <select
          value={draft.rwyccOverride ?? ''}
          onChange={e => {
            const v = e.target.value
            onChange({ rwyccOverride: v === '' ? null : (parseInt(v) as RwyccCode) })
          }}
          style={{ ...inputStyle, padding: '4px 8px', width: 100 }}
        >
          <option value="">— Use derived —</option>
          {[0,1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        {isOverride && (
          <AlertTriangle size={12} color="var(--color-warning)" />
        )}
      </div>

      {isOverride && (
        <div style={{ marginTop: 6 }}>
          <input
            type="text"
            value={draft.overrideReason}
            onChange={e => onChange({ overrideReason: e.target.value })}
            placeholder="Override reason (required) — e.g. Chemical treatment effective; pilot reports confirm braking"
            style={{ ...inputStyle, fontSize: 'var(--fs-xs)' }}
          />
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Bits
// ────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 'var(--fs-xs)',
        textTransform: 'uppercase', letterSpacing: 0.5,
        color: 'var(--color-text-3)', marginBottom: 4,
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '6px 10px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-inset)',
  color: 'var(--color-text-1)',
  fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
}

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  padding: '6px 14px', borderRadius: 'var(--radius-sm)',
  border: '1px solid color-mix(in srgb, var(--color-cyan) 50%, transparent)',
  background: 'color-mix(in srgb, var(--color-cyan) 14%, transparent)',
  color: 'var(--color-cyan)',
  fontSize: 'var(--fs-sm)', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
}

const secondaryBtnStyle: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
  color: 'var(--color-text-2)', fontSize: 'var(--fs-xs)', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center',
}
