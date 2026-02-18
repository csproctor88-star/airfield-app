# Changelog

All notable changes to the Airfield OPS Management Suite.

## [Unreleased]

### Planned
- Server-side email delivery for inspection reports (branded sender address)
- Real Supabase project integration and auth testing
- Offline PWA support with service worker caching
- NASA DIP API integration for FAA NOTAM sync
- METAR weather API integration (aviationweather.gov)
- Role-based access control (re-enable RLS policies)
- Unit and integration testing

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
