'use client'
import { useState } from 'react'
import type { WidgetConfigProps } from '@/lib/dashboard/widget-registry'

/** One-field rename form attached to native widgets that have no richer config. */
export function TitleConfigForm({ config, onSave, onCancel }: WidgetConfigProps) {
  const [title, setTitle] = useState((config.title as string) ?? '')
  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input style={input} placeholder="Widget title (optional)" value={title}
        onChange={e => setTitle(e.target.value)} />
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={() => onSave({ ...config, title: title.trim() || undefined })}
          style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
            background: 'var(--color-accent)', color: '#fff', fontWeight: 700, fontFamily: 'inherit' }}>Save</button>
        <button onClick={onCancel}
          style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', cursor: 'pointer',
            border: '1px solid var(--color-border)', background: 'transparent',
            color: 'var(--color-text-2)', fontFamily: 'inherit' }}>Cancel</button>
      </div>
    </div>
  )
}
