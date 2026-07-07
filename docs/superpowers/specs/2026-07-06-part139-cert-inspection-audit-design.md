# Part 139 Certification-Inspection Readiness Audit — civilian `/acsi`

**Date:** 2026-07-06
**Status:** Design — awaiting owner review
**Module:** `/acsi` on civilian (`airport_type = 'faa_part139'`) tenants
**Supersedes:** `2026-07-06-part139-self-inspection-design.md` (that spec targeted the
daily self-inspection, which `/checks` already owns — see its pivot banner).

## Goal

Repurpose the civilian `/acsi` module from the USAF ACSI into an **annual Part 139
certification-inspection *readiness audit*** — a comprehensive self-audit that
**mirrors the FAA's own annual certification inspection**, so an airport can walk
its own compliance before the FAA Airport Certification Safety Inspector (ASI)
does. "Prepare, don't perform."

The content is a faithful reproduction of **FAA Form 5280-4, the Airport
Certification/Safety Inspection Checklist** — the exact form the ASI fills out.
The **USAF ACSI path stays byte-for-byte unchanged**; everything branches on
`airport_type`.

## Why this module exists (and doesn't duplicate `/checks`)

Part 139 has two distinct inspections:
- **Daily self-inspection** (§139.327, guidance = AC 150/5200-18C) — recurring,
  performed by the airport. **Already covered by `/checks` + `/inspections`.**
- **Annual FAA certification inspection** (the ASI's visit, Form 5280-4) —
  comprehensive audit across all of Subpart D + the ACM. The airport *prepares*
  for it. **Nothing in Glidepath does this today.** ← this module.

## Source documents (owner-supplied, authoritative — zero fabricated reg text)

1. **FAA Order 5280.5D, Appendix G — "Airport Certification/Safety Inspection
   Checklist (FAA Form 5280-4)"** (pp. G-1…G-4, PDF pp. 144–147). **Primary
   structural source** — every section and item below is transcribed verbatim
   from it, including each item's CFR sub-paragraph citation.
2. **FAA Order 5280.5D, Chapter 4 (§§4.9–4.30), "Inspection Process"** (pp. 4-13…4-52)
   — per-area ASI procedures at CFR-subparagraph granularity (e.g., §4.11.2.4 gives
   the exact 5-inch/45-degree hole test for §139.305(a)(2)). **v1 source for per-item
   inspector guidance** (`guidance?`, owner chose to include in v1).
3. **FAA Order 5280.5D, Appendix H — "ARFF Enhanced Checklist"** (pp. H-1…H-21) — the
   detailed ARFF inspection sub-items per §139.319 requirement (PPE ensemble, 3-/4-min
   response standards, vehicle readiness/agent-discharge, NFPA refs). **v1 source for
   the enhanced ARFF content** (owner chose to include in v1).
4. **14 CFR Part 139 Subpart D** — the regulation each Form 5280-4 item cites.
5. AC 150/5200-18C — **demoted**: it's the daily self-inspection source and
   belongs to the `/checks` layer, not this module.

Rating legend on Form 5280-4: **S = Satisfactory · U = Unsatisfactory · N/A = Not
Applicable · "Remarks Required"** (on U). This maps 1:1 onto the app's existing
`pass` / `fail` / `na` mechanic — **no Day/Night model** (that was AC 150/5200-18C's
daily construct; the earlier spec's Day/Night decision is superseded by the
actual FAA form).

---

## The audit content (`PART139_CERT_SECTIONS`) — verbatim from Form 5280-4

22 sections / ~123 items, each carrying its CFR sub-paragraph citation exactly as
printed on the form (e.g., `305a1`). Section order roughly tracks Subpart D and
matches the form's grouping (e.g., Condition Reporting §339 sits by Construction
§341, as on the form).

