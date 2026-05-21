'use client'

import { useState } from 'react'
import { upsertAmtrRow, createAmtrNotification, type AmtrMember, type AmtrRole } from '@/lib/supabase/amtr'
import { build797Added, build797Signature, buildSignoff, fireToAllTrainers } from '@/lib/amtr/notifications'
import { canSignSlot, canReopen, signoffVerb, type SignSlot } from '@/lib/amtr/roles'
import { SignCell, LockTag, ReopenButton } from '@/components/amtr/signable'
import { Btn, thStyle, tdStyle } from '@/components/amtr/ui'
import { EmptyState } from '@/components/ui/empty-state'

type Row = Record<string, unknown>
type SignFn = (table: 'amtr_797', rowId: string, slot: SignSlot, already: SignSlot[], onSigned?: () => Promise<void>) => Promise<void>
type ReopenFn = (table: 'amtr_797', rowId: string) => Promise<void>
const SLOTS: SignSlot[] = ['trainee', 'trainer', 'certifier']
const MILESTONE_WINDOWS = ['', '1-30 Days', '30-60 Days', '60-90 Days', '90-120 Days', '120-180 Days']

export function Form797Tab(props: {
  items: Row[]; canWrite: boolean; canEnterData: boolean; installationId: string; memberId: string
  member: AmtrMember; myRoles: AmtrRole[]; myUserId: string | null; highlightItem: string | null
  sign: SignFn; reopen: ReopenFn; onChange: () => void
}) {
  const { items, canWrite, canEnterData, installationId, memberId, member, myRoles, myUserId, highlightItem, sign, reopen, onChange } = props
  const reopenAllowed = canReopen(myRoles)
  const [showAdd, setShowAdd] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newReqCert, setNewReqCert] = useState(true)

  const addItem = async () => {
    const task = newTitle.trim()
    if (!task) return
    const { data } = await upsertAmtrRow('amtr_797', { base_id: installationId, member_id: memberId, task, requires_certifier: newReqCert, added_by: myUserId, sort_order: items.length })
    if (member.user_id && data?.id) {
      await createAmtrNotification({ base_id: installationId, recipient_user_id: member.user_id, member_id: memberId, ...build797Added('A trainer', task, String(data.id)) })
    }
    setNewTitle(''); setNewReqCert(true); setShowAdd(false); onChange()
  }
  const setField = async (it: Row, field: string, value: unknown) => {
    await upsertAmtrRow('amtr_797', { ...it, [field]: value })
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
        {canEnterData && !showAdd && <div style={{ marginLeft: 'auto' }}><Btn variant="primary" onClick={() => setShowAdd(true)}>+ Add task</Btn></div>}
      </div>

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
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 30 }} />
                <th style={thStyle}>Task</th><th style={thStyle}>Start</th><th style={thStyle}>Complete</th>
                <th style={thStyle}>Tr</th><th style={thStyle}>Trn</th><th style={thStyle}>Cert</th>
                <th style={thStyle}>Local Milestone</th><th style={thStyle}>Cert req.</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const id = String(it.id)
                const locked = !!it.locked_at
                const already = SLOTS.filter((s) => it[`${s}_initials`]) as SignSlot[]
                const hi = highlightItem === id
                const signCell = (slot: SignSlot) => (
                  <td style={tdStyle}>
                    <SignCell value={(it[`${slot}_initials`] as string) ?? null} locked={locked}
                      canSign={canWrite && !locked && canSignSlot(myRoles, slot, already.filter((x) => x !== slot))}
                      onSign={() => sign('amtr_797', id, slot, already, async () => {
                        if (slot === 'trainee') {
                          await fireToAllTrainers(installationId, memberId, build797Signature(member.full_name, String(it.task), id), myUserId ?? undefined)
                        } else if (member.user_id) {
                          await createAmtrNotification({ base_id: installationId, recipient_user_id: member.user_id, member_id: memberId, ...buildSignoff(member.full_name, slot as AmtrRole, 'DAF 797', String(it.task), id, '797') })
                        }
                      })} />
                  </td>
                )
                return (
                  <tr key={id} style={{ borderBottom: '1px solid var(--color-border)', background: hi ? 'var(--color-accent-glow)' : undefined }}>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>{locked ? <LockTag /> : null}</td>
                    <td style={tdStyle}>
                      {String(it.task)}
                      {locked && reopenAllowed && <span style={{ marginLeft: 8 }}><ReopenButton onReopen={() => reopen('amtr_797', id)} /></span>}
                    </td>
                    <td style={tdStyle}><input type="date" className="input-dark" style={dateInput} disabled={!canEnterData || locked} defaultValue={it.start_date ? String(it.start_date).slice(0, 10) : ''} onBlur={(e) => canEnterData && !locked && setField(it, 'start_date', e.target.value || null)} /></td>
                    <td style={tdStyle}><input type="date" className="input-dark" style={dateInput} disabled={!canEnterData || locked} defaultValue={it.complete_date ? String(it.complete_date).slice(0, 10) : ''} onBlur={(e) => canEnterData && !locked && setField(it, 'complete_date', e.target.value || null)} /></td>
                    {signCell('trainee')}{signCell('trainer')}{signCell('certifier')}
                    <td style={tdStyle}>
                      <select className="input-dark" style={{ padding: '3px 6px', fontSize: 'var(--fs-xs)' }} disabled={!canEnterData || locked}
                        defaultValue={(it.milestone_window as string) ?? ''} onChange={(e) => setField(it, 'milestone_window', e.target.value || null)}>
                        {MILESTONE_WINDOWS.map((w) => <option key={w} value={w}>{w || '—'}</option>)}
                      </select>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <input type="checkbox" disabled={!canEnterData || locked} defaultChecked={!!it.requires_certifier} onChange={(e) => setField(it, 'requires_certifier', e.target.checked)} />
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
