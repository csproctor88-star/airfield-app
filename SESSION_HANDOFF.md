# Session Handoff

**Date:** 2026-05-01
**Branch:** `main` (pushed)
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓, `npx vitest run` ✓ (253 pass)
**HEAD:** `84cecb1` (origin/main)

---

## What shipped this session

**Three blocks of work** off the prior session's backlog: the deferred
`/reports*` sweep (Tier-3 from 2026-04-30), a `/parking` toolbar
restructure that iterated through three different layouts before
landing, and the dormant `/feedback` staff view. Plus a real
production bug surfaced from a Vercel error log — the `/library`
server gate was importing helpers transitively from a `'use client'`
module and throwing `TypeError: u is not a function` for any user
who tried to open it. Fix landed across two commits and a perm-lockdown
migration. 16 commits total, all on `main` and pushed.

### `/reports*` structure-first sweep (`7980999` → `3aea92a`)

Six commits, one per page. All five sub-pages (`daily`, `discrepancies`,
`trends`, `aging`, `lighting`) plus the `/reports` index were carried
over from the prior session's Tier-3 list and never got a structural
review.

The most material fix was on `/reports/aging` (`dc6d914`): the By
Aging Tier badges had been concating `${tier.color}28 / 14 / 33`,
which is the same hex-alpha-concat footgun pinned in
`feedback_amber_text_contrast.md`. It was working *only* because the
tier colors were still raw hex — the moment any tier color got
tokenized to a CSS variable (the same migration done on
`ACSI_STATUS_CONFIG` in the prior session), the badges would
silently drop bg + border. Migrated all three concats to color-mix
preemptively. Rest of the page got a per-tier 3px row rail mirroring
the `/waivers` and `/discrepancies` list patterns.

`/reports/daily` (`03ced01`) shipped the only `linear-gradient(135deg,
#0EA5E9, #22D3EE)` button left in the running app — the rest had
been converted to solid `var(--color-cyan)` during v2.32. Dropped.
The preview-view section icon-tile was using the same hex-alpha
concat (`${s.color}14`/`${s.color}33`) and breaking for `var(...)`
section colors — replaced with a 3px left rail and a count promoted
to the right edge.

`/reports/trends` (`69ad3b9`) converted the period selector from
solid filled-purple tabs to the canonical outlined-pill cluster
(QRC l.194 recipe), and bumped the bar-chart count column to
`fontVariantNumeric: tabular-nums` + `--fs-sm` so columns line up.

`/reports/lighting` (`3aea92a`) sort tabs converted to outlined-pill,
summary cards got per-card colored top rails (matching
`StyledCard`-on-`/reports`), and the four purple PDF/Email buttons
moved off raw `rgba(168,85,247,…)` to color-mix on
`var(--color-purple)`.

The `/reports` index (`7980999`) dropped its title from `--fs-2xl` to
`--fs-xl`, replaced the `${card.color}22` border-tint concat (which
had been silently broken — the border was effectively invisible) with
a 3px left rail per card, swapped the `›` Unicode chevron for
Lucide ChevronRight, and stacked title-over-description instead of
inlining them on a single span.

`/reports/discrepancies` (`289244f`) was the smallest delta: filter
card got a 3px cyan left rail to read as "this is the filter section,"
all three button styles migrated from raw rgba to color-mix.

### `/parking` left-rail toolbar (`5c8355b` → `cf7327a`)

Five commits — the messy iteration shape is the headline. The user
asked for a vertical left-rail to replace the two horizontal toolbars
that wrapped at the top of the map and visually competed for the
header. First pass (`5c8355b`) shipped the rail with "same on mobile"
per the user's spec.

Mobile portrait viewport then clipped the bottom of the rail behind
the iOS PWA bottom-nav (Boundary / AC / OB / PDF / Email cut off).
User course-corrected: "this method won't work on mobile but it does
look nice on desktop." `85ea7c5` reverted mobile to the prior
horizontal-toolbars recipe — that turned out to wrap to multiple rows
and eat 30% of the viewport. User course-corrected again. `1a0c19b`
made the rail itself responsive (column on desktop, horizontal
scroll-strip on mobile). User then asked to split mobile by purpose:
plan-edit tools at the top, View / Ruler / PDF / Email at the
bottom-right since they aren't core to plan creation. `cf7327a`
landed that — single rail component branches its layout on
`isMobile` and renders one cluster on desktop, two on mobile.

