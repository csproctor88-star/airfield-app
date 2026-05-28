'use client'

import { useState } from 'react'
import { GripVertical, Trash2, ClipboardCheck } from 'lucide-react'
import { toast } from 'sonner'
import { upsertAmtrRow, deleteAmtrRow, reorderAmtrRows, createAmtrNotification, type AmtrMember, type AmtrRole } from '@/lib/supabase/amtr'
import { build797Added, build797Signature, buildSignoff, fireToAllTrainers } from '@/lib/amtr/notifications'
import { canSignSlot, canReopen, type SignSlot } from '@/lib/amtr/roles'
import { type TranscribeRow } from '@/lib/amtr/transcribe'
import { useBulkTranscribe, TranscribeBar } from '@/components/amtr/transcribe-bar'
import { SignCell } from '@/components/amtr/signable'
import { Btn, thStyle, tdStyle } from '@/components/amtr/ui'
import { EmptyState } from '@/components/ui/empty-state'
import type { SignSource } from '@/components/amtr/auto-623a-dialog'

type Row = Record<string, unknown>
type SignFn = (table: 'amtr_797', rowId: string, slot: SignSlot, onSigned?: () => Promise<void>, source?: SignSource) => Promise<void>
type ReopenFn = (table: 'amtr_797', rowId: string, slot: SignSlot) => Promise<void>
const MILESTONE_WINDOWS = ['', '1-30 Days', '30-60 Days', '60-90 Days', '90-120 Days', '120-180 Days']
// Certifier is excluded — it isn't transcribed (it's cleared on transcribe).
const TX_SLOTS: SignSlot[] = ['trainee', 'trainer']

