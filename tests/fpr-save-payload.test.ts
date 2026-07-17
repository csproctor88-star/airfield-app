import { describe, it, expect } from 'vitest'
import { buildFprSavePayload, type FprResultDraft } from '@/lib/supabase/fpr'

// buildFprSavePayload is the pure seam extracted from the /fpr page's save
// path. The regression it guards: an EDIT of a historical check must upsert
// onto that check's own date, never today's. Before the fix the page
// hardcoded checkDate: todayZuluDate(), so editing e.g. a July 10 check
// rewrote TODAY's (base, date, shift) row — clobbering or fabricating today's
// real check and leaving the July 10 row untouched.

const DRAFT: FprResultDraft[] = [
  { item_id: 'i1', item_label: 'FLIP products current', status: 'satisfactory', notes: '', sort_order: 10 },
]

describe('buildFprSavePayload', () => {
  it('carries the edited check date through, not today', () => {
    const payload = buildFprSavePayload({
      baseId: 'b1',
      checkDate: '2026-07-10', // editing a historical check
      shift: 'day',
      operatingInitials: 'AB',
      notes: '   ',
      draft: DRAFT,
      summary: 'Day Shift Flight Planning Room check complete — all items satisfactory',
    })
    // The load-bearing assertion: the payload's natural-key date is the
    // edited check's date, NOT the current Zulu date.
    expect(payload.checkDate).toBe('2026-07-10')
    expect(payload.checkDate).not.toBe(new Date().toISOString().slice(0, 10))
    expect(payload.baseId).toBe('b1')
    expect(payload.shift).toBe('day')
    expect(payload.operatingInitials).toBe('AB')
    expect(payload.notes).toBeNull() // whitespace-only overall notes → null
    expect(payload.items).toEqual([
      { item_id: 'i1', item_label: 'FLIP products current', status: 'satisfactory', notes: null, sort_order: 10 },
    ])
    expect(payload.summary).toBe(
      'Day Shift Flight Planning Room check complete — all items satisfactory',
    )
  })

  it('trims issue notes and preserves non-empty overall notes', () => {
    const payload = buildFprSavePayload({
      baseId: 'b1',
      checkDate: '2026-07-17',
      shift: 'swing',
      operatingInitials: null,
      notes: 'overall note',
      draft: [
        { item_id: 'i2', item_label: 'Enroute charts', status: 'issue', notes: '  superseded edition  ', sort_order: 20 },
      ],
      summary: 's',
    })
    expect(payload.notes).toBe('overall note')
    expect(payload.operatingInitials).toBeNull()
    expect(payload.items[0].notes).toBe('superseded edition')
  })
})
