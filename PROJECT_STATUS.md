# Airfield OPS Management Suite — Project Status

> **Last updated:** 2026-02-18
> **Version:** 1.0.0
> **Branch:** `claude/build-homepage-BJJ6b`
> **Commits:** 154
> **Build:** Clean (`next build` zero errors, `tsc --noEmit` zero errors)

---

## Overview

A mobile-first Next.js 14 web application for managing airfield operations at **Selfridge Air National Guard Base (KMTC)**, 127th Wing, Michigan ANG. The app covers discrepancy tracking, airfield checks, inspections, NOTAMs, obstruction evaluations, and a real-time operational dashboard — all with Supabase backend, Mapbox mapping, and a dark-theme UI.

---

## Architecture

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14.2.35 |
| Language | TypeScript (strict) | 5.9.3 |
| Styling | Tailwind CSS (custom dark theme) | 3.4.19 |
| Backend | Supabase (Postgres, Auth, Storage) | SSR 0.8.0 |
| Maps | Mapbox GL JS | 3.18.1 |
| Validation | Zod | 3.25.76 |
| PDF | jsPDF | 4.1.0 |
| Toasts | Sonner | 1.7.4 |
| Icons | Lucide React | 0.563.0 |

### Key Design Patterns

- **Demo Mode**: App runs fully offline with mock data when Supabase env vars are missing — useful for development and field testing
- **Mobile-First**: Max-width 480px layout, bottom navigation, touch-friendly controls (44px+ hit targets)
- **Display ID Generation**: Human-readable IDs like `D-2026-0041` via Postgres sequences
- **Client-Side PDF**: jsPDF generates inspection reports in the browser

---

## What's Been Built

### Database (`supabase/`)

- **`schema.sql`** — 11 tables, 5 sequences, `generate_display_id()` function: `profiles`, `discrepancies`, `airfield_checks`, `check_comments`, `inspections`, `notams`, `photos`, `status_updates`, `obstruction_evaluations`, `activity_log`, `navaid_statuses`
- **7 migrations** applied in order:
  1. `20260216_update_inspections_table.sql` — dual inspection types, BWC, conditional sections
  2. `20260217_add_daily_group_id.sql` — linked daily report pairs
  3. `20260217_add_inspection_fields.sql` — inspector name, weather, temperature
  4. `20260217_remove_rls_policies.sql` — stripped all RLS for MVP
  5. `20260218_add_last_seen_at.sql` — user presence tracking
  6. `20260218_add_personnel_and_special_types.sql` — personnel array, construction_meeting/joint_monthly types
  7. `20260218_create_navaid_statuses.sql` — NAVAID G/Y/R status per approach system

### Types & Validation (`lib/`)

- **`supabase/types.ts`** — Full TypeScript types for all database tables, including `UserRole`, `Severity`, `CheckType`, `InspectionType`, `InspectionItem`, `NavaidStatus`
- **`validators.ts`** — Zod schemas for discrepancies, status updates, FOD/RCR/RSC/BASH/emergency checks, NOTAMs, inspection responses
- **`constants.ts`** — Installation config (KMTC), discrepancy types (11), check types (7), inspection sections (airfield: 9 sections / 42 items, lighting: 5 sections / 32 items), locations, status workflow, user roles (8), airfield areas (17)
- **`utils.ts`** — Class merging, relative time formatting, display ID generation
- **`demo-data.ts`** — 6 discrepancies, 4 NOTAMs, 7 checks, 3 inspections, 3 check comments
- **`weather.ts`** — Open-Meteo client-side weather fetch (Selfridge ANGB coordinates)
- **`inspection-draft.ts`** — localStorage draft persistence for daily inspections
- **`pdf-export.ts`** — jsPDF generation for single, combined, and special inspection reports
- **`calculations/`** — UFC 3-260-01 geometry engine and obstruction clearance analysis

### Supabase Client Libraries (`lib/supabase/`)

- **`client.ts`** / **`server.ts`** / **`middleware.ts`** — Browser and SSR Supabase clients with demo-mode detection
- **`discrepancies.ts`** — CRUD + KPI queries + photos + status updates
- **`checks.ts`** — CRUD + photo uploads + comments
- **`inspections.ts`** — CRUD for inspections (fetch, create, delete, daily groups)
- **`obstructions.ts`** — Obstruction evaluation CRUD + photos
- **`navaids.ts`** — NAVAID status read/update
- **`activity.ts`** — Activity log write

### App Routes (`app/`)

