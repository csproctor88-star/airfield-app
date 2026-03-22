# Glidepath Slide Deck — Leadership / Executive Audience

**Version**: 2.26.0
**Classification**: UNCLASSIFIED
**Audience**: Wing/Group Commanders, MSG/CC, OG/CC, MAJCOM Staff, Acquisition Officers
**Tone**: Executive briefing. Mission impact, risk reduction, compliance, cost savings, security posture.
**Estimated Slides**: 17

---

## Slide 1: Title

**Title**: Glidepath: Next-Generation Airfield Management Platform
**Subtitle**: Digitizing AF Form compliance and operational readiness.
**Footer**: Version 2.26.0 | UNCLASSIFIED | Progressive Web App

**Speaker Notes**: Sir/Ma'am, Glidepath is a software platform that digitizes every airfield management function currently performed on paper forms, Excel spreadsheets, and whiteboards. It replaces 15+ disconnected manual processes with a single integrated platform built on DoD-aligned cloud infrastructure.

**Visual**: Title card with Glidepath logo, UNCLASSIFIED marking, and version number

**Key Points**:
- Single platform replacing 15+ paper/Excel processes
- 19 integrated modules
- Built for Air Force airfield management operations

---

## Slide 2: Executive Summary

**Title**: Executive Summary

**Speaker Notes**: At its core, Glidepath solves three problems: operational visibility, regulatory compliance, and continuity of operations. Today, airfield managers maintain separate paper logs, Excel trackers, and physical status boards with no integration between them. Glidepath unifies these into a real-time platform accessible from any device, with built-in compliance monitoring against DAFMAN 13-204v2 and UFC 3-260-01.

**Visual**: Three-column summary: Visibility | Compliance | Continuity

**Key Points**:
- Replaces AF Forms 3616, 1168, 505 and 12+ Excel/paper tracking systems
- 19 integrated modules: Status, Dashboard, Inspections, Checks, Discrepancies, Infrastructure, Parking, Obstructions, QRCs, Shift Checklist, Wildlife/BASH, Waivers, NOTAMs, Reports, Analytics, Events Log, Regulations, Settings, User Management
- Multi-base ready with complete data isolation between installations
- Progressive Web App — runs on any device, no app store, no IT installation ticket
- Built on Next.js + TypeScript + Supabase (PostgreSQL) — all open-source components

---

## Slide 3: Mission Impact

**Title**: Mission Impact: Airfield Ops Directly Support Sortie Generation

**Speaker Notes**: Airfield management is a direct enabler of sortie generation. When a lighting outage isn't tracked, a NOTAM isn't published, or a discrepancy sits unresolved, it creates risk to flight operations. Today's paper-based processes introduce delays at every handoff point. Glidepath eliminates those delays by connecting every operational function into a single real-time platform.

**Visual**: Flow diagram: Airfield Readiness → Sortie Generation → Mission Execution. Highlighting failure points in current paper process.

**Key Points**:
- **Delayed discrepancy resolution**: Paper handoffs to CES average days; Glidepath delivers real-time work order visibility
- **Compliance gaps**: DAFMAN 13-204v2 NAVAID outage thresholds tracked manually today; Glidepath monitors automatically with 4-tier alerting
- **Lost institutional knowledge**: PCS cycles wipe operational context; Glidepath retains complete historical data, audit trails, and configuration
- **No real-time COP**: ATC, SOF, AMOps, and the flight chief currently operate from different information; Glidepath provides a single source of truth updated in real time
- **ACSI readiness**: Inspection findings, discrepancy aging, waiver currency — all auditable without manual compilation

---

## Slide 4: Capability Overview

**Title**: Capability Overview: 19 Modules in 6 Functional Areas

**Speaker Notes**: Glidepath organizes 19 modules into six functional areas. Real-Time Operations covers airfield status and the operational dashboard. Inspections and Compliance handles daily inspections, airfield checks, and the annual ACSI checklist. Maintenance and Infrastructure covers discrepancy tracking, CES work orders, and the Visual NAVAID module with DAFMAN outage monitoring. Safety and Emergency includes QRCs, shift checklists, wildlife/BASH, obstruction evaluations, and aircraft parking. Analytics and Reporting provides five report types and a 9-KPI dashboard. Administration covers user management, regulations, settings, and multi-base configuration.

**Visual**: 6-box module map with icons per module

