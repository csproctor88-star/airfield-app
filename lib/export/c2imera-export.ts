// Export for C2IMERA — builds three separate Excel workbooks (Events Log, PPR
// Log, Airfield Discrepancies) shaped for import into C2IMERA (the USAF/ANG
// Command and Control Incident Management Emergency Response Application).
//
// The pure builders (buildEventsLogSheet / buildPprLogSheet /
// buildDiscrepanciesSheet) and the scope filter are unit-tested in
// tests/c2imera-export.test.ts — column order, headers, and value formats are
// load-bearing for a clean C2IMERA import, so they're locked there. The
// orchestrator (exportC2imera) does the IO: fetch → build → download three files.

import type { ColumnDef } from '@/lib/excel-export'
import { formatC2imeraDateTime, formatZuluDate } from '@/lib/utils'
import { humanize } from '@/lib/export/export-format'
import { formatAction, buildDetailsString } from '@/lib/activity-format'
import type { ActivityEntry, EntityDetails } from '@/lib/supabase/activity-queries'
import type { PprEntry } from '@/lib/supabase/ppr'
import type { DiscrepancyRow } from '@/lib/supabase/discrepancies'

export interface C2imeraSheet {
  columns: ColumnDef[]
  rows: Record<string, unknown>[]
}

const MS_PER_DAY = 86_400_000

// ── Events Log ──────────────────────────────────────────────────────
// Classification + Real World/Exercise + Unit are constant fills. "Time (L)"
// carries the Zulu timestamp in C2IMERA's DD MMM YY // HHMMZ shape (the column
// label is C2IMERA's; the value is Zulu by spec). Remarks/Event reuse the same
// formatters the on-screen Events Log uses, so the export matches the UI.
export function buildEventsLogSheet(
  entries: ActivityEntry[],
  detailsMap: Map<string, EntityDetails>,
  unit: string,
): C2imeraSheet {
  const columns: ColumnDef[] = [
    { header: 'Classification', key: 'classification', width: 14 },
    { header: 'Real World or Exercise', key: 'rwExercise', width: 20 },
    { header: 'Time (L)', key: 'time', width: 20 },
    { header: 'Unit', key: 'unit', width: 16 },
    { header: 'Remarks', key: 'remarks', width: 60 },
    { header: 'Event', key: 'event', width: 40 },
  ]
  const rows = entries.map((a) => ({
    classification: 'Unclassified',
    rwExercise: 'RW',
    time: formatC2imeraDateTime(a.created_at),
    unit,
    remarks: buildDetailsString(a, detailsMap),
    event: formatAction(a.action, a.entity_type, a.entity_display_id ?? undefined, a.metadata),
  }))
  return { columns, rows }
}

// ── PPR Log ─────────────────────────────────────────────────────────
export function buildPprLogSheet(entries: PprEntry[]): C2imeraSheet {
  const columns: ColumnDef[] = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'POC (Name and Number)', key: 'poc', width: 32 },
    { header: 'Status', key: 'status', width: 22 },
    { header: 'PPR Number', key: 'pprNumber', width: 18 },
  ]
  const rows = entries.map((e) => ({
    date: e.arrival_date,
    poc: joinPoc(e.requester_name, e.requester_phone),
    status: humanize(e.status),
    pprNumber: e.ppr_number,
  }))
  return { columns, rows }
}

function joinPoc(name: string | null, phone: string | null): string {
  const n = (name || '').trim()
  const p = (phone || '').trim()
  if (n && p) return `${n} — ${p}`
  return n || p
}

