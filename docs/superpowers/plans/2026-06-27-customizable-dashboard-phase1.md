# Customizable Dashboard — Phase 1 (Framework) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed dashboard with a draggable/resizable widget grid whose layout persists per user, rendering the current dashboard's surfaces as live native widgets.

**Architecture:** A `dashboard_boards` table (RLS via matrix helpers) stores one row per board with an embedded `layout` JSONB. A widget *registry* maps a `type` string to a definition + React component; widgets fetch their own data through existing `lib/supabase/*` modules so RLS/permission gating is inherited. Layout saves route through the existing offline write queue. The grid uses `react-grid-layout`'s responsive layout (single-column reflow on mobile). The dashboard route is full-bleed via a scoped CSS `:has()` override.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Supabase + RLS, `react-grid-layout`, vitest (+ @testing-library/react for component tests).

**Spec:** `docs/superpowers/specs/2026-06-27-customizable-dashboard-design.md`

**Scope note:** This plan covers **Phase 1 only** (framework + native-widget port). Phase 2 (web embeds, links widget, shared boards, role templates) and Phase 3 (analytics builder) get their own plans. Phase-2/3 concepts (shared scope, embed permissions) are designed into the schema now so they don't require a migration later, but no Phase-2/3 UI is built here.

**Conventions reminder:**
- Apply migrations with `npx supabase db query --linked --file <path>` — **never** `db push` (the migration tracker is empty). One file per migration.
- Gate every commit on `npm run build` (RC 0) AND `npx vitest run` — vitest green ≠ build green.
- New write surface MUST go through the offline queue; a registered handler that nothing calls is not "wired".
- Theme-aware tokens only (`var(--color-*)`), never raw Tailwind greys or `dark:`.

---

## File structure

**Create:**
- `supabase/migrations/2026062700_dashboard_boards.sql` — table + RLS + permission keys + seed grants
- `lib/dashboard/layout.ts` — `WidgetInstance` type + `validateLayout` (pure)
- `lib/dashboard/widget-registry.ts` — `WidgetDef`, registry map, `listAvailableWidgets` (pure-ish)
- `lib/supabase/dashboard-boards.ts` — board CRUD + `getOrCreateDefaultBoard`
- `lib/dashboard-board-write.ts` — offline-queued `saveBoardLayout` caller
- `components/dashboard/widget-frame.tsx` — chrome around any widget (title, edit ✕)
- `components/dashboard/widget-grid.tsx` — `react-grid-layout` wrapper
- `components/dashboard/widget-palette.tsx` — add-widget drawer
- `components/dashboard/board-bar.tsx` — board switcher + edit toggle
- `components/dashboard/widgets/inspection-status-widget.tsx`
- `components/dashboard/widgets/open-discrepancies-widget.tsx`
- `components/dashboard/widgets/last-check-widget.tsx`
- `components/dashboard/widgets/personnel-widget.tsx`
- `components/dashboard/widgets/shift-checklist-widget.tsx`
- `components/dashboard/widgets/notams-widget.tsx`
- `components/dashboard/widgets/ppr-today-widget.tsx`
- `components/dashboard/widgets/afm-toggles-widget.tsx`
- `components/dashboard/widgets/quick-actions-widget.tsx`
- `tests/dashboard-layout.test.ts`, `tests/dashboard-widget-registry.test.ts`, `tests/dashboard-board-write.test.ts`

**Modify:**
- `lib/permissions.ts` — add `PERM.DASHBOARD_PUBLISH_SHARED`, `PERM.DASHBOARD_MANAGE_TEMPLATES`
- `lib/sync/types.ts` — add `'dashboard_board_update'` to `WriteType`
- `lib/sync/handlers.ts` — payload type + handler + register in `registerAllHandlers`
- `app/(app)/dashboard/page.tsx` — rewrite as the grid host
- `app/globals.css` — full-bleed `:has()` override for the dashboard
- `package.json` — `react-grid-layout` dependency

---

## Task 1: Install the grid dependency

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install**

Run: `npm install react-grid-layout@1.5.0 && npm install -D @types/react-grid-layout`

- [ ] **Step 2: Verify build still green**

Run: `npm run build`
Expected: `compiled successfully`, RC 0.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add react-grid-layout for customizable dashboard"
```

---

## Task 2: Migration — dashboard_boards table, RLS, permission keys

**Files:**
- Create: `supabase/migrations/2026062700_dashboard_boards.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 2026062700_dashboard_boards.sql
-- Customizable dashboard: per-user + base-shared boards. One row per board,
-- widgets embedded as JSONB. RLS via matrix helpers. Phase-2 scope ('shared')
-- and role_template column are created now so no later migration is needed.

CREATE TABLE dashboard_boards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id       UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  owner_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,  -- NULL = shared/base board
  scope         TEXT NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal','shared')),
  name          TEXT NOT NULL DEFAULT 'My Dashboard',
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  role_template TEXT,                                            -- Phase 2: role-default templates
  layout        JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dashboard_boards_owner  ON dashboard_boards(base_id, owner_id);
CREATE INDEX idx_dashboard_boards_shared ON dashboard_boards(base_id) WHERE owner_id IS NULL;
CREATE UNIQUE INDEX uq_dashboard_boards_one_default_personal
  ON dashboard_boards(base_id, owner_id) WHERE is_default AND owner_id IS NOT NULL;

ALTER TABLE dashboard_boards ENABLE ROW LEVEL SECURITY;

-- READ: own personal boards + any shared board at an accessible base.
CREATE POLICY "dashboard_boards_select" ON dashboard_boards FOR SELECT TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND (owner_id = auth.uid() OR owner_id IS NULL)
  );

-- WRITE own personal boards (no extra permission needed).
CREATE POLICY "dashboard_boards_personal_write" ON dashboard_boards FOR ALL TO authenticated
  USING      (user_has_base_access(auth.uid(), base_id) AND owner_id = auth.uid())
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND owner_id = auth.uid());

