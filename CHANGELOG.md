# Changelog

All notable changes to the Airfield OPS Management Suite.

## [Unreleased]

### Planned
- iPad and desktop responsive layout optimization (research complete, implementation pending)
- Server-side email delivery for inspection reports (branded sender address)
- METAR weather API integration (aviationweather.gov)
- Role-based access control (re-enable RLS policies with role-based enforcement)
- NOTAM persistence (draft form does not save to DB)
- Unit and integration testing
- Sync & Data module (offline queue, export, import)
- Regenerate Supabase types (`supabase gen types typescript`) to eliminate ~134 `as any` casts
- Clean up 7 dead files (validators.ts, installation.ts, lib/supabase/middleware.ts, card.tsx, input.tsx, loading-skeleton.tsx, page-header.tsx)
- Convert PDFLibrary.jsx to TypeScript (.tsx)
- Remove ~41MB unused `public/aircraft_images/` directory
- Consolidate dark mode logo variants (3 files, 4.6MB)
- Add database-level role enforcement for `read_only` and other non-admin roles (currently app-layer only)

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
  - Bottom nav now spans full viewport width (`left: 0; right: 0`) with inner content centered at 480px — eliminates gaps on edge-to-edge devices
  - Added `::after` pseudo-element extending nav background 100px below viewport for gesture bar coverage
  - Service worker config updated to use `NetworkFirst` for `manifest.json` so PWA color/theme updates take effect without reinstall
  - Manifest `display` tested as both `standalone` and `fullscreen`; settled on `standalone` with device dark theme as the practical fix
- **Header border** — Removed header bottom border in dark mode for cleaner look
- **Dark mode logo** — Enlarged from 52px to 64px height

#### UI Improvements
- **Installation dropdown in User Management** — Replaced native `<select>` (which takes over the full screen on Android) with a custom scrollable dropdown matching the Settings > Installation pattern: `maxHeight: 200px`, search filter, click-outside-to-close
- **More tab** — Removed user profile card section; page now goes straight to module list

#### Project Cleanup
- **Added `public/Downloads/` to `.gitignore`** — Prevents accidental commit of personal files
- **Reorganized docs** — Removed outdated session handoff files and old docs; added Glidepath AFWERX Spark Proposal and SRS v3.0

#### Files Modified
- `app/globals.css` — Removed body padding-bottom, added overscroll-behavior, added .bottom-nav::after
- `app/layout.tsx` — Theme-color meta tag adjustments (tested media queries, reverted to single dark value)
- `app/(app)/more/page.tsx` — Removed ProfileSection component and useInstallation import
- `app/(app)/discrepancies/[id]/page.tsx` — Fixed photo URL (added `photos/` bucket), added useInstallation for base_id
- `app/(app)/discrepancies/new/page.tsx` — Pass installationId to uploadDiscrepancyPhoto
- `app/(app)/checks/[id]/page.tsx` — Fixed photo URL (added `photos/` bucket)
- `components/layout/bottom-nav.tsx` — Full-width nav wrapper with centered inner content
- `components/layout/header.tsx` — Removed dark mode border, enlarged dark mode logo
- `components/admin/user-detail-modal.tsx` — Custom installation dropdown with search
- `lib/supabase/discrepancies.ts` — base_id fallback lookup in uploadDiscrepancyPhoto
- `lib/check-pdf.ts` — FOD Walk → FOD Check
- `next.config.js` — NetworkFirst caching for manifest.json
- `public/manifest.json` — Tested fullscreen/standalone display modes
- `.gitignore` — Added public/Downloads/

---

## [2.6.0] — 2026-02-27

### Branding, PDF Improvements, UX Polish & Production Prep

This release adds custom branding throughout the app, embeds photos and satellite maps in all PDF exports, adds clickable activity items, and includes numerous UX improvements in preparation for production deployment.

#### Branding & UI
- **Header**: Centered `glidepath2.png` logo (72px) replacing emoji + text
- **Login page**: `glidepath2.png` with "GUIDING YOU TO MISSION SUCCESS" motto
- **PWA home screen icon**: Custom circular badge icon (`icon.png`) for iOS/Android
- **More page**: Profile section always expanded at top, all modules shown as flat list (no accordion), removed About card
- **Settings About**: Version, environment, and website info (removed redundant logo)
- **Installation name + ICAO**: Moved from header to dashboard clock/user section with dropdown switcher for multi-base users