| # | `section_id` | Section (CFR) | Items (citation) |
|---|---|---|---|
| 1 | `p139-mpc` | Methods & Procedures for Compliance (§139.7) | Compliance with Advisory Circulars (139.7) |
| 2 | `p139-exempt` | Exemptions (§139.111) | Justification Still Valid (139.111) — *No. on record* |
| 3 | `p139-acm` | Airport Certification Manual (§139.201/.203) | Compliance with ACM (201a); Preparation (201a); Content (203); Maintenance (201b) |
| 4 | `p139-records` | Records (§139.301) | Furnished upon Request (301a); Maintained for Specified Duration (301b) |
| 5 | `p139-personnel` | Personnel (§139.303) | Sufficient Qualified Personnel (303a); Properly Equipped (303b); Trained (303c); Record of Training for 24 CCM (303d); Use of an Independent Organization or Designee (303f) |
| 6 | `p139-paved` | Paved Areas (§139.305) | Lips (305a1); Holes (305a2); Cracks/Surface Variations (305a3); Debris/Contaminants (305a4); Chemical Solvent Removed (305a5); Drainage/Ponding (305a6) |
| 7 | `p139-safety` | Safety Areas (§139.309) | Dimensions Maintained (309a); Ruts/Surface Variations (309b1); Drainage (309b2); Support Aircraft/Equipment (309b3); Objects in Safety Area/Frangible Mounting (309b4) |
| 8 | `p139-msl` | Marking, Signs, and Lighting (§139.311) | Runway Marking Meets Specs (311a1); Taxiway Centerline (311a2); Taxiway Edge Markings (311a3); Holding Position Markings (311a4); ILS Critical Area Markings (311a5); Signs Identifying Taxiing Routes (311b1i); Holding Position Signs (311b1ii); ILS Critical Area Signs (311b1iii); Signs Internally Illuminated (311b2); Runway Lighting Meets Specifications (311c1); Taxiway Lighting/Reflectors (311c2); Airport Beacon (311c3); Airport-owned Approach Lighting (311c4); Obstruction Marking/Lighting (311c5); Markings/Signs/Lighting Properly Maintained (311d); Other Lighting Shielded/Adjusted (311e) |
| 9 | `p139-snow` | Snow and Ice Control (§139.313) | Prepare/Maint./Execute Plan (313a); Plan Addresses Prompt Removal or Control (313b1); Positioning Snow for Clearance (313b2); Use of Approved Materials (313b3); Timely Commencement (313b4); Prompt Notification to Users (313b5) |
| 10 | `p139-arff` | ARFF Operations (§139.315/.317/.319) | ARFF Capability Meeting Index Provided During ACR OPNS (319a); Requirements Met for Increase in Index (319b); Reduction in ARFF Index Meets Conditions (319d); Vehicle Communications in Required Vehicles (319e); Vehicle Marking & Lighting (319f); Vehicle Readiness (319g); Response Drill — *No. Vehicles* (319h); Personnel Properly Equipped (319i1); Personnel Properly Trained (319i2); Live-Fire Drill Every 12 CCM for all Personnel (319i3); Personnel Trained/Current in Basic Emergency Medical Care for ACR OPNS (319i4); Record of Training for 24 CCM (319i5); Sufficient Personnel to Meet Requirements (319i6); Alerting Procedures/Equipment Established (319i7); Hazardous Materials Guidance Available (319j); Emergency Access Roads Maintained (319k) |
| 11 | `p139-hazmat` | Hazardous Materials (§139.321) | Procedures for Hazardous Substances and Materials (321a); Acceptable Fire Safety Standards Established (321b); Compliance to Fire Safety Standards (321c); Inspection of Fuel Facilities every 3 CCM (321d); Record of Inspection for 12 CCM (321d); Fueling Agent Supervisor Training Every 24 CCM (321e1); Fueling Agent On-the-Job Training Every 24 CCM (321e2); Written Confirmation Every 12 CCM that Training Accomplished (321f); Require Immediate Corrective Action/Notify FAA of Noncompliance (321g) |
| 12 | `p139-wind` | Traffic/Wind Indicators (§139.323) | Wind Cones Provided/Lighted (323a); Segmented Circle, Landing Strip, and Traffic Pattern Indicators Provided When No ATCT (323b) |
| 13 | `p139-aep` | Airport Emergency Plan (§139.325) | Develop/Maintain Plan for Prompt Response/Sufficient Detail (325a); Response Instructions — Aircraft/Bomb/Structure/Fuel/Natural/HazMat/Sabotage-Hijack/Power/Water (325b); Must Address Medical/Transport/Hospital/Ambulance/Inventory/Injured/Crowds/Disabled Aircraft (325c); Provide for Marshaling/Emergency Alarm/ATCT Coordination (325d); Procedures for Notifying Agencies of Accident Location (325e); Water Rescue to the Extent Practical (325f); Coordinate & Develop Plan with Participating Agencies (325g1,2); Airport Personnel Properly Trained (325g3); Review Plan every 12 CCM (325g4); Full-Scale Exercise every 36 CCM for Class I (325h); Consistent with Approved Security Program (325i) |
| 14 | `p139-selfinsp` | Self-Inspection Program (§139.327) | Inspect Daily or As Required (327a1); Inspect when Required by Unusual Conditions/Accidents (327a2,3); Equipment Provided (327b1); Procedures/Equipment for Dissemination of Information to Users (327b2); Inspections Conducted by Qualified Personnel (327b3); Personnel Properly Trained (327b3); Reporting System for Prompt Correction incl. Wildlife Strikes (327b4); 12 CCM of Records Showing Conditions Found + Corrective Actions (327c1); Record of Training for 24 CCM (327c2) |
| 15 | `p139-vehicles` | Pedestrians & Ground Vehicles (§139.329) | Limit Access to Movement/Safety Areas (329a); Establish/Implement Safe-Ops Procedures (329b); Pedestrian/Vehicle Control with ATCT (329c); Control — No ATCT (329d); Operator Training on Procedures & Consequences (329e); Record of Training for 24 CCM (329f1); 12 CCM of Records for Accidents/Incidents (329) |
| 16 | `p139-obstruct` | Obstructions (§139.331) | Objects Determined to be an Obstruction Removed, Marked, or Lighted (331) |
| 17 | `p139-navaids` | Protection of NAVAIDs (§139.333) | Prevent Construction that Would Derogate NAVAIDs/AT Facilities (333a); Protect from Vandalism and Theft (333b); Prevent Signal Interruption (333c) |
| 18 | `p139-public` | Public Protection (§139.335) | Prevent Inadvertent Entry to Movement Area by Unauthorized Persons/Vehicles (335a1); Reasonable Protection from ACFT Blast (335a2) |
| 19 | `p139-wildlife` | Wildlife Hazard Management (§139.337) | Immediate Measures when Detected (337a); Provide for WHA when Required (337b); WHA Conducted by Qualified Personnel (337c); WHA Contents (337c); WHA Submitted to FAA (337d); WHMP Formulated and Implemented when Required (337e); Plan Addresses Required Contents (337f); Plan Addresses Permits — local/State/Federal (337f3); Review/Evaluate Plan every 12 CCM (337f6); Personnel Training Program by a Qualified Wildlife Biologist (337f7) |
| 20 | `p139-construction` | Identifying, Marking & Lighting Construction / Unserviceable Areas (§139.341) | Mark/Light Construction/Unserviceable Areas & Equipment (341a1); Pre-Construction Review of Utilities (341a2) |
| 21 | `p139-condrpt` | Airport Condition Reporting (§139.339) | Collection/Dissemination of Airport Conditions (339a); Use of NOTAM/Other Systems (339b); Provide Information on Required Conditions (339c); 12 CCM of Records of Each Dissemination (339d) |
| 22 | `p139-noncomply` | Noncomplying Conditions (§139.343) | Limit ACR OPNS to Safe Areas when Uncorrected Unsafe Conditions Exist (343) |

