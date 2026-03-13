# Glidepath

Mobile-first, responsive web application for managing airfield operations across U.S. military installations. Covers discrepancy tracking, airfield checks, daily inspections, ACSI (annual compliance), NOTAMs, obstruction evaluations, operational reporting, a regulatory reference library, an aircraft database, waivers, and a real-time operational dashboard. Built for multi-base deployment with per-installation data isolation.

**Version:** 2.19.0 | **Build:** Clean | **49 routes** | **195+ source files** | **103 migrations**

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14.2.35 |
| Language | TypeScript (strict mode) | 5.9.3 |
| Styling | Tailwind CSS + CSS custom properties — light/dark/auto theme | 3.4.19 |
| Backend | Supabase (PostgreSQL, Auth, Storage) | SSR 0.8.0 |
| Maps | Mapbox GL JS | 3.18.1 |
| PDF Viewing | react-pdf (PDF.js) | 10.3.0 |
| PDF Export | jsPDF + jspdf-autotable | 4.1.0 |
| Email Delivery | Resend | 6.9.3 |
| Excel Export | SheetJS (xlsx) + ExcelJS | 0.18.5 / 4.4.0 |
| Validation | Zod | 3.25.76 |
| Offline Storage | IndexedDB (6 object stores) | — |
| Icons | Lucide React | 0.563.0 |
| Toasts | Sonner | 1.7.4 |
| PWA | @ducanh2912/next-pwa | 10.2.9 |

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Start development server
npm run dev
```

The app runs at `http://localhost:3000`. If Supabase credentials are missing or contain placeholders, the app runs in **demo mode** with offline mock data — no setup required.

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
NEXT_PUBLIC_MAPBOX_TOKEN=[mapbox-token]
NEXT_PUBLIC_APP_URL=http://localhost:3000
RESEND_API_KEY=[resend-api-key]
```

### Database Setup

Apply the schema and migrations to a Supabase project:

1. Run `supabase/schema.sql` to create the base tables and sequences
2. Apply the 103 migrations in order from `supabase/migrations/`

See [docs/BASE-ONBOARDING.md](./docs/BASE-ONBOARDING.md) for adding new installations.

## Responsive Layout

The app adapts across three breakpoints while preserving mobile-first design:

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile | < 768px | Bottom nav, 480px max-width, stacked layouts |
| Tablet | 768px+ | Permanent 300px sidebar, content up to 768px, 2-col grids |
| Desktop | 1024px+ | Sidebar + content up to 1000px, 4-col grids, larger maps |

Key responsive features:
- **Permanent sidebar** on tablet/desktop with full descriptive nav labels
- **Font scaling** via 11 CSS custom properties (`--fs-2xs` through `--fs-5xl`)
- **Element scaling** for cards, inputs, buttons, badges at each breakpoint
- **Map components** standardized to 3:4 portrait aspect ratio with 70vh max
- **Obstruction map** centered at 60% width with responsive scaling

## Modules

### Dashboard (`/`)
Real-time operational hub with **Supabase Realtime** push updates — advisory, runway status, BWC, RSC, and last check changes propagate to all connected users instantly. Live clock, Open-Meteo weather with conditions/wind/visibility, advisory system (INFO/CAUTION/WARNING), Active Runway toggle with Open/Suspended/Closed status (color-coded card, persisted to DB with audit log), Current Status panel (RSC/RCR, BWC, Last Check), side-by-side NAVAID status panels with G/Y/R toggles and notes, KPI badge grid (3-col desktop, 2-col mobile) with Shift Checklist dialog for inline completion, quick actions (Begin Inspection, Begin Check, New Discrepancy), user presence tracking (Online/Away/Inactive), installation switcher in header for multi-base users, and expandable activity feed with enriched action labels.

### Discrepancies (`/discrepancies`)
Track and resolve airfield issues. 11 discrepancy types (FOD, pavement, lighting, markings, signage, drainage, vegetation, wildlife, equipment, security, other). Full lifecycle: Open → Submitted to AFM → Submitted to CES → Work Completed → Closed/Cancelled. Photo uploads, Mapbox location pinning, notes history with timestamps, work order tracking, linked NOTAMs. **Map view** with severity-colored pins (Common Operating Picture), List/Map toggle, severity legend with counts, expand/collapse.

### Airfield Checks (`/checks`)
7 check types in a single unified form:
- **FOD Check** — route, items found, clear/not-clear
- **RSC Check** — contaminant type/depth/coverage, braking action, treatment
- **RCR Check** — Mu readings (rollout/midpoint/departure), equipment, temperature
- **IFE** — in-flight emergency response
- **Ground Emergency** — 12-item AM action checklist, 9 agency notifications
- **Heavy Aircraft** — aircraft type, parking, weight, taxi route
- **BASH** — condition code, species, mitigation, habitat attractants

Photo capture, map location, issue-found gating, multiple issues per check with per-issue photos and GPS pins, follow-up remarks with auto-save on completion. Supabase draft persistence with manual "Save Draft" button for cross-device access. Full history with type filtering and search.

### Daily Inspections (`/inspections`)
Combined Airfield Inspection Report with two halves:
- **Airfield** — configurable sections and checklist items (per-base templates)
- **Lighting** — configurable sections and checklist items (per-base templates)

All items default to Pass — three-state toggle (Pass → Fail → N/A → Pass) for amending individual items. Multiple discrepancies per failed item with per-discrepancy comments, GPS pins, map thumbnails, and photos. BWC integration (LOW/MOD/SEV/PROHIB), draft persistence to localStorage and Supabase for cross-device access, two-step Complete/File workflow with per-user tracking, combined PDF export with per-discrepancy photo embedding. Also supports standalone Construction Meeting and Joint Monthly inspection forms with personnel attendance tracking.

### ACSI (`/acsi`)
Airfield Compliance and Safety Inspection per DAFMAN 13-204v2, Para 5.4.3. Annual compliance inspection with 10 sections and ~100 checklist items.

- **Form** (`/acsi/new`) — 10 collapsible sections (all collapsed by default), Y/N/N/A toggle per item, per-item discrepancy documentation for failures (comment, work order, project #, estimated cost, estimated completion date), photo/map upload on failed items, inspection team editor (AFM/CE/Safety required + additional members), risk management certification with 3 signature blocks (OG/CC, MSG/CC, WG/CC), general notes
- **Detail** (`/acsi/[id]`) — Read-only view with color-coded response badges, inline discrepancy details + photos, team and certification display. Edit button for Airfield Manager/Base Admin/System Admin
- **List** (`/acsi`) — KPI badges (Total/Completed/In Progress/Draft), status filter, search
- **Exports** — PDF with parent/sub-field visual hierarchy and inline discrepancy photos; Excel with Cover, Checklist, Team, and Risk Cert sheets
- **Draft persistence** — localStorage auto-save (1s debounce) + auto-save to DB on new inspection for immediate photo upload

### All Inspections (`/inspections/all`)
Navigation hub accessible from the More menu. Styled cards for each inspection type (Daily Airfield, ACSI, Pre/Post Construction, Joint Monthly) with "Start" and "History" action buttons.

### Reports (`/reports`)
Four report types with PDF export and email delivery:
- **Daily Operations Summary** — all activity for a date/range (inspections, Visual NAVAID outages, checks, status changes, discrepancies, obstructions, QRC executions, events log)
- **Open Discrepancies** — current snapshot with area and type breakdowns
- **Discrepancy Trends** — opened vs. closed over 30d/90d/6m/1y with top areas/types
- **Aging Discrepancies** — open items grouped by age tiers with severity and shop breakdowns

### Obstruction Evaluations (`/obstructions`)
UFC 3-260-01 Class B imaginary surface analysis with multi-runway support:
- 10 surfaces: Primary, Approach-Departure, Transitional, Inner Horizontal, Conical, Outer Horizontal, Clear Zone, Graded Area, APZ I, APZ II
- Interactive Mapbox map with color-coded surface overlays and per-runway toggles
- Evaluates against ALL base runways simultaneously
- Geodesic calculations (Haversine, cross-track/along-track), Open-Elevation API for MSL heights
- Multiple photos per evaluation, violation detection with UFC table references
- Responsive map with expand/collapse toggle
- **History map view** with List/Map toggle showing all evaluations on a satellite map

### Aircraft Database (`/aircraft`)
200+ military and civilian aircraft reference entries. Search by name, type, manufacturer, or branch. Sort by weight, wingspan, or ACN values. Favorites system. ACN/PCN comparison panel for pavement loading analysis.

### References (`/regulations`)
Comprehensive regulatory reference library with two tabs:

**References tab** — 70 regulation entries from DAFMAN 13-204 Vols 1–3 and UFC 3-260-01. Full-text search, category/pub-type filters, favorites with localStorage persistence. In-app PDF viewer with pinch-to-zoom. Offline caching via IndexedDB with "Cache All" bulk download. Admin controls for adding/deleting references with PDF upload.

**My Documents tab** — Upload personal PDFs, JPGs, and PNGs. Client-side text extraction for search. Per-document offline caching. Supabase Storage integration.

### Waivers (`/waivers`)
Full airfield waiver lifecycle management modeled after AF Form 505 and the AFCEC Playbook Appendix B requirements. Six classification types (permanent, temporary, construction, event, extension, amendment), seven status values with mandatory comment dialogs for status transitions. Waiver detail pages include criteria & standards references, coordination tracking by office, photo attachments with camera capture, and annual review history. Individual waiver PDF export with embedded photos. Excel export of the full waiver register with criteria and coordination sheets. Annual review mode (`/waivers/annual-review`) with year-by-year review forms, KPIs, and board presentation tracking. **Map view** with emoji markers by classification type, clickable type filter legend, List/Map toggle. **Location picker** on create/edit forms for GPS pinning.

### NOTAMs (`/notams`)
Live FAA NOTAM feed via `notams.aim.faa.gov` — no API key required. Auto-fetches NOTAMs for the current installation's ICAO code on page load. ICAO search input for querying any airport. Full NOTAM text displayed on each card in monospace. Feed status indicator, refresh button, loading/error states. Filter chips (All/FAA/LOCAL/Active/Expired). **Expiring NOTAM alerts** — sidebar badge count and red card highlight for NOTAMs within 24 hours of expiration (checked every 5 minutes). Falls back to demo data when Supabase is not configured. Draft creation for local NOTAMs.

### Shift Checklist (`/shift-checklist`)
Per-shift task tracking with configurable items per base. Three shifts: Day, Swing, Mid. Items assigned to shifts with daily/weekly/monthly frequency. **Timezone-aware date calculation** — uses the base's configured timezone and reset time (default 06:00) to determine the current checklist date. Before the reset time, items belong to the previous day's checklist.

- **Today tab** — Progress bar per shift, check-off items with notes, file/reopen workflow with per-user tracking
- **History tab** — Clickable historical checklists with read-only detail view
- **Dashboard KPI badge** — Quick access dialog for marking items complete without leaving the dashboard
- **Base Configuration** — Add/edit/delete/toggle items per shift, configurable daily reset time per base (`Settings > Base Configuration > Shift Checklist`)

### Airfield Visual NAVAIDs (`/infrastructure`)
Interactive Mapbox satellite map for digitizing and managing all airfield lighting, signage, and miscellaneous features. 22 feature types across 4 groups (Signs, Taxiway Lights, Runway Lights, Miscellaneous). Click-to-place pins with per-feature rotation, drag-to-move, inline label editing, and bar placement mode for approach lighting components (6 bar types with geodesic offset calculations). Custom canvas-rendered icons match real-world airfield sign colors and styles.

**Legend System** — Three-tier grouped legend: Type legend (4 collapsible groups), Systems legend (auto-grouped by runway/taxiway/area/misc from Base Configuration), per-layer visibility toggles, Show All/Hide All, feature count badges. "Show outages only" and "Color by health" toggles.

**Outage Tracking** — DAFMAN 13-204v2 Table A3.1 compliance engine with 23 lighting system types, configurable outage thresholds per component (percentage, count, consecutive), spatial adjacency violation detection, and 4-tier health alerts (green/yellow/red/black). System Health Panel with per-system/per-component outage bars, DAFMAN-prescribed required actions, and outage history timeline. Auto-creates discrepancies when features are marked inoperative; bidirectional resolution closes linked discrepancies with user attribution. Map health rings visualize system degradation on operational features. Daily ops report includes "VISUAL NAVAID OUTAGES" section.

**Bulk Operations** — Box select for shift, re-layer, delete, free move, component assignment, and type change. GPS tracking for drive-around use. Supabase pagination handles 1,000+ features. Import API for bulk GeoJSON data.

### QRC — Quick Reaction Checklists (`/qrc`)
Interactive execution of 25 digitized Quick Reaction Checklists for airfield emergencies and operational events (IFE, aircraft mishap, bird strike, tornado warning, etc.).

- **Three tabs** — Available (template grid for launching new QRCs), Active (open executions in progress), History (closed/all executions)
- **6 step types** — Checkbox, checkbox with note, agency notification tracking, fill-in fields, time fields with "Now (Z)" auto-fill, conditional cross-references
- **SCN (Secondary Crash Net) form** — Data entry fields displayed above steps for applicable QRCs
- **Lifecycle** — Open (start execution) → Close (with initials/timestamp) or Cancel (permanently delete accidental openings)
- **Dashboard integration** — KPI badge with active count, quick-launch dialog for starting/resuming QRCs without leaving the dashboard
- **Template management** — Admin-only CRUD in Base Configuration with seed data for 25 standard QRCs, selective seeding, annual review tracking
- **Daily ops report** — QRC executions and Events Log entries included in PDF export with per-day grouping for multi-day ranges

### Settings (`/settings`)
Collapsible dropdown sections — Profile and About default open, all others collapsed.
- **Profile** — read-only display of user info, rank, role, primary base, configurable default PDF email, operating initials
- **Installation** — current base display; switching/adding restricted to sys_admin only
- **Data & Storage** — view/clear cached data, estimated storage used
- **Regulations Library** — download all PDFs for offline, manage cache
- **Base Configuration** (`/settings/base-setup`) — runways, NAVAIDs, areas, CE shops, templates, shift checklist items, checklist reset time, airfield diagram upload
- **Appearance** — Day/Night/Auto theme toggle
- **About** — version, environment, branding
- **Inspection Templates** (`/settings/templates`) — customize airfield/lighting checklist sections and items

### User Management (`/users`)
Admin-only module for managing users across installations. System admins see all users with an installation dropdown; base admins, airfield managers, and NAMOs see only their base's users. Features include:
- **Searchable user list** with role and status filter dropdowns
- **User cards** with rank, role badge, status badge, base assignment, last seen
- **User detail modal** for editing profiles (rank, names, role, installation) with field-level permission enforcement
- **Invite user** with email, rank, names, role, installation — sends branded setup email
- **Password reset** sends recovery email; users can also self-serve via "Forgot Password?" on login
- **Account lifecycle**: Deactivate/reactivate users, delete accounts (sys_admin only)
- **Three-tier role hierarchy**: sys_admin > base_admin/AFM/NAMO > regular roles

### Events Log (`/activity`)
Full audit trail with date-range filtering (Today, 7 Days, 30 Days, Custom). Columnar table display (Time Z, Action, Details, OI) grouped by date headers with per-column search filters. Operating initials column with click-to-reveal popover showing full name, role, and masked EDIPI. Manual text entry with activity templates. Edit/delete entries via modal dialog with Zulu time editing. Clickable items link to source entity. Excel export with styled formatting. All timestamps in Zulu (UTC).

### More Menu (`/more`)
Module directory with collapsible dropdown groups (AM Tools, More) matching the sidebar structure. Role-gated visibility (admin-only modules hidden for non-admin users). "All Inspections" hub at top for quick access to all inspection forms.

## Project Structure

```
airfield-app/
├── app/
│   ├── layout.tsx                        # Root layout (metadata, PWA manifest, toasts)
│   ├── globals.css                       # Responsive CSS: themes, utility classes, breakpoints
│   ├── login/page.tsx                    # Auth page (email/password + demo bypass)
│   ├── api/                              # Server-side API routes (9 endpoints)
│   ├── auth/confirm/route.ts            # OTP/PKCE token exchange for email links
│   ├── reset-password/page.tsx          # Password reset form
│   ├── setup-account/page.tsx           # Invited user account setup
│   └── (app)/                            # Authenticated app shell
│       ├── layout.tsx                    # Header + sidebar + bottom nav
│       ├── page.tsx                      # Dashboard
│       ├── acsi/                         # ACSI annual compliance (list, form, detail)
│       ├── checks/                       # Check form, history, detail
│       ├── discrepancies/                # List, create, detail
│       ├── inspections/                  # Workspace + history, detail, all-inspections hub
│       ├── notams/                       # List, create, detail
│       ├── obstructions/                 # Evaluation, history, detail
│       ├── regulations/page.tsx          # Reference library + My Documents
│       ├── library/page.tsx              # Admin PDF library management
│       ├── aircraft/page.tsx             # Aircraft database with ACN/PCN
│       ├── reports/                      # Hub + 4 report pages
│       ├── settings/                     # Hub + base-setup + templates
│       ├── waivers/                      # List, create, detail, edit, annual review
│       ├── activity/page.tsx             # Audit trail with date filtering
│       ├── qrc/page.tsx                   # QRC execution (available + active + history)
│       ├── shift-checklist/page.tsx       # Shift checklist (today + history)
│       ├── contractors/page.tsx          # Personnel on Airfield
│       ├── infrastructure/page.tsx       # Airfield infrastructure map
│       ├── more/page.tsx                 # Module directory
│       └── users/page.tsx                # User Management (admin)
├── components/
│   ├── acsi/                              # ACSI form sub-components (6 files)
│   ├── admin/                            # User management components (9 files)
│   ├── layout/                           # Header, sidebar, bottom-nav
│   ├── discrepancies/                    # Cards, location map, map view (COP), modals
│   ├── obstructions/                     # Airfield map with surface overlays, map view
│   ├── waivers/                          # Waiver map view, location picker
│   ├── infrastructure/                   # System health panel with outage timeline
│   ├── ui/                               # Badge, button, email-pdf-modal, photo-picker
│   ├── RegulationPDFViewer.tsx          # In-app PDF viewer with zoom/touch
│   ├── login-activity-dialog.tsx         # Login notification with activity table
│   └── PDFLibrary.tsx                    # Admin PDF library component
├── lib/
│   ├── constants.ts                      # Checklists, types, regulation categories, ACSI template
│   ├── aircraft-data.ts                 # 200+ aircraft reference entries
│   ├── utils.ts                          # Helpers (formatters, config checks)
│   ├── demo-data.ts                      # Offline mock data (10 arrays)
│   ├── weather.ts                        # Open-Meteo weather fetching
│   ├── acsi-draft.ts                    # ACSI draft persistence (localStorage + DB)
│   ├── acsi-pdf.ts                      # ACSI PDF export with didParseCell/didDrawCell hooks
│   ├── acsi-excel.ts                    # ACSI Excel export (multi-sheet)
│   ├── qrc-seed-data.ts                 # 25 QRC templates with full step structures
│   ├── *-context.tsx                     # React context (installation, dashboard, theme, sidebar)
│   ├── idb.ts                            # IndexedDB wrapper (6 stores)
│   ├── calculations/                     # UFC 3-260-01 geometry + obstruction analysis
│   ├── reports/                          # PDF export data + generators (4 types)
│   ├── admin/                            # RBAC utilities + user management
│   ├── use-expiring-notams.ts            # Hook for NOTAM expiry alerts (5-min poll)
│   └── supabase/                         # Client, server, types, CRUD modules (23 files)
├── supabase/
│   ├── schema.sql                        # Full database schema
│   ├── migrations/                       # 103 migration files
│   └── functions/                        # Edge functions (PDF text extraction)
├── middleware.ts                          # Auth guard + demo mode bypass
├── public/                               # Static assets, PWA manifest, aircraft images
├── scripts/                              # Utility scripts (PDF downloads, regulation verification)
└── docs/                                 # Integration guides, reference docs, session handoffs
```

## Database

**42 tables** across the Supabase PostgreSQL database:

| Table | Purpose |
|-------|---------|
| `profiles` | User accounts, roles, rank, shop, primary base, presence, default PDF email, operating initials |
| `bases` | Installation definitions (name, ICAO, location, timezone, checklist reset time) |
| `base_runways` | Runway geometry per base (ends, heading, class, dimensions) |
| `base_navaids` | Navigation aids per base |
| `base_areas` | Airfield areas per base |
| `base_ce_shops` | Civil Engineering shops per base |
| `base_members` | User-base membership join table |
| `discrepancies` | Airfield issues with full lifecycle tracking |
| `airfield_checks` | 7 check types with JSONB data |
| `check_comments` | Remarks timeline for checks |
| `inspections` | Daily inspections (Airfield + Lighting) |
| `acsi_inspections` | Annual compliance inspections (DAFMAN 13-204v2) |
| `inspection_template_sections` | Per-base inspection template sections |
| `inspection_template_items` | Per-base inspection checklist items |
| `notams` | FAA and LOCAL NOTAM tracking |
| `photos` | Photos for discrepancies, checks, inspections, evaluations, ACSI (with `issue_index` for per-issue linking) |
| `obstruction_evaluations` | UFC 3-260-01 surface analysis |
| `airfield_status` | Persisted runway status, advisory, BWC, RSC |
| `runway_status_log` | Audit trail for all runway status changes |
| `activity_log` | Audit trail for all mutations |
| `navaid_statuses` | G/Y/R status for approach systems |
| `regulations` | 70 regulatory references with metadata |
| `user_documents` | User-uploaded personal document metadata |
| `user_document_pages` | Extracted text per page for search |
| `pdf_text_pages` | Server-side PDF text for full-text search |
| `waivers` | Airfield waivers with AF-505 fields, classification, status |
| `waiver_criteria` | UFC/standard references per waiver |
| `waiver_attachments` | Photos and documents per waiver |
| `waiver_reviews` | Annual review records with recommendations |
| `waiver_coordination` | Office-by-office coordination tracking |
| `shift_checklist_items` | Configurable per-base shift checklist items (day/swing/mid) |
| `shift_checklists` | Daily checklist instances per base (date, status, completion) |
| `shift_checklist_responses` | Per-item responses with completion tracking |
| `airfield_contractors` | Personnel on airfield tracking |
| `base_arff_aircraft` | ARFF aircraft per base |
| `qrc_templates` | Admin-configured QRC definitions per base (steps, SCN fields, review tracking) |
| `qrc_executions` | QRC execution instances with JSONB step responses and SCN data |
| `infrastructure_features` | Airfield lighting, signage, and miscellaneous features with coordinates, rotation, status, and layer assignment |
| `lighting_systems` | DAFMAN-defined lighting system instances per base (ALSF-1, SALS, per-taxiway edge lights, etc.) |
| `lighting_system_components` | Sub-components within systems with DAFMAN Table A3.1 outage thresholds and required actions |
| `outage_events` | Structured outage history log (reported/resolved events per feature) |
| `outage_rule_templates` | Global DAFMAN 13-204v2 Table A3.1 seed data for system setup |
| `inspection_item_system_links` | Links inspection template items to lighting systems for cross-module reporting |

## Key Design Decisions

1. **Multi-Base Architecture** — All data tables carry a `base_id` foreign key. Users belong to installations via `base_members`. Queries are scoped to the user's current installation at the application layer.
2. **Demo Mode** — App runs fully offline with mock data when Supabase env vars are missing. No setup required for development or demos.
3. **Responsive Layout** — Three breakpoints (mobile/tablet/desktop) with permanent sidebar on wider screens. CSS custom properties drive font and element scaling. Mobile bottom nav preserved for phone usage.
4. **Theme System** — Light/Dark/Auto modes via CSS custom properties. Auto follows `prefers-color-scheme`.
5. **Configurable Templates** — Inspection checklists are stored in the database per base, not hardcoded. New bases clone from a default template.
6. **Client-Side PDF + Email** — jsPDF generates reports in the browser. PDFs can be downloaded directly or emailed via Resend API. Users can set a default email in Settings that pre-fills the send modal.
7. **RLS Fully Enabled** — Role-based RLS policies on all tables via 3 helper functions (`user_has_base_access`, `user_can_write`, `user_is_admin`). Five-tier role hierarchy: sys_admin > base_admin/AFM/NAMO > amops > CES/safety/ATC > read_only. Storage bucket policies on `storage.objects`.
8. **Hybrid Offline** — IndexedDB caches PDF blobs, extracted text, and demo-mode airfield diagrams. PWA service worker caches app shell.
9. **Admin-Gated CRUD** — Base configuration and reference management require `airfield_manager` or `sys_admin` role.
10. **Three-Tier Admin Hierarchy** — `sys_admin` has full access; `base_admin`, `airfield_manager`, and `namo` have base-scoped admin capabilities; all other roles are standard users.
11. **ACSI Separate Table** — Annual compliance inspections use a dedicated `acsi_inspections` table (not reusing `inspections`) due to unique fields: inspection team, risk management certification, per-item discrepancy details, fiscal year tracking.

## Known Tech Debt

| Item | Priority | Notes |
|------|----------|-------|
| No test suite | High | No unit or integration tests |
| 109 `as any` casts | Medium | Across ~25 files — Mapbox layer expressions (31), Supabase row inserts (57), jsPDF hooks (11), misc (10). Regenerate Supabase types to eliminate ~50% |
| 48 files > 500 lines | Low | Largest: `infrastructure/page.tsx` (3,440), `base-setup/page.tsx` (2,260), `inspections/page.tsx` (2,251) |
| Map init duplication | Low | 6 Mapbox components share similar init logic |
| PDF boilerplate duplication | Low | 11 PDF generators share similar header/footer/photo helper patterns |

## Current Status

**Build**: TypeScript compiles clean (`npm run build` passes with zero errors)

**Complete modules**: Dashboard (Supabase Realtime push + installation switcher + presence tracking + KPI badges), Airfield Status (inline personnel + construction/misc), Discrepancies (COP map + individual PDF export + linked NAVAID cards), Airfield Checks (7 types + cross-device drafts), Daily Inspections (multi-discrepancy + per-issue photos + reopening), ACSI (annual compliance with PDF/Excel export), NOTAMs (live FAA feed + expiry alerts), Obstruction Evaluations (UFC 3-260-01 + interactive map), References (70 refs + My Documents + offline caching), Reports (4 types + Events Log + QRC details + NAVAID outages in daily ops PDF), Aircraft Database (200+ aircraft + ACN/PCN), Waivers (full lifecycle with annual review + attachment management + PDF/Excel export), QRC (25 Quick Reaction Checklists + interactive execution + dashboard dialog), Shift Checklist (per-shift tasks + timezone-aware dates + dashboard dialog), Airfield Visual NAVAIDs (22 feature types + custom icons + bar placement + GPS tracking + DAFMAN 13-204v2 outage compliance engine + system health panel + outage timeline + map health rings), Settings (Base Setup + Templates + Shift Checklist config + QRC Templates + Lighting Systems + Default PDF Email), User Management (invite/edit/delete cascade + email privacy), Events Log (manual entries + edit/delete + activity templates + Excel export), All Inspections hub, Email PDF (all 11 export pages), More hub, Personnel on Airfield

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.

## Reference Documents

- [`docs/GLIDEPATH_CAPABILITIES_BRIEF.md`](./docs/GLIDEPATH_CAPABILITIES_BRIEF.md) — Capabilities brief (v2.17.0)
- [`docs/GLIDEPATH_BETA_TESTER_GUIDE.md`](./docs/GLIDEPATH_BETA_TESTER_GUIDE.md) — Beta tester onboarding guide
- [`docs/GLIDEPATH_ROLLOUT_PLAN.md`](./docs/GLIDEPATH_ROLLOUT_PLAN.md) — 5-phase rollout strategy
- [`docs/BASE-ONBOARDING.md`](./docs/BASE-ONBOARDING.md) — Guide for adding new installations
- [`docs/Glidepath_SRS_v5.0.md`](./docs/Glidepath_SRS_v5.0.md) — Software Requirements Specification
- [`docs/RLS_TEST_CHECKLIST.md`](./docs/RLS_TEST_CHECKLIST.md) — Row-Level Security test results
- [`docs/Airfield_Inspection_Checklist_Template.md`](./docs/Airfield_Inspection_Checklist_Template.md) — ACSI checklist reference (DAFMAN 13-204v2)
- `docs/NotebookLM_Source_*.md` — 8 source documents for NotebookLM cinematic video overviews
