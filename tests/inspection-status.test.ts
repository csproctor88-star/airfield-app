import { describe, it, expect } from 'vitest'
import { pickTodaysInspection } from '@/lib/inspection-status'
import type { InspectionRow } from '@/lib/supabase/inspections'

// Minimal row factory — only the fields pickTodaysInspection reads.
function row(p: Partial<InspectionRow>): InspectionRow {
  return {
    inspection_type: 'airfield',
    inspection_date: '2026-06-25',
    status: 'in_progress',
    created_at: '2026-06-25T00:00:00Z',
    ...p,
  } as InspectionRow
}

const DAY = '2026-06-25'

describe('pickTodaysInspection', () => {
  it('returns null when nothing matches the day/type', () => {
    expect(pickTodaysInspection([], 'airfield', DAY)).toBeNull()
    expect(pickTodaysInspection(
      [row({ inspection_date: '2026-06-24' })], 'airfield', DAY,
    )).toBeNull()
  })

  it('returns the in-progress row when that is all there is', () => {
    const r = row({ id: 'a', status: 'in_progress' })
    expect(pickTodaysInspection([r], 'airfield', DAY)?.id).toBe('a')
  })

  it('prefers a COMPLETED inspection over a later in-progress one (the lock fix)', () => {
    const completed = row({ id: 'done', status: 'completed', created_at: '2026-06-25T11:33:00Z' })
    const laterDraft = row({ id: 'dupe', status: 'in_progress', created_at: '2026-06-25T21:05:00Z' })
    // Newest-first input order, like the live list — completed must still win.
    expect(pickTodaysInspection([laterDraft, completed], 'airfield', DAY)?.id).toBe('done')
  })

  it('returns the newest completed when several completed exist', () => {
    const older = row({ id: 'old', status: 'completed', created_at: '2026-06-25T08:00:00Z' })
    const newer = row({ id: 'new', status: 'completed', created_at: '2026-06-25T14:00:00Z' })
    expect(pickTodaysInspection([older, newer], 'airfield', DAY)?.id).toBe('new')
  })

  it('returns the newest in-progress when no completed exists', () => {
    const older = row({ id: 'old', status: 'in_progress', created_at: '2026-06-25T08:00:00Z' })
    const newer = row({ id: 'new', status: 'in_progress', created_at: '2026-06-25T20:00:00Z' })
    expect(pickTodaysInspection([older, newer], 'airfield', DAY)?.id).toBe('new')
  })

  it('does not cross inspection types', () => {
    const lighting = row({ id: 'lt', inspection_type: 'lighting', status: 'completed' })
    expect(pickTodaysInspection([lighting], 'airfield', DAY)).toBeNull()
    expect(pickTodaysInspection([lighting], 'lighting', DAY)?.id).toBe('lt')
  })
})
