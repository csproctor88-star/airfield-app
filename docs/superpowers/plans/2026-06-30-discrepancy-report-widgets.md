# Discrepancy Report Widgets — Full-View Parity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the three discrepancy report widgets (Trends / Aging / Report) from summary tiles to the full report views from the Reports & Analytics module, each with its own options.

**Architecture:** Extract each report page's inline body into a pure presentational view component under `components/reports/` that takes the existing builder's data shape; the widgets fetch data (keyed on config) and render the shared view. Add a `skipMedia` fast path to the open-discrepancies builder so the Report widget doesn't download photos/generate maps. Bump widget sizes and add per-widget config forms.

**Tech Stack:** Next.js 14 / React 18 / TypeScript, existing report data builders in `lib/reports/*`.

**Spec:** `docs/superpowers/specs/2026-06-30-discrepancy-report-widgets-design.md`

**Conventions:** `npx tsc --noEmit` + `npx vitest run` pass; commits gated on `npm run build` RC 0. Co-author trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `lib/reports/open-discrepancies-data.ts` | open-discrepancies builder | add `skipMedia` 4th param |
| `components/reports/trends-report-view.tsx` | trends view | **new** (lifted from `reports/trends/page.tsx` body) |
| `components/reports/aging-report-view.tsx` | aging view (interactive) | **new** (lifted from `reports/aging/page.tsx` body) |
| `components/reports/open-report-view.tsx` | open-by-type/area/shop view | **new** (lifted from `reports/discrepancies/page.tsx` body) |
| `components/dashboard/widgets/report-trends-widget.tsx` | Trends widget + config | rewrite to full view + `ReportTrendsConfigForm` |
| `components/dashboard/widgets/report-aging-widget.tsx` | Aging widget | rewrite to full view |
| `components/dashboard/widgets/report-discrepancies-widget.tsx` | Report widget + config | rewrite to full view + `ReportDiscrepanciesConfigForm` |
| `lib/dashboard/registry.tsx` | widget registry | sizes + new ConfigForms |

Data shapes (from `lib/reports/*`, do not redefine):
- `DiscrepancyTrendsData = { period, periodLabel, buckets: {label,startDate,endDate,opened,closed,net}[], summary: { totalOpened, totalClosed, net, avgDaysToClose, topAreas:{area,count}[], topTypes:{type,count}[] } }`
- `AgingDiscrepanciesData = { tiers: { label, min, max, color, discrepancies: AgingDiscrepancy[] }[], summary: { total, byShop:{shop,count}[], avgDaysOpen, oldest:{display_id,title,days_open}|null } }` (AgingDiscrepancy has `display_id, title, location_text, assigned_shop, days_open, id`)
- `OpenDiscrepanciesData = { discrepancies: OpenDiscrepancy[], summary: { total, byArea:Record<string,number>, byType:Record<string,number>, byShop:Record<string,number>, agingOver30 }, notesHistory, photos }`

---

## Task 1: `skipMedia` fast path

**Files:** Modify `lib/reports/open-discrepancies-data.ts`

- [ ] **Step 1: Add the param** — change the signature:

```ts
export async function fetchOpenDiscrepanciesData(
  includeNotes = false,
  baseId?: string | null,
  filters?: DiscrepancyReportFilters,
  skipMedia = false,
): Promise<OpenDiscrepanciesData> {
```

- [ ] **Step 2: Guard the photo/map block** — wrap the existing "Fetch photos for all discrepancies" block (currently begins `const photos: ... = {}` then `if (discIds.length > 0) { ... }`, through the end of the map-image generation, ~lines 232–305) so it only runs when `!skipMedia`. Concretely, change the outer guard from `if (discIds.length > 0) {` to `if (!skipMedia && discIds.length > 0) {` for the photos block, and likewise guard the map-image loop that follows with `if (!skipMedia)`. `photos` stays initialized to `{}` so a skipped run returns no media. The summary computation (byArea/byType/byShop/agingOver30) is **after** this block and is untouched.

- [ ] **Step 3: Verify build + existing callers unaffected**

Run: `npx tsc --noEmit && npm run build`
Expected: clean. The report page + PDF callers pass 3 positional args → `skipMedia` defaults `false` → full media preserved.

- [ ] **Step 4: Commit**

```bash
git add lib/reports/open-discrepancies-data.ts
git commit -m "feat(reports): skipMedia fast path on fetchOpenDiscrepanciesData

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: TrendsReportView + Trends widget

**Files:**
- Create `components/reports/trends-report-view.tsx`
- Rewrite `components/dashboard/widgets/report-trends-widget.tsx`
- (Task 5 wires registry size + config)

- [ ] **Step 1: Build the view component** — read `app/(app)/reports/trends/page.tsx` and lift its preview body (the 4 KPI tiles, the opened-vs-closed horizontal bar list, and the Top Areas / Top Types badge grids) into a presentational component. Signature:

```tsx
'use client'
import type { DiscrepancyTrendsData } from '@/lib/reports/discrepancy-trends-data'
export function TrendsReportView({ data }: { data: DiscrepancyTrendsData }) {
  // ...lifted markup, reading data.summary + data.buckets (no fetching, no export buttons)...
}
```

Use theme tokens (the page already does). Exclude the period picker, "Generated by", and Export/Email buttons (those stay on the page).

- [ ] **Step 2: Rewrite the widget** — `report-trends-widget.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchDiscrepancyTrendsData, type DiscrepancyTrendsData, type TrendPeriod } from '@/lib/reports/discrepancy-trends-data'
import { TrendsReportView } from '@/components/reports/trends-report-view'
import type { WidgetProps, WidgetConfigProps } from '@/lib/dashboard/widget-registry'

