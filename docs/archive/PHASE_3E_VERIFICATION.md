# Phase 3e — WHMP Verification

**Phase:** 3e — Wildlife Hazard Management Plan (14 CFR §139.337 · AC 150/5200-33C · AC 150/5200-32B)
**Commits:** `319464a` (B — schema + CRUD + UI + tests) · _Cluster C commit_ (verification + handoff)
**Build state at last verify:** `tsc` ✓ · `build` ✓ · `vitest` ✓ 452 / 452

> Same scaffold as `PHASE_3B/3C/3D_VERIFICATION.md` for super-doc composition.

---

## Pre-flight

Run from `C:/Users/cspro/airfield-app` with `npm run dev` at http://localhost:3000.

1. **Verify branch + clean tree.** `git status` → "On branch main, nothing to commit." Pre-existing untracked files OK.
2. **Confirm migration applied.**
   ```sql
   SELECT column_name FROM information_schema.columns
    WHERE table_name = 'wildlife_hazard_assessments'
    ORDER BY ordinal_position;
   ```
   Expect ~22 columns (id, base_id, assessment_year, performed_*, report_url, faa_*, ae_*, last_reviewed_*, hazardous_species, mitigation_summary, findings, notes, replaced_by_id, …).
3. **Confirm RLS + storage policy seeded.**
   ```sql
   SELECT policyname FROM pg_policies WHERE tablename = 'wildlife_hazard_assessments';
   -- expect: whmp_select, whmp_insert, whmp_update (3 rows)
   SELECT policyname FROM pg_policies WHERE schemaname='storage' AND policyname='whmp_storage_insert';
   -- expect: 1 row
   ```
4. **Start dev server.** `npm run dev` → http://localhost:3000

---

## Mode-gating smoke (do this first)

| As | Action | Expect |
|---|---|---|
| USAF user (Demo AFB / KDMO) | `/wildlife/whmp` direct URL | Redirect or 404 — module disabled by `appliesTo: ['faa_part139']` |
| USAF user | Sidebar Operations section | No "Wildlife / WHMP" entry |
| Switch to KDRA (civilian) | Sidebar | "Wildlife / WHMP" appears under Operations (ClipboardCheck icon, right after Wildlife / BASH) |
| KDRA `read_only` role | `/wildlife/whmp` | Page loads, empty state visible, no "+ New Year" or "Sign + Activate" buttons |
| KDRA `safety` / `airfield_manager` / `base_admin` / `sys_admin` (wildlife:write holders) | `/wildlife/whmp` | Full CRUD: "+ New Year" button + all action buttons visible |

---

## Flow walk on KDRA — Example 1 (first annual WHMP)

1. Open `/wildlife/whmp` on KDRA. Empty state: "No WHMP on file. Upload your first annual assessment..." with **File First Assessment** button.
2. Click **File First Assessment** (or "+ New Year" in the header).
3. Modal opens. Verify:
   - Year: defaults to 2026 (current calendar year)
   - Performed Date: defaults to today
   - Performed By (external): empty text input
   - FAA Acceptance Date + Reference: empty (optional)
   - WHMP Document (PDF): "Choose PDF..." button
   - Hazardous Species: empty list with "Add Species" button
   - Mitigation Summary: empty textarea
   - Findings: empty list with "Add Finding" button
   - Notes: empty textarea
4. Fill:
   - Performed Date: 2026-09-15
   - Performed By: "USDA Wildlife Services"
   - FAA Acceptance Date: 2026-10-04
   - FAA Acceptance Reference: "ATL-WS-2026-04"
   - Upload any PDF (the WHMP document)
5. Click **Add Species** three times. Fill:
   - Canada Goose · HIGH · attractants: "standing water near RWY 13, retention pond" · mitigations: "weekly mowing, pyrotechnic dispersal"
   - Red-Tailed Hawk · MEDIUM · attractants: "tall grass on east apron" · mitigations: "grass height < 6 in"
   - White-Tailed Deer · SEVERE · attractants: "forested perimeter" · mitigations: "quarterly 8-ft fence inspection"
