# Phase 5 — Domain Cutover Design

**Date:** 2026-07-09
**Status:** Approved (owner), ready for implementation plan.
**Repos:** `glidepath-site` (marketing) + `airfield-app` (product).
**Supersedes/refines:** §13 "Go-live & domain cutover sequence" of
`2026-07-02-marketing-website-design.md`, updated to the live reality below.

## 1. Goal

Make `glidepathops.com` serve the **marketing site**, and keep the **app** at
`app.glidepathops.com`, without breaking auth, public QR forms, or in-flight
email links for the real bases that use the app daily.

## 2. Current reality (verified 2026-07-09)

The domain `glidepathops.com` is on **Vercel nameservers** (DNS is a
dashboard-only operation). Live HTTP behavior today:

| Host | Serves today | Notes |
|---|---|---|
| `glidepathops.com` (apex) | **app** | 307 → `www` → `/login` |
| `www.glidepathops.com` | **app** | `X-Matched-Path: /login` |
| `app.glidepathops.com` | **app** | already attached to the airfield-app project ✓ |

The marketing site is deployed and "promoted" on its `*.vercel.app`
production URL, but **no production domain points at it yet**.

**Implication:** the spec's step 2 ("move the app to `app.glidepathops.com`")
is effectively **already done**. What remains is moving the **apex + www**
off the app project and onto the marketing project, plus redirects, two
app-side URL fixes, user comms, and launch hygiene.

## 3. Constraints established with the owner

- **Users:** the app is **live and depended-on daily** by real bases. Origin
  change means existing users must **re-login** and **reinstall the PWA** at
  `app.glidepathops.com` (sessions, service-worker installs, and IndexedDB are
  origin-bound and do not follow).
- **Offline queue:** **not a concern** — no user has pending unsynced writes,
  so no queue-drain step or "sync first" urgency is required.
- **Comms:** owner wants a **drafted announcement** *and* a **dismissible
  in-app banner**.
- **Execution:** **co-pilot at a set, low-activity window** — Claude prepares
  and commits all code locally; the **owner pushes and performs the Vercel /
  Supabase dashboard steps** at the window, with Claude guiding and verifying.
- **QR codes in the wild:** few; long-term fix is reprint with
  `app.glidepathops.com` URLs. Transition redirects cover the interim.

## 4. Code changes (prepared now, dormant until the flip)

Neither change alters current behavior until the apex is reassigned, so both
are safe to land ahead of the window.

### 4.1 `airfield-app/lib/site-url.ts` — fallback host
`getSiteUrl()` currently falls back to `https://glidepathops.com` when neither
`NEXT_PUBLIC_SITE_URL` nor `NEXT_PUBLIC_APP_URL` is set. After cutover the apex
is the *marketing* site, so this fallback would generate broken auth-email
links (`glidepathops.com/auth/confirm`). Change the fallback to
**`https://app.glidepathops.com`** and update the doc-comment. This makes the
app correct-by-default even if the Vercel env var is missing; setting
`NEXT_PUBLIC_SITE_URL=https://app.glidepathops.com` in the app's Vercel
**Production** env remains the belt-and-suspenders (owner-verified in §6).

### 4.2 `glidepath-site/next.config.ts` — transition redirects
Add `async redirects()` returning the explicit list in §5, pointing at
`https://app.glidepathops.com`. The site currently has **no** redirect config.

### 4.3 `airfield-app` — dismissible "we've moved" banner
A small client component (e.g. `components/layout/moved-banner.tsx`) mounted in
the authenticated app shell: one line — "Glidepath now lives at
**app.glidepathops.com** — update your bookmark and reinstall the app from
there."

**Shows exactly once per device.** On its first render it immediately writes a
`localStorage` flag (e.g. `glidepath-moved-notice-seen`) and never renders again
on that browser — it does **not** reappear on subsequent app opens, whether or
not the user dismissed it. The flag is written on first paint (not gated on a
click), so a user who ignores it and navigates away still never sees it twice.
An `×` is offered only to clear it from the current view immediately. A date
backstop also suppresses it entirely after ~3 weeks post-cutover, so late/new
users never see a stale notice and no removal commit is needed.
(`localStorage` is per-origin per-device — the correct granularity here, since
the reinstall action is itself per-device.) It shows on whichever origin serves
the app, so it reaches users before and after the flip.

### 4.4 Guard tests
- `glidepath-site`: a test asserting the redirect map contains each §5 source
  and every destination is an absolute `app.glidepathops.com` URL.
- Confirm the existing `glidepath-site/tests/seo.test.ts` (canonical apex,
  sitemap) still passes — the site keeps the bare apex as canonical.
