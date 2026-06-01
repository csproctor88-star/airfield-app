// Export QRC — one Excel workbook with a sheet per active QRC (sheet name = the
// QRC title), each sheet a single "Step Descriptions" column listing every
// step's label (sub-steps included). The pure helpers are unit-tested in
// tests/qrc-export.test.ts; exportQrc does the IO (fetch → build → download).

import type { ColumnDef } from '@/lib/excel-export'
import type { QrcStep, QrcTemplate } from '@/lib/supabase/types'

export interface QrcSheet {
  columns: ColumnDef[]
  rows: Record<string, unknown>[]
}

// Excel sheet-name limit + forbidden characters.
const SHEET_NAME_MAX = 31
// eslint-disable-next-line no-useless-escape
const SHEET_NAME_FORBIDDEN = /[\\\/?*\[\]:]/g

/** Depth-first flatten of a QRC's steps, each parent before its sub-steps. */
export function flattenQrcSteps(steps: QrcStep[]): QrcStep[] {
  const out: QrcStep[] = []
  const walk = (list: QrcStep[]) => {
    for (const s of list || []) {
      out.push(s)
      if (s.sub_steps?.length) walk(s.sub_steps)
    }
  }
  walk(steps || [])
  return out
}

/** Build the single-column "Step Descriptions" sheet for one QRC. */
export function buildQrcSheet(qrc: QrcTemplate): QrcSheet {
  const columns: ColumnDef[] = [{ header: 'Step Descriptions', key: 'step', width: 90 }]
  const steps = (qrc.steps as unknown as QrcStep[]) || []
  const rows = flattenQrcSteps(steps)
    .map((s) => (s.label ?? '').trim())
    .filter((label) => label.length > 0)
    .map((label) => ({ step: label }))
  return { columns, rows }
}

/**
 * A valid, unique Excel sheet name from a QRC title: forbidden characters
 * removed, whitespace collapsed, capped at 31 chars, and deduped
 * case-insensitively against `used` (Excel sheet names are case-insensitive).
 */
export function qrcSheetName(title: string, used: Set<string>): string {
  let name = (title || '').replace(SHEET_NAME_FORBIDDEN, ' ').replace(/\s+/g, ' ').trim()
  if (!name) name = 'QRC'
  name = name.slice(0, SHEET_NAME_MAX)
  if (used.has(name.toLowerCase())) {
    const stem = name.slice(0, SHEET_NAME_MAX - 5).trim()
    let n = 2
    let candidate = `${stem} (${n})`
    while (used.has(candidate.toLowerCase())) {
      n++
      candidate = `${stem} (${n})`
    }
    name = candidate
  }
  used.add(name.toLowerCase())
  return name
}

/** Fetch active QRCs for the base, build a single multi-sheet workbook, download it. */
export async function exportQrc(baseId: string): Promise<{ count: number }> {
  const { fetchQrcTemplates } = await import('@/lib/supabase/qrc')
  const templates = (await fetchQrcTemplates(baseId)).filter((t) => t.is_active)

  const { createStyledWorkbook, addStyledSheet, saveWorkbook } = await import('@/lib/excel-export')
  const wb = await createStyledWorkbook()
  const used = new Set<string>()
  for (const qrc of templates) {
    const { columns, rows } = buildQrcSheet(qrc)
    addStyledSheet(wb, qrcSheetName(qrc.title, used), columns, rows)
  }
  await saveWorkbook(wb, 'QRC_Export.xlsx')
  return { count: templates.length }
}