-- WRITE shared/template boards requires the publish permission.
CREATE POLICY "dashboard_boards_shared_write" ON dashboard_boards FOR ALL TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id) AND owner_id IS NULL
    AND user_has_permission(auth.uid(), 'dashboard:publish-shared')
  )
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id) AND owner_id IS NULL
    AND user_has_permission(auth.uid(), 'dashboard:publish-shared')
  );

-- Permission keys (mirror in lib/permissions.ts as PERM.DASHBOARD_*).
INSERT INTO permissions (key, label, category, description) VALUES
  ('dashboard:publish-shared',   'Publish Shared Dashboards', 'dashboard', 'Create and edit base-shared dashboard boards and role templates'),
  ('dashboard:manage-templates', 'Manage Dashboard Templates','dashboard', 'Assign role-default dashboard templates new users inherit')
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, category = EXCLUDED.category, description = EXCLUDED.description;

-- sys_admin all-permissions seed predates these keys; grant explicitly (idempotent).
INSERT INTO role_permissions (role, permission_key)
SELECT 'sys_admin', key FROM permissions WHERE key LIKE 'dashboard:%'
ON CONFLICT (role, permission_key) DO NOTHING;

-- base_admin + airfield_manager: publish shared boards. base_admin also manages templates.
INSERT INTO role_permissions (role, permission_key) VALUES
  ('base_admin',       'dashboard:publish-shared'),
  ('base_admin',       'dashboard:manage-templates'),
  ('airfield_manager', 'dashboard:publish-shared')
ON CONFLICT (role, permission_key) DO NOTHING;
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db query --linked --file supabase/migrations/2026062700_dashboard_boards.sql`
Expected: no error (DDL returns no rows).

- [ ] **Step 3: Verify table + policies exist**

Create a throwaway file `/tmp/verify.sql` with:
```sql
SELECT policyname FROM pg_policies WHERE tablename = 'dashboard_boards' ORDER BY policyname;
```
Run: `npx supabase db query --linked --file /tmp/verify.sql`
Expected rows: `dashboard_boards_personal_write`, `dashboard_boards_select`, `dashboard_boards_shared_write`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/2026062700_dashboard_boards.sql
git commit -m "feat(db): dashboard_boards table, RLS, and permission keys"
```

---

## Task 3: Permission constants in lib/permissions.ts

**Files:**
- Modify: `lib/permissions.ts` (the `PERM` object, around line 11)

- [ ] **Step 1: Add the keys**

In the `PERM` object, add (match the existing `RESOURCE_ACTION: 'resource:action'` style):

```ts
  DASHBOARD_PUBLISH_SHARED: 'dashboard:publish-shared',
  DASHBOARD_MANAGE_TEMPLATES: 'dashboard:manage-templates',
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: RC 0.

- [ ] **Step 3: Commit**

```bash
git add lib/permissions.ts
git commit -m "feat: add dashboard permission keys to PERM"
```

---

## Task 4: Layout model + validation (pure)

**Files:**
- Create: `lib/dashboard/layout.ts`
- Test: `tests/dashboard-layout.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/dashboard-layout.test.ts
import { describe, it, expect } from 'vitest'
import { validateLayout, type WidgetInstance } from '@/lib/dashboard/layout'

