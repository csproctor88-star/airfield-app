# Session Handoff

**Date:** 2026-04-21 (release day, multi-pass)
**Branch:** `main` — tagged `v2.32.0` and pushed. `mobile-tweaks` deleted local + remote.
**Build:** ✅ Clean — `npm run build` compiles; `npx tsc --noEmit` exit 0; `npx vitest run` 101 pass / 2 skipped

---

## Release State

**v2.32.0 shipped to prod on 2026-04-21.**

- All 4 migrations applied (`2026042000_enabled_modules`, `2026042001_scn_daily_check`, `2026042002_afm_closed`, `2026042100_whats_new_tracking`).
- Merge was `--no-ff`, tag `v2.32.0` pushed, `mobile-tweaks` branch deleted.
- Smoke tests passed post-deploy.

Post-release quality pass (`7f1864d`) landed test coverage + Supabase types regen.
Post-release carryover cleanup (this commit) landed the remaining P1/P2 items.

### What shipped in v2.32.0

See `CHANGELOG.md` for the authoritative list. Headlines:

1. **Modular Onboarding** — per-base `enabled_modules` drives sidebar, bottom nav, More menu, dashboard tiles, and Base Setup wizard visibility.
2. **Secondary Crash Net** — new `/scn` route; Daily + Monthly check log with three-state agency grid, call scripts, 30-day history, monthly PDF matrix.
3. **Close for the Day overlay** — dashboard tile + status banner. Clears runway statuses, RSC/RCR, BWC atomically.
4. **What's New modal** — pops once per release on sign-in.
5. **Dashboard as quick-action launcher** — 10 compact tiles.
6. **Nav reorg** — new Admin group. Events Log stays in Operations.
7. **Events Log mobile polish** — Action column collapses ≤ 640px.
8. **Training page** — global search bar; new module cards.
9. **Discrepancy attribution fix**.
10. **Volk Field (KVOK)** added to signup dropdown.

### Post-release quality passes

- **Test coverage (+41 tests)** — `modules-config`, `release-notes`, `scn.summarizeCheck`. Now 101 pass / 2 skipped.
- **Supabase types regenerated** — `scn_*` tables, `afm_closed*`, `enabled_modules`, `setup_progress`, `default_closed_message`, `last_seen_release_version`. Custom tail preserved.
- **3 `as any` casts dropped** — `dashboard-context` OOO + closed patch, `scn.ts` db() helper. `AirfieldStatus` type + `updateAirfieldStatus` pick extended for the new cols.
- **KBCV Chièvres** added to `BASE_DIRECTORY` (ICAO **EBCV**).
- **`/recent-activity` rebuilt** as admin audit log: period presets (Today/7d/30d/90d/Custom), entity/action/user/details filters, CSV export, 1,000-entry window with reached-limit warning. Naming convention solidified:
  - **`/activity`** → Events Log (operator-facing, curated manual entries + key events).
  - **`/recent-activity`** → Activity Log (admin audit; every recorded action).
- **Dashboard cleanup** — removed ~568 LOC of orphaned activity-feed state (manualText, handleEdit, handleDelete, loadActivity, userPopover, edit modal, template pickers, ActivityEntry type, formatAction/getActionColor/getEntityLink/inferActionFromText helpers, dead JSX blocks). Dashboard first-load JS: 217 → 206 kB (−11 kB).
- **Role-restricted module lock** — `/settings/base-setup/modules` now fetches distinct `profiles.role` for the base and locks modules whose `roleRestrictions` overlap with active users. CES is the live case (disabling it with CES users on the base is blocked). Future modules can opt in via `ModuleDef.roleRestrictions`.

---

## Known Issues & Tech Debt

