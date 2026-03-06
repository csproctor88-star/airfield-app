// Glidepath — App-wide Constants
// Base-specific configuration (name, ICAO, runways, areas, etc.) is
// stored in the database and loaded via InstallationContext.

// === Discrepancy Types (SRS Section 6.1) ===

export const DISCREPANCY_TYPES = [
  { value: 'fod_hazard', label: 'FOD Hazard', emoji: '🚨', defaultSeverity: 'critical', defaultShop: 'Airfield Management' },
  { value: 'pavement', label: 'Pavement Deficiency', emoji: '🛣️', defaultSeverity: 'high', defaultShop: 'CE Pavements' },
  { value: 'lighting', label: 'Lighting Outage/Deficiency', emoji: '💡', defaultSeverity: 'high', defaultShop: 'CE Electrical' },
  { value: 'marking', label: 'Marking Deficiency', emoji: '🎨', defaultSeverity: 'medium', defaultShop: 'CE Pavements' },
  { value: 'signage', label: 'Signage Deficiency', emoji: '🪧', defaultSeverity: 'medium', defaultShop: 'CE Electrical' },
  { value: 'drainage', label: 'Drainage Issue', emoji: '🌊', defaultSeverity: 'medium', defaultShop: 'CE Structures' },
  { value: 'vegetation', label: 'Vegetation Encroachment', emoji: '🌿', defaultSeverity: 'low', defaultShop: 'CE Grounds' },
  { value: 'wildlife', label: 'Wildlife Hazard', emoji: '🦅', defaultSeverity: 'high', defaultShop: 'Airfield Management' },
  { value: 'obstruction', label: 'Airfield Obstruction', emoji: '⛔', defaultSeverity: 'critical', defaultShop: 'CE / Airfield Management' },
  { value: 'navaid', label: 'NAVAID Deficiency', emoji: '📡', defaultSeverity: 'critical', defaultShop: 'CE Electrical / FAA' },
  { value: 'other', label: 'Other', emoji: '📋', defaultSeverity: 'medium', defaultShop: null },
] as const

// === Severity Styling (SRS Section 6.2) ===

export const SEVERITY_CONFIG = {
  critical: { color: '#EF4444', bg: '#FEE2E2', label: 'CRITICAL', textColor: 'text-red-600' },
  high:     { color: '#F97316', bg: '#FED7AA', label: 'HIGH', textColor: 'text-orange-600' },
  medium:   { color: '#EAB308', bg: '#FEF3C7', label: 'MEDIUM', textColor: 'text-yellow-600' },
  low:      { color: '#3B82F6', bg: '#DBEAFE', label: 'LOW', textColor: 'text-blue-600' },
} as const

export const STATUS_CONFIG = {
  open:      { color: '#3B82F6', bg: '#DBEAFE', label: 'Open' },
  completed: { color: '#10B981', bg: '#D1FAE5', label: 'Completed' },
  cancelled: { color: '#9CA3AF', bg: '#E5E7EB', label: 'Cancelled' },
} as const

export const CONTRACTOR_STATUS_CONFIG = {
  active:    { color: '#22C55E', bg: '#D1FAE5', label: 'Active' },
  completed: { color: '#64748B', bg: '#E2E8F0', label: 'Completed' },
} as const

// === Current Status Options (workflow tracking field) ===

export const CURRENT_STATUS_OPTIONS = [
  { value: 'submitted_to_afm', label: 'Submitted to AFM' },
  { value: 'submitted_to_ces', label: 'Submitted to CES' },
  { value: 'awaiting_action_by_ces', label: 'Awaiting Action by CES' },
  { value: 'work_completed_awaiting_verification', label: 'Work Completed and Awaiting Verification' },
] as const

// === Location Options ===

export const LOCATION_OPTIONS = [
  { value: 'TWY', label: 'TWY', emoji: '🛬' },
  { value: 'RWY', label: 'RWY', emoji: '✈️' },
  { value: 'Apron', label: 'Apron', emoji: '🅿️' },
  { value: 'Shelter', label: 'Shelter', emoji: '🏗️' },
  { value: 'Access Road', label: 'Access Road', emoji: '🛣️' },
  { value: 'Misc.', label: 'Misc.', emoji: '📌' },
] as const

// === Status Transitions (SRS Section 6.4) ===

const ALL_STATUSES = Object.keys(STATUS_CONFIG)

// Every status can transition to every other status
export const ALLOWED_TRANSITIONS: Record<string, string[]> = Object.fromEntries(
  ALL_STATUSES.map(s => [s, ALL_STATUSES.filter(t => t !== s)])
)

// === Emergency Response (SRS Section 6.6) ===

export const EMERGENCY_ACTIONS = [
  'Notified ATC / Tower',
  'Activated crash phone / primary crash net',
  'Coordinated with Fire Department / ARFF',
  'Swept assigned runway for debris',
  'Notified SOF (Supervisor of Flying)',
  'Notified MOC (Maintenance Operations Center)',
  'Notified Command Post',
  'Notified Wing Safety',
  'Notified Security Forces',
  'Coordinated barrier engagement (if applicable)',
  'Documented aircraft position and damage',
  'Completed post-incident airfield inspection',
] as const

export const EMERGENCY_AGENCIES = [
  'SOF', 'Fire Chief / ARFF', 'Wing Safety', 'MOC',
  'Command Post', 'ATC / Tower', 'CE', 'Security Forces', 'Medical',
] as const

// === Inspection Types ===

export type InspectionType = 'airfield' | 'lighting' | 'construction_meeting' | 'joint_monthly'

export interface InspectionItem {
  id: string
  itemNumber: number
  item: string
  type?: 'pass_fail' | 'bwc' | 'rsc' | 'rcr'  // default is pass_fail
}

export interface InspectionSection {
  id: string
  title: string
  guidance?: string
  conditional?: string  // if set, section is hidden unless user opts in
  items: InspectionItem[]
}

// === Airfield Inspection Sections ===

