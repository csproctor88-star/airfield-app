# Glidepath Codebase Primer

A self-paced learning plan to take you from "I built this" to "I can speak fluently about this" — written for someone with limited dev experience who needs to commercialize the app.

The goal is **not** to make you a developer. It's to give you a working mental model of every layer of the stack, so when an investor, customer, government CIO, or potential acquirer asks a technical question, you can answer it confidently — or know exactly which technical question matters.

Each phase has:
- **Concepts** — the ideas you should be able to explain
- **Reading list** — exact files in your repo
- **Talking points** — sample answers in plain English
- **Quiz yourself** — questions to be able to answer
- **Ask Claude** — prompts you can paste back to me when something doesn't click

Total time investment if done well: ~10–15 hours over 5–7 sessions. Don't rush it.

---

## Phase 0 — The 60-second pitch

Before anything else, learn to describe your app in three sentences. This is what you say at the top of every conversation.

> "Glidepath is a Progressive Web App for U.S. Air Force airfield management. It replaces paper logs, shared spreadsheets, and phone-based status updates with a single real-time platform that runs on Vercel and Supabase. It's regulation-compliant with DAFMAN 13-204 and UFC 3-260-01, currently deployed at one base in beta, with a Platform One Party Bus path for IL4/IL5 government accreditation."

Memorize that. Then translate each phrase to yourself:

| Phrase | What it means |
|---|---|
| Progressive Web App (PWA) | Runs in a browser, but installs to home screen and works offline like a native app — no app store needed |
| Vercel | Where the front-end runs (hosting). It's the company that makes Next.js |
| Supabase | Your database + authentication + file storage + real-time updates, all in one |
| DAFMAN 13-204 | Air Force manual that defines how airfields are managed — your app implements it |
| Platform One Party Bus | DoD's program for getting commercial software accredited to handle classified data |
| IL4 / IL5 | Department of Defense impact levels — IL4 = sensitive but unclassified, IL5 = controlled unclassified info (CUI) |

**Talking point:** "It's a SaaS replacement for the paper kit every airfield manager keeps in a binder."

---

## Phase 1 — The Stack, Layer by Layer

### What it is

Software is built in layers. Each layer hides complexity from the layer above it. Your app's layers, top to bottom:

```
USER (browser, phone)
    ↓
FRONT-END        → React + Next.js + TypeScript        (what the user sees)
    ↓
HOSTING          → Vercel                              (serves the front-end)
    ↓
API ROUTES       → Next.js route handlers              (server-side logic)
    ↓
BACKEND          → Supabase                            (DB + auth + storage)
    ↓
DATABASE         → PostgreSQL with RLS                 (where data lives)
```

### Reading list

- `package.json` — every library you depend on. Skim it once.
- `CLAUDE.md` — your own one-page technical overview. Read carefully.
- `app/layout.tsx` — the outermost shell of the app
- `app/(app)/layout.tsx` — the authenticated shell (sidebar, header, bottom nav)

### Concepts to learn

1. **Front-end vs back-end** — the front-end runs in the user's browser. The back-end runs on a server. Most "apps" are both, talking to each other.
2. **React** — a way to build user interfaces by composing reusable components (a button, a form, a page). Owned by Meta, the most popular UI library on earth.
3. **Next.js** — a framework built on top of React that handles routing, server-side rendering, and deployment. Owned by Vercel.
4. **TypeScript** — JavaScript with type safety. Catches bugs before they happen by checking that you're passing the right kind of data around.
5. **Tailwind CSS** — a way to style components without writing separate CSS files. You add classes like `bg-blue-500` directly on your HTML.

### Talking points

**"Why Next.js?"** → "It's the gold standard for React apps. We get server-side rendering for free, file-based routing so adding a page is just adding a file, and seamless deployment to Vercel."

**"Why TypeScript?"** → "It catches errors at write-time instead of runtime. When you've got 135 database migrations and 30 CRUD modules, type safety is what keeps the codebase from drifting into chaos."

