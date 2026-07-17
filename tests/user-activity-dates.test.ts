import { describe, it, expect } from 'vitest'
import {
  buildActivityMatrix,
  buildDomainQueryPlan,
  validateActivityRange,
  type DomainQueryPlan,
  type RawDomainRow,
  type UserActivityDomain,
} from '@/lib/reports/user-activity-data'
import type { SignerInfo } from '@/lib/supabase/daily-reviews'

// Local-day → UTC boundaries as the report page produces them
// (reports/daily/page.tsx:63-69 pattern; EDT example, UTC-4). The picked LOCAL
// range is 2026-07-01 → 2026-07-07: START_ISO is that local start at 00:00 and
// END_ISO is the local end day's 23:59:59.999, each pushed to UTC. START_DAY /
// END_DAY are the LOCAL calendar days the page threads to the query planner —
// NOT sliced from the ISO (slicing END_ISO would give '2026-07-08', a full
// local day past the picked range, which is the bug these tests now guard).
const START_ISO = '2026-07-01T04:00:00.000Z'
const END_ISO = '2026-07-08T03:59:59.999Z'
const START_DAY = '2026-07-01'
const END_DAY = '2026-07-07'

const ALL: UserActivityDomain[] = [
  'wildlife_sightings', 'wildlife_strikes', 'checks', 'inspections',
  'discrepancies', 'qrc_opened', 'qrc_closed', 'daily_review_signoffs', 'ppr',
]

/** Applies a query plan to an in-memory row the way PostgREST would. */
function matchesPlan(row: Record<string, unknown>, plan: DomainQueryPlan): boolean {
  const v = row[plan.dateColumn]
  if (typeof v !== 'string' || v === '') return false
  if (v < plan.gte || v > plan.lte) return false
  if (plan.status && row[plan.status.column] !== plan.status.value) return false
  return true
}

describe('buildDomainQueryPlan date semantics', () => {
  it('DATE columns (strike_date, review_date) filter on the picked LOCAL day strings', () => {
    const strikes = buildDomainQueryPlan('wildlife_strikes', START_ISO, END_ISO, START_DAY, END_DAY)
    expect(strikes.dateColumn).toBe('strike_date')
    expect(strikes.dateKind).toBe('date')
    expect(strikes.gte).toBe('2026-07-01')
    expect(strikes.lte).toBe('2026-07-07')

    const reviews = buildDomainQueryPlan('daily_review_signoffs', START_ISO, END_ISO, START_DAY, END_DAY)
    expect(reviews.dateColumn).toBe('review_date')
    expect(reviews.dateKind).toBe('date')
    expect(reviews.gte).toBe('2026-07-01')
    expect(reviews.lte).toBe('2026-07-07')
  })

  it('timestamptz domains filter on the full UTC boundaries', () => {
    for (const domain of ALL.filter((d) => d !== 'wildlife_strikes' && d !== 'daily_review_signoffs')) {
      const plan = buildDomainQueryPlan(domain, START_ISO, END_ISO, START_DAY, END_DAY)
      expect(plan.dateKind).toBe('timestamptz')
      expect(plan.gte).toBe(START_ISO)
      expect(plan.lte).toBe(END_ISO)
    }
  })

  it('uses each domain\'s verified date column', () => {
    const columns = Object.fromEntries(
      ALL.map((d) => [d, buildDomainQueryPlan(d, START_ISO, END_ISO, START_DAY, END_DAY).dateColumn]),
    )
    expect(columns).toEqual({
      wildlife_sightings: 'observed_at',
      wildlife_strikes: 'strike_date',
      checks: 'completed_at',
      inspections: 'completed_at',
      discrepancies: 'created_at',
      qrc_opened: 'opened_at',
      qrc_closed: 'closed_at',
      daily_review_signoffs: 'review_date',
      ppr: 'created_at',
    })
  })

  it('checks and inspections count completed rows only (drafts never counted)', () => {
    const checks = buildDomainQueryPlan('checks', START_ISO, END_ISO, START_DAY, END_DAY)
    expect(checks.status).toEqual({ column: 'status', value: 'completed' })
    const inspections = buildDomainQueryPlan('inspections', START_ISO, END_ISO, START_DAY, END_DAY)
    expect(inspections.status).toEqual({ column: 'status', value: 'completed' })

    const draft = { completed_at: '2026-07-02T12:00:00.000Z', status: 'draft' }
    expect(matchesPlan(draft, checks)).toBe(false)
    expect(matchesPlan({ ...draft, status: 'completed' }, checks)).toBe(true)
  })

  it('DATE filters honor the picked LOCAL end day — no extra day late for a UTC-negative base', () => {
    // EDT (UTC-4): local range ends 2026-07-07; END_ISO is 2026-07-08T03:59:59.999Z.
    // Slicing END_ISO → '2026-07-08' would admit a strike a full local day past
    // the picked range. Threading END_DAY forbids it.
    const plan = buildDomainQueryPlan('wildlife_strikes', START_ISO, END_ISO, START_DAY, END_DAY)
    expect(plan.lte).toBe('2026-07-07')
    expect(matchesPlan({ strike_date: '2026-07-07' }, plan)).toBe(true)   // range-end local day — included
    expect(matchesPlan({ strike_date: '2026-07-08' }, plan)).toBe(false)  // one local day past — excluded
    expect(matchesPlan({ strike_date: '2026-06-30' }, plan)).toBe(false)  // before the range
  })

  it('DATE filters honor the picked LOCAL start day — no missing day early for a UTC-positive base', () => {
    // JST (UTC+9): local range 2026-07-01 → 2026-07-07. Local start 00:00 is
    // 2026-06-30T15:00:00.000Z, whose slice '2026-06-30' would admit a strike a
    // local day before the picked range. Threading START_DAY forbids it.
    const startIsoPos = '2026-06-30T15:00:00.000Z'
    const endIsoPos = '2026-07-07T14:59:59.999Z'
    const plan = buildDomainQueryPlan('wildlife_strikes', startIsoPos, endIsoPos, '2026-07-01', '2026-07-07')
    expect(plan.gte).toBe('2026-07-01')
    expect(matchesPlan({ strike_date: '2026-06-30' }, plan)).toBe(false)  // one local day early — excluded
    expect(matchesPlan({ strike_date: '2026-07-01' }, plan)).toBe(true)   // range-start local day — included
    expect(matchesPlan({ strike_date: '2026-07-07' }, plan)).toBe(true)   // range-end local day — included
  })

  it('boundary instants are inclusive on timestamptz domains', () => {
    const plan = buildDomainQueryPlan('ppr', START_ISO, END_ISO, START_DAY, END_DAY)
    expect(matchesPlan({ created_at: START_ISO }, plan)).toBe(true)
    expect(matchesPlan({ created_at: END_ISO }, plan)).toBe(true)
    expect(matchesPlan({ created_at: '2026-07-01T03:59:59.999Z' }, plan)).toBe(false)
    expect(matchesPlan({ created_at: '2026-07-08T04:00:00.000Z' }, plan)).toBe(false)
  })
})

