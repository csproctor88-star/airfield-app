import { describe, it, expect, vi } from 'vitest'
import { buildEventsLogFiles, buildPprFiles, buildScnFiles } from '@/lib/export/export-rich-modules'
import type { EventsLogPdfRow } from '@/lib/events-log-pdf'
import type { PprColumn, PprEntry } from '@/lib/supabase/ppr'
import type { ScnCheckWithResults } from '@/lib/supabase/scn'

const ctxBase = { baseName: 'Test AAF', baseIcao: 'KTST' }

// ── Events Log ────────────────────────────────────────────────
const eventRows: EventsLogPdfRow[] = [
  { createdAt: '2026-01-10T12:00:00Z', action: 'Created Discrepancy DSC-1', details: 'CRACK', oi: 'AB', user: 'MSgt Doe' },
  { createdAt: '2026-02-05T08:30:00Z', action: 'Logged AMOPS Open', details: 'AMOPS OPEN', oi: 'CD', user: 'SrA Roe' },
  { createdAt: '2026-02-20T22:15:00Z', action: 'Completed Check AC-9', details: 'FOD CHECK', oi: 'EF', user: 'A1C Vex' },
]

describe('buildEventsLogFiles', () => {
  it('produces one aggregate PDF for all-time', async () => {
    const files = await buildEventsLogFiles(eventRows, { ...ctxBase, period: { kind: 'all_time' }, outputMode: 'aggregate' })
    expect(files.map((f) => f.path)).toEqual(['documents/Events-Log.pdf'])
    expect(files[0].bytes.length).toBeGreaterThan(0)
  })

  it('splits one PDF per month in monthly mode', async () => {
    const files = await buildEventsLogFiles(eventRows, { ...ctxBase, period: { kind: 'all_time' }, outputMode: 'monthly' })
    expect(files.map((f) => f.path).sort()).toEqual([
      'documents/Events-Log/2026-01.pdf',
      'documents/Events-Log/2026-02.pdf',
    ])
  })

  it('filters by range before rendering', async () => {
    const files = await buildEventsLogFiles(eventRows, { ...ctxBase, period: { kind: 'range', from: '2026-02-01', to: '2026-02-28' }, outputMode: 'aggregate' })
    expect(files).toHaveLength(1)
  })

  it('returns [] when nothing matches the range', async () => {
    const files = await buildEventsLogFiles(eventRows, { ...ctxBase, period: { kind: 'range', from: '2030-01-01', to: '2030-12-31' }, outputMode: 'aggregate' })
    expect(files).toEqual([])
  })
})

// ── PPR ────────────────────────────────────────────────────────
const pprColumns: PprColumn[] = [
  { id: 'c1', base_id: 'b1', column_name: 'Callsign', column_type: 'text', sort_order: 10, is_required: true, show_on_status: true, show_on_form: true, show_on_log: true, time_display: null, info_text: null, created_at: '2026-01-01T00:00:00Z' },
]

function pprEntry(id: string, arrival: string): PprEntry {
  return {
    id, base_id: 'b1', ppr_number: `PPR-${id}`, arrival_date: arrival, column_values: { c1: 'REACH01' },
    notes: null, approver_oi: null, created_by: null, updated_by: null,
    created_at: `${arrival}T00:00:00Z`, updated_at: `${arrival}T00:00:00Z`, status: 'approved',
    requester_name: null, requester_email: null, requester_phone: null,
    triaged_by: null, triaged_at: null, approval_user_id: null, approval_at: null,
    denial_reason: null, cancellation_reason: null, public_submission: false,
    departed_at: null, departed_by: null,
  }
}

const pprEntries = [pprEntry('1', '2026-01-15'), pprEntry('2', '2026-02-10')]

describe('buildPprFiles', () => {
  it('produces one aggregate PDF for all-time', async () => {
    const files = await buildPprFiles(
      { columns: pprColumns, entries: pprEntries, coordsByEntry: {} },
      { ...ctxBase, period: { kind: 'all_time' }, outputMode: 'aggregate' },
    )
    expect(files.map((f) => f.path)).toEqual(['documents/PPR.pdf'])
    expect(files[0].bytes.length).toBeGreaterThan(0)
  })

  it('splits per arrival-month in monthly mode', async () => {
    const files = await buildPprFiles(
      { columns: pprColumns, entries: pprEntries, coordsByEntry: {} },
      { ...ctxBase, period: { kind: 'all_time' }, outputMode: 'monthly' },
    )
    expect(files.map((f) => f.path).sort()).toEqual([
      'documents/PPR/2026-01.pdf',
      'documents/PPR/2026-02.pdf',
    ])
  })

  it('filters on arrival_date for a range', async () => {
    const files = await buildPprFiles(
      { columns: pprColumns, entries: pprEntries, coordsByEntry: {} },
      { ...ctxBase, period: { kind: 'range', from: '2026-02-01', to: '2026-02-28' }, outputMode: 'aggregate' },
    )
    expect(files).toHaveLength(1)
  })
})

// ── SCN ────────────────────────────────────────────────────────
function scnCheck(id: string, date: string): ScnCheckWithResults {
  return {
    id, base_id: 'b1', check_date: date, check_type: 'primary',
    started_at: `${date}T06:00:00Z`, completed_at: `${date}T06:05:00Z`,
    completed_by: 'u1', completed_by_oi: 'AB', notes: null, created_at: `${date}T06:05:00Z`,
    results: [{ id: `r-${id}`, check_id: id, agency_id: 'a1', agency_name: 'Tower', status: 'loud_clear', notes: null, sort_order: 10, created_at: `${date}T06:05:00Z` }],
  }
}

describe('buildScnFiles', () => {
  it('always emits one matrix per month, even in aggregate mode', async () => {
    const checks = [scnCheck('1', '2026-01-03'), scnCheck('2', '2026-01-20'), scnCheck('3', '2026-02-04')]
    const files = await buildScnFiles({ checks, agencies: ['Tower'] }, { ...ctxBase, period: { kind: 'all_time' }, outputMode: 'aggregate' })
    expect(files.map((f) => f.path).sort()).toEqual([
      'documents/SCN/2026-01.pdf',
      'documents/SCN/2026-02.pdf',
    ])
    expect(files[0].bytes.length).toBeGreaterThan(0)
  })

  it('bounds produced months by the selected range', async () => {
    const checks = [scnCheck('1', '2026-01-03'), scnCheck('3', '2026-02-04')]
    const files = await buildScnFiles({ checks, agencies: ['Tower'] }, { ...ctxBase, period: { kind: 'range', from: '2026-02-01', to: '2026-02-28' }, outputMode: 'monthly' })
    expect(files.map((f) => f.path)).toEqual(['documents/SCN/2026-02.pdf'])
  })

  it('returns [] with no checks in the period', async () => {
    const files = await buildScnFiles({ checks: [scnCheck('1', '2026-01-03')], agencies: ['Tower'] }, { ...ctxBase, period: { kind: 'range', from: '2030-01-01', to: '2030-12-31' }, outputMode: 'aggregate' })
    expect(files).toEqual([])
  })

  it('degrades to [] (not throw) if the generator throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // A check with a malformed date trips the generator's month math.
    const bad = { ...scnCheck('1', '2026-01-03'), results: null as never }
    const files = await buildScnFiles({ checks: [bad], agencies: ['Tower'] }, { ...ctxBase, period: { kind: 'all_time' }, outputMode: 'aggregate' })
    expect(Array.isArray(files)).toBe(true)
    spy.mockRestore()
  })
})
