// Renderer-agnostic map spatial queries over the in-memory feature index.
// Shared by the Google and OpenLayers map adapters so hit-testing behaves
// identically regardless of the underlying map library. No map-library imports.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FeatureIndexEntry = { lat: number; lng: number; type: string; props: Record<string, any> }
export type FeatureHit = { id: string } & FeatureIndexEntry
export type LngLatBounds = { south: number; north: number; west: number; east: number }

/** Great-circle distance between two lat/lng points, in metres. */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Nearest feature to a point within a metre threshold, or null. */
export function nearestFeatureInIndex(
  featureIndex: Map<string, FeatureIndexEntry>,
  lat: number,
  lng: number,
  thresholdMeters = 50,
): FeatureHit | null {
  let nearest: FeatureHit | null = null
  let minDist = thresholdMeters
  featureIndex.forEach((entry, id) => {
    const dist = haversineMeters(lat, lng, entry.lat, entry.lng)
    if (dist < minDist) {
      minDist = dist
      nearest = { id, ...entry }
    }
  })
  return nearest
}

/** All features whose point falls within the bounds (inclusive). */
export function featuresInBoundsIndex(
  featureIndex: Map<string, FeatureIndexEntry>,
  bounds: LngLatBounds,
): FeatureHit[] {
  const out: FeatureHit[] = []
  featureIndex.forEach((entry, id) => {
    if (
      entry.lat >= bounds.south &&
      entry.lat <= bounds.north &&
      entry.lng >= bounds.west &&
      entry.lng <= bounds.east
    ) {
      out.push({ id, ...entry })
    }
  })
  return out
}
