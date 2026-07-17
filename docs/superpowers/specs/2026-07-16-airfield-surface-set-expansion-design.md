# Obstruction Tool — Multi-Standard Surface Sets (AF Class A/B, Army Class B, ICAO Annex 14, FAA Part 77)

**Date:** 2026-07-16
**Status:** Draft for implementation
**Scope:** Surface-standard selection in Base Configuration → Runways, the obstruction
evaluation engine's criteria tables and dispatch, map polygon builders, and set-aware
labels/exports. Builds on `2026-07-16-obstruction-part77-surfaces-design.md` (the
"Part 77 spec"), which must land first.

## 1. Summary

Today the obstruction tool fully supports exactly one military standard — Air Force
Class B under UFC 3-260-01 — plus the FAA Part 77 surface work that the Part 77 spec is
adding to the map. The owner wants the airfield's governing surface standard selectable
in Base Configuration → Runways, from five options: **Air Force Class A**, **Air Force
Class B** (existing), **Army Class B**, **ICAO Annex 14** (Vol I, 7th Ed.), and **FAA**
(Part 77 §77.19 surfaces; Part 139 is certification context and defines no surface
geometry of its own — see Regulatory basis).

These five options are not five parallel enums. The codebase already has two axes:
a base-level *surface set* (`bases.obstruction_surface_set`: `'ufc_3_260_01' |
'faa_part77'`) and a per-runway *variant* (`base_runways.runway_class` for UFC,
`base_runways.faa_approach_type` for Part 77). This spec keeps that shape and
generalizes it into an N-set **registry**: the five owner options become
(set, variant) pairs — three UFC variants (`A`, `B`, `Army_B`), plus two more sets
(`faa_part77`, new `icao_annex14` with its own per-runway variant columns). Adding a
future standard becomes: one criteria module + one geometry-builder module + one
registry entry + one CHECK-constraint migration.

Concretely this feature delivers: a verified AF Class A criteria entry (the engine
today silently falls back to Class B for unknown classes); corrected Army Class B
dimensions (the current table is a byte-identical copy of AF Class B, contradicting
the verified UFC Table 3-7 Army rows); a new ICAO Annex 14 criteria + geometry +
evaluator module; a "Surface Evaluation Standard" selector in the Runways step (today
the base column is write-once at base creation); a 5-option per-evaluation what-if
picker; and set-aware legends, detail labels, PDF rows, and exports across all sets.

Users: AM Ops and NAMO running evaluations; base admins configuring runways; Army
airfield managers; ICAO-jurisdiction (non-US) airfield managers; civilian Part 139
airport managers.

## 2. Regulatory basis

Everything cited with a paragraph/table number below was verified from a read document
(the owner's uploaded eCFR PDFs, the UFC 3-260-01 2019 C3 Drive copy through Chapter 5,
and the ICAO Annex 14 Vol I 7th Ed. PDF). Items the research could **not** verify are
in §13 as blocking questions with PLACEHOLDER markers — never encode them as real.

**UFC 3-260-01 (4 Feb 2019, Change 3) — AF/Army Class A/B.**
- Class A/B is a DoD-wide runway classification by aircraft type (para 3-3, Table 3-1),
  not service-specific; Army-vs-AF differences are separate rows within the same tables.
- **Primary surface** (Table 3-7 items 1–3): width 2,000 ft AF/Navy Class B; 1,000 ft
  Army Class B; 1,000 ft Class A (both services, VFR and IFR). Length = runway + 200 ft
  each end; point elevation = nearest runway-centerline point.
- **Approach-departure clearance surface (ADCS)** (Table 3-7 items 5–11): starts 200 ft
  from threshold; width at start = primary width. Class B (both services): 50:1,
  total length 50,000 ft. Class A IFR: 40:1, sloped portion 20,000 ft, width at start
  of horizontal portion 7,000 ft, end 16,000 ft, horizontal portion at 500 ft above
  established airfield elevation. Class A VFR: 40:1 × 10,000 ft, no horizontal portion.
- **Inner horizontal surface** (Table 3-7 items 12–14): 7,500-ft radius arcs about the
  centerline at each runway end, interconnected by tangents; 150 ft above established
  airfield elevation; N/A for Class A VFR.
- **Transitional surface** (Table 3-7 item 15): 7:1, all classes and services.
- **Clear zone** (Table 3-5): 3,000 ft long; width Army 1,000 ft / AF 3,000 ft.
- **APZ I / APZ II** (Table 3-6): Class B 5,000 / 7,000 ft long; Class A 2,500 /
  2,500 ft long; width Army 1,000 ft / AF 3,000 ft.
- **Conical and outer horizontal surfaces are NOT verified** for the 2019 C3 text —
  they live in the Appendix C glossary, which the research could not retrieve
  (§13 items 1–2). The dimensions commonly quoted (conical 20:1 × 7,000 ft;
  outer horizontal at 500 ft for 30,000 ft) are treated as unverified.
- Joint rule: Army airfields supporting AF cargo missions use Army Class B clearances
  (para 2-5.4.2).

**14 CFR Part 77 (eCFR PDF current as of 2026-07-14).** §77.19 lettering is
**(a) Horizontal, (b) Conical, (c) Primary, (d) Approach, (e) Transitional** — this
resolves the Part 77 spec's open question 1 (edited there). Dimensions are already
encoded in `PART77_DIMENSIONS`; this spec adds no Part 77 numbers.

**14 CFR Part 139 (eCFR PDF current as of 2026-07-14).** Part 139 defines **no**
imaginary-surface or obstruction geometry — a whole-document search finds zero
references to Part 77 or "imaginary surface". §139.331 / §139.311(c)(5) require
removing/marking/lighting objects "determined by the FAA to be an obstruction"
(determination external to Part 139); §139.309 safety areas are grandfathered/
AC-deferred. Therefore the owner's "FAA" option = Part 77 surfaces, with Part 139 as
certification context only. No Part 139 geometry work exists in this feature.