export const AIRFIELD_INSPECTION_SECTIONS: InspectionSection[] = [
  {
    id: 'af-1',
    title: 'Section 1 — Obstacle Clearance Criteria',
    guidance: 'Tree growth, vegetation, dirt piles, ponding, construction, depressions, mobile/fixed obstacles',
    items: [
      { id: 'af-1', itemNumber: 1, item: "Primary Surface — 1000' from runway centerline" },
      { id: 'af-2', itemNumber: 2, item: 'Transitional Slope (7:1)' },
      { id: 'af-3', itemNumber: 3, item: "Runway Clear Zones — 3000'L x 3000'W" },
      { id: 'af-4', itemNumber: 4, item: "Graded Portion of Clear Zone — 1000'L x 3000'W" },
      { id: 'af-5', itemNumber: 5, item: 'Approach / Departure Surface (50:1)' },
      { id: 'af-6', itemNumber: 6, item: "Taxiway — 200' from centerline" },
      { id: 'af-7', itemNumber: 7, item: "Apron — 110' from boundary marking" },
      { id: 'af-8', itemNumber: 8, item: 'Construction Areas' },
    ],
  },
  {
    id: 'af-2',
    title: 'Section 2 — Signs/Lights',
    guidance: 'Correct background/legend, easy to read, unobstructed, frangible, illuminated',
    items: [
      { id: 'af-11', itemNumber: 11, item: 'VFR Holding Positions' },
      { id: 'af-12', itemNumber: 12, item: 'Instrument Holding Positions' },
      { id: 'af-13', itemNumber: 13, item: 'Elevation Signs' },
      { id: 'af-14', itemNumber: 14, item: 'Taxiway Signs' },
      { id: 'af-15', itemNumber: 15, item: 'Windcone' },
      { id: 'af-16', itemNumber: 16, item: 'FOD/STOP' },
      { id: 'af-17', itemNumber: 17, item: 'Runway Signs' },
      { id: 'af-18', itemNumber: 18, item: 'NAVAID Ground Receiver Checkpoints' },
      { id: 'af-19', itemNumber: 19, item: 'Closed Areas' },
    ],
  },
  {
    id: 'af-3',
    title: 'Section 3 — Construction',
    items: [
      { id: 'af-20', itemNumber: 20, item: 'Parking' },
      { id: 'af-21', itemNumber: 21, item: 'Rules Compliance' },
      { id: 'af-22', itemNumber: 22, item: 'Construction Site Lighting/Marking' },
      { id: 'af-23', itemNumber: 23, item: 'Storage' },
      { id: 'af-24', itemNumber: 24, item: 'Vehicles Lighted/Marked' },
      { id: 'af-25', itemNumber: 25, item: 'FOD Control (Debris/Trash/Vehicle Routes)' },
    ],
  },
  {
    id: 'af-4',
    title: 'Section 4 — Habitat Management',
    items: [
      { id: 'af-26', itemNumber: 26, item: 'Grass Height (7–14")' },
      { id: 'af-27', itemNumber: 27, item: 'Ponding Effects' },
      { id: 'af-28', itemNumber: 28, item: 'Bird/Animal Survey' },
      { id: 'af-29', itemNumber: 29, item: 'Bird Watch Condition (BWC)', type: 'bwc' },
    ],
  },
  {
    id: 'af-5',
    title: 'Section 5 — Pavement Condition / Markings',
    guidance: 'Conditions: Rubber deposits, cracks, spalling, FOD. Markings: Chipped/peeling/faded, obscure, rubber buildup',
    items: [
      { id: 'af-30', itemNumber: 30, item: 'Runway/Overruns 01/19' },
      { id: 'af-31', itemNumber: 31, item: 'Taxiways' },
      { id: 'af-32', itemNumber: 32, item: 'Access Roads / FOD Checks' },
      { id: 'af-33', itemNumber: 33, item: 'Grounding Points' },
    ],
  },
  {
    id: 'af-6',
    title: 'Section 6 — Airfield Driving',
    items: [
      { id: 'af-34', itemNumber: 34, item: 'FOD Control' },
      { id: 'af-35', itemNumber: 35, item: 'Compliance with Procedures' },
      { id: 'af-36', itemNumber: 36, item: 'Properly Stowed/Secured Equipment' },
    ],
  },
  {
    id: 'af-7',
    title: 'Section 7 — FOD Control',
    items: [
      { id: 'af-37', itemNumber: 37, item: 'Runways/Overruns, Taxiways/Shoulders' },
      { id: 'af-38', itemNumber: 38, item: 'Parking Aprons' },
      { id: 'af-39', itemNumber: 39, item: 'Infield Areas Between Runways/Taxiways' },
      { id: 'af-40', itemNumber: 40, item: 'Perimeter/Access Roads' },
    ],
  },
  {
    id: 'af-8',
    title: 'Section 8 — Pre or Post Construction Inspection',
    conditional: 'Construction Meeting Inspection',
    items: [
      { id: 'af-41', itemNumber: 41, item: 'CE, Wing Safety' },
    ],
  },
  {
    id: 'af-9',
    title: 'Section 9 — Joint Monthly Airfield Inspection',
    conditional: 'Joint Monthly Airfield Inspection',
    items: [
      { id: 'af-42', itemNumber: 42, item: 'TERPS, Flight & Ground Safety, SOF, CE, SFS' },
    ],
  },
  {
    id: 'af-sec-rwy',
    title: 'Runway Conditions',
    items: [
      { id: 'af-rsc', itemNumber: 43, item: 'Runway Surface Condition (RSC)', type: 'rsc' },
      { id: 'af-rcr', itemNumber: 44, item: 'Runway Condition Reading (RCR)', type: 'rcr' },
    ],
  },
]

// === BWC Value Options ===

export const BWC_OPTIONS = ['LOW', 'MOD', 'SEV', 'PROHIB'] as const

// === Lighting Inspection Sections ===