describe('QRC opened/closed separation', () => {
  const opener = 'aaaaaaaa-0000-0000-0000-000000000001'
  const closer = 'aaaaaaaa-0000-0000-0000-000000000002'
  const profiles = new Map<string, SignerInfo>([
    [opener, { id: opener, name: 'Opa Openshaw', rank: 'SSgt', operating_initials: 'OO' }],
    [closer, { id: closer, name: 'Clo Closer', rank: 'TSgt', operating_initials: 'CC' }],
  ])

  // Opened BEFORE the range, closed INSIDE it.
  const execution = {
    id: 'qrc-1',
    opened_by: opener,
    opened_at: '2026-06-20T10:00:00.000Z',
    closed_by: closer,
    closed_at: '2026-07-03T11:30:00.000Z',
    status: 'closed',
    qrc_number: 7,
    title: 'Aircraft Emergency',
    label: null,
  }

  it('a QRC opened before the range but closed inside counts only as a completion', () => {
    const openedPlan = buildDomainQueryPlan('qrc_opened', START_ISO, END_ISO, START_DAY, END_DAY)
    const closedPlan = buildDomainQueryPlan('qrc_closed', START_ISO, END_ISO, START_DAY, END_DAY)
    expect(openedPlan.dateColumn).toBe('opened_at')
    expect(openedPlan.status).toBeUndefined()
    expect(closedPlan.dateColumn).toBe('closed_at')
    expect(closedPlan.status).toEqual({ column: 'status', value: 'closed' })

    expect(matchesPlan(execution, openedPlan)).toBe(false)
    expect(matchesPlan(execution, closedPlan)).toBe(true)

    // Simulate the fan-out: each domain contributes only its matching rows.
    const raw: RawDomainRow[] = []
    if (matchesPlan(execution, openedPlan)) {
      raw.push({
        domain: 'qrc_opened', id: execution.id, actorId: execution.opened_by,
        actorName: null, ts: execution.opened_at, label: 'QRC 7 — Aircraft Emergency', href: null,
      })
    }
    if (matchesPlan(execution, closedPlan)) {
      raw.push({
        domain: 'qrc_closed', id: execution.id, actorId: execution.closed_by,
        actorName: null, ts: execution.closed_at, label: 'QRC 7 — Aircraft Emergency', href: null,
      })
    }

    const data = buildActivityMatrix(raw, profiles, ALL, START_ISO)
    expect(data.totals.qrc_opened).toBe(0)
    expect(data.totals.qrc_closed).toBe(1)
    const closerRow = data.rows.find((r) => r.key === closer)!
    expect(closerRow.counts.qrc_closed).toBe(1)
    expect(data.rows.find((r) => r.key === opener)).toBeUndefined()
  })

  it('a still-open QRC opened inside the range counts only as an initiation', () => {
    const stillOpen = { ...execution, opened_at: '2026-07-02T10:00:00.000Z', closed_by: null, closed_at: null, status: 'open' }
    const openedPlan = buildDomainQueryPlan('qrc_opened', START_ISO, END_ISO, START_DAY, END_DAY)
    const closedPlan = buildDomainQueryPlan('qrc_closed', START_ISO, END_ISO, START_DAY, END_DAY)
    expect(matchesPlan(stillOpen, openedPlan)).toBe(true)
    expect(matchesPlan(stillOpen, closedPlan)).toBe(false)
  })
})

describe('validateActivityRange', () => {
  it('accepts a well-formed range', () => {
    expect(validateActivityRange('2026-07-01', '2026-07-07')).toBeNull()
    expect(validateActivityRange('2026-07-07', '2026-07-07')).toBeNull() // single-day range
  })

  it('rejects a cleared endpoint before the boundary conversion can throw', () => {
    // A cleared custom From/To leaves '' — the old `end < start` check let it
    // through ('2026-07-17' < '' is false), then new Date('T00:00:00') → Invalid
    // Date → toISOString() threw and bricked Generate. The guard catches it.
    expect(validateActivityRange('', '2026-07-07')).toBe('Select both a start and end date')
    expect(validateActivityRange('2026-07-01', '')).toBe('Select both a start and end date')
    expect(validateActivityRange('', '')).toBe('Select both a start and end date')
  })

  it('rejects end-before-start', () => {
    expect(validateActivityRange('2026-07-08', '2026-07-01')).toBe('End date must be on or after the start date')
  })
})
