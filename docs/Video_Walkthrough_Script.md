# Glidepath Video Walkthrough Script

## Overview

This document is a full plan for creating a video tutorial series covering every capability of Glidepath. The series is structured as one overview video followed by module-by-module deep dives. Total estimated runtime: 90-120 minutes across all videos.

---

## VIDEO 1: Overview & First Look (8-10 min)

### Opening (1 min)
- Glidepath logo + tagline: "Guiding You to Mission Success"
- "Glidepath is a mobile-first airfield operations management platform built for U.S. military installations"
- Mention: replaces paper-based processes, works on any device, real-time multi-user

### What Glidepath Replaces (1 min)
- Paper AF Forms, Excel trackers, whiteboard status boards
- Disconnected systems across AMOPS, CES, Tower, Command Post
- No centralized operational picture

### Quick Tour (3 min)
- Show the login screen and demo mode access
- Walk through the sidebar navigation groups: Operations, Airfield Management, Reference, Settings
- Show the bottom nav on mobile (Status, Dashboard, Obstruction, Events Log, More)
- Point out the installation switcher in the header for multi-base users
- Show light/dark/auto theme switching

### Key Concepts (2 min)
- **Installation-scoped data** — every piece of data belongs to a base; users only see their base's data
- **Role-based access** — Airfield Manager, AMOPS, Base Admin, NAMO, CES, Sys Admin each see different capabilities
- **Real-time sync** — changes push to all connected users instantly via Supabase Realtime
- **Offline-capable** — PWA with IndexedDB caching for regulations, draft persistence for inspections/checks
- **Zulu time** — all timestamps in military Zulu format (e.g., 1500Z)

### Architecture at a Glance (1 min)
- Next.js + Supabase + Google Maps
- 55 routes, 46 database tables, 130+ migrations
- PDF/Excel export on every report
- Email delivery via Resend

---

## VIDEO 2: Airfield Status Page (8-10 min)

### Talking Points
- This is the operational hub — the first thing everyone sees
- **Weather strip** — live Open-Meteo data (temp, wind, visibility, conditions)
- **Weather Info system** — add Watch/Warning/Advisory with number, effective times, UFN toggle
- Show adding, editing, canceling, and expiring advisories
- **Runway Status section** — Active RWY toggle, Open/Suspended/Closed with confirm dialog and remarks
- Multi-runway support — each runway independent
- **RSC/RCR/BWC cards** — click to change, confirm dialog with notes
- **NAVAID Status** — G/Y/R toggles per NAVAID, notes on yellow/red, grouped by runway end + Other
- Editable section headers (click to rename)
- **ARFF Status** — CAT selector, per-vehicle readiness (Optimum/Reduced/Critical/Inadequate)
- **Custom Status Boards** — configurable G/Y/R panels (Arresting Systems, Comm Status, etc.)
- Board section assignment (Runway/NAVAID/ARFF/Standalone)
- **Personnel on Airfield** — active contractor list with Mark Completed
- **Construction/Closures** — editable remarks
- **Miscellaneous Info** — editable remarks
- **Out of Office** — dashboard-activated overlay, Command Post initials, events log entry
- **Realtime** — demonstrate a change pushing to another browser/device instantly

---

## VIDEO 3: Dashboard (5-7 min)

### Talking Points
- **Last Check Completed** — shows most recent check type and time
- **Inspection Status Strip** — Airfield and Lighting cards showing Complete/In Progress/Not Started
- Click to resume in-progress, start new, or view completed
- **Quick Action Buttons** — Checks, Discrepancy, Personnel, Checklist, QRC, Out of Office
- Each opens the relevant module or dialog
- **Recent Activity feed** — unified timeline showing ALL app activity
- Activity log entries, discrepancy changes, check completions, inspection filings, QRC executions, wildlife events
- Grouped by time, color-coded by action type
- Operating initials column
- "View All Recent Activity" opens the full feed page

---

## VIDEO 4: Daily Inspections (10-12 min)

