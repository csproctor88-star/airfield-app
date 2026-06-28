import { describe, it, expect } from 'vitest'
import { discrepanciesDescriptor } from '@/lib/dashboard/table/descriptors/discrepancies'
import { personnelDescriptor } from '@/lib/dashboard/table/descriptors/personnel'
import { PERM } from '@/lib/permissions'

const PERM_VALUES = new Set<string>(Object.values(PERM))
const staticDescriptors = [
  { name: 'discrepancies', d: discrepanciesDescriptor },
  { name: 'personnel', d: personnelDescriptor },
]

describe('table descriptors', () => {
  for (const { name, d } of staticDescriptors) {
    it(`${name}: exactly one of columns/useColumns`, () => {
      expect(Boolean(d.columns) !== Boolean(d.useColumns)).toBe(true)
    })
    it(`${name}: column keys unique`, () => {
      const keys = (d.columns ?? []).map(c => c.key)
      expect(new Set(keys).size).toBe(keys.length)
    })
    it(`${name}: has at least one default column`, () => {
      expect((d.columns ?? []).some(c => c.defaultVisible)).toBe(true)
    })
    it(`${name}: detail+actions reference real PERM keys`, () => {
      if (d.row.mode === 'detail+actions') {
        for (const a of d.row.actions) expect(PERM_VALUES.has(a.permission)).toBe(true)
      }
    })
  }
})
