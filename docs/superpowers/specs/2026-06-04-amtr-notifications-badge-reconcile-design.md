# AMTR notifications — sidebar badge + daily fleet reconcile

**Date:** 2026-06-04
**Status:** Approved (design), pending implementation plan
**Module:** AMTR (`/amtr`), sidebar, new cron route

## Problem

Two gaps:

1. **No at-a-glance signal.** A user with actionable training items (overdue
   training, a signature they owe) has no indication outside the AMTR module.
   PPR/QRC/Discrepancies have sidebar badges; AMTR does not.
2. **Notifications are generated lazily and incompletely.** `training_due`
   alerts (1098 + RAT) only fire when a human opens that member's tab
   (reconcile-on-mount in `form1098-tab.tsx` / `rat-tab.tsx`). `entry_623a`
   ("Signature required – 623A") is defined but **never fired**. JQS and Formal
   have no due/overdue notification. So an overdue member can have an empty
   notification list — and therefore an empty badge — until someone opens their
   record.

## Goals (from brainstorming)

- A **yellow/amber sidebar badge** on `/amtr` whose count **mirrors the
  Notifications section** — the current user's non-dismissed `amtr_notifications`.
- A **daily fleet reconcile** that populates the table for **every** member so
  the badge/section reflect reality without anyone opening a record. It covers:
  - **Due/overdue** items (1098 + RAT) → notified to the **training team**
    (trainee + Trainers/NAMT/AFM), as today's `fireToTrainingTeam`.
  - **Items missing the trainee's signature** across **JQS, 1098, 797, 623A** →
    notified to the **trainee only**, honoring the full inspection-engine
    signing rules (caret convention, skill level, required flag, transcribe
    waiver, source-linked exclusion, currently-due gate).
- The reconcile also **auto-resolves** (dismisses) notifications whose item is
  no longer due / now signed, so the badge falls on its own.

## Non-goals (YAGNI)

- No email from the reconcile (the civilian §139.303 digest owns training email).
- No JQS/Formal *due/overdue* notifications (those forms aren't time-recurring;
  JQS appears only in the signature scan).
- No change to the existing event-driven fires (`signoff`, `item_797_added`,
  `signature_797`) — they already work on the action.

## Architecture

### Part A — Badge (client)

- `lib/supabase/amtr.ts`: `fetchAmtrNotificationCount()` — a `head: true`,
  `count: 'exact'` query on `amtr_notifications` where `dismissed_at is null`.
  RLS already restricts SELECT to `recipient_user_id = auth.uid()`, so no extra
  filter is needed; the count is inherently the current user's.
- `hooks/use-sidebar-badge-counts.ts`: add `amtr` state, gated on
  `PERM.AMTR_VIEW`; fetch in `refresh()`; add an `amtr_notifications` realtime
  subscription (filtered by `recipient_user_id=eq.<uid>`); include in `total`.
- `components/layout/sidebar-nav.tsx`: amber dot on `href === '/amtr'` (same
  markup as the PPR/QRC dot but `var(--color-warning)`), "9+" cap, plus an
  expanded-state "N" label. The Operations/Training section-header rollup
  includes `amtr` like the others.
- `components/amtr/notification-center.tsx`: after `dismiss()`, dispatch
  `window.dispatchEvent(new Event('glidepath:badges-refresh'))` so the dot
  clears instantly.

### Part B — Pure compute functions (no I/O, unit-tested)

Co-located with `lib/amtr/inspection-engine.ts` so the signing rules cannot
drift from the Inspect-record view (per `feedback_audit_invariant_guard_test`
and the engine's "mirror of the member record" invariant).

```ts
// Due/overdue items for the team notification (1098 + RAT).
export function dueItemsForMember(d: InspectionScanData): {
  tab: '1098' | 'rat'; itemId: string; itemName: string; dueISO: string
}[]

// Items awaiting the TRAINEE's initials across JQS / 1098 / 797 / 623A.
// Reuses the engine's eligibility filters (live/required/skill-level/caret for
// JQS; manual + non-transcribed for 623A; started for 797; completed-and-
// currently-due for 1098) but checks only `trainee_initials`.
export function traineeSignatureGaps(d: InspectionScanData): {
  tab: 'jqs' | '1098' | '797' | '623a'; itemId: string; itemName: string
}[]
```

`dueItemsForMember` honors `ratApplies` (Civilian/Contractor/Separated skip RAT).
Both take the same `InspectionScanData` the inspection already builds.

### Part C — Fleet reconcile cron

`app/api/amtr-due-reconcile/route.ts`, modeled on
`app/api/training-expiry-digest/route.ts`:

- **Auth**: `Authorization: Bearer ${CRON_SECRET}` (Vercel cron sets it).
- **Client**: `@supabase/supabase-js` with `SUPABASE_SERVICE_ROLE_KEY` — bypasses
  RLS so it can read every base's records and write/dismiss notifications (the
  table's INSERT/UPDATE policies require `amtr:write` / recipient identity,
  which a cron has neither of; service-role is the intended path).
