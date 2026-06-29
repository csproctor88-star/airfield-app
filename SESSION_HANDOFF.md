# Session Handoff

**Date:** 2026-06-28
**Branch:** `main` — **pushed, in sync with origin** through `81a0919c`.
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓ (compiled successfully, 113 pages),
`npx vitest run` ✓ **971 pass / 107 files**.
**HEAD:** `81a0919c`

This was a long, single-feature session: Phase 4 (the configurable widget-grid table
framework) shipped first, then a large user-feedback-driven refinement run on top of it.
The dashboard widget system is the only thing that changed. Read the "Current dashboard
behavior" summary first, then the per-batch detail below if you need the why.

---

## Current dashboard behavior (end state — read this first)

The eight list widgets (discrepancies, ppr, personnel, notams, ces, events-log, waivers,
daily-reviews) are **configurable tables** driven by one shared framework
(`lib/dashboard/table/` + `components/dashboard/table/table-widget.tsx`). Per widget:
user-selectable **columns**, **filters**, click-to-**sort** (▲/▼), a per-widget **search**
box, and **drag-resizable columns** (widths persisted; cells **wrap** once resized; headers
are **sticky** while scrolling). Rows **deep-link to their module** (hover-highlighted) —
there are **no in-dashboard detail/action dialogs** anymore (removed mid-session; see
"Reversal"). PPR is the one special case: its rows deep-link to `/ppr?detail=<id>` and the
PPR Log page **auto-opens its real full detail dialog** for that entry.

Every widget can be **renamed** and **color-tinted** (per-widget color swatch in edit mode;
theme-aware via `color-mix` over surface/border tokens — dark/light safe). Several widgets
are richer than count tiles: Wildlife (recent sightings+strikes), User Management (base
roster + deep-link), AMTR (currency status like the AMTR page), Infrastructure (per-system
light/outage selector), and five **report-summary** widgets. Utility: multi-timezone Zulu
clock, Notes with inline "＋ Add note", Quick Actions with a module-picker + custom buttons,
Links with descriptions + search, and an Events Log widget with a **full-screen "Add Entry"**
(manual textarea **and** template picker). Boards: **share copies the current widgets**,
and a user can **set a personal board as their default**. The dashboard **opens scrolled to
the top**.

All widget config (columns/filters/extras/color/title/widths) lives in the widget's `config`
JSON and persists through the existing offline-queue board save. **No DB migration** anywhere
in this work. **Not live-smoke-tested** — promote and exercise on the preview.

---

## Refinement run (latest — `da95e531` … `81a0919c`)

Driven by user testing + screenshots. Built as focused implement→review batches.

### Share copies widgets (`da95e531`)
`handleCreateShared` called `createBoard` with no `layout`, so every shared board was born
empty. Now passes `layout: validateLayout(widgets)` — sharing publishes what you built.

### Table rendering: wrap / hover / per-column resize / sticky (`73290bd3`)
Four fixes in `table-widget.tsx` (+ a `.wt-row-link` hover rule in `globals.css`): (1)
resizing one column no longer snaps the others to 140px — mouse-up now persists **every**
column's current width, not just the dragged one; (2) cells **wrap** (`whiteSpace:normal`)
when columns are resized (`useFixedLayout`) instead of truncating; (3) headers are
`position:sticky` so they stay visible while the body scrolls; (4) deep-link rows carry
`.wt-row-link` and highlight on hover so it's clear they're clickable.