| Item | Location | Severity | Notes |
|---|---|---|---|
| **`.env.local` modified** | Root | Trivial | Still dirty locally; skipping commits as usual |
| **`auth_leaked_password_protection`** | Supabase dashboard | Low | Pro plan only — can't toggle |
| **`any` casts** | ~121 project-wide (down from ~124) | Low | Ongoing sweep; next batch after another types regen |
| **Public feedback "form closed" copy hardcoded** | `app/feedback/[baseId]/page.tsx` | Trivial | Generic closed state when `feedback` module is off |
| **SCN backup check scripts** | Only Daily has scripts | Low | Add Monthly script if net call differs |
| **Largest source files** | `base-setup/page.tsx` 4,748 LOC, `parking/page.tsx` 4,334, `infrastructure/page.tsx` 4,150, `dashboard/page.tsx` 1,499 (↓ from ~2,067) | Medium | Component extraction is still the lever |
| **Automated test coverage** | 101 pass, 2 skipped across 12 files / ~249 source files | Medium | Coverage is thin; add to pure-logic modules as they land |
| **NAMO module role lock** | `MODULES` registry | Low | No NAMO-dedicated module yet — plumbing ready via `roleRestrictions` when one lands |

---

## Next Session Tasks (Prioritized)

### P1 — No items queued
All prior P1 items cleared in this session's quality + carryover passes.

### P2 — Polish (remaining small items)
1. **Tighten public feedback "form closed" copy** — swap the generic message for a base-named version when the `feedback` module is off.
2. **Add Monthly SCN call script** — if the net call differs from the Daily script.
3. **Another `as any` sweep** — target modules that missed the last pass (e.g. activity-queries `qrc_executions` / `wildlife_*` casts).

### P3 — Future (multi-session)
- **Platform One Party Bus onboarding** (~6–8 weeks) — scaffold at `C:/Users/cspro/Downloads/glidepath/glidepath-local-dev/`; plan in `.claude/plans/`
- **CAC/PIV authentication** — blocked on P1 platform
- **Component extraction for 4K+ LOC pages** (`base-setup`, `parking`, `infrastructure`)
- **Shared PDF boilerplate utility** (`lib/pdf-utils.ts` — consolidate 16 generators)
- **METAR weather API integration** (aviationweather.gov)
- **Outage analytics** (frequency/duration tracking for lighting systems)
- **Training Management Module** (DAF training records)
- **Part 139 civilian airport template support**
- **BowMonk Conversion Tool** (feature parity with legacy Grotefend app)

---

## Build Snapshot

```
✓ Compiled successfully
  TypeScript clean (`npx tsc --noEmit` exit 0)
  Tests: 101 pass / 2 skipped (RLS env-gated)
  All routes generate cleanly

  Notable First Load JS sizes:
    /wildlife                788 kB  (unchanged — heatmap)
    /parking                 398 kB
    /reports/aging           331 kB
    /obstructions/[id]       326 kB
    /reports/daily           322 kB
    /reports/lighting        317 kB
    /library                 295 kB
    /inspections             229 kB
    /discrepancies           223 kB
    /settings/base-setup     231 kB
    /dashboard               206 kB  (−11 kB from cleanup)
    /regulations             182 kB
    /scn                     179 kB
    /settings/base-setup/modules 175 kB
    /recent-activity         160 kB  (admin audit view)

  Middleware                 74.6 kB
```

---

## Recent Releases

| Version | Date | Headline |
|---|---|---|
| **v2.32.0** | 2026-04-21 | Modular Onboarding, SCN, Close-for-Day, What's New modal |
| v2.31.0 | 2026-04-07 | Full Google Maps migration, Custom Status Boards, PPR Log |
| v2.30.0 | 2026-04-14 | Daily Reviews + shift sign-off, ARFF status log, Vitest scaffold |
| v2.29.0 | 2026-04-02 | Training system, 12-step base setup wizard, dark mode readability |
| v2.28.0 | 2026-03-31 | Dashboard UI revamp, realtime silent tracking, competitive analysis |

See `CHANGELOG.md` for full history.
