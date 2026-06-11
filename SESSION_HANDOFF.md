# Session Handoff

**Date:** 2026-06-11
**Branch:** `main` — pushed to origin (`2d5b4e16`); promote on Vercel when ready.
Still v2.34.0. Invite route now also surfaces email-send failures in the UI.
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓, `npx vitest run` ✓
**866 pass / 90 files**.

---

## 2026-06-11 — Full pentest + remediation (Fable 5 audit → fixes)

A 77-agent Fable 5 pentest (report at `docs/security/Pentest_Audit_Fable5_2026-06-11.md`)
found 2 Critical / 6 High / 7 Med / ~18 Low. Every Critical/High was
**re-verified against real code AND the live DB** before fixing. Status:

**Fixed + verified (code in working tree; tsc/build/vitest green):**
- **C-1** installations IDOR — `app/api/installations/route.ts` now requires
  auth + `userId===auth.uid()` on membership write/delete.
- **C-2** profiles privilege-escalation — trigger `profiles_block_priv_escalation`
  hardened to block ALL JWT role/status/is_active changes (migration
  `2026062013`, **APPLIED LIVE**); `setup-account` no longer writes `status`.
  **Exploit-verified blocked on prod** (rolled-back simulation).
- **H-1** `send-pdf-email` — RLS-scoped download (no service-role bypass) + 20 MB cap.
- **H-2** `user-emails` — base-scoped via `canBaseAdminManageUser`; recipient
  derived from the target profile, not the body.
- **H-3** `admin/invite` — per-invite `crypto.randomBytes` temp password (was the
  universal static `glidepathpassword`).
- **H-4** stored XSS — shared `escapeHtml` in `lib/utils.ts` applied to all 4 map
  InfoWindows (infrastructure/discrepancy/waiver/obstruction). Unit-tested.
- **H-6** daily-review forgery — `sign_daily_review_slot` SECURITY DEFINER RPC
  (migration `2026062013`, **APPLIED LIVE**) derives signer from `auth.uid()`,
  enforces per-slot permission; client wired to the RPC.
- **M-1** airfield-status GET base leak; **M-4** `getClientIp` XFF-spoof;
  **M-6** forgot-password allowlist; **M-7** sms-report allowlist; **L-4**
  fail-open middleware (prod fail-closed); **L-17** airfield-status PATCH
  mass-assignment allowlist.

