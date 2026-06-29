# Per-Device Dashboard Layouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Independent desktop/tablet/mobile layouts (same widgets, per-device positions), batch edit with save-on-Done (no per-move writes), smooth dragging, and resize from any corner.

**Architecture:** Phase 1 improves editing UX on the existing single-layout model (batch save, memoized smooth drag, multi-corner resize). Phase 2 changes the stored shape to `BoardLayout = { lg, md?, sm? }` with read-side back-compat (no DB migration) and per-breakpoint persistence.

**Tech Stack:** Next.js 14 / React 18 / TypeScript, react-grid-layout 1.x, Supabase, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-29-dashboard-per-device-layouts-design.md`

---

## Reference facts (verified)
- `lib/dashboard/layout.ts`: `WidgetInstance {i,type,config,x,y,w,h}`, `validateLayout(raw): WidgetInstance[]` (rejects non-array → `[]`), `appendWidgetToLayout(layout, source, newId)`.
- `lib/supabase/dashboard-boards.ts`: `DashboardBoardRow.layout: WidgetInstance[]`; `hydrate(row)` maps `layout` via `validateLayout`; `createBoard`, `updateBoardLayout(id, layout)` (has the 0-row loud-failure guard), `fetchBoards`, `getOrCreateDefaultBoard`.
- `lib/dashboard-board-write.ts`: `saveBoardLayout({boardId, layout, baseId, userId})`. `lib/sync/handlers.ts`: `DashboardBoardUpdatePayload {id, layout}` → `updateBoardLayout`.
- `lib/dashboard/board-templates.ts`: `seedLayoutFromTemplate(boards, role): WidgetInstance[]`.
- `app/(app)/dashboard/page.tsx`: `widgets` state (`WidgetInstance[]`), `DEFAULT_LAYOUT`, `persist` (800ms debounce), `onLayoutChange/onRemove/onAdd/onWidgetConfigChange/handleConfigSave`, `onSwitch`, `onToggleEdit`, `handleDuplicateBoard`, `handleCreateShared`, `copyWidgetToBoard`, `refreshBoards`, unmount cleanup (clears saveTimer).
- `components/dashboard/widget-grid.tsx`: `ResponsiveGrid`, `COLS={lg:12,md:8,sm:1}`, `BREAKPOINTS={lg:996,md:600,sm:0}`, `handleChange` (lg-only guard), `onLayoutChange`, `draggableCancel`, maps `widgets`→children.
- react-grid-layout supports `resizeHandles`, `onDragStop`, `layouts={{lg,md,sm}}`. react-resizable CSS ships handle classes for nw/ne/sw/se.

---

# PHASE 1 — editing UX (single-layout model unchanged)

## Task 1: Batch save on "Done" + flush on navigate/switch

**Files:** Modify `app/(app)/dashboard/page.tsx`

Replace the per-change debounced persist with: edits update state only; persist once on Done; flush on unmount/switch while editing.

- [ ] **Step 1: Add a flush-capable pending-save ref and a `flushSave` callback.** Near `saveTimer` (the `useRef`), add a ref holding the latest layout and the save args, and a stable flush:
```tsx
  // Latest unsaved layout (set during edit; persisted on Done / flush).
  const pendingRef = useRef<{ boardId: string; baseId: string; userId: string; layout: WidgetInstance[] } | null>(null)

  const flushSave = useCallback(() => {
    const p = pendingRef.current
    pendingRef.current = null
    if (!p) return
    saveBoardLayout({ boardId: p.boardId, layout: validateLayout(p.layout), baseId: p.baseId, userId: p.userId })
      .catch((e) => toast.error(e instanceof Error && e.message ? e.message : 'Could not save dashboard layout'))
  }, [])
```

- [ ] **Step 2: Change `persist` to stage (not write).** Replace the body of `persist` so it only records the pending save (no setTimeout write):
```tsx
  const persist = useCallback((next: WidgetInstance[]) => {
    if (!activeId || !installationId || !userId) return
    pendingRef.current = { boardId: activeId, baseId: installationId, userId, layout: next }
  }, [activeId, installationId, userId])
```
Delete the old `saveTimer` `setTimeout` logic in `persist`. (Keep the `saveTimer` ref removal — see Step 5.)

- [ ] **Step 3: Persist on Done.** In `onToggleEdit`, when leaving edit mode, flush:
```tsx
  const onToggleEdit = useCallback(() => {
    if (!editing && activeBoard?.scope === 'shared' && !canPublishShared) {
      toast('Shared dashboards can only be edited by an admin. Use Duplicate to make your own editable copy.', { id: 'shared-edit-guard' })
      return
    }
    if (editing) flushSave()        // leaving edit → save everything once
    setEditing(e => !e)
  }, [editing, activeBoard, canPublishShared, flushSave])
