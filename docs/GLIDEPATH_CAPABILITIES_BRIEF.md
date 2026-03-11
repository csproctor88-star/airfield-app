# Glidepath — Capabilities Brief

**Version 2.17.0 | March 2026**
**Built by MSgt Chris Proctor | 1C7X1 Airfield Management | 18 Years of Service**

---

## 1. Executive Summary

Glidepath is a production-ready airfield management platform that digitizes every core function of the 1C7X1 career field. It runs on any device as a Progressive Web App — phone, tablet, laptop — with no installation required.

**By the numbers:**
- 16 operational modules
- 48 page routes
- 36 database tables with Row-Level Security
- 82 schema migrations
- 11 PDF generators
- 6 check types, 4 inspection types, ~100 ACSI items
- 8 user roles with granular permissions
- Real-time updates via WebSocket on 3 core tables
- Multi-installation architecture (155+ bases, zero code per new site)
- $12 total development cost
- ~$45/month per installation (commercial cloud), near-zero on Platform One

---

## 2. The Problem

Over 155 Air Force installations operate active airfields. Every one of them manages daily operations with:
- **Paper checklists** for airfield checks and inspections
- **Excel spreadsheets** for discrepancy tracking
- **Email chains** for coordination with CE, Safety, and ATC
- **Binders** for waiver documentation and ACSI records
- **Whiteboards** for personnel on airfield and status tracking
- **Memory** for institutional knowledge that disappears every PCS

There is no standardized digital tool for airfield management. Each base reinvents workflows, creates ad-hoc trackers, and loses continuity every 2–3 years when the airfield manager changes.

---

## 3. The Solution

Glidepath replaces all of these fragmented tools with a single platform that is:
- **Real-time** — status changes push to every connected device instantly
- **Mobile-first** — designed for phone use in the field, scales to desktop
- **Multi-installation** — one deployment serves every base with data isolation
- **Role-aware** — 8 roles control who can see and do what
- **Audited** — every action logged with operator identity and Zulu timestamp
- **Exportable** — 11 PDF types, Excel reports, and email distribution
- **Standards-compliant** — aligned with DAFMAN 13-204, UFC 3-260-01, and AF Form 505
- **Platform One ready** — standard tech stack, containerizable, no vendor lock-in

---

## 4. Module Overview

### 4.1 Airfield Status (Home Screen)
Your common operating picture on one screen.
- Active runway with conditions (RSC/RCR)
- Bird Watch Condition with color-coded severity
- Weather advisories, warnings, watches, and remarks
- NAVAID status for all installed NAVAIDs
- Personnel on airfield with company, contact, location, radio, work description
- Construction/misc items tracking
- All changes propagate in real-time and log to Events Log

