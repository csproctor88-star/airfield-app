# Status Board Widget — Design

**Date:** 2026-06-30
**Module:** Dashboard — new widget
**Status:** Draft for review

## Goal

A dashboard widget that displays a chosen Airfield Status board, read-only: a user's
**Custom Status Board**, the **NAVAIDs**, **Runway Status**, or **ARFF**. No changes to
the Airfield Status page; reuses its data layer.

## Config

`StatusBoardConfig = { title?: string; kind: 'custom' | 'navaid' | 'runway' | 'arff'; boardId?: string }`

`StatusBoardConfigForm`:
- **Kind** select: Custom Status Board / NAVAIDs / Runway Status / ARFF.
- When `kind === 'custom'`: a **board** select sourced from `fetchCustomStatusBoards(installationId)` (value = board id, label = `board_name`). Reset/needed only for custom.
- Optional title.

## Widget

`StatusBoardWidget` — read-only compact list, one render path per kind, each a row with a
colored status indicator. Modeled structurally on `components/dashboard/widgets/field-conditions-widget.tsx`
(fetch by `installationId` → list → colored value → footer link). Footer: **"View status
board →"** → `/`. Loading + empty states per kind.

| kind | source | row | color mapping |
|---|---|---|---|
| `custom` | `fetchCustomStatusItems(boardId)` (sorted by `sort_order`) | `item_name` · note (when not green) | green/yellow/red → success/warning/danger |
| `navaid` | `fetchNavaidStatuses(installationId)` | `navaid_name` · note | green/yellow/red → success/warning/danger |
| `runway` | `useDashboard().runwayStatuses` + runway list (`useInstallation`) | runway · status (+ active end / est. resume when present) | open→success, suspended→warning, closed→danger |
| `arff` | `useDashboard().arffStatuses` + `arffCat` + aircraft list | CAT header + aircraft · readiness | optimum→success, reduced→warning, critical→orange, inadequate→danger |

Runway/ARFF read from `useDashboard()` (kept fresh app-wide via `dashboard-context`);
custom/NAVAID fetch on mount + when the config (kind/board) changes. Custom boards have
no realtime channel — acceptable for a dashboard tile (refresh on load/board-switch).

## Pure helper (unit-tested)

`lib/dashboard/status-board.ts`:
- `statusBoardColor(kind, value): string` — maps a raw status value for each kind to a CSS
  color token (the four mappings above). Default `--color-text-3` for unknown.
- `statusBoardLabel(kind, value): string` — display label (e.g. `open` → "Open",
  `inadequate` → "Inadequate"). Green/yellow/red pass through capitalized.

Both are pure → unit-tested. The widget imports them so the color/label logic is testable
without rendering.

## Registry

One `WidgetDef` `'status-board'` in `lib/dashboard/registry.tsx`: title "Status Board",
icon (e.g. `LayoutGrid`/`ClipboardList`), `defaultSize { w: 6, h: 6 }`, `minSize { w: 4, h: 4 }`,
gated on the airfield-status **view** permission (the same gate the Airfield Status page
read uses), `ConfigForm: StatusBoardConfigForm`, `Component: (p) => <StatusBoardWidget {...p} />`.

## Non-goals

- Editing status from the widget (read-only — decided; the status page is the system of record).
- RSC/RCR/BWC and the free-text sections (Construction/Misc/PPR) — not part of this widget.
- Realtime push for custom boards (out of scope; consistent with other data widgets).

## Testing

- Unit-test `statusBoardColor` / `statusBoardLabel` for all four kinds + unknown fallback.
- `npx tsc --noEmit`, `npx vitest run`, `npm run build` green.
- Manual smoke: add the widget; for each kind it shows the right items/colors; switching
  the custom board re-renders; "View status board →" opens `/`.
