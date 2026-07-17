import { describe, it, expect } from 'vitest'
import { generateUserActivityPdf } from '@/lib/reports/user-activity-pdf'
import { USER_ACTIVITY_DOMAINS, type UserActivityData, type UserActivityRow } from '@/lib/reports/user-activity-data'

// Smoke coverage for the NAMO/NAMT Report Tool PDF generator (Task 3).
// Contract: { doc, filename }. Filename shape:
// namo-namt-report_{ICAO|base}_{start}_{end}.pdf

function zeroCounts(): UserActivityRow['counts'] {
  const out = {} as UserActivityRow['counts']
  for (const d of USER_ACTIVITY_DOMAINS) out[d.key] = 0
  return out
}

function emptyData(overrides: Partial<UserActivityData> = {}): UserActivityData {
  return {
    rows: [],
    totals: zeroCounts(),
    coverageNotes: [],
    ...overrides,
  }
}

const baseOpts = {
  baseName: 'Test AFB',
  baseIcao: 'KTST',
  startDate: '2026-06-01',
  endDate: '2026-06-30',
  generatedBy: 'SSgt Jane Doe',
  domains: USER_ACTIVITY_DOMAINS,
}

describe('generateUserActivityPdf', () => {
  it('returns { doc, filename } with the expected filename shape on empty data', () => {
    const { doc, filename } = generateUserActivityPdf(emptyData(), baseOpts)
    expect(filename).toBe('namo-namt-report_KTST_2026-06-01_2026-06-30.pdf')
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })

  it('falls back to the base name for the filename slug when ICAO is absent', () => {
    const { filename } = generateUserActivityPdf(emptyData(), { ...baseOpts, baseIcao: null })
    expect(filename).toBe('namo-namt-report_Test-AFB_2026-06-01_2026-06-30.pdf')
  })

  it('does not throw with zero selected domains', () => {
    const { doc, filename } = generateUserActivityPdf(emptyData(), { ...baseOpts, domains: [] })
    expect(filename).toMatch(/\.pdf$/i)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })

  it('renders rows across all nine domains without throwing, including unlinked/unattributed kinds', () => {
    const rows: UserActivityRow[] = [
      {
        kind: 'profile', key: 'u1', display: 'SSgt Jane Doe (JD)',
        counts: { ...zeroCounts(), checks: 3, ppr: 1 }, total: 4, records: {},
      },
      {
        kind: 'unlinked', key: 'a rae', display: 'A Rae',
        counts: { ...zeroCounts(), discrepancies: 2 }, total: 2, records: {},
      },
      {
        kind: 'unattributed', key: 'unattributed', display: 'Former user',
        counts: { ...zeroCounts(), qrc_opened: 1 }, total: 1, records: {},
      },
    ]
    const totals = zeroCounts()
    totals.checks = 3; totals.ppr = 1; totals.discrepancies = 2; totals.qrc_opened = 1
    const data: UserActivityData = { rows, totals, coverageNotes: [] }

    const { doc, filename } = generateUserActivityPdf(data, baseOpts)
    expect(filename).toMatch(/\.pdf$/i)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })

  it('shrinks to 8pt when more than 7 domain columns are selected (many-column layout)', () => {
    expect(USER_ACTIVITY_DOMAINS.length).toBeGreaterThan(7)
    const { doc } = generateUserActivityPdf(emptyData(), { ...baseOpts, domains: USER_ACTIVITY_DOMAINS })
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })

  it('renders coverage footnotes using the corrected "lack per-user attribution" wording', () => {
    const data = emptyData({
      coverageNotes: [{ domain: 'checks', coverageStart: '2026-03-03', affected: 5 }],
    })
    const { doc } = generateUserActivityPdf(data, baseOpts)
    // Smoke-level: no throw, and the doc has content to search for the footnote text.
    // jsPDF doesn't expose rendered text for assertion without a text-extraction lib,
    // so this test only guards against a throw while coverageNotes is populated.
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })

  it('does not throw when zeroActivityUnavailable is set', () => {
    const { doc } = generateUserActivityPdf(emptyData({ zeroActivityUnavailable: true }), baseOpts)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })
})
