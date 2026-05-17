# Session Handoff

**Date:** 2026-05-17
**Branch:** `main`
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓, `npx vitest run` ✓ (253 pass)
**HEAD:** `73fac77` (origin/main)

---

## What shipped this session

Four-day arc with two distinct phases. Phase one (May 13) wrapped up the
previous session's threads with quick UX polish — parking heading slider
rebuild, parking edit-plan-details dialog, a small `parking-pdf` layout
move, and the QRC create-from-scratch editor (a substantial new feature
that finally lets users build QRCs without hand-editing seed data).
Phase two (May 15–17) was a multi-day debugging arc on the parking PDF
capture: iterations that progressively broke things, a clean rollback,
then a from-scratch rebuild on a stable foundation. The final state is
solid — tiles render, frame matches capture, multi-apron exports work,
icon scaling is rotation-stable, tilt is locked at 0.

### Parking heading input + slider rebuild (`eda1cb5`, `ab9e6e9`)

The parking heading inputs were glitching on fast typing — every
keystroke fired a Supabase write, responses raced, and the input value
snapped back to whatever response landed last. Added a generic
`NumberField` (`components/ui/number-field.tsx`) with a local draft
buffer that only commits on blur / Enter, then swapped 9 instances in
the parking module. Same field also handles empty input and clamping.

Heading slider was unresponsive for similar reasons. Built
`components/ui/heading-slider.tsx` with the same draft pattern: per-tick
visual preview (calls an `onPreview` callback for imperative marker
rotation), commit on pointer-up. Also added a sync-rotation pipeline
that pre-caches an un-rotated base canvas per aircraft type, then
rotates synchronously via canvas-to-canvas `drawImage` — no async
`Image.onload` hops on every slider tick. Slider now feels native.

### QRC create-from-scratch (`76ca23b`)

The QRC module previously could only import the 25 default templates
or edit existing ones with a stripped-down form (label + type, no
agencies, no field_label, no cross-ref, no SCN form). Built
`components/admin/qrc-editor-dialog.tsx` (~520 LOC) — a single dialog
for both create and edit, supporting all 8 step types with type-specific
config, sub-steps one level deep (the seed-data pattern), and the full
SCN form fields editor. Renamed "QRC Templates" → "QRCs" in the
base-setup wizard step and section header; renamed "+ Add from Defaults"
→ "Import 25 QRC Templates" and added a new outlined "+ Create QRC"
button next to it.

### Parking edit plan name + description (`d9b134c`)

Plan picker had New / Set Active / Duplicate / Save as Template /
Delete but no way to fix a plan's name or description after creation.
Added an "Edit Details" entry at the top of the action menu that opens
a small modal pre-filled with the current values. `updateParkingPlan`
already accepted both fields; just needed the UI.

### Parking PDF map → own page (`869a91d`)

Small layout change in `lib/parking-pdf.ts` — the captured map screenshot
now gets its own dedicated landscape page (centered both horizontally
and vertically) instead of being inlined after the tables. PDF
generator places it at full content width minus footer reserve.

### Parking PDF capture saga (`0052f70` → `73fac77`)

Phase two of the session. Started with a series of additions to the
parking PDF export — capture-frame overlay, position-then-confirm,
aircraft filter on PDF tables, multi-apron Add Apron, HHmm filename.
Each addition was reasonable in isolation but they progressively broke
the underlying tile capture because the `html2canvas` + Google Maps
vector renderer combination was always racy (WebGL drawing buffer
clears between frames, no `preserveDrawingBuffer` to opt out). The
chain bottomed out with three or four passes of "fix one thing, break
another" until I rolled the whole chain back (commit `540e25d`,
restored both files to `d9b134c`) and started fresh on the proven
resize-trick foundation.

