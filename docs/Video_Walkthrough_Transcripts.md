# Glidepath Video Walkthrough — Speaker Transcripts

These are suggested speaking scripts for each video. Read naturally — don't read verbatim. Use these as a guide for what to cover and in what order.

---

## VIDEO 1: Overview & First Look

"Welcome to Glidepath — a mobile-first airfield operations management platform purpose-built for U.S. military installations.

If you're an Airfield Manager, AMOPS controller, CES technician, or anyone involved in day-to-day airfield operations — this is the tool that replaces your paper forms, Excel trackers, and whiteboard status boards with a single, connected platform that works on any device.

Let me give you a quick tour of what we're working with.

When you first log in, you'll land on the Airfield Status page — this is the operational hub. Everything that matters right now is on this screen. Weather, runway status, NAVAID status, ARFF readiness — all updated in real time across every connected user.

On the left, you'll see the sidebar navigation. It's organized into groups — Operations for your daily workflow, Airfield Management for discrepancies, obstructions, waivers, and infrastructure, Reference for regulations and the aircraft database, and Settings for base configuration and user management.

On mobile, you've got a bottom navigation bar with the five most-used pages — Status, Dashboard, Obstruction, Events Log, and More. The More page gives you access to everything else.

A few key concepts before we dive into each module. First — everything in Glidepath is scoped to your installation. Your data is your data. Multi-base users can switch installations using the dropdown in the header.

Second — role-based access. Airfield Managers, AMOPS, Base Admins, CES users — each role sees exactly what they need. CES users for example only see Work Orders, Discrepancies, NAVAIDs, and Settings.

Third — real-time sync. When someone changes the runway status, updates a NAVAID, or logs an entry — every connected user sees it instantly. No refreshing required.

And fourth — this is a Progressive Web App. You can install it to your phone's home screen and it works offline for regulations, draft inspections, and cached map tiles. Let's dig into each module."

---

## VIDEO 2: Airfield Status Page

"The Airfield Status page is your operational nerve center. Everything your team needs to know about current airfield conditions lives right here.

Starting at the top — the weather strip pulls live data from Open-Meteo. You'll see temperature, wind speed, visibility, and current conditions. Next to it is the Weather Info section where you can post Watches, Warnings, and Advisories with effective times and advisory numbers.

Below that, you'll see the status sections arranged in rows. The Runway Status section shows each runway with its active end, operational status — open, suspended, or closed — plus RSC and BWC. Every change requires a confirmation dialog with optional remarks, and everything gets logged to the events log automatically.

The NAVAID Status section shows your NAVAIDs grouped by runway end. Each one has a green, yellow, or red toggle. When you set one to yellow or red, a notes field appears so you can document what's going on. These groups are editable — if 'Other' doesn't make sense for your base, click the header to rename it.

The ARFF Status section has your CAT selector and per-vehicle readiness cards. Click a vehicle to change its status between Optimum, Reduced, Critical, and Inadequate.

Custom Status Boards — these are configurable panels you create in Base Setup. Arresting systems, comm status, whatever your base needs. Each item has a green/yellow/red toggle with notes. You can assign boards to appear under Runway, NAVAID, or ARFF sections, or they can stand alone.

Down below, you've got Personnel on Airfield showing active contractors, Construction/Closures remarks, and Miscellaneous Info.

One more feature — the Out of Office function. When the airfield management office closes, hit the Out of Office button on the Dashboard. It puts a banner across the Airfield Status page for all users with your custom message and Command Post contact info. Activating and deactivating both require Command Post initials and automatically log to the events log."

---

## VIDEO 3: Dashboard

"The Dashboard is your action center — where you kick off your daily tasks and see what's been happening.

At the top, you'll see the Last Check Completed banner showing the most recent check type and time. Below that are the Inspection Status cards for Airfield and Lighting — showing whether today's inspection is complete, in progress, or not started. Tap one to resume or start.

The quick action buttons are your launch pad — Checks, Discrepancy, Personnel, Checklist, QRC, and Out of Office. Each one opens the relevant module or dialog right from here.

Below the buttons is the Recent Activity feed. This isn't just the events log — it's a unified timeline showing everything that happens on the installation. Discrepancy updates, check completions, inspection filings, QRC executions, wildlife sightings, status changes, manual entries — all merged chronologically with color-coded action labels and operating initials.

