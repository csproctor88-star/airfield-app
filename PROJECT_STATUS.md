# Airfield OPS Management Suite — Project Status

> **Last updated:** 2026-02-21
> **Version:** 2.0.0
> **Branch:** `claude/build-aos-reg-database-R4Ytm`
> **Commits:** 268
> **Build:** Clean (`next build` zero errors)

---

## Overview

A mobile-first Next.js 14 web application for managing airfield operations at **Selfridge Air National Guard Base (KMTC)**, 127th Wing, Michigan ANG. The app covers discrepancy tracking, airfield checks, inspections, NOTAMs, obstruction evaluations, a regulatory reference library with offline PDF viewing, and a real-time operational dashboard — all with Supabase backend, Mapbox mapping, IndexedDB offline caching, and a dark-theme UI.

---

## Architecture

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14.2.35 |
| Language | TypeScript (strict) | 5.9.3 |
| Styling | Tailwind CSS (custom dark theme) | 3.4.19 |
| Backend | Supabase (Postgres, Auth, Storage) | SSR 0.8.0 |
| Maps | Mapbox GL JS | 3.18.1 |
| PDF Viewing | react-pdf (PDF.js) | — |
| PDF Export | jsPDF | 4.1.0 |
| Validation | Zod | 3.25.76 |
| Offline Cache | IndexedDB (6 stores) | — |
| PWA | @ducanh2912/next-pwa | 10.2.9 |
| Toasts | Sonner | 1.7.4 |
| Icons | Lucide React | 0.563.0 |

### Key Design Patterns

- **Demo Mode**: App runs fully offline with mock data when Supabase env vars are missing — useful for development and field testing
- **Mobile-First**: Max-width 480px layout, bottom navigation, touch-friendly controls (44px+ hit targets)
- **Display ID Generation**: Human-readable IDs like `D-2026-0041` via Postgres sequences
- **Client-Side PDF**: jsPDF generates inspection reports in the browser
- **Hybrid Offline**: IndexedDB caches regulation PDFs and extracted text for offline access; PWA service worker caches app shell

---

## What's Been Built

### Database (`supabase/`)

- **`schema.sql`** — Base schema with tables, sequences, `generate_display_id()` function
- **20 migrations** applied in order:
  1. `20260216_update_inspections_table.sql` — dual inspection types, BWC, conditional sections
  2. `20260217_add_daily_group_id.sql` — linked daily report pairs
  3. `20260217_add_inspection_fields.sql` — inspector name, weather, temperature
  4. `20260217_remove_rls_policies.sql` — stripped all RLS for MVP
  5. `20260218_add_last_seen_at.sql` — user presence tracking
  6. `20260218_add_personnel_and_special_types.sql` — personnel array, construction_meeting/joint_monthly types
  7. `20260218_create_navaid_statuses.sql` — NAVAID G/Y/R status per approach system
  8. `20260218_create_regulations.sql` — regulations table
  9. `20260218_create_regulations_with_seed.sql` — 70 seed regulation entries
  10. `20260218_add_regulation_storage_cols.sql` — storage_path, file_size_bytes, verification columns
  11. `20260219_pdf_text_search.sql` — pdf_text_pages, pdf_extraction_status, search_all_pdfs RPC
  12. `20260219_create_user_regulation_pdfs.sql` — user_regulation_pdfs table
  13. `20260219_regulation_pdfs_read_policy.sql` — storage bucket read policy
  14. `20260219_fix_ufc_pdf_urls.sql` — corrected UFC PDF URLs
  15. `20260219_fix_epublishing_urls.sql` — fixed e-Publishing URLs
  16. `20260219_fix_faa_and_milstd_urls.sql` — fixed FAA/MIL-STD URLs
  17. `20260219_remove_nfpa_ieee_dod.sql` — removed 8 irrelevant regulation entries
  18. `20260219_delete_49cfr171_and_sync_urls.sql` — cleaned up and synced URLs
  19. `20260219_clear_ecfr_icao_urls_set_storage.sql` — set storage-only flags
  20. `20260220_user_documents.sql` — user_documents and user_document_pages tables

### Types & Validation (`lib/`)

