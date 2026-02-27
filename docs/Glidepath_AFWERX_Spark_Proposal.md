# GLIDEPATH — AFWERX Spark Cell Innovation Proposal

**Proposal Title:** Glidepath — Enterprise Airfield Operations Management Suite
**Proposing Unit:** 127th Wing, Selfridge Air National Guard Base, MI (KMTC)
**Proposer:** MSgt Chris Proctor, Airfield Manager (1C7X1), 127th Wing
**Date:** February 2026
**Application Version:** 2.6.0
**Classification:** UNCLASSIFIED // CUI

---

## 1. EXECUTIVE OVERVIEW

### The Problem

Every Airfield Management section across the USAF, ANG, and AFRC operates using paper logs, shared spreadsheets, manual PDF routing, and disconnected tools to manage the airfield — the single most critical piece of infrastructure on any flying installation. When the runway closes, the mission stops. Yet the professionals responsible for monitoring, inspecting, and maintaining that runway track their work the same way they did 20 years ago.

This isn't a minor inconvenience. It creates delayed response times, lost institutional knowledge during PCS cycles, compliance gaps, redundant data entry, zero real-time operational visibility for leadership, and training gaps for new personnel. Every 2–4 year rotation wipes out years of local knowledge because it lives in filing cabinets and personal spreadsheets.

### The Solution

**Glidepath** is a production-ready, mobile-first Progressive Web Application that consolidates every Airfield Management function defined in DAFMAN 13-204 (Volumes 1–3) into a single platform. It is not a concept, prototype, or PowerPoint. It is a working application with 13 modules, 41 routes, 130+ source files, 25+ database tables, and zero TypeScript compilation errors, built and tested by an active Airfield Manager with 18+ years of career field experience.

### The Ask

1. **AFWERX Spark endorsement** as a career-field innovation project
2. **Introduction to Platform One** for enterprise deployment via Party Bus
3. **Guidance on the path** from Spark Cell innovation to program-of-record consideration

Glidepath does not need development funding — it is built. It needs the institutional pathway to get from "one base" to "every base."

---

## 2. THE CAPABILITY

### What Glidepath Does

| Module | What It Replaces | Status |
|--------|-----------------|--------|
| Real-Time Dashboard | Phone calls to AM desk for airfield status | ✅ Built |
| Discrepancy Tracking | Paper logs + emailed spreadsheets | ✅ Built |
| Airfield Checks (7 types) | Clipboard forms (FOD, RSC, RCR, IFE, Ground Emergency, Heavy Aircraft, BASH) | ✅ Built |
| Daily Inspections | Paper checklists printed and scanned | ✅ Built |
| Reports & Analytics (4 types) | Manual report compilation in Word/Excel | ✅ Built |
| Obstruction Evaluations | Hand calculations from printed UFC manuals | ✅ Built |
| Aircraft Database (1,000+ aircraft) | Printed reference binders | ✅ Built |
| Regulations Library (70 refs) | Bookmarked PDFs on personal computers | ✅ Built |
| Waiver Management (AF Form 505) | Filing cabinets + Excel registers | ✅ Built |
| NOTAMs (Live FAA Feed) | Separate FAA website, manual lookup | ✅ Built |
| Activity Log / Audit Trail | "Who remembers what happened?" | ✅ Built |
| User Management | N/A (new capability) | ✅ Built |
| Base Configuration | Hardcoded per-base setup | ✅ Built |

### Key Differentiators

**Built by the warfighter, for the warfighter.** Glidepath was not designed in a conference room by people who have never walked a flightline. Every screen, workflow, and data field was built by an active Airfield Manager who performs these duties on drill weekends and has done so for nearly two decades. The application reflects how the job actually works, not how someone thinks it should work.

**155-base ready today.** The application's multi-base architecture scopes every data table by installation. A built-in directory of 155 U.S. military installations (AFBs, ANGBs, Joint Bases) lets any new base onboard through the admin UI without code changes. Four bases are already seeded with operational data.

**Zero cost to evaluate.** Glidepath runs in demo mode with no server, no credentials, and no setup. Clone the repository, run `npm install && npm run dev`, and the full application loads with mock data. Every module is functional. No infrastructure, no accounts, no configuration required.

**Standards-compliant by design.** Built directly from DAFMAN 13-204 (Vols 1–3), UFC 3-260-01, AF Form 505, and the AFCEC Playbook Appendix B. Inspection checklists, check types, discrepancy workflows, waiver classifications, and obstruction surface criteria all trace to specific regulatory references.

