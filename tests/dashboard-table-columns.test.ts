import { describe, it, expect } from 'vitest'
import { resolveVisibleColumns } from '@/lib/dashboard/table/columns'
import type { ColumnDef } from '@/lib/dashboard/table/types'

const cols: ColumnDef<{ a: string; b: string; c: string }>[] = [
  { key: 'a', label: 'A', accessor: r => r.a, defaultVisible: true },
  { key: 'b', label: 'B', accessor: r => r.b, defaultVisible: true },
  { key: 'c', label: 'C', accessor: r => r.c },
]

describe('resolveVisibleColumns', () => {
  it('uses defaultVisible when config has no columns', () => {
    expect(resolveVisibleColumns(cols, undefined).map(c => c.key)).toEqual(['a', 'b'])
  })
  it('honors saved subset and order', () => {
    expect(resolveVisibleColumns(cols, ['c', 'a']).map(c => c.key)).toEqual(['c', 'a'])
  })
  it('drops unknown keys', () => {
    expect(resolveVisibleColumns(cols, ['a', 'zzz']).map(c => c.key)).toEqual(['a'])
  })
  it('falls back to defaults when saved subset is empty', () => {
    expect(resolveVisibleColumns(cols, []).map(c => c.key)).toEqual(['a', 'b'])
  })
})
