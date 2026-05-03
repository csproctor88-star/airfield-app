# Session Handoff

**Date:** 2026-05-02
**Branch:** `main`
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓, `npx vitest run` ✓ (253 pass)
**HEAD:** `1b1367c` (origin/main) — pending: tour teardown + /training rebuild + Events Log refresh + 2.33.0 release bump (~25 modified files, 7 new directories, 3 deleted files)

---

## What shipped this session

This session pivoted hard. We started by deepening the page-feature tour content (waves 1–2 in commits `cfed596` and `1b1367c`), then realized the click-through tour had ballooned to 111 steps — too long to be the primary learning channel. The user called it: scrap the master tour, rebuild `/training` from scratch as a real reference surface. After the pivot we tore down the tour, rebuilt `/training` with role-filterable cards + per-module deep-dive subpages + a Mark Reviewed toggle, ran a structure-first refresh on Events Log, and bumped to v2.33.0. The session also fixed two real auth bugs along the way (forgot-password sending Supabase default email, and invite/signup links bouncing to /login under PKCE).

### Tour wave 1 — page-feature deepening (`cfed596`)

Discrepancies / QRC / PPR / Wildlife sub-tours expanded from 1–4 steps to 5–7 each, with new `data-tour` anchors per page. Authoring driven by the recipe at `feedback_page_tour_recipe.md`. This work survived the pivot — the tour copy is now the seed for the matching `/training/[id]` modules in Phase 2.

### Tour engine extension (`e833639`)

`TourStep.dispatchOnEnter?: { event, detail }` fires a `CustomEvent` on `window` during the step transition. Pages register listeners under the `glidepath:tour-<page>-<action>` convention. Plus arrow-key navigation on the bubble (→ next, ← back, Esc skip; disabled while focus is in an input/textarea/select). Engine retained for the setup-wizard tour after the master-tour teardown.

### Auth — direct verify-OTP URL for all email flows (`fc1ff35`)

