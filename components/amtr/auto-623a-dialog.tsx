'use client'

// Auto-generated 623a entry on trainer/NAMT sign-off. Pops after a
// successful sign on a non-623a, non-trainee slot. NAMT reviews +
// adjusts the pre-filled row and clicks Save → the row inserts into
// amtr_623a, then the same slot is locked via amtr_sign so the new
// 623a entry inherits the signer's authenticated identity (not just
// transcribed text). Skip closes without writing.

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { upsertAmtrRow, fetchAmtrByBase, amtrSign, type AmtrMember } from '@/lib/supabase/amtr'
import { DEFAULT_623A_ENTRY_TYPES } from '@/lib/amtr/reference-data'
import { Btn } from '@/components/amtr/ui'

type Row = Record<string, unknown>

/** Where the auto-prompt fired from — used to pre-populate the entry. */
export type SignSource = {
  kind: 'jqs' | '1098' | '797' | '803' | 'milestone'
  /** Human-readable label for the source row (e.g. the task title). */
  label: string
}

// Source slots come from the parent table being signed (1098 / 797 /
// JQS have certifier, 803 has evaluator). amtr_623a only has trainer /
// namt / afm slots in addition to trainee, so we fold certifier and
// evaluator into trainer for the 623a write — the auto-prompt only
// fires for non-trainee signers, so trainee is intentionally absent.
export type AutoSlot = 'trainer' | 'certifier' | 'evaluator' | 'namt' | 'afm'
type Slot623a = 'trainer' | 'namt' | 'afm'

const SLOT_623A: Record<AutoSlot, Slot623a> = {
  trainer: 'trainer',
  certifier: 'trainer',
  evaluator: 'trainer',
  namt: 'namt',
  afm: 'afm',
}

const KIND_LABEL: Record<SignSource['kind'], string> = {
  jqs: 'JQS Task Sign-Off',
  '1098': 'DAF 1098 Sign-Off',
  '797': 'DAF 797 Task Sign-Off',
  '803': 'DAF 803 Evaluation Sign-Off',
  milestone: 'QTP/PCG Milestone Sign-Off',
}

