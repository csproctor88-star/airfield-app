# 01 — Airfield Status

**Path:** Sidebar → Airfield Status · Mobile bottom tab → Status · URL `/`

The Airfield Status page is the operational nerve center of Glidepath. It shows every status your installation tracks — runways, NAVAIDs, ARFF, and any custom status boards — on a single scrollable page, updated in real time to every connected device.

---

## Overview

Airfield Status is the default landing page for most users. It is built from configurable **sections** (cards on desktop, stacked on mobile), each containing **rows** that reflect the real state of something at the installation.

Every status change:
- Updates on every other open device within 1–2 seconds via Supabase Realtime.
- Writes an entry to the Events Log with attribution (who changed it, when, from-to).
- For runway status, additionally writes to a dedicated `runway_status_log` that the Daily Ops PDF consumes.

---

## Key Concepts

| Concept | Meaning |
|---|---|
| **Section** | A card container grouping related status rows (e.g., "Runways," "NAVAIDs," "ARFF"). Configurable per installation in Base Setup. |
| **Status row** | A single item with a traffic-light state (green / yellow / red) and optional detail fields. Examples: a runway, a NAVAID group, an ARFF vehicle. |
| **Custom Status Board** | An admin-defined collection of status items (name + G/Y/R toggle) assignable to any section. Modeled for installation-specific needs without custom code. |
| **Weather Information** | A free-text operational note displayed prominently with a type of notification. Examples: "Weather Warning #01-004" "Weather Advisory #01-003." |
| **RSC / RCR / BWC** | Runway Surface Condition / Runway Condition Reading / Braking with Conditions — standard USAF runway state descriptors. |
| **AMOPS Out of Office banner** | A semi-transparent banner across the top indicating Airfield Management is out of the office. Togglable from the Dashboard. |
| **Realtime** | Live push from the database. A red dot in the header means realtime disconnected — changes you make will be saved but other users won't see them until reconnect. |

---

## Layout

Default sections (these exist unless an admin has removed or renamed them):

- **Runway Status** — every runway at the installation with Open/Closed/Restricted, RSC, RCR, BWC, contamination notes, last-updated time.
- **NAVAID Status** — every configured NAVAID group (PAPI/VASI, ALSF, REIL, etc.) with Operational/Degraded/Out of Service.
- **ARFF Status** — vehicles, manning posture, equipment notes.

Custom Status Boards (if your admin has defined any) appear in whichever section they were assigned to.

### Rearranging and resizing the board (base admins)

Users with the base-admin level role see an **Edit layout** button above the sections. It opens a
dashboard-style editor over **every block on the page** — Runway Status, NAVAID Status, ARFF Status,
custom status boards, Personnel on Airfield, Construction / Closures, Miscellaneous Info, and the
Transient Aircraft (PPR) panel are all equal, movable cards on one grid. Drag a card to move it,
pull a corner handle to resize it, and click a section label to rename it. Nothing is written to the server while you work — the arrangement is
held locally until you press **Save layout**, which publishes it base-wide (everyone then sees the
board in your saved arrangement; phones show the same sections stacked in reading order).
**Cancel** discards your changes; **Reset to default** returns the base to the built-in arrangement.
A base that has never saved a layout keeps the built-in arrangement automatically.

Beneath the sections, **Personnel on Airfield** lists who is currently on the airfield (see [20_personnel.md](20_personnel.md)).

---

## How to change a runway's status

1. Find the runway row under Runway Status.
2. Tap the status chip (Open / Closed / Restricted).
3. The status cycles or opens a picker depending on the chip type.
4. For Closed or Restricted: a prompt asks for a reason (drop-down + free text).
5. Confirm. The change is pushed to every device and logged.

## How to update RSC / RCR / BWC

1. Runway row → tap the RSC / RCR / BWC field.
2. Enter the reading (numeric) or select from the dropdown per field type.
3. Save.

Readings are timestamped so stale values are visible.

## How to add contamination notes

1. Runway row → **Contamination** field (may be under a ⋯ menu).
2. Choose contamination type (dry, wet, ice, slush, snow, standing water).
3. Enter depth in inches or percent coverage as prompted.
4. Save.

Contamination affects the displayed BWC/RSC automatically where relevant.

---

## How to change a NAVAID's status

1. Find the NAVAID group row (e.g., "PAPI RWY 18").
2. Tap the status chip.
3. Select Operational / Degraded / Out of Service.
4. Confirm.


## How to rename a NAVAID group

