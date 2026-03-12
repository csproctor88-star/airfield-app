# Glidepath — Beta Tester Guide

**Version 2.17.0 | March 2026**

---

## What is Glidepath?

Glidepath is a complete airfield management app that replaces your paper checklists, Excel trackers, and email workflows with a single platform on your phone, tablet, or laptop. Add it to your home screen and it works like a native app — no app store, no installation, no IT request.

---

## Getting Started

### Access
1. Open your web browser (Chrome, Safari, Edge, or Firefox)
2. Navigate to https://www.glidepathops.com
3. Log in with the email and password provided by your admin

### Add to Home Screen
- **iPhone/iPad:** Tap the Share button → "Add to Home Screen"
- **Android:** Tap the three-dot menu → "Add to Home screen" or "Install app"
- **Desktop:** Look for the install icon in the address bar

### Demo Mode
If Supabase is not configured, the app runs in demo mode with sample data. Everything works — you just can't save to the database.

---

## Navigation

### Bottom Navigation Bar (5 tabs)
- **Status** — Airfield status dashboard (home screen)
- **Dashboard** — Activity feed and quick actions
- **Obstruction** — Obstruction evaluation database and map
- **Events Log** — Operational audit trail
- **More** — All other modules and settings

### More Menu
The "More" tab opens a navigation hub with two expandable sections:

**AM Tools:**
- QRC (Quick Reaction Checklists)
- Shift Checklist
- Events Log
- Airfield Checks
- All Inspections
- Personnel on Airfield
- Airfield Discrepancies
- Airfield Waivers
- Reports & Analytics
- Obstruction Database

**More:**
- Settings
- PDF Library (admin only)
- User Management (admin only)

---

## Module Walkthrough

### Airfield Status (Status tab)
This is your operational common picture.

**What you'll see:**
- Active runway with surface condition
- Bird Watch Condition (LOW/MOD/SEV/PROHIB)
- Weather advisories (active watches, warnings, remarks)
- NAVAID status for all installed NAVAIDs
- Personnel currently on the airfield (individual cards with company, contact, location, work, radio, flag)
- Construction/misc items

**What you can do:**
- Change the active runway — tap current runway and toggle between active runways. When prompted, enter remarks associated with the runway change and both automatically create events log entries
- Update BWC — tap the level selector
- Add/complete weather watches, warnings, and advisories
- Toggle NAVAID status (operational ↔ out of service), add remarks describing the outages further
- Add personnel — enter company, contact, location, work description, radio callsign
- Mark personnel complete when they depart the airfield, no more contractor logs, automatically creates events log entries
- All changes update in real-time for every connected user and log to the Events Log

---

### Airfield Checks (More → AM Tools → Airfield Checks)
Quick field assessments you perform throughout the day.

**6 Check Types:** FOD, RSC/RCR, In-Flight Emergency, Ground Emergency, Heavy Aircraft, BASH

**How to run a check:**
1. Tap "New Check" and select the type
2. Fill in the header info (auto-populated where possible)
3. Drive the airfield — add issues as you find them
4. For each issue: describe it, select the location, snap a photo, if an issue should be reported as an airfield discrepancy, select the toggle to complete additional info and discrepancy is automatically added to the discrepancy database and send to the airfield manager
5. Your check saves automatically as you go (draft persistence)
6. When done, tap "File" to complete the check
7. Generate a PDF and email it if needed
8. All updates that impact BWC, RSC automatically persist to the airfield status page without manual entry after check is complete

**Key features to test:**
- Add multiple issues to a single check
- Take photos — they auto-resize for fast upload
- Start a check on your phone, close the app, reopen — your draft should be there
- Reference the airfield diagram during the check

---

### Inspections (More → AM Tools → All Inspections)
Structured evaluations with pass/fail items.

**4 Inspection Types:** Airfield (44 items), Lighting (34 items), Construction Meeting, Joint Monthly