**ICAO Annex 14 Vol I, 7th Ed. (July 2016).** Chapter 4 defines eight obstacle
limitation surfaces (§4.1.1–4.1.29): conical, inner horizontal, approach, inner
approach, transitional, inner transitional, balked landing, take-off climb. Dimensions
(all metres) come from Table 4-1 (p. 4-8), keyed by approach classification ×
aerodrome reference code number, and Table 4-2 (p. 4-11) for take-off climb keyed by
code number. Applicability: conical + inner horizontal + approach + transitional are
Standards for all approach runways (§4.2.1, §4.2.7, §4.2.13); inner approach, inner
transitional, and balked landing are Recommendations for CAT I and Standards for
CAT II/III (§4.2.14–4.2.15); take-off climb is required for take-off runways
(§4.2.22). The approach surface goes horizontal where its 2.5% slope reaches 150 m
above threshold or the OCA/H-governing object, whichever is higher (§4.2.9, §4.2.17).
Code number derives from aeroplane reference field length (Table 1-1: 1 <800 m,
2 800–<1200 m, 3 1200–<1800 m, 4 ≥1800 m; highest among intended aeroplanes, §1.6.3).
An outer horizontal surface is **not** dimensioned in Annex 14 (guidance-only note
pointing to Doc 9137 Part 6) — it is not built.

## 3. Current state

**Two axes, partially wired.** `bases.obstruction_surface_set` (`'ufc_3_260_01' |
'faa_part77'`, CHECK in migration `2026052504`) picks the family;
`base_runways.runway_class` (nullable, CHECK `NULL|'A'|'B'|'Army_B'` since
`2026061101`) picks the UFC dimension column; `base_runways.faa_approach_type`
(6-value, per-runway, `2026060800`) picks the Part 77 column. Evaluations pin
`surface_set` (nullable 2-value CHECK, `2026061200`, NULL → base default at render)
and `runway_class` (NOT NULL, TS type `'B' | 'Army_B'`, `lib/supabase/obstructions.ts:62`).

**Class A exists only in the DB constraint.** `SURFACE_CRITERIA` has only `B` and
`Army_B` entries — byte-identical (`lib/calculations/surface-criteria.ts:19-52`), with
a comment claiming Army dimensions are identical, which the verified Table 3-7 Army
rows contradict (primary 1,000 vs 2,000 ft). `getSurfaceCriteria` console-warns and
falls back to Class B for unknown classes (:54-61). The obstructions page collapses
any stored class ≠ `'Army_B'` — including a stored `'A'` — to `'B'`
(`app/(app)/obstructions/page.tsx:90-92`). The base-config dropdowns offer only
B/Army_B (`app/(app)/base-config/setup/page.tsx:560-562, 1319-1322`).

**ICAO Annex 14 exists nowhere** — no criteria, no evaluator, no builders, no
per-runway classification columns.

**No UI selects the standard.** `bases.obstruction_surface_set` is written exactly
once, at base creation (`app/api/installations/route.ts:119-121`). The Runways step
has no surface-set control; only the 2-option per-evaluation what-if picker exists
(page.tsx:729-730).

**Hardcoded two-set branch points** that must become registry lookups: the `SurfaceSet`
unions (`lib/airport-mode.ts:23`, `lib/calculations/obstructions.ts:471`,
`lib/supabase/obstructions.ts:65/149`, `lib/supabase/types.ts:3311+`); `getSurfaceSet`'s
explicit string equalities (`airport-mode.ts:273-279`); `getSurfaces`' ternary
(obstructions.ts:473-476); `evaluateObstructionAllRunways`' dispatch (:1380-1383);
the detail page's binary `isPart77` legend (`[id]/page.tsx:745`); the picker's two
literals.

**Duplicated UFC numbers.** Beyond `SURFACE_CRITERIA`, Class B numbers are hardcoded
in `IMAGINARY_SURFACES` (obstructions.ts:33-114 — the display copy the map/legend
reads) and baked into `lib/calculations/geometry.ts` function bodies (:322, :410-412,
:489-511, :349-350, :562-597). A Class A variant renders wrong unless builders become
criteria-driven, exactly the bug the Part 77 spec fixed for civilian bases.

**Labels print `runway_class` unconditionally**: obstruction PDF
(`lib/obstruction-pdf.ts:94,106` — the Part 77 spec adds a set-aware Surface Set row),
detail page (`[id]/page.tsx:383`), history export (`history/page.tsx:20`,
`lib/export/export-table-specs.ts:117,131`).

**Back-compat surface is small.** `obstruction_evaluations.results` is a JSONB array
whose rows carry `surfaceName`/`ufcReference` as data — new sets' names flow through
detail cards and the PDF surface table automatically. `controlling_surface` /
`violated_surfaces` store display strings. Only the enum CHECKs and the NOT NULL
`runway_class` constrain new values.

## 4. Design

### The registry model: standard = set + variant

The five owner options map onto (surface set, per-runway variant):

| Option (UI label) | `obstruction_surface_set` | Per-runway variant | Criteria source |
|---|---|---|---|
| Air Force Class A | `ufc_3_260_01` | `runway_class = 'A'` | UFC Table 3-7 Class A column (new) |
| Air Force Class B | `ufc_3_260_01` | `runway_class = 'B'` | UFC Table 3-7 Class B (existing) |
| Army Class B | `ufc_3_260_01` | `runway_class = 'Army_B'` | UFC Table 3-7 Army rows (corrected) |
| ICAO Annex 14 | `icao_annex14` (new) | `icao_approach_classification` + `icao_code_number` (new columns) | Annex 14 Tables 4-1/4-2 (new) |
| FAA (Part 77) | `faa_part77` | `faa_approach_type` (existing) | `PART77_DIMENSIONS` (existing) |

