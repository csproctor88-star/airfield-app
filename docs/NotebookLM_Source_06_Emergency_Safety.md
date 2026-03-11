# Glidepath Capability Deep Dive: Emergency Response & Safety

*Source document for Google NotebookLM capability video*
*Version 2.17.0 | March 2026*

---

## What This Covers

This document covers Glidepath's emergency response and safety modules — Quick Reaction Checklists (QRCs), Secondary Crash Net activation, shift checklists, NOTAMs, and the Events Log. These features ensure nothing falls through the cracks during high-stress operations and routine shift management.

---

## Quick Reaction Checklists (QRCs)

### The Problem
When an emergency happens on or near your airfield, time is critical. Airfield managers have Quick Reaction Checklists — step-by-step procedures for in-flight emergencies, ground emergencies, hijack situations, bomb threats, and other contingencies. These are typically laminated cards stored at the operations desk.

The problem: in the heat of the moment, steps get skipped. There's no record of what was done and when. After the emergency, reconstructing the timeline for the after-action report is done from memory. And if the laminated card is at the desk but you're in the tower or on the ramp, you're working from memory anyway.

### Glidepath's QRC Module

**Template-Based Execution**
QRC templates are configured per installation. Each template contains the checklist steps specific to that emergency type. When an emergency occurs:

1. **Activate the QRC** — Select the appropriate template (In-Flight Emergency, Ground Emergency, etc.)
2. **Execute step-by-step** — Each step displays clearly with a checkbox. Mark each step as completed as you perform it
3. **Automatic timestamping** — Every step completion is recorded with Zulu time automatically
4. **SCN form capture** — For emergencies that require Secondary Crash Net activation (configurable per template with `has_scn_form`), a structured SCN form captures: aircraft type, callsign, souls on board, fuel remaining, nature of emergency, and other critical details
5. **Close the QRC** — When the emergency resolves, close the checklist. The entire execution timeline is preserved

**Activity Logging**
QRC events generate Events Log entries automatically:
- **"QRC INITIATED"** — logged when you activate the checklist
- **"SECONDARY CRASH NET ACTIVATED"** — logged for emergency QRCs with SCN forms
- **"QRC COMPLETED"** — logged when the checklist is closed

**Cancellation**
If a QRC is activated in error (false alarm, drill cancelled), you can cancel it. Cancelling a QRC removes its associated activity log entries — keeping your Events Log clean of false starts.

**Status Tracking**
- **Available** — Templates ready to execute
- **Active** — Currently in progress
- **History** — Completed QRCs with full execution records

**Review Tracking**
QRC templates have a 1-year review cycle. If `last_reviewed_at` is more than 365 days ago, the template shows an overdue alert. This ensures your emergency procedures stay current.

**PDF Export**
Completed QRCs export as PDFs showing every step, its completion timestamp, and the SCN form data if applicable. This is your after-action documentation — formatted, timestamped, and ready for the incident report.

---

## Shift Checklists

### The Problem
Every shift has tasks that must be completed: check the weather station, verify NAVAID status, update the ATIS, test the crash phone, log weather observations. These tasks vary by shift (day, mid, swing) and frequency (daily, weekly, monthly).

Currently, these are tracked on a clipboard or whiteboard. Items get missed during busy shifts. There's no record of completion history. When the checklist needs updating, someone prints a new version and tapes it to the wall.

### Glidepath's Shift Checklist

**Configuration**
Each installation configures its own checklist items:
- **Item description** — what needs to be done
- **Frequency** — daily, weekly, or monthly
- **Shift assignment** — day, mid, swing, or all shifts
- **Applicability rules** — day-of-week logic for weekly items

**Daily Operation**
1. Open Shift Checklist at the start of your shift
2. See only the items applicable to your shift and today's date
3. Check off items as you complete them
4. Items not checked carry forward as incomplete

**Timezone-Aware Reset**
The checklist resets at a configurable time per installation (default: 0600 UTC). This ensures the "new day" aligns with operational day boundaries, not midnight local time.

**Completion History**
View past shift checklist completions to verify tasks were done on previous days. This provides accountability without micromanagement — if someone claims they tested the crash phone yesterday, the record shows whether they did.

---

## NOTAMs (Notices to Airmen)

### The Problem
NOTAMs are critical flight safety information — runway closures, lighting outages, frequency changes, temporary restrictions. Airfield managers need to track both FAA-published NOTAMs and local NOTAMs they issue themselves.

