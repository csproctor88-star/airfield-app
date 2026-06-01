# PPR — Notify Coordinated Agencies of Changes (design)

**Date:** 2026-06-01
**Status:** Approved (design); ready for implementation

## Context

When AMOPS edits a PPR after coordinating agencies have already coordinated on it
(updating dates/times, requested parking, the request itself, etc.), those agencies
have no way to learn the details changed. They coordinated on stale information.
This adds an **informational** notification — *not* a re-coordination — so coordinated
agencies always have the most recent PPR details.

This reuses the existing agency-notification machinery already used for
approve / deny / cancel (`notifyCoordinatingAgencies()` in `lib/ppr-agency-notify.ts`,
sent via the `send-ppr-*` Resend routes).

## Decisions (locked with the user)

- **Recipients:** default to agencies that have already coordinated (coordination row
  `status IN ('concur','non_concur')`), but the send dialog lets AMOPS add/remove
  agencies (including still-pending ones) for that specific notice.
- **Trigger:** **prompt on save.** After an edit to a PPR with ≥1 coordinated agency and
  a substantive change, a dialog asks whether to notify. Nothing auto-sends.
- **Email content:** **what changed (before → after) + full current PPR details.**

## Behavior

### Trigger
In the PPR edit save handler (`handleSave` in `app/(app)/ppr/page.tsx`), after
`updatePprEntry()` succeeds:
1. Compute the change set (see below) from the pre-edit `editingEntry` vs the saved values.
2. Load the entry's coordination rows (`fetchPprCoordination(entryId)`).
3. If there is ≥1 row with `status IN ('concur','non_concur')` **and** the change set is
   non-empty → open the **Notify Coordinated Agencies** dialog. Otherwise close as today.

The "added new agencies" path (`addPprCoordinationAgencies`, which reverts the PPR to
`pending_coordination`) is unchanged and independent of this informational notice.

### Change set (the diff)
`lib/ppr-changes.ts` — pure function, unit-tested:

```ts
type PprChange = { label: string; from: string; to: string }
function computePprChanges(
  before: { arrival_date; column_values; notes },
  after:  { arrival_date; column_values; notes },
  columns: PprColumn[],
): PprChange[]
```

- **Arrival date** → label "Arrival Date", values formatted as the UI shows them.
- **Each custom column** → label = column display name, `from`/`to` via the existing
  `formatPprColumnValue()` SoT (so "Parking: Apron A → Apron B" matches the board).
  Only columns whose formatted value changed are included.
- **Notes** → label "Notes"; if long, summarize as before/after text (or "(updated)").
- **`approver_oi` is excluded** — internal AMOPS field, not relevant to agencies.
- Returns `[]` when nothing substantive changed → no prompt.

### Dialog (`app/(app)/ppr/page.tsx` + a new dialog component)
- **Change summary:** each `PprChange` rendered as `label: from → to`.
- **Recipients:** checklist of the entry's coordinating agencies. Agencies that
  coordinated are pre-checked and show their concur/non-concur status; pending agencies
  are listed unchecked. Agencies with no `ppr_agency_members` are flagged "no recipients"
  and disabled.
- **Actions:** **Send Update** (POST to the route below) · **Skip** (close).

### Send route — `app/api/send-ppr-update/route.ts`
Mirrors `app/api/send-ppr-coordination-request/route.ts`:
- Auth-gated (authenticated user; RLS protects reads).
- Body: `{ entryId: string, agencyIds: string[], changes: PprChange[] }`.
- Fetches the entry + base, then calls the extended `notifyCoordinatingAgencies()` with
  `outcome: 'updated'`, the `changes`, and `agencyIds` to scope recipients.
- Returns `{ success, sent, skipped }`.

### Email path — extend `lib/ppr-agency-notify.ts`
Add to `notifyCoordinatingAgencies()`:
- `outcome: 'updated'` (alongside approved/denied/canceled).
- `changes?: PprChange[]` — rendered as a "What changed" block.
- `agencyIds?: string[]` — when provided, scope recipients to these agencies instead of
  all coordination rows.

Email (per agency, to its members):
- **Subject:** `"{Base} PPR UPDATED — {PPR#} ({Agency})"`
- **Body:** "AMOPS updated this PPR. This is for your awareness — no action needed." +
  the **What changed** block (before → after) + the **current PPR details**
  (requester, arrival date, all columns, notes).
- **From:** `"{Base} AMOPS <info@glidepathops.com>"`, **Reply-To:** `bases.amops_email`,
  **CC:** amops_email if set.
- **No deep links** (Defender/.mil constraint, same as the other PPR emails).
- Plain-text + HTML alternatives.
- **Coordination status is NOT modified.**

## Components / units

- `lib/ppr-changes.ts` — `computePprChanges()` (pure, testable). What it does: diff two
  PPR field sets into human-readable changes. Depends on `formatPprColumnValue` + columns.
- `lib/ppr-agency-notify.ts` — extended notifier (reuse). Depends on Supabase reader,
  Resend, base/entry.
- `app/api/send-ppr-update/route.ts` — thin HTTP wrapper. Depends on the notifier.
- PPR page dialog — recipient checklist + change summary + send.

## Error handling
- Send is best-effort/fire-and-not-block: a failed email surfaces a toast but never
  reverts the save (the edit already succeeded). Per-agency failures are reported in
  `skipped` (e.g. `no_coordinators`).
- If the route can't load the entry/base → 4xx with a friendly message; dialog shows a
  toast and stays open so AMOPS can retry or skip.

## Testing
- `tests/ppr-changes.test.ts` — `computePprChanges`: changed/unchanged columns, arrival
  date change, notes change, multi-field, formatting via `formatPprColumnValue`, empty
  result when nothing changed, `approver_oi` ignored.
- Email-builder smoke for the `'updated'` outcome (subject + body include the change
  block + current details; no deep link).
- Manual: edit a coordinated PPR on the deploy, confirm the prompt, pick recipients,
  confirm the email content and that coordination status is unchanged.

## Out of scope
- Persisted PPR edit history / diff table (the activity log already records the edit fact).
- Auto-send without a prompt.
- Re-coordination workflow changes.
