# Phase 4 — Configurable Native Widgets

**Date:** 2026-06-27
**Status:** Design — approved approach (A realized as C), pending spec review
**Builds on:** the customizable widget-grid dashboard (`dashboard_boards`, `lib/dashboard/*`,
`components/dashboard/*`) shipped 2026-06-27.

## 1. Goal

Make the dashboard's native list widgets *configurable* by the user who owns the board:
choose which **columns** show, **filter** the rows, **rename** the widget, and — for the two
widgets with no per-record module page (PPR, Personnel) — open a **row detail dialog** that can
also perform a record action. All five Phase 4 backlog items are delivered through **one shared,
declarative table framework** rather than per-widget code.

Mapping to the handoff's five items:

| # | Handoff item | Delivered by |
|---|---|---|
| 1 | User-selectable columns on PPR & Discrepancies | Column catalog + `TableConfigForm` (extended to all columnar widgets) |
| 2 | Filter Discrepancies by type at creation | Filter catalog (`enum-multi` type filter) — plus status & assigned-shop |
| 3 | Personnel widget matching airfield-status card detail | Personnel descriptor with the full `ContractorRow` field set |
| 4 | Row → single-record detail dialog for PPR & Personnel | `RowDetailDialog` + `detail`/`detail+actions` row behavior |
| 5 | Generic rename for native widgets | Title-only fallback config form on every native widget |

## 2. Scope

**In scope.** A generic configurable-table framework, applied to the eight genuinely *columnar*
widgets; a read-only/with-actions row detail dialog; two new offline-queue write handlers for the
detail-dialog actions; a title-only config form for every remaining native widget so rename works
everywhere.

**The eight columnar widgets:** `open-discrepancies`, `ppr-today`, `personnel`, `notams`, `ces`,
`events-log`, `waivers`, `daily-reviews`.

**Out of scope (left as-is).** Summary / count / non-tabular widgets get *only* the rename
fallback, not columns/filters: `inspection-status`, `last-check`, `shift-checklist`, `afm-toggles`,
`quick-actions`, `wildlife`, `users`, `infrastructure`, `field-conditions`, `feedback`, `amtr`,
`clock`. Already-configurable widgets (`links`, `embed`, `analytics`, `notes`) keep their existing
forms. **Persona / role default boards remain explicitly out of scope** (decided last session).

**Non-fabrication rule.** Every column/filter/detail field in this spec is a real field already
read by the widget's data module today (verified against `DiscrepancyRow`, `PprColumn` /
`column_values`, `ContractorRow`, `NotamRow`, `ActivityEntry`, `WaiverRow`, `DailyReviewRow`). No
invented fields, no invented permission keys.

## 3. Architecture (Approach A, realized as C)

One new declarative type drives one shared renderer, one shared config form, and one shared detail
dialog. New code lives in `lib/dashboard/table/` (pure logic + types) and
`components/dashboard/table/` (the three React pieces).

```
lib/dashboard/table/
  types.ts          ColumnDef, FilterDef, RowBehavior, DetailField, RowAction, TableWidgetDescriptor
  filtering.ts      applyFilters(rows, filterState, descriptor)         — pure
  columns.ts        resolveVisibleColumns(descriptor, config)           — pure
  config.ts         TableWidgetConfig type + normalizeTableConfig()      — pure (trust boundary)
  descriptors/
    discrepancies.tsx  ppr.tsx  personnel.tsx  notams.tsx
    ces.tsx  events-log.tsx  waivers.tsx  daily-reviews.tsx

components/dashboard/table/
  table-widget.tsx       generic renderer (summary header + table + footer link + row click)
  table-config-form.tsx  generic gear form (title + column checkboxes + filter controls)
  row-detail-dialog.tsx  read-only field display; actions in detail+actions mode
  title-config-form.tsx  the rename-only fallback form for non-columnar native widgets
```

### 3.1 The descriptor type

