# Session Handoff

**Date:** 2026-07-10
**Branch:** `main` (both repos). `airfield-app` **fully pushed and clean**
(HEAD `c623c40b`). `glidepath-site` working tree clean but **3 commits
unpushed** (HEAD `5e643fa`).
Three arcs in `airfield-app`: (1) the **Phase 5 apex domain cutover** —
executed and verified live this session; (2) a new sys-admin **broadcast-email**
feature ("Email all users"); (3) an **email-deliverability fix** so the last two
password emails survive `.mil` mail filtering. Plus a **marketing homepage +
verbiage refresh** on `glidepath-site` (committed, unpushed).
**Build:** `airfield-app` @ `c623c40b`: tsc ✓ · lint 0 errors · `npx vitest run`
**1179 passed / 16 skipped** (132 files) ✓ · `npm run build` ✓.
**HEAD:** `airfield-app` `c623c40b` (pushed) · `glidepath-site` `5e643fa`
(**unpushed**: `503d1be`, `dae1497`, `5e643fa`).
**Domain:** apex cutover is **live** — `glidepathops.com` now serves the
marketing site; the app runs at `app.glidepathops.com`.
**DB:** one new migration this session — `2026070900_email_broadcasts`
(broadcast audit table + sys-admin RLS), **applied to the linked DB and pushed**.
`2026070700_add_part139_cover_fields` (prior session) remains applied.
**Not promoted** — owner owns Vercel promotion.

---

## What shipped this session

Three feature arcs in `airfield-app` plus a marketing-site pass. The domain
cutover is the headline: the apex now points at the marketing site and the app
lives on its own subdomain, so every server-built auth link and in-flight
bookmark had to be made to survive the move.

### Phase 5 apex domain cutover — executed and live

The marketing site (`glidepath-site`) now serves `glidepathops.com`; the app
serves `app.glidepathops.com`. On inspection the Vercel app-project move was
already done, so this session only had to reassign the apex + `www` and make the
code cutover-safe. Owner performed the Vercel domain reassignment; verified live
via `curl` (apex → marketing `200`; `/login` → `307` → app subdomain).

- **`getSiteUrl()` fallback repointed** (`b12bd621`) — the both-env-unset
  fallback moved from `https://glidepathops.com` to `https://app.glidepathops.com`.
  `getSiteUrl()` builds server-side auth links (`/auth/confirm`, `/setup-account`,
  `/reset-password`); after cutover the apex belongs to marketing, so a stale
  fallback would email links into the marketing site. The Vercel env var
  `NEXT_PUBLIC_SITE_URL` is the primary fix; this makes the code correct-by-default.
- **Transition redirects** (in `glidepath-site`, `9d0db1a`, already pushed) — the
  marketing site now `307`s the in-flight app paths (`/login`, `/setup-account`,
  `/reset-password`, `/forgot-password`, `/auth/*`, `/dashboard`, the PPR public
  paths) from the apex to `app.glidepathops.com`, so old bookmarks and
  already-sent email links don't 404 on the marketing host.
- **"Sign in" link** (in `glidepath-site`, `89ed5b6`, already pushed) — the
  marketing header now links to the app so returning users have an obvious way in.
- **Show-once "we've moved" in-app banner** (`51a1b13f`) + **user announcement
  draft** (`d4b3990f`) — per the owner's "draft and in-app banner" directive: a
  dismiss-once banner in the app pointing at the new URL, and a drafted
  announcement for the owner to send.

### Broadcast email — sys-admin "Email all users"

A new sys-admin-only feature on `/users`, built TDD across eight commits. Lets a
system admin compose and send an announcement to the whole user base.

- **Recipients** (`63af9439`) — default **all active users**, with optional base
  and role filters; normalize + chunk helpers (Resend batch limits).
- **Composer** (`a37fbbad`) — modal with a formatting toolbar + a **safe-subset
  Markdown** renderer (`4d548eab`) + live preview, so the admin can write
  headers / bullets / paragraph breaks.
