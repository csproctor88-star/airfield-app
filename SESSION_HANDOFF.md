# Session Handoff

> **2026-07-23 — KDRA comprehensive demo-data seed for civilian marketing
> captures (session 18).** Interactive, owner-driven, home machine. **1
> airfield-app commit** (`9f0629f8`, PUSHED), tree clean and level with origin.
> Build green on `9f0629f8`: tsc ✓ · lint 0 errors ✓ · vitest **1874 passed**
> (182 files, unchanged) ✓ · build ✓ (middleware 80.8 kB) — the commit adds only
> SQL/MD under `scripts/`, no code surface, so the app tree is byte-identical to
> session 17's. **Zero migrations.** The substance of the session was a large
> **DB-only seed of the civilian demo base KDRA** (`ea2b542e-…`) applied
> directly to the linked DB; see `[[project_marketing_capture_pipeline]]`.
>
> Goal: make KDRA "Demo Regional Airport" (FAA Part 139 Class III) look like a
> fully-operational airport that has run Glidepath for ~6 months, so the empty
> civilian module frames can be captured. Result: ~98 base-scoped tables
> populated, ~4.4k rows, history 2026-01-24→07-23 (recent-weighted), civilian
> §139 voice throughout.
>
> What was done (all DB-only unless noted):
> - **Staff roster 2→10.** The demo login (`af9a39db`) was renamed **Marcus
>   Delgado** (`airfield_manager` → "Airport Operations Manager"); 8 fabricated
>   display-only staff added (Karen Whitfield/accountable_executive, Anthony
>   Ruiz/ops_supervisor, Danielle Pearce·Brian Okafor·Olivia Brenner/amops, Sara
>   Lindqvist/sms_manager, James Holloway/aep_coordinator, Ramon
>   Castellano/arff_chief). Their `auth.users` rows were created (cloned from the
>   demo user) so they author records everywhere — `profiles.id` FKs to
>   `auth.users`, and SMS tables FK author columns to `auth.users` specifically
>   (the SMS cluster failed until those rows existed).
> - **Disabled** `waivers`/`acsi`/`amtr` in `bases.enabled_modules` (owner call —
>   military-voiced on a civilian base). 23 civilian modules remain.
> - **9 per-module cluster seeds**, drafted by parallel subagents against the
>   live schema (each returned a `.sql` file; every file reviewed + applied +
>   count-verified by me): checks 11→191 + inspections 5→40; discrepancies
>   14→84 (routed across 6 CES shops) + 209 status_updates + obstructions 7→25
>   (FAA Part 77); PPR 3→93 + agencies/coordination/88 remarks; wildlife 18→148
>   sightings / 3→15 strikes + FICON 3→33; SMS reports 7→37 / hazards 6→21 /
>   mitigations 6→26 + 48 SPI trend points; AEP drills 2→9 / comms 3→13 + **FLIP
>   built from empty** (16 pubs / 10 changes / 4 review cycles); training 10→77 +
>   18 certs / 10 renewals + local-regs/mods/read-file (72 acks); contractors
>   3→23 / qrc 1→13 / feedback 4→16 / status board / parking; shift-checklists
>   8→69 + 483 responses.
> - **2 cleanups** on pre-existing base-setup data (owner-authorized; the DELETE
>   was correctly classifier-gated): `aep_response_agencies` deduped 14→6 (3
>   referenced comms results re-pointed first); the broken SPI-003 "Daily
>   Self-Inspection Completion Rate" measurements rewritten from 0% to a high-90s
>   trend (consistent with the 191 inspections).
> - **Committed** (`9f0629f8`) the reproducible seed as
>   `scripts/seed-demo-base-kdra/` (14 ordered `.sql` + README) — companion to
>   `clone-demo-base.sql`, NOT migrations, idempotent (deterministic md5 ids +
>   `ON CONFLICT`).
>
> Seeding mechanics learned (now in `[[project_marketing_capture_pipeline]]`):
> the `profiles.id`→`auth.users` FK is invisible to `information_schema` for the
> linked role; generated columns must not be inserted (`sms_risk_assessments`
> risk_index/band + residual, `auth.users.confirmed_at`); linked-DB writes run
> in-sandbox WITHOUT `dangerouslyDisableSandbox` (that flag now gets
> classifier-DENIED), though a DELETE of existing rows can still be blocked; uuid
> literals across a UNION need explicit `::uuid` casts.
>
> Open next: **civilian captures are unblocked** — owner runs the shot list
> against the deployed app (log in `demo@glidepathops.com` → lands on KDRA; the
> data is already live in prod, no promote needed). Capture caveats: NOTAMs
> stays empty (live FAA feed); Local-Reg / Read-File / Mods file DOWNLOADS 404
> (no object uploaded — list/detail render fine); the existing `read_only`
> account still carries the owner's real name "Christopher Proctor" (left as-is —
> rename if wanted before a users-page shot). Standing carryover unchanged: owner
> captures the ICAO Visual NAVAIDs view on EDGP · glidepath-site
> `modifications-exemptions` page registration · Part 139 cert-audit resume
> (Task 2.5c).

> **2026-07-23 — ICAO Annex 14 lighting standard + FAA lighting phase-2 + EDGP
> ICAO demo base + Daily Ops PPR/BASH split (session 17).** Interactive,
> owner-driven, home machine. **3 airfield-app commits** (`99a921cf`,
> `d5202d3f`, `fbd6f55d`), **all PUSHED**, tree clean and level with origin.
> Build green on `fbd6f55d`: tsc ✓ · lint 0 errors ✓ · vitest **1874 passed**
> (+19) ✓ · build ✓ (`/base-config/setup` 82.1 kB · 327 kB First Load;
> `/infrastructure` 38.9 kB · 248 kB; `/reports/daily` 5.15 kB · 345 kB;
> middleware 80.8 kB unchanged). **4 migrations (`2026072300`–`2026072303`)
> APPLIED + verified to the linked DB.** Plus a large DB-only base clone (EDGP —
> no repo footprint).
>
> **HEAD: `fbd6f55d`.**
>
> Shipped (code):
> - **Lighting outage engine → THREE standards (DAFMAN / FAA / ICAO)**
>   (`99a921cf`). Two prior FAA phase-2 gaps closed + a new ICAO branch:
>   - *FAA item #1* — qualitative templates for the 4 orphan feature types
>     (`signage`/`rdr_signs`/`taxiway_end` zero-tolerance legibility items citing
>     14 CFR §139.311; `stadium_light` informational-only) so their features
>     link to a compliance panel. AC 150/5340-26C App A gives NO tolerance for
>     these → no fabricated % (migration `2026072300`, 4 FAA rows).
>   - *FAA item #2* — `lighting_systems.is_cat_ii_iii` tightens runway edge
>     lights 85%→95% per AC 150/5340-26C Table A-8, at calc time via
>     `resolveEdgeThreshold` (migration `2026072301`).
>   - *ICAO Annex 14 §10.5* — a per-base **`bases.lighting_standard`** selector
>     (dafman/faa/icao) decoupled from `airport_type`; `getLightingCompliance`
>     reads it (NULL derives the old default so existing bases are unchanged).
>     29 ICAO templates transcribed VERBATIM from Annex 14 Vol I §10.5 (Ch 10
>     Aerodrome Maintenance) → gitignored
>     `docs/references/icao-annex14-lighting-verified.md`. §10.5 is
>     category-keyed (CAT II/III §10.5.7 vs CAT I §10.5.10) — runway END lights
>     are STRICTER at CAT I (85%) than CAT II/III (75%). `resolveComponentThreshold
>     (standard, system, comp)` is the single entry point (DAFMAN pass-through,
>     FAA edge 85→95, ICAO edge+threshold→95 / end→75); `calculateSystemHealth`/
>     `calculateAllSystemHealth` gained a `standard` param threaded through ALL
>     callers (infra page, 3 dashboard widgets, `lighting-report-data`,
>     inspections). Base Config lighting tab gains the standard selector +
>     extends the CAT II/III toggle to ICAO's edge/threshold/end (migrations
>     `2026072302` + `2026072303`). v1 caveats (documented): approach lights
>     modelled at the beyond-450 m 85% value (inner-450 m 95% deferred); the
>     §10.5 "maintenance objective, not out-of-service" caveat surfaces via alert
>     labels, not a banner. See `[[project_faa_lighting_outage_engine]]`.
> - **Reusable demo-base deep-cloner** (`d5202d3f`) —
>   `scripts/clone-demo-base.sql` (NOT a migration). Discovery-driven,
>   deterministic md5 UUID remapping, FK checks off via
>   `session_replication_role=replica`, transaction-wrapped, dry-run-first
>   (flip COMMIT→ROLLBACK). Clones every base-scoped table + the 5
>   base-scoped-by-proxy child tables (no `base_id`, e.g.
>   `lighting_system_components`), regenerates the globally-unique
>   `display_id`/`waiver_number`, skips `activity_log`/`page_view_daily`, and
>   rebuilds lighting to a chosen standard. Parameterized CONFIG block at top.
> - **Daily Ops Review: PPR + BASH/wildlife get their own sections**
>   (`fbd6f55d`). PPR (`ppr_entry`, 473 rows) and wildlife
>   (`wildlife_sighting`/`_strike`, 551) both write physical `activity_log`
>   rows, so the report scattered them through the generic Events Log among
>   3410 `manual`/contractor/weather entries. `daily-ops-data.ts` now
>   partitions the day's activity into `pprEntries`/`wildlifeEntries`/
>   everything-else (exported entity-type sets); the PDF + on-screen preview
>   render **PPR ACTIVITY** and **BASH — WILDLIFE** (sightings + strikes;
>   civilian mode drops the BASH prefix) sections, and Events Log is the clean
>   catch-all. Partition only — no new queries; `sign-modal` passes mode through.
>
> Shipped (DB-only, no repo footprint):
> - **EDGP "Demo International Airport" — ICAO demo base**, completing the
>   DAFMAN (KDMO) / FAA (KDRA) / ICAO (EDGP) demo-base trio. A FULL deterministic
>   deep-clone of KDRA via `scripts/clone-demo-base.sql` (base id =
>   `md5(kdra_id || 'icao-clone-v1')`; `faa_part139` + obstruction `icao_annex14`
>   + `lighting_standard='icao'`). 2509 rows across 73 tables, verified
>   row-for-row vs KDRA (only `activity_log`/`page_view_daily` differ, skipped by
>   design). Lighting rebuilt ICAO: 43 systems, 25 ICAO components, 1298/1387
>   features linked. `base_members` cloned → the demo user already has access.
>   Identity (`EDGP` / "Demo International Airport") is a placeholder, renameable
>   in Base Config. Owner captures separately.
>
> Migrations status: **all 4 APPLIED + verified** — templates now dafman=63,
> faa=24, icao=29; `bases.lighting_standard` + `lighting_systems.is_cat_ii_iii`
> present; `standard` CHECK admits icao; **0 bases overridden, 0 systems flagged**
> (existing bases behave exactly as before).
>
> Open next: **owner captures the ICAO Visual NAVAIDs / compliance view on EDGP**
> (and any other module on the new base) — that's the pending action. To activate
> ICAO on ANY existing base: set `lighting_standard='icao'` FIRST, THEN clone its
> lighting components (re-clone picks up ICAO templates). Optional lighting
> follow-ups: per-runway CAT II/III auto-inherit from
> `base_runways.icao_approach_classification` (v1 marks per-system); ICAO approach
> inner-450 m 95% split; the §10.5 caveat as a visible banner. Standing carryover
> unchanged: glidepath-site `modifications-exemptions` page registration · Part
> 139 cert-audit resume (Task 2.5c) · civilian-imagery capture priority.

