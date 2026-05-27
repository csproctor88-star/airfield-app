# FAA Part 139 Expansion — All Phases Verification

**Scope:** Every shipped phase of the FAA Part 139 commercial expansion. New phases extend this doc — see the **Extending This Doc** section at the bottom.

**Phases covered:**
- **Phase 1** — Foundation & civilian skin (airport_type flag, civilian terminology, 22 FAA regs, civilian roles, KDRA demo seed)
- **Phase 2** — SMS module (Policy + SRM + SA + Promotion per AC 150/5200-37A)
- **Phase 3a** — §139.303 Training
- **Phase 3b** — Airport Emergency Plan (AEP)
- **Phase 3c** — Part 77 obstruction surface UI
- **Phase 3d** — Field Conditions / TALPA
- **Phase 3e** — Wildlife Hazard Management Plan (WHMP)

**Build state at composition:** `tsc` ✓ · `build` ✓ · `vitest` ✓ 466 / 466 · Phase 3 closeout + 7 tech-debt fixes (migrations `2026061100` – `2026061201`)

> 📘 **Standalone phase deep-dive docs** (referenced inline below):
> - `docs/PHASE_3B_VERIFICATION.md`
> - `docs/PHASE_3C_VERIFICATION.md`
> - `docs/PHASE_3D_VERIFICATION.md`
> - `docs/PHASE_3E_VERIFICATION.md`
> - Phase 1, Phase 2, Phase 3a — no standalone docs; sections below are written from CHANGELOG + SESSION_HANDOFF history

---

## 0. Master pre-flight

Run from `C:/Users/cspro/airfield-app` with `npm run dev` at http://localhost:3000.

### 0.1 Branch + tree + build state

```bash
git status                              # → "On branch main, nothing to commit"
git log --oneline -1                    # → latest Phase commit
npx tsc --noEmit                        # exit 0
npx vitest run | tail -3                # 452 / 452 pass (will grow as phases ship)
```

### 0.2 All foundation + module tables present

```sql
-- All FAA Part 139 expansion tables across phases (should return ~22 rows):
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN (
     -- Phase 1 foundation
     'airfield_surface_sets','discrepancy_statuses','daily_review_slots',
     -- Phase 2 SMS
     'sms_policies','sms_hazards','sms_risk_assessments','sms_mitigations',
     'sms_spis','sms_spi_measurements','sms_audits','sms_management_of_change',
     'sms_safety_reports','sms_communications',
     -- Phase 3a Training
     'training_topics','training_records','training_renewals','training_certificates','training_digest_log',
     -- Phase 3b AEP
     'aep_plans','aep_response_agencies','aep_drills','aep_comms_checks','aep_comms_check_results',
     -- Phase 3d Field Conditions
     'field_condition_reports','field_condition_thirds',
     -- Phase 3e WHMP
     'wildlife_hazard_assessments',
     -- Post-Phase-3 tech-debt: annual-review digest dedup (2026061201)
     'annual_review_digest_log'
   )
 ORDER BY table_name;

-- Phase 1 column adds on bases:
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'bases'
   AND column_name IN ('airport_type','part139_class','faa_site_number','aoc_number','obstruction_surface_set');
-- → 5 rows

-- Phase 3c column adds on base_runways:
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'base_runways'
   AND column_name IN ('faa_approach_type','faa_approach_category');
-- → 2 rows

-- runway_class is nullable for civilian (2026061101):
SELECT is_nullable FROM information_schema.columns
 WHERE table_name = 'base_runways' AND column_name = 'runway_class';
-- → 'YES'

-- Per-row surface_set pinned on obstruction_evaluations (2026061200):
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'obstruction_evaluations' AND column_name = 'surface_set';
-- → 1 row

-- 'whmp' allowed as sms_hazards.source_type (2026061100):
SELECT check_clause FROM information_schema.check_constraints
 WHERE constraint_name = 'sms_hazards_source_type_check';
-- → clause contains 'whmp'

-- AEP atomic supersede RPC (2026061102):
SELECT proname FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
 WHERE n.nspname = 'public' AND proname = 'supersede_aep_plan';
-- → 1 row

-- Phase 1 + Phase 2 + Phase 3 permission keys:
SELECT key FROM permissions WHERE key LIKE 'sms:%' OR key LIKE 'aep:%'
   OR key LIKE 'training_part139:%' OR key LIKE 'field_conditions:%' OR key LIKE 'daily_reviews:sign:%'
 ORDER BY key;
-- → SMS (5) + AEP (3) + Training (3) + Field Conditions (2) + Daily Reviews civ (2) = 15 keys
```

### 0.3 KDRA demo data present (after `seed-demo-civilian.sql` + `seed-demo-civilian-phase3.sql`)

