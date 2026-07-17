import { describe, it, expect } from 'vitest'
import { buildUserActivityWorkbook } from '@/lib/reports/user-activity-excel'
import { USER_ACTIVITY_DOMAINS, type UserActivityData, type UserActivityRow } from '@/lib/reports/user-activity-data'

// Smoke coverage for the NAMO/NAMT Report Tool Excel workbook builder (Task 3).
// Contract: Promise<ExcelJS.Workbook> with a "Summary" sheet + one sheet per
// selected domain (drill-down records).

function zeroCounts(): UserActivityRow['counts'] {
  const out = {} as UserActivityRow['counts']
  for (const d of USER_ACTIVITY_DOMAINS) out[d.key] = 0
  return out
}

function emptyData(overrides: Partial<UserActivityData> = {}): UserActivityData {
  return { rows: [], totals: zeroCounts(), coverageNotes: [], ...overrides }
}

describe('buildUserActivityWorkbook', () => {
  it('builds a Summary sheet plus one sheet per selected domain on empty data', async () => {
    const wb = await buildUserActivityWorkbook(emptyData(), { domains: USER_ACTIVITY_DOMAINS })
    const sheetNames = wb.worksheets.map((ws) => ws.name)
    expect(sheetNames[0]).toBe('Summary')
    for (const d of USER_ACTIVITY_DOMAINS) {
      expect(sheetNames).toContain(d.label.slice(0, 31))
    }
    expect(wb.worksheets).toHaveLength(1 + USER_ACTIVITY_DOMAINS.length)
  })

  it('does not throw with zero selected domains', async () => {
    const wb = await buildUserActivityWorkbook(emptyData(), { domains: [] })
    expect(wb.worksheets).toHaveLength(1)
    expect(wb.worksheets[0].name).toBe('Summary')
  })

  it('the Summary sheet includes full (untruncated) display names and a bold Totals row', async () => {
    const longName = 'SSgt Alexandria Montgomery-Featherstonehaugh (AMF)'
    const rows: UserActivityRow[] = [
      {
        kind: 'profile', key: 'u1', display: longName,
        counts: { ...zeroCounts(), checks: 3 }, total: 3, records: {},
      },
      {
        kind: 'unlinked', key: 'a rae', display: 'A Rae',
        counts: { ...zeroCounts(), ppr: 2 }, total: 2, records: {},
      },
    ]
    const totals = zeroCounts()
    totals.checks = 3; totals.ppr = 2
    const data: UserActivityData = { rows, totals, coverageNotes: [] }

    const wb = await buildUserActivityWorkbook(data, { domains: USER_ACTIVITY_DOMAINS })
    const summary = wb.getWorksheet('Summary')!
    const userCol = summary.getRow(1).values as unknown as string[]
    expect(userCol).toContain('User')

    // Full name preserved verbatim, no truncation.
    const values = summary.getColumn(1).values as unknown as string[]
    expect(values).toContain(longName)
    expect(values).toContain('Totals')

    const totalsRowIdx = values.findIndex((v) => v === 'Totals')
    const totalsRow = summary.getRow(totalsRowIdx)
    expect(totalsRow.getCell(1).font?.bold).toBe(true)
  })

  it('per-domain sheets list drill-down records with user, label, and date columns', async () => {
    const rows: UserActivityRow[] = [
      {
        kind: 'profile', key: 'u1', display: 'SSgt Jane Doe (JD)',
        counts: { ...zeroCounts(), checks: 1 }, total: 1,
        records: { checks: [{ id: 'c1', label: 'AC-0001', ts: '2026-06-05T00:00:00.000Z', href: '/checks/c1' }] },
      },
    ]
    const totals = zeroCounts(); totals.checks = 1
    const data: UserActivityData = { rows, totals, coverageNotes: [] }

    const checksDomain = USER_ACTIVITY_DOMAINS.find((d) => d.key === 'checks')!
    const wb = await buildUserActivityWorkbook(data, { domains: [checksDomain] })
    const sheet = wb.getWorksheet(checksDomain.label)!
    expect(sheet.getRow(1).getCell(1).value).toBe('User')
    expect(sheet.getRow(2).getCell(1).value).toBe('SSgt Jane Doe (JD)')
    expect(sheet.getRow(2).getCell(2).value).toBe('AC-0001')
  })

  it('repeats coverage footnotes and the zero-activity-unavailable notice on the Summary sheet', async () => {
    const data = emptyData({
      zeroActivityUnavailable: true,
      coverageNotes: [{ domain: 'checks', coverageStart: '2026-03-03', affected: 4 }],
    })
    const wb = await buildUserActivityWorkbook(data, { domains: USER_ACTIVITY_DOMAINS })
    const summary = wb.getWorksheet('Summary')!
    const values = summary.getColumn(1).values as unknown as string[]
    expect(values.some((v) => typeof v === 'string' && v.includes('could not be loaded'))).toBe(true)
    expect(values.some((v) => typeof v === 'string' && v.includes('lack per-user attribution'))).toBe(true)
  })

  it('uses the singular verb "lacks" when exactly one record is affected', async () => {
    const data = emptyData({
      coverageNotes: [{ domain: 'checks', coverageStart: '2026-03-03', affected: 1 }],
    })
    const wb = await buildUserActivityWorkbook(data, { domains: USER_ACTIVITY_DOMAINS })
    const values = wb.getWorksheet('Summary')!.getColumn(1).values as unknown as string[]
    expect(values.some((v) => typeof v === 'string' && v.includes('1 record in this range lacks per-user attribution'))).toBe(true)
  })
})