#### PDF Export — Embedded Photos & Maps
- **Discrepancy Report PDF**: Photos and Mapbox satellite map thumbnails embedded inline in table "Photos" column per discrepancy
- **Inspection PDF**: Location maps embedded for failed items with GPS coordinates
- **Daily Ops Report PDF**: Check location maps embedded alongside check photos
- **Mapbox Static Images API**: Satellite map thumbnails (300x200px) fetched as data URLs for all PDF exports
- **Photo URL fix**: Corrected query to use `discrepancy_id` FK column (not `entity_id`/`entity_type`)

#### Activity Log
- **Clickable items**: Activity entries on dashboard and `/activity` page link to their source entity (discrepancy, check, inspection, obstruction)
- **Visual indicators**: Linked items show cyan text with arrow indicator

#### Airfield Diagram — Cross-Device Storage
- **Supabase Storage**: Airfield diagrams now stored in Supabase Storage (`photos` bucket) instead of browser-local IndexedDB
- **Cross-device sync**: Diagrams uploaded on one device are now visible on all devices for the same installation
- **Demo mode fallback**: IndexedDB still used when Supabase is not configured (demo mode)
- **Storage RLS policies**: Added INSERT/SELECT/UPDATE/DELETE policies on `storage.objects` for authenticated users accessing the `photos` bucket

#### UX Improvements
- **Discrepancy type labels**: Fixed display for multi-type discrepancies (split on comma, resolve each individually)
- **Type dropdown**: Click-outside-to-close on new discrepancy form
- **Check History**: Removed duplicate button from top of checks page (kept bottom link)
- **Middleware**: Excluded `.png`/`.jpg`/`.svg` from auth checks so login page images load correctly
- **Logo transparency**: Removed baked-in gray background from `logo_motto.png` using Pillow

#### Renamed
- **Discrepancy Register → Discrepancy Report**: Updated PDF title and filename

#### Files Added
- `public/glidepath2.png` — Stylized "GLIDEPATH" text logo for header and login
- `public/icon.png` — Circular badge icon
- `public/glidepath.png` — Full logo (currently unused, candidate for cleanup)
- `public/logo_motto.png` — Badge + motto logo (currently unused, candidate for cleanup)

#### Files Modified
- `components/layout/header.tsx` — Simplified to centered logo only
- `app/(app)/page.tsx` — Added installation name/ICAO + switcher dropdown to clock section
- `app/(app)/more/page.tsx` — Profile expanded, flat module list, removed About card
- `app/(app)/activity/page.tsx` — Clickable activity items with entity linking
- `app/(app)/discrepancies/page.tsx` — PDF photos via `discrepancy_id`, multi-type label fix, renamed to "Report"
- `app/(app)/discrepancies/new/page.tsx` — Click-outside-to-close on type dropdown
- `app/(app)/checks/page.tsx` — Removed duplicate Check History button
- `app/(app)/inspections/page.tsx` — Location data passed to `halfDraftToItems` for map embedding
- `app/(app)/inspections/[id]/page.tsx` — Photo lat/lon merged into items for PDF export
- `app/(app)/settings/page.tsx` — Removed logo from About, kept version/env/website
- `app/login/page.tsx` — glidepath2 logo + motto text
- `lib/inspection-draft.ts` — `halfDraftToItems` accepts optional `itemLocations` parameter
- `lib/reports/daily-ops-data.ts` — Map image fetching for checks with coordinates
- `lib/supabase/activity-queries.ts` — Added `entity_id` to type and query
- `middleware.ts` — Excluded image files from auth middleware
- `lib/airfield-diagram.ts` — Refactored from IndexedDB to Supabase Storage with IDB fallback
- `supabase/migrations/2026022702_photos_storage_policies.sql` — RLS policies for photos bucket

---

## [2.5.0] — 2026-02-26

### User Management Module, Auth Flows & Role System