**Why not a flat 5-value enum on `obstruction_surface_set`?** (a) It would force a
data migration that rewrites every base row and every pinned
`obstruction_evaluations.surface_set = 'ufc_3_260_01'` row, guessing the class from
`runways[0]` — corruption risk for zero benefit, since the pinned pair
(`surface_set`, `runway_class` NOT NULL on every existing row) already fully
determines the standard for saved evaluations. (b) The variant axis doesn't go away:
Part 77 still needs `faa_approach_type` and ICAO needs code number + classification,
so "one flat key" is an illusion. (c) `getSurfaceSet`'s mode-default fallback and all
existing seeds/tests keep working unchanged. The 5-way selector is **presentation**:
it reads and writes the (set, variant) pair.

**One standard per base, one UFC class per evaluation.** The owner placed the selector
at base level ("Base Configuration/Runways"), and `evaluateObstructionAllRunways`
takes a single `runwayClass` across runways (obstructions.ts:1379). Choosing a UFC
option writes the class to **all** runways' `runway_class`; the per-runway dropdown
remains for legacy/mixed data, and if runways disagree the selector shows "Mixed
(per-runway)" and the evaluation uses the first runway's class — with the
`runways[0]` collapse bug fixed so a stored `'A'` or `'Army_B'` is honored instead of
degrading to `'B'`. Per-runway class *mixing in one evaluation* stays out of scope
(§14), same line the Part 77 spec drew.

### Relationship to the Part 77 spec

This spec **builds on, and in three places supersedes the shape of**, the Part 77 spec:

1. **Branch → registry.** Where that spec adds a two-way branch (UFC constants vs
   `PART77_LEGEND_ITEMS`/`PART77_SURFACE_LAYERS`, `buildSurfacePolygons` vs
   `buildPart77SurfacePolygons`, `getSurfaces` ternary, `isPart77` boolean), this spec
   replaces each branch point with a lookup keyed by `SurfaceSet` in a single registry
   (`lib/calculations/surface-standards.ts`). The Part 77 constants/builders it
   created become registry entries verbatim — no rewrite of their internals.