The `feedback_visual_plan_brevity.md` memory got saved during this
work after the user said "I don't really understand what you are
explaining with the new tools, I guess proceed and we will see what
it looks like." Lesson: for visual UI restructures, lead with an
ASCII sketch, defer code-level tradeoffs to execution — the user
can course-correct from a render faster than from a design doc.

### `/parking` clearance-line edge anchors (`2d8eedd` → `ccad75e`)

User noticed during the parking session that all the drag-time green/
amber/red distance lines emanated from the dragged aircraft's
nose-gear pivot point. With every line attaching at the nose, it
read as if the distances were measured from the nose gear marking,
even though the underlying clearance math was correct. Misleading
visualization.

`2d8eedd` first cut: compute four cardinal anchors (nose tip, tail
tip, left wingtip, right wingtip) and pick whichever is closest to
the target. User said "pretty close but the line looks a little off
from the wingtip" — for swept-wing aircraft, the cardinal-side-midpoint
isn't always at the visible wingtip.

`ccad75e` second cut: replaced the 4-cardinal-anchor approach with a
ray-rectangle exit calculation. Project the ray from aircraft center
toward the target, find where it crosses the bounding rectangle,
anchor there. The line exits exactly along the line of measurement
so it visibly touches the wingtip / nose / tail edge precisely
regardless of geometry.

For aircraft-to-aircraft pairs, the ray-exit runs on both ends. For
obstacles, only the moved-aircraft side; the obstacle stays a
single-point endpoint. Underlying clearance calculations unchanged.

### `/feedback` staff view (`b9c5af7`)

Tier-3 holdover from prior session — only the public QR form had been
refreshed in Tier 1. Header restructure split the prior 5-button row
into two clusters (time-filter pills as outlined-pill cluster, Export/
Email PDF as a separate output cluster on success-tinted /
purple-tinted chrome). Per-row 3px left rail keyed off
`overall_rating`: 4-5★ green, 3★ amber, 1-2★ red, no rating gray —
so a 5★ rave and a 1★ complaint scan distinctly. Token sweep on raw
`#FBBF24` (stars + avg-rating digit + distribution bars) and
`#334155` (empty-stars). HTML `&times;` delete button → Lucide X.

### `/library` access (`2a5c22a` → `48d59a9` → `84cecb1`)

User reported: clicking PDF Library bounces back to `/more` instead of
loading. Three commits to land the right fix, plus a perm migration.

`2a5c22a` first try: the `/library` server-page gate queried
`role_permissions` directly and ignored `user_permission_overrides`,
so any user granted `library:view` via an override (rather than via
their role's preset) saw the link in `/more` (the client
`usePermissions()` hook merges overrides correctly) but got bounced
on click. Replaced inline query with the shared `getPermissionsFor()`
helper from `lib/permissions-server.ts`. Pushed.

User reported same redirect-loop on prod after deploy, *plus* the
Vercel error log showing `TypeError: u is not a function` at
`/library/page.js`. That's the exact pattern the comment at the
bottom of `lib/permissions.ts` warns about: importing from a
`'use client'` module into a server component produces a
client-reference stub that throws when invoked. `lib/permissions-server.ts`
itself imports `resolveEffectivePermissions` from `permissions.ts`,
so the helper transitively re-introduced the bug.

`48d59a9` second try: dropped `getPermissionsFor` and called the
`user_has_permission(uuid, text)` SECURITY DEFINER RPC directly.
Single round-trip, resolves role-preset + user_permission_overrides
server-side, no cross-module import gotcha. Page loads.

User then clarified the actual scope: PDF Library should be
**sys_admin only** — not visible to AFM, NAMO, base_admin, etc. The
Phase A seed (`2026042200`) had granted `library:view` and
`library:manage` broadly via the "all keys" inserts for sys_admin /
airfield_manager / namo / base_admin and via the `%:view` loop for
safety / atc; only `read_only` had been explicitly cleaned up later.

`84cecb1` is migration `2026050100_library_perms_sys_admin_only.sql`:
DELETEs both keys from `role_permissions` for every role
`<> 'sys_admin'`, and DELETEs matching grants from
`user_permission_overrides` where the override user is not a
sys_admin. Idempotent. **User confirmed the migration was applied to
prod this session.**

