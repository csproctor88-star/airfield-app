# Session Handoff

**Date:** 2026-05-03
**Branch:** `main`
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓, `npx vitest run` ✓ (253 pass)
**HEAD:** `baed8bd` (origin/main)

---

## What shipped this session

The session opened by pushing the v2.33.0 release commit that the prior handoff
left pending (`2ffc318`). After that, three substantive streams: a mobile bug
fix on the shared discrepancy capture panel, the complete `/training`
screenshot capture pass (64 shots wired with re-verified captions), and a new
QRC monthly per-user review feature with a consolidated cross-operator
compliance matrix PDF. We also ran a marketing carousel experiment that was
deleted at the end — code is gone, design exploration captured under Lessons.

### Mobile discrepancy panel — stack vertically on narrow viewports (`36a6e96`)

`components/ui/simple-discrepancy-panel.tsx` was a fixed 3:2 flex row (map
left, comment + buttons right). At ≤640px the map column was crushed to ~60%
of viewport width — barely usable in the field for inspectors marking items
Fail. Fix: detect narrow viewport via `matchMedia('(max-width: 640px)')` (the
same pattern `app/(app)/activity/page.tsx:348` already uses), flip the parent
flex to `column`, give both children full width. The map's existing
`aspectRatio: '3 / 4'` cap then naturally extends it vertically. Affects both
`/checks` and `/inspections` since they share this component.

### QRC monthly per-user review (`255c77a`)

New Reviews tab on `/qrc` for AMOPS personnel to complete the monthly QRC
review cadence — every operator certifies they've read each QRC monthly
between the annual NAMO/AFM review cycles. Activation flow on the Available
tab is unchanged: clicking a tile still starts an execution one-tap with no
modal interception. The annual review (template-level, NAMO/AFM) stays
untouched too — it's a separate cadence on a separate column of the same
table.

Per-user review state lives in a new immutable `qrc_monthly_reviews` table
(one row per Mark-as-Reviewed event) so the consolidated PDF can roll up
cross-operator compliance and so each row proves which template version the
operator reviewed (`template_updated_at_at_review` snapshot column captures
`qrc_templates.updated_at` at insert time). RLS: SELECT for any base member
(operational compliance is shift-visible like the events log), INSERT for own
row only requiring `qrc:execute`, no UPDATE/DELETE policies — reviews are
immutable like activity_log rows.

Reviews tab groups templates into Due / Updated since review / Current
buckets. Rolling 30-day threshold. "Updated since review" wins over "Overdue"
when the template changed — that's the more actionable signal. Click a row →
read-only review modal renders the QRC content + amber "Updated since your
last review" banner if applicable + optional notes textarea + Mark as Reviewed
button. The hook (`lib/qrc/use-monthly-reviews.ts`) is lifted to the page
level so the tab badge count and the tab body share one fetch — marking a
review updates the badge immediately without a second round-trip.

Generate Compliance Report button (gated on `qrc:execute`) builds the PDF for
a chosen calendar month; email export goes through the existing
`sendPdfViaEmail` pipeline.

### QRC compliance PDF — matrix layout + fix empty-export bug (`9689cfd`)

Two fixes after the user pulled the first generated PDF and reported all 25
QRCs showed "Never reviewed" despite being marked Current in the Reviews tab.

**Bug 1**: `fetchAllReviewsForBase` and `fetchEligibleReviewers` were using
PostgREST embed-join syntax (`profiles:user_id ( name, rank, ... )`). When
the schema cache hasn't refreshed after a migration, those embeds silently
fail and the whole query returns empty. The single-user `fetchUserReviews`
worked because it had no embed, which is why the Reviews tab UI showed
correct state but the PDF saw nothing. Replaced both functions with separate
`from('profiles').in('id', ids)` lookups + JS-side join, matching the proven
pattern in `lib/supabase/daily-reviews.ts:219-227`. More verbose, can't fail
silently.