```ts
interface ColumnDef<Row> {
  key: string                                  // stable id persisted in config.columns
  label: string
  accessor: (row: Row) => unknown
  format?: (v: unknown, row: Row) => ReactNode // badges/colors allowed (status pills, age)
  defaultVisible?: boolean                     // shown when the user has not customized columns
  mono?: boolean                               // monospace cell (ids, times) — matches current style
}

interface FilterDef<Row> {
  key: string
  label: string
  kind: 'enum-multi' | 'status' | 'text'
  options?: { value: string; label: string }[] // required for enum-multi / status
  // For enum-multi/status, `selected` is string[]; empty = no filter (show all).
  // For text, `selected` is a string; '' = no filter.
  predicate: (row: Row, selected: string[] | string) => boolean
  defaultSelected?: string[] | string          // e.g. Personnel defaults to ['active']
}

type RowBehavior<Row> =
  | { mode: 'none' }
  | { mode: 'deeplink'; href: (row: Row) => string }
  | { mode: 'detail';         title: (row: Row) => string; fields: DetailField<Row>[] }
  | { mode: 'detail+actions'; title: (row: Row) => string; fields: DetailField<Row>[]
                            ; actions: RowAction<Row>[] }

interface DetailField<Row> {
  label: string
  value: (row: Row) => ReactNode
  hideWhenEmpty?: boolean
}

interface RowAction<Row> {
  key: string
  label: (row: Row) => string                  // dynamic ("Mark Departed" / "Clear Departure")
  permission: string                            // PERM key — button hidden if !has(perm)
  visible?: (row: Row) => boolean               // e.g. only show Depart if not already departed
  run: (row: Row, ctx: RowActionCtx) => Promise<void>  // enqueues via the offline write queue
}

interface SummaryStat { count: number; label: string; tone?: 'accent'|'warning'|'danger'|'muted' }

// A non-predicate config knob (single-select) — e.g. PPR date scope. Unlike a
// FilterDef (a pure client-side predicate over fetched rows), an extra is passed
// to useRows() and may change what is fetched. Rendered by TableConfigForm below
// the filters.
interface ExtraConfigDef {
  key: string
  label: string
  options: { value: string; label: string }[]
  default: string
}

interface TableWidgetDescriptor<Row> {
  // Columns are usually a static array. The PPR descriptor instead provides
  // useColumns() (base-defined columns fetched at runtime). The renderer/config
  // form always read columns through resolveVisibleColumns(), which calls
  // useColumns() when present and otherwise uses the static `columns` array.
  columns?: ColumnDef<Row>[]
  useColumns?: () => ColumnDef<Row>[]
  filters: FilterDef<Row>[]
  extras?: ExtraConfigDef[]                       // non-predicate single-select knobs (PPR dateScope)
  row: RowBehavior<Row>
  footerHref?: string                            // "View all →" target (the module page)
  newHref?: string                               // optional "+ New" link (discrepancies/waivers)
  summary?: (rows: Row[]) => SummaryStat[]        // reproduces today's count / "N expiring" headers
  useRows: (config: TableWidgetConfig) => { rows: Row[]; loading: boolean } // existing fetch, lifted
}
```

`useRows` is the existing data-fetch logic, moved verbatim out of each widget body into its
descriptor. It now receives the resolved `config` so a descriptor can vary the fetch by an `extras`
value (PPR date scope) — every other descriptor ignores the argument. RLS, base scoping, and
module/permission gating are unchanged: the descriptor fetches through the same `lib/supabase/*`
function the widget uses today. Exactly one of `columns` / `useColumns` is provided per descriptor.

### 3.2 Registry integration

`WidgetKind` gains `'table'`. `registry.tsx` maps a table widget to the shared components instead of
a hand-written component:

```ts
function tableWidget(meta, descriptor): WidgetDef {
  return { ...meta, kind: 'table',
    Component: () => <TableWidget descriptor={descriptor} configKey={meta.type} />,
    ConfigForm: (p) => <TableConfigForm {...p} descriptor={descriptor} /> }
}
```

`TableWidget` receives `config` (already passed by `widget-grid.tsx`) and reads
`config.columns` / `config.filters`. The existing title plumbing (`widget-grid.tsx` already prefers
`config.title`) needs **no change** — it already renders a custom title when present.

Non-columnar native widgets that currently have **no** `ConfigForm` get `ConfigForm:
TitleConfigForm` so the gear appears and rename works (item 5). Their `Component` is untouched.

## 4. Stored config schema & back-compat

The widget `config` JSON (inside the `dashboard_boards.layout` array) gains optional keys. **No DB
migration** — `layout` is already untyped JSONB and `validateLayout` is tolerant.

