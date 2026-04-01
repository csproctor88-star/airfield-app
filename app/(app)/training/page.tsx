'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronDown, ChevronRight, ExternalLink, Rocket, BookOpen, LayoutDashboard, Radio, Activity, Zap, ListChecks, ClipboardCheck, ClipboardList, Bird, HardHat, PlaneLanding, AlertTriangle, MapPin, Database, Shield, Lightbulb, Plane, FileText, BarChart3, Settings, Users } from 'lucide-react'

// ── Training content data ──

const QUICK_START_STEPS = [
  {
    number: '01',
    title: 'Sign In & Select Your Installation',
    description: 'Log in with your credentials. If you have access to multiple installations, use the installation switcher in the top-left header to select your base. Your selection persists across sessions.',
  },
  {
    number: '02',
    title: 'Familiarize Yourself with the Airfield Status Page',
    description: 'The home screen is your real-time operational hub. Check current weather conditions, active weather advisories, runway status (Open/Suspended/Closed), NAVAID status panels, and key performance indicators at a glance.',
  },
  {
    number: '03',
    title: 'Navigate Using the Sidebar or Bottom Nav',
    description: 'On desktop/tablet, use the permanent sidebar organized into Operations, Airfield Management, Reference, and Settings sections. On mobile, use the bottom navigation bar for quick access to Status, Dashboard, Obstructions, Events Log, and the More menu for everything else.',
  },
  {
    number: '04',
    title: 'Begin Your Shift',
    description: 'Open the Dashboard to view your shift checklist, recent activity, and operational KPIs. Check the Shift Checklist to mark items complete for your shift. Review any open discrepancies that need attention.',
  },
  {
    number: '05',
    title: 'Conduct Checks & Inspections',
    description: 'Use Airfield Checks for FOD checks, RSC/RCR readings, emergencies, and BASH observations. Use All Inspections to start daily airfield/lighting inspections or annual ACSI inspections. Failed items automatically create discrepancies for tracking.',
  },
  {
    number: '06',
    title: 'Track & Resolve Discrepancies',
    description: 'Log new discrepancies with type, severity, photos, and GPS location. Track them through the full lifecycle from Open to Closed. Use the Map View for a common operating picture of all airfield issues.',
  },
  {
    number: '07',
    title: 'Generate Reports & Export Data',
    description: 'Access Reports & Analytics for daily operations summaries, discrepancy reports, trend analysis, aging reports, and the 30-day analytics dashboard. All reports support PDF export and email delivery.',
  },
]

type Screenshot = {
  src: string
  caption: string
}

type ModuleRef = {
  id: string
  name: string
  icon: typeof Radio
  color: string
  path: string
  tagline: string
  overview: string
  keyFeatures: string[]
  howToAccess: string
  screenshots?: Screenshot[]
  tips?: string[]
}

