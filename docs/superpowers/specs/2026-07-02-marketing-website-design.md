# Glidepath Marketing Website — Design Spec

**Date:** 2026-07-02
**Status:** Approved section-by-section in brainstorming; pending final user review
**Owner:** Chris (Glidepath Technologies, LLC)

---

## 1. Purpose & goals

Turn `glidepathops.com` into the marketing and SEO home for Glidepath, and move
the app itself to `app.glidepathops.com`.

Three goals, balanced (per user decision):

1. **Generate demo requests** — every page funnels toward `/demo`.
2. **Credibility for evaluators** — airfield managers, base leadership, and
   airport directors vetting the product find depth, compliance posture, and
   professionalism.
3. **SEO discovery** — rank for the two keyword universes: military
   ("airfield management software") and civilian ("airport operations
   software", "Part 139 airport management software").

**Brand facts:** Company is Glidepath Technologies, LLC (filing pending).
Motto: *"Guiding you to mission success."* Logo assets already exist in the app
repo (`public/Glidepath_logo_*.png`, light/dark variants + favicon + PWA icon).

**Hard requirements from the user:**

- Must NOT look like a typical AI-generated website. Clean, polished, very
  professional.
- Showcase all modules with explainers: how each works, the benefit it adds.
- Clear split between the civilian airport version and the military version.
- Embed actual app screenshots when highlighting modules.
- Homepage must be extremely eye-catching and enticing.
- As thorough as aerosimple.com or more — but must not look like their site.
- Include a guide for setting up the new repo and getting the site user-facing.

---

## 2. Competitor context (aerosimple.com, mapped 2026-07-02)

Aerosimple's footprint: ~88 thin `/solutions/` pages (modules sliced into many
feature-level pages — six `incident-*`, five `asset-*`, four training pages),
a ~60-post blog, 4 customer stories, about, contact, industry-affiliation,
privacy/terms, one `vs-veoci` comparison page, all localized in EN/ES/PT.
Look: white corporate SaaS.

**Our counter-strategy:** fewer, deeper, better-organized pages (~36 module
explainers plus pillar pages), written per-audience, in a dark operational
visual identity they can't be confused with. Depth per page beats breadth of
thin pages; regulation-mapping is the credibility axis they don't own.

Marketing framing rule (standing user guidance): competition is other
software — lead with automation and compliance. **Never** use
"replaces paper/whiteboards" framing.

---

## 3. Information architecture

```
glidepathops.com
├── /                        Homepage
├── /military                Military track overview (pillar page)
│   └── /military/<module>   ~22 module explainer pages
├── /civilian                Civilian track overview (pillar page)
│   └── /civilian/<module>   ~14 module explainer pages
├── /platform                Cross-cutting capabilities: offline PWA,
│                            permission matrix, multi-base tenancy, PDF/report
│                            exports, branded email, maps & geospatial engine
├── /security                Security & compliance
├── /about                   Company: LLC, motto, story
├── /faq                     FAQ (procurement, onboarding, data ownership,
│                            offline capability)
├── /demo                    Demo request form — the site-wide CTA target
├── /privacy · /terms        Legal
```

**Two solution tracks with separately-written pages, even for shared
modules.** Military wildlife is BASH / DAFMAN 91-212 / strike reporting;
civilian wildlife is §139.337 / wildlife hazard management. Different
keywords, different regs, different reader — genuinely different copy, so no
duplicate-content risk, and each page ranks in its own universe.

**Track pillar pages** (`/military`, `/civilian`): full module grid, generic
adoption stats, demo CTA. These target the head terms.

**Out of scope for v1** (explicit decisions): blog/resources section
(post-launch candidate), pricing page (contact-for-pricing posture),
localization, customer stories/testimonials (slots can be added later once
claims are cleared).

### Module rosters (draft — final list confirmed at content-writing time)

**Military (~22):** Airfield Status · Dashboards · Airfield Checks ·
Inspections · ACSI · Discrepancies · CES Work Orders · Visual NAVAIDs ·
Parking Plans · Obstructions · QRCs · Shift Checklist · Wildlife/BASH ·
Waivers · NOTAMs · PPR · SCN · Daily Reviews · Personnel on Airfield · AMTR ·
FLIP Management · Events Log & Reports

