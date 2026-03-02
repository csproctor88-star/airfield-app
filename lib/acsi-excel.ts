import { createStyledWorkbook, addStyledSheet, saveWorkbook } from '@/lib/excel-export'
import { ACSI_CHECKLIST_SECTIONS } from '@/lib/constants'
import type { AcsiInspection, AcsiItem } from '@/lib/supabase/types'

export async function generateAcsiExcel(inspection: AcsiInspection): Promise<void> {
  const wb = await createStyledWorkbook()

  // ── Sheet 1: Summary ──
  const total = inspection.passed_count + inspection.failed_count + inspection.na_count
  const pct = inspection.total_items > 0 ? Math.round((total / inspection.total_items) * 100) : 0

  addStyledSheet(wb, 'Summary', [
    { header: 'Field', key: 'field', width: 25 },
    { header: 'Value', key: 'value', width: 40 },
  ], [
    { field: 'Display ID', value: inspection.display_id },
    { field: 'Airfield', value: inspection.airfield_name },
    { field: 'Inspection Date', value: inspection.inspection_date },
    { field: 'Inspection Year', value: inspection.fiscal_year },
    { field: 'Status', value: inspection.status.toUpperCase() },
    { field: 'Inspector', value: inspection.inspector_name || '—' },
    { field: 'Total Items', value: inspection.total_items },
    { field: 'Passed', value: inspection.passed_count },
    { field: 'Failed', value: inspection.failed_count },
    { field: 'N/A', value: inspection.na_count },
    { field: 'Completion %', value: `${pct}%` },
    { field: 'Notes', value: inspection.notes || '' },
  ])

  // ── Sheet 2: Inspection Team ──
  if (inspection.inspection_team && inspection.inspection_team.length > 0) {
    addStyledSheet(wb, 'Inspection Team', [
      { header: 'Role', key: 'role', width: 20 },
      { header: 'Rank', key: 'rank', width: 15 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Title', key: 'title', width: 25 },
    ], inspection.inspection_team.map(m => ({
      role: m.role,
      rank: m.rank || '',
      name: m.name || '',
      title: m.title || '',
    })))
  }

  // ── Sheet 3: All Checklist Items ──
  const itemsBySection: Record<string, AcsiItem[]> = {}
  for (const item of (inspection.items || [])) {
    const key = item.section_id || 'unknown'
    if (!itemsBySection[key]) itemsBySection[key] = []
    itemsBySection[key].push(item)
  }

  const responseLabel = (r: string | null) => {
    if (r === 'pass') return 'Y'
    if (r === 'fail') return 'N'
    if (r === 'na') return 'N/A'
    return '—'
  }

  const allRows: Record<string, string | number>[] = []
  for (const section of ACSI_CHECKLIST_SECTIONS) {
    const sectionItems = itemsBySection[section.id] || []
    for (const item of sectionItems) {
      allRows.push({
        section: `${section.number}. ${section.title}`,
        item_number: item.item_number,
        question: item.question,
        response: responseLabel(item.response),
        comment: item.discrepancy?.comment || '',
        work_order: item.discrepancy?.work_order || '',
        project_number: item.discrepancy?.project_number || '',
        estimated_cost: item.discrepancy?.estimated_cost || '',
        estimated_completion: item.discrepancy?.estimated_completion || '',
        areas: item.discrepancy?.areas?.join(', ') || '',
      })
    }
  }

  addStyledSheet(wb, 'Checklist Items', [
    { header: 'Section', key: 'section', width: 30 },
    { header: 'Item #', key: 'item_number', width: 10 },
    { header: 'Question', key: 'question', width: 50 },
    { header: 'Response', key: 'response', width: 10 },
    { header: 'Comment', key: 'comment', width: 35 },
    { header: 'Work Order', key: 'work_order', width: 18 },
    { header: 'Project #', key: 'project_number', width: 15 },
    { header: 'Est. Cost', key: 'estimated_cost', width: 14 },
    { header: 'Est. Completion', key: 'estimated_completion', width: 16 },
    { header: 'Areas', key: 'areas', width: 25 },
  ], allRows)

  // ── Sheet 4: Discrepancies Only ──
  const discrepancyRows = allRows.filter(r => r.response === 'N')
  if (discrepancyRows.length > 0) {
    addStyledSheet(wb, 'Discrepancies', [
      { header: 'Section', key: 'section', width: 30 },
      { header: 'Item #', key: 'item_number', width: 10 },
      { header: 'Question', key: 'question', width: 50 },
      { header: 'Comment', key: 'comment', width: 40 },
      { header: 'Work Order', key: 'work_order', width: 18 },
      { header: 'Project #', key: 'project_number', width: 15 },
      { header: 'Est. Cost', key: 'estimated_cost', width: 14 },
      { header: 'Est. Completion', key: 'estimated_completion', width: 16 },
      { header: 'Areas', key: 'areas', width: 25 },
    ], discrepancyRows)
  }

  // ── Sheet 5: Risk Cert Signatures ──
  if (inspection.risk_cert_signatures && inspection.risk_cert_signatures.length > 0) {
    addStyledSheet(wb, 'Risk Certification', [
      { header: 'Role', key: 'label', width: 18 },
      { header: 'Organization', key: 'organization', width: 20 },
      { header: 'Rank', key: 'rank', width: 15 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Title', key: 'title', width: 25 },
      { header: 'Signature', key: 'signature', width: 25 },
    ], inspection.risk_cert_signatures.map(s => ({
      label: s.label || '',
      organization: s.organization || '',
      rank: s.rank || '',
      name: s.name || '',
      title: s.title || '',
      signature: '', // Blank for manual entry
    })))
  }

  await saveWorkbook(wb, `${inspection.display_id || 'ACSI'}_Export.xlsx`)
}