const MODULES: ModuleRef[] = [
  {
    id: 'airfield-status',
    name: 'Airfield Status',
    icon: Radio,
    color: '#38BDF8',
    path: '/',
    tagline: 'Real-time operational hub',
    overview: 'The Airfield Status page is your primary command screen. It displays live weather data from Open-Meteo, the current advisory system (INFO/CAUTION/WARNING with effective times), active runway status with color-coded indicators, NAVAID status panels with green/yellow/red toggles, and a live Zulu clock. All status changes push to connected users in real time via Supabase Realtime.',
    keyFeatures: [
      'Live weather — temperature, wind speed, visibility, and conditions updated automatically',
      'Advisory system — create INFO, CAUTION, or WARNING advisories with effective start/end times (Zulu)',
      'Runway status — toggle between Open, Suspended, and Closed with automatic audit logging',
      'NAVAID status panels — side-by-side green/yellow/red toggles with notes for each NAVAID',
      'KPI badge grid — at-a-glance metrics for inspections, checks, discrepancies, and more',
      'User presence tracking — see who is Online, Away, or Inactive',
    ],
    howToAccess: 'This is the home page. Tap the Status tab on mobile or click Airfield Status in the sidebar.',
    screenshots: [
      { src: '/training/airfield-status_1.png', caption: 'Airfield Status page showing weather, runway status, NAVAID panels, ARFF status, and personnel tracking' },
    ],
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    icon: LayoutDashboard,
    color: '#38BDF8',
    path: '/dashboard',
    tagline: 'Shift management and activity feed',
    overview: 'The Dashboard provides a shift-focused operational view with quick actions, a collapsible log entry form, and a color-coded activity feed. It shows your current inspection status, recent checks, and provides one-tap access to start inspections, checks, or new discrepancies.',
    keyFeatures: [
      'Quick Actions — inspection status strip with pill buttons for starting checks and discrepancies',
      'Last Check Completed — shows the most recent check type, inspector, and timestamp',
      'Log Entry — collapsed by default, expand to create manual log entries or use templates',
      'Activity feed — color-coded by type (cyan for checks, yellow for discrepancies, green for completed, etc.)',
      'Template-based logging — pre-built templates for NOTAM Issued, Shift Change, SCN Check Complete, and more',
    ],
    howToAccess: 'Tap Dashboard on the bottom nav or click Dashboard in the sidebar.',
    screenshots: [
      { src: '/training/dashboard_1.png', caption: 'Dashboard with inspection status, quick action pills, and color-coded activity feed' },
    ],
  },
  {
    id: 'events-log',
    name: 'Events Log',
    icon: Activity,
    color: '#34D399',
    path: '/activity',
    tagline: 'Complete operational activity history',
    overview: 'The Events Log captures every operational action across the installation — status changes, checks, inspections, discrepancy updates, QRC executions, manual entries, and more. All entries include Zulu timestamps, operating initials, and action details. The log supports filtering, search, and exports to both PDF and Excel.',
    keyFeatures: [
      'Comprehensive audit trail — every action logged with Zulu timestamp and user attribution',
      'Color-coded ACTION column — instantly identify entry types by color',
      'Operating initials — click to reveal the full name behind each OI entry',
      'Template-aware labels — entries from templates show the exact template name',
      'Export to Excel with color-coded rows matching the on-screen display',
      'Filter by date range, action type, or search by keyword',
    ],
    howToAccess: 'Tap Events Log on the bottom nav or click Events Log in the sidebar.',
    screenshots: [
      { src: '/training/events-log_1.png', caption: 'Events Log with color-coded actions, Zulu timestamps, and operating initials' },
    ],
  },
  {
    id: 'qrc',
    name: 'Quick Reaction Checklists',
    icon: Zap,
    color: '#EAB308',
    path: '/qrc',
    tagline: 'Emergency and operational checklists',
    overview: 'Execute 25 digitized Quick Reaction Checklists for airfield emergencies and operational events. QRCs include IFE response, aircraft mishap, bird strike, tornado warning, and many more. Each checklist features step-by-step execution with checkboxes, agency notification tracking, time logging, and SCN (Secondary Crash Net) data entry for applicable emergencies.',
    keyFeatures: [
      'Three tabs — Available (start new), Active (in progress), History (completed/cancelled)',
      '6 step types — checkbox, checkbox with note, agency notification, fill-in, time field, conditional cross-reference',
      'SCN form — data entry fields for emergencies requiring Secondary Crash Net activation',
      'Open → Close lifecycle with initials and Zulu timestamp on completion',
      'Cancel option for accidental openings — permanently removes the execution',
      'Activity log integration — QRC start/close events appear in Events Log and Daily Ops Report',
    ],
    howToAccess: 'Navigate to Operations > QRC in the sidebar, or find it under Operations in the More menu.',
    screenshots: [
      { src: '/training/qrc-available_1.png', caption: 'QRC Available tab — select a checklist to begin execution' },
      { src: '/training/qrc-active_1.png', caption: 'Active QRC execution with step-by-step checklist' },
    ],
  },
  {
    id: 'shift-checklist',
    name: 'Shift Checklist',
    icon: ListChecks,
    color: '#38BDF8',
    path: '/shift-checklist',
    tagline: 'Per-shift task tracking',
    overview: 'Track daily, weekly, and monthly tasks assigned to Day, Swing, and Mid shifts. Items are configured per base by the administrator. The checklist uses timezone-aware date calculation with a configurable daily reset time (default 0600 local) to determine which checklist date applies.',
    keyFeatures: [
      'Today tab — progress bar per shift, check-off items with optional notes, file/reopen workflow',
      'History tab — view completed checklists from previous dates',
      'Dashboard integration — KPI badge on the Airfield Status page with quick-access dialog',
      'Per-user tracking — see who completed each item and when',
      'Configurable items — base administrators add/edit/delete/toggle items in Base Configuration',
    ],
    howToAccess: 'Navigate to Operations > Shift Checklist in the sidebar.',
    screenshots: [
      { src: '/training/shift-checklist_1.png', caption: 'Today\'s shift checklist with task items and completion tracking' },
      { src: '/training/shift-checklist-history_1.png', caption: 'History tab showing completed checklists by date' },
    ],
  },
  {
    id: 'checks',
    name: 'Airfield Checks',
    icon: ClipboardCheck,
    color: '#22D3EE',
    path: '/checks',
    tagline: 'FOD, RSC, RCR, emergency, and BASH checks',
    overview: 'A unified form supporting 7 check types: FOD Check, RSC Check, RCR Check, IFE, Ground Emergency, Heavy Aircraft, and BASH. Each check type has specialized fields. All checks support photo capture, GPS location pinning, issue documentation with per-issue photos, and follow-up remarks.',
    keyFeatures: [
      'FOD Check — route selection, items found, clear/not-clear determination',
      'RSC Check — contaminant type, depth, coverage, braking action, treatment applied',
      'RCR Check — Mu readings at rollout/midpoint/departure, equipment type, temperature',
      'IFE — in-flight emergency response documentation',
      'Ground Emergency — 12-item AM action checklist plus 9 agency notification tracking',
      'Heavy Aircraft — aircraft type, parking assignment, weight, taxi route',
      'BASH — condition code, species identification, mitigation actions, habitat attractants',
      'Draft persistence — save drafts to Supabase for cross-device access',
      'Full history with type filtering and keyword search',
    ],
    howToAccess: 'Navigate to Operations > Airfield Checks in the sidebar.',
    screenshots: [
      { src: '/training/airfield-checks-selector_1.png', caption: 'Check type selector — choose from 7 check types' },
      { src: '/training/airfield-checks-filled_1.png', caption: 'Completed check form with findings and details' },
    ],
  },
  {
    id: 'inspections',
    name: 'All Inspections',
    icon: ClipboardList,
    color: '#22D3EE',
    path: '/inspections/all',
    tagline: 'Daily, ACSI, construction, and joint inspections',
    overview: 'The inspections hub provides access to four inspection types: Daily Airfield/Lighting Inspections (DAFMAN 13-204v2), ACSI Annual Compliance Inspections, Pre/Post Construction Inspections, and Monthly Joint Inspections. Daily inspections enforce a one-per-day rule per type with a 0600 local reset.',
    keyFeatures: [
      'Daily Airfield & Lighting — configurable checklist items, default-to-pass toggle, per-discrepancy photos and GPS',
      'ACSI — 10 sections with ~100 items, Y/N/NA toggles, discrepancy documentation, risk management certification',
      'Pre/Post Construction — construction zone safety coordination inspections',
      'Joint Monthly — multi-party inspection with personnel attendance tracking',
      'One-per-day enforcement — only one airfield and one lighting inspection allowed per day',
      'Cross-device resume — drafts sync via Supabase for seamless continuation on any device',
      'BWC integration — record Bird Watch Condition during inspections',
      'PDF export — combined report with per-discrepancy photo embedding',
    ],
    howToAccess: 'Navigate to Operations > All Inspections in the sidebar.',
    screenshots: [
      { src: '/training/inspections_1.png', caption: 'Daily inspection form with pass/fail/NA toggles and discrepancy documentation' },
    ],
  },
  {
    id: 'wildlife',
    name: 'Wildlife / BASH',
    icon: Bird,
    color: '#10B981',
    path: '/wildlife',
    tagline: 'Wildlife sightings, strikes, and BASH reporting',
    overview: 'Document wildlife sightings and bird/wildlife strikes on the airfield. Species selection uses a favorites system for frequently observed species. Weather conditions auto-populate from Open-Meteo data. The BASH Monthly Report generates a comprehensive PDF with a live heatmap visualization of activity density.',
    keyFeatures: [
      'Sighting form — species, quantity, behavior, location, weather conditions, mitigation actions',
      'Strike form — species, aircraft involved, damage assessment, phase of flight',
      'Species favorites — star frequently observed species for quick access',
      'Weather auto-fill — temperature, wind, sky conditions, precipitation auto-populated from API',
      'BASH Monthly Report — heatmap visualization, sighting details, BWC history, statistical summary',
      'Zulu time fields — all observations recorded in Zulu time',
    ],
    howToAccess: 'Navigate to Operations > Wildlife / BASH in the sidebar.',
    screenshots: [
      { src: '/training/bash-activity-log_1.png', caption: 'Wildlife activity log with sightings and strike records' },
      { src: '/training/bash-sighting_1.png', caption: 'Wildlife sighting form with species, location pin, and weather auto-fill' },
      { src: '/training/bash-heatmap_1.png', caption: 'BASH heatmap showing wildlife activity density across the airfield' },
    ],
  },
  {
    id: 'contractors',
    name: 'Personnel on Airfield',
    icon: HardHat,
    color: '#F59E0B',
    path: '/contractors',
    tagline: 'Track personnel and vehicles on the airfield',
    overview: 'Maintain awareness of all non-operations personnel and vehicles currently on the airfield. Log contractor entries and exits, track vehicle information, and maintain a real-time count of personnel in controlled areas.',
    keyFeatures: [
      'Personnel cards — name, company, vehicle, purpose, entry/exit times',
      'Active count — real-time display of personnel currently on the airfield',
      'Entry/exit logging with Zulu timestamps',
      'Activity log integration — entries appear in Events Log',
    ],
    howToAccess: 'Navigate to Operations > Personnel on Airfield in the sidebar.',
    screenshots: [
      { src: '/training/personnel-on-airfield_1.png', caption: 'Personnel tracking list with active entries and status badges' },
      { src: '/training/personnel-on-airfield_2.png', caption: 'New personnel entry form with company, location, and radio details' },
    ],
  },
  {
    id: 'parking',
    name: 'Aircraft Parking Plans',
    icon: PlaneLanding,
    color: '#38BDF8',
    path: '/parking',
    tagline: 'Interactive parking plan editor with clearance analysis',
    overview: 'Create and manage aircraft parking plans on an interactive Mapbox satellite map. Aircraft render as to-scale SVG silhouettes using real dimensions from the built-in aircraft database. The clearance engine calculates UFC 3-260-01 wingtip spacing requirements and flags violations. Plans export to PDF with nose gear coordinates for field execution.',
    keyFeatures: [
      'Drag-and-drop aircraft placement on satellite imagery with to-scale silhouettes',
      'Tabbed sidebar — Aircraft, Environment, Clearance, and Settings tabs',
      'UFC clearance analysis — automatic wingtip spacing calculations with violation/warning indicators',
      'Nose gear coordinates — displayed in the panel and included in PDF export for precise field marking',
      'Obstacle tracking — place buildings and structures with clearance violation detection',
      'Taxilane definitions — named taxilanes with width for envelope context',
      'Bulk add — place multiple aircraft of the same type with sequential naming',
      'PDF export — landscape plan with map capture, aircraft summary, nose coordinates, and clearance table',
      'Email delivery — send the parking plan PDF directly from the app',
      'Fullscreen mode — spacebar toggle for maximum map area',
    ],
    howToAccess: 'Navigate to Operations > Aircraft Parking in the sidebar.',
    screenshots: [
      { src: '/training/parking-map_1.png', caption: 'Parking plan with to-scale aircraft silhouettes on satellite imagery' },
    ],
  },
  {
    id: 'discrepancies',
    name: 'Discrepancies',
    icon: AlertTriangle,
    color: '#FBBF24',
    path: '/discrepancies',
    tagline: 'Airfield issue tracking and resolution',
    overview: 'Track and resolve airfield discrepancies through a complete lifecycle: Open, Submitted to AFM, Submitted to CES, Awaiting CES Action, Waiting for Project, Work Completed, Closed, or Cancelled. Supports 11 discrepancy types with automatic shop assignment from per-base type-to-shop mapping. Features photo uploads, GPS location pinning, work order tracking, and NAVAID system linking.',
    keyFeatures: [
      '11 discrepancy types — FOD, pavement, lighting, markings, signage, drainage, vegetation, wildlife, equipment, security, other',
      'Full lifecycle tracking — from Open through CES workflow to Closed/Cancelled',
      'Map View — severity-colored pins on satellite imagery for a common operating picture',
      'Shop filter chips — filter by assigned CE shop',
      'Pending W/O filter — quickly find discrepancies awaiting work order assignment',
      'Photo uploads with camera capture — dedicated capture button for mobile field use',
      'Work order and Assigned To fields — editable directly in the edit modal',
      'NAVAID system overview map — automatic map thumbnail for infrastructure-linked discrepancies',
      'PDF export — configurable column selection with named templates',
      'CES Work Orders — dedicated dashboard for CES-role users at /ces',
    ],
    howToAccess: 'Navigate to Airfield Management > Discrepancies in the sidebar.',
    screenshots: [
      { src: '/training/discrepancies-list_1.png', caption: 'Discrepancy list with KPI badges, shop filters, and type tabs' },
      { src: '/training/discrepancies-map_1.png', caption: 'Map View — severity-colored pins for a common operating picture' },
      { src: '/training/discrepancies-detail_1.png', caption: 'Discrepancy detail page with photos, status history, and notes' },
    ],
  },
  {
    id: 'obstructions',
    name: 'Obstruction Evaluations',
    icon: MapPin,
    color: '#F97316',
    path: '/obstructions',
    tagline: 'UFC imaginary surface analysis',
    overview: 'Evaluate potential obstructions against UFC 3-260-01 Class B imaginary surfaces. The tool analyzes 10 surface types across all base runways simultaneously using geodesic calculations. Taxiway clearance envelopes render OFA and Safety Area polygons on the interactive map.',
    keyFeatures: [
      '10 imaginary surfaces — Primary, Approach-Departure, Transitional, Inner Horizontal, Conical, Outer Horizontal, Clear Zone, Graded Area, APZ I, APZ II',
      'Multi-runway evaluation — analyzes against all base runways simultaneously',
      'Interactive Mapbox map — color-coded surface overlays with per-runway toggles',
      'Taxiway clearance envelopes — OFA/Safety Area polygons for FAA and UFC criteria',
      'Elevation lookup — automated MSL height from Google Elevation API',
      'Photo documentation — multiple photos per evaluation',
      'Violation detection — identifies which UFC criteria are exceeded with table references',
      'Fullscreen mode with toolbar toggle',
      'History map view — all past evaluations plotted on satellite imagery',
    ],
    howToAccess: 'Navigate to Airfield Management > Obstruction Eval Tool in the sidebar. Access past evaluations via Obstruction Database.',
    screenshots: [
      { src: '/training/obstruction-eval_1.png', caption: 'Obstruction evaluation map with imaginary surface overlays and location pin' },
      { src: '/training/obstruction-eval_2.png', caption: 'Evaluation results showing violation detection with UFC table references' },
    ],
  },
  {
    id: 'waivers',
    name: 'Waivers',
    icon: Shield,
    color: '#A78BFA',
    path: '/waivers',
    tagline: 'Airfield waiver lifecycle management',
    overview: 'Manage the full lifecycle of airfield waivers modeled after AF Form 505 and the AFCEC Playbook Appendix B. Six classification types (permanent, temporary, construction, event, extension, amendment) with seven status values and mandatory comment dialogs for transitions. Includes coordination tracking, annual review management, and map view.',
    keyFeatures: [
      'Six classification types — permanent, temporary, construction, event, extension, amendment',
      'Seven status values with mandatory transition comments',
      'Criteria & standards references per waiver',
      'Coordination tracking by office',
      'Photo attachments with camera capture',
      'Annual review mode — year-by-year review forms with KPIs and board presentation tracking',
      'Map view — emoji markers by classification type with clickable filter legend',
      'PDF export with embedded photos and coordination details',
      'Excel export of the full waiver register',
    ],
    howToAccess: 'Navigate to Airfield Management > Waivers in the sidebar.',
    screenshots: [
      { src: '/training/waivers_1.png', caption: 'Waiver register with KPI badges, status filters, and search' },
      { src: '/training/waivers_2.png', caption: 'Waiver map view with classification markers and detail popup' },
    ],
  },
  {
    id: 'infrastructure',
    name: 'Visual NAVAIDs',
    icon: Lightbulb,
    color: '#FBBF24',
    path: '/infrastructure',
    tagline: 'Airfield lighting and signage management',
    overview: 'Digitize and manage all airfield lighting, signage, and infrastructure features on an interactive Mapbox satellite map. 22 feature types across 4 groups with custom canvas-rendered icons. The DAFMAN 13-204v2 outage compliance engine tracks system health with 4-tier alerts and automatic discrepancy creation.',
    keyFeatures: [
      '22 feature types — signs, taxiway lights, runway lights, and miscellaneous features',
      'Click-to-place pins with rotation, drag-to-move, and inline label editing',
      'Bar placement mode — approach lighting bars with geodesic offset calculations',
      'DAFMAN 13-204v2 outage tracking — 23 system types with configurable thresholds',
      'System Health Panel — per-system status, bar-level outage detail, and prescribed actions',
      '4-tier health alerts — green, yellow, red, black based on outage severity',
      'Automatic discrepancy creation when features are marked inoperative',
      'Map health rings — visual system degradation overlay',
      'Audit Mode — bulk operations for field verification, sequential labeling, and fixture IDs',
      'Multi-format import — KML, CSV, GeoJSON, and DXF',
      'Grouped legend system — type, system, and layer visibility toggles',
      'GPS tracking for drive-around field use',
    ],
    howToAccess: 'Navigate to Airfield Management > Visual NAVAIDs in the sidebar.',
    screenshots: [
      { src: '/training/visual-navaids-map_1.png', caption: 'Visual NAVAIDs map with digitized lighting features and grouped legend' },
      { src: '/training/visual-navaids-system-health-panel_1.png', caption: 'System Health Panel showing outage status and DAFMAN compliance' },
    ],
  },
  {
    id: 'aircraft-db',
    name: 'Aircraft Database',
    icon: Plane,
    color: '#38BDF8',
    path: '/aircraft',
    tagline: 'Military and civilian aircraft reference',
    overview: 'A built-in reference database of 200+ military and civilian aircraft with dimensions, weights, ACN values, and silhouettes. Used throughout the app for parking plan aircraft selection, heavy aircraft checks, and pavement loading analysis.',
    keyFeatures: [
      '200+ aircraft entries — military and civilian',
      'Search by name, type, manufacturer, or branch',
      'Sort by weight, wingspan, or ACN values',
      'Favorites system for frequently referenced aircraft',
      'ACN/PCN comparison panel for pavement loading analysis',
      'Integrated with parking plans for to-scale silhouette rendering',
    ],
    howToAccess: 'Navigate to Reference > Aircraft Database in the sidebar.',
    screenshots: [
      { src: '/training/aircraft-database_1.png', caption: 'Aircraft database list with search, sort, and branch filters' },
      { src: '/training/aircraft-database_2.png', caption: 'Aircraft detail page with specifications, dimensions, and silhouette' },
    ],
  },
  {
    id: 'regulations',
    name: 'Reference Library',
    icon: BookOpen,
    color: '#22D3EE',
    path: '/regulations',
    tagline: 'Regulatory references and personal documents',
    overview: 'A comprehensive regulatory reference library with two tabs. The References tab provides 70 regulation entries from DAFMAN 13-204 Volumes 1-3 and UFC 3-260-01 with full-text search and in-app PDF viewing. The My Documents tab allows personal PDF, JPG, and PNG uploads with client-side text extraction for search.',
    keyFeatures: [
      '70 regulation entries — DAFMAN 13-204, UFC 3-260-01',
      'Full-text search across all references',
      'Category and publication type filters',
      'In-app PDF viewer with pinch-to-zoom',
      'Offline caching via IndexedDB with "Cache All" bulk download',
      'My Documents tab — upload personal references for quick access',
      'Favorites with localStorage persistence',
    ],
    howToAccess: 'Navigate to Reference > Reference Library in the sidebar.',
    screenshots: [
      { src: '/training/reference-library_1.png', caption: 'Reference Library with regulation entries and category filters' },
      { src: '/training/reference-library_2.png', caption: 'My Documents tab for personal reference uploads' },
      { src: '/training/reference-library_3.png', caption: 'In-app PDF viewer with pinch-to-zoom' },
    ],
  },
  {
    id: 'notams',
    name: 'NOTAMs',
    icon: FileText,
    color: '#22D3EE',
    path: '/notams',
    tagline: 'Live FAA NOTAM feed',
    overview: 'Live FAA NOTAM feed that auto-fetches NOTAMs for your installation\'s ICAO code on page load. Includes filter chips for All/FAA/LOCAL/Active/Expired, expiring NOTAM alerts (within 24 hours), and the ability to draft local NOTAMs.',
    keyFeatures: [
      'Auto-fetch NOTAMs by installation ICAO code',
      'ICAO search for querying any airport',
      'Filter chips — All, FAA, LOCAL, Active, Expired',
      'Expiring NOTAM alerts — sidebar badge count and red card highlight for NOTAMs within 24 hours',
      'Full NOTAM text in monospace display',
      'Draft creation for local NOTAMs',
    ],
    howToAccess: 'Navigate to Reference > NOTAMs in the sidebar.',
    screenshots: [
      { src: '/training/notams_1.png', caption: 'Live FAA NOTAM feed with filter chips and expiring alerts' },
    ],
  },
  {
    id: 'reports',
    name: 'Reports & Analytics',
    icon: BarChart3,
    color: '#22D3EE',
    path: '/reports',
    tagline: 'Operational reports and 30-day analytics',
    overview: 'Five report types with PDF export and email delivery, plus a configurable analytics dashboard. Generate daily operations summaries, flexible discrepancy reports, trend analysis, aging reports, and airfield lighting system health reports.',
    keyFeatures: [
      'Daily Operations Summary — all activity for a date or date range',
      'Discrepancy Report — flexible filter builder with 5 filters, live preview, "Export All Open" quick button',
      'Discrepancy Trends — opened vs. closed over 30d/90d/6m/1y with top areas and types',
      'Aging Discrepancies — open items grouped by age tier with clickable filters',
      'Airfield Lighting Report — sortable system health table with component detail',
      'Analytics Dashboard — 9 metric cards (inspections, checks, discrepancies, QRC, personnel, obstructions, parking, wildlife) with configurable time frame',
      'All reports support PDF export and email delivery',
    ],
    howToAccess: 'Navigate to Reference > Reports & Analytics in the sidebar.',
    screenshots: [
      { src: '/training/reports-analytics_1.png', caption: 'Analytics dashboard with configurable time-frame metrics' },
      { src: '/training/reports_example_1.png', caption: 'Report generation with PDF export and email delivery' },
    ],
  },
  {
    id: 'settings',
    name: 'Settings & Administration',
    icon: Settings,
    color: '#64748B',
    path: '/settings',
    tagline: 'Profile, base configuration, and user management',
    overview: 'Manage your profile settings, operating initials, and default PDF email. Base administrators can configure installation details, CE shops, type-to-shop mapping, areas, taxiways, NAVAIDs, ARFF vehicles, facilities, inspection templates, lighting systems, and shift checklist items. System administrators can manage all users and installations.',
    keyFeatures: [
      'Profile settings — display name, operating initials, default PDF email, theme preference',
      'Base Configuration — installation details, runways, areas, taxiways, facilities, CE shops',
      'Inspection Templates — configure airfield and lighting checklist sections and items',
      'Lighting Systems — define systems and components with DAFMAN outage thresholds',
      'Shift Checklist Items — add/edit/toggle items per shift with daily/weekly/monthly frequency',
      'User Management — invite users, assign roles, manage base membership (admin only)',
      'Installation switcher — available in the header for multi-base users',
    ],
    howToAccess: 'Navigate to Settings in the sidebar. Base Setup and User Management are under the Settings section.',
    screenshots: [
      { src: '/training/settings_profile_1.png', caption: 'Profile settings — name, role, operating initials, and default PDF email' },
      { src: '/training/settings_1.png', caption: 'Settings overview with collapsible sections' },
      { src: '/training/settings-base-config_1.png', caption: 'Base Configuration — Base Setup, Inspection Templates, and Airfield Diagram' },
    ],
  },
]

