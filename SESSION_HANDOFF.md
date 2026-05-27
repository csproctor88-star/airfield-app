# Session Handoff

**Date:** 2026-05-26
**Branch:** `main` (in sync with `origin/main`)
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓, `npx vitest run` ✓ (471 pass / 38 files)
**HEAD:** `8a754b9`

---

## What shipped this session

**Post-Phase-3 cleanup, then AMTR follow-ups.** Eleven commits, 5 new
migrations applied. The whole "quick wins" + "medium effort" tranches
from the prior handoff's tech-debt table cleared (7 items, 7 commits),
the master verification super-doc was refreshed to match the new
state, and then four AMTR member-page polish items landed in a quick
second half of the session. No new modules or routes — every change
is a fix or follow-up on already-shipped surfaces.

### Tech-debt quick wins (4 commits)

#### Wire SMS hazard prefill from WHMP deep-link (`ee7110b`)

Phase 3e shipped the WHMP → SMS deep-link encoder
(`buildSmsHazardPromoteUrl`) but the URL pointed at
`/sms/hazards/new` which doesn't exist (the create flow is a modal on
the index page) and the modal didn't read `prefill_*` query params
even if you'd routed correctly. Operator workaround was a manual
copy-paste from the URL.

Fix: migration `2026061100` extends the `sms_hazards.source_type`
CHECK with `'whmp'` (WHMP findings are conceptually distinct from
`wildlife_strike` — planning-doc finding vs. logged incident, so it
gets its own first-class source rather than aliasing). The encoder
URL drops `/new`. `app/(app)/sms/hazards/page.tsx` grew a
`useSearchParams` effect that reads the four prefill params, auto-
opens the Add modal with title + description populated, threads
`source_type` + `source_ref_id` through `createHazard`, then strips
the params via `router.replace` so a refresh doesn't re-open. A
"Pre-filled from WHMP" pill on the modal shows the operator the
provenance. Lacks-SMS_WRITE callers get a toast and the URL cleared.

#### Allow `runway_class` NULL for civilian Part 139 (`2c9f202`)

UFC runway classes (B / Army_B) don't apply to civilian operations —
the new `faa_approach_type` field (shipped in Phase 3c) is the
civilian-correct driver of Part 77 surface dimensions. Civilian rows
were being saved with `runway_class='B'` as a stopgap.

Migration `2026061101` drops NOT NULL + DEFAULT 'B' on
`base_runways.runway_class` and widens the CHECK to `NULL OR 'A' /
'B' / 'Army_B'` (Class A added since UFC 3-260-01 defines both
tactical-training A and B — Phase 1 only seeded B). The runway editor
hides the dropdown on civilian bases (collapses to single-column
grid), emits NULL on save for civilian and `'B'` for USAF, and the
read-only row header falls through to the FAA approach type label
when `runway_class` is null. The base-setup quick-setup pipeline +
ICAO-lookup-import paths got the same gating.

#### KDRA demo seed enrichment (`0c8af66`)

Phase 3 seed covered Phase 3 sub-modules end-to-end but the SMS
hazard register and AEP comms-check history were empty on KDRA —
pilot demos through `/sms` and `/aep` had nothing to show.

`supabase/seed-demo-civilian-phase3.sql` grew two new sections
(idempotent via NOT EXISTS title/date checks): 4 SMS hazards across
realistic sources (`wildlife_strike` / `discrepancy` / `inspection` /
`safety_report`) each with current+residual assessment + 1
mitigation, plus a Q1 2026 internal audit with 2 closed findings.
And 3 monthly AEP comms cycles (Feb / Mar / Apr 2026) against the
full 6-agency roster — 18 result rows — with March intentionally
including a `no_response` on Mercy Hospital ED narrated as a
maintenance off-air event to exercise the SPI feed's failure-counting
path. `hazard_code` minted via `_sms_next_code()` so the demo plays
with any prior data.

#### Wrap AEP supersede in `supersede_aep_plan` RPC (`e318cdf`)