Plus a free-text **"Remarks — Narrative"** area (maps to the existing General
Notes field) and an **"Other"** open section on the form (v1: fold into Notes).

**No fabrication:** every string above is transcribed from Form 5280-4;
`⚠ verify`-flagged ACs are gone entirely — the module now cites the CFR
sub-paragraphs the FAA form itself cites. ("CCM" = consecutive calendar months,
per the form.)

### Per-item inspector guidance (v1)

Every item carries an optional **`guidance?: string`** — the "what the inspector
looks for" detail transcribed from **Chapter 4 §§4.9–4.30**, keyed by the item's
CFR citation. Rendered as a collapsible/tooltip expander under each item (form +
detail view); **not** printed in the Form 5280-4 PDF (kept clean). Example
(§139.305(a)(2), from §4.11.2.4): *"A hole ≤5 in. diameter, <3 in. deep, sideslope
<45° is not a discrepancy as a hole… if it exceeds 3 in. deep, apply the 5-in.
circle / 45° sideslope tests."* Guidance strings are transcribed at implementation
from the cited pages — no fabrication, page-referenced in the constants.

### Enhanced ARFF (v1)

The ARFF section (§10, the 16 main `319*` items) is enriched from **Appendix H**:
each main ARFF item gets its Appendix H detail as **structured guidance**
(sub-checkpoints — PPE ensemble, 3-min/4-min response, agent-discharge demo,
vehicle readiness, alerting, NFPA refs), *not* ~80 separate S/U/N-A rows (which
would dwarf the rest of the audit). The 16 items stay the answerable rows; their
Appendix H sub-items render inside the guidance expander. **See Q-A note** —
confirm this modeling (guidance vs. separate rows).

