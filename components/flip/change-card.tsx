// components/flip/change-card.tsx
'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, CircleCheck, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  updateFlipChange, approveFlipChange, logFlipChangeEvent,
  type FlipChange, type FlipChangeEvent, type FlipChangeEventType,
} from '@/lib/supabase/flip'
import { uploadFlipFile, flipFileUrl } from '@/lib/supabase/flip-storage'
import { formatZuluDateTime } from '@/lib/utils'

const STAGE_COLOR: Record<string, string> = {
  coordination: 'var(--color-warning)', submitted: 'var(--color-blue)', completed: 'var(--color-success)', rejected: 'var(--color-danger)',
}
function badgeLabel(c: FlipChange): string {
  if (c.rejected) return 'Rejected'
  return { coordination: 'Awaiting AFM Approval', submitted: 'Submitted / Awaiting Publication', completed: 'Published' }[c.stage]
}

const EVENT_LABEL: Record<FlipChangeEventType, string> = {
  coordinated: 'Coordinated', afm_approved: 'AFM Approved', processed: 'Processed', published: 'Published', rejected: 'Rejected',
}
const EVENT_COLOR: Record<FlipChangeEventType, string> = {
  coordinated: 'var(--color-warning)', afm_approved: 'var(--color-blue)', processed: 'var(--color-blue)', published: 'var(--color-success)', rejected: 'var(--color-danger)',
}

type ActionMode = null | 'approve' | 'process' | 'publish' | 'reject'

