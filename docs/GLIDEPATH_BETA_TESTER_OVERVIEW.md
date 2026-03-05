# GLIDEPATH — Beta Tester Overview

**Version 2.14.0 | March 2026**
**"Guiding You to Mission Success"**

---

## WHAT IS GLIDEPATH?

Glidepath is a mobile-friendly web application that puts every Airfield Management function into a single tool you can access from your phone, tablet, or computer. Instead of juggling paper logs, spreadsheets, emails, and multiple websites, you open one app and everything is there — runway status, inspections, discrepancies, checks, waivers, NOTAMs, reports, references, and more.

It works like an app on your phone but runs in your web browser. You can add it to your home screen and it even works offline. The dashboard updates in real time — when someone on your team changes the runway status, toggles a NAVAID, or completes a check, every connected user sees it within seconds. No page refresh. No phone call. Everyone is looking at the same picture.

---

## HOW TO ACCESS

- Open the app URL in any web browser (Chrome, Safari, Edge, Firefox)
- Create an account or log in with your credentials
- Add to your home screen for an app-like experience (optional)
- **Demo mode**: If you're evaluating without a server connection, the app runs with sample data — no setup required

**Navigation:** On desktop and tablet, a **sidebar** on the left provides direct access to all modules. On mobile, use the **bottom navigation bar** with a "More" menu for additional pages.

**Login Activity:** Each time you log in, a dialog shows all activity since your last session — new discrepancies, checks, status changes, and more — so you never miss what happened while you were away.

---

## WHAT YOU'LL SEE

### The Dashboard

When you log in, the **Dashboard** is your home base. At a glance you can see:

- **Current time and weather** for your installation
- **Active runway** with color-coded status (green = open, yellow = suspended, red = closed) — tap to change
- **Advisories** — INFO, CAUTION, or WARNING banners set by Airfield Management
- **NAVAID status** — green/yellow/red toggles for each navigation aid with notes
- **Current conditions** — RSC, BWC, and last check completed
- **Quick action buttons** — jump straight to Airfield Inspections, Airfield Checks, or New Discrepancy
- **Who's online** — see which team members are currently active
- **Installation switcher** — switch between bases if you're assigned to more than one (shown in the header)
- **Activity feed** — a live stream of everything happening on the airfield (tap any item to see details)

**Real-time updates:** The dashboard is powered by Supabase Realtime. When any team member changes the runway status, toggles a NAVAID, sets an advisory, or completes a check, every connected user sees the update within 1–2 seconds — no manual refresh required.

---

### Discrepancies

Track airfield problems from the moment they're found until they're fixed.

**What you can do:**
- Report a new discrepancy with photos, GPS location on a satellite map, and a description
- Choose from 11 types (FOD, pavement, lighting, markings, signage, drainage, vegetation, wildlife, obstruction, NAVAID, other)
- Assign to a Civil Engineering shop and track work order numbers
- Follow the status through its lifecycle: Open → Submitted to AFM → Submitted to CES → Work Completed → Closed
- Add timestamped notes as the issue progresses
- See how many days each discrepancy has been open
- Filter and search the full list by status, severity, type, or keyword
- Tap the KPI counters at the top to instantly filter (e.g., tap "Critical" to see only critical items)
- View all discrepancies on the **Common Operating Picture** — a satellite map with color-coded pins showing every open issue

---

### Airfield Checks

Record seven types of airfield checks, all from one screen.

**Check types available:**
- **FOD Check** — Select your route from base areas, record items found, and mark the area Clear or Not Clear
- **RSC Check** — Record whether the runway is Wet or Dry
- **RCR Check** — Record Mu friction readings (rollout, midpoint, departure), contaminant type and depth, braking action, equipment used, and surface temperature
- **IFE (In-Flight Emergency)** — Document aircraft info, incident details, and damage assessment
- **Ground Emergency** — Work through a 12-item action checklist covering all required notifications and response actions
- **Heavy Aircraft** — Log aircraft type, parking spot, weight, taxi route, and pavement observations
- **BASH** — Record wildlife condition code, species, mitigation actions, and habitat attractants