> **2026-07-23 — SMS status-label leak fix + glidepath-site audience gate
> (session 16).** Interactive, owner-driven, home machine. **1 airfield-app
> commit** (`5a5a5eb1`, PUSHED), tree clean and level with origin. Build green
> on `5a5a5eb1`: tsc ✓ · lint 0 errors ✓ · vitest **1855 passed** ✓ · build ✓
> (`/sms` 7.03 kB · 196 kB First Load; middleware 80.8 kB, both unchanged).
> **Zero migrations.** Most of the session was in the sibling `glidepath-site`
> repo (marketing site, keeps its own handoff — 2 commits `f2760ef` +
> `f8c42d8`, pushed); summarized under "also this session" below.
>
> Shipped (airfield-app):
> - **SMS status labels: fix the "closed no_action" leak** (`5a5a5eb1`). The
>   Safety Reports triage toast rendered the raw enum — `closed_no_action` came
>   out as "closed no_action" because `.replace('_', ' ')` only replaces the
>   FIRST underscore. Owner has hit this class repeatedly. A full-app sweep
>   found the fragile one-shot replace in ~10 SMS / civilian-training sites;
>   `closed_no_action` is the ONLY current enum with two underscores (every
>   other — `under_review`, `public_form`, `runway_incursion`,
>   `self_assessment`, `some_cloud` — reads correctly by luck, but each is a
>   latent time-bomb). Fix is a single source of truth in `lib/supabase/sms.ts`:
>   `TRIAGE_STATUS_LABELS` / `HAZARD_STATUS_LABELS` (proper labels, e.g.
>   "Closed — No Action") + a `humanizeToken()` helper that replaces ALL
>   underscores, routed through the reports / hazards / audits displays, the two
>   status toasts, and the Part 139 training PDF (`replace(/_/g, ' ')`).
>
> Also this session (glidepath-site, own handoff `f8c42d8`): **homepage
> audience gate** — a hard-hold Military/Civilian fork band under the landing
> hero. the hero plays for everyone, then the fork band; the rest of the
> homepage is held until the visitor picks. choice → `glidepath-track` cookie →
> the `/` route reads it server-side and renders in-dialect on the first byte
> (no flash); only `/` goes dynamic, the rest stays static. new `middleware.ts`
> turns `?track=` deep links into the cookie. verified end-to-end in the browser
> (caught + fixed a stale-localStorage-over-cookie bug live). the fork band's
> civilian reel still shows blank media — the standing civilian-imagery gap.
>
> Also delivered (no repo): a civilian-module video/screenshot shot list +
> military reshoot list at `OneDrive/…/glidepath-promo-assets/
> SHOT_LIST_CIVILIAN_SITE_2026-07-22.md`. It flags that ~8 civilian modules
> (SMS, AEP, training, personnel, FICON, FLIP, feedback, cert-inspection) need
> demo data staged on KDRA before capture.
>
> Open next: **civilian imagery is the gating marketing task** — stage KDRA
> demo data for the ~8 empty civilian modules, then capture the shot list (24
> stills + 3 cascade clips), which fills the now-visible blank civilian reel on
> the gated homepage. Standing carryover unchanged: re-promote airfield-app to
> pick up session-15's `1c9be9ff` lighting-tab labels · glidepath-site
> `modifications-exemptions` page registration · Part 139 cert-audit resume
> (Task 2.5c) · optional FAA-engine phase-2.

> **2026-07-22 — PPR polish + FAA lighting-outage engine + KDRA civilian
> demo seeding & activation (session 15).** Interactive, owner-driven, home
> machine. **5 commits** (`858a8e77`..`1c9be9ff`), **all PUSHED**, tree clean
> and level with origin. Build green on the final tree (`1c9be9ff`): tsc ✓ ·
> lint 0 errors ✓ · vitest **1855 passed** (+7) ✓ · build ✓. **2 migrations
> APPLIED to the linked DB** (`2026072200`, `2026072210`), both verified by
> their header queries. Plus a large body of **DB-only demo seeding** to the
> civilian demo base KDRA (`ea2b542e-72cc-4300-9037-bfe18c0bf7ae`) for
> marketing captures — no repo footprint, applied directly with owner auth +
> `dangerouslyDisableSandbox` per the capture-pipeline memory.
>
> **HEAD: `1c9be9ff`.**
>
> Shipped (code):
> - **PPR editable/deletable own remarks + Zulu↔local time pairing**
>   (`858a8e77`). Authors can edit/delete their OWN free-form remarks in the
>   `/ppr` detail card (`updatePprRemark`/`deletePprRemark`, `.eq('created_by',
>   uid)` guard; system-mirrored `[bracketed]` coordination/snapshot entries
>   stay locked); an edited remark shows "(edited)" via migration
>   `2026072200` (`ppr_remarks.updated_at` + a `BEFORE UPDATE` trigger that
>   stamps it only on a real text change — write path never sets the column,
>   so edits work with or without the migration). And **local time next to
>   every Zulu time**: time columns render `1500Z (1000L)` (with `-1d/+1d`
>   rollover), audit + remark timestamps gain the local equivalent, and the
>   HHMM entry fields show a live `= 1000 local` hint. DST-accurate (anchored
>   to the PPR's arrival date) and **gated on a `dateISO` opt so the PDF —
>   which renders its own local sublines — is byte-unchanged**. New utils in
>   `lib/utils.ts`: `zuluToLocalParts`, `formatDayDelta`,
>   `formatZuluDateTimeWithLocal`, `localTimeToZulu`.
> - **Header: dropped the duplicate sidebar expand button** (`e27b2fae`).
>   When collapsed, two expand toggles showed (side-nav rail + a second in
>   the header next to the installation name). Removed the header one; it was
>   the only consumer of the header's `useSidebar` hook, `PanelLeftOpen`
>   icon, and the `.sidebar-toggle` CSS, so those went too.
> - **PPR: notify info-only recipients on EVERY approval** (`45b7ec3a`).
>   Info-only recipient groups (`ppr_agencies.notify_only`) are blasted by
>   `/api/send-ppr-approval`, but the three approval paths called it
>   inconsistently — triage-pre-coordinated always, Decide→Approve only when
>   the PPR had a public requester email, create-modal "pre-coordinated,
>   approve now" never. So internal/pre-coordinated PPRs silently skipped
>   info-only distribution. Dropped `approvePprEntry`'s `requester_email`
>   gate and added the best-effort route call to `createPprEntry`'s
>   `skipCoordination` branch. Info-only now fires on every transition to
>   Approved.
> - **FAA Part 139 lighting-outage engine (dual-mode)** (`ebef2f3a` +
>   `1c9be9ff`). The `/infrastructure` Visual NAVAID outage engine was
>   **DAFMAN 13-204v2 A3.1 only** — no civilian branch, so a `faa_part139`
>   base surfaced military NOTAM/Q-code/CE-TERPS framing. Key realization:
>   `calculateComponentOutage`/`calculateSystemHealth` are **data-driven** —
>   thresholds, Q-codes, NOTAM text, and actions come from each
>   `lighting_system_components` row, cloned at setup from the global
>   `outage_rule_templates` table — so the FAA branch is mostly DATA + labels,
>   not compute changes. Migration `2026072210` adds
>   `outage_rule_templates.standard` (`'dafman'|'faa'`, default dafman) +
>   **20 FAA template rows** (verified from **AC 150/5340-26C Appendix A**
>   "Operating" tolerances, **NOTAM keywords from FAA Order JO 7930.2U
>   §5-2-1**, mandate **14 CFR §139.311**; source-of-record
>   `docs/references/faa-lighting-outage-verified.md`, gitignored). FAA rows
>   carry NO q_code / CE / TERPS / shutoff / barrette-consecutive, so those
>   DAFMAN-only UI branches self-hide for civilian data. `getLightingCompliance
>   (base)` in `lib/airport-mode.ts` is the standard SoT;
>   `fetchOutageRuleTemplates`/`cloneComponentsFromTemplates` filter by an
>   `OutageStandard` (default dafman — an unfiltered fetch would double-clone);
>   base-config lighting tab + the inspections lighting-alert label render
>   mode-aware strings (`1c9be9ff` mopped up the button + section-description
>   strings the first pass missed). types.ts hand-patched with the `standard`
>   column. See `[[project_faa_lighting_outage_engine]]` memory.
>
> Shipped (DB-only demo seeding, no commits — see `[[project_marketing_
> capture_pipeline]]`):
> - **KDRA civilian demo base seeded for captures.** Every previously-empty
>   enabled-module frame filled with FAA Part 139-voiced data: `airfield_checks`
>   (11, §139.327), `obstruction_evaluations` (7, **FAA Part 77** — not UFC),
>   `mods_exemptions` (5 + 2 reviews), `local_regulations` (4 + 3 reviews),
>   `ppr_columns` (12) + the 3 existing `ppr_entries` backfilled with realistic
>   corporate/GA traffic, `wildlife_strikes` (3), and `infrastructure_features`
>   (**1387 Visual NAVAIDs** cloned wholesale from KDMO — KDRA shares KDMO's
>   exact 01/19 geometry, so positions land correctly). Drafted via 6 parallel
>   subagents (schema-verified), reviewed, applied. **`/waivers` deliberately
>   NOT seeded** — that module's UI is AF Form 505 / UFC even for civilian
>   bases; capture `/modifications-exemptions` instead.
> - **KDRA Visual NAVAID lighting FAA-activated.** After the FAA engine
>   deployed + `2026072210` applied, rebuilt KDRA's lighting topology from
>   KDMO's proven feature→system mapping via deterministic
>   `md5(kmdo_id||'kdra-*')::uuid` ids: **43 lighting_systems** (civilian
>   names, KMTC→KDRA), **25 FAA `overall` components** (one per KDMO system
>   whose system_type has an FAA template; **0 Q-codes**, no CE/TERPS),
>   **1298 of 1387 features linked** by position-match (89 unlinked = signs /
>   distance markers / stadium / taxiway-end types with no FAA template —
>   render on map, no compliance component), all operational → clean "no
>   NOTAMs / 14 CFR §139.311" civilian compliance panel. One-off SQL, not a
>   repo migration (reset recipe in the memory).
>
> Bugs caught mid-session (each by a gate, before it shipped): mods_exemptions
> seed row 4 had a mis-aligned VALUES list (Postgres 42601); `fetchOutage
> RuleTemplates` dropped `.select('*')` before `.eq` (tsc TS2339); the FAA
> lighting-tab had 5 DAFMAN strings and the first pass missed 2 (button +
> section description — owner spotted on the live build, fixed in `1c9be9ff`).
>
> Migrations status: **both `2026072200` and `2026072210` APPLIED** to the
> linked DB this session (verified). `2026072210` was applied AFTER the code
> deployed — applying it against the old unfiltered clone would double-clone
> dafman+faa components.
>
> Open next: **owner is verifying the promoted build manually** (this
> session's work). **Re-promote to pick up `1c9be9ff`** (lighting-tab labels)
> on the live app. Optional FAA-engine phase-2: FAA templates for
> signage/rdr_signs/stadium_light/taxiway_end (would link the 89 orphan KDRA
> features); edge-light CAT II/III 5% threshold isn't category-switched (uses
> CAT I 15% default); demo an actual civilian outage by flipping a few KDRA
> features to `inoperative` to show the NOTAM-recommendation flow.
> **Civilian captures are unblocked** — KDRA is comprehensively seeded +
> lighting-activated. Standing carryover unchanged: glidepath-site
> `modifications-exemptions` page registration · Part 139 cert-audit resume
> (Task 2.5c) · long-running carryover. Reminders for captures: skip
> `/waivers` (military UI), and don't open Base Regs / Read File docs (no PDF
> uploaded → download 404s).

