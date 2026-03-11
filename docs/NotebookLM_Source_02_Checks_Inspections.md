# Glidepath Capability Deep Dive: Checks & Inspections

*Source document for Google NotebookLM capability video*
*Version 2.17.0 | March 2026*

---

## What This Covers

This document covers Glidepath's check and inspection modules — the daily, weekly, and periodic evaluations that keep an airfield safe and compliant. This includes 6 airfield check types, 4 inspection types, and the comprehensive ACSI audit.

---

## Airfield Checks — Quick, Focused Evaluations

Airfield checks are the rapid assessments airfield managers perform throughout the day. Glidepath supports 6 check types, each with a tailored workflow.

### FOD Check (Foreign Object Debris)
The most frequent check type. Drive the airfield, identify foreign objects that could damage aircraft, document what you find. In Glidepath:
- Start a new FOD check with one tap
- Record findings as issues — each issue gets a description, location, and optional photo
- Photos capture with GPS coordinates embedded automatically
- Multiple issues per check — find three FOD items on one drive, log all three
- The check auto-saves as a draft, so an interruption (radio call, emergency) doesn't lose your work
- File the check when complete — it's timestamped, attributed, and archived permanently

### RSC/RCR Check (Runway Surface Condition / Runway Condition Reading)
Assess runway conditions after weather events, maintenance, or as routine. Records condition values per runway third (touchdown, midpoint, rollout). Captures surface type, contaminant depth, and braking action assessments.

### Emergency Checks (In-Flight and Ground)
Specialized checklists for post-emergency airfield condition assessment. After an aircraft emergency, the airfield must be inspected before resuming normal operations. These checks include specific items for FOD from emergency equipment, fluid spills, pavement damage, and arrested aircraft debris.

### Heavy Aircraft Check
Pre-arrival assessment for aircraft exceeding the airfield's standard weight rating. Documents pavement condition, ACN/PCN comparison, and any required restrictions or precautions.

### BASH Check (Bird/Wildlife Aircraft Strike Hazard)
Wildlife observation and mitigation documentation. Records species observed, locations, dispersal methods used, and remaining hazards. Supports BASH program compliance per DAFMAN 91-212.

### Common Check Features
All check types share these capabilities:
- **Multi-issue capture** — Flag multiple findings per check, each with its own photo, description, and location
- **Photo documentation** — Camera integration with GPS. Photos are resized on capture (max 1600px) for fast uploads while preserving detail
- **Draft persistence** — Checks save automatically to the database. Start on your phone in the truck, finish on your desktop inside. Cross-device continuity
- **Airfield diagram reference** — Pull up your airfield diagram during the check to reference locations
- **Auto-populated inspector info** — Your name, rank, and operating initials are filled automatically
- **PDF export** — Generate a formatted PDF of any completed check with photos embedded
- **Email distribution** — Send the PDF directly from the app to any email address
- **Activity logging** — Filing a check creates an Events Log entry with your operating initials and Zulu timestamp

---

## Facility Inspections — Comprehensive Evaluations

Inspections are more thorough than checks. They follow structured checklists and produce detailed compliance records.

### Airfield Inspection (44 Items, 10 Sections)
The daily comprehensive airfield evaluation covering:
1. Pavements — Surface condition, FOD, damage, repairs
2. Shoulders/Overruns — Condition, erosion, debris
3. Drainage — Ditches, culverts, standing water
4. Markings — Condition, visibility, compliance
5. Signs — Presence, condition, illumination
6. Lighting — Operational status, lens condition, alignment
7. Wind Indicators — Wind cones, tetrahedrons
8. Safety — Fencing, gates, warning signs
9. NAVAIDs — ILS, VASI/PAPI, localizer, glideslope
10. General — Overall airfield condition notes

### Lighting Inspection (34 Items, 5 Sections)
Focused evaluation of all airfield lighting systems: runway edge, threshold, approach, taxiway, obstruction, and beacon lighting.

### Construction Meeting Inspection
Pre- and post-construction assessment for airfield construction projects. Documents conditions before work begins and verifies restoration after work completes. Links to construction waivers and contractor coordination.

### Joint Monthly Airfield Inspection
Multi-agency inspection combining Airfield Management, CE, Safety, ATC, and other stakeholders. Documents findings from each agency's perspective in a single consolidated report.