**For every check type:**
- Take photos directly from your device camera
- Pin the location on an interactive satellite map
- Attach **multiple issues per check**, each with its own description, photos, and map pin
- Add follow-up remarks
- **Drafts save automatically** to the cloud — start a check on your phone in the field and finish it on a desktop at the ops desk. If you lose connectivity, a local draft is saved as backup.
- View the full history of past checks with search and type filtering

---

### Daily Inspections

Complete your daily Airfield Inspection Report digitally.

**How it works:**
1. Open the inspection workspace — your checklist loads automatically
2. All items **default to Pass** — you only need to tap items that fail or don't apply
3. Tap an item to cycle: **Pass** (green) → **Fail** (red) → **N/A** (gray) → back to Pass
4. BWC items have a special four-level toggle: LOW / MOD / SEV / PROHIB
5. When an item fails, attach **multiple discrepancies** to that item — each discrepancy gets its own comment, GPS location on the map, and photos
6. Your progress **auto-saves** — if your browser closes, your draft is still there. Drafts sync across devices via the cloud.
7. When finished, tap **Complete** to mark your half done
8. A filer combines the Airfield and Lighting halves and **Files** the official daily report
9. Export the combined report as a **branded PDF** with pass/fail summaries, embedded photos, and satellite map thumbnails
10. **Email the PDF** directly from the app using the built-in email dialog

**The checklist is tailored to your base.** Base administrators customize the sections and items through the Settings page, so your inspection reflects your installation's actual airfield layout and infrastructure. No two bases have to use the same template.

**Additional inspection types:**
- Construction Meeting — with personnel attendance tracking
- Joint Monthly Inspection — multi-office coordination form

---

### Annual Compliance Safety Inspection (ACSI)

Conduct the comprehensive annual inspection required by DAFMAN 13-204, Volume 2.

**What it covers:**
- **10 inspection sections** with approximately 100 checklist items spanning: obstacle clearance, lighting, pavement, marking, signage, NAVAIDs, wildlife management, emergency response, administration, and security
- Each item gets a **Yes**, **No**, or **N/A** response
- Any failure generates a discrepancy with work order tracking, cost estimates, and photo documentation
- Capture **inspection team members** and their organizations
- Collect **risk management certification signatures** from the Operations Group Commander, Mission Support Group Commander, and Wing Commander
- Your progress auto-saves as you work through the checklist
- Export the completed report as a **professionally formatted PDF** or **Excel workbook**

---

### Reports

Generate four types of reports for briefings, shift turnover, and compliance records.

- **Daily Operations Summary** — Everything that happened on a given day or date range: inspections, checks, status changes, discrepancies, evaluations. Includes photos and satellite maps.
- **Open Discrepancies** — Current snapshot of all open issues with breakdowns by severity, type, shop, and area.
- **Discrepancy Trends** — See whether the backlog is growing or shrinking over 30 days, 90 days, 6 months, or a full year. Shows top problem areas and closure rates.
- **Aging Discrepancies** — Open items grouped by how old they are (0–7 days, 8–14 days, etc.) to identify items falling through the cracks.

Every report exports as a **branded PDF** with your installation name, embedded photos, satellite maps, page numbers, and timestamps. You can also **email any PDF** directly from the app — tap the email icon, enter a recipient (your default email is pre-filled), and send.

---

### Obstruction Evaluations

Evaluate potential obstructions against UFC 3-260-01 imaginary surfaces — no manual calculations needed.

**How it works:**
1. Tap a location on the satellite map (or enter coordinates manually)
2. Enter the object height in feet
3. The app automatically evaluates against **all 10 imaginary surfaces** for **every runway** at your base — simultaneously
4. See instantly which surfaces (if any) are violated, by how many feet, with the exact UFC table reference

