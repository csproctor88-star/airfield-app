# Airfield Lighting Widget (Design)

## Goal
A dashboard widget that shows airfield lighting health for a chosen **scope** — a runway/taxiway/apron **area**, a single **system**, or all systems of a **type** (e.g. all Stadium Lights, all Obstruction Lights) — broken down as systems → components → individual out lights, with the DAFMAN A3.1 health tier per component and the **required compliance actions** when a component exceeds its allowable outage. Users pin one widget per scope to build a lighting-specific dashboard, with a one-tap helper to add one widget per area.

## Key data-model facts
- There is **no foreign key** from lighting to runway/taxiway tables. An "area" is the set of `lighting_systems` rows sharing a normalized `runway_or_taxiway` value (e.g. "RWY 01/19", "TWY A", an apron name). The `/infrastructure` page already builds this grouping inline (`resolveArea`, `areaOrder` at `app/(app)/infrastructure/page.tsx:601-680`); we extract it to a shared module so the page and widget always agree.
- Stadium/obstruction/beacon/hazard lights are modeled as lighting **system types** in `lib/outage-rules.ts` `SYSTEM_TYPE_LABELS` (`stadium_light`, `obstruction_fixed`, `beacon`, `hazard_flashing`, `hazard_rotating`, …). So "all Stadium Lights" = systems filtered by `system_type`.
- Health is computed live by the outage engine (`lib/outage-rules.ts`) from each light's `infrastructure_features.status`; never stored.

Hierarchy surfaced for any scope: **selected systems → lighting_system_components (A3.1 thresholds) → infrastructure_features (out lights) → required actions.**

## Architecture