export function ChangeCard({ change, isAfm, isCustodian, isNamo, canWrite, baseId, events, onChange }: {
  change: FlipChange; isAfm: boolean; isCustodian: boolean; isNamo: boolean; canWrite: boolean
  baseId: string; events: FlipChangeEvent[]; onChange: () => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionMode, setActionMode] = useState<ActionMode>(null)
  const [remarks, setRemarks] = useState('')
  const [initials, setInitials] = useState(change.posted_initials ?? '')

  const c = change
  const stageKey = c.rejected ? 'rejected' : c.stage
  // Per request: Primary/Alternate Custodian and NAMO can publish/reject too
  // (AFM remains the coordination-stage approval authority). RLS already
  // permits any flip:write holder; this is the matching UI gate.
  const canPublishReject = isCustodian || isNamo || isAfm
  const canEditDates = canWrite && isCustodian

  const myEvents = events.filter((e) => e.change_id === c.id)
  const hasProcessedEvent = myEvents.some((e) => e.event_type === 'processed')

  const setDate = async (field: 'creation_date' | 'processed_date' | 'published_date', value: string) => {
    const v = value || null
    let patch: Partial<FlipChange> = { [field]: v }
    // Clearing an upstream date cascades to keep the chain valid.
    if (v === null) {
      if (field === 'creation_date') patch = { creation_date: null, processed_date: null, published_date: null }
      else if (field === 'processed_date') patch = { processed_date: null, published_date: null }
    }
    const { error } = await updateFlipChange(c.id, patch)
    if (error) { toast.error(error); return }
    onChange()
  }

  const onPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setBusy(true)
    const { path, error } = await uploadFlipFile(baseId, 'changes', f)
    setBusy(false)
    if (error || !path) { toast.error(error ?? 'Upload failed'); return }
    const { error: uErr } = await updateFlipChange(c.id, { pdf_filename: f.name, pdf_storage_path: path })
    if (uErr) { toast.error(uErr); return }
    onChange()
  }

  const startAction = (mode: Exclude<ActionMode, null>) => { setRemarks(''); setInitials(c.posted_initials ?? ''); setActionMode(mode) }
  const cancelAction = () => { setActionMode(null); setRemarks('') }

  const confirmAction = async () => {
    if (!actionMode) return
    if (actionMode === 'reject' && !remarks.trim()) { toast.error('Remarks are required to reject a change.'); return }
    if (actionMode === 'process' && !c.processed_date) { toast.error('Enter a Processed Date first.'); return }
    if (actionMode === 'publish' && (!c.creation_date || !c.published_date)) { toast.error('Creation and Published dates are required to publish.'); return }
    setBusy(true)
    let err: string | null = null
    if (actionMode === 'approve') {
      err = (await approveFlipChange(c.id)).error
      if (!err) err = (await logFlipChangeEvent({ changeId: c.id, baseId, eventType: 'afm_approved', remarks })).error
    } else if (actionMode === 'process') {
      err = (await logFlipChangeEvent({ changeId: c.id, baseId, eventType: 'processed', remarks })).error
    } else if (actionMode === 'publish') {
      err = (await updateFlipChange(c.id, { stage: 'completed', posted_initials: initials.trim() || null, posted_date: c.posted_date ?? new Date().toISOString().slice(0, 10) })).error
      if (!err) err = (await logFlipChangeEvent({ changeId: c.id, baseId, eventType: 'published', remarks })).error
    } else if (actionMode === 'reject') {
      err = (await updateFlipChange(c.id, { stage: 'completed', rejected: true })).error
      if (!err) err = (await logFlipChangeEvent({ changeId: c.id, baseId, eventType: 'rejected', remarks })).error
    }
    setBusy(false)
    if (err) { toast.error(err); return }
    const msg = actionMode === 'reject' ? 'Change rejected' : actionMode === 'publish' ? 'Marked published' : actionMode === 'process' ? 'Processing recorded' : 'Approved — moved to Submitted'
    setActionMode(null); setRemarks('')
    onChange(); toast.success(msg)
  }

  const fieldSm: React.CSSProperties = { width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)', fontSize: 'var(--fs-xs)', fontFamily: 'inherit', color: 'var(--color-text-1)' }
  const btnPrimary: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 'var(--fs-sm)' }
  const btnDanger: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, background: 'none', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 'var(--fs-sm)' }

  const dateInput = (val: string | null, field: 'creation_date' | 'processed_date' | 'published_date', lbl: string, disabledByChain: boolean) => {
    const disabled = !canEditDates || disabledByChain
    return (
      <div>
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', marginBottom: 3 }}>{lbl}{val ? ' ✓' : ''}</div>
        <input type="date" value={val ?? ''} disabled={disabled} onChange={(e) => setDate(field, e.target.value)}
          style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)', fontSize: 'var(--fs-xs)', color: 'var(--color-text-1)', opacity: disabled ? 0.55 : 1 }} />
      </div>
    )
  }

  const actionPanel = (
    <div style={{ marginTop: 10, padding: 10, border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg-surface)' }}>
      {actionMode === 'publish' && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', marginBottom: 3 }}>Operating Initials (§2.5.2.18.2.2.8)</div>
          <input value={initials} onChange={(e) => setInitials(e.target.value)} placeholder="e.g., JS" style={fieldSm} />
        </div>
      )}
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-2)', marginBottom: 3 }}>
        Remarks{actionMode === 'reject' ? ' (required)' : ' (optional)'}
      </div>
      <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder={actionMode === 'reject' ? 'Reason for rejection…' : 'Add remarks…'} style={{ ...fieldSm, minHeight: 56, resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={confirmAction} disabled={busy || (actionMode === 'reject' && !remarks.trim())}
          style={{ ...btnPrimary, opacity: (busy || (actionMode === 'reject' && !remarks.trim())) ? 0.6 : 1 }}>
          {actionMode === 'reject' ? 'Confirm Reject' : actionMode === 'publish' ? 'Confirm Publish' : actionMode === 'process' ? 'Confirm Processed' : 'Confirm Approval'}
        </button>
        <button onClick={cancelAction} style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}>Cancel</button>
      </div>
    </div>
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

          {/* Coordination stage actions */}
          {c.stage === 'coordination' && !c.rejected && !actionMode && (
            <div style={{ display: 'flex', gap: 8 }}>
              {isAfm && <button onClick={() => startAction('approve')} disabled={busy} style={btnPrimary}><CircleCheck size={14} /> AFM Approval</button>}
              {canPublishReject && <button onClick={() => startAction('reject')} disabled={busy} style={btnDanger}><X size={14} /> Reject</button>}
            </div>
          )}

          {/* Submitted stage: dates + PDF + actions */}
          {c.stage === 'submitted' && !c.rejected && (
            <>
              {canPublishReject && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  {dateInput(c.creation_date, 'creation_date', 'Creation Date', false)}
                  {dateInput(c.processed_date, 'processed_date', 'Processed Date', !c.creation_date)}
                  {dateInput(c.published_date, 'published_date', 'Published Date', !c.processed_date)}
                </div>
              )}
              {canEditDates ? (
                <label style={{ display: 'block', border: '2px dashed var(--color-border)', borderRadius: 8, padding: 12, textAlign: 'center', cursor: 'pointer', fontSize: 'var(--fs-sm)', color: c.pdf_filename ? 'var(--color-success)' : 'var(--color-text-3)', marginBottom: 10 }}>
                  {c.pdf_filename ?? 'Upload submitted change PDF'}
                  <input type="file" accept=".pdf" onChange={onPdf} style={{ display: 'none' }} />
                </label>
              ) : c.pdf_storage_path ? (
                <div style={{ marginBottom: 10 }}><a href={flipFileUrl(c.pdf_storage_path)} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)', fontSize: 'var(--fs-sm)' }}>{c.pdf_filename ?? 'Download PDF'}</a></div>
              ) : null}

              {!actionMode && canPublishReject && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {c.processed_date && !hasProcessedEvent && <button onClick={() => startAction('process')} disabled={busy} style={btnPrimary}><CircleCheck size={14} /> Mark Processed</button>}
                  <button onClick={() => startAction('publish')} disabled={busy} style={btnPrimary}><CircleCheck size={14} /> Mark Published</button>
                  <button onClick={() => startAction('reject')} disabled={busy} style={btnDanger}><X size={14} /> Reject</button>
                </div>
              )}
            </>
          )}

          {/* Action remarks panel */}
          {actionMode && actionPanel}

          {/* Completed summary */}
          {c.stage === 'completed' && (
            <div style={{ fontSize: 'var(--fs-sm)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {c.creation_date && <div><strong>Creation:</strong> {c.creation_date}</div>}
              {c.processed_date && <div><strong>Processed:</strong> {c.processed_date}</div>}
              {c.published_date && <div><strong>Published:</strong> {c.published_date}</div>}
              {c.posted_date && <div><strong>Posted:</strong> {c.posted_date} {c.posted_initials ? `(${c.posted_initials})` : ''}</div>}
              {c.pdf_storage_path && <a href={flipFileUrl(c.pdf_storage_path)} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)' }}>{c.pdf_filename ?? 'Download PDF'}</a>}
            </div>
          )}

          {/* Coordination history timeline */}
          {myEvents.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-3)', marginBottom: 6 }}>Coordination History</div>
              {myEvents.map((e) => (
                <div key={e.id} style={{ display: 'flex', gap: 10, padding: '6px 0', borderTop: '1px solid var(--color-border)', fontSize: 'var(--fs-xs)' }}>
                  <span style={{ width: 100, flexShrink: 0, fontWeight: 700, color: EVENT_COLOR[e.event_type] }}>{EVENT_LABEL[e.event_type]}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--color-text-2)' }}>{e.actor_name || 'Unknown'} · {formatZuluDateTime(new Date(e.created_at))}</div>
                    {e.remarks && <div style={{ color: 'var(--color-text-1)', marginTop: 2 }}>“{e.remarks}”</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