**Modern, maintainable, open-source stack.** Next.js, TypeScript, PostgreSQL, Tailwind CSS — industry-standard tools used by millions of developers. No proprietary dependencies. No vendor lock-in. Any competent web developer can read, maintain, and extend the codebase.

---

## 3. OPERATIONAL IMPACT

### For the Airfield Manager (Installation Level)

- **Single pane of glass** for all AM duties — no more switching between 6+ disconnected systems
- **Instant operational picture** — open the app and see runway status, weather, advisories, NAVAID conditions, and recent activity from any device
- **Audit-ready** — every action logged with user, timestamp, and entity reference; export any report as PDF on demand
- **Waiver management** — replace filing cabinets with a searchable, tracked, exportable register with annual review workflow
- **Obstruction analysis** — UFC 3-260-01 calculations that previously took hours done in seconds with geodesic precision

### For the Career Field Manager (Enterprise Level)

- **Standardization** — every base uses the same platform with per-base customization
- **Visibility** — leadership sees any installation's posture from any device, anywhere
- **Compliance assurance** — inspection deadlines, waiver reviews, and discrepancy aging tracked automatically
- **Training acceleration** — new personnel have a built-in reference library and structured workflows that teach correct procedures
- **Institutional memory** — data survives PCS cycles because it lives in the system, not in someone's head

### Quantifiable Benefits

| Metric | Current State | With Glidepath |
|--------|--------------|----------------|
| Time to compile daily report | 30–60 minutes (manual) | < 5 minutes (auto-generated PDF) |
| Discrepancy response tracking | Spreadsheet, days between updates | Real-time status with audit trail |
| Obstruction evaluation | 1–4 hours (hand calculation) | < 30 seconds (10 surfaces simultaneously) |
| Waiver register maintenance | Hours per month (Excel management) | Automatic with annual review workflow |
| Knowledge transfer at PCS | Weeks of shadowing, still loses data | Full history preserved in database |
| NOTAM awareness | Manual FAA website checks | Auto-fetched live feed on dashboard |
| Leadership visibility | Call the AM desk and ask | Open the app from anywhere |

---

## 4. TECHNOLOGY MATURITY

### Current State (v2.6.0 — February 2026)

Glidepath is not a prototype. The following metrics demonstrate production-level maturity:

| Metric | Value |
|--------|-------|
| Application Routes | 41 |
| Source Files | 130+ |
| Database Tables | 25+ |
| Database Migrations | 49 |
| Version Releases | 17 |
| Development Period | Feb 8 – Feb 27, 2026 (20 days) |
| TypeScript Compilation | 0 errors (strict mode) |
| Modules Complete | 13 of 13 |
| Multi-Base Support | 155 installations |
| Demo Mode | Fully functional offline |

### Technology Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Framework | Next.js 14.2 (App Router) | Industry-standard React framework with SSR |
| Language | TypeScript (strict mode) | Full type safety, zero compile errors |
| Database | Supabase (PostgreSQL) | Managed PostgreSQL with auth, storage, real-time |
| Styling | Tailwind CSS | Utility-first CSS with theme system |
| Maps | Mapbox GL JS | Interactive maps and satellite imagery |
| PDF Export | jsPDF | Browser-based report generation |
| Excel Export | SheetJS | Browser-based spreadsheet generation |
| Offline | IndexedDB + PWA | Full offline reference access |
| Validation | Zod | Schema validation for all forms |

**No proprietary dependencies. No vendor lock-in. All open-source.**

---

## 5. PATH TO ENTERPRISE DEPLOYMENT

### The Platform One Opportunity

Platform One (P1) is the DoD's enterprise DevSecOps platform, trusted by every military branch. Its **Party Bus** PaaS delivers a fully managed environment with continuous ATO (cATO) — enabling operational approval of secure software in as little as 30 days, compared to 1–2 years through traditional ATO processes.

Glidepath is architecturally ready for Platform One. The stack is open-source, containerizable, and already multi-tenant. The application processes no classified data (CUI maximum), simplifying Impact Level decisions.

### Proposed Integration Roadmap

