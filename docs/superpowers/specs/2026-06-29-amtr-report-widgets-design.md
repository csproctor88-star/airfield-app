# AMTR Report Widgets — Design Spec

**Date:** 2026-06-29
**Status:** Proposed (awaiting review)
**Module:** Dashboard (customizable widget grid) × AMTR

## Problem / Goal

Today the AMTR module contributes a single dashboard widget — a per-member
**currency-status** table (`amtrDescriptor`, registry type `amtr`). A training
manager wants to surface AMTR information on the main customizable Dashboard as
**several distinct report widgets** they can add individually (and place, resize,
and color like any other widget), rather than one fixed table.

Decision (from brainstorming):
- **Location:** the main Dashboard, alongside the existing widgets — *not* the
  `/amtr` page.
- **Model:** each report is its **own** widget in the Add-Widget palette
  (consistent with the existing report-summary widgets). Not a single widget with
  a report selector.
- **Scope:** five report widgets (Currency, Unit KPIs, Overdue Training, Due Soon,
  Inspection Status) — all included in this build.
- **Gating:** the existing `amtr:view` permission, which is held by exactly
  `sys_admin, airfield_manager, namo, base_admin, amops` — i.e. AFM, NAMO, Base
  Admin, Sys Admin, and AMOPS. No new permission key.

**No DB migration.** Every report reads from existing AMTR tables.

## Out of scope (YAGNI)

- Any change to the `/amtr` page itself.
- Editing/authoring AMTR data from a widget — these are **read-only** reports.
- A per-widget "choose the report" selector (explicitly rejected in favor of
  one-widget-per-report).
- New permissions or role changes — `amtr:view` already matches the desired
  audience.

## The five widgets

| Registry type | Title | Kind | Data source |
|---|---|---|---|
| `amtr` *(existing)* | **AMTR — Currency** | table descriptor | members + 1098 + RAT progress |
| `amtr-kpis` *(new)* | **AMTR — Unit KPIs** | native summary | `buildUnitKpis` over the same rollup data |
| `amtr-overdue` *(new)* | **AMTR — Overdue Training** | table descriptor | overdue 1098/RAT items |
| `amtr-due-soon` *(new)* | **AMTR — Due Soon (30 days)** | table descriptor | due-soon 1098/RAT items |
| `amtr-inspections` *(new)* | **AMTR — Inspection Status** | table descriptor | `amtr_inspections` (latest per member) |

### 1. AMTR — Currency (existing, retitled)
Keep `amtrDescriptor` exactly as-is. Only change: the registry title becomes
`AMTR — Currency` (was `AMTR Training`). The type key stays `amtr` so **boards
already using it keep working** — only the displayed label changes. It already
deep-links each row to `/amtr/<memberId>` (`row: { mode: 'deeplink', href: r =>
`/amtr/${r.id}` }`) — the pattern the other table reports below reuse.

