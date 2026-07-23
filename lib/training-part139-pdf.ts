/**
 * Per-user §139.303 training transcript PDF.
 *
 * Generated client-side via jsPDF + jspdf-autotable. Returns the
 * standard { doc, filename } pair so the caller can save() or
 * email via sendPdfViaEmail().
 *
 * Sections (in order):
 *   1. Header — base name, ICAO, "TRAINING RECORDS" section label
 *   2. Title block — "§139.303 Training Transcript" + user identity
 *   3. Stat box — As-of date / total topics / current / expiring / expired
 *   4. Topic table — one row per active topic with latest status
 *   5. Renewal history — per topic with > 1 record, oldest → newest
 *   6. Certificates table — AAAE / ACE rows, if any
 */

import autoTable from 'jspdf-autotable'
import { formatZuluDate, formatZuluDateTime } from '@/lib/utils'
import {
  createPdf,
  drawBaseHeader,
  drawReportTitle,
  drawStatBox,
  drawFooter,
  tableStyles,
  todayIso,
} from '@/lib/pdf-utils'
import {
  classifyTrainingStatus,
  type TrainingTopic,
  type TrainingRecord,
  type TrainingCertificate,
} from '@/lib/supabase/training-part139'

export type TrainingTranscriptInput = {
  base: { name: string | null; icao: string | null }
  user: { name: string; rank: string | null; email: string | null; role: string }
  topics: TrainingTopic[]       // active topics (dedup already done by caller)
  records: TrainingRecord[]     // all records for this user (caller-filtered)
  certificates: TrainingCertificate[]
}

