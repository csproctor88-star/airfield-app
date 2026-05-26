'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft, FileText, FileSignature, CheckCircle2,
  History as HistoryIcon, ExternalLink, Upload, Plus,
} from 'lucide-react'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions, PERM } from '@/lib/permissions'
import {
  fetchActivePlan,
  fetchPlanHistory,
  createPlan,
  supersedePlan,
  recordAnnualReview,
  uploadPlanDocument,
  nextAnnualReviewDue,
  type AepPlan,
} from '@/lib/supabase/aep'
import { formatZuluDate } from '@/lib/utils'
import { LoadingState } from '@/components/ui/loading-state'

/**
 * /aep/plan — Airport Emergency Plan document management.
 *
 * One active plan per base (replaced_by_id IS NULL). Uploading a new
 * version supersedes the prior active plan; history retained. The AE
 * (or any aep:sign holder) records the §139.325(d) annual review by
 * clicking "Sign Annual Review" — also stamps the initial AE sign-off
 * if the active plan is unsigned.
 */
export default function AepPlanPage() {
  const { installationId } = useInstallation()
  const { has } = usePermissions()
  const [loaded, setLoaded] = useState(false)
  const [active, setActive] = useState<AepPlan | null>(null)
  const [history, setHistory] = useState<AepPlan[]>([])
  const [editing, setEditing] = useState<DraftState | null>(null)
  const [saving, setSaving] = useState(false)

  const canWrite = has(PERM.AEP_WRITE)
  const canSign  = has(PERM.AEP_SIGN)

  const reload = useCallback(async () => {
    if (!installationId) return
    setLoaded(false)
    const [a, h] = await Promise.all([
      fetchActivePlan(installationId),
      fetchPlanHistory(installationId),
    ])
    setActive(a)
    setHistory(h)
    setLoaded(true)
  }, [installationId])

  useEffect(() => { reload() }, [reload])

  function openNewPlan() {
    setEditing({
      version: suggestNextVersion(history),
      effective_date: new Date().toISOString().slice(0, 10),
      approved_by_faa_at: '',
      faa_acceptance_ref: '',
      notes: '',
      file: null,
    })
  }

  async function handleSave() {
    if (!editing || !installationId) return
    if (!editing.version.trim() || !editing.effective_date) {
      toast.error('Version and effective date are required')
      return
    }
    setSaving(true)
    try {
      const planId = crypto.randomUUID()
      let uploadedUrl: string | null = null
      let uploadedPath: string | null = null

      if (editing.file) {
        const up = await uploadPlanDocument({
          file: editing.file,
          base_id: installationId,
          plan_id: planId,
        })
        if (!up.ok) {
          toast.error(up.error || 'Upload failed')
          setSaving(false)
          return
        }
        uploadedUrl = up.url ?? null
        uploadedPath = up.storage_path ?? null
      }

      const payload = {
        id: planId,
        base_id: installationId,
        version: editing.version.trim(),
        effective_date: editing.effective_date,
        document_url: uploadedUrl,
        storage_path: uploadedPath,
        approved_by_faa_at: editing.approved_by_faa_at || null,
        faa_acceptance_ref: editing.faa_acceptance_ref.trim() || null,
        notes: editing.notes.trim() || null,
      }

      const res = active
        ? await supersedePlan(active.id, payload)
        : await createPlan(payload)

      if (!res.ok) {
        toast.error(res.error || 'Save failed')
        setSaving(false)
        return
      }

      toast.success(active ? 'Plan superseded' : 'AEP plan created')
      setEditing(null)
      reload()
    } finally {
      setSaving(false)
    }
  }

  async function handleSignReview() {
    if (!active || !installationId) return
    if (!canSign) {
      toast.error('Annual review requires the AEP sign permission (AE / Ops Manager)')
      return
    }
    const notes = window.prompt('Optional review notes (or leave blank):') ?? null
    const res = await recordAnnualReview({
      planId: active.id,
      baseId: installationId,
      notes: notes?.trim() || null,
    })
    if (!res.ok) {
      toast.error(res.error || 'Sign failed')
      return
    }
    toast.success(active.ae_signed_at ? 'Annual review recorded' : 'Plan signed + reviewed')
    reload()
  }

  if (!loaded) return <LoadingState />

  return (
    <div className="page-container" style={{ maxWidth: 900 }}>
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
          <FileText size={22} color="var(--color-warning)" />
          <div>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>AEP Document</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 2 }}>
              14 CFR §139.325(a-d) — versioned plan with FAA acceptance + AE annual review
            </div>
          </div>
        </div>
        {!editing && canWrite && (
          <button onClick={openNewPlan} style={primaryBtnStyle}>
            <Plus size={14} style={{ marginRight: 4 }} />
            {active ? 'Upload New Version' : 'Create First Plan'}
          </button>
        )}
      </div>

      {active && !editing && (
        <ActivePlanCard plan={active} canSign={canSign} onSign={handleSignReview} />
      )}

      {!active && !editing && (
        <EmptyPlanCard />
      )}

      {editing && (
        <DraftEditor
          state={editing}
          isSupersede={!!active}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {history.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 'var(--fs-sm)', fontWeight: 700,
            color: 'var(--color-text-2)', marginBottom: 8,
          }}>
            <HistoryIcon size={14} /> Plan History
          </h2>
          <div style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}>
            {history.map(p => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 10, padding: '10px 14px',
                borderBottom: '1px solid var(--color-border)',
                fontSize: 'var(--fs-sm)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'monospace', color: 'var(--color-text-2)' }}>v{p.version}</span>
                  {p.replaced_by_id === null && <StatusPill kind="active" />}
                  {p.replaced_by_id !== null && <StatusPill kind="superseded" />}
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
                    Effective {formatZuluDate(p.effective_date)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {p.document_url && (
                    <a href={p.document_url} target="_blank" rel="noreferrer"
                       style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-accent)', fontSize: 'var(--fs-xs)' }}>
                      <ExternalLink size={12} /> PDF
                    </a>
                  )}
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)' }}>
                    {p.ae_signed_at ? `Signed ${formatZuluDate(p.ae_signed_at.slice(0, 10))}` : 'Unsigned'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Active plan card
// ────────────────────────────────────────────────────────────────

function ActivePlanCard({ plan, canSign, onSign }: {
  plan: AepPlan
  canSign: boolean
  onSign: () => void
}) {
  const review = nextAnnualReviewDue(plan)
  const reviewColor =
    review.status === 'overdue' ? 'var(--color-danger)' :
    review.status === 'due_soon' ? 'var(--color-warning)' :
    'var(--color-success)'

  return (
    <div style={{
      padding: 18,
      borderRadius: 'var(--radius-md)',
      background: 'color-mix(in srgb, var(--color-success) 8%, transparent)',
      border: '1px solid color-mix(in srgb, var(--color-success) 35%, transparent)',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-success)' }}>
          <CheckCircle2 size={20} />
          <span style={{ fontWeight: 700 }}>Active — v{plan.version}</span>
        </div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
          Effective {formatZuluDate(plan.effective_date)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <Field label="FAA Acceptance">
          {plan.approved_by_faa_at
            ? `${formatZuluDate(plan.approved_by_faa_at)}${plan.faa_acceptance_ref ? ` · ${plan.faa_acceptance_ref}` : ''}`
            : <span style={{ color: 'var(--color-text-4)' }}>Not recorded</span>}
        </Field>
        <Field label="AE Sign-off">
          {plan.ae_signed_at
            ? `Signed ${formatZuluDate(plan.ae_signed_at.slice(0, 10))}`
            : <span style={{ color: 'var(--color-warning)' }}>Awaiting AE signature</span>}
        </Field>
        <Field label="Annual Review">
          {review.date && review.daysOut !== null ? (
            <span style={{ color: reviewColor }}>
              {review.status === 'overdue'
                ? `Overdue by ${Math.abs(review.daysOut)} days`
                : `Due ${formatZuluDate(review.date.toISOString().slice(0, 10))} (${review.daysOut} days)`}
            </span>
          ) : <span style={{ color: 'var(--color-text-4)' }}>—</span>}
        </Field>
      </div>

      {plan.document_url && (
        <a href={plan.document_url} target="_blank" rel="noreferrer"
           style={{
             display: 'inline-flex', alignItems: 'center', gap: 6,
             fontSize: 'var(--fs-sm)', color: 'var(--color-accent)',
             textDecoration: 'none',
           }}>
          <ExternalLink size={14} /> View signed AEP document
        </a>
      )}

      {plan.review_notes && (
        <div>
          <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--color-text-3)', marginBottom: 4 }}>Last Review Notes</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', whiteSpace: 'pre-wrap' }}>{plan.review_notes}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
        <button
          onClick={onSign}
          disabled={!canSign}
          title={canSign ? '' : 'Annual review requires the AEP sign permission (AE / Ops Manager)'}
          style={canSign ? primaryBtnStyle : disabledBtnStyle}
        >
          <FileSignature size={14} style={{ marginRight: 4 }} />
          {plan.ae_signed_at ? 'Record Annual Review' : 'Sign + Activate'}
        </button>
      </div>

      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', paddingTop: 4 }}>
        IAW 14 CFR §139.325(d), an annual review recorded here satisfies the requirement to maintain a current Airport Emergency Plan on file.
      </div>
    </div>
  )
}

function EmptyPlanCard() {
  return (
    <div style={{
      padding: 18,
      borderRadius: 'var(--radius-md)',
      background: 'color-mix(in srgb, var(--color-warning) 6%, transparent)',
      border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)',
      color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)', lineHeight: 1.5,
    }}>
      No AEP document on file. Upload your first version to satisfy <strong>14 CFR §139.325(a)</strong>. Subsequent revisions supersede automatically and the prior version is retained for audit history.
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--color-text-3)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}>{children}</div>
    </div>
  )
}

