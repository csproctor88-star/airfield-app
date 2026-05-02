# Session Handoff

**Date:** 2026-05-01 (cont.)
**Branch:** `main` (pushed)
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓, `npx vitest run` ✓ (253 pass)
**HEAD:** `2dafc52` (origin/main)

---

## What shipped this session

Phase 2 of the `/base-config` revamp landed end-to-end. Phase 1 (last
session) split admin work out of `/settings` into a dedicated
`/base-config` hub but left the wizard itself untouched. This session
rebuilt the wizard chrome, layered onboarding + Quick Setup on top of
it, wired per-field tooltips across all 15 in-file tab functions, and
deleted the Preview Dashboard the user vetoed as excessive. Four
commits, all on `main`, all pushed. Two additive migrations committed
but **not applied** — apply before next dev run or tour state and
Quick Setup save will silently no-op.

### Phase 2 chrome refresh + IAW Compliance guidance (`f9a26b1`)

The headline commit. Rebuilt `/base-config/setup` chrome around five
new components in `components/base-setup/` plus a single
source-of-truth content map at `lib/base-setup-guide.ts` (~360 LOC,
in-depth copy for all 16 steps). Internal logic of the 16 tab
functions is untouched — only the page-level chrome that wraps them.

**StepperRail** replaces the old 28×28 numbered-circle row with
labeled pills, status icons keyed off complete (`✓`) / current (`◉`)
/ pending (`·`) / required-but-empty-after-touch (`⚠`) /
optional (`⊘`). Responsive grid (`auto-fit`, 160 px min) wraps
cleanly; the rail auto-scrolls the current pill into view on mount so
mobile lands where the admin expects.

**KioskUrlChip** demotes the standalone Kiosk URL panel — which ate
40 % of the mobile viewport on every step — to a compact pill in the
top-right of the back-link row, with the same generate / regenerate /
disable / copy actions hidden behind a click-out dropdown. Token-set
pill goes solid-success at rest so admins still see active state at a
glance.

**GuidePanel** is the right-column 6-section detail that anchors the
new redesign: What this step does · How it works · Why it matters ·
Required? · Examples · IAW Compliance. The compliance section reads
as an attestation, not a footnote, generated from a
`cite: { reg, para, outcome }` triple per step so a future DAFMAN
revision is a mechanical paragraph-number swap. Per-step collapse
state persists to `localStorage`; the heaviest steps (Lighting,
Runways) auto-collapse to a 56 px rail by default to give those dense
forms breathing room.

**AutoSavePill** in the bottom nav row surfaces the *existing*
per-tab Supabase saves as a pill — no new auto-save logic. Each tab
already calls `toast.success()` after a successful write; this pass
added one `markSaved(stepKey)` call alongside it (15 wirings, no
behavior change). Pill cycles `Saving…` → `Auto-saved Xs ago` →
`All changes saved (Xm ago)` after 30 s.

Container widened 800 → 1200 px to give the Guide panel room. Step
body wrapped in a 200 ms fade/slide CSS transition keyed off
`step.key` (honors `prefers-reduced-motion`). Old gradient Next /
Complete buttons swapped to the canonical solid cyan / success
recipes already in use across the app.

`/base-config/setup` First Load JS 44 kB → 55.4 kB / 241 kB → 256 kB
on this commit, within the planned ±20 kB allowance. Final state at
end of session is 60.2 kB / 260 kB after the next two commits + the
Preview Dashboard removal.

### First-run tour + Quick Setup pre-fill (`1743c80`)

Layered the originally-Phase-3 onboarding bits on top of the chrome
refresh, minus the live preview pane the user vetoed.

**OnboardingTour** is hand-rolled (no `react-joyride` dep). Six
popcorn bubbles walk a fresh sys_admin through the labeled stepper,
Guide panel, `(?)` field hints, auto-save pill, and Quick Setup
button. Anchors via `data-tour="<id>"` attributes scattered across
the chrome components from the prior commit; spotlight ring auto-
positions via `getBoundingClientRect()` and re-measures on resize /
scroll. Tour reads / writes `profiles.has_completed_setup_tour`
(migration `2026050200`); Skip and Done both write the flag true. A
"Replay tour" link in the wizard header re-launches without changing
the flag.

**Quick Setup** opens a confirmation modal that calls
`/api/airport-lookup` for the base ICAO and shapes the response into
a `QuickSetupDraft` covering the 5 derivable steps (Runways / Areas /
NAVAIDs / Lighting / Inspection Templates). The 11 base-specific
steps (Shops, ARFF Vehicles, Facilities, Shift Checklist, QRC, SCN,
Wildlife, Status Boards, PPR Cols, Feedback, Taxiways) stay manual
and are listed in the modal so admins know what they'll still do
themselves.