### Talking Points
- **One-per-day enforcement** — only one airfield + one lighting per day, 0600L reset
- **Two-half workflow** — Airfield first, then Lighting
- **KPI badges** — tap to start or resume
- **Begin New** — confirm dialog, creates DB row immediately
- **Checklist form** — sections with collapsible headers, item count badges
- **Three-state toggle** — Pass (green check) → Fail (red X) → N/A (gray) → Pass
- Default to Pass — items only need attention if they fail
- **Failed items expand** — discrepancy details panel with:
  - Pin Location on Map (Google Maps satellite)
  - Comment/Description
  - Location/Area dropdown
  - Use My Location (GPS)
  - Add Photo (uploads immediately to storage)
  - Log as Airfield Discrepancy checkbox
  - Multiple discrepancies per item
- **BWC/RSC/RCR** — special items at the top of the form
- **Draft persistence** — saves to localStorage on every toggle, survives navigation and app switching on mobile
- **Save Draft button** — explicit save to Supabase for cross-device access
- **Photo persistence** — uploads immediately, badge shows count on resume
- **Complete & File** — validates, saves items, creates discrepancies, uploads photos, logs activity
- **Lighting tab** — appears after airfield is filed with Start/Resume card
- **PDF export** — combined report with per-discrepancy photos embedded
- **History** — filterable list with Resume/Delete for in-progress, detail view for completed
- **Reopen for Editing** — re-enters form with existing responses loaded

---

## VIDEO 5: Airfield Checks (6-8 min)

### Talking Points
- **7 check types** in a unified form: FOD, RSC, RCR, IFE, Ground Emergency, Heavy Aircraft, BASH
- **Type selector** — pick check type, form adapts to show relevant fields
- **FOD Check** — route selection, items found toggle, clear/not-clear
- **RSC Check** — contaminant type, depth, coverage, braking action, treatment applied
- **RCR Check** — Mu readings (rollout/midpoint/departure), equipment, temperature
- **IFE** — in-flight emergency response checklist
- **Ground Emergency** — 12-item AM action checklist + 9 agency notification checkboxes
- **Heavy Aircraft** — aircraft type, parking spot, weight, taxi route
- **BASH** — condition code, species ID, mitigation actions, habitat attractants
- **Issue tracking** — multiple issues per check with per-issue photos and GPS pins
- **Draft persistence** — Supabase draft_data + localStorage fallback
- **History** — type filtering, search, detail view
- **Activity logging** — automatic events log entry on completion

---

## VIDEO 6: QRC — Quick Reaction Checklists (5-7 min)

### Talking Points
- **25 digitized QRCs** for airfield emergencies
- **Three tabs** — Available (template grid), Active (open executions), History (closed/all)
- **Launch a QRC** — select from Available tab, confirm to open
- **6 step types** — Checkbox, Checkbox+Note, Agency Notification, Fill-in Field, Time Field ("Now Z" auto-fill), Conditional Cross-Reference
- **SCN form** — Secondary Crash Net data entry for applicable QRCs
- **Lifecycle** — Open → Close (with initials/timestamp) or Cancel (permanently delete)
- **Activity logging** — "SECONDARY CRASH NET ACTIVATED" for SCN-enabled QRCs
- **Dashboard integration** — QRC button opens execution dialog inline
- **Daily ops report** — QRC executions included automatically
- **Base Setup** — QRC template editor with step type selector, seed from default library

---

## VIDEO 7: Shift Checklist (4-5 min)

### Talking Points
- **Three shifts** — Day, Swing, Mid
- **Configurable items** — per-base, per-shift, daily/weekly/monthly frequency
- **Timezone-aware** — uses base's configured timezone and reset time (default 0600)
- **Today tab** — progress bar per shift, check-off items with notes, N/A toggle (three-state: unchecked → completed → N/A)
- **File workflow** — file when complete, reopen if needed, per-user tracking
- **History tab** — browse past checklists by date, read-only detail view
- **Dashboard KPI badge** — quick access dialog for inline completion
- **Base Configuration** — add/edit/delete/toggle items per shift, configurable reset time

