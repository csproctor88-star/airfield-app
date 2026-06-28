# Phase 4 — Configurable Native Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard's eight list-style widgets configurable (columns, filters, rename, and — for PPR & Personnel — a row detail dialog with a record action), all through one shared declarative table framework.

**Architecture:** A pure `TableWidgetDescriptor` (columns, filters, extras, row behavior, `useRows`) drives one generic renderer (`TableWidget`), one generic config form (`TableConfigForm`), and one detail dialog (`RowDetailDialog`). Pure logic lives in `lib/dashboard/table/`; React in `components/dashboard/table/`. Detail-dialog actions route through the existing offline write queue via two new ops. No DB migration — widget `config` JSONB gains optional `columns`/`filters`/`extras` keys, and pre-Phase-4 widgets render descriptor defaults (back-compat).

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript strict, vitest, the existing `lib/sync` offline write queue, `lib/dashboard/*` registry.

**Spec:** `docs/superpowers/specs/2026-06-27-phase4-configurable-widgets-design.md`

**Conventions (from CLAUDE.md + memory):**
- Build gate before every commit you mark done: `npx tsc --noEmit` **and** `npm run build` both RC 0 (vitest passing ≠ build green). Run `npx vitest run <file>` for the touched test.
- tsc target rejects `Map`/`Set` iteration — use `Array.from(...)`.
- Co-author trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Theme tokens only (`var(--color-*)`, `var(--fs-*)`) — no raw hex.
- New write surfaces route through the offline queue — never direct CRUD.

---

## File Structure

**New — pure logic (`lib/dashboard/table/`):**
- `types.ts` — `ColumnDef`, `FilterDef`, `ExtraConfigDef`, `DetailField`, `RowAction`, `RowActionCtx`, `RowBehavior`, `SummaryStat`, `TableWidgetDescriptor`, `TableWidgetConfig`.
- `filtering.ts` — `applyFilters(rows, config, descriptor)` (pure).
- `columns.ts` — `resolveVisibleColumns(allColumns, config)` (pure).
- `config.ts` — `normalizeTableConfig(raw, descriptor, allColumns)` (pure trust boundary).

**New — descriptors (`lib/dashboard/table/descriptors/`):** `discrepancies.tsx`, `ppr.tsx`, `personnel.tsx`, `notams.tsx`, `ces.tsx`, `events-log.tsx`, `waivers.tsx`, `daily-reviews.tsx`.

**New — React (`components/dashboard/table/`):**
- `table-widget.tsx` — generic renderer.
- `table-config-form.tsx` — generic gear form.
- `row-detail-dialog.tsx` — detail + actions.
- `title-config-form.tsx` — rename-only fallback form.

**New — write helpers:** `lib/dashboard/row-actions.ts` (depart PPR / update contractor status via queue).

**New — tests (`__tests__/` colocated per existing convention — match where `dashboard-layout` etc. live):** `dashboard-table-filtering`, `dashboard-table-columns`, `dashboard-table-config`, `dashboard-table-descriptors`, plus extension of the existing sync-handlers test.

**Modified:**
- `lib/sync/types.ts` — add `'ppr_depart'`, `'contractor_status_update'` to `WriteType`.
- `lib/sync/handlers.ts` — add two handlers + register them.
- `lib/dashboard/widget-registry.ts` — add `'table'` to `WidgetKind`.
- `lib/dashboard/registry.tsx` — `tableWidget()` helper, convert 8 entries, attach `TitleConfigForm` to bare native widgets.
- Delete after conversion: the 8 widget component files in `components/dashboard/widgets/` (their fetch logic moves into descriptors). Keep until each descriptor replaces it.

> **Test convention (confirmed):** all unit tests live in the top-level `tests/` directory as `tests/<name>.test.ts` (e.g. `tests/dashboard-layout.test.ts`). The offline-queue handler test is `tests/write-queue-handlers.test.ts`. New test files below use these exact paths.

---

## Phase 1 — Framework (no widget converted yet; rename ships to all)

### Task 1: Descriptor + config types

**Files:**
- Create: `lib/dashboard/table/types.ts`

- [ ] **Step 1: Write the types**

```ts
import type { ReactNode } from 'react'

export interface ColumnDef<Row> {
  key: string
  label: string
  accessor: (row: Row) => unknown
  format?: (v: unknown, row: Row) => ReactNode
  defaultVisible?: boolean
  mono?: boolean
}

export interface FilterDef<Row> {
  key: string
  label: string
  kind: 'enum-multi' | 'status' | 'text'
  options?: { value: string; label: string }[]
  predicate: (row: Row, selected: string[] | string) => boolean
  defaultSelected?: string[] | string
}

export interface ExtraConfigDef {
  key: string
  label: string
  options: { value: string; label: string }[]
  default: string
}

export interface DetailField<Row> {
  label: string
  value: (row: Row) => ReactNode
  hideWhenEmpty?: boolean
}

export interface RowActionCtx {
  baseId: string
  userId: string
}

export interface RowAction<Row> {
  key: string
  label: (row: Row) => string
  permission: string
  visible?: (row: Row) => boolean
  run: (row: Row, ctx: RowActionCtx) => Promise<void>
}

export type RowBehavior<Row> =
  | { mode: 'none' }
  | { mode: 'deeplink'; href: (row: Row) => string }
  | { mode: 'detail'; title: (row: Row) => string; fields: DetailField<Row>[] }
  | { mode: 'detail+actions'; title: (row: Row) => string; fields: DetailField<Row>[]; actions: RowAction<Row>[] }

export interface SummaryStat {
  count: number
  label: string
  tone?: 'accent' | 'warning' | 'danger' | 'muted'
}

export interface TableWidgetConfig {
  title?: string
  columns?: string[]
  filters?: Record<string, string[] | string>
  extras?: Record<string, string>
}

export interface TableWidgetDescriptor<Row> {
  columns?: ColumnDef<Row>[]
  useColumns?: () => ColumnDef<Row>[]
  filters: FilterDef<Row>[]
  extras?: ExtraConfigDef[]
  row: RowBehavior<Row>
  footerHref?: string
  newHref?: string
  summary?: (rows: Row[]) => SummaryStat[]
  useRows: (config: TableWidgetConfig) => { rows: Row[]; loading: boolean }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/dashboard/table/types.ts
git commit -m "feat(dashboard): table widget descriptor types"
```

---

### Task 2: Pure column resolution

**Files:**
- Create: `lib/dashboard/table/columns.ts`
- Test: `tests/dashboard-table-columns.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { resolveVisibleColumns } from '@/lib/dashboard/table/columns'
import type { ColumnDef } from '@/lib/dashboard/table/types'

const cols: ColumnDef<{ a: string; b: string; c: string }>[] = [
  { key: 'a', label: 'A', accessor: r => r.a, defaultVisible: true },
  { key: 'b', label: 'B', accessor: r => r.b, defaultVisible: true },
  { key: 'c', label: 'C', accessor: r => r.c },
]

describe('resolveVisibleColumns', () => {
  it('uses defaultVisible when config has no columns', () => {
    expect(resolveVisibleColumns(cols, undefined).map(c => c.key)).toEqual(['a', 'b'])
  })
  it('honors saved subset and order', () => {
    expect(resolveVisibleColumns(cols, ['c', 'a']).map(c => c.key)).toEqual(['c', 'a'])
  })
  it('drops unknown keys', () => {
    expect(resolveVisibleColumns(cols, ['a', 'zzz']).map(c => c.key)).toEqual(['a'])
  })
  it('falls back to defaults when saved subset is empty', () => {
    expect(resolveVisibleColumns(cols, []).map(c => c.key)).toEqual(['a', 'b'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dashboard-table-columns.test.ts`
Expected: FAIL — `resolveVisibleColumns` not exported.

- [ ] **Step 3: Implement**

```ts
import type { ColumnDef } from './types'

/**
 * Resolve the ordered visible columns. `saved` is config.columns (an ordered
 * list of column keys). Unknown keys are dropped; an empty/undefined result
 * falls back to the descriptor's defaultVisible set.
 */
export function resolveVisibleColumns<Row>(
  all: ColumnDef<Row>[],
  saved: string[] | undefined,
): ColumnDef<Row>[] {
  const byKey = new Map(all.map(c => [c.key, c]))
  if (saved && saved.length) {
    const picked = saved.map(k => byKey.get(k)).filter((c): c is ColumnDef<Row> => !!c)
    if (picked.length) return picked
  }
  return all.filter(c => c.defaultVisible)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dashboard-table-columns.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/table/columns.ts tests/dashboard-table-columns.test.ts
git commit -m "feat(dashboard): pure column resolution for table widgets"
```

---

### Task 3: Pure filtering

**Files:**
- Create: `lib/dashboard/table/filtering.ts`
- Test: `tests/dashboard-table-filtering.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { applyFilters } from '@/lib/dashboard/table/filtering'
import type { FilterDef, TableWidgetConfig } from '@/lib/dashboard/table/types'

type R = { type: string; status: string; name: string }
const rows: R[] = [
  { type: 'lighting', status: 'open', name: 'Alpha' },
  { type: 'pavement', status: 'open', name: 'Bravo' },
  { type: 'lighting', status: 'completed', name: 'Charlie' },
]
const filters: FilterDef<R>[] = [
  { key: 'type', label: 'Type', kind: 'enum-multi',
    predicate: (r, sel) => (sel as string[]).includes(r.type) },
  { key: 'status', label: 'Status', kind: 'status', defaultSelected: ['open'],
    predicate: (r, sel) => (sel as string[]).includes(r.status) },
  { key: 'q', label: 'Search', kind: 'text',
    predicate: (r, sel) => r.name.toLowerCase().includes((sel as string).toLowerCase()) },
]
const run = (config: TableWidgetConfig) => applyFilters(rows, config, filters).map(r => r.name)

describe('applyFilters', () => {
  it('empty enum selection is passthrough (no filter)', () => {
    expect(run({ filters: { type: [] } })).toEqual(['Alpha', 'Bravo', 'Charlie'].filter(n => n !== 'Charlie'))
  })
  it('applies the status default when unset', () => {
    // status defaults to ['open'] → Charlie (completed) excluded
    expect(run({})).toEqual(['Alpha', 'Bravo'])
  })
  it('enum-multi is OR within a key', () => {
    expect(run({ filters: { type: ['lighting', 'pavement'], status: ['open', 'completed'] } }))
      .toEqual(['Alpha', 'Bravo', 'Charlie'])
  })
  it('AND across keys', () => {
    expect(run({ filters: { type: ['lighting'], status: ['open', 'completed'] } }))
      .toEqual(['Alpha', 'Charlie'])
  })
  it('text contains; empty string is passthrough', () => {
    expect(run({ filters: { status: ['open', 'completed'], q: 'a' } })).toEqual(['Alpha', 'Charlie'])
    expect(run({ filters: { status: ['open', 'completed'], q: '' } })).toEqual(['Alpha', 'Bravo', 'Charlie'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dashboard-table-filtering.test.ts`
