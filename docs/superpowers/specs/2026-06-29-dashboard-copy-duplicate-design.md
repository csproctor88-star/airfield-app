# Dashboard: Duplicate Board, Shared-Edit Guard, Copy Widget — Design Spec

**Date:** 2026-06-29
**Status:** Proposed (awaiting review)
**Module:** Dashboard (`/dashboard`, customizable widget grid)

## Problem / Goal

The dashboard's shared boards are a single shared row (`owner_id IS NULL`), writable
only by users with `dashboard:publish-shared`. Today a regular user who selects a
shared board (e.g. the AMOPS Dashboard) can enter Edit mode and rearrange widgets,
but the save silently no-ops at RLS — no feedback, changes lost on reload. There is
also no way to fork a shared board into a personal one, or to lift a
nicely-configured widget from one board to another.

Three additions fix this:

1. **Duplicate to my dashboards** — one click turns the current board (typically a
   shared one) into an editable personal copy.
2. **Shared-edit guard + toast** — entering Edit on a shared board you can't publish
   is blocked with an explanatory toast that points to Duplicate (closes the silent
   no-op).
3. **Copy widget to another dashboard** — a per-widget "Copy to…" menu copies a
   widget (with its exact config) onto one of your own boards.

**No DB migration, no schema change.** All three reuse existing primitives.

## Out of scope (YAGNI)