const PERIODS: { value: TrendPeriod; label: string }[] = [
  { value: '30d', label: 'Last 30 days' }, { value: '90d', label: 'Last 90 days' },
  { value: '6m', label: 'Last 6 months' }, { value: '1y', label: 'Last year' },
]

export function ReportTrendsWidget({ config }: WidgetProps) {
  const { installationId } = useInstallation()
  const period = ((config?.period as TrendPeriod) || '30d')
  const [data, setData] = useState<DiscrepancyTrendsData | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!installationId) return
    let cancelled = false
    setLoading(true)
    fetchDiscrepancyTrendsData(period, installationId).then(d => { if (!cancelled) { setData(d); setLoading(false) } })
    return () => { cancelled = true }
  }, [installationId, period])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>Loading…</div>
          : data ? <TrendsReportView data={data} />
          : <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>No data.</div>}
      </div>
      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/reports/trends" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none' }}>View report →</Link>
      </div>
    </div>
  )
}

export function ReportTrendsConfigForm({ config, onSave, onCancel }: WidgetConfigProps) {
  const c = config as { title?: string; period?: TrendPeriod }
  const [title, setTitle] = useState(c.title ?? '')
  const [period, setPeriod] = useState<TrendPeriod>(c.period ?? '30d')
  const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)', color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input style={input} placeholder="Widget title (optional)" value={title} onChange={e => setTitle(e.target.value)} />
      <select style={input} value={period} onChange={e => setPeriod(e.target.value as TrendPeriod)}>
        {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={() => onSave({ ...config, title: title.trim() || undefined, period })} style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', background: 'var(--color-accent)', color: '#fff', fontWeight: 700, fontFamily: 'inherit' }}>Save</button>
        <button onClick={onCancel} style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-2)', fontFamily: 'inherit' }}>Cancel</button>
      </div>
    </div>
  )
}
```

(Confirm the export names `TrendPeriod` / `fetchDiscrepancyTrendsData` / `DiscrepancyTrendsData` against `lib/reports/discrepancy-trends-data.ts` when implementing.)

- [ ] **Step 2b:** the registry import for this widget currently imports `ReportTrendsWidget`; keep that export name. The new `ReportTrendsConfigForm` is wired in Task 5.

- [ ] **Step 3: Build + commit**

```bash
npx tsc --noEmit && npm run build
git add components/reports/trends-report-view.tsx components/dashboard/widgets/report-trends-widget.tsx
git commit -m "feat(dashboard): Discrepancy Trends widget renders the full trends view

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: AgingReportView + Aging widget

**Files:**
- Create `components/reports/aging-report-view.tsx`
- Rewrite `components/dashboard/widgets/report-aging-widget.tsx`

- [ ] **Step 1: Build the interactive view** — read `app/(app)/reports/aging/page.tsx` and lift its body: the KPI row (Total/Avg Days/Oldest), the clickable By-Tier and By-Shop badge grids, the filter indicator, and the per-tier item list (rows `Link` to `/discrepancies/[id]`). Move the page's `activeTierLabel` / `activeShop` cross-filter state and its `filteredData` `useMemo` INTO the component so the widget is interactive on its own:

```tsx
'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { AgingDiscrepanciesData } from '@/lib/reports/aging-discrepancies-data'
export function AgingReportView({ data }: { data: AgingDiscrepanciesData }) {
  const [activeTier, setActiveTier] = useState<string | null>(null)
  const [activeShop, setActiveShop] = useState<string | null>(null)
  // ...lifted filtered-data memo + markup (tier grid, shop grid, list)...
}
```

Exclude Export/Email buttons and the `PdfExportDialog`. If the page's `filteredData` derivation is non-trivial, extract it as a pure `function filterAging(data, activeTier, activeShop): AgingDiscrepanciesData` exported from the view file (testable).

- [ ] **Step 2: Rewrite the widget** — `report-aging-widget.tsx`, mirroring Task 2's widget shell but calling `fetchAgingDiscrepanciesData(installationId)` and rendering `<AgingReportView data={data} />`, footer `Link` to `/reports/aging`. Keep the existing exported name `ReportAgingWidget`. No new config form (Title-only via the registry's existing `TitleConfigForm`).

- [ ] **Step 3 (optional pure test):** if `filterAging` was extracted, add `tests/aging-report-view.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { filterAging } from '@/components/reports/aging-report-view'
// build a minimal AgingDiscrepanciesData with two tiers/shops and assert filtering by tier and by shop narrows summary + lists.
```

