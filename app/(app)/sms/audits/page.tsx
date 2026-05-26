'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ClipboardCheck, ArrowLeft, Plus, X, Calendar, ExternalLink } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import { fetchAudits, createAudit, updateAudit, type SmsAudit } from '@/lib/supabase/sms'
import { formatZuluDate } from '@/lib/utils'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * /sms/audits — Internal SMS audits per §139.401(d).
 *
 * Lightweight table view — audits are infrequent (annual or
 * triennial) so we don't need filters / band chips here. Tap a row
 * to edit findings + status inline.
 */
export default function SmsAuditsPage() {
  const { installationId } = useInstallation()
  const { has } = usePermissions()
  const canWrite = has(PERM.SMS_WRITE)
  const [loaded, setLoaded] = useState(false)
  const [rows, setRows] = useState<SmsAudit[]>([])
  const [editing, setEditing] = useState<SmsAudit | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [draft, setDraft] = useState({ title: '', scope: '', scheduled_date: '', audit_type: 'internal' as SmsAudit['audit_type'] })
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    if (!installationId) return
    setLoaded(false)
    setRows(await fetchAudits(installationId))
    setLoaded(true)
  }, [installationId])
  useEffect(() => { reload() }, [reload])

  async function handleCreate() {
    if (!installationId) return
    if (!draft.title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    const r = await createAudit({
      base_id: installationId,
      title: draft.title.trim(),
      audit_type: draft.audit_type,
      scope: draft.scope.trim() || null,
      scheduled_date: draft.scheduled_date || null,
    })
    setSaving(false)
    if (!r.ok) { toast.error(r.error || 'Insert failed'); return }
    toast.success(`Audit ${r.audit?.audit_code} created`)
    setNewOpen(false)
    setDraft({ title: '', scope: '', scheduled_date: '', audit_type: 'internal' })
    reload()
  }

  async function handleSaveEdit() {
    if (!editing || !installationId) return
    const r = await updateAudit(editing.id, installationId, {
      title: editing.title,
      scope: editing.scope,
      scheduled_date: editing.scheduled_date,
      performed_date: editing.performed_date,
      status: editing.status,
      findings: editing.findings,
      report_url: editing.report_url,
      notes: editing.notes,
    })
    if (!r.ok) { toast.error(r.error || 'Save failed'); return }
    toast.success('Audit saved')
    setEditing(null)
    reload()
  }

  if (!loaded) return <LoadingState />

  return (
    <div className="space-y-5 p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Link href="/sms" className="inline-flex items-center gap-1.5 text-sm text-muted-dark hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> SMS Dashboard
        </Link>
        {canWrite && (
          <button
            onClick={() => setNewOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-emerald-600/20 border border-emerald-600/50 text-[color:var(--color-success)] hover:bg-emerald-600/30"
          >
            <Plus className="w-4 h-4" /> New Audit
          </button>
        )}
      </div>

      <header>
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-[color:var(--color-success)]" /> SMS Audits
        </h1>
        <p className="text-sm text-muted-dark">
          §139.401(d) — internal Safety Assurance audits. Annual internal review + supplementary
          self-assessments. Findings can be linked back to hazards for treatment tracking.
        </p>
      </header>

      {rows.length === 0 ? (
        <EmptyState message="No audits scheduled yet. Schedule the first internal SMS audit to satisfy §139.401(d)." />
      ) : (
        <div className="border border-border-active rounded-lg overflow-hidden">
          {rows.map((a) => (
            <button
              key={a.id}
              onClick={() => setEditing(a)}
              className="w-full text-left px-3 py-2.5 border-b border-border last:border-0 hover:bg-elevated transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-dark">{a.audit_code}</span>
                    <span className="text-sm font-medium text-foreground truncate">{a.title}</span>
                    <AuditStatusPill status={a.status} />
                    <span className="text-[10px] uppercase tracking-wider text-muted-darker">{a.audit_type.replace('_', ' ')}</span>
                  </div>
                  {a.scope && <p className="text-xs text-muted-dark mt-1 line-clamp-1">{a.scope}</p>}
                </div>
                <div className="text-right shrink-0 text-xs">
                  {a.scheduled_date && (
                    <div className="text-secondary inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatZuluDate(a.scheduled_date)}</div>
                  )}
                  {(a.findings_open > 0 || a.findings_closed > 0) && (
                    <div className="text-[10px] text-muted-darker mt-0.5">
                      {a.findings_open} open · {a.findings_closed} closed
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* New audit modal */}
      {newOpen && (
        <Modal title="Schedule Audit" onClose={() => setNewOpen(false)}>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-dark">Title *</label>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="e.g. Annual SMS Internal Audit FY26"
              className="w-full mt-1 bg-inset border border-border-active rounded px-3 py-1.5 text-sm text-foreground"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-dark">Scope</label>
            <textarea
              value={draft.scope}
              onChange={(e) => setDraft({ ...draft, scope: e.target.value })}
              rows={3}
              className="w-full mt-1 bg-inset border border-border-active rounded px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-dark">Audit Type</label>
              <select
                value={draft.audit_type}
                onChange={(e) => setDraft({ ...draft, audit_type: e.target.value as SmsAudit['audit_type'] })}
                className="w-full mt-1 bg-inset border border-border-active rounded px-2 py-1.5 text-sm text-foreground"
              >
                <option value="internal">Internal</option>
                <option value="external">External</option>
                <option value="self_assessment">Self-Assessment</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-dark">Scheduled</label>
              <input
                type="date"
                value={draft.scheduled_date}
                onChange={(e) => setDraft({ ...draft, scheduled_date: e.target.value })}
                className="w-full mt-1 bg-inset border border-border-active rounded px-2 py-1.5 text-sm text-foreground"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setNewOpen(false)} className="px-3 py-1.5 rounded text-sm bg-elevated hover:bg-elevated text-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="px-3 py-1.5 rounded text-sm bg-emerald-600 hover:bg-emerald-500 disabled:bg-elevated text-white">
              {saving ? 'Saving…' : 'Schedule'}
            </button>
          </div>
        </Modal>
      )}

      {/* Edit modal */}
      {editing && (
        <Modal title={`${editing.audit_code} — ${editing.title}`} onClose={() => setEditing(null)} wide>
          <AuditEditor audit={editing} onChange={setEditing} onSave={handleSaveEdit} />
        </Modal>
      )}
    </div>
  )
}

function AuditEditor({ audit, onChange, onSave }: {
  audit: SmsAudit
  onChange: (a: SmsAudit) => void
  onSave: () => void
}) {
  function addFinding() {
    onChange({
      ...audit,
      findings: [...audit.findings, { id: crypto.randomUUID(), text: '', severity: 'medium', status: 'open' }],
    })
  }
  function updateFinding(idx: number, patch: Partial<SmsAudit['findings'][number]>) {
    onChange({ ...audit, findings: audit.findings.map((f, i) => i === idx ? { ...f, ...patch } : f) })
  }
  function removeFinding(idx: number) {
    onChange({ ...audit, findings: audit.findings.filter((_, i) => i !== idx) })
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-dark">Status</label>
          <select
            value={audit.status}
            onChange={(e) => onChange({ ...audit, status: e.target.value as SmsAudit['status'] })}
            className="w-full mt-1 bg-inset border border-border-active rounded px-2 py-1.5 text-sm text-foreground"
          >
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-dark">Performed Date</label>
          <input
            type="date"
            value={audit.performed_date ?? ''}
            onChange={(e) => onChange({ ...audit, performed_date: e.target.value || null })}
            className="w-full mt-1 bg-inset border border-border-active rounded px-2 py-1.5 text-sm text-foreground"
          />
        </div>
      </div>

      <div>
        <label className="text-xs uppercase tracking-wider text-muted-dark">Report URL</label>
        <input
          type="url"
          value={audit.report_url ?? ''}
          onChange={(e) => onChange({ ...audit, report_url: e.target.value || null })}
          className="w-full mt-1 bg-inset border border-border-active rounded px-3 py-1.5 text-sm text-foreground"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs uppercase tracking-wider text-muted-dark">Findings</label>
          <button onClick={addFinding} className="text-xs px-2 py-0.5 rounded border border-border-active hover:bg-elevated text-secondary">
            <Plus className="inline w-3 h-3 mr-0.5" /> Add
          </button>
        </div>
        <div className="space-y-1.5">
          {audit.findings.length === 0 && <p className="text-xs text-muted-darker italic">No findings recorded.</p>}
          {audit.findings.map((f, idx) => (
            <div key={f.id} className="border border-border-active rounded p-2 space-y-1.5">
              <div className="flex gap-2">
                <input
                  value={f.text}
                  onChange={(e) => updateFinding(idx, { text: e.target.value })}
                  placeholder="Finding description"
                  className="flex-1 bg-card border border-border-active rounded px-2 py-1 text-sm text-foreground"
                />
                <select
                  value={f.severity ?? 'medium'}
                  onChange={(e) => updateFinding(idx, { severity: e.target.value as 'low' | 'medium' | 'high' })}
                  className="bg-card border border-border-active rounded px-1.5 py-1 text-xs text-foreground"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <select
                  value={f.status ?? 'open'}
                  onChange={(e) => updateFinding(idx, { status: e.target.value as 'open' | 'closed' })}
                  className="bg-card border border-border-active rounded px-1.5 py-1 text-xs text-foreground"
                >
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
                <button onClick={() => removeFinding(idx)} className="text-xs text-[color:var(--color-danger)] hover:text-[color:var(--color-danger)] px-2">×</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onSave} className="px-3 py-1.5 rounded text-sm bg-emerald-600 hover:bg-emerald-500 text-white">Save</button>
      </div>
    </>
  )
}

function AuditStatusPill({ status }: { status: string }) {
  const palette: Record<string, { bg: string; text: string; label: string }> = {
    scheduled:   { bg: 'rgba(56,189,248,0.15)', text: 'rgb(3,105,161)', label: 'Scheduled' },
    in_progress: { bg: 'rgba(245,158,11,0.15)', text: 'rgb(180,83,9)', label: 'In Progress' },
    completed:   { bg: 'rgba(34,197,94,0.15)',  text: 'rgb(21,128,61)', label: 'Completed' },
    closed:      { bg: 'rgba(100,116,139,0.18)', text: 'rgb(71,85,105)', label: 'Closed' },
    canceled:    { bg: 'rgba(100,116,139,0.18)', text: 'rgb(71,85,105)', label: 'Canceled' },
  }
  const p = palette[status] ?? palette.scheduled
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider"
          style={{ backgroundColor: p.bg, color: p.text }}>
      {p.label}
    </span>
  )
}

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-card border border-border-active rounded-lg p-5 ${wide ? 'max-w-2xl' : 'max-w-md'} w-full space-y-3 max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between sticky top-0 bg-card pb-2 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-dark hover:text-foreground" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
