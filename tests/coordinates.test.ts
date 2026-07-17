import { describe, it, expect } from 'vitest'
import { forward } from 'mgrs'
import { formatCoordsDMS } from '@/lib/utils'
import type { LatLon } from '@/lib/calculations/geometry'
import {
  parseCoordinateInput,
  formatDD,
  formatDDM,
  formatDMS,
  formatMGRS,
  type CoordinateParseResult,
  type CoordinateFormat,
} from '@/lib/calculations/coordinates'

// --- Fixture helpers -------------------------------------------------------

/** Narrow a parse result to the success arm, throwing a useful message if not. */
function expectOk(res: CoordinateParseResult): Extract<CoordinateParseResult, { ok: true }> {
  if (!res.ok) throw new Error(`expected ok:true, got error: ${res.error}`)
  return res
}

/** Great-circle distance in metres between two points (test-only helper). */
function distMeters(a: LatLon, b: LatLon): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Verbatim copy of app/(app)/obstructions/page.tsx:63-78 used as a round-trip
// fixture (the parser's packed-NOTAM branch is the exact inverse of this).
function toNotamCoordString(lat: number, lon: number): string {
  const fmt = (dec: number, degPad: number, pos: string, neg: string) => {
    const dir = dec >= 0 ? pos : neg
    const abs = Math.abs(dec)
    const d = Math.floor(abs)
    const minFloat = (abs - d) * 60
    const m = Math.floor(minFloat)
    const s = Math.floor((minFloat - m) * 60)
    return `${String(d).padStart(degPad, '0')}${String(m).padStart(2, '0')}${String(s).padStart(2, '0')}${dir}`
  }
  return `${fmt(lat, 2, 'N', 'S')}${fmt(lon, 3, 'E', 'W')}`
}

const SELFRIDGE: LatLon = { lat: 42.60522, lon: -82.82047 }
const ARCSEC_DEG = 1 / 3600

// ---------------------------------------------------------------------------

describe('formatters', () => {
  it('formatDD renders decimal degrees to 5 digits by default', () => {
    expect(formatDD(SELFRIDGE)).toBe('42.60522, -82.82047')
    expect(formatDD(SELFRIDGE, 3)).toBe('42.605, -82.820')
  })

  it('formatDMS renders degrees-minutes-seconds with hemisphere suffix', () => {
    expect(formatDMS(SELFRIDGE)).toBe(`42°36'18.8"N 082°49'13.7"W`)
  })

  it('formatDDM renders degrees-decimal-minutes with hemisphere prefix (same shape as formatCoordsDMS)', () => {
    expect(formatDDM(SELFRIDGE)).toBe(`N42°36.31' W082°49.23'`)
    // Canonical DDM matches the legacy lib/utils.ts output verbatim.
    expect(formatDDM(SELFRIDGE)).toBe(formatCoordsDMS(SELFRIDGE.lat, SELFRIDGE.lon))
  })

  it('formatMGRS wraps mgrs.forward with lon-first ordering (known vector)', () => {
    expect(formatMGRS(SELFRIDGE, 5)).toBe('17TLH5066718582')
    expect(formatMGRS(SELFRIDGE)).toBe('17TLH5066718582') // default accuracy 5
  })

  it('formatMGRS returns empty string when mgrs throws (poles)', () => {
    expect(formatMGRS({ lat: 89.9, lon: 0 })).toBe('')
    expect(formatMGRS({ lat: -89.9, lon: 0 })).toBe('')
  })
})

describe('decimal degrees (dd)', () => {
  const cases: Array<{ name: string; input: string }> = [
    { name: 'comma separated, signed', input: '42.60522, -82.82047' },
    { name: 'space separated, signed', input: '42.60522 -82.82047' },
    { name: 'hemisphere suffixed', input: '42.60522N 82.82047W' },
    { name: 'hemisphere prefixed', input: 'N42.60522 W82.82047' },
    { name: 'reversed-order hemisphere pair', input: 'W082.82047 N42.60522' },
  ]
  for (const c of cases) {
    it(`parses ${c.name}`, () => {
      const res = expectOk(parseCoordinateInput(c.input))
      expect(res.format).toBe<CoordinateFormat>('dd')
      expect(res.point.lat).toBeCloseTo(42.60522, 5)
      expect(res.point.lon).toBeCloseTo(-82.82047, 5)
    })
  }

  it('parses negative-zero latitude without error', () => {
    const res = expectOk(parseCoordinateInput('-0.00000, -82.82047'))
    expect(res.format).toBe('dd')
    expect(res.point.lat === 0).toBe(true)
    expect(res.point.lon).toBeCloseTo(-82.82047, 5)
  })

  it('parses integer degrees', () => {
    const res = expectOk(parseCoordinateInput('42, -82'))
    expect(res.format).toBe('dd')
    expect(res.point.lat).toBe(42)
    expect(res.point.lon).toBe(-82)
  })
})