**Bug 2**: per-operator detail pages were too verbose for compliance records.
User wanted "QRCs on the left, operator initials at the top, Y/N cells" — a
matrix view. Replaced the per-operator detail pages with a single Compliance
Matrix on page 2: rows = QRC # + Title (left), columns = one per operator
with header "Rank Initials" (e.g., "TSgt JK"), cells = Y (filled green) if
the operator reviewed that QRC during the report month, N (filled red) if
not. Switched orientation to landscape Letter so 1-15 operators fit per page;
autoTable handles row overflow. Operator column width auto-adjusts (capped
22mm so a 1-operator report doesn't blow up the cell, floored at 11mm so up
to ~15 operators stay legible).

### QRC compliance roster — include admin roles + actual reviewers (`2adc2f9`)

User pulled the report at Selfridge and noticed they (SMSgt Christopher
Proctor, sys_admin) weren't in the roster despite having marked all 25 QRCs
reviewed. Root cause: `fetchEligibleReviewers` filtered strictly to
operational roles (airfield_manager / namo / amops). At small ANG units the
same person often wears multiple hats, and a sys_admin who actively reviews
QRCs has to appear on the records report.

Two-layer fix:
1. `REVIEWER_ROLES` constant now includes `base_admin` and `sys_admin` in
   addition to the operational trio. Anyone with one of those five roles at
   the base shows up in the matrix even if they haven't reviewed yet (so
   gaps remain visible).
2. `preparePdf` folds in any reviewer whose role isn't in `REVIEWER_ROLES`
   but who has at least one review in the window. Synthesizes the
   EligibleReviewer entry from the cached profile fields on the review row —
   no extra round-trip. Catches edge cases like a `safety` user who happened
   to review.

`formatRole` gained labels for `base_admin` / `sys_admin` / `other` so the
Operator Roll-Up table renders them cleanly.

### Training screenshot pass — the slog (`fac87d6` + `7012092` + `baed8bd`)

Three commits doing what should have been one. First (`fac87d6`) cleared 51
stale PNGs from the prior /training rebuild that no longer matched the new
naming convention. Second (`7012092`) — user dropped 64 captures into
`public/training/` with names like `acsi_ (1).png` (space + parens). I
batch-renamed to canonical `<id>_<n>.png` and wired all 27 modules'
`screenshots: []` arrays. Caught one stray "Customer Feedback" page screenshot
named generically and folded it in as `feedback_1.png`. Third (`baed8bd`) —
user reviewed and called out that "the captions you wired up are not with the
correct captions at all". Root cause: I'd written captions from
`docs/training-screenshots.md` (the planning doc) without looking at the
actual PNGs. Captures don't always match the planned shot. Re-captioned every
wired screenshot by reading each PNG and describing what's actually in it.

The re-caption pass surfaced four real accuracy bugs in module copy that was
also written from imagined features rather than the actual UI:
- Dashboard had no "Quick-launch buttons" label — they're just module
  shortcut tiles. Renamed in copy.
- NOTAMs had no "Add Local NOTAM" function — that was removed long ago.
  Dropped every Local NOTAM reference.
- Customer Feedback has no detail view — rows show comment + custom-field
  responses inline. Workflow step rewritten.
- Checks + Inspections + ACSI + Shift Checklist + QRC copy used "walk" verbs
  ("walk the airfield", "walk the items") — checks aren't physical walks.
  Replaced with "work through" / "step through" / "take through".

ACSI shot 3 was actually a Daily Review modal (mis-categorized capture);
dropped from the gallery, file kept in `public/training/` in case it gets
repurposed for `daily-reviews_3.png`. Final state: 64 of 67 planned captures
landed; dashboard, notams, and feedback each ended on 1 of 2 because the
planned second shot didn't represent a real feature.