**Civilian (~14):** Airport Status · Dashboards · Self-Inspections ·
Discrepancies/Work Orders · SMS · AEP · §139.303 Training · Wildlife ·
NOTAMs · PPR · Parking · Personnel · Reports · Records Export

---

## 4. Terminology policy (mirrors `lib/airport-mode.ts`)

The site follows the product's own dual-mode dictionary:

- **Military track:** "airfield" everywhere — Airfield Manager, airfield
  management, DAFMAN vocabulary. This is the career field's own name and what
  that buyer searches.
- **Civilian track:** "airport" for the facility, people, and category —
  Airport Operations Manager, airport operations software. "Airside/airfield"
  only when naming physical movement-area features (e.g., airfield condition
  reporting).
- **Shared surfaces (homepage, nav, footer, about):** dual phrasing. Hero
  sub-line: *"One operations platform for military airfields and Part 139
  airports — built on the regulations you operate under."* Split-section
  header: **"Built for your operation"**, cards labeled **Military
  Airfields** / **Civilian Airports**.

Additional standing terminology rules that apply to all site copy:

- "Airfield Manager" — never "AMT"; never "AMOPS controller"/"airfield
  controller"/"AMOPS staff" (AMOPS names the office).
- "FOD Check", never "FOD walk"; no "walk (the) route" phrasing for checks or
  inspections.
- Role names in prose are human labels ("base admin"), never snake_case keys;
  internal role keys are never surfaced.
- Regulatory citations must be real — never fabricate DAFMAN/AFI/AC paragraph
  numbers or contents. When in doubt, omit the paragraph number.
- Data posture language: "no sensitive personal data" (not "no PII").

---

## 5. Claims & military-references policy

User decision: **generic adoption stats** tier.

- Allowed: anonymous aggregates — "in daily use at military airfields",
  "X airfields onboarded", "Y inspections completed on the platform".
- Not allowed: installation/unit names, service emblems or seals, "trusted by
  the USAF" or anything implying official endorsement, named testimonials
  (until separately cleared by the user).
- The user is active duty; nothing on the site may leverage rank, position, or
  official affiliation.

---

## 6. Visual identity

**Direction: dark, operational** — the site inherits the app's world so
screenshots blend seamlessly and the whole thing reads as one product.

