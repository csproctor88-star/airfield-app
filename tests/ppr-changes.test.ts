import { describe, it, expect } from 'vitest'
import { computePprChanges } from '@/lib/ppr-changes'
import type { PprColumn } from '@/lib/supabase/ppr'

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

const base = { arrival_date: '2026-06-12', column_values: {} as Record<string, string>, notes: null as string | null }

describe('computePprChanges', () => {
  it('returns empty when nothing changed', () => {
    expect(computePprChanges(base, { ...base }, [])).toEqual([])
  })

  it('reports an arrival-date change with readable dates', () => {
    const out = computePprChanges(base, { ...base, arrival_date: '2026-06-13' }, [])
    expect(out).toEqual([{ label: 'Arrival Date', from: '12 Jun 2026', to: '13 Jun 2026' }])
  })

  it('reports a custom text column change labelled by column name', () => {
    const cols = [col({ id: 'park', column_name: 'Parking' })]
    const before = { ...base, column_values: { park: 'Apron A' } }
    const after = { ...base, column_values: { park: 'Apron B' } }
    expect(computePprChanges(before, after, cols)).toEqual([
      { label: 'Parking', from: 'Apron A', to: 'Apron B' },
    ])
  })

  it('formats yes_no_na and time columns via the display SoT', () => {
    const cols = [
      col({ id: 'hot', column_name: 'Hot Refuel', column_type: 'yes_no_na' }),
      col({ id: 'eta', column_name: 'ETA', column_type: 'time' }),
    ]
    const before = { ...base, column_values: { hot: 'yes', eta: '1200' } }
    const after = { ...base, column_values: { hot: 'no', eta: '1300' } }
    expect(computePprChanges(before, after, cols)).toEqual([
      { label: 'Hot Refuel', from: 'YES', to: 'NO' },
      { label: 'ETA', from: '1200Z', to: '1300Z' },
    ])
  })

  it('pairs Zulu + local on time columns when a tz is supplied', () => {
    const cols = [col({ id: 'eta', column_name: 'ETA', column_type: 'time' })]
    const before = { ...base, column_values: { eta: '1200' } }
    const after = { ...base, column_values: { eta: '1300' } }
    // base.arrival_date is 2026-06-12 (EDT, UTC-4).
    expect(computePprChanges(before, after, cols, { tz: 'America/New_York' })).toEqual([
      { label: 'ETA', from: '1200Z (0800L)', to: '1300Z (0900L)' },
    ])
  })

  it('reports a newly-set column (empty → value)', () => {
    const cols = [col({ id: 'park', column_name: 'Parking' })]
    const out = computePprChanges({ ...base, column_values: {} }, { ...base, column_values: { park: 'Apron C' } }, cols)
    expect(out).toEqual([{ label: 'Parking', from: '', to: 'Apron C' }])
  })

  it('reports a notes change', () => {
    const out = computePprChanges(base, { ...base, notes: 'Bringing pax' }, [])
    expect(out).toEqual([{ label: 'Notes', from: '', to: 'Bringing pax' }])
  })

  it('treats null and empty notes as equal (no change)', () => {
    expect(computePprChanges({ ...base, notes: null }, { ...base, notes: '' }, [])).toEqual([])
  })

  it('ignores info_only columns', () => {
    const cols = [col({ id: 'note', column_name: 'Info', column_type: 'info_only' })]
    const out = computePprChanges({ ...base, column_values: { note: 'a' } }, { ...base, column_values: { note: 'b' } }, cols)
    expect(out).toEqual([])
  })

  it('orders changes: arrival date, then columns (by sort_order), then notes', () => {
    const cols = [
      col({ id: 'b2', column_name: 'Second', sort_order: 2 }),
      col({ id: 'a1', column_name: 'First', sort_order: 1 }),
    ]
    const before = { arrival_date: '2026-06-12', column_values: { a1: 'x', b2: 'y' }, notes: 'old' }
    const after = { arrival_date: '2026-06-13', column_values: { a1: 'x2', b2: 'y2' }, notes: 'new' }
    expect(computePprChanges(before, after, cols).map((c) => c.label)).toEqual([
      'Arrival Date', 'First', 'Second', 'Notes',
    ])
  })

  it('does not report unchanged columns', () => {
    const cols = [col({ id: 'a', column_name: 'A' }), col({ id: 'b', column_name: 'B' })]
    const before = { ...base, column_values: { a: '1', b: '2' } }
    const after = { ...base, column_values: { a: '1', b: '3' } }
    expect(computePprChanges(before, after, cols)).toEqual([{ label: 'B', from: '2', to: '3' }])
  })
})
