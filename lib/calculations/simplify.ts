// Ramer-Douglas-Peucker polyline simplification for [lng, lat] coordinate arrays.
// Tolerance is in feet, measured in the same local-equirectangular feet-space as
// the taxiway clearance buffer math. Survey-grade GeoJSON imports carry a vertex
// every few feet; clearance envelopes are 50-200 ft wide, so a 1 ft tolerance is
// visually and analytically lossless while cutting point counts by ~90%.

const FT_PER_DEG_LAT = 364000

/** Default tolerance for taxiway centerline simplification (import + render). */
export const TAXIWAY_SIMPLIFY_TOLERANCE_FT = 1

/**
 * Simplify a [lng, lat] polyline, keeping every original point within
 * `toleranceFt` of the result. Endpoints are always kept; closed rings
 * (first point === last point) are handled via point-distance fallback.
 * Never mutates the input.
 */
export function simplifyLine(coords: [number, number][], toleranceFt: number): [number, number][] {
  if (coords.length < 3) return coords.slice()

  const midLat = coords.reduce((s, c) => s + c[1], 0) / coords.length
  const ftPerDegLon = FT_PER_DEG_LAT * Math.cos(midLat * Math.PI / 180)

  // Project once into feet-space
  const xs = new Float64Array(coords.length)
  const ys = new Float64Array(coords.length)
  for (let i = 0; i < coords.length; i++) {
    xs[i] = coords[i][0] * ftPerDegLon
    ys[i] = coords[i][1] * FT_PER_DEG_LAT
  }

  const keep = new Array<boolean>(coords.length).fill(false)
  keep[0] = true
  keep[coords.length - 1] = true

  // Iterative stack — recursion depth is O(n) worst-case on dense imports
  const stack: [number, number][] = [[0, coords.length - 1]]
  while (stack.length > 0) {
    const [first, last] = stack.pop()!
    const ax = xs[first], ay = ys[first]
    const dx = xs[last] - ax, dy = ys[last] - ay
    const lenSq = dx * dx + dy * dy

    let maxDist = 0
    let idx = -1
    for (let i = first + 1; i < last; i++) {
      const px = xs[i] - ax, py = ys[i] - ay
      let dist: number
      if (lenSq === 0) {
        // Degenerate span (e.g. closed ring endpoints) — distance to the point
        dist = Math.sqrt(px * px + py * py)
      } else {
        const t = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq))
        const ex = px - t * dx, ey = py - t * dy
        dist = Math.sqrt(ex * ex + ey * ey)
      }
      if (dist > maxDist) {
        maxDist = dist
        idx = i
      }
    }

    if (idx !== -1 && maxDist > toleranceFt) {
      keep[idx] = true
      stack.push([first, idx], [idx, last])
    }
  }

  return coords.filter((_, i) => keep[i])
}