Currently, NOTAMs are checked on FAA websites, printed, and posted on a bulletin board. Local NOTAMs are drafted in Word documents and distributed via email.

### Glidepath's NOTAM Module

**Auto-Fetch**
Glidepath can pull current NOTAMs from FAA data sources based on your installation's ICAO identifier.

**Filtering**
- **Source:** FAA (published) vs. Local (internally issued)
- **Status:** Active vs. Expired
- **Search:** Find by ICAO identifier, NOTAM number, or content text

**Local NOTAM Creation**
Create local NOTAMs directly in Glidepath:
- NOTAM text (free-form with standard NOTAM format)
- Effective dates (start and end)
- Category/type assignment
- Internal distribution notes

**Export & Distribution**
- PDF export of individual NOTAMs or the full active NOTAM list
- Email PDFs directly from the app

---

## Events Log — The Master Audit Trail

### The Problem
Every airfield operation should be documented — who did what, when, and why. The traditional "ops log" is a notebook or spreadsheet where events are manually recorded. Entries are inconsistent, often incomplete, and impossible to search after the fact.

### Glidepath's Events Log

The Events Log is Glidepath's comprehensive audit trail. It captures both automatic system events and manual operator entries.

**Automatic Entries**
The following actions generate Events Log entries without any manual input:
- Runway changes (active runway, RSC/RCR)
- BWC changes (bird watch condition updates)
- Weather advisory additions/completions
- NAVAID status changes
- Airfield check filings
- Inspection completions
- Discrepancy creation and status changes
- Waiver status changes
- QRC activation, SCN activation, and completion
- Personnel on airfield additions and completions
- Obstruction evaluation filings (with violations)

**Manual Entries**
Operators can log manual entries with:
- Template picker (common entry types for quick logging)
- Free-text description
- Automatic attribution (operator name and operating initials)
- Zulu timestamp

**Operating Initials (OI) Column**
Every Events Log entry shows the operator's OI — a 1–4 character identifier (like initials). This provides at-a-glance attribution without cluttering the log with full names. Tap the OI to reveal a popover showing the operator's full name, rank, and role.

**Filtering & Search**
- **Time ranges:** Today, last 7 days, last 30 days, custom range
- **Entity linking:** Tap any log entry to jump directly to the source record (check, inspection, discrepancy, etc.)
- **Search by keyword:** Find specific events across the entire log

**Export**
- Excel export with all entries, timestamps, and operator information
- Included in the Daily Operations Summary PDF

**Why the Events Log Matters**
This is the feature that makes everything else accountable. Without the Events Log, Glidepath would be a collection of tools. With it, Glidepath is a system of record. Every action has a who, what, and when. Every decision is traceable. When the Inspector General asks "who changed the runway condition at 1423Z on March 5th?" — you pull up the Events Log and show them.

---

## How These Modules Connect

Emergency and safety modules integrate tightly:

1. **Emergency occurs** → Activate QRC → Steps logged automatically → SCN form captured → Events Log records everything
2. **Post-emergency** → File emergency check (In-Flight or Ground) → Discrepancies created for any airfield damage → Daily Ops Summary captures the full timeline
3. **Shift turnover** → Complete shift checklist → Events Log shows what happened during your shift → Next shift sees current status + recent events
4. **NOTAM issued** → Logged in Events Log → Visible to all users → Included in reporting

---

## Why This Matters

### For Emergency Response
- **Checklists on any device** — QRCs available whether you're at the desk, in the tower, or on the flightline
- **Nothing gets skipped** — step-by-step execution with automatic timestamps
- **After-action documentation ready immediately** — PDF export with full timeline, no reconstruction from memory
- **SCN documentation** — structured capture replaces handwritten forms

### For Daily Operations
- **Shift accountability** — checklist completion tracked and viewable
- **Automatic ops log** — Events Log builds itself from system actions
- **Manual entries** — supplement the automatic log with contextual notes
- **NOTAM awareness** — current NOTAMs accessible on any device, not just the bulletin board

### For Compliance & Audit
- **Complete audit trail** — every action attributed and timestamped
- **Searchable history** — find any event from any date
- **Exportable records** — Excel and PDF formats for any review or inquiry
- **Tamper-resistant** — system-generated entries cannot be modified (only manual entries can be edited)

---

*Glidepath v2.17.0 — When seconds matter, every step is tracked*