This release replaces the "Users & Security" placeholder with a full User Management module. Includes admin user list with role/status badges, invite flow with account setup, password reset with email delivery, forgot password on login, and a three-tier role permission system (sys_admin > base_admin/AFM/NAMO > regular users).

#### User Management Page (`/users`)
- **Installation selector**: System admins see dropdown of all bases + "All Installations" view; base admins locked to their base
- **Searchable user list**: Filter by name, email, or rank with real-time search
- **Role and status filters**: Dropdown filters for all 9 roles and 3 statuses (active, deactivated, pending)
- **User cards**: Display rank, name, email, role badge, status badge, base assignment, and last seen timestamp
- **User count**: Shows filtered vs total user count
- **Role badges**: Color-coded — red for sys_admin, cyan for base_admin/AFM/NAMO, slate for regular roles
- **Status badges**: Green (active), red (deactivated), amber (pending) — theme-aware for both light and dark modes

#### User Detail Modal
- **Slide-up modal**: Edit rank, first name, last name, role, and installation assignment
- **Field-level permissions**: Base admins cannot change role or installation (fields hidden)
- **Action buttons**: Reset Password, Deactivate/Reactivate, Delete (sys_admin only)
- **Delete confirmation**: Type-to-confirm dialog requiring the user's last name

#### Invite User Flow
- **Invite modal**: Email, rank, first/last name, role, and installation fields
- **Role restriction**: Base admins can only invite non-admin roles; sys_admins can assign any role
- **Base restriction**: Base admins can only invite to their own installation
- **Supabase auth**: Uses `inviteUserByEmail` with profile and base_members records created server-side
- **Account setup page** (`/setup-account`): Invited users land on a branded "Welcome — Set Up Your Account" page to create their password; profile status updated from `pending` to `active` on completion

#### Password Reset Flow
- **Admin-initiated**: "Reset Password" button in user detail modal sends recovery email via `resetPasswordForEmail`
- **Self-service**: "Forgot Password?" link on login page lets users request their own reset email
- **Auth confirm route** (`/auth/confirm`): Server-side route handles both PKCE code exchange and direct OTP token verification
- **Reset password page** (`/reset-password`): Branded page with password + confirm fields, listens for `PASSWORD_RECOVERY` and `SIGNED_IN` auth events

#### Role System
- **Three-tier hierarchy**: `sys_admin` (full access) > `base_admin`/`airfield_manager`/`namo` (base-scoped admin) > all other roles
- **Permission flags**: `canCreate` and `canManageUsers` per role in `USER_ROLES` constant
- **Admin API routes**: `/api/admin/invite`, `/api/admin/reset-password`, `/api/admin/users/[id]` (PATCH/DELETE)
- **Escalation prevention**: Only sys_admin can assign admin-tier roles
- **`observer` → `read_only` mapping**: Database `observer` role mapped to `read_only` in app for consistency

#### Login Page Enhancements
- **Forgot Password link**: Right-aligned below password field on sign-in form
- **Deactivation check**: Blocked users see "Your account has been deactivated" after sign-in attempt
- **Last seen tracking**: `last_seen_at` updated on every successful login

#### Middleware Updates
- **New public routes**: `/reset-password`, `/setup-account`, and `/auth/confirm` allowed through without authentication

#### Theme-Aware Badge CSS
- **6 badge classes**: `badge-status-active`, `badge-status-deactivated`, `badge-status-pending`, `badge-role-sysadmin`, `badge-role-baseadmin`, `badge-role-user`
- **Dark theme**: RGBA backgrounds with bright text inside `@layer components`
- **Light theme**: Solid pastel backgrounds with dark text as overrides outside the layer block

#### Database (1 new migration)
- `2026022600_user_management.sql` — Adds `status` column to profiles, indexes on `primary_base_id`/`role`/`status`, `user_is_base_admin_at()` function, RLS policies for admin profile management (insert/update/delete)

