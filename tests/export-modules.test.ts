import { describe, it, expect } from 'vitest'
import { EXPORT_MODULES, type ExportModule } from '@/lib/export/export-modules'

describe('EXPORT_MODULES registry', () => {
  it('has unique module keys', () => {
    const keys = EXPORT_MODULES.map((m) => m.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('uses only valid pdf strategies', () => {
    const valid = new Set(['per_record', 'table', 'excluded'])
    for (const m of EXPORT_MODULES) {
      expect(valid.has(m.pdfStrategy)).toBe(true)
    }
  })

  it('marks AMTR as excluded (its own export covers it)', () => {
    const amtr = EXPORT_MODULES.find((m) => m.key === 'amtr')
    expect(amtr?.pdfStrategy).toBe('excluded')
  })

  it('sets Waivers, ACSI, and Civilian Training as per-record PDFs', () => {
    for (const key of ['waivers', 'acsi', 'training_part139']) {
      const m = EXPORT_MODULES.find((x) => x.key === key)
      expect(m, key).toBeDefined()
      expect(m?.pdfStrategy, key).toBe('per_record')
    }
  })

  it('sets Discrepancies and Events Log as table PDFs', () => {
    for (const key of ['discrepancies', 'events_log']) {
      expect(EXPORT_MODULES.find((x) => x.key === key)?.pdfStrategy, key).toBe('table')
    }
  })

  it('scopes SMS, AEP, and Civilian Training to civilian airports', () => {
    for (const key of ['sms', 'aep', 'training_part139']) {
      expect(EXPORT_MODULES.find((x) => x.key === key)?.appliesTo, key).toBe('civilian')
    }
  })

  it('every non-excluded module declares a primary date column', () => {
    for (const m of EXPORT_MODULES) {
      if (m.pdfStrategy === 'excluded') continue
      expect(typeof m.dateColumn, m.key).toBe('string')
      expect(m.dateColumn.length, m.key).toBeGreaterThan(0)
    }
  })
})
