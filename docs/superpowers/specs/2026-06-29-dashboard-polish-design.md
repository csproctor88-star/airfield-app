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

## Feature B — Drag-and-drop link reorder in the Links widget

**Where:** `LinksConfigForm` (in `components/dashboard/widgets/links-widget.tsx`),
the row editor that already maps `rows` with Label/URL/Description inputs + a Trash
remove button.

**Change:** each row becomes **drag-to-reorder** via a grip handle (lucide
`GripVertical`), reusing the codebase's existing native HTML5 drag pattern from the
AMTR catalog editors (e.g. `components/amtr/simple-catalog-editor.tsx`,
`milestone-catalog-editor.tsx`). The row is `draggable`; `onDragStart` records the
source index, `onDragOver` (preventDefault to allow drop) marks the hovered index,
and `onDrop` reorders the local `rows`. The existing **Save** persists the new order
into `config.links` (the widget renders `links` in array order). No new dependency.

**Pure helper (unit-tested):** `moveItem(arr, from, to)` in `lib/dashboard/array-move.ts`
— returns a new array with the element moved (no mutation; out-of-range indices are a
no-op). Backs the drop handler (`moveItem(rows, dragIndex, dropIndex)`).

Note: native HTML5 DnD is mouse/desktop-oriented (the dashboard config is used on
desktop/tablet); touch-drag is not a goal here.

---

## Feature C — Consolidate the 5 AMTR widgets into one configurable widget

**Goal:** the palette shows a single **"AMTR"** entry; the user picks which report it
shows in the gear.

### Reports (9 total)

| `report` value | Label | Render | Scope | Status |
|---|---|---|---|---|
| `currency` | Currency | `amtrDescriptor` (table) | unit | exists |
| `kpis` | Unit KPIs | `AmtrKpisWidget` (native) | unit | exists |
| `overdue` | Overdue Training | `amtrOverdueDescriptor` (table) | unit | exists |
| `due-soon` | Due Soon (30 days) | `amtrDueSoonDescriptor` (table) | unit | exists |
| `inspections` | Inspection Status | `amtrInspectionsDescriptor` (table) | unit | exists |
| `my-training` | My Training Record | `amtrMyTrainingDescriptor` (table) | **self** | new |
| `progress` | Training Progress | `amtrProgressDescriptor` (table) | unit | new |
| `compliance` | Task Compliance | `amtrComplianceDescriptor` (table) | unit | new |
| `pending-signatures` | Pending Signatures | `amtrPendingSignaturesDescriptor` (table) | **self** | new |

### The consolidated widget
New file `components/dashboard/widgets/amtr-widget.tsx` exporting:

- A report map of the eight **table** reports → their descriptors:
  ```
  const AMTR_REPORTS = {
    currency: amtrDescriptor, overdue: amtrOverdueDescriptor,
    'due-soon': amtrDueSoonDescriptor, inspections: amtrInspectionsDescriptor,
    'my-training': amtrMyTrainingDescriptor, progress: amtrProgressDescriptor,
    compliance: amtrComplianceDescriptor, 'pending-signatures': amtrPendingSignaturesDescriptor,
  }  // 'kpis' is the one native (non-table) report
  ```
- `AmtrWidget(props: WidgetProps)` — reads `report = props.config.report ?? 'currency'`;
  if `'kpis'` renders `<AmtrKpisWidget />`; otherwise renders
  `<TableWidget descriptor={AMTR_REPORTS[report] ?? amtrDescriptor} config={props.config} onConfigChange={props.onConfigChange} />`.
  Unknown/missing `report` falls back to `amtrDescriptor` (Currency).
- `AmtrReportConfigForm({ config, onSave, onCancel })` — a Title text input + a
  **Report** `<select>` listing all nine labels above + Save/Cancel. **Save preserves
  existing config**: `onSave({ ...config, title: title.trim() || undefined, report })`
  — so a legacy Currency instance's saved `columns`/`filters` survive a config save,
  and are still honored at render by `TableWidget`.

### Four new report descriptors

Each is a `TableWidgetDescriptor` (`lib/dashboard/table/descriptors/`), reusing the
existing pure helpers (`buildDueItemRows`, `buildMemberRollup`, `complianceCounts`)
and the `/amtr/reports` fetch logic. New pure assembly logic goes in
`lib/amtr/report-rows.ts` (next to the existing builders) and is unit-tested.

1. **`amtr-my-training.tsx` → `amtrMyTrainingDescriptor`** (self). `useRows` fetches
   members + 1098 + RAT progress + the two catalogs (same as `amtr-due-items`),
   resolves the signed-in user via `createClient().auth.getUser()` → finds the member
   with `member.user_id === user.id`, then `buildDueItemRows(...)` filtered to that
   member and to `status ∈ {overdue, due_soon}`. Columns: Item, Type, Due, Status
   (badge), Days. Row deep-links to `/amtr/<myMemberId>`. Empty state when the user
   has no AMTR member record ("No training record for your account."). Summary:
   `N outstanding`.

