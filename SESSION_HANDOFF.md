# Session Handoff

**Date:** 2026-04-17 → 2026-04-21 (multi-day run)
**Branch:** `mobile-tweaks` (19 commits ahead of `origin/main`, all pushed to `origin/mobile-tweaks`)
**Build:** ✅ Clean — `npm run build` compiles; `npx tsc --noEmit` exit 0; `npx vitest run` 60 pass / 2 skipped

---

## What Landed This Session

Big session. Three brand-new modules, a foundational per-base feature-flag system, the dashboard reimagined as a quick-action launcher, a login-time release-notes modal, and a slate of smaller UX refinements. 19 commits, 4 new Supabase migrations, and a modular-onboarding plan file on `~/.claude/plans/`.

### Bug fixes first

1. **Discrepancy status change attribution in Events Log.**
   - `lib/supabase/activity-queries.ts` was joining profiles via `discrepancies.reported_by` for *every* event including updates — so completing a CES-work-order logged under the original reporter's OI, not the person who closed it.
   - `updateDiscrepancy` now writes a `status_updates` audit row whenever `current_status` changes (previously only top-level `status` transitions wrote one).
   - Events Log attribution pulls from the latest `status_updates` row within 5 min of `discrepancies.updated_at`, falling back to `reported_by` only for creation events or when no fresh audit row exists.

2. **Volk Field (KVOK) missing from signup dropdown.**
   - DB seeded via `seed-kvok-volk-field.sql` but the hardcoded `BASE_DIRECTORY` in `lib/base-directory.ts` never got the entry. Added it between Vandenberg and Warfield. No DB risk — `/api/installations` is find-or-create.
   - Also noticed **KBCV Chièvres** has the same issue (seeded but not in `BASE_DIRECTORY`). Flagged, not yet added.

3. **Runway import "re-enables all modules" regression.**
   - `installation-context.tsx` fallback-to-ALL fired when `enabled_modules` was an empty array (not just null/undefined). A user who cleared their selection would see the value flip back to everything on the next context read.
   - Fixed to trust any explicit array. Also bubble the Supabase error up so a missing-column situation surfaces as a toast instead of silently rolling back.

### Feature #1 — Modular Onboarding (v2.32 headline)

Five-phase build per the `~/.claude/plans/i-want-to-look-cozy-whisper.md` plan. Admins can now pick which Glidepath modules their base uses; downstream navigation, wizard steps, and dashboard tiles all filter automatically.

- **Migration 2026042000** — `bases.enabled_modules TEXT[]` (default all 16 toggleables) + `bases.setup_progress JSONB`. Backfill restores full enablement for existing rows.
- **`lib/modules-config.ts`** — single source of truth for module key, category, description, hrefs, setupSteps, defaults. Helpers: `isModuleEnabled`, `isWizardStepEnabled`, `isStepDone`, `isModuleSetupComplete`, `TYPICAL_BASE_PRESET`, category-grouped views.
- **Module Selector page** — new `/settings/base-setup/modules` with grouped cards (Core Ops / Emergency / Compliance / Optional), Recommended / Enable Everything / Clear All presets. Saves to `bases.enabled_modules`.
- **Wizard filtering** — `WIZARD_STEPS` filter through `isWizardStepEnabled`. Core steps (runways, taxiways, areas, ARFF, facilities) are always shown. Pill navigation + Next / Skip / Back all account for the filtered step list.
- **Setup progress** — Next/Skip writes `complete`/`skipped` to `setup_progress` with completed_by attribution. Green ticks on step pills. Dashboard banner "Finish setting up X, Y, Z" nudges admins when enabled modules have incomplete steps.
- **Nav filtering** — sidebar, bottom nav, more page, and dashboard quick actions all respect `enabled_modules` (stacked on top of the CES role filter, not a replacement).
- **Public feedback short-circuit** — `fetchFeedbackConfig` reads `enabled_modules` and returns null if `feedback` is off, so public QR codes show "form closed" instead of 200ing into a live form.

