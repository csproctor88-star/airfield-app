# Session Handoff

**Date:** 2026-05-01 (cont.)
**Branch:** `main` (pushed)
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓, `npx vitest run` ✓ (253 pass)
**HEAD:** `542ffa7` (origin/main)

---

## What shipped this session

Six commits on `main`, three logical bundles: the deferred `/library`
structure-first refresh (the hub the load-fix earlier in the day didn't
touch), an `/infrastructure` (Visual NAVAIDs) refresh that turned into a
four-commit arc once the user spotted the bare post-place dialog and a
trio of InfoWindow-spacing follow-ups landed, and Phase 1 of a base-
configuration revamp that pulled admin work out of `/settings` into a
dedicated `/base-config` hub. No migrations applied this session. All
six commits on `main`, all pushed.

### `/library` structure-first refresh (`2d40550`)

User flagged early in the session that `/library` got the load-fix in the
prior session but never the audit-derived design pass. Lifted
`components/PDFLibrary.tsx` (~1.1K LOC) into the same recipe family the
sweep has been applying everywhere: dropped the indigo→purple gradient
on the header logo tile and the vertical `linear-gradient(180deg,
--color-bg-elevated 0%, --color-bg-surface-solid 100%)` on the header
chrome, switched to a cyan-tinted color-mix tile on solid bg-elevated.
Toolbar buttons retargeted: Refresh stays neutral outlined, Cache All
moves to the canonical solid-cyan filled recipe (`var(--color-cyan)` +
`var(--color-cyan-btn-text)`), Extract All adopts the outlined-pill
amber recipe pinned in `feedback_amber_text_contrast.md`. List rows
gained a 3px left rail keyed off cached/indexed state — green when
cached + indexed, cyan when cached only, neutral text-4 otherwise —
mirroring the per-row rail pattern from `/feedback` and `/reports/aging`.
Implemented via `box-shadow: inset 3px 0 0 <color>` so it doesn't fight
the existing hover-borderColor handler. Token-cleaned the PDF viewer
toolbar (active search button on `var(--color-cyan)`, snippet panel mItem
+ mBadge off `var(--color-border)` to color-mix on cyan), the global
`#34D399 / #FBBF24 / #FACC15 / #F87171 / #EF4444` palette, and the
indigo `progressFill` gradient. Only `#FFF` left in the file is the PDF
iframe background (intentional). `/library` First Load unchanged at
146 kB / 292 kB.

### `/infrastructure` (Visual NAVAIDs) refresh + post-place dialog (`3a85510`)

Big commit. Tackled the LIGHTING STATUS row (per-card 3px top rail keyed
off `worstTier`, killing the `tierColor + '40'` border-tint and
`tierColor + '60'` dot box-shadow concats — same hex-alpha-concat
footgun pinned in `feedback_amber_text_contrast.md`, would have silently
dropped the moment `TIER_COLORS` got tokenized). Tokenized
`TIER_COLORS` to `var(--color-success)` / `var(--color-warning)` /
`var(--color-danger)`. Made "X inop" text neutralize to text-3 when
tier=green so the green-dot-with-green-2-inop visual contradiction goes
away. Recent Activity list got a per-row 3px left rail keyed off
Reported (red) / Resolved (green); redundant 6px dot dropped since the
rail carries the signal.

The five accent-color families running in the page chrome got
tokenized: orange `#F97316` (Import) → outlined-pill amber, purple
`#A855F7` (Bulk Shift / Box Select) → color-mix on `var(--color-purple)`,
amber `#F59E0B` / `#FBBF24` (Free Move + bar placements + rotation
input) → color-mix on `var(--color-amber)` / `var(--color-warning)`,
cyan Use My GPS → color-mix on `var(--color-cyan)`. Free Move save bar
amber rgba → color-mix. The "16 INOP" pill at the LIGHTING STATUS
strip switched to outlined-pill `--color-danger`. Edit Mode + Audit
Mode active-state borders unified at 1px (was inconsistent 1px/2px mix).

Map InfoWindow edit dialog (rendered as HTML string at
`infrastructure/page.tsx:1820–1955`) got a full token sweep — status
pill, Report Outage / Mark Operational, Save, Move/Grab, Delete, form
chrome, compass needle, slider accent-color, Bar Group cyan indicator
all on var() instead of raw hex. CSS variables work in inline `style=""`
so the migration is mechanical.

