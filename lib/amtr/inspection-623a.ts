import { COMMENT_TEMPLATES } from './reference-data'
import type { InspectionItemResponse } from '@/lib/supabase/amtr-inspections'

/**
 * Compose the NAMT/Certifier 623a comment for a completed records inspection,
 * using the recordsInspection DAFMAN template header and listing each
 * discrepancy's item number, detail, and corrective action.
 */
export function buildInspection623aComment(input: {
  inspectionDate: string
  inspectorName?: string | null
  items: InspectionItemResponse[]
}): string {
  const tpl = COMMENT_TEMPLATES.find((t) => t.key === 'recordsInspection')
  const header = tpl ? `(${tpl.label} — IAW ${tpl.cite})` : '(Monthly Training Records Inspection)'
  const gaps = input.items.filter((it) => it.status === 'no')

  const lines: string[] = [header, '', `Inspection Date: ${input.inspectionDate}`]
  if (input.inspectorName) lines.push(`Inspector: ${input.inspectorName}`)
  lines.push('')

  if (gaps.length === 0) {
    lines.push('No discrepancies noted.')
  } else {
    lines.push(`Discrepancies (${gaps.length}):`)
    for (const g of gaps) {
      const detail = (g.detail ?? (g.findings ?? []).join(' · ')).trim()
      lines.push(`${g.item_number} — ${detail || 'discrepancy noted'}`)
      const ca = (g.correctiveAction ?? g.note ?? '').trim()
      if (ca) lines.push(`      Corrective Action: ${ca}`)
    }
  }
  return lines.join('\n')
}

/** The entry_type stamped on the 623A entry a completed records inspection
 *  auto-generates. Records inspections are signed by the Trainee + NAMT only
 *  (no Trainer), so the gap/completeness engine and the server-side
 *  required-slots function special-case this exact type. */
export const RECORDS_INSPECTION_ENTRY_TYPE = 'Monthly Training Records Inspection'

/** True when a 623A entry is an auto-generated records-inspection entry. */
export function isRecordsInspectionEntry(entryType: unknown): boolean {
  return String(entryType ?? '').trim().toLowerCase() === RECORDS_INSPECTION_ENTRY_TYPE.toLowerCase()
}
