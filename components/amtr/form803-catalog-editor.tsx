'use client'

import { useState } from 'react'
import { GripVertical, Trash2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { upsertAmtrRow, updateAmtrRow, deleteAmtrRow, reorderAmtrRows } from '@/lib/supabase/amtr'
import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveSections, type Section803 } from '@/lib/amtr/form803-sections'
import { Btn } from '@/components/amtr/ui'

type Row = Record<string, unknown>

// Builder for the base-shared standard DAF 803 task-evaluation catalog, grouped
// by section. Sections are data-driven (amtr_803_sections): a NAMT can add a new
// section, rename it, delete a custom one, and add/reorder/delete tasks under it.
export function Form803CatalogEditor({ catalog, sections, installationId, onChange }: {
  catalog: Row[]; sections: Row[]; installationId: string; onChange: () => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const sectionList = resolveSections(sections)
  const flat = sectionList.flatMap((s) => catalog.filter((c) => c.section === s.key))

  // ── Section CRUD ──
  const addSection = async () => {
    const label = window.prompt('New 803 section name:')?.trim()
    if (!label) return
    const maxOrder = sections.reduce((m, r) => Math.max(m, Number(r.sort_order ?? 0)), 0)
    const { error } = await upsertAmtrRow('amtr_803_sections', {
      base_id: installationId, section_key: crypto.randomUUID(), label, builtin: false, sort_order: maxOrder + 1,
    })
    if (error) { toast.error(error); return }
    onChange()
  }
  const renameSection = async (s: Section803, label: string) => {
    const next = label.trim()
    if (!s.id || !next || next === s.label) return
    const { error } = await updateAmtrRow('amtr_803_sections', s.id, { label: next })
    if (error) { toast.error(error); return }
    onChange()
  }
  const deleteSection = async (s: Section803) => {
    if (s.builtin || !s.id) return
    // amtr_803 isn't in the generated Database type — use an untyped client.
    const supabase = createClient() as unknown as SupabaseClient | null
    if (!supabase) return
    const { count } = await supabase.from('amtr_803').select('id', { count: 'exact', head: true })
      .eq('base_id', installationId).eq('section', s.key)
    if ((count ?? 0) > 0) { toast.error('Members have evaluations under this section — remove them first.'); return }
    if (!window.confirm(`Delete the "${s.label}" section and its tasks? This can't be undone.`)) return
    for (const t of catalog.filter((c) => c.section === s.key)) await deleteAmtrRow('amtr_803_catalog', String(t.id))
    const { error } = await deleteAmtrRow('amtr_803_sections', s.id)
    if (error) { toast.error(error); return }
    onChange()
  }

  // ── Task CRUD ──
  const add = async (section: string) => {
    const maxOrder = catalog.reduce((m, r) => Math.max(m, Number(r.sort_order ?? 0)), 0)
    const { error } = await upsertAmtrRow('amtr_803_catalog', { base_id: installationId, section, sts_item: 'New STS item', sort_order: maxOrder + 1 })
    if (error) { toast.error(error); return }
    onChange()
  }
  const update = async (id: string, patch: Row) => {
    const { error } = await updateAmtrRow('amtr_803_catalog', id, patch)
    if (error) { toast.error(error); return }
    onChange()
  }
  const remove = async (id: string) => {
    if (!window.confirm('Delete this standard 803 item?')) return
    const { error } = await deleteAmtrRow('amtr_803_catalog', id)
    if (error) { toast.error(error); return }
    onChange()
  }
  const moveBefore = async (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const moving = flat.find((c) => String(c.id) === dragId)
    const target = flat.find((c) => String(c.id) === targetId)
    if (!moving || !target || moving.section !== target.section) { setDragId(null); setOverId(null); return }
    const rest = flat.filter((c) => String(c.id) !== dragId)
    const idx = rest.findIndex((c) => String(c.id) === targetId)
    const result = [...rest.slice(0, idx), moving, ...rest.slice(idx)]
    const ordered = sectionList.flatMap((s) => result.filter((c) => c.section === s.key))
    setDragId(null); setOverId(null)
    await reorderAmtrRows('amtr_803_catalog', ordered.map((c, i) => ({ ...c, sort_order: i })))
    onChange()
  }
  const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', padding: 2, display: 'inline-flex' }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <Btn variant="secondary" onClick={addSection}><Plus size={14} /> Add Section</Btn>
      </div>
      {sectionList.map((s) => {
        const items = catalog.filter((c) => c.section === s.key)
        return (
          <div key={s.key} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid var(--color-border)' }}>
              <input
                defaultValue={s.label}
                disabled={!s.id}
                onBlur={(e) => renameSection(s, e.target.value)}
                title="Rename section"
                style={{ fontWeight: 700, fontSize: 'var(--fs-base)', background: 'transparent', border: '1px solid transparent', borderRadius: 4, padding: '2px 4px', color: 'var(--color-text-1)', fontFamily: 'inherit', minWidth: 80, maxWidth: 220 }}
              />
              {s.builtin && <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>built-in</span>}
              <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>({items.length})</span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Btn variant="secondary" onClick={() => add(s.key)}>+ Add</Btn>
                {!s.builtin && (
                  <button style={{ ...iconBtn, color: 'var(--color-danger)' }} onClick={() => deleteSection(s)} title="Delete section"><Trash2 size={15} /></button>
                )}
              </div>
            </div>
            {items.length === 0 ? (
              <div style={{ padding: 14, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>No standard items — use &ldquo;+ Add&rdquo;.</div>
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
