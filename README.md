# Airfield OPS Management Suite

Mobile-first web application for managing airfield operations at **Selfridge Air National Guard Base (KMTC)**, 127th Wing, Michigan ANG. Covers discrepancy tracking, airfield checks, daily inspections, NOTAMs, obstruction evaluations, a regulatory reference library, and a real-time operational dashboard.

**Version:** 2.0.0 | **Build:** Clean | **268 commits** | **29 routes** | **~75 source files**

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14.2.35 |
| Language | TypeScript (strict mode) | 5.9.3 |
| Styling | Tailwind CSS — custom dark theme | 3.4.19 |
| Backend | Supabase (PostgreSQL, Auth, Storage) | SSR 0.8.0 |
| Maps | Mapbox GL JS | 3.18.1 |
| PDF Viewing | react-pdf (PDF.js) | — |
| PDF Export | jsPDF | 4.1.0 |
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
2. Apply the 20 migrations in order from `supabase/migrations/`

## Modules

### Dashboard (`/`)
Real-time operational hub. Live clock, Open-Meteo weather with conditions/wind/visibility, advisory system (INFO/CAUTION/WARNING), Active Runway toggle (01/19 with Open/Suspended/Closed), Current Status panel (RSC, BWC, Last Check), side-by-side NAVAID status for RWY 01 and RWY 19 with G/Y/R toggles and notes, quick actions (Begin Inspection, Begin Check, New Discrepancy), user presence tracking, and expandable activity feed from `activity_log`.

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
- **Airfield** — 9 sections, 42 checklist items (obstacles, signs, construction, habitat, pavement, driving, FOD, construction meeting, joint monthly)
- **Lighting** — 5 sections, 32 checklist items (PAPI, approach lights, runway lights, taxiway lights, airfield lighting systems)

Three-state toggle (Pass/Fail/N/A), Mark All Pass per section, BWC integration (LOW/MOD/SEV/PROHIB), draft persistence to localStorage, review step before filing. Combined PDF export. Also supports standalone Construction Meeting and Joint Monthly inspection forms with personnel attendance tracking.

### References (`/regulations`)
Comprehensive regulatory reference library with two tabs:

**References tab** — 70 regulation entries (3 Core + 27 Direct + 27 Cross-Refs + 13 Scrubbed) from DAFMAN 13-204 Vols 1–3 and UFC 3-260-01. Full-text search, category/pub-type filters, favorites with localStorage persistence. In-app PDF viewer with pinch-to-zoom. Offline caching via IndexedDB with "Cache All" bulk download. Admin controls for adding/deleting references with PDF upload.

**My Documents tab** — Upload personal PDFs, JPGs, and PNGs. Client-side text extraction for search. Per-document offline caching. Supabase Storage integration.

### NOTAMs (`/notams`)
FAA and LOCAL NOTAM management. List with source/status filtering, detail view, draft creation for local NOTAMs. FAA sync API stubbed for future NASA DIP integration.

### Obstruction Evaluations (`/obstructions`)
UFC 3-260-01 Class B imaginary surface analysis:
- Primary Surface (0 ft clearance)
- Approach-Departure (50:1 slope)
- Transitional (7:1 slope)
- Inner Horizontal (150 ft, 13,120 ft radius)
- Conical (20:1 slope, 7,000 ft extent)
- Outer Horizontal (500 ft, 42,250 ft radius)

Interactive Mapbox map with color-coded surface overlays. Click to evaluate any point. Geodesic calculations (Haversine distance, cross-track/along-track), Open-Elevation API for MSL heights. Multiple photos per evaluation. Violation detection with UFC table references.

### More Menu (`/more`)
Module directory linking to all features. Includes coming-soon placeholder pages for: Aircraft, Waivers, Reports, Settings, Users & Security, Sync & Data.

## Project Structure

