# GLIDEPATH — Software Requirements Specification
## Version 3.0 | February 2026

**Application:** Glidepath — Airfield OPS Management Suite
**Current Release:** v2.6.0
**Stack:** Next.js 14.2 (App Router) · TypeScript 5.9 · Tailwind CSS · Supabase · Mapbox GL JS
**Primary Regulation:** DAFMAN 13-204 (Volumes 1–3) — Airfield Management
**Target Installation:** 127th Wing, Selfridge ANGB (KMTC), Michigan
**Multi-Base Support:** 155+ U.S. military installations

---

## TABLE OF CONTENTS

1. Executive Summary
2. Problem Statement
3. Scope & Stakeholders
4. System Architecture
5. Technology Stack
6. Database Schema
7. Functional Requirements — Implemented Modules
8. Functional Requirements — Planned Enhancements
9. Business Logic & Constants
10. UI Design System
11. Authentication & Authorization
12. Multi-Base Architecture
13. Offline & PWA Strategy
14. Export & Reporting
15. External API Integrations
16. Non-Functional Requirements
17. Security & Compliance
18. Deployment & Infrastructure
19. Platform One Integration Path
20. Development History & Maturity
21. Regulatory References
22. Glossary
23. Companion Artifacts

---

## 1. EXECUTIVE SUMMARY

Glidepath is a mobile-first Progressive Web Application purpose-built for managing airfield operations across U.S. military installations. It consolidates the fragmented, paper-based, and spreadsheet-driven workflows that Airfield Management (1C7X1) personnel use daily into a single digital platform accessible from any phone, tablet, or computer.

The application covers the full spectrum of Airfield Management duties as defined in DAFMAN 13-204 (Volumes 1–3) and UFC 3-260-01:

| Module | Description | Status |
|--------|-------------|--------|
| Dashboard | Real-time operational hub with weather, runway status, NAVAID status, advisories | ✅ Complete |
| Discrepancy Tracking | Full lifecycle management of airfield deficiencies with photos and maps | ✅ Complete |
| Airfield Checks | 7 check types (FOD, RSC, RCR, IFE, Ground Emergency, Heavy Aircraft, BASH) | ✅ Complete |
| Daily Inspections | Combined Airfield + Lighting inspection with configurable per-base templates | ✅ Complete |
| Reports & Analytics | 4 operational report types with PDF export | ✅ Complete |
| Obstruction Evaluations | UFC 3-260-01 Class B imaginary surface analysis with interactive map | ✅ Complete |
| Aircraft Database | 1,000+ aircraft reference with ACN/PCN pavement analysis | ✅ Complete |
| Regulations Library | 70 references with in-app PDF viewer, offline caching, personal documents | ✅ Complete |
| Waiver Management | Full AF Form 505 lifecycle with coordination, annual review, PDF/Excel export | ✅ Complete |
| NOTAMs | Live FAA feed + local NOTAM drafting | ✅ Complete |
| Activity Log | Comprehensive audit trail with date filtering and Excel export | ✅ Complete |
| User Management | Admin invite, role assignment, password reset, account lifecycle | ✅ Complete |
| Settings & Config | Per-base runways, NAVAIDs, areas, CE shops, inspection templates, themes | ✅ Complete |

### By the Numbers

| Metric | Value |
|--------|-------|
| Application Routes | 41 |
| Source Files | 130+ |
| Database Tables | 25+ |
| Database Migrations | 49 |
| Aircraft Records | 1,000+ |
| Regulatory References | 70 |
| Military Installations | 155 |
| Check Types | 7 |
| Obstruction Surfaces | 10 |
| Waiver Seed Records | 17 (real KMTC data) |
| User Roles | 9 |
| Report Types | 4 |
| TypeScript Errors | 0 |

---

## 2. PROBLEM STATEMENT

Airfield Management operations at USAF, ANG, and AFRC installations currently rely on:

- Paper logs and clipboards for daily inspections and airfield checks
- Shared spreadsheets (often emailed) for discrepancy tracking and waiver registers
- Manual PDF routing for inspection reports requiring printing, scanning, and email
- Phone calls and radio for communicating runway status, NAVAID conditions, and advisories
- Separate FAA websites to look up NOTAMs with no integration to local tracking
- Printed UFC manuals for obstruction evaluation — calculations done by hand
- Filing cabinets for waiver documentation, annual review records, and coordination signatures
- No centralized audit trail — accountability depends on who remembers what happened

This fragmentation creates delayed response times, lost institutional knowledge during PCS rotations (every 2–4 years), compliance risk from missed inspections and overdue waivers, redundant data entry across disconnected systems, zero real-time operational visibility for leadership, and training gaps for new personnel.

---

## 3. SCOPE & STAKEHOLDERS

### 3.1 User Roles (9 Roles, Three-Tier Hierarchy)

**System Tier:**

| Role | Slug | Access |
|------|------|--------|
| System Administrator | `sys_admin` | Full access across all bases. Manage all users, assign any role, delete accounts, configure system. |

**Base Admin Tier:**

| Role | Slug | Access |
|------|------|--------|
| Base Administrator | `base_admin` | Full operational access at assigned base. Manage base users (cannot change roles/installations). |
| Airfield Manager | `airfield_manager` | Full operational access at assigned base. Base-scoped user management. |
| NAMO | `namo` | Full operational access at assigned base. Base-scoped user management. |

**Operational Tier:**

| Role | Slug | Access |
|------|------|--------|
| AM Operations | `amops` | Create/edit most items. Delete own items. View all reports. No user management. |
| Civil Engineering | `ces` | View/update discrepancies assigned to their shop. Limited reports. |
| Wing Safety | `safety` | Read-only across all modules. Full report access. |
| ATC / RAPCON | `atc` | Read-only. Limited report access. |
| Read Only | `read_only` | View-only access to all modules. |

### 3.2 In Scope (Built)

All 13 modules listed in the Executive Summary are implemented and functional as of v2.6.0.

### 3.3 Out of Scope (Future)

- CAC/PKI authentication (documented as production path)
- METAR weather API (aviationweather.gov — stub exists)
- Integration with IMDS, ACES, NexGen IT, or iEMS
- Automated NOTAM filing to FAA
- RT3 friction tester direct hardware integration
- Native mobile app (React Native)
- Real-time WebSocket multi-user collaboration
- AI-assisted trend detection and predictive maintenance

---

## 4. SYSTEM ARCHITECTURE