export const LIGHTING_INSPECTION_SECTIONS: InspectionSection[] = [
  {
    id: 'lt-1',
    title: 'Section 1 — Runway 01 Lighting',
    items: [
      { id: 'lt-1', itemNumber: 1, item: '01/19 Edge Lights' },
      { id: 'lt-2', itemNumber: 2, item: '01 Approach Lighting (SALS)' },
      { id: 'lt-3', itemNumber: 3, item: '01 Threshold Bar / 19 Runway End Lights' },
      { id: 'lt-4', itemNumber: 4, item: '01 PAPI' },
      { id: 'lt-5', itemNumber: 5, item: 'South Hammerhead Edge Lights' },
    ],
  },
  {
    id: 'lt-2',
    title: 'Section 2 — Runway 19 Lighting',
    items: [
      { id: 'lt-6', itemNumber: 6, item: '19 Threshold Bar / 01 Runway End Lights' },
      { id: 'lt-7', itemNumber: 7, item: '19 PAPI' },
      { id: 'lt-8', itemNumber: 8, item: '19 REILs' },
      { id: 'lt-9', itemNumber: 9, item: 'Intensity Level Check on HIRLs' },
    ],
  },
  {
    id: 'lt-3',
    title: 'Section 3 — Taxiway/Apron Lighting',
    items: [
      { id: 'lt-10', itemNumber: 10, item: 'TWY A' },
      { id: 'lt-11', itemNumber: 11, item: 'TWY K' },
      { id: 'lt-12', itemNumber: 12, item: 'TWY B' },
      { id: 'lt-13', itemNumber: 13, item: 'TWY L' },
      { id: 'lt-14', itemNumber: 14, item: 'TWY J' },
      { id: 'lt-15', itemNumber: 15, item: 'TWY E' },
      { id: 'lt-16', itemNumber: 16, item: 'TWY G' },
      { id: 'lt-17', itemNumber: 17, item: 'East Ramp' },
      { id: 'lt-18', itemNumber: 18, item: 'West Ramp' },
      { id: 'lt-19', itemNumber: 19, item: 'USCG Ramp' },
      { id: 'lt-20', itemNumber: 20, item: 'DHS Ramp' },
      { id: 'lt-21', itemNumber: 21, item: 'West Side Stadium Lights' },
      { id: 'lt-22', itemNumber: 22, item: 'East Side Stadium Lights' },
    ],
  },
  {
    id: 'lt-4',
    title: 'Section 4 — Signs & Markings',
    items: [
      { id: 'lt-23', itemNumber: 23, item: 'Runway Hold Signs' },
      { id: 'lt-24', itemNumber: 24, item: 'Taxiway Guidance Signs' },
      { id: 'lt-25', itemNumber: 25, item: 'Instrument Hold Signs' },
      { id: 'lt-26', itemNumber: 26, item: '01/19 DRMs (Distance Remaining Markers)' },
      { id: 'lt-27', itemNumber: 27, item: 'NAVAID Checkpoint' },
      { id: 'lt-28', itemNumber: 28, item: 'Marking Retroreflectivity' },
    ],
  },
  {
    id: 'lt-5',
    title: 'Section 5 — Miscellaneous',
    items: [
      { id: 'lt-29', itemNumber: 29, item: 'Obstruction Lights' },
      { id: 'lt-30', itemNumber: 30, item: 'Rotating Beacon' },
      { id: 'lt-31', itemNumber: 31, item: 'Wind Cones' },
      { id: 'lt-32', itemNumber: 32, item: 'Construction Barriers' },
    ],
  },
  {
    id: 'lt-sec-rwy',
    title: 'Runway Conditions',
    items: [
      { id: 'lt-rsc', itemNumber: 33, item: 'Runway Surface Condition (RSC)', type: 'rsc' },
      { id: 'lt-rcr', itemNumber: 34, item: 'Runway Condition Reading (RCR)', type: 'rcr' },
    ],
  },
]

// === Check Type Configuration ===

export const CHECK_TYPE_CONFIG = {
  fod:              { label: 'FOD Check', color: '#EAB308', icon: '🔍' },
  rsc:              { label: 'RSC/RCR Check', color: '#3B82F6', icon: '🌧️' },
  ife:              { label: 'In-Flight Emergency', color: '#EF4444', icon: '🚨' },
  ground_emergency: { label: 'Ground Emergency', color: '#F97316', icon: '🚒' },
  heavy_aircraft:   { label: 'Heavy Aircraft Check', color: '#8B5CF6', icon: '✈️' },
  bash:             { label: 'BASH Check', color: '#A78BFA', icon: '🦅' },
} as const

// === RSC Conditions ===

export const RSC_CONDITIONS = ['Dry', 'Wet'] as const

// === RCR Condition Types ===

export const RCR_CONDITION_TYPES = [
  { value: 'PSR', label: 'PSR - Packed Snow' },
  { value: 'LSR', label: 'LSR - Loose Snow' },
  { value: 'IR', label: 'IR - Ice' },
  { value: 'SOR', label: 'Slush on Runway' },
  { value: 'DRY', label: 'Dry' },
  { value: 'WET', label: 'Wet' },
] as const

// === BASH Condition Codes ===

export const BASH_CONDITION_CODES = ['LOW', 'MODERATE', 'SEVERE', 'PROHIBITED'] as const

// === NOTAM Types ===

export const NOTAM_TYPES = [
  'Runway Closure',
  'Taxiway Closure',
  'Lighting',
  'Construction',
  'NAVAID',
  'Custom',
] as const

// === Inspection Personnel (for Construction Meeting / Joint Monthly) ===

export const INSPECTION_PERSONNEL = [
  'Contracting',
  'CES',
  'Safety',
  'Security Forces',
  'ATC',
  'AMOPS',
  'TERPS',
] as const

// === Regulation Categories (AOMS Regulation Database v4) ===

