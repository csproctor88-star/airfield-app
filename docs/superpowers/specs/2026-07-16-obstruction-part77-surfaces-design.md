# Obstruction Tool — FAA Part 77 Surface Polygons

**Date:** 2026-07-16
**Status:** Draft for implementation
**Scope:** Obstruction map polygon rendering + labels + base-config runway gate. NOT the evaluation engine.

## Summary

The obstruction evaluation engine already computes results against either imaginary-surface
set — UFC 3-260-01 for USAF airfields or 14 CFR Part 77 (§77.19) for civilian Part 139
airports — driven by `bases.obstruction_surface_set` and a per-evaluation override. The
**map does not**: regardless of the selected set, it draws the ten UFC surfaces (clear
zone, APZ I/II, inner/outer horizontal, 25,000-ft approach-departure trapezoids, 2,000-ft
primary) with UFC names in the legend. A civilian airport manager evaluating a crane sees
Part 77 numbers in the results panel next to a map showing surfaces that do not exist in
§77.19, at the wrong dimensions.

This feature adds per-runway-end Part 77 polygon builders (primary, approach, transitional,
horizontal, conical — dimensioned by each runway's `faa_approach_type`), a surface-set
branch in the map renderer so overlays and legends follow the active set, set-aware surface
names in the page header / point-info card / PDF, and unblocks USAF bases that flip
`obstruction_surface_set` to `faa_part77` from a base-config gap that hides the FAA
approach-type selectors. Builders for the two sets stay in separate modules so a future
third set (e.g. ICAO Annex 14) slots in beside them.

Users: AM Ops and NAMO running evaluations, base admins configuring runways, civilian
Part 139 airport managers (for whom Part 77 is the default set).

## Regulatory basis

All dimensional claims below were verified from 14 CFR §77.19 (via content extracts of
ecfr.gov / law.cornell.edu / govinfo.gov — see Assumptions for the access caveat):

- **§77.19 (intro)** — surface size is based on the category of each runway according to
  the type of approach available or planned.
- **§77.19(a) — Primary surface**: longitudinally centered on the runway; extends 200 ft
  beyond each end when the runway has a specially prepared hard surface. Widths: 250 ft
  (utility/visual), 500 ft (utility/non-precision; non-utility non-precision with
  visibility minimums > ¾ mi), 1,000 ft (non-utility non-precision with minimums as low
  as ¾ mi; all precision instrument runways). Primary width is the runway-level max over
  both ends' categories.
- **§77.19(b) — Horizontal surface**: a plane 150 ft above established airport elevation;
  perimeter from arcs swung **from the center of each end of the primary surface**,
  joined by tangents. Radius 5,000 ft for utility/visual runways, 10,000 ft for all
  others; both ends of one runway use the higher radius determined for either end.
- **Conical surface**: 20:1 from the horizontal-surface periphery for 4,000 ft horizontal
  extent (outer edge 350 ft above airport elevation — derivation, not quoted text).
- **Approach surface**: centered on the extended centerline from each end of the primary
  surface; inner width = primary width, flaring uniformly. Lengths/slopes: 5,000 ft @ 20:1
  (all utility and visual ends); 10,000 ft @ 34:1 (non-utility non-precision);
  10,000 ft @ 50:1 + 40,000 ft @ 40:1 = 50,000 ft (precision). Outer widths: 1,250 /
  1,500 / 2,000 / 3,500 / 4,000 / 16,000 ft by category.
- **§77.19(e) — Transitional surfaces**: 7:1 at right angles to the centerline from the
  sides of the primary and approach surfaces; for the portion of a precision approach
  beyond the conical limits, they extend 5,000 ft horizontally from the approach edge.

Note: the codebase's `ufcRef` strings label the approach surface **(c)** and conical
**(d)** (`lib/calculations/obstructions.ts:192, 208`), while the regulatory research
verified conical as (c) and approach as (d). See Assumptions — new UI copy in this feature
cites "§77.19" without subsection letters until that is resolved against the current eCFR.

## Current state

**Engine — already dual-set, do not touch.**
`PART77_DIMENSIONS: Record<FaaApproachType, Part77SurfaceSet>` holds all six approach
types' surface metadata — names, colors, and numeric criteria including the precision
two-slope encoding (`secondSegmentSlope: 40`, `segmentLength: 10000`)
(`lib/calculations/obstructions.ts:179-443`). Accessors: `getPart77Surfaces(approachType)`
(:448), `getSurfaces(surfaceSet, approachType)` (:472). `evaluateObstructionAllRunways`
dispatches per `surfaceSet` and threads per-runway `approachType ?? 'non_utility_non_precision_low'`
(:1373-1399); its input type is `RunwayEvalInput = { label, geometry, approachType? }`
(:1360-1364). Part 77 evaluations emit exactly 5 surfaces with keys `primary | approach |
horizontal | conical | transitional` (:1069-1353); UFC uses `approach_departure` etc.
`tests/part77-surfaces.test.ts` locks every §77.19 dimension per approach type.

**Page — mostly wired, four UFC-hardwired leftovers.**
`app/(app)/obstructions/page.tsx` seeds `surfaceSet` from `getSurfaceSet(currentInstallation)`
(:150-153; helper at `lib/airport-mode.ts:273-279` reads `bases.obstruction_surface_set`,
else mode default), attaches per-runway `faa_approach_type` in `getAllRunways` (:119),
passes `surfaceSet` to `runEvaluation` (:312-320), pins `surface_set` in the save payload
(:472; column from migration `2026061200`), and warns when Part 77 is selected with
unconfigured runways (:771-782). The leftovers:

1. The section header is hardcoded "UFC 3-260-01, Chapter 3 — Imaginary Surface Analysis"
   (:547-549).
2. The point-info `surfaceName` comes from `identifySurface`, which always calls the UFC
   evaluator (`obstructions.ts:1468-1495`; call sites page.tsx:218, :257).
3. The `withinApproachDeparture` flag calls `evaluateObstruction` (UFC) directly and
   checks `surfaceKey === 'approach_departure'` (:224-227, :263-266) — always false-ish
   under Part 77, whose key is `'approach'` (`obstructions.ts:1177`).
4. The edit-mode auto-re-evaluation omits the `surfaceSet` argument, silently re-running
   UFC on a saved Part 77 evaluation (:242).

**Map — the gap. Completely hardwired to UFC.**
`components/obstructions/airfield-map-google.tsx`: `Props` has no surface-set input
(:44-50); `LEGEND_ITEMS` is a static UFC list (Outer Horizontal … APZ II, :64-75);
`SURFACE_LAYERS` and `getToggleKeyForLayer` mirror it (:77-110). `buildSurfacePolygons`
(:119-161) unconditionally reads UFC radii from `IMAGINARY_SURFACES` and calls the UFC
generators; polygons are instantiated inside the map-init effect (:298-323). The
component's own `getAllRunways` (:232-245) drops `faa_approach_type` even though
`useInstallation().runways` carries it (`InstallationRunway` includes the column,
`lib/supabase/types.ts:3105`; `fetchInstallationRunways` selects `*`,
`lib/supabase/installations.ts:44-59`).

**Geometry generators — UFC numbers baked into function bodies.**
`lib/calculations/geometry.ts`: `generatePrimarySurfacePolygon` `halfWidth = 1000`
(:322), `generateApproachTrapezoid` inner 1,000 / outer 2,550 / length 25,000 (:410-413),
`generateTransitionalPolygons` constants incl. `approachCutoff = 150 * 50` (:489-511),
`generateClearZonePolygons` (:349-350), `generateAPZPolygons` (:562-597). Only
`generateStadiumPolygon(rwy, radiusFt, pointsPerArc)` (:446-478) is parameterized; its arc
centers sit 200 ft beyond each runway end (:453-457) — which happens to be exactly the
§77.19(b) construction (center of each end of the primary surface) for a hard-surfaced
runway. Shared primitives `offsetPoint` (:18), `distanceFt` (:52), `normalizeBearing`
(:76), `getRunwayGeometry` (:161) are all exported. **No Part 77 polygon builder exists
anywhere in the repo.**

**Detail page — already set-aware.** `SurfaceSetLegend` prefers the row's pinned
`surface_set` and iterates `getPart77Surfaces()` vs `IMAGINARY_SURFACES`
(`app/(app)/obstructions/[id]/page.tsx:406-414, 734-755`). Result cards and the PDF table
render `surfaceName` / `ufcReference` from the saved `results` JSON, so they already show
Part 77 names for Part 77 rows (`lib/obstruction-pdf.ts:158-172, 211`). One PDF leftover:
the details table renders `Runway Class ${evaluation.runway_class}` unconditionally
(`lib/obstruction-pdf.ts:94, 106`) with no surface-set line.

**Base-config — FAA approach fields exist but are gated on `isCivilian`, not surface set.**
`RunwayEditForm` in `app/(app)/base-config/setup/page.tsx` holds `faa_approach_type` /
`faa_approach_category` form state (:528-529), persists them (:544-545), and renders both
selectors — but only inside `{civilian && (…)}` (:576-609). A USAF base whose admin sets
`obstruction_surface_set = 'faa_part77'` (column from migration `2026052504`) cannot edit
approach types, so every runway falls back to the engine default. The read-only runway card
already displays the approach-type label when set (:1246-1250). The columns themselves are
**per-runway, not per-end** (`supabase/migrations/2026060800_runways_faa_approach.sql`) —
one `faa_approach_type` drives both ends, matching what the engine consumes.

## Design

**Source of truth for what the map draws: the page's `surfaceSet` state** (not just the
base column). Evaluations follow the picker — including the "what-if on a USAF base" case
(page.tsx:783-787) — so the overlays must too. Toggling the picker rebuilds the polygons.