```
                    +---------------------------+
                    |     User's Device          |
                    |  (Phone / Tablet / PC)     |
                    |                            |
                    |  +----------------------+  |
                    |  |   Glidepath PWA      |  |
                    |  |   Next.js App        |  |
                    |  +----------+-----------+  |
                    |             |               |
                    |  +----------+-----------+  |
                    |  |   Offline Cache      |  |
                    |  |  IndexedDB (6 stores)|  |
                    |  +----------------------+  |
                    +-------------|---------------+
                                  |
                    +-------------|---------------+
                    |     Supabase Backend        |
                    |  +---------------------+    |
                    |  | PostgreSQL (25+ tbl) |    |
                    |  +---------------------+    |
                    |  | Auth (email/password)|    |
                    |  +---------------------+    |
                    |  | Storage (photos/PDFs)|    |
                    |  +---------------------+    |
                    +-----------------------------+
                                  |
              +-------------------|-------------------+
              |                   |                   |
    +---------+------+  +--------+-------+  +---------+------+
    |  Open-Meteo    |  | FAA NOTAM API  |  | Open-Elevation |
    |  (Weather)     |  | (notams.aim)   |  |   (MSL)        |
    +----------------+  +----------------+  +----------------+
              |
    +---------+------+
    |   Mapbox GL JS |
    | (Maps/Sat Img) |
    +----------------+
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Progressive Web App | Installable on any device without app store. Works offline. Auto-updates. |
| Supabase (PostgreSQL) | Managed database with built-in auth, storage, and real-time capabilities. Free tier for development. |
| Client-side PDF/Excel | Reports generated in-browser — no server load, works offline, instant delivery. |
| Multi-base data isolation | Every table scoped by `base_id`. Data from one base never visible to another. |
| Demo mode | App runs fully offline with mock data when Supabase credentials are missing. Zero setup for training and evaluation. |
| Configurable templates | Inspection checklists stored in database per base, not hardcoded. New bases clone from defaults. |
| Three-tier admin hierarchy | Prevents privilege escalation. Only sys_admin can assign admin-tier roles. |

---

## 5. TECHNOLOGY STACK

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 14.2.35 |
| Language | TypeScript (strict mode) | 5.9.3 |
| Styling | Tailwind CSS (light/dark/auto theme) | 3.4.19 |
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

### External APIs (All Free / No Key Required Unless Noted)

- **Open-Meteo** — Weather data (temperature, wind, visibility, conditions)
- **FAA NOTAM Search** (`notams.aim.faa.gov`) — Live NOTAM feed, no API key
- **Open-Elevation** — Ground elevation MSL lookup for obstruction evaluations
- **Mapbox** — Interactive maps, satellite imagery, static map thumbnails (requires token, free tier: 50K loads/month)

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
NEXT_PUBLIC_MAPBOX_TOKEN=[mapbox-token]
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 6. DATABASE SCHEMA

### 6.1 Tables (25+)

**Core Configuration:**

| Table | Purpose |
|-------|---------|
| `profiles` | User accounts, roles, rank, shop, primary base, presence tracking (`last_seen_at`) |
| `bases` | Installation definitions (name, ICAO, location, coordinates) |
| `base_runways` | Runway geometry per base (ends, heading, class, dimensions, approach lighting, threshold elevations) |
| `base_navaids` | Navigation aids per base with sort order |
| `base_areas` | Airfield areas per base (used across checks, discrepancies, inspections) |
| `base_ce_shops` | Civil Engineering shops per base for discrepancy assignment |
| `base_members` | User ↔ base membership join table (supports multi-base users) |

**Operational Data:**

| Table | Purpose |
|-------|---------|
| `discrepancies` | Airfield issues with full lifecycle tracking (display_id `D-YYYY-NNNN`) |
| `airfield_checks` | 7 check types with JSONB data column (display_id `CHK-YYYY-NNNN`) |
| `check_comments` | Remarks timeline for checks (author, content, timestamp) |
| `inspections` | Daily inspections with JSONB items array (display_id `AIR-YYYY-NNNN` / `LT-YYYY-NNNN`) |
| `inspection_template_sections` | Per-base inspection template sections (customizable) |
| `inspection_template_items` | Per-base inspection checklist items (customizable) |
| `notams` | FAA and LOCAL NOTAM tracking (display_id `N-YYYY-NNNN`) |
| `photos` | Photos for discrepancies, checks, inspections, evaluations (entity_type + entity_id) |
| `obstruction_evaluations` | UFC 3-260-01 surface analysis with JSONB results (display_id `OBS-YYYY-NNNN`) |

**Waiver System (5 tables):**

| Table | Purpose |
|-------|---------|
| `waivers` | AF Form 505 fields, classification, status, lifecycle dates |
| `waiver_criteria` | UFC/standard references per waiver |
| `waiver_attachments` | Photos and documents per waiver with typed categories |
| `waiver_reviews` | Annual review records with recommendations and board tracking |
| `waiver_coordination` | Office-by-office coordination tracking (CE, AFM, Safety, Ops/TERPS, ATC, Wing CC) |

**System & Audit:**

| Table | Purpose |
|-------|---------|
| `airfield_status` | Persisted runway status, active runway, advisory, BWC, RSC |
| `runway_status_log` | Audit trail for all runway status changes (database trigger) |
| `activity_log` | Audit trail for all mutations (user, action, entity_type, entity_id, details, timestamp) |
| `navaid_statuses` | G/Y/R status per approach system with notes |

**Reference & Documents:**

| Table | Purpose |
|-------|---------|
| `regulations` | 70 regulatory references with metadata, category, pub_type, storage_path |
| `pdf_text_pages` | Server-side extracted text for full-text search (tsvector indexed) |
| `user_documents` | User-uploaded personal document metadata |
| `user_document_pages` | Extracted text per page for user document search |

### 6.2 Sequences & Functions

- `discrepancy_seq` → `D-YYYY-NNNN`
- `check_seq` → `CHK-YYYY-NNNN`
- `inspection_seq` → `AIR-YYYY-NNNN` / `LT-YYYY-NNNN`
- `notam_seq` → `N-YYYY-NNNN`
- `obstruction_seq` → `OBS-YYYY-NNNN`
- `generate_display_id(prefix, seq_name)` — PostgreSQL function for atomic ID generation
- `search_all_pdfs(query_text, limit)` — Full-text search RPC across `pdf_text_pages`
- Signup trigger — Auto-creates `base_members` row on user registration

### 6.3 Storage Buckets (Supabase Storage)

| Bucket | Access | Purpose |
|--------|--------|---------|
| `regulation-pdfs` | Public read policy | Official regulation PDF files |
| `user-uploads` | Per-user (RLS planned) | User-uploaded personal documents |
| `discrepancy-photos` | Authenticated read/write | Discrepancy photo uploads |
| `check-photos` | Authenticated read/write | Check photo uploads |
| `obstruction-photos` | Authenticated read/write | Obstruction evaluation photos |
| `waiver-attachments` | Authenticated, 50MB limit | Waiver photos and documents |
| `photos` | RLS active (INSERT/SELECT/UPDATE/DELETE) | Airfield diagrams, shared photos |

### 6.4 Schema Artifacts

The complete database schema is maintained in the repository:
- `supabase/schema.sql` — Base table definitions and sequences
- `supabase/migrations/` — 49 migration files applied in order
- `lib/supabase/types.ts` — Full TypeScript type definitions for all tables

---

## 7. FUNCTIONAL REQUIREMENTS — IMPLEMENTED MODULES

### 7.1 Dashboard (`/`)

| ID | Requirement | Status |
|----|-------------|--------|
| FR-DASH-001 | Live clock updating every second with current date | ✅ |
| FR-DASH-002 | Weather integration via Open-Meteo: temperature, conditions, wind speed/direction, visibility | ✅ |
| FR-DASH-003 | Dynamic weather icons based on conditions | ✅ |
| FR-DASH-004 | Installation name and ICAO code with dropdown switcher for multi-base users | ✅ |
| FR-DASH-005 | Advisory system with three tiers: INFO (blue), CAUTION (yellow), WARNING (red) | ✅ |
| FR-DASH-006 | Active Runway toggle with Open/Suspended/Closed status (color-coded card, persisted to DB with audit log) | ✅ |
| FR-DASH-007 | Current Status panel: RSC, BWC, Last Check, Inspection completion % | ✅ |
| FR-DASH-008 | NAVAID Status panels (side-by-side per runway end) with G/Y/R toggle and auto-expanding notes | ✅ |
| FR-DASH-009 | Quick Actions: Begin Inspection, Begin Check, New Discrepancy (large touch targets) | ✅ |
| FR-DASH-010 | User presence tracking with 5-minute heartbeat (Online/Away/Inactive) | ✅ |
| FR-DASH-011 | Activity feed with color-coded action dots, clickable items linking to source entities | ✅ |

### 7.2 Discrepancy Tracking (`/discrepancies`)

| ID | Requirement | Status |
|----|-------------|--------|
| FR-DISC-001 | 11 discrepancy types: FOD, pavement, lighting, markings, signage, drainage, vegetation, wildlife, equipment, security, other | ✅ |
| FR-DISC-002 | Six-stage lifecycle: Created → Submitted to AFM → Submitted to CES → Awaiting CES Action → Work Completed → Verified & Closed (or Cancelled) | ✅ |
| FR-DISC-003 | Four severity levels: Low, Medium, High, Critical with color-coded badges | ✅ |
| FR-DISC-004 | Photo capture from device camera with GPS coordinates | ✅ |
| FR-DISC-005 | Interactive Mapbox map for pinning exact location | ✅ |
| FR-DISC-006 | Assignment to specific CE shop from configurable list | ✅ |
| FR-DISC-007 | Work order number tracking | ✅ |
| FR-DISC-008 | Linked NOTAM references | ✅ |
| FR-DISC-009 | Timestamped notes history with user identification | ✅ |
| FR-DISC-010 | Days-open aging counter | ✅ |
| FR-DISC-011 | Searchable, filterable list with clickable KPI counters | ✅ |
| FR-DISC-012 | Auto-generated display ID: `D-YYYY-NNNN` | ✅ |

### 7.3 Airfield Checks (`/checks`)

| ID | Requirement | Status |
|----|-------------|--------|
| FR-CHK-001 | 7 check types in unified form system: FOD Walk, RSC, RCR, IFE, Ground Emergency, Heavy Aircraft, BASH | ✅ |
| FR-CHK-002 | FOD Walk: route selection (multi-select areas), items found, clear/not-clear | ✅ |
| FR-CHK-003 | RSC: runway condition (wet/dry), observation notes | ✅ |
| FR-CHK-004 | RCR: Mu readings at rollout/midpoint/departure, contaminant type/depth/coverage, braking action, equipment type, temperature | ✅ |
| FR-CHK-005 | IFE: aircraft info (callsign, type, tail), classification, description, damage/injuries | ✅ |
| FR-CHK-006 | Ground Emergency: 12-item AM action checklist, 9-agency notification tracker, incident narrative | ✅ |
| FR-CHK-007 | Heavy Aircraft: aircraft type, parking location, weight, taxi route, pavement observations | ✅ |
| FR-CHK-008 | BASH: condition code (None/Low/Moderate/High/Extreme), species, mitigation, habitat attractants | ✅ |
| FR-CHK-009 | Photo capture with GPS, Mapbox location pinning, issue-found gating | ✅ |
| FR-CHK-010 | Check history with type filtering, search, and detail view with photo gallery and remarks | ✅ |

### 7.4 Daily Inspections (`/inspections`)

| ID | Requirement | Status |
|----|-------------|--------|
| FR-INS-001 | Combined Airfield Inspection Report with two halves (Airfield + Lighting) | ✅ |
| FR-INS-002 | Fully customizable per-base templates (sections and items via Settings) | ✅ |
| FR-INS-003 | Default Airfield half: 9 sections, 42 items | ✅ |
| FR-INS-004 | Default Lighting half: 5 sections, 32 items | ✅ |
| FR-INS-005 | Three-state toggle: Pass (green) / Fail (red) / N/A (gray) | ✅ |
| FR-INS-006 | BWC items use four-state toggle: LOW / MOD / SEV / PROHIB | ✅ |
| FR-INS-007 | Mark All Pass per section for routine inspections | ✅ |
| FR-INS-008 | Draft persistence to localStorage and database | ✅ |
| FR-INS-009 | Two-step Complete/File workflow with per-user tracking | ✅ |
| FR-INS-010 | Combined PDF export with pass/fail summaries, location maps, embedded photos | ✅ |
| FR-INS-011 | Construction Meeting and Joint Monthly inspection forms with personnel attendance | ✅ |

### 7.5 Reports & Analytics (`/reports`)

| ID | Requirement | Status |
|----|-------------|--------|
| FR-RPT-001 | Daily Operations Summary: all activity for date/range with embedded maps and photos | ✅ |
| FR-RPT-002 | Open Discrepancies Report: snapshot with area/type breakdowns, embedded photos and satellite maps | ✅ |
| FR-RPT-003 | Discrepancy Trends: opened vs. closed over 30d/90d/6m/1y with top areas/types | ✅ |
| FR-RPT-004 | Aging Discrepancies: open items by age tier (0-7d, 8-14d, 15-30d, 31-60d, 61-90d, 90+) | ✅ |
| FR-RPT-005 | All reports include branded headers, page numbers, generation timestamps, embedded imagery | ✅ |
| FR-RPT-006 | PDF export for all report types | ✅ |

### 7.6 Obstruction Evaluations (`/obstructions`)

| ID | Requirement | Status |
|----|-------------|--------|
| FR-OBS-001 | 10 UFC 3-260-01 surfaces: Primary, Approach-Departure, Transitional, Inner Horizontal, Conical, Outer Horizontal, Clear Zone, Graded Area, APZ I, APZ II | ✅ |
| FR-OBS-002 | Multi-runway simultaneous evaluation against ALL base runways | ✅ |
| FR-OBS-003 | Geodesic calculations: Haversine distance, cross-track/along-track from centerline | ✅ |
| FR-OBS-004 | Stadium-shaped boundary geometry for horizontal surfaces | ✅ |
| FR-OBS-005 | Slope calculations: approach-departure (50:1), transitional (7:1), conical (20:1) | ✅ |
| FR-OBS-006 | Open-Elevation API for ground MSL height lookup | ✅ |
| FR-OBS-007 | Interactive Mapbox map with color-coded surface overlays and per-runway toggles | ✅ |
| FR-OBS-008 | Click-to-place obstruction on map | ✅ |
| FR-OBS-009 | Violation detection with penetration depth and exact UFC table references | ✅ |
| FR-OBS-010 | Multiple photos per evaluation | ✅ |
| FR-OBS-011 | Evaluation history with search and detail view | ✅ |

### 7.7 Aircraft Database (`/aircraft`)

| ID | Requirement | Status |
|----|-------------|--------|
| FR-ACF-001 | 1,000+ military and civilian aircraft reference entries | ✅ |
| FR-ACF-002 | Per-aircraft data: name, designation, manufacturer, weights, dimensions, wheel geometry, ACN/PCN, FAA type code | ✅ |
| FR-ACF-003 | Search by name, type, manufacturer, branch | ✅ |
| FR-ACF-004 | Sort by weight, wingspan, ACN | ✅ |
| FR-ACF-005 | Favorites system (persistent across sessions) | ✅ |
| FR-ACF-006 | ACN/PCN Comparison Panel: compare aircraft pavement loading against runway PCN | ✅ |

### 7.8 Regulations & Reference Library (`/regulations`)

| ID | Requirement | Status |
|----|-------------|--------|
| FR-REG-001 | 70 regulation entries from DAFMAN 13-204 Vols 1–3, UFC 3-260-01, cross-references | ✅ |
| FR-REG-002 | 20 categories, 6 publication types (DAF, FAA, UFC, CFR, DoD, ICAO) | ✅ |
| FR-REG-003 | Full-text search across titles, descriptions, tags | ✅ |
| FR-REG-004 | Favorites with localStorage persistence | ✅ |
| FR-REG-005 | In-app PDF viewer with pinch-to-zoom and page navigation | ✅ |
| FR-REG-006 | Offline PDF caching via IndexedDB with "Cache All" bulk download | ✅ |
| FR-REG-007 | Admin CRUD: Add Reference (with PDF upload), Delete Reference (sys_admin) | ✅ |
| FR-REG-008 | My Documents tab: upload personal PDFs/images (50MB max), text extraction, search | ✅ |

### 7.9 Waiver Lifecycle Management (`/waivers`)

| ID | Requirement | Status |
|----|-------------|--------|
| FR-WAV-001 | 6 classification types: Permanent, Temporary, Construction, Event, Extension, Amendment | ✅ |
| FR-WAV-002 | 7 status values: Draft → Pending → Approved → Active → Expired / Closed / Cancelled | ✅ |
| FR-WAV-003 | Mandatory comment dialog for all status transitions | ✅ |
| FR-WAV-004 | AF Form 505 field coverage: waiver number (auto-generated), hazard rating, action requested, description, justification, risk assessment, corrective action, criteria impact, proponent office, project info, FAA case number, dates | ✅ |
| FR-WAV-005 | Office-by-office coordination tracking (CE, AFM, Safety, Ops/TERPS, ATC, Wing CC) | ✅ |
| FR-WAV-006 | Photo attachments with camera capture and typed categories | ✅ |
| FR-WAV-007 | Annual Review module: year-by-year review with KPIs and board presentation tracking | ✅ |
| FR-WAV-008 | Individual Waiver PDF export with embedded photos, criteria, coordination | ✅ |
| FR-WAV-009 | Waiver Register Excel export (multi-sheet: Register, Criteria, Coordination) | ✅ |
| FR-WAV-010 | 17 real KMTC historical waivers seeded as demonstration data | ✅ |

### 7.10 NOTAMs (`/notams`)

| ID | Requirement | Status |
|----|-------------|--------|
| FR-NOT-001 | Live FAA NOTAM feed via `notams.aim.faa.gov` — no API key required | ✅ |
| FR-NOT-002 | Auto-fetch NOTAMs for current installation ICAO on page load | ✅ |
| FR-NOT-003 | Manual ICAO search for querying any airport worldwide | ✅ |
| FR-NOT-004 | Feed status indicator (green/red/gray) with last-fetched timestamp | ✅ |
| FR-NOT-005 | Full NOTAM text on cards in monospace format | ✅ |
| FR-NOT-006 | Filter chips: All / FAA / LOCAL / Active / Expired | ✅ |
| FR-NOT-007 | Local NOTAM draft creation | ✅ |
| FR-NOT-008 | Demo mode fallback with 5 sample NOTAMs | ✅ |

### 7.11 Activity Log & Audit Trail (`/activity`)

| ID | Requirement | Status |
|----|-------------|--------|
| FR-ACT-001 | Date-range filtering: Today, Last 7 Days, Last 30 Days, Custom Range | ✅ |
| FR-ACT-002 | Entries grouped by date with color-coded action dots | ✅ |
| FR-ACT-003 | Clickable items link to source entity (discrepancy, check, inspection, etc.) | ✅ |
| FR-ACT-004 | Excel export with styled formatting | ✅ |
| FR-ACT-005 | Tracks: entity creation, status changes, edits, deletions, login activity | ✅ |

### 7.12 User Management (`/users`)

| ID | Requirement | Status |
|----|-------------|--------|
| FR-USR-001 | Searchable user list with role and status filter dropdowns | ✅ |
| FR-USR-002 | User cards with rank, role badge, status badge, base assignment, last seen | ✅ |
| FR-USR-003 | User detail modal for editing profiles with field-level permission enforcement | ✅ |
| FR-USR-004 | Invite user with branded setup email | ✅ |
| FR-USR-005 | Admin-initiated and self-service password reset | ✅ |
| FR-USR-006 | Account lifecycle: deactivate/reactivate, delete (sys_admin only, type-to-confirm) | ✅ |
| FR-USR-007 | Three-tier role hierarchy with escalation prevention | ✅ |
| FR-USR-008 | Installation selector: sys_admin sees all bases, base admins locked to own base | ✅ |

### 7.13 Settings & Base Configuration (`/settings`)

| ID | Requirement | Status |
|----|-------------|--------|
| FR-SET-001 | Profile: read-only display of user info, rank, role, primary base | ✅ |
| FR-SET-002 | Installation: current base display, sys_admin switching/adding | ✅ |
| FR-SET-003 | Base Configuration: runways, NAVAIDs, areas, CE shops, airfield diagram upload | ✅ |
| FR-SET-004 | Inspection Templates: customize sections/items per base, toggle Pass/Fail vs BWC | ✅ |
| FR-SET-005 | Appearance: Day / Night / Auto theme toggle | ✅ |
| FR-SET-006 | Data & Storage: view/clear cached data, estimated storage | ✅ |
| FR-SET-007 | Collapsible dropdown sections with sensible defaults | ✅ |

---

## 8. FUNCTIONAL REQUIREMENTS — PLANNED ENHANCEMENTS

### 8.1 Near-Term (Next Release Cycle)

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-PLAN-001 | METAR weather integration from aviationweather.gov replacing Open-Meteo | High |
| FR-PLAN-002 | Row-Level Security (RLS) enforcement on all tables (currently app-layer only) | High |
| FR-PLAN-003 | Server-side email delivery for inspection reports (branded sender address) | Medium |
| FR-PLAN-004 | Offline sync queue: store mutations while offline, auto-sync on reconnect | Medium |
| FR-PLAN-005 | Unit and integration testing suite | Medium |
| FR-PLAN-006 | NOTAM persistence (draft form save to DB) | Medium |
| FR-PLAN-007 | Regenerate Supabase types to eliminate ~170 `as any` casts | Medium |
| FR-PLAN-008 | Clean up dead files and unused image assets (~12MB) | Low |

### 8.2 Long-Term Vision

| ID | Capability | Description |
|----|-----------|-------------|
| FR-FUTURE-001 | CAC/PKI Authentication | Smart card login for DoD network compliance |
| FR-FUTURE-002 | IMDS/ACES Integration | Bi-directional sync with maintenance tracking |
| FR-FUTURE-003 | RT3 Hardware Integration | Direct import from runway friction testers |
| FR-FUTURE-004 | Native Mobile App | React Native wrapper for enhanced offline/camera |
| FR-FUTURE-005 | Real-Time Collaboration | Live multi-user WebSocket updates |
| FR-FUTURE-006 | AI-Assisted Analysis | Trend detection, predictive maintenance, anomaly alerting |
| FR-FUTURE-007 | Platform One Deployment | Enterprise hosting via Party Bus (see Section 19) |

---

## 9. BUSINESS LOGIC & CONSTANTS

### 9.1 Discrepancy Types (11)

| Type | Default Shop | Default Severity |
|------|-------------|-----------------|
| FOD Hazard | Airfield Management | Critical |
| Pavement Deficiency | CE Pavements | High |
| Lighting Outage | CE Electrical | High |
| Marking Deficiency | CE Pavements | Medium |
| Signage Deficiency | CE Electrical | Medium |
| Drainage Issue | CE Structures | Medium |
| Vegetation Encroachment | CE Grounds | Low |
| Wildlife Hazard | Airfield Management | High |
| Airfield Obstruction | CE / AFM | Critical |
| NAVAID Deficiency | RAWS | Critical |
| Other | Unspecified | Medium |

### 9.2 Waiver Classifications & Status Transitions

Classifications: Permanent (P), Temporary (T), Construction (C), Event (E), Extension (X), Amendment (A)

Auto-generated waiver number format: `{type}-{ICAO}-{YY}-{##}` (e.g., `P-KMTC-26-01`)

Status transitions with mandatory comments: Draft → Pending → Approved → Active → Expired / Closed / Cancelled. Reactivation paths: Closed → Active, Expired → Active.

### 9.3 Obstruction Surface Criteria (Class B)

| Surface | UFC Reference | Key Criteria |
|---------|--------------|-------------|
| Primary | Table 3-7, Item 1 | 1,000 ft half-width, 200 ft extension, 0 ft max height |
| Approach-Departure | Table 3-7, Item 2 | 50:1 slope, 25,000 ft length |
| Transitional | Table 3-7, Item 3 | 7:1 slope to 150 ft AGL |
| Inner Horizontal | Table 3-7, Item 4 | 150 ft AGL, 13,120 ft stadium radius |
| Conical | Table 3-7, Item 5 | 20:1 slope, 7,000 ft horizontal |
| Outer Horizontal | Table 3-7, Item 6 | 500 ft AGL, 42,250 ft stadium radius |
| Clear Zone | Ch. 3 & App B §13 | 3,000 ft × 3,000 ft, 0 ft max height |
| Graded Area | Ch. 3 & App B §13 | 1,000 ft × 3,000 ft, 0 ft max height |
| APZ I | DoD Inst 4165.57 | 3,000–8,000 ft from threshold |
| APZ II | DoD Inst 4165.57 | 8,000–15,000 ft from threshold |

### 9.4 Emergency Response AM Action Checklist (12 items)

1. Notify ATC / Tower
2. Activate Crash Phone / Primary Crash Net
3. Coordinate with Fire Department / ARFF
4. Sweep assigned runway for debris
5. Notify SOF (Supervisor of Flying)
6. Notify Fire Chief
7. Notify Wing Safety
8. Notify MOC (Maintenance Operations Center)
9. Notify Command Post
10. Notify CE
11. Notify Security Forces
12. Notify Medical

### 9.5 Emergency Agency Notification (9 agencies)

SOF, Fire Chief / ARFF, Wing Safety, MOC, Command Post, ATC / Tower, CE, Security Forces, Medical

---

## 10. UI DESIGN SYSTEM

### Theme System

- **Light/Dark/Auto** modes via CSS custom properties
- Auto follows `prefers-color-scheme` media query
- Smooth transitions between themes

### Dark Theme Palette

- Background: `slate-900` (#0F172A)
- Card: `slate-800` (#1E293B)
- Border: `slate-700`
- Text primary: `slate-100`
- Text secondary: `slate-400`
- Accent: `sky-400` (#38BDF8)

### Mobile-First Layout

- 480px max-width container
- Bottom navigation (5 tabs): Home, Discrepancies, Checks, Obstruction Eval, More
- 44px+ minimum touch targets for all interactive elements
- Designed for iPad and phone use in the field (gloved hands)

### Typography

- System font stack (`font-sans`)
- Monospace for display IDs and NOTAM text (`font-mono`)

### Role Badges

- Red: `sys_admin`
- Cyan: `base_admin`, `airfield_manager`, `namo`
- Slate: all operational roles

### Status Badges

- Green: Active
- Red: Deactivated
- Amber: Pending

---

## 11. AUTHENTICATION & AUTHORIZATION

### Auth Flow

1. User visits app → middleware checks Supabase session
2. No session → redirect to `/login`
3. Login: email + password via `supabase.auth.signInWithPassword()`
4. On login → check `profiles` table → update `last_seen_at`
5. Deactivated users see "Account deactivated" message
6. Session stored in HTTP-only cookie via `@supabase/ssr`
7. Demo mode: bypass auth when Supabase credentials are missing

### User Invitation Flow

1. Admin sends invite via `/api/admin/invite` (uses `inviteUserByEmail`)
2. Profile and `base_members` records created server-side
3. User receives branded email with setup link
4. `/setup-account` page for password creation
5. Profile status transitions from `pending` to `active`

### Password Reset

- Admin-initiated via user detail modal
- Self-service via "Forgot Password?" on login page
- Email-based recovery via `/auth/confirm` → `/reset-password`

### Role-Based Access Matrix

| Feature | sys_admin | base_admin/AFM/NAMO | amops | ces | safety | atc | read_only |
|---------|:---------:|:-------------------:|:-----:|:---:|:------:|:---:|:---------:|
| View Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create Discrepancy | ✅ | ✅ | ✅ | — | — | — | — |
| Update Status | ✅ | ✅ | ✅ | Own shop | — | — | — |
| Perform Checks | ✅ | ✅ | ✅ | — | — | — | — |
| Perform Inspections | ✅ | ✅ | ✅ | — | — | — | — |
| Manage Waivers | ✅ | ✅ | — | — | — | — | — |
| Create NOTAMs | ✅ | ✅ | — | — | — | — | — |
| Obstruction Eval | ✅ | ✅ | ✅ | — | ✅ | — | — |
| View Reports | ✅ | ✅ | ✅ | Limited | ✅ | Limited | ✅ |
| Manage Users | ✅ All | ✅ Own base | — | — | — | — | — |
| Configure Base | ✅ All | ✅ Own base | — | — | — | — | — |

---

## 12. MULTI-BASE ARCHITECTURE

### Database-Level Isolation

- Every operational table carries a `base_id` foreign key
- All queries filtered to user's current installation at application layer
- Users can belong to multiple bases via `base_members` join table

### Base Directory

- 155+ U.S. military installations with ICAO codes built into the application
- Includes AFBs, ANGBs, Joint Bases, Space Force stations
- New bases can be manually added if not in the directory

### Per-Base Configuration

- Runways, NAVAIDs, areas, CE shops configured independently
- Inspection templates customizable per base
- Airfield diagrams stored per installation in Supabase Storage

### Seeded Installations

| Base | ICAO | Purpose |
|------|------|---------|
| Selfridge ANG Base | KMTC | Primary development base with full config and 17 seed waivers |
| Andersen AFB | PGUA | Dual-runway seed for multi-base proof |
| Mountain Home AFB | KMUO | Additional seed data |
| Bradley International (CT ANG) | KBDL | Additional seed data |

### Onboarding a New Base

1. Admin selects from 155-base directory or manually adds
2. System auto-creates base site structure
3. Configure runways, NAVAIDs, areas, CE shops via admin UI
4. Initialize inspection templates (clone from defaults or customize)
5. Invite users with appropriate roles
6. No code deployment required — fully configuration-driven

---

## 13. OFFLINE & PWA STRATEGY

### PWA Configuration

- Installable on iOS, Android, and desktop home screens
- Custom app icon and branded launch experience
- `@ducanh2912/next-pwa` for service worker generation

### IndexedDB (6 Object Stores)

| Store | Purpose |
|-------|---------|
| `blobs` | Cached regulation PDF files |
| `meta` | PDF cache metadata |
| `text_pages` | Extracted PDF text for offline search |
| `text_meta` | Text extraction metadata |
| `user_blobs` | User-uploaded document cache |
| `user_text` | User document extracted text |

### Offline Capabilities

- All 70 regulation PDFs downloadable for offline ("Cache All")
- Inspection drafts auto-saved to localStorage
- Airfield diagrams cached locally (IDB in demo, Supabase Storage online)
- Aircraft database available offline (static data)
- Demo mode with zero network calls (6 discrepancies, 5 NOTAMs, 17 waivers, 1000+ aircraft, 70 regulations)

### Planned: Offline Sync Queue

- Store mutations in IndexedDB when offline
- Auto-sync when connectivity returns
- Conflict resolution strategy (last-write-wins with user notification)

---

## 14. EXPORT & REPORTING

### PDF Reports (7 Types)

| Report | Content | Embedded Media |
|--------|---------|----------------|
| Daily Operations Summary | All activity for date/range | Check location maps, photos |
| Open Discrepancies | Current snapshot with breakdowns | Photos, satellite map thumbnails |
| Discrepancy Trends | Historical opened vs. closed | Trend charts, area/type breakdowns |
| Aging Discrepancies | Open items by age tier | Severity and shop breakdowns |
| Individual Inspection | Section-by-section pass/fail | Location maps for failed items, photos |
| Individual Waiver | Full AF-505 format | Criteria tables, coordination stamps, photos |
| Individual Check | Check detail record | Location map, photos |

All PDFs include branded headers with installation name/ICAO, page numbers, and generation timestamps.

### Excel Exports (3 Types)

| Export | Sheets |
|--------|--------|
| Waiver Register | Waivers, Criteria & Standards, Coordination Status |
| Annual Review | Year review data with recommendations and board status |
| Activity Log | Date, Time, User, Rank, Action, Entity, Details |

---

## 15. EXTERNAL API INTEGRATIONS

| API | Status | Purpose | Auth Required |
|-----|--------|---------|---------------|
| Open-Meteo | ✅ Active | Weather (temp, wind, visibility) | No |
| FAA NOTAM Search | ✅ Active | Live NOTAM feed by ICAO | No |
| Open-Elevation | ✅ Active | Ground MSL height for obstructions | No |
| Mapbox GL JS | ✅ Active | Interactive maps, satellite imagery, static thumbnails | Token (free tier) |
| aviationweather.gov METAR | ⏳ Planned | Aviation-specific weather data | No |

---

## 16. NON-FUNCTIONAL REQUIREMENTS

| Category | Requirement | Status |
|----------|-------------|--------|
| Performance | Page load < 3 seconds on 4G | ✅ |
| Performance | Obstruction calculation < 100ms | ✅ |
| Accessibility | WCAG 2.1 AA target, minimum 4.5:1 contrast | ✅ (partial) |
| Responsiveness | Mobile-first (480px), tablet (768px), desktop (1024px) | ✅ |
| Security | All data over HTTPS | ✅ |
| Security | RLS on storage buckets | ✅ |
| Security | Full database RLS | ⏳ Planned |
| Data Integrity | All mutations via server actions/API routes | ✅ |
| Browser Support | Chrome 90+, Safari 15+, Edge 90+, Firefox 90+ | ✅ |
| Offline | PWA installable, static assets cached, regulation PDFs cached | ✅ |
| Audit | Every create/update/delete logged in activity_log | ✅ |
| Build | TypeScript strict mode, zero compile errors | ✅ |
| Theme | Light/Dark/Auto with system preference detection | ✅ |

---

## 17. SECURITY & COMPLIANCE

### Current Security Posture

- Email/password authentication via Supabase Auth
- Session management with HTTP-only cookies
- Account deactivation blocks login immediately
- Three-tier role hierarchy with escalation prevention
- RLS policies active on `storage.objects` for photos bucket
- Role-based write restrictions at application layer (API routes + UI guards)
- Admin API routes use Supabase service role key with server-side permission checks

### Production Hardening Path

1. **Re-enable RLS** on all database tables with role-based policies
2. **CAC/PKI authentication** via DoD identity provider
3. **GCC High migration** (Azure Government or AWS GovCloud)
4. **Platform One deployment** via Party Bus (see Section 19)
5. **STIG compliance** audit against DoD security baselines
6. **cATO** through Platform One's Certificate to Field process

### Data Classification

- Maximum data classification: CUI (Controlled Unclassified Information)
- No classified data stored or processed
- Airfield status, discrepancies, waivers, and obstruction evaluations may contain FOUO markings

---

## 18. DEPLOYMENT & INFRASTRUCTURE

### Current Deployment

- **Hosting:** Vercel (commercial cloud, Hobby/Pro tier)
- **Database:** Supabase (commercial cloud)
- **Domain:** glidepathops.com
- **CDN:** Vercel Edge Network (automatic)
- **SSL:** Automatic via Vercel

### Infrastructure Requirements

- Supabase project (free tier for dev, Pro for production)
- Mapbox account (free tier: 50,000 map loads/month)
- No other paid services — weather, NOTAMs, and elevation APIs are free

### Production Migration Path

```
Current State          Near-Term              Production
─────────────          ──────────             ──────────
Vercel (commercial) → Vercel (Pro tier)    → Platform One Party Bus
Supabase (free)     → Supabase (Pro tier)  → DoD-managed PostgreSQL
                                            → Iron Bank containers
                                            → cATO via CtF
```

---

## 19. PLATFORM ONE INTEGRATION PATH

### Overview

Platform One (P1) is the DoD's enterprise DevSecOps platform. It provides secure Kubernetes hosting, pre-certified CI/CD pipelines, and a streamlined path to Authorization to Operate. For Glidepath, the target service is **Party Bus** — P1's Platform as a Service (PaaS) that delivers a fully managed environment with P1's ATO with Continuous Delivery capabilities.

### Why Platform One

- Operational approval of secure software in as little as 30 days (vs. 1–2 years traditional ATO)
- DoD-wide reciprocity — once approved, deployable to any installation
- Continuous ATO (cATO) — no renewal cycle, security baked into pipeline
- Pre-certified pipelines eliminate individual program security sign-off gates
- Iron Bank provides vetted container images trusted across all classifications

### Integration Steps

**Phase 1: Preparation (Current → 3 months)**
1. Create P1 SSO account at `login.dso.mil`
2. Join IL2 group for unclassified development access
3. Containerize Glidepath using Docker (Next.js → Node.js container)
4. Containerize PostgreSQL database (or evaluate P1-managed database options)
5. Document all dependencies and external API connections
6. Prepare Software Bill of Materials (SBOM)

**Phase 2: Iron Bank Onboarding (3–6 months)**
1. Submit Iron Bank Getting Started Form at `repo1.dso.mil`
2. Onboard application containers through Iron Bank hardening pipeline
3. Address vulnerability scan findings (Anchore, Twistlock, OpenSCAP)
4. Achieve passing Acceptance Baseline Criteria (ABC) score
5. Submit justifications/mitigations for any findings per ABC timeline
6. Maintain continuous monitoring (scans every 12 hours)

**Phase 3: Party Bus Deployment (6–9 months)**
1. Request Party Bus onboarding through P1 customer success
2. Deploy Glidepath to Party Bus managed Kubernetes environment
3. Configure CI/CD pipeline through P1's pre-certified toolchain
4. Complete Certificate to Field (CtF) process
5. Achieve cATO — continuous authorization without renewal cycles

**Phase 4: Enterprise Rollout (9–12 months)**
1. Glidepath available to any USAF, ANG, or AFRC installation via P1
2. New bases onboard through admin UI (no code deployment)
3. Career field manager visibility across all installations
4. Data isolation maintained per base via application-layer scoping

### Technical Considerations for P1 Migration

| Component | Current | P1 Target |
|-----------|---------|-----------|
| Hosting | Vercel | Party Bus (Kubernetes) |
| Database | Supabase (managed PostgreSQL) | P1-managed PostgreSQL or self-hosted in cluster |
| Auth | Supabase Auth (email/password) | CAC/PKI via P1 identity services |
| File Storage | Supabase Storage | S3-compatible storage in GCC High |
| Maps | Mapbox (commercial) | Evaluate DoD-approved mapping (NGA, GEOINT) |
| Weather | Open-Meteo | aviationweather.gov METAR (DoD-internal) |
| NOTAMs | FAA public endpoint | Same (FAA public, no change needed) |

### Glidepath Advantages for P1 Onboarding

- **No proprietary dependencies** — all open-source stack (Next.js, PostgreSQL, Tailwind)
- **Already containerizable** — Next.js builds to a standard Node.js server
- **Multi-tenant by design** — `base_id` scoping maps directly to P1 multi-tenant patterns
- **Zero classified data** — CUI maximum, simplifies IL2/IL4 decisions
- **Demo mode** — evaluators can run the full app with zero infrastructure
- **Clean build** — zero TypeScript errors, no known security vulnerabilities in dependencies

---

## 20. DEVELOPMENT HISTORY & MATURITY

### Version History

| Version | Date | Milestone |
|---------|------|-----------|
| 0.1.0 | 2026-02-08 | Project setup, schema, type system |
| 0.2.0 | 2026-02-09 | MVP: auth, dashboard, discrepancies, checks, NOTAMs |
| 0.3.0 | 2026-02-11 | Discrepancy module full build |
| 0.4.0 | 2026-02-13 | Obstruction evaluation with Mapbox |
| 0.5.0 | 2026-02-14 | Discrepancy location mapping |
| 0.6.0 | 2026-02-15 | Airfield checks (7 types) |
| 0.7.0 | 2026-02-16 | Inspection system core |
| 0.8.0 | 2026-02-17 | Combined inspection reports |
| 0.9.0 | 2026-02-18 | Inspection refinements |
| 1.0.0 | 2026-02-18 | Homepage build complete |
| 2.0.0 | 2026-02-21 | Regulations library (70 refs), PDF viewer, offline caching |
| 2.1.0 | 2026-02-24 | Multi-base (155 installations), reports, aircraft DB, themes, templates |
| 2.2.0 | 2026-02-24 | Live FAA NOTAM feed, settings overhaul |
| 2.3.0 | 2026-02-24 | Waivers full lifecycle (AF Form 505, 17 KMTC seeds) |
| 2.4.0 | 2026-02-25 | Waiver enhancements (status workflow, PDF export, annual review) |
| 2.5.0 | 2026-02-26 | User management, auth flows, role system |
| 2.6.0 | 2026-02-27 | Branding, PDF photos/maps, activity linking, diagram storage |

### Development Approach

Built iteratively using Claude Code (AI coding agent) with the developer (MSgt Chris Proctor, 127 WG/AM) providing domain expertise, requirements, and testing. Each version shipped functional features — no throwaway prototypes. Every module was built by someone who performs these duties daily and has 18+ years of Airfield Management experience.

---

## 21. REGULATORY REFERENCES

| Regulation | Title | How Glidepath Supports It |
|-----------|-------|--------------------------|
| DAFMAN 13-204 Vol 1 | Airfield Management: Planning and Operations | Reference library with indexed entries; inspection templates aligned to Vol 1 |
| DAFMAN 13-204 Vol 2 | Airfield Management: Operations | Dashboard, checks, inspections, discrepancy tracking — all core AM duties digitized |
| DAFMAN 13-204 Vol 3 | Airfield Management: Special Operations | Reference library entries; extensible template system |
| UFC 3-260-01 | Airfield and Heliport Planning and Design | 10-surface obstruction evaluation engine with geodesic math and UFC table references |
| AF Form 505 | Airfield Waiver Template | Waiver module captures all AF-505 fields with lifecycle tracking and coordination |
| AFCEC Playbook App B | Airfield Waiver Playbook | Waiver register format, classification types, Excel export aligned to Appendix B |
| DoD Instruction 4165.57 | Air Installations Compatible Use Zones | APZ I and APZ II evaluation in obstruction module |
| FAA AC 150/5300-13A | Airport Design Standards | Runway dimensions, clear zone requirements, approach surface criteria |

---

## 22. GLOSSARY

| Term | Definition |
|------|-----------|
| ACN | Aircraft Classification Number — pavement stress rating per aircraft |
| AGL | Above Ground Level |
| AM | Airfield Manager / Airfield Management |
| APZ | Accident Potential Zone (I and II) |
| BASH | Bird/Wildlife Aircraft Strike Hazard |
| BWC | Bird Watch Condition (LOW/MOD/SEV/PROHIB) |
| cATO | Continuous Authority to Operate |
| CE | Civil Engineering |
| CtF | Certificate to Field (Platform One) |
| CUI | Controlled Unclassified Information |
| FOD | Foreign Object Debris/Damage |
| IFE | In-Flight Emergency |
| MALSR | Medium Intensity Approach Lighting System with Runway Alignment Indicator |
| MSL | Mean Sea Level |
| Mu Value | Coefficient of friction (0–100) measured by friction tester |
| NAMO | NOTAM and Airfield Management Operations |
| NAVAID | Navigational Aid (ILS, VASI, PAPI, REIL) |
| NOTAM | Notice to Air Missions |
| P1 | Platform One — DoD enterprise DevSecOps platform |
| PAPI | Precision Approach Path Indicator |
| PCN | Pavement Classification Number — runway capacity rating |
| PWA | Progressive Web Application |
| RCR | Runway Condition Reading — friction measurement using Mu values |
| REIL | Runway End Identifier Lights |
| RLS | Row Level Security (Supabase/PostgreSQL) |
| RSC | Runway Surface Condition |
| RT3 | Runway surface friction tester equipment |
| SBOM | Software Bill of Materials |

---

## 23. COMPANION ARTIFACTS

| Artifact | Location | Description |
|----------|----------|-------------|
| Database Schema | `supabase/schema.sql` | Complete table definitions |
| Migrations | `supabase/migrations/` | 49 migration files |
| TypeScript Types | `lib/supabase/types.ts` | Full type definitions for all tables |
| Capabilities Brief | `GLIDEPATH_CAPABILITIES_BRIEF.md` | Detailed module-by-module capabilities |
| Changelog | `CHANGELOG.md` | Complete version history |
| Base Onboarding | `BASE-ONBOARDING.md` | Guide for adding new installations |
| Scaling Assessment | `SCALING-ASSESSMENT.md` | Multi-base architecture assessment |
| Project Status | `PROJECT_STATUS.md` | Architecture details and tech debt audit |
| Integration Guide | `docs/INTEGRATION_GUIDE.md` | PDF text search architecture |

---

*Glidepath SRS v3.0 — February 2026*
*Built by MSgt Chris Proctor, 127th Wing Airfield Management, Selfridge ANGB (KMTC)*
*"Guiding You to Mission Success"*
