# Session Handoff

**Date:** 2026-05-02
**Branch:** `main`
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓, `npx vitest run` ✓ (253 pass)
**HEAD:** `dd0c953` (origin/main) — uncommitted tour-system work + welcome-gate
sits on top, see `Uncommitted work` below.

---

## What shipped this session

Two independent threads. The first was a quick discrepancies-badge feature
plus a dot-color polish (3 commits, all pushed). The second — and most of
the session's footprint — was a from-scratch in-app tour system for the
sidebar + per-page walkthrough, plus a first-login welcome dialog. The
tour work is fully built, type-checks, builds, and tests cleanly, but
remains uncommitted at session end pending a final commit + push.

### Discrepancies pending-verification badge (`9ad5f7a`)

Surfaces a notification dot on the Discrepancies sidebar entry (and the
Airfield Management section header) when discrepancies sit in
`current_status = 'work_completed_awaiting_verification'` — the AMOPS
verify-and-close step. Same plumbing as PPR/QRC: `fetchPendingVerificationCount`
in `lib/supabase/discrepancies.ts`, permission gate (`discrepancies:close`,
held by sys_admin / airfield_manager / namo / base_admin / amops),
realtime subscription on the `discrepancies` table from
`useSidebarBadgeCounts`, dot suppressed on the active item. The `/more`
page picked up the same badge plumbing in the same commit so mobile
users see the same dots — `NavItem` gained a `badgeCount` prop and
`CollapsibleGroup` aggregates badges into a header dot when collapsed.

### Dot color split — green for "work done, awaiting ack"; red elsewhere (`bab0424` → `dd0c953`)

The dot recipe was initially red across all four badged modules
(`bab0424` accidentally flipped *every* dot to green per a one-line
user request that I over-applied). `dd0c953` walked it back to a
per-module split: Discrepancies-pending-verification + the Airfield
Management section-header aggregate stay green (the underlying state
is "CES finished, please acknowledge" — reads better in green); PPR
triage / QRC active / NOTAM expiring + the Operations section-header
aggregate stay red because they're action-required. Saved as feedback
memory (`feedback_notification_dot_color.md`) so future badge work
defaults to red unless the state is acknowledgement-of-completion.

### In-app tour system — sidebar + per-page walkthrough (uncommitted)

The headline work, ~85 files touched. A new tour engine at
`components/tour/OnboardingTour.tsx` replaces the wizard's hand-rolled
inline tour and now drives a full app walkthrough that visits every
sidebar group, every page underneath, and every page's primary controls
— interleaved into a single linear sequence so one Next-button press
always advances the user forward.

The architecture is built around three contracts:

- **`TourStep` schema** (in `OnboardingTour.tsx`) supports `anchor`,
  `anchorIsFixed` (sidebar items vs page content), `navigateTo`
  (`router.push` before showing the step), `expandSidebarGroup`
  (fires a custom event the sidebar listens for), `requiresPerm`
  (skips role-gated steps), and `skipSubTourTo` (the "Skip this page's
  deep-dive" button on per-page intro steps fast-forwards to the next
  sidebar item).
- **State persists across navigation.** The launcher mounts in the
  `(app)/` layout, which Next.js preserves across same-segment route
  changes. The OnboardingTour component's `stepIdx` survives every
  `router.push` the engine triggers — the original implementation lost
  state because I keyed the component on `${tourId}:${pathname}`,
  remounting on every navigation. Fixed mid-session: key on `tourId`
  only.
- **Page sub-tours are reusable.** Each of ~25 visible sidebar routes
  has its own `lib/tours/pages/<route>.ts` exporting a `TourStep[]`.
  The master `lib/tours/sidebar-tour.ts` and `lib/tours/mobile-tour.ts`
  import + interleave them; the desktop tour is anchored to
  `sidebar-item-*` and the mobile variant to `more-item-*` but they
  invoke the *same* page-content steps. Stage 2 page-feature tours
  drop in by adding more files to `lib/tours/pages/` and registering
  with `lib/tours/registry.ts`.

Migration `2026050202_profiles_tours_completed_jsonb.sql` adds a JSONB
map `tours_completed` keyed by tour id. The previous
`has_completed_setup_tour BOOLEAN` from `2026050200` was backfilled to
`{"setup-wizard": true}` for users who'd already finished the wizard
tour. The boolean stays in place this release as a fallback. Future
per-page tours register a new key without a migration.

