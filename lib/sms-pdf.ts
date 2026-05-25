import autoTable from 'jspdf-autotable'
import {
  createPdf, drawBaseHeader, drawReportTitle, drawFooter, tableStyles,
} from '@/lib/pdf-utils'
import { sanitizePdfText } from '@/lib/pdf-config'
import { formatZuluDate, formatZuluDateTime } from '@/lib/utils'
import {
  BAND_COLORS, LIKELIHOOD_LABELS, SEVERITY_LABELS,
  type SmsPolicy, type SmsHazard, type SmsRiskAssessment, type SmsMitigation,
  type SmsSpi, type SmsSpiMeasurement,
  type SmsAudit, type SmsMoc, type SmsSafetyReport,
} from '@/lib/supabase/sms'

// ────────────────────────────────────────────────────────────────
// SMS Manual PDF — Policy + SRM + SA + Promotion auto-assembled
// per AC 150/5200-37A taxonomy. Returns { doc, filename } per the
// existing PDF generator convention.
// ────────────────────────────────────────────────────────────────

export interface SmsManualInput {
  baseName?: string | null
  baseIcao?: string | null
  policy: SmsPolicy | null
  hazards: SmsHazard[]
  assessments: SmsRiskAssessment[]      // latest per hazard ideal; all OK
  mitigations: SmsMitigation[]
  spis: SmsSpi[]
  latestMeasurements: Map<string, SmsSpiMeasurement>
  audits: SmsAudit[]
  mocs: SmsMoc[]
  reports: SmsSafetyReport[]
}

