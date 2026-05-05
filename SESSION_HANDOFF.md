# Session Handoff

**Date:** 2026-05-04
**Branch:** `main`
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓, `npx vitest run` ✓ (253 pass)
**HEAD:** `297b6c7` (origin/main)

---

## What shipped this session

Three threads. First, a per-base QRC review-interval setting (Monthly /
Quarterly) with a new migration so small ANG units that run a quarterly
cadence stop seeing false Overdue alerts. Second, parking-module polish —
an aircraft-label visibility toggle in the layer-toggle row, the
"Spot Name" form field renamed to "Aircraft Label" since the user isn't
naming individual spots, plus a follow-up fix when the toggle didn't
actually hide labels because of a fast-path optimization in the marker
render. Third, a full pass through the `/training` deep-dive content —
the user reviewed every one of the 27 modules in the new
`training-modules-review.md` working doc, those edits got synced back
into `lib/training/modules.ts`, then a separate readability pass widened
the deep-dive container, bumped prose from 13px → 15px, and made
screenshots large enough to actually read.

### QRC per-base review interval — Monthly or Quarterly (`3bdc404`)

Bases now pick how often operators must re-review each QRC. Default is
`'monthly'` so existing bases see no behavior change; `'quarterly'`
flips the threshold from 30 days → 90 days, swaps the report-period
picker from a month picker to a calendar-quarter picker, switches the
modal header copy ("Monthly Review" / "Quarterly Review"), and rewires
the consolidated compliance PDF — title becomes
`'AMOPS Quarterly QRC Review'`, subtitle reads `Q2 2026`, the window
math walks `[year, (q-1)*3, 1)` … `[year, q*3, 1)` instead of one
calendar month, and the filename slug shifts to
`qrc-quarterly-review-<base>-2026-q2.pdf`.

Schema is one column on `bases`:
```sql
ALTER TABLE bases
  ADD COLUMN qrc_review_interval TEXT NOT NULL DEFAULT 'monthly'
  CHECK (qrc_review_interval IN ('monthly', 'quarterly'));
```
Engine: `lib/qrc/monthly-review-status.ts` replaces the single
`MONTHLY_REVIEW_DAYS = 30` constant with an `INTERVAL_DAYS = { monthly: 30, quarterly: 90 }`
map and accepts an `interval` arg on `getMonthlyReviewStatus` (defaulted,
so existing call sites still work mid-build). UI: chip cluster in
`QrcTemplatesTab` mirrors the existing `shift_count` pattern at
`base-config/setup/page.tsx:2678`.

Why this exists: small ANG units (Selfridge being the seed example) run
a quarterly QRC review cadence rather than monthly, so the previous
hardcoded 30-day threshold was firing Overdue alerts that the unit's
policy explicitly allows. Per-template override is intentionally not
supported — interval is base-wide.

Migration `2026050400_bases_qrc_review_interval.sql` exists in the repo
but has **not** been applied to the hosted Supabase yet. Apply before
anyone tries to flip the toggle on a real base.

### Parking — aircraft label toggle + "Spot Name" rename (`391d41a`, `c3cd472`)

Two asks bundled. First, an `LBL` button added to the
`AC / OB / TL / AB` layer-toggle row at line ~3318 of
`app/(app)/parking/page.tsx`. Hides the white text labels above each
silhouette (built from `aircraft_name + tail_number`) without touching
the silhouettes themselves — useful when labels clutter a dense plan.
Second, "Spot Name" form-field copy renamed to "Aircraft Label" in two
places (the inline edit row in the Aircraft tab list and the right-click
context panel), since the user isn't naming individual spots. Underlying
column stays `spot_name`; UI copy only.

The first attempt at LBL didn't actually hide labels — confirmed via
screenshot the user posted of a KC-135R/T silhouette with the type-name
still rendered. Root cause: the aircraft-marker render effect at line
~1095 has a "position-only update" fast path that detects when no spot
data changed (positions, headings, aircraft_name all stable) and reuses
existing markers via `marker.setPosition(...)` without rebuilding. The
LBL toggle didn't change spot data, so the fast path fired and the
original labels stayed put. Fix in `c3cd472`: in the same fast-path
loop, also call `marker.setLabel(...)` with either the label object or
`null` based on `visibleLayers.labels`. Lesson saved to feedback memory
— see Lessons below.

