# Phase 3c — Part 77 Obstruction Surface UI Verification

**Phase:** 3c — FAA Part 77 obstruction surface UI (14 CFR §77.19)
**Commits:** `1abe42d` (B — engine + schema) · _Cluster C commit_ (picker + legend)
**Build state at last verify:** `tsc` ✓ · `build` ✓ · `vitest` ✓ 410 / 410

> Same scaffold as `PHASE_3B_VERIFICATION.md` for super-doc composition:
> pre-flight · mode-gating · per-route flow · cross-cutting · regression
> · failure triage · verified-by sign-off.

---

## Pre-flight

Run from `C:/Users/cspro/airfield-app` with `npm run dev` at http://localhost:3000.

1. **Verify branch + clean tree.** `git status` → "On branch main, nothing to commit." Pre-existing untracked files from prior phases expected.
2. **Confirm migration applied.**
   ```sql
   SELECT column_name FROM information_schema.columns
    WHERE table_name = 'base_runways'
      AND column_name LIKE 'faa_%';
   ```
   Expect 2 rows: `faa_approach_category`, `faa_approach_type`.
3. **Confirm engine refactor.** `Object.keys(getPart77Surfaces('non_utility_precision')).sort()` should match `['approach','conical','horizontal','primary','transitional']`.
4. **Start dev server.** `npm run dev` → open http://localhost:3000

---

## Mode-gating smoke (do this first, before any data entry)

| As | Action | Expect |
|---|---|---|
| USAF user (Demo AFB / KDMO) | `/obstructions` evaluation form | Surface Set picker visible; **UFC 3-260-01** active by default |
| USAF user | `/base-config/setup` → Runways → Edit runway | **No** FAA Approach Type / Category dropdowns (civilian-only gate) |
| Switch to KDRA (civilian) | `/obstructions` form | Surface Set picker now defaults to **FAA Part 77** |
| KDRA | `/base-config/setup` → Runways → Edit runway | FAA Approach Type + FAA Approach Category dropdowns visible between basic-info row and End 1 fields |

---

## Wizard step — Set per-runway approach data on KDRA

1. Navigate `/base-config/setup` → step 3 (Runways).
2. Click **Edit** on the existing runway (e.g. 13/31).
3. Confirm the two new dropdowns render between Surface/Heading and End 1 designator:
   - **FAA Approach Type**: dropdown with 6 options + "— Not set —"
   - **FAA Approach Category**: A–E with landing-speed annotations
4. Pick **Non-Utility / Non-Precision (≥ ¾ mi visibility)** + Category **C**. Save.
5. Reload the page → confirm both fields persisted.
6. **Edit again** and pick **Non-Utility / Precision Instrument** + Category **D**. Save.

---

## /obstructions — surface picker + Part 77 evaluation

1. On KDRA (Part 77 default), open `/obstructions`. Pick a point on the map (any location near the runway). Enter a height (e.g. `110` ft).
2. **Verify picker UI**: two side-by-side toggle cards labeled "UFC 3-260-01" and "FAA Part 77"; FAA Part 77 is active (cyan border).
3. **Verify Part 77 helper line** below the picker: "Per-runway approach types drive Part 77 dimensions..." plus a warning chip if any runway lacks `faa_approach_type` (none should warn after the wizard step above).
4. **Click "Evaluate Obstruction"**. Expect:
   - 5 surfaces in the Surface Analysis card (primary, approach, transitional, horizontal, conical)
   - **No** UFC-only surfaces (no clear_zone, no graded_area, no APZ I/II, no outer_horizontal)
5. **Switch picker to UFC 3-260-01**, re-evaluate the same point. Expect:
   - 10 surfaces including outer_horizontal, clear_zone, graded_area, APZ I, APZ II
   - The runway evaluation now uses UFC dimensions (different penetration numbers expected)
6. **What-if back to Part 77, switch the runway to Precision** in the wizard, return to `/obstructions`, re-evaluate the same point. Expect different violation profile (precision surfaces are larger — primary 1,000 ft wide, approach 50:1 / 50,000 ft).

---

## /obstructions/[id] — surface set legend

