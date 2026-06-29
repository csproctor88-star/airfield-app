# Per-Device Dashboard Layouts + Batch Editing + Multi-Corner Resize — Design Spec

**Date:** 2026-06-29
**Status:** Approved (user green-lit spec→plan→execute; stepped away for autonomous build)
**Module:** Dashboard (`/dashboard`, customizable widget grid)

## Problem / Goal

The dashboard is used on desktop, tablet, and phone, but it stores **one desktop
("lg") layout** and discards any rearrange done at a smaller breakpoint
(`widget-grid.tsx` `handleChange` returns early unless `breakpointRef === 'lg'`).
Consequences reported by the user:

1. **Sub-desktop rearrange snaps back / never persists** (tablet, phone).
2. **iPad-10" truncation** — widgets sized for desktop get squeezed at tablet width.
3. **Choppy/laggy editing on the government network** — the grid persists (and
   re-renders all widgets) on every drag tick.

Goals:
- **Per-device layouts:** desktop / tablet / mobile each independently arrangeable;
  **same widget set + same config** everywhere, only **position/size** differ.
- **Batch editing:** in edit mode, moves/resizes/edits accumulate with **no DB
  writes**; one save on **Done** (and a flush on navigate-away so nothing is lost).
- **Smooth dragging** on slow hardware (no per-tick content re-renders).
- **Resize from any corner**, not just bottom-right.
- **Truncation** mitigated via per-device sizing + min-heights + scroll.

## Out of scope (YAGNI)
- Different widget *sets* or *configs* per device (rejected — "same widgets, arrange
  per device").
- Hiding widgets per device (possible later; not now).
- A DB column migration (the `layout` column is plain JSONB with no shape
  constraint — back-compat is handled in code).
- Touch-drag tuning beyond what react-grid-layout provides.

## Decisions (locked)
- **Device classes / thresholds:** keep current — Desktop `lg ≥996px` (12 col),
  Tablet `md 600–996px` (8 col), Mobile `sm <600px` (1 col). Tunable later.
- **Navigate-away while editing:** **auto-save (flush)** the pending edits — never
  discard (discarding would reintroduce the reported data loss).

---

## Architecture

### Data model — `BoardLayout`
`lib/dashboard/layout.ts`:
```ts
export type DeviceClass = 'lg' | 'md' | 'sm'
export type BoardLayout = {
  lg: WidgetInstance[]            // canonical: which widgets exist + their config + desktop positions
  md?: WidgetInstance[]           // tablet position variant of the SAME widgets (optional)
  sm?: WidgetInstance[]           // mobile position variant (optional)
}
```
- **`lg` is the single source of truth** for the widget set and each widget's
  `config`. `md`/`sm` carry the same widgets' positions; **config is always read
  from `lg`** (react-grid-layout renders children from our canonical list keyed by
  `i`, so `md`/`sm` config can never diverge — only their `x/y/w/h` matter).
- `md`/`sm` **absent** → react-grid-layout auto-derives them from `lg` until the
  user customizes that breakpoint.

### Read normalization (back-compat) — `validateBoardLayout(raw): BoardLayout`
New in `layout.ts`, reuses the existing per-array `validateLayout`:
- `Array.isArray(raw)` → `{ lg: validateLayout(raw) }`  *(legacy single-layout boards)*
- object with `lg` → `{ lg: validateLayout(raw.lg), md: raw.md ? validateLayout(raw.md) : undefined, sm: … }`
- anything else → `{ lg: [] }`
- **Reconcile md/sm to lg's widget set** (drop md/sm entries whose `i` isn't in lg;
  append lg widgets missing from md/sm at the bottom) via a pure
  `reconcileBoardLayout(bl): BoardLayout`, so every device always renders the full set.

`hydrate()` in `lib/supabase/dashboard-boards.ts` switches to `validateBoardLayout`;
`DashboardBoardRow.layout` becomes `BoardLayout`.

