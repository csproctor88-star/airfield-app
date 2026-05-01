# Session Handoff

**Date:** 2026-04-30
**Branch:** `main`
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓, `npx vitest run` ✓ (253 pass)
**HEAD:** `1e9dd83` (28 commits ahead of `origin/main` — not pushed)

---

## What shipped this session

Two distinct workstreams. **Tier 1 of the audit-derived refresh
backlog landed cleanly** in three commits at the start —
`/login`, the paired `/reset-password` + `/setup-account` auth
forms, and the public `/feedback/[baseId]` QR form are now on the
distinctive design language. The second 25 commits were a
**user-driven deep pass on the Aircraft Parking module** — panel
restructure, Vector Maps migration for interactive rotation,
auto-numbering bug fix, and a thorough accessibility/contrast
sweep. The parking work was triggered by user screenshots flagging
specific visual and ergonomic friction; each commit is tightly
scoped and the diffs are small.

The session also closed two pre-existing latent bugs (the `/scn`
hex-alpha pattern repeated in parking, and `--color-text-primary`
being referenced without ever being defined) and validated the
Vector Maps mapId path end-to-end with the user's own Cloud Console
setup. **A two-commit detour into a left-rail layout was reverted**
when the user confirmed the floating panel is the right call —
rejecting the rail and keeping the map full-width.

### Tier 1 — public auth + feedback refresh (3 commits)

`760e0ca` `/login` — outline-pill recipe applied to error/success
alerts, dropdown hover, HTML-entity arrow → Lucide ArrowLeft.
`btn-primary` left alone (already token-based and used by every
refreshed page). The handoff's "filled-cyan + white text" callout
turned out to refer to the feedback form's inline-hex gradient, not
login.

`5bc61c0` `/reset-password` + `/setup-account` bundled — identical
shape, identical edits. Icon-box hex gradient → token-based accent
gradient. rgba alerts → color-mix on `--color-success` /
`--color-danger`. Auth flow (`PASSWORD_RECOVERY` listener,
`profile.status` pending → active) untouched.

`596290c` `/feedback/[baseId]` — heaviest of Tier 1. ~12 hex
literals → tokens, GLIDEPATH header text → wordmark gradient,
`&#10003;` checkmark → Lucide `CheckCircle2`, star glyphs → Lucide
`Star` with `fill` toggling, gradient submit button → `btn-primary`,
outlined-pill recipe on rating + yes/no buttons. Light section
dividers ("About You" / "Your Feedback") added inside the existing
card — no nested cards, mobile-friendly. Rate-limit + custom-field
config preserved.

### Parking polish — layout + tokens + buttons + list (4 commits, planned)

`0c49a6f` + `fa29b30` + `771bc0e` (REVERTED ARC) — Tried a left-rail
desktop layout with a 380→280px width and a drag-resize handle.
User came back: "the map keeps its full width" was the right call.
Reverted to the floating overlay panel.

`fe2fb13` floating panel got drag-resize handles instead — left
edge for width, bottom edge for height, bottom-left corner for both.
Width 260–640, height 240px to viewport-60px. Persists to
`localStorage` as `glidepath_parking_panel_width` /
`_height`. Map tiles refresh on mouseup. Defaults 344 / null
(content-driven up to `calc(100vh - 140px)`).

`320e626` token aliases + color-mix migration — the C5 commit. Two
real bugs cleared: `--color-text-primary` and
`--color-text-secondary` were referenced ~30 times in
`parking/page.tsx` but never defined in `globals.css` (browser
fallback was masking it). Added aliases pointing to `-text-1` and
`-text-2`. Plus added `--color-violet` (`#8B5CF6` / `#6D28D9`) for
peripheral-taxilane styling. Then converted ~60 `${color}NN`
hex-alpha-concat patterns to `color-mix(in srgb, ... N%,
transparent)` — same footgun that hit `/scn` last session. Inline
JSX hex literals `'#A855F7'`, `'#22D3EE'`, `'#3B82F6'` swapped to
`var()` tokens; ADG_COLORS / STATUS_COLORS lookup tables and
Google Maps API args (`fillColor` / `strokeColor`) stay as hex
because those consumers don't read CSS variables.

