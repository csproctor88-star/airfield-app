'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { QrcStep, QrcStepType } from '@/lib/supabase/types'

// Single dialog used for both creating a QRC from scratch and editing an
// existing one. Supports all 8 step types plus optional SCN form fields.
//
// Step types and their type-specific fields:
//   - checkbox             label
//   - checkbox_with_note   label, note
//   - fill_field           label, field_label
//   - time_field           label, field_label   (HHMM Zulu input at runtime)
//   - text                 label                (instructional text, read-only at runtime)
//   - textarea             label
//   - notify_agencies      label, agencies[]
//   - conditional          label, cross_ref_qrc, note?
//
// Sub-steps are supported one level deep (typical seed-data pattern).

const STEP_TYPE_OPTIONS: { value: QrcStepType; label: string; help: string }[] = [
  { value: 'checkbox', label: 'Checkbox', help: 'Single completable item.' },
  { value: 'checkbox_with_note', label: 'Checkbox + Note', help: 'Checkbox with a note shown beneath the label.' },
  { value: 'fill_field', label: 'Fill-in Field', help: 'Free-text input the operator fills in.' },
  { value: 'time_field', label: 'Time Field (Zulu)', help: 'HHMM Zulu input — also marks the step complete.' },
  { value: 'text', label: 'Text (read-only)', help: 'Instructional / warning text. Not interactive.' },
  { value: 'textarea', label: 'Text Area', help: 'Multi-line text input.' },
  { value: 'notify_agencies', label: 'Agency Notification', help: 'Per-agency checkboxes for notifications.' },
  { value: 'conditional', label: 'Conditional / Cross-ref', help: 'Conditional action that may reference another QRC.' },
]

const STEP_TYPE_LABEL: Record<QrcStepType, string> = Object.fromEntries(
  STEP_TYPE_OPTIONS.map(o => [o.value, o.label]),
) as Record<QrcStepType, string>

const ALLOW_SUB_STEPS: QrcStepType[] = ['checkbox', 'checkbox_with_note', 'conditional', 'text']

interface ScnField {
  key: string
  label: string
  type: 'text' | 'textarea'
}

interface ScnFieldsShape {
  fields: ScnField[]
}

type Mode = 'create' | 'edit'

export interface QrcEditorTemplate {
  id: string
  qrc_number: number
  title: string
  notes: string | null
  references: string | null
  has_scn_form: boolean
  scn_fields: unknown | null
  steps: unknown[]
}

interface Props {
  mode: Mode
  installationId: string
  // Edit mode only.
  template?: QrcEditorTemplate | null
  // Create mode: numbers already in use, so we can suggest the next free one
  // and warn on collision.
  existingNumbers?: Set<number>
  onClose: () => void
  onSaved: () => Promise<void> | void
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)', background: 'var(--color-bg-inset)',
  color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
}

const smallInputStyle: React.CSSProperties = { ...inputStyle, padding: '4px 8px', fontSize: 'var(--fs-xs)' }

function genStepId(existing: Set<string>): string {
  let i = 1
  while (existing.has(String(i))) i++
  existing.add(String(i))
  return String(i)
}

function blankStep(type: QrcStepType, idSet: Set<string>): QrcStep {
  const id = genStepId(idSet)
  const step: QrcStep = { id, type, label: '' }
  if (type === 'checkbox_with_note') step.note = ''
  if (type === 'fill_field' || type === 'time_field') step.field_label = ''
  if (type === 'notify_agencies') step.agencies = []
  if (type === 'conditional') step.cross_ref_qrc = undefined
  return step
}

// Recursively collect all step ids (top-level + sub-steps) so new ids are unique.
function collectIds(steps: QrcStep[], out: Set<string> = new Set()): Set<string> {
  for (const s of steps) {
    out.add(s.id)
    if (s.sub_steps) collectIds(s.sub_steps, out)
  }
  return out
}