**What makes this powerful:**
- A process that takes hours with printed manuals and hand calculations is done in **seconds**
- Color-coded surface overlays on the map (toggle each on/off)
- Attach multiple photos per evaluation
- Link evaluations to discrepancies and NOTAMs
- View full evaluation history
- Eliminates calculation errors entirely

---

### Aircraft Database

Look up over **200 military and civilian aircraft** with detailed specifications.

**What you can find:**
- Aircraft name, manufacturer, and category (military or commercial)
- Max takeoff weight, wingspan, length, height
- Wheel base, wheel tread, and turn radius
- ACN/PCN values for pavement loading analysis

**What you can do:**
- Search by name, manufacturer, or type designation
- Sort by weight, wingspan, or ACN values
- Filter between military and commercial aircraft
- Star your favorites for quick access
- Use the **ACN/PCN Comparison Panel** to check whether a specific aircraft is safe for your runway based on pavement capacity

---

### References & Library

Access 70 regulatory references with offline viewing.

**References tab:**
- Browse regulations from DAFMAN 13-204 (Vols 1–3), UFC 3-260-01, and cross-references (FAA, DoD, CFR)
- Search by title, description, or keyword
- Filter by category or publication type
- Star your most-used references as favorites
- Open PDFs directly in the app with pinch-to-zoom and page navigation
- Download all PDFs for **offline access** — view any regulation without an internet connection

**My Documents tab:**
- Upload your own PDFs, photos, or images (up to 50 MB each)
- The app extracts text from your PDFs so you can search within them
- Cache documents for offline viewing
- Access your uploads from any device where you log in

---

### Waivers

Manage the full lifecycle of airfield waivers — from draft through annual review.

**What you can do:**
- Create new waivers with all AF Form 505 fields (description, justification, risk assessment, criteria impact, coordination, etc.)
- Track coordination office-by-office (CE, AFM, Safety, Ops/TERPS, ATC, Wing Commander)
- Attach photos and documents (site maps, risk assessments, UFC excerpts, etc.)
- Move waivers through status transitions: Draft → Pending → Approved → Active → Expired/Closed/Cancelled (every transition requires a comment)
- Conduct annual reviews with recommendation, mitigation verification, and Facilities Board presentation tracking
- Export individual waivers as branded PDFs
- Export the full waiver register as an Excel workbook with multiple sheets (AFCEC Playbook Appendix B format)

The system comes pre-loaded with **17 real historical waivers** from Selfridge ANGB as reference examples.

---

### NOTAMs

See live NOTAMs for your installation pulled directly from the FAA.

**What you get:**
- Automatic NOTAM fetch for your base's ICAO code when you open the page
- Full NOTAM text displayed on each card
- Filter by FAA vs. LOCAL, Active vs. Expired
- Search NOTAMs for any airport by entering an ICAO code
- Connection status indicator shows when data was last fetched
- Create LOCAL NOTAMs for base-specific notices

---

### Activity Log

See a complete history of every action taken in the app — plus add your own notes.

- Filter by time period: Today, Last 7 Days, Last 30 Days, or a custom date range
- Columnar table showing Time (Z), User, Action, and Details for each entry
- **Add manual entries** — type free-text notes for events not captured by the system (phone calls, verbal orders, shift turnovers, meetings)
- **Edit or delete** any entry via a modal dialog with editable date, time, and notes
- Tap any entry to jump to the related discrepancy, check, inspection, or waiver
- Export the full log to Excel

---

### User Management (Admin Only)

If you have an admin role, you can manage users for your installation.

- **View all users** with search, role filters, and status filters
- **Invite new users** — they receive an email with a setup link to create their account
- **Edit user profiles** — update rank, name, role, and installation
- **Reset passwords** — send a reset email to any user
- **Deactivate/Reactivate** accounts
- **Delete accounts** (sys_admin only, with confirmation and full cascade cleanup)
- **Email privacy** — user email addresses are visible only to administrators, not to other users

**Data security:** Row-Level Security (RLS) is enforced at the database level. Users can only see and modify data from their assigned installation. This is not just application-level filtering — it's enforced by PostgreSQL security policies on every query.

