# 06 — Discrepancy Management

**Path:** Sidebar → Discrepancies · URL `/discrepancies`

Discrepancies are airfield deficiencies tracked from open through closure. The module provides the full lifecycle across 11 discrepancy types, with Civil Engineering routing, photo and map documentation, aging analytics, and a Common Operating Picture map view.

---

## Overview

Every discrepancy has:
- A **type** (lighting, pavement, signage, etc.)
- A high-level **status** — `open`, `completed`, or `cancelled`
- A workflow-stage **current_status** that tracks where an open item is in the routing chain
- A **priority** level
- A **location** (map pin)
- Optional **photos**, notes, assigned shop, work order number
- Full **status update history** on `discrepancy_status_updates`

Discrepancies can be created manually, auto-generated from daily inspection fails, or auto-created from NAVAID outages.

---

## Key Concepts

| Concept | Meaning |
|---|---|
| **Status** (high-level) | `open`, `completed`, or `cancelled`. Completed is what the UI calls "Closed." |
| **Current Status** (workflow stage, for open items) | Where the open discrepancy sits in the routing chain. Five values: `submitted_to_afm`, `submitted_to_ces`, `awaiting_action_by_ces`, `waiting_for_project`, `work_completed_awaiting_verification`. |
| **Type-to-shop mapping** | Per-installation JSONB (`bases.discrepancy_type_shop_map`) that routes each discrepancy type to a CE shop. Configured in Base Setup. |
| **Work Order (W/O) #** | Free-text field for CES's internal tracking reference. |
| **Assigned To** | The CES shop handling the work. |
| **Common Operating Picture (COP)** | Map view showing all active discrepancies with severity color-coding. |
| **Linked infrastructure feature** | Discrepancies can link to a Visual NAVAID feature for bidirectional traceability. |
| **Status Update** | An entry in `discrepancy_status_updates` recording each status change with user attribution. |

---

## How to create a discrepancy

1. Discrepancies list → **+ New Discrepancy**.
2. Fill:
   - **Type** (select from the 11 configured types)
   - **Title** (short description; natural language inferred from context if coming from an inspection)
   - **Description** (details)
   - **Priority** (routine / priority / urgent / emergency)
   - **Location** (click the map to drop a pin, or use current GPS)
   - **Photos** (multi-upload supported; "Use Camera" button on mobile uses rear camera)
3. **Create**.
4. The discrepancy is routed to the CES shop mapped to its type (if any).

## How to view the discrepancies list

1. Open the Discrepancies module.
2. The list shows all open discrepancies with status, age, type, assigned, priority, and location pin.
3. Filter tabs at the top:
   - **All**
   - **Open**
   - **Pending W/O** (no work order number assigned yet)
   - **Closed**
4. Sort by column: age, priority, type, assigned.

## How to open a discrepancy's detail view

