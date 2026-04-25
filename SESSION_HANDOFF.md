# Session Handoff

**Date:** 2026-04-25
**Branch:** `main`
**Build:** Clean — `npm run build` exits 0; `npx tsc --noEmit` exits 0; `npx vitest run` 165 pass
**HEAD:** `bd18084`

---

## What shipped this session (chronological)

11 commits on `main`, no migrations.

### Closing out the previous session's P2 list

1. **Kiosk route tests** (`tests/kiosk-route.test.ts`, 13 cases) — invalid ICAO, missing `KIOSK_PASSWORD`, no token, base-not-found, ICAO uppercasing, `kiosk_token=NULL` (disabled), token mismatch, length-mismatch short-circuit, happy path, auto-provision success, `createUser` failure (rotated password), retry sign-in failure. Hoisted mock state so each case sets up its own scenario without re-mocking.

2. **`'use client'` server-import audit** — greppped `app/api`, `app/**/route.ts`, `middleware.ts`, `app/auth` for imports of all six `'use client'` modules (`permissions`, `dashboard-context`, `installation-context`, `sidebar-context`, `theme-context`, `use-expiring-notams`). Zero hits — the `getPermissionsFor → permissions-server.ts` split during the prior session closed the only real offender.

3. **Onboarding email polish** — approval email already had a working "Log In to Glidepath" button (added during the site-url fix). Added a "Forgot your password? Reset it here" link below it for users whose password grew stale between signup and approval. Reset URL is derived from the login URL.

### PDF / export polish

4. **SCN monthly PDF header** — caller was passing `'SCN Daily Check Log'` as the `baseName` parameter, which rendered as a small uppercase line directly above the 16pt title with only 4mm spacing → visible overlap. Dropped the small line entirely (it was redundant with the main title) and removed the unused `baseName` / `baseIcao` fields from `ScnPdfInput`.

5. **ACSI PDF "Risk Control Measure" label** — `lib/acsi-pdf.ts:303` now reads `Risk Control Measure:` instead of `Risk Control:` to match the form label.

### iOS PWA fixes

6. **Text-input scroll jump** — every text-entry element with `font-size < 16px` triggered iOS Safari's auto-zoom-on-focus, which manifested in the PWA as the layout scrolling to the bottom and hiding the input. Added a mobile-only (`@media (max-width: 767px)`) rule in `globals.css` forcing 16px on text/email/password/tel/number/search/url/date/datetime-local/time/month/week/textarea/select/typeless-input. Desktop type scale untouched.

7. **Bottom nav drifting mid-UI** — iOS anchors `position: fixed` to the layout viewport, not the visual viewport, so when the soft keyboard opens the nav drifts. New `useKeyboardOpen()` hook in `components/layout/bottom-nav.tsx` watches `VisualViewport` resize/scroll events; when `window.innerHeight − vv.height > 150px` (keyboards are 260–380px tall, browser-chrome collapse < 100px) it adds `.bottom-nav-keyboard-open` which hides the nav with `display: none !important`.

### Airfield diagram upload — five-commit saga

The bug surfaced as "Failed to upload diagram: resource already exists" → "new row violates RLS" → 413 Content Too Large. Final architecture:

8. **Service-role API route** — `/api/admin/airfield-diagram` (POST upload, DELETE remove, GET existence + `updated_at`). Authorizes on `base_setup:write` + base membership (sys_admin bypass). Uses `getAdminClient()` (service role) for the storage write, which bypasses `storage.objects` RLS entirely — sidesteps the photos:write / photos:delete role-gap that surfaced for ces / safety / ppr.

9. **Explicit remove-then-upload** instead of `upsert: true` — service role bypasses RLS on both, and `remove()` on a non-existent object is a no-op. This avoids upsert edge cases around the existing object's owner metadata (set to whichever user did the original upload) conflicting with a service-role update.

10. **URL cache-busting** — storage path is fixed per base, so without a cache-buster the browser / CDN keep serving the old diagram after replace. New `GET /api/admin/airfield-diagram` uses service-role `list()` for authoritative existence + `updated_at`. `getAirfieldDiagram` now appends `?v={updated_at}` so the URL changes when the file does, but caching still works between changes. Replaced the old HEAD-probe approach (which got false-positives from CDN-cached 200s after delete).

