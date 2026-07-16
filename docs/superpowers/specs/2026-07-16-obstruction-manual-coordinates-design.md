# Obstruction Tool — Manual Coordinate Entry — Design

**Date:** 2026-07-16
**Status:** Draft for owner review
**Scope:** `/obstructions` evaluation page + new shared coordinate parsing library

## Summary

Let users **type coordinates** into the obstruction evaluation tool instead of
tapping the map. A single smart-parse text field accepts decimal degrees (DD),
degrees-decimal-minutes (DDM), degrees-minutes-seconds (DMS, with hemisphere
letters or signed values, including the packed FAA obstacle-NOTAM form), and
MGRS. On a successful parse the map pans/zooms to the point, the pin is
placed, elevation is fetched, and the evaluation proceeds through **exactly**
the same pipeline as a map click.

Who uses it: AM Ops and NAMO evaluating obstructions whose coordinates arrive
in writing — CE work-order site surveys, contractor crane permits, FAA OE/AAA
case letters (DD or DMS), and ground parties reporting positions over the
radio in MGRS. Today they must eyeball the map and tap, which is imprecise
and slow, especially on mobile in the field. Civilian Part 139 airports get
the same feature (the tool already supports the Part 77 surface set);
DD/DMS input is the common civilian case, MGRS the military one.

Zero migrations, zero new tables, zero new permission keys — this is a
client-side enhancement inside the existing Obstruction module.

## Regulatory basis

- **UFC 3-260-01 Chapter 3** is the existing basis of the obstruction
  evaluation engine itself (`lib/calculations/obstructions.ts`; the page
  header renders "UFC 3-260-01, Chapter 3 — Imaginary Surface Analysis" at
  `app/(app)/obstructions/page.tsx:548`). This feature changes how a point is
  *entered*, not how it is *evaluated* — no new surface math, no new criteria.
- The packed `DDMMSS{N|S}DDDMMSS{E|W}` output already produced by
  `toNotamCoordString` (page.tsx:63-78) follows the FAA obstacle-NOTAM
  coordinate convention per the existing code comment; the new parser accepts
  that same form as *input* (round-trip guaranteed by tests).
- No regulation mandates specific input formats for this tool. MGRS is the
  standard DoD ground grid reference and is included on operational grounds;
  see Assumptions for the (unverified) publication reference.

Per house rule 7, no paragraph numbers are cited here beyond what the
codebase already carries; anything softer lives in §Assumptions.

## Current state

All in `app/(app)/obstructions/page.tsx` (client component, ~1275 LOC) and
`components/obstructions/airfield-map-google.tsx`:

- **Point entry today is map-tap or GPS only.** The map registers a click
  listener that calls `onPointSelected({ lat, lon })`
  (airfield-map-google.tsx:292-295 per research; props at :44-50). The page's
  `handlePointSelected(point: LatLon)` (page.tsx:254-298) identifies the
  surface, finds the closest runway, sets `pointInfo`, clears stale analysis
  (`setMultiAnalysis(null)`, :279), then awaits `fetchElevation(point)`
  (:282) and toasts the result.
- **GPS button is the exact pattern to copy**: `UseMyLocationButton`
  (page.tsx:575-583) does `setFlyToPoint(point)` then
  `handlePointSelected(point)`. `flyToPoint` state is declared at :146; the
  map effect (airfield-map-google.tsx:493-497) runs `panTo` + `setZoom(15)`
  when the prop reference changes.
- **`LatLon` is `{ lat: number; lon: number }`**
  (`lib/calculations/geometry.ts:11`). `fetchElevation` (geometry.ts:605-619)
  GETs `/api/elevation`, whose route (`app/api/elevation/route.ts:15-20`)
  rejects non-finite values and enforces lat ∈ [-90, 90], lon ∈ [-180, 180].
- **Coordinate display is DD with hardcoded hemispheres**: the Selected
  Location card renders `{lat.toFixed(5)}°N, {Math.abs(lon).toFixed(5)}°W`
  (page.tsx:593) — wrong for OCONUS/southern-hemisphere bases. The PDF has
  the same bug (`lib/obstruction-pdf.ts:92-93`, `Math.abs(longitude)`).