### 1. Shared area module — `lib/infrastructure/areas.ts` (new)
Extract the area logic currently inline in `infrastructure/page.tsx`:
- `resolveArea(runwayOrTaxiway: string | null, fullRunways: Set<string>): string` — normalize free-text onto a canonical area label (mirror the page's current `resolveArea`).
- `buildFullRunwaysSet(systems: LightingSystem[]): Set<string>` — the full-runway set `resolveArea` needs (today `page.tsx:627-631`).
- `areaSortKey(area: string): number` — airfield precedence (full runway 100 → single-end 200 → TWY 300 → named/ramp 500 → general 900), from `page.tsx:659`.
- `listAreas(systems: LightingSystem[]): string[]` — distinct resolved areas, sorted by `areaSortKey` then name.
- `systemsForArea(systems, area): LightingSystem[]`.

Refactor `infrastructure/page.tsx` to import these (no behavior change; the page is the regression check). Unit tests for `resolveArea`/`listAreas`/`areaSortKey`.

### 2. The widget — `components/dashboard/widgets/lighting-widget.tsx` (new)
`LightingWidget(props: WidgetProps)` + `LightingConfigForm(props: WidgetConfigProps)`.

**Config shape:** `{ title?: string; scope?: 'area' | 'system' | 'type'; value?: string }`. Default `scope: 'area'`. `value` meaning per scope:
- `area` → resolved area label → `systemsForArea(systems, value)`.
- `system` → `lighting_systems.id` → the one matching system.
- `type` → `lighting_systems.system_type` → `systems.filter(s => s.system_type === value)`.
If `value` is unset/stale → an empty "Choose a scope in settings" / "No matching systems" state.

**Data flow** (effect keyed on `installationId` + `scope` + `value`):
1. `fetchLightingSystems(installationId)` → all systems; `fullRunways = buildFullRunwaysSet(systems)`; resolve the **selected systems** per scope (above).
2. `fetchAllComponentsForBase(installationId)` → components; index by `system_id`.
3. `fetchInfrastructureFeatures(installationId)` → features (live `status`).
4. Per selected system: `calculateSystemHealth(system, componentsForSystem, allFeatures)` → `SystemHealth` (component `OutageStatus[]`, system tier via `getAlertTier`).
5. Inoperative features for the scope: features whose `system_component_id` is in the selected components and `status === 'inoperative'`.

All math from `lib/outage-rules.ts`; the widget only renders.

**Config form:** Title input + a **Scope** segmented control (Area / System / Type) + a **value** `<select>` whose options depend on scope — Area: `listAreas(systems)`; System: all systems (`id` → `name` + type label); Type: distinct `system_type`s present (label via `SYSTEM_TYPE_LABELS`). Fetch `fetchLightingSystems(installationId)` in the form. On scope change, reset/repick `value` to the first option. Save `{ ...config, title: title.trim() || undefined, scope, value }`.

### 3. Rendering (systems → components → out lights, + compliance)
- Summary line: worst-tier dot (🟢🟡🔴⚫ via `ALERT_TIER_CONFIG`) + a scope-aware count (`N systems · M lights out`).
- Per selected system (in `sort_order`): system name + tier badge; under it each component:
  - `label` · `inoperativeCount/totalCount` (or `barsOut/totalBars bars` when bar-based) · `outagePct%` · tier badge.
  - When `OutageStatus.isExceeded`: a required-actions sub-line built from `OutageStatus.requiredActions` (falling back to the component flags `requires_notam`→"NOTAM", `requires_ce_notification`→"Notify CE", `requires_system_shutoff`→"Shut off", `requires_terps_notification`→"TERPS").
- Footer: inoperative feature IDs (`f.label ?? f.block ?? formatFeatureType`) wrapped, capped (~12) + "+N more"; `View infra →` → `/infrastructure`.
- Clean scope → "All operational" 🟢. Title defaults to the scope value (area label / system name / type label) when no custom title.

### 4. Registry & palette — `lib/dashboard/registry.tsx`, `lib/dashboard/widget-registry.ts`
- New entry `'lighting'`: `kind:'native'`, title **"Airfield Lighting"**, `Component: (p) => <LightingWidget {...p} />`, `ConfigForm: LightingConfigForm`, `permission: PERM.INFRASTRUCTURE_VIEW`, `moduleHref:'/infrastructure'`, icon `Lightbulb`, sizes on the current 2×/24-col grid scale (`defaultSize: { w: 8, h: 8 }`, `minSize: { w: 6, h: 6 }`).
- **Hide the old system-scoped `'infrastructure'` entry** from the palette: add `hidden: true` to it (the `hidden` flag + `listAvailableWidgets` filter already exist from the AMTR work). It still renders for existing instances; it's just no longer offered.

### 5. "Add a widget for every area" builder
A board-level quick action. In the **Add-Widget palette** (`components/dashboard/widget-palette.tsx`), add a button "Add a lighting widget for every area" (shown only when the user has `INFRASTRUCTURE_VIEW`). It calls a new page handler `onAddLightingBoard()` which:
1. `fetchLightingSystems(installationId)` → `areas = listAreas(systems)`.
2. For each area, append a `'lighting'` widget with `config: { scope:'area', value: area }` via `appendWidgetToLayout` (stacked; new ids via `uuid()`), then `markDirty()`. If zero areas → a toast "No lighting systems found".
3. Close the palette. Widgets persist on Done like any edit (gridScale stamped on save).
(Stacking is acceptable for v1; the user rearranges/resizes afterward.)

## Edge cases
- Area/type with systems but no components → show systems with "no components configured".
- Bar-based components → `barsOut/totalBars bars` instead of light count.
- Unassigned features (`system_component_id = null`) excluded (engine-consistent).
- `type` scope with many systems across areas → list all; the worst tier rolls up to the summary.
- v1 loads on mount + scope/base change (no tight polling; follow repo polling defaults if realtime is added later).

## Testing
- Unit: `resolveArea`, `listAreas`, `areaSortKey` (lock normalization examples e.g. "RWY 01"→"RWY 01/19"; TWY ordering). Parity with the page's prior inline behavior.
- Outage math already unit-tested in `lib/outage-rules.ts`; reused, no new threshold tests.
- tsc/vitest/build green; manual visual smoke flagged for the user.

## Out of scope (possible follow-ups)
- A "type" board builder (one widget per system type), mirroring the area builder.
- Live polling / realtime refresh in the widget.
- Runway/taxiway/apron entities with no lighting systems (different data source than lighting).
