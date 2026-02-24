# AIRFIELD OPS MANAGEMENT SUITE
## Software Requirements Specification & Implementation Blueprint
### Version 2.0 — February 2026

**Target Platform:** Next.js 14+ Web Application (PWA)
**Stack:** Next.js (App Router) + Tailwind CSS + Supabase + Vercel
**Auth:** Supabase email/password with role-based access control
**Target Installation:** 127th Wing, Selfridge ANGB (KMTC), Michigan
**Primary Governing Regulation:** DAFI 13-213 (Airfield Management)

---

## IMPLEMENTATION INSTRUCTIONS FOR AI CODING AGENT

This document is the definitive specification for building the Airfield OPS Management Suite. It contains every table schema, component definition, business rule, and UI pattern needed to build the complete application. When building, follow these rules:

1. **MVP First**: Items marked `[MVP]` must be built first. Items marked `[FULL]` are built after MVP is functional and tested.
2. **Schema is Authoritative**: The Supabase table definitions in Section 5 are exact. Create these tables with these exact column names, types, and constraints.
3. **UI Patterns are Authoritative**: The component specifications in Section 7 describe exactly what each screen shows. Reference the companion prototype files for visual layout.
4. **Business Rules are Authoritative**: The validation rules, state machines, and calculations in Section 6 must be implemented exactly as specified.
5. **Do Not Invent Features**: Build only what is specified. Do not add fields, screens, or behaviors not described here.

---

## TABLE OF CONTENTS

1. Executive Summary
2. Scope & Stakeholders
3. Technology Stack
4. Functional Requirements
5. Database Schema (Supabase PostgreSQL)
6. Business Logic & Rules
7. UI Components & Screens
8. API Routes (Next.js)
9. Authentication & Authorization
10. PWA & Offline Strategy
11. External Integrations
12. Non-Functional Requirements
13. Development Phases & MVP Definition
14. Selfridge ANGB Configuration Data
15. Appendices

---

## 1. EXECUTIVE SUMMARY

The Airfield OPS Management Suite replaces paper-based checklists, spreadsheets, email chains, and disconnected tracking systems used by USAF airfield managers to comply with DAFI 13-213. The application consolidates six core airfield management functions into a single web application accessible from any device:

1. **Discrepancy Tracking** — Capture, classify, assign, and track airfield deficiencies with photos and GPS
2. **Airfield Checks** — FOD checks, BASH assessments, RCR readings, RSC reports, and emergency response logs
3. **Inspections** — Daily/semi-annual/annual checklists per DAFI 13-213 with pass/fail tracking
4. **NOTAM Management** — View, draft, and manage Notices to Air Missions (FAA and LOCAL)
5. **Obstruction Evaluation** — Calculate imaginary surface violations per UFC 3-260-01
6. **Reporting & Analytics** — KPI dashboards, trend charts, and compliance metrics

### Key Design Principles
- **Mobile-first**: Designed for phone use on the flightline. Large touch targets, minimal typing.
- **PWA**: Installable on home screen, basic offline caching via service worker.
- **Real-time**: Supabase Realtime subscriptions for live data updates across users.
- **Audit trail**: Every data mutation logged with user, timestamp, old value, and new value.

---

## 2. SCOPE & STAKEHOLDERS

### 2.1 User Roles

| Role | Slug | Description | Access |
|------|------|-------------|--------|
| Airfield Manager | `airfield_manager` | Primary user. Full operational authority. | Full CRUD on all modules. User management. System config. |
| AM NCOIC | `am_ncoic` | Senior AM NCO. Acts as AM in absence. | Full CRUD on all operational modules. No user management. |
| AM Technician | `am_tech` | Performs checks, inspections, logs discrepancies. | Create/edit discrepancies, checks, inspections. View reports. |
| CE Shop | `ce_shop` | Receives work orders. Updates status on assigned items. | View/update discrepancies assigned to their shop. View own work orders. |
| Wing Safety | `wing_safety` | Reviews safety trends and obstruction evaluations. | Read-only on all modules. Export reports. |
| ATC / RAPCON | `atc` | Coordinates on airfield status and NOTAMs. | Read-only on discrepancies, NOTAMs, airfield status. |
| Observer | `observer` | Wing leadership, inspectors, visiting personnel. | Read-only dashboard and reports. |
| System Admin | `sys_admin` | Technical administrator. | Full access including user management and system config. |

### 2.2 In Scope (This Build)
- All six modules listed in Executive Summary
- Supabase email/password authentication with RBAC
- PWA with service worker caching
- Custom domain deployment on Vercel
- Photo upload to Supabase Storage
- Browser-based GPS capture
- Real-time data sync via Supabase Realtime

### 2.3 Out of Scope (Future Enhancement)
- CAC/PKI authentication (document path but do not implement)
- NASA DIP API integration for FAA NOTAMs (use manual entry for v1)
- METAR weather API integration (display placeholder, document API endpoint)
- Integration with IMDS, ACES, NexGen IT, or iEMS
- Automated NOTAM filing to FAA
- Multi-installation support (single-base deployment)
- RT3 friction tester direct hardware integration (manual entry for RCR)
- Native mobile app (React Native)

---

## 3. TECHNOLOGY STACK

