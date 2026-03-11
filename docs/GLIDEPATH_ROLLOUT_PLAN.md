# Glidepath Rollout & Presentation Plan

**Version:** 2.17.0 | **Date:** March 2026

---

## Executive Strategy

Glidepath is a production-ready airfield management platform built by an 18-year airfield management SNCO who knows exactly what the job demands. The rollout strategy is phased: **prove it works at Selfridge**, then **use real data to pitch AFWERX and Platform One**.

### Phase 1: Beta Testing at Selfridge ANGB (Weeks 1–4)
### Phase 2: Documentation & Video Production (Weeks 2–4, overlapping)
### Phase 3: Cold Outreach to Airfield Managers (Weeks 4–8)
### Phase 4: AFWERX Engagement (Week 8+, data-driven)
### Phase 5: Platform One Party Bus Onboarding (Post-AFWERX endorsement)

---

## Phase 1 — Beta Testing at Selfridge ANGB

**Goal:** Generate real operational data, user feedback, and a proof-of-concept story.

### Pre-Test Preparation
- [ ] Provision Selfridge installation in Supabase (runways, areas, CE shops, ARFF aircraft)
- [ ] Create user accounts for 3–5 testers (airfield manager, AMOPS, CES, safety)
- [ ] Upload airfield diagram for Selfridge
- [ ] Seed QRC templates relevant to Selfridge operations
- [ ] Configure shift checklist items per Selfridge SOPs
- [ ] Prepare 1-page quick-start card (print handout)

### Test Execution (2–3 weeks)
- [ ] Conduct live airfield checks (FOD, RSC/RCR) using Glidepath
- [ ] Run at least one daily inspection cycle start-to-finish
- [ ] File 5+ real discrepancies with photos and map pins
- [ ] Execute at least one QRC drill
- [ ] Generate and email Daily Ops Summary PDF
- [ ] Track personnel on airfield for at least 3 duty days
- [ ] Collect structured feedback (usability, missing features, pain points)

### Success Metrics to Capture
- Time saved per check/inspection vs. paper process
- Number of discrepancies tracked (vs. previously untracked)
- User adoption rate (daily active users / total accounts)
- PDF reports generated and distributed
- Qualitative quotes from testers ("This replaced X hours of...")

---

## Phase 2 — Documentation & Video Production

### Deliverables

| Document | Purpose | Audience |
|----------|---------|----------|
| **Capabilities Brief** | Technical + operational overview | AFWERX, leadership, technical evaluators |
| **Beta Tester Guide** | Onboarding walkthrough | Selfridge testers, future beta sites |
| **NotebookLM Overview** | Flagship cinematic video source | All audiences |
| **NotebookLM Capability Docs (7)** | Per-group video sources | Airfield managers, prospective users |

### NotebookLM Video Plan

**Flagship Video: "Glidepath — The Airfield in Your Pocket"** (8–10 min)
- Source: `docs/NotebookLM_Source_Overall.md`
- Covers: Problem, solution, all capabilities at overview level, real-world impact
- Tone: Cinematic, story-driven — "here's what your day looks like with Glidepath"

**Capability Group Videos (5–10 min each):**

| # | Video Title | Source Doc | Modules Covered |
|---|------------|-----------|-----------------|
| 1 | Real-Time Airfield Operations | `NotebookLM_Source_01_Operations.md` | Airfield Status, Dashboard, Weather/Advisories, NAVAID, Personnel Tracking |
| 2 | Checks & Inspections | `NotebookLM_Source_02_Checks_Inspections.md` | 6 Check Types, 4 Inspection Types, ACSI (10 sections), Draft Persistence |
| 3 | Discrepancy Management | `NotebookLM_Source_03_Discrepancies.md` | 11 Issue Types, Status Workflow, KPI Dashboard, Map View, Photo Documentation |
| 4 | Waivers & Compliance | `NotebookLM_Source_04_Waivers_Compliance.md` | Waiver Lifecycle, Annual Reviews, Obstruction Evaluations, Regulations Library |
| 5 | Reports & Analytics | `NotebookLM_Source_05_Reports.md` | Daily Ops Summary, Discrepancy Reports, Trends, Aging Analysis, PDF/Excel/Email |
| 6 | Emergency Response & Safety | `NotebookLM_Source_06_Emergency_Safety.md` | QRCs, SCN Forms, Shift Checklists, NOTAMs, Events Log |
| 7 | Administration & Deployment | `NotebookLM_Source_07_Administration.md` | User Management, Base Setup, Multi-Installation, RLS, PWA, Platform One Readiness |

### Video Production Workflow
1. Feed source document into Google NotebookLM
2. Generate Audio Overview (cinematic narration)
3. Screen-record app walkthrough synced to narration timestamps
4. Add captions and section markers
5. Export as standalone video (MP4) and upload to YouTube (unlisted for sharing)

### Screenshot Library
For each video, capture:
- [ ] Dashboard in operational state (advisories active, runway status set)
- [ ] Check creation flow (photo capture, issue flagging)
- [ ] Inspection with pass/fail items and discrepancy inline
- [ ] Discrepancy detail with photos, map pin, status badge
- [ ] ACSI inspection with sub-field items
- [ ] Obstruction map with surface overlays
- [ ] Daily Ops PDF preview
- [ ] QRC execution in progress
- [ ] Events Log with OI column
- [ ] User Management panel
- [ ] Mobile view (PWA home screen)