The commit semantics matter: nothing writes to live tables when the
modal confirms. The draft stages to `bases.quick_setup_pending`
JSONB (migration `2026050201`); the `<QuickSetupBanner>` then renders
above the step body on each pre-filled step, and the admin clicks
"Confirm step" on each one to commit. `commitQuickSetupStep` calls
the same INSERT paths as manual entry (so RLS, FK constraints, and
type-shop-mapping side-effects all behave identically) and clears the
entry from the pending JSONB. Lighting drafts use DAFMAN A3.1
templates per runway end (Edge, End, Threshold, PAPI). Areas derive
from `lookup.suggested_areas` plus the runway list. Templates trigger
`createDefaultTemplate('airfield')` + `createDefaultTemplate('lighting')`.

Both migrations are additive, no backfill, no RLS rewrites — but
**neither is applied yet**. The dev server runs without them; the
tour-state read silently fails (column missing) so the tour just
doesn't fire on first load, and Quick Setup save errors out instead
of staging. Apply via `supabase db push` or paste both `.sql` files
into the SQL editor before testing those flows.

### FieldHint wiring across 15 tabs (`f122610`)

`FieldHint` shipped in `f9a26b1` as an unwired component. This pass
added ~50 `<FieldHint stepKey=… fieldId=… />` placements across the
15 in-file tab functions, so admins now see `(?)` hover/click
tooltips with concrete examples on every DAFMAN-cited field.

Coverage isn't uniform: the heaviest forms get the most coverage.
Runways picks up all 17 fields × 2 forms (the inline `RunwayEditForm`
plus the add-runway form) plus the Established Airfield Elevation
header — 35 `<FieldHint>` placements on the runway step alone.
Lighting Systems wires the three new-system form fields (System Type
/ Runway-Taxiway / System Name). QRC wires the Title field in the
QRC editor. The remaining 11 tabs use placeholder-only inputs without
explicit labels, so they get one `<FieldHint>` at the section header
level (NAVAIDs, SCN Agencies, CE Shops, Facility Numbers, Wildlife
Species, Custom Status Boards, PPR Columns, Customer Feedback Form,
Inspection Templates, Shift Checklist Items). ARFF gets the Show CAT
toggle hint plus the SimpleListTab title hint.

`FieldHint` renders nothing if no copy is registered for the
`stepKey.fieldId` in `lib/base-setup-guide.ts`, so adding more
coverage later is one-line additions to the guide map.
`/base-config/setup` First Load JS 60.3 kB → 61.2 kB.

### Drop Preview Dashboard, flag citations (`2dafc52`)

User pinned that live previews of running app surfaces are excessive
for admin guidance — the Guide panel's written explanation does the
same job better, which is why the per-step live-preview pane was cut
from Phase 2 scope before it was ever built. The general-purpose
"Preview Dashboard" button at the bottom of every wizard step was the
same pattern in slightly different clothes, so it went too: ~215
lines of `DashboardPreview` component + the toggle button + the
`showPreview` state. `/base-config/setup` 61.2 kB → 60.2 kB.

Same commit added a heads-up comment at the top of
`lib/base-setup-guide.ts` noting that the DAFMAN / UFC / AFMAN / AF
Form citations were authored from general knowledge and need
verification before being relied on as compliance attestations. User
flagged a couple that referenced the wrong document; full audit
pending. The `cite: { reg, para, outcome }` triple per step makes the
fix mechanical once the right paragraph numbers are in hand.

---

## Migrations status

Two new migrations this session, both committed and applied.

| Migration | Status | What it does |
|---|---|---|
| `2026050201_bases_quick_setup_pending.sql` | ✅ Applied | Adds `quick_setup_pending JSONB NOT NULL DEFAULT '{}'` to `bases`. Stages Quick Setup pre-filled drafts per step until admin confirms. RLS unchanged — `bases` policies cover it via the permission matrix. |
| `2026050200_profiles_setup_tour_flag.sql` | ✅ Applied | Adds `has_completed_setup_tour BOOLEAN NOT NULL DEFAULT FALSE` to `profiles`. Gates the first-run onboarding tour overlay. RLS unchanged — `profiles` policies cover user-own-row. |
| `2026050100_library_perms_sys_admin_only.sql` | ✅ Applied (prior session) | Locks `library:view` + `library:manage` to sys_admin only. |
| `2026042907_add_construction_other_check_types.sql` | ✅ Applied | (carryover) `airfield_checks_check_type_check` accepts `'construction'` and `'other'`. |
| `2026042906_drop_ppr_arrival_eta_zulu.sql` | ✅ Applied | (carryover) Drops `ppr_entries.arrival_eta_zulu`. |

