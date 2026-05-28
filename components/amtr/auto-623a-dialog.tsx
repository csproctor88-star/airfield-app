'use client'

// Auto-generated 623a entry, multi-stage. Pops on every sign-off
// against a source row (1098 / JQS / 797 / 803 / milestone) — the
// dialog finds the existing 623a row for that source (or creates
// one), shows prior signers' comments read-only, and lets the
// current signer fill their own comment + lock their slot via
// amtr_sign.
//
// Flow:
//   1. Trainee signs source → trainee block on 623a fills (comment +
//      locked signature).
//   2. Trainer signs source → trainer block fills. Trainer chooses
//      "certification required" — if YES, the 623a waits for the
//      certifier (writes to the NAMT slot on 623a). If NO, the entry
//      finalizes after this step.
//   3. Certifier signs source (only if trainer required it) → fills
//      the NAMT slot on 623a.
//
// AFM is separate and remains a manual endorsement on the 623a tab.

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { upsertAmtrRow, fetchAmtrByBase, fetchAmtr623aBySource, amtrSign, type AmtrMember } from '@/lib/supabase/amtr'
import { DEFAULT_623A_ENTRY_TYPES, COMMENT_TEMPLATES } from '@/lib/amtr/reference-data'
import { Btn } from '@/components/amtr/ui'

type Row = Record<string, unknown>

/** Where the auto-prompt fired from — used to pre-populate the entry
 *  and to drive whether the 623a awaits a certifier sign-off. */
export type SignSource = {
  kind: 'jqs' | '1098' | '797' | '803' | 'milestone'
  /** Human-readable label for the source row (e.g. the task title). */
  label: string
  /** True when this source task requires a certifier signature in
   *  addition to the trainer's. Derived from the catalog:
   *   - JQS: catalog row's `core_cert` contains `^` per CFETP convention
   *   - 1098: always true (certifier is a standing column on the form)
   *   - 797: catalog row's `requires_certifier` flag
   *   - 803 / milestone: no certifier concept → false */
  requiresCertifier: boolean
}

// Source slots come from the parent table being signed. amtr_623a has
// trainee / trainer / namt / afm columns. The mapping:
//   trainee   → trainee
//   trainer   → trainer
//   certifier → namt  (the "certifying authority" column on Form 623A)
//   evaluator → trainer  (803 has no separate certifier step)
//   namt      → namt  (when NAMT signs the source directly)
//   afm       → afm
export type AutoSlot = 'trainee' | 'trainer' | 'certifier' | 'evaluator' | 'namt' | 'afm'
type Slot623a = 'trainee' | 'trainer' | 'namt' | 'afm'