### 3.1 Required Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "@supabase/supabase-js": "^2.0.0",
    "@supabase/ssr": "^0.1.0",
    "tailwindcss": "^3.4.0",
    "recharts": "^2.10.0",
    "lucide-react": "^0.300.0",
    "date-fns": "^3.0.0",
    "zod": "^3.22.0",
    "sonner": "^1.3.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/react": "^18.0.0",
    "@types/node": "^20.0.0"
  }
}
```

### 3.2 Project Structure

```
airfield-ops/
├── app/
│   ├── layout.tsx                 # Root layout with nav, auth provider
│   ├── page.tsx                   # Home/dashboard
│   ├── login/page.tsx             # Login screen
│   ├── discrepancies/
│   │   ├── page.tsx               # List view with filters
│   │   ├── [id]/page.tsx          # Detail view
│   │   └── new/page.tsx           # Creation form
│   ├── checks/
│   │   ├── page.tsx               # Check list with type filters
│   │   ├── [id]/page.tsx          # Check detail
│   │   ├── fod/page.tsx           # FOD check form
│   │   ├── bash/page.tsx          # BASH assessment form
│   │   ├── rcr/page.tsx           # RCR reading form
│   │   ├── rsc/page.tsx           # RSC report form
│   │   └── emergency/page.tsx     # Emergency response form
│   ├── inspections/
│   │   ├── page.tsx               # Inspection list
│   │   ├── [id]/page.tsx          # Completed inspection detail
│   │   └── new/page.tsx           # Active inspection checklist
│   ├── notams/
│   │   ├── page.tsx               # NOTAM list with filters
│   │   ├── [id]/page.tsx          # NOTAM detail
│   │   └── new/page.tsx           # NOTAM draft form
│   ├── obstructions/
│   │   ├── page.tsx               # Evaluation form + history
│   │   └── [id]/page.tsx          # Evaluation detail/report
│   ├── reports/
│   │   └── page.tsx               # Analytics dashboard
│   ├── settings/
│   │   ├── page.tsx               # Settings menu
│   │   ├── users/page.tsx         # User management (admin)
│   │   └── profile/page.tsx       # User profile
│   └── api/
│       ├── notams/sync/route.ts   # Future: NASA DIP API sync
│       └── weather/route.ts       # Future: METAR fetch
├── components/
│   ├── ui/                        # Reusable UI primitives
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── textarea.tsx
│   │   ├── dialog.tsx
│   │   ├── toast.tsx
│   │   └── loading-skeleton.tsx
│   ├── layout/
│   │   ├── bottom-nav.tsx         # Mobile bottom navigation
│   │   ├── header.tsx             # App header with sync status
│   │   └── page-header.tsx        # Page title + back button
│   ├── discrepancies/
│   │   ├── discrepancy-card.tsx
│   │   ├── discrepancy-form.tsx
│   │   ├── severity-badge.tsx
│   │   ├── status-badge.tsx
│   │   └── photo-gallery.tsx
│   ├── checks/
│   │   ├── check-card.tsx
│   │   ├── fod-form.tsx
│   │   ├── bash-form.tsx
│   │   ├── rcr-form.tsx
│   │   ├── rsc-form.tsx
│   │   └── emergency-form.tsx
│   ├── inspections/
│   │   ├── checklist-item.tsx
│   │   └── progress-ring.tsx
│   ├── notams/
│   │   ├── notam-card.tsx
│   │   └── notam-form.tsx
│   ├── obstructions/
│   │   └── surface-calculator.tsx
│   └── reports/
│       ├── kpi-tile.tsx
│       └── trend-chart.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts              # Browser client
│   │   ├── server.ts              # Server component client
│   │   ├── middleware.ts           # Auth middleware
│   │   └── types.ts               # Generated DB types
│   ├── constants.ts               # App-wide constants
│   ├── utils.ts                   # Helper functions
│   ├── validators.ts              # Zod schemas
│   └── calculations/
│       ├── sla.ts                 # SLA deadline calculator
│       └── obstructions.ts        # UFC 3-260-01 surface math
├── public/
│   ├── manifest.json              # PWA manifest
│   ├── sw.js                      # Service worker
│   └── icons/                     # App icons
├── middleware.ts                   # Next.js auth middleware
├── tailwind.config.ts
├── next.config.js
└── .env.local                     # Supabase keys
```

### 3.3 Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
NEXT_PUBLIC_APP_URL=https://airfieldops.app
```

---

## 4. FUNCTIONAL REQUIREMENTS

### 4.1 Discrepancy Tracking `[MVP]`

| ID | Requirement | Priority |
|----|-------------|----------|
| DIS-001 | Create discrepancy with: type, severity, status, location (text), description, GPS coordinates | Must Have |
| DIS-002 | Auto-generate ID in format `D-YYYY-NNNN` (sequential per year) | Must Have |
| DIS-003 | Capture photos via device camera (`accept="image/*"`) or file upload. Store in Supabase Storage. | Must Have |
| DIS-004 | Auto-capture GPS from browser `navigator.geolocation` with manual override | Must Have |
| DIS-005 | Classify by type from predefined list (see Section 6.1) | Must Have |
| DIS-006 | Assign severity: Critical, High, Medium, Low | Must Have |
| DIS-007 | Assign to responsible shop from configurable list | Must Have |
| DIS-008 | Track lifecycle: Open → Assigned → In Progress → Resolved → Closed | Must Have |
| DIS-009 | Each status change creates audit entry with user, timestamp, notes | Must Have |
| DIS-010 | Auto-calculate SLA deadline from severity (see Section 6.3) | Must Have |
| DIS-011 | Filter/search by status, type, severity, shop, date range | Must Have |
| DIS-012 | Auto-generate work order number `WO-YYYY-NNNN` for Critical/High items | Must Have |
| DIS-013 | Link discrepancy to NOTAM (optional FK) | Should Have |
| DIS-014 | Photo gallery on detail page with thumbnails | Should Have |
| DIS-015 | Overdue badge when past SLA deadline | Must Have |

### 4.2 Airfield Checks `[MVP]`

| ID | Requirement | Priority |
|----|-------------|----------|
| CHK-001 | Support 5 check types: FOD, BASH, RCR, RSC, Emergency Response | Must Have |
| CHK-002 | FOD Check: list of items found (description, location, photo), route completed | Must Have |
| CHK-003 | BASH Assessment: condition code (LOW/MODERATE/SEVERE), species observed (textarea), mitigation actions | Must Have |
| CHK-004 | RCR Reading: Mu values for rollout/mid/departure thirds, equipment used, surface condition notes. Input via manual entry. | Must Have |
| CHK-005 | RSC Report: contaminant type, depth, coverage %, treatment applied | Must Have |
| CHK-006 | Emergency Response: aircraft type, callsign, runway, nature of emergency, 12-item AM action checklist with timestamps, agency notification tracker (9 agencies), duration timer | Must Have |
| CHK-007 | All checks store: type, performed_by, date/time, data (JSON), GPS, photos | Must Have |
| CHK-008 | Check list with type filter tiles showing count per type | Must Have |

### 4.3 Inspections `[MVP]`

| ID | Requirement | Priority |
|----|-------------|----------|
| INS-001 | Daily inspection checklist with items grouped by section (Runway, Taxiway, Approach/Departure, Support) | Must Have |
| INS-002 | Each item: tap to cycle Pass → Fail → N/A (blank default) | Must Have |
| INS-003 | Progress ring showing completion percentage | Must Have |
| INS-004 | Submit button appears when 100% of items have a response | Must Have |
| INS-005 | Failed items auto-generate discrepancy draft (linked via `inspection_id`) | Should Have |
| INS-006 | Store completed inspection with inspector, date, all responses, completion time | Must Have |
| INS-007 | Semi-annual and annual inspection templates | Full |

### 4.4 NOTAM Management `[MVP]`

