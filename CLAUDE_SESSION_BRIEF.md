# Claude Code Session Brief — Airfield OPS Management Suite

> **Date:** 2026-02-18
> **Version:** 1.0.0
> **Repository:** `csproctor88-star/airfield-app`
> **Previous branch:** `claude/build-homepage-BJJ6b`
> **Build status:** Clean (`next build` zero errors, `tsc --noEmit` zero errors)
> **Commits:** 154

---

## What This Is

A mobile-first Next.js 14 web app for managing airfield operations at **Selfridge Air National Guard Base (KMTC)**, 127th Wing, Michigan ANG. It covers daily inspections, discrepancy tracking, airfield checks, NOTAMs, UFC 3-260-01 obstruction evaluations, and a real-time operational dashboard. The app uses a dark theme, Supabase backend, Mapbox maps, and runs in demo mode when Supabase is unconfigured.

---

## Read These First

| Priority | File | Why |
|----------|------|-----|
| 1 | `SRS.md` | The definitive spec (1,291 lines). All business logic, database schema, UI specs, user roles, and inspection checklists originate here. |
| 2 | `PROJECT_STATUS.md` | Current architecture, what's built, what's left, key decisions, and **tech debt audit** from the 2026-02-18 v1.0.0 review. |
| 3 | `CHANGELOG.md` | Versioned history of every feature from v0.0.1 to v1.0.0. |
| 4 | `lib/constants.ts` | Installation config, all 11 discrepancy types, 7 check types, 42 airfield + 32 lighting inspection items, user roles, airfield areas. This is the source of truth for business data. |
| 5 | `supabase/schema.sql` | Full database schema (11 tables, 5 sequences, display ID generator). |

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14.2.35 |
| Language | TypeScript (strict) | 5.9.3 |
| Styling | Tailwind CSS (custom dark theme) | 3.4.19 |
| Backend | Supabase (PostgreSQL, Auth, Storage) | SSR 0.8.0 |
| Maps | Mapbox GL JS | 3.18.1 |
| Validation | Zod | 3.25.76 |
| PDF | jsPDF | 4.1.0 |
| Icons | Lucide React | 0.563.0 |
| Toasts | Sonner | 1.7.4 |

---

## What's Complete

### All 6 core modules are functional:

**Dashboard** (`/`) — Live clock, Open-Meteo weather with emoji mapping, advisory system (INFO/CAUTION/WARNING dialog), Active Runway 01/19 toggle with Open/Suspended/Closed dropdown, Current Status (RSC + BWC from Supabase), side-by-side NAVAID status panels for RWY 01 and RWY 19 with G/Y/R toggles and auto-expanding note fields, user presence (Online/Away/Inactive via `last_seen_at`), quick actions (Begin Inspection, Begin Check, New Discrepancy), expandable activity feed from `activity_log` with profile joins.

**Discrepancies** (`/discrepancies`, `/discrepancies/new`, `/discrepancies/[id]`) — 11 types, full lifecycle (Open → Submitted to AFM → Submitted to CES → Work Completed → Closed/Cancelled), photo uploads, Mapbox location pins, notes history with timestamps, work order tracking, linked NOTAMs, search/filter.

**Airfield Checks** (`/checks`, `/checks/history`, `/checks/[id]`) — 7 types in one unified form (FOD, RSC, RCR, IFE, Ground Emergency, Heavy Aircraft, BASH), type-specific fields, photo capture, map location, issue-found gating, follow-up remarks, full history with filtering.

**Daily Inspections** (`/inspections`, `/inspections/[id]`) — Combined Airfield (9 sections, 42 items) + Lighting (5 sections, 32 items) report. Three-state toggle, Mark All Pass, BWC integration, localStorage draft persistence, review step, combined PDF export. Standalone Construction Meeting and Joint Monthly forms with personnel attendance.

**NOTAMs** (`/notams`, `/notams/new`, `/notams/[id]`) — FAA and LOCAL listing with source/status filters. Draft creation for local NOTAMs (not persisted to DB — see tech debt). FAA sync API stubbed.

**Obstruction Evaluations** (`/obstructions`, `/obstructions/history`, `/obstructions/[id]`) — UFC 3-260-01 Class B imaginary surface analysis (all 6 surfaces). Interactive Mapbox map with color-coded overlays, geodesic calculations, Open-Elevation API, multi-photo, violation detection with UFC table references.

### Navigation:

**Bottom nav** (5 tabs): Home, Aircraft, Regulations, Obstruction Eval, More

**More menu** (9 items, all linked): Airfield Inspection History, Airfield Check History, Obstruction Database, Waivers, Reports, NOTAMs, Sync & Data, Users & Security, Settings

