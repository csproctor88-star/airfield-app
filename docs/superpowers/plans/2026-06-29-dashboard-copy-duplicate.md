# Dashboard Copy / Duplicate / Shared-Edit Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three dashboard capabilities — "Duplicate to my dashboards", a guard+toast that stops non-admins from silently editing shared boards, and a per-widget "Copy to…" menu that copies a widget (with its config) onto another of the user's boards.

**Architecture:** All UI reuses existing primitives (`createBoard`, `saveBoardLayout`→`updateBoardLayout`, `refreshBoards`, the `boards` state which already holds every board's full layout). One new pure, unit-tested helper `appendWidgetToLayout` does the widget-copy placement; everything else is handlers in `page.tsx` plus three new optional props threaded through `BoardBar`, `WidgetGrid`, and `WidgetFrame`. No DB migration, no schema change.

**Tech Stack:** Next.js 14 / React 18 / TypeScript, Supabase client, Sonner toasts, lucide-react, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-29-dashboard-copy-duplicate-design.md`

---

## Reference facts (verified against the codebase)

- `WidgetInstance` (`lib/dashboard/layout.ts`): `{ i: string; type: string; config: Record<string, unknown>; x; y; w; h }`. `validateLayout(raw)` lives in the same file.
- `createBoard({ base_id, owner_id, name?, scope?, is_default?, layout? })` → `{ data, error }` (`lib/supabase/dashboard-boards.ts`).
- `saveBoardLayout({ boardId, layout, baseId, userId })` (`lib/dashboard-board-write.ts`) → offline-queue → `updateBoardLayout(id, layout)` (RLS-gated). Returns `Promise<void>`; throws on a structured error.
- `page.tsx` state/helpers already present: `boards: DashboardBoardRow[]` (each row has full `layout`), `activeId`, `activeBoard`, `userId`, `installationId`, `widgets`, `setWidgets`, `persist(next)`, `refreshBoards(switchTo?)` (no arg → keeps current board), `uuid()`, `canPublishShared`, `toast` from `sonner`, `validateLayout`.
- `BoardBar` (`components/dashboard/board-bar.tsx`) renders a row of buttons; "New" button is always visible. lucide `Copy` is available from `lucide-react`.
- `WidgetGrid` (`components/dashboard/widget-grid.tsx`) maps `widgets` → `WidgetFrame`, passing `onRemove`, `onConfigure`, `onSetColor`, etc.
- `WidgetFrame` (`components/dashboard/widget-frame.tsx`) header shows controls; the **color swatch popover** is the pattern to mirror for the copy menu (a `useState` open flag + an outside-`mousedown` close effect). Edit controls render only inside `editing && (...)`; the copy control must render **outside** that block.
- Empty board renders a placeholder, not the grid — so the copy icon only appears when widgets exist (fine).

---

## File structure

**Create**
- `tests/dashboard-layout-append.test.ts` — unit tests for the new helper.

**Modify**
- `lib/dashboard/layout.ts` — add pure `appendWidgetToLayout(layout, source, newId)`.
- `components/dashboard/board-bar.tsx` — new `onDuplicate` prop + "Duplicate" button.
- `components/dashboard/widget-frame.tsx` — new `copyTargets` + `onCopyTo` props; always-visible copy icon + "Copy to…" popover.
- `components/dashboard/widget-grid.tsx` — new `copyBoards` + `onCopyWidget` props; wire each frame.
- `app/(app)/dashboard/page.tsx` — `handleDuplicateBoard`, guarded `onToggleEdit`, `copyWidgetToBoard`, `copyBoards` memo; pass new props to `BoardBar` and `WidgetGrid`.

---

## Task 1: Pure `appendWidgetToLayout` helper

**Files:**
- Modify: `lib/dashboard/layout.ts`
- Test: `tests/dashboard-layout-append.test.ts`

- [ ] **Step 1: Write the failing test** — create `tests/dashboard-layout-append.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { appendWidgetToLayout, type WidgetInstance } from '@/lib/dashboard/layout'

const src: WidgetInstance = { i: 'src', type: 'amtr', config: { columns: ['a'], color: 'blue' }, x: 2, y: 1, w: 4, h: 3 }

describe('appendWidgetToLayout', () => {
  it('appends a copy with the given id, placed below all existing widgets', () => {
    const layout: WidgetInstance[] = [
      { i: 'w1', type: 'notes', config: {}, x: 0, y: 0, w: 2, h: 2 }, // bottom = 2
      { i: 'w2', type: 'clock', config: {}, x: 2, y: 1, w: 2, h: 3 }, // bottom = 4
    ]
    const next = appendWidgetToLayout(layout, src, 'new-id')
    expect(next).toHaveLength(3)
    const placed = next[2]
    expect(placed.i).toBe('new-id')
    expect(placed.type).toBe('amtr')
    expect(placed.x).toBe(0)
    expect(placed.y).toBe(4)        // below the lowest widget
    expect(placed.w).toBe(4)
    expect(placed.h).toBe(3)
  })

  it('places at y:0 for an empty layout', () => {
    const next = appendWidgetToLayout([], src, 'new-id')
    expect(next).toHaveLength(1)
    expect(next[0].y).toBe(0)
    expect(next[0].i).toBe('new-id')
  })

  it('deep-copies config (mutating the source does not affect the copy)', () => {
    const source: WidgetInstance = { i: 'src', type: 'amtr', config: { cols: ['a', 'b'] }, x: 0, y: 0, w: 2, h: 2 }
    const next = appendWidgetToLayout([], source, 'n')
    ;(source.config.cols as string[]).push('c')
    expect((next[0].config.cols as string[])).toEqual(['a', 'b'])
  })

  it('does not mutate the input layout array', () => {
    const layout: WidgetInstance[] = [{ i: 'w1', type: 'notes', config: {}, x: 0, y: 0, w: 2, h: 2 }]
    appendWidgetToLayout(layout, src, 'n')
    expect(layout).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dashboard-layout-append.test.ts`
Expected: FAIL — `appendWidgetToLayout` is not exported.

- [ ] **Step 3: Implement** — append to `lib/dashboard/layout.ts` (after `validateLayout`):

```ts
/**
 * Return a new layout with `source` copied onto the end: a fresh `newId`, a
 * deep-copied `config`, placed at x:0 below all existing widgets. Pure — the
 * input `layout` is not mutated and `newId` is injected so callers stay
 * deterministic/testable.
 */
export function appendWidgetToLayout(
  layout: WidgetInstance[],
  source: WidgetInstance,
  newId: string,
): WidgetInstance[] {
  const bottomY = layout.reduce((m, w) => Math.max(m, w.y + w.h), 0)
  const placed: WidgetInstance = {
    ...source,
    i: newId,
    config: structuredClone(source.config ?? {}),
    x: 0,
    y: bottomY,
  }
  return [...layout, placed]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dashboard-layout-append.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add lib/dashboard/layout.ts tests/dashboard-layout-append.test.ts
git commit -m "feat(dashboard): appendWidgetToLayout helper for widget copy

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: "Duplicate" board button (BoardBar + handler)

**Files:**
- Modify: `components/dashboard/board-bar.tsx`
- Modify: `app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Add the `onDuplicate` prop + button to `BoardBar`**

In `components/dashboard/board-bar.tsx`, add `Copy` to the lucide import:
```ts
import { Pencil, Plus, Check, Share2, Trash2, PenLine, Star, Copy } from 'lucide-react'
```
Add to `BoardBarProps` (after `onNewBoard`):
```ts
  onDuplicate: () => void
```
Add to the destructured params (after `onNewBoard`):
```ts
  onNewBoard, onDuplicate,
```
Add the button immediately AFTER the existing "New board" `<button>…</button>` block:
```tsx
      {/* Duplicate active board → personal copy (always available) */}
      <button style={btn} onClick={onDuplicate} title="Duplicate this dashboard to your own">
        <Copy size={14} strokeWidth={2.5} /> Duplicate
      </button>
```

- [ ] **Step 2: Add `handleDuplicateBoard` in `page.tsx`**

In `app/(app)/dashboard/page.tsx`, add this handler next to the other board handlers (e.g. right after `handleNewBoard`):
```tsx
  // Duplicate the active board into a personal copy the user can edit.
  const handleDuplicateBoard = async () => {
    if (!activeBoard || !installationId || !userId) return
    const name = `${activeBoard.name} (copy)`
    const { data, error } = await createBoard({
      base_id: installationId, owner_id: userId, name, scope: 'personal',
      layout: validateLayout(widgets),
    })
    if (error) { toast.error(error); return }
    toast.success(`Duplicated to "${name}"`)
    await refreshBoards(data?.id)
  }
```
(`createBoard` is already imported in `page.tsx` line 11 — no import change needed for this task.)

- [ ] **Step 3: Pass `onDuplicate` to `<BoardBar>`**

In the `<BoardBar … />` JSX, add after the `onNewBoard={…}` line:
```tsx
        onDuplicate={handleDuplicateBoard}
```

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit` (exit 0), then `npm run build` (exit 0 / "Compiled successfully").

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/board-bar.tsx "app/(app)/dashboard/page.tsx"
git commit -m "feat(dashboard): Duplicate board to a personal copy

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Shared-board edit guard + toast

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Add a guarded `onToggleEdit` handler**

In `app/(app)/dashboard/page.tsx`, add this handler near the other `useCallback` handlers (after `onSwitch` is a good spot):
```tsx
  // Block entering Edit on a shared board the user can't publish; point them to Duplicate.
  const onToggleEdit = useCallback(() => {
    if (!editing && activeBoard?.scope === 'shared' && !canPublishShared) {
      toast('Shared dashboards can only be edited by an admin. Use Duplicate to make your own editable copy.')
      return
    }
    setEditing(e => !e)
  }, [editing, activeBoard, canPublishShared])
```

- [ ] **Step 2: Use it in `<BoardBar>`**

Replace the inline prop:
```tsx
        onToggleEdit={() => setEditing(e => !e)}
```
with:
```tsx
        onToggleEdit={onToggleEdit}
```

- [ ] **Step 3: Type-check + build**

Run: `npx tsc --noEmit` (exit 0), then `npm run build` (exit 0 / "Compiled successfully").

Manual reasoning to confirm: a user without `dashboard:publish-shared` viewing a shared board clicks Edit → toast fires, `editing` stays false. An admin (has the perm) or any user on a personal board toggles normally. "Done" (when `editing` is true) is never blocked because the guard requires `!editing`.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/dashboard/page.tsx"
git commit -m "feat(dashboard): guard shared-board editing with an explanatory toast

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: "Copy to…" menu on the widget frame

**Files:**
- Modify: `components/dashboard/widget-frame.tsx`

This task only adds the UI control + props to `WidgetFrame`. Wiring to real boards/handlers happens in Task 5; for now the control renders whenever `onCopyTo` is provided.

- [ ] **Step 1: Extend `WidgetFrame` props and add the copy control**

In `components/dashboard/widget-frame.tsx`:

(a) Add `Copy` to the lucide import:
```ts
import { Settings2, X, Circle, Copy } from 'lucide-react'
```

(b) Add two optional props to the component signature (alongside the existing props):
```tsx
  copyTargets,
  onCopyTo,
```
and to the prop types:
```tsx
  copyTargets?: { id: string; name: string }[]
  onCopyTo?: (target: string) => void
```

(c) Add an open-state flag + outside-click close, mirroring the existing `swatchOpen` pattern. Near the `swatchOpen` state:
```tsx
  const [copyOpen, setCopyOpen] = useState(false)
  const copyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!copyOpen) return
    function handleMouseDown(e: MouseEvent) {
      if (copyRef.current && !copyRef.current.contains(e.target as Node)) setCopyOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [copyOpen])
```

(d) Render the copy control in the header, **outside** the `editing && (...)` controls block so it is always visible. Replace the header's right side: currently the header is
```tsx
        <span style={{ … }}>{title}</span>
        {editing && (onSetColor || onConfigure || onRemove) && (
          <div style={{ display: 'flex', gap: 2 }}>
            … existing color/configure/remove buttons …
          </div>
        )}
```
Wrap both the copy control and the existing edit controls in a single flex container so they sit together:
```tsx
        <span style={{
          fontSize: 'var(--fs-2xs)', fontWeight: 700, letterSpacing: '0.06em',
          textTransform: 'uppercase', color: 'var(--color-text-3)',
        }}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {onCopyTo && copyTargets && (
            <div ref={copyRef} style={{ position: 'relative' }}>
              <button
                onClick={(e) => { e.stopPropagation(); setCopyOpen(o => !o) }}
                aria-label={`Copy ${title} to another dashboard`}
                title="Copy to another dashboard"
                style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-3)', padding: 2 }}
              >
                <Copy size={13} strokeWidth={2.5} />
              </button>
              {copyOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 9999,
                    background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)', padding: 4, minWidth: 180,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                    display: 'flex', flexDirection: 'column', gap: 2,
                  }}
                >
                  <div style={{ fontSize: 'var(--fs-2xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-3)', padding: '4px 8px' }}>Copy to…</div>
                  {copyTargets.map(t => (
                    <button
                      key={t.id}
                      onClick={(e) => { e.stopPropagation(); onCopyTo(t.id); setCopyOpen(false) }}
                      style={{ textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-1)', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', padding: '6px 8px', borderRadius: 'var(--radius-sm)' }}
                    >{t.name}</button>
                  ))}
                  <button
                    onClick={(e) => { e.stopPropagation(); onCopyTo('__new__'); setCopyOpen(false) }}
                    style={{ textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-accent)', fontFamily: 'inherit', fontSize: 'var(--fs-sm)', fontWeight: 600, padding: '6px 8px', borderRadius: 'var(--radius-sm)', borderTop: '1px solid var(--color-border)', marginTop: 2 }}
                  >＋ New dashboard…</button>
                </div>
              )}
            </div>
          )}
          {editing && (onSetColor || onConfigure || onRemove) && (
            <>
              … keep the existing color swatch + configure + remove buttons exactly as they are …
            </>
          )}
        </div>
```
Note: the existing color/configure/remove buttons keep their current code — just move them inside this shared flex container (as a fragment) instead of their own `<div style={{ display:'flex', gap:2 }}>`.

- [ ] **Step 2: Type-check + build**

Run: `npx tsc --noEmit` (exit 0), then `npm run build` (exit 0 / "Compiled successfully"). (No callers pass `onCopyTo` yet, so the control stays hidden — that's expected until Task 5.)

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/widget-frame.tsx
git commit -m "feat(dashboard): widget-frame Copy-to menu (always-visible)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Wire copy-widget through the grid + page

**Files:**
- Modify: `components/dashboard/widget-grid.tsx`
- Modify: `app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Thread copy props through `WidgetGrid`**

In `components/dashboard/widget-grid.tsx`, add two props to the component's prop type:
```tsx
  copyBoards: { id: string; name: string }[]
  onCopyWidget: (widget: WidgetInstance, target: string) => void
```
Add them to the destructured params:
```tsx
  widgets, editing, onLayoutChange, onRemove, onConfigure, onWidgetConfigChange, copyBoards, onCopyWidget,
```
In the `widgets.map(w => …)` render, pass to `<WidgetFrame …>`:
```tsx
              copyTargets={copyBoards}
              onCopyTo={(target) => onCopyWidget(w, target)}
```

- [ ] **Step 2: Build `copyBoards` + `copyWidgetToBoard` in `page.tsx`**

Add the destinations memo (the user's own boards), near `boardSummaries`:
```tsx
  // Personal boards the user can copy a widget into.
  const copyBoards = useMemo(
    () => boards.filter(b => b.owner_id === userId).map(b => ({ id: b.id, name: b.name })),
    [boards, userId],
  )
```
Add the copy handler (near the other handlers). Import `appendWidgetToLayout` from `@/lib/dashboard/layout` (extend the existing import on line 17):
```tsx
import { validateLayout, appendWidgetToLayout, type WidgetInstance } from '@/lib/dashboard/layout'
```
```tsx
  // Copy a single widget (with its config) onto one of the user's boards.
  const copyWidgetToBoard = async (widget: WidgetInstance, target: string) => {
    if (!installationId || !userId) return
    if (target === '__new__') {
      const name = 'New dashboard'
      const layout = appendWidgetToLayout([], widget, uuid())
      const { data, error } = await createBoard({
        base_id: installationId, owner_id: userId, name, scope: 'personal', layout,
      })
      if (error) { toast.error(error); return }
      toast.success(`Copied to new dashboard "${name}"`)
      void data
      await refreshBoards()
      return
    }
    const dest = boards.find(b => b.id === target)
    if (!dest) return
    const nextLayout = appendWidgetToLayout(dest.layout, widget, uuid())
    if (target === activeId) {
      setWidgets(nextLayout); persist(nextLayout)
    } else {
      try {
        await saveBoardLayout({ boardId: target, layout: validateLayout(nextLayout), baseId: installationId, userId })
      } catch { toast.error('Could not copy the widget'); return }
    }
    toast.success(`Copied to "${dest.name}"`)
    await refreshBoards()
  }
```

- [ ] **Step 3: Pass the new props to `<WidgetGrid>`**

In the `<WidgetGrid … />` JSX add:
```tsx
          copyBoards={copyBoards}
          onCopyWidget={copyWidgetToBoard}
```

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit` (exit 0), then `npm run build` (exit 0 / "Compiled successfully").

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/widget-grid.tsx "app/(app)/dashboard/page.tsx"
git commit -m "feat(dashboard): copy a widget to another of your boards

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Full verification

- [ ] **Step 1: Run the whole test suite**

Run: `npx vitest run`
Expected: all pass (previous total + 4 new `appendWidgetToLayout` tests).

- [ ] **Step 2: Type-check + production build**

Run: `npx tsc --noEmit` (exit 0), then `npm run build` (RC 0, "Compiled successfully", ~113 pages).

- [ ] **Step 3: Manual smoke (after deploy/preview)**

As a **non-publisher** on a shared board: clicking **Edit** shows the toast and does not enter edit mode; **Duplicate** creates `"<name> (copy)"` and switches to it (now editable); the widget **copy icon** is visible (no Edit needed) and copying a widget to a listed personal board, and to **＋ New dashboard…**, both toast and land the widget with its config (columns/filters/color/size) intact. As an **admin** (`dashboard:publish-shared`): the shared board still enters Edit normally.

---

## Self-review

- **Spec coverage:** Duplicate board (Task 2) ✓; shared-edit guard+toast (Task 3) ✓; copy-widget UI (Task 4) + wiring (Task 5) ✓; `appendWidgetToLayout` pure helper + tests (Task 1) ✓; destinations = user's own boards (`copyBoards` filter, Task 5) ✓; "＋ New dashboard…" path (Task 5) ✓; deep-copied config (Task 1 helper) ✓; non-disruptive copy / no board switch + `refreshBoards()` no-arg (Task 5) ✓; no migration ✓.
- **Placeholders:** none — every step has concrete code/commands. The one "keep the existing buttons as they are" note in Task 4 refers to code already in the file and is explicit about wrapping, not rewriting.
- **Type consistency:** `appendWidgetToLayout(layout, source, newId)` (Task 1) is called with exactly that signature in Task 5; `WidgetInstance` is the shared type from `lib/dashboard/layout.ts`; `copyTargets: {id,name}[]` / `onCopyTo: (target:string)=>void` (Task 4) match `copyBoards` / `onCopyWidget` wiring (Task 5); the `'__new__'` sentinel is produced in Task 4's menu and consumed in Task 5's handler.
- **Note:** `structuredClone` is available in the app's runtime (modern browsers / Next 14) and is already the assumed clone primitive in the spec.