The rebuild then went through five focused commits laying each feature
back on top — Step 1: frame-area capture, Step 2: WYSIWYG overlay +
Position-then-Confirm, Step 3: aircraft filter, Step 4: multi-apron
Add Apron, Step 5: HHmm filename + panel × close + mobile Panel button.
A few real bugs surfaced and were fixed along the way: rotation-stable
icon scaling via the Mercator meters-per-pixel formula (`73fac77`),
the on-screen outline now shows the actual 1600×900 capture
rectangle (`4143c1c`), zoom + center preserved across the resize
(`6de4d05`), `position: fixed` lift to escape flex layout so the
1600×900 is actually honored (`bb2912a`), tilt locked at 0 because
non-flat tilt breaks the icon-scale calc (`5374deb`), and the
multi-apron Confirm-duplicate bug fixed (`4cef694`).

The big learning got pinned as project memory — see
`project_parking_pdf_capture.md` in auto-memory.

---

## Migrations status

| Migration | Status | What it does |
|---|---|---|
| (none new this session) | — | All applied migrations from prior sessions remain applied. |

No new migrations. The pending tracker note from prior sessions
(`db push` not allowed; use `db query --linked --file` for singles)
still holds.

---

## Bugs fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| Heading inputs glitched on fast typing — digits got overwritten | Every keystroke fired a Supabase write, response races, and `value={s.heading_deg}` snapped the input back to whatever response landed last. Combined with `Number('') \|\| 0` the field couldn't be empty either. | `eda1cb5` |
| Heading slider unresponsive / aircraft rotation laggy | Slider's per-tick `setSpots` cascaded through map re-render + async SVG re-load + cancellation race; user never saw rotation update until they stopped dragging. | `ab9e6e9` |
| Drag-label perf during aircraft drag | Per-frame `google.maps.Marker` + `Polyline` instantiation. | `eda1cb5` |
| PDF capture map page came back gray (no tiles) | Google Maps vector renderer draws to a WebGL canvas without `preserveDrawingBuffer: true`. The GPU buffer is cleared between frames, so `html2canvas` reads empty pixels — the gray loading colour. | `4ae3888` / `72415d0` (warm-up cycle) |
| Capture's "1600×900 resize" wasn't actually 1600×900 | Parent is a flex item with `flex: 1` that overrides inline width/height. The actual rendered size was viewport size, so the captured geographic area was wrong (extra hangars / stadium lights ended up in the PDF that weren't in the on-screen outline). | `bb2912a` |
| Aircraft SVG icons rendered wrong-sized under map rotation | `computeIconScale` used `gmap.getBounds()` which returns the axis-aligned bbox of the visible area — expands by ~√2 at 45° rotation. Replaced with direct Mercator `mpp = 156543.03392 × cos(lat) / 2^zoom`. | `73fac77` |
| Multi-apron exports produced duplicate sections | `handleConfirmCapture` was capturing the current view as a final section even when the user had already added it via Add Apron. Two captures back-to-back hit different WebGL state, so one duplicate had tiles, the other didn't. | `4cef694` |
| On-screen outline didn't match the captured area | Outline was drawn at 16:9 inset of the live viewport; capture happened at fixed 1600×900. Different aspect ratios → different geographic bounds. Switched outline to a fixed 1600×900 rect centered in viewport (with box-shadow dim) so it matches what the capture actually produces. | `4143c1c` |
| Tilt at non-flat angles broke aircraft icon sizing | Icon-scale calc only handles overhead; tilt projects the SVG marker through a tilted camera in ways the scale logic doesn't compensate for. Locked tilt at 0; removed the vertical-drag tilt branch from the Ctrl-drag handler. | `5374deb` |
| `gmap.moveCamera()` silently no-op'd on raster maps | moveCamera is vector-only. Swapped to `setHeading()` + `setTilt()` which work on both renderers. (Relevant during the brief raster-experimentation period of the saga.) | `579b458` |

---

## Lessons from this session

- **Google Maps vector + `html2canvas` is fundamentally racy.** No
  `preserveDrawingBuffer` knob, so the WebGL buffer can be empty by
  the time `html2canvas` reads. The fix isn't a single capture-time
  tweak — it's a silent warm-up `html2canvas` read on map mount that
  primes the GPU readback path, gated by a `mapWarmedUp` state. The
  bare resize cycle alone is not enough; the warm-up has to actually
  call `html2canvas` (with output discarded) to prime the state.
- **`gmap.getBounds()` is not rotation-stable.** It returns the AABB
  of the visible area, which inflates by ~√2 at 45° rotation. Anything
  that needs a constant pixels-per-meter under rotation must use the
  direct Mercator formula (`156543.03392 × cos(lat) / 2^zoom`), not
  derive from bounds.
- **Inline `style.width` on a flex item with `flex: 1` is ignored.**
  The flex container overrides it. Set `position: fixed` (or
  `flex: none`) to lift the element out of flex flow before forcing
  dimensions. The original Mapbox capture (`a2db30d`, March 2026) did
  this; the April 2026 html2canvas migration dropped it, which is
  what hid the bug for over a month.
- **When capture is the only feature users notice broken but everything
  else "works", the bug is almost certainly latent — not new.** Spent
  half the saga thinking a recent change had broken things; the actual
  issue had existed since April but only surfaced under specific cold-
  state testing patterns (fresh page load, no map interaction before
  export).
- **Rebuild beats iterate when the iteration loop is fixing-something-
  while-breaking-something-else.** The full rollback to `d9b134c` plus
  the focused five-step rebuild covered more ground in one day than
  the prior three days of poking at individual symptoms. Don't be
  precious about throwing away churn that was just thrashing.
- **Always preserve `getCenter()` + `getZoom()` across any resize
  trick.** Google Maps's fractional-zoom logic adjusts both when the
  container shrinks/grows; without explicit re-apply, the captured
  area drifts from the live view.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| Mobile parking PDF export not verified end-to-end | Low–Medium | Vector + warm-up + `position: fixed` resize trick haven't been tested on a real iOS / Android device this session. Desktop is solid. If a mobile user reports gray tiles or layout issues during the brief capture flash, iterate. |
| **PPR "triage" identifiers still in code + DB** | Medium | (Carryover) Display strings are clean ("Review" everywhere) but DB enum `pending_amops_triage`, columns `triaged_by` / `triaged_at`, permission key `ppr:triage`, function `triagePprEntry`, constants like `PPR_TRIAGE`, and ~25 comments still use "triage". Full rename = 1 migration + ~25 file edits. |
| Backup feature plan parked | Low | (Carryover) Full plan at `docs/Backup_And_Data_Export_Plan.md`. Phase 1–3 cover manual backup; Phase 4–8 cover survivability mode. 8–11 sessions total. |
| Standalone mobile app plan exists in conversation | Low | (Carryover) React Native + Expo extraction of Obstruction Eval / Parking Plan / Regulations / Aircraft. Sketched but not parked as a doc. |
| Supabase migration tracker empty for the entire project | Medium | (Carryover) Per-migration applies via `db query --linked --file`. Eventual cleanup is a `migration repair --status applied <ts>` sweep. |
| Sidebar + `/more` parallel hardcoded module lists | Low | (Carryover) Module → section mapping in two places. |
| `lib/tours/pages/*.ts` still present | Low | (Carryover) 28 files retained as content seed. No imports anywhere. |
| `data-tour` anchors throughout `page.tsx` files | Low | (Carryover) 70+ unused anchors. |
| `/training` Quick Start + Base Setup tabs use stub content | Medium | (Carryover) |
| FAQ entries on every module are empty | Low | (Carryover) |
| `lib/permissions-server.ts` imports `resolveEffectivePermissions` from `'use client'` module | Medium | (Carryover) Move to a shared module. |
| `audit-panel.tsx` per-row internal styling | Low | (Carryover) 1.6K LOC. |
| `/infrastructure` perf | Low–Medium | (Carryover) AdvancedMarkerElement migration target. |
| Largest source files | Held | `parking/page.tsx` ~4.8K LOC (grew this session with the rebuild), `base-config/setup/page.tsx` ~4.7K LOC, `infrastructure/page.tsx` ~4.1K LOC. |
| Untracked carryover files | Low | `.claude/`, `docs/DEMO_LOGINS.md`, `docs/base-setup-guide-review.md`, `docs/training-modules-review.md`, `docs/Backup_And_Data_Export_Plan.md`, `public/glidepath-logo-dark.jpg`. |
| ~124 `as any` casts | Low | (Carryover) |
| Check draft real-time sync deferred | Low | (Carryover) |
| "Advisories" → "WWA Notifications" UI sweep | Deferred | (Carryover) |
| Trademark | Held | (Carryover) CDW holds "GLIDEPATH" Class 42 (SaaS). |

---

## Next session tasks

No required next step. The parking PDF capture is in the cleanest
state it's been since the Mapbox → Google Maps migration in April,
and every feature that was rolled back has been rebuilt cleanly on
top of the proven warm-up + resize-trick foundation. The QRC
create-from-scratch editor shipped earlier this session is feature-
complete. Pick up wherever the user wants.

Open candidates, none blocking:

- **Bump version to 2.34.0**. Unreleased work bundles all prior
  carryover plus this session's QRC editor, parking PDF capture
  rebuild (multi-apron + frame overlay + filter + HHmm + Mercator
  icon scale + tilt lock), parking heading slider perf overhaul,
  NumberField for parking heading inputs, edit-plan-details dialog,
  map-on-own-page PDF layout. Five places: `package.json`,
  `app/(app)/settings/page.tsx`, `app/(public)/login/page.tsx`,
  `CHANGELOG.md`, `README.md`. New entry in `lib/release-notes.ts`.
- **Verify mobile parking PDF export** on a real device. The
  capture path is identical to desktop now (vector + warm-up +
  `position: fixed` resize trick), but the brief capture flash and
  the `position: fixed` lift haven't been tested on iOS / Android.
- **Full Triage → Review code + DB rename** (carryover). 1 migration +
  ~25 file edits.
- **Manual backup feature** Phase 1 from
  `docs/Backup_And_Data_Export_Plan.md` (carryover). Resolve the open
  questions at the bottom of that doc first.
- **Sidebar / `/more` shared config refactor** (carryover).

### Long-running carryover (bandwidth-permitting)

- Sweep `lib/tours/pages/*.ts` and dead `data-tour` attributes.
- Move `resolveEffectivePermissions` out of `lib/permissions.ts` into
  a shared module.
- Component extraction in `parking/page.tsx` (~4.8K LOC) — grew this
  session.
- Component extraction in `base-config/setup/page.tsx` (~4.7K LOC).
- `audit-panel.tsx` per-row styling refresh (1.6K LOC).
- "Advisories" → "WWA Notifications" UI sweep.
- Outage analytics, training management, Part 139 civilian template.
- CAC/PIV authentication (blocked on Platform One).
- Supabase migration tracker repair sweep.

---

## Build snapshot

```
TypeScript clean (npx tsc --noEmit exit 0)
Tests: 253 pass / 25 files (unchanged from prior session)
Build: npm run build clean — no warnings, no errors.
No new migrations this session.

Notable First Load JS (changed routes this session):
  /parking                47.5 kB / 421 kB   (PDF capture rebuild + heading slider/NumberField + edit plan details)
  /qrc                    21.5 kB / 342 kB   (create-from-scratch editor)
  /base-config/setup      66.4 kB / 269 kB   (QRC rename + Create QRC button + dialog wiring)

Largest static page (unchanged): /wildlife 459 kB / 795 kB.
Middleware: 74.5 kB.
Shared by all: 91.2 kB.
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | — | Parking PDF capture rebuild on a stable warm-up + resize-trick foundation — WYSIWYG capture-frame overlay matches the captured area exactly, multi-apron Add Apron flow, frame-based aircraft / violation filter on PDF tables, Mercator-formula icon scale that stays correct under map rotation, tilt locked at 0, HHmm in filename to prevent same-day overwrites. QRC create-from-scratch editor with full 8-step-type support + sub-steps + SCN fields; "QRC Templates" → "QRCs" terminology pass. Parking heading slider perf overhaul + NumberField for typing-without-glitches across heading / dimension inputs. Edit plan name + description after creation. Map screenshot on its own page in PDF. Plus prior unreleased: PPR PDF rebuild as cards-per-entry, Discrepancies Created By surfacing, Module Selection verbiage standardization, Events Log 500-row cap lift + infinite scroll + server-side search. |
| 2.33.0 | 2026-05-02 | Glidepath Training rebuilt at /training as role-filterable hub + per-module deep-dive subpages; PPR module; Daily Reviews; offline write queue + Workbox runtime caching; permission matrix overhaul + 3 new roles; Events Log structure-first refresh; auth fix for invite/signup/reset emails landing on correct screen; forgot-password sends branded email. |
| v2.32.0 | 2026-04-21 | Modular Onboarding, SCN, Close-for-Day, What's New modal |
| v2.31.0 | 2026-04-07 | Full Google Maps migration, Custom Status Boards, PPR Log |
| v2.30.0 | 2026-04-14 | Daily Reviews + shift sign-off, ARFF status log, Vitest scaffold |

See `CHANGELOG.md` for full history.

---

## Key docs / files touched this session

### New files

- `components/ui/number-field.tsx` — controlled number input with a
  local string draft. Commits on blur / Enter; allows empty during
  edit. Used by parking module heading + dimension inputs.
- `components/ui/heading-slider.tsx` — range slider with a local
  draft. `onPreview` per-tick (imperative marker rotation),
  `onCommit` on release (DB write).
- `components/admin/qrc-editor-dialog.tsx` — single dialog for both
  Create QRC and Edit QRC modes; all 8 step types with type-specific
  config; sub-steps one level deep; SCN form fields editor; full
  validation.

### Modified files

- `app/(app)/parking/page.tsx` — the bulk of this session lives here.
  PDF capture pipeline (warm-up cycle, `position: fixed` resize trick,
  zoom/center preservation, frame-area outline, Mercator icon scale,
  tilt lock); WYSIWYG capture-frame overlay + Position-then-Confirm
  banner + Add Apron flow; per-frame aircraft / obstacle / violation
  filter; heading slider + sync rotation pipeline + base canvas cache
  + imperative rotation; edit plan details dialog; map-size
  `ResizeObserver`; mobile Panel button in toolbar cluster + panel ×
  close on sidebar header. File grew to ~4.8K LOC — extraction is a
  carryover.
- `lib/parking-pdf.ts` — refactored from a flat-input single-page
  generator to a sections-based multi-section generator. Each section
  is one captured apron (map + tables + optional header); single-apron
  exports pass one element with no label and the layout matches the
  pre-refactor output. HHmm appended to filename.
- `app/(app)/base-config/setup/page.tsx` — "QRC Templates" → "QRCs"
  rename, "+ Add from Defaults" → "Import 25 QRC Templates", "+ Create
  QRC" button, swapped the inline EditQrcDialog out for the new
  `QrcEditorDialog` component. Removed ~190 LOC of inline editor code.
- `.claude/projects/C--Users-cspro/memory/project_parking_pdf_capture.md` —
  new memory file pinning the parking PDF capture lessons so future
  sessions don't re-debug the WebGL / `position: fixed` / Mercator /
  tilt-lock gotchas.

### Environment changes

None.

---

*32 commits this session pushed to `origin/main`: `869a91d` through
`73fac77`. No new migrations. Untracked files unchanged from prior
session (`.claude/`, `docs/Backup_And_Data_Export_Plan.md`, etc.).*