---

## Bugs fixed during the session

No bugs fixed this session — Phase 2 was greenfield-on-Phase-1, no
debug excursions. The closest thing was the stale `.next` cache that
threw `Cannot find module './1682.js'` after the first Quick Setup
build; `rm -rf .next && npm run build` cleared it. Worth knowing for
the next time chunked output suddenly disappears mid-session.

---

## Lessons from this session

- **Citations need verification before being authoritative.** Saved
  the IAW Compliance language as a feedback memory
  (`feedback_dafman_compliance_language.md`) earlier in the session,
  but the actual paragraph numbers + regulation choices in
  `lib/base-setup-guide.ts` need a proper audit against source
  documents. The format is right; the content is unverified. The
  in-file comment at the top of `base-setup-guide.ts` flags this for
  future-me / future-collaborator.

- **Live previews of app surfaces are not the right shape for admin
  guidance.** Saved as `feedback_admin_guidance_text_over_preview.md`.
  In-depth written guidance (the 6-section Guide panel) explains
  *why* a setting matters for compliance better than a static preview
  of the configured surface ever could. Applies to any future config
  UI work in Glidepath.

- **`page.tsx` at 6 K LOC is workable with surgical edits.** Phase 2
  touched 6 distinct regions of the wizard page without rewriting any
  of the 16 inline tab functions. Adding `markSaved` was 15 separate
  one-line `Edit` calls; FieldHint wiring was ~50 separate `Edit`
  calls. Stable so long as the `old_string` carries enough context
  to be unique. Component extraction of those 16 tab functions out
  of the page file is still tech debt, but not blocking.

- **Migrations that aren't applied silently degrade features instead
  of crashing.** Both `2026050200` and `2026050201` are
  `ADD COLUMN ... DEFAULT ...` — the missing columns cause
  `select … has_completed_setup_tour` and
  `update bases set quick_setup_pending = …` to fail at the row
  level, but the page still loads. Tour just doesn't fire; Quick
  Setup save errors with a `column does not exist` toast. Easy to
  miss in dev unless you're specifically looking for the tour or
  Quick Setup. Best practice: surface "migration pending" in the
  handoff prominently.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| DAFMAN / UFC / AFMAN citations in `lib/base-setup-guide.ts` need verification | Medium | New this session. User flagged a couple as referencing wrong document; full audit pending. Format is `IAW {reg} §{para}, satisfies the requirement to {outcome}` — easy fix once correct paragraphs are in hand. Comment at top of file flags it. |
| `lib/permissions-server.ts` imports `resolveEffectivePermissions` from a `'use client'` module | Medium | (Carryover) Move `resolveEffectivePermissions` (pure function, no React) out of `lib/permissions.ts` into a shared module. Only remaining server-side caller of `getPermissionsFor` is `/users`. |
| Hex-alpha-concat sweep still incomplete | Low | (Carryover) Codebase-wide grep for `\$\{[a-zA-Z_.]+\}[0-9A-Fa-f]{1,2}\b` would surface remaining cases. |
| `audit-panel.tsx` per-row internal rows still raw | Low | (Carryover) The hub-level structural pass on `/infrastructure` skipped the dense per-row "Light, electrical light…" list. 1.6K LOC of its own. |
| `/infrastructure` perf carryover (layer-toggle full-rebuild, health-ring `Circle` volume) | Low–Medium | (Carryover) Smooth on dev laptops, may stutter on weaker hardware. Migration target: `AdvancedMarkerElement`. |
| `base-config/setup/page.tsx` is now ~5.8 K LOC | Held | Was 6 K — Preview Dashboard removal trimmed ~215 lines, Phase 2 chrome regions added ~140 net. Component extraction of the 16 inline tab functions is the next big refactor; explicitly multi-session. |
| Largest source files: `parking/page.tsx` ~4.3K LOC, `infrastructure/page.tsx` ~4.1K LOC, `base-config/setup/page.tsx` ~5.8K LOC | Held | (Carryover) Component extraction explicit multi-session work. |
| `FieldHint` coverage skews to header-level on placeholder-only tabs | Low | New this session. NAVAIDs, SCN, Shops, Facilities, etc. each get one section-header hint instead of per-input hints. Adding inline hints to those add forms is a follow-up commit when add-form labels are reworked. |
| Untracked `dark logo.jpg` (2.4MB) | Low | (Carryover) `/public` from a prior logo experiment. |
| Untracked `docs/DEMO_LOGINS.md` | Low | (Carryover) |
| Untracked `.claude/` | Low | (Carryover) Local Claude Code settings (gitignored expectation). |
| Trademark | Low | (Carryover) CDW holds live "GLIDEPATH" Class 42 (SaaS) registration. |
| Discrepancy "Notes History" backfill | Optional (carryover) | Historical rows still have `CURRENT_STATUS: <enum>` in the DB; display rewrites on render. |
| Sequential PPR coordination | Deferred (carryover) | All assigned agencies see their work in parallel; no ordering. |
| Public PPR form file uploads | Deferred (carryover) |  |
| "Advisories" → "WWA Notifications" UI sweep | Deferred (carryover) | Glossary memory says "WWA Notifications"; running app still says "Advisories". |
| ~124 `as any` casts project-wide | Low | (Carryover) |
| PDF boilerplate duplication in 11 generators | Low | (Carryover) 5 already on `pdf-utils.ts`. |
| Check draft real-time sync deferred | Low | (Carryover) Two users could create duplicate drafts. |

