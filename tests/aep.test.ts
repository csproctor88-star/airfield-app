import { describe, it, expect } from 'vitest'
import {
  daysBetween,
  nextFullScaleDue,
  nextAnnualReviewDue,
  summarizeCommsCheck,
  type AepDrill,
  type AepPlan,
  type AepCommsCheckWithResults,
  type AepResponseAgency,
} from '@/lib/supabase/aep'
import {
  generateAepPlanPdf,
  generateAepDrillLogPdf,
  generateAepCommsCheckMonthlyPdf,
} from '@/lib/aep-pdf'

// Pinned "today" at noon UTC so date-only fields (stored at midnight UTC)
// exercise the calendar-day truncation in daysBetween — the same shape that
// surfaced the floor-rounding bug during Phase 3a.
const NOW = new Date('2026-05-26T12:00:00Z')

function dateDaysFromNow(days: number): string {
  return new Date(NOW.getTime() + days * 86_400_000).toISOString().slice(0, 10)
}

// ────────────────────────────────────────────────────────────────
// daysBetween — calendar-day truncation
// ────────────────────────────────────────────────────────────────

describe('daysBetween', () => {
  it('returns positive whole days for future dates', () => {
    expect(daysBetween(dateDaysFromNow(10), NOW)).toBe(10)
    expect(daysBetween(dateDaysFromNow(365), NOW)).toBe(365)
  })

  it('returns negative whole days for past dates', () => {
    expect(daysBetween(dateDaysFromNow(-5), NOW)).toBe(-5)
    expect(daysBetween(dateDaysFromNow(-365), NOW)).toBe(-365)
  })

  it('truncates time-of-day on both sides (midnight-UTC bug regression)', () => {
    // Date-only string is interpreted as midnight UTC; NOW is noon UTC.
    // Without midnight-UTC truncation, raw ms math would return 29.5 → floor 29.
    expect(daysBetween('2026-06-25', NOW)).toBe(30)
  })

  it('accepts Date objects', () => {
    const future = new Date(NOW.getTime() + 7 * 86_400_000)
    expect(daysBetween(future, NOW)).toBe(7)
  })

  it('returns NaN for invalid date strings', () => {
    expect(daysBetween('not-a-date', NOW)).toBeNaN()
  })
})

// ────────────────────────────────────────────────────────────────
// nextFullScaleDue — §139.325(h) triennial cadence
// ────────────────────────────────────────────────────────────────

function drillOnDate(date: string): Pick<AepDrill, 'drill_date'> {
  return { drill_date: date }
}

describe('nextFullScaleDue', () => {
  it('returns "never" when no full-scale on record', () => {
    const r = nextFullScaleDue(null, NOW)
    expect(r.status).toBe('never')
    expect(r.date).toBeNull()
    expect(r.daysOut).toBeNull()
  })

  it('returns "current" when the next full-scale is more than 180 days out', () => {
    const lastYear = dateDaysFromNow(-365)         // ~24 months left until +36
    const r = nextFullScaleDue(drillOnDate(lastYear), NOW)
    expect(r.status).toBe('current')
    expect(r.daysOut!).toBeGreaterThan(180)
  })

  it('returns "due_soon" when within 180 days of the 36-month anniversary', () => {
    // Drill ~33 months ago → next due ~3 months out.
    const d = new Date(Date.UTC(NOW.getUTCFullYear() - 3, NOW.getUTCMonth() + 3, NOW.getUTCDate()))
      .toISOString().slice(0, 10)
    const r = nextFullScaleDue(drillOnDate(d), NOW)
    expect(r.status).toBe('due_soon')
    expect(r.daysOut!).toBeGreaterThanOrEqual(0)
    expect(r.daysOut!).toBeLessThanOrEqual(180)
  })

  it('returns "overdue" when past the 36-month anniversary', () => {
    // Drill 4 years ago → 12 months overdue.
    const d = new Date(Date.UTC(NOW.getUTCFullYear() - 4, NOW.getUTCMonth(), NOW.getUTCDate()))
      .toISOString().slice(0, 10)
    const r = nextFullScaleDue(drillOnDate(d), NOW)
    expect(r.status).toBe('overdue')
    expect(r.daysOut!).toBeLessThan(0)
  })

  it('handles the exact 36-month boundary as due_soon (0 days)', () => {
    const d = new Date(Date.UTC(NOW.getUTCFullYear() - 3, NOW.getUTCMonth(), NOW.getUTCDate()))
      .toISOString().slice(0, 10)
    const r = nextFullScaleDue(drillOnDate(d), NOW)
    expect(r.status).toBe('due_soon')
    expect(r.daysOut).toBe(0)
  })
})

// ────────────────────────────────────────────────────────────────
// nextAnnualReviewDue — §139.325(d) annual review
// ────────────────────────────────────────────────────────────────