function suggestNextNumber(existing: Set<number> | undefined): number {
  if (!existing || existing.size === 0) return 1
  let n = 1
  while (existing.has(n)) n++
  return n
}

function parseScnFields(raw: unknown): ScnField[] {
  if (!raw || typeof raw !== 'object') return []
  const fields = (raw as { fields?: unknown }).fields
  if (!Array.isArray(fields)) return []
  return fields
    .filter((f): f is ScnField =>
      !!f && typeof f === 'object'
      && typeof (f as ScnField).key === 'string'
      && typeof (f as ScnField).label === 'string',
    )
    .map(f => ({
      key: f.key,
      label: f.label,
      type: f.type === 'textarea' ? 'textarea' : 'text',
    }))
}

export default function QrcEditorDialog({
  mode, installationId, template, existingNumbers, onClose, onSaved,
}: Props) {
  const isEdit = mode === 'edit'
  const [qrcNumber, setQrcNumber] = useState<number>(
    isEdit ? template!.qrc_number : suggestNextNumber(existingNumbers),
  )
  const [title, setTitle] = useState(template?.title || '')
  const [notes, setNotes] = useState(template?.notes || '')
  const [refs, setRefs] = useState(template?.references || '')
  const [hasScnForm, setHasScnForm] = useState(template?.has_scn_form || false)
  const [scnFields, setScnFields] = useState<ScnField[]>(parseScnFields(template?.scn_fields))
  const [steps, setSteps] = useState<QrcStep[]>(
    (template?.steps as QrcStep[] | undefined) ? structuredClone(template!.steps as QrcStep[]) : [],
  )
  const [saving, setSaving] = useState(false)
  const [scnExpanded, setScnExpanded] = useState(hasScnForm)

  const numberInUse = useMemo(() => {
    if (isEdit) return false
    if (!existingNumbers) return false
    return existingNumbers.has(qrcNumber)
  }, [isEdit, existingNumbers, qrcNumber])

  function updateStepAt(path: number[], updater: (s: QrcStep) => QrcStep) {
    setSteps(prev => {
      const next = structuredClone(prev)
      // Walk the path
      let arr = next
      for (let i = 0; i < path.length - 1; i++) {
        arr = arr[path[i]].sub_steps as QrcStep[]
      }
      const last = path[path.length - 1]
      arr[last] = updater(arr[last])
      return next
    })
  }

  function moveStepAt(path: number[], dir: -1 | 1) {
    setSteps(prev => {
      const next = structuredClone(prev)
      let arr = next
      for (let i = 0; i < path.length - 1; i++) {
        arr = arr[path[i]].sub_steps as QrcStep[]
      }
      const idx = path[path.length - 1]
      const target = idx + dir
      if (target < 0 || target >= arr.length) return prev
      ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
      return next
    })
  }

  function removeStepAt(path: number[]) {
    setSteps(prev => {
      const next = structuredClone(prev)
      let arr = next
      for (let i = 0; i < path.length - 1; i++) {
        arr = arr[path[i]].sub_steps as QrcStep[]
      }
      arr.splice(path[path.length - 1], 1)
      return next
    })
  }

  function addStep(type: QrcStepType) {
    setSteps(prev => {
      const ids = collectIds(prev)
      return [...prev, blankStep(type, ids)]
    })
  }

  function addSubStep(parentPath: number[], type: QrcStepType) {
    setSteps(prev => {
      const next = structuredClone(prev)
      let arr = next
      for (let i = 0; i < parentPath.length - 1; i++) {
        arr = arr[parentPath[i]].sub_steps as QrcStep[]
      }
      const parent = arr[parentPath[parentPath.length - 1]]
      const ids = collectIds(next)
      const sub = blankStep(type, ids)
      // Sub-step ids conventionally use the parent id + letter suffix (e.g. "5a")
      // — but unique numeric ids also work. Keep it numeric to avoid collisions.
      parent.sub_steps = [...(parent.sub_steps || []), sub]
      return next
    })
  }

  function validate(): string | null {
    if (!title.trim()) return 'Title is required.'
    if (!Number.isInteger(qrcNumber) || qrcNumber < 1) return 'QRC number must be a positive integer.'
    if (!isEdit && existingNumbers && existingNumbers.has(qrcNumber)) {
      return `QRC #${qrcNumber} already exists. Pick a different number.`
    }
    if (steps.length === 0) return 'Add at least one step.'
    const flat: QrcStep[] = []
    const walk = (arr: QrcStep[]) => arr.forEach(s => { flat.push(s); if (s.sub_steps) walk(s.sub_steps) })
    walk(steps)
    for (const s of flat) {
      if (!s.label.trim()) return `Every step needs a label (step ${s.id} is empty).`
      if (s.type === 'notify_agencies' && (!s.agencies || s.agencies.length === 0)) {
        return `Agency step ${s.id} needs at least one agency.`
      }
      if (s.type === 'conditional' && (s.cross_ref_qrc != null) && (!Number.isInteger(s.cross_ref_qrc) || s.cross_ref_qrc < 1)) {
        return `Conditional step ${s.id} cross-reference must be a positive QRC number.`
      }
    }
    if (hasScnForm) {
      const keys = new Set<string>()
      for (const f of scnFields) {
        const k = f.key.trim()
        const l = f.label.trim()
        if (!k || !l) return 'Each SCN field needs a key and a label.'
        if (!/^[a-z0-9_]+$/.test(k)) return `SCN field key "${k}" must be lowercase letters, digits, or underscores.`
        if (keys.has(k)) return `Duplicate SCN field key "${k}".`
        keys.add(k)
      }
    }
    return null
  }

  async function handleSave() {
    const err = validate()
    if (err) { toast.error(err); return }
    setSaving(true)
    const payload = {
      title: title.trim(),
      notes: notes.trim() || null,
      references: refs.trim() || null,
      has_scn_form: hasScnForm,
      scn_fields: hasScnForm ? ({ fields: scnFields.map(f => ({ key: f.key.trim(), label: f.label.trim(), type: f.type })) } as unknown) : null,
      steps: steps as unknown[],
    }

    if (isEdit) {
      const { updateQrcTemplate } = await import('@/lib/supabase/qrc')
      const result = await updateQrcTemplate(template!.id, {
        title: payload.title,
        notes: payload.notes,
        references: payload.references,
        has_scn_form: payload.has_scn_form,
        scn_fields: payload.scn_fields as never,
        steps: payload.steps as never,
      })
      if (result.error) { toast.error(result.error); setSaving(false); return }
      toast.success('QRC updated')
    } else {
      const { createQrcTemplate } = await import('@/lib/supabase/qrc')
      const result = await createQrcTemplate({
        base_id: installationId,
        qrc_number: qrcNumber,
        title: payload.title,
        notes: payload.notes ?? undefined,
        references: payload.references ?? undefined,
        has_scn_form: payload.has_scn_form,
        scn_fields: (payload.scn_fields as Record<string, unknown>) ?? undefined,
        steps: payload.steps,
      })
      if (result.error) { toast.error(result.error); setSaving(false); return }
      toast.success(`QRC #${qrcNumber} created`)
    }
    await onSaved()
    setSaving(false)
  }

  return (
    <div className="modal-overlay" style={{ padding: 16 }} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card" style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)' }}>
            {isEdit ? `Edit QRC-${template!.qrc_number}` : 'Create QRC'}
          </div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', marginTop: 2 }}>
            {isEdit ? 'Update the checklist content, references, and SCN form.' : 'Build a Quick Reaction Checklist from scratch.'}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {/* QRC Number + Title */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 100 }}>
              <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-2)', display: 'block', marginBottom: 2 }}>QRC #</label>
              <input
                type="number"
                min={1}
                value={qrcNumber}
                disabled={isEdit}
                onChange={e => setQrcNumber(parseInt(e.target.value, 10) || 1)}
                style={{ ...inputStyle, borderColor: numberInUse ? 'var(--color-danger)' : 'var(--color-border)', opacity: isEdit ? 0.6 : 1 }}
              />
              {numberInUse && (
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-danger)', marginTop: 2 }}>Number in use</div>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-2)', display: 'block', marginBottom: 2 }}>Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Bird Strike Notification" style={inputStyle} />
            </div>
          </div>

          {/* Notes / Warning */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-2)', display: 'block', marginBottom: 2 }}>
              Warning / Notes <span style={{ color: 'var(--color-text-4)', fontWeight: 500 }}>(shown above the steps at execution time)</span>
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          {/* References */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-2)', display: 'block', marginBottom: 2 }}>References</label>
            <input value={refs} onChange={e => setRefs(e.target.value)} placeholder="e.g. DAFMAN 13-204v2" style={inputStyle} />
          </div>

          {/* Steps */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-1)' }}>Steps ({steps.length})</label>
            <AddStepMenu onAdd={addStep} />
          </div>

          {steps.length === 0 ? (
            <div style={{
              padding: '12px 14px', borderRadius: 'var(--radius-base)',
              border: '1px dashed var(--color-border)', background: 'var(--color-bg-inset)',
              fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', textAlign: 'center',
            }}>No steps yet. Use the &quot;+ Add Step&quot; menu above to add the first one.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {steps.map((step, i) => (
                <StepRow
                  key={`${step.id}-${i}`}
                  step={step}
                  index={i}
                  total={steps.length}
                  path={[i]}
                  depth={0}
                  onUpdate={updater => updateStepAt([i], updater)}
                  onMove={dir => moveStepAt([i], dir)}
                  onRemove={() => removeStepAt([i])}
                  onAddSub={type => addSubStep([i], type)}
                  onUpdateSub={(subIdx, updater) => updateStepAt([i, subIdx], updater)}
                  onMoveSub={(subIdx, dir) => moveStepAt([i, subIdx], dir)}
                  onRemoveSub={subIdx => removeStepAt([i, subIdx])}
                />
              ))}
            </div>
          )}

          {/* SCN Form */}
          <div style={{ marginTop: 18, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox" checked={hasScnForm}
                onChange={e => { setHasScnForm(e.target.checked); if (e.target.checked) setScnExpanded(true) }}
              />
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-1)' }}>Secondary Crash Net (SCN) form</span>
              <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)' }}>Tick for emergency QRCs that record SCN data</span>
            </label>

            {hasScnForm && (
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setScnExpanded(s => !s)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-cyan)', padding: '2px 0',
                  }}
                >
                  {scnExpanded ? '▾ Hide' : '▸ Show'} SCN fields ({scnFields.length})
                </button>
                {scnExpanded && (
                  <ScnFieldsEditor fields={scnFields} setFields={setScnFields} />
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', flexShrink: 0, display: 'flex', gap: 8 }}>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 1, padding: '10px 0', borderRadius: 'var(--radius-base)', border: 'none',
            background: 'var(--color-cyan)', color: '#fff', fontWeight: 700,
            fontSize: 'var(--fs-base)', cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit',
            opacity: saving ? 0.6 : 1,
          }}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create QRC'}</button>
          <button onClick={onClose} style={{
            padding: '10px 16px', borderRadius: 'var(--radius-base)', border: '1px solid var(--color-border)',
            background: 'transparent', color: 'var(--color-text-2)', fontWeight: 700,
            fontSize: 'var(--fs-base)', cursor: 'pointer', fontFamily: 'inherit',
          }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Add Step menu ───────────────────────────────────────────────────────

function AddStepMenu({ onAdd }: { onAdd: (type: QrcStepType) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        background: 'none', border: '1px solid var(--color-cyan)', borderRadius: 'var(--radius-sm)',
        padding: '4px 12px', color: 'var(--color-cyan)', fontSize: 'var(--fs-xs)',
        fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
      }}>+ Add Step</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-dropdown)' }} />
          <div style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 4,
            zIndex: 'calc(var(--z-dropdown) + 1)',
            background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-base)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', minWidth: 220,
            overflow: 'hidden',
          }}>
            {STEP_TYPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { onAdd(opt.value); setOpen(false) }}
                style={{
                  display: 'block', width: '100%', padding: '8px 12px', background: 'none', border: 'none',
                  textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-text-1)' }}>{opt.label}</div>
                <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)' }}>{opt.help}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Single step row (recursive via sub_steps prop) ──────────────────────

