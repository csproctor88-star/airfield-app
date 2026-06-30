# AMTR Record-Inspection & 1098 Completion Changes — Design

**Date:** 2026-06-30
**Module:** AMTR (Airfield Management Training Record)
**Status:** Draft for review

## Problem statement

Four related issues in the AMTR record-inspection and 1098 flows:

1. **Future-dated false positives in the auto-scan.** The records-inspection scan
   reports recurring 1098 monthly proficiency tests as "missing records" for months
   that have not happened yet (e.g. flagging September–December while it is June).
2. **Auto-scan discrepancies aren't editable.** Inspectors can override an item's
   Yes/No/N-A and add a note, but cannot edit the auto-generated finding *detail*
   text, and there is no dedicated corrective-action field.
3. **The auto 623a entry is generic.** On completion, the inspection writes a single
   `"… N gap(s) noted."` line and discards every per-item finding, detail, and note.
4. **1098 early completion requires a manual dance.** Completing a recurring item
   before its due date does not auto-stamp the completion or roll the due date; the
   training manager must hand-edit the *Last Completed* date, refresh, then sign.

## Scope

In scope: the four fixes below, their unit tests, and one display tweak to
`dueStatus`. Out of scope: the Selfridge 1098 catalog duplicate-row cleanup (a data
issue, tracked separately), FQ-definition changes, and any 623a/inspection schema
redesign beyond the additive fields named here.

---

## Part 1 — Period-aware "missing record" scan

### Current behavior

`lib/amtr/inspection-engine.ts:244–253`, rule **6.3** (`auto_key =
'1098_all_documented'`) is a pure presence check:

```ts
const documented = new Set(d.r1098Progress.map((p) => String(p.catalog_id)))
const missing = catalog
  .filter((c) => !documented.has(String(c.id)))
  .map((c) => String(c.task ?? c.id))
set('1098_all_documented', missing.length ? 'no' : 'yes',
    summarize(missing, '1098 requirement(s) with no record'))
```

No `today`/frequency/period awareness. The 1098 catalog
(`lib/amtr/data/recurring-1098.json`) seeds 12 literally month-named rows
("January Monthly Proficiency Test" … "December …"), so every not-yet-occurred
month with no progress row is reported missing.

### New behavior

Treat each recurring catalog item as covering a **period**, and flag a missing
record only when that period is **fully elapsed** as of `today` (decision:
"past, fully-elapsed months only" — the current month and future months are
never flagged).

**Period derivation (derived at scan time, no schema change):**

| Item | Period | "Fully elapsed" test |
|---|---|---|
| Monthly, month parseable from `task` name | that calendar month in `year_label` | last day of that month `< today` |
| Quarterly / Semi-Annual / Annual / Biennial / Triennial | the `year_label` span (calendar year) | last day of `year_label` `< today` |
| **Month name not parseable** (e.g. base renamed the row) | — | **fall back to the strict presence check** (flag if no progress row), decision per user |

Month parsing: case-insensitive match of a full English month name anywhere in the
`task` string (`/\b(january|february|…|december)\b/i`). `year_label` is the
4-digit year already stamped on each catalog row.

### New helper (in `lib/amtr/status.ts`, pure + unit-tested)

```ts
/** Calendar month index 1–12 parsed from a task label, or null. */
export function parseTaskMonth(task: string): number | null

/**
 * True when a recurring catalog item's period has fully elapsed as of `today`,
 * and we therefore *expect* a record. Returns true (= expect a record) for
 * items whose month/period cannot be derived (strict presence-check fallback).
 */
export function recurringPeriodElapsed(
  item: { task?: string | null; frequency?: string | null; year_label?: string | null },
  today: string,                       // YYYY-MM-DD
): boolean
```

Logic:
- Parse `year` from `year_label` (fallback: the year of `today` if absent).
- If `frequency === 'Monthly'` and `parseTaskMonth(task)` is non-null →
  period end = last day of `{year}-{month}`; return `periodEnd < today`.
- Else if a recognized non-monthly recurrence → period end = `{year}-12-31`;
  return `periodEnd < today`.
- Else (unknown frequency, or Monthly with no parseable month) → **return true**
  (strict presence check; the item is expected, flag if undocumented).

### Rule 6.3 rewrite

```ts
const documented = new Set(d.r1098Progress.map((p) => String(p.catalog_id)))
const missing = catalog
  .filter((c) => !documented.has(String(c.id)))
  .filter((c) => recurringPeriodElapsed(c, d.today))   // ← new gate
  .map((c) => String(c.task ?? c.id))
set('1098_all_documented', missing.length ? 'no' : 'yes',
    summarize(missing, '1098 requirement(s) with no record'))
```

### Worked example (today = 2026-06-30, year_label = 2026)

