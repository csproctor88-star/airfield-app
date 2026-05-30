// Records Export — Inspection report forms.
//
// Inspections export as the actual report form (one per inspection: header +
// full checklist results grouped by category), all concatenated into a single
// Inspections.pdf — not a one-line-per-inspection roster. This is the record an
// auditor expects. Photos are deferred to the dedicated photo phase.
//
// Item conventions mirror the in-app generator (lib/pdf-export.ts) and the live
// InspectionItem shape ({ section, item, response: 'pass'|'fail'|'na', notes }):
//   text    = item.item
//   section = item.section || 'Uncategorized'
//   response= 'pass' | 'fail' | 'na'  ->  PASS (green) / FAIL (red) / N/A (gray)
import autoTable from 'jspdf-autotable'
import type { jsPDF } from 'jspdf'
import {
  createPdf,
  drawBaseHeader,
  drawReportTitle,
  drawStatBox,
  drawFooter,
  tableStyles,
} from '@/lib/pdf-utils'
import { sanitizePdfText } from '@/lib/pdf-config'
import { humanize } from './export-format'
import { EXPORT_MODULES } from './export-modules'
import { isInRange, groupByMonth } from './export-period'
import { pdfToExportFile, type ExportFile } from './export-file'
import type { PdfBuildContext } from './export-pdf'

/** Item shape we render — the live InspectionItem (a few legacy aliases kept as
 *  fallbacks so older/variant rows still render text + result). */
export interface InspectionItemLike {
  section?: string
  item?: string
  response?: 'pass' | 'fail' | 'na' | string | null
  notes?: string | null
  // legacy/variant aliases (fallback only)
  category?: string
  text?: string
  status?: string
}

/** Minimal inspection shape we render (a subset of InspectionRow). */
export interface InspectionReportLike {
  display_id: string
  inspection_type: string
  inspection_date: string
  inspector_name: string | null
  status: string
  completion_percent: number
  items: InspectionItemLike[]
  notes: string | null
  created_at: string
}

type Rgb = [number, number, number]
const RESULT_GREEN: Rgb = [0, 130, 0]
const RESULT_RED: Rgb = [200, 0, 0]
const RESULT_GRAY: Rgb = [120, 120, 120]

/** Map a response value to its label + text color, matching lib/pdf-export.ts. */
export function resultInfo(it: InspectionItemLike): { label: string; color: Rgb } {
  const r = (it.response ?? it.status ?? '').toString().toLowerCase()
  if (r === 'pass' || r === 'sat') return { label: 'PASS', color: RESULT_GREEN }
  if (r === 'fail' || r === 'unsat') return { label: 'FAIL', color: RESULT_RED }
  if (r === 'na') return { label: 'N/A', color: RESULT_GRAY }
  return { label: '—', color: RESULT_GRAY }
}

function itemText(it: InspectionItemLike): string {
  return it.item || it.text || ''
}

function itemSection(it: InspectionItemLike): string {
  return it.section || it.category || 'Uncategorized'
}

/**
 * Generate one consolidated PDF containing every inspection's report form,
 * one inspection per page. Returns null if there are no inspections.
 */
export function generateInspectionReportsPdf(
  inspections: InspectionReportLike[],
  opts: { baseName?: string | null; baseIcao?: string | null },
): jsPDF | null {
  if (inspections.length === 0) return null
  const ctx = createPdf({ orientation: 'portrait' })
  const { doc } = ctx

  inspections.forEach((insp, i) => {
    if (i > 0) doc.addPage()
    let y = ctx.margin
    y = drawBaseHeader(ctx, y, { baseName: opts.baseName, baseIcao: opts.baseIcao })
    y = drawReportTitle(ctx, y, {
      title: `INSPECTION ${insp.display_id}`,
      subtitle: `${humanize(insp.inspection_type)} · ${insp.inspection_date?.slice(0, 10) || '—'}`,
    })
    y = drawStatBox(ctx, y, [
      { label: 'Inspector', value: insp.inspector_name || '—' },
      { label: 'Status', value: humanize(insp.status) },
      { label: 'Complete', value: `${insp.completion_percent}%` },
      { label: 'Logged', value: insp.created_at?.slice(0, 10) || '—' },
    ])

    const items = insp.items || []
    if (items.length === 0) {
      doc.setFontSize(10)
      doc.setTextColor(120)
      doc.text('No checklist items recorded for this inspection.', ctx.margin, y)
      if (insp.notes) {
        doc.setTextColor(60)
        doc.text(sanitizePdfText(`Notes: ${insp.notes}`), ctx.margin, y + 6)
      }
      return
    }

    // Build a section-grouped body: a banner row per section, then its items.
    // The Result cell carries its own colored text (green PASS / red FAIL /
    // gray N/A) via a per-cell style, matching the in-app inspection report.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type Cell = any
    const body: Cell[][] = []
    let lastSection = ''
    for (const it of items) {
      const section = itemSection(it)
      if (section !== lastSection) {
        lastSection = section
        body.push([{ content: humanize(section), colSpan: 3, styles: { fontStyle: 'bold' as const, fillColor: [241, 245, 249] as Rgb, textColor: 20 } }])
      }
      const { label, color } = resultInfo(it)
      body.push([
        sanitizePdfText(itemText(it)),
        { content: label, styles: { textColor: color, fontStyle: 'bold' as const, halign: 'center' as const } },
        sanitizePdfText(it.notes || ''),
      ])
    }

    autoTable(doc, {
      ...tableStyles(ctx),
      startY: y,
      head: [['Item', 'Result', 'Notes']],
      body,
      columnStyles: {
        0: { cellWidth: 110 },
        1: { cellWidth: 22, halign: 'center' },
      },
      didDrawPage: () => drawFooter(ctx),
    })

    if (insp.notes) {
      // @ts-expect-error autotable augments doc at runtime
      const afterY = (doc.lastAutoTable?.finalY ?? y) + 6
      doc.setFontSize(9)
      doc.setTextColor(60)
      doc.text(sanitizePdfText(`Inspection notes: ${insp.notes}`), ctx.margin, afterY)
    }
  })

  return doc
}

/**
 * Build the Inspections export file(s): period-filter on created_at (matching
 * the registry dateColumn), then render the consolidated report PDF. Monthly
 * mode emits one consolidated PDF per month. Returns [] when nothing falls in
 * the period; never throws past its own boundary (module-level isolation,
 * matching buildTableModuleFiles).
 */
export function buildInspectionFiles(
  inspections: InspectionReportLike[],
  ctx: PdfBuildContext,
): ExportFile[] {
  try {
    const folder = EXPORT_MODULES.find((m) => m.key === 'inspections')?.folder ?? 'Inspections'
    const filtered = inspections.filter((i) => isInRange(i.created_at, ctx.period))
    if (filtered.length === 0) return []
    const opts = { baseName: ctx.baseName, baseIcao: ctx.baseIcao }

    if (ctx.outputMode === 'monthly') {
      const out: ExportFile[] = []
      for (const [month, monthRows] of Array.from(groupByMonth(filtered, (i) => i.created_at).entries())) {
        const doc = generateInspectionReportsPdf(monthRows, opts)
        if (doc) out.push(pdfToExportFile(doc, `documents/${folder}/${month}.pdf`))
      }
      return out
    }

    const doc = generateInspectionReportsPdf(filtered, opts)
    return doc ? [pdfToExportFile(doc, `documents/${folder}.pdf`)] : []
  } catch (err) {
    console.error('Records Export: module "inspections" failed to render and was skipped.', err)
    return []
  }
}