function planFixture(opts: { effective: string; lastReviewed?: string | null }): Pick<AepPlan, 'effective_date' | 'last_reviewed_at'> {
  return {
    effective_date: opts.effective,
    last_reviewed_at: opts.lastReviewed === undefined ? null : opts.lastReviewed,
  }
}

describe('nextAnnualReviewDue', () => {
  it('returns "never" for null plan', () => {
    expect(nextAnnualReviewDue(null, NOW).status).toBe('never')
  })

  it('anchors on effective_date when never reviewed', () => {
    // Effective 6 months ago → due in 6 months → current
    const eff = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - 6, NOW.getUTCDate()))
      .toISOString().slice(0, 10)
    const r = nextAnnualReviewDue(planFixture({ effective: eff }), NOW)
    expect(r.status).toBe('current')
    expect(r.daysOut!).toBeGreaterThan(60)
  })

  it('returns "due_soon" when within 60 days of the annual anniversary', () => {
    // Reviewed 11 months ago → due in 1 month → due_soon
    const lastReviewed = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - 11, NOW.getUTCDate()))
      .toISOString()
    const r = nextAnnualReviewDue(planFixture({ effective: '2025-01-01', lastReviewed }), NOW)
    expect(r.status).toBe('due_soon')
  })

  it('returns "overdue" when past the annual anniversary', () => {
    const lastReviewed = new Date(Date.UTC(NOW.getUTCFullYear() - 2, NOW.getUTCMonth(), NOW.getUTCDate()))
      .toISOString()
    const r = nextAnnualReviewDue(planFixture({ effective: '2024-01-01', lastReviewed }), NOW)
    expect(r.status).toBe('overdue')
    expect(r.daysOut!).toBeLessThan(0)
  })
})

// ────────────────────────────────────────────────────────────────
// summarizeCommsCheck — Events Log entry
// ────────────────────────────────────────────────────────────────

function makeCheck(results: Array<{ name: string; status: 'loud_clear' | 'no_response' | 'oos' | 'not_reached'; notes?: string | null }>): AepCommsCheckWithResults {
  return {
    id: 'check-1',
    base_id: 'base-1',
    check_date: '2026-06-01',
    check_period: 'monthly',
    started_at: '2026-06-01T13:00:00Z',
    completed_at: '2026-06-01T13:15:00Z',
    completed_by: null,
    completed_by_oi: 'JD',
    notes: null,
    created_at: '2026-06-01T13:00:00Z',
    results: results.map((r, i) => ({
      id: `r-${i}`,
      check_id: 'check-1',
      agency_id: null,
      agency_name: r.name,
      agency_role: 'arff',
      status: r.status,
      notes: r.notes ?? null,
      sort_order: i,
      created_at: '2026-06-01T13:00:00Z',
    })),
  }
}

describe('summarizeCommsCheck', () => {
  it('produces the all-clear sentence when every agency is loud & clear', () => {
    const c = makeCheck([
      { name: 'Engine 7', status: 'loud_clear' },
      { name: 'Mercy Hospital', status: 'loud_clear' },
    ])
    expect(summarizeCommsCheck(c)).toBe('AEP comms check complete — all agencies loud & clear')
  })

  it('lists exceptions in order with status labels', () => {
    const c = makeCheck([
      { name: 'Engine 7', status: 'loud_clear' },
      { name: 'Mercy Hospital', status: 'no_response' },
      { name: 'Tower', status: 'oos', notes: 'radio in shop' },
    ])
    const s = summarizeCommsCheck(c)
    expect(s).toContain('Mercy Hospital (No Response)')
    expect(s).toContain('Tower (Out of Service: radio in shop)')
    expect(s.startsWith('AEP comms check complete — all loud & clear except ')).toBe(true)
  })

  it('handles a check where nothing went loud & clear', () => {
    const c = makeCheck([
      { name: 'Engine 7', status: 'no_response' },
      { name: 'Tower', status: 'not_reached' },
    ])
    const s = summarizeCommsCheck(c)
    expect(s).toContain('Engine 7 (No Response)')
    expect(s).toContain('Tower (Not Reached)')
  })
})

// ────────────────────────────────────────────────────────────────
// PDF smoke tests — each generator returns { doc, filename } and the
// PDF has at least one page even with zero data.
// ────────────────────────────────────────────────────────────────

const BASE = { name: 'Demo Regional Airport', icao: 'KDRA' }

