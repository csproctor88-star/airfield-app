'use client'

import { CheckCircle2, XCircle, MinusCircle, type LucideIcon } from 'lucide-react'

/**
 * Pass / Fail / N/A — three-button segmented toggle used by safety
 * audit forms (Construction Check, Daily Airfield Inspection, Daily
 * Lighting Inspection). Default state is 'P'; the user only flips
 * items that aren't passing.
 *
 * Extracted from `components/checks/construction-checklist.tsx` so
 * Construction Check and Inspections share one visual contract.
 *
 * `aria-pressed` per button gives screen readers the toggle state.
 * Internal 1px dividers join the three buttons edge-to-edge so the
 * group reads as one widget at ~114px wide.
 */
export type PfnStatus = 'P' | 'F' | 'N/A'

export const PFN_STATUSES: PfnStatus[] = ['P', 'F', 'N/A']

const TIER: Record<PfnStatus, { color: string; bg: string; border: string; Icon: LucideIcon }> = {
  P:    { color: 'var(--color-success)', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.40)',  Icon: CheckCircle2 },
  F:    { color: 'var(--color-danger)',  bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.40)',  Icon: XCircle      },
  'N/A': { color: 'var(--color-text-3)', bg: 'transparent',           border: 'var(--color-border)',   Icon: MinusCircle  },
}

export function PfnToggle({
  value,
  onChange,
}: {
  value: PfnStatus
  onChange: (next: PfnStatus) => void
}) {
  return (
    <div style={{
      display: 'inline-flex',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--color-border)',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {PFN_STATUSES.map((opt, i) => {
        const selected = value === opt
        const tier = TIER[opt]
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-pressed={selected}
            style={{
              padding: '6px 10px',
              border: 'none',
              borderLeft: i === 0 ? 'none' : '1px solid var(--color-border)',
              background: selected ? tier.bg : 'var(--color-bg)',
              color: selected ? tier.color : 'var(--color-text-3)',
              fontSize: 'var(--fs-xs)', fontWeight: 700,
              fontFamily: 'inherit',
              minWidth: 38,
              cursor: 'pointer',
              letterSpacing: '0.04em',
            }}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

/** Read-only pill counterpart used by detail views. */
export function PfnStatusPill({ status }: { status: PfnStatus }) {
  const tier = TIER[status]
  const Icon = tier.Icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 12,
      background: tier.bg, color: tier.color,
      border: `1px solid ${tier.border}`,
      fontSize: 'var(--fs-2xs)', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.06em',
      flexShrink: 0,
    }}>
      <Icon size={11} />
      {status}
    </span>
  )
}
