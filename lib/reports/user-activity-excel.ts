import type ExcelJS from 'exceljs'
import { createStyledWorkbook, addStyledSheet, type ColumnDef } from '@/lib/excel-export'
import { formatZuluDate } from '@/lib/utils'
import type { DomainDef, UserActivityData, UserActivityRow } from './user-activity-data'

// ── NAMO/NAMT Report Tool — Excel generator ─────────────────
// Spec: docs/superpowers/specs/2026-07-16-namo-namt-report-tool-design.md §Exports & PDF
// Sheet 1 "Summary" = the full matrix (full names, no truncation — unlike the
// PDF). One sheet per selected domain listing drill-down records. Coverage
// footnotes and the Unlinked/Unattributed rows are repeated here so the
// exported artifact is exactly as honest as the on-screen preview.

export interface UserActivityExcelOptions {
  domains: DomainDef[]
}

const CATEGORY_LABEL: Record<UserActivityRow['kind'], string> = {
  profile: 'Personnel',
  unlinked: 'Unlinked',
  unattributed: 'Unattributed',
}

/** Excel worksheet names: <=31 chars, no `* ? : \ / [ ]`. */
function safeSheetName(label: string): string {
  return label.replace(/[*?:\\/[\]]/g, '-').slice(0, 31)
}

export async function buildUserActivityWorkbook(
  data: UserActivityData,
  opts: UserActivityExcelOptions,
): Promise<ExcelJS.Workbook> {
  const wb = await createStyledWorkbook()

  // ── Sheet 1: Summary (full matrix, full names) ──
  const summaryColumns: ColumnDef[] = [
    { header: 'User', key: 'user', width: 30 },
    { header: 'Category', key: 'category', width: 14 },
    ...opts.domains.map((d): ColumnDef => ({ header: d.label, key: d.key, width: 20 })),
    { header: 'Total', key: 'total', width: 10 },
  ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summaryRows: Record<string, any>[] = data.rows.map((row) => ({
    user: row.display,
    category: CATEGORY_LABEL[row.kind],
    ...Object.fromEntries(opts.domains.map((d) => [d.key, row.counts[d.key] ?? 0])),
    total: row.total,
  }))

  const grandTotal = opts.domains.reduce((sum, d) => sum + (data.totals[d.key] ?? 0), 0)
  summaryRows.push({
    user: 'Totals',
    category: '',
    ...Object.fromEntries(opts.domains.map((d) => [d.key, data.totals[d.key] ?? 0])),
    total: grandTotal,
  })

  const summarySheet = addStyledSheet(wb, 'Summary', summaryColumns, summaryRows)

  // Bold the totals row (last data row, header is row 1).
  const totalsRow = summarySheet.getRow(summarySheet.rowCount)
  totalsRow.eachCell((cell) => { cell.font = { bold: true } })

  // Coverage honesty: repeat the same footnotes shown on screen / in the PDF.
  if (data.zeroActivityUnavailable || data.coverageNotes.length > 0) {
    summarySheet.addRow({})
    if (data.zeroActivityUnavailable) {
      summarySheet.addRow({
        user: 'Personnel with zero activity could not be loaded for this base — the matrix above reflects recorded activity only.',
      })
    }
    for (const note of data.coverageNotes) {
      const def = opts.domains.find((d) => d.key === note.domain)
      summarySheet.addRow({
        user: `${def?.label ?? note.domain}: per-user attribution begins ${formatZuluDate(note.coverageStart)}; `
          + `${note.affected} record${note.affected === 1 ? '' : 's'} in this range lack${note.affected === 1 ? 's' : ''} per-user attribution.`,
      })
    }
  }

  // ── One sheet per selected domain: drill-down records (user, label, date) ──
  for (const d of opts.domains) {
    const detailRows: { user: string; label: string; date: string; ts: string }[] = []
    for (const row of data.rows) {
      const recs = row.records[d.key] ?? []
      for (const rec of recs) {
        detailRows.push({ user: row.display, label: rec.label, date: formatZuluDate(rec.ts), ts: rec.ts })
      }
    }
    detailRows.sort((a, b) => a.ts.localeCompare(b.ts))

    addStyledSheet(
      wb,
      safeSheetName(d.label),
      [
        { header: 'User', key: 'user', width: 30 },
        { header: 'Record', key: 'label', width: 36 },
        { header: 'Date', key: 'date', width: 16 },
      ],
      detailRows.map(({ user, label, date }) => ({ user, label, date })),
    )
  }

  return wb
}
