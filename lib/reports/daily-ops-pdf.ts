import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { DailyReportData, PhotoForDailyReport, ActivityEntryForReport, QrcExecutionForReport, OutageEventForReport } from './daily-ops-data'
import { formatDiscrepancyType } from './open-discrepancies-data'
import { formatZuluTime, formatZuluDate, formatZuluDateTime } from '@/lib/utils'

interface Options {
  startDate: string
  endDate: string
  isRange: boolean
  generatedBy: string
  baseName?: string
  baseIcao?: string
}

const CHECK_TYPE_LABELS: Record<string, string> = {
  fod: 'FOD', rsc: 'RSC', rcr: 'RCR', bash: 'BASH',
  ife: 'In-Flight Emergency', ground_emergency: 'Ground Emergency', heavy_aircraft: 'Heavy Aircraft',
}

const INSPECTION_TYPE_LABELS: Record<string, string> = {
  airfield: 'Airfield Inspection', lighting: 'Lighting Inspection',
  construction_meeting: 'Construction Meeting', joint_monthly: 'Joint Monthly',
}

const STATUS_LABELS: Record<string, string> = {
  submitted_to_afm: 'Submitted to AFM',
  submitted_to_ces: 'Submitted to CES',
  awaiting_action_by_ces: 'Awaiting CES Action',
  work_completed_awaiting_verification: 'Awaiting Verification',
  open: 'Open',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const ACTION_LABELS: Record<string, string> = {
  created: 'Created', updated: 'Updated', deleted: 'Deleted', completed: 'Completed',
  opened: 'Opened', closed: 'Closed', status_updated: 'Status Changed',
  saved: 'Saved', filed: 'Filed', resumed: 'Resumed', reviewed: 'Reviewed',
  noted: 'Logged', logged_personnel: 'Logged', personnel_off_airfield: 'Personnel Off',
  cancelled: 'Cancelled',
}

const ENTITY_LABELS: Record<string, string> = {
  discrepancy: 'Discrepancy', check: 'Check', inspection: 'Inspection',
  obstruction_evaluation: 'Obstruction Eval', navaid_status: 'NAVAID',
  airfield_status: 'Runway', contractor: 'Personnel', qrc: 'QRC',
  manual: 'Manual Entry', waiver: 'Waiver', waiver_review: 'Waiver Review',
}

function fmtTime(iso: string) {
  return formatZuluTime(iso) + 'Z'
}

function fmtDatePdf(dateStr: string) {
  return formatZuluDate(new Date(dateStr + 'T00:00:00Z'))
}

function fmtDateLong(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function formatActivityAction(entry: ActivityEntryForReport): string {
  const action = ACTION_LABELS[entry.action] || entry.action.charAt(0).toUpperCase() + entry.action.slice(1).replace(/_/g, ' ')
  const entity = ENTITY_LABELS[entry.entity_type] || entry.entity_type
  const id = entry.entity_display_id ? ` ${entry.entity_display_id}` : ''
  if (entry.action === 'personnel_off_airfield') return `Personnel Off${id}`
  return `${action} ${entity}${id}`
}

function getActivityDetails(entry: ActivityEntryForReport): string {
  if (!entry.metadata) return ''
  const m = entry.metadata
  if (m.details && typeof m.details === 'string') return m.details
  if (m.title && typeof m.title === 'string') return m.title
  const parts: string[] = []
  if (m.old_status && m.new_status) parts.push(`${m.old_status} -> ${m.new_status}`)
  if (m.reason && typeof m.reason === 'string') parts.push(m.reason)
  return parts.join(' | ')
}

// ── Date range helpers ──

function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const current = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 1)
  }
  return dates
}