Expected: FAIL — `applyFilters` not exported.

- [ ] **Step 3: Implement**

```ts
import type { FilterDef, TableWidgetConfig } from './types'

function selectionFor<Row>(f: FilterDef<Row>, config: TableWidgetConfig): string[] | string {
  const raw = config.filters?.[f.key]
  if (raw !== undefined) return raw
  if (f.defaultSelected !== undefined) return f.defaultSelected
  return f.kind === 'text' ? '' : []
}

function isActive<Row>(f: FilterDef<Row>, selection: string[] | string): boolean {
  if (f.kind === 'text') return (selection as string).trim() !== ''
  return (selection as string[]).length > 0
}

/**
 * Apply every descriptor filter to rows. A filter with an empty selection is a
 * passthrough. Filters AND across keys; within an enum key the predicate decides
 * OR semantics. Pure — no fetch, no React.
 */
export function applyFilters<Row>(
  rows: Row[],
  config: TableWidgetConfig,
  filters: FilterDef<Row>[],
): Row[] {
  const active = filters
    .map(f => ({ f, sel: selectionFor(f, config) }))
    .filter(({ f, sel }) => isActive(f, sel))
  return rows.filter(row => active.every(({ f, sel }) => f.predicate(row, sel)))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dashboard-table-filtering.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/table/filtering.ts tests/dashboard-table-filtering.test.ts
git commit -m "feat(dashboard): pure row filtering for table widgets"
```

---

### Task 4: Config normalization (trust boundary + back-compat)

**Files:**
- Create: `lib/dashboard/table/config.ts`
- Test: `tests/dashboard-table-config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { normalizeTableConfig } from '@/lib/dashboard/table/config'
import type { ColumnDef, FilterDef, ExtraConfigDef } from '@/lib/dashboard/table/types'

type R = { a: string }
const cols: ColumnDef<R>[] = [
  { key: 'a', label: 'A', accessor: r => r.a, defaultVisible: true },
  { key: 'b', label: 'B', accessor: () => '' },
]
const filters: FilterDef<R>[] = [
  { key: 'status', label: 'S', kind: 'status', defaultSelected: ['open'], predicate: () => true },
]
const extras: ExtraConfigDef[] = [
  { key: 'scope', label: 'Scope', default: 'today', options: [{ value: 'today', label: 'T' }, { value: 'all', label: 'A' }] },
]
const d = { columns: cols, filters, extras } as const

describe('normalizeTableConfig', () => {
  it('pre-Phase-4 config (empty) yields descriptor defaults — back-compat', () => {
    const c = normalizeTableConfig({}, d, cols)
    expect(c.columns).toBeUndefined()        // undefined ⇒ renderer uses defaultVisible
    expect(c.filters).toEqual({ status: ['open'] })
    expect(c.extras).toEqual({ scope: 'today' })
  })
  it('drops unknown column keys', () => {
    expect(normalizeTableConfig({ columns: ['a', 'zzz'] }, d, cols).columns).toEqual(['a'])
  })
  it('drops filter keys not in descriptor', () => {
    expect(normalizeTableConfig({ filters: { bogus: ['x'], status: ['completed'] } }, d, cols).filters)
      .toEqual({ status: ['completed'] })
  })
  it('coerces unknown extra value to the default', () => {
    expect(normalizeTableConfig({ extras: { scope: 'nope' } }, d, cols).extras).toEqual({ scope: 'today' })
  })
  it('preserves a valid title', () => {
    expect(normalizeTableConfig({ title: 'Mine' }, d, cols).title).toBe('Mine')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dashboard-table-config.test.ts`
Expected: FAIL — `normalizeTableConfig` not exported.

- [ ] **Step 3: Implement**

```ts
import type { ColumnDef, FilterDef, ExtraConfigDef, TableWidgetConfig } from './types'

interface NormalizableDescriptor<Row> {
  filters: FilterDef<Row>[]
  extras?: ExtraConfigDef[]
}

/**
 * Trust boundary between stored JSON and the renderer (mirrors validateLayout).
 * - columns: keep only known keys (preserve order); undefined when caller passed none.
 * - filters: keep only descriptor keys; fill each descriptor filter's default when absent.
 * - extras: every descriptor extra resolves to a valid option value or its default.
 * Back-compat: an empty raw config returns the descriptor defaults, so a widget
 * saved before Phase 4 renders exactly as it does today.
 */
export function normalizeTableConfig<Row>(
  raw: TableWidgetConfig | undefined | null,
  descriptor: NormalizableDescriptor<Row>,
  allColumns: ColumnDef<Row>[],
): TableWidgetConfig {
  const r = raw ?? {}
  const known = new Set(allColumns.map(c => c.key))
  const columns = Array.isArray(r.columns)
    ? r.columns.filter(k => known.has(k))
    : undefined

  const filters: Record<string, string[] | string> = {}
  for (const f of descriptor.filters) {
    const v = r.filters?.[f.key]
    if (v !== undefined) filters[f.key] = v
    else if (f.defaultSelected !== undefined) filters[f.key] = f.defaultSelected
  }

  const extras: Record<string, string> = {}
  for (const e of descriptor.extras ?? []) {
    const v = r.extras?.[e.key]
    extras[e.key] = e.options.some(o => o.value === v) ? (v as string) : e.default
  }

  return {
    title: typeof r.title === 'string' && r.title.trim() ? r.title : undefined,
    columns: columns && columns.length ? columns : undefined,
    filters: Object.keys(filters).length ? filters : undefined,
    extras: Object.keys(extras).length ? extras : undefined,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dashboard-table-config.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/table/config.ts tests/dashboard-table-config.test.ts
git commit -m "feat(dashboard): table config normalization + back-compat"
```

---

### Task 5: `WidgetKind` gains `'table'`

**Files:**
- Modify: `lib/dashboard/widget-registry.ts:4`

- [ ] **Step 1: Edit the union**

Change:
```ts
export type WidgetKind = 'native' | 'links' | 'embed' | 'analytics'
```
to:
```ts
export type WidgetKind = 'native' | 'links' | 'embed' | 'analytics' | 'table'
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/dashboard/widget-registry.ts
git commit -m "feat(dashboard): add 'table' widget kind"
```

---

### Task 6: Title-only fallback config form (rename — item 5)

**Files:**
- Create: `components/dashboard/table/title-config-form.tsx`

