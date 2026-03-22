# Glidepath Slide Deck — Airfield Manager Audience

**Version**: 2.26.0
**Audience**: Airfield Managers presenting to their team, peer AFMs, or at conferences
**Tone**: Practitioner-to-practitioner. "Here's what this does for YOUR daily ops."
**Estimated Slides**: 29

---

## Slide 1: Title

**Title**: Glidepath: Airfield Management, Modernized
**Subtitle**: From paper logs to real-time operations.
**Footer**: Version 2.26.0 | Progressive Web App | glidepathops.com

**Speaker Notes**: Welcome everyone. Glidepath is a single platform that replaces every paper form, Excel tracker, and whiteboard in your airfield management office. I'm going to walk you through how it handles every function you do daily — from opening the airfield to filing your daily ops report.

**Visual**: Title card with Glidepath logo and tagline

**Key Points**:
- One platform for all airfield management functions
- Built by an airfield manager, for airfield managers
- Works on phone, tablet, and desktop — no install required

---

## Slide 2: The Problem

**Title**: The Problem: Disconnected, Paper-Based Operations

**Speaker Notes**: We all know the drill. AF Form 3616 for inspections, AF Form 1168 for discrepancies, Excel spreadsheets for NAVAID tracking, a whiteboard for airfield status, binders for ACSI prep. None of these systems talk to each other. When a discrepancy comes in, you manually log it, manually submit it to CES, manually track it, and hope it doesn't fall through the cracks before the next ACSI.

**Visual**: Collage or split-screen showing paper forms, Excel spreadsheets, whiteboard, vs. a single app interface

**Key Points**:
- AF Forms 3616, 1168, 505, BASH logs — all disconnected paper processes
- Excel trackers for discrepancies, NAVAIDs, waivers — no real-time visibility
- Status boards are only accurate when someone remembers to update them
- Compliance gaps discovered during ACSI, not before
- Institutional knowledge walks out the door every PCS cycle
- No Common Operating Picture — ATC, SOF, and AMOps all see different information

---

## Slide 3: The Solution

**Title**: One Platform. Every Airfield Ops Function.

**Speaker Notes**: Glidepath puts 19 integrated modules into a single Progressive Web App. It runs in your browser — phone, tablet, or desktop. No app store download, no IT ticket. Bookmark it and go. Everything syncs in real time across all users. When you update runway status, ATC sees it immediately. When CES closes a work order, you see it in your discrepancy tracker.

**Visual**: Module grid showing all 19 modules grouped by function

![Login page](screenshots/S01%20(1).png)

**Key Points**:
- 19 integrated modules covering every AFM responsibility
- Progressive Web App — works on any device with a browser, installable to home screen
- Real-time sync via Supabase Realtime — all users see the same picture
- Offline-capable for field inspections
- No software install, no IT ticket, no CAC middleware required

---

## Slide 4: Live Demo — Airfield Status

**Title**: Airfield Status: Your Digital Status Board

**Speaker Notes**: This is the first thing you see when you open the app. Runway status, weather, RSC/RCR, BWC, active advisories, NAVAID status, ARFF posture — all on one screen. When you update runway status from your phone during an inspection, everyone on the platform sees it instantly. No more calling the desk to update the whiteboard.

**Visual**:

![Airfield Status page](screenshots/S01%20(5).png)

**Key Points**:
- Runway status with one-tap Open/Closed/Restricted toggle
- Live weather integration with current conditions
- RSC/RCR and BWC displayed prominently with color coding
- Advisory bar for active NOTAMs, construction, or temporary restrictions
- NAVAID status synced from lighting inspections and outage reports
- ARFF aircraft posture (available/down) at a glance
- Real-time sync — updates appear on all connected devices within seconds

---

## Slide 5: Dashboard & KPIs

**Title**: Dashboard: Your Operational Picture at a Glance

**Speaker Notes**: The dashboard gives you the shift-level operational picture without clicking into anything. How many inspections are filed today? How many checks? Any active QRCs? What's your shift checklist progress? These KPI badges update in real time as your team works. Your flight chief or AMOps NCOIC can monitor ops tempo from their desk.

**Visual**:

