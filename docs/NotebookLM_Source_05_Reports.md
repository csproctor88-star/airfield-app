# Glidepath Capability Deep Dive: Reports & Analytics

*Source document for Google NotebookLM capability video*
*Version 2.17.0 | March 2026*

---

## What This Covers

This document covers Glidepath's reporting and analytics capabilities — the tools that transform daily operational data into actionable intelligence for airfield managers, flight chiefs, and leadership.

---

## The Reporting Problem

Every airfield manager knows the drill: leadership wants a summary. You open three spreadsheets, check your email for today's check results, dig through a folder for inspection photos, manually format a document, and email it out. If they want trends, you're building pivot tables. If they want photos, you're resizing and pasting screenshots. An hour later, you have a report that took longer to create than the operations it describes.

Glidepath generates every report in seconds because the data is already structured, timestamped, and connected.

---

## Report Types

### 1. Daily Operations Summary

The flagship report. One PDF that captures everything that happened on your airfield today.

**What's included:**
- **Events Log entries** — every status change, check filed, inspection completed, discrepancy created, QRC activated. Timestamped in Zulu with operator operating initials
- **New discrepancies** — any discrepancies created today, with photos embedded and map thumbnails
- **Discrepancy updates** — status changes on existing discrepancies
- **Airfield checks** — FOD checks, RSC/RCR assessments, emergency checks filed today
- **Inspections completed** — airfield and lighting inspections with results
- **Personnel activity** — contractors/personnel who were active on the airfield

**How to generate:**
1. Navigate to Reports → Daily Operations Summary
2. Select the date (defaults to today)
3. Preview the data on screen — summary cards show counts for each section
4. Tap "Generate PDF" — the full report compiles with embedded photos, maps, and timestamps
5. Email it directly from the app or download

**Photo handling:**
Photos in the Daily Ops report are automatically resized to max 800px and converted to JPEG for fast PDF generation. Even large original uploads (4+ MB PNGs) embed cleanly because they're processed through a canvas-based resize pipeline before embedding.

**Use case:** Email to your flight chief at end of day. Present at squadron standup. Archive for wing inspection preparation.

---

### 2. Open Discrepancy Report

Point-in-time snapshot of all unresolved airfield discrepancies.

**What's included:**
- **Summary statistics** — total open, breakdown by type, by assigned shop
- **Aging analysis** — how many items are in each aging tier (0–7, 8–14, 15–30, 31–60, 61–90, 90+ days)
- **Discrepancy table** — every open item with ID, type, description, location, shop, status, age, and severity
- **Photos** — embedded discrepancy photos (resized for PDF)
- **Map thumbnails** — satellite view showing pin location for each discrepancy

**Available as:** PDF and Excel

**Use case:** Monthly briefing to group leadership. Handoff document for incoming airfield managers. CE coordination meeting prep.

---

### 3. Discrepancy Trends

Time-series analysis showing how your airfield's maintenance posture changes over time.

**What's included:**
- **Opened vs. closed over time** — line chart showing discrepancies filed vs. resolved per period
- **Backlog growth/shrink** — is your open count growing or shrinking?
- **Top areas** — which locations generate the most discrepancies?
- **Top types** — which discrepancy categories are most common?
- **Shop workload** — how are discrepancies distributed across CE shops?

**Use case:** Quarterly infrastructure health assessment. MILCON/SRM justification with data. Identifying systemic problems (e.g., recurring drainage issues after every storm).

---

### 4. Aging Discrepancies Report

Focused analysis on items that have been open too long.

**Aging tiers:**
- 0–7 days (new)
- 8–14 days
- 15–30 days
- 31–60 days
- 61–90 days
- 90+ days (critical)

**What's included:**
- **Tier breakdown** — count of discrepancies in each aging tier
- **Shop distribution per tier** — which shops have the oldest items?
- **Individual discrepancy details** — each item with its age, description, and current status

**Available as:** PDF and CSV

**Use case:** CE work order prioritization meetings. Inspector General prep. Demonstrating to leadership which items need command emphasis.

---

## Export Capabilities

### PDF Export (11 Generators)
Every operational record in Glidepath can be exported as a professional PDF:

1. Airfield Check PDF — FOD, RSC/RCR, emergency check records
2. Inspection PDF — Airfield and lighting inspection results
3. ACSI PDF — Full compliance audit with per-item detail
4. Discrepancy PDF — Individual discrepancy with photos and map
5. Waiver PDF — Waiver details with criteria and attachments
6. Daily Ops Summary PDF — Consolidated daily report
7. Open Discrepancy Report PDF — All open items with analysis
8. Trends Report PDF — Time-series discrepancy analysis
9. Aging Report PDF — Aging tier breakdown
10. QRC PDF — Completed emergency checklist record
11. NOTAM PDF — NOTAM list and details

All PDFs share a consistent professional format:
- Header with Glidepath branding, installation name, and generation timestamp (Zulu)
- Embedded photos (resized via canvas for optimal PDF size)
- Embedded Mapbox satellite thumbnails where applicable
- Consistent typography and layout

### Excel Export
Discrepancy reports and select data sets export as Excel files using SheetJS and exceljs for styled exports with headers, formatting, and multiple sheets where applicable.

### Email Distribution
Any generated PDF can be emailed directly from the app:
- Enter recipient email (or use saved default email)
- Add optional message
- PDF attaches automatically
- Powered by Resend email service via API endpoint
- Confirmation toast on success

---

## Analytics Dashboard Concepts

Beyond static reports, Glidepath's data structure enables analytics:

### Discrepancy Velocity
How quickly are discrepancies being resolved? Track median time-to-close by type, shop, and severity. Identify bottlenecks.

### Inspection Coverage
Are all required inspections being completed on schedule? Track daily, weekly, and monthly completion rates.

### Check Frequency
How often are FOD checks, BASH checks, and other assessments being performed? Compare actual frequency against required minimums.

### Personnel Exposure
How many contractor-days have occurred on the airfield? Which areas have the highest personnel activity?

---

## Why Reports Matter

### For the Airfield Manager
- **End-of-day report in seconds, not hours.** The Daily Ops Summary compiles automatically — you just hit generate
- **Instant answers for leadership.** "How many open discrepancies?" is answered by looking at the screen, not opening a spreadsheet
- **PCS continuity.** Reports generate from the same database the next person will use — no format changes, no data gaps

### For Flight Chiefs and Squadron Leadership
- **Data-driven decisions.** Trends show whether the airfield is improving or degrading. Aging reports reveal where work orders are stalling
- **Professional presentation.** PDFs with embedded photos and maps look like they took hours to produce
- **Email distribution.** Reports arrive in inboxes without anyone having to ask twice

### For Wing Leadership and Inspector General
- **Audit readiness.** Every inspection, check, and discrepancy is archived with timestamps and attribution
- **Compliance documentation.** Pull any record from any date — the data doesn't expire, get lost, or degrade
- **Trend visibility.** Multi-month analysis shows infrastructure health trajectory

### Time Impact
Conservative estimate: generating, formatting, and distributing the daily operations summary manually takes 30–60 minutes. Weekly discrepancy reports take 1–2 hours when compiled from spreadsheets. Monthly trend analysis takes 2–4 hours of spreadsheet work.

With Glidepath: Daily Ops Summary in 10 seconds. Discrepancy report in 5 seconds. Trends analysis in 5 seconds. That's 5+ hours per week recovered for actual airfield management work.

---

*Glidepath v2.17.0 — Reports that build themselves*
