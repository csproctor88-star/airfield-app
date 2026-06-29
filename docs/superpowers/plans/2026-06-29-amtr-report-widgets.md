# AMTR Report Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four new AMTR dashboard widgets (Unit KPIs, Overdue Training, Due Soon, Inspection Status) and retitle the existing one to "AMTR — Currency," each addable individually from the Add-Widget palette and gated by `amtr:view`.

**Architecture:** Pure, unit-tested row/KPI builders in `lib/amtr/` feed three new `TableWidgetDescriptor`s (reusing the Phase-4 table framework) plus one native KPI summary widget (matching the existing `report-*` widgets). No DB migration — all data comes from existing AMTR tables. The existing `amtr` widget keeps its type key (back-compat) and only its title changes.

**Tech Stack:** Next.js 14 / React 18 / TypeScript, Supabase client, the dashboard table framework (`lib/dashboard/table/`), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-29-amtr-report-widgets-design.md`

---

## Reference facts (verified against the codebase)

- **Members:** `fetchAmtrMembers(baseId)` → `AmtrMember[]` (`id, full_name, grade, dafsc, status`). `AmtrMemberStatus = 'Active'|'Reserve'|'Guard'|'Civilian'|'Contractor'|'Separated'`.
- **Progress:** `fetchAmtrByBase<T>(table, baseId, orderBy='sort_order')` → `T[]`.
  - `amtr_1098_progress`: `member_id, catalog_id, next_due, last_completed`.
  - `amtr_rat_progress`: `member_id, catalog_id, due, completed`.
- **Catalogs (item labels):** `amtr_1098_catalog`: `id, task`. `amtr_rat_catalog`: `id, course`.
- **Status helpers (`lib/amtr/status.ts`):** `dueStatus({dueDate, completedDate}, today?) → 'complete'|'due_soon'|'overdue'|'upcoming'`, `DUE_SOON_DAYS = 30`, `ratApplies(status) → boolean`, `parseDate`, `daysBetween`.
- **KPIs (`lib/amtr/rollup.ts`):** `buildUnitKpis(members: {status}[], recurringItems: {memberStatus, isRat, dueDate?, completedDate?}[], today?) → {members, requiredTasks, complete, dueSoon, overdue}`.
- **Inspections (`lib/supabase/amtr-inspections.ts`):** `fetchAmtrInspections(baseId)` → `AmtrInspection[]` with `member_id, inspection_date, status('draft'|'completed'), no_count, gap_count, completed_by_name`. Findings = `no_count + gap_count`.
- **Table descriptor (`lib/dashboard/table/types.ts`):** `{ columns?, useColumns?, filters, extras?, row, footerHref?, newHref?, summary?, useRows }`. `ColumnDef = {key,label,accessor,format?,defaultVisible?,mono?,align?}`. `RowBehavior = {mode:'deeplink', href:(row)=>string}`. `SummaryStat = {count,label,tone?:'accent'|'warning'|'danger'|'muted'}`.
- **Registry (`lib/dashboard/registry.tsx`):** `tableWidget(meta, descriptor)` helper for table widgets; native widgets are literal `WidgetDef` objects. `PERM.AMTR_VIEW = 'amtr:view'`. Icons already imported: `AlertTriangle, Clock, ClipboardList, GraduationCap, ShieldCheck, TrendingUp`.
- **Deep-link route:** `/amtr/<memberId>` exists; `/amtr/<memberId>/inspect` also exists.

---

## File structure

**Create**
- `lib/amtr/report-rows.ts` — pure builders (`buildDueItemRows`, `latestInspectionPerMember`) + their types.
- `tests/amtr-report-rows.test.ts` — unit tests for the builders.
- `lib/dashboard/table/descriptors/amtr-due-items.tsx` — shared fetch hook + `amtrOverdueDescriptor` + `amtrDueSoonDescriptor`.
- `lib/dashboard/table/descriptors/amtr-inspections.tsx` — `amtrInspectionsDescriptor`.
- `components/dashboard/widgets/amtr-kpis-widget.tsx` — `AmtrKpisWidget` (native summary).

**Modify**
- `lib/dashboard/registry.tsx` — retitle `amtr`; add 4 entries + imports.
- `tests/dashboard-table-descriptors.test.ts` — cover the 3 new descriptors.

---

## Task 1: Pure row/KPI builders (`lib/amtr/report-rows.ts`)

**Files:**
- Create: `lib/amtr/report-rows.ts`
- Test: `tests/amtr-report-rows.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/amtr-report-rows.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildDueItemRows, latestInspectionPerMember } from '@/lib/amtr/report-rows'

