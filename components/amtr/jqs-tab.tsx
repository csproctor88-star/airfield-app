'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Unlock, Pencil, GripVertical, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { upsertAmtrRow, updateAmtrRow, deleteAmtrRow, reorderAmtrRows } from '@/lib/supabase/amtr'
import type { AmtrMember, AmtrRole } from '@/lib/supabase/amtr'
import { canSignSlot, canReopen, type SignSlot } from '@/lib/amtr/roles'
import { Btn } from '@/components/amtr/ui'

type Row = Record<string, unknown>
type SignFn = (table: 'amtr_jqs_progress', rowId: string, slot: SignSlot, onSigned?: () => Promise<void>) => Promise<void>
type ReopenFn = (table: 'amtr_jqs_progress', rowId: string, slot: SignSlot) => Promise<void>

// Hierarchical renumber: sections → 1, 2, 3…; items → <section>.<n> by depth.
function computeJqsNumbers(rows: Row[]): string[] {
  const counters: number[] = []
  return rows.map((r) => {
    const level = r.kind === 'section' ? 0 : Math.max(1, Number(r.depth ?? 1))
    for (let k = 0; k < level; k++) if (!counters[k]) counters[k] = 1
    counters[level] = (counters[level] ?? 0) + 1
    counters.length = level + 1
    return counters.join('.')
  })
}

// Inline initials cell: shows initials (with an optional per-slot reopen for
// NAMT/AFM), a Sign button, or —. Each block locks on its own once signed.
function Initials({ value, canSign, canReopenSlot, onSign, onReopen }: {
  value: string | null; canSign: boolean; canReopenSlot?: boolean; onSign: () => void; onReopen?: () => void
}) {
  if (value) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <span style={{ fontWeight: 600 }}>{value}</span>
      {canReopenSlot && onReopen && (
        <button onClick={onReopen} title="Reopen this signature (NAMT/AFM)"
          style={{ display: 'inline-flex', alignItems: 'center', padding: 1, border: 'none', background: 'transparent', color: 'var(--color-text-3)', cursor: 'pointer' }}><Unlock size={11} /></button>
      )}
    </span>
  )
  if (!canSign) return <span style={{ color: 'var(--color-text-3)' }}>—</span>
  return <button onClick={onSign} style={{ fontSize: 'var(--fs-xs)', padding: '2px 8px', borderRadius: 5, border: '1px solid var(--color-border-mid)', background: 'transparent', color: 'var(--color-accent)', cursor: 'pointer', fontFamily: 'inherit' }}>Sign</button>
}

