import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  createPdf, drawBaseHeader, drawReportTitle, drawStatBox, drawFooter, tableStyles,
} from '@/lib/pdf-utils'
import { formatZuluDateTime } from '@/lib/utils'
import type { QrcTemplate } from '@/lib/supabase/types'
import type { QrcMonthlyReviewWithUser, EligibleReviewer } from '@/lib/supabase/qrc-reviews'
import type { ReviewInterval } from '@/lib/qrc/monthly-review-status'

export interface QrcMonthlyReviewPdfInput {
  baseName?: string | null
  baseIcao?: string | null
  /** Per-base review interval. Drives title, subtitle, window, filename. */
  interval?: ReviewInterval
  /** Calendar month (1–12) — required when interval='monthly'. */
  month?: number
  /** Calendar quarter (1–4) — required when interval='quarterly'. */
  quarter?: 1 | 2 | 3 | 4
  year: number
  templates: QrcTemplate[]
  eligibleUsers: EligibleReviewer[]
  /**
   * Every review row at the base ≥ start of the report period. The generator
   * filters to the [periodStart, periodEnd) window itself so callers can hand
   * in a wider window without rework.
   */
  reviews: QrcMonthlyReviewWithUser[]
  /** Generator attribution — rank + name string. */
  generatedBy?: string | null
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const COLOR = {
  green: [34, 139, 64] as [number, number, number],
  amber: [217, 119, 6] as [number, number, number],
  red:   [200, 0, 0] as [number, number, number],
  text2: [60, 60, 60] as [number, number, number],
}

/** Operator column header — short form so it fits in a narrow matrix column. */
function operatorShortLabel(u: EligibleReviewer): string {
  // Prefer initials if set (most compact); otherwise rank + last-name.
  if (u.operating_initials) {
    return u.rank ? `${u.rank} ${u.operating_initials}` : u.operating_initials
  }
  const lastName = u.name.split(/\s+/).slice(-1)[0]
  return u.rank ? `${u.rank} ${lastName}` : lastName
}

export async function generateQrcMonthlyReviewPdf(
  input: QrcMonthlyReviewPdfInput,
): Promise<{ doc: jsPDF; filename: string }> {
  const { baseName, baseIcao, year, templates, eligibleUsers, reviews, generatedBy } = input
  const interval: ReviewInterval = input.interval ?? 'monthly'
  const month = interval === 'monthly' ? (input.month ?? 1) : 1
  const quarter = interval === 'quarterly' ? (input.quarter ?? 1) : 1

  // Landscape Letter so the matrix fits more operator columns. The cover
  // summary lives at the top of page 1; autoTable breaks the matrix
  // across pages naturally if rows overflow.
  const ctx = createPdf({ orientation: 'landscape', format: 'letter' })
  const { doc, margin } = ctx

  // ── Window the reviews to the requested calendar period ──
  const periodStartMonth = interval === 'quarterly' ? (quarter - 1) * 3 : month - 1
  const periodEndMonth = interval === 'quarterly' ? quarter * 3 : month
  const periodStart = new Date(Date.UTC(year, periodStartMonth, 1)).getTime()
  const periodEnd = new Date(Date.UTC(year, periodEndMonth, 1)).getTime()
  const reviewsInWindow = reviews.filter(r => {
    const t = new Date(r.reviewed_at).getTime()
    return t >= periodStart && t < periodEnd
  })

  // Latest review IN WINDOW per (user, template). Rows are already DESC by
  // reviewed_at from the fetch.
  const latestByUserTemplate = new Map<string, QrcMonthlyReviewWithUser>()
  for (const r of reviewsInWindow) {
    const k = `${r.user_id}|${r.template_id}`
    if (!latestByUserTemplate.has(k)) latestByUserTemplate.set(k, r)
  }

  const activeTemplates = templates
    .filter(t => t.is_active)
    .sort((a, b) => a.qrc_number - b.qrc_number)

  // ── Per-operator stats for the cover roll-up ──
  const stats = eligibleUsers.map(u => {
    let reviewedCount = 0
    for (const tmpl of activeTemplates) {
      if (latestByUserTemplate.has(`${u.user_id}|${tmpl.id}`)) reviewedCount++
    }
    const pendingCount = activeTemplates.length - reviewedCount
    const compliance = activeTemplates.length > 0
      ? Math.round((reviewedCount / activeTemplates.length) * 100)
      : 0
    return { user: u, reviewedCount, pendingCount, compliance }
  })

  const fullyCurrent = stats.filter(s => s.pendingCount === 0).length
  const qrcsWithGap = activeTemplates.filter(tmpl =>
    eligibleUsers.some(u => !latestByUserTemplate.has(`${u.user_id}|${tmpl.id}`)),
  ).length

  // ─────────────────────────────────────────────────────────
  // PAGE 1 — Cover summary + Operator Roll-Up
  // ─────────────────────────────────────────────────────────
  let y = margin
  y = drawBaseHeader(ctx, y, { baseName, baseIcao })
  const periodTitle = interval === 'quarterly' ? 'Quarterly' : 'Monthly'
  const periodSubtitle = interval === 'quarterly'
    ? `Compliance Report — Q${quarter} ${year}`
    : `Compliance Report — ${MONTH_NAMES[month - 1]} ${year}`
  y = drawReportTitle(ctx, y, {
    title: `AMOPS ${periodTitle} QRC Review`,
    subtitle: periodSubtitle,
  })

  y = drawStatBox(ctx, y, [
    { label: 'OPERATORS FULLY CURRENT', value: `${fullyCurrent} of ${eligibleUsers.length}` },
    { label: 'QRCs WITH GAPS', value: String(qrcsWithGap) },
    { label: 'ACTIVE TEMPLATES', value: String(activeTemplates.length) },
    { label: 'GENERATED', value: formatZuluDateTime(new Date()) },
  ])

  if (generatedBy) {
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text(`Generated by: ${generatedBy}`, margin, y)
    y += 6
  }

  doc.setFontSize(10)
  doc.setTextColor(0)
  doc.text('Operator Roll-Up', margin, y)
  y += 4

  autoTable(doc, {
    startY: y,
    head: [['Rank', 'Name', 'Initials', 'Role', 'Reviewed', 'Pending', 'Compliance']],
    body: stats.length === 0
      ? [['—', '(no AMOPS-eligible operators at this base)', '', '', '', '', '']]
      : stats.map(s => [
          s.user.rank ?? '',
          s.user.name,
          s.user.operating_initials ?? '',
          formatRole(s.user.role),
          String(s.reviewedCount),
          String(s.pendingCount),
          `${s.compliance}%`,
        ]),
    ...tableStyles(ctx),
    columnStyles: {
      0: { cellWidth: 18 },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 38 },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 22, halign: 'center' },
      6: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: data => {
      if (data.section === 'body' && data.column.index === 6 && stats[data.row.index]) {
        const c = stats[data.row.index].compliance
        if (c === 100) data.cell.styles.textColor = COLOR.green
        else if (c >= 70) data.cell.styles.textColor = COLOR.amber
        else data.cell.styles.textColor = COLOR.red
      }
    },
  })