- [ ] **Step 4: Build + commit**

```bash
npx tsc --noEmit && npx vitest run && npm run build
git add components/reports/aging-report-view.tsx components/dashboard/widgets/report-aging-widget.tsx tests/aging-report-view.test.ts
git commit -m "feat(dashboard): Aging Discrepancies widget renders the full interactive view

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: OpenReportView + Report widget

**Files:**
- Create `components/reports/open-report-view.tsx`
- Rewrite `components/dashboard/widgets/report-discrepancies-widget.tsx`

- [ ] **Step 1: Build the view** — read `app/(app)/reports/discrepancies/page.tsx` and lift the generated-report body: the KPI (total + agingOver30 red callout) and the **By Type / By Area / By Shop** breakdowns. Render breakdowns as count lists sorted desc, labels via `formatDiscrepancyType` (already exported from `lib/reports/open-discrepancies-data.ts`) for the type list:

```tsx
'use client'
import type { OpenDiscrepanciesData } from '@/lib/reports/open-discrepancies-data'
import { formatDiscrepancyType } from '@/lib/reports/open-discrepancies-data'
export function OpenReportView({ data }: { data: OpenDiscrepanciesData }) {
  // KPI row (data.summary.total, data.summary.agingOver30) + three sorted breakdown lists
}
```

- [ ] **Step 2: Rewrite the widget with the 5-filter config** — `report-discrepancies-widget.tsx`. The widget reads filters from `config` and calls `fetchOpenDiscrepanciesData(false, installationId, filters, true)` (skipMedia). The `ReportDiscrepanciesConfigForm` sources options exactly like the report page: Status (`open`/`completed`/`cancelled`/`all`), Workflow Status (`getDiscrepancyStatusOptions(currentInstallation)`), Type (`DISCREPANCY_TYPES`), Assigned Shop (`useInstallation().ceShops`), Location (`useInstallation().areas`). Persist them as `config.filters: DiscrepancyReportFilters`. Widget shell mirrors Task 2 (loading/empty + footer `Link` to `/reports/discrepancies`). Keep the exported name `ReportDiscrepanciesWidget`.

  (When implementing, read the report page's filter sourcing to copy the exact option arrays and the `DiscrepancyReportFilters` field names: `status`, `currentStatus`, `type`, `shop`, `location`.)

- [ ] **Step 3: Build + commit**

```bash
npx tsc --noEmit && npm run build
git add components/reports/open-report-view.tsx components/dashboard/widgets/report-discrepancies-widget.tsx
git commit -m "feat(dashboard): Discrepancy Report widget renders the full breakdown with filters (skipMedia)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Registry sizes + config wiring + gate

**Files:** Modify `lib/dashboard/registry.tsx`

- [ ] **Step 1: Wire config forms + sizes** — for the three report widget registry entries:
  - `report-trends`: `ConfigForm: ReportTrendsConfigForm` (import it), `defaultSize: { w: 12, h: 8 }`, `minSize: { w: 8, h: 6 }`.
  - `report-aging`: `defaultSize: { w: 12, h: 10 }`, `minSize: { w: 8, h: 6 }` (config stays the existing `TitleConfigForm`).
  - `report-discrepancies`: `ConfigForm: ReportDiscrepanciesConfigForm` (import it), `defaultSize: { w: 10, h: 8 }`, `minSize: { w: 6, h: 6 }`.
  Update the imports at the top of `registry.tsx` to pull the new config forms from their widget files.

- [ ] **Step 2: Opportunistic page migration (low-risk only)** — for each of `reports/{trends,aging,discrepancies}/page.tsx`, IF the inline body can be replaced by `<XReportView data={...} />` without disturbing the picker/export/email controls, do so. If entangled, skip and leave the page (note in the commit body which pages were migrated vs left).

- [ ] **Step 3: Full gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all green.

- [ ] **Step 4: Commit + push**

```bash
git add lib/dashboard/registry.tsx app/\(app\)/reports
git commit -m "feat(dashboard): wire report widget config forms + sizes (+ page migration where safe)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 5: Manual smoke (after promotion)** — each report widget shows its full view; Trends period switches; Aging tier/shop clicks cross-filter; Report filters narrow the breakdown and it loads fast (no photo/map fetch).

---

## Self-review

- **Spec coverage:** skipMedia → Task 1; Trends view+widget+config → Task 2; Aging view+widget → Task 3; Open view+widget+filters → Task 4; registry sizes/config + page migration → Task 5. All spec sections covered.
- **Type consistency:** view components consume the exact builder shapes (`DiscrepancyTrendsData`, `AgingDiscrepanciesData`, `OpenDiscrepanciesData`); widgets pass `data`; config persists `period` (trends) and `filters: DiscrepancyReportFilters` (report). Exported widget names (`ReportTrendsWidget`/`ReportAgingWidget`/`ReportDiscrepanciesWidget`) preserved so registry imports don't break; new config-form exports added.
- **Note:** the view components are lifted verbatim from the three report pages (read each page at implementation time); the plan specifies the source file, the data shape consumed, and which controls to exclude (export/email/picker).
