import { describe, it, expect } from 'vitest'
import {
  buildScnAgencyDrafts,
  type ScnCheckResultRow,
} from '@/lib/supabase/scn'

function makeAgency(overrides: { id: string; agency_name: string; sort_order?: number }) {
  return { sort_order: 0, ...overrides }
}

function makeResult(overrides: Partial<ScnCheckResultRow> & { agency_name: string }): ScnCheckResultRow {
  return {
    id: 'r1',
    check_id: 'c1',
    agency_id: null,
    status: 'loud_clear',
    notes: null,
    sort_order: 0,
    created_at: '2026-07-18T12:00:00Z',
    ...overrides,
  }
}

describe('buildScnAgencyDrafts', () => {
  it('snapshots each agency name and carries the agency_id', () => {
    const agencies = [
      makeAgency({ id: 'a1', agency_name: 'Fire Dept', sort_order: 10 }),
      makeAgency({ id: 'a2', agency_name: 'Tower', sort_order: 20 }),
    ]
    const drafts = buildScnAgencyDrafts(agencies)
    expect(drafts).toEqual([
      { agency_id: 'a1', agency_name: 'Fire Dept', status: 'loud_clear', notes: '', sort_order: 10 },
      { agency_id: 'a2', agency_name: 'Tower', status: 'loud_clear', notes: '', sort_order: 20 },
    ])
  })

  it('falls back to the list index when an agency has sort_order 0', () => {
    const agencies = [
      makeAgency({ id: 'a1', agency_name: 'Fire Dept' }),
      makeAgency({ id: 'a2', agency_name: 'Tower' }),
    ]
    const drafts = buildScnAgencyDrafts(agencies)
    expect(drafts.map(d => d.sort_order)).toEqual([0, 1])
  })

  it('carries prior status and notes forward by agency_id when editing', () => {
    const agencies = [
      makeAgency({ id: 'a1', agency_name: 'Fire Dept (renamed)', sort_order: 10 }),
      makeAgency({ id: 'a2', agency_name: 'Tower', sort_order: 20 }),
    ]
    const existing = [
      makeResult({ agency_id: 'a1', agency_name: 'Fire Dept', status: 'oos', notes: 'radio fault' }),
      makeResult({ agency_id: 'a2', agency_name: 'Tower', status: 'no_response' }),
    ]
    const drafts = buildScnAgencyDrafts(agencies, existing)
    // Matched by agency_id despite the rename; name re-snapshots to the current agency name.
    expect(drafts[0]).toEqual({
      agency_id: 'a1',
      agency_name: 'Fire Dept (renamed)',
      status: 'oos',
      notes: 'radio fault',
      sort_order: 10,
    })
    expect(drafts[1].status).toBe('no_response')
  })

  it('falls back to name matching when a prior result lost its agency_id (agency row deleted)', () => {
    const agencies = [makeAgency({ id: 'a9', agency_name: 'Security Forces', sort_order: 10 })]
    const existing = [
      makeResult({ agency_id: null, agency_name: 'Security Forces', status: 'oos', notes: 'phone line down' }),
    ]
    const drafts = buildScnAgencyDrafts(agencies, existing)
    expect(drafts[0].status).toBe('oos')
    expect(drafts[0].notes).toBe('phone line down')
    expect(drafts[0].agency_id).toBe('a9')
  })

  it('defaults to loud & clear with empty notes when there is no prior result', () => {
    const agencies = [makeAgency({ id: 'a1', agency_name: 'Fire Dept', sort_order: 10 })]
    const drafts = buildScnAgencyDrafts(agencies, [])
    expect(drafts[0].status).toBe('loud_clear')
    expect(drafts[0].notes).toBe('')
  })

  // Snapshot preservation on EDIT: a saved check is a point-in-time record.
  // When the agency roster changed after the check was logged, the edit
  // draft seeds only from ACTIVE agencies, so a since-deactivated/deleted
  // agency's prior result row would be dropped by the delete-and-rewrite
  // save. Those rows must be preserved (appended after the active rows).

  it('preserves a removed agency\'s prior result row across an edit round-trip', () => {
    const agencies = [makeAgency({ id: 'a1', agency_name: 'Fire Dept', sort_order: 10 })]
    const existing = [
      makeResult({ agency_id: 'a1', agency_name: 'Fire Dept', status: 'loud_clear', sort_order: 10 }),
      makeResult({ agency_id: 'a2', agency_name: 'Retired agency', status: 'oos', notes: 'was down', sort_order: 20 }),
    ]
    const drafts = buildScnAgencyDrafts(agencies, existing)
    // Active agency first; the removed agency's snapshot row survives (appended).
    expect(drafts.map(d => d.agency_name)).toEqual(['Fire Dept', 'Retired agency'])
    expect(drafts[1]).toEqual({
      agency_id: 'a2',
      agency_name: 'Retired agency',
      status: 'oos',
      notes: 'was down',
      sort_order: 20,
    })
  })

  it('preserves a prior result whose agency was hard-deleted (agency_id nulled, name gone)', () => {
    const agencies = [makeAgency({ id: 'a1', agency_name: 'Fire Dept', sort_order: 10 })]
    const existing = [
      makeResult({ agency_id: 'a1', agency_name: 'Fire Dept', status: 'loud_clear', sort_order: 10 }),
      makeResult({ agency_id: null, agency_name: 'Deleted agency', status: 'no_response', notes: null, sort_order: 20 }),
    ]
    const drafts = buildScnAgencyDrafts(agencies, existing)
    expect(drafts.map(d => d.agency_name)).toEqual(['Fire Dept', 'Deleted agency'])
    expect(drafts[1]).toMatchObject({ agency_id: null, agency_name: 'Deleted agency', status: 'no_response', notes: '' })
  })

  it('still surfaces brand-new agencies (added after the check) when editing', () => {
    const agencies = [
      makeAgency({ id: 'a1', agency_name: 'Fire Dept', sort_order: 10 }),
      makeAgency({ id: 'a2', agency_name: 'New agency added after the check', sort_order: 20 }),
    ]
    const existing = [
      makeResult({ agency_id: 'a1', agency_name: 'Fire Dept', status: 'oos', notes: 'radio fault', sort_order: 10 }),
    ]
    const drafts = buildScnAgencyDrafts(agencies, existing)
    expect(drafts.map(d => d.agency_name)).toEqual(['Fire Dept', 'New agency added after the check'])
    expect(drafts[0]).toMatchObject({ status: 'oos', notes: 'radio fault' })
    expect(drafts[1]).toMatchObject({ agency_id: 'a2', status: 'loud_clear', notes: '' })
  })

  it('appends no orphan rows for a NEW check (no existing results)', () => {
    const agencies = [
      makeAgency({ id: 'a1', agency_name: 'Fire Dept', sort_order: 10 }),
      makeAgency({ id: 'a2', agency_name: 'Tower', sort_order: 20 }),
    ]
    expect(buildScnAgencyDrafts(agencies)).toHaveLength(2)
    expect(buildScnAgencyDrafts(agencies, [])).toHaveLength(2)
  })
})
