# Session Handoff

**Date:** 2026-05-26
**Branch:** `main` (in sync with `origin/main`)
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓, `npx vitest run` ✓ (452 pass / 37 files)
**HEAD:** `81e59d0`

---

## What shipped this session

**Phase 3 of the FAA Part 139 commercial expansion completed end to
end.** All four remaining sub-modules (3b AEP → 3c Part 77 obstruction
UI → 3d Field Conditions/TALPA → 3e WHMP) shipped on `main` in 13
commits across 4 review-gated phases, plus a KDRA demo seed and a
cross-phase verification super-doc. With Phase 3a (Training) from the
prior session, the civilian Part 139 retrofit is now feature-complete
for Class III/IV airports — the build-first commitment is met and the
codebase is ready for pilot recruitment with a complete-product demo.

Per-cluster review gates held: zero post-deploy round-trip fixes
across all four sub-modules, mirroring the Phase 3a pattern.

### Phase 3b — Airport Emergency Plan (`f49ced0`, `8730e90`, `ed3efd0`, `867eea6`, `5a5aa41`)

AEP replaces SCN for civilian Part 139 bases per 14 CFR §139.325. Five
clusters: schema + module wiring → CRUD + plan/agencies UI →
comms-checks + drills + AE dashboard → PDFs + tests + handoff →
verification doc. 7 migrations (`2026060700`–`706`), 5 new routes
(`/aep`, `/aep/plan`, `/aep/agencies`, `/aep/comms-checks`,
`/aep/drills`), three PDF generators (plan / drill log / monthly comms
matrix), 23 new tests. The SMS SPI integration was the cleanest part —
two new computation keys (`aep_full_scale_drill_overdue` +
`aep_comms_checks_last_90d`) appended to the existing
`_sms_compute_spi_measurements` RPC + a `DO` block backfill on every
civilian base. The pg_cron at 02:30 UTC picks up the new SPIs
automatically: zero new cron infrastructure (contrast with the
training-expiry-digest from 3a which needs a Vercel cron + secret).

Incidental Phase 2 fix during Cluster B: `sidebar-nav.tsx` had
referenced `ShieldAlert`, `TrendingUp`, `MessageSquareWarning`,
`GitBranch` from the SMS module without registering them in
`ICON_MAP` — all silently fell back to the `Home` icon. Added those
plus `Siren` for AEP and `CloudSnow` later for Field Conditions, plus
GROUP_ICONS for the SMS / Training / AEP section labels.

### Phase 3c — Part 77 obstruction surface UI (`1abe42d`, `b9aafc4`)

Wired the Phase 1 `PART77_SURFACES` engine foundation into the
obstruction tool UI. Two clusters: engine + schema + runway editor +
tests → form picker + detail legend + handoff.

The engine work expanded beyond the original parent-plan scope: the
hardcoded `PART77_SURFACES` constant became `PART77_DIMENSIONS`, a
`Record<FaaApproachType, Part77SurfaceSet>` with all 6 §77.19 dimension
variants. A new `evaluateObstructionPart77()` function evaluates the 5
Part 77 surfaces (no UFC-only outer-horizontal, clear-zone, or APZ
zones) and handles the precision approach's two-segment slope (50:1
first 10 kft + 40:1 next 40 kft) via `secondSegmentSlope` +
`segmentLength`. `evaluateObstructionAllRunways` accepts `surfaceSet`
+ per-runway `approachType` via a new `RunwayEvalInput` shape; existing
USAF callers compile unchanged via defaults.

Spec correction surfaced during the refactor: the original Phase 1
`PART77_SURFACES.primary.halfWidth = 500` was actually the §77.19
*precision* width (1,000 ft total), not the non-precision default the
comment claimed. New per-type map encodes spec-correct numbers across
all 6 categories (utility-visual 250 ft total, non-utility-precision
1,000 ft total, etc.).