### Placeholder pages (coming soon): Aircraft, Regulations, Waivers, Reports, Settings, Users & Security, Sync & Data

### Supporting infrastructure:

- **Auth**: Email/password login + sign-up, demo-mode bypass
- **Demo mode**: Full offline operation with mock data when Supabase env vars missing
- **PDF export**: jsPDF client-side generation for inspections (single + combined reports + special forms)
- **Database**: 11 tables, 7 migrations applied, RLS currently disabled
- **Components**: Header, bottom nav, page header, badges, buttons, cards, inputs, skeletons, modals, Mapbox maps (location + airfield)

---

## What's NOT Built Yet

| Feature | Status | Notes |
|---------|--------|-------|
| **Server-side email** | Planned | User wants branded sender (e.g. `AFMtoolkit@info.com`). Need Next.js API route + email provider (Resend/SendGrid/SES). Just a POST of the existing PDF blob. |
| **NOTAM persistence** | Not wired | `/notams/new` form exists but does not save to DB. No `lib/supabase/notams.ts` CRUD module. |
| **NOTAM sync API** | Stub | `/api/notams/sync` returns placeholder. Needs NASA DIP API integration per SRS 11.1. |
| **Weather METAR API** | Stub | `/api/weather` returns placeholder. Dashboard uses Open-Meteo directly via `lib/weather.ts`. |
| **Offline / PWA** | Not started | `manifest.json` exists but icons are missing. No service worker, no IndexedDB caching. |
| **Role-based access** | Disabled | RLS stripped for MVP. 8 user roles defined in constants but not enforced. |
| **Real-time sync** | Not started | Supabase Realtime subscriptions not wired. |
| **Reports module** | Placeholder | Coming soon page at `/reports`. |
| **User management** | Placeholder | Coming soon page at `/users`. |
| **Testing** | Not started | No test files exist. |

---

## Known Tech Debt

Full details in `PROJECT_STATUS.md` under "Tech Debt & Cleanup". Key items:

### Must Fix Before Production

- **RLS disabled** — all authenticated users have full CRUD on all tables
- **50+ `eslint-disable @typescript-eslint/no-explicit-any`** directives across Supabase CRUD modules
- **Validator enum mismatch** — `lib/validators.ts` `statusUpdateSchema` uses old values (`assigned`, `in_progress`, `resolved`) that don't match actual statuses
- **KPI query bug** — `fetchDiscrepancyKPIs()` filters by `status not in ('closed')` but `'closed'` is not a valid status
- **Hardcoded inspector** — `app/(app)/checks/page.tsx:32` has `"MSgt Proctor"` instead of reading from auth
- **No ESLint config** — `next lint` cannot run

### Should Clean Up

- **Dead route** — `app/(app)/inspections/new/page.tsx` just redirects, can be deleted
- **`recharts` dependency** — installed but unused
- **Supabase config detection** duplicated 4 times — extract to shared utility
- **`lib/supabase/server.ts`** and **`lib/supabase/middleware.ts`** — not imported by any page
- **Missing PWA icons** — `manifest.json` references icons that don't exist
- **Photo count** manually incremented — can desync on partial failure
- **Badge re-export wrappers** — `severity-badge.tsx` and `status-badge.tsx` are unnecessary single-line re-exports

### Large Files to Consider Splitting

| File | ~Lines | Contents |
|------|--------|----------|
| `app/(app)/inspections/page.tsx` | 1,200 | Workspace + history + draft management |
| `app/(app)/page.tsx` | 746 | Dashboard — weather, advisory, status, NAVAIDs, activity |
| `components/discrepancies/modals.tsx` | 400 | 4 modals with embedded business logic |
| `components/obstructions/airfield-map.tsx` | 387 | GeoJSON building + Mapbox + legend |

---

## Key Architecture Decisions (Don't Undo These)

1. **Dual Inspection System** — Airfield and Lighting are separate types with distinct checklists, combined into one daily report via `daily_group_id`
2. **Three-State Toggle** — Inspection items cycle Pass → Fail → N/A → clear
3. **Conditional Sections** — Construction Meeting and Joint Monthly are opt-in toggles on the inspection workspace
4. **7 Check Types in One Page** — FOD, RSC, RCR, IFE, Ground Emergency, Heavy Aircraft, BASH — type-specific form fields revealed by selection
5. **Demo Mode** — Auto-detected when Supabase env vars are missing or contain placeholder strings
6. **Single Runway** — Hardcoded for Selfridge ANGB Runway 01/19 (9,000 x 150 ft, heading 002°)
7. **Client-Side PDF** — jsPDF generates in browser. Server-side email delivery is a separate future feature.
8. **Mobile-First** — 480px max-width, bottom nav, 44px+ touch targets
9. **Bottom Nav**: Home, Aircraft, Regulations, Obstruction Eval, More — everything else via More menu
10. **NAVAID Status** — Persisted in `navaid_statuses` table, not ephemeral state
11. **Advisory** — Client-side only (not persisted to DB), INFO/CAUTION/WARNING levels

