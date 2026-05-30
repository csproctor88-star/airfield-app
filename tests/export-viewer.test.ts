import { describe, it, expect } from 'vitest'
import { buildViewerData, buildViewerFiles, viewerDataJs, type ViewerDataset } from '@/lib/export/export-viewer'
import type { ModuleRecords } from '@/lib/export/export-data'

function emptyRecords(): ModuleRecords {
  return {
    discrepancies: [], inspections: [], checks: [], obstructions: [], personnel: [],
    wildlife: [], dailyReviews: [], eventsLog: [],
    ppr: { columns: [], entries: [], coordsByEntry: {} },
    scn: { checks: [], agencies: [] },
    sms: { hazards: [], mitigations: [], audits: [], mocs: [], safetyReports: [] },
    aep: { plans: [], agencies: [], drills: [], commsChecks: [] },
    waivers: { waivers: [], criteriaByWaiver: {}, reviewsByWaiver: {}, coordinationByWaiver: {}, attachmentsByWaiver: {} },
    acsi: [], training: [], photos: [], photoResolver: {},
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function discrepancy(id: string, createdAt: string, title = 'Crack'): any {
  return {
    display_id: id, status: 'open', type: 'Pavement', title, location_text: 'RW05',
    assigned_shop: 'Pavements', work_order_number: 'WO1', created_at: createdAt,
    reporter: { name: 'Doe', rank: 'MSgt' },
  }
}

const base = { name: 'Test AAF', icao: 'KTST' }
const allTime = { kind: 'all_time' as const }

describe('buildViewerData', () => {
  it('builds a browse module from a tabular spec, filtered by period', () => {
    const records = emptyRecords()
    records.discrepancies = [
      discrepancy('DSC-1', '2026-01-10T00:00:00Z'),
      discrepancy('DSC-2', '2026-02-10T00:00:00Z'),
    ]
    const data = buildViewerData(records, {
      selectedKeys: ['discrepancies'], period: { kind: 'range', from: '2026-02-01', to: '2026-02-28' },
      base, generatedAt: '2026-05-30T00:00:00Z',
    })
    expect(data.modules).toHaveLength(1)
    expect(data.modules[0].label).toBe('Discrepancies')
    expect(data.modules[0].rows).toHaveLength(1)
    expect(data.modules[0].rows[0]).toContain('DSC-2')
  })

  it('omits modules with no rows and unselected modules', () => {
    const records = emptyRecords()
    records.discrepancies = [discrepancy('DSC-1', '2026-01-10T00:00:00Z')]
    const data = buildViewerData(records, { selectedKeys: ['checks'], period: allTime, base, generatedAt: '' })
    expect(data.modules).toEqual([])
  })

  it('lists PDF-only modules under documents with counts', () => {
    const records = emptyRecords()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    records.scn.checks = [{ check_date: '2026-05-01' } as any, { check_date: '2026-05-02' } as any]
    const data = buildViewerData(records, { selectedKeys: ['scn'], period: allTime, base, generatedAt: '' })
    expect(data.modules).toEqual([])
    expect(data.documents).toEqual([{ label: 'SCN Tests', count: 2, folder: 'SCN' }])
  })

  it('formats the events log into date/time/action columns', () => {
    const records = emptyRecords()
    records.eventsLog = [{ createdAt: '2026-05-02T13:45:00Z', action: 'Created Discrepancy', details: 'CRACK', oi: 'AB', user: 'MSgt Doe' }]
    const data = buildViewerData(records, { selectedKeys: ['events_log'], period: allTime, base, generatedAt: '' })
    expect(data.modules[0].columns).toContain('Action')
    expect(data.modules[0].rows[0]).toEqual(['2026-05-02', '13:45Z', 'Created Discrepancy', 'CRACK', 'AB', 'MSgt Doe'])
  })
})

describe('viewerDataJs', () => {
  it('escapes "<" so a record value cannot close the script tag', () => {
    const data: ViewerDataset = {
      base, period: allTime, generatedAt: '',
      modules: [{ key: 'd', label: 'D', columns: ['Title'], rows: [['</script><script>alert(1)']] }],
      documents: [],
    }
    const js = viewerDataJs(data)
    expect(js).not.toContain('</script>')
    expect(js).toContain('\\u003c/script>')
    expect(js.startsWith('window.__GLIDEPATH_EXPORT__ = ')).toBe(true)
  })
})

describe('buildViewerFiles', () => {
  it('emits a SINGLE self-contained index.html with everything inlined', () => {
    const records = emptyRecords()
    records.discrepancies = [discrepancy('DSC-1', '2026-05-01T00:00:00Z', 'Crack near 04')]
    const data = buildViewerData(records, { selectedKeys: ['discrepancies'], period: allTime, base, generatedAt: '2026-05-30T00:00:00Z' })
    const files = buildViewerFiles(data)
    // One file only — no sibling app.js/styles.css/data.js (mobile-safe).
    expect(files.map((f) => f.path)).toEqual(['viewer/index.html'])
    const html = new TextDecoder().decode(files[0].bytes)
    expect(html.length).toBeGreaterThan(0)
    // No external references — CSS + data + app are inlined.
    expect(html).not.toContain('src="data.js"')
    expect(html).not.toContain('href="styles.css"')
    expect(html).toContain('<style>')
    expect(html).toContain('window.__GLIDEPATH_EXPORT__')
    // The record data is embedded.
    expect(html).toContain('DSC-1')
    expect(html).toContain('Crack near 04')
  })

  it('escapes "<" in inlined data so a record value cannot break out of the script', () => {
    const records = emptyRecords()
    records.discrepancies = [discrepancy('DSC-2', '2026-05-01T00:00:00Z', '</script><script>alert(1)')]
    const html = new TextDecoder().decode(
      buildViewerFiles(buildViewerData(records, { selectedKeys: ['discrepancies'], period: allTime, base, generatedAt: '' }))[0].bytes,
    )
    // The malicious closing tag must be escaped, not present as a real tag.
    expect(html).toContain('\\u003c/script>')
  })
})
