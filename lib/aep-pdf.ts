/**
 * Airport Emergency Plan — PDF generators.
 *
 * Three exports, all returning `{ doc, filename }` per the project's
 * 16-generator convention:
 *
 *   generateAepPlanPdf              — current AEP document + AE sign-off
 *                                     + response-agency roster + history
 *   generateAepDrillLogPdf          — full-year drill chronology with AAR
 *                                     details for each completed drill
 *   generateAepCommsCheckMonthlyPdf — agency × check-date matrix for one
 *                                     calendar month (fork of scn-pdf)
 *
 * Uses lib/pdf-utils.ts helpers for the standard header / footer / table
 * theme so layout fixes propagate across the report family.
 */

import type jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { sanitizePdfText } from '@/lib/pdf-config'
import { createPdf, drawBaseHeader, drawReportTitle, drawFooter, tableStyles } from '@/lib/pdf-utils'
import {
  AEP_AGENCY_ROLE_LABELS,
  AEP_AGENCY_ROLE_ORDER,
  AEP_COMMS_STATUS_LABELS,
  AEP_DRILL_TYPE_LABELS,
  nextAnnualReviewDue,
  nextFullScaleDue,
  type AepPlan,
  type AepResponseAgency,
  type AepDrill,
  type AepCommsCheckWithResults,
  type AepCommsCheckStatus,
} from '@/lib/supabase/aep'
import { formatZuluDate } from '@/lib/utils'

type BaseInfo = { name?: string | null; icao?: string | null }

// ────────────────────────────────────────────────────────────────
// 1. AEP plan PDF
// ────────────────────────────────────────────────────────────────

export interface AepPlanPdfInput {
  base: BaseInfo
  plan: AepPlan | null
  planHistory: AepPlan[]
  agencies: AepResponseAgency[]
}