---

## Migrations status

| Migration | Status | What it does |
|---|---|---|
| `2026050100_library_perms_sys_admin_only.sql` | ✅ Applied (this session) | Locks `library:view` + `library:manage` to sys_admin only — revokes from `role_permissions` for every other role and from `user_permission_overrides` for non-sys_admin users. |
| `2026042907_add_construction_other_check_types.sql` | ✅ Applied | (carryover) `airfield_checks_check_type_check` accepts `'construction'` and `'other'`. |
| `2026042906_drop_ppr_arrival_eta_zulu.sql` | ✅ Applied | (carryover) Drops `ppr_entries.arrival_eta_zulu`; recreates `submit_public_ppr_request` RPC. |

---

## Bugs fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| `/library` redirect-looped to `/more` for users granted `library:view` via a per-user override (not role preset). The link was visible in `/more` because the client hook merges overrides; click bounced. | The server-page gate at `app/(app)/library/page.tsx` queried `role_permissions` directly and ignored `user_permission_overrides`. Replaced with the shared helper, then with the SQL RPC after the next bug. | `2a5c22a` → `48d59a9` |
| `/library` produced `TypeError: u is not a function` in production (Vercel logs from `/library/page.js`). Page never rendered. | `lib/permissions-server.ts` imports `resolveEffectivePermissions` from `lib/permissions.ts`, which is `'use client'`. Next.js wraps the import as a client-reference stub when called from a server component — the exact pattern the comment in `permissions.ts` explicitly warns about. The first-try fix transitively walked into the same trap. | `48d59a9` |
| `/reports/aging` aging-tier badges silently broken pending tokenization. Worked *only* because tier colors were still raw hex; would have dropped bg + border the moment tier colors became CSS variables. | `${tier.color}28 / 14 / 33` hex-alpha concat. Same footgun pinned in `feedback_amber_text_contrast.md`. Migrated to color-mix preemptively. | `dc6d914` |
| `/reports/daily` Generate Report was the only `linear-gradient` button still in the running app. | Pre-v2.32 styling never converted. Solid `var(--color-cyan)` + `var(--color-cyan-btn-text)` per the canonical filled-cyan recipe. | `03ced01` |
| `/reports/daily` preview-view section icon-tile silently dropped bg+border for var-bound colors. | Same `${s.color}14 / ${s.color}33` concat (the very same `ActionButton` footgun fixed in the prior session). Replaced the colored 32×32 number-tile with a per-row 3px rail and count promoted to the right edge — same recipe used in `/daily-reviews`. | `03ced01` |
| `/parking` clearance distance lines all anchored at the dragged aircraft's nose-gear pivot regardless of which side was being measured. | The drag-handler used `{lat,lng}` (= moved nose-gear position) for the line origin. Underlying clearance math used closest-edge geometry but the rendering didn't match. Refactored to ray-rectangle exit anchor via `spotCenter` + body-frame projection. | `2d8eedd` → `ccad75e` |

---

## Lessons from this session

- **Don't import from `'use client'` modules in server components, even
  transitively.** The comment at the bottom of `lib/permissions.ts`
  warns about this exact pattern, and `lib/permissions-server.ts`
  was created specifically to dodge it — but the helper itself
  imports `resolveEffectivePermissions` from the `'use client'`
  module, so the trap re-armed transitively. For single-key
  permission checks in server components, use the
  `user_has_permission(uuid, text)` SECURITY DEFINER RPC directly.
  For multi-key needs in a server route, the underlying helper
  needs to be moved out of the `'use client'` file (`resolveEffectivePermissions`
  is pure logic — no React, no client API — so it can live in a
  shared `permissions-shared.ts`). Filed as known tech debt below.

- **Visual UI plans should lead with the visual outcome.** Saved as
  `feedback_visual_plan_brevity.md`. The parking-toolbar plan was
  comprehensive — exhaustive icon table, color-mix tradeoff
  exposition, sidebar-position math — and the user said "I don't
  really understand what you are explaining with the new tools, I
  guess proceed and we will see what it looks like." For visual
  changes, an ASCII sketch + plain-language behavior is enough;
  defer code-level tradeoffs to execution. The user can course-
  correct from a render faster than from a design doc. This
  complements `feedback_screenshot_then_plan_mode.md` (still
  plan-mode-gated) — the *content* of those plans should be
  visual-first.