Migration `2026060800` adds `base_runways.faa_approach_type` (6-value
CHECK enum) and `.faa_approach_category` (A-E informational). Runway
editor in `/base-config/setup` gains two civilian-only dropdowns;
`/obstructions` gains a UFC/Part 77 picker; `/obstructions/[id]` gains
a collapsible color-keyed legend. 34 new tests across
`tests/part77-surfaces.test.ts` (refactored 11 → 30) and the new
`tests/obstruction-evaluation.test.ts`.

### Phase 3d — Field Conditions / TALPA (`24bf162`, `3cf2518`)

Per AC 150/5200-30D, civilian airports issue Field Condition Reports
(FCRs) any time runway surface conditions degrade. Two clusters: schema
+ RwyCC engine + CRUD + module wiring + tests → full UI page +
verification doc + handoff.

Engine in `lib/calculations/rwycc.ts` implements AC 30D Table 4-1
across all 13 contaminants (dry / wet / frost / slush / dry-snow /
wet-snow / compacted-snow / ice / ice-patches / wet-ice /
slippery-when-wet / water-on-compacted-snow / slush-on-ice) with
depth + temperature edge thresholds (wet >1/8" → 3, dry-snow >1" → 3,
compacted-snow temp-dependent <-15°C → 4 / -15 to -3 → 3 / >-3 → 2).
`buildFiconNotamText()` emits the AC 30D §6 body: `RWY <id>
<CC>/<CC>/<CC> <cov>/<cov>/<cov> PCT <contaminants>[ <depth>IN][ TRTD
W/<treatments>]`. Depth uses the deepest third; contaminant tokens
listed in TD→RO order with duplicates collapsed; treatments emit as
`TRTD W/PLOW W/SAND` etc.

`field_condition_reports` is append-only with `superseded_by_id`
chain; `field_condition_thirds` stores per-third assessment with
`rwycc_derived` + `rwycc_manual_override` + `override_reason`
(required if overriding). UI is a single-screen modal (not a wizard —
operators in cold trucks with gloved fingers need minimum screen
transitions) with a live FICON preview at the bottom that updates as
the operator edits. Save auto-copies the FICON text to clipboard.

7 new permission keys (`field_conditions:{read,write}` + role grants
across 7 roles) seeded in `2026060900`. 34 new tests in
`tests/rwycc.test.ts`. `/field-conditions` route lands at 11 kB / 185
kB.

### Phase 3e — Wildlife Hazard Management Plan (`319464a`, `2648d43`)

The smallest of the four sub-modules (single table, single CRUD file,
single page). Two clusters: schema + CRUD + UI + tests → verification
doc + handoff. Per 14 CFR §139.337, civilian airports with significant
wildlife hazards maintain an annual WHMP — Glidepath now hosts the PDF
artifact, the AE annual sign-off, the hazardous-species register
(JSONB), the mitigation summary, and findings (JSONB) that can deep-
link into the SMS hazard register.

Single migration `2026061000` reuses existing `wildlife:{read,write}`
permission keys rather than proliferating WHMP-specific keys
(operationally the wildlife / BASH coordinator is the WHMP owner).
Append-only with `replaced_by_id` chain for in-year amendments. One
row per `(base, assessment_year)` enforced by UNIQUE constraint.

"Promote to SMS Hazard" is intentionally a query-param deep-link
(`/sms/hazards/new?prefill_title=…&prefill_source=whmp&…`) rather than
a tight RPC integration — the operator completes the SMS hazard form
manually and returns to WHMP to back-fill the linked hazard code via a
"Mark Linked" dialog. v1 ships with the deep-link encoder + URL
generation tested; the SMS hazard form doesn't yet *read* those
params (known follow-up). 8 new tests in `tests/whmp.test.ts`.

`nextWhmpReviewDue` reuses `daysBetween` from `aep.ts` — the
midnight-UTC truncation helper from Phase 3a's `daysToExpiry` lesson
generalized cleanly across three modules now (AEP annual review, WHMP
annual review, AEP full-scale drill due).

