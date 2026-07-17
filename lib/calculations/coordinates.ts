// Client-side coordinate parsing + formatting for the Obstruction module's
// manual coordinate-entry feature. Pure module: no React, no I/O, no side
// effects.
//
// Understands four notations and normalizes each into a { lat, lon } point:
//   - DD   decimal degrees                "42.60522, -82.82047"
//   - DDM  degrees-decimal-minutes        "N42°36.31' W082°49.23'"
//   - DMS  degrees-minutes-seconds        `42°36'18.8"N 082°49'13.7"W`
//          (incl. the packed FAA obstacle-NOTAM form DDMMSS{N|S}DDDMMSS{E|W})
//   - MGRS grid reference                 "17TLH5066718582"
// and formats a point back into each for the Selected Location display card.

import { forward, toPoint } from 'mgrs'
import type { LatLon } from '@/lib/calculations/geometry'

export type CoordinateFormat = 'dd' | 'ddm' | 'dms' | 'mgrs'

export type CoordinateParseResult =
  | { ok: true; point: LatLon; format: CoordinateFormat }
  | { ok: false; error: string }

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

/** Decimal degrees, e.g. `"42.60522, -82.82047"`. `digits` defaults to 5
 *  (~1 m at the equator). */
export function formatDD(point: LatLon, digits = 5): string {
  return `${point.lat.toFixed(digits)}, ${point.lon.toFixed(digits)}`
}

/** Degrees-minutes-seconds with hemisphere suffix,
 *  e.g. `42°36'18.8"N 082°49'13.7"W`. Seconds carry one decimal. */
export function formatDMS(point: LatLon): string {
  const part = (dec: number, degPad: number, pos: string, neg: string) => {
    const dir = dec >= 0 ? pos : neg
    const abs = Math.abs(dec)
    const d = Math.floor(abs)
    const minFloat = (abs - d) * 60
    const m = Math.floor(minFloat)
    const s = ((minFloat - m) * 60).toFixed(1)
    return `${String(d).padStart(degPad, '0')}°${String(m).padStart(2, '0')}'${s.padStart(4, '0')}"${dir}`
  }
  return `${part(point.lat, 2, 'N', 'S')} ${part(point.lon, 3, 'E', 'W')}`
}

/**
 * Degrees-decimal-minutes with hemisphere prefix, e.g. `N42°36.31' W082°49.23'`.
 *
 * Canonical DDM formatter going forward. Produces the identical output shape to
 * `formatCoordsDMS(lat, lon)` in `lib/utils.ts` — that function is misnamed
 * (despite "DMS" it emits degrees-decimal-minutes) and is kept only for its
 * existing call sites. Prefer this one for new code.
 */
export function formatDDM(point: LatLon): string {
  const part = (dec: number, pos: string, neg: string) => {
    const dir = dec >= 0 ? pos : neg
    const abs = Math.abs(dec)
    const d = Math.floor(abs)
    const m = ((abs - d) * 60).toFixed(2)
    return `${dir}${String(d).padStart(pos === 'N' ? 2 : 3, '0')}°${m}'`
  }
  return `${part(point.lat, 'N', 'S')} ${part(point.lon, 'E', 'W')}`
}

/** MGRS grid reference. Wraps `mgrs.forward([lon, lat], accuracy)` (lon-first);
 *  returns `''` if mgrs throws (e.g. polar latitudes outside the UTM band). */