| ID | Requirement | Priority |
|----|-------------|----------|
| NOT-001 | Display NOTAMs in list with source filter (FAA/LOCAL) and status filter (Active/Expired/Draft) | Must Have |
| NOT-002 | NOTAM detail view with full text, effective dates, source, linked discrepancy | Must Have |
| NOT-003 | Draft LOCAL NOTAMs with: type, title, text, effective start/end dates | Must Have |
| NOT-004 | LOCAL NOTAMs editable/cancellable by AM roles. FAA NOTAMs read-only. | Must Have |
| NOT-005 | Link NOTAM to discrepancy (optional FK) | Should Have |
| NOT-006 | FAA NOTAM sync via NASA DIP API (future — stub the API route, use manual entry for v1) | Full |
| NOT-007 | Last sync timestamp display on NOTAM list header | Full |

### 4.5 Obstruction Evaluation `[FULL]`

| ID | Requirement | Priority |
|----|-------------|----------|
| OBS-001 | Input form: object height (ft AGL), horizontal distance (ft), object elevation (ft MSL, optional), runway class (A/B) | Must Have |
| OBS-002 | Evaluate against all 6 UFC 3-260-01 imaginary surfaces simultaneously | Must Have |
| OBS-003 | Display per-surface result: max allowable height, violation yes/no, penetration depth | Must Have |
| OBS-004 | Class A and Class B dimensional criteria (see Section 6.5) | Must Have |
| OBS-005 | Waiver guidance text when violation detected (AF Form 332, DAFI 13-213 Ch.4) | Must Have |
| OBS-006 | Save evaluation to database with all inputs and results | Should Have |
| OBS-007 | Evaluation history list | Should Have |

### 4.6 Reporting & Analytics `[FULL]`

| ID | Requirement | Priority |
|----|-------------|----------|
| RPT-001 | Dashboard with KPI tiles: open discrepancies, critical count, overdue count, active NOTAMs | Must Have |
| RPT-002 | Discrepancy trend chart (opened vs resolved by month) using Recharts | Should Have |
| RPT-003 | Discrepancy breakdown by type (donut/bar chart) | Should Have |
| RPT-004 | Average resolution time by severity | Should Have |
| RPT-005 | Shop performance metrics (assigned vs resolved) | Should Have |
| RPT-006 | Period selector: 30 days, 90 days, 6 months, 1 year | Should Have |
| RPT-007 | Inspection compliance rate (completed on time vs required) | Full |
| RPT-008 | RCR Mu value trend line | Full |
| RPT-009 | BASH condition breakdown with top species | Full |

### 4.7 Home Screen `[MVP]`

