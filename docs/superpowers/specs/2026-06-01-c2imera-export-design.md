# Export for C2IMERA — Design Spec

**Date:** 2026-06-01
**Status:** Approved-pending-review
**Author:** Session (brainstormed with user)

## Summary

Add an **"Export for C2IMERA"** capability to **Settings → Exports**: a single card with a
base-local **date-range picker** (default = today) and a **Generate** button that downloads
**three separate `.xlsx` files** — Events Log, PPR Log, and Airfield Discrepancies — each
laid out with the exact columns C2IMERA expects for import.

C2IMERA = Command and Control Incident Management Emergency Response Application (USAF/ANG).
The export feeds a unit's airfield events / PPR / discrepancy picture into C2IMERA, so the
column order, headers, and value formats below are load-bearing for a clean import.

The first consumer is **Selfridge ANG Base** (unit **127 OSS/OSAB**), but the unit string and
the PPR ETA source column are stored per-base so the feature works fleet-wide.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Button location | Settings → Exports (new card) |
| Data scope | Selectable base-local date range, default = today |
| Unit value | Configurable per-base, default `127 OSS/OSAB` |
| PPR ETA source | A specific PPR time column (per-base), value **converted to base-local time** |
| Discrepancy scope | All currently-open discrepancies **plus** any created within the range (dedup) |
| Settings UI | Editable inline on the export card (admin-gated) |
| Output | Three separate `.xlsx` downloads (not a zip, not one multi-sheet workbook) |

## Architecture

### New module: `lib/export/c2imera-export.ts`

Pure builders + one orchestrator. Builders take already-fetched data and return
`{ columns: ColumnDef[], rows: Record<string, unknown>[] }` so they are unit-testable with no
DB or browser dependency.

```
buildEventsLogSheet(entries, unit)                  -> { columns, rows }
buildPprLogSheet(entries, columns, etaColId, tz)    -> { columns, rows }
buildDiscrepanciesSheet(rows, unit)                 -> { columns, rows }

exportC2imera(opts: {
  baseId: string
  from: string            // YYYY-MM-DD, base-local day start
  to: string              // YYYY-MM-DD, base-local day end (inclusive)
  unit: string
  etaColumnId: string | null
  tz: string              // installation timezone (IANA)
}): Promise<void>
```

`exportC2imera`:
1. Fetch in parallel:
   - Events: `fetchActivityLogForExport(baseId)` then filter by `created_at` within `[from,to]`
     base-local. (Reuse the existing entity-detail enrichment the Activity page uses so
     Remarks/Event match the on-screen Events Log.)
   - PPR: `fetchPprEntries(baseId, from, to)` (already filters on `arrival_date`) +
     `fetchPprColumns(baseId)`.
   - Discrepancies: `fetchDiscrepancies(baseId)` then apply the scope rule (below).
2. Build three sheets via the builders.
3. For each: `createStyledWorkbook()` → `addStyledSheet(wb, <sheetName>, columns, rows)` →
   `saveWorkbook(wb, <filename>)`. Calls are awaited sequentially so all three downloads fire.

### New Zulu helper: `formatC2imeraDateTime(date: Date | string): string`

Add to `lib/utils.ts`. Returns `"DD MMM YY // ZZZZ"`, e.g. `"01 JUN 26 // 1430Z"` — day
zero-padded, month uppercase 3-letter, 2-digit year, `HHMM` Zulu + `Z`, all UTC. Unit-tested.

### UI: `components/exports/c2imera-export-card.tsx` (rendered on `app/(app)/settings/exports`)

- Date-range picker (two date inputs), default both = today (base-local).
- Admin-gated inline settings: a **Unit** text input and a **PPR ETA column** `<select>`
  populated from `fetchPprColumns(baseId)` filtered to `column_type === 'time'`. Saving writes
  `bases.c2imera_unit` / `bases.c2imera_ppr_eta_column_id` via the existing base-update path.
- **Generate** button → `exportC2imera(...)`, with a Sonner toast on success/failure
  (`friendlyError`). Disabled while generating.
- Card visibility follows the existing `/settings/exports` gating; the editable settings row is
  additionally gated to base admins / sys-admin.

### Migration (expand-only)

New migration `<next-number>_c2imera_export_settings.sql` adding to `bases`:
- `c2imera_unit TEXT NOT NULL DEFAULT '127 OSS/OSAB'`
- `c2imera_ppr_eta_column_id UUID` (nullable; references the chosen `ppr_columns.id` logically —
  no hard FK, since columns can be deleted; null/dangling → ETA blank).

Pick the filename number to sort **after** the current max migration (numbering currently runs
ahead of the calendar — verify during planning). Apply via
`npx supabase db query --linked --file`, never `db push`. Add the two columns to the
hand-maintained `bases` Row type in `lib/supabase/types.ts`.

No RLS changes: reads ride the existing `bases` select policy; the unit/ETA edit uses the
existing base-update policy (`user_has_base_access` + base-admin permission).

## Sheet specifications

Constant-fill columns have the same literal value in every data row.

### 1. Events Log — sheet "Events Log", file `C2IMERA_EventsLog_<range>.xlsx`

