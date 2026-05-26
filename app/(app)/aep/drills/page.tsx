'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft, Siren, Plus, ExternalLink, Upload, Trash2, CheckCircle2,
} from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import {
  fetchDrills, fetchLatestFullScale,
  createDrill, completeDrill, deleteDrill, uploadDrillAfterAction,
  fetchResponseAgencies,
  nextFullScaleDue,
  AEP_DRILL_TYPE_LABELS,
  AEP_AGENCY_ROLE_LABELS,
  type AepDrill,
  type AepDrillType,
  type AepDrillParticipant,
  type AepResponseAgency,
} from '@/lib/supabase/aep'
import { formatZuluDate } from '@/lib/utils'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * /aep/drills — Drill program log per §139.325(h) / §139.325(j).
 *
 * Two operating modes:
 *   - Schedule modal: drill_date + type + scenario + multi-select agencies
 *   - Complete modal: per-scheduled-agency attendance + AAR + findings + PDF upload
 *
 * Status chips at the top derive from fetchLatestFullScale + the count
 * of completed tabletop/functional drills in the current calendar year.
 * Completed full-scale drills feed the `aep_full_scale_drill_overdue`
 * SMS SPI on the next pg_cron run.
 */

type ScheduleDraft = {
  drill_date: string
  drill_type: AepDrillType
  scenario: string
  participants: AepDrillParticipant[]
}

type CompleteDraft = {
  drill: AepDrill
  participants: AepDrillParticipant[]
  after_action_notes: string
  findings: string
  file: File | null
}