![Dashboard KPI badges](screenshots/S01%20(11).png)

![Home/dashboard page](screenshots/S01%20(2).png)

**Key Points**:
- KPI badges: inspections filed, checks completed, active discrepancies, QRC status
- Last check timestamp and type for quick reference
- Shift checklist progress bar with quick-access link
- BWC/RSC/RCR displayed with last-updated timestamp
- Dashboard data refreshes via Supabase Realtime — no manual refresh needed

---

## Slide 6: Daily Inspections

**Title**: Daily Inspections: From Clipboard to Digital

**Speaker Notes**: This replaces your AF Form 3616. You get a configurable template with every inspection item — obstacle clearance, signs and lights, construction, habitat, pavement, FOD control, runway conditions. Tap pass, fail, or N/A. If you fail an item, Glidepath immediately prompts you to create a discrepancy with photos, GPS coordinates, and severity. One inspection per day is enforced per type — airfield and lighting — with a 0600 local time reset. No duplicates, no missed inspections.

**Visual**:

![Inspection workspace](screenshots/S01%20(19).png)

**Key Points**:
- Configurable templates: Airfield (44 items across 10 sections), Lighting (34 items across 6 sections)
- Default-to-pass workflow — tap to toggle: Pass → Fail → N/A → Pass
- Multi-discrepancy capture per failed item with inline photos and GPS
- One-per-day enforcement per type (airfield + lighting) with 0600L timezone-aware reset
- Cross-user blocking — if another AMOps troop starts the airfield inspection, you can't create a duplicate
- Draft auto-save to localStorage + cross-device resume via Supabase
- RSC/RCR/BWC captured inline during inspection
- Construction Meeting and Joint Monthly inspection types with personnel tracking

---

## Slide 7: Airfield Checks

**Title**: Airfield Checks: 6 Types, One Unified Form

**Speaker Notes**: FOD checks, RSC/RCR checks, IFE checks, ground emergency checks, heavy aircraft checks, BASH checks — all in one place. Select the type, fill out the form, attach photos if needed. The check timestamp is captured when you select the type, not when you submit — so your started-at time is accurate for response metrics. Drafts persist across devices so you can start a check on your phone and finish it at the desk.

**Visual**:

![Check type selector](screenshots/S01%20(14).png)

![FOD check form](screenshots/S01%20(15).png)

**Key Points**:
- 6 check types: FOD, RSC/RCR, In-Flight Emergency, Ground Emergency, Heavy Aircraft, BASH
- `started_at` timestamp captured at type selection for accurate response time tracking
- Per-issue photo attachment with GPS coordinates
- Draft persistence: localStorage + Supabase JSONB for cross-device resume
- Issues logged per check with severity, description, and location
- Automatic activity log entry on completion

---

## Slide 8: Discrepancy Tracking

**Title**: Discrepancy Tracking: Full Lifecycle Management

**Speaker Notes**: This is the heart of the system. Every discrepancy — whether it came from an inspection, a check, a NAVAID outage, or manual entry — lives here with a complete lifecycle. Open, Submitted to AFM, Submitted to CES, Awaiting Action, Waiting for Project, Work Completed Awaiting Verification. The Common Operating Picture map shows every active discrepancy on satellite imagery so you can brief the flight chief or SOF in seconds.

**Visual**:

![Discrepancy list](screenshots/S01%20(26).png)

![Discrepancy map (COP)](screenshots/S01%20(27).png)

**Key Points**:
- 11 discrepancy types: FOD Hazard, Pavement, Lighting, Marking, Signage, Drainage, Vegetation, Wildlife, Obstruction, NAVAID, Other
- 5-stage workflow: Submitted to AFM → Submitted to CES → Awaiting Action by CES → Waiting for Project → Work Completed Awaiting Verification
- Auto-shop assignment based on configurable type-to-shop mapping per base
- Common Operating Picture map with color-coded pins on satellite imagery
- Photo attachment, severity rating, location tagging
- Status update history with user attribution and Zulu timestamps
- Configurable PDF export with photo embedding, email delivery
- Aging analytics — track how long discrepancies sit in each status

![Discrepancy detail](screenshots/S01%20(29).png)