### Feature #2 — Secondary Crash Net (SCN) daily check log

- **Migration 2026042001** — `scn_agencies`, `scn_checks`, `scn_check_results` with full RLS. `agency_name` is denormalized on results so historical checks survive agency renames/deletes.
- **`/scn` page** — Daily + Monthly check cards, 30-day history, month picker for PDF export. Each agency row is a 3-button grid (Loud & Clear / No Response / Out of Service) with 60px-min tap targets; default is Loud & Clear so only exceptions get touched. OOS selection opens a required-notes dialog.
- **Daily check modal** ships with the controller's **Opening** and **Closing call scripts** in cyan callouts surrounding the agency grid ("All agencies stand-by (3X)…" / "All agencies are loud and clear… please secure the net."). Monthly check omits them.
- **Events Log integration** — each completed check writes a summary row to `activity_log` with `entity_type` `scn` or `scn_backup`: "DAILY SCN CHECK COMPLETE — ALL LOUD & CLEAR EXCEPT FIRE DEPT (NO RESPONSE), ATC (OUT OF SERVICE: radio fault)".
- **Monthly PDF** (`lib/scn-pdf.ts`) — agency-by-day matrix with color-coded L/N/X cells, Monthly SCN row, OOS footnote table, No Response roster, Monthly SCN completion log.
- **Base Setup step 11** added "SCN Agencies" (SimpleListTab wrapper). Wildlife / Lighting renumbered.
- **Rename** late in session: Primary → **Daily SCN Check**, Backup → **Monthly SCN Check**. DB `check_type` values stay `primary`/`backup` so history is stable; only UI/PDF/Events Log labels flipped.

### Feature #3 — Close for the Day overlay

- **Migration 2026042002** — `airfield_status.afm_closed` + `afm_closed_message`, `bases.default_closed_message`.
- **Dashboard tile** "🌙 Close Airfield" / "🌙 Reopen Airfield" with its own message dialog, Set-as-Default button, and reopen confirmation.
- **Key behavior** — activating Closed clears runway_statuses, RSC, RCR (touchdown/midpoint/rollout/condition + updated_at), and BWC in a single `airfield_status` patch so the next opening check starts from a clean slate. Deactivating just clears the flag; the next opening check sets live values.
- **Status-page banner** in slate color (distinct from the red OOO banner) with minimize + reopen affordances. Both states can coexist.
- **CP initials dropped** from both the OOO and Closed reopen dialogs. Events Log text: "AMOPS Closed. Command Post notified." / "AMOPS Open. Command Post notified." (matching user-stated AMOPS terminology).

### Dashboard as a quick-action launcher

- Removed the inline recent-activity feed (and its loader, edit modal, and the `Review Shift` / `Daily Reviews Pending` bars, which moved to `/activity`).
- Tiles: **Airfield Checks**, **New Discrepancy**, **Personnel on Airfield**, **Shift Checklist**, **QRCs**, **SCN**, **PPR Log**, **BASH**, **Out of Office**, **Close Airfield**. All gated by module enablement.
- Sizing: compact 68px-min tiles with 22px emoji + bold label, auto-fill 140px grid. Half the previous size after user feedback.

### Nav / More reorganization

- New **Admin** group (shield icon) between Reference and Settings, containing: Activity Log (`/recent-activity`), Daily Reviews, Waivers, Reports & Analytics, Training, PDF Library, User Management.
- Events Log (`/activity`) stayed in **Operations** per user clarification — it's the operator-facing log.
- Activity Log (`/recent-activity`) surfaces in Admin for admin-level app-wide review.
- Settings group narrowed to just `/settings`.
- SCN dropped from sidebar — dashboard tile is the entry point; More menu still lists it.

### Review Shift bar moved to /activity