// ── Components ──

function QuickStartStep({ step, index, total }: { step: typeof QUICK_START_STEPS[0]; index: number; total: number }) {
  return (
    <div style={{
      display: 'flex', gap: 16, padding: '20px 0',
      borderBottom: index < total - 1 ? '1px solid var(--color-border)' : 'none',
    }}>
      <div style={{
        width: 44, height: 44, minWidth: 44, borderRadius: 12,
        background: 'var(--color-cyan)', color: '#0F172A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 'var(--fs-lg)', fontWeight: 800, letterSpacing: '-0.02em',
      }}>
        {step.number}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 4 }}>
          {step.title}
        </div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', lineHeight: 1.6 }}>
          {step.description}
        </div>
      </div>
    </div>
  )
}

function ModuleCard({ module }: { module: ModuleRef }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = module.icon

  return (
    <div style={{
      background: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 12,
      overflow: 'hidden',
      transition: 'border-color 0.15s',
      borderLeftWidth: 3,
      borderLeftColor: expanded ? module.color : 'var(--color-border)',
    }}>
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%',
          padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
          color: 'inherit', fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <div style={{
          width: 44, height: 44, minWidth: 44, borderRadius: 10,
          background: `${module.color}14`, border: `1px solid ${module.color}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} color={module.color} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)' }}>
            {module.name}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 1 }}>
            {module.tagline}
          </div>
        </div>
        {expanded
          ? <ChevronDown size={18} color="var(--color-text-3)" />
          : <ChevronRight size={18} color="var(--color-text-3)" />
        }
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '0 16px 16px 16px' }}>
          {/* Overview */}
          <div style={{
            fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', lineHeight: 1.7,
            marginBottom: 16, paddingTop: 4,
          }}>
            {module.overview}
          </div>

          {/* Key Features */}
          <div style={{
            background: 'var(--color-bg-inset)', borderRadius: 8, padding: '12px 14px',
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Key Features
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {module.keyFeatures.map((f, i) => (
                <li key={i} style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', lineHeight: 1.5 }}>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* How to access */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '10px 14px', borderRadius: 8,
            background: `${module.color}08`, border: `1px solid ${module.color}22`,
          }}>
            <ExternalLink size={14} color={module.color} style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: module.color, marginBottom: 2 }}>
                How to Access
              </div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
                {module.howToAccess}
              </div>
            </div>
          </div>

          {/* Go to module link */}
          <Link
            href={module.path}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              marginTop: 12, padding: '8px 16px', borderRadius: 8,
              background: `${module.color}14`, border: `1px solid ${module.color}33`,
              color: module.color, fontSize: 'var(--fs-sm)', fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Open {module.name} <ExternalLink size={13} />
          </Link>
        </div>
      )}
    </div>
  )
}

// ── Main Page ──

export default function TrainingPage() {
  const [activeTab, setActiveTab] = useState<'quickstart' | 'modules'>('quickstart')
  const [expandAll, setExpandAll] = useState(false)

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 720 }}>

        {/* Back link */}
        <Link href="/more" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: 'var(--color-text-3)', textDecoration: 'none', fontSize: 'var(--fs-sm)', marginBottom: 12,
        }}>
          <ArrowLeft size={14} /> Back to More
        </Link>

        {/* Page header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'var(--color-cyan)', color: '#0F172A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Rocket size={22} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>
                Glidepath Training
              </div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)', fontStyle: 'italic' }}>
                Guiding You to Mission Success
              </div>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 20, padding: 3,
          background: 'var(--color-bg-inset)', borderRadius: 10, border: '1px solid var(--color-border)',
        }}>
          {(['quickstart', 'modules'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: '10px 16px', borderRadius: 8,
                fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer',
                border: 'none', fontFamily: 'inherit',
                background: activeTab === tab ? 'var(--color-bg-surface)' : 'transparent',
                color: activeTab === tab ? 'var(--color-cyan)' : 'var(--color-text-3)',
                boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {tab === 'quickstart' ? 'Quick Start Guide' : 'Module Reference'}
            </button>
          ))}
        </div>

        {/* ════ Quick Start Tab ════ */}
        {activeTab === 'quickstart' && (
          <div>
            {/* Intro card */}
            <div style={{
              padding: '20px 22px', borderRadius: 12, marginBottom: 20,
              background: 'linear-gradient(135deg, rgba(56,189,248,0.08), rgba(56,189,248,0.02))',
              border: '1px solid rgba(56,189,248,0.2)',
            }}>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 6 }}>
                Welcome to Glidepath
              </div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', lineHeight: 1.7 }}>
                Glidepath is a mobile-first airfield operations management platform built for Airfield Managers.
                It streamlines daily operations — from shift checklists and inspections to discrepancy tracking,
                obstruction evaluations, and real-time status monitoring — into a single, unified application
                accessible from any device.
              </div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', lineHeight: 1.7, marginTop: 10 }}>
                Follow the steps below to get up and running quickly, then explore the Module Reference tab
                for detailed documentation on each feature.
              </div>
            </div>

            {/* Steps */}
            <div style={{
              background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
              borderRadius: 12, padding: '4px 20px', marginBottom: 20,
            }}>
              {QUICK_START_STEPS.map((step, i) => (
                <QuickStartStep key={step.number} step={step} index={i} total={QUICK_START_STEPS.length} />
              ))}
            </div>

            {/* Navigation overview */}
            <div style={{
              background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
              borderRadius: 12, padding: 20, marginBottom: 20,
            }}>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 12 }}>
                Navigation Overview
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Desktop / Tablet', desc: 'Permanent sidebar on the left with collapsible sections: Operations, Airfield Management, Reference, and Settings. Pinned items (Airfield Status, Dashboard, Events Log) are always visible at the top.' },
                  { label: 'Mobile', desc: 'Bottom navigation bar with five tabs: Status, Dashboard, Obstruction, Events Log, and More. The More menu provides access to every module in the app.' },
                  { label: 'Installation Switcher', desc: 'Located in the top-left header. If you have access to multiple installations, tap it to switch between bases. Your selection persists across sessions and all data filters to the selected installation.' },
                  { label: 'Sidebar Customization', desc: 'Click the pencil icon at the bottom of the sidebar to enter edit mode. Drag items to reorder, collapse sections, or pin frequently used modules to the top.' },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-cyan)', marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', lineHeight: 1.6 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Key concepts */}
            <div style={{
              background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
              borderRadius: 12, padding: 20,
            }}>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: 12 }}>
                Key Concepts
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Zulu Time', desc: 'All timestamps throughout the app are displayed and recorded in Zulu (UTC) time. This ensures consistency across time zones and aligns with standard military aviation operations.' },
                  { label: 'Real-Time Updates', desc: 'Status changes, new checks, and inspections push to all connected users instantly. If a realtime connection issue occurs, you will only see a warning when you take an action that expects a push update — not on every page load.' },
                  { label: 'Draft Persistence', desc: 'Checks, inspections, and ACSI forms auto-save drafts. Checks save to Supabase for cross-device access. Inspections save to local storage with Supabase sync. You can start on one device and resume on another.' },
                  { label: 'PDF & Email Export', desc: 'Most modules support PDF export. PDFs can be downloaded directly or emailed from within the app. Configure your default email address in Settings for one-tap delivery.' },
                  { label: 'Role-Based Access', desc: 'Your assigned role (Airfield Manager, Base Admin, CES, Safety, ATC, Read Only) determines which modules and actions are available. CES users see a focused interface with only relevant modules.' },
                  { label: 'Demo Mode', desc: 'If Supabase credentials are not configured, the app runs in demo mode with offline mock data. This is useful for training and evaluation without a live database.' },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-cyan)', marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', lineHeight: 1.6 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════ Module Reference Tab ════ */}
        {activeTab === 'modules' && (
          <div>
            {/* Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-3)' }}>
                {MODULES.length} modules — tap any card to expand
              </div>
              <button
                onClick={() => setExpandAll(e => !e)}
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 'var(--fs-xs)', fontWeight: 600,
                  background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                  color: 'var(--color-text-2)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {expandAll ? 'Collapse All' : 'Expand All'}
              </button>
            </div>

            {/* Module cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {MODULES.map(m => (
                <ModuleCardControlled key={m.id} module={m} forceExpand={expandAll} />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          textAlign: 'center', padding: '24px 0 12px',
          fontSize: 'var(--fs-xs)', color: 'var(--color-text-4)',
        }}>
          Glidepath v2.28.0 — Airfield Operations Management Platform
        </div>
      </div>
    </div>
  )
}

/** Module card with controlled expand state for Expand All toggle */
function ModuleCardControlled({ module, forceExpand }: { module: ModuleRef; forceExpand: boolean }) {
  const [manualExpand, setManualExpand] = useState(false)
  const expanded = forceExpand || manualExpand
  const Icon = module.icon

  return (
    <div style={{
      background: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 12,
      overflow: 'hidden',
      transition: 'border-color 0.15s',
      borderLeftWidth: 3,
      borderLeftColor: expanded ? module.color : 'var(--color-border)',
    }}>
      <button
        onClick={() => setManualExpand(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%',
          padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
          color: 'inherit', fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <div style={{
          width: 44, height: 44, minWidth: 44, borderRadius: 10,
          background: `${module.color}14`, border: `1px solid ${module.color}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={20} color={module.color} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text-1)' }}>
            {module.name}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)', marginTop: 1 }}>
            {module.tagline}
          </div>
        </div>
        {expanded
          ? <ChevronDown size={18} color="var(--color-text-3)" />
          : <ChevronRight size={18} color="var(--color-text-3)" />
        }
      </button>

      {expanded && (
        <div style={{ padding: '0 16px 16px 16px' }}>
          <div style={{
            fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', lineHeight: 1.7,
            marginBottom: 16, paddingTop: 4,
          }}>
            {module.overview}
          </div>

          {/* Screenshots */}
          {module.screenshots && module.screenshots.length > 0 && (
            <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {module.screenshots.map((ss, i) => (
                <div key={i} style={{
                  borderRadius: 8, overflow: 'hidden',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-inset)',
                }}>
                  <img
                    src={ss.src}
                    alt={ss.caption}
                    loading="lazy"
                    style={{
                      width: '100%', display: 'block',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  />
                  <div style={{
                    padding: '8px 12px',
                    fontSize: 'var(--fs-xs)', color: 'var(--color-text-3)',
                    fontStyle: 'italic', lineHeight: 1.4,
                  }}>
                    {ss.caption}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{
            background: 'var(--color-bg-inset)', borderRadius: 8, padding: '12px 14px',
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--color-text-2)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Key Features
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {module.keyFeatures.map((f, i) => (
                <li key={i} style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)', lineHeight: 1.5 }}>
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '10px 14px', borderRadius: 8,
            background: `${module.color}08`, border: `1px solid ${module.color}22`,
          }}>
            <ExternalLink size={14} color={module.color} style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: module.color, marginBottom: 2 }}>
                How to Access
              </div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-2)' }}>
                {module.howToAccess}
              </div>
            </div>
          </div>

          <Link
            href={module.path}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              marginTop: 12, padding: '8px 16px', borderRadius: 8,
              background: `${module.color}14`, border: `1px solid ${module.color}33`,
              color: module.color, fontSize: 'var(--fs-sm)', fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Open {module.name} <ExternalLink size={13} />
          </Link>
        </div>
      )}
    </div>
  )
}
