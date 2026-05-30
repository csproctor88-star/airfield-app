// Records Export — Excel layer (Phase 3).
//
// Reuses each module's TableModuleSpec (columns + toRow) to emit one workbook
// per tabular module plus a master workbook with one sheet per module/kind.
// Driven entirely by the same specs the PDF table modules use, so the two
// exports never drift. Per-record / matrix modules (Waivers, ACSI, Training,
// PPR, SCN, Events Log) are PDF-only — Excel covers the tabular record series.
import { createStyledWorkbook, addStyledSheet, type ColumnDef } from '@/lib/excel-export'
import { isInRange, type ExportPeriod } from './export-period'
import { EXPORT_MODULES } from './export-modules'
import type { TableModuleSpec } from './export-pdf'
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

/** Excel sheet names: ≤31 chars, no \ / ? * [ ] : */
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function specToSheet(spec: TableModuleSpec<any>, rows: any[], period: ExportPeriod): { columns: ColumnDef[]; data: Record<string, string>[] } {
  const columns: ColumnDef[] = spec.columns.map((h, i) => ({
    header: h,
    key: `c${i}`,
    width: Math.min(45, Math.max(12, h.length + 6)),
  }))
  const filtered = rows.filter((r) => isInRange(spec.getDate(r), period))
  const data = filtered.map((r) => {
    const cells = spec.toRow(r)
    const obj: Record<string, string> = {}
    cells.forEach((c, i) => { obj[`c${i}`] = c })
    return obj
  })
  return { columns, data }
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
      const { columns, data } = specToSheet(j.spec, j.rows, opts.period)
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