```
CURRENT STATE (Feb 2026)
├── Vercel hosting (commercial cloud)
├── Supabase database (commercial cloud)
├── Email/password authentication
└── Single installation operational (KMTC)
         │
         ▼
PHASE 1: SPARK ENDORSEMENT (Months 1–3)
├── AFWERX Spark Cell recognition
├── Wing-level leadership briefing and endorsement
├── Career Field Manager (CFM) awareness brief
├── Identify AFWERX POC for Platform One introduction
└── Begin pilot testing with 2–3 additional ANG installations
         │
         ▼
PHASE 2: PLATFORM ONE PREPARATION (Months 3–6)
├── Create P1 SSO account and join IL2 group
├── Containerize Glidepath (Next.js → Docker image)
├── Containerize PostgreSQL database layer
├── Prepare Software Bill of Materials (SBOM)
├── Document all external API dependencies
├── Begin Iron Bank Getting Started Form submission
└── Evaluate CAC/PKI authentication via P1 identity services
         │
         ▼
PHASE 3: IRON BANK ONBOARDING (Months 6–9)
├── Submit containers to Iron Bank hardening pipeline
├── Address scan findings (Anchore, Twistlock, OpenSCAP)
├── Achieve passing ABC (Acceptance Baseline Criteria) score
├── Submit justifications/mitigations per ABC timeline
├── Establish continuous monitoring cadence (12-hour scan cycle)
└── Container images available in Iron Bank registry
         │
         ▼
PHASE 4: PARTY BUS DEPLOYMENT (Months 9–12)
├── Request Party Bus onboarding through P1 customer success
├── Deploy to Party Bus managed Kubernetes environment
├── Configure CI/CD pipeline through P1 pre-certified toolchain
├── Complete Certificate to Field (CtF) process
├── Achieve cATO — continuous authorization, no renewal
└── Glidepath available to any DoD installation via P1
         │
         ▼
PHASE 5: ENTERPRISE ROLLOUT (Months 12+)
├── Career Field Manager directive for voluntary adoption
├── Initial rollout to pilot ANG installations
├── Expand to AFRC and active-duty installations
├── Feedback loop drives iterative improvement
├── Data aggregation enables career-field-wide analytics
└── Consideration for program-of-record status
```

### Why Platform One (Not Kessel Run)

Kessel Run is the Air Force's premier software factory, but its mission is specifically focused on Air Operations Center (AOC) command and control systems (AN/USQ-163 Falconer). Kessel Run builds and maintains KRADOS, C2IMERA, and related C2 applications for operational-level air command.

Glidepath solves a different problem at a different level — installation-level airfield management for 1C7X1 personnel. The right enterprise home for Glidepath is **Platform One's Party Bus**, which provides secure hosting infrastructure for any DoD application regardless of mission domain. P1's cATO framework eliminates the need for individual program ATO efforts, and Iron Bank's container hardening ensures Glidepath meets DoD security baselines.

That said, the DevSecOps practices Kessel Run pioneered — agile delivery, continuous deployment, operator-developer integration — are exactly how Glidepath was built. The cultural DNA is the same; the delivery platform is different.

---

## 6. COST ANALYSIS

### Development Cost to Date

| Item | Cost |
|------|------|
| Developer labor | $0 (built by active MSgt on personal time) |
| Vercel hosting | $0 (free Hobby tier) |
| Supabase | $0 (free tier) |
| Mapbox | $0 (free tier, 50K loads/month) |
| Weather/NOTAM/Elevation APIs | $0 (all free, no keys) |
| Domain (glidepathops.com) | ~$12/year |
| **Total development cost** | **~$12** |

### Production Operating Cost (Per Installation)

| Item | Monthly Cost |
|------|-------------|
| Supabase Pro (if commercial cloud) | $25/month |
| Vercel Pro (if commercial cloud) | $20/month |
| Mapbox (free tier covers most bases) | $0 |
| **Total per base (commercial)** | **~$45/month** |

### Platform One Operating Cost

| Item | Cost |
|------|------|
| Party Bus hosting | Covered by P1 infrastructure funding |
| Iron Bank container maintenance | Ongoing (developer time for scan findings) |
| CAC/PKI integration | One-time development effort |
| **Net cost to the Air Force** | **Near-zero marginal cost per installation** |

### Cost Avoidance

The Air Force currently has no enterprise digital solution for Airfield Management. Without Glidepath or an equivalent, the following costs persist at every installation:

- Hundreds of hours annually spent on manual reporting, data entry, and information lookup
- Compliance risk from missed inspections, overdue waivers, and undocumented discrepancies
- Knowledge loss at every PCS rotation (every 2–4 years per installation)
- Redundant "homebrew" solutions at individual bases (multiple units building their own spreadsheets)
- No enterprise visibility into airfield posture across the force

---

## 7. RISK ASSESSMENT

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| P1 onboarding takes longer than 12 months | Medium | Medium | Continue operating on Vercel/Supabase in parallel |
| Iron Bank scan findings require significant remediation | Medium | Low | Open-source stack has strong security posture; no known CVEs |
| CAC/PKI integration complexity | Medium | Medium | P1 identity services provide standard patterns; Supabase Auth abstracts the auth layer |
| Career Field Manager does not endorse | Low | High | Demo mode enables bottom-up adoption; units can evaluate independently |
| Supabase-to-P1-PostgreSQL migration complexity | Low | Medium | Standard PostgreSQL — schema and data migrate directly |
| External API access restricted on DoD networks | Medium | Low | APIs are public/free; can proxy through P1 infrastructure |
| Single developer (bus factor = 1) | High | High | Open-source stack allows any TypeScript developer to contribute; SRS and documentation comprehensive |