describe('degrees-minutes-seconds (dms)', () => {
  it('parses symbol separators', () => {
    const res = expectOk(parseCoordinateInput(`42°36'18.8"N 082°49'13.7"W`))
    expect(res.format).toBe('dms')
    expect(res.point.lat).toBeCloseTo(42.60522, 4)
    expect(res.point.lon).toBeCloseTo(-82.82047, 4)
  })

  it('parses colon separators', () => {
    const res = expectOk(parseCoordinateInput('42:36:19N 82:49:14W'))
    expect(res.format).toBe('dms')
    expect(res.point.lat).toBeCloseTo(42.6053, 3)
    expect(res.point.lon).toBeCloseTo(-82.8206, 3)
  })

  it('parses space-only tokens', () => {
    const res = expectOk(parseCoordinateInput('42 36 19N 82 49 14W'))
    expect(res.format).toBe('dms')
    expect(res.point.lat).toBeCloseTo(42.6053, 3)
    expect(res.point.lon).toBeCloseTo(-82.8206, 3)
  })

  it('parses unicode prime / double-prime marks', () => {
    const res = expectOk(parseCoordinateInput('42°36′18.8″N 082°49′13.7″W'))
    expect(res.format).toBe('dms')
    expect(res.point.lat).toBeCloseTo(42.60522, 4)
    expect(res.point.lon).toBeCloseTo(-82.82047, 4)
  })

  it('parses signed, hemisphere-free DMS', () => {
    const res = expectOk(parseCoordinateInput('42 36 19, -82 49 14'))
    expect(res.format).toBe('dms')
    expect(res.point.lat).toBeGreaterThan(0)
    expect(res.point.lon).toBeLessThan(0)
    expect(res.point.lat).toBeCloseTo(42.6053, 3)
    expect(res.point.lon).toBeCloseTo(-82.8206, 3)
  })

  it('parses fractional seconds', () => {
    const res = expectOk(parseCoordinateInput('42 36 19.5N 82 49 14.2W'))
    expect(res.format).toBe('dms')
    expect(res.point.lat).toBeCloseTo(42 + 36 / 60 + 19.5 / 3600, 6)
    expect(res.point.lon).toBeCloseTo(-(82 + 49 / 60 + 14.2 / 3600), 6)
  })

  it('parses a packed FAA NOTAM string', () => {
    const res = expectOk(parseCoordinateInput('423618N0824913W'))
    expect(res.format).toBe('dms')
    expect(res.point.lat).toBeCloseTo(42 + 36 / 60 + 18 / 3600, 6)
    expect(res.point.lon).toBeCloseTo(-(82 + 49 / 60 + 13 / 3600), 6)
  })

  it('round-trips toNotamCoordString within 1 arcsecond across all four quadrants', () => {
    const grid: LatLon[] = [
      { lat: 42.60522, lon: 11.031 }, // NE
      { lat: 42.60522, lon: -82.82047 }, // NW
      { lat: -33.8688, lon: 151.2093 }, // SE
      { lat: -22.9068, lon: -43.1729 }, // SW
    ]
    for (const p of grid) {
      const res = expectOk(parseCoordinateInput(toNotamCoordString(p.lat, p.lon)))
      expect(Math.abs(res.point.lat - p.lat)).toBeLessThan(ARCSEC_DEG + 1e-6)
      expect(Math.abs(res.point.lon - p.lon)).toBeLessThan(ARCSEC_DEG + 1e-6)
    }
  })
})

