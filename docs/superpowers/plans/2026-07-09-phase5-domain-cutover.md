# Phase 5 — Domain Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `glidepathops.com` serve the marketing site and keep the app at `app.glidepathops.com`, without breaking auth, public QR forms, or in-flight email links for the bases that use the app daily.

**Architecture:** The app-move half is already live (`app.glidepathops.com` serves the app). This plan prepares the code so the owner can flip the **apex + www** from the app's Vercel project to the marketing project at a chosen window. Code changes are dormant until the flip: (1) the app's auth-link fallback host, (2) transition `redirects()` on the marketing site, (3) a show-once "we've moved" banner in the app, (4) a user announcement. Tasks 1–4 are prepared/committed now; Task 5 is the co-piloted dashboard runbook.

**Tech Stack:** Next.js 14 (airfield-app) / Next.js 15 (glidepath-site), TypeScript strict, Vitest + Testing Library, Vercel (nameservers + hosting), Supabase Auth.

**Spec:** `docs/superpowers/specs/2026-07-09-phase5-domain-cutover-design.md`

## Global Constraints

- **Two repos.** airfield-app at `C:/Users/cspro/airfield-app`; glidepath-site at `C:/Users/cspro/glidepath-site`. Run each repo's commands from its own root.
- **Commits are LOCAL and UNPUSHED.** The owner pushes both repos at the cutover window (they control the Vercel changes). Never push.
- **airfield-app gate before each commit:** `npx tsc --noEmit` (0 errors) · `npm run lint` (0 errors) · `npx vitest run` (all pass) · `npm run build` (RC 0).
- **glidepath-site gate before each commit:** `npx tsc --noEmit` · `npm run lint` · `npm run test` (`vitest run`) · `npm run build`.
- **Redirect type is 307 (temporary):** `permanent: false`. Deliberate — a transition list, not a permanent move (avoids indefinite browser caching; retire-able later).
- **App host constant:** `https://app.glidepathops.com` (no trailing slash).
- **Theme-aware styling:** inline CSS-var tokens (e.g. `var(--color-text-1)`), not raw greys or `dark:` classes — matches the app-shell convention.
- **Commit trailer (every commit):**
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_016n621MSZmyZKZcA3qKJzsw
  ```
- **.mil-safe copy:** announcement is plain text, no external tracking links, `mailto:` only.

## File Structure

| Repo | File | Responsibility |
|---|---|---|
| airfield-app | `lib/site-url.ts` (modify) | Auth-link base URL — change apex fallback to app subdomain |
| airfield-app | `tests/site-url.test.ts` (modify) | Pin the new fallback |
| airfield-app | `components/layout/moved-banner.tsx` (create) | Show-once "we've moved" notice |
| airfield-app | `app/(app)/layout.tsx` (modify) | Mount the banner in the app shell |
| airfield-app | `tests/moved-banner.test.tsx` (create) | Once-per-device + window-backstop behavior |
| airfield-app | `docs/phase5-cutover-announcement.md` (create) | User announcement the owner sends |
| glidepath-site | `next.config.ts` (modify) | Transition `redirects()` → app subdomain |
| glidepath-site | `tests/redirects.test.ts` (create) | Redirect map guard |

---

### Task 1: App auth-link fallback → `app.glidepathops.com`

**Repo:** airfield-app

**Files:**
- Modify: `lib/site-url.ts` (doc comment + fallback string)
- Test: `tests/site-url.test.ts` (two assertions)

**Interfaces:**
- Consumes: nothing new.
- Produces: `getSiteUrl()` unchanged signature (`(): string`); only the both-env-unset fallback value changes from `https://glidepathops.com` to `https://app.glidepathops.com`.

**Why:** After cutover the apex belongs to the marketing site. `getSiteUrl()` builds auth email links (`${getSiteUrl()}/auth/confirm`, `/setup-account`, `/reset-password`); if env is unset it must fall back to the app subdomain, not the apex, or those links break. The Vercel env var `NEXT_PUBLIC_SITE_URL` is the primary fix (Task 5); this makes the code correct-by-default too.

