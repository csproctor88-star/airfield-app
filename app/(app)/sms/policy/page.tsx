'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, FileSignature, Plus, CheckCircle2, History, ExternalLink } from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import {
  fetchActivePolicy,
  fetchPolicyHistory,
  createDraftPolicy,
  updateDraftPolicy,
  signPolicy,
  type SmsPolicy,
  type SmsSafetyObjective,
} from '@/lib/supabase/sms'
import { formatZuluDate } from '@/lib/utils'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * /sms/policy — Safety Policy
 *
 * One active policy per base. AE-tier roles can mint a new draft,
 * edit the safety_objectives + reporting pledge + document URL, and
 * sign it active via the SECURITY DEFINER `sign_sms_policy` RPC.
 * Earlier versions remain visible in the History panel below.
 *
 * Per AC 150/5200-37A §6.2: the Safety Policy is the AE's commitment
 * statement; the version chain + signed-at trio is what an FAA Cert
 * Inspector asks for first during a §139.401 SMS review.
 */
export default function SmsPolicyPage() {
  const { installationId } = useInstallation()
  const { has } = usePermissions()
  const [loaded, setLoaded] = useState(false)
  const [active, setActive] = useState<SmsPolicy | null>(null)
  const [history, setHistory] = useState<SmsPolicy[]>([])
  const [editing, setEditing] = useState<SmsPolicy | null>(null)
  const [signing, setSigning] = useState(false)

  const canSign  = has(PERM.SMS_SIGN_POLICY)
  const canWrite = has(PERM.SMS_WRITE)

  const reload = useCallback(async () => {
    if (!installationId) return
    setLoaded(false)
    const [a, h] = await Promise.all([
      fetchActivePolicy(installationId),
      fetchPolicyHistory(installationId),
    ])
    setActive(a)
    setHistory(h)
    setLoaded(true)
  }, [installationId])

  useEffect(() => { reload() }, [reload])

  async function handleNewDraft() {
    if (!installationId) return
    const r = await createDraftPolicy({
      base_id: installationId,
      safety_objectives: [
        { id: crypto.randomUUID(), title: 'Reduce wildlife strike risk', description: 'Maintain wildlife strike rate below 1 per 1,000 operations.' },
        { id: crypto.randomUUID(), title: 'Eliminate runway incursions', description: 'Zero pilot- or vehicle-driver-deviation incursions per calendar year.' },
      ],
      employee_reporting_pledge:
        'All personnel are encouraged to report safety hazards, incidents, or concerns. Reports submitted in good faith will not result in disciplinary action — non-retribution is fundamental to our Safety Management System per 14 CFR §139.401.',
    })
    if (!r.ok || !r.policy) {
      toast.error(r.error || 'Failed to create draft')
      return
    }
    toast.success(`Draft policy v${r.policy.version} created`)
    setEditing(r.policy)
    reload()
  }

  async function handleSaveDraft() {
    if (!editing || !installationId) return
    const r = await updateDraftPolicy(editing.id, installationId, {
      document_url: editing.document_url,
      safety_objectives: editing.safety_objectives,
      employee_reporting_pledge: editing.employee_reporting_pledge,
      review_due_date: editing.review_due_date,
    })
    if (!r.ok) { toast.error(r.error || 'Save failed'); return }
    toast.success('Draft saved')
    reload()
  }

  async function handleSign() {
    if (!editing || !installationId) return
    if (!canSign) { toast.error('Only the Accountable Executive can sign this policy'); return }
    setSigning(true)
    const r = await signPolicy({
      policyId: editing.id,
      baseId: installationId,
      effectiveDate: new Date().toISOString().slice(0, 10),
    })
    setSigning(false)
    if (!r.ok) { toast.error(r.error || 'Sign failed'); return }
    toast.success('Safety Policy signed and activated')
    setEditing(null)
    reload()
  }

  if (!loaded) return <LoadingState />

  const draftToEdit = editing ?? history.find(p => p.status === 'draft') ?? null

  return (
    <div className="space-y-5 p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Link href="/sms" className="inline-flex items-center gap-1.5 text-sm text-muted-dark hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> SMS Dashboard
        </Link>
        {!draftToEdit && canWrite && (
          <button
            onClick={handleNewDraft}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-emerald-600/20 border border-emerald-600/50 text-[color:var(--color-success)] hover:bg-emerald-600/30"
          >
            <Plus className="w-4 h-4" /> New Draft
          </button>
        )}
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <FileSignature className="w-6 h-6 text-[color:var(--color-success)]" /> Safety Policy
        </h1>
        <p className="text-sm text-muted-dark">
          Required by 14 CFR §139.401. The Accountable Executive signs the policy commitment;
          it must be reviewed at least annually per AC 150/5200-37A §6.2.
        </p>
      </header>

      {/* Active policy card */}
      {active ? (
        <ActivePolicyCard policy={active} />
      ) : (
        <div className="border border-border-active rounded-lg p-5 bg-card">
          <p className="text-sm text-secondary">
            No active Safety Policy on file. The first signed policy version satisfies the
            §139.401(c)(1) requirement.
          </p>
        </div>
      )}

      {/* Draft editor */}
      {draftToEdit && (
        <DraftEditor
          policy={draftToEdit}
          onChange={(p) => setEditing(p)}
          onSave={handleSaveDraft}
          onSign={handleSign}
          canSign={canSign}
          signing={signing}
        />
      )}

      {/* Version history */}
      {history.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-secondary flex items-center gap-1.5">
            <History className="w-4 h-4" /> Version History
          </h2>
          <div className="border border-border-active rounded-lg overflow-hidden">
            {history.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 border-b border-border last:border-0 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-secondary">v{p.version}</span>
                  <StatusPill status={p.status} />
                  {p.effective_date && (
                    <span className="text-xs text-muted-darker">Effective {formatZuluDate(p.effective_date)}</span>
                  )}
                </div>
                <div className="text-xs text-muted-darker">
                  {p.signed_at ? `Signed ${formatZuluDate(p.signed_at.slice(0, 10))}` : 'Unsigned'}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function ActivePolicyCard({ policy }: { policy: SmsPolicy }) {
  return (
    <div
      className="border rounded-lg p-5 space-y-3"
      style={{
        background: 'color-mix(in srgb, var(--color-success) 10%, transparent)',
        borderColor: 'color-mix(in srgb, var(--color-success) 45%, transparent)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2" style={{ color: 'var(--color-success)' }}>
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-semibold">Active — v{policy.version}</span>
        </div>
        <div className="text-xs text-muted-dark">
          Effective {policy.effective_date ? formatZuluDate(policy.effective_date) : '—'}
          {policy.review_due_date && ` · Review due ${formatZuluDate(policy.review_due_date)}`}
        </div>
      </div>

      {policy.document_url && (
        <a
          href={policy.document_url} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
        >
          <ExternalLink className="w-4 h-4" /> View signed policy document
        </a>
      )}

      <div>
        <h3 className="text-xs uppercase tracking-wider text-muted-dark mb-1.5">Safety Objectives</h3>
        <ul className="space-y-1.5 text-sm text-foreground list-disc list-inside">
          {policy.safety_objectives.length === 0 && <li className="text-muted-darker list-none">No objectives recorded.</li>}
          {policy.safety_objectives.map((o) => (
            <li key={o.id}><span className="font-medium">{o.title}</span>{o.description ? ` — ${o.description}` : ''}</li>
          ))}
        </ul>
      </div>

      {policy.employee_reporting_pledge && (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-muted-dark mb-1.5">Employee Reporting Pledge</h3>
          <p className="text-sm text-secondary leading-relaxed whitespace-pre-wrap">{policy.employee_reporting_pledge}</p>
        </div>
      )}

      <div className="pt-2 text-xs text-muted-darker">
        IAW 14 CFR §139.401(c)(1), an AE-signed policy on file satisfies the requirement to
        establish a documented Safety Policy commitment.
      </div>
    </div>
  )
}

function DraftEditor({
  policy, onChange, onSave, onSign, canSign, signing,
}: {
  policy: SmsPolicy
  onChange: (p: SmsPolicy) => void
  onSave: () => void
  onSign: () => void
  canSign: boolean
  signing: boolean
}) {
  function setObjective(idx: number, patch: Partial<SmsSafetyObjective>) {
    const next = policy.safety_objectives.map((o, i) => (i === idx ? { ...o, ...patch } : o))
    onChange({ ...policy, safety_objectives: next })
  }
  function addObjective() {
    onChange({
      ...policy,
      safety_objectives: [...policy.safety_objectives, { id: crypto.randomUUID(), title: '', description: '' }],
    })
  }
  function removeObjective(idx: number) {
    onChange({ ...policy, safety_objectives: policy.safety_objectives.filter((_, i) => i !== idx) })
  }

  return (
    <div
      className="border rounded-lg p-5 space-y-4"
      style={{
        background: 'color-mix(in srgb, var(--color-warning) 8%, transparent)',
        borderColor: 'color-mix(in srgb, var(--color-warning) 45%, transparent)',
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-warning)' }}>
          Editing draft v{policy.version}
        </h2>
        <span className="text-xs text-muted-darker">Unsigned — won&apos;t replace the active policy until signed</span>
      </div>

      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-muted-dark">Signed Document URL <span className="text-muted-darker">(optional)</span></label>
        <input
          type="url"
          value={policy.document_url ?? ''}
          onChange={(e) => onChange({ ...policy, document_url: e.target.value || null })}
          placeholder="https://…/safety-policy-v1.pdf"
          className="w-full bg-card border border-border-active rounded px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-muted-dark">Review Due Date</label>
        <input
          type="date"
          value={policy.review_due_date ?? ''}
          onChange={(e) => onChange({ ...policy, review_due_date: e.target.value || null })}
          className="bg-card border border-border-active rounded px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs uppercase tracking-wider text-muted-dark">Safety Objectives</label>
          <button onClick={addObjective} className="text-xs px-2 py-0.5 rounded border border-border-active hover:bg-elevated text-secondary">
            <Plus className="inline w-3 h-3 mr-0.5" /> Add
          </button>
        </div>
        {policy.safety_objectives.map((o, idx) => (
          <div key={o.id} className="border border-border-active rounded p-2 space-y-1.5">
            <div className="flex gap-2">
              <input
                value={o.title}
                onChange={(e) => setObjective(idx, { title: e.target.value })}
                placeholder="Objective title"
                className="flex-1 bg-card border border-border-active rounded px-2 py-1 text-sm text-foreground"
              />
              <button onClick={() => removeObjective(idx)} className="text-xs text-[color:var(--color-danger)] hover:text-[color:var(--color-danger)] px-2">Remove</button>
            </div>
            <textarea
              value={o.description ?? ''}
              onChange={(e) => setObjective(idx, { description: e.target.value })}
              placeholder="Description (optional)"
              rows={2}
              className="w-full bg-card border border-border-active rounded px-2 py-1 text-sm text-foreground"
            />
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-muted-dark">Employee Reporting Pledge</label>
        <textarea
          value={policy.employee_reporting_pledge ?? ''}
          onChange={(e) => onChange({ ...policy, employee_reporting_pledge: e.target.value || null })}
          rows={5}
          className="w-full bg-card border border-border-active rounded px-3 py-1.5 text-sm text-foreground"
        />
        <p className="text-xs text-muted-darker">
          IAW 14 CFR §139.401(c)(2), a documented non-retribution reporting pledge satisfies the
          requirement to encourage employee safety reporting.
        </p>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onSave}
          className="px-3 py-1.5 rounded text-sm bg-accent hover:opacity-90 text-foreground"
        >
          Save Draft
        </button>
        <button
          onClick={onSign}
          disabled={!canSign || signing}
          title={canSign ? 'Sign and activate this policy' : 'Requires Accountable Executive role'}
          className="px-3 py-1.5 rounded text-sm bg-emerald-600 hover:bg-emerald-500 disabled:bg-elevated disabled:text-muted-darker text-white inline-flex items-center gap-1.5"
        >
          <FileSignature className="w-4 h-4" /> {signing ? 'Signing…' : 'Sign + Activate'}
        </button>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const palette: Record<string, { bg: string; text: string; label: string }> = {
    active:     { bg: 'rgba(34,197,94,0.15)',  text: 'rgb(21,128,61)', label: 'Active' },
    draft:      { bg: 'rgba(245,158,11,0.15)', text: 'rgb(180,83,9)', label: 'Draft' },
    superseded: { bg: 'rgba(100,116,139,0.18)', text: 'rgb(71,85,105)', label: 'Superseded' },
    retired:    { bg: 'rgba(100,116,139,0.18)', text: 'rgb(71,85,105)', label: 'Retired' },
  }
  const p = palette[status] ?? palette.draft
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider"
      style={{ backgroundColor: p.bg, color: p.text }}
    >
      {p.label}
    </span>
  )
}
