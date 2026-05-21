'use client'

import { Lock, Unlock } from 'lucide-react'

// Shared signable-cell + lock affordances used by the AMTR form tabs.

export function SignCell({ value, canSign, locked, onSign }: {
  value: string | null; canSign: boolean; locked: boolean; onSign: () => void
}) {
  if (value) return <span style={{ fontWeight: 600 }}>{value}</span>
  if (locked || !canSign) return <span style={{ color: 'var(--color-text-3)' }}>—</span>
  return (
    <button onClick={onSign}
      style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 5, border: '1px solid var(--color-border-mid)', background: 'transparent', color: 'var(--color-accent)', cursor: 'pointer', fontFamily: 'inherit' }}>
      Sign
    </button>
  )
}

export function LockTag() {
  return <Lock size={13} style={{ color: 'var(--color-text-3)' }} />
}

export function ReopenButton({ onReopen }: { onReopen: () => void }) {
  return (
    <button onClick={onReopen} title="Reopen (NAMT/AFM)"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-xs)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--color-border-mid)', background: 'transparent', color: 'var(--color-text-3)', cursor: 'pointer', fontFamily: 'inherit' }}>
      <Unlock size={11} /> Reopen
    </button>
  )
}