export function generateTrainingTranscriptPdf(input: TrainingTranscriptInput): {
  doc: ReturnType<typeof createPdf>['doc']
  filename: string
} {
  const ctx = createPdf({ orientation: 'portrait', format: 'letter' })
  const { doc, margin, contentWidth, pageHeight } = ctx

  // ── Header
  let y = margin + 4
  y = drawBaseHeader(ctx, y, {
    baseName: input.base.name,
    baseIcao: input.base.icao,
    sectionLabel: 'TRAINING RECORDS',
  })

  // ── Title block
  const userLine = `${input.user.rank ? input.user.rank + ' ' : ''}${input.user.name}`
  y = drawReportTitle(ctx, y, {
    title: '§139.303 Training Transcript',
    subtitle: `${userLine}${input.user.email ? '  ·  ' + input.user.email : ''}`,
  })

  // ── Compute counts for stat box
  const topicByCode = new Map<string, TrainingTopic>()
  for (const t of input.topics) {
    const prior = topicByCode.get(t.code)
    if (!prior || (t.base_id && !prior.base_id)) topicByCode.set(t.code, t)
  }
  const activeTopics = Array.from(topicByCode.values()).sort((a, b) => a.sort_order - b.sort_order)

  // Records grouped by topic code, newest first
  const topicCodeById = new Map(input.topics.map(t => [t.id, t.code] as const))
  const recordsByCode = new Map<string, TrainingRecord[]>()
  const sorted = [...input.records].sort((a, b) => (b.completed_at > a.completed_at ? 1 : -1))
  for (const r of sorted) {
    const code = topicCodeById.get(r.topic_id)
    if (!code) continue
    const arr = recordsByCode.get(code) ?? []
    arr.push(r)
    recordsByCode.set(code, arr)
  }

  let current = 0, expiring = 0, expired = 0, notStarted = 0
  for (const t of activeTopics) {
    const latest = recordsByCode.get(t.code)?.[0] ?? null
    const status = classifyTrainingStatus(latest)
    if (status === 'current') current++
    else if (status === 'expiring') expiring++
    else if (status === 'expired') expired++
    else notStarted++
  }

  y = drawStatBox(ctx, y, [
    { label: 'As of',         value: formatZuluDate(new Date().toISOString()) },
    { label: 'Required',      value: String(activeTopics.length) },
    { label: 'Current',       value: String(current) },
    { label: 'Expiring',      value: String(expiring) },
    { label: 'Expired',       value: String(expired) },
    { label: 'Not started',   value: String(notStarted) },
  ])

  // ── Topic-level summary table
  const topicRows = activeTopics.map(t => {
    const latest = recordsByCode.get(t.code)?.[0] ?? null
    const status = classifyTrainingStatus(latest)
    return [
      t.code,
      t.title,
      status.toUpperCase().replace(/_/g, ' '),
      latest ? formatZuluDate(latest.completed_at) : '—',
      latest?.expires_at ? formatZuluDate(latest.expires_at) : '—',
      latest ? latest.training_type : '—',
    ]
  })

  autoTable(doc, {
    ...tableStyles(ctx),
    startY: y,
    head: [['Code', 'Topic', 'Status', 'Completed', 'Expires', 'Type']],
    body: topicRows,
    columnStyles: {
      0: { cellWidth: 24, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 24, halign: 'center' },
      5: { cellWidth: 22, halign: 'center' },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 2) {
        const v = data.cell.raw as string
        if (v === 'EXPIRED')      { data.cell.styles.fillColor  = [254, 226, 226]; data.cell.styles.textColor = [185, 28, 28] }
        else if (v === 'EXPIRING'){ data.cell.styles.fillColor  = [254, 243, 199]; data.cell.styles.textColor = [180, 83, 9] }
        else if (v === 'CURRENT') { data.cell.styles.fillColor  = [220, 252, 231]; data.cell.styles.textColor = [21, 128, 61] }
        else if (v === 'NOT STARTED') { data.cell.styles.fillColor = [241, 245, 249]; data.cell.styles.textColor = [71, 85, 105] }
      }
    },
    didDrawPage: () => drawFooter(ctx),
  })

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // ── Renewal history (for topics with > 1 record)
  const renewedTopics = activeTopics.filter(t => (recordsByCode.get(t.code)?.length ?? 0) > 1)
  if (renewedTopics.length > 0) {
    if (y > pageHeight - 60) { doc.addPage(); y = margin + 4 }
    doc.setFontSize(11)
    doc.setTextColor(0)
    doc.text('Renewal History', margin, y)
    y += 5

    for (const t of renewedTopics) {
      const chain = recordsByCode.get(t.code) ?? []
      const rows = chain.map((r, idx) => [
        idx === 0 ? 'Current' : `−${idx}`,
        r.training_type,
        formatZuluDate(r.completed_at),
        r.expires_at ? formatZuluDate(r.expires_at) : '—',
        r.notes ? r.notes.slice(0, 80) : '—',
      ])
      doc.setFontSize(8)
      doc.setTextColor(80)
      doc.text(`${t.code} — ${t.title}`, margin, y + 4)
      autoTable(doc, {
        ...tableStyles(ctx),
        startY: y + 6,
        head: [['#', 'Type', 'Completed', 'Expires', 'Notes']],
        body: rows,
        columnStyles: {
          0: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 22, halign: 'center' },
          2: { cellWidth: 24, halign: 'center' },
          3: { cellWidth: 24, halign: 'center' },
          4: { cellWidth: 'auto' },
        },
        didDrawPage: () => drawFooter(ctx),
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
    }
  }

  // ── Certificates table
  if (input.certificates.length > 0) {
    if (y > pageHeight - 60) { doc.addPage(); y = margin + 4 }
    doc.setFontSize(11)
    doc.setTextColor(0)
    doc.text('AAAE / ACE Certificates', margin, y)
    y += 5

    const certRows = input.certificates.map(c => {
      const status = c.expires_at
        ? classifyTrainingStatus({ expires_at: c.expires_at })
        : 'current'
      return [
        c.credential,
        formatZuluDate(c.issued_at),
        c.expires_at ? formatZuluDate(c.expires_at) : 'Lifetime',
        status.toUpperCase().replace(/_/g, ' '),
        c.notes ? c.notes.slice(0, 80) : '—',
      ]
    })

    autoTable(doc, {
      ...tableStyles(ctx),
      startY: y,
      head: [['Credential', 'Issued', 'Expires', 'Status', 'Notes']],
      body: certRows,
      columnStyles: {
        0: { cellWidth: 28, fontStyle: 'bold' },
        1: { cellWidth: 26, halign: 'center' },
        2: { cellWidth: 26, halign: 'center' },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 'auto' },
      },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 3) {
          const v = data.cell.raw as string
          if (v === 'EXPIRED')      { data.cell.styles.fillColor = [254, 226, 226]; data.cell.styles.textColor = [185, 28, 28] }
          else if (v === 'EXPIRING'){ data.cell.styles.fillColor = [254, 243, 199]; data.cell.styles.textColor = [180, 83, 9] }
          else if (v === 'CURRENT') { data.cell.styles.fillColor = [220, 252, 231]; data.cell.styles.textColor = [21, 128, 61] }
        }
      },
      didDrawPage: () => drawFooter(ctx),
    })
  }

  // Footer on the final page (some tables don't trigger didDrawPage)
  drawFooter(ctx)

  // contentWidth referenced to silence the unused-var linter:
  void contentWidth

  const safeName = (input.user.name || 'user').replace(/[^A-Za-z0-9]+/g, '_')
  const filename = `training-transcript-${safeName}-${todayIso()}.pdf`
  return { doc, filename }
}
