# Dashboard Polish Round 2 — Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Address the user's round-2 dashboard feedback: NOTAM block text, visible column-resize lines, robust scroll-to-top, richer AMTR Training Progress columns, a finer grid (both axes) with saved-layout migration, and a per-user default-board model (any board incl. shared) that also lets users delete their default.

**Source of decisions:** user answered three design questions — Progress = `Member · FQ · JQS% · 1098% · 797% · Formal%`; Default = per-user default pointing to any board (incl. shared), deleting your default allowed; Grid = finer in both axes (½ row height, 2× cols) with automatic layout migration. User confirmed the current build already renders AMTR widgets correctly (the earlier "308 rows/blank" was a stale build). The Compliance "duplication" is real duplicate **catalog data** at Selfridge (base `…0001`), not a widget bug — left as a data-cleanup FYI, no code change.

**No-change items:** AMTR Compliance widget (data issue, not code).

**Verified facts**
- Grid: `components/dashboard/widget-grid.tsx` — `COLS={lg:12,md:8,sm:1}` (L14), `BREAKPOINTS={lg:996,md:600,sm:0}` (L15), `rowHeight={80}` (L105), `margin={[12,12]}` (L106). `toRgl` maps minW/minH from `def.minSize` (L67-70).
- Registry `lib/dashboard/registry.tsx`: every widget has `defaultSize`/`minSize` literals. defaultSize.h ∈ {1,2,3,4}; minSize.h ∈ {1,2,3}; defaultSize.w ∈ {2..5}; minSize.w = 2 everywhere. `DEFAULT_LAYOUT` literal in `app/(app)/dashboard/page.tsx` (~L27-32) hardcodes x/y/w/h.
- Layout types: `lib/dashboard/layout.ts` — `WidgetInstance {i,type,config,x,y,w,h}`, `BoardLayout {lg:WidgetInstance[]; md?; sm?}`, `validateBoardLayout`, `reconcileBoardLayout`. Stored in `dashboard_boards.layout` JSONB.
- NOTAM widget: descriptor `lib/dashboard/table/descriptors/notams.tsx` — text column `{ key:'text', accessor: r => r.full_text || r.title, mono:true }`, no wrap. Cell render in `components/dashboard/table/table-widget.tsx` L282-304: default (auto layout) `whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:180`; only wraps when `useFixedLayout`.
- Column resize handle: `table-widget.tsx` L259-275 — a `<span className="wt-col-resize">` `position:absolute; right:0; width:5; background:transparent`. Invisible.
- Scroll: global `components/scroll-to-top.tsx` scrolls `window` on pathname change only (misses `.app-content`). Dashboard `app/(app)/dashboard/page.tsx` L145-157 fires `toTop()` immediate + rAF + 150ms (loses race vs async grid reflow). Scroll container is `<main className="app-content">` in `app/(app)/layout.tsx` L47.
- Board scope/grouping: `components/dashboard/board-bar.tsx` L54-55 splits by `b.scope`. Delete gate `canDeleteActive` (page L289-292): blocked when `owner_id===userId && is_default`. `canSetDefault` (page L296-303): requires `scope==='personal' && owner_id===userId && !is_default`. `setDefaultBoard` (`lib/supabase/dashboard-boards.ts` L123-145) clears `is_default` by `owner_id=userId` then sets on target — **per-board boolean, not per-user**. Default read sites: `getOrCreateDefaultBoard` (L147-162, `owner_id===userId && is_default`), page L199 & L406.
- AMTR Progress: `lib/dashboard/table/descriptors/amtr-progress.tsx`. Pure builder `buildProgressRows` + `ProgressRow` in `lib/amtr/report-rows.ts`. `buildMemberRollup`/`pct` in `lib/amtr/rollup.ts`. `dueStatus`/`ratApplies` in `lib/amtr/status.ts`.
- `amtr_797` columns: id, base_id, member_id, task, start_date, **complete_date**, requires_certifier, … (per-member rows; complete = `complete_date` set; no base catalog).
- `amtr_members`: no qualified/FQ column. FQ must be derived.
- DB: `npx supabase db query --linked --file <one-statement.sql>`. RLS helpers `user_has_base_access`, `user_has_permission`. Migration tracker empty — apply each migration file via db query.

---

## PHASE 1 — Safe UI fixes (NOTAM wrap · visible resize lines · scroll-to-top)

### Task 1.1: Per-column wrap flag + NOTAM block text
**Files:** `lib/dashboard/table/types.ts`, `components/dashboard/table/table-widget.tsx`, `lib/dashboard/table/descriptors/notams.tsx`

