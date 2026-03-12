# Glidepath — The Airfield in Your Pocket

*Source document for Google NotebookLM cinematic video overview*
*Version 2.17.0 | March 2026*

---

## The Problem Every Airfield Manager Knows

There are over 155 Air Force installations with active airfields. Every single one of them runs on paper checklists, Excel spreadsheets, and institutional knowledge that walks out the door every PCS cycle.

An airfield manager's day looks like this: grab a clipboard, drive the runway, write findings on paper, come back inside, submit them into iEMS or TRIRIGA, email it to CE, hope someone reads it, repeat tomorrow. Discrepancies get lost. Inspections get filed in shared drives that are mislabed, get deteleted or don't make any sense. When a new airfield manager arrives, they start from scratch — no history, no context, no continuity.

The 1C7X1 Airfield Management career field is responsible for safe aircraft operations on the ground. They inspect runways, taxiways, and aprons. They track foreign object debris. They monitor lighting, signs, and markings. They evaluate obstructions. They coordinate with Civil Engineering, Safety, and Air Traffic Control. They manage waivers, respond to emergencies, and generate reports for leadership. All of this — across dozens of concurrent responsibilities — still runs on approximately six different Excel Spreadsheets or SharePoint sites.

Nobody has built a tool that does what airfield managers actually need, purposefully built for airfield managers at the forefront. Until now.

---

## What Glidepath Is

Glidepath is a complete airfield management platform built as a Progressive Web App. It runs on any device — phone, tablet, laptop — through a web browser with no installation required. Add it to your home screen and it behaves like a native app.

It was built by MSgt Chris Proctor, an 18-year airfield management SNCO who has lived this job at multiple bases. Every feature exists because he needed it. There are no hypothetical requirements — every screen solves a real problem.

The platform covers 16 operational modules across every core airfield management function: real-time status monitoring, airfield checks, facility inspections, ACSI compliance audits, discrepancy tracking, waiver management, obstruction evaluation, emergency response checklists, shift task management, reporting, NOTAM management, regulations reference, and full administration.

One app. Every airfield function. Available on any device.

---

## A Day with Glidepath

Here's what the same day looks like with Glidepath:

**0600 — Start of shift.** You open Glidepath on your phone. The dashboard shows you the current Bird Watch Condition (MODERATE), active runway (18/36), three active weather advisories, and two NAVAIDs that are out of service. You see that two contractors are currently on the airfield — their company, location, radio callsign, and work description are right there. Your shift checklist for the day shift is already populated — daily items, plus the weekly NAVAID check that's due today.

**0615 — FOD check.** You tap "New FOD Check" and drive the airfield. You find debris on Taxiway Alpha — tap the camera, snap a photo with GPS coordinates embedded, flag it as an issue, and select the location from a dropdown. The check saves as a draft automatically, so if your phone dies or you get interrupted, nothing is lost. Back inside, you complete and file the check. The discrepancy is automatically created, assigned to CE Pavements, and visible to anyone with access.

**0700 — Daily inspection.** You start your airfield inspection. 44 items across 10 sections — every item defaults to "pass," so you only stop to flag failures. You find a lighting outage on Runway 18 approach. Tap "fail," add a discrepancy inline, snap a photo, and keep moving. The inspection auto-saves every change. When you're done, file it — a PDF is generated instantly and you email it to your flight chief from the app.

**0900 — Discrepancy review.** Your flight chief opens Glidepath on their laptop. The discrepancy dashboard shows 12 open items — 3 are aging past 30 days (flagged in amber). They switch to map view and see every open discrepancy pinned on the airfield. They filter by CE Electrical and see the lighting outage you just filed, complete with photo and exact location. They update the status to "Submitted to CES" with one tap.

**1100 — Emergency QRC.** Tower calls — in-flight emergency, aircraft 3 miles out. You pull up the In-Flight Emergency QRC. Step-by-step checklist: notify fire, notify tower, activate SCN. Each step gets checked off in real-time. The Secondary Crash Net form captures all details. When the emergency resolves, you close the QRC and the entire timeline is logged automatically in the Events Log.

