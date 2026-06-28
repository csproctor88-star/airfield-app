'use client'
import { useState } from 'react'
import type { WidgetConfigProps } from '@/lib/dashboard/widget-registry'

type NotesConfig = { title?: string; text?: string }

export function NotesWidget({ config }: { config: Record<string, unknown> }) {
  const c = config as NotesConfig
  if (!c.text?.trim()) {
    return (
      <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', fontStyle: 'italic' }}>
        Empty note. Edit this widget to add text.
      </div>
    )
  }
  return (
    <div style={{
      color: 'var(--color-text-1)',
      fontSize: 'var(--fs-sm)',
      lineHeight: 1.6,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}>
      {c.text}
    </div>
  )
}

export function NotesConfigForm({ config, onSave, onCancel }: WidgetConfigProps) {
  const c = config as NotesConfig
  const [title, setTitle] = useState(c.title ?? '')
  const [text, setText] = useState(c.text ?? '')

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input
        style={input}
        placeholder="Widget title (optional)"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />
      <textarea
        style={{ ...input, minHeight: 120, resize: 'vertical', lineHeight: 1.6 }}
        placeholder="Note text…"
        value={text}
        onChange={e => setText(e.target.value)}
        rows={5}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          onClick={() => onSave({ title: title.trim() || undefined, text })}
          style={{
            flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
            background: 'var(--color-accent)', color: '#fff', fontWeight: 700, fontFamily: 'inherit',
          }}
        >Save</button>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', cursor: 'pointer',
            border: '1px solid var(--color-border)', background: 'transparent',
            color: 'var(--color-text-2)', fontFamily: 'inherit',
          }}
        >Cancel</button>
      </div>
    </div>
  )
}
