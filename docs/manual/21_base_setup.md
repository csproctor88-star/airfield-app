# 21 — Base Setup

**Path:** Sidebar → Settings → Base Setup · URL `/settings/base-setup`
**Who can access:** Airfield Manager, NAMO, Base Administrator, System Administrator

Base Setup is the configuration wizard for your installation. Installation basics (name, ICAO, timezone, elevation) are always available in the page header. Fifteen numbered wizard steps configure everything else — runways through customer feedback.

---

## Overview

Base Setup is a guided wizard. You can jump to any step at any time using the step navigator — it is non-linear but the numbering reflects a sensible initial setup order.

First-time setup: go through all 15 steps once. Ongoing maintenance: visit specific steps to add a new NAVAID, tweak inspection templates, update the PPR column layout, etc.

---

## The header — Installation basics

Always visible at the top of the Base Setup page (not a numbered step):

- **Installation name** — click to rename in place.
- **ICAO** — the airfield identifier (e.g., KBCV, KSSC). Feeds the NOTAM API and ICAO import.
- **Timezone** — drives the 0600L inspection one-per-day reset and shift checklist auto-reset.
- **Established Airfield Elevation** (feet MSL) — auto-populated from ICAO import.
- **Import from ICAO** button — pulls runway coordinates and metadata from the FAA NFDC (US) or OurAirports (worldwide) API.

---

## The 15 numbered wizard steps

| # | Step | Required? | What it configures |
|---|---|---|---|
| 1 | **Runways** | Yes | Runway designators, coordinates, dimensions, approach lighting |
| 2 | **Airfield Areas** | Yes | Named areas referenced by inspections and discrepancies (RWY 01/19, TWY A, East Ramp) |
| 3 | **Taxiways** | Yes | Taxiway designators for clearance envelopes, parking analysis, discrepancy location |
| 4 | **NAVAIDs** | Yes | NAVAID groups shown on Airfield Status (ILS, TACAN, PAPI, MALSR) as G/Y/R toggles |
| 5 | **CE Shops & Type Mapping** | Yes | Shops + per-discrepancy-type routing |
| 6 | **ARFF Vehicles** | Yes | Crash/rescue vehicles shown on Airfield Status ARFF panel |
| 7 | **Facilities** | Yes | Facility numbers and descriptions (Tower, Fire Station, Bldg 200) |
| 8 | **Inspection Templates** | Yes | Airfield + lighting inspection checklist items |
| 9 | **Shift Checklist** | Yes | Per-shift (Day / Swing / Mid) items with daily/weekly/monthly frequency |
| 10 | **QRC Templates** | Yes | Quick Reaction Checklists (seed from default library or customize) |
| 11 | **Wildlife Species** | Yes | Species list for the sighting / strike picker |
| 12 | **Lighting Systems** | No | DAFMAN 13-204v2 outage thresholds per system and component |
| 13 | **Status Boards** | No | Custom status panels on Airfield Status (Arresting Systems, Comm Status) |
| 14 | **PPR Columns** | No | Columns for the Prior Permission Required table |
| 15 | **Customer Feedback** | No | Public feedback form fields + QR code |

---

## Installation basics (header)

### How to rename the installation

1. Click the installation name in the header.
2. Edit the name in place.
3. Press Enter or click the check icon to save. Persists immediately.

### How to set ICAO, timezone, elevation

Values are in the header area; click the relevant field to edit. Timezone is a dropdown.

### How to import runway data from ICAO

1. Header → **Import from ICAO**.
2. OurAirports API (worldwide) or FAA NFDC survey coordinates (US) returns runway metadata.
3. Preview the import.
4. Confirm. Runways populate into step 1.

---

## Step 1 — Runways

### How to add or edit a runway

1. Step 1 → **+ Add Runway** (or tap an existing runway).
2. Inline edit form shows:
   - Runway designators (e.g., 18/36, 09/27)
   - Threshold coordinates (lat/lng both ends)
   - Length, width
   - True bearing (auto-computed from coordinates if both thresholds set)
   - Pavement type and classification
   - Associated approach lighting
3. Save.

### How to adjust runway endpoints on a map

1. Step 1 → runway row → **Adjust on Map**.
2. Map view opens with draggable threshold markers.
3. Drag a marker to its correct surveyed position.
4. Save. Coordinates update.