export function Auto623aDialog(props: {
  installationId: string
  memberId: string
  member: AmtrMember
  source: SignSource
  signedSlot: AutoSlot
  signedInitials: string
  onClose: () => void
}) {
  const { installationId, memberId, member, source, signedSlot, signedInitials, onClose } = props

  const [formDate, setFormDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [entryType, setEntryType] = useState<string>(KIND_LABEL[source.kind] ?? '')
  const [comment, setComment] = useState<string>(`Signed off on: ${source.label}`)
  const [saving, setSaving] = useState(false)
  const [entryTypes, setEntryTypes] = useState<string[]>([...DEFAULT_623A_ENTRY_TYPES])

  useEffect(() => {
    let active = true
    fetchAmtrByBase<Row>('amtr_623a_entry_types', installationId).then((rows) => {
      if (!active || rows.length === 0) return
      const labels = rows.map((r) => String(r.label)).filter(Boolean)
      setEntryTypes(labels)
      // If the base catalog has a closer match (e.g. customized label),
      // surface that as a suggestion instead of the hard-coded default.
      const lower = (KIND_LABEL[source.kind] ?? '').toLowerCase()
      const close = labels.find((l) => l.toLowerCase().includes(lower.split(' ')[0]))
      if (close) setEntryType((cur) => cur === KIND_LABEL[source.kind] ? close : cur)
    })
    return () => { active = false }
  }, [installationId, source.kind])

  const save = async () => {
    setSaving(true)
    // Map the parent slot (which may be certifier/evaluator) to the
    // closest amtr_623a slot (trainer for both). amtr_623a only has
    // trainee/trainer/namt/afm columns.
    const slot623a = SLOT_623A[signedSlot]
    // 1. Insert the new 623a row with the signing slot's initials + comment
    //    pre-populated. Slot-signed_by/_at are left null on the insert —
    //    the amtr_sign RPC stamps those with the authenticated identity
    //    in step 2.
    const slotInitialsField = `${slot623a}_initials` as const
    const slotCommentField = `${slot623a}_comment` as const
    const insertRow: Row = {
      base_id: installationId,
      member_id: memberId,
      form_date: formDate || null,
      entry_type: entryType || null,
      [slotInitialsField]: signedInitials || null,
      [slotCommentField]: comment || null,
    }
    const { data, error } = await upsertAmtrRow('amtr_623a', insertRow)
    if (error || !data?.id) {
      toast.error(error ?? 'Could not create 623A entry')
      setSaving(false)
      return
    }

    // 2. Lock the slot via amtr_sign so the signed_by/_at columns get the
    //    authenticated identity. The slot's initials were already set on
    //    the insert; the RPC will overwrite them with the same value plus
    //    the locked attestation.
    const { error: signErr } = await amtrSign('amtr_623a', String(data.id), slot623a, signedInitials)
    if (signErr) {
      // Row exists but isn't locked — surface the partial state so the
      // operator knows. Don't auto-delete the row; an unsigned 623a row
      // is still useful and the NAMT can sign it from the 623a tab.
      toast.warning(`623a entry created but signature lock failed: ${signErr}`)
    } else {
      toast.success('623a entry created and signed')
    }
    setSaving(false)
    onClose()
  }

  return (
    <div onClick={() => !saving && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 560, maxWidth: '100%', padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <strong>Create 623A entry for this sign-off</strong>
          <button onClick={onClose} disabled={saving} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)' }}><X size={18} /></button>
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ padding: '8px 12px', marginBottom: 12, borderRadius: 8, fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', borderLeft: '3px solid var(--color-accent)', background: 'var(--color-bg-inset)' }}>
            You just signed the <strong>{signedSlot.toUpperCase()}</strong> block on a {source.kind === '1098' ? 'DAF 1098' : source.kind === '797' ? 'DAF 797' : source.kind === '803' ? 'DAF 803' : source.kind === 'milestone' ? 'milestone' : 'JQS'} item for {member.full_name}. Verify the pre-filled entry below and Save to drop it into their 623A log with your signature locked{SLOT_623A[signedSlot] !== signedSlot ? ` in the ${SLOT_623A[signedSlot].toUpperCase()} column` : ''}. Skip if a 623A note isn&apos;t needed for this sign-off.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '12px 14px', alignItems: 'center', fontSize: 'var(--fs-sm)' }}>
            <label htmlFor="auto623-date" style={{ color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', fontSize: 'var(--fs-xs)', letterSpacing: '0.06em' }}>Date</label>
            <input id="auto623-date" type="date" className="input-dark" value={formDate} onChange={(e) => setFormDate(e.target.value)} disabled={saving} style={{ width: 180 }} />

            <label htmlFor="auto623-type" style={{ color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', fontSize: 'var(--fs-xs)', letterSpacing: '0.06em' }}>Entry Type</label>
            <input id="auto623-type" className="input-dark" list="auto623-types" value={entryType} onChange={(e) => setEntryType(e.target.value)} disabled={saving} placeholder="Type or pick…" />

            <label style={{ color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', fontSize: 'var(--fs-xs)', letterSpacing: '0.06em' }}>Source</label>
            <span style={{ color: 'var(--color-text-2)' }}>{source.label}</span>

            <label style={{ color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', fontSize: 'var(--fs-xs)', letterSpacing: '0.06em' }}>Signer ({signedSlot})</label>
            <span style={{ color: 'var(--color-text-2)' }}><strong>{signedInitials}</strong></span>

            <label htmlFor="auto623-comment" style={{ color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', fontSize: 'var(--fs-xs)', letterSpacing: '0.06em', alignSelf: 'start', marginTop: 6 }}>Comment</label>
            <textarea id="auto623-comment" className="input-dark" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} disabled={saving} style={{ resize: 'vertical' }} />
          </div>

          <datalist id="auto623-types">{entryTypes.map((t) => <option key={t} value={t} />)}</datalist>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid var(--color-border)' }}>
          <Btn variant="ghost" onClick={onClose} disabled={saving}>Skip</Btn>
          <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save 623A Entry'}</Btn>
        </div>
      </div>
    </div>
  )
}
