import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const CYAN = [34, 211, 238] as const
const DARK = [15, 23, 42] as const
const GRAY = [100, 116, 139] as const
const WHITE = [255, 255, 255] as const
const LIGHT_GRAY = [203, 213, 225] as const

function addHeader(doc: jsPDF, pageWidth: number, margin: number) {
  doc.setFillColor(...DARK)
  doc.rect(0, 0, pageWidth, 28, 'F')
  doc.setFontSize(14)
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.text('GLIDEPATH', margin, 14)
  doc.setFontSize(8)
  doc.setTextColor(...CYAN)
  doc.text('Guiding You to Mission Success', margin, 20)
  doc.setFontSize(7)
  doc.setTextColor(...GRAY)
  doc.text('Airfield Operations Management Platform', pageWidth - margin, 14, { align: 'right' })
}

function addFooter(doc: jsPDF, pageWidth: number, pageHeight: number, margin: number, pageNum: number, totalPages: number) {
  doc.setDrawColor(200)
  doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14)
  doc.setFontSize(7)
  doc.setTextColor(...GRAY)
  doc.text('GLIDEPATH Training Documentation — FOUO', margin, pageHeight - 9)
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 9, { align: 'right' })
}

function checkPageBreak(doc: jsPDF, y: number, needed: number, pageHeight: number, margin: number, pageWidth: number): number {
  if (y + needed > pageHeight - 20) {
    doc.addPage()
    addHeader(doc, pageWidth, margin)
    return 36
  }
  return y
}

// ═══════════════════════════════════════════════════════════════
// Module Reference PDF
// ═══════════════════════════════════════════════════════════════

interface ModuleData {
  name: string
  tagline: string
  overview: string
  keyFeatures: string[]
  howToAccess: string
}

export function generateModuleReferencePdf(modules: ModuleData[]): { doc: jsPDF; filename: string } {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 16
  const contentWidth = pageWidth - margin * 2

  // ── Cover Page ──
  doc.setFillColor(...DARK)
  doc.rect(0, 0, pageWidth, pageHeight, 'F')

  doc.setFontSize(36)
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.text('GLIDEPATH', pageWidth / 2, 80, { align: 'center' })

  doc.setFontSize(12)
  doc.setTextColor(...CYAN)
  doc.text('Guiding You to Mission Success', pageWidth / 2, 92, { align: 'center' })

  doc.setDrawColor(...CYAN)
  doc.setLineWidth(0.5)
  doc.line(pageWidth / 2 - 40, 100, pageWidth / 2 + 40, 100)

  doc.setFontSize(20)
  doc.setTextColor(...WHITE)
  doc.text('Module Reference Guide', pageWidth / 2, 116, { align: 'center' })

  doc.setFontSize(10)
  doc.setTextColor(...LIGHT_GRAY)
  doc.text('Comprehensive guide to all application modules', pageWidth / 2, 128, { align: 'center' })

  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text(`${modules.length} Modules Documented`, pageWidth / 2, 140, { align: 'center' })

  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text(`Generated: ${new Date().toISOString().slice(0, 10)}`, pageWidth / 2, pageHeight - 30, { align: 'center' })
  doc.text('Airfield Operations Management Platform', pageWidth / 2, pageHeight - 24, { align: 'center' })

  // ── Table of Contents ──
  doc.addPage()
  addHeader(doc, pageWidth, margin)
  let y = 36

  doc.setFontSize(16)
  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'bold')
  doc.text('Table of Contents', margin, y)
  y += 10

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  modules.forEach((m, i) => {
    doc.setTextColor(...DARK)
    doc.text(`${i + 1}.`, margin, y)
    doc.setFont('helvetica', 'bold')
    doc.text(m.name, margin + 8, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    const tagline = ` — ${m.tagline}`
    doc.text(tagline, margin + 8 + doc.getTextWidth(m.name) + 2, y)
    y += 5.5
    if (y > pageHeight - 30) {
      doc.addPage()
      addHeader(doc, pageWidth, margin)
      y = 36
    }
  })

  // ── Module Pages ──
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i]
    doc.addPage()
    addHeader(doc, pageWidth, margin)
    y = 36

    // Module number + name
    doc.setFillColor(34, 211, 238)
    doc.roundedRect(margin, y - 5, 10, 10, 2, 2, 'F')
    doc.setFontSize(10)
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'bold')
    doc.text(String(i + 1), margin + 5, y + 2, { align: 'center' })

    doc.setFontSize(16)
    doc.setTextColor(...DARK)
    doc.text(m.name, margin + 14, y + 2)
    y += 5

    doc.setFontSize(9)
    doc.setTextColor(...CYAN)
    doc.text(m.tagline, margin + 14, y + 2)
    y += 10

    // Overview
    doc.setFontSize(10)
    doc.setTextColor(...DARK)
    doc.setFont('helvetica', 'bold')
    doc.text('Overview', margin, y)
    y += 5

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)
    const overviewLines = doc.splitTextToSize(m.overview, contentWidth)
    y = checkPageBreak(doc, y, overviewLines.length * 4 + 4, pageHeight, margin, pageWidth)
    doc.text(overviewLines, margin, y)
    y += overviewLines.length * 4 + 6

    // Key Features
    y = checkPageBreak(doc, y, 10, pageHeight, margin, pageWidth)
    doc.setFontSize(10)
    doc.setTextColor(...DARK)
    doc.setFont('helvetica', 'bold')
    doc.text('Key Features', margin, y)
    y += 5

    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    for (const feature of m.keyFeatures) {
      const featureLines = doc.splitTextToSize(feature, contentWidth - 6)
      y = checkPageBreak(doc, y, featureLines.length * 3.5 + 2, pageHeight, margin, pageWidth)
      doc.setTextColor(...CYAN)
      doc.text('\u2022', margin, y)
      doc.setTextColor(60, 60, 60)
      doc.text(featureLines, margin + 4, y)
      y += featureLines.length * 3.5 + 1.5
    }
    y += 4

    // How to Access
    y = checkPageBreak(doc, y, 14, pageHeight, margin, pageWidth)
    doc.setFillColor(240, 249, 255)
    doc.setDrawColor(34, 211, 238)
    doc.roundedRect(margin, y - 2, contentWidth, 12, 2, 2, 'FD')
    doc.setFontSize(8)
    doc.setTextColor(...CYAN)
    doc.setFont('helvetica', 'bold')
    doc.text('HOW TO ACCESS', margin + 4, y + 3)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)
    doc.text(m.howToAccess, margin + 4, y + 7.5)
    y += 16
  }

  // ── Add footers ──
  const totalPages = doc.getNumberOfPages()
  for (let p = 2; p <= totalPages; p++) {
    doc.setPage(p)
    addFooter(doc, pageWidth, pageHeight, margin, p - 1, totalPages - 1)
  }

  return { doc, filename: `Glidepath_Module_Reference_Guide_${new Date().toISOString().slice(0, 10)}.pdf` }
}

