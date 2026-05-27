'use client'

import { useState } from 'react'
import { GripVertical, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { upsertAmtrRow, updateAmtrRow, deleteAmtrRow, reorderAmtrRows } from '@/lib/supabase/amtr'
import { Btn } from '@/components/amtr/ui'

type Row = Record<string, unknown>
const GROUPS: { key: string; label: string }[] = [
  { key: 'qtp', label: 'QTP/PCGs' },
  { key: 'skill_level', label: 'Skill Levels' },
  { key: 'sei', label: 'Special Experience Identifiers (SEI)' },
]

// Builder for the base-shared qualifications catalog, grouped by category.
// Edit names, add, reorder (within a category), and delete. Shown the same on
// every record; members only track attained/dates.
export function QualCatalogEditor({ catalog, installationId, onChange }: {
  catalog: Row[]; installationId: string; onChange: () => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const flat = GROUPS.flatMap((g) => catalog.filter((c) => c.category === g.key))

  const add = async (category: string) => {
    const maxOrder = catalog.reduce((m, r) => Math.max(m, Number(r.sort_order ?? 0)), 0)
    const { error } = await upsertAmtrRow('amtr_qual_catalog', { base_id: installationId, category, name: 'New item', sort_order: maxOrder + 1 })
    if (error) { toast.error(error); return }
    onChange()
  }
  const update = async (id: string, patch: Row) => {
    const { error } = await updateAmtrRow('amtr_qual_catalog', id, patch)
    if (error) { toast.error(error); return }
    onChange()
  }
  const remove = async (id: string) => {
    if (!window.confirm('Delete this item for all records?')) return
    const { error } = await deleteAmtrRow('amtr_qual_catalog', id)
    if (error) { toast.error(error); return }
    onChange()
  }
  const moveBefore = async (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const moving = flat.find((c) => String(c.id) === dragId)
    const target = flat.find((c) => String(c.id) === targetId)
    if (!moving || !target || moving.category !== target.category) { setDragId(null); setOverId(null); return }
    const rest = flat.filter((c) => String(c.id) !== dragId)
    const idx = rest.findIndex((c) => String(c.id) === targetId)
    const result = [...rest.slice(0, idx), moving, ...rest.slice(idx)]
    const ordered = GROUPS.flatMap((g) => result.filter((c) => c.category === g.key))
    setDragId(null); setOverId(null)
    await reorderAmtrRows('amtr_qual_catalog', ordered.map((c, i) => ({ ...c, sort_order: i })))
    onChange()
  }
  const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', padding: 2, display: 'inline-flex' }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {GROUPS.map((g) => {
        const items = catalog.filter((c) => c.category === g.key)
        return (
          <div key={g.key} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>
              <strong>{g.label}</strong>
              <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>({items.length})</span>
              <div style={{ marginLeft: 'auto' }}><Btn variant="secondary" onClick={() => add(g.key)}>+ Add</Btn></div>
            </div>
            {items.length === 0 ? (
              <div style={{ padding: 14, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>None — use “+ Add”.</div>
            ) : items.map((c) => {
              const id = String(c.id)
              return (
                <div key={id}
                  onDragOver={(e) => { e.preventDefault(); if (overId !== id) setOverId(id) }}
                  onDrop={() => moveBefore(id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                    borderBottom: '1px solid var(--color-border)',
                    borderTop: overId === id && dragId !== null && dragId !== id ? '2px solid var(--color-accent)' : '2px solid transparent',
                    opacity: dragId === id ? 0.4 : 1,
                  }}>
                  <span draggable onDragStart={() => setDragId(id)} onDragEnd={() => { setDragId(null); setOverId(null) }}
                    title="Drag to reorder" style={{ ...iconBtn, cursor: 'move', userSelect: 'none' }}><GripVertical size={15} /></span>
                  <input className="input-dark" style={{ flex: 1, minWidth: 200, padding: '4px 6px', fontSize: 'var(--fs-xs)' }} defaultValue={(c.name as string) ?? ''} placeholder="Name" onBlur={(e) => update(id, { name: e.target.value })} />
                  <button style={{ ...iconBtn, color: 'var(--color-danger)' }} onClick={() => remove(id)} title="Delete"><Trash2 size={14} /></button>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