Five feedback memories saved to prevent the same mistakes from re-happening:
`feedback_no_walk_in_checks`, `feedback_no_local_notams`,
`feedback_dashboard_no_quick_launch`, `feedback_no_feedback_detail_view`,
and most importantly `feedback_caption_screenshots_first` (always Read the
actual PNG before captioning — this was the meta-lesson behind the whole
re-caption pass). Plus an earlier session memory
`feedback_navaid_discrepancy_scope` correcting the assertion that the
Airfield Status NAVAID grid auto-creates discrepancies (it doesn't —
`/infrastructure` does).

### Marketing carousel experiment — built then scrapped (uncommitted, deleted)

Spent significant time building a `/marketing` route system to generate
Facebook-ready carousel cards showcasing Glidepath features. Iterated through
three distinct designs:

1. **Per-module documentation cards** — mirrored the training pages in a
   text-dense single card per module. Too documentation-y, didn't stand out
   in a social feed.
2. **Marquee-feature carousel** — 6 features × 3 cards (hero / detail /
   outcome) with screenshot-led layouts. Wide app screenshots got
   letterboxed inside `flex: 1` frames, leaving giant voids on cards.
3. **Fixed grid layout with vertical stacking and width-first sizing** —
   better, but the user concluded the cards "aren't going to turn out how I
   envision them" and called it.

All marketing files deleted (`lib/marketing/`, `components/marketing/`,
`app/marketing/`), `middleware.ts` reverted (the `/marketing` public-path
entry is gone). Tasks closed. The Glidepath logo file rename
`public/dark logo.jpg` → `public/glidepath-logo-dark.jpg` survives in the
working tree as untracked carryover (cleaner name, harmless).

Saved `feedback_no_paper_comparison.md` from the experiment — don't reference
paper / clipboards / whiteboards in marketing copy. The analog era ended
10+ years ago; the competition is other software.

---

## Migrations status

| Migration | Status | What it does |
|---|---|---|
| `2026050300_qrc_monthly_reviews.sql` | ✅ Applied | New table for per-user monthly QRC review events. Immutable (no UPDATE/DELETE policies). RLS: SELECT for any base member, INSERT for own row + `qrc:execute` permission. |
| All prior migrations through `2026050202` | ✅ Applied | (carryover) |

---

## Bugs fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| Airfield-inspection map was unusably small on mobile when an item was marked Fail | Shared discrepancy panel locked into a 3:2 flex row even at narrow viewports — map crushed to ~60% screen width | `36a6e96` |
| Consolidated QRC review PDF showed all 25 templates as "Never reviewed" despite Reviews tab showing them as Current | PostgREST embed-join syntax (`profiles:user_id (...)`) silently failed when schema cache hadn't refreshed after the migration; whole query returned empty | `9689cfd` |
| Sys admin missing from the consolidated PDF roster despite having marked QRCs reviewed | `fetchEligibleReviewers` filtered strictly to operational roles, excluded `sys_admin` and `base_admin` even though they actively review at small units | `2adc2f9` |
| Module training pages had captions describing features that don't exist (Quick Launch, Local NOTAM, feedback detail view, "walk the airfield") | Module copy was originally written from imagined features, not from the actual UI; my screenshot captions were written from the planning doc, not the captured PNGs | `baed8bd` |

---

## Lessons from this session

- **Always Read the actual screenshot before captioning.** Wiring captions
  from a planning doc compounds error: if the user captured something
  different from what was planned (which they often do), every caption is
  wrong, and you don't notice until they tell you. Saved as
  `feedback_caption_screenshots_first.md`. The same lesson applies to
  writing module copy, tour text, alt text, and any prose tied to a captured
  image.
- **PostgREST embed joins are fragile after migrations.** The
  `select('a, b, profiles:user_id (...)')` shorthand depends on the schema
  cache having refreshed to know about the FK. After a fresh migration like
  `2026050300`, the embed silently returns empty. Use the pattern in
  `lib/supabase/daily-reviews.ts:219-227` instead — separate
  `from('profiles').in('id', ids)` lookup + JS-side join. More verbose,
  can't fail silently.
