'use client'
import { useState } from 'react'
import { X } from 'lucide-react'
import type { WidgetProps, WidgetConfigProps } from '@/lib/dashboard/widget-registry'

type NoteEntry = { text: string; at?: string }
type NotesConfig = { title?: string; text?: string; notes?: NoteEntry[] }

/** Notes used to be a single newline-joined `text` blob. Read structured
 *  `notes` when present, else split the legacy blob into one entry per line. */
function deriveNotes(c: NotesConfig): NoteEntry[] {
  if (Array.isArray(c.notes)) return c.notes
  const t = c.text?.trim()
  if (!t) return []
  return t.split('\n').map(s => s.trim()).filter(Boolean).map(text => ({ text }))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function noteStamp(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${p(d.getUTCHours())}${p(d.getUTCMinutes())}Z`
}

export function NotesWidget({ config, onConfigChange }: WidgetProps) {
  const c = config as NotesConfig
  const notes = deriveNotes(c)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')

  function handleSave() {
    const appended = draft.trim()
    if (!appended) { setAdding(false); setDraft(''); return }
    const next: NoteEntry[] = [...notes, { text: appended, at: new Date().toISOString() }]
    onConfigChange?.({ ...config, notes: next, text: undefined })
    setAdding(false)
    setDraft('')
  }

  function handleCancel() {
    setAdding(false)
    setDraft('')
  }

  function removeNote(i: number) {
    const next = notes.filter((_, j) => j !== i)
    onConfigChange?.({ ...config, notes: next, text: undefined })
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
      {/* Notes list — zebra-shaded rows, each with its own timestamp */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {notes.length === 0 && !adding ? (
          <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', fontStyle: 'italic' }}>
            Empty note. Use the ＋ button below or the gear to add text.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {notes.map((n, i) => (
              <div key={i} style={{
                position: 'relative',
                padding: '6px 22px 6px 8px',
                borderRadius: 'var(--radius-sm)',
                background: i % 2 === 1 ? 'color-mix(in srgb, var(--color-text-1) 5%, transparent)' : 'transparent',
              }}>
                <div style={{
                  color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>{n.text}</div>
                {n.at && (
                  <div style={{
                    marginTop: 2, fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)',
                    fontFamily: 'var(--font-mono, ui-monospace, monospace)', letterSpacing: '0.03em',
                  }}>{noteStamp(n.at)}</div>
                )}
                <button
                  onClick={() => removeNote(i)}
                  aria-label="Remove note"
                  style={{
                    position: 'absolute', top: 5, right: 5,
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    color: 'var(--color-text-3)', padding: 0, lineHeight: 0,
                  }}
                ><X size={12} /></button>
              </div>
            ))}
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
                flex: 1, padding: '5px 0', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                background: 'var(--color-accent)', color: '#fff', fontWeight: 700, fontFamily: 'inherit', fontSize: 'var(--fs-xs)',
              }}
            >Save</button>
            <button
              onClick={handleCancel}
              style={{
                flex: 1, padding: '5px 0', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', cursor: 'pointer',
                background: 'transparent', color: 'var(--color-text-2)', fontFamily: 'inherit', fontSize: 'var(--fs-xs)',
              }}
            >Cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            alignSelf: 'flex-start', padding: '3px 8px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)', cursor: 'pointer',
            background: 'transparent', color: 'var(--color-text-3)', fontFamily: 'inherit', fontSize: 'var(--fs-xs)',
          }}
        >＋ Add note</button>
      )}
    </div>
  )
}

export function NotesConfigForm({ config, onSave, onCancel }: WidgetConfigProps) {
  const c = config as NotesConfig
  const existing = deriveNotes(c)
  const [title, setTitle] = useState(c.title ?? '')
  // One note per line; timestamps are preserved for unchanged lines on save.
  const [text, setText] = useState(existing.map(n => n.text).join('\n'))

  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
  }

  function save() {
    const byText = new Map(existing.map(n => [n.text, n.at]))
    const notes: NoteEntry[] = text.split('\n').map(s => s.trim()).filter(Boolean)
      .map(t => ({ text: t, at: byText.get(t) ?? new Date().toISOString() }))
    onSave({ title: title.trim() || undefined, notes, text: undefined })
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
        placeholder="One note per line…"
        value={text}
        onChange={e => setText(e.target.value)}
        rows={5}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button
          onClick={save}
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
