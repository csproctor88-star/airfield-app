import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { sanitizePdfText } from '@/lib/pdf-config'
import {
  FORM_483_LABELS,
  DRIVING_RESULT_LABELS,
  VEHICLE_TYPE_LABELS,
  type AobStats,
  type DrivingCheckWithResults,
} from '@/lib/supabase/driving-checks'

// Airfield Driving Spot Check Report (Airfield Operations Board-ready).
// Portrait letter; raw jsPDF + autotable + sanitizePdfText (fpr-pdf.ts /
// scn-pdf.ts idiom). Every string routes through sanitizePdfText — headings
// and fallbacks included — so the standard PDF font never hits a missing
// glyph.

// Publication cited by name only — NO paragraph number (DAFI 13-213 was
// unverified through the research egress proxy; see the design spec's
// §Regulatory basis / §Assumptions). Must stay EXACT.
const FOOTER_TEXT =
  'Airfield driving spot checks conducted under DAFI 13-213, Airfield Driving, and the local wing supplement.'

const s = sanitizePdfText

interface DrivingCheckPdfInput {
  startDate: string // YYYY-MM-DD (inclusive)
  endDate: string // YYYY-MM-DD (inclusive)
  checks: DrivingCheckWithResults[]
  /** From computeAobStats — the single source shared with the /driving-checks stat strip. */
  stats: AobStats
  baseName?: string
  baseIcao?: string
}

