# Session Handoff

**Date:** 2026-06-28
**Branch:** `main` — committed locally. **NOT yet pushed** this session (21 Phase-4 commits + 1 fix sit ahead of origin's `cb77e406`). Push when ready.
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓ (compiled successfully, 113 pages),
`npx vitest run` ✓ **978 pass / 107 files**.
**HEAD:** `58454942`

---

## What shipped this session

**Phase 4 — Configurable Native Widgets.** The dashboard's eight list-style
widgets are now user-configurable through one shared, declarative **table
framework**, built brainstorm → spec → plan → subagent-driven execution (fresh
implementer per task + two-stage spec/quality review; the reviews caught real
issues, listed below). Delivered all five backlog items from the prior handoff,
plus the broader "all list widgets" + "quick actions" scope the user chose.

Spec: `docs/superpowers/specs/2026-06-27-phase4-configurable-widgets-design.md`.
Plan: `docs/superpowers/plans/2026-06-28-phase4-configurable-widgets.md`.

### The framework (Phase 1 — `36b4ef2e` … `16ebe0d9`)

A pure `TableWidgetDescriptor` (`lib/dashboard/table/types.ts`) drives three
shared React pieces:
- **`TableWidget`** (`components/dashboard/table/table-widget.tsx`) — generic
  renderer: summary header + column-selected/filtered table + footer link + row
  click behavior.
- **`TableConfigForm`** — generic gear form: title + column checkboxes + a
  control per filter + a select per "extra".
- **`RowDetailDialog`** — read-only field list; in `detail+actions` mode renders
  permission-gated action buttons.

Pure, unit-tested logic: `columns.ts` (`resolveVisibleColumns`), `filtering.ts`
(`applyFilters`), `config.ts` (`normalizeTableConfig` — the trust boundary that
makes pre-Phase-4 widgets render descriptor defaults, i.e. **back-compat with no
DB migration**). A widget becomes a table via `tableWidget(meta, descriptor)` in
`registry.tsx`. **Generic rename** (`TitleConfigForm`) was attached to all 20
non-table native widgets, so every widget can be renamed.

### Queue ops + flagship three (Phase 2 — `905a4c4f` … `a3105b78`)

Two new offline-queue ops — **`ppr_depart`** and **`contractor_status_update`**
(`lib/sync/{types,handlers}.ts`, `lib/dashboard/row-actions.ts`, labeled in
`queue-inspector.tsx`) — so detail-dialog actions never call direct CRUD. Then
the three flagship widgets converted:
- **Discrepancies** — columns + filters (type over the 11 `DISCREPANCY_TYPES`,
  status, assigned-shop); deeplink.
- **Personnel** — full `ContractorRow` field set; row → detail dialog with a
  **Mark Completed** action (`contractors:write`).
- **PPR** — **dynamic base-defined columns** (`useColumns` from
  `fetchPprColumns`), a `dateScope` extra (today / next-7d / all via
  `fetchPprEntries` range), row → detail dialog with a **Mark/Clear Departed**
  action (`ppr:write`).

### Remaining five (Phase 3 — `9a5fa990` … `6633d3ff`, `58454942`)

CES, Waivers, NOTAMs, Daily Reviews (deeplink) and Events Log (read-only detail —
no per-record page, append-only). No new write paths. The 8 old columnar widget
component files were deleted (their fetch logic moved into descriptors); 16
non-columnar native widgets remain unchanged.

---

## Migrations status

**None.** Phase 4 adds no DB migration — widget `config` is existing untyped
JSONB and `normalizeTableConfig` tolerates old shapes. The prior
`2026062700_dashboard_boards.sql` remains applied.

---

## Issues fixed during the session (from the per-task reviews)

| Symptom | Root cause | Where |
|---|---|---|
| `applyFilters` text test contradicted itself | plan test used query `'a'` (matches all three fixtures) but expected 2 rows | fixed to `'ha'` before commit `2f692839` |
| `tsc` failed on the descriptor test | `new Set(Object.values(PERM))` narrows to a literal-union Set, rejecting `string` | `new Set<string>(…)` — `a3105b78` |
| Build broke when `WriteType` grew | `queue-inspector.tsx` has an exhaustive `Record<WriteType,string>` | added two labels — `905a4c4f` |
| Events Log would have used a non-existent field | plan text said `profiles.operating_initials`; real field is flat `user_operating_initials` | implementer used the real field — `6633d3ff` |
| NOTAMs offered a dead "Local" source filter | `/notams` is FAA-feed only | removed source filter — `58454942` |

---

## Known issues / follow-ups (Phase 4 — all Minor, from the final review; none blocking)

| Item | Severity | Notes |
|---|---|---|
| Detail-dialog action has no optimistic row update | Low | Spec §6 envisioned optimistic local-row update; shipped behavior shows a success toast + reflects on next `useRows` fetch. Dialog closes on success so it's not jarring, but an offline-queued action shows no row change until a later refresh. |
| PPR config-form async-column edge | Low | `TableConfigForm` seeds `visibleKeys` once on first render. For the PPR descriptor only, base columns load async — re-saving the form *before* that fetch resolves could drop a previously-saved base-column selection. Toggling after load works fine. |
| Descriptor invariants test covers 2 of 8 | Low | `tests/dashboard-table-descriptors.test.ts` asserts only discrepancies + personnel. PPR (dynamic `useColumns`) and the 5 deeplink descriptors aren't asserted. Thin, not a defect. |
| Daily Reviews counts a fixed 5 slots | Low | Carried verbatim from the old widget. Module has `requiredSlotsForShifts(shiftCount)` implying required slots vary by base; a 2-shift base shows phantom-pending slots. Pre-existing; worth a ticket. |
| **Phase 4 never live-smoke-tested** | Med | Verified via tsc/vitest/build + per-task + final review only. Promote and exercise on the preview: column edit, all filter kinds, PPR dynamic columns + dateScope, Personnel/PPR detail dialogs + their actions (online AND offline-queued), rename on a native widget, board reload (back-compat). |

### Carried-over tech debt (unchanged from prior session)
No DB one-per-day inspection backstop; inspection list pagination; `types.ts`
regen (now also covers `dashboard_boards`); `scn` `enabled_modules` backfill (26
bases) + the null-only fallback fix; dormant role-template control to strip;
recharts 2.x EOL; `base-config/setup` ~6k LOC; lower-severity pentest items;
Next.js 14→15; CSP report-only; usr-analytics privacy copy; FLIP live smoke test +
Help-into-MODULES port.

---

## Next session tasks

No required next step — Phase 4 is committed and build-verified. **Push `main`**
and promote `58454942` when ready, then run the live smoke test above.

Optional polish (all Low): add the optimistic row update; fix the PPR config-form
async-column re-save edge; broaden the descriptor invariants test to all 8;
ticket the Daily Reviews variable-slot count.

---

## Key files this session

**New:** `lib/dashboard/table/{types,columns,filtering,config}.ts`;
`lib/dashboard/table/descriptors/{discrepancies,personnel,ppr,ces,waivers,notams,daily-reviews,events-log}.tsx`;
`components/dashboard/table/{table-widget,table-config-form,row-detail-dialog,title-config-form}.tsx`;
`lib/dashboard/row-actions.ts`; tests `dashboard-table-{columns,filtering,config,descriptors}`.

**Modified:** `lib/dashboard/registry.tsx` (tableWidget helper + 8 conversions +
rename fallback), `lib/dashboard/widget-registry.ts` (`WidgetKind += 'table'`),
`lib/sync/{types,handlers}.ts`, `components/sync/queue-inspector.tsx`,
`tests/write-queue-handlers.test.ts`.

**Deleted:** the 8 old columnar widget components in `components/dashboard/widgets/`.

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-06-28 | Phase 4 Configurable Native Widgets: one shared declarative table framework drives 8 configurable list widgets (user-selectable columns, filters, generic rename); PPR/Personnel row→detail dialogs with offline-queued Depart / Mark-Completed actions (`ppr_depart`, `contractor_status_update`); PPR dynamic base-defined columns + date scope. No DB migration; back-compat for existing boards. |
| **Unreleased** | 2026-06-27 | Customizable widget-grid dashboard: draggable/resizable per-user grid (`dashboard_boards` + RLS), 24 widgets, analytics builder. Persona/role boards intentionally dropped. |
| **v2.34.0** | 2026-06-01 | Help & Training all modules; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination; Records Export. |
| **v2.33.0** | 2026-05-02 | Glidepath Training rebuilt, permission-matrix overhaul, PPR module, offline reads + writes. |