**Key Points**:
- **Real-Time Ops** (2): Airfield Status, Dashboard with KPIs
- **Inspections & Compliance** (3): Daily Inspections (Airfield + Lighting), Airfield Checks (6 types), ACSI Annual Checklist (10 sections, ~100 items)
- **Maintenance & Infrastructure** (3): Discrepancy Tracking, CES Work Orders, Visual NAVAIDs with DAFMAN 13-204v2 compliance engine
- **Safety & Emergency** (5): QRCs (25 checklists), Shift Checklist, Wildlife/BASH, Obstruction Evaluations, Aircraft Parking
- **Analytics & Reporting** (4): Reports Hub (5 types), Analytics Dashboard (9 KPIs), Events Log, NOTAMs
- **Administration** (3): User Management, Regulations Library (70+ references), Settings/Base Configuration

---

## Slide 5: Real-Time Common Operating Picture

**Title**: Real-Time Common Operating Picture

**Speaker Notes**: Every user on the platform — AMOps, ATC, SOF, the flight chief, Safety — sees the same operational picture updated in real time. When runway status changes, all connected devices reflect it within seconds. This is enabled by Supabase Realtime, which provides WebSocket-based live data synchronization on three critical tables: airfield status, airfield checks, and inspections.

**Visual**:

![Airfield Status page](screenshots/S01%20(5).png)

![Dashboard KPI badges](screenshots/S01%20(11).png)

**Key Points**:
- Runway status (Open/Closed/Restricted), weather, RSC/RCR, BWC — single view
- Supabase Realtime: WebSocket sync on airfield_status, airfield_checks, and inspections tables
- Advisory bar for active NOTAMs, construction, and temporary restrictions
- ARFF posture tracking (aircraft availability)
- NAVAID status synced from inspection results and outage reports
- All updates logged to activity log with user attribution and Zulu timestamps

---

## Slide 6: Compliance Automation

**Title**: Compliance Automation: DAFMAN, UFC, and FAA Built Into Workflows

**Speaker Notes**: Compliance monitoring is built into the workflows themselves, not bolted on after the fact. DAFMAN 13-204v2 Table A3.1 outage thresholds are calculated in real time across 23 NAVAID system types. UFC 3-260-01 imaginary surfaces are evaluated automatically for obstruction analysis. ACSI annual inspection items are structured into 10 sections with approximately 100 checklist items, all exportable to PDF. Waiver tracking includes annual review dates with expiration alerts.

**Visual**:

![System Health Panel](screenshots/S01%20(36).png)

![Obstruction evaluation results](screenshots/S01%20(46).png)

**Key Points**:
- **DAFMAN 13-204v2**: Real-time Table A3.1 compliance — 23 system types, 4-tier alerting (green/yellow/red/black), bar-level spatial analysis, consecutive outage detection
- **UFC 3-260-01**: Automated imaginary surface analysis — primary, transitional (7:1), approach/departure (50:1), inner horizontal. Multi-runway evaluation with real elevation data
- **ACSI preparation**: 10-section annual checklist (~100 items) with photo/map attachment, Mark All Y capability, PDF export for inspector packages
- **Waiver tracking**: AF Form 505 lifecycle with 6 classifications, annual review dates, expiration alerts, map visualization
- **Inspection enforcement**: One-per-day hard lock per inspection type with timezone-aware 0600L reset and cross-user duplicate blocking

---

## Slide 7: Discrepancy-to-Resolution Pipeline

**Title**: Discrepancy-to-Resolution: End-to-End Workflow

**Speaker Notes**: The discrepancy pipeline is fully automated from creation to resolution. A failed inspection item, a NAVAID outage report, or a manual entry creates a discrepancy. It's automatically routed to the correct CE shop based on a configurable type-to-shop mapping. CES users see only their work orders in a dedicated interface. Every status transition is logged with user, timestamp, and notes. Aging analytics track how long each discrepancy sits in each status — so you can identify bottleneck shops before your IG team does.

**Visual**: Workflow diagram: Open → Submitted to AFM → Submitted to CES → Awaiting Action → Waiting for Project → Work Completed → Verified/Closed

![Discrepancy list](screenshots/S01%20(26).png)

![CES Work Orders](screenshots/S01%20(32).png)

