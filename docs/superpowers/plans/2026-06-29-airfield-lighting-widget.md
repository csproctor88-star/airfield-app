# Airfield Lighting Widget — Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** A dashboard "Airfield Lighting" widget scoped By Area / By System / By Type, showing systems → components → out lights with A3.1 health tiers and required compliance actions on exceedance; hide the old system-scoped infrastructure widget from the palette; add an "add a widget for every area" board builder.

**Spec:** `docs/superpowers/specs/2026-06-29-airfield-lighting-area-widget-design.md`. **No DB migration.**

## Verified reference facts
- Hierarchy: `lighting_systems` ──< `lighting_system_components` (`system_id`) ──< `infrastructure_features` (`system_component_id`, live `status`). Outage math in `lib/outage-rules.ts`: `calculateSystemHealth(system, components, allFeatures): SystemHealth` (`.components: OutageStatus[]`, system tier via `getAlertTier(health)`), `OutageStatus { totalCount, inoperativeCount, outagePct, barsOut, totalBars, isExceeded, isApproaching, requiredActions, notamTemplate, qCode, … }`, `ALERT_TIER_CONFIG`, `SYSTEM_TYPE_LABELS`.
- Fetch: `fetchLightingSystems(baseId): LightingSystem[]` (has `id, base_id, system_type, name, runway_or_taxiway, sort_order`), `fetchAllComponentsForBase(baseId): LightingSystemComponent[]` (has `system_id, label, component_type, total_count, requires_notam, requires_ce_notification, requires_system_shutoff, requires_terps_notification, …`), `fetchInfrastructureFeatures(baseId): InfrastructureFeature[]` (`status`, `system_component_id`, `label`, `block`, `feature_type`). Label helper `formatFeatureType(feature_type)` in `lib/supabase/infrastructure-features.ts`.
- The area grouping logic lives inline in `app/(app)/infrastructure/page.tsx:621-675` (the `fullRunways` set 627-631, `resolveArea` 633-644, `areaOrder` 659-669). It operates on a system's `runway_or_taxiway`.
- Registry helpers: `WidgetMeta.hidden?: boolean` + `listAvailableWidgets` filter already exist (AMTR work). `WidgetProps { config, editing, onConfigChange? }`, `WidgetConfigProps { config, onSave, onCancel }`. Widget sizes use the current 2× / 24-col grid scale.
- Palette: `components/dashboard/widget-palette.tsx` (`onAdd(type)` per addable widget). Dashboard `onAdd` (page.tsx) appends a widget via `setWidgets(prev => [...prev, {...}])` + `markDirty()`; `getWidgetDef(type).defaultSize` gives w/h; ids via `uuid()`.

---

## Task 1: Extract shared area module + refactor page (+ tests)

**Files:** Create `lib/infrastructure/areas.ts`, `tests/infrastructure-areas.test.ts`; modify `app/(app)/infrastructure/page.tsx`.

