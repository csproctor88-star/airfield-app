# Discrepancy Report Widgets — Full-View Parity (#35) — Design

**Date:** 2026-06-30
**Module:** Dashboard — the three discrepancy report widgets
**Status:** Draft for review

## Goal

Let users view the **Discrepancy Trends**, **Aging Discrepancies**, and **Discrepancy
Report** analytics directly on the dashboard, matching the Reports & Analytics module —
instead of the current summary-tile widgets that only show a few scalars. Upgrade the
three existing widgets in place (decided), each rendering the full report view with its
own options.

## Background (from exploration)

- The three report **data builders are reusable pure async functions** and already run
  inside the current widgets:
  - `fetchDiscrepancyTrendsData(period, baseId) → DiscrepancyTrendsData` (cheap)
  - `fetchAgingDiscrepanciesData(baseId) → AgingDiscrepanciesData` (cheap)
  - `fetchOpenDiscrepanciesData(includeNotes, baseId, filters) → OpenDiscrepanciesData`
    (**downloads photos + generates per-discrepancy map images, ungated** — slow)
- All report **rendering is inline in the page files** (`app/(app)/reports/{trends,aging,
  discrepancies}/page.tsx`) — nothing is a reusable component.
- The current widgets (`report-trends-widget`, `report-aging-widget`,
  `report-discrepancies-widget`) are tiny KPI tiles with `TitleConfigForm` only.

## Architecture

### 1. Shared view components (`components/reports/`)

Extract each report page's presentational body into a pure presentational component that
takes the builder's already-fetched data shape. **No data fetching inside** — the widget
(and page) fetches and passes `data`.

| Component | Props | Renders |
|---|---|---|
| `TrendsReportView` | `{ data: DiscrepancyTrendsData }` | 4 KPI tiles (Opened/Closed/Net/Avg Days), the opened-vs-closed horizontal bar chart, Top Areas + Top Types badge grids |
| `AgingReportView` | `{ data: AgingDiscrepanciesData }` | KPI row (Total/Avg Days/Oldest), interactive By-Tier + By-Shop badge grids (internal `activeTier`/`activeShop` cross-filter state), and the per-tier discrepancy list (rows deep-link to `/discrepancies/[id]`) |
| `OpenReportView` | `{ data: OpenDiscrepanciesData }` | Total + Aging>30 KPI, and By Type / By Area / By Shop breakdowns (count lists, labels via `formatDiscrepancyType`) |

Each component is self-contained, theme-token styled, and scrolls within its container
(widgets are fixed-height). The interactivity that lived in the aging page (clicking a
tier/shop to cross-filter the list) moves into `AgingReportView` as internal state.

**Page migration (opportunistic, low-risk only):** where a report page's inline body can
be cleanly replaced by `<XReportView data={...} />` without disturbing its picker/export/
email controls, do so (single source of truth). If a page body is too entangled with its
local state, leave the page unchanged and accept the duplication — note it in the plan.
The page's export/email/PDF flow is **out of scope** and stays on the page.

### 2. Fast path for `fetchOpenDiscrepanciesData`

Add a 4th optional param `skipMedia = false`. When `true`, skip the photo block
(`lib/reports/open-discrepancies-data.ts` lines ~232–305: photo download/compress + map
image generation) and return `photos: {}`. The summary (`total`, `byArea`, `byType`,
`byShop`, `agingOver30`) and the discrepancy list are computed independently, so they're
unaffected. Existing positional callers (report page, PDF generator) are unchanged
(default `false` → full media). The Discrepancy Report widget calls with `skipMedia = true`.

### 3. Widget upgrades (`components/dashboard/widgets/`)

Each widget fetches its data (keyed on `installationId` + its config) and renders the
shared view; loading/empty states preserved.

- **`report-trends-widget.tsx`** — read `config.period` (default `'30d'`); call
  `fetchDiscrepancyTrendsData(period, id)`; render `<TrendsReportView>`. New
  `ReportTrendsConfigForm` exposes Title + Period (30d / 90d / 6m / 1y).
- **`report-aging-widget.tsx`** — call `fetchAgingDiscrepanciesData(id)`; render
  `<AgingReportView>`. Config stays Title-only (`TitleConfigForm`).
- **`report-discrepancies-widget.tsx`** — read filters from `config`; call
  `fetchOpenDiscrepanciesData(false, id, filters, true /* skipMedia */)`; render
  `<OpenReportView>`. New `ReportDiscrepanciesConfigForm` exposes Title + the 5 filters
  (Status, Workflow Status, Type, Assigned Shop, Location), sourced the same way the
  report page sources them (`getDiscrepancyStatusOptions`, `DISCREPANCY_TYPES`,
  `useInstallation().ceShops`, `useInstallation().areas`).

### 4. Registry (`lib/dashboard/registry.tsx`)

- Bump the three widgets' `defaultSize`/`minSize` up (full views need room — e.g. trends
  `{w:12,h:8}`/`min{w:8,h:6}`, aging `{w:12,h:10}`/`min{w:8,h:6}`, report
  `{w:10,h:8}`/`min{w:6,h:6}`).
- Wire the new `ConfigForm`s for trends and discrepancies.

## Data flow

`widget (installationId + config) → builder(...) → data shape → <XReportView data> →
KPIs/charts/lists`. Config changes re-fetch (effect keyed on the relevant config).
Discrepancy Report uses `skipMedia` so a dashboard load doesn't hit Storage/Maps.

## Testing

- `formatDiscrepancyType` already exists; no new pure logic except the `AgingReportView`
  cross-filter (derive filtered list from `activeTier`/`activeShop`). If that derivation
  is extracted as a pure helper, unit-test it; otherwise verify via build.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` green.
- Manual smoke after promotion: each widget renders its full view; trends period switches;
  aging tier/shop click cross-filters; report filters narrow the breakdown; the Report
  widget loads fast (no photo/map fetch — `skipMedia`).

## Non-goals

- Export/email/PDF from the widgets (stays on the report pages).
- Photos/maps in the Report widget (intentionally skipped for speed).
- Touching the generic Analytics widget engine (separate system).

## Phasing

1. `skipMedia` fast path on `fetchOpenDiscrepanciesData`.
2. `TrendsReportView` + upgrade the Trends widget (+ config form).
3. `AgingReportView` + upgrade the Aging widget.
4. `OpenReportView` + upgrade the Report widget (+ config form).
5. Registry sizes/config wiring; opportunistic page migration; full gate.

Each phase builds green and is independently shippable.