export function generateAepPlanPdf(input: AepPlanPdfInput): { doc: jsPDF; filename: string } {
  const { base, plan, planHistory, agencies } = input
  const ctx = createPdf({ orientation: 'portrait', format: 'letter' })
  const { doc, margin, contentWidth, pageHeight } = ctx
  let y = margin

  y = drawBaseHeader(ctx, y, { baseName: base.name, baseIcao: base.icao, sectionLabel: 'AIRPORT OPERATIONS' })
  y = drawReportTitle(ctx, y, {
    title: 'AIRPORT EMERGENCY PLAN',
    subtitle: '14 CFR §139.325 · AC 150/5200-31C',
  })

  // ── Plan metadata block ──
  if (plan) {
    const review = nextAnnualReviewDue(plan)
    doc.setFontSize(11)
    doc.setTextColor(20)
    doc.text(sanitizePdfText(`Version ${plan.version}`), margin, y + 4)
    doc.setFontSize(9)
    doc.setTextColor(90)
    y += 9
    doc.text(`Effective: ${formatZuluDate(plan.effective_date)}`, margin, y)
    y += 5

    if (plan.approved_by_faa_at) {
      doc.text(
        sanitizePdfText(`FAA Acceptance: ${formatZuluDate(plan.approved_by_faa_at)}${plan.faa_acceptance_ref ? ` · ref ${plan.faa_acceptance_ref}` : ''}`),
        margin, y,
      )
      y += 5
    } else {
      doc.text('FAA Acceptance: not recorded', margin, y)
      y += 5
    }

    doc.text(
      plan.ae_signed_at
        ? `AE Sign-off: ${formatZuluDate(plan.ae_signed_at.slice(0, 10))}`
        : 'AE Sign-off: NOT YET SIGNED',
      margin, y,
    )
    y += 5

    if (review.date && review.daysOut !== null) {
      const reviewLine = review.status === 'overdue'
        ? `Annual Review: OVERDUE by ${Math.abs(review.daysOut)} days (was due ${formatZuluDate(review.date.toISOString().slice(0, 10))})`
        : `Annual Review: due ${formatZuluDate(review.date.toISOString().slice(0, 10))} (${review.daysOut} days)`
      doc.text(sanitizePdfText(reviewLine), margin, y)
      y += 5
    }

    if (plan.last_reviewed_at) {
      doc.text(`Last Reviewed: ${formatZuluDate(plan.last_reviewed_at.slice(0, 10))}`, margin, y)
      y += 5
    }
    y += 4

    if (plan.review_notes) {
      doc.setFontSize(8)
      doc.setTextColor(40)
      doc.text('REVIEW NOTES', margin, y)
      y += 4
      doc.setFontSize(9)
      const lines = doc.splitTextToSize(sanitizePdfText(plan.review_notes), contentWidth)
      doc.text(lines, margin, y)
      y += lines.length * 4 + 4
    }
  } else {
    doc.setFontSize(11)
    doc.setTextColor(150, 50, 50)
    doc.text('NO ACTIVE PLAN ON FILE', margin, y + 4)
    y += 12
  }

  // ── Response-agency roster table ──
  doc.setFontSize(10)
  doc.setTextColor(20)
  doc.text('RESPONSE AGENCY ROSTER', margin, y + 4)
  y += 8

  const activeAgencies = agencies.filter(a => a.is_active)
  if (activeAgencies.length === 0) {
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text('(No active agencies on roster.)', margin, y)
    y += 6
  } else {
    const rows: string[][] = []
    for (const role of AEP_AGENCY_ROLE_ORDER) {
      const inRole = activeAgencies.filter(a => a.agency_role === role)
        .sort((a, b) => a.sort_order - b.sort_order)
      for (const a of inRole) {
        rows.push([
          AEP_AGENCY_ROLE_LABELS[a.agency_role],
          a.agency_name,
          [a.primary_contact_name, a.primary_contact_phone, a.primary_contact_radio].filter(Boolean).join(' / ') || '—',
          [a.backup_contact_name, a.backup_contact_phone].filter(Boolean).join(' / ') || '—',
        ])
      }
    }
    autoTable(doc, {
      startY: y,
      head: [['Role', 'Agency', 'Primary Contact', 'Backup']],
      body: rows,
      ...tableStyles(ctx),
      styles: { ...tableStyles(ctx).styles, fontSize: 8 },
      columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 50 } },
    })
    type DocWithTable = jsPDF & { lastAutoTable?: { finalY: number } }
    y = ((doc as DocWithTable).lastAutoTable?.finalY ?? y) + 8
  }

  // ── Plan history table ──
  if (planHistory.length > 1) {
    if (y > pageHeight - 60) { doc.addPage(); y = margin }
    doc.setFontSize(10)
    doc.setTextColor(20)
    doc.text('PLAN HISTORY', margin, y + 4)
    y += 8
    autoTable(doc, {
      startY: y,
      head: [['Version', 'Effective', 'Status', 'AE Signed', 'Annual Review']],
      body: planHistory.map(p => [
        p.version,
        formatZuluDate(p.effective_date),
        p.replaced_by_id ? 'Superseded' : 'Active',
        p.ae_signed_at ? formatZuluDate(p.ae_signed_at.slice(0, 10)) : '—',
        p.last_reviewed_at ? formatZuluDate(p.last_reviewed_at.slice(0, 10)) : '—',
      ]),
      ...tableStyles(ctx),
      styles: { ...tableStyles(ctx).styles, fontSize: 8 },
    })
  }

  drawFooter(ctx)
  const versionSlug = plan ? plan.version.replace(/[^a-z0-9.-]/gi, '') : 'no-plan'
  const dateSlug = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const icao = base.icao ?? 'BASE'
  return { doc, filename: `aep-plan-${icao}-${versionSlug}-${dateSlug}.pdf` }
}

// ────────────────────────────────────────────────────────────────
// 2. AEP drill log PDF (year-scoped)
// ────────────────────────────────────────────────────────────────

export interface AepDrillLogPdfInput {
  base: BaseInfo
  drills: AepDrill[]
  year: number
  /** Most-recent full-scale across all years (drives the "next due" header line). */
  latestFullScale?: AepDrill | null
}