---

## Response model (reuses the existing mechanic — simpler than the prior spec)

Form 5280-4 rates each item **S / U / N/A**. Map directly:

| Form 5280-4 | App `AcsiItemResponse` | Behavior |
|---|---|---|
| **S** Satisfactory | `pass` | — |
| **U** Unsatisfactory | `fail` | "Remarks Required" → opens the corrective-action panel (mode-aware label, below) |
| **N/A** Not Applicable | `na` | — (e.g., Class IV airports mark N/A for inapplicable items; the form says so) |

No sub-fields, no Day/Night. `draft.responses[itemId]` and the existing
discrepancy-per-item flow are reused as-is. Counts (`passed`/`failed`/`na`) work
unchanged. This is a **smaller** change than the superseded Day/Night spec.

### Cover fields (from the Form 5280-4 header)

Airport Name · Associated City, State · Site No. · Certificate Holder · Current
ARFF Index (A–E) · Airport Classification (Class I / II / III / IV) · Inspector ·
Inspection Dates. Civilian-only additions to the draft/record; military cover
fields unchanged.

---

## Team + certification (civilian)

Carried from the prior decision: **civilianize team roles, drop the military
risk-cert block.** For a readiness audit the "team" = who conducted the audit;
add `PART139_TEAM_ROLES` (Airport Operations [required], Airfield Maintenance,
ARFF, Safety/SMS, Wildlife, Other). The `<AcsiRiskCert>` ORM block is not rendered
on civilian; `signatures` stays empty. The discrepancy panel's **"Risk Control
Measure"** field → **"Corrective Action"** on civilian (mode-aware label); the
file-time gate reworded to match.

---

## Mode-selection mechanism (unchanged from the superseded spec)

```ts
// lib/constants.ts (or lib/acsi-checklist.ts)
export function sectionsForAirportType(t: AirportType): AcsiChecklistSection[] {
  return t === 'faa_part139' ? PART139_CERT_SECTIONS : ACSI_CHECKLIST_SECTIONS
}
export function sectionMetaById(sectionId: string): AcsiChecklistSection | undefined {
  return [...ACSI_CHECKLIST_SECTIONS, ...PART139_CERT_SECTIONS].find(s => s.id === sectionId)
}
```

`section_id` namespaces (`acsi-*` vs `p139-*`) never collide, so stored records
resolve their section metadata mode-independently — historical USAF records are
immune to a base later flipping `airport_type`.

The `AcsiChecklistSection`/`AcsiChecklistItem` interfaces are reused, extended with
two optional, additive fields: **`citation?: string`** (the CFR sub-paragraph,
rendered as a subtle suffix, e.g., "Lips · §139.305(a)(1)") and **`guidance?: string`**
(the Chapter 4 / Appendix H inspector detail, rendered in a collapsible expander).
Both are optional so the USAF `AcsiChecklistItem` shape is unaffected.

---

## Per-file changes