Tap the row. Detail view shows:
- Header with title, status, priority, type
- Description
- Photos (tap to enlarge)
- Map with location pin
- **NAVAID card** if linked to an infrastructure feature (shows the feature's position on the system map)
- Status update history timeline
- Attachments

## How to edit a discrepancy

1. Detail view → **Edit** (pencil icon).
2. The edit modal opens with all fields.
3. Change **title, description, type, priority, location**, plus:
   - **Work Order #** (free text)
   - **Assigned To** (select from users)
4. Save.

Status changes are separate from the edit modal — see next recipe.

## How to change a discrepancy's status

1. Detail view → **Update Status** button.
2. Select the new status from the available options (depending on your role).
3. Optional status note.
4. Save.
5. A new entry appears in the Status Updates history with your name, OI, and timestamp.

### Status options by role

| Role | Available statuses |
|---|---|
| AFM / AMOPS / Admin | All statuses including Close and Verify |
| CES | Only In Work, Project, Work Completed (cannot close or verify) |
| Read-only roles | None |

### Lifecycle flow (typical)

A new discrepancy starts with `status = open`. While open, its `current_status` moves through the workflow:

```
open + submitted_to_afm
 ↓
open + submitted_to_ces
 ↓
open + awaiting_action_by_ces
 ↓
open + work_completed_awaiting_verification  (CES sets this)
 ↓
status = completed                              (AFM verifies, UI shows "Closed")
```

`waiting_for_project` is a branch for longer-term items that need funded project work.
`status = cancelled` is the path for discrepancies that turned out not to apply (false report, duplicate, etc.).

## How to attach more photos to an existing discrepancy

1. Detail view → scroll to photos section.
2. Tap **Add Photos**.
3. Choose from camera or file upload (multiple allowed).
4. Photos attach immediately.

## How to link a discrepancy to a Visual NAVAID feature

Discrepancies can be linked to a specific infrastructure feature (runway edge light, sign, PAPI, etc.) for traceability.

### Auto-link (from outage)

Reporting a NAVAID outage in Visual NAVAIDs auto-creates a discrepancy with the feature linked. You don't need to do anything manually.

### Manual link

1. Discrepancy detail → **Link Feature** (or click **Browse Infrastructure** in the new-discrepancy form).
2. The infrastructure picker opens.
3. Filter by type or select from the map.
4. Confirm.
5. The linked feature appears as a NAVAID card on the detail page.

## How to close a discrepancy

1. Detail view → **Update Status** → **Closed**.
2. Optional close note.
3. Save.
4. If the discrepancy is linked to a NAVAID, a prompt asks to mark the feature Operational with your attribution + Zulu timestamp.

## How to view the Common Operating Picture (COP) map

1. Discrepancies list → **Map View** toggle (or tap the map icon).
2. Every active discrepancy appears as a pin on the installation's satellite map.
3. Pins are color-coded by priority.
4. Tap a pin to open a popup with title, status, age.
5. Tap again to open the detail page.

## How to filter the COP

- Filter controls at the top of the map view: by type, status, priority, aging tier.
- Layer toggles for discrepancies / runways / taxiways / NAVAIDs.

## How to export a single discrepancy to PDF

1. Detail view → **Export PDF**.
2. Generates a structured single-discrepancy report with all photos, map, and history.
3. Downloads or opens in Email PDF modal.

## How to export a filter-based summary PDF

1. Discrepancies list → apply filters (date range, type, status, priority).
2. Click **Export Filtered PDF**.
3. Choose template (Summary / By Type / Aging / Lighting).
4. Generates a multi-page PDF covering every matching discrepancy.

See [18_reports_analytics.md](18_reports_analytics.md) for report details.

---

## Keyboard shortcuts

None specific to Discrepancies.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| CES user doesn't see a discrepancy they should | Type-to-shop mapping doesn't route the type to their shop | Admin: Base Setup → CE Shops → fix the mapping. |
| Can't update status to Closed | Your role is CES (no close authority) | Ask AFM or admin to verify and close. |
| Linked NAVAID card not showing | Discrepancy not linked (`infrastructure_feature_id` is NULL) | Edit the discrepancy → Link Feature. |
| Status update not appearing in history | The update hit `discrepancies` but `discrepancy_status_updates` failed (rare) | Contact support; manually add a note in description. |
| Photos missing in PDF | Photo load failed at export | Preview photos in detail page first; re-export. |
| Activity log spam | Legacy behavior pre-v2.28 (fixed) | Update app; CRUD no longer writes to `activity_log`, status_updates table is authoritative. |
| Mass closure needed (e.g., completed project) | No bulk close feature | Manual one-at-a-time, or contact support for a database operation. |

---

## Related manual files

- [04_daily_inspections.md](04_daily_inspections.md) — Inspection fails auto-create discrepancies.
- [07_ces_work_orders.md](07_ces_work_orders.md) — CES-specific dashboard for discrepancy work.
- [08_visual_navaids.md](08_visual_navaids.md) — NAVAID outages auto-create linked discrepancies.
- [18_reports_analytics.md](18_reports_analytics.md) — Discrepancy aging, summary, by-type reports.
- [21_base_setup.md](21_base_setup.md) — Discrepancy types and type-to-shop mapping configuration.
