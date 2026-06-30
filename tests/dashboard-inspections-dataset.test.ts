import { describe, it, expect } from 'vitest'
import { deriveInspectionFields } from '@/lib/dashboard/analytics/datasets/inspections'

describe('deriveInspectionFields', () => {
  it('completed with no failures → pass', () => {
    const r = deriveInspectionFields({ status: 'completed', failed_count: 0, completed_by_name: 'MSgt Proctor' })
    expect(r.result).toBe('pass')
    expect(r.found_discrepancies).toBe('no')
    expect(r.inspector).toBe('MSgt Proctor')
  })
  it('completed with failures → fail + discrepancies found', () => {
    const r = deriveInspectionFields({ status: 'completed', failed_count: 3, completed_by_name: 'TSgt Doe' })
    expect(r.result).toBe('fail')
    expect(r.found_discrepancies).toBe('yes')
  })
  it('in-progress inspection → in_progress (never pass/fail)', () => {
    const r = deriveInspectionFields({ status: 'in_progress', failed_count: 0 })
    expect(r.result).toBe('in_progress')
  })
  it('inspector falls back completed_by_name → inspector_name → dash', () => {
    expect(deriveInspectionFields({ status: 'completed', inspector_name: 'SrA Lee' }).inspector).toBe('SrA Lee')
    expect(deriveInspectionFields({ status: 'in_progress' }).inspector).toBe('—')
  })
  it('missing failed_count is treated as zero', () => {
    const r = deriveInspectionFields({ status: 'completed' })
    expect(r.result).toBe('pass')
    expect(r.found_discrepancies).toBe('no')
  })
})
