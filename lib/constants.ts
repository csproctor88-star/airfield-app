// Airfield OPS Management Suite — App-wide Constants
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

// === Daily Inspection Items (SRS Section 6.7) ===

export const DAILY_INSPECTION_ITEMS = [
  { id: 'rwy-01', section: 'Runway', item: 'Pavement surface condition — no FOD, spalling, cracking, or settlement' },
  { id: 'rwy-02', section: 'Runway', item: 'Runway markings — visible, not faded or obscured' },
  { id: 'rwy-03', section: 'Runway', item: 'Edge lights — operational, lenses clean and unbroken' },
  { id: 'rwy-04', section: 'Runway', item: 'Threshold and end lights — operational' },
  { id: 'rwy-05', section: 'Runway', item: 'Touchdown zone lights — operational (if installed)' },
  { id: 'rwy-06', section: 'Runway', item: 'Centerline lights — operational (if installed)' },
  { id: 'twy-01', section: 'Taxiway', item: 'Taxiway pavement — no FOD, defects, or standing water' },
  { id: 'twy-02', section: 'Taxiway', item: 'Taxiway markings and signs — visible, correct, undamaged' },
  { id: 'twy-03', section: 'Taxiway', item: 'Taxiway edge lights — operational' },
  { id: 'twy-04', section: 'Taxiway', item: 'Hold position signs and markings — visible and correct' },
  { id: 'app-01', section: 'Approach/Departure', item: 'Approach lighting system (MALSR) — operational' },
  { id: 'app-02', section: 'Approach/Departure', item: 'PAPI/VASI — operational and aligned' },
  { id: 'app-03', section: 'Approach/Departure', item: 'Approach/departure zones — clear of obstructions' },
  { id: 'sup-01', section: 'Support', item: 'Wind cone/indicator — operational, visible, correct orientation' },
  { id: 'sup-02', section: 'Support', item: 'Segmented circle — no damage, proper markings' },
  { id: 'sup-03', section: 'Support', item: 'Airfield perimeter — fencing intact, no unauthorized access points' },
] as const

// === Check Type Configuration ===

export const CHECK_TYPE_CONFIG = {
  fod:       { label: 'FOD Check', icon: 'Search', color: '#EAB308' },
  bash:      { label: 'BASH Assessment', icon: 'Bird', color: '#A78BFA' },
  rcr:       { label: 'RCR Reading', icon: 'BarChart3', color: '#22D3EE' },
  rsc:       { label: 'RSC Report', icon: 'Snowflake', color: '#3B82F6' },
  emergency: { label: 'Emergency Response', icon: 'Siren', color: '#EF4444' },
} as const

// === NOTAM Types ===

export const NOTAM_TYPES = [
  'Runway Closure',
  'Taxiway Closure',
  'Lighting',
  'Construction',
  'NAVAID',
  'Custom',
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
