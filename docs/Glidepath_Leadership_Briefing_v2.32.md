# Glidepath — Leadership Briefing

**Version 2.32.0** | April 2026
**Classification:** UNCLASSIFIED | Distribution A
**Prepared for:** Squadron Leadership, Wing Commanders, Acquisition Officers, Operations Group Commanders

---

## 1. Bottom Line Up Front

Glidepath is a fully operational digital replacement for the paper, spreadsheet, and phone-based workflow that defines Airfield Management (1C7X1) operations today. It consolidates 20+ modules into a single web application that runs on any device, enforces regulatory compliance through normal use, and produces complete audit trails with zero additional administrative overhead.

As of v2.32.0, the platform is production-ready for beta deployment across any Total Force installation. It currently runs on commercial cloud infrastructure and is positioned for migration to Platform One (Party Bus) to achieve IL4/IL5 authorization for CUI handling.

**The decision in front of leadership is not whether to digitize airfield management. The DAF has already decided that. The decision is whether to purpose-build it for the career field or continue accepting the time cost of spreadsheet-and-email workflows.**

---

## 2. The Problem

Airfield Management at every Total Force installation today relies on:

- **Paper checklists** for daily airfield inspections, lighting inspections, airfield checks, and shift checklists.
- **Shared Excel files** for discrepancy tracking, waiver registers, personnel logs, and PPR (Prior Permission Required) entries — emailed between stakeholders, with no version control.
- **Phone and radio calls** for runway status, NAVAID outages, advisory conditions, and ARFF readiness — no persistent display that all stakeholders can reference simultaneously.
- **Printed UFC manuals** for obstruction evaluation geometry, with hand calculations.
- **Verbal handoffs** at shift change — critical state information depends on individual memory.
- **Reactive compliance** — ACSI preparation begins 30–60 days before the inspection because the data to support it must be reassembled from scattered sources.

### The direct operational impact

- **Delayed discrepancy resolution** because there is no single routing mechanism and no aging visibility.
- **Inspection gaps** because there is no persistent record of what was inspected or when.
- **Safety risk from communication latency** — pilots, tower, and dispatch do not see condition changes until they are phoned or radioed.
- **Administrative burden on inspectors, AFMs, and NAMOs** — hours per week on paperwork, transcription, and reporting that do not add operational value.
- **Audit vulnerability** — compliance posture depends on paper records that may not survive an ACSI, CI, or Wing inspection.

---

## 3. The Solution

Glidepath collapses the entire Airfield Management workflow into one application.

### What personnel do differently

- **Inspections and checks** are captured on a phone or tablet at the flight line, with photos attached in place. Failed items generate discrepancies automatically. Drafts sync across devices, so a check started on mobile can be filed from a desktop.
- **Runway status, NAVAID outages, ARFF readiness, and advisory conditions** are updated once on the Airfield Status page and propagated to every other device in real time — including tower, dispatch, and leadership displays. No phone tree.
- **Discrepancies route themselves** to the correct Civil Engineering shop based on configurable type-to-shop mapping. CES sees only their work; AFMs and NAMOs see the full picture.
- **Obstruction evaluations** run against every runway imaginary surface from UFC 3-260-01 in seconds, with geodesic calculations from actual runway coordinates. Results produce a NOTAM-ready reference (distance and bearing from threshold) automatically.
- **Parking plans** are built on a to-scale satellite map with 200+ aircraft silhouettes, real-time clearance analysis, and PDF export for distribution to visiting units.
- **Wildlife sightings, strikes, QRC executions, and shift checklists** all capture once and flow to the correct downstream records and reports.
- **ACSI preparation** is continuous. By the time the inspection arrives, the entire year of documentation is already in the system.

### What leadership gets

- **A live operational picture** of the airfield on any device, at any time, from any location.
- **Immediate visibility** of pending discrepancies, aging items, open QRCs, and AFM out-of-office status.
- **30-day analytics** across 9 KPIs — inspections, checks, discrepancies, QRCs, personnel activity, obstructions, parking plans, wildlife events, and customer feedback.
- **Complete audit trail** — every status change, every filed inspection, every discrepancy update is timestamped and attributed.

---

## 4. What Is New in v2.32.0

Between the v2.26 Leadership briefing and v2.32.0, the application has advanced along five axes:

