# Claude Code Session Brief — Airfield OPS Management Suite

> **Date:** 2026-02-18
> **Version:** 0.9.0
> **Repository:** `csproctor88-star/airfield-app`
> **Previous branch:** `claude/review-airfield-project-P7wT4`
> **Build status:** Clean (`next build` — zero errors, zero warnings)

---

## What This Is

A mobile-first Next.js 14 web app for managing airfield operations at **Selfridge Air National Guard Base (KMTC)**, 127th Wing, Michigan ANG. It covers daily inspections, discrepancy tracking, airfield checks, NOTAMs, and UFC 3-260-01 obstruction evaluations. The app uses a dark theme, Supabase backend, Mapbox maps, and runs in demo mode when Supabase is unconfigured.

---

## Read These First

| Priority | File | Why |
|----------|------|-----|
| 1 | `SRS.md` | The definitive spec (1,291 lines). All business logic, database schema, UI specs, user roles, and inspection checklists originate here. |
| 2 | `PROJECT_STATUS.md` | Current architecture, what's built, what's left, key decisions, and **tech debt audit** from the 2026-02-18 review. |
| 3 | `CHANGELOG.md` | Versioned history of every feature from v0.0.1 to v0.9.0. |
| 4 | `lib/constants.ts` | Installation config, all 11 discrepancy types, 7 check types, 42 airfield + 32 lighting inspection items, user roles, airfield areas. This is the source of truth for business data. |
| 5 | `supabase/schema.sql` | Full database schema (11 tables, 5 sequences, display ID generator). |

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14.2.35 |
| Language | TypeScript (strict) | 5.9.3 |
| Styling | Tailwind CSS (custom dark theme) | 3.4 |
| Backend | Supabase (PostgreSQL, Auth, Storage) | SSR 0.5.2 |
| Maps | Mapbox GL JS | 3.18 |
| Charts | Recharts | 2.15 |
| Validation | Zod | 3.25 |
| PDF | jsPDF | 2.5 |
| Icons | Lucide React | — |
| Toasts | Sonner | 1.7 |

---

## What's Complete

### All 6 modules are functional:

**Dashboard** (`/`) — Live clock, weather, KPI tiles (open discrepancies, critical items, active NOTAMs), 6 quick-action buttons, today's status cards, activity feed (placeholder data).

**Discrepancies** (`/discrepancies`, `/discrepancies/new`, `/discrepancies/[id]`) — 11 types, full lifecycle (Open → Submitted to AFM → Submitted to CES → Work Completed → Closed/Cancelled), photo uploads, Mapbox location pins, notes history with timestamps, work order tracking, linked NOTAMs, search/filter.

**Airfield Checks** (`/checks`, `/checks/history`, `/checks/[id]`) — 7 types in one unified form (FOD, RSC, RCR, IFE, Ground Emergency, Heavy Aircraft, BASH), type-specific fields, photo capture, map location, issue-found gating, follow-up remarks, full history with filtering.

**Daily Inspections** (`/inspections`, `/inspections/[id]`) — Combined Airfield (9 sections, 42 items) + Lighting (5 sections, 32 items) report. Three-state toggle, Mark All Pass, BWC integration, localStorage draft persistence, review step, combined PDF export. Also standalone Construction Meeting and Joint Monthly forms with personnel attendance.

**NOTAMs** (`/notams`, `/notams/new`, `/notams/[id]`) — FAA and LOCAL listing with source/status filters. Draft creation for local NOTAMs (not persisted to DB — see tech debt). FAA sync API stubbed.

**Obstruction Evaluations** (`/obstructions`, `/obstructions/history`, `/obstructions/[id]`) — UFC 3-260-01 Class B imaginary surface analysis (all 6 surfaces). Interactive Mapbox map with color-coded overlays, geodesic calculations, Open-Elevation API, multi-photo, violation detection with UFC table references.

### Supporting infrastructure:

