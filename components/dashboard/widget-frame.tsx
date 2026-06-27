'use client'
import { Settings2, X } from 'lucide-react'
import type { ReactNode } from 'react'

export function WidgetFrame({
  title, editing, onRemove, onConfigure, children,
}: {
  title: string
  editing: boolean
  onRemove?: () => void
  onConfigure?: () => void
  children: ReactNode
}) {
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px', borderBottom: '1px solid var(--color-border)', flexShrink: 0,
      }}>
        <span style={{
          fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: 'var(--color-text-3)',
        }}>{title}</span>
        {editing && (onConfigure || onRemove) && (
          <div style={{ display: 'flex', gap: 2 }}>
            {onConfigure && (
              <button onClick={onConfigure} aria-label={`Configure ${title}`} style={{
                display: 'flex', border: 'none', background: 'transparent',
                cursor: 'pointer', color: 'var(--color-text-3)', padding: 2,
              }}>
                <Settings2 size={14} strokeWidth={2.5} />
              </button>
            )}
            {onRemove && (
              <button onClick={onRemove} aria-label={`Remove ${title}`} style={{
                display: 'flex', border: 'none', background: 'transparent',
                cursor: 'pointer', color: 'var(--color-text-3)', padding: 2,
              }}>
                <X size={14} strokeWidth={2.5} />
              </button>
            )}
          </div>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
        {children}
      </div>
    </div>
  )
}
