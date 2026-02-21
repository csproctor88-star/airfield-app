# Changelog

All notable changes to the Airfield OPS Management Suite.

## [Unreleased]

### Planned
- Server-side email delivery for inspection reports (branded sender address)
- Real Supabase project integration and auth testing
- NASA DIP API integration for FAA NOTAM sync
- METAR weather API integration (aviationweather.gov)
- Role-based access control (re-enable RLS policies)
- NOTAM persistence (draft form does not save to DB)
- Unit and integration testing
- Reports module (charts, analytics, export)
- Waivers module (airfield waiver lifecycle)
- Aircraft Database module (tail numbers, fleet management)
- Users & Security module (profile management, roles)

---

## [2.0.0] — 2026-02-21

### Regulations Database & Reference Library — Complete

This release builds out the full References module, replacing the placeholder page with a comprehensive regulation database, in-app PDF viewer, user-uploaded personal documents, offline caching via IndexedDB, and admin CRUD for managing references.

#### Regulations / References (`/regulations`)
- **70-entry regulation database**: 3 Core + 27 Direct Refs + 27 Cross-Refs + 13 Scrubbed from Vols 1–3, sourced from AOMS Regulation Database v6
- **Searchable and filterable**: Full-text search across reg IDs, titles, descriptions, and tags; filter by category (20 categories) and publication type (DAF, FAA, UFC, CFR, DoD, ICAO)
- **Favorites system**: Star any reference, persist to localStorage, toggle "show favorites only" as default view
- **In-app PDF viewer**: `RegulationPDFViewer` component with react-pdf rendering, pinch-to-zoom touch gestures, scroll navigation
- **Offline PDF caching**: IndexedDB-backed blob storage; "Cache All" button to download all PDFs for offline access, "Clear Cache" to free storage
- **Dynamic data source**: Fetches regulations from Supabase `regulations` table when connected, falls back to static `ALL_REGULATIONS` array in demo mode
- **Admin controls**: sys_admin role can Add Reference (full form with PDF upload) and Delete Reference (with confirmation dialog, removes from DB + Storage + IDB cache)
- **Open External**: Public-URL regulations open directly; private-bucket PDFs use Supabase signed URLs (1-hour expiry)
- **Tab-based UI**: "References" and "My Documents" tabs with pill-style switcher

#### My Documents (`/regulations` → My Documents tab)
- **User-uploaded personal documents**: Upload PDF, JPG, and PNG files (50 MB max)
- **Client-side text extraction**: PDF.js extracts text page-by-page for full-text search
- **Per-document caching**: Cache/Uncache toggle for offline access via IndexedDB
- **Document management**: View, Cache, Delete actions per document
- **Status tracking**: uploaded → extracting → ready/failed pipeline with explanatory UI for failed extractions
- **Supabase Storage integration**: Files stored in `user-uploads` bucket under `{userId}/{fileName}` path

#### PDF Text Search System
- **Offline full-text search**: IndexedDB text cache with `searchOffline()` — scans all cached text pages client-side
- **Server-side search**: Postgres full-text search via `search_all_pdfs` RPC function with automatic offline fallback
- **Text sync**: `syncAllFromServer()` downloads pre-extracted text to IndexedDB on app startup
- **Background upload**: Client-extracted text auto-uploads to `pdf_text_pages` table for server-side indexing

#### PDF Library (`/library`)
- **Admin-only PDF Library page**: Role-gated page for bulk PDF management
- **PDFLibrary component**: Self-contained JSX component for managing regulation PDFs in Supabase Storage
- **Text extraction pipeline**: Extract text from all PDFs, with progress tracking and error handling

#### IndexedDB Architecture (`lib/idb.ts`)
- **Shared IndexedDB layer**: Version 4 schema with 6 object stores: `blobs`, `meta`, `text_pages`, `text_meta`, `user_blobs`, `user_text`
- **Generic CRUD helpers**: `idbSet`, `idbGet`, `idbGetAll`, `idbGetAllKeys`, `idbDelete`, `idbClear`
- **Singleton connection**: Single `openDB()` promise prevents multiple concurrent database connections

#### PWA & Offline
- **Service worker**: Full offline app access with PWA service worker caching
- **Runtime caching**: PDF.js worker cached for 90 days, Mapbox tiles and Supabase API handled with appropriate strategies