- **From-address selector** (`9335dd2a`) — dropdown, default `info@`, `chris@` as
  an alternate; the chosen `from` is validated **server-side against an allowlist**
  (a crafted request can't send from an arbitrary address) with a matching reply-to.
- **Email builder** (`82f9caf7`) — a branded HTML template, but **link-free**:
  per the owner's `.mil` constraint no URL links are embedded (see deliverability
  arc below — links are the bigger quarantine trigger).
- **API route** (`5385f316`) — `count` / `test` / `send` modes, sys-admin-gated;
  guarded by `tests/broadcast-email-route.test.ts` (403s non-sys-admin, batches
  one email per recipient, writes an audit row, enforces the from-allowlist).
- **Audit + RLS** (`5d63fe9c`, migration `2026070900`) — `email_broadcasts`
  records each send (sender, subject, recipient count, tally); sys-admin-only RLS.
  Applied to the linked DB and pushed.
- **Entry point** (`447a30ef`) — the "Email all users" button on `/users`, visible
  only to sys-admin.

### Email deliverability — password emails made `.mil`-safe (`c623c40b`)

Owner noticed the admin **Reset Password** action still emailed a branded dark
card with a gradient CTA button deep-linking to `glidepathops.com`. Defender for
Office 365 quarantines styled deep-link emails on `.mil` tenants, so the reset
link never reached the user. A sweep classified all ~15 transactional send paths;
only the two password routes were non-compliant.

- **`app/api/admin/reset-password/route.ts`** — rewritten from a recovery-link
  email to a **temp-password reset, no link at all**. It now resets the password
  server-side to a per-account temp value (mirrors `admin/invite`'s
  `generateTempPassword()`), sets `must_change_password` so login routes the user
  through `/setup-account`, and emails the temp password as **plain text**
  (`info@` sender, no styling, `mailto:` only). Returns
  `{ tempPassword, emailSent, emailError }` so the `/users` modal surfaces the
  temp password via a **persistent toast** — the admin relays it manually if the
  email is quarantined, exactly like the invite flow. **Behavior change:** the
  reset is now immediate + destructive (the old password stops working at once),
  where the old link was non-destructive. Button relabeled
  **"Reset Password (email temp)"**, icon `RotateCcw`.
- **`app/api/forgot-password/route.ts`** — **kept the recovery-link flow**, but the
  reset URL now renders as **plain text** instead of an `<a href>` anchor, so the
  message carries no `https://` linked content for Safe Links to rewrite or
  quarantine. The user copies the URL into a browser; the token flow is unchanged.
- **`tests/email-deliverability.test.ts`** — new guard on both routes: no clickable
  `http(s)` anchor and no `linear-gradient` in either email; temp password present
  + `must_change_password` set on the admin reset; reset URL present-but-plain on
  forgot-password. This is the **second** `.mil` branding regression, so it's pinned.

### Marketing homepage + verbiage refresh (`glidepath-site`, unpushed)

Three commits, working tree clean, **not yet pushed** — owner pushes.

- **`503d1be`** — hero reworked to a **full-width centered text hero** (the
  OpsBoard mockup was removed; owner: the image "looks bad… just the main text
  across the top"), and the header **wordmark enlarged** (`h-7` → `h-11`, after the
  second half of "Glidepath" read too small).
- **`dae1497`** — track headlines reworded to **"Military airfield management,
  built with DAFMAN and UFC requirements in mind"** and **"Built for Civilian
  Airport Operations, with FAA requirements in mind"**; the `GlidepathDivider`
  ("blue line") removed site-wide (owner: "it looks dumb"); the **regulation-cite
  chips removed** from the module cards on both tracks. Terminology guards + the
  civilian `h1` / reg-chip route-stub tests updated to follow the intended change.
- **`5e643fa`** — the ambient background `sky-glow` **animated** (three drifting,
  breathing radial-gradient layers, `prefers-reduced-motion`-guarded). **Note:**
  owner said "leave it for now — I have a different idea," so treat the homepage
  background as an open design thread, not settled.

---

## Migrations status

