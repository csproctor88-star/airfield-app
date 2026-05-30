// Records Export — PDF orchestration for table modules.
// Pure given the fetched records: filter by period, then render either one
// aggregate PDF or one PDF per month bucket via the generic table generator.
import { EXPORT_MODULES, type ExportModule } from './export-modules'
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
}

/** Human label for the aggregate PDF subtitle. */
export function periodSubtitle(period: ExportPeriod): string {
  if (period.kind === 'all_time') return 'All time'
  return `${period.from ?? '…'} → ${period.to ?? '…'}`
}

/**
 * Build the PDF ExportFile(s) for one table module. Returns [] when no records
 * fall in the period (the caller records the gap on the cover sheet).
 */
export function buildTableModuleFiles<T>(
  records: T[],
  spec: TableModuleSpec<T>,
  ctx: PdfBuildContext,
): ExportFile[] {
  const filtered = records.filter((r) => isInRange(spec.getDate(r), ctx.period))
  if (filtered.length === 0) return []
  const folder = spec.module.folder

  if (ctx.outputMode === 'monthly') {
    const out: ExportFile[] = []
    for (const [month, monthRows] of groupByMonth(filtered, spec.getDate)) {
      const doc = generateRecordsTablePdf({
        title: spec.module.label,
        subtitle: month,
        baseName: ctx.baseName,
        baseIcao: ctx.baseIcao,
        columns: spec.columns,
        rows: monthRows.map(spec.toRow),
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
  })
  return [pdfToExportFile(doc, `documents/${folder}.pdf`)]
}

// ── Discrepancies spec ───────────────────────────────────────
// Minimal row shape (subset of DiscrepancyRow) the spec actually reads.
interface DiscrepancyLike {
  display_id: string
  status: string
  type: string
  title: string
  location_text: string
  assigned_shop: string | null
  work_order_number: string | null
  created_at: string
  reporter?: { name: string | null; rank: string | null } | null
}

function reporterLabel(r: DiscrepancyLike['reporter']): string {
  if (!r || !r.name) return '—'
  return r.rank ? `${r.rank} ${r.name}` : r.name
}

const discrepanciesModule = EXPORT_MODULES.find((m) => m.key === 'discrepancies')!

export const DISCREPANCIES_SPEC: TableModuleSpec<DiscrepancyLike> = {
  module: discrepanciesModule,
  columns: ['ID', 'Date', 'Status', 'Type', 'Title', 'Location', 'Shop', 'WO #', 'Reported By'],
  getDate: (r) => r.created_at,
  toRow: (r) => [
    r.display_id,
    r.created_at.slice(0, 10),
    r.status,
    r.type,
    r.title,
    r.location_text,
    r.assigned_shop ?? '—',
    r.work_order_number ?? '—',
    reporterLabel(r.reporter),
  ],
}
