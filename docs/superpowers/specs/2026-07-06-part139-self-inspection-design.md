# Part 139 Self-Inspection — civilian ACSI checklist swap

**Date:** 2026-07-06
**Status:** ⚠ SUPERSEDED (2026-07-06) — direction pivoted during review.
**Module:** `/acsi` (Airfield Compliance and Safety Inspection → Part 139 on civilian tenants)

> **PIVOT NOTE.** This spec targeted the wrong Part 139 inspection. AC 150/5200-18C
> is the *daily self-inspection* (§139.327) — which Glidepath already covers via
> `/checks` + `/inspections`. Owner decision: repurpose civilian `/acsi` as the
> **annual Part 139 certification-inspection *readiness audit*** — a comprehensive
> self-audit mirroring the FAA's annual certification inspection, structured on
> **14 CFR Part 139 Subpart D (§139.301–.343)** with AC 150/5200-18C supplying the
> airfield-condition detail, and built to the inspector's protocol from **FAA Order
> 5280.5** (owner to supply). A new spec supersedes this one once that doc is in hand.
>
> **What still carries over** to the new spec (plumbing is unchanged): the
> mode-selection mechanism (`sectionsForAirportType` / resolve-by-`section_id`),
> historical-record safety, civilian team roles + risk-cert removal, mode-aware
> discrepancy labels, per-file blast radius, and the vitest gate. **What changes:**
> the content (13 daily airfield sections → ~21 audit areas across records / programs
> / ARFF / fuel / emergency plan / physical airfield) and the annual framing. The
> Day/Night response model is likely dropped (it's a daily-inspection construct).

## Goal

On **civilian (`airport_type = 'faa_part139'`) bases**, replace the ACSI form's
military inspection content with a real FAA Part 139 self-inspection checklist,
so the form no longer surfaces military regulations, military-only inspection
items, or military constructs (risk-management certification, USAF team roles).

Last session made ACSI *labels / header / record-ID prefix / PDF title* mode-aware
(`ACSI-` ↔ `P139-`, "ACSI" ↔ "Part 139"). This session swaps the **checklist
content, response model, team, risk-cert, and citations** — everything downstream
of the labels. The **USAF ACSI path stays byte-for-byte unchanged**; every change
branches on `airport_type`.

## Source documents (owner-supplied, authoritative — no fabricated reg text)

1. **`arp-aso-airport-safety-self-inspection.pdf`** — FAA Southern Region
   "Airport Safety Self-Inspection" briefing (Dec 2012). Pages 14–19 reproduce
   **AC 150/5200-18C, Appendix 1 — "Airport Safety Self-Inspection Checklist"**
   (dated 04/23/04), which is the structural source for the civilian checklist
   below. Pages 11–12 give the canonical Part 139 inspection-area list.
2. **`14 CFR Part 139 (up to date as of 7-02-2026).pdf`** — the regulation text.
   Subpart D (§139.301–.343) is the source for every CFR citation below.

Both extracted with PyMuPDF; the Appendix-1 checklist tables (embedded as slide
images) were rendered to PNG and read verbatim. **All 14 CFR citations are
sourced from doc #2. AC citations are sourced from the documents where marked
`[doc]`; all other AC numbers are marked `⚠ verify` and must be confirmed by the
owner before shipping** (guardrail: never fabricate regulatory text).

---

## The civilian checklist (`PART139_CHECKLIST_SECTIONS`)

13 sections, ~48 items, verbatim from AC 150/5200-18C Appendix 1. Item labels are
the AC's terse **conditions** (√ Satisfactory = condition OK, ✗ Unsatisfactory =
deficiency present), kept verbatim rather than reworded into yes/no questions.

Overarching authority for the whole form: **14 CFR §139.327 (Self-inspection program)**.

