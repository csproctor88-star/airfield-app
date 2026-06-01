# Export QRC — Design Spec

**Date:** 2026-06-01
**Status:** Approved + shipped

## Summary

An **"Export QRC"** card on **Settings → Exports**: one button downloads a single
Excel workbook with **a sheet per active QRC** (sheet name = the QRC title), each
sheet a single **"Step Descriptions"** column listing every step's label
(sub-steps included).

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Location | Settings → Exports (new card, all bases) |
| Column content | Label only — plain step instruction text, no numbers/notes/agencies |
| Scope | Active QRC templates for the base (`is_active`) |
| Output | One workbook, one sheet per QRC |

## Implementation

`lib/export/qrc-export.ts` (pure helpers + IO orchestrator):
- `flattenQrcSteps(steps)` — depth-first, parent before sub-steps (`QrcStep.sub_steps`).
- `buildQrcSheet(qrc)` — single `Step Descriptions` column; one row per non-blank
  `step.label` from the flattened steps.
- `qrcSheetName(title, used)` — strips Excel-forbidden `: \ / ? * [ ]`, collapses
  whitespace, caps at 31 chars, dedupes case-insensitively (Excel sheet names are
  case-insensitive and unique).
- `exportQrc(baseId)` — `fetchQrcTemplates(baseId)` → filter `is_active` → build one
  workbook (sheet per QRC via `lib/excel-export`) → save `QRC_Export.xlsx`. Returns
  `{ count }`; the card toasts "No active QRCs to export" on 0.

`components/exports/qrc-export-card.tsx` — Generate button, no options. Rendered on
`app/(app)/settings/exports/page.tsx` for all bases.

Pure helpers TDD'd in `tests/qrc-export.test.ts` (8 cases: flatten order, blank-label
skip, single column, sheet-name sanitize/cap/dedupe/fallback).

## Out of scope (YAGNI)

- Per-step numbering, notes, agency lists, conditional/narrative prefixes (label only).
- Per-QRC selection / filtering — exports all active QRCs.
- Execution data (responses/values) — this exports the template step text.
