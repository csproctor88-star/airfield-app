# Glidepath Capability Deep Dive: Waivers, Obstructions & Compliance

*Source document for Google NotebookLM capability video*
*Version 2.17.0 | March 2026*

---

## What This Covers

This document covers Glidepath's compliance management modules — waiver lifecycle management, obstruction evaluation, and the regulations library. These are the tools that keep an airfield legally and operationally compliant with Air Force and DoD standards.

---

## Waiver Management — AF Form 505 Digitized

### The Problem
Every airfield has deviations from published criteria. A taxiway shoulder might be narrower than UFC standards require. A building might be inside a clear zone. A NAVAID might not meet siting requirements. Each of these requires a formal waiver — traditionally an AF Form 505 processed through multiple coordination offices, filed in a binder, and reviewed annually.

The manual process is slow, error-prone, and fragile. Waivers get lost during PCS. Annual reviews are missed because there's no automated reminder. Coordination status is tracked via email chains that nobody can reconstruct.

### Glidepath's Approach
Glidepath provides a complete digital waiver lifecycle:

### Six Waiver Types
1. **Permanent** — Long-standing deviations unlikely to change
2. **Temporary** — Time-limited deviations with an expiration date
3. **Construction** — Deviations specifically during construction projects
4. **Event** — Short-duration deviations for airfield events
5. **Extension** — Extensions of existing temporary waivers
6. **Amendment** — Modifications to existing active waivers

### Creating a Waiver
1. **Select type** and enter the deviation description
2. **Identify the criteria source** — UFC 3-260-01, UFC 3-260-04, UFC 3-535-01, or Other
3. **Describe the specific criteria** being waived (section/paragraph reference)
4. **Assess hazard rating** — Low, Medium, High, or Extremely High
5. **Set effective dates** — start and end dates for temporary waivers
6. **Identify coordination offices** — BCE, AFM, Airfield Ops, Base Safety, Command, Other
7. **Pin location on map** — Mapbox satellite view to mark the exact location of the deviation
8. **Upload attachments** — supporting documentation, diagrams, photos (images auto-resized on upload)
9. **Add notes** — operational impact, mitigation measures, history

### Status Lifecycle
```
DRAFT → PENDING → APPROVED → ACTIVE → COMPLETED
                                     → EXPIRED
                                     → CANCELLED
```

Each status change is logged in the Events Log with operator attribution and Zulu timestamp.

### Annual Review Workflow
DAFMAN requires annual review of all active waivers. Glidepath provides:
- **Year-based review interface** — select fiscal year, see all waivers due for review
- **Per-waiver review** — each waiver gets an individual review with:
  - Review date recorded
  - Recommendation: Retain, Modify, Cancel, Convert to Temporary, Convert to Permanent
  - Notes on changes since last review
  - Reviewer identification
- **Overdue tracking** — waivers past their annual review date are flagged

### View Modes
- **List view** — filterable by status, type, and hazard rating
- **Map view** — all active waivers pinned on satellite imagery with color-coded markers
- **Collapsible legend** — toggle the map legend to see marker meanings

### PDF & Excel Export
- Individual waiver PDFs with all fields, attachments, and map thumbnail
- Bulk waiver export as Excel spreadsheet for reporting

---

## Obstruction Evaluations — UFC Surface Analysis

### The Problem
When a new structure, crane, tree, or temporary object appears near an airfield, someone must evaluate whether it violates any of the imaginary surfaces defined in UFC 3-260-01. This evaluation requires understanding primary surfaces, approach/departure surfaces, transitional surfaces, and inner horizontal surfaces — each with specific dimensions based on runway classification.

Traditionally this requires coordination with CES to provide specialized GIS tools that most airfield managers don't have access to. The evaluation takes time, is error-prone, and often requires sending the question to TERPS or CE and waiting for an answer.

### Glidepath's Approach
Glidepath provides an interactive map-based obstruction evaluation tool that gives instant results.