Tap 'View All Recent Activity' to see the full feed on its own page, grouped by date."

---

## VIDEO 4: Daily Inspections

"Daily Inspections is the module your inspectors will use every single day. It handles both the Airfield and Lighting halves of your daily inspection report.

There's a one-per-day enforcement — only one airfield and one lighting inspection per day, resetting at 0600 local based on your base's timezone.

To start, tap the Airfield card. You'll get a confirm dialog, and then the checklist form loads. The form is organized into sections — each one collapsible with an item count badge. Every item defaults to Pass with a green checkmark.

The toggle cycles through three states — Pass, Fail, N/A. When you mark an item as Fail, the discrepancy details panel expands below it. Here you can pin a location on the satellite map, add a comment, select the area, use your GPS, and add photos. Photos upload to the server immediately — so even if you navigate away, they're saved. You can also check the box to automatically create an airfield discrepancy from this finding.

At the top of the form, you'll set your BWC, RSC, and RCR values.

As you work through the checklist, your progress saves to your device automatically — every single toggle. If you get a radio call and need to switch to another module, just navigate away. When you come back, tap the Airfield card and everything is right where you left it. Photos, comments, map pins — all persisted.

When you're done, hit Complete & File. The system validates your entries, saves everything to the database, creates any discrepancies you flagged, and logs the completion to the events log.

After the airfield half is filed, you'll see the Lighting tab with a Start/Resume card. Same workflow — go through the lighting checklist, mark failures, and file when complete.

The History tab shows all past inspections with filtering and search. You can resume in-progress ones, reopen completed ones for editing, or delete drafts."

---

## VIDEO 5: Airfield Checks

"Airfield Checks gives you a unified form for seven different check types — FOD, RSC, RCR, IFE, Ground Emergency, Heavy Aircraft, and BASH.

Pick your check type and the form adapts. For a FOD check, you'll select your route, note any items found, and mark clear or not clear. For an RSC check, you'll log contaminant type, depth, coverage, braking action, and treatment. RCR has Mu readings for rollout, midpoint, and departure endpoints.

The Ground Emergency checklist has 12 AM action items and 9 agency notification checkboxes. IFE walks you through the in-flight emergency response. Heavy Aircraft logs the aircraft type, parking spot, weight, and taxi route. BASH captures condition code, species, mitigation actions, and habitat attractants.

Every check supports multiple issues — each with its own photo and GPS pin. Drafts persist to the server with a manual Save Draft button, and completed checks log to the events log automatically."

---

## VIDEO 6: QRC — Quick Reaction Checklists

"QRC gives your team interactive, digitized Quick Reaction Checklists for 25 different emergency and operational scenarios — IFE, aircraft mishap, bird strike, tornado warning, you name it.

The Available tab shows your template library as a grid. Tap one to open a new execution. The checklist loads with your steps — checkboxes, checkboxes with notes, agency notifications, fill-in fields, time fields with a 'Now Zulu' auto-fill button, and conditional cross-references to other QRCs.

For QRCs with a Secondary Crash Net, the SCN data entry form appears above the steps.

When the event is resolved, close the QRC with your initials and timestamp. Or cancel if it was opened accidentally — that permanently deletes the execution.

Active executions show in the Active tab, and all history is searchable in the History tab. QRC executions are automatically included in the Daily Operations Summary report."

---

## VIDEO 7: Shift Checklist

"The Shift Checklist is your per-shift task tracker. Day, Swing, Mid — each shift has its own configurable list of items with daily, weekly, or monthly frequency.

The Today tab shows a progress bar for each shift. Check off items as you complete them, add notes where needed. Items cycle through three states — unchecked, completed with a green check, or N/A in gray. When all items are done, file the checklist.

The History tab lets you browse past checklists by date with a read-only detail view.

On the Dashboard, the shift checklist has a KPI badge that opens a quick access dialog — so you can mark items complete without leaving the Dashboard.

Everything is timezone-aware using your base's configured timezone and reset time — typically 0600 local."

---

## VIDEO 8: Discrepancies

"Discrepancies is your issue tracking system — from discovery through resolution. Eleven types covering FOD, pavement, lighting, markings, signage, drainage, vegetation, wildlife, equipment, security, and other.

Creating a discrepancy is straightforward — pick the type, add a title and description, pin a location on the map or use GPS, set the severity, and attach photos. The system automatically assigns it to the right CE shop based on your base's type-to-shop mapping.

