# Session Handoff

**Date:** 2026-05-26
**Branch:** `main` (Phase 3b + 3c commits land directly on main per project convention)
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓, `npx vitest run` ✓ (410 pass / 35 files)
**HEAD:** (latest Phase 3c-C commit — see `git log -1`)

---

## What shipped this session — Phase 3c (AEP recap below)

**Phase 3c of the FAA Part 139 commercial expansion** — the **Part 77
obstruction surface UI** — landed end-to-end on `main` in two
review-gated clusters (B → C). The Phase 1 engine foundation
(`PART77_SURFACES` + `getSurfaceSet` + `bases.obstruction_surface_set`)
was extended into a per-approach-type lookup, the evaluator gained a
Part 77 path, the obstruction tool gained a UFC/Part 77 picker, the
runway editor gained civilian-only FAA Approach Type + Category
dropdowns, and the detail page gained a collapsible surface-set
legend. 410 tests pass (376 baseline + 34 new across part77 +
obstruction-evaluation).

### Cluster B — Engine + schema + runway editor + tests (commit `1abe42d`)

- **Migration `2026060800_runways_faa_approach.sql`** applied: adds
  `base_runways.faa_approach_type` (6 §77.19 CHECK options) and
  `base_runways.faa_approach_category` (A-E informational).
- **Engine refactor (`lib/calculations/obstructions.ts`)**:
  `PART77_SURFACES` extracted into `PART77_DIMENSIONS` per-type map
  + `getPart77Surfaces(approachType)` lookup. `getSurfaces` and
  `evaluateObstructionAllRunways` signatures extended with
  `surfaceSet` + per-runway `approachType` (via `RunwayEvalInput`).
  New `evaluateObstructionPart77()` evaluator with 5 §77.19 surfaces,
  precision-approach two-segment slope encoding, Part-77-localized
  withinPrimary calc (geometry helper still hardcodes UFC 1,000 ft).
- **Spec correction**: the original Phase 1 `PART77_SURFACES.primary.halfWidth
  = 500` was actually the §77.19 precision width (1,000 ft total) not
  the non-precision default the comment claimed. New per-type map is
  spec-correct.
- **Runway editor** (`/base-config/setup` → Runways → Edit): two
  civilian-only dropdowns (FAA Approach Type + FAA Approach Category)
  inserted between basic-info row and End 1 fields, gated on
  `isCivilian()`.
- **Tests**: `tests/part77-surfaces.test.ts` 11 → 30 cases; new
  `tests/obstruction-evaluation.test.ts` (14 cases) on a synthetic
  east-west runway fixture pinning UFC regression + Part 77 per-type
  + multi-runway mixed-approach-type dispatch.

### Cluster C — Form picker + detail legend + handoff (this commit)

- **Surface Set picker** on `/obstructions` evaluation form: two
  side-by-side toggle cards (UFC 3-260-01 / FAA Part 77) defaulting
  to `getSurfaceSet(currentInstallation)`. Disabled when editing a
  saved evaluation (prevents silent recalculation drift). Warning
  chips for: any runway without a configured approach type, USAF base
  selecting Part 77 (what-if mode).
- **Collapsible "Surface Set Reference" legend** on
  `/obstructions/[id]` between the Controlling Surface and Surface
  Analysis cards. Lists every surface in the active set with color
  swatch + name + description + §77.19 / UFC reference. Defaults
  closed; uses base's current `obstruction_surface_set` (per-eval
  recording is future work — would need a new column on
  `obstruction_evaluations`).
- **`getAllRunways()`** in the obstruction page now passes each
  runway's `faa_approach_type` through `RunwayEvalInput.approachType`
  so multi-runway Part 77 evaluations correctly mix dimensions per
  runway.
- **Theme audit**: zero raw zinc / filled-amber classes; all picker /
  legend chrome uses `color-mix()` + theme vars.