const TODAY = new Date('2026-06-29T00:00:00Z')
const members = [
  { id: 'm1', full_name: 'Alpha, A', grade: 'MSgt', status: 'Active' },
  { id: 'm2', full_name: 'Bravo, B', grade: 'TSgt', status: 'Civilian' }, // RAT-exempt
]
const cat1098 = [{ id: 'c1', task: 'Self-Inspection Program' }]
const catRat = [{ id: 'r1', course: 'OPSEC Awareness' }]

describe('buildDueItemRows', () => {
  it('classifies overdue/due_soon and resolves the item label', () => {
    const p1098 = [
      { member_id: 'm1', catalog_id: 'c1', next_due: '2026-06-01', last_completed: '2025-06-01' }, // overdue
    ]
    const pRat = [
      { member_id: 'm1', catalog_id: 'r1', due: '2026-07-10', completed: null }, // due_soon (11d)
    ]
    const rows = buildDueItemRows(members, p1098, pRat, cat1098, catRat, TODAY)
    expect(rows).toHaveLength(2)
    const overdue = rows.find(r => r.type === '1098')!
    expect(overdue.itemName).toBe('Self-Inspection Program')
    expect(overdue.status).toBe('overdue')
    expect(overdue.daysUntilDue).toBeLessThan(0)
    expect(overdue.memberName).toBe('Alpha, A')
    const dueSoon = rows.find(r => r.type === 'RAT')!
    expect(dueSoon.status).toBe('due_soon')
    expect(dueSoon.daysUntilDue).toBe(11)
  })

  it('skips RAT items for RAT-exempt members', () => {
    const pRat = [{ member_id: 'm2', catalog_id: 'r1', due: '2026-06-01', completed: null }]
    const rows = buildDueItemRows(members, [], pRat, cat1098, catRat, TODAY)
    expect(rows).toHaveLength(0)
  })

  it('skips progress rows whose member is absent', () => {
    const p1098 = [{ member_id: 'ghost', catalog_id: 'c1', next_due: '2026-06-01', last_completed: null }]
    expect(buildDueItemRows(members, p1098, [], cat1098, catRat, TODAY)).toHaveLength(0)
  })
})

