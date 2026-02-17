# Airfield OPS Management Suite — Project Status

> **Last updated:** 2026-02-17
> **Branch:** `claude/build-app-from-design-4qtNG`
> **Commits:** 101

---

## Overview

A mobile-first Next.js 14 web application for managing airfield operations at **Selfridge Air National Guard Base (KMTC)**, 127th Wing, Michigan ANG. The app covers discrepancy tracking, airfield checks, inspections, NOTAMs, and obstruction evaluations — all with Supabase backend, Mapbox mapping, and a dark-theme UI.

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 3.4 (custom dark theme) |
| Backend | Supabase (Postgres, Auth, Storage, RLS) |
| Maps | Mapbox GL JS 3.18 |
| Charts | Recharts 2.15 |
| Validation | Zod 3.25 |
| Toasts | Sonner 1.7 |
| Icons | Lucide React |

### Key Design Patterns

- **Demo Mode**: App runs fully offline with mock data when Supabase env vars are missing — useful for development and field testing
- **Mobile-First**: Max-width 480px layout, bottom navigation, touch-friendly controls (44px+ hit targets)
- **Row-Level Security**: All Supabase tables have RLS policies with role-based access (AM roles, CE shops, observers)
- **Display ID Generation**: Human-readable IDs like `D-2026-0041` via Postgres sequences

---

## What's Been Built

### Database (`supabase/`)

- **`schema.sql`** — 11 tables with RLS: `profiles`, `discrepancies`, `airfield_checks`, `check_comments`, `inspections`, `inspection_items`, `inspection_photos`, `notams`, `photos`, `status_updates`, `obstruction_evaluations`, `activity_log`
- **`migrations/20260216_update_inspections_table.sql`** — Adds `inspector_name`, `weather_conditions`, `temperature_f`, BWC value, and conditional section flags; updates inspection type constraint to support `airfield` and `lighting`

### Types & Validation (`lib/`)

- **`supabase/types.ts`** — Full TypeScript types for all database tables, including `UserRole`, `Severity`, `CheckType`, `InspectionType`, `InspectionItem`
- **`validators.ts`** — Zod schemas for discrepancies, status updates, FOD/RCR/RSC/BASH/emergency checks, NOTAMs, inspection responses
- **`constants.ts`** — Installation config (KMTC), discrepancy types (11), check types (7), inspection sections (airfield: 9 sections / 44 items, lighting: 5 sections / 34 items), locations, status workflow, user roles
- **`utils.ts`** — Class merging, relative time formatting, display ID generation
- **`demo-data.ts`** — Sample discrepancies for offline mode
- **`calculations/`** — FAA Part 77 geometry and obstruction clearance analysis

### Supabase Client Libraries (`lib/supabase/`)

- **`client.ts`** / **`server.ts`** / **`middleware.ts`** — Browser and SSR Supabase clients with demo-mode detection
- **`discrepancies.ts`** — CRUD + KPI queries
- **`checks.ts`** — CRUD + photo uploads + comments
- **`obstructions.ts`** — Obstruction evaluation CRUD
- **`notams.ts`** — NOTAM management

### App Routes (`app/`)

| Route | Status | Description |
|-------|--------|-------------|
| `/login` | Done | Email/password auth with demo-mode bypass |
| `/` (Dashboard) | Done | Live clock, weather, KPI tiles, quick-action buttons, recent activity |
| `/discrepancies` | Done | Filterable list with severity badges, search, demo data fallback |
| `/discrepancies/new` | Done | Create form with type, severity, location, description |
| `/discrepancies/[id]` | Done | Detail view with status updates, photos, map |
| `/checks` | Done | Unified check page with 7 types (FOD, RSC, RCR, IFE, Ground Emergency, Heavy Aircraft, BASH) |
| `/checks/history` | Done | Completed checks list with filtering |
| `/checks/[id]` | Done | Check detail with comments, photos, map |
| `/inspections/new` | Partial | Type selection (airfield/lighting), section/item checklist with pass/fail/N/A toggle, BWC selector, "Mark All Pass" button, progress bar |
| `/notams` | Done | NOTAM list with status/source filters |
| `/notams/new` | Done | Create FAA or local NOTAM |
| `/notams/[id]` | Done | NOTAM detail and editing |
| `/obstructions` | Done | Obstruction evaluation form with Part 77 calculations |
| `/obstructions/history` | Done | Evaluation history list |
| `/obstructions/[id]` | Done | Full analysis detail |
| `/more` | Done | Settings, profile, logout |

### Components (`components/`)

- **Layout**: `header.tsx` (sticky gradient header), `bottom-nav.tsx` (5-tab mobile nav), `page-header.tsx`
- **Discrepancies**: `discrepancy-card.tsx`, `severity-badge.tsx`, `status-badge.tsx`, `location-map.tsx`, `modals.tsx`
- **Obstructions**: `airfield-map.tsx` (Mapbox interactive)
- **UI primitives**: `badge.tsx`, `button.tsx`, `card.tsx`, `input.tsx`, `loading-skeleton.tsx`

### Middleware (`middleware.ts`)

- Authentication guard with Supabase SSR cookie handling
- Demo-mode bypass when env vars not configured

---

## What's Left To Do

### High Priority — Inspection Modules (Not Yet Complete)

The inspection system has the **data model** (constants, types, schema) and a **basic checklist UI** (`/inspections/new`), but the full inspection workflows still need significant work:

#### Airfield Inspection (9 sections, 44 items)
1. Obstacle Clearance Surfaces (5 items)
2. Signs / Markings (5 items)
3. Lighting (4 items)
4. Construction Activity / NOTAMS (3 items)
5. Habitat Assessment / BASH (7 items, includes BWC value selector)
6. Pavement / Drainage (7 items)
7. Driving (6 items)
8. FOD Prevention (7 items)
9. *Construction Meeting* (conditional, opt-in)
10. *Joint Monthly* (conditional, opt-in)

**What's needed:**
- Inspection history list page (`/inspections` or `/inspections/history`)
- Inspection detail/review page (`/inspections/[id]`)
- Save-to-Supabase integration (currently UI-only, no persistence)
- Photo attachment per inspection item
- Comments/notes per item and per section
- Inspector name, weather conditions, temperature fields on the form
- Summary/review step before final submission
- PDF report generation for completed inspections

#### Lighting Inspection (5 sections, 34 items)
1. Runway Lighting (9 items)
2. Taxiway / Apron Lighting (8 items)
3. Signs (6 items)
4. Markings (6 items)
5. Miscellaneous Lighting (5 items)

**What's needed:** Same as airfield inspection above — history, detail, persistence, photos, summary, and PDF export.

### Medium Priority — Backend Integration

| Task | Description |
|------|-------------|
| **Connect to Supabase** | Wire up real queries for inspections (discrepancies and checks are already partially wired) |
| **Authentication flow** | Login works but needs testing with a real Supabase project; role-based UI gating |
| **Photo uploads** | Storage bucket exists in schema; needs wiring for inspection item photos |
| **Real-time sync** | Supabase Realtime subscriptions for live updates across devices |

### Lower Priority — Enhancements

| Task | Description |
|------|-------------|
| **Offline / PWA support** | Service worker, IndexedDB caching for inspections started in the field with poor connectivity |
| **PDF report generation** | Export completed inspections as downloadable PDF matching regulatory format |
| **Notifications** | Flag overdue inspections, critical discrepancies, expiring NOTAMs |
| **Testing** | Unit tests for components, integration tests for inspection flow |
| **Deployment** | Vercel deployment, environment configuration, CI/CD |

---

## Key Decisions Made

1. **Dual Inspection System** — Airfield and Lighting inspections are separate types with distinct section/item sets, sharing the same UI framework and database tables
2. **Three-State Toggle** — Inspection items cycle through Pass → Fail → N/A → (clear), rather than separate buttons
3. **Conditional Sections** — Construction Meeting and Joint Monthly sections are opt-in toggles, not shown by default
4. **BWC Integration** — Bird Watch Condition (LOW/MOD/SEV/PROHIB) is captured inline within the Habitat Assessment section
5. **"Mark All Pass" Button** — Per-section bulk action to speed up routine inspections where most items pass
6. **7 Check Types** — FOD, RSC, RCR, IFE, Ground Emergency, Heavy Aircraft, BASH — all in a single unified page with type-specific fields
7. **Mobile-First Layout** — 480px max-width, bottom nav, designed for phone use in the field
8. **Demo Mode** — App works without Supabase for development and demos; triggered automatically when env vars are missing
9. **Selfridge ANGB Config** — All locations, taxiways, runway data, and CE shops are hardcoded for KMTC in `lib/constants.ts`

---

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
NEXT_PUBLIC_MAPBOX_TOKEN=[mapbox-token]   # For map features
```

If Supabase vars are missing or contain placeholders, the app runs in **demo mode** with offline mock data.

---

## File Structure (Key Paths)

```
airfield-app/
├── app/
│   ├── layout.tsx                    # Root layout (metadata, fonts, toasts)
│   ├── login/page.tsx                # Auth page
│   ├── (app)/
│   │   ├── layout.tsx                # App shell (header + bottom nav)
│   │   ├── page.tsx                  # Dashboard
│   │   ├── discrepancies/            # List, new, [id] detail
│   │   ├── checks/                   # Unified check form, history, [id] detail
│   │   ├── inspections/
│   │   │   └── new/page.tsx          # Inspection creation (airfield/lighting)
│   │   ├── notams/                   # List, new, [id] detail
│   │   ├── obstructions/             # Evaluation, history, [id] detail
│   │   └── more/page.tsx             # Settings
│   └── api/                          # Weather + NOTAM sync routes
├── components/
│   ├── layout/                       # Header, bottom-nav, page-header
│   ├── discrepancies/                # Cards, badges, map, modals
│   ├── obstructions/                 # Airfield map
│   └── ui/                           # Badge, button, card, input, skeleton
├── lib/
│   ├── constants.ts                  # Installation, types, inspection sections
│   ├── validators.ts                 # Zod schemas
│   ├── utils.ts                      # Helpers
│   ├── demo-data.ts                  # Offline mock data
│   ├── calculations/                 # Part 77 geometry
│   └── supabase/                     # Client, types, CRUD modules
├── supabase/
│   ├── schema.sql                    # Full database schema
│   └── migrations/                   # Schema updates
├── middleware.ts                      # Auth guard + demo mode
├── tailwind.config.ts                # Custom dark theme
└── package.json                      # Dependencies
```

---

## Open Questions for Next Phase

1. **Supabase project** — Is there a Supabase project already created, or do we need to set one up?
2. **Auth method** — Email/password, magic link, SSO, or simple PIN for field inspectors?
3. **Offline priority** — How critical is offline support? Affects architecture decisions if tackled early.
4. **PDF format** — Is there a specific regulatory template for inspection reports?
5. **Deployment target** — Vercel, or another platform?
