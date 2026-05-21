import autoTable from 'jspdf-autotable'
import {
  createPdf, drawBaseHeader, drawReportTitle, drawStatBox, drawFooter,
  tableStyles, todayIso, type PdfContext,
} from '@/lib/pdf-utils'
import type { AmtrMember } from '@/lib/supabase/amtr'
import type { MemberRollup, UnitKpis } from '@/lib/amtr/rollup'

// ─────────────────────────────────────────────────────────────
// AMTR PDF generators — house-style, client-side. Both return
// { doc, filename } like every other lib/*-pdf.ts generator.
// ─────────────────────────────────────────────────────────────

export type AmtrBaseInfo = { baseName?: string | null; baseIcao?: string | null }

/** Unit roster + JQS/Formal % + recurring status, one row per member. */
export function generateAmtrRosterPdf(
  rollups: MemberRollup[],
  kpis: UnitKpis,
  base: AmtrBaseInfo = {},
): { doc: ReturnType<typeof createPdf>['doc']; filename: string } {
  const ctx: PdfContext = createPdf({ orientation: 'landscape' })
  const { doc, margin } = ctx

  let y = drawBaseHeader(ctx, 18, {
    baseName: base.baseName, baseIcao: base.baseIcao,
    sectionLabel: 'AIRFIELD MANAGEMENT — TRAINING RECORDS',
  })
  y = drawReportTitle(ctx, y, { title: 'AMTR Unit Roster' })
  y = drawStatBox(ctx, y, [
    { label: 'Members', value: String(kpis.members) },
    { label: 'Required Tasks', value: String(kpis.requiredTasks) },
    { label: 'Complete', value: String(kpis.complete) },
    { label: 'Due Soon', value: String(kpis.dueSoon) },
    { label: 'Overdue', value: String(kpis.overdue) },
  ])

  autoTable(doc, {
    ...tableStyles(ctx),
    startY: y,
    head: [['Member', 'Grade', 'Status', 'JQS %', 'Formal %', 'Overdue', 'Due Soon', 'Updated']],
    body: rollups.map((r) => [
      r.name, r.grade ?? '', r.status,
      `${r.jqsPct}%`, `${r.formalPct}%`,
      String(r.overdueCount), String(r.dueSoonCount),
      r.lastUpdated ? r.lastUpdated.slice(0, 10) : '—',
    ]),
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const r = rollups[data.row.index]
      if (!r) return
      if (r.overdueCount > 0) data.cell.styles.fillColor = [254, 226, 226]
      else if (r.dueSoonCount > 0) data.cell.styles.fillColor = [254, 243, 199]
    },
    didDrawPage: () => drawFooter(ctx),
  })

  return { doc, filename: `AMTR_Roster_${todayIso()}.pdf` }
}

/** Single-member printable training summary. */
export function generateAmtrMemberPrintPdf(
  member: AmtrMember,
  rollup: MemberRollup,
  outstanding: { due: string; task: string; source: string; status: string }[],
  base: AmtrBaseInfo = {},
): { doc: ReturnType<typeof createPdf>['doc']; filename: string } {
  const ctx: PdfContext = createPdf({ orientation: 'portrait' })
  const { doc } = ctx

  let y = drawBaseHeader(ctx, 18, {
    baseName: base.baseName, baseIcao: base.baseIcao,
    sectionLabel: 'AIRFIELD MANAGEMENT — TRAINING RECORD',
  })
  y = drawReportTitle(ctx, y, {
    title: member.full_name,
    subtitle: [member.grade, member.dafsc, member.status].filter(Boolean).join(' · '),
  })
  y = drawStatBox(ctx, y, [
    { label: 'JQS-CFETP', value: `${rollup.jqsDone}/${rollup.jqsRequired} (${rollup.jqsPct}%)` },
    { label: 'Formal Training', value: `${rollup.formalDone}/${rollup.formalRequired} (${rollup.formalPct}%)` },
    { label: 'Overdue', value: String(rollup.overdueCount) },
    { label: 'Due Soon', value: String(rollup.dueSoonCount) },
  ])

  if (outstanding.length > 0) {
    autoTable(doc, {
      ...tableStyles(ctx),
      startY: y,
      head: [['Due', 'Task', 'Source', 'Status']],
      body: outstanding.map((o) => [o.due, o.task, o.source, o.status]),
      didDrawPage: () => drawFooter(ctx),
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
  } else {
    doc.setFontSize(10); doc.setTextColor(60)
    doc.text('Outstanding items: None — member is current.', ctx.margin, y + 4)
    y += 14
  }

  // Signature block
  doc.setFontSize(9); doc.setTextColor(0)
  const sigY = Math.min(y + 20, ctx.pageHeight - 30)
  const colW = ctx.contentWidth / 3
  ;['Trainer', 'Certifier', 'AFM'].forEach((label, i) => {
    const x = ctx.margin + i * colW
    doc.line(x, sigY, x + colW - 8, sigY)
    doc.text(`${label} signature / date`, x, sigY + 5)
  })
  drawFooter(ctx)

  return { doc, filename: `AMTR_${member.full_name.replace(/[^a-z0-9]+/gi, '_')}_${todayIso()}.pdf` }
}
