// ICAO Annex 14 Vol I (7th Ed., July 2016) — obstacle-limitation-surface
// dimension tables for the obstruction engine's ICAO arm.
//
// BINDING VALUE SOURCE: docs/references/icao-annex14-verified.md — the
// owner-supplied, dual-extraction-verified transcription of Tables 4-1 (approach
// runways, p. 4-8), 4-2 (take-off runways, p. 4-11) and 1-1 (code number). Every
// number below is read from that file's table rows, with a provenance comment on
// each cell citing the Table + column. Nothing here is inferred from prose or memory.
//
// Dimensions are stored in METRES AS PUBLISHED so this table stays diff-able
// against Table 4-1. Conversion to feet happens ONLY at the geometry/evaluation
// boundary via the exported `M_TO_FT` constant — never pre-converted here.

/** Metres → feet. The single conversion factor for the ICAO arm; matches the
 *  private constant in geometry.ts. Conversion happens at the geometry/evaluation
 *  boundary only, so this criteria table stays in published metres. */
export const M_TO_FT = 3.28084

/** Table 4-1 approach classification (columns of Table 4-1). */
export type IcaoApproachClassification =
  | 'non_instrument'
  | 'non_precision'
  | 'precision_cat_i'
  | 'precision_cat_ii_iii'

/** Table 1-1 aerodrome reference code number (1–4). */
export type IcaoCodeNumber = 1 | 2 | 3 | 4

/**
 * One resolved Annex 14 surface-criteria column (all metres). An approach
 * `sections` entry with `slopePct: 0` is the horizontal section (Table 4-1
 * "Horizontal section"). `totalLengthM` is null where Table 4-1 prints no total
 * (non-instrument and NP code 1,2 are single-section). `conical.heightM` is the
 * height ABOVE the inner horizontal surface (§4.1.2) — the conical top is
 * 45 m + heightM, so consumers must add the 45 m inner-horizontal datum exactly
 * once (never double-count it).
 */
export interface Annex14SurfaceCriteria {
  conical: { slopePct: number; heightM: number }
  innerHorizontal: { heightM: number; radiusM: number }
  approach: {
    innerEdgeM: number
    distFromThresholdM: number
    divergencePct: number
    /** Piecewise sections from the inner edge outward; horizontal section = slopePct 0. */
    sections: { lengthM: number; slopePct: number }[]
    /** Total approach length (m), or null where Table 4-1 prints no total. */
    totalLengthM: number | null
  }
  transitional: { slopePct: number }
  takeoffClimb: {
    innerEdgeM: number
    distFromEndM: number
    divergencePct: number
    finalWidthM: number
    lengthM: number
    slopePct: number
  }
}

/** NULL-variant fallback, mirroring Part 77's `non_utility_non_precision_low`
 *  default. Per spec: a runway with no configured ICAO classification/code is
 *  dimensioned as non-precision code 4. */
export const ANNEX14_DEFAULT_VARIANT = {
  classification: 'non_precision',
  codeNumber: 4,
} as const satisfies { classification: IcaoApproachClassification; codeNumber: IcaoCodeNumber }

// ---------------------------------------------------------------------------
// Table 4-2 — RUNWAYS MEANT FOR TAKE-OFF (p. 4-11), keyed by code number.
// Code 3 and 4 share one column. Final width 1 200 m encoded; the 1 800 m
// heading-change variant (footnote c) is a documented deferral, NOT encoded.
// Distance-from-runway-end is the runway-end value (clearways not modeled —
// footnote b deferred).
// ---------------------------------------------------------------------------

const TAKEOFF_CLIMB_BY_CODE: Record<IcaoCodeNumber, Annex14SurfaceCriteria['takeoffClimb']> = {
  1: { innerEdgeM: 60,  distFromEndM: 30, divergencePct: 10,   finalWidthM: 380,  lengthM: 1600,  slopePct: 5 }, // Table 4-2 col Code 1
  2: { innerEdgeM: 80,  distFromEndM: 60, divergencePct: 10,   finalWidthM: 580,  lengthM: 2500,  slopePct: 4 }, // Table 4-2 col Code 2
  3: { innerEdgeM: 180, distFromEndM: 60, divergencePct: 12.5, finalWidthM: 1200, lengthM: 15000, slopePct: 2 }, // Table 4-2 col Code 3 or 4
  4: { innerEdgeM: 180, distFromEndM: 60, divergencePct: 12.5, finalWidthM: 1200, lengthM: 15000, slopePct: 2 }, // Table 4-2 col Code 3 or 4
}

