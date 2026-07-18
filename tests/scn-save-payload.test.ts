import { describe, it, expect } from 'vitest'
import { buildScnSavePayload, type ScnAgencyDraft } from '@/lib/supabase/scn'

// buildScnSavePayload is the pure seam extracted from the /scn page's save
// path. The regression it guards: an EDIT of a historical check must upsert
// onto that check's own date, never today's. Before the fix the page
// hardcoded checkDate: todayZuluDate(), so editing e.g. a July 10 check
// rewrote TODAY's (base, date, check_type) row — clobbering or fabricating
// today's real check and leaving the July 10 row untouched.

const DRAFT: ScnAgencyDraft[] = [
  { agency_id: 'a1', agency_name: 'Fire Dept', sort_order: 10, status: 'loud_clear', notes: '' },
]

describe('buildScnSavePayload', () => {
  it('carries the edited check date through, not today', () => {
    const payload = buildScnSavePayload({
      baseId: 'b1',
      checkDate: '2026-07-10', // editing a historical check
      checkType: 'primary',
      operatingInitials: 'AB',
      notes: '   ',
      draft: DRAFT,
    })
    // The load-bearing assertion: the payload's natural-key date is the
    // edited check's date, NOT the current Zulu date.
    expect(payload.checkDate).toBe('2026-07-10')
    expect(payload.checkDate).not.toBe(new Date().toISOString().slice(0, 10))
    expect(payload.baseId).toBe('b1')
    expect(payload.checkType).toBe('primary')
    expect(payload.operatingInitials).toBe('AB')
    expect(payload.notes).toBeNull() // whitespace-only overall notes → null
    expect(payload.agencies).toEqual([
      { agency_id: 'a1', agency_name: 'Fire Dept', status: 'loud_clear', notes: null, sort_order: 10 },
    ])
  })

  it('trims OOS notes and preserves non-empty overall notes', () => {
    const payload = buildScnSavePayload({
      baseId: 'b1',
      checkDate: '2026-07-18',
      checkType: 'backup',
      operatingInitials: null,
      notes: 'overall note',
      draft: [
        { agency_id: 'a2', agency_name: 'Tower', sort_order: 20, status: 'oos', notes: '  radio fault  ' },
      ],
    })
    expect(payload.checkType).toBe('backup')
    expect(payload.notes).toBe('overall note')
    expect(payload.operatingInitials).toBeNull()
    expect(payload.agencies[0].notes).toBe('radio fault')
  })
})
