# Airfield OPS Management Suite

Mobile-first web application for managing airfield operations across U.S. military installations. Covers discrepancy tracking, airfield checks, daily inspections, NOTAMs, obstruction evaluations, operational reporting, a regulatory reference library, an aircraft database, and a real-time operational dashboard. Built for multi-base deployment with per-installation data isolation.

**Version:** 2.6.0 | **Build:** Clean | **41 routes** | **130+ source files** | **49 migrations**

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14.2.35 |
| Language | TypeScript (strict mode) | 5.9.3 |
| Styling | Tailwind CSS — light/dark/auto theme | 3.4.19 |
| Backend | Supabase (PostgreSQL, Auth, Storage) | SSR 0.8.0 |
| Maps | Mapbox GL JS | 3.18.1 |
| PDF Viewing | react-pdf (PDF.js) | 10.3.0 |
| PDF Export | jsPDF + jspdf-autotable | 4.1.0 |
| Excel Export | SheetJS (xlsx) | 0.18.5 |
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
```

### Database Setup

Apply the schema and migrations to a Supabase project:

1. Run `supabase/schema.sql` to create the base tables and sequences
2. Apply the 49 migrations in order from `supabase/migrations/`

See [BASE-ONBOARDING.md](./BASE-ONBOARDING.md) for adding new installations.

## Modules

### Dashboard (`/`)
Real-time operational hub. Live clock, Open-Meteo weather with conditions/wind/visibility, advisory system (INFO/CAUTION/WARNING), Active Runway toggle with Open/Suspended/Closed status (color-coded card, persisted to DB with audit log), Current Status panel (RSC, BWC, Last Check), side-by-side NAVAID status panels with G/Y/R toggles and notes, quick actions (Begin Inspection, Begin Check, New Discrepancy), user presence tracking, and expandable activity feed.

### Discrepancies (`/discrepancies`)
Track and resolve airfield issues. 11 discrepancy types (FOD, pavement, lighting, markings, signage, drainage, vegetation, wildlife, equipment, security, other). Full lifecycle: Open → Submitted to AFM → Submitted to CES → Work Completed → Closed/Cancelled. Photo uploads, Mapbox location pinning, notes history with timestamps, work order tracking, linked NOTAMs.

### Airfield Checks (`/checks`)
7 check types in a single unified form:
- **FOD Walk** — route, items found, clear/not-clear
- **RSC Check** — contaminant type/depth/coverage, braking action, treatment
- **RCR Check** — Mu readings (rollout/midpoint/departure), equipment, temperature
- **IFE** — in-flight emergency response
- **Ground Emergency** — 12-item AM action checklist, 9 agency notifications
- **Heavy Aircraft** — aircraft type, parking, weight, taxi route
- **BASH** — condition code, species, mitigation, habitat attractants

Photo capture, map location, issue-found gating, follow-up remarks. Full history with type filtering and search.

### Daily Inspections (`/inspections`)
Combined Airfield Inspection Report with two halves:
- **Airfield** — configurable sections and checklist items (per-base templates)
- **Lighting** — configurable sections and checklist items (per-base templates)

Three-state toggle (Pass/Fail/N/A), Mark All Pass per section, BWC integration (LOW/MOD/SEV/PROHIB), draft persistence to localStorage, two-step Complete/File workflow with per-user tracking, combined PDF export. Also supports standalone Construction Meeting and Joint Monthly inspection forms with personnel attendance tracking.

### Reports (`/reports`)
Four report types with PDF export:
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

### Aircraft Database (`/aircraft`)
1,000+ military and civilian aircraft reference entries. Search by name, type, manufacturer, or branch. Sort by weight, wingspan, or ACN values. Favorites system. ACN/PCN comparison panel for pavement loading analysis.

### References (`/regulations`)
Comprehensive regulatory reference library with two tabs:

**References tab** — 70 regulation entries from DAFMAN 13-204 Vols 1–3 and UFC 3-260-01. Full-text search, category/pub-type filters, favorites with localStorage persistence. In-app PDF viewer with pinch-to-zoom. Offline caching via IndexedDB with "Cache All" bulk download. Admin controls for adding/deleting references with PDF upload.

**My Documents tab** — Upload personal PDFs, JPGs, and PNGs. Client-side text extraction for search. Per-document offline caching. Supabase Storage integration.

### Waivers (`/waivers`)
Full airfield waiver lifecycle management modeled after AF Form 505 and the AFCEC Playbook Appendix B. Six classification types (permanent, temporary, construction, event, extension, amendment), seven status values with mandatory comment dialogs for status transitions. Waiver detail pages include criteria & standards references, coordination tracking by office, photo attachments with camera capture, and annual review history. Individual waiver PDF export with embedded photos. Excel export of the full waiver register with criteria and coordination sheets. Annual review mode (`/waivers/annual-review`) with year-by-year review forms, KPIs, and board presentation tracking. Seeded with 17 real Selfridge ANGB (KMTC) historical waivers.

### NOTAMs (`/notams`)
Live FAA NOTAM feed via `notams.aim.faa.gov` — no API key required. Auto-fetches NOTAMs for the current installation's ICAO code on page load. ICAO search input for querying any airport. Full NOTAM text displayed on each card in monospace. Feed status indicator, refresh button, loading/error states. Filter chips (All/FAA/LOCAL/Active/Expired). Falls back to demo data when Supabase is not configured. Draft creation for local NOTAMs.

### Settings (`/settings`)
Collapsible dropdown sections — Profile and About default open, all others collapsed.
- **Profile** — read-only display of user info, rank, role, primary base
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
Full audit trail with date-range filtering (Today, 7 Days, 30 Days, Custom). Entries grouped by date with color-coded action dots. Clickable items link to source entity (discrepancy, check, inspection). Excel export with styled formatting.

### More Menu (`/more`)
Module directory linking to all features. Profile section always expanded at top showing name, email, installation, and role. All modules visible as a flat list.

## Project Structure

```
airfield-app/
├── app/
│   ├── layout.tsx                        # Root layout (metadata, PWA manifest, toasts)
│   ├── globals.css                       # Light/dark theme CSS custom properties
│   ├── login/page.tsx                    # Auth page (email/password + demo bypass)
│   ├── api/
│   │   ├── weather/route.ts             # Weather API (stub — SRS §11.2)
│   │   ├── notams/sync/route.ts         # FAA NOTAM Search proxy (live)
│   │   ├── airfield-status/route.ts     # Airfield status GET/PATCH
│   │   ├── installations/route.ts       # Installation management POST/DELETE
│   │   └── admin/                        # Admin API routes (service role)
│   │       ├── invite/route.ts          # User invitation
│   │       ├── reset-password/route.ts  # Password reset email
│   │       └── users/[id]/route.ts      # Profile update + user deletion
│   ├── auth/confirm/route.ts            # OTP/PKCE token exchange for email links
│   ├── reset-password/page.tsx          # Password reset form
│   ├── setup-account/page.tsx           # Invited user account setup
│   └── (app)/                            # Authenticated app shell
│       ├── layout.tsx                    # Header + bottom nav, 480px max-width
│       ├── page.tsx                      # Dashboard
│       ├── checks/                       # Check form, history, detail
│       ├── discrepancies/                # List, create, detail
│       ├── inspections/                  # Workspace + history, detail
│       ├── notams/                       # List, create, detail
│       ├── obstructions/                 # Evaluation, history, detail
│       ├── regulations/page.tsx          # Reference library + My Documents
│       ├── library/page.tsx              # Admin PDF library management
│       ├── aircraft/page.tsx             # Aircraft database with ACN/PCN
│       ├── reports/                      # Hub + 4 report pages (daily, discrepancies, trends, aging)
│       ├── settings/                     # Hub + base-setup + templates
│       ├── waivers/                       # List, create, detail, edit, annual review
│       ├── more/page.tsx                 # Module directory
│       ├── sync/page.tsx                 # Coming soon
│       └── users/page.tsx                # User Management (admin)
├── components/
│   ├── admin/                            # User management components
│   │   ├── role-badge.tsx               # Color-coded role badge
│   │   ├── status-badge.tsx             # Color-coded status badge
│   │   ├── user-card.tsx                # User card with badges
│   │   ├── user-list.tsx                # Scrollable card list
│   │   ├── user-filters.tsx             # Search + filter dropdowns
│   │   ├── user-detail-modal.tsx        # Edit profile slide-up modal
│   │   ├── invite-user-modal.tsx        # Invite user form modal
│   │   ├── installation-selector.tsx    # Base dropdown selector
│   │   └── delete-confirmation-dialog.tsx  # Type-to-confirm delete
│   ├── layout/                           # Header, bottom-nav, page-header
│   ├── discrepancies/                    # Cards, badges, map, modals
│   ├── obstructions/                     # Airfield map with surface overlays
│   ├── RegulationPDFViewer.tsx          # In-app PDF viewer with zoom/touch
│   ├── PDFLibrary.jsx                   # Admin PDF library component
│   └── ui/                               # Badge, button, card, input, skeleton
├── lib/
│   ├── constants.ts                      # Checklists, types, regulation categories
│   ├── base-directory.ts                # 155 military installations with ICAO codes
│   ├── aircraft-data.ts                 # 1,000+ aircraft reference entries
│   ├── validators.ts                     # Zod schemas for all forms
│   ├── utils.ts                          # Class merge, relative time, display IDs
│   ├── demo-data.ts                      # Offline mock data
│   ├── weather.ts                        # Open-Meteo weather fetching
│   ├── inspection-draft.ts              # localStorage draft persistence
│   ├── pdf-export.ts                     # jsPDF report generation
│   ├── waiver-pdf.ts                    # Individual waiver PDF export
│   ├── waiver-export.ts                 # Waiver register Excel export (SheetJS)
│   ├── regulations-data.ts              # 70 regulation entries (static seed data)
│   ├── idb.ts                            # Shared IndexedDB helpers (6 stores)
│   ├── pdfTextCache.ts                  # PDF text search cache (offline/server hybrid)
│   ├── userDocuments.ts                 # User document upload/cache/search service
│   ├── calculations/                     # UFC 3-260-01 geometry + obstruction analysis
│   │   ├── obstructions.ts             # Multi-runway surface evaluation engine
│   │   ├── surface-criteria.ts          # Class B and Army_B surface dimensions
│   │   └── geometry.ts                  # Geodesic math and polygon generation
│   ├── admin/                             # User management server utilities
│   │   ├── role-checks.ts              # isSysAdmin, isBaseAdmin, isAdmin, permission guards
│   │   └── user-management.ts          # Client-side API wrappers for admin routes
│   └── supabase/                         # Client, server, types, CRUD modules
│       ├── types.ts                     # Full TypeScript types for all tables
│       ├── client.ts / server.ts        # Browser and SSR Supabase clients
│       ├── discrepancies.ts             # CRUD + KPI queries + photos
│       ├── checks.ts                    # CRUD + photos + comments
│       ├── inspections.ts               # CRUD for inspections
│       ├── inspection-templates.ts      # Template CRUD for base config
│       ├── obstructions.ts              # Obstruction evaluation CRUD + photos
│       ├── navaids.ts                   # NAVAID status read/update
│       ├── waivers.ts                   # Waiver CRUD, reviews, coordination, attachments
│       ├── regulations.ts              # Regulation CRUD + search
│       └── activity.ts                  # Activity log write
├── supabase/
│   ├── schema.sql                        # Full database schema
│   ├── migrations/                       # 49 migration files
│   └── functions/                        # Edge functions (PDF text extraction)
├── middleware.ts                          # Auth guard + demo mode bypass
├── public/
│   ├── manifest.json                    # PWA manifest
│   └── pdf.worker.min.mjs              # PDF.js worker for react-pdf
└── docs/                                 # Integration guides, reference scripts
```

## Database

**25+ tables** across the Supabase PostgreSQL database:

| Table | Purpose |
|-------|---------|
| `profiles` | User accounts, roles, rank, shop, primary base, presence |
| `bases` | Installation definitions (name, ICAO, location) |
| `base_runways` | Runway geometry per base (ends, heading, class, dimensions) |
| `base_navaids` | Navigation aids per base |
| `base_areas` | Airfield areas per base |
| `base_ce_shops` | Civil Engineering shops per base |
| `base_members` | User ↔ base membership join table |
| `discrepancies` | Airfield issues with full lifecycle tracking |
| `airfield_checks` | 7 check types with JSONB data |
| `check_comments` | Remarks timeline for checks |
| `inspections` | Daily inspections (Airfield + Lighting) |
| `inspection_template_sections` | Per-base inspection template sections |
| `inspection_template_items` | Per-base inspection checklist items |
| `notams` | FAA and LOCAL NOTAM tracking |
| `photos` | Photos for discrepancies, checks, inspections, evaluations |
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
3. **Mobile-First** — 480px max-width layout, bottom navigation, 44px+ touch targets. Designed for iPad/phone use in the field.
4. **Theme System** — Light/Dark/Auto modes via CSS custom properties. Auto follows `prefers-color-scheme`.
5. **Configurable Templates** — Inspection checklists are stored in the database per base, not hardcoded. New bases clone from a default template.
6. **Client-Side PDF** — jsPDF generates reports in the browser. Server-side email delivery planned for a future phase.
7. **RLS Partially Enabled** — RLS policies active on `storage.objects` for the `photos` bucket. Role-based write restrictions enforced at application layer (API routes + UI). Full database-level role enforcement planned for production hardening.
8. **Hybrid Offline** — IndexedDB caches PDF blobs, extracted text, and demo-mode airfield diagrams. PWA service worker caches app shell. Full offline reference viewing supported. Airfield diagrams stored in Supabase Storage for cross-device access.
9. **Admin-Gated CRUD** — Base configuration and reference management require `airfield_manager` or `sys_admin` role.
10. **Three-Tier Admin Hierarchy** — `sys_admin` has full access; `base_admin`, `airfield_manager`, and `namo` have base-scoped admin capabilities; all other roles are standard users.

## Current Status

**Build**: TypeScript compiles clean (`tsc --noEmit` passes with zero errors)

**Complete modules**: Dashboard, Discrepancies, Airfield Checks, Daily Inspections, NOTAMs (live FAA feed), Obstruction Evaluations, References (with My Documents), Reports (4 types), Aircraft Database, Waivers (full lifecycle with annual review, PDF/Excel export), Settings (with Base Setup and Templates), User Management (invite, edit, reset password, roles), More hub

**Placeholder modules** (coming soon pages): Sync & Data

**API stubs** (not yet implemented): Weather METAR (`/api/weather`)

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.

## Reference Documents

- `SRS.md` — Software Requirements Specification (1,291 lines, the definitive blueprint)
- `BASE-ONBOARDING.md` — Guide for adding new installations
- `SCALING-ASSESSMENT.md` — Multi-base architecture assessment
- `PROJECT_STATUS.md` — Architecture details and tech debt audit
- `docs/INTEGRATION_GUIDE.md` — PDF text search integration architecture