1. Save an evaluation from the form (any point with violations works).
2. Open the detail page from `/obstructions/history` or via the redirect.
3. Below the **Controlling Surface** card, expect a new **Surface Set Reference — FAA Part 77** card (or UFC depending on KDRA's `obstruction_surface_set`).
4. **Click the chevron** to expand. Expect:
   - Subtitle line: "14 CFR §77.19 (default approach type — per-runway types in Base Setup)" for Part 77, or the UFC equivalent
   - One row per surface with color swatch + name + description + reg reference (right-aligned)
   - Part 77 mode: 5 rows. UFC mode: 10 rows.
5. **Collapse + reload**: the card defaults to collapsed each time (no localStorage state — per Phase 3c scope).

---

## Engine spec validation (key thresholds)

Run these console assertions in browser DevTools at `/obstructions`:

```js
const { getPart77Surfaces } = await import('@/lib/calculations/obstructions')
// Primary widths per §77.19(a)
getPart77Surfaces('utility_visual').primary.criteria.halfWidth          // 125 (250 ft total)
getPart77Surfaces('utility_non_precision').primary.criteria.halfWidth   // 250 (500 ft total)
getPart77Surfaces('non_utility_visual').primary.criteria.halfWidth      // 250
getPart77Surfaces('non_utility_non_precision_low').primary.criteria.halfWidth   // 250
getPart77Surfaces('non_utility_precision').primary.criteria.halfWidth   // 500 (1,000 ft total)

// Approach slopes per §77.19(c)
getPart77Surfaces('utility_visual').approach.criteria.slope             // 20
getPart77Surfaces('non_utility_non_precision_3_4').approach.criteria.slope  // 34
getPart77Surfaces('non_utility_precision').approach.criteria.slope      // 50 (1st segment)
getPart77Surfaces('non_utility_precision').approach.criteria.secondSegmentSlope  // 40

// Horizontal radii per §77.19(b)
getPart77Surfaces('utility_visual').horizontal.criteria.radius          // 5000
getPart77Surfaces('non_utility_visual').horizontal.criteria.radius      // 10000
```

Or run the test suite: `npx vitest run tests/part77-surfaces.test.ts tests/obstruction-evaluation.test.ts` — expect all 44 cases pass.

---

## Permission gating

The obstruction module uses the existing `obstructions:view` / `obstructions:write` permissions (unchanged in Phase 3c). The new surface picker is visible to anyone who can see the page; the runway-editor dropdowns require `base_setup:write` (same as existing runway editing).

| Role | `/obstructions` picker | `/aep/agencies` runway editor dropdowns |
|---|---|---|
| `read_only` | Picker visible, evaluation runs; no save | Wizard not accessible |
| Civilian admin / AEP coord | Picker switchable, save works | Dropdowns visible + editable |
| USAF admin on KDMO | Picker switchable (warning chip if Part 77 selected on non-civilian base) | **No FAA dropdowns** (mode-gated) |

---

## Theme audit (manual visual)

1. Toggle **light mode** in Settings.
2. Visit `/obstructions` → confirm picker buttons readable in both states (active = cyan-tinted background + cyan text; inactive = inset).
3. Visit `/obstructions/[id]` → confirm legend swatches visible against the inset row background, ref text not muddy.
4. Re-check the Phase 2 SMS sidebar icon fix on KDRA — `/sms` and `/training` and `/aep` section icons should be the correct lucide icons, not the `Home` fallback (Cluster B incidental fix from Phase 3b).

---

## Mobile / PWA pass

1. Open `/obstructions` on iPhone (Vercel preview) or Chrome mobile emulation.
2. Verify:
   - Surface Set picker buttons stack vertically below ~480 px wide
   - Helper line and warning chips wrap cleanly
   - Form card layout doesn't overflow
3. Detail page legend: collapsible card works; rows stack readably on narrow viewport.

---

## Regression smoke

| Surface | Expected |
|---|---|
| `/obstructions` on Demo AFB (USAF) | Picker defaults to UFC; evaluation produces identical results to pre-Phase 3c (10 UFC surfaces, same numbers). |
| Existing saved obstructions on Demo AFB | Detail page renders correctly; legend shows UFC reference set. |
| `/obstructions/history` | Unchanged — no Phase 3c changes to the history page. |
| Engine UFC test cases (37 baseline) | All pass — engine extension is additive, not behavioral on UFC path. |

---

## Failure triage

| Symptom | Likely cause | Fix / next step |
|---|---|---|
| FAA dropdowns don't appear in runway editor | KDRA `airport_type` ≠ `'faa_part139'` | `SELECT airport_type FROM bases WHERE icao='KDRA';` — confirm civilian |
| Picker defaults to UFC on KDRA | `bases.obstruction_surface_set` overrides the mode default | Check `SELECT obstruction_surface_set FROM bases WHERE icao='KDRA';` — should be `'faa_part77'` for default Part 77 behavior |
| Evaluation crashes after switching to Part 77 | Page didn't re-render the form state; check console for stale evaluation | Hard-reload (Ctrl+Shift+R) |
| Legend shows 10 UFC surfaces on KDRA when Part 77 is the active set | `getSurfaceSet(currentInstallation)` returning UFC due to stale context | Switch installations in the header picker, then back — refreshes the context |
| Per-runway approach type warning doesn't clear after wizard save | Installation context cache not refreshed | Reload `/obstructions` (or trigger `refreshCurrentInstallation()` if available) |
| Precision approach evaluation seems off at long distances (>10,000 ft) | The 2-segment slope encoding (50:1 + 40:1) — verify `secondSegmentSlope` is being applied in `evaluateObstructionPart77` | Read the test case `precision approach extends 50,000 ft` in `tests/obstruction-evaluation.test.ts` to confirm expected math |

---

## Verified-by sign-off

| Verifier | Date | Notes |
|---|---|---|
| _(unset)_ | — | First-pass verification pending |
