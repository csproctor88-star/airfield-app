# Session Handoff

**Date:** 2026-06-14
**Branch:** `main` — pushed to origin, in sync (`40086c7a`). Promote on Vercel
when ready. Still v2.34.0 (no bump).
**Build:** Clean — `npx tsc --noEmit` ✓, `npm run build` ✓ (109 static pages),
`npx vitest run` ✓ **866 pass / 90 files**.
**HEAD:** `40086c7a`

---

## What shipped this session

A full-codebase security pentest (77-agent Fable 5 audit; report at
`docs/security/Pentest_Audit_Fable5_2026-06-11.md`) found 2 Critical / 6 High /
7 Medium / ~18 Low. Every Critical/High was **re-verified against the real code
AND the live database** before any fix — several were confirmed by rolled-back
exploit simulations against prod. The two Criticals and five of six Highs are
closed in code; H-5 (photos) is code-complete with its DB flip staged. Then a
round of verification-feedback fixes (invite email surfacing, forgot-password
email, PDF table layout, AEP authoring access). The prior session's logo refresh
+ Daily Reviews work is already on `main` (see Recent releases).

### Pentest remediation — Criticals + Highs (`2d5b4e16`)

- **C-1 — installations IDOR.** `POST/DELETE /api/installations` ran with the
  service-role key and trusted a client `userId`, so any caller could enroll
  themselves into (or force-move another user into) any base — full cross-tenant
  read access since `base_members` is the gate for `user_has_base_access`. Now
  requires auth and `userId === auth.uid()` on every membership write/delete.
- **C-2 — profiles self-escalation to `sys_admin`.** `profiles_update` RLS
  allows self-update (`id = auth.uid()`) and the old `2026062011` trigger only
  fired for callers *without* `users:manage` — which `base_admin`/`airfield_manager`/
  `namo` all hold (confirmed in `role_permissions`). So any of those roles could
  `update profiles set role='sys_admin'` from the browser console. Fix: the
  trigger now blocks **all** JWT-authenticated changes to `role`/`status`/
  `is_active` (service-role admin routes have `auth.uid()` NULL and still work);
  `setup-account` no longer writes `status`. Migration `2026062013`, applied live;
  **exploit-verified blocked** (rolled-back sim returned the deny).
- **H-1 `send-pdf-email`** — was downloading a client-supplied `storagePath` via
  the service-role client (RLS bypass → cross-tenant exfil). Now downloads with
  the caller's RLS-scoped client + a 20 MB cap.
- **H-2 `user-emails`** — base-scoped via `canBaseAdminManageUser`; recipient is
  derived from the target profile, not the request body (was an arbitrary mailer
  + cross-base activate/deactivate).
- **H-3 `admin/invite`** — per-invite `crypto.randomBytes` temp password,
  replacing the universal static `glidepathpassword` (pre-activation takeover).
- **H-4 stored XSS** — user free-text was concatenated into Google Maps
  InfoWindow HTML via `setContent` (innerHTML) across infrastructure / discrepancy
  / waiver / obstruction maps. Added shared `escapeHtml` in `lib/utils.ts`,
  applied to all four (+ `tests/escape-html.test.ts`).
- **H-6 daily-review forgery** — `daily_reviews` UPDATE needed only base access +
  *any one* sign permission (`sign:amsl` is held by `amops` shift workers), with
  a client-supplied `signed_by`, so anyone could forge AFM/NAMO certifications.
  New `sign_daily_review_slot` SECURITY DEFINER RPC (migration `2026062013`,
  live) derives the signer from `auth.uid()`, enforces the *specific* slot
  permission, refuses overwriting another user's slot, and recomputes
  `fully_certified_at`. `lib/supabase/daily-reviews.ts` calls the RPC.
- **Mediums/Lows in the same commit:** M-1 (airfield-status GET cross-base leak →
  caller RLS client), M-4 (`getClientIp` trusted spoofable leftmost XFF → prefer
  platform headers), M-6 (`/api/forgot-password` was missing from the middleware
  allowlist → 307'd to /login, silently broken), M-7 (public `/<icao>/sms-report`
  allowlist), L-4 (fail-open middleware → prod fail-closed), L-17 (airfield-status
  PATCH mass-assignment → explicit column allowlist), L-6 (report-only CSP),
  I-4 (`poweredByHeader:false`), M-5 (edge-fn CDN versions pinned).

