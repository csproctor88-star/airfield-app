import { describe, it, expect } from 'vitest'
import { getOlImagery } from '@/lib/map-providers'

// OL can't render Google's tiles, so 'google' must fall back to Esri; 'esri'
// stays Esri; 'bing' uses the quadkey scheme. Locks the fallback so the OL
// renderer never ends up with no basemap.
describe('getOlImagery', () => {
  it('uses Esri World Imagery for esri', () => {
    const img = getOlImagery('esri')
    expect(img.scheme).toBe('xyz')
    if (img.scheme === 'xyz') expect(img.url).toContain('arcgisonline.com')
  })

  it('falls back to Esri for google (no OL equivalent for Google tiles)', () => {
    const img = getOlImagery('google')
    expect(img.scheme).toBe('xyz')
    if (img.scheme === 'xyz') expect(img.url).toContain('World_Imagery')
  })

  it('uses the bing quadkey scheme for bing', () => {
    expect(getOlImagery('bing').scheme).toBe('bing-quadkey')
  })
})
