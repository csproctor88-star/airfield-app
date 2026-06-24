// components/flip/change-card.tsx
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, CircleCheck, X } from 'lucide-react'
import { toast } from 'sonner'
import { updateFlipChange, approveFlipChange, type FlipChange } from '@/lib/supabase/flip'
import { uploadFlipFile, flipFileUrl } from '@/lib/supabase/flip-storage'

const STAGE_COLOR: Record<string, string> = {
  coordination: 'var(--color-warning)', submitted: 'var(--color-blue)', completed: 'var(--color-success)', rejected: 'var(--color-danger)',
}
function badgeLabel(c: FlipChange): string {
  if (c.rejected) return 'Rejected'
  return { coordination: 'Awaiting AFM Approval', submitted: 'Submitted / Awaiting Publication', completed: 'Published' }[c.stage]
}

export function ChangeCard({ change, isAfm, isCustodian, canWrite, baseId, onChange }: {
  change: FlipChange; isAfm: boolean; isCustodian: boolean; canWrite: boolean; baseId: string; onChange: () => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const c = change
  const stageKey = c.rejected ? 'rejected' : c.stage

  const setField = async (patch: Partial<FlipChange>) => {
    const { error } = await updateFlipChange(c.id, patch)
    if (error) { toast.error(error); return }
    onChange()
  }
  const approve = async () => { setBusy(true); const { error } = await approveFlipChange(c.id); setBusy(false); if (error) { toast.error(error); return } onChange(); toast.success('Approved — moved to Submitted') }
  const reject = async () => { setBusy(true); const { error } = await updateFlipChange(c.id, { stage: 'completed', rejected: true }); setBusy(false); if (error) { toast.error(error); return } onChange(); toast('Change rejected') }
  const publish = async () => {
    if (!c.creation_date || !c.published_date) { toast.error('Creation date and Published date are required to publish.'); return }
    const initials = window.prompt('Operating initials (annotated on the change notice per §2.5.2.18.2.2.8):', c.posted_initials ?? '')
    if (initials === null) return
    setBusy(true)
    const { error } = await updateFlipChange(c.id, { stage: 'completed', posted_initials: initials.trim() || null, posted_date: c.posted_date ?? new Date().toISOString().slice(0, 10) })
    setBusy(false)
    if (error) { toast.error(error); return }
    onChange(); toast.success('Marked published')
  }
  const onPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setBusy(true)
    const { path, error } = await uploadFlipFile(baseId, 'changes', f)
    setBusy(false)
    if (error || !path) { toast.error(error ?? 'Upload failed'); return }
    setField({ pdf_filename: f.name, pdf_storage_path: path })
  }

  const dateInput = (val: string | null, onSet: (v: string) => void, lbl: string) => (
    <div><div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', marginBottom: 3 }}>{lbl}{val ? ' ✓' : ''}</div>
      <input type="date" value={val ?? ''} onChange={(e) => onSet(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)', fontSize: 'var(--fs-xs)' }} /></div>
  )

  return (
    <div style={{ border: '1px solid var(--color-border)', borderLeft: `3px solid ${STAGE_COLOR[stageKey]}`, borderRadius: 10, marginBottom: 10, overflow: 'hidden', background: 'var(--color-bg-surface)' }}>
      <div onClick={() => setOpen((o) => !o)} style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
        {open ? <ChevronDown size={16} style={{ color: 'var(--color-text-3)', marginTop: 2 }} /> : <ChevronRight size={16} style={{ color: 'var(--color-text-3)', marginTop: 2 }} />}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>{c.flip_title}</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', display: 'flex', gap: 12, marginTop: 2 }}>
            <span>{c.submitted_by_name}</span>{c.notam && <span>NOTAM: {c.notam}</span>}<span>{c.coordinated_at.slice(0, 10)}</span>
          </div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: STAGE_COLOR[stageKey] }}>{badgeLabel(c)}</span>
      </div>
      {open && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg-inset)' }}>
          {c.details && <p style={{ fontSize: 'var(--fs-sm)', marginBottom: 12 }}>{c.details}</p>}

          {c.stage === 'coordination' && !c.rejected && isAfm && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={approve} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}><CircleCheck size={14} /> AFM Approval</button>
              <button onClick={reject} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}><X size={14} /> Reject</button>
            </div>
          )}

          {c.stage === 'submitted' && !c.rejected && (
            <>
              {canWrite && isCustodian && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                    {dateInput(c.creation_date, (v) => setField({ creation_date: v }), 'Creation Date')}
                    {dateInput(c.processed_date, (v) => setField({ processed_date: v }), 'Processed Date')}
                    {dateInput(c.published_date, (v) => setField({ published_date: v }), 'Published Date')}
                  </div>
                  <label style={{ display: 'block', border: '2px dashed var(--color-border)', borderRadius: 8, padding: 12, textAlign: 'center', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: c.pdf_filename ? 'var(--color-success)' : 'var(--color-text-3)', marginBottom: 10 }}>
                    {c.pdf_filename ?? 'Upload submitted change PDF'}
                    <input type="file" accept=".pdf" onChange={onPdf} style={{ display: 'none' }} />
                  </label>
                </>
              )}
              {isAfm && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={publish} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}><CircleCheck size={14} /> Mark Published</button>
                  <button onClick={reject} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}><X size={14} /> Reject</button>
                </div>
              )}
            </>
          )}

          {c.stage === 'completed' && (
            <div style={{ fontSize: 'var(--fs-sm)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div><strong>Coordinated:</strong> {c.coordinated_at.slice(0, 10)}</div>
              {c.creation_date && <div><strong>Creation:</strong> {c.creation_date}</div>}
              {c.published_date && <div><strong>Published:</strong> {c.published_date}</div>}
              {c.posted_date && <div><strong>Posted:</strong> {c.posted_date} {c.posted_initials ? `(${c.posted_initials})` : ''}</div>}
              {c.pdf_storage_path && <a href={flipFileUrl(c.pdf_storage_path)} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)' }}>{c.pdf_filename ?? 'Download PDF'}</a>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
