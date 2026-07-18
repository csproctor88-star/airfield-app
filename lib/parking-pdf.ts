import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatZuluDate, formatZuluDateTime, formatZuluTime, formatCoordsDMS } from '@/lib/utils'
import {
  createPdf,
  drawBaseHeader,
  drawReportTitle,
  drawStatBox,
  drawFooter,
} from '@/lib/pdf-utils'
import {
  getADGFromWingspan,
  getClearanceDetail,
  APRON_CONTEXT_LABELS,
  type ADGGroup,
  type ApronContext,
  type ParkingStandard,
  type SpotWithAircraft,
  type ClearanceResult,
} from '@/lib/calculations/parking-clearance'
import type { ParkingPlan, ParkingSpot } from '@/lib/supabase/parking'
import { fmtDistance, type DistanceUnit } from '@/lib/distance-units'

// One framed capture from the parking map — a single "page bundle" in the
// PDF. Single-apron exports pass a one-element array with no label;
// multi-apron exports pass one entry per Add Apron capture.
export interface ParkingPdfSection {
  label?: string | null
  spots: ParkingSpot[]
  spotsWithAircraft: SpotWithAircraft[]
  allResults: ClearanceResult[]
  violations: ClearanceResult[]
  warnings: ClearanceResult[]
  mapDataUrl: string | null
}

interface ParkingPdfInput {
  plan: ParkingPlan
  apronContext: ApronContext
  sections: ParkingPdfSection[]
  baseName?: string | null
  baseIcao?: string | null
  distanceUnit?: DistanceUnit
  parkingStandard?: ParkingStandard
}

