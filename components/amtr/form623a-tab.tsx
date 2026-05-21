'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown, X } from 'lucide-react'
import { upsertAmtrRow, updateAmtrRow, deleteAmtrRow, createAmtrNotification, type AmtrMember, type AmtrRole } from '@/lib/supabase/amtr'
import { buildSignoff } from '@/lib/amtr/notifications'
import { canSignSlot, canReopen, AMTR_ROLE_LABELS, type SignSlot } from '@/lib/amtr/roles'
import { SignCell, LockTag, ReopenButton } from '@/components/amtr/signable'
import { Btn } from '@/components/amtr/ui'
import { EmptyState } from '@/components/ui/empty-state'

type Row = Record<string, unknown>
type SignFn = (table: 'amtr_623a', rowId: string, slot: SignSlot, already: SignSlot[], onSigned?: () => Promise<void>) => Promise<void>
type ReopenFn = (table: 'amtr_623a', rowId: string) => Promise<void>

const ENTRY_TYPES = [
  'Quarterly Training Records Inspection', 'Initial Training', 'Recurring Training',
  'Monthly Proficiency Training', 'Trainer Appointment', 'Certifier Appointment',
  'ALS / PME', 'AFFSA Message Review', 'Records Transcription', 'General Comment',
]

const COLS: { slot: SignSlot; label: string; sig: string; ph: string }[] = [
  { slot: 'trainee', label: 'Trainee Comment', sig: 'Trainee signature', ph: 'What was worked on, started, or completed…' },
  { slot: 'trainer', label: 'Supervisor / Trainer Comment', sig: 'Trainer signature', ph: 'On-the-job training notes / direction' },
  { slot: 'namt', label: 'NAMT Comment', sig: 'NAMT signature', ph: 'NAMT review / direction' },
  { slot: 'afm', label: 'AFM Comment', sig: 'AFM signature', ph: 'AFM review / endorsement' },
]
const REQUIRED_SLOTS: SignSlot[] = ['trainee', 'trainer', 'namt', 'afm']