**1400 — Report generation.** End of day approaching. You tap Reports → Daily Operations Summary, select today's date, and preview. Every check, inspection, discrepancy filed, and status change from the entire day is consolidated into one PDF. Photos embedded. Timestamps in Zulu. Email it to the squadron with one tap.

**1500 — Shift turnover.** The mid-shift airfield manager opens Glidepath and sees exactly where you left off. Active discrepancies, today's checks, current runway status, personnel on the airfield — complete situational awareness without a single word exchanged.

That's the difference. No paper. No spreadsheets. No lost information. No starting over.

---

## The Capabilities

### Real-Time Airfield Status
The home screen is your common operating picture. Active runway with conditions, Bird Watch Condition, weather advisories (watches, warnings, and advisories), NAVAID status, and personnel on the airfield. Changes push to every connected device in real-time through Supabase Realtime subscriptions. When someone updates the runway condition, everyone sees it instantly.

### Airfield Checks (6 Types)
FOD checks, RSC/RCR runway condition assessments, in-flight emergency checks, ground emergency checks, heavy aircraft checks, and BASH checks. Each check type has a tailored workflow. Photos capture with GPS. Multiple issues can be flagged per check. Drafts persist across devices — start on your phone in the truck, finish on your desktop inside.

### Facility Inspections (4 Types)
Daily airfield inspections (44 items, 10 sections), lighting inspections (34 items, 5 sections), construction meeting inspections, and joint monthly airfield inspections. Default-to-pass logic means you only interact with failures. Discrepancies create inline during inspection. Auto-save prevents data loss. PDF export with photos, weather data, and runway conditions.

### ACSI — Airfield Compliance & Safety Inspection
The Air Force's comprehensive airfield audit per DAFMAN 13-204v2. 10 sections, approximately 100 inspection items covering pavement, clearances, markings, signs, lighting, wind indicators, obstructions, arresting systems, hazards, and local procedures. Multi-team staffing with role assignments. Sub-field evaluations (operable, properly sited, clear of vegetation). Full PDF export with per-item photo documentation.

### Discrepancy Tracking
11 discrepancy types from FOD hazards to NAVAID deficiencies. Every discrepancy has a status lifecycle — submitted, under review, assigned, in progress, completed. KPI dashboard shows metrics by assignee (AFM, CES, AMOPS). Interactive map view pins every open discrepancy on your airfield. Photo documentation with delete capability. Aging analysis flags items past 30 days. Individual and bulk PDF export.

### Waiver Management
Full AF Form 505 equivalent for regulatory deviations. Six waiver types (permanent, temporary, construction, event, extension, amendment). Hazard ratings, criteria sources, coordination tracking. Annual review workflow with per-year recommendations. Map view showing all active waivers on the airfield. Complete status lifecycle from draft through approval to completion or expiration.

### Obstruction Evaluations
Interactive Mapbox map with UFC imaginary surface overlays. Place an object on the map, enter its height, and instantly see which clearance surfaces are violated. Supports Air Force Class B runway geometries. Photo documentation. Results saved with full evaluation details — surfaces checked, violations found, controlling surface identified.

### Quick Reaction Checklists (QRCs)
Template-based emergency response workflows. In-flight emergency, ground emergency, hijack, bomb threat — each with step-by-step checklists. Secondary Crash Net forms for applicable emergencies. Status tracking from activation through completion. 1-year review tracking with overdue alerts. Full activity logging — every QRC activation, step completion, and closure is recorded.

### Shift Checklists
Daily task management per shift. Items configured by frequency (daily, weekly, monthly) and shift assignment (day, mid, swing). Timezone-aware reset logic — configurable per installation. Completion tracking with history view. Ensures nothing falls through the cracks during shift turnover.

