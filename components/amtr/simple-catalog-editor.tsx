'use client'

import { useState } from 'react'
import { GripVertical, Trash2 } from 'lucide-react'
import { upsertAmtrRow, updateAmtrRow, deleteAmtrRow, reorderAmtrRows } from '@/lib/supabase/amtr'
import { Btn } from '@/components/amtr/ui'

type Row = Record<string, unknown>
export type CatalogColumn = {
  key: string; label: string; type?: 'text' | 'select'; options?: string[]; width?: number; flex?: boolean
}

// Generic NAMT/AFM catalog editor for flat (non-hierarchical) catalogs
// (DAF 1098, Formal Training). Changes are base-shared.
export function SimpleCatalogEditor({
  table, rows, installationId, columns, defaults, onDone, onChange,
}: {
  table: string; rows: Row[]; installationId: string
  columns: CatalogColumn[]; defaults: Row; onDone: () => void; onChange: () => void
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const update = async (id: string, patch: Row) => { await updateAmtrRow(table, id, patch); onChange() }
  const remove = async (id: string) => { if (window.confirm('Delete this catalog row for all members?')) { await deleteAmtrRow(table, id); onChange() } }
  const add = async () => {
    const maxOrder = rows.reduce((m, r) => Math.max(m, Number(r.sort_order ?? 0)), 0)
    await upsertAmtrRow(table, { base_id: installationId, ...defaults, sort_order: maxOrder + 1 }); onChange()
  }
  const reorder = async (from: number, to: number) => {
    if (from === to) return
    const arr = [...rows]
    const [moved] = arr.splice(from, 1); arr.splice(to, 0, moved)
    await reorderAmtrRows(table, arr.map((r, i) => ({ ...r, sort_order: i }))); onChange()
  }
  const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', padding: 2, display: 'inline-flex' }
  const eIn: React.CSSProperties = { padding: '4px 6px', fontSize: 'var(--fs-xs)' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 10, borderRadius: 8, background: 'color-mix(in srgb, var(--color-warning) 16%, transparent)', border: '1px solid color-mix(in srgb, var(--color-warning) 40%, transparent)', flexWrap: 'wrap' }}>
        <strong style={{ color: 'var(--color-warning)' }}>Editing catalog</strong>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>Changes apply to every member&apos;s record.</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Btn variant="secondary" onClick={add}>+ Add</Btn>
          <Btn variant="primary" onClick={onDone}>Done</Btn>
        </div>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {rows.length === 0 && <div style={{ padding: 14, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>No rows — use “+ Add”.</div>}
        {rows.map((r, idx) => {
          const id = String(r.id)
          return (
            <div key={id}
              onDragOver={(e) => { e.preventDefault(); if (overIdx !== idx) setOverIdx(idx) }}
              onDrop={() => { if (dragIdx !== null) reorder(dragIdx, idx); setDragIdx(null); setOverIdx(null) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', flexWrap: 'wrap',
                borderBottom: '1px solid var(--color-border)',
                borderTop: overIdx === idx && dragIdx !== null && dragIdx !== idx ? '2px solid var(--color-accent)' : '2px solid transparent',
                opacity: dragIdx === idx ? 0.4 : 1,
              }}>
              <span draggable onDragStart={() => setDragIdx(idx)} onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
                title="Drag to reorder" style={{ ...iconBtn, cursor: 'move', userSelect: 'none' }}><GripVertical size={15} /></span>
              {columns.map((col) => col.type === 'select' ? (
                <select key={col.key} className="input-dark" style={{ ...eIn, width: col.width ?? 120 }} defaultValue={(r[col.key] as string) ?? ''} onChange={(e) => update(id, { [col.key]: e.target.value || null })}>
                  {(col.options ?? []).map((o) => <option key={o} value={o}>{o || '—'}</option>)}
                </select>
              ) : (
                <input key={col.key} className="input-dark" style={{ ...eIn, ...(col.flex ? { flex: 1, minWidth: 200 } : { width: col.width ?? 140 }) }} defaultValue={(r[col.key] as string) ?? ''} placeholder={col.label} onBlur={(e) => update(id, { [col.key]: e.target.value || null })} />
              ))}
              <button style={{ ...iconBtn, color: 'var(--color-danger)' }} onClick={() => remove(id)} title="Delete"><Trash2 size={14} /></button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
