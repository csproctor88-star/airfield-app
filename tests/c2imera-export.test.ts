import { describe, it, expect } from 'vitest'
import {
  buildEventsLogSheet,
  buildPprLogSheet,
  buildDiscrepanciesSheet,
  filterDiscrepanciesForC2imera,
} from '@/lib/export/c2imera-export'
import { formatC2imeraDateTime } from '@/lib/utils'
import type { ActivityEntry, EntityDetails } from '@/lib/supabase/activity-queries'
import type { PprEntry } from '@/lib/supabase/ppr'
import type { DiscrepancyRow } from '@/lib/supabase/discrepancies'

// ─── C2IMERA export ───
// These exports feed a USAF/ANG C2IMERA import, so the column order, headers,
// and value formats below are load-bearing. Locks them against drift.

const UNIT = '127 OSS/OSAB'

function activityEntry(over: Partial<ActivityEntry>): ActivityEntry {
  return {
    id: 'a1',
    action: 'created',
    entity_type: 'discrepancy',
    entity_id: 'e1',
    entity_display_id: 'D-2026-AB12',
    metadata: null,
    created_at: '2026-06-01T14:30:00.000Z',
    user_name: 'Doe',
    user_rank: 'MSgt',
    user_role: null,
    user_edipi: null,
    user_operating_initials: 'JD',
    ...over,
  }
}

function pprEntry(over: Partial<PprEntry>): PprEntry {
  return {
    id: 'p1',
    base_id: 'b1',
    ppr_number: 'JUN-001-JD',
    arrival_date: '2026-06-01',
    column_values: {},
    notes: null,
    approver_oi: null,
    created_by: null,
    updated_by: null,
    created_at: '2026-05-30T00:00:00.000Z',
    updated_at: '2026-05-30T00:00:00.000Z',
    status: 'approved',
    requester_name: 'Jane Pilot',
    requester_email: null,
    requester_phone: '555-1234',
    triaged_by: null,
    triaged_at: null,
    approval_user_id: null,
    approval_at: null,
    denial_reason: null,
    cancellation_reason: null,
    public_submission: false,
    ...over,
  }
}

function discrepancy(over: Partial<DiscrepancyRow>): DiscrepancyRow {
  return {
    id: 'd1',
    display_id: 'D-2026-AB12',
    base_id: 'b1',
    type: 'lighting',
    status: 'open',
    current_status: 'submitted_to_afm',
    title: 'PAPI out',
    description: 'desc',
    location_text: 'RWY 01 approach',
    latitude: 42.6131,
    longitude: -82.8369,
    assigned_shop: 'Airfield Lighting',
    assigned_to: null,
    reported_by: 'u1',
    reporter: { name: 'Doe', rank: 'MSgt', operating_initials: 'JD' },
    work_order_number: 'WO-555',
    estimated_completion_date: '2026-06-15',
    created_at: '2026-05-22T12:00:00.000Z',
    updated_at: '2026-05-22T12:00:00.000Z',
    ...over,
  } as DiscrepancyRow
}

describe('formatC2imeraDateTime', () => {
  it('formats a timestamp as "DD MMM YY // HHMM" (no trailing Z)', () => {
    expect(formatC2imeraDateTime('2026-06-01T14:30:00.000Z')).toBe('01 JUN 26 // 1430')
  })

  it('zero-pads the day and uses the UTC (Zulu) calendar', () => {
    // 04:05Z on the 9th — single-digit day padded, month uppercase
    expect(formatC2imeraDateTime('2026-01-09T04:05:00.000Z')).toBe('09 JAN 26 // 0405')
  })

  it('accepts a Date instance', () => {
    expect(formatC2imeraDateTime(new Date('2026-12-25T23:59:00.000Z'))).toBe('25 DEC 26 // 2359')
  })
})