**Key Points**:
- 5-stage workflow with full audit trail on every transition
- Auto-routing: 11 discrepancy types mapped to CE shops per base configuration
- CES dedicated interface: limited status options (In Work / Project / Work Completed), no admin actions
- Common Operating Picture: map view with color-coded pins on satellite imagery
- Aging analytics: time-in-status tracking per discrepancy, filterable by shop, type, and date range
- NAVAID linking: discrepancies linked to specific infrastructure features for context
- PDF export with embedded photos and Mapbox satellite maps, email delivery via Resend

---

## Slide 8: Infrastructure Digitization

**Title**: Infrastructure Digitization: 1,300+ Features Per Airfield

**Speaker Notes**: A typical military airfield has over 1,300 lights, signs, and NAVAID features. Today, these are tracked on paper status boards or not tracked at all. Glidepath digitizes every feature on satellite imagery with 23 feature types. Each feature has a fixture ID, component assignment, and operational status. When a feature is reported inoperable, the system recalculates system health against DAFMAN thresholds and auto-creates a discrepancy routed to the appropriate CE shop.

**Visual**:

![Infrastructure map](screenshots/S01%20(34).png)

![Health rings on map](screenshots/S01%20(39).png)

**Key Points**:
- 23 feature types: edge lights, approach lights, PAPIs, REILs, taxiway lights, signs, windcones, beacons, and more
- Fixture ID system: auto-generated identifiers (e.g., TWYK-TL-001) for every feature
- One-tap outage reporting → auto-creates discrepancy with structured DAFMAN bar-out notation
- System health visualization with color-coded map rings (yellow = approaching, red = exceeded)
- Bar group management: physical bars linked for aggregate outage analysis
- Import from KML (Google Earth), GeoJSON, or manual GPS placement
- Eliminates manual NAVAID status boards entirely

---

## Slide 9: Risk Reduction

**Title**: Risk Reduction: Automated Safeguards

**Speaker Notes**: Glidepath reduces operational risk through automated enforcement. The one-per-day inspection lock prevents duplicate inspections — if one AMOps troop starts the airfield inspection, no one else can create a second one that day. Cross-user blocking prevents draft conflicts. Every action is logged with user attribution and Zulu timestamps. NAVAID status automatically syncs from inspection results, so a failed lighting inspection item immediately updates the NAVAID status without manual re-entry.

**Visual**: Risk matrix or safeguard icons

**Key Points**:
- **Inspection enforcement**: One airfield + one lighting inspection per day, hard-locked with 0600L timezone-aware reset
- **Cross-user blocking**: Draft isolation prevents two users from creating duplicate inspections
- **Complete audit trail**: Every create, update, delete, and status change logged with user, operating initials, and Zulu timestamp
- **NAVAID sync**: Failed inspection items update infrastructure feature status automatically — no manual re-entry gap
- **Discrepancy linking**: NAVAID outages bidirectionally linked to discrepancies — marking operational prompts closure of linked discrepancy
- **User deletion safety**: 12 FK columns across 10 tables nullified before auth record deletion — no orphaned references

---

## Slide 10: Security & Data Isolation

**Title**: Security Architecture: Row-Level Security on Every Table

**Speaker Notes**: Security is enforced at the database level, not just the application layer. Supabase Row-Level Security policies on all 42+ PostgreSQL tables ensure that even a compromised frontend cannot access unauthorized data. Data isolation between installations is enforced at the database level — there is no application-layer filtering that could be bypassed. Storage policies on the photos bucket enforce the same access controls on uploaded files.

**Visual**: Security architecture diagram showing RLS at database layer

**Key Points**:
- Row-Level Security (RLS) on all 42+ database tables — enforced at PostgreSQL level
- 4 RLS migrations with helper functions: `user_has_base_access()`, `user_can_write()`, `user_is_admin()`
- Multi-base data isolation: no data crosses installation boundaries, enforced at DB level
- Storage RLS on `photos` bucket for uploaded images and documents
- Supabase Auth for authentication — email/password with session management
- No PII exposure: email addresses masked in UI with eye-toggle reveal
- Platform One compatible architecture (see Roadmap slide)

---

## Slide 11: Role-Based Access Control

**Title**: Role-Based Access: 9 Roles, 3 Tiers

