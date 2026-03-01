# Changelog

All notable changes to Glidepath.

## [Unreleased]

### Planned
- Server-side email delivery for inspection reports (branded sender address)
- METAR weather API integration (aviationweather.gov)
- NOTAM persistence (draft form does not save to DB)
- Unit and integration testing
- Sync & Data module (offline queue, export, import)
- Regenerate Supabase types (`supabase gen types typescript`) to eliminate ~182 `as any` casts
- Convert PDFLibrary.jsx to TypeScript (.tsx)

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

#### Files Changed (25+)
- `app/(app)/activity/page.tsx` — Manual entry, edit modal, columnar display, column filters
- `app/(app)/page.tsx` — Dashboard formatAction, navaid styling, KPI badges
- `app/(app)/layout.tsx` — Removed InfoBar
- `app/login/page.tsx` — Remember me checkbox
- `components/layout/header.tsx` — Installation switcher, presence tracking, styling
- `components/login-activity-dialog.tsx` — Columnar table, proper labels, metadata
- `components/admin/invite-user-modal.tsx` — Installation dropdown for all admins
- `lib/supabase/activity.ts` — logManualEntry, updateActivityEntry, deleteActivityEntry
- `app/api/admin/users/[id]/route.ts` — FK nullification before user deletion
- `app/(app)/reports/aging/page.tsx` — KPI badges, clickable discrepancies
- `app/(app)/reports/daily/page.tsx` — KPI badges
- `app/(app)/reports/discrepancies/page.tsx` — KPI badges
- `app/(app)/reports/trends/page.tsx` — KPI badges
- Multiple other pages — responsive fixes, font adjustments

#### Version Sync
- Updated version to 2.9.0 in package.json, login/page.tsx, settings/page.tsx

---

## [2.8.0] — 2026-02-28

### Responsive Layout — iPad & Desktop Optimization

Major responsive overhaul enabling full iPad and desktop usage. Previously locked to a 480px mobile layout, the app now adapts across three breakpoints (mobile, 768px tablet, 1024px desktop) while preserving the existing mobile experience.

#### Shell Layout
- **Permanent sidebar navigation** — 300px side panel on tablet+ with full descriptive labels (e.g., "Obstruction Evaluation Tool", "Airfield Discrepancies", "Reference Library"). Hidden on mobile where bottom nav remains.
- **Sidebar nav reordered** — Dashboard, Activity Log, Daily Inspections, Airfield Checks, NOTAMs, Airfield Discrepancies, Obstruction Evaluation Tool, Reference Library, Aircraft Database, Airfield Waivers, Reports & Analytics, PDF Library, User Management, Settings
- **Sidebar header** — Replaced logo with stylized tagline "Guiding You to Mission Success"
- **App shell flex layout** — `app-shell` becomes horizontal flex on tablet+ (sidebar + main content column)
- **Bottom nav hidden** on tablet+ (sidebar replaces it)
- **Content area max-width** — 768px tablet, 1000px desktop, 1200px large desktop

#### InfoBar Component (New)
- **Extracted from header** — Installation ID (left) + user status/name (right) now rendered as a separate `InfoBar` component between the header and page content
- **Visible on all pages** — Appears above weather/advisory on dashboard and above content on all other pages

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
- `.badge-grid` — Auto-fill responsive grid
- `.spec-grid` — 2-col → 3-col → 4-col for aircraft specs
- `.navaid-grid` — 2-col mobile, 3-col tablet+

#### Font Size Scaling
- Introduced 11 CSS custom properties (`--fs-2xs` through `--fs-5xl`) with responsive overrides at each breakpoint
- Mechanically replaced 1,123 inline `fontSize: N` values across 58 files with `var(--fs-*)` references
- Scale: `--fs-base` goes 12px → 13px → 14px; `--fs-5xl` goes 24px → 28px → 34px