```sql
SELECT 'phase_1_base'   AS phase, icao, airport_type, part139_class, obstruction_surface_set
  FROM bases WHERE icao='KDRA';
-- → 1 row, airport_type='faa_part139', part139_class='III', obstruction_surface_set='faa_part77'

SELECT 'phase_3c' AS phase, runway_id, faa_approach_type, faa_approach_category
  FROM base_runways WHERE base_id = (SELECT id FROM bases WHERE icao='KDRA');
-- → 1 row, type='non_utility_non_precision_3_4', category='C'

SELECT 'phase_3b_plan'   AS phase, version FROM aep_plans WHERE base_id = (SELECT id FROM bases WHERE icao='KDRA') AND replaced_by_id IS NULL;
SELECT 'phase_3b_agency' AS phase, COUNT(*) FROM aep_response_agencies WHERE base_id = (SELECT id FROM bases WHERE icao='KDRA'); -- → 6
SELECT 'phase_3b_drill'  AS phase, drill_date, drill_type, status FROM aep_drills WHERE base_id = (SELECT id FROM bases WHERE icao='KDRA');
SELECT 'phase_3d'        AS phase, COUNT(*) AS fcr_count FROM field_condition_reports WHERE base_id = (SELECT id FROM bases WHERE icao='KDRA'); -- → 2
SELECT 'phase_3e' AS phase, assessment_year, jsonb_array_length(hazardous_species) AS species,
                            jsonb_array_length(findings) AS findings
  FROM wildlife_hazard_assessments WHERE base_id = (SELECT id FROM bases WHERE icao='KDRA');
-- → 1 row, 2026, 3 species, 2 findings

-- Post-Phase-3 seed enrichment (idempotent — landed alongside the seed refresh):
SELECT 'phase_2_hazards' AS phase, COUNT(*) AS demo_hazards FROM sms_hazards WHERE base_id = (SELECT id FROM bases WHERE icao='KDRA'); -- → 4+ (wildlife / discrepancy / inspection / safety_report sources)
SELECT 'phase_2_audits'  AS phase, COUNT(*) FROM sms_audits  WHERE base_id = (SELECT id FROM bases WHERE icao='KDRA'); -- → 1 (Q1 2026 internal)
SELECT 'phase_3b_comms'  AS phase, COUNT(*) FROM aep_comms_checks WHERE base_id = (SELECT id FROM bases WHERE icao='KDRA'); -- → 3 (Feb / Mar / Apr 2026)
```

### 0.4 CRON_SECRET in Vercel (covers both digests)

Open Vercel dashboard → airfield-app → Settings → Environment Variables. Verify `CRON_SECRET` is set on Production + Preview. Without it both crons return 500 every fire:

| Cron path | Schedule | What it does |
|---|---|---|
| `/api/training-expiry-digest`  | `0 13 * * *`  (13:00 UTC) | Phase 3a — per-user training records within 30 days of expiry |
| `/api/annual-review-digest`    | `30 13 * * *` (13:30 UTC) | AEP §139.325(d) + WHMP §139.337(c) annual reviews inside the 60-day amber window or already overdue |

SMS SPI pg_cron is unaffected (runs in-database, no secret needed).

---

## 1. Cross-cutting mode gating matrix

Switch installations via the header picker. **Every Phase 2+ module is civilian-only** — confirm USAF mode shows zero of them. KDRA = civilian, KDMO (Demo AFB) = USAF.

| Surface | USAF (KDMO) | Civilian (KDRA) |
|---|---|---|
| Sidebar — SMS section | hidden | visible |
| Sidebar — Training & Compliance section | hidden | visible |
| Sidebar — Airport Emergency Plan section | hidden | visible |
| Sidebar — Operations → Field Conditions entry | hidden | visible |
| Sidebar — Operations → Wildlife / WHMP entry | hidden | visible |
| Sidebar — SCN entry (USAF-only) | visible | hidden (replaced by AEP) |
| Sidebar — AMTR / ACSI (USAF-only) | visible | hidden |
| Role labels (e.g. NAMO vs Operations Supervisor, AFM vs Operations Manager) | USAF terms | civilian terms |
| Discrepancy status pills | "Submitted to AFM" / "Submitted to CES" / etc. | "Submitted to Operations Manager" / "Submitted to Maintenance" / etc. |
| Daily Review slot labels | Day/Swing/Mid AMSL + NAMO + AFM | Day/Swing/Mid Shift Lead + Ops Supervisor + Operations Manager |
| Form 505 / 483 / 3616 references | "AF Form 505 (Waiver)" / "AF Form 483" / "AF Form 3616" | "Modification to Standards" / "SIDA Badge" / "Daily Ops Log" |
| Reference library `/regulations` | USAF + UFC + ICAO + dual | FAA + ICAO + dual |
| Public form route `/[icao]/sms-report` | not exposed | accessible by ICAO |
| Public form route `/[icao]/ppr-request` | accessible | accessible (both modes) |
| `/training` direct URL | 404 / module disabled | landing renders |
| `/aep` direct URL | 404 | AE dashboard renders |
| `/obstructions` surface picker | defaults UFC, picker visible | defaults Part 77, picker visible |
| `/field-conditions` direct URL | 404 | page renders |
| `/wildlife/whmp` direct URL | 404 | page renders |
| `/scn` direct URL | renders | 404 |

If any cell disagrees, **stop and triage** — likely cause is a missing module-config `appliesTo` filter, an incorrect `airport_type` in `bases`, or a stale browser cache (hard-reload).

---

## 2. Phase-by-phase end-to-end walkthrough on KDRA