| ID | Requirement | Priority |
|----|-------------|----------|
| HOME-001 | KPI summary tiles linking to each module (open discrepancies, active NOTAMs, overdue items, today's checks) | Must Have |
| HOME-002 | Quick action grid: New Discrepancy, FOD Check, BASH Check, RCR Reading, RSC Report, Emergency, Inspection, Draft NOTAM | Must Have |
| HOME-003 | Critical alerts banner (Critical discrepancies, overdue SLA, MALSR/NAVAID outages) | Must Have |
| HOME-004 | Weather placeholder strip (KMTC — stub for future METAR API) | Should Have |
| HOME-005 | Recent activity feed (last 10 actions across all modules) | Should Have |

---

## 5. DATABASE SCHEMA (Supabase PostgreSQL)

### 5.1 profiles

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  rank TEXT,                              -- e.g., 'MSgt', 'TSgt', 'SrA'
  role TEXT NOT NULL DEFAULT 'observer',  -- matches role slugs in Section 2.1
  organization TEXT,                      -- e.g., '127 WG/AM', '127 CES/CEOH'
  shop TEXT,                              -- e.g., 'Pavements', 'Electrical', 'Airfield Mgmt'
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: Users can read all active profiles. Only sys_admin/airfield_manager can update.
```

### 5.2 discrepancies `[MVP]`

```sql
CREATE TABLE discrepancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id TEXT NOT NULL UNIQUE,        -- 'D-2026-0001' format
  type TEXT NOT NULL,                     -- FK to discrepancy_types or enum
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_progress', 'resolved', 'closed')),
  title TEXT NOT NULL,                    -- Short summary (max 120 chars)
  description TEXT NOT NULL,              -- Detailed description
  location_text TEXT NOT NULL,            -- Human-readable location, e.g. 'TWY A, 500ft south of RWY 01 threshold'
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  assigned_shop TEXT,                     -- e.g., 'CE Electrical', 'CE Pavements'
  assigned_to UUID REFERENCES profiles(id),
  reported_by UUID NOT NULL REFERENCES profiles(id),
  work_order_number TEXT,                 -- 'WO-2026-0001' format, null if not generated
  sla_deadline TIMESTAMPTZ,              -- Calculated from severity
  linked_notam_id UUID REFERENCES notams(id),
  inspection_id UUID REFERENCES inspections(id),  -- If auto-generated from failed inspection item
  resolution_notes TEXT,
  resolution_date TIMESTAMPTZ,
  photo_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_discrepancies_status ON discrepancies(status);
CREATE INDEX idx_discrepancies_severity ON discrepancies(severity);
CREATE INDEX idx_discrepancies_type ON discrepancies(type);
CREATE INDEX idx_discrepancies_assigned_shop ON discrepancies(assigned_shop);
CREATE INDEX idx_discrepancies_created_at ON discrepancies(created_at DESC);
```

### 5.3 photos

```sql
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discrepancy_id UUID REFERENCES discrepancies(id) ON DELETE CASCADE,
  check_id UUID REFERENCES airfield_checks(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,             -- Supabase Storage path
  thumbnail_path TEXT,                    -- Compressed thumbnail path
  file_name TEXT NOT NULL,
  file_size INTEGER,                      -- bytes
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Either discrepancy_id or check_id must be set
  CONSTRAINT photo_parent_check CHECK (
    (discrepancy_id IS NOT NULL AND check_id IS NULL) OR
    (discrepancy_id IS NULL AND check_id IS NOT NULL)
  )
);
```

### 5.4 status_updates (Audit Trail)

```sql
CREATE TABLE status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discrepancy_id UUID NOT NULL REFERENCES discrepancies(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  notes TEXT,
  updated_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_status_updates_discrepancy ON status_updates(discrepancy_id, created_at DESC);
```

### 5.5 airfield_checks `[MVP]`

```sql
CREATE TABLE airfield_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id TEXT NOT NULL UNIQUE,        -- 'CHK-2026-0001'
  check_type TEXT NOT NULL CHECK (check_type IN ('fod', 'bash', 'rcr', 'rsc', 'emergency')),
  performed_by UUID NOT NULL REFERENCES profiles(id),
  check_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  data JSONB NOT NULL DEFAULT '{}',       -- Type-specific data (see Section 6.2)
  notes TEXT,
  photo_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checks_type ON airfield_checks(check_type);
CREATE INDEX idx_checks_date ON airfield_checks(check_date DESC);
```

#### 5.5.1 Check Data JSON Schemas

**FOD Check** (`check_type = 'fod'`):
```json
{
  "route": "string",              // e.g., "RWY 01/19, TWY A, TWY B"
  "items_found": [
    {
      "description": "string",   // e.g., "Metal bolt, approx 3 inches"
      "location": "string",      // e.g., "TWY A, 200ft east of RWY intersection"
      "disposed": true
    }
  ],
  "clear": true                   // true if no FOD found
}
```

**BASH Assessment** (`check_type = 'bash'`):
```json
{
  "condition_code": "string",     // "LOW", "MODERATE", "SEVERE"
  "species_observed": "string",   // Free text, e.g., "Canadian geese (approx 30), starlings"
  "mitigation_actions": "string", // Free text
  "habitat_attractants": "string" // Free text, e.g., "Standing water near TWY C"
}
```

**RCR Reading** (`check_type = 'rcr'`):
```json
{
  "equipment": "string",          // e.g., "Bowmonk", "Mu-Meter", "Dynatest"
  "runway": "string",             // e.g., "01/19"
  "readings": {
    "rollout": "number",          // Mu value 0-100
    "midpoint": "number",
    "departure": "number"
  },
  "surface_condition": "string",  // e.g., "Dry", "Wet", "Ice patches"
  "temperature_f": "number",
  "rt3_imported": false           // Future: true when imported from RT3 file
}
```

**RSC Report** (`check_type = 'rsc'`):
```json
{
  "runway": "string",
  "contaminant": "string",        // e.g., "Snow", "Ice", "Slush", "Water", "Sand"
  "depth_inches": "number",
  "coverage_percent": "number",   // 0-100
  "treatment_applied": "string",  // e.g., "Chemical (potassium acetate)", "Mechanical (plow)"
  "braking_action": "string"      // "Good", "Medium", "Poor", "Nil"
}
```

**Emergency Response** (`check_type = 'emergency'`):
```json
{
  "emergency_type": "string",     // "IFE" (In-Flight Emergency), "Ground", "Drill"
  "aircraft_type": "string",
  "callsign": "string",
  "runway": "string",
  "nature": "string",             // e.g., "Engine failure", "Hydraulic leak"
  "actions": [
    {
      "step": "string",           // e.g., "Notified ATC"
      "completed": true,
      "completed_at": "ISO timestamp"
    }
  ],
  "agencies_notified": [
    {
      "agency": "string",         // e.g., "SOF", "Fire Chief", "Wing Safety"
      "notified": true,
      "notified_at": "ISO timestamp"
    }
  ],
  "start_time": "ISO timestamp",
  "end_time": "ISO timestamp",
  "duration_minutes": "number"
}
```

### 5.6 inspections `[MVP]`

```sql
CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id TEXT NOT NULL UNIQUE,        -- 'INS-2026-0001'
  inspection_type TEXT NOT NULL CHECK (inspection_type IN ('daily', 'semi_annual', 'annual')),
  inspector_id UUID NOT NULL REFERENCES profiles(id),
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  items JSONB NOT NULL DEFAULT '[]',      -- Array of checklist items with responses
  total_items INTEGER NOT NULL DEFAULT 0,
  passed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  na_count INTEGER NOT NULL DEFAULT 0,
  completion_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### 5.6.1 Inspection Items JSON Schema

```json
[
  {
    "id": "rwy-01",
    "section": "Runway",
    "item": "Pavement condition — no FOD, spalling, or settlement",
    "response": null,             // null | "pass" | "fail" | "na"
    "notes": "",
    "photo_id": null,             // Optional linked photo
    "generated_discrepancy_id": null  // If fail → auto-created discrepancy
  }
]
```

### 5.7 notams `[MVP]`

```sql
CREATE TABLE notams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notam_number TEXT NOT NULL,             -- e.g., '01/003' (FAA) or 'L-2026-0001' (LOCAL)
  source TEXT NOT NULL CHECK (source IN ('faa', 'local')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'cancelled', 'expired')),
  notam_type TEXT,                        -- e.g., 'Runway Closure', 'Lighting', 'Construction', 'NAVAID'
  title TEXT NOT NULL,
  full_text TEXT NOT NULL,                -- Full NOTAM text
  effective_start TIMESTAMPTZ NOT NULL,
  effective_end TIMESTAMPTZ,              -- null = until further notice
  linked_discrepancy_id UUID REFERENCES discrepancies(id),
  created_by UUID REFERENCES profiles(id),
  cancelled_by UUID REFERENCES profiles(id),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notams_status ON notams(status);
CREATE INDEX idx_notams_source ON notams(source);
CREATE INDEX idx_notams_effective ON notams(effective_start, effective_end);
```

### 5.8 obstruction_evaluations `[FULL]`

```sql
CREATE TABLE obstruction_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  runway_class TEXT NOT NULL CHECK (runway_class IN ('A', 'B')),
  object_height_agl NUMERIC(10,2) NOT NULL,     -- feet
  object_distance_ft NUMERIC(10,2),              -- horizontal distance from surface edge
  object_elevation_msl NUMERIC(10,2),            -- feet MSL (optional)
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  results JSONB NOT NULL DEFAULT '[]',           -- Per-surface evaluation results
  has_violation BOOLEAN NOT NULL DEFAULT false,
  evaluated_by UUID NOT NULL REFERENCES profiles(id),
  linked_discrepancy_id UUID REFERENCES discrepancies(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 5.9 activity_log

```sql
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,                   -- e.g., 'created_discrepancy', 'completed_inspection'
  entity_type TEXT NOT NULL,              -- e.g., 'discrepancy', 'check', 'inspection', 'notam'
  entity_id UUID NOT NULL,
  entity_display_id TEXT,                 -- e.g., 'D-2026-0001'
  metadata JSONB DEFAULT '{}',           -- Additional context
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);
```

### 5.10 Sequences (for display IDs)

```sql
CREATE SEQUENCE discrepancy_seq START 1;
CREATE SEQUENCE work_order_seq START 1;
CREATE SEQUENCE check_seq START 1;
CREATE SEQUENCE inspection_seq START 1;
CREATE SEQUENCE local_notam_seq START 1;

-- Helper function for generating display IDs
CREATE OR REPLACE FUNCTION generate_display_id(prefix TEXT, seq_name TEXT)
RETURNS TEXT AS $$
DECLARE
  next_val INTEGER;
  current_year TEXT;
BEGIN
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_val;
  current_year := to_char(now(), 'YYYY');
  RETURN prefix || '-' || current_year || '-' || lpad(next_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;
```

### 5.11 Supabase Storage Buckets

```
Bucket: discrepancy-photos
  - Public: false
  - Max file size: 10MB
  - Allowed MIME types: image/jpeg, image/png, image/heic, image/webp
  - Path pattern: {discrepancy_id}/{photo_id}.jpg

Bucket: check-photos
  - Public: false
  - Max file size: 10MB
  - Allowed MIME types: image/jpeg, image/png, image/heic, image/webp
  - Path pattern: {check_id}/{photo_id}.jpg
```

### 5.12 Row Level Security Policies

```sql
-- profiles: everyone reads active profiles, admins write
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active profiles" ON profiles FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage profiles" ON profiles FOR ALL USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('sys_admin', 'airfield_manager'))
);