> **2026-07-22 — promo video wave 3: 92s showcase built, revised across 3 waves,
> DELIVERED ("absolutely perfect") + workspace/backup cleanup (session 14).**
> Interactive, owner-driven. **ZERO app code changes, zero site changes, zero
> migrations** — this handoff entry is the only repo change; the code tree stands
> at session-12's verified state (no gates re-run on an untouched tree). All
> video work lives OUTSIDE the repos (local project + OneDrive backup).
>
> Done:
> - **Glidepath showcase promo v3 — DELIVERED.** A 92s unnarrated flagship
>   (music + kinetic type, no VO), 16:9 1080p, 12 designed scenes each a distinct
>   proven blueprint shape, built via `/product-launch-video` with per-frame
>   subagents. Deliberately corrects the killed wave-2 grammar
>   (`feedback_promo_videos_no_footage_plus_text`): scenes-first, real Glidepath
>   UI staged INSIDE designed console/browser/device surfaces, framework-injected
>   shader/registry transitions (never hand-rolled crossfades), rich GSAP
>   choreography. Owner review ran on HyperFrames Studio board comments across
>   three revision waves — (1) real-UI swaps replacing every synthetic replica
>   screen, (2) 10 board comments, (3) 6 polish notes. Net result: real captures
>   everywhere, type dropped to Barlow Condensed 600/700 with proper
>   capitalization (never 800/900, no forced lowercase), a DIFFERENT text
>   register per frame (owner: "everything in the lower thirds is terrible"),
>   real portrait mobile clips in aspect-matched device renders, and a
>   letters-lead-plane animated logo outro. Working project stays LOCAL at
>   `C:\Users\cspro\glidepath-promo-v3\videos\glidepath-showcase\` (re-render:
>   `npm run render`); final at `renders\video-final.mp4` (41.5 MB, 92s).
> - **Production standard captured for reuse** (`project_promo_production_standard`
>   memory) — the owner-approved quality BAR: ten non-negotiables (real-UI-only,
>   per-frame text register, hoisted-video law, real device renders, the type/
>   brand rules, framework transitions, no fabricated reg values, the outro
>   recipe) + the process (autonomous build → Studio board review → per-frame
>   revision subagents → draft preview → final on "go"; self-QA on rendered
>   video). Replicate it for every future promo. Pipeline mechanics + the
>   assembler/hoisted-video/worker guardrails are in `project_promo_v3_showcase`.
> - **Workspace + backup cleanup.** Promo working material pulled OUT of the
>   reference-docs top level. The asset backup + reproducible source now live at
>   `OneDrive\Claude Code - Reference Documents\glidepath-promo-assets\` (owner
>   placed it there): 820 files — 14 raw owner clips, an 81-screenshot reusable
>   real-UI library, 13 named module clips, logos, music, and `v3-project-source/`
>   (the v3 HyperFrames project minus node_modules, reproducible anywhere via
>   `npm install` + `npm run render`). Local `glidepath-*` reduced to the current
>   reference only: DELETED wave-1 (`glidepath-promo`, fully backed up), killed
>   wave-2 (`glidepath-promo-v2`), and the abandoned June slop
>   (`glidepath-intro` / `glidepath-explainer`, unbacked, owner-confirmed).
>   Reference-docs folder now holds reference material + deliverable docs (+ the
>   promo backup subfolder). Cross-boundary gotcha memory'd: a bash `mv` INTO
>   OneDrive is denied — use PowerShell `robocopy`.
>
> Open next: unchanged from session 13 — promo direction is owner-driven, nothing
> queued. Standing items: civilian-capture priority + Airfield Status 2560 stills
> · glidepath-site `modifications-exemptions` page registration · Part 139
> cert-audit resume (Task 2.5c) · long-running carryover.

> **2026-07-22 — promo video wave 2: built end-to-end, then KILLED by owner
> (session 13).** Interactive. **ZERO app code changes, zero site changes,
> zero migrations** — this entry is the only repo change; tree stays at
> `578daa67` (session-12 verified build state stands; no gates re-run on an
> untouched tree).
>
> What happened:
> - "Clips are in — ingest and build" executed in full: all 16 wave-2 takes
>   ingested (32 trimmed segments), 18 per-beat VO lines generated (Kokoro
>   `am_michael`, local), 3 MusicGen tracks generated locally (owner asked for
>   generated music), three HyperFrames projects built at
>   `~/glidepath-promo-v2/videos/` (A 87s, C 98s, D 34s + text-only variants
>   of A/C via a `narrated` composition variable), five drafts rendered and
>   delivered.
> - **Owner rejected all five outright — do not resume them.** Verbatim: "The
>   direction, the animation, everything is terrible. All you did was show my
>   screen recordings and overlay text… no shaders, no GSAP, nothing
>   polished." Root causes (memory'd as
>   `feedback_promo_videos_no_footage_plus_text`): ~80% raw footage hosted
>   top-level with hand-rolled opacity crossfades (which flash under the
>   parallel-seek renderer) vs scenes-first designed compositions; dark
>   3200px pages rendered unreadably small; static-still QA missed temporal
>   artifacts. Owner ruling on process: **no per-frame approval ceremony —
>   the fix is autonomous execution quality** (scenes-first, the shader
>   transition system, real GSAP choreography, self-QA on rendered video
>   against the heygen.com showcase bar). `~/glidepath-promo-v2/BRIEF.md` is
>   marked KILLED.
> - **Asset estate notes for any future reuse** (raw footage itself is fine):
>   wave-1 `raw/b4.mp4` shows the owner's desktop + webcam in its final
>   ~0.5s (trim to ≤21.6s if ever reused); `raw-v2/a7.mp4` recorded the M&E
>   register EMPTY (no records staged on the civilian demo base); `raw-v2/
>   a6.mp4`'s member record shows 0% training stats — re-stage both before
>   any re-record. Video logo asset of record:
>   `glidepath-site/public/brand/wordmark-dark.png`. The 1s `raw/2026-07-21
>   23-26-43.mp4` is an accidental OBS start/stop (junk). VO lines + music
>   live in `~/glidepath-promo-v2/assets/` if ever wanted.
>
> Open next: promo video work is direction-reset and owner-driven — nothing
> queued. Everything else unchanged from session 12: civilian-capture
> priority + Airfield Status 2560 still · glidepath-site
> `modifications-exemptions` page registration · Part 139 cert-audit resume
> (Task 2.5c) · long-running carryover.

> **2026-07-21 — glidepath-site: marketability review + landing motion hero
> (session 12).** Interactive, owner-driven. **ZERO app code changes, zero
> migrations, zero app commits** — this entry is the only repo change. All
> work landed in the `glidepath-site` repo (**1 commit `c29b354`, PUSHED**,
> site gates green: tsc ✓ · 158 tests ✓ · lint 0 ✓ · build ✓); full detail
> in `~/glidepath-site/SESSION_HANDOFF.md` (the site now keeps its own).
>
> Done:
> - **Full-site marketability / bounce review** (owner ask: keep doing
>   screenshots, recordings, or neither?). Ruling: military module media is
>   done — recordings only where motion is the message, stills elsewhere.
>   **#1 finding: the civilian side has ZERO imagery** (24 module pages +
>   all three homepage cascade slots render nothing on the Civilian toggle)
>   — fold the civilian capture into the SHOT_LIST_V2 recording session.
>   Standing items: generic hero headline (redline territory), thin /about
>   + 3-entry FAQ, no pricing signal, 10 MB module clips on gov networks.
> - **Homepage hero rebuilt end-to-end** (site commit `c29b354`): banded
>   photo → (board-as-hero experiment, dropped pre-commit) → owner-approved
>   Higgsfield landing scene — transport in profile descending L→R onto the
>   broadside runway light line, dramatic dusk sky (still job `a8fef45c`,
>   nano_banana_2 4k) + 8 s Seedance clip (job `8a463585`, owner picked
>   seedance over kling) playing ONCE at 0.8x and settling on touchdown.
>   100svh section with the media layer at 112% height (sky-biased trim) so
>   the scene keeps the tall-hero scale; dead zone closed (`-mt-[30vh]` →
>   `-mt-[12vh]`); blur-up + priority still = instant first paint. 105 of
>   618 Higgsfield credits used.
>
> Open next: unchanged from session 11 (owner VO verdict · recordings per
> SHOT_LIST_V2 → "clips are in — ingest and build" · Part 139 cert-audit
> Task 2.5c · carryover) **plus** the review's civilian-capture priority and
> a SHOT_LIST_V2 addition: Airfield Status still at 2560 in both variants
> (full window for /platform + board-only crop).

> **2026-07-20/21 — promo video wave 2 kickoff: concepts → scripts approved →
> VO drafts (session 11).** Interactive, home machine. **ZERO app code
> changes, zero migrations, zero app commits** — this entry is the only
> repo change. All work product lives in
> `OneDrive/Claude Code - Reference Documents/`.
>
> Done:
> - **Video concepts brainstorm** (`Glidepath Video Concepts 2026-07-20.{md,html}`)
>   — four concepts with beat structures, module lists, shot lists, and
>   per-beat visual-treatment tags (T1–T9 glossary; owner rule: never repeat
>   the old full-screen-then-zoom grammar consecutively). **Owner picked A
>   ("One Platform, Every Standard", ~90s narrated flagship), C ("The Paper
>   Stack", ~105s narrated), D ("Module Wall", 30–45s social cut).**
> - **Capture spec** `glidepath-promo-assets/SHOT_LIST_V2.md` — one recording
>   session covers all three; new takes → `raw-v2/`, music → `music-v2/`.
>   Must-haves: a1/a2 surface-standards cycle + the civilian Part 139 takes
>   (a4/a6/a7 — no civilian footage exists). Build trigger: "clips are in —
>   ingest and build."
> - **Scripts v3 FINAL, owner-approved** (`Glidepath Video Scripts
>   2026-07-20.{md,html}` + artifact) — approved via phone-screenshot markup
>   + follow-ups; voice = GENERATED; "thirty modules" claim OK. Key owner
>   edits: C opens "This is the way an airfield runs today."; C close is
>   "Streamlined Compliance." (VO + card); A parking line = "by most
>   demanding aircraft or design group."
> - **VO drafts generated + sent** (`glidepath-promo-assets/vo-v2/`):
>   vo-a-michael.wav (62.2s), vo-c-michael.wav (61.2s), voice-sample-adam.wav
>   — Kokoro local TTS (Apache; commercially safe) via `hyperframes tts`,
>   voice am_michael, TTS-normalized numbers ("thirty-six sixteen"). Enabled
>   by installing Python 3.12 (winget) + kokoro-onnx + soundfile on this
>   machine. **Owner verdict pending** (Michael vs Adam, pacing).
> - **Scripts review artifact** (claude.ai/code/artifact/69c5128c-8623-4c18-
>   aee6-bbe0cc602c19) — mobile-editable, saves edits to the owner's Google
>   Drive as "Glidepath Scripts Edits" docs (GPSV1 base64 token — Docs
>   conversion mangles raw JSON backslashes, hence base64; a seed test doc in
>   Drive is trashable). Per owner: ALL review docs ship as editable HTML or
>   artifact from now on (memory'd).
> - **Practice copy** of the previous promo composition at
>   `~/glidepath-promo-practice/` (outside OneDrive; `npm run dev` →
>   localhost:3002; OneDrive `project/` stays the archive).
> - **Design rulings memory'd:** flyoverhead.com resemblance = era/genre
>   convergence (shadcn-style dark dashboards), no action wanted; owner
>   declined distinctiveness pass. **Brand accent is SKY BLUE #38BDF8/#0284C7;
>   amber #FBBF24 is caution-ONLY — never call amber the brand** (owner
>   correction; the old SHOT_LIST.md "amber-on-dark" line is wrong).
>
> Open next: owner VO verdict · owner recordings per SHOT_LIST_V2 + music →
> then ingest and build A/C/D · glidepath-site modifications-exemptions page
> registration · Part 139 cert-audit resume (Task 2.5c) · carryover unchanged.

> **2026-07-20 — status-board owner-QA fixes, dashboard widget mirror,
> ARCWERX one-pager (session 10).** Interactive. **2 commits** (`2a53ee0f`,
> `c695141f`), **all PUSHED**, tree clean and level with origin. Build green
> on the final tree: tsc ✓ · lint 0 errors · vitest **1823 passed** (180
> files, +39 tests) · build ✓ (`/` 29.5 kB · 242 kB First Load, from
> 28.7/241; `/dashboard` unchanged 454 kB). **Zero migrations.**
>
> Shipped:
> - **Status-board QA fix wave** (`2a53ee0f`) — three items from four owner
>   screenshots of the session-9 layout engine. (1) The "extra red space"
>   while arranging was react-grid-layout's STOCK placeholder (literally
>   `background:red`) flooding the transparent sections during drag/resize —
>   restyled to a soft accent tint in `globals.css` for BOTH grids (the
>   dashboard's placeholder changed red→accent too, deliberate), and a
>   dragged/resizing section now gets a solid surface so the page never
>   bleeds through. (2) NAVAID→runway grouping no longer requires the secret
>   designator-first naming: new pure `lib/status-board-navaids.ts`
>   (`navaidMatchesEnd` / `groupNavaidsByEnd` / `navaidDisplayName`) matches
>   the end anywhere in the name ("26 ILS" · "ILS 26" · "MALSR RWY 26"),
>   token-bounded ("PAPI 18" never lands on RWY 8), at most one group per
>   item; legacy names AND the ICAO import's `<TYPE> RWY <END>` format —
>   which never matched the old prefix-only test (latent defect) — regroup
>   with zero data changes. Base Config → NAVAIDs now composes canonical
>   names from a runway picker + type datalist with a live "will appear
>   under" preview, per-row group chips (same shared matcher), and a
>   duplicate-name guard (`navaid_statuses` is name-keyed; dupes corrupt the
>   status mapping). (3) Sections color-code like dashboard widgets: the
>   swatch popover was EXTRACTED from `widget-frame` into shared
>   `components/ui/color-swatch-picker.tsx` (not cloned), each section gets
>   a corner dot in layout edit mode, and `color` rides the existing
>   `status_board_layouts.layout` JSONB per rect — validated against the
>   palette on read, `'default'` stored as omission, buffered into the one
>   Save write, tinted for viewers incl. phone stacking via `widgetTint`.
> - **Dashboard status-board widget mirror** (`c695141f`, owner-reported) —
>   the widget's NAVAID kind dumped raw `navaid_statuses`: deleted rows
>   lingered forever (an `&nbsp;` row, old frequency entries) and names kept
>   their prefixes, ungrouped. Now mirrors the page's `loadNavaids` exactly:
>   intersects with `base_navaids`, groups per runway end via the shared
>   helpers, honors custom column labels from `bases.status_labels`.
>   Lesson (memory'd): a widget that previews a page must consume the page's
>   RESOLVED view, never re-query raw tables.
> - **ARCWERX one-pager** (not repo work) — branded submission page at
>   `OneDrive/Claude Code - Reference Documents/Glidepath ARCWERX One-Pager
>   2026-07-20.{html,md}`, owner-revised (127 Wing POC), ask = Platform One
>   IL4/IL5 pathway sponsorship. The HTML is click-to-edit in the browser
>   (contenteditable + save/print toolbar). Gotcha for future deliverables:
>   `contenteditable="plaintext-only"` makes Chrome render the element
>   pre-wrap — source indentation becomes visible gaps; use plain
>   `contenteditable` + a paste-as-plain-text handler instead.
>
> Owner QA on the promoted build now stacks session 9's list (Mods &
> Exemptions pass · arrange/save · amops sees no Edit · phone stacking) plus
> this session's: drag placeholder feel, section colors save/persist/phone,
> KFSM NAVAIDs regrouped with clean labels + matching Base Config chips,
> dashboard widget now agreeing with the board. Open next: unchanged —
> glidepath-site `modifications-exemptions` page registration · Part 139
> cert-audit resume (Task 2.5c) · long-running carryover.

> **2026-07-19 — rulings, Modifications & Exemptions module, mobile polish,
> status-board layout engine (session 9).** Interactive, home machine, spans
> 2026-07-18 evening → 07-19. **9 commits** (`34797542`..`1615c9b9`), **all
> PUSHED**, tree clean and level with origin. Build green on the final tree:
> tsc ✓ · lint 0 errors · vitest **1784 passed | 24 skipped** (179 files) ·
> build ✓ (`/` 28.7 kB · 241 kB First Load; `/modifications-exemptions`
> 15.2 kB · 196 kB). **8 migrations (2026071800–2026071902) APPLIED to the
> linked DB** and verified by their header queries; `types.ts` regenerated
> twice via its documented splice procedure — the first regen also caught
> silent session-7 drift (`airfield_driver_licenses`, `bases.distance_unit`,
> `driving_checks.driver_483_number` were absent from generated types).
>
> Shipped:
> - **Permission rulings** (`34797542`, applied + live-verified): `atc`
>   loses `fpr:view`; civilian × FPR confirmed already-none (recorded in the
>   migration header, no statement); `majcom_rfm` trued up to its full
>   every-`:view` contract — owner picked "all six" including `fpr`/`amtr`.
>   Root cause: the 2026042202 one-time `LIKE '%:view'` seed never covered
>   later keys; a time-accurate replay audit found the drift the static
>   matrix test structurally masks (full-catalogue SELECT resolution + two
>   unparsed statement shapes — noted in the test's comments).
> - **Modifications & Exemptions module** (`adb085a8` spec → `fb76f0eb`) —
>   civilian Part 139 tracker at `/modifications-exemptions` for MOS
>   (FAA Order 5300.1G, Appendix A category picker, 5-yr design expiry,
>   ¶12.b ALP-table register), §139.111 exemption petitions (§11.81 field
>   map, ARFF §139.111(b) path w/ 120-day rule, §11.101 60-day
>   reconsideration, annual reviews answering Form 5280-4 "Justification
>   Still Valid"), and §139.113 deviations (14-day RADM clock). Every
>   regulatory value transcribed from the owner's four PDFs into gitignored
>   `docs/references/part139-mos-exemptions-verified.md` (note: 5280.5D
>   internally disagrees 3-vs-2-yr max exemption term — the module stores
>   letter dates, never a hardcoded term). Owner ruled "all recommended" on
>   the spec's six open questions. Default-on for civilian bases
>   (backfilled); grants include explicit `majcom_rfm`/`read_only` per the
>   drift lesson. Manual `27_modifications_exemptions.md`.
> - **Modal token fix** (`ed528997`) — the new form styled panels with
>   `--color-bg-1/-2`, names that don't exist in `globals.css`; invalid
>   `var()` unsets background → transparent dialog over the page. Mapped to
>   the real tokens (`bg-surface`, `bg-inset`, `bg-surface-solid`) and
>   modal z to the house 1000.
> - **Mobile form-overflow polish** (`c79828da`) — one bug class from five
>   owner screenshots: controls inside fixed grids / non-wrapping flex rows
>   can't shrink below intrinsic width (iOS date inputs worst). Fixed the
>   five + two found proactively (ACSI cover fields, FLIP change-card) +
>   a global ≤767px guard (`input/select/textarea { min-width:0;
>   max-width:100% }`) beside the existing 16px iOS rule. AMTR untouched
>   (desktop banner).
> - **Status-board layout engine** (three steps in one day):
>   `c6dace7d` NAVAID uniformity (labels ellipsize so badges align flush;
>   section cards stretch equal-height) + the datetime-local dialog
>   overflow fix + reorder-only layout v1. `cfc3c359` dashboard-style
>   drag + resize on the dashboard's 24-col/40px geometry — react-grid-layout
>   loads ONLY in edit mode (dynamic import; `/` stays 241 kB vs
>   /dashboard's 454), viewers render a pure CSS grid, phones stack in
>   reading order, and — owner's anti-choppiness rule — edits buffer in
>   local state with exactly ONE server write on explicit Save (no
>   breakpoint variants either; that reflow was part of the dashboard's
>   original jank). `1615c9b9` every block movable: Personnel,
>   Construction/Closures, Misc Info, and the PPR panel join the same grid
>   as equal sections; the old two-zone look survives only as the
>   never-saved default (pixel-identical). Gate: new
>   `airfield_status:manage_layout` granted to exactly the admin tier
>   (airfield_manager/namo/base_admin/sys_admin — deliberately not amops),
>   enforced in RLS on `status_board_layouts` (rects JSONB + derived
>   `section_order`).
>
> Cleared: session-7's parking touch long-press (owner verified on device).
> **Owner QA on the promoted build:** Mods & Exemptions pass on a civilian
> base (one record of each type, annual review, PDF attachment, register +
> detail PDFs) · status board arrange/resize/save on desktop, amops sees no
> Edit button, phone shows stacked order · re-check the five mobile-overflow
> screenshots. Open next: **glidepath-site `modifications-exemptions` page
> registration** (owner reviews site copy; its `regulation: null` can now
> cite verified §139.111 / Order 5300.1G) · **Part 139 cert-audit resume**
> (session-6 task 6, Task 2.5c) · long-running carryover unchanged.

> **2026-07-18 — twin-bug fix waves + site H1 pass (session 8).** Interactive.
> **2 app commits** (`ae55b046`, `cb074af1`) + **1 glidepath-site commit**
> (`381c3cb`), **all PUSHED**, both trees clean and level with origin. Build
> green on the final tree: tsc ✓ · lint 0 errors · vitest **1755 passed**
> (174 files) · build ✓ (/scn 10.8 kB · 195 kB First Load; /read-file 9.8 kB
> · 190 kB; middleware 80.8 kB unchanged). **Zero migrations.** Clears queued
> items 2, 4, and 5 from the session-6 task list below.
>
> Shipped:
> - **SCN twin-bug fix wave** (`ae55b046`) — the FPR fix wave (`83890e54`)
>   ported back to the template it was cloned from. History Edit no longer
>   rewrites TODAY's check (date threads through a pure `buildScnSavePayload`
>   and renders in the modal); edit drafts preserve removed-agency snapshot
>   rows (`buildScnAgencyDrafts` appends unconsumed prior results); quick-fill
>   clears stale OOS notes; "Cancel OOS" restores the pre-dialog status;
>   history sorts newest-first (`sortScnHistory`); `scn-pdf` em-dash
>   sanitization, and its "Controller OI" heading/column now reads "OI" /
>   "Logged by" (terminology: never "controller"). 14 new tests.
> - **Read File archived-report fix** (`cb074af1`) — mirror of `17c1ade9`:
>   the review report gains an "Archived (history)" section via a shared
>   per-file renderer, excluded from the stat box, with an explicit count
>   line; the page now passes the archived list; generator text sanitized.
>   4 new tests including a raw-PDF content assertion.
> - **glidepath-site module H1 pass** (`381c3cb`, owner-approved with no
>   edits) — optional `h1` on `ModuleEntry`, rendered as `h1 ?? name` on the
>   module detail page only; 30 keyworded headlines (18 military / 12
>   civilian, every bare acronym spelled out), 20 pages keep their name.
>   Breadcrumb/pager/track index keep short names; metaTitles + OG images
>   untouched (no OG regen). Guards: civilian h1 never "Airfield", h1 ≠
>   name, render + fallback tests. Site gates green (tsc ✓ · 158 tests ·
>   ESLint 0 · build ✓). Review doc: `OneDrive/Claude Code - Reference
>   Documents/Module H1 Pass Review 2026-07-18.{md,html}`.
>
> Cleared: session 7's corrupted-runway owner action (owner ruling: it was
> test data on a demo base — nothing to restore). Still open from session 7:
> parking touch long-press verify on a real device. Noticed on the site:
> `lib/modules/civilian/modifications-exemptions.ts` is fully authored but
> registered nowhere (never renders) — looks deliberately unshipped; owner
> decision queued, no action taken.

> **2026-07-18 — units + multi-standard parking (session 7).** Owner-driven,
> interactive. **10 commits** (`bf842e19`..`de99f7cc`), **all PUSHED**, tree
> clean and level with origin. Build green throughout: tsc ✓ · vitest **1713
> passed** · `npm run build` ✓. **2 migrations APPLIED to the linked DB**
> (`2026071772_bases_distance_unit`, `2026071773_usafe_32_1007_surface_set`).
> **Current HEAD: `de99f7cc`.**
>
> Shipped:
> - **Base ft/m preference** — `bases.distance_unit` (default `'ft'`); new
>   `lib/distance-units.ts` is the single feet↔unit boundary. Dimensions stay
>   STORED in feet everywhere; only display/input convert (feet is the identity
>   case, so US bases are unchanged bar thousands separators). Toggle on Base
>   Config › Runways. Applied across runway config (dims/elevations/import
>   preview), the obstruction tool + saved detail + history + PDF, and parking.
> - **Multi-standard parking clearance** — the engine now follows the base's
>   obstruction standard instead of always UFC: UFC wingtip (unchanged) · ICAO
>   Annex 14 §3.13.6 code-letter stand clearance · USAFE 32-1007 (UFC values in
>   metric + 32-1007 refs) · FAA AC 150/5300-13B Table 4-1 ADG wingtip
>   (taxilane vs taxiway). `getClearanceDetail()` is the single injection point;
>   `parkingStandardForBase()` resolves the standard. Apron-context selector,
>   sidebar reference, and PDF are all standard-aware (ICAO hides the context
>   selector; FAA relabels it). Values transcribed from the owner's source PDFs
>   and locked in `tests/parking-clearance.test.ts` (17 tests).
> - **USAFE-AFAFRICA 32-1007** added as a 4th selectable base standard
>   (`bases.obstruction_surface_set`). `getSurfaceSet` normalizes it →
>   `icao_annex14` for OBSTRUCTION (saved evals never store it; that CHECK is
>   intentionally unchanged); only parking reads the raw value to stay distinct
>   from civil ICAO.
> - Fixes: parking touch long-press "adjust" (12 px jitter threshold so the
>   aircraft context menu survives finger micro-movement — **owner to verify on
>   a device**); **runway-dimension corruption** when toggling ft/m with an
>   add/edit form open (both forms now FREEZE their unit at open, so load + save
>   round-trip in one unit).
>
> Source PDFs (ICAO Annex 14, USAFE 32-1007, FAA AC 150/5300-13B) live in
> `OneDrive/Claude Code - Reference Documents`; extraction trick saved in the
> `regulatory-reference-pdfs` memory. Deferred (owner OK'd / not requested):
> parking manual presets stay UFC feet values shown in metric; the FAA sidebar
> reference rows show published feet even on a metric base.

> **2026-07-17 — maintenance follow-up (post session 6).** Machine re-sync,
> not app development. The home clone was fast-forwarded `a97d9171` → v2.32.0
> tree, `glidepath-site` was cloned fresh into `~/glidepath-site`, and the
> redundant `OneDrive/airfield-app` clone was removed (OneDrive + `.git` is a
> corruption risk). `start-session` / `wrap-session` were updated for
> multi-machine sync — `start-session` now `git pull --ff-only`s before reading
> this file; `wrap-session` commits + pushes on exit behind a confirmation.
> Committed `8caeb733` (skill markdown only, **no app code changed**), pushed.
> **Current HEAD: `8caeb733`.**
> Heads-up for next session: (1) `node_modules` predates the fast-forward
> (2026-02-27) — run `npm install` before any `tsc`/`build`/`vitest`, or checks
> will fail on dependency mismatch, not on your work. (2) Untracked
> `public/glidepath_vector.svg` is a stray local asset (backed up to
> `../airfield-app-local-assets-backup/`) — safe to ignore or delete. The
> session-6 handoff below remains the authoritative dev state.

**Date:** 2026-07-17 (session 6 — overnight autonomous run, owner asleep)
**Branch:** `main`. **34 commits** this session (`90360dff`..`b3457a1b`),
**all PUSHED** (owner-authorized; `82170800..b3457a1b` → origin/main); tree
clean, level with origin. Owner monitors CI and owns the promote.
**Build:** verified on the final tree: tsc ✓ · lint 0 errors · vitest
**1731 passed | 0 skipped** (170 files — +363 tests / +26 test files this
session) · `npm run build` ✓ (middleware 80.8 kB).
**HEAD:** `b3457a1b`. (The last three commits landed post-wrap: the owner
supplied the ICAO Annex 14 PDF, unblocking the arm the overnight run had
skipped — see the ICAO subsection below. The owner also removed the
superpowers plugin from `~/.claude/settings.json` mid-session; future
sessions plan directly, per memory.)
**DB:** **all 14 migrations APPLIED 2026-07-17** (owner-run via the `!`
one-liner after the permission layer correctly refused my unattended
attempts). One apply-time fix: `2026071741`'s backfill hit a 23503 FK
violation on an orphaned `saved_by_id` (deleted profile) — made orphan-safe
with an `EXISTS (profiles)` guard; exactly 1 completed check keeps
`completed_by_id` NULL and falls to the report's "Former user" fallback by
design. Verification query confirmed every expected count (30 new RLS
policies, 9 permission keys, 66-base local_regs backfill, realtime
publication membership, 342 checks backfilled, ICAO columns + widened
CHECKs + nullable runway_class). `lib/supabase/types.ts` regenerated
post-apply per its documented GENERATED+MANUAL procedure (purely additive
diff; hand-narrowings re-applied). Latest applied:
`2026071762_obstruction_evaluations_runway_class_nullable`.

---

## What shipped this session

Six features built end-to-end via subagent-driven development (per-task
implementer/reviewer subagents, per-task model selection, adversarial final
review per feature). Every commit passed the four-gate check (tsc / lint /
full vitest / build); every feature's final review verdict is **"Ready to
merge: Yes"** after its fix wave. Per-feature SDD ledgers with full review
history live untracked in `.superpowers/sdd/progress-*.md`;
`overnight-wrap-notes.md` there is the condensed morning checklist.

### Surface-set expansion (`90360dff`..`732daa4a`, 12 commits)

The owner-ruled UFC corrections shipped: encoded Class B criteria corrected
to the verified Table 3-7 values (inner horizontal 13,120 → 7,500 ft; ADCS
remodeled as one 50,000-ft trapezoid flaring 2,000 → 16,000 ft with the
horizontal portion capped at EAE + 500 ft — the owner's 25,100-ft worked
example is a passing test; outer horizontal 44,500 ft), a verified
**Air Force Class A (IFR)** criteria entry, and **Army Class B** corrected
from its false byte-copy of AF (500-ft half-widths). The evaluator caps ADCS
height at EAE + 500 at both interpolation sites; the five UFC map builders
are criteria-parameterized so each class draws at its real dimensions; a new
`lib/calculations/surface-standards.ts` registry powers a **4-standard
what-if picker** on /obstructions (AF A / AF B / Army B / FAA Part 77) with
class-aware save (`runway_class` NULL for Part 77 rows — requires migration
`2026071762` before deploy), edit-mode (set, class) pinning, and a
**Surface Evaluation Standard card** in Base Configuration → Runways that
writes the base set + all runway classes with a confirm. PDF/history/export
print a resolved Surface Standard label (never "Class null"); the §77.19
subsection lettering debt is fixed repo-wide ((a) Horizontal … (e)
Transitional); all ten UFC `ufcRef` citations were corrected to
reference-supported items during the final-review fix wave. The ICAO Annex 14 arm was skipped overnight
(the planning session never recorded the Table 4-1/4-2 transcription, and
encoding it from model memory would violate the no-fabrication rule) — then
**unblocked and built post-wrap** when the owner supplied the Annex 14 Vol I
7th Ed. PDF:

### ICAO Annex 14 arm (`24f90355`, `7a01609c` — post-wrap)

Tables 4-1/4-2/1-1 and the §4.1/§4.2/§3.4 rules were transcribed from the
owner's PDF with two independent extractions agreeing cell-for-cell
(binding source: `docs/references/icao-annex14-verified.md`, untracked like
its UFC sibling). `24f90355` landed the engine: `annex14-criteria.ts`
(metres as published, single `M_TO_FT` boundary; CAT II/III × code 1/2
throws; the as-printed CAT I code-1,2 column — no horizontal section,
3 000 m @ 2.5% then 12 000 m @ 3% — is encoded and test-locked),
`annex14-geometry.ts` (approach trapezoids, inner-horizontal stadium,
conical ring, strip-or-runway-edge transitionals, take-off climb that goes
PARALLEL after reaching final width per §4.1.26), the evaluator arm with
per-section piecewise approach heights, and the registry's fifth standard.
`7a01609c` wired the UI: per-runway `icao_*` variant plumbing on
/obstructions (exactly the `faa_approach_type` pattern), a14 map layer
toggles, detail-page legend, PDF label + phase-2 caveat, and wizard ICAO
selectors (Code Number / Approach Classification / Strip Width with §3.4
hint defaults). Phase 1 honesty per the spec: inner approach, inner
transitional, and balked landing are NOT evaluated — the CAT I–III caveat
renders on the page and PDF. One documented judgment call: the PDF's caveat
prints for every ICAO row (saved rows don't persist the classification, so
precision-only gating isn't re-derivable there); the on-page caveat is
precisely precision-gated. Every encoded value traces to the reference doc
("NATO requirements" per the owner's request — the standard itself is ICAO
Annex 14, which NATO airfields apply, and the in-app label stays
"ICAO Annex 14" per the approved spec).

### NAMO/NAMT attribution groundwork (`66e9a46e`)

Phase A of the report tool, landed early so history accrues from apply-day:
staged permission `reports:user_activity` (leadership-only; amops excluded
by design), `airfield_checks.completed_by_id` with a deterministic same-row
backfill from `saved_by_id` (verified sound: drafts are deleted, never
promoted, so `saved_by_id` on completed rows is always the completer), NOT
VALID profile FKs on the QRC/wildlife actor columns, and `createCheck` now
writes `completed_by_id` (the offline `check_file` path inherits it).

### Flight Planning Room Check module (`4e71bdac`..`83890e54`, 6 commits)

New opt-in USAF module at `/fpr`, SCN-patterned: per-shift today cards from
`getActiveShifts`, a 3-state check modal (Satisfactory / Issue / N/A,
required issue notes, quick-fill), 30-day history, monthly PDF, a Base Setup
wizard checklist tab with editable per-base items ("suggested starting
point" seeds — no DAFMAN citations anywhere per the regulatory-honesty
stance), and a manual page. Saves route through the **offline queue**
(`fpr_save`, upsert by (base, date, shift) so replay is idempotent) with the
AF Form 3616 Events Log entry written by the queue handler after actual
persistence — deliberately not by the CRUD module (house rule) nor at
enqueue time. The final review caught an SCN-inherited **Critical**: editing
a historical check rewrote *today's* natural key. Fixed (modal carries its
check's date), along with snapshot-preserving edit drafts and a
retriable-save reclassification. **SCN shares the same three bugs verbatim
and still needs its own fix wave** (Known issues).

### Airfield Driving Spot Check module (`dcf3c74a`..`18cefa42`, 4 commits)

The former "483 Check log", renamed per the owner's 2026-07-17 ruling —
"Airfield Driving Spot Check" everywhere user-facing ("43 Check" survives
only as search keywords). New opt-in USAF module at `/driving-checks`:
Start Spot Check mobile modal (driver identification + contractor lookup
prefill from `airfield_contractors`, AF Form 483 segmented verification,
vehicle incl. POV pass, locally-editable check items with required
discrepancy notes, location datalist from base areas, live computed outcome
with a violation flag requiring description), filterable history + stat
strip, an AOB-ready date-range PDF (pass rate, common discrepancies,
by-checker table), wizard items tab, manual page. It is an unbounded event
log (plain inserts, no natural key) with typed driver columns. Review fixes
worth knowing: `updateDrivingCheck` structurally cannot reassign checker
attribution (a typo fix by another user no longer moves checks between
AOB by-checker rows), and create/update assemble their return from insert
responses (no re-fetch → no duplicate-on-transient-retry window).

### Local Regulations Review module (`ad4d31af`..`17c1ade9`, 5 commits)

"Base Regs" — a third tab on `/regulations` (deep-linkable, self-gated):
base admins upload local regulation PDFs (25 MB, PDF-only, versioned with
an optimistic replace lock); a required-reviewer roster re-reviews each doc
on a per-doc monthly/quarterly day-based cadence with QRC-parity status
semantics (`updated` beats `overdue`; re-upload resets everyone's cycle —
enforced by an RLS version-equality insert policy from inception, plus a
base_id-pin hardening added while the migration was still staged); a red
due-dot rides the Reference Library sidebar entry (gated on module
enablement AND permission — /regulations is ALWAYS_ON, so the permission
alone would strand an unclearable dot); attests route through the offline
queue with stale-version drains failing NonRetriable *by design* (the doc
changed; the user must re-review the new edition — surfaced with honest
"updated to a new edition" copy, not a permission error). The compliance
PDF includes an **Archived (history)** section (the final review caught
archived docs vanishing from the report the spec promised they'd stay in).
The staged tables migration also adds both tables to the
`supabase_realtime` publication (guarded DO-blocks) — without it the
promised realtime badge would silently never fire.

### NAMO/NAMT Report Tool (`392e6ade`..`1c66209b`, 4 commits)

The report UI over Phase A's attribution: `/reports/user-activity` behind
the staged `reports:user_activity` permission (pre-apply, everyone sees the
access notice — correct). Nine-domain picker (per-domain checkboxes disabled
with a "requires view access" note when the viewer lacks that module's view
permission), users × domains matrix with Unlinked ("unlinked" chip) and
Unattributed ("Former user") sections, drill-down from memory, coverage
footnotes ("N record(s) … lack per-user attribution" — worded to match what
the count actually measures), landscape PDF + Excel (Summary + per-domain
drill-down sheets) + EmailPdfModal delivery, all consuming only the
snapshotted generated data so exports can never desync from the preview.
The data layer **throws on any domain fetch failure** rather than rendering
silent zeros — a leadership count is all-or-nothing. Final-review fixes:
a cleared date input could brick Generate (stuck spinner), and the two
DATE-column domains (strikes, daily reviews) counted one extra calendar day
because day-strings were sliced from UTC boundaries — the picker's local day
strings are now threaded through, and the test that had locked the wrong
behavior in was rewritten with both-direction UTC± assertions.

## Migrations status

**All 14 STAGED, none applied.** Apply in this order with
`npx supabase db query --linked --file supabase/migrations/<file>` (never
`db push`), then run each file's header verification queries, then
regenerate `lib/supabase/types.ts` (retires the session's additive
hand-patches and untyped-client idioms).

| File | Status | What it does |
|---|---|---|
| `2026071720_fpr_permissions.sql` | Applied 2026-07-17 | fpr:view/write/manage_checklist + grants (note: atc gets view — confirm) |
| `2026071721_fpr_tables.sql` | Applied 2026-07-17 | fpr_checklist_items / fpr_checks / fpr_check_results + matrix RLS |
| `2026071730_local_regs_permissions.sql` | Applied 2026-07-17 | local_regs:view/manage + grants (civilian-roster broadening left open — see header) |
| `2026071731_local_regs_tables.sql` | Applied 2026-07-17 | local_regulations / local_regulation_reviews + version-equality & base-pinned RLS + realtime publication membership |
| `2026071732_local_regs_storage.sql` | Applied 2026-07-17 | private `local-regulations` bucket + path-scoped policies |
| `2026071733_local_regs_enable_module.sql` | Applied 2026-07-17 | **owner-row UPDATE**: enabled_modules backfill (module is default-on) |
| `2026071740_namo_namt_report_permission.sql` | Applied 2026-07-17 | reports:user_activity + leadership grants (civilian grants flagged in header — confirm) |
| `2026071741_checks_completed_by_id.sql` | Applied 2026-07-17 | completed_by_id + deterministic backfill + partial index — **apply before deploying** (createCheck writes it) |
| `2026071742_attribution_profile_fks.sql` | Applied 2026-07-17 | NOT VALID profile FKs on QRC/wildlife actor columns |
| `2026071750_driving_check_permissions.sql` | Applied 2026-07-17 | driving_checks:view/write/manage_items + grants (no kiosk/atc — driver PII) |
| `2026071751_driving_check_tables.sql` | Applied 2026-07-17 | driving_check_items / driving_checks / driving_check_results + matrix RLS |
| `2026071760_surface_set_icao_annex14.sql` | Applied 2026-07-17 | widen surface-set CHECKs to include icao_annex14 — **now live-code-required** (the ICAO arm shipped post-wrap) |
| `2026071761_runways_icao_classification.sql` | Applied 2026-07-17 | nullable icao_* columns on base_runways — **now live-code-required** (wizard writes them) |
| `2026071762_obstruction_evaluations_runway_class_nullable.sql` | Applied 2026-07-17 | runway_class nullable + CHECK widened to A/B/Army_B (name-independent DO-block drop) — **apply before deploying** (Part 77 saves write NULL; Army what-if saves violate the old CHECK) |

## Bugs fixed during the session

All caught by the review loop before any user saw them; listed because each
is a class future sessions should watch for.

| Symptom | Root cause | Commit |
|---|---|---|
| Save after switching the what-if standard could persist Class-B numbers labeled Class A | picker change never invalidated `multiAnalysis`; save columns derived from live state, results from the last run | `caab85e3` |
| Edits never persisted `runway_class` (and would have silently reclassified legacy rows once classes mattered) | `updateObstructionEvaluation` never accepted the column; edit-load pinned the set but not the class | `11efbad7` |
| Editing a historical FPR check overwrote today's check + logged a false completion | modal discarded the edited check's date; save hardcoded `todayZuluDate()` (SCN-inherited) | `83890e54` |
| FPR edit after a template change silently dropped snapshot rows | draft builder seeded from active items only; delete-and-rewrite then removed orphans | `83890e54` |
| A typo fix by another user moved a driving check between AOB by-checker rows | update path routed attribution through the shared payload builder | `351dccd3` |
| Transient re-fetch failure after a committed driving-check save could duplicate the check on queue retry | post-insert re-fetch error classified retriable on a no-natural-key INSERT | `351dccd3` |
| Disabling the Local Regs module left a stuck, unclearable red sidebar dot | badge gated on permission only; /regulations is ALWAYS_ON so the dot has no module-gated nav item to hide with | `527516e1` |
| Archived local regs vanished from the compliance report the UI promised they'd stay in | report passed active docs only | `17c1ade9` |
| Clearing a date input bricked the report Generate button (stuck spinner) | boundary conversion threw outside the try, after `setLoading(true)` | `1c66209b` |
| Wildlife-strike / daily-review counts included one extra calendar day | DATE-column day-strings sliced from UTC boundaries, not the picker's local days; a test locked the bug in | `1c66209b` |

## Lessons from this session

- **The per-task + final-review loop earns its cost**: ten bugs above, all
  invisible to tsc/tests-as-written, several in compliance-record paths.
  The final reviews (fable) caught cross-task classes the per-task reviews
  structurally could not (SCN-inheritance, always-on-nav interactions,
  test-locked wrong behavior).
- **Unattended sessions cannot touch the prod DB** — the permission
  classifier blocks it, correctly. The staged-files + morning-apply pattern
  worked well; migrations got extra hardening precisely because they were
  still editable at review time (name-independent constraint drops,
  realtime publication membership, base-pinned RLS).
- **"Mirror the sibling" propagates bugs as faithfully as features.** FPR
  inherited SCN's history-edit bug; DSC nearly inherited FPR's re-fetch
  pattern minus the upsert that made it safe; read-file's archived-report
  gap resurfaced in Local Regs. When cloning a module, diff the template's
  known defects first (SCN fix wave is now queued debt).
- **A test can lock a bug in** — the DATE-boundary test asserted the wrong
  day and read as coverage. Boundary tests need both-direction (UTC±)
  fixtures.
- **Repo RLS suites are live-DB integration tests**, not SQL replays —
  they cannot cover staged tables; static SQL-parsing guards are the
  staged-phase substitute, live coverage extends post-apply.
- Two transient agent API 500s and one Windows build-worker crash
  (0xC0000142) — all recovered by resume/re-run; nothing environmental
  outstanding.

## Known issues / tech debt

New this session (details in the module ledgers):

| Item | Severity | Notes |
|---|---|---|
| Graded-area (clear zone) widths unverified | med | Army graded half-width clamped to 500 as a consistency bound; map polygon still draws legacy 500 ft for all classes (default-off layer). Owner supplies Table 3-5 → one pass closes criteria + evaluator + map. |
| Platform read-RLS posture | info | Domain tables' SELECT policies are base-access-only (the 2026042203-06 matrix swap converted writes); per-domain :view gating is UI-level. Pre-existing, not a regression — worth a deliberate read-policy pass someday. |
| FPR/LR queued-save UI gaps | low | No "pending sync" card state (FPR); Base Regs tab has the WRITE_COMMITTED listener but FPR's today card doesn't mark queued saves. |
| majcom_rfm x driving checks | decision | Sees driver-named Events Log lines via activity_log:view but lacks driving_checks:view — grant or accept. |
| Driver-PII retention on driving_checks | decision | Spec open question; fold into Records disposition work. |
| getUser() per badge tick | low | local-regs + read-file both do an auth roundtrip per refresh; swap to session-derived id (auth-quota history). |
| UA base-switch export mislabel | low | Switching bases after Generate exports old data under the new base's header (daily-report parity); clear data on installation change. |
| Assorted per-module minors | low | Ledgered per module: picker outside-tap dismissal on the DSC phone form, expand-key collisions, em-dash/copy nits, zero-render "—" vs "0", 0-runway UFC pick, revert-toast phrasing, etc. |

Carried forward (unchanged): picker flip re-initializes the obstruction map
(pan/zoom lost) · entry-input polish bundle · evaluator transitional
`approachCutoff` unification · ShopsTab/ArffTab frozen-prop pattern · NIPR
uploads (closed) · hero redline strings · demo user on Demo AFB / KDRA
prep · proof band empty · NAVAID marker dials · QRC draft flow · demo seeds
`shift_name_*` · track-page SEO · civilian tenant status chips · status-page
weather race · account-deactivation live sessions · Selfridge 1098 dedup ·
2 unused exported types · reports "hgjhj" row · anonymous-submission gap.
Resolved and dropped: picker-note copy (`970994ea`), §77.19 `ufcRef`
lettering (`10381d8c`), encoded Class B criteria conflict (`90360dff`),
SCN twin-bug fix wave (`ae55b046`, 2026-07-18), read-file archived-report
gap (`cb074af1`, 2026-07-18).

## Next session tasks

1. **REMAINING OWNER STEPS** (migrations ✅ · types ✅ · push ✅)
   1. Watch CI, then promote when ready. On the promoted build, the named
      manual checks: 20-user NAMO/NAMT PDF render · one live report email ·
      ICAO quick-pass (wizard → ICAO standard on a test base → code 4 /
      CAT I runway → five a14 layers + caveat + PDF Surface Standard row).
   2. Post-apply follow-up: extend the live RLS suites for the fpr_*,
      driving_check_*, and local_reg* tables (ledgered); manual QA scripts
      live in each spec's §Testing (visual PDF render of a 20-user
      NAMO/NAMT report + one live Resend email are the named pre-promote
      checks).
   3. Rulings when convenient: atc fpr:view grant, civilian grants in
      `2026071740`, civilian roster for local_regs, majcom_rfm ×
      driving checks, FPR pending-sync card state.
2. **SCN twin-bug fix wave — DONE 2026-07-18** (`ae55b046`, session 8).
3. **ICAO Annex 14 — DONE post-wrap** (`24f90355` + `7a01609c`). Remaining
   ICAO phase-2 (deferred by spec, unchanged): inner approach / inner
   transitional / balked landing surfaces, code-letter-F 155 m widths, the
   1 800 m take-off variant, §4.2.9/17 variable horizontal section. Manual
   QA for the new arm: wizard → set ICAO on a test base → configure code 4
   / precision CAT I → 5 a14 layers draw, caveat note renders, evaluation
   names Annex 14 surfaces, PDF Surface Standard row + caveat correct.
4. **read-file archived-report pass — DONE 2026-07-18** (`cb074af1`,
   session 8).
5. **glidepath-site: module H1 pass — DONE 2026-07-18** (`381c3cb`,
   owner-approved, session 8). The rest of the site tier-2 list is
   unchanged: /about expansion, clip compression, scoped DB credential,
   demo-route tests, `regulation.cites` render-or-delete.
6. **Part 139 cert-audit resume** — from `.superpowers/sdd/progress.md`
   Task 2.5c (owner decision recorded 2026-07-07: additive migration for
   civilian cover fields), then 2.6, then phases 3-6.
7. **USAFE-AFAFRICA Instruction 32-1007 runway type** — implement USAFE-AFAFRICA
   Instruction 32-1007 as a selectable runway / airfield surface-evaluation type
   for USAF airfields in Europe and Africa (owner request 2026-07-17). Source PDF
   staged at `OneDrive/Claude Code - Reference Documents/usafe-afafricai32-1007.pdf`.

### Long-running carryover
Hero + coverage redline pass · SEO / rich-results · deferred audit items ·
Next 16 · civilian capture day ("prep KDRA") — owner-scheduled, unchanged.

## Build snapshot
```
airfield-app @ 7a01609c (verified post-ICAO, local): tsc ✓ · lint 0 errors ·
  vitest 1731 passed | 0 skipped (170 files — +363 tests: annex14-criteria,
  annex14-geometry, surface-criteria,
  surface-standards, ufc-surface-geometry, fpr-*, driving-check-*,
  local-regs, user-activity-* new; obstruction-evaluation, export-table-
  specs, write-queue-handlers, permission-matrix-roles, modules-config
  extended) · build ✓ · shared First Load JS 106 kB · middleware 80.8 kB.
  New routes: /fpr 8.48 kB · 198 kB First Load; /driving-checks 12.9 kB ·
  203 kB; /reports/user-activity 15.1 kB · 204 kB. Changed: /obstructions
  19.8 kB · 214 kB (from 20.2/211 — registry split); /regulations 21 kB ·
  232 kB (Base Regs tab).
