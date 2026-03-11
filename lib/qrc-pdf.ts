import jsPDF from 'jspdf'
import type { QrcExecution, QrcTemplate, QrcStep, QrcStepResponse } from '@/lib/supabase/types'
import { formatZuluDate, formatZuluDateTime } from '@/lib/utils'

interface QrcPdfInput {
  execution: QrcExecution
  template: QrcTemplate | null
  baseName?: string
  baseIcao?: string
}

export async function generateQrcPdf(input: QrcPdfInput): Promise<{ doc: jsPDF; filename: string }> {
  const { execution, template, baseName, baseIcao } = input
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - 20) {
      doc.addPage()
      y = margin
    }
  }

  const responses = (execution.step_responses || {}) as Record<string, QrcStepResponse>
  const steps = template?.steps || []
  const scnData = (execution.scn_data || {}) as Record<string, unknown>

  // ── Header ──
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text(baseName ? `${baseName.toUpperCase()}${baseIcao ? ` (${baseIcao})` : ''}` : 'AIRFIELD OPERATIONS', margin, y)
  y += 4
  doc.text('AIRFIELD MANAGEMENT SECTION', margin, y)
  y += 8

  // ── Title ──
  doc.setFontSize(16)
  doc.setTextColor(0)
  doc.text(`QRC-${execution.qrc_number} EXECUTION REPORT`, margin, y)
  y += 7

  doc.setFontSize(11)
  doc.setTextColor(60)
  doc.text(execution.title, margin, y)
  y += 8

  // ── Info box ──
  doc.setDrawColor(200)
  doc.setFillColor(248, 248, 248)
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'FD')

  const col1 = margin + 4
  const col2 = margin + contentWidth / 3
  const col3 = margin + (contentWidth * 2) / 3

  doc.setFontSize(7)
  doc.setTextColor(120)
  doc.text('Status:', col1, y + 5)
  doc.text('Opened:', col2, y + 5)
  doc.text('Closed:', col3, y + 5)

  doc.setFontSize(9)
  doc.setTextColor(0)
  doc.text(execution.status === 'closed' ? 'CLOSED' : 'OPEN', col1, y + 10)

  const openedAt = execution.opened_at ? new Date(execution.opened_at) : null
  doc.text(
    openedAt
      ? `${formatZuluDate(openedAt)} @ ${openedAt.toISOString().slice(11, 16)}Z${execution.open_initials ? ` (${execution.open_initials})` : ''}`
      : 'N/A',
    col2, y + 10,
  )

  const closedAt = execution.closed_at ? new Date(execution.closed_at) : null
  doc.text(
    closedAt
      ? `${formatZuluDate(closedAt)} @ ${closedAt.toISOString().slice(11, 16)}Z${execution.close_initials ? ` (${execution.close_initials})` : ''}`
      : 'N/A',
    col3, y + 10,
  )

  // Progress line
  function flattenSteps(s: QrcStep[]): QrcStep[] {
    const flat: QrcStep[] = []
    for (const step of s) {
      flat.push(step)
      if (step.sub_steps) flat.push(...flattenSteps(step.sub_steps))
    }
    return flat
  }
  const allSteps = flattenSteps(steps)
  const checkable = allSteps.filter(s => s.type !== 'conditional')
  const completed = checkable.filter(s => responses[s.id]?.completed)

  doc.setFontSize(7)
  doc.setTextColor(120)
  doc.text('Progress:', col1, y + 17)
  doc.setFontSize(9)
  doc.setTextColor(0)
  doc.text(`${completed.length} / ${checkable.length} steps completed (${checkable.length > 0 ? Math.round((completed.length / checkable.length) * 100) : 0}%)`, col2, y + 17)

  y += 30

  // ── References ──
  if (template?.references) {
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text(`Reference: ${template.references}`, margin, y)
    y += 6
  }

  // ── Warning Notes ──
  if (template?.notes) {
    checkPageBreak(12)
    doc.setFontSize(9)
    doc.setTextColor(200, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.text('NOTE:', margin, y)
    doc.setFont('helvetica', 'normal')
    const noteLines = doc.splitTextToSize(template.notes, contentWidth - 15)
    doc.text(noteLines, margin + 15, y)
    y += noteLines.length * 4 + 4
  }

  // ── SCN Form ──
  if (template?.has_scn_form && template.scn_fields) {
    checkPageBreak(20)
    doc.setFontSize(10)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.text('SECONDARY CRASH NET (SCN) FORM', margin, y)
    y += 6
    doc.setFont('helvetica', 'normal')

    const fields = ((template.scn_fields as { fields?: { key: string; label: string }[] }).fields || [])
    for (const field of fields) {
      checkPageBreak(10)
      doc.setFontSize(8)
      doc.setTextColor(100)
      doc.text(field.label + ':', margin, y)
      y += 4
      doc.setFontSize(9)
      doc.setTextColor(0)
      const val = String(scnData[field.key] || '—')
      const valLines = doc.splitTextToSize(val, contentWidth)
      doc.text(valLines, margin + 2, y)
      y += valLines.length * 4 + 3
    }
    y += 2
  }

  // ── Steps ──
  checkPageBreak(12)
  doc.setFontSize(10)
  doc.setTextColor(0)
  doc.setFont('helvetica', 'bold')
  doc.text('CHECKLIST STEPS', margin, y)
  y += 7

  function renderStepPdf(step: QrcStep, depth: number) {
    const resp = responses[step.id] || {}
    const checked = resp.completed ?? false
    const indent = margin + depth * 8

    checkPageBreak(14)

    // Step number + checkbox symbol
    doc.setFontSize(9)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    const symbol = checked ? '\u2713' : '\u2610'
    doc.text(`${step.id}. [${symbol}]`, indent, y)
    doc.setFont('helvetica', 'normal')

    // Label
    const labelX = indent + 16
    const labelWidth = contentWidth - (labelX - margin)
    doc.setTextColor(checked ? 100 : 0)
    const labelLines = doc.splitTextToSize(step.label, labelWidth)
    doc.text(labelLines, labelX, y)
    y += labelLines.length * 4

    // Step note (guidance)
    if (step.note) {
      doc.setFontSize(7)
      doc.setTextColor(130)
      const noteLines = doc.splitTextToSize(step.note, labelWidth)
      doc.text(noteLines, labelX, y)
      y += noteLines.length * 3 + 1
    }

    // Response details
    if (step.type === 'fill_field' || step.type === 'time_field') {
      if (resp.value) {
        doc.setFontSize(8)
        doc.setTextColor(0, 100, 0)
        doc.text(`${step.field_label || 'Value'}: ${resp.value}`, labelX, y)
        y += 4
      }
    }

    if (step.type === 'notify_agencies' && resp.agencies_checked && resp.agencies_checked.length > 0) {
      doc.setFontSize(8)
      doc.setTextColor(0, 100, 0)
      doc.text(`Notified: ${resp.agencies_checked.join(', ')}`, labelX, y)
      y += 4
    }

    if (resp.notes) {
      doc.setFontSize(8)
      doc.setTextColor(60)
      const respNoteLines = doc.splitTextToSize(`Note: ${resp.notes}`, labelWidth)
      doc.text(respNoteLines, labelX, y)
      y += respNoteLines.length * 3 + 1
    }

    // Timestamp
    if (checked && resp.completed_at) {
      doc.setFontSize(7)
      doc.setTextColor(150)
      doc.text(`Completed: ${formatZuluDateTime(new Date(resp.completed_at))}`, labelX, y)
      y += 3
    }

    y += 3

    // Sub-steps
    if (step.sub_steps) {
      for (const sub of step.sub_steps) {
        renderStepPdf(sub, depth + 1)
      }
    }
  }

  doc.setFont('helvetica', 'normal')
  for (const step of steps) {
    renderStepPdf(step, 0)
  }

  // ── Footer on all pages ──
  const displayId = `QRC-${execution.qrc_number}`
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150)
    const footerY = pageHeight - 8
    doc.text(
      `${displayId} — Page ${i} of ${totalPages} — Generated ${formatZuluDate(new Date())}`,
      margin,
      footerY,
    )
    if (baseName) {
      doc.text(
        `${baseName}${baseIcao ? ` (${baseIcao})` : ''} — AIRFIELD OPS`,
        pageWidth - margin,
        footerY,
        { align: 'right' },
      )
    }
  }

  const dateStr = closedAt ? formatZuluDate(closedAt) : formatZuluDate(new Date())
  const filename = `QRC-${execution.qrc_number}_${execution.title.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.pdf`
  return { doc, filename }
}
