// Base-wide distance unit (feet vs metres).
//
// Every dimension in the app is STORED in feet (runway length_ft / width_ft,
// end elevations, obstruction heights + all evaluation results). This module is
// the single boundary that converts + formats those feet values for display and
// parses metric inputs back to feet, so a base outside the US can work in metres
// (bases.distance_unit) without changing any stored data.

export type DistanceUnit = 'ft' | 'm'

/** Feet per metre — the single conversion factor for the unit boundary. */
export const FT_PER_M = 3.28084

/**
 * Resolve a base's configured distance unit, defaulting to feet. Accepts the
 * fully-typed `bases` row via `unknown` + an internal cast, because the
 * generated types don't yet carry `distance_unit` (read through a cast, same
 * idiom as `bases.shift_count`).
 */
export function baseDistanceUnit(base: unknown): DistanceUnit {
  return (base as { distance_unit?: string | null } | null | undefined)?.distance_unit === 'm' ? 'm' : 'ft'
}

/** Convert a feet value into the target unit's numeric value. */
export function ftToUnit(feet: number, unit: DistanceUnit): number {
  return unit === 'm' ? feet / FT_PER_M : feet
}

/** Convert a value entered in `unit` back to feet (storage is always feet). */
export function unitToFt(value: number, unit: DistanceUnit): number {
  return unit === 'm' ? value * FT_PER_M : value
}

/**
 * Format a stored feet value in the given unit — e.g. `fmtDistance(1234, 'ft')`
 * → "1,234 ft", `fmtDistance(1234, 'm')` → "376 m". Null/NaN → the em-dash.
 * `withUnit: false` returns just the number (for input fields).
 */
export function fmtDistance(
  feet: number | null | undefined,
  unit: DistanceUnit,
  opts?: { digits?: number; withUnit?: boolean },
): string {
  if (feet == null || !Number.isFinite(feet)) return '—'
  const v = ftToUnit(feet, unit)
  const digits = opts?.digits ?? (unit === 'm' ? 1 : 0)
  const num = v.toLocaleString('en-US', { maximumFractionDigits: digits })
  return opts?.withUnit === false ? num : `${num} ${unit}`
}
