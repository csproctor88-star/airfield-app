import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  createPdf, drawBaseHeader, drawReportTitle, drawStatBox, drawFooter, tableStyles,
} from '@/lib/pdf-utils'
import { formatZuluDate, formatZuluDateTime } from '@/lib/utils'
import { sanitizePdfText } from '@/lib/pdf-config'
import { partitionCompliance } from '@/lib/local-regs/review-status'
import type {
  LocalRegulationRow, LocalRegReviewRow, LocalRegReviewer,
} from '@/lib/supabase/local-regulations'

// Local Regulations (Base Regs) compliance report — clone of
// lib/read-file-review-pdf.ts's per-document roster table, crossed with
// partitionCompliance (the same reviewed/outstanding split the Base Regs tab's
// Compliance panel renders on screen, so the PDF and the on-screen chips never
// disagree). Every string — including headings and dash/"(unknown)" fallbacks —
// routes through sanitizePdfText; prior generators (driving-check-pdf.ts,
// fpr-pdf.ts) caught missed-sanitization bugs on exactly those spots.

const s = sanitizePdfText

export interface LocalRegsReviewPdfInput {
  baseName?: string | null
  baseIcao?: string | null
  /** Active (non-archived) regulations — caller filters, same convention as
   *  ReadFileReviewPdfInput.files. */
  regs: LocalRegulationRow[]
  /** Required-reviewer roster — the compliance "Y" denominator. */
  reviewers: LocalRegReviewer[]
  /** All reviews at the base (every reg, every version, every user) — reduced
   *  per-reg by partitionCompliance. */
  reviews: LocalRegReviewRow[]
  /** ISO timestamp for the subtitle + filename date (Date.now is fine to pass from the caller). */
  generatedAtIso: string
}

function intervalLabel(interval: LocalRegulationRow['review_interval']): string {
  return interval === 'monthly' ? 'Monthly' : 'Quarterly'
}

function reviewerLabel(u: LocalRegReviewer): string {
  const parts = (u.name || '').trim().split(/\s+/).filter(Boolean)
  const last = parts.length > 0 ? parts[parts.length - 1] : (u.name || '(unknown)')
  const base = u.rank ? `${u.rank} ${last}` : last
  return u.operating_initials ? `${base} (${u.operating_initials})` : base
}

export async function generateLocalRegsReviewPdf(
  input: LocalRegsReviewPdfInput,
): Promise<{ doc: jsPDF; filename: string }> {
  const { baseName, baseIcao, regs, reviewers, reviews, generatedAtIso } = input
  const ctx = createPdf({ orientation: 'portrait', format: 'letter' })
  const doc = ctx.doc

  let y = drawBaseHeader(ctx, 15, { baseName, baseIcao })
  y = drawReportTitle(ctx, y, {
    title: 'Local Regulations Review Report',
    subtitle: `Generated ${formatZuluDateTime(generatedAtIso)}`,
  })

  // Summary: active regulations, required reviewers, # with no outstanding
  // reviewer this cycle (the same "fully current" gate the Base Regs tab's
  // ComplianceChip uses per document, rolled up here across all documents).
  const fullyCurrent = regs.filter(reg => {
    const reviewsForReg = reviews.filter(rv => rv.regulation_id === reg.id)
    const { outstanding } = partitionCompliance(reg, reviewers, reviewsForReg)
    return outstanding.length === 0
  }).length
  y = drawStatBox(ctx, y, [
    { label: 'Active regulations', value: String(regs.length) },
    { label: 'Required reviewers', value: String(reviewers.length) },
    { label: 'Fully current', value: `${fullyCurrent}/${regs.length}` },
  ])

  if (regs.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text(s('No active local regulations at this base.'), ctx.margin, y + 4)
  }

  const reviewerById = new Map(reviewers.map(r => [r.user_id, r]))

  for (const reg of regs) {
    const reviewsForReg = reviews.filter(rv => rv.regulation_id === reg.id)
    const { reviewed, outstanding } = partitionCompliance(reg, reviewers, reviewsForReg)

    // Roster members whose current-cycle review the partition counted —
    // the same numerator the tab's ComplianceChip / "Reviewed X/Y" shows.
    // `reviewed` may also hold out-of-roster reviewers folded in
    // defensively; they render as extra rows below but never move this count.
    const reviewedRosterCount = reviewers.filter(r => reviewed.has(r.user_id)).length

    const rows: string[][] = []
    for (const [userId, info] of Array.from(reviewed.entries())) {
      const rv = reviewerById.get(userId)
      const name = rv ? reviewerLabel(rv) : 'Reviewer outside required roster'
      const dateLabel = formatZuluDate(info.reviewed_at)
      rows.push([s(name), s(`Reviewed (${info.initials ?? '—'} · ${dateLabel})`)])
    }
    for (const userId of outstanding) {
      const rv = reviewerById.get(userId)
      rows.push([s(rv ? reviewerLabel(rv) : '(unknown)'), s('OUTSTANDING')])
    }

    autoTable(doc, {
      ...tableStyles(ctx),
      startY: y + 6,
      head: [[
        s(`${reg.title}  (v${reg.version})`),
        s(`${intervalLabel(reg.review_interval)} · Updated ${formatZuluDate(reg.updated_at)}`),
      ]],
      body: rows,
      columnStyles: { 1: { cellWidth: 60 } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const raw = String(data.cell.raw ?? '')
          data.cell.styles.textColor = raw.startsWith('OUTSTANDING') ? [200, 0, 0] : [34, 139, 64]
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 4

    // Per-doc summary line — matches the tab's "Reviewed X/Y this cycle" chip.
    doc.setFontSize(8)
    doc.setTextColor(90)
    doc.text(s(`Reviewed ${reviewedRosterCount}/${reviewers.length} this cycle`), ctx.margin, y + 3)
    y += 9
  }

  drawFooter(ctx)
  const dateStamp = new Date(generatedAtIso).toISOString().slice(0, 10)
  const filename = `local-regs-review-${(baseIcao || 'base').toLowerCase()}-${dateStamp}.pdf`
  return { doc, filename }
}
