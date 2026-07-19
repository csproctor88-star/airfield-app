import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  createPdf, drawBaseHeader, drawReportTitle, drawStatBox, drawFooter, tableStyles,
} from '@/lib/pdf-utils'
import { sanitizePdfText } from '@/lib/pdf-config'
import { formatZuluDateTime } from '@/lib/utils'
import {
  RECORD_TYPE_LABELS, RECORD_TYPE_SHORT_LABELS, ATTACHMENT_KIND_LABELS,
  REVIEW_RECOMMENDATION_LABELS, APPROVAL_AUTHORITY_LABELS,
  statusLabel, isExpired, isDecidedRelief,
} from '@/lib/mods-exemptions/constants'
import type {
  ModsExemptionRow, ModsExemptionReviewRow, ModsExemptionAttachmentRow,
} from '@/lib/supabase/mods-exemptions'

export interface ModsExemptionsRegisterPdfInput {
  baseName?: string | null
  baseIcao?: string | null
  records: ModsExemptionRow[]
  reviews: ModsExemptionReviewRow[]
  generatedAtIso: string
}

const dash = '-'
const dateOr = (d: string | null) => d ?? dash

function effectivePeriod(r: ModsExemptionRow): string {
  if (!r.effective_date && !r.expiration_date) return dash
  return `${r.effective_date ?? '?'} to ${r.expiration_date ?? 'open'}`
}

/** History = records no longer part of live compliance: denied, withdrawn,
 *  closed deviations, and decided relief whose expiration date has passed. */
function isHistory(r: ModsExemptionRow, todayIso: string): boolean {
  if (r.status === 'denied' || r.status === 'withdrawn' || r.status === 'closed') return true
  return isExpired(r, todayIso)
}

/**
 * The inspector-handoff register (FAA Order 5280.5D pre-inspection document
 * request item 33 — "Modifications to Standards and exemptions"):
 * the ALP MOS table (5300.1G ¶12.b columns), the ACM current-exemptions
 * list (§139.203(b)(2) / 5280.5D §2.12.6), §139.113 deviations, and a
 * history section — decided and expired records never vanish from the
 * register the UI promises they're in.
 */
