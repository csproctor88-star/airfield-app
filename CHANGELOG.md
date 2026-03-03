# Changelog

All notable changes to Glidepath.

## [Unreleased]

### Planned
- METAR weather API integration (aviationweather.gov)
- NOTAM persistence (draft form does not save to DB)
- Unit and integration testing
- Sync & Data module (offline queue, export, import)
- Regenerate Supabase types (`supabase gen types typescript`) to eliminate ~197 `as any` casts
- Convert PDFLibrary.jsx to TypeScript (.tsx)
- Remove dead API routes (`/api/airfield-status`, `/api/weather`) or wire them up
- Remove unused component (`components/ui/airfield-diagram-viewer.tsx`)
- Remove unused lib file (`lib/supabase/regulations.ts`)
- Clean up duplicate aircraft images and stray files
- Fix aircraft data import (root JSON stale vs `public/` copies)

---

## [2.12.0] — 2026-03-02

### Send PDF via Email & Default Email Setting

Server-side email delivery for all PDF exports using Resend, plus a user-configurable default email that pre-fills the send modal. Also includes map standardization, standalone inspection forms, and login UX improvements.

#### Email PDF Feature (New — 3 files)

Send any PDF report directly via email from within the app. Adds a mail button alongside the existing Export PDF button on all 10 PDF-capable pages.

- **API route** (`app/api/send-pdf-email/route.ts`) — POST endpoint accepting base64-encoded PDF, recipient email, filename, and subject. Uses Resend SDK with branded sender (`Glidepath <info@glidepathops.com>`)
- **Email utility** (`lib/email-pdf.ts`) — Client-side helper that converts jsPDF doc to base64 and POSTs to the API route
- **Email modal** (`components/ui/email-pdf-modal.tsx`) — Dark-themed modal with email input, validation, Send/Cancel buttons, loading state

#### PDF Generator Refactoring (8 files modified)

All PDF generators refactored to return `{ doc, filename }` instead of calling `doc.save()`, enabling callers to choose between download and email:

- `lib/pdf-export.ts` — `generateInspectionPdf`, `generateCombinedInspectionPdf`, `generateSpecialInspectionPdf`
- `lib/check-pdf.ts` — `generateCheckPdf`
- `lib/acsi-pdf.ts` — `generateAcsiPdf`
- `lib/waiver-pdf.ts` — `generateWaiverPdf`
- `lib/reports/daily-ops-pdf.ts` — `generateDailyOpsPdf`
- `lib/reports/aging-discrepancies-pdf.ts` — `generateAgingDiscrepanciesPdf`
- `lib/reports/discrepancy-trends-pdf.ts` — `generateDiscrepancyTrendsPdf`
- `lib/reports/open-discrepancies-pdf.ts` — `generateOpenDiscrepanciesPdf`

#### Default PDF Email Setting (New — 1 migration)

- **Database migration** (`2026030201_default_pdf_email.sql`) — Adds `default_pdf_email` column to `profiles` table
- **Installation context** — Exposes `defaultPdfEmail` and `updateDefaultPdfEmail()` via `useInstallation()` hook
- **Settings page** — Editable "DEFAULT PDF EMAIL" field in Profile section with save button and helper text
- **Email modal** — Accepts `defaultEmail` prop, pre-fills when modal opens (still editable per-send)
- **All 10 pages** — Pass `defaultPdfEmail` to `<EmailPdfModal>` via `useInstallation()` destructuring

Pages with email functionality:
- `app/(app)/inspections/[id]/page.tsx`
- `app/(app)/checks/[id]/page.tsx`
- `app/(app)/acsi/[id]/page.tsx`
- `app/(app)/waivers/[id]/page.tsx`
- `app/(app)/reports/daily/page.tsx`
- `app/(app)/reports/aging/page.tsx`
- `app/(app)/reports/trends/page.tsx`
- `app/(app)/reports/discrepancies/page.tsx`
- `app/(app)/discrepancies/page.tsx`
- `app/(app)/notams/page.tsx`

