# GLIDEPATH — Airfield Operations Management Platform
## Executive Summary for DAF Digital Transformation Office

---

### THE PROBLEM

Airfield Managers across the DAF manage daily operations using a patchwork of paper logs, Excel spreadsheets, shared drives, and disconnected systems. There is no unified digital platform purpose-built for the airfield management career field. This results in:

- **2+ hours per shift** spent on manual data entry, duplicating information across products
- **No common operating picture** — runway status, discrepancies, and NAVAID health tracked in separate systems
- **No real-time visibility** — leadership and cross-functional teams (CES, Safety, ATC) lack immediate access to airfield status
- **Compliance gaps** — DAFMAN 13-204v2 and UFC 3-260-01 requirements tracked manually with no automated enforcement
- **No standardized toolset** — every base builds their own tracking methods from scratch

---

### THE SOLUTION

**Glidepath** is a mobile-first, responsive web application that consolidates all airfield operations into a single platform. Built by an Airfield Manager (MSgt Christopher Proctor, 127 WG/Selfridge ANGB) to solve real operational problems.

**Key Capabilities:**
- Real-time airfield status dashboard with weather, runway status, NAVAID health, and ARFF readiness
- Digital events log replacing paper AF Form 3616 entries
- Discrepancy tracking with full lifecycle management, CES work order integration, and map-based common operating picture
- Daily inspection checklists (DAFMAN 13-204v2) with photo documentation and auto-generated discrepancies
- UFC 3-260-01 obstruction evaluation tool with instant imaginary surface analysis
- Visual NAVAID infrastructure mapping with DAFMAN outage compliance engine
- Quick Reaction Checklists (25 digitized emergency procedures)
- Aircraft parking plans with UFC wingtip clearance analysis
- Wildlife/BASH tracking with heatmap visualization
- Waiver lifecycle management (AF Form 505)
- PDF/Excel export and email delivery for all reports
- Role-based access control (Airfield Manager, CES, Safety, ATC, Read Only)

**Technical Stack:** Next.js, TypeScript, Supabase (PostgreSQL), Mapbox GL, deployed as a Progressive Web App (PWA) accessible from any device with a browser.

---

### CURRENT STATUS

| Metric | Value |
|--------|-------|
| **Version** | 2.28.0 |
| **Modules** | 20+ operational modules |
| **Routes** | 53 application routes |
| **Database Tables** | 42 |
| **Active Installations** | 2 (Selfridge ANGB, Volk Field Airport) |
| **Pre-loaded Bases** | 155 DAF installations ready for onboarding |
| **Build Status** | Production (clean, zero TypeScript errors) |
| **Operational Since** | March 2026 |

**Measured Impact:** ~2 hours saved per shift in manual data entry, log maintenance, and cross-product updates. Single source of truth eliminates duplication across events logs, discrepancy trackers, work order systems, and status boards.

---

### COMPETITIVE LANDSCAPE

No commercial product covers the full scope of airfield management operations:

| Capability | Glidepath | Aerosimple | Veoci | Civix |
|-----------|-----------|------------|-------|-------|
| Events Log (AF 3616) | Yes | No | Partial | No |
| Discrepancy Tracking | Yes | Partial | Partial | Yes |
| DAFMAN Inspections | Yes | No | No | No |
| Obstruction Evaluation | Yes | No | No | No |
| Visual NAVAID Tracking | Yes | No | No | No |
| QRC Execution | Yes | No | No | No |
| Aircraft Parking Plans | Yes | No | No | No |
| UFC Clearance Analysis | Yes | No | No | No |
| Wildlife/BASH | Yes | Partial | No | No |
| Multi-base Architecture | Yes | Yes | Yes | Yes |
| Military-specific | Yes | No | No | No |

---

### PATH FORWARD

**Intent:** Make Glidepath available to every DAF airfield management section at no cost to the government. The platform is independently owned and developed — no licensing fees, no acquisition required. The developer retains all intellectual property rights.

**Technical Direction:** Platform One's Party Bus program for a continuous ATO (cATO) appears to be the right path for DoD-compliant hosting. Initial research and scaffolding has been started.

**Scaling Readiness:**
- Multi-base architecture with per-installation data isolation already built
- 155 DAF installations pre-loaded with ICAO lookup for automated base configuration
- Self-service user onboarding with role-based access
- New base fully operational in under 1 hour via guided setup wizard

**Seeking Guidance On:**
1. What is the most efficient pathway to make a free, independently-developed tool available across the DAF?
2. Is Platform One Party Bus the right approach for obtaining a cATO, and who should I connect with to begin that process?
3. Who are the right stakeholders in the airfield management mission area (AF/A3, AFCEC, AFIMSC) to engage for enterprise endorsement?
4. Are there other grassroots innovations that have successfully gone this route, and what lessons can be applied?

---

### CONTACT

**MSgt Christopher Proctor**
127th Wing, Selfridge Air National Guard Base, Michigan
info@glidepathops.com | glidepathops.com

---

*Glidepath is built by Airfield Managers, for Airfield Managers. Guiding You to Mission Success.*
