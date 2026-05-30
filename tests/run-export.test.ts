import { describe, it, expect } from 'vitest'
import { buildExportFiles } from '@/lib/export/run-export'
import { buildExcelFiles } from '@/lib/export/export-excel'
import type { ModuleRecords } from '@/lib/export/export-data'

function emptyRecords(): ModuleRecords {
  return {
    discrepancies: [],
    inspections: [],
    checks: [],
    obstructions: [],
    personnel: [],
    wildlife: [],
    dailyReviews: [],
    eventsLog: [],
    ppr: { columns: [], entries: [], coordsByEntry: {} },
    scn: { checks: [], agencies: [] },
    sms: { hazards: [], mitigations: [], audits: [], mocs: [], safetyReports: [] },
    aep: { plans: [], agencies: [], drills: [], commsChecks: [] },
    waivers: { waivers: [], criteriaByWaiver: {}, reviewsByWaiver: {}, coordinationByWaiver: {}, attachmentsByWaiver: {} },
    acsi: [],
    training: [],
    photos: [],
    photoResolver: {},
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function discrepancy(id: string, createdAt: string): any {
  return {
    display_id: id, status: 'open', type: 'Pavement', title: 'Crack', location_text: 'RW05',
    assigned_shop: 'Pavements', work_order_number: 'WO1', created_at: createdAt,
    reporter: { name: 'Doe', rank: 'MSgt' },
  }
}

const base = { name: 'Test AAF', icao: 'KTST' }
const allTime = { kind: 'all_time' as const }

describe('buildExportFiles', () => {
  it('produces a PDF for a selected non-empty module + records the gap for an empty one', async () => {
    const records = emptyRecords()
    records.discrepancies = [discrepancy('DSC-1', '2026-01-10T00:00:00Z')]

    const built = await buildExportFiles(records, {
      selectedKeys: ['discrepancies', 'inspections'],
      period: allTime,
      outputMode: 'aggregate',
      base,
      include: { pdf: true, excel: false, json: false },
    })

    expect(built.files.map((f) => f.path)).toEqual(['documents/Discrepancies.pdf'])
    expect(built.modules.find((m) => m.key === 'discrepancies')).toMatchObject({ files: 1, records: 1 })
    expect(built.gaps).toContain('inspections')
  })

  it('emits a JSON sidecar per selected module when json is included', async () => {
    const records = emptyRecords()
    records.discrepancies = [discrepancy('DSC-1', '2026-01-10T00:00:00Z')]

    const built = await buildExportFiles(records, {
      selectedKeys: ['discrepancies'],
      period: allTime,
      outputMode: 'aggregate',
      base,
      include: { pdf: false, excel: false, json: true },
    })
    expect(built.files.map((f) => f.path)).toEqual(['data/discrepancies.json'])
    const text = new TextDecoder().decode(built.files[0].bytes)
    expect(JSON.parse(text)).toHaveLength(1)
  })

  it('builds an Excel workbook (+ master) when excel is included', async () => {
    const records = emptyRecords()
    records.discrepancies = [discrepancy('DSC-1', '2026-01-10T00:00:00Z')]

    const built = await buildExportFiles(records, {
      selectedKeys: ['discrepancies'],
      period: allTime,
      outputMode: 'aggregate',
      base,
      include: { pdf: false, excel: true, json: false },
    })
    const paths = built.files.map((f) => f.path).sort()
    expect(paths).toContain('spreadsheets/Discrepancies.xlsx')
    expect(paths).toContain('spreadsheets/00-Master-Workbook.xlsx')
  })

  it('returns no files and all-gaps when every selected module is empty', async () => {
    const built = await buildExportFiles(emptyRecords(), {
      selectedKeys: ['discrepancies', 'scn'],
      period: allTime,
      outputMode: 'aggregate',
      base,
      include: { pdf: true, excel: true, json: false },
    })
    expect(built.files).toEqual([])
    expect(built.gaps.sort()).toEqual(['discrepancies', 'scn'])
  })
})

describe('buildExcelFiles', () => {
  it('skips empty sheets and produces no master when nothing has rows', async () => {
    const result = await buildExcelFiles(emptyRecords(), { selectedKeys: ['discrepancies'], period: allTime })
    expect(result.perModule).toEqual({})
    expect(result.master).toBeNull()
  })

  it('writes one workbook per module with bytes', async () => {
    const records = emptyRecords()
    records.discrepancies = [discrepancy('DSC-1', '2026-01-10T00:00:00Z')]
    const result = await buildExcelFiles(records, { selectedKeys: ['discrepancies'], period: allTime })
    expect(result.perModule.discrepancies?.[0].path).toBe('spreadsheets/Discrepancies.xlsx')
    expect(result.perModule.discrepancies?.[0].bytes.length).toBeGreaterThan(0)
    expect(result.master?.path).toBe('spreadsheets/00-Master-Workbook.xlsx')
  })
})