// ---------------------------------------------------------------------------
// Table 4-1 — APPROACH RUNWAYS (p. 4-8). One builder per column. Each returns
// everything EXCEPT take-off climb (that comes from Table 4-2 by code number).
// ---------------------------------------------------------------------------

type Annex14ApproachColumn = Omit<Annex14SurfaceCriteria, 'takeoffClimb'>

// ── Non-instrument (single-section approach, no printed total) ──────────────
// Table 4-1 cols NI-1 / NI-2 / NI-3 / NI-4.
const NI_1: Annex14ApproachColumn = {
  conical:         { slopePct: 5,  heightM: 35 },   // Table 4-1 NI-1: conical 5% / 35 m
  innerHorizontal: { heightM: 45,  radiusM: 2000 }, // Table 4-1 NI-1: inner horiz 45 m / 2 000 m
  approach: {
    innerEdgeM: 60,           // Table 4-1 NI-1: approach length of inner edge 60 m
    distFromThresholdM: 30,   // Table 4-1 NI-1: approach distance from threshold 30 m
    divergencePct: 10,        // Table 4-1 NI-1: approach divergence 10%
    sections: [{ lengthM: 1600, slopePct: 5 }], // Table 4-1 NI-1: first section 1 600 m @ 5%
    totalLengthM: null,       // Table 4-1 NI-1: no total printed (single section)
  },
  transitional: { slopePct: 20 }, // Table 4-1 NI-1: transitional 20%
}
const NI_2: Annex14ApproachColumn = {
  conical:         { slopePct: 5,  heightM: 55 },   // Table 4-1 NI-2: conical 5% / 55 m
  innerHorizontal: { heightM: 45,  radiusM: 2500 }, // Table 4-1 NI-2: inner horiz 45 m / 2 500 m
  approach: {
    innerEdgeM: 80,           // Table 4-1 NI-2: inner edge 80 m
    distFromThresholdM: 60,   // Table 4-1 NI-2: distance from threshold 60 m
    divergencePct: 10,        // Table 4-1 NI-2: divergence 10%
    sections: [{ lengthM: 2500, slopePct: 4 }], // Table 4-1 NI-2: first section 2 500 m @ 4%
    totalLengthM: null,       // Table 4-1 NI-2: no total printed
  },
  transitional: { slopePct: 20 }, // Table 4-1 NI-2: transitional 20%
}
const NI_3: Annex14ApproachColumn = {
  conical:         { slopePct: 5,  heightM: 75 },   // Table 4-1 NI-3: conical 5% / 75 m
  innerHorizontal: { heightM: 45,  radiusM: 4000 }, // Table 4-1 NI-3: inner horiz 45 m / 4 000 m
  approach: {
    innerEdgeM: 150,          // Table 4-1 NI-3: inner edge 150 m
    distFromThresholdM: 60,   // Table 4-1 NI-3: distance from threshold 60 m
    divergencePct: 10,        // Table 4-1 NI-3: divergence 10%
    sections: [{ lengthM: 3000, slopePct: 3.33 }], // Table 4-1 NI-3: first section 3 000 m @ 3.33%
    totalLengthM: null,       // Table 4-1 NI-3: no total printed
  },
  transitional: { slopePct: 14.3 }, // Table 4-1 NI-3: transitional 14.3%
}
const NI_4: Annex14ApproachColumn = {
  conical:         { slopePct: 5,  heightM: 100 },  // Table 4-1 NI-4: conical 5% / 100 m
  innerHorizontal: { heightM: 45,  radiusM: 4000 }, // Table 4-1 NI-4: inner horiz 45 m / 4 000 m
  approach: {
    innerEdgeM: 150,          // Table 4-1 NI-4: inner edge 150 m
    distFromThresholdM: 60,   // Table 4-1 NI-4: distance from threshold 60 m
    divergencePct: 10,        // Table 4-1 NI-4: divergence 10%
    sections: [{ lengthM: 3000, slopePct: 2.5 }], // Table 4-1 NI-4: first section 3 000 m @ 2.5%
    totalLengthM: null,       // Table 4-1 NI-4: no total printed
  },
  transitional: { slopePct: 14.3 }, // Table 4-1 NI-4: transitional 14.3%
}

