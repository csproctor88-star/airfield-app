# Glidepath Marketing Site — Phase 4 Design Spec

**Date:** 2026-07-04
**Parent spec:** `2026-07-02-marketing-website-design.md` (spec of record for the site)
**Repo:** `glidepath-site` (one migration lands in `airfield-app`)
**Owner decisions captured:** 2026-07-04 brainstorm (scope, founder framing, entity naming, procurement posture, lead routing)

## 1. Purpose and scope

Phase 4 finishes every remaining page so the site launches with zero stubs and
Phase 5 reduces to a pure cutover checklist. Scope, as ruled by the owner:

- `/platform` — full capabilities page (was unassigned; pulled in)
- `/security` — security and compliance page
- `/about` — company page
- `/faq` — FAQ page with FAQPage JSON-LD
- `/demo` — the real lead-capture form and backend (spec §10 flow)
- `/privacy`, `/terms` — plain-language legal pages (was unassigned; pulled in)
- Custom 404 (was unassigned; pulled in)
- Per-page OG/social images + Organization JSON-LD
- New test guards (em-dash ban, OG existence, FAQ counts, lead-route validation)

Out of scope: blog/resources, pricing page, testimonials, localization (parent
spec v1 exclusions), the domain moves themselves (Phase 5), and any new
screenshot captures (Phase 4 reuses the banked frames only).

## 2. Content rules that bind every page in this phase

- All copy lives in `lib/` data files, registered in
  `tests/terminology.test.ts` `allCopy()` so every guard applies.
- **No em dashes in rendered copy** — locked by a new permanent guard (§9).
- Terminology policy per parent spec §4; claims policy per §5 (no real names,
  units, or bases in frames or copy; no endorsement claims; no fabricated
  regulatory text — cite only what the product actually implements).
- Dual-audience wording: military pages say airfield, civilian pages say
  airport, shared pages say both explicitly.
- The entity is named **Glidepath Technologies, LLC** site-wide. The filing is
  still pending and completes before the domain goes live (owner decision
  2026-07-04).

## 3. `/platform`

Replaces the stub. Six capability sections, in this order, each 2–3 paragraphs
in the module-page voice plus one screenshot reused from `public/screenshots/`:

1. **Offline-capable PWA** — installable, offline queue, what happens when the
   connection drops on the field.
2. **Permission matrix** — roles × permission keys; every feature gated
   server-side by row-level security, not hidden buttons.
3. **Multi-base tenancy** — one account, many airfields; per-base isolation.
4. **PDF and report exports** — client-side generation; documents never
   transit third parties; the report suite.
5. **Branded email** — transactional mail (invites, resets, PDF distribution)
   with reply-to `info@glidepathops.com`; .mil-deliverability posture.
6. **Maps and geospatial engine** — satellite base layers, feature maps,
   clearance and surface calculations behind parking and obstructions.

Copy in `lib/platform-content.ts`. Screenshot picks decided at plan time from
the existing bank; captions rewritten against the actual frames (caption rule
unchanged). Meta: title ≤60, description ≤160, same as module pages.

## 4. `/security`

Replaces the stub. Five pillars as titled sections (parent spec §11), copy in
`lib/security-content.ts`:

1. **Data posture** — no sensitive personal data on the platform; operational
   records only. (Exact phrasing rule: "no sensitive personal data".)
2. **Tenant isolation** — row-level security on every operational table;
   permission-matrix enforcement in the database, not the UI.
3. **Regulatory authorization** — DAFMAN 13-204 V2 Para 2.5.2.10 web-based
   program suitable-substitute authorization; states what the paragraph
   permits and what the product implements, nothing more.
4. **Client-side documents** — PDFs generated in the browser; records never
   transit third-party servers.
5. **Hosting and accreditation roadmap** — commercial cloud (Vercel +
   Supabase) today; Platform One migration path toward IL4/IL5 presented
   explicitly as a roadmap in progress. **No dates. No wording that could be
   read as current DoD accreditation.** Written for both audiences.