export const REGULATION_CATEGORIES = [
  { value: 'airfield_ops', label: 'Airfield Operations', color: '#38BDF8' },
  { value: 'airfield_mgmt', label: 'Airfield Management', color: '#34D399' },
  { value: 'atc', label: 'Air Traffic Control', color: '#A78BFA' },
  { value: 'airfield_design', label: 'Airfield Design & Planning', color: '#F97316' },
  { value: 'pavement', label: 'Pavement & Surfaces', color: '#EAB308' },
  { value: 'lighting', label: 'Lighting & NAVAIDs', color: '#FBBF24' },
  { value: 'safety', label: 'Safety & Mishap Prevention', color: '#EF4444' },
  { value: 'bash_wildlife', label: 'BASH / Wildlife', color: '#10B981' },
  { value: 'driving', label: 'Airfield Driving', color: '#6366F1' },
  { value: 'emergency', label: 'Emergency Management', color: '#F43F5E' },
  { value: 'publications', label: 'Publications & Records', color: '#94A3B8' },
  { value: 'personnel', label: 'Personnel & Training', color: '#8B5CF6' },
  { value: 'construction', label: 'Construction & Facilities', color: '#FB923C' },
  { value: 'fueling', label: 'Fueling & Hazmat', color: '#FACC15' },
  { value: 'security', label: 'Security & Force Protection', color: '#64748B' },
  { value: 'international', label: 'International & Joint Use', color: '#22D3EE' },
  { value: 'notams', label: 'NOTAMs & Flight Info', color: '#2DD4BF' },
  { value: 'uas', label: 'UAS Operations', color: '#C084FC' },
  { value: 'contingency', label: 'Contingency Operations', color: '#FB7185' },
  { value: 'financial', label: 'Financial & Manpower', color: '#A3E635' },
] as const

export const REGULATION_PUB_TYPES = [
  { value: 'DAF', label: 'DAF (AFI/DAFI/AFMAN/DAFMAN/AFH/AFPD)' },
  { value: 'FAA', label: 'FAA Orders & Advisory Circulars' },
  { value: 'UFC', label: 'UFC / Unified Facilities Criteria' },
  { value: 'CFR', label: 'Code of Federal Regulations' },
  { value: 'DoD', label: 'DoD Publications' },
  { value: 'ICAO', label: 'ICAO Standards' },
] as const

export const REGULATION_SOURCE_SECTIONS = [
  { value: 'core', label: 'Core Publications', color: '#34D399' },
  { value: 'I', label: 'I — Vol. 1 Refs', color: '#F1F5F9' },
  { value: 'II', label: 'II — Vol. 2 Refs', color: '#BFDBFE' },
  { value: 'III', label: 'III — Vol. 3 Refs', color: '#F1F5F9' },
  { value: 'IV', label: 'IV — UFC 3-260-01 Refs', color: '#BFDBFE' },
  { value: 'V', label: 'V — Additional UFC/FC', color: '#F1F5F9' },
  { value: 'VI-A', label: 'VI-A — DAF Cross-Refs', color: '#FDE68A' },
  { value: 'VI-B', label: 'VI-B — FAA/DOT Cross-Refs', color: '#FDE68A' },
  { value: 'VI-C', label: 'VI-C — UFC/DoD Cross-Refs', color: '#FDE68A' },
  { value: 'VII-A', label: 'VII-A — Scrubbed (DAF)', color: '#A5B4FC' },
  { value: 'VII-B', label: 'VII-B — Scrubbed (FAA)', color: '#A5B4FC' },
  { value: 'VII-C', label: 'VII-C — Scrubbed (Vols 2-3)', color: '#A5B4FC' },
] as const

// === Waiver Classifications (AF Form 505) ===

export const WAIVER_CLASSIFICATIONS = [
  { value: 'permanent', label: 'Permanent', emoji: '🔒', description: 'Permanent waiver — no corrective action planned' },
  { value: 'temporary', label: 'Temporary', emoji: '⏳', description: 'Temporary waiver — corrective action programmed' },
  { value: 'construction', label: 'Construction', emoji: '🏗️', description: 'Construction-period waiver' },
  { value: 'event', label: 'Event', emoji: '📅', description: 'Single event or exercise waiver' },
  { value: 'extension', label: 'Extension', emoji: '🔄', description: 'Extension of existing waiver' },
  { value: 'amendment', label: 'Amendment', emoji: '📝', description: 'Amendment to existing waiver' },
] as const

// === Waiver Status Styling ===

export const WAIVER_STATUS_CONFIG = {
  draft:     { color: '#9CA3AF', bg: '#E5E7EB', label: 'Draft' },
  pending:   { color: '#3B82F6', bg: '#DBEAFE', label: 'Pending' },
  approved:  { color: '#10B981', bg: '#D1FAE5', label: 'Approved' },
  active:    { color: '#8B5CF6', bg: '#EDE9FE', label: 'Active' },
  completed: { color: '#22C55E', bg: '#DCFCE7', label: 'Closed' },
  cancelled: { color: '#EF4444', bg: '#FEE2E2', label: 'Cancelled' },
  expired:   { color: '#F59E0B', bg: '#FEF3C7', label: 'Expired' },
} as const

// === Waiver Status Transitions ===

export const WAIVER_TRANSITIONS: Record<string, string[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['approved', 'draft', 'cancelled'],
  approved: ['active', 'cancelled'],
  active: ['completed', 'expired', 'cancelled'],
  completed: ['active', 'expired'],
  cancelled: ['draft'],
  expired: ['active', 'completed'],
}

// === Waiver Hazard Ratings ===

export const WAIVER_HAZARD_RATINGS = [
  { value: 'low', label: 'Low', color: '#3B82F6', bg: '#DBEAFE' },
  { value: 'medium', label: 'Medium', color: '#F59E0B', bg: '#FEF3C7' },
  { value: 'high', label: 'High', color: '#F97316', bg: '#FED7AA' },
  { value: 'extremely_high', label: 'Extremely High', color: '#EF4444', bg: '#FEE2E2' },
] as const

// === Waiver Criteria Sources ===

