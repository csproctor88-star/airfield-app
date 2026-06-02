# Glidepath — Capabilities Brief — FAA Part 139 (Civilian) Edition

> **Proprietary & Confidential, Developed at private expense, © Glidepath.** This document describes Glidepath's capabilities and the regulatory requirements they satisfy. It is a capabilities/requirements overview, not an implementation design or data specification.

Glidepath is a real-time airfield-management platform for United States Air Force airfields and FAA Part 139 commercial-service airports. It replaces the paper daily logs, shared spreadsheets, and phone-based status reporting that traditionally carry an airfield's operational rhythm with a single, role-based, compliance-driven system that holds the day-to-day operations, the records that prove the work was done, and the analytical engines that evaluate the airfield against current regulation. It is used day-to-day by Airfield Managers and Airfield Management Operations (AMOPS) personnel at USAF airfields, and by airport operations personnel at civilian Part 139 airports. It is delivered as an installable Progressive Web App that runs on phones, tablets, and desktops, online or offline.

## 1 Overview

Glidepath is a real-time, role-based, multi-installation platform. A single user account can hold access to one or more airfields ("installations" / "bases"), and all operational data is strictly isolated to the base it belongs to. Each base describes its own physical airfield, runways, taxiways, areas, lighting and visual navigation aids, aircraft rescue and firefighting (ARFF) assets, supporting shops, and facilities, through a guided setup process, and the set of active capabilities is configured per base. Every action is governed by a role-and-permission model, and the live operational state updates in real time for everyone viewing it.

### 1.1 Dual-mode (USAF and FAA Part 139)

Glidepath supports two kinds of airfield from one platform. A base is configured as either a USAF airfield or an FAA Part 139 civilian commercial-service airport, and the system adapts to that choice end to end: terminology, role labels, the governing regulation set, and the obstruction-surface criteria all switch to the correct vocabulary for the selected mode. Capabilities are enabled or hidden according to the installation's type, some are USAF-specific, some are civilian-specific, and many apply to both. The default mode is USAF; civilian terminology is never surfaced unless a base explicitly opts into Part 139 mode.

### 1.2 Module-based

Capabilities are delivered as modules that are enabled per base. A base administrator turns on the modules that apply to that airfield, and the navigation, setup steps, and permissions adjust accordingly. A small set of core capabilities (the dashboard, activity log, reporting, settings, and reference data) is always available; the rest are opt-in per installation. This lets the same platform serve a small civilian airport and a large USAF flying wing without either being burdened by the other's features. New capabilities can be made available to existing bases without disturbing their current configuration.

## 2 Platform-wide capabilities

These capabilities are not tied to any single module, they are the foundation the whole platform rests on.

### 2.1 Multi-installation and base switching

A user with the appropriate role can belong to several airfields and switch between them in-app. Switching installations re-scopes the entire application, every status board, map, list, and report reloads for the newly selected base, with no residual data from the prior base. The user's chosen base is remembered between sessions. This supports command-echelon and regional roles that oversee multiple airfields, as well as personnel who move between bases.

### 2.2 Role-based access control and per-base data isolation

Every user holds a role that defines what they can see and do, and individual permissions can be granted or revoked per user on top of that role. Access is enforced both in the interface (controls and pages are hidden when a user lacks the permission) and at the data layer (the database independently refuses any read or write the user is not entitled to), so the interface and the underlying records can never disagree. All operational records are isolated to their base; a user with access to one airfield cannot see or alter another airfield's data. Roles span the full range of airfield personnel, Airfield Managers, AMOPS personnel, Civil Engineering shops, safety, air traffic, base and system administrators, command-echelon resource managers, and the civilian Part 139 equivalents (accountable executive, safety manager, emergency-plan coordinator, operations supervisor, ARFF chief).

### 2.3 Full audit trail / activity log

The platform maintains a continuous, attributed Events Log of operationally significant actions across every module, who did what, to which record, and when. Entries can be added manually as free-text operational notes, and the log preserves the original time of an action even when it is recorded after the fact (for example, an event captured offline and synced later). Because operational accountability depends on it, log entries that are edited or that arrive after a record has been certified are visibly flagged as amended. The Events Log is the system of record for proving the airfield's operational history.

### 2.4 Daily shift-review electronic sign-off

Glidepath provides the digital substitute for the paper daily log (the AF Form 3616 daily events log and shift sign-off required by DAFMAN 13-204). Each operational day has a sign-off record with a slot for each shift plus the supervisory and Airfield Manager certifications; the number of required shift slots follows the base's configured shift count. Each signer certifies the day's events with an attributed, time-stamped signature, and the record becomes fully certified once all required slots are signed. The "operational day" honors each base's local reset time rather than midnight, matching how shifts actually run. This capability operates under an approved waiver that authorizes a web-based program as a suitable substitute for the paper form and its wet/CAC-signature requirement.

### 2.5 Photo capture tied to records

Personnel can attach photos directly to the records they document, discrepancies, checks, inspections, compliance inspections, and obstruction evaluations, including per-issue photos so a single inspection or discrepancy can carry distinct images for each finding. Photos are access-controlled to the same base and permission rules as the record they belong to, and they flow through to the generated PDF reports.

### 2.6 Offline operation (Progressive Web App)

Glidepath is installable like a native app and continues to function without network connectivity, essential on a flight line where coverage is unreliable. Personnel can read recently used reference and operational data and continue to record work (inspections, checks, discrepancies, status changes, outage reports, daily-review signatures, activity entries, and photos) while offline. When connectivity returns, queued work is submitted automatically in order, with conflict handling for records that must not be silently overwritten (such as an already-signed daily review). The interface signals when it is operating offline.

### 2.7 Zulu-time standardization

All operational timestamps are displayed in Zulu (UTC) in a consistent military format, eliminating the time-zone ambiguity that plagues hand-kept logs and ensuring every base, record, and report speaks the same time. Time entry uses a military-format field rather than a locale-dependent clock control. (The one deliberate exception is the daily-operations date selector, which uses base-local time to match how a shift thinks about "today.")

### 2.8 Real-time status updates

The live airfield status and the badges and counts throughout the application update in real time as personnel record work, so everyone, across shifts, offices, and devices, sees the same current picture without refreshing or making a phone call.

### 2.9 One-click PDF report generation and branded email distribution

Every record type can be rendered to a formatted PDF report on demand. Reports are generated within the application and are never sent to a third-party service. A report can be distributed by branded email directly from the platform, with the document attached. (Because some defense email systems quarantine messages containing external web links, distribution leads with the attached PDF rather than links.)

