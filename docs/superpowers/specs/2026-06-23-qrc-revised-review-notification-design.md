# QRC "Revised — Needs Review" Notification — Design Spec

**Date:** 2026-06-23
**Status:** Approved (design) — pending implementation plan
**Author:** Session work (Glidepath)

## Summary

Surface the existing per-user *revised-since-your-last-review* signal for QRC
templates as a proactive **amber** notification, so reviewers catch a QRC that
was revised **between** the required quarterly reviews instead of waiting for
the next quarterly cycle. The notification appears in two places:

1. An **amber dot** on the `/qrc` sidebar entry.
2. An **amber "Revised — review needed" marker** on the affected QRC card in the
   Available tab.

No new review logic and no schema changes — the signal is the existing
`getMonthlyReviewStatus(...).state === 'updated'` case, just surfaced where it
wasn't before.

## Background

`getMonthlyReviewStatus` (`lib/qrc/monthly-review-status.ts`) already computes a
per-user, per-template state: `never | overdue | updated | current`, where
**`updated`** means *the user has reviewed this QRC before AND the template's
`updated_at` is newer than that review* — i.e. the template was revised since
they last signed off. Today that state is only reflected in the `/qrc` **Reviews
tab** count (`reviewsDueCount`, which lumps `never` + `overdue` + `updated`).
There is no proactive nudge: a reviewer must open the Reviews tab to discover a
mid-cycle revision.

The `/qrc` sidebar dot is currently **red** and means something different —
`fetchActiveQrcCount` (QRCs currently being *run*, i.e. open `qrc_executions`).

## Goals

- A reviewer sees an amber dot on `/qrc` when a QRC they previously reviewed has
  been revised and they haven't re-reviewed the new version.
- The specific revised QRC is marked amber in the Available list.
- The signal clears automatically when they mark it reviewed.

## Non-Goals

- No change to the quarterly/monthly cadence logic or the Reviews-tab count.
- `overdue` and `never` keep their current treatment (Reviews tab); amber is
  **exclusively** the mid-cycle `updated` case.
- No new table, column, or migration.
- No change to who can edit/revise templates.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Where | Sidebar `/qrc` dot **and** a per-QRC card marker in the Available tab |
| Trigger | Only mid-cycle revisions — `getMonthlyReviewStatus().state === 'updated'`. Not `overdue`/`never`. |
| Color | **Amber** (routine action owed — matches AMTR's amber "training action needed"). Avoids the green = "done/verified" conflict and the red = "active execution" collision. |
| Sidebar priority | Active executions (red) outrank revised-review (amber): `red > amber`. One dot. |
| Audience | Per **current user**; gated on **`qrc:execute`** (the reviewer permission — AFM / NAMO / AMOPS). |

### Color rationale (recorded so it doesn't look like an oversight)
App convention: **red** = action-required / in-progress, **amber** = a routine
action you owe (AMTR), **green** = work done awaiting verification
(Discrepancies). A revised QRC needing re-review is a routine compliance action,
so amber is the correct tier. It also slots into the **existing** sidebar
section-header priority hierarchy, already coded as `red > amber > green`.

## Trigger semantics (precise)

For the signed-in user at the current base, a QRC template contributes to the
amber signal when **all** hold:

- The template is **active** (`is_active = true`).
- The user has **at least one prior review** of it (`qrc_monthly_reviews` row).
- The template's `updated_at` is **strictly newer** than that latest review's
  `reviewed_at` — i.e. `getMonthlyReviewStatus(template, latestReview).state === 'updated'`.

A user who has **never** reviewed a template yields `never`, not `updated`, so
brand-new templates do not produce the amber signal (they surface through the
existing Reviews-tab "never" path). This is intentional — amber means
"something you'd signed off on has changed."

## Components

### 1. Data — `lib/supabase/qrc-reviews.ts`
- **Pure helper** `countRevised(templates, reviewsByTemplate)` → number.
  Iterates active templates, looks up the user's latest review per
  `template_id`, returns the count whose `getMonthlyReviewStatus` is `updated`.
  Unit-tested in isolation (no Supabase).
- **`fetchRevisedQrcCount(baseId, interval?)`** — fetches active templates
  (`fetchQrcTemplates`) + the user's reviews (`fetchUserReviews`, already
  collapses to latest-per-template), then returns `countRevised(...)`.

