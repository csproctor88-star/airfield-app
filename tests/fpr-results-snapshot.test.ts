import { describe, it, expect } from 'vitest'
import {
  buildFprResultDrafts,
  type FprChecklistItemRow,
  type FprCheckResultRow,
} from '@/lib/supabase/fpr'

function makeItem(overrides: Partial<FprChecklistItemRow> & { id: string; label: string }): FprChecklistItemRow {
  return {
    base_id: 'b1',
    guidance: null,
    sort_order: 0,
    is_active: true,
    created_at: '2026-07-17T12:00:00Z',
    updated_at: '2026-07-17T12:00:00Z',
    ...overrides,
  }
}

function makeResult(overrides: Partial<FprCheckResultRow> & { item_label: string }): FprCheckResultRow {
  return {
    id: 'r1',
    check_id: 'c1',
    item_id: null,
    status: 'satisfactory',
    notes: null,
    sort_order: 0,
    created_at: '2026-07-17T12:00:00Z',
    ...overrides,
  }
}

describe('buildFprResultDrafts', () => {
  it('snapshots each item label and carries the item_id', () => {
    const items = [
      makeItem({ id: 'i1', label: 'FLIP products current', sort_order: 10 }),
      makeItem({ id: 'i2', label: 'NOTAM display current', sort_order: 20 }),
    ]
    const drafts = buildFprResultDrafts(items)
    expect(drafts).toEqual([
      { item_id: 'i1', item_label: 'FLIP products current', status: 'satisfactory', notes: '', sort_order: 10 },
      { item_id: 'i2', item_label: 'NOTAM display current', status: 'satisfactory', notes: '', sort_order: 20 },
    ])
  })

  it('preserves template sort order even when items arrive unsorted', () => {
    const items = [
      makeItem({ id: 'i3', label: 'Charts', sort_order: 30 }),
      makeItem({ id: 'i1', label: 'FLIP', sort_order: 10 }),
      makeItem({ id: 'i2', label: 'NOTAMs', sort_order: 20 }),
    ]
    const drafts = buildFprResultDrafts(items)
    expect(drafts.map(d => d.item_label)).toEqual(['FLIP', 'NOTAMs', 'Charts'])
    expect(drafts.map(d => d.sort_order)).toEqual([10, 20, 30])
  })

  it('excludes inactive items from new drafts', () => {
    const items = [
      makeItem({ id: 'i1', label: 'FLIP', sort_order: 10 }),
      makeItem({ id: 'i2', label: 'Retired item', sort_order: 20, is_active: false }),
      makeItem({ id: 'i3', label: 'Charts', sort_order: 30 }),
    ]
    const drafts = buildFprResultDrafts(items)
    expect(drafts.map(d => d.item_label)).toEqual(['FLIP', 'Charts'])
  })

  it('carries prior status and notes forward by item_id when editing', () => {
    const items = [
      makeItem({ id: 'i1', label: 'FLIP products current (renamed)', sort_order: 10 }),
      makeItem({ id: 'i2', label: 'NOTAM display current', sort_order: 20 }),
    ]
    const existing = [
      makeResult({ item_id: 'i1', item_label: 'FLIP products current', status: 'issue', notes: 'cycle expired' }),
      makeResult({ item_id: 'i2', item_label: 'NOTAM display current', status: 'na' }),
    ]
    const drafts = buildFprResultDrafts(items, existing)
    // Matched by item_id despite the rename; label re-snapshots to the current template label.
    expect(drafts[0]).toEqual({
      item_id: 'i1',
      item_label: 'FLIP products current (renamed)',
      status: 'issue',
      notes: 'cycle expired',
      sort_order: 10,
    })
    expect(drafts[1].status).toBe('na')
  })

  it('falls back to label matching when a prior result lost its item_id (template row deleted)', () => {
    const items = [makeItem({ id: 'i9', label: 'Weather briefing access', sort_order: 10 })]
    const existing = [
      makeResult({ item_id: null, item_label: 'Weather briefing access', status: 'issue', notes: 'terminal down' }),
    ]
    const drafts = buildFprResultDrafts(items, existing)
    expect(drafts[0].status).toBe('issue')
    expect(drafts[0].notes).toBe('terminal down')
    expect(drafts[0].item_id).toBe('i9')
  })

  it('defaults to satisfactory with empty notes when there is no prior result', () => {
    const items = [makeItem({ id: 'i1', label: 'FLIP', sort_order: 10 })]
    const drafts = buildFprResultDrafts(items, [])
    expect(drafts[0].status).toBe('satisfactory')
    expect(drafts[0].notes).toBe('')
  })

  // Snapshot preservation on EDIT: a saved check is a point-in-time record.
  // When the template changed after the check was logged, the edit draft
  // seeds only from ACTIVE items, so a since-deactivated/deleted item's prior
  // result row would be dropped by the delete-and-rewrite save. Those rows
  // must be preserved (appended after the active items).

  it('preserves a deactivated item\'s prior result row across an edit round-trip', () => {
    const items = [
      makeItem({ id: 'i1', label: 'FLIP', sort_order: 10 }),
      makeItem({ id: 'i2', label: 'Retired check', sort_order: 20, is_active: false }),
    ]
    const existing = [
      makeResult({ item_id: 'i1', item_label: 'FLIP', status: 'satisfactory', sort_order: 10 }),
      makeResult({ item_id: 'i2', item_label: 'Retired check', status: 'issue', notes: 'was flagged', sort_order: 20 }),
    ]
    const drafts = buildFprResultDrafts(items, existing)
    // Active item first; the deactivated item's snapshot row survives (appended).
    expect(drafts.map(d => d.item_label)).toEqual(['FLIP', 'Retired check'])
    expect(drafts[1]).toEqual({
      item_id: 'i2',
      item_label: 'Retired check',
      status: 'issue',
      notes: 'was flagged',
      sort_order: 20,
    })
  })

  it('preserves a prior result whose template item was hard-deleted (item_id nulled, label gone)', () => {
    const items = [makeItem({ id: 'i1', label: 'FLIP', sort_order: 10 })]
    const existing = [
      makeResult({ item_id: 'i1', item_label: 'FLIP', status: 'satisfactory', sort_order: 10 }),
      makeResult({ item_id: null, item_label: 'Deleted item', status: 'na', notes: null, sort_order: 20 }),
    ]
    const drafts = buildFprResultDrafts(items, existing)
    expect(drafts.map(d => d.item_label)).toEqual(['FLIP', 'Deleted item'])
    expect(drafts[1]).toMatchObject({ item_id: null, item_label: 'Deleted item', status: 'na', notes: '' })
  })

  it('still surfaces brand-new active items (added after the check) when editing', () => {
    const items = [
      makeItem({ id: 'i1', label: 'FLIP', sort_order: 10 }),
      makeItem({ id: 'i2', label: 'New item added after the check', sort_order: 20 }),
    ]
    const existing = [
      makeResult({ item_id: 'i1', item_label: 'FLIP', status: 'issue', notes: 'cycle expired', sort_order: 10 }),
    ]
    const drafts = buildFprResultDrafts(items, existing)
    expect(drafts.map(d => d.item_label)).toEqual(['FLIP', 'New item added after the check'])
    expect(drafts[0]).toMatchObject({ status: 'issue', notes: 'cycle expired' })
    expect(drafts[1]).toMatchObject({ item_id: 'i2', status: 'satisfactory', notes: '' })
  })

  it('appends no orphan rows for a NEW check (no existing results)', () => {
    const items = [
      makeItem({ id: 'i1', label: 'FLIP', sort_order: 10 }),
      makeItem({ id: 'i2', label: 'Charts', sort_order: 20 }),
    ]
    expect(buildFprResultDrafts(items)).toHaveLength(2)
    expect(buildFprResultDrafts(items, [])).toHaveLength(2)
  })
})