### 2.10 Public and kiosk forms (no login required)

Glidepath exposes a small number of public, no-login intake forms reachable by QR code or kiosk, so transient aircrew and visitors can submit information without an account:

- A public **Prior Permission Required (PPR) request** form for transient aircrew, which lands in the AMOPS triage queue.
- A public, anonymous **safety report** form (civilian Part 139) that feeds the Safety Management System.
- A public **customer feedback** form for transient aircrew and contractors.
- A **kiosk** mode secured by a per-base token that can be rotated or revoked by an administrator.

These public paths are deliberately narrow: an anonymous submitter can only submit, never read or browse base data.

### 2.11 Guided base setup

A guided, multi-step setup process walks a base administrator through configuring the installation: the physical airfield (runways, taxiways, areas, ARFF, facilities), then module-specific configuration such as lighting and visual navigation aids, shops, checklist and report templates, emergency checklists, coordinating agencies, wildlife settings, status-board layout, PPR columns, and the feedback form. Setup includes airport-identifier lookup and survey-grade runway coordinate ingestion so the map and the engines start from accurate geometry. Per-step progress is tracked, with attribution, so a base can see what remains to be configured.

### 2.12 Bulk records export

The platform can export a base's records in bulk for Air Force records-disposition and survivability requirements, producing PDF and Excel renditions per module plus a consolidated workbook, an optional machine-readable data file, and a self-contained offline viewer, with per-module counts and a flag for any selected module that produced no records. A separate export produces a workbook formatted for the USAF command-and-control reporting system (events, PPR, and discrepancy logs for a date range), and emergency-checklist content can be exported to a workbook as well. These exports let a base meet its disposition obligations and hand a complete, readable record set to inspectors or successors.


## 3 Modules

Capabilities are delivered as modules, enabled per base and gated by airport type (USAF vs FAA Part 139). Each module below describes what it does, the regulatory requirement it supports, its key functions, outputs, and the roles involved.

### 3.1 Core Operations Modules

The core-operations modules are the daily-use backbone of the platform: the screens an airfield management team touches every shift to record conditions, track deficiencies, coordinate with civil engineering, and keep the live airfield picture accurate. They are enabled by default on every installation and, except where noted, serve both USAF airfields and FAA Part 139 civilian airports. Each module below is described at the capability level so an outside team can scope its own implementation; mechanics, formulas, and internal identifiers are intentionally omitted.

---

#### 3.1.1 Airfield Checks

**Capability.** Records the recurring, event-driven condition checks an airfield manager performs throughout the day, with photos, GPS location, and signatures, and pushes operationally significant results directly onto the live airfield status board.

**What it does.** Provides a single, consistent way to capture every category of airfield check performed during a shift: foreign-object-debris (FOD) checks, runway surface condition checks, in-flight and ground emergency response sweeps, heavy-aircraft checks, bird/wildlife (BASH) condition checks, and construction checks, plus a general-purpose check type. The user selects a check type, marks the affected airfield areas, answers the prompts specific to that check type, attaches photos to specific issues, captures GPS coordinates, and records free-text remarks. A check can be started, saved as a draft, and resumed later on a different device, then filed as a completed, signed record. Threaded comments allow follow-up discussion on a filed check. The most important behavior is the write-through to the live airfield picture: a runway surface condition check updates the runway condition shown on the status board, and a bird/wildlife condition check updates the current bird-watch condition and contributes to wildlife trend analytics, so the rest of the team sees the new condition immediately without re-keying it.

**Regulatory basis.** DAFMAN 13-204 Volumes 1-3 (airfield checks and daily operations). Results that set runway surface condition and bird-watch condition feed the DAFMAN-governed airfield status board.

**Applies to.** Both (USAF and FAA Part 139).

**Key functions.**
- Multiple configured check types covering FOD, runway surface condition, emergencies, heavy aircraft, wildlife, and construction.
- Per-issue photo capture and GPS location tagging.
- Draft save and cross-device resume; file as a completed, attributed record.
- Threaded comments on completed checks.
- Automatic write-through of runway surface condition and bird-watch condition to the live airfield status board.

**Outputs.** Completed, signed check record with a unique identifier; a formatted check report (PDF); photos retained against the check; live updates to runway surface condition and bird-watch condition on the airfield status board; a logged change in the wildlife condition history; and an entry in the activity log.

**Roles.** Airfield management personnel create, edit, and file checks; the same team views completed checks; deletion is reserved for users granted that authority. Photo upload requires the photo-management capability.

---

#### 3.1.2 Inspections

**Capability.** Steps an inspector through a configured daily inspection template section by section, recording pass/fail/not-applicable for each item and turning failures into trackable discrepancies.

**What it does.** Delivers structured daily airfield and lighting inspections, plus construction-meeting and joint-monthly inspection variants. The inspector works through a template that an installation customizes from regulation-derived defaults (for example, an obstacle-clearance-criteria section), marking each item pass, fail, or not-applicable, adding notes, photos, and an optional location to any item. Weather, temperature, runway condition readings, and a personnel list are captured alongside the item responses. The platform enforces a one-airfield-and-one-lighting-inspection-per-day rule with a daily reset on the installation's local clock, so duplicate daily inspections cannot accumulate. Inspections autosave as they progress and can be resumed on another device; drafts are isolated per user so one inspector's work never appears in another's. When the inspection is filed, every failed item is converted into a discrepancy for tracking and resolution, carrying its photos forward, and any condition readings captured during the inspection update the live airfield status board. A filed inspection can be reopened if corrections are needed.

**Regulatory basis.** DAFMAN 13-204 Volume 2 (daily airfield inspection). Templates derive from DAFMAN defaults and are tailored to the local operating instruction.

**Applies to.** Both (USAF and FAA Part 139).

**Key functions.**
- Section-by-section guided inspection with pass/fail/not-applicable per item.
- Airfield, lighting, construction-meeting, and joint-monthly inspection types.
- Per-item notes, photos, and location.
- Weather, temperature, runway condition, and personnel capture.
- One-per-day enforcement with a daily local-time reset and cross-device resume.
- Automatic creation of discrepancies from failed items, with photos carried over.
- Reopen capability for filed inspections.

**Outputs.** A filed, attributed inspection record; auto-created discrepancies for each failed item; updates to runway and bird-watch conditions on the live airfield status board; retained photos; and an activity-log entry.

**Roles.** Inspectors create and edit inspections and file them; the team views completed inspections; deletion and finalize/file are separately controlled capabilities.