### Per-device editing (grid)
`components/dashboard/widget-grid.tsx`:
- Feed react-grid-layout `layouts={{ lg, md, sm }}` (each device's WidgetInstance[]
  mapped to RGL `Layout[]`; omit `md`/`sm` when absent so RGL auto-derives).
- **Remove the `lg`-only guard.** `onLayoutChange(curLayout, allLayouts)` updates the
  **active breakpoint's** array (via `breakpointRef`), so tablet/phone rearranges
  persist to *their own* key — no more snap-back.
- Children are built from the **canonical `lg` list** (content/config); RGL positions
  them per the active breakpoint.

### Batch edit, save on "Done"
`app/(app)/dashboard/page.tsx`:
- Page state holds the full `BoardLayout` (replacing the single `widgets` array; a
  derived `lg` list drives the grid children + add/remove/config).
- **During edit mode, mutations update local state only — no persist.** Add, remove,
  config-change, drag, resize all just update the in-memory `BoardLayout`.
- **Persist once** when the user clicks **Done** (`onToggleEdit` exiting edit), and
  **flush** on (a) component unmount while editing, (b) board switch while editing.
- Replaces the prior 800 ms per-change debounce. Eliminates per-move writes.
- Note (accepted risk): a hard tab-close *mid-edit* before Done/flush can lose the
  in-progress edits (async save on `beforeunload` is unreliable). The flush covers
  in-app navigation, which is the common case.

### Smooth dragging (no per-tick content re-render)
- Split the grid children into a **memoized `DashboardWidget`** component that
  re-renders only on `type` / `config` / `editing` change — **not** on `x/y/w/h`
  (RGL handles repositioning via its wrapper, so widget *content* never re-renders
  during a drag).
- Parent passes **stable callbacks** (`useCallback`-wrapped `onRemove`,
  `onConfigure`, `onWidgetConfigChange`, `onCopyWidget`) plus the widget's
  `i`/`type`/`config`; the per-widget closures are built *inside* the memoized child.
- Result: dragging a widget repositions via RGL with zero expensive map/table
  re-renders.

### Resize from any corner
- `resizeHandles={['nw','ne','sw','se']}` on the Responsive grid (the
  `react-resizable` CSS already ships handle classes for all corners). Add edit-mode
  CSS so all four corner handles are **visible** within the existing red edit
  boundary.

### Truncation mitigation
- Per-device sizing is the primary fix (size a widget taller on tablet).
- Raise/define sensible `minSize.h` for content-heavy widgets (maps, tables) and
  ensure the widget body **scrolls** (`overflow:auto`, already present) rather than
  clipping; confirm map widgets fill+scroll instead of fixed-clip.

---

## Affected call sites (from the blast-radius map)

All of these assume a flat `WidgetInstance[]` and must become `BoardLayout`-aware.
**lg is canonical**, so most "copy/seed/append" operations act on the whole
`BoardLayout` (carry all device variants) or on `lg` then reconcile:

| File / function | Change |
|---|---|
| `lib/dashboard/layout.ts` | add `BoardLayout`, `validateBoardLayout`, `reconcileBoardLayout`, `appendWidgetToBoardLayout` (append to **every** present device array, keep new id/config in sync); keep `validateLayout`/`appendWidgetToLayout` for per-array use |
| `lib/supabase/dashboard-boards.ts` | `DashboardBoardRow.layout: BoardLayout`; `hydrate` → `validateBoardLayout`; `createBoard`/`updateBoardLayout` take `BoardLayout`; `updateBoardLayout` keeps the 0-row loud-failure guard |
| `lib/dashboard-board-write.ts` + `lib/sync/handlers.ts` | `saveBoardLayout` / `dashboard_board_update` payload carry `BoardLayout` |
| `lib/dashboard/board-templates.ts` | `seedLayoutFromTemplate` returns the template's full `BoardLayout` (defaults to `{ lg: [] }`) |
| `app/(app)/dashboard/page.tsx` | state = `BoardLayout`; `DEFAULT_LAYOUT` = `{ lg: [...] }`; load/switch read `board.layout`; `handleDuplicateBoard`/`handleCreateShared` copy the whole `BoardLayout`; `copyWidgetToBoard` appends to all device arrays of the destination; persist/flush model above |
| `components/dashboard/widget-grid.tsx` | per-device `layouts`, remove lg-guard, memoized child, resize handles |
| `tests/*` | update `dashboard-layout`, `dashboard-layout-append`, `dashboard-board-templates`, `dashboard-board-write` for the new shape; add tests for `validateBoardLayout`/`reconcileBoardLayout`/`appendWidgetToBoardLayout` |