![Status update modal](screenshots/S01%20(30).png)

---

## Slide 9: CES Integration

**Title**: CES Work Orders: Give CES Exactly What They Need

**Speaker Notes**: One of the biggest friction points is the handoff to CES. They need to see the work orders relevant to them without wading through all your operational data. Glidepath gives CES users a dedicated dashboard showing only their work orders. Their status options are limited to In Work, Project, and Work Completed. They can't create or delete discrepancies — they just work the queue. And you see their updates in real time.

**Visual**:

![CES Work Orders](screenshots/S01%20(32).png)

**Key Points**:
- Dedicated CES role with locked-down interface — sees only what they need
- CES dashboard: work order queue filtered to their assigned shop
- Limited status options: In Work, Project, Work Completed (no admin actions)
- No create/edit/delete on discrepancies — CES works the queue, AFM manages it
- Flat sidebar navigation — no collapsible dropdowns, simplified UX
- Configurable type-to-shop mapping in Base Setup → CE Shops tab
- Real-time updates — when CES marks "Work Completed," AFM sees it immediately

---

## Slide 10: Visual NAVAIDs

**Title**: Visual NAVAIDs: Every Light and Sign on the Map

**Speaker Notes**: This is one of the most impactful modules. Every light, sign, and NAVAID feature on your airfield is plotted on satellite imagery — we're talking 1,000+ features per base. You can click any feature to see its details, report an outage with one tap, and that outage automatically creates a discrepancy routed to the correct CE shop. No more tracking outages on a paper status board. No more guessing if you're approaching a DAFMAN threshold.

**Visual**:

![Infrastructure map](screenshots/S01%20(34).png)

**Key Points**:
- 23 feature types: runway edge lights, taxiway lights, approach lights, PAPIs, REILs, signs, windcones, beacons, and more
- Satellite imagery base map with canvas-rendered icons
- One-tap outage reporting → auto-creates discrepancy with structured description
- Bar placement mode for grouping lights into physical bars
- GPS tracking for field verification
- KML/GeoJSON import from Google Earth or CAD exports
- Fixture IDs: auto-generated identifiers (e.g., TWYK-TL-001) for every feature
- Bulk operations via Audit Mode: filter, label, assign components, delete

---

## Slide 11: DAFMAN Outage Compliance

**Title**: DAFMAN 13-204v2 Table A3.1: Automated Compliance Monitoring

**Speaker Notes**: This is where Glidepath goes from a tracker to a compliance engine. DAFMAN 13-204v2, Table A3.1 prescribes maximum allowable outages per NAVAID system. Glidepath monitors your outage counts in real time against those thresholds. If your taxiway K edge lights are approaching the threshold, you get a yellow alert. If they exceed it, red. If the system is inoperable, black. It even does spatial adjacency and consecutive-light detection for bar-level analysis.

**Visual**:

![System Health Panel](screenshots/S01%20(36).png)

**Key Points**:
- Real-time monitoring against DAFMAN 13-204v2 Table A3.1 thresholds
- 23 system types tracked with percentage, count, and spatial thresholds
- 4-tier alert system: Green (healthy) → Yellow (approaching) → Red (exceeded) → Black (inoperable)
- Bar-level analysis: 3+ inoperable lights on a single bar triggers bar-level alert
- Consecutive and adjacent outage detection per DAFMAN spatial requirements
- Prescribed actions displayed per alert tier (e.g., "Issue NOTAM," "Coordinate with CE")

---

## Slide 12: System Health Panel & Map

**Title**: Health Rings and System Breakdown

**Speaker Notes**: The System Health Panel gives you a per-system breakdown. Click any system — say, Taxiway A Edge Lights — and you see total features, operational count, outage count, percentage, DAFMAN-prescribed actions, and a timeline of when outages were reported and resolved. On the map, health rings overlay each component location so you can visually see clusters of outages. Yellow ring means approaching threshold. Red means exceeded.

**Visual**:

![Health rings on map](screenshots/S01%20(39).png)