2. **"Engine untouched" is superseded.** That spec scoped itself to map/labels. This
   spec is engine scope: new criteria entries, a new evaluator, and parameterizing the
   UFC geometry builders with `SurfaceCriteria` (behavior-preserving for Class B — the
   baked constants equal today's `CLASS_B` values).
3. **§77.19 lettering** is resolved (its §13 item 1 edited): (a) Horizontal,
   (b) Conical, (c) Primary, (d) Approach, (e) Transitional.

Everything else carries forward unchanged: per-set geometry-builder **modules**
(`annex14-geometry.ts` beside `part77-geometry.ts` and the UFC generators — exactly
the extension slot that spec reserved), the shared `SurfacePolygonFeature`
`{ id, coords, rwyIndex }`, the page's `surfaceSet` state as source of truth for
overlays, `surfaceSet` in the map-init effect deps with visibility reset on change,
per-runway dimensioning with engine-matching NULL fallbacks, and the widened
base-config gate for FAA approach fields.

### ICAO Annex 14 in the existing pipeline (phase 1 honesty)

Phase 1 evaluates and renders **five** Annex 14 surfaces per runway: **approach**
(both ends; piecewise first/second/horizontal sections per Table 4-1), **inner
horizontal** (stadium construction reusing `generateStadiumPolygon` — Annex 14 §4.1.5
permits non-circular perimeters from reference points), **conical**, **transitional**,
and **take-off climb** (both ends, Table 4-2). The three precision inner surfaces —
**inner approach, inner transitional, balked landing** — are **phase 2**: when a
runway's classification is CAT I–III the legend and results panel show an amber note
("Inner approach / inner transitional / balked landing surfaces not yet evaluated —
required for CAT II/III per Annex 14 §4.2.15"). This is stated in the UI, the manual,
and the PDF references block; we do not pretend coverage we don't have. Rationale:
inner transitional requires the runway-strip edge and balked-landing interplay, and
all three matter only within ~900 m of threshold where the (evaluated) transitional
and approach surfaces still provide a bounding result in most geometries — but not
all, hence the visible caveat.

The transitional surface's lower edge runs along the **strip**, not the runway edge.
Strip width is not modeled today; a new nullable `base_runways.icao_strip_width_m`
column captures the published strip width. When NULL, phase 1 builds the transitional
from the runway edge and flags "approximate — strip width not configured" (never a
silent wrong answer). Strip-width defaults per Annex 14 §3.4 were not in the verified
extraction — encoding them is blocked (§13 item 4).

The §4.2.9/§4.2.17 variable horizontal-section rule (OCA/H-governing object) is
simplified to the fixed Table 4-1 section lengths (3,000 / 3,600 / 8,400 = 15,000 m
where applicable) — flagged in §13 item 5. Annex 14 heights are measured against
threshold/aerodrome datums; phase 1 uses threshold elevation for approach/take-off
climb inner edges and established airfield elevation for inner horizontal/conical,
mirroring how the UFC evaluator treats its datums.

Annex 14 dimensions are stored in **metres as published** and converted at the
geometry/evaluation boundary (`const M_TO_FT = 3.28084`) — no pre-converted rounded
feet in the criteria table, so the table stays diff-able against Table 4-1.

### Criteria corrections (verified)

- **New `A` entry** in `SURFACE_CRITERIA` using the verified Class A IFR column:
  primary halfWidth 500 / extension 200; ADCS slope 40, innerHalfWidth 500,
  sloped-portion length 20,000 reaching 500 ft exactly, **then the horizontal
  portion at 500 ft above established airfield elevation, widening 7,000 →
  16,000 ft (Table 3-7 items 9–11), out to 50,000 ft total — owner-CONFIRMED
  via the constant-splay derivation (§13 item 2)**: splay 0.15/side from the
  sloped run, horizontal length 4,500 ÷ 0.15 = 30,000 ft. The ADCS shape gains
  horizontal-portion fields per §13 item 2 (Note 4 elevation-datum caveat).
  Inner_horizontal height 150 / radius 7,500;
  transitional slope 7 / primaryHalfWidth 500; clear_zone halfWidth 1,500 / length
  3,000 (AF width row); apz_i 1,500 × 2,500 offset 3,000; apz_ii 1,500 × 2,500 offset
  5,500 (offset derived: clear zone 3,000 + APZ I 2,500). Conical and
  outer_horizontal are **VERIFIED from the owner-supplied glossary (2026-07-16)**:
  conical = 20:1 rising from the outer edge of the inner horizontal (150 ft) to
  500 ft, horizontal extent 7,000 ft; outer horizontal = 500 ft elevation
  extending 30,000 ft beyond the conical periphery; both class-invariant
  (identical for Class A IFR and Class B), fixed-wing only — encode as real
  values with normal (solid) map rendering, no placeholders. Glossary derivation
  rule (owner-confirmed): no inner horizontal → no conical → no outer
  horizontal. Class A **VFR** (no inner horizontal/conical/outer horizontal;
  10,000-ft ADCS; only primary + sloped ADCS + transitionals) is deferred —
  §13 item 3.
- **`Army_B` corrections**: primary halfWidth 1000 → **500**, ADCS innerHalfWidth
  1000 → **500**, transitional primaryHalfWidth → **500**, clear_zone halfWidth
  1500 → **500**, apz halfWidths 1500 → **500** (all verified Army rows). ADCS
  follows the resolved §13 item 2 geometry with the Army 1,000-ft start width
  (half-widths 500 start → 4,500 at the horizontal portion → 8,000 at end) —
  no placeholder remains. Saved Army evaluations are unaffected (results JSONB
  is pinned); new evaluations change, which is the point.
- `getSurfaceCriteria` stays strict-with-warn but the page-level collapse is removed,
  so the fallback becomes truly exceptional.

## 5. Data model & migrations

Assigned range **2026071660–2026071669** (renumber to the actual implementation date
at implementation time). Three migrations, all additive or constraint-widening — no
data rewrites, no new tables, therefore no new RLS policies.

- **`2026071660_surface_set_icao_annex14.sql`** — widen both CHECKs (Postgres: drop
  constraint, re-add):
  - `bases.obstruction_surface_set` → `IN ('ufc_3_260_01','faa_part77','icao_annex14')`
    (constraint from `2026052504`); default stays `'ufc_3_260_01'`.
  - `obstruction_evaluations.surface_set` → same three values or NULL (constraint from
    `2026061200`).
  - Update both column comments. Existing values remain valid members — zero rows touched.
- **`2026071661_runways_icao_classification.sql`** — `base_runways` gains (per-runway,
  mirroring `faa_approach_type`'s shape from `2026060800`; per-end deferred like its
  FAA analog):
  - `icao_code_number SMALLINT NULL CHECK (icao_code_number IS NULL OR icao_code_number BETWEEN 1 AND 4)`
  - `icao_approach_classification TEXT NULL CHECK (icao_approach_classification IS NULL OR icao_approach_classification IN ('non_instrument','non_precision','precision_cat_i','precision_cat_ii_iii'))`
  - `icao_strip_width_m NUMERIC NULL CHECK (icao_strip_width_m IS NULL OR icao_strip_width_m > 0)`
  - Column comments citing Annex 14 Table 1-1 / Table 4-1 / §3.4. `base_runways`
    already carries `base_id` + matrix RLS; new columns inherit existing policies.
- **`2026071662_obstruction_evaluations_runway_class_nullable.sql`** —
  `ALTER TABLE obstruction_evaluations ALTER COLUMN runway_class DROP NOT NULL;`
  plus (if a CHECK exists on the column — verify at implementation; `schema.sql` is
  stale relative to migrations) widen it to `NULL|'A'|'B'|'Army_B'`. New rule: UFC
  evaluations store the evaluated class (now including `'A'`); Part 77 / ICAO
  evaluations store NULL. Existing rows keep their values.

`base_runways.runway_class` already permits `'A'` (`2026061101`) — no migration needed
there. Rejected alternatives: a new 5-value `bases.obstruction_standard` column (dual
source of truth with set+class); pinning ICAO code/classification per evaluation
(parity with Part 77, which does not pin `faa_approach_type` either — per-runway
inputs are reflected in each result row's `calculationBreakdown`).

## 6. Access control

**No new permission keys, tables, or policies.**

- `/obstructions` remains gated by `obstructions:view` / `obstructions:write` /
  `obstructions:delete`.
- The Runways-step selector writes `bases.obstruction_surface_set` and
  `base_runways.*` through the wizard's existing update paths; RLS on both tables is
  already the permission-matrix shape
  (`user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), '<resource>:write')`).
  No SECURITY DEFINER RPC is needed — these are ordinary column writes by
  wizard-authorized users.
- `app/api/installations/route.ts:119-121` keeps setting the creation-time default
  from `airport_type` (civilian → `faa_part77`, else `ufc_3_260_01`); the wizard now
  makes it editable afterward.

## 7. lib/ modules & API surface

**New: `lib/calculations/surface-standards.ts`** — the registry. Single import point
for everything that used to binary-branch:

```ts
export type SurfaceSet = 'ufc_3_260_01' | 'faa_part77' | 'icao_annex14'
export type UfcRunwayClass = 'A' | 'B' | 'Army_B'
export type IcaoApproachClassification =
  'non_instrument' | 'non_precision' | 'precision_cat_i' | 'precision_cat_ii_iii'

/** The owner's five selectable standards = (set, UFC-variant) pairs. */
export type SurfaceStandardId =
  'af_class_a' | 'af_class_b' | 'army_class_b' | 'icao_annex14' | 'faa_part77'

export const SURFACE_STANDARD_OPTIONS: Record<SurfaceStandardId, {
  set: SurfaceSet
  runwayClass: UfcRunwayClass | null      // non-null only for the three UFC options
  label: string                            // 'Air Force Class A', …
  citation: string                         // 'UFC 3-260-01 Table 3-7', '14 CFR §77.19', 'ICAO Annex 14 Vol I Table 4-1'
}>

export const SURFACE_SET_KEYS: SurfaceSet[]          // for CHECK-mirroring + getSurfaceSet
export const SURFACE_SET_LABELS: Record<SurfaceSet, string>  // PDF/detail/export labels

/** (set, runways' classes) → standard id, or 'mixed' when UFC classes disagree. */
export function resolveStandard(set: SurfaceSet, runwayClasses: (string | null)[]): SurfaceStandardId | 'mixed'

/** Per-set rendering + evaluation hooks — the registry the map/page/detail select by set. */
export const SURFACE_SET_REGISTRY: Record<SurfaceSet, {
  legendItems: (variant?: unknown) => LegendItem[]
  surfaceLayers: SurfaceLayerDef[]
  defaultToggles: string[]
  buildPolygons: (runways: RunwayEvalInput[], runwayClass?: UfcRunwayClass) => SurfacePolygonFeature[]
}>
```

**Changed: `lib/calculations/surface-criteria.ts`** — add `A` entry, correct `Army_B`
(per §4); conical/outer-horizontal values are glossary-verified (§13 item 1
resolved) — no PLACEHOLDER markers remain.

**New: `lib/calculations/annex14-criteria.ts`** — Table 4-1/4-2 in metres:

```ts
export interface Annex14SurfaceCriteria {
  conical: { slopePct: number; heightM: number }
  innerHorizontal: { heightM: number; radiusM: number }
  approach: {
    innerEdgeM: number; distFromThresholdM: number; divergencePct: number
    sections: { lengthM: number; slopePct: number }[]   // horizontal section = slopePct 0
    totalLengthM: number
  }
  transitional: { slopePct: number }
  takeoffClimb: { innerEdgeM: number; distFromEndM: number; divergencePct: number
                  finalWidthM: number; lengthM: number; slopePct: number }
}
export function getAnnex14Criteria(
  classification: IcaoApproachClassification, codeNumber: 1 | 2 | 3 | 4,
): Annex14SurfaceCriteria   // resolves the Table 4-1 column; invalid combos (e.g. CAT II/III code 1-2) throw
export const ANNEX14_DEFAULT_VARIANT = { classification: 'non_precision', codeNumber: 4 } as const  // NULL fallback, mirrors Part 77's
```

**New: `lib/calculations/annex14-geometry.ts`** — builders emitting
`SurfacePolygonFeature`, mirroring `part77-geometry.ts`'s module shape; imports only
exported primitives from `@/lib/calculations/geometry` and criteria from
`@/lib/calculations/annex14-criteria`. Layer ids: `a14-approach-end1/end2`,
`a14-inner-horizontal`, `a14-conical`, `a14-transitional-left/right`,
`a14-takeoff-climb-end1/end2`. `buildAnnex14SurfacePolygons(runways)` dimensions each
runway from its own (classification, code) with the default fallback.

**Changed: `lib/calculations/obstructions.ts`** —
- `SurfaceSet` re-exported from the registry (delete the local duplicate).
- New `evaluateObstructionAnnex14(point, heightAGL, groundMSL, rwy, airfieldElevMSL,
  variant)` mirroring `evaluateObstructionPart77`: emits result rows with keys
  `approach | inner_horizontal | conical | transitional | takeoff_climb`, Annex 14
  names, and citations in the existing `ufcReference` field (field name kept — it is
  a JSONB compatibility contract, noted in a code comment).
- `RunwayEvalInput` gains optional `icaoClassification` / `icaoCodeNumber` (alongside
  `approachType`); `evaluateObstructionAllRunways` dispatches three ways by set.
- `getSurfaces(set, variant)` becomes a registry lookup; `identifySurface`'s
  set-dispatch (added by the Part 77 spec) gains the ICAO arm.
- `IMAGINARY_SURFACES` splits into `UFC_SURFACE_META` (names/colors/refs — display
  only) + numbers pulled from `getSurfaceCriteria(runwayClass)`, removing the second
  hardcoded Class-B copy.

**Changed: `lib/calculations/geometry.ts`** — the five UFC generators with baked
Class-B numbers (`generatePrimarySurfacePolygon`, `generateApproachTrapezoid`,
`generateTransitionalPolygons`, `generateClearZonePolygons`, `generateAPZPolygons`)
gain a `criteria: SurfaceCriteria` parameter (defaulted to `getSurfaceCriteria('B')`
so existing callers/tests are untouched). Behavior-preserving for Class B by
construction.

**Changed: `lib/airport-mode.ts`** — `getSurfaceSet` checks membership in
`SURFACE_SET_KEYS` instead of two string equalities; mode defaults unchanged.

**Changed: `lib/supabase/obstructions.ts`** — input unions:
`surface_set?: SurfaceSet | null`, `runway_class: 'A' | 'B' | 'Army_B' | null`.
`lib/supabase/types.ts` regenerated for the new columns.

**No new route handlers.** The wizard writes through existing Supabase update paths.

## 8. UI components & pages

| File | Change |
|---|---|
| `app/(app)/base-config/setup/page.tsx` — Runways step | **New "Surface Evaluation Standard" card** above the runway list: five radio cards (same visual idiom as the /obstructions picker), current value from `resolveStandard(getSurfaceSet(currentInstallation), runways.map(r => r.runway_class))`; `'mixed'` renders a sixth non-selectable "Mixed (per-runway)" state. Selecting a UFC option writes `bases.obstruction_surface_set = 'ufc_3_260_01'` **and** updates every runway's `runway_class` (confirm dialog stating how many runways change, per the configurable-shifts precedent); selecting ICAO/FAA writes the set only. Every write toasts on error (Sonner). |
| same — `RunwayEditForm` + add form | Runway Class dropdown gains `<option value="A">Class A</option>` (setup/page.tsx:560-562, 1319-1322). FAA approach selectors' gate is the Part 77 spec's widened `civilian \|\| set === 'faa_part77'`. **New ICAO selectors** (shown when set = `icao_annex14`, both military and civilian): Code Number (1–4, Table 1-1 reference-field-length help text), Approach Classification (4 options), Strip Width (m, optional, "approximate transitional if blank"). Read-only runway card row shows the active variant label. |
| `app/(app)/obstructions/page.tsx` | Replace the derived `runwayClass` collapse (:90-92) with `resolveStandard`-based derivation honoring stored `'A'`/`'Army_B'` (mixed → first runway's class). The what-if picker (:728-731) becomes the **5 `SURFACE_STANDARD_OPTIONS` cards**; UFC options override the class passed to the engine, ICAO/FAA options switch the set. Save payload: `surface_set` = set, `runway_class` = UFC class or NULL. Section header, warnings, and `getAllRunways` gain the ICAO variant plumbing (per-runway `icao_*` columns flow like `faa_approach_type` does today, page.tsx:119). ICAO not-configured warning mirrors the Part 77 one, naming the default variant. CAT I–III phase-2 caveat note per §4. |
| `components/obstructions/airfield-map-google.tsx` | The Part 77 spec's per-set constants become `SURFACE_SET_REGISTRY` lookups: legend items, surface layers, toggle keys, default visibility, and the builder call all select by the `surfaceSet` prop (now 3-way); UFC builders receive `getSurfaceCriteria(runwayClass)` via a new optional `runwayClass` prop so Class A/Army B draw at their real dimensions. PLACEHOLDER-flagged surfaces (Class A conical/outer horizontal) render dashed with a legend asterisk. Effect deps/visibility-reset behavior unchanged from the Part 77 spec. |
| `app/(app)/obstructions/[id]/page.tsx` | `SurfaceSetLegend`'s `isPart77` boolean (:745) becomes a registry lookup on the pinned set; the "Class X" label (:383) becomes the resolved standard label (`SURFACE_SET_LABELS` + pinned `runway_class` when UFC; no "Class null" for FAA/ICAO rows). |
| `lib/base-setup-quick-setup.ts` / `lib/base-setup-guide.ts` | Quick-setup default stays `runway_class 'B'`; guide field hints gain Class A + ICAO copy. |

Kebab-case files, PascalCase components, `@/` imports, Sonner toasts, lucide icons
(reuse the existing picker's iconography; no new icons required).

## 9. Exports & PDF

`lib/obstruction-pdf.ts` (returns `{ doc, filename }` — contract unchanged):
- The Part 77 spec's Surface Set row generalizes: `['Surface Standard',
  <resolved label>]` where the label comes from `SURFACE_SET_LABELS` + the pinned
  `runway_class` for UFC rows ("UFC 3-260-01 — Air Force Class A", "ICAO Annex 14
  (Vol I, 7th Ed.)", "FAA Part 77 (14 CFR §77.19)"). The bare `Class ${runway_class}`
  row (:94, :106) renders only for UFC rows.
- The surface-analysis table already renders per-row `surfaceName` / `ufcReference`
  from results JSONB — ICAO rows flow through with Annex 14 names/citations
  automatically. The references block appends the phase-2 caveat line for ICAO CAT
  I–III evaluations.

`lib/export/export-table-specs.ts` (:117, :131) + `history/page.tsx:20`: the
runway-class column becomes a "Standard" column using the same resolved label
(NULL-safe for FAA/ICAO rows). `tests/export-table-specs.test.ts:35`'s `'PA'` fixture
updated alongside. No Excel export exists for this module; none is added.

## 10. Integration

- **enabled_modules / nav / badges**: none — everything lives inside the existing
  `obstructions` module and base-config wizard; no new routes.
- **installation-context**: no change — `fetchInstallationRunways` selects `*`, so the
  new `icao_*` columns arrive automatically (same mechanism `faa_approach_type` used).
- **Seeds**: `seed-demo-civilian.sql:55` (`'faa_part77'`) and the KVOK/KBCV
  `runway_class` seeds remain valid enum members — untouched.
- **Waivers**: `constants.ts:578`'s `'ufc_3_260_01'` waiver `criteria_source` is a
  different enum — explicitly untouched.
- **Taxiways**: `base_taxiways.runway_class` and `lib/calculations/taxiway-criteria.ts`
  (`RunwayClass = 'A' | 'B'`) are a separate clearance system — untouched.
- **Part 77 spec**: prerequisite; its unused migration range 2026071610–2026071619
  stays unused, this feature uses 2026071660–2026071669.

## 11. Implementation sequence

Each step independently committable to `main`; `npx tsc --noEmit` after each.

1. **Registry + UFC criteria** (`surface-standards.ts`; `surface-criteria.ts` Class A
   entry + Army corrections; `airport-mode.ts` membership check; type unions). Verify:
   new criteria tests green; `tests/airport-mode.test.ts` extended for `icao_annex14`.
2. **Migrations 2026071660–662** + regenerate `lib/supabase/types.ts` + widen
   `lib/supabase/obstructions.ts` inputs. Verify: existing rows unaffected (CHECKs
   widen only), insert round-trip with `surface_set = 'icao_annex14'` and NULL
   `runway_class`.
3. **UFC builder parameterization** (`geometry.ts` criteria params, `IMAGINARY_SURFACES`
   split) with defaulted args. Verify: Class B map rendering pixel-identical
   (defaulted criteria = old constants); Class A/Army B render at corrected widths.
4. **Annex 14 criteria + geometry + evaluator** (`annex14-criteria.ts`,
   `annex14-geometry.ts`, `evaluateObstructionAnnex14`, `evaluateObstructionAllRunways`
   third arm, `identifySurface` arm). Verify: new dimension-locking tests (below).
5. **Map + page registry wiring** (5-option picker, collapse fix, save payload,
   registry-driven legend/layers/builders, detail legend + labels). Verify: manual QA
   script.
6. **Base-config Runways step** (standard card, Class A option, ICAO selectors,
   write-all-runways confirm). Verify: flipping standards persists and the
   /obstructions default follows.
7. **PDF/export labels + manual/docs touch** (`docs/manual/` obstructions page), then
   `npm run build`.

## 12. Testing

- **`tests/surface-criteria.test.ts` (new)** — locks every verified Class A and
  corrected Army_B number against UFC Table 3-5/3-6/3-7 values (mirroring
  `tests/part77-surfaces.test.ts`'s dimension-locking style); locks the
  glossary-verified conical (20:1 × 7,000 ft, 150 → 500 ft) and outer horizontal
  (500 ft × 30,000 ft beyond the conical) values with provenance comments;
  locks the modeled ADCS horizontal portion (both classes: slope from threshold
  elevation to EAE + 500 ft — nominal breakpoints 20,000 ft (A) / 25,000 ft
  (B) — then level at EAE + 500 to the 50,000-ft total, per the §13 item 2
  final ruling; include a non-nominal-threshold-elevation case mirroring the
  owner's 25,100-ft worked example);
  `getSurfaceCriteria('A')` no longer falls back.
- **`tests/annex14-criteria.test.ts` (new)** — locks all Table 4-1 columns (conical
  slope/height, inner horizontal 45 m + radii 2 000/2 500/3 500/4 000 m, approach
  inner edges/divergence/sections/15 000 m totals, transitional 20%/14.3%) and
  Table 4-2 (both by classification × code); invalid combos throw; metre storage +
  `M_TO_FT` conversion at one boundary only.
- **`tests/annex14-geometry.test.ts` (new)** — `distanceFt` closeness checks per the
  Part 77 spec's test idiom: approach far edge ≈ 60 m + 15 000 m from threshold
  (code 3/4 instrument), divergence 15% vs 10%, take-off climb final width 1 200 m,
  inner-horizontal stadium radius per code; per-runway variant mixing tags `rwyIndex`;
  NULL variant uses `ANNEX14_DEFAULT_VARIANT`.
- **Extended `tests/obstruction-evaluation.test.ts`** — Class A evaluation returns
  40:1 ADCS heights (not Class B's 50:1); Army_B primary at 500-ft half-width; the
  `runways[0]` collapse regression (stored `'A'` honored); ICAO dispatch returns
  Annex 14 surface names; existing UFC/Part 77 cases pass unchanged.
- **Extended `tests/airport-mode.test.ts`** — `getSurfaceSet` returns `'icao_annex14'`
  when set, mode defaults unchanged.
- **RLS/isolation tests: none needed** — no new tables/policies; new columns inherit
  `base_runways` policies (existing isolation tests cover the table).
- **Manual QA**: (1) USAF base → select Air Force Class A in Runways step → all
  runways flip to A after confirm → /obstructions map shows narrower primary/ADCS,
  dashed conical, evaluation cites 40:1; (2) Army Class B → 1,000-ft primary drawn +
  evaluated; (3) ICAO standard → configure code 4 / precision CAT I → 5 Annex 14
  layers, CAT caveat note, evaluation names Annex 14 surfaces, PDF Surface Standard
  row correct; (4) FAA → unchanged Part 77 behavior; (5) legacy evaluations (all four
  old shapes) render their pinned standard; (6) history export shows the Standard
  column with no "Class null".

## 13. Assumptions & open questions

1. **PARTIALLY RESOLVED 2026-07-16 — owner supplied UFC 3-260-01 Change 3
   (4 Feb 2026) Figure 3-19 (p. 65) + Table 3-7 items 1–15 (pp. 79–82); verified
   transcription at `docs/references/ufc-3-260-01-table3-7-verified.md`.** Now
   verified: primary surface (items 1–3), ADCS start/lengths/slopes/widths/
   horizontal-portion (items 5–11, incl. Class A VFR/IFR split), inner horizontal
   7,500-ft radius / 15,000-ft width / 150-ft elevation (items 12–14, **N/A for
   Class A VFR**), transitional 7:1 (item 15); conical slope 20:1 and outer
   horizontal 500-ft elevation (Figure 3-19 legend). Update (same day): owner
   also supplied the Table 3-7 NOTES (screenshot in docs/references/Screenshots/)
   and Figure 3-17 (p. 63) — the notes directly follow item 15, so **Table 3-7
   carries no conical / outer horizontal dimension rows**; those live only in
   the glossary definitions. **RESOLVED (owner-supplied glossary content,
   2026-07-16):** conical surface "connects the inner horizontal surface with
   the outer horizontal surface … applies to fixed-wing installations only" —
   20:1 rising from the outer edge of the inner horizontal, 7,000 ft horizontal
   extent, up to 500 ft above airfield elevation; outer horizontal surface —
   500 ft elevation extending 30,000 ft beyond the conical periphery. Both are
   class-invariant (why they're not tabulated per class) and derived surfaces:
   no inner horizontal → no conical → no outer horizontal (hence Class A VFR
   carries none of the three). **Sole residual (confirm, non-blocking):** the
   Class A IFR ADCS total length of 50,000 ft is derived (uniform 0.3 ft/ft
   flare reaches the printed 16,000-ft end width at exactly 50,000 ft, matching
   Class B) — confirm against the glossary ADCS definition when convenient.
2. **OWNER DECISION 2026-07-16: correct the encoded Class B criteria to the UFC
   values** (and offer **all five** standards in the per-evaluation what-if
   picker — decision (c) confirmed). Verified corrections (reference doc above):
   inner_horizontal radius 13,120 ft → **7,500 ft** (item 12); ADCS width
   schedule half-widths 1,000 ft (AF start) → 4,500 ft (horizontal-portion
   start) → 8,000 ft (end), replacing the encoded 2,550-ft outer half-width.
   **ADCS geometry — FULLY RESOLVED (owner rulings 2026-07-16; full derivation
   and worked example in docs/references/ufc-3-260-01-table3-7-verified.md):**
   the horizontal portion sits at **EAE + 500 ft** (item 11 as printed, both
   classes); the sloped portion runs (50:1 Class B / 40:1 Class A) **from the
   nearest threshold's elevation** and ends where it reaches EAE + 500 — its
   length varies with the threshold-vs-EAE delta (Note 4; owner example:
   EAE 380, threshold 378 → sloped length 25,100 ft). Nominal breakpoints:
   25,000 ft (B), 20,000 ft (A IFR). **Total ADCS length = 50,000 ft for both
   classes** (Class A confirmed by the owner's constant-splay derivation;
   Class B's item-6 50,000 reads as the full ADCS length under the final
   ruling). Encodable model per end: one 50,000-ft trapezoid flaring uniformly
   (B: 2,000 → 16,000 ft, nominal-25,000 width = printed 9,000 ✓; A: 1,000 →
   16,000 ft, nominal-20,000 width = printed 7,000 ✓); vertical profile =
   slope from threshold elevation to EAE + 500, then level to 50,000 ft.
   Implementation note: the slope's vertical datum is the nearest threshold
   elevation, NOT the EAE — check what the current UFC evaluator uses and
   align while correcting Class B. The ADCS horizontal-portion model gap also applies to
   **Class A IFR** (7,000 → 16,000 ft at 500 ft, items 9–11 — now verified);
   the ADCS shape gains horizontal-portion fields in this build for both
   classes. Army_B's ADCS outer half-width remains PLACEHOLDER pending an
   Army-specific source (Table 3-7's width rows split Army vs AF only at the
   start-width, items 8; Army ADCS horizontal-portion widths are the same
   printed cells — encode Army_B from the same verified rows, with the Army
   1,000-ft start width).
3. Class A **VFR** variant is deferred — the `A` entry encodes the verified IFR
   column. Update 2026-07-16: the VFR column is now itself verified (no inner
   horizontal — items 12–14 N/A; no ADCS horizontal portion — items 9–11 N/A;
   40:1 × 10,000 ft ADCS), **except its ADCS end width**, which items 1–15 do
   not state. If a VFR-only Class A airfield onboards, a per-runway VFR/IFR
   flag is a small follow-on.
4. **ICAO strip width**: Annex 14 §3.4 defaults were not extracted; users enter
   `icao_strip_width_m`, NULL → runway-edge approximation with a visible flag. Verify
   §3.4 before encoding defaults.
5. **Annex 14 approach horizontal-section rule** (§4.2.9/§4.2.17 OCA/H-governing
   object) simplified to fixed Table 4-1 lengths; heights-are-maxima /
   other-dimensions-are-minima semantics (note a) mean our fixed-length surface is the
   conservative envelope in most but not provably all terrains — verify with an ICAO
   SME.
6. **Annex 14 code letter F widths** (Table 4-1 note e, 155 m) affect only the
   phase-2 inner approach / balked landing surfaces; an `icao_code_letter` column is
   deferred to phase 2.
7. Take-off climb is drawn/evaluated off **both** runway ends (each end presumed
   usable for take-off) and from the runway end, not clearway end — clearways are not
   modeled; note b of Table 4-2 deferred.
8. `evaluateObstructionAllRunways` keeps one `runwayClass` per evaluation; per-runway
   UFC class mixing (true joint-use) would move the class into `RunwayEvalInput` —
   deferred until a real base needs it.
9. Migration numbers 2026071660–2026071669: renumber to the implementation date;
   verify at implementation whether `obstruction_evaluations.runway_class` carries a
   CHECK constraint (`schema.sql` is stale; migrations are the truth).
10. The `ufcReference` JSONB field name now carries Part 77 and Annex 14 citations
    too — renaming it would break saved rows; kept with a code comment.

## 14. Out of scope

- **Class B criteria value changes** (§13 item 2 audit outcome) — tracked, not shipped
  here.
- **Annex 14 inner approach, inner transitional, balked landing** (phase 2, with the
  visible CAT I–III caveat), the Doc 9137 outer horizontal, curved/offset approaches
  (§4.1.10), clearway-aware take-off climb, and slope-reduction rules
  (§4.2.23–4.2.26).
- **Per-runway standard mixing in one evaluation** and per-end variant columns (both
  the FAA and ICAO variants stay per-runway).
- **14 CFR §77.21 DOD surfaces** as a separate selectable set (the UFC sets cover the
  military case in this product).
- **Part 139 operational modules** (safety areas, marking/lighting programs) — no
  surface geometry exists to add.
- Taxiway clearance criteria (`lib/calculations/taxiway-criteria.ts`), the waiver
  `criteria_source` enum, PDF map snapshots, and the history marker map.
