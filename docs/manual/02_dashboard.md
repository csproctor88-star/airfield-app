# 02 — Dashboard

**Path:** Sidebar → Dashboard · Mobile bottom tab → Dashboard · URL `/dashboard`

---

## Overview

The Dashboard is organized into four bands (top to bottom):

1. **Inspection status strip + Quick actions** — inspection-of-the-day status and large pill buttons for common workflows.
2. **AFM Out of Office toggle** — visible to AFM, AMOPS, and admins.
3. **Recent Activity feed** — a unified stream of the last ~20 events across the system.

---

## Key Concepts

| Concept | Meaning |
|---|---|
| **Quick Action** | A pill button that launches one of the most common workflows (begin a check, start an inspection, update status). Sized 52px minimum for gloved-hand operation. |
| **Recent Activity feed** | Unified stream pulled from six sources: `activity_log`, discrepancies, checks, inspections, QRC executions, wildlife events. |
| **Synthetic entry** | A feed entry that isn't in `activity_log` — e.g., a filed inspection is a "synthetic" feed entry because it's reconstructed from the `inspections` table. Deletions route to the correct source table. |

---


## How to use the Inspection Status Strip

The strip shows two pills: **Airfield Inspection** and **Lighting Inspection**, with states:
- **Not Started** (gray)
- **In Progress** (amber, shows who started it)
- **Filed** (green, shows filer)

1. Tap an unstarted pill → jumps to the inspection module with the type pre-selected to create.
2. Tap an in-progress pill → jumps to that inspection's draft for resume.
3. Tap a filed pill → opens the filed inspection's detail view.

The one-per-day rule (airfield + lighting once per calendar day, 0600L cutoff) is enforced — if one has already been filed today, you cannot start a new one of the same type until after 0600L the next day.

---

## How to use the Quick Actions

Pill buttons visible to you depend on your role. Common buttons:

| Button | Action |
|---|---|
| **Begin Check** | Opens the Airfield Checks picker to start a new check. |
| **Start Inspection** | Opens the inspection picker. |
| **Update Runway Status** | Jumps to the relevant runway row on Airfield Status. |
| **Execute QRC** | Opens the QRC picker. |

Tap any pill to go straight to the action.

---

## How to toggle Airfield Management Out of Office

The Airfield Management Out of Office toggle is on the Dashboard and controls a semi-transparent banner that appears across the Airfield Status page.

### To activate

1. Dashboard → **Airfield Management Out of Office** card → **Activate**.
2. A modal appears.
3. Enter the **Message** (e.g., "Airfield Management out 1500Z–1900Z, direct calls to AMOPS SSgt Smith").
4. Enter **Command Post Initials** (required).
5. Confirm.
6. The banner appears on Airfield Status, a realtime push notifies every connected device, and an entry is logged to Events Log.

### To deactivate

1. Dashboard → **Airfield Management Out of Office** card → **Deactivate**.
2. Enter **Command Post Initials** (required for deactivation too).
3. Confirm.
4. The banner clears. Events Log gets a second entry noting the deactivation.

### Who can toggle

- Airfield Manager role
- AMOPS role (added in v2.32)
- Base Admin / System Admin roles

Others cannot activate or deactivate the banner.

---

## How to use the Recent Activity feed

The feed shows the last ~20 events, color-coded by entity type:

| Color | Entity |
|---|---|
| Cyan | Checks |
| Amber | Discrepancies |
| Green | Completions (filed inspections, closed discrepancies) |
| Purple | QRCs |
| Teal | Wildlife |
| Red | Violations, NAVAID outages |

Each entry shows: action label, entity name, user (with OI), relative timestamp.

### To view an entry's source

Tap the entry — jumps to the underlying detail page.

### To edit or delete a feed entry

- **Administrators**: edit/delete buttons appear on every entry.
- **Non-admins**: edit/delete appear only on your own `activity_log` entries. You cannot edit or delete synthetic entries (inspections, checks, etc.) even if you authored them — use those modules directly.

### To view the full feed

Click **View All Recent Activity** at the bottom of the feed → opens Events Log.

---

## How to open the Shift Checklist quickly

1. Dashboard → **Shift Checklist** badge (or section, depending on layout).
2. A modal shows the current shift's checklist items.
3. Toggle items (unchecked → completed → N/A → unchecked) in place.
4. Close the modal when done. Progress is saved live.

Full workflows: [12_shift_checklist.md](12_shift_checklist.md).

---

## How to view today's PPRs

The **Today's PPRs** section at the bottom of the page (or its badge) lists PPR entries scheduled for today.

- Tap a PPR row to open its details.
- Tap the badge to open the full PPR module.

Full workflows: [16_ppr.md](16_ppr.md).

---

## Keyboard shortcuts

None specific to the Dashboard.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Badge count doesn't match another module | Realtime delay (rare); or cached filter state | Refresh the page. |
| Activity feed missing entries you expect | The entries may predate the feed window (~last 20) | Open Events Log for the full history. |
| Edit/Delete buttons missing from a feed entry | You're not an admin and it isn't your entry, or it's a synthetic entry | Go to the source module (e.g., Discrepancies) to edit/delete. |
| AFM Out of Office toggle not visible | Your role lacks permission (AFM, AMOPS, Base Admin, Sys Admin only) | Ask a qualifying user. |
| Out of Office banner still shows after deactivation | Realtime push missed — refresh | Refresh the affected device. |
| Synthetic entry delete removes the feed item but source still exists | Deletion failed at the source table (e.g., discrepancy protected by RLS) | Check the source module for an error toast. |

---

## Related manual files

- [01_airfield_status.md](01_airfield_status.md) — Where AFM Out of Office banner appears.
- [04_daily_inspections.md](04_daily_inspections.md) — What the Inspection Status Strip links to.
- [12_shift_checklist.md](12_shift_checklist.md) — Shift Checklist modal and reset.
- [16_ppr.md](16_ppr.md) — Today's PPRs section.
- [19_events_log.md](19_events_log.md) — Full activity feed and filters.
