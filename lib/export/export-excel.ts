// Records Export — Excel layer (Phase 3).
//
// One workbook per tabular module + a master workbook with one sheet per
// module/kind. Unlike the PDF tables (which render a compact, human-readable
// column subset), the Excel sheets serialize EVERY scalar field on each record
// so the spreadsheet is the comprehensive data copy. Period filtering reuses
// each module's natural-date accessor (the same getDate the PDF specs use), so
// the two exports always cover the same rows. Per-record / matrix modules
// (Waivers, ACSI, Training, PPR, SCN, Events Log) are PDF-only.
import { createStyledWorkbook, addStyledSheet, type ColumnDef } from '@/lib/excel-export'
import { isInRange, type ExportPeriod } from './export-period'
import { EXPORT_MODULES } from './export-modules'
import { humanize, type TableModuleSpec } from './export-table-specs'
import type { ExportFile } from './export-file'
import type { ModuleRecords } from './export-data'
import {
  DISCREPANCIES_SPEC,
  INSPECTIONS_SPEC,
  CHECKS_SPEC,
  OBSTRUCTIONS_SPEC,
  PERSONNEL_SPEC,
  WILDLIFE_SPEC,
  DAILY_REVIEWS_SPEC,
} from './export-table-specs'
import {
  SMS_HAZARDS_SPEC,
  SMS_MITIGATIONS_SPEC,
  SMS_AUDITS_SPEC,
  SMS_MOC_SPEC,
  SMS_SAFETY_REPORTS_SPEC,
  AEP_PLANS_SPEC,
  AEP_AGENCIES_SPEC,
  AEP_DRILLS_SPEC,
  AEP_COMMS_CHECKS_SPEC,
} from './export-civilian-specs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface SheetJob { moduleKey: string; sheetName: string; spec: TableModuleSpec<any>; rows: any[] }

const folderOf = (key: string): string => EXPORT_MODULES.find((m) => m.key === key)?.folder ?? key
/** Short prefix used to disambiguate multi-kind sheets in the master workbook. */
const SHORT: Record<string, string> = { sms: 'SMS', aep: 'AEP' }

/** Excel sheet names: <=31 chars, no \ / ? * [ ] : */
function sanitizeSheetName(s: string): string {
  return s.replace(/[\\/?*[\]:]/g, '-').slice(0, 31) || 'Sheet'
}