- **Surfaces:** near-black navy (derive scale from the app's dark theme).
- **Accent:** the app's sky-blue (`#38BDF8` family) for interactive elements
  and the glidepath motif.
- **Amber:** small status markers only, outlined-pill recipe (tinted bg +
  amber border + amber text) — never filled bright-amber blocks.
- **Typography:** strong grotesque for headlines; monospace for anything that
  *is data* — reg citations, stat counters, coordinates, module chips.
  Readability and hierarchy come first; the palette stays calm.
- **Signature motif:** the glidepath — a thin descending line introduced in
  the hero and recurring as a section divider. Brand-true, not available in
  any template.
- **Deliberately avoided ("AI-site" tells):** gradient blobs, floating 3D
  cards, emoji feature grids, stock photos of people pointing at screens,
  fake-device mockup frames, purple-gradient SaaS default styling.

---

## 7. Homepage

```
┌─────────────────────────────────────────────────────────┐
│ ◇ GLIDEPATH        Military  Civilian  Platform  Security│
│                                        [Request a demo]  │
├─────────────────────────────────────────────────────────┤
│  HERO — full-viewport, near-black                        │
│     Guiding you to mission success.                      │
│     One operations platform for military airfields and   │
│     Part 139 airports — built on the regulations you     │
│     operate under.                                       │
│     [Request a demo]   [Explore the platform ↓]          │
│   ⟍                                                      │
│     ⟍   ← glidepath line descends across the hero        │
│       ⟍______ into a full-width app screenshot           │
│   ┌──────────────────────────────────────────┐           │
│   │  (Airfield Status — the real app, dark)  │           │
│   └──────────────────────────────────────────┘           │
├─────────────────────────────────────────────────────────┤
│  BUILT FOR YOUR OPERATION — the split, immediately       │
│  ┌───────────────────────┐  ┌───────────────────────┐   │
│  │ MILITARY AIRFIELDS    │  │ CIVILIAN AIRPORTS     │   │
│  │ DAFMAN 13-204 ops     │  │ FAA Part 139 ops      │   │
│  │ 22 modules →          │  │ 14 modules →          │   │
│  └───────────────────────┘  └───────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  BUILT ON THE REGULATIONS — mono-type strip:             │
│  DAFMAN 13-204 · UFC 3-260-01 · AFMAN 91-203 ·           │
│  DAFMAN 91-212 · 14 CFR Part 139                         │
├─────────────────────────────────────────────────────────┤
│  THREE DEEP-DIVES (alternating screenshot/copy):         │
│  1 Visual NAVAIDs — DAFMAN 13-204 V2 Table A3.1          │
│    threshold detection (the headline capability)         │
│  2 Inspections & Checks — start to signed PDF            │
│  3 Live airfield status — NOTAMs, WWA, discrepancies     │
├─────────────────────────────────────────────────────────┤
│  MODULE MOSAIC — all modules as chips, filter Mil/Civ    │
├─────────────────────────────────────────────────────────┤
│  STATS BAND (generic adoption) + SECURITY STRIP          │
│  → links to /security                                    │
├─────────────────────────────────────────────────────────┤
│  CLOSING CTA — "See your airfield in Glidepath."         │
│  [Request a demo]                                        │
└─────────────────────────────────────────────────────────┘
```

The hero screenshot is the eye-catcher: the real Airfield Status page, staged
demo data, full-bleed — the product is the artwork. Below the fold, every
section leads with automation and compliance outcomes.

---

## 8. Module explainer pages

Every module page follows one consistent structure:

1. **The problem** — stated in the reader's own workflow language.
2. **How it works** — 2–3 real screenshots with captions that describe what is
   actually visible in the image (captions are written from the screenshot,
   not from the plan).
3. **Regulation mapping** — the real citation the module implements
   (e.g., Visual NAVAIDs headlined by DAFMAN 13-204 V2 Table A3.1 threshold
   detection; bar-out detection is a sub-feature).
4. **The benefit** — automation and compliance outcomes.
5. **Related modules** — cross-links within the track.
6. **Short FAQ block** — 3–5 questions, emitted as JSON-LD `FAQPage`.

**Content model:** typed TypeScript data files (one per module page) rendered
through a single polished template. The same data emits meta tags, OG data,
and JSON-LD. No CMS. Track overview pages read the same data to build their
module grids, so rosters can't drift.

---

## 9. Screenshot pipeline

- **Two staged demo tenants** in the existing app with fictional identities:
  one military base, one civilian Part 139 airport. Seeded via scripts
  (reproducible, not hand-clicked) with believable data: open discrepancies at
  varied statuses, a day's checks, NOTAMs, wildlife sightings, a parking plan,
  an in-progress inspection. No real-base operational data ever appears.
- **Map imagery consideration:** map modules show real satellite imagery of
  somewhere. Demo tenants borrow the layout/coordinates of real but neutral
  public airfields under fictional names/ICAOs (standard demo practice;
  which airfields is a staging-time choice).
- **Scripted capture:** `scripts/capture-screenshots.ts` (Playwright) in the
  marketing repo — logs in as a demo user, walks a manifest of routes at
  1600×1000 @2x, dark theme, writes optimized WebP/AVIF into site assets.
  One command refreshes every screenshot when the app UI evolves.
- **Presentation:** thin border + subtle shadow. No fake device frames.

---

## 10. Demo form & lead capture (`/demo`)

**Form fields (five, deliberately short):** name · work email · organization
type (military base / civilian airport / other) · role · free-text "what
would you like to see?".

**Flow:** Next.js route handler →

1. Insert lead row into a new `marketing_leads` table in the existing
   Supabase project — service-role insert only, deny-all RLS; the app never
   reads it.
2. Notification email to the user via Resend.
3. Plain-text confirmation auto-reply to the requester — .mil-deliverability
   safe: no external HTTP links, plain text, reply-to `info@glidepathops.com`.

**Abuse protection:** the app's existing `check_rate_limit` RPC via service
role (same pattern as the public-form rate limiting shipped 2026-07-02), plus
a honeypot field. No CAPTCHA at launch.

**Analytics:** Vercel Analytics (zero-config, no cookie banner) to measure
which module pages draw traffic and demo conversions.

**Pricing posture:** no public pricing; "contact for pricing".

---

## 11. Security & compliance page (`/security`)

Content pillars: data posture (no sensitive personal data on the platform),
tenant isolation (row-level security, permission-matrix enforcement),
DAFMAN 13-204 Vol 2 Para 2.5.2.10 web-based-program suitable-substitute
authorization, client-side PDF generation (documents never transit third
parties), and the hosting & accreditation roadmap — commercial cloud today,
Platform One migration path toward IL4/IL5 — presented explicitly as a
roadmap in progress, with no dates and never implying current DoD
accreditation. Written for both audiences; no fabricated regulatory text.

---

## 12. Stack & repo setup

**Decision: Next.js 15 (App Router) + Tailwind on Vercel, new private repo
`glidepath-site`.** Same stack as the app: highest familiarity/velocity, SEO
fully covered by static rendering + metadata API, Resend pattern reused, both
projects on one Vercel account. (Astro considered and declined — second
framework to maintain for marginal gains. Site builders declined — template-y,
outside git.)

Repo conventions mirror the app:

- TypeScript strict, ESLint flat config, kebab-case files, `@/*` alias.
- `ci.yml`: lint + `npx tsc --noEmit` + build (lint decoupled from build —
  the Next 15 CI lesson from the app repo, baked in from day one).
- Own `CLAUDE.md` capturing the site's conventions.
- Commit conventions match the app repo.

**Env vars:** `RESEND_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
(leads + rate limiter only — the site never ships an anon Supabase client).

Pages are statically rendered except the demo-form route handler. Images via
`next/image`.

---

## 13. Go-live & domain cutover sequence

Ordered to keep the app available throughout; the user executes the cutover
steps at a time of their choosing.

1. **Build on preview.** New Vercel project on `glidepath-site`; all iteration
   on preview URLs. Apex untouched.
2. **Move the app first.** Add `app.glidepathops.com` to the existing app
   Vercel project. Update Supabase Auth (Site URL + redirect URLs) to include
   it. Sweep hardcoded-domain references (email templates, version-string
   spots). Verify auth, email links, and public forms on the new subdomain.
   Both domains serve the app during this window.
3. **PWA caveat (plan around it):** service-worker installs and the offline
   queue are origin-bound. Installed users must reinstall from
   `app.glidepathops.com`; unsynced queue items on the old origin do not
   follow. Announce the move; time the cutover for when queues are
   realistically empty.
4. **Cut the apex.** Remove `glidepathops.com` from the app project; add it to
   the marketing project. DNS already points at Vercel — dashboard-only
   operation, near-zero downtime, TLS automatic.
5. **Transition redirects** on the marketing site — an explicit list (not a
   wildcard), 308s to `app.glidepathops.com`: `/login`, `/dashboard`,
   `/feedback/:baseId`, `/kiosk/:icao`, `/:icao/ppr-request`, legacy
   `/ppr-request/:baseId`, plus any other app entry points found at
   implementation time. QR codes in the wild are few and will be reprinted
   (user decision); redirects cover the transition window.
6. **Launch hygiene:** `sitemap.xml`, `robots.txt`, per-page OG images,
   JSON-LD (Organization + FAQPage), custom 404, Google Search Console
   verification, demo form tested end-to-end, Lighthouse pass on key pages.

---

## 14. Phasing (review-gated)

| Phase | Scope | Estimate |
|---|---|---|
| 1 | Repo scaffold, design system, homepage | 1–2 sessions |
| 2 | Module-page template + content model; demo tenants seeded; screenshot pipeline running | 2–3 sessions |
| 3 | All ~36 module pages, both tracks | 2–3 sessions |
| 4 | `/security`, `/about`, `/faq`, `/demo` form + polish | 1 session |
| 5 | App domain move, apex cutover, launch checklist | 1 session (timed by user) |

Total ≈ 7–10 sessions; two to three weeks part-time calendar. Each phase ends
at a reviewable state before the next begins.

---

## 15. Success criteria

- The site is visually distinct from aerosimple.com and from generic
  AI-generated SaaS templates; dark operational identity carried consistently.
- ≥36 module explainer pages live, each with real staged screenshots,
  accurate regulation mapping, and per-audience terminology.
- Demo form delivers leads (row + email) and survives abuse (rate limited).
- App fully functional on `app.glidepathops.com`; old public paths redirect.
- Lighthouse: 90+ across the board on homepage and pillar pages; valid
  structured data; indexed in Search Console.