- **"Same on mobile" deserves a mid-iteration sanity check.** The
  parking rail went through three layouts because the user's "same
  on mobile" intent reversed once they saw the desktop rail's height
  in a portrait viewport. Per the new memory, render the change and
  let the user judge instead of designing for both at once.

- **Hex-alpha-concat preventive sweep is still incomplete.** Three
  more instances surfaced this session (`/reports/aging` tier
  badges, `/reports/daily` section icon tile, `/reports` index card
  border). Total fixed across both sessions: ~9. Codebase-wide grep
  for `\$\{[a-zA-Z_.]+\}[0-9A-Fa-f]{1,2}\b` would surface remaining
  cases. Mechanical fix.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| `lib/permissions-server.ts` imports `resolveEffectivePermissions` from a `'use client'` module — works on the client but transitively re-introduces the client-reference-stub bug if any server caller invokes the full helper. | Medium | Move `resolveEffectivePermissions` (pure function, no React) out of `lib/permissions.ts` into a shared module so server callers can use the helper without the SQL RPC dance. The `/users` page is the only remaining server-side caller of `getPermissionsFor` — `/library` now uses the RPC directly. |
| Hex-alpha-concat sweep still incomplete | Low | A codebase-wide grep for `\$\{[a-zA-Z_.]+\}[0-9A-Fa-f]{1,2}\b` would surface remaining cases. ~9 fixed across the last two sessions. Mechanical fix (`color-mix(in srgb, ${color} N%, transparent)`). |
| Cyan filter-chip `rgba(56,189,248, X)` patterns in `/aircraft` | Low | (Carryover) Category tabs, sort buttons, favorites toggle. |
| `computeIconScale` uses `getBounds()` for px-per-degree calc | Low | (Carryover) Naive bounds rectangle expands on a rotated map. |
| Counter-rotation of aircraft icons regenerates 30+ canvases per heading change | Low–Medium | (Carryover) Smooth on developer laptops, may stutter on weaker hardware. Migration target: `AdvancedMarkerElement`. |
| Largest parking page LOC (~4.6K) still monolithic | Held | (Carryover) Component extraction explicitly held out from prior sessions. |
| Untracked `dark logo.jpg` (2.4MB) | Low | Sits in `/public` from a prior logo experiment. Carryover. |
| Untracked `docs/DEMO_LOGINS.md` | Low | Carryover. |
| Untracked `.claude/` | Low | Local Claude Code settings (gitignored expectation). Carryover. |
| Trademark | Low | (Carryover) CDW holds live "GLIDEPATH" Class 42 (SaaS) registration. |
| Discrepancy "Notes History" backfill | Optional (carryover) | Historical rows still have `CURRENT_STATUS: <enum>` in the DB; display rewrites on render. |
| Visual NAVAIDs further perf | Deferred (carryover) | Layer-toggle full-rebuild, health-ring `Circle` volume, audit-mode panel. |
| Sequential PPR coordination | Deferred (carryover) | All assigned agencies see their work in parallel; no ordering. |
| Public PPR form file uploads | Deferred (carryover) | Out of scope unless requested. |
| "Advisories" → "WWA Notifications" UI sweep | Deferred (carryover) | Glossary memory says "WWA Notifications"; running app still says "Advisories". |
| ~124 `as any` casts project-wide | Low | (Carryover). |
| PDF boilerplate duplication in 11 generators | Low | (Carryover) 5 already on `pdf-utils.ts`. |
| Check draft real-time sync deferred | Low | (Carryover) Two users could create duplicate drafts. |

---

## Next session tasks

User explicitly bundled three pages for the next session: `/training`,
`/infrastructure` (Visual NAVAIDs), and `/settings/base-setup`.

- **`/training`** (Glidepath Training) — needs a full content
  refresh per user: "training will need to be updated significantly."
  Screenshots needed; user will provide. ~21 kB First Load JS so
  moderate substance. In-app guidance for using the platform.