---

## Phase 3 — Cold Outreach to Airfield Managers

**Goal:** Get 3–5 additional installations running Glidepath voluntarily.

### Target List
- ANG bases with active 1C7X1 billets (start with bases the developer has contacts at)
- Active Duty bases with known airfield management pain points
- AETC training bases (high check/inspection volume = high value)

### Outreach Package
1. **1-minute elevator pitch email** with link to flagship video
2. **Beta Tester Guide** (self-service onboarding)
3. **Live demo offer** (30-min video call walkthrough)
4. **Free to try** — no cost, no commitment, demo mode available immediately

### Messaging Framework
Lead with **operator pain**, not technology:
- "You're still using paper AF Form 91s and spreadsheets to track discrepancies."
- "When you PCS, your replacement starts from zero."
- "Glidepath is built by a 1C7 for 1C7s — it does what you actually need."

---

## Phase 4 — AFWERX Engagement

**Prerequisite:** Selfridge testing data + at least 2 additional sites expressing interest.

### AFWERX Program Targeting
With AFWERX Spark suspended (Oct 2025), explore:
1. **AFWERX Prime** — if active, for scaling proven solutions
2. **AFWERX Direct** — direct engagement with innovation liaisons
3. **Unit Innovation Fund (UIF)** — base-level funding for tool adoption
4. **Installation innovation offices** — bypass AFWERX if needed, go direct to MAJCOM/A4

### Pitch Deck Contents
1. Problem statement (with Selfridge data: "X hours saved, Y discrepancies caught")
2. Live demo (3 min — create check, file discrepancy, generate report)
3. Flagship cinematic video (8 min)
4. Technical architecture (1 slide: Next.js + Supabase + Mapbox, P1-ready)
5. Cost analysis ($0 development cost, ~$45/mo per base commercial, near-zero on P1)
6. Deployment path (Party Bus onboarding, zero code per new installation)
7. Risk mitigation (RLS, role-based access, audit trail, no PII exposure)
8. Ask: "Introduction to Platform One Party Bus program for cATO pathway"

### Evidence Package
- Selfridge testing results (metrics, screenshots, user quotes)
- Additional site interest letters/emails
- Technical readiness checklist (all items complete)
- Regulatory alignment table (DAFMAN 13-204 Vols 1–3, UFC 3-260-01)

---

## Phase 5 — Platform One Party Bus

**Goal:** Achieve cATO and deploy on DoD enterprise infrastructure.

### Party Bus Requirements (anticipated)
1. **Container packaging** — Dockerize Next.js app
2. **Iron Bank scan** — Container image hardened and approved
3. **SSO integration** — Replace Supabase Auth with Platform One Keycloak
4. **Database migration** — Supabase PostgreSQL → P1 managed PostgreSQL
5. **CI/CD pipeline** — GitLab CI on P1 (replace Vercel)
6. **STIG compliance** — OS and application-level hardening
7. **ATO documentation** — System security plan, privacy impact assessment

### Architecture Advantages for P1
- **No vendor lock-in**: Standard PostgreSQL, standard Next.js
- **Zero-config multi-tenancy**: RLS policies handle all data isolation
- **Stateless frontend**: No server-side session state
- **Standard auth interface**: Swap auth provider without app changes
- **12-factor app compliance**: Environment-driven configuration

---

## Timeline Summary

| Week | Phase 1 (Selfridge) | Phase 2 (Docs/Video) | Phase 3 (Outreach) | Phase 4 (AFWERX) |
|------|--------------------|--------------------|-------------------|-----------------|
| 1 | Setup & onboard | Write all docs | | |
| 2 | Begin testing | NotebookLM videos | | |
| 3 | Active testing | Finalize videos | | |
| 4 | Collect results | Screenshots/polish | Draft outreach emails | |
| 5 | | | Send first wave | |
| 6–8 | | | Follow-up, demos | |
| 8+ | | | | Pitch with data |

---

## File Inventory

```
docs/
├── GLIDEPATH_ROLLOUT_PLAN.md          ← This file (master plan)
├── GLIDEPATH_CAPABILITIES_BRIEF.md     ← Technical + operational overview
├── GLIDEPATH_BETA_TESTER_GUIDE.md      ← User onboarding walkthrough
├── NotebookLM_Source_Overall.md        ← Flagship video source
├── NotebookLM_Source_01_Operations.md  ← Video 1: Real-Time Operations
├── NotebookLM_Source_02_Checks_Inspections.md  ← Video 2: Checks & Inspections
├── NotebookLM_Source_03_Discrepancies.md       ← Video 3: Discrepancy Management
├── NotebookLM_Source_04_Waivers_Compliance.md  ← Video 4: Waivers & Compliance
├── NotebookLM_Source_05_Reports.md             ← Video 5: Reports & Analytics
├── NotebookLM_Source_06_Emergency_Safety.md    ← Video 6: Emergency & Safety
└── NotebookLM_Source_07_Administration.md      ← Video 7: Admin & Deployment
```

---

*Built by MSgt Chris Proctor — 18 years of airfield management, one application.*
