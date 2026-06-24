'use client'

import { useState } from 'react'
import { Pencil, Save } from 'lucide-react'
import { toast } from 'sonner'

export function EditableSection({
  title, value, placeholder, canEdit, onSave, minHeight = 120,
}: {
  title: string
  value: string
  placeholder: string
  canEdit: boolean
  onSave: (next: string) => Promise<{ error: string | null }>
  minHeight?: number
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)

  const start = () => { setDraft(value); setEditing(true) }
  const save = async () => {
    setSaving(true)
    const { error } = await onSave(draft.trim())
    setSaving(false)
    if (error) { toast.error(error); return }
    toast.success('Saved')
    setEditing(false)
  }

  return (
    <section style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16, background: 'var(--color-bg-surface)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--color-bg-inset)', borderBottom: '1px solid var(--color-border)' }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{title}</span>
        {canEdit && !editing && (
          <button onClick={start} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--fs-xs)', background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: 'var(--color-text-1)' }}>
            <Pencil size={13} /> Edit
          </button>
        )}
      </header>
      <div style={{ padding: 16 }}>
        {!editing ? (
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 'var(--fs-sm)', color: value ? 'var(--color-text-1)' : 'var(--color-text-3)', fontStyle: value ? 'normal' : 'italic' }}>
            {value || placeholder}
          </div>
        ) : (
          <>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus
              style={{ width: '100%', minHeight, padding: 10, borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', lineHeight: 1.6, resize: 'vertical', color: 'var(--color-text-1)' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>
                <Save size={14} /> {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