#### Map Standardization

- All Mapbox maps standardized to 3:4 portrait aspect ratio with 70vh max height
- Removed expand/collapse buttons from all map components
- Obstruction evaluation map centered and narrowed to 60% width
- Increased default zoom levels across all map views

#### Standalone Inspection Forms

- **Pre/Post Construction** (`/inspections/construction/new`) — Standalone form with project details, contractor, location, and area-specific checklist
- **Joint Monthly** (`/inspections/joint-monthly/new`) — Standalone form with multi-agency personnel attendance tracking
- All Inspections hub start buttons wired to correct form routes

#### Sidebar & Navigation

- Reorganized sidebar nav ordering and updated inspection labels
- Removed unused tab navigation patterns
- Profile section in settings collapsed by default, email hidden from profile display

#### Login UX

- Updated email placeholder from `name@mail.mil` to `name@email.com`
- Added note on create account screen: "Please use a personal email on a non-government network"

#### Files Created (4)
- `app/api/send-pdf-email/route.ts`
- `lib/email-pdf.ts`
- `components/ui/email-pdf-modal.tsx`
- `supabase/migrations/2026030201_default_pdf_email.sql`

#### Files Modified (22)
- 8 PDF generators — return `{ doc, filename }` instead of `doc.save()`
- 10 pages — email button, modal, default email prop
- `lib/installation-context.tsx` — `defaultPdfEmail` state + `updateDefaultPdfEmail()`
- `lib/supabase/types.ts` — `default_pdf_email` field on profiles
- `app/(app)/settings/page.tsx` — Default email field in profile section
- `app/login/page.tsx` — Placeholder and signup note

#### Version Sync
- Updated version to 2.12.0 in package.json, login/page.tsx, settings/page.tsx

---

## [2.11.0] — 2026-03-02

### ACSI Module, All Inspections Hub & Check Form Improvements

New Airfield Compliance and Safety Inspection (ACSI) module implementing the DAFMAN 13-204v2, Para 5.4.3 annual compliance inspection. Also adds a unified All Inspections navigation hub and several quality-of-life improvements to the check form and inspection workflow.

#### ACSI Module (New — 14 files)

Complete annual compliance inspection system with 10 sections and ~100 checklist items.

- **Form page** (`/acsi/new`) — 10 collapsible sections, Y/N/N/A toggle per item, per-item discrepancy documentation for failures (comment, work order, project, estimated cost/completion), photo upload on failed items, inspection team editor (AFM/CE/Safety + additional members), risk management certification with 3 signature blocks, general notes
- **Detail page** (`/acsi/[id]`) — Read-only view of completed/draft ACSI with color-coded response badges, discrepancy details inline, team/certification display, edit button for authorized roles
- **List page** (`/acsi`) — KPI badges (Total/Completed/In Progress/Draft), status filter, search, card list with display ID and pass/fail/na counts
- **PDF export** (`lib/acsi-pdf.ts`) — Full inspection report with section headers, parent/sub-field visual hierarchy using `didParseCell`/`didDrawCell` hooks, inline discrepancy photos and map thumbnails, team roster, risk certification
- **Excel export** (`lib/acsi-excel.ts`) — Multi-sheet workbook: Cover, Checklist (with discrepancy details), Inspection Team, Risk Cert
- **Draft persistence** (`lib/acsi-draft.ts`) — localStorage auto-save with 1-second debounce, DB auto-save on new inspection mount for immediate photo upload support, resume from draft on page load
- **Sub-components** — `acsi-section.tsx` (collapsible with progress counter), `acsi-item.tsx` (toggle + discrepancy expansion), `acsi-discrepancy-panel.tsx` (fields + photo picker), `acsi-team-editor.tsx` (role-based team), `acsi-risk-cert.tsx` (3 signature blocks), `acsi-location-map.tsx` (Mapbox pin placement, square aspect ratio)
- **Edit capability** — Authorized roles (Airfield Manager, Base Admin, System Admin) can edit any ACSI regardless of status
- **Sidebar nav** — Added "ACSI" entry with ShieldCheck icon after "Daily Inspections"