The lifecycle goes from Open through Submitted to AFM, Submitted to CES, Awaiting CES Action, Waiting for Project, Work Completed, and finally Closed or Cancelled. Each transition is tracked with timestamps and user attribution.

The detail page shows the full history, status updates, work order tracking, notes, photos, and linked NOTAMs. If the discrepancy is linked to a Visual NAVAID, you'll see a system map thumbnail right on the detail page.

Switch to Map view for the Common Operating Picture — a satellite map with severity-colored pins showing all open discrepancies. Filter by severity or shop using the legend and filter chips.

CES users get their own dedicated Work Orders page with shop tabs, KPIs, and a priority-sorted queue.

For reporting, you've got the Discrepancy Report builder with five filters, the Trends report showing opened versus closed over time, and the Aging report grouping open items by how long they've been open."

---

## VIDEO 9: Obstruction Evaluation Tool

"The Obstruction Evaluation Tool performs UFC 3-260-01 Class B imaginary surface analysis — evaluating potential obstructions against all ten surfaces across every runway simultaneously.

Tap the map to place an obstruction point. The tool automatically identifies which surface zone you're in, calculates the distance from centerline and nearest threshold, and fetches the ground elevation via the Elevation API.

Enter the obstruction height and you'll see whether it penetrates any surface, the maximum allowable height, and the penetration amount. For approach-departure surfaces, it calculates the slope and shows the exact allowable height at that distance.

The NOTAM Reference card gives you the distance in nautical miles and bearing from the nearest threshold — formatted exactly how you'd write it in a NOTAM.

Taxiway clearance envelopes are rendered on the map showing OFA and Safety Area polygons based on FAA TDG and UFC Class A/B criteria.

The ruler tool lets you measure ad hoc distances in feet — click two or more points and it shows segment distances plus the total.

Every evaluation can include photos, and violations are flagged with UFC table references. The History tab shows all past evaluations on a satellite map or in a searchable list."

---

## VIDEO 10: Visual NAVAIDs / Infrastructure

"The Visual NAVAIDs module is where you digitize and manage every light, sign, and fixture on your airfield.

The satellite map supports 22 feature types across four groups — Signs, Taxiway Lights, Runway Lights, and Miscellaneous. Click to place, drag to move, and each feature gets custom canvas-rendered icons that look like real airfield signs.

The legend system has three tiers — Type legend with collapsible groups, Systems legend auto-grouped by runway and taxiway from your base configuration, and per-layer visibility toggles. Since features start hidden on load, you toggle on just the layers you need.

For outage tracking, the system implements DAFMAN 13-204v2 Table A3.1 — 23 lighting system types with configurable thresholds. When you mark a feature inoperative, it auto-creates a discrepancy with a structured description. The System Health Panel shows the overall status of each lighting category with bar-level detail.

Audit Mode is for systematic field verification — filter by component, bulk label features with sequential numbering, assign fixture IDs, and manage bar groups.

The Import Pipeline supports KML from Google Earth, CSV, GeoJSON, and DXF from AutoCAD — so you can bring in existing data and clean it up in the app."

---

## VIDEO 11: Aircraft Parking Plans

"Aircraft Parking is an interactive editor for arranging aircraft on your aprons with to-scale silhouettes.

Search the aircraft database — over 200 military and civilian types — pick your aircraft, and click the map to place it. The silhouette renders at true wingspan scale on the satellite imagery. You can set a heading preset before placing, bulk add up to 50 of the same type, and auto-space them at proper wingtip clearance intervals.

Drag aircraft to reposition them — during the drag, connecting lines show clearance distances to nearby aircraft and obstacles in real time. The system calculates UFC 3-260-01 wingtip clearances with ADG classification, highlighting violations in red and warnings in yellow.

The tabbed sidebar has Aircraft for your placed aircraft list, Environment for apron context settings, Clearance for the violation summary, and Settings for UFC reference tables.

You can place obstacles — buildings, points, circles, and lines — with dimensions and a lock toggle to prevent accidental moves. Taxilanes define taxi routes with width for clearance envelope rendering.

Plans can be saved as templates for reuse. Export to PDF gives you a landscape document with the aircraft summary, a map capture, and the clearance violations table. The ruler tool lets you verify distances in feet."