function fakeAgency(role: AepResponseAgency['agency_role'], name: string, i: number): AepResponseAgency {
  return {
    id: `ag-${i}`,
    base_id: 'base-1',
    agency_name: name,
    agency_role: role,
    primary_contact_name: 'Dispatch',
    primary_contact_phone: '555-555-5555',
    primary_contact_radio: 'VHF 154.220',
    backup_contact_name: null,
    backup_contact_phone: null,
    notes: null,
    sort_order: i * 10,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

function fakePlan(): AepPlan {
  return {
    id: 'plan-1',
    base_id: 'base-1',
    version: '2026.1',
    effective_date: '2026-04-15',
    document_url: 'https://example.com/aep.pdf',
    storage_path: 'aep-plans/base-1/plan-1/plan.pdf',
    approved_by_faa_at: '2026-05-02',
    faa_acceptance_ref: 'GL-AEP-2026-04',
    ae_user_id: 'u-ae',
    ae_signed_at: '2026-05-03T14:00:00Z',
    last_reviewed_at: null,
    reviewed_by_user_id: null,
    review_notes: null,
    replaced_by_id: null,
    notes: null,
    created_at: '2026-05-03T14:00:00Z',
    created_by: 'u-coord',
    updated_at: '2026-05-03T14:00:00Z',
  }
}

describe('generateAepPlanPdf', () => {
  it('produces a PDF with no plan and no agencies (graceful empty state)', () => {
    const { doc, filename } = generateAepPlanPdf({
      base: BASE, plan: null, planHistory: [], agencies: [],
    })
    expect(doc.getNumberOfPages()).toBeGreaterThan(0)
    expect(filename).toMatch(/^aep-plan-KDRA-no-plan-\d{8}\.pdf$/)
  })

  it('produces a PDF with a populated plan + agencies', () => {
    const plan = fakePlan()
    const agencies = [
      fakeAgency('arff', 'Engine 7', 0),
      fakeAgency('mutual_aid_fire', 'Springfield FD', 1),
      fakeAgency('ems', 'County EMS', 2),
      fakeAgency('hospital', 'Mercy Hospital', 3),
    ]
    const { doc, filename } = generateAepPlanPdf({
      base: BASE, plan, planHistory: [plan], agencies,
    })
    expect(doc.getNumberOfPages()).toBeGreaterThan(0)
    expect(filename).toMatch(/^aep-plan-KDRA-2026\.1-\d{8}\.pdf$/)
  })
})

describe('generateAepDrillLogPdf', () => {
  it('produces a PDF with no drills (empty year)', () => {
    const { doc, filename } = generateAepDrillLogPdf({
      base: BASE, drills: [], year: 2026,
    })
    expect(doc.getNumberOfPages()).toBeGreaterThan(0)
    expect(filename).toBe('aep-drills-KDRA-2026.pdf')
  })

  it('produces a PDF with drills + per-drill detail blocks', () => {
    const drills: AepDrill[] = [
      {
        id: 'd1', base_id: 'b', drill_date: '2026-04-15',
        drill_type: 'tabletop', scenario: 'Hazmat response',
        status: 'completed', participants: [
          { agency_id: 'a1', agency_name: 'Engine 7', role: 'arff', attended: true },
          { agency_id: 'a2', agency_name: 'Mercy Hospital', role: 'hospital', attended: false },
        ],
        after_action_notes: 'Worked through hazmat decision tree end-to-end.',
        findings: 'Need updated MSDS for new fueling agent.',
        evidence_url: null, storage_path: null, next_due_at_override: null,
        completed_at: '2026-04-15T15:00:00Z', completed_by: 'u',
        created_at: '2026-04-01T00:00:00Z', created_by: 'u',
        updated_at: '2026-04-15T15:00:00Z',
      },
    ]
    const { doc } = generateAepDrillLogPdf({ base: BASE, drills, year: 2026 })
    expect(doc.getNumberOfPages()).toBeGreaterThan(0)
  })
})

describe('generateAepCommsCheckMonthlyPdf', () => {
  it('produces a PDF with no checks for the month', () => {
    const { doc, filename } = generateAepCommsCheckMonthlyPdf({
      base: BASE, monthYyyyMm: '2026-06', agencies: [], checks: [],
    })
    expect(doc.getNumberOfPages()).toBeGreaterThan(0)
    expect(filename).toBe('aep-comms-check-KDRA-2026-06.pdf')
  })

  it('produces a PDF with the agency × check-date matrix populated', () => {
    const agencies = [
      fakeAgency('arff', 'Engine 7', 0),
      fakeAgency('hospital', 'Mercy Hospital', 1),
    ]
    const check = makeCheck([
      { name: 'Engine 7', status: 'loud_clear' },
      { name: 'Mercy Hospital', status: 'oos', notes: 'radio in shop' },
    ])
    const { doc, filename } = generateAepCommsCheckMonthlyPdf({
      base: BASE,
      monthYyyyMm: '2026-06',
      agencies,
      checks: [check],
    })
    expect(doc.getNumberOfPages()).toBeGreaterThan(0)
    expect(filename).toBe('aep-comms-check-KDRA-2026-06.pdf')
  })
})