---

## VIDEO 8: Discrepancies (8-10 min)

### Talking Points
- **11 types** — FOD, pavement, lighting, markings, signage, drainage, vegetation, wildlife, equipment, security, other
- **Full lifecycle** — Open → Submitted to AFM → Submitted to CES → Awaiting CES Action → Waiting for Project → Work Completed → Closed/Cancelled
- **Auto-assign shop** — per-base configurable type-to-shop mapping
- **Create discrepancy** — type, title, description, location (GPS or map pin), severity, photos (camera + file upload)
- **Detail page** — full history, status updates, work order tracking, notes, photos, linked NOTAMs
- **NAVAID integration** — linked Visual NAVAID shows system map thumbnail
- **Map view (COP)** — Common Operating Picture with severity-colored pins, List/Map toggle, severity legend, shop filter chips
- **CES Work Orders** — dedicated dashboard for CES users with shop tabs, KPIs, priority queue
- **Edit modal** — Work Order # and Assigned To fields inline
- **Pending W/O filter** — quick filter for discrepancies awaiting work orders
- **Reports** — Discrepancy Report builder (5 filters), Trends (opened vs closed), Aging report (by age tier)
- **PDF export** — configurable templates, photo embedding, email delivery

---

## VIDEO 9: Obstruction Evaluation Tool (6-8 min)

### Talking Points
- **UFC 3-260-01 compliance** — Class B imaginary surface analysis
- **10 surfaces** — Primary, Approach-Departure, Transitional, Inner Horizontal, Conical, Outer Horizontal, Clear Zone, Graded Area, APZ I, APZ II
- **Multi-runway** — evaluates against ALL runways simultaneously
- **Interactive map** — click to place obstruction, color-coded surface overlays, per-runway toggles
- **Taxiway clearance envelopes** — OFA/Safety Area polygons (FAA TDG + UFC Class A/B)
- **Evaluation results** — surface zone, distance from centerline, distance from threshold, ground elevation (auto-fetched via Elevation API)
- **NOTAM Reference** — NM distance and bearing from nearest threshold for NOTAM writing
- **Height analysis** — max allowable height, penetration amount, Approach-Departure slope
- **Ruler tool** — ad hoc distance measurements in feet
- **Photos** — multiple per evaluation
- **Violation detection** — UFC table references
- **History** — List/Map toggle, all evaluations on satellite map
- **Fullscreen** — spacebar toggle with toolbar
- **Established airfield elevation** — configurable in Base Setup, used for MSL calculations

---

## VIDEO 10: Visual NAVAIDs / Infrastructure (8-10 min)

### Talking Points
- **Interactive satellite map** — digitize all airfield lighting, signage, miscellaneous features
- **22 feature types** across 4 groups (Signs, Taxiway Lights, Runway Lights, Miscellaneous)
- **Custom icons** — canvas-rendered signs matching real-world colors (location=black/yellow, mandatory=red/white, directional=yellow/black)
- **Placement modes** — click-to-place, bar placement for approach lighting (6 bar types with geodesic offset)
- **Feature management** — drag-to-move, inline label editing, rotation, delete
- **Legend system** — Type legend (4 collapsible groups), Systems legend (auto-grouped), Show All/Hide All, feature counts
- **Outage tracking** — DAFMAN 13-204v2 Table A3.1 compliance
  - 23 lighting system types with configurable thresholds (percentage, count, consecutive)
  - 4-tier alerts: green/yellow/red/black
  - Bar-level analysis (3+ inop lamps = bar inoperative)
  - System Health Panel with per-system status and bar-level detail
  - Auto-creates discrepancies when marking inoperative
  - Bidirectional resolution with linked discrepancies
- **Audit Mode** — systematic field verification with bulk operations
- **Import pipeline** — KML, CSV, GeoJSON, DXF
- **Fixture IDs** — unique identifiers for field cross-referencing
- **Bulk operations** — box select for shift, re-layer, delete, move, component assign, type change, Link as Bar
- **Lighting Status** — collapsible panel on the page, hidden by default
- **Daily ops report** — VISUAL NAVAID OUTAGES section auto-generated

