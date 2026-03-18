import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatZuluDate, formatZuluDateTime } from '@/lib/utils'
import {
  getADGFromWingspan,
  getWingtipClearanceDetail,
  APRON_CONTEXT_LABELS,
  type ADGGroup,
  type ApronContext,
  type SpotWithAircraft,
  type ClearanceResult,
} from '@/lib/calculations/parking-clearance'
import type { ParkingPlan, ParkingSpot, ParkingObstacle, ParkingTaxilane } from '@/lib/supabase/parking'

interface ParkingPdfInput {
  plan: ParkingPlan
  spots: ParkingSpot[]
  spotsWithAircraft: SpotWithAircraft[]
  obstacles: ParkingObstacle[]
  taxilanes: ParkingTaxilane[]
  allResults: ClearanceResult[]
  violations: ClearanceResult[]
  warnings: ClearanceResult[]
  apronContext: ApronContext
  mapDataUrl: string | null
  baseName?: string
  baseIcao?: string
}

export async function generateParkingPdf(input: ParkingPdfInput): Promise<{ doc: jsPDF; filename: string }> {
  const {
    plan, spots, spotsWithAircraft, obstacles, taxilanes,
    allResults, violations, warnings, apronContext,
    mapDataUrl, baseName, baseIcao,
  } = input

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 12
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - 15) {
      doc.addPage()
      y = margin
    }
  }

  // ── Header ──
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text(baseName ? `${baseName.toUpperCase()}${baseIcao ? ` (${baseIcao})` : ''}` : 'AIRFIELD OPERATIONS', margin, y)
  y += 4
  doc.text('AIRFIELD MANAGEMENT SECTION', margin, y)
  y += 7

  // ── Title ──
  doc.setFontSize(16)
  doc.setTextColor(0)
  doc.text('AIRCRAFT PARKING PLAN', margin, y)
  y += 7

  doc.setFontSize(11)
  doc.setTextColor(60)
  doc.text(plan.plan_name, margin, y)
  y += 7

  // ── Info box ──
  doc.setDrawColor(200)
  doc.setFillColor(248, 248, 248)
  doc.roundedRect(margin, y, contentWidth, 16, 2, 2, 'FD')

  const col1 = margin + 4
  const col2 = margin + contentWidth * 0.25
  const col3 = margin + contentWidth * 0.5
  const col4 = margin + contentWidth * 0.75

  doc.setFontSize(7)
  doc.setTextColor(120)
  doc.text('Plan Status:', col1, y + 5)
  doc.text('Clearance Context:', col2, y + 5)
  doc.text('Total Aircraft:', col3, y + 5)
  doc.text('Generated:', col4, y + 5)

  doc.setFontSize(9)
  doc.setTextColor(0)
  doc.text(plan.is_active ? 'ACTIVE' : 'DRAFT', col1, y + 10)
  doc.text(APRON_CONTEXT_LABELS[apronContext] || apronContext, col2, y + 10)
  doc.text(String(spots.length), col3, y + 10)
  doc.text(formatZuluDateTime(new Date().toISOString()), col4, y + 10)

  y += 20

  // ── Description ──
  if (plan.description) {
    doc.setFontSize(8)
    doc.setTextColor(80)
    const descLines = doc.splitTextToSize(plan.description, contentWidth)
    doc.text(descLines, margin, y)
    y += descLines.length * 3.5 + 4
  }

  // ── Statistics summary ──
  const adgBreakdown: Record<string, number> = {}
  const statusBreakdown: Record<string, number> = { occupied: 0, available: 0, reserved: 0 }
  for (const s of spotsWithAircraft) {
    const adg = getADGFromWingspan(s.wingspan_ft)
    adgBreakdown[adg] = (adgBreakdown[adg] || 0) + 1
    statusBreakdown[s.status] = (statusBreakdown[s.status] || 0) + 1
  }

  doc.setDrawColor(200)
  doc.setFillColor(248, 248, 248)
  doc.roundedRect(margin, y, contentWidth, 12, 2, 2, 'FD')

  doc.setFontSize(7)
  doc.setTextColor(120)
  let sx = margin + 4
  doc.text('ADG Breakdown:', sx, y + 4)
  doc.setFontSize(8)
  doc.setTextColor(0)
  const adgParts = Object.entries(adgBreakdown).sort().map(([g, c]) => `${g}: ${c}`).join('  ')
  doc.text(adgParts || 'None', sx, y + 8)

  sx = margin + contentWidth * 0.4
  doc.setFontSize(7)
  doc.setTextColor(120)
  doc.text('Status:', sx, y + 4)
  doc.setFontSize(8)
  doc.setTextColor(0)
  doc.text(`${statusBreakdown.occupied} Occupied  ${statusBreakdown.available} Available  ${statusBreakdown.reserved} Reserved`, sx, y + 8)

  sx = margin + contentWidth * 0.78
  doc.setFontSize(7)
  doc.setTextColor(120)
  doc.text('Clearance:', sx, y + 4)
  doc.setFontSize(8)
  doc.setTextColor(violations.length > 0 ? 200 : 0, violations.length > 0 ? 0 : 0, 0)
  doc.text(`${violations.length} Violations  ${warnings.length} Warnings`, sx, y + 8)

  y += 16

  // ── Map screenshot ──
  if (mapDataUrl) {
    checkPageBreak(80)
    try {
      // Landscape letter: ~255mm content width; maintain aspect ratio
      const imgH = Math.min(contentWidth * 0.5, pageHeight - y - 20)
      doc.addImage(mapDataUrl, 'PNG', margin, y, contentWidth, imgH)
      y += imgH + 4
    } catch {
      // Map capture failed — skip silently
    }
  }

  // ── Aircraft summary table ──
  checkPageBreak(30)
  doc.setFontSize(10)
  doc.setTextColor(0)
  doc.text('AIRCRAFT PLACEMENT DETAILS', margin, y)
  y += 5

  if (spotsWithAircraft.length > 0) {
    const acRows = spotsWithAircraft.map(s => {
      const adg = getADGFromWingspan(s.wingspan_ft)
      const detail = s.clearance_ft != null
        ? { clearance_ft: s.clearance_ft, ufc_item: 'Manual', description: 'Override' }
        : getWingtipClearanceDetail(s.wingspan_ft, apronContext, s.aircraft_name || '')
      return [
        s.aircraft_name || 'Unknown',
        adg,
        `${Math.round(s.wingspan_ft)}`,
        `${Math.round(s.length_ft)}`,
        s.tail_number || '—',
        s.unit_callsign || '—',
        s.status || '—',
        `${detail.clearance_ft}`,
        detail.ufc_item,
      ]
    })

    autoTable(doc, {
      startY: y,
      head: [['Aircraft', 'ADG', 'WS (ft)', 'Len (ft)', 'Tail #', 'Callsign', 'Status', 'Clr (ft)', 'UFC Item']],
      body: acRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 12, halign: 'center' },
        2: { cellWidth: 16, halign: 'right' },
        3: { cellWidth: 16, halign: 'right' },
        6: { cellWidth: 20 },
        7: { cellWidth: 14, halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 6) {
          const status = String(data.cell.raw)
          if (status === 'occupied') data.cell.styles.textColor = [239, 68, 68]
          else if (status === 'reserved') data.cell.styles.textColor = [249, 115, 22]
          else if (status === 'available') data.cell.styles.textColor = [34, 197, 94]
        }
      },
    })
    y = (doc as any).lastAutoTable.finalY + 6
  }

  // ── Clearance results table ──
  const issueResults = allResults.filter(r => r.status !== 'ok')
  if (issueResults.length > 0) {
    checkPageBreak(30)
    doc.setFontSize(10)
    doc.setTextColor(0)
    doc.text('CLEARANCE VIOLATIONS & WARNINGS', margin, y)
    y += 5

    const crRows = issueResults
      .sort((a, b) => (a.status === 'violation' ? 0 : 1) - (b.status === 'violation' ? 0 : 1))
      .map(r => [
        r.aircraft_a,
        r.aircraft_b || '—',
        r.distance_ft.toFixed(1),
        String(r.required_ft),
        r.ufc_item,
        r.ufc_desc,
        r.status.toUpperCase(),
      ])

    autoTable(doc, {
      startY: y,
      head: [['Aircraft A', 'Aircraft B / Obstacle', 'Dist (ft)', 'Req (ft)', 'UFC Item', 'Description', 'Status']],
      body: crRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 6) {
          const status = String(data.cell.raw)
          if (status === 'VIOLATION') {
            data.cell.styles.textColor = [239, 68, 68]
            data.cell.styles.fontStyle = 'bold'
          } else if (status === 'WARNING') {
            data.cell.styles.textColor = [249, 158, 11]
            data.cell.styles.fontStyle = 'bold'
          }
        }
      },
    })
    y = (doc as any).lastAutoTable.finalY + 6
  }

  // ── Obstacles summary ──
  if (obstacles.length > 0) {
    checkPageBreak(20)
    doc.setFontSize(10)
    doc.setTextColor(0)
    doc.text('OBSTACLES', margin, y)
    y += 5

    const obsRows = obstacles.map(o => [
      o.name || 'Unnamed',
      o.obstacle_type,
      o.obstacle_type === 'building' ? `${o.width_ft || 0} x ${o.length_ft || 0}` :
      o.obstacle_type === 'circle' ? `r=${o.radius_ft || 0}` :
      o.height_ft ? `h=${o.height_ft}` : '—',
    ])

    autoTable(doc, {
      startY: y,
      head: [['Obstacle', 'Type', 'Dimensions (ft)']],
      body: obsRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold' },
    })
    y = (doc as any).lastAutoTable.finalY + 6
  }

  // ── Taxilanes summary ──
  if (taxilanes.length > 0) {
    checkPageBreak(20)
    doc.setFontSize(10)
    doc.setTextColor(0)
    doc.text('TAXILANES', margin, y)
    y += 5

    const tlRows = taxilanes.map(t => [
      t.name || 'Unnamed',
      t.taxilane_type,
      t.design_aircraft || '—',
      t.design_wingspan_ft ? `${t.design_wingspan_ft}` : '—',
      t.is_transient ? 'Yes' : 'No',
    ])

    autoTable(doc, {
      startY: y,
      head: [['Taxilane', 'Type', 'Design Aircraft', 'Design WS (ft)', 'Transient']],
      body: tlRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold' },
    })
    y = (doc as any).lastAutoTable.finalY + 6
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(140)
    doc.text(`Generated by Glidepath — ${formatZuluDateTime(new Date().toISOString())}`, margin, pageHeight - 8)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
  }

  const safeName = plan.plan_name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_')
  const filename = `Parking_Plan_${safeName}_${formatZuluDate(new Date().toISOString())}.pdf`

  return { doc, filename }
}
