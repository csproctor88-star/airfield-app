# CLAUDE.md

## Project Overview

Glidepath — Progressive Web App for USAF Airfield Management. Replaces paper logs, shared spreadsheets, and phone-based status with a single real-time platform. Deployed to commercial cloud (Vercel + Supabase). Platform One Party Bus migration planned for IL4/IL5.

## Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.3.9 |
| Language | TypeScript (strict) | 5.9.3 |
| UI | React | 19.2.7 |
| DB / Auth | Supabase + Postgres + RLS | @supabase/supabase-js 2.95.3 · @supabase/ssr 0.8.0 |
| Maps | Google Maps JS API (everywhere); Mapbox (wildlife heatmap only) | @googlemaps/js-api-loader 2.0.2 · mapbox-gl 3.18.1 |
| PDF | jsPDF + jspdf-autotable (client-side only) | 4.2.0 · 5.0.7 |
| Excel | ExcelJS | exceljs 4.4.0 |
| Email | Resend (branded transactional) | 6.9.3 |
| Styling | Tailwind CSS | 3.4.19 |
| PWA | @ducanh2912/next-pwa | 10.2.9 |
| Toasts · Icons | Sonner · lucide-react | 1.7.4 · 0.563.0 |

## Modules

| URL | Status | Key files |
|---|---|---|
| `/` | ✅ | `app/(app)/page.tsx` — Airfield Status (default landing) |
| `/dashboard` | ✅ | `app/(app)/dashboard/page.tsx` — KPI hub + AFM Out of Office toggle |
| `/checks` | ✅ | `app/(app)/checks/{page,[id],new}.tsx` — 7 check types |
| `/inspections` | ✅ | `app/(app)/inspections/{page,[id],new,construction/new,joint-monthly/new}.tsx` |
| `/acsi` | ✅ | `app/(app)/acsi/{page,[id],new}.tsx` — annual compliance |
| `/discrepancies` | ✅ | `app/(app)/discrepancies/{page,[id],new}.tsx` |
| `/ces` | ✅ | `app/(app)/ces/page.tsx` — CES Work Orders (CES role landing) |
| `/infrastructure` | ✅ | `app/(app)/infrastructure/page.tsx` — Visual NAVAIDs (~4k LOC) |
| `/parking` | ✅ | `app/(app)/parking/page.tsx` — multi-select, taxilane point editing |
| `/obstructions` | ✅ | `app/(app)/obstructions/{page,[id],history}.tsx` — UFC 3-260-01 |
| `/qrc` | ✅ | `app/(app)/qrc/page.tsx` — 25 QRCs, 8 step types |
| `/shift-checklist` | ✅ | `app/(app)/shift-checklist/page.tsx` — 3-state toggle, 0600L reset |
| `/wildlife` | ✅ | `app/(app)/wildlife/page.tsx` — 270+ species, BASH heatmap |
| `/waivers` | ✅ | `app/(app)/waivers/{page,[id],[id]/edit,new,annual-review/[year]}.tsx` |
| `/notams` | ✅ | `app/(app)/notams/{page,[id],new}.tsx` — live FAA feed |
| `/ppr` | ✅ | `app/(app)/ppr/page.tsx` — Prior Permission Required log + PDF; public form at `app/(public)/[icao]/ppr-request` (and legacy `/ppr-request/[baseId]`) |
| `/feedback` | ✅ | `app/(app)/feedback/page.tsx` (staff) · `app/feedback/[baseId]/page.tsx` (public QR form) |
| `/scn` | ✅ | `app/(app)/scn/page.tsx` — Secondary Crash Net record + agency log |
| `/daily-reviews` | ✅ | `app/(app)/daily-reviews/page.tsx` — DAFMAN 2.5.2.10.3/10.4 shift sign-off queue |
| `/contractors` | ✅ | `app/(app)/contractors/page.tsx` — Personnel on Airfield + AF Form 483 |
| `/reports` | ✅ | `app/(app)/reports/{page,daily,trends,aging,discrepancies,lighting}.tsx` |
| `/activity` | ✅ | `app/(app)/activity/page.tsx` — Events Log |
| `/help` | ✅ | `app/(app)/help/page.tsx` — Help & Training (in-app guidance for using the platform; the `/training` slug is held by the §139.303 Training module on civilian bases) |
| `/regulations` · `/aircraft` · `/library` | ✅ | reference data (70 regs, 200+ aircraft) |
| `/base-config/setup` | ✅ | `app/(app)/base-config/setup/page.tsx` — 15-step wizard (~6k LOC; `/settings/base-setup` is a redirect shim) |
| `/sms` · `/aep` | ✅ | `app/(app)/sms/page.tsx` (Safety Management System) · `app/(app)/aep/page.tsx` (Airport Emergency Plan) — civilian Part 139 |
| `/training` · `/amtr` | ✅ | `app/(app)/training/page.tsx` (§139.303 Training, civilian) · `app/(app)/amtr/page.tsx` (Airfield Management Training Record) |
| `/field-conditions` · `/recent-activity` | ✅ | `app/(app)/field-conditions/page.tsx` · `app/(app)/recent-activity/page.tsx` |
| `/users` · `/settings/users` | ✅ | `app/(app)/users/page.tsx` (top-level) · `app/(app)/settings/users/page.tsx` (settings nav entry) |
| `/more` | ✅ | `app/(app)/more/page.tsx` — mobile module menu |
| `/api/*` | ✅ | 32 route handlers: admin (invite, reset-password, users, kiosk-token), elevation, airport-lookup, notams/sync, send-pdf-email, signup-email, forgot-password, send-ppr-*, user-emails, infrastructure-import, installations, airfield-status, … |

