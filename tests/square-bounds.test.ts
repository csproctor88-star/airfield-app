import { describe, it, expect } from 'vitest'
import { squareBoundsMeters } from '@/lib/calculations/geometry'

describe('squareBoundsMeters', () => {
  it('produces a symmetric box around the center', () => {
    const b = squareBoundsMeters(42.6, -82.8, 2)
    expect(b.north).toBeGreaterThan(42.6)
    expect(b.south).toBeLessThan(42.6)
    expect(b.east).toBeGreaterThan(-82.8)
    expect(b.west).toBeLessThan(-82.8)
    // N-S extent: dLat = 2 / 111320 deg each side
    expect(b.north - 42.6).toBeCloseTo(2 / 111320, 9)
    // E-W extent grows with 1/cos(lat), so it exceeds the N-S extent at 42.6°N
    expect(b.east + 82.8).toBeGreaterThan(b.north - 42.6)
  })

  it('is centered — north/south and east/west are equal and opposite', () => {
    const b = squareBoundsMeters(0, 0, 10)
    expect(b.north).toBeCloseTo(-b.south, 12)
    expect(b.east).toBeCloseTo(-b.west, 12)
    // at the equator, cos(0) = 1, so lat and lng offsets match
    expect(b.north).toBeCloseTo(b.east, 12)
  })
})