- January–May Monthly tests, no progress row → period end ≤ May 31 < today →
  **flagged**.
- June Monthly test, no progress row → period end June 30, `"2026-06-30" < "2026-06-30"`
  is false → **not flagged** (current month).
- July–December Monthly tests → period end in the future → **not flagged**.
- An Annual item with no progress row → period end Dec 31 2026 ≥ today → **not
  flagged** until the year elapses. (Consistent with "not yet due → not missing.")
- A renamed monthly row ("Recurring Prof Test #4") with no progress row →
  unparseable → **flagged** (strict fallback).

### Tests (`tests/amtr-inspection-engine.test.ts` + status tests)

- Future months not flagged; past months flagged; current month not flagged.
- Unparseable monthly name → flagged (fallback).
- Items *with* a progress row continue to flow through rule 6.1 unchanged.

---

## Part 2 — Editable discrepancies (Findings + Corrective Action)

### Current behavior

`InspectionItemResponse` (`lib/supabase/amtr-inspections.ts:12–18`) carries
`findings: string[]` (auto, read-only in the UI) and `note: string`. The inspect
page shows `⚠ {findings.join(' · ')}` as static text plus one note textarea.

### New behavior

Two editable fields per item, both persisted in the inspection `items` JSONB:

- **Detail / Findings** — seeded from the auto `findings`, now **editable**.
- **Corrective Action** — the inspector's field (renamed from "note"), filled in
  *after* the discrepancy is identified.

### Type change

```ts
export type InspectionItemResponse = {
  item_number: string
  status: 'yes' | 'no' | 'na' | null
  auto: 'yes' | 'no' | 'na' | null
  findings: string[]          // raw auto findings — kept as the immutable audit source
  detail?: string             // NEW: editable finding text (seeded from findings.join)
  correctiveAction?: string   // NEW: inspector corrective action
  note?: string               // DEPRECATED: read on load, migrated into correctiveAction
}
```

Back-compat read: when loading an existing inspection, if `detail` is absent seed
it from `findings.join(' · ')`; if `correctiveAction` is absent fall back to
`note`. No SQL migration — the column is JSONB and additive.

### UI (`app/(app)/amtr/[memberId]/inspect/page.tsx`, ~339–402)

- The static `⚠ findings` line becomes an editable **Detail** textarea
  (`defaultValue` seeded; debounced autosave via the existing `setItemNote`-style
  handler — generalize to `setItemField(itemNumber, field, value)`).
- Add a labelled **Corrective Action** textarea, auto-shown when `status === 'no'`.
- Both disabled when `status === 'completed'` (Reopen to edit), same as today.
- Per the project convention, every save path toasts on error (no silent failures).

---

## Part 3 — Auto 623a entry from the records-inspection template

### Current behavior

`completeAmtrInspection` (`amtr-inspections.ts:103–131`) writes:

```ts
const summary = `Monthly training records inspection completed${name?…}. ${gap} gap(s) noted.`
upsertAmtrRow('amtr_623a', { …, entry_type: 'Monthly Training Records Inspection', namt_comment: summary })
```

### New behavior

Compose `namt_comment` from the `recordsInspection` DAFMAN template
(`lib/amtr/reference-data.ts:190–196`) + the per-item discrepancy data.

**New pure helper (unit-tested), e.g. in `lib/amtr/inspection-623a.ts`:**

```ts
export function buildInspection623aComment(input: {
  inspectionDate: string
  inspectorName?: string | null
  items: InspectionItemResponse[]
}): string
```

Output format (decision-approved):

```
(Monthly Training Records Inspection — IAW DAFMAN 13-204v2 Para 2.6.2.8)

Inspection Date: 2026-06-30
Inspector: SMSgt C. Proctor

Discrepancies (2):
6.3 — 1098 recurring: missing Jan, Mar Proficiency Test.
      Corrective Action: counseled; due by 15th.
4.1 — 623a quarterly entry overdue.
      Corrective Action: entry made 30 Jun.
```

- Discrepancy lines = items with `status === 'no'`, each `{item_number} — {detail ||
  findings.join(' · ')}` followed by an indented `Corrective Action: {correctiveAction}`
  line when present.
- Zero discrepancies → `"No discrepancies noted."` under the same header.
- The template header/cite is pulled from the `recordsInspection` entry so a future
  cite change propagates. Inspector name and date come from the inspection.
- `entry_type` stays `'Monthly Training Records Inspection'`; satisfies scan rule
  4.12. PDF archive to Files (`inspect/page.tsx:218–224`) is unchanged.

`completeAmtrInspection` swaps the inline `summary` string for
`buildInspection623aComment({ inspectionDate, inspectorName: completed_by_name, items })`.

---

## Part 4 — 1098 early completion on Cert Official signature

### Current behavior

