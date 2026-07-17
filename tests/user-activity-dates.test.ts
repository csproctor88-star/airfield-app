import { describe, it, expect } from 'vitest'
import {
  buildActivityMatrix,
  buildDomainQueryPlan,
  type DomainQueryPlan,
  type RawDomainRow,
  type UserActivityDomain,
} from '@/lib/reports/user-activity-data'
import type { SignerInfo } from '@/lib/supabase/daily-reviews'

// Local-day → UTC boundaries as the report page produces them
// (reports/daily/page.tsx:63-69 pattern; EDT example, UTC-4).
const START_ISO = '2026-07-01T04:00:00.000Z'
const END_ISO = '2026-07-08T03:59:59.999Z'

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
  it('DATE columns (strike_date, review_date) filter on day strings', () => {
    const strikes = buildDomainQueryPlan('wildlife_strikes', START_ISO, END_ISO)
    expect(strikes.dateColumn).toBe('strike_date')
    expect(strikes.dateKind).toBe('date')
    expect(strikes.gte).toBe('2026-07-01')
    expect(strikes.lte).toBe('2026-07-08')

    const reviews = buildDomainQueryPlan('daily_review_signoffs', START_ISO, END_ISO)
    expect(reviews.dateColumn).toBe('review_date')
    expect(reviews.dateKind).toBe('date')
    expect(reviews.gte).toBe('2026-07-01')
    expect(reviews.lte).toBe('2026-07-08')
  })

  it('timestamptz domains filter on the full UTC boundaries', () => {
    for (const domain of ALL.filter((d) => d !== 'wildlife_strikes' && d !== 'daily_review_signoffs')) {
      const plan = buildDomainQueryPlan(domain, START_ISO, END_ISO)
      expect(plan.dateKind).toBe('timestamptz')
      expect(plan.gte).toBe(START_ISO)
      expect(plan.lte).toBe(END_ISO)
    }
  })

  it('uses each domain\'s verified date column', () => {
    const columns = Object.fromEntries(
      ALL.map((d) => [d, buildDomainQueryPlan(d, START_ISO, END_ISO).dateColumn]),
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
    const checks = buildDomainQueryPlan('checks', START_ISO, END_ISO)
    expect(checks.status).toEqual({ column: 'status', value: 'completed' })
    const inspections = buildDomainQueryPlan('inspections', START_ISO, END_ISO)
    expect(inspections.status).toEqual({ column: 'status', value: 'completed' })

    const draft = { completed_at: '2026-07-02T12:00:00.000Z', status: 'draft' }
    expect(matchesPlan(draft, checks)).toBe(false)
    expect(matchesPlan({ ...draft, status: 'completed' }, checks)).toBe(true)
  })

  it('a strike on the range-end local day is included despite the UTC offset', () => {
    // 2026-07-07 local strike — a naive timestamptz lte on END_ISO day-part
    // would still pass, but a strike_date equal to the end day must match.
    const plan = buildDomainQueryPlan('wildlife_strikes', START_ISO, END_ISO)
    expect(matchesPlan({ strike_date: '2026-07-08' }, plan)).toBe(true)
    expect(matchesPlan({ strike_date: '2026-06-30' }, plan)).toBe(false)
  })

  it('boundary instants are inclusive on timestamptz domains', () => {
    const plan = buildDomainQueryPlan('ppr', START_ISO, END_ISO)
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
    const openedPlan = buildDomainQueryPlan('qrc_opened', START_ISO, END_ISO)
    const closedPlan = buildDomainQueryPlan('qrc_closed', START_ISO, END_ISO)
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
    const openedPlan = buildDomainQueryPlan('qrc_opened', START_ISO, END_ISO)
    const closedPlan = buildDomainQueryPlan('qrc_closed', START_ISO, END_ISO)
    expect(matchesPlan(stillOpen, openedPlan)).toBe(true)
    expect(matchesPlan(stillOpen, closedPlan)).toBe(false)
  })
})