**"Why a PWA instead of a native app?"** → "Three reasons: (1) one codebase serves iPhone, iPad, and desktop; (2) no app store gatekeeping for a tool that DoD personnel install on government devices; (3) instant updates — when we ship a fix, every user has it on next page load."

### Quiz yourself

- What's the difference between React and Next.js?
- Why is TypeScript an asset for an investor / acquirer to see?
- What does "serverless" mean in the context of Vercel?

### Ask Claude

> "Walk me through what happens between a user clicking a button and the database getting updated. Use a specific example from my codebase."

---

## Phase 2 — Supabase Deep Dive

This is the most important phase. Supabase is your back-end, your moat, and your single biggest technical risk all at once.

### What Supabase actually is

Supabase = "Firebase for Postgres." It bundles:

| Service | What it does | Replaces |
|---|---|---|
| Postgres | The relational database | MySQL, SQL Server |
| Auth | User signup/login, JWT tokens | Auth0, Cognito |
| Storage | File uploads (images, PDFs) | S3, Cloudinary |
| Realtime | Live updates over websockets | Pusher, Ably |
| Edge Functions | Serverless code | AWS Lambda |

You use the first four. You don't currently use Edge Functions — your "API routes" run on Vercel instead.

### Reading list

- `lib/supabase/client.ts` — how the browser connects to Supabase
- `middleware.ts` — the gate that runs on every page request to verify the user is logged in
- `lib/supabase/types.ts` — auto-generated from your database schema (DO NOT hand-edit)
- `supabase/migrations/` — every change to your database, in chronological order. **Skim the filenames** — each one tells a story.

### Concepts to learn

1. **Postgres** — the most respected open-source database. Industry-standard for the last 30 years.
2. **Migrations** — versioned SQL files that change the database schema. Each one applied exactly once, in order. Your app has 135.
3. **Row-Level Security (RLS)** — Postgres feature where the *database itself* enforces who can see/write each row. Even if your app code has a bug, the database refuses to leak data across bases.
4. **JWT (JSON Web Token)** — the cryptographic signature that proves "I am user X." Sent on every request after login.
5. **Service role key vs anon key** — your app uses two keys. The anon key is public and respects RLS. The service role key is private (server-only) and bypasses RLS. **If the service role key leaks, attackers get full database access.**

### Talking points

**"Why Supabase instead of building your own backend?"** → "It's open source — we can self-host the entire stack on government infrastructure when we move to Platform One. We're not locked in. And it gives us a real Postgres database, not a proprietary key-value store like Firebase."

**"How is data protected?"** → "Two layers. First, the user's session is verified on every page load by Next.js middleware. Second, every database query is filtered by Row-Level Security policies — the database itself refuses to return rows the user shouldn't see, even if the application code asks for them. We have ~140 RLS policies across 55 tables."

**"What about multi-tenancy?"** → "Every operational table has a `base_id` column. Every RLS policy checks that the user has membership at that base. A user at Selfridge AFB cannot read or write Edwards AFB data, full stop. The database enforces it."

### Quiz yourself

- What's the difference between authentication and authorization?
- If your `SUPABASE_SERVICE_ROLE_KEY` leaks, what's the blast radius?
- Why is `lib/supabase/types.ts` regenerated rather than hand-edited?

### Ask Claude

> "Pick one of my Supabase tables and walk me through every RLS policy on it, in plain English."

---

## Phase 3 — The Permission Matrix (your security spine)

### Why this phase deserves its own section

Most apps gate features with `if (user.role === 'admin')`. That doesn't scale, and it's exactly the pattern auditors flag in IL4/IL5 reviews. You replaced it with a **permission matrix** — a database-driven authorization model where every feature is a permission key, every role is a bag of keys, and individual users can have grants/revokes that override their role.

This is the same pattern AWS IAM, Azure RBAC, and Okta use.

### Reading list

- `lib/permissions.ts` — the client-side permission check
- `lib/permissions-server.ts` — the server-side equivalent
- `supabase/migrations/2026042200_permission_matrix_scaffold.sql` — the scaffold
- `supabase/migrations/2026042208_drop_legacy_auth_helpers.sql` — final cutover
- `tests/permission-matrix-roles.test.ts` — the contract tests
- `docs/` — search for `project_permission_matrix` if you saved that note