**How to run an inspection:**
1. Start a new inspection from the Inspections page or Dashboard
2. Every item defaults to "pass" — you only need to tap items that fail
3. Tap an item to toggle: pass → fail → N/A → pass
4. When you mark "fail," you can create a discrepancy right there — add description, photo, and location without leaving the inspection
5. Multiple discrepancies can be created for a single failed item
6. Auto-saves continuously — close the app, come back, progress is preserved
7. File when complete — PDF generates with all items, photos, weather, and discrepancies
8. Mark discrepancies to be logged into the airfield discrepancy database automatically while on the inspection, no more double entries into multiple forms

**Key features to test:**
- Default-to-pass flow — how fast can you complete an inspection when most items pass?
- Create a discrepancy inline from a failed item
- Close the browser mid-inspection, reopen — does your progress survive?
- Generate and email the PDF

---

### ACSI (More → AM Tools → All Inspections → ACSI)
The big compliance audit — 10 sections, ~100 items.

**How to use:**
1. Create a new ACSI inspection — set airfield name, date, calendar year
2. Work through items section by section
3. Items with sub-fields (A/B/C) evaluate separately: Operable, Properly Sited, Clear of Vegetation
4. Failed items can generate discrepancies with photos and map pins
5. Assign team members by role (AFM, CE, Safety, etc.)
6. Complete risk certification blocks
7. Save as draft at any time — resume on any device
8. File when complete — generates a comprehensive PDF

---

### Discrepancies (More → AM Tools → Airfield Discrepancies)
Track every airfield maintenance and safety issue.

**How to create a discrepancy:**
1. Tap "New Discrepancy"
2. Select type (FOD Hazard, Lighting Outage, Pavement Deficiency, etc.)
3. Enter description and select location
4. Assign to a CE shop (defaults based on type)
5. Take photos — multiple photos supported, auto-resized
6. Pin on the map — tap the satellite view to place a marker
7. Submit

**What to explore:**
- List view vs. Map view — toggle between them
- KPI dashboard cards — open count by AFM/CES/AMOPS
- Filter by type or search by ID/description
- Open a discrepancy and update its status
- Delete a photo from an existing discrepancy (while editing)
- Generate individual and bulk PDFs
- Aging indicators on items older than 30 days

---

### Waivers (More → AM Tools → Airfield Waivers)
Regulatory deviation management.

**What to explore:**
- Create a waiver with all fields (type, criteria, hazard rating, dates, coordination)
- Pin the waiver location on the map
- Upload attachments (photos auto-resize, documents store as-is)
- Move a waiver through its lifecycle (draft → pending → approved → active)
- Switch to map view to see all waivers spatially
- Run an annual review for the current fiscal year

---

### Obstruction Evaluations (Obstruction tab)
Interactive surface analysis.

**How to evaluate an obstruction:**
1. Open the Obstruction Database
2. Tap "New Evaluation"
3. Place the object on the map or enter coordinates
4. Enter the object height (AGL)
5. See instant results — which surfaces are violated, by how much
6. Add photos and description
7. Save the evaluation

**What to test:**
- Place objects at various distances from the runway
- Try different heights — see which surfaces start to be violated
- Check the evaluation results against your knowledge of UFC surfaces

---

### QRC (More → AM Tools → QRC)
Airfield management response checklists.

**How to use:**
- **Available tab** — see ready-to-execute templates
- **Active tab** — see currently running QRCs
- **History tab** — see completed QRCs

**To execute a QRC:**
1. Select a template and activate it
2. Check off each step as you complete it — timestamps are automatic
3. If it's an emergency type with SCN, fill out the crash net form
4. Close the QRC when the event resolves
5. Export the PDF for your after-action report

---

### Shift Checklist (More → AM Tools → Shift Checklist)
Daily task tracking per shift.

**How to use:**
1. Open Shift Checklist at the start of your shift
2. See items applicable to your shift (day/swing/mid) and today's date
3. Check off items as you complete them
4. Review completion history from previous days

---

### Reports (More → AM Tools → Reports & Analytics)
Instant report generation.

**4 report types:**
- **Daily Operations Summary** — select a date, preview, generate PDF, email
- **Open Discrepancy Report** — current snapshot, PDF or Excel
- **Discrepancy Trends** — charts showing opened vs. closed over time
- **Aging Report** — tiered breakdown of open item ages

**Key test:** Generate the Daily Ops Summary for a day you've been active. Does it capture all your checks, inspections, discrepancies, and status changes? Are photos embedded?

