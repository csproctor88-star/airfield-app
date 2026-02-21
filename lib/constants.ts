// Glidepath — App-wide Constants
// Source: SRS Sections 6 & 14

// === Selfridge ANGB Configuration (SRS Section 14) ===

export const INSTALLATION = {
  name: 'Selfridge Air National Guard Base',
  icao: 'KMTC',
  unit: '127th Wing',
  majcom: 'Michigan Air National Guard',
  location: 'Harrison Township, Michigan',
  elevation_msl: 580,
  timezone: 'America/Detroit',
  runways: [
    {
      id: '01/19',
      length_ft: 9000,
      width_ft: 150,
      surface: 'Asphalt',
      true_heading: 2, // FAA true heading (end1 → end2)
      end1: {
        designator: '01',
        latitude: 42.601550,
        longitude: -82.837339,
        heading: 8,
        approach_lighting: 'SALS',
      },
      end2: {
        designator: '19',
        latitude: 42.626239,
        longitude: -82.836481,
        heading: 188,
        approach_lighting: 'ALSF-1',
      },
    },
  ],
  ce_shops: [
    'CE Pavements',
    'CE Electrical',
    'CE Grounds',
    'CE Structures',
    'CE HVAC',
    'CES Engineering',
    'Airfield Management',
  ],
} as const

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
  type?: 'pass_fail' | 'bwc'  // default is pass_fail
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
      { id: 'af-4', itemNumber: 4, item: "Graded Area — 1000'L x 1000'W" },
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
    conditional: 'Construction meeting inspection',
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
]

// === Check Type Configuration ===

export const CHECK_TYPE_CONFIG = {
  fod:              { label: 'FOD Check', color: '#EAB308', icon: '🔍' },
  rsc:              { label: 'RSC Check', color: '#3B82F6', icon: '🌧️' },
  rcr:              { label: 'RCR Check', color: '#22D3EE', icon: '📊' },
  ife:              { label: 'In-Flight Emergency', color: '#EF4444', icon: '🚨' },
  ground_emergency: { label: 'Ground Emergency', color: '#F97316', icon: '🚒' },
  heavy_aircraft:   { label: 'Heavy Aircraft Check', color: '#8B5CF6', icon: '✈️' },
  bash:             { label: 'BASH Check', color: '#A78BFA', icon: '🦅' },
} as const

// === Airfield Areas (Multi-select for checks) ===

export const AIRFIELD_AREAS = [
  'Entire Airfield',
  'RWY 01/19',
  'West Ramp',
  'East Ramp',
  'HAZ Cargo Pad',
  'USCG Apron',
  'DHS Apron',
  'Army Apron',
  'TWY A',
  'TWY G',
  'TWY K',
  'TWY E',
  'TWY B',
  'TWY L',
  'TWY H',
  'TWY J',
  'Access Road',
] as const

// === RSC Conditions ===

export const RSC_CONDITIONS = ['Dry', 'Wet'] as const

// === RCR Condition Types ===

export const RCR_CONDITION_TYPES = [
  'Dry', 'Wet', 'Slush', 'Ice', 'Patchy Ice', 'Snow',
  'Patchy Snow', 'Frost', 'Standing Water', 'Flooded',
] as const

// === BASH Condition Codes ===

export const BASH_CONDITION_CODES = ['LOW', 'MODERATE', 'SEVERE'] as const

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

// === User Roles (SRS Section 2.1) ===

export const USER_ROLES = {
  airfield_manager: { label: 'Airfield Manager', canCreate: true, canManageUsers: true },
  am_ncoic:         { label: 'AM NCOIC', canCreate: true, canManageUsers: false },
  am_tech:          { label: 'AM Technician', canCreate: true, canManageUsers: false },
  ce_shop:          { label: 'CE Shop', canCreate: false, canManageUsers: false },
  wing_safety:      { label: 'Wing Safety', canCreate: false, canManageUsers: false },
  atc:              { label: 'ATC / RAPCON', canCreate: false, canManageUsers: false },
  observer:         { label: 'Observer', canCreate: false, canManageUsers: false },
  sys_admin:        { label: 'System Admin', canCreate: true, canManageUsers: true },
} as const