### Concepts

1. **Role** — what kind of user (sys_admin, airfield_manager, ces, safety, etc.)
2. **Permission key** — one specific capability (`discrepancies:write`, `daily_reviews:sign:amsl`)
3. **Grant** — role X has permission key Y
4. **Override** — user U is granted (or revoked) permission key Y, ignoring their role
5. **SECURITY DEFINER function** — a Postgres function that runs with the function-owner's privileges, used to safely check permissions inside RLS

### Talking points

**"How does authorization work?"** → "Every feature in the app is gated by a permission key — `discrepancies:write`, `parking:delete`, etc. There are 77 keys total, organized into 9 categories. Roles get bags of keys; individual users can have explicit overrides if needed. Auditors love it because there's a single SQL table that documents who can do what."

**"How would you add a new role tomorrow?"** → "Two steps. Insert a row into `role_permissions` for each capability, and the entire app automatically respects it. No code changes needed for the gate itself; only for new UI surfaces."

### Quiz yourself

- If a CES user reports being unable to update a discrepancy, what's the one SQL query that tells you whether they should be able to?
- What's the difference between `user_has_permission()` and `user_has_base_access()`?

---

## Phase 4 — Trace one feature end-to-end

Pick **inspections** as your case study. It's the most-used module and touches every layer.

### The trace

1. **User clicks "Begin Inspection"** on `/inspections`
2. UI page: `app/(app)/inspections/page.tsx`
3. CRUD module: `lib/supabase/inspections.ts`
4. Database insert into `inspections` table — RLS policy `inspections_insert` runs
5. Realtime broadcast: `INSERT` event fires on the `inspections` channel
6. Other browsers subscribed (e.g., dashboard) receive the event in `lib/dashboard-context.tsx`
7. User completes walkdown, taps "File"
8. Status update → `inspections.filed_at = now()`
9. PDF generator runs: `lib/inspection-pdf.ts`
10. `jsPDF.save()` triggers a browser download
11. Optional: email PDF via Resend → `app/api/send-pdf-email/route.ts`

### Why this matters

When someone asks "what does your app actually *do*?", you walk them through this trace. It hits realtime, RLS, PDF generation, email — every piece of your stack.

### Quiz yourself

- At which step in this trace does Row-Level Security get checked?
- If the user's network drops between step 7 and step 8, what happens? (Hint: look at the `localStorage` draft logic in `inspections/page.tsx`)
- Why is the PDF generated client-side instead of server-side?

---

## Phase 5 — The PDF System

Sixteen PDF generators, all client-side. This is more important than it sounds for two reasons:

1. **Compliance** — DoD data never leaves the user's browser to be rendered. No SaaS PDF service in the path.
2. **Speed** — no round-trip to a server, no queue, no rate limits.

### Reading list

- `lib/pdf-config.ts` — shared discrepancy-PDF helpers
- `lib/pdf-utils.ts` — newer shared helpers (header, stat box, footer)
- `lib/inspection-pdf.ts` — pick one and read it carefully
- `lib/email-pdf.ts` — how PDFs become email attachments

### Talking point

**"How do PDFs work?"** → "Every PDF is built in the browser using jsPDF — an open-source PDF generation library. The data never leaves the user's session. When they need to email it, the PDF is base64-encoded and posted to our `/api/send-pdf-email` route, which forwards it to Resend. We have 16 generators covering inspections, checks, ACSI, discrepancies, waivers, parking plans, and more."

---

## Phase 6 — Maps & Geospatial

Mostly Google Maps now. Mapbox kept only for the wildlife heatmap.

### Reading list

- One file is enough: `components/obstructions/airfield-map-google.tsx`
- `lib/calculations/geometry.ts` — your geodesic math (offsets, buffers)

### Concepts

- **Geodesic** — calculations on a sphere (the Earth). Different from flat-plane (Cartesian) math.
- **Bearing / heading** — direction in degrees, true north vs magnetic north
- **Imaginary surfaces** — UFC 3-260-01 defines invisible 3D shapes around runways that nothing can penetrate. Your obstruction module checks if anything does.