Walk each phase in order. Phase 1 + 2 establish the foundation; Phases 3a-3e are the civilian-only sub-modules. The KDRA demo seed has data pre-populated for Phase 1 + 3b/3c/3d/3e, plus a working Phase 2 SMS scaffold.

---

### Phase 1 — Foundation & civilian skin

**Scope:** `airport_type` dual-mode flag with all downstream terminology / role / form / reg / role-label divergence points. Plus 5 civilian roles (sms_manager, aep_coordinator, ops_supervisor, arff_chief, accountable_executive), 22 FAA regulation seeds, `airport-mode.ts` helpers, "Airport Type" wizard step.

**No standalone verification doc.** Phase 1 is a cross-cutting plumbing change with no single route to verify; instead its correctness is exercised by every Phase 2-3 module rendering correctly with civilian terminology.

#### Pre-checks
- `SELECT airport_type, part139_class, obstruction_surface_set FROM bases WHERE icao='KDRA';` → `faa_part139` / `III` / `faa_part77`
- `SELECT COUNT(*) FROM regulations WHERE source = 'faa';` → ~22 rows (FAA regs seeded by `2026052502`)
- `SELECT role_name FROM role_permissions GROUP BY role_name HAVING role_name IN ('sms_manager','aep_coordinator','ops_supervisor','arff_chief','accountable_executive');` → 5 rows

#### Worked flow
1. **Demo airport setup** — Confirm KDRA exists: `/base-config/setup` on KDRA → step 0 (Airport Type) shows "FAA Part 139 (civilian)" selected, Part 139 Class "III", FAA Site Number populated.
2. **Terminology sweep** — Walk these civilian surfaces and confirm USAF terms have been replaced:
   - `/users` → role labels show "Operations Manager" not "Airfield Manager", "Operations Supervisor" not "NAMO", "Airside Ops" not "AMOPS", "Airport Maintenance" not "CES"
   - `/daily-reviews` → shift slots show "Day Shift Lead / Swing Shift Lead / Mid Shift Lead / Ops Supervisor / Operations Manager"
   - `/discrepancies` (any open discrepancy) → status pill says "Submitted to Operations Manager" / "Submitted to Maintenance" / etc.
   - `/waivers` → header references "Modification to Standards" not "AF Form 505"
   - `/contractors` → header references "SIDA Badge" not "AF Form 483"
   - `/activity` → email templates / activity descriptions use civilian roles
3. **Reference library `/regulations`** → 22+ FAA references visible (Part 139, Part 5, AC 150/5200-*, etc.); UFC entries hidden; ICAO + "both" entries visible.
4. **Civilian roles available** — go to `/users` (sys_admin) → add user → role dropdown includes accountable_executive, sms_manager, aep_coordinator, arff_chief, ops_supervisor (in addition to base_admin, sys_admin, read_only).
5. **Switch to KDMO** via picker → confirm USAF terminology returns (NAMO, AFM, AMOPS, CES, AF Form 505, etc.). Verify Phase 1 is bidirectional, not destructive.

#### Failure triage
- **Civilian role missing from dropdown** — `lib/constants.ts` USER_ROLES doesn't include it; rare regression
- **Civilian terms not appearing** — component still hardcodes USAF literal; route through `getRoleLabel()` / `getTerm()`
- **22 FAA regs absent** — migration `2026052502` not applied

---

### Phase 2 — SMS Module

**Scope:** Safety Management System per 14 CFR §139.401-415 (Part 139 SMS Final Rule). Implements all four AC 150/5200-37A pillars: Safety Policy · Safety Risk Management (5×5 matrix) · Safety Assurance (SPIs, audits, MOC) · Safety Promotion (anonymous public reports).

**Routes:** `/sms` (AE dashboard) · `/sms/policy` · `/sms/hazards` (+ `[id]`) · `/sms/spis` · `/sms/audits` · `/sms/moc` · `/sms/reports` · `/[icao]/sms-report` (public)

**No standalone verification doc.** Phase 2 shipped as continuous build before the per-cluster gate pattern was adopted.

#### Pre-checks
- `SELECT COUNT(*) FROM sms_policies WHERE base_id = (SELECT id FROM bases WHERE icao='KDRA');` — may be 0 if no policy filed yet, or 1+ if seeded
- `SELECT COUNT(*) FROM sms_spis WHERE base_id = (SELECT id FROM bases WHERE icao='KDRA');` → 6 (4 baseline + 2 AEP-fed from Phase 3b: SPI-005 + SPI-006)
- `SELECT COUNT(*) FROM sms_hazards WHERE base_id = (SELECT id FROM bases WHERE icao='KDRA');` → 4+ after the post-Phase-3 seed refresh (wildlife / discrepancy / inspection / safety_report)
- `SELECT COUNT(*) FROM sms_audits WHERE base_id = (SELECT id FROM bases WHERE icao='KDRA');` → 1 (Q1 2026 internal audit, both findings closed)