---

## Next session tasks

The Phase 2 backlog is finished and migrations are applied. Two
follow-ups remain:

1. **End-to-end test `/base-config/setup`.**
   - First load as a fresh sys_admin → tour overlay launches; walk
     all 6 bubbles; confirm anchor positions (stepper / Guide panel /
     auto-save pill / Quick Setup button) align.
   - Skip tour → reload → tour does not re-launch. Replay link
     re-launches.
   - Click Quick Setup → modal lists 5 derivable + 11 manual steps;
     confirm; verify pre-fill banner appears on each derivable step;
     edit a NAVAID then click Confirm step → row writes to
     `navaid_statuses`, banner clears, status pill flips to ✓.
   - Hover `(?)` on at least one Runways field, one Lighting field,
     one section-header field — confirm tooltip text matches the
     intent.
   - Mobile viewport (<1024 px): Guide panel hides, stepper becomes
     horizontal scroll strip, Kiosk chip + Quick Setup button still
     fit in the header.
   - Auto-save pill: edit a runway → pill flashes Saving → Auto-saved
     0s ago → All changes saved (after 30 s).

2. **Audit the IAW Compliance citations in `lib/base-setup-guide.ts`.**
   User flagged a couple as referencing wrong documents. Verify each
   step's `cite: { reg, para, outcome }` triple against the actual
   regulation. Comment at top of the file flags this; the structure
   is right, the paragraph numbers and document choices need a human
   pass.

### Long-running carryover (bandwidth-permitting)

Pick from these only when the Phase 2 testing + citation audit is
complete or a customer asks:

- **`/training` (Glidepath Training) content refresh** — user said
  "training will need to be updated significantly" last session.
  Screenshots needed; user will provide. Untouched.
- Component extraction of the 16 inline tab functions out of
  `base-config/setup/page.tsx` (~5.8 K LOC). Explicit multi-session
  refactor.
- `FieldHint` per-input coverage on the placeholder-only tabs (most
  tabs currently get one section-header hint). Add inline hints when
  those add forms are reworked.
- `audit-panel.tsx` per-row internal styling refresh (1.6K LOC).
- `/parking/page.tsx` component extraction (~4.3K LOC).
- Move `resolveEffectivePermissions` out of `lib/permissions.ts`
  (`'use client'`) into a shared module so `lib/permissions-server.ts`
  doesn't transitively re-arm the client-reference-stub bug.
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
2 new migrations this session (both applied).

Notable First Load JS (changed routes this session):
  /base-config/setup                    60.2 kB / 260 kB    (was 44 kB / 241 kB; +16 kB / +19 kB)
  /base-config                          7.43 kB / 179 kB    (unchanged from Phase 1)
  /base-config/diagram                  4.96 kB / 176 kB    (unchanged)
  /base-config/modules                  5.05 kB / 176 kB    (unchanged)
  /base-config/templates                9.44 kB / 190 kB    (unchanged)

Largest static page (unchanged): /wildlife 458 kB / 793 kB.
Middleware: 74.5 kB.
Shared by all: 91.2 kB.
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-05-01 (cont.) (this session) | Phase 2 of the `/base-config` revamp finished. Wizard chrome at `/base-config/setup` rebuilt around 5 new components in `components/base-setup/` (`StepperRail`, `GuidePanel`, `KioskUrlChip`, `AutoSavePill`, `FieldHint`) plus a new content map at `lib/base-setup-guide.ts` (~360 LOC) covering all 16 steps with the IAW Compliance attestation format. First-run onboarding tour (hand-rolled, no `react-joyride`) gated on a new `profiles.has_completed_setup_tour` boolean. Quick Setup pre-fills 5 derivable steps from `/api/airport-lookup` + DAFMAN A3.1 templates, stages drafts to a new `bases.quick_setup_pending` JSONB, commits per-step on admin review. `(?)` field hint coverage across all 15 in-file tab functions. Preview Dashboard removed (215-LOC `DashboardPreview` component + button + state) per the user's "live previews are excessive" guidance. Citations in `lib/base-setup-guide.ts` flagged for verification. 4 commits, all pushed. 2 migrations committed but not yet applied. |
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

