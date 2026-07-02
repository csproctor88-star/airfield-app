# Session Handoff

**Date:** 2026-07-02
**Branch:** `main` — **pushed, in sync with origin**. The `workflow`-scope push
block is resolved; the `next15` branch was squash-merged and deleted.
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓ (Next 15, compiled
successfully; a green Vercel preview build confirmed it on Node 24 / Linux),
`npx vitest run` ✓ **1120 pass / 121 files**.
**HEAD:** `ef7c22ee` — Upgrade to Next.js 15.3.9 + React 19.

This session closed out the 2026-07-01 codebase audit and then moved the
framework forward. Three arcs: (1) the audit-remediation follow-on batch landed
and the whole P0–P4 body of work is now committed, pushed, and on `main`;
(2) server-side rate limiting shipped on the three anonymous public forms and
was **live-verified on the promoted build**; (3) the stack was upgraded to
Next 15.3.9 + React 19 on a branch, verified through a green Vercel preview,
and squash-merged. The audit HTML (`~/glidepath-audit-2026-07-01.html`) was
re-scored to reflect all of it (overall **B → A-**).

---

## What shipped this session (end state — read first)

### Public-write rate limiting, live-verified (`3f5e4dbe`)
The three anonymous QR/public forms (PPR request, safety report, feedback) POSTed
straight from the browser to their submit paths with no server hop, so nothing
throttled them. Each now goes through a thin API route
(`app/api/public/{ppr-request,safety-report,feedback}/route.ts`) that applies an
IP + base throttle via `lib/public-rate-limit.ts` — reusing the existing
`getClientIp` + `checkRateLimits` + `check_rate_limit` RPC (service-role client
for the limiter) — then calls the *same* SECURITY DEFINER RPC / anon insert as
before, so submission behavior is unchanged. Buckets: ip 10/hr, base 60/hr,
ip+base 5/10min; the limiter **fails open** if the service-role key is absent so
a broken limiter can never take down a public path.

Verified on prod against the `rate_limit_hits` table — `ppr-public`,
`feedback-public`, and `safety-public` buckets all record, and the safety form
(the only one with no client cooldown) returns the inline "Too many requests"
429 on the 6th rapid submit. Limits are shared across the three surfaces and were
left as-is by user decision. `tests/public-write-routes.test.ts` covers
400 / happy / 429 / fail-open + payload mapping.

### Next.js 14.2.35 → 15.3.9 + React 18 → 19 (`ef7c22ee`)
Squash of the `next15` branch. The async-request-api codemod handled the
mechanical parts (`await cookies()`/`headers()`, async `params` in the two
dynamic route *handlers* — `kiosk/[icao]`, `admin/users/[id]`). The parts the
codemod can't do were done by hand:

- `lib/supabase/server.ts` `createClient()` is now **async** (`await cookies()`)
  with its 3 callers awaited — this replaces the codemod's deprecated
  `UnsafeUnwrappedCookies` cast, which breaks in Next 16.
- `middleware.ts` needed **no change**: it reads `request.cookies` (the sync
  `NextRequest` API), not `next/headers`. The 14 dynamic `[param]` *pages* are
  client components using `useParams()`, so they're unaffected by async params.
- `app/(app)/library/page.tsx`: the `ssr:false` `next/dynamic` import of
  `PDFLibrary` was moved into a `'use client'` wrapper
  (`app/(app)/library/pdf-library-client.tsx`) — Next 15 forbids `ssr:false`
  inside a Server Component.
- `next.config.js`: `eslint.ignoreDuringBuilds = true`. Under CI (Vercel and
  GitHub Actions both set `CI=1`) `next build` escalates ESLint *warnings* to
  build failures, and this project keeps `no-explicit-any` / `no-unused-vars`
  at `warn`. Lint is now its own `ci.yml` step (`npm run lint`), which fails on
  errors but not warnings — restoring the pre-Next-15 effective behavior.
- `eslint.config.mjs`: register `@typescript-eslint` directly (eslint-config-
  next@15 dropped it from `next/core-web-vitals`), keeping the two warn rules
  without adopting `next/typescript`'s strict recommended set.