| File | State | What it does |
|---|---|---|
| `2026070900_email_broadcasts.sql` | **Applied** (linked DB) + pushed | `email_broadcasts` audit table + sys-admin RLS for the broadcast feature |
| `2026070700_add_part139_cover_fields.sql` | Applied (prior session) | Part 139 cover fields |

No pending/unapplied migrations.

---

## Bugs fixed during the session

| Symptom | Root cause | Commit |
|---|---|---|
| Admin "Reset Password" email never arrives on `.mil` | branded dark card + gradient CTA **deep-link** email → Defender for O365 quarantines styled deep links on `.mil` tenants | `c623c40b` |
| (cutover) apex double-redirected during the Vercel flip | redirect direction set backwards (apex→`www`); fixed by making the apex primary (No Redirect) and pointing `www`→apex | Vercel dashboard (no code) |

---

## Lessons from this session

- **`.mil` email = no links, no heavy styling.** Styled deep-link emails get
  quarantined by Defender for O365; a **temp password (no link)** or a
  **plain-text URL (no `<a href>`)** survives. `mailto:` links pass. This was the
  second time email branding broke `.mil` delivery — now guarded by
  `tests/email-deliverability.test.ts`. Reinforces the `.mil email deliverability`
  memory.
- **Temp-password reset is destructive; a recovery link is not.** Switching the
  admin reset to a temp password immediately invalidates the user's current
  password. That's the right call for `.mil` deliverability, but it's a real UX
  change — the admin must relay the temp password (surfaced via a persistent
  toast) if the email is quarantined.
- **Vercel apex/`www`: make the canonical host primary (No Redirect), redirect the
  other to it.** Getting the direction backwards double-redirects. Verify a
  cutover end-to-end with `curl` (apex serves the right project; in-flight app
  paths `307` to the app subdomain) before calling it done.
- **Server-built email links must not fall back to the apex after a cutover.**
  `getSiteUrl()`'s env-unset fallback had to move to the app subdomain, or reset /
  invite / confirm links would resolve to the marketing site.

---

## Known issues / tech debt

| Item | Severity | Notes |
|---|---|---|
| `glidepath-site` 3 commits unpushed | — | `503d1be` / `dae1497` / `5e643fa` (homepage + marketing + glow). Owner pushes. |
| Homepage background direction unsettled | low | `sky-glow` animation is committed but owner wants "a different idea" — open design thread, don't treat as final. |
| Broadcast email uses a branded template | low | link-free per owner constraint, but still styled; if `.mil` delivery of broadcasts proves flaky, stripping the card/gradient is the next lever (same failure mode as the reset email). |
| Post-cutover verification | low | confirm the show-once "we've moved" banner renders for real users and the announcement draft is sent when the owner is ready. |
| App-side dual-mode terminology (other modules) | med | `/discrepancies`, `/inspections`, `/checks`, `/qrc`, `/flip`, `/obstructions` still leak military terms on civilian tenants; `lib/airport-mode.ts` doesn't cover them. |
| Part 139 audit P/F/N-A vs S/U/N-A inconsistency | low | list view + progress bar read "Pass/Fail/N/A"; per-section tallies read "S/U/N-A". Cosmetic. |
| Part 139 guide `howToAccess` unverified | low | confirm the exact civilian `/acsi` nav path on a civilian base. |
| Help screenshots are large PNGs | low | some `public/training/*.png` are 1–4 MB; consider downsizing if PDF/page weight matters. |
| Civilian QRC templates title-only stubs | low | KDRA `qrc_templates` ×8 have "0 steps"; enrich for a richer `/qrc` frame. |
| Carried low items | low | status-page weather race (`app/(app)/page.tsx`); demo-form email-fail-after-insert silent; account-deactivation doesn't kill live sessions (`middleware.ts`); Selfridge 1098 dedup — unchanged. |

---

## Next session tasks

No required next step — pick up wherever the owner wants. Open threads:

1. **Homepage background redesign** — owner has "a different idea" for the hero /
   ambient background; the current `sky-glow` animation is a placeholder, not the
   destination.