export const WAIVER_CRITERIA_SOURCES = [
  { value: 'ufc_3_260_01', label: 'UFC 3-260-01' },
  { value: 'ufc_3_260_04', label: 'UFC 3-260-04' },
  { value: 'ufc_3_535_01', label: 'UFC 3-535-01' },
  { value: 'other', label: 'Other' },
] as const

// === Waiver Coordination Offices ===

export const WAIVER_COORDINATION_OFFICES = [
  { value: 'civil_engineer', label: 'Civil Engineer (BCE)' },
  { value: 'airfield_manager', label: 'Airfield Manager' },
  { value: 'airfield_ops_terps', label: 'Airfield Ops / TERPS' },
  { value: 'base_safety', label: 'Base Safety' },
  { value: 'installation_cc', label: 'Installation Commander' },
  { value: 'other', label: 'Other' },
] as const

// === Waiver Review Recommendations ===

export const WAIVER_REVIEW_RECOMMENDATIONS = [
  { value: 'retain', label: 'Retain' },
  { value: 'modify', label: 'Modify' },
  { value: 'cancel', label: 'Cancel / Remove' },
  { value: 'convert_to_temporary', label: 'Convert to Temporary' },
  { value: 'convert_to_permanent', label: 'Convert to Permanent' },
] as const

// === User Roles (SRS Section 2.1) ===

export const USER_ROLES = {
  airfield_manager: { label: 'Airfield Manager', canCreate: true, canManageUsers: true },
  namo:             { label: 'NAMO', canCreate: true, canManageUsers: true },
  amops:            { label: 'AMOPS', canCreate: true, canManageUsers: false },
  ces:              { label: 'CES', canCreate: false, canManageUsers: false },
  safety:           { label: 'Safety', canCreate: false, canManageUsers: false },
  atc:              { label: 'ATC', canCreate: false, canManageUsers: false },
  read_only:        { label: 'Read Only', canCreate: false, canManageUsers: false },
  base_admin:       { label: 'Base Admin', canCreate: true, canManageUsers: true },
  sys_admin:        { label: 'System Admin', canCreate: true, canManageUsers: true },
} as const

// Rank options for user management
export const RANK_OPTIONS = [
  // Enlisted
  { value: 'AB', label: 'AB - Airman Basic' },
  { value: 'Amn', label: 'Amn - Airman' },
  { value: 'A1C', label: 'A1C - Airman First Class' },
  { value: 'SrA', label: 'SrA - Senior Airman' },
  { value: 'SSgt', label: 'SSgt - Staff Sergeant' },
  { value: 'TSgt', label: 'TSgt - Technical Sergeant' },
  { value: 'MSgt', label: 'MSgt - Master Sergeant' },
  { value: 'SMSgt', label: 'SMSgt - Senior Master Sergeant' },
  { value: 'CMSgt', label: 'CMSgt - Chief Master Sergeant' },
  // Officer
  { value: '2d Lt', label: '2d Lt - Second Lieutenant' },
  { value: '1st Lt', label: '1st Lt - First Lieutenant' },
  { value: 'Capt', label: 'Capt - Captain' },
  { value: 'Maj', label: 'Maj - Major' },
  { value: 'Lt Col', label: 'Lt Col - Lieutenant Colonel' },
  { value: 'Col', label: 'Col - Colonel' },
  { value: 'Brig Gen', label: 'Brig Gen - Brigadier General' },
  { value: 'Maj Gen', label: 'Maj Gen - Major General' },
  { value: 'Lt Gen', label: 'Lt Gen - Lieutenant General' },
  { value: 'Gen', label: 'Gen - General' },
  // Civilian
  { value: 'Mr.', label: 'Mr.' },
  { value: 'Ms.', label: 'Ms.' },
  { value: 'Mrs.', label: 'Mrs.' },
  { value: 'Dr.', label: 'Dr.' },
  { value: 'GS', label: 'GS - General Schedule' },
  { value: 'CTR', label: 'CTR - Contractor' },
] as const

// ========================================================
// === ACSI — Airfield Compliance and Safety Inspection ===
// === DAFMAN 13-204v2, Para 5.4.3, Attachment 2        ===
// ========================================================

export interface AcsiChecklistItem {
  id: string          // e.g. '1.1', '3.1.2'
  question: string    // Full checklist question text
  subsection?: string // Parent heading for sub-items (e.g. 'Runways')
  /** If true, item has A/B/C sub-fields (Operable, Properly Sited, Clear of Vegetation) */
  hasSubFields?: boolean
  /** Non-answerable heading text shown before items (no Y/N/NA) */
  isHeading?: boolean
}

export const ACSI_SUB_FIELD_LABELS = [
  { key: 'a', label: '(A) Operable' },
  { key: 'b', label: '(B) Properly Sited' },
  { key: 'c', label: '(C) Clear of Vegetation/Obstructions' },
] as const

export interface AcsiChecklistSection {
  id: string          // e.g. 'acsi-1'
  number: number      // 1–10
  title: string       // Section title
  reference: string   // Regulatory reference
  scope?: string      // Scope note
  preamble?: string   // Section-level preamble text
  items: AcsiChecklistItem[]
}