`6140f64` action bar consistency + 3-dot overflow menu — the four
inconsistently-styled buttons (Set Active filled green / Duplicate
text-link / Save as Template filled purple / Delete filled red)
restructured to: Set Active (filled-green primary, only when
`!is_active && !is_template`), Duplicate (outlined-pill cyan), and
a Lucide `MoreVertical` button that pops a small floating menu
holding Save as Template (Convert to Plan) and Delete plan.
Click-outside closes via full-screen invisible overlay at zIndex 14.

`cfdfbbd` aircraft list hierarchy + auto-numbering bug fix — the
C7 commit. Group headers (e.g. "C-130E/H Hercules") promoted to
tertiary section header tier (uppercase, top border, cyan-tinted
bottom rule, ADG badge bumped to fontWeight 700, count badge moved
to flex-end). "All N hdg" sub-control de-emphasized (transparent
bg, uppercase 2xs label, opacity 0.85). Expanded spot rows now
have 3px cyan left rule + cyan tinted bg (was just bg-color shift).
Multi-select rows: 3px purple rule + purple tint. Tab counts
unified to cyan everywhere; `--color-danger` and `--color-warning`
reserved for the Clearance tab when there are actual
violations/warnings.

The auto-numbering bug — "I placed 4 C-130s and they're all named
#1" — turned out to be a stale-closure issue. The Google Maps
click listener at the parking page's main `useEffect` doesn't have
`spots` in its deps array. The handler was reading `spots` from
the closure captured at registration time, so each rapid click saw
`existingCount = 0` and minted "C-130E/H Hercules #1" again. Fix:
introduced `spotsRef` (mirrors the existing `selectedSpotIdsRef`
pattern at line 393), kept in sync on every render. The handler
reads `spotsRef.current`, parses existing `#N` suffixes, and
takes `max(...) + 1` — so deletes don't reuse numbers either.

### Parking polish — refinement passes (3 commits)

`543d4ef` Finish buttons in placement bar lost contrast in light
mode — `color: var(--color-text-1)` resolves to `#0F172A` (near
black) in light mode, on top of dark-color backgrounds
(`--color-success`, `--color-status-inwork`, `--color-purple`).
Black on dark-green/dark-blue is unreadable. Hardcoded `#fff` +
fontWeight 700 on the taxilane and boundary Finish buttons —
white-on-dark-color reads in both modes. Orange line-obstacle
button stays on `#000` (orange is bright enough that black reads).

`af656b5` spot-name tooltip moved from the inner `<span>` to the
row `<div>`. The native `title` attribute on the span wasn't firing
reliably under the parent `cursor: pointer + onClick` container —
browsers can be picky about title-attr discovery inside an
interactive region. Title on the `<div>` fires anywhere on the row.

`cef6e28` floating tool toolbar — three changes the user flagged:
single "Taxilane" button → "+ Interior Taxilane" (blue) and
"+ Peripheral Taxilane" (violet); the "Locked/Unlocked" button —
which actually only toggled `planLocked` (aircraft) — split into
"AC Locked/Unlocked" (red/green) and "OB Locked/Unlocked"
(orange/green). Also moved from `top: 10, left: 50%` to
`top: 50, left: 10` — but this turned out to put it where the user
wanted the PANEL to live, so it was reverted in `c4f7ede`.

### Parking polish — panel + toolbar reposition (3 commits, intent-correction arc)

`e141845` floating panel anchored top-left under the controls
toolbar (was top-right). Resize handles flipped to match new
anchor: right edge for width (drag right widens), bottom-right
corner. Cursor `nesw-resize` → `nwse-resize`.

`c4f7ede` floating tool toolbar back to its original top-center
position. The earlier move to top-left was made under the
assumption the user wanted the toolbar there, but they actually
wanted the panel there. Now panel is top-left, toolbar is top-center
— no overlap because they're conditional on opposite states
(panel shown when `!sidebarCollapsed`, toolbar shown when
`sidebarCollapsed`).

### Parking — gestureHandling + map rotation (5 commits)