6. Mitigation Summary: "Increased grass-cutting frequency to weekly between Apr-Oct. Added 2 propane cannons near runway 13 threshold."
7. Click **Add Finding**:
   - Finding: "Grass height exceeded 8 inches in May survey (target ≤ 6 inches)"
   - Category: Habitat
   - Recommended action: "Increase mowing cadence to weekly between Apr-Oct"
8. Save → toast: "WHMP 2026 filed · 3 species · 1 finding"
9. Page shows the active 2026 assessment card with green left border.
10. Verify the active card displays:
    - "2026 Assessment" header with check icon
    - Performed metadata
    - FAA Acceptance + AE Sign-off + Annual Review chips (AE sign-off shows "Awaiting AE signature")
    - "View 2026 WHMP document" link (opens the uploaded PDF)
    - 3 hazardous species rows with left-rule colored by hazard level (green / amber / red)
    - Mitigation summary text
    - 1 finding with "Promote to SMS Hazard" + "Mark Linked" buttons
    - "Sign + Activate" + "Amend / Supersede" buttons

---

## Flow walk on KDRA — Example 2 (AE annual review sign-off)

1. Continuing from Example 1, click **Sign + Activate** on the active card.
2. Prompt for optional review notes → leave blank or type a brief note.
3. Page reloads. Verify:
   - AE Sign-off chip now shows "Signed YYYY-MM-DD"
   - Annual Review chip turns green: "Due 2027-09-26 (~365d)"
   - Button label changes to "Record Annual Review"
4. SQL verification:
   ```sql
   SELECT ae_signed_at, last_reviewed_at, reviewed_by_user_id
     FROM wildlife_hazard_assessments
    WHERE base_id = (SELECT id FROM bases WHERE icao='KDRA')
      AND assessment_year = 2026 AND replaced_by_id IS NULL;
   -- both timestamps populated, reviewed_by_user_id = your user id
   ```

---

## Flow walk on KDRA — Example 3 (mid-year amendment)

1. Click **Amend / Supersede** on the active card.
2. Modal pre-fills with the existing 2026 data including all 3 species and the 1 finding.
3. Add a 4th hazardous species:
   - Snow Goose · HIGH · attractants: "open water near taxi route Y" · mitigations: "enhanced dispersal protocol Dec-Feb"
4. Add a 2nd finding:
   - "Stormwater detention pond installed 2026-08 — new attractant for waterfowl"
   - Category: Infrastructure
   - Recommended action: "Coordinate with airport engineering for pond cover or relocation"
5. Save → toast: "WHMP 2026 amended · 4 species · 2 findings"
6. Active card now shows the amended version (4 species, 2 findings).
7. SQL verification:
   ```sql
   SELECT id, assessment_year, replaced_by_id, jsonb_array_length(hazardous_species) AS species_count, jsonb_array_length(findings) AS findings_count
     FROM wildlife_hazard_assessments
    WHERE base_id = (SELECT id FROM bases WHERE icao='KDRA')
    ORDER BY created_at DESC LIMIT 3;
   -- newest row: replaced_by_id IS NULL, species_count=4, findings_count=2
   -- prior row: replaced_by_id = newest row's id, species_count=3, findings_count=1
   ```
8. Expand "Prior Years" — the original first assessment shows with "Superseded" label.

---

## Flow walk on KDRA — Example 4 (promote finding to SMS hazard)