export function JqsTab(props: {
  catalog: Row[]; progress: Row[]; installationId: string; memberId: string
  member: AmtrMember; myRoles: AmtrRole[]; canWrite: boolean; canEnterData: boolean; canManage: boolean; isOwn: boolean
  highlightItem: string | null; sign: SignFn; reopen: ReopenFn; onChange: () => void
  notifySignoff: (slot: SignSlot, itemRef: string, itemId: string) => Promise<void>
}) {
  const { catalog, progress, installationId, memberId, myRoles, canWrite, canEnterData, canManage, isOwn, highlightItem, sign, reopen, onChange, notifySignoff } = props
  const progByCat = new Map(progress.map((p) => [String(p.catalog_id), p]))
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [editMode, setEditMode] = useState(false)
  const [requiredOnly, setRequiredOnly] = useState(false)
  const [showTR, setShowTR] = useState(true)
  const reopenAllowed = canReopen(myRoles)

  // ── catalog edit helpers (base-shared; affects every member) ──
  const updateCat = async (id: string, patch: Row) => {
    const { error } = await updateAmtrRow('amtr_jqs_catalog', id, patch)
    if (error) { toast.error(error); return }
    onChange()
  }
  const deleteCat = async (id: string) => {
    if (!window.confirm('Delete this catalog row for all members?')) return
    const { error } = await deleteAmtrRow('amtr_jqs_catalog', id)
    if (error) { toast.error(error); return }
    onChange()
  }
  const addCat = async (kind: 'section' | 'item') => {
    const maxOrder = catalog.reduce((m, c) => Math.max(m, Number(c.sort_order ?? 0)), 0)
    const { error } = await upsertAmtrRow('amtr_jqs_catalog', { base_id: installationId, kind, title: kind === 'section' ? 'New Section' : 'New Task', depth: kind === 'section' ? 0 : 1, sort_order: maxOrder + 1 })
    if (error) { toast.error(error); return }
    onChange()
  }
  const reorderCatalog = async (from: number, to: number) => {
    if (from === to) return
    const arr = [...catalog]
    const [moved] = arr.splice(from, 1)
    arr.splice(to, 0, moved)
    const numbers = computeJqsNumbers(arr)
    const rows = arr.map((r, i) => ({ ...r, sort_order: i, number: numbers[i] }))
    await reorderAmtrRows('amtr_jqs_catalog', rows)
    onChange()
  }
  const trOptions = Array.from(new Set(catalog.map((c) => c.training_refs).filter(Boolean).map(String)))

  if (catalog.length === 0) {
    return <div className="card" style={{ color: 'var(--color-text-3)' }}>JQS-CFETP catalog is empty — load it from Roles &amp; Catalogs.</div>
  }

  if (editMode) {
    return (
      <CatalogEditor catalog={catalog} trOptions={trOptions}
        onUpdate={updateCat} onDelete={deleteCat} onAdd={addCat} onReorder={reorderCatalog}
        onDone={() => setEditMode(false)} />
    )
  }

  const ensureProgress = async (catId: string): Promise<string> => {
    const existing = progByCat.get(catId)
    if (existing) return String(existing.id)
    const { data, error } = await upsertAmtrRow(
      'amtr_jqs_progress',
      { base_id: installationId, member_id: memberId, catalog_id: catId },
      { onConflict: 'member_id,catalog_id' },
    )
    if (error) { toast.error(error); return '' }
    return String(data?.id ?? '')
  }
  const setDate = async (catId: string, field: 'start_date' | 'complete_date', value: string) => {
    const { error } = await upsertAmtrRow(
      'amtr_jqs_progress',
      { base_id: installationId, member_id: memberId, catalog_id: catId, [field]: value || null },
      { onConflict: 'member_id,catalog_id' },
    )
    if (error) { toast.error(error); return }
    onChange()
  }

  // Build section → items grouping in catalog order.
  const groups: { section: Row | null; items: Row[] }[] = []
  for (const c of catalog) {
    if (c.retired) continue
    if (c.kind === 'section') groups.push({ section: c, items: [] })
    else {
      if (groups.length === 0) groups.push({ section: null, items: [] })
      groups[groups.length - 1].items.push(c)
    }
  }

  const sectionIds = groups.filter((g) => g.section).map((g) => String(g.section!.id))
  const allCollapsed = sectionIds.length > 0 && sectionIds.every((id) => collapsed.has(id))
  const toggleAll = () => setCollapsed(allCollapsed ? new Set() : new Set(sectionIds))
  const sectionCount = catalog.filter((c) => c.kind === 'section').length
  const taskCount = catalog.filter((c) => c.kind !== 'section').length

  return (
    <div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>1C7X1 Catalog</h2>
      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>{sectionCount} sections · {taskCount} tasks</span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
          <input type="checkbox" checked={showTR} onChange={(e) => setShowTR(e.target.checked)} /> Show TR references
        </label>
        <Btn variant={requiredOnly ? 'primary' : 'secondary'} onClick={() => setRequiredOnly((v) => !v)}>
          {requiredOnly ? 'Showing required' : 'Required only'}
        </Btn>
        {canManage && <Btn variant="secondary" onClick={() => setEditMode(true)}><Pencil size={14} /> Edit catalog</Btn>}
        <Btn variant="ghost" onClick={toggleAll}>{allCollapsed ? 'Expand all' : 'Collapse all'}</Btn>
      </div>
    </div>
    <div className="card" style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 240px)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)', minWidth: 820 }}>
        <thead>
          <tr>
            <th style={{ ...gcell, width: 30, top: 0 }} rowSpan={2} />
            <th style={{ ...gcell, top: 0, textAlign: 'left' }} rowSpan={2}>1. Tasks, Knowledge &amp; Technical References</th>
            <th style={{ ...gcell, top: 0 }} colSpan={2}>2. Core Tasks</th>
            <th style={{ ...gcell, top: 0 }} colSpan={5}>3. OJT Task Certification Documentation</th>
            <th style={{ ...gcell, top: 0 }} colSpan={4}>4. Proficiency Codes</th>
          </tr>
          <tr>
            <th style={{ ...hcell, top: 29 }}>Core/<br />Cert</th>
            <th style={{ ...hcell, top: 29 }}>Dep /<br />SEI</th>
            <th style={{ ...hcell, top: 29 }}>Start</th>
            <th style={{ ...hcell, top: 29 }}>Complete</th>
            <th style={{ ...hcell, top: 29 }}>Tr</th>
            <th style={{ ...hcell, top: 29 }}>Trn</th>
            <th style={{ ...hcell, top: 29 }}>Cert</th>
            <th style={{ ...hcell, top: 29 }}>3</th><th style={{ ...hcell, top: 29 }}>5</th><th style={{ ...hcell, top: 29 }}>7</th><th style={{ ...hcell, top: 29 }}>9</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g, gi) => {
            const secId = g.section ? String(g.section.id) : `g${gi}`
            const open = !collapsed.has(secId)
            const items = requiredOnly ? g.items.filter((i) => i.required) : g.items
            if (requiredOnly && items.length === 0) return null
            return (
              <SectionGroup key={secId}
                section={g.section} items={items} open={open} showTR={showTR}
                onToggle={() => setCollapsed((prev) => { const n = new Set(prev); n.has(secId) ? n.delete(secId) : n.add(secId); return n })}
                progByCat={progByCat} highlightItem={highlightItem}
                canWrite={canWrite} canEnterData={canEnterData} myRoles={myRoles} isOwn={isOwn} reopenAllowed={reopenAllowed}
                setDate={setDate} ensureProgress={ensureProgress} sign={sign} reopen={reopen} notifySignoff={notifySignoff}
              />
            )
          })}
        </tbody>
      </table>
    </div>
    </div>
  )
}