- **Existing coordinate helpers are narrow and scattered:**
  - `formatCoordsDMS` (`lib/utils.ts:288-298`) — despite the name it outputs
    degrees-*decimal-minutes* (`N43°56.34'`). Formatter only.
  - `toNotamCoordString` (page.tsx:63-78) — module-local packed DDMMSS
    formatter, seconds truncated.
  - `parseDMS` (`app/api/airport-lookup/route.ts:162-168`) — server-side,
    unexported, single strict format (`33°55'38.78"N`).
- **What does NOT exist:** any typed-coordinate input anywhere in the app;
  any MGRS/UTM/projection code; any geo dependency in `package.json`; any
  general-purpose coordinate parser. Vitest is configured
  (`vitest.config.ts`, `tests/**/*.test.ts{,x}`, jsdom).

## Design

### Decision: parsing approach

**Hand-rolled DD/DMS/DDM parser in `lib/calculations/coordinates.ts` + the
`mgrs` npm package for MGRS. UTM input is deferred (stretch, out of scope).**

Rationale (from the library research, all registry claims verified from
fetched npm metadata/tarballs):

| Option | Verdict |
|---|---|
| `mgrs@2.2.0` | **Take it.** Zero deps, MIT, ~6.2 KB min, actively maintained (last publish 2026-07), ships its own `index.d.ts` (`forward`, `inverse`, `toPoint` — all **lon-first**). Hand-rolling MGRS (100k-m square lettering, zone exceptions, Norway/Svalbard bands) is real risk for no payoff. |
| `proj4@2.20.9` | Rejected: 129 KB min / 42 KB gzip, it's a CRS transformer and does not parse user-typed DMS at all. |
| `geodesy@2.4.0` | Rejected as a dep: last publish 2022, no bundled types, whole class library for one static parse function. |
| `parse-dms` / `coordinate-parser` / `parse-coords` | Rejected: stale (≤2022), untyped — worse than ~120 LOC of our own strictly-typed, table-tested code. |
| Hand-rolled DD/DMS/DDM | **Take it.** Small, pure, fully typed, trivially unit-testable, and lets us support the packed NOTAM form (inverse of our own `toNotamCoordString`) which no off-the-shelf parser handles. |

The single new dependency keeps the surface flat for the planned Platform One
migration; `mgrs` is MIT (with LGPL-derived-portions attribution in the repo)
and dependency-free, so it vendors cleanly if IL4/IL5 review ever demands it.

### Input UX — one smart-parse field

A new `CoordinateEntryInput` component rendered directly beneath the map,
immediately after `UseMyLocationButton` (page.tsx:583):

```
[ 📍 42°36'19"N 082°49'13"W________________ ] [ Place Pin ]
  DMS → 42.60528, -82.82047                      ← live preview (green)
```

- **Auto-detect, no format selector.** One text input (monospace,
  `autoCapitalize="characters"`, `enterKeyHint="go"`). Parsing runs on every
  keystroke (pure function, microseconds) and drives a one-line status under
  the field:
  - **Valid** → green check line: detected format label + normalized DD
    preview, e.g. `MGRS → 42.60528, -82.82047`. "Place Pin" button enabled.
  - **Partial/invalid (non-empty)** → muted hint line cycling per-format
    examples: `Try: 42.60522, -82.82047 · 42°36'19"N 082°49'13"W ·
    42 36.31N 082 49.23W · 17TLG1234567890`. Once the input is long enough
    to be a failed attempt (heuristic: parse returned a specific error),
    show that error in red instead: `Minutes must be < 60`,
    `Latitude out of range (-90 to 90)`, `Not a valid MGRS grid reference`.
  - **Empty** → hint line hidden.
- **Commit** via the "Place Pin" button (lucide `MapPin`) or Enter. On
  commit: `onPoint(point, { format })` fires; the field keeps its text so the
  user can nudge and re-place; the button re-disables until the text changes
  again (prevents accidental double-fires but permits re-placing the same
  coordinates after a map tap moved the pin — see edge cases).
