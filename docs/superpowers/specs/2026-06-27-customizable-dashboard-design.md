# Customizable Dashboard — Design Spec

**Date:** 2026-06-27
**Status:** Draft for review
**Author:** Brainstorming session (csproctor88)

---

## 1. Summary

Replace the current fixed dashboard (`app/(app)/dashboard/page.tsx`) with a
**customizable widget grid**. Users arrange draggable/resizable widgets to focus
on what their role actually needs. Three widget kinds at launch — **native**
(Glidepath data surfaces), **web embed** (sandboxed iframe), and **analytics**
(guided query-builder charts) — plus a **links** widget (a list of bookmarks
that open in a new tab). Layouts persist per user; admins can publish
**shared/base boards** and set **role default templates** new users inherit.

Delivered in three independently-shippable phases.

### Decisions locked during brainstorming

| Question | Decision |
|---|---|
| Relationship to current dashboard | **Full widget-grid replace** — current surfaces become native widgets |
| Personalization scope | **Per-user boards + base-shared boards** + admin role-default templates |
| Web embeds | **Arbitrary URLs.** Any user on their own board; admin-only on shared boards. Plus a **links widget** (open-in-new-tab) for sites that refuse framing |
| Analytics depth | **Guided builder over curated datasets** (no raw SQL) |
| Query model | Per-module datasets → field picker + filters + group-by + aggregation + chart |
| Mobile | **Responsive reflow** — free grid on desktop, single ordered column on mobile |
| Screen usage | **Full-bleed** — the dashboard opts out of the standard 1400px `.app-content` cap and uses the entire content width (sidebar → edge). Every other page keeps the cap. |
| Delivery | **Phased, framework first** (P1 framework → P2 embeds/sharing → P3 analytics) |

### Non-goals (YAGNI)

- Raw SQL editor (the guided builder over datasets is the ceiling for now).
- Separate independently-arranged mobile layouts (one layout reflows).
- Cross-base or fleet-wide boards (boards are always scoped to one base).
- Real-time collaborative editing of a shared board (last-write-wins is fine).

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  /dashboard  (DashboardPage)                                 │
│  ┌─────────────┐   board switcher · edit-mode toggle         │
│  │ BoardBar    │   (personal | shared boards)                │
│  └─────────────┘                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ WidgetGrid  (react-grid-layout wrapper)                  │ │
│  │   renders layout JSONB → <WidgetFrame> per item          │ │
│  │   ┌────────┐ ┌────────┐ ┌────────────┐                   │ │
│  │   │ native │ │ embed  │ │ analytics  │  …                │ │
│  │   └────────┘ └────────┘ └────────────┘                   │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────┐  (edit mode only)                           │
│  │ WidgetPalette│  add-widget drawer, grouped by kind         │
│  └─────────────┘                                             │
└─────────────────────────────────────────────────────────────┘
        │ reads/writes (offline-queued)
        ▼
  dashboard_boards  (Supabase + RLS)
