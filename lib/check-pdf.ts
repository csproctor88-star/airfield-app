import jsPDF from 'jspdf'
import { CHECK_TYPE_CONFIG } from '@/lib/constants'
import type { CheckCommentRow } from '@/lib/supabase/checks'
import { fetchMapImageDataUrl } from '@/lib/utils'

interface CheckPdfInput {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  check: any
  comments: CheckCommentRow[]
  photoDataUrls: string[]
  /** Photo data URLs grouped by issue index */
  photoDataUrlsByIssue?: Record<number, string[]>
  baseName?: string
  baseIcao?: string
}

export async function generateCheckPdf(input: CheckPdfInput) {
  const { check, comments, photoDataUrls, photoDataUrlsByIssue, baseName, baseIcao } = input
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

  const typeConfig = CHECK_TYPE_CONFIG[check.check_type as keyof typeof CHECK_TYPE_CONFIG]
  const data = (check.data || {}) as Record<string, unknown>
  const completedBy = String(check.completed_by || 'Unknown')
  const displayId = String(check.display_id || '')
  const checkAreas: string[] = Array.isArray(check.areas) ? check.areas.map(String) : []

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
  doc.text('AIRFIELD CHECK REPORT', margin, y)
  y += 7

  doc.setFontSize(11)
  doc.setTextColor(60)
  doc.text(displayId, margin, y)
  y += 8

  // ── Info box ──
  doc.setDrawColor(200)
  doc.setFillColor(248, 248, 248)
  doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'FD')

  const col1 = margin + 4
  const col2 = margin + contentWidth / 3
  const col3 = margin + (contentWidth * 2) / 3

  doc.setFontSize(7)
  doc.setTextColor(120)
  doc.text('Check Type:', col1, y + 5)
  doc.text('Completed By:', col2, y + 5)
  doc.text('Date:', col3, y + 5)

  doc.setFontSize(9)
  doc.setTextColor(0)
  doc.text(typeConfig?.label || check.check_type, col1, y + 10)
  doc.text(completedBy, col2, y + 10)

  const completedAt = check.completed_at ? String(check.completed_at) : null
  if (completedAt) {
    const d = new Date(completedAt)
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    doc.text(`${dateStr} @ ${timeStr}`, col3, y + 10)
  } else {
    doc.text('N/A', col3, y + 10)
  }

  y += 24

  // ── Areas Checked ──
  if (checkAreas.length > 0) {
    doc.setFontSize(10)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.text('AREAS CHECKED', margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(40)
    doc.text(checkAreas.join(', '), margin, y)
    y += 8
  }

  // ── Type-specific details ──
  checkPageBreak(20)
  doc.setFontSize(10)
  doc.setTextColor(0)
  doc.setFont('helvetica', 'bold')
  doc.text('DETAILS', margin, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(40)

  switch (check.check_type) {
    case 'fod':
      doc.text('FOD Check completed. See remarks for details.', margin, y)
      y += 6
      break

    case 'rsc':
      doc.text(`Runway Surface Condition: ${(data.condition as string) || 'N/A'}`, margin, y)
      y += 6
      break

    case 'rcr':
      doc.text(`RCR Value: ${(data.rcr_value as string) || 'N/A'}`, margin, y)
      y += 5
      doc.text(`Condition: ${(data.condition_type as string) || 'N/A'}`, margin, y)
      y += 6
      break

    case 'bash': {
      const condCode = (data.condition_code as string) || 'N/A'
      doc.text(`Condition Code: ${condCode}`, margin, y)
      y += 5
      if (data.species_observed) {
        const speciesLines = doc.splitTextToSize(`Species Observed: ${data.species_observed}`, contentWidth)
        doc.text(speciesLines, margin, y)
        y += speciesLines.length * 4 + 2
      }
      break
    }

    case 'ife': {
      if (data.aircraft_type) {
        doc.text(`Aircraft Type: ${data.aircraft_type}`, margin, y)
        y += 5
      }
      if (data.callsign) {
        doc.text(`Callsign: ${data.callsign}`, margin, y)
        y += 5
      }
      if (data.nature) {
        const natureLines = doc.splitTextToSize(`Nature: ${data.nature}`, contentWidth)
        doc.text(natureLines, margin, y)
        y += natureLines.length * 4 + 2
      }
      if (Array.isArray(data.actions) && (data.actions as string[]).length > 0) {
        y += 2
        doc.setFont('helvetica', 'bold')
        doc.text('AM Actions Completed:', margin, y)
        y += 5
        doc.setFont('helvetica', 'normal')
        for (const action of data.actions as string[]) {
          checkPageBreak(5)
          doc.text(`  \u2713 ${action}`, margin, y)
          y += 4
        }
        y += 2
      }
      if (Array.isArray(data.agencies_notified) && (data.agencies_notified as string[]).length > 0) {
        doc.setFont('helvetica', 'bold')
        doc.text('Agencies Notified:', margin, y)
        y += 5
        doc.setFont('helvetica', 'normal')
        doc.text((data.agencies_notified as string[]).join(', '), margin, y)
        y += 6
      }
      break
    }

    case 'ground_emergency': {
      if (data.aircraft_type) {
        doc.text(`Aircraft Type: ${data.aircraft_type}`, margin, y)
        y += 5
      }
      if (data.nature) {
        const natureLines = doc.splitTextToSize(`Nature: ${data.nature}`, contentWidth)
        doc.text(natureLines, margin, y)
        y += natureLines.length * 4 + 2
      }
      if (Array.isArray(data.actions) && (data.actions as string[]).length > 0) {
        y += 2
        doc.setFont('helvetica', 'bold')
        doc.text('AM Actions Completed:', margin, y)
        y += 5
        doc.setFont('helvetica', 'normal')
        for (const action of data.actions as string[]) {
          checkPageBreak(5)
          doc.text(`  \u2713 ${action}`, margin, y)
          y += 4
        }
        y += 2
      }
      if (Array.isArray(data.agencies_notified) && (data.agencies_notified as string[]).length > 0) {
        doc.setFont('helvetica', 'bold')
        doc.text('Agencies Notified:', margin, y)
        y += 5
        doc.setFont('helvetica', 'normal')
        doc.text((data.agencies_notified as string[]).join(', '), margin, y)
        y += 6
      }
      break
    }

    case 'heavy_aircraft':
      doc.text(`Aircraft Type / MDS: ${(data.aircraft_type as string) || 'N/A'}`, margin, y)
      y += 6
      break

    default:
      doc.text('Check completed.', margin, y)
      y += 6
  }

  // ── Issues / Location ──
  const issuesArr = Array.isArray(data.issues) ? (data.issues as { comment: string; location: { lat: number; lon: number } | null }[]) : []
  if (issuesArr.length > 0) {
    checkPageBreak(16)
    y += 2
    doc.setFontSize(10)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.text(`ISSUES FOUND (${issuesArr.length})`, margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')

    for (let ii = 0; ii < issuesArr.length; ii++) {
      const issue = issuesArr[ii]
      checkPageBreak(16)

      if (issuesArr.length > 1) {
        doc.setFontSize(9)
        doc.setTextColor(200, 0, 0)
        doc.text(`Issue ${ii + 1} of ${issuesArr.length}:`, margin, y)
        y += 5
      }

      if (issue.comment) {
        doc.setFontSize(9)
        doc.setTextColor(40)
        const commentLines = doc.splitTextToSize(issue.comment, contentWidth)
        doc.text(commentLines, margin, y)
        y += commentLines.length * 4 + 2
      }

      if (issue.location) {
        checkPageBreak(50)
        doc.setFontSize(9)
        doc.setTextColor(40)
        doc.text(`Coordinates: ${issue.location.lat.toFixed(5)}, ${issue.location.lon.toFixed(5)}`, margin, y)
        y += 5
        const mapDataUrl = await fetchMapImageDataUrl(issue.location.lat, issue.location.lon)
        if (mapDataUrl) {
          try {
            doc.addImage(mapDataUrl, 'PNG', margin, y, 80, 40)
            y += 44
          } catch {
            y += 4
          }
        }
      }

      // Per-issue photos
      const issuePhotos = photoDataUrlsByIssue?.[ii]
      if (issuePhotos && issuePhotos.length > 0) {
        checkPageBreak(14)
        doc.setFontSize(8)
        doc.setTextColor(100)
        doc.text(`Photos (${issuePhotos.length}):`, margin, y)
        y += 5
        for (const dataUrl of issuePhotos) {
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

      y += 2
    }
  } else {
    // Legacy single location
    const lat = check.latitude != null ? Number(check.latitude) : null
    const lng = check.longitude != null ? Number(check.longitude) : null
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

      const mapDataUrl = await fetchMapImageDataUrl(lat, lng)
      if (mapDataUrl) {
        try {
          doc.addImage(mapDataUrl, 'PNG', margin, y, 80, 40)
          y += 44
        } catch {
          y += 4
        }
      } else {
        y += 4
      }
    }
  }

  // ── Remarks ──
  if (comments.length > 0) {
    checkPageBreak(14)
    y += 2
    doc.setFontSize(10)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.text('REMARKS', margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')

    for (const c of comments) {
      checkPageBreak(12)
      doc.setFontSize(8)
      doc.setTextColor(100)
      const dateStr = new Date(c.created_at).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
      doc.text(`${c.user_name} — ${dateStr}`, margin, y)
      y += 4
      doc.setFontSize(9)
      doc.setTextColor(40)
      const lines = doc.splitTextToSize(c.comment, contentWidth)
      doc.text(lines, margin, y)
      y += lines.length * 4 + 3
    }
  }

  // ── Photos (unlinked / legacy only) ──
  // Per-issue photos are rendered inline above; this section shows photos not tied to an issue
  const linkedIndexes = new Set(Object.keys(photoDataUrlsByIssue || {}).map(Number))
  // If we have per-issue grouping, only show truly unlinked photos here
  // photoDataUrls is the flat list; we treat all as unlinked when no grouping exists
  const hasGrouping = linkedIndexes.size > 0
  const unlinkedPhotoUrls = hasGrouping ? [] as string[] : photoDataUrls
  if (unlinkedPhotoUrls.length > 0) {
    checkPageBreak(14)
    y += 4
    doc.setFontSize(10)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.text(`PHOTOS (${unlinkedPhotoUrls.length})`, margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')

    for (const dataUrl of unlinkedPhotoUrls) {
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
      `${displayId} — Page ${i} of ${totalPages} — Generated ${new Date().toLocaleDateString('en-US')}`,
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

  const filename = `${displayId}_Check_Report.pdf`
  return { doc, filename }
}
