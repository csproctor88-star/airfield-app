import { describe, it, expect } from 'vitest'
import { flattenQrcSteps, buildQrcSheet, qrcSheetName } from '@/lib/export/qrc-export'
import type { QrcStep, QrcTemplate } from '@/lib/supabase/types'

// ─── QRC export ───
// One workbook, a sheet per QRC (sheet name = QRC title), single "Step
// Descriptions" column listing each step's label (sub-steps included).

const step = (id: string, label: string, sub_steps?: QrcStep[]): QrcStep =>
  ({ id, type: 'checkbox', label, ...(sub_steps ? { sub_steps } : {}) })

const qrc = (title: string, steps: QrcStep[]): QrcTemplate =>
  ({ title, steps } as unknown as QrcTemplate)

describe('flattenQrcSteps', () => {
  it('flattens nested sub-steps depth-first, parents before children', () => {
    const steps = [
      step('1', 'A'),
      step('2', 'B', [step('2a', 'B1'), step('2b', 'B2', [step('2b.i', 'B2x')])]),
      step('3', 'C'),
    ]
    expect(flattenQrcSteps(steps).map((s) => s.label)).toEqual(['A', 'B', 'B1', 'B2', 'B2x', 'C'])
  })

  it('tolerates missing/empty input', () => {
    expect(flattenQrcSteps([])).toEqual([])
  })
})

describe('buildQrcSheet', () => {
  it('emits a single "Step Descriptions" column', () => {
    const { columns } = buildQrcSheet(qrc('T', []))
    expect(columns.map((c) => c.header)).toEqual(['Step Descriptions'])
  })

  it('lists each step label (sub-steps included), skipping blank labels', () => {
    const { columns, rows } = buildQrcSheet(
      qrc('T', [step('1', 'Do thing'), step('2', ''), step('3', 'Next', [step('3a', 'Sub')])]),
    )
    const key = columns[0].key
    expect(rows.map((r) => r[key])).toEqual(['Do thing', 'Next', 'Sub'])
  })
})

describe('qrcSheetName', () => {
  it('strips Excel-forbidden characters and caps at 31 chars', () => {
    const name = qrcSheetName('In-Flight (IFE) / Ground (GE) Emergency', new Set())
    expect(name.length).toBeLessThanOrEqual(31)
    expect(name).not.toMatch(/[\\/?*[\]:]/)
  })

  it('removes colons and question marks', () => {
    expect(qrcSheetName('Bomb: Threat?', new Set())).toBe('Bomb Threat')
  })

  it('dedupes case-insensitively', () => {
    const used = new Set<string>()
    const a = qrcSheetName('Bomb Threat', used)
    const b = qrcSheetName('Bomb Threat', used)
    expect(a).toBe('Bomb Threat')
    expect(b).not.toBe(a)
    expect(b.length).toBeLessThanOrEqual(31)
  })

  it('falls back to "QRC" for an empty/blank title', () => {
    expect(qrcSheetName('   ', new Set())).toBe('QRC')
  })
})