---

### Events Log (Events Log tab)
Your operational audit trail.

**What you'll see:**
- Chronological list of all system events and manual entries
- Zulu timestamps on every entry
- Operating Initials (OI) column — tap to see full name and role
- Entity links — tap an entry to jump to the source record

**What you can do:**
- Add manual entries (templates available for common entry types)
- Filter by time range (today, 7d, 30d, custom)
- Search by keyword
- Export to Excel

---

### Settings (More → Settings)
8 sections for personalization and configuration.

1. **Profile** — name, email (masked by default), role, operating initials (self-edit)
2. **Installation** — switch between bases (if you have multi-base access)
3. **Data & Storage** — IndexedDB management, export/import
4. **Regulations Library** — download regulations for offline use
5. **Base Configuration** — runways, areas, CE shops, ARFF aircraft, diagram (admin)
6. **Appearance** — Light, Dark, or System theme
7. **About** — version info, release notes
8. **Sign Out**

---

## What to Test

We want your honest feedback on these areas:

### 1. Usability
- Is the navigation intuitive? Can you find what you need?
- Are the forms easy to fill out on your phone?
- Does the dark theme work in bright/dim environments?

### 2. Real-Time Operations
- Update the runway status on one device — does it appear on another?
- Add a weather advisory — does it show up immediately for other users?

### 3. Check & Inspection Workflows
- Run a FOD check with multiple issues and photos. How does it compare to your current process?
- Run a daily inspection using default-to-pass. Is it faster?
- Does draft persistence work if you close and reopen the app?

### 4. Discrepancy Tracking
- Create 3–5 real discrepancies with photos and map pins
- Try the map view — does it give you useful spatial awareness?
- Update status on a discrepancy — is the workflow clear?
- Does the KPI dashboard help you prioritize?

### 5. ACSI
- Start an ACSI inspection. Is the item-by-item flow workable?
- Do the sub-field evaluations (A/B/C) make sense?
- Can you save and resume later?

### 6. Reports & Email
- Generate a Daily Ops Summary. Does it capture everything?
- Email a PDF. Does it arrive correctly?
- Generate a discrepancy report. Is the aging analysis useful?

### 7. Emergency Response
- Execute a QRC template. Are the steps clear?
- Does the SCN form capture the right information?
- Is the after-action PDF useful?

### 8. Obstructions
- Evaluate a known obstruction near your airfield. Are the results accurate?
- Is the map interface intuitive?

### 9. Regulations
- Find a regulation you reference regularly. Is the search effective?
- Download it for offline access. Can you view it without internet?

### 10. Performance
- How does the app feel on cellular data?
- Do photos upload quickly (they auto-resize to help)?
- Any pages that feel slow?

### 11. Missing Features
- What does your daily workflow need that isn't here?
- What would make you use this instead of your current tools?

### 12. Overall
- Would you use this tomorrow if you could?
- What's the single most valuable feature?
- What's the single biggest gap?

---

## Quick Reference

| Task | Where to Find It |
|------|------------------|
| Check runway status | Status tab (home screen) |
| Update BWC | Status tab → Bird Watch Condition |
| FOD check | Dashboard → New FOD Check, or More → Airfield Checks |
| Daily inspection | Dashboard → New Inspection, or More → All Inspections |
| Track discrepancy | More → Airfield Discrepancies → New |
| Run QRC | More → QRC → select template → Activate |
| Daily Ops report | More → Reports & Analytics → Daily Ops |
| Log a manual event | Events Log tab → + button |
| Change settings | More → Settings |
| Switch installations | More → Settings → Installation (or header dropdown) |
| View regulations | More → Settings → Regulations Library |
| Obstruction eval | Obstruction tab → New Evaluation |

---

## Giving Feedback

Your feedback makes Glidepath better. When reporting:
- **What you were doing** (which module, what action)
- **What happened** (error message, unexpected behavior, or missing feature)
- **What you expected** (how it should have worked)
- **Device/browser** (iPhone Safari, Android Chrome, Windows Edge, etc.)

Send feedback to your designated point of contact or submit directly through the app.

---

*Glidepath v2.17.0 — Built by an airfield manager, for airfield managers*
