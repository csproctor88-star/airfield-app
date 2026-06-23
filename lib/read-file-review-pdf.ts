import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  createPdf, drawBaseHeader, drawReportTitle, drawStatBox, drawFooter, tableStyles,
} from '@/lib/pdf-utils'
import { formatZuluDateTime } from '@/lib/utils'
import {
  partitionReviewers,
  type ReadFileRow, type ReadFileAckRow, type ReadFileReviewer,
} from '@/lib/supabase/read-files'

export interface ReadFileReviewPdfInput {
  baseName?: string | null
  baseIcao?: string | null
  files: ReadFileRow[]          // active files
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
  const ctx = createPdf({ orientation: 'portrait', format: 'letter' })
  const doc = ctx.doc

  let y = drawBaseHeader(ctx, 15, { baseName, baseIcao })
  y = drawReportTitle(ctx, y, {
    title: 'Read File Review Report',
    subtitle: `Generated ${formatZuluDateTime(generatedAtIso)}`,
  })

  // Summary: active files, required reviewers, # fully reviewed at current version.
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

  if (files.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text('No active read files at this base.', ctx.margin, y + 4)
  }

  for (const f of files) {
    const acksForVersion = acks.filter(a => a.read_file_id === f.id && a.acknowledged_version === f.version)
    const ackByUser = new Map(acksForVersion.map(a => [a.user_id, a]))
    const rows = reviewers.map(r => {
      const a = ackByUser.get(r.user_id)
      return [
        reviewerLabel(r),
        a ? 'REVIEWED' : 'OUTSTANDING',
        a ? formatZuluDateTime(a.acknowledged_at) : '—',
        a?.initials_snapshot ?? (a ? '' : '—'),
      ]
    })
    autoTable(doc, {
      ...tableStyles(ctx),
      startY: y + 6,
      head: [[`${f.title}  (v${f.version})`, 'Status', 'Date', 'Initials']],
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
    y = (doc as any).lastAutoTable.finalY + 6
  }

  drawFooter(ctx)
  const filename = `read-file-review-${(baseIcao || 'base').toLowerCase()}.pdf`
  return { doc, filename }
}
