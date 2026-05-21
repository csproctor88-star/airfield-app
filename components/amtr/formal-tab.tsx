'use client'

import { useState } from 'react'
import { Pencil, GripVertical, Trash2 } from 'lucide-react'
import { upsertAmtrRow, updateAmtrRow, deleteAmtrRow, reorderAmtrRows } from '@/lib/supabase/amtr'
import { FORMAL_SECTIONS } from '@/lib/amtr/reference-data'
import { Btn, thStyle, tdStyle } from '@/components/amtr/ui'

type Row = Record<string, unknown>

export function FormalTab(props: {
  catalog: Row[]; progress: Row[]; canEnterData: boolean; canManage: boolean; installationId: string; memberId: string; onChange: () => void
}) {
  const { catalog, progress, canEnterData, canManage, installationId, memberId, onChange } = props
  const [editMode, setEditMode] = useState(false)
  const progByCat = new Map(progress.map((p) => [String(p.catalog_id), p]))

  if (editMode) {
    return <FormalCatalogEditor catalog={catalog} installationId={installationId} onDone={() => setEditMode(false)} onChange={onChange} />
  }

  if (catalog.length === 0) return <div className="card" style={{ color: 'var(--color-text-3)' }}>Formal training catalog is empty — load it from Roles &amp; Catalogs.</div>

  const setField = async (catId: string, field: string, value: string) => {
    const p = progByCat.get(catId)
    await upsertAmtrRow('amtr_formal_progress', { ...(p ?? {}), base_id: installationId, member_id: memberId, catalog_id: catId, [field]: value || null })
    onChange()
  }

  return (
    <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Formal Training</h2>
      {canManage && <div style={{ marginLeft: 'auto' }}><Btn variant="secondary" onClick={() => setEditMode(true)}><Pencil size={14} /> Edit catalog</Btn></div>}
    </div>
    <div style={{ display: 'grid', gap: 16 }}>
      {FORMAL_SECTIONS.map((sec) => {
        const courses = catalog.filter((c) => c.section === sec.key)
        if (courses.length === 0) return null
        return (
          <div key={sec.key} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}><strong>{sec.label}</strong></div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={thStyle}>Course</th><th style={thStyle}>Start</th><th style={thStyle}>Complete</th></tr></thead>
              <tbody>
                {courses.map((c) => {
                  const catId = String(c.id)
                  const p = progByCat.get(catId)
                  return (
                    <tr key={catId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={tdStyle}>{String(c.course)}</td>
                      <td style={tdStyle}><input type="date" className="input-dark" style={di} disabled={!canEnterData} defaultValue={p?.start_date ? String(p.start_date).slice(0, 10) : ''} onBlur={(e) => canEnterData && setField(catId, 'start_date', e.target.value)} /></td>
                      <td style={tdStyle}><input type="date" className="input-dark" style={di} disabled={!canEnterData} defaultValue={p?.complete_date ? String(p.complete_date).slice(0, 10) : ''} onBlur={(e) => canEnterData && setField(catId, 'complete_date', e.target.value)} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
    </div>
  )
}

const di: React.CSSProperties = { padding: '3px 6px', fontSize: 'var(--fs-xs)', width: 150 }

// ── Grouped catalog editor — three section blocks (HAF / Initial / Continuation)
// with add-per-section, inline rename, delete, and drag to reorder within OR move
// between sections. Changes are base-shared.
function FormalCatalogEditor({ catalog, installationId, onDone, onChange }: {
  catalog: Row[]; installationId: string; onDone: () => void; onChange: () => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [overSection, setOverSection] = useState<string | null>(null)

  const addToSection = async (key: string) => {
    const maxOrder = catalog.reduce((m, c) => Math.max(m, Number(c.sort_order ?? 0)), 0)
    await upsertAmtrRow('amtr_formal_catalog', { base_id: installationId, course: 'New Course', section: key, sort_order: maxOrder + 1 })
    onChange()
  }
  const updateCourse = async (id: string, course: string) => { await updateAmtrRow('amtr_formal_catalog', id, { course }); onChange() }
  const removeCourse = async (id: string) => { if (window.confirm('Delete this course for all members?')) { await deleteAmtrRow('amtr_formal_catalog', id); onChange() } }

  // Normalized flat order: sections in canonical order, items in current order.
  const flat = FORMAL_SECTIONS.flatMap((sec) => catalog.filter((c) => c.section === sec.key))

  const move = async (targetSection: string, targetId: string | null) => {
    if (!dragId) return
    const moving = flat.find((c) => String(c.id) === dragId)
    if (!moving) return
    const rest = flat.filter((c) => String(c.id) !== dragId)
    const destSection = targetId ? String(rest.find((c) => String(c.id) === targetId)?.section ?? targetSection) : targetSection
    const movedRow = { ...moving, section: destSection }
    let result: Row[]
    if (targetId) {
      const idx = rest.findIndex((c) => String(c.id) === targetId)
      result = [...rest.slice(0, idx), movedRow, ...rest.slice(idx)]
    } else {
      result = [...rest, movedRow]
    }
    const ordered = FORMAL_SECTIONS.flatMap((sec) => result.filter((c) => c.section === sec.key))
    const rows = ordered.map((c, i) => ({ ...c, sort_order: i }))
    setDragId(null); setOverId(null); setOverSection(null)
    await reorderAmtrRows('amtr_formal_catalog', rows)
    onChange()
  }

  const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', padding: 2, display: 'inline-flex' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 10, borderRadius: 8, background: 'color-mix(in srgb, var(--color-warning) 16%, transparent)', border: '1px solid color-mix(in srgb, var(--color-warning) 40%, transparent)', flexWrap: 'wrap' }}>
        <strong style={{ color: 'var(--color-warning)' }}>Editing catalog</strong>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>Add courses to a section, or drag to reorder / move between sections. Changes apply to every member.</span>
        <div style={{ marginLeft: 'auto' }}><Btn variant="primary" onClick={onDone}>Done</Btn></div>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        {FORMAL_SECTIONS.map((sec) => {
          const courses = catalog.filter((c) => c.section === sec.key)
          const isOverSection = overSection === sec.key && dragId !== null
          return (
            <div key={sec.key} className="card" style={{ padding: 0, overflow: 'hidden', outline: isOverSection ? '2px solid var(--color-accent)' : undefined }}
              onDragOver={(e) => { e.preventDefault(); if (overSection !== sec.key) { setOverSection(sec.key); setOverId(null) } }}
              onDrop={() => move(sec.key, null)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>
                <strong>{sec.label}</strong>
                <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>({courses.length})</span>
                <div style={{ marginLeft: 'auto' }}><Btn variant="secondary" onClick={() => addToSection(sec.key)}>+ Add</Btn></div>
              </div>
              {courses.length === 0 ? (
                <div style={{ padding: '14px', color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>No courses — use “+ Add”, or drag a course here.</div>
              ) : courses.map((c) => {
                const id = String(c.id)
                return (
                  <div key={id}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (overId !== id) { setOverId(id); setOverSection(sec.key) } }}
                    onDrop={(e) => { e.stopPropagation(); move(sec.key, id) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                      borderBottom: '1px solid var(--color-border)',
                      borderTop: overId === id && dragId !== null && dragId !== id ? '2px solid var(--color-accent)' : '2px solid transparent',
                      opacity: dragId === id ? 0.4 : 1,
                    }}>
                    <span draggable onDragStart={() => setDragId(id)} onDragEnd={() => { setDragId(null); setOverId(null); setOverSection(null) }}
                      title="Drag to reorder or move between sections" style={{ ...iconBtn, cursor: 'move', userSelect: 'none' }}><GripVertical size={15} /></span>
                    <input className="input-dark" style={{ flex: 1, minWidth: 200, padding: '4px 6px', fontSize: 'var(--fs-xs)' }} defaultValue={(c.course as string) ?? ''} placeholder="Course" onBlur={(e) => updateCourse(id, e.target.value)} />
                    <button style={{ ...iconBtn, color: 'var(--color-danger)' }} onClick={() => removeCourse(id)} title="Delete"><Trash2 size={14} /></button>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
