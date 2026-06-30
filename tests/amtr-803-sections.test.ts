import { describe, it, expect } from 'vitest'
import { resolveSections } from '@/lib/amtr/form803-sections'
import { DAF803_SECTIONS } from '@/lib/amtr/reference-data'

describe('resolveSections', () => {
  it('falls back to the 5 built-in defaults when empty', () => {
    const r = resolveSections([])
    expect(r).toHaveLength(DAF803_SECTIONS.length)
    expect(r[0].key).toBe('apprenticeGrad')
    expect(r.every((s) => s.builtin)).toBe(true)
  })
  it('returns null/undefined as defaults too', () => {
    expect(resolveSections(null)).toHaveLength(5)
    expect(resolveSections(undefined)).toHaveLength(5)
  })
  it('maps and sorts fetched rows by sort_order', () => {
    const r = resolveSections([
      { id: 'b', section_key: 'custom1', label: 'Custom One', builtin: false, sort_order: 5 },
      { id: 'a', section_key: 'afm', label: 'AFM', builtin: true, sort_order: 4 },
    ])
    expect(r.map((s) => s.key)).toEqual(['afm', 'custom1'])
    expect(r[1]).toMatchObject({ id: 'b', key: 'custom1', label: 'Custom One', builtin: false })
  })
})
