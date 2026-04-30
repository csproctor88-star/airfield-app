'use client'

import { Check, Minus } from 'lucide-react'
import type { QrcStepStatus } from '@/lib/qrc-step-status'

/**
 * QRC step toggle — Done / N/A two-button segmented control.
 * Mirrors PfnToggle's visual contract but with a nullable state model:
 * neither button selected = step is incomplete (the default).
 * Click a selected button again to clear back to incomplete.
 *
 * Used for `checkbox` / `checkbox_with_note` step types and per-agency
 * inside `notify_agencies` steps. Auditors can now distinguish "not yet
 * done" from "intentionally not applicable" — see lib/qrc-step-status.ts.
 */

const TIER = {
  completed: {
    color: 'var(--color-success)',
    bg: 'color-mix(in srgb, var(--color-success) 12%, var(--color-bg-surface))',
    border: 'color-mix(in srgb, var(--color-success) 40%, transparent)',
  },
  not_applicable: {
    color: 'var(--color-text-3)',
    bg: 'color-mix(in srgb, var(--color-text-3) 10%, var(--color-bg-surface))',
    border: 'var(--color-border-mid)',
  },
} as const

export function QrcStepToggle({
  value,
  onChange,
  disabled,
  size = 'md',
}: {
  value: QrcStepStatus
  onChange: (next: QrcStepStatus) => void
  disabled?: boolean
  size?: 'sm' | 'md'
}) {
  const isSm = size === 'sm'
  const padding = isSm ? '4px 8px' : '6px 10px'
  const fontSize = isSm ? 'var(--fs-2xs)' : 'var(--fs-xs)'
  const minWidth = isSm ? 38 : 48
  const iconSize = isSm ? 11 : 13

  function clickHandler(target: 'completed' | 'not_applicable') {
    if (disabled) return
    onChange(value === target ? undefined : target)
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
        flexShrink: 0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <button
        type="button"
        onClick={() => clickHandler('completed')}
        aria-pressed={value === 'completed'}
        disabled={disabled}
        style={{
          padding,
          border: 'none',
          background: value === 'completed' ? TIER.completed.bg : 'var(--color-bg)',
          color: value === 'completed' ? TIER.completed.color : 'var(--color-text-3)',
          fontSize,
          fontWeight: 700,
          fontFamily: 'inherit',
          minWidth,
          cursor: disabled ? 'default' : 'pointer',
          letterSpacing: '0.04em',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <Check size={iconSize} />
        DONE
      </button>
      <button
        type="button"
        onClick={() => clickHandler('not_applicable')}
        aria-pressed={value === 'not_applicable'}
        disabled={disabled}
        style={{
          padding,
          border: 'none',
          borderLeft: '1px solid var(--color-border)',
          background: value === 'not_applicable' ? TIER.not_applicable.bg : 'var(--color-bg)',
          color: value === 'not_applicable' ? TIER.not_applicable.color : 'var(--color-text-3)',
          fontSize,
          fontWeight: 700,
          fontFamily: 'inherit',
          minWidth,
          cursor: disabled ? 'default' : 'pointer',
          letterSpacing: '0.04em',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        <Minus size={iconSize} />
        N/A
      </button>
    </div>
  )
}

/** Read-only pill counterpart for closed QRCs / detail views. */
export function QrcStepStatusPill({ status }: { status: QrcStepStatus }) {
  if (!status) return null
  const tier = TIER[status]
  const Icon = status === 'completed' ? Check : Minus
  const label = status === 'completed' ? 'DONE' : 'N/A'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 12,
        background: tier.bg,
        color: tier.color,
        border: `1px solid ${tier.border}`,
        fontSize: 'var(--fs-2xs)',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        flexShrink: 0,
      }}
    >
      <Icon size={11} />
      {label}
    </span>
  )
}