**Key Points**:
- Per-system drill-down: feature count, operational count, outage %, DAFMAN status
- Outage timeline per system showing report/resolve events
- "Color by Health" toggle overlays health rings on the infrastructure map
- Yellow rings = approaching threshold; Red rings = exceeded/inoperable
- NAVAID status syncs from lighting inspections — fail an item, NAVAID status updates
- Linked discrepancies: marking operational prompts to close linked discrepancies with attribution

---

## Slide 13: Aircraft Parking Plans

**Title**: Aircraft Parking Plans: To-Scale, Drag-and-Drop

**Speaker Notes**: When a transient C-17 calls 30 minutes out and needs parking, you don't have time to sketch it out on paper. Glidepath gives you a satellite map of your aprons with to-scale aircraft silhouettes. Drag and drop aircraft, rotate them, and the system automatically checks UFC clearance requirements. Wingtip-to-wingtip, wingtip-to-obstacle, taxi lane clearance — it's all calculated in real time. Export to PDF and email it to the tower.

**Visual**:

![Parking map with aircraft](screenshots/S01%20(40).png)

![Clearance violations](screenshots/S01%20(43).png)

**Key Points**:
- To-scale SVG aircraft silhouettes on satellite imagery
- Drag-and-drop placement with rotation
- UFC 3-260-01 clearance analysis: wingtip, obstacle, and taxi lane distances
- Automatic violation detection with color-coded warnings
- Obstacle placement and locking to prevent accidental moves
- Tabbed sidebar: Aircraft, Environment, Clearance, Settings
- PDF export with map capture — 1600x900 snapshot at current bearing
- Email PDF directly from the app to tower, SOF, or transient aircrew

---

## Slide 14: Obstruction Evaluations

**Title**: Obstruction Evaluations: UFC Imaginary Surface Analysis

**Speaker Notes**: When someone wants to park a crane near the runway or a tree grows into the transitional surface, you need to evaluate it against UFC 3-260-01 imaginary surfaces. Glidepath plots the obstruction on the map, calculates its position relative to primary surface, transitional slope, approach/departure, and inner horizontal, and gives you an instant pass/fail with the penetration depth. Multi-runway analysis, real elevation data, both FAA and UFC criteria supported.

**Visual**:

![Obstruction eval map](screenshots/S01%20(45).png)

![Evaluation results](screenshots/S01%20(46).png)

**Key Points**:
- UFC 3-260-01 imaginary surface analysis: primary, transitional (7:1), approach/departure (50:1), inner horizontal
- FAA Part 77 criteria also supported
- Multi-runway evaluation — checks against all runways simultaneously
- Taxiway OFA and Safety Area polygon rendering
- TDG-based OFA calculations (FAA) and Class A/B Clearance Lines (UFC)
- Real elevation data for accurate AGL/MSL calculations
- Instant pass/fail with penetration depth and affected surface identification
- Exportable evaluation results for waiver documentation

---

## Slide 15: Quick Reaction Checklists

**Title**: QRCs: Digitized Emergency Response

**Speaker Notes**: We have 25 Quick Reaction Checklists digitized in the app — IFE, barrier engagement, HAZMAT spill, bird strike, you name it. When an emergency happens, your AMOps troop pulls up the QRC on their phone, executes step by step, and every action is timestamped and logged. If it's an emergency QRC with SCN, the system logs "SECONDARY CRASH NET ACTIVATED" to the events log. Active QRCs appear on the dashboard so the flight chief knows what's being executed.

**Visual**:

![QRC available tab](screenshots/S01%20(49).png)

![QRC execution](screenshots/S01%20(50).png)

**Key Points**:
- 25 QRCs digitized with step-by-step execution
- Real-time step tracking with timestamps on each action
- SCN (Secondary Crash Net) activation logging for emergency QRCs
- Active QRCs visible on dashboard
- Cancel function deletes activity log entries by entity ID (clean cancellation)
- PDF export of completed QRC execution with all timestamps
- Dashboard integration — active QRC count displayed in KPI badges

---

## Slide 16: Shift Checklist

**Title**: Shift Checklist: Never Miss a Shift Task

**Speaker Notes**: Every shift has a list of tasks — check the weather, verify NOTAM currency, update the status board, call the tower. Glidepath digitizes that checklist with configurable per-shift tasks and a timezone-aware reset so the next shift starts fresh. Progress shows on the dashboard. You know exactly where the outgoing shift left off.