function SectionGroup(props: {
  section: Row | null; items: Row[]; open: boolean; showTR: boolean; onToggle: () => void
  progByCat: Map<string, Row>; highlightItem: string | null
  canWrite: boolean; canEnterData: boolean; myRoles: AmtrRole[]; isOwn: boolean; reopenAllowed: boolean
  setDate: (catId: string, field: 'start_date' | 'complete_date', v: string) => void
  ensureProgress: (catId: string) => Promise<string>
  sign: SignFn; reopen: ReopenFn; notifySignoff: (slot: SignSlot, itemRef: string, itemId: string) => Promise<void>
}) {
  const { section, items, open, showTR, onToggle, progByCat, highlightItem, canWrite, canEnterData, myRoles, isOwn, reopenAllowed, setDate, ensureProgress, sign, reopen, notifySignoff } = props
  return (
    <>
      {section && (
        <tr style={{ background: 'color-mix(in srgb, var(--color-accent) 22%, var(--color-bg-surface))', borderTop: '1px solid var(--color-border)' }}>
          <td colSpan={13} style={{ padding: '9px 12px', cursor: 'pointer' }} onClick={onToggle}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--color-text-1)' }}>
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {section.number ? `${section.number}. ` : ''}{String(section.title)}
            </span>
            {showTR && section.training_refs ? (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', marginTop: 2, paddingLeft: 20 }}>
                TR: {String(section.training_refs)}
              </div>
            ) : null}
          </td>
        </tr>
      )}
      {open && items.map((c, idx) => {
        const catId = String(c.id)
        const p = progByCat.get(catId)
        const hi = highlightItem === catId
        const required = !!c.required
        // Required items are flagged by the inset-shadow side bar on the
        // first cell (below); no row-wide tint — feedback was that the
        // full-row amber wash made the table noisy. Highlight (URL anchor)
        // and zebra striping remain.
        const bg = hi ? 'var(--color-accent-glow)'
          : idx % 2 === 1 ? 'color-mix(in srgb, var(--color-accent) 5%, transparent)' : undefined
        const signCell = (slot: SignSlot) => (
          <td style={{ ...cell, textAlign: 'center' }}>
            <Initials
              value={(p?.[`${slot}_initials`] as string) ?? null}
              canSign={canWrite && canSignSlot(myRoles, slot, isOwn)}
              canReopenSlot={reopenAllowed && !!p?.[`${slot}_signed_by`]}
              onReopen={() => p?.id && reopen('amtr_jqs_progress', String(p.id), slot)}
              onSign={async () => {
                const rowId = await ensureProgress(catId)
                if (!rowId) return
                await sign('amtr_jqs_progress', rowId, slot, async () => {
                  if (slot !== 'trainee') await notifySignoff(slot, String(c.number ?? c.title), catId)
                })
              }}
            />
          </td>
        )
        return (
          <tr key={catId} data-amtr-item={catId} style={{ borderBottom: '1px solid var(--color-border)', background: bg }}>
            <td style={{ ...cell, textAlign: 'center', boxShadow: required ? 'inset 3px 0 0 var(--color-warning)' : undefined }} />
            <td style={{ ...cell, paddingLeft: 8 + Number(c.depth ?? 0) * 12 }}>
              <span style={{ color: 'var(--color-text-3)' }}>{c.number ? `${String(c.number)} ` : ''}</span>{String(c.title)}
            </td>
            <td style={{ ...cell, textAlign: 'center' }}>{c.core_cert ? String(c.core_cert) : ''}</td>
            <td style={{ ...cell, maxWidth: 80, whiteSpace: 'normal', textAlign: 'center' }}>{c.deploy_sei ? String(c.deploy_sei) : ''}</td>
            <td style={cell}>
              <input type="date" className="input-dark" style={dateInput} disabled={!canEnterData}
                defaultValue={p?.start_date ? String(p.start_date).slice(0, 10) : ''}
                onBlur={(e) => canEnterData && setDate(catId, 'start_date', e.target.value)} />
            </td>
            <td style={cell}>
              <input type="date" className="input-dark" style={dateInput} disabled={!canEnterData}
                defaultValue={p?.complete_date ? String(p.complete_date).slice(0, 10) : ''}
                onBlur={(e) => canEnterData && setDate(catId, 'complete_date', e.target.value)} />
            </td>
            {signCell('trainee')}{signCell('trainer')}{signCell('certifier')}
            <td style={{ ...cell, textAlign: 'center' }}>{c.prof3 ? String(c.prof3) : ''}</td>
            <td style={{ ...cell, textAlign: 'center' }}>{c.prof5 ? String(c.prof5) : ''}</td>
            <td style={{ ...cell, textAlign: 'center' }}>{c.prof7 ? String(c.prof7) : ''}</td>
            <td style={{ ...cell, textAlign: 'center' }}>{c.prof9 ? String(c.prof9) : ''}</td>
          </tr>
        )
      })}
    </>
  )
}