- **`supabase/types.ts`** — Full TypeScript types for all database tables, including `UserRole`, `Severity`, `CheckType`, `InspectionType`, `InspectionItem`, `NavaidStatus`, `RegulationPubType`
- **`validators.ts`** — Zod schemas for discrepancies, status updates, FOD/RCR/RSC/BASH/emergency checks, NOTAMs, inspection responses
- **`constants.ts`** — Installation config (KMTC), discrepancy types (11), check types (7), inspection sections (airfield: 9/42 items, lighting: 5/32 items), locations, status workflow, user roles (8), airfield areas (17), regulation categories (20), publication types (7), source sections (12)
- **`regulations-data.ts`** — 70 regulation entries organized by section (Core, I–V, VI-A/B/C, VII-A/B/C)
- **`idb.ts`** — Shared IndexedDB helpers: `idbSet`, `idbGet`, `idbGetAll`, `idbGetAllKeys`, `idbDelete`, `idbClear`
- **`pdfTextCache.ts`** — PDF text search cache with offline/server hybrid search
- **`userDocuments.ts`** — User document upload, delete, list, cache, text extraction, and sync service

### Supabase Client Libraries (`lib/supabase/`)

- **`client.ts`** / **`server.ts`** / **`middleware.ts`** — Browser and SSR Supabase clients with demo-mode detection
- **`discrepancies.ts`** — CRUD + KPI queries + photos + status updates
- **`checks.ts`** — CRUD + photo uploads + comments
- **`inspections.ts`** — CRUD for inspections (fetch, create, delete, daily groups)
- **`obstructions.ts`** — Obstruction evaluation CRUD + photos
- **`navaids.ts`** — NAVAID status read/update
- **`regulations.ts`** — Regulation CRUD: `fetchRegulations`, `fetchRegulation`, `searchRegulations`
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
| `/regulations` | Complete | Reference library (70 entries) + My Documents tab with search, filters, favorites, PDF viewer, offline cache, admin CRUD |
| `/library` | Complete | Admin-only PDF Library for bulk management (role-gated) |
| `/more` | Complete | Module directory — all links functional |
| `/aircraft` | Placeholder | Coming soon page |
| `/reports` | Placeholder | Coming soon page |
| `/settings` | Placeholder | Coming soon page |
| `/sync` | Placeholder | Coming soon page |
| `/users` | Placeholder | Coming soon page |
| `/waivers` | Placeholder | Coming soon page |

### Components (`components/`)

- **Layout**: `header.tsx` (sticky gradient header), `bottom-nav.tsx` (5-tab mobile nav: Home, Aircraft, Regulations, Obstruction Eval, More), `page-header.tsx`
- **Discrepancies**: `discrepancy-card.tsx`, `severity-badge.tsx`, `status-badge.tsx`, `location-map.tsx`, `modals.tsx` (4 modal types)
- **Obstructions**: `airfield-map.tsx` (Mapbox interactive with 6 imaginary surface overlays)
- **PDF**: `RegulationPDFViewer.tsx` (in-app viewer with zoom, touch, offline support), `PDFLibrary.jsx` (admin bulk management)
- **UI primitives**: `badge.tsx`, `button.tsx`, `card.tsx`, `input.tsx`, `loading-skeleton.tsx`

---

## Tech Debt & Cleanup — Pre-Branch Audit (2026-02-21)

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
| **Mapbox token validation** | `components/discrepancies/location-map.tsx`, `components/obstructions/airfield-map.tsx` | Same token check and placeholder string duplicated. |
| **Surface colors** | `components/obstructions/airfield-map.tsx`, `app/(app)/obstructions/[id]/page.tsx` | Imaginary surface color definitions duplicated between map component and detail page. |
| **Photo count sync** | `lib/supabase/discrepancies.ts`, `lib/supabase/checks.ts` | Manual `photo_count` increment on insert — can desync if the update step fails after the photo insert succeeds. |
| **sanitizeFileName()** | `app/(app)/regulations/page.tsx`, `lib/userDocuments.ts` | Two slightly different implementations of filename sanitization. Should be unified. |

### Data & Consistency Issues

