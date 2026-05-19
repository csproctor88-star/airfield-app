# Session Handoff

**Date:** 2026-05-19
**Branch:** `feat/alternate-map-provider` (not merged to `main`)
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓, `npx vitest run` ✓ (253 pass)
**HEAD:** `ec4a00a` (origin/feat/alternate-map-provider)

---

## What shipped this session

Two parallel arcs. The headline is **per-base alternate satellite tile
provider** for OCONUS bases where Google Maps blurs the airfield under
host-nation imagery policy (Ramstein, Spangdahlem, Kleine Brogel). The
renderer stays Google Maps JS API everywhere — only the imagery layer
swaps via `google.maps.ImageMapType`. The secondary arc is a sweeping
**"Use My Location" unification** that replaced five visual variants
across the app with a single shared component and added the same
overlay chip to three more maps (discrepancies COP, Visual NAVAIDs,
Obstruction Evaluation). Plus one small PPR ergonomic — AMOPS gets
CC'd on every outbound automated PPR email — and the v2.34 capabilities
brief in markdown + docx.

### Alternate map provider — schema, toggle, pilot (`47d32a1`)

USAF bases in Germany and parts of Belgium / Netherlands appear
blurred in Google Maps satellite imagery. Switching the entire JS SDK
isn't viable — the Air Force network reliably throttles WebGL-heavy
vector renderers like Mapbox / MapLibre enough that they're laggy and
choppy on AF-side clients (this is why the wildlife BASH heatmap is
the only Mapbox surface in the platform; CLAUDE.md pins the constraint).
The pragmatic move was to keep Google Maps JS as the renderer and
override only the satellite tile layer.

The planning conversation walked through three rejected providers
before landing on Bing:
- **Mapbox / MapLibre** rejected on the AF-network performance
  constraint above.
- **MapTiler Satellite** rejected after the user verified empirically
  that it's also blurred at a Belgian base (screenshot at
  `docs/Screenshots/Screenshot 2026-05-19 074646.png`).
- **Bing Maps Aerial** confirmed clear at the same Belgian base by the
  user; per the Wikipedia + OSM record, Bing complied with German
  censorship in 2012 but doesn't appear to have extended that to
  Belgium / Netherlands. The 2024 Microsoft retirement of Bing Maps
  for Enterprise (EOL 2028-06-30) is a real concern but doesn't block
  pilot use today.

Shipped:
- Migration `2026051900_bases_map_provider.sql` adds the column with a
  CHECK constraint of `('google', 'bing', 'esri')`. **Applied manually
  by the user**, not via the empty migration tracker.
- `lib/map-providers.ts` — `applyMapProvider(gmap, provider)` helper
  + per-provider `ImageMapType` factory. Bing uses its quadkey tile
  scheme (not standard XYZ); Esri uses standard XYZ. The same
  `validReplyTo`-style guard pattern wasn't needed here — provider
  is enum-locked at the DB.
- `lib/installation-context.tsx` exposes `mapProvider` on
  `useInstallation()` so callers don't have to null-check.
- Base setup wizard step 1 (Runways) gets a Map Imagery radio group
  beneath Established Airfield Elevation with inline help copy
  referencing typically-affected bases.
- `next.config.js` adds Workbox runtime caching for the Bing tile
  hosts (`ecn.t[0-3].tiles.virtualearth.net`); Esri caching was
  already wired from a prior session.
- `.env.example` slot for `NEXT_PUBLIC_BING_MAPS_KEY`. User provisioned
  the key into both `.env.local` and Vercel mid-session.
- Pilot wiring on `/infrastructure`: one `applyMapProvider(gmap, mapProvider)`
  call after map init, plus `mapProvider` added to the useEffect deps
  so the map re-inits cleanly when the toggle flips.

### Map provider rolled out to every remaining map (`0b36ef8`)

Once the pilot proved out on `/infrastructure` (user verified Bing
tiles on a Belgian base — screenshot
`docs/Screenshots/Screenshot 2026-05-19 082921.png`), they noticed the
Obstruction Evaluation map still showed blurred Google imagery
(`Screenshot 2026-05-19 082902.png`). Rather than wire one-off, swept
the same single-line `applyMapProvider(gmap, mapProvider)` addition to
every other Google Maps init in the app: `/parking` (including the
html2canvas capture pipeline, where the alternate tile source rides on
top of the existing warm-up + `position: fixed` resize trick with no
other changes), the obstructions main map + history, the
discrepancies + waivers + ACSI pin maps, the taxiway editor in base
setup, the runway-coords adjust dialog, the generic location picker,
and the infrastructure feature picker. 10 files, each a 3–4 line
change.