`supersedePlan()` was two writes — INSERT new plan row, UPDATE prior
row's `replaced_by_id`. If the client crashed (or RLS rejected one of
the writes) between them, the base was briefly left with two rows
where `replaced_by_id IS NULL` — both rows looking active.

Migration `2026061102` adds the `supersede_aep_plan` SECURITY
DEFINER RPC modeled on `sign_sms_policy`. Validates auth + base
access + `aep:write`, rejects double-supersede (prior plan must have
`replaced_by_id IS NULL`), inserts the new row + updates the prior
in one transaction, returns the new row as JSONB. `lib/supabase/aep.ts
supersedePlan` rewritten to call the RPC; the `base_id` arg on the
input shape is ignored (RPC derives from the prior plan to reject
cross-base writes) but kept for callsite stability.

### Tech-debt medium effort (3 commits)

#### Pin `surface_set` on `obstruction_evaluations` rows (`9cde5ca`)

Phase 3c's detail-page `SurfaceSetLegend` read the base's *current*
`bases.obstruction_surface_set` to choose which surfaces to display.
The evaluation's `results` JSONB was already pinned at compute time,
but the legend was not — so if an admin flipped the base default
after a save, prior evaluations re-rendered with a legend that didn't
match their saved results.

Migration `2026061200` adds `surface_set TEXT` to
`obstruction_evaluations` with CHECK `(NULL OR 'ufc_3_260_01' /
'faa_part77')`, backfills via `UPDATE FROM bases` join (15 existing
demo rows took the base's current default — best available signal
since there's no per-row history). The create/update paths thread
the picker state into the payload; the detail-page `SurfaceSetLegend`
prefers the pinned `surface_set` and falls back to the base default
for legacy rows. PDF generator unchanged (it renders the saved
`results` array, doesn't care about surface_set).

#### Annual review digest cron — AEP §139.325(d) + WHMP §139.337(c) (`75cc9c6`)

Phase 3a shipped a daily training-expiry digest. AEP and WHMP both
have 12-month review cycles per their regs but had no automated nag
when the next review approached.

Migration `2026061201` adds `annual_review_digest_log` (per-day dedup
with UNIQUE(base, send_date), same pattern as `training_digest_log`).
`lib/annual-review-due.ts` holds the pure-function date math
(`nextAnnualReviewDate`, `annualReviewDaysOut`,
`classifyAnnualReview`) — kept out of `lib/supabase/*` so the server
route can import without dragging the browser Supabase client into
the API bundle. `app/api/annual-review-digest/route.ts` (POST,
Bearer `CRON_SECRET` auth, service-role client) scans civilian
bases, joins active AEP plan + active WHMP assessment, classifies
both via the 60-day amber window, dedups, and emits a Resend
transactional email with overdue/amber rows. `vercel.json` got the
13:30 UTC cron entry — offset 30 min from the training digest at
13:00 to keep logs untangled. 14 new tests cover boundary cases,
leap-year Feb-29 → Mar-1 rollover, and same-day classification.

#### Parameterize `pointToRunwayRelation` half-width (`2e33c6d`)

The geometry helper hardcoded UFC's 1,000-ft primary half-width;
Phase 3c's `evaluateObstructionPart77` worked around this by re-
computing `withinPrimary` locally against the per-approach-type Part
77 half-width (125-500 ft).

`pointToRunwayRelation` now accepts optional
`opts.primaryHalfWidth`. Default 1,000 ft preserves every UFC
callsite bit-identically. The Part 77 evaluator passes its
per-approach-type value through and drops the local recompute. The
200-ft primary extension past each threshold stays hardcoded — UFC
3-260-01 and 14 CFR §77.19 agree on it.

### Verification super-doc refresh (`9be5d1c`)

`docs/VERIFICATION_ALL_PHASES.md` was still phrased as if the seven
tech-debt items were known limitations. Updated header to 466 tests
+ migrations 2026061100 – 2026061201; §0.2 SQL pre-flight gained
schema probes for the new column / nullability / RPC / CHECK
extension; §0.3 KDRA section grew probes for the 4 demo hazards + 3
comms cycles; §0.4 turned into a two-cron table; per-phase walkthrough
steps were rewritten where behavior changed (Phase 3b atomic
supersede step, Phase 3c surface_set pinning regression step, Phase
3e WHMP→SMS auto-fill); §5 master triage dropped the stale "Promote
opens empty form" known-limitation line and added 4 new bug-framed
rows. Final 525 lines (+72/-20).

### AMTR follow-ups (3 commits)

#### JQS catalog: drop full-row amber tint (`0ad0921`)

Required JQS catalog items had both an inset-shadow side bar on the
first cell AND a full-row amber background. Operator feedback: the
combination made the table noisy. Dropped the row-bg wash; the 3-px
`var(--color-warning)` inset-shadow on the first cell still flags
required items cleanly. URL-anchor highlight + zebra striping
unchanged. `components/amtr/jqs-tab.tsx` only.

#### Qualifications updates not persisting (`1663cdd`)

`QualificationsTab.setField` called `upsertAmtrRow` without an
explicit `onConflict`. supabase-js's default is primary-key conflict
detection, which silently no-ops on UPDATE when the client-side cache
lacked the row's id — first edit after a stale fetch or a race
between two clients. Symptom: operator types a date, navigates away,
returns, and the change is gone.

`upsertAmtrRow` grew an optional `opts.onConflict` param;
`qualifications-tab.tsx` passes `'member_id,catalog_id'` matching
the UNIQUE constraint declared in migration `2026052016`. Now the
upsert UPDATES regardless of whether `id` made it into the spread.
Also surfaces upsert errors via toast — the previous code fire-and-
forgot the result, hiding silent failures from the operator.

#### Remove duplicate References tab + NAMT self-edit carve-out (`8a754b9`)

Two related changes to `app/(app)/amtr/[memberId]/page.tsx`; bundled
because they touched adjacent regions of the same file.

References tab: the per-record tab duplicated the module-level
References view (rendered by `module-bar.tsx` via the help-overlay
button). Operators flagged it as redundant clutter inside the record.
Removed from `TAB_LABELS`, the render branch, and the import. The
module-level References surface at the top of `/amtr` remains the
single source of truth.

NAMT self-edit carve-out: the default AMTR self-cert guard locks
both data entry AND signing on your own record — the model assumes
someone above you transcribes. For one-person shops where the NAMT
runs the program, there's no supervisor available, so they were
stuck. New `canEnterDataOnRecord(myRoles, isOwn)` helper in
`lib/amtr/roles.ts`: on your own record, returns true if you hold
NAMT or AFM; on others' records, falls through to the original
supervisor-driven `canEnterData` rule. The page-level
`dataEntryAllowed` switches to this. **The signing self-cert guard
is unchanged** — `slotsUserCanSign(myRoles, isOwn=true)` still
short-circuits to `{'trainee'}` regardless of held roles. The
carve-out is strictly transcription / data entry; the audit-critical
signing path is intact. The own-record header subtitle now
distinguishes the carve-out case ("Training Manager carve-out…")
from the default trainee context. 5 new tests cover the carve-out
plus a regression-guard assertion that the signing invariant doesn't
move (`slotsUserCanSign(['namt'], true)` still returns
`{'trainee'}`).

---

## Migrations status

All 5 new migrations applied to the linked Supabase instance.

| File | Applied | What it does |
|---|---|---|
| `2026061100_sms_hazard_source_whmp.sql` | ✅ | Extends `sms_hazards.source_type` CHECK with `'whmp'` |
| `2026061101_runway_class_nullable.sql` | ✅ | `base_runways.runway_class` drops NOT NULL + DEFAULT 'B'; CHECK widens to `NULL OR 'A' / 'B' / 'Army_B'` |
| `2026061102_aep_supersede_rpc.sql` | ✅ | `supersede_aep_plan(...)` SECURITY DEFINER RPC — atomic two-write supersede mirroring `sign_sms_policy` |
| `2026061200_obstruction_evaluations_surface_set.sql` | ✅ | Adds `surface_set TEXT` column + CHECK, backfills from `bases.obstruction_surface_set` |
| `2026061201_annual_review_digest_log.sql` | ✅ | Per-day dedup table for the annual-review cron, UNIQUE(base, send_date) |

---

## Bugs caught during the session

| Symptom | Root cause | Commit |
|---|---|---|
| WHMP "Promote to SMS Hazard" deep-link 404 | URL pointed at non-existent `/sms/hazards/new` route (create is a modal on the index page); modal didn't read prefill params either | `ee7110b` |
| Qualifications updates appear to save but vanish on refresh | `upsertAmtrRow` default-PK conflict detection silently no-ops on UPDATE when `id` isn't in the spread (stale client cache); fire-and-forget result-checking hid the failure | `1663cdd` |
| Detail-page Surface Set legend re-renders against a flipped base default | Legend read `bases.obstruction_surface_set` at render time instead of the saved evaluation's set; results JSONB was already pinned but the legend wasn't | `9cde5ca` |
| AEP supersede leaves both rows briefly active if client crashes mid-flow | Two separate writes (INSERT new + UPDATE prior pointer), neither transactional | `e318cdf` |

The qualifications bug surfaced a broader anti-pattern: AMTR's
upsert helper was the same shape everywhere, so any other tab using
similar uncached saves could share the silent-update failure mode.
Only Qualifications was patched in this session — JQS / 1098 / RAT
tabs use the same helper but their callsites all carry `id` via
`ensureProgress` first, so they're safe. Worth a sweep if any of
those tabs report a similar symptom later.

---

## Lessons from this session

- **`defaultValue` on uncontrolled inputs hides silent save failures.**
  A `<input type="date" defaultValue={…}>` shows whatever the user
  typed regardless of whether the save actually persisted. If
  `upsertAmtrRow` silently no-ops (which it did in the Qualifications
  bug), the user sees their typed value, navigates away, and returns
  to find the value gone. Every uncontrolled-input save path needs
  an error toast on the save call — fire-and-forget is invisible.
  Saved as `feedback_default_value_silent_save.md`.

- **Audit invariants need explicit regression-guard tests.** The
  NAMT data-entry carve-out is fine because data entry ≠
  certification, but the signing self-cert guard
  (`slotsUserCanSign(myRoles, isOwn=true)` returns `{'trainee'}`
  *regardless of held roles*) is the audit-critical line that must
  never move. Added `slotsUserCanSign(['namt'], true) === Set(['trainee'])`
  + `slotsUserCanSign(['afm'], true) === Set(['trainee'])` as an
  explicit guard with a comment naming what they protect. Pattern:
  when carving out a permission exception, pin the unchanged
  invariant in a test with a comment. Saved as
  `feedback_audit_invariant_guard_test.md`.

- **Default-PK conflict detection silently fails on UPDATE more
  often than you'd expect.** Supabase's `.upsert()` without an
  explicit `onConflict` defaults to the primary key. If the
  client-side row spread is missing the `id`, the upsert tries to
  INSERT and either silently no-ops (PostgREST sometimes returns
  success with 0 rows) or fails the UNIQUE constraint with an
  obscure error. Always pass `onConflict` matching the actual
  unique constraint you intend the upsert to resolve.

- **Per-cluster review gating pays off even after the build
  phase.** The seven tech-debt items each shipped clean on the
  first pass — zero round-trip fixes. Same pattern as the Phase 3
  per-cluster gates: small, contained, with build + tsc + tests
  between each. Worth keeping as the default cadence rather than
  batching follow-ups.

- **The verification super-doc decays fast if not refreshed
  alongside fixes.** Within a single session of tech-debt cleanup,
  `docs/VERIFICATION_ALL_PHASES.md` had 4-5 lines that read as
  "known limitation" but were actually fixed. Refreshing the doc
  is part of fixing the bug — left to a future pass, it accumulates
  contradiction.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| NAMT self-edit signing path — should NAMT/AFM be able to sign Trainer/Certifier/NAMT blocks on their own record? | Open policy question | This session intentionally lifted only the data-entry carve-out and kept the signing self-cert guard intact. If the user wants signing too, it's a 2-line change in `slotsUserCanSign` to remove the `isOwn=true` short-circuit for NAMT/AFM. Audit-trail implications — confirm before lifting. |
| `pointToRunwayRelation` primary extension still hardcoded at 200 ft | Low | UFC 3-260-01 and 14 CFR §77.19 happen to agree on 200 ft today, so no observable bug. If a future regime uses a different extension, this becomes the next parameterization (mirroring the halfWidth change). |
| Precision approach 2nd-segment evaluation lacks real-pilot calibration | Low | 50:1 first 10 kft + 40:1 next 40 kft encoded mathematically and tested. Real-world precision-instrument calibration during pilot phase. |
| AEP drill `participants` snapshot can drift from `aep_response_agencies` | Low | JSONB snapshots agency names at save time; rename / delete doesn't retroactively update drill history. UI degrades gracefully. |
| WHMP `findings.sms_hazard_id` is a string with no FK | Low | Stored inside JSONB; cross-module reference without tight coupling. UI doesn't enforce the linked hazard exists. |
| Annual review digest cron not yet exercised against production data | Low | Vercel cron entry shipped; needs a manual `curl -X POST -H "Authorization: Bearer $CRON_SECRET" …/api/annual-review-digest` after the next deploy to confirm the email format renders correctly. Same shape as training-expiry-digest, so risk is small. |
| SMS hazard auto-create on RwyCC ≤ 2 or WHMP severe species | Medium | Out of scope for v1 by plan; pilot trials should surface whether the auto-promote vs. manual handoff is right. |
| Other AMTR tabs using `upsertAmtrRow` without `onConflict` | Low | JQS / 1098 / RAT callsites all `ensureProgress` first so `id` is always present — safe today. But the helper accepts an optional `onConflict` arg now; future contributors should default to passing it to avoid the qualifications-style silent-update failure. |
| Trademark: CDW holds the live "GLIDEPATH" Class 42 (SaaS) registration | Held | Legal critical path before commercial launch. |

---

## Next session tasks

**Backlog empty after this session.** All Phase-3-aftermath tech debt
that wasn't pilot-blocked is done. Pick from the menu based on
appetite:

1. **Release prep (v2.34.0).** Bundle audit, lint sweep, version
   bump in 5 places (per the project memory's "5 places" rule),
   v2.34.0 CHANGELOG header covering Phase 3 + this session's seven
   tech-debt fixes + AMTR follow-ups, README + capabilities-doc
   updates, tag and push. Closes a real release boundary.

2. **Verify on iPhone PWA.** Walk `docs/VERIFICATION_ALL_PHASES.md`
   end-to-end via the Vercel preview. The doc was refreshed this
   session to reflect the new state — should be self-consistent
   with what the operator actually finds. Surfaces any mobile UX
   issues before pilot recruitment.

3. **NAMT signing-guard policy decision.** If the user wants NAMT
   to also sign Trainer/Certifier/NAMT blocks on their own record
   (not just transcribe data), it's a 2-line change to
   `slotsUserCanSign`. Confirm the audit-trail tradeoff before
   lifting — currently held as an open policy question above.

4. **Manual cron smoke after next deploy.** Curl
   `/api/annual-review-digest` with `CRON_SECRET` to confirm the
   email format renders correctly. One-shot, no code change needed.

5. **Pilot recruitment kickoff.** Identify the 3 Class III non-hub
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

---

## Build snapshot

```
TypeScript clean (npx tsc --noEmit exit 0)
Tests: 471 pass / 38 files (+19 from prior 452)
       tests/annual-review-due.test.ts (+14) — 1-year math, UTC truncation, boundary classification, leap-year rollover
       tests/amtr-roles.test.ts (+5) — NAMT/AFM own-record carve-out, signing-guard regression
Build: npm run build compiled successfully.

Notable First Load JS (changed routes this session):
  /sms/hazards          4.84 kB / 339 kB   (+0.1 kB from prefill effect)
  /amtr                 5.35 kB / 166 kB
  /amtr/[memberId]      9.79 kB / 201 kB   (References tab removed)
  /obstructions         13.6 kB / 189 kB
  /obstructions/[id]    13.9 kB / 346 kB   (legend now reads pinned set)
  /aep                  5.18 kB / 184 kB
  /wildlife/whmp        10.9 kB / 189 kB
  /api/annual-review-digest  0 B / 0 B    (server-only route)

Middleware: 74.5 kB (unchanged).
Shared by all: 91.2 kB (unchanged).
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | — | Phase 1 + 2 + 3a-3e of FAA Part 139 commercial expansion (Phase 3 complete), plus seven post-Phase-3 tech-debt fixes: SMS hazard prefill from WHMP deep-link (with `'whmp'` source_type), `runway_class` nullable for civilian airports, atomic `supersede_aep_plan` RPC, per-row `surface_set` pinning on obstruction evaluations, annual review digest cron for AEP §139.325(d) + WHMP §139.337(c), parameterized `pointToRunwayRelation` half-width, KDRA demo seed enriched with Phase 2 SMS data + AEP comms history. Master verification super-doc refreshed. AMTR member-record polish: JQS row tint removed (side bar only), Qualifications upsert fixed (onConflict on unique constraint), per-record References tab removed (module-level kept), NAMT/AFM self-edit data-entry carve-out (signing guard intact). Not merged-tag yet. |
| v2.33.0 | 2026-05-02 | prior released baseline (see CHANGELOG) |

---

## Key files touched this session

### New

- `supabase/migrations/2026061100_sms_hazard_source_whmp.sql`
- `supabase/migrations/2026061101_runway_class_nullable.sql`
- `supabase/migrations/2026061102_aep_supersede_rpc.sql`
- `supabase/migrations/2026061200_obstruction_evaluations_surface_set.sql`
- `supabase/migrations/2026061201_annual_review_digest_log.sql`
- `app/api/annual-review-digest/route.ts`
- `lib/annual-review-due.ts`
- `tests/annual-review-due.test.ts`

### Modified

- `app/(app)/sms/hazards/page.tsx` — prefill effect + Pre-filled-from pill
- `app/(app)/base-config/setup/page.tsx` — civilian gating on runway_class
- `app/(app)/obstructions/page.tsx` — threads surface_set into payload
- `app/(app)/obstructions/[id]/page.tsx` — SurfaceSetLegend takes pinnedSet
- `app/(app)/amtr/[memberId]/page.tsx` — References tab removed, NAMT carve-out
- `lib/supabase/whmp.ts` — encoder URL changed to `/sms/hazards?...`
- `lib/supabase/sms.ts` — `SmsHazardSourceType` union extended with `'whmp'`
- `lib/supabase/aep.ts` — `supersedePlan` calls the RPC
- `lib/supabase/obstructions.ts` — accept optional `surface_set` on create/update
- `lib/supabase/amtr.ts` — `upsertAmtrRow` optional `onConflict` param
- `lib/supabase/types.ts` — `runway_class string|null`; `surface_set` on obstruction_evaluations
- `lib/base-setup-quick-setup.ts` + `lib/base-setup-guide.ts` — civilian runway_class behavior
- `lib/calculations/geometry.ts` — `pointToRunwayRelation` `opts.primaryHalfWidth`
- `lib/calculations/obstructions.ts` — drops local `withinPrimary` recompute
- `lib/amtr/roles.ts` — new `canEnterDataOnRecord` helper
- `components/amtr/jqs-tab.tsx` — row-bg tint removed
- `components/amtr/qualifications-tab.tsx` — onConflict + toast on error
- `vercel.json` — 13:30 UTC cron entry for annual-review-digest
- `tests/amtr-roles.test.ts` — NAMT carve-out + signing-guard regression
- `tests/whmp.test.ts` — URL assertion updated
- `supabase/seed-demo-civilian-phase3.sql` — Phase 2 SMS + AEP comms sections
- `docs/VERIFICATION_ALL_PHASES.md` — full refresh, +72/-20 lines