---

#### 3.1.3 Discrepancies

**Capability.** Tracks every airfield deficiency from initial report, through routing to the owning civil-engineering shop, through the work, to airfield-manager verification and closure, the airfield's work-order backbone.

**What it does.** Provides the central register for airfield deficiencies of every kind: FOD hazards, pavement, lighting, marking, signage, drainage, vegetation, wildlife, obstruction, NAVAID, and other. Each discrepancy captures a title, description, airfield location, one or more deficiency types, photos, an assigned civil-engineering shop, an optional NOTAM reference, estimated completion date, project number and cost, and a risk-control measure. The platform routes each discrepancy to the correct civil-engineering shop automatically based on its type, falling back to the airfield management dispatcher when no shop is mapped. A discrepancy moves through a clearly defined workflow, reported to airfield management, submitted to civil engineering, in work, awaiting a project, work complete and awaiting verification, then verified and closed, and every status change is written to an append-only, attributed audit trail so the full history of who changed what and when is preserved. A dashboard badge surfaces the count of items where civil engineering has finished the work and the airfield manager still needs to verify and close them. Discrepancies are also created automatically by other modules: failed inspection items and reported lighting/NAVAID outages both open discrepancies here. On a civilian Part 139 airport, a discrepancy can be promoted into the safety hazard register.

**Regulatory basis.** DAFMAN 13-204 (airfield discrepancy management and coordination with civil engineering).

**Applies to.** Both (USAF and FAA Part 139).

**Key functions.**
- Central register for all airfield deficiency types with photos and location.
- Automatic routing to the owning civil-engineering shop by deficiency type.
- Defined report-to-closure workflow with an append-only, attributed audit trail.
- Dashboard count of work awaiting airfield-manager verification.
- Auto-creation from failed inspections and reported lighting/NAVAID outages.
- Promotion into the safety hazard register on civilian airports.
- NOTAM cross-reference and links to the affected infrastructure or lighting system.

**Outputs.** A discrepancy record with a unique identifier; a discrepancy report (PDF); an audit trail of all status changes and notes; automatic routing to a civil-engineering shop; and cross-links to NOTAMs, infrastructure, and source inspections.

**Roles.** Airfield management personnel report, edit, add notes to, verify, and close discrepancies; civil-engineering shops update the status of discrepancies routed to them (see CES Work Orders); deletion, closure, and cancellation are separately controlled capabilities.

---

#### 3.1.4 CES Work Orders

**Capability.** A focused work-order board that lets Civil Engineering shops action the discrepancies routed to them without exposing the full airfield management application.

**What it does.** Gives civil-engineering personnel a streamlined dashboard scoped to only the discrepancies assigned to their shops. The board lists open work organized into shop tabs with per-shop counts, and surfaces key indicators: how many items are newly submitted, in work, waiting for a project, and awaiting verification, plus an overdue count for items open beyond a month and a recently-completed list for the last week. Civil engineering can advance a discrepancy's status (in work, waiting for a project, work complete), add resolution notes, and leave a free-form note, with every change captured in the same audit trail used by the main discrepancy module. Verification and final closure deliberately remain with airfield management, civil engineering reports the work as complete but does not close it. This is the landing experience for the civil-engineering role, which sees a deliberately reduced application surface (work orders, discrepancies, visual NAVAIDs, and settings only).

**Regulatory basis.** Supports the DAFMAN 13-204 airfield-management-to-civil-engineering discrepancy workflow.

**Applies to.** Both (USAF and FAA Part 139). This is the primary module for the civil-engineering role.

**Key functions.**
- Shop-scoped work-order board with tabs and per-shop counts.
- At-a-glance indicators: submitted, in work, waiting for project, awaiting verification, overdue, recently completed.
- Status advancement and resolution-note entry by civil engineering, with audit trail.
- Reduced application surface tailored to the civil-engineering role.
- Verification and closure retained by airfield management.

**Outputs.** Updated discrepancy status and resolution notes, plus an attributed entry in the discrepancy audit trail.

**Roles.** Civil-engineering shop personnel view their board and advance work through their allowed statuses; airfield management retains verification and closure.

---

#### 3.1.5 Visual NAVAIDs

**Capability.** A mapped inventory of every runway/taxiway light, sign, and visual NAVAID, with automated outage detection that flags when failures exceed allowable thresholds and opens the tracking discrepancy automatically.

**What it does.** Maintains a complete, map-based inventory of airfield lighting and visual navigational aids, runway, taxiway, threshold and end lights, approach lighting systems, precision approach path indicators, runway end identifier lights, sequenced flashers, bar lights, airfield signs, the rotating beacon, wind cones, distance markers, and more, grouped into lighting systems (for example, the various approach lighting system types) and their components. Authorized users place, move, and relabel features directly on the airfield map. When a feature fails, the user reports the outage; the platform marks the feature inoperative, builds a descriptive name from its system and component context, and automatically opens a lighting discrepancy linked back to that feature for tracking and resolution, recording the event in the feature's outage history. Critically, an automated outage engine continuously evaluates each lighting system against the allowable-outage criteria in the governing regulation and raises a graduated alert as outages approach or exceed what is permitted, including detection of a downed lighting bar, and indicates the required follow-on actions (such as issuing a NOTAM, notifying civil engineering or airspace authorities, or taking a system out of service). This is the only module that auto-creates a discrepancy when an outage is reported. Restoring a feature to operational status clears the condition and can prompt closure of the linked discrepancy.

**Regulatory basis.** DAFMAN 13-204 Volume 2 (allowable visual-NAVAID outages and bar-out criteria). The outage capability evaluates lighting against the regulation's allowable-outage thresholds; specific thresholds and the evaluation method are not described here.

**Applies to.** Both (USAF and FAA Part 139).

**Key functions.**
- Map-based inventory of all airfield lighting, signs, and visual NAVAIDs, organized into systems and components.
- In-map placement, repositioning, and relabeling of features by authorized users.
- Report-outage and restore-operational actions per feature.
- Automated, regulation-based outage detection with graduated alerting and bar-out detection.
- Automatic creation of a tracking discrepancy on each reported outage.
- Regulation-driven required-action guidance (NOTAM, notifications, system shutoff).

**Outputs.** An auto-created discrepancy on outage; a per-feature outage history; graduated outage alerts; suggested NOTAM text and associated codes from the outage engine; and a lighting status report.

**Roles.** Airfield management personnel edit the inventory, report outages, and restore features; the civil-engineering role can view the inventory; deletion is a separately controlled capability.

---

