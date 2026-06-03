import autoTable from 'jspdf-autotable'
import {
  createPdf, drawBaseHeader, drawReportTitle, drawStatBox, drawFooter,
  tableStyles, todayIso, type PdfContext,
} from '@/lib/pdf-utils'
import type { AmtrMember } from '@/lib/supabase/amtr'
import type { AmtrInspection, InspectionItemResponse } from '@/lib/supabase/amtr-inspections'
import type { AmtrBaseInfo } from '@/lib/amtr-pdf'

type ChecklistRow = { kind: 'section' | 'item'; item_number: string; label: string }

const STATUS_LABEL: Record<string, string> = { yes: 'YES', no: 'NO', na: 'N/A' }

/** Printable training-record inspection: summary counts + per-section item table. */
export function generateAmtrInspectionPdf(
  inspection: AmtrInspection,
  member: AmtrMember,
  checklist: ChecklistRow[],
  base: AmtrBaseInfo = {},
): { doc: ReturnType<typeof createPdf>['doc']; filename: string } {
  const ctx: PdfContext = createPdf({ orientation: 'portrait' })
  const { doc } = ctx

  let y = drawBaseHeader(ctx, 18, {
    baseName: base.baseName, baseIcao: base.baseIcao,
    sectionLabel: 'AIRFIELD MANAGEMENT — TRAINING RECORD INSPECTION',
  })
  // Rank + name on the title line; DAFSC / Status / Date labeled on the subtitle.
  // (drawReportTitle sanitizes em dashes to "--", so the title avoids them.)
  const idFields: string[] = []
  if (member.dafsc) idFields.push(`DAFSC: ${member.dafsc}`)
  if (member.status) idFields.push(`Status: ${member.status}`)
  idFields.push(`Date: ${inspection.inspection_date}`)
  y = drawReportTitle(ctx, y, {
    title: `Record Inspection: ${[member.grade, member.full_name].filter(Boolean).join(' ')}`,
    subtitle: idFields.join('  ·  '),
  })
  y = drawStatBox(ctx, y, [
    { label: 'Yes', value: String(inspection.yes_count) },
    { label: 'No (gaps)', value: String(inspection.gap_count) },
    { label: 'N/A', value: String(inspection.na_count) },
    { label: 'Status', value: inspection.status === 'completed' ? 'Completed' : 'Draft' },
  ])

  const byNum = new Map<string, InspectionItemResponse>(inspection.items.map((it) => [it.item_number, it]))

  // Body rows interleave section headers with their items.
  const rows: { isSection: boolean; cells: string[]; gap: boolean }[] = []
  for (const r of checklist) {
    if (r.kind === 'section') {
      rows.push({ isSection: true, cells: [`${r.item_number}. ${r.label}`, '', ''], gap: false })
    } else {
      const it = byNum.get(r.item_number)
      const note = it?.note ? it.note : (it?.findings?.length ? it.findings.join('; ') : '')
      rows.push({
        isSection: false,
        cells: [`${r.item_number}  ${r.label}`, it?.status ? STATUS_LABEL[it.status] : '—', note],
        gap: it?.status === 'no',
      })
    }
  }

  autoTable(doc, {
    ...tableStyles(ctx),
    startY: y,
    head: [['Item', 'Y/N/NA', 'Findings / Notes']],
    body: rows.map((r) => r.cells),
    columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 18, halign: 'center' }, 2: { cellWidth: 'auto' } },
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const r = rows[data.row.index]
      if (!r) return
      if (r.isSection) { data.cell.styles.fillColor = [226, 232, 240]; data.cell.styles.fontStyle = 'bold' }
      else if (r.gap) data.cell.styles.fillColor = [254, 226, 226]
    },
    didDrawPage: () => drawFooter(ctx),
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  if (inspection.notes) {
    doc.setFontSize(9); doc.setTextColor(0)
    doc.text('Inspector Notes:', ctx.margin, y); y += 5
    doc.setTextColor(60)
    for (const line of doc.splitTextToSize(inspection.notes, ctx.contentWidth)) { doc.text(line, ctx.margin, y); y += 5 }
  }
  if (inspection.status === 'completed' && inspection.completed_by_name) {
    doc.setFontSize(9); doc.setTextColor(60)
    doc.text(`Completed by ${inspection.completed_by_name} on ${(inspection.completed_at ?? '').slice(0, 10)}`, ctx.margin, y + 4)
  }
  drawFooter(ctx)

  return { doc, filename: `AMTR_Inspection_${member.full_name.replace(/[^a-z0-9]+/gi, '_')}_${inspection.inspection_date}.pdf` }
}
