# GLIDEPATH — Comprehensive Capabilities Brief

**Airfield Operations Management Suite**
**Version 2.6.0 | February 2026**

**"GUIDING YOU TO MISSION SUCCESS"**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [Technology Architecture](#4-technology-architecture)
5. [Module Capabilities](#5-module-capabilities)
   - 5.1 [Dashboard — Operational Command Center](#51-dashboard--operational-command-center)
   - 5.2 [Daily Inspections](#52-daily-inspections)
   - 5.3 [Airfield Checks](#53-airfield-checks)
   - 5.4 [Discrepancy Tracking](#54-discrepancy-tracking)
   - 5.5 [Obstruction Evaluations](#55-obstruction-evaluations)
   - 5.6 [Airfield Waivers](#56-airfield-waivers)
   - 5.7 [NOTAMs — Live FAA Feed](#57-notams--live-faa-feed)
   - 5.8 [Reports & Analytics](#58-reports--analytics)
   - 5.9 [Aircraft Database](#59-aircraft-database)
   - 5.10 [Regulatory Reference Library](#510-regulatory-reference-library)
   - 5.11 [User Management & Role-Based Access](#511-user-management--role-based-access)
   - 5.12 [Settings & Base Configuration](#512-settings--base-configuration)
   - 5.13 [Activity Log & Audit Trail](#513-activity-log--audit-trail)
6. [Multi-Base Architecture](#6-multi-base-architecture)
7. [Offline & Field Operations](#7-offline--field-operations)
8. [Security & Access Control](#8-security--access-control)
9. [Deployment & Infrastructure](#9-deployment--infrastructure)
10. [Regulatory Compliance](#10-regulatory-compliance)
11. [Current Metrics](#11-current-metrics)
12. [Roadmap](#12-roadmap)
13. [Competitive Advantages](#13-competitive-advantages)
14. [Contact & Resources](#14-contact--resources)

---

## 1. Executive Summary

**Glidepath** is a mobile-first, Progressive Web Application (PWA) purpose-built for U.S. military airfield operations personnel. It digitizes the full spectrum of airfield management workflows — inspections, checks, discrepancy tracking, obstruction evaluations, waiver lifecycle management, NOTAM monitoring, and operational reporting — into a single, unified platform accessible from any phone, tablet, or computer.

Glidepath replaces disconnected paper forms, Excel spreadsheets, PowerPoint trackers, and manual processes that airfield managers currently rely on to execute their DAFI 13-213 responsibilities. It provides real-time situational awareness, automated regulatory compliance tracking, and a complete audit trail for every operational action.

**Key Facts:**
- **13 complete modules** covering every core airfield management function
- **41 routes** across 130+ source files
- **25+ database tables** with 49 applied migrations
- **1,000+ aircraft** in the reference database
- **70 regulatory references** with offline PDF access
- **155 military installations** in the base directory, ready for onboarding
- **Multi-base architecture** with per-installation data isolation
- **Full offline capability** via PWA with IndexedDB caching
- **Zero licensing cost** — built entirely on open-source and free-tier cloud services
- **Live deployment** at [glidepathops.com](https://www.glidepathops.com)

---

## 2. Problem Statement

### The Current State of Airfield Management

Airfield Operations personnel across the Air Force, Air National Guard, and Air Force Reserve manage some of the most safety-critical infrastructure in the Department of Defense. Yet the tools available to them are decades behind the operational tempo they face:

**Paper-Based Inspections**
- Daily airfield and lighting inspections are recorded on paper checklists or Word documents
- Inspection results cannot be searched, trended, or analyzed without manual data entry
- Paper forms are lost, damaged, or illegible — creating gaps in the compliance record
- No mechanism to attach photos or GPS coordinates to failed items

**Disconnected Tracking Systems**
- Discrepancies are tracked in standalone Excel spreadsheets with no linkage to inspections, work orders, or NOTAMs
- Airfield waivers are managed in PowerPoint slide decks and Excel registers that are difficult to update, search, or share
- Obstruction evaluations are performed with hand calculations or offline tools with no integration to waiver tracking
- Each base maintains its own format, creating inconsistency across the enterprise

**No Real-Time Situational Awareness**
- Runway status, NAVAID health, weather conditions, and advisories are communicated verbally or via whiteboard
- Shift turnovers rely on memory and paper notes
- No centralized dashboard showing current airfield conditions at a glance

**Limited Accountability**
- No automated audit trail for who changed what and when
- Status updates on discrepancies and work orders are tracked informally
- Annual waiver reviews are tracked in separate files with no automated reminders

**Regulatory Compliance Risk**
- DAFI 13-213, UFC 3-260-01, and related publications require specific inspection frequencies, documentation standards, and waiver review cycles
- Demonstrating compliance during inspections (UCI, SAV, IG) requires manually assembling records from multiple sources
- Missing or incomplete documentation exposes units to findings and mission risk

### The Cost of Inaction

- **Safety risk**: Undocumented discrepancies and missed inspections create hazards for aircraft operations
- **Compliance risk**: Paper-based records are difficult to produce during inspections and audits
- **Efficiency loss**: Airfield managers spend hours on administrative tasks that could be automated
- **Knowledge loss**: Institutional knowledge walks out the door with each PCS, PCA, or retirement
- **Scalability failure**: Each base reinvents tracking systems independently with no enterprise visibility

---

## 3. Solution Overview

Glidepath addresses every problem identified above through a single, integrated platform:

| Problem | Glidepath Solution |
|---------|-------------------|
| Paper inspections | Digital checklists with photo capture, GPS tagging, and PDF export |
| Disconnected tracking | Unified database linking inspections, checks, discrepancies, waivers, and NOTAMs |
| No situational awareness | Real-time dashboard with weather, runway status, NAVAID health, and activity feed |
| No accountability | Complete audit trail with user attribution and timestamps on every action |
| Compliance risk | Automated inspection templates aligned to DAFI 13-213, UFC 3-260-01 criteria |
| Waiver management chaos | Full AF Form 505 lifecycle with annual review tracking and automated KPIs |
| Base-specific solutions | Multi-base architecture supporting any number of installations from a single deployment |
| No field access | PWA works on any device — phone, tablet, laptop — with offline capability |
| UFC obstruction analysis | Automated imaginary surface calculations against all 10 UFC 3-260-01 surfaces |
| No aircraft reference | 1,000+ aircraft database with ACN/PCN pavement loading analysis |

### How It Works

```
Personnel in the Field (Phone/Tablet)
         ↓
    Glidepath PWA (Browser-Based, No App Store Required)
         ↓
    Next.js Application Server (Vercel Edge Network)
         ↓
    Supabase Backend (PostgreSQL + Auth + Storage)
         ↓
    Real-Time Data Sync Across All Users and Devices
```

Users access Glidepath through any modern web browser. No app store download is required. The application installs as a PWA on the home screen for a native app experience. All data syncs in real time across devices — an inspection started on an iPad in the field appears instantly on the desktop in the AMOPS office.

---

## 4. Technology Architecture

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 14 (App Router) | Server-side rendering, routing, API layer |
| **Language** | TypeScript (strict mode) | Type-safe code, compile-time error catching |
| **Styling** | Tailwind CSS | Responsive, mobile-first UI with light/dark/auto themes |
| **Database** | Supabase (PostgreSQL) | Relational database with real-time subscriptions |
| **Authentication** | Supabase Auth | Email/password authentication with role-based access |
| **File Storage** | Supabase Storage | Photos, PDFs, airfield diagrams, waiver attachments |
| **Maps** | Mapbox GL JS | Interactive satellite maps for location pinning and surface overlays |
| **PDF Export** | jsPDF + jspdf-autotable | Client-side PDF generation for all reports |
| **Excel Export** | SheetJS (xlsx) + ExcelJS | Formatted spreadsheet exports with styled headers |
| **PDF Viewing** | react-pdf (PDF.js) | In-app regulation viewing with pinch-to-zoom |
| **Validation** | Zod | Schema validation for all form inputs |
| **Offline Storage** | IndexedDB | Client-side caching for PDFs, text search, and diagrams |
| **PWA** | next-pwa | Service worker for offline app shell and asset caching |
| **Icons** | Lucide React | Consistent icon system across all modules |
| **Notifications** | Sonner | Toast notifications for user feedback |
| **Hosting** | Vercel | Edge-deployed with global CDN |

### Database Schema

**25+ tables** organized across operational, configuration, and administrative domains:

**Operational Tables:**
- `discrepancies` — Airfield issues with full lifecycle tracking
- `airfield_checks` — 7 check types with JSONB flexible data
- `inspections` — Daily inspection records with item-level results
- `obstruction_evaluations` — UFC 3-260-01 surface analysis results
- `waivers` — AF Form 505 waiver records with full field set
- `waiver_criteria` — UFC/standard references per waiver
- `waiver_reviews` — Annual review records with recommendations
- `waiver_coordination` — Office-by-office coordination tracking
- `waiver_attachments` — Photos and documents per waiver
- `notams` — FAA and local NOTAM tracking
- `photos` — Photo storage for all modules (discrepancies, checks, inspections, evaluations)
- `check_comments` — Remarks timeline for airfield checks
- `activity_log` — Complete audit trail for all system actions
- `airfield_status` — Current runway status, advisory, BWC, RSC
- `runway_status_log` — Audit trail for all runway status changes
- `navaid_statuses` — Green/Yellow/Red status for navigation aids

**Configuration Tables:**
- `bases` — Installation definitions (name, ICAO, elevation, timezone)
- `base_runways` — Runway geometry per base (coordinates, heading, class, dimensions)
- `base_navaids` — Navigation aid definitions per base
- `base_areas` — Airfield area names per base
- `base_ce_shops` — Civil Engineering shop list per base
- `inspection_template_sections` — Customizable inspection sections per base
- `inspection_template_items` — Customizable checklist items per base
- `regulations` — 70 regulatory references with metadata and storage paths

**Administrative Tables:**
- `profiles` — User accounts with rank, role, status, and base assignment
- `base_members` — User-to-installation membership (many-to-many)
- `user_documents` — Personal document uploads
- `user_document_pages` — Extracted text for search indexing

### Key Design Decisions

1. **Multi-Base from Day One** — Every data table carries a `base_id` foreign key. Queries are scoped to the user's current installation. A single deployment serves unlimited bases.

2. **Mobile-First Design** — 480px max-width layout optimized for phone and tablet use in the field. 44px+ touch targets. Bottom navigation for one-handed operation.

3. **Demo Mode** — The entire application runs fully offline with mock data when database credentials are not configured. Zero setup required for demonstrations, training, or development.

4. **Configurable Templates** — Inspection checklists are stored in the database, not hardcoded. Each base customizes their own sections and items. New bases clone from a default template.

5. **Client-Side PDF Generation** — Reports are generated in the browser using jsPDF. No server-side processing required. Works offline.

6. **Progressive Web App** — Installs on any device home screen without an app store. Service worker caches the app shell for offline access. IndexedDB stores regulation PDFs for field reference.

---

## 5. Module Capabilities

### 5.1 Dashboard — Operational Command Center

**Route:** `/` (Homepage)

The Dashboard serves as the real-time command center for airfield operations, providing at-a-glance situational awareness of current conditions, operational status, and recent activity.

**Live Clock & User Presence**
- Current local time display with auto-refresh every second
- Logged-in user's name and rank (e.g., "MSgt Proctor")
- User presence indicators: Online (active <15 min), Away (<60 min), Inactive (60+ min)
- Automatic `last_seen_at` heartbeat every 5 minutes

**Live Weather**
- Current conditions fetched from Open-Meteo API on page load
- Displays: temperature (F), conditions, wind speed (mph), visibility (SM)
- Weather-appropriate icons based on conditions (thunderstorm, snow, rain, fog, clear)

**Advisory System**
- Three severity levels: INFO (blue), CAUTION (yellow), WARNING (red)
- Tappable advisory banner with descriptive text
- Advisory management dialog: set type, enter text, save/clear/cancel
- Persisted to database — visible to all users at the installation

**Active Runway & Status**
- Single-tap runway toggle (e.g., RWY 01 / RWY 19)
- Status selector: Open (green card), Suspended (yellow card), Closed (red card)
- Card background dynamically changes color to match status
- All status changes persisted to database with audit log trigger

**Current Conditions Panel**
- RSC (Runway Surface Condition): Most recent reading with condition and timestamp
- BWC (Bird Watch Condition): Color-coded severity — LOW (green), MOD (yellow), SEV (orange), PROHIB (red)
- Last Check Completed: Most recent check type and time

**NAVAID Status Panels**
- Side-by-side panels for each runway end's navigation aids
- Three-state toggle per NAVAID: Green (Operational), Yellow (Degraded), Red (Inoperative)
- ILS prioritized at top of each panel
- Auto-expanding notes field when any NAVAID is flagged yellow or red
- Notes persist to database on blur or Enter key

**Quick Actions**
- Begin/Continue Airfield Inspection
- Begin Airfield Check
- New Discrepancy
- Large touch targets linking directly to workflows

**Activity Feed**
- 20 most recent activity log entries across all modules
- Color-coded action dots: Created (green), Completed (cyan), Updated (yellow), Status Changed (purple), Deleted (red)
- Clickable items navigate to the source entity
- Collapsible — 3 entries by default with "Show All" toggle

**Installation Switcher**
- Installation name and ICAO code displayed in clock section
- Dropdown switcher for multi-base users (sys_admin only)

---

### 5.2 Daily Inspections

**Route:** `/inspections`

Provides a complete digital replacement for paper-based airfield and lighting inspection checklists, supporting the full inspection lifecycle in compliance with DAFI 13-213.

**Two-Tab Inspection Structure**
- **Airfield Inspection**: Configurable sections covering runway surfaces, taxiways, lighting, markings, NAVAIDs, barriers, and general conditions
- **Lighting Inspection**: Configurable sections covering all airfield lighting systems
- Templates are per-base — each installation customizes their own checklist

**Checklist System**
- Organized by numbered sections (e.g., "1. Runway Surfaces", "2. Taxiways")
- Per-item tri-state toggle: Pass (green checkmark) → Fail (red X) → N/A (gray strikethrough) → Clear
- "Mark All Pass" bulk action per section for routine inspections
- Real-time progress tracking: percentage wheel with item counts
- Status breakdown: Pass count, Fail count, N/A count
- Failed items automatically reveal a comment text area and GPS location capture
- Section-level progress indicators

**BWC Assessment**
- Dedicated BWC item within the checklist
- Four selectable levels: LOW, MOD, SEV, PROHIB
- Color-coded buttons matching severity

**Special Inspection Modes**
- **Pre/Post Construction Meeting Inspection**: Personnel attendance tracking with representative name fields, free-form comments
- **Joint Monthly Airfield Inspection**: Personnel attendance tracking with representative name fields, free-form comments
- Mutually exclusive — enabling one disables the other
- Filed as standalone records

**Auto-Captured Metadata**
- Weather conditions and temperature automatically fetched at save time
- Inspector name and ID from authenticated user profile
- Timestamp recorded automatically

**Save & File Workflow**
- **Save**: Captures current tab's checklist state, weather, inspector info — does not close draft
- **File**: Submits both saved halves (airfield + lighting) to database
- Each half gets a unique display ID (e.g., AI-25-a3f4, LI-25-b7c2)
- Daily group ID links airfield and lighting halves
- Draft persistence to localStorage — survives page refresh and navigation
- Combined PDF export with both halves

**Inspection History**
- Paired daily reports displayed as single "Airfield Inspection Report" cards
- Type badges, display IDs, pass/fail/N/A counts, BWC badge
- Filter chips: All, Airfield, Lighting
- Full-text search across all fields
- Tap to navigate to detail view

**Airfield Diagram Viewer**
- View the installation's uploaded airfield diagram
- Diagrams stored in Supabase Storage for cross-device access

---

### 5.3 Airfield Checks

**Route:** `/checks`

Enables rapid documentation of routine and event-driven airfield checks as required by DAFI 13-213 and UFC 3-260-01. Supports seven distinct check types with type-specific data fields.

**Seven Check Types**

| Check Type | Key Data Fields |
|-----------|----------------|
| **FOD Walk** | Route, items found/documented, clear/not-clear |
| **RSC Check** | Contaminant type, depth, coverage, braking action, treatment applied |
| **RCR Check** | Mu readings (rollout/midpoint/departure), equipment, temperature |
| **IFE (In-Flight Emergency)** | Aircraft type/callsign, nature of emergency, 12-item AM action checklist, 9 agency notifications |
| **Ground Emergency** | Aircraft type (optional), nature of emergency, AM action checklist, agency notifications |
| **Heavy Aircraft** | Aircraft type/MDS, parking location, weight, taxi route |
| **BASH** | Condition code (LOW/MOD/SEV), species observed, mitigation actions, habitat attractants |

**Areas Checked**
- Pre-defined list of airfield areas (from base configuration)
- Toggle-style chip buttons with selection count
- At least one area required before completing a check

**Issue Found Workflow**
- Toggle "Issue Found" to reveal:
  - Interactive Mapbox map for GPS location pinning
  - Photo section: upload from gallery or capture with camera
  - Multi-photo support with thumbnail preview and delete

**Remarks System**
- Timestamped entries with user attribution
- Add via text area with Enter-to-save shortcut
- Displayed in reverse chronological order

**Check Completion**
- Validates check type and at least one area selected
- Saves all data including type-specific fields, comments, location, photos
- Photos uploaded to Supabase Storage
- Generates unique display ID (e.g., CK-25-d4e7)
- Navigates to completed check detail view

**Check History**
- Full history of completed checks with type filtering and search
- Card display with check type, areas, timestamp, remarks count

---

### 5.4 Discrepancy Tracking

**Route:** `/discrepancies`

Comprehensive work order tracking system for documenting, managing, and resolving airfield discrepancies through their full lifecycle.

**11 Discrepancy Types**
- FOD, Pavement, Lighting, Markings, Signage, Drainage, Vegetation, Wildlife, Equipment, Security, Other

**Full Lifecycle Management**
```
Open → Submitted to AFM → Submitted to CES → Work Completed → Closed
                                                              → Cancelled
```
Each status transition is tracked with timestamps and user attribution.

**Dashboard KPIs**
- OPEN count (yellow badge, tappable to filter)
- \>30 DAYS count (red when >0, green when 0, tappable to filter)
- Dynamic days-open calculation from creation timestamp

**Discrepancy Creation**
- Title, description, severity classification
- 11 discrepancy types with multi-select support
- Interactive Mapbox map for GPS location pinning
- Photo capture (camera) and upload (gallery) with multi-photo support
- Shop assignment from base-configured CE shop list

**Discrepancy Detail View**
- Full information display with all fields
- Status workflow tracking with action buttons per status
- Photo gallery with full-size viewing
- Work order number tracking
- NOTAM linkage
- Notes/comment history with timestamps

**Severity Classification**
- Critical, High, Medium, Low, Yes/No (binary)
- Color-coded throughout the interface

**PDF Export**
- Discrepancy Report PDF with embedded photos and satellite map thumbnails
- Photos and Mapbox satellite maps inline per discrepancy

**Filtering & Search**
- Status filter chips: Open, Completed, Cancelled, All
- ">30 Days" toggle for overdue items
- Full-text search across title, description, and work order number

---

### 5.5 Obstruction Evaluations

**Route:** `/obstructions`

Complete UFC 3-260-01 imaginary surface analysis tool for evaluating potential airfield obstructions. Calculates whether an obstruction violates any of 10 defined imaginary surfaces and provides detailed per-surface analysis with UFC table references.

**Interactive Airfield Map**
- Mapbox GL JS satellite imagery centered on the installation
- Color-coded imaginary surface overlays for all 10 surfaces:
  1. **Primary Surface** — 1,000 ft half-width, 0 ft max height
  2. **Approach-Departure Clearance** — 50:1 slope, 25,000 ft length
  3. **Transitional Surface** — 7:1 slope, 150 ft max height
  4. **Inner Horizontal** — 150 ft AGL, 13,120 ft radius
  5. **Conical Surface** — 20:1 slope, 150-500 ft height
  6. **Outer Horizontal** — 500 ft AGL, 42,250 ft radius
  7. **Clear Zone** — 3,000 ft length, 0 ft max height
  8. **Graded Area** — 1,000 ft length, 0 ft max height
  9. **APZ I** — 3,000-8,000 ft from threshold
  10. **APZ II** — 8,000-15,000 ft from threshold
- Per-runway surface generation and toggleable overlays
- Tap-to-place obstruction point with color-coded marker (green = no violation, red = violation)

**Multi-Runway Evaluation**
- Evaluates obstructions against ALL base runways simultaneously
- Per-runway surface overlays with runway-specific toggle controls
- Identifies the controlling surface across all runways

**Automatic Ground Elevation**
- Fetches real ground elevation (MSL) from Open-Elevation API on point selection
- Falls back to airfield elevation when API is unavailable

**Evaluation Engine**
- For each of the 10 surfaces, calculates:
  - Whether the point falls within the surface boundaries
  - Maximum allowable height (ft AGL and ft MSL)
  - Whether a violation exists
  - Penetration depth (ft) if violated
  - Applicable UFC reference and criteria text
- Determines the controlling surface (lowest height restriction)
- Identifies land-use zone restrictions (Clear Zone, APZ I/II)

**Surface Analysis Results**
- Summary banner: VIOLATION DETECTED (red) or NO VIOLATION (green)
- Controlling surface identification with quick stats
- Per-surface breakdown with color-coded status badges
- UFC reference citations for each violated surface
- Non-applicable surfaces collapsed in a separate list

**Geodesic Calculation Engine**
- Runway polygon generation from endpoint coordinates
- Haversine distance calculations
- Cross-track and along-track distance computations
- Runway-relative coordinate projection
- All dimensions per UFC 3-260-01, Table 3-1 for Class B runways

**Photo Documentation**
- Multiple photos per evaluation
- Camera capture and gallery upload
- Thumbnail preview with individual delete

**History & Persistence**
- Save evaluation results to database
- Edit and re-evaluate existing evaluations
- Searchable evaluation history with violation status indicators

---

### 5.6 Airfield Waivers

**Route:** `/waivers`

Full airfield waiver lifecycle management modeled after AF Form 505 and the AFCEC Airfield Planning & Waiver Playbook (Appendix B). Replaces Excel/PowerPoint-based tracking with a searchable, auditable database.

**Six Waiver Classifications**
- Permanent, Temporary, Construction, Event, Extension, Amendment

**Seven Status Values with Workflow**
```
Draft → Pending → Approved → Active → Closed / Expired / Cancelled
                                  ↕           ↕
                               Expired ←→ Closed
                                  ↓           ↓
                               Active ←────── Active (reactivate)
Cancelled → Draft (re-open)
```
All transitions between Active, Expired, and Closed require mandatory comments via dialog.

**Waiver List Dashboard**
- KPI badges: Permanent count, Temporary count, Expiring ≤12 months (amber), Overdue Review (red)
- Clickable KPI badges filter the list
- Filter chips: All / Draft / Pending / Approved / Active / Closed / Expired / Cancelled
- Full-text search across waiver number, description, criteria impact, proponent
- Card display: waiver number (monospace), status/classification/hazard badges, description, expiration

**New Waiver Form**
- 5 collapsible sections: Basic Info, Criteria & Standards, Risk Assessment, Project Information, Location & Dates
- Dynamic criteria rows: add/remove UFC references with source dropdown and description
- Auto-generated waiver number (P-CODE-YY-## format) with manual override
- Photo capture and upload with 3-column thumbnail grid
- Attachment modal with file type classification (photo, site map, risk assessment, UFC excerpt, FAA report, coordination sheet, AF Form 505, other)
- Save as Draft or Submit for Review

**Waiver Detail View — 6 Sections**
1. **Overview**: 2-column grid of all AF-505 fields (classification, hazard, dates, proponent, project info)
2. **Criteria & Standards**: UFC criteria violated with source, reference, and description
3. **Coordination**: Office-by-office coordination tracking (CE, AFM, Ops/TERPS, Safety, Installation CC) with status, date, and comments — editable and deletable
4. **Attachments**: Photo carousel with fullscreen viewer, document list with type labels, upload capability
5. **Review History**: Timeline of annual reviews with add/edit/delete — recommendation, mitigation verification, board presentation tracking
6. **Notes**: General notes and status change history

**Status Actions (Context-Sensitive)**
- Active: Close, Expire
- Closed: Reactivate, Mark Expired
- Expired: Reactivate, Mark Closed
- Draft: Submit, Delete
- Pending: Approve (with date modal), Send Back, Cancel

**Annual Review Mode** (`/waivers/annual-review`)
- Year selector with prev/next navigation
- KPIs: Total Active, Reviewed This Year, Not Reviewed, Presented to Board
- Expandable review form per waiver: recommendation, mitigation verified, project status update, notes, board presentation date
- Clickable KPI badges filter by review status

**Waiver PDF Export**
- Blue header bar with waiver number, status badge, installation name/ICAO
- Two-column field layout for all AF-505 fields
- Criteria table, coordination table, review history table
- Embedded photos in 2-column grid
- Attachment file list, page numbers, generation date

**Waiver Register Excel Export**
- Multi-sheet workbook matching AFCEC Playbook Appendix B format
- Waiver Register sheet: all waivers with key columns
- Criteria & Standards sheet: all criteria references
- Coordination Status sheet: all coordination entries
- Annual Review export: single-year review data

**Seed Data**
- 17 real Selfridge ANGB (KMTC) historical waivers with VGLZ-format numbers
- Criteria references, 2025 review records

---

### 5.7 NOTAMs — Live FAA Feed

**Route:** `/notams`

Live connection to the FAA's public NOTAM Search system. No API key required.

**Live FAA Data Feed**
- Proxies `notams.aim.faa.gov/notamSearch/search` — public endpoint
- Auto-fetches NOTAMs for the current installation's ICAO code on page load
- ICAO search input to query any airport (e.g., KJFK, KMUO)
- Full NOTAM text displayed on each card in monospace format
- 5-minute server-side cache for performance

**Feed Status Indicators**
- Green dot: connected and receiving data
- Red dot: error (rate limit, network failure)
- Gray dot: idle
- "Last fetched" timestamp with manual refresh button

**Filtering**
- Filter chips: All / FAA / LOCAL / Active / Expired
- Works on both live FAA data and locally created NOTAMs

**Local NOTAM Drafting**
- Create local NOTAM drafts for installation-specific notices
- Demo mode fallback with sample NOTAMs when Supabase not configured

---

### 5.8 Reports & Analytics

**Route:** `/reports`

Four report types with full PDF export capability. All reports pull real-time data from the operational database.

**1. Daily Operations Summary** (`/reports/daily`)
- Date or date-range selection
- Covers: inspections, checks, status changes, new discrepancies, obstruction evaluations
- PDF export with embedded check location maps and photos
- Installation name and ICAO in header

**2. Open Discrepancies Report** (`/reports/discrepancies`)
- Current snapshot of all open discrepancies
- Area and type breakdowns with counts
- Aging highlights for items >30 days
- PDF export with embedded photos and satellite maps

**3. Discrepancy Trends** (`/reports/trends`)
- Opened vs. closed over selectable periods: 30 days, 90 days, 6 months, 1 year
- Top areas and types by frequency
- Trend analysis for workload planning
- PDF export

**4. Aging Discrepancies** (`/reports/aging`)
- Open items grouped by age tiers: 0-7, 8-14, 15-30, 31-60, 61-90, 90+ days
- Severity and shop breakdowns per tier
- Identifies chronic issues requiring escalation
- PDF export

---

### 5.9 Aircraft Database

**Route:** `/aircraft`

Comprehensive reference of 1,000+ military and civilian aircraft specifications focused on airfield operations relevance.

**Aircraft Library**
- Military and commercial aircraft with category tabs and counts
- Full-text search across name, manufacturer, and gear configuration

**Aircraft Detail Cards (Expandable)**
- **Dimensions**: Wingspan, length, height
- **Aircraft Image**: Full-width photo when available
- **Turn Data**: Pivot point, turn radius, 180-degree turn diameter, controlling gear
- **Weights**: Empty, mission takeoff (military), max takeoff, mission landing (military), max landing
- **Performance** (military): Takeoff distance, landing distance
- **Landing Gear**: Configuration, nose/main assemblies and tires, gross load percentage, max assembly/wheel load, contact pressure (PSI), contact area, footprint width

**ACN/PCN Comparison Tool**
- Per-aircraft pavement load analysis panel
- Input parameters:
  - Weight condition: Max / Min
  - Pavement type: Rigid (K) / Flexible (CBR)
  - Subgrade strength: A (High) / B (Medium) / C (Low) / D (Ultra-Low)
  - Airfield PCN value
- Instant PASS (green, ACN ≤ PCN) or EXCEEDS (red, ACN > PCN) result
- Full ACN value table: all combinations across conditions and subgrades

**Favorites System**
- Star toggle on each aircraft card
- Pinned aircraft appear at top of results
- "Show pinned only" filter
- Persisted to localStorage

**Sorting**
- By name, wingspan, length, height, max takeoff weight, group index
- Ascending/descending toggle

---

### 5.10 Regulatory Reference Library

**Route:** `/regulations`

Centralized digital library of all applicable regulations, instructions, and technical references for airfield operations. Two-tab interface with organizational references and personal documents.

**References Tab — 70 Regulation Entries**
- Sourced from DAFMAN 13-204 Vols 1-3, UFC 3-260-01, and related publications
- Full-text search across reg IDs, titles, descriptions, and tags
- Category filter (20 categories): Airfield Ops, Safety, Engineering, Medical, Weather, etc.
- Publication type filter: DAF, DAFI, UFC, ETL, AFI, AFMAN, TO, etc.
- Combinable filters: search + category + pub type work together

**Favorites System**
- Star toggle on each reference card
- Favorites filter button with count badge
- "Show favorites by default" toggle
- Persisted to localStorage

**In-App PDF Viewer**
- Embedded PDF rendering without leaving the app
- Pinch-to-zoom touch gestures for mobile
- Supports both external URL PDFs and Supabase-stored PDFs
- Signed URLs for private-bucket access (1-hour expiry)

**Offline Caching**
- "Cache All" button to download all PDFs to IndexedDB
- Progress bar during bulk download with error tracking
- Cached count display (e.g., "42 of 48 cached for offline use")
- "Clear Cache" button to free storage
- Per-reference cache status tracking

**Admin Controls (sys_admin/airfield_manager)**
- Add Reference: full form with PDF upload to Supabase Storage
- Delete Reference: confirmation dialog, removes from DB + Storage + cache
- Duplicate detection on Reg ID

**My Documents Tab**
- Upload personal PDFs, JPGs, PNGs (up to 50 MB)
- Client-side text extraction for full-text search
- Per-document cache/uncache for offline access
- Documents stored in Supabase Storage under user's directory
- Status tracking: uploaded → extracting → ready/failed

---

### 5.11 User Management & Role-Based Access

**Route:** `/users`

Admin-only module for managing users across installations with a three-tier role hierarchy.

**Three-Tier Role Hierarchy**

| Tier | Roles | Capabilities |
|------|-------|-------------|
| **Tier 1** | `sys_admin` | Full access to all bases, can assign any role, manage installations, delete users |
| **Tier 2** | `base_admin`, `airfield_manager`, `namo` | Base-scoped admin: manage users at their base, create records, configure templates |
| **Tier 3** | `amops`, `ces`, `safety`, `atc`, `read_only` | Standard and restricted roles with varying create/view permissions |

**User Management Features**
- Searchable user list with role and status filter dropdowns
- User cards: rank, name, email, role badge, status badge, base assignment, last seen
- User detail modal: edit rank, names, role, installation with field-level permission enforcement
- Color-coded role badges: red (sys_admin), cyan (base_admin/AFM/NAMO), slate (regular)
- Status badges: green (active), red (deactivated), amber (pending)

**Invite Flow**
- Email, rank, first/last name, role, and installation fields
- Role restriction: base admins can only invite non-admin roles
- Base restriction: base admins can only invite to their own installation
- Sends branded setup email via Supabase Auth
- Invited users land on "Welcome — Set Up Your Account" page

**Password Reset**
- Admin-initiated: "Reset Password" button sends recovery email
- Self-service: "Forgot Password?" link on login page
- Secure PKCE code exchange and OTP token verification

**Account Lifecycle**
- Deactivate/reactivate users (blocked users see "Account deactivated" message)
- Delete accounts (sys_admin only) with type-to-confirm safety dialog
- Escalation prevention: only sys_admin can assign admin-tier roles

---

### 5.12 Settings & Base Configuration

**Route:** `/settings`, `/settings/base-setup`, `/settings/templates`

Comprehensive configuration hub with collapsible dropdown sections.

**Settings Hub Sections**
- **Profile**: Read-only display of user info, rank, role, primary base
- **Installation**: Current base display; switching restricted to sys_admin
- **Data & Storage**: View/clear cached data, estimated storage used
- **Regulations Library**: Download all PDFs for offline, manage cache
- **Base Configuration**: Link to full base setup page
- **Appearance**: Day/Night/Auto theme toggle
- **About**: Version, environment, branding

**Base Configuration** (`/settings/base-setup`)
- **Runways Tab**: Add/edit/delete runways with full metadata — length, width, surface, heading, class (B/Army_B), endpoint coordinates, designators, approach lighting
- **NAVAIDs Tab**: Add/delete navigation aids with automatic status row creation
- **Areas Tab**: Manage airfield area names for checks and inspections
- **CE Shops Tab**: Manage Civil Engineering shop list for discrepancy routing
- **Templates Tab**: Initialize default inspection templates, link to full template editor
- **Dashboard Preview**: Live preview of current base configuration

**Inspection Template Editor** (`/settings/templates`)
- Toggle between Airfield and Lighting templates
- Section and item CRUD: add, edit, delete, reorder
- Item type toggle: Pass/Fail vs. BWC
- Template initialization: clone from default template for new bases

---

### 5.13 Activity Log & Audit Trail

**Route:** `/activity`

Complete audit trail with date-range filtering and export capability.

**Features**
- Date-range filtering: Today, 7 Days, 30 Days, Custom
- Entries grouped by date with color-coded action dots
- Clickable items link to source entity (discrepancy, check, inspection, obstruction)
- Visual indicators: cyan text with arrow for linked items
- Excel export with styled formatting

**Logged Actions**
- Created, Updated, Deleted, Completed, Status Changed
- All CRUD operations across all modules logged automatically
- User attribution with display ID for traceability

---

## 6. Multi-Base Architecture

Glidepath was designed from the ground up to support any number of military installations from a single deployment.

**How It Works**
- Every operational data table carries a `base_id` foreign key
- Users belong to installations via the `base_members` join table
- All data queries are scoped to the user's current installation
- System administrators can switch between bases; regular users are locked to their assigned base

**Base Directory**
- 155 military installations pre-loaded with ICAO codes
- Covers Air Force, Air National Guard, Air Force Reserve, and Army installations
- New bases can be added via admin UI or SQL seed scripts

**Base Onboarding Process**
1. Create the installation (admin UI or SQL)
2. Add runways with full geometry (coordinates, heading, dimensions, class)
3. Add NAVAIDs for dashboard tracking
4. Add airfield areas for checks and inspections
5. Add CE shops for discrepancy routing
6. Initialize inspection templates (clone from default or build custom)
7. Invite users and assign roles

**Per-Base Configuration**
- Runway geometry and approach lighting
- NAVAID definitions
- Airfield area names
- CE shop list
- Inspection template sections and items
- Airfield diagram upload

**Data Isolation**
- Users at Base A cannot see data from Base B
- Reports, exports, and PDFs dynamically use the current installation's name and ICAO
- Runway status, advisories, and NAVAID statuses are per-base

---

## 7. Offline & Field Operations

Glidepath is designed for use in the field where connectivity may be limited or unavailable.

**Progressive Web App (PWA)**
- Installs on any device home screen — no app store required
- Custom icon (circular badge) for iOS and Android home screens
- Service worker caches the entire app shell for offline access
- Works on phones, tablets, laptops — any device with a modern browser

**Offline Data Storage**
- **IndexedDB**: 6 object stores for PDF blobs, text search data, user documents, and diagrams
- **localStorage**: Inspection drafts, aircraft favorites, regulation favorites, theme preference
- **Service Worker**: Caches app shell, PDF.js worker (90 days), and static assets

**Offline Capabilities**
- View all cached regulation PDFs without internet
- Continue inspection drafts saved in localStorage
- Access aircraft database (static data bundled with app)
- Full demo mode with mock data across all modules
- Airfield diagrams cached for offline reference

**Field-Optimized UX**
- 480px max-width layout for one-handed phone operation
- 44px+ touch targets for gloved hands and outdoor use
- Bottom navigation for thumb reach
- Camera integration for in-field photo capture
- GPS location capture for discrepancies, checks, and obstructions
- Dark mode for nighttime operations (auto-follows system preference)

---

## 8. Security & Access Control

**Authentication**
- Email/password authentication via Supabase Auth
- Session management with SSR cookie handling
- Middleware guards all authenticated routes
- Deactivated users blocked at login with clear messaging
- Password reset via email (admin-initiated or self-service)
- Account setup for invited users via secure token exchange (PKCE)

**Role-Based Access Control**
- 9 defined roles with hierarchical permissions
- Permission enforcement at both UI and API layers
- Escalation prevention: only sys_admin can promote to admin roles
- Field-level permission enforcement on user profile editing
- Admin API routes authenticate caller via cookie before using service role

**Data Security**
- Supabase Row-Level Security (RLS) policies on storage buckets
- Per-installation data isolation (application-layer enforcement)
- Signed URLs for private file access (1-hour expiry)
- No sensitive data stored in client-side storage
- HTTPS enforced on all connections

**Audit Trail**
- Every data mutation logged to `activity_log` with user, action, entity, and timestamp
- Runway status changes tracked in dedicated `runway_status_log` with database trigger
- Status change comments preserved as coordination activity records

---

## 9. Deployment & Infrastructure

**Current Deployment**
- **Hosting**: Vercel (edge-deployed with global CDN)
- **Database**: Supabase (managed PostgreSQL)
- **Domain**: [glidepathops.com](https://www.glidepathops.com)
- **Cost**: Free tier — zero monthly licensing cost

**Infrastructure Requirements**
- No dedicated servers required
- No VPN or CAC authentication required (email/password auth)
- No software installation required (browser-based)
- No app store approval required (PWA)
- Scales automatically with Vercel's edge network

**Development & Maintenance**
- `npm run dev` — local development server
- `npm run build` — production build
- `npx tsc --noEmit` — TypeScript type checking (zero errors)
- Git-based version control with full changelog
- Clean build deploys automatically to Vercel on push

---

## 10. Regulatory Compliance

Glidepath is designed to support compliance with the following governing publications:

| Publication | How Glidepath Supports Compliance |
|-------------|----------------------------------|
| **DAFI 13-213** (Airfield Management) | Digital inspection checklists, check documentation, discrepancy tracking, NOTAM monitoring, activity logging |
| **UFC 3-260-01** (Airfield & Heliport Planning and Design) | Automated imaginary surface evaluation engine, obstruction analysis with per-surface UFC table references, waiver criteria tracking |
| **DAFMAN 13-204 Vols 1-3** | 70 regulatory references searchable and available offline, linked to inspection findings |
| **AF Form 505** (Airfield Waiver) | Full digital waiver lifecycle with all AF-505 fields, coordination tracking, annual review workflow |
| **AFCEC Playbook (Appendix B)** | Annual waiver review dashboard with KPIs, Excel export matching Appendix B format, board presentation tracking |
| **DoD Instruction 4165.57** | APZ I and APZ II land-use zone evaluation in obstruction tool |

---

## 11. Current Metrics

| Metric | Value |
|--------|-------|
| Application Version | 2.6.0 |
| Total Routes | 41 |
| Source Files | 130+ |
| Database Tables | 25+ |
| Applied Migrations | 49 |
| Aircraft in Database | 1,000+ |
| Regulation References | 70 |
| Installations in Directory | 155 |
| Check Types Supported | 7 |
| Discrepancy Types | 11 |
| Imaginary Surfaces Evaluated | 10 |
| Waiver Classifications | 6 |
| User Roles | 9 |
| Report Types | 4 |
| TypeScript Build | Clean (zero errors) |
| Development Timeline | 3 weeks (Feb 7 – Feb 27, 2026) |
| Monthly Operating Cost | $0 (free tier) |

---

## 12. Roadmap

### Near-Term (Production Hardening)
- **Row-Level Security**: Full database-level role enforcement on all operational tables
- **METAR Weather Integration**: Replace Open-Meteo with aviationweather.gov METAR data for aviation-standard weather
- **Unit & Integration Testing**: Automated test suite for all modules
- **Type Generation**: Eliminate ~170 type assertions via Supabase type generation
- **Code Cleanup**: Remove 8 dead files, ~12MB unused images, duplicate migrations

### Mid-Term (Feature Enhancement)
- **Sync & Data Module**: Offline queue with conflict resolution, data export/import
- **Server-Side Email**: Branded email delivery for inspection reports and notifications
- **NOTAM Persistence**: Save drafted NOTAMs to database
- **Notification System**: In-app notifications for discrepancy assignments, status changes, waiver expirations
- **Runway Class Support**: Extend obstruction engine to support Class A, C, and D runways in addition to Class B

### Long-Term (Enterprise Scaling)
- **CAC/SSO Authentication**: Integration with DoD identity providers
- **Enterprise Dashboard**: Cross-installation metrics and compliance visibility for MAJCOM leadership
- **API Integrations**: DCGS, IMDS, ACES-PM interoperability
- **Mobile Native App**: React Native wrapper for enhanced offline and push notification support
- **AI-Assisted Analysis**: Trend detection, predictive maintenance recommendations, automated compliance checks

---

## 13. Competitive Advantages

### vs. Paper-Based Processes
- **Searchable**: Every record is instantly searchable across all modules
- **Traceable**: Complete audit trail with user attribution and timestamps
- **Shareable**: Real-time data sync across all users and devices
- **Durable**: No lost forms, illegible handwriting, or missing records
- **Exportable**: PDF and Excel exports for any report or record

### vs. Excel/PowerPoint Tracking
- **Integrated**: All modules share a common database — inspections link to discrepancies, discrepancies link to waivers
- **Automated**: KPIs, age calculations, status tracking, and review reminders computed automatically
- **Standardized**: Consistent format across all installations — no per-base spreadsheet variations
- **Collaborative**: Multiple users can work simultaneously; no file locking or version conflicts

### vs. Commercial COTS Solutions
- **Zero License Cost**: Built entirely on open-source and free-tier services
- **Purpose-Built**: Designed specifically for USAF airfield operations by airfield operations personnel
- **Customizable**: Open-source codebase can be modified to meet any installation's needs
- **No Vendor Lock-In**: Standard web technologies, no proprietary platforms
- **Rapid Development**: 3-week development cycle from concept to production-ready application

### vs. Other Government Solutions
- **Modern Stack**: Current web technologies vs. legacy systems
- **Mobile-First**: Designed for field use on phones and tablets
- **Offline Capable**: Works without network connectivity
- **No Infrastructure Required**: No servers to maintain, no VPN required
- **Immediate Deployment**: Any base can be onboarded in minutes, not months

---

## 14. Contact & Resources

**Application**: [glidepathops.com](https://www.glidepathops.com)
**Repository**: github.com/csproctor88-star/airfield-app
**Developer**: Chris Proctor

**Key Documentation:**
- `README.md` — Technical overview and module summary
- `CHANGELOG.md` — Detailed version history (v0.0.1 through v2.6.0)
- `docs/SRS.md` — Software Requirements Specification (1,291 lines)
- `docs/BASE-ONBOARDING.md` — Guide for adding new installations
- `docs/SCALING-ASSESSMENT.md` — Multi-base architecture assessment
- `docs/INTEGRATION_GUIDE.md` — PDF text search integration

---

*This document was generated from the Glidepath v2.6.0 codebase, CHANGELOG.md, README.md, session handoff documents (v2.2.0 through v2.6.0), SRS.md, and supporting technical documentation.*