- `airfield-app`: existing gate unchanged; add/adjust a `site-url` unit test to
  pin the new fallback.

## 5. Transition redirect list (marketing site → `https://app.glidepathops.com<path>`)

Redirect **type: temporary (307)** during the transition — these are not yet
permanent moves and 307 avoids indefinite browser caching, so the list can be
retired or promoted to 308 later without users holding stale cached redirects.
(This is a deliberate change from the older spec's "308"; rationale = transition
reversibility.)

| Source (on `glidepathops.com`) | Category |
|---|---|
| `/feedback/:baseId` | public QR |
| `/kiosk/:icao` | public QR |
| `/:icao/ppr-request` | public QR |
| `/ppr-request/:baseId` | public QR (legacy) |
| `/login` | auth entry |
| `/setup-account` | invite email link |
| `/reset-password` | reset email link |
| `/forgot-password` | auth entry |
| `/auth/:path*` | email confirm/callback |
| `/dashboard` | common app bookmark |

**No collisions:** the marketing site's only routes are `/`, a handful of
static pages (`/about`, `/faq`, `/demo`, `/platform`, `/privacy`, `/security`,
`/terms`), and namespaced dynamics `/military/:slug` + `/civilian/:slug`. None
overlap the sources above, and Next's `redirects()` runs before routing
regardless.

## 6. Cutover sequence (⚙️ Claude code · 🔑 owner dashboard/push)

1. **⚙️** Land §4 changes on `main` in both repos (committed, **unpushed**).
2. **🔑 Ahead of the window:** push `airfield-app` so the **banner** is live and
   send the **announcement** (§7). Gives users lead time to expect the move.
3. **🔑** Verify `app.glidepathops.com` is fully auth-ready: Supabase Auth →
   **Site URL** and **Redirect URLs** include `https://app.glidepathops.com/**`.
   Set/confirm `NEXT_PUBLIC_SITE_URL=https://app.glidepathops.com` in the app's
   Vercel **Production** env; redeploy if changed.
4. **🔑** Push `glidepath-site` (redirects deploy but stay dormant — apex still
   on the app project).
5. **🔑 At the window (co-piloted):** in Vercel, remove `glidepathops.com` and
   `www.glidepathops.com` from the **airfield-app** project, then add both to
   the **glidepath-site** project; set `www` → redirect to the bare apex
   (marketing canonical). Internal reassignment on Vercel nameservers —
   near-zero downtime, TLS re-issued automatically.
6. **🔑** Post-flip hygiene: Google Search Console verify `glidepathops.com` +
   submit `sitemap.xml`; confirm production `robots.txt` is allow-all (no
   preview `x-robots-tag: noindex`); demo form end-to-end; Lighthouse on `/`
   and one pillar page.

## 7. Announcement draft (owner sends)

Short, plain-text, .mil-safe (no external tracking links). Content:
- The app has a new home: **`https://app.glidepathops.com`**.
- Action: bookmark it, sign in there, and reinstall the app (Add to Home
  Screen / Install) from the new address; the old `glidepathops.com` address
  now shows the public Glidepath site.
- Reassurance: your data is unchanged; this is only a web-address move.
- Support: reply / `info@glidepathops.com`.

Final copy is written as a deliverable in the implementation plan.

## 8. Verification (at the window)

- `https://glidepathops.com` → marketing homepage (not `/login`).
- `https://glidepathops.com/login` → 307 → `https://app.glidepathops.com/login`.
- `https://www.glidepathops.com` → apex marketing.
- A QR path, e.g. `https://glidepathops.com/kiosk/<icao>` → 307 → app.
- Fresh login at `https://app.glidepathops.com` succeeds.
- Trigger a password-reset; the email link resolves on the app origin.
- Public PPR form (`/<icao>/ppr-request`) reachable via redirect and directly.

## 9. Rollback

Single-step: in Vercel, re-add `glidepathops.com` + `www` to the airfield-app
project (removing from marketing). Reverts the user-facing state immediately.
The code changes are backward-compatible — the app functions on
`app.glidepathops.com` before, during, and after — so no code revert is needed
to roll back the domain.

## 10. Success criteria

- `glidepathops.com` serves the marketing site; `app.glidepathops.com` serves
  the app; `www` canonicalizes to the apex.
- All §5 old paths 307 to the app; public QR forms and auth email links work.
- Existing users can re-login and reinstall at the app subdomain; the in-app
  banner and announcement have gone out.
- Search Console verified, sitemap submitted, production site indexable,
  Lighthouse still passing on key pages.

## 11. Out of scope

QR-code reprinting (owner, ongoing), retiring the transition redirects once
reprints are done (later), and any marketing-content changes. No `airfield-app`
functional changes beyond §4.1/§4.3.