### How to delete a runway

Runway row → **Delete**. Confirms before execution.

---

## Step 2 — Airfield Areas

Named regions referenced by inspections, discrepancies, and reports.

1. Step 2 → **+ Add Area**.
2. Enter name (e.g., "RWY 01/19," "TWY A," "Main Ramp").
3. Optional description.
4. Save.

---

## Step 3 — Taxiways

Taxiway designators used in clearance envelopes and location references.

1. Step 3 → **+ Add Taxiway**.
2. Name (e.g., "A," "Alpha," "B1").
3. Optional centerline coordinates (for envelope rendering in Parking Plans).
4. Save.

---

## Step 4 — NAVAIDs

The NAVAID groups shown on Airfield Status as G/Y/R toggles.

1. Step 4 → **+ Add NAVAID**.
2. Name (e.g., "PAPI RWY 18L," "MALSR RWY 27," "TACAN").
3. Initial status (typically Operational).
4. Save.

Rename a NAVAID group later by clicking the name in the group row (edit mode).

---

## Step 5 — CE Shops & Type Mapping

Two responsibilities on this step: define CE shops, and configure per-discrepancy-type routing.

### How to add a CE shop

1. Step 5 → **Shops** tab → **+ Add Shop**.
2. Name (e.g., "Electrical," "Pavements," "HVAC").
3. Notes / description.
4. Save.

### How to configure type-to-shop mapping

1. Step 5 → **Type Mapping** tab.
2. For each discrepancy type, select the shop that should receive new discrepancies of that type.
3. Save. Stored on `bases.discrepancy_type_shop_map`.

New discrepancies automatically route to the mapped shop.

---

## Step 6 — ARFF Vehicles

Vehicles shown in the ARFF readiness panel on Airfield Status, plus a per-base toggle for the CAT dropdown.

### How to add an ARFF aircraft / vehicle

1. Step 6 → **+ Add Aircraft**.
2. Enter the aircraft / vehicle name (P-19, Striker, etc.).
3. Save. It appears immediately in the ARFF list and on Airfield Status.

### How to show or hide the CAT dropdown on Airfield Status

The CAT (Aircraft Rescue Category) dropdown displays values 6–10 on the Airfield Status page. Some bases report ARFF readiness only by aircraft type and don't use the CAT level.

1. Step 6 → top of the page, **Show CAT (Aircraft Rescue Category) dropdown on Airfield Status** toggle.
2. Toggle on → CAT dropdown visible (default).
3. Toggle off → CAT dropdown hidden; only per-aircraft readiness cards show in the ARFF section.
4. The setting is per-base and saves immediately. Other connected devices pick up the change next time they refresh the page.

Stored on `bases.arff_config.show_cat_dropdown`.

---

## Step 7 — Facilities

Facility numbers and descriptions referenced by discrepancies and inspections.

1. Step 7 → **+ Add Facility**.
2. Facility number, name, description.
3. Save.

---

## Step 8 — Inspection Templates

Configure airfield and lighting inspection checklists.

1. Step 8 → select **Airfield** or **Lighting**.
2. Add / remove / reorder sections.
3. Per section: add / remove / reorder items.
4. Per item:
   - Label (the question)
   - Severity if failed (drives auto-created discrepancy priority)
   - Linked infrastructure feature (optional — for NAVAID sync on failure)
   - Required?
5. Save.

Construction Meeting and Joint Monthly inspection types have their own templates under the same step.

---

## Step 9 — Shift Checklist

Define tasks tracked per shift (Day / Swing / Mid).

1. Step 9 → select shift.
2. Add / remove / reorder items.
3. Per item:
   - Label
   - Frequency (daily / weekly / monthly)
   - Required toggle
   - Optional note field
4. Save.

---

## Step 10 — QRC Templates

### How to add or edit a QRC

1. Step 10 → **+ New QRC** or tap an existing template.
2. Fill:
   - Name
   - Category (emergency / operational / contingency)
   - **has_scn_form** toggle (triggers Secondary Crash Net activation on execution)
3. Steps list:
   - Add / remove / reorder
   - Per step: label + **Step Type** dropdown
4. For Agency Notification steps, configure the agency list.
5. Save.

### Step type options