```

**Key idea:** widgets are *config only*. Each widget fetches its own data
through the existing RLS-protected CRUD modules (`lib/supabase/*`) and the same
permission/module gates already used elsewhere. The board row stores a `layout`
JSONB array describing which widgets exist, their config, and their grid
position. There is **no per-widget table** — nothing queries widgets
individually, so embedding them as JSONB keeps saves atomic and RLS simple.

### Widget registry

A single registry maps a widget `type` string to its definition. Native widgets
declare the permission and module gate that govern visibility — identical to the
checks already in `dashboard/page.tsx` — so a widget can **never** surface data
the user cannot otherwise reach.

```ts
// lib/dashboard/widget-registry.ts
export interface WidgetDef {
  type: string                 // 'inspection-status', 'open-discrepancies', …
  kind: 'native' | 'links' | 'embed' | 'analytics'
  title: string
  description: string
  icon: LucideIcon
  defaultSize: { w: number; h: number }
  minSize: { w: number; h: number }
  permission?: string          // PERM key — hidden if user lacks it
  moduleHref?: string          // module gate via isModuleEnabled()
  Component: React.ComponentType<WidgetProps>
  ConfigForm?: React.ComponentType<WidgetConfigProps>  // null = no config
}

export interface WidgetInstance {
  i: string                    // stable id (crypto.randomUUID())
  type: string
  config: Record<string, unknown>
  x: number; y: number; w: number; h: number
}
```

`WidgetGrid` filters instances against `permission`/`moduleHref` at render time
(reusing `usePermissions().has` and `isModuleEnabled`) and silently drops any a
user can't see — so a shared board with a gated widget degrades gracefully per
viewer.

---

## 3. Data model

### 3.1 Table

```sql
-- migration: <date>01_dashboard_boards.sql
create table public.dashboard_boards (
  id          uuid primary key default gen_random_uuid(),
  base_id     uuid not null references public.bases(id) on delete cascade,
  owner_id    uuid references public.profiles(id) on delete cascade,  -- NULL = shared/base board
  scope       text not null check (scope in ('personal','shared')),
  name        text not null,
  is_default  boolean not null default false,   -- the user's (or base's) landing board
  role_template text,                            -- NULL, or a role key for admin-set defaults
  layout      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index dashboard_boards_owner_idx on public.dashboard_boards (base_id, owner_id);
create index dashboard_boards_shared_idx on public.dashboard_boards (base_id) where owner_id is null;
-- one default personal board per user per base
create unique index dashboard_boards_one_default_personal
  on public.dashboard_boards (base_id, owner_id) where is_default and owner_id is not null;
```

`layout` shape (validated client-side; stored verbatim):

```jsonc
[
  { "i": "a1b2", "type": "inspection-status", "config": {}, "x":0, "y":0, "w":4, "h":2 },
  { "i": "c3d4", "type": "links", "config": { "title": "AM References",
      "links": [ { "label": "FAA NOTAM Search", "url": "https://..." } ] },
      "x":4, "y":0, "w":4, "h":3 },
  { "i": "e5f6", "type": "embed", "config": { "title": "Base WX", "url": "https://..." },
      "x":0, "y":2, "w":8, "h":4 },
  { "i": "g7h8", "type": "analytics", "config": { /* see §6 */ }, "x":8, "y":0, "w":4, "h":3 }
]
```

### 3.2 RLS policies

Uses the standard matrix helpers (`user_has_base_access`, `user_has_permission`)
— never the dropped helpers.

```sql
alter table public.dashboard_boards enable row level security;

-- READ: own personal boards + any shared board at a base you can access
create policy dashboard_boards_select on public.dashboard_boards
  for select using (
    user_has_base_access(auth.uid(), base_id)
    and (owner_id = auth.uid() or owner_id is null)
  );

-- WRITE own personal boards
create policy dashboard_boards_personal_write on public.dashboard_boards
  for all using (
    user_has_base_access(auth.uid(), base_id) and owner_id = auth.uid()
  ) with check (
    user_has_base_access(auth.uid(), base_id) and owner_id = auth.uid()
  );

-- WRITE shared/template boards requires the publish permission
create policy dashboard_boards_shared_write on public.dashboard_boards
  for all using (
    user_has_base_access(auth.uid(), base_id) and owner_id is null
    and user_has_permission(auth.uid(), 'dashboard:publish-shared')
  ) with check (
    user_has_base_access(auth.uid(), base_id) and owner_id is null
    and user_has_permission(auth.uid(), 'dashboard:publish-shared')
  );