| Axis | Change |
|---|---|
| **Network compatibility** | All 13 interactive maps migrated from Mapbox to Google Maps (v2.31), eliminating the 15+ second freezes caused by WebGL + TLS-inspection latency on Air Force networks. |
| **New operational modules** | PPR Log (v2.31), Customer Feedback with public QR-code form (v2.32), Custom Status Boards (v2.31), Training resource with 51 embedded screenshots and video walkthroughs (v2.29). |
| **Onboarding acceleration** | 15-step Base Setup Wizard with one-click ICAO airport import (runways from FAA survey-grade coordinates), editable runway and installation fields, full 155-base directory for user invites. |
| **Airfield Status overhaul** | Section-based card layout (Runway / NAVAID / ARFF), configurable Custom Status Boards assignable to sections, AFM Out-of-Office banner with Command Post attribution. |
| **Workflow refinement** | Multi-select aircraft in parking plans with box-select and group operations, taxilane point editing, parking plan templates, QRC step type editor, shift checklist N/A toggle, branded transactional email (Resend), Sign Out button everywhere. |

---

## 5. Architecture & Security Posture

### Technology stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (React) — server-rendered PWA |
| Language | TypeScript |
| Database & Auth | Supabase (managed PostgreSQL, JWT sessions, Row-Level Security, real-time subscriptions, storage) |
| Maps | Google Maps JS API (all interactive modules); Mapbox retained only for the Wildlife heatmap |
| PDF Generation | jsPDF + jspdf-autotable (client-side only) |
| Excel Generation | SheetJS + ExcelJS (client-side only) |
| Email | Resend (branded transactional) |
| Weather | Open-Meteo |
| Elevation | Google Elevation API (server-side proxy) |
| NOTAMs | FAA NOTAM API (notams.aim.faa.gov) |

### Security posture

- **Row-Level Security at the database layer** on every operational table. RLS policies execute on every query and are enforced by PostgreSQL itself — not by the application. Even if the application layer were compromised, the database would reject unauthorized queries.
- **Multi-base data isolation** via `base_id` foreign keys on every record and a `base_members` join table referenced on every RLS policy. A user at Installation A cannot see, modify, or detect the existence of Installation B data.
- **Nine user roles** across a three-tier hierarchy. CES users are restricted to work-order status updates (no closure authority), enforcing separation of duties.
- **Server-side admin API** with independent role validation for user CRUD operations.
- **Client-side report generation** — no operational data is transmitted to any third-party rendering service. PDF and Excel files are assembled entirely in the user's browser.
- **Service role key never transmitted to clients.**
- **Audit trail** is immutable and complete. Every status change, inspection, check, discrepancy, and QRC is logged with user attribution and timestamp.

### Known limitations

- Path-based Storage RLS on the photos bucket is a known gap; app-level checks currently suffice.
- No automated test suite yet (tech debt acknowledged; functional testing is manual but thorough).
- Satellite imagery on Google tiles has a ~10–30 ft georegistration offset from surveyed GPS coordinates; a user-facing disclaimer documents this limitation.

---

## 6. Platform One Migration Path

Glidepath's current deployment runs on Vercel (frontend) and Supabase (backend) — both commercial providers. This is acceptable for beta use on unclassified data but is not a long-term DoD deployment target. The Platform One Party Bus is the authorized path to IL4/IL5.

### Four-phase migration

| Phase | Objective | Status |
|---|---|---|
| **1. Containerization** | Package the application for DoD container infrastructure (Docker images, Big Bang–compatible CI/CD, container security scanning) | Design complete; Vite SPA + Express API scaffold exists (`glidepath-local-dev/`). ~6–8 weeks of engineering work. |
| **2. Iron Bank Approval** | Submit container images for Iron Bank scanning, remediate findings, obtain approved container status | Pending Phase 1 completion. |
| **3. IL4/IL5 Deployment** | Migrate PostgreSQL to DoD-authorized hosting, configure IL4/IL5 network security, obtain Authority to Operate (ATO) | Pending Iron Bank approval. |
| **4. Enterprise Rollout** | Multi-region deployment, CAC/PIV integration via DoD identity provider, STIG-compliant monitoring | Post-ATO. |

### Technology alignment with Platform One

