# Session Handoff

**Date:** 2026-06-29
**Branch:** `main` — **pushed, in sync with origin** through `ab7cc71f`.
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓ (compiled successfully),
`npx vitest run` ✓ **1032 pass / 112 files**.
**HEAD:** `ab7cc71f`

Long dashboard-focused session, three arcs: (1) a polish round on the widget grid, (2) a
feedback-driven round 2 incl. a finer grid + per-user default boards, and (3) a net-new
**Airfield Lighting** widget family. **One DB migration this session** (`dashboard_user_defaults`,
already applied to the linked prod DB — see Migrations). Everything else rides in existing JSONB.
**Not live-smoke-tested** — promote `ab7cc71f` and exercise on the preview.

---

## What shipped today (end state — read first)

### Arc 1 — Dashboard polish round 1
- **9 metric tiles centered** (report-* + feedback + amtr-kpis + last-check + inspection-status).
- **Links widget reorder** (drag grip + tap ▲/▼).
- **AMTR consolidated into ONE "AMTR" widget** with a 9-report dropdown: Currency, Unit KPIs,
  Overdue, Due Soon, Inspections (the old 5) **+ My Training Record, Training Progress, Task
  Compliance, Pending Signatures** (4 new). `components/dashboard/widgets/amtr-widget.tsx` +
  descriptors under `lib/dashboard/table/descriptors/amtr-*`. The 4 old split AMTR entries are
  `hidden` in the palette (still render existing instances).

### Arc 2 — Dashboard polish round 2
- **Long table cells wrap** as readable blocks via a per-column `wrap` flag (NOTAM text).
- **Visible column dividers + discoverable resize handles** (`table-widget.tsx` + `globals.css`
  `.wt-col-resize::after`), and header/cell padding so titles clear the dividers.
- **Settle-based scroll-to-top** — replaced the fixed-150ms hack with a load-keyed effect
  (immediate + 2 rAFs + first grid ResizeObserver + 300ms fallback) targeting `.app-content`.
- **AMTR Training Progress redesign** — one row per member: **Member · FQ · JQS% · 1098% · 797% ·
  Formal%**. FQ is derived = **JQS 100% AND Formal 100%** (⚠ pending user confirmation).
- **Finer grid: 24 cols / 40px rows** (was 12 / 80). Migrated **at read time**, not via SQL:
  `lib/dashboard/layout.ts` `validateBoardLayout` doubles any layout lacking `gridScale:2` once
  and tags it; `createBoard`/`updateBoardLayout` stamp `gridScale:2`. Idempotent, back-compat
  (old code ignores the tag). Registry `defaultSize`/`minSize` and `DEFAULT_LAYOUT` were ×2.
- **Per-user default boards** — new table `dashboard_user_defaults` is the source of truth for
  "my default" (any board, **including shared**). `dashboard_boards.is_default` is now a legacy
  fallback only. "Set as Default" works on shared boards; **deleting your default is allowed**
  (cascades + re-resolves). Data layer: `getUserDefaultBoardId` / rewritten `setDefaultBoard`
  (upsert) / `getOrCreateDefaultBoard`. Board picker marks the default with ✓.
- **Column reorder** in the table-widget gear (`table-config-form.tsx`): drag grip **and** tap
  ▲/▼. **HTML5 `draggable` does not fire on touch (iPad)** — the ▲/▼ buttons are the universal
  path; same ▲/▼ added to the Links reorder. Gear-save now spreads existing config (no longer
  wipes column widths / color).

### Arc 3 — Airfield Lighting widget family
Spec/plan in `docs/superpowers/{specs,plans}/2026-06-29-airfield-lighting-*`.
- **Shared area module** `lib/infrastructure/areas.ts` (`resolveArea`, `buildFullRunwaysSet`,
  `areaSortKey`, `listAreas`, `systemsForArea`) extracted from `infrastructure/page.tsx` (page is
  the regression check); unit-tested.
- **"Airfield Lighting" widget** (`lighting-widget.tsx`, key `lighting`) scoped **By Area / By
  System / By Type** — covers runway/taxiway/apron areas, a specific system, and stadium/
  obstruction-by-type. Renders systems → components (uniform `name · count · status-dot` columns)
  → out lights, with **A3.1 compliance action tags** (NOTAM/Notify CE/…) on exceedance. All math
  reuses `lib/outage-rules.ts`. Old system-scoped `infrastructure` widget is `hidden`.
- **"Lighting Status" widget** (`lighting-status-widget.tsx`, key `lighting-status`) reuses
  `components/infrastructure/system-health-panel.tsx` — the Visual NAVAIDs category roll-up
  (Runway/Taxiway/Approach/Signage/Other). Full-width default for the top of a lighting board.
- **"Add a widget for every area"** moved out of the palette into the Airfield Lighting widget
  (edit mode), wired via `components/dashboard/dashboard-actions.tsx` context. Old `report-lighting`
  "Lighting Report" widget is `hidden`.

