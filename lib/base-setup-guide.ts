import type { WizardStepKey } from '@/lib/modules-config'

export type GuideRequired = 'yes' | 'optional' | 'conditional'

export type GuideCite = {
  reg: string
  para: string
  outcome: string
}

export type StepGuide = {
  what: string
  how: string
  why: string
  required: GuideRequired
  examples: string[]
  /** null when the step has no DAFMAN/UFC compliance hook (administrative
   *  or operationally-specific configuration). The Guide panel renders a
   *  short notice in that case instead of the generated IAW sentence. */
  cite: GuideCite | null
  fields: Record<string, string>
}

export const BASE_SETUP_GUIDE: Record<WizardStepKey, StepGuide> = {
  runways: {
    what:
      'Defines every runway at the installation, including length, width, surface, true heading, and per-end coordinates and elevations. ' +
      'Each runway becomes the structural anchor that the rest of the wizard hangs off — Areas reference it, NAVAIDs are tied to it, ' +
      'Lighting Systems clone DAFMAN templates per runway class, parking clearance envelopes ray-test against it, and obstruction ' +
      'evaluations build their imaginary surfaces from the published threshold coordinates and elevations entered here. ' +
      'The Established Airfield Elevation (highest runway-end MSL) is captured separately at the top of this step and is used as the ' +
      'reference elevation for obstruction evaluations.',
    how:
      'Use Import from ICAO to pull surveyed coordinates, length, width, surface, and approach lighting directly from the FAA ' +
      'database for the airport identifier on file. Imported runways can be edited inline. The "Adjust on Map" button drops draggable ' +
      'pins on satellite imagery for sub-meter precision when the published coords need a final tune. Any number of runways are ' +
      'supported.',
    why:
      'Without correctly entered runways, NAVAID and Lighting alignment is wrong, parking clearance lines anchor on the wrong ' +
      'edges, and obstruction surfaces are mislocated. Runway data is the single most leveraged configuration in the system — ' +
      'get it right once and every downstream module benefits.',
    required: 'yes',
    examples: ['06L/24R', '13/31', '04L/22R', '08/26', '17/35'],
    cite: null,
    fields: {
      established_elevation:
        'The highest runway-end elevation in feet MSL. Used as the reference elevation for obstruction surface analysis under ' +
        'UFC 3-260-01. Pulled automatically from imported runways but editable.',
      runway_id:
        'The runway designator pair, e.g. "06L/24R" or "13/31". Use the same format published on the IAP and on signage.',
      runway_class:
        'Class B is standard USAF (ARC III–IV). Army Class B is 5,000 ft. The class drives obstruction surface widths and parking ' +
        'clearance envelopes per UFC 3-260-01. Civilian Part 139 airports leave this blank — the FAA Approach Type field drives ' +
        'Part 77 surface dimensions instead.',
      length_ft: 'Full landing length in feet, threshold to threshold.',
      width_ft: 'Paved runway width in feet, edge to edge.',
      surface: 'Pavement composition. Drives PCN/ACN and friction-test scheduling.',
      true_heading: 'Magnetic heading of End 1, degrees true. Used to align taxiway intersections and lighting orientation.',
      end1_designator:
        'The lower-numbered runway end (e.g. "06L"). End 1 is conventionally the south/east end; End 2 is its reciprocal.',
      end1_latitude: 'Threshold latitude in decimal degrees. Survey-grade if available — 5+ decimals (~1m).',
      end1_longitude: 'Threshold longitude in decimal degrees.',
      end1_elevation_msl: 'Threshold elevation in feet MSL. Drives the localized portion of the obstruction surface.',
      end1_heading: 'Magnetic approach heading in degrees, e.g. "061" for runway 06.',
      end1_approach_lighting: 'Approach lighting category serving this end (ALSF-1, ALSF-2, MALSR, SSALR, REIL, etc.).',
      end2_designator: 'The reciprocal runway end (e.g. "24R" if End 1 is "06L").',
      end2_latitude: 'Reciprocal threshold latitude.',
      end2_longitude: 'Reciprocal threshold longitude.',
      end2_elevation_msl: 'Reciprocal threshold elevation in feet MSL.',
      end2_heading: 'Reciprocal approach heading.',
      end2_approach_lighting: 'Approach lighting category serving the reciprocal end.',
    },
  },

  areas: {
    what:
      'Defines the named airfield areas inspectors and AFM personnel reference when logging discrepancies, conducting daily ' +
      'airfield checks, performing inspections, or filing ACSI items. Areas appear in every "Where?" picker across the app — ' +
      'they are the controlled vocabulary for airfield location. "Entire Airfield" is auto-included; you add the specific runways, ' +
      'taxiways, ramps, and parking aprons your installation uses operationally.',
    how:
      'Add one row per discrete area. Names should match the operational vernacular used on the radio and in the AFM tower log ' +
      '(e.g. "RWY 06L/24R", "TWY A", "East Ramp", "Bravo Row"). Order is preserved on the inspector picker; drag to reorder.',
    why:
      'Without a complete, accurate area list, inspectors fall back to free-text location entries that cannot be filtered, trended, ' +
      'or reported on. Reports & Analytics aggregates discrepancies and inspection findings by area — incomplete areas means ' +
      'incomplete trend reporting and missed compliance signals.',
    required: 'yes',
    examples: ['Entire Airfield', 'RWY 06L/24R', 'TWY A', 'TWY B', 'East Ramp', 'West Ramp', 'Hot Cargo Pad'],
    cite: {
      reg: 'DAFMAN 13-204v2',
      para: '5.1. to 5.4.',
      outcome:
        'support discrepancy and inspection geolocation accuracy required for the daily airfield check, lighting check, ' +
        'construction checks, and monthly joint airfield inspection records',
    },
    fields: {
      area_name:
        'Short, unambiguous label inspectors will recognize on the radio. Avoid abbreviations not used operationally.',
    },
  },

  taxiways: {
    what:
      'Defines every taxiway designator at the installation. Taxiways are referenced by the obstruction evaluation tool to ' +
      'determine when obstructions do not meet fixed or mobile obstacle clearance requirements.',
    how:
      'Creating a taxiway centerline allows you to identify the centerline of existing taxiways to establish UFC clearance ' +
      'distances. Distances are measured off the centerline you create by dropping points and hitting save. You can also import ' +
      'KML/GeoJSON documents if you have taxiway centerlines depicted on maps from CES.',
    why:
      'Easily identify when an obstruction does not provide adequate wingtip clearance and streamline processing of airfield ' +
      'waivers or NOTAMs using the Obstruction Evaluation Tool.',
    required: 'yes',
    examples: ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Foxtrot'],
    cite: {
      reg: 'UFC 3-260-01',
      para: '5-5 and Table 5-1',
      outcome:
        'Ensures UFC 3-260-01, Table 5-1 Fixed-Wing Taxiway clearance requirements are met with the drop of a pen rather than ' +
        'using a measuring wheel or completing manual calculations.',
    },
    fields: {
      taxiway_id: 'Phonetic or numeric designator as published on the airfield diagram (e.g. "Alpha", "A1", "B2").',
    },
  },

  navaids: {
    what:
      'Defines the Visual NAVAIDs and approach aids displayed on the Airfield Status page as green / yellow / red toggles. Each ' +
      'NAVAID becomes a row on the status board. AMOPS personnel flip the status as conditions change; the system writes a ' +
      'status-change log entry to the events log automatically, and surfaces inoperative NAVAIDs in the Daily Operations rollup.',
    how:
      'Add one entry per addressable NAVAID — typically one per runway end for ILS and approach lighting, plus the field-level aids ' +
      '(TACAN, VOR, NDB) once each. Initial color is green. The Outage Engine flags configurations as automatic-discrepancy-on-red ' +
      'in the Lighting Systems step (separate from this step).',
    why:
      'NAVAID status is the single most-watched datum on the dashboard. AMOPS relies on this configuration to certify that the ' +
      'list of NAVAIDs displayed on the status board matches the actual NAVAIDs on the field. A missing NAVAID here means a ' +
      'silent gap in the airfield status board — the system cannot warn about something it does not know exists.',
    required: 'yes',
    examples: ['ILS RWY 06L', 'PAPI RWY 24R', 'TACAN', 'VOR', 'MALSR RWY 13', 'ALSF-1 RWY 31', 'REIL RWY 22'],
    cite: {
      reg: 'DAFMAN 13-204v2',
      para: '2.5.2.9.3.',
      outcome:
        'Quickly brief status of navigation aids to on-coming shift using real-time data that is updated instantly. Flying units ' +
        'and base leadership can quickly identify outages to NAVAIDs.',
    },
    fields: {
      navaid_name:
        'Short label as it should appear on the status board. Convention: "{type} RWY {end}" for runway-tied NAVAIDs ' +
        '(e.g. "PAPI RWY 24R"); type-only for field-level aids (e.g. "TACAN").',
      navaid_runway: 'Runway end this NAVAID serves, if applicable. Leave blank for field-level aids.',
      navaid_type: 'NAVAID category (ILS, TACAN, VOR, PAPI, MALSR, ALSF-1, ALSF-2, SSALR, REIL, VASI, NDB).',
    },
  },

  shops: {
    what:
      'Defines the CE shops that action discrepancies (Pavements, Electrical, HVAC, Structures, etc.) and maps each discrepancy ' +
      'type to the shop that owns it. The mapping drives automatic shop assignment when a new discrepancy is created — pick a type, ' +
      'and the discrepancy is routed to the right shop without an extra step. Unmapped types fall back to the AFM dispatcher.',
    how:
      'Step is two halves: top adds/removes shops; bottom shows every discrepancy type with a dropdown to pick its shop. Shops ' +
      'must exist before they can be mapped to a type. Deleting a shop also clears its mappings to avoid orphaned routing.',
    why:
      'Without the type-to-shop map, every discrepancy lands in a generic CES bucket and a human dispatcher has to triage it. ' +
      'With the map, the CES shop sees their work-orders queue auto-populated by type — saves hours per week and eliminates ' +
      'mis-routed discrepancies.',
    required: 'yes',
    examples: ['Pavements', 'Electrical', 'HVAC', 'Structures', 'Heavy Equipment', 'Sign Shop'],
    cite: {
      reg: 'DAFMAN 13-204v2',
      para: '2.3.2.7',
      outcome:
        'Streamline coordination with CE or work service providers to oversee the correction of airfield discrepancies ' +
        'instantaneously. No delay in when work centers are notified of pending work orders.',
    },
    fields: {
      shop_name: 'CES shop name as used in coordination (e.g. "Pavements", "Electrical Shop", "Sign Shop").',
      shop_email: 'Optional shop email. If set, discrepancies routed to this shop trigger email notifications.',
      type_mapping: 'Pick the shop responsible for this discrepancy type. Unmapped types fall through to AFM dispatcher.',
    },
  },

  arff: {
    what:
      'Defines the crash, fire, and rescue (ARFF) vehicles supported at the installation and the aircraft types they cover. Each ' +
      'aircraft type becomes a row on the Airfield Status page ARFF readiness panel where AMOPS identifies current ARFF ' +
      'capabilities per aircraft type. ARFF CAT is toggled if airfields use ARFF CAT to determine service capabilities.',
    how:
      'Add the aircraft types the installation supports (F-16, KC-135, C-17, etc.) — these populate the CAT-by-aircraft picker. ' +
      'Toggle "Show CAT dropdown" if AMOPS wants per-CAT readiness display in addition to per-aircraft status.',
    why:
      'AMOPS verifies ARFF readiness on every shift. Without the aircraft inventory configured here, the readiness panel cannot ' +
      'render and the Events Log cannot record ARFF status changes. The aircraft list drives the CAT drop and the per-aircraft ' +
      'readiness change log.',
    required: 'yes',
    examples: ['P-23', 'P-26', 'Crash 1', 'Crash 2', 'Brush 1'],
    cite: {
      reg: 'DAFMAN 13-204v2',
      para: '2.5.2.9. and 2.5.2.24.',
      outcome:
        'Provides immediate updates to current ARFF status to flying units and base leadership at a quick glance rather than ' +
        'multiple phone calls and product updates.',
    },
    fields: {
      show_cat_dropdown:
        'Enable to add a CAT (Aircraft Categorization) dropdown beside each ARFF vehicle on the status board. Use when the AFM ' +
        'tower publishes CAT-supported readiness in addition to per-vehicle status.',
      arff_aircraft:
        'Aircraft types this installation supports for crash/rescue. Drives the CAT picker and the per-aircraft readiness log. ' +
        'Common entries: A-10, F-16, F-15, F-22, F-35, KC-135, KC-46, C-17, C-130, H-60.',
      arff_vehicle: 'Vehicle callsign or unit number as used by tower and crash/rescue (e.g. "P-23", "Crash 1").',
    },
  },

  facilities: {
    what:
      'Defines the building numbers and named facilities referenced by discrepancies and inspections. Each facility becomes a ' +
      'pickable location whenever a record needs to attach to a building rather than to a runway, taxiway, or area. Examples: ' +
      'Tower, Fire Station, Base Ops, Hangar 1, Bldg 200.',
    how:
      'Add one row per facility. Use the official facility number as the primary identifier; description is for human recognition. ' +
      'Order is preserved on pickers, put the most-used facilities at the top.',
    why:
      'Without facilities defined, inspectors logging building-related discrepancies (interior lighting failures, pavement ' +
      'failures) fall back to free-text and the records cannot be filtered or trended by facility.',
    required: 'yes',
    examples: ['Tower (Bldg 100)', 'Fire Station (Bldg 200)', 'Base Ops (Bldg 250)', 'Hangar 1 (Bldg 300)'],
    cite: {
      reg: 'DAFMAN 13-204v2',
      para: '2.2.2.6.',
      outcome:
        'Connects work orders to specific facility numbers for streamlined work order review and tracking. Helps identify ' +
        'discrepancies associated with airfield facility numbers at the Facility Board or Facility Working Group.',
    },
    fields: {
      facility_number: 'Official facility / building number as published in the base directory.',
      facility_description: 'Plain-English name (e.g. "Tower", "Fire Station", "Hangar 1").',
    },
  },

  templates: {
    what:
      'Configures the checklist sections and items that drive the daily airfield inspection and lighting inspection. Each ' +
      'inspection in the app walks through the sections defined here, item by item, with pass/fail/discrepancy capture per item. ' +
      'Defaults can be cloned from the DAFMAN-derived base template; per-base customization is then layered on top to match local ' +
      'OI or supplement.',
    how:
      'Pick "Clone from default template" to seed the airfield and lighting inspection checklists with the DAFMAN-derived items. ' +
      'Edit sections and items inline; add base-specific items as needed. Items are grouped under sections (e.g. Pavement, ' +
      'Markings, Lighting, Wildlife, FOD, Signage). Reorder by drag-and-drop.',
    why:
      'Inspection templates are the single source of truth for what the inspector evaluates each day. A missing item means a ' +
      'compliance gap that will not surface on any inspection record; an extra item means the inspector spends time on items ' +
      'not relevant to this base. Tune the template to match the local OI and supplement.',
    required: 'yes',
    examples: [
      'Section: Pavement — Cracks > 1 inch, Spalling, FOD, Standing water',
      'Section: Markings — Centerline visibility, Threshold bars, Hold short lines',
      'Section: Lighting — Edge lights operational, Threshold lights, PAPI',
      'Section: Wildlife — Bird activity observed, Mammal sightings, Species present',
    ],
    cite: {
      reg: 'DAFMAN 13-204v2',
      para: '5.1. through 5.1.3.',
      outcome:
        'All required inspection items are listed to meet DAFMAN requirements. If an item needs inspected on your airfield, ' +
        'add it to this checklist and it will be required to be completed each inspection. If naming changes, the checklist ' +
        'can be easily edited within this module to ensure documentation stays current.',
    },
    fields: {
      template_section: 'Logical grouping (Pavement, Markings, Lighting, Wildlife, FOD, Signage, etc.).',
      template_item: 'Specific check item phrased as the inspector reads it. Be precise: "PAPI angle within tolerance" beats "PAPI OK".',
    },
  },

  shiftchecklist: {
    what:
      'Defines the per-shift task list for the AMOPS personnel on duty, grouped by the base’s configured shifts (1–3, ' +
      'renameable). Each task has a frequency ' +
      '(daily, weekly, or monthly) and one or more shifts it appears on. Items appear on the Shift Checklist page and on the ' +
      'Dashboard sidebar, with a 3-state toggle (not done, in progress, complete) and a daily reset (0600L default, per installation timezone).',
    how:
      'Set the shift count (1, 2, or 3) and optional custom shift names at the top of this step, then add one row per task. ' +
      'Pick the shift(s) it appears on, the frequency, and the canonical task name. Common pattern: shift-' +
      'specific tasks on the appropriate shift only; cross-shift tasks (FOD Check, Daily Airfield Check) marked on every shift. ' +
      'The item lists below render one section per active shift.',
    why:
      'AFM tracks shift accountability through this checklist. Daily Reviews uses the completion state to auto-fill the daily ' +
      'rollup, and the dashboard sidebar surfaces incomplete tasks at a glance. Without the checklist, AMOPS personnel rely on ' +
      'memory or ad-hoc tracking and accountability is uneven across shifts.',
    required: 'yes',
    examples: [
      'FOD Check (daily, all shifts)',
      'Daily Airfield Check (daily, day shift)',
      'NAVAID Status Verify (daily, all shifts)',
      'Lighting Check (weekly, swing shift)',
    ],
    cite: {
      reg: 'DAFMAN 13-204v2',
      para: 'All',
      outcome:
        'NAMO/AMOM/AFM dictates what tasks are required to be accomplished by each shift. This shift checklist provides a ' +
        'trackable way to determine who did what tasks and when they did them. Checklist must be 100% complete before it ' +
        'can be marked completed and filed for records disposition.',
    },
    fields: {
      task_name: 'Canonical task name as it appears on the checklist (e.g. "FOD Check", "NAVAID Status Verify").',
      task_frequency: 'How often the task recurs (daily, weekly, monthly).',
      task_shifts: 'Which of your configured shifts the task appears on. Multi-shift tasks are duplicated per shift on the page.',
    },
  },

  qrc: {
    what:
      'Configures the Quick Reaction Checklists used during emergency or contingency response (aircraft mishap, hung ordnance, ' +
      'fuel spill, severe weather, etc.). Each QRC is a sequence of step types — confirmations, notifications, navigations, ' +
      'sub-checklists, status updates — that the AFM works through with a clear audit trail of who acknowledged what and when.',
    how:
      'Seed from the default QRC library to get the 25 starter checklists, then customize per local OI. Add new QRCs from the ' +
      'QRC editor; each step picks from the 8 supported step types and configures its prompts and required fields. Activated ' +
      'QRCs persist their state until reset.',
    why:
      'QRCs codify the response sequence so the on-duty AFM never has to recall a long checklist from memory in an emergency. ' +
      'Without configured QRCs, response actions are improvised and the audit trail is incomplete — which becomes a problem at ' +
      'the after-action review or the ACSI inspection.',
    required: 'conditional',
    examples: ['Aircraft Mishap', 'Hung Ordnance', 'Fuel Spill', 'Severe Weather', 'Bird Strike Response'],
    cite: {
      reg: 'DAFMAN 13-204v2',
      para: '2.5.2.8.',
      outcome:
        'Enables AMOPS personnel to quickly open QRCs, execute them, and save them for records. Maintain annual reviews by the ' +
        'NAMO as well as monthly or quarterly reviews by AMOPS personnel.',
    },
    fields: {
      qrc_name: 'QRC name (e.g. "Aircraft Mishap", "Hung Ordnance"). Used as the activation button label.',
      qrc_step_type: 'Step type (confirmation, notification, navigation, sub-checklist, status update, etc.).',
    },
  },

  scnagencies: {
    what:
      'Lists the agencies checked daily on the Secondary Crash Net (SCN) — the daily communications check that confirms the ' +
      'emergency coordination network is up. Each agency becomes a toggleable badge on the daily SCN check page; AFM marks each ' +
      'agency as checked, and the system records who completed the check and when.',
    how:
      'Add one row per agency the SCN checks daily. Common entries: Tower, Fire Department, Ambulance, Security Forces, Hospital. ' +
      'Order is preserved on the SCN page badge row. The "Backup SCN" check is independent and tracked separately on the SCN page.',
    why:
      'Daily SCN check is a documented requirement; missing agencies here mean missing checkmarks on the daily log. AFM uses the ' +
      'SCN log to evidence that the emergency communication path is current, which is reviewed at every ACSI and during real ' +
      'mishap responses.',
    required: 'conditional',
    examples: ['Tower', 'Fire Department', 'Ambulance', 'Security Forces', 'Hospital', 'Command Post'],
    cite: {
      reg: 'DAFMAN 13-204v2',
      para: '4.2.2.3.7.',
      outcome:
        'A centralized location to maintain daily SCN checks, and each agency\'s status for receiving emergency notifications.',
    },
    fields: {
      agency_name: 'Agency as it should appear on the SCN check log (e.g. "Tower", "Fire Department", "Ambulance").',
    },
  },

  aepagencies: {
    what:
      'Lists the response agencies the Airport Emergency Plan coordinates with — ARFF, mutual-aid fire, EMS, police, hospital, ATC, ' +
      'FAA Regional Office, NTSB, FBI, public works, utilities. Each agency carries a role classification, primary and backup contact ' +
      'info (phone and radio frequency), and free-text notes. The roster drives the monthly comms-check picker and the drill-participants ' +
      'multi-select, and is exported in the AEP plan PDF for FAA inspector review.',
    how:
      'Add one row per agency the AEP touches. Group by role using the dropdown so the comms-check screen reads naturally. Primary contact ' +
      'should be the dispatcher or duty number you would actually call during an activation — not a general office line. Radio entries are ' +
      'frequency or channel (e.g. "VHF 154.220 / Ch. 3"). Mark an agency inactive instead of deleting when an agency relationship ends — ' +
      'this preserves the name on historical comms checks and drills.',
    why:
      'AC 150/5200-31C Appendix 1 expects the AEP to enumerate every responding agency with current points of contact. Missing or stale ' +
      'roster entries are the single most common AEP gap surfaced at the annual review. Keeping the roster authoritative here means the ' +
      'monthly comms check, drill scheduling, and the exported plan all share one source of truth.',
    required: 'conditional',
    examples: ['ARFF (Engine 7)', 'Mutual Aid — Springfield Fire Dept', 'County EMS', 'Mercy Hospital ED', 'Springfield Tower', 'FAA Regional Office'],
    cite: {
      reg: 'AC 150/5200-31C',
      para: 'App. 1',
      outcome:
        'A current, role-classified roster of response agencies with primary and backup contacts, ready for the monthly comms check and the annual plan review.',
    },
    fields: {
      agency_name: 'Agency as it should appear on the AEP roster and comms-check log (e.g. "ARFF (Engine 7)", "Springfield Tower").',
      agency_role: 'Functional category — drives grouping on the agencies page and on the AEP plan PDF roster table.',
      primary_contact_phone: 'Dispatch / duty number used during an actual activation. Avoid main-office lines that may not be staffed after hours.',
      primary_contact_radio: 'Radio frequency or channel ID for primary comms (e.g. "VHF 154.220 / Ch. 3").',
    },
  },

  wildlife: {
    what:
      'Selects the wildlife species commonly observed at the installation. Selected species populate the species picker in the ' +
      'wildlife sighting and strike forms — pre-filtering the 270+ species library to just the ones the AFM expects to encounter, ' +
      'so logging a sighting is a one-tap pick instead of a search. Per-species favorites can be flagged for even faster entry.',
    how:
      'Pick from the master species list; entries can be filtered by category (bird, mammal, reptile, bat). Common base patterns: ' +
      'pre-load the regional birds (waterfowl, raptors, songbirds), local mammals (deer, coyote, fox), and any species recently ' +
      'observed in BASH program data.',
    why:
      'Wildlife sighting and strike data drives the BASH heatmap, the wildlife trend report, and the annual wildlife mitigation ' +
      'review. A poorly curated species list slows down logging and pushes inspectors to "Other" entries that cannot be trended.',
    required: 'conditional',
    examples: ['Mallard', 'Canada Goose', 'Red-tailed Hawk', 'White-tailed Deer', 'Coyote', 'Eastern Cottontail'],
    cite: {
      reg: 'DAFMAN 91-212',
      para: '2.3. and 1.3.9.16.',
      outcome:
        'Provides a robust outlook of wildlife and strike hazards throughout the airfield. Creates a more realistic migration ' +
        'pattern for more thorough trend analysis that drives prevention of mishaps involving wildlife.',
    },
    fields: {
      species_category: 'Filter the species library by category (bird, mammal, reptile, bat) before picking.',
      species_name: 'Common name as published in the species library.',
      species_favorite: 'Mark a species as favorite to surface it at the top of the picker for one-tap entry.',
    },
  },

  lighting: {
    what:
      'Defines the lighting systems and components on the airfield, with the DAFMAN 13-204v2 Table A3.1 outage thresholds applied ' +
      'per system type. Each lighting system (e.g. RWY 06L Edge Lights, RWY 24R PAPI) is a parent record; its components are the ' +
      'individual fixtures that the Visual NAVAIDs map tracks for inop status. The Outage Engine reads this configuration to ' +
      'classify outages into 4 tiers (green / yellow / red / black) and detect bar-out conditions when 3 consecutive lights are ' +
      'inoperative on a runway edge or threshold bar.',
    how:
      'For each runway end, clone the DAFMAN A3.1 template that matches the runway class — this seeds Edge Lights, End Lights, ' +
      'Threshold Lights, PAPI, and approach lighting with the right thresholds in one click. Add custom systems for ramps, ' +
      'taxiway intersections, or specialty lighting. Components are linked from the Visual NAVAIDs page once the map is laid out.',
    why:
      'Without lighting systems configured, the Visual NAVAIDs page cannot run outage analysis and the dashboard outage tier ' +
      'pill stays grey. Bar-out detection — the most consequential automatic discrepancy generator on the system — depends on ' +
      'system membership and threshold values entered here.',
    required: 'optional',
    examples: [
      'RWY 06L Edge Lights (white, 200 ft spacing)',
      'RWY 06L PAPI (4-box, 8 lights)',
      'RWY 06L MALSR (sequenced flashers)',
      'TWY A Centerline (green, embedded)',
    ],
    cite: {
      reg: 'DAFMAN 13-204v2',
      para: 'Table A3.1',
      outcome:
        'Standardizes how airfield lighting outages are reported to CES, providing a visual representation of which lights are ' +
        'out and where. No more describing lights by using directions such as, "Third light from the West side of TWY A on the ' +
        'North side". Maintenance personnel can go directly to the light that is out of service and make the repair. Automated ' +
        'outage thresholds are calculated and instructions for required steps are provided when systems approach or exceed the ' +
        'A3.1 requirements.',
    },
    fields: {
      system_name: 'Lighting system name (e.g. "RWY 06L Edge Lights"). Used in the outage report and discrepancy auto-creation.',
      system_runway: 'Runway end this system serves. Determines the threshold bar grouping for bar-out detection.',
      system_type: 'Lighting system type (Edge, End, Threshold, PAPI, MALSR, ALSF-1, etc.). Drives DAFMAN threshold defaults.',
      component_count: 'Number of physical light fixtures in this system. Used as the denominator for the inop-percentage tier.',
    },
  },

  statusboards: {
    what:
      'Creates custom status panels on the Airfield Status page beyond the built-in Runways, NAVAIDs, and ARFF panels. Each board ' +
      'is a labeled grouping of items (e.g. "Arresting Systems: BAK-12, Engine Run Pad"; "Comm Status: Tower Radio, GCA, Ground"); ' +
      'each item has a green/yellow/red toggle that AFM flips as conditions change.',
    how:
      'Create a board, give it a label, then add items inside it. Each item is a row with a toggle and an optional note field. ' +
      'Boards appear in the order created on the Airfield Status page. Use for any per-base status that does not fit the built-in ' +
      'panels.',
    why:
      'AFM personnel manage many local-status indicators that DAFMAN does not prescribe — arresting systems, comm equipment, fuel ' +
      'truck availability, snow equipment readiness. Custom Status Boards let those indicators live alongside the standard ones ' +
      'on the dashboard, so the shift sign-off captures the full picture.',
    required: 'optional',
    examples: ['Arresting Systems', 'Comm Status', 'Snow Equipment', 'Fuel Trucks', 'Ground Equipment'],
    cite: null,
    fields: {
      board_label: 'Status board name as it appears as the section header on the dashboard (e.g. "Arresting Systems").',
      item_label: 'Item name within the board (e.g. "BAK-12 East", "Tower Radio").',
    },
  },

  pprcolumns: {
    what:
      'Defines the columns of the Prior Permission Required (PPR) log table. Each base has its own PPR field set — common columns ' +
      'are Aircraft Type, Tail #, Unit, POC, Purpose, ETA, ETD — but every installation can add or remove columns to match local ' +
      'reporting needs. Columns drive both the data-entry form and the PDF export.',
    how:
      'Add columns one row at a time, picking the column type (text, number, date, select, etc.). Order on the table follows the ' +
      'order entered here. Columns marked "info-only" appear on the public form but are not editable internally; columns marked ' +
      '"per-surface" can have different values for each runway/approach.',
    why:
      'PPR fields vary widely by installation — what one base needs (Hazmat declaration, slot time) another does not. Configuring ' +
      'columns here ensures the PPR log captures what the local AFM workflow actually needs and the PDF export shows the right ' +
      'columns to outside agencies.',
    required: 'optional',
    examples: ['Aircraft Type', 'Tail #', 'Unit', 'POC', 'Purpose', 'ETA Zulu', 'ETD Zulu', 'Slot Time'],
    cite: {
      reg: 'DAFMAN 13-204v2',
      para: '6.1.5.',
      outcome:
        'Streamlined coordination for PPRs, reducing phone calls and e-mails between agencies on base. Each coordination group ' +
        'can take action on a PPR they are required to, at any time they want without waiting on other agencies. Once all ' +
        'coordination is completed it is sent back to AMOPS for approval/denial. Once action is taken by AMOPS, requestors are ' +
        'automatically notified with their PPR number.',
    },
    fields: {
      column_label: 'Column header as it appears on the PPR table.',
      column_type: 'Data type (text, number, date, select, boolean). Drives the input control and validation.',
      column_visibility: 'Whether the column is editable internally, info-only on the public form, or per-surface.',
    },
  },

  feedback: {
    what:
      'Configures the public feedback form and generates a QR code for posting at base ops or transient parking. Anyone who scans ' +
      'the code can submit feedback (compliments, concerns, suggestions) which lands in the Feedback module for AFM triage. The ' +
      'public form requires no login.',
    how:
      'Set the form headline and intro copy. Generate the QR code and download as PNG for printing. The QR code points to a ' +
      'base-scoped URL that anyone can submit through; per-installation feedback is isolated to that base.',
    why:
      'Customer feedback is a useful operational signal — transient aircrew, contractors, and other airfield users notice things ' +
      'AFM personnel see every day and stop flagging. A QR-scannable form lowers the barrier so feedback actually arrives.',
    required: 'optional',
    examples: ['"How can we improve transient parking?"', '"Tell us about your visit to base ops."', '"Report a safety concern."'],
    cite: {
      reg: 'DAFMAN 13-204v2',
      para: '2.5.2.13.',
      outcome:
        'Eliminates the barrier for customers to provide feedback to AMOPS services. Users can submit feedback immediately and ' +
        'it is sent to the NAMO and AFM for review. Responses are maintained and are used in reports and analytics to create a ' +
        'better overall experience for users of the airfield.',
    },
    fields: {
      form_headline: 'Top-of-form headline visible to submitters.',
      form_intro: 'One-paragraph intro explaining what feedback you are looking for and how it will be used.',
    },
  },
}

export function getStepGuide(step: WizardStepKey): StepGuide | null {
  return BASE_SETUP_GUIDE[step] ?? null
}

export function getFieldHint(step: WizardStepKey, fieldId: string): string | null {
  return BASE_SETUP_GUIDE[step]?.fields?.[fieldId] ?? null
}

export function formatComplianceStatement(cite: GuideCite | null): string {
  if (!cite) return 'Administrative or operationally-specific setup; no DAFMAN compliance citation applies.'
  return `IAW ${cite.reg} §${cite.para}, configuring this step satisfies the requirement to ${cite.outcome}.`
}