/** "Jul 14, 2026" from a YYYY-MM-DD Zulu date. */
function periodDayLabel(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** "Jul 14 1432Z" from a checked_at timestamp, sanitized. */
function checkedAtLabel(ts: string): string {
  const d = new Date(ts)
  const day = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const time = d.toISOString().slice(11, 16).replace(':', '')
  return `${day} ${time}Z`
}

/** "72%" or an en-dash fallback (sanitized) for a null pass rate. */
function passRateLabel(rate: number | null): string {
  if (rate === null) return s('—')
  return `${Math.round(rate * 100)}%`
}

function checkerLabel(check: DrivingCheckWithResults): string {
  if (check.completed_by_oi) return check.completed_by_oi
  if (check.completed_by_name) return check.completed_by_name
  return s('—')
}

export function generateDrivingCheckReportPdf(input: DrivingCheckPdfInput): {
  doc: jsPDF
  filename: string
} {
  const { startDate, endDate, checks, stats, baseName, baseIcao } = input

  // Chronological (oldest-first) — checked_at ascending, matching the fetch order.
  const ordered = [...checks].sort((a, b) => a.checked_at.localeCompare(b.checked_at))

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  let y = margin + 4

  // ── Header ──
  doc.setFontSize(15)
  doc.setTextColor(20)
  doc.text(s('Airfield Driving Spot Check Report'), margin, y)
  y += 7

  doc.setFontSize(9)
  doc.setTextColor(90)
  const baseLine = [baseName, baseIcao].filter(Boolean).join(' · ')
  const periodLine = `${periodDayLabel(startDate)} - ${periodDayLabel(endDate)}`
  doc.text(s(baseLine ? `${baseLine} · ${periodLine}` : periodLine), margin, y)
  y += 6

  // ── Summary band ──
  const summaryLine =
    `${stats.total} check${stats.total === 1 ? '' : 's'} · ` +
    `${passRateLabel(stats.passRate)} pass rate · ` +
    `${stats.discrepancyCount} discrepanc${stats.discrepancyCount === 1 ? 'y' : 'ies'} · ` +
    `${stats.violationCount} violation${stats.violationCount === 1 ? '' : 's'}`
  doc.setFontSize(10)
  doc.setTextColor(20)
  doc.text(s(summaryLine), margin, y)
  y += 6

  // ── Common discrepancies ──
  if (stats.commonDiscrepancies.length > 0) {
    if (y > pageHeight - margin - 30) {
      doc.addPage()
      y = margin
    }
    doc.setFontSize(11)
    doc.setTextColor(20)
    doc.text(s('Common Discrepancies'), margin, y)
    y += 4
    autoTable(doc, {
      startY: y,
      head: [['Item', 'Count']],
      body: stats.commonDiscrepancies.map((d) => [s(d.label), String(d.count)]),
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [146, 88, 6], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { cellWidth: 22, halign: 'center' } },
      margin: { left: margin, right: margin },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 8
  }

  // ── By checker ──
  if (stats.byChecker.length > 0) {
    if (y > pageHeight - margin - 30) {
      doc.addPage()
      y = margin
    }
    doc.setFontSize(11)
    doc.setTextColor(20)
    doc.text(s('By Checker'), margin, y)
    y += 4
    autoTable(doc, {
      startY: y,
      head: [['Checker', 'Initials', 'Checks', 'Pass Rate', 'Violations']],
      body: stats.byChecker.map((c) => [
        s(c.name),
        s(c.oi || '—'),
        String(c.total),
        passRateLabel(c.passRate),
        String(c.violations),
      ]),
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 24, halign: 'center' },
        4: { cellWidth: 24, halign: 'center' },
      },
      margin: { left: margin, right: margin },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 8
  }

  // ── Chronological log ──
  if (y > pageHeight - margin - 30) {
    doc.addPage()
    y = margin
  }
  doc.setFontSize(11)
  doc.setTextColor(20)
  doc.text(s('Spot Check Log'), margin, y)
  y += 4
  autoTable(doc, {
    startY: y,
    head: [['Date/Time Z', 'Driver', 'Unit', 'AF 483', 'Vehicle', 'Location', 'Result', 'Checker']],
    body: ordered.map((c) => {
      const driver = [c.driver_rank, c.driver_name].filter(Boolean).join(' ')
      const vehicle = c.vehicle_type ? VEHICLE_TYPE_LABELS[c.vehicle_type] : s('—')
      return [
        s(checkedAtLabel(c.checked_at)),
        s(driver || '—'),
        s(c.driver_unit || '—'),
        s(FORM_483_LABELS[c.form_483_status]),
        s(vehicle),
        s(c.location || '—'),
        s(DRIVING_RESULT_LABELS[c.overall_result]),
        s(checkerLabel(c)),
      ]
    }),
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 22 },
      3: { cellWidth: 18 },
      6: { cellWidth: 20 },
      7: { cellWidth: 16 },
    },
    margin: { left: margin, right: margin },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 6) {
        const text = String(data.cell.raw ?? '')
        if (/violation/i.test(text)) {
          data.cell.styles.textColor = [185, 28, 28]
          data.cell.styles.fontStyle = 'bold'
        } else if (/discrepancy/i.test(text)) {
          data.cell.styles.textColor = [146, 88, 6]
          data.cell.styles.fontStyle = 'bold'
        } else {
          data.cell.styles.textColor = [21, 113, 44]
        }
      }
    },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 8

  // ── Footnotes: violation descriptions + discrepancy item notes ──
  const footnotes: { when: string; detail: string }[] = []
  for (const c of ordered) {
    const when = checkedAtLabel(c.checked_at)
    if (c.overall_result === 'violation' && c.violation_description) {
      footnotes.push({ when, detail: `Violation: ${c.violation_description}` })
    }
    for (const r of c.results) {
      if (r.status === 'discrepancy' && r.notes) {
        footnotes.push({ when, detail: `${r.item_label}: ${r.notes}` })
      }
    }
  }

  if (footnotes.length > 0) {
    if (y > pageHeight - margin - 24) {
      doc.addPage()
      y = margin
    }
    doc.setFontSize(11)
    doc.setTextColor(20)
    doc.text(s('Notes'), margin, y)
    y += 4
    autoTable(doc, {
      startY: y,
      head: [['Date/Time Z', 'Detail']],
      body: footnotes.map((f) => [s(f.when), s(f.detail)]),
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [146, 88, 6], textColor: 255 },
      columnStyles: { 0: { cellWidth: 24 } },
      margin: { left: margin, right: margin },
    })
  }

  // ── Footer (publication citation + page numbers) on every page ──
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFontSize(7)
    doc.setTextColor(120)
    doc.text(s(FOOTER_TEXT), margin, pageHeight - 8)
    doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
    doc.text(`Generated ${new Date().toISOString().slice(0, 16)}Z`, margin, pageHeight - 4)
  }

  const filename = `driving-spot-check-report-${startDate}_${endDate}.pdf`
  return { doc, filename }
}