- **Styling** matches the obstruction module's idiom — inline styles with the
  app's CSS custom properties (`var(--color-cyan)`, `var(--radius-md)`, …)
  exactly like `UseMyLocationButton`'s inline variant, not Tailwind classes.
  Sonner for toasts, lucide-react for icons (house rule 8).

### Wiring on the obstructions page

```tsx
<CoordinateEntryInput
  onPoint={(point) => {
    setFlyToPoint({ ...point })   // ALWAYS a fresh object — the flyTo effect
    handlePointSelected(point)    // (airfield-map-google.tsx:493-497) fires
  }}                              // on reference change only
  style={{ marginTop: 8 }}
/>
```

This reuses the entire existing pipeline unchanged: pin render via the
`selectedPoint` prop (marker effect at airfield-map-google.tsx:443-490),
pan/zoom via `flyToPoint`, elevation fetch + toast, Selected Location card,
NOTAM reference string, and the Evaluate button enabling. **No changes to
`airfield-map-google.tsx` are required.**

### Edge cases

- **Point far from the airfield.** The evaluation engine will silently report
  "outside all surfaces" for a fat-fingered hemisphere or transposed pair.
  After a successful parse-and-place, compute the distance from the first
  runway's midpoint (`distanceFt` from `@/lib/calculations/geometry`,
  runways from `useInstallation()`); if > 30 NM, show a non-blocking Sonner
  warning toast: `Point is ~412 NM from the airfield — check hemisphere and
  format`. Never block — evaluating a distant point is legitimate (e.g. an
  outer-horizontal question) and the OCONUS/hemisphere check is the real
  target.
- **Same coordinates re-entered after a map tap.** The commit handler always
  builds fresh objects, so `flyToPoint` re-pans and the pin snaps back —
  matches the GPS button's behavior (research gap #5).
- **Elevation API bounds.** The parser enforces the same lat/lon ranges as
  `app/api/elevation/route.ts:17-19`, so a committed point can never 400 the
  elevation route.
- **MGRS precision.** 1- to 5-digit easting/northing pairs accepted (10 km →
  1 m). `mgrs.toPoint` throws on malformed strings — always wrapped in
  try/catch and surfaced as a parse error, never an exception.
- **Whitespace/separator tolerance.** Commas, multiple spaces, `°`/`'`/`"`/
  `′`/`″`/`:` separators, leading OR trailing hemisphere letters, lowercase
  input — all normalized before matching. Hemisphere letters may appear in
  either order (`W082… N42…` assigns by letter); bare signed pairs are always
  read lat-first.
- **Sign XOR hemisphere.** `-82.8W` is rejected with a specific error rather
  than silently double-negating.
- **Mobile.** The field is full-width under the map (same slot as the GPS
  button); `enterKeyHint="go"` commits from the virtual keyboard; the live
  preview line doubles as tap-target-free feedback so no tooltip is needed.

### Displaying the active point in all formats

The Selected Location card's Coordinates cell (page.tsx:590-595) is replaced
by a compact stacked display driven by the new formatters, with a copy button
per line (existing `Copy` icon + clipboard pattern from the NOTAM block,
page.tsx:645-662):

```
DD    42.60522, -82.82047
DMS   42°36'18.8"N 082°49'13.7"W
DDM   N42°36.31' W082°49.23'
MGRS  17TLG2345671890
```

This also **fixes the hardcoded `°N` / `°W`** at page.tsx:593 — hemispheres
now derive from sign. The NOTAM reference block below it is unchanged.

## Data model & migrations

**None.** `obstruction_evaluations.latitude` / `longitude` remain plain
doubles written by the existing save path (page.tsx save payload); how the
point was entered is not persisted (see Out of scope). The assigned migration
range **2026071600–2026071609 goes unused**; if implementation later finds a
need (e.g. persisting entry format), numbers must be bumped to the actual
implementation date per house convention.

## Access control

**No new permission keys.** The entry field lives inside the evaluation page,
which is already gated: nav/route visibility by `obstructions:view`, saving by
`obstructions:write` (keys exist in `lib/permissions.ts:47-49` and in the
permission matrix; RLS on `obstruction_evaluations` is untouched). Typing a
coordinate is exactly as privileged as tapping the map. No role visibility
changes, nothing for base admins to configure.