The wizard tour itself was migrated onto the new engine — its 6
inline steps moved to `lib/tours/setup-wizard-tour.ts`, the wizard
page (`app/(app)/base-config/setup/page.tsx`) imports from the new
path and uses `isTourCompleted` / `markTourCompleted` against the new
JSONB column.

### "View App Tutorial" — explicit-launch only

After a round of QA, the user vetoed first-login auto-fire of the app
tour. A brand-new base with no data + an unfinished setup walks the
user through 30+ empty pages — bad first experience. Switched to
explicit-launch only: a sidebar-footer button labeled
**"View App Tutorial"** (graduation-cap icon, mirrors the
ContactSupport API) and a matching row near the top of the `/more`
page. One click fires `glidepath:tour-launch` for the
viewport-appropriate tour. The wizard tour's auto-fire on
`/base-config/setup` for sys_admins on first visit is unchanged —
that's the wizard page's own concern.

### Welcome dialog (`components/welcome-gate.tsx`, uncommitted)

To replace the auto-fire, a one-time first-login dialog gated on
`profiles.tours_completed.welcome`. Two variants based on whether the
user holds `base_setup:write`:

- **Base admin** (sys_admin / airfield_manager / namo / base_admin /
  amops): wrench icon + "Let's get your base configured" copy +
  primary button **"Go to Base Setup"** (router.push) and secondary
  **"I'll do this later"**.
- **Non-admin**: graduation-cap icon + "Once your base administrator
  finishes setup, click View App Tutorial in the sidebar footer. Some
  modules will look empty until then — that's expected." + single
  **"Got it"** button.

On dismiss it stamps both `tours_completed.welcome = true` AND
`last_seen_release_version` to the latest release, so
`WhatsNewGate` doesn't immediately stack on top for a fresh user's
first session. WhatsNewGate also gained a guard: if
`tours_completed.welcome !== true`, defer entirely until next session.
That keeps the first-login surface to one dialog at a time.

### QA-driven engine fixes (uncommitted)

Five real bugs surfaced and fixed during browser testing:

- **Tour looped back to step 1 every navigation.** Caused by keying
  `OnboardingTour` on `${tourId}:${pathname}`. Removed pathname from
  the key; engine reads `usePathname()` internally + re-measures
  anchors on route change, no remount needed.
- **Bubble appeared below the entire page.** Page anchors were on the
  `<div className="page-container">` wrapper which can be 1500+ px
  tall; `top: rect.top + rect.height + 12` placed the bubble
  thousands of pixels off-screen. Switched the bubble to
  `position: fixed` for all anchors and added a "try below, fall back
  to above, pin to viewport top if neither fits" placement strategy.
- **Sidebar bubble too low for items at the bottom.** Initial fix
  placed the sidebar bubble below its anchor; deep-in-list items
  (Customize Nav / Help) ran off-screen. Switched fixed-anchor
  bubbles to right-of-anchor placement, vertically clamped.
- **Spotlight on the wrong sidebar element.** Items below the
  sidebar's `overflow-y: auto` scroll line had their bounding rect
  reported at their true (clipped) position, so the spotlight
  rendered somewhere outside the visible nav area — visually wrapping
  the footer. Removed the "skip scrollIntoView for fixed anchors"
  guard; the engine now scrolls the sidebar's inner nav container to
  bring the target item into view before measuring rect.
- **Overlay too dark.** `rgba(0, 0, 0, 0.55)` made it impossible to
  read the page content behind the bubble. Lightened to `0.32`. The
  spotlight ring + bubble draw focus on their own.

Saved the bubble placement convention as
`feedback_tour_bubble_placement.md` so future tour anchors stay
consistent.

---

## Migrations status

| Migration | Status | What it does |
|---|---|---|
| `2026050202_profiles_tours_completed_jsonb.sql` | ✅ Applied | Adds `tours_completed JSONB NOT NULL DEFAULT '{}'` to `profiles`. Backfills `{"setup-wizard": true}` for users with `has_completed_setup_tour = TRUE`. The `has_completed_setup_tour` boolean stays one release as a fallback. |
| `2026050201_bases_quick_setup_pending.sql` | ✅ Applied (prior) | (carryover) `bases.quick_setup_pending JSONB`. |
| `2026050200_profiles_setup_tour_flag.sql` | ✅ Applied (prior) | (carryover) `profiles.has_completed_setup_tour BOOLEAN`. Now legacy. |
| `2026050100_library_perms_sys_admin_only.sql` | ✅ Applied (prior) | (carryover) `library:view` + `library:manage` locked to sys_admin. |
| `2026042907_add_construction_other_check_types.sql` | ✅ Applied (prior) | (carryover) check-type enum. |