// ── Non-precision approach ──────────────────────────────────────────────────
// Table 4-1 cols NP-1,2 / NP-3 / NP-4. NP-1,2 is single-section (no second/
// horizontal section, no printed total).
const NP_1_2: Annex14ApproachColumn = {
  conical:         { slopePct: 5,  heightM: 60 },   // Table 4-1 NP-1,2: conical 5% / 60 m
  innerHorizontal: { heightM: 45,  radiusM: 3500 }, // Table 4-1 NP-1,2: inner horiz 45 m / 3 500 m
  approach: {
    innerEdgeM: 150,          // Table 4-1 NP-1,2: inner edge 150 m
    distFromThresholdM: 60,   // Table 4-1 NP-1,2: distance from threshold 60 m
    divergencePct: 15,        // Table 4-1 NP-1,2: divergence 15%
    sections: [{ lengthM: 2500, slopePct: 3.33 }], // Table 4-1 NP-1,2: first section 2 500 m @ 3.33%
    totalLengthM: null,       // Table 4-1 NP-1,2: no second/horizontal section, no printed total
  },
  transitional: { slopePct: 20 }, // Table 4-1 NP-1,2: transitional 20%
}
const NP_3: Annex14ApproachColumn = {
  conical:         { slopePct: 5,  heightM: 75 },   // Table 4-1 NP-3: conical 5% / 75 m
  innerHorizontal: { heightM: 45,  radiusM: 4000 }, // Table 4-1 NP-3: inner horiz 45 m / 4 000 m
  approach: {
    innerEdgeM: 300,          // Table 4-1 NP-3: inner edge 300 m
    distFromThresholdM: 60,   // Table 4-1 NP-3: distance from threshold 60 m
    divergencePct: 15,        // Table 4-1 NP-3: divergence 15%
    sections: [
      { lengthM: 3000, slopePct: 2 },   // Table 4-1 NP-3: first section 3 000 m @ 2%
      { lengthM: 3600, slopePct: 2.5 }, // Table 4-1 NP-3: second section 3 600 m @ 2.5%
      { lengthM: 8400, slopePct: 0 },   // Table 4-1 NP-3: horizontal section 8 400 m @ 0%
    ],
    totalLengthM: 15000,      // Table 4-1 NP-3: total length 15 000 m
  },
  transitional: { slopePct: 14.3 }, // Table 4-1 NP-3: transitional 14.3%
}
const NP_4: Annex14ApproachColumn = {
  conical:         { slopePct: 5,  heightM: 100 },  // Table 4-1 NP-4: conical 5% / 100 m
  innerHorizontal: { heightM: 45,  radiusM: 4000 }, // Table 4-1 NP-4: inner horiz 45 m / 4 000 m
  approach: {
    innerEdgeM: 300,          // Table 4-1 NP-4: inner edge 300 m
    distFromThresholdM: 60,   // Table 4-1 NP-4: distance from threshold 60 m
    divergencePct: 15,        // Table 4-1 NP-4: divergence 15%
    sections: [
      { lengthM: 3000, slopePct: 2 },   // Table 4-1 NP-4: first section 3 000 m @ 2%
      { lengthM: 3600, slopePct: 2.5 }, // Table 4-1 NP-4: second section 3 600 m @ 2.5%
      { lengthM: 8400, slopePct: 0 },   // Table 4-1 NP-4: horizontal section 8 400 m @ 0%
    ],
    totalLengthM: 15000,      // Table 4-1 NP-4: total length 15 000 m
  },
  transitional: { slopePct: 14.3 }, // Table 4-1 NP-4: transitional 14.3%
}

// ── Precision approach category I ───────────────────────────────────────────
// Table 4-1 cols CATI-1,2 / CATI-3,4. NOTE (verified as-printed): CAT I code 1,2
// has NO horizontal section — first 3 000 m @ 2.5%, second 12 000 m @ 3% (the
// steeper second slope is as printed), total 15 000 m.
const CATI_1_2: Annex14ApproachColumn = {
  conical:         { slopePct: 5,  heightM: 60 },   // Table 4-1 CATI-1,2: conical 5% / 60 m
  innerHorizontal: { heightM: 45,  radiusM: 3500 }, // Table 4-1 CATI-1,2: inner horiz 45 m / 3 500 m
  approach: {
    innerEdgeM: 150,          // Table 4-1 CATI-1,2: inner edge 150 m
    distFromThresholdM: 60,   // Table 4-1 CATI-1,2: distance from threshold 60 m
    divergencePct: 15,        // Table 4-1 CATI-1,2: divergence 15%
    sections: [
      { lengthM: 3000,  slopePct: 2.5 }, // Table 4-1 CATI-1,2: first section 3 000 m @ 2.5%
      { lengthM: 12000, slopePct: 3 },   // Table 4-1 CATI-1,2: second section 12 000 m @ 3% (no horizontal section)
    ],
    totalLengthM: 15000,      // Table 4-1 CATI-1,2: total length 15 000 m
  },
  transitional: { slopePct: 14.3 }, // Table 4-1 CATI-1,2: transitional 14.3%
}
const CATI_3_4: Annex14ApproachColumn = {
  conical:         { slopePct: 5,  heightM: 100 },  // Table 4-1 CATI-3,4: conical 5% / 100 m
  innerHorizontal: { heightM: 45,  radiusM: 4000 }, // Table 4-1 CATI-3,4: inner horiz 45 m / 4 000 m
  approach: {
    innerEdgeM: 300,          // Table 4-1 CATI-3,4: inner edge 300 m
    distFromThresholdM: 60,   // Table 4-1 CATI-3,4: distance from threshold 60 m
    divergencePct: 15,        // Table 4-1 CATI-3,4: divergence 15%
    sections: [
      { lengthM: 3000, slopePct: 2 },   // Table 4-1 CATI-3,4: first section 3 000 m @ 2%
      { lengthM: 3600, slopePct: 2.5 }, // Table 4-1 CATI-3,4: second section 3 600 m @ 2.5%
      { lengthM: 8400, slopePct: 0 },   // Table 4-1 CATI-3,4: horizontal section 8 400 m @ 0%
    ],
    totalLengthM: 15000,      // Table 4-1 CATI-3,4: total length 15 000 m
  },
  transitional: { slopePct: 14.3 }, // Table 4-1 CATI-3,4: transitional 14.3%
}

