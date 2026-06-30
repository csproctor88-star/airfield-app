# Inspections Analytics Enrichment (#36) — Design

**Date:** 2026-06-30
**Module:** Dashboard analytics — Inspections dataset
**Status:** Draft for review

## Goal

Let users chart inspection **pass/fail rate**, **who completed how many**, and **how
often discrepancies are found** — directly from the existing Analytics widget. Purely
additive to the inspections analytics dataset; no schema change, no inspection-flow
change.

## Scope

One file: `lib/dashboard/analytics/datasets/inspections.ts` (+ a small unit test).
All three metrics are exposed as **dimensions** grouped by the existing `count` measure
— no new measure or percent-formatter (the grouped donut/bar *is* the rate).

## Non-goals

- Precise discrepancy↔inspection linkage. `discrepancies.inspection_id` exists but is
  never populated; "discrepancies found" uses the **`failed_count > 0` proxy** (decided),
  which works on all historical data with no flow change.
- New measures / percent formatting (YAGNI — grouping conveys the rate).

## Data source

`fetchRows` already queries `inspections` and maps rows. Today it selects
`id, inspection_type, status, inspection_date, started_at, filed_at, created_at` and
computes `duration_minutes`. These columns also exist on the table and will be added to
the `select`: `passed_count, failed_count, na_count, completed_by_name, inspector_name`.
(`completed_by_id` is available too but the denormalized `*_name` fields are what we
display, so the ids aren't needed.)

## Derived fields — pure helper

Extract a pure, unit-tested helper so the classification logic is testable without
Supabase:

```ts
export function deriveInspectionFields(row: {
  status?: string | null
  failed_count?: number | null
  completed_by_name?: string | null
  inspector_name?: string | null
}): { inspector: string; result: 'pass' | 'fail' | 'in_progress'; found_discrepancies: 'yes' | 'no' } {
  const failed = Number(row.failed_count ?? 0)
  const completed = row.status === 'completed'
  return {
    inspector: (row.completed_by_name || row.inspector_name || '—'),
    result: completed ? (failed > 0 ? 'fail' : 'pass') : 'in_progress',
    found_discrepancies: failed > 0 ? 'yes' : 'no',
  }
}
```

`fetchRows` spreads `deriveInspectionFields(r)` onto each mapped row (alongside the
existing `duration_minutes`).

## Dataset additions

**Dimensions** (added to the existing three — `inspection_type`, `status`, `month`):
- `{ key: 'inspector', label: 'Completed By' }`
- `{ key: 'result', label: 'Result' }`
- `{ key: 'found_discrepancies', label: 'Discrepancies Found' }`

**Filters** (added to the existing `inspection_type`, `status`) — these double as the
label maps the `runQuery` dimension formatter uses, so grouped charts render friendly
labels:
- `result` → `pass`/Pass, `fail`/Fail, `in_progress`/In Progress
- `found_discrepancies` → `yes`/Found, `no`/None

**Measures:** unchanged (`count`, `avg_duration`). `getDimensionValue` is unchanged
(default `String(row[dimKey])` handles the new string fields; the `month` special-case
stays).

## Resulting user recipes (no UI work — existing Analytics widget)

- "Inspections by **Completed By**", bar → who did how many.
- "Inspections by **Result**", donut → pass vs fail proportion (filter `status=completed`
  for a clean split).
- "Inspections by **Discrepancies Found**", donut → how often an inspection turned up a
  discrepancy.

## Testing

New `tests/dashboard-inspections-dataset.test.ts`:
- `deriveInspectionFields`: completed + failed_count 0 → pass; completed + failed_count>0
  → fail; in_progress → in_progress; found_discrepancies yes/no; inspector falls back
  `completed_by_name` → `inspector_name` → `—`.

Verify `npx tsc --noEmit`, `npx vitest run`, `npm run build`.

## Verification

After promotion: build the three charts above in an Analytics widget and confirm the
groupings, labels (Pass/Fail/In Progress, Found/None), and counts are sensible.