export async function generateModsExemptionsRegisterPdf(
  input: ModsExemptionsRegisterPdfInput,
): Promise<{ doc: jsPDF; filename: string }> {
  const { baseName, baseIcao, records, reviews, generatedAtIso } = input
  const todayIso = generatedAtIso.slice(0, 10)
  const ctx = createPdf({ orientation: 'landscape', format: 'letter' })
  const doc = ctx.doc
  const s = sanitizePdfText

  const active = records.filter((r) => !isHistory(r, todayIso))
  const history = records.filter((r) => isHistory(r, todayIso))
  const mos = active.filter((r) => r.record_type === 'mos')
  const exemptions = active.filter((r) => r.record_type === 'exemption')
  const deviations = active.filter((r) => r.record_type === 'deviation')

  let y = drawBaseHeader(ctx, 15, { baseName, baseIcao })
  y = drawReportTitle(ctx, y, {
    title: 'Modifications & Exemptions Register',
    subtitle: `Generated ${formatZuluDateTime(generatedAtIso)}`,
  })

  const approvedCount = active.filter((r) => isDecidedRelief(r.status)).length
  const pendingCount = active.filter(
    (r) => r.status === 'submitted' || r.status === 'under_review',
  ).length
  y = drawStatBox(ctx, y, [
    { label: 'Active MOS', value: String(mos.length) },
    { label: 'Active exemptions', value: String(exemptions.length) },
    { label: 'Approved / granted', value: String(approvedCount) },
    { label: 'Decision pending', value: String(pendingCount) },
    { label: 'History records', value: String(history.length) },
  ])

  const sectionHead = (label: string, note: string | null, startY: number): number => {
    doc.setFontSize(12)
    doc.setTextColor(60)
    doc.text(s(label), ctx.margin, startY + 8)
    let yy = startY + 11
    if (note) {
      doc.setFontSize(8)
      doc.setTextColor(120)
      doc.text(s(note), ctx.margin, yy + 2)
      yy += 5
    }
    return yy
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableEnd = () => (doc as any).lastAutoTable.finalY + 4

  // ── Modifications of Standards — the ALP table (5300.1G ¶12.b) ──
  y = sectionHead(
    'Modifications of Standards (MOS)',
    'ALP table columns per FAA Order 5300.1G para 12.b - approval letter dates and airspace review case numbers.',
    y,
  )
  if (mos.length === 0) {
    doc.setFontSize(9); doc.setTextColor(120)
    doc.text(s('No active MOS records.'), ctx.margin, y + 4); y += 8
  } else {
    autoTable(doc, {
      ...tableStyles(ctx),
      startY: y + 2,
      head: [['Modification', 'Standard modified', 'Category', 'Status', 'Letter date', 'Effective period', 'Airspace case / AGIS', 'Conditions']],
      body: mos.map((r) => [
        s(r.title),
        s(r.standard_reference),
        s(r.mos_category ? `${r.mos_category}${r.mos_subcategory ? ` - ${r.mos_subcategory}` : ''}` : dash),
        s(statusLabel('mos', r.status)),
        dateOr(r.date_decided),
        s(effectivePeriod(r)),
        s(r.agis_tracking ?? dash),
        s(r.decision_conditions ?? dash),
      ]),
      columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 42 }, 2: { cellWidth: 36 }, 3: { cellWidth: 22 }, 4: { cellWidth: 22 }, 5: { cellWidth: 32 }, 6: { cellWidth: 30 } },
    })
    y = tableEnd()
  }

  // ── Exemptions — the ACM current-exemptions list ──
  y = sectionHead(
    'Part 139 Exemptions',
    'Current-exemptions list per 14 CFR 139.203(b) element 2 and Order 5280.5D para 2.12.6; annual review per para 2.12.2.',
    y,
  )
  if (exemptions.length === 0) {
    doc.setFontSize(9); doc.setTextColor(120)
    doc.text(s('No active exemption records.'), ctx.margin, y + 4); y += 8
  } else {
    const latestReviewFor = (recordId: string): ModsExemptionReviewRow | undefined =>
      reviews.filter((v) => v.record_id === recordId)
        .sort((a, b) => b.review_date.localeCompare(a.review_date))[0]
    autoTable(doc, {
      ...tableStyles(ctx),
      startY: y + 2,
      head: [['Regulation section', 'Title', 'Docket', 'Status', 'Effective period', 'Last annual review', 'Justification valid']],
      body: exemptions.map((r) => {
        const rev = latestReviewFor(r.id)
        return [
          s(r.standard_reference),
          s(r.title),
          s(r.docket_number ?? dash),
          s(statusLabel('exemption', r.status)),
          s(effectivePeriod(r)),
          rev ? rev.review_date : dateOr(r.last_reviewed_date),
          rev ? (rev.justification_still_valid ? 'YES' : 'NO') : dash,
        ]
      }),
      columnStyles: { 0: { cellWidth: 38 }, 2: { cellWidth: 30 }, 3: { cellWidth: 24 }, 4: { cellWidth: 34 }, 5: { cellWidth: 28 }, 6: { cellWidth: 24 } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 6) {
          if (data.cell.raw === 'NO') { data.cell.styles.textColor = [200, 0, 0]; data.cell.styles.fontStyle = 'bold' }
          if (data.cell.raw === 'YES') data.cell.styles.textColor = [34, 139, 64]
        }
      },
    })
    y = tableEnd()
  }

  // ── Emergency deviations (§139.113) ──
  if (deviations.length > 0) {
    y = sectionHead(
      'Emergency Deviations (14 CFR 139.113)',
      'RADM must be notified of nature, extent, and duration within 14 days of the emergency.',
      y,
    )
    autoTable(doc, {
      ...tableStyles(ctx),
      startY: y + 2,
      head: [['Deviation date', 'Requirement deviated from', 'Nature', 'Status', 'RADM notified', 'Written notice']],
      body: deviations.map((r) => [
        dateOr(r.deviation_date),
        s(r.standard_reference),
        s(r.title),
        s(statusLabel('deviation', r.status)),
        dateOr(r.notified_date),
        r.written_notice_requested ? (r.written_notice_provided ? 'Provided' : 'REQUESTED') : dash,
      ]),
      columnStyles: { 0: { cellWidth: 26 }, 3: { cellWidth: 32 }, 4: { cellWidth: 28 }, 5: { cellWidth: 26 } },
    })
    y = tableEnd()
  }

  // ── History — denied / withdrawn / expired / closed stay on the register ──
  if (history.length > 0) {
    y = sectionHead(
      'History (decided, withdrawn, expired)',
      'Retained for record - excluded from the active counts above.',
      y,
    )
    autoTable(doc, {
      ...tableStyles(ctx),
      startY: y + 2,
      head: [['Type', 'Title', 'Standard', 'Status', 'Decided', 'Expired']],
      body: history.map((r) => [
        RECORD_TYPE_SHORT_LABELS[r.record_type],
        s(r.title),
        s(r.standard_reference),
        s(statusLabel(r.record_type, r.status)),
        dateOr(r.date_decided),
        isExpired(r, todayIso) ? (r.expiration_date ?? 'yes') : dash,
      ]),
      columnStyles: { 0: { cellWidth: 24 }, 3: { cellWidth: 30 }, 4: { cellWidth: 24 }, 5: { cellWidth: 24 } },
    })
  }

  drawFooter(ctx)
  const filename = `modifications-exemptions-register-${(baseIcao || 'base').toLowerCase()}.pdf`
  return { doc, filename }
}

export interface ModsExemptionDetailPdfInput {
  baseName?: string | null
  baseIcao?: string | null
  record: ModsExemptionRow
  reviews: ModsExemptionReviewRow[]
  attachments: ModsExemptionAttachmentRow[]
  generatedAtIso: string
}