- **Auth**: Email/password login + sign-up, demo-mode bypass
- **Demo mode**: Full offline operation with mock data when Supabase env vars missing
- **PDF export**: jsPDF client-side generation for inspections (single + combined reports + special forms)
- **Database**: 11 tables, 5 migrations applied, RLS currently disabled
- **Components**: Header, bottom nav, page header, badges, buttons, cards, inputs, skeletons, modals, Mapbox maps (location + airfield)

---

## What's NOT Built Yet

| Feature | Status | Notes |
|---------|--------|-------|
| **Server-side email** | Planned | User wants branded sender (e.g. `AFMtoolkit@info.com`). Need Next.js API route + email provider (Resend/SendGrid/SES). Just a POST of the existing PDF blob. |
| **NOTAM sync API** | Stub | `/api/notams/sync` returns placeholder. Needs NASA DIP API integration per SRS 11.1. |
| **Weather METAR API** | Stub | `/api/weather` returns placeholder. Needs aviationweather.gov integration per SRS 11.2. Client-side `lib/weather.ts` uses Open-Meteo but dashboard may not be calling it. |
| **Offline / PWA** | Not started | `manifest.json` exists but icons are missing. No service worker, no IndexedDB caching. |
| **Role-based access** | Disabled | RLS stripped for MVP. 8 user roles defined in constants but not enforced. |
| **Real-time sync** | Not started | Supabase Realtime subscriptions not wired. |
| **Reports module** | Not started | `/more` page links to `#` for Reports. |
| **User management** | Not started | `/more` page links to `#` for Users. |
| **Testing** | Not started | No test files exist. |

---

## Known Tech Debt

This was audited on 2026-02-18. Full details are in `PROJECT_STATUS.md` under "Tech Debt & Cleanup". Summary:

### Must Fix Before Production

- **RLS disabled** — all authenticated users have full CRUD on all tables
- **50+ `eslint-disable @typescript-eslint/no-explicit-any`** — spread across all Supabase CRUD modules
- **Validator enum mismatch** — `lib/validators.ts` `statusUpdateSchema` uses old enum values (`assigned`, `in_progress`, `resolved`) that don't match actual app statuses (`open`, `completed`, `cancelled`)
- **KPI query bug** — `lib/supabase/discrepancies.ts` `fetchDiscrepancyKPIs()` filters by `status not in ('closed')` but `'closed'` is not a valid status
- **Hardcoded inspector** — `app/(app)/checks/page.tsx:32` has `"MSgt Proctor"` instead of reading from auth

### Should Clean Up

- **Dead route** — `app/(app)/inspections/new/page.tsx` just redirects to `/inspections`, can be deleted
- **NOTAM drafts** — `app/(app)/notams/new/page.tsx` shows success toast but never saves to DB
- **Supabase config check** duplicated 4 times (middleware, client, server, supabase middleware) — extract to shared `lib/supabase/config.ts`
- **Mapbox token validation** duplicated in `location-map.tsx` and `airfield-map.tsx`
- **Surface color constants** duplicated between `airfield-map.tsx` and `obstructions/[id]/page.tsx`
- **Photo count** manually incremented — can desync on partial failure
- **Base64 photo fallback** — when Storage unavailable, photos stored as data URLs in DB (not scalable)
- **Missing PWA icons** — `manifest.json` references `/icons/icon-192.png` and `/icons/icon-512.png` that don't exist
- **Dashboard activity feed** — hardcoded placeholder, never reads `activity_log` table
- **Dashboard weather** — may silently fall back to hardcoded mock data (28°F, Clear)

### Large Files to Consider Splitting

| File | ~Lines | Contents |
|------|--------|----------|
| `app/(app)/inspections/page.tsx` | 1,200 | Workspace + history + draft management |
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

---

## Database

**Schema:** `supabase/schema.sql` — 11 tables with sequences and `generate_display_id()` function.

**Tables:** `profiles`, `discrepancies`, `airfield_checks`, `check_comments`, `inspections`, `notams`, `photos`, `status_updates`, `obstruction_evaluations`, `activity_log`

**Migrations (applied in order):**
1. `20260216_update_inspections_table.sql` — dual inspection types, BWC, conditional sections
2. `20260217_add_daily_group_id.sql` — linked daily report pairs
3. `20260217_add_inspection_fields.sql` — inspector name, weather, temperature
4. `20260217_remove_rls_policies.sql` — stripped all RLS for MVP
5. `20260218_add_personnel_and_special_types.sql` — personnel array, construction_meeting/joint_monthly types

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

