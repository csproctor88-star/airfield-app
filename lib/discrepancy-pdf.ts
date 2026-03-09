import jsPDF from 'jspdf'
import { DISCREPANCY_TYPES, SEVERITY_CONFIG, STATUS_CONFIG, LOCATION_OPTIONS, CURRENT_STATUS_OPTIONS } from '@/lib/constants'
import { formatZuluDateTime, formatZuluDate } from '@/lib/utils'

interface DiscrepancyPdfInput {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  discrepancy: any
  photoDataUrls: string[]
  mapDataUrl: string | null
  baseName?: string
  baseIcao?: string
}

export async function generateDiscrepancyPdf(input: DiscrepancyPdfInput) {
  const { discrepancy: d, photoDataUrls, mapDataUrl, baseName, baseIcao } = input
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - 20) {
      doc.addPage()
      y = margin
    }
  }

  const workOrder = d.work_order_number || 'Pending'
  const statusConfig = STATUS_CONFIG[d.status as keyof typeof STATUS_CONFIG]
  const severityConfig = SEVERITY_CONFIG[d.severity as keyof typeof SEVERITY_CONFIG]
  const typeLabels = d.type
    ? d.type.split(', ').map((v: string) => {
        const t = DISCREPANCY_TYPES.find((dt) => dt.value === v)
        return t ? t.label : v
      }).join(', ')
    : 'N/A'
  const locationLabel = (() => {
    const loc = LOCATION_OPTIONS.find((l) => l.value === d.location_text)
    return loc ? loc.label : d.location_text || 'N/A'
  })()
  const currentStatusLabel = (() => {
    const cs = d.current_status
    return CURRENT_STATUS_OPTIONS.find((o) => o.value === cs)?.label || cs || 'N/A'
  })()

  // -- Header --
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text(baseName ? `${baseName.toUpperCase()}${baseIcao ? ` (${baseIcao})` : ''}` : 'AIRFIELD OPERATIONS', margin, y)
  y += 4
  doc.text('AIRFIELD MANAGEMENT SECTION', margin, y)
  y += 8

  // -- Title --
  doc.setFontSize(16)
  doc.setTextColor(0)
  doc.text('DISCREPANCY REPORT', margin, y)
  y += 7

  doc.setFontSize(11)
  doc.setTextColor(60)
  doc.text(d.title || '', margin, y)
  y += 8

  // -- Info box --
  doc.setDrawColor(200)
  doc.setFillColor(248, 248, 248)
  doc.roundedRect(margin, y, contentWidth, 26, 2, 2, 'FD')

  const col1 = margin + 4
  const col2 = margin + contentWidth / 3
  const col3 = margin + (contentWidth * 2) / 3

  // Row 1
  doc.setFontSize(7)
  doc.setTextColor(120)
  doc.text('Work Order:', col1, y + 5)
  doc.text('Status:', col2, y + 5)
  doc.text('Severity:', col3, y + 5)

  doc.setFontSize(9)
  doc.setTextColor(0)
  doc.text(workOrder, col1, y + 10)
  doc.text(statusConfig?.label || d.status || 'N/A', col2, y + 10)
  doc.text(severityConfig?.label || d.severity || 'N/A', col3, y + 10)

  // Row 2
  doc.setFontSize(7)
  doc.setTextColor(120)
  doc.text('Type:', col1, y + 17)
  doc.text('Location:', col2, y + 17)
  doc.text('Assigned Shop:', col3, y + 17)

  doc.setFontSize(9)
  doc.setTextColor(0)
  doc.text(typeLabels, col1, y + 22)
  doc.text(locationLabel, col2, y + 22)
  doc.text(d.assigned_shop || 'Unassigned', col3, y + 22)

  y += 32

  // -- Current Status --
  doc.setFontSize(7)
  doc.setTextColor(120)
  doc.text('Current Status:', margin, y)
  y += 4
  doc.setFontSize(9)
  doc.setTextColor(0)
  doc.text(currentStatusLabel, margin, y)
  y += 4

  // -- Date --
  const createdAt = d.created_at ? new Date(d.created_at) : null
  if (createdAt) {
    doc.setFontSize(7)
    doc.setTextColor(120)
    doc.text('Created:', margin + contentWidth / 3, y - 4)
    doc.setFontSize(9)
    doc.setTextColor(0)
    doc.text(formatZuluDateTime(createdAt), margin + contentWidth / 3, y)
  }

  y += 8

  // -- Description --
  checkPageBreak(20)
  doc.setFontSize(10)
  doc.setTextColor(0)
  doc.setFont('helvetica', 'bold')
  doc.text('DESCRIPTION', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(40)
  if (d.description) {
    const descLines = doc.splitTextToSize(d.description, contentWidth)
    doc.text(descLines, margin, y)
    y += descLines.length * 4 + 4
  } else {
    doc.text('No description provided.', margin, y)
    y += 6
  }

  // -- Resolution Notes --
  if (d.resolution_notes) {
    checkPageBreak(16)
    y += 2
    doc.setFontSize(10)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.text('RESOLUTION NOTES', margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(40)
    const resLines = doc.splitTextToSize(d.resolution_notes, contentWidth)
    doc.text(resLines, margin, y)
    y += resLines.length * 4 + 4
  }

  // -- Location / Map --
  const lat = d.latitude != null ? Number(d.latitude) : null
  const lng = d.longitude != null ? Number(d.longitude) : null
  if (lat != null && lng != null) {
    checkPageBreak(50)
    y += 2
    doc.setFontSize(10)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.text('LOCATION', margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(40)
    doc.text(`Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`, margin, y)
    y += 5

    if (mapDataUrl) {
      try {
        doc.addImage(mapDataUrl, 'PNG', margin, y, 80, 40)
        y += 44
      } catch {
        y += 4
      }
    }
  }

  // -- Photos --
  if (photoDataUrls.length > 0) {
    checkPageBreak(14)
    y += 4
    doc.setFontSize(10)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.text(`PHOTOS (${photoDataUrls.length})`, margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')

    for (const dataUrl of photoDataUrls) {
      checkPageBreak(45)
      try {
        const format = dataUrl.includes('image/png') ? 'PNG' : 'JPEG'
        doc.addImage(dataUrl, format, margin, y, 50, 38)
        y += 42
      } catch {
        doc.setFontSize(7)
        doc.setTextColor(150)
        doc.text('[Photo unavailable]', margin, y)
        y += 5
      }
    }
  }

  // -- Footer on all pages --
  const totalPages = doc.getNumberOfPages()
  const displayLabel = d.work_order_number || d.title || d.id
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150)
    const footerY = pageHeight - 8
    doc.text(
      `Discrepancy: ${displayLabel} — Page ${i} of ${totalPages} — Generated ${formatZuluDate(new Date())}`,
      margin,
      footerY,
    )
    if (baseName) {
      doc.text(
        `${baseName}${baseIcao ? ` (${baseIcao})` : ''} — AIRFIELD OPS`,
        pageWidth - margin,
        footerY,
        { align: 'right' },
      )
    }
  }

  const dateStr = new Date().toISOString().slice(0, 10)
  const fileId = d.work_order_number || d.id
  const filename = `Discrepancy_${fileId}_${dateStr}.pdf`
  return { doc, filename }
}