- **`docs/PHASE_3C_VERIFICATION.md`** written following the Phase 3b
  template (pre-flight · mode-gating · per-route flow · cross-cutting
  · regression · failure triage · sign-off).
- **CHANGELOG entry** added under `[Unreleased]`.

---

## Migrations status (Phase 3c)

| File | Applied | What it does |
|---|---|---|
| `2026060800_runways_faa_approach.sql` | ✅ | base_runways gains faa_approach_type (6-value CHECK) + faa_approach_category (A-E CHECK) |

---

## Phase 3c known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| `obstruction_evaluations.surface_set` not persisted per-row | Medium | The detail-page legend uses the base's current `obstruction_surface_set`. If an admin changes the base setting after a save, prior evaluations re-render with the new set's legend. Add a per-row column in a future migration if pilots flag this. |
| `pointToRunwayRelation` still hardcodes UFC's 1,000 ft primary halfWidth | Low | `evaluateObstructionPart77` recomputes `withinPrimary` locally to work around it. Cleaner long-term: parameterize `pointToRunwayRelation`. Deferred to keep the Phase 3c diff focused. |
| Precision 2nd-segment edge cases | Low | The 50:1 / 40:1 split is encoded but real precision evaluations at 30-50 kft distances haven't been pilot-tested. Test fixture covers the math; real-world calibration during pilot phase. |
| KDRA demo seed doesn't set `faa_approach_type` | Low | Engine defaults to `non_utility_non_precision_low` on civilian bases when null — matches Phase 1 behavior. Demo seed refresh (deferred) should backfill with `non_utility_non_precision_3_4` or similar to match a Class IV story. |
| Map visualization of imaginary surfaces (overlay polygons) | Held | Engine + legend ship; visual overlay on the obstruction map is a future feature explicitly held out of Phase 3c scope. |
| Bulk "set all runways to type X" in the wizard | Held | Per-runway editing only. Multi-runway airports edit each runway individually. |

---

## What shipped earlier this session — Phase 3b recap (kept for context)

**Phase 3b of the FAA Part 139 commercial expansion** — the
**Airport Emergency Plan (AEP) module** — landed end-to-end on
`main` in four review-gated clusters (B → C → D → E). AEP
replaces SCN for civilian Part 139 bases per 14 CFR §139.325 and
AC 150/5200-31C.

The module is feature-complete: versioned plan with AE annual
sign-off, response-agency roster, monthly comms checks (forked
from SCN), §139.325(h/j) drill program, three PDF exports,
SMS SPI integration (zero new cron — rides on the existing
02:30 UTC pg_cron), wizard step, and 23 new tests.

### Cluster B — Schema + module wiring (commit `f49ced0`)

- **7 migrations applied** via `npx supabase db query --linked --file`:
  `2026060700` plans · `..701` response_agencies · `..702` drills ·
  `..703` comms_checks (+ child results) · `..704` RLS (matrix
  helpers on all 5 tables, EXISTS parent-gate on the child results
  table) · `..705` storage RLS for `aep-plans/*` + `aep-drills/*`
  (separate INSERT policy gated only on `aep:write` per the
  ARFF-chief permission shape lesson from 3a) · `..706` extends
  `_sms_seed_default_spis` + `_sms_compute_spi_measurements` with
  `aep_full_scale_drill_overdue` (SPI-005) and
  `aep_comms_checks_last_90d` (SPI-006), plus a DO-block backfill
  on every civilian base.
- **Module + sidebar + nav wiring**: `ModuleKey 'aep'` +
  `WizardStepKey 'aepagencies'` + new sidebar section "Airport
  Emergency Plan" + `/more` collapsible group + 5 stub pages so
  navigation lands cleanly.
- **Incidental Phase 2 fix**: `sidebar-nav.tsx` was referencing
  SMS icons (`ShieldAlert` etc.) that were never registered in
  `ICON_MAP` — silently fell back to `Home`. Added those + `Siren`
  for AEP + missing GROUP_ICONS for the SMS / Training / AEP
  section labels.
