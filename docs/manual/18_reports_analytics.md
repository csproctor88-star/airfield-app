# 18 — Reports & Analytics

**Path:** Sidebar → Reports · URL `/reports`

The Reports module provides on-demand PDF generation for the main recurring reports, plus a rolling analytics dashboard with ten key performance indicators. All report generation happens client-side — no operational data is sent to third-party rendering services.

Additional PDF and Excel exports live on the individual module pages (ACSI, Waivers, Obstructions, Parking, Wildlife, Events Log). See each module's manual file.

---

## Overview

Two surfaces in one module:

1. **Reports** — main filterable PDF generators for daily ops, discrepancies, and airfield lighting.
2. **Analytics Dashboard** — rolling KPIs with configurable lookback period.

---

## Key Concepts

| Concept | Meaning |
|---|---|
| **Report** | A PDF (or Excel) artifact generated on demand with filters. |
| **Client-side generation** | jsPDF / jspdf-autotable / SheetJS run in the browser. No data sent externally for rendering. |
| **Analytics** | Rolling metrics. Lookback selectable: 7, 30, 90, 180 (6 months), 365 (1 year), or a custom date range. |
| **KPI card** | A compact visualization for one metric. |

---

## Report types available on the Reports page

Six report cards can surface from the Reports module:

1. **Daily Operations** — full shift summary for a selected date
2. **Discrepancy** — single or filter-based discrepancy PDF
3. **Discrepancy Trends** — aggregated trend analysis over a time window
4. **Aging Report** — discrepancies grouped by age tier
5. **Airfield Lighting** — NAVAID / lighting-specific discrepancy report
6. **NAMO/NAMT Report Tool** — per-user activity counts across modules (leadership access only — see below)

Other exports (ACSI, Waivers, Obstructions, Parking, Wildlife, Events Log) are generated from their own module detail pages — not from the Reports module.

### Daily Operations Report

The primary end-of-shift report. Covers:
- Events log for the selected date (local time picker)
- Checks filed
- Inspections filed
- PPRs for the day
- NAVAID outages reported / resolved
- QRC executions
- Shift checklist completion
- Runway status log

**How to generate:**
1. Reports → **Daily Operations**.
2. Date picker — pick the local date to report on.
3. Optional filters (specific runways, types).
4. **Generate PDF**.
5. Download, or Email PDF.

### Discrepancy reports

Three templates on the Reports page use the discrepancy data:

1. **Discrepancy** — filter-based summary of many discrepancies (or single discrepancy when launched from the detail page).
2. **Discrepancy Trends** — aggregated trend analysis across the lookback window.
3. **Aging Report** — sorted by age tier.

Apply filters (date range, status, priority, type) before generating.

### Airfield Lighting Report

NAVAID / lighting-specific discrepancy report surfaced on the Reports page. Groups outages by system and includes Table A3.1 context.

### NAMO/NAMT Report Tool

A management-insight report, not a compliance record — no regulation requires it, and none is cited by it. It answers "who did what, and how much, over a period" by turning on-demand counting into a users-by-modules matrix instead of leadership counting rows by hand.

**How to generate:**
1. Reports → **NAMO/NAMT Report Tool** (only visible if you hold access — see below).
2. Pick a date range: **Last 7 / 30 / 90 Days**, **Month-to-Date**, **FY-to-Date**, or a custom From/To pair.
3. Choose which data domains to count. All nine are checked by default:
   - Wildlife Sightings
   - Wildlife Strikes
   - Airfield Checks
   - Inspections
   - Discrepancies Reported
   - QRCs Initiated
   - QRCs Completed
   - Daily Review Sign-offs
   - PPR Entries

   A domain you don't hold view access to shows disabled with a note naming which module's view access it needs — this keeps the report from silently under-counting a domain you can't actually see.
4. Optionally turn on **Include personnel with zero activity** to add every active base member with no counted records as an all-zero row — useful for confirming who did *not* generate any activity in the period, not just who did.
5. **Generate Report**. The matrix shows one row per person, one column per selected domain, plus a **Total** column and a **Totals** footer row. Click a row to expand a drill-down of that person's underlying records (label, date, and a link to the record where one exists).

**Reading the matrix.** Rows are grouped into up to three sections:
- **Personnel** — activity resolved to a linked user account.
- **Unlinked names** — activity attributed only to a free-text name (no linked account), rendered as typed and tagged **unlinked**.
- **Unattributed** — activity with neither a linked account nor a name on file. If any of it traces to a uuid whose profile no longer exists, this row is labeled **Former user** instead.

**Coverage footnotes.** Per-user attribution wasn't always captured for every domain. If your selected range reaches back before a domain's attribution start date, the report adds a footnote naming the domain, the date attribution began, and how many records in range lack per-user attribution — so a thin-looking Unlinked/Unattributed count is never mistaken for the real total. (Airfield Checks is presently the only domain with a coverage start date, March 2026; every other domain has full-history attribution.)

**Exports.** Download PDF, Download Excel, and Email PDF all require export access (see below) in addition to running the report itself:
- **PDF** — the matrix as one table, with the same Personnel/Unlinked/Unattributed grouping, a Totals row, and the same coverage footnotes as the screen. Selecting more than seven domains shrinks the table to fit and truncates long column names and unlinked names — the full, untruncated names are always in the Excel export.
- **Excel** — a **Summary** sheet with the full matrix (no truncation), plus one additional sheet per selected domain listing that domain's underlying records (person, record, date) for a deeper audit than the on-screen drill-down allows.
- **Email** — same Email PDF flow as every other report: pick a recipient (pre-filled with your default PDF email) and send.