- [ ] In `types.ts` `ColumnDef`, add optional `wrap?: boolean`.
- [ ] In `table-widget.tsx` cell render (L282-304), compute `const wrap = c.wrap === true`. For the `<td>` style, when `wrap` is true (regardless of `useFixedLayout`): `whiteSpace:'normal'`, `overflow:'visible'`, `textOverflow:undefined`, `wordBreak:'break-word'`, `maxWidth: useFixedLayout ? undefined : 320`, and add `lineHeight:1.35`. Leave non-wrap columns exactly as today. Keep `verticalAlign:'top'` on wrapped cells so multi-line rows align cleanly (apply `verticalAlign:'top'` to the `<td>` when `wrap`).
- [ ] In `notams.tsx`, set `wrap: true` on the `text` column. Keep `mono:true`.
- [ ] **Verify:** `npx tsc --noEmit` (0), `npm run build` (compiled). Commit `feat(dashboard): wrap long table cells (NOTAM text) as readable blocks`.
- (Visual — flag for the user's smoke test.)

### Task 1.2: Visible column-resize lines
**Files:** `components/dashboard/table/table-widget.tsx`

- [ ] Give every header cell a visible right-edge divider so users see column boundaries: on the `<th>` style add `borderRight: '1px solid var(--color-border)'` (keep the sticky/zindex/etc.). Remove the border on the last visible column to avoid a trailing line: compute `isLast = idx === visibleCols.length - 1` in the `visibleCols.map((c, idx) => …)` and set `borderRight: isLast ? undefined : '1px solid var(--color-border)'`.
- [ ] Make the resize handle itself discoverable: change the handle `<span>` style `background:'transparent'` → a subtle always-faint grip that strengthens on hover. Use inline style `background:'var(--color-border)'`, `opacity:0.0` default but add a CSS rule. Since the file uses inline styles, instead widen affordance: set handle `width:7` and add `className="wt-col-resize"` (already present) and add a global CSS rule in `app/globals.css`: `.wt-col-resize:hover{background:var(--color-accent)!important;opacity:0.6}` and a always-visible 1px center line via `.wt-col-resize::after{content:'';position:absolute;right:0;top:20%;bottom:20%;width:1px;background:var(--color-border)}`. (Confirm `app/globals.css` exists; if the project uses a different global stylesheet, add there.)
- [ ] **Verify:** tsc (0), build (compiled). Commit `feat(dashboard): visible column dividers + discoverable resize handles`.
- (Visual — flag for smoke test.)

### Task 1.3: Settle-based scroll-to-top
**Files:** `app/(app)/dashboard/page.tsx`, `components/scroll-to-top.tsx`

- [ ] In `scroll-to-top.tsx`, also scroll the app content container, not just window: inside the effect add `document.querySelector('.app-content')?.scrollTo(0,0)` alongside `window.scrollTo(0,0)`.
- [ ] In `dashboard/page.tsx`, replace the fixed 150ms `toTop` effect with a settle-based one keyed to load completion. Add a dependency on the loading flag + active board id so it re-runs when the board finishes loading. Concretely: a `useEffect` with deps `[loading, activeId]` (use the page's existing loading state var name and active board id var name — read them) that, **only when not loading**, runs `toTop()` immediately, on `requestAnimationFrame`, and again after a `ResizeObserver` on the grid container fires once (or fallbacks: two rAFs + a 250ms timeout). Keep `toTop` targeting both `.app-content` and `window`. Ensure observers/timeouts are cleaned up in the return.
- [ ] **Verify:** tsc (0), build (compiled). Commit `fix(dashboard): scroll to top after the board finishes loading (settle-based)`.
- (Behavioral — flag for smoke test on the gov-network slow load.)

---

## PHASE 2 — AMTR Training Progress redesign

### Task 2.1: Extend ProgressRow + pure builder (+ tests)
**Files:** `lib/amtr/report-rows.ts`, `tests/amtr-report-rows.test.ts`

- [ ] Extend `ProgressRow` to: `{ id; memberId; memberName; grade: string|null; fq: boolean; jqsPct: number; p1098Pct: number|null; p797Pct: number|null; formalPct: number; overdue: number }`. (`p1098Pct`/`p797Pct` are `null` when the member has zero applicable items → rendered `—`.)
- [ ] Change `buildProgressRows` to accept an input array of objects carrying the already-computed numbers and map them 1:1 (keep it a pure shape-mapper — no fetching). Signature:
```ts
export type ProgressInput = {
  memberId: string; memberName: string; grade: string | null
  jqsPct: number; formalPct: number; overdue: number
  p1098Pct: number | null; p797Pct: number | null
}
export function buildProgressRows(items: ProgressInput[]): ProgressRow[] {
  return items.map(i => ({
    id: i.memberId, memberId: i.memberId, memberName: i.memberName, grade: i.grade,
    fq: i.jqsPct >= 100 && i.formalPct >= 100,
    jqsPct: i.jqsPct, p1098Pct: i.p1098Pct, p797Pct: i.p797Pct,
    formalPct: i.formalPct, overdue: i.overdue,
  }))
}
```
- [ ] Update the existing `buildProgressRows` tests in `tests/amtr-report-rows.test.ts` to the new input/output shape: assert `fq` true when jqs & formal both ≥100 and false otherwise; assert `p1098Pct`/`p797Pct` pass through including `null`; assert order preserved. Keep `buildTaskComplianceRows` tests unchanged.
- [ ] **Run tests → pass.** `npx tsc --noEmit` (0) — NOTE: this changes the `buildProgressRows` signature consumed by `amtr-progress.tsx`; Task 2.2 updates that caller in the same phase, so tsc may fail until 2.2 lands. Run tsc after 2.2. Commit `feat(amtr): richer ProgressRow (FQ + per-category %s)`.

### Task 2.2: Compute 1098%/797% + new columns in the descriptor
**Files:** `lib/dashboard/table/descriptors/amtr-progress.tsx`

- [ ] Add `amtr_797` to the fetch: `fetchAmtrByBase<Row>('amtr_797', installationId, 'member_id')`.
- [ ] Per member compute, in addition to existing jqs/formal/overdue:
  - `1098`: `items = byMember(r1098Prog, m.id)`; `total1098 = items.length`; `done1098 = items.filter(r => dueStatus({dueDate:r.next_due, completedDate:r.last_completed}) !== 'overdue').length`; `p1098Pct = total1098 ? Math.round(done1098/total1098*100) : null`. (Include RAT items too when `ratApplies(m.status)` — same "not overdue = current" rule — appended into the same total/done so the % reflects all recurring training.)
  - `797`: `rows797 = byMember(items797, m.id)`; `total797 = rows797.length`; `done797 = rows797.filter(r => r.complete_date).length`; `p797Pct = total797 ? Math.round(done797/total797*100) : null`.
  - keep `jqsPct`/`formalPct` via the existing rollup (or compute inline with `pct`).
- [ ] Build rows via `buildProgressRows(items)` with the new `ProgressInput` shape.
- [ ] Columns: `Member` (memberName), `FQ` (accessor `r => r`, format → green ✓ badge when `r.fq` else muted ✗; tooltip text "Fully qualified = JQS 100% and Formal 100%"), `JQS %` (jqsPct, mono right), `1098 %` (`r => r.p1098Pct ?? '—'`, mono right), `797 %` (`r => r.p797Pct ?? '—'`, mono right), `Formal %` (formalPct, mono right). Drop the Grade and Overdue columns (per the chosen preview). Keep `row: deeplink /amtr/<memberId>`, `summary: rows => [{count: rows.length, label:'members'}]`, `footerHref:'/amtr/reports'`.
- [ ] **Verify:** `npx tsc --noEmit` (0), `npx vitest run` (pass), `npm run build` (compiled). Commit `feat(amtr): Training Progress shows FQ + JQS/1098/797/Formal %`.
- (Visual — flag for smoke test; confirm the FQ definition with the user.)

---

## PHASE 3 — Finer grid (both axes) + saved-layout migration

**Scale factor = 2 on both axes.** New grid: `rowHeight: 40`, `margin: [6,6]` (half of 12 so multi-cell spans keep the same pixel height: old `h*80 + (h-1)*12`; new `2h*40 + (2h-1)*6` ≈ same), `COLS={lg:24,md:16,sm:1}`, `BREAKPOINTS` unchanged. Every registry `defaultSize`/`minSize` and the `DEFAULT_LAYOUT` literal scale ×2 on w and h. Existing stored layouts scale ×2 on x,y,w,h (sm keeps x=0,w=1; scale y,h only). A guard marker prevents double-migration.

### Task 3.1: Scale the grid config + registry defaults + DEFAULT_LAYOUT
**Files:** `components/dashboard/widget-grid.tsx`, `lib/dashboard/registry.tsx`, `app/(app)/dashboard/page.tsx`

- [ ] `widget-grid.tsx`: `rowHeight={40}`, `margin={[6,6]}`, `COLS={lg:24,md:16,sm:1}`.
- [ ] `registry.tsx`: double every `defaultSize.w`, `defaultSize.h`, `minSize.w`, `minSize.h` literal (e.g. `{w:4,h:3}`→`{w:8,h:6}`, `{w:2,h:1}`→`{w:4,h:2}`). Do this for ALL widget entries. (Mechanical; read each entry and double the four numbers.)
- [ ] `dashboard/page.tsx` `DEFAULT_LAYOUT`: double x,y,w,h on each seeded widget so the default board matches the new scale.
- [ ] **Verify:** tsc (0). (Build deferred to 3.3.) Commit `feat(dashboard): finer grid — 24 cols + 40px rows; registry sizes ×2`.

### Task 3.2: Migrate stored board layouts (DB) with a guard
**Files:** `supabase/migrations/<YYYYMMDD>_dashboard_grid_scale_v2.sql` (new), applied via db query.

- [ ] Write a PL/pgSQL `DO`/function migration that, for every `dashboard_boards` row whose `layout` lacks `"gridScale": 2`, rewrites `layout` by, for each of the `lg`/`md`/`sm` arrays, multiplying each element's `x,y,w,h` by 2 — EXCEPT for the `sm` array, where only `y` and `h` are doubled and `x`→0, `w`→1 (single-column mobile). Then set top-level `layout = jsonb_set(layout,'{gridScale}','2')`. Idempotent via the `gridScale` guard. Pseudocode shape:
```sql
-- For each board, for each device key present, map elements ×2 (sm: y,h only).
-- Use jsonb_agg over jsonb_array_elements with jsonb_set on x/y/w/h.
-- Skip rows already tagged layout->>'gridScale' = '2'.
```
  Provide the full working SQL (helper to scale one array, applied per device key, wrapped in a single UPDATE … WHERE coalesce(layout->>'gridScale','1') <> '2'). Test the transform on one board id first (SELECT the before/after) before the bulk UPDATE.
- [ ] In `lib/dashboard/layout.ts`, make `validateBoardLayout` tolerate the extra `gridScale` key (pass it through / ignore) and ensure NEW boards written by the app include `gridScale: 2` so they're never re-migrated. (Add `gridScale: 2` when serializing, or strip it on read and re-add on write — simplest: include `gridScale: 2` in the BoardLayout the app saves.)
- [ ] Apply: run the SELECT-one-board check, then the UPDATE, via `npx supabase db query --linked --file`. Verify a couple of boards' before/after.
- [ ] **Verify:** tsc (0). Commit `feat(dashboard): migrate saved board layouts to the 2× grid (idempotent)`.

### Task 3.3: Verify grid end-to-end
- [ ] `npx vitest run` (layout tests pass — update any test asserting old col/row constants), `npx tsc --noEmit` (0), `npm run build` (compiled). Commit any test updates `test(dashboard): update grid-scale expectations`.
- (Visual — flag: existing boards should look ~identical; resizing now has 2× steps both axes.)

---

## PHASE 4 — Per-user default board (any board, incl. shared) + delete-default

**Model:** new table `dashboard_user_defaults (user_id uuid, base_id uuid, board_id uuid, primary key (user_id, base_id))`, FK `board_id → dashboard_boards(id) ON DELETE CASCADE`, FK `user_id → auth.users` / `base_id → bases`. RLS: a user reads/writes only their own rows (`user_id = auth.uid()` AND `user_has_base_access(auth.uid(), base_id)`). This replaces the per-board `is_default` boolean as the source of truth for "my default board." Keep the `is_default` column for now (back-compat read fallback) but stop writing it as the authority.

### Task 4.1: Schema + RLS migration
**Files:** `supabase/migrations/<YYYYMMDD>_dashboard_user_defaults.sql` (new)

- [ ] Create the table + PK + FKs (`board_id` ON DELETE CASCADE so deleting a board clears defaults pointing at it). Enable RLS. Policies (SELECT/INSERT/UPDATE/DELETE) gated on `user_id = auth.uid() AND user_has_base_access(auth.uid(), base_id)`. Grant EXECUTE/privileges per the repo's pattern (direct table RLS; no helper functions needed).
- [ ] Backfill: `INSERT INTO dashboard_user_defaults (user_id, base_id, board_id) SELECT owner_id, base_id, id FROM dashboard_boards WHERE is_default = true AND owner_id IS NOT NULL ON CONFLICT (user_id, base_id) DO NOTHING;`
- [ ] Apply via `npx supabase db query --linked --file`. Verify the new table + a couple backfilled rows. Confirm RLS with a `SELECT` as the linked role is sensible (table exists, policies present).
- [ ] Commit `feat(dashboard): dashboard_user_defaults table (per-user default board)`.

### Task 4.2: Data-layer functions
**Files:** `lib/supabase/dashboard-boards.ts`

- [ ] Add `getUserDefaultBoardId(baseId, userId): Promise<string|null>` — select `board_id` from `dashboard_user_defaults` for that user+base.
- [ ] Rewrite `setDefaultBoard(boardId, baseId, userId)` to UPSERT into `dashboard_user_defaults` (`onConflict: 'user_id,base_id'`) with `.select()` 0-row detection → friendly error. Remove the old two-step `is_default` flip. (Any board id — personal or shared — is allowed.)
- [ ] Add `clearUserDefaultIfBoard(boardId, userId)` is unnecessary (ON DELETE CASCADE handles board deletion). But add nothing extra.
- [ ] Update `getOrCreateDefaultBoard(baseId, userId)`: resolve default via `getUserDefaultBoardId`; if set and the board is still visible in `fetchBoards`, return it; else fall back to the user's first personal board, else seed a new personal board from template (as today) AND write a `dashboard_user_defaults` row for it.
- [ ] **Verify:** tsc (0). Commit `feat(dashboard): per-user default board data layer`.

### Task 4.3: Page wiring — set-any-as-default, delete-default, default resolution
**Files:** `app/(app)/dashboard/page.tsx`, `components/dashboard/board-bar.tsx` (only if gating text needs changes)

- [ ] Load the user's default id via `getUserDefaultBoardId` into state on board load; use it to mark the active default (replace `is_default`-based checks at L199/L406 with the per-user id).
- [ ] `canSetDefault`: now `!!activeBoard && !!userId && getUserDefaultBoardId !== activeBoard.id` — allow ANY board (personal or shared) that isn't already the user's default. (Drop the `scope==='personal' && owner_id===userId` conditions.)
- [ ] `canDeleteActive`: allow deleting the active board even if it's the user's default, with one guard — don't allow deleting a SHARED board unless the user has publish rights (existing shared-edit guard). So: `canDeleteActive = !!activeBoard && (activeBoard.scope === 'personal' ? activeBoard.owner_id === userId : userCanPublishShared)`. Remove the `is_default` block. (Personal boards: deletable by owner regardless of default. Shared: only publishers.)
- [ ] `handleSetDefault`: call the rewritten `setDefaultBoard`; refresh the default-id state; toast.
- [ ] `handleDeleteBoard`: after delete, if the deleted board was the user's default, clear local default state and let `getOrCreateDefaultBoard` re-resolve on next load (CASCADE already removed the row). Re-pick the active board (first remaining) so the UI doesn't show an empty board.
- [ ] Update `board-bar.tsx` Star (set-default) and Delete button tooltips/titles to reflect the new rules (e.g. default star shows on any non-default board; delete shows for owner/publisher). Keep the visual ★ on the board that is the user's default (drive from the per-user default id passed in, not `is_default`).
- [ ] **Verify:** tsc (0), `npx vitest run` (pass), `npm run build` (compiled). Commit `feat(dashboard): set any board (incl. shared) as your default; delete your default`.
- (Behavioral — flag: user can now set the shared "AMOPS Dashboard" as default and delete the stray personal copy.)

---

## PHASE 5 — Full verification
- [ ] `npx vitest run` (all pass), `npx tsc --noEmit` (0), `npm run build` (RC 0).
- [ ] Manual smoke checklist for the user: NOTAM text wraps; column dividers + resize handles visible; dashboard loads scrolled to top on slow network; Progress shows FQ + JQS/1098/797/Formal %; grid resizes in 2× finer steps and existing boards look unchanged; can set shared AMOPS as default and delete the personal AMOPS copy.
- [ ] FYI to user: the Selfridge 1098 catalog has duplicate entries (data cleanup in the AMTR module, not a widget fix).

## Self-review
- Coverage: NOTAM=1.1, resize lines=1.2, scroll=1.3, Progress=2.1+2.2, finer grid=3.1-3.3, per-user default + delete=4.1-4.3. Compliance = intentional no-op (data issue). ✓
- Types: `ProgressRow`/`ProgressInput` defined 2.1, consumed 2.2. `getUserDefaultBoardId` defined 4.2, consumed 4.3. ✓
- Migrations: grid-scale (idempotent guard) + user-defaults (backfill, CASCADE). Applied via db query per repo convention. ✓
- Risk order: low-risk UI first; schema/grid migrations isolated and individually committed. ✓
