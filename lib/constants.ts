// Airfield OPS Management Suite — App-wide Constants
// Source: SRS Sections 6 & 14

// === Selfridge ANGB Configuration (SRS Section 14) ===

export const INSTALLATION = {
  name: 'Selfridge Air National Guard Base',
  icao: 'KMTC',
  unit: '127th Wing',
  majcom: 'Michigan Air National Guard',
  location: 'Harrison Township, Michigan',
  elevation_msl: 583,
  timezone: 'America/Detroit',
  runways: [
    {
      id: '01/19',
      length_ft: 9000,
      width_ft: 150,
      surface: 'Asphalt',
      runway_class: 'A' as const,
      end1: {
        designator: '01',
        latitude: 42.6042,
        longitude: -82.8340,
        heading: 10,
        approach_lighting: 'MALSR',
      },
      end2: {
        designator: '19',
        latitude: 42.6237,
        longitude: -82.8309,
        heading: 190,
        approach_lighting: 'None',
      },
    },
  ],
  ce_shops: [
    'CE Pavements',
    'CE Electrical',
    'CE Grounds',
    'CE Structures',
    'CE HVAC',
    'Airfield Mgmt',
  ],
} as const

// === Discrepancy Types (SRS Section 6.1) ===

export const DISCREPANCY_TYPES = [
  { value: 'fod_hazard', label: 'FOD Hazard', defaultSeverity: 'critical', defaultShop: 'Airfield Mgmt' },
  { value: 'pavement', label: 'Pavement Deficiency', defaultSeverity: 'high', defaultShop: 'CE Pavements' },
  { value: 'lighting', label: 'Lighting Outage/Deficiency', defaultSeverity: 'high', defaultShop: 'CE Electrical' },
  { value: 'marking', label: 'Marking Deficiency', defaultSeverity: 'medium', defaultShop: 'CE Pavements' },
  { value: 'signage', label: 'Signage Deficiency', defaultSeverity: 'medium', defaultShop: 'CE Electrical' },
  { value: 'drainage', label: 'Drainage Issue', defaultSeverity: 'medium', defaultShop: 'CE Structures' },
  { value: 'vegetation', label: 'Vegetation Encroachment', defaultSeverity: 'low', defaultShop: 'CE Grounds' },
  { value: 'wildlife', label: 'Wildlife Hazard', defaultSeverity: 'high', defaultShop: 'Airfield Mgmt' },
  { value: 'obstruction', label: 'Airfield Obstruction', defaultSeverity: 'critical', defaultShop: 'CE / Airfield Mgmt' },
  { value: 'navaid', label: 'NAVAID Deficiency', defaultSeverity: 'critical', defaultShop: 'CE Electrical / FAA' },
  { value: 'other', label: 'Other', defaultSeverity: 'medium', defaultShop: null },
] as const

// === Severity Styling (SRS Section 6.2) ===

export const SEVERITY_CONFIG = {
  critical: { color: '#EF4444', bg: '#FEE2E2', label: 'CRITICAL', textColor: 'text-red-600' },
  high:     { color: '#F97316', bg: '#FED7AA', label: 'HIGH', textColor: 'text-orange-600' },
  medium:   { color: '#EAB308', bg: '#FEF3C7', label: 'MEDIUM', textColor: 'text-yellow-600' },
  low:      { color: '#3B82F6', bg: '#DBEAFE', label: 'LOW', textColor: 'text-blue-600' },
} as const

export const STATUS_CONFIG = {
  open:        { color: '#EF4444', bg: '#FEE2E2', label: 'Open' },
  assigned:    { color: '#F97316', bg: '#FED7AA', label: 'Assigned' },
  in_progress: { color: '#EAB308', bg: '#FEF3C7', label: 'In Progress' },
  resolved:    { color: '#22C55E', bg: '#DCFCE7', label: 'Resolved' },
  closed:      { color: '#6B7280', bg: '#F3F4F6', label: 'Closed' },
} as const

// === Status Transitions (SRS Section 6.4) ===

export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  open:        ['assigned', 'in_progress', 'resolved', 'closed'],
  assigned:    ['in_progress', 'open'],
  in_progress: ['resolved', 'open'],
  resolved:    ['closed', 'open'],
  closed:      ['open'],
}

export const TRANSITION_REQUIREMENTS: Record<string, string[]> = {
  'open→assigned':        ['assigned_shop'],
  'assigned→in_progress': [],
  'in_progress→resolved': ['resolution_notes'],
  'resolved→closed':      [],
  'closed→open':          ['notes'],
}

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