const hcell: React.CSSProperties = { position: 'sticky', zIndex: 2, background: 'var(--color-bg-elevated)', padding: '5px 6px', textAlign: 'center', fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--color-text-3)', borderBottom: '1px solid var(--color-border)', fontWeight: 700, whiteSpace: 'nowrap' }
const gcell: React.CSSProperties = { position: 'sticky', zIndex: 3, background: 'var(--color-bg-elevated)', padding: '6px 8px', textAlign: 'center', fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--color-text-2)', borderBottom: '1px solid var(--color-border)', borderLeft: '1px solid var(--color-border)', fontWeight: 700, whiteSpace: 'nowrap' }
const cell: React.CSSProperties = { padding: '5px 6px', verticalAlign: 'top' }
const dateInput: React.CSSProperties = { padding: '3px 5px', fontSize: 'var(--fs-xs)', width: 112 }
const eIn: React.CSSProperties = { padding: '4px 6px', fontSize: 'var(--fs-xs)' }

// ── NAMT/AFM catalog editor (base-shared; propagates to all members) ──
function CatalogEditor({ catalog, trOptions, onUpdate, onDelete, onAdd, onReorder, onDone }: {
  catalog: Row[]; trOptions: string[]
  onUpdate: (id: string, patch: Row) => void; onDelete: (id: string) => void
  onAdd: (kind: 'section' | 'item') => void; onReorder: (from: number, to: number) => void; onDone: () => void
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)', padding: 2, display: 'inline-flex' }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 10, borderRadius: 8, background: 'color-mix(in srgb, var(--color-warning) 16%, transparent)', border: '1px solid color-mix(in srgb, var(--color-warning) 40%, transparent)', flexWrap: 'wrap' }}>
        <strong style={{ color: 'var(--color-warning)' }}>Editing catalog</strong>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>Changes apply to every member&apos;s record. Mark installation-required tasks to highlight them.</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Btn variant="secondary" onClick={() => onAdd('section')}>+ Section</Btn>
          <Btn variant="secondary" onClick={() => onAdd('item')}>+ Item</Btn>
          <Btn variant="primary" onClick={onDone}>Done</Btn>
        </div>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        {catalog.map((c, idx) => {
          const id = String(c.id)
          const isSection = c.kind === 'section'
          const required = !!c.required
          return (
            <div key={id}
              onDragOver={(e) => { e.preventDefault(); if (overIdx !== idx) setOverIdx(idx) }}
              onDrop={() => { if (dragIdx !== null) onReorder(dragIdx, idx); setDragIdx(null); setOverIdx(null) }}
              style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', flexWrap: 'wrap',
              borderBottom: '1px solid var(--color-border)',
              borderTop: overIdx === idx && dragIdx !== null && dragIdx !== idx ? '2px solid var(--color-accent)' : '2px solid transparent',
              opacity: dragIdx === idx ? 0.4 : 1,
              background: isSection ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)' : required ? 'color-mix(in srgb, var(--color-warning) 24%, var(--color-bg-surface))' : undefined,
            }}>
              <span
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
                title="Drag to reorder"
                style={{ ...iconBtn, cursor: 'move', userSelect: 'none' }}><GripVertical size={15} /></span>
              <select className="input-dark" style={{ ...eIn, width: 90 }} defaultValue={isSection ? 'section' : 'item'} onChange={(e) => onUpdate(id, { kind: e.target.value })}>
                <option value="section">Section</option><option value="item">Item</option>
              </select>
              {!isSection && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  <button style={iconBtn} onClick={() => onUpdate(id, { depth: Math.max(0, Number(c.depth ?? 0) - 1) })}>−</button>
                  <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', width: 12, textAlign: 'center' }}>{Number(c.depth ?? 0)}</span>
                  <button style={iconBtn} onClick={() => onUpdate(id, { depth: Math.min(4, Number(c.depth ?? 0) + 1) })}>+</button>
                </span>
              )}
              <input className="input-dark" style={{ ...eIn, width: 70 }} defaultValue={(c.number as string) ?? ''} placeholder="#" onBlur={(e) => onUpdate(id, { number: e.target.value || null })} />
              <input className="input-dark" style={{ ...eIn, flex: 1, minWidth: 200 }} defaultValue={(c.title as string) ?? ''} placeholder="Title" onBlur={(e) => onUpdate(id, { title: e.target.value })} />
              {!isSection && (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)' }}>
                  <input type="checkbox" defaultChecked={required} onChange={(e) => onUpdate(id, { required: e.target.checked })} /> Req
                </label>
              )}
              {isSection ? (
                <>
                  <input className="input-dark" list="amtr-tr-options" style={{ ...eIn, width: 220 }} defaultValue={(c.training_refs as string) ?? ''} placeholder="Training References" onBlur={(e) => onUpdate(id, { training_refs: e.target.value || null })} />
                  <datalist id="amtr-tr-options">{trOptions.map((t) => <option key={t} value={t} />)}</datalist>
                </>
              ) : (
                <>
                  <input className="input-dark" style={{ ...eIn, width: 50 }} defaultValue={(c.core_cert as string) ?? ''} placeholder="Core" onBlur={(e) => onUpdate(id, { core_cert: e.target.value || null })} />
                  {(['prof3', 'prof5', 'prof7', 'prof9'] as const).map((pf) => (
                    <input key={pf} className="input-dark" style={{ ...eIn, width: 34 }} defaultValue={(c[pf] as string) ?? ''} title={pf} onBlur={(e) => onUpdate(id, { [pf]: e.target.value || null })} />
                  ))}
                </>
              )}
              <button style={{ ...iconBtn, color: 'var(--color-danger)' }} onClick={() => onDelete(id)} title="Delete"><Trash2 size={14} /></button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
