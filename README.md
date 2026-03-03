# Glidepath

Mobile-first, responsive web application for managing airfield operations across U.S. military installations. Covers discrepancy tracking, airfield checks, daily inspections, ACSI (annual compliance), NOTAMs, obstruction evaluations, operational reporting, a regulatory reference library, an aircraft database, waivers, and a real-time operational dashboard. Built for multi-base deployment with per-installation data isolation.

**Version:** 2.12.0 | **Build:** Clean | **54 routes** | **144 source files** | **58 migrations** | **~49,500 lines**

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
2. Apply the 58 migrations in order from `supabase/migrations/`

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
- **Map components** scale from 420px to 80vh with expand/collapse toggle
- **Obstruction map** scales from 600px to 85vh with expand/collapse toggle

## Modules

### Dashboard (`/`)
Real-time operational hub. Live clock, Open-Meteo weather with conditions/wind/visibility, advisory system (INFO/CAUTION/WARNING), Active Runway toggle with Open/Suspended/Closed status (color-coded card, persisted to DB with audit log), Current Status panel (RSC, BWC, Last Check), side-by-side NAVAID status panels with G/Y/R toggles and notes, quick actions (Begin Inspection, Begin Check, New Discrepancy), user presence tracking (Online/Away/Inactive), installation switcher in header for multi-base users, and expandable activity feed with enriched action labels.

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

Photo capture, map location, issue-found gating, follow-up remarks with auto-save on completion. Full history with type filtering and search.

### Daily Inspections (`/inspections`)
Combined Airfield Inspection Report with two halves:
- **Airfield** — configurable sections and checklist items (per-base templates)
- **Lighting** — configurable sections and checklist items (per-base templates)

Three-state toggle (Pass/Fail/N/A), Mark All Pass per section, BWC integration (LOW/MOD/SEV/PROHIB), draft persistence to localStorage, two-step Complete/File workflow with per-user tracking, combined PDF export. Also supports standalone Construction Meeting and Joint Monthly inspection forms with personnel attendance tracking.

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
- **Daily Operations Summary** — all activity for a date/range (inspections, checks, status changes, discrepancies, obstructions)
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
1,000+ military and civilian aircraft reference entries. Search by name, type, manufacturer, or branch. Sort by weight, wingspan, or ACN values. Favorites system. ACN/PCN comparison panel for pavement loading analysis.

### References (`/regulations`)
Comprehensive regulatory reference library with two tabs:

**References tab** — 70 regulation entries from DAFMAN 13-204 Vols 1–3 and UFC 3-260-01. Full-text search, category/pub-type filters, favorites with localStorage persistence. In-app PDF viewer with pinch-to-zoom. Offline caching via IndexedDB with "Cache All" bulk download. Admin controls for adding/deleting references with PDF upload.

**My Documents tab** — Upload personal PDFs, JPGs, and PNGs. Client-side text extraction for search. Per-document offline caching. Supabase Storage integration.

### Waivers (`/waivers`)
Full airfield waiver lifecycle management modeled after AF Form 505 and the AFCEC Playbook Appendix B. Six classification types (permanent, temporary, construction, event, extension, amendment), seven status values with mandatory comment dialogs for status transitions. Waiver detail pages include criteria & standards references, coordination tracking by office, photo attachments with camera capture, and annual review history. Individual waiver PDF export with embedded photos. Excel export of the full waiver register with criteria and coordination sheets. Annual review mode (`/waivers/annual-review`) with year-by-year review forms, KPIs, and board presentation tracking. **Map view** with emoji markers by classification type, clickable type filter legend, List/Map toggle. **Location picker** on create/edit forms for GPS pinning.

### NOTAMs (`/notams`)
Live FAA NOTAM feed via `notams.aim.faa.gov` — no API key required. Auto-fetches NOTAMs for the current installation's ICAO code on page load. ICAO search input for querying any airport. Full NOTAM text displayed on each card in monospace. Feed status indicator, refresh button, loading/error states. Filter chips (All/FAA/LOCAL/Active/Expired). Falls back to demo data when Supabase is not configured. Draft creation for local NOTAMs.