function filterDataForDate(data: DailyReportData, dateStr: string): DailyReportData {
  const dayStart = new Date(`${dateStr}T00:00:00`).toISOString()
  const dayEnd = new Date(`${dateStr}T23:59:59.999`).toISOString()

  function inRange(iso: string) {
    return iso >= dayStart && iso <= dayEnd
  }

  return {
    inspections: data.inspections.filter((i) => inRange(i.created_at)),
    checks: data.checks.filter((c) => inRange(c.created_at)),
    newDiscrepancies: data.newDiscrepancies.filter((d) => inRange(d.created_at)),
    statusUpdates: data.statusUpdates.filter((u) => inRange(u.created_at)),
    obstructionEvals: data.obstructionEvals.filter((e) => inRange(e.created_at)),
    activityEntries: data.activityEntries.filter((a) => inRange(a.created_at)),
    qrcExecutions: data.qrcExecutions.filter((q) => inRange(q.opened_at) || (q.closed_at && inRange(q.closed_at))),
    outageEvents: data.outageEvents.filter((o) => inRange(o.created_at)),
    photos: data.photos,
  }
}

// ── Main Export ──

export function generateDailyOpsPdf(data: DailyReportData, opts: Options) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  let y = margin
  let pageNum = 1

  function addPageNumber() {
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 8, { align: 'center' })
  }

  function checkPageBreak(needed: number) {
    if (y + needed > pageHeight - 18) {
      addPageNumber()
      doc.addPage()
      pageNum++
      y = margin
    }
  }

  function sectionHeader(title: string) {
    checkPageBreak(14)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0)
    doc.text(title, margin, y)
    y += 1
    doc.setDrawColor(0)
    doc.setLineWidth(0.4)
    doc.line(margin, y, margin + contentWidth, y)
    y += 5
    doc.setFont('helvetica', 'normal')
  }

  function emptyState(text: string) {
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text(text, margin, y)
    y += 6
  }

  function dateHeader(dateStr: string) {
    checkPageBreak(16)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0)
    doc.text(fmtDateLong(dateStr), margin, y)
    y += 2
    doc.setDrawColor(0)
    doc.setLineWidth(0.8)
    doc.line(margin, y, margin + contentWidth, y)
    y += 6
    doc.setFont('helvetica', 'normal')
  }

  // ── Render all sections for a given day's data ──
  function renderSections(dayData: DailyReportData) {
    // 1. INSPECTIONS
    sectionHeader('AIRFIELD & LIGHTING INSPECTIONS')

    if (dayData.inspections.length === 0) {
      emptyState('No airfield/lighting inspection recorded.')
    } else {
      for (const insp of dayData.inspections) {
        checkPageBreak(20)
        const typeLabel = INSPECTION_TYPE_LABELS[insp.inspection_type] || insp.inspection_type
        const completedBy = insp.completed_by_name || insp.inspector_name || 'Unknown'
        const time = insp.completed_at ? fmtTime(insp.completed_at) : ''
        const result = insp.failed_count > 0
          ? `${insp.passed_count}/${insp.total_items} passed, ${insp.failed_count} failure${insp.failed_count !== 1 ? 's' : ''}`
          : `${insp.passed_count}/${insp.total_items} items passed`

        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0)
        doc.text(`${typeLabel} — COMPLETED`, margin + 2, y)
        doc.setFont('helvetica', 'normal')
        y += 4
        doc.setTextColor(60)
        doc.text(`Conducted by: ${completedBy}${time ? `, ${time}` : ''}`, margin + 2, y)
        y += 4
        doc.text(`Result: ${result}`, margin + 2, y)
        y += 4

        const failedItems = (insp.items || []).filter((i) => i.response === 'fail')
        if (failedItems.length > 0) {
          doc.setFontSize(8)
          doc.setTextColor(180, 0, 0)
          doc.text('Failures:', margin + 2, y)
          y += 4
          for (const item of failedItems) {
            checkPageBreak(5)
            const notes = item.notes ? ` — ${item.notes}` : ''
            const text = `  - ${item.section}: ${item.item}${notes}`
            const lines = doc.splitTextToSize(text, contentWidth - 6)
            doc.text(lines, margin + 4, y)
            y += lines.length * 3.5
          }
          doc.setTextColor(0)
        }
        y += 3
      }
    }

    // 1.5. VISUAL NAVAID OUTAGES
    renderOutageSection(dayData.outageEvents)

    // 2. COMPLETED CHECKS
    sectionHeader('COMPLETED CHECKS')

    if (dayData.checks.length === 0) {
      emptyState('No checks recorded.')
    } else {
      const tableBody = dayData.checks.map((c) => [
        CHECK_TYPE_LABELS[c.check_type] || c.check_type,
        c.completed_at ? fmtTime(c.completed_at) : '',
        c.completed_by || 'Unknown',
        (c.areas || []).join(', ') || '—',
        '',
      ])

      const checkPhotos = dayData.checks.map((c) => data.photos[`check:${c.id}`] || [])

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Type', 'Time', 'Conducted By', 'Area(s)', 'Photos']],
        body: tableBody,
        styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0] },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: { 4: { cellWidth: 48 } },
        didParseCell: (hookData) => {
          if (hookData.section === 'body') {
            const photos = checkPhotos[hookData.row.index] || []
            if (photos.length > 0) {
              hookData.cell.styles.minCellHeight = photoCellHeight(photos.length, 48)
            }
          }
        },
        didDrawCell: (hookData) => {
          if (hookData.section === 'body' && hookData.column.index === 4) {
            const photos = checkPhotos[hookData.row.index] || []
            drawPhotosInCell(doc, photos, hookData.cell.x, hookData.cell.y, hookData.cell.width)
          }
        },
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4
    }

    // 3. NEW DISCREPANCIES
    sectionHeader(`NEW DISCREPANCIES (${dayData.newDiscrepancies.length})`)

    if (dayData.newDiscrepancies.length === 0) {
      emptyState('No new discrepancies reported.')
    } else {
      const tableBody = dayData.newDiscrepancies.map((d) => {
        const reporter = d.reporter_rank ? `${d.reporter_rank} ${d.reporter_name}` : d.reporter_name
        return [d.display_id, d.title, formatDiscrepancyType(d.type), d.location_text, d.assigned_shop || '—', reporter, '']
      })

      const discPhotos = dayData.newDiscrepancies.map((d) => data.photos[`discrepancy:${d.id}`] || [])

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['ID', 'Title', 'Type', 'Location', 'Shop', 'Reported By', 'Photos']],
        body: tableBody,
        styles: { fontSize: 7, cellPadding: 1.5, textColor: [0, 0, 0] },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 32 }, 6: { cellWidth: 48 } },
        didParseCell: (hookData) => {
          if (hookData.section === 'body') {
            const photos = discPhotos[hookData.row.index] || []
            if (photos.length > 0) {
              hookData.cell.styles.minCellHeight = photoCellHeight(photos.length, 48)
            }
          }
        },
        didDrawCell: (hookData) => {
          if (hookData.section === 'body' && hookData.column.index === 6) {
            const photos = discPhotos[hookData.row.index] || []
            drawPhotosInCell(doc, photos, hookData.cell.x, hookData.cell.y, hookData.cell.width)
          }
        },
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4
    }

    // 4. DISCREPANCY UPDATES
    const uniqueUpdatedDiscs = new Set(dayData.statusUpdates.map((u) => u.discrepancy_id))
    sectionHeader(`DISCREPANCY UPDATES (${dayData.statusUpdates.length} update${dayData.statusUpdates.length !== 1 ? 's' : ''} across ${uniqueUpdatedDiscs.size} discrepanc${uniqueUpdatedDiscs.size !== 1 ? 'ies' : 'y'})`)

    if (dayData.statusUpdates.length === 0) {
      emptyState('No discrepancy updates.')
    } else {
      const tableBody = dayData.statusUpdates.map((u) => {
        const statusChange = u.old_status && u.new_status
          ? `${STATUS_LABELS[u.old_status] || u.old_status} -> ${STATUS_LABELS[u.new_status] || u.new_status}`
          : u.new_status ? STATUS_LABELS[u.new_status] || u.new_status : ''
        const name = u.user_rank ? `${u.user_rank} ${u.user_name}` : u.user_name
        return [u.discrepancy_display_id, u.discrepancy_title, statusChange, u.notes || '—', name, fmtTime(u.created_at)]
      })

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['ID', 'Title', 'Status Change', 'Notes', 'Updated By', 'Time']],
        body: tableBody,
        styles: { fontSize: 7, cellPadding: 1.5, textColor: [0, 0, 0] },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: { 0: { cellWidth: 22 }, 3: { cellWidth: 35 } },
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4
    }

    // 5. OBSTRUCTION EVALUATIONS
    sectionHeader('OBSTRUCTION EVALUATIONS')

    if (dayData.obstructionEvals.length === 0) {
      emptyState('No obstruction evaluations recorded.')
    } else {
      const tableBody = dayData.obstructionEvals.map((e) => {
        const result = e.has_violation ? 'VIOLATION' : 'CLEAR'
        const name = e.evaluator_rank ? `${e.evaluator_rank} ${e.evaluator_name}` : e.evaluator_name
        const surfaces = e.has_violation ? (e.violated_surfaces || []).length.toString() : '—'
        return [e.display_id, e.description || '—', `${e.object_height_agl} ft AGL`, result, e.controlling_surface || '—', surfaces, name, '']
      })

      const obsPhotos = dayData.obstructionEvals.map((e) => data.photos[`obstruction:${e.id}`] || [])

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['ID', 'Description', 'Height', 'Result', 'Ctrl Surface', 'Viol.', 'Evaluated By', 'Photos']],
        body: tableBody,
        styles: { fontSize: 7, cellPadding: 1.5, textColor: [0, 0, 0] },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: { 7: { cellWidth: 48 } },
        didParseCell: (hookData) => {
          if (hookData.section !== 'body') return
          if (hookData.column.index === 3) {
            const val = hookData.cell.raw as string
            if (val === 'VIOLATION') {
              hookData.cell.styles.textColor = [220, 38, 38]
              hookData.cell.styles.fontStyle = 'bold'
            }
          }
          const photos = obsPhotos[hookData.row.index] || []
          if (photos.length > 0) {
            hookData.cell.styles.minCellHeight = photoCellHeight(photos.length, 48)
          }
        },
        didDrawCell: (hookData) => {
          if (hookData.section === 'body' && hookData.column.index === 7) {
            const photos = obsPhotos[hookData.row.index] || []
            drawPhotosInCell(doc, photos, hookData.cell.x, hookData.cell.y, hookData.cell.width)
          }
        },
      })
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4
    }

    // 6. QRC EXECUTIONS
    renderQrcSection(dayData.qrcExecutions)

    // 7. EVENTS LOG
    renderEventsLogSection(dayData.activityEntries)
  }

  // ── Visual NAVAID Outages section ──
  function renderOutageSection(events: OutageEventForReport[]) {
    sectionHeader(`VISUAL NAVAID OUTAGES (${events.length})`)

    if (events.length === 0) {
      emptyState('No Visual NAVAID outage events.')
      return
    }

    const tableBody = events.map((e) => {
      const name = e.reporter_rank ? `${e.reporter_rank} ${e.reporter_name}` : e.reporter_name
      const featureLabel = e.feature_label || e.feature_type || 'Unknown'
      const system = e.system_name || '—'
      const eventLabel = e.event_type === 'resolved' ? 'Resolved' : 'Reported'
      return [fmtTime(e.created_at), featureLabel, system, eventLabel, name]
    })

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Time', 'Feature', 'System', 'Event', 'User']],
      body: tableBody,
      styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0] },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: { 0: { cellWidth: 18 }, 3: { cellWidth: 20 } },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 3) {
          const val = hookData.cell.raw as string
          if (val === 'Reported') {
            hookData.cell.styles.textColor = [220, 38, 38]
            hookData.cell.styles.fontStyle = 'bold'
          } else if (val === 'Resolved') {
            hookData.cell.styles.textColor = [34, 197, 94]
            hookData.cell.styles.fontStyle = 'bold'
          }
        }
      },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4
  }

  // ── QRC Executions section ──
  function renderQrcSection(execs: QrcExecutionForReport[]) {
    sectionHeader(`QRC EXECUTIONS (${execs.length})`)

    if (execs.length === 0) {
      emptyState('No QRC executions.')
      return
    }

    // Summary table
    const tableBody = execs.map((q) => [
      `QRC-${q.qrc_number}`,
      q.title,
      q.status.toUpperCase(),
      fmtTime(q.opened_at) + (q.open_initials ? ` (${q.open_initials})` : ''),
      q.closed_at ? fmtTime(q.closed_at) + (q.close_initials ? ` (${q.close_initials})` : '') : '—',
      `${q.completed_steps}/${q.total_steps}`,
    ])

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['QRC', 'Title', 'Status', 'Opened', 'Closed', 'Steps']],
      body: tableBody,
      styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0] },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: { 0: { cellWidth: 20 }, 2: { cellWidth: 18 }, 5: { cellWidth: 16 } },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 2) {
          const val = hookData.cell.raw as string
          if (val === 'OPEN') {
            hookData.cell.styles.textColor = [202, 138, 4]
            hookData.cell.styles.fontStyle = 'bold'
          } else if (val === 'CLOSED') {
            hookData.cell.styles.textColor = [34, 197, 94]
            hookData.cell.styles.fontStyle = 'bold'
          }
        }
      },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3

    // SCN data for each QRC that has it
    for (const q of execs) {
      if (!q.scn_data || q.scn_field_labels.length === 0) continue
      const scnValues = q.scn_data as Record<string, string>
      const hasValues = q.scn_field_labels.some((f) => scnValues[f.key])
      if (!hasValues) continue

      checkPageBreak(10 + q.scn_field_labels.length * 5)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0)
      doc.text(`QRC-${q.qrc_number} — SCN Form Data`, margin + 2, y)
      doc.setFont('helvetica', 'normal')
      y += 4

      const scnBody = q.scn_field_labels
        .filter((f) => scnValues[f.key])
        .map((f) => [f.label, scnValues[f.key] || ''])

      if (scnBody.length > 0) {
        autoTable(doc, {
          startY: y,
          margin: { left: margin + 4, right: margin + 4 },
          head: [['Field', 'Value']],
          body: scnBody,
          styles: { fontSize: 7, cellPadding: 1.5, textColor: [0, 0, 0] },
          headStyles: { fillColor: [14, 116, 144], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
          alternateRowStyles: { fillColor: [245, 250, 252] },
          columnStyles: { 0: { cellWidth: 35, fontStyle: 'bold' } },
        })
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3
      }
    }
  }

  // ── Events Log section ──
  function renderEventsLogSection(entries: ActivityEntryForReport[]) {
    sectionHeader(`EVENTS LOG (${entries.length})`)

    if (entries.length === 0) {
      emptyState('No events logged.')
      return
    }

    const tableBody = entries.map((e) => {
      const name = e.user_rank ? `${e.user_rank} ${e.user_name}` : e.user_name
      const action = formatActivityAction(e)
      const details = getActivityDetails(e)
      return [fmtTime(e.created_at), action, details, name]
    })

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Time', 'Action', 'Details', 'User']],
      body: tableBody,
      styles: { fontSize: 7, cellPadding: 1.5, textColor: [0, 0, 0] },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 50 }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 38 } },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4
  }

  // ── HEADER ──
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text('GLIDEPATH', margin, y)
  y += 5

  doc.setFontSize(14)
  doc.setTextColor(0)
  doc.setFont('helvetica', 'bold')
  doc.text('DAILY AIRFIELD OPERATIONS SUMMARY', margin, y)
  y += 6

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(opts.baseName && opts.baseIcao ? `${opts.baseName} (${opts.baseIcao})` : 'Airfield Operations', margin, y)
  y += 5

  doc.setFontSize(9)
  doc.setTextColor(60)
  const dateLabel = opts.isRange
    ? `${fmtDatePdf(opts.startDate)} — ${fmtDatePdf(opts.endDate)}`
    : fmtDatePdf(opts.startDate)
  doc.text(`Date: ${dateLabel}`, margin, y)
  y += 4
  doc.text(`Generated by: ${opts.generatedBy}`, margin, y)
  y += 4
  doc.text(`Generated: ${formatZuluDateTime(new Date())}`, margin, y)
  y += 8

  // ── RENDER SECTIONS ──
  if (opts.isRange && opts.startDate !== opts.endDate) {
    const dates = getDateRange(opts.startDate, opts.endDate)
    for (const dateStr of dates) {
      dateHeader(dateStr)
      const dayData = filterDataForDate(data, dateStr)
      renderSections(dayData)
      y += 4
    }
  } else {
    renderSections(data)
  }

  // Footer
  addPageNumber()

  const dateSuffix = opts.isRange
    ? `${opts.startDate}_to_${opts.endDate}`
    : opts.startDate
  const filename = `${opts.baseIcao ?? 'AIRFIELD'}_Daily_Ops_${dateSuffix}.pdf`
  return { doc, filename }
}