**H-5 (photos bucket) — converted via an authenticated proxy.** Rather than
async signed-URL plumbing, all photo reads now go through `app/api/photos/route.ts`
(streams via the caller's RLS-scoped client). `lib/supabase/photos.ts` →
`photoUrl()` returns `/api/photos?path=…` (sync, stable, no expiry). All ~13
`getPublicUrl('photos')` call sites converted (PDF generators, galleries,
exports, airfield-diagram, upload helpers). Build/tsc/vitest green; proxy
rejects anonymous reads (scripted).

**L-6 CSP** added in **report-only** mode (next.config.js) — compensating
control for the JS-readable cookie; promote to enforcing after monitoring.
**I-4** `poweredByHeader:false`. **M-5** edge-fn versions pinned.

**Staged — apply AFTER the code deploys (would break prod if applied early):**
- `2026062014_daily_reviews_lockdown.sql` — REVOKE direct daily_reviews writes.
- `2026062015_photos_bucket_private.sql` (**H-5 flip**) — base-scoped SELECT
  policy + bucket→private. Header now also flags: rewrite legacy PERSISTED
  public URLs (AEP/WHMP/§139-training/obstruction rows) to the proxy form
  before flipping, then visually confirm galleries/PDFs render.

**Not yet done (lower-severity / product decisions):** L-2 send-ppr authz, L-7
demo-creds gating (left as-is — gating could break prod sales demos; isolate
demo to a separate project instead), M-2 kiosk session lifecycle, M-3 anon-RPC
rate limiting, I-3 constant-time CRON compare, Next.js 14.2.x→15 upgrade,
remaining Lows/Info.

---

## What shipped this session

Two themes, both application code. First a brand-logo refresh across the login
screen, sidebar, and PWA/favicon icons. Then a feature pass on the **Daily
Reviews** module: reach and complete reviews older than 14 days, a date-range
filter that drives the list, a timeframe certification-log PDF, and removal of
the unused per-review email/delivery flow. The Daily Reviews work was specced,
planned, and executed task-by-task via subagent-driven development with
per-task spec + quality review.

### Logo refresh (`20a77d57`, `441ccf91`, `c4e90b46`, `a7b2af2a`)

Replaced the login and sidebar wordmarks with dedicated light/dark artwork
(navy on light, white + blue swoosh on dark) and regenerated the installed-app
icon from the "PATH" composition plus a legible airplane-mark `favicon.ico`.

The non-obvious part: the login logo was a theme-conditional `<img src>` keyed
on React `resolvedTheme`. That **SSR-mismatches** — the server renders with the
provider's default (`dark`), paints the white logo, and never corrects after
hydration because the post-hydration state equals the initializer (no
re-render). Result: white logo on the cream login background. Fixed by swapping
the logo via **CSS on the `[data-theme]` attribute** (set pre-hydration by the
inline theme script) instead of React state — both variants ship in the DOM,
CSS shows the right one, no flash, no mismatch. The sidebar was already safe
because the app shell paints client-side behind the auth gate.

Also: the source PNGs were 4961×3508 with the artwork floating in different
positions per variant, so they were trimmed to their content bbox for
consistent framing (a re-export reverts to the full canvas — re-trim on every
new drop). `441ccf91` removed the superseded `glidepath2.png` /
`glidepathdarkmode3.png` / stale `icon-*.svg`. `c4e90b46` dropped the sidebar's
"Guiding You to Mission Success" text line (the new wordmark reads complete).
`a7b2af2a` is a brightness bump to the dark login art.

### Daily Reviews — older-review access + date-range filter (`8a2cb29`, `b5585961`, `7d71a68c`)

The list was hard-capped at the last 14 days (UI only — the data layer never
restricted back-dated signing). Now a **date-range filter** (presets 7/14/30/90
+ MTD + custom start/end) drives the visible list: a descending day-spine over
the chosen range, capped at 370 rendered cards for the view (the PDF export is
uncapped). The same range feeds Export directly, so the originally-built
standalone export modal was removed (`7d71a68c`). An **⚠ Outstanding** section
surfaces uncertified reviews older than the range start so overdue days can't
hide; clicking any day (or Outstanding row) opens the sign modal for that date.

Toolbar gotcha worth pinning: the global `input-dark` class stretches buttons to
**full width**, which stacked every preset on its own row — the toolbar chips
are now styled inline (`chipBtn`) instead.

### Daily Reviews — certification-log PDF (`63507e8`, `33471fe`)

New `lib/reports/daily-review-log-data.ts` (pure, unit-tested: `buildReviewDateSpine`,
`buildCertLogRows`) + `lib/reports/daily-review-log-pdf.ts`
(`generateDailyReviewLogPdf`, landscape roster via `pdf-utils` + autotable):
one row per calendar day in the range, slot columns showing `Last (initials)`,
a Certified column (Zulu time or `PENDING` / `PENDING (no entry)`), a summary
stat box, and a notes appendix. New `fetchReviewsInRange` /
`fetchOutstandingReviews` queries; `signerCompact` lifted into the data layer
and shared with the page.

### Daily Reviews — sign-modal delivery removal (`61ca8cb`, `25626121`)

The per-review sign modal auto-opened an email dialog on full certification and
carried Email/Download buttons — all unused. Removed `EmailPdfModal`,
`sendPdfViaEmail`, the buttons, and the `defaultPdfEmail` prop (which also
touched a second caller in `app/(app)/activity/page.tsx`). Signing now simply
closes the modal (committed and queued paths). The left **Daily Ops PDF
preview** — the content being reviewed — is retained; `generateDailyOpsPdf`
(still used by `/reports/daily`) is untouched. `25626121` removed the
write-only `reportData` state left behind.

Spec + plan live at `docs/superpowers/specs/2026-06-10-daily-reviews-history-and-report-design.md`
and `docs/superpowers/plans/2026-06-10-daily-reviews-history-and-report.md`.

---

## Migrations status

No new migrations this session. The two prior remain applied live, none
pending:

| File | Applied | What |
|---|---|---|
| `2026062011_rls_pentest_remediation.sql` | ✅ live | trigger + scoped SELECT policies (pentest findings #1–#5) + backfill |
| `2026062012_harden_base_access_null.sql` | ✅ live | `user_has_base_access` NULL → FALSE |

---

## Bugs fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| Login showed the white (dark) logo on the cream light background | Theme-conditional `<img src>` SSR-painted the default-`dark` asset; React never re-rendered post-hydration (state == initializer) | `a7b2af2a` (CSS `[data-theme]` swap) |
| Daily Reviews list ignored the range, still 14 days | Range selectors lived only in the export modal; the list used a hardcoded 14-day loop | `b5585961` |
| Toolbar preset buttons stacked full-width | Global `input-dark` class forces `width:100%` on buttons | `b5585961` (inline `chipBtn`) |

---

## Lessons from this session

- **`input-dark` stretches buttons to full width.** It's an input class; using
  it on toolbar buttons makes each one a full-width row. Style compact toolbar
  chips inline instead. (Saved as a feedback memory.)
- **Theme-conditional `<img src>` on a server-rendered page mismatches.** Server
  paints the provider default, and if the post-hydration theme value equals the
  state initializer there's no re-render to correct it. Swap theme-dependent
  images via CSS on `[data-theme]` (set pre-hydration), not React state.
- **`git add A B` aborts staging when B doesn't match** — a commit landed with
  only a file deletion because the second pathspec (an already-removed file)
  errored and `page.tsx` was never staged. Stage one path at a time, or
  `git status` before committing.
- **Re-exported PNG logos revert to the full canvas** — re-trim to the content
  bbox on every new drop so light/dark variants frame identically.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| Independent human review of pentest fixes #1/#2 | Low | Deferred indefinitely (2026-06-11) — user will accomplish eventually; second set of eyes on trigger + `profiles` scoping before the Platform One assessment. |
| `scn` missing on 26 USAF bases | Med | Carried — frozen-`enabled_modules`; mirror `2026062000`. |
| New `defaultEnabled` modules don't reach existing bases | Med | Carried — systemic null-only fallback in `lib/installation-context.tsx`. |
| AMTR notif system not fully walked on deploy | Med | Carried — `8ec3c8b2` (certifier) + `a154631a` (real-time on-sign). |
| usr-analytics privacy disclosure | Med | Carried — per-user usage tracking has no user-facing line. |
| `types.ts` regen deferred | Med | Carried — several `amtr_*` tables hand-typed; route handlers cast `as any`. |
| Base-setup file extraction deferred | Med | Carried — `base-config/setup/page.tsx` ~6k LOC. |
| v2.34 not yet walked on the deploy | Med | Carried. |
| In-app training-video embed not built | Low | Carried — `/help/[module-id]` YouTube iframe + blocked-network fallback is a deferred spec (see the video plan doc). |
| Other module save handlers not audited for silent no-base guards | Low | Carried. |
| Test-account fixtures live in prod | Info | Carried — `__TEST_RLS__` bases + `rls-*@glidepath-rls-test.com`. |

---

## Next session tasks

**Done 2026-06-11 (user-verified):** the RLS pentest walkthrough on a promoted
Vercel build is complete, and the Daily Reviews cert-log PDF was reviewed on
real data.

**Closed 2026-06-11:** Vercel auto-promote — decided **against**; manual promote
is deliberate. The user owns promotion and will promote what's ready — do not
add promote reminders or "verify on a promoted build" follow-ups.

The independent review of pentest fixes #1/#2 is **deferred indefinitely** (user
will get to it eventually) — tracked under long-running carryover, not an active
task. No required next step is queued.

### Long-running carryover (bandwidth-permitting)
- Independent review of pentest fixes #1 (escalation trigger) and #2
  (`profiles` scoping) — deferred indefinitely; user-owned.
- Record the onboarding videos against the Demo base per
  `docs/Video_Walkthrough_Production_Plan.html`; build the in-app
  `/help/[module-id]` embed later.
- Extend no-base toasts to any module save that still silently no-ops.
- Promote `8ec3c8b2` and walk the AMTR notification system end-to-end.
- `scn` `enabled_modules` backfill; the systemic `enabled_modules` fallback fix.
- usr-analytics privacy copy; `types.ts` regen; `base-config/setup` extraction.
- v2.34 deploy walk; the prior AMTR inspection-engine batch walk.

---

## Build snapshot

```
Build: npm run build — compiled successfully.
TypeScript clean (npx tsc --noEmit exit 0).
Tests: 859 pass / 89 files (npx vitest run) — incl. new tests/daily-review-log.test.ts.

Routes touched this session (First Load JS):
  ○ /daily-reviews          345 kB   (range filter + Outstanding + export)
  ○ /login                  169 kB   (theme-aware logo swap)
First Load JS shared        91.5 kB
Middleware                  74.5 kB
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-06-10 | Brand-logo refresh (theme-aware login/sidebar + new PWA/favicon icons); Daily Reviews gains date-range filtering, an Outstanding (overdue) section, a timeframe certification-log PDF, and drops the unused per-review email/delivery flow |
| **Unreleased** | 2026-06-07 | RLS/authorization pentest remediation: closed self-escalation to sys_admin + four cross-tenant read leaks (`2026062011`), removed the NULL-base_id escape hatch (`2026062012`), scoped the offline write queue per-user, no-base saves toast |
| **Unreleased** | 2026-06-05 | Offline write-queue coverage for the airfield-status board, NAVAID grid, New Discrepancy, Report Outage; realtime-down flag hardening |
| **v2.34.0** | 2026-06-01 | Help & Training covers every module + airport-type gating; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination + notify; Records Export; grouped What's New |
| v2.33.0 | 2026-05-02 | Glidepath Training rebuilt, permission-matrix overhaul, PPR module, offline reads + writes |

---

## Key docs / files touched this session

### New files
- `lib/reports/daily-review-log-data.ts` — pure spine/roster helpers (TDD).
- `lib/reports/daily-review-log-pdf.ts` — certification-log PDF generator.
- `tests/daily-review-log.test.ts` — unit tests for the pure helpers.
- `public/Glidepath_logo_login_{light,dark}.png`,
  `public/Glidepath_logo_sidenav_{light,dark}.png`,
  `public/Glidepath_logo_PWAicon_dark.png`, `public/favicon.ico`,
  `public/apple-touch-icon.png` — new brand assets.
- `docs/superpowers/specs/2026-06-10-daily-reviews-history-and-report-design.md`,
  `docs/superpowers/plans/2026-06-10-daily-reviews-history-and-report.md`.

### Modified files
- `app/(app)/daily-reviews/page.tsx` — range filter, Outstanding section, direct
  export.
- `components/daily-reviews/sign-modal.tsx` — delivery removed; close on sign.
- `lib/supabase/daily-reviews.ts` — `signerCompact`, `fetchOutstandingReviews`,
  `fetchReviewsInRange`.
- `app/login/page.tsx`, `components/layout/sidebar-nav.tsx`, `app/globals.css`,
  `app/layout.tsx`, `public/manifest.json` — logo wiring + CSS theme swap.

### Removed
- `components/daily-reviews/export-modal.tsx` — superseded by the on-page range
  filter + direct export.
- Orphaned logo assets (`glidepath2.png`, `glidepathdarkmode3.png`,
  `glidepath-logo-dark.jpg`, `icon-*.svg`).
