# Marketing Site Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish every remaining glidepath-site page (platform, security, about, faq, demo lead-capture, legal, 404) plus OG images and structured data, so launch has zero stubs.

**Architecture:** All copy in `lib/` data files rendered by thin page components (existing pattern); one Next route handler (`/api/demo`) as the only non-static surface, writing to a deny-all-RLS `marketing_leads` table in the existing Supabase project via service role; OG images generated at build-review time by a Playwright script into `public/og/`.

**Tech Stack:** Next.js 15 App Router (static + one route handler), Tailwind, Vitest + Testing Library, Playwright (already a devDependency), Resend, Supabase service-role client, `@vercel/analytics`.

**Spec:** `airfield-app/docs/superpowers/specs/2026-07-04-marketing-site-phase-4-design.md` (and parent spec `2026-07-02-marketing-website-design.md`).

## Global Constraints

- Repos: site work in `C:/Users/cspro/glidepath-site`; Task 7's migration in `C:/Users/cspro/airfield-app`.
- **No em dashes (`—`) and no spaced en dashes (` – `) in any rendered copy string.** Task 1's guard enforces this; write prose with colons, commas, parentheses, or new sentences.
- **Naming:** copy says **Glidepath**. The string "Glidepath Technologies" may appear ONLY in `lib/about-content.ts`, `lib/platform-content.ts`, `lib/legal-content.ts`, the footer copyright (`siteConfig.legalName`), and Organization JSON-LD `legalName`.
- Terminology guards are law (`tests/terminology.test.ts`): never "AMT", "FOD walk", paper/whiteboard/clipboard comparisons, snake_case role keys, "PII" (say "sensitive personal data"), endorsement claims. Every new copy file registers in `allCopy()`.
- metaTitle ≤ 60 chars; metaDescription ≤ 160 chars. No fabricated regulatory text: cite only DAFMAN 13-204 V2 Para 2.5.2.10, and only as the spec words it.
- No founder name, rank, base, or "active-duty" anywhere. No dates in the accreditation roadmap; nothing readable as current DoD accreditation.
- Screenshots: reuse `public/screenshots/*.png` only; every caption is written from the actual frame; no new captures.
- Kebab-case filenames; copy never hardcoded in components; `@/*` alias imports.
- Gates before EVERY commit: `npx tsc --noEmit && npm run lint && npm run test && npm run build` all green (RC=0).
- Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` plus the `Claude-Session:` line used by this session. Never commit `.env*`.
- Do not push; the session lead batches pushes.

---

### Task 1: Copy guards (em-dash ban + legal-name scope)

**Files:**
- Modify: `tests/terminology.test.ts`

**Interfaces:**
- Consumes: existing `allCopy()` and `FORBIDDEN` array in that file.
- Produces: `allCopy(exclude?: string[])` signature change is NOT made; instead a second flattener `scopedCopy()` (see below) that later tasks' content files must respect. Later tasks add their content imports to BOTH lists as instructed per task.

- [ ] **Step 1: Add the em-dash guard entries to `FORBIDDEN`**

In `tests/terminology.test.ts`, append to the `FORBIDDEN` array:

```ts
  { name: 'em dash in rendered copy (owner rule 2026-07-04)', pattern: /—/ },
  { name: 'spaced en dash in rendered copy', pattern: / – / },
```

- [ ] **Step 2: Add the legal-name scope guard**

Below the existing `describe` block, add (imports at top of file as needed):

```ts
/**
 * Owner rule 2026-07-04: the site says "Glidepath"; the legal name appears
 * only where formality belongs. Copy sources allowed to carry it are listed
 * here; everything else must say Glidepath. siteConfig is allowed solely for
 * the footer's legalName field.
 */
describe('legal-name scope (spec §2)', () => {
  it('only about/platform/legal copy (and siteConfig.legalName) name the LLC', () => {
    const scoped = JSON.stringify([
      MODULES, coreModules, coreModulesSection, heroContent, opsBoard,
      regulationStrip, tracksSection, securityStrip, closingCta, demoContent,
      MODULE_PAGES, trackContent,
      { ...siteConfig, legalName: '' },
    ])
    const match = scoped.match(/Glidepath Technologies/)
    expect(match, `legal name outside its allowed scope: "${match?.[0]}"`).toBeNull()
  })
})
```

(Tasks 2, 3, 6, 8 will add their new content imports to `allCopy()`, and to this scoped list ONLY when the file is not an allowed carrier: `lib/security-content.ts`, `lib/faq-content.ts`, and demo-form copy join the scoped list; `lib/platform-content.ts`, `lib/about-content.ts`, `lib/legal-content.ts` join `allCopy()` only.)

- [ ] **Step 3: Run the suite; expect green**

Run: `npm run test`
Expected: all tests pass (current copy was swept today; guard passes).

- [ ] **Step 4: Gates + commit**

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build
git add tests/terminology.test.ts
git commit -m "test: ban em dashes and scope the legal name in copy"
```

