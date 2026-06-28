'use client'
import { useState } from 'react'
import type { WidgetProps, WidgetConfigProps } from '@/lib/dashboard/widget-registry'

type NotesConfig = { title?: string; text?: string }

export function NotesWidget({ config, onConfigChange }: WidgetProps) {
  const c = config as NotesConfig
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  function handleSave() {
    const existing = c.text?.trim() ?? ''
    const appended = draft.trim()
    if (!appended) { setAdding(false); setDraft(''); return }
    const newText = existing ? `${existing}\n${appended}` : appended
    onConfigChange?.({ ...config, text: newText })
    setAdding(false)
    setDraft('')
  }

  function handleCancel() {
    setAdding(false)
    setDraft('')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '6px 8px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-input, var(--color-bg-surface))',
    color: 'var(--color-text-1)',
    fontSize: 'var(--fs-sm)',
    fontFamily: 'inherit',
    resize: 'vertical',
    lineHeight: 1.5,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
      {/* Note text */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {!c.text?.trim() && !adding ? (
          <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', fontStyle: 'italic' }}>
            Empty note. Use the ＋ button below or the gear to add text.
          </div>
        ) : (
          <div style={{
            color: 'var(--color-text-1)',
            fontSize: 'var(--fs-sm)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {c.text}
          </div>
        )}
      </div>

      {/* Inline add area */}
      {adding ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <textarea
            autoFocus
            rows={3}
            style={inputStyle}
            placeholder="Add a note…"
            value={draft}
            onChange={e => setDraft(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleSave}
              style={{
                flex: 1,
                padding: '5px 0',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                background: 'var(--color-accent)',
                color: '#fff',
                fontWeight: 700,
                fontFamily: 'inherit',
                fontSize: 'var(--fs-xs)',
              }}
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              style={{
                flex: 1,
                padding: '5px 0',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
                background: 'transparent',
                color: 'var(--color-text-2)',
                fontFamily: 'inherit',
                fontSize: 'var(--fs-xs)',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            alignSelf: 'flex-start',
            padding: '3px 8px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
            background: 'transparent',
            color: 'var(--color-text-3)',
            fontFamily: 'inherit',
            fontSize: 'var(--fs-xs)',
          }}
        >
          ＋ Add note
        </button>
      )}
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