| # | `section_id` | Title | Reference string (as rendered) | Conditions (items) |
|---|---|---|---|---|
| 1 | `p139-1` | Pavement Areas | 14 CFR §139.305 (Paved areas); §139.307 (Unpaved areas); AC 150/5380-6 ⚠verify | Pavement lips over 3"; Hole – 5" diam. 3" deep; Cracks/spalling/heaves; FOD: gravel/debris/sand; Rubber deposits; Ponding/edge dams |
| 2 | `p139-2` | Safety Areas | 14 CFR §139.309 (Safety areas); AC 150/5300-13 App 7 [doc] | Ruts/humps/erosion; Drainage/construction; Support equipment/aircraft; Frangible bases; Unauthorized objects |
| 3 | `p139-3` | Markings | 14 CFR §139.311 (Marking, signs, and lighting); AC 150/5340-1 ⚠verify | Clearly visible/standard; Runway markings; Taxiway markings; Holding position markings; Glass beads |
| 4 | `p139-4` | Signs | 14 CFR §139.311; AC 150/5340-18 ⚠verify; AC 150/5345-44 [doc] | Standard/meet Sign Plan; Obscured/operable; Damaged/retroreflective |
| 5 | `p139-5` | Lighting | 14 CFR §139.311; AC 150/5340-30 ⚠verify | Obscured/dirty/operable; Damaged/missing; Faulty aim/adjustment; Runway lighting; Taxiway lighting; Pilot control lighting |
| 6 | `p139-6` | Navigational Aids | 14 CFR §139.311; §139.323 (wind indicators); §139.333 (Protection of NAVAIDS); AC 150/5345-27 ⚠verify; AC 150/5345-28 ⚠verify | Rotating beacon operable; Wind indicators; REILs/VGSI systems |
| 7 | `p139-7` | Obstructions | 14 CFR §139.331 (Obstructions); 14 CFR Part 77; AC 150/5300-13 ⚠verify | Obstruction lights operable; Cranes/trees |
| 8 | `p139-8` | Fueling Operations | 14 CFR §139.321 (Handling and storing of hazardous substances and materials); NFPA 407 [doc]; AC 150/5230-4 ⚠verify | Fencing/gates/signs; Fuel marking/labeling; Fire extinguishers; Frayed wires; Fuel leaks/vegetation |
| 9 | `p139-9` | Snow & Ice | 14 CFR §139.313 (Snow and ice control); AC 150/5200-30 ⚠verify | Surface conditions; Snowbank clearances; Lights & signs obscured; NAVAIDs; Fire access |
| 10 | `p139-10` | Construction | 14 CFR §139.341 (Identifying, marking, and lighting construction and other unserviceable areas); AC 150/5370-2 ⚠verify | Barricades/lights; Equipment parking; Material stockpiles; Confusing signs/markings |
| 11 | `p139-11` | Aircraft Rescue & Fire Fighting | 14 CFR §139.315 (Index); §139.317 (Equipment and agents); §139.319 (Operational requirements) | Equipment/crew availability; Communications/alarms; Response routes affected |
| 12 | `p139-12` | Public Protection | 14 CFR §139.335 (Public protection) | Fencing/gates/signs; Jet blast problems |
| 13 | `p139-13` | Wildlife Hazards | 14 CFR §139.337 (Wildlife hazard management); AC 150/5200-33 ⚠verify; AC 150/5200-36 ⚠verify | Wildlife present/location; Complying with WHMP; Dead birds |

`⚠ verify` ACs (need owner confirmation of number/title before ship): 5380-6,
5340-1, 5340-18, 5340-30, 5345-27, 5345-28, 5300-13 (§7 obstructions use),
5230-4, 5200-30, 5370-2, 5200-33, 5200-36. `[doc]` ACs are already sourced.

There is **no civilian "Section 10 local items"** free-add analogue by default;
the AC's free-text "Comments/Remarks" maps to the existing **General Notes**
field. (Open question O-3 below.)

---

## Day/Night response model

