import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatZuluDate, formatZuluDateTime } from '@/lib/utils'
import { sanitizePdfText } from '@/lib/pdf-config'
import {
  createPdf,
  drawBaseHeader,
  drawReportTitle,
  drawStatBox,
  drawFooter,
  tableStyles,
  todayIso,
} from '@/lib/pdf-utils'
import type { ContractorRow } from '@/lib/supabase/contractors'
import { getTerm, type AirportType } from '@/lib/airport-mode'

interface PersonnelPdfInput {
  contractors: ContractorRow[]
  filterLabel: string  // e.g., "Active", "All", "Completed"
  searchQuery?: string
  baseName?: string | null
  baseIcao?: string | null
  /** Drives mode-aware label rendering ("AF Form 483" → "SIDA Badge" on civilian). */
  airportType?: AirportType
}

function af483Status(exp: string | null): string {
  if (!exp) return ''
  try {
    const expDate = new Date(exp + 'T00:00:00')
    const now = new Date()
    const days = Math.round((expDate.getTime() - now.getTime()) / 86400000)
    if (days < 0) return ` (EXPIRED ${Math.abs(days)}d)`
    if (days <= 30) return ` (exp ${days}d)`
    return ''
  } catch { return '' }
}

export async function generatePersonnelPdf(input: PersonnelPdfInput): Promise<{ doc: jsPDF; filename: string }> {
  const { contractors, filterLabel, searchQuery, baseName, baseIcao, airportType } = input
  const mode: AirportType = airportType ?? 'usaf'
  const credentialLabel = getTerm('form_483', mode) // "AF Form 483" or "SIDA Badge Log"
  const ctx = createPdf({ orientation: 'landscape' })
  const { doc, margin } = ctx
  let y = margin

  y = drawBaseHeader(ctx, y, { baseName, baseIcao })
  y = drawReportTitle(ctx, y, {
    title: 'PERSONNEL ON AIRFIELD',
    subtitle: `Filter: ${filterLabel}${searchQuery ? ` · Search: "${searchQuery}"` : ''}`,
  })

  const activeCount = contractors.filter(c => c.status === 'active').length
  const completedCount = contractors.filter(c => c.status === 'completed').length
  y = drawStatBox(ctx, y, [
    { label: 'Active', value: String(activeCount) },
    { label: 'Completed', value: String(completedCount) },
    { label: 'Total Shown', value: String(contractors.length) },
    { label: 'Generated', value: formatZuluDateTime(new Date()) },
  ])

  if (contractors.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text('No personnel match the current filter.', margin, y)
  } else {
    autoTable(doc, {
      ...tableStyles(ctx),
      startY: y,
      head: [['Status', 'Company', 'Contact', 'Phone', 'Location', 'Work', 'Radio', 'Flag', 'Callsign', credentialLabel, 'Start', 'End']],
      body: contractors.map(c => {
        const af483 = c.af_form_483
          ? `${c.af_form_483}${af483Status(c.af_form_483_expiration)}`
          : ''
        return [
          c.status === 'active' ? 'ACTIVE' : 'CLOSED',
          sanitizePdfText(c.company_name),
          sanitizePdfText(c.contact_name || ''),
          sanitizePdfText(c.contact_phone || ''),
          sanitizePdfText(c.location || ''),
          sanitizePdfText(c.work_description || ''),
          sanitizePdfText(c.radio_number || ''),
          sanitizePdfText(c.flag_number || ''),
          sanitizePdfText(c.callsign || ''),
          sanitizePdfText(af483),
          c.start_date ? formatZuluDate(new Date(c.start_date + 'T00:00:00')) : '',
          c.end_date ? formatZuluDate(new Date(c.end_date + 'T00:00:00')) : '',
        ]
      }),
      columnStyles: {
        0: { cellWidth: 14, halign: 'center' },
        1: { cellWidth: 30 },
        2: { cellWidth: 22 },
        3: { cellWidth: 22 },
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 9) {
          // Credential column (AF Form 483 / SIDA Badge) — color expired entries red
          const text = hookData.cell.text.join(' ')
          if (text.includes('EXPIRED')) {
            hookData.cell.styles.textColor = [220, 38, 38]
            hookData.cell.styles.fontStyle = 'bold'
          }
        }
      },
      didDrawPage: () => drawFooter(ctx),
    })
  }

  return { doc, filename: `personnel-${filterLabel.toLowerCase()}-${todayIso()}.pdf` }
}
