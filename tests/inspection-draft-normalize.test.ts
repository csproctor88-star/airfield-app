import { describe, it, expect } from 'vitest'
import { normalizeHalfDraft } from '@/lib/inspection-draft'

// Guards the draft read boundary: a draft loaded from an old app version, a
// partial save, or a DB Json column must normalize to a complete shape rather
// than render blank or throw. Both the localStorage and DB load paths funnel
// through normalizeHalfDraft.
describe('normalizeHalfDraft', () => {
  it('returns a complete empty draft for non-object input', () => {
    for (const bad of [null, undefined, 'x', 42, []]) {
      const d = normalizeHalfDraft(bad)
      expect(d.responses).toEqual({})
      expect(d.discrepancies).toEqual({})
      expect(d.selectedPersonnel).toEqual([])
      expect(d.rcrReported).toBe(false)
    }
  })

  it('fills missing fields from defaults while keeping present ones', () => {
    const d = normalizeHalfDraft({ notes: 'hi', responses: { a: 'pass' } })
    expect(d.notes).toBe('hi')
    expect(d.responses).toEqual({ a: 'pass' })
    // missing fields defaulted, not undefined
    expect(d.rcrReported).toBe(false)
    expect(d.comments).toEqual({})
    expect(d.selectedPersonnel).toEqual([])
    expect(d.bwcValue).toBeNull()
  })

  it('repairs wrong-typed container fields', () => {
    const d = normalizeHalfDraft({
      responses: 'not-an-object',
      selectedPersonnel: 'nope',
      discrepancies: 123,
      rcrReported: 'yes',
    })
    expect(d.responses).toEqual({})
    expect(d.selectedPersonnel).toEqual([])
    expect(d.discrepancies).toEqual({})
    expect(d.rcrReported).toBe(false)
  })
})
