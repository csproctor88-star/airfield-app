# GLIDEPATH — Comprehensive Capabilities Brief

**Version 2.16.1 | March 2026**
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
   - 5.5 [ACSI — Annual Compliance Inspection](#55-acsi--annual-compliance-inspection)
   - 5.6 [Reports & Analytics](#56-reports--analytics)
   - 5.7 [Obstruction Evaluations](#57-obstruction-evaluations)
   - 5.8 [Aircraft Database & Pavement Analysis](#58-aircraft-database--pavement-analysis)
   - 5.9 [Regulations & Reference Library](#59-regulations--reference-library)
   - 5.10 [Waiver Lifecycle Management](#510-waiver-lifecycle-management)
   - 5.11 [NOTAMs — Live FAA Feed](#511-notams--live-faa-feed)
   - 5.12 [Events Log & Audit Trail](#512-events-log--audit-trail)
   - 5.13 [User Management & Access Control](#513-user-management--access-control)
   - 5.14 [QRC — Quick Reaction Checklists](#514-qrc--quick-reaction-checklists)
   - 5.15 [Shift Checklist](#515-shift-checklist)
   - 5.16 [Settings & Base Configuration](#516-settings--base-configuration)
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

**Glidepath** is a mobile-first Progressive Web Application (PWA) purpose-built for managing airfield operations across U.S. military installations. It consolidates the fragmented, paper-based, and spreadsheet-driven workflows that Airfield Management personnel use daily into a single, unified digital platform accessible from any phone, tablet, or computer.

The application covers the full spectrum of Airfield Management duties as defined in **DAFMAN 13-204 (Volumes 1-3)** and **UFC 3-260-01**: discrepancy tracking, airfield checks (7 types), daily inspections, annual compliance inspections (ACSI), obstruction evaluations, waiver lifecycle management, NOTAM monitoring, operational reporting, regulatory reference access, and an aircraft database with pavement loading analysis.

Every change made by any user — a runway status update, a completed inspection, an advisory — pushes live to all connected clients via Supabase Realtime. When someone closes a runway at the AM desk, everyone on the team sees it instantly.

**By the numbers:**

| Metric | Value |
|--------|-------|
| Application Routes | 57 |
| Source Files | 160 |
| Database Tables | 36 |
| Database Migrations | 79 |
| Aircraft Records | 200+ |
| Regulatory References | 70 |
| Military Installations in Directory | 155 |
| Airfield Check Types | 7 |
| QRC Templates | 25 |
| Report Types | 4 |
| PDF Export Types | 11 |
| Excel Export Types | 4 |
| User Roles | 9 |
| TypeScript Errors | 0 |
| Lines of Code | ~61,000 |

---

## 2. PROBLEM STATEMENT

Airfield Management operations at USAF, ANG, and AFRC installations currently rely on a patchwork of:

- **Paper logs and clipboards** for daily inspections and airfield checks
- **Shared spreadsheets** (often emailed) for discrepancy tracking and waiver registers
- **Manual PDF routing** for inspection reports, requiring printing, scanning, and email
- **Phone calls and radio** for communicating runway status, NAVAID conditions, and advisories
- **Separate FAA websites** to look up NOTAMs with no integration to local tracking
- **Printed UFC manuals** for obstruction evaluation reference — calculations done by hand
- **Filing cabinets** for waiver documentation, annual review records, and coordination signatures
- **No centralized audit trail** — accountability depends on who remembers what happened and when

This fragmentation creates:

1. **Delayed response times** — critical airfield status changes communicated slowly
2. **Lost institutional knowledge** — personnel rotate every 2-4 years; paper records do not transfer cleanly
3. **Compliance risk** — missed inspection deadlines, overdue waiver reviews, and undocumented discrepancies
4. **Redundant data entry** — the same information entered into multiple systems
5. **No operational visibility** — leadership cannot see real-time airfield posture without calling the Airfield Management desk
6. **Training gaps** — new personnel have no centralized reference for procedures and standards

---

## 3. SOLUTION OVERVIEW

Glidepath replaces all of the above with a single application that runs on any device with a web browser. Personnel open the app, authenticate, and immediately see the live airfield posture — runway status, weather, advisories, NAVAID conditions, and recent activity. From there, every Airfield Management function is two taps away.

**Core design principles:**

- **Real-time** — Supabase Realtime push updates ensure every user sees the same operational picture simultaneously. No refresh required.
- **Responsive** — Adapts across mobile (480px), tablet (768px), and desktop (1024px+) breakpoints with permanent sidebar navigation on wider screens. 44px+ touch targets for field use
- **Works offline** — Progressive Web App with IndexedDB caching; full demo mode with no server required
- **Multi-base ready** — Every data table scoped by installation; supports 155+ military bases out of the box
- **Role-based** — Nine roles in a three-tier hierarchy control who can view, create, and manage data
- **Audited** — Every action logged to an activity trail with user, timestamp, and entity reference
- **Exportable** — PDF reports generated in-browser and deliverable via email for command briefings and record-keeping
- **Standards-compliant** — Built directly from DAFMAN 13-204, UFC 3-260-01, and AF Form 505

---

## 4. PLATFORM ARCHITECTURE

### High-Level Architecture

```
                    +---------------------------+
                    |     User's Device          |
                    |  (Phone / Tablet / PC)     |
                    |                            |
                    |  +----------------------+  |
                    |  |   Glidepath PWA      |  |
                    |  |   (Web Application)  |  |
                    |  +----------+-----------+  |
                    |             |               |
                    |  +----------+-----------+  |
                    |  |   Offline Cache      |  |
                    |  |  (IndexedDB)         |  |
                    |  +----------------------+  |
                    +-------------|---------------+
                                  |
                    +-------------|---------------+
                    |        Cloud Backend        |
                    |  +---------------------+    |
                    |  | Database (28+ tbl)   |    |
                    |  +---------------------+    |
                    |  | Authentication       |    |
                    |  +---------------------+    |
                    |  | File Storage         |    |
                    |  +---------------------+    |
                    |  | Realtime (live push) |    |
                    |  +---------------------+    |
                    +-----------------------------+
                                  |
              +-------------------|-------------------+
              |                   |                   |
    +---------+------+  +--------+-------+  +---------+------+
    |   Weather API  |  | FAA NOTAM API  |  |   Elevation    |
    |   (Open-Meteo) |  | (notams.aim)   |  |   API (MSL)    |
    +----------------+  +----------------+  +----------------+
              |
    +---------+------+
    |   Mapbox Maps  |
    | (Maps/Sat Img) |
    +----------------+
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Progressive Web App** | Installable on any device without app store approval; works offline; auto-updates |
| **Cloud-hosted database** | Secure, scalable PostgreSQL with built-in auth, storage, and real-time capabilities |
| **Realtime subscriptions** | Live push updates eliminate the need to refresh the page — all users see the same picture |
| **Client-side PDF/Excel** | Reports generated in-browser — no server load, works offline, instant delivery |
| **Server-side email** | PDF reports can be emailed directly from the app via Resend with branded sender |
| **Multi-base data isolation** | Every table scoped by installation; data from one base never visible to another |
| **Demo mode** | App runs fully offline with mock data when not connected — zero setup for training and demos |

---

## 5. MODULE-BY-MODULE CAPABILITIES

### 5.1 Dashboard — Real-Time Operational Hub

The dashboard is the first screen users see after login. It provides a complete snapshot of current airfield posture in a single scroll — and it updates live. When another user changes the advisory, toggles the active runway, or completes a check, every connected client sees the change within seconds.

**Live Clock & Weather**
- Real-time clock updating every second
- Weather integration (no API key required): temperature, conditions, wind speed/direction, visibility
- Dynamic weather icons based on current conditions

**Installation Context**
- Current base name and ICAO code displayed prominently
- Dropdown switcher for users assigned to multiple installations

**Advisory System**
- Three alert tiers: INFO (blue), CAUTION (yellow), WARNING (red)
- Custom advisory text set by Airfield Management
- Persistent banner visible across the app
- **Pushes live** to all connected clients via Supabase Realtime

**Active Runway Control**
- Toggle between runway configurations (e.g., RWY 01/19)
- Three-state status: Open (green), Suspended (yellow), Closed (red)
- Color-coded card background matches status
- Every status change persisted to database with automatic audit log entry and runway status log
- **Pushes live** to all connected clients

**Current Status Panel**
- Runway Surface Condition (RSC) — last reading and time
- Bird Watch Condition (BWC) — current level and time
- Last Check Completed — type and timestamp
- Inspection completion percentage
- **Updates live** when new checks or inspections are completed anywhere

**NAVAID Status**
- Side-by-side panels for each runway end
- Green / Yellow / Red single-tap toggle per navigation aid
- Auto-expanding notes field when status is Yellow or Red

**Quick Actions**
- Large, touch-friendly buttons: Begin Inspection, Begin Check, New Discrepancy
- Immediate access to the most common workflows

**Activity Feed**
- Rolling list of recent actions across the installation
- Color-coded action dots, clickable items linking to source entities
- Manual text entries for events not captured by the system

**User Presence**
- Online/Away/Inactive status tracking with 5-minute heartbeat
- See who else is active on the platform

---

### 5.2 Discrepancy Tracking

Full lifecycle management of airfield deficiencies — from identification in the field to resolution and closeout.

**11 Discrepancy Types:** FOD, pavement, lighting, markings, signage, drainage, vegetation, wildlife, equipment, security, other

**Lifecycle:** Created → Submitted to AFM → Submitted to CES → Awaiting CES Action → Work Completed → Verified & Closed (or Cancelled)

**Features:**
- Four severity levels: Low, Medium, High, Critical (color-coded badges)
- Photo capture from device camera with GPS coordinates
- Interactive Mapbox map for pinning exact location
- Assignment to specific CE shop from configurable list
- Work order number tracking and linked NOTAM references
- Timestamped notes history with user identification
- Days-open aging counter
- Searchable, filterable list with clickable KPI counters
- Auto-generated display ID: `D-YYYY-NNNN`

**Common Operating Picture (COP) Map:**
- Mapbox satellite map with type-emoji markers for every geo-tagged discrepancy
- Hover popups with photos, work order, and key details
- Clickable type filter legend with counts
- List/Map toggle for switching between table and map views
- Auto-fit bounds to show all visible discrepancies

---

### 5.3 Airfield Checks

Seven check types in a single unified form, covering the full range of routine and emergency airfield checks.

| Check Type | Key Fields |
|-----------|------------|
| **FOD Check** | Route (multi-select areas), items found, clear/not-clear |
| **RSC Check** | Runway condition (wet/dry), observation notes |
| **RCR Check** | Mu readings (rollout/midpoint/departure), contaminant, braking action, equipment, temperature |
| **IFE** | Aircraft info (callsign, type, tail), classification, damage/injuries |
| **Ground Emergency** | 12-item AM action checklist, 9 agency notifications, incident narrative |
| **Heavy Aircraft** | Aircraft type, parking, weight, taxi route, pavement observations |
| **BASH** | Condition code, species, mitigation, habitat attractants |

**Common Features:**
- Photo capture with GPS, Mapbox location pinning
- Multiple issues per check with per-issue photos and GPS pins
- Follow-up remarks with auto-save on completion
- Supabase draft persistence — save a draft on one device, resume on another
- Full history with type filtering, search, and detail views
- PDF export and email delivery

---

### 5.4 Daily Inspections

Combined Airfield Inspection Report with two halves — Airfield and Lighting — using fully customizable per-base inspection templates.

**Features:**
- Default templates: Airfield (9 sections, 42 items) + Lighting (5 sections, 32 items)
- Three-state toggle per item: Pass (green) / Fail (red) / N/A (gray) — all items default to Pass
- BWC items use four-state toggle: LOW / MOD / SEV / PROHIB
- **Multiple discrepancies per failed item** — each with its own comment, GPS pin, map thumbnail, and photos
- Draft persistence to localStorage and Supabase for cross-device access
- Two-step Complete/File workflow with per-user tracking
- Combined PDF export with per-discrepancy photos and location maps
- Standalone forms for Construction Meeting and Joint Monthly inspections with personnel attendance tracking

---

### 5.5 ACSI — Annual Compliance Inspection

Annual Airfield Compliance and Safety Inspection per DAFMAN 13-204v2, Para 5.4.3. A comprehensive compliance review covering 10 sections and approximately 100 checklist items.

**Form Capabilities:**
- 10 collapsible sections (all collapsed by default for navigation)
- Y/N/N/A toggle per item
- Per-item discrepancy documentation for failures: comment, work order, project number, estimated cost, estimated completion date
- Photo and map upload on failed items
- Inspection team editor (AFM/CE/Safety required + additional members)
- Risk management certification with 3 signature blocks (OG/CC, MSG/CC, WG/CC)
- General notes

**Output:**
- Read-only detail view with color-coded response badges and inline discrepancy details
- PDF export with parent/sub-field visual hierarchy and inline discrepancy photos
- Excel export (4 sheets: Cover, Checklist, Team, Risk Cert)
- Draft persistence via localStorage auto-save + DB auto-save for cross-device access
- Edit capability for authorized roles (AFM, Base Admin, System Admin)

---

### 5.6 Reports & Analytics

Four operational report types designed for command briefings and record-keeping.

| Report | What It Shows |
|--------|-------------|
| **Daily Operations Summary** | All activity for a date or date range — inspections, checks, status changes, discrepancies, obstructions |
| **Open Discrepancies** | Current snapshot with area and type breakdowns, embedded photos and satellite map thumbnails |
| **Discrepancy Trends** | Opened vs. closed over 30d/90d/6m/1y with top areas and types |
| **Aging Discrepancies** | Open items grouped by age tier (0-7d, 8-14d, 15-30d, 31-60d, 61-90d, 90+d) with severity and shop breakdowns |

All reports include branded headers with installation name/ICAO, page numbers, and generation timestamps. Every report can be exported as PDF or emailed directly from the app.

---

### 5.7 Obstruction Evaluations

The Obstruction Evaluation Tool automates UFC 3-260-01 imaginary surface analysis — a process that traditionally requires hours of hand calculations using printed regulatory manuals, hand-drawn diagrams, and standalone calculators. Glidepath performs this analysis in seconds, evaluating potential obstructions against all base runways simultaneously.

**What It Does:**
- Evaluates any object (tree, tower, crane, structure) against 10 UFC 3-260-01 imaginary surfaces per runway
- Analyzes against ALL base runways at once — no need to run separate calculations per runway
- Uses geodesic math (Haversine, cross-track, along-track) for precision distance and bearing calculations
- Queries elevation APIs for ground MSL height at the obstruction location
- Instantly identifies which surfaces are violated, reports penetration depth in feet, and provides UFC table references

**Interactive Map:**
- Color-coded surface overlay polygons on satellite imagery
- Per-runway toggles in the legend — see one runway's surfaces or all at once
- Click-to-place obstruction on map or enter coordinates manually
- Map auto-refreshes when switching between installations

**Results:**
- Table showing all 10 surfaces with bounds check, max allowable height, obstruction height, violation status, and penetration depth
- Controlling surface identified per runway
- Multiple photos per evaluation
- Full evaluation history with search and detail views
- History map view with violation/clear markers, status filter legend, and list/map toggle

**Operational Impact:**
- Reduces evaluation time from 1–4 hours (manual) to under 30 seconds
- Eliminates calculation errors inherent in manual processes
- Provides instant violation detection with regulatory references
- Enables Airfield Managers to evaluate potential obstructions on the spot — from any device

---

### 5.8 Aircraft Database & Pavement Analysis

Reference database of 200+ military and civilian aircraft for airfield planning and load analysis.

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
- Favorites system (persistent across sessions)
- **ACN/PCN Comparison Panel** — compare aircraft pavement loading against runway PCN values to determine if an aircraft is safe, marginal, or unsuitable for a given runway
- Aircraft images where available

**Operational Use:**
- Heavy Aircraft Check validation — compare arriving aircraft ACN against runway PCN
- Airfield planning — determine which aircraft a runway can support
- Taxi route planning — wheel base and turn radius for taxiway geometry

---

### 5.9 Regulations & Reference Library

Comprehensive regulatory reference library providing instant access to the documents Airfield Management personnel reference daily.

**References Tab:**
- 70 regulation entries from DAFMAN 13-204 Vols 1–3, UFC 3-260-01, and cross-references
- 20 categories, 6 publication types (DAF, FAA, UFC, CFR, DoD, ICAO)
- Full-text search across titles, descriptions, and tags
- Favorites with localStorage persistence
- In-app PDF viewer with pinch-to-zoom and page navigation
- Offline caching via IndexedDB with "Cache All" bulk download
- Admin controls for adding/deleting references with PDF upload

**My Documents Tab:**
- Upload personal PDFs, JPGs, and PNGs (50MB max per file)
- Client-side text extraction for search
- Per-document offline caching
- Supabase Storage integration

---

### 5.10 Waiver Lifecycle Management

Full airfield waiver lifecycle management modeled after AF Form 505 and the AFCEC Playbook Appendix B requirements.

**Classifications:** Permanent, Temporary, Construction, Event, Extension, Amendment

**Status Workflow:** Draft → Pending → Approved → Active → Expired / Closed / Cancelled (with reactivation paths)

**Features:**
- AF Form 505 field coverage: waiver number (auto-generated), hazard rating, justification, risk assessment, corrective action, dates, FAA case number
- Office-by-office coordination tracking (CE, AFM, Safety, Ops/TERPS, ATC, Wing CC)
- Photo attachments with camera capture and typed categories
- Annual Review module: year-by-year review with KPIs and board presentation tracking
- Individual Waiver PDF export with embedded photos, criteria, coordination
- Waiver Register Excel export (multi-sheet: Register, Criteria, Coordination)
- 17 real KMTC historical waivers seeded as demonstration data

**Map View:**
- Mapbox satellite map with emoji markers by classification type
- Clickable type filter legend
- Status badges in popups
- List/Map toggle
- GPS location picker for waiver create/edit forms

---

### 5.11 NOTAMs — Live FAA Feed

Live FAA NOTAM feed directly integrated into the airfield management workflow.

**Features:**
- Auto-fetches NOTAMs for the current installation's ICAO code on page load
- ICAO search input for querying any airport worldwide
- Full NOTAM text displayed in monospace on each card
- Feed status indicator, refresh button, loading/error states
- Filter chips: All / FAA / Local / Active / Expired
- Draft creation for local NOTAMs
- PDF export with email delivery
- Falls back to demo data when not connected

---

### 5.12 Events Log & Audit Trail

Complete audit trail for every action taken in the application, plus manual entry support for events that happen outside the app. Renamed from "Activity Log" in v2.15.0 to better reflect its role as a comprehensive events ledger.

**Features:**
- Columnar table display: Time (Z), User, Action, Details — grouped by date headers
- Date-range filtering: Today, 7 Days, 30 Days, Custom
- Per-column text search filters for narrowing results
- Manual text entry for events not captured by the system (shift turnovers, phone calls, etc.)
- Activity templates: pre-built entry templates for common events (e.g., "Shift Turnover", "Phone Call from Base Ops")
- Edit/delete entries via modal dialog with Zulu time editing
- Clickable user IDs showing role and masked EDIPI
- Clickable items link to source entity (discrepancy, check, inspection, etc.)
- Excel export with styled formatting
- Integrated into Daily Operations Report PDF as a chronological Events Log section

---

### 5.13 User Management & Access Control

Admin module for managing users across installations.

**Features:**
- Searchable user list with role and status filter dropdowns
- User cards with rank, role badge, status badge, base assignment, last seen
- User detail modal for editing profiles with field-level permission enforcement
- Email privacy: masked by default with eye icon toggle to reveal
- Invite user with email, rank, names, role, installation — branded setup email
- Password reset (admin-initiated and self-service)
- Account lifecycle: Deactivate/reactivate users, delete accounts (sys_admin only with type-to-confirm)
- User deletion cascade: nullifies FK references across 10 tables before deleting profile and auth record

**Three-Tier Admin Hierarchy:**
- **sys_admin** — Full access across all bases, can assign any role, delete accounts
- **base_admin / AFM / NAMO** — Full operational access at assigned base, manage base users
- **Operational roles** (amops, ces, safety, atc, read_only) — Varying levels of create/edit/view

---

### 5.14 QRC — Quick Reaction Checklists

Interactive execution of 25 digitized Quick Reaction Checklists for airfield emergencies and operational events. Replaces the paper QRC binder with a tracked, auditable, real-time digital system.

**25 QRC Templates:**
IFE/Ground Emergency, Aircraft Mishap, ARFF Status, Airfield Restrictions & Closures, Hot Brakes/Hung Ordnance, Building Evacuation, Air Evacuation, CMAV, Hazardous Cargo, Overdue Aircraft, Fuel Spill, Tornado Warning, Bomb Threat, Bird Strike, BWC Change, Anti-Hijacking, Alert/Recall Procedures, Unauthorized Aircraft Landing, DV Inbound/Outbound, Hydrazine Incident, ELT, Pyrotechnics Use, Customs/Agriculture, Civil/Foreign Aircraft Inbounds, Mishap Notification.

**Features:**
- Three tabs: Available (template grid), Active (open executions in progress), History (closed/all)
- 6 step types: checkbox, checkbox with note, agency notification tracking, fill-in fields, time fields with "Now (Z)" auto-fill, conditional cross-references to other QRCs
- SCN (Secondary Crash Net) form: data entry fields (aircraft type, callsign, tail number, etc.) displayed above steps for applicable QRCs
- Lifecycle: Open (start execution) → Close (with initials/timestamp) or Cancel (permanently delete accidental openings)
- Dashboard KPI badge with active QRC count
- Quick-launch dialog: start new QRC or resume active execution directly from dashboard without navigating away
- Admin-only template management in Base Configuration with selective seeding from 25 built-in templates
- Annual review tracking: last reviewed date, reviewer, and review notes per template
- Activity logging for open, close, cancel, and reopen actions
- Daily ops report integration: QRC executions section with step completion counts and SCN data sub-tables

**Operational Impact:**
- Eliminates paper QRC binder management and ensures checklists are always current
- Provides real-time visibility into active emergency responses across the team
- Creates an auditable record of every step completed during an emergency
- SCN form data automatically captured and available for post-incident reporting

---

### 5.15 Shift Checklist

Per-shift task tracking with configurable items per base. Ensures recurring duties (daily, weekly, monthly) are completed and documented by shift personnel.

**Features:**
- Three shifts: Day, Swing, Mid — each with independently configurable items
- Item frequency: daily, weekly, monthly
- Timezone-aware date calculation: uses the base's configured timezone and reset time (default 06:00) to determine the current checklist date. Before the reset time, items belong to the previous day
- Today tab: progress bar per shift showing completion percentage, check-off items with optional notes, file/reopen workflow with per-user tracking
- History tab: clickable historical checklists with read-only detail view showing who completed each item and when
- Dashboard KPI badge: quick access dialog for marking items complete without leaving the dashboard
- Base Configuration: add/edit/delete/toggle items per shift, configurable daily reset time per base

**Operational Impact:**
- Standardizes shift turnover procedures across all personnel
- Provides documentation that recurring duties were completed (important for compliance audits)
- Dashboard integration means shift duties don't get forgotten during busy periods

---

### 5.16 Settings & Base Configuration

Comprehensive settings system with collapsible dropdown sections.

**Sections:**
- **Profile** — Read-only user info, rank, role, primary base, configurable default PDF email
- **Installation** — Current base display; switching/adding for sys_admin
- **Data & Storage** — View/clear cached data, estimated storage
- **Regulations Library** — Download all PDFs for offline, manage cache
- **Base Configuration** (`/settings/base-setup`) — Runways, NAVAIDs, areas, CE shops, ARFF aircraft, airfield diagram upload, shift checklist items, checklist reset time, QRC templates
- **Inspection Templates** (`/settings/templates`) — Customize airfield/lighting checklist sections and items
- **Appearance** — Day/Night/Auto theme toggle
- **About** — Version, environment, branding

---

## 6. MULTI-BASE ARCHITECTURE

Glidepath's multi-base architecture enables a single deployment to serve every USAF, ANG, and AFRC installation simultaneously.

**How It Works:**
- Every operational table carries a `base_id` foreign key
- Row-Level Security policies enforce data isolation at the database level
- Users belong to installations via a `base_members` join table
- A directory of 155+ military installations (AFBs, ANGBs, Joint Bases, Space Force stations) is built in
- Users assigned to multiple bases can switch between them instantly via the header dropdown

**Per-Base Configuration:**
- Runways, NAVAIDs, areas, and CE shops configured independently
- Inspection templates customizable per base
- Airfield diagrams stored per installation

**Onboarding a New Base:**
1. Admin selects from the 155-base directory or manually adds a new installation
2. System auto-creates the base site structure
3. Configure runways, NAVAIDs, areas, and CE shops via admin UI
4. Initialize inspection templates (clone from defaults or customize)
5. Invite users with appropriate roles
6. **No code deployment required** — fully configuration-driven

**Currently Seeded:** Selfridge ANGB (KMTC), Andersen AFB (PGUA), Mountain Home AFB (KMUO), Bradley International/CT ANG (KBDL), Beale AFB (KBAB)

---

## 7. OFFLINE & FIELD OPERATIONS

Glidepath is designed for use in the field — on the flightline, during FOD walks, during inspections — where connectivity may be limited.

**PWA Capabilities:**
- Installable on iOS, Android, and desktop home screens
- Custom app icon and branded launch experience
- Service worker caches app shell for instant loading

**Offline Data Access:**
- All 70 regulation PDFs downloadable for offline viewing ("Cache All")
- Aircraft database available offline (static data)
- Inspection drafts auto-saved to localStorage and Supabase
- Check drafts saved to Supabase for cross-device access
- Airfield diagrams cached locally

**Demo Mode:**
- Full application runs with zero network calls when Supabase is not configured
- Mock data for every module: discrepancies, NOTAMs, waivers, aircraft, regulations
- Ideal for training, evaluation, and demonstrations

---

## 8. EXPORT & REPORTING CAPABILITIES

### PDF Reports (11 Types)

| Report | Content |
|--------|---------|
| Daily Operations Summary | All activity for date/range with Events Log, QRC details, location maps, and photos |
| Open Discrepancies | Current snapshot with area/type breakdowns and satellite thumbnails |
| Discrepancy Trends | Historical opened vs. closed with area/type analysis |
| Aging Discrepancies | Open items by age tier with severity and shop breakdowns |
| Individual Inspection | Section-by-section pass/fail with per-discrepancy photos and maps |
| Combined Inspection | Multi-inspection combined PDF with all discrepancy photos |
| Special Inspection | Construction/Joint Monthly with personnel attendance |
| Individual Waiver | Full AF-505 format with criteria, coordination, and photos |
| Individual Check | Check detail with location map and per-issue photos |
| Individual Discrepancy | Single discrepancy detail with photos and location map |
| ACSI Inspection | Annual compliance report with parent/sub-field hierarchy and inline photos |

All PDFs include branded headers, page numbers, and timestamps. Every PDF can be downloaded directly or emailed via Resend.

### Excel Exports (4 Types)

| Export | Sheets |
|--------|--------|
| Waiver Register | Waivers (full register), Criteria & Standards, Coordination Status |
| Annual Review | Year review data with recommendations and board presentation status |
| ACSI Inspection | Cover, Checklist, Inspection Team, Risk Cert |
| Activity Log | Date, Time, User, Rank, Action, Entity, Details |

**Excel Features:**
- Styled formatting with header colors, alternating rows, frozen headers
- Column auto-sizing
- Number formatting for dates and currency
- Multiple worksheets per workbook

---

## 9. SECURITY & ACCESS CONTROL

**Authentication:**
- Email/password login with secure session management
- Account invitation with email verification
- Password reset with secure email-based recovery flow
- Account deactivation blocks login immediately
- Email privacy: user emails masked by default with eye toggle to reveal

**Authorization — Nine Roles:**

The application implements nine roles across a five-tier hierarchy, enforced at both the database level (Row-Level Security) and the application layer (UI guards + API route checks).

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

**Database-Level Enforcement (Row-Level Security):**
- RLS enabled on all operational tables with role-based policies
- Three SECURITY DEFINER helper functions: `user_has_base_access()`, `user_can_write()`, `user_is_admin()`
- Base-scoped data isolation — users can only query data from their assigned base
- sys_admin bypass for cross-base administration
- Storage bucket policies on `photos` for file access control
- Defense-in-depth: database rejects unauthorized operations even if app layer is bypassed

---

## 10. REGULATORY COMPLIANCE

Glidepath is built directly from and in support of the following governing regulations:

| Regulation | Full Title | How Glidepath Supports It |
|-----------|-----------|--------------------------|
| **DAFMAN 13-204 Vol 1** | Airfield Management: Airfield Planning and Operations | Reference library with indexed entries; inspection templates aligned to Vol 1 standards |
| **DAFMAN 13-204 Vol 2** | Airfield Management: Airfield Operations | Dashboard, checks, inspections, discrepancy tracking — all core AM duties digitized; ACSI annual compliance inspection |
| **DAFMAN 13-204 Vol 3** | Airfield Management: Special Operations | Reference library entries; extensible template system for specialized inspections |
| **UFC 3-260-01** | Airfield and Heliport Planning and Design | Automated obstruction evaluation engine with geodesic math, multi-runway analysis, and UFC table references |
| **AF Form 505** | Airfield Waiver Template | Waiver module captures all AF-505 fields with lifecycle tracking, coordination workflow, and annual review |
| **AFCEC Playbook App B** | Airfield Waiver Playbook | Waiver register format, classification types, status workflows, and Excel export format aligned to Appendix B |
| **DoD Instruction 4165.57** | Air Installations Compatible Use Zones | APZ I and APZ II land-use zone evaluation in obstruction module |
| **FAA AC 150/5300-13A** | Airport Design Standards | Runway dimensions, clear zone requirements, and approach surface criteria |

---

## 11. TECHNOLOGY STACK

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js (App Router) | Web framework with server-side rendering, API routes, PWA support |
| Language | TypeScript (strict mode) | Full type safety, zero compile errors |
| Styling | CSS Custom Properties + Tailwind | Dark-theme design system with light/dark/auto theme |
| Backend | Supabase (PostgreSQL) | Database, authentication, file storage, real-time subscriptions |
| Maps | Mapbox GL JS | Interactive maps, satellite imagery, surface overlays |
| PDF Viewing | react-pdf | In-app regulation PDF viewer with pinch-to-zoom |
| PDF Generation | jsPDF | Browser-based report PDF creation |
| Email Delivery | Resend | Server-side branded PDF email delivery |
| Excel Export | SheetJS + ExcelJS | Browser-based spreadsheet generation with styling |
| Validation | Zod | Schema validation for all forms |
| Offline Storage | IndexedDB | PDF caching, text search index, draft persistence |
| PWA | next-pwa | Service worker, installability, offline caching |

**External APIs (All Free / No Key Required):**
- Open-Meteo — Weather data
- FAA NOTAM Search — Live NOTAM feed
- Open-Elevation — Ground elevation MSL lookup
- Mapbox — Maps and satellite map thumbnails (requires token)

---

## 12. DEPLOYMENT & SCALABILITY

**Deployment Target:** Cloud-hosted (Vercel or any compatible platform)

**Infrastructure Requirements:**
- Supabase project (free tier supports development; Pro tier for production)
- Mapbox account (free tier: 50,000 map loads/month)
- Resend account for email PDF delivery
- No other paid services required — weather, NOTAMs, and elevation APIs are free

**Onboarding a New Base:**
1. Admin selects an installation from the 155-base directory — or manually adds a base not on the list
2. Configures runways, NAVAIDs, areas, and CE shops via the admin UI
3. Initializes inspection templates (clone from default or customize)
4. Invites users with appropriate roles
5. No code deployment required — fully configuration-driven

---

## 13. CURRENT MATURITY & ROADMAP

### Current Status (v2.16.1)

| Component | Status |
|-----------|--------|
| Dashboard (Supabase Realtime push, KPI badges, QRC/Shift Checklist dialogs) | Complete |
| Airfield Status (inline personnel, construction/misc, advisory) | Complete |
| Discrepancy Tracking (COP map, individual PDF export) | Complete |
| Airfield Checks (7 types, cross-device drafts) | Complete |
| Daily Inspections (multi-discrepancy, per-issue photos, default-to-pass) | Complete |
| ACSI — Annual Compliance Inspection (PDF/Excel export) | Complete |
| Reports (4 types with Events Log + QRC details in daily ops PDF) | Complete |
| Obstruction Evaluations (multi-runway, map overlays) | Complete |
| Aircraft Database (200+ aircraft, ACN/PCN) | Complete |
| Regulations Library (70 refs, offline caching, My Documents) | Complete |
| Waiver Management (full lifecycle, annual review, attachment management) | Complete |
| NOTAMs (live FAA feed, expiry alerts) | Complete |
| QRC — Quick Reaction Checklists (25 templates, interactive execution, dashboard dialog) | Complete |
| Shift Checklist (per-shift tasks, timezone-aware dates, dashboard dialog) | Complete |
| Events Log (manual entries, activity templates, edit/delete, Excel export) | Complete |
| User Management (invite/edit/reset/delete, email privacy) | Complete |
| Email PDF Delivery (all 11 export pages) | Complete |
| Settings & Base Configuration (runways, NAVAIDs, areas, CE shops, ARFF, QRC templates, shift checklist) | Complete |
| Light/Dark/Auto Theme | Complete |
| PWA / Offline Capability | Complete |
| Multi-Base Architecture (155+ installations) | Complete |
| Responsive Layout (mobile/tablet/desktop) | Complete |
| Row-Level Security (all 36 tables) | Complete |
| TypeScript Build | Clean (0 errors) |

### Near-Term Roadmap

| Enhancement | Description | Priority |
|------------|-------------|----------|
| METAR Weather Integration | Live aviation weather from aviationweather.gov | High |
| Offline Sync Queue | Store mutations while offline; auto-sync on reconnection | Medium |
| Unit & Integration Testing | Automated test suite for all modules | Medium |

### Long-Term Vision

| Capability | Description |
|-----------|-------------|
| CAC/PKI Authentication | Smart card login for DoD network compliance |
| Platform One Deployment | Enterprise hosting via Party Bus with cATO |
| IMDS / ACES Integration | Bi-directional sync with maintenance tracking systems |
| RT3 Hardware Integration | Direct import from runway friction testers |
| AI-Assisted Analysis | Trend detection, predictive maintenance, anomaly alerting |

---

## 14. VALUE PROPOSITION

### For the Airfield Manager

- **Single pane of glass** for all Airfield Management duties — no more switching between paper, spreadsheets, email, and websites
- **Instant, shared operational picture** — open the app and see runway status, weather, advisories, and recent activity — live, in real time, across all connected users
- **Audit-ready** — every action logged with user, timestamp, and entity reference; export any report as PDF or email it directly
- **Waiver management** — replace filing cabinets with a searchable, tracked, exportable waiver register with annual review workflow
- **Obstruction analysis** — calculations that previously took hours done in seconds with geodesic precision and instant violation detection

### For the Career Field Manager

- **Standardization** — every base uses the same platform with per-base customization
- **Visibility** — leadership can see any installation's posture from any device
- **Compliance assurance** — inspection deadlines, waiver reviews, and discrepancy aging tracked automatically
- **Training acceleration** — new personnel have a built-in reference library and structured workflows that teach correct procedures
- **Data-driven decisions** — trend reports and aging analysis identify systemic issues across the enterprise

### For Leadership & Decision Makers

- **Built by the warfighter, for the warfighter** — developed by active-duty Airfield Management personnel who live the problem daily
- **Zero infrastructure cost to evaluate** — demo mode runs with no server; clone and run is all that is needed
- **Immediate ROI** — eliminates paper logs, reduces data entry, accelerates response times, and creates institutional memory that survives PCS cycles
- **155-base ready** — architecture supports every USAF, ANG, and AFRC installation without code changes
- **Modern, maintainable technology** — built on industry-standard open-source tools with no proprietary dependencies or vendor lock-in
- **Proven regulatory alignment** — built directly from DAFMAN 13-204, UFC 3-260-01, and AF Form 505

---

*Glidepath Capabilities Brief — v2.16.1 — March 2026*
*Built by MSgt Chris Proctor, 127th Wing Airfield Management, Selfridge ANGB (KMTC)*
