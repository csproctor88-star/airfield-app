# Glidepath — AFRCWERX A3 Problem-Solving Framework

**Submitted by:** TSgt Chris Proctor, 424th Air Base Squadron, Chièvres Air Base, Belgium
**Date:** 25 March 2026
**Application:** Glidepath v2.27.0 — Airfield Management Platform
**Regulation:** DAFMAN 13-204v2, Airfield Management

---

## Step 1 — Define the Problem

**Problem Statement:**

Department of the Air Force Airfield Management operations across 150+ manned installations depend on paper forms, disconnected Excel spreadsheets, and manual compilation processes to comply with DAFMAN 13-204v2. There is no enterprise airfield management information system. Each installation independently invents its own tracking methods — binders, SharePoint lists, shared drives, and locally-built spreadsheets — resulting in:

1. **No common operating picture.** Runway status, NAVAID outages, open discrepancies, active contractors, weather conditions, and Bird Watch Condition exist in separate systems with no single source of truth. Airfield Managers, Civil Engineers, Safety, ATC, and leadership must make phone calls, send emails, or walk to the operations desk to get current airfield status.

2. **Systemic compliance risk.** DAFMAN 13-204v2 prescribes 174 distinct requirements spanning daily inspections, airfield checks, discrepancy management, obstruction evaluations, NAVAID outage thresholds, wildlife/BASH reporting, waiver lifecycle management, emergency checklists, and annual ACSI compliance inspections. Compliance evidence is scattered across paper forms, photo folders, and spreadsheet tabs that are difficult to audit, easy to lose, and impossible to search.

3. **Pervasive data re-entry.** The same discrepancy is documented in the check form, the discrepancy log, the CE work order request, the Daily Operations Summary, the monthly commander's brief, and the annual ACSI inspection — each time entered from scratch. A single pavement deficiency generates 4-6 separate data entry events across its lifecycle.

4. **Zero institutional memory.** When an Airfield Manager PCS's, the incoming AFM inherits filing cabinets, undocumented spreadsheets, and tribal knowledge. Open discrepancies, waiver expiration dates, NAVAID system configurations, and base-specific procedures must be rediscovered. Effective onboarding takes 2-4 weeks and often results in dropped items.

5. **No data-driven decision support.** Without aggregated data, leadership cannot identify trends — which areas generate the most discrepancies, how long repairs take, whether inspection thoroughness is consistent, or whether staffing levels are adequate for the operational tempo. Manpower justifications rely on anecdotal evidence rather than measured workload data.

**Scope:** All DAF installations with manned airfields — Active Duty, Air National Guard, and Air Force Reserve Command.

**Impact:** Every airfield check, daily inspection, discrepancy, obstruction evaluation, wildlife observation, NAVAID outage, emergency response, and shift turnover touches this problem. For a typical installation, Airfield Management personnel interact with these processes 20-50 times per duty day.

---

## Step 2 — Break Down the Problem

### 2.1 Sub-Problem Analysis

