# Airfield OPS Management Suite

Mobile-first web application for managing airfield operations at **Selfridge Air National Guard Base (KMTC)**, 127th Wing, Michigan ANG. Covers discrepancy tracking, airfield checks, daily inspections, NOTAMs, obstruction evaluations, and a real-time operational dashboard.

**Version:** 1.0.0 | **Build:** Clean | **154 commits** | **24 routes** | **~65 source files**

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14.2.35 |
| Language | TypeScript (strict mode) | 5.9.3 |
| Styling | Tailwind CSS — custom dark theme | 3.4.19 |
| Backend | Supabase (PostgreSQL, Auth, Storage) | SSR 0.8.0 |
| Maps | Mapbox GL JS | 3.18.1 |
| Validation | Zod | 3.25.76 |
| PDF Export | jsPDF | 4.1.0 |
| Icons | Lucide React | 0.563.0 |
| Toasts | Sonner | 1.7.4 |

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
NEXT_PUBLIC_MAPBOX_TOKEN=[mapbox-token]
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Database Setup

Apply the schema and migrations to a Supabase project:

1. Run `supabase/schema.sql` to create all 11 tables and sequences
2. Apply the 7 migrations in order from `supabase/migrations/`

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
Module directory linking to all features. Includes coming-soon placeholder pages for: Aircraft, Regulations, Waivers, Reports, Settings, Users & Security, Sync & Data.

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
│       ├── aircraft/page.tsx             # Coming soon
│       ├── checks/                       # Check form, history, detail
│       ├── discrepancies/                # List, create, detail
│       ├── inspections/                  # Workspace + history, detail
│       ├── more/page.tsx                 # Module directory
│       ├── notams/                       # List, create, detail
│       ├── obstructions/                 # Evaluation, history, detail
│       ├── regulations/page.tsx          # Coming soon
│       ├── reports/page.tsx              # Coming soon
│       ├── settings/page.tsx             # Coming soon
│       ├── sync/page.tsx                 # Coming soon
│       ├── users/page.tsx                # Coming soon
│       └── waivers/page.tsx              # Coming soon
├── components/
│   ├── layout/                           # Header, bottom-nav, page-header
│   ├── discrepancies/                    # Cards, badges, map, modals
│   ├── obstructions/                     # Airfield map with surface overlays
│   └── ui/                               # Badge, button, card, input, skeleton
├── lib/
│   ├── constants.ts                      # Installation config, checklists, types
│   ├── validators.ts                     # Zod schemas for all forms
│   ├── utils.ts                          # Class merge, relative time, display IDs
│   ├── demo-data.ts                      # Offline mock data (6 discrepancies, 4 NOTAMs, 7 checks, 3 inspections)
│   ├── weather.ts                        # Open-Meteo weather fetching
│   ├── inspection-draft.ts              # localStorage draft persistence
│   ├── pdf-export.ts                     # jsPDF report generation (single, combined, special)
│   ├── calculations/                     # UFC 3-260-01 geometry + obstruction analysis
│   └── supabase/                         # Client, server, types, CRUD modules
├── supabase/
│   ├── schema.sql                        # Full database schema (11 tables, 5 sequences)
│   └── migrations/                       # 7 migration files
├── middleware.ts                          # Auth guard + demo mode bypass
└── public/manifest.json                  # PWA manifest
```

## Key Design Decisions

1. **Demo Mode** — App runs fully offline with mock data when Supabase env vars are missing. No setup required for development or demos.
2. **Mobile-First** — 480px max-width layout, bottom navigation, 44px+ touch targets. Designed for iPad/phone use in the field.
3. **Dual Inspection System** — Airfield and Lighting are separate inspection types with distinct checklists, combined into a single daily report via `daily_group_id`.
4. **Single-Runway Config** — Hardcoded for Selfridge ANGB Runway 01/19 (9,000 x 150 ft). Multi-runway would require refactoring `lib/constants.ts`.
5. **Client-Side PDF** — jsPDF generates reports in the browser. Server-side email delivery planned for a future phase.
6. **RLS Disabled for MVP** — Row-Level Security policies removed during development. Must be re-enabled with role-based access before production.
7. **7 Check Types in One Page** — FOD, RSC, RCR, IFE, Ground Emergency, Heavy Aircraft, BASH — type-specific form fields revealed by selection.

## Current Status

**Build**: Compiles and runs cleanly — `next build` zero errors, `tsc --noEmit` zero errors

**TypeScript**: Zero type errors

**Complete modules**: Dashboard, Discrepancies, Airfield Checks, Daily Inspections, NOTAMs, Obstruction Evaluations, More hub

**Placeholder modules** (coming soon pages): Aircraft, Regulations, Reports, Settings, Sync & Data, Users & Security, Waivers

**API stubs** (not yet implemented): NOTAM sync (`/api/notams/sync`), Weather METAR (`/api/weather`)

**Known tech debt**: See [PROJECT_STATUS.md](./PROJECT_STATUS.md) for the full audit

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.

## Reference Documents

- `SRS.md` — Software Requirements Specification (1,291 lines, the definitive blueprint)
- `Airfield_OPS_Unified_Prototype.jsx` — Interactive React prototype used as visual design reference
- `PROJECT_STATUS.md` — Architecture details, tech debt audit, and open questions
