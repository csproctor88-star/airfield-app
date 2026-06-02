# Glidepath — USAF and FAA Part 139: Terminology and Regulatory Equivalency

> **Proprietary & Confidential, Developed at private expense, © Glidepath.** Reference framework for the dual-mode (USAF / FAA Part 139) vocabulary, role, module, and regulation equivalencies. Derived from the live source of truth in the codebase; see "Source of truth" at the end.

## 1 Purpose

Glidepath runs in two modes. A base is configured as either a **USAF** airfield or an **FAA Part 139** civilian commercial-service airport, and the platform adapts its terminology, role labels, governing regulations, obstruction-surface criteria, and which modules appear. This document is the single canonical reference for: which terms are shared (with their equivalent wording in each mode), which terms and roles are exclusive to one mode, which modules are functional equivalents across modes, and which regulations apply to which mode.

The default mode is USAF; civilian terminology is never surfaced unless a base explicitly operates in Part 139 mode.

## 2 Role and personnel terminology

The same underlying role resolves to different display labels per mode. A blank cell means the role does not exist in that mode.

| Role (concept) | USAF | FAA Part 139 |
|---|---|---|
| Airfield/airport manager | Airfield Manager (AFM) | Airport Operations Manager |
| Operations supervisor | NAMO | Operations Supervisor |
| Operations specialist | AMOPS | Ops Specialist / Airside Ops |
| Maintenance | CES (Civil Engineer Squadron) | Airport Maintenance |
| Safety | Wing Safety | Safety Officer / Safety Office |
| Administrator | Base Admin | Airport Admin |
| Higher headquarters | MAJCOM / RFM | (none) |
| Safety management lead | (none) | SMS Manager |
| Emergency-plan lead | (none) | AEP Coordinator |
| ARFF lead | (none) | ARFF Chief |
| Senior accountable official | (none) | Accountable Executive |

## 3 Operational vocabulary

| USAF term | FAA Part 139 term | Meaning |
|---|---|---|
| AFM | Operations Manager | The senior airfield/airport operations authority |
| AMSL | Shift Lead | The shift's lead operations person |
| NAMO | Ops Supervisor | Operations supervisor over the shift |
| CES | Maintenance | The maintenance organization that works discrepancies |
| AMOPS | Airside Ops | The operations office/desk |
| Airfield Management Operations | Airside Operations | The operations organization (long form) |
| Civil Engineer Squadron | Airport Maintenance | The maintenance organization (long form) |
| Wing Safety | Safety Office | The safety organization |
| Day / Swing / Mid Shift AMSL | Day / Swing / Mid Shift Lead | The per-shift sign-off slots on the daily review |
| Secondary Crash Net (SCN) | Emergency Notification Cascade | The emergency notification mechanism |

## 4 Forms and documents

| USAF | FAA Part 139 equivalent | Purpose |
|---|---|---|
| AF Form 505 (Waiver) | Modification to Standards | Documented deviation from a design/operational standard |
| AF Form 483 | SIDA Badge | Personnel-on-airfield credential / escort authority |
| AF Form 3616 (Daily Events Log) | Daily Ops Log | The daily operations record (signed daily review) |

## 5 USAF-only terms, roles, and modules

These have no civilian counterpart in the platform.

- **Roles:** MAJCOM / RFM (higher headquarters).
- **Vocabulary:** AMSL, AMOC, NAMO (as a distinct rating), BASH (as the USAF program name; the civilian wildlife program is WHMP).
- **Modules:** ACSI (annual compliance inspection); Secondary Crash Net (SCN); AMTR (Airfield Management Training Record, built on AF Forms 623A/797/803/1098 and the 1C7X1 CFETP/QTP).

## 6 FAA Part 139-only terms, roles, and modules

These have no USAF counterpart in the platform.

- **Roles:** SMS Manager, AEP Coordinator, ARFF Chief, Accountable Executive.
- **Vocabulary:** Safety Performance Indicator (SPI), Safety Risk Management (SRM), TALPA / Runway Condition Code (RwyCC) / FICON, Modification to Standards.
- **Modules:** Safety Management System (SMS); Airport Emergency Plan (AEP); Wildlife Hazard Management Plan (WHMP); §139.303 Training; Field Conditions (TALPA).

## 7 Module equivalencies

Where a capability exists in both worlds under different names, these are the functional counterparts.

| Capability area | USAF module | FAA Part 139 module |
|---|---|---|
| Emergency response / notification | Secondary Crash Net (SCN) | Airport Emergency Plan (AEP) |
| Annual compliance inspection | ACSI | Part 139 Annual Inspection (performed via the Inspections module; no dedicated module) |
| Personnel training records | AMTR (DAF 623A career record) | §139.303 Training (topic-based records) |
| Wildlife hazard | Wildlife / BASH | Wildlife / BASH plus WHMP (annual management plan) |
| Deviation tracking | Waivers (AF Form 505) | Modification to Standards |
| Runway condition assessment | Captured via Airfield Checks / status | Field Conditions (TALPA) module |
| Safety management | Distributed across modules | Safety Management System (SMS) module |