#### 3.1.6 Aircraft Parking

**Capability.** Lets planners draft to-scale aircraft parking diagrams on the airfield map and validates wingtip and taxilane clearances against engineering criteria for transient or exercise operations.

**What it does.** Provides a persistent parking-planning workspace where a planner builds a to-scale parking diagram directly on the airfield map. Aircraft are placed from a silhouette library, assigned a tail number and unit/callsign, given a heading, and positioned (individually or as a multi-selected group that drags together). The planner can also draw apron boundaries, taxilanes (interior or peripheral, with a design aircraft and wingspan), and obstacles. As spots are placed, a live clearance overlay checks wingtip-to-wingtip and taxilane clearances against the governing engineering criteria and flags violations on the map, so a planner can resolve conflicts before aircraft arrive. Plans are saved, not ephemeral: a base can keep one active plan plus a library of reusable template plans, and each spot tracks whether it is occupied, available, or reserved.

**Regulatory basis.** UFC 3-260-01 (aircraft wingtip and taxilane clearance criteria, and aircraft design-group classification). Clearance is evaluated against the UFC criteria; the specific clearance values and the evaluation method are not described here.

**Applies to.** Both (USAF and FAA Part 139).

**Key functions.**
- To-scale, map-based parking diagrams with aircraft drawn from a silhouette library.
- Per-spot aircraft, tail number, unit/callsign, heading, position, and status.
- Multi-select group placement and dragging.
- Apron boundaries, taxilanes (with design aircraft/wingspan), and obstacles.
- Live clearance validation against UFC criteria with on-map violation flagging.
- Persistent plans, one active plan per base, plus reusable templates.

**Outputs.** A parking diagram report (PDF) with clearance pass/fail annotations, optionally scoped to selected spots.

**Roles.** Planners create, edit, and delete parking plans; the team views them.

---

#### 3.1.7 Shift Checklist

**Capability.** A per-shift turnover checklist that gives airfield management personnel per-task accountability across Day, Swing, and Mid shifts, with daily, weekly, and monthly cadence and a clean daily reset.

**What it does.** Presents each shift (Day, Swing, Mid) with the tasks due that day, drawn from an administrator-configured template. Tasks carry a cadence, daily, weekly, or monthly, and only the tasks actually due on a given day appear, so the list stays relevant. Each task is a three-state toggle (not done, done, or not-applicable) with an optional note, and every response is attributed to the person who set it. The day's checklist can be completed and, if needed, reopened. The checklist resets on the installation's local clock at a configurable turnover time, and any past day's checklist remains browsable for accountability and review.

**Regulatory basis.** DAFMAN 13-204 (shift operations and turnover).

**Applies to.** Both (USAF and FAA Part 139).

**Key functions.**
- Per-shift task lists (Day, Swing, Mid) from an administrator-configured template.
- Daily, weekly, and monthly task cadence, showing only what is due.
- Three-state per-task toggle with notes and per-response attribution.
- Complete and reopen the day's checklist.
- Local-time daily reset at a configurable turnover time.
- Browsable history of past days.

**Outputs.** A per-day completion record with per-task attribution, and a browsable history view.

**Roles.** Airfield management personnel complete checklist items; an administrator configures the template tasks.

---

#### 3.1.8 NOTAMs

**Capability.** Surfaces the live FAA NOTAM feed for the base's ICAO so the team can see active and expired NOTAMs in-app, with no parallel local NOTAM store to maintain.

**What it does.** Pulls the current NOTAMs for the installation's ICAO directly from the FAA's public NOTAM service and presents them in-app, separated into active and expired, each with its number, type, title, full text, and effective start/end. The feed is read-only and authoritative, there is no local NOTAM-authoring workflow, so the team always sees the official FAA picture rather than a manually maintained copy that can drift. Expiry is determined from the official effective dates and cancellation flags. Discrepancies elsewhere in the platform can reference a NOTAM by its number.

**Regulatory basis.** DAFMAN 13-204 (NOTAM awareness); data sourced from the FAA NOTAM Search service.

**Applies to.** Both (USAF and FAA Part 139).

**Key functions.**
- Live retrieval of the official FAA NOTAMs for the base's ICAO.
- Active-versus-expired separation with full NOTAM detail.
- Read-only by design, no divergent local NOTAM store.
- NOTAM numbers referenceable from discrepancies.

**Outputs.** A rendered live NOTAM list (active and expired), refreshed from the FAA feed.

**Roles.** Airfield management personnel view the feed; the feed is read-only for all users.

---

#### 3.1.9 Field Conditions (TALPA)

**Capability.** Lets civilian Part 139 airports issue auditable, per-third runway condition reports whenever surface conditions degrade, and generates the FICON NOTAM text for the FAA NOTAM Manager.

**What it does.** Gives a Part 139 operator a purpose-built workflow for reporting degraded runway surface conditions under the TALPA runway-condition-assessment approach, replacing ad-hoc winter spreadsheets. For each runway, the operator assesses each third of the runway (touchdown, midpoint, rollout) by selecting the contaminant present, its depth, and its coverage; the platform derives the runway condition code for each third from those inputs, and the operator may override a derived code when local judgment differs, with a required reason recorded for the audit trail. Temperature, treatments applied, a validity window, and notes round out the report. Reports are append-only: each runway has at most one active report, and revising it always creates a new report that supersedes the prior one, preserving the full revision chain. The platform produces the FICON NOTAM text for the operator to enter into the FAA NOTAM Manager, shows the active report per runway alongside a trailing history, and the entry screen is tuned for fast, cold-weather, gloved input.

**Regulatory basis.** 14 CFR §139.313 and AC 150/5200-30D (TALPA / Runway Condition Assessment Matrix).

**Applies to.** FAA Part 139 only.

**Key functions.**
- Per-third (touchdown/midpoint/rollout) runway condition assessment.
- Contaminant, depth, and coverage entry with an automatically derived condition code.
- Operator override of a derived code with a required, recorded reason.
- Temperature, treatments, validity window, and notes.
- Append-only revision chain, one active report per runway, superseded on revision.
- Generation of FICON NOTAM text for the FAA NOTAM Manager.

**Outputs.** An active field condition report with the per-third condition matrix; FICON NOTAM text for the FAA NOTAM Manager; a trailing report history; and a data export (CSV).

**Roles.** Authorized airport operations personnel create and revise reports; the team views active reports and history.

### 3.2 Compliance Modules

