# Activity Log Detail Templates

> **Instructions**: Edit each section below to define exactly what details should appear in the Events Log for each automatic action. The "Current" column shows what's logged today. Fill in the "Desired" column with what you want. Leave "Desired" blank to keep as-is.
>
> When you're done editing, hand this file back for implementation.

---

## How It Works

Each automatic event logs: **Action** + **Entity Display ID** + **Details**

Example event log entry:
> `[2026-03-08 14:30] updated — RWY 18/36 OPEN — Status: OPEN | Notes: Wind shifted`

The **Details** column below controls that last part after the dash.

---

## 1. Airfield Status — Runway Status

| Action | Entity Display ID | Current Details | Desired Details |
|--------|-------------------|-----------------|-----------------|
| status_updated | `RWY 18 OPEN` | `runway: 18/36 | status: open | notes: ...` | STATUS: OPEN, DUE TO:...|

## 2. Airfield Status — Active Runway Change

| Action | Entity Display ID | Current Details | Desired Details |
|--------|-------------------|-----------------|-----------------|
| updated | `Active runway changed to 18` | `old_runway: 36 | new_runway: 18 | notes: ...` | ACTIVE RWY CHANGED TO: , REPORTED BY:...|
| updated (single runway) | `Active runway changed to 18` | `active_runway: 18 | notes: ...` | ACTIVE RWY CHANGED TO: , REPORTED BY:...|

## 3. Airfield Status — RSC (Runway Surface Condition)

| Action | Entity Display ID | Current Details | Desired Details |
|--------|-------------------|-----------------|-----------------|
| updated | `RSC 5` | `old_value: 3 | new_value: 5 | notes: ...` | RSC REPORTED AS: |

## 4. Airfield Status — BWC (Braking Weather Condition)

| Action | Entity Display ID | Current Details | Desired Details |
|--------|-------------------|-----------------|-----------------|
| updated | `BWC GOOD` | `old_value: FAIR | new_value: GOOD | notes: ...` |BWC CHANGED TO: |

## 5. Airfield Status — ARFF Category

| Action | Entity Display ID | Current Details | Desired Details |
|--------|-------------------|-----------------|-----------------|
| updated | `ARFF CAT 7` | `old_cat: 5 | new_cat: 7 | notes: ...` |ARFF STATUS CHANGED TO: , DUE TO:... |

## 6. Airfield Status — ARFF Vehicle Status

| Action | Entity Display ID | Current Details | Desired Details |
|--------|-------------------|-----------------|-----------------|
| updated | `P-23 IN-SERVICE` | `status: IN-SERVICE | remarks: ...` |ARFF VEHICLE STATUS CHANGED TO: |

## 7. Airfield Status — Weather Advisory/Warning/Watch

| Action | Entity Display ID | Current Details | Desired Details |
|--------|-------------------|-----------------|-----------------|
| updated | `Weather WARNING` | `type: WARNING | text: High winds expected` |WX WARNING, ... |
| updated (cleared) | `Weather Info Cleared` | `old_type: WARNING` |WX WARNING CANCELED |

## 8. NAVAID Status

| Action | Entity Display ID | Current Details | Desired Details |
|--------|-------------------|-----------------|-----------------|
| updated (status change) | `TACAN` | `navaid: TACAN | changed_to: OUTAGE | reason: ...` |NAVAID: , STATUS CHANGED TO: , DUE TO:... |
| updated (remarks only) | `TACAN` | `navaid: TACAN | reason: Scheduled maintenance` |NAVAID: , DUE TO:... |

## 9. Personnel / Contractors

| Action | Entity Display ID | Current Details | Desired Details |
|--------|-------------------|-----------------|-----------------|
| logged_personnel | *(none)* | `callsign: Alpha | radio: Ch 5 | flag: RED | notes: ...` |COMPANY_NAME ON AFLD, TO:... |
| personnel_off_airfield | *(none)* | `callsign: Alpha | location: RWY 18` | COMPANY_NAME OFF AFLD, WORK CMPLT FOR THE DAY|
| updated | `ACME Corp` | `company_name: ACME | callsign: Alpha | location: ...` |COMPANY_NAME WORK UPDATED |

## 10. Airfield Checks