interface StepRowProps {
  step: QrcStep
  index: number
  total: number
  path: number[]
  depth: number
  onUpdate: (updater: (s: QrcStep) => QrcStep) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
  onAddSub?: (type: QrcStepType) => void
  onUpdateSub?: (subIdx: number, updater: (s: QrcStep) => QrcStep) => void
  onMoveSub?: (subIdx: number, dir: -1 | 1) => void
  onRemoveSub?: (subIdx: number) => void
}

function StepRow({
  step, index, total, depth,
  onUpdate, onMove, onRemove, onAddSub, onUpdateSub, onMoveSub, onRemoveSub,
}: StepRowProps) {
  const canSub = depth === 0 && ALLOW_SUB_STEPS.includes(step.type)
  return (
    <div style={{
      padding: 8, borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--color-border)',
      background: depth === 0 ? 'var(--color-bg-elevated)' : 'var(--color-bg-inset)',
    }}>
      {/* Row 1 — number + type pill + move/delete */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-3)', minWidth: 22 }}>{index + 1}.</span>
        <select
          value={step.type}
          onChange={e => {
            const newType = e.target.value as QrcStepType
            onUpdate(s => ({ ...s, type: newType }))
          }}
          style={{ ...smallInputStyle, width: 'auto', flexShrink: 0 }}
        >
          {STEP_TYPE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={() => onMove(-1)} disabled={index === 0} title="Move up" style={{
          background: 'none', border: 'none', cursor: index === 0 ? 'default' : 'pointer',
          color: index === 0 ? 'var(--color-text-4)' : 'var(--color-text-2)', fontSize: 12, padding: '0 4px', fontFamily: 'inherit',
        }}>↑</button>
        <button onClick={() => onMove(1)} disabled={index === total - 1} title="Move down" style={{
          background: 'none', border: 'none', cursor: index === total - 1 ? 'default' : 'pointer',
          color: index === total - 1 ? 'var(--color-text-4)' : 'var(--color-text-2)', fontSize: 12, padding: '0 4px', fontFamily: 'inherit',
        }}>↓</button>
        <button onClick={onRemove} title="Remove" style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-danger)', fontSize: 'var(--fs-sm)', padding: '0 6px', fontFamily: 'inherit',
        }}>×</button>
      </div>

      {/* Row 2 — label */}
      <div style={{ marginTop: 6 }}>
        <input
          value={step.label}
          onChange={e => onUpdate(s => ({ ...s, label: e.target.value }))}
          placeholder={STEP_TYPE_LABEL[step.type]}
          style={smallInputStyle}
        />
      </div>

      {/* Type-specific config */}
      <StepTypeConfig step={step} onUpdate={onUpdate} />

      {/* Sub-steps (top-level only) */}
      {canSub && (
        <SubStepsEditor
          subSteps={step.sub_steps || []}
          onAdd={type => onAddSub?.(type)}
          onUpdate={(idx, updater) => onUpdateSub?.(idx, updater)}
          onMove={(idx, dir) => onMoveSub?.(idx, dir)}
          onRemove={idx => onRemoveSub?.(idx)}
        />
      )}
    </div>
  )
}