export function Form797Tab(props: {
  items: Row[]; canWrite: boolean; canEnterData: boolean; installationId: string; memberId: string
  member: AmtrMember; myRoles: AmtrRole[]; myUserId: string | null; isOwn: boolean; highlightItem: string | null
  sign: SignFn; reopen: ReopenFn; onChange: () => void
}) {
  const { items, canWrite, canEnterData, installationId, memberId, member, myRoles, myUserId, isOwn, highlightItem, sign, reopen, onChange } = props
  const reopenAllowed = canReopen(myRoles)
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newReqCert, setNewReqCert] = useState(true)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const tx = useBulkTranscribe({ table: 'amtr_797', slots: TX_SLOTS, myRoles, isOwn, onChange })
  const txRows: TranscribeRow[] = tx.mode
    ? items.map((it) => ({
        key: String(it.id),
        signRowId: String(it.id),
        completed: !!it.complete_date,
      }))
    : []

  const addItem = async () => {
    const task = newTitle.trim()
    if (!task) return
    const { data, error } = await upsertAmtrRow('amtr_797', { base_id: installationId, member_id: memberId, task, requires_certifier: newReqCert, added_by: myUserId, sort_order: items.length })
    if (error) { toast.error(error); return }
    if (member.user_id && data?.id) {
      await createAmtrNotification({ base_id: installationId, recipient_user_id: member.user_id, member_id: memberId, ...build797Added('A trainer', task, String(data.id)) })
    }
    setNewTitle(''); setNewReqCert(true); setShowAdd(false); onChange()
  }
  const setField = async (it: Row, field: string, value: unknown) => {
    const { error } = await upsertAmtrRow('amtr_797', { ...it, [field]: value })
    if (error) { toast.error(error); return }
    onChange()
  }
  const removeItem = async (id: string) => {
    if (!window.confirm('Delete this 797 task?')) return
    const { error } = await deleteAmtrRow('amtr_797', id)
    if (error) { toast.error(error); return }
    onChange()
  }
  const reorder = async (from: number, to: number) => {
    if (from === to) return
    const arr = [...items]
    const [moved] = arr.splice(from, 1); arr.splice(to, 0, moved)
    await reorderAmtrRows('amtr_797', arr.map((r, i) => ({ ...r, sort_order: i })))
    onChange()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>DAF Form 797 — Job Qualification Standard Continuation / Command JQS</h2>
      </div>
      <div style={{ padding: '10px 12px', marginBottom: 12, borderRadius: 8, fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', borderLeft: '3px solid var(--color-accent)', background: 'var(--color-bg-inset)' }}>
        Use this tab for individuals in <strong>local qualification training</strong>. If previously completed in AFTR or prior to the current local training guide, transcribe IAW the 1C7 CFETP, complete training for new items, and attach the exported record in the Files tab.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <strong>Task Log ({items.length})</strong>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {canWrite && tx.txSlots.length > 0 && (
            <Btn variant={tx.mode ? 'primary' : 'secondary'} onClick={tx.toggleMode}><ClipboardCheck size={14} /> {tx.mode ? 'Exit transcribe' : 'Transcribe'}</Btn>
          )}
          {canEnterData && !showAdd && <Btn variant="primary" onClick={() => setShowAdd(true)}>+ Add task</Btn>}
        </div>
      </div>
      {tx.mode && <TranscribeBar tx={tx} rows={txRows} note={<>Stamps the <strong>{tx.slot === 'trainer' ? 'Trainer' : 'Trainee'}</strong> column on selected completed tasks — overrides existing initials, sets the Completed date to today, and clears the Certifier column (certifier sign-offs aren’t transcribed).</>} />}

      {showAdd && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Task Title</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="input-dark" autoFocus style={{ flex: 1, minWidth: 280 }} placeholder="e.g. 7.7.1. Perform Airfield Driving Procedures"
              value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addItem() }} />
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
              <input type="checkbox" checked={newReqCert} onChange={(e) => setNewReqCert(e.target.checked)} /> Requires certifier initials
            </label>
            <Btn variant="ghost" onClick={() => { setShowAdd(false); setNewTitle('') }}>Cancel</Btn>
            <Btn variant="primary" onClick={addItem} disabled={!newTitle.trim()}>Add task</Btn>
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 6 }}>Uncheck <em>Requires certifier initials</em> for tasks signed off by the trainer alone (no separate certifier sign-off required).</div>
        </div>
      )}

      {items.length === 0 ? <EmptyState message="No 797 items." /> : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 30 }} />
                <th style={thStyle}>Task</th><th style={thStyle}>Start</th><th style={thStyle}>Complete</th>
                <th style={thStyle}>Tr</th><th style={thStyle}>Trn</th><th style={thStyle}>Cert</th>
                <th style={thStyle}>Local Milestone</th><th style={thStyle}>Cert req.</th>
                <th style={{ ...thStyle, width: 30 }} />
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => {
                const id = String(it.id)
                const hi = highlightItem === id
                // Per-item certification requirement is stored on the
                // 797 row itself; suppress the certifier Sign cell for
                // rows where it's off so the table doesn't prompt for
                // a step the trainer didn't flag.
                const itemRequiresCert = !!it.requires_certifier
                const signCell = (slot: SignSlot) => (
                  <td style={tdStyle}>
                    <SignCell value={(it[`${slot}_initials`] as string) ?? null}
                      canSign={canWrite && canSignSlot(myRoles, slot, isOwn) && (slot !== 'certifier' || itemRequiresCert)}
                      canReopenSlot={reopenAllowed && !!it[`${slot}_signed_by`]}
                      onReopen={() => reopen('amtr_797', id, slot)}
                      onSign={() => sign('amtr_797', id, slot, async () => {
                        if (slot === 'trainee') {
                          await fireToAllTrainers(installationId, memberId, build797Signature(member.full_name, String(it.task), id), myUserId ?? undefined)
                        } else if (member.user_id) {
                          await createAmtrNotification({ base_id: installationId, recipient_user_id: member.user_id, member_id: memberId, ...buildSignoff(member.full_name, slot as AmtrRole, 'DAF 797', String(it.task), id, '797') })
                        }
                      }, {
                        kind: '797',
                        label: String(it.task ?? ''),
                        requiresCertifier: itemRequiresCert,
                        // Pre-fill data for the Task Certification
                        // template on certifier sign.
                        extra: {
                          complete_date: it.complete_date ? String(it.complete_date) : '',
                          milestone_window: it.milestone_window ? String(it.milestone_window) : '',
                        },
                      })} />
                  </td>
                )
                return (
                  <tr key={id} data-amtr-item={id}
                    onDragOver={(e) => { if (canEnterData) { e.preventDefault(); if (overIdx !== idx) setOverIdx(idx) } }}
                    onDrop={() => { if (dragIdx !== null) reorder(dragIdx, idx); setDragIdx(null); setOverIdx(null) }}
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      background: hi ? 'var(--color-accent-glow)' : undefined,
                      borderTop: overIdx === idx && dragIdx !== null && dragIdx !== idx ? '2px solid var(--color-accent)' : undefined,
                      opacity: dragIdx === idx ? 0.4 : 1,
                    }}>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {tx.mode ? (
                        <input type="checkbox" checked={tx.selected.has(id)} disabled={!it.complete_date}
                          onChange={() => tx.toggleSelect(id)}
                          title={it.complete_date ? 'Select for transcription' : 'No completed date — not selectable'}
                          style={{ cursor: it.complete_date ? 'pointer' : 'not-allowed' }} />
                      ) : (canEnterData && (
                        <span draggable onDragStart={() => setDragIdx(idx)} onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
                          title="Drag to reorder" style={{ cursor: 'move', color: 'var(--color-text-3)', display: 'inline-flex' }}><GripVertical size={15} /></span>
                      ))}
                    </td>
                    <td style={tdStyle}>{String(it.task)}</td>
                    <td style={tdStyle}><input type="date" className="input-dark" style={dateInput} disabled={!canEnterData} defaultValue={it.start_date ? String(it.start_date).slice(0, 10) : ''} onBlur={(e) => canEnterData && setField(it, 'start_date', e.target.value || null)} /></td>
                    <td style={tdStyle}><input key={`comp-${id}-${String(it.complete_date ?? '')}`} type="date" className="input-dark" style={dateInput} disabled={!canEnterData} defaultValue={it.complete_date ? String(it.complete_date).slice(0, 10) : ''} onBlur={(e) => canEnterData && setField(it, 'complete_date', e.target.value || null)} /></td>
                    {signCell('trainee')}{signCell('trainer')}{signCell('certifier')}
                    <td style={tdStyle}>
                      <select className="input-dark" style={{ padding: '3px 6px', fontSize: 'var(--fs-xs)' }} disabled={!canEnterData}
                        defaultValue={(it.milestone_window as string) ?? ''} onChange={(e) => setField(it, 'milestone_window', e.target.value || null)}>
                        {MILESTONE_WINDOWS.map((w) => <option key={w} value={w}>{w || '—'}</option>)}
                      </select>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <input type="checkbox" disabled={!canEnterData} defaultChecked={!!it.requires_certifier} onChange={(e) => setField(it, 'requires_certifier', e.target.checked)} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {canEnterData && (
                        <button onClick={() => removeItem(id)} title="Delete task" style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', display: 'inline-flex' }}><Trash2 size={14} /></button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const dateInput: React.CSSProperties = { padding: '3px 6px', fontSize: 'var(--fs-xs)', width: 130 }