| # | Sub-Problem | Current State | Who It Affects | Frequency |
|---|---|---|---|---|
| 1 | **Daily airfield checks** (RSC/RCR, FOD, BASH, IFE, Ground Emergency, Heavy Aircraft) | Paper forms or local Excel templates. Results communicated verbally, via email, or posted on a whiteboard. No historical trend data. No automatic airfield status update. | AFMs, AMOPS, SOF, Pilots, Tower | 2-6x daily per base |
| 2 | **Discrepancy tracking lifecycle** | Spreadsheet logs with no structured status workflow, no photo evidence linkage, no automatic CE shop routing, no audit trail of status changes | AFMs, CE shops (Electrical, Pavements, Structures), Safety, Leadership | Ongoing — avg 15-40 open discrepancies per base |
| 3 | **ACSI annual compliance inspections** | 100+ item checklist maintained in paper binders. Photos printed and stapled. Discrepancies re-documented from scratch even when already tracked in the discrepancy log. No linkage between ACSI findings and active discrepancy tracker. | AFMs, IG, OG/CC, MSG/CC, WG/CC | Annual per base |
| 4 | **Visual NAVAID outage compliance** | Manual log of inoperative lights. DAFMAN Table A3.1 thresholds (percentage, count, spatial adjacency, bar-level) calculated by hand or not at all. AFMs may not know they have exceeded allowable outage limits until an inspection finding. | AFMs, ATCALS, CE Electrical, Pilots | Continuous — every outage event |
| 5 | **Daily Operations Summary** | Manually compiled each morning from 5+ separate sources: runway status log, weather observations, NOTAM printouts, discrepancy spreadsheet, contractor log, inspection results. Copy-paste assembly takes 45-60 minutes. | AFMs, AMOPS, Leadership, Command Post | Daily |
| 6 | **Obstruction evaluations** | UFC 3-260-01 imaginary surface criteria calculated by hand, if at all. No map visualization. No integration with the waiver process when violations are found. | AFMs, Safety, Airspace Management | As needed (construction, antenna installations, crane operations) |
| 7 | **Wildlife/BASH reporting** | Strike and sighting data in separate paper forms. Weather conditions entered manually. No trend visualization (heatmap, density analysis). BWC changes not linked to supporting sighting data. | AFMs, Safety, BASH team, MAJCOM/A3S | Per event — daily at active BASH installations |
| 8 | **Emergency response (QRC)** | Paper checklists pulled from a binder during emergencies. Execution times not recorded. No automatic activity logging. SCN activation documented manually. | AFMs, AMOPS, Fire Dept, Command Post | Per emergency event |
| 9 | **Shift turnover** | Verbal briefing supplemented by handwritten notes. No standardized task completion tracking. Incoming shift has no visibility into what the outgoing shift completed. | All AMOPS personnel | Every shift change (2-3x daily) |
| 10 | **PCS knowledge transfer** | No standardized system. Incoming AFM discovers open discrepancies, pending waivers, NAVAID configurations, and base-specific procedures through exploration. | Every incoming AFM | Every PCS cycle (~2 years) |
| 11 | **Multi-base visibility** | MAJCOM, NAF, and Wing leadership have no way to see aggregate airfield health across installations without individually contacting each base. | MAJCOM/A3, NAF/CC, WG/CC with multiple airfields | Continuous |

### 2.2 Pareto Analysis

Daily checks, discrepancy tracking, and ACSI preparation account for approximately **80% of AFM administrative burden**. These three areas also carry the highest compliance risk and involve the most duplicated data entry. Addressing them first provides the greatest return on investment.

### 2.3 The Interconnectivity Gap

The most critical issue is not any single sub-problem in isolation — it is that **none of these processes talk to each other**. In the current state:

- A check that finds a pavement deficiency does not automatically create a discrepancy
- A discrepancy submitted to CE does not automatically appear in the Daily Ops Report
- A lighting inspection that discovers INOP NAVAIDs does not automatically update the airfield status board
- An ACSI inspection finding cannot pull in an existing discrepancy's photos, work order number, or status — the inspector re-documents everything
- A QRC execution during an emergency is not automatically logged in the Events Log
- A wildlife sighting that changes BWC from LOW to SEVERE does not automatically notify anyone viewing the airfield status page

Every handoff between these processes is manual, creating delay, data loss, and compliance gaps.

---

## Step 3 — Set Improvement Targets

### 3.1 Efficiency Targets