### KDRA demo seed refresh (`c16e2fa`)

Added `supabase/seed-demo-civilian-phase3.sql` — idempotent SQL that
backfills the Demo Regional Airport with end-to-end sample data for
each Phase 3 sub-module: runway approach type/category (3c), AEP plan
+ 6-agency response roster + completed tabletop drill (3b), 2
historical FCRs from a Feb 8 snow event with proper supersede chain
(3d), 2026 WHMP filed by USDA Wildlife Services with 3 species + 2
findings + AE sign-off (3e). Each section uses ON CONFLICT or check-
first-then-insert; re-runs are no-ops. Demo tour story now works
end-to-end on KDRA for pilot conversations.

### Cross-phase verification super-doc (`81e59d0`)

`docs/VERIFICATION_ALL_PHASES.md` — master walkthrough composing
Phase 1 (foundation) + Phase 2 (SMS) + Phase 3a–3e into one ordered
end-to-end pass on KDRA. Each phase section has pre-checks + worked
flow + permission gating table + failure triage (~50–80 lines per
phase). Cross-cutting sections: master pre-flight, mode-gating matrix
(USAF vs civilian across every divergence point), regression smoke,
theme + mobile audit, master failure triage, sign-off block with one
row per phase.

§7 "Extending This Doc" is the 8-step template for adding new phases
as they ship — keeps the super-doc growing in lockstep with the
codebase. Standalone PHASE_<N>_VERIFICATION.md docs remain for deep
dives; the super-doc holds the master walkthrough.

---

## Migrations status

All 9 migrations applied to the linked Supabase instance. Per
`reference_supabase_cli_npx.md`: `npx supabase db query --linked --file
<path>` is the only safe invocation (no global supabase install).