#### Worked flow
1. **AE dashboard `/sms`** → four cards: Safety Policy (current Y/N), Hazards by band, SPIs in red, Open MOCs. PDF export buttons at top.
2. **`/sms/policy`** → if no active policy, file one: New Draft button → fill safety_objectives (2-3 entries), employee_reporting_pledge, signature_image_url (optional). Save draft → Sign + Activate as the AE → status flips to Active.
3. **`/sms/hazards`** → file a new hazard manually: title, description, source_type='manual'. Click into the hazard detail.
4. **Risk assessment** (hazard detail) → click "Add Assessment" → 5×5 matrix: likelihood + severity → risk_index auto-calculates → band-colored chip (Low/Medium/High/Extreme per AC 150/5200-37A).
5. **Add mitigation** → title, owner, due_date → save. Optionally update assessment with residual_likelihood + residual_severity → residual band drops.
6. **Discrepancy → Hazard promote**: open any safety-relevant discrepancy, click "Promote to SMS Hazard" → hazard auto-creates with `source_type='discrepancy'` + `source_ref_id=<discrepancy id>`.
7. **`/sms/spis`** → 6 SPI cards visible (the 4 baseline + SPI-005 + SPI-006 from Phase 3b). Click any → 12-month sparkline + measurements table.
8. **Manual SPI recompute**: click "Recompute Now" button → runs `_sms_compute_spi_measurements(CURRENT_DATE)` → fresh measurements row lands. Confirm Phase 3b SPIs (`aep_full_scale_drill_overdue`, `aep_comms_checks_last_90d`) update based on AEP data.
9. **`/sms/audits`** → schedule a new audit (date, scope, auditor); list view shows past + upcoming.
10. **`/sms/moc`** → file a new MOC (title, description) → status starts "proposed". As `accountable_executive` (or any `sms:approve_moc` holder) click Approve → status flips, `approved_at` stamps.
11. **`/sms/reports`** → triage queue of anonymous public safety reports. Click any → Promote to Hazard → hazard auto-creates with `source_type='safety_report'` + back-fills `promoted_hazard_id` on the report row.
12. **Public form smoke**: open `/<icao>/sms-report?icao=KDRA` (no login) → form renders; submit a test report with category + description; verify it lands in `/sms/reports` triage queue.
13. **SMS Manual PDF**: from `/sms` header → "Generate SMS Manual" → downloads PDF with Policy + SRM (hazard register) + SA (SPIs + audits + MOC) + Promotion sections per AC 150/5200-37A taxonomy.

#### Permission gating quick-check
| Role | View | Hazard CRUD | Sign policy | Approve MOC | Triage public reports |
|---|---|---|---|---|---|
| `read_only` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `sms_manager` | ✓ | ✓ | ✗ | ✗ | ✓ |
| `accountable_executive` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `sys_admin` | ✓ | ✓ | ✓ | ✓ | ✓ |

#### Failure triage
- **`/sms/*` 404 on KDRA** — `bases.enabled_modules` doesn't include `'sms'`
- **Public form submission fails** — `submit_safety_report_public` RPC not deployed; check migration `2026052702`
- **SPI compute returns 0 rows** — civilian base flag missing or SPIs not seeded; manually call `_sms_seed_default_spis(<base_id>)`
- **Sign Policy fails** — RPC `sign_sms_policy` requires `sms:sign_policy`; check role grant

---

### Phase 3a — §139.303 Training

**Scope:** 13 topic catalog seed · per-user training records with stored expiry · AAAE / ACE certificates · compliance matrix · daily Vercel cron expiry digest · per-user PDF transcript.

**Routes:** `/training` (landing) · `/training/topics` · `/training/roster` · `/training/[userId]` · `/training/compliance` · `/api/training-expiry-digest`

**No standalone verification doc.** Phase 3a shipped before the standalone-doc convention.

#### Pre-checks
- `SELECT COUNT(*) FROM training_topics WHERE base_id IS NULL;` → 13 system seed topics
- `SELECT * FROM training_digest_log LIMIT 1;` — table exists (rows only after cron fires)

#### Worked flow
1. Open `/training` on KDRA → landing page with topic catalog overview + Roster + Compliance Matrix entry cards.
2. `/training/topics` → 13 seeded topics visible. System topics show with a "system" badge.
3. **Override a system topic for KDRA:** click Edit → adjust `recurrent_frequency_months` → save. New row written with `base_id = KDRA` (system row unchanged).
4. **Add custom topic:** "Demo Airport Sterile Area Briefing" · 12-month frequency. Save → appears in the list.
5. `/training/roster` → bulk-fetch of members + topics + records. Sort by worst-status-first.
6. **Log Training:** Click a user → user detail (3 tabs: Records / Certificates / History). Click "Log Training" → modal: pick topic, completed_at, training_type, instructor, evidence file upload.
7. Save → record lands; `expires_at` materializes from the topic's `recurrent_frequency_months` via the `_training_set_expiry` trigger.
8. **Verify expiry chain:** If renewing an existing record, `training_renewals` row links previous_record_id → renewed_record_id.
9. **Compliance matrix** `/training/compliance` → users × topics grid with status glyphs + expiry dates. CSV export.
10. **PDF transcript** — user detail page → "Transcript" button → per-user PDF with status-tinted cells + chain history + AAAE-ACE certificates.
11. **Cron smoke** (production-only after CRON_SECRET set):
    ```bash
    curl -X POST -H "Authorization: Bearer <CRON_SECRET>" https://<deployment>/api/training-expiry-digest
    # → 200 with JSON: { bases_scanned, emails_sent, ... }
    ```

