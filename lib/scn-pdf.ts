import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { sanitizePdfText } from '@/lib/pdf-config'
import { SCN_STATUS_LABELS, type ScnCheckWithResults, type ScnAgencyStatus } from '@/lib/supabase/scn'

interface ScnPdfInput {
  baseName: string
  baseIcao?: string | null
  monthYyyyMm: string     // "2026-04"
  checks: ScnCheckWithResults[]
  agencies: string[]      // display order from scn_agencies
}

const STATUS_CELL: Record<ScnAgencyStatus, { glyph: string; fill: [number, number, number]; text: [number, number, number] }> = {
  loud_clear:  { glyph: 'L', fill: [217, 240, 221], text: [21, 113, 44] },
  no_response: { glyph: 'N', fill: [254, 236, 203], text: [146, 88, 6] },
  oos:         { glyph: 'X', fill: [254, 215, 215], text: [153, 27, 27] },
}

function daysInMonth(yyyyMm: string): number {
  const [y, m] = yyyyMm.split('-').map(n => parseInt(n, 10))
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

function monthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(n => parseInt(n, 10))
  const date = new Date(Date.UTC(y, m - 1, 1))
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** Build a {agency → {day → status}} lookup from the primary checks. */
function buildMatrix(
  checks: ScnCheckWithResults[],
  yyyyMm: string,
): {
  primary: Map<string, Map<number, { status: ScnAgencyStatus; notes: string | null; oi: string | null }>>
  backupDays: Set<number>
  backupByDay: Map<number, ScnCheckWithResults>
  primaryByDay: Map<number, ScnCheckWithResults>
  oosFootnotes: { day: number; agency: string; note: string }[]
  noResponseFootnotes: { day: number; agency: string; oi: string | null }[]
} {
  const primary = new Map<string, Map<number, { status: ScnAgencyStatus; notes: string | null; oi: string | null }>>()
  const backupDays = new Set<number>()
  const backupByDay = new Map<number, ScnCheckWithResults>()
  const primaryByDay = new Map<number, ScnCheckWithResults>()
  const oosFootnotes: { day: number; agency: string; note: string }[] = []
  const noResponseFootnotes: { day: number; agency: string; oi: string | null }[] = []

  for (const c of checks) {
    if (!c.check_date.startsWith(yyyyMm)) continue
    const day = parseInt(c.check_date.slice(8, 10), 10)

    if (c.check_type === 'backup') {
      backupDays.add(day)
      backupByDay.set(day, c)
      continue
    }

    primaryByDay.set(day, c)
    for (const r of c.results) {
      let agencyMap = primary.get(r.agency_name)
      if (!agencyMap) {
        agencyMap = new Map()
        primary.set(r.agency_name, agencyMap)
      }
      agencyMap.set(day, { status: r.status, notes: r.notes, oi: c.completed_by_oi })

      if (r.status === 'oos' && r.notes) {
        oosFootnotes.push({ day, agency: r.agency_name, note: r.notes })
      } else if (r.status === 'no_response') {
        noResponseFootnotes.push({ day, agency: r.agency_name, oi: c.completed_by_oi })
      }
    }
  }

  return { primary, backupDays, backupByDay, primaryByDay, oosFootnotes, noResponseFootnotes }
}

export function generateScnMonthlyPdf(input: ScnPdfInput): { doc: jsPDF; filename: string } {
  const { baseName, baseIcao, monthYyyyMm, checks, agencies } = input
  const dayCount = daysInMonth(monthYyyyMm)
  const { primary, backupDays, primaryByDay, oosFootnotes, noResponseFootnotes } = buildMatrix(checks, monthYyyyMm)

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 10
  let y = margin

  // ── Header ──
  doc.setFontSize(9)
  doc.setTextColor(90)
  doc.text(sanitizePdfText(baseName.toUpperCase() + (baseIcao ? ` (${baseIcao})` : '')), margin, y)
  y += 4
  doc.setFontSize(16)
  doc.setTextColor(20)
  doc.text(`Secondary Crash Net Daily Check Log — ${monthLabel(monthYyyyMm)}`, margin, y)
  y += 7
  doc.setFontSize(9)
  doc.setTextColor(90)
  const totalPrimary = primaryByDay.size
  const totalBackup = backupDays.size
  doc.text(
    `${totalPrimary} daily check${totalPrimary === 1 ? '' : 's'} logged · ${totalBackup} monthly check${totalBackup === 1 ? '' : 's'} logged · ${agencies.length} agency list`,
    margin, y,
  )
  y += 6

  // ── Legend ──
  const legend: { label: string; status: ScnAgencyStatus }[] = [
    { label: 'L — Loud & Clear', status: 'loud_clear' },
    { label: 'N — No Response', status: 'no_response' },
    { label: 'X — Out of Service', status: 'oos' },
    { label: '· — No check logged', status: 'loud_clear' }, // no-check shown without fill
  ]
  let lx = margin
  doc.setFontSize(8)
  for (const item of legend) {
    if (item.label.startsWith('·')) {
      doc.setFillColor(245, 245, 245)
    } else {
      const c = STATUS_CELL[item.status]
      doc.setFillColor(c.fill[0], c.fill[1], c.fill[2])
    }
    doc.rect(lx, y - 3, 3.5, 3.5, 'F')
    doc.setTextColor(60)
    doc.text(item.label, lx + 5, y)
    lx += doc.getTextWidth(item.label) + 12
  }
  y += 5

  // ── Matrix table: rows = agencies, columns = days ──
  const head = [['Agency', ...Array.from({ length: dayCount }, (_, i) => String(i + 1))]]
  const body: (string | { content: string; meta?: ScnAgencyStatus })[][] = agencies.map(name => {
    const row: (string | { content: string; meta?: ScnAgencyStatus })[] = [name]
    const perDay = primary.get(name)
    for (let d = 1; d <= dayCount; d++) {
      const entry = perDay?.get(d)
      if (!entry) {
        row.push({ content: '·' })
      } else {
        row.push({ content: STATUS_CELL[entry.status].glyph, meta: entry.status })
      }
    }
    return row
  })

  // Monthly Back-up SCN row appended at the bottom with B marks on days it was completed
  const backupRow: (string | { content: string; meta?: 'backup' })[] = ['Monthly Back-up SCN']
  for (let d = 1; d <= dayCount; d++) {
    backupRow.push(backupDays.has(d) ? { content: 'B', meta: 'backup' } : { content: '·' })
  }

  autoTable(doc, {
    startY: y,
    head,
    body: [...(body as (string | { content: string })[][]), backupRow as (string | { content: string })[]],
    theme: 'grid',
    styles: { fontSize: 7, halign: 'center', cellPadding: 1.2, lineColor: [200, 200, 200] },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', halign: 'center' },
    columnStyles: { 0: { halign: 'left', cellWidth: 36, fontStyle: 'bold' } },
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const raw = data.cell.raw as string | { content: string; meta?: ScnAgencyStatus | 'backup' }
      if (typeof raw === 'object' && raw !== null && raw.meta) {
        if (raw.meta === 'backup') {
          data.cell.styles.fillColor = [207, 230, 255]
          data.cell.styles.textColor = [30, 64, 175]
          data.cell.styles.fontStyle = 'bold'
        } else {
          const c = STATUS_CELL[raw.meta]
          data.cell.styles.fillColor = c.fill
          data.cell.styles.textColor = c.text
          data.cell.styles.fontStyle = 'bold'
        }
      } else if (typeof raw === 'object' && raw !== null) {
        data.cell.styles.textColor = [180, 180, 180]
      }
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 8

  // ── Footnotes: OOS details + no-response days ──
  const pageBreakThreshold = doc.internal.pageSize.getHeight() - margin - 30

  if (oosFootnotes.length > 0) {
    if (y > pageBreakThreshold) { doc.addPage(); y = margin }
    doc.setFontSize(11)
    doc.setTextColor(20)
    doc.text('Out of Service — Notes', margin, y)
    y += 4
    autoTable(doc, {
      startY: y,
      head: [['Day', 'Agency', 'Reason']],
      body: oosFootnotes.map(f => [String(f.day), f.agency, f.note]),
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [153, 27, 27], textColor: 255 },
      columnStyles: { 0: { cellWidth: 14, halign: 'center' }, 1: { cellWidth: 40 } },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 8
  }

  if (noResponseFootnotes.length > 0) {
    if (y > pageBreakThreshold) { doc.addPage(); y = margin }
    doc.setFontSize(11)
    doc.setTextColor(20)
    doc.text('No Response — Days & Controller OI', margin, y)
    y += 4
    autoTable(doc, {
      startY: y,
      head: [['Day', 'Agency', 'Controller']],
      body: noResponseFootnotes.map(f => [String(f.day), f.agency, f.oi || '—']),
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [146, 88, 6], textColor: 255 },
      columnStyles: { 0: { cellWidth: 14, halign: 'center' }, 1: { cellWidth: 40 } },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 8
  }

  // ── Monthly Back-up SCN completion log ──
  if (backupDays.size > 0) {
    if (y > pageBreakThreshold) { doc.addPage(); y = margin }
    doc.setFontSize(11)
    doc.setTextColor(20)
    doc.text('Monthly Back-up SCN Completion Log', margin, y)
    y += 4
    const sortedBackup = Array.from(backupDays.keys()).sort((a, b) => a - b)
    autoTable(doc, {
      startY: y,
      head: [['Day', 'Controller', 'Result']],
      body: sortedBackup.map(day => {
        const c = checks.find(ch => ch.check_type === 'backup' && parseInt(ch.check_date.slice(8, 10), 10) === day && ch.check_date.startsWith(monthYyyyMm))
        if (!c) return [String(day), '—', '—']
        const exceptions = c.results.filter(r => r.status !== 'loud_clear')
        const result = exceptions.length === 0
          ? 'All agencies loud & clear'
          : `Except: ${exceptions.map(e => `${e.agency_name} (${SCN_STATUS_LABELS[e.status]})`).join(', ')}`
        return [String(day), c.completed_by_oi || '—', result]
      }),
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255 },
      columnStyles: { 0: { cellWidth: 14, halign: 'center' }, 1: { cellWidth: 28 } },
    })
  }

  // ── Footer (page numbers) ──
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFontSize(7)
    doc.setTextColor(150)
    doc.text(`Page ${p} of ${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 4, { align: 'right' })
    doc.text(`Generated ${new Date().toISOString().slice(0, 16)}Z`, margin, doc.internal.pageSize.getHeight() - 4)
  }

  const filename = `SCN_Daily_Check_Log_${monthYyyyMm}.pdf`
  return { doc, filename }
}