---

## Database

**Schema:** `supabase/schema.sql` — 11 tables with sequences and `generate_display_id()` function.

**Tables:** `profiles`, `discrepancies`, `airfield_checks`, `check_comments`, `inspections`, `notams`, `photos`, `status_updates`, `obstruction_evaluations`, `activity_log`, `navaid_statuses`

**Migrations (7, applied in order):**
1. `20260216_update_inspections_table.sql` — dual inspection types, BWC, conditional sections
2. `20260217_add_daily_group_id.sql` — linked daily report pairs
3. `20260217_add_inspection_fields.sql` — inspector name, weather, temperature
4. `20260217_remove_rls_policies.sql` — stripped all RLS for MVP
5. `20260218_add_last_seen_at.sql` — user presence tracking
6. `20260218_add_personnel_and_special_types.sql` — personnel array, construction_meeting/joint_monthly types
7. `20260218_create_navaid_statuses.sql` — NAVAID G/Y/R status per approach system

**RLS is currently disabled.** The migration `20260217_remove_rls_policies.sql` dropped all policies and helper functions.

---

## Environment

```env
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
NEXT_PUBLIC_MAPBOX_TOKEN=[mapbox-token]
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

If Supabase vars are missing or contain placeholders (`your-project`, `your-anon-key`), the app runs in demo mode with `lib/demo-data.ts`.

---

## File Map (~65 source files)

```
airfield-app/
├── app/
│   ├── layout.tsx                          # Root layout, metadata, Sonner toasts
│   ├── globals.css                         # Dark theme styles, card/input/button classes
│   ├── login/page.tsx                      # Email/password auth + demo bypass
│   ├── (app)/
│   │   ├── layout.tsx                      # App shell: header + bottom nav, 480px max-width
│   │   ├── page.tsx                        # Dashboard: weather, advisory, RWY, NAVAIDs, activity
│   │   ├── aircraft/page.tsx               # Coming soon
│   │   ├── checks/
│   │   │   ├── page.tsx                    # Unified 7-type check creation form
│   │   │   ├── [id]/page.tsx               # Check detail + remarks
│   │   │   └── history/page.tsx            # Check history with type filtering
│   │   ├── discrepancies/
│   │   │   ├── page.tsx                    # Discrepancy list with status/search filters
│   │   │   ├── new/page.tsx                # Create discrepancy form
│   │   │   └── [id]/page.tsx               # Detail with modals, photos, notes, map
│   │   ├── inspections/
│   │   │   ├── page.tsx                    # Daily inspection workspace + history (LARGE)
│   │   │   ├── new/page.tsx                # DEAD ROUTE — redirects to /inspections
│   │   │   └── [id]/page.tsx               # Inspection detail + PDF export
│   │   ├── more/page.tsx                   # Module directory (all links functional)
│   │   ├── notams/
│   │   │   ├── page.tsx                    # NOTAM list (demo data only)
│   │   │   ├── new/page.tsx                # Draft form (NOT PERSISTED)
│   │   │   └── [id]/page.tsx               # NOTAM detail
│   │   ├── obstructions/
│   │   │   ├── page.tsx                    # Evaluation form + Mapbox + UFC analysis
│   │   │   ├── [id]/page.tsx               # Evaluation results + photo gallery
│   │   │   └── history/page.tsx            # Evaluation history
│   │   ├── regulations/page.tsx            # Coming soon
│   │   ├── reports/page.tsx                # Coming soon
│   │   ├── settings/page.tsx               # Coming soon
│   │   ├── sync/page.tsx                   # Coming soon
│   │   ├── users/page.tsx                  # Coming soon
│   │   └── waivers/page.tsx                # Coming soon
│   └── api/
│       ├── notams/sync/route.ts            # STUB — not implemented
│       └── weather/route.ts                # STUB — not implemented
├── components/
│   ├── layout/
│   │   ├── header.tsx                      # Sticky gradient header + sync animation
│   │   ├── bottom-nav.tsx                  # 5-tab mobile nav
│   │   └── page-header.tsx                 # Back button + title + action slot
│   ├── discrepancies/
│   │   ├── discrepancy-card.tsx            # List item card
│   │   ├── location-map.tsx                # Mapbox point selector
│   │   ├── modals.tsx                      # Edit, Status, Work Order, Photo Viewer
│   │   ├── severity-badge.tsx              # Re-export wrapper (unnecessary)
│   │   └── status-badge.tsx                # Re-export wrapper (unnecessary)
│   ├── obstructions/
│   │   └── airfield-map.tsx                # Mapbox + imaginary surface overlays
│   └── ui/
│       ├── badge.tsx                       # Badge + SeverityBadge + StatusBadge
│       ├── button.tsx                      # ActionButton with color prop
│       ├── card.tsx                        # Card wrapper
│       ├── input.tsx                       # Input, Select, Textarea, FormField
│       └── loading-skeleton.tsx            # Pulse skeleton + CardSkeleton
├── lib/
│   ├── constants.ts                        # Installation, types, checklists, roles, areas
│   ├── validators.ts                       # Zod schemas (STATUS ENUM MISMATCH — see tech debt)
│   ├── utils.ts                            # cn(), formatRelativeTime(), generateDisplayId()
│   ├── demo-data.ts                        # Mock data for all modules
│   ├── weather.ts                          # Open-Meteo client-side weather fetch
│   ├── inspection-draft.ts                 # localStorage draft persistence
│   ├── pdf-export.ts                       # jsPDF: single, combined, special inspections
│   ├── calculations/
│   │   ├── geometry.ts                     # Geodesic math, runway geometry, polygons
│   │   └── obstructions.ts                 # UFC 3-260-01 surface evaluation engine
│   └── supabase/
│       ├── client.ts                       # Browser Supabase client (demo-mode aware)
│       ├── server.ts                       # Server-side client (UNUSED by pages)
│       ├── middleware.ts                    # Auth session for middleware (SUPERSEDED)
│       ├── types.ts                        # TypeScript types for all DB tables
│       ├── activity.ts                     # Activity log write
│       ├── checks.ts                       # Checks CRUD + photos + comments
│       ├── discrepancies.ts                # Discrepancies CRUD + KPIs + photos
│       ├── inspections.ts                  # Inspections CRUD + daily groups
│       ├── navaids.ts                      # NAVAID status read/update
│       └── obstructions.ts                 # Obstruction evaluations CRUD + photos
├── supabase/
│   ├── schema.sql                          # Master schema (11 tables)
│   └── migrations/                         # 7 migration files
├── middleware.ts                            # Auth guard + demo mode bypass
├── public/manifest.json                    # PWA manifest (ICONS MISSING)
├── .env.example                            # Env var template
├── tailwind.config.ts                      # Dark theme color system
├── next.config.js                          # Image remotes for Supabase
├── tsconfig.json                           # Strict mode, path aliases
├── SRS.md                                  # Software Requirements Specification
├── Airfield_OPS_Unified_Prototype.jsx      # Original React UI prototype (reference only)
├── PROJECT_STATUS.md                       # Architecture + tech debt audit
├── CHANGELOG.md                            # Version history v0.0.1–v1.0.0
└── README.md                               # Setup guide + module docs
```

---

## User Preferences & Decisions (from conversations)

- **Server-side email** is deferred. User wants a branded sender address like `AFMtoolkit@info.com` via a backend API route, not client-side `mailto:`.
- **Inspection checklists** have been refined through multiple iterations — Runway 01/19 (not 05/23), no Hot Pits, no Parking Loops, no Traffic Lights, no North/South Ramp.
- **Construction Meeting and Joint Monthly** are standalone inspection types, not just conditional sections on daily inspections.
- **Personnel tracking** with representative name text fields was added for special inspection types.
- **Airfield Diagram** button is a placeholder — user acknowledged it's for later.
- **More menu order** was explicitly specified: Airfield Inspection History, Airfield Check History, Obstruction Database, Waivers, Reports, NOTAMs, Sync & Data, Users & Security, Settings.
- **NAVAID notes** should auto-expand downward (textarea, not input) when system is Y or R.
- **Inspection history search** should cover type, issues, construction/joint, personnel names — not just display IDs.
- **"Back to Draft"** was renamed to **"View Current Inspection Form"** on the inspection history view.

---

## Suggested Next Phase Priorities

1. **Tech debt cleanup** — fix the validator enum mismatch, KPI query bug, hardcoded inspector name, dead `/inspections/new` route, remove `recharts`. Quick wins that prevent bugs.
2. **NOTAM persistence** — create `lib/supabase/notams.ts` and wire the draft form to actually save to Supabase.
3. **ESLint setup** — configure `eslint.config.js` so `next lint` works.
4. **Server-side email** — Next.js API route that accepts PDF blob and sends via email provider.
5. **PWA icons** — generate 192px and 512px icons for installability.
6. **Supabase integration testing** — connect to a real project, verify auth flow end-to-end.
7. **RLS re-enablement** — design role-based policies based on the 8 user roles in `lib/constants.ts`.
8. **Extract shared config** — deduplicate Supabase config detection and Mapbox token validation into shared utilities.