```

- [ ] **Step 4: Flush on board switch + unmount while editing.** In `onSwitch`, call `flushSave()` before switching (replace the `saveTimer` clear). In the unmount `useEffect`, return `flushSave` as cleanup:
```tsx
  // onSwitch: replace the saveTimer clear with:
    flushSave()
  // unmount effect:
  useEffect(() => flushSave, [flushSave])
```

- [ ] **Step 5: Remove the now-dead `saveTimer` ref** and its references. Confirm no remaining `saveTimer` usages (`grep saveTimer`).

- [ ] **Step 6: Verify.** `npx tsc --noEmit` (0), `npm run build` (compiled). Commit:
```
git add "app/(app)/dashboard/page.tsx"
git commit -m "feat(dashboard): batch edits, save once on Done (no per-move writes)"
```

**Note for reviewer:** mutations (`onAdd/onRemove/onWidgetConfigChange/handleConfigSave/onLayoutChange`) still call `setWidgets(next); persist(next)` — `persist` now just stages. Live behavior (Done saves, navigate flushes) needs a preview smoke test.

---

## Task 2: Memoized widget for smooth dragging

**Files:** Modify `components/dashboard/widget-grid.tsx`

- [ ] **Step 1: Extract a memoized `DashboardWidget`.** Add above `WidgetGrid`:
```tsx
import { memo, useCallback } from 'react'
// ...
type DashboardWidgetProps = {
  id: string
  type: string
  config: Record<string, unknown>
  editing: boolean
  copyBoards: { id: string; name: string }[]
  onRemove: (id: string) => void
  onConfigure: (id: string) => void
  onWidgetConfigChange: (id: string, config: Record<string, unknown>) => void
  onCopyWidget: (id: string, target: string) => void
}
const DashboardWidget = memo(function DashboardWidget(p: DashboardWidgetProps) {
  const def = getWidgetDef(p.type)
  return (
    <WidgetFrame
      title={((p.config?.title as string) || '').trim() || def?.title || 'Unavailable'}
      editing={p.editing}
      onRemove={() => p.onRemove(p.id)}
      onConfigure={def?.ConfigForm ? () => p.onConfigure(p.id) : undefined}
      color={(p.config?.color as string) || undefined}
      onSetColor={(c) => p.onWidgetConfigChange(p.id, { ...p.config, color: c })}
      copyTargets={p.copyBoards}
      onCopyTo={(target) => p.onCopyWidget(p.id, target)}
    >
      {def ? <def.Component config={p.config} editing={p.editing} onConfigChange={(c) => p.onWidgetConfigChange(p.id, c)} />
           : <div style={{ color: 'var(--color-text-3)', fontSize: 'var(--fs-sm)' }}>This widget is unavailable.</div>}
    </WidgetFrame>
  )
})
```
The memo skips re-render unless `type`/`config`/`editing`/`copyBoards`/a callback identity changes — crucially **not** on `x/y/w/h`, so a drag never re-renders content.

- [ ] **Step 2: Render via `DashboardWidget`.** Replace the inline `<WidgetFrame>…</WidgetFrame>` block inside `widgets.map` with:
```tsx
      {widgets.map(w => (
        <div key={w.i}>
          <DashboardWidget
            id={w.i} type={w.type} config={w.config} editing={editing}
            copyBoards={copyBoards}
            onRemove={onRemove} onConfigure={onConfigure}
            onWidgetConfigChange={onWidgetConfigChange} onCopyWidget={onCopyWidget}
          />
        </div>
      ))}
