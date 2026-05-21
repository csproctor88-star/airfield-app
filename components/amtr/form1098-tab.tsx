'use client'

import { useState, useEffect, useRef } from 'react'
import { Pencil } from 'lucide-react'
import { upsertAmtrRow, createAmtrNotification, type AmtrMember, type AmtrRole } from '@/lib/supabase/amtr'
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
  const years = Array.from(new Set([currentYear, ...progress.map((p) => String(p.year_label)).filter(Boolean)])).sort((a, b) => b.localeCompare(a))
  const [year, setYear] = useState(currentYear)
  const progByCat = new Map(progress.filter((p) => p.year_label === year).map((p) => [String(p.catalog_id), p]))
  const reopenAllowed = canReopen(myRoles)

  // Reconcile current-year due/overdue 1098 items → notify the whole training
  // team (trainee + trainers + NAMT + AFM). Idempotent (dedupe upsert); run
  // once per member per mount to limit chatter.
  const reconciledFor = useRef<string | null>(null)
  useEffect(() => {
    if (catalog.length === 0 || reconciledFor.current === memberId) return
    reconciledFor.current = memberId
    const curYearProg = new Map(progress.filter((p) => p.year_label === currentYear).map((p) => [String(p.catalog_id), p]))
    for (const c of catalog) {
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
    onChange()
  }

  const kpi = { required: catalog.length, complete: 0, dueSoon: 0, overdue: 0 }
  for (const c of catalog) {
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
    {years.length > 1 && (
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {years.map((y) => (
          <button key={y} onClick={() => setYear(y)}
            style={{ padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: year === y ? 700 : 600, background: year === y ? 'var(--color-accent)' : 'var(--color-bg-inset)', color: year === y ? '#fff' : 'var(--color-text-2)' }}>
            {y}
          </button>
        ))}
      </div>
    )}
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
          {catalog.map((c) => {
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
                <td style={tdStyle}>{String(c.task)}</td>
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
    </div>
  )
}

const di: React.CSSProperties = { padding: '3px 6px', fontSize: 'var(--fs-xs)', width: 130 }
