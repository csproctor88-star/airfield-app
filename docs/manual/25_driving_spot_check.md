# 25 — Airfield Driving Spot Check

**Path:** Sidebar → Driving Spot Checks (daily-ops section) · Also on the Menu (`/more`) on mobile · URL `/driving-checks`
**Module status:** Off by default. An Airfield Manager, NAMO, or Base Administrator enables it at **Base Configuration → Modules** (`/base-config/modules`) before it appears anywhere in the app.

The Airfield Driving Spot Check module gives Airfield Management personnel a structured record
of random enforcement checks of the airfield driving program — driver identification, AF Form
483 verification, vehicle details, and a locally configured list of pass/discrepancy items —
instead of a single free-text Events Log entry. Checks are random and unbounded per day; there is
no "one per shift" limit like the Flight Planning Room check. Each check builds a filterable
history and a common-discrepancy, pass-rate, and by-checker report suitable for the Airfield
Operations Board (AOB), under DAFI 13-213, Airfield Driving, and the local wing supplement.

---

## Overview

The Driving Spot Checks page shows a stat strip (total checks, pass rate, discrepancy count,
violation count) over a filterable history of every check logged in the selected date range,
newest first. A **Start Spot Check** button opens the check form.

The check form has five sections:

1. **Driver** — name (required), rank, unit/squadron, office symbol, phone. If any contractors
   are on file, a **Look up contractor** search prefills the driver's name, unit, phone, and AF
   Form 483 expiration from the matched contractor record.
2. **AF Form 483** — Valid / Expired / Not in Possession / None Issued, plus an optional observed
   card expiration date.
3. **Vehicle** — Government / Contractor / POV / Other, plus a vehicle ID (registration or USAF
   number) and, for POV, a pass number.
4. **Check Items** — one row per active item configured in Base Setup, each toggled Pass /
   Discrepancy / N/A. Selecting Discrepancy opens a required-notes prompt; the check cannot be
   saved while a Discrepancy row has no notes. A **Mark All Pass** quick-fill button appears
   whenever any row isn't already Pass.
5. **Location** — free text with suggestions drawn from your configured airfield areas, plus an
   **Airfield driving violation** checkbox that, when checked, requires a description before the
   check can be saved.

The **Outcome** is computed automatically, not chosen directly:

- Any AF Form 483 status other than Valid, or the violation checkbox checked → **Violation**.
- Otherwise, any check item marked Discrepancy → **Discrepancy**.
- Otherwise → **Pass**.

On save, the check appears on the Events Log (`/activity`) with a one-line summary — for example,
*"Airfield Driving Spot Check — SSgt Snuffy, 100 ARW/SE — AF Form 483 Valid — Pass (Taxiway A)"*
or *"…A1C Doe — AF Form 483 Expired — Violation: Operating without a valid card (Gate 5)"*.

---

## Key Concepts

| Concept | Meaning |
|---|---|
| **Check item** | A locally defined line item (label + optional guidance) configured per base in Base Setup → Driving Check Items. |
| **Pass / Discrepancy / N/A** | The three states for each item. Discrepancy requires notes describing the problem before the check can be saved. |
| **AF Form 483** | The airfield driving credential. Anything other than Valid drives the check's outcome to Violation regardless of item results. |
| **Airfield driving violation** | An explicit flag, independent of item results and 483 status, for observed violations of the driving program. Requires a description. |
| **Outcome** | Pass, Discrepancy, or Violation — computed from 483 status, item results, and the violation flag; not directly editable. |
| **Contractor lookup** | Searches active contractor records by company, contact, or callsign and prefills driver and 483 fields from the matched record. |
| **History** | Every check in the selected date range, newest first, filterable by result and by checker, each expandable to the full detail and per-item result table. |
| **AOB report (PDF)** | An Airfield Operations Board-ready export: totals, pass rate, common discrepancies, and a by-checker breakdown for a selected date range. |

---

## How to log a spot check

1. Open **Driving Spot Checks** from the sidebar, or from the Menu (`/more`) on mobile.
2. Click **Start Spot Check**.
3. Enter the driver's name (required). If the driver is a contractor on file, click **Look up
   contractor** and select them — this prefills name, unit, phone, and 483 expiration.
4. Set the **AF Form 483** status observed on the card (Valid / Expired / Not in Possession /
   None Issued). Enter the observed expiration date if useful.