```
Change `onCopyWidget` prop type on `WidgetGrid` to `(id: string, target: string) => void` and in `page.tsx` adapt the wiring: `onCopyWidget={(id, target) => copyWidgetToBoard(widgets.find(w => w.i === id)!, target)}` — OR keep `copyWidgetToBoard(widget, target)` and pass a `(id,target)` adapter. (Reviewer: ensure parent callbacks are `useCallback`-stable; `copyBoards` is already a memo.)

- [ ] **Step 3: Verify.** `tsc` 0, `build` compiled, `npx vitest run dashboard` pass. Commit:
```
git add components/dashboard/widget-grid.tsx "app/(app)/dashboard/page.tsx"
git commit -m "perf(dashboard): memoize widget content so dragging doesn't re-render it"
```

---

## Task 3: Resize from any corner

**Files:** Modify `components/dashboard/widget-grid.tsx`, `app/(app)/globals.css`

- [ ] **Step 1: Enable corner handles.** On `<ResponsiveGrid>`, add `resizeHandles={['nw','ne','sw','se']}`.
- [ ] **Step 2: Ensure the react-resizable handle CSS is imported** (the grid already imports `react-resizable/css/styles.css`). Add edit-mode visibility CSS to `globals.css` so all four corner handles show within the edit boundary:
```css
.dashboard-grid .react-grid-item > .react-resizable-handle { opacity: 0; }
.dashboard-grid .react-grid-item:hover > .react-resizable-handle { opacity: 0.9; }
```
(Adjust to match the existing edit "red boundary" treatment if one exists in globals.css.)
- [ ] **Step 3: Verify.** `tsc` 0, `build` compiled. Commit:
```
git add components/dashboard/widget-grid.tsx app/globals.css
git commit -m "feat(dashboard): resize widgets from any corner"
```

---

# PHASE 2 — per-device layouts

## Task 4: `BoardLayout` types + pure helpers (+ tests)

**Files:** Modify `lib/dashboard/layout.ts`; Create `tests/dashboard-board-layout.test.ts`

- [ ] **Step 1: Write failing tests** — `tests/dashboard-board-layout.test.ts` covering `validateBoardLayout` (array→{lg}, object shape, junk→{lg:[]}, missing md/sm), `reconcileBoardLayout` (drop stale md/sm ids, add missing lg ids at bottom, idempotent), `appendWidgetToBoardLayout` (appends to lg+md+sm with the given id, deep-copied config). (Author concrete cases mirroring `dashboard-layout-append.test.ts` style.)

- [ ] **Step 2: Implement** in `layout.ts`:
```ts
export type DeviceClass = 'lg' | 'md' | 'sm'
export type BoardLayout = { lg: WidgetInstance[]; md?: WidgetInstance[]; sm?: WidgetInstance[] }

/** Normalize raw stored JSON into a BoardLayout. Legacy flat arrays → { lg }. */
export function validateBoardLayout(raw: unknown): BoardLayout {
  if (Array.isArray(raw)) return reconcileBoardLayout({ lg: validateLayout(raw) })
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>
    if (Array.isArray(r.lg)) {
      return reconcileBoardLayout({
        lg: validateLayout(r.lg),
        md: Array.isArray(r.md) ? validateLayout(r.md) : undefined,
        sm: Array.isArray(r.sm) ? validateLayout(r.sm) : undefined,
      })
    }
  }
  return { lg: [] }
}

/** Ensure md/sm contain exactly lg's widget set (positions preserved where present,
 *  missing widgets appended at the bottom, stale ids dropped). lg is canonical. */
export function reconcileBoardLayout(bl: BoardLayout): BoardLayout {
  const fix = (variant: WidgetInstance[] | undefined): WidgetInstance[] | undefined => {
    if (!variant) return undefined
    const byId = new Map(variant.map(w => [w.i, w]))
    const out = bl.lg.map(c => {
      const v = byId.get(c.i)
      // position from the variant if present, else from lg; content from lg
      return v ? { ...c, x: v.x, y: v.y, w: v.w, h: v.h } : { ...c }
    })
    return out
  }
  return { lg: bl.lg, md: fix(bl.md), sm: fix(bl.sm) }
}

