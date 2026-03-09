import jsPDF from 'jspdf'
import type { ObstructionRow } from '@/lib/supabase/obstructions'
import { parsePhotoPaths } from '@/lib/supabase/obstructions'
import { formatZuluTime, formatZuluDate } from '@/lib/utils'

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
  baseName?: string
  baseIcao?: string
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
  y += 5

  // Status
  const createdAt = new Date(evaluation.created_at)
  doc.setFontSize(9)
  doc.text(`${formatZuluDate(createdAt)} @ ${formatZuluTime(createdAt)}Z`, margin, y)
  y += 8

  // ── Status Badge ──
  doc.setDrawColor(200)
  if (evaluation.has_violation) {
    doc.setFillColor(239, 68, 68)
  } else {
    doc.setFillColor(34, 197, 94)
  }
  doc.roundedRect(margin, y, 30, 7, 1, 1, 'F')
  doc.setFontSize(9)
  doc.setTextColor(255)
  doc.setFont('helvetica', 'bold')
  doc.text(evaluation.has_violation ? 'VIOLATION' : 'CLEAR', margin + 15, y + 5, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  y += 14

  // ── Obstruction Details ──
  doc.setDrawColor(200)
  doc.setFillColor(248, 248, 248)
  doc.roundedRect(margin, y, contentWidth, 32, 2, 2, 'FD')

  const col1 = margin + 4
  const col2 = margin + contentWidth / 3
  const col3 = margin + (contentWidth * 2) / 3

  doc.setFontSize(7)
  doc.setTextColor(120)
  doc.text('Height AGL:', col1, y + 5)
  doc.text('Top Elevation MSL:', col2, y + 5)
  doc.text('Ground Elevation MSL:', col3, y + 5)

  doc.setFontSize(9)
  doc.setTextColor(0)
  doc.text(`${evaluation.object_height_agl} ft`, col1, y + 10)
  doc.text(`${evaluation.obstruction_top_msl?.toFixed(0) ?? '—'} ft`, col2, y + 10)
  doc.text(`${evaluation.object_elevation_msl?.toFixed(0) ?? '—'} ft`, col3, y + 10)

  doc.setFontSize(7)
  doc.setTextColor(120)
  doc.text('From Centerline:', col1, y + 18)
  doc.text('Coordinates:', col2, y + 18)
  doc.text('Runway Class:', col3, y + 18)

  doc.setFontSize(9)
  doc.setTextColor(0)
  doc.text(`${evaluation.distance_from_centerline_ft?.toFixed(0) ?? '—'} ft`, col1, y + 23)
  const lat = evaluation.latitude?.toFixed(5) ?? '—'
  const lng = evaluation.longitude ? Math.abs(evaluation.longitude).toFixed(5) : '—'
  doc.text(`${lat}°N, ${lng}°W`, col2, y + 23)
  const rwClass = evaluation.runway_class === 'Army_B' ? 'Army Class B' : `Class ${evaluation.runway_class}`
  doc.text(rwClass, col3, y + 23)

  y += 38

  // ── Notes / Description ──
  if (evaluation.notes) {
    checkPageBreak(14)
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
    y += lines.length * 4 + 4
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
    y += 6

    // Table header
    doc.setFillColor(240, 240, 240)
    doc.rect(margin, y, contentWidth, 6, 'F')
    doc.setFontSize(7)
    doc.setTextColor(80)
    doc.setFont('helvetica', 'bold')
    const cSurface = margin + 2
    const cMaxAllow = margin + 70
    const cObsTop = margin + 105
    const cStatus = margin + 135
    const cPen = margin + 160
    doc.text('Surface', cSurface, y + 4)
    doc.text('Max Allowable', cMaxAllow, y + 4)
    doc.text('Obs. Top MSL', cObsTop, y + 4)
    doc.text('Status', cStatus, y + 4)
    doc.text('Penetration', cPen, y + 4)
    y += 8

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)

    for (const s of applicableResults) {
      checkPageBreak(7)
      const isLandUse = s.maxAllowableHeightMSL === -1

      doc.setTextColor(0)
      doc.text(s.surfaceName, cSurface, y)

      if (isLandUse) {
        doc.setTextColor(100)
        doc.text('Land Use Zone', cMaxAllow, y)
        doc.text('—', cObsTop, y)
        doc.text('WITHIN ZONE', cStatus, y)
        doc.text('—', cPen, y)
      } else {
        doc.setTextColor(40)
        doc.text(`${s.maxAllowableHeightMSL.toFixed(0)} ft`, cMaxAllow, y)
        doc.text(`${s.obstructionTopMSL.toFixed(0)} ft`, cObsTop, y)
        if (s.violated) {
          doc.setTextColor(239, 68, 68)
          doc.text('VIOLATION', cStatus, y)
          doc.text(`${s.penetrationFt.toFixed(1)} ft`, cPen, y)
        } else {
          doc.setTextColor(34, 197, 94)
          doc.text('CLEAR', cStatus, y)
          doc.setTextColor(40)
          doc.text('—', cPen, y)
        }
      }

      y += 5

      // UFC reference
      doc.setFontSize(6)
      doc.setTextColor(120)
      doc.text(s.ufcReference, cSurface, y)
      y += 4
      doc.setFontSize(8)
    }
    y += 2
  }

  // ── Required Actions ──
  if (violatedResults.length > 0) {
    checkPageBreak(40)
    doc.setFontSize(10)
    doc.setTextColor(239, 68, 68)
    doc.setFont('helvetica', 'bold')
    doc.text('REQUIRED ACTIONS', margin, y)
    y += 6

    doc.setFontSize(9)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'normal')

    const actions = [
      '1. Submit Work Order to CES (Civil Engineering Squadron) for evaluation and corrective action.',
      '2. Per DAFMAN 13-204 Vol. 1 — Document all known airfield obstructions and coordinate waivers.',
      '3. Per DAFMAN 13-204, Para 1.14 — Coordinate with ATC/RAPCON regarding obstruction impact on flying operations.',
      '4. Coordinate with BCE or Installation Community Planner to process a temporary or permanent waiver as required.',
    ]

    for (const action of actions) {
      checkPageBreak(6)
      const lines = doc.splitTextToSize(action, contentWidth)
      doc.text(lines, margin, y)
      y += lines.length * 4 + 1
    }

    y += 2
    for (const v of violatedResults) {
      checkPageBreak(6)
      const vLine = `${v.surfaceName} violation (${v.penetrationFt.toFixed(1)} ft) — ${v.ufcReference}`
      const lines = doc.splitTextToSize(vLine, contentWidth)
      doc.setTextColor(239, 68, 68)
      doc.text(lines, margin, y)
      y += lines.length * 4 + 1
    }
    doc.setTextColor(0)
    y += 4
  }

  // ── Photos ──
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

  // ── Footer on all pages ──
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
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