export async function generateParkingPdf(input: ParkingPdfInput): Promise<{ doc: jsPDF; filename: string }> {
  const { plan, apronContext, sections, baseName, baseIcao } = input
  // Values are STORED in feet; the base's unit only reformats them for display.
  const unit: DistanceUnit = input.distanceUnit ?? 'ft'
  // Parking clearance standard (UFC wingtip / ICAO code-letter / USAFE 32-1007).
  const standard: ParkingStandard = input.parkingStandard ?? 'ufc'
  const isMulti = sections.length > 1

  const ctx = createPdf({ orientation: 'landscape' })
  const { doc, pageHeight, margin, contentWidth } = ctx
  let y = margin

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - 15) {
      doc.addPage()
      y = margin
    }
  }

  y = drawBaseHeader(ctx, y, { baseName, baseIcao })
  y = drawReportTitle(ctx, y, { title: 'AIRCRAFT PARKING PLAN', subtitle: plan.plan_name })

  // Aggregate stats across every section so the front-matter box reflects
  // the entire export, not just the first apron.
  const totalAircraft = sections.reduce((acc, s) => acc + s.spots.length, 0)
  y = drawStatBox(ctx, y, [
    { label: 'Plan Status', value: plan.is_active ? 'ACTIVE' : 'DRAFT' },
    { label: 'Clearance Context', value: APRON_CONTEXT_LABELS[apronContext] || apronContext },
    { label: isMulti ? `Total Aircraft (${sections.length} Aprons)` : 'Total Aircraft', value: String(totalAircraft) },
    { label: 'Generated', value: formatZuluDateTime(new Date().toISOString()) },
  ])

  // ── Description ──
  if (plan.description) {
    doc.setFontSize(8)
    doc.setTextColor(80)
    const descLines = doc.splitTextToSize(plan.description, contentWidth)
    doc.text(descLines, margin, y)
    y += descLines.length * 3.5 + 4
  }

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]
    if (i > 0) {
      // Each apron after the first starts on a fresh page so multi-apron
      // exports are easy to flip through.
      doc.addPage()
      y = margin
      y = drawBaseHeader(ctx, y, { baseName, baseIcao })
    }

    // Section header — only renders when an apron label is present (i.e.
    // when this came from an Add Apron capture). Single-apron exports get
    // no header, matching the original layout.
    if (section.label) {
      checkPageBreak(14)
      doc.setFontSize(12)
      doc.setTextColor(0)
      doc.setFont('helvetica', 'bold')
      doc.text(section.label, margin, y)
      doc.setFont('helvetica', 'normal')
      y += 7
      doc.setFontSize(8)
      doc.setTextColor(80)
      doc.text(`${section.spots.length} aircraft`, margin, y)
      y += 5
    }

    // ── Aircraft Summary ──
    if (section.spotsWithAircraft.length > 0) {
      const groups = new Map<string, SpotWithAircraft[]>()
      for (const s of section.spotsWithAircraft) {
        const name = s.aircraft_name || 'Unknown'
        if (!groups.has(name)) groups.set(name, [])
        groups.get(name)!.push(s)
      }

      const summaryRows = Array.from(groups.entries()).map(([name, group]) => {
        const s = group[0]
        const adg = getADGFromWingspan(s.wingspan_ft)
        const detail = s.clearance_ft != null
          ? { clearance_ft: s.clearance_ft, ufc_item: 'Manual' }
          : getClearanceDetail(s.wingspan_ft, apronContext, name, standard)

        return [
          name,
          String(group.length),
          adg,
          `${fmtDistance(s.wingspan_ft, unit, { withUnit: false })} × ${fmtDistance(s.length_ft, unit, { withUnit: false })}`,
          fmtDistance(detail.clearance_ft, unit),
        ]
      })

      autoTable(doc, {
        startY: y,
        head: [['Aircraft Type', 'Qty', 'ADG', `WS × Len (${unit})`, 'Min Clearance']],
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

    // ── Spot Detail Table ──
    if (section.spotsWithAircraft.length > 0) {
      checkPageBreak(20)
      const spotRows = section.spotsWithAircraft.map(s => [
        s.spot_name || s.aircraft_name || '—',
        s.aircraft_name || '—',
        s.tail_number || '—',
        `${s.heading_deg}°`,
        formatCoordsDMS(s.latitude, s.longitude),
      ])

      autoTable(doc, {
        startY: y,
        head: [['Aircraft Label', 'Aircraft', 'Tail #', 'Hdg', 'Nose Coordinates']],
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

    // ── Map screenshot — own page, filling the page ──
    if (section.mapDataUrl) {
      try {
        const img = new Image()
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject()
          img.src = section.mapDataUrl!
        })
        doc.addPage()
        y = margin
        const aspect = img.width / img.height
        const maxH = pageHeight - margin - 15
        let imgW = contentWidth
        let imgH = imgW / aspect
        if (imgH > maxH) {
          imgH = maxH
          imgW = imgH * aspect
        }
        const imgX = margin + (contentWidth - imgW) / 2
        const imgY = y + (maxH - imgH) / 2
        doc.addImage(section.mapDataUrl, 'JPEG', imgX, imgY, imgW, imgH)
        y = imgY + imgH + 4
      } catch {
        // Map capture failed — skip silently
      }
    }

    // ── Clearance Violations & Warnings ──
    const issueResults = section.allResults.filter(r => r.status !== 'ok')
    if (issueResults.length > 0) {
      checkPageBreak(30)
      doc.setFontSize(10)
      doc.setTextColor(0)
      doc.text(section.label
        ? `CLEARANCE VIOLATIONS & WARNINGS — ${section.label}`
        : 'CLEARANCE VIOLATIONS & WARNINGS', margin, y)
      y += 5

      const crRows = issueResults
        .sort((a, b) => (a.status === 'violation' ? 0 : 1) - (b.status === 'violation' ? 0 : 1))
        .map(r => [
          r.aircraft_a,
          r.aircraft_b || '—',
          fmtDistance(r.distance_ft, unit, { digits: 1, withUnit: false }),
          fmtDistance(r.required_ft, unit, { withUnit: false }),
          r.ufc_item,
          r.status.toUpperCase(),
        ])

      autoTable(doc, {
        startY: y,
        head: [['Aircraft A', 'Aircraft B / Obstacle', `Actual (${unit})`, `Required (${unit})`, 'Reference', 'Status']],
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
  }

  // ── Footer (render on every page after tables + map are placed) ──
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    drawFooter(ctx)
  }

  const safeName = plan.plan_name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_')
  // Include Zulu HHMM so successive captures of the same plan on the same
  // date (typical multi-apron workflow) don't overwrite each other on
  // download. Invisible inside the PDF; only the saved filename changes.
  const now = new Date().toISOString()
  const filename = `Parking_Plan_${safeName}_${formatZuluDate(now)}_${formatZuluTime(now)}Z.pdf`

  return { doc, filename }
}
