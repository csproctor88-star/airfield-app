import { describe, it, expect } from 'vitest'
import { resolveSections, dedupeSeed803 } from '@/lib/amtr/form803-sections'
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
      { id: 'b', section_key: 'custom1', label: 'Custom One', builtin: false, sort_order: 5, seed_default: true },
      { id: 'a', section_key: 'afm', label: 'AFM', builtin: true, sort_order: 4 },
    ])
    expect(r.map((s) => s.key)).toEqual(['afm', 'custom1'])
    expect(r[1]).toMatchObject({ id: 'b', key: 'custom1', label: 'Custom One', builtin: false, seedDefault: true })
  })
})

describe('dedupeSeed803', () => {
  const secs = [
    { section_key: 'k1', label: 'One' },
    { section_key: 'k1', label: 'One dup' },   // dup key
    { section_key: 'k2', label: 'Two' },
    { section_key: 'kbuilt', label: 'Already here' },
  ]
  const tasks = [
    { section: 'k1', sts_item: 'a' },
    { section: 'k1', sts_item: 'a' },          // dup task
    { section: 'k2', sts_item: 'b' },
    { section: 'kbuilt', sts_item: 'x' },       // belongs to an excluded section
  ]
  it('dedupes section keys and drops already-present keys', () => {
    const { sections } = dedupeSeed803(secs, tasks, new Set(['kbuilt']))
    expect(sections.map((s) => s.section_key)).toEqual(['k1', 'k2'])
  })
  it('keeps only tasks for chosen sections, deduped', () => {
    const { tasks: out } = dedupeSeed803(secs, tasks, new Set(['kbuilt']))
    expect(out).toHaveLength(2)
    expect(out.map((t) => `${t.section}|${t.sts_item}`)).toEqual(['k1|a', 'k2|b'])
  })
})
