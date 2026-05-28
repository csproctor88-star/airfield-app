'use client'

import { useState, useEffect } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { upsertAmtrRow, deleteAmtrRow, fetchAmtrByBase, insertAmtrRows, type AmtrMember, type AmtrRole } from '@/lib/supabase/amtr'
import { canSignSlot, canReopen, type SignSlot } from '@/lib/amtr/roles'
import { type TranscribeRow } from '@/lib/amtr/transcribe'
import { useBulkTranscribe, TranscribeBar } from '@/components/amtr/transcribe-bar'
import { DAF803_SECTIONS } from '@/lib/amtr/reference-data'
import { SignCell } from '@/components/amtr/signable'
import { Btn, thStyle, tdStyle } from '@/components/amtr/ui'
import { EmptyState } from '@/components/ui/empty-state'
import { toast } from 'sonner'
import type { SignSource } from '@/components/amtr/auto-623a-dialog'

type Row = Record<string, unknown>
type SignFn = (table: 'amtr_803', rowId: string, slot: SignSlot, onSigned?: () => Promise<void>, source?: SignSource) => Promise<void>
type ReopenFn = (table: 'amtr_803', rowId: string, slot: SignSlot) => Promise<void>
const TX_SLOTS: SignSlot[] = ['evaluator']

const SECTION_NOTES: Record<string, string> = {
  apprenticeGrad: 'Apprentice Graduation — initial qualification entries.',
  amslAmos: 'AMSL / AMOS — operations supervisor / lead qualification task evaluations.',
  fiveLevel: '5-Level — journeyman upgrade task evaluations.',
  sevenLevel: '7-Level — craftsman upgrade task evaluations.',
  afm: 'AFM — Airfield Manager qualification task evaluations.',
}