### 2. Sidebar badge — `hooks/use-sidebar-badge-counts.ts`
- Add `qrcRevised` state, populated by `fetchRevisedQrcCount(installationId)`
  **only when** `has(PERM.QRC_EXECUTE)` (else 0).
- Realtime subscriptions: `qrc_templates` and `qrc_monthly_reviews` (both
  base-filterable) → `refresh()`.
- Return `qrcRevised`; include it in `total`.

### 3. Sidebar dot — `components/layout/sidebar-nav.tsx`
- `/qrc` dot precedence (one dot):
  - `badgeCounts.qrc > 0` (active executions) → **red** (existing block, unchanged).
  - else `badgeCounts.qrcRevised > 0` → **amber** dot with count; open-state
    label `"{n} revised"`.
- Section-header aggregate: add `qrcRevised` to the section total; amber tier
  (the existing `red > amber > green` logic already handles precedence — list it
  alongside the AMTR amber contribution).

### 4. Per-QRC card marker — `app/(app)/qrc/page.tsx`
- The Available tab already computes `monthlyReviews.getStatus(t)` per template.
- When `status.state === 'updated'`, render an amber **"Revised — review needed"**
  pill on that QRC's card/row.
- Add a `revised` kind to the `PILL` map (amber tokens, mirroring the existing
  `open` amber pill) so `StatusPill` can render it.

## Clearing

Marking the QRC reviewed (`markReviewed`) inserts a fresh `qrc_monthly_reviews`
row with `reviewed_at = now()` (newer than `updated_at`), so the status flips to
`current`, the card pill disappears, and the sidebar count drops. The badge
updates via the realtime subscription on `qrc_monthly_reviews` and the existing
`glidepath:badges-refresh` window event (the review action can dispatch it for
instant feedback).

## Testing

- **Unit:** `countRevised` — partitions a fixture of templates + reviews into
  updated (counts) vs current / never / overdue (don't count); verifies an
  `updated_at` older than the review does not count, and newer does.
- **Build gate:** `npx tsc --noEmit` + `npx vitest run` + `npm run build` RC 0.
- **Manual:** as a `qrc:execute` user who has reviewed QRC-N, edit QRC-N
  (bumps `updated_at`) → amber dot on `/qrc` + amber pill on QRC-N's card; mark
  reviewed → both clear. Confirm an actively-running QRC still shows red
  (red outranks amber).

## Files

**Modified**
- `lib/supabase/qrc-reviews.ts` — `countRevised` + `fetchRevisedQrcCount`.
- `hooks/use-sidebar-badge-counts.ts` — `qrcRevised` count + realtime.
- `components/layout/sidebar-nav.tsx` — amber `/qrc` dot (priority below red) +
  section aggregate.
- `app/(app)/qrc/page.tsx` — amber `revised` PILL + render on `updated` cards.

**New**
- `tests/qrc-revised.test.ts` — `countRevised` unit tests.

## Risks / notes

- **No schema/migration** — derives entirely from `qrc_templates.updated_at` +
  `qrc_monthly_reviews`.
- `updated_at` must actually bump when a template is revised. The existing
  monthly-review "Updated since review" banner already relies on this, so it's
  established behavior — but the plan should confirm template edits touch
  `updated_at` (they do via the `updateQrcTemplate` path).
- Amber on `/qrc` is a new meaning for that nav entry (previously only red).
  Documented above; consistent with AMTR's amber.
