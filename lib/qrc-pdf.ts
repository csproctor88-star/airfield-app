import jsPDF from 'jspdf'
import type { QrcExecution, QrcTemplate, QrcStep, QrcStepResponse } from '@/lib/supabase/types'
import { formatZuluDate, formatZuluDateTime } from '@/lib/utils'
import { getStepStatus } from '@/lib/qrc-step-status'
import { STEP_ROW_GAP_MM, BLOCK_POST_SPACING_MM } from '@/lib/pdf-utils'

interface QrcPdfInput {
  execution: QrcExecution
  template: QrcTemplate | null
  baseName?: string | null
  baseIcao?: string | null
}

// Brand palette (RGB tuples) for jsPDF — mirrors the on-screen tokens.
const COLOR = {
  cyan:    [14, 165, 184] as const,    // var(--color-cyan)
  amber:   [217, 119, 6] as const,     // var(--color-amber) (light-mode shade for print)
  success: [34, 139, 64] as const,     // green for DONE pill
  danger:  [200, 0, 0] as const,
  text1:   [15, 23, 42] as const,      // near-black
  text2:   [60, 60, 60] as const,
  text3:   [120, 120, 120] as const,
  text4:   [160, 160, 160] as const,
  bgInset: [241, 245, 249] as const,   // subtle gray fill for note blocks
  bgRule:  [220, 226, 235] as const,   // border-mid
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

  const setFill = (rgb: readonly [number, number, number]) => doc.setFillColor(rgb[0], rgb[1], rgb[2])
  const setText = (rgb: readonly [number, number, number]) => doc.setTextColor(rgb[0], rgb[1], rgb[2])
  const setDraw = (rgb: readonly [number, number, number]) => doc.setDrawColor(rgb[0], rgb[1], rgb[2])

  const responses = (execution.step_responses || {}) as Record<string, QrcStepResponse>
  const steps = (template?.steps as unknown as QrcStep[] | null) || []
  const scnData = (execution.scn_data || {}) as Record<string, unknown>

  // ── Header band ── cyan accent bar + base name ──
  const headerH = 12
  setFill(COLOR.cyan)
  doc.rect(margin, y, 2, headerH, 'F')
  doc.setFontSize(8)
  setText(COLOR.text3)
  doc.text(baseName ? `${baseName.toUpperCase()}${baseIcao ? ` · ${baseIcao}` : ''}` : 'AIRFIELD OPERATIONS', margin + 5, y + 4)
  setText(COLOR.text4)
  doc.setFontSize(7)
  doc.text('AIRFIELD MANAGEMENT SECTION', margin + 5, y + 8)
  y += headerH + 5  // clear space below cyan rule before next element

  // ── Title (with amber QRC chip) ──
  const qrcLabel = `QRC-${execution.qrc_number}`
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  const qrcWidth = doc.getTextWidth(qrcLabel) + 6
  const chipH = 6.5
  setFill(COLOR.amber)
  doc.roundedRect(margin, y, qrcWidth, chipH, 1, 1, 'F')
  setText([255, 255, 255])
  doc.text(qrcLabel, margin + 3, y + 4.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  setText(COLOR.text1)
  doc.text('EXECUTION REPORT', margin + qrcWidth + 4, y + 5)
  y += chipH + 4

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  setText(COLOR.text2)
  doc.text(execution.title, margin, y + 4)
  y += 9

  // ── Info box ──
  setDraw(COLOR.bgRule)
  setFill(COLOR.bgInset)
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'FD')

  const col1 = margin + 4
  const col2 = margin + contentWidth / 3
  const col3 = margin + (contentWidth * 2) / 3

  doc.setFontSize(7)
  setText(COLOR.text3)
  doc.text('STATUS', col1, y + 5)
  doc.text('OPENED', col2, y + 5)
  doc.text('CLOSED', col3, y + 5)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  if (execution.status === 'closed') setText(COLOR.success)
  else setText(COLOR.amber)
  doc.text(execution.status === 'closed' ? 'CLOSED' : 'OPEN', col1, y + 10)
  doc.setFont('helvetica', 'normal')
  setText(COLOR.text1)

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

  function flattenSteps(s: QrcStep[]): QrcStep[] {
    const flat: QrcStep[] = []
    for (const step of s) {
      flat.push(step)
      if (step.sub_steps) flat.push(...flattenSteps(step.sub_steps))
    }
    return flat
  }
  const allSteps = flattenSteps(steps)
  const checkable = allSteps.filter(s => s.type !== 'conditional' && s.type !== 'text' && s.type !== 'textarea')
  const naSteps = checkable.filter(s => getStepStatus(responses[s.id]) === 'not_applicable')
  const completedSteps = checkable.filter(s => getStepStatus(responses[s.id]) === 'completed')
  const denominator = checkable.length - naSteps.length
  const pct = denominator > 0 ? Math.round((completedSteps.length / denominator) * 100) : 0

  doc.setFontSize(7)
  setText(COLOR.text3)
  doc.text('PROGRESS', col1, y + 17)
  doc.setFontSize(9)
  setText(COLOR.text1)
  doc.setFont('helvetica', 'bold')
  const progressText = naSteps.length > 0
    ? `${completedSteps.length} / ${denominator} done  (${pct}%)   ·   ${naSteps.length} N/A`
    : `${completedSteps.length} / ${denominator} done  (${pct}%)`
  doc.text(progressText, col2, y + 17)
  doc.setFont('helvetica', 'normal')

  // Mini progress bar
  const barX = col2
  const barY = y + 19
  const barW = contentWidth * (2 / 3) - 8
  setFill(COLOR.bgRule)
  doc.rect(barX, barY, barW, 1.4, 'F')
  setFill(pct === 100 ? COLOR.success : COLOR.cyan)
  doc.rect(barX, barY, barW * (pct / 100), 1.4, 'F')

  y += 30

  // ── References ──
  if (template?.references) {
    doc.setFontSize(8)
    setText(COLOR.text3)
    doc.text(`Reference: ${template.references}`, margin, y)
    y += 6
  }

  // ── Warning Notes — banner-tier with red left rule ──
  if (template?.notes) {
    checkPageBreak(16)
    setFill([253, 240, 240])
    setDraw([245, 210, 210])
    const noteLines = doc.splitTextToSize(template.notes, contentWidth - 14)
    const noteH = 6 + noteLines.length * 4
    doc.roundedRect(margin, y, contentWidth, noteH, 1.5, 1.5, 'FD')
    setFill(COLOR.danger)
    doc.rect(margin, y, 1.5, noteH, 'F')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    setText(COLOR.danger)
    doc.text('NOTE', margin + 5, y + 4)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    setText(COLOR.text1)
    doc.text(noteLines, margin + 5, y + 8.5)
    y += noteH + 4
  }

  // ── SCN Form ──
  if (template?.has_scn_form && template.scn_fields) {
    checkPageBreak(20)
    sectionHeader('SECONDARY CRASH NET (SCN) FORM')

    setDraw(COLOR.bgRule)
    setFill(COLOR.bgInset)
    const fields = ((template.scn_fields as { fields?: { key: string; label: string }[] }).fields || [])
    for (const field of fields) {
      checkPageBreak(10)
      doc.setFontSize(7)
      setText(COLOR.text3)
      doc.text(field.label.toUpperCase(), margin, y)
      y += 3.5
      doc.setFontSize(9)
      setText(COLOR.text1)
      const val = String(scnData[field.key] || '—')
      const valLines = doc.splitTextToSize(val, contentWidth)
      doc.text(valLines, margin + 2, y)
      y += valLines.length * 4 + 3
    }
    y += 2
  }

  // ── Remarks ──
  if (execution.remarks) {
    checkPageBreak(16)
    setFill(COLOR.bgInset)
    setDraw(COLOR.bgRule)
    const remarkLines = doc.splitTextToSize(execution.remarks, contentWidth - 14)
    const remarkH = 6 + remarkLines.length * 4
    doc.roundedRect(margin, y, contentWidth, remarkH, 1.5, 1.5, 'FD')
    setFill(COLOR.cyan)
    doc.rect(margin, y, 1.5, remarkH, 'F')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    setText(COLOR.text3)
    doc.text('REMARKS', margin + 5, y + 4)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    setText(COLOR.text1)
    doc.text(remarkLines, margin + 5, y + 8.5)
    y += remarkH + 4
  }

  // ── Steps ──
  checkPageBreak(12)
  sectionHeader('CHECKLIST STEPS')

  function sectionHeader(label: string) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    setText(COLOR.text2)
    doc.text(label, margin, y)
    setDraw(COLOR.cyan)
    doc.setLineWidth(0.4)
    doc.line(margin, y + 1.4, margin + contentWidth, y + 1.4)
    doc.setLineWidth(0.2)
    doc.setFont('helvetica', 'normal')
    y += 6
  }

  function drawStatusPill(status: 'completed' | 'not_applicable' | 'incomplete', x: number, py: number): number {
    const w = status === 'not_applicable' ? 13 : 13
    const h = 4.6
    if (status === 'completed') {
      setFill(COLOR.success)
      doc.roundedRect(x, py - 3.4, w, h, 1, 1, 'F')
      setText([255, 255, 255])
      doc.setFontSize(6.5)
      doc.setFont('helvetica', 'bold')
      doc.text('DONE', x + w / 2, py - 0.2, { align: 'center' })
    } else if (status === 'not_applicable') {
      setFill([100, 100, 100])
      doc.roundedRect(x, py - 3.4, w, h, 1, 1, 'F')
      setText([255, 255, 255])
      doc.setFontSize(6.5)
      doc.setFont('helvetica', 'bold')
      doc.text('N/A', x + w / 2, py - 0.2, { align: 'center' })
    } else {
      setDraw(COLOR.bgRule)
      doc.setLineWidth(0.3)
      doc.roundedRect(x, py - 3.4, w, h, 1, 1, 'S')
      doc.setLineWidth(0.2)
    }
    doc.setFont('helvetica', 'normal')
    return w
  }

  function renderStepPdf(step: QrcStep, depth: number) {
    const resp = responses[step.id]
    const status = getStepStatus(resp)
    const indent = margin + depth * 8

    checkPageBreak(14)
    const rowStart = y

    // Conditional steps render as italic warning blocks — no pill, no number
    if (step.type === 'conditional') {
      setFill([253, 246, 235])
      setDraw([245, 220, 180])
      const lines = doc.splitTextToSize(step.label, contentWidth - 14 - depth * 8)
      const blockH = 4 + lines.length * 4
      doc.roundedRect(indent, y, contentWidth - depth * 8, blockH, 1, 1, 'FD')
      setFill(COLOR.amber)
      doc.rect(indent, y, 1.5, blockH, 'F')
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'italic')
      setText([180, 100, 0])
      doc.text(lines, indent + 5, y + 5)
      doc.setFont('helvetica', 'normal')
      y += blockH + BLOCK_POST_SPACING_MM
      return
    }

    // Read-only narrative blocks (text / textarea)
    if (step.type === 'text' || step.type === 'textarea') {
      setFill(COLOR.bgInset)
      setDraw(COLOR.bgRule)
      const lines = doc.splitTextToSize(step.label, contentWidth - 14 - depth * 8)
      const blockH = 4 + lines.length * 4
      doc.roundedRect(indent, y, contentWidth - depth * 8, blockH, 1, 1, 'FD')
      setFill(COLOR.cyan)
      doc.rect(indent, y, 1.5, blockH, 'F')
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      setText(COLOR.text2)
      doc.text(lines, indent + 5, y + 5)
      y += blockH + BLOCK_POST_SPACING_MM
      return
    }

    // Row left rule color-coded by status
    const ruleColor = status === 'completed' ? COLOR.success : status === 'not_applicable' ? COLOR.text3 : COLOR.bgRule
    setFill(ruleColor)
    // we'll fill the rule once we know the row height — defer to end via y delta

    // Step number
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    setText(COLOR.text2)
    doc.text(`${step.id}.`, indent + 4, y)

    // Status pill
    const pillX = indent + 4 + 7
    const pillW = drawStatusPill(status === 'completed' ? 'completed' : status === 'not_applicable' ? 'not_applicable' : 'incomplete', pillX, y)

    // Label
    const labelX = pillX + pillW + 3
    const labelWidth = contentWidth - (labelX - margin)
    doc.setFont('helvetica', status === 'completed' || status === 'not_applicable' ? 'normal' : 'bold')
    doc.setFontSize(9)
    setText(status === 'completed' || status === 'not_applicable' ? COLOR.text3 : COLOR.text1)
    const labelLines = doc.splitTextToSize(step.label, labelWidth)
    doc.text(labelLines, labelX, y)
    y += labelLines.length * 4

    doc.setFont('helvetica', 'normal')

    // Step note (guidance) — boxed
    if (step.note) {
      y += 1.5
      setFill(COLOR.bgInset)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'italic')
      const noteLines = doc.splitTextToSize(step.note, labelWidth - 4)
      const noteH = noteLines.length * 3 + 4
      doc.rect(labelX, y, contentWidth - (labelX - margin), noteH, 'F')
      setText(COLOR.text3)
      doc.text(noteLines, labelX + 2, y + 3.5)
      doc.setFont('helvetica', 'normal')
      y += noteH + 1
    }

    // Response details — value/time
    if (step.type === 'fill_field' || step.type === 'time_field') {
      if (resp?.value) {
        y += 2
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        setText(COLOR.success)
        const valLabel = `${step.field_label || 'Value'}: `
        doc.text(valLabel, labelX, y + 1)
        doc.setFont('helvetica', 'normal')
        setText(COLOR.text1)
        const valX = labelX + doc.getTextWidth(valLabel) + 1
        doc.text(resp.value, valX, y + 1)
        y += 4
      }
    }

    // Notify-agencies — split notified vs N/A. Use actual text width so prefix doesn't collide with the list.
    if (step.type === 'notify_agencies') {
      const notified = resp?.agencies_checked || []
      const naAgencies = resp?.agencies_na || []
      if (notified.length > 0) {
        y += 2
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        setText(COLOR.success)
        const prefix = 'Notified: '
        doc.text(prefix, labelX, y + 1)
        const prefixW = doc.getTextWidth(prefix) + 1
        doc.setFont('helvetica', 'normal')
        setText(COLOR.text1)
        const lines = doc.splitTextToSize(notified.join(', '), labelWidth - prefixW)
        doc.text(lines, labelX + prefixW, y + 1)
        y += Math.max(4, lines.length * 3.5 + 1)
      }
      if (naAgencies.length > 0) {
        y += 1
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        setText(COLOR.text3)
        const prefix = 'N/A: '
        doc.text(prefix, labelX, y + 1)
        const prefixW = doc.getTextWidth(prefix) + 1
        doc.setFont('helvetica', 'normal')
        setText(COLOR.text2)
        const lines = doc.splitTextToSize(naAgencies.join(', '), labelWidth - prefixW)
        doc.text(lines, labelX + prefixW, y + 1)
        y += Math.max(4, lines.length * 3.5 + 1)
      }
    }

    if (resp?.notes) {
      y += 1
      doc.setFontSize(8)
      setText(COLOR.text2)
      const respNoteLines = doc.splitTextToSize(`Note: ${resp.notes}`, labelWidth)
      doc.text(respNoteLines, labelX, y + 1)
      y += respNoteLines.length * 3.5 + 1
    }

    // Timestamp
    if (status === 'completed' && resp?.completed_at) {
      y += 1
      doc.setFontSize(7)
      setText(COLOR.text4)
      doc.text(`${formatZuluDateTime(new Date(resp.completed_at))}`, labelX, y + 1)
      y += 3
    }

    // Now paint the left rule (covers the full row height). Use a lighter gray for
    // N/A so it doesn't compete visually with the (also gray-tinted) step-note box.
    const rowH = y - rowStart + 1
    const paintRuleColor = status === 'not_applicable' ? COLOR.bgRule : ruleColor
    setFill(paintRuleColor)
    doc.rect(indent, rowStart - 3, 1.5, rowH + 1, 'F')

    y += STEP_ROW_GAP_MM

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
    setText(COLOR.text4)
    const footerY = pageHeight - 8
    setDraw(COLOR.bgRule)
    doc.setLineWidth(0.3)
    doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3)
    doc.setLineWidth(0.2)
    doc.text(
      `${displayId} · Page ${i} of ${totalPages} · Generated ${formatZuluDate(new Date())}`,
      margin,
      footerY,
    )
    if (baseName) {
      doc.text(
        `${baseName}${baseIcao ? ` · ${baseIcao}` : ''} · AIRFIELD OPS`,
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