| # | Header | Source | Value |
|---|---|---|---|
| 1 | Classification | constant | `Unclassified` |
| 2 | Real World or Exercise | constant | `RW` |
| 3 | Time (L) | `created_at` | `formatC2imeraDateTime` → `DD MMM YY // ZZZZ` (Zulu; header label is C2IMERA's, value is Zulu by spec) |
| 4 | Unit | base setting | `c2imera_unit` (e.g. `127 OSS/OSAB`) |
| 5 | Remarks | Events "Details" | reuse `buildDetailsString` (`lib/activity-format.ts`) — same string shown on `/activity` |
| 6 | Event | Events "Action" | reuse `formatAction` (`lib/activity-format.ts`) |

### 2. PPR Log — sheet "PPR Log", file `C2IMERA_PPRLog_<range>.xlsx`

| # | Header | Source | Value |
|---|---|---|---|
| 1 | Date | `arrival_date` | as stored (YYYY-MM-DD) |
| 2 | POC (Name and Number) | `requester_name` + `requester_phone` | `"Name — Phone"`; omit the dash if either side missing |
| 3 | Status | `status` | friendly label (reuse the PPR status label map; e.g. Approved / Denied / Pending Triage / Pending Coordination / Pending Approval / Canceled) |
| 4 | ETA (L) | configured ETA column value | raw `HHMM` from `column_values[etaColumnId]`, **converted Zulu → base-local** via `formatLocalTime(hhmm, tz)`; blank if no value / no column configured |
| 5 | PPR Number | `ppr_number` | as stored |

PPR rows filtered to the date range via `fetchPprEntries(baseId, from, to)` (on `arrival_date`).
Denied/canceled are **included** (the export is a full log, not the active-count view) unless the
user later asks otherwise.

### 3. Discrepancies — sheet "Discrepancies", file `C2IMERA_Discrepancies_<range>.xlsx`

| # | Header | Source | Value |
|---|---|---|---|
| 1 | Display ID | `display_id` | e.g. `D-2026-ABC1` |
| 2 | Title | `title` | |
| 3 | Status | `status` | friendly (Open / Completed / Cancelled) |
| 4 | Current Status | `current_status` | friendly (reuse existing current-status label map) |
| 5 | Coordinate | `latitude`, `longitude` | `"42.6131, -82.8369"` in one cell; blank if either null |
| 6 | Location | `location_text` | |
| 7 | Assigned Shop | `assigned_shop` | blank if null |
| 8 | W/O # | `work_order_number` | blank if null |
| 9 | Days Open | `created_at` | `max(0, floor((now - created_at)/86400000))` |
| 10 | ECD | `estimated_completion_date` | `formatZuluDate` if set, else blank |
| 11 | Date Created | `created_at` | `formatZuluDate` |
| 12 | Created By | `reporter.rank` + `reporter.name` | `"Rank Name"`, trimmed |
| 13 | Unit | base setting | `c2imera_unit` |

**Scope rule:** include a discrepancy if `status === 'open'` **OR** `created_at` falls within
`[from, to]` base-local. Dedup by `id`. (Captures the current open picture plus anything that
closed/cancelled during the window.)

## Filenames

`<range>` = `YYYYMMDD` if `from === to`, else `YYYYMMDD-YYYYMMDD`. Example single day:
`C2IMERA_EventsLog_20260601.xlsx`.

## Testing

New `tests/c2imera-export.test.ts` (pure, no DB):
- `formatC2imeraDateTime` — known timestamp → `"01 JUN 26 // 1430Z"`; day/month padding; UTC.
- `buildEventsLogSheet` — column order + headers exact; Classification/RW/Unit constant fills;
  Time formatted; Remarks/Event mapped.
- `buildPprLogSheet` — POC join formatting (both/one/none present); ETA Zulu→local conversion;
  blank ETA when column unset; status label mapping.
- `buildDiscrepanciesSheet` — coordinate join + null handling; Days Open math (inject a fixed
  "now"); friendly status/current-status labels; Created By join; Unit fill.
- Discrepancy scope union/dedup (open-but-old included; in-range-but-closed included; old-closed
  excluded; no duplicates).

Builders accept an injectable `now` (or compute Days Open from a passed reference) so tests are
deterministic. Gate the commit on `npx tsc --noEmit` **and** `npm run build` RC=0, plus
`npx vitest run`.

## Out of scope (YAGNI)

- Zipping the three files (user wants three separate downloads).
- A one-click "current operational day" shortcut beyond the default-to-today picker.
- C2IMERA *import* / round-trip validation — this is export-only.
- SCN / other logs — only the three named exports.
- Backfilling `c2imera_ppr_eta_column_id` for non-Selfridge bases (auto-detect-by-name or admin
  picks it; null → blank ETA).

## File touch list

**New**
- `lib/export/c2imera-export.ts`
- `components/exports/c2imera-export-card.tsx`
- `supabase/migrations/<next>_c2imera_export_settings.sql`
- `tests/c2imera-export.test.ts`

**Modified**
- `lib/utils.ts` — add `formatC2imeraDateTime`
- `app/(app)/settings/exports/page.tsx` — render the card
- `lib/supabase/types.ts` — add `c2imera_unit`, `c2imera_ppr_eta_column_id` to `bases` Row

## Open items to resolve during planning (not blocking design)

- Confirm the exact existing PPR status + discrepancy current-status **label maps** to reuse
  (avoid inventing new label strings).
- Confirm `formatLocalTime(hhmm, tz)` treats the input `HHMM` as Zulu (it does in
  `formatPprColumnValue`'s local branch) — reuse that exact path.
- Confirm the base-update call path used by base-config for writing the two new columns.
- Determine the next migration number (numbering runs ahead of the calendar).
