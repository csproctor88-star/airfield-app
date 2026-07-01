# Phase 3d — Field Conditions / TALPA Verification

**Phase:** 3d — Field Conditions / TALPA (14 CFR §139.313 · AC 150/5200-30D)
**Commits:** `24bf162` (B — schema + engine + wiring) · _Cluster C commit_ (UI + verification)
**Build state at last verify:** `tsc` ✓ · `build` ✓ · `vitest` ✓ 444 / 444

> Same scaffold as `PHASE_3B_VERIFICATION.md` / `PHASE_3C_VERIFICATION.md` for super-doc composition: pre-flight · mode-gating · per-route flow · cross-cutting · regression · failure triage · sign-off.

---

## Pre-flight

Run from `C:/Users/cspro/airfield-app` with `npm run dev` at http://localhost:3000.

1. **Verify branch + clean tree.** `git status` → "On branch main, nothing to commit." Pre-existing untracked files from prior phases expected.
2. **Confirm migration applied.**
   ```sql
   SELECT table_name, COUNT(*) AS column_count
     FROM information_schema.columns
    WHERE table_schema='public' AND table_name LIKE 'field_condition%'
    GROUP BY table_name
    ORDER BY table_name;
   ```
   Expect 2 rows: `field_condition_reports` (14), `field_condition_thirds` (10).
3. **Confirm permission keys + role grants seeded.**
   ```sql
   SELECT key, applies_to FROM permissions WHERE key LIKE 'field_conditions:%';
   -- expect 2 rows, applies_to {faa_part139}
   SELECT role, permission_key FROM role_permissions WHERE permission_key LIKE 'field_conditions:%';
   -- expect ~14 rows (multiple roles)
   ```
4. **Start dev server.** `npm run dev` → open http://localhost:3000

---

## Mode-gating smoke (do this first, before any data entry)

| As | Action | Expect |
|---|---|---|
| USAF user (Demo AFB / KDMO) | `/field-conditions` direct URL | Redirect or 404 — module disabled by `appliesTo: ['faa_part139']` |
| USAF user | Sidebar | No "Field Conditions" entry in Operations section |
| Switch to KDRA (civilian) | Sidebar | "Field Conditions" appears under Operations (CloudSnow icon) |
| KDRA | `/more` page | Operations group includes "Field Conditions / TALPA" |
| KDRA `read_only` role | `/field-conditions` | Active cards visible (none yet), no "+ New Report" button, no "Issue Report" buttons on per-runway placeholders |
| KDRA `ops_supervisor` / `arff_chief` / `airfield_manager` | `/field-conditions` | Full CRUD: button visible + modal opens |

---

## RwyCC engine smoke

In DevTools console at `/field-conditions`:

```js
const { deriveRwycc, buildFiconNotamText } = await import('@/lib/calculations/rwycc')

// Per AC 30D Table 4-1
deriveRwycc({ contaminant: 'dry' })                                   // 6
deriveRwycc({ contaminant: 'frost' })                                 // 5
deriveRwycc({ contaminant: 'wet', depthInches: 0.125 })               // 5 (≤ 1/8")
deriveRwycc({ contaminant: 'wet', depthInches: 0.25 })                // 3 (> 1/8")
deriveRwycc({ contaminant: 'wet', depthInches: 0.75 })                // 2 (> 1/2")
deriveRwycc({ contaminant: 'dry_snow', depthInches: 0.5 })            // 4
deriveRwycc({ contaminant: 'dry_snow', depthInches: 2.0 })            // 3
deriveRwycc({ contaminant: 'wet_snow', depthInches: 1.5 })            // 2
deriveRwycc({ contaminant: 'compacted_snow', temperatureC: -20 })     // 4
deriveRwycc({ contaminant: 'compacted_snow', temperatureC: -10 })     // 3
deriveRwycc({ contaminant: 'compacted_snow', temperatureC: 0 })       // 2
deriveRwycc({ contaminant: 'ice' })                                   // 1
deriveRwycc({ contaminant: 'wet_ice' })                               // 0

// FICON text format per AC 30D §6
buildFiconNotamText({
  runwayDesignator: '13/31',
  thirds: [
    { third: 'touchdown', contaminant: 'wet', coveragePercent: 100, rwycc: 5 },
    { third: 'midpoint',  contaminant: 'wet', coveragePercent: 100, rwycc: 5 },
    { third: 'rollout',   contaminant: 'wet', coveragePercent: 100, rwycc: 5 },
  ],
  treatments: [],
})
// → "RWY 13/31 5/5/5 100/100/100 PCT WET"
```