---

## Bugs fixed during the session

| Symptom | Root cause | Commit / state |
|---|---|---|
| Discrepancies dot didn't appear despite rows in `work_completed_awaiting_verification` | User was reset to a stale browser bundle from earlier session — hard reload picked up new bundle. Confirmed via diagnostic console.log added then removed. | `9ad5f7a` |
| Tour looped back to step 1 after each per-page navigation | `OnboardingTour` keyed on `${tourId}:${pathname}` — remounted on every `router.push`, resetting `stepIdx` to 0 | uncommitted (`tour-launcher.tsx`) |
| Page-content bubble landed off-screen below the page | Bubble used `top: rect.top + rect.height + 12` against a `page-container` wrapper that could be 1500+ px tall | uncommitted (`OnboardingTour.tsx`) |
| Sidebar spotlight wrapped the footer (Sign Out region) | Sidebar's inner nav has `overflow-y: auto`; items scrolled out of view still report their true bounding rect at the clipped position | uncommitted (`OnboardingTour.tsx`) — added `scrollIntoView` for fixed anchors too |

---

## Lessons from this session

- **A `key` change forces a remount.** When mounting a stateful tour
  component at the layout level, never include the pathname in the
  React key — the layout survives navigation, but the keyed component
  won't, and you'll lose all state on every `router.push`. Saved as
  inline comment in `tour-launcher.tsx`.
- **Auto-fire onboarding only when there's content to fire on.** A
  setup-wizard tour on `/base-config/setup` makes sense for a
  sys_admin's first visit — there's a wizard to use. An app-wide tour
  on a brand-new base walks the user through 30+ empty pages and
  trains them that the app is broken. Switched to explicit-launch via
  the View App Tutorial button + a one-time Welcome dialog instead.
- **Per-module dot color carries semantic weight.** Discrepancies
  awaiting verification reads as "work done, please acknowledge" —
  green. PPR / QRC / NOTAM dots are action-required — red. A blanket
  flip across all four broke the semantic. Saved as
  `feedback_notification_dot_color.md`.
- **Plans for non-trivial features need implementation detail per
  step.** The user vetoed two earlier passes of the tour plan because
  they listed *what files would change* without saying *how each step
  was implemented* (anchors, content, navigation, state persistence).
  Final plan v3 included a `TourStep` schema, engine pseudocode, three
  fully-fleshed page sub-tour examples (Discrepancies, QRC,
  Inspections), and a 6-phase implementation order — that one
  shipped. Saved as `feedback_thorough_plans.md`.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| Tour system is uncommitted at session end | High (today) | ~85 files modified / created, 1 migration applied. Commit + push is the immediate next step the user asked for. |
| Page sub-tours mostly target the whole `page-container` | Low | 24 of 28 pages got a single header anchor on the page-container wrapper. The four heaviest (Discrepancies, QRC, PPR, Inspections) got 3-4 anchors each. Engine handles tall anchors gracefully (pin-to-top fallback) so this isn't broken — but per-page tours could be tighter with anchors on individual title / button / list elements. Stage 2 work. |
| DAFMAN / UFC / AFMAN citations in `lib/base-setup-guide.ts` need verification | Medium | (Carryover) User flagged a couple as referencing wrong document; full audit pending. Comment at top of file flags it. The doc `docs/base-setup-guide-review.md` (untracked) is the working file — edit prose + cite triples there, then sync back to `lib/base-setup-guide.ts`. |
| `lib/permissions-server.ts` imports `resolveEffectivePermissions` from a `'use client'` module | Medium | (Carryover) Move `resolveEffectivePermissions` (pure function, no React) out of `lib/permissions.ts` into a shared module. |
| `audit-panel.tsx` per-row internal rows still raw | Low | (Carryover) The hub-level structural pass on `/infrastructure` skipped the dense per-row "Light, electrical light…" list. 1.6K LOC of its own. |
| `/infrastructure` perf carryover | Low–Medium | (Carryover) Smooth on dev laptops, may stutter on weaker hardware. Migration target: `AdvancedMarkerElement`. |
| Largest source files | Held | `base-config/setup/page.tsx` ~5.8K LOC, `parking/page.tsx` ~4.3K LOC, `infrastructure/page.tsx` ~4.1K LOC. (Carryover) Component extraction is explicit multi-session work. |
| Untracked carryover files | Low | `.claude/`, `docs/DEMO_LOGINS.md`, `public/dark logo.jpg`. Plus `docs/base-setup-guide-review.md` from this session. |
| Discrepancy "Notes History" backfill | Optional (carryover) | Historical rows still have `CURRENT_STATUS: <enum>` in the DB; display rewrites on render. |
| Sequential PPR coordination | Deferred (carryover) |  |
| Public PPR form file uploads | Deferred (carryover) |  |
| "Advisories" → "WWA Notifications" UI sweep | Deferred (carryover) | Glossary memory says "WWA Notifications"; running app still says "Advisories". |
| ~124 `as any` casts project-wide | Low | (Carryover) |
| PDF boilerplate duplication in 11 generators | Low | (Carryover) 5 already on `pdf-utils.ts`. |
| Check draft real-time sync deferred | Low | (Carryover) Two users could create duplicate drafts. |