5. Set the **Vehicle** type and, if applicable, the vehicle ID or POV pass number.
6. For each check item, tap **Pass**, **Discrepancy**, or **N/A**. If you tap **Discrepancy**, a
   notes box opens — describe the discrepancy (e.g., "Rotating beacon inoperative; driver advised
   to correct before next operation."). You cannot save the check until every Discrepancy row has
   notes.
7. Enter the **Location** (suggestions come from your configured airfield areas).
8. If you observed an airfield driving violation, check **Airfield driving violation** and
   describe it — this is required once the box is checked.
9. Add any overall notes in the optional textarea.
10. Review the **Events Log preview** — this is the exact line that will appear on the Events Log.
11. Click **Log Spot Check**.

## How to mark every check item Pass at once

Click **Mark All Pass** above the item list. It only appears when at least one item isn't already
marked Pass, and it does not override items you've already set to N/A or clear a Discrepancy's
notes until you click it.

## How to edit a logged check

1. In History, click **Edit** on the check.
2. The form reopens with the check's saved fields, items, and notes.
3. Make changes and click **Save Changes**. This updates the same check — it does not change who
   is credited with conducting it; attribution always stays with whoever originally logged the
   check.

## How to delete a check

Click **Delete** on a History row. Confirm the prompt. This cannot be undone.

## How to filter and review history

1. Set the **From** / **To** date range (defaults to the last 30 days).
2. Narrow by **Result** (All / Pass / Discrepancy / Violation) or by **Checker**.
3. Click a row to expand the full detail — driver, 483 status, vehicle, location, per-item
   results with notes, violation description (if any), and a link to the contractor record when
   the driver was matched from one.
4. The stat strip above the history reflects the currently applied filters.

## How to export the AOB report (PDF)

1. Under **Export Report**, pick the **From** / **To** date range.
2. Click **Export Report (PDF)**.
3. The PDF lists total checks, pass rate, discrepancy and violation counts, the most common
   discrepancy items, and a by-checker breakdown for that date range — independent of the history
   filters above it (the export always covers its own selected range).

---

## Editing the check item list (admin)

The item list is configured per base in Base Setup, alongside the FPR Checklist, Shift Checklist,
and QRC templates steps.

1. Go to **Settings → Base Setup → Driving Check Items**. (The step only appears once the module
   is enabled — see below.)
2. If the list is empty, click **Load Default Items** to insert a suggested starting point
   (two-way radio contact, FOD tire check, vehicle beacon/lighting, seat belts, speed limit
   compliance, vehicle serviceability, light-gun signal knowledge, escort procedures). Treat these
   as a suggested starting point, not a fixed list — rename, reorder, deactivate, or add items to
   match local wing-supplement procedures.
3. To add an item: enter a label (and optional guidance) and click **Add**.
4. To rename an item or change its guidance: click **Edit**, update the fields, and **Save**.
5. To reorder: use the up/down arrows on each row. Order here is the order items appear on the
   Start Spot Check form.
6. To retire an item without losing history: click **Active** to toggle it to **Inactive**.
   Inactive items no longer appear on new checks, but completed checks that included them still
   show the item in history and on the AOB report.
7. To remove an item permanently: click the **×** and confirm. This cannot be undone — prefer
   deactivating an item you might reuse later.

AF Form 483 verification is always a dedicated field on the check, not an item in this list — do
not try to add one.

Editing the item list never changes history: every logged check keeps the item label as it read
at the time the check was logged, even if the item is later renamed or deleted.

## Enabling the module

Airfield Driving Spot Check is off by default (it ships opt-in, the same way Flight Planning Room
Check does). To turn it on:

1. Go to **Base Configuration → Modules** (`/base-config/modules`).
2. Enable **Airfield Driving Spot Check**.
3. The sidebar entry, the Menu entry, and the Base Setup → Driving Check Items step all appear
   automatically once enabled — no separate configuration is needed to reveal them.

---

## Keyboard shortcuts

None specific to Airfield Driving Spot Check.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Driving Spot Checks doesn't appear in the sidebar or Menu | Module not enabled | Base Configuration → Modules → enable Airfield Driving Spot Check. |
| Base Setup has no Driving Check Items step | Module not enabled | Same as above — the step appears automatically once the module is on. |
| Start Spot Check form shows no check items | No active items configured at this base | Base Setup → Driving Check Items → Load Default Items or add items. Driver identity, AF Form 483, and location still make a valid check even with no items. |
| Can't save a check with a Discrepancy row | Discrepancy rows require notes | Add notes describing the discrepancy, then save. |
| Can't save with the violation box checked | The violation description is required once checked | Describe the violation, then save. |
| Contractor lookup doesn't appear | No active contractors on file at this base | Add contractors in Personnel on Airfield & Contractors, or enter driver details manually. |
| Editing a check moved it to a different checker in the by-checker report | Should not happen — edits never reassign attribution | If this occurs, note the check ID and report it; it indicates a data issue, not expected behavior. |

---

## Related manual files

- [24_flight_planning_room.md](24_flight_planning_room.md) — the sibling per-item admin-configured
  check module.
- [20_personnel.md](20_personnel.md) — Personnel on Airfield & Contractors, source of the
  contractor lookup and AF Form 483 credential data.
- [19_events_log.md](19_events_log.md) — completed spot checks are logged here.
- [21_base_setup.md](21_base_setup.md) — where the Driving Check Items list is configured.
