import { describe, it, expect, beforeEach } from 'vitest'
import {
  qrcDraftKey,
  loadQrcDraft,
  saveQrcDraft,
  clearQrcDraft,
  qrcDraftSignature,
  type QrcEditorDraft,
} from '@/lib/qrc-draft'

const BASE_ID = 'b1111111-1111-1111-1111-111111111111'
const TEMPLATE_ID = 't2222222-2222-2222-2222-222222222222'

function makeDraft(overrides: Partial<QrcEditorDraft> = {}): QrcEditorDraft {
  return {
    mode: 'create',
    templateId: null,
    qrcNumber: 26,
    title: 'Fuel Spill',
    notes: '',
    references: 'DAFMAN 13-204v2',
    hasScnForm: false,
    scnFields: [],
    steps: [
      { id: '1', type: 'checkbox', label: 'Close the affected taxiway' },
      {
        id: '2', type: 'conditional', label: 'If fuel reaches a drain',
        cross_ref_qrc: 12,
        sub_steps: [{ id: '3', type: 'checkbox', label: 'Notify CES Environmental' }],
      },
    ],
    savedAt: '',
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('qrcDraftKey', () => {
  it('derives a per-base create key and a per-template edit key', () => {
    expect(qrcDraftKey(BASE_ID, null)).toBe(`qrc_editor_draft_${BASE_ID}_new`)
    expect(qrcDraftKey(BASE_ID, TEMPLATE_ID)).toBe(`qrc_editor_draft_${BASE_ID}_${TEMPLATE_ID}`)
  })
})

describe('saveQrcDraft / loadQrcDraft', () => {
  it('round-trips a create draft including nested sub_steps', () => {
    saveQrcDraft(makeDraft(), BASE_ID)
    const loaded = loadQrcDraft(BASE_ID, null)
    expect(loaded).not.toBeNull()
    expect(loaded!.title).toBe('Fuel Spill')
    expect(loaded!.steps[1].sub_steps![0].label).toBe('Notify CES Environmental')
  })

  it('stamps savedAt on save', () => {
    saveQrcDraft(makeDraft(), BASE_ID)
    const loaded = loadQrcDraft(BASE_ID, null)
    expect(loaded!.savedAt).toBeTruthy()
    expect(Number.isNaN(new Date(loaded!.savedAt).getTime())).toBe(false)
  })

  it('keeps create and edit drafts in separate slots', () => {
    saveQrcDraft(makeDraft({ title: 'New QRC' }), BASE_ID)
    saveQrcDraft(makeDraft({ mode: 'edit', templateId: TEMPLATE_ID, title: 'Edited QRC' }), BASE_ID)
    expect(loadQrcDraft(BASE_ID, null)!.title).toBe('New QRC')
    expect(loadQrcDraft(BASE_ID, TEMPLATE_ID)!.title).toBe('Edited QRC')
  })

  it('returns null when nothing is saved', () => {
    expect(loadQrcDraft(BASE_ID, null)).toBeNull()
  })

  it('returns null on corrupt stored JSON', () => {
    localStorage.setItem(qrcDraftKey(BASE_ID, null), '{not json')
    expect(loadQrcDraft(BASE_ID, null)).toBeNull()
  })
})

describe('clearQrcDraft', () => {
  it('removes only the targeted context', () => {
    saveQrcDraft(makeDraft(), BASE_ID)
    saveQrcDraft(makeDraft({ mode: 'edit', templateId: TEMPLATE_ID }), BASE_ID)
    clearQrcDraft(BASE_ID, null)
    expect(loadQrcDraft(BASE_ID, null)).toBeNull()
    expect(loadQrcDraft(BASE_ID, TEMPLATE_ID)).not.toBeNull()
  })
})

describe('qrcDraftSignature', () => {
  it('ignores savedAt', () => {
    const a = makeDraft({ savedAt: '2026-07-13T10:00:00Z' })
    const b = makeDraft({ savedAt: '2026-07-13T14:00:00Z' })
    expect(qrcDraftSignature(a)).toBe(qrcDraftSignature(b))
  })

  it('changes when any form field changes', () => {
    const base = qrcDraftSignature(makeDraft())
    expect(qrcDraftSignature(makeDraft({ title: 'Other' }))).not.toBe(base)
    expect(qrcDraftSignature(makeDraft({ hasScnForm: true }))).not.toBe(base)
    expect(qrcDraftSignature(makeDraft({ scnFields: [{ key: 'k', label: 'L', type: 'text' }] }))).not.toBe(base)
  })

  it('changes when a nested sub-step label changes', () => {
    const base = qrcDraftSignature(makeDraft())
    const changed = makeDraft()
    changed.steps[1].sub_steps![0].label = 'Notify the Fire Department'
    expect(qrcDraftSignature(changed)).not.toBe(base)
  })

  it('changes when steps are reordered', () => {
    const base = qrcDraftSignature(makeDraft())
    const reordered = makeDraft()
    reordered.steps = [reordered.steps[1], reordered.steps[0]]
    expect(qrcDraftSignature(reordered)).not.toBe(base)
  })
})
