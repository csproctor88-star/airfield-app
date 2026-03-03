import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { WaiverRow, WaiverCriteriaRow, WaiverReviewRow, WaiverCoordinationRow, WaiverAttachmentRow } from '@/lib/supabase/waivers'

const MARGIN = 15
const PHOTO_W = 75 // mm — medium size photo
const PHOTO_H = 56 // 4:3 ratio

interface WaiverPdfInput {
  waiver: WaiverRow
  criteria: WaiverCriteriaRow[]
  reviews: WaiverReviewRow[]
  coordination: WaiverCoordinationRow[]
  attachments: WaiverAttachmentRow[]
  photoDataUrls: { name: string; dataUrl: string }[]
  baseName?: string
  baseIcao?: string
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', pending: 'Pending', approved: 'Approved',
  active: 'Active', completed: 'Closed', cancelled: 'Cancelled', expired: 'Expired',
}

const CRITERIA_SOURCE_LABELS: Record<string, string> = {
  ufc_3_260_01: 'UFC 3-260-01', ufc_3_260_04: 'UFC 3-260-04',
  ufc_3_535_01: 'UFC 3-535-01', other: 'Other',
}

const COORD_OFFICE_LABELS: Record<string, string> = {
  civil_engineer: 'Civil Engineer (BCE)', airfield_manager: 'Airfield Manager',
  airfield_ops_terps: 'Airfield Ops / TERPS', base_safety: 'Base Safety',
  installation_cc: 'Installation Commander', other: 'Other',
}

const REVIEW_REC_LABELS: Record<string, string> = {
  retain: 'Retain', modify: 'Modify', cancel: 'Cancel / Remove',
  convert_to_temporary: 'Convert to Temporary', convert_to_permanent: 'Convert to Permanent',
}