| File | Change |
|---|---|
| `lib/constants.ts` | Add `PART139_CERT_SECTIONS` (22 sections above, each item with `citation` + `guidance`; ARFF items carry Appendix-H guidance), `PART139_TEAM_ROLES`, `sectionsForAirportType`, `sectionMetaById`. Add optional `citation?` + `guidance?` to `AcsiChecklistItem`. USAF arrays untouched. |
| `lib/acsi-draft.ts` | `createNewAcsiDraft(mode)` seeds civilian team + no signatures. `acsiDraftToItems(draft, sections)` takes the mode-selected sections array instead of importing the constant. Civilian year default = **calendar year** (not Oct-based fiscal). Military behavior identical. |
| `app/(app)/acsi/new/page.tsx` | Select `sections`/`teamRoles` by `getAirportType`. Add the Form 5280-4 cover fields (ARFF Index, Class, Inspector, Dates) for civilian. Item rows render the citation suffix + a collapsible **guidance** expander. Hide `<AcsiRiskCert>` for civilian. Civilian file-gate: **Corrective Action required on every U** (Unsatisfactory) item. Civilian "Inspection Year" defaults to calendar year. |
| `app/(app)/acsi/[id]/page.tsx` | Iterate the **resolved** sections array (`sectionMetaById` per `section_id` group) instead of the hard-coded constant. Render citation + guidance expander. Hide `risk_cert_signatures` for civilian; civilian team labels; render cover fields. |
| `lib/acsi-pdf.ts` | Walk resolved sections; civilian layout reproduces Form 5280-4 (S/U/N-A + Remarks, sectioned) with the civilian header block; no risk-cert statement. `AcsiPdfOptions.airportType` already exists. |
| `components/acsi/acsi-discrepancy-panel.tsx` | "Risk Control Measure" label → mode-aware ("Corrective Action" on civilian). |
| `components/acsi/acsi-team-editor.tsx` | Accept a `roles` prop (mode-selected) instead of importing `ACSI_TEAM_ROLES`. |
| `lib/modules-config.ts` | Update the `acsi` module `description`/`useCase` so civilian reads as the Part 139 certification-readiness audit (mode-aware copy or neutral wording). `appliesTo` stays `['usaf','faa_part139']` — **do not touch** the gating (broke CI last session). |

`lib/supabase/acsi-inspections.ts` display-id prefix (`P139-`/`ACSI-`) already
mode-aware — no change. The **stored** `AcsiItem` record needs **no** new fields —
`citation`/`guidance` live on the `AcsiChecklistItem` constant and are re-derived at
render via `sectionMetaById`, so records stay lean and no Day/Night fields are
introduced. The one-per-year rule (migration `2026070204`) reuses the existing
`fiscal_year` column — civilian just stores the calendar year in it, so the
constraint holds with no schema change.

---

## Testing (must run vitest — CI `verify` runs `npm run test`)

- **Do not touch** `tests/modules-config.test.ts` acsi classification (dual-mode).
  Re-run to confirm green.
- New unit tests: `PART139_CERT_SECTIONS` shape (22 sections, ids `p139-*`,
  ~123 items, every item has a non-empty label + `citation`; every item has
  non-empty `guidance`; ARFF items carry Appendix-H guidance); `sectionsForAirportType`
  and `sectionMetaById` resolution across both namespaces; `acsiDraftToItems`
  with the civilian array (counts, discrepancy-on-fail) — a worked-example
  regression guard.
- Full gate before "verified": `npx tsc --noEmit` · `npm run lint` (0) ·
  `npm run test` · `npm run build`.

---

## Decisions (owner-confirmed)

- **Q-A — Enhanced ARFF: INCLUDED in v1.** Appendix H detail attaches as structured
  guidance on the 16 main ARFF items (not ~80 separate rows). *One open modeling
  check remains: confirm guidance-vs-separate-rows (see "Enhanced ARFF" above).*
- **Q-B — Per-item guidance: INCLUDED in v1.** Chapter 4 §§4.9–.30 detail on every
  item via the `guidance` field + expander.
- **Q-C — Year: calendar-year default for civilian, one-per-year rule kept.**
- **Q-D — Corrective Action required on every Unsatisfactory item** (matches "Remarks
  Required").

## Scope & phasing note

Including enhanced ARFF + per-item guidance makes this a **large content module**
(~123 items, each with citation + guidance transcribed from ~40 pp. of Chapter 4
and ~21 pp. of Appendix H). The implementation plan will **phase** it behind review
gates — e.g. (1) mechanism + mode selection + the 22-section/123-item skeleton with
citations and S/U/N-A; (2) transcribe Chapter 4 guidance per section; (3) enhanced
ARFF guidance; (4) civilian PDF + cover fields; (5) tests + verify — all landing
before "done," but reviewable in steps. Content transcription is page-referenced
against the source PDFs; nothing invented.

## Out of scope

- Other civilian terminology leaks (`/discrepancies`, `/inspections`, `/qrc`,
  `/flip`, `/obstructions`) — separate backlog.
- Any change to the USAF ACSI checklist, PDF, or workflow.
- The daily self-inspection (`/checks`) — unaffected; AC 150/5200-18C stays its
  domain.
