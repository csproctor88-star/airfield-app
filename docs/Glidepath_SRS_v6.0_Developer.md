# Glidepath Software Requirements Specification

**Developer / Technical Edition**

| Field | Value |
|---|---|
| **Document Title** | Glidepath SRS v6.0 — Developer / Technical Edition |
| **Version** | 6.0 |
| **Date** | 2026-03-21 |
| **Classification** | UNCLASSIFIED |
| **Application Version** | 2.26.0 |
| **Audience** | Software developers, platform engineers, security reviewers, DevSecOps teams |
| **Maintainer** | Glidepath Engineering Team |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [Architecture & Design Decisions](#3-architecture--design-decisions)
4. [Technology Stack](#4-technology-stack)
5. [Project Structure](#5-project-structure)
6. [Functional Requirements](#6-functional-requirements)
7. [Database Schema](#7-database-schema)
8. [API Routes](#8-api-routes)
9. [Row-Level Security Architecture](#9-row-level-security-architecture)
10. [Authentication & Authorization](#10-authentication--authorization)
11. [Multi-Base Architecture](#11-multi-base-architecture)
12. [UI Design System](#12-ui-design-system)
13. [Export & Reporting System](#13-export--reporting-system)
14. [External Integrations](#14-external-integrations)
15. [Offline & PWA Strategy](#15-offline--pwa-strategy)
16. [Non-Functional Requirements](#16-non-functional-requirements)
17. [Security & Compliance Posture](#17-security--compliance-posture)
18. [Known Technical Debt](#18-known-technical-debt)
19. [Deployment & Platform One Path](#19-deployment--platform-one-path)
20. [Glossary](#20-glossary)

---

## 1. Executive Summary

Glidepath is a progressive web application (PWA) purpose-built for Department of the Air Force (DAF) airfield management operations. It replaces fragmented manual processes -- paper checklists, Excel trackers, and disconnected email workflows -- with a unified digital platform spanning discrepancy tracking, airfield inspections, NAVAID outage compliance, wildlife hazard management, obstruction evaluation, and real-time status dashboards.

The system is architected as a single-page Next.js application backed by Supabase (PostgreSQL + Auth + Storage + Realtime). All data is tenant-isolated by installation (base) using row-level security (RLS) policies, enabling a single deployment to serve multiple Air Force installations simultaneously.

**Key metrics (v2.26.0, March 2026):**

| Metric | Value |
|---|---|
| Source files (.ts/.tsx) | 204 |
| Routes (page.tsx) | 53 |
| Database migrations | 121 |
| Lines of code | 101,604 |
| Database tables | 49+ |
| PDF generators | 16 |
| Map components | 6 |
| API routes | 9 |

---

## 2. System Overview

### 2.1 Purpose

Glidepath digitizes the full lifecycle of airfield management operations as governed by DAFMAN 13-204 (Airfield Operations Procedures), UFC 3-260-01 (Airfield and Heliport Planning), and related publications. It provides:

- **Discrepancy lifecycle management** from reporting through CES coordination to closure verification
- **Inspection workflows** for daily airfield/lighting inspections, construction meetings, joint monthly inspections, and annual ACSI compliance audits
- **Airfield checks** (FOD walks, RSC measurements, IFE responses, BASH surveys, etc.)
- **Real-time airfield status** with advisory management, runway conditions, BWC, and ARFF categories
- **NAVAID outage tracking** with automated DAFMAN 13-204v2 Table A3.1 compliance calculations
- **Infrastructure mapping** with 23 feature types, bar-level outage analysis, and KML import
- **Obstruction evaluation** against UFC imaginary surfaces
- **Waiver management** with multi-office coordination workflows
- **Wildlife hazard tracking** (BASH sightings, strikes, BWC history)
- **Parking plan management** with to-scale aircraft silhouettes and clearance calculations
- **Quick Reaction Checklists (QRC)** for emergency response procedures
- **Comprehensive reporting** including daily operations summaries, aging reports, trend analytics, and lighting reports

### 2.2 System Context Diagram

```
+-------------------+       HTTPS        +-------------------+
|                   |  <--------------->  |                   |
|   Browser (PWA)   |                     |   Next.js App     |
|   - React SPA     |                     |   - SSR/SSG       |
|   - Service Worker|                     |   - API Routes    |
|   - IndexedDB     |                     |   - Middleware     |
|                   |                     |                   |
+-------------------+                     +--------+----------+
                                                   |
                            +----------------------+----------------------+
                            |                      |                      |
                    +-------v-------+    +---------v--------+   +--------v--------+
                    |   Supabase    |    |   Supabase       |   |   Supabase      |
                    |   PostgreSQL  |    |   Auth (GoTrue)  |   |   Storage       |
                    |   + RLS       |    |   JWT sessions   |   |   (photos)      |
                    |   + Realtime  |    |                  |   |                 |
                    +---------------+    +------------------+   +-----------------+

                    +-----------+  +----------+  +---------+  +-----------+
                    | Mapbox GL |  | Resend   |  | Open-   |  | Google    |
                    | (maps)    |  | (email)  |  | Meteo   |  | Elevation |
                    +-----------+  +----------+  +---------+  +-----------+
```

### 2.3 User Roles

| Role | Code | Scope | Description |
|---|---|---|---|
| System Admin | `sys_admin` | Global | Full access across all installations; user management; bypasses all RLS |
| Base Admin | `base_admin` | Installation | User management within assigned base; full operational access |
| Airfield Manager | `airfield_manager` | Installation | Full operational access; template management; settings |
| NAMO | `namo` | Installation | Full operational access (NAVAID-focused) |
| AMOPS | `amops` | Installation | Full operational access (operations-focused) |
| CES | `ces` | Installation | Restricted to CES Work Orders, Discrepancies (update only), Visual NAVAIDs, Settings |
| Safety | `safety` | Installation | Read-only with safety-specific views |
| ATC | `atc` | Installation | Read-only with ATC-relevant views |
| Read Only | `read_only` | Installation | View-only access to all modules |

---

## 3. Architecture & Design Decisions

### 3.1 Client-Heavy SPA with Thin API Layer

Glidepath follows a client-heavy architecture where the Next.js frontend communicates directly with Supabase via the `@supabase/ssr` client. Server-side API routes exist only for operations requiring:

- Server-side secrets (Google Elevation API key, Resend API key)
- Administrative operations requiring service-role access (user deletion, invitation)
- Complex multi-step operations (bulk infrastructure import)

**Rationale**: This minimizes custom backend surface area, leverages Supabase's built-in RLS for authorization, and enables real-time subscriptions without a custom WebSocket server.

### 3.2 Multi-Tenancy via Row-Level Security

Every operational table includes a `base_id` foreign key. PostgreSQL RLS policies enforce tenant isolation at the database level, making it impossible for a client to read or write data belonging to another installation -- even if the application code contains a bug.

### 3.3 Demo Mode

When Supabase environment variables are absent, the application operates in demo mode using in-memory data from `lib/demo-data.ts`. The middleware bypasses authentication entirely, and CRUD modules return demo arrays instead of querying the database.

### 3.4 Draft Persistence Strategy

Inspections, checks, and ACSI inspections use a hybrid draft persistence model:

| Entity | Primary | Fallback | Cross-Device |
|---|---|---|---|
| Airfield Checks | Supabase `draft_data` JSONB | localStorage | Yes (manual save) |
| Inspections | localStorage (auto-save) | -- | Supabase load on mount |
| ACSI Inspections | localStorage (auto-save) | -- | DB auto-save on mount |

### 3.5 One-Per-Day Inspection Enforcement

Hard-locked to one airfield inspection and one lighting inspection per calendar day (installation timezone). The enforcement boundary resets at 0600 local time (configurable via `bases.checklist_reset_time`). Cross-user draft isolation ensures sync operations skip other users' in-progress inspections.

### 3.6 Photo Linking Model

Photos use entity-specific foreign key columns rather than a generic polymorphic `entity_type`/`entity_id` pattern:

```
photos.discrepancy_id  → discrepancies.id
photos.check_id        → airfield_checks.id
photos.inspection_id   → inspections.id
photos.acsi_inspection_id → acsi_inspections.id
photos.acsi_item_id    → (item-level ACSI photos)
photos.issue_index     → per-issue/per-discrepancy linking
```

**Rationale**: Entity-specific FKs enable PostgreSQL foreign key constraints and efficient JOIN patterns. The `issue_index` column enables per-issue photo association within checks and inspections.

### 3.7 Zulu Time Convention

All timestamps displayed in the application use Zulu (UTC) format via dedicated utilities: `formatZuluTime()`, `formatZuluDate()`, `formatZuluDateTime()`, `formatZuluDateShort()` in `lib/utils.ts`. The sole exception is the daily operations report date picker, which uses local time.

---

## 4. Technology Stack

### 4.1 Runtime Dependencies

| Package | Version | Purpose |
|---|---|---|
| `next` | 14.2.35 | React framework (App Router, SSR, API routes, middleware) |
| `react` / `react-dom` | 18.3.1 | UI rendering |
| `typescript` | 5.9.3 | Type system |
| `@supabase/ssr` | 0.8.0 | Supabase server-side client (cookie-based auth) |
| `@supabase/supabase-js` | 2.95.3 | Supabase JavaScript client |
| `mapbox-gl` | 3.18.1 | Interactive maps (6 components) |
| `jspdf` | 4.1.0 | PDF generation |
| `jspdf-autotable` | 5.0.7 | PDF table rendering |
| `resend` | 6.9.3 | Email delivery |
| `xlsx` (SheetJS) | 0.18.5 | Excel export (basic) |
| `exceljs` | 4.4.0 | Excel export (styled) |
| `zod` | 3.25.76 | Runtime schema validation |
| `lucide-react` | 0.563.0 | Icon library |
| `sonner` | 1.7.4 | Toast notifications |
| `react-pdf` | 10.3.0 | PDF viewing |
| `react-zoom-pan-pinch` | 3.7.0 | Image zoom/pan |
| `date-fns` | 3.6.0 | Date utilities |
| `clsx` | 2.1.1 | Conditional CSS class joining |
| `@ducanh2912/next-pwa` | 10.2.9 | PWA service worker generation |

### 4.2 Development Dependencies

| Package | Version | Purpose |
|---|---|---|
| `eslint` | 9.39.3 | Linting |
| `eslint-config-next` | 16.1.6 | Next.js ESLint rules |
| `tailwindcss` | 3.4.19 | Utility CSS (used alongside custom properties) |
| `postcss` | 8.5.6 | CSS processing |
| `autoprefixer` | 10.4.24 | CSS vendor prefixes |
| `pdf-parse` | 2.4.5 | PDF text extraction (dev tooling) |
| `pdfjs-dist` | 3.11.174 | PDF rendering engine |

### 4.3 External Services

| Service | Purpose | Auth Method |
|---|---|---|
| Supabase | Database, Auth, Storage, Realtime | Project URL + anon key (client), service role key (server) |
| Mapbox | Interactive maps, Static Images API | Access token (client-side, env var) |
| Resend | Transactional email delivery | API key (server-side only) |
| Google Elevation API | Terrain elevation lookups | API key (server-side proxy) |
| Open-Meteo | Weather data for wildlife forms | None (free API) |
| FAA NOTAMs | NOTAM synchronization | None (public endpoint) |

---

## 5. Project Structure

```
airfield-app/
├── app/
│   ├── layout.tsx                    # Root layout: metadata, PWA manifest, Toaster
│   ├── globals.css                   # Design tokens, themes, responsive breakpoints
│   ├── login/page.tsx                # Auth page, demo auto-login (?demo=true)
│   ├── reset-password/page.tsx       # Password reset flow
│   ├── setup-account/page.tsx        # Invited user account setup
│   ├── auth/confirm/route.ts         # OTP/PKCE token exchange
│   ├── api/                          # 9 server-side API routes
│   │   ├── admin/
│   │   │   ├── invite/route.ts       # POST: User invitation via Resend
│   │   │   ├── reset-password/route.ts # POST: Admin-initiated password reset
│   │   │   └── users/[id]/route.ts   # PATCH/DELETE: User management
│   │   ├── airfield-status/route.ts  # POST: Status updates with audit logging
│   │   ├── elevation/route.ts        # GET: Google Elevation API proxy
│   │   ├── infrastructure-import/route.ts # POST: Bulk KML/GeoJSON/CSV import
│   │   ├── installations/route.ts    # GET/POST: Installation listing/creation
│   │   ├── notams/route.ts           # GET: NOTAM sync from FAA
│   │   └── send-pdf-email/route.ts   # POST: Email PDF via Resend
│   └── (app)/                        # Authenticated route group (53 routes)
│       ├── page.tsx                   # Status board (home)
│       ├── dashboard/page.tsx         # Real-time dashboard
│       ├── discrepancies/             # List, create, detail
│       ├── inspections/               # List, detail, construction, joint-monthly
│       ├── checks/                    # List, detail, history
│       ├── acsi/                      # List, create, detail
│       ├── infrastructure/page.tsx    # NAVAID infrastructure map (~4,090 lines)
│       ├── parking/page.tsx           # Parking plan management (~3,840 lines)
│       ├── obstructions/              # Evaluation, history, detail
│       ├── waivers/                   # List, create, edit, detail, annual review
│       ├── wildlife/page.tsx          # Sightings and strikes
│       ├── qrc/page.tsx               # Quick Reaction Checklists
│       ├── shift-checklist/page.tsx   # Shift duty checklists
│       ├── notams/                    # List, create, detail
│       ├── contractors/page.tsx       # Airfield contractor tracking
│       ├── activity/page.tsx          # Events log
│       ├── reports/                   # Daily ops, discrepancy, aging, lighting, trends
│       ├── regulations/page.tsx       # Regulations library
│       ├── library/page.tsx           # Document library
│       ├── aircraft/page.tsx          # Aircraft reference
│       ├── users/page.tsx             # User management
│       ├── ces/page.tsx               # CES work order dashboard
│       ├── more/page.tsx              # Mobile "More" menu
│       └── settings/                  # App settings, base setup, templates
├── components/
│   ├── layout/                        # Header, Sidebar, BottomNav, AppShell
│   ├── ui/                            # Reusable: Badge, StatusBadge, SeverityBadge,
│   │                                  #   ActionButton, PageHeader, EmptyState,
│   │                                  #   LoadingState, DetailGrid, ConfirmDialog,
│   │                                  #   PhotoPickerButton, EmailPdfModal,
│   │                                  #   PdfExportDialog
│   ├── infrastructure/                # AuditPanel, SystemHealthPanel
│   ├── obstructions/                  # AirfieldMap (clearance envelopes)
│   └── dashboard/                     # DashboardProvider
├── lib/
│   ├── supabase/
│   │   ├── client.ts                  # Browser Supabase client factory
│   │   ├── server.ts                  # Server Supabase client factory
│   │   ├── types.ts                   # Database type definitions (1,241 lines)
│   │   ├── discrepancies.ts           # Discrepancy CRUD
│   │   ├── inspections.ts             # Inspection CRUD
│   │   ├── checks.ts                  # Check CRUD
│   │   ├── acsi.ts                    # ACSI inspection CRUD
│   │   ├── infrastructure-features.ts # Infrastructure CRUD + display names
│   │   ├── parking.ts                 # Parking plan CRUD (5 tables)
│   │   ├── activity.ts                # Activity logging (logActivity, logManualEntry)
│   │   └── ... (23 CRUD modules total)
│   ├── calculations/
│   │   ├── geometry.ts                # Bar placement, offsetPoint()
│   │   ├── obstructions.ts            # UFC imaginary surface calculations
│   │   └── parking-clearance.ts       # Aircraft clearance calculations
│   ├── reports/
│   │   ├── analytics-data.ts          # 30-day metrics aggregation
│   │   └── ... (PDF generator modules)
│   ├── constants.ts                   # Type configs, status configs, ACSI checklist
│   ├── utils.ts                       # Zulu time, friendlyError, Mapbox helpers
│   ├── demo-data.ts                   # 10 demo arrays for offline mode
│   ├── weather.ts                     # Open-Meteo integration
│   ├── outage-rules.ts               # DAFMAN 13-204v2 compliance engine (~460 lines)
│   ├── pdf-config.ts                  # Shared PDF builder utilities
│   ├── email-pdf.ts                   # sendPdfViaEmail()
│   ├── installation-context.tsx       # InstallationProvider
│   ├── dashboard-context.tsx          # DashboardProvider
│   ├── theme-context.tsx              # ThemeContext (light/dark)
│   └── sidebar-context.tsx            # SidebarContext
├── supabase/
│   ├── schema.sql                     # Base table definitions
│   ├── migrations/ (121 files)        # Incremental schema migrations
│   └── seed-demo-base.sql             # Demo AFB cloning script
├── middleware.ts                       # Auth guard + demo mode bypass
├── public/
│   ├── manifest.json                  # PWA manifest
│   ├── sw.js                          # Service worker (generated)
│   ├── icons/                         # App icons
│   └── aircraft/                      # SVG aircraft silhouettes
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
└── postcss.config.js
```

---

## 6. Functional Requirements

### 6.1 Discrepancy Management (FR-100)

| ID | Requirement |
|---|---|
| FR-101 | Create discrepancies with type (11 categories), severity, location (text + coordinates), photos, and optional infrastructure feature linkage |
| FR-102 | Auto-generate sequential `display_id` per installation |
| FR-103 | Track workflow status through 5 `current_status` stages: Submitted to AFM, Submitted to CES, Awaiting Action by CES, Waiting for Project, Work Completed Awaiting Verification |
| FR-104 | Track lifecycle status: Open, Completed, Cancelled |
| FR-105 | Record status change history in `status_updates` table with notes and attribution |
| FR-106 | Support CES work order number and facility number assignment |
| FR-107 | Link discrepancies to infrastructure features and lighting systems for NAVAID outage correlation |
| FR-108 | Generate single-discrepancy PDF exports with photos and location maps |
| FR-109 | Support configurable type-to-CE-shop mapping per installation (`discrepancy_type_shop_map` JSONB) |
| FR-110 | CES role users restricted to UPDATE only (no create/delete); status modal limited to In Work/Project/Work Completed |
| FR-111 | Natural language discrepancy title auto-generation from type and location |

### 6.2 Airfield Inspections (FR-200)

| ID | Requirement |
|---|---|
| FR-201 | Support 4 inspection types: Airfield, Lighting, Construction Meeting, Joint Monthly |
| FR-202 | Enforce one airfield + one lighting inspection per calendar day (installation timezone, 0600L reset) |
| FR-203 | Default all items to "pass"; toggle cycle: pass -> fail -> N/A -> pass |
| FR-204 | Support per-item discrepancy logging with optional auto-creation of airfield discrepancies |
| FR-205 | Per-item and per-discrepancy photo attachment via `issue_index` |
| FR-206 | Record weather conditions (BWC, RSC, RCR, temperature) |
| FR-207 | Draft auto-save to localStorage with cross-device resume via Supabase `draft_data` |
| FR-208 | Track inspection lifecycle: created_at -> completed_at -> filed_at with attribution |
| FR-209 | Cross-user draft isolation (sync skips other users' inspections) |
| FR-210 | Inspection average time calculation from `created_at` to `filed_at` |
| FR-211 | Support base-specific inspection templates (3-level hierarchy: template -> section -> item) |
| FR-212 | Link inspection items to lighting systems via `inspection_item_system_links` bridge table |
| FR-213 | Sync NAVAID status from lighting inspection results |

### 6.3 Airfield Checks (FR-300)

| ID | Requirement |
|---|---|
| FR-301 | Support 7 check types: FOD, RSC, IFE, Ground Emergency, Heavy Aircraft, BASH, RCR |
| FR-302 | Capture `started_at` timestamp when user selects check type |
| FR-303 | Data stored as flexible JSONB (`data` column) per check type schema |
| FR-304 | Per-issue photo attachment via `issue_index` |
| FR-305 | Draft persistence to Supabase `draft_data` JSONB + localStorage fallback |
| FR-306 | Cross-device draft resume on check type selection |
| FR-307 | Check average time calculation from `started_at` to `completed_at` |
| FR-308 | Check comments system for post-submission annotations |

### 6.4 ACSI Inspections (FR-400)

| ID | Requirement |
|---|---|
| FR-401 | 10 sections, approximately 100 checklist items per DAFMAN compliance |
| FR-402 | Per-item response: Pass/Fail/N/A with "Mark All Y" bulk action |
| FR-403 | Per-item discrepancy details: comment, work order, project number, estimated cost, completion date, photos, map pins |
| FR-404 | Inspection team roster and risk certification signature blocks |
| FR-405 | Draft auto-save to localStorage + DB auto-save on mount |
| FR-406 | PDF export with parent/sub-field hierarchy, inline photos/maps, `didParseCell`/`didDrawCell` hooks |
| FR-407 | Lifecycle: Draft -> In Progress -> Completed -> Staffed |
| FR-408 | Per-item photos linked via `acsi_item_id` foreign key |

### 6.5 Real-Time Airfield Status (FR-500)

| ID | Requirement |
|---|---|
| FR-501 | Display and update advisory type, active runway, runway status |
| FR-502 | Track per-runway status via `runway_statuses` JSONB |
| FR-503 | ARFF category and per-vehicle status tracking |
| FR-504 | RSC condition, RCR values (touchdown/midpoint/rollout), BWC value |
| FR-505 | Supabase Realtime subscription for `airfield_status` UPDATE events |
| FR-506 | All status changes logged to `runway_status_log` with attribution |
| FR-507 | All status changes logged to `activity_log` with `entity_id = installationId` |

### 6.6 Quick Reaction Checklists (FR-600)

| ID | Requirement |
|---|---|
| FR-601 | Template-based QRCs with configurable steps: checkbox, checkbox_with_note, notify_agencies, fill_field, time_field, conditional |
| FR-602 | QRC execution tracking: open/closed lifecycle with step responses, attribution, timestamps |
| FR-603 | Emergency QRCs with `has_scn_form` log "SECONDARY CRASH NET ACTIVATED" |
| FR-604 | Cancel action deletes `activity_log` entries by `entity_id` |
| FR-605 | Agency notification tracking (SOF, Fire Chief/ARFF, Wing Safety, MOC, etc.) |

### 6.7 Infrastructure & Visual NAVAIDs (FR-700)

| ID | Requirement |
|---|---|
| FR-701 | 23 feature types including runway end lights; canvas-rendered icons; configurable rotation |
| FR-702 | Feature placement: manual click, GPS tracking, bar placement mode with `offsetPoint()` |
| FR-703 | 4 legend groups for feature type visibility; layer-based source visibility |
| FR-704 | Fixture ID generation: `{SystemPrefix}-{TypeAbbrev}-{###}` (e.g., `TWYK-TL-001`) |
| FR-705 | Sign rendering with dynamic color from `SIGN_COLORS` map and editable sign text |
| FR-706 | KML/GeoJSON/CSV/DXF import with deduplication and configurable mapping |
| FR-707 | Audit Mode panel: filter-based component assignment, sequential labeling, bulk delete, bar group management |
| FR-708 | Paginated feature fetch via `.range()` in batches of 1,000 |
| FR-709 | Feature type constrained by PostgreSQL CHECK constraint (`infrastructure_features_feature_type_check`) |

### 6.8 Outage Compliance Engine (FR-800)

| ID | Requirement |
|---|---|
| FR-801 | Implement DAFMAN 13-204v2 Table A3.1 outage rules for 23 system types |
| FR-802 | Calculate component-level outage: percentage, count, consecutive, spatial adjacency |
| FR-803 | Bar-level analysis: 3+ inoperative lights per bar threshold (`BAR_INOP_THRESHOLD = 3`) |
| FR-804 | 4-tier alert system: green (operational), yellow (approaching), red (exceeded), black (inoperative) |
| FR-805 | System health panel with outage timeline and bar-level detail |
| FR-806 | Map health rings layer (`system-health-ring`) with "Color by health" toggle |
| FR-807 | Reporting outage auto-creates discrepancy with structured description and DAFMAN bar-out note |
| FR-808 | Marking feature operational prompts to close linked discrepancies with attribution + Zulu timestamp |
| FR-809 | NOTAM template generation with Q-codes |
| FR-810 | Outage events reported/resolved with `outage_events` audit trail |

### 6.9 Obstruction Evaluation (FR-900)

| ID | Requirement |
|---|---|
| FR-901 | Evaluate object height against UFC imaginary surfaces per runway class (B, Army B) |
| FR-902 | Calculate controlling surface and violated surfaces |
| FR-903 | Map visualization with clearance envelope rendering (taxiway OFA/Safety Area polygons) |
| FR-904 | FAA TDG-based OFA + Safety Area; UFC Class A/B Clearance Line |
| FR-905 | Link obstructions to discrepancies |
| FR-906 | Google Elevation API integration for terrain data |

### 6.10 Waiver Management (FR-1000)

| ID | Requirement |
|---|---|
| FR-1001 | Waiver lifecycle: Draft -> Pending -> Approved -> Active -> Completed/Cancelled/Expired |
| FR-1002 | 6 classification types: permanent, temporary, construction, event, extension, amendment |
| FR-1003 | Multi-criteria tracking from UFC 3-260-01, UFC 3-260-04, UFC 3-535-01 |
| FR-1004 | Multi-office coordination workflow: CE, AFM, TERPS, Safety, Installation CC |
| FR-1005 | Annual review tracking with facilities board presentation date |
| FR-1006 | Attachment management: photos, site maps, risk assessments, UFC excerpts, AF Form 505 |
| FR-1007 | Hazard rating (Low/Medium/High/Extremely High) and FAA case number tracking |

### 6.11 Wildlife Hazard Management (FR-1100)

| ID | Requirement |
|---|---|
| FR-1101 | Wildlife sighting records with species, count, behavior, location, airfield zone |
| FR-1102 | Wildlife strike records with FAA-aligned fields (aircraft, phase of flight, damage, cost) |
| FR-1103 | BWC history tracking with source attribution |
| FR-1104 | Per-installation species favorites with `is_favorite` toggle and gold-border display |
| FR-1105 | Weather auto-fill from Open-Meteo (`weatherToFormFields()`) |
| FR-1106 | Sighting-to-strike linkage via `sighting_id` FK |
| FR-1107 | Integration with BASH check type |

### 6.12 Parking Plan Management (FR-1200)

| ID | Requirement |
|---|---|
| FR-1201 | Create/manage parking plans with spots, obstacles, taxilanes, apron boundaries |
| FR-1202 | To-scale SVG aircraft silhouettes via `computeIconScale()` with 2D distance, continuous rescaling on zoom/rotate/pitch |
| FR-1203 | Obstacle locking with ref-based drag guard |
| FR-1204 | Tabbed sidebar: Aircraft, Environment, Clearance, Settings |
| FR-1205 | PDF capture: temporary resize to 1600x900, flatten pitch, canvas `toDataURL()` |
| FR-1206 | Clearance calculations against obstacles and taxilane boundaries |
| FR-1207 | Persistent storage across 5 tables (not ephemeral) |
| FR-1208 | `preserveDrawingBuffer: true` for canvas capture; `pixelRatio: 1` for `addImage` |

### 6.13 Shift Checklists (FR-1300)

| ID | Requirement |
|---|---|
| FR-1301 | Configurable checklist items per installation (label, shift, frequency, sort order) |
| FR-1302 | Daily checklist instances with item-level responses |
| FR-1303 | Completion tracking with attribution and timestamps |

### 6.14 NOTAM Management (FR-1400)

| ID | Requirement |
|---|---|
| FR-1401 | Local NOTAM creation with status lifecycle: Draft -> Active -> Cancelled/Expired |
| FR-1402 | FAA NOTAM sync from `notams.aim.faa.gov` |
| FR-1403 | Discrepancy-to-NOTAM linkage (bidirectional) |
| FR-1404 | NOTAM type classification |

### 6.15 Reports & Analytics (FR-1500)

| ID | Requirement |
|---|---|
| FR-1501 | Daily operations summary PDF with runway status log, outage events, inspection/check summaries |
| FR-1502 | Discrepancy reports with filter-based generation (type, status, date range, shop) |
| FR-1503 | Aging reports with configurable age thresholds |
| FR-1504 | Lighting report with system-level outage summary |
| FR-1505 | 30-day analytics dashboard: inspections (split by type), checks, discrepancies, QRC, personnel, obstructions, parking plans, wildlife |
| FR-1506 | Configurable `days` parameter for analytics window |
| FR-1507 | Average time metrics: inspections (`created_at` -> `filed_at`), checks (`started_at` -> `completed_at`), filtered to >= 1 minute |

### 6.16 Contractor Management (FR-1600)

| ID | Requirement |
|---|---|
| FR-1601 | Track airfield contractors: company, contact, location, work description, status |
| FR-1602 | Radio number, flag number, callsign tracking |
| FR-1603 | Active/Completed status lifecycle |

### 6.17 Regulations & Library (FR-1700)

| ID | Requirement |
|---|---|
| FR-1701 | Regulation catalog with metadata: pub type (DAF/FAA/UFC/DoD/ICAO/CFR), category, tags |
| FR-1702 | PDF upload and storage per regulation per user |
| FR-1703 | Core/cross-reference classification; verification tracking |

### 6.18 User Management (FR-1800)

| ID | Requirement |
|---|---|
| FR-1801 | Admin invitation flow: send email -> magic link -> account setup -> profile + membership creation |
| FR-1802 | Role assignment per installation via `base_members` |
| FR-1803 | User deletion: nullify 12 FK columns across 10 tables before deleting profile + auth user |
| FR-1804 | Password reset (admin-initiated) |
| FR-1805 | Operating initials (max 4 chars) with click-to-reveal in events log |
| FR-1806 | User email privacy: hidden from cards, masked with eye toggle in edit modal |
| FR-1807 | Presence status tracking via `last_seen_at` |
| FR-1808 | Per-session login activity dialog (falls back to `last_seen_at`) |

### 6.19 Settings & Base Setup (FR-1900)

| ID | Requirement |
|---|---|
| FR-1901 | Installation configuration: ICAO, unit, MAJCOM, timezone, elevation, runway class |
| FR-1902 | Runway management with end designators, approach lighting, elevation per end |
| FR-1903 | CE shops configuration with type-to-shop mapping |
| FR-1904 | ARFF aircraft roster |
| FR-1905 | Taxiway configuration with TDG, width, centerline coordinates, standard |
| FR-1906 | Facility number management |
| FR-1907 | Area and NAVAID configuration |
| FR-1908 | Inspection template editor (3-level hierarchy) |
| FR-1909 | Airfield diagram upload to Supabase Storage |
| FR-1910 | Default PDF email configuration |

---

## 7. Database Schema

### 7.1 Core / Configuration Tables

#### `bases`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, default gen_random_uuid() | Installation identifier |
| `name` | TEXT | NOT NULL | Installation display name |
| `icao` | TEXT | NOT NULL | ICAO airport code |
| `unit` | TEXT | | Owning unit designation |
| `majcom` | TEXT | | Major command |
| `location` | TEXT | | Geographic location description |
| `elevation_msl` | NUMERIC | | Field elevation (feet MSL) |
| `timezone` | TEXT | NOT NULL, default 'America/Chicago' | IANA timezone identifier |
| `installation_code` | TEXT | | Installation code |
| `ce_shops` | TEXT[] | NOT NULL, default '{}' | CE shop names array |
| `discrepancy_type_shop_map` | JSONB | NOT NULL, default '{}' | Maps discrepancy types to CE shop names |
| `checklist_reset_time` | TEXT | NOT NULL, default '06:00' | Daily inspection reset time (local) |
| `is_active` | BOOLEAN | NOT NULL, default true | Soft delete flag |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | |

#### `base_runways`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `base_id` | UUID | FK -> bases.id, NOT NULL | |
| `runway_id` | TEXT | NOT NULL | Runway designator (e.g., "13/31") |
| `length_ft` | NUMERIC | NOT NULL | Runway length in feet |
| `width_ft` | NUMERIC | NOT NULL | Runway width in feet |
| `surface` | TEXT | NOT NULL | Surface type (asphalt, concrete, etc.) |
| `true_heading` | NUMERIC | | True heading (degrees) |
| `end1_designator` | TEXT | NOT NULL | First end designator (e.g., "13") |
| `end1_latitude` | NUMERIC | | Latitude of first end |
| `end1_longitude` | NUMERIC | | Longitude of first end |
| `end1_heading` | NUMERIC | | Heading from first end |
| `end1_approach_lighting` | TEXT | | Approach lighting system type |
| `end1_elevation_msl` | NUMERIC | | Threshold elevation (feet MSL) |
| `end2_designator` | TEXT | NOT NULL | Second end designator (e.g., "31") |
| `end2_latitude` | NUMERIC | | |
| `end2_longitude` | NUMERIC | | |
| `end2_heading` | NUMERIC | | |
| `end2_approach_lighting` | TEXT | | |
| `end2_elevation_msl` | NUMERIC | | |
| `runway_class` | TEXT | NOT NULL | UFC runway class (A/B/Army B) |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

#### `base_members`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `base_id` | UUID | FK -> bases.id, NOT NULL | |
| `user_id` | UUID | FK -> profiles.id, NOT NULL | |
| `role` | TEXT | NOT NULL | Role at this installation |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**Unique constraint**: `(base_id, user_id)`

#### `profiles`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, FK -> auth.users.id | |
| `email` | TEXT | NOT NULL | |
| `name` | TEXT | NOT NULL | Display name |
| `first_name` | TEXT | | |
| `last_name` | TEXT | | |
| `rank` | TEXT | | Military rank |
| `role` | UserRole | NOT NULL | Global role (see Section 2.3) |
| `organization` | TEXT | | |
| `shop` | TEXT | | |
| `phone` | TEXT | | |
| `is_active` | BOOLEAN | NOT NULL, default true | |
| `status` | ProfileStatus | NOT NULL | active / deactivated / pending |
| `last_seen_at` | TIMESTAMPTZ | | Last activity timestamp |
| `primary_base_id` | UUID | FK -> bases.id | Default installation |
| `default_pdf_email` | TEXT | | Default email for PDF exports |
| `edipi` | TEXT | | DoD ID number |
| `operating_initials` | TEXT | CHECK(length <= 4) | Operating initials |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | |

#### `base_navaids`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `base_id` | UUID | FK -> bases.id, NOT NULL |
| `navaid_name` | TEXT | NOT NULL |
| `sort_order` | INT | NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |

#### `base_areas`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `base_id` | UUID | FK -> bases.id, NOT NULL |
| `area_name` | TEXT | NOT NULL |
| `sort_order` | INT | NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |

#### `base_arff_aircraft`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `base_id` | UUID | FK -> bases.id, NOT NULL |
| `aircraft_name` | TEXT | NOT NULL |
| `sort_order` | INT | NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |

#### `base_taxiways`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `base_id` | UUID | FK -> bases.id, NOT NULL | |
| `designator` | TEXT | NOT NULL | Taxiway designator (e.g., "A", "K") |
| `taxiway_type` | TEXT | NOT NULL | Taxiway classification |
| `tdg` | NUMERIC | | Taxiway Design Group |
| `width_ft` | NUMERIC | | Taxiway width in feet |
| `centerline_coords` | JSONB | | Array of [lng, lat] coordinate pairs |
| `notes` | TEXT | | |
| `standard` | TEXT | NOT NULL | Applicable standard (FAA/UFC) |
| `runway_class` | TEXT | | |
| `service_branch` | TEXT | | |
| `created_by` | UUID | FK -> profiles.id | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

#### `base_wildlife_species`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `base_id` | UUID | FK -> bases.id, NOT NULL |
| `species_common` | TEXT | NOT NULL |
| `is_favorite` | BOOLEAN | default false |
| `added_by` | UUID | FK -> profiles.id |
| `created_at` | TIMESTAMPTZ | NOT NULL |

### 7.2 Operational Tables

#### `discrepancies`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `display_id` | TEXT | UNIQUE, NOT NULL | Human-readable sequential ID |
| `base_id` | UUID | FK -> bases.id | |
| `type` | TEXT | NOT NULL | Discrepancy type (see constants) |
| `status` | TEXT | NOT NULL | open / completed / cancelled |
| `current_status` | TEXT | NOT NULL | Workflow stage (5 values) |
| `title` | TEXT | NOT NULL | |
| `description` | TEXT | NOT NULL | |
| `location_text` | TEXT | NOT NULL | Human-readable location |
| `latitude` | NUMERIC | | |
| `longitude` | NUMERIC | | |
| `assigned_shop` | TEXT | | CE shop assignment |
| `assigned_to` | UUID | FK -> profiles.id | |
| `reported_by` | UUID | FK -> profiles.id, NOT NULL | |
| `work_order_number` | TEXT | | CES work order number |
| `notam_reference` | TEXT | | NOTAM reference text |
| `linked_notam_id` | UUID | FK -> notams.id | |
| `inspection_id` | UUID | FK -> inspections.id | Source inspection |
| `resolution_notes` | TEXT | | |
| `resolution_date` | TIMESTAMPTZ | | |
| `facility_number` | TEXT | | |
| `infrastructure_feature_id` | UUID | FK -> infrastructure_features.id | Linked NAVAID feature |
| `lighting_system_id` | UUID | FK -> lighting_systems.id | Linked lighting system |
| `photo_count` | INT | NOT NULL, default 0 | Denormalized count |
| `severity` | TEXT | | low / medium / high / critical |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

#### `inspections`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `display_id` | TEXT | NOT NULL | |
| `base_id` | UUID | FK -> bases.id | |
| `inspection_type` | TEXT | NOT NULL | airfield / lighting / construction_meeting / joint_monthly |
| `inspector_id` | UUID | FK -> profiles.id, NOT NULL | |
| `inspector_name` | TEXT | | |
| `inspection_date` | DATE | NOT NULL | |
| `status` | TEXT | NOT NULL | in_progress / completed |
| `items` | JSONB | NOT NULL | Array of InspectionItem |
| `total_items` | INT | NOT NULL | |
| `passed_count` | INT | NOT NULL | |
| `failed_count` | INT | NOT NULL | |
| `na_count` | INT | NOT NULL | |
| `completion_percent` | NUMERIC | NOT NULL | |
| `construction_meeting` | BOOLEAN | NOT NULL | |
| `joint_monthly` | BOOLEAN | NOT NULL | |
| `personnel` | TEXT[] | NOT NULL | |
| `bwc_value` | TEXT | | |
| `rsc_condition` | TEXT | | |
| `rcr_value` | TEXT | | |
| `rcr_condition` | TEXT | | |
| `weather_conditions` | TEXT | | |
| `temperature_f` | NUMERIC | | |
| `notes` | TEXT | | |
| `daily_group_id` | TEXT | | Groups same-day inspections |
| `completed_by_name` | TEXT | | |
| `completed_by_id` | UUID | | |
| `completed_at` | TIMESTAMPTZ | | |
| `filed_by_name` | TEXT | | |
| `filed_by_id` | UUID | | |
| `filed_at` | TIMESTAMPTZ | | |
| `draft_data` | JSONB | | Cross-device draft persistence |
| `saved_by_name` | TEXT | | |
| `saved_by_id` | UUID | | |
| `saved_at` | TIMESTAMPTZ | | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

#### `airfield_checks`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `display_id` | TEXT | NOT NULL | |
| `base_id` | UUID | FK -> bases.id | |
| `check_type` | TEXT | NOT NULL | fod / rsc / ife / ground_emergency / heavy_aircraft / bash / rcr |
| `areas` | TEXT[] | NOT NULL | |
| `data` | JSONB | NOT NULL | Check-type-specific data |
| `completed_by` | UUID | FK -> profiles.id | |
| `completed_at` | TIMESTAMPTZ | | |
| `started_at` | TIMESTAMPTZ | | When check type was selected |
| `latitude` | NUMERIC | | |
| `longitude` | NUMERIC | | |
| `photo_count` | INT | NOT NULL, default 0 | |
| `status` | TEXT | NOT NULL | |
| `draft_data` | JSONB | | Server-side draft persistence |
| `saved_by_name` | TEXT | | |
| `saved_by_id` | UUID | | |
| `saved_at` | TIMESTAMPTZ | | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

#### `acsi_inspections`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `display_id` | TEXT | NOT NULL | |
| `base_id` | UUID | FK -> bases.id | |
| `airfield_name` | TEXT | NOT NULL | |
| `inspection_date` | DATE | NOT NULL | |
| `fiscal_year` | INT | NOT NULL | |
| `status` | TEXT | NOT NULL | draft / in_progress / completed / staffed |
| `items` | JSONB | NOT NULL | Array of AcsiItem |
| `total_items` | INT | NOT NULL | |
| `passed_count` | INT | NOT NULL | |
| `failed_count` | INT | NOT NULL | |
| `na_count` | INT | NOT NULL | |
| `inspection_team` | JSONB | NOT NULL | Array of AcsiTeamMember |
| `risk_cert_signatures` | JSONB | NOT NULL | Array of AcsiSignatureBlock |
| `notes` | TEXT | | |
| `inspector_id` | UUID | FK -> profiles.id | |
| `inspector_name` | TEXT | | |
| `draft_data` | JSONB | | AcsiDraftData |
| `completed_at` | TIMESTAMPTZ | | |
| `completed_by_name` | TEXT | | |
| `completed_by_id` | UUID | | |
| `filed_at` | TIMESTAMPTZ | | |
| `filed_by_name` | TEXT | | |
| `filed_by_id` | UUID | | |
| `saved_at` | TIMESTAMPTZ | | |
| `saved_by_name` | TEXT | | |
| `saved_by_id` | UUID | | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

#### `airfield_status`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `base_id` | UUID | FK -> bases.id | One row per installation |
| `advisory_type` | TEXT | | none / normal / caution / closed |
| `advisory_text` | TEXT | | Free-text advisory |
| `active_runway` | TEXT | NOT NULL | Current active runway |
| `runway_status` | TEXT | NOT NULL | |
| `runway_statuses` | JSONB | NOT NULL | Per-runway status map |
| `arff_cat` | INT | | ARFF category (1-10) |
| `arff_statuses` | JSONB | NOT NULL | Per-vehicle status map |
| `rsc_condition` | TEXT | | |
| `rsc_updated_at` | TIMESTAMPTZ | | |
| `rcr_touchdown` | TEXT | | |
| `rcr_midpoint` | TEXT | | |
| `rcr_rollout` | TEXT | | |
| `rcr_condition` | TEXT | | |
| `rcr_updated_at` | TIMESTAMPTZ | | |
| `bwc_value` | TEXT | | |
| `bwc_updated_at` | TIMESTAMPTZ | | |
| `updated_by` | UUID | FK -> profiles.id | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

#### `photos`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `discrepancy_id` | UUID | FK -> discrepancies.id | |
| `check_id` | UUID | FK -> airfield_checks.id | |
| `inspection_id` | UUID | FK -> inspections.id | |
| `inspection_item_id` | UUID | | Inspection item identifier |
| `acsi_inspection_id` | UUID | FK -> acsi_inspections.id | |
| `acsi_item_id` | TEXT | | ACSI item identifier |
| `base_id` | UUID | FK -> bases.id | |
| `storage_path` | TEXT | NOT NULL | Path within Storage bucket |
| `thumbnail_path` | TEXT | | |
| `file_name` | TEXT | NOT NULL | |
| `file_size` | INT | | Bytes |
| `mime_type` | TEXT | NOT NULL | |
| `latitude` | NUMERIC | | EXIF GPS latitude |
| `longitude` | NUMERIC | | EXIF GPS longitude |
| `captured_at` | TIMESTAMPTZ | | |
| `uploaded_by` | UUID | FK -> profiles.id, NOT NULL | |
| `issue_index` | INT | | Per-issue/per-discrepancy linking |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

#### `notams`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `notam_number` | TEXT | NOT NULL | |
| `base_id` | UUID | FK -> bases.id | |
| `source` | TEXT | NOT NULL | faa / local |
| `status` | TEXT | NOT NULL | draft / active / cancelled / expired |
| `notam_type` | TEXT | | |
| `title` | TEXT | NOT NULL | |
| `full_text` | TEXT | NOT NULL | |
| `effective_start` | TIMESTAMPTZ | NOT NULL | |
| `effective_end` | TIMESTAMPTZ | | |
| `linked_discrepancy_id` | UUID | FK -> discrepancies.id | |
| `created_by` | UUID | FK -> profiles.id | |
| `cancelled_by` | UUID | FK -> profiles.id | |
| `cancelled_at` | TIMESTAMPTZ | | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

#### `obstruction_evaluations`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `display_id` | TEXT | NOT NULL | |
| `base_id` | UUID | FK -> bases.id | |
| `runway_class` | TEXT | NOT NULL | B / Army_B |
| `object_height_agl` | NUMERIC | NOT NULL | Height above ground level (feet) |
| `object_distance_ft` | NUMERIC | | Distance from runway (feet) |
| `distance_from_centerline_ft` | NUMERIC | | |
| `object_elevation_msl` | NUMERIC | | |
| `obstruction_top_msl` | NUMERIC | | |
| `latitude` | NUMERIC | | |
| `longitude` | NUMERIC | | |
| `description` | TEXT | | |
| `photo_storage_path` | TEXT | | |
| `results` | JSONB | NOT NULL | Array of surface evaluation results |
| `controlling_surface` | TEXT | | |
| `violated_surfaces` | TEXT[] | NOT NULL | |
| `has_violation` | BOOLEAN | NOT NULL | |
| `evaluated_by` | UUID | FK -> profiles.id, NOT NULL | |
| `linked_discrepancy_id` | UUID | FK -> discrepancies.id | |
| `notes` | TEXT | | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

### 7.3 Waiver Tables

#### `waivers`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `base_id` | UUID | FK -> bases.id | |
| `waiver_number` | TEXT | NOT NULL | |
| `classification` | TEXT | NOT NULL | permanent / temporary / construction / event / extension / amendment |
| `status` | TEXT | NOT NULL | draft / pending / approved / active / completed / cancelled / expired |
| `hazard_rating` | TEXT | | low / medium / high / extremely_high |
| `action_requested` | TEXT | | new / extension / amendment |
| `description` | TEXT | NOT NULL | |
| `justification` | TEXT | | |
| `risk_assessment_summary` | TEXT | | |
| `corrective_action` | TEXT | | |
| `criteria_impact` | TEXT | | |
| `proponent` | TEXT | | |
| `project_number` | TEXT | | |
| `program_fy` | INT | | Fiscal year |
| `estimated_cost` | NUMERIC | | |
| `project_status` | TEXT | | |
| `faa_case_number` | TEXT | | |
| `period_valid` | TEXT | | |
| `date_submitted` | DATE | | |
| `date_approved` | DATE | | |
| `expiration_date` | DATE | | |
| `last_reviewed_date` | DATE | | |
| `next_review_due` | DATE | | |
| `location_description` | TEXT | | |
| `location_lat` | NUMERIC | | |
| `location_lng` | NUMERIC | | |
| `notes` | TEXT | | |
| `photo_count` | INT | NOT NULL, default 0 | |
| `attachment_count` | INT | NOT NULL, default 0 | |
| `created_by` | UUID | FK -> profiles.id | |
| `updated_by` | UUID | FK -> profiles.id | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

#### `waiver_criteria`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `waiver_id` | UUID | FK -> waivers.id, NOT NULL |
| `criteria_source` | TEXT | NOT NULL (ufc_3_260_01 / ufc_3_260_04 / ufc_3_535_01 / other) |
| `reference` | TEXT | |
| `description` | TEXT | |
| `sort_order` | INT | NOT NULL |

#### `waiver_attachments`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `waiver_id` | UUID | FK -> waivers.id, NOT NULL |
| `file_path` | TEXT | NOT NULL |
| `file_name` | TEXT | NOT NULL |
| `file_type` | TEXT | NOT NULL (photo / site_map / risk_assessment / ufc_excerpt / faa_report / coordination_sheet / af_form_505 / other) |
| `file_size` | INT | |
| `mime_type` | TEXT | |
| `caption` | TEXT | |
| `uploaded_by` | UUID | FK -> profiles.id |
| `created_at` | TIMESTAMPTZ | NOT NULL |

#### `waiver_reviews`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `waiver_id` | UUID | FK -> waivers.id, NOT NULL |
| `review_year` | INT | NOT NULL |
| `review_date` | DATE | |
| `reviewed_by` | UUID | FK -> profiles.id |
| `recommendation` | TEXT | retain / modify / cancel / convert_to_temporary / convert_to_permanent |
| `mitigation_verified` | BOOLEAN | NOT NULL |
| `project_status_update` | TEXT | |
| `notes` | TEXT | |
| `presented_to_facilities_board` | BOOLEAN | NOT NULL |
| `facilities_board_date` | DATE | |
| `created_at` | TIMESTAMPTZ | NOT NULL |

#### `waiver_coordination`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `waiver_id` | UUID | FK -> waivers.id, NOT NULL |
| `office` | TEXT | NOT NULL (civil_engineer / airfield_manager / airfield_ops_terps / base_safety / installation_cc / other) |
| `office_label` | TEXT | |
| `coordinator_name` | TEXT | |
| `coordinated_date` | DATE | |
| `status` | TEXT | NOT NULL (pending / concur / non_concur) |
| `comments` | TEXT | |

### 7.4 Audit & Activity Tables

#### `activity_log`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK -> profiles.id, NOT NULL | |
| `base_id` | UUID | FK -> bases.id | |
| `action` | TEXT | NOT NULL | e.g., "created", "updated", "filed" |
| `entity_type` | TEXT | NOT NULL | e.g., "discrepancy", "inspection" |
| `entity_id` | UUID | NOT NULL | Must be a valid UUID |
| `entity_display_id` | TEXT | | Human-readable entity ID |
| `metadata` | JSONB | NOT NULL, default '{}' | Additional context (formatted `details` string, etc.) |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

**Note**: For `airfield_status` entries, `entity_id` must be `installationId` (a valid UUID), not a string literal.

#### `status_updates`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `discrepancy_id` | UUID | FK -> discrepancies.id, NOT NULL |
| `base_id` | UUID | FK -> bases.id |
| `old_status` | TEXT | |
| `new_status` | TEXT | |
| `notes` | TEXT | |
| `updated_by` | UUID | FK -> profiles.id, NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |

#### `check_comments`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `check_id` | UUID | FK -> airfield_checks.id, NOT NULL |
| `base_id` | UUID | FK -> bases.id |
| `comment` | TEXT | NOT NULL |
| `user_name` | TEXT | NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |

#### `runway_status_log`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `base_id` | UUID | FK -> bases.id |
| `old_runway_status` | TEXT | |
| `new_runway_status` | TEXT | |
| `old_active_runway` | TEXT | |
| `new_active_runway` | TEXT | |
| `old_advisory_type` | TEXT | |
| `new_advisory_type` | TEXT | |
| `old_advisory_text` | TEXT | |
| `new_advisory_text` | TEXT | |
| `changed_by` | UUID | FK -> profiles.id |
| `reason` | TEXT | |
| `created_at` | TIMESTAMPTZ | NOT NULL |

#### `navaid_statuses`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `navaid_name` | TEXT | NOT NULL |
| `base_id` | UUID | FK -> bases.id |
| `status` | TEXT | NOT NULL (green / yellow / red) |
| `notes` | TEXT | |
| `updated_by` | UUID | FK -> profiles.id |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

### 7.5 Infrastructure / Outage Tables

#### `infrastructure_features`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `base_id` | UUID | FK -> bases.id, NOT NULL | |
| `feature_type` | TEXT | NOT NULL, CHECK constraint | One of 23 enumerated types |
| `longitude` | NUMERIC | NOT NULL | |
| `latitude` | NUMERIC | NOT NULL | |
| `layer` | TEXT | | Source layer grouping |
| `block` | TEXT | | Fixture ID (e.g., `TWYK-TL-001`) |
| `label` | TEXT | | Sign text (signs only) |
| `notes` | TEXT | | |
| `rotation` | NUMERIC | NOT NULL, default 0 | Degrees |
| `source` | TEXT | NOT NULL | import / user |
| `status` | TEXT | NOT NULL | operational / inoperative |
| `status_changed_at` | TIMESTAMPTZ | | |
| `status_changed_by` | UUID | FK -> profiles.id | |
| `system_component_id` | UUID | FK -> lighting_system_components.id | |
| `bar_group_id` | UUID | FK -> infrastructure_features.id (self-ref) | Groups lights into physical bars |
| `created_by` | UUID | FK -> profiles.id | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

**CHECK constraint** (`infrastructure_features_feature_type_check`): Validates `feature_type` against the 23 allowed values. New types require a migration to update this constraint.

#### `lighting_systems`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `base_id` | UUID | FK -> bases.id, NOT NULL |
| `system_type` | TEXT | NOT NULL |
| `name` | TEXT | NOT NULL |
| `runway_or_taxiway` | TEXT | |
| `is_precision` | BOOLEAN | NOT NULL |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

#### `lighting_system_components`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `system_id` | UUID | FK -> lighting_systems.id, NOT NULL | |
| `component_type` | TEXT | NOT NULL | |
| `label` | TEXT | NOT NULL | Display label |
| `total_count` | INT | NOT NULL | Total fixtures in component |
| `allowable_outage_pct` | NUMERIC | | Percentage threshold |
| `allowable_outage_count` | INT | | Absolute count threshold |
| `allowable_outage_consecutive` | INT | | Max consecutive outages |
| `allowable_no_adjacent` | BOOLEAN | NOT NULL, default false | Adjacent outage prohibited |
| `allowable_outage_text` | TEXT | | Human-readable rule text |
| `is_zero_tolerance` | BOOLEAN | NOT NULL, default false | Any outage exceeds |
| `requires_notam` | BOOLEAN | NOT NULL, default false | |
| `requires_ce_notification` | BOOLEAN | NOT NULL, default false | |
| `requires_system_shutoff` | BOOLEAN | NOT NULL, default false | |
| `requires_terps_notification` | BOOLEAN | NOT NULL, default false | |
| `requires_obstruction_notam_attrs` | BOOLEAN | NOT NULL, default false | |
| `q_code` | TEXT | | NOTAM Q-code |
| `notam_text_template` | TEXT | | |
| `sort_order` | INT | NOT NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

#### `outage_events`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `base_id` | UUID | FK -> bases.id, NOT NULL |
| `feature_id` | UUID | FK -> infrastructure_features.id, NOT NULL |
| `system_component_id` | UUID | FK -> lighting_system_components.id |
| `event_type` | TEXT | NOT NULL (reported / resolved) |
| `reported_by` | UUID | FK -> profiles.id |
| `discrepancy_id` | UUID | FK -> discrepancies.id |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | NOT NULL |

#### `outage_rule_templates`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `system_type` | TEXT | NOT NULL | DAFMAN system category |
| `component_type` | TEXT | NOT NULL | |
| `label` | TEXT | NOT NULL | |
| `allowable_outage_pct` | NUMERIC | | |
| `allowable_outage_count` | INT | | |
| `allowable_outage_consecutive` | INT | | |
| `allowable_no_adjacent` | BOOLEAN | NOT NULL | |
| `allowable_outage_text` | TEXT | | |
| `is_zero_tolerance` | BOOLEAN | NOT NULL | |
| `dafman_notes` | TEXT | | DAFMAN reference notes |
| `requires_notam` | BOOLEAN | NOT NULL | |
| `requires_ce_notification` | BOOLEAN | NOT NULL | |
| `requires_system_shutoff` | BOOLEAN | NOT NULL | |
| `requires_terps_notification` | BOOLEAN | NOT NULL | |
| `requires_obstruction_notam_attrs` | BOOLEAN | NOT NULL | |
| `q_code` | TEXT | | |
| `notam_text_template` | TEXT | | |
| `sort_order` | INT | NOT NULL | |

**Note**: This table contains global seed data from DAFMAN 13-204v2 Table A3.1. It is not base-scoped.

#### `inspection_item_system_links`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `item_id` | UUID | NOT NULL |
| `system_id` | UUID | FK -> lighting_systems.id, NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |

### 7.6 Parking Tables

#### `parking_plans`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `base_id` | UUID | FK -> bases.id, NOT NULL |
| `name` | TEXT | NOT NULL |
| (additional metadata columns) | | |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

#### `parking_spots`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `plan_id` | UUID | FK -> parking_plans.id, NOT NULL |
| (position, aircraft type, dimensions) | | |
| `created_at` | TIMESTAMPTZ | NOT NULL |

#### `parking_obstacles`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `plan_id` | UUID | FK -> parking_plans.id, NOT NULL |
| (position, dimensions, locked status) | | |
| `created_at` | TIMESTAMPTZ | NOT NULL |

#### `parking_taxilanes`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `plan_id` | UUID | FK -> parking_plans.id, NOT NULL |
| (geometry, width) | | |
| `created_at` | TIMESTAMPTZ | NOT NULL |

#### `parking_apron_boundaries`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `plan_id` | UUID | FK -> parking_plans.id, NOT NULL |
| (geometry) | | |
| `created_at` | TIMESTAMPTZ | NOT NULL |

### 7.7 Wildlife Tables

#### `wildlife_sightings`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `base_id` | UUID | FK -> bases.id | |
| `display_id` | TEXT | NOT NULL | |
| `species_common` | TEXT | NOT NULL | |
| `species_scientific` | TEXT | | |
| `species_group` | TEXT | NOT NULL | |
| `size_category` | TEXT | | |
| `count_observed` | INT | NOT NULL | |
| `behavior` | TEXT | | |
| `latitude` | NUMERIC | | |
| `longitude` | NUMERIC | | |
| `location_text` | TEXT | | |
| `airfield_zone` | TEXT | | |
| `observed_at` | TIMESTAMPTZ | NOT NULL | Zulu timestamp |
| `time_of_day` | TEXT | | |
| `sky_condition` | TEXT | | |
| `precipitation` | TEXT | | |
| `bwc_at_time` | TEXT | | BWC at time of observation |
| `action_taken` | TEXT | | |
| `dispersal_method` | TEXT | | |
| `dispersal_effective` | BOOLEAN | | |
| `observed_by` | TEXT | NOT NULL | |
| `observed_by_id` | UUID | FK -> profiles.id | |
| `check_id` | UUID | FK -> airfield_checks.id | |
| `inspection_id` | UUID | FK -> inspections.id | |
| `discrepancy_id` | UUID | FK -> discrepancies.id | |
| `photo_count` | INT | default 0 | |
| `notes` | TEXT | | |
| `created_at` | TIMESTAMPTZ | | |
| `updated_at` | TIMESTAMPTZ | | |

#### `wildlife_strikes`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `base_id` | UUID | FK -> bases.id | |
| `display_id` | TEXT | NOT NULL | |
| `species_common` | TEXT | | |
| `species_scientific` | TEXT | | |
| `species_group` | TEXT | | |
| `size_category` | TEXT | | |
| `number_struck` | INT | | |
| `number_seen` | INT | | |
| `latitude` | NUMERIC | | |
| `longitude` | NUMERIC | | |
| `location_text` | TEXT | | |
| `strike_date` | DATE | NOT NULL | |
| `time_of_day` | TEXT | | |
| `sky_condition` | TEXT | | |
| `precipitation` | TEXT | | |
| `bwc_at_time` | TEXT | | |
| `aircraft_type` | TEXT | | |
| `aircraft_registration` | TEXT | | |
| `engine_type` | TEXT | | |
| `phase_of_flight` | TEXT | | |
| `altitude_agl` | INT | | |
| `speed_ias` | INT | | |
| `pilot_warned` | BOOLEAN | | |
| `parts_struck` | TEXT[] | | |
| `parts_damaged` | TEXT[] | | |
| `damage_level` | TEXT | | |
| `engine_ingested` | BOOLEAN | | |
| `engines_ingested` | INT[] | | |
| `flight_effect` | TEXT | | |
| `repair_cost` | NUMERIC | | |
| `other_cost` | NUMERIC | | |
| `hours_out_of_service` | NUMERIC | | |
| `remains_collected` | BOOLEAN | | |
| `remains_sent_to_lab` | BOOLEAN | | |
| `lab_identification` | TEXT | | |
| `reported_by` | TEXT | NOT NULL | |
| `reported_by_id` | UUID | FK -> profiles.id | |
| `discrepancy_id` | UUID | FK -> discrepancies.id | |
| `sighting_id` | UUID | FK -> wildlife_sightings.id | |
| `photo_count` | INT | default 0 | |
| `notes` | TEXT | | |
| `created_at` | TIMESTAMPTZ | | |
| `updated_at` | TIMESTAMPTZ | | |

#### `bwc_history`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `base_id` | UUID | FK -> bases.id |
| `bwc_value` | TEXT | NOT NULL |
| `set_at` | TIMESTAMPTZ | NOT NULL |
| `set_by` | UUID | FK -> profiles.id |
| `source` | TEXT | |
| `source_id` | UUID | |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

### 7.8 Template Tables

#### `base_inspection_templates`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `base_id` | UUID | FK -> bases.id, NOT NULL |
| `template_type` | TEXT | NOT NULL |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

#### `base_inspection_sections`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `template_id` | UUID | FK -> base_inspection_templates.id, NOT NULL |
| `section_id` | TEXT | NOT NULL |
| `title` | TEXT | NOT NULL |
| `guidance` | TEXT | |
| `conditional` | TEXT | |
| `sort_order` | INT | NOT NULL |

#### `base_inspection_items`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `section_id` | UUID | FK -> base_inspection_sections.id, NOT NULL |
| `item_key` | TEXT | NOT NULL |
| `item_number` | INT | NOT NULL |
| `item_text` | TEXT | NOT NULL |
| `item_type` | TEXT | NOT NULL |
| `sort_order` | INT | NOT NULL |

#### `shift_checklist_items`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `base_id` | UUID | FK -> bases.id, NOT NULL |
| `label` | TEXT | NOT NULL |
| `shift` | TEXT | NOT NULL |
| `frequency` | TEXT | NOT NULL |
| `sort_order` | INT | NOT NULL |
| `is_active` | BOOLEAN | NOT NULL, default true |
| `created_by` | UUID | FK -> profiles.id |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

#### `shift_checklists`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `base_id` | UUID | FK -> bases.id, NOT NULL |
| `checklist_date` | DATE | NOT NULL |
| `status` | TEXT | NOT NULL |
| `completed_by` | UUID | FK -> profiles.id |
| `completed_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

#### `shift_checklist_responses`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `checklist_id` | UUID | FK -> shift_checklists.id, NOT NULL |
| `item_id` | UUID | FK -> shift_checklist_items.id, NOT NULL |
| `completed` | BOOLEAN | NOT NULL, default false |
| `completed_by` | UUID | FK -> profiles.id |
| `completed_at` | TIMESTAMPTZ | |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

#### `qrc_templates`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `base_id` | UUID | FK -> bases.id, NOT NULL | |
| `qrc_number` | INT | NOT NULL | Sequential QRC number |
| `title` | TEXT | NOT NULL | |
| `notes` | TEXT | | |
| `steps` | JSONB | NOT NULL | Array of QrcStep |
| `references` | TEXT | | |
| `has_scn_form` | BOOLEAN | NOT NULL, default false | Emergency QRC with SCN |
| `scn_fields` | JSONB | | SCN form field definitions |
| `is_active` | BOOLEAN | NOT NULL, default true | |
| `sort_order` | INT | NOT NULL | |
| `last_reviewed_at` | TIMESTAMPTZ | | |
| `last_reviewed_by` | UUID | FK -> profiles.id | |
| `review_notes` | TEXT | | |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

#### `qrc_executions`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `base_id` | UUID | FK -> bases.id, NOT NULL |
| `template_id` | UUID | FK -> qrc_templates.id, NOT NULL |
| `qrc_number` | INT | NOT NULL |
| `title` | TEXT | NOT NULL |
| `status` | TEXT | NOT NULL (open / closed) |
| `opened_by` | UUID | FK -> profiles.id |
| `opened_at` | TIMESTAMPTZ | NOT NULL |
| `open_initials` | TEXT | |
| `closed_by` | UUID | FK -> profiles.id |
| `closed_at` | TIMESTAMPTZ | |
| `close_initials` | TEXT | |
| `step_responses` | JSONB | NOT NULL, default '{}' |
| `scn_data` | JSONB | |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

### 7.9 Reference Tables

#### `regulations`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `reg_id` | TEXT | NOT NULL |
| `title` | TEXT | NOT NULL |
| `description` | TEXT | NOT NULL |
| `publication_date` | DATE | |
| `url` | TEXT | |
| `source_section` | TEXT | NOT NULL |
| `source_volume` | TEXT | |
| `category` | TEXT | NOT NULL |
| `pub_type` | TEXT | NOT NULL (DAF / FAA / UFC / DoD / ICAO / CFR) |
| `is_core` | BOOLEAN | NOT NULL |
| `is_cross_ref` | BOOLEAN | NOT NULL |
| `is_scrubbed` | BOOLEAN | NOT NULL |
| `tags` | TEXT[] | NOT NULL |
| `storage_path` | TEXT | |
| `file_size_bytes` | INT | |
| `last_verified_at` | TIMESTAMPTZ | |
| `verified_date` | DATE | |
| `created_at` | TIMESTAMPTZ | NOT NULL |

#### `user_regulation_pdfs`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK -> profiles.id, NOT NULL |
| `reg_id` | TEXT | NOT NULL |
| `storage_path` | TEXT | NOT NULL |
| `file_name` | TEXT | NOT NULL |
| `file_size_bytes` | INT | |
| `uploaded_at` | TIMESTAMPTZ | NOT NULL |

#### `airfield_contractors`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK |
| `base_id` | UUID | FK -> bases.id |
| `company_name` | TEXT | NOT NULL |
| `contact_name` | TEXT | |
| `location` | TEXT | NOT NULL |
| `work_description` | TEXT | NOT NULL |
| `status` | TEXT | NOT NULL (active / completed) |
| `start_date` | DATE | NOT NULL |
| `end_date` | DATE | |
| `notes` | TEXT | |
| `radio_number` | TEXT | |
| `flag_number` | TEXT | |
| `callsign` | TEXT | |
| `created_by` | UUID | FK -> profiles.id |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `updated_at` | TIMESTAMPTZ | NOT NULL |

---

## 8. API Routes

All API routes are defined under `app/api/` and execute server-side. Unless noted, all require an authenticated Supabase session (JWT in HTTP-only cookie).

### 8.1 POST `/api/admin/invite`

| Field | Value |
|---|---|
| **Auth** | Required; caller must satisfy `user_is_admin()` |
| **Role Gate** | `sys_admin`, `base_admin`, `airfield_manager`, `namo` |
| **Request Body** | `{ email: string, name: string, role: UserRole, base_id: string }` |
| **Process** | 1. Validate caller role 2. Send invitation email via Resend 3. Create `profiles` row (status=pending) 4. Create `base_members` row |
| **Response** | `200 { success: true }` or `4xx/5xx { error: string }` |
| **Notes** | `base_admin` restricted to inviting users to their own base |

### 8.2 PATCH `/api/admin/users/[id]`

| Field | Value |
|---|---|
| **Auth** | Required; caller must satisfy `user_is_admin()` |
| **URL Param** | `id` — target user UUID |
| **Request Body** | `{ name?, role?, primary_base_id?, is_active?, ... }` |
| **Role Gate** | `sys_admin` can modify role and base; `base_admin` restricted to own base users |
| **Response** | `200 { user: Profile }` |

### 8.3 DELETE `/api/admin/users/[id]`

| Field | Value |
|---|---|
| **Auth** | Required; caller must be `sys_admin` |
| **URL Param** | `id` — target user UUID |
| **Process** | 1. Nullify 12 FK columns across 10 tables (discrepancies.assigned_to, discrepancies.reported_by, inspections.inspector_id, etc.) 2. Delete `base_members` rows 3. Delete `profiles` row 4. Delete `auth.users` row via admin API |
| **Response** | `200 { success: true }` |
| **Notes** | Must use service-role client for auth.users deletion |

### 8.4 POST `/api/admin/reset-password`

| Field | Value |
|---|---|
| **Auth** | Required; caller must satisfy `user_is_admin()` |
| **Request Body** | `{ user_id: string }` |
| **Role Gate** | `base_admin` restricted to users in their own base |
| **Process** | Generates password reset link via Supabase admin API, sends email via Resend |
| **Response** | `200 { success: true }` |

### 8.5 POST `/api/send-pdf-email`

| Field | Value |
|---|---|
| **Auth** | Required (any authenticated user) |
| **Request Body** | `{ to: string, subject: string, pdfBase64: string, filename: string }` |
| **Validation** | Email format validation, PDF data presence |
| **Process** | Decodes base64, sends via Resend SDK as attachment |
| **Response** | `200 { success: true }` |

### 8.6 GET `/api/elevation`

| Field | Value |
|---|---|
| **Auth** | Required |
| **Query Params** | `lat: number, lng: number` |
| **Process** | Server-side proxy to Google Elevation API (API key not exposed to client) |
| **Response** | `200 { elevation: number }` |

### 8.7 POST `/api/infrastructure-import`

| Field | Value |
|---|---|
| **Auth** | Required |
| **Request Body** | `{ base_id: string, features: ImportFeature[], format: 'kml' \| 'geojson' \| 'csv' }` |
| **Process** | Parses placemarks, deduplicates coordinates, bulk inserts via `bulkCreateInfrastructureFeatures()` |
| **Response** | `200 { imported: number, skipped: number }` |

### 8.8 GET `/api/installations`

| Field | Value |
|---|---|
| **Auth** | **None** (whitelisted in middleware) |
| **Response** | `200 { installations: Installation[] }` |
| **Notes** | Public endpoint to populate installation picker on login |

### 8.9 POST `/api/installations`

| Field | Value |
|---|---|
| **Auth** | Required; `sys_admin` only |
| **Request Body** | `{ name: string, icao: string, ... }` |
| **Response** | `200 { installation: Installation }` |

### 8.10 POST `/api/airfield-status`

| Field | Value |
|---|---|
| **Auth** | Required |
| **Request Body** | `{ base_id: string, field: string, value: any }` |
| **Process** | 1. Update `airfield_status` row 2. Log to `runway_status_log` if runway/advisory changed 3. Log to `activity_log` |
| **Response** | `200 { success: true }` |

### 8.11 GET `/api/notams`

| Field | Value |
|---|---|
| **Auth** | Required |
| **Query Params** | `icao: string` |
| **Process** | Fetches from `notams.aim.faa.gov` for given ICAO code |
| **Response** | `200 { notams: ExternalNotam[] }` |

### 8.12 GET `/auth/confirm`

| Field | Value |
|---|---|
| **Auth** | None (callback endpoint) |
| **Query Params** | `token_hash: string, type: string` |
| **Process** | Exchanges OTP/PKCE token with Supabase Auth, redirects to appropriate page |
| **Response** | 302 redirect |

---

## 9. Row-Level Security Architecture

### 9.1 Helper Functions

All RLS policies depend on four PostgreSQL helper functions defined in migration `2026030100`:

```sql
-- Returns TRUE if user has membership at the given base, or is sys_admin
CREATE OR REPLACE FUNCTION user_has_base_access(p_user_id UUID, p_base_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM base_members
    WHERE user_id = p_user_id AND base_id = p_base_id
  ) OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND role = 'sys_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns TRUE if user has a write-capable role
CREATE OR REPLACE FUNCTION user_can_write(p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id
    AND role IN ('sys_admin', 'base_admin', 'airfield_manager', 'namo', 'amops')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns TRUE if user has an admin-level role
CREATE OR REPLACE FUNCTION user_is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id
    AND role IN ('sys_admin', 'base_admin', 'airfield_manager', 'namo')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns TRUE if user is sys_admin
CREATE OR REPLACE FUNCTION user_is_sys_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND role = 'sys_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### 9.2 Migration Phases

| Phase | Migration | Tables | Pattern |
|---|---|---|---|
| 1 | `2026030100` | Helper functions, `bases`, `base_members`, `profiles`, `base_runways`, `base_navaids`, `base_areas` | Functions + config table policies |
| 2 | `2026030101` | `discrepancies`, `inspections`, `airfield_checks`, `acsi_inspections`, `notams`, `obstruction_evaluations`, `waivers`, `airfield_status` | `user_has_base_access()` for SELECT; `user_can_write()` for INSERT/UPDATE/DELETE |
| 3 | `2026030102` | `check_comments`, `activity_log`, `status_updates`, `navaid_statuses`, `runway_status_log` | Special cases (see below) |
| 4 | `2026030103` | `photos`, `waiver_criteria`, `waiver_attachments`, `waiver_reviews`, `waiver_coordination` | Parent FK lookup for access check |
| Tightening | `2026032100` | 19 tables | Added `user_can_write()` to INSERT/UPDATE/DELETE where only `user_has_base_access()` was checked |

### 9.3 Per-Table Policy Matrix

| Table | SELECT | INSERT | UPDATE | DELETE | Special Rules |
|---|---|---|---|---|---|
| `bases` | `user_has_base_access()` or `sys_admin` | `sys_admin` only | `user_is_admin()` | `sys_admin` only | |
| `base_members` | `user_has_base_access()` | `user_is_admin()` | `user_is_admin()` | `user_is_admin()` | |
| `profiles` | All authenticated | Own profile or `user_is_admin()` | Own profile or `user_is_admin()` | `sys_admin` only | |
| `discrepancies` | `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | CES role: UPDATE allowed for status/work_order fields |
| `inspections` | `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | |
| `airfield_checks` | `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | |
| `acsi_inspections` | `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | |
| `photos` | Parent entity base_access | `user_can_write()` | `user_can_write()` | `user_can_write()` | FK lookup to parent entity |
| `check_comments` | `user_has_base_access()` | All authenticated (base_access) | -- | -- | Open INSERT for any base member |
| `activity_log` | `user_has_base_access()` | `user_can_write()` | `user_can_write()` | `user_can_write()` | |
| `status_updates` | `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | -- | -- | |
| `airfield_status` | `user_has_base_access()` | `user_can_write()` | `user_can_write()` + `user_has_base_access()` | -- | Typically one row per base |
| `waivers` | `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | |
| `waiver_*` (children) | Parent waiver base_access | `user_can_write()` | `user_can_write()` | `user_can_write()` | FK lookup to waivers.base_id |
| `infrastructure_features` | `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | |
| `lighting_systems` | `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | |
| `outage_events` | `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | -- | -- | Immutable audit records |
| `outage_rule_templates` | All authenticated | `sys_admin` only | `sys_admin` only | `sys_admin` only | Global seed data |
| `parking_*` (5 tables) | `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | |
| `wildlife_*` | `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | `user_can_write()` + `user_has_base_access()` | |

### 9.4 Storage RLS

The `photos` Supabase Storage bucket has separate RLS policies on `storage.objects`:

- **SELECT**: Authenticated users with base access to the photo's parent entity
- **INSERT**: Authenticated users with write permission
- **DELETE**: Authenticated users with write permission

Photo URLs use `getPublicUrl()` — the `storage_path` does NOT include the bucket prefix.

---

## 10. Authentication & Authorization

### 10.1 Authentication Flows

#### Email/Password Login

```
Browser                    Next.js                   Supabase Auth
  |--- POST /login -------->|                            |
  |                          |--- signInWithPassword --->|
  |                          |<--- JWT + refresh token --|
  |<-- Set-Cookie (httpOnly)|                            |
  |--- Subsequent requests ->|                            |
  |   (cookie auto-attached) |--- auth.getUser() ------->|
  |                          |<--- user object -----------|
```

#### Invitation Flow

```
Admin                      API Route                 Supabase Auth     Resend
  |--- POST /api/admin/invite ->|                        |               |
  |                              |--- generateLink() --->|               |
  |                              |<--- magic link --------|               |
  |                              |--- create profile ---->|               |
  |                              |--- send email -------->|-------------->|
  |                              |                        |        Email sent
  |                              |                        |               |
Invited User                                              |               |
  |--- clicks magic link ------->|                        |               |
  |--- GET /auth/confirm ------->|--- exchangeToken() -->|               |
  |<-- redirect /setup-account --|                        |               |
  |--- POST password + name ---->|--- updateUser() ----->|               |
  |<-- redirect / (dashboard) --|                        |               |
```

#### Demo Mode

```
Browser                    Next.js
  |--- GET /login?demo=true ->|
  |                            |--- signInWithPassword('demo@glidepathops.com', 'demo') -->|
  |<-- redirect / (dashboard) |
```

### 10.2 Middleware

`middleware.ts` intercepts every request (except static assets per matcher config):

1. If Supabase env vars are missing: pass through (demo mode)
2. Create server Supabase client with cookie-based session
3. Call `auth.getUser()` to validate session
4. If no user and path is not whitelisted: redirect to `/login`
5. Whitelisted paths: `/login`, `/reset-password`, `/setup-account`, `/auth/confirm`, `/api/installations`

### 10.3 Role Permission Matrix

| Capability | sys_admin | base_admin | airfield_manager | namo | amops | ces | safety | atc | read_only |
|---|---|---|---|---|---|---|---|---|---|
| View all modules | Yes | Yes | Yes | Yes | Yes | Limited | Yes | Yes | Yes |
| Create/edit discrepancies | Yes | Yes | Yes | Yes | Yes | No (update only) | No | No | No |
| Create/edit inspections | Yes | Yes | Yes | Yes | Yes | No | No | No | No |
| Create/edit checks | Yes | Yes | Yes | Yes | Yes | No | No | No | No |
| Update airfield status | Yes | Yes | Yes | Yes | Yes | No | No | No | No |
| Manage users | Yes | Own base | Yes | Yes | No | No | No | No | No |
| Manage templates | Yes | Yes | Yes | Yes | No | No | No | No | No |
| Configure base settings | Yes | Yes | Yes | Yes | No | No | No | No | No |
| Delete users | Yes | No | No | No | No | No | No | No | No |
| Create installations | Yes | No | No | No | No | No | No | No | No |

### 10.4 CES Role Restrictions

Users with `role: 'ces'` have a restricted navigation and functional scope:

- **Visible modules**: CES Work Orders, Discrepancies, Visual NAVAIDs, Settings
- **Discrepancies**: UPDATE only (no create, no delete)
- **Status modal**: Limited to In Work, Project, Work Completed statuses
- **Navigation**: Flat sidebar (no collapsible dropdown groups)

### 10.5 Session Management

- Sessions are managed via HTTP-only cookies set by Supabase Auth
- JWT tokens are refreshed automatically by the Supabase client
- `last_seen_at` is updated on profile load (skipped on initial load via `loadProfile(false)`)
- Per-session flag `glidepath_activity_checked` prevents repeated activity dialogs

---

## 11. Multi-Base Architecture

### 11.1 Installation Context

The `InstallationProvider` (`lib/installation-context.tsx`) wraps all authenticated routes and provides:

```typescript
interface InstallationContext {
  installationId: string | null
  currentInstallation: Installation | null  // includes .timezone, .checklist_reset_time
  areas: InstallationArea[]
  userRole: UserRole | null
  ceShops: string[]
  typeShopMap: Record<string, string>
  arffAircraft: InstallationArffAircraft[]
  allInstallations: Installation[]
  switchInstallation: (id: string) => void
  defaultPdfEmail: string | null
  updateDefaultPdfEmail: (email: string) => void
}
```

### 11.2 Installation Switching

Users with membership at multiple installations can switch between them via the header installation switcher. On switch:

1. `installationId` updates in context
2. All data-fetching hooks re-fetch with new `base_id`
3. All 6 Mapbox components destroy and recreate (dependency on `[token, installationId]`)
4. Supabase Realtime channels are torn down and re-subscribed

### 11.3 Data Isolation

Every operational query filters by `base_id`:

```typescript
const { data } = await supabase
  .from('discrepancies')
  .select('*')
  .eq('base_id', installationId)
  .order('created_at', { ascending: false })
```

RLS policies enforce this at the database level as a defense-in-depth measure.

### 11.4 Demo Base Cloning

`supabase/seed-demo-base.sql` provides a script to clone the "Demo AFB" installation with representative seed data for development and demonstration purposes.

---

## 12. UI Design System

### 12.1 Design Tokens

The design system uses CSS custom properties (design tokens) defined in `app/globals.css`. Tokens are scoped to two theme variants:

```css
:root, [data-theme="dark"] {
  --color-bg: #0B1120;
  --color-bg-surface: rgba(15, 23, 42, 0.92);
  --color-bg-surface-solid: #0F172A;
  --color-bg-elevated: #131C30;
  --color-text-1: #F1F5F9;        /* Primary text */
  --color-text-2: #B0BEC5;        /* Secondary text */
  --color-text-3: #8899A6;        /* Tertiary text */
  --color-accent: #38BDF8;        /* Primary accent (cyan) */
  --color-border: rgba(56, 189, 248, 0.08);
  --color-success: #34D399;
  --color-danger: #EF4444;
  /* ... 60+ tokens total */
}

[data-theme="light"] {
  --color-bg: #F8FAFC;
  --color-bg-surface: rgba(255, 255, 255, 0.95);
  --color-text-1: #0F172A;
  /* ... light mode overrides */
}
```

### 12.2 Semantic Status Colors

```css
--color-status-pass: #22C55E;
--color-status-fail: #EF4444;
--color-status-na: #64748B;
--color-status-open: #22C55E;
--color-status-closed: #EF4444;
--color-status-pending: #FBBF24;
--color-status-inwork: #3B82F6;
--color-bwc-low: #22C55E;
--color-bwc-mod: #EAB308;
--color-bwc-sev: #F97316;
--color-bwc-prohib: #EF4444;
--color-health-green: #34D399;
```

### 12.3 Typography

- **Font family**: Outfit (Google Fonts), weights 300-800
- **Font loading**: `@import` with `display=swap`

### 12.4 Responsive Breakpoints

| Breakpoint | Width | Target |
|---|---|---|
| Mobile | < 768px | Phone, small tablet |
| Tablet | >= 768px | Tablet landscape |
| Desktop | >= 1024px | Desktop/laptop |

### 12.5 Reusable Components

| Component | Location | Purpose |
|---|---|---|
| `PageHeader` | `components/ui/` | Consistent page header with title, subtitle, actions |
| `EmptyState` | `components/ui/` | Empty data placeholder with icon and action |
| `LoadingState` | `components/ui/` | Skeleton/spinner loading indicator |
| `DetailGrid` | `components/ui/` | Key-value detail display grid |
| `ConfirmDialog` | `components/ui/` | Confirmation modal with cancel/confirm |
| `Badge` | `components/ui/` | Generic colored badge |
| `StatusBadge` | `components/ui/` | Status-specific badge (open/completed/cancelled) |
| `SeverityBadge` | `components/ui/` | Severity-specific badge (low/medium/high/critical) |
| `ActionButton` | `components/ui/` | Styled action button with icon support |
| `PhotoPickerButton` | `components/ui/` | Photo upload with camera/gallery selection |
| `EmailPdfModal` | `components/ui/` | Modal for emailing PDF with default email |
| `PdfExportDialog` | `components/ui/` | Configurable PDF template selector |

### 12.6 Context Providers

| Provider | File | Scope |
|---|---|---|
| `InstallationProvider` | `lib/installation-context.tsx` | All authenticated routes |
| `DashboardProvider` | `lib/dashboard-context.tsx` | Dashboard and status pages |
| `ThemeContext` | `lib/theme-context.tsx` | Root (light/dark toggle) |
| `SidebarContext` | `lib/sidebar-context.tsx` | Layout (sidebar open/close state) |

### 12.7 Toast Notifications

Sonner is used for all user-facing notifications:

```typescript
import { toast } from 'sonner'
toast.success('Discrepancy created')
toast.error(friendlyError(error))
```

The `friendlyError()` utility in `lib/utils.ts` maps RLS policy violations and PostgreSQL constraint errors to human-readable messages.

### 12.8 Bottom Navigation (Mobile)

5-tab bottom navigation bar for mobile viewports:

| Tab | Route | Icon |
|---|---|---|
| Status | `/` | Shield |
| Dashboard | `/dashboard` | LayoutDashboard |
| Obstruction | `/obstructions` | AlertTriangle |
| Events Log | `/activity` | ClipboardList |
| More | `/more` | Menu |

---

## 13. Export & Reporting System

### 13.1 PDF Generation Architecture

All 16 PDF generators follow a consistent pattern:

```typescript
// Every generator returns { doc, filename } — never calls doc.save() directly
export function buildDiscrepancyPdf(data: Discrepancy): { doc: jsPDF, filename: string } {
  const doc = new jsPDF('portrait', 'mm', 'letter')
  // ... build content using jspdf-autotable ...
  return { doc, filename: `discrepancy-${data.display_id}.pdf` }
}
```

**Photo embedding**: Photos are compressed to 400px max dimension at 0.6 JPEG quality before base64 encoding. Embedded via `didDrawCell` hooks in autotable.

**Map embedding**: Two approaches:

1. Mapbox Static Images API via `fetchMapImageDataUrl()` for satellite thumbnails
2. Canvas `toDataURL()` for interactive map captures

### 13.2 PDF Generators

| Generator | Module | Description |
|---|---|---|
| `lib/discrepancy-pdf.ts` | Discrepancies | Single-discrepancy PDF with photos and maps |
| `lib/pdf-config.ts` | Discrepancies | Shared `buildDiscrepancyTable()` for multi-discrepancy reports |
| `lib/parking-pdf.ts` | Parking | Plan capture with map image |
| `lib/reports/daily-ops-*.ts` | Reports | Daily operations summary |
| `lib/reports/aging-*.ts` | Reports | Discrepancy aging report |
| `lib/reports/discrepancy-*.ts` | Reports | Filtered discrepancy reports |
| `lib/reports/lighting-*.ts` | Reports | Lighting system outage report |
| (ACSI PDF) | ACSI | `didParseCell`/`didDrawCell` with row metadata |
| (Inspection PDF) | Inspections | Inspection results with photos |
| (Check PDF) | Checks | Check results with issues |
| (Waiver PDF) | Waivers | Waiver detail with attachments |
| (Obstruction PDF) | Obstructions | Evaluation results with surface analysis |
| (QRC PDF) | QRC | Execution record |
| (Wildlife PDF) | Wildlife | Sighting/strike reports |
| (Analytics PDF) | Reports | Trend analytics |
| (NAVAID system map) | Infrastructure | System map with GeoJSON overlay |

### 13.3 Email Delivery

```typescript
// lib/email-pdf.ts
export async function sendPdfViaEmail(doc: jsPDF, filename: string, email: string, subject: string) {
  const base64 = doc.output('datauristring').split(',')[1]
  await fetch('/api/send-pdf-email', {
    method: 'POST',
    body: JSON.stringify({ to: email, subject, pdfBase64: base64, filename })
  })
}
```

The `EmailPdfModal` component (`components/ui/email-pdf-modal.tsx`) provides the UI with a `defaultEmail` prop populated from the user's profile.

### 13.4 Excel Export

Two libraries are used:

- **SheetJS** (`xlsx`): Basic Excel exports (data-only worksheets)
- **ExcelJS** (`exceljs`): Styled exports with formatting, colors, column widths

Both are dynamically imported to avoid bundling in non-export code paths.

### 13.5 PDF Template Persistence

`PdfExportDialog` (`components/ui/pdf-template-selector.tsx`) allows users to configure export options (columns, grouping, filters) that persist across sessions. Configuration is stored in the `lib/pdf-config.ts` shared utilities.

---

## 14. External Integrations

### 14.1 Mapbox GL JS

Six map components, all following the destroy+recreate pattern on installation switch:

| Component | Location | Purpose |
|---|---|---|
| Dashboard Status Map | `app/(app)/page.tsx` | Runway/taxiway status overlay |
| Discrepancy COP Map | `app/(app)/discrepancies/` | Common Operating Picture |
| Obstruction Map | `components/obstructions/airfield-map.tsx` | Clearance envelope visualization |
| Infrastructure Map | `app/(app)/infrastructure/page.tsx` | NAVAID feature management |
| Parking Map | `app/(app)/parking/page.tsx` | Parking plan layout |
| Waiver/Obstruction Map | `app/(app)/waivers/`, `app/(app)/obstructions/` | Location visualization |

**Dependency array**: All components depend on `[token, installationId]` (some additionally on `runways`) to re-initialize when installations change. Early-return guards are insufficient; the map instance must be fully destroyed and recreated.

**Map capture**: Parking and infrastructure maps use `preserveDrawingBuffer: true` and `pixelRatio: 1` on `addImage()` for reliable canvas capture.

### 14.2 Supabase Realtime

Three tables are enabled for real-time subscriptions:

| Table | Event | Subscriber | Purpose |
|---|---|---|---|
| `airfield_status` | UPDATE | DashboardProvider, Dashboard page | Advisory/runway status updates |
| `airfield_checks` | INSERT | Dashboard page | New check notifications |
| `inspections` | INSERT | Dashboard page | New inspection notifications |

All channels are cleaned up on unmount or `installationId` change.

### 14.3 Google Elevation API

Proxied through `/api/elevation` to protect the API key:

```
Client -> POST /api/elevation?lat=X&lng=Y -> Google Elevation API -> { elevation: Z }
```

Used by the obstruction evaluation module for terrain elevation lookups.

### 14.4 Open-Meteo Weather API

Free weather API (no key required). Used by the wildlife module to auto-populate weather fields on sighting/strike forms via `weatherToFormFields()` in `lib/weather.ts`.

### 14.5 Resend Email

Server-side only. Used for:

- User invitation emails
- Password reset emails
- PDF export delivery

### 14.6 FAA NOTAMs

Fetched from `notams.aim.faa.gov` via `/api/notams`. No API key required. Synced on-demand per ICAO code.

### 14.7 Mapbox Static Images API

Used by `fetchMapImageDataUrl()` and `fetchSystemMapImageDataUrl()` in `lib/utils.ts` for embedding map thumbnails in PDF exports. Supports GeoJSON overlay for system feature visualization.

---

## 15. Offline & PWA Strategy

### 15.1 PWA Configuration

Glidepath is configured as an installable PWA via `@ducanh2912/next-pwa`:

- **Manifest**: `public/manifest.json` defines app name, icons, theme color, display mode
- **Service Worker**: Auto-generated `sw.js` handles caching of static assets
- **Install prompt**: Browser-native install prompt (no custom prompt UI)

### 15.2 Offline Capabilities

| Capability | Status | Implementation |
|---|---|---|
| Static asset caching | Enabled | Service worker pre-caching |
| Airfield diagram offline | Enabled | IndexedDB fallback (IDB) for demo mode |
| Inspection drafts offline | Partial | localStorage auto-save; resync on connectivity |
| Check drafts offline | Partial | localStorage fallback when Supabase unavailable |
| Full offline CRUD | Not implemented | Requires offline queue + conflict resolution |

### 15.3 Demo Mode as Offline Analog

When Supabase environment variables are not configured, the application operates in full demo mode using in-memory data from `lib/demo-data.ts` (10 arrays). This provides a functional offline experience for demonstrations and training.

---

## 16. Non-Functional Requirements

### 16.1 Performance

| Requirement | Target | Implementation |
|---|---|---|
| NFR-P01 | Initial page load < 3s on 4G | Next.js code splitting, font preloading |
| NFR-P02 | Infrastructure features: paginated fetch | `.range()` batches of 1,000 |
| NFR-P03 | PDF generation < 5s for standard reports | Client-side generation, lazy-loaded jsPDF |
| NFR-P04 | Photo compression before upload | 400px max, 0.6 JPEG quality |
| NFR-P05 | Dynamic import for export libraries | SheetJS and ExcelJS loaded on demand |
| NFR-P06 | Map initialization < 2s | Destroy+recreate pattern (not early-return guard) |

### 16.2 Scalability

| Requirement | Target |
|---|---|
| NFR-S01 | Support 50+ concurrent users per installation |
| NFR-S02 | Support 20+ installations per deployment |
| NFR-S03 | Handle 10,000+ infrastructure features per installation |
| NFR-S04 | Handle 5,000+ discrepancies per installation |

### 16.3 Availability

| Requirement | Target |
|---|---|
| NFR-A01 | 99.9% uptime for hosted deployment |
| NFR-A02 | Graceful degradation when external services unavailable (Mapbox, Resend, Open-Meteo) |
| NFR-A03 | Demo mode functional without any external connectivity |

### 16.4 Compatibility

| Requirement | Target |
|---|---|
| NFR-C01 | Chrome 100+, Edge 100+, Safari 16+, Firefox 100+ |
| NFR-C02 | iOS 16+ (PWA install support) |
| NFR-C03 | Android 10+ (Chrome PWA) |
| NFR-C04 | Responsive design: 320px to 2560px viewport width |

### 16.5 Accessibility

| Requirement | Target |
|---|---|
| NFR-AC01 | Light and dark theme support for visual preference |
| NFR-AC02 | Semantic HTML structure |
| NFR-AC03 | Keyboard-navigable primary workflows |

---

## 17. Security & Compliance Posture

### 17.1 Authentication Security

| Control | Implementation |
|---|---|
| Session tokens | HTTP-only cookies (not accessible to JavaScript) |
| Token refresh | Automatic via Supabase client |
| Password policy | Configurable via Supabase Auth settings |
| Brute force protection | Supabase Auth rate limiting |
| Demo isolation | Demo mode uses separate credentials; no real data exposure |

### 17.2 Authorization Security

| Control | Implementation |
|---|---|
| Row-Level Security | All 49+ tables have RLS enabled with role-aware policies |
| API route protection | Server-side session validation on every API route |
| Middleware guard | Every non-whitelisted route checked for valid session |
| Role hierarchy | 4 helper functions enforce consistent role checks |
| Admin operations | Service-role key used only in server-side API routes |
| FK cleanup on delete | User deletion nullifies 12 FK columns before cascade |

### 17.3 Data Protection

| Control | Implementation |
|---|---|
| Transit encryption | HTTPS (TLS 1.2+) for all communications |
| Storage encryption | Supabase Storage with server-side encryption |
| Database encryption | Supabase PostgreSQL encryption at rest |
| API key protection | Google Elevation and Resend keys server-side only |
| Email privacy | User emails hidden from cards, masked with toggle |
| EDIPI handling | Stored in profiles but not displayed in UI |

### 17.4 Input Validation

| Control | Implementation |
|---|---|
| Schema validation | Zod for runtime validation on API routes |
| SQL injection | Parameterized queries via Supabase client (never raw SQL from client) |
| XSS prevention | React's built-in JSX escaping |
| PDF sanitization | `sanitizePdfText()` in `lib/pdf-config.ts` |
| File upload | MIME type validation, size limits |

### 17.5 Audit Trail

| Control | Implementation |
|---|---|
| Activity log | `activity_log` table with user attribution and metadata |
| Status change history | `status_updates` table for discrepancy status changes |
| Runway status log | `runway_status_log` table for all airfield status changes |
| Outage event log | `outage_events` table for infrastructure status changes |
| Timestamps | All tables include `created_at`; most include `updated_at` |

### 17.6 Compliance Considerations

| Standard | Relevance | Status |
|---|---|---|
| DAFMAN 13-204 | Airfield operations procedures | Functional compliance (inspection checklists, outage rules) |
| DAFMAN 13-204v2 Table A3.1 | NAVAID outage thresholds | Implemented in `lib/outage-rules.ts` |
| UFC 3-260-01 | Airfield planning criteria | Implemented in obstruction evaluation engine |
| DoD IL-2 | Impact Level 2 (CUI potential) | Architecture supports; requires Platform One deployment for certification |
| NIST 800-53 | Security controls | Partial coverage via Supabase + RLS; full compliance requires infrastructure-level controls |

---

## 18. Known Technical Debt

### 18.1 Type Safety

| Issue | Count | Impact | Mitigation Path |
|---|---|---|---|
| `as any` casts | 168 total | Reduced type safety at cast sites | Typed Supabase client generation via `supabase gen types` |
| -- Mapbox GL | ~28 | Map event handlers and layer configurations | Mapbox GL type definitions improvement |
| -- Supabase inserts | ~70 | Insert/update parameter typing | Replace with generated types |
| -- jsPDF | ~11 | PDF generation hooks | Type assertion wrappers |
| -- Miscellaneous | ~59 | Various utility functions | Incremental refactoring |

### 18.2 Code Organization

| Issue | Impact | Mitigation Path |
|---|---|---|
| 14 files > 500 lines | Maintainability | Extract components, split into sub-modules |
| `infrastructure/page.tsx` at 4,090 lines | Largest file in codebase | Extract map logic, feature management, audit panel integration |
| `parking/page.tsx` at 3,840 lines | Second largest | Extract sidebar tabs, map logic, PDF capture |
| `base-setup/page.tsx` at 2,847 lines | Third largest | Extract per-tab components |
| Map init duplication across 6 components | DRY violation | Extract shared map initialization hook |
| PDF boilerplate duplication across 16 generators | DRY violation | Extract shared PDF builder base class |

### 18.3 Testing

| Issue | Impact | Mitigation Path |
|---|---|---|
| 0 test files | No automated regression detection | Add unit tests for calculations, integration tests for API routes |
| No E2E tests | No workflow validation | Playwright for critical flows (inspection, discrepancy, status) |
| No visual regression tests | UI changes unverified | Storybook + Chromatic for component library |

### 18.4 Other

| Issue | Impact | Mitigation Path |
|---|---|---|
| Orphaned file `lib/acsi-excel.ts` | Dead code | Delete file |
| Check draft real-time sync deferred | Two users could create duplicate checks | Implement Supabase Realtime for check draft locking |
| Version string in 3 places | Manual sync required | Extract to single source file, import in all locations |
| `Record<string, unknown>` row params | Requires `as any` at insert/update sites | Use generated Supabase types |

---

## 19. Deployment & Platform One Path

### 19.1 Current Deployment Model

Glidepath is designed for deployment as a containerized Next.js application with a Supabase backend. The current development workflow:

```
Developer -> git push -> GitHub (csproctor88-star/airfield-app)
```

### 19.2 Container Requirements

```dockerfile
# Minimum container spec
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

**Environment variables required**:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (prod) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes (prod) | Supabase anonymous (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (server) | Supabase service role key (admin operations) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Yes | Mapbox access token |
| `RESEND_API_KEY` | Yes (server) | Resend email API key |
| `GOOGLE_ELEVATION_API_KEY` | Yes (server) | Google Elevation API key |

### 19.3 Platform One Deployment Path

For DoD IL-2/IL-4 deployment via Platform One (Big Bang):

| Phase | Tasks |
|---|---|
| **Containerization** | Multi-stage Docker build, Iron Bank base image (Node 18 hardened), non-root user |
| **Helm Chart** | Kubernetes deployment, service, ingress, HPA, secrets management via SOPS |
| **CI/CD** | GitLab CI pipeline with linting, build, container scan (Anchore/Grype), push to Iron Bank registry |
| **Database** | Big Bang PostgreSQL operator or hosted Supabase on gov cloud; TLS in transit; encryption at rest |
| **Auth Integration** | Supabase Auth with CAC/PKI via SAML/OIDC gateway, or keycloak integration |
| **Storage** | S3-compatible object storage (MinIO on Big Bang, or Supabase Storage with gov S3 backend) |
| **Network Policy** | Ingress restricted to .mil networks; egress limited to Mapbox, Resend, Google, Open-Meteo, FAA |
| **STIG Compliance** | Node.js STIG, PostgreSQL STIG, Kubernetes STIG applied |
| **ATO Package** | SSP, CONOPS, POAM aligned to NIST 800-53 Rev 5, prepared for ISSM review |

### 19.4 Infrastructure Requirements

| Component | Minimum | Recommended |
|---|---|---|
| Application pods | 1 | 2-3 (HPA 50% CPU target) |
| CPU per pod | 0.5 vCPU | 1 vCPU |
| Memory per pod | 512 MB | 1 GB |
| PostgreSQL | 2 vCPU, 4 GB RAM, 20 GB storage | 4 vCPU, 8 GB RAM, 100 GB storage |
| Object storage | 10 GB | 100 GB (photo storage scales with usage) |

---

## 20. Glossary

| Term | Definition |
|---|---|
| **ACSI** | Airfield Compliance and Safety Inspection -- annual comprehensive DAF airfield audit |
| **AFM** | Airfield Manager -- primary airfield management authority |
| **AMOPS** | Airfield Management Operations -- operations personnel |
| **ARFF** | Aircraft Rescue and Firefighting |
| **ATC** | Air Traffic Control |
| **ATO** | Authority to Operate -- DoD accreditation for system deployment |
| **BASH** | Bird/Wildlife Aircraft Strike Hazard |
| **BWC** | Bird Watch Condition -- severity level (Low/Moderate/Severe/Prohibited) |
| **CAC** | Common Access Card -- DoD smart card for authentication |
| **CE** | Civil Engineering |
| **CES** | Civil Engineering Squadron |
| **COP** | Common Operating Picture |
| **CUI** | Controlled Unclassified Information |
| **DAFMAN** | Department of the Air Force Manual |
| **EDIPI** | Electronic Data Interchange Personal Identifier (10-digit DoD ID) |
| **FOD** | Foreign Object Debris/Damage |
| **IFE** | In-Flight Emergency |
| **IL-2/IL-4** | DoD Impact Level 2/4 -- data sensitivity classification for cloud hosting |
| **Iron Bank** | Platform One hardened container registry |
| **MAJCOM** | Major Command (Air Force organizational level) |
| **NAMO** | NAVAID Maintenance Officer |
| **NAVAID** | Navigational Aid -- electronic or visual aids to navigation |
| **NOTAM** | Notice to Air Missions (formerly Notice to Airmen) |
| **OFA** | Object Free Area -- cleared zone adjacent to runways/taxiways |
| **OI** | Operating Initials -- 1-4 character identifier for personnel |
| **PKCE** | Proof Key for Code Exchange -- OAuth 2.0 extension for secure token exchange |
| **Platform One** | DoD enterprise DevSecOps platform |
| **PWA** | Progressive Web Application |
| **QRC** | Quick Reaction Checklist -- emergency response procedures |
| **RCR** | Runway Condition Reading -- numeric friction measurement |
| **RLS** | Row-Level Security -- PostgreSQL feature for row-level access control |
| **RSC** | Runway Surface Condition |
| **SCN** | Secondary Crash Net -- emergency notification network |
| **SOF** | Supervisor of Flying |
| **SRS** | Software Requirements Specification |
| **SSP** | System Security Plan |
| **STIG** | Security Technical Implementation Guide |
| **TDG** | Taxiway Design Group -- FAA classification for taxiway geometry |
| **TERPS** | Terminal Instrument Procedures -- instrument approach procedure standards |
| **UFC** | Unified Facilities Criteria -- DoD construction and planning standards |
| **Zulu** | UTC (Coordinated Universal Time) -- standard military time reference |

---

*End of Document*

**Document Control**

| Version | Date | Author | Changes |
|---|---|---|---|
| 6.0 | 2026-03-21 | Glidepath Engineering | Initial Developer/Technical Edition; full schema, API, RLS, architecture documentation |