### Reports & Analytics
Four report types: Daily Operations Summary (consolidated daily PDF with all checks, inspections, discrepancies, and status changes), Open Discrepancy Report (point-in-time snapshot with aging analysis), Discrepancy Trends (opened vs. closed over time with backlog analysis), and Aging Report (tiered breakdown: 0–7, 8–14, 15–30, 31–60, 61–90, 90+ days). All exportable as PDF. Discrepancy reports also available as Excel.

### Events Log
Complete audit trail of every operational action. Timestamped in Zulu. Operating Initials column for quick identification (tap to reveal full name and role). Manual entry capability with templates. Time-range filtering. Entity linking — tap any log entry to jump to the source record. Export to Excel.

### NOTAMs
Auto-fetch from FAA sources. Filter by active/expired, FAA/local. Search by ICAO identifier. PDF export and email distribution.

### Regulations Library
70+ regulatory references across 19 categories. Full-text PDF viewing in-app. Offline caching via IndexedDB. Bookmark favorites. Upload custom documents. Categories span DAFMAN, FAA, UFC, CFR, DoD, and ICAO publications.

### User Management & Administration
Role-based access (8 roles from read-only to system admin). Row-Level Security on every table — users only see data for their installation. Multi-installation support with instant switching. Base configuration wizard for runways, areas, CE shops, ARFF aircraft, and inspection templates. Operating initials for efficient activity attribution.

---

## Why It Matters

### For the Airfield Manager
- **Hours saved daily.** No more transcribing paper checks into spreadsheets. No more emailing PDFs you manually created. No more rebuilding discrepancy trackers every PCS cycle.
- **Nothing gets lost.** Every check, every inspection, every discrepancy — logged, timestamped, and searchable forever.
- **Complete situational awareness.** Real-time status on any device. Know exactly what's happening on your airfield without being there.
- **Continuity through PCS.** The next airfield manager inherits everything — full history, open discrepancies, active waivers, inspection trends.

### For CE and Support Agencies
- **Instant visibility.** Discrepancies assigned to your shop appear the moment they're filed. No waiting for email. No lost paper.
- **Accountability.** Status tracking shows exactly where every work item stands. Aging analysis highlights what's falling behind.

### For Leadership
- **Data-driven decisions.** Trends analysis shows whether your airfield is getting better or worse. Aging reports reveal systemic backlogs.
- **Audit readiness.** Every action is logged. Every inspection is archived. Pull any record from any date instantly.
- **Standardization.** Same tool, same workflows, same data structure across every installation.

### For the Air Force
- **155 installations, one platform.** Zero code changes required to onboard a new base — just configure runways and create accounts.
- **$0 development cost.** Built on operational experience, not contractor hours.
- **Platform One ready.** Standard Next.js + PostgreSQL architecture. Containerize, scan, deploy. No proprietary dependencies.

---

## The Numbers

- **16 operational modules** covering every core airfield management function
- **48 page routes** across the application
- **36 database tables** with Row-Level Security on every one
- **82 schema migrations** — stable, tested, production-ready
- **11 PDF generators** for checks, inspections, reports, discrepancies, waivers, NOTAMs, and QRCs
- **Real-time updates** via WebSocket subscriptions on 3 core tables
- **6 airfield check types**, **4 inspection types**, **~100 ACSI items**
- **Zero test failures** in production
- **$12 total development cost** (domain registration)
- **~$45/month** per installation on commercial cloud — near-zero on Platform One

---

## What's Next

Glidepath is not a prototype. It's a production application currently being tested at Selfridge ANGB. The path forward:

1. **Validate at Selfridge** — Real operators, real data, real feedback
2. **Expand to additional installations** — Voluntary adoption, zero cost
3. **Engage AFWERX** — Use operational data to demonstrate value
4. **Platform One Party Bus** — Containerize, achieve cATO, deploy enterprise-wide

The airfield management career field has waited decades for a digital solution. Glidepath exists. It works. It's ready.

---

*Built by MSgt Chris Proctor | 1C7X1 Airfield Management | 18 years of service*
*Glidepath v2.17.0 — March 2026*