| File | Applied | What it does |
|---|---|---|
| `2026060700_aep_plans.sql` | ✅ | aep_plans table — versioned + AE annual review + supersede chain |
| `2026060701_aep_response_agencies.sql` | ✅ | aep_response_agencies + CHECK-enforced role enum |
| `2026060702_aep_drills.sql` | ✅ | aep_drills + JSONB participants snapshot |
| `2026060703_aep_comms_checks.sql` | ✅ | aep_comms_checks + child aep_comms_check_results |
| `2026060704_aep_rls.sql` | ✅ | Matrix RLS on all 5 AEP tables; EXISTS parent-gate on child results |
| `2026060705_aep_storage_rls.sql` | ✅ | Separate INSERT policy on storage.objects for aep-plans/* + aep-drills/* |
| `2026060706_aep_sms_spi_feed.sql` | ✅ | Extends `_sms_compute_spi_measurements` + `_sms_seed_default_spis` with 2 AEP-driven SPIs + DO-block backfill on every civilian base |
| `2026060800_runways_faa_approach.sql` | ✅ | base_runways gains faa_approach_type + faa_approach_category (both CHECK-enforced) |
| `2026060900_field_conditions.sql` | ✅ | 2 FCR tables + field_conditions:* perms + role grants + matrix RLS |
| `2026061000_wildlife_hazard_assessments.sql` | ✅ | wildlife_hazard_assessments + matrix RLS (reuses wildlife:*) + storage RLS |

Demo seed `supabase/seed-demo-civilian-phase3.sql` also applied
(idempotent — re-runnable for KDRA reset workflows).

Migration tracker remains empty project-wide (the convention is
manual application via `db query --linked --file`).

---

## Bugs caught during the build

| Symptom | Root cause | Commit |
|---|---|---|
| Phase 2 SMS sidebar icons all rendered as `Home` | `sidebar-nav.tsx` ICON_MAP missing `ShieldAlert`, `TrendingUp`, `MessageSquareWarning`, `GitBranch` — Phase 2 had imported them but never registered. Silent fallback to `Home`. | `f49ced0` (3b Cluster B) — fixed incidentally while adding Siren + CloudSnow for AEP / Field Conditions |
| `PART77_SURFACES.primary.halfWidth = 500` claimed "non-precision default" but was actually the §77.19 precision width | Phase 1 implementation typo — 500 = 1,000 ft total (precision); spec-correct non-precision is 250 = 500 ft total | `1abe42d` (3c Cluster B) — new `PART77_DIMENSIONS` map encodes all 6 spec-correct variants |
| `tests/permission-keys-drift.test.ts` failed after Phase 3d migration | New `field_conditions:read|write` keys in the DB catalogue but not in `lib/permissions.ts` PERM constants — drift test catches this | `24bf162` (3d Cluster B) — added `PERM.FIELD_CONDITIONS_READ` / `WRITE` |
| Cluster B obstruction-evaluation test fixture off by 200 ft | Test placed a point 100 ft beyond runway end on centerline expecting approach-departure surface, but UFC primary surface extends 200 ft beyond the threshold via `extension` field — point was still inside primary | `1abe42d` (3c Cluster B) — moved fixture to 500 ft beyond threshold |

The `pointToRunwayRelation` geometry helper still hardcodes UFC's
1,000 ft primary halfWidth (Phase 3c flagged as known tech debt; the
Part 77 evaluator recomputes `withinPrimary` locally rather than
parameterizing the helper — deferred to keep the Phase 3c diff
focused).

---

## Lessons from this session

- **The per-cluster review gate pattern compounded.** Phase 3a shipped
  4 round-trip fixes lower than Phase 2 by adopting per-cluster gates.
  Phases 3b/3c/3d/3e all extended that pattern (2 clusters for the
  smaller modules, 4 for AEP) and produced zero round-trip fixes
  again. The gate cost is real — a forced pause between Cluster B and
  Cluster C is awkward when momentum is high — but each gate catches
  something that would otherwise become a post-deploy round-trip. The
  user explicitly chose to push through clusters in Phase 3b and 3e
  after seeing the first cluster land cleanly; that's the right call
  for small sub-modules but the gate option remains valuable for the
  bigger ones (AEP at 4 clusters benefited from each pause).

- **A pure-function helper that escaped one module saved work in three
  more.** `daysBetween` was extracted from Phase 3a's `daysToExpiry`
  test failure (noon-UTC NOW vs midnight-UTC date string → off-by-one),
  exported as a top-level helper from `lib/supabase/aep.ts` in Phase
  3b, then re-imported by Phase 3e WHMP without re-deriving the
  midnight-UTC truncation. Two-line import vs. a duplicate
  implementation that would have grown its own bug surface. **Pattern
  worth pinning: extract testable pure functions to module top-level
  on first use, not the second.**

- **A separate Part 77 evaluator was cheaper than refactoring the UFC
  evaluator.** I considered unifying UFC + Part 77 into one parameterized
  evaluator that takes a `surfaceSet` arg. The current
  `evaluateObstruction()` is 800+ LOC of hardcoded per-surface blocks;
  refactoring it would risk UFC regressions and require a
  parameterized `pointToRunwayRelation`. A parallel
  `evaluateObstructionPart77()` (250 LOC, 5 surfaces) was faster to
  write, regression-safe for USAF, and gave clean separation. The DRY
  pull is real but the safety + scope-control argument won.

- **Spec correctness > backward compatibility when the original was
  wrong.** The Phase 1 `PART77_SURFACES.primary.halfWidth = 500`
  numerically matched §77.19 precision-instrument dimensions despite
  the comment claiming non-precision. Phase 3c could have preserved
  the wrong number for backward compat; instead the new
  `PART77_DIMENSIONS` map encodes spec-correct values across all 6
  approach types and updates the tests to expect the corrected
  numbers. Re-pinning a buggy constant just propagates the bug;
  there's no civilian base in production yet so the blast radius is
  zero.

- **JSONB for "rich but not relational" data wins on speed and
  expressiveness.** Phase 3e's `hazardous_species` and `findings` are
  JSONB arrays on the WHMP row, not separate tables. A future schema
  migration could promote them, but for v1 the JSONB shape:
  (1) keeps the WHMP "one row per year" mental model intact,
  (2) avoids a 3-table CRUD layer, (3) writes/reads atomically with
  the parent. The "Mark Linked" UI gracefully back-fills
  `findings[i].sms_hazard_id` without a foreign key. **Pattern: JSONB
  for child collections that don't need to be queried independently
  or referenced by other tables.**

- **Materializing derived text at insert time pays off across
  modules.** Phase 3d's `field_condition_reports.ficon_text` and the
  pattern of computing the public-facing string once at save time
  rather than reconstructing it on every render — turned out useful
  for the FICON paste-into-FAA-NM workflow (operator gets the exact
  saved bytes, not whatever the renderer regenerates). Same pattern
  could apply to Phase 3b AEP comms-check summaries and Phase 3e WHMP
  finding summaries; held for now.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| `/sms/hazards/new` doesn't read `prefill_*` query params | Medium | WHMP "Promote to SMS Hazard" deep-link encodes prefill_title / prefill_description / prefill_source / prefill_source_ref_id; the SMS create form ignores them today. Operator manually pastes from URL. Small follow-up. |
| `pointToRunwayRelation` hardcodes UFC's 1,000 ft primary halfWidth | Low | `evaluateObstructionPart77` recomputes `withinPrimary` locally to work around it. Cleaner long-term: parameterize the geometry helper. Deferred to keep Phase 3c diff focused. |
| Precision approach 2nd-segment evaluation lacks real-pilot calibration | Low | 50:1 / 40:1 two-segment slope encoded and tested mathematically; real-world precision-instrument calibration during pilot phase. |
| AEP "supersede" is two writes, not transactional | Low | Idempotent retry resolves; worst case is a transient window with both rows appearing active. Could wrap in a SECURITY DEFINER RPC like SMS's `sign_sms_policy` if pilots flag. |
| AEP drill `participants` snapshot can drift from `aep_response_agencies` | Low | JSONB snapshots agency names at save time; rename / delete doesn't retroactively update drill history. UI degrades gracefully. |
| `obstruction_evaluations.surface_set` not persisted per-row | Low | Phase 3c detail-page legend uses the base's current `bases.obstruction_surface_set`. If admin changes the base setting after a save, prior evaluations re-render with the new set's legend. Add per-row column in a future migration if pilots flag. |
| WHMP `findings.sms_hazard_id` is a string with no FK | Low | Stored inside JSONB; cross-module reference without tight coupling. UI doesn't enforce the linked hazard exists. |
| SMS hazard auto-create on RwyCC ≤ 2 or WHMP severe species | Medium | Out of scope for v1; pilot trials should surface whether the auto-promote vs. manual handoff is right. |
| Annual reminder digest for AEP review / WHMP review | Medium | Phase 3a expiry digest could be extended to cover the AEP §139.325(d) and WHMP §139.337(c) annual reviews — would catch operators before they're overdue. |
| KDRA seed could include SMS hazard + AEP comms checks history | Low | Demo seed has Phase 1 + Phase 3 data; Phase 2 SMS hazards / completed comms checks are still empty. Optional enrichment for pilot demos. |
| `runway_class` CHECK constraint still narrow to `('B', 'Army_B')` | Low | Civilian runways set `runway_class='B'` which works but isn't civilian-accurate. The new `faa_approach_type` field is the civilian-correct driver; `runway_class` could be widened or made nullable. |
| Trademark: CDW holds the live "GLIDEPATH" Class 42 (SaaS) registration | Held | Legal critical path before commercial launch. |

---

## Next session tasks

**Phase 3 is complete.** The civilian Part 139 retrofit is feature-
complete for Class III/IV airports. The build-first commitment from
the parent plan is met. Next session has no required work — pick from
the menu based on appetite:

1. **Polish + release prep (v2.34.0).** Bundle audit, lint sweep,
   version bump in 5 places (per `feedback_phased_delivery.md` and
   the project memory's "5 places" rule), v2.34.0 CHANGELOG header,
   README + capabilities-doc updates, tag and push. Closes a release
   boundary for the whole Phase 3 cycle.

2. **Wire SMS hazard prefill.** Small follow-up to Phase 3e: edit
   `/sms/hazards/new` (or wherever the SMS hazard create form lives)
   to read `prefill_title`, `prefill_description`, `prefill_source`,
   `prefill_source_ref_id` from query params and pre-fill the form.
   Closes the one remaining manual-paste step in the WHMP →
   SMS workflow.

3. **Verify on iPhone PWA.** Walk
   `docs/VERIFICATION_ALL_PHASES.md` end to end via the Vercel
   preview. Surfaces any mobile UX issues before pilot recruitment.

4. **Pilot recruitment kickoff.** Identify the 3 Class III non-hub
   airports per the parent plan (FAA Great Lakes region recommended)
   and start outreach with a complete-product demo. **Trademark
   resolution** is the only true blocker before commercial launch.

### Long-running carryover

- Acquire the 22 FAA regulation PDFs and populate `regulations.url` /
  `storage_path` for rows seeded by Phase 1 migration `2026052502`.
- Brief the Platform One sponsor on the dual-mode plan AND the
  SMS / AEP public-route exposure. Recommend `BUILD_TARGET=usaf`
  tree-shake.
- Trademark resolution (CDW "GLIDEPATH" Class 42 registration).
- Demo seed could enrich Phase 2 SMS data (a few hazards + risk
  assessments + 1 completed audit) for fuller pilot demo coverage.

---

## Build snapshot

```
TypeScript clean (npx tsc --noEmit exit 0)
Tests: 452 pass / 37 files (+99 from baseline 353)
       tests/aep.test.ts (+23) — AEP pure functions + PDFs
       tests/obstruction-evaluation.test.ts (+14) — UFC regression +
         per-approach-type Part 77 + multi-runway dispatch
       tests/part77-surfaces.test.ts (refactored 11 → 30) — per-type
         dimensions across all 6 §77.19 variants
       tests/rwycc.test.ts (+34) — every Contaminant case × depth ×
         temperature thresholds + FICON text generator
       tests/whmp.test.ts (+8) — nextWhmpReviewDue + SMS hazard URL encoder
Build: npm run build compiled successfully.

New Phase 3 routes (this session + Phase 3a from prior):
  /aep                    5.18 kB / 184 kB
  /aep/agencies           6.61 kB / 185 kB
  /aep/comms-checks       7.24 kB / 186 kB
  /aep/drills             7.49 kB / 186 kB
  /aep/plan               7.31 kB / 186 kB
  /field-conditions       11.0 kB / 185 kB
  /wildlife/whmp          10.9 kB / 189 kB

Changed routes (Phase 3c + 3a regression):
  /obstructions           13.6 kB / 189 kB  (was 11.2 kB before picker)
  /obstructions/[id]      13.8 kB / 346 kB  (was 13.7 kB before legend)
  /training               1.84 kB / 102 kB
  /training/[userId]      14.6 kB / 340 kB
  /training/compliance    5.99 kB / 183 kB
  /training/roster        4.66 kB / 173 kB
  /training/topics        5.70 kB / 183 kB

Middleware: 74.5 kB (unchanged).
Shared by all: 91.2 kB (unchanged).
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | — | **Phase 1 + 2 + 3a + 3b + 3c + 3d + 3e of FAA Part 139 commercial expansion (Phase 3 complete)** — `airport_type` dual-mode flag, SMS module (Phase 2), §139.303 Training module (Phase 3a, daily Vercel cron digest), AEP module (Phase 3b) with versioned plan + agency roster + comms checks + drill program + 3 PDFs + 2 SMS-fed SPIs, Part 77 obstruction surface UI (Phase 3c) with per-approach-type engine + runway editor dropdowns + surface picker + detail-page legend, Field Conditions / TALPA module (Phase 3d) with RwyCC engine across all 13 contaminants + FICON NOTAM text generator + per-third assessment + append-with-supersede, WHMP module (Phase 3e) with annual assessment + hazardous species register + findings → SMS hazard deep-link. AMTR module merged to `main` (off-nav). KDRA demo seed end-to-end. Master verification doc covering Phase 1 → 3e. Not merged-tag yet. **Civilian Part 139 retrofit feature-complete.** |
| v2.33.0 | 2026-05-02 | prior released baseline (see CHANGELOG) |

---

## Key files touched this session

### New

- 9 migrations: `supabase/migrations/2026060700` through `2026061000`
- `supabase/seed-demo-civilian-phase3.sql` — idempotent KDRA refresh
- `lib/supabase/aep.ts`, `lib/supabase/field-conditions.ts`,
  `lib/supabase/whmp.ts` — three new CRUD modules
- `lib/calculations/rwycc.ts` — RwyCC engine + FICON text generator
- `lib/aep-pdf.ts` — 3 PDF generators
- `app/(app)/aep/page.tsx` + 4 sub-routes
- `app/(app)/field-conditions/page.tsx`
- `app/(app)/wildlife/whmp/page.tsx`
- 5 verification docs in `docs/`: `PHASE_3B_VERIFICATION.md`,
  `PHASE_3C_VERIFICATION.md`, `PHASE_3D_VERIFICATION.md`,
  `PHASE_3E_VERIFICATION.md`, `VERIFICATION_ALL_PHASES.md` (the
  cross-phase super-doc)
- Test files: `tests/aep.test.ts`, `tests/obstruction-evaluation.test.ts`,
  `tests/rwycc.test.ts`, `tests/whmp.test.ts`

### Modified

- `lib/calculations/obstructions.ts` — `PART77_SURFACES` →
  `PART77_DIMENSIONS` per-type map, new `evaluateObstructionPart77`,
  extended `evaluateObstructionAllRunways` signature
- `lib/modules-config.ts` — 4 new ModuleKeys (`aep`, `field_conditions`,
  `whmp`, plus `WizardStepKey 'aepagencies'`)
- `lib/sidebar-config.ts` — new nav items + new "Airport Emergency
  Plan" section + Operations entries for Field Conditions + WHMP
- `lib/permissions.ts` — added `AEP_*`, `FIELD_CONDITIONS_*` PERM constants
- `lib/supabase/types.ts` — Row/Insert/Update for 8 new tables
- `lib/base-setup-guide.ts` — full 6-section guide for the
  `aepagencies` wizard step
- `components/layout/sidebar-nav.tsx` — registered `ShieldAlert`,
  `Siren`, `TrendingUp`, `MessageSquareWarning`, `GitBranch`,
  `CloudSnow` in ICON_MAP (incidental Phase 2 SMS bug fix during 3b);
  added GROUP_ICONS for SMS / Training / AEP sections
- `app/(app)/base-config/setup/page.tsx` — new `aepagencies` wizard
  step + `AepAgenciesTab` component (~210 LOC); RunwayEditForm gains
  civilian-only `faa_approach_type` + `faa_approach_category`
  dropdowns
- `app/(app)/more/page.tsx` — AEP collapsible group + Field
  Conditions + WHMP entries (civilian-only via module gate)
- `app/(app)/obstructions/page.tsx` — Surface Set picker
- `app/(app)/obstructions/[id]/page.tsx` — color-keyed legend panel
- `CHANGELOG.md`, `SESSION_HANDOFF.md`