```ts
interface TableWidgetConfig {
  title?: string                         // existing — custom widget name
  columns?: string[]                     // ColumnDef.key[]; undefined ⇒ descriptor defaults
  filters?: Record<string, string[] | string> // FilterDef.key → selection; undefined ⇒ defaults
  extras?: Record<string, string>        // ExtraConfigDef.key → value; undefined ⇒ ExtraConfigDef.default
}
```

`normalizeTableConfig(raw, descriptor)` is the trust boundary (mirrors `validateLayout`): it drops
unknown column keys, drops filter/extra keys not in the descriptor, coerces malformed selections to
the filter default and unknown extra values to the `ExtraConfigDef.default`, and — critically —
**back-compat**: a widget saved before Phase 4 has no `columns`/`filters`/`extras`, so it renders the
descriptor defaults, i.e. it looks like it does today. Existing boards keep working untouched.

## 5. Per-widget descriptors

All fields below are real and already displayed/fetched today. Columns marked **(default)** are the
initial visible set (≈ what each widget shows now), so an un-customized widget is visually ~stable.

### 5.1 Discrepancies (`open-discrepancies`) — `DiscrepancyRow`
- **Columns:** display_id (mono), title **(default)**, type (badge via `DISCREPANCY_TYPES`),
  current_status (badge) **(default)**, assigned_shop **(default)**, age from created_at (mono)
  **(default)**, location_text, work_order_number, reporter (`formatReporter`),
  estimated_completion_date.
- **Filters:** `type` (enum-multi over the 11 `DISCREPANCY_TYPES`), `status` (open / completed /
  cancelled — default `['open']`, preserving current behavior), `assigned_shop` (enum-multi over the
  distinct shops present in the fetched rows).
- **Row:** `deeplink` → `/discrepancies/${id}` (unchanged).
- **footerHref** `/discrepancies`, **newHref** `/discrepancies/new`.

### 5.2 PPR (`ppr-today`) — `PprEntry` (+ per-base `PprColumn`)
- **Dynamic columns:** PPR columns are base-defined. The descriptor's `columns` are built at runtime
  from `fetchPprColumns(baseId)` filtered to `show_on_log`, each reading `column_values[name]`, **plus**
  system columns: ppr_number (mono) **(default)**, arrival_date **(default)**, status (badge)
  **(default)**, requester_name **(default)**, requester_email, requester_phone, departed_at, notes.
  (Because the column catalog is dynamic, the PPR descriptor provides `useColumns()` rather than a
  static `columns` array, per §3.1. `resolveVisibleColumns` calls it, so this is an interface detail,
  not a special case in the renderer.)
- **Filters:** `status` (PPR statuses, enum-multi — pure client-side predicate).
- **Extra (non-predicate):** `dateScope` single-select — `today` (default — preserves "PPR Today") /
  `upcoming-7d` / `all`. Read by `useRows(config)` to choose the `fetchPprEntriesForDate` range; not a
  predicate filter.
- **Row:** `detail+actions`.
  - **Detail fields:** ppr_number, status, arrival_date, requester_name/email/phone, every
    `show_on_form`/`show_on_log` base column value, notes, departed_at.
  - **Action `depart`:** label `Mark Departed` (or `Clear Departure` if `departed_at` set),
    permission `PERM.PPR_WRITE`, runs via the new `ppr_depart` queue op (§6).
- **footerHref** `/ppr`.