---

## Migrations status

**One this session, already applied:** `supabase/migrations/2026062900_dashboard_user_defaults.sql`
— `dashboard_user_defaults(user_id, base_id, board_id, PK(user_id,base_id))`, `board_id`
ON DELETE CASCADE, RLS pinned to `auth.uid()`, backfilled from `is_default` (9 rows). **Applied to
the linked prod DB via `npx supabase db query --linked --file`.** No pending migrations. The grid
finer-scale is NOT a migration (read-time only).

---

## Key non-obvious facts (also saved as memories)

- **Grid scale invariant** ([[project_dashboard_grid_scale]]): any NEW `createBoard` caller must
  pass a **new-scale** layout; the write boundary stamps `gridScale:2` without re-scaling.
- **Per-user defaults** ([[project_dashboard_user_defaults]]): `dashboard_user_defaults` is SoT;
  `is_default` is legacy fallback.
- **Lighting has NO FK to runway/taxiway** ([[project_lighting_area_grouping]]): an "area" is
  `lighting_systems.runway_or_taxiway` grouped via `lib/infrastructure/areas.ts`. Stadium/
  obstruction lights are `system_type` values, not areas.
- **HTML5 `draggable` is mouse-only** — touch/iPad needs tap buttons or pointer events.
- **Outage/health is computed live** by `lib/outage-rules.ts` (`calculateSystemHealth`,
  `OutageStatus`, `getAlertTier`), never stored.

---

## Open follow-ups / not done

| Item | Notes |
|---|---|
| **Confirm FQ definition** | Training Progress FQ = JQS 100% AND Formal 100%. User to confirm whether 1098/797 should factor in. |
| **Selfridge 1098 catalog has duplicate rows** | Data issue at base `…0001` (≈a dozen task names twice). The Task Compliance widget faithfully shows them. Cleanup belongs in the AMTR module, not widget code. |
| **Lighting area-builder polish (optional)** | Currently appends one `lighting` tile per area at the bottom. Could also drop a `lighting-status` tile at top and/or lay tiles in a tidy grid in the same tap. |
| **"By type" board builder (optional)** | Mirror the per-area builder for system types. |
| **Live lighting polling (optional)** | Widgets load on mount / scope change; no realtime refresh. |
| **Whole session not live-smoke-tested** | Verified via tsc/build/vitest + per-task reviews only. |

---

## Live smoke test after promotion

- **Centering / tables:** 9 tiles centered; NOTAM text wraps; column dividers + resize handles
  visible; gear column reorder via ▲/▼ on iPad; dashboard opens scrolled to top on slow network.
- **Grid:** existing boards look unchanged; resizing has 2× finer steps both axes.
- **Default boards:** set the shared AMOPS board as default; delete the leftover personal AMOPS
  copy; ✓ marks the default in the picker.
- **AMTR:** one "AMTR" palette widget; all 9 reports render (esp. self-scoped My Training +
  Pending Signatures); Training Progress shows FQ + JQS/1098/797/Formal %.
- **Lighting:** add "Airfield Lighting", try all 3 scopes (numbers match `/infrastructure`); an
  exceeded component shows action tags; add "Lighting Status" (category tiles match the NAVAIDs
  bar); edit-mode "✚ Add a widget for every area" builds one tile per area; old "Infrastructure
  Status" / "Lighting Report" gone from the palette but existing instances still render.

---

## Next session tasks

No required next step — everything is committed, pushed, build-verified, and the one migration is
applied. User owns Vercel promotion. Pick up from the **Open follow-ups** table (FQ confirmation
and the Selfridge catalog-dup cleanup are the two with real user impact).

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-06-29 | Airfield Lighting widget family (By Area/System/Type + Lighting Status roll-up + in-widget area builder); dashboard round 2: finer 24/40 grid (read-time migration), per-user default boards (`dashboard_user_defaults`, applied), AMTR Training Progress redesign, touch-friendly column/link reorder, NOTAM wrap, settle scroll-to-top, visible column dividers. |
| **Unreleased** | 2026-06-29 | Dashboard polish round 1: centered metric tiles; AMTR consolidated into one 9-report widget; Links drag/tap reorder. |
| **Unreleased** | 2026-06-28 | Dashboard widget refinement run on Phase 4: per-column resize/wrap/sticky/sort/search, deep-link rows, per-widget color, share-copies-widgets, opens-at-top. |
| **Unreleased** | 2026-06-27 | Phase 4 Configurable Native Widgets + customizable widget-grid dashboard (`dashboard_boards` + RLS, 24 widgets). |
| **v2.34.0** | 2026-06-01 | Help & Training all modules; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination; Records Export. |
| **v2.33.0** | 2026-05-02 | Glidepath Training rebuilt, permission-matrix overhaul, PPR module, offline reads + writes. |