Both the "Review Shift" and "N Daily Reviews Pending" bars plus the DailyReviewSignModal migrated off the dashboard onto the Events Log page. Daily Reviews Pending bar was then deleted per user (too noisy for every-day AMOPS personnel — they only need the Review Shift bar).

### Events Log mobile polish

- Table drops the dedicated Action column when viewport ≤ 640px. Action label (color-coded, with link arrow and AMENDED badge) inlines before the Details text instead.
- `minWidth` relaxes to 0 on mobile so columns fit the viewport.
- `colSpan` on date header rows shrinks from 5 to 4.

### Training page refresh

- New global **search bar** that matches across Quick Start steps, Module cards, and Base Setup steps with in-result highlighting and "jump to tab" links.
- New Module cards: **Modules** (feature selector), **Daily Reviews**, **PPR**, **Feedback**, **Secondary Crash Net**.
- New Base Setup step 11 in the guide: **SCN Agencies**.
- Content fixes: QRC step-type count 6 → 8, Visual NAVAIDs feature-type count 22 → 23 and Google Maps (not Mapbox), Settings module now describes the Modules selector.
- Base Setup tab opens with a "Before Step 1 — Pick Your Modules" callout.

### Feature #4 — What's New modal on login (release notes)

- **Migration 2026042100** — `profiles.last_seen_release_version TEXT`.
- **`lib/release-notes.ts`** — structured `RELEASE_NOTES` array with v2.32 and v2.31 seeded. Helper `unseenReleaseNotes(lastSeen)` + `compareVersions()` do semver-ish comparison.
- **`components/whats-new-modal.tsx`** — scrollable grouped card per release with "Got it" CTA and a link out to the GitHub CHANGELOG. Dismissing writes the latest version to the profile so the modal only pops once per user per release.
- **`components/whats-new-gate.tsx`** — mounted in `(app)/layout.tsx` inside DashboardProvider. Reads profile on mount; fails silently in demo mode or when the migration hasn't been applied.
- Future releases: bump `package.json` + prepend a new `RELEASE_NOTES` entry; the modal handles the rest.

### Smaller changes

- `activity_log` entity labels for `scn` → **SCN**, `scn_backup` → **Monthly SCN** (previously lowercase).
- Dashboard tile labels lengthened for clarity after the scale-down pass.
- Events Log + More page mirror every nav change.

---

## Migrations to Apply (unfired)

Stage against Demo AFB first, smoke-test, then promote.

1. **`2026042000_enabled_modules.sql`** — `bases.enabled_modules` + `bases.setup_progress` + backfill. Safe. Idempotent (`cardinality()` guard).
2. **`2026042001_scn_daily_check.sql`** — new SCN tables + RLS. Safe.
3. **`2026042002_afm_closed.sql`** — `airfield_status.afm_closed` / `afm_closed_message` + `bases.default_closed_message`. Safe.
4. **`2026042100_whats_new_tracking.sql`** — `profiles.last_seen_release_version`. Safe.

All four are pure additive schema changes; no data transforms. The WhatsNewGate, Modules page, SCN page, and Closed button all handle "column not applied yet" gracefully.

---

## Known Issues & Tech Debt

