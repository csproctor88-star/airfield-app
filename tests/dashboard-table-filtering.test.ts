import { describe, it, expect } from 'vitest'
import { applyFilters } from '@/lib/dashboard/table/filtering'
import type { FilterDef, TableWidgetConfig } from '@/lib/dashboard/table/types'

type R = { type: string; status: string; name: string }
const rows: R[] = [
  { type: 'lighting', status: 'open', name: 'Alpha' },
  { type: 'pavement', status: 'open', name: 'Bravo' },
  { type: 'lighting', status: 'completed', name: 'Charlie' },
]
const filters: FilterDef<R>[] = [
  { key: 'type', label: 'Type', kind: 'enum-multi',
    predicate: (r, sel) => (sel as string[]).includes(r.type) },
  { key: 'status', label: 'Status', kind: 'status', defaultSelected: ['open'],
    predicate: (r, sel) => (sel as string[]).includes(r.status) },
  { key: 'q', label: 'Search', kind: 'text',
    predicate: (r, sel) => r.name.toLowerCase().includes((sel as string).toLowerCase()) },
]
const run = (config: TableWidgetConfig) => applyFilters(rows, config, filters).map(r => r.name)

describe('applyFilters', () => {
  it('empty enum selection is passthrough (no filter)', () => {
    expect(run({ filters: { type: [] } })).toEqual(['Alpha', 'Bravo'])
  })
  it('applies the status default when unset', () => {
    expect(run({})).toEqual(['Alpha', 'Bravo'])
  })
  it('enum-multi is OR within a key', () => {
    expect(run({ filters: { type: ['lighting', 'pavement'], status: ['open', 'completed'] } }))
      .toEqual(['Alpha', 'Bravo', 'Charlie'])
  })
  it('AND across keys', () => {
    expect(run({ filters: { type: ['lighting'], status: ['open', 'completed'] } }))
      .toEqual(['Alpha', 'Charlie'])
  })
  it('text contains; empty string is passthrough', () => {
    expect(run({ filters: { status: ['open', 'completed'], q: 'ha' } })).toEqual(['Alpha', 'Charlie'])
    expect(run({ filters: { status: ['open', 'completed'], q: '' } })).toEqual(['Alpha', 'Bravo', 'Charlie'])
  })
})
