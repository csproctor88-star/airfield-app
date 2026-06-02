import { describe, it, expect } from 'vitest'
import { haversineMeters, nearestFeatureInIndex, featuresInBoundsIndex, type FeatureIndexEntry } from '@/lib/map-spatial'

// ─── Renderer-agnostic map spatial queries ───
// Shared by the Google and OpenLayers adapters: nearest-feature-to-point and
// features-in-bounds over the in-memory featureIndex. Mirrors the semantics
// the Google adapter has used (haversine threshold; inclusive bounds).

const idx = (entries: Array<[string, number, number]>) => {
  const m = new Map<string, FeatureIndexEntry>()
  for (const [id, lat, lng] of entries) m.set(id, { lat, lng, type: 't', props: {} })
  return m
}

describe('haversineMeters', () => {
  it('is ~0 for identical points', () => {
    expect(haversineMeters(42.6, -82.8, 42.6, -82.8)).toBeCloseTo(0, 5)
  })
  it('matches a known distance (~111.2 km per degree latitude)', () => {
    const d = haversineMeters(42.0, -82.8, 43.0, -82.8)
    expect(d).toBeGreaterThan(111_000)
    expect(d).toBeLessThan(111_400)
  })
})

describe('nearestFeatureInIndex', () => {
  const features = idx([['a', 42.60000, -82.80000], ['b', 42.60100, -82.80100]])

  it('returns the closest feature within the threshold', () => {
    const hit = nearestFeatureInIndex(features, 42.60002, -82.80002, 50)
    expect(hit?.id).toBe('a')
  })
  it('returns null when nothing is within the threshold', () => {
    expect(nearestFeatureInIndex(features, 42.70000, -82.90000, 50)).toBeNull()
  })
})

describe('featuresInBoundsIndex', () => {
  const features = idx([['a', 42.600, -82.800], ['b', 42.650, -82.700], ['c', 42.500, -82.900]])
  it('returns only features inside the bounds (inclusive)', () => {
    const out = featuresInBoundsIndex(features, { south: 42.59, north: 42.66, west: -82.81, east: -82.69 })
    expect(out.map((f) => f.id).sort()).toEqual(['a', 'b'])
  })
})