Status: ✅ stable

## Project Structure

```
airfield-app/
├── app/
│   ├── (app)/              # Authenticated routes (sidebar/tabs)
│   ├── login/, reset-password/, setup-account/, auth/   # public auth routes (ungrouped, at app root — no (public) group)
│   ├── feedback/[baseId]/, [icao]/, ppr-request/, kiosk/[icao]/   # public QR / kiosk routes
│   └── api/                # 32 route handlers
├── components/             # acsi/ admin/ amtr/ base-setup/ discrepancies/ infrastructure/ layout/ obstructions/ tour/ ui/ waivers/ wildlife/
├── lib/
│   ├── supabase/           # ~50 entity CRUD modules + types.ts
│   ├── reports/            # analytics-data.ts + report builders
│   ├── calculations/       # geometry.ts, parking-clearance.ts, obstructions.ts
│   ├── *-pdf.ts            # 23 generators: acsi, aep, amtr, amtr-inspection, check, discrepancy, email, events-log, feedback, obstruction, parking, personnel, ppr, qrc, qrc-monthly-review, scn, sms, training, training-part139, waiver, …
│   └── installation-context.tsx, constants.ts, utils.ts, outage-rules.ts, rate-limit.ts, …
├── hooks/                  # use-google-map-ruler.ts, use-expiring-notams.ts, …
├── public/
│   ├── wildlife_images/    # bird/ mammal/ reptile/ bat/ — local photo cache
│   ├── training/, aircraft_silhouettes/, wildlife_image_manifest.json
├── supabase/migrations/    # 316 migrations, YYYYMMDDXX_<name>.sql
├── scripts/                # scrape_wildlife_images.py, scrape_aircraft_images.py (Python)
├── docs/                   # Capabilities, Leadership Briefing, manual/ (23 files), session handoffs
└── middleware.ts           # Supabase SSR auth gate
```

## Conventions

**Code style** — ESLint flat config (`eslint.config.mjs`) extends `next/core-web-vitals`. `no-explicit-any` and `no-unused-vars` set to warn (allow `^_` prefix). No Prettier — ESLint defaults govern. Strict TypeScript (`strict: true`, module `esnext`). Path alias `@/*` → repo root; always import via `@/lib/…`, never relative for cross-directory.

**Naming** — React component *names* are PascalCase (`EmailPdfModal`); their *files* are kebab-case (`email-pdf-modal.tsx`), like all other source files. Hooks use `use-` prefix, kebab-case (`use-google-map-ruler.ts`). Library files kebab-case (`installation-context.tsx`, `qrc-pdf.ts`). Database identifiers snake_case, plural tables (`airfield_checks`, `parking_spots`). (A handful of legacy component files — e.g. `components/base-setup/*`, `PDFLibrary.tsx` — remain PascalCase-named; new files should be kebab-case.)

