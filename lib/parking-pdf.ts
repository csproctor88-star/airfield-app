import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatZuluDate, formatZuluDateTime, formatCoordsDMS } from '@/lib/utils'
import {
  getADGFromWingspan,
  getWingtipClearanceDetail,
  APRON_CONTEXT_LABELS,
  type ADGGroup,
  type ApronContext,
  type SpotWithAircraft,
  type ClearanceResult,
} from '@/lib/calculations/parking-clearance'
import type { ParkingPlan, ParkingSpot } from '@/lib/supabase/parking'

interface ParkingPdfInput {
  plan: ParkingPlan
  spots: ParkingSpot[]
  spotsWithAircraft: SpotWithAircraft[]
  allResults: ClearanceResult[]
  violations: ClearanceResult[]
  warnings: ClearanceResult[]
  apronContext: ApronContext
  mapDataUrl: string | null
  baseName?: string | null
  baseIcao?: string | null
}

export async function generateParkingPdf(input: ParkingPdfInput): Promise<{ doc: jsPDF; filename: string }> {
  const {
    plan, spots, spotsWithAircraft, allResults, violations, warnings,
    apronContext, mapDataUrl, baseName, baseIcao,
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

  // ── Aircraft Summary (compact, part of header) ──
  if (spotsWithAircraft.length > 0) {
    // Group by aircraft_name
    const groups = new Map<string, SpotWithAircraft[]>()
    for (const s of spotsWithAircraft) {
      const name = s.aircraft_name || 'Unknown'
      if (!groups.has(name)) groups.set(name, [])
      groups.get(name)!.push(s)
    }

    const summaryRows = Array.from(groups.entries()).map(([name, group]) => {
      const s = group[0]
      const adg = getADGFromWingspan(s.wingspan_ft)
      const detail = s.clearance_ft != null
        ? { clearance_ft: s.clearance_ft, ufc_item: 'Manual' }
        : getWingtipClearanceDetail(s.wingspan_ft, apronContext, name)

      return [
        name,
        String(group.length),
        adg,
        `${Math.round(s.wingspan_ft)} × ${Math.round(s.length_ft)}`,
        `${detail.clearance_ft} ft`,
      ]
    })

    autoTable(doc, {
      startY: y,
      head: [['Aircraft Type', 'Qty', 'ADG', 'WS × Len (ft)', 'Min Clearance']],
      body: summaryRows,
      margin: { left: margin, right: margin },
      tableWidth: 'wrap',
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        1: { cellWidth: 10, halign: 'center' },
        2: { cellWidth: 12, halign: 'center' },
        3: { cellWidth: 30 },
        4: { cellWidth: 22, halign: 'right' },
      },
    })
    y = (doc as any).lastAutoTable.finalY + 4
  }

  // ── Spot Detail Table (per-aircraft with nose coordinates) ──
  if (spotsWithAircraft.length > 0) {
    checkPageBreak(20)
    const spotRows = spotsWithAircraft.map(s => [
      s.spot_name || s.aircraft_name || '—',
      s.aircraft_name || '—',
      s.tail_number || '—',
      `${s.heading_deg}°`,
      formatCoordsDMS(s.latitude, s.longitude),
    ])

    autoTable(doc, {
      startY: y,
      head: [['Spot', 'Aircraft', 'Tail #', 'Hdg', 'Nose Coordinates']],
      body: spotRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 48, font: 'courier' },
      },
    })
    y = (doc as any).lastAutoTable.finalY + 4
  }

  // ── Map screenshot (preserve source aspect ratio exactly) ──
  if (mapDataUrl) {
    checkPageBreak(80)
    try {
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject()
        img.src = mapDataUrl
      })
      const aspect = img.width / img.height
      const maxH = pageHeight - y - 15
      let imgW = contentWidth
      let imgH = imgW / aspect
      if (imgH > maxH) {
        imgH = maxH
        imgW = imgH * aspect
      }
      const imgX = margin + (contentWidth - imgW) / 2
      doc.addImage(mapDataUrl, 'JPEG', imgX, y, imgW, imgH)
      y += imgH + 4
    } catch {
      // Map capture failed — skip silently
    }
  }

  // ── Clearance Violations & Warnings (only if any) ──
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
        r.status.toUpperCase(),
      ])

    autoTable(doc, {
      startY: y,
      head: [['Aircraft A', 'Aircraft B / Obstacle', 'Actual (ft)', 'Required (ft)', 'UFC Item', 'Status']],
      body: crRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
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