---

## 8. WHAT AFWERX SPARK PROVIDES

### What Glidepath Needs from Spark

1. **Formal endorsement** as an AFWERX Spark Cell innovation project
2. **Introduction to Platform One** customer success team for Party Bus onboarding guidance
3. **Career Field Manager visibility** — Spark's network connects innovations to the right decision-makers
4. **Refinery accelerator access** — tools and resources to push through the "frozen middle" between grassroots innovation and institutional adoption
5. **Mentorship** on the transition from Spark project to potential program of record

### What Glidepath Does NOT Need from Spark

- **Development funding** — the application is built
- **Contractor support** — the codebase is maintainable by any web developer
- **Feasibility study** — the application is in use
- **Requirements definition** — the SRS is 1,300+ lines and covers every module

### Spark Cell Alignment

Glidepath embodies the Spark Cell model: a grassroots innovation built by an active-duty operator who identified a problem, prototyped a solution, and iterated to production quality. The Spark mission — *Empowering innovators, Accelerating results* — is exactly what Glidepath needs to cross the gap from "one base innovation" to "enterprise capability."

AFWERX Spark has delivered 250+ impactful projects to Wings and Squadrons. Glidepath is ready to be next — not as an idea that needs development, but as a finished product that needs a deployment pathway.

---

## 9. DEMONSTRATION & EVALUATION

### How to Evaluate Glidepath

**Option 1: Zero-Setup Demo (Recommended)**
```bash
git clone [repository-url]
cd airfield-app
npm install
npm run dev
```
Open `http://localhost:3000` — full application runs in demo mode with mock data. Every module functional. No server, no credentials, no configuration.

**Option 2: Live Instance**
Visit `glidepathops.com` for the production deployment. Contact the developer for demo credentials.

**Option 3: Documentation Review**
- `SRS.md` — Software Requirements Specification (v3.0, 1,300+ lines)
- `GLIDEPATH_CAPABILITIES_BRIEF.md` — Module-by-module capabilities (950 lines)
- `CHANGELOG.md` — Complete version history (725 lines)
- `README.md` — Technical overview and project structure

### Recommended Evaluation Workflow

1. Launch in demo mode (5 minutes to set up)
2. Walk the Dashboard — observe the operational picture
3. Create a discrepancy with a photo and map location
4. Perform a FOD Check
5. Start a daily inspection — toggle items pass/fail
6. Run an obstruction evaluation on the map
7. Export a Daily Operations Summary as PDF
8. Browse the waiver register and export to Excel
9. Open the regulations library and view a cached PDF offline
10. Review the activity log — every action you just took is recorded

---

## 10. PROPOSER BACKGROUND

**MSgt Chris Proctor**
- **AFSC:** 1C7X1 — Airfield Management
- **Current Position:** Airfield Manager, 127th Wing, Selfridge ANGB (KMTC)
- **Experience:** 18+ years in Airfield Management career field
- **Education:** Pursuing M.S. Computer Science (AI/ML focus), Western Governors University
- **Technical:** Next.js, TypeScript, React, PostgreSQL, Python, Microsoft Power Platform
- **Contact:** csproctor88@gmail.com

### Development Approach

Glidepath was built iteratively over 20 days using Claude Code (AI-assisted development) with the developer providing domain expertise, regulatory knowledge, and real-world testing against actual Selfridge ANGB operations. Every module was built, tested, and validated by someone who performs these duties in uniform.

---

## 11. SUMMARY

Glidepath is a finished product seeking a deployment pathway. It consolidates every DAFMAN 13-204 Airfield Management function into a single mobile-first web application that any installation can adopt through configuration alone. The technology is modern, open-source, and architecturally ready for Platform One. The cost to develop was near-zero, and the cost to operate at scale is minimal.

The Air Force does not currently have an enterprise digital solution for Airfield Management. Paper logs, spreadsheets, and filing cabinets remain the standard at installations worldwide. Glidepath changes that — not with a proposal for what could be built, but with a working application that is built.

**The ask is simple: endorse this project, connect it to Platform One, and help it reach the installations that need it.**

---

*Glidepath — "Guiding You to Mission Success"*
*AFWERX Spark Cell Innovation Proposal — February 2026*
*127th Wing, Selfridge Air National Guard Base, Michigan*