#### Database Migration
- **`2026030200_create_acsi_inspections.sql`** — `acsi_inspections` table with JSONB items/team/signatures, fiscal year, status workflow, pass/fail/na counts. Added `acsi_inspection_id` + `acsi_item_id` FK columns to `photos` table. RLS policies using existing helper functions.

#### All Inspections Hub
- **New page** (`/inspections/all`) — Navigation hub accessible from More menu with styled cards for each inspection type (Daily Airfield, ACSI, Pre/Post Construction, Joint Monthly). Each card has a "Start" button linking to the form and a "History" button linking to the list view.
- **More menu** — Added "All Inspections" as first item with link to `/inspections/all`

#### Airfield Check Improvements
- **Auto-save remark on complete** — When "Complete Check" is clicked, any pending remark text is automatically saved before finalizing
- **Removed Notes section** from check detail page (`checks/[id]/page.tsx`) — Section was not populated from the check form and created confusion

#### PDF Sub-Field Hierarchy
- **Parent/sub-field visual hierarchy** in ACSI PDF — Parent items (e.g., "5.5.1 ALSF-1") render as bold header rows with light blue-gray background, sub-fields render deeply indented showing only "(A) Operable", "(B) Properly Sited", "(C) Clear of Vegetation" labels
- Sub-field item numbers removed from # column per user preference
- Section headers have increased breathing room, post-section gaps widened

#### Spacing & Styling Polish
- All ACSI sections spaced further apart (gap 10→16)
- Inspection Team and Risk Cert sections have increased margins (20→28)
- Item # column widened (minWidth 48→64), sub-field indentation increased (20→28)
- Team editor and risk cert labels bolded (fontWeight 600→700)
- Reviewer block spacing increased across team editor and risk cert

#### Files Created (14)
- `app/(app)/acsi/page.tsx` — ACSI list page
- `app/(app)/acsi/new/page.tsx` — ACSI form page
- `app/(app)/acsi/[id]/page.tsx` — ACSI detail page
- `app/(app)/inspections/all/page.tsx` — All Inspections navigation hub
- `components/acsi/acsi-section.tsx` — Collapsible section wrapper
- `components/acsi/acsi-item.tsx` — Checklist item with Y/N/N/A toggle
- `components/acsi/acsi-discrepancy-panel.tsx` — Failure documentation panel
- `components/acsi/acsi-team-editor.tsx` — Inspection team editor
- `components/acsi/acsi-risk-cert.tsx` — Risk management certification
- `components/acsi/acsi-location-map.tsx` — Mapbox location pin map
- `lib/acsi-pdf.ts` — PDF export with didParseCell/didDrawCell hooks
- `lib/acsi-excel.ts` — Excel export (multi-sheet)
- `lib/acsi-draft.ts` — Draft persistence (localStorage + DB)
- `lib/supabase/acsi-inspections.ts` — CRUD module
- `supabase/migrations/2026030200_create_acsi_inspections.sql` — Migration

#### Files Modified (10)
- `lib/supabase/types.ts` — AcsiItem, AcsiTeamMember, AcsiSignatureBlock, AcsiDraftData, AcsiStatus types
- `lib/constants.ts` — ACSI_CHECKLIST_SECTIONS (10 sections, ~100 items), ACSI_STATUS_CONFIG, ACSI_TEAM_ROLES
- `lib/demo-data.ts` — DEMO_ACSI_INSPECTIONS (2 samples)
- `components/layout/sidebar-nav.tsx` — ACSI nav entry
- `app/(app)/more/page.tsx` — All Inspections menu item
- `app/(app)/checks/page.tsx` — Auto-save remark on complete
- `app/(app)/checks/[id]/page.tsx` — Removed Notes section
- `package.json` — Version bump to 2.11.0
- `app/login/page.tsx` — Version string update
- `app/(app)/settings/page.tsx` — Version string update