- **`/infrastructure`** (Visual NAVAIDs, ~4.1K LOC) — bigger
  multi-session work. Real backlog: layer-toggle full-rebuild
  perf, health-ring `Circle` volume, audit-mode panel.
- **`/settings/base-setup`** (~4.7K LOC) — the largest page in the
  app. 15-step config wizard.

These three are likely a multi-session arc, not one session.

### Long-running carryover (bandwidth-permitting)

Pick from these only when bandwidth allows or a customer asks:

- `/parking/page.tsx` component extraction (~4.6K LOC → ~1.5K via
  `parking-panel.tsx` + `AircraftTab` + `EnvironmentTab` +
  `ClearanceTab` + `SettingsTab` + `ParkingHeader` + `ActionBar`).
  Four-commit plan still queued.
- Move `resolveEffectivePermissions` out of `lib/permissions.ts`
  (`'use client'`) into a shared module so `lib/permissions-server.ts`
  doesn't transitively re-arm the client-reference-stub bug. Pure
  refactor; no behavior change.
- Hex-alpha-concat preventive grep + sweep.
- CAC/PIV authentication (blocked on Platform One).
- Outage analytics, training management, Part 139 civilian template.
- "Advisories" → "WWA Notifications" UI sweep.
- Offline reads for QRC + Regulations.

---

## Build snapshot