The compliance modules turn recurring airfield regulatory obligations, annual inspections, obstruction evaluations, wildlife programs, criteria waivers, personnel control, training records, and the FAA safety/wildlife planning artifacts, into structured, auditable, inspection-ready workflows. Each module is independently enableable per base, gated by role-based permissions, scoped so a user only ever sees and edits data for the bases they belong to, and capable of producing a formatted PDF for filing or for an external inspector. Modules are tagged by airport type so a given installation only sees the modules relevant to its operating authority (USAF, FAA Part 139, or both).

---

#### 3.2.1 Obstructions

**Capability.** Evaluate a point obstruction against airfield imaginary surfaces and taxiway object-free areas and record a verifiable clearance/violation determination.

**What it does.** The user selects a point on the map (or uses their current location), the system retrieves ground elevation, and the user enters the object height, a description, and photos, then chooses the applicable surface set and runs the evaluation. The result reports, per runway and per taxiway, whether the object is clear or in violation (and, for taxiways, whether it falls within an object-free area), names the controlling surface, gives the maximum allowable height and the penetration, and provides a NOTAM-ready bearing-and-distance reference from the nearest threshold. Evaluations are saved with their photos and can be revisited or updated later; the surface set used is preserved with each evaluation so historical results stay interpretable even if the base's default later changes.

**Regulatory basis.** UFC 3-260-01, Chapter 3 and Appendix B (imaginary surfaces, clear zone, graded area, primary, approach-departure, and related surfaces); DoD Instruction 4165.57 (accident-potential-zone land-use zones); 14 CFR §77.19 (FAA Part 77 civilian surfaces).

**Applies to.** Both (USAF and FAA Part 139). The surface set is selectable per evaluation, UFC 3-260-01 surfaces or FAA Part 77 surfaces, defaulting to the base's operating mode.

**Key functions.**
- Map-point or GPS coordinate selection with automatic ground-elevation lookup.
- Multi-runway and taxiway evaluation against the selected surface set.
- Controlling-surface identification with maximum allowable height and penetration.
- NOTAM bearing/distance reference from the nearest threshold.
- Saved evaluation history with photos and a preserved per-evaluation surface set.

**Outputs.** On-screen per-runway and per-taxiway surface analysis with a controlling-surface banner and NOTAM reference; a PDF evaluation report; and an activity-log event when a violation is saved.

**Roles.** View-only reviewers; users who can create and update evaluations; and users who can delete them.

---

#### 3.2.2 Wildlife / BASH

**Capability.** Capture wildlife sightings and bird/wildlife strikes, track the Bird Watch Condition, and surface trend analytics and a hazard heatmap for the Bird/Wildlife Aircraft Strike Hazard program.

**What it does.** Maintains running logs of wildlife sightings (species, count, behavior, location, observation conditions, dispersal action taken, and dispersal effectiveness) and of strikes (species, aircraft and flight data, phase of flight, parts struck and damaged, damage level, ingestion, costs and time out of service, and remains/lab disposition). The current Bird Watch Condition is tracked with a change history. Sightings and strikes can be entered inline from airfield checks and inspections, and a sighting can be linked to a resulting strike. The captured data drives trend analytics and a BASH heatmap and feeds the annual Wildlife Hazard Management Plan narrative.

**Regulatory basis.** DAFMAN 91-212 (BASH program). Strike fields align with USAF/FAA strike-reporting conventions.

**Applies to.** Both (USAF and FAA Part 139).

**Key functions.**
- Wildlife sighting log with species, conditions, behavior, and dispersal effectiveness.
- Strike log with aircraft/flight data, damage, ingestion, costs, and remains disposition.
- Bird Watch Condition tracking with change history.
- Sighting-to-strike linking and inline capture from checks and inspections.
- Filtering by date range, species, zone, and damage level.

**Outputs.** Analytics (totals, top species, sightings and strikes by month, species-group breakdown, dispersal effectiveness); a BASH heatmap point feed (strikes weighted more heavily than sightings); activity-log events on creation; and source data for the WHMP annual assessment.

**Roles.** View-only reviewers; users who can record and edit sightings, strikes, and Bird Watch Condition changes; and users who can delete records.

---

#### 3.2.3 Waivers

**Capability.** Manage airfield criteria waivers across their full lifecycle, from classification and hazard rating through multi-office coordination to annual review.

**What it does.** Records a waiver's classification, hazard rating, requested action, description, justification, risk-assessment summary, corrective action, and the specific criteria it impacts; tracks associated project, cost, fiscal-year, and (for civilian airports) FAA case data; captures the validity period and submission/approval/expiration dates; supports per-office coordination with concur/non-concur status and comments; holds attachments; and runs an annual review that records a recommendation, verifies mitigation, and tracks facilities-board presentation. Submitting and approving a waiver stamps the relevant dates, and recording an annual review advances the next-review-due date and is organized by review year. Waiver numbers are generated automatically from the classification and installation.

**Regulatory basis.** AF Form 505 (Request for Waiver). Criteria sources reference UFC 3-260-01, UFC 3-260-04, and UFC 3-535-01.

**Applies to.** Both (USAF and FAA Part 139).

**Key functions.**
- Lifecycle management across six classifications (permanent, temporary, construction, event, extension, amendment) and a full status progression.
- Hazard rating, risk-assessment summary, corrective action, and impacted-criteria capture.
- Per-office coordination with concur / non-concur status and comments.
- Attachment management (site maps, risk assessments, UFC excerpts, coordination sheets, the waiver form, and more).
- Annual review keyed by year with recommendation, mitigation verification, and facilities-board tracking.
- Automatic waiver-number generation.

**Outputs.** An AF Form 505-style waiver document (PDF) and an annual-review roll-up by year.

**Roles.** View-only reviewers; users who can create and edit waivers; users who can delete them; and users authorized to conduct the annual review.

---

#### 3.2.4 Contractors / Personnel on Airfield

**Capability.** Log personnel and contractors operating on the airfield with escort/credential tracking and credential-expiry warnings.

**What it does.** Maintains a roster of personnel and companies working on the airfield, capturing company, point of contact and phone, work location and description, start/end dates, and radio/flag/callsign assignments. Each entry records the on-airfield credential reference and its expiration date, and the system flags credentials that are expired or expiring within thirty days. Entries move through a simple active-then-completed lifecycle, and reusable templates let a base pre-fill recurring contractors. The credential label adapts to the airport type, the USAF personnel-on-airfield form on military airfields, or the SIDA badge on civilian Part 139 airports.

**Regulatory basis.** AF Form 483 (Personnel on Airfield); civilian SIDA badge equivalent.