Or run the test suite: `npx vitest run tests/rwycc.test.ts` — expect 34 cases pass.

---

## Flow walk on KDRA — Example 1 (single-third uniform snow)

1. Open `/field-conditions` on KDRA.
2. Each KDRA runway shows the placeholder card "No active report — conditions presumed dry (RwyCC 6/6/6)".
3. Click **+ New Report** in the header.
4. Modal opens. Verify:
   - Runway dropdown shows KDRA's runways
   - Temp (°F) input is empty (optional)
   - Valid Until defaults to "now + 8h" in your local timezone
   - Three "Per-Third Assessment" rows (Touchdown / Midpoint / Rollout)
   - All thirds default to contaminant=Dry, coverage=100%, derived RwyCC = 6
   - Treatments chip cluster shows 6 options (Plowed / Swept / Broomed / Sanded / Chemically Treated / De-Iced)
   - Live FICON preview at the bottom: `RWY 13/31 6/6/6 100/100/100 PCT DRY`
5. Set all three thirds to Dry Snow, depth 1.5 IN.
6. Verify each row shows derived = 3 (>1 in dry snow per Table 4-1).
7. Set Treatments → Plowed.
8. Set Temp = 28°F.
9. Live FICON preview should be: `RWY 13/31 3/3/3 100/100/100 PCT DRY SN 1.5IN TRTD W/PLOW`
10. Click **Issue Report**.
11. Toast: "Field Condition Report saved · FICON text copied to clipboard"
12. Modal closes. The RWY card now shows:
    - Cyan-bordered "current" tag, "Issued HH:MMZ by [OI]", "valid until HH:MMZ"
    - Three big RwyCC chips: 3 / 3 / 3 (amber)
    - Per-third detail rows
    - Treatments: Plowed · 28°F
    - FICON NOTAM body in a monospace box
    - Buttons: 📋 Copy FICON · 🔁 Issue Update · 🗑 Delete
13. Paste from clipboard → verify FICON text matches the displayed body.

---

## Flow walk on KDRA — Example 2 (mixed-condition supersede)

Continuing from Example 1:

1. Click **Issue Update** on the active card.
2. Modal opens pre-filled with the prior values.
3. Change Rollout → Wet Snow, depth 2.5 IN (warming temp scenario).
4. Verify Rollout's derived RwyCC drops to **2** (wet snow > 1 in).
5. Live FICON preview updates: `RWY 13/31 3/3/2 100/100/100 PCT DRY SN WET SN 2.5IN TRTD W/PLOW`
6. Save → "Field Condition Report saved" toast.
7. The original FCR row is back-filled with `superseded_by_id` pointing at the new row; only the new row appears in the active card.
8. Verify the supersede via SQL:
   ```sql
   SELECT id, generated_at, ficon_text, superseded_by_id
     FROM field_condition_reports
    WHERE base_id=(SELECT id FROM bases WHERE icao='KDRA')
    ORDER BY generated_at DESC LIMIT 2;
   -- newer row has superseded_by_id IS NULL
   -- older row has superseded_by_id = <newer row's id>
   ```

---

## Flow walk on KDRA — Example 3 (operator override)

1. Click **Issue Update** on the active card.
2. Set all three thirds to Wet Snow, depth 1.5 IN, with Chemically Treated added to treatments.
3. Verify Rollout's derived RwyCC = 2 (wet snow > 1 in).
4. In the Rollout row, change the **Override** dropdown to **3**.
5. Override Reason input appears below — type "Chemical treatment effective; pilot reports confirm braking".
6. The RwyCC chip in that row flips to 3 (still amber, since override applies); amber warning icon appears next to the dropdown.
7. Live FICON preview reflects rollout = 3.
8. Save.
9. Verify in SQL:
   ```sql
   SELECT third, rwycc, rwycc_derived, rwycc_manual_override, override_reason
     FROM field_condition_thirds
    WHERE report_id = (SELECT id FROM field_condition_reports
                       WHERE base_id=(SELECT id FROM bases WHERE icao='KDRA')
                         AND superseded_by_id IS NULL ORDER BY generated_at DESC LIMIT 1)
    ORDER BY sort_order;
   -- rollout row: rwycc=3, rwycc_derived=2, rwycc_manual_override=true, override_reason='Chemical treatment effective...'
   ```