### 2. AMTR — Unit KPIs (new native summary widget)
A small KPI-tile widget matching the existing report-summary widgets
(Discrepancy Report, Lighting Report, …). Shows the unit roll-up from
`buildUnitKpis` (`lib/amtr/rollup.ts`):
- **Members**, **Required tasks**, **Complete**, **Due soon**, **Overdue**.
- Tones: Overdue → `bad` (red), Due soon → `warn` (amber), Complete → `ok` (green).
- **No per-row deep-link** (it's a summary card, no rows). Whole-widget footer
  link to `/amtr` (roster) — or `/amtr/reports` if you prefer the reports view.

### 3. AMTR — Overdue Training (new table descriptor)
**One row per overdue item** (member × overdue 1098/RAT task), so a manager sees
exactly who owes what.
- Columns: Member, Grade, Item, Type (`1098`/`RAT`), Due date, **Days overdue** (numeric/mono).
- Filter: Type (`1098` / `RAT`).
- Default sort: Days overdue, descending.
- Summary line: `N overdue · M members`.
- Source: `fetchAmtrMembers` + `fetchAmtrByBase('amtr_1098_progress')` +
  `fetchAmtrByBase('amtr_rat_progress')`, classified by `dueStatus(...) === 'overdue'`
  (RAT-exempt member statuses excluded via `ratApplies`).
- **Row deep-links** to `/amtr/<memberId>` (the member's record), via
  `row: { mode: 'deeplink', href: r => `/amtr/${r.memberId}` }`.

### 4. AMTR — Due Soon (30 days) (new table descriptor)
Same shape as Overdue Training, but `dueStatus(...) === 'due_soon'` (within
`DUE_SOON_DAYS = 30`). This is the real "expiring training" report — note that
**qualifications themselves do not expire**; what comes due are recurring/RAT items.
- Columns: Member, Grade, Item, Type, Due date, **Days until due** (numeric/mono).
- Filter: Type. Default sort: Days until due, ascending.
- Summary line: `N due within 30 days`.
- **Row deep-links** to `/amtr/<memberId>` (same mechanism as Overdue Training).

### 5. AMTR — Inspection Status (new table descriptor)
**One row per member**, summarizing the member's **latest completed** monthly
record self-inspection.
- Columns: Member, Grade, Last inspection date, **Result** (Clean / `N findings`
  / *Never inspected*), Inspector.
- Filter: Result (`Clean` / `Has findings` / `Never inspected`).
- Summary line: `X of Y members inspected · Z with findings`.
- Source: `fetchAmtrInspections(baseId)` (already exists; ordered
  `inspection_date DESC`) reduced to the latest `status = 'completed'` row per
  `member_id`, left-joined onto the member roster so members with no inspection
  appear as *Never inspected*. The exact "findings count" field on
  `amtr_inspections` is resolved in the implementation plan (the row stores the
  filled checklist + results).
- **Row deep-links** to `/amtr/<memberId>` (or `/amtr/<memberId>/inspect` to open
  the member's inspection directly — both routes exist).

## Architecture

Reuse the two existing dashboard patterns; introduce no new framework.

### Shared data hook
Extract `useAmtrRollupData(installationId, reloadNonce?)` →
`{ members, p1098, pRat, loading }` that performs the members + 1098 + RAT fetch
**once** (the fetch currently inlined in `amtrDescriptor`'s `useRows`). Currency,
Unit KPIs, Overdue, and Due Soon all build their rows from this hook, so the
fetch logic lives in one place. Inspection Status uses its own
`fetchAmtrInspections` (independent data).

### Pure row/summary builders (unit-tested)
Add to `lib/amtr/rollup.ts` (or a sibling `lib/amtr/report-rows.ts`):
- `overdueItemRows(members, p1098, pRat, today)` → `OverdueRow[]`
- `dueSoonItemRows(members, p1098, pRat, today)` → `DueSoonRow[]`
- `latestInspectionPerMember(members, inspections)` → `InspectionRow[]`

`buildUnitKpis` already exists and is tested.

### Table widgets
Each new table report = a `TableWidgetDescriptor` (`lib/dashboard/table/
descriptors/amtr-*.tsx`) with its own `useRows`, `columns`, optional `filters`,
and `summary`. This gives columns/sort/search/filter/resize/color tint for free,
identical to every other list widget. Registered via the existing
`tableWidget(meta, descriptor)` helper. Each sets
`row: { mode: 'deeplink', href: r => `/amtr/${r.memberId}` }` so a clicked row
jumps to that member's record — the same row-deep-link mechanism the Currency
widget already uses. (Unit KPIs, being a summary card with no rows, uses only a
`footerHref`.)

### Native KPI widget
`components/dashboard/widgets/amtr-kpis-widget.tsx` — a native component modeled
on the existing report-summary widgets; registered as a `native` widget.

### Registry & gating
`lib/dashboard/registry.tsx`: retitle `amtr`; add `amtr-kpis`, `amtr-overdue`,
`amtr-due-soon`, `amtr-inspections`. **Every** AMTR widget carries
`permission: PERM.AMTR_VIEW`, so the palette shows them only to the intended
roles (AFM, NAMO, Base Admin, Sys Admin, AMOPS) — and only on bases with the AMTR
module enabled (existing `moduleHref: '/amtr'` enablement filter).

## Back-compat
- Existing boards referencing type `amtr` are unaffected (same descriptor, new label).
- No config-shape change; no migration; `normalizeTableConfig` already tolerates
  unknown keys for new descriptors.

## Testing
- Unit tests for `overdueItemRows`, `dueSoonItemRows`, `latestInspectionPerMember`
  (edge cases: RAT-exempt members, members with no progress row, members never
  inspected, ties).
- Extend `tests/dashboard-table-descriptors.test.ts` to cover the new descriptors'
  invariants (column keys unique, default-visible subset valid, filters reference
  real columns).
- `npx tsc --noEmit` + `npm run build` green before commit.

## Risks / notes
- **Inspection "findings" count = `gap_count`** (resolved during implementation).
  `amtr_inspections` persists `gap_count` equal to `no_count` (both are the count
  of "no" answers — see `lib/supabase/amtr-inspections.ts`), so the widget reports
  a single `gap_count`, matching the `/amtr/reports` page and the 623A completion
  summary. (An early cut summed `no_count + gap_count` and double-counted; fixed.)
- **Latest inspection = latest *completed*** (intentional divergence). The widget's
  `latestInspectionPerMember` ignores drafts and shows each member's latest
  `status='completed'` inspection, so a member whose only/most-recent inspection is
  an in-progress draft reads as *Never inspected*. This is the correct semantic for
  a compliance **status** report (a draft is not a finished inspection). It
  intentionally differs from `/amtr/reports`, which shows the latest inspection of
  *any* status with a draft/completed pill.
- **Per-widget fetch fan-out** (accepted; follow-up candidate). The design floated a
  single shared `useAmtrRollupData`; the build shares one fetch only between Overdue
  and Due Soon (`useAllDueItems`). Currency, KPIs, and the due-item widgets each
  fetch members + 1098/RAT independently, so a board with all of them issues the
  member/progress queries 3–4× on load. One-shot per mount (not polling); fine for a
  first cut, shareable later if it matters.
- **Per-item vs per-member rows** for Overdue/Due Soon: chosen per-item for
  actionability. If a manager prefers a per-member roll-up, that's a column/filter
  preset, not a redesign.
- **Privacy**: individual training progress is sensitive; `amtr:view` already
  scopes this to AMOPS-internal roles, and these widgets surface no more than the
  `/amtr` page already does to the same audience.