- [ ] **Step 1: Update the two failing assertions in the test**

In `tests/site-url.test.ts`, replace the "both unset" test (currently lines ~30-32):

```ts
  it('falls back to app.glidepathops.com when both are unset', () => {
    expect(getSiteUrl()).toBe('https://app.glidepathops.com')
  })
```

and the "never empty" test's assertion (currently line ~49):

```ts
  it('never returns an empty string even when env is empty', () => {
    process.env.NEXT_PUBLIC_SITE_URL = ''
    process.env.NEXT_PUBLIC_APP_URL = ''
    expect(getSiteUrl()).toBe('https://app.glidepathops.com')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/site-url.test.ts`
Expected: FAIL — the two updated tests expect `app.glidepathops.com` but the impl still returns `https://glidepathops.com`.

- [ ] **Step 3: Change the fallback in `lib/site-url.ts`**

Edit the doc comment (line ~6): `and finally to the production glidepathops.com host.` → `and finally to the production app.glidepathops.com host.`

Edit the fallback (line ~19):

```ts
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://app.glidepathops.com'
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/site-url.test.ts`
Expected: PASS (all `getSiteUrl` tests green).

- [ ] **Step 5: Full gate + commit (local, unpushed)**

Run: `npx tsc --noEmit && npm run lint && npx vitest run && npm run build`
Expected: all green (lint may show the 2 pre-existing `lib/waiver-pdf.ts` warnings — that's fine; 0 errors).

```bash
git add lib/site-url.ts tests/site-url.test.ts
git commit -m "$(cat <<'EOF'
Phase 5: point getSiteUrl() fallback at app.glidepathops.com

After the apex cutover, glidepathops.com serves the marketing site, so the
app's auth email links must fall back to the app subdomain, not the apex.
NEXT_PUBLIC_SITE_URL in Vercel remains the primary source; this fixes the
default.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016n621MSZmyZKZcA3qKJzsw
EOF
)"
```

---

### Task 2: Transition redirects on the marketing site

**Repo:** glidepath-site

**Files:**
- Modify: `next.config.ts` (add `async redirects()`)
- Test: `tests/redirects.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: `next.config.ts` default export gains a `redirects()` method returning `{ source, destination, permanent:false }[]` for the 10 sources in the spec. Dormant until the apex points at this project.

**Why:** When the apex moves here, old app entry points (QR-printed public forms, auth email links, bookmarks) must keep working by 307-ing to `app.glidepathops.com`. No collision: the site's only routes are `/`, static pages, and `/military/:slug` + `/civilian/:slug`; `/:icao/ppr-request` only matches paths whose 2nd segment is literally `ppr-request` (no module uses that slug), and `redirects()` runs before routing regardless.

- [ ] **Step 1: Write the failing test**

Create `tests/redirects.test.ts`:

```ts
import nextConfig from '@/next.config'

const APP = 'https://app.glidepathops.com'
type R = { source: string; destination: string; permanent: boolean }

describe('transition redirects', () => {
  it('defines a redirects() function', () => {
    expect(typeof nextConfig.redirects).toBe('function')
  })

  it('307-redirects every old app entry point to the app subdomain', async () => {
    const rules = (await nextConfig.redirects!()) as unknown as R[]
    const expected: Array<[string, string]> = [
      ['/feedback/:baseId', `${APP}/feedback/:baseId`],
      ['/kiosk/:icao', `${APP}/kiosk/:icao`],
      ['/:icao/ppr-request', `${APP}/:icao/ppr-request`],
      ['/ppr-request/:baseId', `${APP}/ppr-request/:baseId`],
      ['/login', `${APP}/login`],
      ['/setup-account', `${APP}/setup-account`],
      ['/reset-password', `${APP}/reset-password`],
      ['/forgot-password', `${APP}/forgot-password`],
      ['/auth/:path*', `${APP}/auth/:path*`],
      ['/dashboard', `${APP}/dashboard`],
    ]
    for (const [source, destination] of expected) {
      const rule = rules.find((r) => r.source === source)
      expect(rule, `missing redirect for ${source}`).toBeTruthy()
      expect(rule!.destination).toBe(destination)
      expect(rule!.permanent).toBe(false) // 307 — transition, not permanent
    }
  })

  it('sends every redirect to app.glidepathops.com and none permanently', async () => {
    const rules = (await nextConfig.redirects!()) as unknown as R[]
    expect(rules.length).toBeGreaterThan(0)
    for (const r of rules) {
      expect(r.destination.startsWith(`${APP}/`)).toBe(true)
      expect(r.permanent).toBe(false)
    }
  })

  it("does not capture the marketing site's own routes", async () => {
    const rules = (await nextConfig.redirects!()) as unknown as R[]
    const sources = rules.map((r) => r.source)
    for (const own of ['/', '/about', '/faq', '/demo', '/platform', '/security', '/privacy', '/terms', '/military', '/civilian']) {
      expect(sources).not.toContain(own)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/redirects.test.ts`
Expected: FAIL — `nextConfig.redirects` is `undefined` (not a function).

- [ ] **Step 3: Add `redirects()` to `next.config.ts`**

Replace the file with:

```ts
import type { NextConfig } from 'next'

// The app's canonical home is app.glidepathops.com. When the apex
// (glidepathops.com) is cut over to this marketing project, these transition
// redirects keep the old app entry points working by 307-ing them to the app
// subdomain: QR-printed public forms, auth email links already in inboxes, and
// bookmarks. 307 (permanent:false) is deliberate — a transition list, not a
// permanent move — so browsers don't cache it forever and it can be retired
// once QR codes are reprinted with app.glidepathops.com URLs.
const APP = 'https://app.glidepathops.com'

const nextConfig: NextConfig = {
  // Lint runs as its own CI step; under CI=1 `next build` escalates
  // warnings to failures (the airfield-app Next 15 lesson).
  eslint: { ignoreDuringBuilds: true },
  async redirects() {
    return [
      // Public / QR-printed app routes
      { source: '/feedback/:baseId', destination: `${APP}/feedback/:baseId`, permanent: false },
      { source: '/kiosk/:icao', destination: `${APP}/kiosk/:icao`, permanent: false },
      { source: '/:icao/ppr-request', destination: `${APP}/:icao/ppr-request`, permanent: false },
      { source: '/ppr-request/:baseId', destination: `${APP}/ppr-request/:baseId`, permanent: false }, // legacy
      // Auth entry points (in-flight emails + bookmarks)
      { source: '/login', destination: `${APP}/login`, permanent: false },
      { source: '/setup-account', destination: `${APP}/setup-account`, permanent: false },
      { source: '/reset-password', destination: `${APP}/reset-password`, permanent: false },
      { source: '/forgot-password', destination: `${APP}/forgot-password`, permanent: false },
      { source: '/auth/:path*', destination: `${APP}/auth/:path*`, permanent: false },
      // Common app bookmark
      { source: '/dashboard', destination: `${APP}/dashboard`, permanent: false },
    ]
  },
}

export default nextConfig
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/redirects.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Full gate + commit (local, unpushed)**

Run: `npx tsc --noEmit && npm run lint && npm run test && npm run build`
Expected: all green. (`npm run build` prints the redirects under "Redirects" — sanity-check the 10 rules appear.)

```bash
git add next.config.ts tests/redirects.test.ts
git commit -m "$(cat <<'EOF'
Phase 5: add transition redirects to the app subdomain

307-redirect old app entry points (public QR forms, auth email links,
bookmarks) from the apex to app.glidepathops.com. Dormant until the apex is
attached to this project. Temporary (307) on purpose — a transition list to
be retired once QR codes are reprinted.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016n621MSZmyZKZcA3qKJzsw
EOF
)"
```

---

### Task 3: Show-once "we've moved" banner in the app

**Repo:** airfield-app

**Files:**
- Create: `components/layout/moved-banner.tsx`
- Modify: `app/(app)/layout.tsx` (import + mount)
- Test: `tests/moved-banner.test.tsx`

**Interfaces:**
- Consumes: nothing (self-contained client component).
- Produces: `export function MovedBanner(): JSX.Element | null`. Renders once per device (localStorage flag `glidepath-moved-notice-seen`), suppressed after the window backstop `HIDE_AFTER`. Mounted as the first child of `.app-main`.

**Why:** Existing users' sessions and PWA installs are bound to the old origin and don't follow to `app.glidepathops.com`; the banner tells them to update their bookmark and reinstall. It must show **exactly once per device** — the flag is written on first paint, not on dismiss, so it never re-appears on later opens whether or not the user interacted.

- [ ] **Step 1: Write the failing test**

Create `tests/moved-banner.test.tsx`:

```tsx
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MovedBanner } from '@/components/layout/moved-banner'

describe('MovedBanner', () => {
  beforeEach(() => {
    localStorage.clear()
    // Fake ONLY Date so React's effect scheduler (timers/microtasks) stays real.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-07-15T00:00:00Z')) // inside the transition window
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('shows the move notice on first render and marks it seen on first paint', () => {
    render(<MovedBanner />)
    expect(screen.getByText(/app\.glidepathops\.com/)).toBeTruthy()
    expect(localStorage.getItem('glidepath-moved-notice-seen')).toBeTruthy()
  })

  it('does not render again once the seen flag is set (no per-open spam)', () => {
    localStorage.setItem('glidepath-moved-notice-seen', 'x')
    const { container } = render(<MovedBanner />)
    expect(container.textContent).toBe('')
  })

  it('hides when dismissed with the × button', () => {
    render(<MovedBanner />)
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(screen.queryByText(/app\.glidepathops\.com/)).toBeNull()
  })

  it('stays hidden after the transition window closes', () => {
    vi.setSystemTime(new Date('2026-09-01T00:00:00Z')) // past HIDE_AFTER
    const { container } = render(<MovedBanner />)
    expect(container.textContent).toBe('')
    expect(localStorage.getItem('glidepath-moved-notice-seen')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/moved-banner.test.tsx`
Expected: FAIL — cannot resolve `@/components/layout/moved-banner`.

- [ ] **Step 3: Create the component**

Create `components/layout/moved-banner.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'

// One-time "the app moved to app.glidepathops.com" notice for the Phase 5 domain
// cutover. Shows exactly once per device: the moment it first paints it writes a
// localStorage flag and never renders again on that browser — it does NOT reappear
// on later app opens, dismissed or not. A date backstop also suppresses it entirely
// after the transition window so late/new users never see a stale notice; the whole
// component can then be deleted in a cleanup commit.
const SEEN_KEY = 'glidepath-moved-notice-seen'
// Backstop — set to ~3 weeks past the actual cutover date; owner may adjust.
const HIDE_AFTER = Date.parse('2026-08-06T00:00:00Z')

export function MovedBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (Date.now() > HIDE_AFTER) return
    if (localStorage.getItem(SEEN_KEY)) return
    // Mark seen on first paint (NOT gated on a click) so a user who ignores the
    // banner and navigates away still never sees it twice.
    localStorage.setItem(SEEN_KEY, new Date().toISOString())
    setShow(true)
  }, [])

  if (!show) return null

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        flexWrap: 'wrap',
        padding: '10px 16px',
        background: 'var(--color-amber-bg, rgba(245, 158, 11, 0.12))',
        borderBottom: '1px solid var(--color-amber, #f59e0b)',
        color: 'var(--color-text-1)',
        fontSize: 'var(--fs-sm, 0.875rem)',
        textAlign: 'center',
      }}
    >
      <span>
        Glidepath now lives at{' '}
        <strong style={{ color: 'var(--color-amber, #f59e0b)' }}>app.glidepathops.com</strong>
        {' '}— update your bookmark and reinstall the app from there.
      </span>
      <button
        type="button"
        onClick={() => setShow(false)}
        aria-label="Dismiss"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--color-text-2, #9ca3af)',
          cursor: 'pointer',
          fontSize: '1.1rem',
          lineHeight: 1,
          padding: 4,
        }}
      >
        ×
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run the component test to verify it passes**

Run: `npx vitest run tests/moved-banner.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Mount the banner in the app shell**

In `app/(app)/layout.tsx`, add the import after the `RealtimeAlertBanner` import (line ~7):

```tsx
import { MovedBanner } from '@/components/layout/moved-banner'
```

Then mount it as the first child of `.app-main` (before `<Header />`):

```tsx
            <div className="app-main">
              <MovedBanner />
              <Header />
```

- [ ] **Step 6: Full gate + commit (local, unpushed)**

Run: `npx tsc --noEmit && npm run lint && npx vitest run && npm run build`
Expected: all green.

```bash
git add components/layout/moved-banner.tsx app/(app)/layout.tsx tests/moved-banner.test.tsx
git commit -m "$(cat <<'EOF'
Phase 5: add show-once "we've moved" banner

Tells existing users the app is now at app.glidepathops.com (update bookmark +
reinstall the PWA). Renders exactly once per device — the seen flag is written
on first paint, not on dismiss — and self-suppresses after the transition
window via a date backstop.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016n621MSZmyZKZcA3qKJzsw
EOF
)"
```

---

### Task 4: User announcement draft

**Repo:** airfield-app

**Files:**
- Create: `docs/phase5-cutover-announcement.md`

**Interfaces:** none (deliverable doc the owner copies + sends). No test.

- [ ] **Step 1: Create the announcement**

Create `docs/phase5-cutover-announcement.md`:

```markdown
# Glidepath cutover — user announcement

**Send to:** all Glidepath users (base Airfield Management teams).
**When:** a few days before the cutover window, and again the day of.
**Format:** plain text (reaches strict .mil inboxes — no external links).

---

Subject: Action needed — Glidepath's new address is app.glidepathops.com

Team,

Glidepath is moving to a new web address. The app now lives at:

    https://app.glidepathops.com

What to do:
1. Go to https://app.glidepathops.com and sign in as usual.
2. Update any saved bookmark to the new address.
3. If you added Glidepath to your home screen, reinstall it from
   app.glidepathops.com (open it in your browser, then "Add to Home Screen"
   or "Install"). The old icon points at the previous address and will stop
   working.

Nothing about your data changes — this is only a web-address move. The old
glidepathops.com address now shows the public Glidepath website.

Questions? Reply here or email info@glidepathops.com.
```

- [ ] **Step 2: Commit (local, unpushed)**

No gate needed (docs only), but confirm nothing else is staged.

```bash
git add docs/phase5-cutover-announcement.md
git commit -m "$(cat <<'EOF'
Phase 5: add user announcement draft for the domain cutover

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016n621MSZmyZKZcA3qKJzsw
EOF
)"
```

---

### Task 5: Co-piloted cutover runbook (owner-executed at the window)

**Not a code task.** This is the dashboard/DNS sequence the owner runs, with Claude guiding and verifying each step. Prerequisite: Tasks 1–4 committed. Do this at a low-activity window.

**Interfaces:** none. Verification uses `curl` from any shell.

- [ ] **Step 1: Push both repos**

Owner: from each repo root, `git push`. Confirm both Vercel projects build green (airfield-app deploy carries the `getSiteUrl` fix + banner; glidepath-site carries the dormant redirects).

- [ ] **Step 2: Land the banner + announcement ahead of the window (recommended)**

Ideally push airfield-app a few days early so the **banner** is already showing and send the **announcement** (`docs/phase5-cutover-announcement.md`). Gives users lead time. (If doing it all at once, the banner still appears immediately post-deploy.)

- [ ] **Step 3: Verify the app subdomain is auth-ready (Supabase + Vercel)**

- Supabase dashboard → Authentication → URL Configuration: **Site URL** and **Redirect URLs** include `https://app.glidepathops.com` (add `https://app.glidepathops.com/**` to redirect URLs). Keep any existing `*.vercel.app` entry during the transition.
- Vercel → airfield-app project → Settings → Environment Variables: `NEXT_PUBLIC_SITE_URL = https://app.glidepathops.com` on **Production**. If added/changed, redeploy the app.
- Verify: at `https://app.glidepathops.com`, trigger a password reset for a test account and confirm the email link lands on `app.glidepathops.com/auth/confirm...` and completes.

- [ ] **Step 4: Flip the apex + www (Vercel dashboard) — the cutover moment**

- Vercel → **airfield-app** project → Settings → Domains: remove `glidepathops.com` and `www.glidepathops.com` (leave `app.glidepathops.com`).
- Vercel → **glidepath-site** project → Settings → Domains: add `glidepathops.com` and `www.glidepathops.com`. When prompted that a domain is in use by another project, confirm the move.
- Set `www.glidepathops.com` to **Redirect** → `glidepathops.com` (marketing canonical is the bare apex). DNS is on Vercel nameservers, so this is internal reassignment — TLS re-issues automatically, near-zero downtime.

- [ ] **Step 5: Verify the cutover**

Run (any shell):

```bash
# Apex now serves marketing (NOT /login)
curl -sSI https://glidepathops.com | grep -iE "^(HTTP|location|x-matched-path)"
# Old app path 307s to the app subdomain
curl -sSI https://glidepathops.com/login | grep -iE "^(HTTP|location)"
# A QR path 307s to the app
curl -sSI https://glidepathops.com/kiosk/kdmo | grep -iE "^(HTTP|location)"
# Public PPR form path 307s to the app
curl -sSI https://glidepathops.com/kdmo/ppr-request | grep -iE "^(HTTP|location)"
# www canonicalizes to the apex
curl -sSI https://www.glidepathops.com | grep -iE "^(HTTP|location)"
# App still fully live on its subdomain
curl -sSI https://app.glidepathops.com/login | grep -iE "^(HTTP|x-matched-path)"
```

Expected: apex `GET /` → marketing home (200, not `X-Matched-Path: /login`); `/login` and the QR/PPR paths → `307` with `Location: https://app.glidepathops.com/...`; `www` → 307/308 to apex; `app.glidepathops.com/login` → 200. Then, in a browser: log in fresh at `app.glidepathops.com`, and open the public PPR + feedback forms via the redirects.

- [ ] **Step 6: Launch hygiene**

- Google Search Console: add/verify the `glidepathops.com` property; submit `https://glidepathops.com/sitemap.xml`.
- Confirm production `robots.txt` is allow-all (no preview `x-robots-tag: noindex` on the apex): `curl -sSI https://glidepathops.com/ | grep -i x-robots-tag` should return nothing.
- Submit the demo form at `https://glidepathops.com/demo` end-to-end (lead row + email).
- Lighthouse on `https://glidepathops.com/` and one pillar (e.g. `/military`): 90+.

- [ ] **Step 7 (rollback, only if needed):** In Vercel, re-add `glidepathops.com` + `www` to the **airfield-app** project (removing from glidepath-site). Reverts the user-facing state in one step. Code changes are backward-compatible, so no code revert is required.

---

## Self-Review

**Spec coverage:**
- §4.1 getSiteUrl fallback → Task 1 ✓
- §4.2 marketing redirects → Task 2 ✓
- §4.3 show-once banner → Task 3 ✓
- §4.4 guard tests → Tasks 1–3 each include tests ✓
- §5 redirect list (10 sources, 307) → Task 2 ✓
- §6 cutover sequence (env, Supabase, Vercel flip, hygiene) → Task 5 ✓
- §7 announcement → Task 4 ✓
- §8 verification → Task 5 Step 5 ✓
- §9 rollback → Task 5 Step 7 ✓

**Placeholder scan:** no TBD/TODO; all code shown in full; `HIDE_AFTER` has a concrete date (owner-adjustable, noted).

**Type consistency:** `getSiteUrl(): string` (Task 1); redirect objects `{source,destination,permanent:false}` consistent between `next.config.ts` and the test's `R` type (Task 2); `MovedBanner` + `SEEN_KEY='glidepath-moved-notice-seen'` used identically in component and test (Task 3).