### Use My Location button — added, then unified (`45454ce`, `b0a8898`, `9f165a9`)

Three-commit arc. The user asked for a "Use My Location" overlay on
the discrepancies map COP so AFMs can see themselves relative to open
work items — added that first as a top-right cyan chip with a dot +
GPS accuracy ring (`45454ce`).

Then the user asked for visual consistency across all the Use My
Location buttons in the app. Audited 13 occurrences spanning two
contexts:
- **Map-overlay buttons** (small floating chip on the map viewport)
- **Form-companion buttons** (full-width pill next to a coords input)

Five visual variants had drifted across the codebase (border-token
grey, accent-token, custom SVG crosshairs vs lucide Crosshair, varied
loading labels). Extracted one shared `<UseMyLocationButton>` in
`components/ui/use-my-location-button.tsx` with two variants
(`overlay`, `inline`) — the component owns `getCurrentPosition` +
error toasts + loading label; callers pass `onLocation` and optionally
`onClear` (for the overlay toggle). Swapped 6 call sites onto it
(`b0a8898`). Net –144 LOC.

Two intentional carve-outs:
- `components/ui/simple-discrepancy-panel` (checks/inspections per-
  index GPS) keeps its own button because the parent owns per-index
  loading state — but the visual styling matches the canonical inline
  variant pixel-for-pixel. Comment in the file explains why.
- Wildlife sighting/strike forms keep their success/danger toggle
  styling — the colored "acquired" state is intentional ops UX
  (green for sightings, red for strikes), not styling drift.

The user then pointed out that the Visual NAVAIDs and Obstruction
Evaluation maps still didn't have the overlay chip
(`Screenshot 2026-05-19 115613.png` + `115639.png`). Added it to both
(`9f165a9`):
- Visual NAVAIDs: restyled the existing icon-only `◎` tracking button
  into the same cyan overlay chip with Crosshair + label. **Kept the
  watchPosition continuous-track behavior** since that's actually more
  useful than one-shot getCurrentPosition for walking the airfield —
  only the trigger button visual changed.
- Obstructions: new overlay chip in the existing top-right column
  under the Ruler button. Purely informational (drops a cyan dot +
  accuracy ring), completely separate from the existing inline sidebar
  button that sets the evaluation point.

### PPR AMOPS courtesy-copy (`63916ac`)

The user noticed automated PPR emails (approval, denial, confirmation,
cancellation, coordination-request) were being sent with the base's
`amops_email` as reply-to but AMOPS wasn't actually getting copies.
Added `cc: replyTo ? [replyTo] : undefined` to all five Resend
`emails.send` calls. The existing `validReplyTo()` guard already
filters malformed addresses for the reply-to; same value is now used
for CC, so a typo in `bases.amops_email` won't kill the send. Five
files, one line each.

### v2.34 capabilities brief (`ec4a00a`)

User asked for an updated capabilities brief (the v2.32 reference doc
was a year stale) plus a Word export. Refreshed the entire 1000+ line
document to reflect current state — released v2.33 work (PPR module,
Daily Reviews, offline write queue, permission matrix, Glidepath
Training rebuilt as role-filterable hub) plus this branch's unreleased
v2.34 work (alternate map provider, unified Use My Location, PPR
AMOPS CC, QRC create-from-scratch + per-base review interval, parking
PDF capture rebuild, Events Log structure-first refresh). The user
explicitly directed:
- Use "Review" terminology (keep, even though the DB enum is still
  `pending_amops_triage`).
- Don't include hard counts of PDF generators or permission keys —
  describe the capability instead.
- Call it v2.34 with the understanding that a v2.34 app release will
  follow.
- Remove the two speculative roadmap items (Azure Maps migration,
  NGA Mosaic) — "the maps are set how they are going to be going
  forward."

Markdown is the source of truth; pandoc produced the `.docx` with a
3-level TOC for Word distribution.

---

## Migrations status

| Migration | Status | What it does |
|---|---|---|
| `2026051900_bases_map_provider.sql` | **Applied** (manually by user) | Adds `bases.map_provider` TEXT NOT NULL DEFAULT 'google' with CHECK constraint `('google', 'bing', 'esri')`. |

No other migrations this session.

---

## Bugs fixed during the session