const SLOT_623A: Record<AutoSlot, Slot623a> = {
  trainee: 'trainee',
  trainer: 'trainer',
  certifier: 'namt',
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

const SLOT_LABEL: Record<Slot623a, string> = {
  trainee: 'Trainee',
  trainer: 'Trainer',
  namt: 'NAMT / Certifier',
  afm: 'AFM',
}

export function Auto623aDialog(props: {
  installationId: string
  memberId: string
  member: AmtrMember
  source: SignSource
  sourceTable: string
  sourceRowId: string
  signedSlot: AutoSlot
  signedInitials: string
  onClose: () => void
}) {
  const { installationId, memberId, member, source, sourceTable, sourceRowId, signedSlot, signedInitials, onClose } = props

  const [formDate, setFormDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [entryType, setEntryType] = useState<string>(KIND_LABEL[source.kind] ?? '')
  // Default comment captures the canonical "what was signed" line per
  // DAFMAN 13-204v2 sign-off documentation expectations. Trainers add
  // any reg-required additional content via the template picker below.
  const [comment, setComment] = useState<string>(`Training item completed: ${source.label}`)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [entryTypes, setEntryTypes] = useState<string[]>([...DEFAULT_623A_ENTRY_TYPES])
  // The existing 623a row tied to this source, if any. Drives the
  // read-only prior-signer display.
  const [existingRow, setExistingRow] = useState<Row | null>(null)

  const slot623a = SLOT_623A[signedSlot]

  // Find an existing auto-623a row for this source (so a sign-chain
  // evolves a single entry rather than minting a new one each step).
  useEffect(() => {
    let active = true
    fetchAmtr623aBySource(installationId, sourceTable, sourceRowId).then((data) => {
      if (!active) return
      if (data) {
        setExistingRow(data)
        setFormDate(String(data.form_date ?? new Date().toISOString().slice(0, 10)).slice(0, 10))
        setEntryType(String(data.entry_type ?? KIND_LABEL[source.kind] ?? ''))
        // Preserve any comment already present in the current slot
        // (e.g. reopening their own block). If the slot is empty,
        // fall back to the "Training item completed: …" prefill so
        // every signer's comment starts with the canonical sign-off
        // line; templates appended via the picker layer reg content
        // on top.
        const existing = data[`${slot623a}_comment`]
        setComment(existing ? String(existing) : `Training item completed: ${source.label}`)
      }
      setLoading(false)
    })
    return () => { active = false }
  }, [installationId, sourceTable, sourceRowId, slot623a, source.kind])

  // Entry-type catalog lookup (suggestion only).
  useEffect(() => {
    let active = true
    fetchAmtrByBase<Row>('amtr_623a_entry_types', installationId).then((rows) => {
      if (!active || rows.length === 0) return
      const labels = rows.map((r) => String(r.label)).filter(Boolean)
      setEntryTypes(labels)
      const lower = (KIND_LABEL[source.kind] ?? '').toLowerCase()
      const close = labels.find((l) => l.toLowerCase().includes(lower.split(' ')[0]))
      if (close && !existingRow) setEntryType((cur) => cur === KIND_LABEL[source.kind] ? close : cur)
    })
    return () => { active = false }
  }, [installationId, source.kind, existingRow])

  const save = async () => {
    setSaving(true)
    const slotInitialsField = `${slot623a}_initials` as const
    const slotCommentField = `${slot623a}_comment` as const

    let rowId: string | undefined = existingRow?.id as string | undefined

    // requires_certifier is now derived from the source task's catalog
    // (caret-marked JQS items, 1098 standing column, 797 row flag).
    // The trainer no longer toggles a checkbox — the reg-encoded
    // certification requirement is the source of truth.
    if (rowId) {
      // Existing entry — patch this signer's block + keep the source
      // link + flag in sync. Don't touch other columns; the upsert
      // would otherwise blank prior signers' comments.
      const patch: Row = {
        id: rowId,
        base_id: installationId,
        member_id: memberId,
        form_date: formDate || null,
        entry_type: entryType || null,
        source_table: sourceTable,
        source_row_id: sourceRowId,
        requires_certifier: source.requiresCertifier,
        [slotInitialsField]: signedInitials || null,
        [slotCommentField]: comment || null,
      }
      const { error } = await upsertAmtrRow('amtr_623a', patch)
      if (error) { toast.error(error); setSaving(false); return }
    } else {
      // First sign on this source — create the row.
      const insertRow: Row = {
        base_id: installationId,
        member_id: memberId,
        form_date: formDate || null,
        entry_type: entryType || null,
        source_table: sourceTable,
        source_row_id: sourceRowId,
        requires_certifier: source.requiresCertifier,
        [slotInitialsField]: signedInitials || null,
        [slotCommentField]: comment || null,
      }
      const { data, error } = await upsertAmtrRow('amtr_623a', insertRow)
      if (error || !data?.id) { toast.error(error ?? 'Could not create 623A entry'); setSaving(false); return }
      rowId = String(data.id)
    }

    // Lock the slot with the authenticated identity.
    const { error: signErr } = await amtrSign('amtr_623a', rowId!, slot623a, signedInitials)
    if (signErr) {
      toast.warning(`623a entry saved but signature lock failed: ${signErr}`)
    } else {
      toast.success(existingRow ? '623a entry updated and signed' : '623a entry created and signed')
    }
    setSaving(false)
    onClose()
  }

  // Render: prior signers (with their initials + comment) as read-only
  // cards above the current signer's form. The current signer fills in
  // their own comment + (if trainer) the certification toggle.
  const priorSlots: Slot623a[] = (['trainee', 'trainer', 'namt'] as Slot623a[]).filter((s) => s !== slot623a)
  const priorSigned = priorSlots
    .filter((s) => existingRow && (existingRow[`${s}_initials`] as string))
    .map((s) => ({ slot: s, initials: String(existingRow![`${s}_initials`]), comment: String(existingRow![`${s}_comment`] ?? '') }))

  return (
    <div onClick={() => !saving && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 620, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', padding: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <strong>{existingRow ? 'Update' : 'Create'} 623A entry — {SLOT_LABEL[slot623a]} block</strong>
          <button onClick={onClose} disabled={saving} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-3)' }}><X size={18} /></button>
        </div>

        {loading ? (
          <div style={{ padding: 24, color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>Loading…</div>
        ) : (
          <>
            <div style={{ padding: 16 }}>
              <div style={{ padding: '8px 12px', marginBottom: 12, borderRadius: 8, fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', borderLeft: '3px solid var(--color-accent)', background: 'var(--color-bg-inset)' }}>
                You just signed the <strong>{signedSlot.toUpperCase()}</strong> block on a {source.kind === '1098' ? 'DAF 1098' : source.kind === '797' ? 'DAF 797' : source.kind === '803' ? 'DAF 803' : source.kind === 'milestone' ? 'milestone' : 'JQS'} item for {member.full_name}. Add an optional comment and Save to record it on the 623A. Skip if a 623A note isn&apos;t needed.{slot623a !== signedSlot ? ` Your sign-off lands in the ${SLOT_LABEL[slot623a]} column.` : ''}
              </div>

              {priorSigned.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Already signed</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {priorSigned.map((p) => (
                      <div key={p.slot} style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 'var(--fs-xs)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)', fontWeight: 700 }}>{SLOT_LABEL[p.slot]}</span>
                          <span style={{ fontWeight: 700 }}>{p.initials}</span>
                        </div>
                        {p.comment && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', whiteSpace: 'pre-wrap' }}>{p.comment}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '12px 14px', alignItems: 'center', fontSize: 'var(--fs-sm)' }}>
                <label htmlFor="auto623-date" style={{ color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', fontSize: 'var(--fs-xs)', letterSpacing: '0.06em' }}>Date</label>
                <input id="auto623-date" type="date" className="input-dark" value={formDate} onChange={(e) => setFormDate(e.target.value)} disabled={saving || !!existingRow} style={{ width: 180 }} />

                <label htmlFor="auto623-type" style={{ color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', fontSize: 'var(--fs-xs)', letterSpacing: '0.06em' }}>Entry Type</label>
                <input id="auto623-type" className="input-dark" list="auto623-types" value={entryType} onChange={(e) => setEntryType(e.target.value)} disabled={saving || !!existingRow} placeholder="Type or pick…" />

                <label style={{ color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', fontSize: 'var(--fs-xs)', letterSpacing: '0.06em' }}>Source</label>
                <span style={{ color: 'var(--color-text-2)' }}>{source.label}</span>

                <label style={{ color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', fontSize: 'var(--fs-xs)', letterSpacing: '0.06em' }}>Your Initials ({SLOT_LABEL[slot623a]})</label>
                <span style={{ color: 'var(--color-text-2)' }}><strong>{signedInitials}</strong></span>

                <label htmlFor="auto623-comment" style={{ color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', fontSize: 'var(--fs-xs)', letterSpacing: '0.06em', alignSelf: 'start', marginTop: 6 }}>Your Comment</label>
                <div>
                  <textarea id="auto623-comment" className="input-dark" rows={6} value={comment} onChange={(e) => setComment(e.target.value)} disabled={saving} style={{ resize: 'vertical', width: '100%' }} placeholder="Optional — left blank if no note is needed" />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)' }}>Insert DAFMAN template:</span>
                    <select className="input-dark" disabled={saving} value="" onChange={(e) => {
                      const t = COMMENT_TEMPLATES.find((x) => x.key === e.target.value)
                      if (!t) return
                      setComment((cur) => cur.trim() ? `${cur.trim()}\n\n${t.text}` : t.text)
                      e.target.value = ''
                    }} style={{ fontSize: 'var(--fs-xs)', padding: '3px 6px', maxWidth: 260 }}>
                      <option value="">Pick a template…</option>
                      {COMMENT_TEMPLATES.map((t) => (
                        <option key={t.key} value={t.key} title={t.cite}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Certification requirement is read from the source
                    task's catalog (CFETP caret marker for JQS, the
                    standing certifier column on DAF 1098, the
                    requires_certifier flag on DAF 797). Trainer no
                    longer toggles this — surfacing the current value
                    read-only so the signer knows whether the entry
                    awaits a certifier. */}
                <label style={{ color: 'var(--color-text-3)', fontWeight: 600, textTransform: 'uppercase', fontSize: 'var(--fs-xs)', letterSpacing: '0.06em', alignSelf: 'start' }}>Cert Required</label>
                <span style={{ fontSize: 'var(--fs-sm)', color: source.requiresCertifier ? 'var(--color-warning)' : 'var(--color-text-3)' }}>
                  {source.requiresCertifier ? 'Yes — certifier must sign before this 623A is finalized' : 'No — entry finalizes after trainer signs'}
                </span>
              </div>

              <datalist id="auto623-types">{entryTypes.map((t) => <option key={t} value={t} />)}</datalist>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid var(--color-border)' }}>
              <Btn variant="ghost" onClick={onClose} disabled={saving}>Skip</Btn>
              <Btn variant="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : (existingRow ? 'Save & Sign' : 'Save 623A Entry')}</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