-- discrepancies: AM roles full CRUD, CE sees assigned, others read
ALTER TABLE discrepancies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AM roles full access" ON discrepancies FOR ALL USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('airfield_manager', 'am_ncoic', 'am_tech', 'sys_admin'))
);
CREATE POLICY "CE sees assigned" ON discrepancies FOR SELECT USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'ce_shop')
  AND assigned_shop = (SELECT shop FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "CE updates assigned" ON discrepancies FOR UPDATE USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'ce_shop')
  AND assigned_shop = (SELECT shop FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "Observers read all" ON discrepancies FOR SELECT USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('wing_safety', 'atc', 'observer'))
);

-- Similar patterns for other tables...
```

---

## 6. BUSINESS LOGIC & RULES

### 6.1 Discrepancy Types

```typescript
export const DISCREPANCY_TYPES = [
  { value: 'fod_hazard', label: 'FOD Hazard', defaultSeverity: 'critical', defaultShop: 'Airfield Mgmt' },
  { value: 'pavement', label: 'Pavement Deficiency', defaultSeverity: 'high', defaultShop: 'CE Pavements' },
  { value: 'lighting', label: 'Lighting Outage/Deficiency', defaultSeverity: 'high', defaultShop: 'CE Electrical' },
  { value: 'marking', label: 'Marking Deficiency', defaultSeverity: 'medium', defaultShop: 'CE Pavements' },
  { value: 'signage', label: 'Signage Deficiency', defaultSeverity: 'medium', defaultShop: 'CE Electrical' },
  { value: 'drainage', label: 'Drainage Issue', defaultSeverity: 'medium', defaultShop: 'CE Structures' },
  { value: 'vegetation', label: 'Vegetation Encroachment', defaultSeverity: 'low', defaultShop: 'CE Grounds' },
  { value: 'wildlife', label: 'Wildlife Hazard', defaultSeverity: 'high', defaultShop: 'Airfield Mgmt' },
  { value: 'obstruction', label: 'Airfield Obstruction', defaultSeverity: 'critical', defaultShop: 'CE / Airfield Mgmt' },
  { value: 'navaid', label: 'NAVAID Deficiency', defaultSeverity: 'critical', defaultShop: 'CE Electrical / FAA' },
  { value: 'other', label: 'Other', defaultSeverity: 'medium', defaultShop: null },
] as const;
```

### 6.2 Severity Colors & Styling

```typescript
export const SEVERITY_CONFIG = {
  critical: { color: '#EF4444', bg: '#FEE2E2', label: 'CRITICAL', textColor: 'text-red-600' },
  high:     { color: '#F97316', bg: '#FED7AA', label: 'HIGH', textColor: 'text-orange-600' },
  medium:   { color: '#EAB308', bg: '#FEF3C7', label: 'MEDIUM', textColor: 'text-yellow-600' },
  low:      { color: '#3B82F6', bg: '#DBEAFE', label: 'LOW', textColor: 'text-blue-600' },
} as const;

export const STATUS_CONFIG = {
  open:        { color: '#EF4444', bg: '#FEE2E2', label: 'Open' },
  assigned:    { color: '#F97316', bg: '#FED7AA', label: 'Assigned' },
  in_progress: { color: '#EAB308', bg: '#FEF3C7', label: 'In Progress' },
  resolved:    { color: '#22C55E', bg: '#DCFCE7', label: 'Resolved' },
  closed:      { color: '#6B7280', bg: '#F3F4F6', label: 'Closed' },
} as const;
```

### 6.3 SLA Deadlines

```typescript
export function calculateSLADeadline(severity: string, createdAt: Date): Date {
  const deadlines = {
    critical: 24,      // 24 hours
    high: 7 * 24,      // 7 days
    medium: 14 * 24,   // 14 days
    low: 30 * 24,      // 30 days
  };
  const hours = deadlines[severity] || 30 * 24;
  return new Date(createdAt.getTime() + hours * 60 * 60 * 1000);
}

export function isOverdue(slaDeadline: Date | null, status: string): boolean {
  if (!slaDeadline) return false;
  if (['resolved', 'closed'].includes(status)) return false;
  return new Date() > new Date(slaDeadline);
}
```

### 6.4 Status Transition Rules

```typescript
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  open:        ['assigned', 'in_progress', 'resolved', 'closed'],
  assigned:    ['in_progress', 'open'],    // Can send back to open
  in_progress: ['resolved', 'open'],       // Can send back to open
  resolved:    ['closed', 'open'],         // Can reopen
  closed:      ['open'],                   // Can reopen
};

// Transition validation
export function canTransition(from: string, to: string): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