**Database** — All operational tables include `base_id UUID REFERENCES bases(id)` and Row-Level Security. RLS is permission-matrix based (migrations `2026042200`–`2026042208`). The only helpers that exist now: `user_has_base_access(uid, base_id)`, `user_has_permission(uid, '<resource>:<action>')`, `user_is_sys_admin(uid)`. **Do not call `user_can_write` / `user_is_admin` / `user_is_base_admin_at` — they were dropped in `2026042208`.** New write policies: `user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), '<resource>:write')`. SECURITY DEFINER RPCs cover narrow / column-scoped writes (CES update, Safety, public PPR submit, public feedback submit). Migrations dated `YYYYMMDDXX_<name>.sql`. Don't write to `activity_log` from CRUD modules — discrepancies/checks/inspections write to their own status/event tables. PDF generators always return `{ doc, filename }`.

**Git** — All work commits directly to `main` (the old `tweaks` / `tweaking` branches were retired during the v2.30 cycle; only `main` exists locally and on origin). No CODEOWNERS, no PR template. Commit messages: imperative sentence header + optional body explaining why. Co-author trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` (older commits used 4.6 — keep the trailer current with the model in use). Never commit `.env.local`.

## Commands

| Command | Action |
|---|---|
| `npm run dev` | Next dev server (port 3000) |
| `npm run build` | Production build |
| `npm run start` | Serve built app |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type check (preferred quick check) |
| `python scripts/scrape_wildlife_images.py` | Refresh local wildlife photos (USFWS → Wikimedia → iNat) |

## Key Dependencies

- **Next.js 15.3.9** — App Router, route handlers, server components
- **Supabase 2.95.3** + SSR adapter — auth, DB, storage, realtime
- **jsPDF 4.2 + autotable 5** — all reports/PDFs generated client-side; never sent to third parties
- **Google Maps JS API 2.0.2** — every interactive map
- **Mapbox GL 3.18.1** — wildlife heatmap only (gov-network compatibility issues elsewhere)
- **Resend 6.9.3** — branded transactional email (invite, approval, password reset, PDF distribution); reply-to `info@glidepathops.com`
- **Tailwind 3.4** · **Sonner 1.7.4** · **lucide-react 0.563.0**
- **@ducanh2912/next-pwa 10.2.9** — service worker, installable

## Regulatory Context

| Reference | Implementation |
|---|---|
| DAFMAN 13-204 Vol 1–3 | Airfield Status, Events Log, Shift Checklist, Inspections, Checks, Discrepancies, NOTAMs, PPR |
| DAFMAN 13-204 Vol 2 Table A3.1 | Visual NAVAID Outage Engine (`lib/outage-rules.ts`) — 4-tier alerts, bar-out detection |
| DAFMAN 13-204 Vol 2 Para 5.4.3 | ACSI module — annual compliance inspection |
| DAFMAN 13-204 Vol 2 Para 2.5.2.10 | Web-based program suitable-substitute authorization. T-3 waiver on file for Para 2.5.2.10.3/10.4 (CAC signature on AF Form 3616). |
| UFC 3-260-01 Ch. 3 | Obstruction Evaluations (`lib/calculations/`) — geodesic imaginary-surface analysis |
| UFC 3-260-01 | Aircraft Parking Plans — wingtip / taxilane clearance envelopes |
| AFMAN 91-203 | QRC module — 25 emergency / contingency checklists |
| DAFMAN 91-212 | Wildlife / BASH module — sightings, strikes, heatmap |
| AF Form 505 | Waivers — 6 classifications, 7 statuses, full lifecycle |
| AF Form 483 | Contractors — escort credentials with expiry tracking |
| AF Form 3616 | Events Log (CAC-signature requirement waived via approved T-3) |

---

*Companion docs in `docs/manual/` (per-module user manual), `docs/Glidepath_Capabilities_v2.32.md` (capabilities reference), `docs/Glidepath_SRS_v6.0_Developer.docx` (engineering SRS).*
