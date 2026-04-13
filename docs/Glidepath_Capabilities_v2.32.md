# Glidepath Capabilities Document

**Version 2.32.0** | April 2026

Glidepath is a Progressive Web Application (PWA) purpose-built for Department of the Air Force airfield management operations. It digitizes the daily workflows of Airfield Management professionals — inspections, checks, discrepancy tracking, emergency checklists, NAVAID infrastructure management, obstruction evaluations, parking plans, wildlife/BASH reporting, Prior Permission Required (PPR) logs, customer feedback, and more — into a single, real-time platform accessible from any device with a web browser.

This document provides a comprehensive walkthrough of every Glidepath module. It is written for Airfield Managers, squadron leadership, Civil Engineer liaisons, and anyone evaluating or adopting the tool. It reflects the state of the application as of version 2.32.0.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Airfield Status](#2-airfield-status)
3. [Dashboard](#3-dashboard)
4. [Airfield Checks](#4-airfield-checks)
5. [Daily Inspections](#5-daily-inspections)
6. [ACSI Annual Compliance](#6-acsi-annual-compliance)
7. [Discrepancy Management](#7-discrepancy-management)
8. [CES Work Order Workflow](#8-ces-work-order-workflow)
9. [Visual NAVAIDs & Infrastructure](#9-visual-navaids--infrastructure)
10. [Aircraft Parking Plans](#10-aircraft-parking-plans)
11. [Obstruction Evaluations](#11-obstruction-evaluations)
12. [Quick Reaction Checklists](#12-quick-reaction-checklists)
13. [Shift Checklist](#13-shift-checklist)
14. [Wildlife / BASH](#14-wildlife--bash)
15. [Waivers](#15-waivers)
16. [NOTAMs](#16-notams)
17. [Prior Permission Required (PPR) Log](#17-prior-permission-required-ppr-log)
18. [Customer Feedback](#18-customer-feedback)
19. [Reports & Analytics](#19-reports--analytics)
20. [Events Log](#20-events-log)
21. [Aircraft Database](#21-aircraft-database)
22. [Regulations Library](#22-regulations-library)
23. [Personnel on Airfield & Contractors](#23-personnel-on-airfield--contractors)
24. [Training Module Reference](#24-training-module-reference)
25. [Settings & Base Configuration](#25-settings--base-configuration)
26. [User Management](#26-user-management)
27. [Multi-Base Operations](#27-multi-base-operations)

---

## 1. Getting Started

Glidepath is accessed through any modern web browser — Chrome, Edge, Safari, or Firefox — on desktop, tablet, or mobile devices. As a Progressive Web App, it can be installed to your device's home screen for a native app experience with offline caching. This section covers how to sign in, navigate the application, and personalize your experience.

### Key Features

- **Email/password authentication** with Supabase Auth — military CAC integration is not required. A T-3 waiver is on file for the DAFMAN 13-204v2 CAC-signature requirement on AF Form 3616.
- **Remember Me** option to persist your session across browser restarts.
- **Forgot Password** flow sends a branded recovery email (from `info@glidepathops.com`) to reset your credentials.
- **Create Account** for self-registration — new users select their installation and role, then wait for admin approval before gaining access.
- **Demo Mode** accessible via `?demo=true` URL parameter — explore all features with sample data on the isolated "Demo AFB" installation, no account needed.
- **First-time login** prompts you to select your installation (base) and complete your profile (rank, name, operating initials).
- **Sidebar navigation** (desktop) organizes all modules into logical groups with collapsible sections.
- **Bottom tab bar** (mobile): Status, Dashboard, Obstruction, Events Log, More.
- **More page** (mobile) exposes every module not on the bottom tabs, plus a Contact Support button and the Sign Out action.
- **Sign Out button** is available in both the desktop sidebar and the mobile More page.
- **Contact Support button** (sidebar, More page, and Settings) opens a pre-addressed support email.
- **Non-DoD endorsement disclaimer** is displayed on the login page and all outgoing email footers.

### PWA Behavior

Glidepath can be installed to the home screen on iOS, Android, and desktop operating systems. When installed, it runs in a standalone window without browser chrome. The service worker pre-caches static assets and map tiles (ESRI, Google, and Mapbox) so previously-visited map regions load instantly.

---

## 2. Airfield Status

The Airfield Status page is the operational nerve center of Glidepath. It is the default landing page on the mobile bottom-tab navigation (`Status`) and provides a single-screen view of current airfield conditions.

### Layout

The page is organized into **configurable sections** (added in v2.32). Each section is a card containing logically-grouped status rows. Default sections include:

- **Runway Status** — Open / Closed / Restricted, RSC, RCR, BWC, and contamination notes for every runway.
- **NAVAID Status** — Operational / Degraded / Out of Service for every configured visual navigation aid group.
- **ARFF Status** — Vehicle readiness, manning posture, and equipment availability.

Sections display side-by-side on desktop and stack vertically on mobile. Section headers and NAVAID group names are editable in-place by administrators.

### Custom Status Boards

In addition to the default sections, administrators can define **Custom Status Boards** in Base Setup. Each board has its own named items and red/yellow/green toggle, and can be assigned to any section. This lets each installation model non-standard status trackers (e.g., barrier status, fuel availability, snow removal posture) without code changes.

### AFM Out of Office Banner

The Airfield Manager can toggle an **Out of Office** banner from the dashboard. When active, a semi-transparent, minimizable banner displays across the Airfield Status page with a configurable message (e.g., "AFM out 1500Z–1900Z — direct calls to AMOPS SSgt Smith"). Activation and deactivation require Command Post initials and are logged to the Events Log. AMOPS users can toggle the banner in addition to the AFM.

### Real-Time Updates

All status changes are pushed to every connected device in real time via Supabase Realtime subscriptions on the `airfield_status` table. There is no need for personnel to refresh or poll for updates. Status changes are logged to the Events Log with full attribution (who, when, what, why), creating a permanent audit trail.

### Personnel on Airfield

A dedicated panel shows personnel currently on the airfield, their arrival time, purpose, and contractor credentials. Contractors are tracked with AF Form 483 number, expiration date (with expiry warning), and contact phone.

---

## 3. Dashboard

The Dashboard provides a consolidated KPI and activity hub for the logged-in installation.

### KPI Badges

- Open discrepancies count (color-coded by aging tier)
- Checks completed today
- Pending / resumed inspections
- Active QRCs
- Today's PPRs
- Shift checklist completion status

### Inspection Status Strip

A centered strip shows the status of today's airfield inspection and today's lighting inspection (Not Started / In Progress / Filed). Tapping a status opens the inspection detail page.

### Quick Action Buttons

Large, touch-friendly pill buttons (minimum 52px height) provide one-tap access to the most common workflows: Begin Check, Start Inspection, Update Runway Status, Execute QRC, Log Entry. New Entry and Use Template shortcuts have been removed to simplify the surface.

### Recent Activity Feed

The dashboard displays a unified recent-activity feed drawing from six sources: the activity_log table, discrepancies, checks, inspections, QRC executions, and wildlife events. Entries are color-coded by entity type (cyan = checks, amber = discrepancies, green = completions, etc.) to match the Events Log page. A "View All Recent Activity" link opens the full Events Log.

Administrators can edit or delete any entry. Non-admin users can edit or delete entries they authored. Synthetic entries (from discrepancies, checks, etc.) route deletions to the correct underlying table.

### AFM Out of Office Toggle

A toggle on the dashboard lets the Airfield Manager or AMOPS lead activate the Out of Office banner with a custom message. Deactivation also requires Command Post initials.

---

## 4. Airfield Checks

Glidepath supports seven airfield check types:

| Check Type | Purpose |
|---|---|
| FOD Walk | Foreign Object Debris sweep |
| RSC | Runway Surface Condition reading |
| RCR | Runway Condition Reading |
| IFE Response | In-Flight Emergency response |
| Ground Emergency | Ground emergency response |
| Heavy Aircraft | Post-heavy-aircraft inspection |
| BASH | Bird/Wildlife Aircraft Strike Hazard sweep |

### Key Features

- Each check type has a tailored data entry form with fields appropriate to that check.
- **Cross-device draft persistence** — an inspector can begin a check on a mobile device at the flight line and complete it on a desktop in the operations center. Drafts are written to both Supabase (`draft_data` JSONB) and localStorage.
- **Per-issue photo documentation** — photos are linked to specific findings within a check via `issue_index`, not just attached to the check as a whole.
- **Start time capture** — `started_at` is recorded the moment the inspector selects the check type, providing accurate duration metrics for analytics.
- Completed checks appear on the dashboard and feed into the Daily Operations Report.
- Check Type abbreviations expand to full labels in every report output (e.g., `FOD` → "FOD Walk"), with no underscore artifacts.

---

## 5. Daily Inspections

The Daily Inspection module implements the combined airfield and lighting inspection required by DAFMAN 13-204. Each inspection is split into two halves (airfield and lighting), each with configurable templates tailored to the installation's specific infrastructure.

### Key Features

- **Default-to-Pass** — all checklist items default to "Pass" on a new inspection. Inspectors toggle individual items to "Fail" or "N/A" with a three-state cycle, reducing data entry burden.
- **One-per-day enforcement** — only one airfield inspection and one lighting inspection may be created per calendar day. The boundary resets at 0600 local time in the installation's configured timezone.
- **Cross-device draft sync** — localStorage auto-save on every edit, Supabase sync on explicit save. Resume button respects localStorage over an empty Supabase draft, preventing mobile orphan issues.
- **Per-discrepancy photos** — a single inspection may generate multiple discrepancies, each with its own photo set (linked by `disc_index`).
- **Immediate photo upload** — photos upload as soon as they are captured, so they persist across navigation and app restarts.
- **Photo count badge** on resumed inspection list items.
- **Auto-linked discrepancies** — failed items generate discrepancies with context pre-populated from the inspection.
- **NAVAID status sync** — failed lighting inspection items mark the corresponding Visual NAVAID feature as out-of-service and create a linked discrepancy.
- **`started_at` capture** on inspection creation for accurate analytics.

---

## 6. ACSI Annual Compliance

The ACSI module digitizes the Annual Compliance Safety Inspection required by DAFMAN 13-204 Volume 2, Paragraph 5.4.3.

### Features

- **10 inspection sections, ~100 checklist items** covering the full ACSI scope.
- **Team roster management** — list of inspectors, leads, SMEs.
- **Risk management certification** — required sign-off fields.
- **Photo + map documentation at the item level** — each checklist item can carry photos and a geolocation pin.
- **Mark All Yes** for efficient completion of fully-compliant sections.
- **Parent / sub-field hierarchy** with row metadata distinguishing items, parents, and details in the PDF output.
- **Reopen for Editing** — administrators can reopen a filed ACSI. Reopening rebuilds the draft data from filed items (not a blank draft).
- **Inline Edit / Reopen / Delete** buttons on the list page.
- **PDF and Excel export** suitable for submission to higher headquarters.

---

## 7. Discrepancy Management

The Discrepancy Management module provides full lifecycle tracking for airfield deficiencies across 11 discrepancy types.

### Lifecycle States

1. Open
2. Submitted to AFM
3. Submitted to CES
4. Awaiting Action by CES
5. Waiting for Project
6. Work Completed Awaiting Verification
7. Closed

### Features

- **Photo documentation, map location, priority levels, and detailed notes** at every stage.
- **Work Order # and Assigned To fields** on the edit modal (no separate modal for assignment).
- **Multi-photo upload** with a dedicated "Use Camera" button for mobile (HTML `capture="environment"`).
- **Configurable type-to-shop mapping** — base administrators define which Civil Engineering shop is responsible for each discrepancy type, driving automatic routing.
- **Pending Work Order filter tab** on the list page.
- **Common Operating Picture** — map-based view of all active discrepancies with severity color-coding.
- **NAVAID feature linkage** — discrepancies linked to an infrastructure feature display a NAVAID system-map thumbnail on the detail view. The thumbnail shows the specific feature highlighted against all other features of the same system.
- **Outage ↔ Discrepancy bidirectional traceability** — reporting a NAVAID outage auto-creates a discrepancy with a structured description. Marking the NAVAID operational prompts to close the linked discrepancy.
- **Natural-language titles** inferred from failed inspection context.
- **Status update history** retained on the `discrepancy_status_updates` table for full audit trail; no longer writes to `activity_log` (redundant).
- **Configurable PDF exports** — single-discrepancy, summary by filter, discrepancy-by-type, aging, and lighting reports.

---

## 8. CES Work Order Workflow

The CES Work Order module provides a dedicated interface for Civil Engineering Squadron personnel.

### Role-Based Restrictions

Users with the `ces` role see only the discrepancies assigned to their shops. Their sidebar is flattened to four modules: CES Work Orders, Discrepancies (read-only detail view), Visual NAVAIDs, and Settings.

### Restricted Status Palette

CES users can update discrepancy status only to "In Work," "Project," or "Work Completed." They cannot close a discrepancy or mark it as verified. This implements separation of duties: Airfield Management personnel must independently verify that corrective work meets standards before a deficiency is removed from the active tracking list.

### Dashboard

The CES dashboard is tabbed by shop, with KPI badges for open items, average age, items awaiting action, and items awaiting verification.

---

## 9. Visual NAVAIDs & Infrastructure

The Visual NAVAID and Infrastructure module provides an interactive map of all airfield lighting, signage, and navigation aid equipment.

### Map Platform

As of v2.31 all map components render on the **Google Maps JavaScript API** via a custom adapter. Mapbox was removed from the primary interactive flow after it proved unusable on Air Force networks due to WebGL and TLS-inspection latency. Only the Wildlife heatmap retains Mapbox (for heatmap rendering fidelity).

### Feature Types (23)

Runway edge lights, runway end lights, runway centerline, threshold lights, touchdown zone, taxiway edge lights, taxiway centerline, hold short lights, stop bars, approach lighting systems, REIL, PAPI/VASI, airfield signs (labeled by text), obstruction lights, beacons, wind cones, rotating beacon, airfield guidance signs, and more.

### Key Features

- **Satellite basemap** with canvas-rendered icons for every feature type (icon cache keyed by feature type + rotation + color).
- **Paginated fetch** (`.range()` batches of 1,000) for installations with thousands of features.
- **Grouped legend** — 4 logical groups (Lights, Signs, Markings, Systems). All layers default to hidden on load; users enable the layers they need.
- **Fixture IDs** (`block` field) — auto-generated in the format `{SystemPrefix}-{TypeAbbrev}-{###}` (e.g., `TWYK-TL-001`). Editable in the edit popup.
- **Sign Text** — editable on sign features for map label rendering.
- **Bar groups** — individual lights linked to physical bars via `bar_group_id`. Managed via bar placement mode, box-select "Link as Bar," or auto-group by proximity.
- **Spatial index** for fast hit-testing with 15-meter threshold.
- **System Map thumbnails** — on discrepancy detail pages, the linked feature is highlighted against all features of its parent system.

### DAFMAN 13-204 Vol 2 Table A3.1 Outage Engine

The outage engine (`lib/outage-rules.ts`, 460 lines) implements the full Table A3.1 compliance logic:

- **23 system types** each with their own thresholds.
- **Four-tier alert system** (Green / Yellow / Red / Black) for instant visibility.
- **Spatial adjacency + consecutive detection** — detects patterns that exceed thresholds even when overall percentages appear acceptable.
- **Bar-level analysis** (`analyzeBarOutages()` with `BAR_INOP_THRESHOLD = 3`) — three or more consecutive inop lights in a bar are treated as a reportable bar-out.
- **System Health Panel** with outage timeline and bar-level detail drill-down.
- **Map health rings** — a "Color by health" toggle shows yellow rings for approaching, red for exceeded or inop.

### Import / Export

- **KML, CSV, GeoJSON, and DXF import** with coordinate deduplication and configurable feature type, layer, and rotation.
- **Audit Mode** — right-side panel for bulk operations: filter-based component assignment, sequential labeling, fixture ID generation, bulk delete, bar group management with bulk rename.

---

## 10. Aircraft Parking Plans

The Aircraft Parking Plans module enables to-scale visualization of aircraft placement on ramp and apron areas.

### Key Features

- **200+ aircraft silhouettes** rendered as scaled SVG overlays on the satellite map, maintaining accurate relative dimensions as the user pans, zooms, and rotates the view.
- **Google Maps basemap** — silhouettes are scaled to real-world wingspan and length via a bounds-based icon-scale formula that re-runs on every zoom change.
- **Nose-gear positioning** — aircraft are positioned by their nose gear; the body offsets are computed from pivot-point data.
- **UFC 3-260-01 clearance analysis** — wingtip-to-wingtip, wingtip-to-obstacle, and wingtip-to-taxilane clearances evaluated in real time with color-coded violation/warning/ok results.
- **Taxilane envelopes** — half-width computed from design aircraft wingspan and UFC clearance. Rendered as translucent polygons.
- **Obstacle types** — point, building (rotated rectangle), circle, and line obstacles.
- **Apron boundaries** — named polygon regions (drawn or imported).
- **Parking Plan Templates** — `is_template` flag allows saving a plan as a reusable template. `Duplicate Plan` deep-copies spots, taxilanes, boundaries, and obstacles.

### Editing

- **Drag any aircraft, obstacle, or boundary** — live clearance labels appear during drag with color-coded distance and required-clearance display.
- **Multi-select aircraft** (added v2.32):
  - **Shift+click** to toggle spots into the selection.
  - **Box Select** mode (ESC or toolbar button) — drag a rectangle to select all aircraft within.
  - **Group drag** — moving one selected aircraft translates the whole group in unison.
  - **Group heading**, **group clearance override**, and **group delete** in a dedicated multi-ops panel.
  - **Delete / Backspace** on the keyboard removes the entire selection (with confirmation).
- **Taxilane point editing** (added v2.32) — toggle "Edit Points" on a taxilane to expose draggable vertex markers (blue) and midpoint insert markers (white). Shift+click a vertex deletes it; clicking a midpoint inserts a new vertex.
- **Bulk add aircraft** with auto-spacing based on wingspan + wingtip clearance.
- **Heading preset** in the aircraft picker — aim all newly-placed aircraft at a chosen bearing.
- **Context menu** — Ctrl+click (desktop) or long-press (touch) opens per-aircraft actions (duplicate, remove, lock/unlock).
- **Keyboard nudge** — arrow keys move the selected aircraft 1 ft; Shift+arrow moves 5 ft.

### Ruler Tool

A ruler hook is available on the parking page and on the obstruction evaluation map. Click two points to see distance and bearing.

### PDF Export

- **Parking Plan PDF** (`lib/parking-pdf.ts`) temporarily resizes the map to 1600×900, flattens pitch, waits for `idle`, and captures the canvas. The resulting PDF includes the satellite snapshot with silhouettes overlaid, a legend, a clearance results table, and aircraft roster with nose-gear coordinates (DMS).
- **Email PDF** — any parking plan PDF can be emailed directly from the application.

---

## 11. Obstruction Evaluations

The Obstruction Evaluation module implements the imaginary surface analysis defined in UFC 3-260-01 Chapter 3.

### Features

- **Multi-surface evaluation** — approach/departure, transitional, inner horizontal, conical, and outer horizontal surfaces for any runway at the installation.
- **Geodesic calculations** using actual runway coordinates (not rounded headings).
- **Multi-runway analysis** — evaluate a single object against every runway simultaneously.
- **Taxiway clearance envelopes** — OFA (Object Free Area) and Safety Area rendered on the map. FAA standards use TDG-based OFA + Safety Area; UFC uses Class A/B Clearance Lines.
- **Google Elevation API** integration (server-side proxy, key held server-only) for terrain elevation at any clicked point.
- **NOTAM Reference** — for any obstruction, displays distance (NM) and bearing from the nearest threshold, formatted for direct inclusion in a NOTAM.
- **Ruler tool** for measuring arbitrary distances on the obstruction map.
- **Obstruction history map** — all recorded obstruction evaluations shown on a single map for trend visibility.
- **PDF export** with determination, surface penetrations, and map snapshot.

### Satellite Imagery Alignment

Google satellite tiles are used across every map module. A user-facing disclaimer documents the known limitation of satellite imagery vs. surveyed GPS coordinates (typical offset ~10–30 ft, occasionally more).

---

## 12. Quick Reaction Checklists

The QRC module digitizes 25 emergency and contingency checklists.

### Features

- **Six step types**: Checkbox, Checkbox + Note, Fill-in Field, Time Field, Agency Notification, and Conditional Reference.
- **Step type editor** in Base Setup allows administrators to change step types on existing QRC templates.
- **SCN (Secondary Crash Net) support** — emergency QRCs with `has_scn_form` generate the SCN form and log a "SECONDARY CRASH NET ACTIVATED" entry to the Events Log.
- **Cancel flow** — cancelling an SCN-activated QRC deletes the corresponding activity_log entries.
- **Active QRC visibility on the dashboard** — leadership awareness of ongoing emergencies.
- **Archival** — completed QRCs retain full step-by-step execution records with timestamps for after-action review.

---

## 13. Shift Checklist

Configurable per-shift task tracking for Day, Mid, and Swing shifts.

### Features

- **Configurable checklist items per shift** — base administrators define the items required for each shift.
- **Three-state toggle** (unchecked → completed → N/A → unchecked) — added in v2.30, tracked via `is_na` boolean on `shift_checklist_responses`.
- **Auto-reset at 0600 local time** (configurable per installation) ensures each shift starts with a clean task list.
- **Progress bars and file-button counts** include both completed and N/A items.
- **Dashboard integration** — shift checklist completion status is visible from the dashboard and can be completed in a modal without leaving the page.
- **History view** for review of past shifts.

---

## 14. Wildlife / BASH

The Wildlife and BASH module supports sighting and strike documentation in compliance with DAFMAN 91-212.

### Features

- **Sighting and strike forms** with required fields matching Air Force reporting standards.
- **Weather auto-fill** — on form mount, live meteorological data from Open-Meteo is mapped to form fields (wind, visibility, ceiling, temperature).
- **Heatmap visualization** of strike and sighting density across the airfield (Mapbox-based for heatmap rendering fidelity).
- **Species picker with favorites** — `is_favorite` on `base_wildlife_species`. Favorites sort first, with a gold border and star.
- **Zulu time throughout** — all timestamps use Zulu (UTC) time formatted via shared utilities (`formatZuluTime`, `formatZuluDate`, etc.).
- **PDF export** for both sighting and strike reports.

---

## 15. Waivers

The Waiver Management module implements the full AF Form 505 lifecycle for airfield waivers.

### Features

- **6 classification types, 7 status values** covering the full waiver workflow.
- **Initial submission, coordination, approval, and annual review** tracking.
- **Map view** — all active waivers displayed geospatially.
- **PDF and Excel export** suitable for submission to MAJCOM functional managers.
- **Photo documentation** support.

---

## 16. NOTAMs

The NOTAM module retrieves live data from the FAA's official NOTAM API.

### Features

- **Live FAA feed** (`notams.aim.faa.gov`) — current and upcoming NOTAMs for the installation's airfield identifier.
- **Template-based local NOTAM draft creation** — dropdown selectors pull from the live feed to pre-populate fields. E-field auto-extraction for descriptions. Effective dates auto-filled from parsed NOTAM text.
- **Expiry alerts** highlight NOTAMs approaching their effective end date.
- **NOTAM reference display** on the obstruction evaluation module — see §11.

---

## 17. Prior Permission Required (PPR) Log

Added in v2.31. The PPR module tracks inbound aircraft requests requiring prior approval.

### Features

- **Fully configurable columns** — base administrators define which columns appear (text, date, time, yes/no/na, phone, number, email field types).
- **Inline column rename and reorder** in Base Setup.
- **Auto PPR# generation** — sequential numbers per installation.
- **Browsable table** with date filtering, sort, and search.
- **Create / edit / delete** with full RLS enforcement.
- **Dashboard integration** — today's PPRs listed at the bottom of Airfield Status.
- **Daily Ops report integration** — PPR entries logged for the day appear on the daily operations PDF with the "PPR" entity label.

---

## 18. Customer Feedback

Added in v2.32. A public-facing feedback collection module for base customers (transient aircrew, contractors, visiting units).

### Features

- **Public form at `/feedback/[baseId]`** — no authentication required, accessible via QR code.
- **Configurable fields** — text, textarea, rating (1–5 stars), yes/no, and dropdown with custom options.
- **Per-base form configuration** stored on `bases.feedback_form_config` JSONB.
- **QR code generation** in Base Setup step 15 — print and post at the FBO or Base Ops counter.
- **Feedback list page** for authenticated staff with aggregate stats: total count, average rating, and rating distribution histogram.
- **Analytics card** on the Reports page surfacing the same metrics alongside other KPIs.

---

## 19. Reports & Analytics

### Report Types (Client-Side PDF)

| Report | Scope |
|---|---|
| Daily Operations Report | Full shift summary with events log, checks, inspections, PPRs, NAVAID outages, QRC executions |
| Airfield Check Report | Single check, with photos and map |
| Inspection Report | Single inspection, airfield + lighting halves |
| Single Discrepancy Report | Full discrepancy history with photos |
| Discrepancy Summary | Filter-based summary |
| Discrepancy by Type | Grouped by discrepancy type |
| Aging Report | Discrepancies by age tier |
| Lighting Report | NAVAID-specific discrepancy output |
| ACSI Report | Full ACSI export with item-level photos and maps |
| Waiver Report | Active waivers |
| Obstruction Evaluation | Single evaluation with surface determinations |
| NAVAID Status Report | Current status across all infrastructure features |
| Parking Plan | Plan snapshot with silhouettes, clearances, roster |
| BASH Sighting Report | Single sighting |
| BASH Strike Report | Single strike |
| Events Log Export | Full events log (also Excel) |

All PDFs are generated client-side via jsPDF + jspdf-autotable. No operational data is transmitted to external rendering services. All PDFs support being emailed directly from the application via the shared Email PDF modal (Resend transactional email).

### Excel Exports (4)

- ACSI inspection results
- Events log
- Waiver register
- Discrepancy data

### 30-Day Analytics Dashboard

Nine KPIs over a configurable lookback period:

1. Inspections (split by type, with average time calculated from `started_at → filed_at`)
2. Checks (with average time from `started_at → completed_at`)
3. Discrepancies (open, closed, aging)
4. QRC activations
5. Personnel activity levels
6. Obstructions evaluated
7. Parking plans generated
8. Wildlife sightings and strikes
9. Customer feedback (count, average rating, distribution)

Average times under 1 minute are filtered out of the average calculation to exclude accidental submissions.

### Daily Ops PDF Fidelity

- Action labels match the Events Log exactly (template labels, text inference).
- All details text is uppercased across display, Excel, and PDF.
- 7 entity-type labels added; no underscore artifacts.
- ACTION column color-coded by entity type.

---

## 20. Events Log

The Events Log provides a comprehensive, immutable audit trail of all system activity.

### Features

- **Automatic logging** of status changes, inspection completions, check completions, discrepancy updates, QRC activations, and out-of-office activations.
- **Manual entry templates** — configurable per installation for phone calls, radio communications, verbal orders, and other off-system events.
- **Action inference** — free-typed entries are matched against 25+ keyword patterns to infer a structured ACTION label.
- **Military time notation** throughout (e.g., `1500Z`).
- **Operating Initials (OI) column** — click to reveal the user's OI (stored as max-4-char `operating_initials` on profile).
- **Color-coded ACTION column** by entity type.
- **Deduplication** — skips DB entity details when metadata already has a formatted `details` string, preventing title/description duplication.
- **Excel export** for integration with external reporting systems.

---

## 21. Aircraft Database

The Aircraft Database contains over 200 military and civilian aircraft types.

### Features

- **Dimensional data** — wingspan, length, MTOW, and per-aircraft pivot-point offsets.
- **Pavement loading characteristics** — ACN values across flexible and rigid pavement categories.
- **ACN/PCN comparison tool** — rapid assessment of whether a visiting aircraft's weight is compatible with the installation's pavement strength ratings.
- **Used by Parking Plans** for silhouette rendering, wingspan-to-ADG lookup, and clearance calculations.

---

## 22. Regulations Library

Indexed access to 70 regulatory references spanning DAFMAN, UFC, AFMAN, and related publications.

### Features

- **Local cache via IndexedDB** — bookmarked documents are accessible offline.
- **My Documents tab** — personal bookmarks for quick retrieval.
- **Full-text search** within the document titles and indexed keywords.

---

## 23. Personnel on Airfield & Contractors

Single-column stacked layout for tracking who is currently on the airfield.

### Features

- **Individual personnel entries** — name, organization, purpose, arrival time, expected duration.
- **Contractor templates** — saved to Supabase (`bases.contractor_templates` JSONB), shared across all users at the installation.
- **Contractor fields** — AF Form 483 number, AF Form 483 expiration date (with expiry warning badge), contact phone number.
- **Template dropdown** in the add form for rapid entry of recurring contractors.
- **AMOPS role can create and edit templates** (added v2.32). Delete is restricted to administrators.
- **Race-condition-safe template edits** (read-then-write).
- **Mark Completed** button moves a personnel entry to the historical log.

---

## 24. Training Module Reference

Added v2.29. A built-in training resource at `/training` with three tabs:

1. **Quick Start Guide** — getting started for new users.
2. **Module Reference** — every module documented with 36 embedded screenshots.
3. **Base Setup Guide** — 12-step walkthrough with 15 embedded setup screenshots.

### Features

- **Client-side PDF export** of either guide (jsPDF, no Supabase usage).
- **Narrated video walkthroughs** — 23 videos with scripts and transcripts maintained in `docs/Video_Walkthrough_Script.md` and `docs/Video_Walkthrough_Transcripts.md`.
- **Registered in sidebar and the More page**.

---

## 25. Settings & Base Configuration

### User Settings

- Profile (rank, name, operating initials, email visibility)
- Default PDF email address (used as a pre-fill across all email modals)
- Dark / light mode toggle (dark mode text brightened across 4 contrast levels; light mode cyan and badges improved in v2.32)
- Contact Support button
- App version and About section

### Base Setup Wizard (15 Steps)

A 12-step wizard introduced in v2.29, extended to 15 steps by v2.32:

1. Installation basics (name, ICAO, timezone, elevation — auto-populated from ICAO import)
2. Runways (import from FAA NFDC survey-grade coordinates + inline edit for all fields, adjustable on map)
3. Areas and apron boundaries
4. Visual NAVAID groups (editable group names)
5. CE Shops (with discrepancy type-to-shop mapping)
6. Inspection templates (airfield + lighting)
7. Shift Checklist items per shift
8. Check templates
9. Discrepancy types
10. QRC templates (with step type editor)
11. Events Log templates
12. ARFF configuration
13. Custom Status Boards (assignable to sections)
14. PPR column definitions
15. Customer Feedback form fields + QR code generation

### Additional Features

- **Installation name editable in-place** (click the title in the Base Setup header to rename).
- **ICAO airport lookup API** — one-click "Import All" populates runways, areas, and default NAVAIDs.
- **Adjust on Map tool** for runway endpoint fine-tuning after import.
- **Full base directory** (155 bases) in the invite-user modal.

---

## 26. User Management

### Roles (9)

| Tier | Role | Description |
|---|---|---|
| 1 — Admin | System Administrator | Full cross-installation access |
| 1 — Admin | Base Administrator | Full access at assigned installations |
| 1 — Admin | Airfield Manager | Full operational and administrative access |
| 1 — Admin | NAMO | NAVAID Maintenance Officer |
| 2 — Operational | AMOPS | Airfield Management Operations |
| 3 — Observer | CES | Civil Engineering Squadron (limited to work orders) |
| 3 — Observer | Safety | Read-only for safety office |
| 3 — Observer | ATC | Read-only for air traffic control |
| 3 — Observer | Read Only | Leadership / liaison view |

### Features

- **Invite flow** — admins invite users by email with role and installation pre-selected. Branded invite email (Resend).
- **Branded transactional emails** — Approved, Info Needed, Rejected, and Signup Pending templates. Reply-to `info@glidepathops.com`. Non-DoD endorsement disclaimer in every email footer.
- **Self-service signup** with admin approval gate.
- **Admin API** (`/api/admin/users`) — authenticated endpoint for user CRUD. Server-side role validation independent of RLS.
- **Signup email endpoint** (`/api/signup-email`) — public, rate-limited.
- **User deletion** nullifies 12 FK columns across 10 tables before deleting the profile and auth record, preserving audit trail integrity.
- **Airfield Manager and NAMO** can invite and edit users (with appropriate role scoping). Base admins can assign the `airfield_manager` and `namo` roles.
- **Email privacy** — email hidden from user cards, masked with an eye toggle in the edit modal.
- **Login activity dialog** shows last login, with per-session flag (`glidepath_activity_checked`) to avoid repeat prompts.

---

## 27. Multi-Base Operations

### Data Isolation

Every operational table in Glidepath has a `base_id` foreign key. Row-Level Security policies on all tables reference the `base_members` join table on every query, enforcing:

- A user at Installation A cannot read, modify, or detect the existence of data belonging to Installation B.
- A user removed from an installation's membership immediately loses access — no client-side cache or session persistence defeats the check.
- System administrators with cross-base access must explicitly switch installation context. There is no "see everything" mode.

### Installation Switcher

The header displays the currently active installation. Users with multiple memberships can switch between installations without signing out. Switching:

- Resets all cached data for the previous installation.
- Destroys and re-initializes all map components (6 map-using pages) via a `[token, installationId]` dependency.
- Reconnects all Realtime subscriptions on the new installation's rows.

### Current Deployment

Version 2.32.0 supports 155 installations in the base directory, with the Demo AFB installation cloned from Selfridge ANGB for demo-mode access.

---

## Security Posture Summary

- **Row-Level Security** on every operational table (46+ tables as of v2.31).
- **Four RLS helper functions** — `user_has_base_access()`, `user_can_write()`, `user_is_admin()`, `user_is_sys_admin()`.
- **Friendly error messages** via `friendlyError()` map RLS and constraint violations to human-readable messages across all 15 CRUD modules.
- **Server-side API validation** for administrative operations (independent of RLS).
- **JWT sessions** with HTTP-only cookies; service role key never transmitted to clients.
- **Storage RLS** on the `photos` bucket; however, path-based RLS is a known gap (app-level checks currently suffice).
- **No third-party rendering** — all PDF and Excel generation occurs on the client device. Map tiles are the only external data fetched during report rendering, and can be served from DoD-hosted tile servers after Platform One migration.

---

## Regulatory Compliance Mapping

| Regulation | Modules | Compliance Area |
|---|---|---|
| **DAFMAN 13-204 Vol 1** | Airfield Status, Events Log, Shift Checklist, User Management | Airfield management operations, personnel duties, shift procedures, status reporting |
| **DAFMAN 13-204 Vol 2** | Daily Inspections, Airfield Checks, Discrepancies, Visual NAVAIDs, ACSI | Inspection procedures, check requirements, discrepancy tracking, NAVAID maintenance standards, annual compliance |
| **DAFMAN 13-204 Vol 2, Table A3.1** | Visual NAVAIDs (Outage Engine) | Minimum lighting system requirements, outage thresholds, reportable conditions |
| **DAFMAN 13-204 Vol 2, Para 5.4.3** | ACSI Module | Annual Compliance Safety Inspection |
| **DAFMAN 13-204 Vol 2, Para 2.5.2.10** | Airfield Checks, Daily Inspections, Events Log | Suitable-substitute web-based program authorization |
| **DAFMAN 13-204 Vol 3** | NOTAMs, Waivers, PPR | NOTAM procedures, waiver management, PPR log |
| **UFC 3-260-01** | Obstruction Evaluations, Parking Plans, Infrastructure | Imaginary surface criteria, clearance standards, taxiway design groups, pavement classifications |
| **UFC 3-260-01 Ch. 3** | Obstruction Evaluations | Approach/departure, transitional, horizontal, conical surfaces |
| **AFMAN 91-203** | QRC, Safety role | Occupational safety, emergency response procedures |
| **DAFMAN 91-212** | Wildlife / BASH | Bird/Wildlife Aircraft Strike Hazard program |
| **AF Form 505** | Waivers | Waiver lifecycle |
| **AF Form 483** | Personnel on Airfield | Contractor escort credentials |
| **AF Form 3616** | Events Log (via T-3 waiver) | Daily record of facility operation — CAC signature requirement waived via approved T-3 |

---

## Version History Highlights (v2.27 → v2.32)

- **v2.28** — Dashboard UI revamp, events log template labels + color-coding, discrepancy workflow streamlining (edit modal with W/O + Assigned To, camera capture, Pending W/O filter), ACSI reopen with draft rebuild, NAVAID map thumbnails, silent realtime tracking.
- **v2.29** — Training module (3 tabs, 51 screenshots, PDF export), 12-step base setup wizard with ICAO import and FAA survey-grade coordinates, obstruction map switched to Google satellite (corrects 50–100 ft offset), NOTAM template integration, contractor templates, military time notation, dark mode readability.
- **v2.30** — Sign Out button (sidebar + More), shift checklist N/A toggle, QRC step type editor, DAF Form 679 T-3 waiver draft, CUI registry analysis, DAFMAN 13-204v2 compliance review, competitive analysis.
- **v2.31** — **Google Maps migration** (13 components — eliminates the Mapbox gov-network freeze), parking plan templates, Custom Status Boards, PPR Log module, tile pre-cache in Settings.
- **v2.32** — Airfield Status section-based layout with assignable Custom Status Boards, AFM Out of Office banner, Customer Feedback module (public form + QR code), branded email templates, ruler tool, NOTAM reference on obstructions, editable runway and installation name in Base Setup, personnel templates expanded to AMOPS, multi-select aircraft in parking plans with box-select / shift-click / group ops, taxilane point editing.

---

*This document describes the capabilities of Glidepath v2.32.0 as of April 2026. For the detailed technical specification, refer to the Glidepath SRS (Engineering Edition).*