| Metric | Current Baseline | Target with Glidepath | How Measured |
|---|---|---|---|
| **Time to complete a daily airfield check** | 15-30 min (write on paper + enter in spreadsheet + distribute via email) | < 5 min (mobile entry with GPS pins and photos, auto-filed, auto-logged) | Average `started_at` to `completed_at` timestamp captured automatically in the application |
| **Discrepancy data entry events per deficiency** | 3-4 separate entries (check form → discrepancy log → CE work request → ACSI finding) | 1 entry — created once, linked everywhere automatically | Count of unique manual data entry events per discrepancy across its lifecycle |
| **ACSI preparation time** | 2-4 weeks compiling binders, reprinting photos, re-entering work order numbers | < 1 day — "Link Existing Discrepancy" imports tracked discrepancies with photos, WO#, location, and status directly into ACSI items | Calendar days from ACSI inspection start to filed completion |
| **NAVAID outage compliance determination** | 30+ min manual threshold calculation per outage event | Instant — automated DAFMAN Table A3.1 engine calculates bar-level, percentage, spatial adjacency, and consecutive outages in real time | Time from outage report to compliance status determination |
| **Daily Operations Summary generation** | 45-60 min manual compilation from 5+ sources | < 5 min — one-click PDF generation from live data (runway status, weather, NOTAMs, inspections, checks, discrepancies, outages, contractors) | Time to produce the daily report |
| **AFM PCS onboarding time** | 2-4 weeks to locate and understand predecessor's tracking systems | Day 1 — complete base history, open discrepancies, active waivers, NAVAID configurations, and inspection templates are immediately accessible | Time from account creation to operational familiarity |
| **Shift turnover completeness** | Varies — dependent on verbal briefing quality | 100% task completion visibility via shift checklist with progress tracking, plus Events Log showing every action the outgoing shift performed | Shift checklist completion percentage + Events Log coverage |

### 3.2 Compliance Targets

| Metric | Current Baseline | Target with Glidepath |
|---|---|---|
| **DAFMAN 13-204v2 requirement coverage** | Varies by installation — many requirements tracked informally or not at all | 174/174 requirements digitized, tracked, and auditable (verified via compliance matrix) |
| **Inspection one-per-day enforcement** | Honor system — no technical control prevents duplicate inspections | System-enforced — maximum one airfield and one lighting inspection per calendar day with timezone-aware 0600L reset |
| **Audit trail completeness** | Partial — depends on individual AFM's diligence | 100% — every action (inspection filed, check completed, discrepancy created/updated, QRC executed, status change, NAVAID toggle, contractor logged) automatically recorded in the Events Log with Zulu timestamp and user operating initials |
| **NAVAID outage threshold compliance** | Often unknown until inspection finding | Continuous real-time monitoring with 4-tier alerting (Green/Yellow/Red/Black) and automatic discrepancy creation when outage is reported |

### 3.3 Data and Analytics Targets

| Metric | Current Baseline | Target with Glidepath |
|---|---|---|
| **Inspection completion time analytics** | Not measured | Automatically calculated from `started_at` to `filed_at` timestamps, filterable by inspection type, inspector, and time period. Enables manpower analysis: "Airfield inspections average 47 minutes; lighting inspections average 62 minutes — staffing must account for 2+ hours of inspector time daily." |
| **Check completion time analytics** | Not measured | Automatically calculated from `started_at` to `completed_at`. Broken down by check type. Enables workload justification: "FOD walks average 22 minutes; RSC checks average 8 minutes — total daily check burden is X man-hours." |
| **Discrepancy aging analysis** | Manual count if done at all | Automated aging buckets (0-30, 31-60, 61-90, 90+ days) with drill-down by type, shop, and severity. Enables CE coordination: "12 discrepancies are over 90 days old, 8 assigned to Electrical — this is a resource constraint, not a priority issue." |
| **Wildlife trend analysis** | Paper logs with no visualization | Heatmap on satellite imagery showing sighting/strike density by location. Enables BASH mitigation targeting: "85% of raptor sightings occur within 500m of the RWY 08 threshold between 0600-0900L." |
| **Personnel workload quantification** | Anecdotal | Events Log data enables precise workload measurement: "This month, AMOPS logged 847 events across 3 personnel — 282 events per person per month, or approximately 14 per shift." Supports manpower study justifications with auditable data. |
| **Multi-base benchmarking** | Not possible | MAJCOM-level visibility into inspection rates, discrepancy volumes, resolution times, and NAVAID health across all installations. Enables resource allocation: "Base A resolves discrepancies in 12 days average; Base B takes 45 days — investigate the delta." |

### 3.4 Automation and Interconnectivity Targets

The following automations eliminate the manual handoffs identified in Step 2.3:

| Trigger Event | Automated Result |
|---|---|
| AFM completes an airfield check | Check is filed → airfield status auto-updated (RSC/RCR/BWC) → activity logged in Events Log with Zulu timestamp and user OI → PDF available for export/email |
| AFM marks inspection item as FAIL | Discrepancy panel opens → on filing, discrepancy auto-created in Discrepancy Management with structured description → CE shop auto-assigned via type-to-shop mapping → activity logged |
| AFM files a lighting inspection | All documented NAVAID discrepancies auto-sync to the Airfield Status NAVAID panel → Green/Yellow/Red status reflects actual field conditions → activity logged |
| AFM reports a NAVAID feature as INOP on the infrastructure map | Discrepancy auto-created with structured description (Status/Component/Location + DAFMAN bar-out note if applicable) → outage compliance engine recalculates system health in real time → health ring appears on map |
| AFM marks a NAVAID feature as operational | Prompt to close linked discrepancy with user attribution and Zulu timestamp → system health recalculated → status synced to Airfield Status page |
| AFM opens a QRC during an emergency | "QRC Opened" logged in Events Log → each step completion timestamped → SCN activation logged as "SECONDARY CRASH NET ACTIVATED" → QRC close logged with operator initials |
| AFM updates runway status | Change logged in runway status log with timestamp, previous value, new value, remarks, and user → feeds directly into Daily Ops Report PDF |
| User creates any record (check, inspection, discrepancy, QRC, wildlife entry, status change) | Events Log entry auto-generated with Zulu timestamp, action description, entity link, and user operating initials — no manual logging required |
| ACSI inspector marks item as FAIL | "Link Existing" button available → select from tracked discrepancies → photos, WO#, location pins, description imported automatically → no re-entry |
| New user self-registers | Account created with "Pending" status → appears in admin User Management → admin reviews, sets role, approves or rejects → user notified on next login attempt |

### 3.5 North Star

**An Airfield Manager at any DAF installation can manage 100% of DAFMAN 13-204v2 compliance from a single application, with complete audit trail and data-driven analytics, from day one of arrival — accessible from any device with a web browser.**

---

## Steps 4 & 5 — Post Vector Check

*The following sections are prepared for completion after CI&I Consultant review of Steps 1-3.*

### Step 4 — Determine the Cause of the Problem

**Root Cause (5-Why Analysis):**

1. **Why** do AFMs use paper forms and spreadsheets? → Because there is no purpose-built airfield management application.
2. **Why** is there no purpose-built application? → Because no DAF program of record exists for airfield management software. Existing DoD systems (ACES, IMDS, DPAS) cover maintenance, logistics, and facilities — not DAFMAN 13-204v2 airfield operations.
3. **Why** has no program of record been established? → Because airfield management is a small, specialized career field (1C7X1) without the organizational mass to drive enterprise IT acquisition. Each base solves the problem locally.
4. **Why** do local solutions persist? → Because they work "well enough" for day-to-day operations — until an ACSI finding, an IG inspection, a PCS transition, or an emergency exposes the gaps.
5. **Why** haven't commercial solutions been adopted? → Because (a) no commercial product addresses the full DAFMAN 13-204v2 scope, (b) DoD network restrictions prevent installing unapproved software, and (c) no funding mechanism exists specifically for airfield management digitization.

**Root Cause Summary:** The DAF lacks an enterprise airfield management information system because the requirement falls between existing program boundaries, and the career field is too small to independently drive acquisition. The result is 150+ installations each maintaining ad hoc solutions that fail under stress (ACSI, PCS, emergencies, multi-base oversight).

### Step 5 — Develop Countermeasures

**Countermeasure: Glidepath — Purpose-Built Airfield Management Platform**

