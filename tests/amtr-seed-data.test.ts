import { describe, it, expect } from 'vitest'
import {
  JQS_CATALOG, RECURRING_1098, FORMAL_COURSES, RAT_COURSES, MILESTONES, SEED_COUNTS,
} from '@/lib/amtr/seed-data'

describe('AMTR bundled seed data', () => {
  it('parses the full 1C7X1 catalog set with expected counts', () => {
    expect(SEED_COUNTS.jqs).toBe(490)
    expect(SEED_COUNTS.recurring1098).toBe(23)
    expect(SEED_COUNTS.formal).toBe(29)
    expect(SEED_COUNTS.rat).toBe(13)
    expect(SEED_COUNTS.milestones).toBe(71)
  })

  it('JQS rows carry the schema fields and a section/item mix', () => {
    const kinds = new Set(JQS_CATALOG.map((r) => r.kind))
    expect(kinds.has('section')).toBe(true)
    expect(kinds.has('item')).toBe(true)
    const first = JQS_CATALOG[0]
    expect(first).toHaveProperty('number')
    expect(first).toHaveProperty('title')
    expect(first).toHaveProperty('sort_order')
  })

  it('formal courses are grouped into the three sections', () => {
    const sections = new Set(FORMAL_COURSES.map((c) => c.section))
    expect(sections).toEqual(new Set(['haf', 'initial', 'continuation']))
  })

  it('1098 + RAT rows have frequencies', () => {
    expect(RECURRING_1098.every((t) => !!t.frequency)).toBe(true)
    expect(RAT_COURSES.every((t) => !!t.frequency)).toBe(true)
  })

  it('milestones cover the four QTP/PCG paths', () => {
    const paths = new Set(MILESTONES.map((m) => m.path))
    expect(paths).toEqual(new Set(['fiveLevelQtp', 'amosAmslPcg', 'sevenLevelQtp', 'afmPcg']))
  })
})