function titleCase(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function generateWaiverPdf(input: WaiverPdfInput) {
  const { waiver: w, criteria, reviews, coordination, attachments, photoDataUrls } = input

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - MARGIN * 2
  let y = MARGIN
  let pageNum = 1

  function addPageNumber() {
    doc.setFontSize(7)
    doc.setTextColor(150)
    doc.text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 8, { align: 'center' })
    doc.text(`Generated ${new Date().toLocaleDateString('en-US')}`, pageWidth - MARGIN, pageHeight - 8, { align: 'right' })
  }

  function checkPageBreak(needed: number) {
    if (y + needed > pageHeight - 18) {
      addPageNumber()
      doc.addPage()
      pageNum++
      y = MARGIN
    }
  }

  function drawSectionHeader(title: string) {
    checkPageBreak(14)
    y += 3
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 64, 120)
    doc.text(title, MARGIN, y)
    y += 1.5
    doc.setDrawColor(30, 64, 120)
    doc.setLineWidth(0.5)
    doc.line(MARGIN, y, MARGIN + contentWidth, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0)
  }

  function drawFieldPair(label: string, value: string | null | undefined, label2?: string, value2?: string | null) {
    checkPageBreak(10)
    const colW = contentWidth / 2

    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100)
    doc.text(label.toUpperCase(), MARGIN, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(40)
    doc.setFontSize(9)
    doc.text(value || 'N/A', MARGIN, y + 4)

    if (label2 !== undefined) {
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(100)
      doc.text(label2.toUpperCase(), MARGIN + colW, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(40)
      doc.setFontSize(9)
      doc.text(value2 || 'N/A', MARGIN + colW, y + 4)
    }

    y += 9
  }

  function drawWrappedField(label: string, value: string | null | undefined) {
    if (!value) return
    checkPageBreak(16)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100)
    doc.text(label.toUpperCase(), MARGIN, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(40)
    doc.setFontSize(9)
    const lines = doc.splitTextToSize(value, contentWidth)
    for (const line of lines) {
      checkPageBreak(5)
      doc.text(line, MARGIN, y)
      y += 4
    }
    y += 2
  }

  // ═══════════════════════════════════════════
  // HEADER
  // ═══════════════════════════════════════════

  // Blue header bar
  doc.setFillColor(30, 64, 120)
  doc.rect(0, 0, pageWidth, 28, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255)
  doc.setFontSize(18)
  doc.text('WAIVER REPORT', MARGIN, 12)

  doc.setFontSize(11)
  doc.text(w.waiver_number, MARGIN, 20)

  // Status badge area
  const statusLabel = STATUS_LABELS[w.status] || titleCase(w.status)
  doc.setFontSize(10)
  const statusWidth = doc.getTextWidth(statusLabel) + 8
  const statusX = pageWidth - MARGIN - statusWidth
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(statusX, 8, statusWidth, 7, 2, 2, 'F')
  doc.setTextColor(30, 64, 120)
  doc.text(statusLabel, statusX + 4, 13.5)

  // Installation info
  if (input.baseName || input.baseIcao) {
    doc.setTextColor(200, 210, 230)
    doc.setFontSize(8)
    doc.text(`${input.baseName || ''} ${input.baseIcao ? `(${input.baseIcao})` : ''}`.trim(), pageWidth - MARGIN, 22, { align: 'right' })
  }

  y = 34

  // Classification + Hazard
  const classLabel = w.classification ? titleCase(w.classification) : 'N/A'
  const hazardLabel = w.hazard_rating ? titleCase(w.hazard_rating) : 'N/A'
  drawFieldPair('Classification', classLabel, 'Hazard Rating', hazardLabel)

  // Description
  drawWrappedField('Description', w.description)

  // ═══════════════════════════════════════════
  // OVERVIEW
  // ═══════════════════════════════════════════
  drawSectionHeader('Overview')

  drawFieldPair('Action Requested', w.action_requested ? titleCase(w.action_requested) : null, 'Period Valid', w.period_valid)
  drawFieldPair('Date Submitted', fmtDate(w.date_submitted), 'Date Approved', fmtDate(w.date_approved))
  drawFieldPair('Expiration Date', fmtDate(w.expiration_date), 'Last Reviewed', fmtDate(w.last_reviewed_date))
  drawFieldPair('Next Review Due', fmtDate(w.next_review_due), 'Location', w.location_description)
  drawFieldPair('Proponent', w.proponent, 'Project Number', w.project_number)
  drawFieldPair('Program FY', w.program_fy?.toString() || null, 'Estimated Cost', w.estimated_cost ? `$${Number(w.estimated_cost).toLocaleString()}` : null)
  drawFieldPair('Project Status', w.project_status, 'FAA Case #', w.faa_case_number)

  drawWrappedField('Justification', w.justification)
  drawWrappedField('Corrective Action', w.corrective_action)
  drawWrappedField('Risk Assessment Summary', w.risk_assessment_summary)

  if (w.criteria_impact) {
    drawWrappedField('Criteria Impact', w.criteria_impact)
  }

  // ═══════════════════════════════════════════
  // CRITERIA & STANDARDS
  // ═══════════════════════════════════════════
  if (criteria.length > 0) {
    drawSectionHeader('Criteria & Standards')

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Source', 'Reference', 'Description']],
      body: criteria.map(c => [
        CRITERIA_SOURCE_LABELS[c.criteria_source] || c.criteria_source,
        c.reference || '',
        c.description || '',
      ]),
      styles: { fontSize: 8, cellPadding: 2.5, textColor: [40, 40, 40] },
      headStyles: { fillColor: [30, 64, 120], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 40 },
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 4
  }

  // ═══════════════════════════════════════════
  // COORDINATION
  // ═══════════════════════════════════════════
  if (coordination.length > 0) {
    drawSectionHeader('Coordination')

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Office', 'Coordinator', 'Date', 'Status', 'Comments']],
      body: coordination.map(c => [
        COORD_OFFICE_LABELS[c.office] || c.office_label || c.office,
        c.coordinator_name || '',
        fmtDate(c.coordinated_date),
        c.status === 'non_concur' ? 'Non-Concur' : titleCase(c.status),
        c.comments || '',
      ]),
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [40, 40, 40] },
      headStyles: { fillColor: [30, 64, 120], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 28 },
        2: { cellWidth: 22 },
        3: { cellWidth: 18 },
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 4
  }

  // ═══════════════════════════════════════════
  // REVIEW HISTORY
  // ═══════════════════════════════════════════
  if (reviews.length > 0) {
    drawSectionHeader('Review History')

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Year', 'Date', 'Recommendation', 'Mitigation', 'Board', 'Notes']],
      body: reviews.map(r => [
        r.review_year.toString(),
        fmtDate(r.review_date),
        REVIEW_REC_LABELS[r.recommendation || ''] || r.recommendation || '',
        r.mitigation_verified ? 'Verified' : '',
        r.presented_to_facilities_board ? `Yes${r.facilities_board_date ? ` (${fmtDate(r.facilities_board_date)})` : ''}` : '',
        [r.project_status_update, r.notes].filter(Boolean).join(' | ') || '',
      ]),
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [40, 40, 40] },
      headStyles: { fillColor: [30, 64, 120], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 22 },
        2: { cellWidth: 28 },
        3: { cellWidth: 16 },
        4: { cellWidth: 22 },
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 4
  }

  // ═══════════════════════════════════════════
  // PHOTOS
  // ═══════════════════════════════════════════
  if (photoDataUrls.length > 0) {
    drawSectionHeader('Photos')

    const cols = 2
    const gap = 6
    const photoW = (contentWidth - gap) / cols
    const photoH = photoW * 0.75

    for (let i = 0; i < photoDataUrls.length; i++) {
      const col = i % cols
      if (col === 0) {
        checkPageBreak(photoH + 12)
      }

      const x = MARGIN + col * (photoW + gap)
      const photo = photoDataUrls[i]

      try {
        const format = photo.dataUrl.includes('image/png') ? 'PNG' : 'JPEG'
        doc.addImage(photo.dataUrl, format, x, y, photoW, photoH)
      } catch {
        doc.setDrawColor(180)
        doc.setFillColor(245, 245, 245)
        doc.rect(x, y, photoW, photoH, 'FD')
        doc.setFontSize(8)
        doc.setTextColor(150)
        doc.text('Photo unavailable', x + photoW / 2, y + photoH / 2, { align: 'center' })
      }

      // Caption under photo
      doc.setFontSize(7)
      doc.setTextColor(100)
      doc.text(photo.name, x, y + photoH + 3, { maxWidth: photoW })

      if (col === cols - 1 || i === photoDataUrls.length - 1) {
        y += photoH + 10
      }
    }
  }

  // ═══════════════════════════════════════════
  // ATTACHMENTS LIST
  // ═══════════════════════════════════════════
  const nonPhotoAttachments = attachments.filter(a => !a.mime_type?.startsWith('image/'))
  if (nonPhotoAttachments.length > 0) {
    drawSectionHeader('Attachments')

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['File Name', 'Type', 'Size']],
      body: nonPhotoAttachments.map(a => [
        a.file_name,
        titleCase(a.file_type),
        a.file_size ? `${(a.file_size / 1024).toFixed(0)} KB` : '',
      ]),
      styles: { fontSize: 8, cellPadding: 2.5, textColor: [40, 40, 40] },
      headStyles: { fillColor: [30, 64, 120], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 4
  }

  // ═══════════════════════════════════════════
  // NOTES
  // ═══════════════════════════════════════════
  if (w.notes) {
    drawSectionHeader('Notes')
    drawWrappedField('', w.notes)
  }

  // Final page number
  addPageNumber()

  // Save
  const filename = `${w.waiver_number.replace(/[^a-zA-Z0-9-]/g, '_')}_Report.pdf`
  return { doc, filename }
}