describe('buildEventsLogSheet', () => {
  it('emits the C2IMERA columns in order with the exact headers', () => {
    const { columns } = buildEventsLogSheet([], new Map(), UNIT)
    expect(columns.map((c) => c.header)).toEqual([
      'Classification',
      'Real World or Exercise',
      'Time (L)',
      'Unit',
      'Remarks',
      'Event',
    ])
  })

  it('fills the constant columns and maps time/unit/event', () => {
    const { columns, rows } = buildEventsLogSheet(
      [activityEntry({ action: 'created', entity_type: 'discrepancy', entity_display_id: 'D-2026-AB12' })],
      new Map<string, EntityDetails>(),
      UNIT,
    )
    const keyed = (r: Record<string, unknown>) =>
      Object.fromEntries(columns.map((c) => [c.header, r[c.key]]))
    const row = keyed(rows[0])
    expect(row['Classification']).toBe('Unclassified')
    expect(row['Real World or Exercise']).toBe('RW')
    expect(row['Time (L)']).toBe('01 JUN 26 // 1430')
    expect(row['Unit']).toBe('127 OSS/OSAB')
    expect(row['Event']).toBe('Created Discrepancy D-2026-AB12')
  })

  const remarksOf = (entry: ActivityEntry, details = new Map<string, EntityDetails>()) => {
    const { columns, rows } = buildEventsLogSheet([entry], details, UNIT)
    const key = columns.find((c) => c.header === 'Remarks')!.key
    return rows[0][key]
  }

  it('appends the OI after an ellipsis (no trailing period on the remarks)', () => {
    const details = new Map<string, EntityDetails>([['e1', { title: 'PAPI out' } as EntityDetails]])
    expect(remarksOf(activityEntry({ entity_id: 'e1', metadata: null, user_operating_initials: 'JD' }), details)).toBe('PAPI OUT...JD')
  })

  it('adds only two dots when the remarks already end in a period', () => {
    const details = new Map<string, EntityDetails>([['e1', { title: 'Work completed.' } as EntityDetails]])
    expect(remarksOf(activityEntry({ entity_id: 'e1', metadata: null, user_operating_initials: 'JD' }), details)).toBe('WORK COMPLETED...JD')
  })

  it('uses "N/A" when Remarks are blank, then appends the OI', () => {
    expect(remarksOf(activityEntry({ entity_id: null, metadata: null, user_operating_initials: 'JD' }))).toBe('N/A...JD')
  })

  it('omits the OI suffix when there are no operating initials', () => {
    expect(remarksOf(activityEntry({ entity_id: null, metadata: null, user_operating_initials: null }))).toBe('N/A')
  })
})

describe('buildPprLogSheet', () => {
  it('emits the C2IMERA PPR columns in order (no ETA)', () => {
    const { columns } = buildPprLogSheet([])
    expect(columns.map((c) => c.header)).toEqual([
      'Date',
      'POC (Name and Number)',
      'Status',
      'PPR Number',
    ])
  })

  it('joins POC name and number and humanizes status', () => {
    const { columns, rows } = buildPprLogSheet([pprEntry({ status: 'pending_amops_triage' })])
    const row = Object.fromEntries(columns.map((c) => [c.header, rows[0][c.key]]))
    expect(row['Date']).toBe('01 JUN 26')
    expect(row['POC (Name and Number)']).toBe('Jane Pilot — 555-1234')
    expect(row['Status']).toBe('Pending AMOPS Triage')
    expect(row['PPR Number']).toBe('JUN-001-JD')
  })

  it('handles a POC with only a name', () => {
    const { columns, rows } = buildPprLogSheet([pprEntry({ requester_phone: null })])
    const poc = columns.find((c) => c.header === 'POC (Name and Number)')!.key
    expect(rows[0][poc]).toBe('Jane Pilot')
  })
})