**Visual**:

![Shift checklist](screenshots/S01%20(52).png)

**Key Points**:
- Configurable per-shift task list
- Timezone-aware reset at configurable time (default 0600L)
- Dashboard quick-access with progress bar
- Task completion tracking with user attribution
- Customizable per installation — add/remove/reorder tasks in Settings

---

## Slide 17: Wildlife / BASH

**Title**: Wildlife & BASH: Sightings, Strikes, and Heatmaps

**Speaker Notes**: Every sighting and strike goes into the system with species, count, behavior, location, dispersal method, and weather conditions. Weather auto-fills from Open-Meteo so your troops aren't guessing at cloud cover and wind speed. The heatmap shows you concentration areas over time so you can adjust mowing schedules or depredation efforts. The monthly BASH report pulls directly from this data — no more compiling from handwritten logs.

**Visual**:

![Wildlife sighting form](screenshots/S01%20(54).png)

![Heatmap](screenshots/S01%20(57).png)

**Key Points**:
- Sighting and strike forms with species, count, behavior, location, GPS
- Weather auto-fill from Open-Meteo API: temperature, wind, cloud cover, precipitation
- Species favorites with gold-star quick access for frequently observed species
- Heatmap visualization showing wildlife concentration areas over time
- Dispersal method tracking: pyrotechnics, vehicle hazing, shotgun, laser, bioacoustics, propane cannon
- Strike details: flight phase, aircraft damage level, engine type, parts struck
- BASH monthly report auto-generated from recorded data
- Zulu time fields on all sighting/strike records

---

## Slide 18: Waivers

**Title**: Waivers: AF Form 505 Lifecycle Tracking

**Speaker Notes**: Every active waiver on your airfield — permanent, temporary, construction, event — tracked with annual review dates, expiration alerts, and map visualization. When your ACSI team asks "show me all active waivers," you pull up the list and export to PDF. No more digging through a binder.

**Visual**:

![Waiver list](screenshots/S01%20(58).png)

**Key Points**:
- 6 waiver classifications: Permanent, Temporary, Construction, Event, Extension, Amendment
- Annual review date tracking with expiration alerts
- Map view showing waiver locations on satellite imagery
- Full AF Form 505 data capture: authority, conditions, mitigations
- PDF and Excel export for ACSI documentation
- Status lifecycle: Draft → Active → Expired → Renewed

---

## Slide 19: NOTAMs

**Title**: NOTAMs: Live FAA Feed + Local Drafting

**Speaker Notes**: Glidepath pulls live NOTAMs from the FAA NOTAM system for your field. You see active NOTAMs with expiry tracking and color-coded urgency. You can also draft local NOTAMs within the app for internal coordination before publishing to the FAA system. Types include Runway Closure, Taxiway Closure, Lighting, Construction, NAVAID, and Custom.

**Visual**:

![NOTAM list](screenshots/S01%20(62).png)

**Key Points**:
- Live FAA NOTAM feed for your installation's ICAO identifier
- Expiry alerts with color-coded urgency
- Local NOTAM drafting for internal coordination
- 6 NOTAM types: Runway Closure, Taxiway Closure, Lighting, Construction, NAVAID, Custom
- Links to discrepancies and NAVAID outages for context

---

## Slide 20: Reports & Analytics

**Title**: Reports & Analytics: Data-Driven Ops

**Speaker Notes**: Five report types plus a 9-KPI analytics dashboard. Daily ops summary, discrepancy reports with aging filters, lighting system health reports, BASH monthly reports, and ACSI preparation reports. The analytics dashboard shows 30-day trends — or whatever timeframe you choose — for inspections, checks, discrepancies, QRC activations, personnel, obstructions, parking plans, and wildlife. Average inspection time and check response time are calculated from actual timestamps.

**Visual**:

![Reports hub](screenshots/S01%20(64).png)

![Analytics dashboard](screenshots/S01%20(65).png)