**Part 77 overlay composition (per §77.19, all dimensions from `getPart77Surfaces(type).criteria`):**

| Layer id | Shape | Source criteria |
|---|---|---|
| `p77-horizontal` | Stadium at the per-runway horizontal radius (5,000 / 10,000 ft), arcs centered 200 ft beyond each runway end (primary-surface ends) | `horizontal.criteria.radius` |
| `p77-conical` | Stadium at `radius + 4,000 ft`, layered under the horizontal (same visual idiom as UFC's conical, airfield-map-google.tsx:128) | `conical.criteria.horizontalExtent` |
| `p77-transitional-left/right` | 7:1 band, 1,050 ft wide (150 ft ÷ 7:1) along the primary and approach edges; along the approach only out to the cutoff where the approach edge itself reaches 150 ft (`cutoff = 150 × approach slope`, generalizing geometry.ts:511) | `transitional.criteria`, `approach.criteria` |
| `p77-approach-end1/end2` | Trapezoid from the primary-surface end: inner half-width = primary half-width, flaring to `outerHalfWidth` over `length` (5,000 / 10,000 / 50,000 ft). Plan-view footprint is a single trapezoid even for precision (the flare is uniform; only the slope changes at 10,000 ft) | `approach.criteria` |
| `p77-segment-break-end1/end2` | Precision only: a thin cross-line at 10,000 ft marking the 50:1 → 40:1 slope change (drawn as a 2-pt polyline-style narrow polygon; skipped for non-precision) | `approach.criteria.segmentLength` |
| `p77-primary` | Rectangle at per-type half-width (125 / 250 / 500 ft), extended 200 ft past each end | `primary.criteria` |
| `runway` | Unchanged (shared with UFC) | — |

No clear zone, graded area, APZ, or outer horizontal under Part 77 — those layers simply
do not exist in the Part 77 branch.

**Per-runway dimensioning.** Each runway's polygons use its own `faa_approach_type`
(NULL → `non_utility_non_precision_low`, matching the engine default at
obstructions.ts:1390). Unlike the UFC branch (which draws horizontal/conical stadiums for
`runways[0]` only, airfield-map-google.tsx:121-129), the Part 77 branch draws a
horizontal + conical stadium **per runway**, because radii differ per runway category.
Overlapping translucent stadiums are acceptable; the true §77.19(b) composite perimeter
(tangent union across runways, dropping encompassed 5,000-ft arcs) is deferred — see
Assumptions.

**Legend and toggles become functions of the set.** Part 77 legend: Conical, Horizontal,
Transitional, Approach, Primary — colors from `getPart77Surfaces()` (constant across
types, obstructions.ts:187-219). Toggle keys: `p77-horizontal | p77-conical |
p77-transitional | p77-approach | p77-primary`, all default-on (only 5 layers; the
precision approach is long but so is UFC's default-on 25,000-ft approach-departure).
Toggle state resets to the new set's defaults when the set flips. When Part 77 is active
and any runway lacks `faa_approach_type`, the legend footer shows a one-line amber note
("N runway(s) not configured — using non-utility non-precision (<¾ mi) defaults") echoing
the existing picker warning (page.tsx:776-780).

**Labels.** The page section header (page.tsx:547-549) becomes set-aware: "UFC 3-260-01,
Chapter 3 — Imaginary Surface Analysis" vs "FAA Part 77 (14 CFR §77.19) — Imaginary
Surface Analysis". Point-info "surface at point" uses the set-aware `identifySurface`
(below). Result cards and the detail page already render engine-emitted names.

**Base-config runway form.** The FAA approach selectors' gate changes from `civilian` to
`civilian || getSurfaceSet(currentInstallation) === 'faa_part77'` (setup/page.tsx:576),
so a USAF base evaluating under Part 77 can configure per-runway types. Copy under the
selector notes it only affects Part 77 obstruction analysis. Everything else in the form
(runway_class persistence rules at :543) is unchanged.

**Edge cases.**
- Zero runways: map draws nothing (existing behavior, buildSurfacePolygons early-return path).
- Edit mode: the picker is already disabled (page.tsx:738); the map renders the saved
  evaluation's set because `surfaceSet` state is what the row pinned — and the edit-load
  re-eval bug fix (Design item 4 in Current state) makes the recomputed numbers match.
- Mixed approach types across runways: each runway's overlay uses its own type; the
  legend swatch colors are shared (identical across types by design).
- Mobile: no new UI surface — the legend is the existing collapsible panel; toggle rows
  gain at most 5 entries (fewer than UFC's 10).

## Data model & migrations

**None required.** Every column this feature needs already exists:

- `bases.obstruction_surface_set` — migration `2026052504_bases_obstruction_surface_set.sql`
- `base_runways.faa_approach_type` / `faa_approach_category` — migration
  `2026060800_runways_faa_approach.sql` (per-runway, 6-value CHECK)
- `obstruction_evaluations.surface_set` — migration `2026061200_obstruction_evaluations_surface_set.sql`

The assigned range **2026071610–2026071619 goes unused** (numbers would be bumped to the
actual implementation date if a schema need emerged). Per-end approach-type columns were
considered and rejected: the evaluation engine consumes one `approachType` per runway
(`RunwayEvalInput`, obstructions.ts:1360-1364), and changing that is evaluation-engine
scope, which this spec explicitly excludes. RLS is untouched — no new tables, no new
policies, and existing `base_runways` / `obstruction_evaluations` policies already follow
the permission matrix.

## Access control

**No new permission keys.** Existing keys govern everything this feature touches:

- `obstructions:view` (`PERM.OBSTRUCTIONS_VIEW`, `lib/permissions.ts:47`) — gates the
  /obstructions page and therefore the map; rendering Part 77 polygons adds no new data
  exposure (runway geometry is already drawn).
- `obstructions:write` / `obstructions:delete` — unchanged; evaluations save as today.
- Base-config runway editing is gated by the existing wizard access rules; the
  `RunwayEditForm` change only widens *which fields render*, not who can save. Writes to
  `base_runways` remain enforced by its existing RLS policies
  (`user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), '<resource>:write')`
  matrix shape).

## lib/ modules & API surface

**New: `lib/calculations/part77-geometry.ts`** — Part 77 builders, cleanly separated from
the UFC generators in `geometry.ts`. Imports only exported primitives via
`@/lib/calculations/geometry` (`offsetPoint`, `distanceFt`, `normalizeBearing`,
`generateStadiumPolygon`, types `LatLon`, `RunwayGeometry`) and criteria via
`@/lib/calculations/obstructions` (`getPart77Surfaces`, `FaaApproachType`).

```ts
/** Shared feature shape — matches buildSurfacePolygons' output in the map component. */
export type SurfacePolygonFeature = {
  id: string
  coords: [number, number][]
  rwyIndex: number
}

export type Part77RunwayInput = {
  geometry: RunwayGeometry
  approachType?: FaaApproachType | null   // NULL → non_utility_non_precision_low
}

/** §77.19(a): rectangle at per-type half-width, +200 ft past each end. */
export function generatePart77PrimaryPolygon(
  rwy: RunwayGeometry,
  criteria: { halfWidth: number; extension: number },
): [number, number][]

/** §77.19: trapezoid per end from the primary-surface end (inner HW = primary HW). */
export function generatePart77ApproachPolygons(
  rwy: RunwayGeometry,
  criteria: { innerHalfWidth: number; outerHalfWidth: number; length: number },
  extensionFt?: number,           // default 200
): { end1: [number, number][]; end2: [number, number][] }

/** §77.19(e): 7:1 bands along primary + approach edges up to 150 ft.
 *  approachCutoffFt = 150 × approach slope (7,500 ft for precision's 50:1 first segment). */
export function generatePart77TransitionalPolygons(
  rwy: RunwayGeometry,
  criteria: {
    primaryHalfWidth: number
    approachSlope: number
    approachInnerHalfWidth: number
    approachOuterHalfWidth: number
    approachLength: number
  },
): { left: [number, number][]; right: [number, number][] }

/** §77.19(b)/(conical): stadiums via generateStadiumPolygon — arc centers already sit
 *  200 ft beyond runway ends (geometry.ts:453-457), i.e. at the primary-surface ends,
 *  which is the §77.19(b) construction for hard-surfaced runways. */
export function generatePart77HorizontalPolygon(rwy: RunwayGeometry, radiusFt: number): [number, number][]
export function generatePart77ConicalPolygon(rwy: RunwayGeometry, radiusFt: number, extentFt: number): [number, number][]

/** Assemble the full Part 77 feature list for all runways (per-runway dimensions). */
export function buildPart77SurfacePolygons(runways: Part77RunwayInput[]): SurfacePolygonFeature[]
```

`buildPart77SurfacePolygons` pulls each runway's numbers from
`getPart77Surfaces(approachType ?? 'non_utility_non_precision_low').{primary,approach,horizontal,conical,transitional}.criteria`
— the exact lookup the evaluator uses (obstructions.ts:1079-1097) — and emits the layer
ids from the Design table, tagging `rwyIndex` so the existing per-runway visibility
toggles keep working. It also emits the precision segment-break line features.

**Changed: `lib/calculations/obstructions.ts`** — one signature widening, no engine math:

```ts
export function identifySurface(
  point: LatLon,
  rwy: RunwayGeometry | RunwayGeometry[] | RunwayEvalInput[],
  airfieldElevMSL = 580,
  runwayClass = 'B',
  surfaceSet: SurfaceSet = 'ufc_3_260_01',   // new, defaulted — existing callers unaffected
): string
```

When `surfaceSet === 'faa_part77'` it dispatches each runway through
`evaluateObstructionPart77` (with the entry's `approachType` when the array form carries
one) instead of `evaluateObstruction`; the controlling-surface reduction logic (:1476-1494)
is shared. Existing UFC tests must pass unchanged.

**No new route handlers.** No server code changes at all.

## UI components & pages

| File | Change |
|---|---|
| `lib/calculations/part77-geometry.ts` | **New** — builders per previous section. |
| `lib/calculations/obstructions.ts` | `identifySurface` gains the defaulted `surfaceSet` param + `RunwayEvalInput[]` acceptance. |
| `components/obstructions/airfield-map-google.tsx` | Add `surfaceSet: SurfaceSet` to `Props` (:44-50). Map `faa_approach_type` in the component's `getAllRunways` (:232-245) so each geometry pairs with its type. Replace the static `LEGEND_ITEMS` / `SURFACE_LAYERS` / `ToggleKey` / `getToggleKeyForLayer` (:52-110) with per-set variants: keep the UFC constants as-is, add `PART77_LEGEND_ITEMS` / `PART77_SURFACE_LAYERS` (colors from `getPart77Surfaces()`), and select by prop. In the map-init effect, branch `buildSurfacePolygons(allRwys)` vs `buildPart77SurfacePolygons(...)` (:298-299) and **add `surfaceSet` to the effect deps** so toggling rebuilds overlays; reset `visibility` state to the active set's defaults on set change. Legend footer: amber "not configured" note when Part 77 + any NULL approach type. |
| `app/(app)/obstructions/page.tsx` | Pass `surfaceSet={surfaceSet}` to `<AirfieldMap>` (:556). Set-aware section header (:547-549). Pass `surfaceSet` (and per-runway types via `getAllRunways()`) to `identifySurface` at both call sites (:218, :257). Fix `withinApproachDeparture` to run the set-aware evaluator and match `surfaceKey === (surfaceSet === 'faa_part77' ? 'approach' : 'approach_departure')` (:224-227, :263-266). Add `surfaceSet` to the edit-load re-evaluation call (:242). |
| `app/(app)/base-config/setup/page.tsx` | `RunwayEditForm`: widen the FAA-approach-fields gate at :576 from `civilian` to `civilian \|\| getSurfaceSet(currentInstallation) === 'faa_part77'` (import `getSurfaceSet` from `@/lib/airport-mode`). |
| `app/(app)/obstructions/[id]/page.tsx` | No change — `SurfaceSetLegend` is already pinned-set-aware (:406-414, :734-755). |
| `components/obstructions/obstruction-map-view-google.tsx` | No change — history marker map draws no surface polygons. |

Filenames stay kebab-case, components PascalCase, all imports via `@/`. Toasts (Sonner)
and lucide icons follow the page's existing idioms; no new icons are needed.

## Exports & PDF

`lib/obstruction-pdf.ts` (client-side jsPDF + autotable, returns `{ doc, filename }` —
unchanged contract). Two data-driven tweaks:

1. The details table row `['Runway Class', 'Class B' …]` (:94, :106) becomes set-aware:
   for rows with `surface_set === 'faa_part77'` render `['Surface Set', 'FAA Part 77
   (14 CFR §77.19)']` instead of a runway-class line (the `runway_class` column is a UFC
   concept; civilian rows may carry a placeholder). UFC rows additionally gain a
   `['Surface Set', 'UFC 3-260-01']` row for symmetry. The evaluation row already exposes
   `surface_set` (`lib/supabase/obstructions.ts:62-65`).
2. No other change — the surface-analysis table, references list, and violation lines
   already print the engine-emitted `surfaceName` / `ufcReference` per row (:158-172,
   :211, :257).

No Excel export exists for this module; none is added.

## Integration

- **enabled_modules**: no new key — the existing `obstructions` module
  (`lib/modules-config.ts:145-152`, `defaultEnabled: true`) covers this; no backfill
  migration needed.
- **Nav/sidebar//more**: no changes — `/obstructions` is already registered and gated on
  `obstructions:view`.
- **Base-config wizard**: no new step — the change lives inside the existing Runways step
  (`RunwayEditForm`).
- **Badges/red-dot**: none — this feature has no pending-work semantics.
- **installation-context**: no change — `runways` already carries `faa_approach_type`
  because `fetchInstallationRunways` selects `*` (`lib/supabase/installations.ts:48-52`).

## Implementation sequence

1. **`lib/calculations/part77-geometry.ts` + unit tests.** Pure geometry, no UI. Verify:
   `npx tsc --noEmit` and `npm run test tests/part77-geometry.test.ts` green; spot-check a
   generated approach trapezoid's far-edge distance with `distanceFt`.
2. **`identifySurface` set-awareness** in `lib/calculations/obstructions.ts`. Verify:
   existing `tests/obstruction-evaluation.test.ts` and `tests/part77-surfaces.test.ts`
   pass unchanged (default-arg back-compat), plus new dispatch cases.
3. **Map renderer branch** in `airfield-map-google.tsx` (prop, per-set legend/layers,
   effect deps, visibility reset, not-configured note) + pass the prop from
   `app/(app)/obstructions/page.tsx:556`. Verify: on a Part 77 base the map shows exactly
   5 surface layer types with Part 77 names; toggling the picker swaps overlays live;
   UFC base rendering is pixel-identical to before.
4. **Page label/calc fixes**: header (:547), `identifySurface` call sites (:218, :257),
   `withinApproachDeparture` (:224, :263), edit-load re-eval `surfaceSet` (:242). Verify:
   open a saved Part 77 evaluation in edit mode — recomputed surfaces match the saved
   `results` names/keys; point-info card names a Part 77 surface.
5. **Base-config gate + PDF surface-set row.** Verify: a USAF base with
   `obstruction_surface_set = 'faa_part77'` shows the FAA Approach Type selector in the
   Runways step and the value persists; regenerate a Part 77 evaluation PDF and confirm
   the Surface Set row and absence of a bare "Class null".
6. **Manual QA script + docs touch** (`docs/manual/` obstructions page gets one paragraph
   on set-aware overlays). Verify: full script below, then `npm run build`.

Each step is an independently committable unit against `main` per repo convention.

## Testing

**New: `tests/part77-geometry.test.ts`** (vitest, mirroring `tests/part77-surfaces.test.ts`
style — plain `describe/it`, dimension-locking assertions, and `tests/square-bounds.test.ts`-style
`distanceFt` closeness checks):

- Primary polygon: lateral half-width ≈ 125 / 250 / 500 ft by approach type (measure
  generated-corner distance from centerline via `distanceFt`); length ≈ runway + 400 ft.
- Approach trapezoid: far edge ≈ `extension + length` from the runway end (5,000 / 10,000 /
  50,000 ft); inner corners at primary half-width; outer corners at `outerHalfWidth`
  (625 / 1,000 / 750 / 1,000 / 2,000 / 8,000 per type). These lock **current-code**
  criteria values, not regulation-verified ones — the fourth entry
  (`non_utility_non_precision_3_4`, 1,000 ft half-width) conflicts with the
  research-verified §77.19(d) 3,500-ft outer width (1,750 ft half); see Assumption 2a. If
  the criteria are corrected, update this assertion alongside
  `tests/part77-surfaces.test.ts`.
- Precision segment-break feature exists at ≈ 10,000 ft, and is absent for non-precision.
- Transitional band: outer edge 1,050 ft beyond the primary edge; approach-side cutoff at
  `150 × slope` (3,000 ft for 20:1, 5,100 ft for 34:1, 7,500 ft for 50:1) — never past
  the approach length for the 20:1/5,000 ft case (cutoff 3,000 < 5,000; assert clamping
  logic for hypothetical shorter approaches).
- Horizontal stadium: max distance from runway midpoint ≈ `radius + halfLength + 200`;
  5,000 vs 10,000 ft radius by type. Conical stadium ≈ `radius + 4,000`.
- `buildPart77SurfacePolygons`: emits exactly the expected layer-id set per approach type;
  two runways with different types produce different approach lengths (`rwyIndex` tags
  correct); NULL approach type falls back to the `non_utility_non_precision_low` numbers.

**Extended: `tests/obstruction-evaluation.test.ts`** — `identifySurface` with
`surfaceSet: 'faa_part77'` returns Part 77 surface names ("Approach Surface", not
"Approach-Departure Clearance Surface") for a point off the runway end; default-arg call
still returns UFC names (regression).

**RLS/isolation tests: none** — no new tables or policies.

**Manual QA script:**
1. Civilian base (Part 77 default): /obstructions map shows 5 Part 77 layers + runway;
   legend lists Horizontal / Conical / Transitional / Approach / Primary; header reads
   "FAA Part 77 (14 CFR §77.19)".
2. Toggle picker to UFC 3-260-01: overlays swap to the 10 UFC layers; toggle back.
3. Set one runway to Utility/Visual, another to Precision in Base Setup: approach
   trapezoids differ visibly (5,000 vs 50,000 ft); precision shows the 10,000-ft break line.
4. Clear one runway's approach type: amber not-configured note appears in legend and picker.
5. Click a point under the Part 77 approach: point-info names "Approach Surface"; run an
   evaluation; save; reopen via edit link: recomputed results match; picker disabled.
6. USAF base, flip `obstruction_surface_set` to `faa_part77`: Runways step shows FAA
   approach selectors; map follows; what-if warning still renders.
7. Generate the PDF for one UFC and one Part 77 evaluation; check the Surface Set row and
   surface names.

## Assumptions & open questions

1. **§77.19 subsection lettering conflict.** The code's `ufcRef` strings cite approach as
   (c) and conical as (d) (obstructions.ts:192, 208); the regulatory research verified
   conical = (c) and approach = (d). Verify against the current eCFR publication before
   changing any displayed citation string; this spec's new copy avoids subsection letters
   for approach/conical.
2a. **Approach outer width for non-utility non-precision, visibility minimums > ¾ mi.**
   The Regulatory basis above cites the research-verified §77.19(d) outer width of
   **3,500 ft** for this category (research-reg-part77-vs-ufc.json P77-APP-2, VERIFIED),
   but the codebase encodes `outerHalfWidth: 1000` — 2,000 ft total — for
   `non_utility_non_precision_3_4` (obstructions.ts:317, locked by
   tests/part77-surfaces.test.ts:130-131). Because `buildPart77SurfacePolygons` pulls
   dimensions from `getPart77Surfaces().criteria`, the map would draw a §77.19-labeled
   approach trapezoid at 2,000 ft outer width while this spec cites 3,500 ft. Verify
   against the current eCFR and, if 3,500 ft is confirmed, fix the criteria table and
   `tests/part77-surfaces.test.ts` as an engine-scope prerequisite or fast-follow to this
   feature; the rendering code itself needs no change (it inherits whatever the criteria
   say).
2. **Primary width for non-utility visual runways (500 ft).** The research bundle could
   not verify the specific §77.19(a) clause; the encoded 250-ft half-width is consistent
   with the verified 1,500-ft approach outer width for that category, but verify against
   the current publication.
3. **"Utility runway" and precision/non-precision definitions (§77.3).** Unverified from
   a fetched source — the selector labels rely on the existing
   `FAA_APPROACH_TYPE_LABELS`; verify definitions against the current publication before
   adding any explanatory copy.
4. **Utility runways with certain planned instrument approaches use 10,000-ft horizontal
   arcs** per §77.19(b) nuance — not modeled (the type enum drives 5,000 ft for utility);
   verify against the current publication and treat as a future enum refinement.
5. **All §77.19 dimensions were verified via search-extract quotes of ecfr.gov /
   law.cornell.edu / govinfo.gov, not full page fetches** (research-environment proxy
   limitation). Spot-check the dimensions table against ecfr.gov before shipping.
6. **Per-end approach categories.** Schema and engine are per-runway; §77.19 is per-end
   for approach surfaces and runway-level-max for primary width. Acceptable simplification
   today (both ends share the more precise category); revisit if a base needs mixed-end
   categories.
7. **Multi-runway horizontal composite.** True §77.19(b) construction unions all runways'
   arcs with tangents and drops encompassed 5,000-ft arcs; we draw per-runway stadiums.
   Also inherited: the UFC branch still draws `runways[0]`-only stadiums — left as-is.
8. **Precision transitional 5,000-ft extension** beyond the conical limits (§77.19(e)) is
   not rendered; the evaluator likewise does not model it. Rendering parity with the
   engine is the chosen line — revisit both together (engine scope).
9. Should the detail page eventually render a static surface-overlay map, it must use the
   row's pinned `surface_set` — noted for whoever adds it.

## Out of scope

- **The evaluation engine** — `evaluateObstruction*`, criteria tables, violation logic,
  and `tests/obstruction-evaluation.test.ts` behavior are untouched except the
  `identifySurface` signature widening.
- **ICAO Annex 14 or 14 CFR §77.21 surface sets** — the builder-module separation
  (`part77-geometry.ts` beside the UFC generators) is the extension point; no third set
  is built now.
- **Per-end `faa_approach_type` schema**, composite tangent-union horizontal perimeters,
  and the precision transitional extension (Assumptions 6-8).
- **PDF map snapshots** of the overlays; the history page's marker map
  (`obstruction-map-view-google.tsx`).
- **Renaming UFC surfaces** or touching the UFC legend/labels beyond making them one
  branch of a set-aware switch.
- Taxiway surface evaluation and rendering (separate criteria system,
  `lib/calculations/taxiway-criteria.ts`).