---

## VIDEO 12: Waivers

"The Waivers module handles the full airfield waiver lifecycle modeled after AF Form 505 and the AFCEC Playbook.

Six classification types — permanent, temporary, construction, event, extension, and amendment. Seven status values with mandatory comment dialogs for each transition.

Creating a waiver walks you through criteria and standards references, description, location pinning on the map, and photo attachments with camera capture. Coordination tracking lets you log approvals by office.

Annual reviews are managed through a dedicated review mode with year-by-year forms, KPIs, and board presentation tracking.

The map view shows all waivers with emoji markers by classification type. Individual waiver PDFs include embedded photos, and the Excel export gives you the full register with criteria and coordination sheets."

---

## VIDEO 13: ACSI — Annual Compliance & Safety Inspection

"ACSI handles your Annual Compliance and Safety Inspection per DAFMAN 13-204v2. Ten sections with about 100 checklist items covering everything from airfield geometry to emergency planning.

Each item gets a Y, N, or N/A toggle. For failures, you document the discrepancy with comments, work order numbers, project numbers, estimated cost, and completion date. Photos and map pins can be attached to each failed item.

The inspection team editor ensures you have your required members — AFM, CE, and Safety — plus any additional members. Risk management certification has three signature blocks for OG/CC, MSG/CC, and WG/CC.

Exports include a PDF with the parent/sub-field hierarchy and inline photos, plus an Excel workbook with Cover, Checklist, Team, and Risk Certification sheets."

---

## VIDEO 14: Wildlife / BASH

"Wildlife and BASH tracking covers both sightings and strikes. The sighting form captures species — with a favorites system for quick access — count, location, and conditions. The strike form adds aircraft info, damage assessment, and detailed location data.

Weather fields auto-populate from Open-Meteo when you open the form. The species picker sorts your favorites to the top with a gold border.

The heatmap view shows sighting density on the satellite map, and the analytics dashboard tracks sightings, strikes, and top species over your selected time period.

BASH checks are integrated with the airfield checks module for rapid incident reporting."

---

## VIDEO 15: NOTAMs

"The NOTAMs page pulls a live feed from the FAA NOTAM system — no API key required. It auto-fetches NOTAMs for your installation's ICAO code when you open the page.

Each NOTAM displays the full text in monospace format. Filter chips let you narrow by FAA, LOCAL, Active, or Expired. NOTAMs within 24 hours of expiration get a red highlight and show up as a badge count in the sidebar.

You can search any other airport's NOTAMs by entering its ICAO code. The NOTAM dropdown selectors on discrepancy and event forms are populated from this live feed."

---

## VIDEO 16: PPR Log

"The PPR Log tracks Prior Permission Required entries. Each PPR gets an auto-generated number using Julian day, sequence, and approver initials — like 096-003-CP.

The column layout is fully configurable — your base admin defines the fields in Base Setup with seven field types: text, date, time, yes/no/N/A, phone, number, and email. You can rename columns, set required fields, and reorder them.

Browse by date — Today, last 7 days, 30 days, or a custom range. Create, edit, and delete entries. Today's PPRs also show at the bottom of the Airfield Status page."

---

## VIDEO 17: Customer Feedback

"Customer Feedback lets you collect input from anyone via a QR code. Scan the code, fill out the form — no login required.

The form is configurable in Base Setup — set the title, description, standard fields like name, email, organization, and the 1-5 star rating, plus custom fields of any type. Generate the QR code right from Base Setup and print it or share the URL.

Submissions show on the Feedback page with stats cards — submission count, average rating, and a rating distribution chart. The analytics card on Reports & Analytics tracks it too. There's a 5-minute cooldown between submissions to prevent spam."

---

## VIDEO 18: Reports & Analytics

"Reports & Analytics gives you ten metric cards with a configurable time frame — 7 days, 30 days, 90 days, 6 months, or a full year.

You get Airfield Inspections and Lighting Inspections with completion count, average time, and pass rate. Airfield Checks with total count, average per day, average completion time, and breakdown by type. Discrepancies showing open count, average days to close, opened versus closed, and the net trend. QRC Executions, Personnel on Airfield, Obstruction Evaluations with violation rate, Parking Plans, Wildlife/BASH with top species, and Customer Feedback with average rating.

