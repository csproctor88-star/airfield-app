# Dashboard Polish: Centered Tiles · Link Reorder · AMTR Consolidation — Design Spec

**Date:** 2026-06-29
**Status:** Proposed (awaiting review)
**Module:** Dashboard (`/dashboard`, customizable widget grid)

## Problem / Goal

Three independent dashboard refinements from user testing (screenshots in
`docs/Screenshots/`):

1. **Metric tiles float top-left**, leaving awkward empty space (Unit KPIs, Last
   Check). Their content should be centered.
2. **Links can't be reordered** — the Links widget only supports add/remove.
3. **The 5 AMTR widgets clutter the Add-Widget palette.** They should collapse into
   **one** "AMTR" widget whose report type is chosen in its config.

**No DB migration, no schema change.**

## Out of scope (YAGNI)

- Drag-and-drop link reordering (up/down buttons suffice).
- Per-report column/filter customization inside the consolidated AMTR widget
  (report picker only; existing column config on legacy instances is still honored
  at render — see below).
- Centering tables, Notes, Links, Quick Actions, Clock, Infrastructure (left/grid
  layouts are correct for those).
- A data migration to rewrite existing widget instances (handled by a `hidden` flag
  instead).

---

## Feature A — Center metric/summary tile content

**Scope (9 widgets):** Unit KPIs (`amtr-kpis-widget`), Last Check
(`last-check-widget`), and the report-summary tiles `report-discrepancies`,
`report-trends`, `report-aging`, `report-lighting`, `report-daily`, plus the
Inspection Status tile (`inspection-status-widget`) and Customer Feedback
(`feedback-widget`).

**Behavior:** the metric content is centered **horizontally and vertically** within
the widget body. For widgets that have a footer link ("Open AMTR →", "View report
→"), the **footer stays pinned at the bottom** and only the metric block above it
centers; for Last Check (no footer) the whole block centers.

**Implementation:** small per-component flex tweaks — set the metric content area's
`justifyContent: 'center'` and `alignItems: 'center'` (it is already the `flex: 1`
region above the footer in the report/KPI widgets), and `textAlign: 'center'` so
wrapped labels read cleanly. No shared abstraction is introduced (the widgets are
similar but separate; the change is one or two style props each). Footer link rows
keep their existing `justify-content: flex-end`/bottom placement.

Each widget is verified visually after the change (Task-level manual check).

---

## Feature B — Reorder links in the Links widget

**Where:** `LinksConfigForm` (in `components/dashboard/widgets/links-widget.tsx`),
the row editor that already maps `rows` with Label/URL/Description inputs + a Trash
remove button.

**Change:** each row gets **▲ (move up)** and **▼ (move down)** buttons beside the
remove button. ▲ is disabled on the first row, ▼ on the last. They reorder the local
`rows` array; the existing **Save** persists the new order into `config.links`
(order is already preserved on save — the widget renders `links` in array order).

**Pure helper (unit-tested):** `moveItem(arr, from, to)` in `lib/dashboard/array-move.ts`
— returns a new array with the element moved (no mutation; out-of-range `to` is a
no-op). Reused by the up/down handlers.

---

## Feature C — Consolidate the 5 AMTR widgets into one configurable widget

**Goal:** the palette shows a single **"AMTR"** entry; the user picks which report it
shows in the gear.

### The consolidated widget
New file `components/dashboard/widgets/amtr-widget.tsx` exporting:

- A report map:
  ```
  const AMTR_REPORTS = {
    currency:    amtrDescriptor,
    overdue:     amtrOverdueDescriptor,
    'due-soon':  amtrDueSoonDescriptor,
    inspections: amtrInspectionsDescriptor,
  }  // 'kpis' is the one native (non-table) report
  ```
- `AmtrWidget(props: WidgetProps)` — reads `report = props.config.report ?? 'currency'`;
  if `'kpis'` renders `<AmtrKpisWidget />`; otherwise renders
  `<TableWidget descriptor={AMTR_REPORTS[report] ?? amtrDescriptor} config={props.config} onConfigChange={props.onConfigChange} />`.
- `AmtrReportConfigForm({ config, onSave, onCancel })` — a Title text input + a
  **Report** `<select>` (Currency · Unit KPIs · Overdue Training · Due Soon (30 days)
  · Inspection Status) + Save/Cancel. **Save preserves existing config**:
  `onSave({ ...config, title: title.trim() || undefined, report })` — so a legacy
  Currency instance's saved `columns`/`filters` survive a config save, and are still
  honored at render by `TableWidget`.

### Registry changes (`lib/dashboard/registry.tsx`)
- Replace the current `'amtr'` table entry with the consolidated native widget:
  ```
  'amtr': {
    type: 'amtr', kind: 'native', title: 'AMTR',
    description: 'Airfield Management Training Record — pick a report: currency, unit KPIs, overdue, due soon, or inspections',
    icon: GraduationCap, defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 },
    permission: PERM.AMTR_VIEW, moduleHref: '/amtr',
    Component: (p) => <AmtrWidget {...p} />,
    ConfigForm: AmtrReportConfigForm,
  },
  ```
  Default report is `currency`, so **existing `amtr` (Currency) instances render
  unchanged.**
- Mark the four entries `amtr-kpis`, `amtr-overdue`, `amtr-due-soon`,
  `amtr-inspections` with **`hidden: true`** (keep them otherwise intact). They still
  render for any board that already added them, but they leave the palette.

### Palette hiding
- Add `hidden?: boolean` to `WidgetMeta` (`lib/dashboard/widget-registry.ts`).
- The palette's available-widgets filter excludes `def.hidden` (one added clause in
  `listAvailableWidgets`, alongside the existing permission + module-enabled checks).