## 8 Regulatory applicability map

### 8.1 Equivalent regulatory anchors (selected automatically by mode)

| Domain | USAF | FAA Part 139 |
|---|---|---|
| Primary operations regulation | DAFMAN 13-204 | 14 CFR Part 139 |
| Airfield design criteria | UFC 3-260-01 | AC 150/5300-13B |
| Obstruction / imaginary surfaces | UFC 3-260-01 Ch. 3 | 14 CFR Part 77 |
| Self-inspection | DAFMAN 13-204 Vol. 2 | AC 150/5200-18C |
| Emergency plan | AFMAN 91-203 | AC 150/5200-31C |
| Wildlife | DAFMAN 91-212 | AC 150/5200-33C / 14 CFR §139.337 |

### 8.2 USAF regulations and what they govern

| Regulation / form | Governs (module / area) |
|---|---|
| DAFMAN 13-204 Vol. 1-3 | Airfield status, checks, inspections, shift checklist, discrepancies, NOTAMs, PPR, daily operations |
| DAFMAN 13-204 Vol. 2 Table A3.1 | Visual NAVAID / lighting outage thresholds and tiered alerting |
| DAFMAN 13-204 Vol. 2 §5.4.3 | ACSI annual compliance inspection |
| DAFMAN 13-204 Vol. 2 §4.2.2.3.7 | Secondary Crash Net |
| DAFMAN 13-204 Vol. 2 §2.5.2.8 | QRC / daily-ops references |
| UFC 3-260-01 (Ch. 3) | Obstruction evaluation; airfield design; parking clearance |
| UFC 3-260-03 / 3-260-04 / 3-535-01 | Airfield/lighting design references (cited in training catalog) |
| AFMAN 91-203 | QRC emergency/contingency checklists |
| DAFMAN 91-212 | Wildlife / BASH |
| DAFI 36-2670 / CFETP 1C7X1 | AMTR training records and qualification standards |
| AFMAN 32-1041 / AFI 32-1015 / AFH 32-7084 / TSPWG / DoDI 4165.57 | Pavement, airfield management, and siting references (training catalog) |
| AF Forms 505 / 483 / 3616 / 623A / 797 / 803 / 1098 | Waivers, personnel-on-airfield, daily log, and training records |

### 8.3 FAA Part 139 regulations and what they govern

| Regulation / advisory circular | Governs (module / area) |
|---|---|
| 14 CFR Part 139 | Primary civilian airport operations |
| 14 CFR §139.303 | Personnel training records and topics |
| 14 CFR §139.325 | Airport Emergency Plan (response agencies, comms checks, drills) |
| 14 CFR §139.337 | Wildlife Hazard Management Plan |
| 14 CFR §139.401-415 | Safety Management System |
| 14 CFR Part 77 | Obstruction / imaginary surfaces (civilian) |
| AC 150/5300-13B | Airfield/airport design criteria |
| AC 150/5200-18C | Self-inspection program |
| AC 150/5200-31C | Airport Emergency Plan guidance |
| AC 150/5200-33C / 32B | Wildlife hazard management / assessment |
| AC 150/5200-37A | Safety Management System guidance |
| AC 150/5200-30D | Field conditions / TALPA runway condition assessment |

### 8.4 Shared

NOTAMs are sourced from the live FAA feed in both modes. ICAO references apply to both. The obstruction surface set is selected per mode (UFC 3-260-01 for USAF, FAA Part 77 for civilian) and can be overridden per evaluation.

## 9 Source of truth and how to extend

The authoritative, machine-enforced version of this framework lives in code, not in this document:

- **`lib/airport-mode.ts`** is the canonical terminology engine. `getTerm(key, base)` resolves the 26-key `TERMS` vocabulary map; `getRoleLabel(role, base)` resolves the role labels; `getRegSource(base)` selects the applicable regulation set; `getSurfaceSet(base)` selects the obstruction surface set; `getDiscrepancyStatusLabel(value, base)` resolves status wording. All mode-dependent wording routes through these helpers (it is not hard-coded in components).
- **`lib/supabase/daily-reviews.ts`** maps the daily-review sign-off slots to `TERMS` keys.
- **`lib/modules-config.ts`** declares each module's `appliesTo` (`usaf` / `faa_part139` / both), which determines module visibility per mode.

To add or change a term, add or edit a `TermKey` entry in `lib/airport-mode.ts`; to change a role label, edit the role map there; to change module applicability, edit `appliesTo` in `lib/modules-config.ts`. This document should be regenerated/updated whenever those change so the two stay in agreement.
