# Glidepath Capability Deep Dive: Discrepancy Management

*Source document for Google NotebookLM capability video*
*Version 2.17.0 | March 2026*

---

## What This Covers

This document covers Glidepath's discrepancy tracking system — the central feature that transforms how airfield managers identify, assign, track, and resolve airfield maintenance and safety issues.

---

## The Discrepancy Problem

Every airfield has maintenance issues: cracked pavement, burned-out lights, faded markings, broken signs, drainage problems. Airfield managers find these issues constantly — during checks, inspections, windshield surveys, or reports from other agencies.

The traditional process: write it down, add it to a spreadsheet, email CE, hope it gets into their work order system, follow up manually, repeat. Items get lost between email threads. Aging discrepancies pile up. When the airfield manager PCSes, the spreadsheet goes with them — or worse, gets abandoned.

Glidepath replaces this entire workflow with a single, persistent, shared tracking system.

---

## 11 Discrepancy Types

Glidepath categorizes discrepancies into 11 types, each with a default shop assignment:

1. **FOD Hazard** → CE Pavements
2. **Pavement Deficiency** → CE Pavements
3. **Lighting Outage** → CE Electrical
4. **Marking Deficiency** → CE Horizontal
5. **Signage Deficiency** → CE Electrical
6. **Drainage Issue** → CE Pavements
7. **Vegetation Encroachment** → CE Grounds
8. **Wildlife Hazard** → Airfield Management
9. **Airfield Obstruction** → Airfield Management
10. **NAVAID Deficiency** → CE Electrical
11. **Other** → Airfield Management

Shop assignments are configurable per installation — if your base has different CE shop structures, Glidepath adapts.

---

## Creating a Discrepancy

### Standalone Creation
From the Discrepancies page, tap "New Discrepancy":
1. **Select type** from the 11 categories
2. **Enter description** — what's wrong, where exactly
3. **Select location** — dropdown of airfield areas (runways, taxiways, aprons, access roads)
4. **Assign shop** — defaults based on type, but you can override
5. **Set severity** — priority indicator for the assigned shop
6. **Add photos** — camera opens, snap the issue. Photos resize automatically (max 1600px) for fast upload. Multiple photos supported
7. **Pin on map** — Mapbox satellite view of your airfield. Tap to place a pin at the exact location
8. **Add notes** — any additional context for CE or other responders

### Inline Creation (During Checks/Inspections)
When you mark a check issue or inspection item as "fail," you can create a discrepancy right there without leaving the check or inspection. The discrepancy inherits context from the parent record — inspector name, date, inspection type. This is how most discrepancies get created in daily operations.

### Photo Management
- **Upload during creation** — snap photos from the camera or select from gallery
- **Upload during editing** — add more photos later as conditions change
- **Delete photos** — remove incorrect or outdated photos while editing. Deleting a photo removes it from storage and decrements the photo count
- **Automatic resizing** — all uploaded images are compressed to max 1600px and converted to JPEG for optimal storage and fast loading
- **GPS embedding** — photos captured from mobile include location metadata

---

## Status Lifecycle

Every discrepancy moves through a defined workflow:

```
OPEN → Submitted to AFM → Submitted to CES → Awaiting Action → Work Completed → COMPLETED
                                                                                → CANCELLED
```

Key behaviors:
- **Status transitions are logged** — every change records who made it and when (Zulu time)
- **Bidirectional movement** — if work completion is rejected, the status can move backward
- **Completion requires action** — you can't mark a discrepancy completed without recording what was done
- **Cancellation with reason** — cancelled discrepancies require a note explaining why

---

## KPI Dashboard

The discrepancy list page doubles as a KPI dashboard showing real-time metrics:

### Metric Cards
- **Total open** — all unresolved discrepancies
- **AFM status** — how many are awaiting airfield management action
- **CES status** — how many are with Civil Engineering
- **AMOPS status** — how many are with Airfield Management Operations