| Item | Location | Issue |
|------|----------|-------|
| **Hardcoded inspector name** | `app/(app)/checks/page.tsx:32` | "MSgt Proctor" is hardcoded instead of reading from auth session. |
| **Base64 photo fallback** | `lib/supabase/checks.ts`, `lib/supabase/obstructions.ts` | When Storage bucket is unavailable, photos are stored as base64 data URLs in the database — not scalable. |
| **Missing PWA icons** | `public/manifest.json` | References `/icons/icon-192.png` and `/icons/icon-512.png` but the `public/icons/` directory does not exist. |
| **No ESLint config** | Root | No `.eslintrc.*` or `eslint.config.*` file. `next lint` cannot run. |
| **Unused server client** | `lib/supabase/server.ts` | Only imported by `/library/page.tsx`. Most data fetching is client-side. |
| **Unused middleware client** | `lib/supabase/middleware.ts` | Superseded by inline Supabase config in top-level `middleware.ts`. |

### Component Size

| File | Lines | Notes |
|------|-------|-------|
| `app/(app)/regulations/page.tsx` | ~1,647 | References tab + My Documents tab + Add Reference modal all in one file. Could be split into sub-components. |
| `app/(app)/inspections/page.tsx` | ~1,200 | Workspace + history + draft management all in one file. |
| `app/(app)/page.tsx` | ~746 | Dashboard with weather, advisory, status, NAVAIDs, activity feed, all inline. |
| `lib/regulations-data.ts` | ~1,165 | 70 regulation entries as static data. Functional but large. Exists as fallback for demo mode. |
| `components/discrepancies/modals.tsx` | ~400 | 4 modals in one file with business logic. |

### Security Notes (Before Production)

- **RLS is disabled** — all authenticated users have full CRUD on all tables. Must re-enable with role-based policies.
- **No CSRF protection** beyond Next.js defaults on the login form.
- **No input sanitization** on free-text fields (notes, descriptions) — XSS risk if content is rendered as HTML.
- **Password policy** allows 6-character minimum — may not meet DoD security requirements.
- **Supabase Storage buckets** — `regulation-pdfs` has a public read policy; `user-uploads` should have per-user RLS.

---

## Key Decisions Made

1. **Dual Inspection System** — Airfield and Lighting inspections are separate types with distinct section/item sets, sharing the same UI framework and database tables
2. **Three-State Toggle** — Inspection items cycle through Pass → Fail → N/A → (clear), rather than separate buttons
3. **7 Check Types** — FOD, RSC, RCR, IFE, Ground Emergency, Heavy Aircraft, BASH — all in a single unified page with type-specific fields
4. **Mobile-First Layout** — 480px max-width, bottom nav, designed for phone use in the field
5. **Demo Mode** — App works without Supabase for development and demos; triggered automatically when env vars are missing
6. **Selfridge ANGB Config** — All locations, taxiways, runway data, and CE shops are hardcoded for KMTC in `lib/constants.ts`
7. **Bottom Nav Structure** — Home, Aircraft, Regulations, Obstruction Eval, More — all other modules accessed via More menu
8. **NAVAID Status** — Persisted per-system G/Y/R status with notes in `navaid_statuses` table, not ephemeral UI state
9. **70-Entry Regulation Database** — Organized by DAFMAN 13-204 volume sections (Core, I–V, VI-A/B/C, VII-A/B/C) with 20 categories
10. **IndexedDB for Offline PDFs** — 6-store schema (blobs, meta, text_pages, text_meta, user_blobs, user_text) shared across regulation and user document features
11. **Client-Side Text Extraction** — PDF.js extracts text in the browser, uploads to Supabase in background for server-side search
12. **Admin-Gated Reference CRUD** — Only `sys_admin` role can add/delete regulation references; demo mode bypasses check

---

## Open Questions for Next Phase

1. **NOTAM persistence** — Should the draft form save to Supabase, or is NOTAM management deferred?
2. **`recharts` usage** — Remove the unused dependency, or is a reports/charts module planned for the next phase?
3. **Offline sync strategy** — IndexedDB currently caches PDFs and text. Should operational data (checks, inspections, discrepancies) also be cached for true offline mode?
4. **Auth method** — Email/password, magic link, SSO, or simple PIN for field inspectors?
5. **PDF format** — Is there a specific regulatory template for inspection reports?
6. **Server-side email** — Planned for inspection report delivery. Which provider (Resend, SendGrid, SES)? What sender domain?
7. **RLS re-enablement** — Which roles get which permissions? Detailed policy design needed before production.
8. **Multi-device sync** — User documents and favorites are partially device-local (localStorage). Should they sync across devices?