| Item | Location | Severity | Change from last handoff |
|---|---|---|---|
| **4 migrations pending apply** | Listed above | Medium | **New — ready to stage** |
| **`.env.local` modified** | Root | Trivial | Still dirty locally; skipping commits as usual |
| **KBCV Chièvres missing from BASE_DIRECTORY** | `lib/base-directory.ts` | Low | Flagged but not fixed — parallel to the KVOK bug |
| **Dashboard `activity` state unused** | `app/(app)/dashboard/page.tsx` | Trivial | `loadActivity` still runs as a no-op side effect; cleaning it would cascade through many save handlers. Leave for later |
| **Recent Activity page (`/recent-activity`)** | Surfaces in Admin now but wasn't rebuilt this session | Low | Should do a UI review next session to confirm it fits "Activity Log" admin-audit framing |
| **`auth_leaked_password_protection`** | Supabase dashboard | Low | Unchanged — Pro plan only |
| **`any` casts** | Growing as new tables land; still ~124 project-wide | Low | ~3 new in dashboard-context + SCN code (guarded with explicit type narrowing). Budget for a sweep after types regen |
| **Dashboard pending-setup banner double-surface** | New banner + finish-setup link in settings | Trivial | Both point to the same place; fine |
| **Public feedback "form closed" copy hardcoded** | `app/feedback/[baseId]/page.tsx` | Trivial | Shows generic closed state when `feedback` module is off |
| **SCN backup check scripts** | Only daily has scripts | Low | User asked for daily only — if monthly needs a different net call, add later |
| **Largest source files** | `base-setup/page.tsx` 4,748 LOC (+50 from SCN agencies tab), `parking/page.tsx` 4,334, `infrastructure/page.tsx` 4,150, new `dashboard/page.tsx` ~1,300 | Medium | Unchanged priority |
| **Automated test coverage** | 8 files / 60 pass, 2 skipped | Medium | Same as last handoff — **nothing new for SCN, Modular Onboarding, What's New, Close-for-day.** Top risk area next session |
| **Role-restricted modules force-enable** | Not implemented in MODULES registry | Low | Plan has it; SCN/CES didn't need it yet |

---

## Next Session Tasks (Prioritized)

### P0 — Release gate
1. **Apply the 4 new migrations** against Demo AFB, walk through: module selector, wizard filtering, SCN check flow (daily + monthly), Close for Day, What's New modal first-appearance. Then promote to prod Supabase.
2. **Merge `mobile-tweaks` → `main`** and cut **v2.32.0**. Version string lives in `package.json`, `app/login/page.tsx`, `app/(app)/settings/page.tsx`, `app/(app)/training/page.tsx`, `CHANGELOG.md`, and `README.md`. The `RELEASE_NOTES[0]` entry in `lib/release-notes.ts` is already authored.
3. **Smoke-test after release** — confirm What's New pops for the first existing user who logs in post-merge, confirm their `last_seen_release_version` gets written.

### P1 — Quality
4. **Test coverage for the new modules.** Priority order:
   - `lib/modules-config.ts` — `isModuleEnabled`, `isWizardStepEnabled`, `isModuleSetupComplete`, `compareVersions`/`isNewerVersion` (pure functions, fast wins).
   - `lib/supabase/scn.ts` — `summarizeCheck` (exceptions joined correctly, all-clear vs mixed, notes passthrough).
   - `lib/release-notes.ts` — `unseenReleaseNotes` edge cases (null, equal, leading-zero versions).
5. **Regenerate Supabase types** — pick up `scn_agencies`, `scn_checks`, `scn_check_results` + the two new `bases` columns + `airfield_status.afm_closed*`. Will remove most of the `as any` introduced in this session.
6. **Review `/recent-activity`** to make sure it earns its Admin slot (admin-level app-wide activity review). May need date range / entity-type filters it doesn't currently have.

### P2 — Polish
7. **Add KBCV Chièvres to BASE_DIRECTORY** (trivial mirror of the KVOK fix).
8. **Role-restricted force-enable** for CES and NAMO modules — if the base has users with those roles, prevent admins from disabling the modules that serve them. Plan section already covers the UX; unblocks for bases hitting edge cases.
9. **Dashboard `activity` state cleanup** — remove the orphaned `loadActivity`/state now that the inline feed is gone. Ripples through ~15 save handlers but they're one-line changes.

### P3 — Future
- Platform One Party Bus onboarding (~6–8 weeks)
- CAC/PIV authentication (blocked on P1)
- Component extraction for 4K+ LOC pages
- PDF boilerplate shared utility

---

## Build Snapshot

