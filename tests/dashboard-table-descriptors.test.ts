import { describe, it, expect } from 'vitest'
import { discrepanciesDescriptor } from '@/lib/dashboard/table/descriptors/discrepancies'
import { personnelDescriptor } from '@/lib/dashboard/table/descriptors/personnel'
import { amtrOverdueDescriptor, amtrDueSoonDescriptor } from '@/lib/dashboard/table/descriptors/amtr-due-items'
import { amtrInspectionsDescriptor } from '@/lib/dashboard/table/descriptors/amtr-inspections'
import { amtrMyTrainingDescriptor } from '@/lib/dashboard/table/descriptors/amtr-my-training'
import { amtrPendingSignaturesDescriptor } from '@/lib/dashboard/table/descriptors/amtr-pending-signatures'
import { PERM } from '@/lib/permissions'

const PERM_VALUES = new Set<string>(Object.values(PERM))
const staticDescriptors = [
  { name: 'discrepancies', d: discrepanciesDescriptor },
  { name: 'personnel', d: personnelDescriptor },
  { name: 'amtr-overdue', d: amtrOverdueDescriptor },
  { name: 'amtr-due-soon', d: amtrDueSoonDescriptor },
  { name: 'amtr-inspections', d: amtrInspectionsDescriptor },
  { name: 'amtr-my-training', d: amtrMyTrainingDescriptor },
  { name: 'amtr-pending-signatures', d: amtrPendingSignaturesDescriptor },
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
  }
})
