import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ObstructionRow } from '@/lib/supabase/obstructions'
import { parsePhotoPaths } from '@/lib/supabase/obstructions'
import { formatZuluTime, formatZuluDate, fetchMapImageDataUrl } from '@/lib/utils'

type SurfaceResult = {
  surfaceKey: string
  surfaceName: string
  isWithinBounds: boolean
  maxAllowableHeightAGL: number
  maxAllowableHeightMSL: number
  obstructionTopMSL: number
  violated: boolean
  penetrationFt: number
  ufcReference: string
  ufcCriteria: string
}

interface ObstructionPdfInput {
  evaluation: ObstructionRow
  photoDataUrls: string[]
  mapDataUrl?: string | null
  baseName?: string | null
  baseIcao?: string | null
}

export async function generateObstructionPdf(input: ObstructionPdfInput) {
  const { evaluation, photoDataUrls, baseName, baseIcao } = input
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

  const displayId = String(evaluation.display_id || '')
  const results = (evaluation.results || []) as SurfaceResult[]
  const applicableResults = results.filter((r) => r.isWithinBounds)
  const violatedResults = results.filter((r) => r.violated)

  // ── Header ──
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text(baseName ? `${baseName.toUpperCase()}${baseIcao ? ` (${baseIcao})` : ''}` : 'AIRFIELD OPERATIONS', margin, y)
  y += 4
  doc.text('AIRFIELD MANAGEMENT SECTION', margin, y)
  y += 8

  // ── Title ──
  doc.setFontSize(16)
  doc.setTextColor(0)
  doc.text('OBSTRUCTION EVALUATION REPORT', margin, y)
  y += 7

  doc.setFontSize(11)
  doc.setTextColor(60)
  doc.text(displayId, margin, y)

  // Status badge (right-aligned)
  const badgeText = evaluation.has_violation ? 'VIOLATION' : 'CLEAR'
  const badgeWidth = doc.getTextWidth(badgeText) + 8
  const badgeX = pageWidth - margin - badgeWidth
  if (evaluation.has_violation) {
    doc.setFillColor(239, 68, 68)
  } else {
    doc.setFillColor(34, 197, 94)
  }
  doc.roundedRect(badgeX, y - 5, badgeWidth, 7, 1.5, 1.5, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255)
  doc.text(badgeText, badgeX + badgeWidth / 2, y - 0.5, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  y += 5

  // Date
  const createdAt = new Date(evaluation.created_at)
  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text(`${formatZuluDate(createdAt)} @ ${formatZuluTime(createdAt)}Z`, margin, y)
  y += 8

  // ── Obstruction Details Table ──
  const lat = evaluation.latitude?.toFixed(5) ?? '—'
  const lng = evaluation.longitude ? Math.abs(evaluation.longitude).toFixed(5) : '—'
  const rwClass = evaluation.runway_class === 'Army_B' ? 'Army Class B' : `Class ${evaluation.runway_class}`

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Metric', 'Value']],
    body: [
      ['Height AGL', `${evaluation.object_height_agl} ft`],
      ['Top Elevation MSL', `${evaluation.obstruction_top_msl?.toFixed(0) ?? '—'} ft`],
      ['Ground Elevation MSL', `${evaluation.object_elevation_msl?.toFixed(0) ?? '—'} ft`],
      ['Distance from Centerline', `${evaluation.distance_from_centerline_ft?.toFixed(0) ?? '—'} ft`],
      ['Coordinates', `${lat}\u00b0N, ${lng}\u00b0W`],
      ['Runway Class', rwClass],
    ],
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55, textColor: [100, 116, 139] } },
  })
  y = (doc as any).lastAutoTable.finalY + 6

  // ── Description ──
  if (evaluation.notes) {
    checkPageBreak(16)
    doc.setFontSize(10)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.text('DESCRIPTION', margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(40)
    const lines = doc.splitTextToSize(evaluation.notes, contentWidth)
    doc.text(lines, margin, y)
    y += lines.length * 4 + 6
  }

  // ── Controlling Surface ──
  if (evaluation.controlling_surface) {
    checkPageBreak(14)
    doc.setFontSize(10)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.text('CONTROLLING SURFACE', margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(40)
    doc.text(evaluation.controlling_surface, margin, y)
    y += 8
  }

  // ── Surface Analysis Table ──
  if (applicableResults.length > 0) {
    checkPageBreak(20)
    doc.setFontSize(10)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.text('SURFACE ANALYSIS', margin, y)
    y += 2

    const tableBody = applicableResults.map((s) => {
      const isLandUse = s.maxAllowableHeightMSL === -1
      if (isLandUse) {
        return [s.surfaceName, 'Land Use Zone', '—', 'WITHIN ZONE', '—']
      }
      return [
        s.surfaceName,
        `${s.maxAllowableHeightMSL.toFixed(0)} ft`,
        `${s.obstructionTopMSL.toFixed(0)} ft`,
        s.violated ? 'VIOLATION' : 'CLEAR',
        s.violated ? `${s.penetrationFt.toFixed(1)} ft` : '—',
      ]
    })

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Surface', 'Max Allowable', 'Obs. Top MSL', 'Status', 'Penetration']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 45 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
      },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 3) {
          const val = data.cell.raw
          if (val === 'VIOLATION') {
            data.cell.styles.textColor = [239, 68, 68]
            data.cell.styles.fontStyle = 'bold'
          } else if (val === 'CLEAR') {
            data.cell.styles.textColor = [34, 197, 94]
            data.cell.styles.fontStyle = 'bold'
          } else if (val === 'WITHIN ZONE') {
            data.cell.styles.textColor = [100, 116, 139]
            data.cell.styles.fontStyle = 'bold'
          }
        }
        if (data.section === 'body' && data.column.index === 4) {
          const val = data.cell.raw
          if (val !== '—') {
            data.cell.styles.textColor = [239, 68, 68]
          }
        }
      },
    })
    y = (doc as any).lastAutoTable.finalY + 4

    // UFC references under table
    doc.setFontSize(6.5)
    doc.setTextColor(130)
    for (const s of applicableResults) {
      checkPageBreak(5)
      doc.text(`${s.surfaceName}: ${s.ufcReference}`, margin, y)
      y += 3
    }
    y += 4
  }

  // ── Required Actions ──
  if (violatedResults.length > 0) {
    checkPageBreak(50)
    doc.setFillColor(254, 242, 242)
    doc.setDrawColor(239, 68, 68)
    const actionsBoxY = y
    // Draw box after calculating content height — use a manual layout
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(239, 68, 68)
    doc.text('REQUIRED ACTIONS', margin + 4, y + 6)
    y += 10

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(200, 30, 30)
    doc.text('OBSTRUCTION VIOLATION DETECTED — The following actions are required:', margin + 4, y)
    y += 6

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(40)

    const actions = [
      '1. Submit Work Order to CES (Civil Engineering Squadron) for evaluation and corrective action.',
      '2. Per DAFMAN 13-204 Vol. 1 — Document all known airfield obstructions and coordinate waivers.',
      '3. Per DAFMAN 13-204, Para 1.14 — Coordinate with ATC/RAPCON regarding obstruction impact on flying operations.',
      '4. Coordinate with BCE or Installation Community Planner to process a temporary or permanent waiver as required.',
    ]

    for (const action of actions) {
      const lines = doc.splitTextToSize(action, contentWidth - 10)
      doc.text(lines, margin + 4, y)
      y += lines.length * 3.5 + 2
    }

    y += 2
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(239, 68, 68)
    for (const v of violatedResults) {
      const vLine = `• ${v.surfaceName} — ${v.penetrationFt.toFixed(1)} ft penetration — ${v.ufcReference}`
      const lines = doc.splitTextToSize(vLine, contentWidth - 10)
      doc.text(lines, margin + 4, y)
      y += lines.length * 3.5 + 1
    }

    // Draw border around actions box
    const boxH = y - actionsBoxY + 3
    doc.setFillColor(254, 242, 242)
    doc.setDrawColor(239, 68, 68)
    doc.roundedRect(margin, actionsBoxY, contentWidth, boxH, 2, 2, 'D')

    y += 6
    doc.setTextColor(0)
    doc.setFont('helvetica', 'normal')
  }

  // ── Location Map ──
  let mapDataUrl = input.mapDataUrl ?? null
  if (!mapDataUrl && evaluation.latitude != null && evaluation.longitude != null) {
    mapDataUrl = await fetchMapImageDataUrl(evaluation.latitude, evaluation.longitude)
  }
  if (mapDataUrl) {
    const mapImgHeight = contentWidth * (300 / 600)
    checkPageBreak(mapImgHeight + 15) // map image + title + coordinates
    doc.setFontSize(10)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.text('PINNED LOCATION', margin, y)
    y += 2
    doc.setFont('helvetica', 'normal')
    try {
      const imgWidth = contentWidth
      const imgHeight = imgWidth * (300 / 600)
      doc.addImage(mapDataUrl, 'PNG', margin, y, imgWidth, imgHeight)
      y += imgHeight + 3
      doc.setFontSize(7)
      doc.setTextColor(34, 197, 94)
      doc.setFont('helvetica', 'bold')
      doc.text(`${evaluation.latitude!.toFixed(5)}, ${evaluation.longitude!.toFixed(5)}`, margin, y)
      doc.setFont('helvetica', 'normal')
      y += 6
    } catch {
      doc.setFontSize(7)
      doc.setTextColor(150)
      doc.text('(Map image could not be rendered)', margin, y)
      y += 5
    }
  }

  // ── Photos ──
  if (photoDataUrls.length > 0) {
    checkPageBreak(14)
    y += 2
    doc.setFontSize(10)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.text(`PHOTOS (${photoDataUrls.length})`, margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')

    for (const dataUrl of photoDataUrls) {
      checkPageBreak(55)
      try {
        const format = dataUrl.includes('image/png') ? 'PNG' : 'JPEG'
        const imgWidth = contentWidth * 0.6
        const imgHeight = imgWidth * 0.75
        doc.addImage(dataUrl, format, margin, y, imgWidth, imgHeight)
        y += imgHeight + 4
      } catch {
        doc.setFontSize(7)
        doc.setTextColor(150)
        doc.text('[Photo unavailable]', margin, y)
        y += 5
      }
    }
  }

  // ── Footer on all pages ──
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(150)
    const footerY = pageHeight - 8
    doc.text(
      `${displayId} — Page ${i} of ${totalPages} — Generated ${formatZuluDate(new Date())}`,
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

  const filename = `${displayId}_Obstruction_Evaluation.pdf`
  return { doc, filename }
}
