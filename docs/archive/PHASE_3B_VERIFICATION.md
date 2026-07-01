# Phase 3b — AEP Module Verification

**Phase:** 3b — Airport Emergency Plan (14 CFR §139.325 · AC 150/5200-31C)
**Commits:** `f49ced0` (B) · `8730e90` (C) · `ed3efd0` (D) · `867eea6` (E)
**Build state at last verify:** `tsc` ✓ · `build` ✓ · `vitest` ✓ 376 / 376

> This doc is one section of a future cross-phase super-doc covering
> Phase 1 (foundation) → Phase 2 (SMS) → Phase 3a (Training) → Phase 3b
> (AEP) → Phase 3c+ (Part 77 / TALPA / WHMP). Each phase's verification
> doc uses the same scaffold (pre-flight · mode-gating · per-route flow
> · cross-cutting · regression · failure triage) so the super-doc can
> reuse the section structure verbatim.

---

## Pre-flight

Run from `C:/Users/cspro/airfield-app` with `npm run dev` at http://localhost:3000.

1. **Verify branch + clean tree.** `git status` → "On branch main, nothing to commit." Untracked `.claude/` and pre-existing `docs/*` files are expected.

2. **Confirm AEP tables present.**
   ```sql
   SELECT table_name, COUNT(*) AS column_count
     FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name LIKE 'aep_%'
    GROUP BY table_name ORDER BY table_name;
   ```
   Expect 5 rows: `aep_comms_check_results` (9), `aep_comms_checks` (10), `aep_drills` (17), `aep_plans` (18), `aep_response_agencies` (14).

3. **Confirm AEP SPIs seeded on KDRA.**
   ```sql
   SELECT s.code, s.title, s.computation_key
     FROM sms_spis s JOIN bases b ON b.id = s.base_id
    WHERE b.icao = 'KDRA' AND s.code IN ('SPI-005','SPI-006');
   ```
   Expect 2 rows: SPI-005 / SPI-006 with computation_key `aep_full_scale_drill_overdue` and `aep_comms_checks_last_90d`.

4. **Start dev server.** `npm run dev` → open http://localhost:3000

---

## Mode-gating smoke (do this first, before any data entry)

| As | Action | Expect |
|---|---|---|
| USAF user (Demo AFB / KDMO) | `/aep` direct URL | Redirect or 404 — module disabled by `appliesTo: ['faa_part139']` |
| USAF user | Sidebar | "Secondary Crash Net" present under Operations; no "Airport Emergency Plan" section |
| Switch to KDRA via picker | Sidebar | "Airport Emergency Plan" section appears (5 items); SCN entry hidden |
| KDRA | `/scn` direct URL | Redirect or 404 — SCN is `appliesTo: ['usaf']` |
| KDRA | `/more` page | Three collapsible groups render with correct icons: SMS (ShieldAlert), Training (GraduationCap), AEP (Siren). **None should fall back to the Home icon — that was the Phase 2 SMS bug fixed in Cluster B.** |

---

## Wizard step (KDRA, `sys_admin` or `base_admin`)

1. Navigate `/base-config/setup` → step 11.
2. Should render as **"AEP Agencies"** (not "SCN Agencies" — civilian mode).
3. Add 3 quick entries:
   - `Engine 7` · ARFF · `555-555-5555`
   - `County EMS` · EMS · (blank phone)
   - `Springfield Tower` · ATC · (blank phone)
4. Each addition: toast "Added …" + row appears + `markSaved('aepagencies')` fires.
5. Click the deep-link "Response Agencies" in the intro text → routes to `/aep/agencies`.

---

## /aep/agencies

1. Confirm **grouped layout**: ARFF / EMS / ATC role sections, sorted by sort_order within each.
2. Click **Add Agency** → modal opens with full form (name, role, primary/backup contact, radio, notes).
   - Add `Mercy Hospital` · Hospital · primary `ER Charge Nurse / 555-911-9111` · radio `VHF 462.150 / Ch. Med-9` · notes `Activate via 911 dispatch`.
3. **Edit** `Engine 7` → set backup_contact: `Engine 12 / 555-555-5556` → Save.
4. **Reorder smoke**: in any role group with ≥2 rows, click the up/down arrow → row swaps; reload to confirm persistence.
5. **Active toggle**: click "Active" on `Engine 7` → row dims, moves to inactive group; "Show 1 inactive" link appears at the bottom. Toggle back to active.

---

## /aep/plan

1. `/aep/plan` → "No active plan" card visible.
2. Click **Create First Plan** → form opens; auto-fills version `2026.1`, effective_date = today.
   - Fill FAA Acceptance Date `2026-05-02`, FAA Reference `ATL-AEP-2026-04`.
   - Upload any PDF as the plan document.
   - Save → toast "AEP plan created"; active-plan card appears with all metadata.