- **Next.js / Node.js** — fully supported in P1's container ecosystem.
- **PostgreSQL** — available as a managed service in AWS GovCloud RDS and P1 hosted databases.
- **No proprietary dependencies** — every library is open-source or commercially licensed with DoD-compatible terms.
- **Stateless frontend + managed database backend** maps directly to P1's container orchestration model.

### Interim bridge

While the Platform One path is pursued, Glidepath is fit for use on:

- Personal mobile devices accessing the commercial internet (no CUI).
- Base Ops workstations with internet access.
- Beta installations operating on unclassified airfield management data.

A T-3 waiver is on file for DAFMAN 13-204v2 Para 2.5.2.10.3/10.4 (CAC signature requirement on AF Form 3616). Para 2.5.2.10 explicitly authorizes a "web-based program" as a suitable substitute for the paper form.

---

## 7. Regulatory Alignment

Every module in Glidepath traces to specific regulatory requirements:

| Regulation | Modules |
|---|---|
| **DAFMAN 13-204 Vol 1** | Airfield Status, Events Log, Shift Checklist, User Management |
| **DAFMAN 13-204 Vol 2** | Daily Inspections, Airfield Checks, Discrepancies, Visual NAVAIDs, ACSI |
| **DAFMAN 13-204 Vol 2, Table A3.1** | Visual NAVAIDs (Outage Engine with bar-level analysis and 4-tier alerts) |
| **DAFMAN 13-204 Vol 2, Para 5.4.3** | ACSI Module |
| **DAFMAN 13-204 Vol 3** | NOTAMs, Waivers, PPR Log |
| **UFC 3-260-01** | Obstruction Evaluations, Aircraft Parking Plans, Infrastructure |
| **AFMAN 91-203** | QRC Module, Safety role |
| **DAFMAN 91-212** | Wildlife / BASH Module |
| **AF Form 505 / AF Form 483 / AF Form 3616** | Waivers / Personnel / Events Log |

**Compliance through use** is a core design principle. When an inspector completes a daily inspection in Glidepath, the system automatically generates the required documentation, timestamps, attribution, and audit trail. Compliance is a byproduct of operations, not a separate workstream requiring additional effort.

---

## 8. Deployment Model Options

Three non-exclusive models for fielding Glidepath:

### Option A — Beta with Volunteer Installations

Stand up Glidepath on the current commercial infrastructure for 5–15 volunteer installations (ANG, AFRC, AD). Validate operational fit, collect structured feedback via the Monthly Feedback form, refine the product. Zero financial obligation to the DAF. Provides field-tested evidence to support the Platform One ATO package. **Recommended starting point.**

### Option B — Platform One Party Bus (IL4/IL5)

Pursue P1 onboarding in parallel with beta. ~6–8 weeks of engineering work to containerize. Unknown timeline for Iron Bank approval and ATO. Once authorized, Glidepath is available on DoD-controlled infrastructure and supports CUI handling.

### Option C — Enterprise Licensing

Post-ATO, license Glidepath for enterprise deployment across the DAF airfield management career field. Support, training, and sustainment provided by the Glidepath team under a contract vehicle appropriate to DAF acquisition pathways (SBIR, OTA, or traditional FAR-based).

---

## 9. What Glidepath Is Not

To be direct about scope:

- **Not a tower or dispatch system.** Glidepath is for Airfield Management. It does not replace ATC or command-and-control systems.
- **Not a flight-plan tool.** Flight planning remains in FPS and other authorized systems.
- **Not a NOTAM origination system.** Glidepath consumes the FAA feed and supports local draft creation, but official NOTAM issuance remains through existing channels.
- **Not currently approved for CUI.** ATO work is required before handling any CUI-classified data.
- **Not a financial or personnel system.** Military personnel records beyond contact/credential info are outside scope.

---

## 10. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| **CDW trademark conflict** — "GLIDEPATH" holds a live USPTO Class 42 registration under CDW LLC for SaaS services | Medium | Acceptable for beta and DoD-internal use. Trademark review required before commercial launch; product name change is a feasible fallback. |
| **Platform One ATO timeline uncertain** | Medium | Beta on commercial infrastructure provides value now. ATO is a gating event for CUI handling but not for the full value proposition. |
| **No automated test suite** | Low | Functional testing is manual but comprehensive. Test suite is on the tech-debt roadmap. |
| **Single-developer sustainment risk** | Low–Medium | Codebase is documented, stack is commercially supported, no proprietary dependencies. Sustainment transition plan can be prepared if needed. |
| **Dependency on Supabase as managed provider** | Low | Supabase runs on open-source PostgreSQL. Migration to AWS GovCloud RDS (or equivalent DoD-hosted) is the planned P1 Phase 3 step. |
| **Satellite imagery georegistration offset** | Low | Documented limitation with user-facing disclaimer. Obstruction evaluations use surveyed runway coordinates, not imagery, for calculations. |