### PPR: status labels, dynamic values, deep-link (`a30d4006`, fallback in `81a0919c`)
Status column now human-readable ("Pending Triage" etc.). Base-defined columns were keyed by
`column_name` but `PprEntry.column_values` is keyed by `c.id` (UUID) — fixed, and now
formatted via `formatPprColumnValue` (the page's display SoT), so dynamic columns show data.
Row deep-links to `/ppr?detail=<id>`; the page reads the param and opens the full dialog. The
initial implementation only searched the page's date-scoped `entries`, so a PPR outside that
range never opened — `81a0919c` adds `fetchPprEntryById` as a fallback and removes the
`entries.length` guard.

### Embed scroll + clock slices (`177f22da`)
Embed iframe got `minHeight:0` + an explicit height so taller pages scroll natively (the
flexbox `min-height:auto` default was letting the iframe grow and get clipped). Multi-timezone
clock now renders **equal `1fr` slices** with a large mono font (Zulu primary, with date),
instead of a cramped small-font list.

### Events quick-add → full-screen, manual + template (`56d10b57`, `81a0919c`)
Added a generic optional `Toolbar` + `reloadNonce` to the table framework so a widget can host
a toolbar button and refetch after writing. The Events Log widget's "＋ Add entry" opens a
**full-screen** "Add Events Log Entry" dialog with a **manual textarea + Log Entry** and a
**Use a Template** option (reuses the real `TemplatePicker`, now with a `fullScreen` prop).
`81a0919c` made it full-screen and added the manual box alongside the template.

### Set a board as default (`7674e0a3`)
`setDefaultBoard(boardId, baseId, userId)` clears `is_default` on the user's boards then sets
it on the target. A ★ "Set as Default" control appears in the board bar only for the user's
own personal, non-default board.

### Per-widget color (`2a4ed360`)
`lib/dashboard/widget-colors.ts` (`WIDGET_COLORS` + `widgetTint`) tints a widget by mixing a
hue **over** the theme surface/border tokens via `color-mix` (subtle, dark/light safe). A
swatch picker in the frame's edit controls writes `config.color`; "Default" clears it.

### Dashboard opens at top (`dc1c0dc7`)
The browser restored a mid-page scroll position on the tall full-bleed grid. A mount effect
forces `.app-content` + window to the top, with a follow-up tick after the async load reflow.

### Reversal that preceded this run (`4a8e8154`, `28e128bb`)
The original Phase-2 in-dashboard detail/action dialogs rendered **truncated** inside the
grid. Decision: rows **deep-link to their module** instead. The orphaned plumbing was then
**stripped** — deleted `RowDetailDialog` + `row-actions.ts`, removed the
`detail`/`detail+actions`/`custom` `RowBehavior` modes and the `ppr_depart` /
`contractor_status_update` offline-queue ops + their 7 tests (978 → 971). `onConfigChange`
(inline widget self-config) was kept. PPR later got the rich dialog back via deep-link
auto-open (above), which is the faithful full-size version.

---

## Phase 4 — the framework underneath (earlier this session, `36b4ef2e` … `cb77e406`-era → `2634ab79`)

The configurable table framework all of the above builds on. A pure `TableWidgetDescriptor`
(`lib/dashboard/table/types.ts`) drives `TableWidget` (renderer), `TableConfigForm` (gear:
title + column checkboxes + filter/extra controls), and `TitleConfigForm` (rename fallback on
all non-table native widgets). Pure unit-tested logic: `resolveVisibleColumns` (`columns.ts`),
`applyFilters` (`filtering.ts`), `normalizeTableConfig` (`config.ts` — the trust boundary that
makes pre-Phase-4 widgets render descriptor defaults → **back-compat, no migration**). A
widget becomes a table via `tableWidget(meta, descriptor)` in `registry.tsx`. Spec/plan:
`docs/superpowers/specs/2026-06-27-phase4-configurable-widgets-design.md`,
`docs/superpowers/plans/2026-06-28-phase4-configurable-widgets.md`.

---

## Migrations status

**None this session.** All dashboard config rides in existing JSONB. The prior
`2026062700_dashboard_boards.sql` remains **applied**. No pending migrations.

---

## Bugs fixed during the session (worth not re-debugging)

| Symptom | Root cause | Commit |
|---|---|---|
| Shared board is always empty | `handleCreateShared` never passed `layout` to `createBoard` | `da95e531` |
| Resizing one column resizes them all | mouse-up persisted only the dragged column; others fell to the 140px fixed-layout default | `73290bd3` |
| Window resize wiped the saved layout | `onLayoutChange` persisted reflow at md/sm; the breakpoint guard read a stale `useState` on the crossing tick (fixed with a ref) | `c413cac7`/`a5304d1b` |
| PPR base-defined columns show no data | accessor keyed by `column_name`; `column_values` is keyed by `c.id` (UUID) | `a30d4006` |
| PPR deep-link lands on home, no dialog | page only searched its date-scoped `entries`; deep-linked PPR was outside the range | `81a0919c` (`fetchPprEntryById` fallback) |
| PPR "Any Time" returns nothing | `0000-01-01` sentinel is an invalid Postgres date | `df9f2ab5` |
| Embedded pages won't scroll | flexbox `min-height:auto` let the iframe grow + get clipped | `177f22da` |
| Dashboard opens mid-page | browser scroll restoration on the tall full-bleed grid | `dc1c0dc7` |
| Events Log would read a non-existent field | plan said `profiles.operating_initials`; real field is flat `user_operating_initials` | `6633d3ff` |

---

## Lessons from this session

- **The dashboard grid is small; record detail belongs in the module.** Generic in-grid
  dialogs read as truncated. Deep-link to the module (or, like PPR, deep-link and auto-open
  the module's own full dialog) rather than rebuild a detail view inside a widget.
- **react-grid-layout fires `onBreakpointChange` then `onLayoutChange` synchronously** — a
  `useState` breakpoint is one render stale on the crossing tick; read it from a ref.
- **PPR `column_values` is keyed by `PprColumn.id` (UUID), not `column_name`**, and
  `formatPprColumnValue` is the display source of truth. (Already a memory.)
- **Flexbox children clip instead of scroll without `min-height: 0`** — the fix for the
  embed iframe and any nested scroll area.
- **Tint via `color-mix` over theme tokens** for dark/light-safe per-element coloring, never
  fixed fills.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| Header alignment is uniform-by-rule, not centered | Low | User asked for "center"; shipped text-left / numeric-right (centered long titles read poorly). Flip the `ColumnDef.align` default if they want true center. |
| Daily Reviews counts a fixed 5 slots | Low | Carried from the old widget; module has `requiredSlotsForShifts(shiftCount)` — a 2-shift base shows phantom-pending slots. Worth a ticket. |
| Descriptor invariants test covers 2 of 8 | Low | `tests/dashboard-table-descriptors.test.ts` asserts only discrepancies + personnel; report-* widgets (native) aren't covered. |
| PPR config-form async-column re-save edge | Low | `TableConfigForm` seeds visible columns once; for PPR (async base columns) re-saving the gear *before* the fetch resolves can drop a previously-saved base column. Toggling after load is fine. |
| Whole dashboard widget system never live-smoke-tested | **Med** | Verified via tsc/build/vitest + per-batch reviews only. Promote `81a0919c` and exercise on the preview (checklist below). |
| `dashboard_boards` goes through untyped `db()` (`as any`) | Low | Table not in generated `types.ts`; folds into the types.ts regen debt. |
| recharts 2.15.0 is EOL 2.x | Low | Stable; 3.x bump is a separate effort. |

### Carried-over tech debt (unchanged, not touched this session)
No DB one-per-day inspection backstop; inspection list pagination; `types.ts` regen; `scn`
`enabled_modules` backfill (26 bases) + the null-only fallback fix; dormant role-template
control to strip; `base-config/setup` ~6k LOC; lower-severity pentest items; Next.js 14→15;
CSP report-only (now also `frame-src 'self' https:` for embeds); usr-analytics privacy copy;
FLIP live smoke test + Help-into-MODULES port.

---

## Next session tasks

No required next step — everything is committed, pushed, and build-verified. The user owns
Vercel promotion.

**Live smoke test after promotion** (the one real gap): per widget — column edit, all filter
kinds, sort, search, resize (one column only moves; cells wrap; header sticks), color tint
(dark + light), rename. Board: share-copies-widgets, set-as-default, reload back-compat,
opens-at-top. PPR: dynamic columns show data, status labels, row → full detail dialog opens
(incl. a PPR outside today's range). Events Log: full-screen Add Entry with manual + template.
Embed: a tall site scrolls. Clock: multiple timezones as equal slices.

**Optional polish (all Low):** offer a "center" alignment default; ticket the Daily Reviews
variable-slot count; broaden the descriptor invariants test; fix the PPR config-form
async-column re-save edge.

---

## Build snapshot

```
Build: npm run build — compiled successfully (113 static pages).
TypeScript clean (npx tsc --noEmit exit 0).
Tests: 971 pass / 107 files (npx vitest run).

Notable First Load JS:
  /dashboard                  171 kB / 414 kB   (was 160/385 at Phase-4 end; +table sort/search/resize, color, report widgets)
First Load JS shared        ~91.6 kB
Middleware                  74.6 kB
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-06-28 | Dashboard widget refinement run on Phase 4: per-column resize/wrap/sticky headers/sort/search, rows deep-link to modules (no in-grid dialogs), PPR deep-link auto-opens the real detail dialog, per-widget color tint (theme-aware), share-copies-widgets, set-as-default board, full-screen Events add-entry (manual + template), multi-timezone clock, embed scroll fix, opens-at-top. No migration. |
| **Unreleased** | 2026-06-27 | Phase 4 Configurable Native Widgets: one shared declarative table framework drives 8 configurable list widgets (columns, filters, generic rename); richer Wildlife/Users/AMTR/Infrastructure widgets; report-summary widgets; analytics avg-duration. No DB migration; back-compat for existing boards. |
| **Unreleased** | 2026-06-27 | Customizable widget-grid dashboard: draggable/resizable per-user grid (`dashboard_boards` + RLS), 24 widgets, analytics builder. Persona/role boards intentionally dropped. |
| **v2.34.0** | 2026-06-01 | Help & Training all modules; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination; Records Export. |
| **v2.33.0** | 2026-05-02 | Glidepath Training rebuilt, permission-matrix overhaul, PPR module, offline reads + writes. |
