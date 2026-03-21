# Changelog

All notable changes to Glidepath.

## [Unreleased]

### Planned
- METAR weather API integration (aviationweather.gov)
- NOTAM persistence (draft form does not save to DB)
- Unit and integration testing
- Regenerate Supabase types (`supabase gen types typescript`) to eliminate remaining ~169 `as any` casts
- Extract shared PDF utilities (`lib/pdf-utils.ts`) to reduce boilerplate across 16 PDF generators
- Training Management Module (DAF training records)
- Outage analytics (frequency/duration tracking for lighting systems)

---

## [2.26.0] — 2026-03-20

### UI Revamp — Design Token System
- **CSS design tokens** — extracted hardcoded colors, radii, z-index, and spacing into CSS custom properties across all 63 modified files
- **Reusable UI components** — `PageHeader`, `EmptyState`, `LoadingState`, `DetailGrid`, `ConfirmDialog` extracted and applied across pages
- **Badge component fix** — properly handles CSS variable values for background/color props
- **Light mode contrast** — fixed multiple contrast issues across dark/light themes

### Bug Fixes
- **QRC number badge readability** — fixed dark mode text invisible on orange badges (hardcoded `#fff`)
- **Sidebar double-highlighting** — `/obstructions/history` no longer also highlights `/obstructions` (more-specific-route detection)
- **Reports time period selector** — fixed black text on cyan background in light mode (now `#fff`)
- **Analytics avg times** — exclude sub-1-minute entries (instant file/complete) from average calculations
- **NAVAID status sync from inspections** — marking a light failed in inspection now calls `updateFeatureStatus()` to mark it inoperative on the Visual NAVAIDs page
- **Discrepancy detail duplicate maps** — pinned location map hidden when system overview map is shown
- **Discrepancy titles natural language** — auto-generated titles from inspection failures now use `formatFeatureType()` with location context (e.g., "TWY B Edge Light Out of Service" instead of "TWY_B_EDGELIGHTS — Inoperative")
- **One-per-day timezone fix** — inspection date now uses installation timezone with 0600L reset consistently, fixing guard bypass when browser timezone differs
- **Personnel card overflow** — fixed scaling at narrow widths with flex-wrap and overflow hidden

### Access Control
- **Inspection Resume/Delete restricted** — only the inspector who created an in-progress inspection can Resume or Delete it

### Wording Changes
- **"Out of Service"** replaces "Inoperative" / "marked inoperative" in all auto-generated discrepancy titles and comments
- **Singular feature names** — "TWY B Edge Light" instead of "TWY B Edge Lights" for single-feature discrepancies

---

## [2.25.0] — 2026-03-19