- [ ] **Step 1: Implement** (model on `notes-widget.tsx`'s form styling)

```tsx
'use client'
import { useState } from 'react'
import type { WidgetConfigProps } from '@/lib/dashboard/widget-registry'

/** One-field rename form attached to native widgets that have no richer config. */
export function TitleConfigForm({ config, onSave, onCancel }: WidgetConfigProps) {
  const [title, setTitle] = useState((config.title as string) ?? '')
  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input style={input} placeholder="Widget title (optional)" value={title}
        onChange={e => setTitle(e.target.value)} />
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={() => onSave({ ...config, title: title.trim() || undefined })}
          style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
            background: 'var(--color-accent)', color: '#fff', fontWeight: 700, fontFamily: 'inherit' }}>Save</button>
        <button onClick={onCancel}
          style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', cursor: 'pointer',
            border: '1px solid var(--color-border)', background: 'transparent',
            color: 'var(--color-text-2)', fontFamily: 'inherit' }}>Cancel</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/table/title-config-form.tsx
git commit -m "feat(dashboard): title-only rename fallback form"
```

---

### Task 7: Attach rename fallback to bare native widgets

**Files:**
- Modify: `lib/dashboard/registry.tsx`

- [ ] **Step 1: Import the form** (top of file, with the other widget imports)

```ts
import { TitleConfigForm } from '@/components/dashboard/table/title-config-form'
```

- [ ] **Step 2: Add `ConfigForm: TitleConfigForm` to every native widget that currently has no `ConfigForm`**

These entries (and ONLY these — the ones with no existing `ConfigForm`): `inspection-status`, `open-discrepancies`, `last-check`, `personnel`, `shift-checklist`, `notams`, `ppr-today`, `afm-toggles`, `events-log`, `wildlife`, `waivers`, `users`, `ces`, `daily-reviews`, `infrastructure`, `field-conditions`, `feedback`, `amtr`, `clock`. (Do NOT touch `quick-actions` if it should stay action-only — it has a `config` prop but no form today; ADD the fallback so it gains rename too.) Leave `links`, `embed`, `analytics`, `notes` untouched.

Example edit (`inspection-status`):
```tsx
'inspection-status': {
  type: 'inspection-status', kind: 'native', title: 'Inspection Status',
  description: "Today's airfield + lighting inspections",
  icon: ClipboardList, defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 },
  Component: () => <InspectionStatusWidget />,
  ConfigForm: TitleConfigForm,
},
```

> Widgets being converted to `kind: 'table'` in Phases 2–3 (`open-discrepancies`, `ppr-today`, `personnel`, `notams`, `ces`, `events-log`, `waivers`, `daily-reviews`) will REPLACE this fallback with `TableConfigForm` then. Adding the fallback now means rename works for them in the interim and the diff per later task is smaller.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both exit 0.

- [ ] **Step 4: Manual check**

Run `npm run dev`, open `/dashboard`, enter edit mode, click the gear on a widget that had none before (e.g. Inspection Status) → the rename modal opens, saving a title updates the header.

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/registry.tsx
git commit -m "feat(dashboard): enable rename on all native widgets"
```

---

### Task 8: Generic `RowDetailDialog`

**Files:**
- Create: `components/dashboard/table/row-detail-dialog.tsx`

- [ ] **Step 1: Implement** (reuse the `.modal-overlay`/`.card` pattern from `widget-config-modal.tsx`)

```tsx
'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import type { ReactNode } from 'react'
import type { DetailField, RowAction, RowActionCtx } from '@/lib/dashboard/table/types'

export function RowDetailDialog<Row>({
  row, title, fields, actions, ctx, has, onClose, onActed,
}: {
  row: Row
  title: string
  fields: DetailField<Row>[]
  actions?: RowAction<Row>[]
  ctx: RowActionCtx | null
  has: (perm: string) => boolean
  onClose: () => void
  onActed?: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const visibleActions = (actions ?? []).filter(a => has(a.permission) && (a.visible?.(row) ?? true))

  async function runAction(a: RowAction<Row>) {
    if (!ctx) { toast.error('Cannot determine the current base / user.'); return }
    setBusy(a.key)
    try {
      await a.run(row, ctx)
      onActed?.()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed.')
    } finally {
      setBusy(null)
    }
  }

  const label: React.CSSProperties = { fontSize: 'var(--fs-2xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)' }
  const value: React.CSSProperties = { fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)', wordBreak: 'break-word' }

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card" style={{ width: '100%', maxWidth: 480, padding: 20, maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 12 }}>{title}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {fields.map((f, i) => {
            const v = f.value(row)
            if (f.hideWhenEmpty && (v == null || v === '')) return null
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={label}>{f.label}</span>
                <span style={value}>{(v as ReactNode) ?? '—'}</span>
              </div>
            )
          })}
        </div>
        {visibleActions.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            {visibleActions.map(a => (
              <button key={a.key} disabled={busy !== null} onClick={() => runAction(a)}
                style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', border: 'none',
                  cursor: busy ? 'default' : 'pointer', background: 'var(--color-accent)', color: '#fff',
                  fontWeight: 700, fontFamily: 'inherit', opacity: busy && busy !== a.key ? 0.6 : 1 }}>
                {busy === a.key ? '…' : a.label(row)}
              </button>
            ))}
          </div>
        )}
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <button onClick={onClose} style={{ padding: '7px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
            border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-2)', fontFamily: 'inherit' }}>Close</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/table/row-detail-dialog.tsx
git commit -m "feat(dashboard): generic row detail dialog with gated actions"
```

---

### Task 9: Generic `TableWidget` renderer

**Files:**
- Create: `components/dashboard/table/table-widget.tsx`

Reads `config` (passed by `widget-grid.tsx`), resolves columns/filters via the pure helpers, renders summary header + table + footer, and handles row clicks per `row.mode`. Resolves `RowActionCtx` (baseId from `useInstallation`, userId from `getSession`) and the permission checker for the detail dialog.

- [ ] **Step 1: Implement**

```tsx
'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import { usePermissions } from '@/lib/permissions'
import type { TableWidgetConfig, TableWidgetDescriptor, RowActionCtx, ColumnDef } from '@/lib/dashboard/table/types'
import { resolveVisibleColumns } from '@/lib/dashboard/table/columns'
import { applyFilters } from '@/lib/dashboard/table/filtering'
import { normalizeTableConfig } from '@/lib/dashboard/table/config'
import { RowDetailDialog } from './row-detail-dialog'

export function TableWidget<Row>({
  descriptor, config,
}: { descriptor: TableWidgetDescriptor<Row>; config: Record<string, unknown> }) {
  const { installationId } = useInstallation()
  const { has } = usePermissions()

  const allColumns: ColumnDef<Row>[] = descriptor.useColumns ? descriptor.useColumns() : (descriptor.columns ?? [])
  const cfg: TableWidgetConfig = useMemo(
    () => normalizeTableConfig(config as TableWidgetConfig, descriptor, allColumns),
    [config, descriptor, allColumns],
  )

  const { rows, loading } = descriptor.useRows(cfg)
  const filtered = useMemo(() => applyFilters(rows, cfg, descriptor.filters), [rows, cfg, descriptor.filters])
  const visibleCols = useMemo(() => resolveVisibleColumns(allColumns, cfg.columns), [allColumns, cfg.columns])

  const [userId, setUserId] = useState<string | null>(null)
  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null))
  }, [])
  const ctx: RowActionCtx | null = installationId && userId ? { baseId: installationId, userId } : null

  const [detailRow, setDetailRow] = useState<Row | null>(null)
  const summary = descriptor.summary?.(filtered) ?? []

  function toneColor(tone?: string): string {
    if (tone === 'warning') return 'var(--color-warning)'
    if (tone === 'danger') return 'var(--color-danger)'
    if (tone === 'accent') return 'var(--color-accent)'
    return 'var(--color-text-1)'
  }

  function onRowClick(row: Row) {
    const b = descriptor.row
    if (b.mode === 'deeplink') return // handled by <Link> wrapper
    if (b.mode === 'detail' || b.mode === 'detail+actions') setDetailRow(row)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {summary.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
          {summary.map((s, i) => (
            <span key={i} style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)' }}>
              <b style={{ fontSize: 'var(--fs-sm)', color: toneColor(s.tone) }}>{s.count}</b> {s.label}
            </span>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading && <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>…</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', padding: '6px 0' }}>Nothing to show.</div>
        )}
        {!loading && filtered.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
            <thead>
              <tr>
                {visibleCols.map(c => (
                  <th key={c.key} style={{ textAlign: 'left', padding: '2px 6px 4px 0', fontSize: 'var(--fs-2xs)',
                    color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, ri) => {
                const cells = visibleCols.map(c => {
                  const raw = c.accessor(row)
                  const content = c.format ? c.format(raw, row) : (raw as React.ReactNode) ?? '—'
                  return (
                    <td key={c.key} style={{ padding: '4px 6px 4px 0', color: 'var(--color-text-1)', borderBottom: '1px solid var(--color-border)',
                      fontFamily: c.mono ? 'var(--font-family-mono)' : undefined, maxWidth: 180,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{content}</td>
                  )
                })
                const b = descriptor.row
                if (b.mode === 'deeplink') {
                  return (
                    <tr key={ri} style={{ cursor: 'pointer' }}>
                      <td colSpan={visibleCols.length} style={{ padding: 0 }}>
                        <Link href={b.href(row)} style={{ display: 'table', width: '100%', textDecoration: 'none', tableLayout: 'fixed' }}>
                          <span style={{ display: 'table-row' }}>{cells}</span>
                        </Link>
                      </td>
                    </tr>
                  )
                }
                const clickable = b.mode === 'detail' || b.mode === 'detail+actions'
                return (
                  <tr key={ri} onClick={clickable ? () => onRowClick(row) : undefined}
                    style={{ cursor: clickable ? 'pointer' : 'default' }}>{cells}</tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {descriptor.footerHref && (
        <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
          {descriptor.newHref && <Link href={descriptor.newHref} style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-accent)', textDecoration: 'none' }}>+ New</Link>}
          <Link href={descriptor.footerHref} style={{ marginLeft: 'auto', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none' }}>View all →</Link>
        </div>
      )}

      {detailRow && (descriptor.row.mode === 'detail' || descriptor.row.mode === 'detail+actions') && (
        <RowDetailDialog
          row={detailRow}
          title={descriptor.row.title(detailRow)}
          fields={descriptor.row.fields}
          actions={descriptor.row.mode === 'detail+actions' ? descriptor.row.actions : undefined}
          ctx={ctx}
          has={has}
          onClose={() => setDetailRow(null)}
          onActed={() => toast.success('Saved.')}
        />
      )}
    </div>
  )
}
```

> **Imports confirmed:** `usePermissions` is exported from `@/lib/permissions` (line 263) and returns `{ has }` — same hook the dashboard page and widget-palette already use. `createClient` is from `@/lib/supabase/client` (used by the old `notams-widget.tsx`).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 (no descriptor consumes it yet — that's fine).

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/table/table-widget.tsx
git commit -m "feat(dashboard): generic table widget renderer"
```

---

### Task 10: Generic `TableConfigForm`

**Files:**
- Create: `components/dashboard/table/table-config-form.tsx`

- [ ] **Step 1: Implement** — title input, a checkbox per column (ordered as descriptor lists; checked = visible), a control per filter (enum-multi/status → checkbox group; text → input), and a select per extra.

```tsx
'use client'
import { useMemo, useState } from 'react'
import type { WidgetConfigProps } from '@/lib/dashboard/widget-registry'
import type { TableWidgetConfig, TableWidgetDescriptor, ColumnDef } from '@/lib/dashboard/table/types'
import { normalizeTableConfig } from '@/lib/dashboard/table/config'
import { resolveVisibleColumns } from '@/lib/dashboard/table/columns'

export function TableConfigForm<Row>({
  config, onSave, onCancel, descriptor,
}: WidgetConfigProps & { descriptor: TableWidgetDescriptor<Row> }) {
  const allColumns: ColumnDef<Row>[] = descriptor.useColumns ? descriptor.useColumns() : (descriptor.columns ?? [])
  const start = useMemo(() => normalizeTableConfig(config as TableWidgetConfig, descriptor, allColumns), [])

  const [title, setTitle] = useState(start.title ?? '')
  const [visibleKeys, setVisibleKeys] = useState<string[]>(
    resolveVisibleColumns(allColumns, start.columns).map(c => c.key),
  )
  const [filters, setFilters] = useState<Record<string, string[] | string>>(start.filters ?? {})
  const [extras, setExtras] = useState<Record<string, string>>(start.extras ?? {})

  const box: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)', background: 'var(--color-bg-surface)',
    color: 'var(--color-text-1)', fontSize: 'var(--fs-sm)', fontFamily: 'inherit',
  }
  const section: React.CSSProperties = { fontSize: 'var(--fs-2xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)', marginTop: 6 }

  function toggleColumn(key: string) {
    setVisibleKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }
  function toggleEnum(fk: string, val: string) {
    setFilters(prev => {
      const cur = Array.isArray(prev[fk]) ? (prev[fk] as string[]) : []
      const next = cur.includes(val) ? cur.filter(v => v !== val) : [...cur, val]
      return { ...prev, [fk]: next }
    })
  }

  function save() {
    // Persist visibleKeys in descriptor order so the table column order is stable.
    const ordered = allColumns.filter(c => visibleKeys.includes(c.key)).map(c => c.key)
    onSave({
      title: title.trim() || undefined,
      columns: ordered,
      filters,
      extras,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input style={box} placeholder="Widget title (optional)" value={title} onChange={e => setTitle(e.target.value)} />

      <div style={section}>Columns</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {allColumns.map(c => (
          <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}>
            <input type="checkbox" checked={visibleKeys.includes(c.key)} onChange={() => toggleColumn(c.key)} />
            {c.label}
          </label>
        ))}
      </div>

      {descriptor.filters.map(f => (
        <div key={f.key}>
          <div style={section}>{f.label}</div>
          {f.kind === 'text' ? (
            <input style={box} placeholder={`Filter by ${f.label.toLowerCase()}`}
              value={(filters[f.key] as string) ?? ''} onChange={e => setFilters(p => ({ ...p, [f.key]: e.target.value }))} />
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(f.options ?? []).map(o => {
                const sel = Array.isArray(filters[f.key]) ? (filters[f.key] as string[]) : []
                return (
                  <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)' }}>
                    <input type="checkbox" checked={sel.includes(o.value)} onChange={() => toggleEnum(f.key, o.value)} />
                    {o.label}
                  </label>
                )
              })}
            </div>
          )}
        </div>
      ))}

      {(descriptor.extras ?? []).map(e => (
        <div key={e.key}>
          <div style={section}>{e.label}</div>
          <select style={box} value={extras[e.key] ?? e.default} onChange={ev => setExtras(p => ({ ...p, [e.key]: ev.target.value }))}>
            {e.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={save} style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer', background: 'var(--color-accent)', color: '#fff', fontWeight: 700, fontFamily: 'inherit' }}>Save</button>
        <button onClick={onCancel} style={{ flex: 1, padding: '9px 0', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-2)', fontFamily: 'inherit' }}>Cancel</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/table/table-config-form.tsx
git commit -m "feat(dashboard): generic table config form (columns + filters + extras)"
```

---

### Task 11: `tableWidget()` registry helper

**Files:**
- Modify: `lib/dashboard/registry.tsx`

- [ ] **Step 1: Add imports + helper** (near the top, after existing imports)

```tsx
import { TableWidget } from '@/components/dashboard/table/table-widget'
import { TableConfigForm } from '@/components/dashboard/table/table-config-form'
import type { WidgetDef, WidgetMeta } from '@/lib/dashboard/widget-registry'
import type { TableWidgetDescriptor } from '@/lib/dashboard/table/types'

/** Build a table-kind WidgetDef from metadata + a descriptor. */
function tableWidget<Row>(
  meta: Omit<WidgetMeta, 'kind'>,
  descriptor: TableWidgetDescriptor<Row>,
): WidgetDef {
  return {
    ...meta,
    kind: 'table',
    Component: (p) => <TableWidget descriptor={descriptor} config={p.config} />,
    ConfigForm: (p) => <TableConfigForm {...p} descriptor={descriptor} />,
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 (helper unused until Phase 2 — acceptable; if the linter errors on unused, proceed to Task 12 in the same commit).

- [ ] **Step 3: Commit**

```bash
git add lib/dashboard/registry.tsx
git commit -m "feat(dashboard): tableWidget registry helper"
```

---

### Task 12: Phase 1 build gate

- [ ] **Step 1: Full check**

Run: `npx tsc --noEmit && npm run build && npx vitest run`
Expected: all exit 0; new `dashboard-table-*` suites pass; existing 951 tests still pass.

- [ ] **Step 2: Commit any fixups**

```bash
git commit -am "chore(dashboard): phase 1 framework build-green" --allow-empty
```

---

## Phase 2 — Flagship three + detail actions + queue ops

### Task 13: Two new offline-queue write ops (types + helpers)

**Files:**
- Modify: `lib/sync/types.ts:19-37` (extend `WriteType`)
- Create: `lib/dashboard/row-actions.ts`

- [ ] **Step 1: Extend `WriteType`** — add the two members to the union:

```ts
  | 'inspection_save_draft'
  | 'dashboard_board_update'
  | 'ppr_depart'
  | 'contractor_status_update'
```

- [ ] **Step 2: Create the write helpers** (mirror `lib/dashboard-board-write.ts`)

```ts
import { getWriteQueue, type WriteQueue } from '@/lib/sync/write-queue'
import type { PprDepartPayload, ContractorStatusUpdatePayload } from '@/lib/sync/handlers'
import type { RowActionCtx } from '@/lib/dashboard/table/types'

/** Mark / clear a PPR departure through the offline write queue. */
export async function departPpr(
  entryId: string, depart: boolean, ctx: RowActionCtx, queue: WriteQueue = getWriteQueue(),
): Promise<void> {
  await queue.enqueueOrExecute<PprDepartPayload, null>(
    'ppr_depart',
    { entryId, baseId: ctx.baseId, depart },
    { baseId: ctx.baseId, userId: ctx.userId, optimisticEntityId: entryId },
  )
}

/** Update a contractor's status through the offline write queue. */
export async function updateContractorStatus(
  id: string, status: 'active' | 'completed', ctx: RowActionCtx, queue: WriteQueue = getWriteQueue(),
): Promise<void> {
  await queue.enqueueOrExecute<ContractorStatusUpdatePayload, null>(
    'contractor_status_update',
    { id, baseId: ctx.baseId, status },
    { baseId: ctx.baseId, userId: ctx.userId, optimisticEntityId: id },
  )
}
```

- [ ] **Step 3: Typecheck** (will fail until Task 14 defines the payload types — expected)

Run: `npx tsc --noEmit`
Expected: FAIL — `PprDepartPayload` / `ContractorStatusUpdatePayload` not found. Continue to Task 14 (same commit).

---

### Task 14: Two handlers + registration (with test)

**Files:**
- Modify: `lib/sync/handlers.ts` (add handlers near `dashboardBoardUpdateHandler`, register in `registerAllHandlers`, add to the `HANDLERS` map)
- Test: extend the existing sync-handlers test (find it: `git ls-files | grep -iE "sync.*handler.*\.(test|spec)"`)

- [ ] **Step 1: Write the failing test** (append to the sync-handlers test file)

```ts
import { pprDepartHandler, contractorStatusUpdateHandler } from '@/lib/sync/handlers'
import * as pprMod from '@/lib/supabase/ppr'
import * as contractorMod from '@/lib/supabase/contractors'
import { vi, describe, it, expect, afterEach } from 'vitest'

afterEach(() => vi.restoreAllMocks())

describe('pprDepartHandler', () => {
  it('calls markPprDeparted when depart=true and resolves null', async () => {
    const spy = vi.spyOn(pprMod, 'markPprDeparted').mockResolvedValue({ ok: true })
    await expect(pprDepartHandler({ entryId: 'e1', baseId: 'b1', depart: true })).resolves.toBeNull()
    expect(spy).toHaveBeenCalledWith('e1', 'b1')
  })
  it('calls clearPprDeparted when depart=false', async () => {
    const spy = vi.spyOn(pprMod, 'clearPprDeparted').mockResolvedValue({ ok: true })
    await pprDepartHandler({ entryId: 'e1', baseId: 'b1', depart: false })
    expect(spy).toHaveBeenCalledWith('e1', 'b1')
  })
  it('throws (terminal) when the write fails', async () => {
    vi.spyOn(pprMod, 'markPprDeparted').mockResolvedValue({ ok: false, error: 'denied' })
    await expect(pprDepartHandler({ entryId: 'e1', baseId: 'b1', depart: true })).rejects.toThrow('denied')
  })
})

describe('contractorStatusUpdateHandler', () => {
  it('calls updateContractor with the status and resolves null', async () => {
    const spy = vi.spyOn(contractorMod, 'updateContractor').mockResolvedValue({ data: { id: 'c1' } as never, error: null })
    await expect(contractorStatusUpdateHandler({ id: 'c1', baseId: 'b1', status: 'completed' })).resolves.toBeNull()
    expect(spy).toHaveBeenCalledWith('c1', { status: 'completed' })
  })
  it('throws (terminal) when update returns an error', async () => {
    vi.spyOn(contractorMod, 'updateContractor').mockResolvedValue({ data: null, error: 'nope' })
    await expect(contractorStatusUpdateHandler({ id: 'c1', baseId: 'b1', status: 'completed' })).rejects.toThrow('nope')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/write-queue-handlers.test.ts`
Expected: FAIL — handlers not exported.

- [ ] **Step 3: Implement the handlers** (in `lib/sync/handlers.ts`, after `dashboardBoardUpdateHandler`)

```ts
// ---------------------------------------------------------------------------
// ppr_depart
// ---------------------------------------------------------------------------

export interface PprDepartPayload {
  entryId: string
  baseId: string
  depart: boolean
}

export async function pprDepartHandler(p: PprDepartPayload): Promise<null> {
  const { markPprDeparted, clearPprDeparted } = await import('@/lib/supabase/ppr')
  const res = p.depart
    ? await markPprDeparted(p.entryId, p.baseId)
    : await clearPprDeparted(p.entryId, p.baseId)
  if (!res.ok) throwForStructuredError(res.error ?? 'PPR departure update failed')
  return null
}

// ---------------------------------------------------------------------------
// contractor_status_update
// ---------------------------------------------------------------------------

export interface ContractorStatusUpdatePayload {
  id: string
  baseId: string
  status: 'active' | 'completed'
}

export async function contractorStatusUpdateHandler(p: ContractorStatusUpdatePayload): Promise<null> {
  const { updateContractor } = await import('@/lib/supabase/contractors')
  const { error } = await updateContractor(p.id, { status: p.status })
  if (error) throwForStructuredError(error)
  return null
}
```

- [ ] **Step 4: Register them** — in `registerAllHandlers`, after the `dashboard_board_update` line:

```ts
  queue.registerHandler('ppr_depart', pprDepartHandler)
  queue.registerHandler('contractor_status_update', contractorStatusUpdateHandler)
```

And add to the `HANDLERS` map (the `Partial<Record<WriteType, …>>` exported for tests):
```ts
  ppr_depart: pprDepartHandler,
  contractor_status_update: contractorStatusUpdateHandler,
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/write-queue-handlers.test.ts && npx tsc --noEmit`
Expected: PASS; tsc exit 0 (Task 13's helper now resolves its payload imports).

- [ ] **Step 6: Commit**

```bash
git add lib/sync/types.ts lib/sync/handlers.ts lib/dashboard/row-actions.ts tests/write-queue-handlers.test.ts
git commit -m "feat(sync): ppr_depart and contractor_status_update queue ops"
```

---

### Task 15: Discrepancies descriptor (columns + 3 filters, deeplink)

**Files:**
- Create: `lib/dashboard/table/descriptors/discrepancies.tsx`
- Modify: `lib/dashboard/registry.tsx` (replace the `open-discrepancies` entry)
- Delete: `components/dashboard/widgets/open-discrepancies-widget.tsx` (after wiring)

- [ ] **Step 1: Implement the descriptor**

```tsx
import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { fetchDiscrepancies, formatReporter, type DiscrepancyRow } from '@/lib/supabase/discrepancies'
import { DISCREPANCY_TYPES } from '@/lib/constants'
import type { TableWidgetDescriptor, TableWidgetConfig } from '@/lib/dashboard/table/types'

function ageDays(iso: string): string {
  return `${Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)}d`
}
const TYPE_LABEL = new Map(DISCREPANCY_TYPES.map(t => [t.value, t.label]))

function useRows(_config: TableWidgetConfig) {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<DiscrepancyRow[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!installationId) return
    fetchDiscrepancies(installationId).then(all => { setRows(all); setLoading(false) })
  }, [installationId])
  return { rows, loading }
}

export const discrepanciesDescriptor: TableWidgetDescriptor<DiscrepancyRow> = {
  columns: [
    { key: 'display_id', label: 'ID', accessor: r => r.display_id, mono: true },
    { key: 'title', label: 'Title', accessor: r => r.title, defaultVisible: true },
    { key: 'type', label: 'Type', accessor: r => r.type, format: v => TYPE_LABEL.get(v as string) ?? (v as string) },
    { key: 'current_status', label: 'Status', accessor: r => r.current_status ?? r.status, defaultVisible: true },
    { key: 'assigned_shop', label: 'Shop', accessor: r => r.assigned_shop ?? '—', defaultVisible: true },
    { key: 'age', label: 'Age', accessor: r => r.created_at, format: v => ageDays(v as string), mono: true, defaultVisible: true },
    { key: 'location_text', label: 'Location', accessor: r => r.location_text },
    { key: 'work_order_number', label: 'WO #', accessor: r => r.work_order_number ?? '—', mono: true },
    { key: 'reporter', label: 'Reporter', accessor: r => formatReporter(r.reporter) },
  ],
  filters: [
    { key: 'type', label: 'Type', kind: 'enum-multi',
      options: DISCREPANCY_TYPES.map(t => ({ value: t.value, label: t.label })),
      predicate: (r, sel) => (sel as string[]).includes(r.type) },
    { key: 'status', label: 'Status', kind: 'status', defaultSelected: ['open'],
      options: [{ value: 'open', label: 'Open' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }],
      predicate: (r, sel) => (sel as string[]).includes(r.status) },
    { key: 'assigned_shop', label: 'Shop', kind: 'enum-multi',
      options: Array.from(new Set(DISCREPANCY_TYPES.map(t => t.defaultShop).filter((s): s is string => !!s)))
        .map(s => ({ value: s, label: s })),
      predicate: (r, sel) => !!r.assigned_shop && (sel as string[]).includes(r.assigned_shop) },
  ],
  row: { mode: 'deeplink', href: r => `/discrepancies/${r.id}` },
  footerHref: '/discrepancies',
  newHref: '/discrepancies/new',
  useRows,
}
```

> The `assigned_shop` filter options use the known default shops from `DISCREPANCY_TYPES`. If a base uses free-text shops beyond these, that's acceptable for v1 (the type filter is the headline ask); a follow-up could derive options from distinct fetched values.

- [ ] **Step 2: Wire the registry** — replace the `open-discrepancies` entry. Remove the `OpenDiscrepanciesWidget` import; add `import { discrepanciesDescriptor } from '@/lib/dashboard/table/descriptors/discrepancies'`. New entry:

```tsx
'open-discrepancies': tableWidget({
  type: 'open-discrepancies', title: 'Open Discrepancies',
  description: 'Live discrepancy list', icon: AlertTriangle,
  defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 },
  permission: PERM.DISCREPANCIES_VIEW,
}, discrepanciesDescriptor),
```

- [ ] **Step 3: Delete the old widget + its import**

```bash
git rm components/dashboard/widgets/open-discrepancies-widget.tsx
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both exit 0.

- [ ] **Step 5: Manual check** — `/dashboard`: the Open Discrepancies widget renders as a table; the gear opens columns + Type/Status/Shop filters; selecting only "Lighting" narrows the list; default still shows open items.

- [ ] **Step 6: Commit**

```bash
git add lib/dashboard/table/descriptors/discrepancies.tsx lib/dashboard/registry.tsx
git commit -m "feat(dashboard): configurable Discrepancies widget (columns + type/status/shop filters)"
```

---

### Task 16: Personnel descriptor (columns + status filter, detail+actions)

**Files:**
- Create: `lib/dashboard/table/descriptors/personnel.tsx`
- Modify: `lib/dashboard/registry.tsx` (replace `personnel`)
- Delete: `components/dashboard/widgets/personnel-widget.tsx`

- [ ] **Step 1: Implement the descriptor**

```tsx
import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { fetchContractors, type ContractorRow } from '@/lib/supabase/contractors'
import { updateContractorStatus } from '@/lib/dashboard/row-actions'
import { PERM } from '@/lib/permissions'
import type { TableWidgetDescriptor, TableWidgetConfig } from '@/lib/dashboard/table/types'

function useRows(_config: TableWidgetConfig) {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<ContractorRow[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!installationId) return
    fetchContractors(installationId).then(all => { setRows(all); setLoading(false) })
  }, [installationId])
  return { rows, loading }
}

export const personnelDescriptor: TableWidgetDescriptor<ContractorRow> = {
  columns: [
    { key: 'company_name', label: 'Company', accessor: r => r.company_name, defaultVisible: true },
    { key: 'contact_name', label: 'Contact', accessor: r => r.contact_name ?? '—' },
    { key: 'location', label: 'Location', accessor: r => r.location, defaultVisible: true },
    { key: 'work_description', label: 'Work', accessor: r => r.work_description },
    { key: 'status', label: 'Status', accessor: r => r.status },
    { key: 'start_date', label: 'Start', accessor: r => r.start_date },
    { key: 'end_date', label: 'End', accessor: r => r.end_date ?? '—' },
    { key: 'radio_number', label: 'Radio', accessor: r => r.radio_number ?? '—', mono: true },
    { key: 'flag_number', label: 'Flag', accessor: r => r.flag_number ?? '—', mono: true },
    { key: 'callsign', label: 'Callsign', accessor: r => r.callsign ?? '—', mono: true },
    { key: 'contact_phone', label: 'Phone', accessor: r => r.contact_phone ?? '—', mono: true },
  ],
  filters: [
    { key: 'status', label: 'Status', kind: 'status', defaultSelected: ['active'],
      options: [{ value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }],
      predicate: (r, sel) => (sel as string[]).includes(r.status) },
  ],
  row: {
    mode: 'detail+actions',
    title: r => r.company_name,
    fields: [
      { label: 'Contact', value: r => r.contact_name ?? '—' },
      { label: 'Location', value: r => r.location },
      { label: 'Work', value: r => r.work_description },
      { label: 'Status', value: r => r.status },
      { label: 'Start', value: r => r.start_date },
      { label: 'End', value: r => r.end_date ?? '—' },
      { label: 'Radio', value: r => r.radio_number ?? '—' },
      { label: 'Flag', value: r => r.flag_number ?? '—' },
      { label: 'Callsign', value: r => r.callsign ?? '—' },
      { label: 'Phone', value: r => r.contact_phone ?? '—' },
    ],
    actions: [
      { key: 'complete', label: () => 'Mark Completed', permission: PERM.CONTRACTORS_WRITE,
        visible: r => r.status === 'active',
        run: (r, ctx) => updateContractorStatus(r.id, 'completed', ctx) },
    ],
  },
  footerHref: '/contractors',
  useRows,
}
```

- [ ] **Step 2: Wire the registry** — replace `personnel`; remove `PersonnelWidget` import; add the descriptor import:

```tsx
'personnel': tableWidget({
  type: 'personnel', title: 'Personnel on Airfield',
  description: 'Active personnel now', icon: HardHat,
  defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 },
  moduleHref: '/contractors',
}, personnelDescriptor),
```

- [ ] **Step 3: Delete the old widget**

```bash
git rm components/dashboard/widgets/personnel-widget.tsx
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both exit 0.

- [ ] **Step 5: Manual check** — Personnel widget shows a table; clicking a row opens the detail dialog; with `contractors:write`, an active row shows "Mark Completed", which (online) moves it to completed and the row leaves the default Active filter.

- [ ] **Step 6: Commit**

```bash
git add lib/dashboard/table/descriptors/personnel.tsx lib/dashboard/registry.tsx
git commit -m "feat(dashboard): configurable Personnel widget with detail dialog + complete action"
```

---

### Task 17: PPR descriptor (dynamic columns + status filter + dateScope extra, detail+actions)

**Files:**
- Create: `lib/dashboard/table/descriptors/ppr.tsx`
- Modify: `lib/dashboard/registry.tsx` (replace `ppr-today`)
- Delete: `components/dashboard/widgets/ppr-today-widget.tsx`

- [ ] **Step 1: Implement the descriptor** — note `useColumns` (dynamic, base-defined) and the dateScope extra read by `useRows`.

```tsx
import { useEffect, useMemo, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import {
  fetchPprColumns, fetchPprEntries, isActivePpr,
  type PprColumn, type PprEntry,
} from '@/lib/supabase/ppr'
import { departPpr } from '@/lib/dashboard/row-actions'
import { PERM } from '@/lib/permissions'
import type { ColumnDef, TableWidgetDescriptor, TableWidgetConfig } from '@/lib/dashboard/table/types'

const SYSTEM_COLUMNS: ColumnDef<PprEntry>[] = [
  { key: 'ppr_number', label: 'PPR #', accessor: r => r.ppr_number, mono: true, defaultVisible: true },
  { key: 'arrival_date', label: 'Arrival', accessor: r => r.arrival_date, defaultVisible: true },
  { key: 'status', label: 'Status', accessor: r => r.status, defaultVisible: true },
  { key: 'requester_name', label: 'Requester', accessor: r => r.requester_name ?? '—', defaultVisible: true },
  { key: 'requester_email', label: 'Email', accessor: r => r.requester_email ?? '—' },
  { key: 'requester_phone', label: 'Phone', accessor: r => r.requester_phone ?? '—', mono: true },
  { key: 'departed_at', label: 'Departed', accessor: r => r.departed_at ?? '—' },
  { key: 'notes', label: 'Notes', accessor: r => r.notes ?? '—' },
]

/** Dynamic catalog: system columns + this base's show_on_log PPR columns. */
function usePprColumns(): ColumnDef<PprEntry>[] {
  const { installationId } = useInstallation()
  const [baseCols, setBaseCols] = useState<PprColumn[]>([])
  useEffect(() => {
    if (!installationId) return
    fetchPprColumns(installationId).then(cols => setBaseCols(cols.filter(c => c.show_on_log)))
  }, [installationId])
  return useMemo(() => [
    ...SYSTEM_COLUMNS,
    ...baseCols.map<ColumnDef<PprEntry>>(c => ({
      key: `col:${c.column_name}`,
      label: c.column_name,
      accessor: r => r.column_values?.[c.column_name] ?? '—',
    })),
  ], [baseCols])
}

function dateRange(scope: string, tz: string): { start: string; end: string } {
  const fmt = (d: Date) => {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d) }
    catch { return d.toISOString().slice(0, 10) }
  }
  const today = fmt(new Date())
  if (scope === 'all') return { start: '0000-01-01', end: '9999-12-31' }
  if (scope === 'upcoming-7d') {
    const week = new Date(Date.now() + 7 * 86_400_000)
    return { start: today, end: fmt(week) }
  }
  return { start: today, end: today } // today
}

function useRows(config: TableWidgetConfig) {
  const { installationId, currentInstallation } = useInstallation()
  const tz = currentInstallation?.timezone || 'UTC'
  const scope = config.extras?.dateScope ?? 'today'
  const [rows, setRows] = useState<PprEntry[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!installationId) return
    setLoading(true)
    const { start, end } = dateRange(scope, tz)
    // fetchPprEntries(baseId, dateFrom, dateTo) supports a date range (it backs
    // fetchPprEntriesForDate, which just passes the same date for from+to).
    fetchPprEntries(installationId, start, end).then(data => {
      setRows(data.filter(e => isActivePpr(e.status)))
      setLoading(false)
    })
  }, [installationId, tz, scope])
  return { rows, loading }
}

export const pprDescriptor: TableWidgetDescriptor<PprEntry> = {
  useColumns: usePprColumns,
  filters: [
    { key: 'status', label: 'Status', kind: 'status',
      options: [
        { value: 'approved', label: 'Approved' },
        { value: 'pending_amops_triage', label: 'Triage' },
        { value: 'pending_coordination', label: 'Coordination' },
        { value: 'pending_amops_approval', label: 'Pending' },
        { value: 'denied', label: 'Denied' },
      ],
      predicate: (r, sel) => (sel as string[]).includes(r.status) },
  ],
  extras: [
    { key: 'dateScope', label: 'Date range', default: 'today',
      options: [
        { value: 'today', label: 'Today' },
        { value: 'upcoming-7d', label: 'Next 7 days' },
        { value: 'all', label: 'All' },
      ] },
  ],
  row: {
    mode: 'detail+actions',
    title: r => `PPR ${r.ppr_number}`,
    fields: [
      { label: 'Status', value: r => r.status },
      { label: 'Arrival', value: r => r.arrival_date },
      { label: 'Requester', value: r => r.requester_name ?? '—' },
      { label: 'Email', value: r => r.requester_email ?? '—' },
      { label: 'Phone', value: r => r.requester_phone ?? '—' },
      { label: 'Notes', value: r => r.notes ?? '—', hideWhenEmpty: true },
      { label: 'Departed', value: r => r.departed_at ?? 'Not departed' },
    ],
    actions: [
      { key: 'depart', permission: PERM.PPR_WRITE,
        label: r => r.departed_at ? 'Clear Departure' : 'Mark Departed',
        run: (r, ctx) => departPpr(r.id, !r.departed_at, ctx) },
    ],
  },
  footerHref: '/ppr',
  useRows,
}
```

> **Confirmed:** `fetchPprEntries(baseId, dateFrom?, dateTo?)` (lib/supabase/ppr.ts:269) supports the date range; `fetchPprEntriesForDate` is just `fetchPprEntries(baseId, date, date)`. All three scopes work.

- [ ] **Step 2: Wire the registry** — replace `ppr-today`; remove `PprTodayWidget` import; add `import { pprDescriptor }`:

```tsx
'ppr-today': tableWidget({
  type: 'ppr-today', title: 'PPR', description: 'PPR arrivals',
  icon: Plane, defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 },
  moduleHref: '/ppr',
}, pprDescriptor),
```

- [ ] **Step 3: Delete the old widget**

```bash
git rm components/dashboard/widgets/ppr-today-widget.tsx
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both exit 0.

- [ ] **Step 5: Manual check** — PPR widget shows today's PPRs as a table; the gear lists system + base-defined columns, a status filter, and a "Date range" select; clicking a row opens detail with a "Mark Departed" action gated on `ppr:write`.

- [ ] **Step 6: Commit**

```bash
git add lib/dashboard/table/descriptors/ppr.tsx lib/dashboard/registry.tsx
git commit -m "feat(dashboard): configurable PPR widget (dynamic columns, detail dialog, depart action)"
```

---

### Task 18: Descriptor invariants test

**Files:**
- Test: `tests/dashboard-table-descriptors.test.ts`

- [ ] **Step 1: Write the test** (static descriptors only — `discrepancies`, `personnel`; PPR uses `useColumns` so it's covered by render, not this static test)

```ts
import { describe, it, expect } from 'vitest'
import { discrepanciesDescriptor } from '@/lib/dashboard/table/descriptors/discrepancies'
import { personnelDescriptor } from '@/lib/dashboard/table/descriptors/personnel'
import { PERM } from '@/lib/permissions'

const PERM_VALUES = new Set<string>(Object.values(PERM))
const staticDescriptors = [
  { name: 'discrepancies', d: discrepanciesDescriptor },
  { name: 'personnel', d: personnelDescriptor },
]

describe('table descriptors', () => {
  for (const { name, d } of staticDescriptors) {
    it(`${name}: exactly one of columns/useColumns`, () => {
      expect(Boolean(d.columns) !== Boolean(d.useColumns)).toBe(true)
    })
    it(`${name}: column keys unique`, () => {
      const keys = (d.columns ?? []).map(c => c.key)
      expect(new Set(keys).size).toBe(keys.length)
    })
    it(`${name}: has at least one default column`, () => {
      expect((d.columns ?? []).some(c => c.defaultVisible)).toBe(true)
    })
    it(`${name}: detail+actions reference real PERM keys`, () => {
      if (d.row.mode === 'detail+actions') {
        for (const a of d.row.actions) expect(PERM_VALUES.has(a.permission)).toBe(true)
      }
    })
  }
})
```

- [ ] **Step 2: Run**

Run: `npx vitest run tests/dashboard-table-descriptors.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/dashboard-table-descriptors.test.ts
git commit -m "test(dashboard): descriptor invariants"
```

---

### Task 19: Phase 2 build gate

- [ ] **Step 1** — Run: `npx tsc --noEmit && npm run build && npx vitest run`. Expected: all exit 0.
- [ ] **Step 2** — Manual smoke on `/dashboard`: discrepancies/personnel/ppr all render, configure, filter, and (personnel/ppr) open detail + run their action. Verify offline: with devtools offline, the action queues and a toast confirms; back online it drains.
- [ ] **Step 3** — `git commit -am "chore(dashboard): phase 2 flagship build-green" --allow-empty`

---

## Phase 3 — Remaining five descriptors (deeplink / read-only detail)

Each task: create the descriptor, swap the registry entry, delete the old widget component, typecheck+build, manual check, commit. No new write paths.

### Task 20: CES descriptor

**Files:** Create `lib/dashboard/table/descriptors/ces.tsx`; modify `registry.tsx` (`ces`); delete `components/dashboard/widgets/ces-widget.tsx`.

- [ ] **Step 1: Implement** (reuses `DiscrepancyRow`; pre-filters to CES statuses in `useRows`)

```tsx
import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { fetchDiscrepancies, type DiscrepancyRow } from '@/lib/supabase/discrepancies'
import type { TableWidgetDescriptor, TableWidgetConfig } from '@/lib/dashboard/table/types'

const CES_STATUSES = ['submitted_to_ces', 'awaiting_action_by_ces', 'waiting_for_project', 'work_completed_awaiting_verification']
const CES_SET = new Set(CES_STATUSES)
const CES_LABEL: Record<string, string> = {
  submitted_to_ces: 'Submitted', awaiting_action_by_ces: 'In Work',
  waiting_for_project: 'Project', work_completed_awaiting_verification: 'Verify',
}
const ageDays = (iso: string) => `${Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)}d`

function useRows(_c: TableWidgetConfig) {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<DiscrepancyRow[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!installationId) return
    fetchDiscrepancies(installationId).then(all => {
      setRows(all.filter(d => d.status === 'open' && CES_SET.has(d.current_status ?? '')))
      setLoading(false)
    })
  }, [installationId])
  return { rows, loading }
}

export const cesDescriptor: TableWidgetDescriptor<DiscrepancyRow> = {
  columns: [
    { key: 'title', label: 'Title', accessor: r => r.title, defaultVisible: true },
    { key: 'current_status', label: 'Status', accessor: r => r.current_status ?? '—',
      format: v => CES_LABEL[v as string] ?? (v as string), defaultVisible: true },
    { key: 'assigned_shop', label: 'Shop', accessor: r => r.assigned_shop ?? '—', defaultVisible: true },
    { key: 'age', label: 'Age', accessor: r => r.created_at, format: v => ageDays(v as string), mono: true, defaultVisible: true },
    { key: 'display_id', label: 'ID', accessor: r => r.display_id, mono: true },
    { key: 'work_order_number', label: 'WO #', accessor: r => r.work_order_number ?? '—', mono: true },
  ],
  filters: [
    { key: 'current_status', label: 'Status', kind: 'status',
      options: CES_STATUSES.map(s => ({ value: s, label: CES_LABEL[s] })),
      predicate: (r, sel) => (sel as string[]).includes(r.current_status ?? '') },
    { key: 'assigned_shop', label: 'Shop', kind: 'text',
      predicate: (r, sel) => (r.assigned_shop ?? '').toLowerCase().includes((sel as string).toLowerCase()) },
  ],
  row: { mode: 'deeplink', href: r => `/discrepancies/${r.id}` },
  footerHref: '/ces',
  useRows,
}
```

- [ ] **Step 2: Wire** — `'ces': tableWidget({ type: 'ces', title: 'CES Work Orders', description: 'Open discrepancies routed to Civil Engineering', icon: Wrench, defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 }, permission: PERM.CES_VIEW, moduleHref: '/ces' }, cesDescriptor),` ; remove `CesWidget` import; add descriptor import.
- [ ] **Step 3:** `git rm components/dashboard/widgets/ces-widget.tsx`
- [ ] **Step 4:** `npx tsc --noEmit && npm run build` → exit 0.
- [ ] **Step 5:** Manual check on `/dashboard`.
- [ ] **Step 6:** `git add -A && git commit -m "feat(dashboard): configurable CES widget"`

---

### Task 21: Waivers descriptor

**Files:** Create `lib/dashboard/table/descriptors/waivers.tsx`; modify `registry.tsx` (`waivers`); delete `components/dashboard/widgets/waivers-widget.tsx`.

- [ ] **Step 1: Implement**

```tsx
import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { fetchWaivers, type WaiverRow } from '@/lib/supabase/waivers'
import { formatZuluDate } from '@/lib/utils'
import type { TableWidgetDescriptor, TableWidgetConfig } from '@/lib/dashboard/table/types'

const ACTIVE = new Set(['active', 'approved'])
function daysToExpiry(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

function useRows(_c: TableWidgetConfig) {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<WaiverRow[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!installationId) return
    fetchWaivers(installationId).then(all => { setRows(all); setLoading(false) })
  }, [installationId])
  return { rows, loading }
}

export const waiversDescriptor: TableWidgetDescriptor<WaiverRow> = {
  columns: [
    { key: 'waiver_number', label: 'Waiver #', accessor: r => r.waiver_number, mono: true, defaultVisible: true },
    { key: 'classification', label: 'Class', accessor: r => r.classification, defaultVisible: true },
    { key: 'status', label: 'Status', accessor: r => r.status, defaultVisible: true },
    { key: 'expiration_date', label: 'Expires', accessor: r => r.expiration_date,
      format: v => v ? formatZuluDate(v as string) : '—', defaultVisible: true },
  ],
  filters: [
    { key: 'status', label: 'Status', kind: 'status', defaultSelected: ['active', 'approved'],
      options: ['active', 'approved', 'draft', 'pending', 'expired', 'cancelled'].map(s => ({ value: s, label: s })),
      predicate: (r, sel) => (sel as string[]).includes(r.status) },
    { key: 'classification', label: 'Classification', kind: 'text',
      predicate: (r, sel) => r.classification.toLowerCase().includes((sel as string).toLowerCase()) },
    { key: 'expiring', label: 'Expiring ≤90d', kind: 'enum-multi',
      options: [{ value: 'yes', label: 'Expiring soon' }],
      predicate: r => { const d = daysToExpiry(r.expiration_date); return d !== null && d >= 0 && d <= 90 } },
  ],
  row: { mode: 'deeplink', href: r => `/waivers/${r.id}` },
  summary: rows => {
    const active = rows.filter(w => ACTIVE.has(w.status))
    const expiring = active.filter(w => { const d = daysToExpiry(w.expiration_date); return d !== null && d >= 0 && d <= 90 })
    return [{ count: active.length, label: 'active' }, ...(expiring.length ? [{ count: expiring.length, label: 'expiring', tone: 'warning' as const }] : [])]
  },
  footerHref: '/waivers',
  newHref: '/waivers/new',
  useRows,
}
```

> The `expiring` filter's predicate ignores `sel` (presence of the single option = "only expiring"). That's intentional; the option just toggles the filter on.

- [ ] **Step 2: Wire** — `'waivers': tableWidget({ type: 'waivers', title: 'Waivers', description: 'Active waivers and upcoming expirations', icon: ShieldCheck, defaultSize: { w: 3, h: 3 }, minSize: { w: 2, h: 2 }, permission: PERM.WAIVERS_VIEW, moduleHref: '/waivers' }, waiversDescriptor),`
- [ ] **Step 3:** `git rm components/dashboard/widgets/waivers-widget.tsx`
- [ ] **Step 4:** `npx tsc --noEmit && npm run build` → exit 0.
- [ ] **Step 5:** Manual check.
- [ ] **Step 6:** `git add -A && git commit -m "feat(dashboard): configurable Waivers widget"`

---

### Task 22: NOTAMs descriptor

**Files:** Create `lib/dashboard/table/descriptors/notams.tsx`; modify `registry.tsx` (`notams`); delete `components/dashboard/widgets/notams-widget.tsx`.

- [ ] **Step 1: Implement** — keep the 60s throttle cache and the `/api/notams/sync` fetch from the current widget.

```tsx
import { useCallback, useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { createClient } from '@/lib/supabase/client'
import type { TableWidgetDescriptor, TableWidgetConfig } from '@/lib/dashboard/table/types'

interface NotamRow {
  id: string; notam_number: string; source: 'faa' | 'local'; status: 'active' | 'expired'
  title: string; full_text?: string; effective_start?: string; effective_end: string
}

const lastSync = new Map<string, { at: number; rows: NotamRow[] }>()
function expiresSoon(end: string): boolean {
  if (!end || end.toUpperCase() === 'PERM') return false
  const m = end.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2})(\d{2})$/)
  const p = m ? new Date(Date.UTC(+m[3], +m[1] - 1, +m[2], +m[4], +m[5])) : new Date(end)
  if (isNaN(p.getTime())) return false
  const diff = p.getTime() - Date.now()
  return diff > 0 && diff <= 86_400_000
}

function useRows(_c: TableWidgetConfig) {
  const { currentInstallation } = useInstallation()
  const icao = currentInstallation?.icao || ''
  const [rows, setRows] = useState<NotamRow[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    if (!icao || !createClient()) { setLoading(false); return }
    const cached = lastSync.get(icao)
    if (cached && Date.now() - cached.at < 60_000) { setRows(cached.rows); setLoading(false); return }
    try {
      const res = await fetch(`/api/notams/sync?icao=${encodeURIComponent(icao)}`)
      if (res.ok) {
        const data = await res.json()
        const active: NotamRow[] = (data.notams || []).filter((n: NotamRow) => n.status === 'active')
        lastSync.set(icao, { at: Date.now(), rows: active })
        setRows(active)
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [icao])
  useEffect(() => { load() }, [load])
  return { rows, loading }
}

export const notamsDescriptor: TableWidgetDescriptor<NotamRow> = {
  columns: [
    { key: 'notam_number', label: 'NOTAM', accessor: r => r.notam_number, mono: true, defaultVisible: true },
    { key: 'text', label: 'Text', accessor: r => r.full_text || r.title, mono: true, defaultVisible: true },
    { key: 'source', label: 'Source', accessor: r => r.source.toUpperCase() },
    { key: 'effective_end', label: 'Valid until', accessor: r => r.effective_end, defaultVisible: true },
  ],
  filters: [
    { key: 'source', label: 'Source', kind: 'enum-multi',
      options: [{ value: 'faa', label: 'FAA' }, { value: 'local', label: 'Local' }],
      predicate: (r, sel) => (sel as string[]).includes(r.source) },
    { key: 'expiring', label: 'Expiring ≤24h', kind: 'enum-multi',
      options: [{ value: 'yes', label: 'Expiring soon' }],
      predicate: r => expiresSoon(r.effective_end) },
  ],
  row: { mode: 'deeplink', href: r => `/notams/${r.id}` },
  summary: rows => {
    const soon = rows.filter(n => expiresSoon(n.effective_end))
    return [{ count: rows.length, label: 'active' }, ...(soon.length ? [{ count: soon.length, label: 'expiring', tone: 'warning' as const }] : [])]
  },
  footerHref: '/notams',
  useRows,
}
```

> Verify `/notams/[id]` exists (CLAUDE.md lists `/notams/{page,[id],new}`) before relying on the deeplink. It does per the module table.

- [ ] **Step 2: Wire** — `'notams': tableWidget({ type: 'notams', title: 'Active NOTAMs', description: 'Current NOTAMs', icon: Radio, defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 }, moduleHref: '/notams' }, notamsDescriptor),`
- [ ] **Step 3:** `git rm components/dashboard/widgets/notams-widget.tsx`
- [ ] **Step 4:** `npx tsc --noEmit && npm run build` → exit 0.
- [ ] **Step 5:** Manual check (text column truncates — acceptable; full text shows on the module page).
- [ ] **Step 6:** `git add -A && git commit -m "feat(dashboard): configurable NOTAMs widget"`

---

### Task 23: Daily Reviews descriptor

**Files:** Create `lib/dashboard/table/descriptors/daily-reviews.tsx`; modify `registry.tsx` (`daily-reviews`); delete `components/dashboard/widgets/daily-reviews-widget.tsx`.

- [ ] **Step 1: Implement**

```tsx
import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { fetchRecentReviews, type DailyReviewRow } from '@/lib/supabase/daily-reviews'
import type { TableWidgetDescriptor, TableWidgetConfig } from '@/lib/dashboard/table/types'

const SLOTS = ['day_amsl', 'swing_amsl', 'mid_amsl', 'namo', 'afm'] as const
function pendingSlots(r: DailyReviewRow): number {
  return SLOTS.filter(s => r[`${s}_signed_at` as keyof DailyReviewRow] == null).length
}
function fmtDate(iso: string): string { const [y, m, d] = iso.split('-'); return `${m}/${d}/${y.slice(2)}` }

function useRows(_c: TableWidgetConfig) {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<DailyReviewRow[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!installationId) return
    fetchRecentReviews(installationId, 7).then(all => { setRows(all); setLoading(false) })
  }, [installationId])
  return { rows, loading }
}

export const dailyReviewsDescriptor: TableWidgetDescriptor<DailyReviewRow> = {
  columns: [
    { key: 'review_date', label: 'Date', accessor: r => r.review_date, format: v => fmtDate(v as string), mono: true, defaultVisible: true },
    { key: 'pending', label: 'Pending', accessor: r => pendingSlots(r), format: v => `${v} slot${v === 1 ? '' : 's'}`, defaultVisible: true },
    { key: 'certified', label: 'Certified', accessor: r => r.fully_certified_at ? 'Yes' : 'No', defaultVisible: true },
  ],
  filters: [
    { key: 'state', label: 'State', kind: 'status', defaultSelected: ['pending'],
      options: [{ value: 'pending', label: 'Pending' }, { value: 'certified', label: 'Certified' }],
      predicate: (r, sel) => {
        const s = sel as string[]
        const isCert = r.fully_certified_at != null
        return (isCert && s.includes('certified')) || (!isCert && s.includes('pending'))
      } },
  ],
  row: { mode: 'deeplink', href: () => '/daily-reviews' },
  summary: rows => [{ count: rows.filter(r => r.fully_certified_at == null).length, label: 'pending', tone: 'warning' }],
  footerHref: '/daily-reviews',
  useRows,
}
```

- [ ] **Step 2: Wire** — `'daily-reviews': tableWidget({ type: 'daily-reviews', title: 'Daily Reviews', description: 'Shift sign-off queue for the last 7 days', icon: CheckSquare, defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 }, permission: PERM.DAILY_REVIEWS_VIEW, moduleHref: '/daily-reviews' }, dailyReviewsDescriptor),`
- [ ] **Step 3:** `git rm components/dashboard/widgets/daily-reviews-widget.tsx`
- [ ] **Step 4:** `npx tsc --noEmit && npm run build` → exit 0.
- [ ] **Step 5:** Manual check.
- [ ] **Step 6:** `git add -A && git commit -m "feat(dashboard): configurable Daily Reviews widget"`

---

### Task 24: Events Log descriptor (read-only detail)

**Files:** Create `lib/dashboard/table/descriptors/events-log.tsx`; modify `registry.tsx` (`events-log`); delete `components/dashboard/widgets/events-log-widget.tsx`.

- [ ] **Step 1: Implement** — `mode: 'detail'` (no per-record page, append-only → no actions).

```tsx
import { useEffect, useState } from 'react'
import { useInstallation } from '@/lib/installation-context'
import { fetchActivityLogPage, type ActivityEntry } from '@/lib/supabase/activity-queries'
import { formatZuluTime } from '@/lib/utils'
import { formatAction, buildDetailsString } from '@/lib/activity-format'
import type { TableWidgetDescriptor, TableWidgetConfig } from '@/lib/dashboard/table/types'

const EXCLUDE = ['ppr_coordination', 'ppr_agency']
const empty = new Map<string, { title?: string; description?: string; notes?: string; extra?: string }>()
const labelFor = (e: ActivityEntry) =>
  buildDetailsString(e, empty) || formatAction(e.action, e.entity_type, e.entity_display_id ?? undefined, e.metadata)

function useRows(_c: TableWidgetConfig) {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!installationId) return
    fetchActivityLogPage({ baseId: installationId, limit: 30, excludeEntityTypes: EXCLUDE })
      .then(({ data }) => { setRows(data); setLoading(false) })
  }, [installationId])
  return { rows, loading }
}

export const eventsLogDescriptor: TableWidgetDescriptor<ActivityEntry> = {
  columns: [
    { key: 'label', label: 'Event', accessor: labelFor, defaultVisible: true },
    { key: 'oi', label: 'OI', accessor: e => e.profiles?.operating_initials ?? '—', mono: true },
    { key: 'time', label: 'Zulu', accessor: e => `${formatZuluTime(e.created_at)}Z`, mono: true, defaultVisible: true },
    { key: 'entity_type', label: 'Type', accessor: e => e.entity_type },
  ],
  filters: [
    { key: 'entity_type', label: 'Entity type', kind: 'text',
      predicate: (e, sel) => e.entity_type.toLowerCase().includes((sel as string).toLowerCase()) },
  ],
  row: {
    mode: 'detail',
    title: e => formatAction(e.action, e.entity_type, e.entity_display_id ?? undefined, e.metadata),
    fields: [
      { label: 'Action', value: e => e.action },
      { label: 'Entity', value: e => `${e.entity_type}${e.entity_display_id ? ` · ${e.entity_display_id}` : ''}` },
      { label: 'Operating initials', value: e => e.profiles?.operating_initials ?? '—' },
      { label: 'Detail', value: e => labelFor(e) },
      { label: 'Time', value: e => `${formatZuluTime(e.created_at)}Z` },
    ],
  },
  footerHref: '/activity',
  useRows,
}
```

> Verify `e.profiles?.operating_initials` matches `ActivityEntry.profiles` (`ProfileFragment` has `operating_initials`). Confirmed in the spec's type check.

- [ ] **Step 2: Wire** — `'events-log': tableWidget({ type: 'events-log', title: 'Events Log', description: 'Recent activity log entries (AF Form 3616)', icon: ScrollText, defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 }, permission: PERM.ACTIVITY_LOG_VIEW, moduleHref: '/activity' }, eventsLogDescriptor),`
- [ ] **Step 3:** `git rm components/dashboard/widgets/events-log-widget.tsx`
- [ ] **Step 4:** `npx tsc --noEmit && npm run build` → exit 0.
- [ ] **Step 5:** Manual check — row opens a read-only detail dialog; no action buttons.
- [ ] **Step 6:** `git add -A && git commit -m "feat(dashboard): configurable Events Log widget with read-only detail"`

---

### Task 25: Final build gate + handoff note

- [ ] **Step 1: Full check**

Run: `npx tsc --noEmit && npm run build && npx vitest run`
Expected: all exit 0; all `dashboard-table-*` + sync-handler suites green; existing suites unaffected.

- [ ] **Step 2: Grep for orphans** — confirm none of the deleted widget components are still imported:

Run: `grep -rn "open-discrepancies-widget\|ppr-today-widget\|personnel-widget\|ces-widget\|waivers-widget\|notams-widget\|daily-reviews-widget\|events-log-widget" lib/ components/ app/`
Expected: no results.

- [ ] **Step 3: Update SESSION_HANDOFF.md** — record: Phase 4 shipped (8 configurable table widgets, rename on all native widgets, PPR/Personnel detail dialogs + 2 new queue ops `ppr_depart`/`contractor_status_update`); note any v1 gap (e.g. PPR date-range fetch if not wired); flag "never live-smoke-tested" until promoted.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: session handoff — phase 4 configurable widgets complete"
```

---

## Notes for the implementer

- **Do not promote.** The user owns Vercel promotion. Never add a promote/verify-on-promoted-build step.
- **Visual parity is the main risk.** After each conversion, eyeball the widget against the old look on the preview; use `summary`, `mono`, and column `format` to recover badges/counts. Small truncation differences are acceptable.
- **Permissions hook (confirmed)** — `usePermissions()` from `@/lib/permissions` returns `{ has }`; same hook `dashboard/page.tsx` and `widget-palette.tsx` use.
- **PPR range fetch (confirmed)** — `fetchPprEntries(baseId, dateFrom?, dateTo?)` supports the range; all three date scopes are real.
- **Each commit must be build-green** (`tsc` + `npm run build`), not just vitest.