// Required fields per transition
export const TRANSITION_REQUIREMENTS: Record<string, string[]> = {
  'open→assigned':      ['assigned_shop'],
  'assigned→in_progress': [],
  'in_progress→resolved': ['resolution_notes'],
  'resolved→closed':     [],
  'closed→open':         ['notes'],  // Reopening requires justification
};
```

### 6.5 UFC 3-260-01 Imaginary Surface Criteria

```typescript
export const IMAGINARY_SURFACES = {
  primary: {
    name: 'Primary Surface',
    criteria: {
      A: { width: 2000, extension: 200, maxHeight: 0 },
      B: { width: 1500, extension: 200, maxHeight: 0 },
    },
    description: 'No objects permitted above runway elevation',
  },
  approach_departure: {
    name: 'Approach-Departure Clearance',
    criteria: {
      A: { slope: 50, innerWidth: 2000, outerWidth: 16000, length: 50000 },
      B: { slope: 50, innerWidth: 1500, outerWidth: 13250, length: 50000 },
    },
    description: '50:1 slope from end of primary surface',
  },
  inner_horizontal: {
    name: 'Inner Horizontal',
    criteria: {
      A: { height: 150, radius: 7500 },
      B: { height: 150, radius: 7500 },
    },
    description: '150 ft above established airfield elevation',
  },
  conical: {
    name: 'Conical',
    criteria: {
      A: { slope: 20, horizontalExtent: 7000, baseHeight: 150 },
      B: { slope: 20, horizontalExtent: 7000, baseHeight: 150 },
    },
    description: '20:1 slope outward from inner horizontal',
  },
  outer_horizontal: {
    name: 'Outer Horizontal',
    criteria: {
      A: { height: 500, radius: 30000 },
      B: { height: 500, radius: 30000 },
    },
    description: '500 ft above established airfield elevation',
  },
  transitional: {
    name: 'Transitional',
    criteria: {
      A: { slope: 7 },
      B: { slope: 7 },
    },
    description: '7:1 slope from primary/approach edges to inner horizontal',
  },
} as const;

export function evaluateObstruction(
  heightAGL: number,
  distanceFromEdge: number,
  elevationMSL: number | null,
  airfieldElevation: number,
  runwayClass: 'A' | 'B'
): ObstructionResult[] {
  const objectTopMSL = elevationMSL
    ? elevationMSL + heightAGL
    : airfieldElevation + heightAGL;
  const heightAboveField = objectTopMSL - airfieldElevation;

  const results: ObstructionResult[] = [];

  // Evaluate each surface...
  // Primary: violated if height > 0 within primary surface bounds
  // Approach: maxAllowable = distance / slope
  // Inner Horizontal: violated if heightAboveField > 150
  // Conical: maxAllowable = 150 + (distanceFromInnerHoriz / 20)
  // Outer Horizontal: violated if heightAboveField > 500
  // Transitional: maxAllowable = distanceFromPrimaryEdge / 7

  return results;
}
```

### 6.6 Emergency Response AM Action Checklist

```typescript
export const EMERGENCY_ACTIONS = [
  'Notified ATC / Tower',
  'Activated crash phone / primary crash net',
  'Coordinated with Fire Department / ARFF',
  'Swept assigned runway for debris',
  'Notified SOF (Supervisor of Flying)',
  'Notified MOC (Maintenance Operations Center)',
  'Notified Command Post',
  'Notified Wing Safety',
  'Notified Security Forces',
  'Coordinated barrier engagement (if applicable)',
  'Documented aircraft position and damage',
  'Completed post-incident airfield inspection',
] as const;

export const EMERGENCY_AGENCIES = [
  'SOF', 'Fire Chief / ARFF', 'Wing Safety', 'MOC',
  'Command Post', 'ATC / Tower', 'CE', 'Security Forces', 'Medical',
] as const;
```

### 6.7 Daily Inspection Checklist Items

```typescript
export const DAILY_INSPECTION_ITEMS = [
  // Runway Section
  { id: 'rwy-01', section: 'Runway', item: 'Pavement surface condition — no FOD, spalling, cracking, or settlement' },
  { id: 'rwy-02', section: 'Runway', item: 'Runway markings — visible, not faded or obscured' },
  { id: 'rwy-03', section: 'Runway', item: 'Edge lights — operational, lenses clean and unbroken' },
  { id: 'rwy-04', section: 'Runway', item: 'Threshold and end lights — operational' },
  { id: 'rwy-05', section: 'Runway', item: 'Touchdown zone lights — operational (if installed)' },
  { id: 'rwy-06', section: 'Runway', item: 'Centerline lights — operational (if installed)' },
  // Taxiway Section
  { id: 'twy-01', section: 'Taxiway', item: 'Taxiway pavement — no FOD, defects, or standing water' },
  { id: 'twy-02', section: 'Taxiway', item: 'Taxiway markings and signs — visible, correct, undamaged' },
  { id: 'twy-03', section: 'Taxiway', item: 'Taxiway edge lights — operational' },
  { id: 'twy-04', section: 'Taxiway', item: 'Hold position signs and markings — visible and correct' },
  // Approach/Departure Section
  { id: 'app-01', section: 'Approach/Departure', item: 'Approach lighting system (MALSR) — operational' },
  { id: 'app-02', section: 'Approach/Departure', item: 'PAPI/VASI — operational and aligned' },
  { id: 'app-03', section: 'Approach/Departure', item: 'Approach/departure zones — clear of obstructions' },
  // Support Section
  { id: 'sup-01', section: 'Support', item: 'Wind cone/indicator — operational, visible, correct orientation' },
  { id: 'sup-02', section: 'Support', item: 'Segmented circle — no damage, proper markings' },
  { id: 'sup-03', section: 'Support', item: 'Airfield perimeter — fencing intact, no unauthorized access points' },
] as const;
```

---

## 7. UI COMPONENTS & SCREENS

### 7.1 Design System

**Theme:** Dark theme (slate-900 background) with the following color palette:
- Background: `bg-slate-900` (#0F172A)
- Card: `bg-slate-800` (#1E293B)
- Card hover: `bg-slate-700` (#334155)
- Border: `border-slate-700`
- Text primary: `text-slate-100`
- Text secondary: `text-slate-400`
- Accent: `text-sky-400` (#38BDF8)
- Accent bg: `bg-sky-500` (#0EA5E9)

**Typography:**
- Font: System font stack (`font-sans` in Tailwind)
- Headings: `font-bold`
- Body: 14-16px
- Monospace for IDs and technical data: `font-mono`

**Touch Targets:** Minimum 44x44px for all interactive elements (buttons, cards, toggles).

**Bottom Navigation (Mobile):** 5 tabs:
1. Home (house icon)
2. Discrepancies (clipboard icon)
3. Checks (shield-check icon)
4. NOTAMs (megaphone icon)
5. More (menu icon → links to Inspections, Obstructions, Reports, Settings)

### 7.2 Screen Specifications

#### Home Screen `[MVP]`
- **Header:** "AIRFIELD OPS" with sync indicator (spinning icon during data fetch)
- **Alert Banner:** Conditionally shown. Red bg. Lists: Critical discrepancies, MALSR/NAVAID outages, overdue SLA items. Tappable to navigate.
- **KPI Tiles (2x2 grid):**
  - Open Discrepancies (count, links to /discrepancies?status=open)
  - Critical Items (count, red accent if > 0)
  - Overdue SLA (count, orange accent if > 0)
  - Active NOTAMs (count, links to /notams)
- **Quick Actions (4x2 grid):** 8 buttons with icon + label. Each navigates to the respective form.
  - New Discrepancy → /discrepancies/new
  - FOD Check → /checks/fod
  - BASH Check → /checks/bash
  - RCR Reading → /checks/rcr
  - RSC Report → /checks/rsc
  - Emergency → /checks/emergency
  - Inspection → /inspections/new
  - Draft NOTAM → /notams/new
- **Recent Activity:** Last 10 activity_log entries with icon, description, relative timestamp.

#### Discrepancy List `[MVP]`
- **Header:** "Discrepancies" with count badge
- **Filters (horizontal scroll):** Status chips (All, Open, Assigned, In Progress, Resolved, Closed), Severity chips (Critical, High, Medium, Low)
- **List:** Cards showing: display_id, title, severity badge (colored), status badge, assigned shop, relative date, photo count icon
- **FAB:** Floating action button "+" → /discrepancies/new
- **Sort:** Default newest first

#### Discrepancy Detail `[MVP]`
- **Header:** Back button + display_id
- **Status/Severity Row:** Status badge (large), severity badge, SLA countdown or "OVERDUE" badge
- **Info Grid:** Type, Location, Assigned Shop, Reported By, Date, Work Order #
- **Description:** Full text
- **Photo Gallery:** Horizontal scroll of thumbnails, tap to view full size
- **Linked NOTAM:** If present, card linking to NOTAM detail
- **Status Timeline:** Vertical timeline of all status_updates entries
- **Action Buttons:** "Update Status" (opens modal with status picker + notes field), "Add Photo"

#### Discrepancy Form `[MVP]`
- **Fields:**
  - Type (select dropdown from DISCREPANCY_TYPES)
  - Severity (select, pre-filled from type default)
  - Title (text input, max 120 chars)
  - Description (textarea)
  - Location (text input)
  - Assigned Shop (select, pre-filled from type default)
  - GPS Coordinates (auto-filled from geolocation, two readonly fields with "Capture GPS" button)
  - Photos (file input with camera capture, preview thumbnails)
- **Validation:** Type, severity, title, description, location required
- **Submit:** Creates discrepancy, generates display_id and work_order_number (if Critical/High), calculates SLA, redirects to detail

---

## 8. API ROUTES (Next.js Server Actions / Route Handlers)

All data operations use Supabase client directly in Server Components and Server Actions. No custom REST API needed for MVP — Supabase handles the API layer.

### 8.1 Server Actions (`app/actions/`)

```typescript
// discrepancies.ts
'use server'
export async function createDiscrepancy(formData: FormData): Promise<ActionResult>
export async function updateDiscrepancyStatus(id: string, newStatus: string, notes: string): Promise<ActionResult>