export default function AepDrillsPage() {
  const { installationId } = useInstallation()
  const { has } = usePermissions()
  const [loaded, setLoaded] = useState(false)
  const [drills, setDrills] = useState<AepDrill[]>([])
  const [latestFullScale, setLatestFullScale] = useState<AepDrill | null>(null)
  const [agencies, setAgencies] = useState<AepResponseAgency[]>([])
  const [schedule, setSchedule] = useState<ScheduleDraft | null>(null)
  const [complete, setComplete] = useState<CompleteDraft | null>(null)
  const [saving, setSaving] = useState(false)

  const canWrite = has(PERM.AEP_WRITE)

  const load = useCallback(async () => {
    if (!installationId) return
    setLoaded(false)
    const [ds, latest, ags] = await Promise.all([
      fetchDrills({ base_id: installationId }),
      fetchLatestFullScale(installationId),
      fetchResponseAgencies(installationId, true),
    ])
    setDrills(ds)
    setLatestFullScale(latest)
    setAgencies(ags)
    setLoaded(true)
  }, [installationId])

  useEffect(() => { load() }, [load])

  function openSchedule() {
    setSchedule({
      drill_date: new Date().toISOString().slice(0, 10),
      drill_type: 'tabletop',
      scenario: '',
      participants: agencies.map(a => ({
        agency_id: a.id,
        agency_name: a.agency_name,
        role: a.agency_role,
        attended: false,
      })),
    })
  }

  function openComplete(drill: AepDrill) {
    // Start from the drill's snapshotted participants (or rebuild from
    // current agencies if the drill was created before any were selected).
    const base = drill.participants && drill.participants.length > 0
      ? drill.participants
      : agencies.map(a => ({
          agency_id: a.id,
          agency_name: a.agency_name,
          role: a.agency_role,
          attended: false,
        }))
    setComplete({
      drill,
      participants: base.map(p => ({ ...p, attended: p.attended ?? false })),
      after_action_notes: drill.after_action_notes ?? '',
      findings: drill.findings ?? '',
      file: null,
    })
  }

  async function handleSaveSchedule() {
    if (!schedule || !installationId) return
    if (!schedule.scenario.trim() || !schedule.drill_date) {
      toast.error('Date and scenario are required')
      return
    }
    setSaving(true)
    const selected = schedule.participants.filter(p => p.attended) // attended=true here means "selected to invite"
    const res = await createDrill({
      base_id: installationId,
      drill_date: schedule.drill_date,
      drill_type: schedule.drill_type,
      scenario: schedule.scenario.trim(),
      participants: selected.map(p => ({ ...p, attended: false })), // reset attended for completion
    })
    setSaving(false)
    if (!res.ok) { toast.error(res.error || 'Failed to schedule drill'); return }
    toast.success('Drill scheduled')
    setSchedule(null)
    load()
  }

  async function handleSaveComplete() {
    if (!complete || !installationId) return
    setSaving(true)
    try {
      let url: string | null = null
      let path: string | null = null
      if (complete.file) {
        const up = await uploadDrillAfterAction({
          file: complete.file,
          base_id: installationId,
          drill_id: complete.drill.id,
        })
        if (!up.ok) {
          toast.error(up.error || 'AAR upload failed')
          return
        }
        url = up.url ?? null
        path = up.storage_path ?? null
      }

      const res = await completeDrill(complete.drill.id, installationId, {
        participants: complete.participants,
        after_action_notes: complete.after_action_notes.trim() || null,
        findings: complete.findings.trim() || null,
        evidence_url: url ?? complete.drill.evidence_url,
        storage_path: path ?? complete.drill.storage_path,
      })
      if (!res.ok) {
        toast.error(res.error || 'Failed to complete drill')
        return
      }
      toast.success('Drill completed')
      setComplete(null)
      load()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(drill: AepDrill) {
    if (!confirm(`Delete the ${AEP_DRILL_TYPE_LABELS[drill.drill_type]} on ${formatZuluDate(drill.drill_date)}?`)) return
    if (!installationId) return
    const res = await deleteDrill(drill.id, installationId)
    if (!res.ok) { toast.error(res.error || 'Delete failed'); return }
    toast.success('Drill deleted')
    load()
  }

  if (!loaded) return <LoadingState />

  const fsDue = nextFullScaleDue(latestFullScale)
  const fsColor =
    fsDue.status === 'overdue' ? 'var(--color-danger)' :
    fsDue.status === 'due_soon' ? 'var(--color-warning)' :
    fsDue.status === 'never' ? 'var(--color-warning)' :
    'var(--color-success)'

  const thisYear = new Date().getUTCFullYear()
  const tabletopsThisYear = drills.filter(d =>
    d.status === 'completed'
    && (d.drill_type === 'tabletop' || d.drill_type === 'functional')
    && new Date(d.drill_date).getUTCFullYear() === thisYear
  ).length

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
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, paddingBottom: 12, marginBottom: 18,
        borderBottom: '1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Siren size={22} color="var(--color-warning)" />
          <div>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>AEP Drills</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
              §139.325(h) triennial full-scale · §139.325(j) annual tabletop / functional
            </div>
          </div>
        </div>
        {canWrite && !schedule && !complete && (
          <button onClick={openSchedule} style={primaryBtnStyle}>
            <Plus size={14} style={{ marginRight: 4 }} /> Schedule Drill
          </button>
        )}
      </div>

      {/* Program status chips */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10,
        marginBottom: 20,
      }}>
        <StatusCard
          label="Full-Scale Exercise"
          accent={fsColor}
          primary={fsDue.status === 'never'
            ? 'Never recorded'
            : fsDue.status === 'overdue'
              ? `Overdue by ${Math.abs(fsDue.daysOut!)} days`
              : `Due ${fsDue.date ? formatZuluDate(fsDue.date.toISOString().slice(0, 10)) : '—'}`}
          secondary={latestFullScale
            ? `Last: ${formatZuluDate(latestFullScale.drill_date)}`
            : '§139.325(h) — every 36 months'}
        />
        <StatusCard
          label="Tabletop / Functional"
          accent={tabletopsThisYear >= 1 ? 'var(--color-success)' : 'var(--color-warning)'}
          primary={tabletopsThisYear >= 1
            ? `${tabletopsThisYear} completed ${thisYear}`
            : `None completed ${thisYear}`}
          secondary="§139.325(j) — at least one per off-year"
        />
      </div>

      {/* Drill log */}
      <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 8 }}>
        Drill Log
      </div>
      {drills.length === 0 ? (
        <EmptyState message="No drills logged yet. Schedule your first drill to start the program." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {drills.map(d => (
            <DrillRow
              key={d.id}
              drill={d}
              onComplete={canWrite && d.status === 'scheduled' ? () => openComplete(d) : undefined}
              onDelete={canWrite ? () => handleDelete(d) : undefined}
            />
          ))}
        </div>
      )}

      {/* Schedule modal */}
      {schedule && (
        <ModalOverlay onClose={() => setSchedule(null)}>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 14 }}>
            Schedule Drill
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 10, marginBottom: 10 }}>
            <Field label="Drill Date">
              <input
                type="date"
                value={schedule.drill_date}
                onChange={e => setSchedule(s => s ? { ...s, drill_date: e.target.value } : s)}
                style={inputStyle}
              />
            </Field>
            <Field label="Type">
              <select
                value={schedule.drill_type}
                onChange={e => setSchedule(s => s ? { ...s, drill_type: e.target.value as AepDrillType } : s)}
                style={inputStyle}
              >
                {(Object.keys(AEP_DRILL_TYPE_LABELS) as AepDrillType[]).map(t => (
                  <option key={t} value={t}>{AEP_DRILL_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Scenario *">
            <textarea
              value={schedule.scenario}
              onChange={e => setSchedule(s => s ? { ...s, scenario: e.target.value } : s)}
              rows={3}
              placeholder="e.g. Aircraft accident with mass casualty event, RWY 13 midfield"
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>
          <div style={{ marginTop: 10 }}>
            <Field label="Participating Agencies (Select all that will be invited)">
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 4,
                padding: 8, borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
                maxHeight: 240, overflowY: 'auto',
              }}>
                {schedule.participants.length === 0 ? (
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                    No agencies yet — add some at <Link href="/aep/agencies" style={{ color: 'var(--color-accent)' }}>Response Agencies</Link>.
                  </div>
                ) : schedule.participants.map((p, i) => (
                  <label key={p.agency_id ?? i} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', cursor: 'pointer',
                  }}>
                    <input
                      type="checkbox"
                      checked={p.attended ?? false}
                      onChange={e => setSchedule(s => {
                        if (!s) return s
                        const next = [...s.participants]
                        next[i] = { ...next[i], attended: e.target.checked }
                        return { ...s, participants: next }
                      })}
                    />
                    <span>{p.agency_name}</span>
                  </label>
                ))}
              </div>
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={() => setSchedule(null)} style={cancelBtnStyle}>Cancel</button>
            <button onClick={handleSaveSchedule} disabled={saving} style={saving ? disabledBtnStyle : primaryBtnStyle}>
              {saving ? 'Saving…' : 'Schedule Drill'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* Complete modal */}
      {complete && (
        <ModalOverlay onClose={() => setComplete(null)}>
          <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)', marginBottom: 4 }}>
            Complete Drill
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginBottom: 14 }}>
            {AEP_DRILL_TYPE_LABELS[complete.drill.drill_type]} · {formatZuluDate(complete.drill.drill_date)} · {complete.drill.scenario.slice(0, 80)}{complete.drill.scenario.length > 80 ? '…' : ''}
          </div>

          <Field label="Attendance">
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 4,
              padding: 8, borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
            }}>
              {complete.participants.length === 0 ? (
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                  No participants recorded.
                </div>
              ) : complete.participants.map((p, i) => (
                <label key={(p.agency_id ?? '') + p.agency_name + i} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={p.attended ?? false}
                    onChange={e => setComplete(c => {
                      if (!c) return c
                      const next = [...c.participants]
                      next[i] = { ...next[i], attended: e.target.checked }
                      return { ...c, participants: next }
                    })}
                  />
                  <span>{p.agency_name}</span>
                </label>
              ))}
            </div>
          </Field>

          <div style={{ marginTop: 10 }}>
            <Field label="After-Action Notes">
              <textarea
                value={complete.after_action_notes}
                onChange={e => setComplete(c => c ? { ...c, after_action_notes: e.target.value } : c)}
                rows={3}
                placeholder="What went well, what didn't, total time elapsed, key observations."
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </Field>
          </div>
          <div style={{ marginTop: 10 }}>
            <Field label="Findings / Gaps">
              <textarea
                value={complete.findings}
                onChange={e => setComplete(c => c ? { ...c, findings: e.target.value } : c)}
                rows={2}
                placeholder="Specific gaps to address before the next drill cycle."
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </Field>
          </div>
          <div style={{ marginTop: 10 }}>
            <Field label="After-Action Report (PDF)">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={fileBtnStyle}>
                  <Upload size={14} style={{ marginRight: 4 }} />
                  {complete.file ? complete.file.name : 'Choose AAR PDF…'}
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    style={{ display: 'none' }}
                    onChange={e => setComplete(c => c ? { ...c, file: e.target.files?.[0] ?? null } : c)}
                  />
                </label>
                {complete.drill.evidence_url && !complete.file && (
                  <a href={complete.drill.evidence_url} target="_blank" rel="noreferrer"
                     style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-accent)', fontSize: 'var(--fs-xs)' }}>
                    <ExternalLink size={12} /> Current
                  </a>
                )}
              </div>
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={() => setComplete(null)} style={cancelBtnStyle}>Cancel</button>
            <button onClick={handleSaveComplete} disabled={saving} style={saving ? disabledBtnStyle : primaryBtnStyle}>
              <CheckCircle2 size={14} style={{ marginRight: 4 }} />
              {saving ? 'Saving…' : 'Mark Drill Completed'}
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Bits
// ────────────────────────────────────────────────────────────────