## 5. `/about`

New page, deliberately one screen. Structure:

1. **Origin story** (owner-approved premise, verbatim beats): built by an
   Airfield Manager who wanted the whole airfield day (status, inspections,
   discrepancies, the records that prove compliance) in one place; started as
   a tool for one airfield office; grew module by module; in daily use at
   military airfields today; Glidepath Technologies, LLC exists to bring that
   inside-the-job design to every airfield and Part 139 airport.
   **Constraints: no founder name, no rank, no base, no "active-duty".**
2. **What it is today** — 36 modules across two tracks, one platform.
3. **Company block** — Glidepath Technologies, LLC; motto "Guiding you to
   mission success."; contact `info@glidepathops.com`.
4. **Demo CTA.**

Copy in `lib/about-content.ts`. No dates or founding year (owner chose the
premise without a year).

## 6. `/faq`

New page. Twelve questions, three per category, all answerable from verifiable
product facts:

- **Procurement** — how to buy (generic posture, owner decision: "contact us
  and we'll work with your contracting or purchasing office"; no vehicles
  named); pricing (contact for pricing); demos/evaluation.
- **Onboarding** — base setup (the guided setup wizard), user invites and
  roles, realistic time-to-standing-up.
- **Data ownership** — the records are the customer's; exports on demand
  (Records Export, CSV/PDF); client-side PDF generation.
- **Offline capability** — PWA install, the offline write queue, what syncs
  when the connection returns.

Copy in `lib/faq-content.ts` typed `{ category, q, a }[]`. Page renders
category-grouped `<details>` blocks (same primitive as module-page FAQs) and
emits FAQPage JSON-LD with all twelve entries. Final question list drafted at
plan time; answers cite only shipped behavior.

## 7. `/demo` — lead capture form and backend

Implements parent spec §10 exactly; the stub's mailto line survives as a
fallback under the form.

**Form (client):** five fields — name, work email, organization type
(military base / civilian airport / other), role, free-text "what would you
like to see?" — plus a visually-hidden honeypot field. Client-side required
validation; accessible labels; success and failure states inline.

**Route handler (`app/api/demo/route.ts`, POST):**

1. Reject if honeypot filled (return success-shaped response; log nothing).
2. Validate fields server-side (presence, email shape, org-type enum,
   length caps).
3. Rate-limit by IP via the app's existing `check_rate_limit` RPC using the
   service-role client (same pattern as the app's public forms; exact
   signature read from the app repo at plan time — never reimplemented).
4. Insert into `marketing_leads` (below).
5. Resend: notification email to **info@glidepathops.com** (owner decision)
   with the lead's fields; plain-text auto-reply to the requester with no
   external HTTP links (.mil-safe), reply-to `info@glidepathops.com`.
6. Response never leaks which step failed (generic error copy); server logs
   carry the detail.

**Migration (lands in `airfield-app/supabase/migrations/`, applied via
`npx supabase db query --linked --file`):**

```sql
CREATE TABLE marketing_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  organization_type text NOT NULL
    CHECK (organization_type IN ('military', 'civilian', 'other')),
  role text,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE marketing_leads ENABLE ROW LEVEL SECURITY;
-- Deny-all: zero policies. Only the service role (which bypasses RLS)
-- writes; the app never reads it.
```

