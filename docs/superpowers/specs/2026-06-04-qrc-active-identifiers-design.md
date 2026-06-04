# QRC Active-list identifiers — design

**Date:** 2026-06-04
**Status:** Approved (design), pending implementation
**Module:** QRC (`app/(app)/qrc/page.tsx`, `app/(app)/dashboard/page.tsx`, `lib/qrc-pdf.ts`)

## Problem

The "Active" QRC list shows only the QRC number, the template title, and the
opened time. When several QRCs are open at once — or one stays open for an
extended period while the user works elsewhere — there's no way to tell which
is which. Two active In-Flight Emergencies look identical.

## Goal

Give every active QRC a distinguishing identifier with **no extra typing in the
common case**, while still allowing a manual label for QRCs that have no natural
field or when the user wants a custom tag.

## Decisions (from brainstorming)

- **Hybrid:** auto-derive an identifier from existing field data; a manual
  "Label" field overrides it.
- **Auto rule is convention-based (zero-config)** so it works on edited/custom
  templates without admin setup:
  - SCN-form QRCs → `scn_data.call_sign` (append ` / ${type_of_aircraft}` when
    present).
  - All other QRCs → the first `fill_field` (in render order, sub-steps
    included) that has a value.
  - Nothing filled yet → empty (row renders as it does today).

## Data model

One additive column (nullable), applied via `db query --linked --file` per the
project's no-tracker convention:

```sql
-- supabase/migrations/2026062008_qrc_execution_label.sql
ALTER TABLE qrc_executions ADD COLUMN IF NOT EXISTS label TEXT;
```

`label` stores **only** the manual override. The auto value is computed on the
fly and never persisted, so it always reflects current field data. Existing RLS
row policies cover the new column. No backfill.

Types: add `label: string | null` (Row) and `label?: string | null`
(Insert/Update) to `qrc_executions` in `lib/supabase/types.ts`.

## Auto-derive helper

New `lib/qrc/identifier.ts`, shared by the QRC page, dashboard, and PDF:

```ts
export function deriveQrcIdentifier(
  execution: Pick<QrcExecution, 'label' | 'scn_data' | 'step_responses'>,
  template: Pick<QrcTemplate, 'has_scn_form' | 'steps'> | null | undefined,
): string {
  if (execution.label?.trim()) return execution.label.trim()          // manual wins
  if (template?.has_scn_form) {
    const scn = (execution.scn_data || {}) as Record<string, unknown>
    const cs = String(scn.call_sign ?? '').trim()
    const ac = String(scn.type_of_aircraft ?? '').trim()
    if (cs) return ac ? `${cs} / ${ac}` : cs
  }
  const resp = (execution.step_responses || {}) as Record<string, QrcStepResponse>
  for (const step of flattenSteps(template?.steps ?? [])) {
    if (step.type === 'fill_field') {
      const v = String(resp[step.id]?.value ?? '').trim()
      if (v) return v
    }
  }
  return ''
}
```

`flattenSteps` is the same depth-first walk already used in the page/PDF (parent
then sub-steps). Callers truncate the display string to ~40 chars.

## CRUD

Add `updateExecutionLabel(executionId, label)` to `lib/supabase/qrc.ts`,
mirroring the existing `updateExecutionRemarks` (nullable on empty, bumps
`updated_at`).

## UI

1. **Label input** — a compact "Label (optional)" text field pinned at the top
   of the open QRC execution view (`QrcExecutionView`), above the steps.
   Autosaves on blur (same pattern as the remarks box). Placeholder shows the
   current auto-derived value as a greyed hint, so the user sees what the list
   will display and can override it. Read-only display when the QRC is closed.

2. **Active list + History rows** (`qrc/page.tsx`) — render the derived
   identifier as a distinct emphasized line under the title (bold, amber).
   Empty identifier → row is unchanged from today.

   ```
   [1]  In-Flight Emergency        ● Open
        REACH471 / C-17                       <- identifier
        🕐 Opened 1432Z
   ```

3. **Dashboard "Active QRCs" widget** (`dashboard/page.tsx`) — show the derived
   identifier in the open-execution list (display only; label editing stays on
   the full QRC page).

4. **Closed-QRC PDF** (`lib/qrc-pdf.ts`) — print the identifier in the header
   block beneath the title.

## Out of scope (YAGNI)

- No per-field designation UI or new template step flags.
- No backfill migration (auto-derive covers existing open QRCs immediately).
- No label editing from the dashboard widget.

## Edge cases

- Two active QRCs with the same number are distinguished by identifier; if two
  share the same identifier, opened-time still disambiguates.
- Editing a template field that fed the auto value simply re-derives on the next
  render — nothing stored to go stale.
- `time_field` steps are intentionally excluded from the auto rule (a time is a
  poor identifier).

## Verification

`tsc --noEmit` clean · QRC + PDF tests pass · `npm run build` rc 0 · migration
applied live. A unit test for `deriveQrcIdentifier` covers: SCN call-sign,
call-sign + type, first-fill-field, manual override precedence, and the
empty case.
