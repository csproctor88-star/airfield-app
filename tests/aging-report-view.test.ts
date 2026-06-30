import { describe, it, expect } from 'vitest'
import { filterAging } from '@/components/reports/aging-report-view'
import type { AgingDiscrepanciesData } from '@/lib/reports/aging-discrepancies-data'

const disc = (over: Record<string, unknown>) => ({
  id: 'x', display_id: 'D', title: 't', location_text: 'L', assigned_shop: 'CES', days_open: 1, ...over,
}) as AgingDiscrepanciesData['tiers'][number]['discrepancies'][number]

const data: AgingDiscrepanciesData = {
  tiers: [
    { label: '0-30', min: 0, max: 30, color: '#0f0', discrepancies: [disc({ id: 'a', assigned_shop: 'CES', days_open: 10 })] },
    { label: '90+', min: 90, max: 9999, color: '#f00', discrepancies: [
      disc({ id: 'b', assigned_shop: 'CEV', days_open: 120 }),
      disc({ id: 'c', assigned_shop: null, days_open: 100 }),
    ] },
  ],
  summary: { total: 3, byShop: [], avgDaysOpen: 0, oldest: null },
}

describe('filterAging', () => {
  it('no filter returns all', () => {
    expect(filterAging(data, null, null).summary.total).toBe(3)
  })
  it('tier filter narrows to that tier', () => {
    const r = filterAging(data, '90+', null)
    expect(r.summary.total).toBe(2)
    expect(r.tiers.find(t => t.label === '0-30')!.discrepancies.length).toBe(0)
  })
  it('shop filter narrows across tiers', () => {
    expect(filterAging(data, null, 'CEV').summary.total).toBe(1)
  })
  it('__unassigned matches a null shop and labels it Unassigned', () => {
    const r = filterAging(data, null, '__unassigned')
    expect(r.summary.total).toBe(1)
    expect(r.summary.byShop[0].shop).toBe('Unassigned')
  })
})