#### New Source Files
- `lib/admin/role-checks.ts` — Admin client factory, `isSysAdmin`, `isBaseAdmin`, `isAdmin`, permission guards
- `lib/admin/user-management.ts` — Client-side API wrappers (invite, reset password, update profile, delete)
- `components/admin/role-badge.tsx` — Color-coded role badge component
- `components/admin/status-badge.tsx` — Color-coded status badge component
- `components/admin/installation-selector.tsx` — Base dropdown for sys_admin / static display for base_admin
- `components/admin/user-filters.tsx` — Search input + role/status filter dropdowns
- `components/admin/user-card.tsx` — User card with badges and last seen timestamp
- `components/admin/user-list.tsx` — Scrollable card list with skeleton loading and empty states
- `components/admin/user-detail-modal.tsx` — Slide-up modal for editing profiles + admin actions
- `components/admin/invite-user-modal.tsx` — Modal form for inviting new users
- `components/admin/delete-confirmation-dialog.tsx` — Type-to-confirm destructive delete dialog
- `app/api/admin/invite/route.ts` — POST route for user invitation
- `app/api/admin/reset-password/route.ts` — POST route for password reset email
- `app/api/admin/users/[id]/route.ts` — PATCH (update profile) and DELETE (remove user) routes
- `app/auth/confirm/route.ts` — Server-side OTP verification and PKCE code exchange
- `app/reset-password/page.tsx` — Password reset form page
- `app/setup-account/page.tsx` — Invited user account setup page

#### Files Modified
- `lib/supabase/types.ts` — Added `base_admin` to UserRole, `ProfileStatus` type, `status` field, fixed Update type derivation
- `lib/constants.ts` — Added `base_admin` role config, `RANK_OPTIONS` array
- `app/(app)/users/page.tsx` — Complete rewrite from placeholder to full User Management page
- `app/(app)/more/page.tsx` — Renamed "Users & Security" to "User Management", changed from sysAdminOnly to adminOnly
- `app/login/page.tsx` — Added forgot password, deactivation check, last_seen_at update
- `app/globals.css` — Added badge CSS classes with light/dark theme support
- `middleware.ts` — Added /reset-password, /setup-account, /auth/confirm to public routes

---

## [2.4.0] — 2026-02-25

### Waiver Enhancements — Status Workflows, Photos, PDF Export & Annual Review Merge

This release enhances the waivers module with a full status change workflow (mandatory comments for all transitions), photo capture/upload on new waivers, individual waiver PDF export, and a consolidated annual review page.

#### Status Change Workflow
- **"Closed" replaces "Completed"**: All status labels, filter chips, and transitions updated
- **Mandatory comment dialog**: All transitions between Active, Expired, and Closed require a comment explaining the change
- **Generic status change modal**: Configurable `STATUS_CHANGE_CONFIG` adapts title, description, and button per target status
- **Comments saved as coordination activity**: Tagged `[Closure]`, `[Expired]`, or `[Reactivated]` in the coordination history
- **Expanded transitions**: Closed waivers can be reactivated or marked expired; expired waivers can be reactivated or closed
- **Action buttons per status**: Active (Close, Expire), Closed (Reactivate, Mark Expired), Expired (Reactivate, Mark Closed)

#### Photo Capture & Attachments on New Waiver Form
- **Take Photo**: Camera capture via `<input capture="environment">` for field use
- **Upload Photo**: Standard file picker for existing images
- **3-column thumbnail grid**: Preview with individual remove buttons
- **Attachments section**: Add Attachment modal with file type dropdown (photo, site map, risk assessment, UFC excerpt, FAA report, coordination sheet, AF Form 505, other) and caption
- **Sequential upload**: Photos and attachments queued locally, uploaded after waiver creation via `uploadWaiverAttachment`
- **Dropdown click-outside fix**: Classification and location dropdowns close on click-away (applied to both new and edit pages)

#### Waiver PDF Export
- **NEW `lib/waiver-pdf.ts`**: Comprehensive PDF generation with jsPDF + jspdf-autotable
- **Blue header bar**: Waiver number, status badge, installation name/ICAO
- **Two-column field layout**: Classification, hazard rating, dates, proponent, project info
- **Wrapped text fields**: Description, justification, corrective action, risk assessment
- **Criteria table**: Source, reference, and description columns
- **Coordination table**: Office, coordinator, date, status, and comments
- **Review history table**: Year, date, recommendation, mitigation, board, notes
- **Embedded photos**: 2-column grid with medium-size images fetched as base64 from signed URLs
- **Attachment list**: File names, types, and sizes in a table (no file content embedded)
- **Page numbers and generation date** in footer
- **"Export PDF" button** at top of every waiver detail page