**Key Points**:
- 5 report types: Daily Ops, Discrepancy, Lighting Health, BASH Monthly, ACSI Prep
- 9-KPI analytics dashboard with configurable time range (default 30 days)
- Inspection average time: created_at → filed_at
- Check average response time: started_at → completed_at
- Discrepancy aging analysis: time in each workflow status
- Filter-based reports: by type, status, shop, date range
- PDF export and email delivery on every report
- Daily ops report includes Visual NAVAID Outages section with color-coded Reported/Resolved rows

---

## Slide 21: Events Log

**Title**: Events Log: Complete Audit Trail

**Speaker Notes**: Every action in the system — inspection filed, discrepancy created, runway status changed, QRC activated — gets logged to the events log with user, operating initials, timestamp, and entity reference. This is your AF Form 3616 replacement for the daily log. You can add manual entries using templates for items that don't fit a structured module. Export to Excel for end-of-shift reporting.

**Visual**:

![Events log](screenshots/S01%20(68).png)

**Key Points**:
- Automatic logging of all system actions with Zulu timestamps
- Operating initials column with click-to-reveal user popover
- Manual entry templates for unstructured events
- Entity linking — click any log entry to navigate to the source record
- Excel export for end-of-shift handoff
- Activity deduplication — metadata-driven details prevent title/description duplication
- Filterable by date, user, entity type

---

## Slide 22: PDF Export & Email

**Title**: PDF Export & Email: Every Module, One Tap

**Speaker Notes**: Every module in Glidepath exports to PDF. Discrepancy reports with embedded photos and maps. Inspection reports with pass/fail summaries. Parking plans with map snapshots. QRC execution logs with timestamps. You can email any PDF directly from the app — enter the recipient, hit send. Configurable templates let you save your preferred format per module.

**Visual**: Composite showing PDF export buttons across multiple modules

**Key Points**:
- jsPDF + jspdf-autotable for professional PDF generation
- Photo embedding in discrepancy and inspection PDFs
- Mapbox satellite map snapshots in NAVAID and parking PDFs
- Email delivery via Resend SDK — send PDFs directly from the app
- Configurable PDF templates with persistence per user
- Default email address configurable in Settings
- All PDF generators return `{ doc, filename }` for consistent handling

---

## Slide 23: Regulations Library

**Title**: Regulations Library: 70+ References at Your Fingertips

**Speaker Notes**: You know the drill — you're in the field, someone asks about a DAFMAN reference, and your phone doesn't have the PDF cached. Glidepath includes 70+ regulation references organized by category — DAF, FAA, UFC, CFR, DoD, ICAO. Offline caching means they're available even without connectivity. You can also upload personal documents like local operating instructions.

**Visual**:

![Regulations library](screenshots/S01%20(71).png)

**Key Points**:
- 70+ regulation references: DAFMAN 13-204v2, UFC 3-260-01, FAA ACs, CFR references
- 20 categories: Airfield Ops, Airfield Mgmt, ATC, Design, Pavement, Lighting, Safety, BASH, Driving, Emergency, and more
- 6 publication types: DAF, FAA, UFC, CFR, DoD, ICAO
- Offline caching for field access
- Personal document upload capability
- Source section grouping aligned with DAFMAN 13-204 volumes

---

## Slide 24: Connected Workflows

**Title**: Connected Workflows: The Power of Integration

**Speaker Notes**: Here's where Glidepath becomes more than the sum of its parts. Watch the chain: You fail an item during a lighting inspection. That creates a discrepancy linked to the specific NAVAID feature. The outage engine recalculates system health. If the system crosses a DAFMAN threshold, the alert tier changes. That triggers a NOTAM requirement. All of this flows into the daily ops report automatically. No manual data entry at any step.

**Visual**: Workflow diagram showing the chain: Inspection Failure → Discrepancy → NAVAID Outage → DAFMAN Alert → NOTAM → Daily Ops Report

**Key Points**:
- Inspection failure → auto-creates discrepancy with photos and GPS
- Discrepancy linked to infrastructure feature → outage recorded
- Outage engine recalculates system health against DAFMAN 13-204v2 thresholds
- Threshold breach → alert tier upgrade with prescribed actions
- NAVAID outage appears in daily ops report with color-coded rows
- Marking operational → prompts discrepancy closure with user attribution
- All links bidirectional — navigate from discrepancy to NAVAID feature and back
- Zero manual re-entry across the entire chain

