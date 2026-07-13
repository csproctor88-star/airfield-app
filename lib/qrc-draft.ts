// QRC editor draft — persisted in localStorage (device-local by owner
// decision; see docs/superpowers/specs/2026-07-13-qrc-editor-drafts-design.md).
// Survives dialog close, navigation, and crashes until the QRC is actually
// saved or the draft is explicitly discarded.

import type { QrcStep } from '@/lib/supabase/types'

const DRAFT_KEY_PREFIX = 'qrc_editor_draft'

export interface QrcEditorDraft {
  mode: 'create' | 'edit'
  templateId: string | null
  qrcNumber: number
  title: string
  notes: string
  references: string
  hasScnForm: boolean
  scnFields: { key: string; label: string; type: 'text' | 'textarea' }[]
  steps: QrcStep[]
  savedAt: string
}

// One draft per editing context: the base's single create slot, or one
// slot per template being edited.
export function qrcDraftKey(baseId: string, templateId: string | null): string {
  return `${DRAFT_KEY_PREFIX}_${baseId}_${templateId ?? 'new'}`
}

export function loadQrcDraft(baseId: string, templateId: string | null): QrcEditorDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(qrcDraftKey(baseId, templateId))
    if (!raw) return null
    return JSON.parse(raw) as QrcEditorDraft
  } catch {
    return null
  }
}

export function saveQrcDraft(draft: QrcEditorDraft, baseId: string): void {
  if (typeof window === 'undefined') return
  draft.savedAt = new Date().toISOString()
  localStorage.setItem(qrcDraftKey(baseId, draft.templateId), JSON.stringify(draft))
}

export function clearQrcDraft(baseId: string, templateId: string | null): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(qrcDraftKey(baseId, templateId))
}

// Deterministic serialization of everything except savedAt — the dialog's
// dirty test is signature(current) !== signature(initial).
export function qrcDraftSignature(draft: QrcEditorDraft): string {
  return JSON.stringify({
    mode: draft.mode,
    templateId: draft.templateId,
    qrcNumber: draft.qrcNumber,
    title: draft.title,
    notes: draft.notes,
    references: draft.references,
    hasScnForm: draft.hasScnForm,
    scnFields: draft.scnFields,
    steps: draft.steps,
  })
}