// ── Photo rendering helpers ──

const PHOTO_THUMB_W = 20
const PHOTO_THUMB_H = 15
const PHOTO_GAP = 1.5
const PHOTO_PADDING = 2

function photoCellHeight(numPhotos: number, cellWidth: number): number {
  if (numPhotos === 0) return 0
  const available = cellWidth - PHOTO_PADDING * 2
  const thumbsPerRow = Math.max(1, Math.floor(available / (PHOTO_THUMB_W + PHOTO_GAP)))
  const rows = Math.ceil(numPhotos / thumbsPerRow)
  return PHOTO_PADDING * 2 + rows * PHOTO_THUMB_H + Math.max(0, rows - 1) * PHOTO_GAP
}

function drawPhotosInCell(
  doc: jsPDF,
  photos: PhotoForDailyReport[],
  cellX: number,
  cellY: number,
  cellWidth: number,
) {
  if (photos.length === 0) return

  const padding = 2
  const availableWidth = cellWidth - padding * 2
  const thumbsPerRow = Math.max(1, Math.floor(availableWidth / (PHOTO_THUMB_W + PHOTO_GAP)))
  let xOffset = cellX + padding
  let yOffset = cellY + padding

  for (let i = 0; i < photos.length; i++) {
    if (i > 0 && i % thumbsPerRow === 0) {
      yOffset += PHOTO_THUMB_H + PHOTO_GAP
      xOffset = cellX + padding
    }

    const photo = photos[i]
    if (photo.dataUrl) {
      try {
        const format = photo.dataUrl.includes('image/png') ? 'PNG' : 'JPEG'
        doc.addImage(photo.dataUrl, format, xOffset, yOffset, PHOTO_THUMB_W, PHOTO_THUMB_H)
      } catch {
        doc.setDrawColor(180)
        doc.rect(xOffset, yOffset, PHOTO_THUMB_W, PHOTO_THUMB_H)
        doc.setFontSize(5)
        doc.setTextColor(150)
        doc.text('img', xOffset + 2, yOffset + PHOTO_THUMB_H / 2)
      }
    } else {
      doc.setDrawColor(180)
      doc.rect(xOffset, yOffset, PHOTO_THUMB_W, PHOTO_THUMB_H)
      doc.setFontSize(5)
      doc.setTextColor(150)
      doc.text('img', xOffset + 2, yOffset + PHOTO_THUMB_H / 2)
    }

    xOffset += PHOTO_THUMB_W + PHOTO_GAP
  }
}