describe('degrees-decimal-minutes (ddm)', () => {
  it('parses space-tokenized DDM', () => {
    const res = expectOk(parseCoordinateInput('42 36.313N 082 49.228W'))
    expect(res.format).toBe('ddm')
    expect(res.point.lat).toBeCloseTo(42.60522, 4)
    expect(res.point.lon).toBeCloseTo(-82.82047, 4)
  })

  it('parses symbol DDM with hemisphere prefix', () => {
    const res = expectOk(parseCoordinateInput(`N42°36.31' W082°49.23'`))
    expect(res.format).toBe('ddm')
    expect(res.point.lat).toBeCloseTo(42.6052, 3)
    expect(res.point.lon).toBeCloseTo(-82.8205, 3)
  })

  it('round-trips parse(formatDDM(p)) within DDM quantization', () => {
    const res = expectOk(parseCoordinateInput(formatDDM(SELFRIDGE)))
    expect(res.format).toBe('ddm')
    // 0.01' quantization ~= 18.5 m cell; round-trip stays within ~10 m.
    expect(distMeters(res.point, SELFRIDGE)).toBeLessThan(12)
  })

  it('round-trips parse(formatCoordsDMS(...)) (lib/utils.ts output)', () => {
    const res = expectOk(parseCoordinateInput(formatCoordsDMS(SELFRIDGE.lat, SELFRIDGE.lon)))
    expect(res.format).toBe('ddm')
    expect(distMeters(res.point, SELFRIDGE)).toBeLessThan(12)
  })

  it('round-trips parse(formatDMS(p)) within DMS quantization', () => {
    const res = expectOk(parseCoordinateInput(formatDMS(SELFRIDGE)))
    expect(res.format).toBe('dms')
    expect(distMeters(res.point, SELFRIDGE)).toBeLessThan(3)
  })
})

describe('MGRS grid references (mgrs)', () => {
  it('round-trips known vectors at accuracies 1 through 5', () => {
    for (const acc of [1, 2, 3, 4, 5] as const) {
      const grid = forward([SELFRIDGE.lon, SELFRIDGE.lat], acc)
      const res = expectOk(parseCoordinateInput(grid))
      expect(res.format).toBe('mgrs')
      // Re-encoding the parsed cell centre yields the same grid string.
      expect(formatMGRS(res.point, acc)).toBe(grid)
    }
  })

  it('accepts spaced, unspaced, and lowercase grid strings', () => {
    const spaced = expectOk(parseCoordinateInput('17T LH 50667 18582'))
    const unspaced = expectOk(parseCoordinateInput('17TLH5066718582'))
    const lower = expectOk(parseCoordinateInput('17tlh5066718582'))
    for (const res of [spaced, unspaced, lower]) {
      expect(res.format).toBe('mgrs')
      expect(distMeters(res.point, SELFRIDGE)).toBeLessThan(2)
    }
  })

  it('round-trips CONUS / OCONUS / southern-hemisphere points within the 1 m cell', () => {
    const points: LatLon[] = [
      { lat: 42.60522, lon: -82.82047 }, // CONUS
      { lat: 48.8566, lon: 2.3522 }, // Europe (Paris)
      { lat: 21.3069, lon: -157.8583 }, // Pacific (Honolulu)
      { lat: -33.8688, lon: 151.2093 }, // Southern hemisphere (Sydney)
    ]
    for (const p of points) {
      const res = expectOk(parseCoordinateInput(formatMGRS(p, 5)))
      expect(res.format).toBe('mgrs')
      expect(distMeters(res.point, p)).toBeLessThan(2)
    }
  })

  it('rejects polar / out-of-band / malformed grid strings cleanly, without throwing', () => {
    const bad = ['61CVK5000050000', '17TLH999', 'ZAH1799918765', '99XVK1234512345']
    for (const s of bad) {
      let res: CoordinateParseResult | undefined
      expect(() => { res = parseCoordinateInput(s) }).not.toThrow()
      expect(res?.ok).toBe(false)
    }
  })
})