```
✓ Compiled successfully
  TypeScript clean (`npx tsc --noEmit` exit 0)
  Tests: 60 pass / 2 skipped (RLS env-gated)
  All routes generate cleanly (new: /scn, /settings/base-setup/modules)

  Notable First Load JS sizes:
    /wildlife                788 kB  (unchanged — heatmap)
    /parking                 398 kB  (unchanged)
    /reports/aging           331 kB
    /obstructions/[id]       326 kB
    /reports/daily           322 kB
    /library                 295 kB
    /reports/lighting        317 kB
    /inspections             229 kB  (unchanged)
    /discrepancies           223 kB  (unchanged)
    /settings/base-setup     231 kB  (+ ~8 kB from SCN agencies tab)
    /dashboard               217 kB  (−5 kB from activity feed removal)
    /regulations             182 kB
    /scn                     179 kB  NEW
    /settings/base-setup/modules 173 kB  NEW

  Middleware                 74.6 kB  (unchanged)
```

---

## Files Touched This Session

### Created
```
A  lib/modules-config.ts                                       # source of truth for module definitions
A  lib/release-notes.ts                                        # What's New data + compareVersions
A  lib/scn-pdf.ts                                              # monthly SCN PDF
A  lib/supabase/scn.ts                                         # SCN check CRUD + summarizeCheck
A  lib/supabase/scn-agencies.ts                                # per-base agency list CRUD
A  app/(app)/scn/page.tsx                                      # daily/monthly check page + modal + scripts
A  app/(app)/settings/base-setup/modules/page.tsx              # module selector
A  components/whats-new-modal.tsx                              # release-notes modal UI
A  components/whats-new-gate.tsx                               # mount + profile read + latest-seen write
A  supabase/migrations/2026042000_enabled_modules.sql
A  supabase/migrations/2026042001_scn_daily_check.sql
A  supabase/migrations/2026042002_afm_closed.sql
A  supabase/migrations/2026042100_whats_new_tracking.sql
```

### Modified
```
M  app/(app)/activity/page.tsx                                 # mobile column collapse, review shift bar, SCN casing
M  app/(app)/dashboard/page.tsx                                # quick-action tiles, closed button, feed removal
M  app/(app)/layout.tsx                                        # WhatsNewGate mount
M  app/(app)/more/page.tsx                                     # nav reorg (Admin group), SCN tile, module filtering
M  app/(app)/page.tsx                                          # closed banner, OOO dialog simplification
M  app/(app)/settings/base-setup/page.tsx                      # wizard filtering + SCN agencies step 11
M  app/(app)/settings/page.tsx                                 # "Manage Modules" card
M  app/(app)/training/page.tsx                                 # search bar, 5 new module cards, step 11 SCN
M  app/api/installations/route.ts                              # seed TYPICAL_BASE_PRESET on base create
M  app/feedback/[baseId]/page.tsx                              # handle null from disabled-module short-circuit
M  components/layout/bottom-nav.tsx                            # module filtering
M  components/layout/sidebar-nav.tsx                           # module filtering + new icons + Admin group
M  lib/base-directory.ts                                       # + Volk Field KVOK
M  lib/dashboard-context.tsx                                   # afmClosed + setAfmClosed (clears runway/RSC/BWC)
M  lib/installation-context.tsx                                # enabledModules, setupProgress, defaultClosedMessage
M  lib/sidebar-config.ts                                       # Admin group, Activity Log entry, SCN removed
M  lib/supabase/activity-queries.ts                            # discrepancy attribution via status_updates
M  lib/supabase/discrepancies.ts                               # audit row on current_status change
M  lib/supabase/feedback.ts                                    # enabled_modules short-circuit
M  lib/supabase/types.ts                                       # bases new cols, airfield_status closed cols, profiles cols
```

Everything committed on `mobile-tweaks` and pushed to `origin/mobile-tweaks`. 19 commits ahead of main.
