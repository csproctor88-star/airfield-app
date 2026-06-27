# Customizable Dashboard — Phase 3 (Analytics Guided Builder) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let users build their own analytics widgets — pick a dataset, a measure, a group-by, filters, a time range, and a chart type — and pin the result to a board. No raw SQL: every query runs through a vetted dataset registry, so RLS and column exposure stay controlled. "Expanding analytics" = adding a dataset.

**Architecture:** A **dataset registry** (per-module, RLS-respecting). Each dataset declares dimensions (group-by), measures (count/avg/sum), filters, a `fetchRows(baseId, timePreset)` (thin Supabase read of selected columns, base-scoped), and a `getDimensionValue(row, dimKey)`. A **pure `aggregate()` engine** turns rows + a `QuerySpec` into `{labels, values}` (or table rows) — this is the tested core. **Chart components** (recharts) render the result. An **AnalyticsConfigForm** drives the builder with a live preview; the **AnalyticsWidget** re-runs the saved spec on the dashboard.

**Tech Stack:** Next.js 14, TS strict, Supabase + RLS, recharts, vitest. Reuses the Phase 1 widget framework + Phase 2 config-form flow.

**Spec:** `docs/superpowers/specs/2026-06-27-customizable-dashboard-design.md` §6.
**Prior phases:** Phase 1 + Phase 2 plans (both done + pushed).