### H-5 photos bucket — authenticated proxy (`2d5b4e16`)

The `photos` bucket is public, so the carefully path-scoped storage RLS gives
zero read confidentiality on CUI-adjacent imagery. Rather than thread async
signed-URL plumbing (which expires, breaking persisted URLs) through ~13 call
sites, all photo reads now go through **`app/api/photos/route.ts`** — it streams
the object via the *caller's* RLS-scoped session, so the (staged) base-scoped
SELECT policy decides access. `lib/supabase/photos.ts` → `photoUrl()` returns
`/api/photos?path=…` (synchronous, stable, no expiry). All `getPublicUrl('photos')`
call sites converted (PDF generators, galleries, exports, airfield-diagram,
AEP/WHMP/§139-training/obstruction upload helpers). The bucket flip itself is
staged (`2026062015`) — see Migrations.

### Verification-feedback fixes (`40086c7a`)

- **Invite email failures now surface in the UI.** The invite route returns
  `emailSent`/`emailError`; `/users` shows a warning toast ("account created but
  the invite email did NOT send — share the temp password manually") instead of a
  silent success.
- **Forgot-password email simplified** to the plain `.mil`-deliverable pattern
  (no gradient/CTA button/logo; plain copyable reset link; `info@` sender + text
  alternative) — matching the other transactional emails.
- **PDF discrepancy tables** (`lib/pdf-config.ts`): the flex Title column ate all
  leftover width (giant Title, cramped/wrapping Status/Comments/Created-By). Now
  capped at 65 mm with the slack redistributed proportionally to the text
  columns; added `rowPageBreak:'avoid'` so tall photo rows aren't clipped at page
  breaks.
- **AEP authoring** — the Accountable Executive role had `aep:read`+`aep:sign`
  but not `aep:write`, so the Demo Regional Airport's demo persona (an AE) could
  sign but not author/upload the AEP. Granted `accountable_executive` →
  `aep:write` (migration `2026062016`, applied live). The page already gates the
  create/upload affordance on `aep:write`.

---

## Migrations status

| File | Applied | What |
|---|---|---|
| `2026062011_rls_pentest_remediation.sql` | ✅ live | prior: trigger + scoped SELECT policies (#1–#5) |
| `2026062012_harden_base_access_null.sql` | ✅ live | prior: `user_has_base_access` NULL → FALSE |
| `2026062013_pentest_remediation_v2.sql` | ✅ live | C-2 trigger hardening + `sign_daily_review_slot` RPC |
| `2026062014_daily_reviews_lockdown.sql` | ⏳ **PENDING** | REVOKE direct `daily_reviews` INSERT/UPDATE — apply **after** the RPC-calling client (`40086c7a`) deploys, else live signing breaks |
| `2026062015_photos_bucket_private.sql` | ⏳ **PENDING** | H-5: base-scoped SELECT policy + flip bucket private. Apply **after** the proxy code deploys AND legacy persisted public URLs (AEP/WHMP/§139-training/obstruction rows) are rewritten to the proxy form — header has the UPDATE sketch. Then visually confirm galleries/PDFs render. |
| `2026062016_grant_ae_aep_write.sql` | ✅ live | grant `accountable_executive` → `aep:write` |

**Two pending migrations are deliberately deploy-gated** (expand/contract on a
shared prod DB). Apply order after promoting `40086c7a`: `2026062014`, then
`2026062015` (only once the legacy-URL rewrite + visual check are done).

---

## Bugs fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| Any base admin / AFM / NAMO could become `sys_admin` from the browser console | `profiles_update` RLS allows self-update; the old trigger only blocked callers lacking `users:manage`, which those roles hold | `2d5b4e16` / `2026062013` |
| `amops` shift worker could forge AFM/NAMO daily-review certifications | `daily_reviews` write policy accepted any one sign permission + a client `signed_by`, no per-slot gate | `2d5b4e16` / `2026062013` |
| Forgot-password reset link points at the vercel.app domain | `NEXT_PUBLIC_SITE_URL` is set to the Vercel URL in prod env; `getSiteUrl()` prefers it (code falls back to glidepathops.com only when unset) | config, not code |
| AEP upload → "you do not have permission" as the demo persona | Demo Regional Airport's demo account is an Accountable Executive, which lacked `aep:write` (read+sign only) | `40086c7a` / `2026062016` |
| Invite created the account but no email; admin saw success | localhost has no `RESEND_API_KEY`; the invite route sent best-effort and swallowed the failure | `40086c7a` (now surfaced) |
| Discrepancy PDF: giant Title column, cramped/truncated other columns, photos clipped at page breaks | Title was the only flex column (absorbed all slack); no `rowPageBreak` | `40086c7a` |

---

## Lessons from this session

- **`user_has_base_access` special-cases `sys_admin` (returns true everywhere);
  `user_has_permission` does NOT.** A permission key must be granted to a role
  explicitly in `role_permissions` — sys_admin only has a key if it's listed.
  That's why AEP authoring for the AE required an explicit grant, not a code
  short-circuit.
- **Private storage via an auth proxy beats signed URLs here.** `/api/photos`
  streaming through the caller's RLS client keeps every call site synchronous and
  the URL stable (no expiry → persisted-URL rows keep working), and centralizes
  authz in one place. The trade-off is a serverless hop per image.
- **Expand/contract on the shared prod DB.** Lock-down REVOKEs and the bucket
  flip must land *after* the code that uses the new path deploys, or prod (still
  on old code) breaks. Hence `2026062014`/`2026062015` are staged, not applied.
- **Email only works on the deploy.** `RESEND_API_KEY` lives in Vercel, not
  `.env.local` — invite/approval/reset emails all no-op locally. Test email on
  the promoted build (or add the key locally; real mail will send).
- **`NEXT_PUBLIC_SITE_URL` is the email-link domain.** Set it to the canonical
  domain in Vercel or every server-built link points at vercel.app.
- **Verify security fixes against the live DB, not just the static report.** The
  audit was static and partly inferred; C-2 was actually *broader* than reported
  (self-update path, not just `users:manage`), only visible by querying the live
  policy + trigger.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| Two security migrations pending | High | `2026062014` (daily_reviews lockdown) + `2026062015` (photos bucket private). Until applied, direct daily_reviews writes are still possible and the photos bucket is still public. Apply post-deploy per Migrations. |
| Legacy persisted public photo URLs | Med | New — AEP/WHMP/§139-training/obstruction rows stored old `…/object/public/photos/…` URLs that will 404 when the bucket flips. Rewrite to the proxy form before applying `2026062015` (UPDATE sketch in the migration header). |
| Lower-severity pentest items not done | Med | L-2 send-ppr authz, M-2 kiosk session lifecycle, M-3 anon-RPC rate limiting, I-3 constant-time CRON compare, Next.js 14.2→15 upgrade, remaining Lows/Info. See report §5. |
| CSP is report-only | Low | New — `Content-Security-Policy-Report-Only` shipped; promote to enforcing after monitoring for violations. |
| L-7 demo creds in prod bundle | Low | Left as-is — env-gating could break prod sales demos; the real fix is isolating demo to a separate Supabase project. |
| Independent human review of pentest fixes | Low | Deferred indefinitely (user-owned) — second eyes on the trigger + `profiles`/daily-review RPC before the Platform One assessment. |
| `scn` missing on 26 USAF bases | Med | Carried — frozen-`enabled_modules`; mirror `2026062000`. |
| New `defaultEnabled` modules don't reach existing bases | Med | Carried — systemic null-only fallback in `lib/installation-context.tsx`. |
| usr-analytics privacy disclosure | Med | Carried — per-user usage tracking has no user-facing line. |
| `types.ts` regen deferred | Med | Carried — `amtr_*` + `sign_daily_review_slot` hand-typed / cast `as any`. |
| Base-setup file extraction deferred | Med | Carried — `base-config/setup/page.tsx` ~6k LOC. |
| v2.34 not yet walked on the deploy | Med | Carried. |
| Test-account fixtures live in prod | Info | Carried — `__TEST_RLS__` bases + `rls-*@glidepath-rls-test.com` (also used by `scripts/verify-security-db.mjs`). |

---

## Next session tasks

The remediation is committed and pushed; the headline next step is **deploy +
the two pending migrations**, in order:

1. **Promote `40086c7a` on Vercel.** This carries the daily-review RPC client and
   the photo proxy that the pending migrations depend on.
2. **Apply `2026062014`** (daily_reviews lockdown) — safe once the RPC client is live.
3. **Before `2026062015`:** rewrite legacy persisted public photo URLs to the
   proxy form (AEP/WHMP/§139-training/obstruction rows — sketch in the migration
   header), then apply it and **visually confirm** photo galleries + photo-bearing
   PDFs still render. This is the one change that needs eyes-on.
4. **Set `NEXT_PUBLIC_SITE_URL`** in Vercel to the canonical domain so reset
   emails stop linking to vercel.app.
5. **Re-verify on the promoted build:** run `scripts/verify-security-db.mjs`
   (10/10) and `scripts/verify-security-api.mjs` (7/7), then eyes-on: daily-review
   signing, new-user onboarding email, the four map popups, AEP authoring as the
   demo persona, and the discrepancy PDF column/photos.

### Long-running carryover (bandwidth-permitting)
- Remaining lower-severity pentest items (L-2, M-2, M-3, I-3, Next.js upgrade,
  Lows/Info) — see `docs/security/Pentest_Audit_Fable5_2026-06-11.md` §5 roadmap.
- Independent human review of the pentest fixes — user-owned.
- Record onboarding videos; build the `/help/[module-id]` embed.
- `scn` `enabled_modules` backfill; the systemic `enabled_modules` fallback fix.
- usr-analytics privacy copy; `types.ts` regen; `base-config/setup` extraction.
- v2.34 deploy walk.

---

## Build snapshot

```
Build: npm run build — compiled successfully (109 static pages).
TypeScript clean (npx tsc --noEmit exit 0).
Tests: 866 pass / 90 files (npx vitest run) — incl. new tests/escape-html.test.ts.

New route this session:
  ƒ /api/photos             — authenticated photo proxy (H-5)
First Load JS shared        91.6 kB
Middleware                  74.6 kB
```

---

## Recent releases

| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-06-11 | Pentest remediation: closed self-escalation to sys_admin (`2026062013`) + daily-review forgery RPC, installations IDOR, email-route authz, invite password, map XSS, photo-read auth proxy (H-5), middleware/CSP/header hardening; AE granted `aep:write` (`2026062016`); forgot-password email + discrepancy-PDF layout fixes |
| **Unreleased** | 2026-06-10 | Brand-logo refresh (theme-aware login/sidebar + new PWA/favicon icons); Daily Reviews gains date-range filtering, an Outstanding section, a certification-log PDF, drops the unused per-review email flow |
| **Unreleased** | 2026-06-07 | RLS/authorization pentest remediation round 1 (`2026062011`/`2026062012`), offline write queue scoped per-user, no-base saves toast |
| **Unreleased** | 2026-06-05 | Offline write-queue coverage for airfield-status board, NAVAID grid, New Discrepancy, Report Outage; realtime-down flag hardening |
| **v2.34.0** | 2026-06-01 | Help & Training covers every module + airport-type gating; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination + notify; Records Export; grouped What's New |
| v2.33.0 | 2026-05-02 | Glidepath Training rebuilt, permission-matrix overhaul, PPR module, offline reads + writes |

---

## Key docs / files touched this session

### New files
- `app/api/photos/route.ts` — authenticated photo proxy (H-5).
- `lib/utils.ts` `escapeHtml` + `tests/escape-html.test.ts`.
- `scripts/verify-security-db.mjs`, `scripts/verify-security-api.mjs` — headless +
  dev-server security verification (run before pushing security changes).
- `supabase/migrations/2026062013…2026062016` — see Migrations.
- `docs/security/Pentest_Audit_Fable5_2026-06-11.md` — the full audit report.

### Modified files (security-relevant)
- `middleware.ts`, `lib/rate-limit.ts`, `next.config.js` — allowlists, IP source,
  fail-closed, CSP, poweredByHeader.
- `app/api/installations|send-pdf-email|user-emails|admin/invite|airfield-status|
  forgot-password/route.ts`, `app/setup-account/page.tsx`, `app/(app)/users/page.tsx`.
- `lib/supabase/{photos,daily-reviews,aep,whmp,training-part139,obstructions}.ts`,
  `lib/{acsi-pdf,airfield-diagram,pdf-config}.ts`,
  `lib/reports/{daily-ops-data,open-discrepancies-data}.ts`,
  `app/(app)/{infrastructure,discrepancies,inspections/[id]}/...`,
  `components/{discrepancies,waivers,obstructions}/*-map-view-google.tsx`.
