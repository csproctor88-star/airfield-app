# 19 — Events Log

**Path:** Sidebar → Events Log · Mobile bottom tab → Events Log · URL `/activity`

The Events Log is the comprehensive, immutable audit trail of all system activity. Every status change, inspection completion, discrepancy update, and QRC activation is logged automatically with user attribution, timestamp, and contextual details. Manual entries support documentation of events that happen outside the application.

---

## Overview

The Events Log consolidates events from multiple sources into one unified feed:
- Automatic system events (status changes, filed inspections, closed discrepancies)
- Manual entries typed by users (phone calls, radio communications, visual observations)
- Template-based entries (structured manual entries with pre-defined fields)

Every entry shows: **Action**, **Entity**, **Details**, **User (with OI)**, **Zulu timestamp**.

---

## Key Concepts

| Concept | Meaning |
|---|---|
| **Action** | The verb. What happened. Inferred from template or free-text keywords when manually entered. |
| **Entity** | The subject. What was affected (e.g., RWY 18, PAPI, Discrepancy #42, PPR, Shift Checklist). |
| **Details** | The narrative. Shown uppercased on display, Excel, and PDF (v2.28 behavior). |
| **Template** | A pre-defined entry structure with fields (e.g., "Weather Info," "NOTAM Issued," "Shift Change"). |
| **Operating Initials (OI)** | 1–4 character shorthand for the user, shown in a dedicated column with click-to-reveal. |
| **Deduplication** | Entries with both entity details and a formatted `details` string skip duplication in the display. |

---

## Layout

- Top of page: filters (date range, action, entity type, user).
- Main area: entry list sorted newest first.
- Each row: ACTION (color-coded by entity type), entity, details, user (with OI), Zulu timestamp.

### Color coding by entity type

Entries on the log are color-accented by entity type so the visual pattern reveals workflow at a glance. Typical mapping (exact palette values live in `app/(app)/activity/page.tsx`):

| Color | Entity |
|---|---|
| Cyan | Checks |
| Amber | Discrepancies |
| Green | Completions (filed inspections, closed discrepancies) |
| Purple | QRCs |
| Orange | Wildlife |
| Red | Violations, NAVAID outages |
| Gray | Shift checklist, housekeeping |

---

## How to browse the log

1. Open Events Log.
2. Scroll chronologically (newest first).
3. Apply filters to narrow down:
   - **Date range**
   - **Action** (specific verbs)
   - **Entity type** (airfield_status, inspection, check, discrepancy, etc.)
   - **User**
4. Search by free text across details.

## How to view user initials (OI)

- Each entry shows OI in its own column.
- Tap OI → a popover reveals the full user name.
- OIs are set in Settings → Profile (max 4 characters).

## How to add a manual entry

### Free-form entry

1. Events Log → **+ New Entry**.
2. Select **Entity Type** (runway, NAVAID, weather, general).
3. Type **Details**.
4. Save. The ACTION is inferred from keywords in the details (25+ patterns — v2.29).

### Template-based entry

1. **+ New Entry** → **Use Template**.
2. Select a template (e.g., "Weather Info," "NOTAM Issued," "Shift Change").
3. Fill the template's structured fields.
4. Save. The ACTION is the exact template label.

## How to edit a manual entry

1. Find your entry (within the last ~24h typically).
2. Tap the pencil icon.
3. Edit fields.
4. Save. Metadata preserves on edit (no overwrite — fixed v2.29).

**Permissions:** Admins can edit any entry. Non-admins can edit only their own `activity_log` entries.

## How to delete a manual entry

- Edit modal → **Delete**.
- Or dashboard recent-activity feed → trash icon (admins/authors).

## How to export the Events Log

1. Events Log → **Export**.
2. Choose **PDF** or **Excel**.
3. Current filters apply to the export.
4. Excel gives row-per-entry for external analysis.

## How to view runway status history

Events Log filters entity type = `airfield_status` or `runway` → all status changes shown.

The Daily Ops PDF also includes a dedicated "Runway Status Log" section fed from this data.

---

## Template management (admin)

1. Base Setup → **Events Log Templates** step.
2. Add templates with structured fields:
   - Name (e.g., "Weather Info")
   - Fields (label + type per field)
3. Save. Templates appear in the +New Entry picker.

---

## Keyboard shortcuts

None specific to Events Log.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Entry shows wrong action | Keyword inference matched wrong template | Use a template explicitly for predictable action. |
| Duplicate title / description in Daily Ops PDF | Entity details plus formatted `details` both present | Deduplication fixed in v2.29 — update. |
| Can't edit your own entry | Too much time elapsed (edit window) or role restricted | Admins can always edit; regular users may have a time limit. |
| OI popover shows "Unknown" | User profile missing OI | User: Settings → Profile → set Operating Initials. |
| Excel export missing recent entries | Filter date range excludes them | Widen the date range. |
| Manual entry created two Events Log rows | Discrepancy CRUD previously double-logged (pre-v2.28) | Update app. |

---

## Related manual files

- [02_dashboard.md](02_dashboard.md) — Recent Activity feed pulls from Events Log.
- [18_reports_analytics.md](18_reports_analytics.md) — Daily Ops PDF consumes events.
- [21_base_setup.md](21_base_setup.md) — Template configuration.