### How It Works
1. **Open the Obstruction Evaluator** — Mapbox satellite view of your airfield with runway overlays
2. **Place the object** — Tap the map or enter latitude/longitude coordinates
3. **Enter object height** (AGL) — how tall is the object above ground level
4. **Automatic calculations** — Glidepath instantly evaluates the object against all applicable UFC imaginary surfaces:
   - Primary Surface
   - Approach/Departure Surface (clear zone, approach zone, transitional)
   - Inner Horizontal Surface
   - Conical Surface
   - Outer Horizontal Surface
   - Transitional Surface
5. **Results display** — each surface shows whether the object penetrates it, by how much, and what the allowable height is at that location
6. **Violation detection** — if any surface is violated, it's highlighted immediately
7. **Controlling surface** — identifies which surface is most restrictive at that location

### Supported Runway Classes
- **Class B** — Standard Air Force runways
- **Army Class B** — Army airfield criteria

### Documentation
Each evaluation can be saved with:
- Object description and coordinates
- Height (AGL) and elevation (MSL)
- Distance from runway and centerline
- Photos of the object
- Full evaluation results
- Violated surfaces identified
- Notes and recommendations

### Evaluation History
All saved evaluations are listed with their results. Violations are clearly marked. Historical evaluations provide a record of every obstruction analysis performed — essential for audit trails and recurring evaluations (e.g., seasonal tree growth).

---

## Regulations Library — Every Reference at Your Fingertips

### The Problem
Airfield managers reference dozens of publications daily: DAFMAN 13-204 (three volumes), UFC 3-260-01, UFC 3-535-01, FAA Advisory Circulars, CFRs, DoD Instructions, ICAO standards. These documents are scattered across e-Publishing, the UFC website, FAA.gov, and local SharePoint sites. Finding the right reference at the right time — especially in the field on a phone — is painful.

### Glidepath's Approach
A centralized, searchable, offline-capable regulations library built into the app.

### Content
- **70+ regulatory references** across 19 categories
- **Publication types:** DAF, FAA, UFC, CFR, DoD, ICAO
- **Categories:** Airfield Operations, Airfield Management, ATC, Airfield Design, Pavement, Lighting/NAVAIDs, Safety, BASH/Wildlife, Driving, Emergency, Publications, Personnel, Construction, Fueling, Security, International, NOTAMs, UAS, Contingency

### Features
- **Full-text PDF viewing** — open any regulation directly in the app using PDF.js
- **Offline caching** — download regulations to IndexedDB for access without internet
- **Favorites/bookmarks** — mark frequently referenced publications for quick access
- **Category color-coding** — visual organization by topic area
- **Search and filter** — find publications by title, number, or category
- **User uploads** — add your own documents (local SOPs, base supplements, etc.)
- **Download management** — see storage usage, manage cached documents

### Why It Matters
Having every reference in one place — searchable, cached, accessible on your phone in the field — eliminates the "I'll look that up when I get back to my desk" delay. When a contractor asks about a setback requirement, you pull up UFC 3-260-01 on your phone and answer on the spot.

---

## How These Modules Work Together

Compliance modules in Glidepath interconnect:

- **Obstruction found during inspection** → Create obstruction evaluation → Document violation → Create waiver if needed → Reference UFC criteria in Regulations Library
- **Waiver annual review** → Reference original criteria → Check if conditions have changed → Update or cancel waiver → Log in Events Log
- **ACSI finding on obstruction clearances** → Cross-reference with obstruction evaluation history → Verify waiver coverage → Document in inspection results

This integrated workflow eliminates the manual cross-referencing that currently requires opening multiple systems, binders, and documents to connect related compliance information.

---

## Real-World Impact

### Before Glidepath
- Waivers filed in binders, lost during PCS
- Annual reviews missed — no automated tracking
- Obstruction evaluations require TERPS support or manual calculation
- Regulations scattered across 5+ websites
- No map visualization of waiver locations or obstruction positions
- Compliance documentation takes hours to compile

### With Glidepath
- Waivers digitally managed with full lifecycle tracking
- Annual review deadlines automatically tracked
- Obstruction evaluations completed in minutes with instant results
- All regulations in one app, available offline
- Map views show spatial context for waivers and obstructions
- Compliance records are always current, always accessible

---

*Glidepath v2.17.0 — Compliance management that works like you work*