### Inspection Workflow — Default-to-Pass
Glidepath's inspection workflow is built for speed:
1. **Every item defaults to "pass."** You don't have to individually mark 44 items as passing — only interact with failures
2. **Toggle behavior:** Tap an item to cycle pass → fail → N/A → pass. No blank state, no confusion
3. **Inline discrepancy creation:** When you mark an item as "fail," you can immediately create a discrepancy without leaving the inspection. Add description, photos, and location right there
4. **Multiple discrepancies per item:** A single failed item can generate multiple discrepancies (e.g., failed "Markings" could produce both a centerline marking and a hold-short marking discrepancy)
5. **Auto-save:** Every change saves automatically to localStorage and syncs to the database. Close the app, come back, and your progress is exactly where you left it
6. **Weather integration:** Current weather conditions are captured at inspection start for the record
7. **Personnel assignment:** Record who participated in the inspection by role (Contracting, CES, Safety, SFS, ATC, AMOPS, TERPS)

### Filing and Distribution
When an inspection is complete:
- Tap "File" to finalize — status changes from draft to completed
- A comprehensive PDF is generated with all items, responses, discrepancies, photos, weather data, and signatures
- Email the PDF to your flight chief, squadron commander, or distribution list with one tap
- The inspection is archived and searchable permanently

---

## ACSI — The Big One

The Airfield Compliance & Safety Inspection is the most comprehensive evaluation in airfield management. Per DAFMAN 13-204v2 Attachment 2, it covers every aspect of airfield infrastructure and operations.

### Scope
- **10 sections** covering pavement, clearances, markings, signs, lighting, wind indicators, obstructions, arresting systems, hazards, and local procedures
- **~100 individual inspection items** with pass/fail/N/A responses
- **Sub-field evaluations** — Many items have sub-fields: A (Operable), B (Properly Sited), C (Clear of Vegetation). Each sub-field is independently evaluated

### Multi-Team Staffing
ACSI inspections involve multiple agencies. Glidepath tracks the inspection team by role:
- Airfield Manager (AFM)
- Civil Engineering (CE)
- Safety
- Radar/Airfield/Weather Systems (RAWS)
- Weather
- Security Forces (SFS)
- Terminal Instrument Procedures (TERPS)
- Other

### Risk Certification
The ACSI includes a Risk Certification block where responsible parties sign off on identified risks. Glidepath captures signature blocks with name, rank, title, and date for each certifying official.

### Workflow
1. Create a new ACSI inspection — select the airfield, set the inspection date, identify the fiscal year
2. Work through items section by section. Each item shows its regulatory reference and description
3. Mark items as pass, fail, or N/A. For failed items, create discrepancies inline with photos and map locations
4. Assign team members to their respective roles
5. Complete the risk certification block
6. Save as draft at any point — resume on any device
7. File when complete — generates comprehensive PDF with every item, response, discrepancy, photo, and map

### ACSI PDF
The ACSI PDF is the most complex document Glidepath generates. It includes:
- Cover page with inspection metadata
- Item-by-item results with parent/sub-field hierarchy
- Inline photos for discrepancies
- Mapbox satellite thumbnails showing discrepancy locations
- Team roster and risk certification signatures
- Pass/fail/N/A summary counts

---

## Why This Matters

### Before Glidepath
- Inspections done on paper checklists — handwritten, then transcribed to digital format later
- Photos taken on personal phones, manually attached to emails or folders
- No link between inspection findings and discrepancy tracking — "I found it" and "someone needs to fix it" are separate workflows
- ACSI inspections take weeks to compile, with findings scattered across multiple documents
- Draft inspections lost when the browser crashes, the phone dies, or the shift ends
- New inspectors have no reference for what previous inspections found

### With Glidepath
- Inspections are fully digital from the start — no transcription step
- Photos attach directly to specific findings with GPS and timestamps
- Failed items create discrepancies automatically — no separate data entry
- ACSI compilation is real-time — file as you go, not weeks later
- Drafts persist across devices and sessions — never lose progress
- Complete inspection history is searchable — see what was found last month, last year, or three years ago
- PDFs generate instantly with all data, photos, and maps embedded

### Compliance Impact
DAFMAN 13-204 requires documented inspections at specific intervals. Glidepath ensures:
- Every required inspection type has a dedicated workflow
- All findings are timestamped and attributed
- Discrepancies link directly to the inspection that identified them
- Reports are generated in a consistent, professional format
- Historical records are preserved indefinitely — audit-ready at any time

---

*Glidepath v2.17.0 — Digital inspections for the modern airfield*