## lib/ modules & API surface

### New: `lib/calculations/coordinates.ts` (pure, no React, no I/O)

```ts
import type { LatLon } from '@/lib/calculations/geometry'

export type CoordinateFormat = 'dd' | 'ddm' | 'dms' | 'mgrs'

export type CoordinateParseResult =
  | { ok: true; point: LatLon; format: CoordinateFormat }
  | { ok: false; error: string }

/** Auto-detecting parser. Trims, uppercases, normalizes unicode
 *  degree/minute/second marks, then classifies:
 *  1. MGRS grid shape (/^\d{1,2}[C-HJ-NP-X]\s?[A-HJ-NP-Z]{2}\s?.../) → mgrs.toPoint (try/catch, lon-first → LatLon)
 *  2. Packed NOTAM DDMMSS{N|S}DDDMMSS{E|W} (inverse of toNotamCoordString)
 *  3. Two signed/hemisphere-suffixed decimal numbers → dd
 *  4. Tokenized D[M[S]] pairs with hemisphere letter or sign → dms/ddm
 *  Validation: sign XOR hemisphere; minutes < 60; seconds < 60;
 *  |lat| ≤ 90; |lon| ≤ 180 (mirrors app/api/elevation/route.ts:17-19).
 *  Errors are specific, user-facing strings. */
export function parseCoordinateInput(raw: string): CoordinateParseResult

/** Formatters for the Selected Location display + tests' round-trips. */
export function formatDD(point: LatLon, digits?: number): string        // "42.60522, -82.82047"
export function formatDMS(point: LatLon): string                        // "42°36'18.8\"N 082°49'13.7\"W"
export function formatDDM(point: LatLon): string                        // "N42°36.31' W082°49.23'" (same shape as lib/utils.ts formatCoordsDMS)
export function formatMGRS(point: LatLon, accuracy?: 1|2|3|4|5): string // wraps mgrs.forward([lon, lat], accuracy ?? 5); '' on throw (poles)
```

Notes:
- Lives in `lib/calculations/` beside `geometry.ts` per the feature brief and
  because it imports `LatLon` from there — no new type duplication.
- `formatCoordsDMS` in `lib/utils.ts` (a DDM formatter with a misleading
  name) stays untouched — other call sites depend on it. `formatDDM` here is
  the going-forward canonical one; a code comment cross-references the two.
- `toNotamCoordString` stays module-local in page.tsx (NOTAM-specific,
  seconds-truncated). The parser's packed-form branch is its exact inverse
  and the tests round-trip through it.

### New dependency

`mgrs@^2.2.0` added to `package.json` dependencies. Client-bundle cost
~6 KB; the import lands only in `lib/calculations/coordinates.ts`, which is
pulled in by the already-dynamically-imported obstructions page.

### API surface

No new or changed route handlers. `/api/elevation` reused as-is.

## UI components & pages

| File | Action |
|---|---|
| `lib/calculations/coordinates.ts` | **Create.** Parser + formatters (above). |
| `components/ui/coordinate-entry-input.tsx` | **Create.** `CoordinateEntryInput` — controlled text input + live parse preview/error line + "Place Pin" commit button. Props: `onPoint: (point: LatLon, meta: { format: CoordinateFormat }) => void; disabled?: boolean; style?: React.CSSProperties`. Placed in `components/ui/` (like `use-my-location-button.tsx`) so wildlife/discrepancy pickers can adopt it later. |
| `app/(app)/obstructions/page.tsx` | **Modify.** (a) Render `CoordinateEntryInput` after `UseMyLocationButton` (:583) wired to `setFlyToPoint({...p})` + `handlePointSelected(p)`; (b) replace the Coordinates cell (:590-595) with the four-format stacked display + per-line copy; (c) the >30 NM sanity toast in the commit handler. |
| `lib/obstruction-pdf.ts` | **Modify (small).** Fix the hardcoded-hemisphere display at :92-93 using `formatDD`; optionally add a DMS/MGRS line to the location block. |
| `package.json` | **Modify.** Add `mgrs`. |

