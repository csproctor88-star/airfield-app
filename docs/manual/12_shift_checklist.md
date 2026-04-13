# 12 — Shift Checklist

**Path:** Sidebar → Shift Checklist · Also accessible as a modal from the Dashboard · URL `/shift-checklist`

The Shift Checklist module provides configurable per-shift task tracking for Day, Mid, and Swing shifts. Base administrators define the items required for each shift. Personnel complete their tasks within the application; the checklist auto-resets at 0600 local time.

---

## Overview

Each installation defines a checklist per shift:
- **Day shift**
- **Mid shift**
- **Swing shift**

Items are free-form tasks like "Verify ARFF posture," "Review NOTAMs," "Sign for radio." Personnel cycle through each item as they complete it.

The checklist auto-resets every day at 0600 local time (configurable per installation). Each shift starts with a clean list.

---

## Key Concepts

| Concept | Meaning |
|---|---|
| **Item state** | Three states cycling: Unchecked → Completed → N/A → Unchecked. `is_na` boolean on the response. |
| **Auto-reset** | At 0600 local time (installation timezone), all items reset to unchecked. |
| **Progress bar** | Counts both Completed and N/A as "done." |
| **History view** | Prior shifts' completion records archived per day. |

---

## How to work through the shift checklist

### From the dedicated page

1. Open Shift Checklist.
2. Sections for Day / Mid / Swing; your current shift is highlighted.
3. Tap an item to cycle: **Unchecked → Completed → N/A**.
4. Progress bar updates live.

### From the Dashboard modal

1. Dashboard → tap the **Shift Checklist** badge or section.
2. A modal opens with the current shift's items.
3. Toggle items in place.
4. Close the modal when done — progress saves live.

## How to mark an item complete

Single tap (first state change).

## How to mark an item N/A

Tap twice (Unchecked → Completed → N/A).

## How to reset an item manually

Tap three times (cycles back to Unchecked).

## How to add a note to an item

If the item has a note field:
1. Long-press or tap the item's expand icon.
2. Enter note text.
3. Save.

## How to view prior shifts' checklists

1. Shift Checklist → **History** tab.
2. Date picker shows prior days.
3. Select a date to see completion records per shift.

---

## How the auto-reset works

- At 0600 local time in the installation's configured timezone, the server clears all item responses.
- The reset applies to all three shift checklists simultaneously.
- History entries for the prior day are preserved for review.

---

## Editing shift checklist items (admin)

1. Base Setup → **Shift Checklist** step.
2. Select shift (Day / Mid / Swing).
3. Add / edit / remove items:
   - Item label
   - Required? (optional items don't block completion)
   - Note field? (adds an optional text field)
4. Reorder via drag handles.
5. Save. Changes apply at next 0600L reset (or immediately for additions).

---

## Keyboard shortcuts

None specific to Shift Checklist.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Checklist didn't reset at 0600L | Installation timezone misconfigured | Base Setup → fix timezone. |
| N/A state not persisting | Pre-v2.30 behavior; is_na not supported | Update to v2.30+ for three-state cycle. |
| Can't see another shift's items | Each shift has its own items | Switch to the appropriate shift tab. |
| History missing a day | Reset didn't fire (server hiccup), or no shifts completed items that day | Contact support for a database backfill if needed. |
| Progress bar shows wrong percentage | Includes N/A as "done" (by design) | This is intentional — N/A items don't block completion. |

---

## Related manual files

- [02_dashboard.md](02_dashboard.md) — Quick-access modal.
- [19_events_log.md](19_events_log.md) — Shift completion events logged here.
- [21_base_setup.md](21_base_setup.md) — Item configuration.