---

## 11. Recommended Leadership Actions

1. **Authorize beta participation** for 5–15 volunteer installations. Low-cost, high-information-value. Produces evidence to support P1 onboarding.
2. **Designate a DTO point of contact** for requirements feedback and prioritization.
3. **Initiate Platform One Party Bus sponsorship conversation** with the DAF Chief Digital and AI Office or equivalent authority.
4. **Request a live demonstration** — 30-minute walkthrough covers every module. Demo mode (`?demo=true`) requires no installation, no credentials, and no base data.
5. **Review the T-3 waiver package** (docs/DAF_Form_679_Glidepath_Waiver.md) for Para 2.5.2.10.3 and 2.5.2.10.4. Assessment brief included.

---

## 12. Contact

- **Application:** https://glidepath-airfield-app.vercel.app
- **Demo access:** append `?demo=true` to the login URL
- **Email:** info@glidepathops.com
- **Documentation:**
  - Capabilities Document (full module reference): `docs/Glidepath_Capabilities_v2.32.md`
  - SRS Developer Edition (technical spec): `docs/Glidepath_SRS_v6.0_Developer.md`
  - Beta Access Form and onboarding templates: `docs/Glidepath_Beta_Access_Form.md`
  - T-3 Waiver draft and assessment: `docs/DAF_Form_679_Glidepath_Waiver.md`, `docs/Glidepath_T3_Waiver_Assessment.pdf`
  - Training materials: built into the application at `/training`; narration scripts at `docs/Video_Walkthrough_Script.md`

---

## Appendix A — System at a Glance (v2.32.0)

| Metric | Value |
|---|---|
| Operational Modules | 20+ |
| Application Routes | 55 |
| Source Files | ~225 |
| Database Tables | 46+ |
| Database Migrations | 134+ |
| User Roles | 9 |
| PDF Report Types | 16 |
| Excel Export Types | 4 |
| Aircraft Records | 200+ |
| Regulatory References | 70 |
| Quick Reaction Checklists | 25 |
| Check Types | 7 |
| Infrastructure Feature Types | 23 |
| Base Directory | 155 installations |
| Interactive Maps | 13 (Google Maps throughout; Mapbox retained only for the Wildlife heatmap) |
| Narrated Walkthrough Videos | 23 |

---

## Appendix B — Glossary (Selected)

| Term | Definition |
|---|---|
| **ACSI** | Annual Compliance Safety Inspection — DAFMAN 13-204 Vol 2, Para 5.4.3 |
| **AFM** | Airfield Manager |
| **AMOPS** | Airfield Management Operations |
| **ARFF** | Aircraft Rescue and Firefighting |
| **ATO** | Authority to Operate |
| **BASH** | Bird/Wildlife Aircraft Strike Hazard |
| **CAC / PIV** | Common Access Card / Personal Identity Verification |
| **CES** | Civil Engineering Squadron |
| **CUI** | Controlled Unclassified Information |
| **DAFMAN** | Department of the Air Force Manual |
| **FOD** | Foreign Object Debris |
| **IL4 / IL5** | DoD cloud security Impact Levels for CUI and mission-critical data |
| **NAMO** | NAVAID Maintenance Officer |
| **NAVAID** | Navigational Aid (including airfield lighting) |
| **NOTAM** | Notice to Air Missions |
| **OFA** | Object Free Area |
| **P1 / Party Bus** | Platform One / DoD-authorized container hosting |
| **PPR** | Prior Permission Required |
| **PWA** | Progressive Web Application |
| **QRC** | Quick Reaction Checklist |
| **RLS** | Row-Level Security |
| **SCN** | Secondary Crash Net |
| **STIG** | Security Technical Implementation Guide |
| **UFC** | Unified Facilities Criteria |

---

*This briefing summarizes Glidepath v2.32.0 for leadership evaluation. A 30-minute live demonstration walks through every module and answers detailed questions. Contact info@glidepathops.com to schedule.*
