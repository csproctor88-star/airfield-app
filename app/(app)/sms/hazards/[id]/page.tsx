'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft, AlertTriangle, Plus, CheckCircle2, Circle,
  Clock, ShieldCheck, X, ChevronRight,
} from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import {
  fetchHazard, updateHazard,
  fetchAssessments, createAssessment,
  fetchMitigations, createMitigation, updateMitigation,
  BAND_COLORS, classifyRiskBand,
  LIKELIHOOD_LABELS, SEVERITY_LABELS,
  HAZARD_STATUS_LABELS, humanizeToken,
  type SmsHazard, type SmsRiskAssessment, type SmsMitigation,
  type SmsHazardStatus, type SmsMitigationStatus, type SmsMitigationControlType,
} from '@/lib/supabase/sms'
import { RiskMatrix, BandChip } from '@/components/sms/risk-matrix'
import { formatZuluDate, formatZuluDateTime } from '@/lib/utils'
import { LoadingState } from '@/components/ui/loading-state'

/**
 * /sms/hazards/[id] — Hazard detail
 *
 * Top: hazard meta + current/residual band chips + status selector.
 * Middle: live 5×5 risk matrix with current + residual markers, plus
 *         a "Reassess" panel for entering a new assessment snapshot.
 * Bottom: mitigation kanban (Planned / In Progress / Completed).
 */