---

## Uncommitted work

The bulk of this session's work is staged on disk but not committed.
This is what `git status` shows beyond the carryover untracked files:

- **34 modified files** — every page that picked up `data-tour`
  anchors (~28 page files) plus the wired-up shell components
  (`sidebar-nav.tsx`, `bottom-nav.tsx`, `more/page.tsx`, `layout.tsx`,
  `whats-new-gate.tsx`, `base-config/setup/page.tsx`).
- **1 deleted file** — `components/base-setup/OnboardingTour.tsx`,
  moved to `components/tour/OnboardingTour.tsx` and generalized.
- **2 untracked dirs / files in scope of the tour work**:
  - `components/tour/` — new dir: `OnboardingTour.tsx`,
    `tour-launcher.tsx`, `HelpMenu.tsx`.
  - `components/welcome-gate.tsx`.
  - `lib/tours/` — new dir: `state.ts`, `registry.ts`,
    `setup-wizard-tour.ts`, `sidebar-tour.ts`, `mobile-tour.ts`, plus
    28 files under `lib/tours/pages/`.
  - `supabase/migrations/2026050202_profiles_tours_completed_jsonb.sql`
    (already applied).

User's stated intent at session end: "let's wrap up the session, then
commit push." The next action after this handoff is a single tour-
system commit + push.

---

## Next session tasks

The active backlog is:

1. **Commit + push the tour system.** Single squashed commit covering
   the engine, the welcome gate, the View App Tutorial button rename,
   and all the per-page anchors + sub-tour content. Migration is
   already applied, so no DB-side coordination needed.
2. **Page-feature tours (Stage 2).** Each page can register its own
   `<page>-feature` tour by dropping a file in `lib/tours/pages/` and
   calling `registerTour(...)`. The Help menu's registry filter
   already supports this — page-tour entries would auto-appear in the
   sidebar Help dropdown when the current pathname matches their
   `visibleWhen`. Authoring is mechanical; pick the heaviest pages
   first.
3. **Tighten page sub-tour anchors.** Most page sub-tours target the
   whole `page-container` wrapper with a single header anchor. The
   engine's pin-to-top fallback handles tall anchors fine, but per-
   page tours read better with anchors on the actual header / primary
   action / list / filters elements. The pattern + canonical anchor
   roles are already documented in §6 of the tour plan
   (`docs/.claude/plans/can-we-create-a-whimsical-sunrise.md` —
   actually `C:/Users/cspro/.claude/plans/`).
4. **Audit the IAW Compliance citations in `lib/base-setup-guide.ts`.**
   (Carryover) User flagged a couple as referencing wrong documents.
   The doc `docs/base-setup-guide-review.md` (untracked) is the
   working file — edit prose + cite triples there, then sync back.

### Long-running carryover (bandwidth-permitting)

Pick from these only when something more pressing isn't available:

- `/training` (Glidepath Training) content refresh.
- Component extraction of the 16 inline tab functions out of
  `base-config/setup/page.tsx`.
- `audit-panel.tsx` per-row internal styling refresh (1.6K LOC).
- `/parking/page.tsx` component extraction (~4.3K LOC).
- Move `resolveEffectivePermissions` out of `lib/permissions.ts`.
- Hex-alpha-concat preventive grep + sweep.
- CAC/PIV authentication (blocked on Platform One).
- Outage analytics, training management, Part 139 civilian template.
- "Advisories" → "WWA Notifications" UI sweep.
- Offline reads for QRC + Regulations.