export function generateAepDrillLogPdf(input: AepDrillLogPdfInput): { doc: jsPDF; filename: string } {
  const { base, drills, year, latestFullScale } = input
  const ctx = createPdf({ orientation: 'portrait', format: 'letter' })
  const { doc, margin, contentWidth, pageHeight } = ctx
  let y = margin

  y = drawBaseHeader(ctx, y, { baseName: base.name, baseIcao: base.icao, sectionLabel: 'AIRPORT OPERATIONS' })
  y = drawReportTitle(ctx, y, {
    title: `AEP DRILL LOG — ${year}`,
    subtitle: '§139.325(h) triennial full-scale · §139.325(j) annual tabletop / functional',
  })

  // ── Summary stats ──
  const yearDrills = drills.filter(d => new Date(d.drill_date).getUTCFullYear() === year)
  const byType = AEP_DRILL_TYPE_LABELS
  const fsDue = nextFullScaleDue(latestFullScale ?? null)
  doc.setFontSize(9)
  doc.setTextColor(40)
  const summaryLines: string[] = []
  for (const t of Object.keys(byType) as Array<keyof typeof byType>) {
    const completed = yearDrills.filter(d => d.drill_type === t && d.status === 'completed').length
    if (completed > 0) summaryLines.push(`${byType[t]}: ${completed}`)
  }
  if (summaryLines.length > 0) {
    doc.text(`Completed in ${year}: ${summaryLines.join(' · ')}`, margin, y + 4)
    y += 8
  } else {
    doc.setTextColor(150, 50, 50)
    doc.text(`No drills completed in ${year}.`, margin, y + 4)
    y += 8
  }
  if (latestFullScale) {
    doc.setTextColor(40)
    doc.text(
      sanitizePdfText(`Latest full-scale: ${formatZuluDate(latestFullScale.drill_date)} — next due ${fsDue.date ? formatZuluDate(fsDue.date.toISOString().slice(0, 10)) : 'unknown'}${fsDue.status === 'overdue' ? ' (OVERDUE)' : ''}`),
      margin, y,
    )
    y += 6
  }
  y += 4

  if (yearDrills.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text(`No drills recorded in ${year}.`, margin, y + 4)
    drawFooter(ctx)
    const icao = base.icao ?? 'BASE'
    return { doc, filename: `aep-drills-${icao}-${year}.pdf` }
  }

  // ── Roll-up table ──
  doc.setFontSize(10)
  doc.setTextColor(20)
  doc.text('DRILL CHRONOLOGY', margin, y + 4)
  y += 8
  autoTable(doc, {
    startY: y,
    head: [['Date', 'Type', 'Status', 'Scenario', 'Attendance']],
    body: yearDrills.map(d => {
      const total = d.participants?.length ?? 0
      const attended = d.participants?.filter(p => p.attended).length ?? 0
      return [
        formatZuluDate(d.drill_date),
        AEP_DRILL_TYPE_LABELS[d.drill_type],
        d.status,
        d.scenario.length > 80 ? d.scenario.slice(0, 77) + '…' : d.scenario,
        total > 0 ? `${attended} / ${total}` : '—',
      ]
    }),
    ...tableStyles(ctx),
    styles: { ...tableStyles(ctx).styles, fontSize: 8 },
  })
  type DocWithTable = jsPDF & { lastAutoTable?: { finalY: number } }
  y = ((doc as DocWithTable).lastAutoTable?.finalY ?? y) + 10

  // ── Per-drill detail blocks ──
  for (const d of yearDrills) {
    if (y > pageHeight - 50) { doc.addPage(); y = margin }
    doc.setFontSize(10)
    doc.setTextColor(20)
    doc.text(
      sanitizePdfText(`${formatZuluDate(d.drill_date)} — ${AEP_DRILL_TYPE_LABELS[d.drill_type]} (${d.status})`),
      margin, y + 4,
    )
    y += 8
    doc.setFontSize(8)
    doc.setTextColor(70)
    const scenarioLines = doc.splitTextToSize(sanitizePdfText('Scenario: ' + d.scenario), contentWidth)
    doc.text(scenarioLines, margin, y)
    y += scenarioLines.length * 3.5 + 2

    if (d.participants && d.participants.length > 0) {
      const present = d.participants.filter(p => p.attended).map(p => p.agency_name)
      const absent = d.participants.filter(p => !p.attended).map(p => p.agency_name)
      if (present.length > 0) {
        const presentLines = doc.splitTextToSize(sanitizePdfText('Present: ' + present.join(', ')), contentWidth)
        doc.text(presentLines, margin, y)
        y += presentLines.length * 3.5 + 1
      }
      if (absent.length > 0) {
        const absentLines = doc.splitTextToSize(sanitizePdfText('Absent / not invited: ' + absent.join(', ')), contentWidth)
        doc.text(absentLines, margin, y)
        y += absentLines.length * 3.5 + 1
      }
    }
    if (d.after_action_notes) {
      const lines = doc.splitTextToSize(sanitizePdfText('After-action: ' + d.after_action_notes), contentWidth)
      doc.text(lines, margin, y)
      y += lines.length * 3.5 + 1
    }
    if (d.findings) {
      const lines = doc.splitTextToSize(sanitizePdfText('Findings: ' + d.findings), contentWidth)
      doc.setTextColor(150, 50, 50)
      doc.text(lines, margin, y)
      y += lines.length * 3.5 + 4
      doc.setTextColor(70)
    } else {
      y += 4
    }
  }

  drawFooter(ctx)
  const icao = base.icao ?? 'BASE'
  return { doc, filename: `aep-drills-${icao}-${year}.pdf` }
}

