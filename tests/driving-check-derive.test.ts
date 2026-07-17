import { describe, it, expect } from 'vitest'
import { deriveOverallResult, type DrivingItemStatus } from '@/lib/supabase/driving-checks'

function items(...statuses: DrivingItemStatus[]): Array<{ status: DrivingItemStatus }> {
  return statuses.map((status) => ({ status }))
}

describe('deriveOverallResult', () => {
  it('valid 483 + all items pass → pass', () => {
    expect(deriveOverallResult('valid', items('pass', 'pass'), false)).toBe('pass')
  })

  it('valid 483 + one item discrepancy → discrepancy', () => {
    expect(deriveOverallResult('valid', items('pass', 'discrepancy'), false)).toBe('discrepancy')
  })

  it.each<[string, 'expired' | 'not_in_possession' | 'none']>([
    ['expired', 'expired'],
    ['not_in_possession', 'not_in_possession'],
    ['none', 'none'],
  ])('non-valid 483 status (%s) → violation regardless of item results', (_label, status) => {
    expect(deriveOverallResult(status, items('pass', 'pass'), false)).toBe('violation')
    expect(deriveOverallResult(status, items('discrepancy'), false)).toBe('violation')
    expect(deriveOverallResult(status, [], false)).toBe('violation')
  })

  it('violation flag overrides an otherwise-pass valid-483 check', () => {
    expect(deriveOverallResult('valid', items('pass', 'pass'), true)).toBe('violation')
  })

  it('violation flag overrides discrepancy items too (violation takes top precedence)', () => {
    expect(deriveOverallResult('valid', items('discrepancy'), true)).toBe('violation')
  })

  it('N/A-only items with a valid 483 → pass (N/A never triggers discrepancy)', () => {
    expect(deriveOverallResult('valid', items('na', 'na'), false)).toBe('pass')
  })

  it('empty item array with a valid 483 and no violation flag → pass', () => {
    expect(deriveOverallResult('valid', [], false)).toBe('pass')
  })

  it('mixed pass/na/discrepancy with valid 483 → discrepancy (any discrepancy wins over na/pass)', () => {
    expect(deriveOverallResult('valid', items('pass', 'na', 'discrepancy'), false)).toBe('discrepancy')
  })
})