### Training modules content sync (`2204fee`, `6ae44eb`)

The user worked through all 27 modules in
`docs/training-modules-review.md`, marking each `Status: REVIEWED`. 21 of
27 had edits; 6 (SCN, Shift Checklist, CES, Waivers, Settings, Customer
Feedback) came back unchanged. Most edits scrubbed Supabase / RLS jargon
in favor of plain English ("path-scoped storage RLS" → "the discrepancy
database"; "Resend" dropped from features), corrected AFM → AMOPS where
the user's terminology preferences applied, dropped legal callouts that
shouldn't be in user-facing prose (T-3 waiver mention on Events Log,
ARFF CAT references on Aircraft Database since that's a separate
concern), and added base-config-driven capabilities the original copy
missed (Kiosk mode on Airfield Status, Reviews tab on QRC, EDIPI capture
on Users).

A separate follow-up commit (`6ae44eb`) swept seven typos the user
spotted post-sync — `customizeable` → `customizable`,
`Three tabs` → `Four tabs` (the QRC bullet now lists Available + Active
+ History + Reviews), trailing `or.` removed from a Checks sentence,
`Exisiting` → `Existing`, `finalzies` → `finalizes`, `ammended` →
`amended`, `AMOPS cpersonnel` → `AMOPS personnel`. Both
`lib/training/modules.ts` and the working doc kept in sync.

### Training deep-dive page readability (`297b6c7`)

User reported the per-module training pages were hard to read on
desktop. Bumped `app/(app)/training/[module-id]/page.tsx` in five ways:

| Element | Before | After |
|---|---|---|
| Container | `maxWidth: 920` | `maxWidth: 1180` |
| Tagline | `fs-md` (15px) | `fs-lg` (16px) |
| Body prose | `fs-sm` (13px) | `fs-md` (15px), looser line-height |
| Screenshot grid | `minmax(280px, 1fr)` | `minmax(520px, 1fr)` |
| Captions | `fs-xs` (12px) | `fs-sm` (13px), 1.5 line-height |

Body prose covers overview paragraphs, key-features cells, how-to-access
callout, workflow-step text, and FAQ q+a. Screenshot grid change means a
1180-wide container now fits two big shots per row instead of three
small ones; modules with one shot get full-width display. Mobile
collapses naturally to one column.

### SESSION_HANDOFF cleanup (`efd3ccd`)

Trivial: removed the carryover entry for the three "missing" module
screenshots (dashboard_2, notams_2, feedback_2) since each referenced a
feature that doesn't exist. The slots stay at 1-of-2 indefinitely.

---

## Migrations status

| Migration | Status | What it does |
|---|---|---|
| `2026050400_bases_qrc_review_interval.sql` | ⚠️ **Pending** | Adds `bases.qrc_review_interval` (TEXT, default `'monthly'`, CHECK monthly/quarterly). Apply before exercising the new toggle in production. |
| `2026050300_qrc_monthly_reviews.sql` | ✅ Applied | (Carryover) Per-user monthly QRC review event table. |
| All prior migrations through `2026050202` | ✅ Applied | (carryover) |

---

## Bugs fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| LBL toggle on /parking didn't hide aircraft labels — silhouettes kept showing the type-name + tail-number text | The aircraft-marker render effect has a "position-only update" fast path that reuses existing markers when spot data hasn't changed. Toggling LBL didn't change spot data, so the fast path fired and skipped the new label state | `c3cd472` |

---

## Lessons from this session

- **Fast-path render optimizations need to also handle visual-only state
  changes.** The /parking aircraft layer effect re-fires when its deps
  array changes (correct), but inside it had a "spots unchanged → just
  setPosition the existing markers" fast path that didn't account for
  toggleable visual flags. Result: LBL toggle re-ran the effect but
  swallowed the change. Whenever a fast path conditionally skips work,
  audit which `useState` flags from the render path it might be hiding.
  Saved as `feedback_render_fast_path_visual_state.md`.
- **Sync user prose verbatim, even typos.** When the user runs a content
  review pass and flips Status to REVIEWED, sync their text exactly —
  preserving misspellings — and surface the typos in the post-sync
  summary as a separate review item. Don't unilaterally "fix" their
  prose, even when it's obviously a typo. The user's authority over
  their own copy is the load-bearing principle. Already implicit in
  prior memories; this session reinforced it.