#### Version Sync
- Updated version to 2.11.0 in package.json, login/page.tsx, settings/page.tsx

---

## [2.10.0] — 2026-03-01

### Row-Level Security & Project Cleanup

Database-level role-based access control across all operational tables, replacing the previous app-layer-only enforcement. Also includes a comprehensive project audit and file cleanup.

#### RLS Implementation (4 Phased Migrations)
- **Phase 1** (`2026030100`) — Fixed `user_has_base_access()` with sys_admin bypass. Added `user_can_write()` and `user_is_admin()` helper functions. Policies for config tables (`bases`, `base_runways`, `base_navaids`, `base_areas`), `profiles`, `regulations`, `user_regulation_pdfs`
- **Phase 2** (`2026030101`) — Role-aware policies for 6 core operational tables: `discrepancies`, `inspections`, `airfield_checks`, `obstruction_evaluations`, `notams`, `waivers`
- **Phase 3** (`2026030102`) — Policies for `photos`, `status_updates`, `navaid_statuses`, `airfield_status`, `runway_status_log`, `base_members`. Special cases: `check_comments` (all base members can INSERT), `activity_log` (all can INSERT, own+admin can UPDATE/DELETE)
- **Phase 4** (`2026030103`) — FK-based access for waiver child tables (`waiver_criteria`, `waiver_attachments`, `waiver_reviews`, `waiver_coordination`), inspection template chain (`base_inspection_templates` → `base_inspection_sections` → `base_inspection_items`). Fixed `update_airfield_status()` RPC with `p_base_id` parameter

#### Role Hierarchy Enforced
| Tier | Roles | SELECT | INSERT/UPDATE/DELETE |
|------|-------|--------|----------------------|
| Super Admin | `sys_admin` | All bases | All bases |
| Base Admin | `base_admin`, `airfield_manager`, `namo` | Own base | Own base |
| Power User | `amops` | Own base | Own base |
| Specialist | `ces`, `safety`, `atc` | Own base | Comments only |
| Viewer | `read_only` | Own base | No |

#### Automated Smoke Tests
- Created and ran 7-test automated suite verifying: write restriction (CES blocked), write permission (AMOPS allowed), cross-base isolation, sys_admin bypass, comment special case, admin-vs-writable distinction
- All 7 tests passed. Results and full 50+ test checklist saved in `docs/RLS_TEST_CHECKLIST.md`

#### Map Views (Merged Feature Branches)
- **Discrepancy map view** — Satellite map with severity-colored pins, hover popups, List/Map toggle, severity legend, expand/collapse. New component: `discrepancy-map-view.tsx`
- **Obstruction map view** — Map view for obstruction history page. New component: `obstruction-map-view.tsx`
- **Waiver map view** — Map view with emoji markers by classification, clickable type filter. New component: `waiver-map-view.tsx`
- **Waiver location picker** — Click-to-place GPS picker for waiver create/edit/detail. New component: `waivers/location-map.tsx`
- **Zoom tuning** — Widened default zoom across all maps (discrepancies, waivers, obstructions)

#### Project Cleanup
- Moved `SESSION-HANDOFF-v2.8.0.md` to `docs/`
- Moved `rename-regulations.mjs` from `app/` to `scripts/`
- Moved `scrape_aircraft_images.py` to `scripts/`
- Moved `migration_aircraft_characteristics.sql` to `scripts/`
- Moved `AOMS_Regulation_Database_v4.docx` to `docs/`
- Deleted duplicate files: `AOMS_Regulation_Database_v4 (1).docx`, `app/AOMS_Regulation_Database_v4.docx`, `public/commercial_aircraft (1).json`, `public/military_aircraft (1).json`, `public/001_pdf_text_search.sql`, root `001_pdf_text_search.sql`