10. Events Log at `/activity` shows: `"FCR ISSUED — RWY 13/31 3/3/3"` with details listing the override.

---

## History rendering

1. After issuing 2-3 FCRs in Examples 1-3, scroll to the **Past 30 Days** section below the active cards.
2. Click the chevron to expand.
3. Verify:
   - Reports grouped by Zulu date
   - Each row shows: Zulu time · RWY designator + RwyCC tuple (monospace) · full FICON text in faded monospace
   - The most recent (still active) FCR is **not** duplicated in history (history excludes the active set)
4. Switch installations / reload — history persists.

---

## Permission gating (KDRA users with different roles)

| Role | `/field-conditions` | Active card buttons | New Report modal |
|---|---|---|---|
| `read_only` (no `field_conditions:write`) | Page loads, cards render | Copy FICON visible; no Issue Update / Delete / Issue Report | Modal not accessible (no + New Report button) |
| `ops_supervisor`, `arff_chief`, `amops`, `airfield_manager`, `base_admin`, `sys_admin` | Full access | All buttons visible | Full CRUD |
| `accountable_executive` (read only) | Page loads | Copy FICON visible; no write actions | Modal not accessible |
| `sms_manager` (read only) | Page loads | Same as AE | Same as AE |

---

## Theme audit (manual visual)

1. Toggle **light mode** in Settings.
2. Walk `/field-conditions`:
   - RwyCC chips: green (4-6), amber (2-3), red (0-1) readable on both themes
   - FICON monospace box: dark text on inset background, readable
   - Treatment chips: active state cyan-on-cyan-tinted background; inactive state inset
   - Modal: form inputs readable, derived-RwyCC chip visible, override warning icon (amber) visible
3. Confirm: no muddy amber-on-amber, no invisible white-on-white.

---

## Mobile / PWA pass

1. Open `/field-conditions` on iPhone (Vercel preview) or Chrome mobile emulation.
2. Verify:
   - Runway cards stack vertically; per-third RwyCC chips wrap cleanly
   - "+ New Report" button accessible (top right) with safe-area inset
   - Modal: per-third row grid (`90/1fr/80/90/auto`) collapses; depth + coverage inputs remain tappable
   - Live FICON preview wraps without overflow

---

## Regression smoke

| Surface | Expected |
|---|---|
| `/scn` on Demo AFB (USAF) | Unchanged — SCN works as before. |
| `/aep/*` on KDRA | Unchanged — Phase 3b surfaces work. |
| `/obstructions` on KDRA | Unchanged — Phase 3c picker + legend work. |
| `/training/*` on KDRA | Unchanged — Phase 3a surfaces work. |
| `/sms/*` on KDRA | Unchanged. |
| Sidebar Operations section | Now includes "Field Conditions" between Personnel on Airfield and (USAF: nothing more; civilian: also nothing in this section after FCR). |
| Existing UFC obstruction tests | All 410 baseline tests still pass. |

---

## Failure triage

| Symptom | Likely cause | Fix / next step |
|---|---|---|
| "+ New Report" disabled / hidden | User lacks `field_conditions:write` | Check role + `select * from role_permissions where role=<role> and permission_key like 'field_conditions:%'` |
| Modal opens but Issue Report button doesn't save | Override reason missing on an overridden third | Check the toast message — names which third needs a reason; fill the reason field |
| FICON preview doesn't update when changing inputs | React state stale — caused by editing depth as a non-numeric string | Clear the field and re-enter a number |
| FCR saves but supersede doesn't fire | RLS update policy failure (rare) | Check console for 401/403; confirm user has `field_conditions:write` |
| Copy to clipboard fails silently | Browser blocking clipboard API in non-secure context | Toast still says "saved" but not "copied"; manually copy from the FICON box |
| Page 404 on KDRA | Module not in `bases.enabled_modules` OR `airport_type` ≠ `'faa_part139'` | `SELECT enabled_modules, airport_type FROM bases WHERE icao='KDRA'` — confirm civilian + module enabled |
| Per-runway cards don't render | `runways` array empty (KDRA hasn't been set up via wizard) | Walk Base Setup → Runways first |
| RwyCC engine returns unexpected value | Edge case in Table 4-1 mapping | Cross-reference `tests/rwycc.test.ts` cases against AC 30D Appendix B; file an issue if FAA AC reference disagrees |

---

## Verified-by sign-off

| Verifier | Date | Notes |
|---|---|---|
| _(unset)_ | — | First-pass verification pending |