#### Permission gating
| Role | View topics | Log training | Edit topics | Export PDFs |
|---|---|---|---|---|
| `read_only` | ✓ | ✗ | ✗ | ✗ |
| `ops_supervisor` | ✓ | ✓ | ✗ | ✓ |
| `aep_coordinator` / `arff_chief` / `sms_manager` | ✓ | ✓ | ✗ | ✓ |
| `accountable_executive` | ✓ | ✓ | ✗ | ✓ |
| `airfield_manager` / `base_admin` / `sys_admin` | ✓ | ✓ | ✓ | ✓ |

#### Failure triage
- **Evidence upload fails** — storage RLS for `training-evidence/*` requires `training_part139:write`. Confirm role grant from migration `2026053004`.
- **Cron returns 500** — `CRON_SECRET` not set in Vercel.
- **Transcript PDF won't generate** — check browser console for jsPDF error; dynamic import path is `@/lib/training-part139-pdf`.

---

### Phase 3b — Airport Emergency Plan (AEP)

📘 **Standalone deep dive:** `docs/PHASE_3B_VERIFICATION.md`

**Scope:** Versioned plan document with AE annual sign-off · response-agency roster · monthly comms checks · §139.325(h/j) drill program · 3 PDFs · 2 SMS-fed SPIs.

**Routes:** `/aep` (AE dashboard) · `/aep/plan` · `/aep/agencies` · `/aep/comms-checks` · `/aep/drills`

#### Pre-checks
- KDRA seed has: 1 active plan v2026.1 (AE-signed), 6 response agencies, 1 completed tabletop drill from 2026-03-18, 3 monthly comms checks Feb/Mar/Apr 2026 (Mar has a no_response on Mercy Hospital).

#### Worked flow
1. **AE dashboard `/aep`** → 4 cards: Plan status (green), Full-Scale drill (amber — never recorded), Comms check (green — 3 recent in last 90 days), Response Agencies (green — 6 active).
2. **`/aep/plan`** → active plan card v2026.1, AE signed. Click "Record Annual Review" → stamps `last_reviewed_at`.
3. **Atomic supersede** — Click "Supersede with new version" on the plan card. Fill v2026.2 + effective date + (optional) FAA acceptance. Save → fires `supersede_aep_plan` RPC (single DB transaction). Verify the prior row's `replaced_by_id` points at the new row in one shot — no transient window where both rows look active.
4. **`/aep/agencies`** → 6 agencies grouped by role. Add one; reorder; toggle inactive.
5. **`/aep/comms-checks`** → 3 historical cycles in the list. "Run Check" → 6 agency rows; set Engine 7 OOS + Mercy Hospital No Response. Save → Events Log entry lands with AC 30D §6 summary.
6. **`/aep/drills`** → Schedule a Full-Scale drill, complete it → Full-Scale chip flips green "Due in 36 months".
7. **SMS SPI smoke:** From `/sms/spis` → recomputeSpisNow. SPI-005 flips 1 → 0; SPI-006 increments (3 comms cycles already in the 90-day window).
8. **3 PDF exports** from `/aep` header: Plan PDF · Drill Log PDF · Monthly Comms PDF.
9. **Annual review reminder smoke** (production cron): hit `/api/annual-review-digest` with `Bearer $CRON_SECRET` while the plan's `last_reviewed_at` is > 305 days old. Email lands at `bases.default_pdf_email` with AEP row marked Amber / Overdue. Dedup row inserts into `annual_review_digest_log`; same-day re-run is a no-op.

#### Permission gating
- `accountable_executive` (read + sign): record annual review only; no new plan version.
- `aep_coordinator` (read + write): full CRUD; Sign button shows tooltip if no sign permission.
- `read_only`: view-only.

---

### Phase 3c — Part 77 Obstruction Surface UI

📘 **Standalone deep dive:** `docs/PHASE_3C_VERIFICATION.md`

**Scope:** Per-approach-type Part 77 engine (6 §77.19 variants) · runway editor `faa_approach_type` + `faa_approach_category` dropdowns · obstruction-tool surface picker · color-keyed legend on detail page.

**Routes:** `/obstructions` (form) · `/obstructions/[id]` (detail + legend) · `/base-config/setup` Runways tab

#### Pre-checks
- KDRA RWY 01/19 has `faa_approach_type='non_utility_non_precision_3_4'` + `faa_approach_category='C'` (demo seed).

