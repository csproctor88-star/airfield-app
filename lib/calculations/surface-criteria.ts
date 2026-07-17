// UFC 3-260-01 Surface Criteria by Runway Class
// Source: UFC 3-260-01, 4 Feb 2019, Change 3 (4 Feb 2026), §3-15
// "Airspace Imaginary Surfaces", Table 3-7 (items 1–15), plus the
// class-invariant conical / outer-horizontal glossary definitions and
// Table 3-5 (clear zone) / Table 3-6 (APZ) widths. Values verified in
// docs/references/ufc-3-260-01-table3-7-verified.md (owner rulings 2026-07-16).
//
// The `approach_departure` model encodes the owner's constant-flare
// construction (2026-07-16): one trapezoid per runway end that flares
// uniformly from `innerHalfWidth` to `outerHalfWidth` over the TOTAL ADCS
// `length`, and whose vertical profile rises at `slope`:1 from the nearest
// threshold's elevation until it reaches EAE + `horizontalElevation`, then
// stays level at that elevation out to `length`.

export interface SurfaceCriteria {
  clear_zone: { halfWidth: number; length: number; maxHeight: number }
  graded_area: { halfWidth: number; length: number; maxHeight: number }
  primary: { halfWidth: number; extension: number; maxHeight: number }
  approach_departure: {
    slope: number
    innerHalfWidth: number
    outerHalfWidth: number
    length: number
    // Feet above the Established Airfield Elevation where the ADCS goes level
    // (Table 3-7 item 11). `null` = no horizontal portion (reserved for the
    // deferred Class A VFR variant).
    horizontalElevation: number | null
  }
  inner_horizontal: { height: number; radius: number }
  conical: { slope: number; horizontalExtent: number; baseHeight: number }
  outer_horizontal: { height: number; radius: number }
  transitional: { slope: number; primaryHalfWidth: number }
  apz_i: { halfWidth: number; length: number; startOffset: number }
  apz_ii: { halfWidth: number; length: number; startOffset: number }
}

// UFC 3-260-01, Table 3-7 — Class A (Air Force / Army), IFR column.
// Encodes the IFR row; Class A VFR is deferred (no horizontal portion).
const CLASS_A: SurfaceCriteria = {
  clear_zone:         { halfWidth: 1500, length: 3000, maxHeight: 0 },   // Table 3-5 AF width row
  graded_area:        { halfWidth: 1500, length: 1000, maxHeight: 0 },   // carried from Class B (unverified split)
  primary:            { halfWidth: 500, extension: 200, maxHeight: 0 },  // items 1–2: 1,000 ft width, +200 ft each end
  // items 6–11 Class A IFR: 40:1 (item 7); start 1,000 ft (item 8) → half 500;
  // end 16,000 ft (item 10) → half 8,000; total 50,000 ft (owner-confirmed
  // constant-splay derivation); level-off 500 ft above EAE (item 11).
  approach_departure: { slope: 40, innerHalfWidth: 500, outerHalfWidth: 8000, length: 50000, horizontalElevation: 500 },
  inner_horizontal:   { height: 150, radius: 7500 },                     // items 12–14
  conical:            { slope: 20, horizontalExtent: 7000, baseHeight: 150 },  // glossary, class-invariant
  outer_horizontal:   { height: 500, radius: 44500 },                    // glossary, class-invariant (14,500 + 30,000)
  transitional:       { slope: 7, primaryHalfWidth: 500 },               // item 15
  apz_i:              { halfWidth: 1500, length: 2500, startOffset: 3000 },   // Table 3-6 Class A
  apz_ii:             { halfWidth: 1500, length: 2500, startOffset: 5500 },   // offset = clear zone 3,000 + APZ I 2,500
}

