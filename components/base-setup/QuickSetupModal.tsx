'use client'

import { useEffect, useState } from 'react'
import { Zap, X, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  derivePreFillFromIcao,
  saveQuickSetupDraft,
  countDraftItems,
  QUICK_SETUP_STEPS,
  QUICK_SETUP_MANUAL_STEPS,
  type QuickSetupDraft,
  type QuickSetupStepKey,
} from '@/lib/base-setup-quick-setup'

const STEP_LABELS: Record<QuickSetupStepKey, string> = {
  runways: 'Runways (from ICAO)',
  areas: 'Airfield Areas (derived from runway list)',
  navaids: 'NAVAIDs (from ICAO listing)',
  lighting: 'Lighting Systems (DAFMAN A3.1 templates)',
  templates: 'Inspection Templates (airfield + lighting defaults)',
}

const MANUAL_STEP_LABELS: Record<string, string> = {
  taxiways: 'Taxiways',
  shops: 'CE Shops & Type Mapping',
  arff: 'ARFF Vehicles',
  facilities: 'Facilities',
  shiftchecklist: 'Shift Checklist',
  qrc: 'QRC Templates',
  scnagencies: 'SCN Agencies',
  wildlife: 'Wildlife Species',
  statusboards: 'Status Boards',
  pprcolumns: 'PPR Columns',
  feedback: 'Customer Feedback',
}