`858f294` Box Select cleanup restored `gestureHandling: 'auto'`
after the box-select effect tore down — but the parking map's
default is `'greedy'`. Once a user toggled Box Select on/off
*ever*, the map permanently switched to cooperative mode (Ctrl+drag
to pan). One-character fix: `'auto'` → `'greedy'`. Sneaky bug.

`bcd26fe` Added Rotate / Tilt / Reset toolbar buttons (Lucide
`RotateCw` / `Triangle` / `RefreshCw`) — programmatic
`setHeading()` / `setTilt()` calls. These work on raster satellite,
so they were a stopgap before the Vector Maps wire-up.

`82d9ccf` Vector Maps mapId — the user added a Map ID to
`.env.local` after I explained that Google Maps raster satellite
doesn't support interactive heading rotation. Wired
`mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_VECTOR_MAP_ID` into the
parking-only map options. Falls back to raster cleanly if unset
(CI / demo deploys).

`5da8bb4` + `cb04552` custom Ctrl+drag heading + tilt handler.
`gestureHandling: 'greedy'` suppresses Vector Maps' built-in
rotation gesture, so we implement it explicitly: hold Ctrl (or
Shift) and drag horizontally → rotate; vertical → tilt (clamped
0–67°). 2px/° horizontal, 4px/° vertical. The first version was
choppy; `cb04552` switched to `gmap.moveCamera({heading, tilt})`
(unified vector-camera API, single render pass) and rAF-throttled
the updates so we coalesce mousemoves to one map update per paint
frame. Smooth.

### Parking — projection + icon counter-rotation (3 commits)

`f6246fd` `pixelToLatLng` in `lib/google-map-adapter.ts` was using
`getBounds()` + linear interpolation between NE and SW corners.
Correct only on a north-up flat map. Once the map rotates, the
bounds rectangle expands to include the rotated viewport, so any
click coord translates to a lat/lng that's way off — broke aircraft
drag, box-select, anything that crossed the pixel↔latlng boundary.
Fix: attach a hidden `google.maps.OverlayView` to the wrapper at
construction (no DOM rendering, all noop methods). Use its
`MapCanvasProjection.fromContainerPixelToLatLng()` — the official
heading + tilt-aware conversion. Bounds-rectangle interpolation
remains as fallback for the first frame before the overlay draws.

`ae3d938` aircraft icon counter-rotation. User wants aircraft
heading to read screen-fixed (a "West" aircraft always points the
same screen direction regardless of map rotation). Rotated map
content was making icons visually rotate WITH the map even though
the underlying `heading_deg` was unchanged. Fix: track gmap heading
via `heading_changed` listener into `mapHeadingDeg` state (rounded
to 0.5° to suppress jitter). Canvas pre-rotation becomes
`(spot.heading_deg - mapHeadingDeg + 360) % 360`. Vector Map's
content rotation adds `mapHeadingDeg` back, netting `heading_deg`
— icon's apparent rotation stays equal to the aircraft's compass
heading. Cache key includes effective heading; the position-only
fast-path also reads effective heading so map rotation correctly
invalidates the cache. **Performance note**: regenerates ~30+ icons
on every heading change. Smooth on developer laptop; could stutter
on weaker machines. Migration to `AdvancedMarkerElement` with CSS
transforms is the next step if it bites.

`916d02b` ruler had its OWN `pixelToLatLng` — same bounds-rectangle
approach as the adapter version. Same fix: hook owns its own
hidden OverlayView (created on activate, torn down on deactivate)
and uses it for projection. Wrapper-based version isn't accessible
because the hook only receives a gmap ref, not the wrapper.

### Parking — final polish (4 commits)

`dcf86e3` removed the manual Rotate / Tilt / Reset toolbar buttons.
Ctrl+drag (desktop) and two-finger gesture (mobile, native Vector
Maps support) cover both axes; the buttons were redundant and
covering the placement-tool toolbar.

`73ce3da` floating tool toolbar contrast in dark mode. Background
was `--color-bg-surface` = `rgba(15,23,42,0.92)` — 8% of the
satellite map bled through, hurting overall contrast. Switched to
`--color-bg-surface-solid` (fully opaque). Inactive obstacle-type
buttons (Point / Building / Line / Circle) had transparent bg + dim
secondary-text + faint border — three layers of dim. Now:
`--color-bg-inset` bg + `--color-border-mid` + `--color-text-1` +
fontWeight 600. Reads clearly.