// ────────────────────────────────────────────────────────────────
// 3. AEP monthly comms-check PDF (agency × date matrix)
// ────────────────────────────────────────────────────────────────

export interface AepCommsCheckMonthlyPdfInput {
  base: BaseInfo
  monthYyyyMm: string             // "2026-06"
  agencies: AepResponseAgency[]    // active roster, ordered
  checks: AepCommsCheckWithResults[]
}

const STATUS_GLYPH: Record<AepCommsCheckStatus, { glyph: string; fill: [number, number, number]; text: [number, number, number] }> = {
  loud_clear:   { glyph: 'L', fill: [217, 240, 221], text: [21, 113, 44] },
  no_response:  { glyph: 'N', fill: [254, 236, 203], text: [146, 88, 6] },
  oos:          { glyph: 'X', fill: [254, 215, 215], text: [153, 27, 27] },
  not_reached:  { glyph: '–', fill: [230, 230, 234], text: [90, 90, 100] },
}

function monthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(n => parseInt(n, 10))
  const date = new Date(Date.UTC(y, m - 1, 1))
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function generateAepCommsCheckMonthlyPdf(
  input: AepCommsCheckMonthlyPdfInput,
): { doc: jsPDF; filename: string } {
  const { base, monthYyyyMm, agencies, checks } = input

  const ctx = createPdf({ orientation: 'landscape', format: 'letter' })
  const { doc, margin, contentWidth, pageHeight } = ctx
  let y = margin

  y = drawBaseHeader(ctx, y, { baseName: base.name, baseIcao: base.icao, sectionLabel: 'AIRPORT OPERATIONS' })
  y = drawReportTitle(ctx, y, {
    title: `AEP COMMS CHECK LOG — ${monthLabel(monthYyyyMm)}`,
    subtitle: 'AC 150/5200-31C §2.3 — response-agency comms verification',
  })

  const monthChecks = checks
    .filter(c => c.check_date.startsWith(monthYyyyMm))
    .sort((a, b) => a.check_date.localeCompare(b.check_date))

  doc.setFontSize(9)
  doc.setTextColor(40)
  doc.text(
    `${monthChecks.length} comms check${monthChecks.length === 1 ? '' : 's'} logged · ${agencies.length} agencies on active roster`,
    margin, y + 4,
  )
  y += 9

  if (monthChecks.length === 0 || agencies.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(150, 50, 50)
    doc.text(
      monthChecks.length === 0
        ? 'No comms checks recorded this month.'
        : 'No active agencies on the roster.',
      margin, y + 4,
    )
    drawFooter(ctx)
    const icao = base.icao ?? 'BASE'
    return { doc, filename: `aep-comms-check-${icao}-${monthYyyyMm}.pdf` }
  }

  // ── Matrix: rows = agencies, columns = checks (date) ──
  const byAgency = new Map<string, Map<string, { status: AepCommsCheckStatus; notes: string | null }>>()
  for (const c of monthChecks) {
    for (const r of c.results) {
      let m = byAgency.get(r.agency_name)
      if (!m) { m = new Map(); byAgency.set(r.agency_name, m) }
      m.set(c.check_date, { status: r.status, notes: r.notes })
    }
  }

  const head: string[] = ['Agency']
  for (const c of monthChecks) head.push(formatZuluDate(c.check_date).split(',')[0])

  const body: string[][] = []
  for (const a of agencies) {
    const row: string[] = [a.agency_name]
    for (const c of monthChecks) {
      const entry = byAgency.get(a.agency_name)?.get(c.check_date)
      row.push(entry ? STATUS_GLYPH[entry.status].glyph : '')
    }
    body.push(row)
  }

  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    ...tableStyles(ctx),
    styles: { ...tableStyles(ctx).styles, fontSize: 8, halign: 'center' },
    columnStyles: { 0: { halign: 'left', cellWidth: 50 } },
    didParseCell(data) {
      if (data.section !== 'body' || data.column.index === 0) return
      const agency = agencies[data.row.index]
      const check = monthChecks[data.column.index - 1]
      const entry = byAgency.get(agency.agency_name)?.get(check.check_date)
      if (!entry) return
      const palette = STATUS_GLYPH[entry.status]
      data.cell.styles.fillColor = palette.fill
      data.cell.styles.textColor = palette.text
      data.cell.styles.fontStyle = 'bold'
    },
  })
  type DocWithTable = jsPDF & { lastAutoTable?: { finalY: number } }
  y = ((doc as DocWithTable).lastAutoTable?.finalY ?? y) + 8

  // ── Legend ──
  doc.setFontSize(8)
  doc.setTextColor(80)
  const legendParts = (['loud_clear', 'no_response', 'oos', 'not_reached'] as AepCommsCheckStatus[])
    .map(s => `${STATUS_GLYPH[s].glyph} = ${AEP_COMMS_STATUS_LABELS[s]}`)
  doc.text('Legend: ' + legendParts.join('   ·   '), margin, y)
  y += 6

  // ── Exception footnotes ──
  const exceptions: { date: string; agency: string; status: AepCommsCheckStatus; notes: string | null }[] = []
  for (const c of monthChecks) {
    for (const r of c.results) {
      if (r.status !== 'loud_clear') {
        exceptions.push({ date: c.check_date, agency: r.agency_name, status: r.status, notes: r.notes })
      }
    }
  }
  if (exceptions.length > 0) {
    if (y > pageHeight - 30) { doc.addPage(); y = margin }
    doc.setFontSize(9)
    doc.setTextColor(20)
    doc.text('EXCEPTIONS', margin, y + 4)
    y += 8
    doc.setFontSize(8)
    doc.setTextColor(60)
    for (const e of exceptions) {
      const line = sanitizePdfText(`${formatZuluDate(e.date)} — ${e.agency} (${AEP_COMMS_STATUS_LABELS[e.status]}${e.notes ? `: ${e.notes}` : ''})`)
      const wrapped = doc.splitTextToSize(line, contentWidth)
      doc.text(wrapped, margin, y)
      y += wrapped.length * 3.5 + 1
    }
  }

  drawFooter(ctx)
  const icao = base.icao ?? 'BASE'
  return { doc, filename: `aep-comms-check-${icao}-${monthYyyyMm}.pdf` }
}
