'use client'

import { useState } from 'react'
import { GripVertical, Trash2 } from 'lucide-react'
import { upsertAmtrRow, updateAmtrRow, deleteAmtrRow, reorderAmtrRows } from '@/lib/supabase/amtr'
import { DAF803_SECTIONS } from '@/lib/amtr/reference-data'
import { Btn } from '@/components/amtr/ui'

type Row = Record<string, unknown>

// Builder for the base-shared standard DAF 803 task-evaluation catalog,
// grouped by upgrade section. Edit STS items, add, reorder (within a
// section), and delete. A member's 803 tab can one-click populate from this.
export function Form803CatalogEditor({ catalog, installationId, onChange }: {
  catalog: Row[]; installationId: string; onChange: () => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const flat = DAF803_SECTIONS.flatMap((s) => catalog.filter((c) => c.section === s.key))

  const add = async (section: string) => {
    const maxOrder = catalog.reduce((m, r) => Math.max(m, Number(r.sort_order ?? 0)), 0)
    await upsertAmtrRow('amtr_803_catalog', { base_id: installationId, section, sts_item: 'New STS item', sort_order: maxOrder + 1 })
    onChange()
  }
  const update = async (id: string, patch: Row) => { await updateAmtrRow('amtr_803_catalog', id, patch); onChange() }
  const remove = async (id: string) => { if (window.confirm('Delete this standard 803 item?')) { await deleteAmtrRow('amtr_803_catalog', id); onChange() } }
  const moveBefore = async (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const moving = flat.find((c) => String(c.id) === dragId)
    const target = flat.find((c) => String(c.id) === targetId)
    if (!moving || !target || moving.section !== target.section) { setDragId(null); setOverId(null); return }
    const rest = flat.filter((c) => String(c.id) !== dragId)
    const idx = rest.findIndex((c) => String(c.id) === targetId)
    const result = [...rest.slice(0, idx), moving, ...rest.slice(idx)]
    const ordered = DAF803_SECTIONS.flatMap((s) => result.filter((c) => c.section === s.key))
    setDragId(null); setOverId(null)
    await reorderAmtrRows('amtr_803_catalog', ordered.map((c, i) => ({ ...c, sort_order: i })))
    onChange()
  }
  const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', padding: 2, display: 'inline-flex' }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {DAF803_SECTIONS.map((s) => {
        const items = catalog.filter((c) => c.section === s.key)
        return (
          <div key={s.key} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>
              <strong>{s.label}</strong>
              <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>({items.length})</span>
              <div style={{ marginLeft: 'auto' }}><Btn variant="secondary" onClick={() => add(s.key)}>+ Add</Btn></div>
            </div>
            {items.length === 0 ? (
              <div style={{ padding: 14, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>No standard items — use “+ Add”.</div>
            ) : items.map((c) => {
              const id = String(c.id)
              return (
                <div key={id}
                  onDragOver={(e) => { e.preventDefault(); if (overId !== id) setOverId(id) }}
                  onDrop={() => moveBefore(id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 12px',
                    borderBottom: '1px solid var(--color-border)',
                    borderTop: overId === id && dragId !== null && dragId !== id ? '2px solid var(--color-accent)' : '2px solid transparent',
                    opacity: dragId === id ? 0.4 : 1,
                  }}>
                  <span draggable onDragStart={() => setDragId(id)} onDragEnd={() => { setDragId(null); setOverId(null) }}
                    title="Drag to reorder" style={{ ...iconBtn, cursor: 'move', userSelect: 'none', marginTop: 4 }}><GripVertical size={15} /></span>
                  <textarea className="input-dark" rows={1} style={{ flex: 1, minWidth: 200, padding: '4px 6px', fontSize: 'var(--fs-xs)', resize: 'vertical' }} defaultValue={(c.sts_item as string) ?? ''} placeholder="STS item(s)" onBlur={(e) => update(id, { sts_item: e.target.value })} />
                  <button style={{ ...iconBtn, color: 'var(--color-danger)', marginTop: 4 }} onClick={() => remove(id)} title="Delete"><Trash2 size={14} /></button>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