| Route | Status | Description |
|-------|--------|-------------|
| `/login` | Complete | Email/password auth with demo-mode bypass |
| `/` (Dashboard) | Complete | Live weather, advisory system, active RWY, current status, NAVAID panels, quick actions, activity feed |
| `/discrepancies` | Complete | Filterable list with severity badges, search, demo data fallback |
| `/discrepancies/new` | Complete | Create form with type, severity, location, description, Mapbox pin |
| `/discrepancies/[id]` | Complete | Detail view with status updates, photos, map, edit/status/work order modals |
| `/checks` | Complete | Unified check page with 7 types (FOD, RSC, RCR, IFE, Ground Emergency, Heavy Aircraft, BASH) |
| `/checks/history` | Complete | Completed checks list with filtering and search |
| `/checks/[id]` | Complete | Check detail with comments, photos, map |
| `/inspections` | Complete | Daily inspection workspace + history list with expanded search |
| `/inspections/[id]` | Complete | Detail view: results grid, failed items, section breakdown, PDF export |
| `/notams` | Complete | NOTAM list with status/source filters |
| `/notams/new` | Partial | Create form exists but does not persist to database |
| `/notams/[id]` | Complete | NOTAM detail |
| `/obstructions` | Complete | Obstruction evaluation form with Part 77 calculations and Mapbox map |
| `/obstructions/history` | Complete | Evaluation history list with search |
| `/obstructions/[id]` | Complete | Full analysis detail with photo gallery |
| `/more` | Complete | Module directory — all links functional |
| `/aircraft` | Placeholder | Coming soon page |
| `/regulations` | Placeholder | Coming soon page |
| `/reports` | Placeholder | Coming soon page |
| `/settings` | Placeholder | Coming soon page |
| `/sync` | Placeholder | Coming soon page |
| `/users` | Placeholder | Coming soon page |
| `/waivers` | Placeholder | Coming soon page |

### Components (`components/`)

- **Layout**: `header.tsx` (sticky gradient header), `bottom-nav.tsx` (5-tab mobile nav: Home, Aircraft, Regulations, Obstruction Eval, More), `page-header.tsx`
- **Discrepancies**: `discrepancy-card.tsx`, `severity-badge.tsx`, `status-badge.tsx`, `location-map.tsx`, `modals.tsx` (4 modal types)
- **Obstructions**: `airfield-map.tsx` (Mapbox interactive with 6 imaginary surface overlays)
- **UI primitives**: `badge.tsx`, `button.tsx`, `card.tsx`, `input.tsx`, `loading-skeleton.tsx`

---

## Tech Debt & Cleanup — Pre-Branch Audit (2026-02-18)

### Orphaned / Dead Code

| Item | Location | Issue |
|------|----------|-------|
| **`/inspections/new` route** | `app/(app)/inspections/new/page.tsx` | Redirects to `/inspections` — dead route, serves no purpose. Can be deleted. |
| **NOTAM draft form** | `app/(app)/notams/new/page.tsx` | Shows success toast but never persists to database. No `lib/supabase/notams.ts` CRUD module exists. |
| **NOTAM edit button** | `app/(app)/notams/[id]/page.tsx` | Edit button navigates to `/notams/new` instead of inline editing. No real edit flow. |
| **API stubs** | `app/api/notams/sync/route.ts`, `app/api/weather/route.ts` | Return hardcoded placeholder responses. Not wired to real services. |
| **Sync button** | `components/layout/header.tsx` | Animates for 1.5s but performs no real sync operation. |
| **Airfield Diagram button** | `app/(app)/inspections/page.tsx` | Shows "coming soon" toast — placeholder only. |
| **Severity/Status badge wrappers** | `components/discrepancies/severity-badge.tsx`, `status-badge.tsx` | Single-line re-exports of `components/ui/badge.tsx` — unnecessary indirection. |
| **Original prototype** | `Airfield_OPS_Unified_Prototype.jsx` | Reference artifact at repo root. Not imported anywhere. |
| **`recharts` dependency** | `package.json` | Installed (2.15.4) but not imported in any source file. |

### Type Safety Issues

| Item | Location | Issue |
|------|----------|-------|
| **50+ `eslint-disable` directives** | `lib/supabase/*.ts`, `app/(app)/inspections/*.tsx`, `app/(app)/checks/[id]/page.tsx` | All suppress `@typescript-eslint/no-explicit-any`. Supabase query returns need proper typing. |
| **Validator enum mismatch** | `lib/validators.ts` | `statusUpdateSchema` uses `'assigned'`, `'in_progress'`, `'resolved'` — but actual statuses are `'open'`, `'completed'`, `'cancelled'`, plus the current_status workflow values. |
| **KPI filter mismatch** | `lib/supabase/discrepancies.ts` | `fetchDiscrepancyKPIs()` filters by `status not in ('closed')` but `'closed'` is not a valid status value. |
| **Flexible JSON columns** | `lib/supabase/types.ts` | `airfield_checks.data` and `obstruction_evaluations.results` typed as `Record<string, unknown>` — no compile-time safety. |
| **Manual types** | `lib/supabase/types.ts` | Comment says "will be replaced by `supabase gen types`" — should be generated from actual schema. |

### Duplicated Logic