/** Single-record detail: every populated field, review history, attachment list. */
export async function generateModsExemptionDetailPdf(
  input: ModsExemptionDetailPdfInput,
): Promise<{ doc: jsPDF; filename: string }> {
  const { baseName, baseIcao, record, generatedAtIso } = input
  const reviews = input.reviews.filter((v) => v.record_id === record.id)
  const attachments = input.attachments.filter((a) => a.record_id === record.id)
  const todayIso = generatedAtIso.slice(0, 10)
  const ctx = createPdf({ orientation: 'portrait', format: 'letter' })
  const doc = ctx.doc
  const s = sanitizePdfText

  let y = drawBaseHeader(ctx, 15, { baseName, baseIcao })
  y = drawReportTitle(ctx, y, {
    title: s(RECORD_TYPE_LABELS[record.record_type]),
    subtitle: `Generated ${formatZuluDateTime(generatedAtIso)}`,
  })

  const statusText = isExpired(record, todayIso)
    ? `${statusLabel(record.record_type, record.status)} (EXPIRED)`
    : statusLabel(record.record_type, record.status)

  const fields: Array<[string, string | null]> = [
    ['Title', record.title],
    ['Status', statusText],
    ['Standard / requirement', record.standard_reference],
    ['Baseline requirement', record.baseline_summary],
    ['Relief / difference sought', record.relief_summary],
    ['Justification', record.justification],
    ['Public interest (11.81(d))', record.public_interest],
    ['Safety justification (11.81(e))', record.safety_justification],
    ['MOS category', record.mos_category ? `${record.mos_category}${record.mos_subcategory ? ` - ${record.mos_subcategory}` : ''}` : null],
    ['Approval authority', record.approval_authority ? APPROVAL_AUTHORITY_LABELS[record.approval_authority] : null],
    ['AGIS / airspace case', record.agis_tracking],
    ['Docket number', record.docket_number],
    ['ARFF small-airport petition (139.111(b))', record.arff_small_airport ? 'Yes' : null],
    ['Submitted', record.date_submitted],
    ['Decided', record.date_decided],
    ['Effective', record.effective_date],
    ['Expires', record.expiration_date],
    ['Decision summary', record.decision_summary],
    ['Decision conditions', record.decision_conditions],
    ['Last annual review', record.last_reviewed_date],
    ['Next review due', record.next_review_due],
    ['Deviation date (139.113)', record.deviation_date],
    ['RADM notified', record.notified_date],
    ['Written notice', record.written_notice_requested ? (record.written_notice_provided ? 'Requested - provided' : 'Requested - NOT yet provided') : null],
    ['Notes', record.notes],
  ]
  autoTable(doc, {
    ...tableStyles(ctx),
    startY: y + 2,
    head: [['Field', 'Value']],
    body: fields.filter(([, v]) => v !== null && v !== '').map(([k, v]) => [s(k), s(v as string)]),
    columnStyles: { 0: { cellWidth: 58, fontStyle: 'bold' } },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6

  if (reviews.length > 0) {
    doc.setFontSize(12); doc.setTextColor(60)
    doc.text(s('Annual review history (5280.5D para 2.12.2)'), ctx.margin, y + 6)
    autoTable(doc, {
      ...tableStyles(ctx),
      startY: y + 9,
      head: [['Review date', 'Justification still valid', 'Recommendation', 'Notes']],
      body: reviews
        .slice()
        .sort((a, b) => b.review_date.localeCompare(a.review_date))
        .map((v) => [
          v.review_date,
          v.justification_still_valid ? 'YES' : 'NO',
          v.recommendation ? s(REVIEW_RECOMMENDATION_LABELS[v.recommendation]) : dash,
          s(v.notes ?? dash),
        ]),
      columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 34 }, 2: { cellWidth: 50 } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          if (data.cell.raw === 'NO') { data.cell.styles.textColor = [200, 0, 0]; data.cell.styles.fontStyle = 'bold' }
          if (data.cell.raw === 'YES') data.cell.styles.textColor = [34, 139, 64]
        }
      },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6
  }

  if (attachments.length > 0) {
    doc.setFontSize(12); doc.setTextColor(60)
    doc.text(s('Attachments on file'), ctx.margin, y + 6)
    autoTable(doc, {
      ...tableStyles(ctx),
      startY: y + 9,
      head: [['Kind', 'File', 'Uploaded']],
      body: attachments.map((a) => [
        s(ATTACHMENT_KIND_LABELS[a.kind]),
        s(a.caption ? `${a.file_name} - ${a.caption}` : a.file_name),
        formatZuluDateTime(a.created_at),
      ]),
      columnStyles: { 0: { cellWidth: 42 }, 2: { cellWidth: 40 } },
    })
  }

  drawFooter(ctx)
  const slug = record.record_type === 'mos' ? 'mos' : record.record_type
  const filename = `${slug}-record-${(baseIcao || 'base').toLowerCase()}-${record.id.slice(0, 8)}.pdf`
  return { doc, filename }
}
