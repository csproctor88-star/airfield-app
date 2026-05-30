// Records Export — PDF orchestration for table modules.
// Pure given the fetched records: filter by period, then render either one
// aggregate PDF or one PDF per month bucket via the generic table generator.
import { type ExportModule } from './export-modules'
import { isInRange, groupByMonth, type ExportPeriod } from './export-period'
import { generateRecordsTablePdf } from './export-records-table-pdf'
import { pdfToExportFile, type ExportFile } from './export-file'

export type OutputMode = 'aggregate' | 'monthly'

export interface PdfBuildContext {
  period: ExportPeriod
  outputMode: OutputMode
  baseName?: string | null
  baseIcao?: string | null
}

/** How to turn a module's rows into a PDF table. */
export interface TableModuleSpec<T> {
  module: ExportModule
  columns: string[]
  getDate: (row: T) => string | null | undefined
  toRow: (row: T) => string[]
  /** Page orientation for this module's table; defaults to landscape. */
  orientation?: 'portrait' | 'landscape'
}

/** Human label for the aggregate PDF subtitle. */
export function periodSubtitle(period: ExportPeriod): string {
  if (period.kind === 'all_time') return 'All time'
  return `${period.from ?? '…'} → ${period.to ?? '…'}`
}

/**
 * Build the PDF ExportFile(s) for one table module. Returns [] when no records
 * fall in the period (the caller records the gap on the cover sheet).
 *
 * Module-level error boundary: if a module's `getDate`/`toRow` throws (e.g. a
 * malformed row in a later module's spec), this logs and returns [] so one bad
 * module can't abort a multi-module export. The Phase 4 packager still records
 * skipped/empty modules as gaps on the cover sheet.
 */
export function buildTableModuleFiles<T>(
  records: T[],
  spec: TableModuleSpec<T>,
  ctx: PdfBuildContext,
): ExportFile[] {
  try {
    return buildTableModuleFilesUnsafe(records, spec, ctx)
  } catch (err) {
    console.error(
      `Records Export: module "${spec.module.key}" failed to render and was skipped.`,
      err,
    )
    return []
  }
}

function buildTableModuleFilesUnsafe<T>(
  records: T[],
  spec: TableModuleSpec<T>,
  ctx: PdfBuildContext,
): ExportFile[] {
  const filtered = records.filter((r) => isInRange(spec.getDate(r), ctx.period))
  if (filtered.length === 0) return []
  const folder = spec.module.folder

  if (ctx.outputMode === 'monthly') {
    const out: ExportFile[] = []
    const monthMap = groupByMonth(filtered, spec.getDate)
    for (const [month, monthRows] of Array.from(monthMap.entries())) {
      const doc = generateRecordsTablePdf({
        title: spec.module.label,
        subtitle: month,
        baseName: ctx.baseName,
        baseIcao: ctx.baseIcao,
        columns: spec.columns,
        rows: monthRows.map(spec.toRow),
        orientation: spec.orientation,
      })
      out.push(pdfToExportFile(doc, `documents/${folder}/${month}.pdf`))
    }
    return out
  }

  const doc = generateRecordsTablePdf({
    title: spec.module.label,
    subtitle: periodSubtitle(ctx.period),
    baseName: ctx.baseName,
    baseIcao: ctx.baseIcao,
    columns: spec.columns,
    rows: filtered.map(spec.toRow),
    orientation: spec.orientation,
  })
  return [pdfToExportFile(doc, `documents/${folder}.pdf`)]
}