1. On the active card, find a finding without a linked SMS hazard.
2. Click **Promote to SMS Hazard** → opens new browser tab to `/sms/hazards/new?prefill_title=...&prefill_description=...&prefill_source=whmp&prefill_source_ref_id=<id>`.
3. Inspect the URL — verify all 4 query params present and URL-encoded.
4. (If the SMS hazard create form is wired to read query params, the form pre-fills. If not yet wired, the form opens empty — that's expected and noted in the plan risks. Copy the finding text manually from the URL.)
5. Complete the SMS hazard form, save → note the hazard code (e.g. `HZ-2026-014`).
6. Return to `/wildlife/whmp` tab.
7. Click **Mark Linked** on the same finding.
8. Dialog opens: paste `HZ-2026-014` → Save Link.
9. The finding row now shows a green "Linked: HZ-2026-014" chip in place of the "Promote to SMS Hazard" button.

---

## Permission gating

| Role | Page loads | Active card visible | Buttons visible |
|---|---|---|---|
| `read_only` (no wildlife:write) | yes | yes, full content | none (read-only view) |
| `safety` / `airfield_manager` / `base_admin` / `sys_admin` (wildlife:write) | yes | yes | + New Year, Sign + Activate, Amend / Supersede, Promote to SMS Hazard, Mark Linked |

---

## Theme audit (manual visual)

1. Toggle **light mode** in Settings.
2. Walk `/wildlife/whmp`:
   - Active card: green-tinted background readable on light theme
   - Hazardous species rows: left-rule color (green / amber / red) visible on both themes
   - Finding chips (category + linked-status): cyan / green tinted backgrounds readable
   - Modal: form inputs + species/finding inline editors readable
3. Verify: no muddy amber-on-amber, no invisible white-on-white. Matches the Phase 3b AEP / Phase 3d Field Conditions standard.

---

## Mobile / PWA pass

1. Open `/wildlife/whmp` on iPhone (Vercel preview) or Chrome mobile emulation.
2. Verify:
   - Active card grid (FAA Acceptance / AE Sign / Annual Review) collapses to a single column
   - Hazardous species rows wrap cleanly
   - "Promote to SMS Hazard" button + "Mark Linked" stack vertically on narrow viewport
   - Modal: species + findings inline editors usable; remove buttons (trash icon) tappable
   - "Choose PDF" file picker accessible

---

## Regression smoke

| Surface | Expected |
|---|---|
| `/wildlife` on KDRA (existing wildlife tabs) | Unchanged — log / heatmap / analytics / reports tabs work as before |
| `/wildlife` on Demo AFB (USAF) | Unchanged |
| Sidebar Operations section | Adds "Wildlife / WHMP" between Wildlife / BASH and PPR Log on civilian bases; absent on USAF |
| `/more` page | Operations group includes "Wildlife / WHMP" (civilian-only via module gate) |
| All prior phase tests | 444 baseline still pass; +8 new whmp tests |

---

## Failure triage

| Symptom | Likely cause | Fix / next step |
|---|---|---|
| "+ New Year" button hidden | User lacks `wildlife:write` | Check `select * from role_permissions where role=<role> and permission_key='wildlife:write'` |
| Modal opens but save fails | Year already exists for that base (UNIQUE constraint) | UI should auto-route to supersede; if not, manually click Amend on the existing year |
| PDF upload returns 403 | Storage RLS policy not applied OR user missing wildlife:write | Re-apply `2026061000` migration; verify policy with `select * from pg_policies where policyname='whmp_storage_insert'` |
| "Promote to SMS Hazard" opens empty SMS form | `/sms/hazards/new` doesn't read prefill_* query params yet | Manual paste from URL is fine for v1; future PR wires the prefill |
| "Mark Linked" doesn't persist | RLS update policy failure | Check console for 403; confirm user holds `wildlife:write` |
| Page 404 on KDRA | Module not in `bases.enabled_modules` OR `airport_type` ≠ `'faa_part139'` | `SELECT enabled_modules, airport_type FROM bases WHERE icao='KDRA'` |
| Annual review chip doesn't update after Sign | Page didn't reload | Hard-reload (Ctrl+Shift+R); chip computed from `last_reviewed_at` |

---

## Verified-by sign-off

| Verifier | Date | Notes |
|---|---|---|
| _(unset)_ | — | First-pass verification pending |
