# Training Screenshots — Capture Checklist

Drop captured PNGs at `public/training/<module-id>_<n>.png`, then update the
`screenshots: []` array on the matching module in `lib/training/modules.ts` to:

```ts
screenshots: [
  { src: '/training/<module-id>_1.png', caption: '...' },
  { src: '/training/<module-id>_2.png', caption: '...' },
],
```

The subpages already render a framed empty-state placeholder when `screenshots`
is empty, so partial capture is fine — land a batch at a time.

Recommended capture conditions:
- Use the **Demo AFB** seed (`/login?demo=true`) so screenshots have realistic data without exposing real-base info.
- **Day theme** for most shots (better print contrast for the export PDF). Capture Night theme only if the module's identity is dark-mode (none currently are).
- Browser at ~1440 px wide, devtools closed. Crop the sidebar out unless the shot is specifically about navigation.
- Hide any in-progress drafts, dev banners, or "What's New" overlays before capturing.

---

## Operations

### airfield-status (3 shots)
- [x] `airfield-status_1.png` — Full landing view: weather strip, runway selector with status labels, NAVAID grid (mostly green with one yellow), advisory bar. **Caption:** "Airfield Status landing — live weather, runway labels, NAVAID grid, and advisories on one screen."
- [x] `airfield-status_2.png` — NAVAID status dialog open with status picker (green / yellow / red) + notes field visible. **Caption:** "Click any NAVAID to open the status dialog — pick green / yellow / red and add notes for shift handoff context."
- [x] `airfield-status_3.png` — AFM Out-of-Office toggle expanded with custom message field. **Caption:** "AFM Out-of-Office toggle posts a custom away message visible to every shift."

### dashboard (1 shot)
- [x] `dashboard_1.png` — Full KPI strip: inspection cadence, last check, open discrepancies, awaiting verification. **Caption:** "Shift-handoff KPI tiles — inspection state, last check, open discrepancies."

### activity (3 shots)
- [x] `activity_1.png` — Timeline grouped by day (Today / Yesterday / weekday) with relative-anchor headers and entry-count badges. **Caption:** "Day-grouped timeline with relative anchors and per-group entry counts."
- [x] `activity_2.png` — Filter chip cluster (Today / 7d / 30d / Custom) + period chips active + search bar populated. **Caption:** "Period chips and a single search bar narrow the timeline by date or any field."
- [x] `activity_3.png` — New Log Entry section with a template picked (Tower Reporting or AMOPS Reporting). **Caption:** "Manual-entry templates pre-fill the category so report rollups stay clean."

### recent-activity (2 shots)
- [x] `recent-activity_1.png` — Two or three user cards stacked, each showing rank + name header and their actions. **Caption:** "Per-user cards reorganize the same audit data by actor for shift-handoff oversight."
- [x] `recent-activity_2.png` — Period selector set to 7d with entity-type filter active. **Caption:** "Period and entity filters narrow to the prior shift's window or a specific module."

### qrc (3 shots)
- [x] `qrc_1.png` — Available tab tile grid showing several QRCs (one with the review-overdue badge). **Caption:** "25 starter checklists from AFMAN 91-203, with a review-overdue indicator per tile."
- [x] `qrc_2.png` — Active QRC mid-step with a step acknowledged + Zulu timestamp visible. **Caption:** "Each step captures the acknowledger and Zulu timestamp automatically."
- [x] `qrc_3.png` — After-Action PDF preview (or a closed-QRC detail view). **Caption:** "After-Action PDF bundles every step + acknowledgement for the post-event debrief."

### scn (2 shots)
- [x] `scn_1.png` — Daily check log with several agency badges toggled green and a few red/unflipped. **Caption:** "Per-agency badges with auto-stamped time when you toggle them."
- [x] `scn_2.png` — Monthly PDF export preview showing per-day rollup. **Caption:** "Monthly PDF export — your AFMAN evidence package in one click."

### shift-checklist (3 shots)
- [x] `shift-checklist_1.png` — Day tab with mixed toggle states (completed / N/A / unchecked) and progress bar partway. **Caption:** "Three-state toggles per task; progress counts completed and N/A as resolved."
- [x] `shift-checklist_2.png` — Frequency color-coded items visible (Daily cyan, Weekly purple, Monthly amber). **Caption:** "Frequency tags color-code Daily, Weekly, and Monthly items at a glance."
- [x] `shift-checklist_3.png` — History tab with past checklists + closer info. **Caption:** "History tab keeps every past shift checklist with closer name and Zulu time."

### checks (3 shots)
- [x] `checks_1.png` — Check type picker (the seven tiles). **Caption:** "Seven check types — Daily, Lighting, FOD, Weather, Construction, Heavy Aircraft, Other."
- [x] `checks_2.png` — Daily check mid-walk: items being toggled, inline discrepancy capture form open with photo. **Caption:** "Log discrepancies inline as you walk the airfield; photos attach per discrepancy."
- [x] `checks_3.png` — Resume prompt on page load showing existing draft. **Caption:** "Drafts auto-save to Supabase + localStorage so you can resume from any device."