1. Click the group name (if editable — requires admin role).
2. Enter the new name.
3. Save. Persists to `bases.status_labels`.

Ordinary users cannot rename groups — ask your admin.

---

## How to update ARFF status

1. Find the ARFF vehicle or item.
2. Tap the status chip.
3. Select the appropriate state (mission capable, partial, NMC, etc.).
4. Optional notes.
5. Save.

ARFF manning posture is a separate row from individual vehicles.

### CAT (Aircraft Rescue Category) dropdown

The ARFF Status section also shows a **CAT** dropdown by default with values 6–10. Selecting a value logs the change to the Events Log with attribution and confirms via a dialog.

Bases that don't report ARFF readiness by CAT level can hide this dropdown. See [21_base_setup.md](21_base_setup.md) Step 6 → "Show CAT dropdown" toggle. When hidden, the ARFF section shows only the per-aircraft readiness cards.

---

## How to post, update, or clear an advisory

1. Click **Post Advisory** (top of the page, or the advisory section).
2. Enter the advisory text.
3. Select severity (Watch, Warning, Advisory).
4. Optional: set an **expiry** (auto-clears at that Zulu time).
5. Save.

To update: click the existing advisory → edit text / type / expiry.
To clear: click the advisory → **Clear Advisory**. Writes an entry to the Events Log.

---

## How to activate or deactivate the Airfield Management Out of Office banner

The banner is controlled from the **Dashboard**, not directly from Airfield Status — see [02_dashboard.md](02_dashboard.md).

When active:
- A semi-transparent banner displays at the top of Airfield Status with the configured message.
- Tap **Minimize** to collapse it to a thin bar.
- Tap again to expand.

The banner is not dismissible by regular users — only AFM or AMOPS can deactivate it.

---

## How to toggle a Custom Status Board item

Custom status boards behave the same as built-in status rows:

1. Find the row in whatever section the board was assigned to.
2. Tap the G / Y / R toggle.
3. Save.

The names and items are configured by an admin in Base Setup.

## How to add a Custom Status Board (admin)

1. Base Setup → Step 13: Custom Status Boards.
2. **+ New Board** → name it.
3. Add items (name, default state).
4. Assign the board to a section (Runway / NAVAID / ARFF / or a new section).
5. Save.

Full walkthrough in [21_base_setup.md](21_base_setup.md).

---

## How to rename a section header

1. Click the section header text (if editable — admin-only).
2. Enter the new name.
3. Save.

## How to see who changed what

- Scroll-over / tap the "last updated" text on any status row to see who and when.
- Full detail: Events Log module ([19_events_log.md](19_events_log.md)) — filter by entity type `airfield_status` or `runway`.

---

## Realtime indicator

- **Green dot** in the header: realtime connected.
- **Red dot**: disconnected. Edits save to the database but won't push to other devices until reconnect.
- A cyan banner appears when realtime reconnects with the message "Realtime reconnected."

If you change status while disconnected and someone else changed it concurrently, the server rejects the stale change and shows a warning toast.

---

## Keyboard shortcuts

None specific to this module (all interactions are tap/click).

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Status change doesn't propagate to another device | Realtime disconnected on the other device | Refresh the other device. Check the presence dot. |
| Can't change a status | Your role is restricted (Safety/ATC/Read Only are observers) | Check with admin; AMOPS, AFM, NAMO, and admins can change status. |
| "Runway status log" entry missing from Daily Ops PDF | Handler didn't call `logRunwayStatusChange()` — very rare | File a support ticket; the runway status change itself is in `activity_log`. |
| Advisory didn't auto-clear at expiry | Server timezone mismatch (very rare) | Manually clear; report to support. |
| Airfield Management Out of Office banner won't clear | You're not the activator and your role doesn't allow clearing | Ask AFM or an admin; Command Post initials are required. |
| Personnel count mismatches reality | Personnel weren't marked Completed when they left | Use the Personnel module to close out entries ([20_personnel.md](20_personnel.md)). |

---

## Related manual files

- [02_dashboard.md](02_dashboard.md) — Where Airfield Management Out of Office is toggled.
- [06_discrepancies.md](06_discrepancies.md) — Linked discrepancies auto-created from NAVAID outages.
- [19_events_log.md](19_events_log.md) — All status changes are logged here.
- [20_personnel.md](20_personnel.md) — Personnel on Airfield panel.
- [21_base_setup.md](21_base_setup.md) — Sections, NAVAID groups, Custom Status Boards configuration.