### Settings (`/settings`)
Collapsible dropdown sections — Profile and About default open, all others collapsed.
- **Profile** — read-only display of user info, rank, role, primary base, configurable default PDF email
- **Installation** — current base display; switching/adding restricted to sys_admin only
- **Data & Storage** — view/clear cached data, estimated storage used
- **Regulations Library** — download all PDFs for offline, manage cache
- **Base Configuration** (`/settings/base-setup`) — runways, NAVAIDs, areas, CE shops, templates, airfield diagram upload
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

### Activity Log (`/activity`)
Full audit trail with date-range filtering (Today, 7 Days, 30 Days, Custom). Columnar table display (Time Z, User, Action, Details) grouped by date headers with per-column search filters. Manual text entry for events not captured by the system. Edit/delete entries via modal dialog with Zulu time editing. Clickable items link to source entity (discrepancy, check, inspection). Excel export with styled formatting.

### More Menu (`/more`)
Module directory linking to all features. All modules visible as a flat list with role-gated visibility (admin-only modules hidden for non-admin users). "All Inspections" hub at top for quick access to all inspection forms.

## Project Structure

```
airfield-app/
├── app/
│   ├── layout.tsx                        # Root layout (metadata, PWA manifest, toasts)
│   ├── globals.css                       # Responsive CSS: themes, utility classes, breakpoints
│   ├── login/page.tsx                    # Auth page (email/password + demo bypass)
│   ├── api/                              # Server-side API routes (8 endpoints)
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
│       ├── more/page.tsx                 # Module directory
│       ├── sync/page.tsx                 # Data sync (coming soon)
│       └── users/page.tsx                # User Management (admin)
├── components/
│   ├── acsi/                              # ACSI form sub-components (6 files)
│   ├── admin/                            # User management components (9 files)
│   ├── layout/                           # Header, sidebar, bottom-nav
│   ├── discrepancies/                    # Cards, location map, map view (COP), modals
│   ├── obstructions/                     # Airfield map with surface overlays, map view
│   ├── waivers/                          # Waiver map view, location picker
│   ├── ui/                               # Badge, button, email-pdf-modal, photo-picker
│   ├── RegulationPDFViewer.tsx          # In-app PDF viewer with zoom/touch
│   ├── login-activity-dialog.tsx         # Login notification with activity table
│   └── PDFLibrary.jsx                   # Admin PDF library component (needs TSX conversion)
├── lib/
│   ├── constants.ts                      # Checklists, types, regulation categories, ACSI template
│   ├── aircraft-data.ts                 # 1,000+ aircraft reference entries
│   ├── utils.ts                          # Helpers (formatters, config checks)
│   ├── demo-data.ts                      # Offline mock data (10 arrays)
│   ├── weather.ts                        # Open-Meteo weather fetching
│   ├── acsi-draft.ts                    # ACSI draft persistence (localStorage + DB)
│   ├── acsi-pdf.ts                      # ACSI PDF export with didParseCell/didDrawCell hooks
│   ├── acsi-excel.ts                    # ACSI Excel export (multi-sheet)
│   ├── *-context.tsx                     # React context (installation, dashboard, theme, sidebar)
│   ├── idb.ts                            # IndexedDB wrapper (6 stores)
│   ├── calculations/                     # UFC 3-260-01 geometry + obstruction analysis
│   ├── reports/                          # PDF export data + generators (4 types)
│   ├── admin/                            # RBAC utilities + user management
│   └── supabase/                         # Client, server, types, CRUD modules (16 files)
├── supabase/
│   ├── schema.sql                        # Full database schema
│   ├── migrations/                       # 58 migration files
│   └── functions/                        # Edge functions (PDF text extraction)
├── middleware.ts                          # Auth guard + demo mode bypass
├── public/                               # Static assets, PWA manifest, aircraft images
├── scripts/                              # Utility scripts (PDF downloads, regulation verification)
└── docs/                                 # Integration guides, reference docs, session handoffs
```