#### Database (13 new migrations)
- `20260218_create_regulations.sql` — `regulations` table with 70 seed entries
- `20260218_create_regulations_with_seed.sql` — Full seed data for all regulation entries
- `20260218_add_regulation_storage_cols.sql` — Added `storage_path`, `file_size_bytes`, `last_verified_at`, `verified_date` columns
- `20260219_pdf_text_search.sql` — `pdf_text_pages` and `pdf_extraction_status` tables with full-text search index and `search_all_pdfs` RPC function
- `20260219_create_user_regulation_pdfs.sql` — `user_regulation_pdfs` table for uploaded PDFs
- `20260219_regulation_pdfs_read_policy.sql` — Public read policy for `regulation-pdfs` storage bucket
- `20260219_fix_ufc_pdf_urls.sql` — Corrected UFC PDF download URLs
- `20260219_fix_epublishing_urls.sql` — Fixed e-Publishing.af.mil URLs
- `20260219_fix_faa_and_milstd_urls.sql` — Fixed FAA and MIL-STD URLs
- `20260219_remove_nfpa_ieee_dod.sql` — Removed 8 irrelevant entries (NFPA 780, NFPA 415, IEEE 142, etc.)
- `20260219_delete_49cfr171_and_sync_urls.sql` — Cleaned up 49 CFR 171 and synced URLs
- `20260219_clear_ecfr_icao_urls_set_storage.sql` — Cleared eCFR/ICAO URLs, set storage-only flag
- `20260220_user_documents.sql` — `user_documents` and `user_document_pages` tables for personal uploads

#### New Source Files
- `lib/regulations-data.ts` — 70 regulation entries as static TypeScript data (1,165 lines)
- `lib/supabase/regulations.ts` — Regulation CRUD: `fetchRegulations`, `fetchRegulation`, `searchRegulations`
- `lib/idb.ts` — Shared IndexedDB helpers for PDF cache
- `lib/pdfTextCache.ts` — PDF text search cache manager with offline/server hybrid
- `lib/userDocuments.ts` — User document service: upload, delete, list, cache, text extraction
- `components/RegulationPDFViewer.tsx` — In-app PDF viewer with zoom, touch gestures, offline support
- `components/PDFLibrary.jsx` — Admin PDF library management component

#### Constants Updates
- **20 regulation categories**: airfield_ops, airfield_mgmt, atc, airfield_design, safety, emergency, pavement, lighting, driving, bash_wildlife, construction, fueling, security, notams, uas, personnel, publications, international, contingency, financial
- **Publication types**: DAF, FAA, UFC, CFR, DoD, ICAO, NFPA (with display labels)
- **Source sections**: Core, I through V, VI-A/B/C, VII-A/B/C

---

## [1.0.0] — 2026-02-18

### Homepage Build — Complete

This release completes the homepage build phase. The dashboard is now a fully functional operational hub with live data, and all navigation paths are wired to real pages.

#### Dashboard (`/`)
- **Live weather**: Open-Meteo API integration with temperature, conditions, wind speed, visibility
- **Weather emoji mapping**: Dynamic icons based on conditions (thunderstorm, snow, rain, fog, clear, etc.)
- **Advisory system**: Clickable advisory dialog with INFO/CAUTION/WARNING levels, banner display, set/clear actions
- **Active Runway toggle**: RWY 01/19 button with Open/Suspended/Closed status dropdown, color-coded card backgrounds
- **Current Status panel**: RSC condition, BWC value, and Last Check Completed — all pulled from Supabase
- **NAVAID Status**: Side-by-side RWY 01 and RWY 19 panels with G/Y/R single-tap toggle buttons, auto-expanding note fields for yellow/red statuses, Supabase persistence
- **User presence**: Profile display with Online/Away/Inactive status based on `last_seen_at`, 5-minute heartbeat updates
- **Activity feed**: Real-time feed from `activity_log` table with profile joins, expandable to 20 entries
- **Quick Actions**: Begin/Continue Airfield Inspection, Begin Airfield Check, New Discrepancy — large touch targets linking to respective forms
- **Clock**: Live HH:MM display updated every second

#### Navigation
- **Bottom nav restructured**: Home, Aircraft, Regulations, Obstruction Eval, More — 5 tabs with active state highlighting
- **More menu reordered**: Airfield Inspection History, Airfield Check History, Obstruction Database, Waivers, Reports, NOTAMs, Sync & Data, Users & Security, Settings
- **All More links now functional**: Created coming soon placeholder pages for Aircraft, Regulations, Waivers, Reports, Settings, Users & Security, Sync & Data
- **No dead `#` links remain** in the More menu