// ── Precision approach category II or III (code 3,4 ONLY) ────────────────────
// Table 4-1 col CATII/III-3,4. CAT II/III with code 1 or 2 is not a column and
// is rejected by getAnnex14Criteria.
const CATII_III_3_4: Annex14ApproachColumn = {
  conical:         { slopePct: 5,  heightM: 100 },  // Table 4-1 CATII/III-3,4: conical 5% / 100 m
  innerHorizontal: { heightM: 45,  radiusM: 4000 }, // Table 4-1 CATII/III-3,4: inner horiz 45 m / 4 000 m
  approach: {
    innerEdgeM: 300,          // Table 4-1 CATII/III-3,4: inner edge 300 m
    distFromThresholdM: 60,   // Table 4-1 CATII/III-3,4: distance from threshold 60 m
    divergencePct: 15,        // Table 4-1 CATII/III-3,4: divergence 15%
    sections: [
      { lengthM: 3000, slopePct: 2 },   // Table 4-1 CATII/III-3,4: first section 3 000 m @ 2%
      { lengthM: 3600, slopePct: 2.5 }, // Table 4-1 CATII/III-3,4: second section 3 600 m @ 2.5%
      { lengthM: 8400, slopePct: 0 },   // Table 4-1 CATII/III-3,4: horizontal section 8 400 m @ 0%
    ],
    totalLengthM: 15000,      // Table 4-1 CATII/III-3,4: total length 15 000 m
  },
  transitional: { slopePct: 14.3 }, // Table 4-1 CATII/III-3,4: transitional 14.3%
}

/**
 * Resolve the Table 4-1 column for a (classification, code number) pair and
 * attach the Table 4-2 take-off climb by code number. Throws with a clear
 * message for combinations Table 4-1 does not print — CAT II/III exists only
 * for code 3,4, so CAT II/III with code 1 or 2 is rejected.
 */
export function getAnnex14Criteria(
  classification: IcaoApproachClassification,
  codeNumber: IcaoCodeNumber,
): Annex14SurfaceCriteria {
  const takeoffClimb = TAKEOFF_CLIMB_BY_CODE[codeNumber]
  let column: Annex14ApproachColumn

  switch (classification) {
    case 'non_instrument':
      // Table 4-1 non-instrument: per-code column 1/2/3/4.
      column = codeNumber === 1 ? NI_1 : codeNumber === 2 ? NI_2 : codeNumber === 3 ? NI_3 : NI_4
      break
    case 'non_precision':
      // Table 4-1 non-precision: code 1 and 2 share the NP-1,2 column; 3; 4.
      column = codeNumber === 1 || codeNumber === 2 ? NP_1_2 : codeNumber === 3 ? NP_3 : NP_4
      break
    case 'precision_cat_i':
      // Table 4-1 precision CAT I: code 1,2 share a column; code 3,4 share a column.
      column = codeNumber === 1 || codeNumber === 2 ? CATI_1_2 : CATI_3_4
      break
    case 'precision_cat_ii_iii':
      // Table 4-1 precision CAT II/III: code 3,4 ONLY. Code 1/2 is not a column.
      if (codeNumber === 1 || codeNumber === 2) {
        throw new Error(
          `ICAO Annex 14 has no precision CAT II/III column for code number ${codeNumber} — ` +
            'CAT II/III applies only to code 3 or 4 (Table 4-1).',
        )
      }
      column = CATII_III_3_4
      break
  }

  return { ...column, takeoffClimb }
}