**Speaker Notes**: Nine roles organized into three tiers control what each user can see and do. Administrative roles — sys_admin, base_admin, airfield_manager, and NAMO — have full read/write access plus user management and base configuration. The operational role — AMOps — has full read/write access to operational modules without admin functions. Observer roles — CES, Safety, ATC, and Read-Only — have restricted access appropriate to their function. CES is unique: they get a completely different interface optimized for work order execution.

**Visual**: Three-tier table showing roles and permissions

![User management](screenshots/S01%20(77).png)

**Key Points**:
- **Tier 1 — Administrative**: sys_admin (platform-wide), base_admin (base-wide), airfield_manager (full ops + admin), namo (NAMO oversight)
- **Tier 2 — Operational**: amops (full read/write on all operational modules, no admin)
- **Tier 3 — Observer/Specialist**: ces (dedicated work order interface, limited status options), safety (read access + safety modules), atc (read access to status/dashboard), read_only (view only)
- CES role: flat sidebar navigation, limited to CES Work Orders, Discrepancies, Visual NAVAIDs, Settings
- CES status options: In Work, Project, Work Completed only — no create/edit/delete on discrepancies
- Role assignment managed by base_admin and above

---

## Slide 12: Reporting & Analytics

**Title**: Reporting & Analytics: Data-Driven Decision Support

**Speaker Notes**: Glidepath provides five report types and a 9-KPI analytics dashboard. The daily ops summary PDF includes runway status changes, inspection results, active discrepancies, and NAVAID outages — generated automatically. The analytics dashboard tracks 30-day trends for inspections, checks, discrepancies, QRC activations, personnel activity, obstructions, parking plans, and wildlife. Configurable time ranges let you analyze any period. Average response times are calculated from actual timestamps, not self-reported data.

**Visual**:

![Reports hub](screenshots/S01%20(64).png)

![Analytics dashboard](screenshots/S01%20(65).png)

**Key Points**:
- **5 report types**: Daily Ops Summary, Discrepancy Reports (with aging/shop/type filters), Lighting System Health, BASH Monthly, ACSI Preparation
- **9-KPI analytics**: Inspections (split by type), Checks, Discrepancies, QRC activations, Personnel activity, Obstructions, Parking Plans, Wildlife — all with configurable time range
- **Automated metrics**: Inspection avg time (created_at → filed_at), Check avg response time (started_at → completed_at) — filtered to ≥1min to exclude test entries
- **Daily ops PDF**: Includes runway status log, NAVAID outages (color-coded Reported/Resolved), inspection results
- **PDF/Email delivery**: Every report exportable to PDF, emailable directly from the app via Resend SDK
- **Excel export**: Events log and select reports exportable to styled Excel via SheetJS/exceljs

---

## Slide 13: Technology & Deployment

**Title**: Technology Stack & Deployment Architecture

**Speaker Notes**: Glidepath is built on a modern, open-source stack. Next.js with TypeScript provides the frontend and API routes. Supabase — which is built on PostgreSQL — handles authentication, database, real-time sync, and file storage. The application runs as a Progressive Web App, meaning it's accessible from any browser and installable to a device's home screen without an app store. Current hosting costs approximately $50 per month for cloud infrastructure supporting multiple bases.

**Visual**: Architecture diagram: Browser (PWA) → Next.js App Router → Supabase (Auth + PostgreSQL + Realtime + Storage)

**Key Points**:
- **Frontend**: Next.js 14 (App Router) + TypeScript + React — industry-standard web framework
- **Backend**: Supabase (PostgreSQL 15, Auth, Realtime WebSockets, Storage) — open-source Firebase alternative
- **PWA**: Progressive Web App — works on phone/tablet/desktop, installable, offline-capable
- **Maps**: Mapbox GL JS for satellite imagery, infrastructure visualization, and parking plans
- **PDF**: jsPDF + jspdf-autotable for client-side PDF generation with photo/map embedding
- **Email**: Resend SDK for PDF delivery directly from the application
- **No vendor lock-in**: All components are open-source or have open-source alternatives
- **Current hosting**: ~$50/month cloud infrastructure (Vercel + Supabase)

---

## Slide 14: Platform One Roadmap

**Title**: Platform One Integration Roadmap

**Speaker Notes**: For enterprise DAF deployment, Glidepath follows a four-phase Platform One integration path. Phase 1 is containerization with Docker and Helm charts. Phase 2 is Iron Bank hardening for approved container images. Phase 3 is ATO at IL4 or IL5 for CUI data handling. Phase 4 is enterprise rollout through the Platform One marketplace. The open-source stack and stateless application architecture make containerization straightforward.