// ── Discrepancies ───────────────────────────────────────────────────
export function buildDiscrepanciesSheet(
  rows: DiscrepancyRow[],
  unit: string,
  now: number = Date.now(),
): C2imeraSheet {
  const columns: ColumnDef[] = [
    { header: 'Display ID', key: 'displayId', width: 16 },
    { header: 'Title', key: 'title', width: 36 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Current Status', key: 'currentStatus', width: 30 },
    { header: 'Coordinate', key: 'coordinate', width: 22 },
    { header: 'Location', key: 'location', width: 30 },
    { header: 'Assigned Shop', key: 'assignedShop', width: 22 },
    { header: 'W/O #', key: 'workOrder', width: 14 },
    { header: 'Days Open', key: 'daysOpen', width: 10 },
    { header: 'ECD', key: 'ecd', width: 14 },
    { header: 'Date Created', key: 'dateCreated', width: 14 },
    { header: 'Created By', key: 'createdBy', width: 22 },
    { header: 'Unit', key: 'unit', width: 16 },
  ]
  const dataRows = rows.map((d) => ({
    displayId: d.display_id,
    title: d.title,
    status: humanize(d.status),
    currentStatus: humanize(d.current_status),
    coordinate: d.latitude != null && d.longitude != null ? `${d.latitude}, ${d.longitude}` : '',
    location: d.location_text,
    assignedShop: d.assigned_shop || '',
    workOrder: d.work_order_number || '',
    daysOpen: Math.max(0, Math.floor((now - new Date(d.created_at).getTime()) / MS_PER_DAY)),
    ecd: d.estimated_completion_date ? formatC2imeraDateTime(d.estimated_completion_date) : '',
    dateCreated: formatZuluDate(d.created_at),
    createdBy: d.reporter ? `${d.reporter.rank || ''} ${d.reporter.name}`.trim() : '',
    unit,
  }))
  return { columns, rows: dataRows }
}

// Operational scope for the discrepancy export: every currently-open
// discrepancy (regardless of age) PLUS any discrepancy created within the
// selected date range (so items that closed/cancelled during the window are
// captured). Deduped by id. Dates compared on the Zulu (UTC) calendar day.
export function filterDiscrepanciesForC2imera(
  rows: DiscrepancyRow[],
  from: string,
  to: string,
): DiscrepancyRow[] {
  const seen = new Set<string>()
  const out: DiscrepancyRow[] = []
  for (const d of rows) {
    const createdDay = (d.created_at || '').slice(0, 10)
    const inRange = createdDay >= from && createdDay <= to
    if ((d.status === 'open' || inRange) && !seen.has(d.id)) {
      seen.add(d.id)
      out.push(d)
    }
  }
  return out
}

// ── Orchestrator (IO) ───────────────────────────────────────────────

export interface C2imeraExportOpts {
  baseId: string
  from: string // YYYY-MM-DD (inclusive)
  to: string // YYYY-MM-DD (inclusive)
  unit: string
}

/** Fetch the three logs for the range, build one 3-sheet workbook, download it. */
export async function exportC2imera(opts: C2imeraExportOpts): Promise<{ events: number; ppr: number; discrepancies: number }> {
  const { baseId, from, to, unit } = opts

  const [{ fetchActivityLogForExport, fetchEntityDetails }, { fetchPprEntries }, { fetchDiscrepancies }] =
    await Promise.all([
      import('@/lib/supabase/activity-queries'),
      import('@/lib/supabase/ppr'),
      import('@/lib/supabase/discrepancies'),
    ])

  const [activity, pprEntries, allDiscrepancies] = await Promise.all([
    fetchActivityLogForExport({
      baseId,
      startDate: `${from}T00:00:00.000Z`,
      endDate: `${to}T23:59:59.999Z`,
    }),
    fetchPprEntries(baseId, from, to),
    fetchDiscrepancies(baseId),
  ])

  const detailsMap = await fetchEntityDetails(activity.data)

  const events = buildEventsLogSheet(activity.data, detailsMap, unit)
  const ppr = buildPprLogSheet(pprEntries)
  const discrepancies = buildDiscrepanciesSheet(
    filterDiscrepanciesForC2imera(allDiscrepancies, from, to),
    unit,
  )

  const { createStyledWorkbook, addStyledSheet, saveWorkbook } = await import('@/lib/excel-export')
  const suffix = from === to ? from.replace(/-/g, '') : `${from.replace(/-/g, '')}-${to.replace(/-/g, '')}`

  // One workbook, three sheets — a single download (browsers block the rapid
  // multiple programmatic downloads that exporting three files would need).
  const wb = await createStyledWorkbook()
  addStyledSheet(wb, 'Events Log', events.columns, events.rows)
  addStyledSheet(wb, 'PPR Log', ppr.columns, ppr.rows)
  addStyledSheet(wb, 'Discrepancies', discrepancies.columns, discrepancies.rows)
  await saveWorkbook(wb, `C2IMERA_Export_${suffix}.xlsx`)

  return { events: events.rows.length, ppr: ppr.rows.length, discrepancies: discrepancies.rows.length }
}