The headline workflow change: the post-place "Feature Placed" dialog
expanded from a bare type-only dropdown (Screenshot 211037) to mirror
the in-edit form fields. Now contains Feature Type, System / Component
(optgroup-grouped), [Sign Text — signs only], Fixture ID, Rotation
compass + slider with live needle, and a Save button. New
`window.__savePlacedProps` global handler wraps `savePropsRef` and
records the chosen System/Component + Rotation in carryover refs
(`lastPlacedComponentRef` / `lastPlacedRotationRef`) so subsequent
placements pre-populate those fields. Saves dropdown-clicks per fixture
when laying down hundreds of lights in sequence.
`createInfrastructureFeature()` extended to accept optional
`system_component_id` + `rotation` so carryover applies at create-time,
not via a follow-up update round-trip.

Side-find: the audit panel header was using an undefined
`var(--color-cyan-bright)` (would render as `currentColor`) — fixed to
`var(--color-cyan)`.

### `/infrastructure` InfoWindow spacing — three-iteration arc (`631c60b` → `1c234eb` → `8452a64`)

Painful sequence. After Phase 1 of `/infrastructure` shipped, the user
flagged the dialogs felt cramped. First commit (`631c60b`) bumped row
gaps 6→10px, label-to-input gaps 2→5px, input padding 4×6→6×10, button
padding 5→7-8px, added `min-width: 260px` + `padding: 4px 4px 2px` to
both dialog roots. That made the buttons too tall, which forced the
edit dialog over the InfoWindow's available height — scroll appeared.

Second commit (`1c234eb`) shrunk button vertical padding back to 5px
and tightened row gap from 10→8px, kept the label/input readability
wins. Looked plausible but the user came back with a screenshot showing
horizontal scroll inside the dialog AND the title clipped to "xiway
Lights" — the dialog content was wider than the InfoWindow allowed.

Third commit (`8452a64`) found the actual root cause: three independent
width constraints stacked. The per-marker-click handler at
`infrastructure/page.tsx:2270` was wrapping the popup HTML in a `<div
style="background:#1E293B; padding:2px; max-width:240px;">` — and the
global `.gm-style-iw` `<style>` had `padding: 2px !important`. My
`min-width: 260px` exceeded the wrapper's `max-width: 240px` → forced
horizontal scroll. Cleanup: dropped the wrapper entirely (was just
duplicating the bg the global already sets), dropped width/min-width
from both dialog roots so content sizes naturally, bumped
`.gm-style-iw` padding `2px → 8px 10px` so all dialogs get consistent
edge inset, tokenized the four `.gm-style-iw` rules
(bg / border / close / tail), and bumped border-radius `8 → 10` to
match the rest of the app. Saved as `feedback_gmap_infowindow_widths.md`
so this doesn't repeat.

### `/base-config` IA + hub redesign (`542ffa7`) — Phase 1 of a multi-session arc

User flagged the four full-width gradient buttons inside Settings →
BASE CONFIGURATION expander as visually off, and asked whether base
configuration should live under "Admin" away from personal Settings.
Plan-mode session produced a three-phase arc; only Phase 1 ships in
this commit.

Phase 1: split admin work out of Settings into a new top-level sidebar
entry "Base Configuration" → `/base-config` (gated on
`base_setup:write` via `HREF_TO_VIEW_PERM`, slotted into the Admin
section of `DEFAULT_SIDEBAR_CONFIG`, `SlidersHorizontal` icon to
differentiate from `/settings`' gear and `/ces`' wrench). New hub page
at `app/(app)/base-config/page.tsx` — 2-col responsive card grid, each
card with cyan-tinted icon tile, title + description, status pill
(Configured / Needs Setup / Not Configured), 3px left rail keyed off
status, and a per-card live detail line ("16 of 17 modules enabled",
"8 of 16 wizard steps · 50% complete", etc.). Click anywhere on the
card routes to the sub-page — no inline button. Status indicators
reuse `enabledModules` from the installation context, `isWizardStepEnabled`
+ `isStepDone` from `lib/modules-config.ts`, `fetchInspectionTemplate`,
and `getAirfieldDiagram`.