3. **Verify storage RLS**: the uploaded PDF link opens. Confirms civilian user with `aep:write` can upload + read under `aep-plans/<base>/<plan>/...`.
4. Click **Sign + Activate** → optional notes prompt → `ae_signed_at` populates; card header turns green.
5. Click **Record Annual Review** → notes prompt → `last_reviewed_at` populates.
6. Click **Upload New Version**:
   - Version `2026.2`, today's date, no PDF this time.
   - Click "Supersede Active Plan" → toast "Plan superseded".
   - History table: v2026.1 with "Superseded" pill, v2026.2 with "Active" pill.

---

## /aep/comms-checks

1. **This Month's Comms Check** card → "Pending" with agency count.
2. Click **Run Check** → modal opens with all 4 agencies.
3. Set **Mercy Hospital** → `Out of Service` → mandatory notes dialog opens → enter "Radio in shop, ETR Friday" → Save Notes.
4. Set **County EMS** → `Not Reached` (verify this 4th status exists — AEP-specific vs SCN's 3).
5. Set **Springfield Tower** → `No Response`.
6. Leave **Engine 7** as `Loud & Clear`.
7. Click **Log Check** → toast "AEP comms check logged".
8. **Verify Events Log entry** at `/activity`:
   > AEP COMMS CHECK COMPLETE — ALL LOUD & CLEAR EXCEPT COUNTY EMS (NOT REACHED), SPRINGFIELD TOWER (NO RESPONSE), MERCY HOSPITAL (OUT OF SERVICE: RADIO IN SHOP, ETR FRIDAY)
9. Refresh `/aep/comms-checks` → card now shows "Complete" with the summary line; history below empty.

---

## /aep/drills

1. `/aep/drills` → Full-Scale chip "Never recorded"; Tabletop chip "None completed [year]".
2. **Schedule a tabletop**:
   - Click "Schedule Drill" → date = today, type = `Tabletop`, scenario = "Hazmat response — fueling truck spill, hot refuel pad".
   - Select Engine 7 + Mercy Hospital + County EMS.
   - Save → toast "Drill scheduled"; row appears with "scheduled" pill.
3. **Complete the tabletop**:
   - Click "Complete" on the row → mark Engine 7 + County EMS as attended; leave Mercy Hospital unchecked.
   - After-action notes: "Worked through decontamination checklist end-to-end. Total time elapsed 47 min."
   - Findings: "Need updated MSDS for new fueling agent."
   - Optional: upload any PDF as AAR.
   - Click "Mark Drill Completed" → toast; pill flips to "completed"; attendance shows "2 of 3".
4. **Schedule + complete a Full-Scale** (to flip SPI-005):
   - Schedule Drill → date = today, type = `Full-Scale Exercise`, scenario = "Aircraft accident, mass casualty, RWY 13 midfield". Select all 4 agencies. Save.
   - Immediately Complete: mark all 4 attended; brief AAR notes.
5. Refresh `/aep/drills` → Full-Scale chip flips to **"Due in 36 months"** (green); Tabletop chip "1 completed [year]".

---

## /aep AE dashboard

1. `/aep` → 4 cards should all be green:
   - **Plan Status**: green chip, "Plan current — next review due [+12 mo]".
   - **Full-Scale Exercise**: green, "Due in 36 months", "Last: today".
   - **Comms Check (This Month)**: green, "Complete — 3 exceptions".
   - **Response Agencies**: green, "4 active".
2. **Plan PDF**: click → downloads `aep-plan-KDRA-2026.2-YYYYMMDD.pdf`. Opens cleanly in Acrobat. Verify sections: header, version, FAA acceptance, AE sign-off block, response-agency roster table grouped by role, plan history.
3. **Drill Log PDF** (current year): click → downloads `aep-drills-KDRA-2026.pdf`. Verify: stats row, chronology table (2 rows: tabletop + full-scale), per-drill detail block for each with scenario, attendance, after-action notes, findings (in red where present).
4. **Monthly Comms PDF** (current month): click → downloads `aep-comms-check-KDRA-2026-MM.pdf`. Verify: agency × check-date matrix with status-tinted cells (L=green, N=amber, X=red, –=grey), legend at bottom, exception footnotes for the 3 non-clear agencies.
5. Confirm "SMS feed" footer link points to `/sms/spis`.

---

## SMS SPI integration

1. **Trigger compute manually**:
   ```sql
   SELECT public._sms_compute_spi_measurements(CURRENT_DATE);
   ```
2. **Query SPI-005 + SPI-006 on KDRA**:
   ```sql
   SELECT s.code, m.value, m.status, m.period_start, m.period_end
     FROM sms_spi_measurements m
     JOIN sms_spis s ON s.id = m.spi_id
     JOIN bases b ON b.id = m.base_id
    WHERE b.icao = 'KDRA' AND s.code IN ('SPI-005','SPI-006')
    ORDER BY s.code, m.period_start DESC;
   ```
3. **Expected after the drill + comms-check exercises above**:
   - **SPI-005** (Full-Scale Drill Overdue): value `0`, status `on_target` (full-scale logged today).
   - **SPI-006** (Comms Checks last 90d): value `1`, status `warning` (target ≥3, value 1 — between target and alert).
4. Navigate `/sms/spis` → both SPIs render in the dashboard with the new values.

---

## Permission gating (KDRA users with different roles)

| Role | `/aep` cards | `/aep/plan` | `/aep/agencies` | `/aep/drills` | `/aep/comms-checks` |
|---|---|---|---|---|---|
| `read_only` (`aep:read` only) | render | active plan visible; no Upload button | roster visible; no Add/Edit/Delete | log visible; no Schedule/Complete/Delete | history visible; no Run Check |
| `aep_coordinator` (read + write) | render | full CRUD; **Sign + Activate** button shows tooltip if clicked (no sign permission) | full CRUD | full CRUD | full CRUD |
| `accountable_executive` (read + sign) | render | can record annual review; **cannot create new plan** (no write) | read-only | read-only | read-only |
| `sys_admin` / `base_admin` | render | full | full | full | full |

(Soft enforcement note in handoff: the AE sign action is an UPDATE gated on `aep:write` at RLS; the UI gates the button on `aep:sign`. Pilot feedback can tighten this to a SECURITY DEFINER RPC if needed.)

---

## Theme audit (manual visual)

1. Toggle **light mode** in Settings → walk every `/aep/*` route.
2. Confirm:
   - Status pills readable on both themes (no muddy amber-on-amber).
   - Chip borders visible.
   - Card accents (left rule color) clear against the card background.
   - PDF download buttons readable.
3. Should match the SMS / Training module standard (the `color-mix()` + dark-saturated rgb pattern from `feedback_amber_text_contrast.md` / `feedback_theme_aware_tokens.md`).

---

## Mobile / PWA pass

1. Open `/aep` on iPhone (Vercel preview) or Chrome mobile emulation.
2. Verify:
   - 4-card AE summary grid collapses to 2-col then 1-col.
   - Agency rows wrap cleanly; primary/backup contact summaries don't overflow.
   - Modals fit within viewport with safe-area insets.
   - PWA bottom-nav chrome doesn't overlap the PDF export row at the bottom of `/aep`.
   - "Run Check" modal scrolls within the 90 vh container; the OOS notes dialog stacks above the parent modal.

---

## Regression smoke

| Surface | Expected |
|---|---|
| `/scn` on Demo AFB (USAF) | Works exactly as before — primary + backup check cards, agency editor, monthly PDF. |
| `/training/*` on KDRA | Loads cleanly; sidebar icon = `GraduationCap` (no `Home` fallback). |
| `/sms/*` on KDRA | All sub-pages load; sidebar icons correct (`ShieldAlert`, `TrendingUp`, `MessageSquareWarning`, `GitBranch` — was `Home` for all four before Cluster B's incidental fix). |
| `/help` on USAF + KDRA | The renamed (from `/training`) Glidepath help still serves the 27 module deep-dives. |

---

## Failure triage

| Symptom | Likely cause | Fix / next step |
|---|---|---|
| PDF download fails silently | Browser blocked download / jsPDF error in console | Open DevTools console; check for `Cannot find module '@/lib/aep-pdf'` (dynamic import path) |
| Storage upload returns 403 | RLS policy not applied OR user missing `aep:write` | Re-run `npx supabase db query --linked --file supabase/migrations/2026060705_aep_storage_rls.sql`; verify user has the role grant from `2026052503` |
| SPI compute doesn't update | pg_cron not running on the target environment, OR civilian SPI seed didn't run | Manual trigger: `SELECT public._sms_compute_spi_measurements(CURRENT_DATE);` then re-query. To re-seed: `SELECT public._sms_seed_default_spis('<base_id>');` |
| Wizard step `aepagencies` doesn't appear | KDRA `airport_type` ≠ `'faa_part139'` OR `enabled_modules` missing `'aep'` | `SELECT airport_type, enabled_modules FROM bases WHERE icao='KDRA';` — add `'aep'` to the array if missing. |
| `/aep` 404 on KDRA | Module not in `bases.enabled_modules` OR app cached USAF mode after switch | Update `enabled_modules`; hard-reload to clear context |
| Comms-check OOS notes dialog won't dismiss | Notes field empty (intentional guard) | Type any notes text, then "Save Notes"; or "Cancel OOS" to revert to Loud & Clear |
| Sidebar icons render as `Home` | `ICON_MAP` missing the lucide import (regression of Cluster B fix) | Re-check `components/layout/sidebar-nav.tsx` ICON_MAP includes ShieldAlert, Siren, TrendingUp, MessageSquareWarning, GitBranch |

---

## Verified-by sign-off

| Verifier | Date | Notes |
|---|---|---|
| _(unset)_ | — | First-pass verification pending |