**Site env (Vercel):** `RESEND_API_KEY`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`. The site never ships an anon Supabase client;
the service client exists only inside the route handler.

**Analytics:** `@vercel/analytics` `<Analytics />` in the root layout
(cookieless, no banner), per parent spec §10.

## 8. `/privacy`, `/terms`, custom 404

Plain-language legal pages naming Glidepath Technologies, LLC, copy in
`lib/legal-content.ts`:

- **Privacy:** exactly what is real — demo-form fields stored in
  `marketing_leads`; cookieless Vercel Analytics; no advertising trackers; the
  app's operational data covered in one paragraph that points to `/security`;
  contact for data requests.
- **Terms:** honest SaaS basics — service description, acceptable use, data
  ownership (the customer's records are the customer's), availability
  disclaimer, contact.
- Both pages carry a "last updated" date and are **flagged for owner review**
  in the plan: clear English, not legal advice.
- Footer gains Privacy and Terms links; sitemap gains both routes.

**Custom 404 (`app/not-found.tsx`):** one on-brand screen, links to
`/military`, `/civilian`, and home. Not in the sitemap.

## 9. OG images and structured data

**Decision: build-time static generation** (owner-approved). A script
(`scripts/generate-og-images.mjs`) renders a branded 1200×630 HTML template
with the repo's existing Playwright dependency and writes one PNG per route to
`public/og/` (committed, reviewable like every other frame):

- Inputs: route registry (home, both pillars, all 36 module pages, platform,
  security, about, faq, demo, privacy, terms) — 46 images.
- Template: dark ground, wordmark, page title (the page's metaTitle as-is;
  the layout's "· Glidepath" suffix is a template artifact that never appears
  in metaTitle strings; the homepage card uses the site name), track accent
  bar and MILITARY/CIVILIAN tag on module pages, `glidepathops.com` footer.
  Self-contained HTML (system/self-hosted fonts, no CDN).
- Wiring: each page's `metadata` gains `openGraph.images` and
  `twitter: { card: 'summary_large_image' }` pointing at its PNG;
  `metadataBase` already resolves absolute URLs.

Rejected alternative: runtime `next/og` `ImageResponse` — keeps images out of
git and auto-synced, but adds edge functions to a fully static site and can't
be eyeballed before shipping. This repo reviews every frame; static wins.

**Organization JSON-LD** in the root layout: name (Glidepath), legalName
(Glidepath Technologies, LLC), url, logo, contactPoint (info@). FAQPage
JSON-LD stays on module pages and is added to `/faq`.

## 10. Tests and gates

New/extended tests, all in the existing vitest suites:

1. **Em-dash guard (permanent):** no `—` (and no spaced `–`) in any string
   surfaced by `allCopy()`; new content files register there.
2. **OG existence:** every sitemap route has its `public/og/*.png`; every
   page's metadata references an existing file.
3. **FAQ page invariants:** exactly 12 entries, 3 per category; JSON-LD count
   matches.
4. **Lead route validation:** unit tests for the handler's validation module —
   missing fields rejected, bad email rejected, honeypot short-circuits, valid
   payload shape accepted (Supabase/Resend mocked).
5. Existing guards (terminology, meta lengths, screenshot existence) apply to
   all new content automatically via `allCopy()` registration.

Gates unchanged: `npx tsc --noEmit` + `npm run lint` + `npm run test` +
`npm run build`, all green before every commit.

## 11. Sequencing and estimate

Suggested build order (each step reviewable): platform → security → about →
faq → legal + 404 → demo form + migration → OG pipeline + JSON-LD + analytics
→ final sweep (nav/footer links, sitemap, guards). Cross-repo touchpoint: the
`marketing_leads` migration commits to `airfield-app` and is applied to the
linked project before the form ships.

Estimate at Claude Code velocity: **1–2 sessions** (parent spec allotted 1;
the pulled-in scope adds the second's margin).

## 12. Acceptance

- Zero stub pages; every nav and footer link resolves to real content.
- All four gates green; new guards in place and passing.
- Demo form verified end-to-end on the preview deployment (lead row lands,
  notification arrives at info@, auto-reply arrives, honeypot and rate limit
  verified).
- OG images present for all 46 routes and referenced by page metadata.
- Owner has reviewed `/about`, `/security`, `/privacy`, `/terms` copy before
  Phase 5 cutover.
