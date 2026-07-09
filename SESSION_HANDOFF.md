# Session Handoff

**Date:** 2026-07-09
**Branch:** `main`, **fully pushed and clean** (HEAD `248fc148`).
Two arcs this session: (1) a **bug-fix sweep** driven by owner testing of the
promoted build — a Part 139 form fix, then a cascade of map/PDF/user-management
bugs that each traced to a deeper root cause; and (2) a complete **Help &
Training (`/help`) overhaul** — PDF export verified, three missing guides added,
all 34 existing guides made current against the live app, and every screenshot
recaptured and wired.
**Build:** `airfield-app` @ `248fc148`: tsc ✓ · lint 0 errors (2 pre-existing
warnings in `lib/waiver-pdf.ts`) · `npx vitest run` **1138 passed / 16 skipped**
(125 files) ✓ · `npm run build` ✓.
**HEAD:** `airfield-app` `248fc148` · `glidepath-site` unchanged (`3688a57`).
**DB:** no new migrations this session. `2026070700_add_part139_cover_fields`
(prior session) remains applied.
**Not promoted** — owner owns Vercel promotion.

---

## What shipped this session

### Owner-testing bug sweep

The owner tested the promoted build and reported a string of issues; several
looked cosmetic but traced to shared root causes worth remembering.

#### Part 139 audit item numbers (`e8fa3e29`)
The civilian Part 139 audit form rendered item numbers as the raw record id
(`navaids.1`), leaking the section key. Added `acsiItemDisplayNumber(section,
itemId)` in `lib/part139-cert-checklist.ts`: Part 139 (`p139-*` sections) shows
section-qualified `17.1`; USAF ACSI (`acsi-*`, ids already hierarchical like
`3.2.5`) passes through unchanged. Keyed on the record's section namespace, not
the base's live mode. Wired into the form, `/acsi/[id]`, and the Form 5280-4 PDF.

#### CSP `frame-src` — inline PDF previews (`c07333e0`)
Daily-review PDF preview showed a broken-document placeholder. The enforcing CSP
had `frame-src 'self' https:`, which matches neither the `blob:` scheme nor
`'self'`, so Chrome blocked the client-generated blob-PDF `<iframe>`. Added
`blob:` to frame-src. Same fix repaired `/library` and `/regulations`. Guarded
by `tests/csp-headers.test.ts`.

#### CSP `connect-src` — Google Maps markers (`b4c9b523`)
The real cause of the long-running "question-mark markers" saga. The Workbox
service worker intercepts cross-origin `<img>` loads and re-`fetch()`es them to
cache — and a fetch is governed by **connect-src, NOT img-src**. img-src trusted
`*.gstatic.com` but connect-src didn't, so the SW's fetch of Google Maps sprite
images (`maps.gstatic.com/mapfiles/transparent.png`) was blocked → broken
editable-shape handles on parking / Visual NAVAIDs. Made connect-src a **superset
of img-src's external hosts** (added gstatic, Bing, QR, FWS; widened googleapis).
The csp-headers test now enforces the superset invariant. See
`project_csp_connect_src_sw_fetch` memory.

#### PWA update toast removed (`b1c287b6`)
The "A new version is available" toast fired constantly. It had been added on the
theory that stale bundles caused the map markers — but the markers persisted
after refresh (the connect-src bug above was the real cause), so the toast was
both wrong and noise. Unmounted `PwaUpdateToast` from the root layout; component
kept dormant.

#### Ambiguous `bases` embed — user profile Save (`1e94b086`)
User-management **Save Changes** failed with PostgREST `PGRST201` "more than one
relationship was found for 'profiles' and 'bases'". The `dashboard_user_defaults`
table (added ~2026-06-29) has exactly `user_id→profiles` + `base_id→bases`, so
PostgREST treats it as a profiles↔bases M2M junction — colliding with the direct
`primary_base_id` FK. `app/api/admin/users/[id]/route.ts` re-selected with an
unqualified `bases(...)` embed. Fixed by naming the FK: `bases!primary_base_id`.
Verified against the live REST API (old → PGRST201/300, new → 200). See
`project_postgrest_embed_ambiguity` memory.

### Help & Training (`/help`) overhaul

The in-app module-reference guides (`lib/training/modules.ts`, `MODULES`) plus the
Module Reference PDF export. Delivered in phases with owner review gates.

#### PDF export verified + smoke test (`51367577`)
Added `tests/training-pdf.test.ts` (the generator had zero coverage): renders the
full current guide set without throwing + a content-completeness guard. Confirmed
every referenced screenshot exists on disk and the export reads live `MODULES`.