### Talking point

**"Why migrate from Mapbox to Google Maps?"** → "Government networks routinely block Mapbox tile URLs. Google Maps is on the standard DoD whitelist. The migration was 13 maps; we kept Mapbox only for the wildlife heatmap because Google's heatmap layer doesn't support our use case as well."

---

## Phase 7 — PWA, Mobile & Offline

### Reading list

- `public/manifest.json` — what the PWA looks like when installed
- `next.config.js` — the `next-pwa` configuration
- `app/layout.tsx` — the `appleWebApp` meta config
- The recent commit `Fix iOS PWA text-entry scroll jump and bottom-nav drift`

### Concepts

1. **Service Worker** — a script that runs in the browser between the network and your app, allowing offline support and background sync.
2. **Manifest** — a JSON file that tells the browser "I'm an installable app, here's my icon."
3. **Visual viewport vs layout viewport** — iOS distinction that breaks `position: fixed` when keyboards appear. (You just fixed this.)

### Talking point

**"Does it work offline?"** → "It's a Progressive Web App, so the basic shell loads from cache. Right now we're online-first for data — full offline-with-sync is on the roadmap for a later release."

---

## Phase 8 — Compliance & Government Posture

This is where commercialization lives or dies for federal customers.

### Reading list

- `CLAUDE.md` "Regulatory Context" section
- Search for `DAFMAN` in the codebase to see where compliance is implemented
- `supabase/migrations/2026032100_rls_tighten_write_policies.sql` (any tightening migrations)
- `docs/` for any waiver or capabilities artifacts you've kept

### Concepts

| Term | Plain English |
|---|---|
| FedRAMP | Federal commercial cloud accreditation. Vercel/Supabase are *not* FedRAMP today. This is the elephant in the room. |
| IL4 / IL5 | DoD impact levels. IL4 ≈ "controlled unclassified." IL5 = "stricter controlled unclassified" with stronger isolation. |
| Platform One | The Air Force's DevSecOps platform — a path to running your container images in DoD-accredited environments. |
| Party Bus | P1 program where DoD pays for the accreditation work in exchange for hosting on their stack. |
| cATO | Continuous Authority to Operate — accreditation that doesn't expire annually. P1's value proposition. |
| CUI | Controlled Unclassified Information. Your app processes CUI today; FedRAMP/IL4 is what makes that legal at scale. |
| DAFMAN 13-204 | Department of the Air Force Manual — airfield management. Vols 1, 2, and 3. You implement large pieces of it. |
| UFC 3-260-01 | Unified Facilities Criteria — runway and parking geometry rules. You implement Chapter 3 (obstructions) and the parking clearance envelopes. |
| AF Forms 483 / 505 / 3616 / 679 | Specific paper forms your app digitizes. AF Form 3616 (Events Log) requires a CAC signature unless waived — you have a T-3 waiver on file. |

### Talking points

**"Where are you on FedRAMP?"** → "Today we run on Vercel + Supabase commercial — fine for the beta with explicit user consent and a CUI registry analysis on file. The path to production at scale is Platform One Party Bus, which provides FedRAMP equivalent and IL4/IL5 accreditation. Our scaffold for that is at `glidepath-local-dev/` — about a 6–8 week migration to Vite + Express to run inside P1."

**"What's your biggest compliance risk?"** → "Two things. (1) The trademark — CDW holds 'GLIDEPATH' Class 42 (SaaS) registration; we'd need to clear that before commercial sale to government. (2) The FedRAMP gap — until we're on Party Bus, we can't sell to anyone whose data classification exceeds CUI Basic."

---

## Phase 9 — Tech Debt & Honest Trade-offs

When an investor asks "what's broken?", the wrong answer is "nothing." The right answer is to volunteer the top three items, explain why each is acceptable today, and say what triggers fixing each.

### Your real tech debt (from `SESSION_HANDOFF.md`)

