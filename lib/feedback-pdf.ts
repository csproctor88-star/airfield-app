import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatZuluDateTime } from '@/lib/utils'
import { sanitizePdfText } from '@/lib/pdf-config'
import {
  createPdf,
  drawBaseHeader,
  drawReportTitle,
  drawStatBox,
  drawFooter,
  tableStyles,
  todayIso,
} from '@/lib/pdf-utils'
import type { CustomerFeedback } from '@/lib/supabase/feedback'

interface FeedbackPdfInput {
  feedback: CustomerFeedback[]
  stats: {
    total: number
    avgRating: number | null
    ratingCounts: Record<number, number>
    recentCount: number
  }
  windowLabel: string
  baseName?: string | null
  baseIcao?: string | null
  fieldLabelMap?: Record<string, string>
}

export async function generateFeedbackPdf(input: FeedbackPdfInput): Promise<{ doc: jsPDF; filename: string }> {
  const { feedback, stats, windowLabel, baseName, baseIcao, fieldLabelMap = {} } = input
  const ctx = createPdf({ orientation: 'portrait' })
  const { doc, margin, contentWidth } = ctx
  let y = ctx.margin

  y = drawBaseHeader(ctx, y, { baseName, baseIcao })
  y = drawReportTitle(ctx, y, {
    title: 'CUSTOMER FEEDBACK REPORT',
    subtitle: `Window: ${windowLabel}`,
  })
  y = drawStatBox(ctx, y, [
    { label: 'Submissions', value: String(stats.recentCount) },
    { label: 'Average Rating', value: stats.avgRating != null ? `${stats.avgRating.toFixed(1)} / 5` : 'N/A' },
    { label: 'Generated', value: formatZuluDateTime(new Date()) },
  ])

  // ── Rating distribution ──
  if (stats.avgRating != null && Object.keys(stats.ratingCounts).length > 0) {
    doc.setFontSize(10)
    doc.setTextColor(60)
    doc.text('Rating distribution', margin, y)
    y += 5

    const totalRated = Object.values(stats.ratingCounts).reduce((sum, c) => sum + c, 0)
    const barX = margin + 18
    const barMaxWidth = contentWidth - 40
    const barHeight = 4

    for (const star of [5, 4, 3, 2, 1]) {
      const count = stats.ratingCounts[star] || 0
      const pct = totalRated > 0 ? count / totalRated : 0

      doc.setFontSize(8)
      doc.setTextColor(120)
      doc.text(`${star} star`, margin, y + 3)

      doc.setDrawColor(220)
      doc.setFillColor(235, 235, 235)
      doc.rect(barX, y, barMaxWidth, barHeight, 'FD')

      if (pct > 0) {
        doc.setFillColor(251, 191, 36)
        doc.rect(barX, y, barMaxWidth * pct, barHeight, 'F')
      }

      doc.setTextColor(80)
      doc.text(String(count), barX + barMaxWidth + 4, y + 3)
      y += 6
    }
    y += 4
  }

  // ── Entries table ──
  if (feedback.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text('No feedback in the selected window.', margin, y)
  } else {
    doc.setFontSize(10)
    doc.setTextColor(60)
    doc.text(`Individual entries (${feedback.length})`, margin, y)
    y += 4

    autoTable(doc, {
      ...tableStyles(ctx),
      startY: y,
      head: [['Submitted', 'Name', 'Org', 'Rating', 'Comments']],
      body: feedback.map(fb => {
        const responseSummary = Object.entries(fb.responses || {})
          .map(([k, v]) => `${fieldLabelMap[k] || k}: ${String(v)}`)
          .join(' · ')
        const comments = [fb.comments, responseSummary].filter(Boolean).join('\n')
        return [
          formatZuluDateTime(fb.submitted_at),
          sanitizePdfText(fb.name || ''),
          sanitizePdfText(fb.organization || ''),
          fb.overall_rating != null ? `${fb.overall_rating}/5` : '',
          sanitizePdfText(comments),
        ]
      }),
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 28 },
        2: { cellWidth: 28 },
        3: { cellWidth: 14, halign: 'center' },
      },
      didDrawPage: () => drawFooter(ctx),
    })
  }

  return { doc, filename: `customer-feedback-${todayIso()}.pdf` }
}