#### Inspection History UX
- **Button text**: "Back to Draft" renamed to "View Current Inspection Form"
- **Search expanded**: Now covers inspection type, construction/joint labels, failed item count, personnel names, BWC value, inspector name, weather conditions, and display IDs
- **Collapsible sections**: Airfield/Lighting sections default to collapsed in combined reports

#### Database
- **`navaid_statuses` table**: New table for NAVAID G/Y/R status and notes per approach system
- **`last_seen_at` column**: Added to `profiles` for user presence tracking
- **Migrations**: `20260218_create_navaid_statuses.sql`, `20260218_add_last_seen_at.sql`

---

## [0.9.0] — 2026-02-18

### Inspection Module — Refinements

- **Airfield checklist updates**: Renamed Runway 05/23 to 01/19, removed Hot Pits and Parking Loops items
- **Lighting checklist updates**: Removed Traffic Lights and North or South Ramp items
- **Section 1 cleanup**: Updated checklist item names, removed Taxitrack reference
- **Construction Meeting / Joint Monthly**: Added standalone inspection forms with personnel attendance tracking and representative name text fields
- **Daily Inspection workspace**: Added View History button and Airfield Diagram placeholder button
- **Combined report UX**: Airfield/Lighting sections default to collapsed; Fail count is now clickable to toggle failed items list
- **Personnel tracking**: Added personnel checkbox array with representative name text fields for special inspection types
- **Database migration**: `20260218_add_personnel_and_special_types.sql` — added `personnel` TEXT[] column and expanded `inspection_type` constraint to include `construction_meeting` and `joint_monthly`

---

## [0.8.0] — 2026-02-17

### Daily Inspection Workspace & Combined Reports

- **Combined daily report**: Merged airfield + lighting inspections into a single Airfield Inspection Report with collapsible sections
- **Save/File workflow**: Draft persistence to localStorage with explicit Save Draft and File Report actions
- **Daily group linking**: Paired airfield + lighting inspections share a `daily_group_id` UUID
- **RLS removal**: Stripped all Row-Level Security policies and helper functions for MVP development simplicity
- **PDF export**: Combined report PDF generation with both halves in one document
- **Database migrations**: `20260217_add_daily_group_id.sql`, `20260217_add_inspection_fields.sql`, `20260217_remove_rls_policies.sql`

---

## [0.7.0] — 2026-02-16

### Inspection System — Core Build

- **Dual inspection types**: Separate Airfield (9 sections, 42 items) and Lighting (5 sections, 32 items) checklists
- **Three-state toggle**: Items cycle Pass → Fail → N/A → clear
- **Mark All Pass**: Per-section bulk action for routine inspections
- **BWC integration**: Bird Watch Condition selector (LOW/MOD/SEV/PROHIB) inline with Habitat Assessment
- **Review step**: Summary card with pass/fail/N/A counts before submission
- **CRUD operations**: `createInspection()`, `fetchInspections()`, `fetchInspection()`, `deleteInspection()` with Supabase persistence
- **History list**: Filterable by type (All/Airfield/Lighting) with search
- **Detail view**: Results grid, failed items highlight, section breakdown, notes display
- **PDF export**: Single-inspection and combined-report PDF generation via jsPDF
- **Demo data**: 3 sample inspections with realistic item-level responses
- **PROJECT_STATUS.md**: Added comprehensive project status document
- **Database migration**: `20260216_update_inspections_table.sql` — updated type constraints, added BWC and conditional section fields

---

## [0.6.0] — 2026-02-15

### Airfield Checks — Unified System

- **7 check types in one page**: FOD Walk, RSC Check, RCR Check, IFE, Ground Emergency, Heavy Aircraft, BASH — each with type-specific form fields
- **Emergency response**: 12-item AM action checklist with 9 agency notification buttons
- **BASH checks**: Condition code, species observed, mitigation actions, habitat attractants
- **RCR/RSC checks**: Mu value readings (rollout/midpoint/departure), contaminant type/depth/coverage, braking action assessment
- **Check history**: Filterable list of completed checks with search and type filtering
- **Check detail**: Full data display with follow-up remarks, photos, and location map
- **Photo capture**: Camera integration with preview for documenting check findings
- **Map location**: Mapbox pin for marking check locations
- **Issue Found toggle**: Gates map and photo sections — only shown when relevant
- **Navigation update**: Replaced NOTAMs with Checks in bottom nav; reordered Discrepancies and Checks positions
- **Area selection**: Updated to match Selfridge ANGB layout with "Entire Airfield" as first option
- **Schema update**: `schema.sql` updated for new airfield checks structure with RLS policies

---

## [0.5.0] — 2026-02-14