#### Migrations Added
- `2026030100_rls_phase1_helpers_and_config.sql`
- `2026030101_rls_phase2_operational_tables.sql`
- `2026030102_rls_phase3_supporting_tables.sql`
- `2026030103_rls_phase4_children_and_templates.sql`

---

## [2.9.0] — 2026-02-28

### Activity Log Overhaul, Header Consolidation & Login UX

Major enhancements to the activity log with manual entry support and full CRUD, header consolidation replacing the InfoBar component, user presence tracking, and login quality-of-life improvements.

#### Activity Log
- **Manual text entries** — Free-text notes for events not captured by the system. Input bar with "Add" button above the activity table. Inserts with `action: 'noted'`, `entity_type: 'manual'`
- **Edit/delete entries** — Modal dialog with Date, Time (Zulu), and Notes fields. Delete button in modal with confirmation. RLS policies added for update/delete operations
- **Columnar table display** — Time (Z), User, Action, Details columns grouped by date header rows, replacing the previous card-based layout
- **Column search filters** — Per-column text filters in table headers for narrowing results
- **Editable Zulu time** — Time displayed and editable in UTC (HH:MM Z format)
- **Enriched entity details** — Action and details show full context in both UI and Excel export
- **Proper action labels** — `manual: 'Manual Entry'`, `noted: 'Logged'`, `airfield_status: 'Runway'` across activity log, dashboard, and login dialog

#### Header Consolidation
- **InfoBar merged into header** — Installation name+ICAO (left) and user name+status (right) now live in the header. `InfoBar` component removed from layout
- **Installation switcher** — Dropdown in header for users with access to multiple installations (ChevronDown icon, dark-themed menu)
- **User presence tracking** — Online/Away/Inactive status based on `last_seen_at` with 5-minute polling interval
- **Styling refinements** — Reduced installation text size (`fs-sm`), compact dropdown padding, removed role badge, theme-aware username color (`var(--color-text-1)`)

#### Login Improvements
- **Remember me** — Checkbox on login page saves email to localStorage for next session
- **Login notification dialog** — Restructured from dot+card format to columnar table (Time Z, User, Action, Details) with date group headers. Proper capitalization for all action/entity labels. Fetches `metadata` for Details column

#### User Management
- **User deletion cascade** — Nullifies all FK references (12 columns across 10 tables) before deleting profile and auth record, preserving historical data
- **ON DELETE SET NULL migration** — `2026022802_user_delete_set_null.sql` drops NOT NULL constraints and adds ON DELETE SET NULL to all profile FK columns
- **Installation dropdown for all admins** — Invite user modal now shows full installation list for base_admin/AFM/NAMO, not just sys_admin

#### Reports & Dashboard
- **KPI badges** — Responsive badge grid across all report pages (daily, aging, trends, open discrepancies) with centered alignment
- **Clickable discrepancies** — Aging report discrepancies link to detail pages
- **Dashboard formatAction** — Added missing labels for manual entries, runway status, and noted actions
- **Navaid status styling** — Reduced from bold white (`fs-xl/700`) to muted (`fs-base/500/color-text-2`)

#### Responsive Fixes
- Collapsible sidebar behavior on iPad
- KPI badge overflow prevention
- Aircraft card layout wrapping fix

#### Migrations Added
- `2026022801_activity_log_update_delete_policies.sql` — RLS policies for activity log edit/delete
- `2026022802_user_delete_set_null.sql` — ON DELETE SET NULL for all profile FK columns

---

## [2.8.0] — 2026-02-28

### Responsive Layout — iPad & Desktop Optimization

Major responsive overhaul enabling full iPad and desktop usage. Previously locked to a 480px mobile layout, the app now adapts across three breakpoints (mobile, 768px tablet, 1024px desktop) while preserving the existing mobile experience.

