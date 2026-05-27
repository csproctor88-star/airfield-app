'use client'

import { useState } from 'react'
import { GripVertical, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { upsertAmtrRow, updateAmtrRow, deleteAmtrRow, reorderAmtrRows } from '@/lib/supabase/amtr'
import { Btn } from '@/components/amtr/ui'

type Row = Record<string, unknown>

// Builder for the base's editable inspection checklist (sections + items in one
// draggable list, like the JQS catalog editor). Items with an `auto_key` carry a
// read-only "auto" badge — the gap engine keys off it; editing the text/number or
// reordering never breaks automation.
export function InspectionChecklistEditor({ rows, installationId, onChange }: {
  rows: Row[]; installationId: string; onChange: () => void
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  const add = async (kind: 'section' | 'item') => {
    const maxOrder = rows.reduce((m, r) => Math.max(m, Number(r.sort_order ?? 0)), 0)
    const { error } = await upsertAmtrRow('amtr_inspection_checklist', {
      base_id: installationId, kind, label: kind === 'section' ? 'New Section' : 'New item',
      item_number: '', auto_key: null, sort_order: maxOrder + 1,
    })
    if (error) { toast.error(error); return }
    onChange()
  }
  const update = async (id: string, patch: Row) => {
    const { error } = await updateAmtrRow('amtr_inspection_checklist', id, patch)
    if (error) { toast.error(error); return }
    onChange()
  }
  const remove = async (id: string) => {
    if (!window.confirm('Delete this checklist row?')) return
    const { error } = await deleteAmtrRow('amtr_inspection_checklist', id)
    if (error) { toast.error(error); return }
    onChange()
  }
  const reorder = async (from: number, to: number) => {
    if (from === to) return
    const arr = [...rows]
    const [moved] = arr.splice(from, 1); arr.splice(to, 0, moved)
    await reorderAmtrRows('amtr_inspection_checklist', arr.map((r, i) => ({ ...r, sort_order: i })))
    onChange()
  }
  const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', padding: 2, display: 'inline-flex' }
  const eIn: React.CSSProperties = { padding: '4px 6px', fontSize: 'var(--fs-xs)' }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <Btn variant="secondary" onClick={() => add('section')}>+ Section</Btn>
        <Btn variant="secondary" onClick={() => add('item')}>+ Item</Btn>
      </div>
      {rows.length === 0 && <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>No checklist rows — use “Load standard catalogs” above, or add manually.</div>}
      <div style={{ border: rows.length ? '1px solid var(--color-border)' : 'none', borderRadius: 8, overflow: 'hidden' }}>
        {rows.map((r, idx) => {
          const id = String(r.id)
          const isSection = r.kind === 'section'
          return (
            <div key={id}
              onDragOver={(e) => { e.preventDefault(); if (overIdx !== idx) setOverIdx(idx) }}
              onDrop={() => { if (dragIdx !== null) reorder(dragIdx, idx); setDragIdx(null); setOverIdx(null) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', flexWrap: 'wrap',
                borderBottom: '1px solid var(--color-border)',
                borderTop: overIdx === idx && dragIdx !== null && dragIdx !== idx ? '2px solid var(--color-accent)' : '2px solid transparent',
                opacity: dragIdx === idx ? 0.4 : 1,
                background: isSection ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : undefined,
              }}>
              <span draggable onDragStart={() => setDragIdx(idx)} onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
                title="Drag to reorder" style={{ ...iconBtn, cursor: 'move', userSelect: 'none' }}><GripVertical size={15} /></span>
              <select className="input-dark" style={{ ...eIn, width: 90 }} defaultValue={isSection ? 'section' : 'item'} onChange={(e) => update(id, { kind: e.target.value })}>
                <option value="section">Section</option><option value="item">Item</option>
              </select>
              <input className="input-dark" style={{ ...eIn, width: 60 }} defaultValue={(r.item_number as string) ?? ''} placeholder="#" onBlur={(e) => update(id, { item_number: e.target.value || null })} />
              <input className="input-dark" style={{ ...eIn, flex: 1, minWidth: 220, fontWeight: isSection ? 700 : 400 }} defaultValue={(r.label as string) ?? ''} placeholder={isSection ? 'Section title' : 'Checklist question'} onBlur={(e) => update(id, { label: e.target.value })} />
              {r.auto_key ? <span title={`Auto-detected (${String(r.auto_key)})`} style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'color-mix(in srgb, var(--color-success) 16%, transparent)', color: 'var(--color-success)' }}>auto</span> : null}
              <button style={{ ...iconBtn, color: 'var(--color-danger)' }} onClick={() => remove(id)} title="Delete"><Trash2 size={14} /></button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