`next-pwa` 10.2.9 builds clean on 15 (service worker still generated);
`react-pdf` 10.4.1 already supports React 19. **Runtime QA on the promoted build
is still pending** (see Next session tasks).

### Audit remediation P0–P4 fully landed (`49cbdbe5`..`19075a53` + earlier P0–P3)
The follow-on batch from the 2026-07-01 audit is committed and pushed:
Events Log append-only + base-scoped delete, ppr-sequence permission half,
photos obstruction/email-temp base-scoping, 15 base_id-leading indexes, ACSI
per-fiscal-year unique, `/api/airfield-status` arbitrary-row fix, elevation
lat/lon validation + explicit permission checks on the two RLS-only routes,
discrepancies windowing, remaining PDF-route `await import()` splits, SMS/PPR
N+1 collapse to `.in()` batches, infrastructure double clear-and-rebuild removal,
polling back to ≥60s / visibility-gated, and the minority silent-return write
paths finished. Detail per finding lives in the audit HTML roadmap (now with a
P4 phase) and `project_release_history` memory.

---

## Migrations status

All applied to the linked DB via `npx supabase db query --linked --file` and
verified against `pg_policies` / `pg_indexes`. **No pending migrations.**

| File | State | What it does |
|---|---|---|
| `2026070101_drop_dead_update_airfield_status.sql` | Applied | DROP the dangling no-authz cross-tenant RPC (CRITICAL) |
| `2026070102_base_scope_cross_tenant_write_policies.sql` | Applied | base-scope `base_members` / `bases` UPDATE / child-table writes |
| `2026070103_pdf_text_pages_drop_stale_policies.sql` | Applied | drop the stale permissive `pdf_text_pages` policies by real names |
| `2026070104_waiver_attachments_base_scoped_storage.sql` | Applied | migrate waiver-attachments storage to path→base scoping |
| `2026070105_inspections_one_inprogress_per_day.sql` | Applied | scoped partial unique index (offline dup guard) |
| `2026070200_activity_log_base_scope_mutations.sql` | Applied | Events Log append-only + base-scoped UPDATE/DELETE |
| `2026070201_ppr_number_sequence_permission.sql` | Applied | permission half on the ppr-sequence write policy |
| `2026070202_photos_storage_base_scope.sql` | Applied | base-scope obstruction-photos reads + email-temp CRUD |
| `2026070203_base_id_leading_indexes.sql` | Applied | 15 base_id-leading indexes |
| `2026070204_acsi_one_completed_per_fiscal_year.sql` | Applied | partial unique on `(base_id, fiscal_year)` for completed/staffed |

(The `2026070100` AMTR 623A slots migration is from the prior session.)

---

## Lessons from this session

- **Next 15 `next build` fails on ESLint *warnings* under CI** (`CI=1`), while a
  local build treats them as non-blocking. The fix is to decouple lint from the
  build (`eslint.ignoreDuringBuilds`) and run `next lint` as its own CI step —
  it follows ESLint exit semantics (errors fail, warnings don't).
- **The codemod can't async-ify a wrapper.** `lib/supabase/server.ts` hides
  `cookies()` behind our own `createClient()`, so the codemod fell back to the
  deprecated `UnsafeUnwrappedCookies` cast. Making the wrapper async + awaiting
  its callers is the durable fix (the cast breaks in Next 16).
- **next-pwa 10.2.9 and react-pdf 10.4.1 are Next-15 / React-19 ready** — the two
  pre-flight risks that could have blocked the upgrade both cleared.
- **Vercel's git webhook fired intermittently for the `next15` branch** (2 of 3
  pushes produced no deploy); an empty-commit re-push nudged it. `main` pushes
  fired reliably every time — this was branch/one-off flakiness, not config.
