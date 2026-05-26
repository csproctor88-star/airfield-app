'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { GitBranch, ArrowLeft, Plus, X, CheckCircle2, XCircle } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import {
  fetchMocs, createMoc, updateMoc, approveMoc, rejectMoc,
  type SmsMoc, type SmsMocStatus,
} from '@/lib/supabase/sms'
import { formatZuluDate } from '@/lib/utils'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * /sms/moc — Management of Change per §139.401(e).
 *
 * Captures operational / organizational / equipment changes that
 * could affect safety, with risk-analysis summary and an
 * AE-approval gate. Approval / rejection routes through dedicated
 * RPCs (approve_sms_moc / reject_sms_moc) so the audit trail and
 * permission enforcement stay atomic.
 */
export default function SmsMocPage() {
  const { installationId } = useInstallation()
  const { has } = usePermissions()
  const canWrite = has(PERM.SMS_WRITE)
  const canApprove = has(PERM.SMS_APPROVE_MOC)
  const [loaded, setLoaded] = useState(false)
  const [rows, setRows] = useState<SmsMoc[]>([])
  const [editing, setEditing] = useState<SmsMoc | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [draft, setDraft] = useState({ title: '', change_description: '', change_category: 'operational' as SmsMoc['change_category'], effective_date: '' })
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    if (!installationId) return
    setLoaded(false)
    setRows(await fetchMocs(installationId))
    setLoaded(true)
  }, [installationId])
  useEffect(() => { reload() }, [reload])

  async function handleCreate() {
    if (!installationId) return
    if (!draft.title.trim() || !draft.change_description.trim()) {
      toast.error('Title and change description are required')
      return
    }
    setSaving(true)
    const r = await createMoc({
      base_id: installationId,
      title: draft.title.trim(),
      change_description: draft.change_description.trim(),
      change_category: draft.change_category,
      effective_date: draft.effective_date || null,
    })
    setSaving(false)
    if (!r.ok) { toast.error(r.error || 'Insert failed'); return }
    toast.success(`${r.moc?.moc_code} created`)
    setNewOpen(false)
    setDraft({ title: '', change_description: '', change_category: 'operational', effective_date: '' })
    reload()
  }

  async function handleSaveEdit() {
    if (!editing || !installationId) return
    const r = await updateMoc(editing.id, installationId, {
      title: editing.title,
      change_description: editing.change_description,
      change_category: editing.change_category,
      effective_date: editing.effective_date,
      risk_analysis_summary: editing.risk_analysis_summary,
      status: editing.status,
    })
    if (!r.ok) { toast.error(r.error || 'Save failed'); return }
    toast.success('MoC saved')
    setEditing(null)
    reload()
  }

  async function handleApprove(moc: SmsMoc) {
    if (!installationId) return
    const notes = prompt('Approval notes (optional):') ?? undefined
    const r = await approveMoc({ mocId: moc.id, baseId: installationId, notes })
    if (!r.ok) { toast.error(r.error || 'Approve failed'); return }
    toast.success(`${moc.moc_code} approved`)
    reload()
  }

  async function handleReject(moc: SmsMoc) {
    if (!installationId) return
    const reason = prompt('Rejection reason:')
    if (!reason) { toast.error('Rejection reason is required'); return }
    const r = await rejectMoc({ mocId: moc.id, baseId: installationId, reason })
    if (!r.ok) { toast.error(r.error || 'Reject failed'); return }
    toast.success(`${moc.moc_code} rejected`)
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-sky-600/20 border border-sky-600/50 text-[color:var(--color-accent)] hover:bg-sky-600/30"
          >
            <Plus className="w-4 h-4" /> New MoC
          </button>
        )}
      </div>

      <header>
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <GitBranch className="w-6 h-6 text-[color:var(--color-accent)]" /> Management of Change
        </h1>
        <p className="text-sm text-muted-dark">
          §139.401(e) — every operational, organizational, equipment, or procedural change with
          potential safety impact gets a risk analysis and Accountable Executive approval.
        </p>
      </header>

      {rows.length === 0 ? (
        <EmptyState message="No Management of Change records. Capture the first MoC when a safety-relevant change is proposed." />
      ) : (
        <div className="border border-border-active rounded-lg overflow-hidden">
          {rows.map((m) => (
            <div key={m.id} className="px-3 py-2.5 border-b border-border last:border-0 hover:bg-elevated transition-colors">
              <div className="flex items-start justify-between gap-3">
                <button onClick={() => setEditing(m)} className="text-left min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-dark">{m.moc_code}</span>
                    <span className="text-sm font-medium text-foreground truncate">{m.title}</span>
                    <MocStatusPill status={m.status} />
                    <span className="text-[10px] uppercase tracking-wider text-muted-darker">{m.change_category}</span>
                  </div>
                  <p className="text-xs text-muted-dark mt-1 line-clamp-2">{m.change_description}</p>
                  <div className="text-[10px] text-muted-darker mt-1">
                    Proposed {formatZuluDate(m.proposed_at.slice(0, 10))}
                    {m.effective_date && ` · Effective ${formatZuluDate(m.effective_date)}`}
                    {m.approved_at && ` · Approved ${formatZuluDate(m.approved_at.slice(0, 10))}`}
                  </div>
                </button>
                {canApprove && (m.status === 'pending_approval' || m.status === 'risk_analysis') && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleApprove(m)}
                      title="Approve"
                      className="p-1.5 rounded hover:opacity-80"
                      style={{ color: 'var(--color-success)' }}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleReject(m)}
                      title="Reject"
                      className="p-1.5 rounded hover:opacity-80"
                      style={{ color: 'var(--color-danger)' }}
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {newOpen && (
        <Modal title="New Management of Change" onClose={() => setNewOpen(false)}>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-dark">Title *</label>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="e.g. Relocate ARFF Station to North Apron"
              className="w-full mt-1 bg-inset border border-border-active rounded px-3 py-1.5 text-sm text-foreground"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-dark">Change Description *</label>
            <textarea
              value={draft.change_description}
              onChange={(e) => setDraft({ ...draft, change_description: e.target.value })}
              rows={4}
              className="w-full mt-1 bg-inset border border-border-active rounded px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-dark">Category</label>
              <select
                value={draft.change_category}
                onChange={(e) => setDraft({ ...draft, change_category: e.target.value as SmsMoc['change_category'] })}
                className="w-full mt-1 bg-inset border border-border-active rounded px-2 py-1.5 text-sm text-foreground"
              >
                <option value="operational">Operational</option>
                <option value="organizational">Organizational</option>
                <option value="equipment">Equipment</option>
                <option value="procedural">Procedural</option>
                <option value="regulatory">Regulatory</option>
                <option value="facility">Facility</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-dark">Effective</label>
              <input
                type="date"
                value={draft.effective_date}
                onChange={(e) => setDraft({ ...draft, effective_date: e.target.value })}
                className="w-full mt-1 bg-inset border border-border-active rounded px-2 py-1.5 text-sm text-foreground"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setNewOpen(false)} className="px-3 py-1.5 rounded text-sm bg-elevated hover:bg-elevated text-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="px-3 py-1.5 rounded text-sm bg-sky-600 hover:bg-sky-500 disabled:bg-elevated text-white">
              {saving ? 'Saving…' : 'Create'}
            </button>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal title={`${editing.moc_code} — ${editing.title}`} onClose={() => setEditing(null)} wide>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-dark">Status</label>
            <select
              value={editing.status}
              onChange={(e) => setEditing({ ...editing, status: e.target.value as SmsMocStatus })}
              className="w-full mt-1 bg-inset border border-border-active rounded px-2 py-1.5 text-sm text-foreground"
            >
              <option value="proposed">Proposed</option>
              <option value="risk_analysis">Risk Analysis</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="approved" disabled>Approved (use Approve button)</option>
              <option value="rejected" disabled>Rejected (use Reject button)</option>
              <option value="implemented">Implemented</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-dark">Risk Analysis Summary</label>
            <textarea
              value={editing.risk_analysis_summary ?? ''}
              onChange={(e) => setEditing({ ...editing, risk_analysis_summary: e.target.value || null })}
              rows={4}
              placeholder="Hazards identified, likelihood × severity per affected operation, mitigation plan…"
              className="w-full mt-1 bg-inset border border-border-active rounded px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={handleSaveEdit} className="px-3 py-1.5 rounded text-sm bg-sky-600 hover:bg-sky-500 text-white">Save</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function MocStatusPill({ status }: { status: string }) {
  const palette: Record<string, { bg: string; text: string; label: string }> = {
    proposed:         { bg: 'rgba(100,116,139,0.18)', text: 'rgb(71,85,105)', label: 'Proposed' },
    risk_analysis:    { bg: 'rgba(56,189,248,0.15)', text: 'rgb(3,105,161)', label: 'Risk Analysis' },
    pending_approval: { bg: 'rgba(245,158,11,0.15)', text: 'rgb(180,83,9)', label: 'Pending Approval' },
    approved:         { bg: 'rgba(34,197,94,0.15)',  text: 'rgb(21,128,61)', label: 'Approved' },
    rejected:         { bg: 'rgba(239,68,68,0.15)',  text: 'rgb(185,28,28)', label: 'Rejected' },
    implemented:      { bg: 'rgba(34,197,94,0.15)',  text: 'rgb(21,128,61)', label: 'Implemented' },
    closed:           { bg: 'rgba(100,116,139,0.18)', text: 'rgb(71,85,105)', label: 'Closed' },
  }
  const p = palette[status] ?? palette.proposed
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