| Action | Entity Display ID | Current Details | Desired Details |
|--------|-------------------|-----------------|-----------------|
| completed | `CHK-0042` | `status: completed | any_issues: true | any_failures: false | comments: ...` |AFLD CK CMPLT. BWC: , RSC: , ISSUE: , OR NONE IF NO ISSUE FOUND |
| saved (draft) | `CHK-0042` | `check_type: daily` | AFLD CHECK PROGRESS SAVED, NOT COMPLETED|
| updated (notes) | `CHK-0042` | `notes: Added repair note` | AFLD CHECK UPDATED |


## 11. Inspections

| Action | Entity Display ID | Current Details | Desired Details |
|--------|-------------------|-----------------|-----------------|
| completed | `INS-0015` | `inspection_type: daily | completion_percent: 100 | items_reviewed: 45 | bwc_result: GOOD` |AFLD INSPECTION COMPLETE. BWC: , RSC: , DISCREPANCIES FOUND: , REMARKS:... |
| saved (draft) | `INS-0015` | `inspection_type: daily | completion_percent: 60 | items_reviewed: 27` |AFLD INSPECTION IN-PROGRESS, PERCENTAGE COMPLETE: , BY: USER WHO LAST SAVED |
| updated (notes) | `INS-0015` | `notes: Updated findings` |UPDATED AIRFIELD INSPECTION FORM|


## 12. ACSI Inspections REMOVE FROM AUTO EVENTS LOG ENTRY

| Action | Entity Display ID | Current Details | Desired Details |
|--------|-------------------|-----------------|-----------------|
| filed | `ACSI-0003` | `completion_percent: 100 | items_reviewed: 98 | total_items: 100 | discrepancy_notes: ...` | |
| saved (draft) | `ACSI-0003` | `completion_percent: 75 | items_reviewed: 75 | total_items: 100` | |
| deleted | `ACSI-0003` | *(empty)* | |

## 13. Discrepancies

| Action | Entity Display ID | Current Details | Desired Details |
|--------|-------------------|-----------------|-----------------|
| created | `DISC-0021` | `title: Pothole RWY 18 | location: RWY 18 | severity: major | notam_reference: ...` | REMOVE SEVERITY|
| updated | `DISC-0021` | `title: ... | location: ... | description: ... | work_order: ...` | |
| status_updated | `DISC-0021` | `new_status: resolved | resolution_notes: Patched | assigned_shop: CE` | |
| cancelled | `DISC-0021` | `new_status: cancelled | resolution_notes: Duplicate` | |
| deleted | `DISC-0021` | `title: Pothole RWY 18` | |

## 14. Waivers REMOVE FROM AUTO EVENTS LOG ENTRY

| Action | Entity Display ID | Current Details | Desired Details |
|--------|-------------------|-----------------|-----------------|
| created | `W-2026-001` | `classification: temporary | status: active` | |
| updated | `W-2026-001` | *(lists changed field names only)* | |
| status_updated | `W-2026-001` | `new_status: expired` | |
| reviewed | *(none)* | `assigned_to: ... | notes: ... | facilities_board: ...` | |
| deleted | `W-2026-001` | *(empty)* | |

## 15. Obstruction Evaluations

| Action | Entity Display ID | Current Details | Desired Details |
|--------|-------------------|-----------------|-----------------|
| created | `OBS-0005` | `survey_date: 2026-03-01 | location: ... | height: 45ft | controlling_surface: ... | violated_surfaces: ...` |EVALUATED NEW OBSTRUCTION: (TITLE), ONLY IF A VIOLATION EXISTS, WHERE VIOLATION IS, VIOLATION HEIGHT AND USER REMARKS|
| updated | `OBS-0005` | `survey_date: ... | location: ... | height: ...` | |


## 16. QRCs (Quick Reaction Checklists)

| Action | Entity Display ID | Current Details | Desired Details |
|--------|-------------------|-----------------|-----------------|
| opened | `QRC-1` | `title: Bird Strike Response` | |
| closed | `QRC-1` | `title: Bird Strike Response` | |
| cancelled | `QRC-1` | `title: Bird Strike Response` | |

## 17. Manual Entries

| Action | Entity Display ID | Current Details | Desired Details |
|--------|-------------------|-----------------|-----------------|
| noted | *(none)* | *(free text typed by user)* | |

---

## Notes

- **Pipe `|`** separates fields in the details column
- Fields with `...` are variable (user-entered text)
- Fields shown as `old_value → new_value` can be formatted that way if preferred
- Any field can be removed by leaving it out of the Desired column
- New fields can be added if the data is available in the app