export function formatMGRS(point: LatLon, accuracy?: 1 | 2 | 3 | 4 | 5): string {
  try {
    return forward([point.lon, point.lat], accuracy ?? 5)
  } catch {
    return ''
  }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

// MGRS: zone (1-2 digits) + latitude band (C-X, no I/O) + two 100 km grid
// square letters (A-Z, no I/O) + an even run of easting/northing digits.
const MGRS_RE = /^\d{1,2}[C-HJ-NP-X][A-HJ-NP-Z]{2}\d*$/
// Packed FAA obstacle-NOTAM: DDMMSS{N|S}DDDMMSS{E|W}.
const NOTAM_RE = /^(\d{2})(\d{2})(\d{2})([NS])(\d{3})(\d{2})(\d{2})([EW])$/

function inLatRange(lat: number): boolean {
  return lat >= -90 && lat <= 90
}
function inLonRange(lon: number): boolean {
  return lon >= -180 && lon <= 180
}

// One coordinate as scanned from the token stream: its magnitude parts
// ([deg], [deg, min] or [deg, min, sec]), an optional hemisphere letter, and
// an optional explicit sign from a leading +/-.
type CoordGroup = { parts: number[]; hemi: string | null; sign: -1 | 1 | null }

/**
 * Auto-detecting coordinate parser. Trims, uppercases and normalizes unicode
 * degree/minute/second marks, then classifies in order: MGRS grid → packed
 * NOTAM → tokenized DD/DDM/DMS. Never throws — every input, including garbage,
 * returns a discriminated result. Range validation mirrors the elevation route
 * (`app/api/elevation/route.ts`): lat ∈ [-90, 90], lon ∈ [-180, 180].
 */
export function parseCoordinateInput(raw: string): CoordinateParseResult {
  if (typeof raw !== 'string') return { ok: false, error: 'Enter a coordinate' }
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, error: 'Enter a coordinate' }

  const upper = trimmed.toUpperCase()
  const compact = upper.replace(/\s+/g, '')

  // 1. MGRS grid reference — checked first so an MGRS-shaped string can never
  //    fall through to the DMS branch. mgrs.toPoint throws on malformed input;
  //    always surface that as a parse error, never an exception.
  if (MGRS_RE.test(compact)) {
    try {
      const [lon, lat] = toPoint(compact)
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inLatRange(lat) || !inLonRange(lon)) {
        return { ok: false, error: 'Not a valid MGRS grid reference' }
      }
      return { ok: true, point: { lat, lon }, format: 'mgrs' }
    } catch {
      return { ok: false, error: 'Not a valid MGRS grid reference' }
    }
  }

  // 2. Packed FAA obstacle-NOTAM string — the exact inverse of
  //    toNotamCoordString (app/(app)/obstructions/page.tsx).
  const notam = NOTAM_RE.exec(compact)
  if (notam) {
    const latMin = Number(notam[2])
    const latSec = Number(notam[3])
    const lonMin = Number(notam[6])
    const lonSec = Number(notam[7])
    if (latMin >= 60 || lonMin >= 60) return { ok: false, error: 'Minutes must be < 60' }
    if (latSec >= 60 || lonSec >= 60) return { ok: false, error: 'Seconds must be < 60' }
    let lat = Number(notam[1]) + latMin / 60 + latSec / 3600
    let lon = Number(notam[5]) + lonMin / 60 + lonSec / 3600
    if (notam[4] === 'S') lat = -lat
    if (notam[8] === 'W') lon = -lon
    if (!inLatRange(lat)) return { ok: false, error: 'Latitude out of range (-90 to 90)' }
    if (!inLonRange(lon)) return { ok: false, error: 'Longitude out of range (-180 to 180)' }
    return { ok: true, point: { lat, lon }, format: 'dms' }
  }

  // 3 + 4. Tokenized DD / DDM / DMS. Normalize separators to spaces, isolate
  //        hemisphere letters and the lat/lon comma, then scan into two groups.
  const normalized = upper
    .replace(/[°º˚'’"′″:]/g, ' ')
    .replace(/,/g, ' , ')
    .replace(/([NSEW])/g, ' $1 ')
  const tokens = normalized.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return { ok: false, error: 'Enter a coordinate' }

  const groups: CoordGroup[] = []
  let cur: CoordGroup | null = null

  for (const tok of tokens) {
    if (tok === ',') {
      // Explicit lat/lon separator: close the current coordinate.
      cur = null
      continue
    }

    if (tok === 'N' || tok === 'S' || tok === 'E' || tok === 'W') {
      if (cur && cur.parts.length > 0 && cur.hemi === null) {
        // Suffix hemisphere closes the current coordinate.
        cur.hemi = tok
        cur = null
      } else {
        // Prefix hemisphere starts a new coordinate.
        if (cur && cur.parts.length === 0 && cur.hemi !== null) {
          return { ok: false, error: 'Two hemisphere letters with no value between them' }
        }
        cur = { parts: [], hemi: tok, sign: null }
        groups.push(cur)
      }
      continue
    }

    // Numeric token.
    const num = Number(tok)
    if (!Number.isFinite(num)) {
      return { ok: false, error: 'Could not read that as a coordinate' }
    }
    const explicit = tok.startsWith('-') || tok.startsWith('+')
    const sign: -1 | 1 = tok.startsWith('-') ? -1 : 1
    const mag = Math.abs(num)

    if (cur === null) {
      cur = { parts: [mag], hemi: null, sign: explicit ? sign : null }
      groups.push(cur)
    } else if (cur.parts.length > 0 && explicit) {
      // A signed number mid-stream starts the next coordinate (you never write
      // a sign on minutes or seconds).
      cur = { parts: [mag], hemi: null, sign }
      groups.push(cur)
    } else {
      // Continue the current coordinate (its first value may carry a sign that,
      // combined with a prefix hemisphere, the XOR check below will reject).
      if (cur.parts.length === 0 && explicit && cur.sign === null) cur.sign = sign
      cur.parts.push(mag)
    }
  }

  // Sign XOR hemisphere: `-82.8W` is rejected rather than silently double-negated.
  for (const g of groups) {
    if (g.sign !== null && g.hemi !== null) {
      return { ok: false, error: 'Use a minus sign or a hemisphere letter, not both' }
    }
  }

  if (groups.length !== 2) {
    return { ok: false, error: 'Enter both a latitude and a longitude' }
  }

  for (const g of groups) {
    if (g.parts.length === 0) return { ok: false, error: 'Missing a coordinate value' }
    if (g.parts.length > 3) return { ok: false, error: 'Too many numbers in a coordinate' }
    if (g.parts.length >= 2 && g.parts[1] >= 60) return { ok: false, error: 'Minutes must be < 60' }
    if (g.parts.length >= 3 && g.parts[2] >= 60) return { ok: false, error: 'Seconds must be < 60' }
  }

  // Assign the two groups to latitude / longitude. Hemisphere letters bind by
  // meaning (N/S → lat, E/W → lon) in either order; bare signed pairs are read
  // lat-first.
  const [g1, g2] = groups
  const isLat = (h: string | null) => h === 'N' || h === 'S'
  const isLon = (h: string | null) => h === 'E' || h === 'W'
  let latGroup: CoordGroup
  let lonGroup: CoordGroup
  if (g1.hemi && g2.hemi) {
    if (isLat(g1.hemi) && isLon(g2.hemi)) {
      latGroup = g1
      lonGroup = g2
    } else if (isLon(g1.hemi) && isLat(g2.hemi)) {
      latGroup = g2
      lonGroup = g1
    } else {
      return { ok: false, error: 'Expected one N/S and one E/W hemisphere' }
    }
  } else if (!g1.hemi && !g2.hemi) {
    latGroup = g1
    lonGroup = g2
  } else {
    const hemiGroup = g1.hemi ? g1 : g2
    const other = g1.hemi ? g2 : g1
    if (isLat(hemiGroup.hemi)) {
      latGroup = hemiGroup
      lonGroup = other
    } else {
      lonGroup = hemiGroup
      latGroup = other
    }
  }

  const value = (g: CoordGroup): number => {
    const d = g.parts[0]
    const m = g.parts.length >= 2 ? g.parts[1] : 0
    const s = g.parts.length >= 3 ? g.parts[2] : 0
    const mag = d + m / 60 + s / 3600
    const negative = g.hemi === 'S' || g.hemi === 'W' || g.sign === -1
    return negative ? -mag : mag
  }

  const lat = value(latGroup)
  const lon = value(lonGroup)

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, error: 'Could not read that as a coordinate' }
  }
  if (!inLatRange(lat)) return { ok: false, error: 'Latitude out of range (-90 to 90)' }
  if (!inLonRange(lon)) return { ok: false, error: 'Longitude out of range (-180 to 180)' }

  const maxParts = Math.max(latGroup.parts.length, lonGroup.parts.length)
  const format: CoordinateFormat = maxParts >= 3 ? 'dms' : maxParts === 2 ? 'ddm' : 'dd'

  return { ok: true, point: { lat, lon }, format }
}