function StatusCard({ label, primary, secondary, accent }: {
  label: string
  primary: string
  secondary: string
  accent: string
}) {
  return (
    <div style={{
      padding: 14, borderRadius: 'var(--radius-md)',
      background: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border)',
      borderLeft: `3px solid ${accent}`,
    }}>
      <div style={{
        fontSize: 'var(--fs-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
        color: 'var(--color-text-3)', marginBottom: 6,
      }}>{label}</div>
      <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: accent, marginBottom: 4 }}>{primary}</div>
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{secondary}</div>
    </div>
  )
}

function DrillRow({ drill, onComplete, onDelete }: {
  drill: AepDrill
  onComplete?: () => void
  onDelete?: () => void
}) {
  const statusColor =
    drill.status === 'completed' ? 'var(--color-success)' :
    drill.status === 'cancelled' ? 'var(--color-text-4)' :
    'var(--color-warning)'
  const attended = drill.participants?.filter(p => p.attended).length ?? 0
  const total = drill.participants?.length ?? 0
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
      borderLeft: `3px solid ${statusColor}`,
      display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-1)' }}>
            {AEP_DRILL_TYPE_LABELS[drill.drill_type]}
          </span>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
            {formatZuluDate(drill.drill_date)}
          </span>
          <span style={{
            padding: '1px 6px', borderRadius: 3,
            fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
            background: `color-mix(in srgb, ${statusColor} 18%, transparent)`,
            color: statusColor,
          }}>{drill.status}</span>
        </div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', lineHeight: 1.45 }}>
          {drill.scenario}
        </div>
        {(drill.status === 'completed' && total > 0) && (
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 4 }}>
            Attendance: {attended} of {total}
            {drill.findings && (<><span style={{ marginLeft: 8, color: 'var(--color-warning)' }}>· Findings recorded</span></>)}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {drill.evidence_url && (
          <a href={drill.evidence_url} target="_blank" rel="noreferrer"
             style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-accent)', fontSize: 'var(--fs-xs)' }}>
            <ExternalLink size={12} /> AAR
          </a>
        )}
        {onComplete && <button onClick={onComplete} style={smallBtnStyle}>Complete</button>}
        {onDelete && (
          <button onClick={onDelete} style={{ ...smallBtnStyle, color: 'var(--color-danger)' }} aria-label="Delete">
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--color-text-3)', marginBottom: 4 }}>
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
  padding: '8px 16px', borderRadius: 'var(--radius-sm)',
  border: '1px solid color-mix(in srgb, var(--color-warning) 50%, transparent)',
  background: 'color-mix(in srgb, var(--color-warning) 20%, transparent)',
  color: 'rgb(180,83,9)',
  fontSize: 'var(--fs-sm)', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
}

const disabledBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle, opacity: 0.5, cursor: 'not-allowed',
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'transparent',
  color: 'var(--color-text-3)',
  fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'inherit',
}

const smallBtnStyle: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)',
  color: 'var(--color-text-2)', fontSize: 'var(--fs-xs)', cursor: 'pointer', fontFamily: 'inherit',
  display: 'inline-flex', alignItems: 'center',
}

const fileBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  padding: '6px 12px', borderRadius: 'var(--radius-sm)',
  border: '1px dashed var(--color-border)',
  background: 'var(--color-bg-inset)',
  color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)',
  cursor: 'pointer', fontFamily: 'inherit',
}