## File Map (65 source files)

```
airfield-app/
├── app/
│   ├── layout.tsx                          # Root layout, metadata, Sonner toasts
│   ├── globals.css                         # Dark theme styles, card/input/button classes
│   ├── login/page.tsx                      # Email/password auth + demo bypass
│   ├── (app)/
│   │   ├── layout.tsx                      # App shell: header + bottom nav, 480px max-width
│   │   ├── page.tsx                        # Dashboard: clock, weather, KPIs, quick actions
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
│   │   ├── notams/
│   │   │   ├── page.tsx                    # NOTAM list (demo data only)
│   │   │   ├── new/page.tsx                # Draft form (NOT PERSISTED)
│   │   │   └── [id]/page.tsx               # NOTAM detail
│   │   ├── obstructions/
│   │   │   ├── page.tsx                    # Evaluation form + Mapbox + UFC analysis
│   │   │   ├── [id]/page.tsx               # Evaluation results + photo gallery
│   │   │   └── history/page.tsx            # Evaluation history
│   │   └── more/page.tsx                   # Settings hub (some links are #)
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
│   ├── validators.ts                       # Zod schemas (STATUS ENUM MISMATCH)
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
│       ├── server.ts                       # Server-side Supabase client
│       ├── middleware.ts                    # Auth session update for middleware
│       ├── types.ts                        # TypeScript types for all DB tables
│       ├── checks.ts                       # Checks CRUD + photos + comments
│       ├── discrepancies.ts                # Discrepancies CRUD + KPIs + photos
│       ├── inspections.ts                  # Inspections CRUD + daily groups
│       └── obstructions.ts                 # Obstruction evaluations CRUD + photos
├── supabase/
│   ├── schema.sql                          # Master schema (11 tables)
│   └── migrations/                         # 5 migration files
├── middleware.ts                            # Auth guard + demo mode bypass
├── public/manifest.json                    # PWA manifest (ICONS MISSING)
├── .env.example                            # Env var template
├── tailwind.config.ts                      # Dark theme color system
├── next.config.js                          # Image remotes for Supabase
├── tsconfig.json                           # Strict mode, path aliases
├── SRS.md                                  # Software Requirements Specification
├── Airfield_OPS_Unified_Prototype.jsx      # Original React UI prototype
├── Claude_Code_Starter_Prompt.md           # Original build instructions
├── PROJECT_STATUS.md                       # Architecture + tech debt audit
├── CHANGELOG.md                            # Version history v0.0.1–v0.9.0
└── README.md                               # Setup guide + module docs
```

---

## User Preferences & Decisions (from conversations)

- **Server-side email** is deferred to the refining stage. User wants a branded sender address like `AFMtoolkit@info.com` via a backend API route, not client-side `mailto:`.
- **Inspection checklists** have been refined through multiple iterations — Runway 01/19 (not 05/23), no Hot Pits, no Parking Loops, no Traffic Lights, no North/South Ramp.
- **Construction Meeting and Joint Monthly** are standalone inspection types, not just conditional sections on daily inspections.
- **Personnel tracking** with representative name text fields was added for special inspection types.
- **Airfield Diagram** button is a placeholder — user acknowledged it's for later.

---

## Suggested Next Phase Priorities

1. **Tech debt cleanup** — fix the validator enum mismatch, KPI query bug, hardcoded inspector name, and dead `/inspections/new` route. Quick wins that prevent bugs.
2. **NOTAM persistence** — wire the draft form to actually save to Supabase.
3. **Dashboard** — replace placeholder activity feed and weather with real data.
4. **Server-side email** — Next.js API route that accepts PDF blob and sends via email provider.
5. **PWA icons** — generate 192px and 512px icons for installability.
6. **Supabase integration testing** — connect to a real project, verify auth flow end-to-end.
7. **RLS re-enablement** — design role-based policies based on the 8 user roles in `lib/constants.ts`.
