# Session Handoff

**Date:** 2026-04-22
**Branch:** `main`
**Build:** ✅ Clean — `npx tsc --noEmit` exit 0; `npx vitest run` 101 pass / 2 skipped

---

## State

Permission-matrix auth rollout complete. Every feature gate — DB RLS, React hook, server route handler — now resolves through `user_has_permission(uid, key)` + the per-role preset map.

### What's live

- **9 role presets** seeded in `role_permissions`: sys_admin, airfield_manager, namo, base_admin, amops, ces, safety, atc, read_only — plus 3 new ones: **airfield_status** (kiosk, per-base view-only login), **ppr** (PPR writer + airfield status view), **majcom_rfm** (multi-base read-only via `base_members`).
- **77 permission keys** in the `permissions` catalogue.
- **3 SECURITY DEFINER RPCs** for narrow writes that RLS can't express column-by-column: `ces_update_discrepancy`, `safety_update_rsc_bwc`, `get_public_feedback_config` (+ `base_exists` helper for the public feedback INSERT policy).
- **Every operational table's RLS** swapped to the matrix. `user_can_write`, `user_is_admin`, `user_is_base_admin_at` helpers **dropped**. `user_has_base_access` + `user_is_sys_admin` retained.
- **Client**: `lib/permissions.ts` — `usePermissions()` hook + `PERM` constants + `getPermissionsFor()` server helper. 15 pages swapped off `userRole === 'x'` strings onto `has(PERM.X)`.
- **Kiosk mode**: `components/layout/kiosk-guard.tsx` redirects `airfield_status` / `atc` off any non-root route. Sidebar, bottom-nav, and header installation switcher all hidden for them.
- **Bulk base assignment UX** in `UserDetailModal` — checkbox list of every installation with Select All / Clear, for MAJCOM/RFM setup.

### Migrations applied (in order)

```
2026042100  what's new tracking (pre-existing)
2026042101  feedback public access RPC (fixes anon QR scans)
2026042102  discrepancy optional fields (project_number, estimated_cost, risk_control_measure)
2026042103  discrepancy current_status adds 'waiting_for_project'

2026042200  permission matrix scaffold + user_has_permission()
2026042201  ces_update_discrepancy RPC
2026042202  new role presets + safety_update_rsc_bwc RPC
2026042203  wildlife + PPR RLS → matrix
2026042204  7 ops tables RLS → matrix
2026042205  airfield_status + shift + SCN + QRC + feedback DELETE → matrix
2026042206  parking + infra + daily reviews + audit + photos → matrix + photos:write / :delete keys
2026042207  base_setup + profiles + pdf library → matrix, grants base_setup:write to amops
2026042208  orphan cleanup + drop legacy helpers
```

All applied cleanly on prod.

---

## Known Issues & Tech Debt

| Item | Location | Severity | Notes |
|---|---|---|---|
| **`.env.local` modified** | Root | Trivial | Local-only; skip on commits |
| **`canCreate` / `canManageUsers` flags** | `lib/constants.ts` USER_ROLES | Trivial | No longer read by any app gate. Safe to remove in a polish commit. |
| **Legacy sidebar fallbacks** | `ADMIN_ITEMS`, `CES_ALLOWED_ITEMS` in `sidebar-nav.tsx` | Trivial | Unreachable with the current `HREF_TO_VIEW_PERM` map, kept as safety net. |
| **`any` casts** | ~121 project-wide | Low | Ongoing sweep when types regen |
| **`role_permissions` / `user_permission_overrides` not in typed schema** | `lib/supabase/types.ts` | Low | Accessed via `(supabase as any)` until types regen |
| **Largest source files** | `base-setup/page.tsx` 4,750+ LOC, `parking/page.tsx` 4,334, `infrastructure/page.tsx` 4,150, `dashboard/page.tsx` 1,499 | Medium | Component extraction remains the lever |
| **Test coverage** | 101 pass / 2 skipped, ~249 source files | Medium | No coverage on the new permission hook / RPCs yet |

---

## Next Session Tasks

### P1
- **Test coverage for the permission matrix** — unit tests for `usePermissions()` + the CES / Safety RPC round-trips.
- **Regen Supabase types** — pulls `role_permissions`, `user_permission_overrides`, `scn_*`, `arff_status_log`, `daily_reviews` into the typed schema so ~30 `as any` casts drop.

### P2
- **Role walkthrough demo accounts** — seed one demo user per new role on Demo AFB for video walkthroughs.
- **Remove `canCreate` / `canManageUsers` flags** from `USER_ROLES` + final sweep of any unused `UserRole` imports.
- **Drop `ADMIN_ITEMS` / `CES_ALLOWED_ITEMS` / `isCesRole` state** from `sidebar-nav.tsx` once we're confident no saved sidebar configs still need the fallback.

### P3 (multi-session)
- Platform One Party Bus onboarding (~6–8 weeks) — scaffold at `C:/Users/cspro/Downloads/glidepath/glidepath-local-dev/`
- CAC/PIV authentication — blocked on P1 platform
- Component extraction for 4K+ LOC pages
- Shared PDF utility (`lib/pdf-utils.ts`)
- METAR integration
- Outage analytics
- Training Management Module
- Part 139 civilian template support
- BowMonk conversion tool

---

## Recent Releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-04-22 | Permission matrix auth rollout, 3 new roles, CES write fix, Risk Control Measure |
| v2.32.0 | 2026-04-21 | Modular Onboarding, SCN, Close-for-Day, What's New modal |
| v2.31.0 | 2026-04-07 | Full Google Maps migration, Custom Status Boards, PPR Log |
| v2.30.0 | 2026-04-14 | Daily Reviews + shift sign-off, ARFF status log, Vitest scaffold |
| v2.29.0 | 2026-04-02 | Training system, 12-step base setup wizard, dark mode readability |

See `CHANGELOG.md` for full history.
