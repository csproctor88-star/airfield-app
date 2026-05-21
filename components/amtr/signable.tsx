'use client'

import { Unlock } from 'lucide-react'

// Shared signable-cell used by the AMTR form tabs. Signatures lock PER
// BLOCK: once a block has initials it is final (shows the initials), and
// only NAMT/AFM can clear it via the inline reopen affordance. The rest of
// the record stays editable — there is no whole-row lock.

export function SignCell({ value, canSign, canReopenSlot, onSign, onReopen }: {
  value: string | null
  canSign: boolean
  canReopenSlot?: boolean
  onSign: () => void
  onReopen?: () => void
}) {
  if (value) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontWeight: 600 }}>{value}</span>
        {canReopenSlot && onReopen && (
          <button onClick={onReopen} title="Reopen this signature (NAMT/AFM)"
            style={{ display: 'inline-flex', alignItems: 'center', padding: 1, borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--color-text-3)', cursor: 'pointer' }}>
            <Unlock size={11} />
          </button>
        )}
      </span>
    )
  }
  if (!canSign) return <span style={{ color: 'var(--color-text-3)' }}>—</span>
  return (
    <button onClick={onSign}
      style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 5, border: '1px solid var(--color-border-mid)', background: 'transparent', color: 'var(--color-accent)', cursor: 'pointer', fontFamily: 'inherit' }}>
      Sign
    </button>
  )
}