1. **`base-setup/page.tsx` is 4,900 LOC; `parking/page.tsx` is 4,334; `infrastructure/page.tsx` is 4,150.** These are giant pages. They work, they're tested, and refactoring them costs roughly four weeks for no user-visible change. Worth doing if you raise; not worth doing pre-revenue.

2. **~117 `as any` TypeScript casts.** Each is a place where the type system is being told to trust the developer. Most are concentrated in PDF generators and map component props where the upstream library types are weak. Down from 182. Acceptable for now.

3. **Test coverage is thin** (~165 tests across 19 files). It's hardened around the security-critical paths (permission matrix, RLS smoke, kiosk auth). Coverage of pure logic is reasonable; UI integration tests are absent.

4. **Storage RLS isn't path-scoped** for the `photos` bucket — it relies on `photos:write` / `photos:delete` permissions globally, not "you can write to *this* base's photos." A hardened audit would tighten this.

5. **The diagram `<img>` preview can't render PDFs** (you just removed PDF support to side-step it). Real fix is an iframe or PDF.js renderer.

### Talking point

**"What's the riskiest thing in the codebase?"** → "The `'use client'` server-import trap. Next.js wraps client modules with reference stubs when imported from server contexts, and the failure mode is silent until production. We hit it once during the kiosk feature and audited the codebase; we're clean now, but that audit becomes a CI rule before our next major release."

---

## Phase 10 — The Investor / Customer FAQ

Memorize answers to these. They will be asked.

### "Who built this?"
> "I built it. I'm the airfield manager — the user. Every feature exists because I needed it during a real shift. We've been deployed in beta at one base for [X] months."

### "How long did it take?"
> "Active development started [date]; we're currently at v2.32, with about 60 production releases."

### "What's it cost to run?"
> "[Look up your Vercel + Supabase + Resend bills.] At our current beta scale, [$X] per month. Costs scale linearly with users — Supabase Pro covers the database; Vercel Pro covers the front-end; Resend handles transactional email at fractions of a cent each."

### "How do you make money?"
> "Per-base subscription, three tiers: Standard, Plus, and Government Enterprise (with on-premise / Platform One option). We're targeting [$X]/base/year for Standard, comparable to but priced under Aerosimple, Veoci, Civix, and Raxar in the same space."

### "What's defensible?"
> "Three things. (1) Domain expertise — I'm the user, and the workflows reflect 12 years of operational knowledge that competitors fake. (2) The compliance posture — DAFMAN-cited features that take a competitor 12+ months to replicate even if they have the source code. (3) The Platform One path. Once we're cATO'd, the switching cost for any DoD customer is enormous."

### "What scares you?"
> "(1) Trademark conflict on 'GLIDEPATH.' (2) A larger competitor — Aerosimple has the most overlap — copying the AFM-specific features. (3) FedRAMP — until we're on P1, the IL4 ceiling is real."

### "Why now?"
> "Air Force is actively retiring paper-based airfield management workflows. There's no incumbent in this niche — most bases use Excel + email. The timing window is roughly 24 months before a larger player notices."

---

## How to use this plan

**Session 1 (90 min):** Phase 0–2. Get the elevator pitch + stack overview locked.

**Session 2 (90 min):** Phase 3 — permission matrix. This is your security story.

**Session 3 (60 min):** Phase 4 — trace inspections end-to-end. Pick a different feature for a second pass if you have time.

**Session 4 (60 min):** Phase 5–7. PDFs, maps, PWA. Lighter lift.

**Session 5 (90 min):** Phase 8–9. Compliance and tech debt — the hardest conversations.

**Session 6 (60 min):** Phase 10. Drill the FAQ. Write your own answers in your own words.

**Don't read everything in one sitting.** Pace it. After each phase, sit with the talking points until they feel natural to *say* — not just read.

---

## When you get stuck

Paste this into your next Claude session:

> "I'm working through `docs/Glidepath_Codebase_Primer.md`, currently in Phase [N]. I don't understand [specific concept]. Can you explain it to me using examples from my codebase, and then quiz me on it?"

That gets you back on track without me having to re-read everything.