Old admin pages physically moved under the new hub:
`/settings/base-setup` → `/base-config/setup` (~4.7K LOC),
`/settings/base-setup/modules` → `/base-config/modules`,
`/settings/templates` → `/base-config/templates`. Internal back-links +
cross-links retargeted; back-link labels relabeled "← Base
Configuration". Old `/settings/*` paths become 152-byte redirect stubs
(via `next/navigation` `redirect()`) so bookmarks keep working. The
inline airfield-diagram upload UI extracted from `BaseConfigSectionContent`
into `/base-config/diagram` (~115 LOC) with the canonical filled-cyan +
outlined-pill-danger recipes in place of the gradient button. Settings
page section list now reads Profile / Installation / Data & Storage /
Regulations Library / Appearance / About — clean. `/settings` First
Load JS dropped from 16.6 kB → 15.2 kB; new `/base-config` hub at
7.42 kB / 179 kB.

Phase 2 (next session) is the wizard chrome itself — labeled stepper
(replacing numbered-circle row), per-step Guide panel (what / why /
required / example / DAFMAN cite), inline `(?)` tooltips on every
field, per-step status pills, auto-save indicator. Plan committed at
`.claude/plans/misty-mixing-feather.md`. Phase 3 (deferred) covers
first-run onboarding overlay + live-preview pane.

---

## Migrations status

No migrations applied or written this session.

| Migration | Status | What it does |
|---|---|---|
| `2026050100_library_perms_sys_admin_only.sql` | ✅ Applied (prior session) | Locks `library:view` + `library:manage` to sys_admin only. |
| `2026042907_add_construction_other_check_types.sql` | ✅ Applied | (carryover) `airfield_checks_check_type_check` accepts `'construction'` and `'other'`. |
| `2026042906_drop_ppr_arrival_eta_zulu.sql` | ✅ Applied | (carryover) Drops `ppr_entries.arrival_eta_zulu`. |

---

## Bugs fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| `/infrastructure` Audit panel header rendered with no color (currentColor) on the "Audit Mode" label. | The header style referenced `var(--color-cyan-bright)` — undefined in `globals.css`. Fix: switch to `var(--color-cyan)`. Caught while doing the token sweep, not user-reported. | `3a85510` |
| `/infrastructure` LIGHTING STATUS category cards would silently lose their tier-color border tint and dot glow the moment `TIER_COLORS` got migrated to CSS vars. | `tierColor + '40'` border-tint and `tierColor + '60'` dot box-shadow — the same hex-alpha-concat footgun pinned in `feedback_amber_text_contrast.md`, kept working only because `TIER_COLORS` was raw hex. Replaced with color-mix; dropped the box-shadow entirely (rail does the work). | `3a85510` |
| Map InfoWindow edit dialog horizontal scroll + clipped title ("xiway Lights" instead of "Taxiway Lights"). | Three independent width constraints stacked: per-dialog inline `min-width: 260px` (added during a "breathe" pass), per-marker-click wrapper `<div style="max-width: 240px; padding: 2px;">` at line 2270, and global `.gm-style-iw` `padding: 2px !important`. Min-width exceeded the wrapper's max-width → horizontal scroll. Fix: dropped the wrapper (duplicating the global bg already), dropped width constraints from dialog roots, bumped `.gm-style-iw` padding to `8px 10px` so all dialogs get consistent edge inset. | `8452a64` |

---

## Lessons from this session

- **Google Maps InfoWindow has 3 independent width constraints stacked.**
  Saved as `feedback_gmap_infowindow_widths.md`. Per-dialog inline
  styles, the per-click `setContent` wrapper, and the global
  `.gm-style-iw` `<style>` block all influence width/padding. Adjusting
  any one without auditing the other two causes silent overflow + scroll
  + clipping. Cost three commits before the root cause surfaced.

- **Plan-mode plan-file path is sticky across re-entries.** When
  re-entering plan mode after a previous ExitPlanMode, the system tracks
  ONE plan file path. Writing to a self-named file (`infrastructure-refresh.md`
  in our case) orphans the work — `ExitPlanMode` reads from the
  *original* tracked path, which still had the prior plan. Cost the
  user a confused rejection ("you sent the plan for pdf library").
  Always use whatever path the system reports, or overwrite the
  existing tracked file.