#### Coverage gaps closed (`c34c7e7c`)
Three modules had no guide. Added `MODULES` entries for **Read File** (was
missing), the **Part 139 audit** (the `acsi` guide is `appliesTo:['usaf']`, so
civilian `/acsi` had none), and **FLIP** — migrated from an inline page-only
section into a real entry (exact DAFMAN 13-204V2 citations preserved) so it now
appears in the filtered grid + PDF. Corrected FLIP's stale `howToAccess` (it's
under the Admin sidebar section, not Airfield Management).

#### 34-guide currency pass (`809d8e21`)
Audited every guide against its live module + `sidebar-config.ts` via seven
parallel read-only subagents, synthesized, then applied ~60 fixes via one
implementation subagent (single file → no edit conflicts) with a full diff review
after. Highlights: 20 `howToAccess` corrections (the pervasive "Sidebar ›
Operations › X" is wrong — the section is "Daily Operations"; several were in the
wrong section or off-nav); the `dashboard` guide rewritten for the widget-board
system (was the retired fixed dashboard); `checks` real 8 types (was a stale 7);
`obstructions` dropped a nonexistent multi-point mode, added the UFC/Part 77
surface-set picker + NOTAM generator; `users` invite flow (active account + temp
password, no deep link); false "realtime" claims removed (`ces`, `activity`);
daily-reviews `v1→v2`. No fabricated reg text.

#### Screenshots recaptured + wired (`c9d4fd46`)
Owner supplied fresh captures. Read each image before captioning (caption-accuracy
rule). dashboard ×3 (widget board / add-widget palette / a second board),
daily-reviews reshot (sign modal now shows only Sign Review; list shows
date-range + Outstanding), obstructions ×2 (surface-set picker + NOTAM), and
first-time shots for Part 139 ×2 / FLIP ×3 / Read File ×2. Renamed the Part 139
guide to **"Part 139 Annual Inspection"** to match the app's own page label.

#### Test-timeout hardening (`248fc148`)
The full suite flaked on a slow machine — the heaviest tests (`run-export`/ExcelJS,
`amtr-transcribe` UI) finish in <1s normally but spike to ~15-20s under load and
blew the 5s default. Raised `testTimeout`/`hookTimeout` to 30s in `vitest.config.ts`.
Also dropped the now-unreferenced `public/training/obstructions_3.png`.

---

## Migrations status

No new migrations this session. Prior migrations through
`2026070700_add_part139_cover_fields` remain applied to the linked DB.

---

## Bugs fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| Broken PDF preview in daily-review dialog (+ /library, /regulations) | enforcing CSP `frame-src 'self' https:` doesn't match the `blob:` scheme | `c07333e0` |
| Google Maps editable-handle markers render as broken images | SW re-fetches img-src images to cache; that fetch is connect-src-governed, and gstatic was missing from connect-src | `b4c9b523` |
| User-management Save Changes → PGRST201 | `dashboard_user_defaults` junction made `profiles`↔`bases` embed ambiguous; unqualified `bases(...)` embed in the PATCH route | `1e94b086` |
| Part 139 form item numbers show `navaids.1` | form rendered the raw record id instead of a display number | `e8fa3e29` |

---

## Lessons from this session

- **CSP `connect-src` must mirror `img-src` for a PWA.** The service worker
  re-fetches cross-origin images to cache them, and a fetch is governed by
  connect-src, not img-src. Any host img-src trusts but connect-src omits →
  broken images. Non-obvious; cost a multi-session "question-mark markers" chase.
  Saved as `project_csp_connect_src_sw_fetch`.
- **A new 2-FK junction table silently breaks existing PostgREST embeds** between
  the two tables it joins (`PGRST201`). Hint the FK (`table!fk_column`). Saved as
  `project_postgrest_embed_ambiguity`.
- **Parallel-audit → single-writer-apply → full-diff-review** is a strong pattern
  for a large content sweep in one file: fan out N read-only agents to find, then
  one agent to apply (no edit conflicts), then review the whole diff yourself.
- **Verify a fix against the live REST API when you can.** The ambiguous-embed fix
  was confirmed end-to-end (old form → PGRST201, hinted → 200) before commit,
  using the anon key — the hint is validated before RLS.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| App-side dual-mode terminology (other modules) | med | `/discrepancies`, `/inspections`, `/checks`, `/qrc`, `/flip`, `/obstructions` still leak military terms on civilian tenants; `lib/airport-mode.ts` doesn't cover them. The Help guides are now current, but the modules themselves aren't fully mode-aware. |