## Database

**26+ tables** across the Supabase PostgreSQL database:

| Table | Purpose |
|-------|---------|
| `profiles` | User accounts, roles, rank, shop, primary base, presence, default PDF email |
| `bases` | Installation definitions (name, ICAO, location) |
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
| `photos` | Photos for discrepancies, checks, inspections, evaluations, ACSI |
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
| ~197 `as any` casts | Medium | Regenerate Supabase types (`supabase gen types typescript`) to eliminate |
| Dead API routes | Medium | `/api/weather` (stub) and `/api/airfield-status` (no callers) — remove or wire up |
| Unused files | Medium | `components/ui/airfield-diagram-viewer.tsx` (no importers), `lib/supabase/regulations.ts` (no importers) |
| Stale aircraft JSON imports | Medium | `lib/aircraft-data.ts` imports root-level JSON (fewer entries) instead of `public/` copies |
| `PDFLibrary.jsx` | Low | Only JSX file — convert to TypeScript (.tsx) |
| 36 files > 500 lines | Low | Largest: `regulations/page.tsx` (1,638), `inspections/page.tsx` (1,602) |
| Duplicate aircraft JSON | Low | Root-level JSON duplicated in `public/` with diverged content |
| Duplicate aircraft images | Low | `public/aircraft_images/military/commercial/` duplicates `public/aircraft_images/commercial/` (~20 files) |
| Stray files | Low | 2 screenshot PNGs + 1 "Copy" JPG in aircraft image directories |
| Untracked migration | Low | `supabase/migrations/2026022701_inspection_photos.sql` not in git |
| Unreachable page | Low | `/sync` has no navigation links — stub page |

## Current Status

**Build**: TypeScript compiles clean (`npm run build` passes with zero errors)

**Complete modules**: Dashboard (with installation switcher + presence tracking), Discrepancies, Airfield Checks, Daily Inspections, ACSI (annual compliance with PDF/Excel export), NOTAMs (live FAA feed), Obstruction Evaluations, References (with My Documents), Reports (4 types with KPI badges), Aircraft Database, Waivers (full lifecycle with annual review, PDF/Excel export), Settings (with Base Setup, Templates, and Default PDF Email), User Management (with delete cascade), Activity Log (manual entries, edit/delete, columnar display), All Inspections hub, Email PDF (all 10 export pages), More hub

**Placeholder modules**: Sync & Data

**Dead API routes**: `/api/weather` (stub), `/api/airfield-status` (no callers)

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.

## Reference Documents

- [`docs/Glidepath_SRS_v3.0.md`](./docs/Glidepath_SRS_v3.0.md) — Software Requirements Specification
- [`docs/BASE-ONBOARDING.md`](./docs/BASE-ONBOARDING.md) — Guide for adding new installations
- [`docs/GLIDEPATH_CAPABILITIES_BRIEF.md`](./docs/GLIDEPATH_CAPABILITIES_BRIEF.md) — Capabilities brief
- [`docs/GLIDEPATH_BETA_TESTER_OVERVIEW.md`](./docs/GLIDEPATH_BETA_TESTER_OVERVIEW.md) — Beta tester overview
- [`docs/Glidepath_AFWERX_Spark_Proposal.md`](./docs/Glidepath_AFWERX_Spark_Proposal.md) — AFWERX Spark proposal
- [`docs/RLS_TEST_CHECKLIST.md`](./docs/RLS_TEST_CHECKLIST.md) — Row-Level Security test results
- [`docs/Airfield_Inspection_Checklist_Template.md`](./docs/Airfield_Inspection_Checklist_Template.md) — ACSI checklist reference (DAFMAN 13-204v2)
