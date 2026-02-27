# GLIDEPATH — Comprehensive Capabilities Brief

**Airfield OPS Management Suite**
**Version 2.6.0 | February 2026**
**"Guiding You to Mission Success"**

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [Platform Architecture](#4-platform-architecture)
5. [Module-by-Module Capabilities](#5-module-by-module-capabilities)
   - 5.1 [Dashboard — Real-Time Operational Hub](#51-dashboard--real-time-operational-hub)
   - 5.2 [Discrepancy Tracking](#52-discrepancy-tracking)
   - 5.3 [Airfield Checks](#53-airfield-checks)
   - 5.4 [Daily Inspections](#54-daily-inspections)
   - 5.5 [Reports & Analytics](#55-reports--analytics)
   - 5.6 [Obstruction Evaluations](#56-obstruction-evaluations)
   - 5.7 [Aircraft Database & Pavement Analysis](#57-aircraft-database--pavement-analysis)
   - 5.8 [Regulations & Reference Library](#58-regulations--reference-library)
   - 5.9 [Waiver Lifecycle Management](#59-waiver-lifecycle-management)
   - 5.10 [NOTAMs — Live FAA Feed](#510-notams--live-faa-feed)
   - 5.11 [Activity Log & Audit Trail](#511-activity-log--audit-trail)
   - 5.12 [User Management & Access Control](#512-user-management--access-control)
   - 5.13 [Settings & Base Configuration](#513-settings--base-configuration)
6. [Multi-Base Architecture](#6-multi-base-architecture)
7. [Offline & Field Operations](#7-offline--field-operations)
8. [Export & Reporting Capabilities](#8-export--reporting-capabilities)
9. [Security & Access Control](#9-security--access-control)
10. [Regulatory Compliance](#10-regulatory-compliance)
11. [Technology Stack](#11-technology-stack)
12. [Deployment & Scalability](#12-deployment--scalability)
13. [Current Maturity & Roadmap](#13-current-maturity--roadmap)
14. [Value Proposition](#14-value-proposition)

---

## 1. EXECUTIVE SUMMARY

**Glidepath** is a mobile-first Progressive Web Application (PWA) purpose-built for managing airfield operations across U.S. military installations. It consolidates the fragmented, paper-based, and spreadsheet-driven workflows that Airfield Management (AM) personnel use daily into a single, unified digital platform accessible from any phone, tablet, or computer.

The application covers the full spectrum of AM duties as defined in **DAFI 13-213**, **DAFMAN 13-204 (Volumes 1-3)**, and **UFC 3-260-01**: discrepancy tracking, airfield checks (7 types), daily inspections, obstruction evaluations, waiver lifecycle management, NOTAM monitoring, operational reporting, regulatory reference access, and a 1,000+ aircraft database with pavement loading analysis.

**By the numbers:**

| Metric | Value |
|--------|-------|
| Application Routes | 41 |
| Source Files | 130+ |
| Database Tables | 25+ |
| Database Migrations | 49 |
| Aircraft Records | 1,000+ |
| Regulatory References | 70 |
| Military Installations in Directory | 155 |
| Airfield Check Types | 7 |
| Obstruction Surfaces Evaluated | 10 |
| Waiver Seed Records (Real KMTC Data) | 17 |
| User Roles | 9 |
| Report Types | 4 |
| TypeScript Errors | 0 |

---

## 2. PROBLEM STATEMENT

Airfield Management operations at USAF, ANG, and AFRC installations currently rely on a patchwork of:

- **Paper logs and clipboards** for daily inspections and airfield checks
- **Shared spreadsheets** (often emailed) for discrepancy tracking and waiver registers
- **Manual PDF routing** for inspection reports, requiring printing, scanning, and email
- **Phone calls and radio** for communicating runway status, NAVAID conditions, and advisories
- **Separate FAA websites** to look up NOTAMs with no integration to local tracking
- **Printed UFC manuals** for obstruction evaluation reference — calculations done by hand or in standalone calculators
- **Filing cabinets** for waiver documentation, annual review records, and coordination signatures
- **No centralized audit trail** — accountability depends on who remembers what happened and when

This fragmentation creates:

1. **Delayed response times** — critical airfield status changes communicated slowly
2. **Lost institutional knowledge** — personnel rotate every 2-4 years; paper records do not transfer cleanly
3. **Compliance risk** — missed inspection deadlines, overdue waiver reviews, and undocumented discrepancies
4. **Redundant data entry** — the same information entered into multiple systems
5. **No operational visibility** — leadership cannot see real-time airfield posture without calling the AM desk
6. **Training gaps** — new personnel have no centralized reference for procedures and standards

---

## 3. SOLUTION OVERVIEW

Glidepath replaces all of the above with a single application that runs on any device with a web browser. Personnel open the app, authenticate, and immediately see the live airfield posture — runway status, weather, advisories, NAVAID conditions, and recent activity. From there, every AM function is two taps away.

**Core design principles:**

- **Mobile-first** — Designed for iPads and phones used in the field (480px optimized layout, 44px+ touch targets)
- **Works offline** — Progressive Web App with IndexedDB caching; full demo mode with no server required
- **Multi-base ready** — Every data table scoped by installation; supports 155+ military bases out of the box
- **Role-based** — Nine roles in a three-tier hierarchy control who can view, create, and manage data
- **Audited** — Every action logged to an activity trail with user, timestamp, and entity reference
- **Exportable** — PDF reports and Excel spreadsheets generated in-browser for command briefings and record-keeping
- **Standards-compliant** — Built directly from DAFI 13-213, DAFMAN 13-204, UFC 3-260-01, and AF Form 505

---

## 4. PLATFORM ARCHITECTURE

### High-Level Architecture

```
                    +---------------------------+
                    |     User's Device          |
                    |  (Phone / Tablet / PC)     |
                    |                            |
                    |  +----------------------+  |
                    |  | Next.js PWA (React)  |  |
                    |  | TypeScript + Tailwind|  |
                    |  +----------+-----------+  |
                    |             |               |
                    |  +----------+-----------+  |
                    |  |   IndexedDB Cache    |  |
                    |  |  (Offline Storage)   |  |
                    |  +----------------------+  |
                    +-------------|---------------+
                                  |
                    +-------------|---------------+
                    |        Supabase Cloud       |
                    |  +---------+-----------+    |
                    |  | PostgreSQL Database  |    |
                    |  | (25+ tables, RLS)    |    |
                    |  +---------------------+    |
                    |  | Auth (JWT, Email)    |    |
                    |  +---------------------+    |
                    |  | Storage (Photos,     |    |
                    |  |  PDFs, Diagrams)     |    |
                    |  +---------------------+    |
                    +-----------------------------+
                                  |
              +-------------------|-------------------+
              |                   |                   |
    +---------+------+  +--------+-------+  +---------+------+
    | Open-Meteo API |  | FAA NOTAM API  |  | Open-Elevation |
    | (Weather)      |  | (notams.aim)   |  | API (MSL)      |
    +----------------+  +----------------+  +----------------+
              |
    +---------+------+
    | Mapbox GL JS   |
    | (Maps/Sat Img) |
    +----------------+
```

### Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Next.js App Router** | Server-side rendering for auth pages, client components for interactive features, API routes for server-side operations |
| **Supabase (PostgreSQL)** | Open-source Firebase alternative; SQL database with built-in auth, storage, and real-time capabilities; no vendor lock-in |
| **Progressive Web App** | Installable on any device without app store approval; works offline; auto-updates |
| **Client-side PDF/Excel** | Reports generated in-browser — no server load, works offline, instant delivery |
| **Multi-base data isolation** | Every table has a `base_id` foreign key; queries scoped at the application layer |
| **Demo mode** | App runs fully offline with mock data when Supabase is not configured — zero setup for training and demos |
| **TypeScript strict mode** | Zero compile errors; full type safety across 130+ files |

---

## 5. MODULE-BY-MODULE CAPABILITIES

### 5.1 Dashboard — Real-Time Operational Hub

The dashboard is the first screen users see after login. It provides a complete snapshot of current airfield posture in a single scroll.

**Live Clock & Weather**
- Real-time clock updating every second
- Open-Meteo weather API integration (no API key required): temperature, conditions, wind speed/direction, visibility
- Dynamic weather icons based on current conditions

**Installation Context**
- Current base name and ICAO code displayed prominently
- Dropdown switcher for users assigned to multiple installations

**Advisory System**
- Three alert tiers: INFO (blue), CAUTION (yellow), WARNING (red)
- Custom advisory text set by airfield management
- Persistent banner visible across the app

**Active Runway Control**
- Toggle between runway configurations (e.g., RWY 01/19)
- Three-state status: Open (green), Suspended (yellow), Closed (red)
- Color-coded card background matches status
- Every status change persisted to database with automatic audit log entry

**Current Status Panel**
- Runway Surface Condition (RSC) — last reading and time
- Bird Watch Condition (BWC) — current level and time
- Last Check Completed — type and timestamp
- Inspection completion percentage

**NAVAID Status**
- Side-by-side panels for each runway end
- Green / Yellow / Red single-tap toggle per navigation aid
- Auto-expanding notes field when status is Yellow or Red
- Changes saved to database immediately

**Quick Actions**
- "Begin Inspection" — jumps to inspection workspace
- "Begin Check" — opens check type selector
- "New Discrepancy" — opens discrepancy creation form
- Large touch targets designed for gloved/field use

**User Presence**
- Shows who is online, away, or inactive
- Heartbeat updates every 5 minutes via `last_seen_at` field

**Activity Feed**
- Real-time stream of all airfield actions
- Color-coded action dots by entity type
- Clickable items link directly to the source record
- Expandable to show full history

---

### 5.2 Discrepancy Tracking

Full-lifecycle tracking of airfield deficiencies from discovery to resolution.

**11 Discrepancy Types:**

| Type | Default Shop | Severity |
|------|-------------|----------|
| FOD Hazard | Airfield Management | Critical |
| Pavement Deficiency | CE Pavements | High |
| Lighting Outage | CE Electrical | High |
| Marking Deficiency | CE Pavements | Medium |
| Signage Deficiency | CE Electrical | Medium |
| Drainage Issue | CE Structures | Medium |
| Vegetation Encroachment | CE Grounds | Low |
| Wildlife Hazard | Airfield Management | High |
| Airfield Obstruction | CE / AFM | Critical |
| NAVAID Deficiency | CE Electrical / FAA | Critical |
| Other | Unspecified | Medium |

**Lifecycle Workflow:**
```
Created → Submitted to AFM → Submitted to CES → Awaiting CES Action
    → Work Completed → Verified & Closed
                                        OR
    → Cancelled (with reason)
```

**Key Features:**
- Photo capture from device camera with GPS coordinates
- Interactive Mapbox map for pinning exact location
- Assignment to specific Civil Engineering shop
- Work order number tracking
- Linked NOTAM references
- Timestamped notes history with user identification
- Days-open aging counter
- Severity-coded badges (Critical/High/Medium/Low)
- Searchable, filterable list with KPI counters
- Clickable KPI badges filter the list instantly

**Display ID Format:** `D-2026-0042` (auto-generated sequence)

---

### 5.3 Airfield Checks

Seven check types unified in a single form-based system for routine and emergency airfield surveillance.

**1. FOD Walk**
- Route selection from base areas (multi-select)
- Items found count and description
- Clear / Not Clear determination

**2. RSC (Runway Surface Condition) Check**
- Contaminant type: Dry, Wet, Slush, Ice, Patchy Ice, Snow
- Contaminant depth (inches) and coverage (%)
- Braking action: Excellent, Good, Fair, Poor, Unacceptable
- Treatment applied (deicing agent, friction course, etc.)

**3. RCR (Runway Condition Readings) Check**
- Mu friction coefficient readings at three points: Rollout, Midpoint, Departure
- Equipment type (RT3, ASIPT, other)
- Surface temperature

**4. IFE (In-Flight Emergency)**
- Aircraft information (call sign, type, tail number)
- Incident classification and description
- Damage assessment and injuries

**5. Ground Emergency**
- 12-item Airfield Management action checklist (Notify ATC, Activate Crash Phone, Coordinate ARFF, Sweep Runway, etc.)
- 9 agency notification tracker (SOF, Fire Chief, Wing Safety, MOC, Command Post, ATC, CE, Security Forces, Medical)
- Incident narrative and findings

**6. Heavy Aircraft**
- Aircraft type/designation
- Parking location and takeoff weight
- Taxi routes used
- Pavement condition observations

**7. BASH (Bird/Wildlife Aircraft Strike Hazard)**
- Condition code: None, Low, Moderate, High, Extreme
- Species observed
- Mitigation measures taken
- Habitat attractants noted

**Common to All Check Types:**
- Photo capture with GPS coordinates
- Mapbox location pinning
- Issue-found gating (additional fields appear only when relevant)
- Follow-up remarks
- Full history with type filtering and search
- Check detail view with photo gallery and remarks timeline

**Display ID Format:** `CHK-2026-0001`

---

### 5.4 Daily Inspections

Combined Airfield Inspection Report covering both Airfield and Lighting halves, per DAFI 13-213 requirements.

**Airfield Half — 9 Sections, 42 Items:**
1. Obstacle Clearance Criteria (8 items) — runway surfaces, clear zones, graded areas
2. Signs & Lights (8 items) — holding positions, elevation signs, windcone, FOD indicators
3. Construction (6 items) — site parking, lighting compliance, FOD control
4. Habitat Management (4 items) — grass height 7-14", ponding, wildlife, BWC assessment
5. Pavement Condition & Markings (4 items) — runways, taxiways, roads, grounding points
6. Airfield Driving (3 items) — FOD control, compliance, equipment stowage
7. FOD Control (4 items) — runways, aprons, infield, perimeter
8. Pre/Post Construction Inspection (1 item) — triggered when construction active
9. Joint Monthly Inspection (1 item) — triggered for monthly coordination

**Lighting Half — 5 Sections, 32 Items:**
1. Runway 01 Lighting (5 items) — edge lights, approach system, threshold, PAPI, hammerhead
2. Runway 19 Lighting (4 items) — threshold, PAPI, REILs, intensity
3. Taxiway & Apron Lighting (13 items) — all taxiways, ramps, stadium lights
4. Signs & Markings (6 items) — hold signs, guidance signs, DRMs, retroreflectivity
5. Miscellaneous (4 items) — obstruction lights, rotating beacon, wind cones, barriers

**Item States:**
- Pass (green check) — compliant
- Fail (red X) — deficiency found
- N/A (gray dash) — not applicable today
- BWC items use four-state toggle: LOW / MOD / SEV / PROHIB

**Workflow:**
1. **Draft** — Inspector works through checklist; auto-saved to localStorage and database
2. **Mark All Pass** — Bulk toggle per section for routine inspections
3. **Complete** — Inspector marks their half as done
4. **File** — Filer combines Airfield + Lighting halves into the official daily report
5. **PDF Export** — Generates combined report with pass/fail summaries, location maps for failed items, embedded photos

**Additional Inspection Types:**
- Construction Meeting — standalone form with personnel attendance tracking
- Joint Monthly Inspection — multi-office coordination form

**Display ID Format:** `AIR-2026-0042` or `LT-2026-0042`

---

### 5.5 Reports & Analytics

Four operational report types designed for command briefings, shift turnover, and compliance documentation.

**A. Daily Operations Summary**
- All activity for a selected date or date range
- Inspections completed, checks performed, status changes, new discrepancies, obstruction evaluations
- Embedded check location maps and photos
- Chronological timeline with activity types
- PDF export: `KMTC_Daily_Ops_2026-02-27.pdf`

**B. Open Discrepancies Report**
- Current snapshot of all open airfield deficiencies
- Breakdown by severity, type, assigned shop, and airfield area
- Average days open, top problem areas
- Embedded photos and satellite map thumbnails per discrepancy
- PDF export: `KMTC_Open_Discrepancies_2026-02-27.pdf`

**C. Discrepancy Trends**
- Historical trend analysis over configurable periods (30d / 90d / 6mo / 1yr)
- Opened vs. closed counts by time period
- Trend direction indicators (backlog growing/shrinking/flat)
- Top 5 areas and types by volume
- Closure rate percentage and average resolution time
- PDF export: `KMTC_Discrepancy_Trends_2026-02-27.pdf`

**D. Aging Discrepancies**
- Open items grouped by age: 0-7d, 8-14d, 15-30d, 31-60d, 61-90d, 90+ days
- Per-tier breakdown by severity and responsible shop
- Identifies critical backlog and SLA risk items
- PDF export: `KMTC_Aging_Discrepancies_2026-02-27.pdf`

All reports include branded headers, page numbers, generation timestamps, and embedded imagery.

---

### 5.6 Obstruction Evaluations

UFC 3-260-01 Class B Imaginary Surface analysis with multi-runway support — replacing manual calculations and standalone tools.

**10 Evaluated Surfaces:**

| # | Surface | UFC Reference | Criteria |
|---|---------|--------------|----------|
| 1 | Primary | Table 3-7, Item 1 | 1,000 ft half-width, 200 ft extension, 0 ft max height |
| 2 | Approach-Departure | Table 3-7, Item 2 | 50:1 slope, 25,000 ft length, 1,000→2,550 ft width |
| 3 | Transitional | Table 3-7, Item 3 | 7:1 slope from primary/approach edges to 150 ft AGL |
| 4 | Inner Horizontal | Table 3-7, Item 4 | 150 ft AGL, 13,120 ft stadium-shaped radius |
| 5 | Conical | Table 3-7, Item 5 | 20:1 slope, 7,000 ft horizontal, 150-500 ft range |
| 6 | Outer Horizontal | Table 3-7, Item 6 | 500 ft AGL, 42,250 ft stadium-shaped radius |
| 7 | Clear Zone | Ch. 3 & App B §13 | 3,000 ft x 3,000 ft, 0 ft max height |
| 8 | Graded Area | Ch. 3 & App B §13 | 1,000 ft x 3,000 ft, 0 ft max height |
| 9 | APZ I | DoD Inst 4165.57 | 3,000-8,000 ft from threshold, land-use restriction |
| 10 | APZ II | DoD Inst 4165.57 | 8,000-15,000 ft from threshold, land-use restriction |

**Computational Engine (797 lines of geodesic math):**
- Haversine great-circle distance calculations
- Cross-track and along-track distance from runway centerline
- Stadium-shaped boundary geometry (Minkowski sum)
- Slope calculations for approach-departure (50:1), transitional (7:1), and conical (20:1) surfaces
- Open-Elevation API integration for ground MSL height
- Multi-runway simultaneous evaluation — reports controlling surface per runway

**Interactive Mapbox Visualization:**
- Color-coded surface overlay polygons
- Per-runway toggles in the legend
- Click-to-place obstruction on map
- Satellite imagery base layer

**Violation Detection:**
- Identifies which surfaces are penetrated
- Reports penetration depth in feet above the surface
- Provides exact UFC table references for each violation
- Auto-generates waiver guidance text

**Output:**
- Results table showing all 10 surfaces with bounds check, max allowable height, obstruction height, violation status, and penetration depth
- Multiple photos per evaluation
- Linked discrepancies and NOTAMs
- Full evaluation history with search

---

### 5.7 Aircraft Database & Pavement Analysis

Reference database of 1,000+ military and civilian aircraft for airfield planning and load analysis.

**Data sourced from:**
- USACE TSC 13-2 (Military Aircraft)
- USACE TSC 13-3 (Commercial Aircraft)

**Per-Aircraft Data Points:**
- Name, designation, manufacturer
- Category (Military / Commercial)
- Max Takeoff Weight (lbs), Empty Weight, Maximum Payload
- Wingspan, Overall Length, Height (ft)
- Wheel Base, Wheel Tread, Turn Radius (ft)
- ACN (Aircraft Classification Number) — pavement stress rating
- PCN (Pavement Classification Number) — runway capacity rating
- FAA Aircraft Type Code

**Features:**
- Real-time search by name, manufacturer, or type designation
- Sort by weight, wingspan, or ACN values
- Filter by military vs. commercial
- Favorites system (persistent to localStorage)
- **ACN/PCN Comparison Panel** — compare aircraft pavement loading against runway PCN values to determine if an aircraft is safe, marginal, or unsuitable for a given runway
- Aircraft images where available

**Operational Use:**
- Heavy Aircraft Check validation — compare arriving aircraft ACN against runway PCN
- Airfield planning — determine which aircraft a runway can support
- Taxi route planning — wheel base and turn radius for taxiway geometry

---

### 5.8 Regulations & Reference Library

Comprehensive regulatory reference with 70 entries, in-app PDF viewing, and full offline capability.

**References Tab — 70 Regulation Entries:**

| Source | Count | Coverage |
|--------|-------|----------|
| DAFMAN 13-204 Vol 1 | ~20 | Airfield Planning & Operations |
| DAFMAN 13-204 Vol 2 | ~20 | Airfield Management |
| DAFMAN 13-204 Vol 3 | ~10 | Special Operations |
| UFC 3-260-01 | ~15 | Military Airfield Design |
| Cross-References (FAA, DoD, CFR) | ~5 | External standards |

**20 Categories:** Airfield Ops, Airfield Management, ATC, Airfield Design, Safety, Emergency, Pavement, Lighting, Driving, BASH/Wildlife, Construction, Fueling, Security, NOTAMs, UAS, Personnel, Publications, International, Contingency, Financial

**Publication Types:** DAF, FAA, UFC, CFR, DoD, ICAO

**Features:**
- Full-text search across titles, descriptions, and tags
- Category and publication type filter dropdowns
- Favorites system with toggle for "show favorites only" default view
- In-app PDF viewer with pinch-to-zoom, page navigation, and touch gestures (react-pdf / PDF.js)
- Offline PDF caching via IndexedDB — "Cache All" button downloads all PDFs for offline use
- Admin controls: Add Reference (with PDF upload) and Delete Reference (sys_admin only)
- Signed URL access for private-bucket PDFs (1-hour expiry)

**My Documents Tab:**
- Upload personal PDFs, JPGs, and PNGs (50 MB max)
- Client-side text extraction from PDFs for full-text search
- Per-document offline caching
- Supabase Storage integration for cross-device access
- Delete and manage uploaded documents

---

### 5.9 Waiver Lifecycle Management

Full airfield waiver management modeled after AF Form 505 and the AFCEC Playbook Appendix B.

**Six Classification Types:**
- Permanent — No corrective action planned
- Temporary — Corrective action programmed
- Construction — Temporary for active construction projects
- Event — Single event or exercise duration
- Extension — Extension of an existing waiver
- Amendment — Modification to an existing waiver

**Seven Status Values:**
```
Draft → Pending → Approved → Active → Expired / Closed / Cancelled
```
All status transitions require a mandatory comment explaining the change, saved to the coordination history.

**AF Form 505 Field Coverage:**
- Waiver number (auto-generated: P/T/C/E/X/A-ICAO-YY-##)
- Hazard rating (None / Low / Medium / High / Extreme)
- Action requested (Waiver / Special Interest Item / Mandatory Inspection Item)
- Full description, justification, risk assessment, and corrective action
- Criteria impact with linked UFC/DAFMAN references
- Proponent office, project number, fiscal year, estimated cost
- FAA case number (if applicable)
- Validity period, submission/approval/expiration dates

**Coordination Tracking:**
- Office-by-office approval workflow (CE, AFM, Safety, Ops/TERPS, ATC, Wing Commander)
- Per-office: coordinator name, date, status (Pending/Coordinated/Objection), comments
- Edit and delete coordination entries

**Attachments:**
- Camera capture or file upload
- Typed categories: Photo, Site Map, Risk Assessment, UFC Excerpt, FAA Report, Coordination Sheet, AF Form 505, Other
- Captions per attachment

**Annual Review Module (`/waivers/annual-review`):**
- Year-by-year review selector with prev/next navigation
- Per-waiver review form: recommendation, mitigation verified, project status update, notes
- Facilities Board presentation tracking (date and status)
- KPIs: Active waivers, Reviewed this year, Pending review, Presented to board
- Clickable KPI badges filter the list

**Export:**
- Individual Waiver PDF — branded, all fields, criteria, coordination stamps, embedded photos
- Waiver Register Excel — multi-sheet workbook (Register, Criteria, Coordination) via SheetJS

**Seed Data:** 17 real Selfridge ANGB (KMTC) historical waivers with criteria references, coordination records, and 2025 review history.

---

### 5.10 NOTAMs — Live FAA Feed

Real-time NOTAM monitoring integrated directly from the FAA's public NOTAM Search.

**Live Feed:**
- API proxy to `notams.aim.faa.gov/notamSearch/search` — no API key required
- Auto-fetches NOTAMs for the current installation's ICAO code on page load
- Manual ICAO search input for querying any airport worldwide
- Feed status indicator (green/red/gray) with last-fetched timestamp
- Refresh button for manual re-fetch

**NOTAM Display:**
- Full NOTAM text in monospace format (ICAO standard)
- Source badge (FAA / LOCAL)
- Status indicators (Active / Expired / Cancelled)
- Effective date range with days remaining
- Linked discrepancy indicator (if NOTAM originated from a tracked deficiency)

**Filter Chips:** All / FAA / LOCAL / Active / Expired

**Local NOTAM Drafting:** Create LOCAL NOTAMs with title, full text, and effective dates for base-specific notices.

**Demo Mode Fallback:** Falls back to 5 sample NOTAMs when Supabase is not configured.

---

### 5.11 Activity Log & Audit Trail

Comprehensive audit trail logging every action taken in the system.

**Features:**
- Date-range filtering: Today, Last 7 Days, Last 30 Days, Custom Range
- Entries grouped by date with color-coded action dots
- Clickable items link directly to source entity (discrepancy, check, inspection, waiver, etc.)
- Visual indicators (cyan text + arrow) for linked items

**Tracked Actions:**
- Entity creation (discrepancy, check, inspection, evaluation, waiver, NOTAM)
- Status changes (runway, NAVAID, discrepancy lifecycle)
- Edits and updates
- Deletions
- User login activity

**Export:** Excel export with styled formatting (Date, Time, User, Rank, Action, Entity, Details)

**Database:** `activity_log` table with user_id, action, entity_type, entity_id, display_id, metadata (JSONB), and timestamp.

---

### 5.12 User Management & Access Control

Admin interface for the complete user lifecycle: invite, configure, monitor, deactivate, delete.

**Three-Tier Role Hierarchy:**

| Tier | Roles | Access Level |
|------|-------|-------------|
| **System** | `sys_admin` | Full access across all bases; can manage all users, assign any role, delete accounts, configure system |
| **Base Admin** | `base_admin`, `airfield_manager`, `namo` | Full operational access at their assigned base; can manage base users (cannot change roles/installations) |
| **Operational** | `amops`, `ces`, `safety`, `atc`, `read_only` | Role-specific access; cannot manage users or configure base settings |

**User List:**
- Searchable by name, email, or rank
- Filterable by role and status (Active / Deactivated / Pending)
- Color-coded role badges (red = sys_admin, cyan = base admin tier, slate = operational)
- Color-coded status badges (green = active, red = deactivated, amber = pending)
- Last seen timestamp with Online/Away/Inactive classification

**User Invitation:**
- Admin sends email invitation with rank, name, role, and installation assignment
- Invited user receives branded email with setup link
- Account setup page (`/setup-account`) for password creation
- Profile status transitions from `pending` to `active` on completion

**Password Management:**
- Admin-initiated password reset via "Reset Password" button
- Self-service "Forgot Password?" on login page
- Secure email-based recovery flow with OTP/PKCE token exchange

**Account Lifecycle:**
- Deactivate/Reactivate toggle (deactivated users see "Account deactivated" on login)
- Delete account (sys_admin only, requires type-to-confirm with user's last name)
- Escalation prevention: only sys_admin can assign admin-tier roles

---

### 5.13 Settings & Base Configuration

Per-installation configuration hub for runways, NAVAIDs, areas, inspection templates, and user preferences.

**Profile** — Read-only display of user info, rank, role, and primary base

**Installation Management** — View current base; sys_admin can switch or add installations

**Base Configuration (`/settings/base-setup`):**
- **Runways** — Add/edit/delete runways with full metadata: length, width, surface type, heading, runway class (B/Army_B), endpoint coordinates, designators, approach lighting, threshold elevations
- **NAVAIDs** — Add/delete navigation aids with sort order; auto-creates status tracking rows
- **Areas** — Manage airfield area names used across checks, discrepancies, and inspections
- **CE Shops** — Manage Civil Engineering shop list for discrepancy assignment
- **Airfield Diagram** — Upload installation diagram image, stored in Supabase Storage for cross-device access

**Inspection Templates (`/settings/templates`):**
- Customize Airfield and Lighting inspection checklists per base
- Add, edit, remove, and reorder sections and items
- Toggle item type between Pass/Fail and BWC (four-state)
- Clone from default template for new bases

**Appearance** — Day / Night / Auto theme toggle (Auto follows system preference)

**Data & Storage** — View and clear cached data, estimated storage used

**About** — Version, environment, and branding information

---

## 6. MULTI-BASE ARCHITECTURE

Glidepath is engineered from the ground up for multi-installation deployment.

**Database-Level Isolation:**
- Every operational table carries a `base_id` foreign key
- All queries are scoped to the user's current installation at the application layer
- `base_members` join table links users to installations with role assignments
- Users can belong to multiple bases (e.g., IG inspectors, MAJCOM staff)

**Base Directory:**
- Static directory of 155+ U.S. military installations with ICAO codes
- Includes AFBs, ANGBs, Joint Bases, Space Force stations
- Used for base selection during signup and installation switching

**Per-Base Configuration:**
- Runways, NAVAIDs, areas, and CE shops configured independently per base
- Inspection templates customizable per base (no two bases share the same checklist unless desired)
- Airfield diagrams stored per installation

**Seeded Installations:**
- Selfridge ANG Base (KMTC) — fully configured with runways, NAVAIDs, templates, and 17 seed waivers
- Andersen AFB (PGUA) — dual-runway seed as proof of multi-base support

**Scaling Path:**
- Add any installation from the 155-base directory
- Configure runways and templates via the admin UI
- No code changes required to onboard new bases

---

## 7. OFFLINE & FIELD OPERATIONS

Glidepath is designed for use on the flightline where connectivity is unreliable.

**Progressive Web App (PWA):**
- Installable on iOS, Android, and desktop home screens — no app store required
- Service worker caches the entire application shell
- Auto-updates when connectivity is restored

**IndexedDB Offline Storage (6 Object Stores):**
1. `blobs` — Regulation PDFs cached for offline viewing
2. `meta` — Regulation metadata and favorites
3. `text_pages` — Extracted PDF text for offline full-text search
4. `text_meta` — Text extraction status tracking
5. `user_blobs` — User-uploaded personal documents
6. `user_text` — User document extracted text

**Offline Capabilities:**
- All 70 regulation PDFs downloadable for offline access ("Cache All" button)
- Inspection draft auto-saved to localStorage — recoverable if browser closes
- Airfield diagrams cached locally
- Aircraft database available offline (static data, no server required)
- Demo mode operates with zero network calls

**Demo Mode:**
- Activates automatically when Supabase credentials are missing
- Full app with mock data: 6 discrepancies, 5 NOTAMs, 17 waivers, 1,000+ aircraft, 70 regulations
- All features functional (create, edit, view, export)
- Ideal for training environments, demos, and evaluation without infrastructure setup

---

## 8. EXPORT & REPORTING CAPABILITIES

Every operational module produces exportable records for command briefings, compliance documentation, and archival.

**PDF Reports (Generated in-browser via jsPDF):**

| Report | Content | Embedded Media |
|--------|---------|----------------|
| Daily Operations Summary | All activity for a date/range | Check location maps, check photos |
| Open Discrepancies | Current open deficiency snapshot | Discrepancy photos, satellite map thumbnails |
| Discrepancy Trends | Historical opened vs. closed analysis | Trend charts, area/type breakdowns |
| Aging Discrepancies | Open items by age tier | Severity and shop breakdowns |
| Individual Inspection | Section-by-section pass/fail results | Location maps for failed items, photos |
| Individual Waiver | Full AF-505 format waiver document | Criteria tables, coordination stamps, photos |
| Check PDF | Individual check detail record | Location map, photos |

**PDF Features:**
- Branded headers with installation name and ICAO code
- Mapbox Static Images API satellite map thumbnails (300x200px)
- Base64-embedded photos
- Professional table formatting via jspdf-autotable
- Page numbers and generation timestamps
- Print-optimized styling

**Excel Exports (Generated in-browser via SheetJS):**

| Export | Sheets |
|--------|--------|
| Waiver Register | Waivers (full register), Criteria & Standards, Coordination Status |
| Annual Review | Year review data with recommendations and board presentation status |
| Activity Log | Date, Time, User, Rank, Action, Entity, Details |

**Excel Features:**
- Styled formatting with header colors, alternating rows, frozen headers
- Column auto-sizing
- Number formatting for dates and currency
- Multiple worksheets per workbook

---

## 9. SECURITY & ACCESS CONTROL

**Authentication:**
- Email/password via Supabase Auth (JWT tokens, HTTP-only cookies)
- Server-side session validation on every request via Next.js middleware
- Account invitation with email verification
- Password reset with secure recovery flow (OTP + PKCE)
- Account deactivation blocks login immediately

**Authorization — Nine Roles:**

| Role | Create | Edit | Delete | Manage Users | Config Base | View Reports |
|------|--------|------|--------|-------------|-------------|-------------|
| sys_admin | All | All | All | All bases | All bases | All |
| base_admin | All (own base) | All (own base) | All (own base) | Own base | Own base | All |
| airfield_manager | All (own base) | All (own base) | All (own base) | Own base | Own base | All |
| namo | All (own base) | All (own base) | All (own base) | Own base | Own base | All |
| amops | Most | Most | Own items | No | No | All |
| ces | Assigned items | Assigned items | No | No | No | Limited |
| safety | No | No | No | No | No | All |
| atc | No | No | No | No | No | Limited |
| read_only | No | No | No | No | No | View only |

**Enforcement Layers:**
1. **Middleware** — Route-level auth guard redirects unauthenticated users
2. **API Routes** — Admin endpoints use Supabase service role with caller role verification
3. **Application Layer** — Guard functions (`isSysAdmin()`, `isBaseAdmin()`, `isAdmin()`) enforce permissions
4. **UI Layer** — Conditional rendering hides unauthorized actions
5. **Storage** — RLS policies on Supabase Storage `photos` bucket

**Escalation Prevention:**
- Base admins cannot assign admin-tier roles
- Base admins cannot change user installations
- Only sys_admin can delete accounts
- Delete requires type-to-confirm dialog

---

## 10. REGULATORY COMPLIANCE

Glidepath is built directly from and in support of the following governing regulations:

| Regulation | Full Title | How Glidepath Supports It |
|-----------|-----------|--------------------------|
| **DAFI 13-213** | Airfield Management | Dashboard, checks, inspections, discrepancy tracking — all core AM duties digitized |
| **DAFMAN 13-204 Vol 1** | Airfield Management: Airfield Planning and Operations | Reference library with indexed entries; inspection templates aligned to Vol 1 standards |
| **DAFMAN 13-204 Vol 2** | Airfield Management: Airfield Operations | Check types, emergency response checklists, BASH procedures, RSC/RCR methodology |
| **DAFMAN 13-204 Vol 3** | Airfield Management: Special Operations | Reference library entries; extensible template system for specialized inspections |
| **UFC 3-260-01** | Airfield and Heliport Planning and Design | 10-surface obstruction evaluation engine with geodesic math, multi-runway analysis, and exact UFC table references |
| **AF Form 505** | Airfield Waiver Template | Waiver module captures all AF-505 fields with lifecycle tracking, coordination workflow, and annual review |
| **AFCEC Playbook App B** | Airfield Waiver Playbook | Waiver register format, classification types, status workflows, and Excel export format aligned to Appendix B |
| **DoD Instruction 4165.57** | Air Installations Compatible Use Zones | APZ I and APZ II land-use zone evaluation in obstruction module |
| **FAA AC 150/5300-13A** | Airport Design Standards | Runway dimensions, clear zone requirements, and approach surface criteria |

---

## 11. TECHNOLOGY STACK

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | Next.js (App Router) | 14.2.35 | React-based web framework with SSR, API routes, PWA support |
| Language | TypeScript (strict mode) | 5.9.3 | Full type safety, zero compile errors |
| Styling | Tailwind CSS | 3.4.19 | Utility-first CSS with light/dark/auto theme system |
| Backend | Supabase | SSR 0.8.0 | PostgreSQL database, authentication, file storage |
| Maps | Mapbox GL JS | 3.18.1 | Interactive maps, satellite imagery, surface overlays |
| PDF Viewing | react-pdf (PDF.js) | 10.3.0 | In-app regulation PDF viewer with pinch-to-zoom |
| PDF Generation | jsPDF + jspdf-autotable | 4.1.0 | Browser-based report PDF creation |
| Excel Export | SheetJS (xlsx) | 0.18.5 | Browser-based spreadsheet generation |
| Validation | Zod | 3.25.76 | TypeScript-first schema validation for all forms |
| Offline Storage | IndexedDB | Native | PDF caching, text search index, draft persistence |
| Icons | Lucide React | 0.563.0 | Consistent icon library |
| Notifications | Sonner | 1.7.4 | Toast notifications |
| PWA | @ducanh2912/next-pwa | 10.2.9 | Service worker, installability, offline caching |

**External APIs (All Free / No Key Required):**
- Open-Meteo — Weather data
- FAA NOTAM Search — Live NOTAM feed
- Open-Elevation — Ground elevation MSL lookup
- Mapbox Static Images — Satellite map thumbnails for PDF export (requires token)

---

## 12. DEPLOYMENT & SCALABILITY

**Deployment Target:** Vercel (Next.js native hosting) or any Node.js-compatible platform

**Infrastructure Requirements:**
- Supabase project (free tier supports development; Pro tier for production)
- Mapbox account (free tier: 50,000 map loads/month)
- No other paid services required — weather, NOTAMs, and elevation APIs are free

**Environment Variables:**
```
NEXT_PUBLIC_SUPABASE_URL       — Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY  — Supabase anonymous key
SUPABASE_SERVICE_ROLE_KEY      — Server-side admin key
NEXT_PUBLIC_MAPBOX_TOKEN       — Mapbox GL token
NEXT_PUBLIC_APP_URL            — Application URL
```

**Scaling Characteristics:**
- Supabase PostgreSQL scales vertically (compute) and horizontally (read replicas)
- Next.js on Vercel scales automatically with serverless functions
- Client-side PDF/Excel generation — zero server load for exports
- IndexedDB offloads data to client devices
- PWA service worker reduces server requests via caching

**Onboarding a New Base:**
1. Admin creates installation from the 155-base directory
2. Configures runways, NAVAIDs, areas, and CE shops via the UI
3. Initializes inspection templates (clone from default or customize)
4. Invites users with appropriate roles
5. No code deployment required — fully configuration-driven

---

## 13. CURRENT MATURITY & ROADMAP

### Current Status (v2.6.0)

| Component | Status |
|-----------|--------|
| Dashboard | Complete |
| Discrepancy Tracking | Complete |
| Airfield Checks (7 types) | Complete |
| Daily Inspections | Complete |
| Reports (4 types) | Complete |
| Obstruction Evaluations | Complete |
| Aircraft Database (1,000+) | Complete |
| Regulations Library (70 refs) | Complete |
| Waiver Management (full lifecycle) | Complete |
| NOTAMs (live FAA feed) | Complete |
| Activity Log / Audit Trail | Complete |
| User Management (invite/edit/reset) | Complete |
| Settings & Base Configuration | Complete |
| PDF Export (7 report types) | Complete |
| Excel Export (3 types) | Complete |
| Light/Dark/Auto Theme | Complete |
| PWA / Offline Capability | Complete |
| Multi-Base Architecture | Complete |
| TypeScript Build | Clean (0 errors) |

### Near-Term Roadmap

| Enhancement | Description | Priority |
|------------|-------------|----------|
| METAR Weather Integration | Live aviation weather from aviationweather.gov replacing Open-Meteo | High |
| Row-Level Security (RLS) | Database-level enforcement on all tables (currently app-layer only) | High |
| Server-Side Email Delivery | Branded email for inspection reports (vs. client-side PDF) | Medium |
| Offline Sync Queue | Store mutations while offline; auto-sync when connectivity returns | Medium |
| Unit & Integration Testing | Automated test suite for all modules | Medium |
| Type Generation | Regenerate Supabase types to eliminate ~170 `as any` casts | Medium |

### Long-Term Vision

| Capability | Description |
|-----------|-------------|
| CAC/PKI Authentication | Smart card login for DoD network compliance |
| IMDS / ACES Integration | Bi-directional sync with maintenance tracking systems |
| NASA DIP API | Automated NOTAM filing |
| RT3 Hardware Integration | Direct import from runway friction testers |
| Native Mobile App | React Native wrapper for enhanced offline and camera capabilities |
| Real-Time Collaboration | Supabase real-time subscriptions for live multi-user updates |
| AI-Assisted Analysis | Trend detection, predictive maintenance, and anomaly alerting |

---

## 14. VALUE PROPOSITION

### For the Airfield Manager

- **Single pane of glass** for all AM duties — no more switching between paper, spreadsheets, email, and websites
- **Instant operational picture** — open the app and see runway status, weather, advisories, and recent activity
- **Audit-ready** — every action logged with user, timestamp, and entity reference; export any report as PDF
- **Waiver management** — replace filing cabinets with a searchable, tracked, exportable waiver register with annual review workflow
- **Obstruction analysis** — UFC 3-260-01 calculations that previously took hours done in seconds with geodesic precision

### For the Career Field Manager

- **Standardization** — every base uses the same platform with per-base customization
- **Visibility** — leadership can see any installation's posture from any device
- **Compliance assurance** — inspection deadlines, waiver reviews, and discrepancy aging tracked automatically
- **Training acceleration** — new personnel have a built-in reference library and structured workflows that teach correct procedures
- **Data-driven decisions** — trend reports and aging analysis identify systemic issues across the enterprise

### For AFWERX / Spark Tank

- **Built by the warfighter, for the warfighter** — developed by active-duty AM personnel who live the problem daily
- **Zero infrastructure cost to evaluate** — demo mode runs with no server; `npm install && npm run dev` is all that is needed
- **Immediate ROI** — eliminates paper logs, reduces data entry, accelerates response times, and creates institutional memory that survives PCS cycles
- **155-base ready** — architecture supports every USAF, ANG, and AFRC installation without code changes
- **Modern tech stack** — TypeScript, React, PostgreSQL, PWA — maintainable by any web developer; no proprietary dependencies
- **Open-source backend** — Supabase is open-source; no vendor lock-in; can be self-hosted on DoD infrastructure
- **Proven regulatory alignment** — built directly from DAFI 13-213, DAFMAN 13-204, UFC 3-260-01, and AF Form 505

---

*Document generated from Glidepath v2.6.0 codebase analysis — February 2026*
*For questions or demonstrations, contact the Glidepath development team.*