describe('buildDiscrepanciesSheet', () => {
  const NOW = Date.parse('2026-06-01T12:00:00.000Z')

  it('emits the 13 C2IMERA discrepancy columns in order', () => {
    const { columns } = buildDiscrepanciesSheet([], UNIT, NOW)
    expect(columns.map((c) => c.header)).toEqual([
      'Display ID',
      'Title',
      'Status',
      'Current Status',
      'Coordinate',
      'Location',
      'Assigned Shop',
      'W/O #',
      'Days Open',
      'ECD',
      'Date Created',
      'Created By',
      'Unit',
    ])
  })

  it('maps fields, joins coordinate, humanizes statuses, and computes Days Open', () => {
    const { columns, rows } = buildDiscrepanciesSheet([discrepancy({})], UNIT, NOW)
    const row = Object.fromEntries(columns.map((c) => [c.header, rows[0][c.key]]))
    expect(row['Display ID']).toBe('D-2026-AB12')
    expect(row['Title']).toBe('PAPI out')
    expect(row['Status']).toBe('Open')
    expect(row['Current Status']).toBe('Submitted To AFM')
    expect(row['Coordinate']).toBe('42.6131, -82.8369')
    expect(row['Location']).toBe('RWY 01 approach')
    expect(row['Assigned Shop']).toBe('Airfield Lighting')
    expect(row['W/O #']).toBe('WO-555')
    // created 2026-05-22T12:00Z, now 2026-06-01T12:00Z = 10 days
    expect(row['Days Open']).toBe(10)
    // ECD is a date-only field → midnight Zulu time component
    expect(row['ECD']).toBe('15 JUN 26 // 0000')
    expect(row['Created By']).toBe('MSgt Doe')
    expect(row['Unit']).toBe('127 OSS/OSAB')
  })

  it('blanks coordinate when either lat or lng is null', () => {
    const { columns, rows } = buildDiscrepanciesSheet([discrepancy({ longitude: null })], UNIT, NOW)
    const coordKey = columns.find((c) => c.header === 'Coordinate')!.key
    expect(rows[0][coordKey]).toBe('')
  })

  it('blanks W/O # and ECD when absent', () => {
    const { columns, rows } = buildDiscrepanciesSheet(
      [discrepancy({ work_order_number: null, estimated_completion_date: null })],
      UNIT,
      NOW,
    )
    const row = Object.fromEntries(columns.map((c) => [c.header, rows[0][c.key]]))
    expect(row['W/O #']).toBe('')
    expect(row['ECD']).toBe('')
  })
})

describe('filterDiscrepanciesForC2imera', () => {
  it('includes open discrepancies regardless of creation date', () => {
    const old = discrepancy({ id: 'old', status: 'open', created_at: '2025-01-01T00:00:00.000Z' })
    const out = filterDiscrepanciesForC2imera([old], '2026-06-01', '2026-06-01')
    expect(out.map((d) => d.id)).toEqual(['old'])
  })

  it('includes closed discrepancies created within the range', () => {
    const closedInRange = discrepancy({
      id: 'closed',
      status: 'completed',
      created_at: '2026-06-01T08:00:00.000Z',
    })
    const out = filterDiscrepanciesForC2imera([closedInRange], '2026-06-01', '2026-06-01')
    expect(out.map((d) => d.id)).toEqual(['closed'])
  })

  it('excludes closed discrepancies created outside the range', () => {
    const closedOld = discrepancy({
      id: 'closedOld',
      status: 'completed',
      created_at: '2026-05-01T08:00:00.000Z',
    })
    const out = filterDiscrepanciesForC2imera([closedOld], '2026-06-01', '2026-06-01')
    expect(out).toEqual([])
  })

  it('dedups by id (open AND in-range yields one row)', () => {
    const both = discrepancy({ id: 'both', status: 'open', created_at: '2026-06-01T08:00:00.000Z' })
    const out = filterDiscrepanciesForC2imera([both], '2026-06-01', '2026-06-01')
    expect(out.map((d) => d.id)).toEqual(['both'])
  })
})
