'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Pencil, ExternalLink, Plus, Trash2, X, BookOpen } from 'lucide-react'
import { upsertAmtrRow, updateAmtrRow, deleteAmtrRow, fetchAmtrByBase, createAmtrNotification, type AmtrMember, type AmtrRole } from '@/lib/supabase/amtr'
import { buildSignoff, buildTrainingDue, fireToTrainingTeam, type NotificationDraft } from '@/lib/amtr/notifications'
import { dueStatus, computeNextDue } from '@/lib/amtr/status'
import { canSignSlot, canReopen, type SignSlot } from '@/lib/amtr/roles'
import { StatusPill } from '@/components/amtr/status-pill'
import { SignCell } from '@/components/amtr/signable'
import { SimpleCatalogEditor } from '@/components/amtr/simple-catalog-editor'
import { Btn, thStyle, tdStyle } from '@/components/amtr/ui'

const FREQ_OPTIONS = ['', 'Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'Biennial', 'Triennial', 'As Required']

type Row = Record<string, unknown>
type SignFn = (table: 'amtr_1098_progress', rowId: string, slot: SignSlot, onSigned?: () => Promise<void>) => Promise<void>
type ReopenFn = (table: 'amtr_1098_progress', rowId: string, slot: SignSlot) => Promise<void>

export function Form1098Tab(props: {
  catalog: Row[]; progress: Row[]; canWrite: boolean; canEnterData: boolean; canManage: boolean
  installationId: string; memberId: string; member: AmtrMember; myRoles: AmtrRole[]; isOwn: boolean
  highlightItem: string | null; sign: SignFn; reopen: ReopenFn; onChange: () => void
}) {
  const { catalog, progress, canWrite, canEnterData, canManage, installationId, memberId, member, myRoles, isOwn, highlightItem, sign, reopen, onChange } = props
  const [editMode, setEditMode] = useState(false)
  const currentYear = String(new Date().getUTCFullYear())
  const [year, setYear] = useState(currentYear)
  const [extraYears, setExtraYears] = useState<string[]>([])
  const [resources, setResources] = useState<Map<string, Row[]>>(new Map())
  const [resourceFor, setResourceFor] = useState<Row | null>(null)
  const years = Array.from(new Set([currentYear, ...extraYears, ...progress.map((p) => String(p.year_label)).filter(Boolean)])).sort((a, b) => b.localeCompare(a))
  const progByCat = new Map(progress.filter((p) => p.year_label === year).map((p) => [String(p.catalog_id), p]))
  const reopenAllowed = canReopen(myRoles)

  const loadResources = useCallback(async () => {
    const rows = await fetchAmtrByBase<Row>('amtr_1098_resources', installationId)
    const m = new Map<string, Row[]>()
    for (const r of rows) { const k = String(r.catalog_id); if (!m.has(k)) m.set(k, []); m.get(k)!.push(r) }
    setResources(m)
  }, [installationId])
  useEffect(() => {
    fetchAmtrByBase<Row>('amtr_1098_years', installationId).then((rows) => setExtraYears(rows.map((r) => String(r.year_label)).filter(Boolean)))
    loadResources()
  }, [installationId, loadResources])

  const addYear = async () => {
    const y = window.prompt('Add a prior year (e.g. 2024):')?.trim()
    if (!y || !/^\d{4}$/.test(y)) return
    await upsertAmtrRow('amtr_1098_years', { base_id: installationId, year_label: y, is_current: false })
    setExtraYears((prev) => Array.from(new Set([...prev, y])))
    setYear(y)
  }
  const deleteYear = async () => {
    if (year === currentYear) return
    if (!window.confirm(`Delete the ${year} 1098 for ${member.full_name}? This removes their ${year} entries (use to purge years past the retention requirement).`)) return
    // Remove this member's progress rows for the year.
    for (const p of progress.filter((x) => String(x.year_label) === year)) await deleteAmtrRow('amtr_1098_progress', String(p.id))
    // Remove the base year-tab row(s) for that label so the empty tab goes away.
    const yearRows = await fetchAmtrByBase<Row>('amtr_1098_years', installationId)
    for (const yr of yearRows.filter((r) => String(r.year_label) === year)) await deleteAmtrRow('amtr_1098_years', String(yr.id))
    setExtraYears((prev) => prev.filter((y) => y !== year))
    setYear(currentYear)
    onChange()
  }

  // Reconcile current-year due/overdue 1098 items → notify the whole training
  // team (trainee + trainers + NAMT + AFM). Idempotent (dedupe upsert); run
  // once per member per mount to limit chatter.
  const reconciledFor = useRef<string | null>(null)
  useEffect(() => {
    if (catalog.length === 0 || reconciledFor.current === memberId) return
    reconciledFor.current = memberId
    const curYearProg = new Map(progress.filter((p) => p.year_label === currentYear).map((p) => [String(p.catalog_id), p]))
    for (const c of catalog) {
      if (c.retired) continue
      const p = curYearProg.get(String(c.id))
      const next = (p?.next_due as string) ?? null
      if (!next) continue
      const s = dueStatus({ dueDate: next, completedDate: (p?.last_completed as string) ?? '' })
      if (s === 'due_soon' || s === 'overdue') {
        void fireToTrainingTeam(installationId, memberId, member.user_id, buildTrainingDue(String(c.task), next, String(c.id)))
      }
    }
  }, [memberId, catalog, progress, currentYear, installationId, member.user_id])

  if (editMode) {
    return (
      <SimpleCatalogEditor table="amtr_1098_catalog" rows={catalog} installationId={installationId}
        columns={[{ key: 'task', label: 'Task', flex: true }, { key: 'type', label: 'Type', width: 110 }, { key: 'frequency', label: 'Frequency', type: 'select', options: FREQ_OPTIONS, width: 130 }, { key: 'score_or_hours', label: 'Score/Hrs', width: 90 }]}
        defaults={{ task: 'New Task', frequency: 'Annual' }} onDone={() => setEditMode(false)} onChange={onChange} />
    )
  }

  if (catalog.length === 0) return <div className="card" style={{ color: 'var(--color-text-3)' }}>1098 catalog is empty — load it from Roles &amp; Catalogs.</div>
  const activeCatalog = catalog.filter((c) => !c.retired)

  const ensure = async (catId: string): Promise<string> => {
    const ex = progByCat.get(catId)
    if (ex) return String(ex.id)
    const { data } = await upsertAmtrRow('amtr_1098_progress', { base_id: installationId, member_id: memberId, catalog_id: catId, year_label: year })
    return String(data?.id ?? '')
  }
  const setField = async (catId: string, freq: string, field: string, value: string) => {
    const p = progByCat.get(catId)
    const patch: Row = { ...(p ?? {}), base_id: installationId, member_id: memberId, catalog_id: catId, year_label: year, [field]: value || null }
    if (field === 'last_completed') patch.next_due = computeNextDue(value, freq)
    await upsertAmtrRow('amtr_1098_progress', patch)
    // Auto-rollover: completing a task whose next due lands in a later year
    // seeds that task on the next year's 1098 (carrying the due date), so the
    // next year's record generates itself and shows the task as coming due.
    if (field === 'last_completed' && value && patch.next_due) {
      const nextYear = String(new Date(`${String(patch.next_due).slice(0, 10)}T00:00:00Z`).getUTCFullYear())
      const exists = progress.some((x) => String(x.catalog_id) === catId && String(x.year_label) === nextYear)
      if (Number(nextYear) > Number(year) && !exists) {
        await upsertAmtrRow('amtr_1098_progress', { base_id: installationId, member_id: memberId, catalog_id: catId, year_label: nextYear, next_due: patch.next_due })
      }
    }
    onChange()
  }

  const kpi = { required: activeCatalog.length, complete: 0, dueSoon: 0, overdue: 0 }
  for (const c of activeCatalog) {
    const p = progByCat.get(String(c.id))
    const s = dueStatus({ dueDate: (p?.next_due as string) ?? null, completedDate: (p?.last_completed as string) ?? '' })
    if (s === 'complete') kpi.complete++; else if (s === 'due_soon') kpi.dueSoon++; else if (s === 'overdue') kpi.overdue++
  }
  const kpiCards = [
    { label: 'Required', value: kpi.required },
    { label: 'Complete', value: kpi.complete, color: 'var(--color-success)' },
    { label: 'Due Soon', value: kpi.dueSoon, color: 'var(--color-warning)' },
    { label: 'Overdue', value: kpi.overdue, color: 'var(--color-danger)' },
  ]

  return (
    <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>DAF Form 1098 — Special Task Certification &amp; Recurring Training</h2>
      {canManage && <div style={{ marginLeft: 'auto' }}><Btn variant="secondary" onClick={() => setEditMode(true)}><Pencil size={14} /> Edit catalog</Btn></div>}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
      {kpiCards.map((k) => (
        <div key={k.label} className="card" style={{ padding: '12px 16px' }}>
          <div className="section-label" style={{ marginBottom: 4 }}>{k.label}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: k.color ?? 'var(--color-text-1)' }}>{k.value}</div>
        </div>
      ))}
    </div>
    <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      {years.map((y) => (
        <button key={y} onClick={() => setYear(y)}
          style={{ padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: year === y ? 700 : 600, background: year === y ? 'var(--color-accent)' : 'var(--color-bg-inset)', color: year === y ? '#fff' : 'var(--color-text-2)' }}>
          {y}{y === currentYear ? ' (current)' : ''}
        </button>
      ))}
      {canEnterData && <button onClick={addYear} title="Add a prior year for transcription" style={{ padding: '5px 10px', borderRadius: 6, border: '1px dashed var(--color-border-mid)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', background: 'transparent', color: 'var(--color-text-3)' }}>+ Add year</button>}
      {canEnterData && year !== currentYear && <button onClick={deleteYear} title="Delete this year's records" style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', background: 'transparent', color: 'var(--color-danger)' }}>Delete {year}</button>}
      <span style={{ marginLeft: 8, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>Completing a task auto-creates next year&apos;s 1098. Records are retained per year (two-year requirement).</span>
    </div>
    <div className="card" style={{ padding: 0, overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
        <thead>
          <tr>
            <th style={thStyle}>Task</th><th style={thStyle}>Start</th>
            <th style={{ ...thStyle, whiteSpace: 'normal', width: 90 }}>Last<br />Completed</th>
            <th style={{ ...thStyle, whiteSpace: 'normal', width: 64 }}>Cert<br />Official</th><th style={thStyle}>Trainee</th>
            <th style={thStyle}>Score/Hrs</th><th style={thStyle}>Type</th><th style={thStyle}>Freq</th>
            <th style={thStyle}>Due</th><th style={thStyle}>Status</th>
          </tr>
        </thead>
        <tbody>
          {activeCatalog.map((c) => {
            const catId = String(c.id)
            const p = progByCat.get(catId)
            const freq = String(c.frequency ?? 'Annual')
            const last = (p?.last_completed as string) ?? ''
            const next = (p?.next_due as string) ?? null
            const status = dueStatus({ dueDate: next, completedDate: last })
            const hi = highlightItem === catId
            const signCell = (slot: SignSlot) => (
              <td style={tdStyle}>
                <SignCell value={(p?.[`${slot}_initials`] as string) ?? null}
                  canSign={canWrite && canSignSlot(myRoles, slot, isOwn)}
                  canReopenSlot={reopenAllowed && !!p?.[`${slot}_signed_by`]}
                  onReopen={() => p?.id && reopen('amtr_1098_progress', String(p.id), slot)}
                  onSign={async () => {
                    const rid = await ensure(catId); if (!rid) return
                    await sign('amtr_1098_progress', rid, slot, async () => {
                      if (slot !== 'trainee' && member.user_id) {
                        const draft: NotificationDraft = buildSignoff(member.full_name, slot as AmtrRole, 'DAF 1098', String(c.task), catId, '1098')
                        await createAmtrNotification({ base_id: installationId, recipient_user_id: member.user_id, member_id: memberId, ...draft })
                      }
                    })
                  }} />
              </td>
            )
            return (
              <tr key={catId} data-amtr-item={catId} style={{ borderBottom: '1px solid var(--color-border)', background: hi ? 'var(--color-accent-glow)' : undefined }}>
                <td style={tdStyle}>
                  <button onClick={() => setResourceFor(c)} title="Training resources"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-text-1)', fontFamily: 'inherit', fontSize: 'inherit', textAlign: 'left', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {String(c.task)}
                    <BookOpen size={13} style={{ color: (resources.get(catId)?.length ?? 0) > 0 ? 'var(--color-accent)' : 'var(--color-text-3)', flexShrink: 0 }} />
                  </button>
                </td>
                <td style={tdStyle}><input type="date" className="input-dark" style={di} disabled={!canEnterData} defaultValue={p?.start_date ? String(p.start_date).slice(0, 10) : ''} onBlur={(e) => canEnterData && setField(catId, freq, 'start_date', e.target.value)} /></td>
                <td style={tdStyle}><input type="date" className="input-dark" style={di} disabled={!canEnterData} defaultValue={last ? last.slice(0, 10) : ''} onBlur={(e) => canEnterData && setField(catId, freq, 'last_completed', e.target.value)} /></td>
                {signCell('certifier')}{signCell('trainee')}
                <td style={tdStyle}>{c.score_or_hours ? String(c.score_or_hours) : '—'}</td>
                <td style={tdStyle}>{c.type ? String(c.type) : '—'}</td>
                <td style={tdStyle}>{freq}</td>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{next ? next.slice(0, 10) : '—'}</td>
                <td style={tdStyle}><StatusPill status={status} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    {resourceFor && (
      <ResourceDialog task={resourceFor} installationId={installationId} canManage={canManage}
        resources={resources.get(String(resourceFor.id)) ?? []} onClose={() => setResourceFor(null)} onChanged={loadResources} />
    )}
    </div>
  )
}

const di: React.CSSProperties = { padding: '3px 6px', fontSize: 'var(--fs-xs)', width: 130 }

// Per-task training resources — view links; NAMT (canManage) can add/edit/remove.
function ResourceDialog({ task, installationId, canManage, resources, onClose, onChanged }: {
  task: Row; installationId: string; canManage: boolean; resources: Row[]; onClose: () => void; onChanged: () => void
}) {
  const catId = String(task.id)
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const add = async () => {
    if (!label.trim()) return
    await upsertAmtrRow('amtr_1098_resources', { base_id: installationId, catalog_id: catId, label: label.trim(), url: url.trim() || null, sort_order: resources.length })
    setLabel(''); setUrl(''); onChanged()
  }
  const remove = async (id: string) => { await deleteAmtrRow('amtr_1098_resources', id); onChanged() }
  const edit = async (id: string, field: 'label' | 'url', value: string) => { await updateAmtrRow('amtr_1098_resources', id, { [field]: value || null }); onChanged() }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 560, maxWidth: '100%', maxHeight: '80vh', overflow: 'auto', padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <BookOpen size={16} style={{ color: 'var(--color-accent)' }} />
          <strong style={{ fontSize: 15 }}>{String(task.task)}</strong>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)' }}><X size={18} /></button>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginBottom: 10 }}>Training resources for this task.</div>
          {resources.length === 0 && <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', marginBottom: 10 }}>No resources added yet.</div>}
          <div style={{ display: 'grid', gap: 8 }}>
            {resources.map((r) => {
              const id = String(r.id); const link = (r.url as string) ?? ''
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {canManage ? (
                    <>
                      <input className="input-dark" style={{ width: 180, padding: '4px 6px', fontSize: 'var(--fs-xs)' }} defaultValue={(r.label as string) ?? ''} placeholder="Label" onBlur={(e) => edit(id, 'label', e.target.value)} />
                      <input className="input-dark" style={{ flex: 1, padding: '4px 6px', fontSize: 'var(--fs-xs)' }} defaultValue={link} placeholder="https://…" onBlur={(e) => edit(id, 'url', e.target.value)} />
                      <button onClick={() => remove(id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}><Trash2 size={14} /></button>
                    </>
                  ) : (
                    link
                      ? <a href={link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}>{String(r.label)} <ExternalLink size={13} /></a>
                      : <span style={{ fontSize: 'var(--fs-sm)' }}>{String(r.label)}</span>
                  )}
                </div>
              )
            })}
          </div>
          {canManage && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <input className="input-dark" style={{ width: 180, padding: '4px 6px', fontSize: 'var(--fs-xs)' }} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. Airfield Driving SOP)" />
              <input className="input-dark" style={{ flex: 1, minWidth: 160, padding: '4px 6px', fontSize: 'var(--fs-xs)' }} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
              <Btn variant="secondary" onClick={add} disabled={!label.trim()}><Plus size={14} /> Add</Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