### Filtering
- **By type** — show only lighting outages, only pavement deficiencies, etc.
- **By status** — show only open, only completed, etc.
- **By aging** — flag items open longer than 30 days (amber highlight)
- **Search** — find by display ID, description, or location text

---

## Map View

Toggle between list view and map view with one tap. The map view shows:
- **Satellite imagery** of your airfield (Mapbox)
- **Color-coded pins** for each open discrepancy by type
- **Tap a pin** to see the discrepancy summary — type, description, age, status
- **Collapsible legend** showing what each pin color represents
- **All open discrepancies at a glance** — immediately see spatial patterns (cluster of lighting outages on Taxiway Charlie = systematic electrical issue)

This is powerful for briefings. Pull up the map view on a big screen and leadership instantly sees the state of the airfield.

---

## Detail View

Tapping a discrepancy opens its full detail page:
- **Header** — display ID, type badge, severity badge, status badge
- **Description** — full text of the issue
- **Location** — area, specific location text
- **Assigned shop** — who's responsible
- **Timeline** — creation date, last update, age in days
- **Photos** — full-size photo gallery with delete capability during edit
- **Map** — satellite thumbnail showing the pin location
- **Status history** — every status change with timestamp and operator
- **Actions** — edit, update status, export PDF, email PDF, delete

---

## PDF Export

### Individual Discrepancy PDF
Generate a single-page PDF for any discrepancy:
- Header with display ID, type, severity, and status
- Full description and location
- Embedded photos (resized for PDF: max 800px)
- Map thumbnail showing pin location on satellite imagery
- Creation and update timestamps in Zulu

### Bulk Discrepancy Report
Generate a comprehensive report of all open discrepancies:
- Summary statistics (total, by type, by shop, by aging tier)
- Table of all discrepancies with key fields
- Aging analysis
- Available as both PDF and Excel

### Email Distribution
Any PDF can be emailed directly from the app. Enter the recipient's email (or use the saved default), add optional notes, and send. The email arrives with the PDF attached.

---

## Integration with Other Modules

Discrepancies don't exist in isolation — they connect across Glidepath:

### From Checks
When a FOD check identifies debris, the issue becomes a discrepancy automatically. The discrepancy references the source check.

### From Inspections
When a daily inspection or lighting inspection marks an item as "fail" and creates a discrepancy inline, the discrepancy links back to the inspection that found it.

### From ACSI
ACSI inspection failures can generate discrepancies with map locations and photos, creating an audit trail from compliance finding to resolution.

### To Reports
All open discrepancies appear in the Daily Operations Summary. Aging discrepancies appear in aging reports. Trends analysis tracks opened vs. closed over time.

### To Events Log
Every discrepancy creation, status change, and update is logged in the Events Log with the operator's operating initials and Zulu timestamp.

---

## Why This Matters

### Before Glidepath
- Discrepancies tracked in personal spreadsheets that don't survive PCS
- No visibility for CE — they don't know what's been submitted until someone emails
- No aging analysis — items sit for months without anyone noticing
- No photo evidence — "there's a crack in the pavement" with no context
- No map view — no way to see spatial patterns in maintenance issues
- Reporting requires manual compilation every time leadership asks

### With Glidepath
- Single shared database — every stakeholder sees the same information
- CE sees assigned work immediately — no email delay
- Automatic aging flags — nothing hides past 30 days
- Photos embedded at creation — visual evidence from day one
- Map view reveals patterns — cluster analysis at a glance
- Reports generate instantly — leadership asks, you deliver in seconds

### Real-World Impact
At a typical installation with 15–25 open discrepancies, an airfield manager spends 2–4 hours per week maintaining and distributing their discrepancy tracker. Glidepath eliminates this entirely. Updates happen in real-time. Reports generate on demand. The tracker is always current, always accessible, and always backed up.

---

*Glidepath v2.17.0 — Never lose a discrepancy again*