glidepath-site @ 9dd00ad: untouched this session.
```

## Recent releases
| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-07-20 (session 10) | Status-board QA fixes (accent drag placeholder on both grids · forgiving NAVAID runway grouping + structured Base Config add form · dashboard-style section color coding) · dashboard status-board widget mirrors the board's resolved NAVAID view · ARCWERX one-pager (OneDrive). 2 commits, zero migrations, pushed. |
| **Unreleased** | 2026-07-18 (session 8) | SCN twin-bug fix wave (FPR fixes ported back to the template) · Read File archived-report fix (Local Regs mirror) · glidepath-site module H1 keyword pass (30 pages, owner-approved). 2 app commits + 1 site commit, zero migrations, pushed. |
| **Unreleased** | 2026-07-18 (session 7) | Base ft/m distance-unit preference (`lib/distance-units.ts`) · multi-standard parking clearance (UFC / ICAO / USAFE 32-1007 / FAA ADG) · USAFE 32-1007 as 4th base standard · runway ft/m-toggle corruption fix. 10 commits, 2 migrations applied. |
| **Unreleased** | 2026-07-19 (session 9) | Permission rulings applied (atc/majcom) · Modifications & Exemptions civilian module (verified-PDF regulatory base, 4 migrations) · mobile form-overflow polish · status-board grid layout engine (drag + resize, every block movable, base-admin only, buffered saves). 9 commits, 8 migrations applied, +75 tests. Pushed. |
| **Unreleased** | 2026-07-17 (session 6, overnight + post-wrap) | Seven features, review-gated: surface-set expansion (Class A + corrected Class B/Army B + base standard selector) · **ICAO Annex 14 fifth standard** (owner-supplied PDF, dual-extraction-verified values, 5-standard picker) · FPR Check module · Airfield Driving Spot Check module (renamed per owner) · Local Regulations Review (Base Regs) · NAMO/NAMT attribution + Report Tool. 34 commits, all 14 migrations applied + types regenerated, +363 tests. Pushed. |
| **Unreleased** | 2026-07-17 (session 5) | Obstruction manual coordinate entry · FAA Part 77 surface polygons · three §77.19 criteria corrections · UFC Table 3-7 verified + owner rulings — surface-set expansion unblocked. 20 commits, zero migrations. |
| **Unreleased** | 2026-07-16 (session 4) | KFAR status-board save bug: fleet-wide airfield_status backfill + seed trigger (migration `2026071600`, applied) · setup-wizard import staleness fixed · autosave pill registers deletes/updates. |
| **Unreleased** | 2026-07-16 (spec planning) | Seven implementation specs · Part 77 §77.19 lettering resolved · Class B criteria mis-sourcing discovered. |
| **Unreleased** | 2026-07-16 (late) | Supabase type regen · fan-out silent-error sweep · glidepath-site 4-pass review + SEO/security · NIPR uploads closed. |
| **Unreleased** | 2026-07-16 | Two-repo code audit + remediation · RLS security-test suite wired. |
| **Unreleased** | 2026-07-15 (late) | Taxiway-step freeze fix (RDP decimation) · NIPR proxy plan (superseded). |
| **Unreleased** | 2026-07-13 | Configurable shifts; migration `2026071300` applied. |
| **v2.35.0** | 2026-06-30 | Customizable widget dashboard; FLIP; PPR calendar; AMTR 803/1098; C2IMERA; WWA expiry; brand refresh. |
| **v2.34.0** | 2026-06-01 | Help & Training; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination; Records Export. |

## Key docs / files touched this session

### New files
- `lib/calculations/surface-standards.ts` — 4-standard registry (options,
  labels, resolveStandard/Label, per-set legend/layers/builders).
- `lib/supabase/fpr.ts` · `lib/fpr-default-items.ts` · `lib/fpr-pdf.ts` ·
  `app/(app)/fpr/page.tsx` · `components/base-setup/fpr-checklist-tab.tsx`
- `lib/supabase/driving-checks.ts` · `lib/driving-check-default-items.ts` ·
  `lib/driving-check-pdf.ts` · `app/(app)/driving-checks/page.tsx` ·
  `components/base-setup/driving-check-items-tab.tsx`
- `lib/local-regs/review-status.ts` · `lib/supabase/local-regulations.ts` ·
  `lib/local-regs-review-pdf.ts` · `components/local-regs/base-regs-tab.tsx`
- `lib/reports/user-activity-data.ts` · `user-activity-pdf.ts` ·
  `user-activity-excel.ts` · `app/(app)/reports/user-activity/page.tsx` ·
  `components/reports/user-activity-matrix.tsx`
- `docs/manual/24_flight_planning_room.md` · `25_driving_spot_check.md` ·
  `26_local_regulations.md`
- 14 staged migrations (table above).

### Modified files
- `lib/calculations/surface-criteria.ts` / `obstructions.ts` /
  `geometry.ts` — corrected criteria, EAE+500 cap, class-aware surface
  info, criteria-driven builders.
- `app/(app)/obstructions/page.tsx` + `[id]/page.tsx` +
  `components/obstructions/airfield-map-google.tsx` — picker, pinning,
  registry wiring, standard labels.
- `app/(app)/base-config/setup/page.tsx` — standard card + two wizard tabs.
- `lib/sync/handlers.ts` — fpr_save / driving_check_save/_update /
  local_reg_review handlers (Events Log writes live here, post-persist).
- `lib/supabase/checks.ts` (completed_by_id) · `lib/permissions.ts` ·
  `lib/modules-config.ts` · `lib/sidebar-config.ts` ·
  `components/layout/sidebar-nav.tsx` · `app/(app)/more/page.tsx` ·
  `hooks/use-sidebar-badge-counts.ts` · `app/(app)/regulations/page.tsx` ·
  `app/(app)/reports/page.tsx` · `docs/manual/18_reports_analytics.md` ·
  `docs/manual/README.md` · `lib/supabase/types.ts` (additive hand-patches
  pending regen).