2. **`amtr-progress.tsx` → `amtrProgressDescriptor`** (unit). `useRows` replicates the
   `/amtr/reports` rollup: fetch the JQS catalog (count `kind === 'item'` = required),
   each member's JQS progress (done), the formal catalog + formal progress, then
   `buildMemberRollup(...)` per member. Columns: Member, Grade, JQS % (mono), Formal %
   (mono), Overdue (count). Row deep-links to `/amtr/<memberId>`. Summary:
   `N members · avg JQS X%`. The per-member assembly (counts → `buildMemberRollup`)
   is a pure `buildProgressRows(...)` helper, unit-tested.

3. **`amtr-compliance.tsx` → `amtrComplianceDescriptor`** (unit). `useRows` fetches the
   recurring tasks (1098 + RAT catalogs) + all members' progress, and for each task
   runs `complianceCounts(items, applicableCount)`. Columns: Task, Frequency, Current
   (`done/total`), % (mono, right). No row deep-link (task-level); `footerHref: '/amtr/reports'`.
   Summary: `N tasks`. The per-task assembly is a pure `buildTaskComplianceRows(...)`
   helper, unit-tested.

4. **`amtr-pending-signatures.tsx` → `amtrPendingSignaturesDescriptor`** (self).
   `useRows` calls `fetchAmtrNotifications()` (already RLS-scoped to the signed-in
   user) and keeps `kind ∈ {signature_required, trainer_signature_required}` with
   `dismissed_at == null`. Columns: Item (from notification `body`), Awaiting (kind →
   "trainee" / "trainer or certifier" label), When (created date). Row deep-links to
   `/amtr/<member_id>` (the notification carries `member_id`). Empty state: "No
   signatures awaiting you." Summary: `N awaiting your signature`.

All four are gated by the consolidated widget's `amtr:view`. The two **self** reports
show only the signed-in user's own data and are therefore privacy-safe for every
AMTR-record holder.

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
| `components/dashboard/widgets/links-widget.tsx` | drag-and-drop reorder in `LinksConfigForm` |
| `components/dashboard/widgets/amtr-widget.tsx` (new) | `AmtrWidget` + `AmtrReportConfigForm` + report map |
| `lib/dashboard/table/descriptors/amtr-my-training.tsx` (new) | `amtrMyTrainingDescriptor` (self) |
| `lib/dashboard/table/descriptors/amtr-progress.tsx` (new) | `amtrProgressDescriptor` |
| `lib/dashboard/table/descriptors/amtr-compliance.tsx` (new) | `amtrComplianceDescriptor` |
| `lib/dashboard/table/descriptors/amtr-pending-signatures.tsx` (new) | `amtrPendingSignaturesDescriptor` (self) |
| `lib/amtr/report-rows.ts` | add pure `buildProgressRows` + `buildTaskComplianceRows` (+ types) |
| `tests/amtr-report-rows.test.ts` | unit tests for the two new builders |
| `lib/dashboard/widget-registry.ts` | add `hidden?: boolean` to `WidgetMeta`; filter `hidden` in the palette list |
| `lib/dashboard/registry.tsx` | consolidated `amtr` entry; `hidden: true` on the 4 AMTR keys; import the new widget |
| `components/dashboard/widgets/amtr-kpis-widget.tsx`, `last-check-widget.tsx`, `report-{discrepancies,trends,aging,lighting,daily}-widget.tsx`, `inspection-status-widget.tsx`, `feedback-widget.tsx` | center metric content |

No migration. The existing `amtr-due-items.tsx` / `amtr-inspections.tsx` descriptors,
the `amtr-kpis-widget` component, and the `buildDueItemRows` / `buildMemberRollup` /
`complianceCounts` pure helpers are reused by the consolidated widget and the new
descriptors. The `/amtr/reports` page is the reference for the progress + compliance
fetch shapes.

## Error handling

- Reorder and report-picker are pure local-state edits persisted through the existing
  config-save path (`onSave` → `onWidgetConfigChange` → `persist`); no new failure
  modes.
- `AmtrWidget` falls back to `amtrDescriptor` (Currency) for an unknown/missing
  `report` value, so a malformed config can never render nothing.

## Testing

- **Unit:** `moveItem(arr, from, to)` — moves up, moves down, first/last/out-of-range
  no-op, no input mutation. `buildProgressRows` — % math via `buildMemberRollup`,
  member ordering, zero-required guard. `buildTaskComplianceRows` — per-task
  current/total + %, RAT-exempt applicability, empty-task list.
- **Descriptor invariants:** extend `tests/dashboard-table-descriptors.test.ts` to
  cover the four new static descriptors (unique column keys, default columns).
- **Build gate:** `npx tsc --noEmit` + `npm run build` green; full `npx vitest run`.
- **Manual smoke (after deploy):** the 9 tiles read centered; Links rows drag-reorder
  and persist; the palette shows ONE "AMTR" entry; adding it + switching the Report
  dropdown renders all **nine** reports — including **My Training Record** (your own
  outstanding items) and **Pending Signatures** (your own) scoped to you, **Training
  Progress** and **Task Compliance** unit-wide; an existing Currency `amtr` widget and
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
