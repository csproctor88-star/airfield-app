// components/flip/document-review-modal.tsx
'use client'

import { useState } from 'react'
import { Plus, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { createFlipReview, type FlipListItem, type NewReviewItem } from '@/lib/supabase/flip'

type Row = NewReviewItem

export function DocumentReviewModal({ baseId, flipList, open, onClose, onCreated }: {
  baseId: string; flipList: FlipListItem[]; open: boolean; onClose: () => void; onCreated: () => void
}) {
  const [cycle, setCycle] = useState('')
  const [reviewDate, setReviewDate] = useState('')
  const [rows, setRows] = useState<Row[]>([{ flip_title: '', effective_date: null, discrepancy: false, discrepancy_note: null, corrective_action: null, date_corrected: null }])
  const [busy, setBusy] = useState(false)
  if (!open) return null

  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const addRow = () => setRows((rs) => [...rs, { flip_title: '', effective_date: null, discrepancy: false, discrepancy_note: null, corrective_action: null, date_corrected: null }])
  const removeRow = (i: number) => setRows((rs) => rs.filter((_, idx) => idx !== i))

  const submit = async () => {
    if (!cycle.trim() || !reviewDate) { toast.error('Cycle and Review Date are required.'); return }
    const clean = rows.filter((r) => r.flip_title)
    if (clean.length === 0) { toast.error('Add at least one FLIP row.'); return }
    setBusy(true)
    const { error } = await createFlipReview({ baseId, cycle: cycle.trim(), reviewDate, items: clean })
    setBusy(false)
    if (error) { toast.error(error); return }
    setCycle(''); setReviewDate(''); setRows([{ flip_title: '', effective_date: null, discrepancy: false, discrepancy_note: null, corrective_action: null, date_corrected: null }])
    onCreated(); onClose(); toast.success('FLIP review documented')
  }

  const field: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit' }
  const label: React.CSSProperties = { display: 'block', fontSize: 'var(--fs-xs)', fontWeight: 600, marginBottom: 4, color: 'var(--color-text-2)' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--color-bg-surface)', borderRadius: 12, width: '100%', maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}>
        <header style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', fontWeight: 700 }}>Document FLIP Review</header>
        <div style={{ padding: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div><label style={label}>FLIP Cycle</label><input style={field} value={cycle} onChange={(e) => setCycle(e.target.value)} placeholder="e.g., 1 JAN 2026 – 24 MAR 2026" /></div>
            <div><label style={label}>FLIP Review Date</label><input type="date" style={field} value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} /></div>
          </div>

          {flipList.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderRadius: 8, background: 'var(--color-warning-bg, rgba(180,83,9,0.12))', border: '1px solid var(--color-warning)', color: 'var(--color-warning)', fontSize: 'var(--fs-sm)' }}>
              <TriangleAlert size={16} /> Add FLIP titles to the Local FLIP List (Home) before documenting a review.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-3)', marginBottom: 8 }}>FLIPs Reviewed</div>
              {rows.map((r, i) => (
                <div key={i} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 12, marginBottom: 10, background: 'var(--color-bg-inset)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)' }}>FLIP {i + 1}</span>
                    {rows.length > 1 && <button onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)' }}><Trash2 size={14} /></button>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div><label style={label}>FLIP Title</label>
                      <select style={field} value={r.flip_title} onChange={(e) => setRow(i, { flip_title: e.target.value })}>
                        <option value="">Select a FLIP…</option>
                        {flipList.map((f) => <option key={f.id} value={f.title}>{f.title}</option>)}
                      </select>
                    </div>
                    <div><label style={label}>Effective Date</label><input type="date" style={field} value={r.effective_date ?? ''} onChange={(e) => setRow(i, { effective_date: e.target.value || null })} /></div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label style={label}>Discrepancies</label>
                    <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', width: 160 }}>
                      <button onClick={() => setRow(i, { discrepancy: false, discrepancy_note: null, corrective_action: null, date_corrected: null })}
                        style={{ flex: 1, padding: 7, border: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', background: !r.discrepancy ? 'var(--color-success-bg, rgba(45,125,79,0.15))' : 'var(--color-bg-surface)', color: !r.discrepancy ? 'var(--color-success)' : 'var(--color-text-2)' }}>No</button>
                      <button onClick={() => setRow(i, { discrepancy: true })}
                        style={{ flex: 1, padding: 7, border: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', background: r.discrepancy ? 'var(--color-danger-bg, rgba(185,28,28,0.12))' : 'var(--color-bg-surface)', color: r.discrepancy ? 'var(--color-danger)' : 'var(--color-text-2)' }}>Yes</button>
                    </div>
                  </div>
                  {r.discrepancy && (
                    <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                      <div><label style={label}>Discrepancy</label><textarea style={{ ...field, minHeight: 56, resize: 'vertical' }} value={r.discrepancy_note ?? ''} onChange={(e) => setRow(i, { discrepancy_note: e.target.value })} /></div>
                      <div><label style={label}>Corrective Action</label><textarea style={{ ...field, minHeight: 56, resize: 'vertical' }} value={r.corrective_action ?? ''} onChange={(e) => setRow(i, { corrective_action: e.target.value })} /></div>
                      <div style={{ maxWidth: 220 }}><label style={label}>Date Corrected (§2.5.2.18.2.2.1)</label><input type="date" style={field} value={r.date_corrected ?? ''} onChange={(e) => setRow(i, { date_corrected: e.target.value || null })} /></div>
                    </div>
                  )}
                </div>
              ))}
              <button onClick={addRow} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: 8, borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}><Plus size={14} /> Add FLIP</button>
            </>
          )}
        </div>
        <footer style={{ padding: '12px 18px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}>Cancel</button>
          <button onClick={submit} disabled={busy || flipList.length === 0} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>{busy ? 'Saving…' : 'Complete Review'}</button>
        </footer>
      </div>
    </div>
  )
}