### inspections (2 shots)
- [x] `inspections_1.png` — Launchpad with all four tiles (Daily Airfield, ACSI, Construction, Joint). **Caption:** "Launchpad for every inspection cadence at your base."
- [x] `inspections_2.png` — Daily airfield inspection in progress with item toggles + an issue captured. **Caption:** "Issues log directly to Discrepancies with auto-routing to CES shops."

### acsi (3 shots)
- [x] `acsi_1.png` — Section view: items rendered with Pass / Fail / N/A radio buttons + remarks field. **Caption:** "One section at a time — Pass / Fail / N/A per item with optional remarks and photos."
- [x] `acsi_2.png` — Per-member signature panel with a signature captured. **Caption:** "Per-member signature toggle for full team sign-off on the official record."
- [x] `acsi_3.png` — Continue ACSI Draft tile on the launchpad. **Caption:** "Long-running drafts surface as 'Continue ACSI Draft' so multi-day runs resume cleanly."

### daily-reviews (2 shots)
- [x] `daily-reviews_1.png` — Queue with several day rows, mix of green (certified) + amber (today pending) + quiet (past unsigned) rails. **Caption:** "Per-day rows with colored rails — green when fully certified, amber when your slot is pending."
- [x] `daily-reviews_2.png` — Sign modal open with day's events listed and a slot ready to sign. **Caption:** "Sign modal carries name + rank + Zulu timestamp + optional notes per slot."

### discrepancies (3 shots)
- [x] `discrepancies_1.png` — Main list with KPI tiles up top + several discrepancy rows + status pills + colored rails. **Caption:** "KPI tiles quick-filter by status owner; status pills show current lifecycle state."
- [x] `discrepancies_2.png` — Detail view with notes history showing back-and-forth between AMOPS and CES. **Caption:** "Notes history captures every status change and resolution comment."
- [x] `discrepancies_3.png` — Map view with discrepancies plotted on the airfield diagram. **Caption:** "Map view plots filtered discrepancies on the airfield diagram for cluster spotting."

### ces (2 shots)
- [x] `ces_1.png` — Shop tabs row + KPI badges (NEW / IN WORK / PROJECT / VERIFY / OVERDUE) with counts. **Caption:** "Shop tabs filter to your shop; KPI badges break out work-state counts."
- [x] `ces_2.png` — Status update modal with In Work / Project / Work Completed options + resolution notes. **Caption:** "Status modal limited to CES-relevant transitions; notes feed the discrepancy history."

### ppr (3 shots)
- [x] `ppr_1.png` — Triage queue with KPI pills (Awaiting Review / Awaiting Approval / per-agency pending) + status pills on rows. **Caption:** "Triage queue with KPI pills for awaiting-review counts and per-agency pending coordination."
- [x] `ppr_2.png` — Detail editor with coordination log showing per-agency reply tracking. **Caption:** "Coordination log tracks per-agency replies through Review › Coordination › Approval."
- [x] `ppr_3.png` — Public PPR request form (open `/<icao>/ppr-request` in an incognito window). **Caption:** "Public QR-coded request form at /<icao>/ppr-request — no login required."

### wildlife (3 shots)
- [x] `wildlife_1.png` — Timeline with mixed sightings (green) + strikes (red) grouped by day. **Caption:** "Day-grouped timeline mixes sightings (green) and strikes (red) with dispersal context."
- [x] `wildlife_2.png` — Heatmap view (Mapbox) with strike density rendered. **Caption:** "Heatmap aggregates strike density on the airfield map for hotspot identification."
- [x] `wildlife_3.png` — Analytics tab: monthly volume + top species + dispersal success. **Caption:** "Analytics breaks out trends by species, time of day, and dispersal effectiveness."

### contractors (2 shots)
- [x] `contractors_1.png` — Active list with personnel rows + credential expiry color-coding (one in red within-30d). **Caption:** "Active personnel with credential color-coding — red when within 30 days of expiry."
- [x] `contractors_2.png` — Add Personnel form with template picker visible. **Caption:** "Templates speed up recurring contractors so repeat visits are one-click."

### parking (3 shots)
- [x] `parking_1.png` — Full plan view with aircraft silhouettes placed on the apron + floating panel visible. **Caption:** "To-scale silhouettes from a 200+ airframe library; clearance updates live as you drag."
- [x] `parking_2.png` — Floating panel Aircraft tab with placed aircraft list grouped by type. **Caption:** "Aircraft tab groups placed silhouettes by type for quick selection and bulk edits."
- [x] `parking_3.png` — Clearance tab showing violations + warnings with feet-clearance numbers and UFC cite. **Caption:** "Clearance tab lists every violation and warning with feet-clearance numbers and UFC cite."

### obstructions (3 shots)
- [x] `obstructions_1.png` — Map with imaginary surfaces rendered + a candidate point clicked + result card below. **Caption:** "Click any point to compute distance, altitude, and surface penetration per UFC 3-260-01."
- [x] `obstructions_2.png` — Multi-point mode with a line or polygon evaluated, worst-penetration vertex flagged. **Caption:** "Multi-point mode evaluates lines or areas at every vertex and flags worst penetration."
- [x] `obstructions_3.png` — History page showing past evaluations with re-open links. **Caption:** "History keeps every past evaluation for the next review cycle."