export default function HazardDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { installationId } = useInstallation()
  const { has } = usePermissions()
  const canWrite = has(PERM.SMS_WRITE)

  const [loaded, setLoaded] = useState(false)
  const [hazard, setHazard] = useState<SmsHazard | null>(null)
  const [assessments, setAssessments] = useState<SmsRiskAssessment[]>([])
  const [mitigations, setMitigations] = useState<SmsMitigation[]>([])
  const [reassessOpen, setReassessOpen] = useState(false)
  const [newMitOpen, setNewMitOpen] = useState(false)

  const reload = useCallback(async () => {
    if (!id) return
    setLoaded(false)
    const h = await fetchHazard(id)
    if (!h) { setLoaded(true); return }
    setHazard(h)
    const [a, m] = await Promise.all([fetchAssessments(id), fetchMitigations(id)])
    setAssessments(a)
    setMitigations(m)
    setLoaded(true)
  }, [id])

  useEffect(() => { reload() }, [reload])

  async function changeStatus(next: SmsHazardStatus) {
    if (!hazard || !installationId) return
    const r = await updateHazard(hazard.id, installationId, { status: next })
    if (!r.ok) { toast.error(r.error || 'Update failed'); return }
    toast.success(`Status → ${HAZARD_STATUS_LABELS[next]}`)
    reload()
  }

  if (!loaded) return <LoadingState />
  if (!hazard) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Link href="/sms/hazards" className="text-sm text-muted-dark hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Hazard Register
        </Link>
        <p className="mt-4 text-muted-dark">Hazard not found.</p>
      </div>
    )
  }

  const latest = assessments[0] // ordered DESC
  const currentBand = latest ? latest.risk_band : null
  const residualBand = latest?.residual_risk_band ?? null

  return (
    <div className="space-y-5 p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Link href="/sms/hazards" className="text-sm text-muted-dark hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Hazard Register
        </Link>
        {canWrite && (
          <select
            value={hazard.status}
            onChange={(e) => changeStatus(e.target.value as SmsHazardStatus)}
            className="text-sm bg-card border border-border-active rounded px-2 py-1.5 text-foreground"
          >
            <option value="open">Open</option>
            <option value="under_review">Under review</option>
            <option value="controlled">Controlled</option>
            <option value="closed">Closed</option>
            <option value="duplicate">Duplicate</option>
          </select>
        )}
      </div>

      {/* Header */}
      <header className="border border-border-active rounded-lg p-4 bg-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-muted-dark">{hazard.hazard_code}</span>
              <BandChip band={currentBand} label={currentBand ? `Current: ${BAND_COLORS[currentBand].label}` : 'Unassessed'} />
              {residualBand && residualBand !== currentBand && (
                <BandChip band={residualBand} label={`Residual: ${BAND_COLORS[residualBand].label}`} />
              )}
            </div>
            <h1 className="text-xl font-semibold text-foreground mt-1 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[color:var(--color-warning)]" /> {hazard.title}
            </h1>
            {hazard.description && (
              <p className="text-sm text-secondary mt-2 leading-relaxed">{hazard.description}</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
          <Meta label="Source" value={humanizeToken(hazard.source_type)} />
          <Meta label="Identified" value={formatZuluDate(hazard.identified_at.slice(0, 10))} />
          <Meta label="Status" value={HAZARD_STATUS_LABELS[hazard.status]} />
          <Meta label="Updated" value={formatZuluDate(hazard.updated_at.slice(0, 10))} />
        </div>
      </header>

      {/* Risk matrix */}
      <section className="border border-border-active rounded-lg p-4 bg-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Risk Position (5×5 Matrix)</h2>
          {canWrite && (
            <button
              onClick={() => setReassessOpen(true)}
              className="text-xs px-2 py-1 rounded border border-border-active hover:bg-elevated text-secondary"
            >
              Reassess
            </button>
          )}
        </div>
        <div className="flex flex-col lg:flex-row items-start gap-5">
          <RiskMatrix
            current={latest ? { likelihood: latest.likelihood, severity: latest.severity } : null}
            residual={
              latest?.residual_likelihood && latest?.residual_severity
                ? { likelihood: latest.residual_likelihood, severity: latest.residual_severity }
                : null
            }
          />
          {latest ? (
            <div className="text-sm text-secondary space-y-2 min-w-[260px]">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-darker">Current</div>
                <div>L{latest.likelihood} ({LIKELIHOOD_LABELS[latest.likelihood]}) × S{latest.severity} ({SEVERITY_LABELS[latest.severity]})</div>
                <div className="text-xs text-muted-dark">Index {latest.risk_index} — {BAND_COLORS[latest.risk_band].label}</div>
              </div>
              {latest.residual_likelihood && latest.residual_severity && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-darker">Residual (post-mitigation)</div>
                  <div>L{latest.residual_likelihood} × S{latest.residual_severity}</div>
                  <div className="text-xs text-muted-dark">Index {latest.residual_risk_index} — {latest.residual_risk_band ? BAND_COLORS[latest.residual_risk_band as 'low' | 'medium' | 'high'].label : '—'}</div>
                </div>
              )}
              {latest.notes && <p className="text-xs text-muted-dark italic">&ldquo;{latest.notes}&rdquo;</p>}
              <div className="text-[10px] text-muted-darker">Assessed {formatZuluDateTime(latest.assessed_at)}</div>
            </div>
          ) : (
            <div className="text-sm text-muted-dark">
              No assessment yet — use <span className="text-foreground">Reassess</span> to record the
              initial likelihood and severity per AC 150/5200-37A §6.3.2.
            </div>
          )}
        </div>
      </section>

      {/* Mitigations */}
      <section className="border border-border-active rounded-lg p-4 bg-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Mitigations</h2>
          {canWrite && (
            <button
              onClick={() => setNewMitOpen(true)}
              className="text-xs px-2 py-1 rounded border border-border-active hover:bg-elevated text-secondary inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          )}
        </div>
        <MitigationKanban
          mitigations={mitigations}
          canWrite={canWrite}
          onChange={async (m, next) => {
            if (!installationId) return
            const r = await updateMitigation(m.id, installationId, { status: next })
            if (!r.ok) { toast.error(r.error || 'Update failed'); return }
            reload()
          }}
        />
      </section>

      {/* Assessment history */}
      {assessments.length > 1 && (
        <section className="border border-border-active rounded-lg p-4 bg-card">
          <h2 className="text-sm font-semibold text-foreground mb-2">Assessment History</h2>
          <div className="space-y-1.5">
            {assessments.slice(1).map((a) => (
              <div key={a.id} className="flex items-center gap-3 text-xs text-muted-dark">
                <span className="font-mono">{formatZuluDate(a.assessed_at.slice(0, 10))}</span>
                <BandChip band={a.risk_band} />
                <span>L{a.likelihood} × S{a.severity} → {a.risk_index}</span>
                {a.notes && <span className="italic truncate max-w-md">— {a.notes}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Modals */}
      {reassessOpen && hazard && installationId && (
        <ReassessModal
          hazardId={hazard.id}
          baseId={installationId}
          onClose={() => setReassessOpen(false)}
          onSaved={() => { setReassessOpen(false); reload() }}
        />
      )}
      {newMitOpen && hazard && installationId && (
        <NewMitigationModal
          hazardId={hazard.id}
          baseId={installationId}
          onClose={() => setNewMitOpen(false)}
          onSaved={() => { setNewMitOpen(false); reload() }}
        />
      )}
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-darker">{label}</div>
      <div className="text-foreground capitalize">{value}</div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Reassess modal — pick L + S off the matrix directly
// ────────────────────────────────────────────────────────────────

function ReassessModal({ hazardId, baseId, onClose, onSaved }: {
  hazardId: string; baseId: string; onClose: () => void; onSaved: () => void;
}) {
  const [picking, setPicking] = useState<'current' | 'residual'>('current')
  const [current, setCurrent] = useState<{ likelihood: number; severity: number } | null>(null)
  const [residual, setResidual] = useState<{ likelihood: number; severity: number } | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!current) { toast.error('Pick the current risk cell first'); return }
    setSaving(true)
    const r = await createAssessment({
      hazard_id: hazardId,
      base_id: baseId,
      likelihood: current.likelihood,
      severity: current.severity,
      residual_likelihood: residual?.likelihood ?? null,
      residual_severity: residual?.severity ?? null,
      notes: notes.trim() || null,
    })
    setSaving(false)
    if (!r.ok) { toast.error(r.error || 'Save failed'); return }
    toast.success('Assessment saved')
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border-active rounded-lg p-5 max-w-2xl w-full space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Reassess Risk</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-dark hover:text-foreground" /></button>
        </div>

        <div className="flex gap-2 text-xs">
          <button
            onClick={() => setPicking('current')}
            className={`px-2.5 py-1 rounded border ${picking === 'current' ? 'border-sky-500 bg-sky-500/15 text-[color:var(--color-accent)]' : 'border-border-active text-muted-dark hover:bg-elevated'}`}
          >
            Pick CURRENT cell {current && `· L${current.likelihood} S${current.severity}`}
          </button>
          <button
            onClick={() => setPicking('residual')}
            className={`px-2.5 py-1 rounded border ${picking === 'residual' ? 'border-emerald-500 bg-emerald-500/15 text-[color:var(--color-success)]' : 'border-border-active text-muted-dark hover:bg-elevated'}`}
          >
            Pick RESIDUAL cell {residual && `· L${residual.likelihood} S${residual.severity}`}
          </button>
        </div>

        <RiskMatrix
          current={current}
          residual={residual}
          pickingFor={picking}
          onPick={(l, s) => {
            if (picking === 'current') setCurrent({ likelihood: l, severity: s })
            else setResidual({ likelihood: l, severity: s })
          }}
        />

        {current && (
          <div className="text-xs text-muted-dark">
            Current: L{current.likelihood} × S{current.severity} = {current.likelihood * current.severity} — {BAND_COLORS[classifyRiskBand(current.likelihood, current.severity)].label}
            {residual && (
              <> · Residual: L{residual.likelihood} × S{residual.severity} = {residual.likelihood * residual.severity} — {BAND_COLORS[classifyRiskBand(residual.likelihood, residual.severity)].label}</>
            )}
          </div>
        )}

        <div>
          <label className="text-xs uppercase tracking-wider text-muted-dark">Rationale / notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Why this likelihood × severity? Cite data, prior incidents, regulatory thresholds…"
            className="w-full mt-1 bg-inset border border-border-active rounded px-3 py-1.5 text-sm text-foreground"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded text-sm bg-elevated hover:bg-elevated text-secondary">Cancel</button>
          <button onClick={save} disabled={saving || !current} className="px-3 py-1.5 rounded text-sm bg-sky-600 hover:bg-sky-500 disabled:bg-elevated text-white">
            {saving ? 'Saving…' : 'Save Assessment'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// New mitigation modal
// ────────────────────────────────────────────────────────────────

function NewMitigationModal({ hazardId, baseId, onClose, onSaved }: {
  hazardId: string; baseId: string; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [controlType, setControlType] = useState<SmsMitigationControlType>('administrative')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    const r = await createMitigation({
      hazard_id: hazardId,
      base_id: baseId,
      title: title.trim(),
      description: description.trim() || null,
      control_type: controlType,
      due_date: dueDate || null,
    })
    setSaving(false)
    if (!r.ok) { toast.error(r.error || 'Save failed'); return }
    toast.success('Mitigation added')
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border-active rounded-lg p-5 max-w-md w-full space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Add Mitigation</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-dark hover:text-foreground" /></button>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-dark">Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Install bird-deterrent lasers near approach"
            className="w-full mt-1 bg-inset border border-border-active rounded px-3 py-1.5 text-sm text-foreground"
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-dark">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full mt-1 bg-inset border border-border-active rounded px-3 py-1.5 text-sm text-foreground"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-dark">Control Type</label>
            <select
              value={controlType}
              onChange={(e) => setControlType(e.target.value as SmsMitigationControlType)}
              className="w-full mt-1 bg-inset border border-border-active rounded px-2 py-1.5 text-sm text-foreground"
            >
              <option value="elimination">Elimination</option>
              <option value="substitution">Substitution</option>
              <option value="engineering">Engineering</option>
              <option value="administrative">Administrative</option>
              <option value="ppe">PPE</option>
              <option value="training">Training</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-dark">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full mt-1 bg-inset border border-border-active rounded px-2 py-1.5 text-sm text-foreground"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3 py-1.5 rounded text-sm bg-elevated hover:bg-elevated text-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded text-sm bg-amber-600 hover:bg-amber-500 disabled:bg-elevated text-white">
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Mitigation kanban
// ────────────────────────────────────────────────────────────────

function MitigationKanban({
  mitigations, canWrite, onChange,
}: {
  mitigations: SmsMitigation[]
  canWrite: boolean
  onChange: (m: SmsMitigation, next: SmsMitigationStatus) => void
}) {
  const lanes: Array<{ key: SmsMitigationStatus; label: string; icon: typeof Circle }> = [
    { key: 'planned',     label: 'Planned',     icon: Circle },
    { key: 'in_progress', label: 'In Progress', icon: Clock },
    { key: 'completed',   label: 'Completed',   icon: CheckCircle2 },
  ]
  if (mitigations.length === 0) {
    return (
      <p className="text-sm text-muted-darker italic">
        No mitigations yet. Add one to record the control measures planned for this hazard.
      </p>
    )
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {lanes.map((lane) => {
        const rows = mitigations.filter((m) => m.status === lane.key)
        const Icon = lane.icon
        return (
          <div key={lane.key} className="border border-border rounded-md bg-inset">
            <div className="px-3 py-1.5 border-b border-border text-xs font-semibold text-secondary flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5" /> {lane.label} <span className="ml-auto text-muted-darker">{rows.length}</span>
            </div>
            <div className="p-2 space-y-1.5 min-h-[80px]">
              {rows.length === 0 ? (
                <p className="text-[11px] text-muted-darker italic px-1">—</p>
              ) : rows.map((m) => (
                <div key={m.id} className="border border-border rounded p-2 bg-card hover:border-border-active">
                  <div className="text-xs font-medium text-foreground">{m.title}</div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-darker uppercase tracking-wider">
                    <span>{m.control_type}</span>
                    {m.due_date && <span>Due {formatZuluDate(m.due_date)}</span>}
                  </div>
                  {canWrite && lane.key !== 'completed' && (
                    <div className="flex justify-end mt-1.5">
                      <button
                        onClick={() => onChange(m, lane.key === 'planned' ? 'in_progress' : 'completed')}
                        className="text-[10px] text-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] inline-flex items-center gap-0.5"
                      >
                        Move on <ChevronRight className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
