// lib/flip-changes-pdf.ts
import autoTable from 'jspdf-autotable'
import { createPdf, drawBaseHeader, drawReportTitle, drawStatBox, drawFooter, tableStyles, BLOCK_POST_SPACING_MM } from '@/lib/pdf-utils'
import type { FlipChange } from '@/lib/supabase/flip'

export const CHANGE_CONTENT: { key: 'additions' | 'deletions' | 'revisions_from' | 'revisions_to'; label: string; abbr: string }[] = [
  { key: 'additions', label: 'Additions', abbr: 'Add' },
  { key: 'deletions', label: 'Deletions', abbr: 'Del' },
  { key: 'revisions_from', label: 'Revisions From', abbr: 'Rev-From' },
  { key: 'revisions_to', label: 'Revisions To', abbr: 'Rev-To' },
]

/** Display status — rejected changes carry stage='completed', so surface 'Rejected'. */
export function changeStatus(c: FlipChange): string {
  if (c.rejected) return 'Rejected'
  return ({ coordination: 'Coordination', submitted: 'Submitted', completed: 'Published' } as const)[c.stage]
}
/** Short labels for the change-content categories present on a change. */
export function changeContentAbbrs(c: FlipChange): string[] {
  return CHANGE_CONTENT.filter((ct) => c[ct.key]).map((ct) => ct.abbr)
}

export function generateFlipChangesReportPdf(input: {
  changes: FlipChange[]; baseName?: string; baseIcao?: string
  filters?: { flip?: string; status?: string; content?: string[] }
}): { doc: import('jspdf').jsPDF; filename: string } {
  const { changes } = input
  const ctx = createPdf({ orientation: 'landscape' })
  let y = 15
  y = drawBaseHeader(ctx, y, { baseName: input.baseName, baseIcao: input.baseIcao })
  y = drawReportTitle(ctx, y, { title: 'FLIP CHANGES REPORT', subtitle: 'DAFMAN 13-204V2 §2.5.2.18.2.2' })

  const stats: { label: string; value: string }[] = [{ label: 'Total Changes', value: String(changes.length) }]
  if (input.filters?.flip) stats.push({ label: 'FLIP', value: input.filters.flip })
  if (input.filters?.status) stats.push({ label: 'Status', value: input.filters.status })
  if (input.filters?.content?.length) stats.push({ label: 'Content', value: input.filters.content.join(', ') })
  y = drawStatBox(ctx, y, stats)
  y += BLOCK_POST_SPACING_MM

  autoTable(ctx.doc, {
    startY: y,
    head: [['FLIP Title', 'Content', 'Reference Doc & Page', 'NOTAM', 'Status', 'Submitted By', 'Coordinated', 'Published']],
    body: changes.map((c) => [
      c.flip_title,
      changeContentAbbrs(c).join(', ') || '—',
      c.reference_doc_page ?? '—',
      c.notam ?? '—',
      changeStatus(c),
      c.submitted_by_name,
      c.coordinated_at.slice(0, 10),
      c.published_date ?? '—',
    ]),
    ...tableStyles(ctx),
  })

  drawFooter(ctx)
  const today = new Date().toISOString().slice(0, 10)
  return { doc: ctx.doc, filename: `flip-changes-report-${today}.pdf` }
}