```

### 3.3 CRUD module + offline queue

`lib/supabase/dashboard-boards.ts` — `fetchBoards`, `createBoard`,
`updateBoardLayout`, `deleteBoard`, `publishSharedBoard`. **Layout saves are a
new write surface and MUST route through the offline write queue** (register a
`dashboard_board_update` handler and wire the caller — a registered handler that
nothing calls is not "wired"). Saves are debounced (~800ms after drag/resize
settle) and toast on error (no silent `default_value` failures).

---

## 4. Permissions

New matrix keys (added via a `role_permissions` seed migration, granted to the
roles below by default; tunable per base via overrides):

| Key | Default grantees | Governs |
|---|---|---|
| `dashboard:publish-shared` | base_admin, airfield_manager | Create/edit shared & role-template boards |
| `dashboard:manage-templates` | base_admin | Assign role-default templates |

Embedding a web/links widget on a **personal** board needs no special
permission. Embedding on a **shared** board is covered by
`dashboard:publish-shared` (you're editing a shared board to begin with).

---

## 5. Widget catalog

### 5.1 Phase 1 — native widgets (port of today's dashboard)

Each reuses existing data modules; permission/module gate in parentheses.

| `type` | Surface | Source |
|---|---|---|
| `inspection-status` | Today's airfield + lighting inspection | `fetchInspections` + `pickTodaysInspection` |
| `last-check` | Last completed check (type @ Zulu) | `airfield_checks` query (already in page) |
| `open-discrepancies` | Count + compact list, links to `/discrepancies` | `lib/supabase/discrepancies` (`discrepancies:read`) |
| `personnel-on-airfield` | Active personnel now + quick-add | `lib/supabase/contractors` (`/contractors`) |
| `shift-checklist` | Progress ring + open dialog | `lib/supabase/shift-checklist` (`/shift-checklist`) |
| `notams` | Active NOTAMs count/list | `use-expiring-notams` / notams feed (`/notams`) |
| `ppr-today` | Arrivals due today | `lib/supabase/ppr` (`/ppr`) |
| `afm-toggles` | Out-of-Office + Close-Airfield controls | `useDashboard` (`airfield_status:write`) |
| `quick-actions` | Configurable tile launcher (user picks which module tiles) | static + `isModuleEnabled` |

### 5.2 Phase 2 — links + embed

- **`links`** — config `{ title, links: [{ label, url }] }`. Renders a tidy list;
  each opens in a **new tab** (`target="_blank" rel="noopener noreferrer"`). The
  safe, always-works companion to embeds — recommended for `.mil`/external sites
  that refuse framing. No permission gate on personal boards.
- **`embed`** — config `{ title, url }`. Sandboxed iframe
  (`sandbox="allow-scripts allow-same-origin allow-forms allow-popups"`),
  lazy-loaded. **Frame-refusal detection:** on load-timeout / `X-Frame-Options`
  failure, render a fallback card — *"This site refuses to be embedded"* + an
  "Open in new tab" button (degrades to link behavior). Requires widening CSP
  `frame-src` (currently report-only; gov-network constraints deprioritized per
  the brainstorming decision). Any user on personal boards; `publish-shared` for
  shared boards.

### 5.3 Phase 3 — analytics (see §6)

---

## 5b. Widget look & interaction

Native widgets are **compact live windows into a module**, not launchers. A
discrepancy widget renders the actual open discrepancies inline (RLS-scoped to
the user's base) — no need to visit `/discrepancies`. Widgets are resizable, so
the **same widget shows more or less depending on its size**.

Discrepancies widget — small (glanceable stat) vs wider (live list):

```
┌ OPEN DISCREPANCIES ┐    ┌ OPEN DISCREPANCIES                          12 ┐
│        12          │    │ ────────────────────────────────────────────── │
│  ▲ 3 opened today  │    │ 🔴 RWY 14 edge light out      CES · open    2d │ → /discrepancies/[id]
│  ──────────────    │    │ 🟠 Faded hold-line TWY C      AM  · open    5d │
│  2 critical · 4 hi │    │ 🟠 Cracked panel Apron 2      CES · in-work 8d │
└────────────────────┘    │ 🟡 Sign panel dim TWY D       AM  · open   12d │
                          │ ──────────────────────────────────────────────│
                          │ + 7 more     [ + New Discrepancy ]    View  →  │
                          └────────────────────────────────────────────────┘