export function buildSmsManualPdf(input: SmsManualInput): { doc: ReturnType<typeof createPdf>['doc']; filename: string } {
  const ctx = createPdf({ orientation: 'portrait' })
  const { doc, margin, contentWidth, pageHeight } = ctx

  let y = drawBaseHeader(ctx, 15, { baseName: input.baseName, baseIcao: input.baseIcao, sectionLabel: 'AIRPORT OPERATIONS — SAFETY MANAGEMENT SYSTEM' })
  y = drawReportTitle(ctx, y, {
    title: 'SMS Manual',
    subtitle: `Compiled ${formatZuluDate(new Date().toISOString().slice(0, 10))} · per 14 CFR §139.401 / AC 150/5200-37A`,
  })

  // ── Section 1 — Safety Policy ──────────────────────────────
  y = sectionHeading(doc, margin, y, '1. Safety Policy (AC 150/5200-37A §6.2)')
  if (input.policy) {
    doc.setFontSize(10); doc.setTextColor(40)
    doc.text(`Version: v${input.policy.version}`, margin, y)
    doc.text(`Effective: ${input.policy.effective_date ? formatZuluDate(input.policy.effective_date) : '—'}`, margin + 70, y)
    y += 5
    doc.text(`Signed: ${input.policy.signed_at ? formatZuluDateTime(input.policy.signed_at) : 'Unsigned'}`, margin, y)
    y += 7

    if (input.policy.safety_objectives.length > 0) {
      y = subHeading(doc, margin, y, 'Safety Objectives')
      doc.setFontSize(9); doc.setTextColor(60)
      for (const obj of input.policy.safety_objectives) {
        const text = sanitizePdfText(`• ${obj.title}${obj.description ? ' — ' + obj.description : ''}`)
        const lines = doc.splitTextToSize(text, contentWidth) as string[]
        doc.text(lines, margin, y)
        y += lines.length * 4 + 1
      }
      y += 3
    }

    if (input.policy.employee_reporting_pledge) {
      y = subHeading(doc, margin, y, 'Employee Reporting Pledge')
      doc.setFontSize(9); doc.setTextColor(60)
      const lines = doc.splitTextToSize(sanitizePdfText(input.policy.employee_reporting_pledge), contentWidth) as string[]
      doc.text(lines, margin, y)
      y += lines.length * 4 + 4
    }
  } else {
    placeholder(doc, margin, y, 'No active Safety Policy on file. Required by §139.401(c)(1).')
    y += 10
  }

  // ── Section 2 — Safety Risk Management ─────────────────────
  y = ensurePage(doc, ctx, y, 30)
  y = sectionHeading(doc, margin, y, '2. Safety Risk Management (AC 150/5200-37A §6.3)')
  if (input.hazards.length === 0) {
    placeholder(doc, margin, y, 'No hazards in the register.')
    y += 8
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Code', 'Title', 'Current', 'Residual', 'Status']],
      body: input.hazards.map((h) => [
        h.hazard_code,
        h.title,
        bandLabel(h.current_band),
        bandLabel(h.residual_band),
        h.status,
      ]),
      ...tableStyles(ctx),
      didParseCell: (data) => {
        // Color the current/residual cells by band
        if (data.row.section !== 'body') return
        const hazard = input.hazards[data.row.index]
        if (data.column.index === 2 || data.column.index === 3) {
          const band = data.column.index === 2 ? hazard.current_band : hazard.residual_band
          if (band && (band === 'low' || band === 'medium' || band === 'high')) {
            const p = BAND_COLORS[band]
            data.cell.styles.fillColor = hexToRgbFromCss(p.bg) ?? [40, 40, 40]
            data.cell.styles.textColor = hexToRgbFromCss(p.text) ?? [255, 255, 255]
          }
        }
      },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6
  }

  if (input.mitigations.length > 0) {
    y = ensurePage(doc, ctx, y, 30)
    y = subHeading(doc, margin, y, 'Mitigations in Progress')
    const open = input.mitigations.filter(m => m.status === 'planned' || m.status === 'in_progress')
    autoTable(doc, {
      startY: y,
      head: [['Hazard', 'Mitigation', 'Type', 'Due', 'Status']],
      body: open.map((m) => [
        input.hazards.find(h => h.id === m.hazard_id)?.hazard_code ?? '—',
        m.title,
        m.control_type,
        m.due_date ? formatZuluDate(m.due_date) : '—',
        m.status,
      ]),
      ...tableStyles(ctx),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6
  }

  // ── Section 3 — Safety Assurance ───────────────────────────
  y = ensurePage(doc, ctx, y, 30)
  y = sectionHeading(doc, margin, y, '3. Safety Assurance (AC 150/5200-37A §6.4)')

  y = subHeading(doc, margin, y, 'Safety Performance Indicators')
  if (input.spis.length === 0) {
    placeholder(doc, margin, y, 'No SPIs configured.'); y += 8
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Code', 'Title', 'Current Value', 'Target', 'Alert', 'Status']],
      body: input.spis.map((s) => {
        const m = input.latestMeasurements.get(s.id)
        return [
          s.code, s.title,
          m ? `${m.value} ${s.unit === 'percent' ? '%' : ''}` : '—',
          s.target_value != null ? `${s.target_direction === 'lower' ? '≤' : '≥'} ${s.target_value}` : '—',
          s.alert_threshold != null ? s.alert_threshold.toString() : '—',
          m?.status ?? 'no_data',
        ]
      }),
      ...tableStyles(ctx),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6
  }

  if (input.audits.length > 0) {
    y = ensurePage(doc, ctx, y, 30)
    y = subHeading(doc, margin, y, 'Internal Audits')
    autoTable(doc, {
      startY: y,
      head: [['Code', 'Title', 'Type', 'Scheduled', 'Status', 'Findings']],
      body: input.audits.map((a) => [
        a.audit_code, a.title, a.audit_type,
        a.scheduled_date ? formatZuluDate(a.scheduled_date) : '—',
        a.status,
        `${a.findings_open} open / ${a.findings_closed} closed`,
      ]),
      ...tableStyles(ctx),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6
  }

  if (input.mocs.length > 0) {
    y = ensurePage(doc, ctx, y, 30)
    y = subHeading(doc, margin, y, 'Management of Change')
    autoTable(doc, {
      startY: y,
      head: [['Code', 'Title', 'Category', 'Status', 'Effective']],
      body: input.mocs.map((m) => [
        m.moc_code, m.title, m.change_category, m.status,
        m.effective_date ? formatZuluDate(m.effective_date) : '—',
      ]),
      ...tableStyles(ctx),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6
  }

  // ── Section 4 — Safety Promotion ───────────────────────────
  y = ensurePage(doc, ctx, y, 30)
  y = sectionHeading(doc, margin, y, '4. Safety Promotion (AC 150/5200-37A §6.5)')

  doc.setFontSize(10); doc.setTextColor(40)
  doc.text(`Safety reports received (all sources): ${input.reports.length}`, margin, y); y += 5
  const openReports = input.reports.filter(r => r.triage_status === 'new' || r.triage_status === 'reviewing').length
  doc.text(`Open for triage: ${openReports}`, margin, y); y += 5
  const promoted = input.reports.filter(r => r.triage_status === 'promoted').length
  doc.text(`Promoted to hazards: ${promoted}`, margin, y); y += 8

  doc.setFontSize(8); doc.setTextColor(100)
  const promo = sanitizePdfText(
    'Per AC 150/5200-37A §6.5.2, anonymous reporting via /[icao]/sms-report and non-retribution are foundational to this SMS. Reports submitted in good faith are protected.',
  )
  const lines = doc.splitTextToSize(promo, contentWidth) as string[]
  doc.text(lines, margin, y)
  y += lines.length * 4 + 4

  drawFooter(ctx)

  const filename = `sms-manual-${(input.baseIcao ?? 'base').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`
  return { doc, filename }
}

// ────────────────────────────────────────────────────────────────
// SPI 12-month Performance Report
// ────────────────────────────────────────────────────────────────

export function buildSpiReportPdf(input: {
  baseName?: string | null
  baseIcao?: string | null
  spis: SmsSpi[]
  measurementsBySpi: Map<string, SmsSpiMeasurement[]>
}): { doc: ReturnType<typeof createPdf>['doc']; filename: string } {
  const ctx = createPdf({ orientation: 'landscape' })
  const { doc, margin, contentWidth } = ctx

  let y = drawBaseHeader(ctx, 12, { baseName: input.baseName, baseIcao: input.baseIcao, sectionLabel: 'SMS — SPI PERFORMANCE REPORT' })
  y = drawReportTitle(ctx, y, { title: 'SPI Performance — Trailing 12 Months', subtitle: `Compiled ${formatZuluDate(new Date().toISOString().slice(0, 10))}` })

  for (const spi of input.spis) {
    const series = input.measurementsBySpi.get(spi.id) ?? []
    if (series.length === 0) continue
    y = subHeading(doc, margin, y, `${spi.code} — ${spi.title}`)
    autoTable(doc, {
      startY: y,
      head: [['Period Start', 'Period End', 'Value', 'Status', 'Computed By']],
      body: series.map((m) => [
        formatZuluDate(m.period_start),
        formatZuluDate(m.period_end),
        m.value.toString() + (spi.unit === 'percent' ? '%' : ''),
        m.status,
        m.computed_by,
      ]),
      ...tableStyles(ctx),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 5
    y = ensurePage(doc, ctx, y, 30)
  }

  drawFooter(ctx)

  const filename = `sms-spi-report-${(input.baseIcao ?? 'base').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`
  return { doc, filename }
}

// ────────────────────────────────────────────────────────────────
// Hazard Register CSV export
// ────────────────────────────────────────────────────────────────

export function hazardRegisterToCsv(hazards: SmsHazard[]): string {
  const headers = [
    'hazard_code', 'title', 'description', 'source_type', 'status',
    'current_band', 'residual_band',
    'identified_at', 'closed_at', 'closure_rationale',
  ]
  const rows = hazards.map((h) => headers.map((k) => csvEscape((h as unknown as Record<string, unknown>)[k])))
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n')
}

export function mocLogToCsv(mocs: SmsMoc[]): string {
  const headers = [
    'moc_code', 'title', 'change_category', 'status',
    'change_description', 'risk_analysis_summary',
    'proposed_at', 'effective_date', 'approved_at', 'rejection_reason',
  ]
  const rows = mocs.map((m) => headers.map((k) => csvEscape((m as unknown as Record<string, unknown>)[k])))
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n')
}

function csvEscape(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

/** Browser-side blob download helper. */
export function downloadBlob(content: string, filename: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ────────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────────

function sectionHeading(doc: ReturnType<typeof createPdf>['doc'], x: number, y: number, label: string): number {
  doc.setFontSize(12); doc.setTextColor(20); doc.setFont('helvetica', 'bold')
  doc.text(sanitizePdfText(label), x, y)
  doc.setFont('helvetica', 'normal')
  return y + 7
}

function subHeading(doc: ReturnType<typeof createPdf>['doc'], x: number, y: number, label: string): number {
  doc.setFontSize(10); doc.setTextColor(60); doc.setFont('helvetica', 'bold')
  doc.text(sanitizePdfText(label), x, y)
  doc.setFont('helvetica', 'normal')
  return y + 5
}

function placeholder(doc: ReturnType<typeof createPdf>['doc'], x: number, y: number, text: string) {
  doc.setFontSize(9); doc.setTextColor(140)
  doc.text(sanitizePdfText(text), x, y)
}

function bandLabel(band: string | null | undefined): string {
  if (!band) return 'unassessed'
  return band.toUpperCase()
}

function ensurePage(doc: ReturnType<typeof createPdf>['doc'], ctx: { pageHeight: number }, y: number, needed: number): number {
  if (y + needed > ctx.pageHeight - 15) {
    doc.addPage()
    return 15
  }
  return y
}

// Pull r,g,b out of an rgba(...) / rgb(...) CSS string for autoTable.
function hexToRgbFromCss(css: string): [number, number, number] | null {
  const m = css.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/)
  if (!m) return null
  return [Math.round(parseFloat(m[1])), Math.round(parseFloat(m[2])), Math.round(parseFloat(m[3]))]
}