---

## Slide 25: Multi-Base Ready

**Title**: Multi-Base: One App, Multiple Installations

**Speaker Notes**: Glidepath supports multiple installations with complete data isolation. Each base has its own runways, NAVAID features, templates, CE shops, and users. An airfield manager at one base cannot see another base's data. But if you're a MAJCOM functional or NAMO, you can switch between installations to review operations across your portfolio.

**Visual**:

![Installation switcher](screenshots/S01%20(78).png)

**Key Points**:
- Complete data isolation per installation via Row-Level Security
- Installation switcher in the header for authorized multi-base users
- Per-base configuration: runways, areas, CE shops, type-to-shop mapping, checklist templates
- Per-base timezone for inspection reset and Zulu time display
- Per-base NAVAID infrastructure — each installation has its own feature set
- MAJCOM/NAMO view: switch between installations without logging out

---

## Slide 26: Security & Role-Based Access

**Title**: Security: 9 Roles, Row-Level Security on Every Table

**Speaker Notes**: Security is baked into the database, not just the UI. Supabase Row-Level Security policies enforce access at the PostgreSQL level — even if someone bypasses the frontend, they can't access data they shouldn't see. Nine roles from sys_admin down to read_only. CES users get a completely different interface. ATC and Safety get read access. Your AMOps troops get operational access without admin capabilities.

**Visual**:

![User management](screenshots/S01%20(77).png)

**Key Points**:
- 9 roles: sys_admin, base_admin, airfield_manager, namo, amops, ces, safety, atc, read_only
- Row-Level Security (RLS) on all 42+ database tables
- RLS helper functions: `user_has_base_access()`, `user_can_write()`, `user_is_admin()`
- CES role: dedicated work order interface, limited status options, no create/edit/delete on discrepancies
- Storage RLS on file uploads (photos bucket)
- No data crosses installation boundaries
- User deletion safely nullifies 12 FK columns across 10 tables before removing auth record

---

## Slide 27: Getting Started

**Title**: Getting Started: Base Onboarding

**Speaker Notes**: Setting up a new base takes about 2-4 hours. Configure your runways, define your areas, set up CE shops and type-to-shop mapping, configure your inspection templates, import your NAVAID features from Google Earth or CAD, and invite your users. Your troops can be operational within a week. The demo mode lets you explore every feature without any configuration.

**Visual**:

![Settings page](screenshots/S01%20(73).png)

**Key Points**:
- Step 1: Configure installation — runways, areas, timezone, checklist reset time (2-4 hours)
- Step 2: Set up CE shops and discrepancy type-to-shop mapping
- Step 3: Import NAVAID features via KML, GeoJSON, or manual placement
- Step 4: Upload airfield diagram to Supabase Storage
- Step 5: Invite users with appropriate roles (30 min per user onboarding)
- Demo mode available for exploration — no Supabase configuration required
- Operational within 1 week of initial setup

---

## Slide 28: What Peers Are Saying

**Title**: What Peers Are Saying

**Speaker Notes**: [Leave this slide for testimonials and quotes from beta testers or early adopters. Add quotes as they come in from functional testing and base rollouts.]

**Visual**: Quote cards with placeholder text

**Key Points**:
- [Placeholder for testimonial 1 — base name, role, quote]
- [Placeholder for testimonial 2 — base name, role, quote]
- [Placeholder for testimonial 3 — base name, role, quote]
- Collect feedback during beta testing at initial rollout bases

---

## Slide 29: Q&A / Contact

**Title**: Questions? Let's Talk.

**Speaker Notes**: That's Glidepath in 30 minutes. The demo is live right now — you can log in with the demo link and explore every module with sample data. No account required for demo mode. I'm happy to walk any of you through a base-specific setup or answer questions about integration with your current processes.

**Visual**: QR code or URL to demo link

**Key Points**:
- Live demo: glidepathops.com/login?demo=true
- Full feature access in demo mode with sample data
- Contact: [Your name, email, phone placeholder]
- GitHub: github.com/csproctor88-star/airfield-app
- No cost for initial base pilots — cloud hosting ~$50/month