- **Hex-alpha-concat footgun is still finding new homes.** Three more
  instances surfaced this session: `tierColor + '40'`, `tierColor + '60'`
  in `system-health-panel.tsx`, plus the `tier.color}28 / 14 / 33` in
  `/reports/aging` last session. A codebase-wide grep
  for `\$\{[a-zA-Z_.]+\}[0-9A-Fa-f]{1,2}\b` would surface remaining
  cases — mechanical fix (`color-mix(in srgb, ${color} N%, transparent)`).

- **For `mv`-style renames inside Next App Router, prefer `cp` + redirect
  stubs over destructive moves.** Phase 1 of base-config moved the 4.7K
  LOC base-setup wizard from `/settings/base-setup` to `/base-config/setup`
  via `cp` and replaced the original with a `redirect('/base-config/setup')`
  Next page. Bookmarks keep working, the diff stays scoped, and there's
  no risk of an in-flight session losing the canonical implementation.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| `lib/permissions-server.ts` imports `resolveEffectivePermissions` from a `'use client'` module — works on the client but transitively re-introduces the client-reference-stub bug if any server caller invokes the full helper. | Medium | (Carryover) Move `resolveEffectivePermissions` (pure function, no React) out of `lib/permissions.ts` into a shared module. Only remaining server-side caller of `getPermissionsFor` is `/users`. |
| Hex-alpha-concat sweep still incomplete | Low | (Carryover, plus 3 new this session). Codebase-wide grep for `\$\{[a-zA-Z_.]+\}[0-9A-Fa-f]{1,2}\b` would surface remaining cases. |
| `audit-panel.tsx` per-row internal rows still raw / not refreshed | Low | New this session. The hub-level structural pass on `/infrastructure` skipped the dense per-row "Light, electrical light…" list. 1.6K LOC of its own — explicitly held out of the page-chrome refresh. |
| `/infrastructure` perf carryover (layer-toggle full-rebuild, health-ring `Circle` volume) | Low–Medium | (Carryover) Smooth on dev laptops, may stutter on weaker hardware. Migration target: `AdvancedMarkerElement`. |
| `/base-config` Phase 2 — wizard chrome refresh | Medium | New this session. Labeled stepper, per-step Guide panel, inline `(?)` tooltips, per-step status pills, auto-save indicator. Plan committed at `.claude/plans/misty-mixing-feather.md`. |
| Largest source files: `base-config/setup/page.tsx` (~4.7K LOC, ex-`settings/base-setup`), `parking/page.tsx` ~4.3K LOC, `infrastructure/page.tsx` ~4.2K LOC | Held | (Carryover) Component extraction explicitly multi-session. |
| Untracked `dark logo.jpg` (2.4MB) | Low | (Carryover) `/public` from a prior logo experiment. |
| Untracked `docs/DEMO_LOGINS.md` | Low | (Carryover) |
| Untracked `.claude/` | Low | (Carryover) Local Claude Code settings (gitignored expectation). |
| Trademark | Low | (Carryover) CDW holds live "GLIDEPATH" Class 42 (SaaS) registration. |
| Discrepancy "Notes History" backfill | Optional (carryover) | Historical rows still have `CURRENT_STATUS: <enum>` in the DB; display rewrites on render. |
| Sequential PPR coordination | Deferred (carryover) | All assigned agencies see their work in parallel; no ordering. |
| Public PPR form file uploads | Deferred (carryover) |  |
| "Advisories" → "WWA Notifications" UI sweep | Deferred (carryover) | Glossary memory says "WWA Notifications"; running app still says "Advisories". |
| ~124 `as any` casts project-wide | Low | (Carryover) |
| PDF boilerplate duplication in 11 generators | Low | (Carryover) 5 already on `pdf-utils.ts`. |
| Check draft real-time sync deferred | Low | (Carryover) Two users could create duplicate drafts. |

---

## Next session tasks

User explicitly bundled three pages for the multi-session arc:
`/training`, `/infrastructure` (Visual NAVAIDs), `/settings/base-setup`.
This session knocked out `/infrastructure` (page chrome + map InfoWindow
expansion) and Phase 1 of base-setup (the IA split into `/base-config`).
Remaining:

- **`/base-config` Phase 2 — wizard chrome refresh.** This is the
  headline next task. Plan already written at
  `.claude/plans/misty-mixing-feather.md`. Replace the numbered-circle
  step rail with a labeled stepper (status-keyed pills), add a
  persistent right-hand Guide panel per step (what / why / required /
  example / DAFMAN cite), inline `(?)` tooltips on every field, an
  auto-save indicator pill, and per-step status pills. Recommend the
  user pull a fresh round of screenshots after `npm run dev` lands the
  Phase 1 hub so the wizard visuals are fresh.
- **`/training`** (Glidepath Training) — needs a full content
  refresh per the user: "training will need to be updated significantly."
  Screenshots needed; user will provide. Still untouched.

### Long-running carryover (bandwidth-permitting)

Pick from these only when bandwidth allows or a customer asks:

- `/base-config` Phase 3 — first-run onboarding overlay + live preview
  pane on each wizard step. Deferred until Phase 2 lands.
- `audit-panel.tsx` per-row internal styling refresh (1.6K LOC).
- `/parking/page.tsx` component extraction (~4.6K LOC).
- Move `resolveEffectivePermissions` out of `lib/permissions.ts`
  (`'use client'`) into a shared module so `lib/permissions-server.ts`
  doesn't transitively re-arm the client-reference-stub bug.
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
0 new migrations this session.

Notable First Load JS (changed routes this session):
  /library                              146 kB / 292 kB    (no LOC delta on the route itself)
  /infrastructure                       34.4 kB / 217 kB   (-0.1 kB after token cleanup)
  /base-config                          7.42 kB / 179 kB   (NEW — hub)
  /base-config/setup                    44 kB / 241 kB     (was /settings/base-setup, identical)
  /base-config/modules                  5.05 kB / 176 kB   (was /settings/base-setup/modules)
  /base-config/templates                9.43 kB / 190 kB   (was /settings/templates)
  /base-config/diagram                  4.96 kB / 176 kB   (NEW — extracted from settings)
  /settings                             15.2 kB / 198 kB   (was 16.6 kB — Base Configuration expander removed)
  /settings/base-setup                  152 B / 91.3 kB    (redirect stub → /base-config/setup)
  /settings/base-setup/modules          152 B / 91.3 kB    (redirect stub → /base-config/modules)
  /settings/templates                   152 B / 91.3 kB    (redirect stub → /base-config/templates)

Largest static page (unchanged): /wildlife 458 kB / 793 kB.
Middleware: 74.5 kB.
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-05-01 (cont.) (this session) | `/library` structure-first refresh (cyan-tinted header, per-row cached/indexed rail, full token sweep). `/infrastructure` (Visual NAVAIDs) refresh: per-card top rail on LIGHTING STATUS keyed off tier, per-row left rail on Recent Activity, header / Edit Mode / Free Move / Audit Panel token sweep across 5 accent-color families, `tierColor + '40'`/`'60'` hex-alpha-concat footguns killed, `--color-cyan-bright` undefined-var bug fixed. Map InfoWindow edit dialog full token sweep + post-place dialog expanded from type-only to full edit form (Type / System+Component / Fixture ID / Rotation / Save) with carryover refs for sequential placement. Three follow-up commits to land InfoWindow spacing — root cause was three stacked width constraints (per-dialog `min-width`, per-click wrapper `max-width`, global `.gm-style-iw` `padding`); saved as `feedback_gmap_infowindow_widths.md`. Phase 1 of `/base-config` revamp: pulled admin work out of `/settings` into a new top-level sidebar entry, hub page with status-pill cards, redirect stubs at old `/settings/*` paths, airfield-diagram extracted to its own page. 6 commits on `main`, all pushed. |
| **Unreleased** | 2026-05-01 (prior) | Reports & Analytics structure-first sweep (6 pages). Parking left-rail toolbar through three iterations. Parking clearance lines anchor on ray-rectangle exit per side. /feedback staff view restructure. /library access bug fixes — Vercel `TypeError: u is not a function` traced to a `'use client'` transitive import; switched to the `user_has_permission` RPC directly. Migration `2026050100` locks `library:view` + `library:manage` to sys_admin only. 16 commits on `main`. |
| **Unreleased** | 2026-05-01 (prior) | Structure-first audit. 31 commits across 22+ surfaces. ACSI module sweep (7 commits), structural restructures of `/daily-reviews`, `/recent-activity`, `/wildlife` list+form, `/aircraft` list+detail, `/contractors`, `/discrepancies` list+detail. Tier 3 sweep: `/notams`, `/scn`, `/shift-checklist`, `/checks/history`, `/waivers`, `/obstructions`, `/ppr`, `/dashboard`, `/`, `/users`, `/more`. 6 real bugs fixed including the hex-alpha-concat silent-drops in `ActionButton`, `BWC chip`, `FREQ_COLORS`, KPI band; and the `obstructions` duplicate-`5.` Required Actions numbering. |
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