```

Interaction rules for native widgets:
- **Live data**, same source/query as the module page, summarized newest-first.
- **Rows deep-link** to the module's detail route.
- **Inline quick actions** where natural (e.g. *+ New Discrepancy*, personnel
  *+ Add*, shift-checklist opens its dialog) so common actions don't require
  leaving the dashboard.
- Color dots / status pills **mirror each module's existing conventions** and use
  theme tokens — a widget should read as a compact slice of its module.
- A widget the user lacks permission/module access for is **never offered in the
  palette** and is dropped from any shared board it appears on.

Edit mode overlays drag handles, resize corners, a per-widget ✕, and a
**+ Add Widget** palette grouped by kind (Native · Links · Embed · Analytics),
each entry showing a live preview.

## 6. Analytics: guided builder over datasets

### 6.1 Dataset registry

A **dataset** is a curated, RLS-respecting query surface over one module. The
builder never touches raw SQL — it composes a parameterized Supabase query the
dataset defines.

```ts
// lib/dashboard/datasets/index.ts
export interface Dataset {
  key: string                          // 'discrepancies', 'inspections', …
  label: string
  permission: string                   // gate — hidden if the user lacks it
  moduleHref?: string
  dimensions: Dimension[]              // group-by fields (status, type, shop, day…)
  measures: Measure[]                  // count, avg(days_to_close), pass_rate…
  filters: FilterDef[]                 // selectable WHERE constraints
  timeField?: string                   // enables the time-range control
  run(spec: QuerySpec, baseId: string): Promise<QueryResult>  // builds the query
}