**Applies to.** Both (USAF and FAA Part 139).

**Key functions.**
- Personnel/contractor roster with contact, location, work description, and dates.
- Radio, flag, and callsign assignment tracking.
- Credential reference and expiration capture with automatic expiry/expiring warnings.
- Active / completed lifecycle with filtered views.
- Reusable contractor templates shared across base users.

**Outputs.** A landscape "Personnel on Airfield" roster (PDF) with active/completed/total counts and a credential column whose header switches between the USAF form and the SIDA badge by airport type, with expiry annotated inline. Email distribution of the roster.

**Roles.** View-only reviewers; users who can add and edit entries; and users who can delete them.

---

#### 3.2.5 Safety Management System (SMS)

**Capability.** A full FAA Part 139 Safety Management System spanning safety policy, a hazard register with risk assessment and mitigation, safety performance indicators, internal audits, management of change, and anonymous public safety reporting, surfaced through an Accountable Executive dashboard.

**What it does.** Holds a single active, versioned safety policy with safety objectives; a hazard register where each hazard carries a risk assessment scored on a five-by-five likelihood/severity matrix, an initial and residual risk band, and one or more mitigations that drive the residual risk; safety performance indicators measured per period against target, warning, and alert thresholds and auto-classified into bands; internal audits with findings; management-of-change requests that require an approval step; and a public, anonymous safety-report intake that lands for triage. Hazards progress from open through review and control to closure. Everything rolls up to an Accountable Executive dashboard summarizing policy currency, hazards by risk band, indicators in warning or alert, open and pending changes, and reports awaiting triage.

**Regulatory basis.** 14 CFR §§139.401-415 (the Part 139 SMS rule); AC 150/5200-37A and its four pillars (Safety Policy, Safety Risk Management, Safety Assurance, Safety Promotion).

**Applies to.** FAA Part 139.

**Key functions.**
- Versioned, single-active safety policy with objectives and signature.
- Hazard register with five-by-five risk assessment, residual-band tracking, and mitigations.
- Safety performance indicators with target/warning/alert bands and periodic measurement.
- Internal audits with findings, and management-of-change requests with an approval gate.
- Anonymous public safety-report intake and triage.
- Accountable Executive summary dashboard.

**Outputs.** The Accountable Executive dashboard; a one-click SMS Manual PDF aggregating policy, hazards, assessments, mitigations, indicators and measurements, audits, changes, and reports for FAA certification-inspector visits; and a public safety-report URL for the airport.

**Roles.** Read-only reviewers; users who can author and edit SMS content; a policy-signing authority; a change-approval authority; and a report-triage authority. The public safety-report intake requires no login.

**Integrations.** Wildlife Hazard Management Plan findings can be promoted directly into the SMS hazard register, and emergency-plan drill completions feed the safety performance indicators.

---

#### 3.2.6 Training (§139.303)

**Capability.** Personnel-training records for FAA Part 139 §139.303: a topic catalog, per-user completion records with expiry and retention, professional certificates, a compliance matrix, and an expiry digest.

**What it does.** Maintains a catalog of training topics, the mandatory §139.303(e) topics seeded for every civilian base, plus base-custom topics, each with its initial and recurrent requirements, recurrence frequency, retention period, and reference material. Per-user completions are logged as an append-only history (with completion date, training type, instructor, and evidence) and carry a computed expiry derived from the topic's recurrence; renewals link supersession chains. The module also tracks professional credentials with issue and expiry dates. Each user's status for each topic (current, expiring, expired, or not started) is derived from their latest record's expiry, and the data rolls up into per-user rosters and a users-by-topics compliance matrix, with a 30-day expiry digest.

**Regulatory basis.** 14 CFR Part 139 §139.303 (and §139.303(e), the mandatory topics and 24-month record retention).

**Applies to.** FAA Part 139. A USAF base may opt in per topic, but AMTR remains the canonical 1C7X1 record.

**Key functions.**
- Topic catalog with the mandatory §139.303(e) topics plus base-custom topics and per-base overrides.
- Append-only per-user completion records with computed expiry and supersession chains.
- Professional certificate tracking (with optional lifetime credentials).
- Per-user status derivation (current / expiring / expired / not started).
- Compliance matrix and 30-day expiry digest.

**Outputs.** A per-user roster (current/expiring/overdue), a users-by-topics compliance matrix, CSV and PDF roster exports for FAA inspections, a 30-day expiry digest, and activity-log events.

**Roles.** Read-only reviewers; users who can record completions and edit the catalog; and users authorized to export.

---

#### 3.2.7 WHMP (Wildlife Hazard Management Plan)

**Capability.** The annual Wildlife Hazard Management Plan artifact for FAA Part 139: a versioned plan with FAA acceptance, Accountable-Executive sign-off, an annual-review cadence, a hazardous-species register, a mitigation summary, and findings that link into the SMS hazard register.

**What it does.** Holds the current WHMP as a versioned record: the assessment year and who performed it (for example, USDA Wildlife Services), the uploaded plan document, the FAA acceptance date and reference, a register of hazardous species with hazard level, attractants, and mitigations, a mitigation summary, and a list of findings with recommended actions. The plan is signed and activated by the Accountable Executive the first time, then carried forward through recorded annual reviews; filing a new year (optionally pre-filling from the prior plan) supersedes the previous record. The system tracks annual-review due status (current, due soon, overdue, or never reviewed). Each finding can be promoted into the SMS hazard register and then marked as linked, tying the wildlife plan to the safety program.

**Regulatory basis.** 14 CFR §139.337 (including §139.337(c), the annual-review obligation); AC 150/5200-33C; AC 150/5200-32B.

**Applies to.** FAA Part 139.

**Key functions.**
- Versioned annual plan with supersession across years.
- FAA acceptance recording and Accountable-Executive sign-off.
- Hazardous-species register and mitigation summary.
- Findings with recommended actions and promotion into the SMS hazard register.
- Annual-review cadence with due-status tracking.

**Outputs.** An active-assessment card (FAA acceptance, AE sign-off, annual-review countdown, species register, and findings), a prior-years history, compliance copy confirming that a recorded annual review satisfies the §139.337(c) requirement to keep the WHMP current, and activity-log events on file, amend, and review.

**Roles.** Create, amend, and sign/review are gated on wildlife write access; read follows wildlife view access. The plan lives within the wildlife module.

**Integrations.** Findings link into the SMS hazard register, and the strike/sighting capture in the wildlife module feeds the annual assessment narrative.

### 3.3 Emergency & Optional Modules

