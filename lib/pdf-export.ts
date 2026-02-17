import jsPDF from 'jspdf'
import type { InspectionItem } from '@/lib/supabase/types'

interface InspectionData {
  display_id: string
  inspection_type: 'airfield' | 'lighting'
  inspector_name: string | null
  inspection_date: string
  completed_at: string | null
  weather_conditions: string | null
  temperature_f: number | null
  bwc_value: string | null
  construction_meeting: boolean
  joint_monthly: boolean
  items: InspectionItem[]
  total_items: number
  passed_count: number
  failed_count: number
  na_count: number
  notes: string | null
}

export function generateInspectionPdf(inspection: InspectionData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const checkPageBreak = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage()
      y = margin
    }
  }

  // ── Header ──
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text('SELFRIDGE AIR NATIONAL GUARD BASE (KMTC) — 127TH WING', margin, y)
  y += 4
  doc.text('AIRFIELD MANAGEMENT SECTION', margin, y)
  y += 8

  // Title
  doc.setFontSize(16)
  doc.setTextColor(0)
  const title = inspection.inspection_type === 'airfield'
    ? 'AIRFIELD INSPECTION REPORT'
    : 'LIGHTING INSPECTION REPORT'
  doc.text(title, margin, y)
  y += 6

  // Display ID
  doc.setFontSize(10)
  doc.setTextColor(80)
  doc.text(`Report: ${inspection.display_id}`, margin, y)
  y += 8

  // ── Info Box ──
  doc.setDrawColor(180)
  doc.setLineWidth(0.3)
  doc.rect(margin, y, contentWidth, 24)

  doc.setFontSize(8)
  doc.setTextColor(100)
  const col1 = margin + 3
  const col2 = margin + contentWidth / 3
  const col3 = margin + (contentWidth * 2) / 3

  doc.text('Inspector:', col1, y + 5)
  doc.text('Date:', col2, y + 5)
  doc.text('Weather:', col3, y + 5)

  doc.setFontSize(9)
  doc.setTextColor(0)
  doc.text(inspection.inspector_name || 'N/A', col1, y + 10)
  const dateStr = inspection.completed_at
    ? new Date(inspection.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : inspection.inspection_date
  doc.text(dateStr, col2, y + 10)
  doc.text(inspection.weather_conditions || 'N/A', col3, y + 10)

  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text('Temperature:', col1, y + 16)
  doc.text('BWC:', col2, y + 16)
  doc.text('Status:', col3, y + 16)

  doc.setFontSize(9)
  doc.setTextColor(0)
  doc.text(inspection.temperature_f != null ? `${inspection.temperature_f}°F` : 'N/A', col1, y + 21)
  doc.text(inspection.bwc_value || 'N/A', col2, y + 21)
  doc.text('COMPLETED', col3, y + 21)

  y += 30

  // ── Results Summary ──
  doc.setFontSize(10)
  doc.setTextColor(0)
  doc.text('RESULTS SUMMARY', margin, y)
  y += 5

  doc.setFontSize(9)
  doc.text(`Pass: ${inspection.passed_count}    Fail: ${inspection.failed_count}    N/A: ${inspection.na_count}    Total: ${inspection.total_items}`, margin, y)
  y += 4

  const pct = inspection.total_items > 0
    ? Math.round(((inspection.passed_count + inspection.na_count) / inspection.total_items) * 100)
    : 0
  doc.text(`Compliance Rate: ${pct}%`, margin, y)
  y += 8

  // ── Conditional Sections ──
  if (inspection.construction_meeting || inspection.joint_monthly) {
    doc.setFontSize(8)
    doc.setTextColor(100)
    if (inspection.construction_meeting) doc.text('* Construction Meeting section included', margin, y)
    if (inspection.construction_meeting) y += 4
    if (inspection.joint_monthly) doc.text('* Joint Monthly Airfield Inspection section included', margin, y)
    if (inspection.joint_monthly) y += 4
    y += 4
  }

  // ── Items by Section ──
  const sections = (inspection.items || []).reduce<Record<string, InspectionItem[]>>((acc, item) => {
    const key = item.section || 'Uncategorized'
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})

  for (const [sectionTitle, sectionItems] of Object.entries(sections)) {
    checkPageBreak(14)

    // Section header
    doc.setFontSize(9)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.text(sectionTitle, margin, y)
    y += 5

    // Table header
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(100)
    doc.text('Item', margin, y)
    doc.text('Result', margin + contentWidth - 30, y)
    y += 1
    doc.setDrawColor(200)
    doc.line(margin, y, margin + contentWidth, y)
    y += 3

    for (const item of sectionItems) {
      checkPageBreak(item.notes && item.response === 'fail' ? 12 : 6)

      doc.setFontSize(8)
      doc.setTextColor(40)

      // Truncate long item text
      const itemText = item.item.length > 80 ? item.item.substring(0, 77) + '...' : item.item
      doc.text(itemText, margin, y)

      // Result
      const resultLabel = item.response === 'pass' ? 'PASS'
        : item.response === 'fail' ? 'FAIL'
        : item.response === 'na' ? 'N/A' : '—'
      if (item.response === 'fail') {
        doc.setTextColor(200, 0, 0)
      } else if (item.response === 'pass') {
        doc.setTextColor(0, 130, 0)
      } else {
        doc.setTextColor(120)
      }
      doc.text(resultLabel, margin + contentWidth - 30, y)

      y += 4

      // Notes for failed items
      if (item.notes && item.response === 'fail') {
        doc.setFontSize(7)
        doc.setTextColor(180, 100, 0)
        const noteLines = doc.splitTextToSize(`Note: ${item.notes}`, contentWidth - 10)
        doc.text(noteLines, margin + 4, y)
        y += noteLines.length * 3.5
      }
    }

    y += 4
  }

  // ── Notes ──
  if (inspection.notes) {
    checkPageBreak(16)
    doc.setFontSize(10)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.text('GENERAL NOTES', margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(40)
    const noteLines = doc.splitTextToSize(inspection.notes, contentWidth)
    doc.text(noteLines, margin, y)
    y += noteLines.length * 4
  }

  // ── Footer ──
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150)
    const footerY = doc.internal.pageSize.getHeight() - 8
    doc.text(
      `${inspection.display_id} — Page ${i} of ${totalPages} — Generated ${new Date().toLocaleDateString('en-US')}`,
      margin,
      footerY,
    )
    doc.text('SELFRIDGE ANGB (KMTC) — AIRFIELD OPS', pageWidth - margin, footerY, { align: 'right' })
  }

  // Download
  const filename = `${inspection.display_id}_Inspection_Report.pdf`
  doc.save(filename)
}
