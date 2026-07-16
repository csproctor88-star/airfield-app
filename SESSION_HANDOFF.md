# Session Handoff

**Date:** 2026-07-15 (evening session — second handoff today)
**Branch:** `main`. **1 commit** this session (`f19e145e`), **pushed**;
tree clean (this handoff is the only modified file). `glidepath-site`:
untouched, still @ `1514702`.
**Build:** re-verified at wrap (pipefail, cwd pinned): tsc ✓ · lint 0
errors · vitest **1237 passed | 16 skipped** (138 files; +8 simplify) ·
`npm run build` ✓ (middleware 80.8 kB).
**HEAD:** `f19e145e`.
**DB:** no new migrations; `2026071300_configurable_shifts` remains latest,
applied. One read-only diagnostic query hit the linked DB (taxiway vertex
counts); zero writes.

---

## What shipped this session

Two threads: a shipped performance fix for the base-config taxiway step
(Portland ANG Base couldn't open the page), and a diagnosed-and-planned —
but deliberately not built — fix for uploads being blocked on NIPR/AFNet.
The second waits on a field test the owner runs tomorrow.

### Taxiway-step freeze on dense imports fixed (`f19e145e`)

Portland ANG Base imported survey-grade GeoJSON: 69 taxiway centerlines,
**10,905 vertices** (largest line 902 pts; next-densest base has 179 pts
total — confirmed by `jsonb_array_length` sweep of `base_taxiways`). The
editor (`components/taxiway-editor-google.tsx`) rendered one legacy
`google.maps.Marker` per vertex — ~11k DOM overlays repositioned every
zoom/pan frame — and its single render effect also depended on
`drawingPoints`, so every click while drawing tore all of it down and
rebuilt it. The markers were `clickable: false`, purely decorative; zero
functional loss removing them.

Fix, all render-side: vertex markers dropped for saved taxiways (drawing
mode keeps its green dots); render effect split (saved layers vs drawing
preview, with a `mapGen` counter so both re-render if the map instance is
recreated); new `lib/calculations/simplify.ts` — Ramer–Douglas–Peucker,
tolerance in feet in the same local-equirectangular space as
`buildBufferRing` — decimates saved lines at render time before polyline +
clearance-buffer construction. **Stored `centerline_coords` are never
modified** (owner constraint). Future imports are simplified before saving
(1 ft tolerance), reduction surfaced in the toast. Evidence harness ran the
real function against Portland's real rows: 902→157, 668→24, 647→189 pts.
The `Import-N` designators confirmed the data came through this same
importer. 8 unit tests (endpoints, corners, micro-jogs, closed rings from
Polygon imports, within-tolerance guarantee, no mutation).

### NIPR upload block: diagnosed, plan on file, execution gated (no code)

Owner reports document uploads to Glidepath are blocked on NIPR/AFNet.
Root cause analysis: every upload call site (~21 across photos, FLIP,
Read Files, waivers, AMTR, regulations, user docs) POSTs the file straight
from the browser to `*.supabase.co/storage/v1/...` — the one request shape
AFNet's proxy/DLP blocks, while the app's JSON API traffic passes (the app
otherwise works on NIPR). Drag-and-drop would change nothing (UI-only; the
network request is identical). Photo modules already fall back to data-URLs
in the DB row on upload failure; document modules have no fallback — hence
"documents" being the complaint.

Plan written to `C:\Users\cspro\.claude\plans\2026-07-15-nipr-upload-proxy.md`
(user-level, not in repo): same-origin `/api/storage/upload` route carrying
files as base64-JSON — indistinguishable from traffic that already passes —
acting as the calling user via cookie session (no service role; storage RLS
unchanged), with 3 MB chunking through a new private `upload-chunks` bucket
for files over Vercel's 4.5 MB body cap. A shared `uploadToStorage()` helper
tries direct upload first, proxies on failure; 21 call sites are a one-line
mechanical swap. **Gate:** owner tests airfield-diagram upload (the one
already-server-side upload) from a NIPR machine tomorrow. Test outcome
changes confidence/diagnosis, not the design — execute either way on the
owner's go, after he picks subagent-driven vs inline execution.

## Migrations status

| File | Status | What it does |
|---|---|---|
| `2026071300_configurable_shifts.sql` | Applied 2026-07-13 | Latest migration; nothing new this session |

(The NIPR plan includes a future `2026071600_upload_chunks_bucket.sql` —
not written yet, lands with plan execution.)

## Bugs fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| Base-config taxiway step freezes/locks on open + zoom at Portland ANG | One legacy `google.maps.Marker` per centerline vertex (~11k decorative DOM overlays) + full layer teardown/rebuild on every drawing click | `f19e145e` |

## Lessons from this session

- **Legacy `google.maps.Marker` count is the freeze axis, and decorative
  markers cost the same as functional ones.** ~11k `clickable: false`
  vertex dots locked the main thread; the same geometry as plain vector
  polylines/polygons renders fine. Extends the OpenLayers finding: the
  bottleneck is DOM-overlay density, renderer swaps don't help.
- **`jsonb_array_length` per base is cheap triage for geometry complaints.**
  One read-only query separated "Portland is 60× denser than everyone else"
  from "the page is slow for all bases" in seconds, and the `Import-N`
  designators identified the ingestion path.
- **Render-time decimation beats data cleanup when customer rows are
  involved.** RDP at 1 ft tolerance is visually/analytically lossless for
  50–200 ft clearance envelopes, and it sidesteps UPDATEs on owner data
  entirely.
- **Upload-shaped requests are their own network-policy class.** The NIPR
  question looked like a UI feature request (drag-and-drop) but is a
  transport problem: AFNet passes same-origin JSON, blocks file-carrying
  POSTs to third-party storage domains. The existing check-photo data-URL
  fallback (base64 through PostgREST) is live evidence base64-in-JSON
  passes.

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| NIPR/AFNet uploads blocked | med | Diagnosed; plan on file (see above). Blocked on owner's airfield-diagram field test, then execution go. |
| Hero redline strings | med | Carry: owner preview pass still owed on "See it happen ↓" CTA · coverage band title/line split · the three ↳ automation lines · the dialect ethos pair. `lib/home-content.ts` / `lib/cascades.ts`. |
| Anonymous-submission gap 2026-07-02..14 | info | Carry: owner decides if outreach is warranted; nothing queryable from our side. |
| reports still shows "hgjhj" resolution row | low | Owner accepted ("not a focus"). Swap is drop-in if the demo row gets cleaned. |
| NAVAIDs module clip: template tilt on 2 beats | info | Owner accepted. Re-export swap is turnkey. |
| Dashboard still: light theme + ad overlay | low | Cosmetic; re-capture swaps in turnkey. |
| Discrepancies clip: demo typo "RWY 16" vs 06R/24L | info | In the recorded demo data; flashes by at 6×. |
| Demo user on Demo AFB | med | Civilian blocker: "prep KDRA" pre-flight is step 0 of the capture plan (`docs/references/civilian-capture-plan.md`). |
| Proof band empty | med | Carry: testimonials + permissions owed by owner; null-hidden. |
| NAVAID marker-sizing dials | low | Carry; dials in `lib/infrastructure/marker-scale.ts`. |
| QRC draft flow not browser-driven | low | Carry: create→close→resume dialog loop deserves one hands-on pass. |
| Demo seeds don't copy `shift_name_*` | low | Carry. |
| `modifications-exemptions` (civilian) | low | Stays gated until the app feature ships. |
| Track pages no longer link to `/[slug]` | low | Watch SEO. |
| Cosmetic | low | Stray blank line in 51 site module content files; `modules-data` header em dashes (unrendered). |
| Prior app-side carryover | low | Civilian tenant status chips dual-mode miss · status-page weather race · account-deactivation live sessions · Selfridge 1098 dedup. |

## Next session tasks

1. **NIPR upload proxy — field test, then execute.** Owner tests the
   airfield-diagram upload (Base Setup → Airfield Diagram, PNG/JPG ≤4 MB)
   from an AFNet machine; grab the browser network error if it fails. Then
   execute `C:\Users\cspro\.claude\plans\2026-07-15-nipr-upload-proxy.md`
   task-by-task (owner picks subagent-driven vs inline). Design proceeds
   regardless of test outcome; only re-diagnose if even JSON writes fail.
2. **Portland taxiway fix — owner spot-check on the promoted build**
   (his normal flow): base-config taxiway step should open and zoom
   smoothly at Portland now.
3. **Civilian capture day** (owner-scheduled): owner says **"prep KDRA"**
   → run the pre-flight in `docs/references/civilian-capture-plan.md`,
   then he records 6 clips + 18 stills (`civ-` prefix, same Drive folder).
4. **Hero + coverage redline pass** on the live homepage (carryover).
5. **Anonymous-submission gap decision** — owner's call.
6. **QRC drafts hands-on pass** on the promoted build.
7. **Part 139 cert-inspection audit build** — resume from
   `.superpowers/sdd/progress.md` when the owner wants it.

### Long-running carryover
SEO / rich-results · deferred audit items · Next 16 — owner-scheduled,
unchanged.

## Build snapshot
```
airfield-app @ f19e145e (re-verified at wrap): tsc ✓ · lint 0 errors ·
  vitest 1237 passed | 16 skipped (138 files; +8 simplify.test.ts) ·
  build ✓ · middleware 80.8 kB.
glidepath-site @ 1514702: untouched this session (last verified at the
  morning wrap: tsc ✓ · lint 0/0 · vitest 143 passed · build ✓).
```

## Recent releases
| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-07-15 (late) | Base-config taxiway step no longer freezes on survey-grade imports (Portland: ~11k vertex markers dropped, RDP render decimation, import simplification; stored coords untouched) · NIPR upload block diagnosed + proxy plan on file (execution gated on field test). |
| **Unreleased** | 2026-07-15 | glidepath-site military track **media-complete**: 7 owner clips + 19 stills across all 26 military module pages · NAVAIDs two-story re-record · PPR asset shared cascade+module · CES still header-cropped (identifiability call) · module ownerMedia existence guard · civilian capture plan written. airfield-app: no code changes. |
| **Unreleased** | 2026-07-14 (late) | Military homepage cascade complete (NAVAIDs/PPR/Parking clips, PPR with 6× fill time-lapse) · spall vignette → PPR cascade · hero rebuilt "facts are the hero" + track-aware "Built by an Airfield Manager" · module-row affordance · 960px media cap default · OG regen + photo-backed share cards (home/tracks) · **airfield-app: 12-day anonymous public-form outage fixed** (middleware allowlist). |
| **Unreleased** | 2026-07-14 | Report Outage type→shop routing (+ alert copy) · QRC editor localStorage drafts · NAVAID three-stage marker sizing + light clamps · site: owner redlines, NAVAID cascade line, first Phase 4 clip wired. |
| **Unreleased** | 2026-07-13 | airfield-app configurable shifts: 1–3 per base, renameable; migration `2026071300` applied. |
| **Unreleased** | 2026-07-12 (late) | glidepath-site cascade rebuild: homepage cascade vignettes; track-page module stack + zoom dialog; 50 module pages restructured. |
| **v2.35.0** | 2026-06-30 | Customizable widget dashboard; FLIP Management + Read File; PPR calendar + `.ics`; AMTR 803/1098; C2IMERA export; WWA server-side expiry; brand refresh. |
| **v2.34.0** | 2026-06-01 | Help & Training all modules; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination; Records Export. |

## Key docs / files touched this session

### New files
- `lib/calculations/simplify.ts` — RDP polyline simplification
  ([lng, lat], tolerance in feet); shared by taxiway render decimation and
  import.

### Modified files
- `components/taxiway-editor-google.tsx` — vertex markers dropped, render
  effects split, render decimation, import simplification.

### Outside the repo
- `C:\Users\cspro\.claude\plans\2026-07-15-nipr-upload-proxy.md` — **new**;
  the NIPR upload-proxy implementation plan (7 tasks, TDD, execution
  gated on tomorrow's field test).
