# Airfield Lighting — Area Widget (Design)

## Goal
A dashboard widget pinned to one airfield **area** (a runway, taxiway, or apron) that shows that area's lighting systems → components → individual out lights, including the DAFMAN A3.1 health tier per component and the **required compliance actions** when a component exceeds its allowable outage. Users add one widget per area to build a lighting-specific dashboard board.

## Key data-model fact
There is **no foreign key** from lighting to runway/taxiway tables. An "entity" is an **area**: the set of `lighting_systems` rows sharing a normalized `runway_or_taxiway` value (e.g. "RWY 01/19", "TWY A", an apron name). The `/infrastructure` page already builds this grouping inline (`resolveArea`, `areaOrder`, `AreaGroup` at `app/(app)/infrastructure/page.tsx:601-680`). We extract that into a shared module so the widget and the page agree exactly.

Hierarchy surfaced: **Area → lighting_systems → lighting_system_components → infrastructure_features → outage status.** Health is computed live by the outage engine (`lib/outage-rules.ts`), never stored.

## Architecture

### 1. Shared area module — `lib/infrastructure/areas.ts` (new)
Extract the area-resolution logic currently inline in `infrastructure/page.tsx` so it has one home:
- `resolveArea(runwayOrTaxiway: string | null, fullRunways: Set<string>): string` — normalizes a system's free-text `runway_or_taxiway` onto a canonical area label (e.g. "RWY 01" / "19" → "RWY 01/19"), mirroring the page's current `resolveArea`.
- `buildFullRunwaysSet(systems: LightingSystem[]): Set<string>` — the set of full runway names used by `resolveArea` (today derived at `page.tsx:627-631`).
- `areaSortKey(area: string): number` — the airfield precedence used at `page.tsx:659` (full runways 100 → single-end 200 → TWY 300 → named/ramp 500 → general 900).
- `listAreas(systems: LightingSystem[]): string[]` — distinct resolved areas, sorted by `areaSortKey` then name. Drives the widget's area dropdown.
- `systemsForArea(systems, area): LightingSystem[]` — filter systems whose resolved area === `area`.

Then refactor `infrastructure/page.tsx` to import these instead of its inline copies (no behavior change; the page is the regression check). Add focused unit tests for `resolveArea`/`listAreas`/`areaSortKey` in `tests/`.

### 2. The widget — `components/dashboard/widgets/lighting-area-widget.tsx` (new)
`LightingAreaWidget(props: WidgetProps)` and `LightingAreaConfigForm(props: WidgetConfigProps)`.

**Config shape:** `{ title?: string; area?: string }`. `area` is the resolved area label (the pin). If unset, the widget shows a "Choose an area in settings" prompt.

**Data flow (in a `useRows`-style effect keyed on `installationId` + `config.area`):**
1. `fetchLightingSystems(installationId)` → all systems; build `fullRunways = buildFullRunwaysSet(systems)`; `areaSystems = systemsForArea(systems, config.area)`.
2. `fetchAllComponentsForBase(installationId)` → all components; index by `system_id`.
3. `fetchInfrastructureFeatures(installationId)` → all features (live `status`).
4. For each system in `areaSystems`: `calculateSystemHealth(system, componentsForSystem, allFeatures)` → `SystemHealth` (per-component `OutageStatus[]`, system tier via `getAlertTier`).
5. Collect inoperative features for the area: features whose `system_component_id` belongs to one of the area's components and `status === 'inoperative'`.

All math comes from `lib/outage-rules.ts` — the widget renders, it does not re-derive thresholds.

**Config form:** Title input + an Area `<select>` populated by `listAreas(fetchLightingSystems(installationId))` (fetched in the form). Mirror `AmtrReportConfigForm` styling. Save `{ ...config, title: title.trim() || undefined, area }`.

### 3. Rendering (the "+ compliance actions" layout)
Top summary line: a worst-tier dot (🟢🟡🔴⚫ from `ALERT_TIER_CONFIG`) + `N systems · M lights out`.
Per system (in `sort_order`): a system row with its name + tier badge; under it each component row:
- `label`  ·  `inoperativeCount/totalCount` (or `barsOut/totalBars bars` when the rule is bar-based)  ·  `outagePct%`  ·  tier badge.
- When `OutageStatus.isExceeded`: a sub-line of **required actions** from the component flags — render short tags from `requires_notam` ("NOTAM"), `requires_ce_notification` ("Notify CE"), `requires_system_shutoff` ("Shut off"), `requires_terps_notification` ("TERPS"). (Use `OutageStatus.requiredActions` if it already aggregates these; otherwise read the component flags.)
- When `isApproaching` (not exceeded): tier shows 🟡, no action line.
Footer: inoperative feature IDs as a wrapped list (`f.label ?? f.block ?? formatFeatureType`), capped (e.g. first ~12) with "+N more"; a `View infra →` link to `/infrastructure`.

Empty/clean area → "All lighting operational" with a 🟢. Unknown/var-area (config.area not in current data) → gentle "No lighting systems for this area" empty state.

### 4. Registry — `lib/dashboard/registry.tsx`
New entry key `'lighting-area'`: `kind:'native'`, title **"Airfield Lighting (Area)"**, `Component: (p) => <LightingAreaWidget {...p} />`, `ConfigForm: LightingAreaConfigForm`, `permission: PERM.INFRASTRUCTURE_VIEW`, `moduleHref: '/infrastructure'`, icon (e.g. `Lightbulb`), `defaultSize`/`minSize` on the **current (2× / 24-col) grid scale** — e.g. `defaultSize: { w: 8, h: 8 }`, `minSize: { w: 6, h: 6 }`. The existing system-scoped `'infrastructure'` widget stays unchanged.

## Edge cases
- Area with systems but no components yet → show systems with "no components configured".
- Bar-based components → show `barsOut/totalBars bars` rather than light count (per `OutageStatus.barsOut/totalBars`).
- Features with `system_component_id = null` are unassigned and excluded (consistent with the engine).
- Aprons only appear as selectable areas if their lighting systems carry an apron name in `runway_or_taxiway`; areas with no lighting won't appear (the widget is lighting-scoped). Noted for the user.
- Polling: follow the repo's polling defaults if live refresh is added later; v1 loads on mount + on area/base change (no tight polling).

## Testing
- Unit: `resolveArea`, `listAreas`, `areaSortKey` (extraction parity with the page's prior behavior — lock the normalization examples "RWY 01"→"RWY 01/19", "TWY A" ordering).
- The outage math is already unit-tested in `lib/outage-rules.ts`; the widget reuses it, so no new threshold tests.
- Build/tsc/vitest green; manual smoke (visual) flagged for the user since rendering can't be verified here.

## Out of scope (possible follow-ups)
- A one-tap "add a lighting widget for every area" board builder.
- Live polling / realtime refresh of outage status in the widget.
- Apron/runway entities that have no lighting systems (would need a different data source than lighting).
