import { describe, it, expect } from 'vitest'
import { acsiDraftToItems, createNewAcsiDraft, normalizeAcsiDraftDiscrepancies } from '@/lib/acsi-draft'
import type { AcsiDiscrepancyDetail, AcsiDraftData } from '@/lib/supabase/types'

function emptyDiscrepancy(overrides: Partial<AcsiDiscrepancyDetail> = {}): AcsiDiscrepancyDetail {
  return {
    comment: '',
    work_order: '',
    project_number: '',
    estimated_cost: '',
    estimated_completion: '',
    risk_control_measure: '',
    photo_ids: [],
    areas: [],
    latitude: null,
    longitude: null,
    pins: [],
    ...overrides,
  }
}

function draftWith(overrides: Partial<AcsiDraftData> = {}): AcsiDraftData {
  return {
    ...createNewAcsiDraft(),
    ...overrides,
  }
}

describe('acsiDraftToItems — buildDiscrepancy', () => {
  it('preserves linked_discrepancy_id on failed items', () => {
    const draft = draftWith({
      responses: { '1.1': 'fail' },
      discrepancies: {
        '1.1': [emptyDiscrepancy({ comment: 'surface crack', linked_discrepancy_id: 'disc-uuid-123' })],
      },
    })

    const { items } = acsiDraftToItems(draft)
    const row = items.find((i) => i.id === '1.1')
    expect(row).toBeTruthy()
    expect(row?.response).toBe('fail')
    expect(row?.discrepancy?.linked_discrepancy_id).toBe('disc-uuid-123')
    expect(row?.discrepancies?.[0]?.linked_discrepancy_id).toBe('disc-uuid-123')
  })

  it('defaults linked_discrepancy_id to null when not provided (regression guard)', () => {
    const draft = draftWith({
      responses: { '1.1': 'fail' },
      discrepancies: { '1.1': [emptyDiscrepancy({ comment: 'no link' })] },
    })

    const { items } = acsiDraftToItems(draft)
    const row = items.find((i) => i.id === '1.1')
    expect(row?.discrepancy?.linked_discrepancy_id).toBeNull()
  })

  it('propagates multiple discrepancies per item and keeps per-row links', () => {
    const draft = draftWith({
      responses: { '1.1': 'fail' },
      discrepancies: {
        '1.1': [
          emptyDiscrepancy({ comment: 'first', linked_discrepancy_id: 'a' }),
          emptyDiscrepancy({ comment: 'second', linked_discrepancy_id: 'b' }),
          emptyDiscrepancy({ comment: 'third' }),
        ],
      },
    })

    const { items } = acsiDraftToItems(draft)
    const row = items.find((i) => i.id === '1.1')
    expect(row?.discrepancies).toHaveLength(3)
    expect(row?.discrepancies?.map((d) => d.linked_discrepancy_id)).toEqual(['a', 'b', null])
    expect(row?.discrepancy?.linked_discrepancy_id).toBe('a')
  })

  it('skips discrepancy payload when response is not fail', () => {
    const draft = draftWith({
      responses: { '1.1': 'pass' },
      discrepancies: {
        '1.1': [emptyDiscrepancy({ comment: 'stale', linked_discrepancy_id: 'ghost' })],
      },
    })

    const { items } = acsiDraftToItems(draft)
    const row = items.find((i) => i.id === '1.1')
    expect(row?.response).toBe('pass')
    expect(row?.discrepancy).toBeNull()
    expect(row?.discrepancies).toEqual([])
  })

  it('expands sub-field items (A/B/C) and preserves linked_discrepancy_id on the failing leg only', () => {
    const draft = draftWith({
      responses: { '5.5.1.a': 'pass', '5.5.1.b': 'fail', '5.5.1.c': 'na' },
      discrepancies: {
        '5.5.1.b': [emptyDiscrepancy({ comment: 'bulb out', linked_discrepancy_id: 'link-b' })],
      },
    })

    const { items } = acsiDraftToItems(draft)
    const legA = items.find((i) => i.id === '5.5.1.a')
    const legB = items.find((i) => i.id === '5.5.1.b')
    const legC = items.find((i) => i.id === '5.5.1.c')

    expect(legA?.response).toBe('pass')
    expect(legA?.discrepancy).toBeNull()
    expect(legB?.response).toBe('fail')
    expect(legB?.discrepancy?.linked_discrepancy_id).toBe('link-b')
    expect(legC?.response).toBe('na')
    expect(legC?.discrepancy).toBeNull()
  })

  it('includes local Section 10 items and preserves their discrepancy links', () => {
    const draft = draftWith({
      responses: { 'local-1': 'fail' },
      discrepancies: {
        'local-1': [emptyDiscrepancy({ comment: 'custom finding', linked_discrepancy_id: 'link-local' })],
      },
      localItems: [{ id: 'local-1', question: 'Custom check for Section 10' }],
    })

    const { items } = acsiDraftToItems(draft)
    const local = items.find((i) => i.id === 'local-1')
    expect(local).toBeTruthy()
    expect(local?.section_id).toBe('acsi-10')
    expect(local?.discrepancy?.linked_discrepancy_id).toBe('link-local')
  })

  it('tallies pass/fail/na counts correctly', () => {
    const draft = draftWith({
      responses: { '1.1': 'pass', '1.2': 'fail', '1.3': 'na' },
      discrepancies: { '1.2': [emptyDiscrepancy({ comment: 'x' })] },
    })

    const res = acsiDraftToItems(draft)
    expect(res.passed).toBe(1)
    expect(res.failed).toBe(1)
    expect(res.na).toBe(1)
    expect(res.total).toBeGreaterThan(3)
  })
})

describe('normalizeAcsiDraftDiscrepancies', () => {
  it('wraps single-discrepancy legacy shape in an array', () => {
    const legacy: Record<string, AcsiDiscrepancyDetail> = {
      '1.1': emptyDiscrepancy({ comment: 'old' }),
    }
    const out = normalizeAcsiDraftDiscrepancies(legacy)
    expect(Array.isArray(out['1.1'])).toBe(true)
    expect(out['1.1']).toHaveLength(1)
    expect(out['1.1'][0].comment).toBe('old')
  })

  it('leaves already-arrayed discrepancies untouched', () => {
    const modern: Record<string, AcsiDiscrepancyDetail[]> = {
      '1.1': [emptyDiscrepancy({ comment: 'a' }), emptyDiscrepancy({ comment: 'b' })],
    }
    const out = normalizeAcsiDraftDiscrepancies(modern)
    expect(out['1.1']).toHaveLength(2)
  })
})