### Features — Configurable Discrepancy PDF Exports
- **Shared PDF configuration** (`lib/pdf-config.ts`) — consolidated status labels, type abbreviations, photo helpers, column definitions, and `buildDiscrepancyTable()` core builder used across all 3 discrepancy PDF generators
- **PDF Export Dialog** (`components/ui/pdf-template-selector.tsx`) — modal dialog with column toggles, named template save/load (localStorage), triggered by PDF/Email buttons on discrepancy list, open discrepancies report, and aging discrepancies report
- **Basic columns** (W/O#, Title, Status, Location) always included; optional columns (Type, Shop, Days, Reported By, Last Update, Comments, Photos) toggled on/off
- **Type abbreviation** — "Lighting Outage/Deficiency" → "Lighting", etc.
- **ID column removed** from all discrepancy exports
- **Photo compression** — all PDF photo thumbnails compressed to 400px max / 0.6 JPEG quality (down from raw full-resolution), reducing a 69-discrepancy export from 88MB to ~5-10MB
- **Unicode sanitization** — `sanitizePdfText()` replaces arrows (►, →, ←), smart quotes, em dashes, and other glyphs that cause garbled text in jsPDF's Helvetica font

### Features — Inspection One-Per-Day Enforcement
- **Hard lock** — only one airfield inspection and one lighting inspection per day per type
- **0600L daily reset** — "today" determined by installation timezone, resetting at 0600 local to align with airfield opening
- **In-progress blocking** — if another user has an inspection in progress, the KPI badge shows their name with an orange lock icon; clicking shows a modal explaining who has it and to coordinate with them
- **Completed blocking** — if today's inspection is already filed, a modal explains it's complete and directs to "Reopen for Editing" from the inspection report, with a "View Report" button linking directly to it
- **Confirmation dialog** — "Are you sure you want to start an inspection and log yourself on the airfield?" prompt before starting any new inspection
- **Cross-user draft isolation** — draft sync no longer loads other users' in-progress inspections into the current user's state
- **Dashboard Quick Actions** — Airfield/Lighting badges now reflect 3 states (not started, in progress with inspector name, completed) using same 0600L reset; always link to `/inspections` instead of bypassing guards with `?action=begin`
- **URL guard** — `?action=begin` auto-start also checks for existing inspections before allowing

### Features — Parking Module Enhancements
- **Full editing context menu** — right-click on aircraft shows Spot Name, Tail #, Callsign, Heading slider, Clearance buttons (UFC/10/15/25ft), Status dropdown, Fly To/Duplicate/Remove
- **Context menu positioning** — uses `clientX/clientY` instead of canvas-relative coordinates for correct placement regardless of sidebar state
- **Click-to-select** — clicking an aircraft on the map now selects it (cyan ring + panel), not just drag
- **Right-click fix** — `onCanvasMouseDown` filtered to left-click only so right-click doesn't start drag
- **Transparent drag mode** — aircraft silhouettes drop to 40% opacity during drag to see nose gear marker and ground features for precise placement
- **PDF captures current view** — export captures whatever zoom/center/bearing the user is viewing instead of resizing to fixed 1600×900; fullscreen = full-detail export
- **Obstacle-to-taxilane clearance** — obstacles within taxilane envelopes now flagged as violations per UFC 3-260-01; `checkObstacleTaxilaneClearance()` tests all obstacle shape points against envelope half-width
- **Violation text** — taxilane violation count changed from "N aircraft intrudes" to "N violation(s)" to include obstacle violations

### Features — BASH Monthly Report Overhaul
- **Live heatmap capture** — Wildlife Hazard Depiction Map now captures the actual Mapbox GL heatmap (green→cyan→yellow→orange→red density visualization) via off-screen canvas rendering instead of static pin markers
- **Heatmap density legend** — color ramp bar (Low → High) replaces the misleading sighting/strike dot legend
- **Sighting detail streamlining** — removed scientific names, Airfield Zone, and Coordinates from sighting cards; weather fields (Time of Day, Sky, Precipitation, BWC) consolidated into compact italic row
- **Title case values** — all detail fields capitalized ("hazed" → "Hazed", "none" → "None")
- **Chronological order** — sightings sorted oldest-first (ascending by observed_at)
- **Double Zulu fix** — removed redundant `+ 'Z'` from 3 timestamp locations (formatZuluDateTime already includes Z)
- **BWC History source labels** — "bash_check" → "BASH Check", "manual" → "Manual Entry", etc.

### Features — Analytics Accuracy
- **Inspection avg time** — now uses `created_at → filed_at` from inspection records (actual start-to-file duration) instead of unreliable activity log pairing
- **Check avg time** — new `started_at` column on `airfield_checks` captures when the user selects a check type; `started_at → completed_at` gives actual on-airfield duration instead of 0 min
- **Check draft persistence** — `startedAt` included in check draft for cross-device resume

### Database Migrations
- `2026031900` — add `started_at` column to `airfield_checks`

---

## [2.24.0] — 2026-03-18

### Features — CES Work Order Dashboard & Role System
- **CES Work Orders page** (`/ces`) — dedicated dashboard for CES-role users with shop tabs, 5 KPIs (New/In Work/Project/Verify/Overdue), priority-sorted work queue, recently completed section, inline status update buttons
- **CES role lockdown** — navigation restricted to CES Work Orders, Discrepancies, Visual NAVAIDs, Settings. Flat sidebar nav (no collapsible dropdowns). Settings limited to Profile, Installation, Appearance, About
- **CES status restrictions** — In Work / Project / Work Completed buttons only. Resolution notes required for Work Completed and Project statuses with context-aware prompts
- **"Waiting for Project Design/Execution"** status — new `current_status` value for discrepancies pending project design vs local CES execution. Purple accent throughout workflow UI

### Features — Discrepancy Workflow
- **Auto-assign shop on creation** from per-base configurable type-to-shop mapping (Base Setup → CE Shops)
- **Configurable type-to-shop mapping** — "Discrepancy Type Assignments" section in CE Shops tab
- **Shop filter chips** on discrepancy list page with open counts per shop
- **Workflow progress bar** in status update modal: AFM → CES → In Work → Project → Verify

### Features — Reports & Analytics
- **Discrepancy Report** rebuilt as flexible filter-based report builder (5 filters, live preview, "Export All Open" quick button)
- **Aging Discrepancies** — clickable tier/shop badge filters, export only what's visible
- **Airfield Lighting Report** redesigned — sortable system health table with expandable component rows, export options (All Systems / Outages Only / By System)
- **Reports & Analytics hub** — 30-day analytics dashboard with 9 styled metric cards: Airfield/Lighting Inspections (split), Checks, Discrepancies, QRC, Personnel, Obstructions, Parking Plans, Wildlife/BASH
- **Time frame selector** — 7d / 30d / 90d / 6mo / 1yr for all analytics
- **Report data realignment** — Shop column and By Shop summary added across all discrepancy report PDFs and page views

### Features — NAVAID System Map
- **System Overview map** on discrepancy detail page when linked to Visual NAVAID — shows all features in the system (green=operational, red=inop, large marker=linked feature) via Mapbox Static Images API with GeoJSON overlay
- System map embedded in discrepancy PDF exports

### Features — Parking Module
- **Grouped aircraft list** — sidebar groups by type with collapsible headers, ADG badge, count badge
- **Bulk add** — quantity field (1-50) in picker, auto-names "F-22 #1", "F-22 #2"
- **Selection highlight** — cyan ring around selected aircraft on map
- **Right-click / long-press context menu** — Edit Details, Duplicate, Remove
- **Fly To zoom** increased to 19 for tighter aircraft focus

### Bug Fixes
- Unicode arrows in directional sign labels sanitized for PDF compatibility
- `resolution_date` now set on `completed` status (was only `resolved`)
- Aging discrepancies PDF columns reordered (W/O # after ID) with balanced widths

### Database Migrations (+1)
- `2026031800` — `discrepancy_type_shop_map` JSONB column on `bases` table

---

## [2.23.0] — 2026-03-18

### Features — Parking Plan PDF Export & Email
- **Parking plan PDF** — Landscape-oriented PDF with compact aircraft summary table (type, qty, ADG, dimensions, min clearance), top-down map screenshot preserving user bearing/rotation, and clearance violations section. Generated via `lib/parking-pdf.ts` with jsPDF + jspdf-autotable
- **Map capture system** — Temporarily resizes map container to 1600×900, flattens pitch while preserving bearing, waits for idle render, captures canvas via `toDataURL()`, restores original view state
- **PDF + Email buttons** — Added to both fullscreen map controls (top-left toolbar) and sidebar header. Email uses shared `EmailPdfModal` pattern with default email pre-fill
- **Shared `buildParkingPdf()` helper** — Single function returns `{ doc, filename }` for both download and email workflows

### Features — Parking Module Enhancements
- **Tabbed sidebar** — Replaced accordion sections with 4 tabs (Aircraft, Environment, Clearance, Settings) with count badges. Responsive bottom sheet on mobile
- **Independent obstacle locking** — Obstacles default to locked position; separate lock toggle prevents accidental drag. Ref-based guard in drag handler
- **Wildlife species favorites** — Star toggle on species picker and base setup. Favorites sort first with gold border. Stored via `is_favorite` column on `base_wildlife_species`

### Bug Fixes
- **Aircraft silhouette scaling on high-DPI** — Added `pixelRatio: 1` to Mapbox `addImage` calls to prevent icons from rendering at half size on Retina displays
- **Icons shrink during zoom** — Changed from `zoomend` (fires only after animation) to `zoom` event for continuous scale updates. Used ref to avoid stale closures
- **Icons distort during rotation** — `computeIconScale` used x-only distance (`Math.abs(pW.x - p0.x)`) which collapsed to zero at 90° rotation. Fixed to 2D distance (`Math.sqrt(dx² + dy²)`). Added `rotate` and `pitch` event listeners
- **PDF map aspect ratio distortion** — Removed forced aspect ratio; uses source canvas dimensions to preserve natural proportions
- **PDF map capture timing** — Wait for Mapbox `idle` event + 2x `requestAnimationFrame` to ensure canvas is fully painted before `toDataURL()`

### Database
- **2 new migrations** (`2026031700`, `2026031505`)
  - `create_base_wildlife_species` — Per-installation wildlife species configuration with favorites
  - `add_bar_group_id` — Bar group UUID column on infrastructure_features for approach light bar grouping
- **Total migrations**: 119

---

## [2.22.0] — 2026-03-17

### Features — Inspection Lifecycle Overhaul
Complete rewrite of the daily inspection lifecycle. Each inspection half (airfield/lighting) now operates as an independent entity with a simplified flow: Start → Fill Out → Complete (files to DB immediately). No separate File step.

- **File on Complete** — Clicking "Complete" saves the inspection half directly to the database as completed, eliminating the intermediate in-progress-then-file workflow
- **Start/Resume prompts** — KPI badge on the dashboard and the inspections page show "Start Inspection" or "Resume Inspection" buttons instead of auto-loading the form
- **Lighting tab prompt** — After the airfield half is completed and filed, the lighting tab shows a dedicated Start/Resume card
- **Airfield filed indicator** — Status bar shows "Completed & Filed" with green checkmark; clicking the airfield tab shows a completion card with "Continue to Lighting" button. Persists across page reloads via `airfieldFiled` flag in the draft object
- **AFLD3/{OI} activity logging** — Start logs "AFLD3/{OI} is on the airfield for the Daily Airfield Inspection"; completion logs BWC, RSC/RCR, and all discrepancies found with remarks
- **Draft cleanup** — Empty orphaned drafts auto-deleted from both localStorage and Supabase on page load. Phase 2 server sync skips empty/orphaned DB drafts and auto-deletes them
- **Discard/delete** — Discard current draft (clears localStorage + deletes DB records) or delete in-progress inspections from history with Resume/Delete buttons on history cards
- **Reopen for editing** — "Reopen for Editing" on the detail page now auto-loads the inspection form via `?action=reopen&groupId=xxx` instead of requiring a manual Resume click
- **Orphan prevention** — Removed redundant `saveInspectionDraft()` call from `handleComplete` that was creating orphaned `in_progress` DB records never filed

### Features — Wildlife/BASH Enhancements
- **Zulu time auto-populate** — Sighting and strike forms now show an editable datetime field pre-filled with the current UTC time. Saved to `observed_at` (sightings) and `strike_date` (strikes). Already exported in BASH monthly report PDFs
- **BWC at time of observation** — New field on both sighting and strike forms, auto-populated from current airfield status
- **Sighting detail log** — New section in the BASH monthly report PDF with per-sighting detail cards (species, location, coordinates, conditions, action taken, dispersal effectiveness)
- **Weather auto-fill** — `weatherToFormFields()` maps Open-Meteo weather codes to sky condition and precipitation on form mount

### Features — Discrepancy & Check Improvements
- **Per-installation facility numbers** — `base_facilities` table for tracking facility numbers per base. Always-visible facility # field on discrepancy forms
- **Check lifecycle logging** — Auto-save persistence for checks with AFLD3/{OI} format activity entries
- **Link to Visual NAVAID toggle** — Discrepancy edit modal includes a toggle to link/unlink discrepancies to infrastructure features
- **Facility # in inspections** — Facility number field available in inspection and check discrepancy sub-forms

### Features — PDF & Photo Performance
- **Image compression** — Photos are compressed before embedding in PDFs, significantly reducing file size
- **Photo thumbnails** — Thumbnail generation on upload, used in list views for faster rendering
- **Obstruction PDF fix** — Fixed map image cutoff by calculating correct page break height before embedding

### Bug Fixes
- **Ghost draft resume prompt** — Fixed multiple edge cases where completed inspections showed "Resume" prompts due to orphaned DB records, empty localStorage drafts, or stale `airfieldFiled` state
- **Activity log entity type** — Fixed `airfield_check` incorrectly displaying as entity type for inspections
- **Double completion log** — Eliminated duplicate activity log entries on inspection filing
- **Inspection form not loading** — Fixed "Begin New Inspection" not rendering the form when `draftHasWork` was used for workspace view guard

### Database
- **2 new migrations** (`2026031600`, `2026031601`)
  - `create_base_facilities` — Per-installation facility number tracking
  - `add_bwc_at_time_wildlife` — BWC at time of observation column on `wildlife_sightings` and `wildlife_strikes`
- **Total migrations**: 117

---

## [2.21.0] — 2026-03-15

### Features — Obstruction Map Enhancements
- **Taxiway clearance envelopes** — Obstruction evaluation map now renders full clearance envelope polygons (OFA/Clearance Line outer, Safety Area inner for FAA) instead of dashed centerlines. `generateCenterlineBuffer()` with perpendicular vertex offset and averaged interior bearings for smooth corners
- **Taxiway data enrichment** — Obstruction map receives TDG, taxiway type, runway class, and service branch for accurate clearance width calculations
- **Fullscreen map mode** — Toggle fullscreen on obstruction and parking maps with toolbar button and spacebar shortcut

### Features — DAFMAN Bar-Level Outage Analysis
- **Bar group linkage** (`bar_group_id`) — New column on `infrastructure_features` for grouping lights that form a single physical bar. Used by outage engine for spatial ordering and bar-level threshold checks
- **3+ lamps = bar out** — DAFMAN 13-204v2 rule: a 5-lamp bar is considered inoperative when 3+ lights are out. `analyzeBarOutages()` function with `BAR_INOP_THRESHOLD = 3`
- **Dual threshold evaluation** — Percentage threshold (10%) uses individual light counts; count threshold (3 barrettes) and consecutive/adjacent checks use bar-level counts
- **Link as Bar UI** — Box select lights on infrastructure map, click "Link as Bar" to assign shared `bar_group_id`. Selection panel repositioned to top-anchored with scroll overflow
- **Bar group indicator** — Feature edit popup shows cyan bar group ID when linked
- **Auto-group bar lights** — Audit panel button clusters ungrouped bar-type lights by spatial proximity (~15ft threshold)
- **Bulk rename linked bars** — New "Bar Groups" collapsible section in audit panel lists all bar groups with light count, inop status, and sequential fixture ID rename tool
- **Bar-level health display** — System health panel expanded view shows bars out / total bars per component when bar groups exist
- **DAFMAN bar-out note** — Discrepancy descriptions include "Bar considered INOPERATIVE per DAFMAN 13-204v2 (N/M lights out)" when applicable

### Features — INOP Description Cleanup
- **Structured discrepancy format** — INOP discrepancies use structured fields (Status, Component, Location) instead of unformatted text. Consistent across infrastructure map, lighting inspections, and new discrepancy page
- **Clean events log entries** — Activity log no longer duplicates title/description when metadata already contains formatted details. Removed redundant location suffix
- **Display name fix** — `buildFeatureDisplayName()` excludes fixture ID codes for non-sign features; only sign types include label text in display names
- **Feature type formatting** — Events log uses `formatFeatureType()` fallback instead of raw DB values with underscores

### Features — Wildlife Weather Auto-Fill
- **Weather-to-form mapping** — `weatherToFormFields()` maps Open-Meteo weather codes (0-99) to form values: sky condition (clear/some_cloud/overcast) and precipitation (none/fog/rain/snow)
- **Auto-populate on mount** — Wildlife sighting and strike forms auto-fill sky condition and precipitation from current weather data (skipped in edit mode)

### Features — Parking Module Improvements
- **Touch support** — Added touch event handlers for aircraft and obstacle drag on parking map
- **Toolbar ruler button** — Quick-access measurement tool in parking map toolbar

### Bug Fixes
- **Outage percentage threshold** — Fixed to use individual light counts (not bar ratios) per DAFMAN 10% rule
- **Bar group GeoJSON** — Added `bar_group_id` to feature GeoJSON properties (was missing, causing popup indicator to never render)
- **Fullscreen exit** — Fixed escape key handler for fullscreen map mode
- **Selection panel overflow** — Repositioned from bottom-anchored to top-anchored with `maxHeight` and scroll to prevent off-screen overflow

### Database
- **1 new migration** (`2026031505`) — Added `bar_group_id UUID DEFAULT NULL` column and partial index on `infrastructure_features`
- **Total migrations**: 115

---

## [2.20.0] — 2026-03-14

### Features — Infrastructure Audit Mode & Import Tools
Comprehensive audit workflow for infrastructure feature verification, multi-format import pipeline, fixture ID system, and airfield lighting report.

#### Audit Mode
- **Audit panel** — New `components/infrastructure/audit-panel.tsx` (1,413 lines) with feature verification workflow: filter by component, view assigned/unassigned features, bulk label editing with sequential numbering
- **Bulk assign tool** — Filter-based component assignment for rapidly populating system components from placed features
- **Bulk delete per component** — Remove all features assigned to a specific component from the audit panel
- **Feature popup enhancements** — Fixture ID displayed prominently, feature type/system/component fields editable inline, deduplicated system info, coordinates removed from popup

#### Import Pipeline
- **KML import** — Import features from Google Earth KML files with automatic coordinate extraction and feature placement
- **CSV/GeoJSON import** — Bulk import from CSV (lat/lng columns) and GeoJSON (Point geometries) with type mapping
- **DXF import** — AutoCAD DXF file parsing for importing CAD-drawn airfield layouts
- **Default import layer** — All imported features default to "Initial Import" layer for review before reassignment
- **Post-import repaint** — Force Mapbox layer re-render after bulk import to ensure all features appear immediately

#### Fixture ID System
- **Fixture IDs** — Unique identifiers for all infrastructure features, displayed in popups and audit panel
- **Label cleanup** — Removed label field from non-sign features; sign text retained for sign-type features only

#### Airfield Lighting Report
- **New report type** — `app/(app)/reports/lighting/page.tsx` (241 lines) with summary cards, per-system health status, feature breakdowns by type and layer, recent outage timeline
- **Report data module** — `lib/reports/lighting-report-data.ts` (80 lines) aggregates system health, feature counts, and outage events
- **PDF generator** — `lib/reports/lighting-report-pdf.ts` (233 lines) with system health table, feature inventory, outage log, and DAFMAN compliance summary
- **Reports hub integration** — Added lighting report card to `/reports` page

### Features — Dashboard & Status Overhaul
- **Airfield Status layout redesign** — Multiple iterations culminating in three-column layout (RWY | NAVAID | ARFF) with column titles, stacked vertically side by side
- **ARFF integration** — ARFF aircraft cards merged into the main status view alongside runway and NAVAID panels
- **RSC/BWC vertical stacking** — Active Runway, RSC, and BWC stacked vertically in the runway column
- **NAVAID layout** — Flex alignment fixes to keep G/Y/R toggle buttons vertically aligned
- **Dashboard cleanup** — Removed Visual NAVAIDs KPI badge from dashboard

### Features — System Health Panel Redesign
- **Category summary cards** — Replaced per-component outage bars with high-level category summary cards showing system-level health status
- **Simplified lighting status** — Hidden counts when all operational; show system-level status only
- **Legend collapse** — Legend defaults to collapsed on page load

### Features — Other Improvements
- **ACSI "Mark All Y" button** — Added to each ACSI section header for quickly marking all items as compliant
- **ACSI PDF page numbers** — Page numbers now appear on every page of ACSI PDF export
- **Discrepancy compact rows** — Replaced discrepancy cards with compact table rows; added inline edit/delete actions
- **Discrepancy area dropdown** — Uses installation-configured areas instead of hardcoded list
- **Runway End Light feature type** — Added to infrastructure map with dedicated layer rendering
- **Rotating Beacon in DB** — Added `rotating_beacon` to feature_type CHECK constraint

### Bug Fixes
- **Mapbox layer rendering** — Fixed broken filter on symbol layer `inop-ring` that caused all symbol layers to fail
- **Threshold lights rendering** — Changed from symbol to circle renderType with white border for reliable rendering
- **Mapbox repaint** — Force repaint after source data update to prevent stale renders
- **Runway legend grouping** — Merge partial runway refs (e.g., "19" and "01") into full runway entry
- **KML import precision** — Round coordinates to 8 decimal places, remove `source=import` flag
- **Location picker map** — Added minHeight 220px for mobile usability
- **Check form layout** — Moved Remarks above Issue Found toggle, extended edge-to-edge, larger default size
- **QRC number badge** — Fixed to dark gray text on orange background
- **Discrepancy report badges** — Removed interactive `kpi-badge` class from summary badges
- **Toast notifications** — Consolidated duplicate toasts and capped visible toasts to 2
- **Missing layers** — Added `runway_threshold` and `approach_light` to LAYERS array
- **Threshold lights layer order** — Moved earlier in layer order to render before symbol layers

### Database
- **1 new migration** (`2026031302`) — Added `runway_end_light` and `rotating_beacon` to `infrastructure_features.feature_type` CHECK constraint
- **Total migrations**: 106

### Stats
- Build: Clean (zero errors)
- 119 `as any` casts across 28 files (up from 109)
- 49 files > 500 lines (largest: infrastructure/page.tsx at 3,980)
- 245 source files | 50 routes | 106 migrations | 42 tables

---

## [2.19.0] — 2026-03-13

### Features — Visual NAVAID Outage Tracking (Phases 1–4)
Complete lighting outage compliance system integrated into the infrastructure map module. Implements DAFMAN 13-204v2 Table A3.1 outage allowances with real-time health monitoring, automated discrepancy creation, and daily operations reporting.

#### Phase 1: Foundation
- **Feature status tracking** — Per-feature OP/INOP toggle from map popups with `status` column on `infrastructure_features`
- **Outage events table** — `outage_events` with reported/resolved event types, feature + component links, reporter tracking
- **Auto-create discrepancies** — Reporting an outage auto-generates a linked discrepancy with coordinates, feature type, and system context
- **Bidirectional resolution** — Marking a feature operational prompts to close linked open discrepancies with user name + Zulu timestamp in resolution notes

#### Phase 2: System Definitions + Outage Engine
- **Lighting systems** — `lighting_systems` table with 23 DAFMAN system types (ALSF-1/2, SSALR, MALSR, SALS, PAPI, runway/taxiway edge, etc.)
- **System components** — `lighting_system_components` with configurable outage thresholds (allowable percentage, count, and consecutive limits)
- **Outage rule templates** — `outage_rule_templates` seeded from DAFMAN 13-204v2 Table A3.1 for one-click system setup
- **Outage engine** — `lib/outage-rules.ts` (343 lines): `calculateComponentOutage()`, `calculateSystemHealth()`, `getAlertTier()`, spatial adjacency + consecutive violation detection
- **Feature-to-component assignment** — Dropdown in map popups links features to system components; auto-updates `total_count`
- **System Health Panel** — Collapsible panel showing per-system health with 4-tier alerts (green/yellow/red/black), per-component outage bars, DAFMAN required actions
- **Outage alert dialogs** — Auto-triggered when reporting an outage causes a system to exceed or approach thresholds
- **Base Configuration UI** — Lighting Systems tab in Settings for creating/editing systems, components, and outage rules

#### Phase 3: Legend + Inspection Integration
- **Three-tier SYSTEMS legend** — Location-based grouping (Runways → Taxiways → Areas → Misc) with feature counts per component
- **System legend visibility toggles** — Hide/show features by system component in addition to type-based legend
- **Lighting inspection links** — `inspection_item_system_links` table connects inspection template items to lighting systems for cross-module reporting
- **Rotating Beacon feature type** — Added as 22nd feature type with circle legend icon
- **Stadium Lights system type** — For tracking non-airfield lighting assets
- **Sign sub-type outage rule templates** — Granular signage tracking (location/directional/mandatory/informational/distance markers)
- **Inline system name editing** — Edit system names directly in Base Configuration
- **Auto-populate light counts** — Component `total_count` auto-calculated from assigned features

#### Phase 4: Polish + Reporting
- **Outage history timeline** — "Recent Activity" collapsible section in System Health Panel showing last 20 events with red/green dots, Zulu timestamps, feature labels, and reporter names
- **Daily ops report integration** — "VISUAL NAVAID OUTAGES" PDF section with Time/Feature/System/Event/User columns, color-coded Reported (red) / Resolved (green) text
- **Discrepancy detail linked NAVAID card** — Shows feature label, OP/INOP badge, type, system chain, and link to infrastructure map when `infrastructure_feature_id` is set
- **Map health color coding** — "Color by health" toggle renders yellow rings (approaching threshold) and red rings (exceeded) around operational features in degraded systems
- **Rich display names** — `buildFeatureDisplayName()` generates context-rich names (e.g., "TWY K 19 Mandatory Sign") using system/component/label/type
- **Resolution notes enrichment** — Closing linked discrepancies includes user name + Zulu timestamp

### Other Features
- **Pinch-to-zoom photo viewers** — All photo viewers (discrepancy, check, inspection, ACSI) now support pinch-to-zoom and pan gestures
- **Inspection reopening** — Completed inspections can be reopened with confirmation dialog
- **RSC/RCR completion guard** — Inspections require RSC/RCR fields before completion
- **Inspection confirmation dialogs** — Bullet-pointed formatting with spacing

### Bug Fixes
- **SYSTEMS legend sort** — Sorted by airfield precedence (runways, taxiways, areas, misc) instead of alphabetical
- **Component dropdown deduplication** — Hide "overall" component when system has sub-components; show for single-component systems
- **Dark mode select elements** — Forced dark background on all `<select>` and `<option>` elements globally
- **Component total_count sync** — Auto-updated after bulk feature assignment operations

### Database
- **5 new tables**: `lighting_systems`, `lighting_system_components`, `outage_events`, `outage_rule_templates`, `inspection_item_system_links`
- **2 altered tables**: `infrastructure_features` (added `status`, `system_component_id`), `discrepancies` (added `infrastructure_feature_id`, `lighting_system_id`)
- **15 new migrations** (`2026031200` through `2026031209`)
- **Total migrations**: 103

### Stats
- Build: Clean (zero errors)
- 109 `as any` casts across ~25 files (up from 58 — new Mapbox layers + Supabase joins)
- 48 files > 500 lines (largest: infrastructure/page.tsx at 3,440)
- 195+ source files | 49 routes | 103 migrations | 42 tables

---

## [2.18.0] — 2026-03-12

### Features — Infrastructure Map Module
Full interactive airfield infrastructure mapping system built on Mapbox GL JS. Enables airfield managers to digitize, manage, and visualize all lighting, signage, and miscellaneous airfield features on a satellite map.

#### Core Map Capabilities
- **Click-to-place features** — Select a feature type from dropdown, click map to place a pin at that location
- **Drag-to-move** — Reposition features by dragging markers in edit mode
- **Map rotation** — Touch and mouse support for rotating the map view
- **Fullscreen mode** — Toggle fullscreen with dedicated button
- **GPS location tracking** — Live blue dot showing user's current position (for drive-around inspections)
- **Box select** — Shift+drag to select multiple features for bulk operations (touch support on mobile)

#### Feature Types (21 types)
- **Signs** (5): Location, Directional, Informational, Mandatory, Runway Distance Marker
- **Taxiway Lights** (2): Taxiway Edge, Taxiway End
- **Runway Lights** (9): Runway Edge, PAPI, Threshold, Pre-Threshold, Terminating Bar, Centerline Bar, 1000ft Bar, Sequenced Flasher, REIL
- **Miscellaneous** (3): Obstruction Light, Windcone, Stadium Light
- **Legacy** (2): Approach Light, Runway Threshold (retained for existing data)

#### Custom Map Icons
- **Labeled sign graphics** — Canvas-rendered airfield signs with correct colors (black/yellow location signs, yellow/black directional signs with arrow, red/white mandatory signs, white/black distance markers)
- **Split-circle icons** — Approach lights, thresholds, PAPIs, threshold lights
- **Triangle icon** — Obstruction lights (red)
- **Square icon** — REIL (pink)
- **Windcone icon** — Sideways cone with orange/white stripes
- **Stadium light icon** — 4-dot cluster
- **Per-feature rotation** — `icon-rotate` with `icon-rotation-alignment: 'map'` for orienting signs/lights to match real-world bearings

#### Bar Placement Mode
- **6 bar types** — Threshold Bar, Terminating Bar, Pre-Threshold Bar, 1000ft Bar, Centerline Bar, Sequenced Flasher
- **Rotation input** — Set bar orientation before placing
- **Bulk creation** — Single click places 3–11 lights in a line at correct spacing via `offsetPoint()` geodesic calculations

#### Legend System
- **Type groups** — Collapsible groups: Signs, Taxiway Lights, Runway Lights, Miscellaneous
- **Location groups** — Auto-categorized: RWY 19 LIGHTS, RWY 01 LIGHTS, RWY LIGHTS/SIGNS, TAXIWAY LIGHTS, TAXIWAY SIGNS, OTHER
- **Per-layer toggles** — Independent visibility for each type and location layer
- **Show All / Hide All** — Bulk toggle for all layers
- **Feature counts** — Per-layer count badges in legend
- **All groups collapsed by default**

#### Bulk Operations
- **Bulk shift** — Offset all features in a layer by lat/lng (for alignment corrections)
- **Bulk re-layer** — Move selected features to a different location layer
- **Delete selected** — Remove all box-selected features
- **Free move** — Reposition multiple selected features with bulk save

#### Data Management
- **Supabase pagination** — Fetches all features via `.range()` in batches of 1,000 (overcomes Supabase's default 1,000-row SELECT limit)
- **Inline label editing** — Edit feature labels directly in map popups
- **Rotation editing** — Set per-feature rotation via popup
- **Import API** — `/api/infrastructure-import` for bulk GeoJSON import

#### Database
- **Table**: `infrastructure_features` (base_id, feature_type, longitude, latitude, layer, block, label, notes, rotation, source, created_by)
- **16 migrations** (`2026031100` through `2026031107`): table creation, feature type expansion, rotation column, CHECK constraint updates
- **CRUD module**: `lib/supabase/infrastructure-features.ts` with fetch (paginated), create, update, delete, bulk shift, bulk re-layer, bulk create

### Bug Fixes
- **Features disappearing** — Fixed Supabase 1,000-row default limit by implementing paginated fetch with `.range()` in `fetchInfrastructureFeatures()`
- **Location toggle mismatch** — Unified `'Unknown'` vs `'USER'` fallback for features with no assigned layer
- **Mapbox icon-size expression error** — Replaced invalid `case` + `zoom` nesting with single `interpolate` expression

### Stats
- Build: Clean (zero errors)
- 58 `as any` casts across ~20 files
- 45 files > 500 lines (largest: infrastructure/page.tsx at 2,443)
- 190+ source files | 49 routes | 98 migrations

---

## [2.17.1] — 2026-03-10

### Features
- **Photo deletion on discrepancies** — Delete photos from discrepancy detail page while editing. Cascade: removes from Supabase Storage → deletes DB record → decrements `photo_count`
- **Photo resize on upload** — All 6 upload functions now resize images to max 1600px and convert to JPEG (0.82 quality) before uploading. Dynamic import of `resizeImageForUpload()` from `lib/utils.ts`
- **Collapsible map legends** — Legends on discrepancy, obstruction, and waiver map views are now collapsible (default collapsed) with chevron toggle

### Improvements
- **Hide Mapbox branding** — Removed logo and attribution from all interactive maps (`attributionControl: false`) and static thumbnails (`&logo=false&attribution=false`). Global CSS rule added to `globals.css`
- **Photo rendering in PDFs** — Replaced `blobToDataUrl` with `blobToResizedDataUrl` (max 800px, JPEG conversion) in daily ops and open discrepancy report data fetchers. Fixes gray placeholder boxes for large images (4+ MB PNGs)
- **Personnel card display** — Airfield Status page personnel cards now match contractors page style with labeled fields (Company, Contact, Location, Work, Radio, Flag), status badge, day counter
- **Mark Completed button** — Reverted to light green translucent background (`rgba(34,197,94,0.15)`) with green text for readability
- **Map pin editing** — Discrepancy map supports editable pin location and user geolocation

### Removals
- **Current Status History** — Removed from Daily Ops Summary PDF (duplicate of Events Log section). Removed `runwayChanges` from data interface and `fetchRunwayChangesForDate()` function

### Documentation
- **Rollout plan** — New `docs/GLIDEPATH_ROLLOUT_PLAN.md` with 5-phase strategy (Selfridge beta → docs/video → outreach → AFWERX → Platform One)
- **NotebookLM sources** — 8 new source documents for Google NotebookLM cinematic video overviews (1 overall + 7 capability groups)
- **Capabilities brief** — Complete rewrite of `docs/GLIDEPATH_CAPABILITIES_BRIEF.md` (v2.17.0, user-value focused)
- **Beta tester guide** — New `docs/GLIDEPATH_BETA_TESTER_GUIDE.md` replacing old overview
- **Cleanup** — Removed old AFWERX proposal, NotebookLM overview, beta tester overview, legacy .docx files, old session handoffs, and component capabilities doc

### Stats
- Build: Clean (zero errors)
- 63 `as any` casts across 20 files
- 43 files > 400 lines (largest: inspections/page.tsx at 2,003)
- 169 source files | 48 routes | 82 migrations

---

## [2.17.0] — 2026-03-08

### Features

#### Operating Initials & Events Log Overhaul
- **Operating initials field** — New `operating_initials` column on profiles, editable in Settings (self-service) and User Management (admin). Max 4 chars, auto-uppercase
- **Events log OI column** — User column replaced with compact Operating Initials column (50px). Click to reveal popover with full name, role, and masked EDIPI
- **Column reorder** — Events log columns reordered: Time (Z) → Action → Details → OI → Actions
- **Dashboard events log** — Same OI column changes applied to dashboard activity feed
- **Migration** — `2026030802_add_operating_initials.sql`

#### QRC Emergency Verbiage (SCN)
- **SCN ACTIVATED** — Emergency QRCs with `has_scn_form` flag now log "SECONDARY CRASH NET ACTIVATED" instead of generic "QRC INITIATED/COMPLETED"
- **SCN field details** — When a QRC with fillable SCN fields is completed, field values are appended to the events log details
- **Cancel deletes entries** — Cancelling a QRC now deletes its activity_log entries (both initiated and completed) instead of creating a new "cancelled" entry

#### Zulu Time Standardization
- **4 utility functions** — Added `formatZuluTime()`, `formatZuluDate()`, `formatZuluDateTime()`, `formatZuluDateShort()` to `lib/utils.ts`
- **App-wide conversion** — Replaced ~150 instances of `toLocaleTimeString`, `toLocaleDateString`, `toTimeString`, and manual date formatting across 30+ files with Zulu utility functions
- **Daily ops exception** — Daily ops report date picker intentionally uses local time so users can select their local day. All exports still display UTC times
- **Scope** — All pages, all PDF generators (11), all components, login activity dialog, admin modals

### Bug Fixes
- **Inspection discrepancy comments** — Fixed the INSERT path in `saveInspectionDraft` which never included "DISCREPANCIES FOUND:" prefix or per-item comments in events log details
- **Dashboard events log mismatch** — Dashboard had its own local `ActivityEntry` type missing `user_operating_initials` and used old column order. Fixed to match main events log

### UI Improvements
- **Shift checklist dialog** — Widened from 520px to 620px on dashboard
- **All Inspections page** — Start buttons now fill available width (`flex: 1`), history link right-aligned
- **Personnel on Airfield** — Added 16px top padding for spacing between page title and top of page
- **Obstruction Database** — Moved from "More" dropdown to "AM Tools" dropdown on mobile More page

### Stats
- 47 files changed (+338, -197)
- 1 new migration
- 158 source files | 48 routes | 82 migrations | ~60,800 lines

---

## [2.16.1] — 2026-03-07

### Bug Fixes — Comprehensive Functional Testing

Full functional test pass across all modules with 21 files changed (+695, -108). Fixes span dashboard state management, map lifecycle, PDF exports, email delivery, and UI polish.

#### Dashboard & State Management
- **Advisory toggle persistence** — Polling `refreshStatus` was overwriting optimistic local updates after 10 seconds. Added `lastLocalUpdate` ref guard (15s cooldown) and increased polling interval from 10s to 30s
- **Personnel display** — Added work description to personnel cards on Airfield Status page
- **Runway change logging** — Improved log message to "Active runway changed to [value]"
- **ARFF status logging** — Simplified to show just status + remarks

#### Map Components (3 fixes)
- **Discrepancy location map** — Added `installationId` to `useEffect` deps and changed from early-return pattern to destroy+recreate for proper re-initialization on installation switch
- **ACSI location map** — Same destroy+recreate fix for installation switching
- **Obstruction map view** — Added `runways` to `useEffect` deps for re-initialization when runway data changes

#### ACSI Module
- **Detail page counters** — Changed from stored DB values to dynamically computed pass/fail/na counts from items array, fixing stale counter display
- **PDF map pins** — Removed `if (di === 0)` gate so each discrepancy gets its own map pins instead of all pins on the first discrepancy
- **Photo persistence** — Added `useEffect` to load photos from DB via `photo_ids` on mount for cross-device photo display

#### Discrepancy Detail Page
- **PDF export + email** — Added PDF export and email PDF buttons to individual discrepancy detail page
- **New file**: `lib/discrepancy-pdf.ts` — Single-discrepancy PDF generator following check-pdf.ts pattern

#### Waiver Module
- **Attachment management** — Full upload/delete attachment management on waiver edit page
- **Activity logging** — Added `logActivity` calls for waiver create and update operations
- **Acronym-aware titleCase** — UFC, FAA, AF now render correctly as uppercase in waiver type displays

#### Email PDF Infrastructure
- **Non-JSON error handling** — `lib/email-pdf.ts` now gracefully handles non-JSON server responses instead of throwing parse errors
- **API route hardening** — Lazy Resend SDK initialization + `maxDuration = 30` for large PDF payloads

#### Login & Auth
- **Login activity dialog** — Fixed race condition (read `last_seen_at` before updating it), exclude user's own activity from the feed
- **Setup account** — Changed "Unauthorized" error to user-friendly "Contact Base Admin for Account Access"

#### UI & Navigation
- **Bottom nav** — Updated tabs: Status, Dashboard, Obstruction, Events Log, More (with new icons: Radio, LayoutDashboard, MapPin, ClipboardList, Menu)
- **Text brightness** — Increased `--color-text-2` from `#94A3B8` to `#B0BEC5` and `--color-text-3` from `#64748B` to `#8899A6`
- **Calendar picker** — Added `filter: invert(1)` for dark theme date input icons
- **Sync page removed** — Deleted placeholder "Coming Soon" page (`app/(app)/sync/page.tsx`)

#### Check Photos
- **InstallationId passthrough** — Added `installationId` to `uploadCheckPhoto` call for RLS compliance

#### Files Created (1)
- `lib/discrepancy-pdf.ts` — Individual discrepancy PDF export

#### Files Modified (20)
- `app/(app)/acsi/[id]/page.tsx` — Dynamic counters
- `app/(app)/checks/[id]/page.tsx` — installationId passthrough
- `app/(app)/discrepancies/[id]/page.tsx` — PDF/email export
- `app/(app)/page.tsx` — Personnel display, runway/ARFF logging
- `app/(app)/waivers/[id]/edit/page.tsx` — Attachment management, activity logging, titleCase
- `app/(app)/waivers/[id]/page.tsx` — titleCase fix
- `app/(app)/waivers/new/page.tsx` — Activity logging, titleCase fix
- `app/api/send-pdf-email/route.ts` — Lazy Resend, maxDuration
- `app/globals.css` — Text brightness, calendar picker
- `app/setup-account/page.tsx` — Friendly error message
- `components/acsi/acsi-discrepancy-panel.tsx` — Photo persistence from DB
- `components/acsi/acsi-location-map.tsx` — installationId dep
- `components/discrepancies/location-map.tsx` — installationId dep
- `components/layout/bottom-nav.tsx` — Updated tabs and icons
- `components/login-activity-dialog.tsx` — Race condition fix
- `components/obstructions/obstruction-map-view.tsx` — runways dep
- `lib/acsi-pdf.ts` — Per-discrepancy map pins
- `lib/dashboard-context.tsx` — Advisory persistence fix
- `lib/email-pdf.ts` — Non-JSON error handling

#### Files Deleted (1)
- `app/(app)/sync/page.tsx` — Placeholder removed

---

## [2.16.0] — 2026-03-07

### QRC (Quick Reaction Checklist) Module

Full digitization of 25 Quick Reaction Checklists used during airfield emergencies and operational events. Interactive execution with live step tracking, SCN form data capture, cancel/close lifecycle, dashboard quick-launch, and daily ops report integration.

#### QRC Module (New)
- **QRC Page** (`/qrc`) — Three tabs: Available (template grid), Active (open executions), History (closed/all)
- **Interactive execution** — Per-step checkboxes, agency notification tracking, fill-in fields, time fields with "Now (Z)" auto-fill, conditional cross-references to other QRCs
- **6 step types** — `checkbox`, `checkbox_with_note`, `notify_agencies`, `fill_field`, `time_field`, `conditional`
- **SCN (Secondary Crash Net) form** — Data entry fields (aircraft type, callsign, tail number, etc.) displayed above checklist steps for applicable QRCs
- **Cancel QRC** — Permanently deletes accidental executions with confirmation dialog and activity logging
- **Close QRC** — Marks execution as closed with initials and timestamp, logs to Events Log
- **Reopen QRC** — Reopen closed executions for amendment
- **Template management** — Admin-only CRUD in Settings > Base Configuration > QRC Templates tab
- **Seed data** — 25 pre-built QRC templates with full step structures transcribed from PDFs, selective seeding
- **Annual review tracking** — Last reviewed date, reviewer, and review notes per template

#### Dashboard QRC Integration
- **QRC KPI badge** — Shows count of active QRC executions on dashboard
- **QRC Dialog** — Two-mode dialog: Picker (grid of all templates) and Execution (interactive step form)
- **Quick-launch** — Start new QRC or resume active execution directly from dashboard
- **Cancel from dialog** — Cancel closes the dialog entirely (no return to picker)

#### Daily Operations Report Integration
- **QRC Executions section** — Table of all QRCs opened or closed during the report period, with step completion counts and SCN data sub-tables (teal header)
- **Events Log section** — Chronological table of all activity log entries (Time, Action, Details, User)
- **Per-day grouping** — Multi-day date ranges render each day separately with date headers and all 8 report sections per day

#### Database
- **2 new tables** — `qrc_templates` (admin-configured definitions per base) and `qrc_executions` (one row per QRC run with JSONB step responses and SCN data)
- **3 migrations** — `2026030700` (tables + RLS), `2026030701` (review fields), `2026030702` (DELETE policy)
- **RLS policies** — All base users can SELECT/INSERT/UPDATE executions (emergency access); only admins can manage templates; DELETE policy for cancel functionality

#### Bug Fixes
- **Commercial aircraft images restored** — 86 images accidentally deleted in a previous cleanup commit, recovered from git history
- **Events Log column widths** — Adjusted in daily ops PDF for better readability (Action column wider, Details auto-width)
- **DELETE RLS policy** — Cancel QRC was silently failing due to missing DELETE policy on `qrc_executions`

#### Files Created (4)
- `app/(app)/qrc/page.tsx` — QRC page (882 lines)
- `lib/supabase/qrc.ts` — QRC CRUD module (326 lines)
- `lib/qrc-seed-data.ts` — 25 QRC templates with full step structures (467 lines)
- `supabase/migrations/2026030700_create_qrc_module.sql`, `2026030701_qrc_review_fields.sql`, `2026030702_qrc_exec_delete_policy.sql`

#### Files Modified (7)
- `app/(app)/dashboard/page.tsx` — QRC KPI badge + QrcDialog with picker/execution modes
- `app/(app)/settings/base-setup/page.tsx` — QRC Templates tab with seed/edit/toggle
- `app/(app)/reports/daily/page.tsx` — QRC and Events Log preview cards
- `lib/reports/daily-ops-data.ts` — `fetchActivityForDate()`, `fetchQrcExecutionsForDate()` with two-query approach
- `lib/reports/daily-ops-pdf.ts` — QRC Executions section, Events Log section, per-day grouping for multi-day ranges
- `lib/supabase/types.ts` — QrcTemplate, QrcExecution, QrcStepResponse types + 2 table definitions
- `components/layout/sidebar-nav.tsx` — QRC nav entry under AM Tools
- `app/(app)/more/page.tsx` — QRC entry in mobile menu

---

## [2.15.0] — 2026-03-06

### Feature Requests Batch 1 + Shift Checklist Module

Two development branches merged: `feature-req1` (UI/UX improvements, RSC/RCR enhancements, personnel tracking, events log overhaul) and `shiftchecklist` (full shift checklist module with timezone-aware dates).

#### RSC/RCR Enhancements
- **Combined RSC/RCR Check** — Single "RSC/RCR Check" type with RCR value (Mu reading), condition type, and equipment fields
- **Dashboard conditional card** — RCR replaces RSC display when reported; falls back to RSC otherwise
- **RSC/RCR on inspections** — Added RSC condition and RCR value fields to airfield/lighting inspection checklists
- **Migrations** (`2026030505`, `2026030601`) — `rcr_value`, `rcr_equipment`, `rcr_temperature` on `airfield_status`; RSC/RCR fields on `inspections`

#### Airfield Status Enhancements
- **Construction/Closures & Miscellaneous Info** — New sections on Airfield Status page with rich text remarks
- **Weather Info rename** — Advisory section renamed to "Weather Info (Watch/Warning/Advisory)" with runway-specific remarks
- **Inline personnel creation** — "+ Add" form directly on Airfield Status page via `createContractor`
- **Personnel completion** — Mark personnel completed directly from the status board
- **Confirmation dialogs** — Runway and NAVAID status changes require confirmation with optional notes
- **NAVAID status picker** — Replaced cycling toggle with a proper status picker dialog (G/Y/R)
- **ARFF aircraft** — Added ARFF aircraft support to installation context and base setup

#### Events Log Overhaul (renamed from Activity Log)
- **Renamed** — "Activity Log" → "Events Log" throughout the app
- **Enriched details** — All CRUD modules now write detailed action descriptions
- **Activity templates** — "Use Template" button in the manual entry dialog
- **Edit entries** — Edit activity entries by modifying original details directly (stored as 'Edit:' suffix)
- **Clickable user IDs** — Show role and masked EDIPI in the Events Log

#### Dashboard Improvements
- **KPI badge grid** — 3-column on desktop, 2-column on mobile (`.kpi-grid` CSS class)
- **Shift Checklist KPI badge** — Opens dialog for inline checklist completion without leaving dashboard
- **Last Check moved** — Relocated from Airfield Status to Dashboard
- **Side-by-side layout** — Last Check Completed and Personnel on Airfield cards

#### Shift Checklist Module (New)
- **Full CRUD module** (`app/(app)/shift-checklist/page.tsx`) — Today's checklist with progress bar per shift (Day/Swing/Mid), check-off items with notes, file/reopen workflow
- **History tab** — Clickable historical checklists with read-only detail view
- **Dashboard dialog** — Complete checklist items directly from the KPI badge dialog
- **Base Configuration** — Add/edit/delete/toggle items per shift, daily/weekly/monthly frequency, configurable daily reset time per base
- **Timezone-aware dates** — Uses base's configured timezone and reset time (default 06:00) to determine the current checklist date. Before the reset hour, items belong to the previous day
- **Database** — 3 new tables (`shift_checklist_items`, `shift_checklists`, `shift_checklist_responses`) with full RLS policies
- **Migrations** (`2026030607`, `2026030608`, `2026030609`) — Tables, mid-shift constraint, configurable reset time on `bases`

#### NOTAM Expiry Alerts
- **Sidebar badge** — Count of NOTAMs expiring within 24 hours (checked every 5 minutes)
- **Card highlight** — Red border and "EXPIRING SOON" badge on expiring NOTAMs
- **Hook** (`lib/use-expiring-notams.ts`) — Polls FAA NOTAM API, parses both FAA date format and ISO dates

#### UI/UX Improvements
- **Browser spellcheck** — Enabled globally via `spellCheck` attribute on root `<html>` element
- **Mobile More page** — Collapsible dropdown groups (AM Tools, More) matching sidebar structure
- **Scroll-to-top** — Auto-scroll on navigation and tab switches; preserved on template edits
- **Header simplification** — Removed logo/title, kept only installation switcher and user/status

#### Migrations Added (15)
- `2026030500` through `2026030609` — Beale AFB seed, config RLS fix, realtime activity, ARFF status, RSC/BWC/RCR on airfield_status, RSC/RCR on inspections, expanded item types, contractors table, contractor fields, EDIPI, construction/misc remarks, shift checklist (3 migrations)

#### Files Created (4)
- `app/(app)/shift-checklist/page.tsx` — Shift checklist page
- `lib/supabase/shift-checklist.ts` — Shift checklist CRUD + timezone helpers
- `lib/use-expiring-notams.ts` — NOTAM expiry hook
- 15 migration files in `supabase/migrations/`

#### Files Modified (20+)
- `app/(app)/dashboard/page.tsx` — KPI grid, shift checklist dialog, RSC/RCR conditional display
- `app/(app)/page.tsx` — Airfield Status: construction/misc, inline personnel, weather info rename
- `app/(app)/settings/base-setup/page.tsx` — Shift checklist tab with reset time config
- `app/(app)/activity/page.tsx` — Renamed to Events Log, enriched details, templates
- `app/(app)/notams/page.tsx` — Expiring NOTAM highlight
- `app/(app)/more/page.tsx` — Collapsible dropdown groups
- `components/layout/sidebar-nav.tsx` — Shift checklist nav item, NOTAM expiry badge
- `app/layout.tsx` — Spellcheck attribute
- `app/globals.css` — KPI grid responsive class
- `lib/supabase/types.ts` — 3 new table types, checklist_reset_time on bases

#### Version Sync
- Updated version to 2.15.0 in package.json, login/page.tsx, settings/page.tsx

---

## [2.14.0] — 2026-03-04

### Real-time Updates, Map Fixes & UI Polish

Supabase Realtime subscriptions for live dashboard updates across users, activity logging fixes, map lifecycle fixes across all modules, and UI polish.

#### Real-time Dashboard Updates (Supabase Realtime)
- **Database migration** (`2026030401_enable_realtime.sql`) — Enables Supabase Realtime on `airfield_status`, `airfield_checks`, and `inspections` tables. Sets `REPLICA IDENTITY FULL` on `airfield_status` for complete UPDATE payloads
- **DashboardProvider** (`lib/dashboard-context.tsx`) — Subscribes to `postgres_changes` UPDATE events on `airfield_status` filtered by `base_id`. Advisory, active runway, runway status, and per-runway statuses update live across all connected clients
- **Dashboard page** (`app/(app)/page.tsx`) — Refactored `loadCurrentStatus` to `useCallback` for reuse. Subscribes to INSERT events on `airfield_checks` and `inspections` on a single channel. BWC, RSC, and Last Check re-derive on any new check/inspection
- **Cleanup** — All channels removed on unmount or installationId change. Demo mode (no Supabase) gracefully skipped

#### Activity Log & Runway Status Logging Fixes
- **Runway status log** — Created `logRunwayStatusChange()` in `lib/supabase/airfield-status.ts`. Called from all 6 dashboard handlers (runway toggle ×2, status change ×2, advisory set, advisory clear). Populates `runway_status_log` table for daily operations report PDF
- **Activity log UUID fix** — `activity_log.entity_id` is `UUID NOT NULL`; handlers were passing string literals (`'active_runway'`, `'runway_status'`) which silently failed on INSERT. Fixed to use `installationId` (valid UUID) as entity_id
- **Advisory logging** — Added `logActivity()` calls for advisory set and clear (were completely missing)

#### Login Activity Dialog Fix
- **Session resume support** — Dialog now works on both explicit login and tab resume (session already authenticated). Falls back to reading `last_seen_at` from user profile when sessionStorage is empty
- **Per-session flag** — `glidepath_activity_checked` prevents re-runs within the same tab session
- **Race condition fix** — Header's `loadProfile()` accepts `updatePresence` param; initial mount skips `last_seen_at` update so the dialog can read the previous value first

#### Map Lifecycle Fixes (3 components)
- **Discrepancy map** (`discrepancy-map-view.tsx`) — Removed early return for zero GPS discrepancies that was destroying the map container DOM node, causing Mapbox to break on filter toggle. Replaced with overlay message. Added `installationId` dep for re-initialization on installation switch
- **Obstruction evaluation map** (`airfield-map.tsx`) — Added `installationId` dependency to map init effect. Surfaces, runway labels, and center point now re-render when switching installations
- **Obstruction history map** (`obstruction-map-view.tsx`) — Same installation-switch fix

#### UI Polish
- **Regulation cards** — Increased font sizes: reg ID (`fs-base` → `fs-md`), title (`fs-md` → `fs-lg`), badges (`fs-2xs` → `fs-xs`)
- **User cards** — Email hidden from card list for privacy
- **User detail modal** — Email masked by default (`jo***@email.com`) with eye icon toggle to reveal/hide. Added `Eye`/`EyeOff` icons from Lucide

#### Migration Added (1)
- `supabase/migrations/2026030401_enable_realtime.sql`

#### Files Created (1)
- `supabase/migrations/2026030401_enable_realtime.sql`

#### Files Modified (10)
- `lib/dashboard-context.tsx` — Realtime subscription for airfield_status
- `lib/supabase/airfield-status.ts` — `logRunwayStatusChange()` function
- `app/(app)/page.tsx` — `useCallback` refactor, realtime subscriptions, logRunwayStatusChange/logActivity calls
- `components/discrepancies/discrepancy-map-view.tsx` — Remove early return, add overlay, installationId dep
- `components/obstructions/airfield-map.tsx` — installationId dep for map re-init
- `components/obstructions/obstruction-map-view.tsx` — installationId dep for map re-init
- `components/login-activity-dialog.tsx` — Session resume support, per-session flag
- `components/layout/header.tsx` — Delayed last_seen_at update
- `components/admin/user-card.tsx` — Remove email display
- `components/admin/user-detail-modal.tsx` — Masked email with eye toggle
- `app/(app)/regulations/page.tsx` — Larger card text

#### Version Sync
- Updated version to 2.14.0 in package.json, login/page.tsx, settings/page.tsx

---

## [2.13.0] — 2026-03-03

### Multi-Discrepancy System, Per-Issue Photos & Draft Persistence

Complete overhaul of how discrepancies, photos, and drafts are handled across checks and inspections. Each failed item can now have multiple discrepancies with individual comments, GPS pins, map thumbnails, and photos — all persisted to Supabase and rendered in detail views and PDF exports. Draft persistence moved from localStorage to Supabase for cross-device access.

#### Multiple Discrepancies Per Item (Checks + Inspections)
- **Checks**: Each issue in a check now supports multiple discrepancy entries with individual comments, GPS locations, and photos via `SimpleDiscrepancyPanelGroup`
- **Inspections**: Failed inspection items support multiple discrepancies with per-discrepancy comments, location pins, and photos
- **ACSI**: Multiple discrepancies per failed ACSI checklist item with work order, project, cost, and completion tracking
- Toggle cycle on inspection checklist changed: items now default to Pass (Pass → Fail → N/A → Pass), removing the blank/unanswered state
- Removed "Mark All Items as Pass" button (no longer needed since all items default to pass)

#### Per-Issue Photo Linking
- **Database migration** (`2026030301_add_photo_issue_index.sql`) — Adds `issue_index` column to `photos` table, linking each photo to a specific issue/discrepancy within a check or inspection
- **Checks**: Photos uploaded within an issue panel are tagged with `issue_index`, displayed under each issue on the detail page, and embedded per-issue in PDF export
- **Inspections**: Photos uploaded within a discrepancy are tagged with `issue_index` (discrepancy index), displayed per-discrepancy on the detail page, and embedded per-discrepancy in PDF export
- **Backward compatible**: Legacy photos without `issue_index` fall back to flat per-item display

#### Supabase Draft Persistence for Checks
- **Database migration** (`2026030300_add_check_draft_data.sql`) — Adds `status`, `draft_data`, `saved_by_name`, `saved_by_id`, `saved_at` columns to `airfield_checks` table
- **Manual "Save Draft" button** — saves check form state to Supabase (not auto-save), enabling cross-device access
- **Two-phase load** — loads from localStorage instantly, then checks Supabase for a newer draft and hydrates if found
- **Draft lifecycle** — Save Draft creates/updates a `status: 'draft'` row; Complete Check deletes the draft row and creates a `status: 'completed'` row
- Draft rows filtered from check history (`fetchChecks()`, `fetchRecentChecks()` filter to `status: 'completed'`)

#### Discrepancy Panel Layout Improvements
- Restructured `SimpleDiscrepancyPanel` and `SimpleDiscrepancyPanelGroup` layout: description box and buttons moved to right column, photos shown as thumbnails under description
- Map and action buttons scaled proportionally with consistent sizing
- Inline Save Draft button added to discrepancy panel area

#### Inspection Location Capture Fix
- **Fixed stale closure** in `handleDiscPointSelected` and `handleDiscCaptureGps` — these were spreading the full discrepancy object from a stale `draft` closure, potentially overwriting current comment and photo data with old values. Now only passes `{ location }` and relies on the merge pattern in `handleDiscChange`
- **Added multi-discrepancy support to `renderInspectionSections`** — the shared PDF helper (used by combined daily inspection PDFs) previously only handled legacy single-note/single-location rendering, silently dropping all discrepancy data from combined reports

#### Fail KPI Badge Dropdown
- Per-discrepancy photos and map thumbnails now display in the Fail KPI badge dropdown on the inspection detail page (was only showing unlinked legacy photos)

#### Check Form UX
- Recent checks and "View Check History" link hidden when a check type is selected (declutters the form during active entry)

#### Inspection Filing Dialog
- "File Without Lighting" button given more horizontal padding, reduced font size, and `whiteSpace: nowrap` to prevent text overflow

#### Migrations Added (2)
- `2026030300_add_check_draft_data.sql` — Draft columns on `airfield_checks`
- `2026030301_add_photo_issue_index.sql` — `issue_index` column on `photos`

#### Files Created (1)
- `supabase/migrations/2026030300_add_check_draft_data.sql`
- `supabase/migrations/2026030301_add_photo_issue_index.sql`

#### Files Modified (12)
- `lib/check-draft.ts` — Added `dbRowId` to `CheckDraft` interface
- `lib/supabase/checks.ts` — Added `saveCheckDraftToDb()`, `loadCheckDraftFromDb()`, `deleteCheckDraft()`, draft status filtering
- `lib/supabase/inspections.ts` — Added `issue_index` to `InspectionPhotoRow`, `discIndex` param to `uploadInspectionPhoto`
- `lib/inspection-draft.ts` — Default unset responses to 'pass' in `halfDraftToItems()`
- `lib/pdf-export.ts` — Added `PdfDiscPhotoMap` type, per-discrepancy photo rendering in all 3 inspection PDF generators
- `lib/check-pdf.ts` — Per-issue photo embedding in check PDF export
- `app/(app)/checks/page.tsx` — Save Draft button, two-phase load, hide recent checks during entry
- `app/(app)/checks/[id]/page.tsx` — Per-issue photo grouping in detail view, `photoDataUrlsByIssue` for PDF
- `app/(app)/inspections/page.tsx` — Stale closure fix, per-discrepancy photo upload, default-to-pass, remove Mark All Pass
- `app/(app)/inspections/[id]/page.tsx` — Per-discrepancy photo grouping, Fail KPI photo display, `PdfDiscPhotoMap` for PDF
- `components/ui/simple-discrepancy-panel.tsx` — Layout restructure (right column for description/buttons/photos)
- `components/ui/simple-discrepancy-panel-group.tsx` — Updated group layout

#### Version Sync
- Updated version to 2.13.0 in package.json, login/page.tsx, settings/page.tsx

---

## [2.12.0] — 2026-03-02

### Send PDF via Email & Default Email Setting

Server-side email delivery for all PDF exports using Resend, plus a user-configurable default email that pre-fills the send modal. Also includes map standardization, standalone inspection forms, and login UX improvements.

#### Email PDF Feature (New — 3 files)

Send any PDF report directly via email from within the app. Adds a mail button alongside the existing Export PDF button on all 10 PDF-capable pages.

- **API route** (`app/api/send-pdf-email/route.ts`) — POST endpoint accepting base64-encoded PDF, recipient email, filename, and subject. Uses Resend SDK with branded sender (`Glidepath <info@glidepathops.com>`)
- **Email utility** (`lib/email-pdf.ts`) — Client-side helper that converts jsPDF doc to base64 and POSTs to the API route
- **Email modal** (`components/ui/email-pdf-modal.tsx`) — Dark-themed modal with email input, validation, Send/Cancel buttons, loading state

#### PDF Generator Refactoring (8 files modified)

All PDF generators refactored to return `{ doc, filename }` instead of calling `doc.save()`, enabling callers to choose between download and email:

- `lib/pdf-export.ts` — `generateInspectionPdf`, `generateCombinedInspectionPdf`, `generateSpecialInspectionPdf`
- `lib/check-pdf.ts` — `generateCheckPdf`
- `lib/acsi-pdf.ts` — `generateAcsiPdf`
- `lib/waiver-pdf.ts` — `generateWaiverPdf`
- `lib/reports/daily-ops-pdf.ts` — `generateDailyOpsPdf`
- `lib/reports/aging-discrepancies-pdf.ts` — `generateAgingDiscrepanciesPdf`
- `lib/reports/discrepancy-trends-pdf.ts` — `generateDiscrepancyTrendsPdf`
- `lib/reports/open-discrepancies-pdf.ts` — `generateOpenDiscrepanciesPdf`

#### Default PDF Email Setting (New — 1 migration)

- **Database migration** (`2026030201_default_pdf_email.sql`) — Adds `default_pdf_email` column to `profiles` table
- **Installation context** — Exposes `defaultPdfEmail` and `updateDefaultPdfEmail()` via `useInstallation()` hook
- **Settings page** — Editable "DEFAULT PDF EMAIL" field in Profile section with save button and helper text
- **Email modal** — Accepts `defaultEmail` prop, pre-fills when modal opens (still editable per-send)
- **All 10 pages** — Pass `defaultPdfEmail` to `<EmailPdfModal>` via `useInstallation()` destructuring

Pages with email functionality:
- `app/(app)/inspections/[id]/page.tsx`
- `app/(app)/checks/[id]/page.tsx`
- `app/(app)/acsi/[id]/page.tsx`
- `app/(app)/waivers/[id]/page.tsx`
- `app/(app)/reports/daily/page.tsx`
- `app/(app)/reports/aging/page.tsx`
- `app/(app)/reports/trends/page.tsx`
- `app/(app)/reports/discrepancies/page.tsx`
- `app/(app)/discrepancies/page.tsx`
- `app/(app)/notams/page.tsx`

#### Map Standardization

- All Mapbox maps standardized to 3:4 portrait aspect ratio with 70vh max height
- Removed expand/collapse buttons from all map components
- Obstruction evaluation map centered and narrowed to 60% width
- Increased default zoom levels across all map views

#### Standalone Inspection Forms

- **Pre/Post Construction** (`/inspections/construction/new`) — Standalone form with project details, contractor, location, and area-specific checklist
- **Joint Monthly** (`/inspections/joint-monthly/new`) — Standalone form with multi-agency personnel attendance tracking
- All Inspections hub start buttons wired to correct form routes

#### Sidebar & Navigation

- Reorganized sidebar nav ordering and updated inspection labels
- Removed unused tab navigation patterns
- Profile section in settings collapsed by default, email hidden from profile display

#### Login UX

- Updated email placeholder from `name@mail.mil` to `name@email.com`
- Added note on create account screen: "Please use a personal email on a non-government network"

#### Files Created (4)
- `app/api/send-pdf-email/route.ts`
- `lib/email-pdf.ts`
- `components/ui/email-pdf-modal.tsx`
- `supabase/migrations/2026030201_default_pdf_email.sql`

#### Files Modified (22)
- 8 PDF generators — return `{ doc, filename }` instead of `doc.save()`
- 10 pages — email button, modal, default email prop
- `lib/installation-context.tsx` — `defaultPdfEmail` state + `updateDefaultPdfEmail()`
- `lib/supabase/types.ts` — `default_pdf_email` field on profiles
- `app/(app)/settings/page.tsx` — Default email field in profile section
- `app/login/page.tsx` — Placeholder and signup note

#### Version Sync
- Updated version to 2.12.0 in package.json, login/page.tsx, settings/page.tsx

---

## [2.11.0] — 2026-03-02

### ACSI Module, All Inspections Hub & Check Form Improvements

New Airfield Compliance and Safety Inspection (ACSI) module implementing the DAFMAN 13-204v2, Para 5.4.3 annual compliance inspection. Also adds a unified All Inspections navigation hub and several quality-of-life improvements to the check form and inspection workflow.

#### ACSI Module (New — 14 files)

Complete annual compliance inspection system with 10 sections and ~100 checklist items.

- **Form page** (`/acsi/new`) — 10 collapsible sections, Y/N/N/A toggle per item, per-item discrepancy documentation for failures (comment, work order, project, estimated cost/completion), photo upload on failed items, inspection team editor (AFM/CE/Safety + additional members), risk management certification with 3 signature blocks, general notes
- **Detail page** (`/acsi/[id]`) — Read-only view of completed/draft ACSI with color-coded response badges, discrepancy details inline, team/certification display, edit button for authorized roles
- **List page** (`/acsi`) — KPI badges (Total/Completed/In Progress/Draft), status filter, search, card list with display ID and pass/fail/na counts
- **PDF export** (`lib/acsi-pdf.ts`) — Full inspection report with section headers, parent/sub-field visual hierarchy using `didParseCell`/`didDrawCell` hooks, inline discrepancy photos and map thumbnails, team roster, risk certification
- **Excel export** (`lib/acsi-excel.ts`) — Multi-sheet workbook: Cover, Checklist (with discrepancy details), Inspection Team, Risk Cert
- **Draft persistence** (`lib/acsi-draft.ts`) — localStorage auto-save with 1-second debounce, DB auto-save on new inspection mount for immediate photo upload support, resume from draft on page load
- **Sub-components** — `acsi-section.tsx` (collapsible with progress counter), `acsi-item.tsx` (toggle + discrepancy expansion), `acsi-discrepancy-panel.tsx` (fields + photo picker), `acsi-team-editor.tsx` (role-based team), `acsi-risk-cert.tsx` (3 signature blocks), `acsi-location-map.tsx` (Mapbox pin placement, square aspect ratio)
- **Edit capability** — Authorized roles (Airfield Manager, Base Admin, System Admin) can edit any ACSI regardless of status
- **Sidebar nav** — Added "ACSI" entry with ShieldCheck icon after "Daily Inspections"

#### Database Migration
- **`2026030200_create_acsi_inspections.sql`** — `acsi_inspections` table with JSONB items/team/signatures, fiscal year, status workflow, pass/fail/na counts. Added `acsi_inspection_id` + `acsi_item_id` FK columns to `photos` table. RLS policies using existing helper functions.

#### All Inspections Hub
- **New page** (`/inspections/all`) — Navigation hub accessible from More menu with styled cards for each inspection type (Daily Airfield, ACSI, Pre/Post Construction, Joint Monthly). Each card has a "Start" button linking to the form and a "History" button linking to the list view.
- **More menu** — Added "All Inspections" as first item with link to `/inspections/all`

#### Airfield Check Improvements
- **Auto-save remark on complete** — When "Complete Check" is clicked, any pending remark text is automatically saved before finalizing
- **Removed Notes section** from check detail page (`checks/[id]/page.tsx`) — Section was not populated from the check form and created confusion

#### PDF Sub-Field Hierarchy
- **Parent/sub-field visual hierarchy** in ACSI PDF — Parent items (e.g., "5.5.1 ALSF-1") render as bold header rows with light blue-gray background, sub-fields render deeply indented showing only "(A) Operable", "(B) Properly Sited", "(C) Clear of Vegetation" labels
- Sub-field item numbers removed from # column per user preference
- Section headers have increased breathing room, post-section gaps widened

#### Spacing & Styling Polish
- All ACSI sections spaced further apart (gap 10→16)
- Inspection Team and Risk Cert sections have increased margins (20→28)
- Item # column widened (minWidth 48→64), sub-field indentation increased (20→28)
- Team editor and risk cert labels bolded (fontWeight 600→700)
- Reviewer block spacing increased across team editor and risk cert

#### Files Created (14)
- `app/(app)/acsi/page.tsx` — ACSI list page
- `app/(app)/acsi/new/page.tsx` — ACSI form page
- `app/(app)/acsi/[id]/page.tsx` — ACSI detail page
- `app/(app)/inspections/all/page.tsx` — All Inspections navigation hub
- `components/acsi/acsi-section.tsx` — Collapsible section wrapper
- `components/acsi/acsi-item.tsx` — Checklist item with Y/N/N/A toggle
- `components/acsi/acsi-discrepancy-panel.tsx` — Failure documentation panel
- `components/acsi/acsi-team-editor.tsx` — Inspection team editor
- `components/acsi/acsi-risk-cert.tsx` — Risk management certification
- `components/acsi/acsi-location-map.tsx` — Mapbox location pin map
- `lib/acsi-pdf.ts` — PDF export with didParseCell/didDrawCell hooks
- `lib/acsi-excel.ts` — Excel export (multi-sheet)
- `lib/acsi-draft.ts` — Draft persistence (localStorage + DB)
- `lib/supabase/acsi-inspections.ts` — CRUD module
- `supabase/migrations/2026030200_create_acsi_inspections.sql` — Migration

#### Files Modified (10)
- `lib/supabase/types.ts` — AcsiItem, AcsiTeamMember, AcsiSignatureBlock, AcsiDraftData, AcsiStatus types
- `lib/constants.ts` — ACSI_CHECKLIST_SECTIONS (10 sections, ~100 items), ACSI_STATUS_CONFIG, ACSI_TEAM_ROLES
- `lib/demo-data.ts` — DEMO_ACSI_INSPECTIONS (2 samples)
- `components/layout/sidebar-nav.tsx` — ACSI nav entry
- `app/(app)/more/page.tsx` — All Inspections menu item
- `app/(app)/checks/page.tsx` — Auto-save remark on complete
- `app/(app)/checks/[id]/page.tsx` — Removed Notes section
- `package.json` — Version bump to 2.11.0
- `app/login/page.tsx` — Version string update
- `app/(app)/settings/page.tsx` — Version string update

#### Version Sync
- Updated version to 2.11.0 in package.json, login/page.tsx, settings/page.tsx

---

## [2.10.0] — 2026-03-01

### Row-Level Security & Project Cleanup

Database-level role-based access control across all operational tables, replacing the previous app-layer-only enforcement. Also includes a comprehensive project audit and file cleanup.

#### RLS Implementation (4 Phased Migrations)
- **Phase 1** (`2026030100`) — Fixed `user_has_base_access()` with sys_admin bypass. Added `user_can_write()` and `user_is_admin()` helper functions. Policies for config tables (`bases`, `base_runways`, `base_navaids`, `base_areas`), `profiles`, `regulations`, `user_regulation_pdfs`
- **Phase 2** (`2026030101`) — Role-aware policies for 6 core operational tables: `discrepancies`, `inspections`, `airfield_checks`, `obstruction_evaluations`, `notams`, `waivers`
- **Phase 3** (`2026030102`) — Policies for `photos`, `status_updates`, `navaid_statuses`, `airfield_status`, `runway_status_log`, `base_members`. Special cases: `check_comments` (all base members can INSERT), `activity_log` (all can INSERT, own+admin can UPDATE/DELETE)
- **Phase 4** (`2026030103`) — FK-based access for waiver child tables (`waiver_criteria`, `waiver_attachments`, `waiver_reviews`, `waiver_coordination`), inspection template chain (`base_inspection_templates` → `base_inspection_sections` → `base_inspection_items`). Fixed `update_airfield_status()` RPC with `p_base_id` parameter

#### Role Hierarchy Enforced
| Tier | Roles | SELECT | INSERT/UPDATE/DELETE |
|------|-------|--------|----------------------|
| Super Admin | `sys_admin` | All bases | All bases |
| Base Admin | `base_admin`, `airfield_manager`, `namo` | Own base | Own base |
| Power User | `amops` | Own base | Own base |
| Specialist | `ces`, `safety`, `atc` | Own base | Comments only |
| Viewer | `read_only` | Own base | No |

#### Automated Smoke Tests
- Created and ran 7-test automated suite verifying: write restriction (CES blocked), write permission (AMOPS allowed), cross-base isolation, sys_admin bypass, comment special case, admin-vs-writable distinction
- All 7 tests passed. Results and full 50+ test checklist saved in `docs/RLS_TEST_CHECKLIST.md`

#### Map Views (Merged Feature Branches)
- **Discrepancy map view** — Satellite map with severity-colored pins, hover popups, List/Map toggle, severity legend, expand/collapse. New component: `discrepancy-map-view.tsx`
- **Obstruction map view** — Map view for obstruction history page. New component: `obstruction-map-view.tsx`
- **Waiver map view** — Map view with emoji markers by classification, clickable type filter. New component: `waiver-map-view.tsx`
- **Waiver location picker** — Click-to-place GPS picker for waiver create/edit/detail. New component: `waivers/location-map.tsx`
- **Zoom tuning** — Widened default zoom across all maps (discrepancies, waivers, obstructions)

#### Project Cleanup
- Moved `SESSION-HANDOFF-v2.8.0.md` to `docs/`
- Moved `rename-regulations.mjs` from `app/` to `scripts/`
- Moved `scrape_aircraft_images.py` to `scripts/`
- Moved `migration_aircraft_characteristics.sql` to `scripts/`
- Moved `AOMS_Regulation_Database_v4.docx` to `docs/`
- Deleted duplicate files: `AOMS_Regulation_Database_v4 (1).docx`, `app/AOMS_Regulation_Database_v4.docx`, `public/commercial_aircraft (1).json`, `public/military_aircraft (1).json`, `public/001_pdf_text_search.sql`, root `001_pdf_text_search.sql`

#### Migrations Added
- `2026030100_rls_phase1_helpers_and_config.sql`
- `2026030101_rls_phase2_operational_tables.sql`
- `2026030102_rls_phase3_supporting_tables.sql`
- `2026030103_rls_phase4_children_and_templates.sql`

---

## [2.9.0] — 2026-02-28

### Activity Log Overhaul, Header Consolidation & Login UX

Major enhancements to the activity log with manual entry support and full CRUD, header consolidation replacing the InfoBar component, user presence tracking, and login quality-of-life improvements.

#### Activity Log
- **Manual text entries** — Free-text notes for events not captured by the system. Input bar with "Add" button above the activity table. Inserts with `action: 'noted'`, `entity_type: 'manual'`
- **Edit/delete entries** — Modal dialog with Date, Time (Zulu), and Notes fields. Delete button in modal with confirmation. RLS policies added for update/delete operations
- **Columnar table display** — Time (Z), User, Action, Details columns grouped by date header rows, replacing the previous card-based layout
- **Column search filters** — Per-column text filters in table headers for narrowing results
- **Editable Zulu time** — Time displayed and editable in UTC (HH:MM Z format)
- **Enriched entity details** — Action and details show full context in both UI and Excel export
- **Proper action labels** — `manual: 'Manual Entry'`, `noted: 'Logged'`, `airfield_status: 'Runway'` across activity log, dashboard, and login dialog

#### Header Consolidation
- **InfoBar merged into header** — Installation name+ICAO (left) and user name+status (right) now live in the header. `InfoBar` component removed from layout
- **Installation switcher** — Dropdown in header for users with access to multiple installations (ChevronDown icon, dark-themed menu)
- **User presence tracking** — Online/Away/Inactive status based on `last_seen_at` with 5-minute polling interval
- **Styling refinements** — Reduced installation text size (`fs-sm`), compact dropdown padding, removed role badge, theme-aware username color (`var(--color-text-1)`)

#### Login Improvements
- **Remember me** — Checkbox on login page saves email to localStorage for next session
- **Login notification dialog** — Restructured from dot+card format to columnar table (Time Z, User, Action, Details) with date group headers. Proper capitalization for all action/entity labels. Fetches `metadata` for Details column

#### User Management
- **User deletion cascade** — Nullifies all FK references (12 columns across 10 tables) before deleting profile and auth record, preserving historical data
- **ON DELETE SET NULL migration** — `2026022802_user_delete_set_null.sql` drops NOT NULL constraints and adds ON DELETE SET NULL to all profile FK columns
- **Installation dropdown for all admins** — Invite user modal now shows full installation list for base_admin/AFM/NAMO, not just sys_admin

#### Reports & Dashboard
- **KPI badges** — Responsive badge grid across all report pages (daily, aging, trends, open discrepancies) with centered alignment
- **Clickable discrepancies** — Aging report discrepancies link to detail pages
- **Dashboard formatAction** — Added missing labels for manual entries, runway status, and noted actions
- **Navaid status styling** — Reduced from bold white (`fs-xl/700`) to muted (`fs-base/500/color-text-2`)

#### Responsive Fixes
- Collapsible sidebar behavior on iPad
- KPI badge overflow prevention
- Aircraft card layout wrapping fix

#### Migrations Added
- `2026022801_activity_log_update_delete_policies.sql` — RLS policies for activity log edit/delete
- `2026022802_user_delete_set_null.sql` — ON DELETE SET NULL for all profile FK columns

---

## [2.8.0] — 2026-02-28

### Responsive Layout — iPad & Desktop Optimization

Major responsive overhaul enabling full iPad and desktop usage. Previously locked to a 480px mobile layout, the app now adapts across three breakpoints (mobile, 768px tablet, 1024px desktop) while preserving the existing mobile experience.

#### Shell Layout
- **Permanent sidebar navigation** — 300px side panel on tablet+ with full descriptive labels
- **Sidebar header** — Replaced logo with stylized tagline "Guiding You to Mission Success"
- **App shell flex layout** — `app-shell` becomes horizontal flex on tablet+ (sidebar + main content column)
- **Bottom nav hidden** on tablet+ (sidebar replaces it)
- **Content area max-width** — 768px tablet, 1000px desktop, 1200px large desktop

#### Responsive CSS Utility Classes
- `.page-container` — Responsive padding (16px → 24px → 32px 40px)
- `.kpi-grid-2` / `.kpi-grid-3` — 2/3-col mobile → 4-col desktop
- `.card-list` — Flex column mobile → 2-col grid tablet+
- `.actions-row` — Vertical mobile → horizontal tablet+
- `.form-row` — Stacked mobile → side-by-side tablet+
- `.filter-bar` — Scrollable mobile → flex-wrap tablet+
- `.photo-grid` — 64px → 80px → 96px thumbnails
- `.detail-grid-2` — 2-col → 3-col → 4-col
- `.checklist-grid` — 1-col → 2-col on tablet+

#### Font Size Scaling
- 11 CSS custom properties (`--fs-2xs` through `--fs-5xl`) with responsive overrides
- 1,123 inline `fontSize` values replaced across 58 files

#### Map Components
- Responsive height via CSS vars with expand/collapse toggle
- Smooth transitions with Mapbox `resize()` call

---

## [2.7.0] — 2026-02-27

### Bug Fixes, PWA Hardening & Code Quality

#### Bug Fixes
- **Discrepancy photos not displaying** — Fixed photo URL construction (missing bucket name), `base_id` passthrough, and fallback resolution
- **Checks detail page** — Same URL bug fixed
- **FOD Walk → FOD Check** — PDF export label corrected

#### PWA / Android
- Android system navigation bar white gap resolved
- Service worker config updated for manifest.json
- Dark mode logo enlarged

#### Project Cleanup
- Sorted runtime caching in `next.config.js`
- Removed unused `@types/react-dom`
- Added `eslint-config-next`

---

## [2.6.0] — 2026-02-26

### Waiver Module — Full Lifecycle Management

Complete airfield waiver system modeled after AF Form 505 and AFCEC Playbook Appendix B. Six classification types, seven status values with mandatory comment dialogs, detail pages with criteria/coordination/photos/annual reviews, PDF and Excel export, annual review mode. Seeded with 17 real Selfridge ANGB (KMTC) historical waivers.

---

## [2.5.0] — 2026-02-25

### User Management & Admin System

Admin-only module with three-tier role hierarchy, user cards with rank/role/status, detail modal, email invitation, password reset, account lifecycle management.

---

## [2.4.0] — 2026-02-24

### Aircraft Database & Reports

200+ military and civilian aircraft entries with search, sort, favorites, ACN/PCN comparison. Four report types with PDF export (Daily Ops, Open Discrepancies, Trends, Aging).

---

## [2.3.0] — 2026-02-23

### Obstruction Evaluations

UFC 3-260-01 Class B imaginary surface analysis with multi-runway support, 10 surfaces, interactive Mapbox overlays, geodesic calculations, photo documentation.

---

## [2.2.0] — 2026-02-22

### NOTAMs & Regulations

Live FAA NOTAM feed, ICAO search, filter chips, local NOTAM drafting. Regulatory reference library with 70+ entries, in-app PDF viewer, offline caching, My Documents tab.

---

## [2.1.0] — 2026-02-21

### Inspections & Checks

Daily inspection forms with configurable templates. 7 airfield check types. Photo capture, map location, draft persistence, PDF export.

---

## [2.0.0] — 2026-02-20

### Foundation

Next.js App Router with Supabase backend. Multi-base architecture, dashboard with weather/runway status/advisory, discrepancy tracking, light/dark/auto theme, PWA with offline caching, demo mode.