// ═══════════════════════════════════════════════════════════════
// Base Setup Guide PDF
// ═══════════════════════════════════════════════════════════════

interface SetupStepData {
  number: number
  title: string
  description: string
  instructions: string[]
  tips?: string[]
}

export function generateBaseSetupPdf(steps: SetupStepData[]): { doc: jsPDF; filename: string } {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 16
  const contentWidth = pageWidth - margin * 2

  // ── Cover Page ──
  doc.setFillColor(...DARK)
  doc.rect(0, 0, pageWidth, pageHeight, 'F')

  doc.setFontSize(36)
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.text('GLIDEPATH', pageWidth / 2, 80, { align: 'center' })

  doc.setFontSize(12)
  doc.setTextColor(...CYAN)
  doc.text('Guiding You to Mission Success', pageWidth / 2, 92, { align: 'center' })

  doc.setDrawColor(...CYAN)
  doc.setLineWidth(0.5)
  doc.line(pageWidth / 2 - 40, 100, pageWidth / 2 + 40, 100)

  doc.setFontSize(20)
  doc.setTextColor(...WHITE)
  doc.text('Base Setup Guide', pageWidth / 2, 116, { align: 'center' })

  doc.setFontSize(10)
  doc.setTextColor(...LIGHT_GRAY)
  doc.text('Step-by-step installation configuration walkthrough', pageWidth / 2, 128, { align: 'center' })

  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text(`${steps.length} Configuration Steps`, pageWidth / 2, 140, { align: 'center' })

  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text(`Generated: ${new Date().toISOString().slice(0, 10)}`, pageWidth / 2, pageHeight - 30, { align: 'center' })
  doc.text('Airfield Operations Management Platform', pageWidth / 2, pageHeight - 24, { align: 'center' })

  // ── Introduction Page ──
  doc.addPage()
  addHeader(doc, pageWidth, margin)
  let y = 36

  doc.setFontSize(16)
  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'bold')
  doc.text('Introduction', margin, y)
  y += 8

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)

  const introText = [
    'This guide walks you through the Base Setup wizard in Glidepath. Each step configures a component of your installation that other modules depend on. Complete these steps in order to ensure the app functions correctly for your base.',
    '',
    'Only Airfield Managers, Base Admins, and System Admins can access Base Setup. Navigate to Settings > Base Configuration > Base Setup to begin.',
    '',
    'The wizard features a progress bar, numbered step navigation, and guided instructions for each configuration area. You can move forward and back through steps, and return to any step later to make changes.',
    '',
    'Prerequisites:',
    '  - Your base must be created in the system (name, ICAO code, timezone)',
    '  - You need an Airfield Manager, Base Admin, or System Admin role',
    '  - Have your airfield diagram, SkyVector/AirNav data, and DAFMAN references ready',
    '',
    'Step Overview:',
  ]

  for (const line of introText) {
    if (line === '') { y += 3; continue }
    const wrapped = doc.splitTextToSize(line, contentWidth)
    doc.text(wrapped, margin, y)
    y += wrapped.length * 4
  }

  y += 2

  // Step summary table
  const stepRows = steps.map(s => [
    String(s.number),
    s.title,
    s.number === 12 ? 'Optional' : 'Required',
    s.description.slice(0, 60) + (s.description.length > 60 ? '...' : ''),
  ])

  autoTable(doc, {
    startY: y,
    head: [['#', 'Step', 'Status', 'Description']],
    body: stepRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [34, 211, 238], textColor: [15, 23, 42], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 30, fontStyle: 'bold' },
      2: { cellWidth: 16, halign: 'center' },
    },
    alternateRowStyles: { fillColor: [245, 248, 252] },
  })
  y = (doc as any).lastAutoTable.finalY + 8

  // ── Step Pages ──
  for (const step of steps) {
    doc.addPage()
    addHeader(doc, pageWidth, margin)
    y = 36

    // Step number badge + title
    doc.setFillColor(34, 211, 238)
    doc.roundedRect(margin, y - 5, 12, 12, 2, 2, 'F')
    doc.setFontSize(12)
    doc.setTextColor(...WHITE)
    doc.setFont('helvetica', 'bold')
    doc.text(String(step.number), margin + 6, y + 3, { align: 'center' })

    doc.setFontSize(16)
    doc.setTextColor(...DARK)
    doc.text(step.title, margin + 16, y + 2)

    if (step.number === 12) {
      doc.setFontSize(8)
      doc.setTextColor(...GRAY)
      doc.text('(Optional)', margin + 16 + doc.getTextWidth(step.title) + 3, y + 2)
    }
    y += 12

    // Description
    doc.setFontSize(10)
    doc.setTextColor(...DARK)
    doc.setFont('helvetica', 'bold')
    doc.text('Purpose', margin, y)
    y += 5

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)
    const descLines = doc.splitTextToSize(step.description, contentWidth)
    doc.text(descLines, margin, y)
    y += descLines.length * 4 + 6

    // Instructions
    y = checkPageBreak(doc, y, 10, pageHeight, margin, pageWidth)
    doc.setFontSize(10)
    doc.setTextColor(...DARK)
    doc.setFont('helvetica', 'bold')
    doc.text('How to Complete', margin, y)
    y += 5

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    for (let j = 0; j < step.instructions.length; j++) {
      const inst = step.instructions[j]
      const instLines = doc.splitTextToSize(inst, contentWidth - 10)
      y = checkPageBreak(doc, y, instLines.length * 4 + 2, pageHeight, margin, pageWidth)

      // Step number
      doc.setTextColor(...CYAN)
      doc.setFont('helvetica', 'bold')
      doc.text(`${j + 1}.`, margin, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      doc.text(instLines, margin + 8, y)
      y += instLines.length * 4 + 2
    }
    y += 4

    // Tips
    if (step.tips && step.tips.length > 0) {
      y = checkPageBreak(doc, y, 14 + step.tips.length * 6, pageHeight, margin, pageWidth)
      doc.setFillColor(240, 249, 255)
      doc.setDrawColor(34, 211, 238)

      // Calculate box height
      let tipsHeight = 8
      const tipWraps: string[][] = []
      for (const tip of step.tips) {
        const wrapped = doc.splitTextToSize(tip, contentWidth - 14)
        tipWraps.push(wrapped)
        tipsHeight += wrapped.length * 3.5 + 2
      }
      tipsHeight += 2

      doc.roundedRect(margin, y - 2, contentWidth, tipsHeight, 2, 2, 'FD')

      doc.setFontSize(8)
      doc.setTextColor(...CYAN)
      doc.setFont('helvetica', 'bold')
      doc.text('TIPS', margin + 4, y + 3)
      y += 7

      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      for (const wrapped of tipWraps) {
        doc.text('\u2022', margin + 4, y)
        doc.text(wrapped, margin + 8, y)
        y += wrapped.length * 3.5 + 2
      }
      y += 4
    }
  }

  // ── Add footers ──
  const totalPages = doc.getNumberOfPages()
  for (let p = 2; p <= totalPages; p++) {
    doc.setPage(p)
    addFooter(doc, pageWidth, pageHeight, margin, p - 1, totalPages - 1)
  }

  return { doc, filename: `Glidepath_Base_Setup_Guide_${new Date().toISOString().slice(0, 10)}.pdf` }
}
