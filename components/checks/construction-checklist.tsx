'use client'

import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react'
import {
  CONSTRUCTION_CHECKLIST,
  CONSTRUCTION_ITEM_STATUSES,
  type ConstructionItemStatus,
} from '@/lib/check-construction-items'

type Props = {
  /** `{ [itemId]: 'P' | 'F' | 'N/A' }`. Missing keys default to 'P'. */
  state: Record<string, ConstructionItemStatus>
  onChange: (next: Record<string, ConstructionItemStatus>) => void
  /** Read-only mode for the detail page. Renders status pills instead
   *  of toggles. */
  readOnly?: boolean
}

const TIER = {
  P:    { color: 'var(--color-success)', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.40)',  Icon: CheckCircle2 },
  F:    { color: 'var(--color-danger)',  bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.40)',  Icon: XCircle      },
  'N/A': { color: 'var(--color-text-3)', bg: 'transparent',           border: 'var(--color-border)',   Icon: MinusCircle  },
} as const

/**
 * 3-section FAA airfield-construction checklist. Each item has a
 * P / F / N/A segmented control (or a status pill in read-only mode).
 * Default state is P for every item — the user only flips items that
 * aren't passing.
 */
export function ConstructionChecklist({ state, onChange, readOnly = false }: Props) {
  const set = (id: string, next: ConstructionItemStatus) => {
    onChange({ ...state, [id]: next })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {CONSTRUCTION_CHECKLIST.map((section) => (
        <div key={section.id}>
          <div style={{
            fontSize: 'var(--fs-xs)', fontWeight: 700,
            color: 'var(--color-text-3)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            paddingBottom: 6, marginBottom: 10,
            borderBottom: '1px solid rgba(56,189,248,0.20)',
          }}>
            {section.title}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {section.items.map((item) => {
              const current = state[item.id] ?? 'P'
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-bg-inset)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <span style={{
                    flex: 1,
                    fontSize: 'var(--fs-sm)',
                    color: 'var(--color-text-1)',
                    lineHeight: 1.45,
                  }}>
                    {item.label}
                  </span>

                  {readOnly ? (
                    <StatusPill status={current} />
                  ) : (
                    <SegmentedToggle
                      value={current}
                      onChange={(next) => set(item.id, next)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function SegmentedToggle({
  value,
  onChange,
}: {
  value: ConstructionItemStatus
  onChange: (next: ConstructionItemStatus) => void
}) {
  return (
    <div style={{
      display: 'inline-flex',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--color-border)',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {CONSTRUCTION_ITEM_STATUSES.map((opt, i) => {
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

function StatusPill({ status }: { status: ConstructionItemStatus }) {
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