#### Element Scaling
- `.card` — padding 14→18→22px, border-radius 10→12→14px
- `.input-dark` — padding and font scaled per breakpoint
- `.btn-primary` — padding and font scaled per breakpoint
- `.action-button` — CSS class replaces inline styles, scales at breakpoints
- `.badge-pill` — CSS class replaces inline styles, scales at breakpoints
- `.section-label` — font 10→11→12px

#### Header Scaling
- CSS custom properties for header padding, logo height, icon size, row gap
- Weather component scaling (padding, gap, emoji size)
- Advisory component scaling (padding, dialog width/padding)

#### Dashboard Specific
- **RSC/BWC boxes** — centered with `flex: '0 1 200px'`
- **NAVAID grid** — CSS grid: 2-col mobile, 3-col tablet+ via `.navaid-grid`
- **Quick Actions** — `actions-row` class (stacks mobile, row tablet+) with `whiteSpace: 'nowrap'`
- **Active RWY card** — responsive via CSS custom properties (`--rwy-card-padding`, `--rwy-btn-font`, etc.)

#### Map Components
- **Location map** (checks/inspections) — responsive height via `--map-height` CSS var (420px → 70vh → 80vh) with expand/collapse toggle button
- **Obstruction map** — responsive height via `--obs-map-height` (600px → 80vh → 85vh) with expand/collapse toggle, replaces hardcoded 500px
- **Expanded maps** — 90vh → 90-92vh → 93-95vh for near full-screen viewing
- **Smooth transitions** — `height 0.3s ease` with Mapbox `resize()` call

#### Per-Page Responsive Updates (23 pages)
Applied `.page-container`, `.form-row`, `.card-list`, `.filter-bar`, `.photo-grid`, `.checklist-grid`, `.detail-grid-2`, `.badge-grid`, `.spec-grid` classes across all page components, replacing inline padding and grid styles.

#### Code Cleanup
- Removed debug `console.log` from user management page
- Removed orphaned `useTheme` import from sidebar-nav after logo removal

#### Files Changed
- `app/globals.css` — ~150 lines of responsive CSS added
- `app/(app)/layout.tsx` — Restructured for sidebar + InfoBar
- `components/layout/header.tsx` — Simplified to logo-only
- `components/layout/info-bar.tsx` — New component
- `components/layout/sidebar-nav.tsx` — New permanent sidebar with reordered nav
- `lib/sidebar-context.tsx` — New context provider
- `components/ui/button.tsx` — ActionButton CSS class
- `components/ui/badge.tsx` — Badge CSS class
- `components/discrepancies/location-map.tsx` — Responsive height + expand toggle
- `components/obstructions/airfield-map.tsx` — Responsive height + expand toggle
- 58 files — font-size variable replacement
- 23 page components — responsive class application

---

## [2.7.0] — 2026-02-27

### Bug Fixes, PWA Hardening & Code Quality

This release fixes critical bugs in photo uploads/display, resolves Android PWA rendering issues, improves mobile UX for dropdowns, and cleans up the project for branching.

#### Bug Fixes
- **Discrepancy photos not displaying** — Three bugs fixed:
  1. Photo URL construction was missing the `photos/` bucket name in the Supabase Storage public URL path (404 on every photo)
  2. `base_id` was never passed during photo upload, causing RLS policy `user_has_base_access()` to reject NULL and return empty results
  3. Added fallback in `uploadDiscrepancyPhoto()` that resolves `base_id` from the parent discrepancy when not explicitly provided
- **Same URL bug fixed in Checks detail page** — `checks/[id]/page.tsx` had identical missing bucket name issue
- **FOD Walk → FOD Check** — PDF export details section incorrectly said "FOD Walk completed" instead of "FOD Check completed"

#### PWA / Android
- **Android system navigation bar** — Investigated and resolved white bar at bottom of screen in installed PWA mode:
  - Removed problematic `body { padding-bottom: env(safe-area-inset-bottom) }` that created a gap below the fixed nav
  - Added `overscroll-behavior: none` on html/body to prevent white flash on overscroll
  - Bottom nav now spans full viewport width (`left: 0; right: 0`) with inner content centered at 480px
  - Added `::after` pseudo-element extending nav background 100px below viewport for gesture bar coverage
  - Service worker config updated to use `NetworkFirst` for `manifest.json`
