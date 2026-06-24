'use client'

import { useState } from 'react'
import { Plus, Trash2, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { addFlipListItem, removeFlipListItem, type FlipListItem } from '@/lib/supabase/flip'

export function FlipListPanel({ baseId, items, canEdit, onChange }: {
  baseId: string; items: FlipListItem[]; canEdit: boolean; onChange: () => void
}) {
  const [title, setTitle] = useState('')

  const add = async () => {
    const t = title.trim(); if (!t) return
    const { error } = await addFlipListItem(baseId, t, items.length)
    if (error) { toast.error(error); return }
    setTitle(''); onChange(); toast.success('FLIP added to list')
  }
  const remove = async (id: string) => {
    const { error } = await removeFlipListItem(id)
    if (error) { toast.error(error); return }
    onChange()
  }

  return (
    <section style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16, background: 'var(--color-bg-surface)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--color-bg-inset)', borderBottom: '1px solid var(--color-border)' }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>Local FLIP List</span>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>Source for FLIP Reviews</span>
      </header>
      <div style={{ padding: 16 }}>
        {items.length === 0 ? (
          <p style={{ color: 'var(--color-text-3)', fontStyle: 'italic', fontSize: 'var(--fs-sm)', marginBottom: 8 }}>No FLIPs added yet.</p>
        ) : items.map((it) => (
          <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--fs-sm)' }}>
            <FileText size={15} style={{ color: 'var(--color-accent)' }} />
            <span style={{ flex: 1 }}>{it.title}</span>
            {canEdit && <button onClick={() => remove(it.id)} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)' }}><Trash2 size={15} /></button>}
          </div>
        ))}
        {canEdit && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }}
              placeholder="FLIP title (e.g., IFR Supplement)"
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)', fontSize: 'var(--fs-sm)' }} />
            <button onClick={add} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}><Plus size={14} /> Add</button>
          </div>
        )}
      </div>
    </section>
  )
}
