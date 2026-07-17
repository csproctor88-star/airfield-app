import { describe, it, expect } from 'vitest'
import {
  buildDrivingCheckDrafts,
  type DrivingCheckItemRow,
  type DrivingCheckResultRow,
} from '@/lib/supabase/driving-checks'

function makeItem(overrides: Partial<DrivingCheckItemRow> & { id: string; label: string; sort_order: number }): DrivingCheckItemRow {
  return {
    base_id: 'b1',
    guidance: null,
    is_active: true,
    created_at: '2026-07-17T12:00:00Z',
    updated_at: '2026-07-17T12:00:00Z',
    ...overrides,
  }
}

function makeResult(overrides: Partial<DrivingCheckResultRow> & { item_label: string; status: DrivingCheckResultRow['status']; sort_order: number }): DrivingCheckResultRow {
  return {
    id: `r-${Math.random().toString(36).slice(2)}`,
    check_id: 'c1',
    item_id: null,
    notes: null,
    created_at: '2026-07-17T12:00:00Z',
    ...overrides,
  }
}

describe('buildDrivingCheckDrafts', () => {
  it('builds one pass-defaulted draft per active item for a new check', () => {
    const items = [
      makeItem({ id: 'i2', label: 'FOD tire check', sort_order: 20 }),
      makeItem({ id: 'i1', label: 'Two-way radio', sort_order: 10 }),
    ]
    const drafts = buildDrivingCheckDrafts(items)
    // sorted by sort_order
    expect(drafts.map(d => d.item_label)).toEqual(['Two-way radio', 'FOD tire check'])
    expect(drafts.every(d => d.status === 'pass')).toBe(true)
    expect(drafts.every(d => d.notes === '')).toBe(true)
    expect(drafts.map(d => d.item_id)).toEqual(['i1', 'i2'])
  })

  it('excludes inactive items from new drafts', () => {
    const items = [
      makeItem({ id: 'i1', label: 'Active', sort_order: 10 }),
      makeItem({ id: 'i2', label: 'Inactive', sort_order: 20, is_active: false }),
    ]
    const drafts = buildDrivingCheckDrafts(items)
    expect(drafts.map(d => d.item_label)).toEqual(['Active'])
  })

  it('carries forward a prior result matched by item_id (survives a rename)', () => {
    const items = [makeItem({ id: 'i1', label: 'Radio (renamed)', sort_order: 10 })]
    const existing = [makeResult({ item_id: 'i1', item_label: 'Radio (old label)', status: 'discrepancy', notes: 'inop', sort_order: 10 })]
    const drafts = buildDrivingCheckDrafts(items, existing)
    expect(drafts).toHaveLength(1)
    // Label comes from the current active item, status/notes from the prior result.
    expect(drafts[0]).toMatchObject({ item_id: 'i1', item_label: 'Radio (renamed)', status: 'discrepancy', notes: 'inop' })
  })

  it('matches a prior result by label when its item_id was nulled by a delete', () => {
    const items = [makeItem({ id: 'i1', label: 'Seat belts', sort_order: 10 })]
    const existing = [makeResult({ item_id: null, item_label: 'Seat belts', status: 'na', sort_order: 10 })]
    const drafts = buildDrivingCheckDrafts(items, existing)
    expect(drafts[0]).toMatchObject({ item_id: 'i1', item_label: 'Seat belts', status: 'na' })
  })

  it('preserves an orphan prior result whose item is no longer active (snapshot preservation)', () => {
    const items = [makeItem({ id: 'i1', label: 'Active item', sort_order: 10 })]
    const existing = [
      makeResult({ item_id: 'i1', item_label: 'Active item', status: 'pass', sort_order: 10 }),
      // This item was deactivated/deleted after the check was logged — no active match.
      makeResult({ item_id: 'gone', item_label: 'Retired item', status: 'discrepancy', notes: 'still on record', sort_order: 20 }),
    ]
    const drafts = buildDrivingCheckDrafts(items, existing)
    expect(drafts).toHaveLength(2)
    // Orphan appended after the active items, carrying its own snapshot.
    expect(drafts[1]).toMatchObject({ item_id: 'gone', item_label: 'Retired item', status: 'discrepancy', notes: 'still on record' })
  })
})