```
airfield-app/
├── app/
│   ├── layout.tsx                        # Root layout (metadata, PWA manifest, toasts)
│   ├── globals.css                       # Dark theme global styles
│   ├── login/page.tsx                    # Auth page (email/password + demo bypass)
│   ├── api/
│   │   ├── weather/route.ts             # Weather API stub
│   │   └── notams/sync/route.ts         # NOTAM sync API stub
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
│       ├── more/page.tsx                 # Module directory
│       ├── aircraft/page.tsx             # Coming soon
│       ├── reports/page.tsx              # Coming soon
│       ├── settings/page.tsx             # Coming soon
│       ├── sync/page.tsx                 # Coming soon
│       ├── users/page.tsx                # Coming soon
│       └── waivers/page.tsx              # Coming soon
├── components/
│   ├── layout/                           # Header, bottom-nav, page-header
│   ├── discrepancies/                    # Cards, badges, map, modals
│   ├── obstructions/                     # Airfield map with surface overlays
│   ├── RegulationPDFViewer.tsx          # In-app PDF viewer with zoom/touch
│   ├── PDFLibrary.jsx                   # Admin PDF library component
│   └── ui/                               # Badge, button, card, input, skeleton
├── lib/
│   ├── constants.ts                      # Installation config, checklists, types, regulation categories
│   ├── validators.ts                     # Zod schemas for all forms
│   ├── utils.ts                          # Class merge, relative time, display IDs
│   ├── demo-data.ts                      # Offline mock data (6 discrepancies, 4 NOTAMs, 7 checks, 3 inspections)
│   ├── weather.ts                        # Open-Meteo weather fetching
│   ├── inspection-draft.ts              # localStorage draft persistence
│   ├── pdf-export.ts                     # jsPDF report generation (single, combined, special)
│   ├── regulations-data.ts              # 70 regulation entries (static seed data)
│   ├── idb.ts                            # Shared IndexedDB helpers (6 stores)
│   ├── pdfTextCache.ts                  # PDF text search cache (offline/server hybrid)
│   ├── userDocuments.ts                 # User document upload/cache/search service
│   ├── calculations/                     # UFC 3-260-01 geometry + obstruction analysis
│   └── supabase/                         # Client, server, types, CRUD modules
│       ├── types.ts                     # Full TypeScript types for all tables
│       ├── client.ts / server.ts        # Browser and SSR Supabase clients
│       ├── discrepancies.ts             # CRUD + KPI queries + photos
│       ├── checks.ts                    # CRUD + photos + comments
│       ├── inspections.ts               # CRUD for inspections
│       ├── obstructions.ts              # Obstruction evaluation CRUD + photos
│       ├── navaids.ts                   # NAVAID status read/update
│       ├── regulations.ts              # Regulation CRUD + search
│       └── activity.ts                  # Activity log write
├── supabase/
│   ├── schema.sql                        # Full database schema
│   ├── migrations/                       # 20 migration files
│   └── functions/                        # Edge functions (PDF text extraction)
├── middleware.ts                          # Auth guard + demo mode bypass
├── public/
│   ├── manifest.json                    # PWA manifest
│   └── pdf.worker.min.mjs              # PDF.js worker for react-pdf
└── Documentation/
    ├── SRS.md                           # Software Requirements Specification (1,291 lines)
    └── AOMS_Regulation_Database_v4.docx # Regulation catalog source document
```

## Database

**14 tables** across the Supabase PostgreSQL database:

| Table | Purpose |
|-------|---------|
| `profiles` | User accounts, roles, rank, shop, presence |
| `discrepancies` | Airfield issues with full lifecycle tracking |
| `airfield_checks` | 7 check types with JSONB data |
| `check_comments` | Remarks timeline for checks |
| `inspections` | Daily inspections (Airfield + Lighting) |
| `notams` | FAA and LOCAL NOTAM tracking |
| `photos` | Photos for discrepancies, checks, evaluations |
| `obstruction_evaluations` | UFC 3-260-01 surface analysis |
| `activity_log` | Audit trail for all mutations |
| `navaid_statuses` | G/Y/R status for approach systems |
| `regulations` | 70 regulatory references with metadata |
| `user_documents` | User-uploaded personal document metadata |
| `user_document_pages` | Extracted text per page for search |
| `pdf_text_pages` | Server-side PDF text for full-text search |

## Key Design Decisions

1. **Demo Mode** — App runs fully offline with mock data when Supabase env vars are missing. No setup required for development or demos.
2. **Mobile-First** — 480px max-width layout, bottom navigation, 44px+ touch targets. Designed for iPad/phone use in the field.
3. **Dual Inspection System** — Airfield and Lighting are separate inspection types with distinct checklists, combined into a single daily report via `daily_group_id`.
4. **Single-Runway Config** — Hardcoded for Selfridge ANGB Runway 01/19 (9,000 x 150 ft). Multi-runway would require refactoring `lib/constants.ts`.
5. **Client-Side PDF** — jsPDF generates reports in the browser. Server-side email delivery planned for a future phase.
6. **RLS Disabled for MVP** — Row-Level Security policies removed during development. Must be re-enabled with role-based access before production.
7. **Hybrid Offline** — IndexedDB caches PDF blobs and extracted text. PWA service worker caches app shell. Full offline reference viewing supported.
8. **Admin-Gated CRUD** — Reference add/delete requires `sys_admin` role. Demo mode grants admin access.

## Current Status

**Build**: Compiles and runs cleanly — `next build` zero errors

**Complete modules**: Dashboard, Discrepancies, Airfield Checks, Daily Inspections, NOTAMs, Obstruction Evaluations, References (with My Documents), More hub

**Placeholder modules** (coming soon pages): Aircraft, Reports, Settings, Sync & Data, Users & Security, Waivers

**API stubs** (not yet implemented): NOTAM sync (`/api/notams/sync`), Weather METAR (`/api/weather`)

**Known tech debt**: See [PROJECT_STATUS.md](./PROJECT_STATUS.md) for the full audit

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.

## Reference Documents

- `Documentation/SRS.md` — Software Requirements Specification (1,291 lines, the definitive blueprint)
- `Airfield_OPS_Unified_Prototype.jsx` — Interactive React prototype used as visual design reference
- `PROJECT_STATUS.md` — Architecture details, tech debt audit, and open questions
- `Documentation/AOMS_Regulation_Database_v4.docx` — Source document for the regulation database