(Nothing surprising — this session was net-new feature work, not bug
hunts. The closest thing was the AMOPS-CC realization, but that's a
capability gap rather than a bug.)

---

## Lessons from this session

- **WebGL-heavy renderers (Mapbox / MapLibre) are off the table on
  the AF network.** Saved as feedback memory
  `feedback_no_mapbox_for_interactive_maps.md` so future sessions
  don't re-propose the same migration. The acceptable swap is the
  raster satellite tile layer underneath Google Maps JS via
  `google.maps.ImageMapType` — change the imagery, keep the SDK.
- **Provider redaction is country-specific and inconsistent.** No
  single public satellite provider works for every OCONUS USAF base.
  MapTiler is blurred in Belgium where Bing is clear; Bing is blurred
  in Germany where Esri may or may not be. The per-base toggle is
  the right design because the matrix isn't predictable — admins
  pick what's clear at their base.
- **Audit before refactor.** The Use My Location unification only
  worked because the Explore-agent audit surfaced all 13 occurrences
  upfront. Skipping that step would have left at least two variants
  (wildlife sighting/strike) accidentally caught up in the sweep when
  they should have been intentionally preserved. The audit also
  surfaced the per-index GPS pattern in simple-discrepancy-panel
  that needed a different treatment.
- **Match map-overlay placement to existing patterns, not a global
  convention.** The discrepancies overlay went top-right because the
  legend was top-left. Visual NAVAIDs had to keep top-left because
  the top-right was already busy with action buttons; obstructions
  fit naturally below the existing Ruler button. Forcing a single
  position would have made the doc consistent but the UX worse.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| **AF-network performance check on Bing tiles is unverified** | Medium | Single most important pre-ship validation for the alternate provider work. Bing's CDN is global so it *should* be snappy on the AF network, but the whole reason we're not on Mapbox is that AF-network behavior surprised us once before. Pick a representative OCONUS base + connection and confirm `/infrastructure` and `/parking` stay interactive. |
| **Branch not merged to main** | Medium | `feat/alternate-map-provider` has 7 commits ahead of main. Open a PR or fast-forward when verification clears. |
| Mobile parking PDF export not verified end-to-end | Low–Medium | (Carryover from prior session.) Desktop is solid. |
| **PPR "triage" identifiers still in code + DB** | Medium | (Carryover.) Display strings are clean ("Review" everywhere; the capabilities brief uses "Review" throughout) but DB enum `pending_amops_triage`, columns `triaged_by` / `triaged_at`, permission key `ppr:triage`, function `triagePprEntry`, constants like `PPR_TRIAGE`, and ~25 comments still use "triage". Full rename = 1 migration + ~25 file edits. |
| Backup feature plan parked | Low | (Carryover.) Full plan at `docs/Backup_And_Data_Export_Plan.md`. 8–11 sessions total. |
| Standalone mobile app plan exists in conversation | Low | (Carryover.) React Native + Expo extraction sketched but not parked. |
| Supabase migration tracker empty for the entire project | Medium | (Carryover.) Per-migration applies via manual `db query --linked --file`. Eventual cleanup is a `migration repair --status applied <ts>` sweep. |
| Sidebar + `/more` parallel hardcoded module lists | Low | (Carryover.) |
| `lib/tours/pages/*.ts` still present | Low | (Carryover.) 28 files retained as content seed, no imports. |
| `data-tour` anchors throughout `page.tsx` files | Low | (Carryover.) 70+ unused. |
| `/training` Quick Start + Base Setup tabs use stub content | Medium | (Carryover.) |
| FAQ entries on every module are empty | Low | (Carryover.) |
| `lib/permissions-server.ts` imports `resolveEffectivePermissions` from `'use client'` module | Medium | (Carryover.) Move to a shared module. |
| `audit-panel.tsx` per-row internal styling | Low | (Carryover.) 1.6K LOC. |
| `/infrastructure` perf | Low–Medium | (Carryover.) AdvancedMarkerElement migration target. |
| Largest source files | Held | `parking/page.tsx` ~4.8K LOC, `base-config/setup/page.tsx` ~4.8K LOC (grew this session by the Map Imagery toggle), `infrastructure/page.tsx` ~4.1K LOC. |
| Untracked carryover files | Low | `.claude/`, `docs/Backup_And_Data_Export_Plan.md`, `docs/DEMO_LOGINS.md`, `docs/base-setup-guide-review.md`, `docs/training-modules-review.md`, `public/glidepath-logo-dark.jpg`. |
| ~124 `as any` casts | Low | (Carryover.) |
| Check draft real-time sync deferred | Low | (Carryover.) |
| "Advisories" → "WWA Notifications" UI sweep | Deferred | (Carryover.) |
| Trademark | Held | CDW holds "GLIDEPATH" Class 42 (SaaS) registration. |