describe('hemisphere handling — all four quadrants', () => {
  const quads: Array<{ input: string; latSign: number; lonSign: number }> = [
    { input: '42.5N 82.5E', latSign: 1, lonSign: 1 },
    { input: '42.5N 82.5W', latSign: 1, lonSign: -1 },
    { input: '42.5S 82.5E', latSign: -1, lonSign: 1 },
    { input: '42.5S 82.5W', latSign: -1, lonSign: -1 },
  ]
  for (const q of quads) {
    it(`assigns signs for ${q.input}`, () => {
      const res = expectOk(parseCoordinateInput(q.input))
      expect(Math.sign(res.point.lat)).toBe(q.latSign)
      expect(Math.sign(res.point.lon)).toBe(q.lonSign)
      expect(Math.abs(res.point.lat)).toBeCloseTo(42.5, 6)
      expect(Math.abs(res.point.lon)).toBeCloseTo(82.5, 6)
    })
  }

  it('rejects sign AND hemisphere on the same value (no double-negation)', () => {
    const res = parseCoordinateInput('-82.8W')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/sign|hemisphere/i)
  })

  it('rejects a latitude letter on the longitude token', () => {
    const res = parseCoordinateInput('42N 82N')
    expect(res.ok).toBe(false)
  })
})

describe('range validation (mirrors app/api/elevation/route.ts)', () => {
  it('accepts boundary values 90 / -90 / 180 / -180', () => {
    expect(expectOk(parseCoordinateInput('90, 0')).point.lat).toBe(90)
    expect(expectOk(parseCoordinateInput('-90, 0')).point.lat).toBe(-90)
    expect(expectOk(parseCoordinateInput('0, 180')).point.lon).toBe(180)
    expect(expectOk(parseCoordinateInput('0, -180')).point.lon).toBe(-180)
  })

  it('rejects latitude just beyond 90', () => {
    const res = parseCoordinateInput('90.00001, 0')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('Latitude out of range (-90 to 90)')
  })

  it('rejects longitude beyond -180', () => {
    const res = parseCoordinateInput('0, -180.5')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('Longitude out of range (-180 to 180)')
  })

  it('rejects minutes >= 60 with a specific error', () => {
    const res = parseCoordinateInput('42 60 00N 82 00 00W')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('Minutes must be < 60')
  })

  it('rejects seconds >= 60 with a specific error', () => {
    const res = parseCoordinateInput('42 30 60N 82 00 00W')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('Seconds must be < 60')
  })
})

describe('garbage input — always { ok: false }, never throws', () => {
  const junk: Array<{ name: string; input: string }> = [
    { name: 'empty string', input: '' },
    { name: 'whitespace only', input: '   \t  ' },
    { name: 'word', input: 'hello' },
    { name: 'single number', input: '42' },
    { name: 'three numbers', input: '1 2 3' },
    { name: 'three comma numbers', input: '1, 2, 3' },
    { name: 'NaN text', input: 'NaN, NaN' },
    { name: 'Infinity text', input: 'Infinity, Infinity' },
    { name: 'emoji', input: '🚀🛫' },
    { name: 'huge string', input: '1'.repeat(10000) },
    { name: 'SQL-ish', input: "'; DROP TABLE users;--" },
    { name: 'HTML-ish', input: '<script>alert(1)</script>' },
  ]
  for (const j of junk) {
    it(`rejects ${j.name} cleanly`, () => {
      let res: CoordinateParseResult | undefined
      expect(() => { res = parseCoordinateInput(j.input) }).not.toThrow()
      expect(res?.ok).toBe(false)
    })
  }
})

describe('format classification order', () => {
  it('classifies an MGRS-looking string as mgrs, never dms', () => {
    const res = expectOk(parseCoordinateInput('17TLH5066718582'))
    expect(res.format).toBe('mgrs')
    expect(res.format).not.toBe('dms')
  })

  it('classifies a packed NOTAM string as dms', () => {
    expect(expectOk(parseCoordinateInput('423618N0824913W')).format).toBe('dms')
  })

  it('classifies each notation with its own discriminant', () => {
    expect(expectOk(parseCoordinateInput('42.60522, -82.82047')).format).toBe('dd')
    expect(expectOk(parseCoordinateInput('42 36.313N 082 49.228W')).format).toBe('ddm')
    expect(expectOk(parseCoordinateInput('42 36 19N 82 49 14W')).format).toBe('dms')
    expect(expectOk(parseCoordinateInput('17TLH5066718582')).format).toBe('mgrs')
  })
})
