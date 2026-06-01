'use client'

import {
  CONSTRUCTION_CHECKLIST,
  type ConstructionItemStatus,
} from '@/lib/check-construction-items'
import { PfnToggle, PfnStatusPill } from '@/components/ui/pfn-toggle'

type Props = {
  /** `{ [itemId]: 'P' | 'F' | 'N/A' }`. Missing keys default to 'P'. */
  state: Record<string, ConstructionItemStatus>
  onChange: (next: Record<string, ConstructionItemStatus>) => void
  /** Read-only mode for the detail page. Renders status pills instead
   *  of toggles. */
  readOnly?: boolean
}

/**
 * 3-section FAA airfield-construction checklist. Each item has a
 * P / F / N/A segmented control (or a status pill in read-only mode).
 * Default state is P for every item — the user only flips items that
 * aren't passing.
 *
 * The actual toggle / pill controls live in `components/ui/pfn-toggle.tsx`
 * so the same visual contract is shared with `/inspections`.
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
            borderBottom: '1px solid var(--color-border-active)',
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
                    <PfnStatusPill status={current} />
                  ) : (
                    <PfnToggle
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