- **The safety-report form is the honest test of server rate limiting** — it has
  no client localStorage cooldown, unlike PPR and feedback, so it's the only one
  where the "wait a few minutes" screen means the *server* 429 (not the client
  cooldown that also exists in the old build).

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| Next 15 runtime QA not done on the promoted build | med | tsc/build/tests + a green Vercel *preview* pass; auth/session (async cookies), the 3 async `createClient` callers (/library, amtr-reconcile, infra-import), dynamic routes, PWA offline-queue, and the caching-defaults flip are only verifiable on a running deploy. |
| Deferred audit items | low | 26 nullable `base_id` columns need `SET NOT NULL`; qrc natural-key uniques; AMTR controlled-input conversion (46 `defaultValue` inputs); shift-checklist queue-wire. All deferred by explicit choice. |
| 9 npm advisories | low | 0 crit · 7 mod · 2 high. All transitive build-time (`next-pwa→workbox`, `tar`) or the no-safe-fix `exceljs→uuid`. None runtime-exploitable. |
| Selfridge 1098 duplicate rows (carried) | low | data cleanup in AMTR, not code. |
| Current reference docs local-only (carried) | low | briefs/spec/terminology live in gitignored `docs/references/`. |

---

## Next session tasks

**One required follow-up: runtime QA of the Next 15 build on the promoted deploy.**
`main` (`ef7c22ee`) will build a Vercel preview on push; promote it, then verify
on the promoted build:

- **Auth/session** (top priority — async `cookies()`): login → hard-refresh
  (session persists) → logout → hit a protected route logged-out (→ `/login`).
- The **3 async `createClient` callers**: `/library` (PDF viewer loads), an
  **AMTR reconcile**, an **infrastructure import**.
- **Dynamic routes**: a `[id]` page + a public `/<icao>/ppr-request`.
- **PWA**: install → offline → queue a write → reconnect → it flushes.
- A map page + one form submit, to eyeball React 19 rendering.

If anything's off, fix on a branch (don't hand-edit `main` under a live promote).

### Long-running carryover (bandwidth-permitting)
- The deferred audit items above (nullable `base_id`, qrc uniques, AMTR
  controlled inputs, shift-checklist queue-wire).
- Optional: Next 16 as its own branch effort (15 was banked first; next-pwa is
  even less proven on 16, so gate on that).
- Selfridge 1098 dedup; local-only reference docs.

---

## Build snapshot

```
build: compiled successfully (Next 15.3.9; green Vercel preview on Node 24/Linux)
tsc:   no errors
tests: 1120 pass / 121 files

Notable First Load JS (Next 15):
  First Load JS shared            106 kB
  Middleware                      80.8 kB
  /wildlife                       236 kB   (heaviest; was 809 kB pre-hardening)
  /library                        ~92 kB   (ssr:false PDFLibrary now in a client wrapper)
  /training/[userId]              198 kB
  /waivers/[id]                   221 kB
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-07-02 | Codebase-audit remediation P0–P4 (cross-tenant RLS, silent-save/return sweep, CI, bundle splits, base_id indexes). Public-write rate limiting on the 3 anon forms, live-verified. Next.js 15.3.9 + React 19 upgrade. |
| **Unreleased** | 2026-07-01 | Visual NAVAIDs: AGM + Do Not Enter signs, reflectors, taxiway-light sizing, inoperative ring. Inspection offline-queue orphaning + complete-hang fix. AMTR records-inspection 623A signed by Trainee + NAMT (not Trainer). |
| **v2.35.0** | 2026-06-30 | Customizable widget dashboard; FLIP Management + Read File modules; PPR calendar + `.ics`; AMTR 803/1098; C2IMERA export; WWA server-side expiry; brand refresh. |
| **v2.34.0** | 2026-06-01 | Help & Training all modules; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination; Records Export. |

---

## Key files touched this session

### New files
- `lib/public-rate-limit.ts` · `app/api/public/{ppr-request,safety-report,feedback}/route.ts`
- `app/(app)/library/pdf-library-client.tsx`
- `tests/public-write-routes.test.ts`
- 10 migrations `2026070101`–`2026070204` (see table)

### Modified files
- `lib/supabase/server.ts` (async `createClient`), `next.config.js`
  (eslint decouple), `eslint.config.mjs`, `.github/workflows/ci.yml` (lint step),
  `tsconfig.json` (Next auto target ES2017)
- The public forms (`components/ppr/public-request-form.tsx`,
  `components/sms/public-safety-report-form.tsx`, `lib/supabase/feedback.ts`)
  repointed to the rate-limited routes
- ~20 route handlers + `tests/kiosk-route.test.ts` (async request APIs)
