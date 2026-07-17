import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { sanitizePdfText } from '@/lib/pdf-config'
import { type FprCheckWithResults } from '@/lib/supabase/fpr'
import { SHIFT_ORDER, type ShiftKey } from '@/lib/shifts'

interface FprPdfInput {
  monthYyyyMm: string                    // "2026-07"
  checks: FprCheckWithResults[]
  shiftLabels: Record<ShiftKey, string>  // resolved via getShiftLabel at call time
  baseName?: string
}

// Publication-level citation only — no paragraph number (the FPR check
// requirement's exact paragraph is unverified; see the design spec's
// §Regulatory basis / §Assumptions). Must stay EXACT.
const FOOTER_TEXT =
  'Flight Planning Room checks per locally developed procedures under DAFMAN 13-204 Volume 2.'

function monthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map((n) => parseInt(n, 10))
  const date = new Date(Date.UTC(y, m - 1, 1))
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** "Jul 14" from a YYYY-MM-DD Zulu date. */
function dayLabel(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** "1432Z" from a completed_at timestamp, or a sanitized dash fallback. */
function completedZulu(ts: string | null): string {
  // This value is placed directly into the table body (not re-sanitized at
  // the call site), so the em-dash fallback must be sanitized here or it
  // renders as a missing glyph in the standard PDF font.
  if (!ts) return sanitizePdfText('—')
  return `${new Date(ts).toISOString().slice(11, 16).replace(':', '')}Z`
}

export function generateFprMonthlyPdf(input: FprPdfInput): { doc: jsPDF; filename: string } {
  const { monthYyyyMm, checks, shiftLabels, baseName } = input

  // In-month checks, chronological then by canonical shift order (day → swing → mid).
  const monthChecks = checks
    .filter((c) => c.check_date.startsWith(monthYyyyMm))
    .sort((a, b) => {
      if (a.check_date !== b.check_date) return a.check_date.localeCompare(b.check_date)
      return SHIFT_ORDER.indexOf(a.shift) - SHIFT_ORDER.indexOf(b.shift)
    })

  const shiftLabelFor = (key: ShiftKey): string => shiftLabels[key] ?? key

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  let y = margin + 4

  // ── Header ──
  doc.setFontSize(15)
  doc.setTextColor(20)
  doc.text(
    sanitizePdfText(`Flight Planning Room Check Log — ${monthLabel(monthYyyyMm)}`),
    margin,
    y,
  )
  y += 7

  doc.setFontSize(9)
  doc.setTextColor(90)
  const distinctDays = new Set(monthChecks.map((c) => c.check_date)).size
  const totalIssues = monthChecks.reduce(
    (n, c) => n + c.results.filter((r) => r.status === 'issue').length,
    0,
  )
  const totalsLine =
    `${monthChecks.length} check${monthChecks.length === 1 ? '' : 's'} logged across ` +
    `${distinctDays} day${distinctDays === 1 ? '' : 's'} · ` +
    `${totalIssues} issue${totalIssues === 1 ? '' : 's'} noted`
  doc.text(sanitizePdfText(baseName ? `${baseName} · ${totalsLine}` : totalsLine), margin, y)
  y += 6

  // ── Chronological check table: Date | Shift | Completed (Zulu) | Initials | Result ──
  autoTable(doc, {
    startY: y,
    head: [['Date', 'Shift', 'Completed (Z)', 'Initials', 'Result']],
    body: monthChecks.map((c) => {
      const issues = c.results.filter((r) => r.status === 'issue')
      const result =
        issues.length === 0
          ? 'All satisfactory'
          : `${issues.length} issue${issues.length === 1 ? '' : 's'}`
      return [
        sanitizePdfText(dayLabel(c.check_date)),
        sanitizePdfText(shiftLabelFor(c.shift)),
        completedZulu(c.completed_at),
        sanitizePdfText(c.completed_by_oi || '—'),
        sanitizePdfText(result),
      ]
    }),
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 26 },
      2: { cellWidth: 28, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 4) {
        const text = String(data.cell.raw ?? '')
        if (/issue/i.test(text)) {
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

  // ── Footnotes: each issue's item label + notes (SCN footnote idiom) ──
  const issueFootnotes: { date: string; shift: string; item: string; notes: string }[] = []
  for (const c of monthChecks) {
    for (const r of c.results) {
      if (r.status !== 'issue') continue
      issueFootnotes.push({
        date: dayLabel(c.check_date),
        shift: shiftLabelFor(c.shift),
        item: r.item_label,
        notes: r.notes || '—',
      })
    }
  }

  if (issueFootnotes.length > 0) {
    if (y > pageHeight - margin - 30) {
      doc.addPage()
      y = margin
    }
    doc.setFontSize(11)
    doc.setTextColor(20)
    doc.text(sanitizePdfText('Issues — Notes'), margin, y)
    y += 4
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Shift', 'Item', 'Notes']],
      body: issueFootnotes.map((f) => [
        sanitizePdfText(f.date),
        sanitizePdfText(f.shift),
        sanitizePdfText(f.item),
        sanitizePdfText(f.notes),
      ]),
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [146, 88, 6], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 26 },
        2: { cellWidth: 48 },
      },
    })
  }

  // ── Footer (publication citation + page numbers) on every page ──
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFontSize(7)
    doc.setTextColor(120)
    doc.text(sanitizePdfText(FOOTER_TEXT), margin, pageHeight - 8)
    doc.text(
      `Page ${p} of ${pageCount}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: 'right' },
    )
    doc.text(`Generated ${new Date().toISOString().slice(0, 16)}Z`, margin, pageHeight - 4)
  }

  const filename = `fpr-check-log-${monthYyyyMm}.pdf`
  return { doc, filename }
}