---

## Next session tasks

The most important pre-ship step is the **AF-network performance
verification** of the Bing tile path. Get an OCONUS user with a
Belgian / German base + a representative AF-network connection to
load `/infrastructure` and `/parking` with `map_provider = 'bing'`
and confirm interactions stay snappy. That's the load-bearing test
for the whole alternate-provider effort — the entire reason we
weren't allowed to migrate to Mapbox.

Once that clears:
- **Open a PR** (or fast-forward merge) for `feat/alternate-map-provider`
  → `main`. The branch has 7 commits and is build-clean.
- **Bump to v2.34** if you want to ship this as a tagged release. Five
  places: `package.json`, `app/(app)/settings/page.tsx` (About),
  `app/(public)/login/page.tsx` (footer), `CHANGELOG.md`, `README.md`,
  plus a new entry in `lib/release-notes.ts`.

No required next step beyond the verification + merge. Open candidates,
none blocking:

- **Verify Bing imagery at a German installation** (Ramstein,
  Spangdahlem). If Bing is also blurred there per the 2012 BKG
  arrangement, the German bases would need to fall back to Esri —
  whose status at those bases is unverified.
- **Full Triage → Review code + DB rename** (carryover). 1 migration
  + ~25 file edits. The capabilities brief now publicly uses
  "Review"; the code drift is more visible.
- **Manual backup feature** Phase 1 from
  `docs/Backup_And_Data_Export_Plan.md` (carryover).
- **Sidebar / `/more` shared config refactor** (carryover).

### Long-running carryover (bandwidth-permitting)

- Sweep `lib/tours/pages/*.ts` and dead `data-tour` attributes.
- Move `resolveEffectivePermissions` out of `lib/permissions.ts` into
  a shared module.
- Component extraction in `parking/page.tsx` (~4.8K LOC).
- Component extraction in `base-config/setup/page.tsx` (~4.8K LOC).
- `audit-panel.tsx` per-row styling refresh (1.6K LOC).
- "Advisories" → "WWA Notifications" UI sweep.
- Outage analytics, training management, Part 139 civilian template.
- CAC/PIV authentication (blocked on Platform One).
- Supabase migration tracker repair sweep.

---

## Build snapshot