// checks.ts
'use server'
export async function createCheck(type: CheckType, data: CheckData): Promise<ActionResult>

// inspections.ts
'use server'
export async function createInspection(type: string): Promise<ActionResult>
export async function updateInspectionItem(inspectionId: string, itemId: string, response: string): Promise<ActionResult>
export async function completeInspection(inspectionId: string): Promise<ActionResult>

// notams.ts
'use server'
export async function createNotam(formData: FormData): Promise<ActionResult>
export async function cancelNotam(id: string): Promise<ActionResult>

// obstructions.ts
'use server'
export async function saveObstructionEvaluation(data: EvaluationData): Promise<ActionResult>

// photos.ts
'use server'
export async function uploadPhoto(entityType: string, entityId: string, file: File): Promise<ActionResult>
```

### 8.2 Future API Routes

```typescript
// app/api/notams/sync/route.ts — NASA DIP API sync (stubbed for v1)
// app/api/weather/route.ts — METAR fetch for KMTC (stubbed for v1)
```

---

## 9. AUTHENTICATION & AUTHORIZATION

### 9.1 Auth Flow

1. User visits app → middleware checks Supabase session
2. No session → redirect to `/login`
3. Login page: email + password form → `supabase.auth.signInWithPassword()`
4. On successful auth → check `profiles` table for user record
5. If no profile exists → redirect to profile setup (admin creates accounts)
6. Session stored in HTTP-only cookie via `@supabase/ssr`
7. Session refreshed automatically by middleware

### 9.2 Middleware (`middleware.ts`)

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. Create Supabase client with cookie handling
  // 2. Get session
  // 3. If no session and not on /login → redirect to /login
  // 4. If session → allow through
  // Protected routes: everything except /login
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons).*)'],
}
```

### 9.3 Role-Based Access Matrix

| Feature | airfield_manager | am_ncoic | am_tech | ce_shop | wing_safety | atc | observer | sys_admin |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| View Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create Discrepancy | ✓ | ✓ | ✓ | — | — | — | — | ✓ |
| Update Discrepancy Status | ✓ | ✓ | ✓ | Own shop | — | — | — | ✓ |
| Perform Checks | ✓ | ✓ | ✓ | — | — | — | — | ✓ |
| Perform Inspections | ✓ | ✓ | ✓ | — | — | — | — | ✓ |
| Create/Edit LOCAL NOTAMs | ✓ | ✓ | — | — | — | — | — | ✓ |
| Obstruction Evaluation | ✓ | ✓ | ✓ | — | ✓ | — | — | ✓ |
| View Reports | ✓ | ✓ | ✓ | Own shop | ✓ | — | ✓ | ✓ |
| Manage Users | ✓ | — | — | — | — | — | — | ✓ |

---

## 10. PWA & OFFLINE STRATEGY

### 10.1 PWA Configuration

**manifest.json:**
```json
{
  "name": "Airfield OPS Management Suite",
  "short_name": "Airfield OPS",
  "description": "Airfield management operations for 127th Wing",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0F172A",
  "theme_color": "#0EA5E9",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 10.2 Service Worker Strategy `[FULL]`

- **Static assets:** Cache-first (CSS, JS, fonts, images)
- **API responses:** Network-first with cache fallback for GET requests
- **POST/PUT/PATCH:** Queue in IndexedDB when offline, sync on reconnect
- **Offline indicator:** Banner at top of app: "You are offline — viewing cached data"

---

## 11. EXTERNAL INTEGRATIONS (Future)

### 11.1 NASA DIP API (NOTAMs) — `[FULL, Stubbed for v1]`
- Endpoint: `https://external-api.faa.gov/notamapi/v1/notams`
- Query param: `domesticLocation=KMTC`
- Requires API key registration
- Parse response → upsert into `notams` table with `source = 'faa'`