```
TypeScript clean (npx tsc --noEmit exit 0)
Tests: 253 pass / 25 files (unchanged)
Build: npm run build clean — no warnings, no errors.
1 new migration this session, applied to prod.

Notable First Load JS (changed routes this session):
  /                                     (Airfield Status — full-page route)
  /feedback                             (staff view restructure)
  /library                              146 kB / 292 kB
  /parking                              43.6 kB / 416 kB   (+1.9 from rail toolbar)
  /reports                              6.26 kB / 168 kB
  /reports/aging                        5.71 kB / 331 kB
  /reports/daily                        3.73 kB / 322 kB   (-0 from gradient drop)
  /reports/discrepancies                4.63 kB / 330 kB
  /reports/lighting                     7.62 kB / 318 kB
  /reports/trends                       4.9 kB / 316 kB

Largest static page (unchanged): /wildlife 458 kB / 793 kB.
Middleware: 74.5 kB.
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-05-01 (this session) | Reports & Analytics structure-first sweep (6 pages). Parking left-rail toolbar through three iterations to land on responsive desktop-vertical / mobile-split. Parking clearance lines now anchor on ray-rectangle exit per side. /feedback staff view restructure (header split + per-row rating rail + token sweep). /library access bug fixes — Vercel `TypeError: u is not a function` traced to a `'use client'` transitive import in the server gate; switched to the `user_has_permission` RPC directly. Migration `2026050100` locks `library:view` + `library:manage` to sys_admin only. 16 commits on `main`, all pushed. |
| **Unreleased** | 2026-05-01 (prior) | Structure-first audit. 31 commits across 22+ surfaces. ACSI module sweep (7 commits), structural restructures of `/daily-reviews`, `/recent-activity`, `/wildlife` list+form, `/aircraft` list+detail, `/contractors`, `/discrepancies` list+detail. Tier 3 sweep: `/notams`, `/scn`, `/shift-checklist`, `/checks/history`, `/waivers`, `/obstructions`, `/ppr`, `/dashboard`, `/`, `/users`, `/more` (2 commits including emoji→Lucide). 6 real bugs fixed including the hex-alpha-concat silent-drops in `ActionButton`, `BWC chip`, `FREQ_COLORS`, KPI band; and the `obstructions` duplicate-`5.` Required Actions numbering. |
| **Unreleased** | 2026-04-30 (prior) | Tier 2 of the audit-derived refresh backlog finished. Six commits across five pages. |
| **Unreleased** | 2026-04-30 (prior) | Tier 1 of the audit refresh + 25-commit deep parking polish. 28 commits. |
| **Unreleased** | 2026-04-30 (prior) | Distinctive-refresh sweep across high-traffic routes. 20 commits. |
| **Unreleased** | 2026-04-30 (prior) | QRC distinctive refresh. 1 commit. |
| **Unreleased** | 2026-04-29 | Distinctive-refresh sweep across `/`, `/dashboard`, `/discrepancies`, `/ppr`, `/checks`, `/inspections`. 16 commits, two migrations applied. |
| **Unreleased** | 2026-04-29 (prior) | PPR per-surface visibility, public form ETA optional, Airfield Status base-local-today filter, type-scale shrink. 4 commits. |
| **Unreleased** | 2026-04-28 (cont.) | Capabilities doc v2.32 + FOD Check terminology, discrepancy notes humanization, Visual NAVAIDs zoom stabilization, Training nav rename, CLAUDE.md drift fixes. 6 commits. |
| **Unreleased** | 2026-04-28 | PPR commercial phone + ETA Zulu spine, soft-cancel + email, AMOPS delete/approve perms, manual-coord-pending, slim Log, ACSI per-member signature toggle, sidebar badge polling cuts. Four migrations. |
| **Unreleased** | 2026-04-27 (cont.) | Denial email, AMOPS reply-to format check, PPR PDF coord/status section, no-coord triage warning, OI refresh, public form date echo, atomic PPR# counter, storage RLS path scoping, sidebar badge fixes. |
| **Unreleased** | 2026-04-27 | PPR remarks, info-only columns, ICAO-based URL, sidebar pending dots, agency coordinators, deny-on-review, base-setup drag-reorder, Events Log filter. |
| **Unreleased** | 2026-04-26 | PPR public form + AMOPS-triaged multi-agency coordination, requester emails, full UI/UX iteration. |
| **Unreleased** | 2026-04-25 (cont.) | Offline write queue: foundation + 12 wraps + inspector + pending photos. |
| **Unreleased** | 2026-04-25 | iOS PWA fixes, airfield diagram upload rewrite, OFFLINE pill, codebase primer, Workbox runtime caching for offline reads. |
| v2.32.0 | 2026-04-21 | Modular Onboarding, SCN, Close-for-Day, What's New modal |
| v2.31.0 | 2026-04-07 | Full Google Maps migration, Custom Status Boards, PPR Log |
| v2.30.0 | 2026-04-14 | Daily Reviews + shift sign-off, ARFF status log, Vitest scaffold |

See `CHANGELOG.md` for full history.

---

## Key docs / files touched this session

### New files

- `supabase/migrations/2026050100_library_perms_sys_admin_only.sql` —
  migration locking `library:view` + `library:manage` to sys_admin
  only. Applied to prod this session.
- `C:/Users/cspro/.claude/projects/C--Users-cspro/memory/feedback_visual_plan_brevity.md`
  — feedback memory: visual UI plans should lead with the visual
  outcome (ASCII sketch + behavior), defer code-level tradeoffs to
  execution.

### Modified files

- `app/(app)/reports/page.tsx` — index restructure.
- `app/(app)/reports/daily/page.tsx` — gradient drop + section row rail + tokens.
- `app/(app)/reports/discrepancies/page.tsx` — filter-card rail + token sweep.
- `app/(app)/reports/trends/page.tsx` — outlined-pill picker + tabular bars.
- `app/(app)/reports/aging/page.tsx` — tier color-mix preventive fix + per-row rail.
- `app/(app)/reports/lighting/page.tsx` — outlined-pill sort + summary rails.
- `app/(app)/parking/page.tsx` — rail toolbar (5 commits) + clearance line anchors (2 commits).
- `app/(app)/feedback/page.tsx` — header split + per-row rating rail + tokens + Lucide X.
- `app/(app)/library/page.tsx` — server gate via `user_has_permission` RPC.

### Reference files (read-only)

- `app/(app)/qrc/page.tsx:194` — canonical outlined-pill recipe (cited
  in `/reports/trends` and `/reports/lighting` sort-tab refactors).
- `lib/permissions.ts` (bottom comment) — the `'use client'` →
  server-component import warning that the `/library` bug
  rediscovered the hard way.
- `feedback_screenshot_then_plan_mode.md` — cited in the parking
  rail iteration; plan-mode-gated structural work survived even with
  three course corrections.

### Environment changes

None this session.

---

*All 16 commits this session are on the `main` branch and have been
pushed to `origin/main`. One migration applied to prod
(`2026050100_library_perms_sys_admin_only.sql`). No version bump.
Untracked files (`.claude/`, `docs/DEMO_LOGINS.md`,
`public/dark logo.jpg`) remain carryover.*
