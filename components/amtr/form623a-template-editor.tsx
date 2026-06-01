'use client'

import { useState } from 'react'
import { GripVertical, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { upsertAmtrRow, updateAmtrRow, deleteAmtrRow, reorderAmtrRows } from '@/lib/supabase/amtr'
import { Btn } from '@/components/amtr/ui'

type Row = Record<string, unknown>
const TABLE = 'amtr_623a_comment_templates'

// NAMT/AFM editor for the 623A "Insert DAFMAN template…" comment shells.
// Each row has a picker label, an IAW citation, and the body (the labeled
// blanks); the "(Label — IAW Cite)" header is recomposed on insert. Base-shared.
export function Form623aTemplateEditor({
  rows, installationId, onDone, onChange,
}: {
  rows: Row[]; installationId: string; onDone: () => void; onChange: () => void
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  const update = async (id: string, patch: Row) => {
    const { error } = await updateAmtrRow(TABLE, id, patch)
    if (error) { toast.error(error); return }
    onChange()
  }
  const remove = async (id: string) => {
    if (!window.confirm('Delete this comment template for all members?')) return
    const { error } = await deleteAmtrRow(TABLE, id)
    if (error) { toast.error(error); return }
    onChange()
  }
  const add = async () => {
    const maxOrder = rows.reduce((m, r) => Math.max(m, Number(r.sort_order ?? 0)), 0)
    const key = `custom-${Math.random().toString(36).slice(2, 9)}`
    const { error } = await upsertAmtrRow(TABLE, {
      base_id: installationId, key, label: 'New Template', cite: '', body: '', sort_order: maxOrder + 1,
    })
    if (error) { toast.error(error); return }
    onChange()
  }
  const reorder = async (from: number, to: number) => {
    if (from === to) return
    const arr = [...rows]
    const [moved] = arr.splice(from, 1); arr.splice(to, 0, moved)
    await reorderAmtrRows(TABLE, arr.map((r, i) => ({ ...r, sort_order: i }))); onChange()
  }

  const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', padding: 2, display: 'inline-flex' }
  const eIn: React.CSSProperties = { padding: '4px 6px', fontSize: 'var(--fs-xs)' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 10, borderRadius: 8, background: 'color-mix(in srgb, var(--color-warning) 16%, transparent)', border: '1px solid color-mix(in srgb, var(--color-warning) 40%, transparent)', flexWrap: 'wrap' }}>
        <strong style={{ color: 'var(--color-warning)' }}>Editing catalog</strong>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
          Edits change this base&apos;s inserted shells; citations are advisory. &quot;Sync standard catalogs&quot; restores the shipped defaults.
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Btn variant="secondary" onClick={add}>+ Add</Btn>
          <Btn variant="primary" onClick={onDone}>Done</Btn>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.length === 0 && <div style={{ padding: 14, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>No templates — use “+ Add”.</div>}
        {rows.map((r, idx) => {
          const id = String(r.id)
          return (
            <div key={id}
              onDragOver={(e) => { e.preventDefault(); if (overIdx !== idx) setOverIdx(idx) }}
              onDrop={() => { if (dragIdx !== null) reorder(dragIdx, idx); setDragIdx(null); setOverIdx(null) }}
              className="card"
              style={{
                padding: 10,
                borderTop: overIdx === idx && dragIdx !== null && dragIdx !== idx ? '2px solid var(--color-accent)' : undefined,
                opacity: dragIdx === idx ? 0.4 : 1,
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <span draggable onDragStart={() => setDragIdx(idx)} onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
                  title="Drag to reorder" style={{ ...iconBtn, cursor: 'move', userSelect: 'none' }}><GripVertical size={15} /></span>
                <input className="input-dark" style={{ ...eIn, flex: 1, minWidth: 160 }} defaultValue={(r.label as string) ?? ''} placeholder="Label (shown in picker)"
                  onBlur={(e) => update(id, { label: e.target.value })} />
                <input className="input-dark" style={{ ...eIn, flex: 2, minWidth: 220 }} defaultValue={(r.cite as string) ?? ''} placeholder="IAW citation (e.g. DAFMAN 13-204v2 Para …)"
                  onBlur={(e) => update(id, { cite: e.target.value })} />
                <button style={{ ...iconBtn, color: 'var(--color-danger)' }} onClick={() => remove(id)} title="Delete"><Trash2 size={14} /></button>
              </div>
              <textarea className="input-dark" rows={7} style={{ resize: 'vertical', minHeight: 120, width: '100%', fontFamily: 'inherit', lineHeight: 1.5, fontSize: 'var(--fs-xs)' }}
                defaultValue={(r.body as string) ?? ''} placeholder="Body — one labeled blank per line (e.g. “Evaluation Date: ”)"
                onBlur={(e) => update(id, { body: e.target.value })} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
