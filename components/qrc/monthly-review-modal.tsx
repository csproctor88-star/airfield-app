'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, X, AlertCircle, Calendar, ClipboardCheck } from 'lucide-react'
import { formatZuluDate } from '@/lib/utils'
import type { QrcStep, QrcTemplate } from '@/lib/supabase/types'
import type { MonthlyReviewStatus, ReviewInterval } from '@/lib/qrc/monthly-review-status'

interface Props {
  template: QrcTemplate
  status: MonthlyReviewStatus
  interval?: ReviewInterval
  onClose: () => void
  /** Resolves with { error: string | null }. Caller persists. */
  onMarkReviewed: (templateId: string, note: string) => Promise<{ error: string | null }>
}

/**
 * Read-only review modal. Shows the QRC content + an amber banner when the
 * template was edited since the user's last review, captures an optional
 * note, then calls onMarkReviewed which persists via the parent's hook.
 */
export function MonthlyReviewModal({ template, status, interval = 'monthly', onClose, onMarkReviewed }: Props) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const intervalLabel = interval === 'quarterly' ? 'Quarterly Review' : 'Monthly Review'

  const steps = (template.steps as unknown as QrcStep[] | null) || []

  async function handleConfirm() {
    setSaving(true)
    const { error } = await onMarkReviewed(template.id, note)
    setSaving(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success(`QRC-${template.qrc_number} marked as reviewed`)
    onClose()
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ padding: 24, zIndex: 10000 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-bg-surface-solid, #1E293B)',
          borderRadius: 'var(--radius-lg)',
          width: '100%', maxWidth: 720, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          border: '1px solid var(--color-border-mid)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '18px 22px 14px',
          background: 'linear-gradient(135deg, rgba(217,119,6,0.12), rgba(217,119,6,0.02))',
          borderBottom: '1px solid var(--color-border-mid)',
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'rgba(217,119,6,0.18)', border: '1px solid rgba(217,119,6,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-amber)', flexShrink: 0,
          }}>
            <ClipboardCheck size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-amber)',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
            }}>QRC-{template.qrc_number} · {intervalLabel}</div>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--color-text-1)', lineHeight: 1.2 }}>
              {template.title}
            </div>
            <div style={{
              fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 6,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <Calendar size={11} />
              {status.reviewedAt
                ? `Last reviewed: ${formatZuluDate(new Date(status.reviewedAt))}${status.daysSinceReview != null ? ` (${status.daysSinceReview}d ago)` : ''}`
                : 'Never reviewed'}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            title="Close"
            style={{
              width: 34, height: 34, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: '1px solid var(--color-border)',
              color: 'var(--color-text-3)', cursor: saving ? 'default' : 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
          {/* Updated banner — outlined-pill recipe per feedback_amber_text_contrast.md */}
          {status.templateUpdatedSince && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: 14,
              background: 'color-mix(in srgb, var(--color-amber) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-amber) 45%, transparent)',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <AlertCircle size={16} color="var(--color-amber)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-amber)', fontWeight: 600 }}>
                This QRC was edited{' '}
                {template.updated_at
                  ? formatZuluDate(new Date(template.updated_at))
                  : 'recently'}
                {' '}since your last review. Review the steps below to confirm the changes.
              </div>
            </div>
          )}

          {/* Warning notes from the template */}
          {template.notes && (
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: 14,
              background: 'color-mix(in srgb, var(--color-danger) 6%, var(--color-bg-surface))',
              borderLeft: '3px solid var(--color-danger)',
              border: '1px solid color-mix(in srgb, var(--color-danger) 22%, transparent)',
              fontSize: 'var(--fs-sm)', color: 'var(--color-danger)', fontWeight: 600,
            }}>
              {template.notes}
            </div>
          )}

          {template.references && (
            <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-4)', marginBottom: 14 }}>
              Ref: {template.references}
            </div>
          )}

          {/* Read-only steps */}
          <div style={{ marginBottom: 14 }}>
            {steps.map(step => <ReadOnlyStep key={step.id} step={step} />)}
          </div>

          {/* Optional notes */}
          <label style={{
            fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-3)',
            textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6,
          }}>Review notes (optional)</label>
          <textarea
            className="input-dark"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. read & understood; no questions; flagged step 7 for re-training"
            rows={2}
            style={{ width: '100%', fontSize: 'var(--fs-sm)', resize: 'vertical' }}
          />
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px',
          borderTop: '1px solid var(--color-border-mid)',
          display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center',
          background: 'var(--color-bg-inset)',
        }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '9px 18px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'transparent', color: 'var(--color-text-2)', fontWeight: 700,
              fontSize: 'var(--fs-sm)', cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
            }}
          >Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            style={{
              padding: '9px 20px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-amber)',
              background: 'color-mix(in srgb, var(--color-amber) 12%, transparent)',
              color: 'var(--color-amber)', fontSize: 'var(--fs-sm)', fontWeight: 700,
              cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
              opacity: saving ? 0.6 : 1,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <CheckCircle2 size={14} />
            {saving ? 'Saving…' : 'Mark as Reviewed'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Read-only step renderer — covers the eight QrcStepType values
// without the response/toggle interaction in the execution view.
// ─────────────────────────────────────────────────────────────

function ReadOnlyStep({ step, depth = 0 }: { step: QrcStep; depth?: number }) {
  const indent = depth * 24
  return (
    <div style={{ marginLeft: indent, marginTop: depth > 0 ? 6 : 0, marginBottom: 8 }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
        borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
        background: 'transparent',
      }}>
        <span style={{
          fontSize: 'var(--fs-base)', fontWeight: 800, color: 'var(--color-text-3)',
          minWidth: 30, flexShrink: 0, paddingTop: 1,
        }}>{step.id}.</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {(step.type === 'checkbox' || step.type === 'checkbox_with_note') && (
            <div>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--color-text-1)' }}>
                {step.label}
              </div>
              {step.note && (
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 4, fontStyle: 'italic' }}>
                  {step.note}
                </div>
              )}
            </div>
          )}

          {step.type === 'notify_agencies' && (
            <div>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 6 }}>
                {step.label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {(step.agencies || []).map(a => (
                  <div key={a} style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>· {a}</div>
                ))}
              </div>
            </div>
          )}

          {(step.type === 'fill_field' || step.type === 'time_field') && (
            <div>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--color-text-1)' }}>
                {step.label}
              </div>
              {step.field_label && (
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)', marginTop: 3 }}>
                  Field: {step.field_label}
                </div>
              )}
            </div>
          )}

          {step.type === 'conditional' && (
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--color-warning)', fontStyle: 'italic' }}>
              {step.label}
            </div>
          )}

          {step.type === 'text' && (
            <div style={{
              fontSize: 'var(--fs-md)', color: 'var(--color-text-2)',
              padding: '6px 10px', background: 'var(--color-bg-inset)',
              borderLeft: '3px solid var(--color-cyan)', borderRadius: 4,
            }}>{step.label}</div>
          )}

          {step.type === 'textarea' && (
            <div style={{
              fontSize: 'var(--fs-md)', color: 'var(--color-text-2)', whiteSpace: 'pre-wrap',
              padding: '10px 12px', background: 'var(--color-bg-inset)',
              borderLeft: '3px solid var(--color-cyan)', borderRadius: 4,
              lineHeight: 1.5,
            }}>{step.label}</div>
          )}
        </div>
      </div>
      {step.sub_steps?.map(sub => <ReadOnlyStep key={sub.id} step={sub} depth={depth + 1} />)}
    </div>
  )
}
