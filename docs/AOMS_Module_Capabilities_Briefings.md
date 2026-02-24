# AOMS Module Capabilities Briefings

**Airfield Operations Management System (AOMS)**
Consolidated Module Capabilities Document

---

## Table of Contents

1. [Homepage / Dashboard](#1-homepage--dashboard)
2. [Inspections](#2-inspections)
3. [Airfield Checks](#3-airfield-checks)
4. [Discrepancies](#4-discrepancies)
5. [Obstructions](#5-obstructions)
6. [Regulations / References](#6-regulations--references)
7. [Aircraft Database](#7-aircraft-database)

---

## 1. Homepage / Dashboard

### Purpose

The Homepage serves as the real-time command center for airfield operations, providing at-a-glance situational awareness of current airfield conditions, operational status, navigational aid health, and recent activity across all modules.

### Capabilities

**Real-Time Clock & User Presence**
- Displays current local time (HH:MM) with auto-refresh every second
- Shows the logged-in user's name and rank (e.g., "MSgt Proctor")
- User presence status indicator (Online / Away / Inactive) based on last activity timestamp
  - Online: active within 15 minutes
  - Away: active within 60 minutes
  - Inactive: no activity for 60+ minutes
- Automatically updates the user's `last_seen_at` field in the database every 5 minutes

**Live Weather Strip**
- Fetches current weather conditions from an external weather API on page load
- Displays: temperature (°F), weather conditions description, wind speed (mph), and visibility (SM)
- Weather-appropriate emoji icon based on conditions (thunderstorm, snow, rain, fog, overcast, clear, etc.)
- Graceful fallback display when weather data is unavailable

**Advisory System**
- Three advisory severity levels: INFO (blue), CAUTION (yellow), WARNING (red)
- Tappable advisory banner when an active advisory is set, displaying type and descriptive text
- Advisory management dialog accessible from the weather strip:
  - Set advisory type via color-coded selector buttons
  - Enter advisory text
  - Save, clear, or cancel actions

**Current Status Panel**
- **Active Runway Toggle**: Single-tap toggle between RWY 01 and RWY 19
- **Runway Status**: Dropdown selector with three states — Open (green), Suspended (yellow), Closed (red)
  - Card background dynamically changes color based on runway status
- **RSC (Runway Surface Condition)**: Displays the most recent RSC reading with condition and timestamp (e.g., "Dry @ 14:30")
- **BWC (Bird Watch Condition)**: Displays the most recent BWC value from inspections with color-coded severity (LOW/green, MOD/yellow, SEV/orange, PROHIB/red)

**NAVAID Status Panel**
- Split display for RWY 01 and RWY 19 navigational aids
- Each NAVAID displays a toggle button cycling through three states:
  - Green (G) — Operational
  - Yellow (Y) — Degraded
  - Red (R) — Inoperative
- NAVAIDs sorted with ILS prioritized at top
- NAVAID Notes section: auto-appears when any NAVAID is flagged yellow or red
  - Auto-expanding text areas for each flagged NAVAID
  - Notes save on blur or Enter key
  - Persists to Supabase database

**Last Check Completed**
- Shows the most recent airfield check type and completion time (e.g., "RSC @ 14:30")
- Queries the `airfield_checks` table ordered by `completed_at`

**Quick Actions**
- Three prominent action buttons linking directly to key workflows:
  - Begin/Continue Airfield Inspection → `/inspections?action=begin`
  - Begin Airfield Check → `/checks`
  - New Discrepancy → `/discrepancies/new`

**Recent Activity Feed**
- Displays the 20 most recent activity log entries across all modules
- Each entry shows: user name/rank, action type, entity type with display ID, and timestamp
- Action types are color-coded: Created (green), Completed (cyan), Updated (yellow), Status Changed (purple), Deleted (red)
- Collapsible — shows 3 entries by default with "Show All" toggle
- Fetches from `activity_log` table with profile join for user names

### Data Sources
- Supabase: `profiles`, `inspections`, `airfield_checks`, `activity_log`, `navaid_statuses`
- External: Weather API (Open-Meteo)

---

## 2. Inspections

### Purpose

The Inspections module provides a digital replacement for paper-based airfield and lighting inspection checklists. It supports the full inspection lifecycle — from initiating a new daily inspection through completion, filing, and historical review — in compliance with DAFI 13-213 requirements.

### Capabilities

**Daily Inspection Workflow**
- Begin a new daily inspection from the Homepage quick action or the Inspections page
- Two-tab inspection structure:
  - **Airfield Inspection**: Comprehensive checklist covering runway surfaces, taxiways, lighting, markings, NAVAIDs, barriers, and general conditions
  - **Lighting Inspection**: Dedicated nighttime lighting checklist
- Draft auto-save: inspection state persists to localStorage, surviving page refreshes and navigation
- URL-driven auto-begin: navigating with `?action=begin` automatically creates a new draft if none exists

**Inspection Checklist System**
- Structured checklist organized by numbered sections (e.g., "1. Runway Surfaces", "2. Taxiways")
- Per-item tri-state toggle: Pass (green checkmark) → Fail (red X) → N/A (gray, strikethrough) → Clear
- "Mark All Pass" bulk action to rapidly complete routine inspections
- Progress tracking: real-time percentage wheel with item counts (answered/total)
- Status breakdown: Pass count, Fail count, N/A count displayed
- Failed items automatically reveal a comment text area for discrepancy documentation
- Section-level progress indicators showing completion status per section
- Section guidance text displayed as italic sub-headers where applicable

**BWC (Bird Watch Condition) Assessment**
- Dedicated BWC item within the checklist
- Four selectable condition levels: LOW, MOD, SEV, PROHIB
- Color-coded buttons matching severity (green, yellow, orange, red)
- Toggle behavior — tap again to deselect

**Special Inspection Modes**
- **Pre/Post Construction Meeting Inspection**: Toggleable optional section that replaces the standard checklist
- **Joint Monthly Airfield Inspection**: Toggleable optional section that replaces the standard checklist
- Mutually exclusive — enabling one automatically disables the other
- Special modes include:
  - Personnel/Offices Present multi-select checklist with representative name fields
  - Free-form comments text area
  - Filed as standalone records (not paired as daily groups)

**Auto-Captured Metadata**
- Weather conditions and temperature automatically fetched and attached when saving
- Inspector name and ID automatically populated from the authenticated user's profile
- Timestamp recorded at save time

**Save & File Workflow**
- **Save**: Captures the current tab's checklist state, weather, and inspector info; does not close the draft
- **File**: Submits both saved halves (airfield + lighting) to the database, generating permanent inspection records
  - Each inspection half gets a unique display ID (e.g., AI-25-a3f4, LI-25-b7c2)
  - Daily group ID links airfield and lighting halves together
  - Clears the local draft and navigates to the filed inspection detail page

**Inspection History**
- List view of all filed inspection reports, sorted by completion date (newest first)
- Grouped daily reports: paired airfield + lighting inspections display as a single "Airfield Inspection Report" card
- Report cards display:
  - Type badges (Airfield/Lighting/Construction/Joint Monthly)
  - Display IDs for each half
  - Pass/Fail/N/A counts with total items
  - BWC value badge (color-coded)
  - Inspector name, weather conditions, temperature, and timestamp
- Filter chips: All, Airfield, Lighting
- Search across display IDs, inspector name, weather, type, BWC, personnel
- Tap any report card to navigate to its detail view

**Inspection Detail View**
- Full read-only view of a completed inspection
- All checklist items displayed with Pass/Fail/N/A status and any attached comments
- Construction Meeting and Joint Monthly inspections display personnel list and comments
- Paired daily group navigation (view the other half of a daily inspection)

### Data Sources
- Supabase: `inspections` table
- localStorage: draft persistence via `inspection-draft` module
- External: Weather API for auto-capture

---

## 3. Airfield Checks

### Purpose

The Airfield Checks module enables rapid documentation of routine and event-driven airfield checks as required by DAFI 13-213 and UFC 3-260-01. It supports seven distinct check types, each with type-specific data fields, and provides a streamlined mobile-first workflow for field use.

### Capabilities

**Seven Check Types**
Each check type presents a purpose-built data entry form:

1. **FOD (Foreign Object Debris)**
   - General FOD walk documentation
   - FOD items documented via the remarks section
   - Areas checked selection

2. **RSC (Runway Surface Condition)**
   - Binary condition selector: Dry or Wet
   - Visual buttons with weather icons
   - Condition value saved to enable dashboard display

3. **RCR (Runway Condition Reading)**
   - Numeric RCR value input (large monospace display for readability)
   - Condition type dropdown (e.g., Dry, Wet, Slush, Snow, Ice)

4. **BASH (Bird/Animal Strike Hazard)**
   - Three-level condition code: LOW (green), MODERATE (yellow), SEVERE (red)
   - Species observation text area for documenting wildlife activity

5. **IFE (In-Flight Emergency)**
   - Aircraft type and callsign fields
   - Nature of emergency description
   - AM Action Checklist: multi-select checklist of required actions
   - Agency Notifications: multi-select badges for notified agencies (Fire Dept, Tower, SOF, MOC, Command Post, Security Forces, Medical, Safety)

6. **Ground Emergency**
   - Aircraft type field (optional — may not involve aircraft)
   - Nature of emergency description
   - AM Action Checklist (same as IFE)
   - Agency Notifications (same as IFE)

7. **Heavy Aircraft**
   - Aircraft type / MDS entry field (e.g., "C-17A Globemaster III")

**Areas Checked Multi-Select**
- Pre-defined list of airfield areas (runways, taxiways, aprons, overruns, etc.)
- Toggle-style chip buttons with count indicator
- Required: at least one area must be selected before completing a check

**Issue Found Workflow**
- Toggle button: "Issue Found"
- When activated, reveals:
  - **Location Map**: Interactive Mapbox map for pinning the issue location with lat/lon coordinates
  - **Photo Section**: Upload from gallery or take photo with camera
    - Photo thumbnails with individual delete buttons
    - Multi-photo support

**Remarks System**
- Timestamped remark entries with user attribution
- Add remarks via text area with Enter-to-save keyboard shortcut
- Remarks displayed in reverse chronological order with left border accent
- Each remark shows: user name, date/time, and comment text

**Check Completion**
- Validation: requires check type and at least one area selected
- Saves to `airfield_checks` table with all type-specific data, comments, location, and photos
- Photos uploaded to Supabase storage with per-photo error handling
- Generates a unique display ID
- Navigates to the completed check detail view
- Records attributed to the completing user (e.g., "MSgt Proctor")

**Check History**
- Accessible via "Check History" button
- View all previously completed checks

**Airfield Diagram**
- Placeholder button for viewing the installation airfield diagram (image pending)

### Data Sources
- Supabase: `airfield_checks`, `check_comments`, `photos` tables
- Supabase Storage: photo uploads
- Constants: `CHECK_TYPE_CONFIG`, `AIRFIELD_AREAS`, `RSC_CONDITIONS`, `RCR_CONDITION_TYPES`, `BASH_CONDITION_CODES`, `EMERGENCY_ACTIONS`, `EMERGENCY_AGENCIES`

---

## 4. Discrepancies

### Purpose

The Discrepancies module provides a comprehensive work order tracking system for documenting, managing, and resolving airfield discrepancies. It supports the full discrepancy lifecycle from initial discovery through resolution, with built-in status tracking, severity classification, photo documentation, and work order management.

### Capabilities

**Discrepancy Dashboard**
- Two KPI badges at the top:
  - **OPEN**: Count of all open discrepancies (yellow, tappable to filter)
  - **> 30 DAYS**: Count of open discrepancies older than 30 days (red when > 0, green when 0, tappable to filter)
- Dynamic days-open calculation from creation timestamp

**Filtering & Search**
- Status filter chips: Open, Completed, Cancelled, All
- "> 30 Days" toggle filter for overdue items
- Full-text search across title, description, and work order number

**Discrepancy List**
- Card-based display with color-coded severity badges
- Each discrepancy card shows:
  - Display ID (e.g., "DR-25-f8a3")
  - Title and severity level
  - Location text
  - Assigned shop
  - Days open counter
  - Photo count indicator
  - Work order number (if assigned)
- Cards link to individual discrepancy detail pages

**Discrepancy Creation**
- "New" button navigates to the discrepancy creation form
- Fields include: title, description, severity, location (map pin), photos, assigned shop
- Location pinning via interactive Mapbox map
- Photo upload and camera capture support

**Discrepancy Detail View**
- Full discrepancy information display
- Status workflow tracking: submitted_to_afm → submitted_to_ces → awaiting_action_by_ces → work_completed_awaiting_verification
- Status update controls for progressing discrepancies through the workflow
- Photo gallery with full-size viewing
- Work order number tracking
- NOTAM linkage
- Comment/update history

**Severity Classification**
- Severity levels: Critical, High, Medium, Low, Yes/No (binary)
- Color-coded throughout the interface

**Demo Mode**
- Falls back to demonstration data when Supabase is not configured
- Allows full UI exploration without a database connection

### Data Sources
- Supabase: `discrepancies`, `photos`, `status_updates` tables
- Demo data: `DEMO_DISCREPANCIES` for offline/demo mode

---

## 5. Obstructions

### Purpose

The Obstructions module implements a complete UFC 3-260-01 imaginary surface analysis tool for evaluating potential airfield obstructions against Air Force Class B runway criteria. It calculates whether a proposed or existing obstruction violates any of the eight imaginary surfaces defined in UFC 3-260-01, Chapter 3, and provides detailed per-surface analysis results.

### Capabilities

**Interactive Airfield Map**
- Mapbox GL JS satellite imagery map centered on the installation
- Rendered imaginary surface overlays (fill + outline layers) showing all eight surfaces:
  - Runway (innermost)
  - Primary Surface
  - Clear Zone
  - Graded Area of Clear Zone
  - Approach-Departure Surface (50:1)
  - Transitional Surface (7:1)
  - Inner Horizontal Surface (150 ft)
  - Conical Surface (20:1)
  - Outer Horizontal Surface (500 ft)
- Color-coded legend for all surface layers
- Tap-to-select point for obstruction location
- Selected point marker (green for no violation, red for violation)

**Automatic Ground Elevation**
- On point selection, fetches real ground elevation (MSL) from the Open-Elevation API
- Falls back to airfield elevation when the API is unavailable
- Displays loading state during elevation fetch

**Point Information Card**
- Coordinates (lat/lon)
- Distance from runway centerline (ft)
- Distance from nearest threshold (ft) with runway end identifier
- Ground elevation (ft MSL)
- Surface zone identification at the selected point

**Obstruction Evaluation Form**
- Obstruction height input (ft AGL) — required
- Obstruction description text area
- Photo documentation: upload from gallery or take photo with camera
  - Multi-photo support with thumbnail preview and individual delete
  - Photo compression for efficient database storage

**Evaluation Engine**
- Evaluates the obstruction against all eight imaginary surfaces simultaneously
- For each surface, calculates:
  - Whether the point falls within the surface boundaries
  - Maximum allowable height (ft AGL and ft MSL)
  - Whether a violation exists
  - Penetration depth (ft) if violated
  - Applicable UFC reference and criteria text
- Determines the controlling surface (lowest height restriction at that point)
- Identifies land-use zones (Clear Zone, Graded Area) with "WITHIN ZONE" designation rather than height violations

**Surface Analysis Results**
- **Summary Banner**: VIOLATION DETECTED (red) or NO VIOLATION (green)
  - Controlling surface identification
  - Quick stats: Obstruction Top MSL, Max Allowable MSL, Centerline Distance
- **Per-Surface Breakdown** (applicable surfaces):
  - Color-coded surface dot
  - Surface name
  - CLEAR / VIOLATION (with penetration depth) / WITHIN ZONE badge
  - Maximum allowable height (MSL and AGL)
  - UFC reference citation
- **Non-Applicable Surfaces**: Collapsed list of surfaces the point does not fall within
- **UFC References Card** (violations only): Detailed violation information with full UFC reference, penetration depth, and criteria text

**Save & Update**
- Save evaluation results to the `obstruction_evaluations` table
- Edit mode: load and re-evaluate existing saved evaluations
- Navigates to the evaluation detail page after saving

**Evaluation History**
- Access via "History" link
- Browse all previously saved obstruction evaluations

**Geometry Engine**
- Runway polygon generation from endpoint coordinates
- Primary surface polygon (1,000 ft wide, extends 200 ft beyond each end)
- Clear Zone polygons (3,000 ft × 3,000 ft trapezoids at each runway end)
- Graded Area polygons (portion of Clear Zone)
- Approach-Departure surface polygons (50:1 slope extending 50,000 ft)
- Transitional surface polygons (7:1 slope from primary surface edges)
- Stadium-shaped polygons for Inner Horizontal (7,500 ft radius) and Outer Horizontal (30,000 ft radius) surfaces
- Conical surface ring between Inner and Outer Horizontal
- Point-to-runway relation computation (nearest end, centerline distance)
- All dimensions per UFC 3-260-01, Table 3-1 for Air Force Class B runways

### Data Sources
- Supabase: `obstruction_evaluations` table
- External: Open-Elevation API for ground elevation data
- Constants: `INSTALLATION` (runway coordinates, elevation, dimensions)

---

## 6. Regulations / References

### Purpose

The Regulations module provides a centralized digital library of all applicable regulations, instructions, and technical references for airfield operations. It supports search, filtering, categorization, favorites, offline caching, and in-app PDF viewing. It also includes a personal document upload feature for user-specific references.

### Capabilities

**Two-Tab Interface**
- **References Tab**: Organization-wide regulations and publications
- **My Documents Tab**: User-uploaded personal PDFs and images

### References Tab

**Search & Discovery**
- Full-text search across regulation IDs, titles, descriptions, and tags
- Clear button for quick search reset

**Filtering System**
- Category filter dropdown (e.g., Airfield Ops, Safety, Engineering, Medical, Weather, etc.)
- Publication type filter dropdown (e.g., DAF, DAFI, UFC, ETL, AFI, AFMAN, TO, etc.)
- Active filter indicator with one-tap clear
- Combinable: search + category + pub type filters work together

**Favorites System**
- Star toggle on each reference card for quick bookmarking
- Favorites filter button to show only starred references
- Favorite count badge
- Favorites persist to localStorage across sessions
- Settings option: "Show favorites by default" toggle

**Reference Cards**
- Collapsed view: Reg ID (e.g., "UFC 3-260-01"), title, category badge, pub type badge, publication date
- Expanded view (tap to expand):
  - Full description
  - Publication type, source volume, publication date
  - Tags (tappable to search by tag)
  - Action buttons: View in App, Open External
  - Admin actions (sys_admin only): Delete with confirmation dialog

**In-App PDF Viewer**
- Embedded PDF viewing experience without leaving the application
- Supports both external URL PDFs and Supabase-stored PDFs
- Separate viewer component (`RegulationPDFViewer`)

**Offline Caching System**
- "Cache All" button to download all PDFs to IndexedDB for offline access
- Progress bar during bulk download with error tracking
- Cached count display (e.g., "42 of 48 cached for offline use")
- Abort capability during bulk download
- "Clear Cache" button to free storage space
- Per-reference cache status tracking
- Uses IndexedDB blob storage for efficient PDF caching

**Admin Capabilities (sys_admin role)**
- **Add Reference**: Full modal form with fields for:
  - Reg ID, Title, Description (required)
  - Source Section (auto-derives volume and boolean flags)
  - Category, Publication Type, Publication Date
  - External URL
  - Tags (comma-separated)
  - PDF file upload to Supabase Storage
- **Delete Reference**: Confirmation dialog, removes from database + storage + cache
- Duplicate detection on Reg ID

**Data Sources**
- Static: `ALL_REGULATIONS` array (fallback)
- Supabase: `regulations` table (primary when connected)
- Supabase Storage: `regulation-pdfs` bucket
- IndexedDB: cached PDF blobs
- localStorage: favorites, favorites-default setting

### My Documents Tab

**Personal Document Management**
- Upload personal PDF, JPG, or PNG files (up to 50 MB)
- Documents stored in Supabase Storage under the user's directory
- Document metadata tracked in `user_regulation_pdfs` table

**Document Cards**
- Display name, file size, page count, upload date
- Status badges: Ready, Processing, Failed
- Cache indicator badge
- Action buttons: View, Cache/Uncache, Delete

**Offline Caching**
- Per-document cache/uncache toggle
- Cached documents available offline via IndexedDB
- Visual cache status on each document card

**In-App Viewing**
- View uploaded documents using the same PDF viewer component
- Supports both PDF and image file viewing

---

## 7. Aircraft Database

### Purpose

The Aircraft Database module provides a comprehensive reference of military and commercial aircraft specifications, focused on the data points most relevant to airfield operations: dimensions, weights, turn geometry, landing gear configuration, and pavement load analysis (ACN/PCN comparison).

### Capabilities

**Aircraft Library**
- Complete database of military and commercial aircraft
- Total aircraft count displayed with category breakdown (e.g., "210 aircraft - 140 military - 70 commercial")

**Search**
- Full-text search across aircraft name, manufacturer, and gear configuration
- Search spans all categories regardless of the active tab
- Clear button for quick reset

**Category Tabs**
- Military / Commercial / All category filters
- Count displayed on each tab
- Category filter applied only when not searching (search overrides to search all)

**Sort & Filter Panel**
- Toggleable sort/filter panel
- Sort options: Name, Wingspan, Length, Height, Max Takeoff Weight, Group Index
- Direction toggle (ascending/descending) by tapping the active sort field
- Pinned (favorite) aircraft always appear at the top regardless of sort

**Favorites / Pinning System**
- Star toggle on each aircraft card
- Pinned aircraft appear at the top of results
- "Show pinned only" filter button with pinned count
- Favorites persist to localStorage across sessions

**Aircraft Detail Cards**
- Collapsed view: Aircraft name, group index, category badge (military shield / commercial plane icon)
- Expandable detail view with comprehensive data sections:

  **Dimensions**
  - Wingspan (ft), Length (ft), Height (ft)
  - Displayed in a compact 3-column grid

  **Aircraft Image**
  - Full-width 16:9 image when available
  - Optimized loading with Next.js Image component

  **Action Buttons**
  - Pin/Unpin toggle
  - ACN/PCN comparison panel toggle

  **Turn Data**
  - Pivot Point (ft)
  - Turn Radius (ft)
  - 180° Turn Diameter (ft)
  - Controlling Gear designation

  **Weights**
  - Empty Weight (klbs)
  - Mission Takeoff Weight (military only, klbs)
  - Max Takeoff Weight (klbs)
  - Mission Landing Weight (military only, klbs)
  - Max Landing Weight (klbs)

  **Performance** (military only, when available)
  - Takeoff Distance (ft)
  - Landing Distance (ft)

  **Landing Gear**
  - Gear configuration description
  - Nose assemblies/tires configuration
  - Main assemblies/tires configuration
  - Main Gear detail: % Gross Load, Max Assembly Load, Max Wheel Load, Contact Pressure (PSI), Contact Area (sq in), Footprint Width (in)
  - Nose Gear detail: same metrics as Main Gear

**ACN/PCN Comparison Tool**
- Integrated per-aircraft pavement load analysis panel
- Input parameters:
  - **Weight Condition**: Max Weight / Min Weight toggle (shows actual weight value)
  - **Pavement Type**: Rigid (K) / Flexible (CBR) toggle
  - **Subgrade Strength**: A (High) / B (Medium) / C (Low) / D (Ultra-Low) with actual K or CBR values displayed
  - **Airfield PCN**: Numeric input for your installation's Pavement Classification Number
- Instant result calculation:
  - **PASS** (green): ACN ≤ PCN — aircraft is within pavement capacity
  - **EXCEEDS** (red): ACN > PCN — aircraft exceeds pavement capacity
- Shows current ACN value with all selected parameters
- **Full ACN Value Table**: Complete matrix showing all ACN values across:
  - Conditions: Max Rigid, Max Flex, Min Rigid, Min Flex
  - Subgrades: A, B, C, D
  - Currently selected combination highlighted in the table
- "No ACN data available" fallback for aircraft without ACN data

### Data Sources
- Static: `allAircraft` array from `aircraft-data` module
- localStorage: favorites persistence
- Aircraft schema: `AircraftCharacteristics` type with full specification fields

---

## Cross-Cutting Capabilities

### Authentication & User Management
- Supabase Auth integration for user authentication
- User profiles with name, rank, and role (observer, operator, admin, sys_admin)
- Role-based access control for administrative features (e.g., regulation management)
- User presence tracking via `last_seen_at` timestamp

### Activity Logging
- All CRUD operations across modules are logged to the `activity_log` table
- Logged actions: created, updated, deleted, completed, status_updated
- Tracked entity types: discrepancy, check, inspection, obstruction_evaluation
- User attribution with display ID for traceability
- Feeds the Homepage activity feed

### Offline Capability
- localStorage: inspection drafts, aircraft favorites, regulation favorites, user preferences
- IndexedDB: cached PDF documents for offline regulation access
- Demo data fallback for inspections and discrepancies when Supabase is unavailable

### Mobile-First Design
- All modules built with a mobile-first responsive design
- Touch-optimized: large tap targets, toggle buttons, swipe-friendly cards
- Camera integration for photo capture on checks, discrepancies, and obstructions
- Bottom padding on all pages for mobile navigation bar clearance

### Data Persistence
- **Supabase (PostgreSQL)**: Primary data store for all entities
- **Supabase Storage**: Photo uploads, regulation PDFs, user documents
- **localStorage**: Client-side preferences, drafts, and favorites
- **IndexedDB**: Large binary caching (PDF documents)

### Display ID System
- Human-readable identifiers across all entities
- Format: `PREFIX-YEAR-HASH` (e.g., AI-25-a3f4, DR-25-f8a3)
- Prefixes: AI (Airfield Inspection), LI (Lighting Inspection), CM (Construction Meeting), JM (Joint Monthly), DR (Discrepancy), CK (Check)
- Generated server-side via `generate_display_id()` PostgreSQL function