export function QuickSetupModal({
  open,
  baseIcao,
  installationId,
  onClose,
  onPrefillComplete,
}: {
  open: boolean
  baseIcao: string | null
  installationId: string | null
  onClose: () => void
  onPrefillComplete: (draft: QuickSetupDraft) => void
}) {
  const [draft, setDraft] = useState<QuickSetupDraft | null>(null)
  const [loading, setLoading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !baseIcao) return
    setLoading(true)
    setError(null)
    derivePreFillFromIcao(baseIcao)
      .then((result) => {
        if (!result) {
          setError('Could not derive defaults from ICAO. Set the base ICAO and try again.')
          setDraft(null)
          return
        }
        setDraft(result)
      })
      .finally(() => setLoading(false))
  }, [open, baseIcao])

  if (!open) return null

  const startReview = async () => {
    if (!draft || !installationId) return
    setCommitting(true)
    try {
      await saveQuickSetupDraft(installationId, draft)
      toast.success('Quick Setup pre-filled — review each step before continuing')
      onPrefillComplete(draft)
      onClose()
    } catch {
      toast.error('Failed to stage Quick Setup draft')
    } finally {
      setCommitting(false)
    }
  }

  const stepCount = draft
    ? QUICK_SETUP_STEPS.filter((s) => countDraftItems(draft, s) > 0).length
    : 0

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        zIndex: 8000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          overflow: 'auto',
          background: 'var(--color-bg-surface-solid)',
          border: '1px solid color-mix(in srgb, var(--color-cyan) 30%, transparent)',
          borderRadius: 14,
          padding: 22,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'color-mix(in srgb, var(--color-cyan) 18%, transparent)',
              color: 'var(--color-cyan)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Zap size={16} />
            </span>
            <h2 style={{
              margin: 0,
              fontSize: 'var(--fs-xl)',
              fontWeight: 700,
              color: 'var(--color-text-1)',
            }}>Quick Setup</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: 4, color: 'var(--color-text-3)', borderRadius: 4,
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{
          fontSize: 'var(--fs-sm)',
          color: 'var(--color-text-2)',
          lineHeight: 1.55,
          marginBottom: 16,
        }}>
          Pre-fills sensible defaults from <strong style={{ color: 'var(--color-text-1)' }}>{baseIcao || 'this base'}</strong>{' '}
          ICAO data and DAFMAN A3.1 templates. You will review every pre-filled step before
          anything writes to your live tables — nothing commits without your explicit confirmation.
        </p>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, color: 'var(--color-text-3)' }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Looking up {baseIcao}…
          </div>
        )}

        {error && (
          <div style={{
            padding: 12,
            borderRadius: 8,
            background: 'color-mix(in srgb, var(--color-warning) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-warning) 40%, transparent)',
            color: 'var(--color-warning)',
            fontSize: 'var(--fs-sm)',
            marginBottom: 12,
          }}>
            {error}
          </div>
        )}

        {draft && (
          <>
            <div style={{
              fontSize: 'var(--fs-2xs)',
              fontWeight: 800,
              color: 'var(--color-text-3)',
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              marginBottom: 8,
            }}>
              Will pre-fill ({stepCount} steps)
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, marginBottom: 14 }}>
              {QUICK_SETUP_STEPS.map((stepKey) => {
                const count = countDraftItems(draft, stepKey)
                if (count === 0) return null
                return (
                  <li key={stepKey} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 0',
                    fontSize: 'var(--fs-sm)',
                    color: 'var(--color-text-1)',
                  }}>
                    <Check size={14} color="var(--color-success)" />
                    <span style={{ flex: 1 }}>{STEP_LABELS[stepKey]}</span>
                    <span style={{
                      fontSize: 'var(--fs-xs)',
                      color: 'var(--color-text-3)',
                      fontWeight: 600,
                    }}>{count} item{count === 1 ? '' : 's'}</span>
                  </li>
                )
              })}
            </ul>

            <div style={{
              fontSize: 'var(--fs-2xs)',
              fontWeight: 800,
              color: 'var(--color-text-3)',
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              marginBottom: 8,
            }}>
              Skipped — fill these manually
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, marginBottom: 16 }}>
              {QUICK_SETUP_MANUAL_STEPS.map((stepKey) => (
                <li key={stepKey} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 0',
                  fontSize: 'var(--fs-sm)',
                  color: 'var(--color-text-3)',
                }}>
                  <span style={{ width: 14, textAlign: 'center' }}>·</span>
                  <span>{MANUAL_STEP_LABELS[stepKey] ?? stepKey}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-inset)',
              color: 'var(--color-text-2)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >Cancel</button>
          <button
            onClick={startReview}
            disabled={!draft || committing || stepCount === 0}
            style={{
              padding: '8px 18px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--color-cyan)',
              color: 'var(--color-cyan-btn-text, #fff)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 700,
              cursor: (!draft || committing || stepCount === 0) ? 'not-allowed' : 'pointer',
              opacity: (!draft || committing || stepCount === 0) ? 0.5 : 1,
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {committing ? (
              <>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Staging…
              </>
            ) : (
              <>
                Pre-fill {stepCount} step{stepCount === 1 ? '' : 's'} & start review
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export function QuickSetupBanner({
  draft,
  stepKey,
  installationId,
  onConfirmed,
}: {
  draft: QuickSetupDraft
  stepKey: QuickSetupStepKey
  installationId: string | null
  onConfirmed: (next: QuickSetupDraft) => void
}) {
  const [committing, setCommitting] = useState(false)
  const count = countDraftItems(draft, stepKey)
  if (count === 0) return null

  const confirm = async () => {
    if (!installationId) return
    setCommitting(true)
    try {
      const { commitQuickSetupStep, clearQuickSetupStep } = await import('@/lib/base-setup-quick-setup')
      const result = await commitQuickSetupStep(installationId, draft, stepKey)
      if (!result.ok) {
        toast.error(`Failed to commit: ${result.error}`)
        return
      }
      const next = await clearQuickSetupStep(installationId, draft, stepKey)
      toast.success(`Committed ${result.count} item${result.count === 1 ? '' : 's'}`)
      onConfirmed(next)
    } finally {
      setCommitting(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 14px',
      borderRadius: 10,
      border: '1px solid color-mix(in srgb, var(--color-cyan) 35%, transparent)',
      background: 'color-mix(in srgb, var(--color-cyan) 8%, transparent)',
      marginBottom: 12,
    }}>
      <Zap size={16} color="var(--color-cyan)" />
      <div style={{ flex: 1, fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}>
        <strong style={{ color: 'var(--color-cyan)' }}>Pre-filled by Quick Setup.</strong>{' '}
        Review {count} draft item{count === 1 ? '' : 's'} below, then commit when ready.
      </div>
      <button
        onClick={confirm}
        disabled={committing}
        style={{
          padding: '6px 14px',
          borderRadius: 6,
          border: 'none',
          background: 'var(--color-cyan)',
          color: 'var(--color-cyan-btn-text, #fff)',
          fontSize: 'var(--fs-xs)',
          fontWeight: 700,
          cursor: committing ? 'wait' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {committing ? 'Committing…' : `Confirm step (${count})`}
      </button>
    </div>
  )
}