---

## VIDEO 11: Aircraft Parking Plans (6-8 min)

### Talking Points
- **Interactive map editor** — drag-and-drop aircraft on satellite imagery
- **To-scale silhouettes** — SVG aircraft rendered at true wingspan scale from 200+ aircraft database
- **Place aircraft** — search aircraft database, select type, click map to place
- **Bulk add** — quantity field (1-50), auto-names sequentially (F-22 #1, #2, #3)
- **Heading preset** — set direction before placing
- **Auto-spacing** — places at wingspan + 2x wingtip clearance intervals
- **Drag with distance labels** — connecting lines + clearance distance shown during drag
- **Context menu** — Ctrl+click or long-press for Edit Details, Duplicate, Remove
- **Clearance analysis** — UFC 3-260-01 wingtip clearance with ADG classification
  - Violations (red) and warnings (yellow)
  - Apron context (open apron, hangar access, between rows)
- **Obstacles** — place buildings, points, circles, lines with dimensions, lockable
- **Taxilanes** — named with width, clearance envelope rendering
- **Apron boundaries** — polygon drawing for apron area definition
- **Plan templates** — save as template, convert to plan, duplicate with deep copy
- **Ruler tool** — measure distances in feet
- **PDF export** — landscape with aircraft summary, map capture, clearance violations
- **Email export** — send PDF via email
- **Tabbed sidebar** — Aircraft, Environment, Clearance, Settings with count badges
- **Fullscreen** — spacebar toggle

---

## VIDEO 12: Waivers (5-7 min)

### Talking Points
- **AF Form 505 / AFCEC Playbook Appendix B** compliant
- **6 classification types** — permanent, temporary, construction, event, extension, amendment
- **7 status values** — with mandatory comment dialogs for transitions
- **Create waiver** — classification, criteria & standards references, description, location (map pin), photos
- **Coordination tracking** — by office with status
- **Annual review** — year-by-year review forms, KPIs, board presentation tracking
- **Map view** — emoji markers by classification, clickable filter legend
- **PDF export** — individual waiver with embedded photos
- **Excel export** — full register with criteria and coordination sheets
- **Waiver register** — searchable/filterable list with status badges

---

## VIDEO 13: ACSI — Annual Compliance & Safety Inspection (5-7 min)

### Talking Points
- **DAFMAN 13-204v2, Para 5.4.3** compliance
- **10 sections, ~100 checklist items** — annual inspection
- **Y/N/N/A toggle** per item with Mark All Y shortcut
- **Failed items** — discrepancy documentation (comment, W/O, project #, cost, completion date), photo/map upload
- **Inspection team** — AFM/CE/Safety required + additional members
- **Risk management certification** — 3 signature blocks (OG/CC, MSG/CC, WG/CC)
- **Draft persistence** — localStorage auto-save + DB auto-save
- **Reopen for editing** — rebuilds draft from filed items
- **PDF export** — parent/sub-field hierarchy, inline photos
- **Excel export** — Cover, Checklist, Team, Risk Cert sheets
- **List page** — KPI badges, status filter, search

---

## VIDEO 14: Wildlife / BASH (4-5 min)

### Talking Points
- **Sighting form** — species (with favorites), count, location, conditions, GPS
- **Strike form** — species, aircraft info, damage assessment, location
- **Weather auto-fill** — Open-Meteo data populates weather fields on form mount
- **Species picker** — favorites with gold border/star, sorted favorites-first
- **Heatmap** — Google Maps HeatmapLayer showing sighting density
- **Analytics** — sightings and strikes count, top species, on Reports page
- **BASH checks** — integrated with the airfield checks module
- **Daily ops report** — wildlife activity included automatically

---

## VIDEO 15: NOTAMs (3-4 min)

### Talking Points
- **Live FAA feed** — auto-fetches from notams.aim.faa.gov for installation's ICAO code
- **No API key required** — direct feed access
- **ICAO search** — query any airport's NOTAMs
- **Full text display** — monospace rendering of complete NOTAM text
- **Filter chips** — All/FAA/LOCAL/Active/Expired
- **Expiring alerts** — sidebar badge count, red card highlight for NOTAMs within 24 hours
- **Refresh** — manual refresh button with status indicator
- **NOTAM dropdown selectors** — on discrepancy/event forms, populated from live feed

---

## VIDEO 16: PPR Log (3-4 min)

### Talking Points
- **Prior Permission Required** tracking
- **Auto PPR# generation** — Julian day + sequence + approver initials (e.g., 096-003-CP)
- **Configurable columns** — 7 field types (Text, Date, Time, Yes/No/N/A, Phone, Number, Email)
- **Column management** — inline rename, type selection, required toggle, reorder
- **Browse table** — date filtering (Today/7d/30d/Custom), create/edit/delete
- **Dashboard integration** — today's PPRs at bottom of Airfield Status
- **Base Setup** — step 14 for column configuration

---

## VIDEO 17: Customer Feedback (3-4 min)

### Talking Points
- **Public feedback form** — accessible via QR code, no login required
- **Configurable** — title, description, standard fields (name/email/org/rating), custom fields
- **Custom field types** — text, textarea, rating (1-5), yes/no, dropdown
- **QR code generation** — built into Base Setup step 15
- **Rate limiting** — 5-minute cooldown per submission
- **Feedback list** — submissions with stats cards (count, avg rating, distribution chart)
- **Analytics integration** — Customer Feedback card on Reports page
- **Admin delete** — admins can remove individual submissions

---

## VIDEO 18: Reports & Analytics (6-8 min)

### Talking Points
- **Analytics Dashboard** — 10 metric cards with configurable timeframe (7d/30d/90d/6mo/1yr)
  - Airfield Inspections (count, avg time, pass rate)
  - Lighting Inspections (same)
  - Airfield Checks (total, avg/day, avg time, by type breakdown)
  - Discrepancies (open count, avg days to close, opened vs closed, net trend)
  - QRC Executions (count, avg response time)
  - Personnel (active today, avg/day)
  - Obstruction Evaluations (count, violations, violation rate)
  - Parking Plans (total, created in period, active plan)
  - Wildlife/BASH (sightings, strikes, top species)
  - Customer Feedback (submissions, avg rating)
- **Daily Operations Summary** — all activity for a date/range, PDF export
- **Discrepancy Report** — 5-filter builder with live preview, Export All Open
- **Discrepancy Trends** — opened vs closed chart over configurable period
- **Aging Discrepancies** — grouped by age tier, clickable filters
- **Airfield Lighting Report** — system health table with component detail
- **PDF export** — every report generates professional PDF
- **Email delivery** — send any PDF via email with pre-filled default address

---

## VIDEO 19: Reference Library & Aircraft Database (4-5 min)

### Talking Points
- **70 regulation entries** — DAFMAN 13-204 Vols 1-3, UFC 3-260-01
- **Full-text search** — find regulations by keyword
- **Category/pub-type filters** — narrow by publication
- **In-app PDF viewer** — pinch-to-zoom, no external app needed
- **Offline caching** — IndexedDB storage, "Cache All" bulk download
- **Favorites** — quick access to frequently used regulations
- **My Documents** — upload personal PDFs/images, client-side search
- **Aircraft Database** — 200+ military/civilian aircraft
- **Search & sort** — by name, type, manufacturer, wingspan, weight, ACN
- **ACN/PCN comparison** — pavement loading analysis panel
- **Favorites system** — quick access to common aircraft

---

## VIDEO 20: Training Module (3-4 min)

### Talking Points
- **Three-tab layout** — Quick Start Guide, Module Reference, Base Setup Guide
- **Quick Start Guide** — 7-step onboarding walkthrough
- **Module Reference** — 20 module cards with screenshots and descriptions
- **Base Setup Guide** — 12-step wizard walkthrough with per-step instructions
- **PDF export** — Module Reference PDF and Base Setup Guide PDF with embedded screenshots

---

## VIDEO 21: Settings & Base Setup (8-10 min)

### Talking Points
- **Profile** — name, rank, role, operating initials, default PDF email
- **Appearance** — Day/Night/Auto theme
- **Base Setup Wizard** — 15-step guided configuration:
  1. Runways — ICAO import, manual add, edit all fields, adjust on map, established elevation
  2. Airfield Areas — runway areas, taxiways, ramps
  3. Taxiways — designators for clearance analysis
  4. NAVAIDs — status board items
  5. CE Shops & Type Mapping — discrepancy auto-assignment
  6. ARFF Vehicles — readiness tracking
  7. Facilities — building numbers/descriptions
  8. Inspection Templates — airfield/lighting checklist customization
  9. Shift Checklist — per-shift task configuration
  10. QRC Templates — emergency checklist setup
  11. Wildlife Species — species picker configuration
  12. Lighting Systems — DAFMAN outage threshold configuration
  13. Status Boards — custom G/Y/R panels with section assignment
  14. PPR Columns — field configuration
  15. Customer Feedback — form builder + QR code generation
- **ICAO Import** — auto-populates runways, NAVAIDs, areas, elevation from OurAirports + FAA data
- **User Management** — invite, edit roles, deactivate, password reset
- **Sidebar Customization** — drag-and-drop nav item ordering

---

## VIDEO 22: Mobile Experience & PWA (4-5 min)

### Talking Points
- **Progressive Web App** — installable on iOS/Android home screen
- **Bottom navigation** — 5 tabs (Status, Dashboard, Obstruction, Events Log, More)
- **Responsive design** — 3 breakpoints (mobile < 768px, tablet 768px+, desktop 1024px+)
- **Touch support** — long-press context menus, swipe, pinch-to-zoom on maps/PDFs
- **Offline support** — cached regulations, draft persistence in localStorage
- **Camera integration** — capture="environment" for direct camera access
- **Font scaling** — 11 CSS custom properties for responsive text
- **Service worker** — tile caching for maps (ESRI, Google, Mapbox)

---

## VIDEO 23: Admin & Multi-Base Operations (4-5 min)

### Talking Points
- **Role hierarchy** — sys_admin > base_admin/AFM/NAMO > AMOPS > controller > CES > observer
- **Multi-base access** — installation switcher in header, user_base_access table
- **User Management** — invite flow with branded email, role assignment, deactivation
- **CES role** — restricted view (Work Orders, Discrepancies, Visual NAVAIDs, Settings only)
- **RLS enforcement** — Row Level Security on all 46 tables with role-aware policies
- **Activity logging** — every significant action logged with user attribution
- **Demo mode** — URL-based auto-login for demonstrations

---

## Production Notes

### Recording Tips
- Use a clean demo base (KDMO Demo AFB) with pre-loaded data
- Record at 1920x1080 for desktop, 1080x2400 for mobile segments
- Use a consistent dark theme throughout
- Show the same workflow on desktop then briefly on mobile to demonstrate responsiveness
- Keep each video self-contained — viewers should be able to watch any module video independently

### Suggested Order for Recording
1. Overview first (sets context)
2. Airfield Status + Dashboard (core operational pages)
3. Inspections + Checks (daily workflow)
4. QRC + Shift Checklist (operational tools)
5. Discrepancies + Obstruction Eval (management tools)
6. Visual NAVAIDs + Parking (map-based tools)
7. Reports + Analytics (reporting)
8. Everything else (reference, settings, admin)

### Demo Data Needed
- Active advisory (WARNING) on Airfield Status
- 2-3 active contractors on the airfield
- Mix of open/completed discrepancies with photos
- Recent FOD check and airfield inspection completed
- Active QRC execution
- At least one waiver in review status
- Wildlife sighting from today
- Infrastructure features with some inoperative (for outage demo)
- Parking plan with 3-4 aircraft placed
- Customer feedback submissions with ratings
