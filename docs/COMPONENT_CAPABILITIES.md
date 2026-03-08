# GLIDEPATH -- Component Capabilities Reference

**Version 2.16.1 | March 2026**
**"Guiding You to Mission Success"**

This document provides in-depth technical and functional capabilities for each module in the Glidepath airfield management platform.

---

## Table of Contents

1. [Dashboard & Airfield Status](#1-dashboard--airfield-status)
2. [Discrepancy Tracking](#2-discrepancy-tracking)
3. [Airfield Checks](#3-airfield-checks)
4. [Daily Inspections](#4-daily-inspections)
5. [ACSI Annual Compliance](#5-acsi-annual-compliance)
6. [Reports & Analytics](#6-reports--analytics)
7. [Obstruction Evaluations](#7-obstruction-evaluations)
8. [Aircraft Database](#8-aircraft-database)
9. [Regulations & Reference Library](#9-regulations--reference-library)
10. [Waiver Management](#10-waiver-management)
11. [NOTAMs](#11-notams)
12. [Events Log (Activity)](#12-events-log-activity)
13. [User Management](#13-user-management)
14. [QRC -- Quick Reaction Checklists](#14-qrc--quick-reaction-checklists)
15. [Shift Checklist](#15-shift-checklist)
16. [Settings & Base Configuration](#16-settings--base-configuration)

---

## 1. Dashboard & Airfield Status

### Purpose & Regulatory Basis

The Dashboard is the command-and-control hub for real-time airfield status. It implements the situational awareness requirements of DAFMAN 13-204 Vol. 2, providing at-a-glance visibility into runway status, weather conditions, NAVAID operability, ARFF readiness, Bird Watch Condition (BWC), Runway Surface Condition (RSC), Runway Condition Reading (RCR), and active advisories/warnings. Every status change is persisted to the `airfield_status` table and propagated in real time to all connected users via Supabase Realtime.

### User Interface

- **Primary page**: `app/(app)/page.tsx` -- the main dashboard (also the app landing page after login)
- **Secondary page**: `app/(app)/dashboard/page.tsx` -- the detailed operations dashboard with quick actions, activity log, and personnel tracking
- **Layout**: Full-width card grid. Top section shows advisory banner (WATCH/WARNING/ADVISORY) with color-coded severity. Below: runway status cards (one per runway), weather widget, NAVAID status panel, ARFF readiness panel, RSC/RCR/BWC indicators, construction remarks, and misc remarks.
- **Quick Actions** (dashboard page): Three KPI badges linking to Airfield Inspections, Airfield Checks, and New Discrepancy.
- **Login Activity Dialog**: On first login each session, a dialog shows the user's last activity timestamp (`last_seen_at` from profiles). Controlled by `glidepath_activity_checked` session flag.

### Data Model

**Primary table**: `airfield_status` (one row per installation)

| Column | Type | Description |
|--------|------|-------------|
| `base_id` | UUID FK | Links to installation |
| `advisory_type` | enum | WATCH, WARNING, ADVISORY, or null |
| `advisory_text` | text | Free-text advisory message |
| `active_runway` | text | Legacy single-runway active end |
| `runway_status` | enum | Legacy: open, suspended, closed |
| `runway_statuses` | JSONB | Multi-runway map: `{ "06/24": { status, active_end, remarks } }` |
| `arff_cat` | int | ARFF category number |
| `arff_statuses` | JSONB | Per-aircraft readiness: `{ "T3000": "optimum" }` |
| `rsc_condition` | text | DRY, WET, ICY, etc. |
| `rcr_touchdown` | text | RCR value at touchdown zone |
| `rcr_condition` | text | RCR condition type |
| `bwc_value` | text | LOW, MOD, SEV, PROHIB |
| `construction_remarks` | text | Active construction notes |
| `misc_remarks` | text | General remarks |

**Supporting table**: `runway_status_log` -- audit trail of every runway status change, with `changed_by`, `reason`, and old/new values for runway status, active runway, and advisory fields. Consumed by the Daily Ops Report PDF.

### Features

- **Multi-runway support**: `DashboardProvider` manages `RunwayStatuses` (a `Record<string, RunwayStatusEntry>`) with per-runway `status`, `active_end`, and `remarks`. Legacy single-runway fields are synced from the first runway for backward compatibility via `persistRunwayStatuses()`.
- **Runway status controls**: Toggle active end (e.g., 06 vs 24), set status (open/suspended/closed) with optional remarks. Each change calls `setRunwayStatusForRunway()` and `logRunwayStatusChange()`.
- **Advisory management**: Set/clear WATCH/WARNING/ADVISORY banners via `setAdvisory()`. Persisted to `airfield_status` and broadcast via Realtime.
- **ARFF readiness**: Per-aircraft readiness levels (inadequate/critical/reduced/optimum) via `setArffStatusForAircraft()`. ARFF category number via `setArffCat()`.
- **RSC/RCR/BWC**: Set conditions from the dashboard. Values auto-sync when checks or inspections are filed (e.g., RSC check auto-updates `rsc_condition`).
- **Construction and Misc remarks**: Free-text fields persisted to `airfield_status`.
- **Weather widget**: `fetchCurrentWeather()` from `lib/weather.ts` provides current conditions with emoji mapping (`weatherEmoji()`).
- **NAVAID status panel**: `fetchNavaidStatuses()` and `updateNavaidStatus()` from `lib/supabase/navaids.ts`. Color-coded by status (operational, degraded, unserviceable, etc.).
- **Personnel on Airfield tracking**: `fetchActiveContractors()` and `updateContractor()` from `lib/supabase/contractors.ts`. Shows active contractors/personnel with arrival/departure logging.
- **Supabase Realtime**: `DashboardProvider` subscribes to `postgres_changes` on `airfield_status` table (UPDATE events filtered by `base_id`). All state updates are optimistic with a 15-second `lastLocalUpdate` guard to prevent polling from overwriting local changes.
- **Polling fallback**: `refreshStatus()` runs every 30 seconds as a fallback when Realtime is unavailable. Skips if a local update occurred within the last 15 seconds.

### Exports

No direct exports from the dashboard. Status data feeds into the Daily Ops Report PDF.

### Integration Points

- **Checks module**: RSC and BASH checks auto-update `rsc_condition` and `bwc_value` on the dashboard via `updateAirfieldStatus()`.
- **Inspections module**: BWC, RSC, and RCR from filed inspections auto-update dashboard state.
- **Activity log**: All dashboard changes (runway status, advisories, ARFF, RSC/BWC) are logged to `activity_log` via `logActivity()` and `logRunwayStatusChange()`.
- **Daily Ops Report**: Runway status log entries are included in the daily operations PDF.

### Technical Implementation

| File | Purpose |
|------|---------|
| `app/(app)/page.tsx` | Main dashboard page (~1,800 lines) |
| `app/(app)/dashboard/page.tsx` | Operations dashboard with activity log |
| `lib/dashboard-context.tsx` | `DashboardProvider` context -- Realtime subscription, state management, persistence |
| `lib/supabase/airfield-status.ts` | `fetchAirfieldStatus()`, `updateAirfieldStatus()`, `logRunwayStatusChange()` |
| `lib/supabase/navaids.ts` | NAVAID status CRUD |
| `lib/supabase/contractors.ts` | Personnel/contractor tracking |
| `lib/weather.ts` | Weather data fetching |

---

## 2. Discrepancy Tracking

### Purpose & Regulatory Basis

Discrepancy tracking is the core work-order management system for airfield deficiencies. Per DAFMAN 13-204 Vol. 2, airfield management personnel must document, track, and coordinate repair of all airfield discrepancies including pavement deficiencies, lighting outages, marking deficiencies, FOD hazards, signage issues, drainage problems, vegetation encroachment, wildlife hazards, obstructions, and NAVAID deficiencies. The module tracks each discrepancy from initial report through CES coordination to final verification and closure.

### User Interface

- **List page**: `app/(app)/discrepancies/page.tsx` -- Dual-view (map + list) with Mapbox satellite map showing geo-pinned discrepancies. Filter bar: Open/Completed/Cancelled/All. KPI badges: OPEN count, >30 DAYS count, AFM/CES/AMOPS pipeline counts. Search by title, description, or work order number.
- **Detail page**: `app/(app)/discrepancies/[id]/page.tsx` -- Full detail view with status badge, severity badge, photo gallery with viewer modal, status update timeline, edit modal, work order modal, and inline photo upload. PDF export (download or email).
- **Create page**: `app/(app)/discrepancies/new/page.tsx` -- Form with location dropdown (populated from installation areas), multi-select type picker (checkbox-style), title, description, NOTAM reference, current status selector, Mapbox location map (tap to pin), GPS "Use My Location" button, and photo capture/upload.
- **Map view component**: `DiscrepancyMapView` (lazy-loaded) shows discrepancies as colored markers on a Mapbox satellite map with photo popups.

### Data Model

**Primary table**: `discrepancies`

| Column | Type | Description |
|--------|------|-------------|
| `display_id` | text | Human-readable ID (e.g., `D-2026-A1B2`) |
| `type` | text | Comma-separated type values (multi-type support) |
| `severity` | enum | critical, high, medium, low, no |
| `status` | enum | open, completed, cancelled |
| `current_status` | enum | submitted_to_afm, submitted_to_ces, awaiting_action_by_ces, work_completed_awaiting_verification |
| `title` | text | Short summary (max 60 chars) |
| `description` | text | Detailed description |
| `location_text` | text | Area name from installation config |
| `latitude` / `longitude` | numeric | GPS coordinates |
| `assigned_shop` | text | CE shop assignment |
| `work_order_number` | text | CES work order (defaults to "Pending") |
| `notam_reference` | text | Associated NOTAM if applicable |
| `linked_notam_id` | UUID FK | Link to notams table |
| `inspection_id` | UUID FK | Source inspection if auto-generated |
| `resolution_notes` | text | Closure/resolution description |
| `resolution_date` | timestamp | When resolved |
| `photo_count` | int | Cached photo count |
| `reported_by` | UUID FK | User who created the discrepancy |

**Supporting tables**:
- `status_updates` -- Audit trail with `old_status`, `new_status`, `notes`, `updated_by` (joins to profiles for name/rank)
- `photos` -- Entity-specific FK `discrepancy_id`, with `storage_path`, `file_name`, `file_size`, `mime_type`

### Features

- **Multi-type selection**: Discrepancies can have multiple types stored as comma-separated values (e.g., "pavement,marking").
- **Display ID generation**: `D-{year}-{base36_timestamp}` format via `createDiscrepancy()`.
- **Current status workflow**: 4-stage pipeline tracking (AFM -> CES -> Awaiting CES -> Awaiting Verification) with KPI badges on the list page.
- **>30 days aging alert**: Dedicated KPI badge showing count of open discrepancies older than 30 days with red/green color coding.
- **Photo management**: Upload from file picker or camera capture via `PhotoPickerButton`. Photos stored in Supabase Storage (`photos` bucket, path `discrepancy-photos/{id}/{timestamp}.ext`) with data URL fallback. Photo count cached on the discrepancy row.
- **Location pinning**: Mapbox satellite map with click-to-pin and GPS geolocation. Coordinates stored as `latitude`/`longitude`.
- **Status update audit trail**: Every status change recorded in `status_updates` with user attribution via profile join.
- **Notes/comments**: `addStatusNote()` adds entries with null old/new status (pure note entries).
- **Admin delete**: `deleteDiscrepancy()` cascades to photos and status_updates before deleting the discrepancy.
- **Activity logging**: All CRUD operations logged via `logActivity()` with rich metadata.

### Exports

- **List PDF**: Landscape letter format via jsPDF + jspdf-autotable. Includes photo thumbnails in a dedicated column using `didParseCell`/`didDrawCell` hooks. Fetches Mapbox satellite map images for geo-pinned discrepancies.
- **List Excel**: Styled workbook via exceljs with columns for display ID, title, type, severity, status, current status, location, coordinates, assigned shop, work order, days open, created date, photo count, and photo filenames.
- **Detail PDF**: `generateDiscrepancyPdf()` in `lib/discrepancy-pdf.ts` -- Portrait letter format with header, info box (work order, status, severity, type, location, assigned shop), current status, dates, description, resolution notes, location map (Mapbox satellite), and photo gallery.
- **Email PDF**: All PDFs can be emailed via `sendPdfViaEmail()` using the `EmailPdfModal` component and Resend SDK.

### Integration Points

- **Inspections**: Failed inspection items can generate discrepancies. `inspection_id` FK links back.
- **NOTAMs**: `notam_reference` and `linked_notam_id` for NOTAM association.
- **Activity log**: All operations logged.
- **Reports**: Open discrepancies feed into the Daily Ops Report and dedicated discrepancy reports.
- **Dashboard**: Discrepancy KPIs shown on the operations dashboard.

### Technical Implementation

| File | Purpose |
|------|---------|
| `app/(app)/discrepancies/page.tsx` | List page with map/list views, KPIs, filtering, Excel/PDF export |
| `app/(app)/discrepancies/[id]/page.tsx` | Detail page with modals, photos, status timeline |
| `app/(app)/discrepancies/new/page.tsx` | Create form with map, GPS, photos |
| `lib/supabase/discrepancies.ts` | CRUD: `fetchDiscrepancies()`, `createDiscrepancy()`, `updateDiscrepancy()`, `updateDiscrepancyStatus()`, `deleteDiscrepancy()`, `uploadDiscrepancyPhoto()`, `fetchDiscrepancyPhotos()`, `fetchStatusUpdates()`, `addStatusNote()`, `fetchDiscrepancyKPIs()` |
| `lib/discrepancy-pdf.ts` | `generateDiscrepancyPdf()` -- single-discrepancy detail PDF |
| `components/discrepancies/discrepancy-card.tsx` | Card component for list view |
| `components/discrepancies/discrepancy-map-view.tsx` | Mapbox map component |
| `components/discrepancies/location-map.tsx` | Pin-location map for create/edit |
| `components/discrepancies/modals.tsx` | EditDiscrepancyModal, StatusUpdateModal, WorkOrderModal, PhotoViewerModal |

---

## 3. Airfield Checks

### Purpose & Regulatory Basis

Airfield Checks are short-form, targeted inspections required by DAFMAN 13-204 Vol. 2 including FOD walks, Runway Surface Condition (RSC) assessments, Runway Condition Readings (RCR), Bird/Wildlife (BASH) condition checks, In-Flight Emergency (IFE) responses, Ground Emergency responses, and Heavy Aircraft operations. Each check type has a specific data schema and auto-updates dashboard status indicators.

### User Interface

- **Combined create/history page**: `app/(app)/checks/page.tsx` -- Top section is the check creation form; bottom section shows recent completed checks. Check type selector determines which fields are shown. Includes airfield diagram viewer, issue tracking with multi-discrepancy panels, and per-issue photo/map support.
- **Detail page**: `app/(app)/checks/[id]/page.tsx` -- Read-only view of a completed check with all data fields, comments, photos, and PDF export.
- **Check type selector**: 7 types defined in `CHECK_TYPE_CONFIG` from `lib/constants.ts`: FOD, RSC, RCR, BASH, IFE, Ground Emergency, Heavy Aircraft.

### Data Model

**Primary table**: `airfield_checks`

| Column | Type | Description |
|--------|------|-------------|
| `display_id` | text | `AC-{base36}` for completed, `DC-{base36}` for drafts |
| `check_type` | enum | fod, rsc, rcr, bash, ife, ground_emergency, heavy_aircraft |
| `areas` | text[] | Array of checked area names |
| `data` | JSONB | Type-specific data (condition codes, species, actions, agencies, etc.) |
| `completed_by` | text | Inspector name |
| `completed_at` | timestamp | Completion time |
| `status` | enum | draft, completed |
| `draft_data` | JSONB | Full `CheckDraft` object for draft persistence |
| `saved_by_name` / `saved_by_id` / `saved_at` | text/UUID/timestamp | Draft save metadata |
| `photo_count` | int | Cached photo count |

**Supporting tables**:
- `check_comments` -- Remarks with `check_id`, `comment`, `user_name`
- `photos` -- Entity-specific FK `check_id`, with `issue_index` for per-issue photo linking

### Features

- **Type-specific forms**:
  - **FOD**: Area selection, issue reporting with photos/maps
  - **RSC**: Runway condition dropdown (`RSC_CONDITIONS`), optional RCR reporting with value and condition type
  - **BASH**: Condition code (LOW/MODERATE/SEVERE/PROHIBITED via `BASH_CONDITION_CODES`), species observed
  - **IFE / Ground Emergency**: Aircraft type, callsign, nature of emergency, AM actions completed checklist (`EMERGENCY_ACTIONS`), agencies notified (`EMERGENCY_AGENCIES`)
  - **Heavy Aircraft**: Aircraft type/MDS
- **Multi-issue tracking**: `SimpleDiscrepancyPanelGroup` component supports multiple issues per check, each with its own comment, GPS location, and photos.
- **Per-issue photos**: Photos linked to specific issues via `issue_index` on the photos table.
- **Draft persistence**: Dual-layer -- localStorage auto-save via `saveCheckDraft()` (survives page refresh) + Supabase DB save via `saveCheckDraftToDb()` (manual "Save Draft" button, enables cross-device resume). Draft hydration on page load checks DB first, then localStorage.
- **Auto-dashboard sync**: RSC checks auto-update `rsc_condition`, `rcr_touchdown`, `rcr_condition` on `airfield_status`. BASH checks auto-update `bwc_value`. Handled in `createCheck()`.
- **Airfield diagram**: Loaded from Supabase Storage via `getAirfieldDiagram()` for reference during check creation.
- **Activity logging**: Check completion logged with rich metadata including check type, areas, all data fields, and comments.

### Exports

- **Detail PDF**: `generateCheckPdf()` in `lib/check-pdf.ts` -- Portrait letter format with header, info box (type, completed by, date), areas checked, type-specific details (condition codes, species, actions, agencies), issues with inline maps and per-issue photos, remarks timeline, and unlinked photos.
- **Email PDF**: Via `EmailPdfModal` and `sendPdfViaEmail()`.

### Integration Points

- **Dashboard**: RSC and BASH checks auto-update dashboard RSC/BWC indicators.
- **Activity log**: All check operations logged.
- **Daily Ops Report**: Checks for the selected date are included in the report.
- **Discrepancies**: Issues found during checks can be tracked as discrepancies.

### Technical Implementation

| File | Purpose |
|------|---------|
| `app/(app)/checks/page.tsx` | Create form + recent history (~1,400 lines) |
| `app/(app)/checks/[id]/page.tsx` | Detail view with PDF export |
| `lib/supabase/checks.ts` | CRUD: `createCheck()`, `fetchChecks()`, `fetchCheck()`, `fetchCheckComments()`, `addCheckComment()`, `deleteCheck()`, `uploadCheckPhoto()`, `saveCheckDraftToDb()`, `loadCheckDraftFromDb()`, `deleteCheckDraft()` |
| `lib/check-pdf.ts` | `generateCheckPdf()` |
| `lib/check-draft.ts` | `CheckDraft` interface, localStorage helpers: `loadCheckDraft()`, `saveCheckDraft()`, `clearCheckDraft()` |

---

## 4. Daily Inspections

### Purpose & Regulatory Basis

Daily Inspections implement the airfield and lighting inspection requirements of DAFMAN 13-204 Vol. 2, Para 5.4.1 and 5.4.2. Airfield management personnel must conduct daily airfield inspections and lighting inspections using standardized checklists. The module supports airfield inspections, lighting inspections, construction meeting inspections, and joint monthly inspections, all linked together as a "daily group" via `daily_group_id`.

### User Interface

- **Combined page**: `app/(app)/inspections/page.tsx` (~1,913 lines, the largest file in the codebase) -- Serves as both the inspection form and history viewer. Tabs toggle between Airfield and Lighting inspection types. Each tab shows a sectioned checklist where items default to "pass" and can be toggled through pass -> fail -> N/A -> pass.
- **Detail page**: `app/(app)/inspections/[id]/page.tsx` -- Read-only view of completed inspections with pass/fail/N/A breakdown, discrepancy details, photos, and PDF export.
- **History view**: Toggle to show past inspections with type filter and search.
- **URL parameter support**: `?action=begin` auto-starts a new inspection, `?view=history` shows history, `?type=lighting` pre-selects the lighting tab.

### Data Model

**Primary table**: `inspections`

| Column | Type | Description |
|--------|------|-------------|
| `display_id` | text | `AI-{year}-{base36}` (airfield), `LI-` (lighting), `CM-` (construction), `JM-` (joint monthly) |
| `inspection_type` | enum | airfield, lighting, construction_meeting, joint_monthly |
| `inspector_name` / `inspector_id` | text/UUID | Inspector info |
| `inspection_date` | date | Date of inspection |
| `status` | enum | in_progress, completed |
| `items` | JSONB | Array of `InspectionItem` objects with `id`, `section`, `item`, `response`, `notes`, `location`, `discrepancies` |
| `total_items` / `passed_count` / `failed_count` / `na_count` / `completion_percent` | int | Statistics |
| `bwc_value` / `rsc_condition` / `rcr_value` / `rcr_condition` | text | Conditions reported during inspection |
| `weather_conditions` / `temperature_f` | text/numeric | Weather at time of inspection |
| `construction_meeting` / `joint_monthly` | boolean | Flags for special inspection types |
| `personnel` | text[] | Additional personnel present |
| `daily_group_id` | UUID | Links airfield + lighting halves |
| `draft_data` | JSONB | `InspectionHalfDraft` for draft persistence |
| `completed_by_name` / `completed_by_id` / `completed_at` | text/UUID/timestamp | Completion info |
| `filed_by_name` / `filed_by_id` / `filed_at` | text/UUID/timestamp | Filing info |

### Features

- **Default-to-pass**: `halfDraftToItems()` treats undefined responses as `'pass'`. The toggle cycle is: pass -> fail -> N/A -> pass (no blank state). This dramatically speeds up inspections since most items pass.
- **Sectioned checklists**: Driven by `AIRFIELD_INSPECTION_SECTIONS` and `LIGHTING_INSPECTION_SECTIONS` from `lib/constants.ts`, or by DB-stored templates loaded via `fetchInspectionTemplate()`.
- **Conditional sections**: Sections can be marked as `conditional` and toggled on/off via `enabledConditionals`.
- **Special item types**: BWC (`type: 'bwc'`), RSC (`type: 'rsc'`), and RCR (`type: 'rcr'`) items have dedicated UI widgets instead of pass/fail toggles.
- **Multi-discrepancy per item**: Failed items expand to show `SimpleDiscrepancyPanelGroup` for multiple discrepancies, each with comment, GPS location, and photos.
- **Per-discrepancy photos**: Photos linked via `inspection_id`, `inspection_item_id`, and `issue_index` on the photos table.
- **Weather auto-fetch**: `fetchCurrentWeather()` populates weather conditions and temperature.
- **Daily group linking**: Airfield and lighting inspections share a `daily_group_id` UUID so they can be viewed together.
- **Draft persistence**: Dual-layer -- localStorage auto-save via `saveDraftToStorage()` + Supabase DB save via `saveInspectionDraft()`. The `DailyInspectionDraft` contains four `InspectionHalfDraft` objects (airfield, lighting, construction_meeting, joint_monthly). DB drafts enable cross-device resume.
- **File vs Complete**: "Complete" saves in-progress; "File" finalizes and clears draft data via `fileInspection()`.
- **Auto-dashboard sync**: BWC, RSC, and RCR from filed inspections auto-update `airfield_status`. RCR is cleared if only RSC is reported.
- **Template support**: DB-driven inspection templates loaded via `fetchInspectionTemplate()` with fallback to hardcoded constants.
- **Airfield diagram**: Viewable during inspection for reference.

### Exports

- **Detail PDF**: `generateInspectionPdf()` in `lib/pdf-export.ts` -- Portrait letter format with header, inspector info, weather, BWC/RSC/RCR, checklist results (pass/fail/N/A per section), failed items with notes and location maps, per-discrepancy photos, and general notes.
- **Email PDF**: Via `EmailPdfModal`.

### Integration Points

- **Dashboard**: BWC/RSC/RCR auto-update on filing.
- **Discrepancies**: Failed items can reference or generate discrepancies.
- **Activity log**: Completion and filing logged with rich metadata (type, BWC, RSC, RCR, failed items, discrepancy notes).
- **Daily Ops Report**: Inspections for the selected date are included.
- **Templates**: Custom templates from `settings/templates` page override default checklists.

### Technical Implementation

| File | Purpose |
|------|---------|
| `app/(app)/inspections/page.tsx` | Combined form + history (~1,913 lines) |
| `app/(app)/inspections/[id]/page.tsx` | Detail view with PDF export |
| `lib/supabase/inspections.ts` | CRUD: `fetchInspections()`, `createInspection()`, `saveInspectionDraft()`, `fileInspection()`, `getInspectorName()`, `uploadInspectionPhoto()`, `deleteInspection()`, `updateInspectionNotes()` |
| `lib/pdf-export.ts` | `generateInspectionPdf()` with photo/map embedding |
| `lib/inspection-draft.ts` | `DailyInspectionDraft`, `InspectionHalfDraft`, `halfDraftToItems()`, localStorage helpers |

---

## 5. ACSI Annual Compliance

### Purpose & Regulatory Basis

The Airfield Compliance and Safety Inspection (ACSI) module implements the annual inspection requirement from DAFMAN 13-204 Vol. 2, Para 5.4.3. The ACSI is a comprehensive, multi-section checklist (~100 items across 10 sections) covering every aspect of airfield compliance. It includes inspection team management, risk certification signatures, and multi-discrepancy tracking per item.

### User Interface

- **List page**: `app/(app)/acsi/page.tsx` -- Card list with KPI badges (Total, Completed, In Progress, Drafts). Filter by status (all/draft/in_progress/completed/staffed). Search by display ID, airfield name, or inspector name. Each card shows display ID, airfield name, fiscal year, date, progress %, pass/fail/N/A counts, status badge, and inspector.
- **Create/Resume page**: `app/(app)/acsi/new/page.tsx` -- Multi-step wizard for conducting the ACSI. Supports resuming from `?resume={id}`. Includes inspection team roster editor, risk certification signature blocks, and the full ACSI checklist.
- **Detail page**: `app/(app)/acsi/[id]/page.tsx` -- Read-only view of completed ACSI with full results, team roster, signatures, and exports.
- **Reference**: DAFMAN 13-204v2, Para 5.4.3 cited in the page header.

### Data Model

**Primary table**: `acsi_inspections`

| Column | Type | Description |
|--------|------|-------------|
| `display_id` | text | `ACSI-{year}-{base36}` |
| `airfield_name` | text | Name of the inspected airfield |
| `inspection_date` | date | Date of inspection |
| `fiscal_year` | int | Fiscal year |
| `status` | enum | draft, in_progress, completed, staffed |
| `items` | JSONB | Array of `AcsiItem` objects |
| `total_items` / `passed_count` / `failed_count` / `na_count` | int | Statistics |
| `inspection_team` | JSONB | Array of `AcsiTeamMember` (role, rank, name, title) |
| `risk_cert_signatures` | JSONB | Array of `AcsiSignatureBlock` |
| `notes` | text | General notes |
| `draft_data` | JSONB | Full draft state for resume |
| `inspector_name` / `inspector_id` | text/UUID | Lead inspector |
| `completed_by_name` / `completed_by_id` / `completed_at` | text/UUID/timestamp | Completion info |
| `filed_by_name` / `filed_by_id` / `filed_at` | text/UUID/timestamp | Filing info |

**Supporting table**: `photos` with `acsi_inspection_id` and `acsi_item_id` FK columns. `acsi_item_id` uses format `{itemId}:{discrepancyIndex}` for per-discrepancy photo linking.

### Features

- **10-section checklist**: `ACSI_CHECKLIST_SECTIONS` from `lib/constants.ts` with ~100 items covering all DAFMAN 13-204v2 compliance areas.
- **Parent/sub-field hierarchy**: Items organized with section headers, parent items, and sub-items.
- **Multi-discrepancy per item**: Failed items support multiple discrepancies, each with comment, location, and photos.
- **Inspection team management**: Add/edit/remove team members with role, rank, name, and title fields.
- **Risk certification signatures**: Configurable signature blocks for command endorsement.
- **Draft persistence**: Dual-layer -- localStorage auto-save + Supabase DB auto-save on mount via `saveAcsiDraft()`.
- **Resume support**: Draft and in-progress ACSIs can be resumed via `?resume={id}` URL parameter.
- **Filing**: `fileAcsiInspection()` sets status to completed, clears draft data.
- **Delete**: `deleteAcsiInspection()` with activity logging.

### Exports

- **PDF**: `generateAcsiPdf()` in `lib/acsi-pdf.ts` -- Complex multi-page PDF using jspdf-autotable with `didParseCell`/`didDrawCell` hooks. Row metadata tracks `'item' | 'parent' | 'detail'` types. Parent/sub-field hierarchy preserved. Failed items expand to show discrepancy details with inline photos and Mapbox satellite map thumbnails. Photos fetched from Supabase Storage and converted to data URLs. Map images fetched via `fetchCleanMapDataUrl()`.
- **Excel**: `generateAcsiExcel()` in `lib/acsi-excel.ts` -- Multi-sheet workbook: Sheet 1 (Summary with key/value pairs), Sheet 2 (Inspection Team roster), Sheet 3 (All Checklist Items with section, item number, description, response, notes, discrepancy details).
- **Email PDF**: Via `EmailPdfModal`.

### Integration Points

- **Activity log**: Save and file operations logged with completion percentage and item counts.
- **Photos**: ACSI-specific photo FK columns on the photos table.
- **Reports**: ACSI results available for reporting.

### Technical Implementation

| File | Purpose |
|------|---------|
| `app/(app)/acsi/page.tsx` | List page with KPIs and filtering |
| `app/(app)/acsi/new/page.tsx` | Create/resume wizard |
| `app/(app)/acsi/[id]/page.tsx` | Detail view |
| `lib/supabase/acsi-inspections.ts` | CRUD: `fetchAcsiInspections()`, `saveAcsiDraft()`, `fileAcsiInspection()`, `loadAcsiDraftFromDb()`, `deleteAcsiInspection()`, `uploadAcsiPhoto()`, `fetchAcsiPhotos()` |
| `lib/acsi-pdf.ts` | `generateAcsiPdf()` with photo/map embedding |
| `lib/acsi-excel.ts` | `generateAcsiExcel()` multi-sheet workbook |
| `lib/acsi-draft.ts` | Draft persistence helpers |
| `components/acsi/` | ACSI-specific UI components |

---

## 6. Reports & Analytics

### Purpose & Regulatory Basis

The Reports module provides consolidated analytical views of airfield operations data. Per DAFMAN 13-204 Vol. 2, airfield managers must produce daily operations summaries and maintain visibility into discrepancy backlogs. The module provides four report types: Daily Operations Summary, Open Discrepancy Report, Discrepancy Trends, and Aging Discrepancies.

### User Interface

- **Hub page**: `app/(app)/reports/page.tsx` -- Card grid with four report options, each with icon, title, and description.
- **Daily Operations Summary**: `app/(app)/reports/daily/page.tsx` -- Date picker (single date or range), generates a comprehensive preview showing all activity for the selected period, then exports to PDF.
- **Open Discrepancy Report**: `app/(app)/reports/discrepancies/page.tsx` -- Point-in-time snapshot of all open discrepancies with severity breakdown and shop assignment summary.
- **Discrepancy Trends**: `app/(app)/reports/trends/page.tsx` -- Opened vs. closed over time to track backlog growth/shrinkage with top areas and types.
- **Aging Discrepancies**: `app/(app)/reports/aging/page.tsx` -- Open discrepancies grouped by aging tier (0-7, 8-14, 15-30, 31-60, 61-90, 90+ days) with severity and shop breakdown.

### Data Model

No dedicated tables -- all reports query existing tables (`inspections`, `airfield_checks`, `discrepancies`, `status_updates`, `runway_status_log`, `obstruction_evaluations`, `activity_log`, `qrc_executions`).

### Features

- **Daily Ops Report data aggregation**: `fetchDailyReportData()` in `lib/reports/daily-ops-data.ts` queries all relevant tables for the date range and returns a consolidated `DailyReportData` object containing:
  - Inspections (with pass/fail/N/A breakdowns and failed item details)
  - Airfield checks (with type-specific data)
  - New discrepancies (with reporter names via profile join)
  - Status updates (with discrepancy context)
  - Runway status changes (from `runway_status_log`)
  - Obstruction evaluations (with evaluator names)
  - Photos for discrepancies and obstructions (fetched as data URLs)
  - Map images for geo-pinned items
  - Activity log entries (Events Log section)
  - QRC executions with step responses
- **Daily Ops PDF**: `generateDailyOpsPdf()` in `lib/reports/daily-ops-pdf.ts` -- Multi-section landscape PDF using jspdf-autotable. Sections: header with base name/ICAO, inspections summary, checks summary, new discrepancies, status updates, runway status changes, obstruction evaluations, Events Log, QRC executions. Includes inline photos and maps.
- **Open discrepancies data**: `lib/reports/open-discrepancies-data.ts` and `open-discrepancies-pdf.ts`
- **Aging discrepancies data**: `lib/reports/aging-discrepancies-data.ts` and `aging-discrepancies-pdf.ts`
- **Discrepancy trends data**: `lib/reports/discrepancy-trends-data.ts` and `discrepancy-trends-pdf.ts`
- **Email support**: All reports can be emailed via `EmailPdfModal`.
- **Date mode**: Single date or date range selection for the Daily Ops Report.

### Exports

All four report types produce PDF output via jsPDF + jspdf-autotable. The Daily Ops Report is the most comprehensive, spanning multiple pages with tabular data, inline photos, and satellite maps.

### Integration Points

- Queries data from: inspections, checks, discrepancies, status_updates, runway_status_log, obstruction_evaluations, activity_log, qrc_executions, photos, profiles
- **Email**: All PDFs can be emailed via Resend SDK

### Technical Implementation

| File | Purpose |
|------|---------|
| `app/(app)/reports/page.tsx` | Report hub with card grid |
| `app/(app)/reports/daily/page.tsx` | Daily Ops Report UI |
| `app/(app)/reports/discrepancies/page.tsx` | Open Discrepancy Report UI |
| `app/(app)/reports/trends/page.tsx` | Discrepancy Trends UI |
| `app/(app)/reports/aging/page.tsx` | Aging Discrepancies UI |
| `lib/reports/daily-ops-data.ts` | `fetchDailyReportData()` -- aggregates all data |
| `lib/reports/daily-ops-pdf.ts` | `generateDailyOpsPdf()` -- multi-section PDF |
| `lib/reports/open-discrepancies-data.ts` | Open discrepancy data fetching |
| `lib/reports/open-discrepancies-pdf.ts` | Open discrepancy PDF generation |
| `lib/reports/aging-discrepancies-data.ts` | Aging tier calculation and data |
| `lib/reports/aging-discrepancies-pdf.ts` | Aging report PDF |
| `lib/reports/discrepancy-trends-data.ts` | Trend analysis data |
| `lib/reports/discrepancy-trends-pdf.ts` | Trend report PDF |

---

## 7. Obstruction Evaluations

### Purpose & Regulatory Basis

The Obstruction Evaluations module implements UFC 3-260-01 (Unified Facilities Criteria) imaginary surface analysis for airfield obstructions. Per DAFMAN 13-204 Vol. 2, airfield managers must evaluate potential obstructions against all imaginary surfaces (Primary, Approach-Departure, Inner Horizontal, Conical, Outer Horizontal, Transitional, Clear Zone, Graded Area) and Accident Potential Zones (APZ I/II per DoD Instruction 4165.57). The module performs real-time geometric calculations against actual runway geometry.

### User Interface

- **Evaluation page**: `app/(app)/obstructions/page.tsx` -- Interactive Mapbox satellite map for point selection. User clicks to place an obstruction, enters height AGL, and the system evaluates against all surfaces for all runways. Results shown as pass/violation badges per surface.
- **History page**: `app/(app)/obstructions/[id]/page.tsx` -- Read-only view of a saved evaluation with full surface analysis results, photos, and PDF export.
- **Map component**: `AirfieldMap` (dynamic import, no SSR) shows runway outlines, imaginary surface boundaries, and the obstruction point.
- **Edit mode**: `?edit={id}` URL parameter enables editing an existing evaluation.

### Data Model

**Primary table**: `obstruction_evaluations`

| Column | Type | Description |
|--------|------|-------------|
| `display_id` | text | Auto-generated display ID |
| `runway_class` | enum | B, Army_B |
| `object_height_agl` | numeric | Object height above ground level (feet) |
| `object_distance_ft` | numeric | Distance from runway |
| `distance_from_centerline_ft` | numeric | Lateral offset from centerline |
| `object_elevation_msl` | numeric | Ground elevation MSL at object location |
| `obstruction_top_msl` | numeric | Top of object MSL |
| `latitude` / `longitude` | numeric | Object coordinates |
| `description` | text | Object description |
| `photo_storage_path` | text | JSON array of photo paths or single path |
| `results` | JSONB | Array of `SurfaceResult` objects per surface |
| `controlling_surface` | text | Most restrictive violated surface |
| `violated_surfaces` | text[] | List of violated surface keys |
| `has_violation` | boolean | Whether any surface is violated |
| `notes` | text | Evaluator notes |
| `evaluated_by` | UUID FK | User who performed evaluation |

### Features

- **Multi-runway analysis**: `evaluateObstructionAllRunways()` evaluates the obstruction against all configured runways simultaneously, returning per-runway results.
- **9 imaginary surfaces evaluated**: Clear Zone, Graded Area, Primary Surface, Approach-Departure Clearance Surface (50:1 slope), Inner Horizontal (150 ft / 13,120 ft radius), Conical (20:1 slope / 7,000 ft extent), Outer Horizontal (500 ft / 42,250 ft radius), Transitional (7:1 slope), and APZ I/II.
- **Runway class support**: Surface criteria vary by runway class (B vs Army_B) via `getSurfaceCriteria()` from `lib/calculations/surface-criteria.ts`.
- **Geodesic geometry engine**: `lib/calculations/geometry.ts` provides Haversine distance (`distanceFt()`), bearing calculation (`bearing()`), point offset (`offsetPoint()`), runway geometry construction (`getRunwayGeometry()`), and point-to-runway relation (`pointToRunwayRelation()`).
- **Elevation lookup**: `fetchElevation()` queries elevation APIs for ground MSL at the obstruction point.
- **Surface identification**: `identifySurface()` determines which imaginary surface(s) the point falls within based on distance from threshold and centerline.
- **Per-surface results**: Each surface evaluation returns `surfaceKey`, `surfaceName`, `isWithinBounds`, `maxAllowableHeightAGL`, `maxAllowableHeightMSL`, `obstructionTopMSL`, `violated` (boolean), `penetrationFt`, `ufcReference`, and `ufcCriteria`.
- **Photo support**: Photos parsed via `parsePhotoPaths()` which handles JSON arrays, plain URLs, and null values.
- **Photo upload**: Direct file upload and camera capture.

### Exports

- **PDF**: `generateObstructionPdf()` in `lib/obstruction-pdf.ts` -- Portrait letter format with OBSTRUCTION EVALUATION REPORT header, pass/violation status badge, object details (height, elevation, coordinates, description), per-surface analysis results table, UFC references, and photos.
- **Email PDF**: Via `EmailPdfModal`.

### Integration Points

- **Daily Ops Report**: Obstruction evaluations for the selected date are included with evaluator names, violation status, and photos.
- **Activity log**: All evaluations logged.
- **Dashboard**: No direct dashboard integration, but violations may trigger discrepancy creation.

### Technical Implementation

| File | Purpose |
|------|---------|
| `app/(app)/obstructions/page.tsx` | Interactive evaluation with Mapbox map |
| `app/(app)/obstructions/[id]/page.tsx` | Evaluation detail/history |
| `lib/calculations/obstructions.ts` | `evaluateObstruction()`, `evaluateObstructionAllRunways()`, `identifySurface()`, `IMAGINARY_SURFACES` definitions |
| `lib/calculations/geometry.ts` | `getRunwayGeometry()`, `pointToRunwayRelation()`, `distanceFt()`, `bearing()`, `offsetPoint()`, `fetchElevation()` |
| `lib/calculations/surface-criteria.ts` | `getSurfaceCriteria()` -- runway-class-specific surface dimensions |
| `lib/supabase/obstructions.ts` | CRUD: `fetchObstructionEvaluations()`, `createObstructionEvaluation()`, `updateObstructionEvaluation()`, `parsePhotoPaths()` |
| `lib/obstruction-pdf.ts` | `generateObstructionPdf()` |
| `components/obstructions/airfield-map.tsx` | Mapbox satellite map with runway overlays |

---

## 8. Aircraft Database

### Purpose & Regulatory Basis

The Aircraft Database provides a comprehensive reference of military and commercial aircraft characteristics sourced from USACE TSC 13-2 (Military) and TSC 13-3 (Commercial). Airfield managers need this data for runway load analysis (ACN/PCN comparison), pavement evaluation, and heavy aircraft operations coordination per UFC 3-260-01 and DAFMAN 13-204.

### User Interface

- **Single page**: `app/(app)/aircraft/page.tsx` -- Searchable, sortable, filterable aircraft catalog. Each aircraft shown as an expandable card with image, key specs, and detailed characteristics. ACN/PCN comparison panel for pavement analysis.
- **Search**: Full-text search across aircraft name and manufacturer.
- **Sort options**: Name (A-Z), Manufacturer, Wingspan, Length, Max Takeoff Weight, Turn Radius -- defined in `SORT_OPTIONS`.
- **Favorites**: Star/unstar aircraft with localStorage persistence via `getFavorites()`/`setFavorites()`. Optional "show favorites first" toggle.
- **Category filter**: Military, Commercial, or All.
- **ACN/PCN comparison panel**: `AcnPcnPanel` component -- select pavement type (rigid/flexible), subgrade category (A/B/C/D), weight mode (max/min), enter airfield PCN value, and get pass/exceed result with color-coded display.

### Data Model

No database tables -- aircraft data is stored as static JSON files:
- `public/commercial_aircraft.json` -- Commercial aircraft characteristics
- `public/military_aircraft.json` -- Military aircraft characteristics
- `public/image_manifest.json` -- Maps aircraft names to image filenames

Data loaded and merged in `lib/aircraft-data.ts` with image URL resolution via `withImage()`.

### Features

- **Comprehensive dataset**: `AIRCRAFT_COUNT.total` aircraft across military and commercial categories.
- **Aircraft characteristics**: Includes `aircraft`, `manufacturer`, `wing_span_ft`, `length_ft`, `height_ft`, `max_to_wt_klbs`, `turn_radius_ft`, `min_turn_radius_ft`, and ACN data tables (`acn` object with rigid/flex + subgrade combinations at max/min weights).
- **ACN/PCN analysis**: Real-time comparison of Aircraft Classification Number (ACN) against Pavement Classification Number (PCN) for any combination of pavement type, subgrade, and weight mode.
- **Aircraft images**: Resolved from `image_manifest.json` to `/aircraft_images/{filename}`.
- **Sorting engine**: `sortAircraft()` and `getSortValue()` handle both string and numeric field sorting with ascending/descending toggle.
- **Formatting helpers**: `fmtNum()` and `fmtWeight()` for display formatting.

### Exports

No direct exports. Data is reference-only.

### Integration Points

- **Checks**: Heavy Aircraft check type records aircraft type/MDS.
- **Obstruction evaluations**: Aircraft wingspan and other characteristics may inform obstruction analysis.

### Technical Implementation

| File | Purpose |
|------|---------|
| `app/(app)/aircraft/page.tsx` | Full aircraft catalog UI with ACN/PCN panel |
| `lib/aircraft-data.ts` | Data loading, sorting, favorites, formatting helpers |
| `lib/aircraft_database_schema.ts` | `AircraftCharacteristics` TypeScript type |
| `public/commercial_aircraft.json` | Commercial aircraft JSON dataset |
| `public/military_aircraft.json` | Military aircraft JSON dataset |
| `public/image_manifest.json` | Aircraft name -> image filename mapping |

---

## 9. Regulations & Reference Library

### Purpose & Regulatory Basis

The Regulations module provides a comprehensive digital library of all publications governing airfield management operations. It contains 70 regulation entries covering the three core DAFMAN 13-204 volumes, 27 direct references, 27 cross-references, and 13 additional publications scrubbed from the DAFMAN volumes. The Library module provides admin-level document management for uploading and sharing PDFs.

### User Interface

- **Regulations page**: `app/(app)/regulations/page.tsx` -- Dual-tab interface ("Regulations" and "My Docs"). The Regulations tab shows a searchable, filterable catalog of all 70 regulation entries. Filters by category (`REGULATION_CATEGORIES`), publication type (`REGULATION_PUB_TYPES`), source section (`REGULATION_SOURCE_SECTIONS`), and core/cross-ref/scrubbed flags. Favorites with localStorage persistence. Inline PDF viewer via `RegulationPDFViewer` component.
- **My Docs tab**: User-uploaded documents via `userDocService` with IndexedDB blob storage (`idbGet`, `idbSet`).
- **Library page**: `app/(app)/library/page.tsx` -- Server-rendered admin-only page (requires `canManageUsers` permission). Uses `PDFLibrary` component for managing shared PDF documents.
- **PDF Viewer**: `RegulationPDFViewer` component (dynamic import) for in-app PDF viewing.

### Data Model

- **Static data**: `ALL_REGULATIONS` array in `lib/regulations-data.ts` -- 70 `RegulationEntry` objects with `reg_id`, `title`, `description`, `publication_date`, `url`, `source_section`, `category`, `pub_type`, `is_core`, `is_cross_ref`, `is_scrubbed`, and `tags`.
- **Supabase Storage**: `regulation-pdfs` bucket for uploaded PDFs.
- **IndexedDB**: `STORE_BLOBS` and `STORE_USER_BLOBS` for offline-cached regulation PDFs and user documents.
- **User documents**: Managed by `userDocService` from `lib/userDocuments.ts`.

### Features

- **70 regulation entries** organized into:
  - 3 Core Publications (DAFMAN 13-204 Vols. 1-3)
  - 27 Direct References (UFC, ETL, AFI, AFMAN publications)
  - 27 Cross-References (DoD, FAA, NFPA, IEEE standards)
  - 13 Scrubbed from Volumes 1-3 (additional references found in text)
- **Category filtering**: airfield_ops, airfield_mgmt, fire_protection, engineering, safety, environmental, etc.
- **Publication type filtering**: DAF, DoD, UFC, FAA, NFPA, IEEE, etc.
- **Full-text search**: Searches across `reg_id`, `title`, `description`, and `tags`.
- **Favorites**: Star regulations with localStorage persistence. Optional "show favorites only" default.
- **Offline PDF caching**: Downloaded PDFs cached in IndexedDB for offline access.
- **In-app PDF viewer**: `RegulationPDFViewer` renders PDFs without leaving the app.
- **User document uploads**: Upload personal PDFs to IndexedDB with metadata.
- **File size display**: `formatFileSize()` utility for human-readable sizes.

### Exports

No exports. Reference-only module.

### Integration Points

- **Settings**: Regulations library section in Settings allows managing offline cached PDFs.
- **ACSI**: ACSI checklist items reference specific regulation paragraphs.
- **Waivers**: Waiver criteria reference UFC and DAFMAN paragraphs.

### Technical Implementation

| File | Purpose |
|------|---------|
| `app/(app)/regulations/page.tsx` | Dual-tab regulations browser with search, filters, favorites |
| `app/(app)/library/page.tsx` | Admin-only PDF library (server component with role check) |
| `lib/regulations-data.ts` | `ALL_REGULATIONS` -- 70 `RegulationEntry` objects |
| `components/RegulationPDFViewer.tsx` | In-app PDF viewer (dynamic import) |
| `components/PDFLibrary.tsx` | Admin PDF management component |
| `lib/userDocuments.ts` | User document service with IndexedDB storage |
| `lib/idb.ts` | IndexedDB helpers: `idbGet`, `idbSet`, `idbDelete`, `idbClear` |

---

## 10. Waiver Management

### Purpose & Regulatory Basis

The Waiver Management module tracks airfield waivers and deviations per DAFMAN 13-204 Vol. 1 (waiver process) and UFC 3-260-01 (criteria being waived). Airfield waivers document deviations from UFC criteria that cannot be immediately corrected, with associated risk assessments, corrective actions, review schedules, and coordination chains. The module supports the full lifecycle from draft through approval, annual review, and expiration.

### User Interface

- **List page**: `app/(app)/waivers/page.tsx` -- Dual-view (list + map). KPI badges for Permanent, Temporary, Expiring (<365 days), and Overdue Review counts. Filter by status (draft/pending/approved/active/completed/expired/cancelled). Search by waiver number, description, criteria impact, or proponent. Lazy-loaded `WaiverMapView` for geo-pinned waivers.
- **Detail page**: `app/(app)/waivers/[id]/page.tsx` -- Full waiver detail with criteria references, review history, coordination chain, attachments, and photos.
- **Create/Edit pages**: `app/(app)/waivers/new/page.tsx` and edit functionality within detail page.

### Data Model

**Primary table**: `waivers`

| Column | Type | Description |
|--------|------|-------------|
| `waiver_number` | text | Unique waiver identifier |
| `classification` | enum | permanent, temporary |
| `status` | enum | draft, pending, approved, active, completed, cancelled, expired |
| `hazard_rating` | enum | Hazard risk classification |
| `action_requested` | enum | Action type requested |
| `description` | text | Waiver description |
| `justification` | text | Justification for waiver |
| `risk_assessment_summary` | text | Risk assessment details |
| `corrective_action` | text | Planned corrective action |
| `criteria_impact` | text | Affected criteria |
| `proponent` | text | Responsible party |
| `project_number` / `program_fy` / `estimated_cost` / `project_status` | various | Project tracking |
| `faa_case_number` | text | FAA coordination case number |
| `period_valid` | text | Validity period |
| `date_submitted` / `date_approved` / `expiration_date` | date | Key dates |
| `last_reviewed_date` / `next_review_due` | date | Review tracking |
| `location_description` / `location_lat` / `location_lng` | text/numeric | Location info |

**Supporting tables**:
- `waiver_criteria` -- `criteria_source` (ufc_3_260_01, ufc_3_260_04, ufc_3_535_01, other), `reference`, `description`, `sort_order`
- `waiver_reviews` -- Annual review records with `review_year`, `review_date`, `recommendation` (retain/modify/cancel/convert), `reviewer_name`, `notes`
- `waiver_coordination` -- Coordination chain with `office` (civil_engineer, airfield_manager, airfield_ops_terps, base_safety, installation_cc), `status`, `notes`
- `waiver_attachments` -- Supporting documents with `file_path`, `file_name`, `file_type`, `caption`

### Features

- **Full lifecycle tracking**: Draft -> Pending -> Approved -> Active -> Completed/Expired/Cancelled.
- **Permanent vs. Temporary classification**: Distinct KPI tracking and review requirements.
- **Expiration monitoring**: "Expiring" KPI shows waivers expiring within 365 days.
- **Annual review tracking**: "Overdue Review" KPI shows waivers past their `next_review_due` date.
- **Multi-criteria references**: Each waiver can reference multiple UFC/DAFMAN criteria.
- **Coordination chain**: Track coordination status across multiple offices.
- **Review history**: Annual review records with recommendations.
- **Attachments**: Support documents, photos, and correspondence.
- **Map view**: Geo-pinned waivers on Mapbox satellite map.

### Exports

- **Waiver PDF**: `generateWaiverPdf()` in `lib/waiver-pdf.ts` -- Detail PDF with waiver information, criteria table, coordination chain, review history, attachments list, and photos. Uses jspdf-autotable.
- **Waiver Register Excel**: `generateWaiverExcel()` in `lib/waiver-export.ts` -- Multi-sheet workbook with Waiver Register (all waivers), Criteria Details, and Review History sheets.
- **Email PDF**: Via `EmailPdfModal`.

### Integration Points

- **Regulations**: Criteria sources reference UFC and DAFMAN publications.
- **Obstruction evaluations**: Violations may require waivers.
- **Activity log**: All waiver operations logged.

### Technical Implementation

| File | Purpose |
|------|---------|
| `app/(app)/waivers/page.tsx` | List page with dual-view and KPIs |
| `app/(app)/waivers/[id]/page.tsx` | Detail page |
| `app/(app)/waivers/new/page.tsx` | Create page |
| `lib/supabase/waivers.ts` | CRUD for waivers, criteria, reviews, coordination, attachments |
| `lib/waiver-pdf.ts` | `generateWaiverPdf()` |
| `lib/waiver-export.ts` | `generateWaiverExcel()` |
| `components/waivers/waiver-map-view.tsx` | Mapbox map for geo-pinned waivers |

---

## 11. NOTAMs

### Purpose & Regulatory Basis

The NOTAMs (Notices to Airmen) module tracks both FAA-published NOTAMs and locally-issued NOTAMs per DAFMAN 13-204 Vol. 2 NOTAM procedures. Airfield managers must maintain awareness of all active NOTAMs affecting their installation and issue local NOTAMs for runway closures, NAVAID outages, and other airfield changes.

### User Interface

- **List page**: `app/(app)/notams/page.tsx` -- Card-based list with filter tabs (All, FAA, LOCAL, Active, Expired). Each NOTAM card shows source badge (FAA in cyan, LOCAL in purple), status badge (Active in green, Expired in gray), NOTAM number, type, title, full text (expandable), effective dates, and expiring-soon warning (within 24 hours).
- **Create page**: `app/(app)/notams/new/page.tsx` -- Form for creating local NOTAMs.

### Data Model

**Table**: `notams`

| Column | Type | Description |
|--------|------|-------------|
| `notam_number` | text | NOTAM identifier |
| `source` | enum | faa, local |
| `status` | enum | active, expired |
| `notam_type` | text | NOTAM type/category |
| `title` | text | NOTAM title |
| `full_text` | text | Complete NOTAM text |
| `effective_start` | text | Start date/time (FAA format or ISO) |
| `effective_end` | text | End date/time (FAA format, ISO, or "PERM") |

### Features

- **FAA NOTAM sync**: `/api/notams/sync` API endpoint fetches NOTAMs from FAA by ICAO code and upserts to the database.
- **Expiring-soon detection**: `isExpiringSoon()` checks if a NOTAM expires within 24 hours. Visual warning indicator on cards.
- **Expiring NOTAM count hook**: `useExpiringNotamCount()` in `lib/use-expiring-notams.ts` -- polls every 5 minutes for FAA NOTAMs expiring within 24 hours. Returns count for use in navigation badges.
- **FAA date parsing**: `parseFaaDate()` handles FAA's `MM/DD/YYYY HHMM` date format and converts to JavaScript Date objects.
- **PERM handling**: NOTAMs with "PERM" effective end are treated as permanent and never expire.
- **PDF export**: List export with filtering applied.
- **Email PDF**: Via `EmailPdfModal`.

### Exports

- **List PDF**: Generated inline in the page using jsPDF with filtered NOTAM data.
- **Email PDF**: Via `sendPdfViaEmail()`.

### Integration Points

- **Discrepancies**: `notam_reference` field on discrepancies links to associated NOTAMs. `linked_notam_id` FK for direct linking.
- **Navigation**: Expiring NOTAM count badge in the navigation via `useExpiringNotamCount()`.
- **QRC**: QRC procedures may require issuing NOTAMs.

### Technical Implementation

| File | Purpose |
|------|---------|
| `app/(app)/notams/page.tsx` | NOTAM list with filtering, date formatting, export |
| `app/(app)/notams/new/page.tsx` | Local NOTAM creation |
| `lib/use-expiring-notams.ts` | `useExpiringNotamCount()` hook -- polls for expiring FAA NOTAMs |
| `app/api/notams/sync/route.ts` | FAA NOTAM sync API endpoint |

---

## 12. Events Log (Activity)

### Purpose & Regulatory Basis

The Events Log serves as the digital equivalent of the AF Form 3616 (Daily Record of Facility Operation) required by DAFMAN 13-204 Vol. 2. It provides a chronological record of all airfield activity including system-generated entries (from inspections, checks, discrepancies, runway status changes, etc.) and manual entries written by airfield managers.

### User Interface

- **Dedicated page**: `app/(app)/activity/page.tsx` -- Full activity log with period presets (Today, 7 Days, 30 Days, Custom date range). Filterable list showing all activity entries with timestamps, user attribution (name, rank, role, masked EDIPI), action descriptions, and expandable metadata. Supports manual entry creation with a template picker.
- **Dashboard integration**: `app/(app)/dashboard/page.tsx` -- Embedded activity feed showing recent entries with quick manual entry form and template picker.
- **Template picker**: `TemplatePicker` component from `components/ui/template-picker.tsx` provides pre-built activity entry templates organized by category.

### Data Model

**Primary table**: `activity_log`

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | UUID FK | User who performed the action |
| `action` | text | Action type: created, updated, deleted, completed, opened, closed, status_updated, saved, filed, resumed, reviewed, noted, logged_personnel, personnel_off_airfield, cancelled |
| `entity_type` | text | Entity category: discrepancy, check, inspection, obstruction_evaluation, navaid_status, airfield_status, arff_status, contractor, qrc, manual, waiver |
| `entity_id` | UUID | ID of the affected entity (must be valid UUID) |
| `entity_display_id` | text | Human-readable ID of the entity |
| `metadata` | JSONB | Rich action-specific metadata |
| `base_id` | UUID FK | Installation context |
| `created_at` | timestamp | When the entry was created |

### Features

- **Automatic logging**: `logActivity()` in `lib/supabase/activity.ts` is called by all CRUD operations across the app. Captures `user_id`, `action`, `entity_type`, `entity_id`, `entity_display_id`, and `metadata`.
- **Rich metadata**: Each activity type includes specific metadata:
  - Discrepancies: title, type, location, severity, status changes, resolution notes
  - Checks: check_type, areas, all data fields, comments
  - Inspections: type, BWC, RSC, RCR, failed items, discrepancy notes
  - Runway status: old/new status, advisory changes
  - QRC: QRC number, title
- **Manual entries**: `logManualEntry()` creates entries with `action: 'noted'` and `entity_type: 'manual'`. Supports edit and delete via `updateActivityEntry()` and `deleteActivityEntry()`.
- **Activity templates**: `ACTIVITY_TEMPLATES` in `lib/activity-templates.ts` -- Organized by category (Inspections/Checks, Runway Operations, Communications, etc.) with field interpolation. Fields support types: text, textarea, toggle-list. Shared fields like `initials` and `callsign` (with defaults like "AFLD3/" and "TWR/").
- **Period filtering**: Today, 7 days, 30 days, or custom date range. Queries use `startDate` and `endDate` parameters.
- **User attribution**: Activity entries join to `profiles` table for `name`, `rank`, `role`, `edipi`. EDIPI masked with `maskEdipi()` (shows only last 4 digits).
- **Entity linking**: `getEntityLink()` maps entity types to detail page URLs for click-through navigation.
- **Action formatting**: `formatAction()` produces human-readable descriptions with entity type labels and display IDs.
- **Acronym handling**: Known acronyms (FOD, IFE, RSC, etc.) auto-uppercased in display.

### Exports

Activity data is included in the Daily Ops Report PDF as the "Events Log" section.

### Integration Points

- **Every module**: All CRUD operations call `logActivity()`.
- **Dashboard**: Activity feed on the operations dashboard.
- **Daily Ops Report**: Activity entries for the selected date included in the Events Log section.

### Technical Implementation

| File | Purpose |
|------|---------|
| `app/(app)/activity/page.tsx` | Dedicated activity log page with filtering and manual entry |
| `lib/supabase/activity.ts` | `logActivity()`, `logManualEntry()`, `updateActivityEntry()`, `deleteActivityEntry()` |
| `lib/supabase/activity-queries.ts` | `fetchActivityLog()` with profile joins and fallback |
| `lib/activity-templates.ts` | `ACTIVITY_TEMPLATES` -- categorized entry templates with field interpolation |
| `components/ui/template-picker.tsx` | Template selection UI component |

---

## 13. User Management

### Purpose & Regulatory Basis

User Management provides role-based access control for the Glidepath platform. Per DAFMAN 13-204 Vol. 1, access to airfield management systems must be controlled and audited. The module supports user invitation, profile management, role assignment, password resets, and user deletion with proper FK cleanup.

### User Interface

- **User list page**: `app/(app)/users/page.tsx` -- Admin-only page with installation selector, search/filter bar, and user card grid. Each card shows name, rank, role, status (active/deactivated), last seen timestamp, and base assignment.
- **Components**:
  - `InstallationSelector` -- Filter users by installation
  - `UserFilters` -- Search and role filtering
  - `UserList` -- Grid of `UserCard` components
  - `UserDetailModal` -- View/edit user profile (name, rank, role, email with eye-toggle mask, EDIPI, base assignment)
  - `InviteUserModal` -- Invite new users with email, rank, name, role, and installation
  - `DeleteConfirmationDialog` -- Confirm user deletion with FK cleanup warning

### Data Model

**Primary table**: `profiles`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | Matches auth.users.id |
| `email` | text | User email |
| `name` | text | Legacy full name |
| `first_name` / `last_name` | text | Split name fields |
| `rank` | text | Military rank |
| `role` | enum | sys_admin, base_admin, airfield_manager, namo, inspector, operator, read_only |
| `edipi` | text | DoD ID number |
| `primary_base_id` | UUID FK | Home installation |
| `is_active` | boolean | Account status |
| `last_seen_at` | timestamp | Last activity timestamp |

### Features

- **Role hierarchy** (defined in `USER_ROLES` from `lib/constants.ts`):
  - `sys_admin` -- Full system access, can manage users across all bases
  - `base_admin` -- Base-level admin
  - `airfield_manager` -- Full operational access, can manage users
  - `namo` -- NAMO-level oversight
  - `inspector` -- Inspection and check capabilities
  - `operator` -- Basic operational access
  - `read_only` -- View-only access
- **User invitation**: `inviteUser()` via `/api/admin/invite` API route. Creates auth user and profile.
- **Password reset**: `resetUserPassword()` via `/api/admin/reset-password`.
- **Profile update**: `updateUserProfile()` via `PATCH /api/admin/users/[id]`.
- **User deletion**: `deleteUser()` via `DELETE /api/admin/users/[id]`. Must nullify 12 FK columns across 10 tables before deleting profile and auth records. Handles: `discrepancies.reported_by`, `discrepancies.assigned_to`, `inspections.inspector_id`, `inspections.completed_by_id`, `inspections.filed_by_id`, `airfield_checks.saved_by_id`, `obstruction_evaluations.evaluated_by`, `acsi_inspections.inspector_id`, `acsi_inspections.completed_by_id`, `activity_log.user_id`, `photos.uploaded_by`, `status_updates.updated_by`.
- **Email privacy**: Email hidden on user cards, masked with eye toggle in edit modal.
- **Installation filtering**: `loadUsers()` supports filtering by `primary_base_id`.
- **Name parsing**: Handles both legacy `name` column and split `first_name`/`last_name` columns.

### Exports

No direct exports.

### Integration Points

- **RLS**: Row-Level Security policies reference `user_has_base_access()`, `user_can_write()`, `user_is_admin()` helper functions.
- **All modules**: User profiles used for attribution (inspector names, reporter names, etc.).
- **Activity log**: User actions logged with user_id.

### Technical Implementation

| File | Purpose |
|------|---------|
| `app/(app)/users/page.tsx` | User management page with `loadUsers()` |
| `lib/admin/user-management.ts` | Client-side wrappers: `inviteUser()`, `resetUserPassword()`, `updateUserProfile()`, `deleteUser()` |
| `app/api/admin/invite/route.ts` | User invitation API |
| `app/api/admin/reset-password/route.ts` | Password reset API |
| `app/api/admin/users/[id]/route.ts` | PATCH (update) and DELETE (with FK cleanup) |
| `components/admin/installation-selector.tsx` | Installation filter component |
| `components/admin/user-filters.tsx` | Search and role filter component |
| `components/admin/user-list.tsx` | User card grid |
| `components/admin/user-card.tsx` | Individual user card with `UserCardData` type |
| `components/admin/user-detail-modal.tsx` | View/edit user modal |
| `components/admin/invite-user-modal.tsx` | New user invitation modal |
| `components/admin/delete-confirmation-dialog.tsx` | Delete confirmation with warning |

---

## 14. QRC -- Quick Reaction Checklists

### Purpose & Regulatory Basis

Quick Reaction Checklists (QRCs) are step-by-step emergency and operational response procedures required by DAFMAN 13-204 Vol. 2 and Vol. 3. They provide standardized responses for In-Flight Emergencies, Aircraft Mishaps, Bird/Wildlife Strikes, Runway Closures, Bomb Threats, Active Shooter events, Severe Weather, and other critical scenarios. The module supports template management, real-time execution tracking, and Secondary Crash Net (SCN) data forms.

### User Interface

- **Single page**: `app/(app)/qrc/page.tsx` -- Three-tab interface:
  - **Available**: Grid of QRC templates with start button, review status, and overdue indicators
  - **Active**: Live execution view showing checklist steps with real-time response tracking
  - **History**: Completed/closed QRC executions with timestamps and step responses
- **Deep linking**: `?exec={id}` URL parameter jumps directly to an active execution.
- **Step types**: checkbox, checkbox_with_note, notify_agencies (multi-select), conditional (cross-reference to other QRCs), time_field (Zulu time entry).
- **SCN form**: Secondary Crash Net data form with configurable fields (aircraft type, callsign, tail number, souls on board, fuel, nature of emergency, etc.).

### Data Model

**Templates table**: `qrc_templates`

| Column | Type | Description |
|--------|------|-------------|
| `base_id` | UUID FK | Installation |
| `qrc_number` | int | QRC number (e.g., 1 for IFE/GE) |
| `title` | text | QRC title |
| `notes` | text | Warnings or procedural notes |
| `steps` | JSONB | Array of `QrcStep` objects |
| `references` | text | Regulatory references |
| `has_scn_form` | boolean | Whether this QRC includes an SCN data form |
| `scn_fields` | JSONB | SCN form field definitions |
| `is_active` | boolean | Template status |
| `sort_order` | int | Display order |
| `last_reviewed_at` / `last_reviewed_by` / `review_notes` | timestamp/UUID/text | Annual review tracking |

**Executions table**: `qrc_executions`

| Column | Type | Description |
|--------|------|-------------|
| `base_id` | UUID FK | Installation |
| `template_id` | UUID FK | Source template |
| `qrc_number` | int | QRC number |
| `title` | text | QRC title at time of execution |
| `status` | enum | open, closed |
| `opened_by` / `opened_at` / `open_initials` | UUID/timestamp/text | Who opened |
| `closed_by` / `closed_at` / `close_initials` | UUID/timestamp/text | Who closed |
| `step_responses` | JSONB | `Record<stepId, QrcStepResponse>` -- per-step completion data |
| `scn_data` | JSONB | SCN form field values |

### Features

- **Seed data**: `QRC_SEED_DATA` in `lib/qrc-seed-data.ts` provides 10+ pre-built QRC templates covering: IFE/GE, Aircraft Mishap, BASH Strike, Runway Closure, Bomb Threat, Active Shooter, Severe Weather, Unauthorized Airfield Entry, HAZMAT Spill, and more.
- **Template seeding**: `seedQrcTemplates()` inserts seed data for a base, skipping existing QRC numbers. Supports selective seeding with `selectedNumbers` parameter.
- **Template CRUD**: `createQrcTemplate()`, `updateQrcTemplate()`, `deleteQrcTemplate()` for admin template management.
- **Annual review**: `reviewQrcTemplate()` updates `last_reviewed_at`, `last_reviewed_by`, `review_notes`. `isReviewOverdue()` checks if >365 days since last review.
- **Execution lifecycle**: `startQrcExecution()` -> `updateStepResponse()` / `updateScnData()` -> `closeQrcExecution()`. Supports `reopenQrcExecution()` and `cancelQrcExecution()`.
- **Step response tracking**: Each step response includes completion status, notes, and timestamp.
- **SCN data form**: Configurable fields defined per template. Data persisted in `scn_data` JSONB column.
- **Cross-QRC references**: Conditional steps can reference other QRC numbers (e.g., "If mishap occurs, transition to QRC-2").
- **Activity logging**: Open/close/cancel operations logged to activity_log.
- **Zulu time**: `zuluNow()` helper for recording times in UTC/Zulu format.

### Exports

QRC execution data is included in the Daily Ops Report PDF as a dedicated "QRC" section.

### Integration Points

- **Daily Ops Report**: QRC executions for the selected date included with step responses and SCN data.
- **Activity log**: Open, close, and cancel operations logged.
- **Events log**: QRC activities appear in the main events log.
- **Base Configuration**: QRC templates managed via the base-setup page.

### Technical Implementation

| File | Purpose |
|------|---------|
| `app/(app)/qrc/page.tsx` | Three-tab QRC page (Available/Active/History) |
| `lib/supabase/qrc.ts` | Full CRUD: `fetchQrcTemplates()`, `createQrcTemplate()`, `updateQrcTemplate()`, `reviewQrcTemplate()`, `deleteQrcTemplate()`, `seedQrcTemplates()`, `startQrcExecution()`, `fetchOpenExecutions()`, `fetchExecutionHistory()`, `updateStepResponse()`, `updateScnData()`, `closeQrcExecution()`, `reopenQrcExecution()`, `cancelQrcExecution()` |
| `lib/qrc-seed-data.ts` | `QRC_SEED_DATA` -- 10+ pre-built QRC templates |

---

## 15. Shift Checklist

### Purpose & Regulatory Basis

The Shift Checklist module provides a daily task management system for airfield management shift operations. Per DAFMAN 13-204 Vol. 2, airfield management sections must maintain shift change procedures and ensure all required daily, weekly, and monthly tasks are completed. The checklist is organized by shift (Day, Mid, Swing) with frequency-based item visibility.

### User Interface

- **Single page**: `app/(app)/shift-checklist/page.tsx` -- Two tabs (Today, History).
  - **Today tab**: Shows all applicable checklist items grouped by shift (Day/Mid/Swing). Each item displays frequency badge (Daily in cyan, Weekly in purple, Monthly in amber), checkbox, optional notes field, and completion attribution (who completed and when). "Complete All Shifts" button to finalize the day's checklist.
  - **History tab**: List of past checklists with completion status, date, and who completed. Click to view historical responses.
- **Checklist items organized by shift**: `dayItems`, `midItems`, `swingItems` computed from `items.filter(i => i.shift === 'day')` etc.

### Data Model

**Template items table**: `shift_checklist_items`

| Column | Type | Description |
|--------|------|-------------|
| `base_id` | UUID FK | Installation |
| `label` | text | Task description |
| `shift` | enum | day, mid, swing |
| `frequency` | enum | daily, weekly, monthly |
| `sort_order` | int | Display order |
| `is_active` | boolean | Whether item is active |

**Daily checklists table**: `shift_checklists`

| Column | Type | Description |
|--------|------|-------------|
| `base_id` | UUID FK | Installation |
| `checklist_date` | date | Effective date |
| `status` | enum | in_progress, completed |
| `completed_by` | UUID FK | Who finalized |
| `completed_at` | timestamp | When finalized |

**Responses table**: `shift_checklist_responses`

| Column | Type | Description |
|--------|------|-------------|
| `checklist_id` | UUID FK | Parent checklist |
| `item_id` | UUID FK | Checklist item |
| `completed` | boolean | Whether completed |
| `completed_by` | UUID FK | Who completed this item |
| `completed_at` | timestamp | When completed |
| `notes` | text | Optional notes |

### Features

- **Timezone-aware date logic**: `getEffectiveChecklistDate()` calculates the effective checklist date based on the installation's timezone and configurable reset time (default 06:00). If current time is before the reset time, the checklist belongs to the previous calendar day.
- **Frequency-based visibility**: `itemAppliesToday()` determines which items appear:
  - `daily`: Always shown
  - `weekly`: Shown on Mondays only
  - `monthly`: Shown on the 1st of the month only
- **Auto-create today's checklist**: `fetchOrCreateTodayChecklist()` creates a new checklist row for the effective date if one does not exist.
- **Per-item completion**: `upsertResponse()` upserts on `(checklist_id, item_id)` unique constraint. Records who completed each item and when.
- **Checklist finalization**: `completeChecklist()` sets status to completed with `completed_by` and `completed_at`.
- **Reopen support**: `reopenChecklist()` reverts status to in_progress and clears completion fields.
- **History viewing**: `fetchChecklistHistory()` returns the last 30 checklists. Historical responses viewable with full attribution.
- **Profile name resolution**: Loads profile names for all `completed_by` user IDs for display.
- **Admin configuration**: Items managed via the Base Setup page (shift-checklist tab) with CRUD operations: `createChecklistItem()`, `updateChecklistItem()`, `deleteChecklistItem()`.

### Exports

No direct exports. Checklist data available for reporting.

### Integration Points

- **Base Configuration**: Checklist items managed in `settings/base-setup` page.
- **Installation context**: Uses `timezone` and `checklist_reset_time` from `currentInstallation`.

### Technical Implementation

| File | Purpose |
|------|---------|
| `app/(app)/shift-checklist/page.tsx` | Today + History tabs with per-item completion |
| `lib/supabase/shift-checklist.ts` | Full CRUD: `fetchChecklistItems()`, `createChecklistItem()`, `updateChecklistItem()`, `deleteChecklistItem()`, `fetchOrCreateTodayChecklist()`, `fetchChecklistHistory()`, `completeChecklist()`, `reopenChecklist()`, `fetchResponses()`, `upsertResponse()`, `itemAppliesToday()`, `getEffectiveChecklistDate()` |

---

## 16. Settings & Base Configuration

### Purpose & Regulatory Basis

Settings and Base Configuration provide system administration for the Glidepath platform. Base configuration implements the installation-specific parameters required by DAFMAN 13-204 including runway geometry, NAVAID inventory, airfield areas, ARFF aircraft, CE shop assignments, inspection templates, shift checklist items, and QRC templates.

### User Interface

- **Settings page**: `app/(app)/settings/page.tsx` -- Collapsible sections:
  - **Profile**: Edit name, rank, email. Display role.
  - **Installation**: Switch active installation, view installation details.
  - **Data & Storage**: IndexedDB usage, clear cached data.
  - **Regulations Library**: Manage offline-cached regulation PDFs.
  - **Base Configuration**: Link to base-setup page (admin only).
  - **Appearance**: Theme selection (Light/Dark/System) via `useTheme()`.
  - **About**: Version (v2.16.1), build info, and credits.
  - **Sign Out**: Supabase auth signout.

- **Base Setup page**: `app/(app)/settings/base-setup/page.tsx` (~1,856 lines, second-largest file) -- Admin-only page with 8 tabs:
  - **Runways**: Configure runway geometry (end coordinates, designators, length, width, heading, elevation, class).
  - **NAVAIDs**: Manage NAVAID inventory with status tracking.
  - **Areas**: Configure airfield areas (used in discrepancy locations, check areas, inspection templates).
  - **ARFF Aircraft**: Manage ARFF vehicle fleet with readiness tracking.
  - **CE Shops**: Configure Civil Engineering shop assignments for discrepancy routing.
  - **Templates**: Link to inspection template management page.
  - **Shift Checklist**: Configure shift checklist items with label, shift, frequency, and sort order.
  - **QRC Templates**: Manage and seed QRC templates.

- **Template Management page**: `app/(app)/settings/templates/page.tsx` -- Airfield and Lighting inspection template editor. Supports section and item CRUD, reordering, conditional section toggling, and default template creation via `createDefaultTemplate()`.

### Data Model

The settings pages manage data across multiple tables:
- `installations` -- Base info (name, ICAO, timezone, elevation, checklist_reset_time)
- `runways` -- Per-installation runway geometry
- `navaids` / `navaid_statuses` -- NAVAID configuration and status
- `installation_areas` -- Airfield area definitions
- `arff_aircraft` -- ARFF vehicle inventory
- `ce_shops` -- CE shop assignments
- `inspection_template_sections` / `inspection_template_items` -- Custom inspection checklists
- `shift_checklist_items` -- Shift task definitions
- `qrc_templates` -- QRC template library
- `profiles` -- User profile data

### Features

- **Multi-installation support**: `useInstallation()` provides `installationId`, `currentInstallation`, `areas`, `userRole`, `ceShops`, `arffAircraft`, `allInstallations`, `switchInstallation`. Installation switcher in the header.
- **Role-gated access**: Base configuration requires `airfield_manager`, `sys_admin`, `base_admin`, or `namo` role.
- **Runway configuration**: Full runway geometry (end1/end2 coordinates, designators, length, width, true heading, per-end elevation MSL, runway class). Used by obstruction evaluation calculations and map displays.
- **Airfield diagram management**: Upload/view/delete airfield diagrams stored in Supabase Storage (`photos` bucket, path `airfield-diagrams/{baseId}/diagram`) with IDB fallback for demo mode. Managed via `saveAirfieldDiagram()`, `getAirfieldDiagram()`, `deleteAirfieldDiagram()`.
- **Installation creation**: `createInstallation()` from `lib/supabase/installations.ts`. Base directory (`BASE_DIRECTORY`) provides pre-configured installation data.
- **Theme support**: Three modes (Light, Dark, System) via `useTheme()` from `lib/theme-context.ts`. CSS variables adapt to selected theme.
- **Inspection template CRUD**: `fetchInspectionTemplate()`, `createDefaultTemplate()`, `updateTemplateItem()`, `addTemplateItem()`, `deleteTemplateItem()`, `addTemplateSection()`, `deleteTemplateSection()`, `updateTemplateSection()`, `reorderTemplateItems()`, `reorderTemplateSections()`.
- **Default PDF email**: `defaultPdfEmail` and `updateDefaultPdfEmail` from `useInstallation()` for pre-filling email export modals.
- **Version tracking**: Version string maintained in 3 places: `package.json`, `login/page.tsx` (footer), `settings/page.tsx` (About section).

### Exports

No direct exports. Configuration data consumed by all other modules.

### Integration Points

- **All modules**: Installation context (areas, runways, shops, ARFF, timezone) consumed by every module.
- **Inspections**: Custom templates from template management override default checklists.
- **Obstruction evaluations**: Runway geometry drives surface calculations.
- **Dashboard**: NAVAID status, ARFF aircraft, and runway configuration.
- **Shift Checklist**: Item definitions managed here.
- **QRC**: Template library managed here.

### Technical Implementation

| File | Purpose |
|------|---------|
| `app/(app)/settings/page.tsx` | Settings hub with collapsible sections |
| `app/(app)/settings/base-setup/page.tsx` | Base configuration with 8 tabs (~1,856 lines) |
| `app/(app)/settings/templates/page.tsx` | Inspection template editor |
| `lib/installation-context.tsx` | `InstallationProvider` and `useInstallation()` hook |
| `lib/supabase/installations.ts` | Installation CRUD and NAVAID queries |
| `lib/supabase/inspection-templates.ts` | Template section/item CRUD and reordering |
| `lib/airfield-diagram.ts` | Diagram upload/fetch/delete with Storage + IDB fallback |
| `lib/theme-context.ts` | Theme management (Light/Dark/System) |
| `lib/base-directory.ts` | Pre-configured installation data directory |

---

*Glidepath Component Capabilities Reference -- v2.16.1 -- March 2026*
*Built by MSgt Chris Proctor, 127th Wing Airfield Management, Selfridge ANGB (KMTC)*
