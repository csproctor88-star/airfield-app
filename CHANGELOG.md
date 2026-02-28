# Changelog

All notable changes to the Airfield OPS Management Suite.

## [Unreleased]

### Planned
- Server-side email delivery for inspection reports (branded sender address)
- METAR weather API integration (aviationweather.gov)
- Role-based access control (re-enable RLS policies with role-based enforcement)
- NOTAM persistence (draft form does not save to DB)
- Unit and integration testing
- Sync & Data module (offline queue, export, import)
- Regenerate Supabase types (`supabase gen types typescript`) to eliminate ~134 `as any` casts
- Convert PDFLibrary.jsx to TypeScript (.tsx)
- Remove ~41MB unused `public/aircraft_images/` directory
- Consolidate dark mode logo variants (3 files, 4.6MB)
- Add database-level role enforcement for `read_only` and other non-admin roles (currently app-layer only)

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