---

### Task 2: `/platform` page

**Files:**
- Create: `lib/platform-content.ts`
- Modify: `app/platform/page.tsx` (replace stub), `tests/terminology.test.ts` (register content)

**Interfaces:**
- Produces: `export const platformContent: PlatformContent` where

```ts
export interface PlatformCapability {
  key: string            // kebab id, used for section anchor
  title: string
  body: string[]         // 2-3 paragraphs
  screenshot?: { src: string; alt: string; caption: string }
}
export interface PlatformContent {
  metaTitle: string      // ≤60
  metaDescription: string// ≤160
  eyebrow: string
  title: string          // page h1
  lead: string
  capabilities: PlatformCapability[]  // exactly 6, in spec order
}
```

- [ ] **Step 1: Write `lib/platform-content.ts`**

Six capabilities in spec order. Section briefs (write the prose to these facts; the LLC name MAY appear here where the formal name helps, at most once):

1. `offline-pwa` — "Works where the connection doesn't": installable PWA; writes queue locally when the field drops signal and sync when it returns; the day's work never waits on bars. Screenshot: `/screenshots/mil-checks.png` (caption written from the frame: the Airfield Checks list for a demo airfield).
2. `permission-matrix` — "Permissions enforced in the database": roles crossed with permission keys; every read and write is gated by row-level security server-side, so access rules hold even if the UI is wrong. No screenshot (no honest banked frame).
3. `multi-base-tenancy` — "One account, many airfields": per-base data isolation; switch bases without switching accounts. Screenshot: `/screenshots/mil-status-still.png` (frame shows the base name and code in the top bar).
4. `pdf-exports` — "Documents generated on your machine": every report renders client-side in the browser; records never transit third-party servers on the way to a PDF. Screenshot: `/screenshots/civ-records-export.png` (caption from the frame).
5. `branded-email` — "Mail that reaches operational inboxes": transactional email (invites, password resets, PDF distribution) sent as Glidepath with reply-to info@glidepathops.com; plain-text-friendly for strict mail environments. No screenshot.
6. `maps-engine` — "The airfield as a map, not a list": satellite base layers, feature maps for lighting and signs, and the clearance and surface math behind parking plans and obstruction evaluations. Screenshot: `/screenshots/mil-parking.png` (caption from the frame).

metaTitle: `Platform Capabilities Under Every Glidepath Module` (52). metaDescription ≤160 covering PWA/permissions/tenancy/PDF/email/maps.

- [ ] **Step 2: Replace `app/platform/page.tsx`**

```tsx
import type { Metadata } from 'next'
import { Container } from '@/components/ui/container'
import { SectionHeading } from '@/components/ui/section-heading'
import { AppFrame } from '@/components/ui/app-frame'
import Link from 'next/link'
import { platformContent as c } from '@/lib/platform-content'

export const metadata: Metadata = { title: c.metaTitle, description: c.metaDescription }

export default function PlatformPage() {
  return (
    <Container className="py-24">
      <SectionHeading as="h1" eyebrow={c.eyebrow} title={c.title} />
      <p className="mt-4 max-w-2xl text-lg text-muted">{c.lead}</p>
      <div className="mt-16 space-y-20">
        {c.capabilities.map((cap) => (
          <section key={cap.key} id={cap.key}>
            <h2 className="display-title text-3xl font-bold">{cap.title}</h2>
            {cap.body.map((p) => (
              <p key={p.slice(0, 32)} className="mt-4 max-w-3xl text-muted">{p}</p>
            ))}
            {cap.screenshot ? (
              <figure className="mt-8">
                <AppFrame src={cap.screenshot.src} alt={cap.screenshot.alt} />
                <figcaption className="mt-3 max-w-3xl text-sm text-faint">{cap.screenshot.caption}</figcaption>
              </figure>
            ) : null}
          </section>
        ))}
      </div>
      <div className="mt-20"><Link href="/demo" className="btn-primary">Request a demo</Link></div>
    </Container>
  )
}
```

