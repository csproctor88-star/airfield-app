// lib/flip-pdf.ts
import autoTable from 'jspdf-autotable'
import {
  createPdf,
  drawBaseHeader,
  drawReportTitle,
  drawStatBox,
  drawFooter,
  tableStyles,
  BLOCK_POST_SPACING_MM,
} from '@/lib/pdf-utils'
import type { FlipReview, FlipReviewItem, FlipSignoff } from '@/lib/supabase/flip'

export function generateFlipReviewPdf(input: {
  review: FlipReview
  items: FlipReviewItem[]
  signoff: FlipSignoff | null
  baseName?: string
  baseIcao?: string
}): { doc: import('jspdf').jsPDF; filename: string } {
  const { review, items, signoff } = input
  const ctx = createPdf()
  let y = 15
  y = drawBaseHeader(ctx, y, { baseName: input.baseName, baseIcao: input.baseIcao })
  y = drawReportTitle(ctx, y, {
    title: 'FLIP MANAGEMENT REVIEW',
    subtitle: 'DAFMAN 13-204V2 §2.5.2.18.2.2.1',
  })
  y = drawStatBox(ctx, y, [
    { label: 'FLIP Cycle', value: review.cycle },
    { label: 'Review Date', value: review.review_date },
    { label: 'FLIPs Reviewed', value: String(items.length) },
    { label: 'Discrepancies', value: String(items.filter((i) => i.discrepancy).length) },
  ])
  y += BLOCK_POST_SPACING_MM

  autoTable(ctx.doc, {
    startY: y,
    head: [['FLIP Title', 'Effective', 'Disc.', 'Discrepancy', 'Corrective Action', 'Date Corrected']],
    body: items.map((it) => [
      it.flip_title,
      it.effective_date ?? '—',
      it.discrepancy ? 'Yes' : 'No',
      it.discrepancy_note ?? '—',
      it.corrective_action ?? '—',
      it.date_corrected ?? '—',
    ]),
    ...tableStyles(ctx),
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sy = ((ctx.doc as any).lastAutoTable?.finalY ?? y) + 10
  ctx.doc.setFontSize(10)
  ctx.doc.setTextColor(0)
  ctx.doc.text('Sign-Off (Custodian → NAMO → AFM)', ctx.margin, sy)
  sy += 6
  const sig = (label: string, at: string | null) => {
    ctx.doc.setFontSize(9)
    ctx.doc.text(
      `${label}: ${at ? `Signed ${at.slice(0, 16).replace('T', ' ')}Z` : '________________'}`,
      ctx.margin,
      sy,
    )
    sy += 6
  }
  sig('FLIP Custodian', signoff?.custodian_signed_at ?? null)
  sig('NAMO', signoff?.namo_signed_at ?? null)
  sig('AFM (Final Approval)', signoff?.afm_signed_at ?? null)

  drawFooter(ctx)
  return { doc: ctx.doc, filename: `flip-review-${review.review_date}.pdf` }
}
