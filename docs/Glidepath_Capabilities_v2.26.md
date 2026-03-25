# Glidepath Capabilities Document

**Version 2.27.0** | March 2026

Glidepath is a Progressive Web Application (PWA) purpose-built for Department of the Air Force airfield management operations. It digitizes the daily workflows of Airfield Management professionals -- inspections, checks, discrepancy tracking, emergency checklists, NAVAID infrastructure management, obstruction evaluations, parking plans, wildlife/BASH reporting, and more -- into a single, real-time platform accessible from any device with a web browser.

This document provides a comprehensive walkthrough of every Glidepath module. It is written for Airfield Managers, squadron leadership, Civil Engineer liaisons, and anyone evaluating or adopting the tool.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Airfield Status](#2-airfield-status)
3. [Dashboard](#3-dashboard)
4. [Airfield Checks](#4-airfield-checks)
5. [Daily Inspections](#5-daily-inspections)
6. [ACSI Annual Compliance](#6-acsi-annual-compliance)
7. [Discrepancy Management](#7-discrepancy-management)
8. [CES Work Order Workflow](#8-ces-work-order-workflow)
9. [Visual NAVAIDs & Infrastructure](#9-visual-navaids--infrastructure)
10. [Aircraft Parking Plans](#10-aircraft-parking-plans)
11. [Obstruction Evaluations](#11-obstruction-evaluations)
12. [Quick Reaction Checklists](#12-quick-reaction-checklists)
13. [Shift Checklist](#13-shift-checklist)
14. [Wildlife/BASH](#14-wildlifebash)
15. [Waivers](#15-waivers)
16. [NOTAMs](#16-notams)
17. [Reports & Analytics](#17-reports--analytics)
18. [Events Log](#18-events-log)
19. [Aircraft Database](#19-aircraft-database)
20. [Regulations Library](#20-regulations-library)
21. [Personnel on Airfield](#21-personnel-on-airfield)
22. [Settings & Base Configuration](#22-settings--base-configuration)
23. [User Management](#23-user-management)
24. [Multi-Base Operations](#24-multi-base-operations)

---

## 1. Getting Started

Glidepath is accessed through any modern web browser -- Chrome, Edge, Safari, or Firefox -- on desktop, tablet, or mobile devices. As a Progressive Web App, it can be installed to your device's home screen for a native app experience with offline caching. This section covers how to sign in, navigate the application, and personalize your experience.

![Glidepath login page showing email and password fields, demo access link, and version footer](screenshots/S01%20(1).png)

![Dashboard home page after login with KPI badges, quick actions, and activity feed](screenshots/S01%20(2).png)

![Sidebar navigation on desktop showing all modules organized by category](screenshots/S01%20(3).png)

![More menu on mobile showing additional navigation options](screenshots/S01%20(4).png)

### Key Features

- **Email/password authentication** with Supabase Auth -- military CAC integration is not required
- **Remember Me** option to persist your session across browser restarts
- **Forgot Password** flow sends a recovery email to reset your credentials
- **Create Account** for self-registration -- new users select their installation and role, then wait for admin approval before gaining access
- **Demo Mode** accessible via `?demo=true` URL parameter -- explore all features with sample data, no account needed
- **First-time login** prompts you to select your installation (base) and complete your profile (rank, name, operating initials)
- **Sidebar navigation** (desktop) organizes all modules into logical groups with collapsible sections
- **Bottom navigation bar** (mobile/tablet) provides quick access to the five most-used screens: Status, Dashboard, Obstruction, Events Log, and More
- **More menu** surfaces additional modules and settings on mobile
- **Theme toggle** switches between Day (light), Night (dark), and Auto (follows device setting) modes
- **PWA installation** -- tap "Add to Home Screen" in your browser for a full-screen app experience

### How to Use

1. Open your browser and navigate to your organization's Glidepath URL.
2. Enter your email address and password. Check **Remember Me** if you want to stay signed in.
3. Click **Sign In**. If this is your first login, you will be prompted to select your installation and complete your profile.
4. On desktop, use the **sidebar** on the left to navigate between modules. Click a group header to expand or collapse its section.
5. On mobile, use the **bottom navigation bar** for primary screens. Tap **More** to access additional modules.
6. To change the visual theme, go to **Settings** and choose Day, Night, or Auto under the Appearance section.
7. To try Glidepath without an account, append `?demo=true` to the login URL. All features are available with sample data.

> **Best Practices**
>
> - Install Glidepath as a PWA on your duty phone and tablet for instant access without opening a browser.
> - Use Auto theme so the display automatically adjusts for day and night operations.
> - Complete your profile immediately after first login -- your operating initials appear in the Events Log and are required for QRC execution.
> - Bookmark the demo link (`?demo=true`) to give leadership or visitors a quick tour without affecting live data.

---

## 2. Airfield Status

The Airfield Status page is the real-time operational hub for your installation. It consolidates runway conditions, weather, NAVAID status, ARFF readiness, and contractor activity into a single view that updates across all connected devices in real time via Supabase Realtime subscriptions. Any change made by one user -- closing a runway, updating BWC, toggling a NAVAID -- propagates instantly to every other user viewing the page.

![Airfield Status page showing runway cards, weather, and advisory banners](screenshots/S01%20(5).png)

![Runway status change dialog with Open/Suspended/Closed options and remarks field](screenshots/S01%20(6).png)

![RSC/RCR entry panel with condition selector and Mu reading fields](screenshots/S01%20(7).png)

![NAVAID status panel with per-system green/yellow/red toggles organized by runway end](screenshots/S01%20(8).png)

![ARFF readiness section showing aircraft categories and overall readiness level](screenshots/S01%20(9).png)

![Active contractors panel showing personnel on the airfield with company and location details](screenshots/S01%20(10).png)

### Key Features

- **Runway status cards** for each configured runway -- color-coded Open (green), Suspended (yellow), Closed (red) with timestamp and remarks
- **Status change dialog** with mandatory remarks field and audit trail (who changed what, when)
- **RSC (Runway Surface Condition)** selector with free-text condition description
- **RCR (Runway Condition Reading)** entry with three Mu reading fields: Touchdown, Midpoint, and Rollout
- **BWC (Bird Watch Condition)** dropdown: LOW, MODERATE, SEVERE, PROHIBITIVE
- **Live weather display** from Open-Meteo: temperature, wind speed/direction, visibility, sky conditions -- updated automatically
- **Advisory banners** (INFO / CAUTION / WARNING) for base-wide operational notices
- **NAVAID status panel** with Green/Yellow/Red toggles per system, organized by runway end, with optional notes
- **ARFF readiness** showing per-aircraft CAT level and overall readiness calculation (Optimum / Reduced / Critical / Inadequate)
- **Active contractors** list with company name, location, callsign, and work description
- **Construction and Miscellaneous remarks** fields for freeform operational notes
- **Real-time sync** -- all changes propagate instantly to every connected device

### How to Use

1. Navigate to **Airfield Status** from the sidebar or bottom nav (Status tab).
2. To change a runway's status, tap the runway card and select **Open**, **Suspended**, or **Closed**. Enter remarks describing the reason (e.g., "Snow removal in progress"). Click **Update**.
3. To update RSC, tap the RSC section for the desired runway. Select the surface condition from the dropdown and optionally enter a text description. Click **Save**.
4. To enter RCR readings, tap the RCR section. Enter Mu values for Touchdown, Midpoint, and Rollout zones. Click **Save**.
5. To update BWC, select the appropriate level from the dropdown. The change is logged and visible to all users immediately.
6. To update NAVAID status, scroll to the NAVAID panel. For each system (e.g., PAPI, MALSR, REIL), tap the current status indicator to cycle through Green, Yellow, or Red. Add a note if needed (e.g., "Units 3-5 INOP, maintenance scheduled").
7. To update ARFF readiness, select the CAT level for each aircraft. The system calculates overall readiness automatically.
8. To log contractor presence, scroll to the Contractors section and tap **Add Contractor**. Enter company name, number of personnel, location, work description, and callsign.

> **Best Practices**
>
> - Update runway status immediately when conditions change -- this page is the single source of truth for your airfield's operational posture.
> - Always include meaningful remarks when changing runway status. These remarks feed into the Daily Operations Summary report and the Events Log.
> - Review NAVAID status after every lighting inspection to ensure the map reflects actual conditions.
> - Use the Advisory banner for time-sensitive notices (e.g., airshow setup, exercises, construction closures) so all personnel see them on login.
> - Keep the Contractors section current -- it provides accountability for who is operating on your airfield at any given time.

---

## 3. Dashboard

The Dashboard is your personalized command center. It provides at-a-glance Key Performance Indicator (KPI) badges, quick-action buttons to start common tasks, and an activity feed showing recent events across the base. It is designed so that an Airfield Manager can assess the current state of operations within seconds of opening the app.

![Dashboard KPI badges showing counts for inspections, checks, discrepancies, QRCs, and shift checklist status](screenshots/S01%20(11).png)

![QRC quick-launch dialog allowing users to start or resume a Quick Reaction Checklist directly from the dashboard](screenshots/S01%20(12).png)

![Shift checklist dialog showing today's checklist items that can be marked complete without leaving the dashboard](screenshots/S01%20(13).png)

### Key Features

- **KPI badge grid** with real-time counts: today's inspections, checks completed, open discrepancies, active QRCs, shift checklist progress
- **Quick actions**: Begin Inspection, Begin Check, New Discrepancy -- one tap to start common workflows
- **QRC quick-launch dialog** -- start or resume an emergency checklist without navigating away from the dashboard
- **Shift checklist dialog** -- mark items complete inline, see today's progress bar
- **User presence tracking** -- see who is Online, Away, or Inactive across your installation
- **Activity feed** showing the most recent actions with enriched labels (e.g., "Filed airfield inspection", "Closed discrepancy #47")
- **Live clock** displaying current Zulu (UTC) time

### How to Use

1. The Dashboard loads automatically after login (or navigate to it via the sidebar/bottom nav).
2. Review the **KPI badges** at the top. Each badge shows a count and is tappable to navigate to the relevant module.
3. To start an inspection, tap **Begin Inspection**. To start a check, tap **Begin Check**. To log a new discrepancy, tap **New Discrepancy**.
4. If a QRC is active, the QRC badge displays the count. Tap it or tap the QRC quick-launch button to open the dialog, then select the checklist to resume.
5. To review or complete shift checklist items, tap the **Shift Checklist** badge or quick-action button. The dialog shows today's items with checkboxes. Mark items complete and add notes as needed.
6. The **Activity Feed** at the bottom shows the latest events. Tap any entry to navigate to the source entity (inspection, check, discrepancy, etc.).
7. The **Presence** section shows which team members are currently active.

> **Best Practices**
>
> - Start every shift by reviewing the Dashboard -- KPI badges tell you immediately if anything needs attention (open QRCs, incomplete checklist items, overdue discrepancies).
> - Use the quick-launch buttons instead of navigating through menus -- they save time during high-tempo operations.
> - Monitor user presence during exercises or emergencies to confirm your team is online and active.
> - The activity feed is a quick way to catch up on what happened during the previous shift without pulling a full report.

---

## 4. Airfield Checks

Airfield Checks capture the structured inspections and condition assessments that Airfield Management performs throughout the day. Glidepath supports seven check types, each with its own tailored form. All checks support multi-issue documentation with photos and GPS pins, cross-device draft persistence, and PDF export.

![Check type selector showing the seven available check types with icons](screenshots/S01%20(14).png)

![FOD check form with location fields, issue description, and photo upload](screenshots/S01%20(15).png)

![RSC/RCR check form with surface condition fields and Mu reading inputs](screenshots/S01%20(16).png)

![Ground emergency checklist with step-by-step action items and notification tracking](screenshots/S01%20(17).png)

![Check detail and history view showing completed checks with type filtering and search](screenshots/S01%20(18).png)

### Key Features

- **Seven check types**: FOD Walk, RSC (Runway Surface Condition), RCR (Runway Condition Reading), IFE (In-Flight Emergency), Ground Emergency, Heavy Aircraft, and BASH (Bird/Wildlife Aircraft Strike Hazard)
- **Type-specific forms** -- each check type presents only the fields relevant to that operation
- **Multi-issue support** -- document multiple findings within a single check, each with its own description, photos, and GPS pin
- **Per-issue photo uploads** with camera capture or file picker, linked to specific issues via `issue_index`
- **GPS pin placement** on a Mapbox satellite map for precise location documentation
- **Cross-device draft persistence** -- drafts save to both localStorage (instant) and Supabase (cloud). Use "Save Draft" to ensure your work is available on another device
- **started_at timestamp** captured the moment you select a check type, providing accurate duration metrics
- **Check editing** -- authorized users (admins, NAMOs, AFMs, and the original submitter) can edit filed checks to add remarks, upload additional photos per issue, or correct details
- **Newest-first remarks** -- remarks on checks display with the most recent at the top for easy scanning
- **History view** with type filtering, text search, and date range selection
- **PDF export** for any completed check, with option to email the PDF directly

### How to Use

1. From the Dashboard, tap **Begin Check**, or navigate to the Checks module from the sidebar.
2. Select the **check type** from the selector screen (e.g., FOD Walk, RSC, Ground Emergency).
3. Fill in the required fields. For a FOD check, this includes location (runway/taxiway/apron), condition description, and any issues found.
4. To document an issue, tap **Add Issue**. Enter the description, take or upload a photo, and tap the map to place a GPS pin at the exact location.
5. To add additional issues within the same check, tap **Add Issue** again. Each issue is numbered and tracked independently.
6. To save your progress and continue later (even on a different device), tap **Save Draft**. The draft will appear when you return to the Checks module.
7. When all fields are complete, tap **Submit** to file the check. The system records the completion time and logs the activity.
8. To review past checks, scroll down to the History section. Use the type filter chips and search bar to find specific checks.
9. To export a check as PDF, open the check detail and tap **Export PDF**. To email it, tap **Email PDF** and enter the recipient address.

> **Best Practices**
>
> - Always take photos of FOD findings and pavement deficiencies -- photo evidence is critical for discrepancy tracking and CES work orders.
> - Use GPS pins consistently so that issues can be plotted on the Common Operating Picture map.
> - Save drafts before walking to areas with poor connectivity. The draft persists locally and syncs when you return to coverage.
> - For RSC/RCR checks, enter Mu readings immediately after the friction measurement vehicle completes its run to ensure accuracy.
> - Review the History tab at the start of each shift to see what checks the previous shift completed.

---

## 5. Daily Inspections

Daily Inspections are the cornerstone of airfield management operations. Glidepath digitizes the daily airfield and lighting inspection process with customizable templates, default-to-pass logic, multi-discrepancy documentation per failed item, and automatic NAVAID status synchronization. The system enforces a one-per-day policy to prevent duplicate inspections.

![Inspection workspace showing checklist items with Pass/Fail/N/A toggles and section navigation](screenshots/S01%20(19).png)

![Failed item expanded showing discrepancy panel with comments, GPS pin, and photo upload](screenshots/S01%20(20).png)

![Inspection completion summary with statistics, discrepancy count, and file confirmation](screenshots/S01%20(21).png)

![One-per-day blocking modal showing that an inspection is already in progress for today](screenshots/S01%20(22).png)

### Key Features

- **Two inspection halves**: Airfield (daytime walk-through of pavement, signs, markings, obstructions) and Lighting (nighttime check of all lighting systems)
- **Customizable templates** -- Base Configuration allows admins to define sections and items for each inspection type
- **Default-to-Pass** -- all items start as Pass. Toggle cycles: Pass, Fail, N/A, back to Pass. This eliminates tedious clicking through dozens of passing items.
- **Multiple discrepancies per failed item** -- when you mark an item as Fail, a discrepancy panel opens. You can add multiple discrepancies for a single failed item, each with its own comment, GPS pin, and photos.
- **BWC integration** -- Bird Watch Condition can be recorded as part of the inspection
- **Draft persistence** -- auto-saves to localStorage continuously; loads from Supabase for cross-device resume
- **One-per-day enforcement** -- maximum one airfield inspection and one lighting inspection per calendar day, with a 0600 Local reset aligned to the installation's timezone
- **Cross-user blocking** -- if another user has an inspection in progress, the system tells you who and prevents a duplicate
- **Inspector-only Resume/Delete** -- only the user who started an inspection can resume or delete it
- **NAVAID status auto-sync** -- when you file a lighting inspection, NAVAID statuses on the Airfield Status page are automatically updated based on discrepancies you documented
- **Combined PDF export** with all items, discrepancies, and embedded photos
- **Additional inspection types**: Construction Meeting and Joint Monthly inspection forms

### How to Use

1. From the Dashboard, tap **Begin Inspection**, or navigate to Inspections from the sidebar.
2. Select the inspection type: **Airfield**, **Lighting**, **Construction Meeting**, or **Joint Monthly**.
3. If an inspection of that type already exists for today, a blocking modal will appear showing who started it and when. You cannot create a duplicate.
4. The inspection workspace opens with all sections and items from your base's template. All items default to **Pass** (green).
5. Walk the airfield with your device. For each item, review the condition:
   - If satisfactory, leave it as **Pass** (no action needed).
   - If deficient, tap to toggle to **Fail** (red). A discrepancy panel appears below the item.
   - If not applicable (e.g., construction area not active), tap again to toggle to **N/A** (gray).
6. For each failed item, fill in the discrepancy details: type, description, and optional GPS pin and photos. To add a second discrepancy for the same item, tap **Add Discrepancy**.
7. Your progress auto-saves continuously. If you need to pause and resume later, simply close the app and reopen -- your draft will be waiting.
8. When the inspection is complete, tap **File Inspection**. Review the completion summary showing pass/fail/NA counts and total discrepancies.
9. Upon filing, all documented discrepancies are created in the Discrepancy Management module, and NAVAID statuses are synced to the Airfield Status page.
10. To export the filed inspection, tap **Export PDF** or **Email PDF** from the inspection detail view.

> **Best Practices**
>
> - Conduct inspections with the app open on a tablet for the best experience -- the larger screen makes it easier to review sections and take photos.
> - Do not rush through Pass items. The default-to-pass design saves time, but you should still visually confirm each item.
> - Take at least one photo per failed item. Photo evidence strengthens discrepancy documentation and CES work order requests.
> - Use GPS pins on every failed item so discrepancies appear correctly on the Common Operating Picture map.
> - File the inspection promptly after completion -- delaying creates a window where another user might attempt to start a duplicate.
> - After filing a lighting inspection, verify the Airfield Status page reflects the updated NAVAID statuses.

---

## 6. ACSI Annual Compliance

The Annual Compliance and Safety Inspection (ACSI) module digitizes the comprehensive annual evaluation required by DAFMAN 13-204v2 Para 5.4.3. It covers approximately 100 items across 10 sections, supports multi-member inspection teams, captures risk management certifications, and generates publication-ready PDF and Excel exports.

![ACSI form showing the 10 inspection sections with completion progress indicators](screenshots/S01%20(23).png)

![ACSI section expanded showing individual items with Y/N/N/A toggles and discrepancy fields](screenshots/S01%20(24).png)

![ACSI team roster editor showing required roles (AFM, CE, Safety) and additional team members](screenshots/S01%20(25).png)

### Key Features

- **10 inspection sections** covering all DAFMAN 13-204v2 ACSI requirements, with approximately 100 individual items
- **Y/N/N/A toggle** per item -- Yes (compliant), No (deficient), Not Applicable
- **Per-item discrepancy documentation** for items marked No: comment, work order number, project number, estimated cost, and projected completion date
- **Link Existing Discrepancy** -- when marking an item as No, you can pull in an already-tracked discrepancy from the Discrepancy Management module instead of re-entering details. Photos, work order numbers, location pins, and descriptions are imported automatically. Multiple linked discrepancies merge into a single entry per item with combined text and accumulated photos.
- **Discrepancy picker with filters** -- searchable modal with status and type filter chips; already-linked discrepancies show a green "LINKED" badge
- **Auto-expanding comment fields** -- discrepancy comment textareas grow automatically as text is added or imported
- **Photo and map uploads** on failed items for evidence documentation
- **Inspection team editor** with required roles (Airfield Manager, Civil Engineer, Safety) plus additional team members
- **Risk management certification** with three signature blocks
- **Draft persistence**: auto-saves to localStorage continuously and to the database on page load, ensuring no work is lost
- **Mark All Y** -- bulk-set all items in a section to Yes for rapid completion of compliant sections
- **PDF export** with parent/sub-field hierarchy, inline photos and maps, and professional formatting
- **Excel export** with four sheets: Summary, Items, Discrepancies, and Team

### How to Use

1. Navigate to **ACSI** from the sidebar (under Inspections).
2. If an ACSI inspection is already in draft, it will load automatically. Otherwise, tap **New ACSI Inspection** to start.
3. Set up the **Inspection Team** first. Tap the team roster section and add team members by role. AFM, CE, and Safety representatives are required.
4. Work through each of the 10 sections. Tap a section header to expand it and reveal the individual items.
5. For each item, select **Y** (compliant), **N** (deficient), or **N/A** (not applicable).
6. If a section is fully compliant, use the **Mark All Y** button to set all items to Yes in one action.
7. For any item marked **N**, a discrepancy panel expands. You have two options:
   - **Add New**: Enter the comment describing the deficiency, work order number, project number, estimated cost, and projected completion date manually.
   - **Link Existing**: Tap the cyan "Link Existing" button to open the discrepancy picker. Search or filter by status and type, then select a tracked discrepancy. Its description, photos, work order number, and GPS location are imported automatically. You can link multiple discrepancies -- they merge into a single entry with combined text.
8. To attach evidence to a failed item, use the photo upload or map capture buttons within the discrepancy panel. Photos from linked discrepancies are included automatically.
9. When all sections are complete, review the **Risk Management Certification** section and fill in the three signature blocks.
10. Tap **File ACSI** to finalize. The inspection is locked and available for export.
11. To generate outputs, use **Export PDF** for a formatted report or **Export Excel** for a spreadsheet with four detail sheets.

> **Best Practices**
>
> - Begin the ACSI well before the annual deadline. The draft persistence feature allows your team to work on it over multiple days or weeks.
> - Assign section owners among team members. Each person can fill in their sections independently, and the draft syncs across devices.
> - Attach photos to every deficient item -- reviewers and inspectors general expect visual evidence.
> - Use the Excel export to share raw data with CE for project planning and budgeting.
> - Complete the team roster before starting item reviews so the PDF export includes the full team listing.

---

## 7. Discrepancy Management

Discrepancy Management is the central tracking system for all airfield deficiencies. Whether identified during inspections, checks, or direct observation, every discrepancy flows through a structured lifecycle from creation to closure. The module includes list and map views, photo documentation, NAVAID system integration, configurable PDF exports, and full audit history.

![Discrepancy list view with status filters, type badges, and severity indicators](screenshots/S01%20(26).png)

![Discrepancy map view showing severity-colored pins on satellite imagery with shop filter chips](screenshots/S01%20(27).png)

![Create discrepancy form with type selector, location fields, description, and photo upload](screenshots/S01%20(28).png)

![Discrepancy detail page showing full lifecycle history, photos, linked NOTAMs, and notes](screenshots/S01%20(29).png)

![Status update modal with workflow status options and required remarks field](screenshots/S01%20(30).png)

![NAVAID system map on discrepancy detail showing the affected system and all its components](screenshots/S01%20(31).png)

### Key Features

- **11 discrepancy types**: FOD Hazard, Pavement Deficiency, Lighting Outage, Marking Deficiency, Signage Deficiency, Drainage Issue, Vegetation Encroachment, Wildlife Hazard, Airfield Obstruction, NAVAID Deficiency, and Other
- **Full lifecycle tracking**: Open, Submitted to AFM, Submitted to CES, Awaiting Action by CES, Waiting for Project Design/Execution, Work Completed and Awaiting Verification, Closed, Cancelled
- **Auto-assign CE shop** on creation using the configurable type-to-shop mapping defined in Base Setup
- **Photo uploads** with camera capture or file picker
- **Mapbox location pinning** -- tap the map to set the exact location; the pin appears on the Common Operating Picture
- **NAVAID system overview map** -- when a discrepancy is linked to an infrastructure feature, the detail page shows a system map with all related components highlighted
- **Notes history** with Zulu timestamps and user attribution
- **Work order tracking** -- link CES work order numbers for cross-reference
- **Linked NOTAMs** -- associate relevant NOTAMs with discrepancies
- **Map view** (Common Operating Picture) -- all open discrepancies plotted on satellite imagery with severity-colored pins and CE shop filter chips
- **Natural language titles** -- the system generates human-readable titles like "TWY B Edge Light Out of Service" instead of raw type codes
- **Configurable PDF export** with column toggles (select which fields to include) and named templates you can save and reuse
- **Email PDF delivery** -- send the PDF directly to recipients from within the app

### How to Use

1. Navigate to **Discrepancies** from the sidebar, or tap **New Discrepancy** from the Dashboard.
2. To create a new discrepancy, tap **New Discrepancy** and fill in:
   - **Type** (e.g., Lighting Outage, Pavement Deficiency)
   - **Location** (runway, taxiway, apron, or other area -- select from the dropdown or type custom)
   - **Description** with details of the deficiency
   - **Severity** (Low, Medium, High, Critical)
   - **GPS pin** -- tap the map to set the location
   - **Photos** -- take or upload photos of the deficiency
3. Tap **Submit**. The system auto-assigns the appropriate CE shop based on the type-to-shop mapping and sets the initial status.
4. To update a discrepancy's status, open it and tap **Update Status**. Select the new status from the workflow options and enter required remarks.
5. To add a note, scroll to the Notes section on the detail page and enter your update. Notes are timestamped in Zulu time with your name.
6. To view all discrepancies on a map, tap the **Map** tab at the top of the Discrepancy list. Use the shop filter chips to focus on specific CE shops.
7. To export discrepancies, tap **Export PDF**. Configure which columns to include, optionally save the configuration as a named template, and generate.
8. To email a PDF, tap **Email PDF**, enter the recipient address (your default PDF email pre-fills), and send.

> **Best Practices**
>
> - Always set a GPS pin when creating a discrepancy. The map view is only useful when every discrepancy has a location.
> - Use the status workflow consistently. "Submitted to CES" means the work order has been initiated; "Awaiting Action by CES" means CES has acknowledged and is planning the repair.
> - Add notes each time there is a meaningful update (CES site visit, parts ordered, work scheduled). This creates a defensible audit trail.
> - Review the map view weekly in your staff meeting -- the Common Operating Picture shows patterns (e.g., clustering of pavement issues on a specific taxiway).
> - Save PDF export templates for recurring reports (e.g., "Weekly CE Brief" with specific columns) so you can regenerate them with one click.

---

## 8. CES Work Order Workflow

The CES Work Order Workflow provides a dedicated interface for Civil Engineer Squadron personnel assigned to support airfield maintenance. CES-role users see a simplified, focused view of the application tailored to their responsibilities: reviewing and actioning work orders generated from airfield discrepancies.

![CES Work Orders dashboard showing shop tabs with KPI counts and priority-sorted work queue](screenshots/S01%20(32).png)

![CES status update modal with limited status options and required resolution notes](screenshots/S01%20(33).png)

### Key Features

- **Dedicated dashboard** for CES-role users with shop tabs matching the CE shops configured for the base
- **KPI counts per shop**: New, In Work, Project, Verify (awaiting verification), and Overdue
- **Priority-sorted work queue** -- highest severity and oldest items surface first
- **Limited status transitions**: CES users can set work orders to In Work, Project (waiting for project design/execution), or Work Completed. They cannot Close or Cancel -- that remains an AFM responsibility.
- **Resolution notes required** for every status change, ensuring accountability
- **Simplified navigation** -- CES-role users see only four modules: CES Work Orders, Discrepancies, Visual NAVAIDs, and Settings
- **Flat sidebar** -- no collapsible dropdown groups, just direct links to the four available modules

### How to Use

1. Log in with a CES-role account. The app automatically shows the CES Work Orders dashboard as your home page.
2. Review the **shop tabs** at the top. Each tab shows your assigned shop's work queue with KPI counts.
3. Tap a work order to view its details, including the original discrepancy, photos, location map, and notes history.
4. To update a work order's status, tap **Update Status** and select from:
   - **In Work** -- your shop has begun the repair
   - **Project** -- the repair requires project-level design or funding
   - **Work Completed** -- the repair is finished and ready for AFM verification
5. Enter **resolution notes** describing what was done or what is needed. These notes are visible to AFM staff.
6. The work order returns to AFM for verification and closure.

> **Best Practices**
>
> - Check the CES dashboard at the start of each duty day. New work orders from overnight inspections will appear at the top of the queue.
> - Always enter detailed resolution notes when marking "Work Completed." AFM needs to know what was repaired to verify the fix during the next inspection.
> - Use the "Project" status when a repair requires design, funding, or contract support. Include the project number in the notes so AFM can track it.
> - Coordinate with AFM when multiple work orders affect the same area -- they may need to issue NOTAMs or close the affected surface.

---

## 9. Visual NAVAIDs & Infrastructure

The Visual NAVAIDs and Infrastructure module is a comprehensive mapping and management system for all airfield lighting, signage, and miscellaneous features. Built on Mapbox satellite imagery, it provides interactive placement, outage tracking with DAFMAN 13-204v2 compliance calculations, system health monitoring, and audit tools for bulk operations.

![Infrastructure map showing airfield features plotted on satellite imagery with custom icons](screenshots/S01%20(34).png)

![Feature edit popup showing details, status toggle, system/component assignment, and fixture ID](screenshots/S01%20(35).png)

![System Health Panel showing per-system status, DAFMAN thresholds, and bar-level detail](screenshots/S01%20(36).png)

![Audit Mode panel with filter-based component assignment, sequential labeling, and bulk operations](screenshots/S01%20(37).png)

![Legend panel showing the four feature groups with per-type and per-layer visibility toggles](screenshots/S01%20(38).png)

![Health rings on map showing yellow (approaching threshold) and red (exceeded threshold) indicators around components](screenshots/S01%20(39).png)

### Key Features

- **Interactive satellite map** with 23 feature types across 4 groups: Signs, Taxiway Lights, Runway Lights, and Miscellaneous
- **Click-to-place** features on the map, drag-to-move, and rotation controls
- **Custom canvas-rendered icons** -- signs display with correct colors and text; lights show type-appropriate symbols
- **Bar placement mode** for approach lighting systems (ALSF, MALSR, SSALR, ODALS, etc.) with 6 bar types and geodesic offset calculations
- **Bar group linkage** -- `bar_group_id` groups individual lights into physical bars for aggregate health calculations
- **Outage compliance engine** implementing DAFMAN 13-204v2 Table A3.1: 23 system types with configurable thresholds and 4-tier alerts (Green = operational, Yellow = approaching limit, Red = limit exceeded, Black = system inoperative)
- **Bar-level analysis** -- 3 or more inoperative lights on a single bar marks the entire bar as inoperative
- **System Health Panel** showing per-system status, bar-level detail, DAFMAN-prescribed corrective actions, and outage timeline
- **Outage-to-discrepancy linking** -- reporting a feature as INOP automatically creates a discrepancy with a structured description (status, component, location, and DAFMAN bar-out note when applicable)
- **Marking operational** prompts to close linked discrepancies with user attribution and Zulu timestamp
- **Health rings on map** -- colored rings around features show system health at a glance (Yellow = approaching, Red = exceeded)
- **Legend panel** with 3-tier organization: type groups, system assignments, and per-layer visibility toggles
- **Audit Mode** -- a dedicated panel for bulk operations: filter-based component assignment, sequential labeling, fixture ID generation (format: {SystemPrefix}-{TypeAbbrev}-{###}), bulk delete, and bar group management with bulk rename
- **Import support** for KML, CSV, GeoJSON, and DXF files from survey tools and Google Earth
- **Fixture ID system** -- unique identifiers for every feature following the pattern `TWYA-TL-001`
- **Paginated data fetch** for large installations with thousands of features

### How to Use

1. Navigate to **Visual NAVAIDs** from the sidebar.
2. The satellite map loads with all features for your installation. Use the **Legend** (toggle in the header) to show/hide feature types and layers.
3. **To add a feature**: Select the feature type from the toolbar, then click the map to place it. A popup appears to set the label (for signs), system/component assignment, and fixture ID.
4. **To edit a feature**: Click any feature on the map. The edit popup shows all fields: status (Operational/INOP), system, component, fixture ID, rotation, and notes.
5. **To report an outage**: Click the feature, toggle its status to INOP, and confirm. A discrepancy is automatically created and linked.
6. **To restore a feature**: Click the INOP feature, toggle to Operational, and confirm. The system prompts you to close the linked discrepancy.
7. **To use Bar Placement mode**: Select the bar type from the toolbar, click the map to set the starting point, and follow the prompts to place lights along the bar with correct geodesic spacing.
8. **To view system health**: Open the **System Health Panel** from the header. Each system shows its current tier, the DAFMAN threshold, and a breakdown of operational vs. inoperative features. Expand a system to see bar-level detail.
9. **To use Audit Mode**: Toggle Audit Mode from the header. The panel provides tools for bulk operations:
   - Select features by type or area, then assign them to a system/component in bulk
   - Generate sequential fixture IDs for selected features
   - Link selected features into bar groups
   - Bulk delete or rename
10. **To import features**: Click the import button in the header and select KML, CSV, GeoJSON, or DXF. Configure the feature type, layer, and rotation for imported placemarks.

> **Best Practices**
>
> - Complete the initial feature inventory using Audit Mode and KML import before going live. Manually placing thousands of features is impractical.
> - Assign every feature to a system and component. The outage compliance engine depends on accurate system assignments to calculate thresholds.
> - Use bar groups for all approach and runway lighting bars. The bar-level analysis (3+ INOP = bar INOP) is a DAFMAN requirement.
> - Monitor the System Health Panel daily. Yellow-tier systems need proactive maintenance scheduling before they reach Red.
> - After every lighting inspection, update INOP features on this map. The system will auto-create discrepancies and sync NAVAID status to the Airfield Status page.
> - Use fixture IDs when communicating with CE and maintenance teams -- they provide an unambiguous reference to a specific light or sign.

---

## 10. Aircraft Parking Plans

The Aircraft Parking Plans module lets you create to-scale parking layouts on a satellite map with accurate aircraft silhouettes, wingtip clearance calculations, obstacle tracking, and taxilane definitions. It is designed for generating parking plans for exercises, deployments, airshows, and surge operations.

![Parking map showing to-scale aircraft silhouettes positioned on apron with clearance indicators](screenshots/S01%20(40).png)

![Floating panel Aircraft tab showing list of placed aircraft with type, tail number, and position](screenshots/S01%20(41).png)

![Right-click context menu on an aircraft showing options to edit details, duplicate, or remove](screenshots/S01%20(42).png)

![Clearance tab showing wingtip violations highlighted in red with UFC references](screenshots/S01%20(43).png)

![Parking plan PDF export showing map capture with aircraft positions, legend, and clearance summary](screenshots/S01%20(44).png)

### Key Features

- **Interactive Mapbox satellite map** with to-scale SVG aircraft silhouettes rendered at accurate wingspan dimensions
- **Aircraft dimensions from built-in database** -- selecting an aircraft type automatically sets the correct wingspan, length, and height for scale rendering
- **Drag-and-drop placement** -- position aircraft by dragging them on the map; they rescale automatically as you zoom and rotate
- **Grouped aircraft list** in the floating panel, with bulk add (1 to 50 aircraft at once)
- **Right-click context menu** on any aircraft: Edit Details (tail number, call sign, notes), Duplicate, Remove
- **Floating panel overlay** with four tabs: Aircraft (placed aircraft list), Environment (apron settings), Clearance (violation checks), and Settings (display options)
- **UFC 3-260-01 wingtip clearance calculations** with ADG (Airplane Design Group) classification -- the system knows the required clearance distances and flags violations in red
- **Obstacle tracking** with independent lock toggle -- mark fixed obstacles (light poles, hydrants, buildings) on the map; lock them so they cannot be accidentally moved
- **Taxilane definitions** with clearance envelopes showing the required clear zone for aircraft movement
- **Environment settings** -- apron context (transient, alert, cargo, etc.) drives which clearance requirements apply
- **PDF export** with map capture at 1600x900 resolution, aircraft legend, and clearance summary
- **Email delivery** for sharing parking plans with operations and visiting units
- **Fullscreen mode** (spacebar toggle) for maximum map area during planning sessions
- **Ruler tool** for measuring distances on the map

### How to Use

1. Navigate to **Parking Plans** from the sidebar.
2. To start a new plan, tap **New Plan** and give it a name (e.g., "Red Flag 26-2 Parking Plan").
3. To add aircraft, open the **Aircraft tab** in the floating panel. Select the aircraft type from the database, enter the quantity (1-50), and tap **Add**. Aircraft appear on the map at a default position.
4. **Drag each aircraft** to its parking spot. The silhouette is to-scale -- what you see on the satellite imagery is the actual footprint.
5. To edit an aircraft's details, **right-click** (or long-press on mobile) to open the context menu. Select **Edit Details** to set the tail number, call sign, or notes. Select **Duplicate** to create a copy, or **Remove** to delete it.
6. To mark obstacles, switch to the **Environment tab** and tap **Add Obstacle**. Click the map to place the obstacle, then set its type and dimensions. Toggle the **Lock** icon to prevent accidental movement.
7. To define taxilanes, use the **Settings tab** to add taxilane paths. Clearance envelopes are drawn automatically based on the ADG of the largest aircraft using the taxilane.
8. To check clearances, open the **Clearance tab**. Any wingtip-to-wingtip or wingtip-to-obstacle violations are highlighted in red with the UFC reference and required distance.
9. To export, tap **Export PDF**. The system captures a high-resolution map screenshot, generates the PDF with legend and clearance summary, and provides download and email options.

> **Best Practices**
>
> - Always set the correct apron environment before checking clearances -- transient ramps have different requirements than alert pads.
> - Use bulk add for large exercises (e.g., 24x F-16s) and then drag each to its assigned spot. It is much faster than adding them one at a time.
> - Lock obstacles immediately after placing them. During a busy planning session, it is easy to accidentally drag a light pole.
> - Use fullscreen mode (spacebar) when fine-tuning aircraft positions -- the extra screen real estate makes a significant difference.
> - Export the parking plan PDF and email it to visiting units at least 48 hours before arrival so they can brief their pilots on assigned parking spots.
> - Save parking plans for recurring exercises. You can reopen and adjust them rather than starting from scratch each time.

---

## 11. Obstruction Evaluations

The Obstruction Evaluations module performs UFC 3-260-01 Chapter 3 imaginary surface analysis to determine whether objects near the airfield penetrate protected airspace. It evaluates against all configured runways simultaneously and supports taxiway clearance envelope analysis per FAA and UFC standards.

![Obstruction evaluation map showing an obstruction point with imaginary surface overlays](screenshots/S01%20(45).png)

![Evaluation results showing surface-by-surface analysis with pass/fail indicators and UFC references](screenshots/S01%20(46).png)

![Taxiway clearance envelope showing OFA and Safety Area polygons on the map](screenshots/S01%20(47).png)

![Obstruction history map showing all previously evaluated obstructions with status markers](screenshots/S01%20(48).png)

### Key Features

- **UFC 3-260-01 Chapter 3 imaginary surface analysis** covering 10 surfaces: Primary Surface, Approach-Departure Surface, Transitional Surface, Inner Horizontal, Outer Horizontal, Conical Surface, Clear Zone, Graded Area, APZ I, and APZ II
- **Multi-runway evaluation** -- checks the obstruction against ALL base runways simultaneously, not just the nearest one
- **Taxiway clearance envelopes** -- FAA TDG-based Object Free Area (OFA) and Safety Area, plus UFC Class A and Class B Clearance Lines
- **Interactive map placement** -- click the map or use your device's GPS to set the obstruction point
- **Google Elevation API integration** for automatic ground elevation lookup (via server-side proxy for API key security)
- **Geodesic calculations** using Haversine formula, cross-track distance, and along-track distance for precise surface intersection analysis
- **Multiple photos** per evaluation for evidence documentation
- **Violation detection** with specific UFC references citing the violated paragraph and required clearance
- **Fullscreen map** with toolbar for zoom, GPS, and layer controls
- **History map** showing all previously evaluated obstructions with color-coded status markers

### How to Use

1. Navigate to **Obstructions** from the sidebar or bottom nav.
2. Tap **New Evaluation** to begin.
3. Set the obstruction location by either:
   - Tapping the map at the obstruction's position, or
   - Tapping the **GPS** button to use your current device location
4. Enter the obstruction details: type (crane, building, tree, antenna, etc.), height above ground level, and description.
5. The system automatically fetches the ground elevation using the Google Elevation API.
6. Tap **Evaluate**. The system runs the obstruction point against all 10 imaginary surfaces for every runway at your base.
7. Review the **results panel** showing each surface with a Pass (green) or Fail (red) indicator. For any violations, the specific UFC reference and required clearance are displayed.
8. Take or upload **photos** of the obstruction.
9. Tap **Save** to record the evaluation. It appears in the history for future reference.
10. To review past evaluations, tap the **History** tab. The history map shows all evaluated obstructions with color-coded markers.
11. To view taxiway clearance envelopes, select a taxiway from the dropdown. The OFA and Safety Area polygons are drawn on the map.

> **Best Practices**
>
> - Evaluate every temporary obstruction (cranes, construction equipment, antenna masts) BEFORE it is erected. This is a regulatory requirement.
> - Always take photos from multiple angles -- they serve as evidence in the waiver package if the obstruction violates a surface.
> - Use the GPS feature when you are standing at the obstruction site for the most accurate positioning.
> - Review the history map periodically to ensure all documented obstructions are still current. Remove evaluations for obstructions that have been removed.
> - When an evaluation shows a violation, immediately create a discrepancy and initiate the waiver process (AF Form 505) using the Waivers module.

---

## 12. Quick Reaction Checklists

Quick Reaction Checklists (QRCs) digitize the emergency response procedures that Airfield Management executes during aircraft emergencies, weather events, and other contingencies. Glidepath provides 25 QRC templates with six distinct step types, Secondary Crash Net (SCN) integration, and full activity logging.

![QRC Available tab showing the list of emergency checklists ready to execute](screenshots/S01%20(49).png)

![QRC execution view showing checklist steps with checkboxes, time fields, and notification tracking](screenshots/S01%20(50).png)

![QRC History tab showing completed and cancelled QRCs with timestamps and execution details](screenshots/S01%20(51).png)

### Key Features

- **25 digitized QRCs** covering airfield emergencies (IFE, ground emergency, barrier engagement, weather, NOTAM-related actions, etc.)
- **Six step types**:
  1. **Checkbox** -- simple check-off task
  2. **Checkbox + Note** -- check-off with a required or optional text note
  3. **Agency Notification** -- notified agency (SOF, Fire Chief, Command Post, etc.) with timestamp
  4. **Fill-in** -- freeform text entry for variable information
  5. **Time field ("Now Z")** -- one-tap Zulu time capture for critical event times
  6. **Conditional cross-reference** -- links to another QRC when a condition is met
- **SCN (Secondary Crash Net) form** for applicable QRCs -- activating SCN logs "SECONDARY CRASH NET ACTIVATED" in the Events Log
- **Lifecycle management**: Open a QRC, execute steps, then Close (with initials and Zulu timestamp) or Cancel
- **Dashboard integration** -- active QRC count shows on the Dashboard KPI badge; quick-launch dialog lets you start or resume without navigating away
- **Template management** in Base Configuration (admin) -- customize which QRCs are available and edit step content
- **Activity logging** -- every QRC open, close, and cancel is recorded in the Events Log

### How to Use

1. Navigate to **QRC** from the sidebar, or use the **Quick Launch** button on the Dashboard.
2. On the **Available** tab, find the QRC you need. QRCs are listed by name with a brief description.
3. Tap the QRC to **open** it. The execution view shows all steps in order.
4. Work through each step:
   - For **checkboxes**, tap to mark complete.
   - For **agency notifications**, tap to record the notification. The system captures the Zulu time automatically.
   - For **time fields**, tap "Now Z" to record the current Zulu time, or manually enter a time.
   - For **fill-ins**, enter the required information (aircraft call sign, runway, etc.).
   - For **conditional cross-references**, evaluate the condition and tap to open the referenced QRC if applicable.
5. If the QRC requires **SCN activation**, the SCN form appears. Complete it to activate the Secondary Crash Net.
6. When all steps are complete, tap **Close QRC**. Enter your operating initials and confirm. The Zulu timestamp is recorded.
7. To cancel a QRC (e.g., false alarm), tap **Cancel QRC**. This deletes associated activity log entries.
8. Review past QRCs on the **History** tab, which shows execution times, who ran them, and all recorded step data.

> **Best Practices**
>
> - Practice QRC execution during training exercises so your team is familiar with the digital workflow before a real emergency.
> - Use the Dashboard quick-launch during actual emergencies -- it is the fastest path to opening a QRC.
> - Always use "Now Z" for time-critical steps rather than typing the time manually. One tap is faster and eliminates transcription errors.
> - Close QRCs promptly after the event concludes. Open QRCs show on every user's Dashboard badge and may cause confusion if left open.
> - Review QRC history monthly to identify patterns (e.g., frequent IFEs from a specific aircraft type) and brief them to leadership.

---

## 13. Shift Checklist

The Shift Checklist module tracks the recurring tasks that Airfield Management must complete each shift. Items are configurable per base, support daily/weekly/monthly frequencies, and are organized by shift (Day, Mid, Swing). The timezone-aware system ensures checklists reset at the correct local time.

![Shift Checklist Today tab showing progress bar, per-item check-off with notes, and file button](screenshots/S01%20(52).png)

![Shift Checklist History tab showing previously completed checklists with dates and completion status](screenshots/S01%20(53).png)

### Key Features

- **Per-shift task tracking** for Day, Mid, and Swing shifts
- **Configurable checklist items** per base -- admins define which tasks appear and their frequency (daily, weekly, or monthly)
- **Timezone-aware date calculation** using the installation's timezone and configurable reset time (default 0600 Local)
- **Today tab** with progress bar showing percentage complete, individual item check-off with optional notes, and a File button to finalize the shift
- **History tab** showing previously completed checklists, clickable to review details
- **Dashboard integration** -- the KPI badge shows checklist completion status; the quick-access dialog lets you mark items without leaving the Dashboard
- **Reopen filed checklists** if an item was missed or needs correction

### How to Use

1. Navigate to **Shift Checklist** from the sidebar, or tap the Checklist badge on the Dashboard.
2. The **Today** tab shows your current shift's checklist. Items are listed with checkboxes.
3. As you complete each task, tap the checkbox. Optionally add a note (e.g., "Completed at 1430Z, no issues found").
4. The progress bar at the top updates in real time as you check off items.
5. When all items are complete (or all applicable items -- some may be weekly/monthly and not due today), tap **File Checklist**.
6. To review a past checklist, tap the **History** tab and select the date. The detail view shows which items were completed, by whom, and any notes.
7. If you need to correct a filed checklist, open it from History and tap **Reopen**. Make your corrections and re-file.

> **Best Practices**
>
> - File the shift checklist before turnover so the incoming shift can see that all tasks were completed.
> - Use notes for items that had exceptions or required follow-up (e.g., "AWOS called -- reported intermittent, submitted work order #1234").
> - Review the History tab during shift turnovers to verify the previous shift completed all items.
> - Admins should review and update checklist items quarterly to ensure they reflect current requirements and directives.

---

## 14. Wildlife/BASH

The Wildlife/BASH (Bird/Wildlife Aircraft Strike Hazard) module captures wildlife sightings and strikes, visualizes activity patterns with a heatmap, and integrates weather data to support BASH mitigation decisions. It is designed to comply with DAFMAN 91-212 wildlife reporting requirements.

![Wildlife sighting form with species picker, count, GPS location, behavior, and dispersal method fields](screenshots/S01%20(54).png)

![Wildlife strike form with species, count, damage assessment, aircraft info, and phase of flight fields](screenshots/S01%20(55).png)

![Wildlife activity log with All/Sightings/Strikes filter tabs showing recent entries](screenshots/S01%20(56).png)

![Heatmap visualization showing wildlife activity density on satellite map with green-to-red gradient](screenshots/S01%20(57).png)

### Key Features

- **Sighting form**: species picker with favorites, count, GPS location, behavior observed, dispersal method used, weather conditions
- **Strike form**: species, count, damage assessment (none/minor/substantial/destroyed), aircraft type and tail number, phase of flight, engine ingestion details
- **Species picker with favorites** -- mark frequently seen species with a star; favorites sort to the top with a gold border
- **Activity log** with filter tabs: All, Sightings, Strikes
- **Heatmap visualization** -- density map on satellite imagery showing where wildlife activity concentrates (green = low, red = high)
- **Weather auto-fill** from Open-Meteo -- temperature, wind, visibility, and sky conditions populate automatically when opening a sighting or strike form
- **BWC history tracking** with source labels (manual update vs. inspection vs. check)
- **GPS location** with map pin for precise sighting/strike positioning

### How to Use

1. Navigate to **Wildlife/BASH** from the sidebar.
2. To log a sighting, tap **New Sighting**.
   - Select the species from the picker. Tap the star icon next to frequently seen species to mark them as favorites.
   - Enter the count, behavior (feeding, loafing, flying, roosting), and dispersal method (pyrotechnics, vehicle, none, etc.).
   - The weather fields auto-populate. Verify they are correct and adjust if needed.
   - Tap the map to set the GPS location where the wildlife was observed.
   - Tap **Submit**.
3. To log a strike, tap **New Strike** and fill in the species, count, aircraft information, damage assessment, phase of flight, and other details. Submit when complete.
4. To review the activity log, scroll down or tap the **Activity Log** tab. Use the filter chips (All / Sightings / Strikes) to narrow the view.
5. To view the heatmap, tap the **Heatmap** tab. The satellite map displays a color gradient showing wildlife activity density. Green indicates low activity; red indicates high concentrations.

> **Best Practices**
>
> - Log every wildlife sighting, not just strikes. Sighting data drives the heatmap and helps predict future strike risk.
> - Use favorites for species you see regularly (e.g., barn swallows, red-tailed hawks at your base). It significantly speeds up the species selection.
> - Review the heatmap before recommending BWC level changes. Clusters of activity near runway ends or approach corridors warrant elevated BWC.
> - Ensure accurate GPS pins -- the heatmap is only useful if locations are precise.
> - Share heatmap screenshots in weekly BASH briefings to leadership. The visual is more impactful than a table of numbers.

---

## 15. Waivers

The Waivers module manages the AF Form 505 lifecycle for airfield waivers and exemptions. It supports six classification types, tracks coordination across offices, handles annual reviews, and provides map visualization of all active waivers.

![Waiver list view showing waivers with classification badges, status, and expiration dates](screenshots/S01%20(58).png)

![Waiver detail page showing criteria, standards references, coordination history, and photos](screenshots/S01%20(59).png)

![Waiver map view showing emoji markers by classification type with clickable filter legend](screenshots/S01%20(60).png)

![Annual review dashboard showing year-by-year review forms with KPIs and completion tracking](screenshots/S01%20(61).png)

### Key Features

- **Six classification types**: Permanent, Temporary, Construction, Event, Extension, and Amendment
- **Seven status values** with mandatory comment dialogs for every transition (Draft, Submitted, Under Review, Approved, Denied, Expired, Cancelled)
- **Criteria and standards references** -- link each waiver to the specific UFC/DAFMAN paragraph it addresses
- **Coordination tracking by office** -- record which offices (Safety, CE, ATC, Ops, Legal) have reviewed and their disposition
- **Photo attachments** with camera capture for documenting the waived condition
- **Annual review mode** with year-by-year forms and KPIs (due, completed, overdue)
- **Map view** with emoji markers color-coded by classification type and a clickable filter legend
- **Location picker** on create and edit forms for precise map placement
- **PDF export** with embedded photos and full waiver details
- **Excel export** for the complete waiver register

### How to Use

1. Navigate to **Waivers** from the sidebar.
2. To create a new waiver, tap **New Waiver** and fill in:
   - **Classification** (Permanent, Temporary, etc.)
   - **Title** and description of the condition requiring a waiver
   - **Criteria/Standards** -- the specific UFC or DAFMAN reference being waived
   - **Location** -- tap the map to set the waiver's position
   - **Expiration date** (for temporary, construction, and event waivers)
   - **Photos** documenting the condition
3. Tap **Submit**. The waiver enters the coordination workflow.
4. Track coordination by updating each office's review status as responses come in.
5. To update a waiver's status, open it and tap **Update Status**. A comment dialog requires you to explain the transition (e.g., "Approved by installation commander on 15 Mar 26").
6. To view all waivers on a map, tap the **Map** tab. Markers are color-coded by classification. Tap any marker to view the waiver details. Use the filter legend to show/hide specific types.
7. For annual reviews, tap the **Annual Review** tab. The dashboard shows which waivers are due for review this year. Complete the review form for each one.
8. To export, use **Export PDF** for individual waivers or **Export Excel** for the complete register.

> **Best Practices**
>
> - Start the waiver process as soon as an obstruction evaluation reveals a violation. Do not wait for the construction to be completed.
> - Set calendar reminders for waiver expirations. Glidepath shows expiration dates, but proactive follow-up ensures renewals are submitted on time.
> - Complete annual reviews promptly -- the annual review dashboard provides a clear picture of what is due.
> - Use the map view in staff meetings to show leadership the spatial distribution of active waivers.
> - Attach photos taken during the initial evaluation AND during annual reviews to document any changes in the waived condition.

---

## 16. NOTAMs

The NOTAMs module provides live FAA NOTAM data for your installation and any other airport by ICAO identifier. It includes expiration alerts, filtering, and local NOTAM drafting capabilities.

![NOTAM list showing active notices with filter chips for FAA/Local/Active/Expired](screenshots/S01%20(62).png)

![NOTAM detail view showing full text, effective dates, and linked discrepancies](screenshots/S01%20(63).png)

### Key Features

- **Live FAA feed** from notams.aim.faa.gov -- no API key required
- **Auto-fetches** NOTAMs for your current installation's ICAO identifier on page load
- **ICAO search** for any airport worldwide
- **Filter chips**: All, FAA, Local, Active, Expired
- **Expiring NOTAM alerts**: sidebar badge and red card highlight for NOTAMs expiring within 24 hours (checked every 5 minutes)
- **Local NOTAM drafting** -- create internal NOTAM entries for base-specific notices that do not go through FAA
- **Link to discrepancies** -- associate NOTAMs with related discrepancies for cross-reference

### How to Use

1. Navigate to **NOTAMs** from the sidebar.
2. The page automatically loads all current NOTAMs for your installation's ICAO identifier.
3. Use the **filter chips** to narrow the list: tap **Active** to see only current NOTAMs, **Expired** to review past ones, or **FAA** / **Local** to filter by source.
4. Tap any NOTAM to view the full text, effective/expiration dates, and any linked discrepancies.
5. To search NOTAMs for another airport, enter its ICAO identifier in the search bar and tap Search.
6. To create a local NOTAM, tap **New Local NOTAM** and enter the title, text, effective and expiration dates. This appears in the list alongside FAA NOTAMs with a "Local" badge.
7. Watch for the **expiring badge** on the sidebar -- it indicates NOTAMs expiring within 24 hours that may need renewal or follow-up action.

> **Best Practices**
>
> - Check the NOTAM page at the start of every shift. Expiring NOTAMs may need renewal action, and new NOTAMs may affect operations.
> - Use Local NOTAMs for base-specific notices that do not warrant an official FAA NOTAM (e.g., "TWY C closed for mowing 1200-1400Z").
> - Link NOTAMs to their corresponding discrepancies so the full context is available in both modules.
> - When a NOTAM expires and the underlying condition persists, immediately initiate renewal or create a new NOTAM. The 24-hour alert gives you advance warning.

---

## 17. Reports & Analytics

The Reports and Analytics module provides five report types and a configurable analytics dashboard. Every report can be exported as a PDF and emailed directly from the app. The analytics dashboard provides trend data across configurable time frames.

![Reports hub showing the five available report types with descriptions](screenshots/S01%20(64).png)

![Analytics dashboard with 9 KPI cards showing trends for inspections, checks, discrepancies, and more](screenshots/S01%20(65).png)

![Daily Operations Summary PDF preview showing all airfield activity for the selected date](screenshots/S01%20(66).png)

![Discrepancy report builder with five filter options, live preview, and Export All Open button](screenshots/S01%20(67).png)

### Key Features

- **Five report types**:
  1. **Daily Operations Summary** -- comprehensive report of all airfield activity for a selected date or date range, including status changes, inspections, checks, discrepancies, QRCs, contractor activity, and NAVAID outage events
  2. **Discrepancy Report** -- filter-based builder with 5 filters (status, type, shop, severity, date range), live preview, and "Export All Open" one-click shortcut
  3. **Discrepancy Trends** -- bar chart showing discrepancies opened vs. closed over selectable time frames (30 days, 90 days, 6 months, 1 year)
  4. **Aging Discrepancies** -- groups open discrepancies by age tiers (0-30, 31-60, 61-90, 90+ days) with clickable filters to drill into each tier
  5. **Airfield Lighting Report** -- system health table showing each lighting system's status with expandable component-level detail
- **Analytics Dashboard** with 9 KPI cards covering inspections (split by type), checks, discrepancies, QRC, personnel, obstructions, parking plans, and wildlife activity
- **Configurable time frame** for analytics: 7 days, 30 days, 90 days, 6 months, 1 year
- **Average completion time** metrics for inspections (created to filed) and checks (started to completed), filtering out entries under 1 minute to exclude test data
- **PDF export** for every report type
- **Email delivery** -- send any report PDF directly to recipients

### How to Use

1. Navigate to **Reports** from the sidebar.
2. Select the report type from the hub.
3. For the **Daily Operations Summary**:
   - Select the date (or date range) using the date picker.
   - Tap **Generate**. The report compiles all activity for that period.
   - Review the preview, then **Export PDF** or **Email PDF**.
4. For the **Discrepancy Report**:
   - Set your filters: status, type, CE shop, severity, and/or date range.
   - The live preview updates as you adjust filters.
   - To quickly export all open discrepancies, tap **Export All Open**.
   - Tap **Export PDF** to generate with your current filter settings.
5. For **Discrepancy Trends**:
   - Select the time frame (30d, 90d, 6mo, 1yr).
   - Review the bar chart showing opened vs. closed discrepancies over time.
6. For **Aging Discrepancies**:
   - View the summary showing counts by age tier.
   - Tap any tier to see the specific discrepancies in that age group.
7. For the **Airfield Lighting Report**:
   - The system health table loads automatically.
   - Expand any system to see component-level detail.
8. For the **Analytics Dashboard**:
   - Select the time frame from the dropdown (7d, 30d, 90d, 6mo, 1yr).
   - Review the 9 KPI cards. Each shows the count, trend direction, and average completion time where applicable.

> **Best Practices**
>
> - Generate the Daily Operations Summary at the end of each day and email it to the distribution list. This is your official record of airfield activity.
> - Use the Aging Discrepancies report in weekly staff meetings. Discrepancies older than 90 days should be escalated or re-evaluated.
> - Save Discrepancy Report filter templates for recurring briefings (e.g., "CE Weekly Brief" filtered to CES-assigned items).
> - Review the Analytics Dashboard monthly to identify trends. A rising discrepancy count with a flat closure rate indicates a maintenance backlog.
> - The Lighting Report is essential before and after lighting inspections -- use it to verify that the infrastructure map matches reality.

---

## 18. Events Log

The Events Log is Glidepath's comprehensive audit trail. Every action taken in the system -- inspections filed, checks completed, discrepancies created, QRCs executed, status changes -- is recorded here with Zulu timestamps and the user's operating initials.

![Events Log showing columnar table grouped by date with Time Z, Action, Details, and OI columns](screenshots/S01%20(68).png)

![Manual entry template picker showing predefined templates for common log entries](screenshots/S01%20(69).png)

### Key Features

- **Full audit trail** with date-range filtering for any period
- **Columnar table layout**: Time (Zulu), Action, Details, Operating Initials -- grouped by date
- **Per-column search filters** to find specific entries quickly
- **Operating initials column** with click-to-reveal popover showing the user's full name, role, and EDIPI
- **Manual text entry** with activity templates for common entries (e.g., "Contacted RAPCON," "Coordinated with CE," "Shift turnover briefing")
- **Edit and delete** entries via modal with Zulu time editing for corrections
- **Clickable items** -- tap any auto-generated entry to navigate to the source entity (inspection, check, discrepancy, etc.)
- **Excel export** with styled formatting for offline review and archival
- **All timestamps in Zulu (UTC)** for consistency across time zones

### How to Use

1. Navigate to **Events Log** from the sidebar or bottom nav (Events Log tab on mobile).
2. The log displays today's entries by default. Use the **date range picker** to view a different period.
3. Use the **column search filters** to find specific entries (e.g., search "QRC" in the Action column, or a specific user's initials in the OI column).
4. To add a manual entry, tap **New Entry**. Select a template or choose freeform. Enter the action description and details. The current Zulu time is pre-filled but can be adjusted.
5. To view who performed an action, tap the **operating initials** in the OI column. A popover shows the full name, role, and EDIPI.
6. To navigate to the source of an auto-generated entry, tap the entry row. If it was generated by filing an inspection, you will be taken to that inspection's detail page.
7. To edit or delete an entry, tap the entry and select **Edit** or **Delete** from the modal. Editing allows you to correct the Zulu time, action, or details.
8. To export the log, tap **Export Excel**. The Excel file includes styled formatting with date grouping and column headers.

> **Best Practices**
>
> - Use the Events Log as your official duty log. Manual entries supplement auto-generated entries to create a complete record of the shift.
> - Use templates for common manual entries to ensure consistent formatting.
> - Export the Events Log at the end of each month for archival. The Excel file is suitable for long-term records management.
> - During incidents or exercises, add manual entries in real time to document coordination actions, phone calls, and decisions that are not captured automatically.
> - Review the Events Log during shift turnover to brief the incoming shift on what happened.

---

## 19. Aircraft Database

The Aircraft Database is a built-in reference library of over 200 military and civilian aircraft types with detailed specifications. It serves as the source data for parking plan aircraft dimensions and pavement loading analysis.

![Aircraft Database showing searchable list with type, dimensions, and weight information](screenshots/S01%20(70).png)

### Key Features

- **200+ aircraft entries** covering military (USAF, USN, USMC, USA) and civilian aircraft
- **Search** by name, type designator, manufacturer, or branch of service
- **Sort** by weight, wingspan, ACN values, or name
- **Favorites system** for quick access to frequently used aircraft types
- **ACN/PCN comparison panel** -- enter your airfield's PCN and see which aircraft types can operate on your pavement without restrictions
- **Detailed specifications**: wingspan, length, height, maximum takeoff weight, gear configuration (single, dual, dual-tandem), tire contact pressure, footprint width, and ACN values for different subgrade strengths

### How to Use

1. Navigate to **Aircraft Database** from the sidebar (under the More menu on mobile).
2. Use the **search bar** to find an aircraft by name (e.g., "C-17"), type designator (e.g., "F-16C"), or manufacturer (e.g., "Boeing").
3. Tap an aircraft to view its full specifications.
4. To mark an aircraft as a favorite, tap the **star icon**. Favorites appear at the top of the list.
5. To compare aircraft against your pavement, open the **ACN/PCN panel** and enter your airfield's PCN rating. The system highlights aircraft that exceed the pavement capacity.
6. Sort the list by any column header (weight, wingspan, etc.) to find the largest or heaviest aircraft types.

> **Best Practices**
>
> - Favorite the aircraft types that regularly operate at your base. They will always be at the top of the list and pre-selected in the Parking Plans module.
> - Use the ACN/PCN comparison before approving heavy aircraft operations. If the ACN exceeds your PCN, coordinate with CE for a pavement analysis.
> - Reference the gear configuration and footprint width when evaluating taxiway clearance requirements.

---

## 20. Regulations Library

The Regulations Library provides in-app access to the key regulations governing airfield management: DAFMAN 13-204 Volumes 1-3 and UFC 3-260-01. It includes full-text search, offline caching, and a personal documents section for uploading your own references.

![Regulations Library showing categorized list of regulation entries with search and filter options](screenshots/S01%20(71).png)

### Key Features

- **70 regulation entries** from DAFMAN 13-204 Volumes 1-3 and UFC 3-260-01
- **Full-text search** across all entries by title, paragraph number, or keyword
- **Category and publication type filters** to narrow results
- **Favorites** for quick access to frequently referenced sections
- **In-app PDF viewer** with pinch-to-zoom for reading on mobile devices
- **Offline caching** via IndexedDB with a "Cache All" button to bulk-download all PDFs for offline use
- **My Documents tab** -- upload personal PDFs, JPGs, or PNGs with client-side text extraction for search indexing
- **Admin controls** for adding or deleting reference entries with PDF upload

### How to Use

1. Navigate to **Regulations** from the sidebar (under the More menu on mobile).
2. Browse the **References** tab or use the search bar to find a specific regulation (e.g., "Table A3.1" or "imaginary surfaces").
3. Use filter chips to narrow by category (Airfield Management, Civil Engineering, Safety) or publication (DAFMAN 13-204v1, UFC 3-260-01, etc.).
4. Tap any entry to open the PDF viewer. Use pinch-to-zoom on mobile or scroll on desktop.
5. To favorite a regulation, tap the star icon. Favorites appear at the top of the list.
6. To cache all regulations for offline access, tap **Cache All**. This downloads every PDF to your device's local storage.
7. To upload a personal document, switch to the **My Documents** tab and tap **Upload**. Select a PDF, JPG, or PNG file. The system extracts text for search indexing.
8. Admins can add new regulation entries or delete outdated ones using the admin controls.

> **Best Practices**
>
> - Cache all regulations on your duty devices before deploying to locations with limited connectivity.
> - Use the Regulations Library during inspections and evaluations to quickly reference the specific paragraph when documenting a deficiency.
> - Upload base-specific supplements, operating instructions, and local procedures to the My Documents tab so your entire team has access.
> - Favorite the sections you reference most often (e.g., DAFMAN 13-204v2 Table A3.1 for lighting outage thresholds, UFC 3-260-01 Ch. 3 for imaginary surfaces).

---

## 21. Personnel on Airfield

The Personnel on Airfield module tracks contractors and other non-organic personnel operating on the airfield. It integrates with the Airfield Status page for real-time visibility.

![Personnel on Airfield showing active contractors with company, location, and work details](screenshots/S01%20(72).png)

### Key Features

- **Add contractor entries** with company name, location (specific area of the airfield), work description, and callsign
- **Status tracking**: Active (currently working) or Completed (finished for the day)
- **Time logging** -- timestamps for when contractors arrive and depart
- **Dashboard integration** -- contractors also appear inline on the Airfield Status page for real-time situational awareness

### How to Use

1. Navigate to **Personnel on Airfield** from the sidebar, or scroll to the Contractors section on the Airfield Status page.
2. Tap **Add Contractor** to log new personnel on the airfield.
3. Enter the **company name** (e.g., "ABC Construction"), **number of personnel**, **location** (e.g., "TWY C between T1 and T2"), **work description** (e.g., "Pavement repair"), and **radio callsign** if applicable.
4. The entry appears as Active immediately and is visible to all users on the Airfield Status page.
5. When the contractor completes work for the day, update the status to **Completed**. The departure time is logged.
6. Review the list at the end of each shift to verify all contractors have departed or are properly documented.

> **Best Practices**
>
> - Log contractors immediately upon their arrival at the airfield. The Airfield Status page is the first thing controllers and supervisors check.
> - Include specific locations (not just "on the airfield") so other operators know which areas may have construction equipment or personnel.
> - Always update the status to Completed when contractors depart. Stale "Active" entries reduce trust in the system.
> - Use callsigns when contractors have radio communication so tower and ground control can coordinate.

---

## 22. Settings & Base Configuration

The Settings module provides personal preferences, data management, and appearance controls. Base Configuration is the admin-only section where installation-specific settings -- runways, NAVAIDs, areas, CE shops, templates, and more -- are defined.

![Settings page showing profile information, default PDF email, appearance toggle, and about section](screenshots/S01%20(73).png)

![Base Setup Runways tab showing runway definitions with headings, lengths, and surface types](screenshots/S01%20(74).png)

![Base Setup CE Shops tab showing type-to-shop mapping configuration](screenshots/S01%20(75).png)

![Inspection Templates page showing customizable airfield and lighting inspection sections and items](screenshots/S01%20(76).png)

### Key Features

- **Profile section**: read-only display of your name, rank, role, and email; editable default PDF email address and operating initials (max 4 characters)
- **Installation section**: displays your current base; sys_admin users can switch installations
- **Data & Storage**: view cached data size, clear localStorage and IndexedDB caches
- **Appearance**: Day (light theme), Night (dark theme), or Auto (follows device setting)
- **About**: current version number, environment information
- **Base Configuration** (admin only) with tabs:
  - **General** -- base name, ICAO code, timezone, checklist reset time
  - **Runways** -- define runway identifiers, headings, lengths, widths, surface types, and threshold coordinates
  - **NAVAIDs** -- configure which NAVAID systems exist at each runway end
  - **Areas** -- define airfield areas (aprons, taxiways, hangars) for location dropdowns
  - **CE Shops** -- define CE shop names and configure the type-to-shop mapping (which discrepancy types route to which shops)
  - **QRC Templates** -- customize available Quick Reaction Checklists and their step content
  - **Shift Checklist Items** -- define tasks, frequencies, and shift assignments
  - **Lighting Systems** -- configure system types for the infrastructure map
  - **Taxiways** -- define taxiway identifiers and dimensions for clearance calculations
  - **Airfield Diagram** -- upload or update the airfield diagram image
- **Inspection Templates** -- customize the sections and items for airfield, lighting, construction meeting, and joint monthly inspections

### How to Use

1. Navigate to **Settings** from the sidebar or More menu.
2. To set your **default PDF email**, tap the email field in the Profile section, enter the address, and save. This email pre-fills whenever you use Email PDF throughout the app.
3. To set your **operating initials**, enter up to 4 characters (e.g., "JSM"). These appear in the Events Log and on QRC closures.
4. To change the **theme**, tap Day, Night, or Auto in the Appearance section.
5. To clear cached data, go to **Data & Storage** and tap **Clear Cache**. This removes locally stored drafts and offline regulation PDFs.
6. For **Base Configuration** (admin only):
   - Navigate to **Base Setup** from the sidebar.
   - Use the tabs to configure each aspect of your installation.
   - For **Runways**: tap **Add Runway** and enter the identifier (e.g., "18/36"), headings, length, width, surface type, and threshold GPS coordinates.
   - For **CE Shops**: add shop names, then configure which discrepancy types route to which shop. This mapping auto-assigns the shop when users create discrepancies.
   - For **Inspection Templates**: select the inspection type, then add, edit, reorder, or remove sections and items. Changes take effect for all future inspections.

> **Best Practices**
>
> - Set your default PDF email to your official distribution email so reports are always sent to the right place with one tap.
> - Configure the type-to-shop mapping during initial base setup. Accurate mapping ensures discrepancies automatically route to the correct CE shop, eliminating manual triage.
> - Review and update inspection templates annually after ACSI findings or directive changes.
> - Set the checklist reset time to match your base's shift schedule (e.g., 0600L for a 0600-1800 day shift).
> - Keep runway threshold coordinates accurate -- they drive the imaginary surface calculations in the Obstruction Evaluations module.

---

## 23. User Management

User Management is the admin-only module for creating, editing, and managing Glidepath user accounts. It provides role-based access control, invitation workflows, and account lifecycle management.

![User Management showing searchable user list with role badges, status indicators, and action buttons](screenshots/S01%20(77).png)

### Key Features

- **Searchable user list** with role and status filters
- **User cards** displaying rank, role badge, status badge (Active/Inactive), base assignment, and last seen timestamp
- **Invite user** -- enter email, rank, first/last name, role, and installation assignment. The system sends a branded setup email with a temporary password.
- **Role selection on invite** -- NAMOs, AFMs, and base admins can now assign roles when inviting users (non-admin roles only). Sys admins can assign any role including admin roles.
- **Self-registration with approval** -- users can create their own account via the login page. New accounts start with "Pending" status and cannot log in until an admin approves them. Admins see a yellow "Pending Approval" banner with Approve/Reject buttons in the user detail modal.
- **Edit profiles** -- admins can update rank, name, role, installation assignment, and operating initials. Base admins can now change user roles (non-admin roles only).
- **Multi-base access management** -- the user detail modal shows all base assignments with a "Base Access" section. Admins can add users to additional bases or remove non-primary base assignments. Each membership shows the base name, ICAO, and a "PRIMARY" badge on the home base.
- **Password reset** sends a recovery email to the user
- **Deactivate/reactivate** users -- deactivated users cannot log in but their data is preserved
- **Delete accounts** (sys_admin only) -- permanently removes the user account and nullifies all foreign key references across 10 tables
- **Three-tier role hierarchy**:
  - **sys_admin** -- full access to all bases and all features, including user management and installation creation
  - **base_admin / AFM / NAMO** -- full access to their assigned base, including user management, base configuration, and role assignment for non-admin roles
  - **Regular roles** (airfield_manager, inspector, controller, ces, etc.) -- feature access based on role; no admin capabilities
- **Email privacy** -- user emails are masked by default with an eye toggle to reveal in the edit modal

### How to Use

1. Navigate to **User Management** from the sidebar (admin only).
2. Browse the user list or use the **search bar** and **filter dropdowns** (by role, by status) to find specific users.
3. To **invite a new user**:
   - Tap **Invite User**.
   - Enter the user's email, rank, first name, last name, role, and base assignment. NAMOs, AFMs, and base admins can assign any non-admin role; sys admins can assign any role.
   - Tap **Send Invitation**. The user receives a branded email with setup instructions.
4. To **approve a self-registered user**:
   - Users who create accounts via the login page appear with a "Pending" status badge.
   - Tap the pending user card. A yellow "Pending Approval" banner appears with **Approve** and **Reject** buttons.
   - Set the appropriate role, then tap **Approve** to grant access. Tap **Reject** to deactivate the account.
5. To **edit a user's profile**:
   - Tap the user card to open the edit modal.
   - Update any fields as needed (rank, name, role, installation, operating initials).
   - Base admins can now change roles to non-admin roles (amops, ces, safety, atc, read_only, airfield_manager, namo).
   - Tap **Save**.
6. To **manage multi-base access**:
   - In the user detail modal, scroll to the **Base Access** section.
   - View all current base assignments. The user's primary base shows a "PRIMARY" badge.
   - To add access to another base, tap **Add Base** and select from the dropdown.
   - To remove access, tap the **X** button on any non-primary base.
7. To **reset a user's password**, open the user card and tap **Reset Password**. A recovery email is sent to the user.
8. To **deactivate a user**, open the user card and tap **Deactivate**. The user can no longer log in. To reactivate, tap **Reactivate**.
9. To **delete a user** (sys_admin only), open the user card and tap **Delete Account**. Confirm the action. This is permanent and cannot be undone.

> **Best Practices**
>
> - Assign the minimum necessary role. Not everyone needs base_admin access -- use specific roles (inspector, controller, ces) to enforce least privilege.
> - Deactivate users immediately when they PCS or separate. Do not wait for the next admin review cycle.
> - Use the "Last Seen" timestamp to identify inactive accounts. Users not seen in 90+ days should be reviewed for deactivation.
> - When inviting CES users, assign the "ces" role so they see the simplified CES Work Order view instead of the full Airfield Management interface.
> - Never share login credentials. Each user must have their own account for audit trail integrity.

---

## 24. Multi-Base Operations

Glidepath supports multi-base operations for organizations that manage or oversee multiple airfield installations. The installation switcher in the header allows authorized users to move between bases without logging out, and Row-Level Security (RLS) ensures complete data isolation between installations.

![Installation switcher in the header showing available bases with current selection highlighted](screenshots/S01%20(78).png)

### Key Features

- **Installation switcher** in the app header for users assigned to multiple bases
- **Complete data isolation** -- every record (inspections, checks, discrepancies, infrastructure features, etc.) is scoped to the current installation. Row-Level Security (RLS) policies in the database enforce this at the query level.
- **sys_admin access** to all bases -- system administrators can switch to any installation to review data, manage users, or configure settings
- **base_admin / AFM / NAMO** manage their own base only -- they see only their assigned installation's data
- **Multi-base user assignment** -- admins can assign users to multiple bases via the "Base Access" section in User Management. Users with multiple assignments see all their bases in the installation switcher.
- **Regular role users** see only the base(s) they are assigned to
- **Adding new installations**: sys_admin users can create new installations in Settings, configure runways, NAVAIDs, areas, and all base-specific settings
- **No data crossover** -- RLS policies guarantee that a query from Base A never returns Base B's data, even if a user has access to both

### How to Use

1. If you have access to multiple bases, the **installation switcher** appears in the header bar (next to the Glidepath logo).
2. Tap the switcher to see all available installations. Your current base is highlighted.
3. Select a different base. The app reloads all data for the new installation -- dashboard KPIs, airfield status, discrepancies, infrastructure map, and all other modules reflect the selected base.
4. To return to your primary base, use the switcher again.
5. **For sys_admins adding a new installation**:
   - Go to **Settings** and tap **Add Installation**.
   - Enter the base name, ICAO code, timezone, and location.
   - After creation, switch to the new installation and configure all tabs in Base Setup (runways, NAVAIDs, areas, CE shops, etc.).
   - Invite users and assign them to the new installation.

> **Best Practices**
>
> - Always verify your current installation before taking actions. The installation name is displayed prominently in the header, but it is easy to forget which base you switched to.
> - When overseeing multiple bases, use the Analytics Dashboard at each base to compare operational metrics and identify installations that need additional support.
> - Sys_admins should periodically switch to each base to review user accounts, verify configuration accuracy, and check for stale data.
> - Document base-specific configuration decisions (checklist reset time, type-to-shop mapping, NAVAID systems) so they can be replicated when adding new installations.

---

## Appendix: System Requirements

| Requirement | Detail |
|---|---|
| **Browser** | Chrome 90+, Edge 90+, Safari 15+, Firefox 90+ |
| **Devices** | Desktop, tablet, or smartphone (responsive design) |
| **Connectivity** | Internet required for real-time sync; limited offline capability via PWA caching and IndexedDB |
| **Authentication** | Email/password via Supabase Auth |
| **Map Tiles** | Mapbox satellite imagery (token configured per installation) |
| **Weather Data** | Open-Meteo (free, no API key) |
| **Elevation Data** | Google Elevation API (server-side proxy) |
| **NOTAMs** | FAA NOTAM API (notams.aim.faa.gov, no key required) |
| **Email Delivery** | Resend API for PDF email delivery |

---

## Appendix: Role Permissions Summary

| Capability | sys_admin | base_admin / AFM / NAMO | Inspector / Controller | CES |
|---|---|---|---|---|
| All modules | Yes | Yes | Yes | CES Work Orders, Discrepancies, Visual NAVAIDs, Settings only |
| User Management | All bases | Own base | No | No |
| Assign Roles on Invite | All roles | Non-admin roles | No | No |
| Change User Roles | All roles | Non-admin roles | No | No |
| Approve Self-Registrations | Yes | Own base | No | No |
| Multi-Base User Assignment | All bases | Own base | No | No |
| Base Configuration | All bases | Own base | No | No |
| Installation Switcher | All bases | Assigned bases | No | No |
| Create/Edit Discrepancies | Yes | Yes | Yes | View only |
| Edit Filed Checks | Yes | Yes | Original submitter only | No |
| Discrepancy Status Updates | All statuses | All statuses | All statuses | In Work / Project / Work Completed only |
| Delete Users | Yes | No | No | No |
| Create Installations | Yes | No | No | No |

---

*Glidepath v2.27.0 -- Built for the warfighter. Designed for the airfield.*