describe('validateLayout', () => {
  it('returns [] for non-array / garbage input', () => {
    expect(validateLayout(null)).toEqual([])
    expect(validateLayout('nope')).toEqual([])
    expect(validateLayout({})).toEqual([])
  })

  it('keeps valid widget instances and coerces numeric grid fields', () => {
    const out = validateLayout([
      { i: 'a', type: 'last-check', config: {}, x: 0, y: 0, w: 4, h: 2 },
    ])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ i: 'a', type: 'last-check', x: 0, y: 0, w: 4, h: 2 })
  })

  it('drops items missing a stable id or type', () => {
    const out = validateLayout([
      { type: 'last-check', x: 0, y: 0, w: 4, h: 2 },          // no i
      { i: 'b', x: 0, y: 0, w: 4, h: 2 },                       // no type
      { i: 'c', type: 'last-check', x: 0, y: 0, w: 4, h: 2 },   // ok
    ])
    expect(out.map(w => w.i)).toEqual(['c'])
  })

  it('clamps negative/zero sizes to minimums and defaults config to {}', () => {
    const out = validateLayout([{ i: 'a', type: 'last-check', x: -3, y: -1, w: 0, h: 0 }])
    expect(out[0]).toMatchObject({ x: 0, y: 0, w: 1, h: 1, config: {} })
  })

  it('drops duplicate ids, keeping the first', () => {
    const out = validateLayout([
      { i: 'a', type: 'last-check', x: 0, y: 0, w: 4, h: 2 },
      { i: 'a', type: 'notams', x: 0, y: 2, w: 4, h: 2 },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].type).toBe('last-check')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dashboard-layout.test.ts`
Expected: FAIL — cannot resolve `@/lib/dashboard/layout`.

- [ ] **Step 3: Implement**

```ts
// lib/dashboard/layout.ts

/** One widget placed on a board. Stored verbatim in dashboard_boards.layout. */
export interface WidgetInstance {
  i: string                          // stable id (crypto.randomUUID())
  type: string                       // registry key; unknown types render a placeholder
  config: Record<string, unknown>
  x: number; y: number; w: number; h: number
}

function num(v: unknown, fallback: number, min: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback
  return n < min ? min : Math.floor(n)
}

/**
 * Coerce arbitrary stored/parsed JSON into a safe WidgetInstance[].
 * Tolerant by design: drops malformed entries and duplicate ids rather than
 * throwing, so a corrupt board never crashes the grid.
 */
export function validateLayout(raw: unknown): WidgetInstance[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: WidgetInstance[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    if (typeof r.i !== 'string' || !r.i) continue
    if (typeof r.type !== 'string' || !r.type) continue
    if (seen.has(r.i)) continue
    seen.add(r.i)
    out.push({
      i: r.i,
      type: r.type,
      config: (r.config && typeof r.config === 'object') ? r.config as Record<string, unknown> : {},
      x: num(r.x, 0, 0),
      y: num(r.y, 0, 0),
      w: num(r.w, 1, 1),
      h: num(r.h, 1, 1),
    })
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dashboard-layout.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/layout.ts tests/dashboard-layout.test.ts
git commit -m "feat(dashboard): widget layout model + tolerant validation"
```

---

## Task 5: Widget registry (definition + permission/module filtering)

**Files:**
- Create: `lib/dashboard/widget-registry.ts`
- Test: `tests/dashboard-widget-registry.test.ts`

The registry maps `type` → `WidgetDef`. `Component` is attached in Task 11 (registry entries reference components created later); for now the registry holds *metadata* and a `Component` slot. To keep this task pure and testable, `listAvailableWidgets` operates on metadata only.

- [ ] **Step 1: Write the failing test**

```ts
// tests/dashboard-widget-registry.test.ts
import { describe, it, expect } from 'vitest'
import { listAvailableWidgets, type WidgetMeta } from '@/lib/dashboard/widget-registry'

const METAS: WidgetMeta[] = [
  { type: 'last-check', kind: 'native', title: 'Last Check', description: '', defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 } },
  { type: 'open-discrepancies', kind: 'native', title: 'Open Discrepancies', description: '', defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 }, permission: 'discrepancies:read' },
  { type: 'ppr-today', kind: 'native', title: 'PPR Today', description: '', defaultSize: { w: 3, h: 3 }, minSize: { w: 2, h: 2 }, moduleHref: '/ppr' },
]

describe('listAvailableWidgets', () => {
  const has = (p: string) => p === 'discrepancies:read'
  const moduleEnabled = (href: string) => href !== '/ppr'   // /ppr disabled

  it('includes ungated widgets', () => {
    const out = listAvailableWidgets(METAS, has, moduleEnabled)
    expect(out.map(w => w.type)).toContain('last-check')
  })

  it('includes permission-gated widget when the user has the permission', () => {
    const out = listAvailableWidgets(METAS, has, moduleEnabled)
    expect(out.map(w => w.type)).toContain('open-discrepancies')
  })

  it('excludes permission-gated widget when the user lacks it', () => {
    const out = listAvailableWidgets(METAS, () => false, moduleEnabled)
    expect(out.map(w => w.type)).not.toContain('open-discrepancies')
  })

  it('excludes a widget whose module is disabled', () => {
    const out = listAvailableWidgets(METAS, has, moduleEnabled)
    expect(out.map(w => w.type)).not.toContain('ppr-today')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dashboard-widget-registry.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement (metadata + filtering; Component slot added in Task 11)**

```ts
// lib/dashboard/widget-registry.ts
import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'

export type WidgetKind = 'native' | 'links' | 'embed' | 'analytics'

/** Pure metadata — no React, so registry filtering is unit-testable. */
export interface WidgetMeta {
  type: string
  kind: WidgetKind
  title: string
  description: string
  defaultSize: { w: number; h: number }
  minSize: { w: number; h: number }
  permission?: string     // PERM key gate
  moduleHref?: string     // module gate via isModuleEnabled
  icon?: LucideIcon
}

export interface WidgetProps {
  config: Record<string, unknown>
  editing: boolean
}

/** Full definition = metadata + the React component that renders it. */
export interface WidgetDef extends WidgetMeta {
  Component: ComponentType<WidgetProps>
}

/**
 * Filter widget metadata to those the user may add: permission gate via `has`,
 * module gate via `moduleEnabled`. Mirrors the gating already used in the
 * sidebar / More so a widget can never expose an unreachable surface.
 */
export function listAvailableWidgets(
  metas: WidgetMeta[],
  has: (perm: string) => boolean,
  moduleEnabled: (href: string) => boolean,
): WidgetMeta[] {
  return metas.filter(m =>
    (!m.permission || has(m.permission)) &&
    (!m.moduleHref || moduleEnabled(m.moduleHref)),
  )
}

// The concrete registry (type → WidgetDef) is assembled in
// lib/dashboard/registry.tsx (Task 11) once widget components exist.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dashboard-widget-registry.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/widget-registry.ts tests/dashboard-widget-registry.test.ts
git commit -m "feat(dashboard): widget registry metadata + gating filter"
```

---

## Task 6: Board CRUD module

**Files:**
- Create: `lib/supabase/dashboard-boards.ts`

(No unit test — thin Supabase wrapper, like other `lib/supabase/*` modules. Exercised via the page and the queue caller test in Task 7.)

- [ ] **Step 1: Implement**

```ts
// lib/supabase/dashboard-boards.ts
import { friendlyError } from '@/lib/utils'
import { createClient } from './client'
import { validateLayout, type WidgetInstance } from '@/lib/dashboard/layout'

export type DashboardBoardRow = {
  id: string
  base_id: string
  owner_id: string | null
  scope: 'personal' | 'shared'
  name: string
  is_default: boolean
  role_template: string | null
  layout: WidgetInstance[]
  created_at: string
  updated_at: string
}

function hydrate(row: Record<string, any>): DashboardBoardRow {
  return { ...row, layout: validateLayout(row.layout) } as DashboardBoardRow
}

/** All boards visible to the caller at a base (own personal + shared). RLS-scoped. */
export async function fetchBoards(baseId: string): Promise<DashboardBoardRow[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('dashboard_boards')
    .select('*')
    .eq('base_id', baseId)
    .order('created_at', { ascending: true })
  if (error) { console.error('fetchBoards', error); return [] }
  return (data ?? []).map(hydrate)
}

export async function createBoard(input: {
  base_id: string
  owner_id: string | null
  name?: string
  scope?: 'personal' | 'shared'
  is_default?: boolean
  layout?: WidgetInstance[]
}): Promise<{ data: DashboardBoardRow | null; error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { data: null, error: 'Offline' }
  const { data, error } = await supabase
    .from('dashboard_boards')
    .insert({
      base_id: input.base_id,
      owner_id: input.owner_id,
      name: input.name ?? 'My Dashboard',
      scope: input.scope ?? 'personal',
      is_default: input.is_default ?? false,
      layout: input.layout ?? [],
    })
    .select('*')
    .single()
  if (error) return { data: null, error: friendlyError(error) }
  return { data: hydrate(data), error: null }
}

/** Direct layout update (online path). The offline-aware caller is in lib/dashboard-board-write.ts. */
export async function updateBoardLayout(
  id: string,
  layout: WidgetInstance[],
): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Offline' }
  const { error } = await supabase
    .from('dashboard_boards')
    .update({ layout, updated_at: new Date().toISOString() })
    .eq('id', id)
  return { error: error ? friendlyError(error) : null }
}

export async function deleteBoard(id: string): Promise<{ error: string | null }> {
  const supabase = createClient()
  if (!supabase) return { error: 'Offline' }
  const { error } = await supabase.from('dashboard_boards').delete().eq('id', id)
  return { error: error ? friendlyError(error) : null }
}

/** The caller's default personal board, creating an empty one on first visit. */
export async function getOrCreateDefaultBoard(
  baseId: string,
  userId: string,
): Promise<DashboardBoardRow | null> {
  const boards = await fetchBoards(baseId)
  const mine = boards.find(b => b.owner_id === userId && b.is_default)
  if (mine) return mine
  const { data } = await createBoard({
    base_id: baseId, owner_id: userId, name: 'My Dashboard', is_default: true, layout: [],
  })
  return data
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: RC 0.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/dashboard-boards.ts
git commit -m "feat(dashboard): board CRUD module"
```

---

## Task 7: Offline-queued layout save

**Files:**
- Modify: `lib/sync/types.ts` (the `WriteType` union)
- Modify: `lib/sync/handlers.ts` (payload type, handler, `registerAllHandlers`)
- Create: `lib/dashboard-board-write.ts`
- Test: `tests/dashboard-board-write.test.ts`

- [ ] **Step 1: Add the WriteType**

In `lib/sync/types.ts`, add to the `WriteType` union (after `'inspection_save_draft'`):

```ts
  | 'dashboard_board_update'
```

- [ ] **Step 2: Add payload type + handler in lib/sync/handlers.ts**

Near the other payload interfaces add:

```ts
export interface DashboardBoardUpdatePayload {
  id: string
  layout: import('@/lib/dashboard/layout').WidgetInstance[]
}
```

Add the handler function (follow the existing `airfieldStatusUpdateHandler` shape — it returns void/data and throws on hard failure):

```ts
async function dashboardBoardUpdateHandler(p: DashboardBoardUpdatePayload): Promise<null> {
  const { updateBoardLayout } = await import('@/lib/supabase/dashboard-boards')
  const { error } = await updateBoardLayout(p.id, p.layout)
  if (error) throw new Error(error)
  return null
}
```

Register it inside `registerAllHandlers(queue)`:

```ts
  queue.registerHandler('dashboard_board_update', dashboardBoardUpdateHandler)
```

- [ ] **Step 3: Write the failing test for the caller**

```ts
// tests/dashboard-board-write.test.ts
import { describe, it, expect, vi } from 'vitest'
import { saveBoardLayout } from '@/lib/dashboard-board-write'
import type { WidgetInstance } from '@/lib/dashboard/layout'

const layout: WidgetInstance[] = [{ i: 'a', type: 'last-check', config: {}, x: 0, y: 0, w: 3, h: 2 }]

describe('saveBoardLayout', () => {
  it('enqueues a dashboard_board_update with the board id + layout', async () => {
    const enqueueOrExecute = vi.fn().mockResolvedValue({ status: 'committed', data: null })
    const queue = { enqueueOrExecute } as any
    await saveBoardLayout({ boardId: 'board-1', layout, baseId: 'base-1', userId: 'user-1' }, queue)
    expect(enqueueOrExecute).toHaveBeenCalledWith(
      'dashboard_board_update',
      { id: 'board-1', layout },
      { baseId: 'base-1', userId: 'user-1', optimisticEntityId: 'board-1' },
    )
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run tests/dashboard-board-write.test.ts`
Expected: FAIL — cannot resolve `@/lib/dashboard-board-write`.

- [ ] **Step 5: Implement the caller**

```ts
// lib/dashboard-board-write.ts
import { getWriteQueue, type WriteQueue } from '@/lib/sync/write-queue'
import type { DashboardBoardUpdatePayload } from '@/lib/sync/handlers'
import type { WidgetInstance } from '@/lib/dashboard/layout'

export interface SaveBoardLayoutInput {
  boardId: string
  layout: WidgetInstance[]
  baseId: string
  userId: string
}

/** Persist a board layout through the offline write queue (online → inline). */
export async function saveBoardLayout(
  input: SaveBoardLayoutInput,
  queue: WriteQueue = getWriteQueue(),
): Promise<void> {
  await queue.enqueueOrExecute<DashboardBoardUpdatePayload, null>(
    'dashboard_board_update',
    { id: input.boardId, layout: input.layout },
    { baseId: input.baseId, userId: input.userId, optimisticEntityId: input.boardId },
  )
}
```

- [ ] **Step 6: Run tests + typecheck**

Run: `npx vitest run tests/dashboard-board-write.test.ts && npx tsc --noEmit`
Expected: PASS (1 test), tsc RC 0.

- [ ] **Step 7: Commit**

```bash
git add lib/sync/types.ts lib/sync/handlers.ts lib/dashboard-board-write.ts tests/dashboard-board-write.test.ts
git commit -m "feat(dashboard): offline-queued board layout save"
```

---

## Task 8: WidgetFrame (chrome around any widget)

**Files:**
- Create: `components/dashboard/widget-frame.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/dashboard/widget-frame.tsx
'use client'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

export function WidgetFrame({
  title, editing, onRemove, children,
}: {
  title: string
  editing: boolean
  onRemove?: () => void
  children: ReactNode
}) {
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px', borderBottom: '1px solid var(--color-border)', flexShrink: 0,
      }}>
        <span style={{
          fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: 'var(--color-text-3)',
        }}>{title}</span>
        {editing && onRemove && (
          <button onClick={onRemove} aria-label={`Remove ${title}`} style={{
            display: 'flex', border: 'none', background: 'transparent',
            cursor: 'pointer', color: 'var(--color-text-3)', padding: 2,
          }}>
            <X size={14} strokeWidth={2.5} />
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: RC 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/widget-frame.tsx
git commit -m "feat(dashboard): WidgetFrame chrome"
```

---

## Task 9: Native widget — inspection-status (worked example)

**Files:**
- Create: `components/dashboard/widgets/inspection-status-widget.tsx`

This ports the "Inspection Status Strip" from `app/(app)/dashboard/page.tsx:144-202`, reusing `fetchInspections` + `pickTodaysInspection` (`lib/inspection-status.ts`). Widget components read `useInstallation()` directly.

- [ ] **Step 1: Implement**

```tsx
// components/dashboard/widgets/inspection-status-widget.tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchInspections } from '@/lib/supabase/inspections'
import { pickTodaysInspection } from '@/lib/inspection-status'
import { CheckCircle2, ClipboardList, Sunrise, Moon } from 'lucide-react'

type S = { status: 'none' | 'in_progress' | 'completed'; inspector?: string }

export function InspectionStatusWidget() {
  const { installationId, currentInstallation } = useInstallation()
  const [af, setAf] = useState<S>({ status: 'none' })
  const [lt, setLt] = useState<S>({ status: 'none' })

  useEffect(() => {
    if (!installationId) return
    const tz = currentInstallation?.timezone || 'America/New_York'
    const localNow = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
    if (localNow.getHours() < 6) localNow.setDate(localNow.getDate() - 1)
    const today = `${localNow.getFullYear()}-${String(localNow.getMonth() + 1).padStart(2, '0')}-${String(localNow.getDate()).padStart(2, '0')}`
    fetchInspections(installationId).then((rows) => {
      const a = pickTodaysInspection(rows, 'airfield', today)
      const l = pickTodaysInspection(rows, 'lighting', today)
      setAf(a ? { status: a.status as S['status'], inspector: a.inspector_name || undefined } : { status: 'none' })
      setLt(l ? { status: l.status as S['status'], inspector: l.inspector_name || undefined } : { status: 'none' })
    })
  }, [installationId, currentInstallation?.timezone])

  const row = (label: string, s: S, NoneIcon: typeof Sunrise) => {
    const color = s.status === 'completed' ? 'var(--color-status-pass)'
      : s.status === 'in_progress' ? 'var(--color-status-inwork)' : 'var(--color-text-3)'
    const Icon = s.status === 'completed' ? CheckCircle2 : s.status === 'in_progress' ? ClipboardList : NoneIcon
    const text = s.status === 'completed' ? 'Complete'
      : s.status === 'in_progress' ? `In Progress${s.inspector ? ` — ${s.inspector}` : ''}` : 'Not Started'
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
        <Icon size={18} color={color} strokeWidth={2.25} />
        <div>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-1)' }}>{label}</div>
          <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 800, color }}>{text}</div>
        </div>
      </div>
    )
  }

  return (
    <Link href="/inspections" style={{ textDecoration: 'none', display: 'block' }}>
      {row('Airfield Inspection', af, Sunrise)}
      {row('Lighting Inspection', lt, Moon)}
    </Link>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: RC 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/widgets/inspection-status-widget.tsx
git commit -m "feat(dashboard): inspection-status widget"
```

---

## Task 10: Native widget — open-discrepancies (live list + deep-link + inline action)

**Files:**
- Create: `components/dashboard/widgets/open-discrepancies-widget.tsx`

Reuses `lib/supabase/discrepancies`. Confirm the list fetch + field names by reading that module first (`fetchDiscrepancies` or equivalent); the code below assumes `fetchDiscrepancies(baseId)` returning rows with `id, title, current_status, assigned_shop, created_at, severity`. **Adjust field names to the actual module API before implementing.**

- [ ] **Step 1: Read the discrepancies module to confirm the API**

Run: `grep -nE "export (async )?function|current_status|assigned_shop|severity|created_at" lib/supabase/discrepancies.ts | head -30`
Use the real fetch function name + fields in Step 2.

- [ ] **Step 2: Implement**

```tsx
// components/dashboard/widgets/open-discrepancies-widget.tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useInstallation } from '@/lib/installation-context'
import { fetchDiscrepancies } from '@/lib/supabase/discrepancies'

type Row = { id: string; title: string; current_status: string; assigned_shop: string | null; created_at: string }

function ageDays(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  return `${d}d`
}

export function OpenDiscrepanciesWidget() {
  const { installationId } = useInstallation()
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    if (!installationId) return
    fetchDiscrepancies(installationId).then((all: any[]) => {
      setRows(all.filter(r => r.current_status !== 'closed') as Row[])
    })
  }, [installationId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)' }}>Open</span>
        <span style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: 'var(--color-text-1)' }}>{rows.length}</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {rows.slice(0, 12).map(r => (
          <Link key={r.id} href={`/discrepancies/${r.id}`} style={{
            display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0',
            borderBottom: '1px solid var(--color-border)', textDecoration: 'none',
            fontSize: 'var(--fs-sm)', color: 'var(--color-text-1)',
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
            <span style={{ flexShrink: 0, color: 'var(--color-text-3)', fontFamily: 'var(--font-family-mono)' }}>
              {r.assigned_shop ?? '—'} · {ageDays(r.created_at)}
            </span>
          </Link>
        ))}
        {rows.length === 0 && (
          <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)', padding: '8px 0' }}>No open discrepancies.</div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <Link href="/discrepancies/new" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-accent)', textDecoration: 'none' }}>+ New</Link>
        <Link href="/discrepancies" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-cyan)', textDecoration: 'none' }}>View all →</Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: RC 0.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/widgets/open-discrepancies-widget.tsx
git commit -m "feat(dashboard): open-discrepancies widget"
```

---

## Task 11: Remaining native widgets + assemble the registry

**Files:**
- Create: the remaining seven widget components (listed below)
- Create: `lib/dashboard/registry.tsx` (assembles `type → WidgetDef`)

Each remaining widget is a mechanical port of an existing dashboard surface, following the Task 9/10 pattern: `'use client'`, read `useInstallation()`, fetch via the existing module, render compact + deep-link, wrap nothing (the grid supplies `WidgetFrame`). Build each, then register all.

| Component file | Ports / data source | Notes |
|---|---|---|
| `last-check-widget.tsx` | `airfield_checks` last row (page lines 65-80) | shows `TYPE @ HHMMZ` |
| `personnel-widget.tsx` | `lib/supabase/contractors` active list | count + first few; "+ Add" opens `/contractors` |
| `shift-checklist-widget.tsx` | `lib/supabase/shift-checklist` today | progress ring `done/total`; link `/shift-checklist` |
| `notams-widget.tsx` | `hooks/use-expiring-notams` or notams fetch | active count + list; link `/notams` |
| `ppr-today-widget.tsx` | `lib/supabase/ppr` arrivals today | count + list; link `/ppr` |
| `afm-toggles-widget.tsx` | `useDashboard()` OOO/closed | reuse toggle buttons from page lines 332-387 |
| `quick-actions-widget.tsx` | static tiles, `isModuleEnabled` | config `{ tiles: string[] }`; default = current quick-action set |

- [ ] **Step 1: Implement each remaining widget component**

For each row above, create the component reading the named source and rendering a compact view + deep-link, mirroring Task 9/10. For `afm-toggles-widget.tsx`, lift the two `<button>` blocks and their dialogs from `app/(app)/dashboard/page.tsx` (OOO at lines 332-358, Close at 359-387, dialogs 390-640) into the component so the host page can shed them.

- [ ] **Step 2: Assemble the registry**

```tsx
// lib/dashboard/registry.tsx
import { ClipboardList, AlertTriangle, Clock, HardHat, ListChecks, Radio, Plane, DoorOpen, LayoutGrid } from 'lucide-react'
import type { WidgetDef } from '@/lib/dashboard/widget-registry'
import { PERM } from '@/lib/permissions'
import { InspectionStatusWidget } from '@/components/dashboard/widgets/inspection-status-widget'
import { OpenDiscrepanciesWidget } from '@/components/dashboard/widgets/open-discrepancies-widget'
import { LastCheckWidget } from '@/components/dashboard/widgets/last-check-widget'
import { PersonnelWidget } from '@/components/dashboard/widgets/personnel-widget'
import { ShiftChecklistWidget } from '@/components/dashboard/widgets/shift-checklist-widget'
import { NotamsWidget } from '@/components/dashboard/widgets/notams-widget'
import { PprTodayWidget } from '@/components/dashboard/widgets/ppr-today-widget'
import { AfmTogglesWidget } from '@/components/dashboard/widgets/afm-toggles-widget'
import { QuickActionsWidget } from '@/components/dashboard/widgets/quick-actions-widget'

export const WIDGETS: Record<string, WidgetDef> = {
  'inspection-status':  { type: 'inspection-status', kind: 'native', title: 'Inspection Status', description: "Today's airfield + lighting inspections", icon: ClipboardList, defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 2 }, Component: () => <InspectionStatusWidget /> },
  'open-discrepancies': { type: 'open-discrepancies', kind: 'native', title: 'Open Discrepancies', description: 'Live open discrepancy list', icon: AlertTriangle, defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 }, permission: 'discrepancies:read', Component: () => <OpenDiscrepanciesWidget /> },
  'last-check':         { type: 'last-check', kind: 'native', title: 'Last Check', description: 'Most recent completed check', icon: Clock, defaultSize: { w: 3, h: 1 }, minSize: { w: 2, h: 1 }, Component: () => <LastCheckWidget /> },
  'personnel':          { type: 'personnel', kind: 'native', title: 'Personnel on Airfield', description: 'Active personnel now', icon: HardHat, defaultSize: { w: 3, h: 3 }, minSize: { w: 2, h: 2 }, moduleHref: '/contractors', Component: () => <PersonnelWidget /> },
  'shift-checklist':    { type: 'shift-checklist', kind: 'native', title: 'Shift Checklist', description: "Today's checklist progress", icon: ListChecks, defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 1 }, moduleHref: '/shift-checklist', Component: () => <ShiftChecklistWidget /> },
  'notams':             { type: 'notams', kind: 'native', title: 'Active NOTAMs', description: 'Current NOTAMs', icon: Radio, defaultSize: { w: 4, h: 3 }, minSize: { w: 2, h: 2 }, moduleHref: '/notams', Component: () => <NotamsWidget /> },
  'ppr-today':          { type: 'ppr-today', kind: 'native', title: 'PPR Today', description: "Today's arrivals", icon: Plane, defaultSize: { w: 3, h: 3 }, minSize: { w: 2, h: 2 }, moduleHref: '/ppr', Component: () => <PprTodayWidget /> },
  'afm-toggles':        { type: 'afm-toggles', kind: 'native', title: 'AFM Status', description: 'Out of Office / Close Airfield', icon: DoorOpen, defaultSize: { w: 3, h: 2 }, minSize: { w: 2, h: 1 }, permission: PERM.AIRFIELD_STATUS_WRITE, Component: () => <AfmTogglesWidget /> },
  'quick-actions':      { type: 'quick-actions', kind: 'native', title: 'Quick Actions', description: 'Module launcher tiles', icon: LayoutGrid, defaultSize: { w: 4, h: 2 }, minSize: { w: 2, h: 1 }, Component: (p) => <QuickActionsWidget config={p.config} /> },
}

export function getWidgetDef(type: string): WidgetDef | undefined { return WIDGETS[type] }
export const ALL_WIDGET_METAS = Object.values(WIDGETS).map(({ Component, ...meta }) => meta)
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: RC 0, compiled successfully.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/widgets/ lib/dashboard/registry.tsx
git commit -m "feat(dashboard): remaining native widgets + registry assembly"
```

---

## Task 12: WidgetGrid (react-grid-layout wrapper)

**Files:**
- Create: `components/dashboard/widget-grid.tsx`

Renders a layout to a responsive grid; emits layout changes upward (debounced save lives in the host, Task 15). Unknown widget types render a placeholder (never crash).

- [ ] **Step 1: Implement**

```tsx
// components/dashboard/widget-grid.tsx
'use client'
import { Responsive, WidthProvider, type Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { WidgetFrame } from './widget-frame'
import { getWidgetDef } from '@/lib/dashboard/registry'
import type { WidgetInstance } from '@/lib/dashboard/layout'

const ResponsiveGrid = WidthProvider(Responsive)
const COLS = { lg: 12, md: 8, sm: 1 }
const BREAKPOINTS = { lg: 996, md: 600, sm: 0 }

export function WidgetGrid({
  widgets, editing, onLayoutChange, onRemove,
}: {
  widgets: WidgetInstance[]
  editing: boolean
  onLayoutChange: (next: WidgetInstance[]) => void
  onRemove: (id: string) => void
}) {
  const rglLayout: Layout[] = widgets.map(w => {
    const def = getWidgetDef(w.type)
    return { i: w.i, x: w.x, y: w.y, w: w.w, h: w.h, minW: def?.minSize.w ?? 1, minH: def?.minSize.h ?? 1 }
  })

  function handleChange(current: Layout[]) {
    const byId = new Map(current.map(l => [l.i, l]))
    onLayoutChange(widgets.map(w => {
      const l = byId.get(w.i)
      return l ? { ...w, x: l.x, y: l.y, w: l.w, h: l.h } : w
    }))
  }

  return (
    <ResponsiveGrid
      className="dashboard-grid"
      layouts={{ lg: rglLayout, md: rglLayout, sm: rglLayout }}
      breakpoints={BREAKPOINTS}
      cols={COLS}
      rowHeight={80}
      margin={[12, 12]}
      isDraggable={editing}
      isResizable={editing}
      onLayoutChange={(cur) => { if (editing) handleChange(cur) }}
      draggableCancel="a,button"
    >
      {widgets.map(w => {
        const def = getWidgetDef(w.type)
        return (
          <div key={w.i}>
            <WidgetFrame title={def?.title ?? 'Unavailable'} editing={editing} onRemove={() => onRemove(w.i)}>
              {def ? <def.Component config={w.config} editing={editing} />
                   : <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>This widget is unavailable.</div>}
            </WidgetFrame>
          </div>
        )
      })}
    </ResponsiveGrid>
  )
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: RC 0, compiled successfully.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/widget-grid.tsx
git commit -m "feat(dashboard): responsive widget grid wrapper"
```

---

## Task 13: WidgetPalette (add-widget drawer)

**Files:**
- Create: `components/dashboard/widget-palette.tsx`

Lists addable widgets (gated via `listAvailableWidgets`) grouped by kind; clicking one calls `onAdd(type)`.

- [ ] **Step 1: Implement**

```tsx
// components/dashboard/widget-palette.tsx
'use client'
import { useInstallation } from '@/lib/installation-context'
import { usePermissions } from '@/lib/permissions'
import { isModuleEnabled } from '@/lib/modules-config'
import { listAvailableWidgets } from '@/lib/dashboard/widget-registry'
import { ALL_WIDGET_METAS } from '@/lib/dashboard/registry'

export function WidgetPalette({ onAdd, onClose }: { onAdd: (type: string) => void; onClose: () => void }) {
  const { has } = usePermissions()
  const { enabledModules, currentInstallation } = useInstallation()
  const airportType = currentInstallation?.airport_type ?? null
  const available = listAvailableWidgets(
    ALL_WIDGET_METAS, has,
    (href) => isModuleEnabled(href, enabledModules, airportType),
  )

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card" style={{ width: '100%', maxWidth: 520, padding: 20, maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 12 }}>Add a widget</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
          {available.map(m => (
            <button key={m.type} onClick={() => { onAdd(m.type); onClose() }} style={{
              display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start',
              padding: 12, borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left',
              background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
              color: 'var(--color-text-1)', fontFamily: 'inherit',
            }}>
              {m.icon && <m.icon size={18} color="var(--color-accent)" strokeWidth={2.25} />}
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>{m.title}</span>
              <span style={{ fontSize: 'var(--fs-2xs)', color: 'var(--color-text-3)' }}>{m.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: RC 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/widget-palette.tsx
git commit -m "feat(dashboard): add-widget palette"
```

---

## Task 14: BoardBar (header row: title + edit toggle)

**Files:**
- Create: `components/dashboard/board-bar.tsx`

Phase 1 has one personal board, so the switcher is just the board name for now; the Edit toggle + (in edit mode) "+ Add Widget" and "Done" are the working controls.

- [ ] **Step 1: Implement**

```tsx
// components/dashboard/board-bar.tsx
'use client'
import { Pencil, Plus, Check } from 'lucide-react'

export function BoardBar({
  boardName, editing, onToggleEdit, onAddWidget,
}: {
  boardName: string
  editing: boolean
  onToggleEdit: () => void
  onAddWidget: () => void
}) {
  const btn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
    borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 'var(--fs-sm)', fontWeight: 600, border: '1px solid var(--color-border)',
    background: 'var(--color-bg-surface)', color: 'var(--color-text-1)',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, minHeight: 36 }}>
      <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 800, color: 'var(--color-text-1)' }}>{boardName}</span>
      <div style={{ display: 'flex', gap: 8 }}>
        {editing && (
          <button style={{ ...btn, borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)' }} onClick={onAddWidget}>
            <Plus size={15} strokeWidth={2.5} /> Add Widget
          </button>
        )}
        <button style={btn} onClick={onToggleEdit}>
          {editing ? <><Check size={15} strokeWidth={2.5} /> Done</> : <><Pencil size={15} strokeWidth={2.5} /> Edit</>}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: RC 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/board-bar.tsx
git commit -m "feat(dashboard): board bar with edit toggle"
```

---

## Task 15: Dashboard host page rewrite + full-bleed CSS

**Files:**
- Modify: `app/(app)/dashboard/page.tsx` (full rewrite of the default export)
- Modify: `app/globals.css` (full-bleed override)

The host: loads the default board, holds layout state, renders `BoardBar` + `WidgetGrid` (+ `WidgetPalette` in edit mode), and saves via `saveBoardLayout` (debounced). The OOO/closed dialogs now live in `afm-toggles-widget.tsx` (Task 11), so the page sheds them. A first-time user with an empty board sees an empty-state prompt to add widgets (or we seed a sensible default — see Step 2).

- [ ] **Step 1: Add the full-bleed CSS**

In `app/globals.css`, add (uses `:has()` so only the dashboard page widens its `.app-content` parent):

```css
/* Dashboard is full-bleed: opt out of the 1400px .app-content cap. */
.app-content:has(.dashboard-fullbleed) {
  max-width: none;
}
```

- [ ] **Step 2: Rewrite the page**

```tsx
// app/(app)/dashboard/page.tsx
'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useInstallation } from '@/lib/installation-context'
import { PageHeader } from '@/components/ui/page-header'
import { BoardBar } from '@/components/dashboard/board-bar'
import { WidgetGrid } from '@/components/dashboard/widget-grid'
import { WidgetPalette } from '@/components/dashboard/widget-palette'
import { getOrCreateDefaultBoard } from '@/lib/supabase/dashboard-boards'
import { saveBoardLayout } from '@/lib/dashboard-board-write'
import { getWidgetDef } from '@/lib/dashboard/registry'
import type { WidgetInstance } from '@/lib/dashboard/layout'
import { toast } from 'sonner'

// Sensible starter layout for a brand-new board.
const DEFAULT_LAYOUT: WidgetInstance[] = [
  { i: 'w-insp', type: 'inspection-status', config: {}, x: 0, y: 0, w: 3, h: 2 },
  { i: 'w-disc', type: 'open-discrepancies', config: {}, x: 3, y: 0, w: 5, h: 3 },
  { i: 'w-last', type: 'last-check', config: {}, x: 8, y: 0, w: 4, h: 1 },
  { i: 'w-shift', type: 'shift-checklist', config: {}, x: 8, y: 1, w: 4, h: 2 },
]

function uuid(): string {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `w-${Math.floor(Math.random() * 1e9).toString(36)}`
}

export default function DashboardPage() {
  const { installationId } = useInstallation()
  const [boardId, setBoardId] = useState<string | null>(null)
  const [boardName, setBoardName] = useState('My Dashboard')
  const [widgets, setWidgets] = useState<WidgetInstance[]>([])
  const [editing, setEditing] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load user + default board.
  useEffect(() => {
    if (!installationId) return
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase!.auth.getSession()
      const uid = session?.user?.id ?? null
      if (cancelled) return
      setUserId(uid)
      if (!uid) return
      const board = await getOrCreateDefaultBoard(installationId, uid)
      if (cancelled || !board) return
      setBoardId(board.id)
      setBoardName(board.name)
      setWidgets(board.layout.length ? board.layout : DEFAULT_LAYOUT)
    })()
    return () => { cancelled = true }
  }, [installationId])

  const persist = useCallback((next: WidgetInstance[]) => {
    if (!boardId || !installationId || !userId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveBoardLayout({ boardId, layout: next, baseId: installationId, userId })
        .catch(() => toast.error('Could not save dashboard layout'))
    }, 800)
  }, [boardId, installationId, userId])

  const onLayoutChange = useCallback((next: WidgetInstance[]) => {
    setWidgets(next); persist(next)
  }, [persist])

  const onRemove = useCallback((id: string) => {
    setWidgets(prev => { const next = prev.filter(w => w.i !== id); persist(next); return next })
  }, [persist])

  const onAdd = useCallback((type: string) => {
    const def = getWidgetDef(type)
    if (!def) return
    setWidgets(prev => {
      const next = [...prev, { i: uuid(), type, config: {}, x: 0, y: Infinity as unknown as number, w: def.defaultSize.w, h: def.defaultSize.h }]
      persist(next); return next
    })
  }, [persist])

  const isEmpty = useMemo(() => widgets.length === 0, [widgets])

  return (
    <div className="page-container dashboard-fullbleed">
      <PageHeader eyebrow="Operations" title="Dashboard" />
      <BoardBar
        boardName={boardName}
        editing={editing}
        onToggleEdit={() => setEditing(e => !e)}
        onAddWidget={() => setShowPalette(true)}
      />
      {isEmpty ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-3)' }}>
          Your dashboard is empty. {editing ? 'Use “Add Widget” to get started.' : 'Tap Edit, then Add Widget.'}
        </div>
      ) : (
        <WidgetGrid widgets={widgets} editing={editing} onLayoutChange={onLayoutChange} onRemove={onRemove} />
      )}
      {showPalette && <WidgetPalette onAdd={onAdd} onClose={() => setShowPalette(false)} />}
    </div>
  )
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: RC 0, compiled successfully. (If `afm-toggles-widget` still imports something only the old page had, resolve before continuing.)

- [ ] **Step 4: Commit**

```bash
git add app/(app)/dashboard/page.tsx app/globals.css
git commit -m "feat(dashboard): grid host page + full-bleed layout"
```

---

## Task 16: Full verification + handoff

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all pass, including `dashboard-layout`, `dashboard-widget-registry`, `dashboard-board-write` (prior baseline 924 pass + new tests).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: `compiled successfully`, RC 0.

- [ ] **Step 3: Manual smoke (dev server)**

Run: `npm run dev`, open `/dashboard`. Confirm: default widgets render with live data; Edit → drag/resize → reload persists; remove a widget persists; Add Widget palette only offers gated/enabled widgets; full-bleed uses the full width and collapsing the sidebar widens the grid; mobile width reflows to one column.

- [ ] **Step 4: Final commit (if any smoke fixes)**

```bash
git add -A
git commit -m "fix(dashboard): phase-1 smoke-test corrections"
```

---

## Self-review notes (author)

- **Spec coverage:** widget grid (T12), per-user board + persistence (T2,T6,T15), offline-queued saves (T7), native-widget port incl. live discrepancies inline (T9–T11), responsive reflow (T12), full-bleed (T15), permission/module gating (T5,T13), unknown-widget fallback (T12). Web embeds / links / shared boards / role templates / analytics are **Phase 2/3** — intentionally out of scope; schema already carries `scope`/`role_template` so no later migration.
- **Deferred-but-noted:** a scoped per-board fetch coordinator (spec §10 perf) and `version` field on layout are not needed for P1 (validation is shape-tolerant); revisit if widget count/perf demands it.
- **Verify-before-implement flag:** Task 10 requires confirming the real `fetchDiscrepancies` API/fields before coding; Task 11 similarly for each ported module. These are the only places the plan assumes an external signature.