- **Marketing material is its own discipline.** The training documentation
  pages work as documentation; they don't work as social-feed content.
  Audience reads docs deliberately and skims feeds aggressively — the same
  content needs different visual treatment. The marketing experiment failed
  because we tried to translate documentation into marketing rather than
  rewriting from a marketing-first brief. If revisited, start from "what
  does an airfield manager scrolling Facebook need to see in 2 seconds to
  stop scrolling" rather than "let's reformat the docs".
- **Don't compare Glidepath to paper.** Saved as
  `feedback_no_paper_comparison.md`. Airfield managers haven't been on
  physical paper / clipboards / whiteboards in 10+ years; competing against
  the analog era dates the product and insults the audience.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| `lib/tours/pages/*.ts` still present | Low | (Carryover) 28 files retained as content seed for the training rebuild. No imports anywhere; safe to delete in a sweep when convenient. |
| `data-tour` anchors throughout page.tsx files | Low | (Carryover) 70+ anchors no longer used by any active tour (only setup-wizard tour uses them). Harmless dead attributes; sweep is optional cleanup. |
| `/training` Quick Start + Base Setup tabs use stub content | Medium | (Carryover) Quick Start has 7 lean steps; Base Setup tab is a placeholder pointing at `/base-config/setup` wizard. Could be expanded over time. |
| FAQ entries on every module are empty | Low | `faq: []` on all 27 modules. Populate as user questions come in. |
| IAW Compliance citations in `lib/base-setup-guide.ts` need verification | Medium | (Carryover) User flagged a couple as wrong. Working file `docs/base-setup-guide-review.md`. |
| `lib/permissions-server.ts` imports `resolveEffectivePermissions` from `'use client'` module | Medium | (Carryover) Move to a shared module. |
| `audit-panel.tsx` per-row internal styling | Low | (Carryover) 1.6K LOC of its own. |
| `/infrastructure` perf | Low–Medium | (Carryover) Smooth on dev laptops, may stutter elsewhere. AdvancedMarkerElement migration target. |
| Largest source files | Held | `base-config/setup/page.tsx` ~5.8K LOC, `parking/page.tsx` ~4.7K LOC, `infrastructure/page.tsx` ~4.3K LOC. |
| Untracked carryover files | Low | `.claude/`, `docs/DEMO_LOGINS.md`, `docs/base-setup-guide-review.md`, `public/glidepath-logo-dark.jpg` (renamed from `public/dark logo.jpg`). |
| ~124 `as any` casts | Low | (Carryover) Plus four new ones in `lib/supabase/qrc-reviews.ts` for the not-yet-regenerated `qrc_monthly_reviews` table type — fine until the next supabase types regeneration sweeps them up. |
| Check draft real-time sync deferred | Low | (Carryover) Two users could create duplicate drafts. |
| "Advisories" → "WWA Notifications" UI sweep | Deferred | Glossary memory says "WWA Notifications"; running app still says "Advisories". |
| Trademark | Held | (Carryover) CDW holds live "GLIDEPATH" Class 42 (SaaS) registration — risk for commercial use. |

---

## Next session tasks

1. **Bump version to 2.34.0** if the QRC monthly review feature is treated
   as a release. Five places: `package.json`,
   `app/(app)/settings/page.tsx`, `app/login/page.tsx`, `CHANGELOG.md`,
   `README.md`. New entry in `lib/release-notes.ts`. Suggested headline:
   per-user monthly QRC review with cross-operator compliance matrix PDF +
   mobile fix for the inspection-discrepancy panel + complete /training
   screenshot capture pass.
2. **IAW Compliance citation audit in `lib/base-setup-guide.ts`** —
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
1 new migration this session (2026050300_qrc_monthly_reviews.sql) — applied.