**Conventions:** theme tokens only; gate commits on `npm run build` + `npx vitest run`; matrix RLS (reads inherit the user's session — RLS already scopes rows; we ALSO filter by `base_id` in every fetch); co-author trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. No DB migration needed (analytics reads existing tables).

---

## File structure

**Create:**
- `lib/dashboard/analytics/types.ts` — `QuerySpec`, `Dataset`, `Dimension`, `Measure`, `FilterDef`, `ChartType`, `TimePreset`, `AggregateResult`
- `lib/dashboard/analytics/aggregate.ts` — pure `aggregate()` + `applyFilters()` + `timePresetSince()` (+ tests)
- `lib/dashboard/analytics/datasets/discrepancies.ts`, `inspections.ts`, `checks.ts`, `wildlife.ts`, `ppr.ts`, `feedback.ts`
- `lib/dashboard/analytics/datasets/index.ts` — `DATASETS` registry + `getDataset`, `runQuery`
- `components/dashboard/charts/` — `metric-chart.tsx`, `bar-chart.tsx`, `line-chart.tsx`, `donut-chart.tsx`, `table-chart.tsx`, `chart-switch.tsx`
- `components/dashboard/widgets/analytics-widget.tsx` — `AnalyticsWidget` + `AnalyticsConfigForm`
- `tests/dashboard-aggregate.test.ts`

**Modify:**
- `lib/dashboard/registry.tsx` — register the `analytics` widget
- `package.json` — add `recharts`

---

## Task 1: recharts + chart components

**Files:**
- Modify: `package.json`
- Create: `components/dashboard/charts/*.tsx`

- [ ] **Step 1: Install** `npm install recharts@2.15.0`. Run `npm run build` to confirm still green. Commit:
```
git add package.json package-lock.json
git commit -m "build: add recharts for dashboard analytics"
```

- [ ] **Step 2: Chart components.** Each takes a simple, presentational prop shape and uses theme tokens for colors via CSS variables read at runtime (recharts needs concrete colors — read them off `getComputedStyle(document.documentElement)` in a `useEffect`, OR pass an explicit accent like `var(--color-accent)` is NOT valid for SVG fill, so resolve tokens to hex once). Implement a small `useThemeColor(varName)` hook in `chart-switch.tsx` that returns the computed value of a CSS var (fallback to a hex). Keep charts inside recharts' `ResponsiveContainer width="100%" height="100%"`.

`metric-chart.tsx` — `MetricChart({ value, label }: { value: number; label?: string })`: a big number + small label, theme tokens (no recharts needed).

`bar-chart.tsx` — `BarChartView({ data }: { data: { name: string; value: number }[] })`: recharts `BarChart` with `XAxis dataKey="name"`, `YAxis`, `Tooltip`, one `Bar dataKey="value"` filled with the resolved accent color.

`line-chart.tsx` — `LineChartView({ data })`: recharts `LineChart` + `Line`.

`donut-chart.tsx` — `DonutChartView({ data })`: recharts `PieChart` + `Pie innerRadius` + `Cell` per slice (cycle a small theme palette of resolved colors).

`table-chart.tsx` — `TableChartView({ columns, rows }: { columns: string[]; rows: (string|number)[][] })`: a simple themed `<table>`.

`chart-switch.tsx` — `useThemeColor(name, fallback)` hook + `ChartSwitch({ chart, result })` that maps a `ChartType` + `AggregateResult`/table data to the right chart component. `AggregateResult` = `{ labels: string[]; values: number[] }` → map to `{name,value}[]` for bar/line/donut; `number` charts use `values[0]`.

- [ ] **Step 3:** `npx tsc --noEmit` (0) + `npm run build` (compiled). Commit:
```
git add components/dashboard/charts/
git commit -m "feat(dashboard): analytics chart components (metric/bar/line/donut/table)"
```

---

## Task 2: Analytics types + pure aggregate engine (TDD)

**Files:**
- Create: `lib/dashboard/analytics/types.ts`, `lib/dashboard/analytics/aggregate.ts`, `tests/dashboard-aggregate.test.ts`

- [ ] **Step 1: Types** `lib/dashboard/analytics/types.ts`

```ts
export type MeasureKind = 'count' | 'avg' | 'sum'
export type ChartType = 'number' | 'bar' | 'line' | 'donut' | 'table'
export type TimePreset = '7d' | '30d' | '90d' | 'ytd' | 'all'
export type FilterOp = 'eq' | 'neq'

export interface Dimension { key: string; label: string }
export interface Measure { key: string; label: string; kind: MeasureKind; field?: string }
export interface FilterDef { field: string; label: string; options: { value: string; label: string }[] }

export interface QuerySpec {
  dataset: string
  measure: string                 // a Measure.key
  groupBy?: string                // a Dimension.key (omit → single number)
  filters?: { field: string; op: FilterOp; value: string }[]
  timePreset?: TimePreset
  chart: ChartType
  title?: string
}

export interface AggregateResult { labels: string[]; values: number[] }

export interface Dataset {
  key: string
  label: string
  permission: string
  moduleHref?: string
  timeField?: string              // column used for time-range filtering, if any
  dimensions: Dimension[]
  measures: Measure[]
  filters: FilterDef[]
  fetchRows: (baseId: string, timePreset?: TimePreset) => Promise<Record<string, unknown>[]>
  getDimensionValue: (row: Record<string, unknown>, dimKey: string) => string
}
```

- [ ] **Step 2: Failing test** `tests/dashboard-aggregate.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { aggregate, applyFilters, timePresetSince } from '@/lib/dashboard/analytics/aggregate'
import type { Measure, QuerySpec } from '@/lib/dashboard/analytics/types'

const measures: Measure[] = [
  { key: 'count', label: 'Count', kind: 'count' },
  { key: 'avg_days', label: 'Avg days', kind: 'avg', field: 'days' },
  { key: 'sum_days', label: 'Total days', kind: 'sum', field: 'days' },
]
const rows = [
  { shop: 'CES', status: 'open', days: 2 },
  { shop: 'CES', status: 'open', days: 4 },
  { shop: 'AM', status: 'closed', days: 10 },
]
const dim = (r: Record<string, unknown>, k: string) => String(r[k] ?? '—')

describe('aggregate', () => {
  it('count with no groupBy returns a single total', () => {
    const spec = { dataset: 'd', measure: 'count', chart: 'number' } as QuerySpec
    expect(aggregate(rows, spec, measures, dim)).toEqual({ labels: ['Total'], values: [3] })
  })
  it('count grouped by a dimension', () => {
    const spec = { dataset: 'd', measure: 'count', groupBy: 'shop', chart: 'bar' } as QuerySpec
    const out = aggregate(rows, spec, measures, dim)
    expect(out.labels).toEqual(['CES', 'AM'])
    expect(out.values).toEqual([2, 1])
  })
  it('avg measure averages the field per group', () => {
    const spec = { dataset: 'd', measure: 'avg_days', groupBy: 'shop', chart: 'bar' } as QuerySpec
    const out = aggregate(rows, spec, measures, dim)
    expect(out.labels).toEqual(['CES', 'AM'])
    expect(out.values).toEqual([3, 10])   // (2+4)/2, 10/1
  })
  it('sum measure totals the field overall', () => {
    const spec = { dataset: 'd', measure: 'sum_days', chart: 'number' } as QuerySpec
    expect(aggregate(rows, spec, measures, dim)).toEqual({ labels: ['Total'], values: [16] })
  })
  it('unknown measure throws', () => {
    const spec = { dataset: 'd', measure: 'nope', chart: 'number' } as QuerySpec
    expect(() => aggregate(rows, spec, measures, dim)).toThrow()
  })
})

describe('applyFilters', () => {
  it('eq keeps matching rows', () => {
    expect(applyFilters(rows, [{ field: 'status', op: 'eq', value: 'open' }])).toHaveLength(2)
  })
  it('neq drops matching rows', () => {
    expect(applyFilters(rows, [{ field: 'status', op: 'neq', value: 'open' }])).toHaveLength(1)
  })
  it('no filters returns all', () => {
    expect(applyFilters(rows, [])).toHaveLength(3)
    expect(applyFilters(rows, undefined)).toHaveLength(3)
  })
})

describe('timePresetSince', () => {
  it('returns null for all/undefined', () => {
    expect(timePresetSince('all', 1_000_000)).toBeNull()
    expect(timePresetSince(undefined, 1_000_000)).toBeNull()
  })
  it('7d returns now minus 7 days as ISO', () => {
    const now = Date.parse('2026-06-27T00:00:00Z')
    expect(timePresetSince('7d', now)).toBe(new Date(now - 7 * 86_400_000).toISOString())
  })
})
```

Run `npx vitest run tests/dashboard-aggregate.test.ts` → FAIL.

- [ ] **Step 3: Implement** `lib/dashboard/analytics/aggregate.ts`

```ts
import type { AggregateResult, FilterOp, Measure, QuerySpec, TimePreset } from './types'

export function applyFilters(
  rows: Record<string, unknown>[],
  filters?: { field: string; op: FilterOp; value: string }[],
): Record<string, unknown>[] {
  if (!filters || filters.length === 0) return rows
  return rows.filter(r =>
    filters.every(f => {
      const v = String(r[f.field] ?? '')
      return f.op === 'eq' ? v === f.value : v !== f.value
    }),
  )
}

function measureValue(rows: Record<string, unknown>[], m: Measure): number {
  if (m.kind === 'count') return rows.length
  const field = m.field
  if (!field) return 0
  const nums = rows.map(r => Number(r[field])).filter(n => Number.isFinite(n))
  if (nums.length === 0) return 0
  const sum = nums.reduce((a, b) => a + b, 0)
  return m.kind === 'sum' ? sum : sum / nums.length
}

/** Pure aggregation: rows + spec → labels/values. Throws on an unknown measure. */
export function aggregate(
  rows: Record<string, unknown>[],
  spec: QuerySpec,
  measures: Measure[],
  getDimensionValue: (row: Record<string, unknown>, dimKey: string) => string,
): AggregateResult {
  const m = measures.find(x => x.key === spec.measure)
  if (!m) throw new Error(`Unknown measure: ${spec.measure}`)
  if (!spec.groupBy) return { labels: ['Total'], values: [round(measureValue(rows, m))] }

  const groups = new Map<string, Record<string, unknown>[]>()
  for (const r of rows) {
    const k = getDimensionValue(r, spec.groupBy)
    const arr = groups.get(k)
    if (arr) arr.push(r); else groups.set(k, [r])
  }
  const labels: string[] = []
  const values: number[] = []
  for (const [k, gr] of groups) { labels.push(k); values.push(round(measureValue(gr, m))) }
  return { labels, values }
}

function round(n: number): number { return Math.round(n * 100) / 100 }

/** ISO timestamp for the start of a preset window, or null for all/undefined. `now` defaults to Date.now(). */
export function timePresetSince(preset: TimePreset | undefined, now: number = Date.now()): string | null {
  if (!preset || preset === 'all') return null
  if (preset === 'ytd') return new Date(new Date(now).getUTCFullYear(), 0, 1).toISOString()
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90
  return new Date(now - days * 86_400_000).toISOString()
}
```

NOTE: the `ytd` test is not asserted with an exact value above (only 7d is), so the local-vs-UTC construction of ytd is acceptable; keep it simple.

- [ ] **Step 4:** `npx vitest run tests/dashboard-aggregate.test.ts` → PASS (all). `npx tsc --noEmit` → 0.

- [ ] **Step 5: Commit**
```
git add lib/dashboard/analytics/types.ts lib/dashboard/analytics/aggregate.ts tests/dashboard-aggregate.test.ts
git commit -m "feat(dashboard): analytics types + pure aggregate engine"
```

---

## Task 3: Dataset registry + discrepancies dataset (the pattern)

**Files:**
- Create: `lib/dashboard/analytics/datasets/discrepancies.ts`, `lib/dashboard/analytics/datasets/index.ts`

- [ ] **Step 1: Confirm the discrepancies API** (`fetchDiscrepancies`, the `DiscrepancyRow` fields `status`, `assigned_shop`, `created_at`, and whether a numeric "days to close" exists or must be derived). Run: `grep -nE "export|status|assigned_shop|created_at|closed_at|resolved_at|severity|category|type" lib/supabase/discrepancies.ts | head -40`.

- [ ] **Step 2: Implement** `lib/dashboard/analytics/datasets/discrepancies.ts`

```ts
import type { Dataset } from '@/lib/dashboard/analytics/types'
import { timePresetSince } from '@/lib/dashboard/analytics/aggregate'
import { fetchDiscrepancies } from '@/lib/supabase/discrepancies'

export const discrepanciesDataset: Dataset = {
  key: 'discrepancies',
  label: 'Discrepancies',
  permission: 'discrepancies:view',
  moduleHref: '/discrepancies',
  timeField: 'created_at',
  dimensions: [
    { key: 'status', label: 'Status' },
    { key: 'assigned_shop', label: 'Assigned Shop' },
    { key: 'month', label: 'Month opened' },
  ],
  measures: [
    { key: 'count', label: 'Count', kind: 'count' },
  ],
  filters: [
    { field: 'status', label: 'Status', options: [
      { value: 'open', label: 'Open' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' },
    ] },
  ],
  async fetchRows(baseId, timePreset) {
    const all = await fetchDiscrepancies(baseId)
    const since = timePresetSince(timePreset)
    const rows = all as unknown as Record<string, unknown>[]
    if (!since) return rows
    return rows.filter(r => typeof r.created_at === 'string' && r.created_at >= since)
  },
  getDimensionValue(row, dimKey) {
    if (dimKey === 'month') {
      const c = row.created_at
      return typeof c === 'string' ? c.slice(0, 7) : '—'   // YYYY-MM
    }
    return String(row[dimKey] ?? '—')
  },
}
```
(Adapt field names/measures to STEP 1 findings. If a numeric days-to-close exists, add an `avg` measure with that field; otherwise keep `count` only — do not invent fields.)

- [ ] **Step 3: Registry** `lib/dashboard/analytics/datasets/index.ts`

```ts
import type { Dataset, QuerySpec, AggregateResult } from '@/lib/dashboard/analytics/types'
import { aggregate, applyFilters } from '@/lib/dashboard/analytics/aggregate'
import { discrepanciesDataset } from './discrepancies'

export const DATASETS: Dataset[] = [discrepanciesDataset]

export function getDataset(key: string): Dataset | undefined {
  return DATASETS.find(d => d.key === key)
}

/** Fetch rows for the dataset, apply filters, aggregate per the spec. */
export async function runQuery(spec: QuerySpec, baseId: string): Promise<AggregateResult> {
  const ds = getDataset(spec.dataset)
  if (!ds) throw new Error(`Unknown dataset: ${spec.dataset}`)
  const rows = await ds.fetchRows(baseId, spec.timePreset)
  const filtered = applyFilters(rows, spec.filters)
  return aggregate(filtered, spec, ds.measures, ds.getDimensionValue)
}
```

- [ ] **Step 4:** `npx tsc --noEmit` → 0; `npm run build` → compiled.

- [ ] **Step 5: Commit**
```
git add lib/dashboard/analytics/datasets/
git commit -m "feat(dashboard): dataset registry + discrepancies dataset"
```

---

## Task 4: Additional datasets

**Files:**
- Create: `lib/dashboard/analytics/datasets/{inspections,checks,wildlife,ppr,feedback}.ts`
- Modify: `lib/dashboard/analytics/datasets/index.ts` (register them)

For EACH dataset, follow the Task 3 pattern. VERIFY each module's real fetch fn + fields first (grep the relevant `lib/supabase/*` module and the matching page). Reuse the metric intent from `lib/reports/analytics-data.ts` where helpful. Keep measures to what the real fields support — **do not invent fields** (project rule: no fabricated fields). Suggested shape (adjust to reality):

| Dataset | permission | module | dimensions | measures | time field |
|---|---|---|---|---|---|
| `inspections` | `inspections:read`* | `/inspections` | type, status, month | count, avg duration (if a duration/numeric exists) | inspection_date |
| `checks` | `checks:read`* | `/checks` | check_type, month | count | completed_at |
| `wildlife` | `wildlife:read`* | `/wildlife` | species/type, strike-vs-sighting, month | count | observed/created date |
| `ppr` | `ppr:read`* | `/ppr` | status, month | count | arrival/created date |
| `feedback` | `feedback:read`* | `/feedback` | rating, month | count, avg rating | created_at |

\* Confirm the exact permission key strings (grep `lib/permissions.ts`). Use the real key; if a module's read permission differs, use that.

- [ ] **Step 1:** implement each dataset (verify fields first).
- [ ] **Step 2:** register all in `DATASETS` in `index.ts`.
- [ ] **Step 3:** `npx tsc --noEmit` (0) + `npm run build` (compiled).
- [ ] **Step 4: Commit**
```
git add lib/dashboard/analytics/datasets/
git commit -m "feat(dashboard): inspections/checks/wildlife/ppr/feedback datasets"
```

---

## Task 5: Analytics widget + builder form + registry

**Files:**
- Create: `components/dashboard/widgets/analytics-widget.tsx`
- Modify: `lib/dashboard/registry.tsx`

- [ ] **Step 1: `AnalyticsWidget`** — reads `config` as a `QuerySpec`, runs `runQuery(spec, installationId)` in an effect, renders `<ChartSwitch chart={spec.chart} result={result} />` (loading + error + empty states). Guard `installationId`. Re-run when `installationId` or the spec changes (serialize spec to a dep via `JSON.stringify`).

- [ ] **Step 2: `AnalyticsConfigForm`** (a `WidgetConfigProps` form) — the builder:
  - Dataset `<select>` (only datasets the user can access: filter `DATASETS` by `has(permission)` via `usePermissions`, AND module enabled via `useInstallation` + `isModuleEnabled`).
  - Measure `<select>` (from the chosen dataset's `measures`).
  - Group-by `<select>` ("None" + the dataset's `dimensions`).
  - Filters: for each `FilterDef` on the dataset, an optional `<select>` ("Any" + options) → builds `filters` with `op: 'eq'`.
  - Time range `<select>` (7d/30d/90d/ytd/all) — only if the dataset has a `timeField`.
  - Chart `<select>` (number/bar/line/donut/table).
  - Title text input.
  - **Live preview:** a small `<ChartSwitch>` that runs `runQuery` against the current draft spec (debounced) using `installationId`.
  - Save → `onSave(draftSpec as unknown as Record<string,unknown>)`; Cancel → `onCancel()`. Theme tokens; primary button `#fff` on accent (codebase convention).

- [ ] **Step 3: Register** in `lib/dashboard/registry.tsx`:
```tsx
  'analytics': { type: 'analytics', kind: 'analytics', title: 'Analytics', description: 'A custom chart you build from your data', icon: BarChart3, defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 }, Component: (p) => <AnalyticsWidget config={p.config} />, ConfigForm: AnalyticsConfigForm },
```
Add `BarChart3` to the lucide import + import the two exports.

- [ ] **Step 4:** `npx tsc --noEmit` (0) + `npm run build` (compiled).

- [ ] **Step 5: Commit**
```
git add components/dashboard/widgets/analytics-widget.tsx lib/dashboard/registry.tsx
git commit -m "feat(dashboard): analytics widget + guided builder"
```

---

## Task 6: Full verification

- [ ] **Step 1:** `npx vitest run` → all pass (prior + `dashboard-aggregate`).
- [ ] **Step 2:** `npm run build` → compiled successfully.
- [ ] **Step 3: Manual smoke (dev):** add an Analytics widget → builder opens → pick Discrepancies → Count → group by Assigned Shop → bar chart → preview renders → Save → widget shows the chart; switch measure to a count grouped by Month → line chart; confirm a dataset the user lacks permission for is not offered.
- [ ] **Step 4:** Final commit if smoke fixes needed.

---

## Self-review notes (author)
- **Spec coverage (§6):** dataset registry (T3/T4), guided builder dataset→measure→group-by→filter→time→chart with live preview (T5), no raw SQL (all via vetted datasets), chart types number/bar/line/donut/table (T1), expandable by adding datasets (T4). The "pin an existing /reports view" sub-feature from the spec is OPTIONAL and deferred — note it as a possible follow-up; the guided builder covers the core ask.
- **Security:** datasets read through existing RLS-scoped CRUD fns + explicit `base_id`; the builder only offers datasets the user is permitted (permission + module gate), mirroring widget gating. No user-supplied field names reach a query — only enumerated dimensions/measures/filters from the dataset definition.
- **Pure core:** `aggregate`/`applyFilters`/`timePresetSince` are pure + unit-tested; datasets are thin fetch wrappers; charts are presentational. This keeps the risky logic testable without a DB.
- **Verify-before-implement:** every dataset's fetch fn, fields, and permission key (Tasks 3/4) MUST be confirmed against the real modules — do not invent fields (project rule). recharts theme colors must be resolved to concrete values (SVG can't use CSS vars for fill in all cases) — handle via the `useThemeColor` hook.
- **Deferred:** report-view pin widget; `avg`/`sum` measures only where a real numeric field exists.
```