Eight step types available:
- **Checkbox** — simple tap-to-mark-done
- **Checkbox with Note** — checkbox plus an optional text note
- **Fill-in Field** — requires a typed value
- **Time Field** — Zulu time entry with "Now" shortcut
- **Notify Agencies** — agency list with confirmation
- **Conditional** — branching step (e.g., "if ARFF on scene, skip to step N")
- **Text** — read-only single line of guidance shown between actionable steps
- **Text Area** — read-only paragraph for multi-line instructions or references

### Seed from default library

First-time QRC setup can import a default library of 25 common QRCs. Look for the **Seed Defaults** button on the step.

---

## Step 11 — Wildlife Species

Species list that populates the picker in Wildlife sighting and strike forms.

1. Step 11 → select from a built-in species master list, or **+ Add Custom Species**.
2. Toggle species **Favorite** to sort to the top of the picker.
3. Save.

Species list is per-installation.

---

## Step 12 — Lighting Systems

Systems and components with DAFMAN 13-204v2 outage thresholds. Skip for now and complete later if needed — this is a detailed configuration.

1. Step 12 → **+ Add System** (e.g., "RWY 18L Edge Lights").
2. Define components under the system.
3. Set outage thresholds per DAFMAN 13-204v2 Table A3.1.
4. Save.

Features created in the Visual NAVAIDs map link to these components.

---

## Step 13 — Status Boards

Custom status panels on Airfield Status.

1. Step 13 → **+ New Board**.
2. Name (e.g., "Arresting Systems," "Comm Status").
3. Add items (label, default G/Y/R state).
4. Assign the board to a section on Airfield Status.
5. Save.

### Editable section headers on Airfield Status

Click a section header on the Airfield Status page to rename. Stored on `bases.status_labels`.

---

## Step 14 — PPR Columns

Configure the PPR log column structure.

1. Step 14 → **+ Add Column**.
2. Name and type (text, date, time, yes/no/na, phone, number, email).
3. Required toggle.
4. Drag to reorder; inline rename.
5. Save.

See [16_ppr.md](16_ppr.md).

---

## Step 15 — Customer Feedback

Configure the public feedback form fields + generate the QR code.

### How to configure form fields

1. Step 15 → **+ Add Field**.
2. Label and type:
   - Text
   - Textarea
   - Rating (1–5 stars)
   - Yes / No
   - Dropdown (with custom options)
3. Required toggle.
4. Drag to reorder.
5. Save.

### How to generate QR code

1. Step 15 → **Generate QR Code**.
2. Download PNG or PDF.
3. Print and post at FBO, Base Ops, etc.

See [17_customer_feedback.md](17_customer_feedback.md).

---

## Other configuration locations (not in Base Setup)

Some things the manual previously implied were in Base Setup are actually configured elsewhere:

- **Discrepancy types** — defined in code/constants, not configurable per-installation.
- **Events Log templates** — managed in the Events Log module itself.
- **Check templates** — the seven check types are fixed; forms live in `lib/constants.ts`.

---

## Who can access Base Setup

- Airfield Manager
- NAMO
- Base Administrator
- System Administrator

Other roles see a "Only Airfield Managers and System Admins can configure base settings" message.

---

## Invite users from Settings

User invites are handled in Settings → User Management, not Base Setup. See [22_user_management.md](22_user_management.md).

---

## Keyboard shortcuts

None specific to Base Setup.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Import from ICAO returns no runways | ICAO not in OurAirports or FAA database | Enter runways manually on Step 1. |
| Runway changes don't flow to obstruction evaluation | Obstruction uses coordinates at time of eval — re-run needed | Re-evaluate the obstruction. |
| Inspection template changes don't show on existing drafts | Drafts snapshot the template at creation | Start a new inspection. |
| Type-to-shop mapping missing for a type | Mapping not yet configured | Step 5 → Type Mapping tab. |
| QRC step type dropdown missing | Pre-v2.30 app | Update. |
| PPR column deletion lost data | Deleting a column deletes its data across all entries | Restore from backup; avoid column deletion. |
| Custom Status Board not appearing on Airfield Status | Not assigned to a section | Step 13 → assign to a section. |
| Wildlife species not in picker | Not added to this installation's list on Step 11 | Add the species. |
| "Only Airfield Managers..." message | Your role lacks access | Ask an Airfield Manager, NAMO, Base Admin, or System Admin. |

---

## Related manual files

Every module. Base Setup configures behavior across the app.