#### 3.3.1 Quick Reaction Checklists (QRC)

**Capability.** Step-by-step emergency and contingency response checklists with a full, timestamped audit trail of who did what and when.

**What it does.** QRC drives the operator through structured response procedures for events such as aircraft mishaps, hung ordnance, fuel spills, and severe weather. Each checklist is a template made up of ordered steps; when an event occurs the operator opens an execution from that template and works through it. Steps come in several forms, simple acknowledgements, acknowledgements with a note, agency-notification steps that track contact of each emergency-response agency, fillable fields, time-stamp fields (with a one-tap button that stamps the current Zulu time), and read-only informational or instructional steps. Every step the operator completes (or marks not applicable) records the responder's identity and a Zulu timestamp, and a live progress meter shows how far the response has advanced. Executions can be reopened to correct an entry or cancelled outright. Templates carry their own review cadence: each template flags as overdue once it has gone too long without an annual review, and a separate periodic (monthly or quarterly) per-person review flow lets each member acknowledge that they have read the current checklists. A single checklist can also be designated as a Secondary Crash Net activation record, which surfaces a dedicated fillable field block and changes the event-log wording to reflect a crash-net activation.

**Regulatory basis.** AFMAN 91-203 (emergency / contingency checklists) and DAFMAN 13-204v2 §2.5.2.8. Ships with 25 default checklist templates seeded at base setup.

**Applies to.** Both (USAF and FAA Part 139).

**Key functions.**
- Build and maintain per-base checklist templates with ordered, multi-type steps and optional sub-steps.
- Open, work through, close, reopen, or cancel a checklist execution against any template.
- Capture per-step completion / not-applicable state, free-text and time-field values, per-agency notification tracking, and step notes, each stamped with responder and Zulu time.
- Live progress meter per execution.
- Annual template review with reviewer, date, and notes; overdue flagging.
- Periodic per-member review acknowledgements (monthly or quarterly, base-configurable).
- Designate a checklist as a Secondary Crash Net activation record with its own fillable fields.

**Outputs.** Per-execution PDF (downloadable and emailable). A periodic-review roster PDF showing a per-member completion grid for the selected period. Events Log entries on open and close (including crash-net activation wording where applicable). A sidebar badge counting open executions.

**Roles.** Most personnel can view checklists. Authoring and reviewing templates is reserved for users with checklist write access; running and closing live executions is reserved for users with execute access.

---

#### 3.3.2 Airport Emergency Plan (AEP)

**Capability.** The civilian Part 139 Airport Emergency Plan: a versioned plan document with executive annual sign-off, a response-agency roster, periodic comms checks, and a drill program.

**What it does.** AEP is the civilian counterpart to the USAF crash-net workflow. It maintains the airport's emergency plan as a versioned document: a base has one active plan at a time, new versions supersede the prior one cleanly, and the plan record tracks effective date, FAA acceptance reference, the uploaded plan document, and the Accountable Executive's annual review and sign-off. It keeps a roster of response agencies (ARFF, mutual-aid fire, EMS, police, hospital, ATC, FAA, NTSB, FBI, public works, utilities, and others) with primary and backup contact names, phones, and radios. It runs periodic communications checks against that roster, monthly, quarterly, or ad hoc, recording each agency's status and notes, much like the SCN check. And it manages a drill program covering full-scale exercises, tabletops, functional drills, orientation, and ARFF familiarization, each with a scenario, scheduled date, participant attendance, after-action notes, findings, and optional evidence upload. The module tracks review and exercise due-dates with current / due-soon / overdue / never status, and drill completions feed the Safety Management System's safety-performance indicators.

**Regulatory basis.** 14 CFR §139.325 and AC 150/5200-31C; specifically §139.325(d) annual operator review, §139.325(h) triennial full-scale exercise, and §139.325(j) tabletop/functional exercises.

**Applies to.** FAA Part 139 only.

**Key functions.**
- Maintain a versioned, single-active emergency plan with clean supersession to new versions.
- Record the Accountable Executive's annual plan review and sign-off.
- Maintain a response-agency roster with primary and backup contacts.
- Schedule and complete drills (full-scale, tabletop, functional, orientation, ARFF familiarization) with participants, after-action notes, findings, and evidence.
- Run periodic (monthly / quarterly / ad-hoc) comms checks against the agency roster.
- Track annual-review and triennial-full-scale due dates with current / due-soon / overdue / never status.

**Outputs.** An AEP PDF. Stored plan documents and drill after-action reports (in base-scoped storage). Events Log entries on plan create / update / supersede / review, agency changes, drill create and completion, and comms checks. Dashboard due-date chips and a feed into the SMS safety-performance indicators.

**Roles.** Personnel with AEP read access can view the plan, roster, drills, and checks; write access covers maintaining the plan, roster, drills, and comms checks; a separate sign permission governs the Accountable Executive sign-off.

---

#### 3.3.3 Prior Permission Required (PPR)

**Capability.** A Prior Permission Required log with a public no-login request form, AMOPS triage, multi-agency coordination, and final approval/denial, with per-base configurable fields and server-minted PPR numbers.

**What it does.** PPR manages transient-aircraft permission requests end to end. The fields on the form and log are configurable per base (text, date, time, yes/no/N-A, phone, number, email, or informational), and each field can be independently shown on the public form, the internal log, and the airfield-status board, with per-field Zulu-or-local time display. A request can arrive two ways: a member of the public submits the public request form (reached by ICAO at a no-login URL), or AMOPS creates the entry internally. From there the request moves through triage, where AMOPS routes it to the appropriate coordinating agencies; coordination, where each agency records concur or non-concur with a comment; and final approval (or denial, or cancellation). A pre-coordinated request can skip straight to approved, and agencies can be added mid-flow, which steps the request back into coordination. Each PPR is assigned a server-minted PPR number that stays unique even under simultaneous submissions, and a remarks timeline records the running narrative, including coordinating agencies' concur/non-concur comments. Cancellation and denial are soft terminal states that keep the record. Email notifications keep the requester and coordinating agencies in the loop at each step, and active PPRs roll up into the day's operational count on the header and status board.

**Regulatory basis.** DAFMAN 13-204 (PPR for transient aircraft). Otherwise driven by base policy rather than a single-paragraph mandate.

**Applies to.** Both (USAF and FAA Part 139).

