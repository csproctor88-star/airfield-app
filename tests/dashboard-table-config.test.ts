import { describe, it, expect } from 'vitest'
import { normalizeTableConfig } from '@/lib/dashboard/table/config'
import type { ColumnDef, FilterDef, ExtraConfigDef } from '@/lib/dashboard/table/types'

type R = { a: string }
const cols: ColumnDef<R>[] = [
  { key: 'a', label: 'A', accessor: r => r.a, defaultVisible: true },
  { key: 'b', label: 'B', accessor: () => '' },
]
const filters: FilterDef<R>[] = [
  { key: 'status', label: 'S', kind: 'status', defaultSelected: ['open'], predicate: () => true },
]
const extras: ExtraConfigDef[] = [
  { key: 'scope', label: 'Scope', default: 'today', options: [{ value: 'today', label: 'T' }, { value: 'all', label: 'A' }] },
]
const d = { columns: cols, filters, extras } as const

describe('normalizeTableConfig', () => {
  it('pre-Phase-4 config (empty) yields descriptor defaults — back-compat', () => {
    const c = normalizeTableConfig({}, d, cols)
    expect(c.columns).toBeUndefined()
    expect(c.filters).toEqual({ status: ['open'] })
    expect(c.extras).toEqual({ scope: 'today' })
  })
  it('drops unknown column keys', () => {
    expect(normalizeTableConfig({ columns: ['a', 'zzz'] }, d, cols).columns).toEqual(['a'])
  })
  it('drops filter keys not in descriptor', () => {
    expect(normalizeTableConfig({ filters: { bogus: ['x'], status: ['completed'] } }, d, cols).filters)
      .toEqual({ status: ['completed'] })
  })
  it('coerces unknown extra value to the default', () => {
    expect(normalizeTableConfig({ extras: { scope: 'nope' } }, d, cols).extras).toEqual({ scope: 'today' })
  })
  it('preserves a valid title', () => {
    expect(normalizeTableConfig({ title: 'Mine' }, d, cols).title).toBe('Mine')
  })
})