No changes to `components/obstructions/airfield-map-google.tsx`,
`lib/calculations/geometry.ts`, `lib/calculations/obstructions.ts`, or any
Supabase CRUD module.

## Exports & PDF

No new PDF generator. The existing `lib/obstruction-pdf.ts` keeps its
`{ doc, filename }` contract; the only touch is the hemisphere-display fix
(and optional extra format line) noted above.

## Integration

Deliberately **none of the module-onboarding machinery applies**:

- No new nav entry — the feature is inside `/obstructions`, already in
  `lib/sidebar-config.ts` and gated via `HREF_TO_VIEW_PERM`.
- No `enabled_modules` key — covered by the existing `obstructions` module
  key (`lib/modules-config.ts:145-150`); no backfill migration.
- No base-config wizard step, no badges, no `glidepath:badges-refresh`
  plumbing, no `/more` page changes.
- Docs: add a short "Type coordinates" subsection to the Obstructions page of
  `docs/manual/` in the same PR that ships the UI.

## Implementation sequence

1. **Parser + formatters + tests** — add `mgrs` dep; create
   `lib/calculations/coordinates.ts` and `tests/coordinates.test.ts` (full
   matrix below). *Verify:* `npm run test` green; `npx tsc --noEmit` clean;
   no UI change yet so nothing else to check.
2. **`CoordinateEntryInput` component** — create
   `components/ui/coordinate-entry-input.tsx`; component-level tests for
   preview/error/commit states (`tests/coordinate-entry-input.test.tsx`,
   jsdom + Testing Library, same pattern as `tests/amtr-files-tab.test.tsx`).
   *Verify:* tests green; render it on a scratch page or Storybook-style
   manual check in `npm run dev`.
3. **Wire into obstructions page + format display + PDF fix** — page edits
   from §UI components; distance sanity toast. *Verify:* manual QA script
   (§Testing) end-to-end in dev against a configured base; `npm run build`
   clean; confirm a typed point produces byte-identical evaluation results to
   a map tap on the same coordinates.

Each step is an independently shippable commit to `main` per house git
convention.

## Testing

### `tests/coordinates.test.ts` (vitest, table-driven)

- **Decimal degrees:** `"42.60522, -82.82047"`, space-separated, hemisphere
  suffixed (`"42.60522N 82.82047W"`), hemisphere prefixed
  (`"N42.60522 W82.82047"`), reversed-order hemisphere pair
  (`"W082.82047 N42.60522"` → same point), negative-zero latitude, integer
  degrees.
- **DMS:** symbol separators, colon separators (`"42:36:19N 82:49:14W"`),
  space-only tokens, unicode prime/double-prime marks, signed no-hemisphere
  (`"42 36 19, -82 49 14"`), fractional seconds, packed NOTAM
  (`"423618N0824913W"` → parses; and `parse(toNotamCoordString(lat, lon))`
  round-trips within 1 second of arc for a grid of test points across all
  four hemisphere quadrants).
- **DDM:** `"42 36.313N 082 49.228W"`, `"N42°36.31' W082°49.23'"` — including
  `parse(formatDDM(p)) ≈ p` and `parse(formatCoordsDMS(...))` (the
  lib/utils.ts output) both round-tripping within ~1 m.
- **MGRS:** known-vector `forward`/`toPoint` round-trips at accuracies 1–5;
  spaced and unspaced grid strings; lowercase input; `parse(formatMGRS(p)) ≈
  p` within the 1 m cell for CONUS, OCONUS (Europe/Pacific), and
  southern-hemisphere points; polar/out-of-band strings rejected cleanly
  (error result, no throw).
- **Hemisphere handling:** all four quadrants for every format; S/W produce
  negative values; sign XOR hemisphere rejection (`"-82.8W"`); lat-letter on
  lon token rejected (`"42N 82N"`).
- **Range validation (mirrors `app/api/elevation/route.ts:17-19`):**
  `90.00001` lat rejected, `-180.5` lon rejected, `90`/`-90`/`180`/`-180`
  accepted; minutes ≥ 60 and seconds ≥ 60 rejected with the specific error
  strings.