**Key functions.**
- Configure per-base PPR fields and where each appears (public form / log / status board) with per-field time display.
- Accept public, no-login PPR requests via an ICAO-addressed form.
- Create PPR entries internally from AMOPS.
- Triage a request and route it to coordinating agencies.
- Record each agency's concur / non-concur decision and comment.
- Approve, deny, or cancel a request; add agencies mid-coordination.
- Maintain a per-base coordinating-agency roster.
- Running remarks timeline with author and rank.
- Server-minted, collision-safe PPR numbers.

**Outputs.** A PPR log PDF. Notification emails at each stage: public-submission acknowledgement, coordination requests to agencies, and approval, denial, and cancellation notices (all best-effort, so an email failure never reverses a status change). Events Log entries on every transition. A consistent value-formatting layer ensures a stored field renders identically across the log, the detail view, the PDF, and emails.

**Roles.** Personnel with PPR view access can see the log and remarks; write access covers creating and editing entries, remarks, and cancellation; triage, agency coordination, and final approval/denial are each governed by their own dedicated permissions. The public request form requires no login.

---

#### 3.3.4 Customer Feedback

**Capability.** A public, no-login, QR-code-reachable feedback channel for transient aircrew and contractors, with an admin-configurable form and inline staff review.

**What it does.** Customer Feedback gives a base a lightweight way to collect input from visitors. Admins configure the form, title, description, an optional thank-you message, custom fields (text, long text, rating, yes/no, or dropdown), and whether to ask for the submitter's name, email, organization, and an overall rating. The base publishes the form via a QR code that visitors scan to submit without logging in; if the base turns the module off, the form shows a closed message instead of accepting submissions. Each submission is a single, immutable record. Staff review submissions newest-first with the comment and any custom-field answers shown inline (there is no separate detail screen), and submissions can be deleted.

**Regulatory basis.** None. This is a base-service / customer-experience tool, not a regulatory requirement.

**Applies to.** Both (USAF and FAA Part 139). This is the only module in this set that is off by default and must be enabled per base.

**Key functions.**
- Configure the public form: title, description, thank-you message, custom fields, and optional name/email/organization/overall-rating capture.
- Publish the form via a scannable QR code to a no-login URL.
- Accept anonymous public submissions; show a closed message when the module is disabled.
- Review submissions newest-first with comments and custom-field answers inline.
- Delete submissions.

**Outputs.** A feedback PDF. An analytics rollup (total submissions, average rating, rating distribution, recent count). No outbound notification emails.

**Roles.** Staff with feedback view access can read submissions; deleting a submission and configuring the form are each governed by their own permissions. The public submission path requires no login.

## 4 Cross-cutting capabilities

Beyond the record-keeping modules, Glidepath includes analytical engines that evaluate the airfield against regulation automatically. Each is described here as a capability and tied to the governing regulation; the internal criteria, formulas, and thresholds are intentionally omitted.

### 4.1 Automated NAVAID / lighting outage detection

The platform continuously evaluates the operational state of runway and taxiway lighting and visual navigation-aid systems against the allowable-outage limits set by DAFMAN 13-204 (Volume 2, Table A3.1). When a light or component is reported inoperative, the system determines whether the affected system is operational, approaching its allowable limit, or past it, including detecting when a contiguous segment of a lighting array is effectively out, and raises a tiered alert accordingly. Reporting an outage automatically creates the discrepancy that tracks the repair, and the engine surfaces the required follow-on actions (such as issuing a NOTAM or notifying Civil Engineering) and the appropriate NOTAM text. Marking the equipment operational again prompts closure of the linked discrepancy. This removes the manual cross-referencing of outage counts against the regulation that an Airfield Manager would otherwise do by hand.

### 4.2 Obstruction evaluation against imaginary surfaces

The platform evaluates a point obstruction (by map location or GPS, with a height) against the airfield's imaginary surfaces and land-use zones, returning a clear/violation determination per surface, the controlling surface, the maximum allowable height, and the degree of any penetration, with a human-readable breakdown for verification and a NOTAM-ready bearing-and-distance reference. It operates against the UFC 3-260-01 imaginary-surface criteria (and the associated land-use-zone instruction) for USAF airfields and against the FAA Part 77 (14 CFR §77.19) surfaces for civilian airports, selecting the correct surface set for the base. Evaluations are saved with photos as a permanent record, and violations carry coordination/waiver guidance.

### 4.3 Aircraft parking clearance analysis

Planners can lay out to-scale aircraft parking on the airfield map, and the platform validates wingtip and taxilane clearances against the UFC 3-260-01 parking and taxilane criteria, flagging any spacing that falls short of the required clearance for the aircraft involved and the parking context (parked, transient apron, or taxilane). The result is a checked parking diagram suitable for transient or exercise operations, replacing manual clearance arithmetic and reducing the risk of a clearance violation on a crowded ramp.

### 4.4 Runway condition / field-condition assessment (civilian)

For Part 139 airports, the platform supports per-third runway condition assessment and generates the FICON NOTAM text required when surface conditions degrade. It implements the TALPA runway-condition methodology of FAA AC 150/5200-30D and the §139.313 field-condition reporting obligation, producing auditable, time-stamped, revisable condition reports and the NOTAM text for the FAA NOTAM Manager, replacing ad-hoc winter-operations spreadsheets.

### 4.5 Protective rate-limiting on public endpoints

The public, no-login endpoints (such as PPR request submission and password-reset/sign-up email) are protected by rate limiting so that automated abuse cannot flood the system or run up the cost of external services, while legitimate users are unaffected.

## 5 Integrations & external services

Glidepath draws on a small number of external services for live data and delivery. The platform is the system of record; these provide reference data and transport only.

| Capability | What it provides |
|---|---|
| Live FAA NOTAM feed | Current and recently expired NOTAMs for the base's airport identifier, shown in-app so the team works from the authoritative source rather than a parallel local copy |
| Airport / ICAO identifier lookup | Airport metadata and runway geometry during base setup, so the airfield is configured from authoritative survey data |
| Terrain elevation lookup | Ground elevation at a point, used by the obstruction-evaluation capability |
| Satellite mapping | The interactive maps underlying status, infrastructure, parking, and obstruction work |
| Weather | Conditions captured alongside inspections and field-condition reports |
| Branded transactional email | Delivery of report PDFs and lifecycle notifications (invitations, approvals, password resets, PPR coordination and decisions) under the Glidepath brand |

## 6 Closing note

Glidepath is a built, deployed, and operating product, maintained against current DAFMAN, UFC, and FAA Part 139 regulations. This brief is intended to convey the scope of what the platform does so an implementation team can plan its own punch list; it is a capabilities and requirements overview, not an implementation design, a data specification, or a substitute for the product itself.