- **Schedule**: new `vercel.json` entry, `"0 12 * * *"` (daily, ahead of the
  13:00/13:30 digests).
- **Per base** (bases with AMTR enabled): bulk-fetch the catalogs once and each
  progress table filtered by `base_id` in a single query, plus
  `amtr_role_assignments` and the `transcribe`-action `amtr_audit_log` row ids;
  group by `member_id` in memory to assemble `InspectionScanData` per member
  (avoids N×~13 round-trips).
- **Produce notifications**:
  - For each `dueItemsForMember` result → `training_due` to trainee + every
    Trainer/NAMT/AFM, `dedupe_key = training_due:<tab>:<itemId>:<uid>`.
  - For each `traineeSignatureGaps` result → `signature_required` to the trainee,
    `dedupe_key = signature_required:<tab>:<itemId>`.
  - Upsert with `onConflict: recipient_user_id,dedupe_key, ignoreDuplicates`
    (idempotent; never resurrects a manually-dismissed row).
- **Auto-resolve**: load the base's non-dismissed `training_due` /
  `signature_required` rows; for any whose `(tab,itemId)` is no longer in the
  freshly-computed set for that member, set `dismissed_at = now()`.
- **`today`**: UTC date (`new Date().toISOString().slice(0,10)`) — exactly what
  the Inspect page (`amtr/[memberId]/inspect/page.tsx`) supplies to the engine,
  so the reconcile's due/currently-due decisions match the on-screen view.
- Returns a JSON summary (bases processed, created, resolved, errors) like the
  digest route.

### Part D — New notification kind

- Migration `2026062009_amtr_signature_required_kind.sql`: drop and re-add the
  `amtr_notifications_kind_check` CHECK to include `'signature_required'`.
- `AmtrNotificationKind` union (`lib/supabase/amtr.ts`) gains
  `'signature_required'`; `KIND_COLOR` (`notification-center.tsx`) maps it to
  `var(--color-danger)`.
- Body format: `Signature required – <form> – <item>`; `target_tab` routes to
  the form, `target_item_id` deep-links the item.
- The dead `entry_623a` kind is superseded by `signature_required` (left in the
  CHECK list for any historical rows; no new code fires it).

## Data flow

```
Vercel cron (daily 12:00 UTC)
  → POST /api/amtr-due-reconcile  (CRON_SECRET)
     → service-role client
        per base:
          bulk-fetch catalogs + progress + roles + transcribed ids
          group → InspectionScanData per member
            dueItemsForMember()      → training_due       → team
            traineeSignatureGaps()   → signature_required → trainee
          upsert (dedupe) + auto-resolve stale
client:
  useSidebarBadgeCounts → fetchAmtrNotificationCount() (RLS = my rows)
     → amber dot on /amtr ; realtime + 60s poll + badges-refresh event
  NotificationCenter dismiss → badges-refresh
```

## Testing

- `dueItemsForMember` — due/overdue detection; RAT exemption by member status;
  not-yet-due (`next_due` future) excluded.
- `traineeSignatureGaps` — per form: flags missing trainee initials; respects
  retired, transcribed/historical 623A, source-linked 623A, JQS skill-level +
  required + caret exclusions, 797 started gate, 1098 currently-due gate; does
  **not** flag items the trainee has already signed.
- A guard assertion that a fully-signed, current member yields zero gaps (the
  "no false positives" invariant).
- Build/verify gates: `tsc --noEmit`, `vitest run`, `npm run build` rc 0;
  migration applied via `db query --linked --file`.

## Rollout / safety

- Additive migration (CHECK extension) — no data change, safe under
  expand/contract.
- Cron is idempotent and side-effect-bounded (only writes/dismisses
  `amtr_notifications`); a bad run can be re-run.
- First production run will create a backlog of legitimately-due /
  missing-signature notifications fleet-wide — expected, and the point.
