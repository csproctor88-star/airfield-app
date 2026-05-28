'use client'

import { useState, type ReactNode } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { toast } from 'sonner'
import { amtrTranscribe, type AmtrSignableTable, type AmtrRole } from '@/lib/supabase/amtr'
import type { SignSlot } from '@/lib/amtr/roles'
import { transcribableSlots, selectableKeys, actionableRows, type TranscribeRow } from '@/lib/amtr/transcribe'
import { Btn } from '@/components/amtr/ui'

const SLOT_LABELS: Record<SignSlot, string> = {
  trainee: 'Trainee', trainer: 'Trainer', certifier: 'Certifier', namt: 'NAMT', afm: 'AFM', evaluator: 'Evaluator',
}
export const transcribeSlotLabel = (s: SignSlot) => SLOT_LABELS[s] ?? s

/** Shared bulk-transcribe state + apply loop for the AMTR form tabs. Holds the
 * mode/selection/column/initials state and signs the actionable rows via the
 * audited amtr_sign RPC in small concurrent batches. Form-agnostic — the tab
 * supplies its signable table, slot set, and the normalized rows. */
export function useBulkTranscribe(opts: {
  table: AmtrSignableTable
  slots: SignSlot[]
  myRoles: AmtrRole[]
  isOwn: boolean
  onChange: () => void
}) {
  const { table, slots, myRoles, isOwn, onChange } = opts
  const txSlots = transcribableSlots(myRoles, isOwn, slots)
  const [mode, setMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [slot, setSlot] = useState<SignSlot>(slots[0])
  const [initials, setInitials] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)

  const toggleMode = () => {
    if (mode) { setMode(false); setSelected(new Set()); return }
    setSlot((prev) => (txSlots.includes(prev) ? prev : (txSlots[0] ?? slots[0])))
    setMode(true)
  }
  const toggleSelect = (key: string) =>
    setSelected((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n })
  const selectAll = (keys: string[]) => setSelected(new Set(keys))
  const clear = () => setSelected(new Set())

  const apply = async (rows: TranscribeRow[]) => {
    const init = initials.trim()
    if (!init) { toast.error('Enter the initials to insert.'); return }
    if (rows.length === 0) { toast.error('No completed items are selected for this column.'); return }
    const label = transcribeSlotLabel(slot)
    // The date transcription occurred (local) — replaces the Completed date.
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!window.confirm(`Transcribe the ${label} column for ${rows.length} item${rows.length === 1 ? '' : 's'}?\n\nSets the initials to "${init}" (replacing any existing) and the Completed date to ${today} on each item, recording your identity and a timestamp.`)) return
    setBusy(true); setDone(0); setTotal(rows.length)
    let ok = 0
    const errs: string[] = []
    const BATCH = 8
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH)
      const results = await Promise.all(chunk.map(async (r) => {
        if (!r.signRowId) return 'missing row'
        const { error } = await amtrTranscribe(table, r.signRowId, slot, init, today)
        return error ?? 'ok'
      }))
      for (const r of results) { if (r === 'ok') ok++; else errs.push(String(r)) }
      setDone(Math.min(i + BATCH, rows.length))
    }
    setBusy(false)
    if (errs.length) {
      toast.error(`Transcribed ${ok} · ${errs.length} error${errs.length === 1 ? '' : 's'}`)
      // eslint-disable-next-line no-console
      console.error('[AMTR transcribe errors]', errs)
    } else {
      toast.success(`Transcribed ${ok} ${label} item${ok === 1 ? '' : 's'}`)
    }
    setSelected(new Set())
    onChange()
  }

  return { txSlots, mode, toggleMode, selected, toggleSelect, selectAll, clear, slot, setSlot, initials, setInitials, busy, done, total, apply }
}

export type BulkTranscribe = ReturnType<typeof useBulkTranscribe>

/** The transcribe action bar. Renders select-all / clear / column picker /
 * initials / Apply, computing live selectable + actionable counts from the
 * tab's normalized rows. */
export function TranscribeBar({ tx, rows, note }: { tx: BulkTranscribe; rows: TranscribeRow[]; note?: ReactNode }) {
  const selectable = selectableKeys(rows)
  const actionable = actionableRows(rows, tx.selected, tx.slot)
  return (
    <div className="card" style={{ padding: '10px 14px', marginBottom: 10, border: '1px solid color-mix(in srgb, var(--color-accent) 45%, transparent)', background: 'color-mix(in srgb, var(--color-accent) 8%, transparent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 'var(--fs-sm)' }}>
          <ClipboardCheck size={15} /> Transcribe
        </span>
        <Btn variant="secondary" onClick={() => tx.selectAll(selectable)}>Select all completed ({selectable.length})</Btn>
        <Btn variant="ghost" onClick={tx.clear}>Clear</Btn>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>{tx.selected.size} selected</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
        <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Column</span>
        <div style={{ display: 'inline-flex', gap: 4, border: '1px solid var(--color-border-mid)', borderRadius: 8, padding: 3 }}>
          {tx.txSlots.map((s) => (
            <button key={s} onClick={() => tx.setSlot(s)}
              style={{ padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: tx.slot === s ? 700 : 600,
                background: tx.slot === s ? 'var(--color-accent)' : 'transparent',
                color: tx.slot === s ? '#fff' : 'var(--color-text-3)' }}>
              {transcribeSlotLabel(s)}
            </button>
          ))}
        </div>
        <input className="input-dark" placeholder="Initials (e.g. JD)" value={tx.initials} maxLength={8}
          onChange={(e) => tx.setInitials(e.target.value)} style={{ width: 150 }} />
        <Btn variant="primary" onClick={() => tx.apply(actionable)} disabled={tx.busy || actionable.length === 0 || !tx.initials.trim()}>
          {tx.busy ? `Transcribing… ${tx.done}/${tx.total}` : `Apply (${actionable.length})`}
        </Btn>
      </div>
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 8, lineHeight: 1.5 }}>
        {note ?? (
          <>Stamps the <strong>{transcribeSlotLabel(tx.slot)}</strong> column on selected completed items — overrides any existing initials, sets the Completed date to today, and records your identity + timestamp.</>
        )}
      </div>
    </div>
  )
}