```
TypeScript clean (npx tsc --noEmit exit 0)
Tests: 253 pass / 25 files
Build: npm run build clean — no warnings, no errors.
One new migration this session (applied manually).

Notable First Load JS (changed routes this session):
  /base-config/setup    66.8 kB / 270 kB   (+0.4 kB — Map Imagery toggle)
  /infrastructure       36.9 kB / 221 kB   (applyMapProvider hook)
  /parking              47.6 kB / 421 kB   (applyMapProvider hook)
  /obstructions         18.2 kB / 184 kB   (overlay chip + applyMapProvider)
  /obstructions/[id]    13.7 kB / 332 kB   (applyMapProvider)
  /discrepancies        12.1 kB / 229 kB   (overlay chip + applyMapProvider)
  /discrepancies/new     9.49 kB / 188 kB   (shared button refactor)
  /waivers/[id]/edit    10.2 kB / 194 kB   (shared button refactor)
  /waivers/new          11.3 kB / 187 kB   (shared button refactor)

Largest static page (unchanged): /wildlife 459 kB / 795 kB.
Middleware: 74.5 kB.
Shared by all: 91.2 kB.
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | — | **Alternate satellite tile provider per base** for OCONUS bases where Google blurs the airfield (Bing Maps Aerial or Esri World Imagery via `google.maps.ImageMapType`, with the Google Maps JS SDK retained everywhere because the AF network throttles WebGL-heavy renderers). Unified **Use My Location** across every map and form — one shared component with overlay (chip) and inline (full-width) variants; overlay chip now on /discrepancies, /infrastructure, and Obstruction Evaluation. **AMOPS courtesy-copied** on every automated PPR email (approval, denial, confirmation, cancellation, coordination-request) using the existing `validReplyTo` guard. v2.34 **capabilities brief** in markdown + docx. Plus prior unreleased: parking PDF capture rebuild on the warm-up + resize-trick foundation (multi-apron Add Apron, WYSIWYG capture-frame overlay, Mercator icon scale, tilt locked at 0, HHmm filename), QRC create-from-scratch editor + per-base review interval (Monthly / Quarterly), parking heading slider perf overhaul + `NumberField` for typing without glitches, edit-plan-details dialog, map-on-own-page parking PDF layout, full /training content sync + readability refresh. |
| 2.33.0 | 2026-05-02 | Glidepath Training rebuilt at /training as role-filterable hub + per-module deep-dive subpages; PPR module; Daily Reviews; offline write queue + Workbox runtime caching; permission matrix overhaul + 3 new roles; Events Log structure-first refresh; auth fix for invite/signup/reset emails landing on correct screen; forgot-password sends branded email. |
| v2.32.0 | 2026-04-21 | Modular Onboarding, SCN, Close-for-Day, What's New modal |
| v2.31.0 | 2026-04-07 | Full Google Maps migration, Custom Status Boards, PPR Log |
| v2.30.0 | 2026-04-14 | Daily Reviews + shift sign-off, ARFF status log, Vitest scaffold |

See `CHANGELOG.md` for full history.

---

## Key docs / files touched this session

### New files

- `lib/map-providers.ts` — `MapProvider` type, `applyMapProvider(gmap, provider)`,
  per-provider `ImageMapType` factory (Bing quadkey, Esri XYZ), display
  labels + descriptions for the setup wizard.
- `components/ui/use-my-location-button.tsx` — shared button with
  `overlay` and `inline` variants. Owns getCurrentPosition + error
  toasts + loading label.
- `supabase/migrations/2026051900_bases_map_provider.sql` — adds the
  per-base column. Applied manually.
- `docs/Glidepath_Capabilities_v2.34.md` + `.docx` — refreshed
  capabilities brief.

### Modified files

- `lib/installation-context.tsx` — exposes `mapProvider` on
  `useInstallation()`.
- `lib/supabase/types.ts` — `map_provider` on `bases` Row / Insert / Update.
- `app/(app)/base-config/setup/page.tsx` — Map Imagery radio group in
  the Runways step + `applyMapProvider` on the runway-coords adjust
  dialog.
- `app/(app)/infrastructure/page.tsx` — `applyMapProvider` on map
  init + the existing `◎` tracking toggle restyled to the canonical
  cyan overlay chip (watch behavior preserved).
- `app/(app)/parking/page.tsx` — `applyMapProvider` on map init.
- `app/(app)/obstructions/page.tsx` — swapped inline `useMyLocation`
  callback for the shared component.
- `app/(app)/discrepancies/new/page.tsx`, `app/(app)/waivers/new/page.tsx`,
  `app/(app)/waivers/[id]/edit/page.tsx` — shared button refactor.
- `app/api/send-ppr-approval/route.ts`, `denial`, `confirmation`,
  `cancellation`, `coordination-request` — AMOPS CC one-line.
- `components/discrepancies/discrepancy-map-view-google.tsx` — overlay
  chip, user-location marker + accuracy circle, marker cleanup on
  map teardown.
- `components/discrepancies/modals.tsx` — shared button refactor.
- `components/obstructions/airfield-map-google.tsx` — overlay chip +
  user-location marker (separate from the inline sidebar button).
- `components/obstructions/obstruction-map-view-google.tsx`,
  `components/acsi/acsi-location-map-google.tsx`,
  `components/taxiway-editor-google.tsx`,
  `components/ui/location-picker-map-google.tsx`,
  `components/ui/infrastructure-feature-picker-google.tsx`,
  `components/waivers/waiver-map-view-google.tsx` —
  one-line `applyMapProvider` addition per file.
- `components/ui/simple-discrepancy-panel.tsx` — visual styling
  matched to the shared inline variant; behavior unchanged.
- `next.config.js` — Bing tile Workbox runtime caching.
- `.env.example` — `NEXT_PUBLIC_BING_MAPS_KEY` slot.

### Environment changes

- `NEXT_PUBLIC_BING_MAPS_KEY` added to local `.env.local` and Vercel
  by the user mid-session.

---

*7 commits this session pushed to `origin/feat/alternate-map-provider`:
`47d32a1` through `ec4a00a`. Branch not yet merged to `main`. One new
migration (`2026051900_bases_map_provider.sql`) applied manually.
Untracked carryover files unchanged.*