`78c560f` Interior / Peripheral Taxilane / Boundary buttons —
tinted-bg + colored-text recipe works for cyan but blue/violet/green
text was reading too dim against the dark toolbar. Switched all
three to filled-color bg + `#fff` text + fontWeight 700. The colors
are dark enough in BOTH modes (light: `#2563EB`, `#6D28D9`,
`#15803D`) that white text reads cleanly. Color identity comes
through the fill instead of text.

`fea9e16` + `1e9dd83` empty-state hint padding sweep. All five
empty-state `<p>` messages in the panel were on `padding: '4px 0'`
— zero horizontal padding, text ran into the panel edge. Switched
to `padding: '6px 12px'` + `lineHeight: 1.5`. Covers Aircraft tab
(no plan, empty plan), Environment tab (no obstacles, no
taxilanes/boundaries), Clearance tab (no checks).

---

## Migrations status

No new migrations this session. Migration `2026042907` from the
2026-04-29 session is still the latest applied to prod.

| Migration | Status | What it does |
|---|---|---|
| `2026042907_add_construction_other_check_types.sql` | ✅ Applied | (carryover) DROP + ADD `airfield_checks_check_type_check` to allow `'construction'` and `'other'`. |
| `2026042906_drop_ppr_arrival_eta_zulu.sql` | ✅ Applied | (carryover) Drops `ppr_entries.arrival_eta_zulu` + recreates `submit_public_ppr_request` RPC. |

---

## Bugs fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| `/scn` AgencyRow active state was broken (carryover-style — pattern repeated in parking) | `${color}NN` hex-alpha concat. Worked for hex literals, silently broke once values became `var(--color-X)` — invalid CSS, no console warning. Migrated all ~60 such patterns in parking to `color-mix()`. | `320e626` |
| Auto-numbering placed 4 C-130s as "#1" four times | Click listener at the main parking `useEffect` doesn't have `spots` in deps. Closure captured `spots` stale; rapid placement saw `existingCount = 0` each time. Fix: `spotsRef` updated on every render; handler reads via ref + parses existing `#N` suffixes for `max+1`. | `cfdfbbd` |
| `--color-text-primary` and `--color-text-secondary` had no defined value despite ~30 references in `parking/page.tsx`. Browser was rendering with inherited / default colors, masking the bug. | The tokens were never defined in `globals.css`. Added aliases pointing to `--color-text-1` / `--color-text-2` in both dark and light blocks. | `320e626` |
| Map became Ctrl+drag-to-pan after toggling Box Select once | Box Select cleanup at `lib/google-map-adapter.ts:1908` restored `gestureHandling: 'auto'` instead of the parking-page default `'greedy'`. On a scrollable page `'auto'` resolves to cooperative-mode. | `858f294` |
| Aircraft drag, box-select, ruler clicks all landed in wrong locations after rotating the map | `pixelToLatLng` was using a naive `getBounds() + linear interpolation` that's only correct on a north-up flat map. Switched to `MapCanvasProjection.fromContainerPixelToLatLng()` via a hidden OverlayView in both the adapter and the ruler hook. | `f6246fd` + `916d02b` |
| Light-mode "Finish" buttons in the placement-mode bar (taxilane / boundary) were unreadable — black text on dark green/blue | `color: var(--color-text-1)` resolves to `#0F172A` in light mode. The button bg is `--color-success` / `--color-status-inwork` — also dark in light mode. Hardcoded `#fff` instead. | `543d4ef` |
| Spot-name tooltip never appeared on hover | Native `title` attribute on the inner `<span>` wasn't firing because the parent `<div>` owns the click handler. Title on the row container fires regardless of which child element the cursor is over. | `af656b5` |

---

## Lessons from this session

- **Stale-closure bugs in event listeners are easy to miss** when
  the listener uses lots of refs but accesses state directly. The
  parking click listener used `selectedSpotIdsRef` and others
  correctly, but read `spots` directly — which was stale. The
  pattern that fixed it is the same one already established at line
  393 (`selectedSpotIdsRef`); the fix was to extend it to spots.
  Whenever a listener depends on `state.length` or filters state,
  always use a ref.