- **Garbage:** empty string, whitespace, `"hello"`, single number, three
  numbers, `NaN`/`Infinity` text, emoji, 10k-char string, SQL-ish/HTML-ish
  strings — all return `{ ok: false }`, never throw.
- **Format classification:** each fixture asserts the detected `format`
  discriminant, guarding the classifier order (an MGRS-looking string must
  never fall through to the DMS branch).

### `tests/coordinate-entry-input.test.tsx`

Renders the component; asserts: valid input shows format label + DD preview
and enables the button; invalid input shows the error line and keeps it
disabled; Enter and button click both fire `onPoint` with the parsed
`LatLon`; commit disables the button until the text changes; `onPoint` is
called with fresh object instances on repeated commits.

### RLS / isolation

No new tables, no RLS changes — no isolation tests required.

### Manual QA script

1. On a configured USAF base, open `/obstructions`. Type
   `42°36'19"N 082°49'13"W`, press Enter → map pans/zooms, pin drops,
   "Elevation: … ft MSL" toast, Selected Location card populates with all
   four formats and correct hemispheres.
2. Enter a height, Evaluate → identical results to tapping the same spot.
   Save → row persists with the typed lat/lon.
3. Repeat with `17TLG…` MGRS for the same point → pin lands within meters.
4. Type the packed string from the NOTAM Reference block back into the field
   → pin returns to (within a second of arc of) the same point.
5. Type coordinates ~500 NM away → pin places, distance warning toast
   appears, evaluation still runs.
6. Type `-82.8W 42.6N`, `42 61 00N 082 00 00W`, `hello` → specific inline
   errors, button disabled, no toast spam.
7. Mobile viewport: field full-width, virtual-keyboard Go commits, preview
   line readable.
8. Civilian Part 139 base: same flow with the Part 77 surface set.
9. Edit mode (`?edit=<id>`): typing new coordinates replaces the loaded
   point and clears stale analysis (existing `setMultiAnalysis(null)` path).

## Assumptions & open questions

- **MGRS standardization reference:** MGRS is treated as the standard DoD
  ground grid reference on operational grounds; if a citation is wanted in
  docs/help copy, verify against the current NGA standard (commonly
  referenced as NGA.STND.0037) before citing — **not verified from a fetched
  source in research**.
- **UFC 3-260-01 Chapter 3** is cited only as the *existing* module basis
  already present in the codebase/UI; this feature adds no new claims against
  it.
- **Zoom level:** the flyTo effect hardcodes `setZoom(15)`
  (airfield-map-google.tsx:493-497) while GPS-style flows elsewhere use 16.
  This spec keeps 15 (no map-component change); owner may ask for a tighter
  zoom for typed points, which would require adding an optional zoom to the
  `flyToPoint` prop.
- **Should `CoordinateEntryInput` also ship inside
  `components/ui/location-picker-map-google.tsx`** so wildlife
  sighting/strike and discrepancy forms get typed entry for free? The
  component is designed for it (generic `onPoint`), but wiring those forms is
  out of scope here — owner call for a follow-up.
- **Persisting the entry format** (map-tap vs typed vs GPS, and which
  format) on `obstruction_evaluations` was considered and dropped — no
  consumer identified. If later wanted, it is one additive migration.
- **`mgrs` at IL4/IL5:** assumed acceptable as a single MIT, zero-dependency
  package; if Platform One review disagrees, the plan is to vendor it (its
  license permits), not to hand-roll.

## Out of scope

- **UTM input** (zone/easting/northing) — MGRS covers the military use case;
  raw UTM needs its own grammar and adds datum-handling questions. Revisit
  only on user demand (the parser's classifier structure makes it an additive
  branch).
- Draggable pin fine-adjustment (marker stays non-draggable,
  airfield-map-google.tsx:468).
- Typed-coordinate entry in wildlife/discrepancy/base-config location pickers
  (component is reusable; wiring deferred).
- Geocoding / place-name search ("crane at building 1234").
- Persisting entry method/format to the database; any migration at all.
- Changing the evaluation engine, surface math, or NOTAM string format.
