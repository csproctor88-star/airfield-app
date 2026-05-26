import { describe, it, expect } from 'vitest'
import {
  nextWhmpReviewDue,
  buildSmsHazardPromoteUrl,
  type WildlifeHazardAssessment,
  type WhmpFinding,
} from '@/lib/supabase/whmp'

// Pinned "today" at noon UTC — same shape as the AEP / training day-counter
// tests so the midnight-UTC truncation in daysBetween (per Phase 3a lesson)
// gets exercised.
const NOW = new Date('2026-09-26T12:00:00Z')

// ─────────────────────────────────────────────────────────────
// nextWhmpReviewDue — §139.337(c) annual review timer
// ─────────────────────────────────────────────────────────────

function makeWhmp(opts: { performed: string; lastReviewed?: string | null }): Pick<WildlifeHazardAssessment, 'performed_at' | 'last_reviewed_at'> {
  return {
    performed_at: opts.performed,
    last_reviewed_at: opts.lastReviewed === undefined ? null : opts.lastReviewed,
  }
}

describe('nextWhmpReviewDue', () => {
  it('returns "never" for null whmp', () => {
    expect(nextWhmpReviewDue(null, NOW).status).toBe('never')
  })

  it('anchors on performed_at when never reviewed', () => {
    // Performed 6 months ago → due in 6 months → current (>60d)
    const performed = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - 6, NOW.getUTCDate())).toISOString().slice(0, 10)
    const r = nextWhmpReviewDue(makeWhmp({ performed }), NOW)
    expect(r.status).toBe('current')
    expect(r.daysOut!).toBeGreaterThan(60)
  })

  it('returns "due_soon" within 60 days of the anniversary', () => {
    // Reviewed 11 months ago → due in ~1 month
    const lastReviewed = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - 11, NOW.getUTCDate())).toISOString()
    const r = nextWhmpReviewDue(makeWhmp({ performed: '2025-01-01', lastReviewed }), NOW)
    expect(r.status).toBe('due_soon')
    expect(r.daysOut!).toBeGreaterThanOrEqual(0)
    expect(r.daysOut!).toBeLessThanOrEqual(60)
  })

  it('returns "overdue" when past the anniversary', () => {
    const lastReviewed = new Date(Date.UTC(NOW.getUTCFullYear() - 2, NOW.getUTCMonth(), NOW.getUTCDate())).toISOString()
    const r = nextWhmpReviewDue(makeWhmp({ performed: '2024-01-01', lastReviewed }), NOW)
    expect(r.status).toBe('overdue')
    expect(r.daysOut!).toBeLessThan(0)
  })

  it('returns "current" when the next review is more than 60 days out', () => {
    const lastReviewed = new Date(NOW.getTime() - 30 * 86_400_000).toISOString() // reviewed 30 days ago
    const r = nextWhmpReviewDue(makeWhmp({ performed: '2024-01-01', lastReviewed }), NOW)
    expect(r.status).toBe('current')
    expect(r.daysOut!).toBeGreaterThan(60)
  })
})

// ─────────────────────────────────────────────────────────────
// buildSmsHazardPromoteUrl — deep-link query-param shape
// ─────────────────────────────────────────────────────────────

function makeFinding(overrides: Partial<WhmpFinding> = {}): WhmpFinding {
  return {
    id: 'finding-1',
    finding: 'Grass height exceeded 8 inches in May survey',
    category: 'habitat',
    recommended_action: 'Increase mowing cadence to weekly',
    sms_hazard_id: null,
    ...overrides,
  }
}

describe('buildSmsHazardPromoteUrl', () => {
  it('encodes title, source, and source-ref-id as query params', () => {
    const url = buildSmsHazardPromoteUrl({
      finding: makeFinding(),
      assessmentId: 'abc-123',
    })
    expect(url).toContain('/sms/hazards/new?')
    expect(url).toContain('prefill_source=whmp')
    expect(url).toContain('prefill_source_ref_id=abc-123')
    expect(url).toContain('prefill_title=Grass+height+exceeded+8+inches+in+May+survey')
    expect(url).toContain('prefill_description=Increase+mowing+cadence+to+weekly')
  })

  it('handles special characters and empty action', () => {
    const url = buildSmsHazardPromoteUrl({
      finding: makeFinding({ finding: 'Target grass height ≤ 6"', recommended_action: '' }),
      assessmentId: 'abc-123',
    })
    expect(url).toContain('prefill_title=Target+grass+height+%E2%89%A4+6%22')
    expect(url).toContain('prefill_description=')   // empty value still present
  })

  it('produces a URL that round-trips through URLSearchParams cleanly', () => {
    const url = buildSmsHazardPromoteUrl({
      finding: makeFinding({ finding: 'Hello, world! Pyrotechnics & wildlife dispersal.' }),
      assessmentId: 'x',
    })
    const query = url.split('?')[1]
    const params = new URLSearchParams(query)
    expect(params.get('prefill_title')).toBe('Hello, world! Pyrotechnics & wildlife dispersal.')
    expect(params.get('prefill_source')).toBe('whmp')
    expect(params.get('prefill_source_ref_id')).toBe('x')
  })
})
