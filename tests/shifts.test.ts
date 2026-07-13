import { describe, it, expect } from 'vitest'
import { getActiveShifts, bucketItemsByShift } from '@/lib/shifts'

describe('getActiveShifts', () => {
  it('defaults to two shifts with default labels when base is null', () => {
    expect(getActiveShifts(null)).toEqual([
      { key: 'day', label: 'Day Shift' },
      { key: 'swing', label: 'Swing Shift' },
    ])
  })

  it('returns a single day shift for a 1-shift base', () => {
    expect(getActiveShifts({ shift_count: 1 })).toEqual([
      { key: 'day', label: 'Day Shift' },
    ])
  })

  it('returns all three shifts in order for a 3-shift base', () => {
    expect(getActiveShifts({ shift_count: 3 }).map((s) => s.key)).toEqual(['day', 'swing', 'mid'])
  })

  it('applies trimmed custom names and falls back on blank names', () => {
    const shifts = getActiveShifts({
      shift_count: 2,
      shift_name_day: '  Alpha ',
      shift_name_swing: '   ',
    })
    expect(shifts).toEqual([
      { key: 'day', label: 'Alpha' },
      { key: 'swing', label: 'Swing Shift' },
    ])
  })

  it('clamps out-of-range counts to 1..3', () => {
    expect(getActiveShifts({ shift_count: 0 }).length).toBe(1)
    expect(getActiveShifts({ shift_count: 5 }).length).toBe(3)
  })
})

describe('bucketItemsByShift', () => {
  const item = (id: string, shift: string) => ({ id, shift })

  it('groups items under their active shift in shift order', () => {
    const items = [item('a', 'swing'), item('b', 'day')]
    const buckets = bucketItemsByShift(items, { shift_count: 2 })
    expect(buckets.map((b) => b.key)).toEqual(['day', 'swing'])
    expect(buckets[0].items.map((i) => i.id)).toEqual(['b'])
    expect(buckets[1].items.map((i) => i.id)).toEqual(['a'])
  })

  it('folds items from inactive shifts into the first bucket, appended after its own items', () => {
    const items = [item('m', 'mid'), item('d', 'day'), item('s', 'swing')]
    const buckets = bucketItemsByShift(items, { shift_count: 2 })
    expect(buckets.map((b) => b.key)).toEqual(['day', 'swing'])
    expect(buckets[0].items.map((i) => i.id)).toEqual(['d', 'm'])
    expect(buckets[1].items.map((i) => i.id)).toEqual(['s'])
  })

  it('puts everything in one bucket on a 1-shift base, including unknown keys', () => {
    const items = [item('d', 'day'), item('s', 'swing'), item('x', 'bogus')]
    const buckets = bucketItemsByShift(items, { shift_count: 1 })
    expect(buckets.length).toBe(1)
    expect(buckets[0].items.map((i) => i.id)).toEqual(['d', 's', 'x'])
  })

  it('uses custom labels on the buckets', () => {
    const buckets = bucketItemsByShift([], { shift_count: 1, shift_name_day: 'Ops' })
    expect(buckets[0].label).toBe('Ops')
  })
})