#### Annual Review Consolidation
- **Merged annual review pages**: `annual-review/page.tsx` now redirects to current year
- **"Annual Review" link** on main waivers page goes directly to the year page
- **Clickable KPI badges** on annual review page to filter waivers by review status

#### Coordination & Review Management
- **Edit coordination entries**: Edit button opens pre-populated coordination modal
- **Delete coordination entries**: Remove button with confirmation
- **Delete reviews**: "Remove" button on each review in Review History section
- **New CRUD functions**: `updateWaiverCoordination`, `deleteWaiverCoordination`, `deleteWaiverReview`

#### Other Improvements
- **Auto-populate coordinator**: Coordinator name and date pre-filled in coordination modal
- **Fullscreen photo viewer**: Tap photo carousel to view fullscreen, tap anywhere to close
- **Photo carousel**: Swipeable carousel at top of waiver detail page for photo attachments
- **Duplicate review prevention**: Friendly message when attempting to add a duplicate annual review

#### Files Modified
- `lib/waiver-pdf.ts` — NEW: PDF export generation
- `lib/supabase/waivers.ts` — Added updateWaiverCoordination, deleteWaiverCoordination, deleteWaiverReview
- `lib/constants.ts` — "Closed" label, expanded WAIVER_TRANSITIONS
- `app/(app)/waivers/[id]/page.tsx` — Major: status change modal, PDF export, review/coord edit/delete, photo carousel
- `app/(app)/waivers/new/page.tsx` — Photos, attachments, dropdown click-outside
- `app/(app)/waivers/[id]/edit/page.tsx` — Dropdown click-outside fix
- `app/(app)/waivers/annual-review/page.tsx` — Converted to year redirect
- `app/(app)/waivers/annual-review/[year]/page.tsx` — Clickable KPIs, consolidated features
- `app/(app)/waivers/page.tsx` — "Closed" filter label, direct year link

---

## [2.3.0] — 2026-02-24

### Waivers Module — Full Lifecycle Management

This release adds the complete Airfield Waivers module modeled after AF Form 505, the AFCEC Playbook Appendix B, and real Selfridge ANGB (KMTC) waiver data. Includes a rebuilt database schema, full CRUD, annual reviews, coordination tracking, Excel export, and 17 seed waivers from KMTC historical records.