11. **Client-side resize** — `resizeImageForUpload(file, 2400, 0.85)` runs before upload to keep payloads under Vercel's 4.5 MB serverless body limit. Phone photos and high-DPI scans were tripping 413 at the edge before our route ever saw them. 2400px max dimension keeps runway numbers / annotations legible while dropping a typical diagram to 500 KB – 1.5 MB.

12. **PDF removed from accept list** — UI preview is `<img>` (can't render PDFs), and jsPDF's `addImage` can't embed them in inspection / check exports. File picker accept tightened to `image/png,image/jpeg`; route MIME allowlist matches.

### Offline behavior — visible failure, spec'd queue

User reported completing an inspection offline, tapping File, and having nothing sync once reconnected. Glidepath has no offline write queue — every Supabase call is `NetworkOnly` per `next.config.js:11`. Two short-term mitigations and a future-feature spec:

13. **OFFLINE pill in header** — new `useOnlineStatus()` hook in `components/layout/header.tsx` watches window `online` / `offline` events. Red pill appears next to the existing presence label when `navigator.onLine === false`.

14. **Inspection File hard-fail when offline** — `handleComplete()` now bails before doing partial work with an 8-second toast: *"You're offline. Your inspection is saved as a draft — re-open and tap File when your connection is restored."* Drafts continue to auto-save to localStorage so the work isn't lost.

15. **Spec for the real fix** — `docs/Offline_Write_Queue_Spec.md`. IndexedDB-backed queue, BackgroundSync drain, conflict resolution per write type, optimistic UI, 7-step rollout starting with inspections. Effort estimate 2–3 weeks plus field testing.

### Onboarding doc

16. **Codebase primer** — `docs/Glidepath_Codebase_Primer.md`. Self-paced 10-phase learning plan for non-dev readers needing to speak fluently to the codebase for sales / fundraising / acquirer conversations. Each phase has concepts, reading list, talking points, quiz questions, and "ask Claude" prompts.

---

## Migrations added this session

**None.** All work was code-only.

The migrations from the prior session (`2026042300`, `2026042301`) are reportedly applied to prod (P1 confirmed done by the user).

---

## Known Issues & Tech Debt

| Item | Severity | Notes |
|---|---|---|
| **`.env.local` modified** | Trivial | Local-only; always skip on commits. |
| **`docs/DEMO_LOGINS.md` untracked** | Trivial | Untouched this session; left for the user to decide. |
| **No offline write queue** | Medium | Spec'd in `docs/Offline_Write_Queue_Spec.md`. Today's mitigation makes the failure mode visible (OFFLINE pill + hard-fail toast on inspection File) but the queue itself remains unbuilt. Highest-impact UX gap for field users on intermittent connections. |
| **Airfield diagram preview can't render PDFs** | Low | Disabled at the file picker. If PDF support is wanted, need an iframe / PDF.js preview + first-page rasterization for downstream embeds. |
| **Browser extension "message channel closed" errors** | Trivial | Emitted by password managers / Grammarly / Honey. Not from our code; users may ask. |
| **Supabase types may need regen** | Low | Tightened a couple of files this session via inline `as` casts. Last regen was 2026-04-22. Run when next migration lands. |
| **`'use client'` import trap** | Low | Audited clean this session. Worth adding to CI as a grep-rule before next major release. |
| **~117 `as any` casts remain** | Low | Unchanged. |
| **Largest source files** | Medium | `base-setup/page.tsx` 4,900+ LOC, `parking/page.tsx` 4,334, `infrastructure/page.tsx` 4,150. |
| **Storage RLS path-scoping rolled back** | Low | Migration `2026042208` swapped the photos storage policies from path-scoped to permission-based (`photos:write` / `photos:delete`). A future hardening could re-introduce the path scoping, especially for `airfield-diagrams/{baseId}/...` and entity photo paths. |

---

## Next Session Tasks (Prioritized)

### P1 — verify this session's work
1. **Verify all 2026-04-25 fixes deployed and working in production.** No migrations, so this is a Vercel deploy-confirm exercise:
   - SCN monthly PDF header — no overlapping text
   - ACSI PDF — "Risk Control Measure:" label
   - iOS PWA — text-input scroll jump fixed; bottom nav stays put when keyboard opens
   - Airfield diagram replace — uploads PNG/JPG, replaces show new image immediately, large files don't 413
   - OFFLINE pill appears when network is killed; File button on `/inspections` shows the new toast when offline
2. **Regen Supabase types** if any new migration is queued. Last regen was 2026-04-22.

### P2 — keep tightening
3. **Build the offline write queue** (spec at `docs/Offline_Write_Queue_Spec.md`). Highest-impact UX work. Rollout order suggested in the spec: inspections → checks → discrepancies → ACSI → daily reviews → photo uploads → everything else.
4. **CI rule for `'use client'` server-import trap.** Simple grep step in pre-deploy: error if any file under `app/api/`, `app/**/route.ts`, or `middleware.ts` imports from a `lib/*.ts(x)` whose first line is `'use client'`.
5. **Audit remaining iOS PWA quirks** that may surface from real-device usage. The two we fixed were the obvious ones; more are likely lurking (modal dialog scroll inside inputs, file-picker double-tap, etc.).
6. **Tests for the new airfield-diagram route.** POST happy path, POST oversize, POST unsupported MIME, POST without auth, GET happy path, GET no diagram, DELETE happy path. Follows the pattern of `tests/kiosk-route.test.ts`.

### P3 (multi-session)
- Platform One Party Bus onboarding — scaffold at `C:/Users/cspro/Downloads/glidepath/glidepath-local-dev/`. ~6–8 weeks.
- CAC/PIV authentication — blocked on P1.
- Component extraction for 4K+ LOC pages (`base-setup`, `parking`, `infrastructure`).
- Re-introduce path-scoped storage RLS for `airfield-diagrams` and entity photo paths.
- Outage analytics (frequency / duration tracking for lighting systems).
- Training Management Module (DAF training records).
- Part 139 civilian template support.
- Trademark resolution — CDW Class 42 conflict on "GLIDEPATH" remains.

---

## Commits this session

```
137a285  Add kiosk route tests and password-reset hint in approval email
3ba73c3  Fix overlapping text in SCN monthly PDF header
2960758  Label ACSI PDF risk-control field as 'Risk Control Measure'
2f2b3ac  Fix iOS PWA text-entry scroll jump and bottom-nav drift
3407e84  Fix airfield diagram replace — use upsert instead of remove+upload
6869c6e  Route airfield diagram upload through service-role API
042a97f  Cache-bust airfield diagram URL so replace actually shows new image
461b170  Switch airfield diagram upload to explicit remove+upload
56cc838  Resize airfield diagram client-side to dodge Vercel 413
5754ee6  Add codebase primer for non-dev commercialization prep
bd18084  Add OFFLINE pill + offline-aware File toast for inspections
```

Branches: `main` only.

---

## Build Snapshot

```
Compiled successfully
  TypeScript clean (`npx tsc --noEmit` exit 0)
  Tests: 165 pass (13 new kiosk-route.test.ts; rest unchanged from prior session)
  All routes generate cleanly

  Notable First Load JS:
    /wildlife                        788 kB   (heatmap)
    /parking                         411 kB   (+13 kB this session — no parking changes; bundling drift)
    /reports/aging                   331 kB
    /reports/discrepancies           330 kB
    /obstructions/[id]               327 kB
    /reports/daily                   322 kB
    /reports/lighting                317 kB
    /reports/trends                  315 kB
    /library                         292 kB
    /settings/base-setup             233 kB
    /inspections                     229 kB   (no change — offline guard is tiny)
    /discrepancies                   224 kB
    /settings                        200 kB
    /regulations                     182 kB
    /scn                             181 kB
    /more                            177 kB
    /settings/base-setup/modules     176 kB
    /recent-activity                 160 kB

  Middleware                         74.4 kB  (unchanged)
```

---

## Recent Releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-04-25 | iOS PWA fixes, airfield diagram upload rewrite, OFFLINE pill, codebase primer + offline-queue spec, kiosk tests, PDF polish |
| **Unreleased** | 2026-04-22 | Email flow fixes, Safety role gate closeout, kiosk auto-login, shared PDF utility |
| v2.32.0 | 2026-04-21 | Modular Onboarding, SCN, Close-for-Day, What's New modal |
| v2.31.0 | 2026-04-07 | Full Google Maps migration, Custom Status Boards, PPR Log |
| v2.30.0 | 2026-04-14 | Daily Reviews + shift sign-off, ARFF status log, Vitest scaffold |
| v2.29.0 | 2026-04-02 | Training system, 12-step base setup wizard, dark mode readability |

See `CHANGELOG.md` for full history.