| Part 139 audit P/F/N-A vs S/U/N-A inconsistency | low | list view + top progress bar read "Pass / Fail / N/A"; per-section tallies read "S / U / N-A". Cosmetic mismatch surfaced in the recaptured screenshots. |
| Part 139 guide `howToAccess` unverified | low | says "Daily Operations › All Inspections — … from the launcher"; the screenshots show a dedicated "Part 139 Annual Inspection" page but not the exact civilian nav path. Confirm on a civilian base. |
| Help screenshots are large PNGs | low | some source captures are 1–4 MB; they embed into the Module Reference PDF and the page. Consider downsizing `public/training/*.png` if PDF/page weight matters. |
| New Help guides text-only where noted | low | Part 139 / FLIP / Read File now have shots; captions were written from the images. |
| Civilian QRC templates title-only stubs | low | KDRA `qrc_templates` ×8 have "0 steps"; enrich for a richer `/qrc` frame. |
| Guidance accuracy-pass nits (Part 139) | low | `aep.6` citation `§325(f)` vs Order prose `§325(b)(9)`; `wildlife.10`/`arff.7`/`msl.10` glosses — all in-source, none fabricated, flagged in the SDD ledger. |
| Carried low items | low | status-page weather race (`app/(app)/page.tsx`); demo-form email-fail-after-insert silent; account-deactivation doesn't kill live sessions (`middleware.ts`); Selfridge 1098 dedup — unchanged. |

---

## Next session tasks

No required next step — pick up wherever the owner wants. The two biggest open
threads:

1. **App-side dual-mode terminology sweep** (med) — the Help guides are current,
   but the actual modules (`/discrepancies`, `/inspections`, `/checks`, `/qrc`,
   `/flip`, `/obstructions`) still hardcode military terms on civilian tenants.
   Mirror what ACSI/Part 139 and `lib/airport-mode.ts` already do.
2. **Part 139 audit polish** — the P/F-vs-S/U label inconsistency, and confirm the
   civilian `/acsi` nav path so the guide's `howToAccess` is exact.

Owner actions outstanding from the prior session: **promote** when satisfied
(owner owns Vercel promotion).

### Long-running carryover
Phase 5 apex cutover to `app.glidepathops.com`, SEO/rich-results, deferred audit
items, Next 16 — all owner-scheduled, unchanged.

---

## Build snapshot
```
airfield-app @ 248fc148: tsc ✓ · lint 0 errors (2 pre-existing warnings in
  lib/waiver-pdf.ts) · npx vitest run 1138 passed / 16 skipped (125 files) ·
  npm run build ✓.
  This session was data + fixes, not new routes: the main change is
  lib/training/modules.ts (34 → 37 Help guides + currency edits) and the
  public/training/*.png screenshots (static assets, no route-size impact).
  Code fixes touched next.config.js (CSP), app/api/admin/users/[id]/route.ts,
  lib/part139-cert-checklist.ts, app/(app)/acsi/*, app/layout.tsx, and
  vitest.config.ts. No route First Load JS moved materially.
```

---

## Recent releases
| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-07-05..09 | Marketing roster 36→50; **Part 139 certification-inspection readiness audit** (Form 5280-4, 22 sections/123 items); owner-testing **bug sweep** (CSP frame-src/connect-src, PostgREST embed, Part 139 item numbers, PWA toast); **Help & Training overhaul** — PDF export verified, Read File/Part 139/FLIP guides added, 34-guide currency pass, screenshots. Pushed, unpromoted. |
| **v2.35.0** | 2026-06-30 | Customizable widget dashboard; FLIP Management + Read File; PPR calendar + `.ics`; AMTR 803/1098; C2IMERA export; WWA server-side expiry; brand refresh. |
| **v2.34.0** | 2026-06-01 | Help & Training all modules; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination; Records Export. |

---

## Key docs / files touched this session
### New files
- `tests/csp-headers.test.ts` — CSP invariant guard (frame-src blob:, connect-src ⊇ img-src).
- `tests/training-pdf.test.ts` — Module Reference PDF smoke + guide content-completeness guard.
- `public/training/{dashboard_2,dashboard_3,part139-cert-audit_1,part139-cert-audit_2,flip_1,flip_2,flip_3,read-file_1,read-file_2}.png` — new Help screenshots.

### Modified files
- `lib/training/modules.ts` — 3 new guides + 34-guide currency pass + screenshots.
- `next.config.js` — CSP frame-src `blob:` + connect-src superset.
- `app/api/admin/users/[id]/route.ts` — `bases!primary_base_id` FK hint.
- `lib/part139-cert-checklist.ts` (+ `app/(app)/acsi/{new,[id]}/page.tsx`, `lib/acsi-pdf.ts`) — `acsiItemDisplayNumber`.
- `app/layout.tsx` — unmount `PwaUpdateToast`.
- `vitest.config.ts` — 30s test/hook timeout.