  // ─────────────────────────────────────────────────────────
  // PAGE 2+ — QRC × Operator matrix
  // ─────────────────────────────────────────────────────────
  doc.addPage()
  y = margin
  y = drawBaseHeader(ctx, y, { baseName, baseIcao })

  doc.setFontSize(11)
  doc.setTextColor(0)
  doc.setFont('helvetica', 'bold')
  doc.text('Compliance Matrix', margin, y)
  doc.setFont('helvetica', 'normal')
  y += 4
  doc.setFontSize(8)
  doc.setTextColor(100)
  const periodLegend = interval === 'quarterly'
    ? `Q${quarter} ${year}`
    : `${MONTH_NAMES[month - 1]} ${year}`
  const periodNoun = interval === 'quarterly' ? 'quarter' : 'month'
  doc.text(
    `Y = reviewed during ${periodLegend}    ·    N = not reviewed during this ${periodNoun}`,
    margin, y,
  )
  y += 6

  if (eligibleUsers.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text('No AMOPS-eligible operators at this base.', margin, y + 6)
  } else {
    // Build matrix rows.
    const matrixHead = [
      ['#', 'Title', ...eligibleUsers.map(operatorShortLabel)],
    ]
    const matrixBody = activeTemplates.map(tmpl => {
      const row: (string | number)[] = [tmpl.qrc_number, tmpl.title]
      for (const u of eligibleUsers) {
        row.push(latestByUserTemplate.has(`${u.user_id}|${tmpl.id}`) ? 'Y' : 'N')
      }
      return row
    })

    // Per-operator column width — even split of the leftover after # + Title.
    // Letter landscape with 12mm margins → ~255mm content. # = 10mm, Title
    // = 70mm, leaving ~175mm for operators. Cap user columns at 22mm so a
    // 1-operator report doesn't render an absurd 175mm-wide cell.
    const operatorColWidth = Math.min(22, Math.max(11, 175 / eligibleUsers.length))
    const operatorColumnStyles: Record<number, { cellWidth: number; halign: 'center'; fontStyle: 'bold' }> = {}
    for (let i = 0; i < eligibleUsers.length; i++) {
      operatorColumnStyles[i + 2] = { cellWidth: operatorColWidth, halign: 'center', fontStyle: 'bold' }
    }

    autoTable(doc, {
      startY: y,
      head: matrixHead,
      body: matrixBody,
      ...tableStyles(ctx),
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 70 },
        ...operatorColumnStyles,
      },
      headStyles: {
        ...tableStyles(ctx).headStyles,
        halign: 'center',
        fontSize: 7,
      },
      didParseCell: data => {
        if (data.section !== 'body') return
        // Y/N cells (column index 2+)
        if (data.column.index >= 2) {
          const v = String(data.cell.raw ?? '')
          if (v === 'Y') {
            data.cell.styles.textColor = [255, 255, 255]
            data.cell.styles.fillColor = COLOR.green
          } else if (v === 'N') {
            data.cell.styles.textColor = [255, 255, 255]
            data.cell.styles.fillColor = COLOR.red
          }
        }
      },
    })
  }

  // ─────────────────────────────────────────────────────────
  // FOOTER on every page
  // ─────────────────────────────────────────────────────────
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    drawFooter(ctx)
  }

  const periodSlug = interval === 'quarterly'
    ? `${year}-q${quarter}`
    : `${year}-${String(month).padStart(2, '0')}`
  const baseSlug = (baseIcao || baseName || 'base').toString().toLowerCase().replace(/\s+/g, '-')
  const filename = `qrc-${interval}-review-${baseSlug}-${periodSlug}.pdf`

  return { doc, filename }
}

function formatRole(role: string): string {
  switch (role) {
    case 'airfield_manager': return 'Airfield Manager'
    case 'namo': return 'NAMO'
    case 'amops': return 'AMOPS'
    case 'base_admin': return 'Base Admin'
    case 'sys_admin': return 'Sys Admin'
    case 'other': return 'Other'
    default: return role
  }
}