- **Prose-review working docs (`*-review.md`) parallel to source-of-truth
  files work.** `docs/training-modules-review.md` and the
  `base-setup-guide-review.md` sibling both proved out the
  status-flag-based workflow: user edits prose in markdown, flips
  PENDING → REVIEWED, Claude syncs back. Less friction than asking the
  user to edit nested object literals in TypeScript files. Worth using
  again next time we have ~25+ similar prose blocks to revise.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| Migration `2026050400` not yet applied | **High (blocks new feature)** | Apply before any base admin tries to flip the QRC review interval toggle, otherwise the column is missing and the chip cluster save will error |
| `lib/tours/pages/*.ts` still present | Low | (Carryover) 28 files retained as content seed for the training rebuild. No imports anywhere; safe to delete in a sweep when convenient. |
| `data-tour` anchors throughout page.tsx files | Low | (Carryover) 70+ anchors no longer used by any active tour (only setup-wizard tour uses them). Harmless dead attributes; sweep is optional cleanup. |
| `/training` Quick Start + Base Setup tabs use stub content | Medium | (Carryover) Quick Start has 7 lean steps; Base Setup tab is a placeholder pointing at `/base-config/setup` wizard. Could be expanded over time. |
| FAQ entries on every module are empty | Low | `faq: []` on all 27 modules. Populate as user questions come in. |
| IAW Compliance citations in `lib/base-setup-guide.ts` need verification | Medium | (Carryover) User flagged a couple as wrong. Working file `docs/base-setup-guide-review.md`. |
| `lib/permissions-server.ts` imports `resolveEffectivePermissions` from `'use client'` module | Medium | (Carryover) Move to a shared module. |
| `audit-panel.tsx` per-row internal styling | Low | (Carryover) 1.6K LOC of its own. |
| `/infrastructure` perf | Low–Medium | (Carryover) Smooth on dev laptops, may stutter elsewhere. AdvancedMarkerElement migration target. |
| Largest source files | Held | `base-config/setup/page.tsx` ~5.8K LOC, `parking/page.tsx` ~4.7K LOC, `infrastructure/page.tsx` ~4.3K LOC. |
| Untracked carryover files | Low | `.claude/`, `docs/DEMO_LOGINS.md`, `docs/base-setup-guide-review.md`, `docs/training-modules-review.md` (new this session), `public/glidepath-logo-dark.jpg`. |
| ~124 `as any` casts | Low | (Carryover) Plus the four in `lib/supabase/qrc-reviews.ts` for the `qrc_monthly_reviews` table type — fine until the next supabase types regeneration sweeps them up. |
| Check draft real-time sync deferred | Low | (Carryover) Two users could create duplicate drafts. |
| "Advisories" → "WWA Notifications" UI sweep | Deferred | Glossary memory says "WWA Notifications"; running app still says "Advisories". |
| Trademark | Held | (Carryover) CDW holds live "GLIDEPATH" Class 42 (SaaS) registration — risk for commercial use. |

---

## Next session tasks

1. **Apply migration `2026050400_bases_qrc_review_interval.sql`** to the
   hosted Supabase before exercising the new QRC review-interval toggle
   in production. Without this, the chip cluster in QRC Templates will
   fail when a base admin tries to switch interval.
2. **Bump version to 2.34.0** if you want to release this batch — QRC
   per-base review interval (Monthly/Quarterly) + parking aircraft-label
   toggle + Spot Name → Aircraft Label rename + complete /training
   content sync + readability refresh on the per-module deep-dive
   pages. Five places: `package.json`, `app/(app)/settings/page.tsx`,
   `app/login/page.tsx`, `CHANGELOG.md`, `README.md`. New entry in
   `lib/release-notes.ts`.
3. **IAW Compliance citation audit in `lib/base-setup-guide.ts`** —
   (carryover) user flagged a couple as wrong. Working file
   `docs/base-setup-guide-review.md`.

### Long-running carryover (bandwidth-permitting)

- Sweep the unreferenced `lib/tours/pages/*.ts` files + dead `data-tour`
  attributes.
- Move `resolveEffectivePermissions` out of `lib/permissions.ts` into a
  shared module (server + client both import).