The reported bug: invite links bounced users to `/login` instead of `/setup-account`. Root cause: invite, signup, admin password reset, and the new self-service forgot-password were all emailing `inviteData.properties.action_link` (Supabase's hosted `/auth/v1/verify` URL). With PKCE flow enabled (the default for new projects), Supabase redirects after verification with `?code=...` and the exchange requires a code_verifier in the user's browser localStorage — but server-generated links never put one there. Exchange fails, our `/auth/confirm` falls through to `/login`, and the error message gets dropped because the login page only renders `kiosk_*` codes.

Fix per Supabase SSR docs: build the URL ourselves as `${siteUrl}/auth/confirm?token_hash=<hashed>&type=<verification_type>&next=<destination>`. The route handler's `verifyOtp({type, token_hash})` path doesn't need PKCE. Applied to all four routes (invite, signup-email, admin/reset-password, forgot-password). Also: new `/api/forgot-password` anonymous endpoint replaced the prior `supabase.auth.resetPasswordForEmail` call which was sending Supabase's default unbranded SMTP. Login page now displays any unrecognized `?error=` value verbatim so the next failure isn't invisible.

### Tour wave 2 — deep page tours + parking panel-opening (`1b1367c`)

Five more page sub-tours deepened: Parking 1 → 10 steps (deep dive with `dispatchOnEnter` events that open the floating panel and switch each tab Aircraft → Environment → Clearance → Settings, plus showing the aircraft picker), Infrastructure 1 → 6, Inspections-all 2 → 6, Daily Reviews 1 → 5, Obstructions 1 → 5. Parking page registers `glidepath:tour-parking-*` listeners that mutate sidebar state from tour steps. setTab handler closes the picker first so a stale modal overlay doesn't cover the next anchor.

### Pivot — click-through tour torn down, /training rebuilt (uncommitted)

After wave 2 hit 111 steps total, the user called it. Decision: kill the master tour entirely; make `/training` the canonical learning surface.

**Phase 0 — teardown:**
- Deleted `components/tour/HelpMenu.tsx`, `lib/tours/sidebar-tour.ts`, `lib/tours/mobile-tour.ts`.
- `components/tour/tour-launcher.tsx` trimmed to register only the setup-wizard tour.
- `components/welcome-gate.tsx` non-admin variant rewritten to point at `/training` instead of the old "View App Tutorial" sidebar button.
- `components/layout/sidebar-nav.tsx` and `app/(app)/more/page.tsx` no longer render the HelpMenu / HelpRow.
- `lib/tours/state.ts` gained `unmarkTourCompleted()` for the new reviewed-modules toggle.
- Engine, setup-wizard tour, and `/base-config/setup` first-run tour all retained — they're focused on-page tutorials, not the app-wide marathon.
- The `lib/tours/pages/*.ts` files stayed (they were the seed for the new `/training` module copy — kept for reference, can be deleted later if desired).

**Phase 1 — training architecture + content:**
- New `lib/training/modules.ts` — `ModuleRef` shape with `id`, `name`, `icon`, `color`, `path`, `tagline`, `roles[]`, `overview`, `keyFeatures`, `howToAccess`, `workflow?`, `screenshots?`, `faq?`, `relatedModules?`, `readMinutes?`. Holds 27 modules (4 new since old Training: `recent-activity`, `ces`, `acsi`, `users`).
- New `app/(app)/training/[module-id]/page.tsx` — 9-section subpage layout: Hero (icon, role chips, Open Module + Mark Reviewed buttons) · Overview · Key Features (2-column card grid with check icons) · How to Access (tinted callout) · Screenshots (gallery with framed empty-state placeholder) · Workflow (numbered stepper with vertical connecting line) · FAQ (collapsible accordion) · Related modules · Footer back-link.
- New `components/training/role-chip-filter.tsx` — multi-select role chips above the modules grid.
- New `components/training/module-card.tsx` — tile card with icon-tile color, neutral border, "X min read" footer (or "Reviewed" in green when marked).
- Rewrote `app/(app)/training/page.tsx` from scratch — three tabs (Modules / Quick Start / Base Setup), search across module name + tagline + overview + keyFeatures, role chip filter, Reviewed/Unreviewed/All toggle + progress counter ("3 of 27 reviewed"). PDF export still works through structural typing on `ModuleData` subset.
- New `lib/training/use-reviewed.ts` — hook that loads per-user reviewed map from `profiles.tours_completed` under `training:<id>` namespace. Optimistic toggle with rollback. Exposes `isReviewed(id)` + `toggle(id)` + `loaded` flag. Uses migration `2026050202` JSONB column — no new migration needed.

**Roles tightened to actionable working sets** per user direction ("CES should only see CES and safety should only see the modules they can take action/edit"):
- CES → 4 modules (ces, discrepancies, infrastructure, settings)
- Safety → 3 modules (airfield-status, wildlife, settings)
- PPR → 4 modules (airfield-status, ppr, regulations, settings)
- MAJCOM → 5 modules (activity, daily-reviews, reports, regulations, settings)
- Read-Only → 5 modules (airfield-status, aircraft, notams, regulations, settings)
- AMOPS picks up acsi, waivers, obstructions
- AFM / NAMO see most ops + airfield-mgmt modules
- Sys Admin / Base Admin see everything

**Visual polish iterations** (multiple sub-fixes during user QA):
- Dropped colored left rail from module cards — neutral border, icon tile carries module color (was reading as a rainbow grid)
- Removed role chips from cards (added "FILTER BY ROLE" label to the filter chips instead so users know what they do)
- Quick Start step cards redesigned — 52px outlined-pill numbered circles connected by a vertical cyan line (was tiny filled-cyan square tiles)
- "Open module" button switched from filled to outlined recipe per `feedback_amber_text_contrast.md` (filled amber reads muddy on the QRC subpage)
- Workflow stepper circles also outlined recipe (preventive — same amber issue)
- Replaced all 42 `→` characters in module howToAccess strings with `›` (right-angle quote, more font-conservative)
- Removed `sys_admins` / `base_admins` snake_case from prose; use "system administrators" / "base administrators". Saved as `feedback_no_snake_case_prose.md`.

### Events Log structure-first refresh (uncommitted)

Confirmed `/activity` was missed in the prior structure-first sweep — git shows lots of feature/bug-fix commits but no UX pass. Restructure (single file, ~250 lines changed):

- Plain h1 → tertiary "EVENTS LOG" tier-label + inline counts ("107 entries · 0/2 AMSL pending") + utility cluster (Excel) + cyan accent rule. Matches `/discrepancies`, `/ppr`, `/parking`.
- Full Review Shift card → compact 1-line button (still cyan-tinted, much less vertical space).
- Cyan-tinted New Log Entry card → neutral border (de-emphasized so list dominates page).
- Per-column inline search inputs (3) → single top search bar matching actor / OI / action / details in one shot.
- Full-width segmented period buttons → bordered chip-cluster (Today / 7 Days / 30 Days / Custom).
- Raw "MAY 2, 2026" date headers → relative-anchor recipe (Today / Yesterday / weekday) + secondary date + right-aligned entry count badge per group.
- Filter logic collapsed: `filterUser` / `filterAction` / `filterDetails` → single `search` state.
- Removed standalone Back button (rare need on a sidebar destination) and the standalone "107 entries" line (now inline in header).
- Header had a dup "Template" button next to Excel — caught in QA, removed (Use Template inline in New Log Entry section is the only entry point now).

### v2.33.0 release bump (uncommitted)

`package.json`, `README.md`, `app/(app)/settings/page.tsx`, `app/login/page.tsx` — version strings to 2.33.0. New `RELEASE_NOTES` entry in `lib/release-notes.ts` (8 highlight bullets). `CHANGELOG.md` — moved [Unreleased] content into a new [2.33.0] section, added training-rebuild + tour-teardown + auth-fix + events-log-refresh subsections, plus PPR module + Daily Reviews + offline write queue + ACSI per-member sigs to the Modules-added section.

---

## Migrations status

| Migration | Status | What it does |
|---|---|---|
| `2026050202_profiles_tours_completed_jsonb.sql` | ✅ Applied | (carryover) JSONB column. Now stores `setup-wizard`, `welcome`, and `training:<id>` namespaced flags. |
| All prior migrations through `2026050201` | ✅ Applied | (carryover) |

No new migrations this session.

---

## Bugs fixed during the session

| Symptom | Root cause | Commit / state |
|---|---|---|
| Forgot-password sent Supabase's default unbranded email | `supabase.auth.resetPasswordForEmail` from the browser hits Supabase SMTP | `fc1ff35` — new `/api/forgot-password` route mints link via admin API + sends branded Resend email |
| Invite emails bounced users to /login instead of /setup-account | `properties.action_link` → Supabase `/auth/v1/verify` → `?code=...` → exchange fails because PKCE code_verifier was never set in browser (server-generated link) | `fc1ff35` — all four email routes now build `/auth/confirm?token_hash=&type=&next=` directly |
| Login page silently dropped `?error=...` from `/auth/confirm` | Error-code map only handled `kiosk_*` codes | `fc1ff35` — falls back to displaying raw error string |
| Tour step 75 (parking-environment-tab) couldn't show tabs | aircraft picker modal overlay covered the tab bar | uncommitted (parking page setTab listener now closes picker first) |
| `/training` module grid read like a rainbow hodge-podge | colored left rail per module + colored role chips per card | uncommitted (dropped left rail, neutral chips, icon tile carries color) |
| `/training` "Open module" button was muddy on amber QRC card | filled amber + white text per `feedback_amber_text_contrast.md` | uncommitted (switched to outlined-pill recipe) |
| `/training/[id]` "How to Access" text rendered with weird letter-spacing + `→` showing as `!'` | font fallback on `→` character widening surrounding metrics | uncommitted (replaced all 42 `→` with `›` in `modules.ts`) |
| `/training` prose contained `sys_admins` / `base_admins` snake_case | leaked database identifiers in user-facing copy | uncommitted (rewrote as "system administrators" / "base administrators"; saved feedback memory) |

---

## Lessons from this session

- **Click-through tutorials don't scale.** 111 steps was the breaking point. The right model for module-level training is reference content (with optional Mark Reviewed tracking) at a dedicated page like `/training`, not a marathon walkthrough that nobody finishes. Saved as the strategic context in `lib/release-notes.ts` 2.33.0 entry.
- **Per-user state inside `tours_completed` JSONB scales beyond tours.** The column was added by `2026050202` for tour completion tracking. Reusing it under namespaced keys (`training:<id>`, `welcome`, `setup-wizard`) avoids a migration per new flag and stays cleanly RLS-scoped to the auth user.
- **Server-generated email links can't use PKCE flow.** Supabase's `properties.action_link` works for client-initiated flows but breaks for `generateLink()` because the code_verifier was never stored on the user's browser. Always build `{site}/auth/confirm?token_hash=&type=&next=` directly for any server-generated email.
- **Snake_case role names in user-facing prose look like leaked identifiers.** Saved as `feedback_no_snake_case_prose.md`. Type defs and ROLE_LABELS keys can stay snake_case; user-visible text uses spelled-out forms.
- **Outlined-pill recipe is the safe default for module-color buttons.** Filled amber/yellow reads muddy with any text color (`feedback_amber_text_contrast.md`). The filled treatment also fails for cyan with low-contrast small numbers. Apply outlined recipe (tinted bg + colored border + colored text) to anything that takes module color.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| `/training` modules have no real screenshots | Medium | All 27 modules have `screenshots: []` placeholders. Subpages render a framed "Screenshots coming" empty state. Capture is a manual user task — drop PNGs into `/public/training/<module-id>_<n>.png` and update the array. Phase 3 of the plan. |
| `lib/tours/pages/*.ts` files still present | Low | 28 files retained as content seed for the training rebuild. Can be deleted in a followup commit; they're no longer imported anywhere. |
| `data-tour` anchors throughout page.tsx files | Low | 70+ anchors no longer used by any active tour (only setup-wizard tour anchors remain in active use). Harmless dead attributes; sweep is optional cleanup. |
| `/training` Quick Start + Base Setup tabs use stub content | Medium | Quick Start has 7 lean steps; Base Setup tab is a placeholder pointing at `/base-config/setup` wizard. Could be expanded over time. |
| FAQ entries on every module are empty | Low | `faq: []` on all 27 modules. Populate as user questions come in. |
| IAW Compliance citations in `lib/base-setup-guide.ts` need verification | Medium | (Carryover) User flagged a couple as wrong. Working file at `docs/base-setup-guide-review.md`. |
| `lib/permissions-server.ts` imports `resolveEffectivePermissions` from `'use client'` module | Medium | (Carryover) Move to a shared module. |
| `audit-panel.tsx` per-row internal styling | Low | (Carryover) 1.6K LOC of its own. |
| `/infrastructure` perf | Low–Medium | (Carryover) Smooth on dev laptops, may stutter elsewhere. AdvancedMarkerElement migration target. |
| Largest source files | Held | `base-config/setup/page.tsx` ~5.8K LOC, `parking/page.tsx` ~4.7K LOC, `infrastructure/page.tsx` ~4.3K LOC. |
| Untracked carryover files | Low | `.claude/`, `docs/DEMO_LOGINS.md`, `docs/base-setup-guide-review.md`, `public/dark logo.jpg`. |
| ~124 `as any` casts | Low | (Carryover) |
| Check draft real-time sync deferred | Low | (Carryover) Two users could create duplicate drafts. |
| "Advisories" → "WWA Notifications" UI sweep | Deferred | Glossary memory says "WWA Notifications"; running app still says "Advisories". |

---

## Next session tasks

1. **Capture screenshots for `/training` modules** — 27 modules × 2-3 shots each = ~50-75 PNGs. Drop into `/public/training/<id>_<n>.png` and update the `screenshots` arrays per module. Incremental work — can land a batch at a time. The subpages already render a "Screenshots coming" placeholder, so partial capture is fine.
2. **Optionally delete `lib/tours/pages/*.ts`** — 28 files no longer imported. Can also sweep the `data-tour` attributes from page files if doing a real cleanup pass. Pure mechanical change.
3. **IAW Compliance citation audit in `lib/base-setup-guide.ts`** — (carryover) user flagged a couple as wrong. Working file `docs/base-setup-guide-review.md`.

### Long-running carryover (bandwidth-permitting)

- Move `resolveEffectivePermissions` out of `lib/permissions.ts`.
- Component extraction of inline tab functions in `base-config/setup/page.tsx`.
- `audit-panel.tsx` per-row internal styling refresh (1.6K LOC).
- `/parking/page.tsx` component extraction (~4.7K LOC).
- "Advisories" → "WWA Notifications" UI sweep.
- Outage analytics, training management, Part 139 civilian template.
- CAC/PIV authentication (blocked on Platform One).

---

## Build snapshot

```
TypeScript clean (npx tsc --noEmit exit 0)
Tests: 253 pass / 25 files (unchanged)
Build: npm run build clean — no warnings, no errors.
No new migrations this session.

Notable First Load JS (changed routes this session):
  /training                             5.03 kB / 193 kB    (was 21.6 kB / 134 kB; -16 kB local — content moved to lib/training/modules.ts and components/training/)
  /training/[module-id]                 3.8 kB / 182 kB     (NEW dynamic route for per-module deep-dive)
  /activity                             — (Events Log; restructured but route size unchanged)
  /more                                 7.35 kB / 201 kB    (was 7.52 kB; HelpRow removed)
  /login                                10.2 kB / 166 kB    (was 10.2 kB; error display + version bump)

Largest static page (unchanged): /wildlife 458 kB / 793 kB.
Middleware: 74.5 kB.
Shared by all: 91.2 kB.
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **2.33.0** | 2026-05-02 (this session bump) | Glidepath Training rebuilt at /training as role-filterable hub + per-module deep-dive subpages with Mark Reviewed toggle; click-through tour torn down; PPR module; Daily Reviews; offline write queue + Workbox runtime caching; permission matrix overhaul + 3 new roles; Events Log structure-first refresh; auth fix for invite/signup/reset emails landing on correct screen; forgot-password sends branded email. |
| v2.32.0 | 2026-04-21 | Modular Onboarding, SCN, Close-for-Day, What's New modal |
| v2.31.0 | 2026-04-07 | Full Google Maps migration, Custom Status Boards, PPR Log |
| v2.30.0 | 2026-04-14 | Daily Reviews + shift sign-off, ARFF status log, Vitest scaffold |

See `CHANGELOG.md` for full history.

---

## Key docs / files touched this session

### New files

- `lib/training/modules.ts` — `ModuleRef` type + 27 module entries (the canonical data source for /training).
- `lib/training/use-reviewed.ts` — hook for Mark Reviewed toggle persistence.
- `app/(app)/training/[module-id]/page.tsx` — per-module deep-dive subpage (9-section layout).
- `components/training/role-chip-filter.tsx` — multi-select role filter chips.
- `components/training/module-card.tsx` — tile-grid card.
- `app/api/forgot-password/route.ts` — anonymous Resend-backed password reset endpoint (committed in `fc1ff35`).
- `C:/Users/cspro/.claude/projects/C--Users-cspro/memory/feedback_page_tour_recipe.md` — page-feature tour authoring conventions (kept; still applies if a future page tour is built).
- `C:/Users/cspro/.claude/projects/C--Users-cspro/memory/feedback_no_snake_case_prose.md` — never use snake_case role identifiers in user-facing copy.

### Modified files

- `app/(app)/training/page.tsx` — rewritten from scratch as role-filterable hub.
- `app/(app)/activity/page.tsx` — Events Log structure-first refresh.
- `app/(app)/parking/page.tsx` — `glidepath:tour-parking-*` event listeners + 4 new anchors (committed in `1b1367c`).
- `app/(app)/more/page.tsx` — removed HelpRow.
- `components/layout/sidebar-nav.tsx` — removed HelpMenu slot.
- `components/welcome-gate.tsx` — non-admin variant points at /training.
- `components/tour/tour-launcher.tsx` — only registers setup-wizard tour now.
- `components/tour/OnboardingTour.tsx` — `dispatchOnEnter` + arrow-key nav (committed in `e833639`).
- `lib/tours/state.ts` — added `unmarkTourCompleted`.
- `lib/release-notes.ts` — new 2.33.0 entry.
- `package.json`, `README.md`, `app/(app)/settings/page.tsx`, `app/login/page.tsx` — version strings to 2.33.0.
- `CHANGELOG.md` — [Unreleased] folded into [2.33.0]; new sections for training rebuild + tour teardown + auth fix + Events Log refresh.

### Deleted files

- `components/tour/HelpMenu.tsx`
- `lib/tours/sidebar-tour.ts`
- `lib/tours/mobile-tour.ts`

### Environment changes

None this session.

---

*Three commits this session pushed to `origin/main` (`cfed596` → `e833639` → `fc1ff35` → `1b1367c`). After that the pivot work + Events Log refresh + 2.33.0 bump remain uncommitted on disk pending one final commit + push to ship 2.33.0.*