export function Form623aTab(props: {
  entries: Row[]; canWrite: boolean; canEnterData: boolean; installationId: string; memberId: string
  member: AmtrMember; myRoles: AmtrRole[]; effRole: AmtrRole | null
  highlightItem: string | null; sign: SignFn; reopen: ReopenFn; onChange: () => void
}) {
  const { entries, canWrite, canEnterData, installationId, memberId, member, myRoles, effRole, highlightItem, sign, reopen, onChange } = props
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [expanded, setExpanded] = useState<Set<string>>(new Set(highlightItem ? [highlightItem] : []))
  const reopenAllowed = canReopen(myRoles)

  const toggle = (id: string) => setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })

  const addEntry = async () => {
    const { data } = await upsertAmtrRow('amtr_623a', { base_id: installationId, member_id: memberId, form_date: new Date().toISOString().slice(0, 10) })
    if (data?.id) setExpanded((p) => new Set(p).add(String(data.id)))
    onChange()
  }
  const setField = async (id: string, field: string, value: string) => { await updateAmtrRow('amtr_623a', id, { [field]: value || null }); onChange() }
  const remove = async (id: string) => { if (window.confirm('Delete this 623A entry?')) { await deleteAmtrRow('amtr_623a', id); onChange() } }

  const filtered = entries
    .filter((e) => {
      if (!search) return true
      const hay = [e.entry_type, e.form_date, e.trainee_comment, e.trainer_comment, e.namt_comment, e.afm_comment,
        e.trainee_initials, e.trainer_initials, e.namt_initials, e.afm_initials].map((x) => String(x ?? '')).join(' ').toLowerCase()
      return hay.includes(search.toLowerCase())
    })
    .sort((a, b) => {
      const da = String(a.form_date ?? ''), db = String(b.form_date ?? '')
      return sort === 'newest' ? db.localeCompare(da) : da.localeCompare(db)
    })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>DAF Form 623A — Individual Training Record</h2>
        {canWrite && <div style={{ marginLeft: 'auto' }}><Btn variant="primary" onClick={addEntry}>+ New entry</Btn></div>}
      </div>

      {effRole && (
        <div style={{ padding: '8px 12px', marginBottom: 10, borderRadius: 8, fontSize: 'var(--fs-sm)', background: 'color-mix(in srgb, var(--color-success) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--color-success) 35%, transparent)', color: 'var(--color-text-2)' }}>
          <strong style={{ color: 'var(--color-success)' }}>{AMTR_ROLE_LABELS[effRole]} mode.</strong> You can sign the {AMTR_ROLE_LABELS[effRole]} column.
        </div>
      )}
      <div style={{ padding: '10px 12px', marginBottom: 12, borderRadius: 8, fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', borderLeft: '3px solid var(--color-accent)', background: 'var(--color-bg-inset)' }}>
        <strong>How this works.</strong> Trainee logs the activity (column 1). The Supervisor/Trainer documents on-the-job training (column 2). NAMT reviews and signs (column 3). AFM endorses (column 4). Each column may only be signed by the member assigned to that role.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <input className="input-dark" placeholder="Search by type, comment text, initials, or date…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
        <Btn variant={sort === 'newest' ? 'primary' : 'secondary'} onClick={() => setSort('newest')}>↓ Newest</Btn>
        <Btn variant={sort === 'oldest' ? 'primary' : 'secondary'} onClick={() => setSort('oldest')}>↑ Oldest</Btn>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', whiteSpace: 'nowrap' }}>{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</span>
      </div>

      {filtered.length === 0 ? <EmptyState message={entries.length === 0 ? 'No 623A entries yet.' : 'No entries match your search.'} /> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map((e) => {
            const id = String(e.id)
            const locked = !!e.locked_at
            const open = expanded.has(id)
            const already = REQUIRED_SLOTS.filter((s) => e[`${s}_initials`]) as SignSlot[]
            const hi = highlightItem === id
            return (
              <div key={id} className="card" style={{ padding: 14, background: hi ? 'var(--color-accent-glow)' : undefined }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Date
                    <input type="date" className="input-dark" style={{ display: 'block', marginTop: 4, width: 160 }} disabled={!canEnterData || locked}
                      defaultValue={e.form_date ? String(e.form_date).slice(0, 10) : ''} onBlur={(ev) => canEnterData && !locked && setField(id, 'form_date', ev.target.value)} />
                  </label>
                  <label style={{ flex: 1, minWidth: 240, fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Entry Type
                    <input className="input-dark" list="amtr-623a-types" style={{ display: 'block', marginTop: 4 }} placeholder="Type or pick…" disabled={!canEnterData || locked}
                      defaultValue={(e.entry_type as string) ?? ''} onBlur={(ev) => canEnterData && !locked && setField(id, 'entry_type', ev.target.value)} />
                  </label>
                  <Btn variant="ghost" onClick={() => toggle(id)}>{open ? <><ChevronDown size={14} /> Hide details</> : <><ChevronRight size={14} /> Show details</>}</Btn>
                  {locked ? <LockTag /> : null}
                  {locked && reopenAllowed && <ReopenButton onReopen={() => reopen('amtr_623a', id)} />}
                  {canWrite && !locked && <button onClick={() => remove(id)} title="Delete entry" style={{ background: 'none', border: 'none', color: 'var(--color-text-3)', cursor: 'pointer' }}><X size={16} /></button>}
                </div>

                {open && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginTop: 12 }}>
                    {COLS.map((col) => {
                      const mineToEdit = canEnterData || myRoles.includes(col.slot as AmtrRole)
                      return (
                        <div key={col.slot}>
                          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{col.label}</div>
                          <textarea className="input-dark" rows={4} style={{ resize: 'vertical' }} placeholder={col.ph} disabled={locked || !mineToEdit}
                            defaultValue={(e[`${col.slot}_comment`] as string) ?? ''} onBlur={(ev) => mineToEdit && !locked && setField(id, `${col.slot}_comment`, ev.target.value)} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                            <SignCell value={(e[`${col.slot}_initials`] as string) ?? null} locked={locked}
                              canSign={canWrite && !locked && canSignSlot(myRoles, col.slot, already.filter((x) => x !== col.slot))}
                              onSign={() => sign('amtr_623a', id, col.slot, already, async () => {
                                if (col.slot !== 'trainee' && member.user_id) {
                                  await createAmtrNotification({ base_id: installationId, recipient_user_id: member.user_id, member_id: memberId, ...buildSignoff(member.full_name, col.slot as AmtrRole, '623A', String(e.entry_type ?? 'entry'), id, '623a') })
                                }
                              })} />
                            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>{col.sig}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <datalist id="amtr-623a-types">{ENTRY_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
    </div>
  )
}