| Attribute | Detail |
|---|---|
| **Type** | Progressive Web Application (PWA) — works on any device with a browser, installable to home screen |
| **Current State** | v2.27.0 — production-ready with 45 routes, 170+ API endpoints, 55 database tables, 174/174 DAFMAN requirements covered |
| **Architecture** | React frontend + Express.js API + PostgreSQL + S3 storage + ClamAV virus scanning |
| **Authentication** | Keycloak CAC/SSO (Platform One) or email/password (current) |
| **Hosting Path** | Platform One Party Bus — 14/14 pipeline security checks passing, cATO eligible (~30 days vs 6-18 months traditional ATO) |
| **Impact Level** | IL2 (unclassified) initially, IL4/IL5 upgrade path for CUI airfield data |
| **Cost** | Hosting only — no per-seat licensing. Estimated ~$X/month for IL2 Party Bus hosting |
| **Availability** | Once on Platform One, available to any DAF installation without local IT approval |
| **Multi-Base** | Full multi-base support with data isolation (Row-Level Security), installation switcher, and MAJCOM-level visibility |

**Modules Addressing Each Sub-Problem:**

| Sub-Problem | Glidepath Module | Key Automation |
|---|---|---|
| Daily airfield checks | Airfield Checks (7 types) | Auto-updates airfield status, auto-logs to Events Log, GPS + photos, cross-device draft persistence |
| Discrepancy tracking | Discrepancy Management | Full lifecycle workflow, auto CE shop routing, photo evidence, map view, configurable PDF export |
| ACSI annual inspection | ACSI Module | 100+ items, Link Existing Discrepancy (imports photos/WO#/GPS), Mark All Y, team roster, PDF/Excel export |
| NAVAID outage compliance | Visual NAVAIDs & Infrastructure | 23 system types, DAFMAN Table A3.1 engine, 4-tier alerting, auto-discrepancy creation, health rings on map |
| Daily Ops Report | Reports & Analytics | One-click PDF from live data — all sources auto-compiled |
| Obstruction evaluations | Obstruction Evaluations | UFC 3-260-01 10-surface analysis, Google Elevation API, taxiway clearance envelopes, multi-runway simultaneous evaluation |
| Wildlife/BASH | Wildlife/BASH Module | Sighting/strike forms, species favorites, heatmap, weather auto-fill, BWC history |
| Emergency response | Quick Reaction Checklists | 25 QRC templates, 6 step types, SCN integration, auto Events Log, Dashboard quick-launch |
| Shift turnover | Shift Checklist + Events Log | Per-shift task tracking, progress bar, auto-logged actions with Zulu timestamps and operating initials |
| PCS onboarding | All modules | Day 1 access to complete base history — no filing cabinets to inherit |
| Multi-base visibility | Multi-Base Operations | Installation switcher, analytics dashboard per base, role-based data isolation |

**Implementation Timeline:**

| Phase | Action | Duration |
|---|---|---|
| 1 | AFRCWERX approval + government sponsor identification | 2-4 weeks |
| 2 | Platform One Party Bus onboarding (CST contact, technical fit, funding) | 3-4 weeks |
| 3 | Pipeline review + staging deployment | 2-3 weeks |
| 4 | Certificate to Field (CtF) from Cyber Application Team | 1-2 weeks |
| 5 | Production deployment + first installation onboarding | 1 week |
| 6 | Expansion to additional installations | Rolling — each base needs only account setup + base configuration |
| **Total** | **First base operational** | **~10-14 weeks from approval** |

**Sustainability:** Glidepath is designed for zero-administration operation at each base. Once configured (runways, NAVAIDs, areas, CE shops, inspection templates), daily use requires no IT support. Updates deploy automatically through the Platform One pipeline. New installations are onboarded through in-app Base Setup — no code changes required.

---

## Supporting Documentation

| Document | Location |
|---|---|
| Glidepath Capabilities Document (v2.27.0) | `docs/Glidepath_Capabilities_v2.27.docx` |
| DAFMAN 13-204v2 Compliance Matrix (174 requirements) | `docs/DAFMAN_13-204v2_Compliance_Matrix.md` |
| Platform One Party Bus Onboarding Guide | `docs/Platform_One_Party_Bus_Guide.md` |
| Pipeline Emulation Report (14/14 passing) | `pb-test-drive/reports/pipeline-emulation-report.md` |
| Live Demo | `glidepathops.com/login?demo=true` |

---

*Prepared for AFRCWERX Continuous Improvement and Innovation Consultant review.*
*Glidepath v2.27.0 — Built for the warfighter. Designed for the airfield.*