- Permission keys `aep:{read,write,sign}` and role grants on AE /
  AEP Coordinator / ARFF Chief / SMS Manager / Ops Supervisor /
  sys_admin / AFM / base_admin were already in Phase 1
  `2026052503` — no Phase 3b role-grants migration needed.

### Cluster C — CRUD layer + plan / agencies pages + wizard (commit `8730e90`)

- **`lib/supabase/aep.ts`** (~830 LOC) — types + label/color maps +
  pure functions (`nextFullScaleDue`, `nextAnnualReviewDue`,
  `summarizeCommsCheck`, `daysBetween` with midnight-UTC truncation
  per the Phase 3a `daysToExpiry` lesson) + Plan / Agency / Drill /
  Comms-Check CRUD. Every mutation wraps `logActivity()`.
- **`/aep/plan`** (~480 LOC) — active-plan card with FAA
  acceptance + AE sign-off + annual review countdown; draft editor
  with PDF upload; supersede via two-step `replaced_by_id` set;
  history table.
- **`/aep/agencies`** (~430 LOC) — roster grouped by
  `agency_role`; per-row primary/backup contact + radio + notes +
  active toggle + within-role move-up/down reorder.
- **Wizard step `aepagencies`** at slot 11 (shares the slot with
  `scnagencies` — mutually exclusive via `appliesTo`, so only one
  renders per mode). Quick-entry name + role + primary phone;
  deep-link to `/aep/agencies` for richer editing. Wires
  `markSaved('aepagencies')` per the Phase 2 chrome-refresh pattern.

### Cluster D — Comms checks + drills + AE dashboard (commit `ed3efd0`)

- **`/aep/comms-checks`** (~590 LOC) — direct fork of
  `/scn/page.tsx`. Differences: "This month's check" card (cadence
  monthly), additional `not_reached` status, 12-month history,
  backup-check concept removed.
- **`/aep/drills`** (~580 LOC) — drill program status chips
  (next full-scale due via `nextFullScaleDue`; tabletop count for
  current calendar year), schedule modal with agency multi-select,
  complete modal with per-participant attendance + AAR upload.
- **`/aep` AE dashboard** (~280 LOC) — 4-card summary using
  `nextAnnualReviewDue` + `nextFullScaleDue` + this-month-comms
  status + agency count, plus quick-action grid.
- **SMS SPI verification on KDRA**: ran
  `_sms_compute_spi_measurements(CURRENT_DATE)` after Cluster D
  apply — SPI-005 value=1 status='alert' (correct: no full-scale
  drills exist), SPI-006 value=0 status='alert' (correct: no comms
  checks yet, target ≥ 3, alert threshold ≤ 1). Both will flip on
  the next cron run after KDRA logs a drill / check.

### Cluster E — PDFs + tests + polish + handoff (this commit)

- **`lib/aep-pdf.ts`** (~440 LOC) — three generators returning the
  standard `{ doc, filename }` contract:
  - `generateAepPlanPdf` — plan metadata + FAA acceptance + AE
    sign-off block + response-agency roster grouped by role +
    plan history.
  - `generateAepDrillLogPdf` — year-scoped: roll-up table +
    per-drill detail blocks with scenario, attendance, AAR notes,
    findings.
  - `generateAepCommsCheckMonthlyPdf` — agency × check-date matrix
    with status-tinted cells (L/N/X/– glyphs), legend, exception
    footnotes. Forks `lib/scn-pdf.ts` with the additional
    `not_reached` status.
- **Wired to the AE dashboard** via a Plan / Drill Log (year picker)
  / Monthly Comms (month picker) export row.
- **`tests/aep.test.ts`** (+23 cases): `daysBetween` calendar-day
  truncation (regression test for the noon-UTC NOW vs midnight-UTC
  date shape), `nextFullScaleDue` 5 thresholds including the
  36-month boundary, `nextAnnualReviewDue` thresholds,
  `summarizeCommsCheck` Events Log format (3 cases), PDF smoke
  (empty + populated) for all three generators.