- **Vector Maps requires a Map ID for interactive rotation.** Raster
  satellite tiles fundamentally can't be rotated; only 45° aerial
  imagery in select cities works for `setHeading`. Vector Maps
  (`mapId` from Google Cloud Console) is the path. Setting it up is
  ~3 minutes in the user's Cloud Console; reading it via
  `process.env.NEXT_PUBLIC_*` is non-breaking for environments that
  don't have it.
- **`gestureHandling: 'greedy'` suppresses Vector Maps' built-in
  rotation gesture.** Custom Ctrl+drag handler is required for
  desktop. Mobile gets two-finger rotate natively. Saved as
  `feedback_gmaps_rotation_greedy.md`.
- **Cleanup hooks must restore the EXACT prior state, not "default."**
  The Box Select cleanup restored `gestureHandling: 'auto'` (Maps
  API default) instead of the parking page's `'greedy'`. Subtle
  one-character bug that surfaced only after the user toggled the
  feature once. Patterns: `gmap.setOptions({ gestureHandling:
  'greedy' })` is the parking default; cleanup blocks that disable
  gestures must restore that exact value.
- **`title` attribute discovery on inner elements inside an
  interactive parent is finicky.** Browsers can skip the inner
  `title` when the parent has `cursor: pointer + onClick`. Put the
  title on the click target itself.
- **Counter-rotating sprite icons against map heading is the
  pattern for "screen-fixed icons" on a rotated map** — but it
  costs canvas regeneration per heading change. Acceptable for
  ~30 markers; for hundreds, migrate to `AdvancedMarkerElement` +
  CSS transforms (essentially free per frame).

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| `computeIconScale` uses `getBounds()` for px-per-degree calc | Low | Naive bounds rectangle expands on a rotated map, so aircraft render slightly smaller than intended at non-zero map heading. Functional, just not pixel-accurate. Fix: use `OverlayView.MapCanvasProjection` to project two ground-fixed points and measure pixel distance. Defer until visible. |
| Counter-rotation of aircraft icons regenerates 30+ canvases per heading change | Low–Medium | Smooth on developer laptops. May stutter on weaker hardware during fast Ctrl+drag rotation. Migration target: `AdvancedMarkerElement` with CSS `transform: rotate()` that updates per frame without canvas work. |
| Tier 2–4 of the audit-derived refresh backlog | Low | See **Next session tasks**. ~14 single-page modules + 5 reports remain on pre-sweep aesthetics. Each smaller than parking's was. |
| Largest parking page LOC (~4.4K) still monolithic | Held | Component extraction explicitly held out from this session per plan. Ready for follow-up; visible polish is in place to refactor against. |
| Untracked `dark logo.jpg` (2.4MB) | Low | Sits in `/public` from a prior logo experiment. Carryover. |
| Untracked `docs/DEMO_LOGINS.md` | Low | Carryover. |
| Untracked `.claude/` | Low | Local Claude Code settings (gitignored expectation). Carryover. |
| Trademark | Low | CDW holds live "GLIDEPATH" Class 42 (SaaS) registration. |
| Discrepancy "Notes History" backfill | Optional (carryover) | Historical rows still have `CURRENT_STATUS: <enum>` in the DB; display rewrites on render. |
| Visual NAVAIDs further perf | Deferred (carryover) | Layer-toggle full-rebuild, health-ring `Circle` volume, audit-mode panel. |
| Sequential PPR coordination | Deferred (carryover) | All assigned agencies see their work in parallel; no ordering. |
| Public PPR form file uploads | Deferred (carryover) | Out of scope unless requested. |
| "Advisories" → "WWA Notifications" UI sweep | Deferred (carryover) | Glossary memory says "WWA Notifications"; running app still says "Advisories". |
| ~124 `as any` casts project-wide | Low | Was 182. Mostly residual; codebase shape gradually getting tighter. |
| PDF boilerplate duplication in 11 generators | Low | 5 already on `pdf-utils.ts`. Not worth forcing — see `feedback_pdf_utility.md`. |
| Check draft real-time sync deferred | Low | Two users could create duplicate drafts. |

