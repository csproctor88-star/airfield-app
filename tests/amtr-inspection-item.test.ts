import { describe, it, expect } from 'vitest'
import { normalizeInspectionItem, type InspectionItemResponse } from '@/lib/supabase/amtr-inspections'

const base: InspectionItemResponse = { item_number: '6.3', status: 'no', auto: 'no', findings: ['Jan', 'Mar'], note: '' }

describe('normalizeInspectionItem', () => {
  it('seeds detail from findings when absent', () => {
    expect(normalizeInspectionItem(base).detail).toBe('Jan · Mar')
  })
  it('keeps an existing edited detail', () => {
    expect(normalizeInspectionItem({ ...base, detail: 'edited' }).detail).toBe('edited')
  })
  it('migrates a legacy note into correctiveAction', () => {
    expect(normalizeInspectionItem({ ...base, note: 'counseled' }).correctiveAction).toBe('counseled')
  })
  it('prefers an explicit correctiveAction over the legacy note', () => {
    expect(normalizeInspectionItem({ ...base, note: 'old', correctiveAction: 'new' }).correctiveAction).toBe('new')
  })
})