---

## Build snapshot

```
TypeScript clean (npx tsc --noEmit exit 0)
Tests: 253 pass / 25 files (unchanged)
Build: npm run build clean — no warnings, no errors.
1 new migration this session (applied).

Notable First Load JS (changed routes this session):
  /more                                 7.52 kB / 201 kB    (was 7.12 kB / 200 kB; +0.4 kB / +1 kB)
  /discrepancies                        11.4 kB / 227 kB    (was 11.3 kB / 226 kB; +0.1 kB / +1 kB)
  /base-config/setup                    58.7 kB / 263 kB    (was 60.2 kB / 260 kB; tour engine moved out, -1.5 kB local)
  /qrc                                  11.5 kB / 183 kB    (unchanged route size; +data-tour attrs only)
  /ppr                                  16.9 kB / 184 kB    (unchanged)
  /inspections/all                      5.71 kB / 168 kB    (unchanged)

Largest static page (unchanged): /wildlife 458 kB / 793 kB.
Middleware: 74.5 kB.
Shared by all: 91.2 kB.
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-05-02 (this session) | In-app tour system: a new `OnboardingTour` engine in `components/tour/` drives a sidebar + per-page walkthrough that visits every nav group, every page, and every page's primary controls — interleaved into a single linear sequence. New `lib/tours/` library: `state.ts` (JSONB `profiles.tours_completed`), `registry.ts`, `sidebar-tour.ts` + `mobile-tour.ts` masters, 28 per-page sub-tour files. New "View App Tutorial" button in the sidebar footer + matching `/more` row — explicit-launch only (no first-login auto-fire). One-time `WelcomeGate` dialog gated on `tours_completed.welcome` with two variants (base admin → Go to Base Setup; non-admin → Wait for setup, then take the tour). Migration `2026050202` adds the JSONB column with backfill from the prior `has_completed_setup_tour` boolean. Plus: Discrepancies pending-verification badge on sidebar + `/more` (`9ad5f7a`); per-module dot color split — green for "work done, awaiting ack", red for action-required (`bab0424` → `dd0c953`). 3 commits pushed; tour-system commit pending. |
| **Unreleased** | 2026-05-01 (cont.) | Phase 2 of the `/base-config` revamp finished. Wizard chrome at `/base-config/setup` rebuilt around 5 new components in `components/base-setup/` (`StepperRail`, `GuidePanel`, `KioskUrlChip`, `AutoSavePill`, `FieldHint`) plus a new content map at `lib/base-setup-guide.ts` (~360 LOC) covering all 16 steps with the IAW Compliance attestation format. First-run onboarding tour (hand-rolled, no `react-joyride`) gated on a new `profiles.has_completed_setup_tour` boolean. Quick Setup pre-fills 5 derivable steps from `/api/airport-lookup` + DAFMAN A3.1 templates, stages drafts to a new `bases.quick_setup_pending` JSONB, commits per-step on admin review. `(?)` field hint coverage across all 15 in-file tab functions. Preview Dashboard removed (215-LOC `DashboardPreview` component + button + state) per the user's "live previews are excessive" guidance. Citations in `lib/base-setup-guide.ts` flagged for verification. 4 commits, all pushed. 2 migrations committed but not yet applied. |
| **Unreleased** | 2026-05-01 (prior) | `/library` structure-first refresh, `/infrastructure` (Visual NAVAIDs) refresh + InfoWindow spacing arc (3 commits to find the root cause of 3 stacked width constraints), and Phase 1 of `/base-config` IA split (admin work pulled out of `/settings` into a dedicated hub). 6 commits. |
| **Unreleased** | 2026-05-01 (prior) | Reports & Analytics structure-first sweep (6 pages). Parking left-rail toolbar through three iterations. Parking clearance lines anchor on ray-rectangle exit per side. /feedback staff view restructure. /library access bug fixes — Vercel `TypeError: u is not a function` traced to a `'use client'` transitive import; switched to the `user_has_permission` RPC directly. Migration `2026050100` locks `library:view` + `library:manage` to sys_admin only. 16 commits on `main`. |
| **Unreleased** | 2026-05-01 (prior) | Structure-first audit. 31 commits across 22+ surfaces. ACSI module sweep (7 commits), structural restructures of `/daily-reviews`, `/recent-activity`, `/wildlife` list+form, `/aircraft` list+detail, `/contractors`, `/discrepancies` list+detail. Tier 3 sweep: `/notams`, `/scn`, `/shift-checklist`, `/checks/history`, `/waivers`, `/obstructions`, `/ppr`, `/dashboard`, `/`, `/users`, `/more`. 6 real bugs fixed including the hex-alpha-concat silent-drops in `ActionButton`, `BWC chip`, `FREQ_COLORS`, KPI band; and the `obstructions` duplicate-`5.` Required Actions numbering. |
| **Unreleased** | 2026-04-30 (prior) | Tier 2 of the audit-derived refresh backlog finished. Six commits across five pages. |
| **Unreleased** | 2026-04-30 (prior) | Tier 1 of the audit refresh + 25-commit deep parking polish. 28 commits. |
| **Unreleased** | 2026-04-30 (prior) | Distinctive-refresh sweep across high-traffic routes. 20 commits. |
| **Unreleased** | 2026-04-30 (prior) | QRC distinctive refresh. 1 commit. |
| **Unreleased** | 2026-04-29 | Distinctive-refresh sweep across `/`, `/dashboard`, `/discrepancies`, `/ppr`, `/checks`, `/inspections`. 16 commits, two migrations applied. |
| **Unreleased** | 2026-04-29 (prior) | PPR per-surface visibility, public form ETA optional, Airfield Status base-local-today filter, type-scale shrink. 4 commits. |
| **Unreleased** | 2026-04-28 (cont.) | Capabilities doc v2.32 + FOD Check terminology, discrepancy notes humanization, Visual NAVAIDs zoom stabilization, Training nav rename, CLAUDE.md drift fixes. 6 commits. |
| **Unreleased** | 2026-04-28 | PPR commercial phone + ETA Zulu spine, soft-cancel + email, AMOPS delete/approve perms, manual-coord-pending, slim Log, ACSI per-member signature toggle, sidebar badge polling cuts. Four migrations. |
| **Unreleased** | 2026-04-27 (cont.) | Denial email, AMOPS reply-to format check, PPR PDF coord/status section, no-coord triage warning, OI refresh, public form date echo, atomic PPR# counter, storage RLS path scoping, sidebar badge fixes. |
| **Unreleased** | 2026-04-27 | PPR remarks, info-only columns, ICAO-based URL, sidebar pending dots, agency coordinators, deny-on-review, base-setup drag-reorder, Events Log filter. |
| **Unreleased** | 2026-04-26 | PPR public form + AMOPS-triaged multi-agency coordination, requester emails, full UI/UX iteration. |
| **Unreleased** | 2026-04-25 (cont.) | Offline write queue: foundation + 12 wraps + inspector + pending photos. |
| **Unreleased** | 2026-04-25 | iOS PWA fixes, airfield diagram upload rewrite, OFFLINE pill, codebase primer, Workbox runtime caching for offline reads. |
| v2.32.0 | 2026-04-21 | Modular Onboarding, SCN, Close-for-Day, What's New modal |
| v2.31.0 | 2026-04-07 | Full Google Maps migration, Custom Status Boards, PPR Log |
| v2.30.0 | 2026-04-14 | Daily Reviews + shift sign-off, ARFF status log, Vitest scaffold |

See `CHANGELOG.md` for full history.

---

## Key docs / files touched this session

### New files

- `components/tour/OnboardingTour.tsx` — generalized tour engine
  (lifted from `components/base-setup/OnboardingTour.tsx`, deleted).
  Adds `tourId`, `steps`, `anchorIsFixed`, `requiresPerm`, `navigateTo`,
  `expandSidebarGroup`, `skipSubTourTo`, `waitForAnchorMs` to
  `TourStep`. Position-fixed bubble + spotlight with smart vertical
  placement (try below → fall back above → pin to top). `scrollIntoView`
  for fixed anchors so sidebar items scroll into view before measuring.
  Min-step floor + `tourId`-keyed `stepIdx` reset.
- `components/tour/tour-launcher.tsx` — client-side launcher mounted
  in the `(app)/` layout. Listens for `glidepath:tour-launch`, no
  longer auto-fires. Pre-registers setup-wizard / app-sidebar /
  app-mobile-nav with the registry. Kiosk no-op.
- `components/tour/HelpMenu.tsx` — sidebar-footer "View App Tutorial"
  button with viewport-aware launch (desktop fires `app-sidebar`,
  mobile fires `app-mobile-nav`).
- `components/welcome-gate.tsx` — first-login dialog. Two variants
  by `base_setup:write` permission. Stamps both `tours_completed.welcome`
  and `last_seen_release_version` on dismiss.
- `lib/tours/state.ts` — `isTourCompleted` / `markTourCompleted` /
  `getCompletedTours` against `profiles.tours_completed`.
- `lib/tours/registry.ts` — tour registration + visibility helpers.
- `lib/tours/setup-wizard-tour.ts` — extracted from inline `TOUR_STEPS`
  in the old `components/base-setup/OnboardingTour.tsx`.
- `lib/tours/sidebar-tour.ts` — master desktop tour. Imports + composes
  the 28 page sub-tours with sidebar-item + section-intro steps.
  Helper `withPageWalk` patches `navigateTo` + `skipSubTourTo` onto
  each page sub-tour's first step.
- `lib/tours/mobile-tour.ts` — same shape, anchored to `more-item-*`.
- `lib/tours/pages/<route>.ts` — 28 page sub-tour files (one per
  visible sidebar route). Heavy pages (Discrepancies, QRC, PPR,
  Inspections) have 3-4 step sub-tours; the rest are single-step
  intros.
- `supabase/migrations/2026050202_profiles_tours_completed_jsonb.sql`
  — applied. JSONB `tours_completed` map with backfill from the
  prior boolean.
- `C:/Users/cspro/.claude/projects/C--Users-cspro/memory/feedback_notification_dot_color.md`
  — green for "ack-required", red for "action-required".
- `C:/Users/cspro/.claude/projects/C--Users-cspro/memory/feedback_thorough_plans.md`
  — plans must spec implementation per step, not just file lists.
- `C:/Users/cspro/.claude/projects/C--Users-cspro/memory/feedback_tour_bubble_placement.md`
  — bubble placement convention (fixed-anchor → right; page → below;
  overlay 0.32).
- `C:/Users/cspro/.claude/plans/can-we-create-a-whimsical-sunrise.md`
  — tour system plan, kept for future Stage 2 reference.
- `docs/base-setup-guide-review.md` (untracked, prior session) — the
  working doc for citation audit.

### Modified files

- `components/base-setup/OnboardingTour.tsx` — **deleted**, moved to
  `components/tour/OnboardingTour.tsx`.
- `app/(app)/base-config/setup/page.tsx` — switched to the new tour
  engine import path; `tourId="setup-wizard"`; flag read/write via
  `isTourCompleted` / `markTourCompleted`.
- `app/(app)/layout.tsx` — mounted `<WelcomeGate />` (before
  `<WhatsNewGate />`) and `<TourLauncher />`.
- `components/whats-new-gate.tsx` — fires
  `glidepath:whats-new-dismissed` on dismiss; defers entirely while
  `tours_completed.welcome !== true`.
- `components/layout/sidebar-nav.tsx` — `data-tour` per nav item +
  per group header derivation; `<HelpMenu />` slot in the footer
  above Customize Navigation; `glidepath:tour-expand-group` listener
  drives `setOpenGroups`.
- `components/layout/bottom-nav.tsx` — `data-tour="bottom-nav-more"`
  on the More button.
- `app/(app)/more/page.tsx` — `data-tour` per `NavItem` +
  `CollapsibleGroup`; `<HelpRow />` slot near the top;
  `glidepath:more-expand-group` listener per group.
- **24 page files** under `app/(app)/<route>/page.tsx` — added
  `data-tour="<route>-header"` (and where present, `-primary-action`,
  `-filters`, `-list`, `-tabs` for the heavy pages).
- `lib/supabase/discrepancies.ts` — `fetchPendingVerificationCount`.
- `hooks/use-sidebar-badge-counts.ts` — added `discrepancies` count;
  realtime subscription on `discrepancies` table.

### Environment changes

None this session.

---

*Three commits this session pushed to `origin/main` (`9ad5f7a` →
`bab0424` → `dd0c953`). Tour system + welcome gate + View App
Tutorial button rename are uncommitted on disk pending the user's
final commit + push at session end. Migration `2026050202` applied.
Untracked carryover (`.claude/`, `docs/DEMO_LOGINS.md`,
`public/dark logo.jpg`, plus this session's `docs/base-setup-guide-review.md`)
remain.*
