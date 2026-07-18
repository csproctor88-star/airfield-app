import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  createPdf, drawBaseHeader, drawReportTitle, drawStatBox, drawFooter, tableStyles,
} from '@/lib/pdf-utils'
import { sanitizePdfText } from '@/lib/pdf-config'
import { formatZuluDateTime } from '@/lib/utils'
import {
  partitionReviewers,
  type ReadFileRow, type ReadFileAckRow, type ReadFileReviewer,
} from '@/lib/supabase/read-files'

export interface ReadFileReviewPdfInput {
  baseName?: string | null
  baseIcao?: string | null
  /** Active (non-archived) files — caller filters. Drives the summary stat box. */
  files: ReadFileRow[]
  /** Archived files, rendered in a separate "Archived (history)" section
   *  after the active files. Excluded from the stat box — archived files are
   *  history, not live compliance. Optional (defaults to none). */
  archivedFiles?: ReadFileRow[]
  reviewers: ReadFileReviewer[] // required-reader roster
  acks: ReadFileAckRow[]        // all acks at the base
  /** ISO timestamp for the subtitle (Date.now is fine to pass from the caller). */
  generatedAtIso: string
}

function reviewerLabel(u: ReadFileReviewer): string {
  const last = u.name.split(/\s+/).slice(-1)[0]
  const base = u.rank ? `${u.rank} ${last}` : last
  return u.operating_initials ? `${base} (${u.operating_initials})` : base
}

export async function generateReadFileReviewPdf(
  input: ReadFileReviewPdfInput,
): Promise<{ doc: jsPDF; filename: string }> {
  const { baseName, baseIcao, files, reviewers, acks, generatedAtIso } = input
  const archivedFiles = input.archivedFiles ?? []
  const ctx = createPdf({ orientation: 'portrait', format: 'letter' })
  const doc = ctx.doc
  const s = sanitizePdfText  // shorthand — em dashes etc. render as missing glyphs in the standard PDF font

  let y = drawBaseHeader(ctx, 15, { baseName, baseIcao })
  y = drawReportTitle(ctx, y, {
    title: 'Read File Review Report',
    subtitle: `Generated ${formatZuluDateTime(generatedAtIso)}`,
  })

  // Summary: active files, required reviewers, # fully reviewed at current
  // version. Archived files are deliberately excluded — they're history, not
  // live compliance — so they never move any of these three numbers.
  const fullyReviewed = files.filter(f => {
    const acksForVersion = acks.filter(a => a.read_file_id === f.id && a.acknowledged_version === f.version)
    const { outstanding } = partitionReviewers(reviewers, acksForVersion)
    return outstanding.length === 0
  }).length
  y = drawStatBox(ctx, y, [
    { label: 'Active files', value: String(files.length) },
    { label: 'Required reviewers', value: String(reviewers.length) },
    { label: 'Fully reviewed', value: `${fullyReviewed}/${files.length}` },
  ])

  // Make explicit that archived files are appended below but sit outside the
  // stats above — so a reader can't mistake the history section for a gap.
  if (archivedFiles.length > 0) {
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(s(`Archived files included for history: ${archivedFiles.length}`), ctx.margin, y + 2)
    y += 6
  }

  if (files.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text(s('No active read files at this base.'), ctx.margin, y + 4)
    y += 10
  }

  // One file's roster table. Shared by the active loop and the archived
  // (history) section so the two never drift in layout. Returns the advanced
  // y cursor.
  const renderFileTable = (f: ReadFileRow, startY: number): number => {
    const acksForVersion = acks.filter(a => a.read_file_id === f.id && a.acknowledged_version === f.version)
    const ackByUser = new Map(acksForVersion.map(a => [a.user_id, a]))
    const rows = reviewers.map(r => {
      const a = ackByUser.get(r.user_id)
      return [
        s(reviewerLabel(r)),
        a ? 'REVIEWED' : 'OUTSTANDING',
        a ? formatZuluDateTime(a.acknowledged_at) : s('—'),
        a?.initials_snapshot ?? (a ? '' : s('—')),
      ]
    })
    autoTable(doc, {
      ...tableStyles(ctx),
      startY: startY + 6,
      head: [[s(`${f.title}  (v${f.version})`), 'Status', 'Date', 'Initials']],
      body: rows,
      columnStyles: { 1: { cellWidth: 26 }, 2: { cellWidth: 38 }, 3: { cellWidth: 22 } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          data.cell.styles.textColor = data.cell.raw === 'REVIEWED' ? [34, 139, 64] : [200, 0, 0]
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (doc as any).lastAutoTable.finalY + 6
  }

  for (const f of files) {
    y = renderFileTable(f, y)
  }

  // Archived (history) — same per-file layout, clearly headed, kept out of
  // the stat box above. The archive confirm dialog promises archived files
  // stay in the report history, so the report must show them.
  if (archivedFiles.length > 0) {
    doc.setFontSize(12)
    doc.setTextColor(60)
    doc.text(s('Archived (history)'), ctx.margin, y + 8)
    y += 11
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(
      s('Retained for history only — excluded from the active-compliance summary above.'),
      ctx.margin, y + 2,
    )
    y += 5
    for (const f of archivedFiles) {
      y = renderFileTable(f, y)
    }
  }

  drawFooter(ctx)
  const filename = `read-file-review-${(baseIcao || 'base').toLowerCase()}.pdf`
  return { doc, filename }
}