- `app/(app)/base-config/page.tsx` — admin hub, 2-col card grid, status pills, 3px left rail per card. Replaces the four gradient buttons inside the old Settings → BASE CONFIGURATION expander.
- `app/(app)/base-config/setup/page.tsx` — moved verbatim from `app/(app)/settings/base-setup/page.tsx` (~4.7K LOC, the wizard). Internal back-links retargeted to `/base-config`.
- `app/(app)/base-config/modules/page.tsx` — moved from `app/(app)/settings/base-setup/modules/page.tsx`.
- `app/(app)/base-config/templates/page.tsx` — moved from `app/(app)/settings/templates/page.tsx`.
- `app/(app)/base-config/diagram/page.tsx` — extracted airfield-diagram upload UI from the old `BaseConfigSectionContent`.
- `C:/Users/cspro/.claude/projects/C--Users-cspro/memory/feedback_gmap_infowindow_widths.md` — feedback memory: when editing dialogs inside `google.maps.InfoWindow`, audit per-dialog inline styles, the per-click `setContent` wrapper, and `.gm-style-iw` global overrides together. Indexed in `MEMORY.md`.

### Modified files

- `app/(app)/infrastructure/page.tsx` — header buttons (Import / Edit Mode / Audit Mode), LIGHTING STATUS pill, Edit Mode toolbar (purple/amber/cyan token sweep), Free Move save bar, Import Features modal, edit InfoWindow HTML string (token sweep), post-place InfoWindow expansion (full form + carryover refs + new `__savePlacedProps` global), `.gm-style-iw` global styles tokenized + edge-inset bumped, three-iteration spacing arc.
- `components/infrastructure/system-health-panel.tsx` — `TIER_COLORS` tokenized, per-card top rail, per-row Recent Activity rail, hex-alpha-concat footguns dropped, "16 INOP" pill recipe.
- `components/infrastructure/audit-panel.tsx` — `--color-cyan-bright` → `--color-cyan` fix, "Generate All Fixture IDs" button color-mix on `--color-purple`.
- `lib/supabase/infrastructure-features.ts` — `createInfrastructureFeature()` input now accepts optional `system_component_id` + `rotation`.
- `components/PDFLibrary.tsx` — full structural refresh: header, status pill, toolbar, list-row rail, viewer toolbar, token sweep.
- `app/(app)/settings/page.tsx` — BASE CONFIGURATION expander + entire `BaseConfigSectionContent` function (~175 LOC) removed; tree-shook `Wrench` icon import + `airfield-diagram` lib import.
- `app/(app)/settings/base-setup/page.tsx`, `app/(app)/settings/base-setup/modules/page.tsx`, `app/(app)/settings/templates/page.tsx` — all replaced with 152-byte `next/navigation` `redirect('/base-config/...')` stubs.
- `lib/sidebar-config.ts` — `/base-config` added to `ALL_NAV_ITEMS` + the Admin section in `DEFAULT_SIDEBAR_CONFIG`.
- `components/layout/sidebar-nav.tsx` — `SlidersHorizontal` icon imported + registered in `ICON_MAP`; `/base-config` → `'base_setup:write'` added to `HREF_TO_VIEW_PERM`.

### Reference files (read-only)

- `lib/modules-config.ts` — `isWizardStepEnabled`, `isStepDone`, `WizardStepKey` (used by hub status indicators).
- `lib/airfield-diagram.ts` — `getAirfieldDiagram` (used by hub + new diagram page).
- `lib/supabase/inspection-templates.ts` — `fetchInspectionTemplate` (used by hub for template item counts).

### Environment changes

None this session.

---

*All 6 commits this session are on the `main` branch and pushed to
`origin/main`. No migrations applied. No version bump. Untracked files
(`.claude/`, `docs/DEMO_LOGINS.md`, `public/dark logo.jpg`) remain
carryover.*