### 4.2 Dashboard
Operational intelligence and quick actions.
- Quick-start buttons for all check and inspection types
- Live activity feed showing recent operations
- User presence indicators (who's online)
- Installation switcher for multi-base users

### 4.3 Airfield Checks (6 Types)
Rapid field assessments with photo and GPS documentation.
- **FOD Check** — foreign object debris identification
- **RSC/RCR Check** — runway surface condition assessment
- **In-Flight Emergency Check** — post-emergency airfield inspection
- **Ground Emergency Check** — ground incident response assessment
- **Heavy Aircraft Check** — weight-bearing evaluation
- **BASH Check** — bird/wildlife hazard documentation

Common features: multi-issue capture, photo with GPS, cross-device draft persistence, airfield diagram reference, PDF export with email.

### 4.4 Facility Inspections (4 Types)
Structured compliance evaluations.
- **Airfield Inspection** — 44 items, 10 sections (daily)
- **Lighting Inspection** — 34 items, 5 sections
- **Construction Meeting Inspection** — pre/post construction assessment
- **Joint Monthly Airfield Inspection** — multi-agency consolidated evaluation

Features: default-to-pass logic (only interact with failures), inline discrepancy creation, multi-discrepancy per item, auto-save, weather integration, PDF with photos/maps/weather.

### 4.5 ACSI (Airfield Compliance & Safety Inspection)
Comprehensive audit per DAFMAN 13-204v2, Attachment 2.
- 10 sections, ~100 items with sub-field evaluations (operable, properly sited, clear of vegetation)
- Multi-team staffing (AFM, CE, Safety, RAWS, Weather, SFS, TERPS)
- Risk certification signature blocks
- Per-discrepancy photos and map locations
- Draft persistence across devices
- Full PDF export with per-item layout

### 4.6 Discrepancy Tracking
Centralized maintenance and safety issue management.
- 11 discrepancy types with configurable shop assignments
- Status lifecycle: open → submitted → assigned → in progress → completed/cancelled
- KPI dashboard (AFM, CES, AMOPS metrics)
- Interactive map view with color-coded pins
- Photo documentation with upload, delete, and resize
- Aging analysis (30+ day flagging)
- Individual and bulk PDF/Excel export

### 4.7 Waiver Management
Digital AF Form 505 lifecycle.
- 6 waiver types (permanent, temporary, construction, event, extension, amendment)
- Hazard ratings and criteria sources (UFC references)
- Coordination office tracking
- Annual review workflow with recommendations
- Map view showing all active waivers
- PDF and Excel export

### 4.8 Obstruction Evaluations
Interactive UFC surface analysis.
- Mapbox satellite map with runway geometry overlays
- Place object → enter height → instant surface violation detection
- Supports Class B and Army Class B runway geometries
- Photo documentation and evaluation history
- Results: surfaces checked, violations found, controlling surface identified

### 4.9 Quick Reaction Checklists (QRCs)
Template-based emergency response.
- Step-by-step execution with automatic timestamping
- Secondary Crash Net form capture for applicable emergencies
- Status tracking: available → active → completed/cancelled
- 1-year review cycle with overdue alerts
- PDF export for after-action documentation
- Automatic Events Log entries (QRC INITIATED, SCN ACTIVATED, COMPLETED)

### 4.10 Shift Checklists
Daily task management by shift.
- Configurable items by frequency (daily/weekly/monthly) and shift (day/mid/swing)
- Timezone-aware reset logic (configurable per installation)
- Completion tracking with history view
- Accountability without micromanagement

### 4.11 Reports & Analytics
Four report types with instant generation.
- **Daily Operations Summary** — consolidated daily PDF (checks, inspections, discrepancies, events, photos)
- **Open Discrepancy Report** — point-in-time snapshot with aging analysis (PDF/Excel)
- **Discrepancy Trends** — opened vs. closed over time, backlog analysis, top areas/types
- **Aging Report** — tiered breakdown (0–7, 8–14, 15–30, 31–60, 61–90, 90+ days)

### 4.12 Events Log
Comprehensive audit trail.
- Automatic logging of all system actions (status changes, checks, inspections, discrepancies, QRCs)
- Manual entry capability with templates
- Operating Initials column with tap-to-reveal popover
- Time-range filtering (today, 7d, 30d, custom)
- Entity linking (tap entry → jump to source record)
- Excel export

### 4.13 NOTAMs
Notice to Airmen management.
- FAA auto-fetch by ICAO identifier
- Local NOTAM creation and management
- Active/expired filtering
- PDF export and email distribution

### 4.14 Regulations Library
70+ regulatory references in-app.
- 19 categories (DAFMAN, FAA, UFC, CFR, DoD, ICAO)
- Full-text PDF viewing (PDF.js)
- Offline caching (IndexedDB)
- Favorites/bookmarks
- User document uploads

### 4.15 User Management
Role-based access administration.
- 8 user roles with granular permissions
- Create, edit, deactivate, delete users
- Operating initials management
- Email and EDIPI privacy controls
- Installation assignment

### 4.16 Base Configuration
Per-installation setup wizard.
- Installation metadata (name, ICAO, timezone, checklist reset time)
- Runway configuration (designation, coordinates, dimensions, elevation)
- Airfield areas, CE shops, ARFF aircraft
- Inspection templates (customizable per site)
- Airfield diagram upload
- QRC template management

---

## 5. Technical Architecture

### Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router), TypeScript |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth (swappable to Keycloak/SSO) |
| Storage | Supabase Storage (S3-compatible) |
| Real-Time | Supabase Realtime (WebSocket) |
| Maps | Mapbox GL JS |
| PDF | jsPDF + jspdf-autotable |
| Excel | SheetJS + exceljs |
| Email | Resend (transactional) |
| Offline | IndexedDB (idb) |

### Security
- Row-Level Security on all 36 tables
- RLS helper functions: `user_has_base_access()`, `user_can_write()`, `user_is_admin()`
- Storage RLS on file uploads
- HTTPS/TLS encryption in transit
- Database encryption at rest
- No PII in client-side storage
- Full audit trail (Events Log)

### Multi-Installation
- 155+ installations supported from a single deployment
- Zero code changes per new installation
- Data isolation enforced at the database level (not just application layer)
- Installation switching without logout

---

## 6. Regulatory Alignment

| Standard | Glidepath Coverage |
|----------|-------------------|
| DAFMAN 13-204 Vol 1 | Airfield status, checks, inspections, discrepancy tracking, personnel management |
| DAFMAN 13-204 Vol 2 | ACSI (Attachment 2), obstruction evaluations, waiver management |
| DAFMAN 13-204 Vol 3 | NOTAM management, facility documentation |
| UFC 3-260-01 | Obstruction surface calculations, clearance evaluations |
| UFC 3-535-01 | Lighting inspection items, NAVAID documentation |
| AF Form 505 | Digital waiver lifecycle (all fields, coordination, annual review) |
| DAFMAN 91-212 | BASH check documentation, wildlife hazard reporting |

---

## 7. Deployment Path

### Current: Commercial Cloud (Vercel + Supabase)
- Fully operational for development and beta testing
- ~$45/month per installation
- Instant deployment of updates

### Target: Platform One Party Bus
1. **Containerize** — Dockerfile for Next.js (standard process)
2. **Iron Bank** — Submit hardened container image
3. **SSO** — Swap Supabase Auth for Platform One Keycloak
4. **Database** — Migrate to P1-managed PostgreSQL
5. **CI/CD** — Configure GitLab CI pipeline
6. **STIG** — Application and OS-level hardening

**No vendor lock-in** — every component uses standard, replaceable technology.

---

## 8. Cost Analysis

| Item | Cost |
|------|------|
| Development | $12 (domain registration) |
| Commercial hosting (per installation) | ~$45/month |
| Platform One hosting | Near-zero (shared infrastructure) |
| Per-installation onboarding | $0 (zero code changes) |
| Annual maintenance | Minimal (single codebase) |

---

## 9. What Makes Glidepath Different

1. **Built by an operator, not a contractor.** Every feature solves a real problem the developer has faced across 18 years and multiple installations.

2. **Production-ready, not a prototype.** 82 schema migrations, 48 routes, 36 tables — this is a complete application, not a proof of concept.

3. **Zero cost to scale.** Adding installation #2 through #155 requires no development, no deployment changes, and no additional code.

4. **Immediate impact.** Hours saved per day on checks, inspections, reporting, and coordination. Measurable from day one.

5. **Complete audit trail.** Every action attributed and timestamped. Audit-ready at all times.

6. **PCS-proof.** The next airfield manager inherits everything — open discrepancies, inspection history, active waivers, obstruction evaluations, and trends data. Nothing is lost.

---

*Glidepath v2.17.0 — One app for every airfield function*
*MSgt Chris Proctor | 1C7X1 | March 2026*