- **Light-mode QA**: zero raw `text-zinc-*` / `bg-zinc-*` /
  filled-amber classes in any new surface — all use `color-mix()`
  + theme vars per `feedback_theme_aware_tokens.md` +
  `feedback_amber_text_contrast.md`.
- **No-snake-case prose audit**: zero `aep_coordinator` /
  `accountable_executive` / `arff_chief` literals in user-facing
  copy (per `feedback_no_snake_case_prose.md`).
- **CHANGELOG entry** added to `[Unreleased]` covering Phase 3a
  Training (which had not been logged previously) + Phase 3b AEP.

---

## Migrations status

| File | Applied | What it does |
|---|---|---|
| `2026060700_aep_plans.sql` | ✅ | aep_plans table — versioned + AE sign + annual review |
| `2026060701_aep_response_agencies.sql` | ✅ | aep_response_agencies + CHECK-enforced role enum |
| `2026060702_aep_drills.sql` | ✅ | aep_drills + JSONB participants snapshot |
| `2026060703_aep_comms_checks.sql` | ✅ | aep_comms_checks + child aep_comms_check_results |
| `2026060704_aep_rls.sql` | ✅ | Matrix RLS on all 5 tables, EXISTS gate on child results |
| `2026060705_aep_storage_rls.sql` | ✅ | Separate INSERT policy on storage.objects for aep-* paths |
| `2026060706_aep_sms_spi_feed.sql` | ✅ | Extends SMS SPI compute + seed + DO backfill on civilian bases |

Tracker remains empty project-wide.

---

## Known issues / tech debt (deferred from Phase 3b)

| Item | Severity | Notes |
|---|---|---|
| `CRON_SECRET` still unset in Vercel | High before deploy | Carryover from Phase 3a — `/api/training-expiry-digest` returns 500 every fire until set. Phase 3b adds no new Vercel cron requirements (SMS SPI compute lives on pg_cron). |
| KDRA demo seed has no AEP rows | Low | Plan + agencies + a prior drill would make the demo story end-to-end. Deferred to a future Demo Regional Airport seed refresh. |
| AEP "supersede" is two writes, not transactional | Low | Idempotent retry resolves; worst case is a transient window where both rows show `replaced_by_id IS NULL`. If real-world feedback surfaces this, wrap in a SECURITY DEFINER RPC like SMS's `sign_sms_policy`. |
| Drill `participants` snapshot can drift from `aep_response_agencies` | Low | If an agency is renamed or deleted after a drill, the participants JSONB keeps the historical snapshot; the `agency_id` link may break. UI degrades gracefully. |
| Sidebar overdue badge for AEP | Low | Plan called for it; deferred per the same logic as 3a's training badge. The AE dashboard surfaces the chips when admins land on `/aep`. |
| Email digest for upcoming drill / annual review due | Medium | Useful but not in scope. Future work could ride on a generic "AEP expiry digest" Vercel cron. |
| AE-tier sign enforcement is soft (UI gate, not RPC) | Low | The annual-review action just stamps `last_reviewed_at` + `reviewed_by_user_id` via UPDATE; RLS gates on `aep:write`. UI gates the button on `aep:sign`. Tighten to a SECURITY DEFINER RPC if a pilot wants strict enforcement. |
| Public AEP-report intake | Held | Explicitly out of scope — AEP is internal, no public/[icao]/aep-report. |
| Plan-content templating inside Glidepath | Held | Plan is uploaded as a PDF artifact; we don't author AEP content inside the app. |
| Trademark | Held | Carryover. CDW holds the live "GLIDEPATH" Class 42 (SaaS) registration — legal critical path before commercial launch. |

---

## Lessons from this session

