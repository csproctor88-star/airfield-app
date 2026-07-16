import { describe, it, expect } from 'vitest'
import { simplifyLine } from '@/lib/calculations/simplify'

// Portland ANG Base-ish anchor — the dense-import case this exists for.
const LAT = 45.589
const LNG = -122.597

// Same local-equirectangular feet-space the app's buffer math uses.
const FT_PER_DEG_LAT = 364000
const ftPerDegLon = (lat: number) => FT_PER_DEG_LAT * Math.cos(lat * Math.PI / 180)

/** Offset a [lng, lat] point by feet east / feet north. */
function offsetFt(origin: [number, number], eastFt: number, northFt: number): [number, number] {
  return [origin[0] + eastFt / ftPerDegLon(origin[1]), origin[1] + northFt / FT_PER_DEG_LAT]
}

/** Perpendicular distance (ft) from a point to a segment, in feet-space. */
function pointToSegmentFt(p: [number, number], a: [number, number], b: [number, number]): number {
  const fLon = ftPerDegLon(a[1])
  const px = (p[0] - a[0]) * fLon, py = (p[1] - a[1]) * FT_PER_DEG_LAT
  const bx = (b[0] - a[0]) * fLon, by = (b[1] - a[1]) * FT_PER_DEG_LAT
  const lenSq = bx * bx + by * by
  if (lenSq === 0) return Math.sqrt(px * px + py * py)
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / lenSq))
  const dx = px - t * bx, dy = py - t * by
  return Math.sqrt(dx * dx + dy * dy)
}

/** Distance (ft) from a point to the nearest segment of a polyline. */
function pointToLineFt(p: [number, number], line: [number, number][]): number {
  let min = Infinity
  for (let i = 0; i < line.length - 1; i++) {
    min = Math.min(min, pointToSegmentFt(p, line[i], line[i + 1]))
  }
  return min
}

describe('simplifyLine', () => {
  it('returns lines with fewer than 3 points unchanged', () => {
    const one: [number, number][] = [[LNG, LAT]]
    const two: [number, number][] = [[LNG, LAT], offsetFt([LNG, LAT], 100, 0)]
    expect(simplifyLine([], 1)).toEqual([])
    expect(simplifyLine(one, 1)).toEqual(one)
    expect(simplifyLine(two, 1)).toEqual(two)
  })

  it('collapses collinear intermediate points to the two endpoints', () => {
    const start: [number, number] = [LNG, LAT]
    // 100 points marching due east, 10 ft apart — a survey-grade straight segment.
    const line: [number, number][] = []
    for (let i = 0; i <= 100; i++) line.push(offsetFt(start, i * 10, 0))
    const out = simplifyLine(line, 1)
    expect(out).toEqual([line[0], line[100]])
  })

  it('always keeps the first and last points', () => {
    const start: [number, number] = [LNG, LAT]
    const line: [number, number][] = [
      start,
      offsetFt(start, 50, 0.1),
      offsetFt(start, 100, -0.1),
      offsetFt(start, 150, 0),
    ]
    const out = simplifyLine(line, 5)
    expect(out[0]).toEqual(line[0])
    expect(out[out.length - 1]).toEqual(line[line.length - 1])
  })

  it('keeps a corner that deviates beyond the tolerance', () => {
    const start: [number, number] = [LNG, LAT]
    const corner = offsetFt(start, 500, 0)
    const end = offsetFt(start, 500, 500)
    const out = simplifyLine([start, corner, end], 1)
    expect(out).toEqual([start, corner, end])
  })

  it('drops a micro-jog smaller than the tolerance', () => {
    const start: [number, number] = [LNG, LAT]
    const jog = offsetFt(start, 250, 0.4) // 0.4 ft off-axis
    const end = offsetFt(start, 500, 0)
    const out = simplifyLine([start, jog, end], 1)
    expect(out).toEqual([start, end])
  })

  it('handles closed rings (first point equals last) without collapsing them', () => {
    // A Polygon import produces a ring whose first and last coords are identical.
    const a: [number, number] = [LNG, LAT]
    const b = offsetFt(a, 800, 0)
    const c = offsetFt(a, 400, 600)
    const out = simplifyLine([a, b, c, a], 1)
    expect(out).toEqual([a, b, c, a])
  })

  it('keeps every original point within tolerance of the simplified line', () => {
    // Quarter arc, radius 500 ft, sampled every ~4 ft — 200 points.
    const center: [number, number] = [LNG, LAT]
    const line: [number, number][] = []
    for (let i = 0; i <= 200; i++) {
      const theta = (i / 200) * (Math.PI / 2)
      line.push(offsetFt(center, 500 * Math.cos(theta), 500 * Math.sin(theta)))
    }
    const tolerance = 1
    const out = simplifyLine(line, tolerance)
    expect(out.length).toBeLessThan(50)
    for (const p of line) {
      expect(pointToLineFt(p, out)).toBeLessThanOrEqual(tolerance + 1e-6)
    }
  })

  it('does not mutate the input array', () => {
    const start: [number, number] = [LNG, LAT]
    const line: [number, number][] = [start, offsetFt(start, 250, 0.1), offsetFt(start, 500, 0)]
    const snapshot = JSON.parse(JSON.stringify(line))
    simplifyLine(line, 1)
    expect(line).toEqual(snapshot)
  })
})