Notable First Load JS (changed routes this session):
  /qrc                     18.4 kB / 342 kB    (jumped from prior baseline due to Reviews tab + jspdf-autotable import for the consolidated PDF)
  /training/[module-id]    3.8 kB / 188 kB     (was 3.8 kB / 182 kB; +6 kB from screenshot wiring across 27 modules)
  /checks, /inspections    unchanged at the route level (mobile fix lives in the shared simple-discrepancy-panel chunk)

Largest static page (unchanged): /wildlife 458 kB / 793 kB.
Middleware: 74.5 kB.
Shared by all: 91.2 kB.
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | — | QRC per-user monthly review + cross-operator compliance matrix PDF; mobile fix for inspection-discrepancy panel; complete /training screenshot capture pass (64 shots wired with verified captions). |
| 2.33.0 | 2026-05-02 | Glidepath Training rebuilt at /training as role-filterable hub + per-module deep-dive subpages with Mark Reviewed toggle; click-through tour torn down; PPR module; Daily Reviews; offline write queue + Workbox runtime caching; permission matrix overhaul + 3 new roles; Events Log structure-first refresh; auth fix for invite/signup/reset emails landing on correct screen; forgot-password sends branded email. |
| v2.32.0 | 2026-04-21 | Modular Onboarding, SCN, Close-for-Day, What's New modal |
| v2.31.0 | 2026-04-07 | Full Google Maps migration, Custom Status Boards, PPR Log |
| v2.30.0 | 2026-04-14 | Daily Reviews + shift sign-off, ARFF status log, Vitest scaffold |

See `CHANGELOG.md` for full history.

---

## Key docs / files touched this session

### New files

- `supabase/migrations/2026050300_qrc_monthly_reviews.sql` — table + RLS for per-user monthly QRC review events.
- `lib/supabase/qrc-reviews.ts` — `fetchUserReviews` / `fetchAllReviewsForBase` / `fetchEligibleReviewers` / `markReviewed`.
- `lib/qrc/monthly-review-status.ts` — pure helper computing per-template per-user review state.
- `lib/qrc/use-monthly-reviews.ts` — hook with optimistic insert + rollback.
- `components/qrc/monthly-review-modal.tsx` — read-only review modal with amber "updated since" banner.
- `components/qrc/reviews-tab.tsx` — Reviews tab body with grouped buckets + month picker + Generate Compliance Report.
- `lib/qrc-monthly-review-pdf.ts` — landscape-Letter consolidated PDF: cover summary + Y/N matrix.
- `docs/training-screenshots.md` — per-shot capture checklist; this session's commits filled it in and pruned 3 obsolete entries.
- 64 PNG files at `public/training/<module-id>_<n>.png` — module screenshots.
- 7 feedback memories at `~/.claude/projects/C--Users-cspro/memory/`: `feedback_navaid_discrepancy_scope`, `feedback_no_walk_in_checks`, `feedback_no_local_notams`, `feedback_dashboard_no_quick_launch`, `feedback_no_feedback_detail_view`, `feedback_caption_screenshots_first`, `feedback_no_paper_comparison`.

### Modified files

- `app/(app)/qrc/page.tsx` — new `'reviews'` tab between Available and Active; `useMonthlyReviews` hook lifted to page level so badge count + tab body share state.
- `lib/training/modules.ts` — every module's `screenshots: []` populated; copy corrections (no Quick Launch, no Local NOTAM, no detail view, no "walk").
- `lib/supabase/types.ts` — new `QrcMonthlyReview` type (table not yet in auto-generated `Database`).
- `components/ui/simple-discrepancy-panel.tsx` — `narrow` matchMedia state; flex flips to column on mobile.

### Deleted files

- 51 PNGs in `public/training/` — pre-rebuild assets cleared before the new capture pass (`fac87d6`).

### Environment changes

None this session.

---

*Eight commits this session pushed to `origin/main` in this order: `2ffc318` → `36a6e96` → `fac87d6` → `255c77a` → `9689cfd` → `2adc2f9` → `7012092` → `baed8bd`. Marketing carousel experiment built and scrapped within the session — no commits, code deleted from working tree.*