- `components/base-setup/StepperRail.tsx` — labeled stepper with 5 status keys, responsive grid, mobile auto-snap-to-current.
- `components/base-setup/GuidePanel.tsx` — right-column 6-section detail panel (What / How / Why / Required / Examples / IAW Compliance), per-step collapse persisted to localStorage, heavy steps auto-collapsed.
- `components/base-setup/KioskUrlChip.tsx` — header dropdown extracted from the inline Kiosk URL panel (parity with all generate / regenerate / disable / copy actions).
- `components/base-setup/AutoSavePill.tsx` — bottom-left save status pill (Saving → Saved Xs ago → All changes saved → error).
- `components/base-setup/FieldHint.tsx` — `(?)` lucide HelpCircle tooltip; click-to-pin + hover-to-peek; renders nothing if no hint copy registered.
- `components/base-setup/OnboardingTour.tsx` — hand-rolled 6-step popcorn walkthrough; spotlight ring + bubble; anchors via `data-tour` attributes.
- `components/base-setup/QuickSetupModal.tsx` — pre-fill confirmation modal + per-step `<QuickSetupBanner>`; commits via `commitQuickSetupStep` (same INSERT paths as manual entry).
- `lib/base-setup-guide.ts` — single source-of-truth content map for all 16 wizard steps. Per-step shape: `{ what, how, why, required, examples, cite: { reg, para, outcome }, fields }`. Citations need verification (comment at top of file).
- `lib/base-setup-quick-setup.ts` — Quick Setup derivation (`derivePreFillFromIcao` calls `/api/airport-lookup`), persistence (`saveQuickSetupDraft` / `loadQuickSetupDraft` / `clearQuickSetupStep`), commit (`commitQuickSetupStep`), and DAFMAN A3.1 lighting templates.
- `supabase/migrations/2026050200_profiles_setup_tour_flag.sql` — applied. Adds `has_completed_setup_tour BOOLEAN NOT NULL DEFAULT FALSE` to `profiles`.
- `supabase/migrations/2026050201_bases_quick_setup_pending.sql` — applied. Adds `quick_setup_pending JSONB NOT NULL DEFAULT '{}'` to `bases`.
- `C:/Users/cspro/.claude/projects/C--Users-cspro/memory/feedback_dafman_compliance_language.md` — pinned the IAW Compliance attestation format.
- `C:/Users/cspro/.claude/projects/C--Users-cspro/memory/feedback_admin_guidance_text_over_preview.md` — pinned the "in-depth text > live preview" guidance for admin config UIs.

### Modified files

- `app/(app)/base-config/setup/page.tsx` — 6 surgical regions: imports, page state, header swap, Kiosk panel deletion (now in chip), stepper swap, 2-col body wrap with Guide panel, bottom nav row with AutoSavePill. Plus 15 tab signature updates + 15 `markSaved` wirings + ~50 `<FieldHint>` placements + tour mount + Quick Setup mount + Preview Dashboard removal (~215 lines).
- `app/globals.css` — `@keyframes baseSetupStepEnter` step body fade-in + `prefers-reduced-motion` honor + media query hiding `aside[data-tour="guide-panel"]` below 1024 px.

### Reference files (read-only)

- `lib/modules-config.ts` — `WIZARD_STEPS`, `isWizardStepEnabled`, `isStepDone` (consumed by `StepperRail` + page).
- `app/api/airport-lookup/route.ts` — `/api/airport-lookup` endpoint (consumed by `derivePreFillFromIcao`).
- `lib/supabase/lighting-systems.ts` — `createLightingSystem` (consumed by `commitQuickSetupStep`).
- `lib/supabase/inspection-templates.ts` — `createDefaultTemplate` (consumed by `commitQuickSetupStep`).

### Environment changes

None this session.

---

*All 4 commits this session are on the `main` branch and pushed to
`origin/main` (`f9a26b1` → `1743c80` → `f122610` → `2dafc52`). Both
migrations applied. Untracked files (`.claude/`, `docs/DEMO_LOGINS.md`,
`public/dark logo.jpg`) remain carryover.*