### infrastructure (3 shots)
- [x] `infrastructure_1.png` — Map with NAVAIDs visible (PAPI, MALSR, edge lights) + Lighting Status panel rolled up. **Caption:** "Map view of every NAVAID with system-level rollup in the Lighting Status panel."
- [x] `infrastructure_2.png` — Fixture marker clicked + report-inop confirmation showing tier change ring (green→yellow). **Caption:** "Reporting a fixture inop re-evaluates the system tier per DAFMAN A3.1 and creates a discrepancy."
- [x] `infrastructure_3.png` — Edit Mode active with a fixture being dragged. **Caption:** "Edit Mode lets admins drag fixtures, bulk-shift, or place new bars from the toolbar."

---

## Airfield Management

### waivers (3 shots)
- [x] `waivers_1.png` — Main list with KPI quick-filter tiles + status pills + expiration color-coding. **Caption:** "KPI tiles for Permanent / Temporary / Expiring / Overdue Review filter the list with one click."
- [x] `waivers_2.png` — New Waiver form with classification picker visible. **Caption:** "Six classifications cover permanent, temporary, construction, event, extension, and amendment."
- [x] `waivers_3.png` — Annual review page or expiring-waivers slice. **Caption:** "Annual review queue flags waivers due for recertification each year."

---

## Reference

### aircraft (2 shots)
- [x] `aircraft_1.png` — Browse grid with several airframe tiles + search bar. **Caption:** "200+ airframes — search by type or manufacturer; sort by dimensions or MTOW."
- [x] `aircraft_2.png` — Airframe detail expanded showing silhouette + dimensions + ARFF CAT, ideally with ACN/PCN calculator visible. **Caption:** "Per-airframe specs with ACN/PCN calculator for pavement-bearing comparisons."

### regulations (2 shots)
- [x] `regulations_1.png` — Reference Library list with category filter active + favorite stars. **Caption:** "70+ regulations across DAFMAN, UFC, AFMAN, AF Form — searchable by content or title."
- [x] `regulations_2.png` — In-app PDF viewer open on a regulation page. **Caption:** "In-app PDF viewer opens any reg without a download."

### notams (1 shot)
- [x] `notams_1.png` — Main list with at least one expiring-within-24h NOTAM showing the red glow. **Caption:** "Expiring-within-24h NOTAMs glow red so they're unmissable on shift handoff."

---

## Reports & Admin

### reports (2 shots)
- [x] `reports_1.png` — Hub view with five report cards + Analytics dashboard visible below. **Caption:** "Five canned reports plus a 30-day analytics dashboard across every module."
- [x] `reports_2.png` — Daily Ops Summary PDF preview (or a generated PDF screenshot). **Caption:** "PDFs generate client-side — no airfield data leaves your installation."

### settings (2 shots)
- [x] `settings_1.png` — Profile section showing operating initials field + theme picker. **Caption:** "Profile, theme, and operating initials (used in audit-trail signatures)."
- [x] `settings_2.png` — Offline section with regulation-cache toggle + map-tile precaching status. **Caption:** "Offline section caches regulations and base-area map tiles for no-signal use."

### users (2 shots)
- [x] `users_1.png` — User list with mixed status pills (active / pending / deactivated) + role badges. **Caption:** "Status states — pending, active, deactivated — with role badges from the permission matrix."
- [x] `users_2.png` — Invite User modal open with role picker showing the 12 roles. **Caption:** "Invitations send a branded email via Resend and land the user in pending status."

### feedback (1 shot)
- [x] `feedback_1.png` — Inbox with stats cards up top + several rows showing star-rating color rails (comment + rating + custom fields render inline on each row — no separate detail view exists). **Caption:** "Stats cards aggregate submissions and average rating with semantic color rails per row."

---

## Capture targets

| Module | Shots | Module | Shots |
|---|---|---|---|
| airfield-status | 3 | discrepancies | 3 |
| dashboard | 1 | ces | 2 |
| activity | 3 | ppr | 3 |
| recent-activity | 2 | wildlife | 3 |
| qrc | 3 | contractors | 2 |
| scn | 2 | parking | 3 |
| shift-checklist | 3 | obstructions | 3 |
| checks | 3 | infrastructure | 3 |
| inspections | 2 | waivers | 3 |
| acsi | 3 | aircraft | 2 |
| daily-reviews | 2 | regulations | 2 |
| | | notams | 1 |
| | | reports | 2 |
| | | settings | 2 |
| | | users | 2 |
| | | feedback | 1 |

**Total: 64 shots across 27 modules.** Captureable in roughly four sittings of 15-20 shots each — one operations sweep, one airfield-management sweep, one reference sweep, one admin sweep. Demo AFB has enough seeded data to populate every module without manual setup.

(Originally planned 67 — three entries pruned after capture confirmed the corresponding UI doesn't exist: dashboard had no "Quick Launch" button row, NOTAMs has no "Add Local NOTAM" function, and Customer Feedback renders inline rather than via a detail view.)