---

## Build order (one plan, two phases to de-risk)

**Phase 1 — editing UX, no storage change (ships the lag fix + resize for desktop):**
1. Batch save-on-Done + flush-on-navigate/switch (still single `lg` layout).
2. Memoized `DashboardWidget` for smooth dragging.
3. Multi-corner resize handles + edit-mode handle CSS.

**Phase 2 — per-device layouts (the architecture change):**
4. `BoardLayout` type + `validateBoardLayout` + `reconcileBoardLayout` +
   `appendWidgetToBoardLayout` (+ tests).
5. `hydrate`/CRUD/write-queue/templates → `BoardLayout`; back-compat for legacy
   arrays.
6. Page state → `BoardLayout`; per-breakpoint editing (remove lg-guard); update
   duplicate/share/convert/copy-widget/seed to carry all device layouts.
7. Truncation polish (min-heights, scroll).

Each phase leaves the app building + passing tests on its own.

## Error handling
- `updateBoardLayout` keeps the 0-row "couldn't save" loud-failure (recently added).
- Save-on-Done surfaces failures via the existing toast (`persist` catch shows the
  real error message).
- `validateBoardLayout`/`reconcileBoardLayout` are tolerant (never throw; drop
  malformed entries), mirroring `validateLayout`.

## Testing
- **Unit (pure):** `validateBoardLayout` (legacy array → `{lg}`, object shape, junk →
  `{lg:[]}`, missing md/sm), `reconcileBoardLayout` (drop stale md/sm ids, add missing
  lg ids, idempotent), `appendWidgetToBoardLayout` (appends to lg+md+sm, new id, deep
  config copy). Update existing layout/append/template/write tests for the new shape.
- **Descriptor/registry:** unchanged.
- **Build gate:** `npx tsc --noEmit` + `npm run build` green; full `npx vitest run`.
- **Live smoke (REQUIRES the user — cannot be automated here):** desktop rearrange
  commits only on Done and stays put; dragging is smooth (no per-move write); resize
  from all four corners; tablet (md) and phone (sm) rearrange persist independently
  of desktop and survive reload; iPad-10" widgets size without truncation; existing
  boards (legacy single layout) still load and render. **Flag clearly in the handoff
  that the react-grid-layout drag/per-breakpoint behavior is not verifiable in this
  environment and needs the user's device testing on a preview.**

## Risks / notes
- **react-grid-layout live behavior** (controlled-sync on drag stop, per-breakpoint
  editing, multi-handle resize) cannot be verified without a browser here; the
  implementation follows RGL's documented controlled pattern (keep `onLayoutChange`
  for sync; persist separately) and must be smoke-tested on a preview.
- **Back-compat is read-side only** (no data migration): every existing board's flat
  array is normalized to `{ lg: array }` on load and re-saved in the new shape on the
  next edit. Old app builds reading a new-shape board would see `validateLayout` reject
  the object and render empty — so **don't run old and new builds against the same
  boards simultaneously** (expand/contract: ship the read-normalizer everywhere before
  writing the new shape; here it's one app, one deploy, so safe).