- **The SMS SPI feed pattern is the dual of the training-expiry-digest pattern.** Training shipped its own Vercel cron + `CRON_SECRET` requirement; AEP rides on the SMS pg_cron at 02:30 UTC that's already deployed. The difference: SMS SPI compute is a database-side aggregation that needs no app-layer coordination, while training-expiry-digest needs Resend access and an external secret. When choosing between adding a new cron vs. extending an existing compute function, prefer the latter — zero new infrastructure means zero new deployment requirements.

- **Per-cluster review gates kept the round-trip count at zero again.** Phase 3a's first lesson held: Phase 2 SMS (continuous build) produced three round-trip fixes after deploy; Phase 3a (per-cluster gates) produced zero; Phase 3b (per-cluster gates) again produced zero. The pre-existing SMS sidebar icon bug was caught incidentally during Cluster B because I had to add `ShieldAlert` for AEP anyway and noticed it was missing — the kind of incidental find that compounds when the iteration cycle is short enough to surface them.

- **Mutually-exclusive wizard steps can share a slot number.** `scnagencies` and `aepagencies` both render at wizard slot 11 because only one is visible per mode (USAF vs. civilian). Sharing the slot avoided renumbering the subsequent 5 steps — small UX continuity for existing admin progress trackers. The `isWizardStepEnabled` filter handles the visibility gate cleanly.

- **`daysBetween` lesson from Phase 3a generalized cleanly.** I exported `daysBetween` from `lib/supabase/aep.ts` as a top-level pure function (not buried as a helper) so both `nextFullScaleDue` and `nextAnnualReviewDue` reuse it, and the calendar-day truncation regression test (noon-UTC NOW vs midnight-UTC date string, expecting 30 not 29) lives once. Any future module that needs day-counting math can import the same helper.

---

## Build snapshot