- Copying a widget *into* a shared board (needs `dashboard:publish-shared`; v1
  destinations are the user's own boards only).
- A clipboard/paste model (rejected in favor of the direct "Copy to…" menu).
- Live-linking seeded copies back to a shared template (separate concern).
- Cross-base copying.

## Existing primitives reused

- `createBoard({ base_id, owner_id, name?, scope?, is_default?, layout? })` — already
  used by New Board and Share.
- `saveBoardLayout({ boardId, layout, baseId, userId })` (`lib/dashboard-board-write.ts`)
  → offline-queue → `updateBoardLayout(id, layout)` (RLS-gated). Used by `persist`.
- `validateLayout(widgets)`; `uuid()` (both already in `page.tsx`).
- `boards: DashboardBoardRow[]` state holds **every board's full `layout`** — so
  "copy to another board" reads the destination layout from state, no extra fetch.
- `refreshBoards(switchTo?)`: re-fetches `boards`; with **no arg** it keeps the
  current active board (used after a copy to avoid yanking the user away).
- `canPublishShared = has(PERM.DASHBOARD_PUBLISH_SHARED)`; `activeBoard.scope`.

---

## Feature 1 — Duplicate to my dashboards

**UI:** a **"Duplicate"** button (lucide `Copy`) in the board bar, placed next to
"New", **always visible** (any board, including shared/read-only). Not gated to Edit
mode — duplicating a shared board is exactly how a non-publisher gets an editable copy.

**Handler `handleDuplicateBoard` (page.tsx):**
```
if (!activeBoard || !installationId || !userId) return
const name = `${activeBoard.name} (copy)`
const { data, error } = await createBoard({
  base_id: installationId, owner_id: userId, name, scope: 'personal',
  layout: validateLayout(widgets),   // current view = what they see now
})
error ? toast.error(error) : (toast.success(`Duplicated to "${name}"`), await refreshBoards(data?.id))
```
- Copies the **current widgets** (live view), so any arrangement the user is looking
  at carries over. Auto-named `"<source> (copy)"`; the user can Rename afterward.
- `refreshBoards(data?.id)` **switches** to the new personal board (they want to work
  in it). Owned by the user → fully editable.

---

## Feature 2 — Shared-edit guard + toast

**Replace** the inline `onToggleEdit={() => setEditing(e => !e)}` with a guarded handler:
```
const onToggleEdit = useCallback(() => {
  if (!editing && activeBoard?.scope === 'shared' && !canPublishShared) {
    toast('Shared dashboards can only be edited by an admin. Use Duplicate to make your own editable copy.')
    return
  }
  setEditing(e => !e)
}, [editing, activeBoard, canPublishShared])
```
- Guard only blocks **entering** edit (`!editing`), so a "Done" toggle always works.
- Admins / AFM (with `dashboard:publish-shared`) edit shared boards exactly as today.
- Uses Sonner's default `toast(...)` (informational, not an error).
- This makes the prior silent-no-op impossible: a non-publisher never reaches a state
  where a shared-board save would be attempted and dropped.

---

## Feature 3 — Copy a widget to another dashboard

**UI:** each widget's header gets a small **copy icon** (lucide `Copy`), rendered
**always** (outside the `editing &&` block in `WidgetFrame`), so it works while merely
viewing a shared board. Clicking it opens a small popover menu (same
outside-click-close pattern as the existing color swatch popover) titled **"Copy to…"**
listing:
- the user's **personal boards** (by name), then
- **"＋ New dashboard…"**.

**Wiring:**
- `WidgetFrame` gains optional props: `copyTargets?: { id: string; name: string }[]`
  and `onCopyTo?: (target: string) => void` (target = a board id, or the sentinel
  `'__new__'`). Renders the copy control + menu only when `onCopyTo` is provided.
- `WidgetGrid` receives `copyBoards: {id,name}[]` (the user's personal boards) and
  `onCopyWidget: (widget: WidgetInstance, target: string) => void`, and wires each
  frame: `copyTargets={copyBoards}` and `onCopyTo={(t) => onCopyWidget(w, t)}`.
- `page.tsx` builds `copyBoards` from `boards.filter(b => b.owner_id === userId)` and
  passes `copyWidgetToBoard` down.

**Pure helper `appendWidgetToLayout(layout, source, newId)` (in `lib/dashboard/layout.ts`):**
returns `[...layout, placed]` where `placed = { ...source, i: newId, config: structuredClone(source.config ?? {}), x: 0, y: <below all existing widgets> }`. `newId` is injected (not generated inside) so the function is pure and unit-testable. For a brand-new board, call it with an empty `layout` → the widget lands at `y: 0`.

**Handler `copyWidgetToBoard(widget, target)` (page.tsx):**
```
if (target === '__new__') {
  const name = 'New dashboard'
  const layout = appendWidgetToLayout([], widget, uuid())
  const { data, error } = await createBoard({
    base_id: installationId, owner_id: userId, name, scope: 'personal', layout,
  })
  error ? toast.error(error) : (toast.success(`Copied to new dashboard "${name}"`), await refreshBoards())
  return
}
const dest = boards.find(b => b.id === target)
if (!dest) return
const nextLayout = appendWidgetToLayout(dest.layout, widget, uuid())
if (target === activeId) { setWidgets(nextLayout); persist(nextLayout) }   // live view + save
else { await saveBoardLayout({ boardId: target, layout: validateLayout(nextLayout), baseId: installationId, userId }) }
toast.success(`Copied to "${dest.name}"`)
await refreshBoards()   // reload boards' layouts; no-arg keeps current board
```
- **Config is deep-copied** (`structuredClone`, inside the helper) so the destination
  widget carries the exact columns/filters/color/size setup — the whole point.
- Copy is **non-disruptive**: it does **not** switch boards (except the implicit "you
  stay put"); a toast confirms. Copying to the board you're on duplicates in place
  and you see it appear immediately.
- `'__new__'` creates a personal board seeded with just the widget; `refreshBoards()`
  (no arg) reloads the list but keeps you on your current board.

---

## Components / files

| File | Change |
|---|---|
| `app/(app)/dashboard/page.tsx` | `handleDuplicateBoard`, guarded `onToggleEdit`, `copyWidgetToBoard`, `copyBoards` memo; pass new props to `BoardBar` and `WidgetGrid`. |
| `components/dashboard/board-bar.tsx` | New `onDuplicate` prop + "Duplicate" button (always visible). |
| `components/dashboard/widget-grid.tsx` | New `copyBoards` + `onCopyWidget` props; wire each `WidgetFrame`. |
| `components/dashboard/widget-frame.tsx` | New `copyTargets` + `onCopyTo` props; always-visible copy icon + "Copy to…" popover menu. |

No new lib modules; no migration.

## Error handling

- All three surface failures via `toast.error(error)` (createBoard / saveBoardLayout
  already return friendly errors). Copy/duplicate to a personal board passes RLS
  (`owner_id = auth.uid()`).
- Copy reads the destination layout from in-memory `boards`, which can be slightly
  stale if another session just edited that board; acceptable for v1 (best-effort
  append, last-write-wins, consistent with the existing single-writer model).

## Testing

- **Unit (pure):** `appendWidgetToLayout(layout, source, newId): WidgetInstance[]` in
  `lib/dashboard/layout.ts` (next to `validateLayout`). Tests: the placed widget's
  `i === newId` and differs from the source; `config` is a deep copy (mutating the
  source config does not affect the copy); `y` is below all existing widgets; the
  empty-layout case places it at `y: 0`; original `layout` array is not mutated.
- **Manual smoke (after deploy):** as a non-publisher on a shared board — Edit shows
  the toast and does not enter edit mode; Duplicate creates an editable personal copy;
  the widget copy icon shows on a shared board and copies a widget (with its config)
  to a chosen personal board and to "＋ New dashboard…". As an admin — shared board
  still edits normally.

## Risks / notes

- The copy menu lists potentially many personal boards; fine for the expected handful.
  No search in v1 (YAGNI).
- The always-visible copy icon adds one control to every widget header; keep it subtle
  (ghost icon, `--color-text-3`) so it doesn't compete with the title.