2. **App-side dual-mode terminology sweep** (med) — the actual modules
   (`/discrepancies`, `/inspections`, `/checks`, `/qrc`, `/flip`, `/obstructions`)
   still hardcode military terms on civilian tenants. Mirror what ACSI / Part 139
   and `lib/airport-mode.ts` already do.
3. **Part 139 audit polish** — the P/F-vs-S/U label inconsistency; confirm the
   civilian `/acsi` nav path so the guide's `howToAccess` is exact.

Owner-owned actions: **push `glidepath-site`** (3 commits). Vercel promotion of
both projects is, as always, the owner's call.

### Long-running carryover
SEO / rich-results, deferred audit items, Next 16 — owner-scheduled, unchanged.

---

## Build snapshot
```
airfield-app @ c623c40b: tsc ✓ · lint 0 errors (pre-existing warnings only) ·
  npx vitest run 1179 passed / 16 skipped (132 files) · npm run build ✓.

Changed routes this session (First Load JS):
  /api/admin/broadcast-email     236 B / 107 kB   (new)
  /api/admin/reset-password      236 B / 107 kB   (temp-password rewrite)
  /api/forgot-password           236 B / 107 kB   (de-branded)
  /reset-password              5.04 kB / 165 kB
  /users                       21.4 kB / 207 kB   (+ broadcast modal + toast)
  /users/analytics             4.91 kB / 171 kB
Shared First Load JS: 106 kB   ·   Middleware: 80.8 kB
```

---

## Recent releases
| Version | Date | Headline |
|---|---|---|
| **Unreleased** | 2026-07-05..10 | Marketing roster 36→50 + **Part 139 certification-inspection readiness audit**; owner-testing **bug sweep** (CSP frame-src/connect-src, PostgREST embed); **Help & Training overhaul**; **Phase 5 apex domain cutover** (glidepathops.com→marketing, app→app.glidepathops.com); sys-admin **broadcast email**; **`.mil` email-deliverability fix** (link-free reset, de-branded forgot-password); marketing homepage/verbiage refresh. Pushed (airfield-app), unpromoted; glidepath-site homepage commits unpushed. |
| **v2.35.0** | 2026-06-30 | Customizable widget dashboard; FLIP Management + Read File; PPR calendar + `.ics`; AMTR 803/1098; C2IMERA export; WWA server-side expiry; brand refresh. |
| **v2.34.0** | 2026-06-01 | Help & Training all modules; AMTR fleet-wide; FAA Part 139 civilian mode; PPR coordination; Records Export. |

---

## Key docs / files touched this session
### New files
- `tests/email-deliverability.test.ts` — no-link / temp-password guard for both password-email routes.
- `components/admin/broadcast-email-modal.tsx` + broadcast helpers (Markdown renderer, recipient normalize/chunk, email builder, senders) and `tests/broadcast-*.test.{ts,tsx}`.
- `app/api/admin/broadcast-email/route.ts` — sys-admin count/test/send route.
- `supabase/migrations/2026070900_email_broadcasts.sql` — audit table + RLS.
- Phase 5: show-once "we've moved" banner + user announcement draft; `docs/superpowers/specs|plans/2026-07-09-phase5-domain-cutover-*.md`; broadcast design + plan docs.
- `glidepath-site`: no new files (hero/header/copy edits in place).

### Modified files
- `app/api/admin/reset-password/route.ts` — temp-password rewrite (link-free).
- `app/api/forgot-password/route.ts` — reset URL as plain text (de-branded).
- `app/(app)/users/page.tsx` — broadcast entry + reset temp-password toast.
- `components/admin/user-detail-modal.tsx` — reset button relabel + toast handoff.
- `lib/site-url.ts` — `getSiteUrl()` fallback → `app.glidepathops.com`.
- `glidepath-site`: `components/home/hero.tsx`, `components/layout/site-header.tsx`, `lib/track-content.ts`, `components/modules/module-grid.tsx`, `components/modules/module-page.tsx` + `app/{military,civilian}/page.tsx` (divider removal), `app/globals.css` + `app/layout.tsx` (sky-glow animation), `tests/route-stubs.test.tsx`.