#### Database Rebuild
- **Dropped and rebuilt waivers schema**: 5 new tables replacing the original single-table MVP
- **`waivers`** — waiver_number, classification (permanent/temporary/construction/event/extension/amendment), status (7 values), hazard_rating, action_requested, full AF-505 field set
- **`waiver_criteria`** — UFC references per waiver (source, reference, description)
- **`waiver_attachments`** — File metadata with typed categories (photo, site_map, risk_assessment, etc.)
- **`waiver_reviews`** — Annual review records with recommendation, mitigation verification, board presentation
- **`waiver_coordination`** — Office-by-office coordination tracking (civil engineer, airfield manager, ops/TERPS, safety, commander)
- **`bases.installation_code`** — Added for auto-generating waiver numbers (P-CODE-YY-##)

#### Waivers List (`/waivers`)
- **KPIs**: Permanent count, Temporary count, Expiring ≤12 months (amber), Overdue Review (red)
- **Clickable KPI badges**: Filter the list by clicking any KPI card
- **Filters**: All / Draft / Pending / Approved / Active / Closed / Expired / Cancelled
- **Search**: Waiver number, description, criteria impact, proponent
- **Cards**: Waiver number (monospace), status badge, classification badge, description, expiration date
- **Header actions**: "+ New Waiver", "Annual Review", "Export Excel"

#### New Waiver Form (`/waivers/new`)
- **5 collapsible sections**: Basic Info, Criteria & Standards, Risk Assessment, Project Information, Location & Dates
- **Dynamic criteria rows**: Add/remove UFC reference rows with source dropdown, reference text, description
- **Auto-generated waiver number**: P-CODE-YY-## format with manual override
- **Save as Draft or Submit for Review**: Two submit paths

#### Waiver Detail (`/waivers/[id]`)
- **Header**: Waiver number, status/classification/hazard badges, description
- **6 collapsible sections**: Overview, Criteria & Standards, Coordination, Attachments, Review History, Notes
- **Overview**: 2-column grid of all AF-505 fields
- **Coordination**: Office list with status indicators, "Update Coordination" modal
- **Attachments**: Photo thumbnails with upload, file list with type labels
- **Review History**: Timeline of annual reviews with "Add Review" modal
- **Status actions**: Submit, Approve (modal with dates), Send Back, Cancel, Activate, Mark Closed, Mark Expired, Edit, Delete Draft

#### Edit Waiver (`/waivers/[id]/edit`)
- **Same layout as new form**, pre-populated from database
- **Criteria sync**: Deletes and re-inserts criteria batch on save

#### Annual Review (`/waivers/annual-review`)
- **Year selector** with prev/next navigation
- **KPIs**: Total Active, Reviewed This Year, Not Reviewed, Presented to Board
- **Expandable review form** per waiver: recommendation, mitigation verified, project status update, notes, board presentation
- **Export Year Review**: Excel export of annual review data

#### Excel Export
- **NEW `lib/waiver-export.ts`**: Client-side SheetJS (xlsx) export
- **Waiver Register sheet**: All waivers with key columns matching Appendix B format
- **Criteria & Standards sheet**: All criteria references across all waivers
- **Coordination Status sheet**: All coordination entries
- **Annual Review export**: Single-year review data

#### Seed Data
- **17 KMTC historical waivers**: Real Selfridge ANGB waiver data (VGLZ format numbers)
- **Criteria references**: UFC 3-260-01 and 3-260-04 references per waiver
- **2025 review records**: All reviewed 2/20/2025, recommendation: retain
- **Storage bucket**: `waiver-attachments` with 50MB file size limit and RLS policies

#### Database (7 new migrations)
- `2026022503_rebuild_waivers.sql` — 5-table waiver schema
- `2026022504_seed_kmuo_mountain_home.sql` — Mountain Home AFB seed
- `2026022505_seed_threshold_elevations.sql` — Runway threshold elevations
- `2026022506_fix_vglz220125001_status.sql` — Fix specific waiver status
- `2026022507_create_waiver_attachments_bucket.sql` — Storage bucket
- `2026022508_seed_kmtc_waivers.sql` — 17 KMTC waiver seed records
- `2026022509_waiver_attachments_storage_policies.sql` — Storage RLS policies

#### New Source Files
- `lib/supabase/waivers.ts` — Complete rewrite: ~17 exported functions
- `lib/waiver-export.ts` — Excel export with SheetJS
- `lib/constants.ts` — WAIVER_CLASSIFICATIONS, WAIVER_STATUS_CONFIG, WAIVER_TRANSITIONS, hazard ratings, criteria sources, coordination offices, review recommendations
- `app/(app)/waivers/page.tsx` — Rewritten list page
- `app/(app)/waivers/new/page.tsx` — Rewritten creation form
- `app/(app)/waivers/[id]/page.tsx` — Rewritten detail page
- `app/(app)/waivers/[id]/edit/page.tsx` — New edit page
- `app/(app)/waivers/annual-review/page.tsx` — Year selector
- `app/(app)/waivers/annual-review/[year]/page.tsx` — Per-year review checklist

---

## [2.2.0] — 2026-02-24

### Live FAA NOTAM Feed, Settings Overhaul & Access Control

This release replaces the stub NOTAM API with a live connection to the FAA's public NOTAM Search, overhauls the Settings page with collapsible sections, and restricts installation switching to system administrators.

#### Live FAA NOTAM Feed (`/notams`)
- **Real-time FAA data**: API route proxies `notams.aim.faa.gov/notamSearch/search` — no API key required
- **Auto-fetch by ICAO**: Page loads NOTAMs for the current installation's ICAO code on mount
- **ICAO search**: Text input to query any airport (e.g., KJFK, KSEM, KMUO)
- **Feed status indicator**: Green (connected), red (error), gray (idle) dot with ICAO label
- **Refresh button**: Manual re-fetch with "Last fetched" timestamp
- **Loading spinner**: Shown while fetching from FAA
- **Error handling**: Displays FAA errors (rate limit, network failure) in a red banner
- **Full NOTAM text on cards**: Each card shows the complete NOTAM text in monospace format
- **FAA date parsing**: Handles `MM/DD/YYYY HHMM` format and `PERM` end dates
- **Demo mode fallback**: Falls back to `DEMO_NOTAMS` when Supabase is not configured
- **Filter chips preserved**: All/FAA/LOCAL/Active/Expired still work on live data

#### Settings Page Overhaul (`/settings`)
- **Collapsible sections**: All sections are now dropdowns with chevron indicators
- **Default state**: Profile and About open on load; all others collapsed
- **Section reorder**: Profile → Installation → Data & Storage → Regulations Library → Base Configuration → Appearance → About

#### Access Control
- **Installation switching restricted**: Only `sys_admin` users can change installations in Settings
- **Non-admin view**: All other roles see their current installation as read-only

#### More Menu
- **NOTAMs entry added**: `📡 NOTAMs` appears between Reports and PDF Library

#### Files Modified
- `app/api/notams/sync/route.ts` — Complete rewrite: FAA NOTAM Search proxy with normalization
- `app/(app)/notams/page.tsx` — Complete rewrite: live feed with ICAO search and full-text cards
- `app/(app)/settings/page.tsx` — Collapsible sections, reorder, sys_admin gate
- `app/(app)/more/page.tsx` — NOTAMs menu item added and repositioned
- `.env.local` — `FAA_NOTAM_API_KEY` placeholder added (not required for current endpoint)

---

## [2.1.0] — 2026-02-24

### Multi-Base Scaling, Reports, Theme System & Aircraft Database

This release transforms the app from a single-base tool (Selfridge ANGB) into a multi-tenant platform supporting any number of installations. It also adds a full reporting suite, light/dark theme system, a 1,000+ aircraft reference database, and configurable inspection templates.

#### Multi-Base Architecture
- **`bases` table and `base_members` join table**: Full multi-tenant schema with per-installation data isolation
- **Installation context**: All data queries (discrepancies, checks, inspections, obstructions, activity) scoped to the user's current `base_id`
- **Installation switcher**: Settings page allows switching between bases; admins can manage multiple installations
- **Base directory**: Static directory of 155 military installations with ICAO codes for dropdown selection
- **Signup flow**: New users select an installation on signup; `base_members` row auto-created via database trigger
- **Selfridge hardcoding removed**: Replaced all hardcoded KMTC references with dynamic base config from Supabase
- **Andersen AFB (PGUA) seed**: Second base seeded as proof of multi-base support with dual runways

#### Base Configuration (`/settings/base-setup`)
- **Runways tab**: Add/edit/delete runways with full metadata (length, width, surface, heading, class B/Army_B, end coordinates, designators, approach lighting)
- **NAVAIDs tab**: Add/delete navigation aids with automatic `navaid_statuses` row creation
- **Areas tab**: Manage airfield area names (used in checks, discrepancies, inspections)
- **CE Shops tab**: Manage Civil Engineering shop list for discrepancy assignment
- **Templates tab**: Initialize default inspection templates or navigate to full editor
- **Dashboard preview**: Live preview of current base configuration

#### Inspection Templates (`/settings/templates`)
- **Customizable checklists**: Per-base airfield and lighting inspection templates
- **Section and item CRUD**: Add/edit/delete sections and checklist items
- **Item type toggle**: Switch items between Pass/Fail and BWC types
- **Template initialization**: Clone from default template for new bases
- **Database**: `inspection_template_sections` and `inspection_template_items` tables

#### Reports Module (`/reports`)
- **Daily Operations Summary**: Date-range report covering inspections, checks, status changes, new discrepancies, obstruction evaluations — with PDF export
- **Open Discrepancies Report**: Current snapshot with area and type breakdowns, aging highlights — with PDF export
- **Discrepancy Trends**: Opened vs. closed over 30d/90d/6m/1y with top areas and types — with PDF export
- **Aging Discrepancies**: Open items grouped by age tiers (0–7, 8–14, 15–30, 31–60, 61–90, 90+ days) with severity and shop breakdowns — with PDF export

#### Aircraft Database (`/aircraft`)
- **1,000+ aircraft reference entries**: Military and civilian aircraft with ACN/PCN comparison data
- **Search and filtering**: By name, type, manufacturer, military branch
- **Sorting**: By name, weight, wingspan, ACN values
- **Favorites**: Star aircraft for quick access
- **ACN/PCN comparison panel**: Compare aircraft pavement loading against runway PCN values

#### Theme System
- **Light/Dark/Auto modes**: CSS custom properties with smooth transitions
- **Auto mode**: Follows system preference via `prefers-color-scheme`
- **Theme toggle**: Available in Settings page under Appearance section
- **Professional light theme**: Carefully tuned light colors for outdoor/bright-light use

#### Obstruction Tool Enhancements
- **Multi-runway evaluation**: Evaluates obstructions against ALL base runways simultaneously
- **Per-runway surface overlays**: Runway-specific surfaces (primary, approach-departure, transitional, clear zone, graded area, APZ I/II) generated for every runway
- **Per-runway toggles in legend**: Map legend shows toggles grouped by runway for multi-runway bases
- **Clear Zone and Graded Area surfaces**: Added to evaluation and map (previously missing)
- **APZ I and APZ II zones**: Land-use zone evaluation with guidance text
- **Distance to threshold**: Shows distance to nearest runway end in evaluation results

#### Dashboard Improvements
- **Airfield status persistence**: Runway status, active runway, advisory, BWC, RSC all persist to `airfield_status` table via server-side API
- **Runway status audit log**: All status changes logged to `runway_status_log` with database trigger
- **Status-colored Active Runway card**: Green (open), yellow (suspended), red (closed)
- **NAVAID and Areas display fixes**: Resolved issues where NAVAID toggles and areas checked were not rendering

#### Inspection Workflow
- **Complete/File flow**: Two-step workflow — inspectors complete their half, then a filer combines and files the daily report
- **Per-user tracking**: `completed_by` and `filed_by` fields for audit trail

#### UI Polish
- **Search bar restyle**: White background with dark border in light theme
- **Detail box restyle**: Better label/value contrast across themes
- **Toggle button borders**: Consistent 1.5px borders on all toggle elements
- **Professional color palette**: Toned down both light and dark themes

#### Database (14 new migrations)
- `20260222_add_completed_filed_by.sql` — Inspection workflow fields
- `20260222_create_airfield_status.sql` — Airfield status persistence table
- `20260222_create_runway_status_log.sql` — Runway status audit log with trigger
- `20260222_disable_rls_new_tables.sql` — Disable RLS on new tables for MVP
- `20260223_01_create_bases.sql` — Multi-base schema (bases, base_runways, base_navaids, base_areas, base_ce_shops, base_members)
- `20260223_02_add_base_id_and_seed.sql` — Add base_id to all data tables, seed Selfridge
- `20260223_03_add_profile_fields.sql` — Add primary_base_id, icao to profiles
- `20260223_04_signup_base_membership.sql` — Auto-create base_members on signup trigger
- `20260223_05_base_rls_policies.sql` — Base-scoped RLS policies
- `20260223_06_fix_bases_icao_constraint.sql` — ICAO uniqueness constraint
- `20260224_consolidate_selfridge_base.sql` — Merge duplicate Selfridge entries
- `20260224_inspection_templates.sql` — Inspection template tables
- `20260224_relax_airfield_status_constraint.sql` — Allow flexible status values
- `20260224_seed_pgua_andersen_afb.sql` — Andersen AFB seed with dual runways

#### New Source Files
- `lib/base-directory.ts` — 155 military installations with ICAO codes
- `lib/aircraft-data.ts` — 1,000+ aircraft reference entries
- `lib/supabase/inspection-templates.ts` — Template CRUD operations
- `app/(app)/reports/` — 5 report pages (hub + 4 report types)
- `app/(app)/settings/` — 3 settings pages (hub + base-setup + templates)
- `app/(app)/aircraft/page.tsx` — Aircraft database with ACN/PCN comparison
- `app/api/installations/route.ts` — Installation management API
- `app/api/airfield-status/route.ts` — Airfield status GET/PATCH API

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
