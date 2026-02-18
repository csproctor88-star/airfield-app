# Airfield OPS Management Suite

Mobile-first web application for managing airfield operations at **Selfridge Air National Guard Base (KMTC)**, 127th Wing, Michigan ANG. Covers discrepancy tracking, airfield checks, daily inspections, NOTAMs, and UFC 3-260-01 obstruction evaluations.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 3.4 — custom dark theme |
| Backend | Supabase (PostgreSQL, Auth, Storage) |
| Maps | Mapbox GL JS 3.18 |
| Charts | Recharts 2.15 |
| Validation | Zod 3.25 |
| PDF Export | jsPDF 2.5 |
| Icons | Lucide React |

## Getting Started

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Start development server
npm run dev
```

The app runs at `http://localhost:3000`. If Supabase credentials are missing or contain placeholders, the app runs in **demo mode** with offline mock data.

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
NEXT_PUBLIC_MAPBOX_TOKEN=[mapbox-token]
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Database Setup

Apply the schema and migrations to a Supabase project:

1. Run `supabase/schema.sql` to create all tables and sequences
2. Apply migrations in order from `supabase/migrations/`

## Modules

### Dashboard (`/`)
Live clock, weather, KPI tiles (open discrepancies, critical items, active NOTAMs), quick-action grid, today's status cards.

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

## Project Structure

```
airfield-app/
├── app/
│   ├── layout.tsx                      # Root layout (metadata, toasts)
│   ├── login/page.tsx                  # Auth page
│   ├── (app)/
│   │   ├── layout.tsx                  # App shell (header + bottom nav)
│   │   ├── page.tsx                    # Dashboard
│   │   ├── checks/                     # Check form, history, detail
│   │   ├── discrepancies/              # List, create, detail
│   │   ├── inspections/                # Workspace, detail
│   │   ├── notams/                     # List, create, detail
│   │   ├── obstructions/               # Evaluation, history, detail
│   │   └── more/page.tsx               # Settings hub
│   └── api/                            # Weather + NOTAM sync stubs
├── components/
│   ├── layout/                         # Header, bottom-nav, page-header
│   ├── discrepancies/                  # Cards, badges, map, modals
│   ├── obstructions/                   # Airfield map with surface overlays
│   └── ui/                             # Badge, button, card, input, skeleton
├── lib/
│   ├── constants.ts                    # Installation config, checklists, types
│   ├── validators.ts                   # Zod schemas
│   ├── utils.ts                        # Class merge, relative time, display IDs
│   ├── demo-data.ts                    # Offline mock data
│   ├── weather.ts                      # Open-Meteo weather fetching
│   ├── inspection-draft.ts             # localStorage draft persistence
│   ├── pdf-export.ts                   # jsPDF report generation
│   ├── calculations/                   # Part 77 geometry + obstruction analysis
│   └── supabase/                       # Client, types, CRUD modules
├── supabase/
│   ├── schema.sql                      # Full database schema (11 tables)
│   └── migrations/                     # 5 migration files
├── middleware.ts                        # Auth guard + demo mode bypass
└── public/manifest.json                # PWA manifest
```

## Key Design Decisions

1. **Demo Mode** — App runs fully offline with mock data when Supabase env vars are missing. No setup required for development or demos.
2. **Mobile-First** — 480px max-width layout, bottom navigation, 44px+ touch targets. Designed for iPad/phone use in the field.
3. **Dual Inspection System** — Airfield and Lighting are separate inspection types with distinct checklists, combined into a single daily report.
4. **Single-Runway Config** — Hardcoded for Selfridge ANGB Runway 01/19 (9,000 x 150 ft). Multi-runway would require refactoring `lib/constants.ts`.
5. **Client-Side PDF** — jsPDF generates reports in the browser. Server-side email delivery planned for a future phase.
6. **RLS Disabled for MVP** — Row-Level Security policies removed during development. Must be re-enabled with role-based access before production.

## Current Status

**Build**: Compiles and runs cleanly (`next build` — zero errors, zero warnings)

**Complete modules**: Dashboard, Discrepancies, Airfield Checks, Daily Inspections, NOTAMs, Obstruction Evaluations, More/Settings hub

**API stubs** (not yet implemented): NOTAM sync (`/api/notams/sync`), Weather METAR (`/api/weather`)

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history and [PROJECT_STATUS.md](./PROJECT_STATUS.md) for architectural details and open questions.

## Reference Documents

- `SRS.md` — Software Requirements Specification (1,291 lines, the definitive blueprint)
- `Airfield_OPS_Unified_Prototype.jsx` — Interactive React prototype used as visual design reference
- `Claude_Code_Starter_Prompt.md` — Original AI build instructions