#### Shell Layout
- **Permanent sidebar navigation** — 300px side panel on tablet+ with full descriptive labels
- **Sidebar header** — Replaced logo with stylized tagline "Guiding You to Mission Success"
- **App shell flex layout** — `app-shell` becomes horizontal flex on tablet+ (sidebar + main content column)
- **Bottom nav hidden** on tablet+ (sidebar replaces it)
- **Content area max-width** — 768px tablet, 1000px desktop, 1200px large desktop

#### Responsive CSS Utility Classes
- `.page-container` — Responsive padding (16px → 24px → 32px 40px)
- `.kpi-grid-2` / `.kpi-grid-3` — 2/3-col mobile → 4-col desktop
- `.card-list` — Flex column mobile → 2-col grid tablet+
- `.actions-row` — Vertical mobile → horizontal tablet+
- `.form-row` — Stacked mobile → side-by-side tablet+
- `.filter-bar` — Scrollable mobile → flex-wrap tablet+
- `.photo-grid` — 64px → 80px → 96px thumbnails
- `.detail-grid-2` — 2-col → 3-col → 4-col
- `.checklist-grid` — 1-col → 2-col on tablet+

#### Font Size Scaling
- 11 CSS custom properties (`--fs-2xs` through `--fs-5xl`) with responsive overrides
- 1,123 inline `fontSize` values replaced across 58 files

#### Map Components
- Responsive height via CSS vars with expand/collapse toggle
- Smooth transitions with Mapbox `resize()` call

---

## [2.7.0] — 2026-02-27

### Bug Fixes, PWA Hardening & Code Quality

#### Bug Fixes
- **Discrepancy photos not displaying** — Fixed photo URL construction (missing bucket name), `base_id` passthrough, and fallback resolution
- **Checks detail page** — Same URL bug fixed
- **FOD Walk → FOD Check** — PDF export label corrected

#### PWA / Android
- Android system navigation bar white gap resolved
- Service worker config updated for manifest.json
- Dark mode logo enlarged

#### Project Cleanup
- Sorted runtime caching in `next.config.js`
- Removed unused `@types/react-dom`
- Added `eslint-config-next`

---

## [2.6.0] — 2026-02-26

### Waiver Module — Full Lifecycle Management

Complete airfield waiver system modeled after AF Form 505 and AFCEC Playbook Appendix B. Six classification types, seven status values with mandatory comment dialogs, detail pages with criteria/coordination/photos/annual reviews, PDF and Excel export, annual review mode. Seeded with 17 real Selfridge ANGB (KMTC) historical waivers.

---

## [2.5.0] — 2026-02-25

### User Management & Admin System

Admin-only module with three-tier role hierarchy, user cards with rank/role/status, detail modal, email invitation, password reset, account lifecycle management.

---

## [2.4.0] — 2026-02-24

### Aircraft Database & Reports

1,000+ military and civilian aircraft entries with search, sort, favorites, ACN/PCN comparison. Four report types with PDF export (Daily Ops, Open Discrepancies, Trends, Aging).

---

## [2.3.0] — 2026-02-23

### Obstruction Evaluations

UFC 3-260-01 Class B imaginary surface analysis with multi-runway support, 10 surfaces, interactive Mapbox overlays, geodesic calculations, photo documentation.

---

## [2.2.0] — 2026-02-22

### NOTAMs & Regulations

Live FAA NOTAM feed, ICAO search, filter chips, local NOTAM drafting. Regulatory reference library with 70+ entries, in-app PDF viewer, offline caching, My Documents tab.

---

## [2.1.0] — 2026-02-21

### Inspections & Checks

Daily inspection forms with configurable templates. 7 airfield check types. Photo capture, map location, draft persistence, PDF export.

---

## [2.0.0] — 2026-02-20

### Foundation

Next.js App Router with Supabase backend. Multi-base architecture, dashboard with weather/runway status/advisory, discrepancy tracking, light/dark/auto theme, PWA with offline caching, demo mode.