/** Append a copied widget (new id, deep config) to every present device array. */
export function appendWidgetToBoardLayout(bl: BoardLayout, source: WidgetInstance, newId: string): BoardLayout {
  return {
    lg: appendWidgetToLayout(bl.lg, source, newId),
    md: bl.md ? appendWidgetToLayout(bl.md, source, newId) : undefined,
    sm: bl.sm ? appendWidgetToLayout(bl.sm, source, newId) : undefined,
  }
}
```

- [ ] **Step 3: Run tests** (`npx vitest run tests/dashboard-board-layout.test.ts`, expect pass), `tsc` 0. Commit:
```
git add lib/dashboard/layout.ts tests/dashboard-board-layout.test.ts
git commit -m "feat(dashboard): BoardLayout type + validate/reconcile/append helpers"
```

## Task 5: Storage layer → BoardLayout (hydrate, CRUD, write-queue, templates)

**Files:** Modify `lib/supabase/dashboard-boards.ts`, `lib/dashboard-board-write.ts`, `lib/sync/handlers.ts`, `lib/dashboard/board-templates.ts`; update `tests/dashboard-board-templates.test.ts`, `tests/dashboard-board-write.test.ts`

- [ ] **Step 1:** `DashboardBoardRow.layout: BoardLayout`; `hydrate` → `validateBoardLayout(row.layout)`; import `BoardLayout, validateBoardLayout`.
- [ ] **Step 2:** `createBoard` param `layout?: BoardLayout`; default `{ lg: [] }`. `updateBoardLayout(id, layout: BoardLayout)` (keep the `.select('id')` 0-row guard).
- [ ] **Step 3:** `SaveBoardLayoutInput.layout: BoardLayout`; `DashboardBoardUpdatePayload.layout: BoardLayout`; handler unchanged otherwise.
- [ ] **Step 4:** `seedLayoutFromTemplate(...)` returns `BoardLayout` (`tpl.layout` is already a `BoardLayout`; default `{ lg: [] }`). Update its tests for the new shape.
- [ ] **Step 5:** `tsc` 0, `npx vitest run` (fix the template/write tests), `build` compiled. Commit:
```
git add lib/supabase/dashboard-boards.ts lib/dashboard-board-write.ts lib/sync/handlers.ts lib/dashboard/board-templates.ts tests/dashboard-board-templates.test.ts tests/dashboard-board-write.test.ts
git commit -m "feat(dashboard): board storage carries per-device BoardLayout"
```

## Task 6: Page state → BoardLayout + per-breakpoint editing

**Files:** Modify `app/(app)/dashboard/page.tsx`, `components/dashboard/widget-grid.tsx`

This is the largest task — implement carefully; build + reason; flag for live test.

- [ ] **Step 1:** Page holds `boardLayout: BoardLayout` (replace `widgets`). Derive `lgWidgets = boardLayout.lg` for the grid children + add/remove/config (which mutate `lg` then `reconcileBoardLayout`). `DEFAULT_LAYOUT` → `{ lg: [...] }`. Loading/switch: `setBoardLayout(board.layout)` (already a `BoardLayout`); empty check uses `boardLayout.lg.length`.
- [ ] **Step 2:** `WidgetGrid` takes `boardLayout: BoardLayout` + an `onLayoutsChange(next: BoardLayout)` (replaces `onLayoutChange`). It feeds RGL `layouts={{ lg: toRgl(bl.lg), ...(bl.md && {md: toRgl(bl.md)}), ...(bl.sm && {sm: toRgl(bl.sm)}) }}`, builds children from `bl.lg`, and on `onLayoutChange(cur, all)` (RGL) writes the **active breakpoint's** array back into a new `BoardLayout` (merge positions into that device's widgets, content from lg) — **remove the lg-only guard**. Persist staging (Task 1's `persist`) now stages the whole `BoardLayout`.
- [ ] **Step 3:** Update `appendWidgetToLayout` callers to `appendWidgetToBoardLayout`; `handleDuplicateBoard`/`handleCreateShared` copy the whole `boardLayout`; `copyWidgetToBoard` appends to the destination board's `BoardLayout`.
- [ ] **Step 4:** `tsc` 0, `npx vitest run` pass, `build` compiled. Commit:
```
git commit -m "feat(dashboard): per-breakpoint editing persists desktop/tablet/mobile layouts"
```

## Task 7: Truncation polish

**Files:** Modify content-heavy widget registry entries (`registry.tsx` minSize), confirm widget body scroll.

- [ ] **Step 1:** Raise `minSize.h` for map/table-heavy widgets (e.g. infrastructure/wildlife/embed) so they don't clip at small sizes; confirm `WidgetFrame` body `overflow:auto` lets content scroll. `tsc`+`build`. Commit.

---

## Task 8: Full verification + handoff
- [ ] `npx vitest run` (all pass), `npx tsc --noEmit` (0), `npm run build` (RC 0).
- [ ] Write a **live smoke-test checklist** (desktop: Done-saves/smooth-drag/4-corner-resize; tablet+phone: independent persistence survives reload; iPad-10" no truncation; legacy boards load) and **explicitly flag** that react-grid-layout drag/per-breakpoint behavior is unverified in this environment and needs the user's device testing.

---

## Self-review
- **Spec coverage:** per-device storage (T4–6) ✓; batch save-on-Done (T1) ✓; smooth drag/memo (T2) ✓; multi-corner resize (T3) ✓; truncation (T7) ✓; back-compat via validateBoardLayout (T4–5) ✓; all call sites (T5–6) ✓.
- **Type consistency:** `BoardLayout`, `validateBoardLayout`, `reconcileBoardLayout`, `appendWidgetToBoardLayout` defined in T4 and used in T5–6; `updateBoardLayout`/`saveBoardLayout`/`DashboardBoardUpdatePayload` all take `BoardLayout` after T5.
- **Risk:** react-grid-layout live behavior is build-verifiable only; T6/T8 flag the required live smoke test. Phase 1 is independently shippable (lag fix + resize) before Phase 2.