// Type-specific config rendered beneath each step row.
function StepTypeConfig({ step, onUpdate }: { step: QrcStep; onUpdate: (u: (s: QrcStep) => QrcStep) => void }) {
  if (step.type === 'checkbox_with_note') {
    return (
      <div style={{ marginTop: 6 }}>
        <label style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', display: 'block', marginBottom: 2 }}>Note (italicized beneath the label)</label>
        <textarea
          value={step.note || ''}
          rows={2}
          onChange={e => onUpdate(s => ({ ...s, note: e.target.value }))}
          style={{ ...smallInputStyle, resize: 'vertical' }}
        />
      </div>
    )
  }
  if (step.type === 'fill_field' || step.type === 'time_field') {
    return (
      <div style={{ marginTop: 6 }}>
        <label style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', display: 'block', marginBottom: 2 }}>
          Field label {step.type === 'time_field' ? '(HHMM Zulu)' : ''}
        </label>
        <input
          value={step.field_label || ''}
          onChange={e => onUpdate(s => ({ ...s, field_label: e.target.value }))}
          placeholder={step.type === 'time_field' ? 'e.g. SCN Activation Time' : 'e.g. Aircraft type'}
          style={smallInputStyle}
        />
      </div>
    )
  }
  if (step.type === 'notify_agencies') {
    return (
      <AgenciesEditor
        agencies={step.agencies || []}
        onChange={list => onUpdate(s => ({ ...s, agencies: list }))}
      />
    )
  }
  if (step.type === 'conditional') {
    return (
      <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 130px' }}>
          <label style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', display: 'block', marginBottom: 2 }}>Cross-ref QRC #</label>
          <input
            type="number" min={1}
            value={step.cross_ref_qrc ?? ''}
            onChange={e => {
              const v = e.target.value
              onUpdate(s => ({ ...s, cross_ref_qrc: v === '' ? undefined : parseInt(v, 10) }))
            }}
            placeholder="e.g. 25"
            style={smallInputStyle}
          />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', display: 'block', marginBottom: 2 }}>Note (optional)</label>
          <input
            value={step.note || ''}
            onChange={e => onUpdate(s => ({ ...s, note: e.target.value }))}
            style={smallInputStyle}
          />
        </div>
      </div>
    )
  }
  return null
}