export interface QuerySpec {
  measure: string
  groupBy?: string                     // a dimension key (omit → single number)
  filters: { field: string; op: string; value: unknown }[]
  timeRange?: { field: string; from: string; to: string } | { preset: '7d'|'30d'|'90d'|'ytd' }
  chart: 'number' | 'line' | 'bar' | 'donut' | 'table'
}
```

`run()` builds the query with the Supabase client (RLS enforced by the user's
session) — e.g. `.select(...).eq('base_id', baseId).gte(timeField, from)` with
client-side aggregation, or a SECURITY DEFINER RPC for heavier group-bys where
needed. **Expanding "available analytics" = adding a Dataset** — cheap, and every
path is vetted, so there's no injection/exposure surface.

### 6.2 Launch datasets

Seed from the existing analytics/report builders (`lib/reports/*`): `discrepancies`,
`inspections`, `checks`, `wildlife`, `ppr`, `feedback`, `personnel`. Reuse the
metric logic already in `lib/reports/analytics-data.ts` and the per-report
data-builders rather than reinventing aggregations.

### 6.3 Worked example

> *"Open discrepancies by assigned shop, last 30 days, as a bar chart."*

```jsonc
{ "dataset": "discrepancies",
  "spec": {
    "measure": "count",
    "groupBy": "assigned_shop",
    "filters": [ { "field": "current_status", "op": "neq", "value": "closed" } ],
    "timeRange": { "preset": "30d" },
    "chart": "bar"
  },
  "title": "Open Discrepancies by Shop" }
```

`discrepancies.run()` →
`from('discrepancies').select('assigned_shop, created_at, current_status').eq('base_id', baseId).neq('current_status','closed').gte('created_at', <30d>)`
→ group + count client-side → `[{ assigned_shop, count }]` → bar chart.

### 6.4 Builder UI

A modal: **Dataset → Measure → Group by → Filters → Time range → Chart type**,
with a live preview pane. Charts rendered with a lightweight lib (e.g.
`recharts`, or extend whatever the `/reports` module already uses — confirm
during P3). Existing `/reports` views (daily ops, trends, aging, lighting) can
also be pinned as a `report-view` analytics widget.

---

## 7. Responsive / mobile

`react-grid-layout`'s `ResponsiveGridLayout` with breakpoints `lg`/`md`/`sm`.
One stored layout (the `lg` arrangement); `sm` auto-reflows to a single ordered
column. On mobile, drag-to-reorder only (no resize). Edit mode is available on
all breakpoints but resize handles hide under `sm`. Honors theme-aware tokens
(`[data-theme]` CSS vars), never raw Tailwind greys.

**Full-bleed:** the dashboard route opts out of the standard 1400px
`.app-content` cap so the grid uses the entire content width (sidebar edge →
viewport edge, minus `page-container` padding). Implement via a scoped class on
the dashboard page (e.g. `.app-content--full` overriding `max-width: none`) so
**only** `/dashboard` is full-bleed; all other routes keep the 1400px cap.
Collapsing the sidebar widens the grid further; the responsive grid reflows to
fill whatever width is available, so wide ops monitors and wall displays are
fully used.

---

## 8. Phasing & file changes

### Phase 1 — Framework
- **New:** migration `dashboard_boards` + RLS; `lib/supabase/dashboard-boards.ts`;
  offline-queue handler `dashboard_board_update`; `lib/dashboard/widget-registry.ts`;
  `components/dashboard/widget-grid.tsx`, `widget-frame.tsx`, `widget-palette.tsx`,
  `board-bar.tsx`; native widget components under `components/dashboard/widgets/`;
  `tests/dashboard-layout.test.ts` (layout validation/migration), widget-registry test.
- **Modified:** `app/(app)/dashboard/page.tsx` → thin host around `WidgetGrid`;
  extract today's surfaces into widgets; add `npm` dep `react-grid-layout`.
- **Dep:** `react-grid-layout` (+ `react-resizable`).

### Phase 2 — Embeds & sharing
- **New:** `links` + `embed` widgets; shared-board + role-template UI in
  `board-bar`; permission keys `dashboard:publish-shared`,
  `dashboard:manage-templates` (seed migration); CSP `frame-src` widening in
  `next.config`/middleware; new-user template inheritance on first dashboard load.
- **Tests:** RLS regression (personal vs shared write), embed-fallback render.

### Phase 3 — Analytics
- **New:** `lib/dashboard/datasets/*` registry + launch datasets; analytics
  widget + builder modal; chart components; `report-view` pin widget.
- **Tests:** per-dataset `run()` shape tests; builder spec → query mapping.

---

## 9. Persona default boards (role templates, P2)

| Persona | Default widgets |
|---|---|
| **AFM at the desk** | inspection-status, last-check, open-discrepancies, personnel-on-airfield, notams, ppr-today, shift-checklist, afm-toggles, embed(Weather/ATIS) |
| **Airfield Manager** | analytics(aging discrepancies), analytics(inspection-completion trend), waivers-expiring, ACSI/compliance-due, daily-review queue, feedback rating, analytics(wildlife strike trend) |
| **NAMT** | AMTR training progress, members-due-for-eval, completion rates, expiring certifications |
| **NAMO** | shift coverage, daily-review queue, discrepancy aging, checks-per-shift, personnel-on-airfield |

(Widgets beyond the P1 native set — waivers-expiring, compliance-due, AMTR
progress, etc. — are added incrementally; templates reference whatever exists at
the time and degrade gracefully.)

---

## 10. Risks & honest flags

- **Iframe refusal is unavoidable.** Many `.mil`/external sites send
  `X-Frame-Options: DENY` / restrictive `frame-ancestors`; no client-side
  workaround. Mitigation: the `embed` fallback card + the `links` widget as the
  always-works alternative.
- **CSP `frame-src` widening** broadens the embedding surface; acceptable per the
  brainstorming decision, but worth a security note before enforcing CSP later.
- **Shared-board last-write-wins** — two admins editing the same shared board can
  clobber each other. Acceptable for launch; `updated_at` conflict warning is a
  possible later refinement.
- **Layout schema evolution** — store a `version` alongside layout (or infer from
  shape) so future widget-config changes can be migrated; unknown `type`s render
  a "widget unavailable" placeholder rather than crashing the grid.
- **Perf** — many data-fetching widgets on one board multiply queries; widgets
  should share the installation context and respect the polling defaults
  (getSession + ≥60s + visibility-gated). Consider a per-board fetch coordinator
  if query volume becomes an issue.

---

## 11. Testing strategy

- Layout (de)serialization + unknown-widget fallback (pure unit).
- Widget-registry permission/module filtering (pure unit).
- Dataset `run()` spec→query mapping per dataset (unit, mocked client).
- RLS regression: personal-write vs shared-write authorization (named
  audit-invariant guard test).
- Offline-queue: `dashboard_board_update` handler registered **and** wired.
- Gate all commits on `npm run build` RC=0 (vitest green ≠ build green).
```