---

## Next session tasks

The two main threads from today have natural follow-ups:

### Tier 2 — daily-traffic operations refresh (5 commits, plan already drafted)

The plan was scoped today before the user pivoted to parking. Stays
ready as-is. Reading order is by signal density:

1. **`/regulations`** (`app/(app)/regulations/page.tsx`, 1,759 LOC,
   signal: 5 plus 3-color filled-gradient duplication) — multiple
   tab-style filled-cyan-gradients, 2 green save-button gradients
   with raw `#059669`, page title `var(--fs-2xl)`, deep-red on
   delete-confirm `#7F1D1D`. Convert tabs to outlined-pill cyan
   recipe (matches QRC + NOTAMs).
2. **`/aircraft`** (828 LOC, signal: 4) — `#34D399` PASS / `#EF4444`
   EXCEEDS hex literals → tokens; 7 `var(--fs-2xl)` headers;
   military-aircraft purple Shield (`#8B5CF6`) needs a token; ACN/PCN
   panel rgba tints.
3. **`/ces`** (364 LOC, signal: 3) — pure rgba tint cleanup +
   `var(--fs-2xl)` page title.
4. **`/shift-checklist`** (606 LOC, signal: 3) — `&#10003;` checkbox
   glyphs (2×) → Lucide `Check`; `&rarr;` and `&larr;` → Lucide;
   `var(--fs-2xl)` page title; `#fff` text inside the all-complete
   button.
5. **`/recent-activity`** (418 LOC, signal: 4) — `#C084FC` (qrc) +
   `#F97316` (wildlife) entity-color hex literals → tokens;
   `var(--fs-2xl)` h2; `&rarr;` HTML entity arrow.

The Tier 2 plan file is at
`C:\Users\cspro\.claude\plans\use-plan-mode-for-witty-fox.md`
(though it was overwritten by the parking plan; re-derive from
this section).

### Parking — component extraction (queued, not landing today)

`/parking/page.tsx` is now 4,400+ LOC of stable, polished JSX. The
visible-polish work is complete; structural extraction is
worthwhile and was originally planned as Session 2:

- **Commit 8** — `components/parking/parking-panel.tsx`: lift
  `sidebarContent()` into its own file as a single component with
  explicit props. ~1,000 LOC moved out of `page.tsx`. Pure refactor.
- **Commit 9** — Extract `AircraftTab` + `AircraftGroup` +
  `AircraftSpotRow`.
- **Commit 10** — Extract `EnvironmentTab` (obstacles + taxilanes +
  boundaries).
- **Commit 11** — Extract `ClearanceTab` + `SettingsTab` +
  `ParkingHeader` + `ActionBar`.

After all four, expect `app/(app)/parking/page.tsx` to drop from
~4.4K LOC to ~1.5K (state + handlers + map init + the four
top-level component calls).

### Parking — perf follow-ups (bandwidth-permitting)

- **`AdvancedMarkerElement` migration** for aircraft markers — eliminates
  the per-heading-change canvas regeneration cost. Required if the
  current counter-rotation stutters on real hardware.
- **`computeIconScale`** uses bounds-rectangle dimensions; switch to
  projection-based px-per-foot measurement so aircraft size stays
  pixel-accurate at any map heading.

### Long-running carryover from prior sessions

Pick from these only when bandwidth allows or a customer asks:

- Tier 3 (lower-traffic chrome — `/training`, `/acsi`, `/daily-reviews`, `/users`, `/more`, staff `/feedback`) and Tier 4 (5 reports subpages) of the audit backlog.
- Offline reads for QRC + Regulations.
- Component extraction for the other 4K+ LOC pages (`base-setup`, `infrastructure`).
- CAC/PIV authentication (blocked on Platform One).
- Outage analytics, training management, Part 139 civilian template.
- "Advisories" → "WWA Notifications" UI sweep.

---

## Build snapshot