// ── Agencies editor (chip list + free-text add) ─────────────────────────

function AgenciesEditor({ agencies, onChange }: { agencies: string[]; onChange: (list: string[]) => void }) {
  const [draft, setDraft] = useState('')
  function add() {
    const v = draft.trim()
    if (!v || agencies.includes(v)) { setDraft(''); return }
    onChange([...agencies, v])
    setDraft('')
  }
  return (
    <div style={{ marginTop: 6 }}>
      <label style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', display: 'block', marginBottom: 2 }}>
        Agencies to notify ({agencies.length})
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
        {agencies.map((a, i) => (
          <span key={`${a}-${i}`} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 12,
            background: 'color-mix(in srgb, var(--color-cyan) 13%, transparent)',
            color: 'var(--color-cyan)', fontSize: 'var(--fs-2xs)', fontWeight: 700,
          }}>
            {a}
            <button
              onClick={() => onChange(agencies.filter((_, j) => j !== i))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, fontFamily: 'inherit' }}
              title="Remove"
            >×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="e.g. Fire Department"
          style={{ ...smallInputStyle, flex: 1 }}
        />
        <button onClick={add} disabled={!draft.trim()} style={{
          padding: '4px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-cyan)',
          background: draft.trim() ? 'var(--color-cyan)' : 'transparent',
          color: draft.trim() ? '#000' : 'var(--color-cyan)',
          fontWeight: 700, fontSize: 'var(--fs-xs)', cursor: draft.trim() ? 'pointer' : 'default', fontFamily: 'inherit',
        }}>Add</button>
      </div>
    </div>
  )
}