- Component extraction in `base-config/setup/page.tsx` (~5.8K LOC).
- `audit-panel.tsx` per-row internal styling refresh (1.6K LOC).
- `/parking/page.tsx` component extraction (~4.7K LOC).
- "Advisories" → "WWA Notifications" UI sweep.
- Outage analytics, training management, Part 139 civilian template.
- CAC/PIV authentication (blocked on Platform One).

---

## Build snapshot

```
TypeScript clean (npx tsc --noEmit exit 0)
Tests: 253 pass / 25 files (unchanged from prior)
Build: npm run build clean — no warnings, no errors.
1 new migration this session (2026050400_bases_qrc_review_interval.sql) — pending.

Notable First Load JS (changed routes this session):
  /qrc                     18.9 kB / 342 kB    (was 18.4 kB / 342 kB; +0.5 kB from quarter picker + interval-aware PDF)
  /parking                 43.9 kB / 417 kB    (unchanged at the route level — LBL toggle is in-place)
  /training/[module-id]    3.81 kB / 188 kB    (unchanged — readability changes are inline style only)

Largest static page (unchanged): /wildlife 458 kB / 793 kB.
Middleware: 74.5 kB.
Shared by all: 91.2 kB.
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | — | QRC per-base review interval (Monthly / Quarterly) + parking aircraft-label toggle + "Spot Name" → "Aircraft Label" rename + complete /training content sync (21 of 27 modules edited + 7 typos cleaned up) + readability refresh on per-module deep-dive pages. |
| 2.33.0 | 2026-05-02 | Glidepath Training rebuilt at /training as role-filterable hub + per-module deep-dive subpages with Mark Reviewed toggle; click-through tour torn down; PPR module; Daily Reviews; offline write queue + Workbox runtime caching; permission matrix overhaul + 3 new roles; Events Log structure-first refresh; auth fix for invite/signup/reset emails landing on correct screen; forgot-password sends branded email. |
| v2.32.0 | 2026-04-21 | Modular Onboarding, SCN, Close-for-Day, What's New modal |
| v2.31.0 | 2026-04-07 | Full Google Maps migration, Custom Status Boards, PPR Log |
| v2.30.0 | 2026-04-14 | Daily Reviews + shift sign-off, ARFF status log, Vitest scaffold |

See `CHANGELOG.md` for full history.

---

## Key docs / files touched this session

### New files

- `supabase/migrations/2026050400_bases_qrc_review_interval.sql` — adds the per-base QRC review-interval column.
- `docs/training-modules-review.md` — working markdown doc mirroring `lib/training/modules.ts` prose; PENDING/REVIEWED status flag per module, sync workflow analogous to `base-setup-guide-review.md`. Untracked (gitignored alongside the sibling).

### Modified files

- `lib/qrc/monthly-review-status.ts` — `INTERVAL_DAYS` map replaces single `MONTHLY_REVIEW_DAYS`; status-engine accepts `interval` arg.
- `lib/qrc/use-monthly-reviews.ts` — hook accepts + plumbs `interval`; exposes it on the return for downstream UI.
- `lib/qrc-monthly-review-pdf.ts` — interval-aware title, subtitle, period window math, filename slug, matrix legend.
- `lib/supabase/types.ts` — `bases` Row/Insert/Update + `qrc_review_interval`.
- `lib/training/modules.ts` — 21 of 27 modules' prose updated + 7 typo fixes.
- `app/(app)/qrc/page.tsx` — passes `reviewInterval` from `currentInstallation` into the hook.
- `app/(app)/base-config/setup/page.tsx` — Review Interval chip cluster in `QrcTemplatesTab`.
- `app/(app)/parking/page.tsx` — `LBL` toggle in the layer-toggle row, `setLabel(...)` in the position-only fast path, "Spot Name" → "Aircraft Label" copy in two places.
- `app/(app)/training/[module-id]/page.tsx` — container width + body-prose font-size + screenshot grid + caption size bumps.
- `components/qrc/reviews-tab.tsx` — `QuarterPicker` subcomponent + interval-driven copy + window math.
- `components/qrc/monthly-review-modal.tsx` — `interval` prop drives header pill ("Monthly Review" / "Quarterly Review").

### Environment changes

None this session.

---

*Seven commits this session pushed to `origin/main`: `efd3ccd` →
`3bdc404` → `391d41a` → `c3cd472` → `2204fee` → `6ae44eb` → `297b6c7`.*