export const ACSI_CHECKLIST_SECTIONS: AcsiChecklistSection[] = [
  // ── Section 1: Pavement Areas ──
  {
    id: 'acsi-1',
    number: 1,
    title: 'Pavement Areas',
    reference: 'DAFMAN 13-204 V2, TSPWG M 3260-01.09-2, AFMAN 32-1041, UFC 3-260-01, UFC 3-260-03',
    scope: 'Runways, Taxiways, Ramps, Aprons',
    items: [
      { id: '1.1', question: 'Are pavement areas free of depressions and drain sufficiently to prevent ponding that obscures markings, attracts wildlife, or otherwise impairs safe aircraft operations such as hydroplaning?' },
      { id: '1.2', question: 'Are pavement areas free of excessive rubber deposits, loose aggregate, contaminants, or other foreign objects?' },
      { id: '1.3', question: 'Are pavement areas free of scaling, spalling, cracks, and surface variations such as bumps and low spots that could cause damage to aircraft, cut tires or cause tail hook skip?' },
      { id: '1.4', question: 'Are runway, taxiway, apron edges and pavement joints free of vegetation growth that impedes draining or causes premature pavement deterioration?' },
      { id: '1.5', question: 'Are pavements free of holes that could impair directional control of aircraft or possibly damage a tire? Holes greater than 3" in diameter can damage small, high-pressure tires on trainer and fighter aircraft.' },
      { id: '1.6', question: 'Are pavement lips no greater than necessary to allow water to drain off the pavement?' },
      { id: '1.7', question: 'Are primary pavements structurally capable of supporting the mission? (Review latest HQ AFCEC Pavement Evaluation Report)' },
      { id: '1.8', question: 'Is the HQ AFCEC airfield pavement evaluation report current? (Evaluation is ten years or less and reflects the latest repair/construction efforts.)' },
      { id: '1.9', question: 'Are runway friction characteristics adequate? (See latest HQ AFCEC Friction Characteristics Report)' },
      { id: '1.10', question: 'Is the HQ AFCEC airfield pavement condition index survey current? (Survey is five years or less.)' },
      { id: '1.11', question: 'Is pavement Condition Index (PCI) greater than 70? Pavement must have a PCI equal to or greater than 70 to be rated adequate.' },
    ],
  },
  // ── Section 2: Airfield Safety Clearances and Apron Areas ──
  {
    id: 'acsi-2',
    number: 2,
    title: 'Airfield Safety Clearances and Apron Areas',
    reference: 'UFC 3-260-01, AFI 32-1015, AFH 32-7084',
    items: [
      { id: '2.1', question: 'Are the runway lateral clearance zones ground surfaces clear of fixed or mobile objects and graded to UFC 3-260-01, Table 3-2? Is there any erosion, unusual depressions or rutting caused by vehicles or animals?' },
      { id: '2.2', question: 'Is the graded area of the clear zone cleared, grubbed of stumps and free of abrupt surface irregularities, ditches, and ponding areas?' },
      { id: '2.3', question: 'Is the graded portion of the Clear Zone free of above ground structures, objects, or roadways with the exception to those items listed within UFC 3-260-01, Appendix B Section 13?' },
      { id: '2.4', question: 'Are all penetrations to airfield imaginary surfaces documented? Check airfield obstruction maps for accuracy and currency.' },
      { id: '2.5', question: 'Are all violations along the taxiways documented? (Required clearance from taxiway centerline to fixed or mobile obstacles: Class A: 150ft; Class B: 200ft)' },
      { id: '2.6', question: 'Are all violations along the apron edges documented? (Required clearance from apron boundary marking to fixed or mobile obstacles based on most demanding aircraft.)' },
      { id: '2.7', question: 'Are storm sewer system inlets and drainage channels free of debris? Note any standing water.' },
      { id: '2.8', question: 'Are manhole, hand hole, drainage structures, inlet and sewer covers in place? Is the top surface of foundations, covers and frames at grade level (no more than 3 inches high)?' },
    ],
  },
  // ── Section 3: Airfield Markings ──
  {
    id: 'acsi-3',
    number: 3,
    title: 'Airfield Markings',
    reference: 'AFMAN 32-1040, UFC 3-260-04',
    preamble: 'For each marking type: (1) Properly depicted and sited? (2) Free of peeled/blistered/chipped/faded paint? (3) Clearly visible day and night? (4) Free of excessive rubber deposits?',
    items: [
      // 3.1 Runways
      { id: '3.1.1', question: 'Centerline', subsection: 'Runways' },
      { id: '3.1.2', question: 'Threshold', subsection: 'Runways' },
      { id: '3.1.3', question: 'Displaced Threshold', subsection: 'Runways' },
      { id: '3.1.4', question: 'Designation', subsection: 'Runways' },
      { id: '3.1.5', question: 'Side Stripes', subsection: 'Runways' },
      { id: '3.1.6', question: 'Touchdown Zone', subsection: 'Runways' },
      { id: '3.1.7', question: 'Fixed Distance (ICAO: Aiming Points)', subsection: 'Runways' },
      { id: '3.1.8', question: 'Aircraft Arresting System Warning', subsection: 'Runways' },
      { id: '3.1.9', question: 'Overruns', subsection: 'Runways' },
      // 3.2 Taxiways
      { id: '3.2.1', question: 'Centerline Stripe', subsection: 'Taxiways' },
      { id: '3.2.2', question: 'Instrument Holding Positions', subsection: 'Taxiways' },
      { id: '3.2.3', question: 'VFR Runway Holding Position', subsection: 'Taxiways' },
      { id: '3.2.4', question: 'Side Stripes', subsection: 'Taxiways' },
      { id: '3.2.5', question: 'Taxilane Edge Stripes', subsection: 'Taxiways' },
      // 3.3–3.5
      { id: '3.3', question: 'Apron markings' },
      { id: '3.4', question: 'Helipads (Perimeter/Identification/Hospital)' },
      { id: '3.5', question: 'Parking Ramps' },
      // 3.6 Closed Pavements
      { id: '3.6.1', question: 'Permanently Closed Runways/Taxiways', subsection: 'Closed Pavements' },
      { id: '3.6.2', question: 'Temporarily Closed Runways/Taxiways', subsection: 'Closed Pavements' },
      { id: '3.6.3', question: 'Aprons', subsection: 'Closed Pavements' },
      // 3.7
      { id: '3.7', question: 'Barricades' },
      // 3.8 Shoulders
      { id: '3.8.1', question: 'Runway shoulders (deceptive surface)', subsection: 'Shoulders' },
      { id: '3.8.2', question: 'Taxiway shoulders (deceptive surface)', subsection: 'Shoulders' },
      { id: '3.8.3', question: 'Apron shoulders (deceptive surface)', subsection: 'Shoulders' },
      // 3.9–3.12
      { id: '3.9', question: 'INS Checkpoints' },
      { id: '3.10', question: 'Ground Receiver Checkpoints' },
      { id: '3.11', question: 'Compass Calibration Pad' },
      { id: '3.12.1', question: 'Landing Zone', subsection: 'Expedient Airfield Markings' },
      { id: '3.12.2', question: 'Minimum Operating Strip (MOS)', subsection: 'Expedient Airfield Markings' },
      { id: '3.12.3', question: 'Taxiway', subsection: 'Expedient Airfield Markings' },
      // 3.13–3.14
      { id: '3.13.1', question: 'Are vehicular access roads leading to runways marked with a white "stop" bar at the normal positions for VFR or instrument hold lines?', subsection: 'Airfield Vehicular Access Roads' },
      { id: '3.14', question: 'Are non-standard/additional markings approved and do not interfere with required airfield markings?' },
    ],
  },
  // ── Section 4: Airfield Signs ──
  {
    id: 'acsi-4',
    number: 4,
    title: 'Airfield Signs',
    reference: 'UFC 3-535-01',
    items: [
      { id: '4.1', question: 'Are mandatory signs installed and properly sited in accordance with current criteria?' },
      { id: '4.2', question: 'Are information signs properly sited in accordance with current criteria?' },
      { id: '4.3', question: 'Do all signs have the correct legend and orientation? Color coding? Easy to read? Illuminated for night operations?' },
      { id: '4.4', question: 'Are signs mounted on frangible couplings? Note any broken panels.' },
      { id: '4.5', question: 'Are signs clear of vegetation growth or dirt that obscures a vehicle operator or pilot\'s view?' },
      { id: '4.6', question: 'Are appropriate sign sizes installed to correlate with the Instrument Landing System?' },
    ],
  },
  // ── Section 5: Airfield Lighting ──
  {
    id: 'acsi-5',
    number: 5,
    title: 'Airfield Lighting',
    reference: 'UFC 3-535-01',
    items: [
      // 5.1 & 5.2 — answerable general items
      { id: '5.1', question: 'All required lighting systems installed per UFC 3-535-01 Table 2-1A?' },
      { id: '5.2', question: 'Elevated fixtures on frangible couplings, lens orientation within tolerances?' },
      // 5.3 — sub-heading (not answerable), applies to all items below
      { id: '5.3', question: '5.3: For each system below — (A) Operable, (B) Properly sited, (C) Clear of vegetation/obstructions', isHeading: true },
      // 5.5 Approach Lighting Systems
      { id: '5.5.1', question: 'ALSF-1', subsection: 'Approach Lighting Systems', hasSubFields: true },
      { id: '5.5.2', question: 'ALSF-2', subsection: 'Approach Lighting Systems', hasSubFields: true },
      { id: '5.5.3', question: 'Short Approach Lighting System (SALS)', subsection: 'Approach Lighting Systems', hasSubFields: true },
      { id: '5.5.4', question: 'Simplified Short Approach Lighting System (SSALR)', subsection: 'Approach Lighting Systems', hasSubFields: true },
      { id: '5.5.5', question: 'Medium Intensity Approach Lighting System (MALSR)', subsection: 'Approach Lighting Systems', hasSubFields: true },
      { id: '5.5.6', question: 'Runway End Identifier Lights (REIL)', subsection: 'Approach Lighting Systems', hasSubFields: true },
      { id: '5.5.7', question: 'Precision Approach Path Indicator (PAPI)', subsection: 'Approach Lighting Systems', hasSubFields: true },
      // 5.6 Runway Lighting
      { id: '5.6.1', question: 'High Intensity Runway Lights (HIRL)', subsection: 'Runway Lighting Systems', hasSubFields: true },
      { id: '5.6.2', question: 'Medium Intensity Runway Lights (MIRL)', subsection: 'Runway Lighting Systems', hasSubFields: true },
      { id: '5.6.3', question: 'Threshold Lights', subsection: 'Runway Lighting Systems', hasSubFields: true },
      { id: '5.6.4', question: 'Lights with Displaced Threshold', subsection: 'Runway Lighting Systems', hasSubFields: true },
      { id: '5.6.5', question: 'Runway End Lights', subsection: 'Runway Lighting Systems', hasSubFields: true },
      { id: '5.6.6', question: 'Runway Centerline Lights', subsection: 'Runway Lighting Systems', hasSubFields: true },
      { id: '5.6.7', question: 'Touchdown Zone Lights', subsection: 'Runway Lighting Systems', hasSubFields: true },
      { id: '5.6.8', question: 'CAT II and CAT III Lighting Systems', subsection: 'Runway Lighting Systems', hasSubFields: true },
      // 5.7 Taxiway Lighting
      { id: '5.7.1', question: 'Edge Lights', subsection: 'Taxiway Lighting', hasSubFields: true },
      { id: '5.7.2', question: 'Centerline Lights', subsection: 'Taxiway Lighting', hasSubFields: true },
      { id: '5.7.3', question: 'Runway Exit Lights', subsection: 'Taxiway Lighting', hasSubFields: true },
      { id: '5.7.4', question: 'Taxiway Hold Lights / Stop Bar', subsection: 'Taxiway Lighting', hasSubFields: true },
      { id: '5.7.5', question: 'Hold Position Edge Lights (Runway Guard Lights)', subsection: 'Taxiway Lighting', hasSubFields: true },
      { id: '5.7.6', question: 'End Lights', subsection: 'Taxiway Lighting', hasSubFields: true },
      // 5.8–5.11
      { id: '5.8', question: 'Obstruction Lights', hasSubFields: true },
      { id: '5.9.1', question: 'Perimeter Lights', subsection: 'Helipad Lights', hasSubFields: true },
      { id: '5.9.2', question: 'VFR Landing Direction Lights and Approach Lights', subsection: 'Helipad Lights', hasSubFields: true },
      { id: '5.9.3', question: 'Floodlights', subsection: 'Helipad Lights', hasSubFields: true },
      { id: '5.9.4', question: 'Approach Slope Indicator', subsection: 'Helipad Lights', hasSubFields: true },
      { id: '5.9.5', question: 'Identification Beacon', subsection: 'Helipad Lights', hasSubFields: true },
      { id: '5.9.6', question: 'Wind Direction Indicators', subsection: 'Helipad Lights', hasSubFields: true },
      { id: '5.10.1', question: 'Heliport', subsection: 'Heliport Lights', hasSubFields: true },
      { id: '5.10.2', question: 'Rotary Wing Landing Lanes', subsection: 'Heliport Lights', hasSubFields: true },
      { id: '5.10.3', question: 'Refueling Area Lights', subsection: 'Heliport Lights', hasSubFields: true },
      { id: '5.10.4', question: 'Hoverlane Lights', subsection: 'Heliport Lights', hasSubFields: true },
      { id: '5.11.1', question: 'Airport Beacon', subsection: 'Miscellaneous Lighted Visual Aids', hasSubFields: true },
      { id: '5.11.2', question: 'Runway/Taxiway Retro-Reflective Markers', subsection: 'Miscellaneous Lighted Visual Aids', hasSubFields: true },
      { id: '5.11.3', question: 'Other Auxiliary Lights', subsection: 'Miscellaneous Lighted Visual Aids', hasSubFields: true },
      { id: '5.11.4', question: 'Apron/Security', subsection: 'Miscellaneous Lighted Visual Aids', hasSubFields: true },
    ],
  },
  // ── Section 6: Wind Cones ──
  {
    id: 'acsi-6',
    number: 6,
    title: 'Wind Cones',
    reference: 'UFC 3-535-01',
    items: [
      { id: '6.1', question: 'Are wind cone fabrics in good condition? (Must not be badly worn, rotted, faded, or soiled.)' },
      { id: '6.2', question: 'Does the wind cone assembly swing freely at 36 degrees?' },
      { id: '6.3', question: 'Are wind cones illuminated? If so, are the lights operable?' },
      { id: '6.4', question: 'Are the wind cones free of obscuring vegetation?' },
      { id: '6.5', question: 'Are wind cones sited in accordance with UFC 3-535-01?' },
    ],
  },
  // ── Section 7: Obstructions to Air Navigation ──
  {
    id: 'acsi-7',
    number: 7,
    title: 'Obstructions to Air Navigation',
    reference: '14 CFR Part 77, UFC 3-260-01',
    items: [
      { id: '7.1', question: 'Are all obstructions identified and documented? (Contact Community Planner and TERPS for assistance.)' },
      { id: '7.2', question: 'Are all obstructions allowed (permissible deviations) or waived? Are they properly marked and lighted?' },
    ],
  },
  // ── Section 8: Arresting Systems ──
  {
    id: 'acsi-8',
    number: 8,
    title: 'Arresting Systems',
    reference: 'AFMAN 32-1040, DAFMAN 32-1084, UFC 3-260-01, FC 3-260-18F',
    items: [
      { id: '8.1', question: 'Are unidirectional systems and nets located no closer than 35 feet from the threshold of the runway?' },
      { id: '8.2', question: 'Are energy absorbers located below grade or at least 275 feet from the centerline of the runway pavement?' },
      { id: '8.3', question: 'Are paved transitions and buried crushed stone ramps provided around the arresting system components? Is the area over the fairlead tube finished to a grade of 1V:30H or flatter?' },
      { id: '8.4', question: 'Do the shelters used for above-grade systems comply with AFMAN 32-1040 and UFC 3-260-01, Appendix B Section 13?' },
      { id: '8.5', question: 'Is the minimum effective pendant height greater than 1.5 inches? If 1.75 inches or less, has repair been initiated?' },
      { id: '8.6', question: 'Do aircraft arresting systems meet location and siting requirements?' },
      { id: '8.7', question: 'Do arresting system cables have proper tension, doughnut spacing, and tie-downs? Are there any broken tie-downs?' },
      { id: '8.8', question: 'Is the pavement type the same in the critical area (center 75 feet of pavement within 200 feet on either side of the cable)?' },
      { id: '8.9', question: 'Is the pavement within 200 feet either side of the cable free of excessive paint build up that could cause a tail hook skip?' },
    ],
  },
  // ── Section 9: Other Hazards ──
  {
    id: 'acsi-9',
    number: 9,
    title: 'Other Hazards',
    reference: 'DAFI 91-202, DAFI 901-212, DAFI 31-101',
    items: [
      { id: '9.1', question: 'Are all Bird/Wildlife hazards and habitat control identified and management control measures in place?' },
      { id: '9.2', question: 'Is the airfield a controlled area (security, fencing, and barricades) to prevent unauthorized access?' },
    ],
  },
  // ── Section 10: Local Information / Hazardous Conditions ──
  {
    id: 'acsi-10',
    number: 10,
    title: 'Local Information / Hazardous Conditions',
    reference: 'Wing/Base Instructions',
    items: [],
  },
]

export const ACSI_STATUS_CONFIG = {
  draft:       { color: '#9CA3AF', bg: '#E5E7EB', label: 'Draft' },
  in_progress: { color: '#3B82F6', bg: '#DBEAFE', label: 'In Progress' },
  completed:   { color: '#10B981', bg: '#D1FAE5', label: 'Completed' },
  staffed:     { color: '#8B5CF6', bg: '#EDE9FE', label: 'Staffed' },
} as const

export const ACSI_TEAM_ROLES = [
  { value: 'afm', label: 'Airfield Manager', required: true },
  { value: 'ce', label: 'CE Representative', required: true },
  { value: 'safety', label: 'Safety', required: true },
  { value: 'raws', label: 'RAWS', required: false },
  { value: 'weather', label: 'Weather', required: false },
  { value: 'sfs', label: 'SFS', required: false },
  { value: 'terps', label: 'TERPS', required: false },
  { value: 'other', label: 'Other', required: false },
] as const