#### Worked flow
1. **Base Setup runway editor** → Edit RWY 01/19 → confirm the two civilian-only dropdowns show seeded values. **Runway Class dropdown is hidden on civilian bases** (it's UFC-specific; civilian uses FAA Approach Type instead). Change category to D, save, reload — persists. The row header line reads `01/19 — Non-utility runway · non-precision approach ≥¾ mi` (FAA approach type label) rather than `— Class B`.
2. **`/obstructions`** → Surface Set picker visible at top; defaults to FAA Part 77 (cyan border). Helper line confirms approach type configured (no warning chip).
3. Pick a point ~1.5 mi off RWY 01 threshold. Enter height 110 ft. Click **Evaluate Obstruction** → results show 5 Part 77 surfaces (no UFC-only).
4. Switch picker to UFC → re-evaluate → 10 UFC surfaces; different numbers.
5. **Detail page legend (now pinned to the saved evaluation):** Open a saved evaluation. Expand "Surface Set Reference" → 5 Part 77 (or 10 UFC) surfaces with color swatch + name + description + §77.19 / UFC reference.
6. **Surface-set pinning regression:** Flip `bases.obstruction_surface_set` for KDRA (e.g. via `/base-config/setup` or direct SQL). Reload the saved evaluation from step 5 → the legend **still** shows the originally-saved set (Part 77 with 5 surfaces), not the new base default. Row's `surface_set` column was pinned at create-time — column added by `2026061200`. Legacy rows pre-dating that migration fall back to the base default.

#### Engine spec smoke (browser console)
```js
const { getPart77Surfaces } = await import('@/lib/calculations/obstructions')
getPart77Surfaces('utility_visual').primary.criteria.halfWidth         // 125 (250 ft total)
getPart77Surfaces('non_utility_precision').approach.criteria.slope     // 50 (first segment)
getPart77Surfaces('non_utility_precision').approach.criteria.secondSegmentSlope // 40

// pointToRunwayRelation now accepts an opts.primaryHalfWidth override
// (defaults to UFC 1,000 ft if omitted — UFC callers unchanged):
const { pointToRunwayRelation } = await import('@/lib/calculations/geometry')
// UFC default: 1000-ft halfWidth controls relation.withinPrimary
// Part 77 caller: pass opts.primaryHalfWidth: 125 / 250 / 500 per approach type
```

---

### Phase 3d — Field Conditions / TALPA

📘 **Standalone deep dive:** `docs/PHASE_3D_VERIFICATION.md`

**Scope:** RwyCC engine across 13 §AC 30D contaminants · FICON NOTAM text generator · per-third assessment with operator override · append-with-supersede chain · 6 treatments · live preview · auto-copy on save.

**Routes:** `/field-conditions`

#### Pre-checks
- KDRA seed has 2 historical FCRs from a 2026-02-08 winter snow event (newer supersedes older). No active FCR for "today".

#### Worked flow
1. `/field-conditions` → RWY 01/19 placeholder "No active report — conditions presumed dry (6/6/6)".
2. Past 30 Days → expand → 2 entries from 2026-02-08 with FICON text in monospace.
3. Click **+ New Report** → set all 3 thirds Dry Snow 1.5 IN → preview `RWY 01/19 3/3/3 100/100/100 PCT DRY SN 1.5IN`. Add Plowed + 28°F → `... TRTD W/PLOW`.
4. Set Rollout Wet Snow 2.5 IN → preview `RWY 01/19 3/3/2 100/100/100 PCT DRY SN WET SN 2.5IN TRTD W/PLOW`.
5. Override Rollout 2 → 3 with reason → preview `3/3/3`.
6. Save → toast "FCR saved · FICON copied to clipboard". Paste to verify.
7. Click **Issue Update** → modal pre-fills; bump Touchdown to Wet Snow → save → prior back-fills `superseded_by_id`.
8. `/activity` shows the two FCR ISSUED entries.

#### Engine smoke (browser console)
```js
const { deriveRwycc, buildFiconNotamText } = await import('@/lib/calculations/rwycc')
deriveRwycc({ contaminant: 'compacted_snow', temperatureC: -20 })  // 4
deriveRwycc({ contaminant: 'wet_ice' })                            // 0
```

---

### Phase 3e — WHMP

📘 **Standalone deep dive:** `docs/PHASE_3E_VERIFICATION.md`

**Scope:** Annual WHMP assessment per (base, year) with supersede chain · hazardous species register (JSONB) · mitigation summary · findings list · "Promote to SMS Hazard" deep-link · AE annual review.

**Routes:** `/wildlife/whmp`

#### Pre-checks
- KDRA seed has 2026 WHMP filed by USDA Wildlife Services 2026-09-15, AE-signed 2026-10-12, 3 species + 2 findings.

#### Worked flow
1. `/wildlife/whmp` → active 2026 card. 3 species rows (Canada Goose HIGH, Red-Tailed Hawk MEDIUM, White-Tailed Deer SEVERE). 2 findings with "Promote to SMS Hazard" + "Mark Linked".
2. Click **Promote to SMS Hazard** on finding #1 → opens `/sms/hazards?prefill_title=…&prefill_description=…&prefill_source=whmp&prefill_source_ref_id=…`. The Add Hazard modal auto-opens with the finding's title + description pre-filled and a "Pre-filled from WHMP" pill in the modal header. The URL strips the prefill params via `router.replace` so a refresh doesn't re-open the modal.
3. Click **Add Hazard** → row saves with `source_type='whmp'` (extended to the CHECK enum by `2026061100`) and `source_ref_id` pointing at the WHMP assessment. Note the hazard code (e.g. `HZ-0005`).
4. Return to WHMP → **Mark Linked** → paste code → finding shows green "Linked: HZ-0005" chip.
5. Click **Amend / Supersede** → modal pre-fills; add a 4th species. Save → original 2026 row gets `superseded_by_id` set.
6. Prior Years collapse → expand → original 2026 row shows with "Superseded" label.
7. Click **Record Annual Review** → notes prompt → `last_reviewed_at` stamps.
8. **Annual review reminder smoke** (production cron, mirror of §3b step 9): when WHMP's `last_reviewed_at` is > 305 days old, `/api/annual-review-digest` includes the WHMP row in the daily email. AEP + WHMP roll into one per-base digest message; same-day re-runs are deduped via `annual_review_digest_log`.

---

## 3. Cross-cutting regression smoke

| Surface | Expected |
|---|---|
| `/scn` on Demo AFB (USAF) | Unchanged — primary + backup check cards, agency editor, monthly PDF work as before |
| `/wildlife/*` on Demo AFB (USAF) | Sightings + strikes + heatmap + analytics tabs unchanged; no WHMP entry in sidebar |
| `/obstructions` on Demo AFB | Picker defaults to UFC; evaluation produces identical results to pre-Phase 3c (10 UFC surfaces, same numbers) |
| `/base-config/setup` Runways on Demo AFB | Runway Class dropdown still visible (B / Army_B); existing USAF runways unchanged. Civilian KDRA has the dropdown hidden — gated by `isCivilian()`, runway_class persists as NULL. |
| `/obstructions/[id]` legend after a base-setting flip | Legend reflects the **saved** evaluation's `surface_set`, not the current `bases.obstruction_surface_set`. Pinned per row by `2026061200`. |
| `/sms/*` on KDRA | Phase 2 SMS unchanged; sidebar icons render correctly (Phase 2 SMS icon bug fixed incidentally in Phase 3b Cluster B) |
| `/training/*` on KDRA | Phase 3a unchanged; module-config gate filters USAF |
| `/aep/*` on KDRA | Phase 3b unchanged |
| `/help` (renamed from old `/training`) | Glidepath in-app help with 27 module deep-dives unchanged |
| All sidebar group icons | Correct icons; no `Home` fallback for SMS / Training / AEP / WHMP section labels |
| Test suite | 466 / 466 pass — 99 Phase 3 tests + 14 post-Phase-3 annual-review-due tests + 353 baseline |
| Existing USAF discrepancy / inspection / check flows on Demo AFB | Zero behavioral change — all USAF surfaces unaffected by civilian retrofit |
| `/users` role grid on USAF base | Civilian-only roles (sms_manager, aep_coordinator, etc.) absent or marked civilian-only |

---

## 4. Cross-cutting theme + mobile audit

### Light-mode visual check across all modules
1. Toggle light mode in Settings.
2. Walk Phase 2 SMS: `/sms`, `/sms/policy`, `/sms/hazards`, `/sms/spis`, `/sms/audits`, `/sms/moc`, `/sms/reports` → risk-band chips (Low/Medium/High/Extreme), SPI sparklines, MOC status pills all readable in both themes.
3. Walk Phase 3a: `/training`, `/training/topics`, `/training/roster`, `/training/compliance` → status chips (current/expiring/expired/not_started) + matrix glyphs readable.
4. Walk Phase 3b: `/aep`, `/aep/plan`, `/aep/agencies`, `/aep/comms-checks`, `/aep/drills` → RwyCC-style chips, AE sign card, comms status pills (loud_clear / no_response / oos / not_reached) readable.
5. Walk Phase 3c: `/obstructions` + `/obstructions/[id]` → picker buttons readable in active + inactive; legend swatches visible.
6. Walk Phase 3d: `/field-conditions` → RwyCC chips, modal inputs, derived-RwyCC pills all visible.
7. Walk Phase 3e: `/wildlife/whmp` → hazardous species rows with hazard-level left-rules visible on both themes; finding chips readable.

Expected: zero raw `text-zinc-*` / `bg-zinc-*` / filled-amber classes anywhere. All chrome uses `color-mix()` + theme vars + dark-saturated rgb per `feedback_theme_aware_tokens.md` + `feedback_amber_text_contrast.md`.

### Mobile PWA pass
1. Open Vercel preview on iPhone (or Chrome mobile emulation).
2. Each phase: multi-column grids collapse to single column; modals fit within safe-area insets; tap targets remain accessible.
3. Verify the iOS PWA bottom-nav chrome doesn't overlap any "+ New" action buttons.
4. Live previews (FICON in Phase 3d modal, hazard band chip in SMS 5×5) update reactively on narrow viewports.

---

## 5. Master failure triage

| Symptom | Likely cause | Fix |
|---|---|---|
| Sidebar entry missing for a Phase 2+ module | Module-config `appliesTo` filter (USAF base) | Switch to KDRA via installation picker |
| Sidebar icon is `Home` instead of correct lucide | sidebar-nav.tsx ICON_MAP missing the icon (Phase 2 SMS bug fixed in 3b) | Confirm `ShieldAlert`, `Siren`, `TrendingUp`, `MessageSquareWarning`, `GitBranch`, `CloudSnow` all in ICON_MAP |
| Page 404 on a Phase 2+ route | Base's `enabled_modules` array missing the module key | `UPDATE bases SET enabled_modules = array_append(enabled_modules, '<key>') WHERE icao='KDRA';` |
| Civilian terminology not appearing (USAF terms leak through) | Component hardcoded USAF literal | Route through `getRoleLabel()` / `getTerm()` from `lib/airport-mode.ts` |
| 22 FAA regs missing from reference library | Phase 1 migration `2026052502` not applied | Re-apply via `npx supabase db query --linked --file` |
| RLS insert returns 403 | User missing `<module>:write` permission | `SELECT * FROM role_permissions WHERE role=<role>` — confirm grant |
| Public form submission fails (SMS or PPR) | SECURITY DEFINER RPC not deployed | Re-check migration `2026052702` (SMS) or PPR equivalent |
| PDF storage upload returns 403 | Path-scoped storage policy not applied | Re-apply `2026053005` (training) / `2026060705` (aep) / `2026061000` (whmp) |
| SMS SPI doesn't update after AEP drill / comms check | pg_cron 02:30 UTC hasn't fired yet | Manual: `SELECT public._sms_compute_spi_measurements(CURRENT_DATE);` |
| `/api/training-expiry-digest` returns 500 | `CRON_SECRET` not set in Vercel | Set in dashboard, redeploy |
| `/api/annual-review-digest` returns 500 | Same — `CRON_SECRET` missing (or `RESEND_API_KEY`) | Set in Vercel dashboard, redeploy |
| Annual-review digest emails the same base twice in one day | Bug — `UNIQUE (base_id, send_date)` on `annual_review_digest_log` should prevent it | Confirm migration `2026061201` applied; inspect dedup row by hand |
| Field Conditions FICON missing depth | Depth IN required for snow/slush types | Add depth in modal before save |
| WHMP "Promote to SMS Hazard" opens empty form | Bug — `/sms/hazards` should auto-open modal from `prefill_*` query params (wired by `ee7110b` / migration `2026061100`) | Confirm SMS_WRITE permission; check that the encoder URL points to `/sms/hazards?...` (no `/new`) — if it still has `/new`, the WHMP build is stale |
| AEP supersede leaves both rows looking active | Bug — atomic RPC `supersede_aep_plan` (migration `2026061102`) should make this impossible | Confirm RPC exists: `SELECT proname FROM pg_proc WHERE proname='supersede_aep_plan';` |
| Civilian runway shows "Class null" in setup row | Display path didn't fall back to FAA approach type — regression vs `2c9f202` | Confirm `runway_class IS NULL` for the row and the display falls through to `faa_approach_type` label |
| WHMP year already exists error | UNIQUE (base, year) constraint | Click "Amend / Supersede" on the active card instead |
| Phase 3c picker doesn't change defaults | `bases.obstruction_surface_set` overrides mode default | `SELECT obstruction_surface_set FROM bases WHERE icao='KDRA';` should be `'faa_part77'` |
| Test suite drops below 466 | Regression introduced | `npx vitest run --reporter=verbose` to find the failing test |

---

## 6. Verified-by sign-off

Initial each phase as it completes a full walkthrough. Once all rows are signed off + cross-cutting sections pass, the FAA Part 139 expansion is verified end-to-end.

| Section | Verifier | Date | Notes |
|---|---|---|---|
| §0 Master pre-flight | _(unset)_ | — | |
| §1 Cross-cutting mode gating | _(unset)_ | — | |
| §2.1 Phase 1 — Foundation | _(unset)_ | — | |
| §2.2 Phase 2 — SMS | _(unset)_ | — | |
| §2.3 Phase 3a — Training | _(unset)_ | — | |
| §2.4 Phase 3b — AEP | _(unset)_ | — | |
| §2.5 Phase 3c — Part 77 UI | _(unset)_ | — | |
| §2.6 Phase 3d — Field Conditions | _(unset)_ | — | |
| §2.7 Phase 3e — WHMP | _(unset)_ | — | |
| §3 Cross-cutting regression | _(unset)_ | — | |
| §4 Cross-cutting theme + mobile | _(unset)_ | — | |
| **Master sign-off** (all phases verified end-to-end) | _(unset)_ | — | |

---

## 7. Extending this doc

When a new phase ships:

1. **Add the phase to the header list** at the top of this doc.
2. **Update §0.2** SQL block to include new tables in the `IN (...)` list and bump the expected row count.
3. **Update §0.3** KDRA demo data section if the phase ships seed data.
4. **Update §1 mode-gating matrix** with any new sidebar entries / route gates.
5. **Add a new subsection in §2** (`### Phase X — Name`) following the template:
   - Standalone doc link (📘) if one exists
   - Scope blurb
   - Routes line
   - Pre-checks
   - Worked flow (numbered steps)
   - Permission gating table (if non-trivial)
   - Failure triage (3-6 most likely issues)
6. **Update §3 regression** with any cross-impact (e.g. SMS feed, sidebar group, terminology helper)
7. **Update §5 master failure triage** with new common issues
8. **Add the new phase row to §6 sign-off**

The standalone PHASE_<N>_VERIFICATION.md doc (if maintained) keeps the deep-dive flows; this master doc keeps the master walkthrough lean. Aim for ~50-80 lines per phase in this doc; if a phase needs more, split off a standalone.