### Back-compat summary
- `amtr` Currency instances → render via `report: 'currency'` default. ✓
- `amtr-kpis` / `amtr-overdue` / `amtr-due-soon` / `amtr-inspections` instances →
  still resolve to their hidden registry entries and render. ✓
- New users → see only the single "AMTR" palette entry. ✓
- **No data migration; no `unavailable` widgets.**

---

## Components / files

| File | Change |
|---|---|
| `lib/dashboard/array-move.ts` (new) | pure `moveItem(arr, from, to)` |
| `tests/dashboard-array-move.test.ts` (new) | unit tests for `moveItem` |
| `components/dashboard/widgets/links-widget.tsx` | ▲/▼ reorder in `LinksConfigForm` |
| `components/dashboard/widgets/amtr-widget.tsx` (new) | `AmtrWidget` + `AmtrReportConfigForm` + report map |
| `lib/dashboard/widget-registry.ts` | add `hidden?: boolean` to `WidgetMeta`; filter `hidden` in the palette list |
| `lib/dashboard/registry.tsx` | consolidated `amtr` entry; `hidden: true` on the 4 AMTR keys; import the new widget |
| `components/dashboard/widgets/amtr-kpis-widget.tsx`, `last-check-widget.tsx`, `report-{discrepancies,trends,aging,lighting,daily}-widget.tsx`, `inspection-status-widget.tsx`, `feedback-widget.tsx` | center metric content |

No migration. The `amtr-due-items.tsx` / `amtr-inspections.tsx` descriptors and the
`amtr-kpis-widget` component are reused as-is by the consolidated widget.

## Error handling

- Reorder and report-picker are pure local-state edits persisted through the existing
  config-save path (`onSave` → `onWidgetConfigChange` → `persist`); no new failure
  modes.
- `AmtrWidget` falls back to `amtrDescriptor` (Currency) for an unknown/missing
  `report` value, so a malformed config can never render nothing.

## Testing

- **Unit:** `moveItem(arr, from, to)` — moves up, moves down, first/last no-op,
  out-of-range no-op, does not mutate input.
- **Build gate:** `npx tsc --noEmit` + `npm run build` green; full `npx vitest run`.
- **Manual smoke (after deploy):** the 9 tiles read centered; Links ▲/▼ reorder and
  persist; the palette shows ONE "AMTR" entry; adding it + switching the Report
  dropdown renders each of the five reports; an existing Currency `amtr` widget and
  any previously-added `amtr-overdue`/etc. instance still render.

## Risks / notes

- Changing `amtr` from `kind: 'table'` to `kind: 'native'` is metadata-only; the grid
  renders `def.Component` regardless, and table reports still go through `TableWidget`
  (which owns table config normalization).
- The four `hidden` entries are legacy-only render paths; if desired later, a one-time
  layout migration could rewrite them to `{ type: 'amtr', config: { report } }` and
  delete the hidden entries — out of scope here.
- Centering is per-component; the manual visual check per widget is the safeguard
  against a footer/layout regression.