- **Header border** — Removed header bottom border in dark mode for cleaner look
- **Dark mode logo** — Enlarged from 52px to 64px height

#### UI Improvements
- **Installation dropdown in User Management** — Replaced native `<select>` (which takes over the full screen on Android) with a custom scrollable dropdown matching the Settings > Installation pattern

#### Project Cleanup
- Sorted `next.config.js` runtime caching from most specific to least specific to prevent premature matches
- Removed unused `@types/react-dom` (Next.js includes its own)
- Added `eslint-config-next` to align with Next.js 14 + ESLint 9 flat config
- Addressed 4 minor ESLint warnings (unused vars, missing deps)

---

## [2.6.0] — 2026-02-26

### Waiver Module — Full Lifecycle Management

Complete airfield waiver system modeled after AF Form 505 and the AFCEC Playbook Appendix B.

#### Features
- Six classification types: permanent, temporary, construction, event, extension, amendment
- Seven status values with mandatory comment dialogs for status transitions
- Waiver detail pages with criteria & standards, coordination tracking, photo attachments, annual reviews
- Individual waiver PDF export with embedded photos and full metadata
- Excel export of the full waiver register with criteria and coordination sheets
- Annual review mode (`/waivers/annual-review`) with year-by-year forms, KPIs, and board tracking
- Seeded with 17 real Selfridge ANGB (KMTC) historical waivers

---

## [2.5.0] — 2026-02-25

### User Management & Admin System

#### Features
- Admin-only module for managing users across installations
- Three-tier role hierarchy: sys_admin > base_admin/AFM/NAMO > regular roles
- User cards with rank, role badge, status badge, base assignment, last seen
- User detail modal for editing profiles with field-level permission enforcement
- Email-based user invitation with branded setup email
- Password reset (admin-initiated and self-serve)
- Account lifecycle: deactivate/reactivate, delete (sys_admin only)

---

## [2.4.0] — 2026-02-24

### Aircraft Database & Reports

#### Features
- 1,000+ military and civilian aircraft reference entries
- Search, sort, and favorites system
- ACN/PCN comparison panel for pavement loading analysis
- Four report types with PDF export (Daily Ops, Open Discrepancies, Trends, Aging)

---

## [2.3.0] — 2026-02-23

### Obstruction Evaluations

#### Features
- UFC 3-260-01 Class B imaginary surface analysis
- 10 surfaces with interactive Mapbox overlays and per-surface toggles
- Multi-runway support with per-runway visibility filtering
- Geodesic calculations (Haversine, cross-track/along-track distance)
- Photo documentation per evaluation

---

## [2.2.0] — 2026-02-22

### NOTAMs & Regulations

#### Features
- Live FAA NOTAM feed via notams.aim.faa.gov (no API key required)
- ICAO search, filter chips, local NOTAM drafting
- Regulatory reference library with 70+ entries
- In-app PDF viewer with pinch-to-zoom
- Offline caching via IndexedDB with bulk download
- My Documents tab for personal uploads

---

## [2.1.0] — 2026-02-21

### Inspections & Checks

#### Features
- Daily inspection forms (Airfield + Lighting) with configurable templates
- 7 airfield check types in unified form
- Photo capture, map location, issue-found gating
- BWC integration, draft persistence
- PDF export for completed checks and inspections

---

## [2.0.0] — 2026-02-20

### Foundation

#### Features
- Next.js App Router with Supabase backend
- Multi-base architecture with per-installation data isolation
- Dashboard with weather, runway status, advisory system
- Discrepancy tracking with full lifecycle
- Light/dark/auto theme system
- PWA with offline IndexedDB caching
- Demo mode (runs without Supabase)