```
TypeScript clean (npx tsc --noEmit exit 0)
Tests: 410 pass / 35 files (+57 from baseline 353; new this session:
       tests/aep.test.ts (+23) — daysBetween, nextFullScaleDue /
         nextAnnualReviewDue thresholds, summarizeCommsCheck, AEP PDFs
       tests/obstruction-evaluation.test.ts (+14) — UFC regression,
         per-approach-type Part 77 evaluation, multi-runway dispatch
       tests/part77-surfaces.test.ts (refactored 11 → 30) — per-type
         primary widths, approach slopes / lengths, horizontal radii)
Build: npm run build compiled successfully.

AEP routes (Phase 3b):
  /aep                   5.18 kB / 183 kB
  /aep/agencies          6.58 kB / 185 kB
  /aep/comms-checks      7.21 kB / 185 kB
  /aep/drills            7.46 kB / 186 kB
  /aep/plan              7.28 kB / 185 kB

Obstructions routes (Phase 3c picker + legend):
  /obstructions          13.6 kB / 189 kB  (was 11.2 kB / 187 kB)
  /obstructions/[id]     13.8 kB / 345 kB  (was 13.7 kB / 334 kB)

Middleware: 74.5 kB (unchanged).
Shared by all: 91.2 kB (unchanged).
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | — | **Phase 1 + 2 + 3a + 3b + 3c of FAA Part 139 commercial expansion** — `airport_type` dual-mode flag, civilian terminology / reg filter / PDF generators / wizard, SMS module (Phase 2), §139.303 Training module (Phase 3a, daily Vercel cron digest), **Airport Emergency Plan module (Phase 3b)** with versioned plan + agency roster + comms checks + drill program + 3 PDFs + 2 SMS-fed SPIs, **Part 77 obstruction surface UI (Phase 3c)** with per-approach-type engine (6 §77.19 variants), runway editor faa_approach_type/category dropdowns, surface picker, detail-page legend, 34 new tests. AMTR module merged to `main` (off-nav). Not merged-tag yet. |
| v2.33.0 | 2026-05-02 | prior released baseline (see CHANGELOG) |

---

## Next session tasks

**First:** verify Phase 3c end-to-end via `docs/PHASE_3C_VERIFICATION.md` on KDRA — wizard runway dropdowns + obstruction picker + detail legend + spec-correct dimensions. Walk Phase 3b verification doc at the same time if not yet completed.

**Then choose**:

1. **Phase 3d — Winter Ops / TALPA Field Condition Reports.** FICON NOTAM generator per AC 150/5200-30D: thirds-based RwyCC matrix, contaminants/depth/treatments, copy-paste output for FAA NOTAM Manager. Self-contained, smaller than AEP. Recommended next per parent plan sequence.

2. **Phase 3e — Wildlife Hazard Management Plan (WHMP) hooks.** Annual report upload + hazardous species list + mitigation summary, feeds SMS hazards. Lightweight — quickest of the remaining sub-modules.

3. **Set `CRON_SECRET` in Vercel.** Required for the Phase 3a training-expiry-digest to function. Generate a long random secret in Vercel dashboard → env vars → both production + preview.

4. **Push `main` to origin** — five Phase 3b commits + two Phase 3c commits + verification docs are all local-only.

5. **Demo seed refresh** — backfill KDRA with an AEP plan + 11 agencies + 1 prior drill + `faa_approach_type='non_utility_non_precision_3_4'` on each runway so the demo tour story works end-to-end for pilot conversations.

6. **Cross-phase super-doc** — composable `docs/VERIFICATION_ALL_PHASES.md` stitching `PHASE_3B_VERIFICATION.md` + `PHASE_3C_VERIFICATION.md` (and future 3d/3e) into one master walkthrough. User flagged this when Phase 3b's verification doc landed.

### Long-running carryover

- Acquire the 22 FAA regulation PDFs and populate `regulations.url` / `storage_path` for rows seeded by Phase 1 migration `2026052502`.
- Brief the Platform One sponsor on the dual-mode plan AND the SMS / AEP public-route exposure. Recommend `BUILD_TARGET=usaf` tree-shake.
- Trademark resolution (CDW "GLIDEPATH" Class 42 registration).
- Identify 3 Class III non-hub commercial airports for post-build pilot conversation.

---

## Key files touched this session

### New

- `supabase/migrations/2026060700_aep_plans.sql`
- `supabase/migrations/2026060701_aep_response_agencies.sql`
- `supabase/migrations/2026060702_aep_drills.sql`
- `supabase/migrations/2026060703_aep_comms_checks.sql`
- `supabase/migrations/2026060704_aep_rls.sql`
- `supabase/migrations/2026060705_aep_storage_rls.sql`
- `supabase/migrations/2026060706_aep_sms_spi_feed.sql`
- `lib/supabase/aep.ts` (~830 LOC CRUD + pure functions)
- `lib/aep-pdf.ts` (~440 LOC, 3 generators)
- `app/(app)/aep/page.tsx` (AE dashboard + PDF export row)
- `app/(app)/aep/plan/page.tsx`
- `app/(app)/aep/agencies/page.tsx`
- `app/(app)/aep/comms-checks/page.tsx`
- `app/(app)/aep/drills/page.tsx`
- `tests/aep.test.ts` (+23 tests)

### Modified

- `lib/modules-config.ts` — `ModuleKey 'aep'`, `WizardStepKey 'aepagencies'`, AEP module def
- `lib/sidebar-config.ts` — 5 nav items + new section
- `lib/base-setup-guide.ts` — full 6-section guide for the aepagencies wizard step
- `lib/supabase/types.ts` — Row/Insert/Update for 5 new tables
- `app/(app)/base-config/setup/page.tsx` — new `aepagencies` wizard step + `AepAgenciesTab` component (~210 LOC)
- `app/(app)/more/page.tsx` — Airport Emergency Plan collapsible group
- `components/layout/sidebar-nav.tsx` — registered ShieldAlert / Siren / TrendingUp / MessageSquareWarning / GitBranch in ICON_MAP (incidental Phase 2 fix); added GROUP_ICONS for SMS / Training / AEP sections
- `CHANGELOG.md` — comprehensive Unreleased section covering Phase 3a + 3b
- `SESSION_HANDOFF.md` — this file