Beyond the analytics dashboard, you've got five report types — the Daily Operations Summary covering all activity for a date range, the Discrepancy Report builder with five filters and live preview, Discrepancy Trends charting opened versus closed over time, Aging Discrepancies grouped by age tier, and the Airfield Lighting Report with system health tables.

Every report exports to PDF with professional formatting, and any PDF can be emailed directly from the app."

---

## VIDEO 19: Reference Library & Aircraft Database

"The Reference Library houses 70 regulation entries from DAFMAN 13-204 Volumes 1 through 3 and UFC 3-260-01. Full-text search, category and publication type filters, and a favorites system for quick access.

Tap any regulation to open it in the built-in PDF viewer with pinch-to-zoom. For offline use, cache individual PDFs or hit Cache All to download the entire library to your device via IndexedDB.

The My Documents tab lets you upload your own PDFs, JPGs, and PNGs with client-side text extraction for search.

The Aircraft Database has over 200 military and civilian aircraft with search by name, type, manufacturer, or branch. Sort by weight, wingspan, or ACN values. The ACN/PCN comparison panel helps with pavement loading analysis."

---

## VIDEO 20: Training Module

"The Training module has three tabs. Quick Start Guide walks new users through a 7-step onboarding flow. Module Reference has 20 cards — one for each module — with screenshots and descriptions. Base Setup Guide walks through all 15 configuration steps with per-step instructions and tips.

Both the Module Reference and Base Setup Guide export to PDF with embedded screenshots, cover pages, and table of contents."

---

## VIDEO 21: Settings & Base Setup

"Settings is where you manage your profile, appearance, and base configuration.

Your profile shows your name, rank, role, operating initials, and default PDF email. Appearance lets you switch between Day, Night, and Auto themes.

Base Setup is a 15-step guided wizard for configuring your installation. Step 1 is Runways — you can import from ICAO to auto-populate runway data, coordinates, NAVAIDs, and the airfield elevation. Every field is editable after import, and you can fine-tune coordinates on the satellite map.

Steps 2 through 14 cover Areas, Taxiways, NAVAIDs, CE Shops with type mapping, ARFF Vehicles, Facilities, Inspection Templates, Shift Checklist items, QRC Templates, Wildlife Species, Lighting Systems with DAFMAN thresholds, Custom Status Boards with section assignment, and PPR Columns.

Step 15 is Customer Feedback — configure the public form and generate your QR code.

User Management lets admins invite users, assign roles, reset passwords, and manage accounts. When inviting, you can select from the full base directory — all 155 installations — even if they haven't been set up yet."

---

## VIDEO 22: Mobile Experience & PWA

"Glidepath is built mobile-first. Install it to your home screen on iOS or Android and it runs like a native app.

The bottom navigation gives you one-tap access to Status, Dashboard, Obstruction, Events Log, and More. The More page is your module directory organized the same as the sidebar.

Everything adapts across three breakpoints — mobile under 768 pixels, tablet at 768, and desktop at 1024. Touch support includes long-press context menus on maps, pinch-to-zoom on PDFs, and camera capture for photos.

Inspection drafts save to your device on every toggle — navigate away, switch apps, come back, and your progress is right where you left it. Photos upload immediately so they persist across navigation. Regulations can be cached for offline access, and map tiles are cached by the service worker."

---

## VIDEO 23: Admin & Multi-Base Operations

"For administrators — Glidepath supports a role hierarchy from System Admin down through Base Admin, Airfield Manager, NAMO, AMOPS, Controller, CES, and Observer. Each role sees exactly the capabilities they need.

Multi-base access is handled through the installation switcher in the header. System admins see all bases; base-level admins see their own.

User Management lets you invite users with branded emails, approve pending registrations, request additional info, or reject applications — all with Glidepath-branded email templates. Password resets are also branded.

Row Level Security is enforced on all 46 tables in the database — every query is scoped to the user's installation and role. Every significant action is logged with user attribution.

For demonstrations, the demo mode provides instant access via a URL parameter with a pre-configured Demo AFB — no account required."

---

## Production Notes

- Each transcript is approximately 2-4 minutes of speaking at a natural pace
- Pause between sections to show the relevant UI
- Screen-record the actions as you describe them — show, don't just tell
- For mobile segments, use a phone screen recording and briefly demonstrate the same workflow
- Keep energy level consistent — professional but approachable, like you're showing a colleague
