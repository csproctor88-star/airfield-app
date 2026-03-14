import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ACSI_CHECKLIST_SECTIONS } from '@/lib/constants'
import { formatZuluDateTime } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { fetchAcsiPhotos } from '@/lib/supabase/acsi-inspections'
import type { AcsiInspection, AcsiItem } from '@/lib/supabase/types'

interface AcsiPdfOptions {
  baseName?: string
  baseIcao?: string
  baseId?: string | null
}

/** Fetch a Mapbox static map as data URL — no logos/attribution */
async function fetchCleanMapDataUrl(lat: number, lng: number): Promise<string | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token || token === 'your-mapbox-token-here') return null
  try {
    const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/pin-l+ef4444(${lng},${lat})/${lng},${lat},16,0/600x300@2x?access_token=${token}&logo=false&attribution=false`
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** Fetch an image URL as a data URL for PDF embedding */
async function fetchImageAsDataUrl(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// Photo/map thumbnail constants
const THUMB_W = 30
const THUMB_H = 22.5
const THUMB_GAP = 2
const THUMB_PAD = 2

/** Pre-fetched images for a single discrepancy */
interface DiscImages {
  photos: (string | null)[]    // data URLs
  maps: (string | null)[]      // data URLs
}

/** Calculate cell height needed for a discrepancy detail row */
function detailRowHeight(textLineCount: number, images: DiscImages, cellWidth: number): number {
  const textH = Math.max(0, textLineCount * 3.5) + 4 // text + padding
  const totalImages = images.photos.filter(Boolean).length + images.maps.filter(Boolean).length
  if (totalImages === 0) return textH + 4

  const availW = cellWidth - THUMB_PAD * 2
  const perRow = Math.max(1, Math.floor(availW / (THUMB_W + THUMB_GAP)))
  const rows = Math.ceil(totalImages / perRow)
  const imgH = rows * THUMB_H + (rows - 1) * THUMB_GAP + THUMB_PAD * 2

  return textH + imgH + 4
}

/** Draw images inside a cell at given position */
function drawImagesInCell(
  doc: jsPDF,
  images: (string | null)[],
  startX: number,
  startY: number,
  cellWidth: number,
) {
  const availW = cellWidth - THUMB_PAD * 2
  const perRow = Math.max(1, Math.floor(availW / (THUMB_W + THUMB_GAP)))
  let xOff = startX + THUMB_PAD
  let yOff = startY

  let col = 0
  for (const dataUrl of images) {
    if (!dataUrl) continue
    if (col > 0 && col % perRow === 0) {
      yOff += THUMB_H + THUMB_GAP
      xOff = startX + THUMB_PAD
    }
    const format = dataUrl.includes('image/png') ? 'PNG' : 'JPEG'
    try {
      doc.addImage(dataUrl, format, xOff, yOff, THUMB_W, THUMB_H)
    } catch {
      doc.setDrawColor(180)
      doc.rect(xOff, yOff, THUMB_W, THUMB_H)
    }
    xOff += THUMB_W + THUMB_GAP
    col++
  }
}

export async function generateAcsiPdf(
  inspection: AcsiInspection,
  opts: AcsiPdfOptions,
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = margin

  function checkPageBreak(needed: number) {
    if (y + needed > pageHeight - 18) {
      doc.addPage()
      y = margin
    }
  }

  function sectionHeader(title: string) {
    checkPageBreak(16)
    y += 2 // Extra breathing room above section headers
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0)
    doc.text(title, margin, y)
    y += 1
    doc.setDrawColor(0)
    doc.setLineWidth(0.4)
    doc.line(margin, y, margin + contentWidth, y)
    y += 5
    doc.setFont('helvetica', 'normal')
  }

  // ── Pre-fetch photos grouped by item_id ──
  const photosByItem: Record<string, { url: string; name: string }[]> = {}
  if (inspection.id) {
    try {
      const photos = await fetchAcsiPhotos(inspection.id)
      const supabase = createClient()
      for (const photo of photos) {
        const itemKey = photo.acsi_item_id || '_general'
        if (!photosByItem[itemKey]) photosByItem[itemKey] = []
        let url = ''
        if (photo.storage_path.startsWith('data:')) {
          url = photo.storage_path
        } else if (supabase) {
          const { data: urlData } = supabase.storage.from('photos').getPublicUrl(photo.storage_path)
          if (urlData?.publicUrl) url = urlData.publicUrl
        }
        if (url) photosByItem[itemKey].push({ url, name: photo.file_name })
      }
    } catch {
      // Continue without photos
    }
  }

  // ── HEADER ──
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text(opts.baseName ? `${opts.baseName.toUpperCase()}${opts.baseIcao ? ` (${opts.baseIcao})` : ''}` : 'AIRFIELD OPERATIONS', margin, y)
  y += 4
  doc.text('AIRFIELD MANAGEMENT SECTION', margin, y)
  y += 8

  doc.setFontSize(16)
  doc.setTextColor(0)
  doc.setFont('helvetica', 'bold')
  doc.text('AIRFIELD COMPLIANCE & SAFETY INSPECTION', margin, y)
  y += 7

  doc.setFontSize(11)
  doc.setTextColor(60)
  doc.setFont('helvetica', 'normal')
  doc.text(`${inspection.display_id}`, margin, y)
  y += 5
  doc.setFontSize(9)
  doc.text('DAFMAN 13-204v2, Para 5.4.3', margin, y)
  y += 8

  // ── Info box ──
  const infoBoxH = 26
  doc.setDrawColor(200)
  doc.setFillColor(248, 248, 248)
  doc.roundedRect(margin, y, contentWidth, infoBoxH, 2, 2, 'FD')
  const ic1 = margin + 4
  const ic2 = margin + contentWidth / 3
  const ic3 = margin + (contentWidth * 2) / 3

  doc.setFontSize(7)
  doc.setTextColor(120)
  doc.text('Airfield:', ic1, y + 5)
  doc.text('Inspection Date:', ic2, y + 5)
  doc.text('Year:', ic3, y + 5)
  doc.setFontSize(9)
  doc.setTextColor(0)
  doc.text(inspection.airfield_name || '—', ic1, y + 11)
  doc.text(inspection.inspection_date || '—', ic2, y + 11)
  doc.text(String(inspection.fiscal_year || '—'), ic3, y + 11)
  doc.setFontSize(7)
  doc.setTextColor(120)
  doc.text('Status:', ic1, y + 17)
  doc.text('Inspector:', ic2, y + 17)
  doc.setFontSize(9)
  doc.setTextColor(0)
  doc.text(inspection.status.toUpperCase(), ic1, y + 23)
  doc.text(inspection.inspector_name || '—', ic2, y + 23)
  y += infoBoxH + 6

  // ── KPI Summary ──
  sectionHeader('SUMMARY')
  doc.setFontSize(9)
  doc.setTextColor(0)
  const total = inspection.passed_count + inspection.failed_count + inspection.na_count
  const pct = inspection.total_items > 0 ? Math.round((total / inspection.total_items) * 100) : 0
  doc.text(`Total Items: ${inspection.total_items}    |    Passed: ${inspection.passed_count}    |    Failed: ${inspection.failed_count}    |    N/A: ${inspection.na_count}    |    Completion: ${pct}%`, margin, y)
  y += 8

  // ── Checklist Sections ──
  const itemsBySection: Record<string, AcsiItem[]> = {}
  for (const item of (inspection.items || [])) {
    const key = item.section_id || 'unknown'
    if (!itemsBySection[key]) itemsBySection[key] = []
    itemsBySection[key].push(item)
  }

  const colNum = 18
  const colResp = 20
  const colItem = contentWidth - colNum - colResp
  const isSubField = (n: string) => /\.[a-c]$/.test(n)
  /** Extract parent id from a sub-field: "5.5.1.a" → "5.5.1" */
  const parentId = (n: string) => n.replace(/\.[a-c]$/, '')

  const responseLabel = (r: string | null) => {
    if (r === 'pass') return 'Y'
    if (r === 'fail') return 'N'
    if (r === 'na') return 'N/A'
    return '—'
  }

  for (const section of ACSI_CHECKLIST_SECTIONS) {
    const sectionItems = itemsBySection[section.id] || []
    if (sectionItems.length === 0) continue

    sectionHeader(`SECTION ${section.number} — ${section.title.toUpperCase()}`)

    doc.setFontSize(8)
    doc.setTextColor(80)
    doc.text(section.reference, margin, y)
    y += 4

    if (section.scope) {
      const scopeLines = doc.splitTextToSize(`Scope: ${section.scope}`, contentWidth)
      doc.text(scopeLines, margin, y)
      y += scopeLines.length * 3.5 + 2
    }

    const passCount = sectionItems.filter(i => i.response === 'pass').length
    const failCount = sectionItems.filter(i => i.response === 'fail').length
    const naCount = sectionItems.filter(i => i.response === 'na').length
    doc.setFontSize(8)
    doc.setTextColor(0)
    doc.text(`Pass: ${passCount}   Fail: ${failCount}   N/A: ${naCount}   Total: ${sectionItems.length}`, margin, y)
    y += 5

    // ── Pre-fetch all images for failed items in this section ──
    const discImagesMap: Record<string, DiscImages> = {}
    const discTextMap: Record<string, string[]> = {}

    for (const item of sectionItems) {
      if (item.response !== 'fail') continue
      const discs = item.discrepancies?.length ? item.discrepancies : item.discrepancy ? [item.discrepancy] : []
      if (discs.length === 0) continue

      for (let di = 0; di < discs.length; di++) {
        const disc = discs[di]
        const detailKey = `${item.id}:${di}`

        // Build text lines
        const lines: string[] = []
        if (disc.comment) lines.push(`Comment: ${disc.comment}`)
        if (disc.work_order) lines.push(`WO: ${disc.work_order}`)
        if (disc.project_number) lines.push(`Project: ${disc.project_number}`)
        if (disc.estimated_cost) lines.push(`Cost: ${disc.estimated_cost}`)
        if (disc.estimated_completion) lines.push(`ECD: ${disc.estimated_completion}`)
        if (disc.areas && disc.areas.length > 0) lines.push(`Areas: ${disc.areas.join(', ')}`)
        discTextMap[detailKey] = lines

        // Fetch photo data URLs — check both keyed and legacy format
        const keyedPhotos = photosByItem[detailKey] || []
        const legacyPhotos = di === 0 ? (photosByItem[item.id] || []) : []
        const allPhotos = [...keyedPhotos, ...legacyPhotos]
        const photoDataUrls: (string | null)[] = []
        for (const p of allPhotos) {
          photoDataUrls.push(await fetchImageAsDataUrl(p.url))
        }

        // Fetch map data URLs for each discrepancy's own pins
        const mapDataUrls: (string | null)[] = []
        const pins = disc.pins || []
        if (pins.length === 0 && disc.latitude != null && disc.longitude != null) {
          pins.push({ lat: disc.latitude, lng: disc.longitude })
        }
        for (const pin of pins) {
          mapDataUrls.push(await fetchCleanMapDataUrl(pin.lat, pin.lng))
        }

        discImagesMap[detailKey] = { photos: photoDataUrls, maps: mapDataUrls }
      }
    }

    // ── Build table rows: parent headers + sub-field items + detail rows ──
    type RowMeta =
      | { type: 'item'; item: AcsiItem; idx: number }
      | { type: 'parent'; parentNum: string; parentQuestion: string }
      | { type: 'detail'; item: AcsiItem; discIndex: number; detailKey: string }
    const rowMeta: RowMeta[] = []
    const tableBody: string[][] = []
    let itemIdx = 0
    let lastParent = ''

    for (const item of sectionItems) {
      const sub = isSubField(item.item_number)

      if (sub) {
        // Insert a parent header row when we encounter a new group (e.g., first 5.5.1.a)
        const pid = parentId(item.item_number)
        if (pid !== lastParent) {
          lastParent = pid
          // Extract the parent question: "ALSF-1 — (A) Operable" → "ALSF-1"
          const pQuestion = item.question.replace(/\s*—\s*\([A-C]\).*$/i, '')
          tableBody.push([pid, pQuestion, ''])
          rowMeta.push({ type: 'parent', parentNum: pid, parentQuestion: pQuestion })
        }

        // Sub-field row: empty # column, show only the (A)/(B)/(C) label
        const sfLabel = item.question.replace(/^.*?—\s*/, '')
        tableBody.push(['', sfLabel, responseLabel(item.response)])
      } else {
        lastParent = ''
        tableBody.push([item.item_number, item.question, responseLabel(item.response)])
      }
      rowMeta.push({ type: 'item', item, idx: itemIdx++ })

      // Insert detail rows after fail items (one per discrepancy)
      if (item.response === 'fail') {
        const discs = item.discrepancies?.length ? item.discrepancies : item.discrepancy ? [item.discrepancy] : []
        for (let di = 0; di < discs.length; di++) {
          const detailKey = `${item.id}:${di}`
          tableBody.push(['', '', ''])
          rowMeta.push({ type: 'detail', item, discIndex: di, detailKey })
        }
      }
    }

    autoTable(doc, {
      startY: y,
      head: [['#', 'Item', 'Response']],
      body: tableBody,
      margin: { left: margin, right: margin, bottom: 18 },
      rowPageBreak: 'avoid',
      showHead: 'everyPage',
      columnStyles: {
        0: { cellWidth: colNum, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: colItem },
        2: { cellWidth: colResp, halign: 'center', fontStyle: 'bold' },
      },
      styles: { fontSize: 8, cellPadding: 2.5, lineColor: [220, 220, 220], lineWidth: 0.2 },
      headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },

      didParseCell: (data) => {
        if (data.section !== 'body') return
        const meta = rowMeta[data.row.index]
        if (!meta) return

        // Parent header row (e.g., "5.5.1  ALSF-1") — bold, no response
        if (meta.type === 'parent') {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fontSize = 8
          data.cell.styles.textColor = [0, 0, 0]
          data.cell.styles.fillColor = [245, 245, 250]
          if (data.column.index === 2) {
            data.cell.text = [''] // no response for parent row
          }
          return
        }

        if (meta.type === 'item') {
          // Fail item rows: light red
          if (meta.item.response === 'fail') {
            data.cell.styles.fillColor = [255, 235, 235]
          }
          // Sub-field rows: deeply indented to match form layout
          if (isSubField(meta.item.item_number)) {
            data.cell.styles.fontSize = 7.5
            data.cell.styles.textColor = [80, 80, 80]
            data.cell.styles.cellPadding = { top: 1.5, right: 2, bottom: 1.5, left: 2.5 }
            if (data.column.index === 0) {
              // Right-align # in its column, with extra left padding to push it inward
              data.cell.styles.halign = 'right'
              data.cell.styles.fontSize = 6.5
              data.cell.styles.cellPadding = { top: 1.5, right: 1, bottom: 1.5, left: 3 }
            }
            if (data.column.index === 1) {
              // Heavy left indent — matches the form's marginLeft: 28px indentation
              data.cell.styles.cellPadding = { top: 1.5, right: 2.5, bottom: 1.5, left: 14 }
            }
          }
          // Response color
          if (data.column.index === 2) {
            const val = String(data.cell.raw)
            if (val === 'Y') data.cell.styles.textColor = [16, 185, 129]
            else if (val === 'N') data.cell.styles.textColor = [239, 68, 68]
            else if (val === 'N/A') data.cell.styles.textColor = [107, 114, 128]
          }
        }

        if (meta.type === 'detail') {
          // Detail row: red-tinted background, calculate height for images
          data.cell.styles.fillColor = [255, 240, 240]
          data.cell.styles.fontSize = 7
          data.cell.styles.textColor = [80, 80, 80]

          const images = discImagesMap[meta.detailKey]
          const textLines = discTextMap[meta.detailKey] || []
          const wrapped = doc.splitTextToSize(textLines.join('\n'), colItem - 4)
          const lineCount = Array.isArray(wrapped) ? wrapped.length : 1
          if (images) {
            data.cell.styles.minCellHeight = detailRowHeight(lineCount, images, colItem)
          }
        }
      },

      didDrawCell: (data) => {
        if (data.section !== 'body') return
        const meta = rowMeta[data.row.index]
        if (!meta || meta.type !== 'detail') return
        if (data.column.index !== 1) return

        // Draw discrepancy text and images in the detail row's Item column
        const images = discImagesMap[meta.detailKey]
        const textLines = discTextMap[meta.detailKey] || []
        const cellX = data.cell.x
        const cellY = data.cell.y
        const cellW = data.cell.width

        // Draw header — show number when multiple discrepancies
        const discs = meta.item.discrepancies?.length ? meta.item.discrepancies : meta.item.discrepancy ? [meta.item.discrepancy] : []
        const label = discs.length > 1
          ? `DISCREPANCY ${meta.discIndex + 1} — ${meta.item.item_number}`
          : `DISCREPANCY — ${meta.item.item_number}`
        doc.setFontSize(7)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(239, 68, 68)
        doc.text(label, cellX + 2, cellY + 4)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(80)

        // Draw detail text
        let textY = cellY + 8
        doc.setFontSize(7)
        for (const line of textLines) {
          const wrapped = doc.splitTextToSize(line, cellW - 6)
          doc.text(wrapped, cellX + 3, textY)
          textY += (Array.isArray(wrapped) ? wrapped.length : 1) * 3
        }

        // Draw photos + maps
        if (images) {
          const allImages = [
            ...images.photos.filter(Boolean),
            ...images.maps.filter(Boolean),
          ] as string[]

          if (allImages.length > 0) {
            textY += 2
            drawImagesInCell(doc, allImages, cellX, textY, cellW)
          }
        }
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8
  }

  // ── Inspection Team ──
  if (inspection.inspection_team && inspection.inspection_team.length > 0) {
    sectionHeader('INSPECTION TEAM')

    const boxH = 32
    const sigLineW = 70
    const dateLineW = 35

    for (const member of inspection.inspection_team) {
      checkPageBreak(boxH + 6)

      // Box border
      doc.setDrawColor(180)
      doc.setLineWidth(0.3)
      doc.setFillColor(252, 252, 252)
      doc.roundedRect(margin, y, contentWidth, boxH, 2, 2, 'FD')

      // Role/title label
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0)
      doc.text(member.title || member.role || 'Team Member', margin + 5, y + 6)

      // Name + rank
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60)
      const nameStr = [member.rank, member.name].filter(Boolean).join(' ') || '(not assigned)'
      doc.text(nameStr, margin + 5, y + 11)

      // Signature line
      const sigY = y + boxH - 7
      doc.setDrawColor(120)
      doc.setLineWidth(0.4)
      doc.line(margin + 5, sigY, margin + 5 + sigLineW, sigY)
      doc.setFontSize(6.5)
      doc.setTextColor(130)
      doc.text('Signature', margin + 5, sigY + 3.5)

      // Date line
      const dateX = margin + contentWidth - dateLineW - 5
      doc.line(dateX, sigY, dateX + dateLineW, sigY)
      doc.text('Date', dateX, sigY + 3.5)

      y += boxH + 4
    }
    y += 4
  }

  // ── Risk Management Certification ──
  if (inspection.risk_cert_signatures && inspection.risk_cert_signatures.length > 0) {
    sectionHeader('RISK MANAGEMENT CERTIFICATION')

    doc.setFontSize(8)
    doc.setTextColor(40)
    doc.setFont('helvetica', 'italic')
    const certText = '"I have reviewed the results of the Airfield Compliance and Safety Inspection and have determined it to be accurate and the deficiencies noted have acceptable risk control measures and determined to be the minimum acceptable risk."'
    const certLines = doc.splitTextToSize(certText, contentWidth)
    doc.text(certLines, margin, y)
    y += certLines.length * 3.5 + 6
    doc.setFont('helvetica', 'normal')

    const boxH = 36
    const sigLineW = 70
    const dateLineW = 35

    for (const sig of inspection.risk_cert_signatures) {
      checkPageBreak(boxH + 6)

      // Box border
      doc.setDrawColor(180)
      doc.setLineWidth(0.3)
      doc.setFillColor(252, 252, 252)
      doc.roundedRect(margin, y, contentWidth, boxH, 2, 2, 'FD')

      // Label (role)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0)
      doc.text(sig.label || 'Reviewer', margin + 5, y + 6)

      // Name, rank, org, title on second line
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60)
      const parts = [sig.rank, sig.name].filter(Boolean).join(' ')
      const orgTitle = [sig.organization, sig.title].filter(Boolean).join(' — ')
      const detail = [parts, orgTitle].filter(Boolean).join('  |  ')
      doc.text(detail || '(not assigned)', margin + 5, y + 11)

      // Signature line
      const sigY = y + boxH - 7
      doc.setDrawColor(120)
      doc.setLineWidth(0.4)
      doc.line(margin + 5, sigY, margin + 5 + sigLineW, sigY)
      doc.setFontSize(6.5)
      doc.setTextColor(130)
      doc.text('Signature', margin + 5, sigY + 3.5)

      // Date line
      const dateX = margin + contentWidth - dateLineW - 5
      doc.line(dateX, sigY, dateX + dateLineW, sigY)
      doc.text('Date', dateX, sigY + 3.5)

      y += boxH + 4
    }
  }

  // ── Notes ──
  if (inspection.notes) {
    sectionHeader('GENERAL NOTES')
    doc.setFontSize(8)
    doc.setTextColor(0)
    const noteLines = doc.splitTextToSize(inspection.notes, contentWidth)
    for (const line of noteLines) {
      checkPageBreak(4)
      doc.text(line, margin, y)
      y += 3.5
    }
    y += 4
  }

  // ── Page numbers + footer on every page ──
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 6, { align: 'center' })
    if (i === totalPages) {
      doc.setFontSize(7)
      doc.text(`Generated by GLIDEPATH — ${formatZuluDateTime(new Date())}`, margin, pageHeight - 10)
    }
  }

  const filename = `${inspection.display_id || 'ACSI'}_Report.pdf`
  return { doc, filename }
}
