'use client'

import { useState } from 'react'
import { GripVertical, Trash2 } from 'lucide-react'
import { upsertAmtrRow, updateAmtrRow, deleteAmtrRow, reorderAmtrRows } from '@/lib/supabase/amtr'
import { MILESTONE_PATHS } from '@/lib/amtr/reference-data'
import { Btn } from '@/components/amtr/ui'

type Row = Record<string, unknown>
const TARGET_WINDOWS = ['', '1-30 Days', '30-60 Days', '60-90 Days', '90-120 Days', '120-150 Days', '150-180 Days']

// Builder for the base-shared milestone catalog, grouped by the four upgrade
// paths. Edit STS items / topic / target window, add, reorder (within a path),
// and delete. Windows are uniform across every record.
export function MilestoneCatalogEditor({ catalog, installationId, onChange }: {
  catalog: Row[]; installationId: string; onChange: () => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const flat = MILESTONE_PATHS.flatMap((p) => catalog.filter((c) => c.path === p.key))

  const add = async (path: string) => {
    const maxOrder = catalog.reduce((m, r) => Math.max(m, Number(r.sort_order ?? 0)), 0)
    await upsertAmtrRow('amtr_milestone_catalog', { base_id: installationId, path, phase_label: 'Required Milestones', topic: 'New milestone', sts_items: null, target_window: null, sort_order: maxOrder + 1 })
    onChange()
  }
  const update = async (id: string, patch: Row) => { await updateAmtrRow('amtr_milestone_catalog', id, patch); onChange() }
  const remove = async (id: string) => { if (window.confirm('Delete this milestone for all records?')) { await deleteAmtrRow('amtr_milestone_catalog', id); onChange() } }
  const moveBefore = async (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const moving = flat.find((c) => String(c.id) === dragId)
    const target = flat.find((c) => String(c.id) === targetId)
    if (!moving || !target || moving.path !== target.path) { setDragId(null); setOverId(null); return }
    const rest = flat.filter((c) => String(c.id) !== dragId)
    const idx = rest.findIndex((c) => String(c.id) === targetId)
    const result = [...rest.slice(0, idx), moving, ...rest.slice(idx)]
    const ordered = MILESTONE_PATHS.flatMap((p) => result.filter((c) => c.path === p.key))
    setDragId(null); setOverId(null)
    await reorderAmtrRows('amtr_milestone_catalog', ordered.map((c, i) => ({ ...c, sort_order: i })))
    onChange()
  }
  const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', padding: 2, display: 'inline-flex' }
  const eIn: React.CSSProperties = { padding: '4px 6px', fontSize: 'var(--fs-xs)' }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {MILESTONE_PATHS.map((p) => {
        const items = catalog.filter((c) => c.path === p.key)
        return (
          <div key={p.key} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>
              <strong>{p.label}</strong>
              <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>({items.length})</span>
              <div style={{ marginLeft: 'auto' }}><Btn variant="secondary" onClick={() => add(p.key)}>+ Add</Btn></div>
            </div>
            {items.length === 0 ? (
              <div style={{ padding: 14, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>No milestones — use “+ Add”.</div>
            ) : items.map((c) => {
              const id = String(c.id)
              return (
                <div key={id}
                  onDragOver={(e) => { e.preventDefault(); if (overId !== id) setOverId(id) }}
                  onDrop={() => moveBefore(id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', flexWrap: 'wrap',
                    borderBottom: '1px solid var(--color-border)',
                    borderTop: overId === id && dragId !== null && dragId !== id ? '2px solid var(--color-accent)' : '2px solid transparent',
                    opacity: dragId === id ? 0.4 : 1,
                  }}>
                  <span draggable onDragStart={() => setDragId(id)} onDragEnd={() => { setDragId(null); setOverId(null) }}
                    title="Drag to reorder" style={{ ...iconBtn, cursor: 'move', userSelect: 'none' }}><GripVertical size={15} /></span>
                  <input className="input-dark" style={{ ...eIn, width: 150 }} defaultValue={(c.sts_items as string) ?? ''} placeholder="STS items" onBlur={(e) => update(id, { sts_items: e.target.value || null })} />
                  <input className="input-dark" style={{ ...eIn, flex: 1, minWidth: 200 }} defaultValue={(c.topic as string) ?? ''} placeholder="Topic" onBlur={(e) => update(id, { topic: e.target.value })} />
                  <select className="input-dark" style={{ ...eIn, width: 150 }} defaultValue={(c.target_window as string) ?? ''} onChange={(e) => update(id, { target_window: e.target.value || null })}>
                    {TARGET_WINDOWS.map((w) => <option key={w} value={w}>{w || 'No window'}</option>)}
                  </select>
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
