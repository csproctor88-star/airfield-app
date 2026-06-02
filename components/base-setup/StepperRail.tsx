'use client'

import { useEffect, useRef } from 'react'
import { Check, AlertTriangle, Ban } from 'lucide-react'
import { isStepDone, type WizardStepKey, type SetupProgress } from '@/lib/modules-config'

export type StepperStep = {
  key: WizardStepKey
  number: number
  label: string
  required: boolean
}

type StepStatus = 'complete' | 'current' | 'pending' | 'optional' | 'pending_required'

function statusOf(
  step: StepperStep,
  index: number,
  currentIndex: number,
  setupProgress: SetupProgress | null | undefined,
  touched: ReadonlySet<WizardStepKey>,
): StepStatus {
  if (index === currentIndex) return 'current'
  if (isStepDone(step.key, setupProgress)) return 'complete'
  if (!step.required) return 'optional'
  if (touched.has(step.key)) return 'pending_required'
  return 'pending'
}

const STATUS_COLOR: Record<StepStatus, string> = {
  complete: 'var(--color-success)',
  current: 'var(--color-cyan)',
  pending: 'var(--color-text-3)',
  pending_required: 'var(--color-warning)',
  optional: 'var(--color-text-4)',
}

function StatusIcon({ status }: { status: StepStatus }) {
  const color = STATUS_COLOR[status]
  if (status === 'complete') return <Check size={14} strokeWidth={3} color={color} />
  if (status === 'current') {
    return (
      <span style={{
        width: 10, height: 10, borderRadius: '50%',
        background: color,
        boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 30%, transparent)`,
      }} />
    )
  }
  if (status === 'pending_required') return <AlertTriangle size={13} color={color} />
  if (status === 'optional') return <Ban size={12} color={color} />
  return (
    <span style={{
      width: 4, height: 4, borderRadius: '50%', background: color,
    }} />
  )
}

export function StepperRail({
  steps,
  currentIndex,
  setupProgress,
  touched,
  onStepClick,
}: {
  /** Already filtered by the page (module + airport_type). The rail renders
   *  these verbatim so its index space matches the page's content. */
  steps: StepperStep[]
  currentIndex: number
  setupProgress: SetupProgress | null | undefined
  touched: ReadonlySet<WizardStepKey>
  onStepClick: (index: number) => void
}) {
  const visible = steps
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Snap mobile scroll strip to the current step on mount + when step changes.
  useEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const active = root.querySelector<HTMLButtonElement>(`[data-step-index="${currentIndex}"]`)
    if (!active) return
    active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [currentIndex])

  return (
    <div
      ref={scrollRef}
      data-tour="stepper-rail"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 6,
        padding: 8,
        marginBottom: 16,
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        background: 'var(--color-bg-surface)',
      }}
    >
      {visible.map((s, i) => {
        const status = statusOf(s, i, currentIndex, setupProgress, touched)
        const color = STATUS_COLOR[status]
        const isCurrent = status === 'current'
        return (
          <button
            key={s.key}
            data-step-index={i}
            onClick={() => onStepClick(i)}
            title={s.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 8,
              border: isCurrent
                ? `1px solid ${color}`
                : '1px solid var(--color-border)',
              background: isCurrent
                ? `color-mix(in srgb, ${color} 12%, transparent)`
                : 'var(--color-bg-inset)',
              color: isCurrent ? 'var(--color-text-1)' : 'var(--color-text-2)',
              fontSize: 'var(--fs-xs)',
              fontWeight: isCurrent ? 700 : 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
              minWidth: 0,
              transition: 'background 0.12s, border-color 0.12s',
            }}
          >
            <span style={{
              flexShrink: 0,
              width: 18,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <StatusIcon status={status} />
            </span>
            <span style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {s.label}
              {!s.required && status !== 'complete' && (
                <span style={{ color: 'var(--color-text-4)', marginLeft: 4, fontSize: 'var(--fs-2xs)' }}>
                  (opt)
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