- [ ] **Create `lib/infrastructure/areas.ts`** (pure; mirrors the page's current logic exactly):
```ts
type AreaItem = { runway_or_taxiway: string | null }

/** Full runway names (RWY + contains "/") used to merge partial refs. */
export function buildFullRunwaysSet(items: AreaItem[]): Set<string> {
  const set = new Set<string>()
  for (const it of items) {
    const rt = it.runway_or_taxiway?.toUpperCase() || ''
    if (rt.startsWith('RWY') && rt.includes('/') && it.runway_or_taxiway) set.add(it.runway_or_taxiway)
  }
  return set
}

/** Normalize a system's free-text runway_or_taxiway onto a canonical area label. */
export function resolveArea(rwy: string | null, fullRunways: Set<string>): string {
  if (!rwy) return 'General'
  const upper = rwy.toUpperCase().replace(/^RWY\s*/, '')
  for (const full of Array.from(fullRunways)) {
    const fullUpper = full.toUpperCase().replace(/^RWY\s*/, '')
    const ends = fullUpper.split('/')
    if (ends.some(e => e.trim() === upper.trim())) return full
  }
  return rwy
}

/** Airfield precedence: full runway 100, single-end 200, TWY 300, named 500, general 900. */
export function areaSortKey(label: string): number {
  const u = label.toUpperCase()
  if (u.startsWith('RWY')) return u.includes('/') ? 100 : 200
  if (u.startsWith('TWY')) return 300
  if (u === 'GENERAL' || u === 'MISCELLANEOUS') return 900
  return 500
}

/** Distinct resolved areas (deduped by upper-case), sorted by precedence then numeric name. */
export function listAreas(systems: AreaItem[]): string[] {
  const full = buildFullRunwaysSet(systems)
  const byKey = new Map<string, string>()
  for (const s of systems) {
    const label = resolveArea(s.runway_or_taxiway, full)
    const key = label.toUpperCase()
    if (!byKey.has(key)) byKey.set(key, label)
  }
  return Array.from(byKey.values()).sort((a, b) => {
    const d = areaSortKey(a) - areaSortKey(b)
    return d !== 0 ? d : a.localeCompare(b, undefined, { numeric: true })
  })
}

/** Systems whose resolved area equals `area`. */
export function systemsForArea<T extends AreaItem>(systems: T[], area: string): T[] {
  const full = buildFullRunwaysSet(systems)
  const key = area.toUpperCase()
  return systems.filter(s => resolveArea(s.runway_or_taxiway, full).toUpperCase() === key)
}
```
- [ ] **Tests** `tests/infrastructure-areas.test.ts`: `resolveArea("RWY 01", set{"RWY 01/19"}) === "RWY 01/19"`, `resolveArea("19", set{"RWY 01/19"}) === "RWY 01/19"`, `resolveArea(null, …) === "General"`, `resolveArea("TWY A", empty) === "TWY A"`. `areaSortKey`: "RWY 01/19"→100, "RWY 01"→200, "TWY A"→300, "East Ramp"→500, "General"→900. `listAreas` dedups partials into the full runway and sorts RWY-full < RWY-end < TWY < named < General. `systemsForArea` returns systems matching by resolved area (incl. a partial-ref system grouped under the full runway).
- [ ] **Refactor `infrastructure/page.tsx`**: import `resolveArea, buildFullRunwaysSet, areaSortKey` from `@/lib/infrastructure/areas`; delete the inline `fullRunways` build (627-631 → `const fullRunways = buildFullRunwaysSet(systems)`), the inline `resolveArea` (633-644 → use imported, called as `resolveArea(sys.runway_or_taxiway, fullRunways)`), and the inline `areaOrder` (659-669 → `areaSortKey`). Behavior identical — the page's existing area rendering is the regression check.
- [ ] **Verify:** `npx vitest run tests/infrastructure-areas.test.ts` (pass), `npx tsc --noEmit` (0), `npm run build` (compiled). Commit `feat(infra): shared area-resolution module; reuse in infrastructure page`.

---

## Task 2: Lighting widget + config form

**Files:** Create `components/dashboard/widgets/lighting-widget.tsx`.

- [ ] **`LightingWidget(props: WidgetProps)`** — read context + fetch + compute:
  - `const { installationId } = useInstallation()`; state `{ systems, components, features, loading }`.
  - effect keyed `[installationId, scope, value]` (`scope = props.config.scope ?? 'area'`, `value = props.config.value`): if `!installationId` → clear loading. Else `Promise.all([fetchLightingSystems, fetchAllComponentsForBase, fetchInfrastructureFeatures])`.
  - **Select systems** per scope: `area` → `systemsForArea(systems, value)`; `system` → `systems.filter(s => s.id === value)`; `type` → `systems.filter(s => s.system_type === value)`. Empty if `value` unset.
  - For each selected system: components for it = `allComponents.filter(c => c.system_id === s.id)`; `health = calculateSystemHealth(s, comps, features)`.
  - Inoperative features for scope = features where `system_component_id ∈ selected components` and `status === 'inoperative'`.
  - **Render** (see spec §Rendering): summary dot (worst tier from the selected systems' `getAlertTier`) + `N systems · M lights out`; per system a row (name + tier badge) then each `OutageStatus`: `label · inop/total (or barsOut/totalBars bars) · pct% · tier`; when `isExceeded` a sub-line of action tags from `OutageStatus.requiredActions` (fallback to the component's `requires_*` flags). Footer: inoperative feature ids (`f.label ?? f.block ?? formatFeatureType(f.feature_type)`) wrapped, cap 12 + "+N more"; `View infra →` `/infrastructure`. Empty/clean → "All operational" 🟢; no `value` → "Choose a scope in this widget's settings".
  - Use `ALERT_TIER_CONFIG` for tier dot colors; mirror styling of `components/dashboard/widgets/infrastructure-widget.tsx`.
- [ ] **`LightingConfigForm({config, onSave, onCancel}: WidgetConfigProps)`**: fetch `fetchLightingSystems(installationId)` on mount. State `title`, `scope` (`'area'|'system'|'type'`, default from config or `'area'`), `value`. Render: Title input; a Scope segmented control (3 buttons Area/System/Type); a value `<select>` whose options depend on scope — Area: `listAreas(systems)`; System: `systems` (`value=s.id`, label `s.name` + ` (SYSTEM_TYPE_LABELS[s.system_type])` if differs); Type: distinct `s.system_type` present (`label=SYSTEM_TYPE_LABELS[type] ?? type`). On scope change, set `value` to the first option of the new scope. Save `onSave({ ...config, title: title.trim() || undefined, scope, value })`. Mirror `AmtrReportConfigForm` styling. Guard demo/no-supabase (createClient null) → empty options.
- [ ] **Verify:** `npx tsc --noEmit` (0), `npm run build` (compiled). Commit `feat(dashboard): Airfield Lighting widget (area/system/type scope)`.
- (Visual — flag for the user's smoke test.)

---

## Task 3: Register the widget + hide the old one

**Files:** modify `lib/dashboard/registry.tsx`.

- [ ] Import `LightingWidget, LightingConfigForm` and a `Lightbulb` icon (lucide). Add entry:
```tsx
'lighting': {
  type: 'lighting', kind: 'native', title: 'Airfield Lighting',
  description: 'Lighting health for a runway/taxiway/apron area, a system, or a light type',
  defaultSize: { w: 8, h: 8 }, minSize: { w: 6, h: 6 },
  permission: PERM.INFRASTRUCTURE_VIEW, moduleHref: '/infrastructure', icon: Lightbulb,
  Component: (p) => <LightingWidget {...p} />, ConfigForm: LightingConfigForm,
},
```
  (Match the exact `WidgetDef` object shape other native+ConfigForm entries use.)
- [ ] Add `hidden: true` to the existing `'infrastructure'` entry (keep everything else intact so existing instances still render).
- [ ] **Verify:** `npx tsc --noEmit` (0), `npx vitest run` (pass), `npm run build` (compiled). Commit `feat(dashboard): register Airfield Lighting widget; hide old system-scoped one`.

---

## Task 4: "Add a widget for every area" builder

**Files:** modify `components/dashboard/widget-palette.tsx`, `app/(app)/dashboard/page.tsx`.

- [ ] **page.tsx** — add `onAddLightingBoard` handler:
```tsx
const onAddLightingBoard = useCallback(async () => {
  if (!installationId) return
  const { fetchLightingSystems } = await import('@/lib/supabase/lighting-systems')
  const { listAreas } = await import('@/lib/infrastructure/areas')
  const systems = await fetchLightingSystems(installationId)
  const areas = listAreas(systems)
  if (!areas.length) { toast('No lighting systems found for this base.'); return }
  const def = getWidgetDef('lighting')
  setWidgets(prev => {
    let bottomY = prev.reduce((m, w) => Math.max(m, w.y + w.h), 0)
    const additions = areas.map(area => {
      const w = { i: uuid(), type: 'lighting', config: { scope: 'area', value: area } as Record<string, unknown>, x: 0, y: bottomY, w: def?.defaultSize.w ?? 8, h: def?.defaultSize.h ?? 8 }
      bottomY += (def?.defaultSize.h ?? 8)
      return w
    })
    return [...prev, ...additions]
  })
  markDirty()
  setShowPalette(false)
  toast.success(`Added ${areas.length} lighting widget${areas.length === 1 ? '' : 's'}`)
}, [installationId, markDirty])
```
  Pass `onAddLightingBoard` (gated by `has(PERM.INFRASTRUCTURE_VIEW)`) into `WidgetPalette`.
- [ ] **widget-palette.tsx** — accept an optional `onAddLightingArea?: () => void` prop; when present, render a small button at the top/section "✚ Add a lighting widget for every area". Keep it visually distinct from the per-widget add list.
- [ ] **Verify:** `npx tsc --noEmit` (0), `npm run build` (compiled). Commit `feat(dashboard): one-tap "add a lighting widget per area" builder`.
- (Behavioral — flag for smoke test.)

---

## Task 5: Full verification
- [ ] `npx vitest run` (all pass), `npx tsc --noEmit` (0), `npm run build` (RC 0). Manual smoke checklist for the user: Add "Airfield Lighting" from the palette; configure scope Area/System/Type and confirm the right systems/components/out-lights render; a component over its A3.1 threshold shows the action tags; the old "Infrastructure Status" widget is gone from the palette but existing instances still render; "add a lighting widget for every area" creates one tile per area; numbers match the `/infrastructure` page.

## Self-review
- Spec coverage: shared module=T1, widget+form=T2, registry+hide=T3, builder=T4, verify=T5. ✓
- Types: `resolveArea/buildFullRunwaysSet/areaSortKey/listAreas/systemsForArea` defined T1, used T2/T4 + page. `OutageStatus`/`SystemHealth`/`calculateSystemHealth`/`ALERT_TIER_CONFIG`/`SYSTEM_TYPE_LABELS` from `lib/outage-rules.ts`. No migration. Back-compat: old infra widget hidden, not removed.