// UFC 3-260-01, Table 3-7 — Class B (Air Force), "Class B (VFR and IFR)" column.
const CLASS_B: SurfaceCriteria = {
  clear_zone:         { halfWidth: 1500, length: 3000, maxHeight: 0 },   // Table 3-5 AF (unverified split — do not touch)
  graded_area:        { halfWidth: 1500, length: 1000, maxHeight: 0 },   // unverified split — do not touch
  primary:            { halfWidth: 1000, extension: 200, maxHeight: 0 }, // item 1: AF/Navy/USMC 2,000 ft → half 1,000
  // items 6–11: 50:1 (item 7); start 2,000 ft (item 8) → half 1,000; end
  // 16,000 ft (item 10) → half 8,000; total 50,000 ft (item 6, C3 marker;
  // width at the nominal 25,000-ft breakpoint = printed 9,000 ✓); level-off
  // 500 ft above EAE (item 11).
  approach_departure: { slope: 50, innerHalfWidth: 1000, outerHalfWidth: 8000, length: 50000, horizontalElevation: 500 },
  inner_horizontal:   { height: 150, radius: 7500 },                     // item 12 (13,120 was the ICAO 4,000 m value)
  conical:            { slope: 20, horizontalExtent: 7000, baseHeight: 150 },  // glossary, class-invariant
  outer_horizontal:   { height: 500, radius: 44500 },                    // glossary: 30,000 ft beyond conical periphery (14,500 + 30,000)
  transitional:       { slope: 7, primaryHalfWidth: 1000 },              // item 15
  apz_i:              { halfWidth: 1500, length: 5000, startOffset: 3000 },   // DoDI 4165.57
  apz_ii:             { halfWidth: 1500, length: 7000, startOffset: 8000 },
}

// UFC 3-260-01, Table 3-7 — Army Class B (Army rows).
// Identical imaginary-surface geometry to Air Force Class B EXCEPT the
// narrower Army primary / ADCS-start / clear-zone / APZ widths transcribed
// from the Army columns of Tables 3-7 / 3-5 / 3-6 (C3, 4 Feb 2026).
const ARMY_CLASS_B: SurfaceCriteria = {
  clear_zone:         { halfWidth: 500, length: 3000, maxHeight: 0 },    // Table 3-5 Army width 1,000 ft → half 500
  // Clamped to the parent Army clear-zone half-width (Table 3-5 Army 1,000-ft
  // width → 500-ft half) so the graded area — a portion OF the clear zone — can
  // never be reported wider than the clear zone that contains it. This is a
  // consistency bound, not an invented value; pending owner verification of the
  // true Army graded-area width.
  graded_area:        { halfWidth: 500, length: 1000, maxHeight: 0 },
  primary:            { halfWidth: 500, extension: 200, maxHeight: 0 },  // item 1: Army 1,000 ft → half 500
  // item 8: ADCS starts at the 1,000-ft Army primary width (half 500);
  // slope/end/length/level-off shared with AF Class B.
  approach_departure: { slope: 50, innerHalfWidth: 500, outerHalfWidth: 8000, length: 50000, horizontalElevation: 500 },
  inner_horizontal:   { height: 150, radius: 7500 },                     // item 12
  conical:            { slope: 20, horizontalExtent: 7000, baseHeight: 150 },  // glossary, class-invariant
  outer_horizontal:   { height: 500, radius: 44500 },                    // glossary, class-invariant
  transitional:       { slope: 7, primaryHalfWidth: 500 },               // item 15, rises from the 500-ft Army primary edge
  apz_i:              { halfWidth: 500, length: 5000, startOffset: 3000 },    // Table 3-6 Army width 1,000 ft → half 500
  apz_ii:             { halfWidth: 500, length: 7000, startOffset: 8000 },
}

export const SURFACE_CRITERIA: Record<string, SurfaceCriteria> = {
  A: CLASS_A,
  B: CLASS_B,
  Army_B: ARMY_CLASS_B,
}

export function getSurfaceCriteria(runwayClass: string): SurfaceCriteria {
  const criteria = SURFACE_CRITERIA[runwayClass]
  if (!criteria) {
    console.warn(`Unknown runway class "${runwayClass}", falling back to Class B`)
    return CLASS_B
  }
  return criteria
}