function uniqueName(base: string, used: Set<string>): string {
  let name = base
  let n = 2
  while (used.has(name)) {
    const suffix = `-${n++}`
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`
  }
  used.add(name)
  return name
}

/** Column header from a field key: split snake_case + camelCase, then humanize
 *  (uppercases known acronyms, Title-Cases the rest). 'timeOfDay' -> 'Time Of
 *  Day', 'work_order_number' -> 'Work Order Number', 'bwc' -> 'BWC'. */
function fieldHeader(key: string): string {
  return humanize(key.replace(/([a-z0-9])([A-Z])/g, '$1 $2'))
}

/**
 * Format one field value for a spreadsheet cell. Returns null for values that
 * shouldn't get a column (nested objects/object-arrays) so the column is
 * dropped. Scalars, string/number arrays, and person-shaped objects render.
 */
function formatCell(v: unknown): string | null {
  if (v == null) return ''
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return v
  if (Array.isArray(v)) {
    if (v.length === 0) return ''
    if (v.every((x) => typeof x === 'string' || typeof x === 'number')) return v.join('; ')
    return null // array of objects — not a scalar column
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (typeof o.name === 'string') {
      // person-shaped ref (e.g. discrepancy reporter): "Rank Name"
      return [o.rank, o.name].filter((x) => typeof x === 'string' && x).join(' ') || o.name
    }
    return null // generic nested object — skip
  }
  return null
}

interface SheetData { columns: ColumnDef[]; data: Record<string, string>[] }

/**
 * Serialize records into a sheet with every scalar field as a column. Filters by
 * the module's natural date first; drops columns that are empty across all rows.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowsToSheet(rows: any[], getDate: (r: any) => string | null | undefined, period: ExportPeriod): SheetData {
  const filtered = rows.filter((r) => isInRange(getDate(r), period))
  if (filtered.length === 0) return { columns: [], data: [] }

  // Field keys in first-seen order across all rows.
  const keys: string[] = []
  const seen = new Set<string>()
  for (const r of filtered) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) { seen.add(k); keys.push(k) }
    }
  }

  // Render every cell; a key formatting to null for ALL rows is not a column.
  const rendered = filtered.map((r) => {
    const o: Record<string, string | null> = {}
    for (const k of keys) o[k] = formatCell(r[k])
    return o
  })
  const keptKeys = keys.filter((k) => rendered.some((row) => row[k] != null && row[k] !== ''))

  const columns: ColumnDef[] = keptKeys.map((k) => {
    const header = fieldHeader(k)
    return { header, key: k, width: Math.min(48, Math.max(12, header.length + 4)) }
  })
  const data = rendered.map((row) => {
    const o: Record<string, string> = {}
    for (const k of keptKeys) o[k] = row[k] ?? ''
    return o
  })
  return { columns, data }
}

function jobsFor(records: ModuleRecords): SheetJob[] {
  return [
    { moduleKey: 'discrepancies', sheetName: 'Discrepancies', spec: DISCREPANCIES_SPEC, rows: records.discrepancies },
    { moduleKey: 'inspections', sheetName: 'Inspections', spec: INSPECTIONS_SPEC, rows: records.inspections },
    { moduleKey: 'checks', sheetName: 'Airfield Checks', spec: CHECKS_SPEC, rows: records.checks },
    { moduleKey: 'obstructions', sheetName: 'Obstructions', spec: OBSTRUCTIONS_SPEC, rows: records.obstructions },
    { moduleKey: 'personnel', sheetName: 'Personnel', spec: PERSONNEL_SPEC, rows: records.personnel },
    { moduleKey: 'wildlife', sheetName: 'Wildlife', spec: WILDLIFE_SPEC, rows: records.wildlife },
    { moduleKey: 'daily_reviews', sheetName: 'Daily Reviews', spec: DAILY_REVIEWS_SPEC, rows: records.dailyReviews },
    { moduleKey: 'sms', sheetName: 'Hazards', spec: SMS_HAZARDS_SPEC, rows: records.sms.hazards },
    { moduleKey: 'sms', sheetName: 'Mitigations', spec: SMS_MITIGATIONS_SPEC, rows: records.sms.mitigations },
    { moduleKey: 'sms', sheetName: 'Audits', spec: SMS_AUDITS_SPEC, rows: records.sms.audits },
    { moduleKey: 'sms', sheetName: 'MoC', spec: SMS_MOC_SPEC, rows: records.sms.mocs },
    { moduleKey: 'sms', sheetName: 'Safety Reports', spec: SMS_SAFETY_REPORTS_SPEC, rows: records.sms.safetyReports },
    { moduleKey: 'aep', sheetName: 'Plans', spec: AEP_PLANS_SPEC, rows: records.aep.plans },
    { moduleKey: 'aep', sheetName: 'Response Agencies', spec: AEP_AGENCIES_SPEC, rows: records.aep.agencies },
    { moduleKey: 'aep', sheetName: 'Drills', spec: AEP_DRILLS_SPEC, rows: records.aep.drills },
    { moduleKey: 'aep', sheetName: 'Comms Checks', spec: AEP_COMMS_CHECKS_SPEC, rows: records.aep.commsChecks },
  ]
}

export interface ExcelBuildResult {
  /** One workbook per module: spreadsheets/<folder>.xlsx. */
  perModule: Record<string, ExportFile[]>
  /** Combined workbook with every sheet, or null if no rows anywhere. */
  master: ExportFile | null
}

/**
 * Build per-module + master workbooks for the selected tabular modules. Empty
 * sheets (no rows in the period) are skipped; a module with no non-empty sheets
 * produces no workbook (its gap is recorded by the PDF side / cover).
 */
export async function buildExcelFiles(
  records: ModuleRecords,
  opts: { selectedKeys: string[]; period: ExportPeriod },
): Promise<ExcelBuildResult> {
  const sel = new Set(opts.selectedKeys)
  const jobs = jobsFor(records).filter((j) => sel.has(j.moduleKey))

  // Group jobs by module so multi-kind modules (SMS/AEP) get one workbook.
  const byModule = new Map<string, SheetJob[]>()
  for (const j of jobs) byModule.set(j.moduleKey, [...(byModule.get(j.moduleKey) ?? []), j])

  const master = await createStyledWorkbook()
  const masterNames = new Set<string>()
  let masterSheets = 0

  const perModule: Record<string, ExportFile[]> = {}

  for (const [key, modJobs] of Array.from(byModule.entries())) {
    const wb = await createStyledWorkbook()
    const names = new Set<string>()
    let sheets = 0
    const multi = modJobs.length > 1

    for (const j of modJobs) {
      const { columns, data } = rowsToSheet(j.rows, j.spec.getDate, opts.period)
      if (data.length === 0) continue
      addStyledSheet(wb, uniqueName(sanitizeSheetName(j.sheetName), names), columns, data)
      sheets++
      const masterLabel = multi ? `${SHORT[key] ?? key}-${j.sheetName}` : j.sheetName
      addStyledSheet(master, uniqueName(sanitizeSheetName(masterLabel), masterNames), columns, data)
      masterSheets++
    }

    if (sheets > 0) {
      const buf = await wb.xlsx.writeBuffer()
      perModule[key] = [{ path: `spreadsheets/${folderOf(key)}.xlsx`, bytes: new Uint8Array(buf as ArrayBuffer) }]
    }
  }

  let masterFile: ExportFile | null = null
  if (masterSheets > 0) {
    const buf = await master.xlsx.writeBuffer()
    masterFile = { path: 'spreadsheets/00-Master-Workbook.xlsx', bytes: new Uint8Array(buf as ArrayBuffer) }
  }

  return { perModule, master: masterFile }
}