**Visual**: 4-phase timeline with milestones

**Key Points**:
- **Phase 1 — Containerize**: Docker container + Helm charts for Kubernetes deployment. Stateless Next.js app, Supabase runs as managed PostgreSQL.
- **Phase 2 — Iron Bank Hardening**: Submit container images to Iron Bank for vulnerability scanning and approval. Address STIG compliance findings.
- **Phase 3 — ATO (IL4/IL5)**: Authority to Operate at Impact Level 4 (CUI) or IL5 (mission-critical CUI). RMF package preparation with existing RLS documentation.
- **Phase 4 — Enterprise Rollout**: Publish to Platform One marketplace. Enterprise SSO integration (Keycloak/SAML). Centralized monitoring and logging.
- **Architecture advantages**: Stateless frontend (easy to containerize), PostgreSQL backend (well-understood in DoD), RLS already implemented (security documentation head start)

---

## Slide 15: Cost & Sustainment

**Title**: Cost & Sustainment: Minimal Footprint, Maximum Value

**Speaker Notes**: Glidepath has no per-seat licensing cost. The entire platform runs on approximately $50 per month of cloud infrastructure — that's Vercel for the frontend and Supabase for the database. A single developer can maintain and extend the platform. The open-source stack means there's no vendor lock-in — if the original developer moves on, any web developer familiar with Next.js and PostgreSQL can maintain it. Compare that to enterprise airfield management systems that cost six figures annually with multi-year contracts.

**Visual**: Cost comparison table: Glidepath vs. traditional enterprise software

**Key Points**:
- **No per-seat licensing**: Unlimited users per installation
- **Cloud hosting**: ~$50/month (Vercel + Supabase managed hosting)
- **Sustainment**: Single developer can maintain; TypeScript/React/PostgreSQL are among the most widely-known technologies in software development
- **No vendor lock-in**: All components open-source or have open-source equivalents
- **Comparison**: Enterprise airfield management systems: $100K–$500K+ annually with multi-year contracts, per-seat licensing, and vendor dependency
- **Current codebase**: ~50,000+ lines of TypeScript across 19 modules, fully typed, well-documented

---

## Slide 16: Adoption Path

**Title**: Adoption Path: Operational in One Week

**Speaker Notes**: Getting a base operational on Glidepath takes about one week. Day one is base configuration: runways, areas, CE shops, and type-to-shop mapping — roughly 2-4 hours. Days two through three are infrastructure import — KML files from Google Earth or manual feature placement. Day four is user onboarding — about 30 minutes per user to create accounts, assign roles, and walk through the interface. By day five, your team is running live operations. A demo environment is available immediately at glidepathops.com for evaluation.

**Visual**: 5-day timeline graphic

**Key Points**:
- **Day 1**: Base configuration — runways, areas, timezone, CE shops, type-to-shop mapping (2-4 hours)
- **Day 2-3**: Infrastructure import — KML/GeoJSON from Google Earth or CAD, manual feature placement, airfield diagram upload
- **Day 4**: User onboarding — account creation, role assignment, 30-minute walkthrough per user
- **Day 5**: Live operations — inspections, checks, discrepancy tracking running in production
- **Demo available now**: glidepathops.com/login?demo=true — full feature access with sample data, no account required
- **Support**: Direct developer access during onboarding phase

---

## Slide 17: Q&A / Next Steps

**Title**: Questions & Next Steps

**Speaker Notes**: Sir/Ma'am, Glidepath is operational today and available for base-level pilots. The demo environment is live for immediate evaluation. I'm prepared to set up a base configuration for any installation interested in piloting the platform. Happy to take questions on capability, security, or integration.

**Visual**: Contact card with QR code to demo link

**Key Points**:
- **Live demo**: glidepathops.com/login?demo=true — full feature exploration with sample data
- **POC**: [Name, rank, email, phone — placeholder]
- **Base pilot**: Available for immediate base-level deployment at no cost
- **Timeline**: Operational within 1 week of commitment
- **Next steps**: (1) Evaluate demo environment, (2) Identify pilot base, (3) Schedule configuration session
- **Classification**: UNCLASSIFIED — no CUI in demo environment