### 11.2 Aviation Weather (METAR) — `[FULL, Stubbed for v1]`
- Endpoint: `https://aviationweather.gov/api/data/metar?ids=KMTC&format=json`
- No auth required
- Display on home screen weather strip

---

## 12. NON-FUNCTIONAL REQUIREMENTS

| Category | Requirement |
|----------|-------------|
| Performance | Page load < 3 seconds on 4G. Obstruction calculation < 100ms. |
| Accessibility | WCAG 2.1 AA. Minimum contrast ratio 4.5:1. Screen reader labels on all interactive elements. |
| Responsiveness | Mobile-first (375px+). Tablet (768px+). Desktop (1024px+). |
| Security | All data over HTTPS. Supabase RLS on all tables. Session timeout: 24 hours. |
| Data Integrity | All mutations via server actions. Optimistic UI updates with rollback on error. |
| Browser Support | Chrome 90+, Safari 15+, Edge 90+, Firefox 90+. |
| Offline | PWA installable. Static assets cached. Recent data cached for read access. |
| Audit | Every create/update/delete logged in activity_log with user and timestamp. |

---

## 13. DEVELOPMENT PHASES & MVP DEFINITION

### Phase 1: MVP (Build This First)

Build in this order:

1. **Project Setup** — Next.js + Tailwind + Supabase + TypeScript config
2. **Auth** — Login page, middleware, session management, profile table
3. **Layout** — Root layout with bottom nav, header, page transitions
4. **Home Screen** — KPI tiles (with placeholder counts), quick action grid
5. **Discrepancies (full module)** — List, detail, form, status updates, photos, SLA
6. **Airfield Checks (full module)** — All 5 check types with forms, list, detail
7. **Inspections (daily only)** — Checklist with pass/fail, progress ring, submit
8. **NOTAMs (manual only)** — List, detail, draft LOCAL NOTAMs, no FAA sync
9. **Home Screen (real data)** — Connect KPI tiles and activity feed to live queries
10. **PWA basics** — manifest.json, app icons, installability

**MVP Definition of Done:** A user can log in, view the dashboard, create a discrepancy with photos, perform all 5 check types, complete a daily inspection, draft a NOTAM, and see KPI counts on the home screen. All data persists in Supabase. App is installable on mobile home screen.

### Phase 2: Full Feature Set

11. **Obstruction Evaluation** — Calculator with all 6 surfaces, Class A/B, save history
12. **Reports Dashboard** — KPI dashboard, trend charts, period selector
13. **User Management** — Admin screen for creating/editing users and roles
14. **PWA Offline** — Service worker caching, offline indicator, form queue
15. **Semi-annual/Annual Inspections** — Additional checklist templates
16. **NOTAM API sync** — NASA DIP integration when API key available
17. **Weather strip** — METAR API integration for home screen

---

## 14. SELFRIDGE ANGB CONFIGURATION DATA

```typescript
export const INSTALLATION = {
  name: 'Selfridge Air National Guard Base',
  icao: 'KMTC',
  unit: '127th Wing',
  majcom: 'Michigan Air National Guard',
  location: 'Harrison Township, Michigan',
  elevation_msl: 583,              // feet
  timezone: 'America/Detroit',     // Eastern Time
  runways: [
    {
      id: '01/19',
      length_ft: 9000,
      width_ft: 150,
      surface: 'Asphalt',
      runway_class: 'A' as const,  // Class A — C-130, KC-135, A-10
      end1: {
        designator: '01',
        latitude: 42.6042,
        longitude: -82.8340,
        heading: 10,
        approach_lighting: 'MALSR',
      },
      end2: {
        designator: '19',
        latitude: 42.6237,
        longitude: -82.8309,
        heading: 190,
        approach_lighting: 'None',
      },
    },
  ],
  ce_shops: [
    'CE Pavements',
    'CE Electrical',
    'CE Grounds',
    'CE Structures',
    'CE HVAC',
    'Airfield Mgmt',
  ],
} as const;
```

---

## 15. APPENDICES

### 15.1 Governing Publications

| Publication | Title | Relevance |
|------------|-------|-----------|
| DAFI 13-213 | Airfield Management | Primary governing directive — inspections, waivers, discrepancy tracking |
| DAFI 13-204 | Airfield Operations Procedures and Programs | ATC coordination, operating procedures |
| UFC 3-260-01 | Airfield and Heliport Planning and Design | Imaginary surface criteria, runway/taxiway standards |
| UFC 3-535-01 | Visual Air Navigation Facilities | Lighting and NAVAID standards |
| AFI 91-202 | USAF Mishap Prevention Program | Safety program requirements |
| AFMAN 91-203 | Air Force Occupational Safety, Fire, and Health | Workplace safety |
| DAFI 32-1042 | Facilities Sustainment, Maintenance, Repair | CE work order standards |
| ETL 04-2 | Standard Airfield Pavement Marking Schemes | Marking criteria |
| TO 35E4-1-2 | Maintenance of Airfield Pavement Marking | Technical procedures |
| FAA AC 150/5300-13B | Airport Design | FAA design standards |

### 15.2 Glossary

| Term | Definition |
|------|-----------|
| AGL | Above Ground Level — height measured from local ground |
| AM | Airfield Manager / Airfield Management |
| BASH | Bird/Wildlife Aircraft Strike Hazard |
| CE | Civil Engineering — base organization for facility maintenance |
| FOD | Foreign Object Debris/Damage |
| MALSR | Medium Intensity Approach Lighting System with Runway Alignment Indicator |
| MSL | Mean Sea Level — standard elevation reference |
| Mu Value | Coefficient of friction (0-100) measured by friction tester |
| NAVAID | Navigational Aid (ILS, VASI, PAPI) |
| NOTAM | Notice to Air Missions — official airfield status notification |
| PAPI | Precision Approach Path Indicator |
| RCR | Runway Condition Reading — friction measurement using Mu values |
| RSC | Runway Surface Condition — contaminant reporting |
| RT3 | Runway surface friction tester equipment (e.g., Bowmonk, Dynatest) |
| SLA | Service Level Agreement — response/resolution time targets |
| VASI | Visual Approach Slope Indicator |

### 15.3 Companion Files

These prototype files define the visual design and interaction patterns. Reference them for UI layout decisions:
- `Airfield_OPS_Unified_Prototype.jsx` — Complete navigable React prototype with all screens
- `Airfield_OPS_Obstruction_Engine.html` — Interactive obstruction evaluation with Leaflet map
- `Airfield_OPS_Configuration_Architecture_Guide.docx` — 64 configurable elements mapped by change tier

---

*END OF DOCUMENT — Airfield OPS Management Suite SRS v2.0 — February 2026*