**Who has access.** This report is restricted to leadership: Airfield Manager, NAMO, Base Administrator, and — on civilian Part 139 bases — Accountable Executive and Operations Supervisor. It is not granted to the AMOPS office, CES, Safety, ATC, or read-only/kiosk accounts by default, because the matrix ranks individual output rather than reporting module-wide status. An Airfield Manager can extend access to a specific person (for example, a NAMT whose assigned role wouldn't normally include it) with a per-user permission override, without changing anyone's role. Running the report always reads through each domain's own view permission and Row-Level Security — holding report access never exposes a domain you couldn't otherwise see.

### Exports generated from other modules

- **ACSI Report** — filed ACSI detail page → Export PDF / Excel ([05_acsi.md](05_acsi.md)).
- **Waiver Report** — Waivers list → Excel export; Waiver detail → PDF ([14_waivers.md](14_waivers.md)).
- **Obstruction Report** — Obstruction detail page → Export PDF ([10_obstructions.md](10_obstructions.md)).
- **Parking Plan PDF** — Parking Settings tab → Export PDF ([09_parking.md](09_parking.md)).
- **Wildlife Sighting / Strike PDF** — sighting or strike detail page ([13_wildlife_bash.md](13_wildlife_bash.md)).
- **Events Log Export** — Events Log page → Export PDF / Excel ([19_events_log.md](19_events_log.md)).

---

## How to generate any report

General pattern:
1. Open Reports or the specific module.
2. Apply filters (date range, type, status, etc.).
3. Click **Generate PDF** (or **Generate Excel**).
4. Wait for generation (typically 1–10 seconds, longer for reports with many photos).
5. PDF downloads automatically, or opens in Email PDF modal when **Email PDF** is clicked.

## How to email a generated report

1. After generating, click **Email PDF** in the generated-report dialog.
2. Email PDF modal opens:
   - **To** — pre-filled with your default PDF email; add more comma- or newline-separated.
   - **Subject** — auto-filled based on report type; editable.
   - **Message** — optional.
3. Click **Send**. Delivered via Resend.

## How to save default PDF email

Settings → Profile → Default PDF Email. Used across every Email PDF modal in the app.

---

## Analytics Dashboard

### How to open

Reports → **Analytics** tab.

### KPI cards shown (10)

1. **Airfield Inspections** — count filed, average time from `started_at → filed_at`
2. **Lighting Inspections** — count filed, average time
3. **Airfield Checks** — count filed, average time from `started_at → completed_at`
4. **Discrepancies** — open, closed, new, aging
5. **QRC Executions** — count by type
6. **Personnel on Airfield** — count, by organization
7. **Obstruction Evaluations** — count run
8. **Parking Plans** — plans created, active plans
9. **Wildlife / BASH** — sightings, strikes, top species
10. **Customer Feedback** — count, average rating, distribution

### How to change the lookback window

Top of analytics page → window selector. Options:
- 7 days
- 30 days (default)
- 90 days
- 180 days (6 months)
- 365 days (1 year)
- **Custom** — pick start and end dates with the date inputs that appear below the selector. Useful for inspection-window reviews, monthly leadership reports, or comparing a specific incident period.

### Average time filter

Average check and inspection times exclude sessions under 1 minute (accidental submissions).

### How to drill in

Tap a KPI card → jumps to the underlying module with the matching filter applied.

---

## Report styling

PDFs share a common visual style:
- Glidepath header with installation name and date
- Structured tables (jspdf-autotable)
- Embedded photos and map snapshots
- Footer with generator info and page numbers
- Photos embedded via `didParseCell` / `didDrawCell` hooks

Excel exports use SheetJS with column widths tuned to content.

---

## Keyboard shortcuts

None specific to Reports.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| PDF generation very slow | Many embedded photos or large date range | Narrow the filter; split into smaller reports. |
| Photos missing from PDF | Storage load failed at export | Preview in source module first; retry. |
| Daily Ops PDF date off by one | Local vs Zulu mismatch | The Daily Ops picker uses local; verify you picked the right local date. |
| Analytics KPI shows 0 but you know there was activity | Wrong window, or entries are in a different installation | Check window; verify you're on the right installation. |
| Email PDF silently fails | Resend key misconfigured, or recipient invalid | Admin: verify Resend credentials; check recipient email syntax. |
| Average time seems wrong | `started_at` not captured (pre-v2.25 records) | Older records may not have `started_at`; averages only count records with both timestamps. |
| Excel export opens as plain text | Incorrect mime type on server (rare) | Save and rename `.xlsx`, open in Excel manually. |
| No **NAMO/NAMT Report Tool** card on Reports | Signed in without access | Access is restricted to leadership roles (Airfield Manager, NAMO, Base Administrator, Accountable Executive, Operations Supervisor); ask your Airfield Manager for a per-user override if you need it and don't hold one of those roles. |
| A domain checkbox is disabled on the NAMO/NAMT Report Tool | You lack that domain's own view access | The note under the checkboxes names the module to request access to; the report never counts a domain silently. |
| NAMO/NAMT Report Tool export buttons are greyed out | You can run the report but lack export access | Ask your Airfield Manager or Base Administrator for the Export Reports permission. |

---

## Related manual files

- [02_dashboard.md](02_dashboard.md) — KPI badges (live, not 30-day).
- [06_discrepancies.md](06_discrepancies.md) — Discrepancy report templates.
- [09_parking.md](09_parking.md) — Parking Plan PDF.
- [19_events_log.md](19_events_log.md) — Events Log export.