### 5.3 Personnel (`personnel`) — `ContractorRow`
- **Columns:** company_name **(default)**, contact_name, location **(default)**, work_description,
  status (badge), start_date, end_date, radio_number (mono), flag_number (mono), callsign (mono),
  contact_phone. (= the airfield-status personnel card's field set, item 3.)
- **Filters:** `status` (active / completed — default `['active']`, preserving current behavior).
- **Row:** `detail+actions`.
  - **Detail fields:** all of the above.
  - **Action `complete`:** label `Mark Completed`, visible only when `status === 'active'`,
    permission `PERM.CONTRACTORS_WRITE`, runs via the new `contractor_status_update` queue op (§6).
- **footerHref** `/contractors`.

### 5.4 NOTAMs (`notams`) — `NotamRow` (FAA feed via `/api/notams/sync`)
- **Columns:** notam_number (mono) **(default)**, full_text/title **(default)**, source (badge),
  effective_start, effective_end **(default)**.
- **Filters:** `source` (faa / local), `expiring` (status: `expiring-24h` predicate over
  `effective_end`).
- **Row:** `deeplink` → `/notams/${id}`. **summary:** active count + "N expiring" (current header).
- **footerHref** `/notams`. `useRows` keeps the existing 60s throttle cache.

### 5.5 CES Work Orders (`ces`) — `DiscrepancyRow` (CES-status subset)
- **Columns:** title **(default)**, current_status (CES label/badge) **(default)**, assigned_shop
  **(default)**, age **(default)**, display_id (mono), work_order_number, estimated_completion_date.
- **Filters:** `current_status` (the four CES statuses), `assigned_shop` (enum-multi).
- **Row:** `deeplink` → `/discrepancies/${id}`. `useRows` keeps the `CES_STATUSES` pre-filter.
- **footerHref** `/ces`.

### 5.6 Events Log (`events-log`) — `ActivityEntry`
- **Columns:** label (`buildDetailsString`/`formatAction`) **(default)**, operating initials (mono),
  zulu timestamp (mono) **(default)**, entity_type, action.
- **Filters:** `entity_type` (enum-multi over distinct entity types present).
- **Row:** `detail` (read-only — Events Log has no per-record page). Detail fields: action,
  entity_type, entity_display_id, OI, full details string, zulu timestamp. (No actions — append-only
  log.)
- **footerHref** `/activity`. `useRows` keeps the `EXCLUDE_TYPES` filter.

### 5.7 Waivers (`waivers`) — `WaiverRow`
- **Columns:** waiver_number (mono) **(default)**, classification **(default)**, status (badge)
  **(default)**, expiration_date (+ days-to-expiry) **(default)**.
- **Filters:** `status` (active/approved/draft/pending/expired/cancelled — default active+approved),
  `classification` (enum-multi), `expiring` (status: ≤90d predicate).
- **Row:** `deeplink` → `/waivers/${id}`. **summary:** active count + "N expiring".
- **footerHref** `/waivers`, **newHref** `/waivers/new`.

### 5.8 Daily Reviews (`daily-reviews`) — `DailyReviewRow`
- **Columns:** review_date (mono) **(default)**, pending-slot count **(default)**, certified state.
- **Filters:** `state` (pending / certified — default pending, preserving current behavior).
- **Row:** `deeplink` → `/daily-reviews` (no per-id page). **summary:** pending count.
- **footerHref** `/daily-reviews`.

## 6. Row detail dialog + quick actions

`RowDetailDialog` reuses the existing `.modal-overlay` / `.card` pattern from
`widget-config-modal.tsx`. It renders `row.title(row)` and a definition list of `fields`. In
`detail+actions` mode it renders the `actions` whose `permission` the user holds and whose
`visible(row)` is true; clicking one calls `action.run(row, ctx)` then closes.

**Both actions route through the offline write queue** (memory rule: new write surfaces never call
direct CRUD). Two new ops are added to `lib/sync/types.ts` (`WriteType`) and handlers registered in
`lib/sync/handlers.ts` `registerAllHandlers`, following the `dashboard_board_update` precedent:

| Op | Payload | Handler calls | Terminal-error routing |
|---|---|---|---|
| `ppr_depart` | `{ entryId, baseId, depart: boolean }` | `markPprDeparted` / `clearPprDeparted` | RLS/PermissionError → `throwForStructuredError` (terminal, no infinite retry — the lesson from `61d86e7b`) |
| `contractor_status_update` | `{ id, baseId, status: 'completed' }` | `updateContractor(id, { status })` | same |

`RowActionCtx` exposes the queue enqueue fn (from the existing sync provider) + a toast on
success/terminal failure. After enqueue, the dialog optimistically updates local rows (the
descriptor's `useRows` state) so the action reflects immediately, consistent with other
offline-queued surfaces.

## 7. Generic rename for non-columnar widgets (item 5)

`TitleConfigForm` is a one-field form: a title input that saves `{ ...config, title: trimmed ||
undefined }`. It is attached as the `ConfigForm` to every native widget that has neither a table
descriptor nor an existing config form. Because `widget-frame`/`widget-grid` already show the gear
when `def.ConfigForm` exists and already prefer `config.title`, this lights up rename everywhere with
no renderer change. Widgets with richer forms (links/embed/analytics/notes/all table widgets) are
untouched — their forms already include a title field or, for table widgets, `TableConfigForm` does.

## 8. Gating, RLS, permissions

- **Adding** a widget is already permission/module-gated by `listAvailableWidgets`; unchanged.
- **Data** is RLS-scoped because descriptors fetch through the same modules; unchanged.
- **Columns/filters** are pure presentation over already-authorized rows — no new data exposure.
- **Actions** are gated twice: the button is hidden unless `has(action.permission)`, and the
  underlying RPC/table RLS enforces it server-side regardless. No new permission keys are introduced.

## 9. Testing

Pure logic gets unit tests (vitest), mirroring the existing `dashboard-*` suites:
- `dashboard-table-filtering` — `applyFilters`: empty selection = passthrough; enum-multi OR
  semantics; status default; text contains; multiple filters AND across keys.
- `dashboard-table-columns` — `resolveVisibleColumns`: defaults when unconfigured; honors saved
  order/subset; drops unknown keys.
- `dashboard-table-config` — `normalizeTableConfig`: pre-Phase-4 config (no columns/filters) →
  descriptor defaults (back-compat regression guard); malformed selection coerced to default;
  unknown keys dropped.
- `dashboard-table-descriptors` — each descriptor: exactly one of `columns`/`useColumns` is set;
  every `ColumnDef.key` unique; `defaultVisible` set is non-empty; every `FilterDef.option.value` and
  `ExtraConfigDef.default` is real; `detail+actions` actions reference a valid `PERM` key.
- `sync-handlers` (extend existing) — `ppr_depart` / `contractor_status_update` enqueue shape and
  terminal-vs-retriable error routing.

Build gate per memory: `npx tsc --noEmit` **and** `npm run build` RC 0 (build green, not just
vitest) before any commit; tsc ES-target note — use `Array.from` over `Map`/`Set` iteration.

## 10. Phasing (for the implementation plan)

1. **Framework** — `lib/dashboard/table/*` (types, filtering, columns, config) + the three React
   components + `TitleConfigForm` + registry `kind:'table'` wiring + unit tests. No widget converted
   yet; rename fallback shipped to all native widgets.
2. **Flagship three** — convert `open-discrepancies`, `ppr-today`, `personnel` to descriptors;
   build `RowDetailDialog` actions + the two queue handlers. This proves columns, all filter kinds,
   dynamic (PPR) columns, and `detail+actions`.
3. **Remaining five** — `notams`, `ces`, `events-log`, `waivers`, `daily-reviews` descriptors
   (deeplink/read-only detail; no new write paths).

Each phase ends build-green and is independently shippable; the dashboard keeps working throughout
because unconverted widgets are unchanged and converted ones are back-compatible (§4).

## 11. Risks / notes

- **Visual parity.** Converting bespoke widgets to a generic table can lose polish (NOTAM 3-line
  text clamp, "N expiring" badges, count headers). Mitigated by `summary`, badge `format`, and
  `mono` column flags so defaults reproduce today's look; visually diff each on the preview before
  considering a widget done.
- **PPR dynamic columns** are the one non-uniform descriptor (runtime column catalog). Isolated to
  the PPR descriptor; the renderer/config form stay generic.
- **No live smoke test yet** — the whole dashboard is still pre-promotion. Phase 4 should be
  exercised on the Vercel preview, not assumed from tsc/vitest/build alone.
- **recharts/RGL** untouched by Phase 4.

## 12. Files touched (anticipated)

**New:** `lib/dashboard/table/{types,filtering,columns,config}.ts`,
`lib/dashboard/table/descriptors/*.tsx` (8), `components/dashboard/table/{table-widget,
table-config-form,row-detail-dialog,title-config-form}.tsx`, plus the five new test files.

**Modified:** `lib/dashboard/registry.tsx` (table wiring + rename fallback),
`lib/dashboard/widget-registry.ts` (`WidgetKind += 'table'`), `lib/sync/types.ts` +
`lib/sync/handlers.ts` (two ops), and deletion/thinning of the eight converted widget components in
`components/dashboard/widgets/` as their fetch logic moves into descriptors.

**No DB migration.**