export function Form803Tab(props: {
  rows: Row[]; canWrite: boolean; canEnterData: boolean; installationId: string; memberId: string
  member: AmtrMember; myRoles: AmtrRole[]; isOwn: boolean; sign: SignFn; reopen: ReopenFn; onChange: () => void
}) {
  const { rows, canWrite, canEnterData, installationId, memberId, myRoles, isOwn, sign, reopen, onChange } = props
  const [section, setSection] = useState<string>('apprenticeGrad')
  const [catalog, setCatalog] = useState<Row[]>([])
  const reopenAllowed = canReopen(myRoles)
  const sectionRows = rows.filter((r) => r.section === section)
  const tx = useBulkTranscribe({ table: 'amtr_803', slots: TX_SLOTS, myRoles, isOwn, onChange })
  const txRows: TranscribeRow[] = tx.mode
    ? sectionRows.map((r) => ({
        key: String(r.id),
        signRowId: String(r.id),
        completed: !!r.eval_date,
        certifierApplies: false,
      }))
    : []
  // Selection keys are row ids scoped to one section; clear when switching.
  const changeSection = (key: string) => { setSection(key); tx.clear() }

  useEffect(() => {
    let active = true
    fetchAmtrByBase<Row>('amtr_803_catalog', installationId).then((c) => { if (active) setCatalog(c) })
    return () => { active = false }
  }, [installationId])

  const addRow = async () => {
    const { error } = await upsertAmtrRow('amtr_803', { base_id: installationId, member_id: memberId, section, sort_order: sectionRows.length })
    if (error) { toast.error(error); return }
    onChange()
  }
  const populateStandard = async () => {
    const std = catalog.filter((c) => c.section === section && !c.retired)
    const existing = new Set(sectionRows.map((r) => String(r.sts_item ?? '').trim()).filter(Boolean))
    const toAdd = std.filter((c) => !existing.has(String(c.sts_item ?? '').trim()))
    if (toAdd.length === 0) { toast.info('All standard items already added for this section.'); return }
    const { error } = await insertAmtrRows('amtr_803', toAdd.map((c, i) => ({
      base_id: installationId, member_id: memberId, section, sts_item: c.sts_item, sort_order: sectionRows.length + i,
    })))
    if (error) { toast.error(error); return }
    toast.success(`Added ${toAdd.length} standard item${toAdd.length === 1 ? '' : 's'}`)
    onChange()
  }
  const stdCount = catalog.filter((c) => c.section === section && !c.retired).length
  const setField = async (r: Row, field: string, value: unknown) => {
    const { error } = await upsertAmtrRow('amtr_803', { ...r, [field]: value })
    if (error) { toast.error(error); return }
    onChange()
  }

  return (
    <div>
      <h2 style={{ margin: '0 0 10px', fontSize: 18 }}>DAF Form 803 — Report of Task Performance</h2>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {DAF803_SECTIONS.map((s) => {
          const count = rows.filter((r) => r.section === s.key).length
          const active = section === s.key
          return (
            <button key={s.key} onClick={() => changeSection(s.key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: active ? 700 : 600, background: active ? 'var(--color-accent)' : 'var(--color-bg-inset)', color: active ? '#fff' : 'var(--color-text-2)' }}>
              {s.label}
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: active ? 'rgba(255,255,255,0.25)' : 'var(--color-bg-surface)', color: active ? '#fff' : 'var(--color-text-3)' }}>{count}</span>
            </button>
          )
        })}
      </div>
      <div style={{ padding: '10px 12px', marginBottom: 12, borderRadius: 8, fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', borderLeft: '3px solid var(--color-accent)', background: 'var(--color-bg-inset)' }}>
        {SECTION_NOTES[section]}
      </div>
      {(canEnterData || (canWrite && tx.txSlots.length > 0)) && (
        <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canEnterData && <Btn variant="primary" onClick={addRow}>+ Add task evaluation</Btn>}
          {canEnterData && stdCount > 0 && <Btn variant="secondary" onClick={populateStandard}>Populate standard items ({stdCount})</Btn>}
          {canWrite && tx.txSlots.length > 0 && (
            <Btn variant={tx.mode ? 'primary' : 'secondary'} onClick={tx.toggleMode}><ClipboardCheck size={14} /> {tx.mode ? 'Exit transcribe' : 'Transcribe'}</Btn>
          )}
        </div>
      )}
      {tx.mode && <TranscribeBar tx={tx} rows={txRows} note={<>Stamps the <strong>Evaluator</strong> column on selected completed evaluations in this section — overrides any existing initials, sets the Date to today, and records your identity + timestamp.</>} />}
      {sectionRows.length === 0 ? <EmptyState message="No evaluations in this section." /> : (
        <div className="card" style={{ padding: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
            <thead>
              <tr>
                {tx.mode && <th style={{ ...thStyle, width: 30 }} />}
                <th style={thStyle}>JQS Item(s) Evaluated</th><th style={thStyle}>Date</th>
                <th style={thStyle}>In UGT</th><th style={thStyle}>Results</th><th style={thStyle}>Evaluator</th><th style={thStyle}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {sectionRows.map((r) => {
                const id = String(r.id)
                return (
                  <tr key={id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {tx.mode && (
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <input type="checkbox" checked={tx.selected.has(id)} disabled={!r.eval_date}
                          onChange={() => tx.toggleSelect(id)}
                          title={r.eval_date ? 'Select for transcription' : 'No date — not selectable'}
                          style={{ cursor: r.eval_date ? 'pointer' : 'not-allowed' }} />
                      </td>
                    )}
                    <td style={tdStyle}>
                      <input className="input-dark" style={{ ...di, width: '100%', minWidth: 220 }} disabled={!canEnterData} placeholder="e.g. 7.5.1" defaultValue={(r.sts_item as string) ?? ''} onBlur={(e) => canEnterData && setField(r, 'sts_item', e.target.value || null)} />
                    </td>
                    <td style={tdStyle}><input type="date" className="input-dark" style={di} disabled={!canEnterData} defaultValue={r.eval_date ? String(r.eval_date).slice(0, 10) : ''} onBlur={(e) => canEnterData && setField(r, 'eval_date', e.target.value || null)} /></td>
                    <td style={tdStyle}>
                      <select className="input-dark" style={sel} disabled={!canEnterData} defaultValue={(r.in_ugt as string) ?? ''} onChange={(e) => setField(r, 'in_ugt', e.target.value || null)}>
                        <option value="">—</option><option>Yes</option><option>No</option>
                      </select>
                    </td>
                    <td style={tdStyle}>
                      <select className="input-dark" style={sel} disabled={!canEnterData} defaultValue={(r.results as string) ?? ''} onChange={(e) => setField(r, 'results', e.target.value || null)}>
                        <option value="">—</option><option>SAT</option><option>UNSAT</option>
                      </select>
                    </td>
                    <td style={tdStyle}>
                      <SignCell value={(r.evaluator_initials as string) ?? null}
                        canSign={canWrite && canSignSlot(myRoles, 'evaluator', isOwn)}
                        canReopenSlot={reopenAllowed && !!r.evaluator_signed_by}
                        onReopen={() => reopen('amtr_803', id, 'evaluator')}
                        onSign={() => sign('amtr_803', id, 'evaluator', undefined, {
                          kind: '803',
                          label: String(r.sts_item ?? 'evaluation'),
                          // 803 evaluations are signed by the evaluator
                          // only — no separate certifier step in the
                          // 623A flow for this surface.
                          requiresCertifier: false,
                          // Pre-fill data for the DAF 803 evaluation
                          // one-liner on evaluator sign.
                          extra: {
                            eval_date: r.eval_date ? String(r.eval_date) : '',
                            results: r.results ? String(r.results) : '',
                            in_ugt: r.in_ugt ? String(r.in_ugt) : '',
                          },
                        })} />
                    </td>
                    <td style={tdStyle}>
                      <input className="input-dark" style={{ ...di, width: 180 }} disabled={!canEnterData} defaultValue={(r.remarks as string) ?? ''} placeholder={r.results === 'UNSAT' ? 'Deficiency + retrain plan' : 'Remarks'} onBlur={(e) => canEnterData && setField(r, 'remarks', e.target.value || null)} />
                      {canEnterData && <button onClick={async () => { await deleteAmtrRow('amtr_803', id); onChange() }} style={{ marginLeft: 6, background: 'none', border: 'none', color: 'var(--color-text-3)', cursor: 'pointer' }}>×</button>}
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

const di: React.CSSProperties = { padding: '3px 6px', fontSize: 'var(--fs-xs)', width: 130 }
const sel: React.CSSProperties = { padding: '3px 6px', fontSize: 'var(--fs-xs)', width: 80 }
