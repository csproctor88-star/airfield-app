# 24 — Flight Planning Room Check

**Path:** Sidebar → Flight Planning Room (daily-ops section) · Also on the Menu (`/more`) on mobile · URL `/fpr`
**Module status:** Off by default. An Airfield Manager, NAMO, or Base Administrator enables it at **Base Configuration → Modules** (`/base-config/modules`) before it appears anywhere in the app.

The Flight Planning Room Check module gives each shift a per-item record of the Flight
Planning Room check — FLIP currency, charts, forms, NOTAM display, and similar materials —
instead of a single free-text Events Log entry. The check itself is a locally developed
procedure under DAFMAN 13-204 Volume 2; this module does not prescribe a fixed national item
list — each base builds its own checklist in Base Setup. Personnel work through it once per
shift, mark every item Satisfactory, Issue, or N/A, and log the check. Completed checks build
a 30-day history and export to a monthly PDF.

---

## Overview

The Flight Planning Room page shows one card per active shift (Day, Swing, Mid — however
many shifts the base runs). A card is amber and reads "Not yet completed this shift" until
someone starts and logs the check; it turns green with a completion summary, the Zulu
completion time, and the completing person's operating initials once logged.

Starting a check opens a modal with one row per active checklist item. Each row has three
buttons — Satisfactory, Issue, N/A — plus an optional guidance line under the item label that
clarifies what "Satisfactory" means for that item. Selecting Issue opens a required-notes
prompt; the check cannot be saved while an Issue row has no notes. A "Mark All Satisfactory"
quick-fill button appears whenever any row isn't already Satisfactory.

On save, the check appears on the Events Log (`/activity`) with a one-line summary — for
example, *"Day Shift Flight Planning Room check complete — all items satisfactory"* or
*"…issues: Enroute charts (superseded edition on rack), N/A: Printer/forms stock."*

---

## Key Concepts

| Concept | Meaning |
|---|---|
| **Checklist item** | A locally defined line item (label + optional guidance) configured per base in Base Setup → Flight Planning Room Checklist. |
| **Shift card** | One card per currently active shift. A base running 1 shift sees one card; a 3-shift base sees three. |
| **Satisfactory / Issue / N/A** | The three states for each item. Issue requires notes describing the problem before the check can be saved. |
| **Operating Initials (OI)** | Recorded automatically from the signed-in user's profile when a check is completed. |
| **Re-run / Edit** | Opening a completed check's modal again edits it in place — there is no separate "new check" for a shift that already logged one. |
| **History** | The past 30 days of checks, newest first, each expandable to the full per-item result table. |
| **Monthly PDF** | A chronological log for a selected month — date, shift, completion time, initials, and result, with a footnote listing each Issue's item and notes. |

---

## How to work through a Flight Planning Room check

1. Open **Flight Planning Room** from the sidebar, or from the Menu (`/more`) on mobile.
2. Find your shift's card and click **Start Check**.
3. For each item, tap **Satisfactory**, **Issue**, or **N/A**.
4. If you tap **Issue**, a notes box opens — describe the issue (e.g., "Enroute charts —
   superseded edition on the rack. Replacement ordered."). You cannot save the check until
   every Issue row has notes.
5. Add any overall notes in the optional textarea.
6. Review the **Events Log preview** — this is the exact line that will appear on the Events
   Log.
7. Click **Log Check**.

## How to mark every item Satisfactory at once

Click **Mark All Satisfactory** above the item list. It only appears when at least one item
isn't already marked Satisfactory, and it does not override items you've already set to Issue
or N/A until you click it.

## How to re-run or edit a completed check

1. On the shift's card (or in History), click **Re-run / Edit**.
2. The modal reopens with the check's saved item statuses and notes.
3. Make changes and click **Log Check** again — this updates the same check rather than
   creating a second one for the shift.

## How to delete a check

Click **Delete** on the shift's card or on a History row. Confirm the prompt. This cannot be
undone.

## How to view check history

Scroll to **Past 30 Days** below the shift cards. Click a row to expand the full per-item
result table, including notes on any Issue items.

## How to export the monthly PDF

1. Under **Monthly Report**, pick the month.
2. Click **Download PDF**.
3. The PDF lists every check that month in date order with shift, completion time, initials,
   and result, plus a footnote for every Issue with its item label and notes.

---

## Editing the Flight Planning Room checklist (admin)

The checklist is configured per base in Base Setup, alongside the Shift Checklist, QRC
templates, and SCN Agencies steps.

1. Go to **Settings → Base Setup → Flight Planning Room Checklist**. (The step only appears once the module is
   enabled — see below.)
2. If the checklist is empty, click **Load Default Checklist** to insert a suggested starting
   point (FLIP currency, charts, forms, NOTAM display, airfield diagram, weather access,
   planning-area equipment, local flight guides). Treat these as a starting point, not a fixed
   list — rename, reorder, deactivate, or add items to match local procedures.
3. To add an item: enter a label (and optional guidance) and click **Add**.
4. To rename an item or change its guidance: click **Edit**, update the fields, and **Save**.
5. To reorder: use the up/down arrows on each row. Order here is the order items appear on the
   check page.
6. To retire an item without losing history: click **Active** to toggle it to **Inactive**.
   Inactive items no longer appear on new checks, but completed checks that included them still
   show the item in history and on the monthly PDF.
7. To remove an item permanently: click the **×** and confirm. This cannot be undone — prefer
   deactivating an item you might reuse later.

Editing the checklist never changes history: every completed check keeps the item label as it
read at the time the check was logged, even if the item is later renamed or deleted.

## Enabling the module

Flight Planning Room Check is off by default (it ships opt-in, the same way Read File and FLIP
Management do). To turn it on:

1. Go to **Base Configuration → Modules** (`/base-config/modules`).
2. Enable **Flight Planning Room Check**.
3. The sidebar entry, the Menu entry, and the Base Setup → Flight Planning Room Checklist step all appear
   automatically once enabled — no separate configuration is needed to reveal them.

---

## Keyboard shortcuts

None specific to Flight Planning Room Check.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Flight Planning Room doesn't appear in the sidebar or Menu | Module not enabled | Base Configuration → Modules → enable Flight Planning Room Check. |
| Base Setup has no Flight Planning Room Checklist step | Module not enabled | Same as above — the step appears automatically once the module is on. |
| "No checklist configured" banner, Start disabled | No active checklist items at this base | Base Setup → Flight Planning Room Checklist → Load Default Checklist or add items. |
| Can't save a check with an Issue row | Issue rows require notes | Add notes describing the issue, then save. |
| Renamed a checklist item and an old check's history changed unexpectedly | Should not happen — history snapshots the label at completion time | If this occurs, note the check ID and report it; it indicates a data issue, not expected behavior. |
| A shift's card is missing after reducing shift count | Only currently active shifts get a card | The historical check for the now-inactive shift still appears in History and the monthly PDF. |

---

## Related manual files

- [12_shift_checklist.md](12_shift_checklist.md) — the same per-shift, admin-configured
  checklist pattern.
- [19_events_log.md](19_events_log.md) — completed Flight Planning Room checks are logged here.
- [21_base_setup.md](21_base_setup.md) — where the Flight Planning Room Checklist is configured.
