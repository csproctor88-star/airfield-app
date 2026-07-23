import { describe, it, expect } from 'vitest'
import { formatPprColumnValue, type PprColumn } from '@/lib/supabase/ppr'

function col(over: Partial<PprColumn> & { id: string; column_name: string }): PprColumn {
  return {
    base_id: 'b',
    column_type: 'text',
    sort_order: 0,
    is_required: false,
    show_on_status: true,
    show_on_form: true,
    show_on_log: true,
    time_display: null,
    info_text: null,
    created_at: '',
    ...over,
  }
}

describe('formatPprColumnValue — time columns', () => {
  const timeCol = col({ id: 't', column_name: 'ETA', column_type: 'time' })
  const localCol = col({ id: 't', column_name: 'ETA', column_type: 'time', time_display: 'local' })

  it('pairs Zulu + local when tz and dateISO are supplied', () => {
    expect(formatPprColumnValue(timeCol, '1500', { tz: 'America/New_York', dateISO: '2026-06-12' }))
      .toBe('1500Z (1100L)')
  })

  it('leads with local when time_display=local, Zulu in parens', () => {
    expect(formatPprColumnValue(localCol, '1500', { tz: 'America/New_York', dateISO: '2026-06-12' }))
      .toBe('1100L (1500Z)')
  })

  it('flags a midnight rollover in the paired display', () => {
    expect(formatPprColumnValue(timeCol, '0200', { tz: 'America/New_York', dateISO: '2026-06-12' }))
      .toBe('0200Z (2200L -1d)')
    expect(formatPprColumnValue(timeCol, '1500', { tz: 'Asia/Tokyo', dateISO: '2026-06-12' }))
      .toBe('1500Z (0000L +1d)')
  })

  it('shows Zulu only for a zero-offset (UTC) base even with a date', () => {
    expect(formatPprColumnValue(timeCol, '1500', { tz: 'UTC', dateISO: '2026-06-12' }))
      .toBe('1500Z')
  })

  it('keeps the historical single-value behavior when no date is passed (PDF path)', () => {
    // tz only → Zulu for a default column, local-only for a local column.
    expect(formatPprColumnValue(timeCol, '1500', { tz: 'America/New_York' })).toBe('1500Z')
    expect(formatPprColumnValue(localCol, '1500', { tz: 'America/New_York' })).toBe('1100')
  })

  it('falls back to Zulu with no tz at all', () => {
    expect(formatPprColumnValue(timeCol, '1500')).toBe('1500Z')
  })

  it('accepts a colon-bearing legacy value', () => {
    expect(formatPprColumnValue(timeCol, '15:00', { tz: 'America/New_York', dateISO: '2026-06-12' }))
      .toBe('1500Z (1100L)')
  })
})
