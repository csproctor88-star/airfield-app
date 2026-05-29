import { describe, it, expect } from 'vitest'
import { normalizeRoute } from '@/lib/page-view-route'

// normalizeRoute collapses dynamic segments (UUIDs, numeric ids) to a stable
// route pattern so page-view rollups aggregate per feature, not per record.
describe('normalizeRoute', () => {
  it('leaves a static route unchanged', () => {
    expect(normalizeRoute('/discrepancies')).toBe('/discrepancies')
    expect(normalizeRoute('/')).toBe('/')
  })

  it('collapses a UUID segment to [id]', () => {
    expect(normalizeRoute('/discrepancies/3f2504e0-4f89-41d3-9a0c-0305e82c3301'))
      .toBe('/discrepancies/[id]')
  })

  it('collapses numeric segments', () => {
    expect(normalizeRoute('/amtr/12345')).toBe('/amtr/[id]')
    expect(normalizeRoute('/waivers/annual-review/2026')).toBe('/waivers/annual-review/[id]')
  })

  it('collapses ids in the middle of a path', () => {
    expect(normalizeRoute('/waivers/3f2504e0-4f89-41d3-9a0c-0305e82c3301/edit'))
      .toBe('/waivers/[id]/edit')
  })

  it('strips query strings and trailing slashes', () => {
    expect(normalizeRoute('/notams/?foo=bar')).toBe('/notams')
    expect(normalizeRoute('/notams/')).toBe('/notams')
  })

  it('handles empty / missing input', () => {
    expect(normalizeRoute('')).toBe('/')
    expect(normalizeRoute(undefined as unknown as string)).toBe('/')
  })

  it('truncates pathological length', () => {
    const long = '/' + 'a'.repeat(500)
    expect(normalizeRoute(long).length).toBeLessThanOrEqual(120)
  })
})