function StatusPill({ kind }: { kind: 'active' | 'superseded' }) {
  const palette = kind === 'active'
    ? { bg: 'rgba(34,197,94,0.18)', text: 'rgb(21,128,61)', label: 'Active' }
    : { bg: 'rgba(100,116,139,0.18)', text: 'rgb(71,85,105)', label: 'Superseded' }
  return (
    <span style={{
      backgroundColor: palette.bg, color: palette.text,
      fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
      padding: '2px 6px', borderRadius: 3, letterSpacing: 0.5,
    }}>{palette.label}</span>
  )
}

// ────────────────────────────────────────────────────────────────
// Draft editor
// ────────────────────────────────────────────────────────────────

type DraftState = {
  version: string
  effective_date: string
  approved_by_faa_at: string
  faa_acceptance_ref: string
  notes: string
  file: File | null
}

function DraftEditor({
  state, isSupersede, onChange, onCancel, onSave, saving,
}: {
  state: DraftState
  isSupersede: boolean
  onChange: (s: DraftState) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
}) {
  return (
    <div style={{
      padding: 18,
      borderRadius: 'var(--radius-md)',
      background: 'color-mix(in srgb, var(--color-warning) 8%, transparent)',
      border: '1px solid color-mix(in srgb, var(--color-warning) 40%, transparent)',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-warning)' }}>
          {isSupersede ? 'New Version (supersedes active)' : 'First Plan'}
        </div>
        <button onClick={onCancel} style={cancelBtnStyle}>Cancel</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <Input label="Version" required value={state.version}
               onChange={v => onChange({ ...state, version: v })}
               placeholder="2026.1" />
        <Input label="Effective Date" required type="date" value={state.effective_date}
               onChange={v => onChange({ ...state, effective_date: v })} />
        <Input label="FAA Acceptance Date" type="date" value={state.approved_by_faa_at}
               onChange={v => onChange({ ...state, approved_by_faa_at: v })} />
        <Input label="FAA Acceptance Reference" value={state.faa_acceptance_ref}
               onChange={v => onChange({ ...state, faa_acceptance_ref: v })}
               placeholder="ATL-AEP-2026-04 / email reference" />
      </div>

      <Field label="Plan Document (PDF)">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={fileBtnStyle}>
            <Upload size={14} style={{ marginRight: 4 }} />
            {state.file ? state.file.name : 'Choose PDF…'}
            <input
              type="file"
              accept="application/pdf,.pdf"
              style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0] ?? null
                onChange({ ...state, file: f })
              }}
            />
          </label>
          {state.file && (
            <button onClick={() => onChange({ ...state, file: null })}
                    style={{ ...cancelBtnStyle, padding: '4px 8px' }}>Clear</button>
          )}
        </div>
        <div style={{ marginTop: 4, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
          Stored under <code>aep-plans/&lt;base&gt;/&lt;plan&gt;/...</code> in the photos bucket.
        </div>
      </Field>

      <Field label="Notes">
        <textarea
          value={state.notes}
          onChange={e => onChange({ ...state, notes: e.target.value })}
          rows={3}
          placeholder="e.g. Updated to add Mercy Hospital ER as backup trauma center; AE briefed on 2026-04-12."
          style={textareaStyle}
        />
      </Field>

      <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
        <button onClick={onSave} disabled={saving} style={saving ? disabledBtnStyle : primaryBtnStyle}>
          {saving ? 'Saving…' : isSupersede ? 'Supersede Active Plan' : 'Create Plan'}
        </button>
      </div>

      {isSupersede && (
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>
          Saving will set the prior active plan&apos;s <code>replaced_by_id</code> to this new version. The prior plan stays in the history list.
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Bits
// ────────────────────────────────────────────────────────────────

function Input({
  label, value, onChange, required, type = 'text', placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  type?: string
  placeholder?: string
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--color-text-3)', marginBottom: 4 }}>
        {label}{required && <span style={{ color: 'var(--color-warning)' }}> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  )
}

/** "2026.1" → "2026.2"; "v3" → "v4"; anything else → "<old>-rev". */
function suggestNextVersion(history: AepPlan[]): string {
  if (history.length === 0) return new Date().getUTCFullYear() + '.1'
  const last = history[0].version
  const dot = last.match(/^(.+?\.)(\d+)$/)
  if (dot) return `${dot[1]}${parseInt(dot[2], 10) + 1}`
  const v = last.match(/^v(\d+)$/i)
  if (v) return `v${parseInt(v[1], 10) + 1}`
  return `${last}-rev`
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-inset)',
  color: 'var(--color-text-1)',
  fontSize: 'var(--fs-sm)',
  fontFamily: 'inherit',
}

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
}

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  padding: '6px 14px', borderRadius: 'var(--radius-sm)',
  border: '1px solid color-mix(in srgb, var(--color-warning) 50%, transparent)',
  background: 'color-mix(in srgb, var(--color-warning) 20%, transparent)',
  color: 'rgb(180,83,9)',
  fontSize: 'var(--fs-sm)', fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
}

const disabledBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  opacity: 0.5, cursor: 'not-allowed',
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'transparent',
  color: 'var(--color-text-3)',
  fontSize: 'var(--fs-xs)', cursor: 'pointer', fontFamily: 'inherit',
}

const fileBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  padding: '6px 12px', borderRadius: 'var(--radius-sm)',
  border: '1px dashed var(--color-border)',
  background: 'var(--color-bg-inset)',
  color: 'var(--color-text-2)', fontSize: 'var(--fs-sm)',
  cursor: 'pointer', fontFamily: 'inherit',
}