- Certifier sign on a 1098 row (`app/(app)/amtr/[memberId]/page.tsx:217–219`)
  already opens the `Auto623aDialog` to create the source-linked 623a entry — this
  is the existing "623a on completion" mechanism, and it stays.
- But `amtr_sign` (RPC) stamps only initials. The due-advance + rollover logic
  lives **only** in `setField`'s `last_completed` branch
  (`components/amtr/form1098-tab.tsx:279–329`), behind a `next_due_manual` guard.
- Uncontrolled `defaultValue` inputs require a refresh to reflect a change.

### New behavior

**4a. Certifier signature auto-completes the 1098 item.** When the `certifier`
slot is signed on a 1098 row, in addition to the initials + the existing 623a
dialog, write:

- `last_completed = today`
- `next_due = computeNextDue(today, frequency)`
- `next_due_manual = false`
- run the same later-year rollover seeding as the `last_completed` path.

Implementation: extract the body of `setField`'s `last_completed` branch
(recompute + rollover, lines 279–329) into a reusable `completeItem(catId,
freq, completedDate)` function in `form1098-tab.tsx`, and call it from the 1098
certifier-sign `onSigned` callback. Trainee signature stays initials-only. The
generic `amtr_sign` RPC is **not** changed (avoids side effects on other forms);
the completion write is a follow-up `upsertAmtrRow('amtr_1098_progress', …)` from
the client, consistent with how `setField` already writes.

**4b. Manual Last Completed edit always recomputes.** Remove the
`next_due_manual` guard on the `last_completed` path (`form1098-tab.tsx:283`) so
typing a completion date always recomputes `next_due` and clears the manual flag.
The explicit Due-cell override still exists for a deliberate custom due set
*after* completing; `resetAutoDue` is retained.

**4c. No-refresh status flip.** After the completion write resolves, the row must
reflect the new `last_completed` / `next_due` without a manual refresh. `onChange()`
already reloads the tab; ensure the reload re-keys the affected inputs (the row
`key` already encodes `last`/`next`, `form1098-tab.tsx:502,511`) so the status pill
flips immediately. If reload latency is visible, apply an optimistic local patch to
`progByCat` before the awaited reload.

**4d. Completion logging.** Satisfied by the existing certifier `signed_by` /
`signed_at` stamp + the auto-623a dialog entry. No new audit mechanism.

### Open decision — Monthly status display (`dueStatus`)

For Monthly items, `next_due = last_completed + 1 month` is ~28–31 days out.
`dueStatus` returns `due_soon` whenever the due is within `DUE_SOON_DAYS` (30),
**even when completed** (`status.ts:76`). So a freshly-completed monthly item may
read "Due Soon" instead of "Complete."

**Recommended fix:** prefer `complete` when a completion satisfies the current
cycle. Change `dueStatus` so that, when `due` is in the future and a `completedDate`
exists, it returns `complete` rather than `due_soon`:

```ts
if (due) {
  const delta = daysBetween(todayUtc, due)
  if (delta < 0) return completed && daysBetween(due, completed) >= 0 ? 'complete' : 'overdue'
  if (completed) return 'complete'          // current cycle satisfied; next due is in the future
  if (delta <= DUE_SOON_DAYS) return 'due_soon'
  return 'upcoming'
}
```

**Blast radius:** `dueStatus` is shared by the 1098 tab, RAT, reports roll-up, and
notification reconciliation. This changes the meaning of "due soon" for recurring
items: a completed item no longer warns until its next due actually passes. Net
effect aligns with the "completed = Complete" expectation but suppresses the early
"next cycle coming up" nudge. **This is the one decision to confirm at review** —
ship the `dueStatus` change, or leave it and accept that monthly items read "Due
Soon" right after completion.

---

## Phasing

1. **Part 1** — scan period-awareness (`status.ts` helper + rule 6.3 + tests).
   Self-contained; ship first.
2. **Part 2** — editable detail + corrective action (type + inspect-page UI).
3. **Part 3** — `buildInspection623aComment` + wire into `completeAmtrInspection`.
   Depends on Part 2's `detail`/`correctiveAction` fields.
4. **Part 4** — certifier-sign completion + manual recompute + no-refresh
   (+ optional `dueStatus` tweak pending the open decision).

Each phase is independently buildable and review-gated.

## Verification

- `npx tsc --noEmit`, `npx vitest run`, `npm run build` all green (commit gate).
- New unit tests: `recurringPeriodElapsed` / `parseTaskMonth`, rule 6.3 month
  boundaries, `buildInspection623aComment` formatting, and (if shipped) the
  `dueStatus` completed-future-due case.
- Manual smoke after promotion: scan a record mid-year (no future months flagged),
  edit a discrepancy detail + corrective action, complete → verify the 623a entry
  text, and certify-sign a 1098 item → verify Last Completed + Due roll without a
  refresh.