---

### Settings

Configure your installation and personal preferences.

- **Profile** — View your name, email, rank, role, and assigned base. Set your **default PDF email** address.
- **Base Configuration** (admin) — Set up runways, NAVAIDs, airfield areas, CE shops, and upload your airfield diagram
- **Inspection Templates** (admin) — Customize your base's daily inspection checklists: add, edit, remove, and reorder sections and items
- **Appearance** — Switch between Day, Night, or Auto theme
- **Data & Storage** — View and clear cached data
- **About** — Current version and app information

---

## THEMES

Glidepath supports three visual modes:

- **Day** — Light background for outdoor/bright-light use
- **Night** — Dark background to reduce eye strain in low-light environments (e.g., night shift, ops desk)
- **Auto** — Follows your device's system setting

Change your theme in **Settings → Appearance**.

---

## WHAT TO TEST

As a beta tester, we'd appreciate your feedback on:

1. **Day-to-day usability** — Does the app flow the way you'd expect for your daily duties? Are the most important actions easy to find?
2. **Real-time dashboard** — Do the live updates work reliably? When a teammate changes runway status or completes a check, do you see it update within a few seconds?
3. **Inspection workflow** — Is the default-to-pass approach faster? Does multi-discrepancy per failed item cover your needs? Is the checklist easy to work through on a phone or tablet in the field?
4. **Discrepancy tracking** — Does the lifecycle (Open → CES → Work Completed → Closed) match how your shop actually works? Is the Common Operating Picture map useful?
5. **Check types** — Are the fields for each check type capturing the right information? Is anything missing? Do cloud-saved drafts work reliably across devices?
6. **ACSI inspections** — Does the 10-section, ~100-item checklist cover your annual compliance needs? Are the risk certification signature captures useful?
7. **Reports and email delivery** — Are the four report types useful for your briefings? Does emailing PDFs directly from the app save time?
8. **Obstruction evaluations** — Do the results make sense for obstructions you've evaluated before? Are the UFC references accurate?
9. **References** — Is the 70-entry library covering the regulations you need? Is offline caching useful?
10. **Waivers** — Does the AF-505 field set capture everything you track? Is the coordination workflow realistic?
11. **Performance** — How does the app feel on your device? Any slowness, crashes, or confusing behavior?
12. **Missing features** — What do you wish the app did that it doesn't?

---

## PROVIDING FEEDBACK

Please report any issues, suggestions, or feedback to the Glidepath development team. When reporting a problem, include:

- **What you were doing** when the issue occurred
- **What you expected** to happen
- **What actually happened**
- **Your device and browser** (e.g., iPhone 15 / Safari, iPad / Chrome, Windows / Edge)
- **Screenshots** if possible

---

## QUICK REFERENCE

| Feature | Where to Find It |
|---------|-----------------|
| Dashboard | Home screen (first page after login) |
| Discrepancies | Sidebar → Discrepancies, or Dashboard quick action |
| Airfield Checks | Sidebar → Airfield Checks, or Dashboard quick action |
| Daily Inspections | Sidebar → Inspections, or Dashboard quick action |
| ACSI Inspection | Sidebar → Inspections → Annual Compliance |
| Reports | Sidebar → Reports |
| Obstructions | Sidebar → Obstruction Eval |
| Aircraft Database | Sidebar → Aircraft |
| References | Sidebar → Regulations |
| Waivers | Sidebar → Waivers |
| NOTAMs | Sidebar → NOTAMs |
| Activity Log | Sidebar → Activity Log |
| Settings | Sidebar → Settings |
| User Management | Sidebar → User Management (admin only) |

*On mobile, access all modules through the bottom navigation bar's "More" menu.*

---

*Glidepath v2.14.0 — Beta Testing Program*
*Built by MSgt Chris Proctor, 127th Wing Airfield Management, Selfridge ANGB*
*Thank you for helping us improve Airfield Management operations.*