describe('latestInspectionPerMember', () => {
  const inspections = [
    { member_id: 'm1', inspection_date: '2026-05-01', status: 'completed' as const, no_count: 1, gap_count: 1, completed_by_name: 'SSgt Cee' },
    { member_id: 'm1', inspection_date: '2026-06-15', status: 'completed' as const, no_count: 0, gap_count: 0, completed_by_name: 'SSgt Dee' },
    { member_id: 'm1', inspection_date: '2026-06-20', status: 'draft' as const, no_count: 5, gap_count: 5, completed_by_name: null },
  ]
  it('picks the latest COMPLETED inspection and computes result', () => {
    const rows = latestInspectionPerMember([members[0]], inspections)
    expect(rows).toHaveLength(1)
    expect(rows[0].lastDate).toBe('2026-06-15')   // ignores the later draft
    expect(rows[0].result).toBe('clean')           // no_count+gap_count === 0
    expect(rows[0].findings).toBe(0)
    expect(rows[0].inspector).toBe('SSgt Dee')
  })
  it('reports findings count when present', () => {
    const rows = latestInspectionPerMember([members[0]], [inspections[0]])
    expect(rows[0].result).toBe('findings')
    expect(rows[0].findings).toBe(2)
  })
  it('marks members with no completed inspection as none', () => {
    const rows = latestInspectionPerMember([members[1]], inspections)
    expect(rows[0].result).toBe('none')
    expect(rows[0].lastDate).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/amtr-report-rows.test.ts`
Expected: FAIL — cannot import `@/lib/amtr/report-rows` (module not found).

- [ ] **Step 3: Write the implementation**

Create `lib/amtr/report-rows.ts`:

```ts
// ─────────────────────────────────────────────────────────────
// AMTR dashboard report rows — pure functions, unit-tested.
// Turn member + progress + catalog (+ inspection) data into the
// row shapes the Overdue / Due Soon / Inspection Status widgets render.
// ─────────────────────────────────────────────────────────────

import { dueStatus, ratApplies, parseDate, daysBetween, type DueStatus } from './status'

export type AmtrMemberLite = { id: string; full_name: string; grade: string | null; status: string }
export type Prog1098Row = { member_id: string; catalog_id: string; next_due: string | null; last_completed: string | null }
export type ProgRatRow = { member_id: string; catalog_id: string; due: string | null; completed: string | null }
export type Catalog1098Row = { id: string; task: string }
export type CatalogRatRow = { id: string; course: string }

export type DueItemRow = {
  id: string                  // stable unique row id
  memberId: string
  memberName: string
  grade: string | null
  itemName: string
  type: '1098' | 'RAT'
  dueDate: string | null
  status: DueStatus
  daysUntilDue: number | null // due − today; negative = overdue
}

/** Every recurring 1098 + RAT item for the unit, classified and labeled.
 *  RAT items are skipped for RAT-exempt members; rows with an unknown member
 *  are dropped. Callers filter by `status` for the Overdue / Due Soon widgets. */
export function buildDueItemRows(
  members: AmtrMemberLite[],
  p1098: Prog1098Row[],
  pRat: ProgRatRow[],
  cat1098: Catalog1098Row[],
  catRat: CatalogRatRow[],
  today: Date = new Date(),
): DueItemRow[] {
  const memberById = new Map(members.map(m => [m.id, m]))
  const taskById = new Map(cat1098.map(c => [c.id, c.task]))
  const courseById = new Map(catRat.map(c => [c.id, c.course]))
  const todayUtc = parseDate(today.toISOString().slice(0, 10))!
  const daysUntil = (d: string | null): number | null => {
    const due = parseDate(d)
    return due ? daysBetween(todayUtc, due) : null
  }
  const rows: DueItemRow[] = []

  for (const r of p1098) {
    const m = memberById.get(r.member_id)
    if (!m) continue
    rows.push({
      id: `1098:${r.member_id}:${r.catalog_id}`,
      memberId: r.member_id, memberName: m.full_name, grade: m.grade,
      itemName: taskById.get(r.catalog_id) ?? '—',
      type: '1098', dueDate: r.next_due,
      status: dueStatus({ dueDate: r.next_due, completedDate: r.last_completed }, today),
      daysUntilDue: daysUntil(r.next_due),
    })
  }

  for (const r of pRat) {
    const m = memberById.get(r.member_id)
    if (!m) continue
    if (!ratApplies(m.status)) continue
    rows.push({
      id: `RAT:${r.member_id}:${r.catalog_id}`,
      memberId: r.member_id, memberName: m.full_name, grade: m.grade,
      itemName: courseById.get(r.catalog_id) ?? '—',
      type: 'RAT', dueDate: r.due,
      status: dueStatus({ dueDate: r.due, completedDate: r.completed }, today),
      daysUntilDue: daysUntil(r.due),
    })
  }

  return rows
}

export type AmtrInspectionLite = {
  member_id: string
  inspection_date: string
  status: 'draft' | 'completed'
  no_count: number
  gap_count: number
  completed_by_name: string | null
}

export type InspectionRow = {
  id: string
  memberId: string
  memberName: string
  grade: string | null
  lastDate: string | null
  result: 'clean' | 'findings' | 'none'
  findings: number
  inspector: string | null
}

/** One row per member: their latest COMPLETED monthly self-inspection (drafts
 *  ignored). Members with no completed inspection are `result: 'none'`. */
export function latestInspectionPerMember(
  members: AmtrMemberLite[],
  inspections: AmtrInspectionLite[],
): InspectionRow[] {
  const latest = new Map<string, AmtrInspectionLite>()
  for (const i of inspections) {
    if (i.status !== 'completed') continue
    const cur = latest.get(i.member_id)
    // YYYY-MM-DD strings compare lexicographically by date.
    if (!cur || i.inspection_date > cur.inspection_date) latest.set(i.member_id, i)
  }
  return members.map(m => {
    const insp = latest.get(m.id)
    const findings = insp ? insp.no_count + insp.gap_count : 0
    return {
      id: m.id, memberId: m.id, memberName: m.full_name, grade: m.grade,
      lastDate: insp?.inspection_date ?? null,
      result: !insp ? 'none' : findings > 0 ? 'findings' : 'clean',
      findings,
      inspector: insp?.completed_by_name ?? null,
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/amtr-report-rows.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add lib/amtr/report-rows.ts tests/amtr-report-rows.test.ts
git commit -m "feat(amtr): pure row builders for dashboard report widgets"
```

---

## Task 2: Overdue + Due Soon descriptors (`amtr-due-items.tsx`)

**Files:**
- Create: `lib/dashboard/table/descriptors/amtr-due-items.tsx`
- Modify: `tests/dashboard-table-descriptors.test.ts`

- [ ] **Step 1: Write the implementation**

Create `lib/dashboard/table/descriptors/amtr-due-items.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { fetchAmtrMembers, fetchAmtrByBase } from '@/lib/supabase/amtr'
import {
  buildDueItemRows,
  type DueItemRow, type Prog1098Row, type ProgRatRow, type Catalog1098Row, type CatalogRatRow,
} from '@/lib/amtr/report-rows'
import type { TableWidgetDescriptor, ColumnDef, FilterDef } from '@/lib/dashboard/table/types'

// ── Shared fetch: every classified due item for the unit ─────────
function useAllDueItems(): { all: DueItemRow[]; loading: boolean } {
  const { installationId } = useInstallation()
  const [all, setAll] = useState<DueItemRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    setLoading(true)
    Promise.all([
      fetchAmtrMembers(installationId),
      fetchAmtrByBase<Prog1098Row>('amtr_1098_progress', installationId, 'member_id'),
      fetchAmtrByBase<ProgRatRow>('amtr_rat_progress', installationId, 'member_id'),
      fetchAmtrByBase<Catalog1098Row>('amtr_1098_catalog', installationId),
      fetchAmtrByBase<CatalogRatRow>('amtr_rat_catalog', installationId),
    ]).then(([members, p1098, pRat, cat1098, catRat]) => {
      setAll(buildDueItemRows(members, p1098, pRat, cat1098, catRat))
      setLoading(false)
    })
  }, [installationId])

  return { all, loading }
}

// ── Shared columns ───────────────────────────────────────────────
const baseColumns: ColumnDef<DueItemRow>[] = [
  { key: 'memberName', label: 'Member', accessor: r => r.memberName, defaultVisible: true },
  { key: 'grade', label: 'Grade', accessor: r => r.grade ?? '—', defaultVisible: true },
  { key: 'itemName', label: 'Item', accessor: r => r.itemName, defaultVisible: true },
  { key: 'type', label: 'Type', accessor: r => r.type, defaultVisible: true },
  { key: 'dueDate', label: 'Due', accessor: r => r.dueDate ?? '—', defaultVisible: true, mono: true },
]

const typeFilter: FilterDef<DueItemRow> = {
  key: 'type',
  label: 'Type',
  kind: 'enum-multi',
  options: [{ value: '1098', label: '1098' }, { value: 'RAT', label: 'RAT' }],
  predicate: (r, sel) => (sel as string[]).includes(r.type),
}

const distinctMembers = (rows: DueItemRow[]) => new Set(rows.map(r => r.memberId)).size

// ── Overdue Training ─────────────────────────────────────────────
function useOverdueRows() {
  const { all, loading } = useAllDueItems()
  const rows = all
    .filter(r => r.status === 'overdue')
    .sort((a, b) => (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0)) // most overdue first
  return { rows, loading }
}

export const amtrOverdueDescriptor: TableWidgetDescriptor<DueItemRow> = {
  columns: [
    ...baseColumns,
    { key: 'daysOverdue', label: 'Days Overdue', accessor: r => (r.daysUntilDue == null ? 0 : Math.abs(r.daysUntilDue)), defaultVisible: true, mono: true, align: 'right' },
  ],
  filters: [typeFilter],
  row: { mode: 'deeplink', href: r => `/amtr/${r.memberId}` },
  summary: rows => [
    { count: rows.length, label: 'overdue', tone: 'danger' },
    { count: distinctMembers(rows), label: 'members' },
  ],
  footerHref: '/amtr',
  useRows: () => useOverdueRows(),
}

// ── Due Soon (next 30 days) ──────────────────────────────────────
function useDueSoonRows() {
  const { all, loading } = useAllDueItems()
  const rows = all
    .filter(r => r.status === 'due_soon')
    .sort((a, b) => (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0)) // soonest first
  return { rows, loading }
}

export const amtrDueSoonDescriptor: TableWidgetDescriptor<DueItemRow> = {
  columns: [
    ...baseColumns,
    { key: 'daysLeft', label: 'Days Left', accessor: r => r.daysUntilDue ?? 0, defaultVisible: true, mono: true, align: 'right' },
  ],
  filters: [typeFilter],
  row: { mode: 'deeplink', href: r => `/amtr/${r.memberId}` },
  summary: rows => [
    { count: rows.length, label: 'due within 30 days', tone: 'warning' },
    { count: distinctMembers(rows), label: 'members' },
  ],
  footerHref: '/amtr',
  useRows: () => useDueSoonRows(),
}
```

- [ ] **Step 2: Add both descriptors to the invariants test**

In `tests/dashboard-table-descriptors.test.ts`, add imports and entries:

```ts
import { amtrOverdueDescriptor, amtrDueSoonDescriptor } from '@/lib/dashboard/table/descriptors/amtr-due-items'
```

and extend the `staticDescriptors` array:

```ts
const staticDescriptors = [
  { name: 'discrepancies', d: discrepanciesDescriptor },
  { name: 'personnel', d: personnelDescriptor },
  { name: 'amtr-overdue', d: amtrOverdueDescriptor },
  { name: 'amtr-due-soon', d: amtrDueSoonDescriptor },
]
```

- [ ] **Step 3: Run the descriptor invariants test**

Run: `npx vitest run tests/dashboard-table-descriptors.test.ts`
Expected: PASS (now covers 4 descriptors — unique keys, one-of-columns/useColumns, has a default column).

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit` (exit 0), then `npm run build` (RC 0).

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/table/descriptors/amtr-due-items.tsx tests/dashboard-table-descriptors.test.ts
git commit -m "feat(amtr): Overdue Training + Due Soon dashboard descriptors"
```

---

## Task 3: Inspection Status descriptor (`amtr-inspections.tsx`)

**Files:**
- Create: `lib/dashboard/table/descriptors/amtr-inspections.tsx`
- Modify: `tests/dashboard-table-descriptors.test.ts`

- [ ] **Step 1: Write the implementation**

Create `lib/dashboard/table/descriptors/amtr-inspections.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { fetchAmtrMembers } from '@/lib/supabase/amtr'
import { fetchAmtrInspections } from '@/lib/supabase/amtr-inspections'
import { latestInspectionPerMember, type InspectionRow } from '@/lib/amtr/report-rows'
import type { TableWidgetDescriptor } from '@/lib/dashboard/table/types'

function resultBadge(v: unknown): React.ReactNode {
  const row = v as InspectionRow
  if (row.result === 'none') {
    return <span style={{ color: 'var(--color-text-3)' }}>Never inspected</span>
  }
  if (row.result === 'findings') {
    return <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>{row.findings} findings</span>
  }
  return <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Clean</span>
}

function useRows() {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<InspectionRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    setLoading(true)
    Promise.all([
      fetchAmtrMembers(installationId),
      fetchAmtrInspections(installationId),
    ]).then(([members, inspections]) => {
      setRows(latestInspectionPerMember(members, inspections))
      setLoading(false)
    })
  }, [installationId])

  return { rows, loading }
}

export const amtrInspectionsDescriptor: TableWidgetDescriptor<InspectionRow> = {
  columns: [
    { key: 'memberName', label: 'Member', accessor: r => r.memberName, defaultVisible: true },
    { key: 'grade', label: 'Grade', accessor: r => r.grade ?? '—', defaultVisible: true },
    { key: 'lastDate', label: 'Last Inspection', accessor: r => r.lastDate ?? '—', defaultVisible: true, mono: true },
    { key: 'result', label: 'Result', accessor: r => r, format: resultBadge, defaultVisible: true },
    { key: 'inspector', label: 'Inspector', accessor: r => r.inspector ?? '—', defaultVisible: true },
  ],
  filters: [
    {
      key: 'result',
      label: 'Result',
      kind: 'enum-multi',
      options: [
        { value: 'clean', label: 'Clean' },
        { value: 'findings', label: 'Has findings' },
        { value: 'none', label: 'Never inspected' },
      ],
      predicate: (r, sel) => (sel as string[]).includes(r.result),
    },
  ],
  row: { mode: 'deeplink', href: r => `/amtr/${r.memberId}` },
  summary: rows => {
    const inspected = rows.filter(r => r.result !== 'none').length
    const withFindings = rows.filter(r => r.result === 'findings').length
    return [
      { count: inspected, label: `of ${rows.length} inspected` },
      ...(withFindings > 0 ? [{ count: withFindings, label: 'with findings', tone: 'warning' as const }] : []),
    ]
  },
  footerHref: '/amtr',
  useRows,
}
```

- [ ] **Step 2: Add the descriptor to the invariants test**

In `tests/dashboard-table-descriptors.test.ts`, add the import and array entry:

```ts
import { amtrInspectionsDescriptor } from '@/lib/dashboard/table/descriptors/amtr-inspections'
```

```ts
  { name: 'amtr-inspections', d: amtrInspectionsDescriptor },
```

- [ ] **Step 3: Run the invariants test**

Run: `npx vitest run tests/dashboard-table-descriptors.test.ts`
Expected: PASS (now 5 descriptors covered).

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit` (exit 0), then `npm run build` (RC 0).

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/table/descriptors/amtr-inspections.tsx tests/dashboard-table-descriptors.test.ts
git commit -m "feat(amtr): Inspection Status dashboard descriptor"
```

---

## Task 4: Unit KPIs native widget (`amtr-kpis-widget.tsx`)

**Files:**
- Create: `components/dashboard/widgets/amtr-kpis-widget.tsx`

- [ ] **Step 1: Write the implementation**

Create `components/dashboard/widgets/amtr-kpis-widget.tsx` (modeled on `report-aging-widget.tsx`):

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchAmtrMembers, fetchAmtrByBase } from '@/lib/supabase/amtr'
import { buildUnitKpis, type UnitKpis } from '@/lib/amtr/rollup'

type Prog1098 = { member_id: string; next_due: string | null; last_completed: string | null }
type ProgRat = { member_id: string; due: string | null; completed: string | null }

function Tile({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: color ?? 'var(--color-text-1)' }}>{value}</div>
    </div>
  )
}

export function AmtrKpisWidget() {
  const { installationId } = useInstallation()
  const [kpis, setKpis] = useState<UnitKpis | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!installationId) return
    setLoading(true)
    Promise.all([
      fetchAmtrMembers(installationId),
      fetchAmtrByBase<Prog1098>('amtr_1098_progress', installationId, 'member_id'),
      fetchAmtrByBase<ProgRat>('amtr_rat_progress', installationId, 'member_id'),
    ]).then(([members, p1098, pRat]) => {
      const statusOf = new Map(members.map(m => [m.id, m.status]))
      const recurring: { memberStatus: string; isRat: boolean; dueDate?: string | null; completedDate?: string | null }[] = []
      for (const r of p1098) recurring.push({ memberStatus: statusOf.get(r.member_id) ?? 'Active', isRat: false, dueDate: r.next_due, completedDate: r.last_completed })
      for (const r of pRat) recurring.push({ memberStatus: statusOf.get(r.member_id) ?? 'Active', isRat: true, dueDate: r.due, completedDate: r.completed })
      setKpis(buildUnitKpis(members, recurring))
      setLoading(false)
    })
  }, [installationId])

  const k = kpis ?? { members: 0, requiredTasks: 0, complete: 0, dueSoon: 0, overdue: 0 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end', flex: 1 }}>
        <Tile label="Members" value={loading ? '…' : k.members} />
        <Tile label="Required" value={loading ? '…' : k.requiredTasks} />
        <Tile label="Complete" value={loading ? '…' : k.complete} color="var(--color-success)" />
        <Tile label="Due Soon" value={loading ? '…' : k.dueSoon} color={k.dueSoon > 0 ? 'var(--color-warning)' : undefined} />
        <Tile label="Overdue" value={loading ? '…' : k.overdue} color={k.overdue > 0 ? 'var(--color-danger)' : undefined} />
      </div>
      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
        <Link href="/amtr" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none' }}>Open AMTR →</Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check + build**

Run: `npx tsc --noEmit` (exit 0), then `npm run build` (RC 0).

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/widgets/amtr-kpis-widget.tsx
git commit -m "feat(amtr): Unit KPIs dashboard widget"
```

---

## Task 5: Register the four widgets + retitle Currency (`registry.tsx`)

**Files:**
- Modify: `lib/dashboard/registry.tsx`

- [ ] **Step 1: Add imports**

After the existing `import { amtrDescriptor } ...` line, add:

```tsx
import { amtrOverdueDescriptor, amtrDueSoonDescriptor } from '@/lib/dashboard/table/descriptors/amtr-due-items'
import { amtrInspectionsDescriptor } from '@/lib/dashboard/table/descriptors/amtr-inspections'
```

After the existing `import { ReportDailyWidget } ...` line, add:

```tsx
import { AmtrKpisWidget } from '@/components/dashboard/widgets/amtr-kpis-widget'
```

- [ ] **Step 2: Retitle the existing AMTR widget + add the four entries**

Replace the existing `'amtr': tableWidget({ ... }, amtrDescriptor),` block with:

```tsx
  'amtr': tableWidget({
    type: 'amtr', title: 'AMTR — Currency',
    description: 'Airfield Management Training Record — currency status by member',
    icon: GraduationCap, defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 },
    permission: PERM.AMTR_VIEW,
    moduleHref: '/amtr',
  }, amtrDescriptor),
  'amtr-kpis': {
    type: 'amtr-kpis', kind: 'native', title: 'AMTR — Unit KPIs',
    description: 'Members, required tasks, complete, due soon, and overdue at a glance',
    icon: TrendingUp, defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
    permission: PERM.AMTR_VIEW,
    moduleHref: '/amtr',
    Component: () => <AmtrKpisWidget />,
    ConfigForm: TitleConfigForm,
  },
  'amtr-overdue': tableWidget({
    type: 'amtr-overdue', title: 'AMTR — Overdue Training',
    description: 'Members with overdue 1098 / RAT items',
    icon: AlertTriangle, defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 },
    permission: PERM.AMTR_VIEW,
    moduleHref: '/amtr',
  }, amtrOverdueDescriptor),
  'amtr-due-soon': tableWidget({
    type: 'amtr-due-soon', title: 'AMTR — Due Soon (30 days)',
    description: 'Recurring training coming due in the next 30 days',
    icon: Clock, defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 },
    permission: PERM.AMTR_VIEW,
    moduleHref: '/amtr',
  }, amtrDueSoonDescriptor),
  'amtr-inspections': tableWidget({
    type: 'amtr-inspections', title: 'AMTR — Inspection Status',
    description: 'Each member\'s latest monthly record self-inspection',
    icon: ShieldCheck, defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 },
    permission: PERM.AMTR_VIEW,
    moduleHref: '/amtr',
  }, amtrInspectionsDescriptor),
```

- [ ] **Step 3: Type-check + build**

Run: `npx tsc --noEmit` (exit 0), then `npm run build` (RC 0).
Expected: `/dashboard` compiles; the four new widgets are in `WIDGETS`.

- [ ] **Step 4: Commit**

```bash
git add lib/dashboard/registry.tsx
git commit -m "feat(amtr): register four AMTR report widgets; retitle Currency"
```

---

## Task 6: Full verification

- [ ] **Step 1: Run the whole test suite**

Run: `npx vitest run`
Expected: all pass (previous total + 6 new builder tests; descriptor-invariants count increased).

- [ ] **Step 2: Type-check + production build**

Run: `npx tsc --noEmit` (exit 0), then `npm run build` (RC 0, 113+ pages).

- [ ] **Step 3: Manual smoke (after deploy/preview)**

On `/dashboard`, Edit → Add Widget: confirm the palette shows **AMTR — Currency, AMTR — Unit KPIs, AMTR — Overdue Training, AMTR — Due Soon (30 days), AMTR — Inspection Status** (only for `amtr:view` roles on an AMTR-enabled base). Add each; confirm data renders, filters/sort/search/resize work on the tables, a row click deep-links to `/amtr/<memberId>`, and Unit KPIs shows tiles + "Open AMTR →".

---

## Self-review

- **Spec coverage:** Currency retitle (Task 5) ✓; Unit KPIs (Task 4) ✓; Overdue (Task 2) ✓; Due Soon (Task 2) ✓; Inspection Status (Task 3) ✓; gating `amtr:view` on every entry (Task 5) ✓; per-row deep-links to `/amtr/<memberId>` on all four table widgets (Tasks 2/3) ✓; no migration ✓; back-compat (type key `amtr` unchanged) ✓; pure builders unit-tested + descriptor invariants extended (Tasks 1–3) ✓.
- **Placeholders:** none — every step has complete code/commands.
- **Type consistency:** `DueItemRow`, `InspectionRow`, `AmtrInspectionLite` defined in Task 1 and used unchanged in Tasks 2–3; `fetchAmtrByBase(table, baseId, orderBy)`, `fetchAmtrInspections(baseId)`, `buildUnitKpis(members, recurring)` signatures match the codebase; `SummaryStat.tone` values (`'danger'|'warning'`) and `ColumnDef.align` (`'right'`) match `types.ts`.
- **Note:** `AmtrInspection` (full type from `amtr-inspections.ts`) is structurally assignable to `AmtrInspectionLite`, so `latestInspectionPerMember(members, inspections)` accepts the fetch result directly.