### Discrepancy Location Mapping

- **Interactive map selection**: Mapbox satellite map on New Discrepancy form for GPS coordinate capture
- **Static map display**: Mapbox Static Images API on detail page showing discrepancy pin location

---

## [0.4.0] — 2026-02-13

### Obstruction Evaluation Module

- **UFC 3-260-01 analysis**: Full Part 77 Class B imaginary surface calculations (primary, approach-departure, transitional, inner horizontal, conical, outer horizontal)
- **Interactive Mapbox map**: Click to place obstructions, color-coded surface zone overlays with legend
- **Runway geometry**: FAA 5010 true heading (002°), mutually exclusive surface zone evaluation
- **Photo support**: Multiple photos per evaluation with compression, hero + thumbnail gallery on detail view
- **Create/Edit/Delete**: Full CRUD with custom delete confirmation dialog (replaced native `confirm()`)
- **History list**: Searchable evaluation history with violation status indicators
- **Required actions**: Exact UFC 3-260-01 table references for violations (replaced generic guidance)
- **Coordinate system**: Geodesic calculations — Haversine distance, cross-track/along-track distances, runway-relative positioning
- **Elevation API**: Open-Elevation integration for MSL height lookup
- **Bottom nav update**: Replaced Checks with Obstruction Evaluation
- **Database**: `obstruction_evaluations` table with RLS policies for owner-based update/delete

---

## [0.3.0] — 2026-02-11

### Discrepancy Module — Full Feature Build

- **Status system overhaul**: Added Submitted to AFM, Submitted to CES, Awaiting Action by CES, Work Completed Awaiting Verification — separated Current Status from Work Order Status
- **Notes history**: Timestamped notes with user rank display, auto-refresh on changes
- **Photo management**: Supabase Storage upload with data URL fallback, photo viewer modal
- **Edit/Status/Work Order modals**: In-place editing with form validation
- **Multi-select type dropdown**: Discrepancy type selection with emoji indicators
- **Search and filtering**: Discrepancy list with status filters (Open/Completed/Cancelled), search across title/location/work order
- **Clickable counters**: KPI counters on list page filter results when tapped
- **NOTAM linking**: Free-text NOTAM reference field on discrepancies
- **Cancel functionality**: Cancel Discrepancy option in status update modal
- **RLS policy fixes**: Resolved infinite recursion with SECURITY DEFINER helpers; allowed authenticated users to insert status updates
- **Schema updates**: Added `submitted` to status CHECK constraint, nullable `new_status` for note-only entries, `current_status` dropdown field

---

## [0.2.0] — 2026-02-09

### MVP Foundation — Auth, Layout, Core Modules

- **Authentication**: Email/password login with sign-up flow, demo-mode bypass when Supabase unconfigured
- **Dashboard**: Live clock, weather strip, 4 KPI tiles, 6 quick-action buttons, today's status cards, recent activity feed
- **App shell**: Sticky gradient header with sync animation, 5-tab bottom navigation, 480px mobile-first layout
- **Discrepancies module (initial)**: List view with severity badges, detail view, creation form
- **Checks module (initial)**: Basic check types and history
- **Inspections module (initial)**: Placeholder inspection flow
- **NOTAMs module**: List with source/status filters, detail view, draft creation for LOCAL NOTAMs
- **Middleware**: Auth guard with Supabase SSR cookie handling, demo-mode detection
- **Demo mode**: Full offline operation with mock data (6 discrepancies, 4 NOTAMs, 7 checks, 3 inspections)

---

## [0.1.0] — 2026-02-08

### Project Setup

- **Next.js 14** with App Router and TypeScript strict mode
- **Tailwind CSS** custom dark theme (slate-900 background, sky/cyan accents)
- **Supabase** client/server/middleware configuration with demo-mode detection
- **Database schema**: 11 tables — profiles, discrepancies, airfield_checks, check_comments, inspections, notams, photos, status_updates, obstruction_evaluations, activity_log
- **Type system**: Full TypeScript types for all tables, Zod validation schemas
- **Constants**: Selfridge ANGB installation config (KMTC), 11 discrepancy types, 8 user roles, airfield areas
- **UI primitives**: Badge, Button, Card, Input, Loading Skeleton components
- **SRS.md**: Complete Software Requirements Specification (1,291 lines)
- **Prototype**: `Airfield_OPS_Unified_Prototype.jsx` — interactive React mockup for visual reference

---

## [0.0.1] — 2026-02-07

### Initial Commit

- Repository created
- Initial prototype upload
