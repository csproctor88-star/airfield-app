# 16 — Prior Permission Required (PPR) Log

**Path:** Sidebar → PPR · URL `/ppr`

The PPR module tracks inbound aircraft requests requiring prior approval. It uses a fully configurable column system, so each installation can define exactly which fields appear for its PPR log.

---

## Overview

PPR is the standard mechanism for coordinating and approving non-scheduled aircraft arrivals. Glidepath's PPR Log replaces the Excel/paper spreadsheets each installation maintains today with a structured, multi-user, auditable system.

The column structure is configured per-installation so your PPR log looks exactly like your existing format (aircraft type, tail, unit, arrival ETA, souls on board, fuel request, escort required, approval status, etc.).

---

## Key Concepts

| Concept | Meaning |
|---|---|
| **PPR Entry** | One inbound aircraft request. |
| **PPR#** | Auto-generated sequential number per installation. |
| **Column** | A configurable field type (text, date, time, yes/no/na, phone, number, email). |
| **Column order** | Columns appear in the table in the configured order. Reorder in Base Setup. |
| **Today's PPRs** | PPR entries scheduled for today, surfaced on the Dashboard and Airfield Status. |

---

## How to add a PPR entry

1. Open PPR.
2. **+ New PPR** button.
3. A form appears with every configured column.
4. Fill:
   - Aircraft type, tail number, unit
   - Arrival date/time (Zulu)
   - Origin/destination
   - Souls on board
   - Fuel request
   - Escort required (yes/no/na)
   - Approval status
   - (Your columns vary based on installation configuration)
5. **Save**. A PPR# is auto-generated.

## How to browse and search PPRs

- PPR list view shows all entries in a table.
- Filter by date (today, this week, custom range).
- Sort any column.
- Search by PPR#, tail, unit, or aircraft type.

## How to edit a PPR

1. Tap the row to open detail.
2. **Edit** button.
3. Modify fields.
4. Save.

## How to delete a PPR

1. Detail view → **Delete**.
2. Confirm.

## How to view today's PPRs

- Dashboard → **Today's PPRs** section (bottom).
- Airfield Status → today's PPRs list.

Both link back to the full PPR module.

---

## How to configure PPR columns (admin)

1. Base Setup → **PPR Columns** step (step 14).
2. Add a column:
   - **Name** — the column header (e.g., "Aircraft Type").
   - **Type** — one of: text, date, time, yes/no/na, phone, number, email.
   - **Required?** — whether the column must be filled to save a PPR.
3. Reorder columns via drag.
4. Rename inline.
5. Delete columns you don't need.
6. Save. New PPR entries use the updated column structure immediately.

**Caution:** Deleting a column removes existing data in that column across all PPRs. Inactivate instead when possible (if your admin interface supports it).

---

## How to export PPRs to PDF

1. PPR list → apply your date filter (today / 7d / 30d / custom range).
2. Click **Export PDF** to download a landscape PDF of the filtered entries.
3. Or click **Email PDF** to open the email modal — recipients pre-filled with your default PDF email; subject auto-set.
4. The PDF includes every configured column, the PPR#, OI, and notes, plus a header showing date range and entry count.

The export uses whatever filter is active. To export all PPRs for a day, leave the date filter on Today; for a date range, use Custom.

---

## Daily Ops integration

PPR entries logged for the current day appear on the Daily Operations PDF under the "PPR" entity label (capitalized as "PPR," not "Ppr Entry" — fixed in v2.32).

---

## Keyboard shortcuts

None specific to PPR.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Column required" error on save | Required column left empty | Fill the column or toggle Required off in Base Setup. |
| Old PPR data missing after column reorder | Reorder shouldn't remove data; check deletion | Don't delete columns that contain data. |
| Today's PPR not showing on Dashboard | Arrival date not set to today, or timezone mismatch | Verify the arrival date field; check installation timezone. |
| Can't change column type once created | Column types are fixed at creation | Create a new column and migrate data manually. |
| PPR# skipped a number | Previous entry was deleted | Normal — numbers don't backfill. |

---

## Related manual files

- [02_dashboard.md](02_dashboard.md) — Today's PPRs surfaced here.
- [18_reports_analytics.md](18_reports_analytics.md) — Daily Ops PDF PPR section.
- [21_base_setup.md](21_base_setup.md) — Column configuration (step 14).