AC 150/5200-18C rates each condition **Satisfactory (√) / Unsatisfactory (✗)**
across a **Day** and a **Night** inspection column (a shaded cell = "not inspected
on that pass"). We adopt this per owner decision.

### Storage (reuses the existing sub-field key convention)

Day/Night is **mode-driven, not `hasSubFields`-driven**: civilian items do **not**
set `hasSubFields` (that flag stays a military A/B/C concept with its own
per-sub-field discrepancies). Instead, when the form is in `faa_part139` mode,
*every* non-heading item gets a Day and a Night response, and the civilian render
path owns the layout. Draft responses reuse the existing `.<key>` keying so
there's **no type change to `AcsiItemResponse`**:

```
draft.responses['1.1.d'] = 'pass' | 'fail' | 'na' | null   // Day   (√/✗/N-A)
draft.responses['1.1.n'] = 'pass' | 'fail' | 'na' | null   // Night (√/✗/N-A)
```

- `pass` = √ Satisfactory, `fail` = ✗ Unsatisfactory, `na`/`null` = not inspected
  (the AC's shaded cell).

Add a **mode-aware sub-field label set** (selected alongside the sections array):

```ts
// lib/constants.ts
export const PART139_DAYNIGHT_FIELDS = [
  { key: 'd', label: 'Day' },
  { key: 'n', label: 'Night' },
] as const
```

### Discrepancy: item-level, not per-column

A deficiency is **one finding** regardless of whether it was seen by day, night,
or both. So — unlike the military A/B/C sub-fields, which carry per-sub-field
discrepancies — the civilian discrepancy attaches at the **parent item id**:

```
draft.discrepancies['1.1'] = [ AcsiDiscrepancyDetail, ... ]   // opens if '1.1.d' OR '1.1.n' === 'fail'
```

This is the one place the civilian path deviates from pure sub-field reuse: the
form renders two response toggles inline (Day / Night) and **one** discrepancy
panel below the item, shown when either column is `fail`.

### Cover fields

Civilian cover gains **Day Inspector / Time** and **Night Inspector / Time**
(the AC header). Stored on the draft + record:

```ts
// AcsiDraftData additions (optional, civilian-only)
day_inspector?: string
night_inspector?: string
```

(Airfield Name, Inspection Date carry over. See O-1 on the Year field.)

### Stored item shape (`acsiDraftToItems`, civilian branch)

Emit **one row per item** (not two sub-rows), carrying both columns + the
item-level discrepancy:

```ts
// AcsiItem additions in lib/supabase/types.ts (optional, civilian-only)
day_response?: AcsiItemResponse
night_response?: AcsiItemResponse
// `response` remains populated as the roll-up for existing count/report code:
//   'fail' if either column fails; else 'pass' if either passes; else 'na'.
```

Counts (`passed`/`failed`/`na`) are derived from the roll-up `response`, so the
existing progress bar, KPIs, reports, and aggregations keep working with no
change. Worked example: Day=√, Night=✗ → `response='fail'` → counts as 1 failed,
one discrepancy required.

### PDF (civilian layout)

`lib/acsi-pdf.ts` renders the AC's table for civilian records:

```
FACILITIES | CONDITIONS            | D | N | REMARKS | RESOLVED BY (Date/Initials)
Pavement   | Pavement lips over 3" | ✗ | √ | ...     | 07-06 / JP
Areas      | Hole – 5" diam...     | √ | √ |         |
```

Day/Night inspector + time print in the header block (replacing the military
inspection-team / risk-cert PDF sections). Military PDF layout is untouched.

---

## Team + risk certification (civilian)

Per owner decision: **civilianize team roles, drop the risk-cert block.**

**Team roles** — add `PART139_TEAM_ROLES`, selected by mode:

```ts
// lib/constants.ts  (replaces ACSI_TEAM_ROLES on civilian)
export const PART139_TEAM_ROLES = [
  { value: 'ops',        label: 'Airport Operations',  required: true  },
  { value: 'maintenance',label: 'Airfield Maintenance', required: false },
  { value: 'arff',       label: 'ARFF',                required: false },
  { value: 'safety',     label: 'Safety / SMS',        required: false },
  { value: 'wildlife',   label: 'Wildlife',            required: false },
  { value: 'other',      label: 'Other',               required: false },
] as const
```

`createNewAcsiDraft(mode)` seeds the civilian team (Airport Operations required)
and seeds **no `signatures`** for civilian.

**Risk cert removed on civilian** — the `<AcsiRiskCert>` block is not rendered on
the civilian form; the `[id]` detail view hides `risk_cert_signatures`; the PDF
omits the risk-certification statement (already partly mode-aware). `signatures`
stays an empty array in the civilian record.

**Discrepancy panel ORM language** — `components/acsi/acsi-discrepancy-panel.tsx`
line ~222 renders a required **"Risk Control Measure"** field. Make its label
mode-aware: civilian shows **"Corrective Action"**. The file-time gate in
`new/page.tsx` (`missingRcmItems` — "Risk Control Measure is required on N items")
is reworded for civilian to "Corrective Action required on unsatisfactory items"
(requirement itself unchanged; only the wording — see O-2).

---

## Mode-selection mechanism

Add one selector and thread it (or the resolved arrays) through every consumer.
The form knows the mode from `getAirportType(currentInstallation)`; **stored
records resolve by their own `section_id`** so historical records are immune to a
base later flipping `airport_type`.

```ts
// lib/constants.ts (or lib/acsi-checklist.ts)
export function sectionsForAirportType(t: AirportType): AcsiChecklistSection[] {
  return t === 'faa_part139' ? PART139_CHECKLIST_SECTIONS : ACSI_CHECKLIST_SECTIONS
}
// Resolve section metadata for a STORED record item, mode-independent:
export function sectionMetaById(sectionId: string): AcsiChecklistSection | undefined {
  return [...ACSI_CHECKLIST_SECTIONS, ...PART139_CHECKLIST_SECTIONS]
    .find(s => s.id === sectionId)
}
```

`section_id` namespaces (`acsi-*` vs `p139-*`) never collide, so `sectionMetaById`
is unambiguous.

---

## Per-file changes

| File | Change |
|---|---|
| `lib/constants.ts` | Add `PART139_CHECKLIST_SECTIONS`, `PART139_DAYNIGHT_FIELDS`, `PART139_TEAM_ROLES`, `sectionsForAirportType`, `sectionMetaById`. Add optional `reference`/`subsection` usage same as military. USAF arrays untouched. |
| `lib/supabase/types.ts` | `AcsiItem`: add optional `day_response?`, `night_response?`. `AcsiDraftData`: add optional `day_inspector?`, `night_inspector?`. |
| `lib/acsi-draft.ts` | `createNewAcsiDraft(mode)` seeds civilian team + no signatures. `acsiDraftToItems(draft, { sections, dayNight })`: civilian branch emits one row/item with day/night responses + roll-up `response` + item-level discrepancy. Military branch unchanged. |
| `app/(app)/acsi/new/page.tsx` | Select `sections`/`fields`/`teamRoles` by mode. Civilian item renderer: inline Day/Night toggles + single discrepancy panel. Add Day/Night inspector cover fields. Hide `<AcsiRiskCert>` for civilian. Civilian file-gate wording. |
| `app/(app)/acsi/[id]/page.tsx` | Group by `section_id` (unchanged) but iterate the **resolved** sections array (`sectionMetaById` per group) instead of the hard-coded constant. Render Day/Night columns for civilian items. Hide `risk_cert_signatures` block for civilian records. Civilian team-role labels. |
| `lib/acsi-pdf.ts` | Walk resolved sections; civilian D/N-column table layout + civilian header (Day/Night inspector) and no risk-cert statement. `AcsiPdfOptions.airportType` already exists. |
| `components/acsi/acsi-discrepancy-panel.tsx` | "Risk Control Measure" label → mode-aware ("Corrective Action" on civilian). |
| `components/acsi/acsi-team-editor.tsx` | Accept a `roles` prop (mode-selected) instead of importing `ACSI_TEAM_ROLES` directly. |

`lib/supabase/acsi-inspections.ts` display-id prefix (`P139-`/`ACSI-`) is already
mode-aware from the prior session — **no change**.

---

## Historical-record safety

- Existing **USAF** records: items carry `section_id: 'acsi-*'` + stored
  `question` text; `sectionMetaById` resolves them to the military array; PDF and
  detail view render exactly as before. ✔
- New **civilian** records: `section_id: 'p139-*'`, resolved to the civilian
  array. ✔
- A base that flips `airport_type` after filing: old records still resolve by
  their stored `section_id`, so they render in their original form. ✔

---

## Testing (must run vitest — CI `verify` job runs `npm run test`)

- **Module gating unchanged:** `acsi.appliesTo` stays `['usaf','faa_part139']`;
  do **not** touch `tests/modules-config.test.ts` classification (this is the
  test that broke CI last session). Re-run it to confirm still green.
- **New unit tests:**
  - `PART139_CHECKLIST_SECTIONS` shape: 13 sections, ids `p139-1..13`, every item
    has an id + non-empty label; section count/item-count invariants (guard
    against silent drift).
  - `sectionsForAirportType` returns the civilian array for `faa_part139`, the
    military array otherwise.
  - `sectionMetaById` resolves both namespaces and returns `undefined` for junk.
  - `acsiDraftToItems` civilian branch: Day=fail/Night=pass → one item,
    `response='fail'`, `day_response='fail'`, `night_response='pass'`, one
    discrepancy; both `na` → `response='na'`, no discrepancy; counts correct.
  - Roll-up rule table (worked examples) locked as a regression guard.
- **Full gate before "verified":** `npx tsc --noEmit` · `npm run lint` (0 errors)
  · `npm run test` · `npm run build` — all four green (per repo commit gate).

---

## Open questions for owner review

- **O-1 — Annual vs daily framing.** AC 150/5200-18C's Day/Night model is a
  *daily* self-inspection; the ACSI module is currently *annual* (a `fiscalYear`
  field + a one-completed-per-fiscal-year rule, migration
  `2026070204_acsi_one_completed_per_fiscal_year`, "Inspection Year" label). The
  content swap is valid either way, but if the civilian form is meant to be a
  daily/periodic self-inspection, the year field + one-per-year constraint should
  probably not apply to civilian. **Options:** (a) leave the year scaffolding as
  is for now (smallest change; content swap only); (b) make the one-per-year
  constraint USAF-only and relabel the civilian date framing. Recommend (a) for
  this pass, tracked as a follow-up. **Not resolved here.**
- **O-2 — Corrective Action required?** Keep the "required on every
  unsatisfactory item" gate for civilian (just relabeled), or make it optional?
  Recommend keep-required (parity with military).
- **O-3 — Local/extra items.** Military has "Section 10 local items" (free-add).
  Civilian: rely on General Notes only, or also allow an "Other/Local" add-row?
  Recommend Notes-only for v1.

## Out of scope

- Other civilian-mode terminology leaks (`/discrepancies`, `/inspections`,
  `/checks`, `/qrc`, `/flip`, `/obstructions`) — separate backlog item.
- Reworking the annual→daily inspection cadence/constraints (O-1) beyond the
  minimal branch.
- Any change to the USAF ACSI checklist, PDF, or workflow.