(Check `AppFrame`'s actual props in `components/ui/app-frame.tsx` before use; it accepts `src`, `alt`, optional `label`. Match the module-page figure classes if they differ.)

- [ ] **Step 3: Register in guards** — in `tests/terminology.test.ts`, import `{ platformContent }` and add to `allCopy()` (NOT to the scoped list; platform is an allowed carrier).

- [ ] **Step 4: Gates + eyeball**

Run: `npx tsc --noEmit && npm run lint && npm run test && npm run build`
Then `npm run build` output must list `/platform` as static (○).

- [ ] **Step 5: Commit**

```bash
git add lib/platform-content.ts app/platform/page.tsx tests/terminology.test.ts
git commit -m "feat: replace the /platform stub with the six-capability page"
```

---

### Task 3: `/security` page

**Files:**
- Create: `lib/security-content.ts`
- Modify: `app/security/page.tsx` (replace stub), `tests/terminology.test.ts`

**Interfaces:**
- Produces: `export const securityContent: SecurityContent`:

```ts
export interface SecurityPillar { key: string; title: string; body: string[] }
export interface SecurityContent {
  metaTitle: string; metaDescription: string
  eyebrow: string; title: string; lead: string
  pillars: SecurityPillar[]   // exactly 5, spec order
}
```

- [ ] **Step 1: Write `lib/security-content.ts`** — five pillars, briefs (say "Glidepath", never the LLC name here):

1. `data-posture` — no sensitive personal data on the platform; operational records only (status, inspections, discrepancies, training currency). Use exactly the phrase "sensitive personal data".
2. `tenant-isolation` — row-level security on every operational table; the permission matrix is enforced in the database, not hidden in the UI; each base's records are isolated per tenant.
3. `regulatory-authorization` — DAFMAN 13-204 V2 Para 2.5.2.10 recognizes a web-based program as a suitable substitute for prescribed forms and logs; Glidepath's record structure is built to that authorization. State only this; no other paragraph numbers.
4. `client-side-documents` — PDFs render in the user's browser; documents never transit third-party servers; what leaves the building is the user's choice.
5. `hosting-roadmap` — today: commercial cloud (Vercel and Supabase) with the isolation above. Roadmap: a Platform One migration path toward IL4/IL5 environments, stated as in progress. NO dates; include a sentence making explicit that this is a roadmap, not a current accreditation.

metaTitle: `Security & Compliance` is taken by the stub title; use `Glidepath Security & Compliance Posture` (38). metaDescription ≤160.

- [ ] **Step 2: Replace `app/security/page.tsx`** — same shape as Task 2's page (SectionHeading, mapped pillar sections, demo CTA), no figures.

- [ ] **Step 3: Register** — import `{ securityContent }` into `allCopy()` AND into the legal-name scoped list (security may NOT carry the LLC name).

- [ ] **Step 4: Gates** (four commands, all green; `/security` static in build output).

- [ ] **Step 5: Commit**

```bash
git add lib/security-content.ts app/security/page.tsx tests/terminology.test.ts
git commit -m "feat: replace the /security stub with the five-pillar page"
```

---

### Task 4: `/about` page

**Files:**
- Create: `lib/about-content.ts`, `app/about/page.tsx`
- Modify: `tests/terminology.test.ts`, `app/sitemap.ts` (add `/about`)

**Interfaces:**
- Produces: `export const aboutContent: AboutContent`:

```ts
export interface AboutContent {
  metaTitle: string; metaDescription: string
  eyebrow: string; title: string
  story: string[]        // 2-3 paragraphs, owner-approved beats
  today: string          // one paragraph: 36 modules, two tracks
  company: { name: string; legalName: string; motto: string; email: string }
  cta: { label: string; href: string }
}
```

- [ ] **Step 1: Write `lib/about-content.ts`** — the story paragraphs expand EXACTLY these owner-approved beats, and nothing else: built by an Airfield Manager who wanted the whole airfield day (status, inspections, discrepancies, the records that prove compliance) in one place; started as a tool for one airfield office; grew module by module; in daily use at military airfields today; Glidepath Technologies, LLC exists to bring that inside-the-job design to every airfield and Part 139 airport. **Forbidden: any name, rank, base, "active-duty", founding year.** `today`: 36 modules across the military and civilian tracks. `company`: name "Glidepath", legalName "Glidepath Technologies, LLC", motto "Guiding you to mission success.", email info@glidepathops.com. metaTitle: `About Glidepath` (15). metaDescription ≤160 from the story's first beat.

- [ ] **Step 2: Create `app/about/page.tsx`** — one screen: SectionHeading, story paragraphs, `today` line, a bordered company block (legalName + motto + mailto link), demo CTA button. Same imports/pattern as Task 2's page.

- [ ] **Step 3: Register + sitemap** — `aboutContent` into `allCopy()` only (allowed carrier). In `app/sitemap.ts` add `'/about'` to the `routes` array.

- [ ] **Step 4: Gates** (all green; `/about` appears in build output and sitemap).

- [ ] **Step 5: Commit**

```bash
git add lib/about-content.ts app/about/page.tsx tests/terminology.test.ts app/sitemap.ts
git commit -m "feat: add /about with the owner-approved origin story"
```

---

### Task 5: `/faq` page (+ shared FAQ JSON-LD helper)

**Files:**
- Create: `lib/faq-content.ts`, `lib/faq-jsonld.ts`, `app/faq/page.tsx`, `tests/faq-page.test.ts`
- Modify: `components/modules/module-page.tsx` (use the helper), `tests/terminology.test.ts`, `app/sitemap.ts` (add `/faq`)

**Interfaces:**
- Produces:

```ts
// lib/faq-jsonld.ts
export function faqJsonLd(faq: { q: string; a: string }[]): object
// lib/faq-content.ts
export type FaqCategory = 'procurement' | 'onboarding' | 'data-ownership' | 'offline'
export interface FaqEntry { category: FaqCategory; q: string; a: string }
export const FAQ_CATEGORIES: { key: FaqCategory; label: string }[]
export const faqPage: { metaTitle: string; metaDescription: string; eyebrow: string; title: string; lead: string; entries: FaqEntry[] }
```

- [ ] **Step 1: Write the failing invariants test** — `tests/faq-page.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { faqPage, FAQ_CATEGORIES } from '@/lib/faq-content'
import { faqJsonLd } from '@/lib/faq-jsonld'

describe('faq page invariants (spec §6, §10.4)', () => {
  it('has exactly 12 entries, 3 per category', () => {
    expect(faqPage.entries).toHaveLength(12)
    for (const c of FAQ_CATEGORIES) {
      expect(faqPage.entries.filter((e) => e.category === c.key)).toHaveLength(3)
    }
  })
  it('meta lengths hold', () => {
    expect(faqPage.metaTitle.length).toBeLessThanOrEqual(60)
    expect(faqPage.metaDescription.length).toBeLessThanOrEqual(160)
  })
  it('JSON-LD carries all 12 entries', () => {
    const ld = faqJsonLd(faqPage.entries) as { mainEntity: unknown[] }
    expect(ld.mainEntity).toHaveLength(12)
  })
})
```

Run: `npm run test` — Expected: FAIL (modules do not exist yet).

- [ ] **Step 2: Create `lib/faq-jsonld.ts`** (extracted from `components/modules/module-page.tsx:16-24`):

```ts
export function faqJsonLd(faq: { q: string; a: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }
}
```

Update `components/modules/module-page.tsx` to `import { faqJsonLd } from '@/lib/faq-jsonld'` and replace the inline `faqLd` object with `const faqLd = faqJsonLd(content.faq)`.

- [ ] **Step 3: Write `lib/faq-content.ts`** — the exact 12 questions (answers written to these fact briefs, "Glidepath" only, no em dashes):

Procurement: (1) "How do we buy Glidepath?" → contact us and we'll work with your contracting or purchasing office; no vehicles named. (2) "What does Glidepath cost?" → contact for pricing; scoped to the operation's size and modules. (3) "Can we evaluate it first?" → yes, request a demo; walkthrough runs on scenarios like yours.
Onboarding: (4) "How long does it take to stand up a new airfield or airport?" → guided base setup walks the configuration step by step (runways, lighting, species, modules); most of the day-one work is done in the wizard. (5) "How do users get accounts?" → admins invite by email; role picked at invite; no self-signup. (6) "Do we need to install anything?" → no; it runs in the browser and installs as an app on phones and tablets from the browser.
Data ownership: (7) "Who owns the records?" → the customer; Glidepath stores and serves them. (8) "Can we get our data out?" → yes; records exports on demand (CSV and PDF) built for records custodians. (9) "Do documents pass through third parties?" → no; PDFs generate in the browser on the user's machine.
Offline: (10) "What happens when the connection drops on the airfield?" → writes queue locally and sync when the connection returns. (11) "Does it work on mobile?" → yes; installable app experience on phones, tablets, and desktops. (12) "Is offline data safe if the device is lost?" → the queue lives in the signed-in browser session; sessions are revocable by an admin. (Verify this answer's claim against the app before shipping: if session revocation is not literally true, the answer becomes "access is account-gated and accounts can be disabled by an admin", which is true.)

`FAQ_CATEGORIES` labels: Procurement, Onboarding, Data ownership, Offline capability. metaTitle: `Glidepath FAQ` (13). Lead sentence points procurement questions at /demo.

- [ ] **Step 4: Create `app/faq/page.tsx`** — category-grouped `<details>` blocks (same primitive as the module page FAQ section), one `<script type="application/ld+json">` from `faqJsonLd(faqPage.entries)`, demo CTA at the end.

- [ ] **Step 5: Register + sitemap** — `faqPage` into `allCopy()` AND the legal-name scoped list; `'/faq'` into the sitemap routes.

- [ ] **Step 6: Run tests** — `npm run test` — Expected: PASS including the new invariants.

- [ ] **Step 7: Gates + commit**

```bash
git add lib/faq-content.ts lib/faq-jsonld.ts app/faq/page.tsx tests/faq-page.test.ts components/modules/module-page.tsx tests/terminology.test.ts app/sitemap.ts
git commit -m "feat: add /faq with FAQPage JSON-LD and shared helper"
```

---

### Task 6: `/privacy`, `/terms`, custom 404, footer links

**Files:**
- Create: `lib/legal-content.ts`, `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/not-found.tsx`
- Modify: `components/layout/site-footer.tsx`, `app/sitemap.ts`, `tests/terminology.test.ts`

**Interfaces:**
- Produces: `export const privacyContent: LegalDoc`, `export const termsContent: LegalDoc` where

```ts
export interface LegalSection { heading: string; body: string[] }
export interface LegalDoc {
  metaTitle: string; metaDescription: string
  title: string; updated: string   // '2026-07-04'
  sections: LegalSection[]
}
```

- [ ] **Step 1: Write `lib/legal-content.ts`** — plain English, LLC named (allowed carrier). Privacy sections: What this site collects (demo-form fields: name, work email, organization type, role, message; stored in a private lead table; used only to respond); Analytics (Vercel Analytics, cookieless, no advertising trackers, no cross-site tracking); The Glidepath application (operational airfield records, no sensitive personal data; see /security); Your requests (email info@glidepathops.com to view or delete a lead). Terms sections: The service (operations platform for airfields and Part 139 airports, provided by Glidepath Technologies, LLC); Accounts and acceptable use (authorized users, no misuse or interference); Your records (the customer's records belong to the customer; exports available); Availability (provided as-is; no uptime warranty pre-contract; contracted terms supersede this page); Contact. Both docs `updated: '2026-07-04'`.

- [ ] **Step 2: Create the two pages** — shared rendering inline per page (title, "Last updated" line from `updated`, mapped sections). metaTitles: `Glidepath Privacy Policy` (23), `Glidepath Terms of Service` (26).

- [ ] **Step 3: Create `app/not-found.tsx`** — on-brand: display-title "That page isn't on the field.", one line of copy, three links (`/military`, `/civilian`, `/`). Copy short enough to keep inline is still copy: put the strings in `lib/legal-content.ts`? No: create nothing new; hardcoding is banned, so add a small `notFoundContent` export to `lib/site-config.ts` (title, line, links) and render from it.

- [ ] **Step 4: Footer + sitemap** — in `site-footer.tsx` append Privacy, Terms, About, FAQ to the footer nav list (static `<li>` entries after the mapped `siteConfig.nav` items, before Contact). Sitemap routes gain `'/privacy'`, `'/terms'` (404 never listed).

- [ ] **Step 5: Register** — `privacyContent`, `termsContent` in `allCopy()` only (allowed carrier); `notFoundContent` is inside `siteConfig`'s file: ensure it rides in via the existing `siteConfig` entry (it does if exported within `siteConfig`; otherwise add the export to `allCopy()` and the scoped list).

- [ ] **Step 6: Gates + commit**

```bash
git add lib/legal-content.ts app/privacy/page.tsx app/terms/page.tsx app/not-found.tsx components/layout/site-footer.tsx app/sitemap.ts lib/site-config.ts tests/terminology.test.ts
git commit -m "feat: add legal pages, custom 404, and footer links"
```

---

### Task 7: `marketing_leads` migration (airfield-app repo)

**Files:**
- Create: `C:/Users/cspro/airfield-app/supabase/migrations/2026070401_marketing_leads.sql`

**Interfaces:**
- Produces: table `marketing_leads` exactly as below; Task 8's insert uses these column names.

- [ ] **Step 1: Write the migration** (spec §7 schema verbatim):

```sql
-- Marketing-site demo-request leads (glidepath-site /api/demo). Deny-all
-- RLS: zero policies; only the service role (which bypasses RLS) writes.
-- The app never reads this table.
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
```

- [ ] **Step 2: Apply to the linked project** (from `airfield-app`):

Run: `npx supabase db query --linked --file supabase/migrations/2026070401_marketing_leads.sql`
Expected: `"rows": []`, no error.

- [ ] **Step 3: Verify** — write a scratch SQL file with `SELECT relrowsecurity FROM pg_class WHERE relname = 'marketing_leads';` and run via the same CLI. Expected: one row, `relrowsecurity: true`. Also verify zero policies: `SELECT count(*) FROM pg_policies WHERE tablename = 'marketing_leads';` → `0`.

- [ ] **Step 4: Commit (airfield-app)**

```bash
git add supabase/migrations/2026070401_marketing_leads.sql
git commit -m "Add deny-all marketing_leads table for the site demo form"
```

---

### Task 8: `/demo` lead-capture form and route handler

**Files:**
- Create: `lib/demo-form-content.ts`, `lib/lead-validation.ts`, `lib/rate-limit.ts` (copied from app), `app/api/demo/route.ts`, `components/demo-form.tsx`, `tests/lead-validation.test.ts`
- Modify: `app/demo/page.tsx`, `tests/terminology.test.ts`, `package.json` (add `resend`, `@supabase/supabase-js`)

**Interfaces:**
- Consumes: `marketing_leads` columns from Task 7; `checkRateLimits(admin, rules)` + `getClientIp(request)` (copied verbatim from `airfield-app/lib/rate-limit.ts`).
- Produces: `validateLead(input: unknown): { ok: true; lead: Lead } | { ok: false }` with `type Lead = { name: string; email: string; organization_type: 'military'|'civilian'|'other'; role: string | null; message: string | null }`.

- [ ] **Step 1: Failing validation tests** — `tests/lead-validation.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validateLead } from '@/lib/lead-validation'

const valid = { name: 'A. Reyes', email: 'ops@airport.gov', organizationType: 'civilian', role: 'Ops Manager', message: 'Self-inspections', website: '' }

describe('validateLead', () => {
  it('accepts a valid payload', () => {
    const r = validateLead(valid)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.lead.organization_type).toBe('civilian')
  })
  it('rejects missing name/email', () => {
    expect(validateLead({ ...valid, name: '' }).ok).toBe(false)
    expect(validateLead({ ...valid, email: '' }).ok).toBe(false)
  })
  it('rejects a malformed email', () => {
    expect(validateLead({ ...valid, email: 'not-an-email' }).ok).toBe(false)
  })
  it('rejects an unknown organization type', () => {
    expect(validateLead({ ...valid, organizationType: 'agency' }).ok).toBe(false)
  })
  it('rejects a filled honeypot', () => {
    expect(validateLead({ ...valid, website: 'http://spam' }).ok).toBe(false)
  })
  it('caps lengths', () => {
    expect(validateLead({ ...valid, message: 'x'.repeat(4001) }).ok).toBe(false)
  })
  it('nulls empty optionals', () => {
    const r = validateLead({ ...valid, role: '', message: '' })
    expect(r.ok && r.lead.role === null && r.lead.message === null).toBe(true)
  })
})
```

Run: `npm run test` — Expected: FAIL (`validateLead` not defined).

- [ ] **Step 2: Implement `lib/lead-validation.ts`**

```ts
export type Lead = {
  name: string
  email: string
  organization_type: 'military' | 'civilian' | 'other'
  role: string | null
  message: string | null
}

const ORG_TYPES = new Set(['military', 'civilian', 'other'])
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateLead(input: unknown): { ok: true; lead: Lead } | { ok: false } {
  if (typeof input !== 'object' || input === null) return { ok: false }
  const o = input as Record<string, unknown>
  if (typeof o.website === 'string' && o.website.trim() !== '') return { ok: false } // honeypot
  const name = typeof o.name === 'string' ? o.name.trim() : ''
  const email = typeof o.email === 'string' ? o.email.trim() : ''
  const orgType = typeof o.organizationType === 'string' ? o.organizationType : ''
  const role = typeof o.role === 'string' ? o.role.trim() : ''
  const message = typeof o.message === 'string' ? o.message.trim() : ''
  if (!name || name.length > 200) return { ok: false }
  if (!email || email.length > 320 || !EMAIL.test(email)) return { ok: false }
  if (!ORG_TYPES.has(orgType)) return { ok: false }
  if (role.length > 200 || message.length > 4000) return { ok: false }
  return {
    ok: true,
    lead: {
      name, email,
      organization_type: orgType as Lead['organization_type'],
      role: role || null,
      message: message || null,
    },
  }
}
```

Run: `npm run test` — Expected: PASS.

- [ ] **Step 3: Copy `lib/rate-limit.ts`** from `C:/Users/cspro/airfield-app/lib/rate-limit.ts` verbatim, adding a header comment: `// Copied from airfield-app/lib/rate-limit.ts (source of truth); same check_rate_limit RPC.`

- [ ] **Step 4: Install deps** — `npm install resend @supabase/supabase-js` (site never creates an anon client; service client lives only in the route handler).

- [ ] **Step 5: Write `app/api/demo/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { validateLead } from '@/lib/lead-validation'
import { checkRateLimits, getClientIp } from '@/lib/rate-limit'

export async function POST(request: Request) {
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ ok: false }, { status: 400 }) }

  const result = validateLead(body)
  // Honeypot and garbage both get a success-shaped response: nothing to learn.
  if (!result.ok) return NextResponse.json({ ok: true })

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  if (!url || !key || !resendKey) {
    console.error('[demo] missing env')
    return NextResponse.json({ ok: false }, { status: 500 })
  }
  const admin = createClient(url, key, { auth: { persistSession: false } })

  const ip = getClientIp(request)
  const allowed = await checkRateLimits(admin, [
    { bucket: `demo-form:ip:${ip}`, max: 5, windowSeconds: 3600 },
    { bucket: 'demo-form:global', max: 100, windowSeconds: 86400 },
  ])
  if (!allowed) return NextResponse.json({ ok: false }, { status: 429 })

  const { error } = await admin.from('marketing_leads').insert(result.lead)
  if (error) {
    console.error('[demo] insert failed:', error.message)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  const resend = new Resend(resendKey)
  const l = result.lead
  try {
    await resend.emails.send({
      from: 'Glidepath <info@glidepathops.com>',
      to: 'info@glidepathops.com',
      replyTo: l.email,
      subject: `Demo request: ${l.name} (${l.organization_type})`,
      text: `Name: ${l.name}\nEmail: ${l.email}\nOrganization type: ${l.organization_type}\nRole: ${l.role ?? ''}\n\n${l.message ?? ''}\n`,
    })
    await resend.emails.send({
      from: 'Glidepath <info@glidepathops.com>',
      to: l.email,
      replyTo: 'info@glidepathops.com',
      subject: 'Your Glidepath demo request',
      text:
        `Thanks for requesting a Glidepath demo. We received your request and will reply from info@glidepathops.com, usually within one business day.\n\n` +
        `If you need to add anything, just reply to this email.\n\nGlidepath\nGuiding you to mission success.\n`,
    })
  } catch (e) {
    // Lead is stored; a mail hiccup should not fail the request.
    console.error('[demo] email failed:', e instanceof Error ? e.message : e)
  }

  return NextResponse.json({ ok: true })
}
```

(Auto-reply: plain text, zero external HTTP links — the .mil rule. If the Resend SDK's current field name is `reply_to` rather than `replyTo`, match the SDK's types; check `node_modules/resend` types at implementation time.)

- [ ] **Step 6: Form copy in `lib/demo-form-content.ts`** — labels (Name, Work email, Organization type + the three option labels Military base / Civilian airport / Other, Role, "What would you like to see?"), submit label ("Request a demo"), success copy ("Request received. We'll reply from info@glidepathops.com, usually within one business day."), failure copy ("That didn't go through. Email info@glidepathops.com and we'll set it up directly."), rate-limit copy ("Too many requests from this connection. Email info@glidepathops.com instead."). No em dashes.

- [ ] **Step 7: Build `components/demo-form.tsx`** — `'use client'`; five labeled fields + hidden honeypot input (`name="website"`, `tabIndex={-1}`, `autoComplete="off"`, visually hidden class); disabled-while-submitting; POSTs JSON to `/api/demo`; renders success (swap form for the success line) / 429 / generic-failure states from the content file. Update `app/demo/page.tsx` to render the form above the surviving mailto fallback line.

- [ ] **Step 8: Register copy** — `demoFormContent` into `allCopy()` AND the scoped list.

- [ ] **Step 9: Gates** — all four green. Note: `npm run build` must show `/api/demo` as a dynamic route (ƒ) and every page still static.

- [ ] **Step 10: Manual verification against the preview after the next push** (deferred to Task 10's checklist; env vars must exist in Vercel first — surface to the session lead: `RESEND_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

- [ ] **Step 11: Commit**

```bash
git add lib/demo-form-content.ts lib/lead-validation.ts lib/rate-limit.ts app/api/demo/route.ts components/demo-form.tsx app/demo/page.tsx tests/lead-validation.test.ts tests/terminology.test.ts package.json package-lock.json
git commit -m "feat: demo lead-capture form, validation, rate limit, and emails"
```

---

### Task 9: OG image pipeline

**Files:**
- Create: `scripts/generate-og-images.mjs`, `lib/og.ts`, `public/og/*.png` (46), `tests/og-images.test.ts`
- Modify: `package.json` (devDeps `@fontsource/archivo`, `@fontsource/ibm-plex-mono`), every page's metadata (see step 4), `app/layout.tsx` (default OG for home)

**Interfaces:**
- Produces: `ogImage(routeKey: string): Metadata['openGraph'] & twitter fields` helper — exactly:

```ts
// lib/og.ts
export function ogRouteKey(path: string): string {
  return path === '/' ? 'home' : path.replace(/^\//, '').replace(/\//g, '-')
}
export function ogMeta(path: string, title: string) {
  const img = `/og/${ogRouteKey(path)}.png`
  return {
    openGraph: { images: [{ url: img, width: 1200, height: 630, alt: title }] },
    twitter: { card: 'summary_large_image' as const, images: [img] },
  }
}
```

- [ ] **Step 1: Failing OG existence test** — `tests/og-images.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { MODULE_PAGES } from '@/lib/modules'
import { ogRouteKey } from '@/lib/og'

const staticRoutes = ['/', '/military', '/civilian', '/platform', '/security', '/about', '/faq', '/demo', '/privacy', '/terms']

describe('og image coverage (spec §9)', () => {
  const routes = [...staticRoutes, ...MODULE_PAGES.map((m) => `/${m.track}/${m.slug}`)]
  it('is 46 routes', () => expect(routes).toHaveLength(46))
  for (const r of ['/', '/military']) {
    it(`sample route ${r} resolves a key`, () => expect(ogRouteKey(r)).toBeTruthy())
  }
  it('every route has its PNG', () => {
    const missing = routes.filter((r) => !existsSync(join(process.cwd(), 'public', 'og', `${ogRouteKey(r)}.png`)))
    expect(missing, `missing og images: ${missing.join(', ')}`).toEqual([])
  })
})
```

Run: `npm run test` — Expected: FAIL (no `lib/og.ts`, no PNGs).

- [ ] **Step 2: Create `lib/og.ts`** (code above). Install fonts: `npm install -D @fontsource/archivo @fontsource/ibm-plex-mono`.

- [ ] **Step 3: Write `scripts/generate-og-images.mjs`** — builds one route list (same construction as the test: static routes + module registry with each page's metaTitle and track), renders a 1200×630 HTML template per route with Playwright chromium, screenshots to `public/og/<key>.png`. Template (self-contained string; fonts via absolute `file://` paths into `node_modules/@fontsource/.../files/*.woff2` with `@font-face`): dark ground `#0B1220`-family per `tailwind.config.ts` ground token (read the exact hex from the config at implementation time), GLIDEPATH wordmark text in Archivo 700, page title up to two lines (clamp with ellipsis at ~70 chars), bottom row `glidepathops.com` in IBM Plex Mono plus a `MILITARY TRACK` / `CIVILIAN TRACK` tag and accent bar on module/pillar routes (sky accent for civilian, amber for military; read both hexes from the config). Wire `"og:images": "node scripts/generate-og-images.mjs"` into package.json scripts.

- [ ] **Step 4: Generate + wire metadata**

Run: `npm run og:images` — Expected: `wrote 46 images` log; `ls public/og | wc -l` → 46.

Wiring: `app/[track]/[slug]/page.tsx`'s `generateMetadata` spreads `...ogMeta(`/${track}/${slug}`, content.metaTitle)`; each static page's `metadata` export spreads `...ogMeta('/platform', c.metaTitle)` etc.; `app/layout.tsx` default metadata spreads `...ogMeta('/', 'Glidepath: Airfield & Airport Operations Platform')`.

- [ ] **Step 5: Eyeball the frames** — open 3 PNGs (home, one military module, one civilian) and confirm layout, no clipped titles, correct track tags. These are committed frames: the claims guardrail review applies (titles only, no tenant data, so this is a layout check).

- [ ] **Step 6: Run tests** — `npm run test` — Expected: PASS (coverage test green).

- [ ] **Step 7: Gates + commit**

```bash
git add lib/og.ts scripts/generate-og-images.mjs public/og tests/og-images.test.ts package.json package-lock.json app
git commit -m "feat: build-time OG images for all 46 routes"
```

---

### Task 10: Organization JSON-LD, Vercel Analytics, final sweep

**Files:**
- Modify: `app/layout.tsx`, `lib/site-config.ts`, `package.json` (`@vercel/analytics`), `README`/`CLAUDE.md` (env var note), `tests/seo.test.ts`

**Interfaces:**
- Consumes: everything prior. Produces: launch-ready Phase 4.

- [ ] **Step 1: Organization JSON-LD** — in `app/layout.tsx` body, one script tag:

```tsx
const orgLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Glidepath',
  legalName: 'Glidepath Technologies, LLC',
  url: siteConfig.url,
  logo: `${siteConfig.url}/brand/wordmark-dark.png`,
  email: siteConfig.contactEmail,
}
```

(Confirm the logo path exists in `public/brand/`; use the actual file present.)

- [ ] **Step 2: Analytics** — `npm install @vercel/analytics`; in `app/layout.tsx`: `import { Analytics } from '@vercel/analytics/react'` and render `<Analytics />` before `</body>`.

- [ ] **Step 3: seo test extension** — in `tests/seo.test.ts` add: every static page module under `app/{platform,security,about,faq,demo,privacy,terms}/page.tsx` exports metadata with title ≤60 and description ≤160 (import each page module and assert on its `metadata` export).

- [ ] **Step 4: CLAUDE.md note** — add the three env vars and the `og:images` script to `glidepath-site/CLAUDE.md` commands/env sections.

- [ ] **Step 5: Full gates** — all four green; build output check: 52 static paths (46 pages + 404 + robots + sitemap + _not-found internals as Next reports them) and `/api/demo` dynamic.

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx package.json package-lock.json tests/seo.test.ts CLAUDE.md lib/site-config.ts
git commit -m "feat: Organization JSON-LD, Vercel Analytics, launch sweep"
```

- [ ] **Step 7: Session-lead checklist (not subagent work)** — push both repos on owner authorization; add the three env vars in the Vercel dashboard (owner or lead with owner's say-so); verify the demo form end-to-end on the preview (lead row lands, notification at info@, auto-reply received, honeypot POST returns ok-and-stores-nothing, sixth rapid submit 429s); owner reviews /about, /security, /privacy, /terms copy.

---

## Self-review notes

- Spec coverage: §3→Task 2, §4→Task 3, §5→Task 4, §6→Task 5, §7→Tasks 7+8, §8→Task 6, §9→Task 9, §10 guards→Tasks 1/5/8/9/10, §2 naming→Tasks 1-10 via Global Constraints. Owner review of legal/about copy → Task 10 step 7.
- Types consistent: `Lead.organization_type` snake_case matches the DB column; the client posts `organizationType` camelCase and `validateLead` maps it (Task 8 steps 1-2 and 5 agree).
- FAQ answer 12 carries its own verify-before-shipping instruction; no other claim in the plan depends on unverified app behavior.