| Item | Locations | Issue |
|------|-----------|-------|
| **Supabase config detection** | `middleware.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts` | Same "is Supabase configured" check with placeholder string detection duplicated 4 times. Should be a shared utility. |
| **Mapbox token validation** | `components/discrepancies/location-map.tsx`, `components/obstructions/airfield-map.tsx` | Same token check and placeholder string (`"your-mapbox-token-here"`) duplicated. |
| **Surface colors** | `components/obstructions/airfield-map.tsx`, `app/(app)/obstructions/[id]/page.tsx` | Imaginary surface color definitions duplicated between map component and detail page. |
| **Photo count sync** | `lib/supabase/discrepancies.ts`, `lib/supabase/checks.ts` | Manual `photo_count` increment on insert — can desync if the update step fails after the photo insert succeeds. |

### Data & Consistency Issues

| Item | Location | Issue |
|------|----------|-------|
| **Hardcoded inspector name** | `app/(app)/checks/page.tsx:32` | "MSgt Proctor" is hardcoded instead of reading from auth session. |
| **Base64 photo fallback** | `lib/supabase/checks.ts`, `lib/supabase/obstructions.ts` | When Storage bucket is unavailable, photos are stored as base64 data URLs in the database — not scalable. |
| **Missing PWA icons** | `public/manifest.json` | References `/icons/icon-192.png` and `/icons/icon-512.png` but the `public/icons/` directory does not exist. |
| **No ESLint config** | Root | No `.eslintrc.*` or `eslint.config.*` file. `next lint` cannot run. |
| **Unused server client** | `lib/supabase/server.ts` | Not imported by any page route. All data fetching is client-side. |
| **Unused middleware client** | `lib/supabase/middleware.ts` | Superseded by inline Supabase config in top-level `middleware.ts`. |

### Component Size

| File | Lines | Notes |
|------|-------|-------|
| `app/(app)/inspections/page.tsx` | ~1,200 | Workspace + history + draft management all in one file. Could be split into sub-components. |
| `app/(app)/page.tsx` | ~746 | Dashboard with weather, advisory, status, NAVAIDs, activity feed, all inline. |
| `components/discrepancies/modals.tsx` | ~400 | 4 modals in one file with business logic (cancel-as-delete). Could extract individual modals. |
| `components/obstructions/airfield-map.tsx` | ~387 | GeoJSON polygon building + Mapbox setup + legend. Polygon generation could move to `lib/calculations/`. |

### Security Notes (Before Production)

- **RLS is disabled** — all authenticated users have full CRUD on all tables. Must re-enable with role-based policies.
- **No CSRF protection** beyond Next.js defaults on the login form.
- **No input sanitization** on free-text fields (notes, descriptions) — XSS risk if content is rendered as HTML.
- **Password policy** allows 6-character minimum — may not meet DoD security requirements.

---

## Key Decisions Made

1. **Dual Inspection System** — Airfield and Lighting inspections are separate types with distinct section/item sets, sharing the same UI framework and database tables
2. **Three-State Toggle** — Inspection items cycle through Pass → Fail → N/A → (clear), rather than separate buttons
3. **Conditional Sections** — Construction Meeting and Joint Monthly sections are opt-in toggles, not shown by default
4. **BWC Integration** — Bird Watch Condition (LOW/MOD/SEV/PROHIB) is captured inline within the Habitat Assessment section
5. **"Mark All Pass" Button** — Per-section bulk action to speed up routine inspections where most items pass
6. **7 Check Types** — FOD, RSC, RCR, IFE, Ground Emergency, Heavy Aircraft, BASH — all in a single unified page with type-specific fields
7. **Mobile-First Layout** — 480px max-width, bottom nav, designed for phone use in the field
8. **Demo Mode** — App works without Supabase for development and demos; triggered automatically when env vars are missing
9. **Selfridge ANGB Config** — All locations, taxiways, runway data, and CE shops are hardcoded for KMTC in `lib/constants.ts`
10. **Bottom Nav Structure** — Home, Aircraft, Regulations, Obstruction Eval, More — all other modules accessed via More menu
11. **NAVAID Status** — Persisted per-system G/Y/R status with notes in `navaid_statuses` table, not ephemeral UI state
12. **Advisory System** — Client-side only (not persisted) — INFO/CAUTION/WARNING with color-coded banners

---

## Open Questions for Next Phase

1. **Supabase project** — Is there a Supabase project already created, or do we need to set one up?
2. **Auth method** — Email/password, magic link, SSO, or simple PIN for field inspectors?
3. **Offline priority** — How critical is offline support? Affects architecture decisions if tackled early.
4. **PDF format** — Is there a specific regulatory template for inspection reports?
5. **Deployment target** — Vercel, or another platform?
6. **Server-side email** — Planned for inspection report delivery. Which provider (Resend, SendGrid, SES)? What sender domain?
7. **NOTAM persistence** — Should the draft form save to Supabase, or is NOTAM management deferred?
8. **`recharts` usage** — Remove the unused dependency, or is a reports/charts module planned for the next phase?
