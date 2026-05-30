// Records Export — Inspection report forms.
//
// Inspections export as the actual report form (one per inspection: header +
// full checklist results grouped by category), all concatenated into a single
// Inspections.pdf — not a one-line-per-inspection roster. This is the record an
// auditor expects. Photos are deferred to the dedicated photo phase.
//
// Item/status conventions mirror the in-app generator (lib/pdf-export.ts):
//   text  = item.text || item.item || item.question || item.id
//   cat   = item.category_label || item.category || 'General'
//   status= 'sat' | 'unsat' | 'na'  ->  SAT / UNSAT / N/A
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

/** Minimal item shape we render (a subset of InspectionItem). */
export interface InspectionItemLike {
  category?: string
  category_label?: string
  text?: string
  item?: string
  question?: string
  id?: string
  status?: string
  notes?: string
  na_reason?: string
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

const RESULT_LABEL: Record<string, string> = { sat: 'SAT', unsat: 'UNSAT', na: 'N/A' }

function resultLabel(status: string | undefined): string {
  const s = (status || '').toLowerCase()
  return RESULT_LABEL[s] ?? (status ? status.toUpperCase() : '—')
}

function itemText(it: InspectionItemLike): string {
  return it.text || it.item || it.question || it.id || ''
}

function itemCategory(it: InspectionItemLike): string {
  return it.category_label || it.category || 'General'
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

    // Build a category-grouped body: a banner row per category, then its items.
    type BodyRow = { kind: 'cat'; text: string } | { kind: 'item'; cells: string[] }
    const ordered: BodyRow[] = []
    let lastCat = ''
    for (const it of items) {
      const cat = itemCategory(it)
      if (cat !== lastCat) {
        lastCat = cat
        ordered.push({ kind: 'cat', text: humanize(cat) })
      }
      const note = it.notes || ((it.status || '').toLowerCase() === 'na' ? it.na_reason : '') || ''
      ordered.push({
        kind: 'item',
        cells: [sanitizePdfText(itemText(it)), resultLabel(it.status), sanitizePdfText(note)],
      })
    }

    autoTable(doc, {
      ...tableStyles(ctx),
      startY: y,
      head: [['Item', 'Result', 'Notes']],
      body: ordered.map((r) =>
        r.kind === 'cat'
          ? [{ content: r.text, colSpan: 3, styles: { fontStyle: 'bold' as const, fillColor: [241, 245, 249] as [number, number, number], textColor: 20 } }]
          : r.cells,
      ),
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
