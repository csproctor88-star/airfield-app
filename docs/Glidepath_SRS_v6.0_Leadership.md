# GLIDEPATH SOFTWARE REQUIREMENTS SPECIFICATION

## Leadership Edition

| | |
|---|---|
| **Document Title** | Glidepath Software Requirements Specification — Leadership Edition |
| **Version** | 6.0 |
| **Date** | 21 March 2026 |
| **Classification** | UNCLASSIFIED |
| **Distribution Statement** | Distribution A: Approved for public release; distribution is unlimited. |
| **Application Version** | v2.26.0 |
| **Prepared For** | Squadron Leadership, Acquisition Officers, Wing Commanders, Decision Makers |
| **Prepared By** | Glidepath Development Team |

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement & Mission Need](#2-problem-statement--mission-need)
3. [System Overview](#3-system-overview)
4. [Technology Stack](#4-technology-stack)
5. [Module Capabilities](#5-module-capabilities)
6. [Security & Data Isolation](#6-security--data-isolation)
7. [Role-Based Access Control](#7-role-based-access-control)
8. [Regulatory Compliance Mapping](#8-regulatory-compliance-mapping)
9. [Export & Reporting Capabilities](#9-export--reporting-capabilities)
10. [Non-Functional Requirements](#10-non-functional-requirements)
11. [Deployment Strategy & Platform One Path](#11-deployment-strategy--platform-one-path)
12. [Glossary](#12-glossary)

---

## 1. EXECUTIVE SUMMARY

Glidepath is a mission-ready Progressive Web Application (PWA) purpose-built for Department of the Air Force (DAF) airfield management operations. It replaces the fragmented ecosystem of paper logs, shared spreadsheets, manual PDF routing, and phone-based status communication that currently defines the Airfield Management (1C7X1) career field with a single, unified digital platform.

The system directly implements the regulatory requirements of DAFMAN 13-204 Volumes 1 through 3 (Airfield Management), UFC 3-260-01 (Airfield and Heliport Planning and Design), AFMAN 91-203 (Air Force Occupational Safety, Fire, and Health Standards), and DAFMAN 91-212 (Bird/Wildlife Aircraft Strike Hazard). Every module traces to specific regulatory paragraphs, ensuring that daily use of Glidepath constitutes regulatory compliance by design.

As of version 2.26.0 (March 2026), the platform encompasses 19 complete operational modules, supports 9 user roles across a three-tier access hierarchy, enforces row-level data isolation across multiple installations, and provides 16 PDF report generators and 4 Excel exporters for seamless integration with existing reporting chains.

### System at a Glance

| Metric | Value |
|--------|-------|
| Operational Modules | 19 |
| Application Routes | 53 |
| Source Files | 204 |
| Lines of Code | 101,604 |
| Database Tables | 49+ |
| Database Migrations | 121 |
| User Roles | 9 |
| PDF Report Types | 16 |
| Excel Export Types | 4 |
| Aircraft Records | 200+ |
| Regulatory References | 70 |
| Quick Reaction Checklists | 25 |
| Check Types | 7 |
| Infrastructure Feature Types | 23 |

---

## 2. PROBLEM STATEMENT & MISSION NEED

### Current State

Airfield Management operations across USAF, ANG, and AFRC installations rely on a patchwork of manual, disconnected systems that create inefficiency, increase risk, and impede accountability:

**Paper-Based Workflows.** Daily inspections, airfield checks, and shift checklists are recorded on paper logs and clipboards. These records are difficult to search, easy to lose, and impossible to analyze for trends. When inspectors identify discrepancies, the information must be manually transcribed into separate tracking systems.

**Fragmented Digital Tools.** Discrepancy tracking, waiver registers, and equipment inventories live in shared spreadsheets that are emailed between stakeholders. Version control is nonexistent. There is no single source of truth for the current state of an airfield's deficiencies or compliance posture.

**Manual Status Communication.** Runway conditions, NAVAID outages, and advisory status are communicated by phone and radio. There is no persistent, real-time display that all stakeholders can reference simultaneously. When shifts change, critical status information depends on verbal handoffs.

**Disconnected Regulatory References.** UFC manuals are printed and calculations performed by hand for obstruction evaluations. NOTAM information requires navigating separate FAA websites. Compliance with DAFMAN 13-204 inspection schedules is tracked manually.

**No Audit Trail.** Accountability depends on individual memory and paper records. There is no centralized log of who performed what action, when a status changed, or how a discrepancy progressed through its lifecycle.

### Mission Impact

These deficiencies directly affect airfield safety, operational readiness, and regulatory compliance. Delayed discrepancy resolution increases risk to flight operations. Incomplete inspection records create compliance gaps during Annual Compliance Safety Inspections (ACSI). Manual status communication introduces latency that can affect pilot decision-making. The absence of analytics prevents leadership from identifying systemic trends before they become safety incidents.

### How Glidepath Addresses the Need

Glidepath eliminates every gap identified above by providing a single platform that airfield management personnel access from any device with a web browser. Inspections, checks, discrepancies, status boards, and compliance records all flow through one system with complete audit trails, real-time updates, and automated regulatory cross-referencing. The result is faster information flow, stronger accountability, reduced administrative burden, and a continuously auditable compliance posture.

---

## 3. SYSTEM OVERVIEW

Glidepath is a web-based application that runs in any modern browser on phones, tablets, laptops, and desktops. It is designed as a Progressive Web Application, meaning it can be installed on a device's home screen and continue to function with limited connectivity. The system uses a cloud-hosted database with real-time push capabilities, so all users at an installation see the same operational picture simultaneously.

### Architecture Principles

**Multi-Base by Design.** The system supports any number of military installations from a single deployment. Each installation's data is completely isolated through database-level security policies. A user at Installation A cannot see, query, or modify data belonging to Installation B unless they hold explicit membership at both. System administrators can switch between installations they manage without logging out.

**Mobile-First, Device-Agnostic.** The interface is designed for use on mobile devices in field conditions (flight line, taxiway, runway environment) while scaling to full desktop layouts for office use. All core workflows, including photo capture, map interaction, and form completion, are optimized for touch input.

**Real-Time Collaboration.** Critical operational data, including runway status, advisory conditions, and new inspection/check submissions, is pushed to all connected clients in real time. There is no need to refresh or poll for updates.

**Offline Resilience.** The application caches critical reference data (regulations, aircraft database) locally for offline access. Draft inspections and checks can be composed offline and synchronized when connectivity is restored.

### Operational Flow

The typical operational cycle within Glidepath follows this pattern:

1. **Shift Start** — Personnel log in, review the Airfield Status Dashboard for current conditions, and complete the Shift Checklist.
2. **Inspections & Checks** — Daily airfield and lighting inspections are conducted using the mobile interface. Failed items generate discrepancies automatically. Ad-hoc checks (FOD walks, RSC readings, IFE responses) are recorded as they occur.
3. **Discrepancy Management** — New discrepancies route to the appropriate Civil Engineering shop. Status updates, photos, and notes are tracked through the full lifecycle until closure and verification.
4. **Status Updates** — Runway conditions, advisory status, NAVAID outages, and ARFF readiness are updated on the real-time dashboard, instantly visible to all personnel.
5. **Reporting** — Daily operations reports, discrepancy summaries, lighting reports, and analytics are generated on demand or at shift end, exported as PDF, and distributed via email directly from the application.
6. **Compliance** — ACSI checklists, waiver registers, and obstruction evaluations are maintained within the system, providing a persistent, auditable compliance record.

---

## 4. TECHNOLOGY STACK

Glidepath is built on a modern, commercially supported technology stack selected for security, performance, and alignment with Department of Defense cloud migration objectives.

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend Framework** | Next.js (React) | Server-rendered web application with optimized performance and Progressive Web App capabilities |
| **Programming Language** | TypeScript | Strongly typed language that reduces defects and improves maintainability |
| **Database & Authentication** | Supabase (PostgreSQL) | Managed relational database with built-in authentication, row-level security, real-time subscriptions, and file storage |
| **Mapping** | Mapbox GL JS | Interactive satellite and vector maps for infrastructure visualization, obstruction analysis, parking plans, and discrepancy geolocation |
| **PDF Generation** | jsPDF | Client-side PDF creation for all 16 report types, ensuring sensitive data never transits to third-party rendering services |
| **Excel Generation** | SheetJS / ExcelJS | Client-side spreadsheet generation for data export |
| **Email Delivery** | Resend | Transactional email service for PDF report distribution |
| **Weather Data** | Open-Meteo | Automated weather condition retrieval for wildlife reporting |
| **NOTAM Feed** | FAA NOTAM API | Live NOTAM retrieval from the FAA's official data source |

### Key Technology Decisions

**All report generation occurs on the client device.** No operational data is sent to third-party services for rendering. PDF and Excel files are assembled entirely within the user's browser before being downloaded or emailed.

**The database enforces security at the data layer.** Access controls are not merely enforced by the application interface; they are enforced by the database itself. Even if the application layer were bypassed, the database would reject unauthorized queries. This is a fundamental security design principle (defense in depth).

**The entire stack uses commercially supported, widely adopted technologies** with active security patching and large developer ecosystems. There are no proprietary frameworks or single-vendor dependencies that would create sustainment risk.

---

## 5. MODULE CAPABILITIES

### 5.1 Real-Time Operations

#### Airfield Status Dashboard

The Airfield Status Dashboard is the operational nerve center of Glidepath. It provides a single-screen view of current runway status (Open, Closed, Restricted), active advisories, weather conditions, Runway Surface Condition (RSC), Runway Condition Reading (RCR), Braking with Conditions (BWC), NAVAID operational status, ARFF vehicle readiness, and contractor presence on the airfield. All status changes are pushed to every connected device in real time via persistent database subscriptions, eliminating the need for phone calls or radio broadcasts to communicate condition changes.

Status changes are logged with full attribution (who changed what, when, and why) to the Events Log, creating a permanent audit trail. The dashboard also displays the most recent airfield check results and links directly to active discrepancies for situational awareness.

#### Dashboard (KPI & Activity Hub)

The operational dashboard provides key performance indicator badges summarizing recent activity: open discrepancies, checks completed today, pending inspections, and active QRCs. A quick-action panel provides one-tap access to the most common workflows (begin check, start inspection, update status). A live activity feed shows recent system-wide events, and a user presence tracker displays which personnel are currently active in the system.

#### Shift Checklist

The Shift Checklist module provides configurable per-shift task tracking for Day, Mid, and Swing shifts. Base administrators define the checklist items required for each shift. Personnel complete their assigned tasks and mark them done within the application. The checklist resets automatically at 0600 local time (configurable per installation), ensuring each shift starts with a clean task list. Completion status is visible from the dashboard.

### 5.2 Inspections & Checks

#### Airfield Checks

Glidepath supports seven airfield check types: Foreign Object Debris (FOD) Walk, Runway Surface Condition (RSC), Runway Condition Reading (RCR), In-Flight Emergency (IFE) Response, Ground Emergency, Heavy Aircraft Operations, and Bird/Wildlife Aircraft Strike Hazard (BASH). Each check type has a tailored data entry form. Checks support cross-device draft persistence, meaning an inspector can begin a check on a mobile device at the flight line and complete it on a desktop in the operations center. Per-issue photo documentation is supported, with photos linked to specific findings within a check.

Check start times are automatically captured when the inspector selects the check type, providing accurate duration metrics for analytics and reporting. Completed checks appear on the dashboard and feed into the Daily Operations Report.

#### Daily Inspections

The Daily Inspection module implements the combined airfield and lighting inspection required by DAFMAN 13-204. Each inspection is split into two halves (airfield and lighting), each with configurable templates that base administrators tailor to their specific infrastructure. Failed items automatically default to "Pass" status, with inspectors toggling individual items to "Fail" or "Not Applicable," reducing data entry burden.

The system enforces a one-per-day rule: only one airfield inspection and one lighting inspection may be created per calendar day, with the boundary resetting at 0600 local time in the installation's configured timezone. Failed inspection items can generate discrepancies directly, with the discrepancy pre-populated from the inspection context. When lighting inspections identify NAVAID deficiencies, the Visual NAVAID infrastructure map is automatically updated to reflect the outage.

#### ACSI (Annual Compliance Safety Inspection)

The ACSI module digitizes the annual compliance inspection required by DAFMAN 13-204 Volume 2, Paragraph 5.4.3. It provides 10 inspection sections encompassing approximately 100 checklist items, team roster management, and risk management certification. Inspectors can document findings with photos and maps embedded at the item level. The module supports "Mark All Yes" for efficient completion of compliant sections. Results export to both PDF and Excel formats suitable for submission to higher headquarters.

### 5.3 Discrepancy & Work Order Management

#### Discrepancy Management

The Discrepancy Management module provides full lifecycle tracking for airfield deficiencies across 11 discrepancy types. Each discrepancy progresses through a defined workflow: Open, Submitted to AFM, Submitted to CES, Awaiting Action by CES, Waiting for Project, Work Completed Awaiting Verification, and Closed. Photo documentation, map location, priority levels, and detailed notes are captured at every stage.

A configurable type-to-shop mapping allows base administrators to define which Civil Engineering shop is responsible for each discrepancy type, ensuring automatic routing. The Common Operating Picture provides a map-based view of all active discrepancies, giving leadership instant spatial awareness of airfield deficiencies. When discrepancies are linked to Visual NAVAID infrastructure features, the system maintains bidirectional traceability between the discrepancy record and the affected equipment.

#### CES Work Orders

The CES Work Order module provides a dedicated interface for Civil Engineering Squadron personnel. CES users see only the discrepancies assigned to their shops, organized in a tabbed dashboard with key performance indicators (open items, average age, items awaiting action). CES role users have a restricted status palette (In Work, Project, Work Completed) to prevent inadvertent closure of items that require Airfield Management verification. This separation of duties ensures proper oversight of the discrepancy resolution process.

### 5.4 Infrastructure & Compliance

#### Visual NAVAIDs & Infrastructure

The Visual NAVAID and Infrastructure module provides an interactive map of all airfield lighting, signage, and navigation aid equipment. The system supports 23 feature types encompassing runway lights, taxiway lights, approach lighting systems, PAPI/VASI units, signage, wind cones, beacons, and more. Each feature is positioned on a satellite map with its operational status tracked in real time.

The module includes a DAFMAN 13-204 Volume 2 Table A3.1 compliance engine that automatically calculates outage percentages at the system, component, and individual bar level. A four-tier alert system (Green, Yellow, Red, Black) provides instant visibility into which systems are approaching or exceeding regulatory thresholds. Bar-level analysis detects spatial adjacency and consecutive outage patterns that may constitute a reportable condition even when overall system percentages appear acceptable.

Infrastructure data can be imported from KML, CSV, GeoJSON, and DXF files, enabling rapid population from existing Geographic Information System (GIS) records. An Audit Mode supports bulk operations including filter-based component assignment, sequential labeling, fixture ID generation, and bar group management.

#### Obstruction Evaluations

The Obstruction Evaluation module implements the imaginary surface analysis defined in UFC 3-260-01 Chapter 3. Users can evaluate potential obstructions against approach/departure surfaces, transitional surfaces, inner horizontal surfaces, conical surfaces, and outer horizontal surfaces for any runway at their installation. The module performs geodesic calculations using actual runway coordinates and supports multi-runway analysis.

Taxiway Object Free Area and Safety Area clearance envelopes are rendered on the map with FAA (Taxiway Design Group-based) and UFC (Class A/B) standards supported. Elevation data is retrieved from the Google Elevation API when available. Results include a determination of whether an object penetrates any imaginary surface and by what margin.

#### Aircraft Parking Plans

The Aircraft Parking Plans module enables to-scale visualization of aircraft placement on ramp and apron areas. Over 200 aircraft silhouettes are rendered as scaled SVG overlays on the satellite map, maintaining accurate relative dimensions as the user pans, zooms, and rotates the view. Obstacle locations and taxilane envelopes provide UFC 3-260-01 clearance analysis, ensuring planned parking configurations meet safety margins.

Plans are persisted in the database for future reference and can be exported to PDF with the current map view captured at high resolution. PDF reports can be emailed directly from the application for distribution to flight line personnel and visiting unit coordinators.

### 5.5 Safety & Emergency Response

#### Quick Reaction Checklists (QRC)

The QRC module digitizes 25 emergency and contingency checklists used by Airfield Management personnel. Each QRC contains structured steps across six step types, guiding personnel through the correct response sequence during high-stress situations. When an emergency QRC with Secondary Crash Net (SCN) activation is executed, the system generates the SCN form and logs the activation to the Events Log with appropriate verbiage.

Active QRC executions are visible on the dashboard, providing leadership awareness of ongoing emergency responses. Completed QRCs are archived with full step-by-step execution records and timestamps for after-action review.

#### Wildlife/BASH Management

The Wildlife and BASH module supports sighting and strike documentation in compliance with DAFMAN 91-212. Sighting and strike forms auto-populate weather conditions from real-time meteorological data, reducing manual data entry. A heatmap visualization displays strike and sighting density patterns across the airfield, supporting habitat modification and wildlife management decisions.

The species picker supports a favorites system with per-base configuration, enabling rapid selection of commonly observed species. All timestamps use Zulu (UTC) time for consistency with flight operations records.

### 5.6 Administrative & Reference

#### Waivers

The Waiver Management module implements the full AF Form 505 lifecycle for airfield waivers, supporting six classification types and seven status values. Waivers are tracked through initial submission, coordination, approval, and annual review cycles. A map view displays all active waivers geospatially. PDF and Excel exports produce documents suitable for submission to MAJCOM functional managers.

#### NOTAMs

The NOTAM module retrieves live data from the FAA's official NOTAM API (notams.aim.faa.gov), displaying current and upcoming NOTAMs for the installation's airfield identifier. Expiry alerts highlight NOTAMs approaching their effective end date. The module also supports local NOTAM draft creation for internal coordination before official FAA submission.

#### Reports & Analytics

The Reports module provides five report types (Daily Operations, Discrepancy Summary, Lighting Report, Aging Report, and Discrepancy by Type) with configurable filters and time frames. The 30-day Analytics Dashboard presents nine key performance indicators spanning inspections, checks, discrepancies, QRC activations, personnel activity, obstructions, parking plans, and wildlife incidents. Inspection and check average completion times are calculated from database timestamps, providing objective performance metrics.

#### Events Log

The Events Log provides a comprehensive, immutable audit trail of all system activity. Every status change, inspection completion, discrepancy update, and QRC activation is automatically logged with user attribution, timestamp, and contextual details. Manual entries with configurable templates support documentation of events that occur outside the application (phone calls, radio communications, verbal orders). Operating initials provide at-a-glance identification. The complete log is exportable to Excel for integration with external reporting systems.

#### Aircraft Database

The Aircraft Database contains over 200 military and civilian aircraft types with dimensional data, weight classifications, and pavement loading characteristics. The ACN/PCN (Aircraft Classification Number / Pavement Classification Number) comparison tool enables rapid assessment of whether a visiting aircraft's weight is compatible with the installation's pavement strength ratings.

#### Regulations Library

The Regulations Library provides indexed access to 70 regulatory references spanning DAFMAN, UFC, AFMAN, and related publications. Documents are cached locally via IndexedDB for offline access in environments with limited connectivity. A personal "My Documents" tab allows users to bookmark frequently referenced publications for quick retrieval.

---

## 6. SECURITY & DATA ISOLATION

Glidepath implements a defense-in-depth security architecture with access controls enforced at multiple layers. The most critical security boundary is at the database layer, where Row-Level Security (RLS) policies ensure that unauthorized access is impossible regardless of how the system is queried.

### Database-Level Enforcement

Every operational table in the database (49+ tables) has Row-Level Security enabled. RLS policies execute on every query (SELECT, INSERT, UPDATE, DELETE) and are enforced by the database engine itself, not by application logic. This means that even if the application interface, API layer, or network were compromised, the database would independently reject any query that violates the security policy.

Four helper functions implement the access control logic:

| Function | Purpose |
|----------|---------|
| `user_has_base_access()` | Verifies the requesting user holds active membership at the installation whose data is being queried |
| `user_can_write()` | Verifies the user holds a role that permits data modification (excludes read-only observers) |
| `user_is_admin()` | Verifies the user holds an administrative role (sys_admin, base_admin, airfield_manager, or NAMO) |
| `user_is_sys_admin()` | Verifies the user holds the system administrator role with cross-installation access |

### Multi-Base Data Isolation

All operational tables include a `base_id` foreign key that ties every record to a specific installation. User access to an installation is governed by a `base_members` join table that records which users are authorized at which installations and in what role. The RLS policies reference this join table on every query, guaranteeing that:

- A user at Installation A cannot read, modify, or even detect the existence of data belonging to Installation B.
- A user who is removed from an installation's membership immediately loses all access to that installation's data, with no application-level cache or session to clear.
- System administrators with cross-base access must explicitly switch installation context; there is no "see everything" mode that could lead to accidental cross-contamination.

### Authentication & Session Management

User authentication is handled through industry-standard JWT (JSON Web Token) sessions with HTTP-only cookies. Sessions are validated on every request. Password management, account lockout, and session expiration are managed by the authentication platform. The service role key (which bypasses RLS for administrative operations) is stored exclusively on the server side and is never transmitted to or accessible from client devices.

### Server-Side API Validation

Administrative operations (user creation, deletion, role changes, password resets) are processed through server-side API routes that independently validate the requesting user's role before executing the operation. This provides an additional security layer beyond RLS for operations that affect the authentication system itself.

---

## 7. ROLE-BASED ACCESS CONTROL

Glidepath implements nine user roles organized into a three-tier access hierarchy. Each role defines precisely which modules a user can access, whether they can create or modify data, and which administrative functions are available.

### Role Hierarchy

| Tier | Role | Description | Access Level |
|------|------|-------------|--------------|
| **1 — Admin** | System Administrator | Full cross-installation access, user management, system configuration | All modules, all installations |
| **1 — Admin** | Base Administrator | Full access within assigned installation(s) | All modules, assigned installations |
| **1 — Admin** | Airfield Manager | Full operational and administrative access | All modules, assigned installations |
| **1 — Admin** | NAMO | NAVAID Maintenance Officer with administrative privileges | All modules, assigned installations |
| **2 — Operational** | AMOPS | Airfield Management Operations — primary operational role | All operational modules, no admin functions |
| **3 — Observer** | CES | Civil Engineering Squadron — limited to work order management | CES Work Orders, Discrepancies (view only), Visual NAVAIDs, Settings |
| **3 — Observer** | Safety | Safety office personnel — observation and review access | Read access to inspections, checks, discrepancies, reports |
| **3 — Observer** | ATC | Air Traffic Control — situational awareness access | Read access to status, checks, inspections |
| **3 — Observer** | Read Only | View-only access for leadership, inspectors, or liaison personnel | Read access to all modules, no create/edit/delete |

### Access Control Matrix (Summary)

| Capability | Admin Tier | AMOPS | CES | Safety/ATC | Read Only |
|-----------|-----------|-------|-----|-----------|-----------|
| View operational data | Yes | Yes | Limited | Yes | Yes |
| Create inspections/checks | Yes | Yes | No | No | No |
| Manage discrepancies | Yes | Yes | Status only | No | No |
| Update airfield status | Yes | Yes | No | No | No |
| Execute QRCs | Yes | Yes | No | No | No |
| Manage users | Yes | No | No | No | No |
| Configure base settings | Yes | No | No | No | No |
| Switch installations | Sys Admin | No | No | No | No |

### CES Role Restrictions

The CES role warrants specific mention because it implements a separation-of-duties control. CES personnel can update discrepancy status only to "In Work," "Project," or "Work Completed." They cannot close a discrepancy or mark it as verified. This ensures that Airfield Management personnel must independently verify that corrective work meets standards before a deficiency is removed from the active tracking list. CES users see a simplified navigation structure limited to their operational scope.

---

## 8. REGULATORY COMPLIANCE MAPPING

Glidepath's modules are designed to directly implement specific regulatory requirements. The following table maps major system capabilities to their governing publications.

| Regulation | Applicable Modules | Compliance Area |
|-----------|-------------------|-----------------|
| **DAFMAN 13-204 Vol 1** | Airfield Status Dashboard, Events Log, Shift Checklist, User Management | Airfield management operations, personnel duties, shift procedures, status reporting |
| **DAFMAN 13-204 Vol 2** | Daily Inspections, Airfield Checks, Discrepancy Management, Visual NAVAIDs, ACSI | Inspection procedures, check requirements, discrepancy tracking, NAVAID maintenance standards, annual compliance |
| **DAFMAN 13-204 Vol 2, Table A3.1** | Visual NAVAIDs & Infrastructure (Outage Engine) | Minimum lighting system requirements, outage thresholds, reportable conditions |
| **DAFMAN 13-204 Vol 2, Para 5.4.3** | ACSI Module | Annual Compliance Safety Inspection requirements, documentation, certification |
| **DAFMAN 13-204 Vol 3** | NOTAMs, Waivers | NOTAM procedures, waiver management, AF Form 505 |
| **UFC 3-260-01** | Obstruction Evaluations, Aircraft Parking Plans, Infrastructure Map | Imaginary surface criteria, clearance standards, taxiway design groups, pavement classifications |
| **UFC 3-260-01 Ch. 3** | Obstruction Evaluations | Approach/departure surfaces, transitional surfaces, horizontal surfaces, conical surfaces |
| **AFMAN 91-203** | QRC Module, Safety role access | Occupational safety standards, emergency response procedures |
| **DAFMAN 91-212** | Wildlife/BASH Module | Bird/Wildlife Aircraft Strike Hazard program, sighting/strike documentation, habitat management |
| **AF Form 505** | Waiver Management | Waiver request, coordination, approval, and annual review lifecycle |

### Compliance Through Use

A critical design principle of Glidepath is that regulatory compliance is achieved through normal system use, not through additional compliance activities. When an inspector completes a daily inspection in Glidepath, the system automatically generates the required documentation, timestamps, attribution, and audit trail entries. When a NAVAID outage is reported, the system automatically evaluates it against Table A3.1 thresholds. Compliance is a byproduct of operations, not a separate workstream.

---

## 9. EXPORT & REPORTING CAPABILITIES

Glidepath provides extensive export capabilities to ensure operational data can be distributed, archived, and integrated with external systems and reporting chains.

### PDF Reports

The system includes 16 PDF generators that produce formatted, print-ready documents. All PDF generation occurs on the client device; no operational data is transmitted to external rendering services.

| Report Category | PDF Types |
|----------------|-----------|
| **Operations** | Daily Operations Report, Airfield Check Report, Inspection Report |
| **Discrepancies** | Single Discrepancy Report, Discrepancy Summary, Discrepancy by Type, Aging Report, Lighting Report |
| **Compliance** | ACSI Report, Waiver Report, Obstruction Evaluation |
| **Infrastructure** | NAVAID Status Report, Parking Plan |
| **Wildlife** | BASH Sighting Report, BASH Strike Report |
| **Administrative** | Events Log Export |

PDF reports embed photographs, satellite map images, and data tables. Reports that reference geographic features include Mapbox satellite imagery with equipment positions overlaid.

### Excel Exports

Four Excel export types provide structured data for analysis in external tools:

- ACSI inspection results
- Events log records
- Waiver register
- Discrepancy data

### Email Distribution

Any PDF report can be emailed directly from the application to one or more recipients. Each user can configure a default email address for their most common distribution target. The email system uses a dedicated transactional email service with delivery confirmation.

### Analytics Dashboard

The 30-day Analytics Dashboard provides trend visualization across nine key performance indicators, with a configurable lookback period. Metrics include inspection completion rates, average check duration, discrepancy resolution times, QRC activations, personnel activity levels, obstruction evaluations, parking plan generation, and wildlife incidents. Average times are calculated from actual database timestamps (not self-reported durations), providing objective performance data.

---

## 10. NON-FUNCTIONAL REQUIREMENTS

### Performance

| Requirement | Target |
|------------|--------|
| Initial page load | Under 3 seconds on 4G connection |
| Real-time status propagation | Under 2 seconds from change to display on remote devices |
| Map rendering (infrastructure) | Smooth interaction with 1,000+ features |
| PDF generation | Under 10 seconds for reports with embedded photos |
| Search and filter operations | Under 1 second for any dataset |

### Offline Capabilities

The application is designed as a Progressive Web Application with the following offline behaviors:

- **Regulations Library**: All bookmarked regulatory documents are cached locally via IndexedDB and accessible without network connectivity.
- **Aircraft Database**: Full aircraft reference data is available offline after initial load.
- **Draft Persistence**: Inspection and check drafts are saved to local storage, preserving in-progress work through connectivity interruptions.
- **Installable**: The application can be added to a device's home screen and launched as a standalone application without opening a browser.

### Responsive Design

The interface adapts to four device form factors:

| Form Factor | Primary Use Case |
|-------------|-----------------|
| **Mobile Phone** (portrait) | Field inspections, quick status checks, photo capture, QRC execution |
| **Tablet** (portrait/landscape) | Inspections with extended notes, check completion, discrepancy review |
| **Laptop** | Report generation, analytics review, discrepancy management, infrastructure mapping |
| **Desktop** (large display) | Dashboard monitoring, infrastructure audit mode, parking plan creation, multi-window workflows |

All interactive elements meet minimum touch target sizes for gloved-hand operation in field conditions.

### Availability & Data Integrity

- Database backups are managed by the hosting platform with point-in-time recovery.
- All data modifications are transactional; partial writes cannot corrupt the database state.
- Real-time subscriptions automatically reconnect after network interruptions.
- Cross-device draft synchronization prevents data loss when switching between devices.

---

## 11. DEPLOYMENT STRATEGY & PLATFORM ONE PATH

### Current Deployment

Glidepath is currently deployed on Vercel, a commercial cloud platform optimized for Next.js applications. The database is hosted on Supabase's managed PostgreSQL infrastructure. This deployment provides immediate availability, automatic scaling, and zero-downtime deployments while the Platform One integration path is pursued.

### Platform One Integration Path

The migration to Platform One is planned in four phases to ensure continuity of operations throughout the transition.

| Phase | Objective | Key Activities |
|-------|-----------|---------------|
| **Phase 1: Containerization** | Package the application for DoD container infrastructure | Create Docker container images, establish CI/CD pipeline compatible with Platform One's Big Bang framework, validate container security scanning |
| **Phase 2: Iron Bank Approval** | Achieve approved container status in DoD's hardened container repository | Submit container images for Iron Bank scanning, remediate any findings, obtain approval for deployment on DoD networks |
| **Phase 3: IL4/IL5 Deployment** | Deploy to Impact Level 4 or 5 environment for CUI/controlled data | Migrate database to DoD-authorized PostgreSQL hosting, configure network security for IL4/IL5 requirements, obtain Authority to Operate (ATO) |
| **Phase 4: Enterprise Rollout** | Scale to multiple installations on DoD infrastructure | Establish multi-region deployment for resilience, integrate with DoD identity providers (CAC/PIV), configure STIG-compliant monitoring and logging |

### Technology Alignment with Platform One

The technology choices in Glidepath were made with Platform One compatibility as a design consideration:

- **Next.js / Node.js**: Fully supported in Platform One's container ecosystem.
- **PostgreSQL**: Available as a managed service in DoD cloud environments (AWS GovCloud RDS, Platform One's hosted databases).
- **Containerized Architecture**: The application's stateless frontend and managed database backend map directly to Platform One's container orchestration model.
- **No Proprietary Dependencies**: All dependencies are open-source or commercially available with DoD-compatible licensing.

---

## 12. GLOSSARY

| Term | Definition |
|------|-----------|
| **ACSI** | Annual Compliance Safety Inspection — yearly inspection of airfield facilities and procedures per DAFMAN 13-204 Vol 2 |
| **AFM** | Airfield Manager — the individual responsible for airfield management operations at an installation |
| **AMOPS** | Airfield Management Operations — the operational section within an Airfield Management flight |
| **ANG** | Air National Guard |
| **ARFF** | Aircraft Rescue and Firefighting |
| **ATC** | Air Traffic Control |
| **ATO** | Authority to Operate — formal authorization for an information system to operate on a DoD network |
| **BASH** | Bird/Wildlife Aircraft Strike Hazard — the DoD program for reducing wildlife-related aviation hazards |
| **BWC** | Braking with Conditions — reported braking quality on contaminated runway surfaces |
| **CAC** | Common Access Card — DoD smart card used for identification and authentication |
| **CES** | Civil Engineering Squadron — the unit responsible for facility and infrastructure maintenance |
| **CUI** | Controlled Unclassified Information — information requiring safeguarding per DoD policy |
| **DAFMAN** | Department of the Air Force Manual |
| **DoD** | Department of Defense |
| **FOD** | Foreign Object Debris — any object on the airfield that could damage aircraft |
| **GIS** | Geographic Information System |
| **IFE** | In-Flight Emergency |
| **IL4/IL5** | Impact Level 4/5 — DoD cloud security classification levels for CUI and mission-critical data |
| **JWT** | JSON Web Token — an industry standard for secure authentication tokens |
| **KML** | Keyhole Markup Language — XML-based geographic data format used by Google Earth |
| **KPI** | Key Performance Indicator |
| **MAJCOM** | Major Command |
| **NAMO** | NAVAID Maintenance Officer |
| **NAVAID** | Navigational Aid — any visual or electronic device that assists aircraft navigation, including airfield lighting |
| **NOTAM** | Notice to Air Missions — official notice of conditions affecting flight operations |
| **OFA** | Object Free Area — a defined surface surrounding a runway or taxiway that must be clear of objects |
| **PAPI** | Precision Approach Path Indicator — a visual approach slope aid |
| **PCN/ACN** | Pavement Classification Number / Aircraft Classification Number — pavement strength rating system |
| **PIV** | Personal Identity Verification — federal smart card standard |
| **PWA** | Progressive Web Application — a web application that can be installed and used like a native application |
| **QRC** | Quick Reaction Checklist — standardized emergency/contingency response procedures |
| **RCR** | Runway Condition Reading — numerical assessment of runway surface friction |
| **RLS** | Row-Level Security — database feature that restricts data access at the individual row level |
| **RSC** | Runway Surface Condition — reported condition of the runway surface |
| **SCN** | Secondary Crash Net — emergency notification network activated during aircraft emergencies |
| **STIG** | Security Technical Implementation Guide — DoD configuration standards for information systems |
| **SVG** | Scalable Vector Graphics — image format used for resolution-independent aircraft silhouettes |
| **TDG** | Taxiway Design Group — FAA classification system for taxiway geometry based on aircraft characteristics |
| **UFC** | Unified Facilities Criteria — DoD construction and design standards |
| **USAF** | United States Air Force |
| **VASI** | Visual Approach Slope Indicator — a visual approach aid system |

---

*This document describes the capabilities and architecture of Glidepath v2.26.0 as of 21 March 2026. For the detailed technical specification including database schemas, API contracts, and implementation details, refer to the Glidepath SRS v5.0 (Engineering Edition).*