```
TypeScript clean (npx tsc --noEmit exit 0)
Tests: 253 pass / 25 files (unchanged from prior session)
Build: npm run build clean — no warnings, no errors.
No new migrations.

Notable First Load JS (changed routes this session):
  /login                    10.2 kB / 166 kB    (was uncatalogued)
  /reset-password           4.74 kB / 151 kB    (was 4.73 / 151)
  /setup-account            4.89 kB / 151 kB    (was 4.88 / 151)
  /parking                 41.7 kB  / 414 kB    (was 38.9 / 412)

The parking growth (+2.8 kB / +2 kB) reflects the Vector Maps
mapId wire, the Ctrl+drag rotation handler, the OverlayView for
heading-aware projection, the icon counter-rotation logic, the
3-dot overflow menu, and the aircraft list hierarchy changes.
Reasonable for the volume of behavior added.

Largest static page (unchanged): /wildlife 458 kB / 793 kB.
Middleware: 74.5 kB.
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-04-30 (this session) | Tier 1 of the audit-derived refresh backlog (login + reset-password + setup-account + feedback). Then a deep parking polish: floating panel drag-resize, token + color-mix migration, action bar with 3-dot overflow, list hierarchy with auto-numbering bug fix, contrast/padding sweep across all panel tabs. Vector Maps mapId wired for interactive heading rotation; custom Ctrl+drag handler; heading-aware pixelToLatLng via MapCanvasProjection (fixes drag/box-select/ruler when map is rotated); aircraft icons counter-rotate to stay screen-fixed. 28 commits. |
| **Unreleased** | 2026-04-30 (prior, same day) | Distinctive-refresh sweep finished across every high-traffic route: Inspections (construction + joint monthly), NOTAMs (3 routes), Wildlife (5-commit arc covering page + heatmap + analytics + report + forms), /scn, /contractors, /obstructions (3 routes), /waivers (5 routes + constants migration). DetailGrid upgraded to bordered tiles — 6 detail pages benefit. Bug fixes: Other-check Reason resume, /scn AgencyRow active state, discrepancy detail layout. 20 commits. |
| **Unreleased** | 2026-04-30 (prior, same day) | QRC distinctive refresh: amber-unified colors via outlined-pill recipe, Done/N/A two-state step toggle + schema bridge for back-compat, full PDF rewrite (status pills replace broken Unicode glyphs, color-coded row rules, italic warning blocks for conditional steps, mini progress bar). pdf-utils.ts gains spacing constants + y-coord convention. Two feedback memories pinned. 1 commit. |
| **Unreleased** | 2026-04-29 | Distinctive-refresh sweep across `/`, `/dashboard`, `/discrepancies`, `/ppr`, `/checks`, `/inspections` daily-ops set. Construction + Other check types added. Shared `<PfnToggle>` extracted. Light-mode fixes for OOO/Closed banners. PPR spine ETA dropped. 16 commits, two migrations applied. |
| **Unreleased** | 2026-04-29 (prior) | PPR per-surface visibility, per-column `time_display`, public form ETA optional, Airfield Status base-local-today filter, type-scale shrink. 4 commits. |
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

### Modified files

- `app/login/page.tsx` — Tier 1 refresh
- `app/reset-password/page.tsx` — Tier 1 refresh
- `app/setup-account/page.tsx` — Tier 1 refresh
- `app/feedback/[baseId]/page.tsx` — Tier 1 refresh + section dividers
- `app/(app)/parking/page.tsx` — the bulk of the session (25 commits)
- `app/globals.css` — `--color-text-primary` / `--color-text-secondary` aliases + `--color-violet` token
- `lib/google-map-adapter.ts` — OverlayView-backed `pixelToLatLng`
- `hooks/use-google-map-ruler.ts` — heading-aware projection in the ruler

### Environment changes

- `.env.local` (user-managed, not in repo) — `NEXT_PUBLIC_GOOGLE_MAPS_VECTOR_MAP_ID` added by user this session. Required for parking-only Vector Maps; raster fallback works without it.

---

*All 28 commits are local-only on `main` (28 ahead of `origin/main`).
Push when ready. No new migrations. No version bump. Untracked
files (`.claude/`, `docs/DEMO_LOGINS.md`, `public/dark logo.jpg`)
remain carryover and are not from this session.*