// ── Sub-steps editor (1 level deep) ─────────────────────────────────────

function SubStepsEditor({
  subSteps, onAdd, onUpdate, onMove, onRemove,
}: {
  subSteps: QrcStep[]
  onAdd: (type: QrcStepType) => void
  onUpdate: (idx: number, updater: (s: QrcStep) => QrcStep) => void
  onMove: (idx: number, dir: -1 | 1) => void
  onRemove: (idx: number) => void
}) {
  return (
    <div style={{ marginTop: 8, marginLeft: 16, paddingLeft: 8, borderLeft: '2px solid var(--color-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Sub-steps ({subSteps.length})
        </span>
        <AddStepMenu onAdd={onAdd} />
      </div>
      {subSteps.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {subSteps.map((sub, idx) => (
            <StepRow
              key={`${sub.id}-${idx}`}
              step={sub}
              index={idx}
              total={subSteps.length}
              path={[idx]}
              depth={1}
              onUpdate={updater => onUpdate(idx, updater)}
              onMove={dir => onMove(idx, dir)}
              onRemove={() => onRemove(idx)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── SCN fields editor ───────────────────────────────────────────────────

function ScnFieldsEditor({ fields, setFields }: { fields: ScnField[]; setFields: (list: ScnField[]) => void }) {
  function update(i: number, patch: Partial<ScnField>) {
    setFields(fields.map((f, j) => j === i ? { ...f, ...patch } : f))
  }
  function remove(i: number) {
    setFields(fields.filter((_, j) => j !== i))
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= fields.length) return
    const next = [...fields]
    ;[next[i], next[j]] = [next[j], next[i]]
    setFields(next)
  }
  function add() {
    setFields([...fields, { key: '', label: '', type: 'text' }])
  }

  return (
    <div style={{ marginTop: 8, padding: 10, background: 'var(--color-bg-inset)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
      {fields.length === 0 ? (
        <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)', fontStyle: 'italic', marginBottom: 6 }}>
          No fields yet. Add the data points your operators need to capture during the SCN.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
          {fields.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                value={f.key}
                placeholder="key (lowercase_snake)"
                onChange={e => update(i, { key: e.target.value })}
                style={{ ...smallInputStyle, flex: '0 0 160px', fontFamily: 'var(--font-mono, monospace)' }}
              />
              <input
                value={f.label}
                placeholder="Label"
                onChange={e => update(i, { label: e.target.value })}
                style={{ ...smallInputStyle, flex: 1 }}
              />
              <select
                value={f.type}
                onChange={e => update(i, { type: e.target.value as 'text' | 'textarea' })}
                style={{ ...smallInputStyle, width: 'auto' }}
              >
                <option value="text">Text</option>
                <option value="textarea">Textarea</option>
              </select>
              <button onClick={() => move(i, -1)} disabled={i === 0} style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? 'var(--color-text-4)' : 'var(--color-text-2)', padding: 2, fontFamily: 'inherit' }}>↑</button>
              <button onClick={() => move(i, 1)} disabled={i === fields.length - 1} style={{ background: 'none', border: 'none', cursor: i === fields.length - 1 ? 'default' : 'pointer', color: i === fields.length - 1 ? 'var(--color-text-4)' : 'var(--color-text-2)', padding: 2, fontFamily: 'inherit' }}>↓</button>
              <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: 2, fontFamily: 'inherit' }}>×</button>
            </div>
          ))}
        </div>
      )}
      <button onClick={add} style={{
        background: 'none', border: '1px dashed var(--color-cyan)', borderRadius: 'var(--radius-sm)',
        padding: '4px 12px', color: 'var(--color-cyan)', fontSize: 'var(--fs-xs)',
        fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
      }}>+ Add SCN Field</button>
    </div>
  )
}
