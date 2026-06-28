'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import type { ReactNode } from 'react'
import type { DetailField, RowAction, RowActionCtx } from '@/lib/dashboard/table/types'

export function RowDetailDialog<Row>({
  row, title, fields, actions, ctx, has, onClose, onActed,
}: {
  row: Row
  title: string
  fields: DetailField<Row>[]
  actions?: RowAction<Row>[]
  ctx: RowActionCtx | null
  has: (perm: string) => boolean
  onClose: () => void
  onActed?: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const visibleActions = (actions ?? []).filter(a => has(a.permission) && (a.visible?.(row) ?? true))

  async function runAction(a: RowAction<Row>) {
    if (!ctx) { toast.error('Cannot determine the current base / user.'); return }
    setBusy(a.key)
    try {
      await a.run(row, ctx)
      onActed?.()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed.')
    } finally {
      setBusy(null)
    }
  }

  const label: React.CSSProperties = { fontSize: 'var(--fs-2xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)' }
  const value: React.CSSProperties = { fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', wordBreak: 'break-word' }

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card" style={{ width: '100%', maxWidth: 480, padding: 20, maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 12 }}>{title}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {fields.map((f, i) => {
            const v = f.value(row)
            if (f.hideWhenEmpty && (v == null || v === '')) return null
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={label}>{f.label}</span>
                <span style={value}>{(v as ReactNode) ?? '—'}</span>
              </div>
            )
          })}
        </div>
        {visibleActions.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            {visibleActions.map(a => (
              <button key={a.key} disabled={busy !== null} onClick={() => runAction(a)}
                style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', border: 'none',
                  cursor: busy ? 'default' : 'pointer', background: 'var(--color-accent)', color: '#fff',
                  fontWeight: 700, fontFamily: 'inherit', opacity: busy && busy !== a.key ? 0.6 : 1 }}>
                {busy === a.key ? '…' : a.label(row)}
              </button>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <button onClick={onClose} style={{ padding: '7px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
            border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-2)', fontFamily: 'inherit' }}>Close</button>
        </div>
      </div>
    </div>
  )
}
