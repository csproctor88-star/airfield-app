export type FieldType = 'text' | 'textarea' | 'toggle-list'

export type TemplateField = {
  key: string
  label: string
  default?: string
  type?: FieldType // defaults to 'text'
  options?: string[] // for toggle-list
}

export type ActivityTemplate = {
  label: string
  text: string
  fields: TemplateField[]
}

export type TemplateCategory = {
  category: string
  templates: ActivityTemplate[]
}

// Shared field helpers
const afld3: TemplateField = { key: 'callsign', label: 'Callsign', default: 'AFLD3/' }
const twrCs: TemplateField = { key: 'callsign', label: 'Callsign', default: 'TWR/' }

export const ACTIVITY_TEMPLATES: TemplateCategory[] = [
  // ─── INSPECTIONS/CHECKS ───
  {
    category: 'Inspections/Checks',
    templates: [
      {
        label: 'On Airfield for Inspection',
        text: '{callsign} on airfield for airfield inspection',
        fields: [afld3],
      },
      {
        label: 'Advises RSC & BWC',
        text: '{callsign} advises RSC/{rsc} and BWC/{bwc}',
        fields: [afld3, { key: 'rsc', label: 'RSC Condition', default: 'DRY' }, { key: 'bwc', label: 'BWC Level', default: 'LOW' }],
      },
      {
        label: 'Off Airfield - Inspection Complete',
        text: '{callsign} off airfield. Airfield inspection complete; {discrepancies}',
        fields: [afld3, { key: 'discrepancies', label: 'Discrepancies', default: 'no new discrepancies' }],
      },
      {
        label: 'On Airfield for Check',
        text: '{callsign} on airfield for {check_types} check',
        fields: [
          afld3,
          { key: 'check_types', label: 'Check Types', type: 'toggle-list', options: ['FOD', 'BASH', 'CONSTRUCTION', 'RSC/RCR', 'HEAVY ACFT'] },
        ],
      },
      {
        label: 'Off Airfield - Check Complete',
        text: '{callsign} off airfield. {check_types} check complete; {discrepancies}',
        fields: [
          afld3,
          { key: 'check_types', label: 'Check Types', type: 'toggle-list', options: ['FOD', 'BASH', 'CONSTRUCTION', 'RSC/RCR', 'HEAVY ACFT'] },
          { key: 'discrepancies', label: 'Discrepancies', default: 'no new discrepancies' },
        ],
      },
      {
        label: 'On Airfield for Lighting Check',
        text: '{callsign} on airfield for lighting check',
        fields: [afld3],
      },
      {
        label: 'Off Airfield - Lighting Check Complete',
        text: '{callsign} off airfield. Airfield lighting check complete; {discrepancies}',
        fields: [afld3, { key: 'discrepancies', label: 'Discrepancies', default: 'no new discrepancies' }],
      },
    ],
  },

  // ─── AMOPS REPORTING ───
  {
    category: 'AMOPS Reporting',
    templates: [
      {
        label: 'Area Closed',
        text: '{callsign} advises {area} closed',
        fields: [afld3, { key: 'area', label: 'Area (e.g. RWY 18/36 / TWY A / EAST RAMP)' }],
      },
      {
        label: 'Area Suspended',
        text: '{callsign} advises {area} suspended',
        fields: [afld3, { key: 'area', label: 'Area (e.g. RWY 18/36 / TWY A / EAST RAMP)' }],
      },
      {
        label: 'Area Ops Resumed',
        text: '{callsign} advises {area} ops resumed',
        fields: [afld3, { key: 'area', label: 'Area (e.g. RWY 18/36 / TWY A / EAST RAMP)' }],
      },
      {
        label: 'Area RCR Report',
        text: '{callsign} advises {area} RCR/{rcr}',
        fields: [afld3, { key: 'area', label: 'Area (e.g. RWY 18/36 / TWY A)' }, { key: 'rcr', label: 'RCR Value' }],
      },
      {
        label: 'Advises RSC & BWC',
        text: '{callsign} advises RSC/{rsc} and BWC/{bwc}',
        fields: [afld3, { key: 'rsc', label: 'RSC Condition' }, { key: 'bwc', label: 'BWC Level' }],
      },
      {
        label: 'Advises RSC, BWC & RCR',
        text: '{callsign} advises RSC/{rsc}, BWC/{bwc}, and RCR/{rcr}',
        fields: [afld3, { key: 'rsc', label: 'RSC Condition' }, { key: 'bwc', label: 'BWC Level' }, { key: 'rcr', label: 'RCR Value' }],
      },
    ],
  },

  // ─── TOWER REPORTING ───
  {
    category: 'Tower Reporting',
    templates: [
      {
        label: 'Tower Open',
        text: '{callsign} advises tower is now open; RWY {runway} in use',
        fields: [twrCs, { key: 'runway', label: 'Runway' }],
      },
      {
        label: 'Runway In Use',
        text: '{callsign} advises RWY {runway} in use',
        fields: [twrCs, { key: 'runway', label: 'Runway' }],
      },
      {
        label: 'Area Closed',
        text: '{callsign} advises {area} closed',
        fields: [twrCs, { key: 'area', label: 'Area (e.g. RWY 18/36 / TWY A)' }],
      },
      {
        label: 'Area Suspended',
        text: '{callsign} advises {area} suspended',
        fields: [twrCs, { key: 'area', label: 'Area (e.g. RWY 18/36 / TWY A)' }],
      },
    ],
  },

  // ─── SHIFT CHANGES ───
  {
    category: 'Shift Changes',
    templates: [
      {
        label: 'AMOPS Open',
        text: 'AMOPS open. {amsl} as AMSL and {amoc} as AMOC on duty',
        fields: [
          { key: 'amsl', label: 'AMSL (e.g. A. Smith/01)' },
          { key: 'amoc', label: 'AMOC (e.g. B. Jones/02)' },
        ],
      },
      {
        label: 'Shift Change',
        text: 'Shift change. {amsl_on} as AMSL and {amoc_on} as AMOC on duty. Shift briefing completed. {off_duty} off duty',
        fields: [
          { key: 'amsl_on', label: 'Incoming AMSL' },
          { key: 'amoc_on', label: 'Incoming AMOC' },
          { key: 'off_duty', label: 'Off Duty Personnel' },
        ],
      },
      {
        label: 'AMOPS Closed',
        text: 'AMOPS closed. {off_duty} off duty',
        fields: [{ key: 'off_duty', label: 'Off Duty Personnel' }],
      },
    ],
  },

  // ─── DAILY TASKS ───
  {
    category: 'Daily Tasks',
    templates: [
      {
        label: 'AISR Guard Removed',
        text: 'AISR guard removed',
        fields: [],
      },
      {
        label: 'AISR Guard Transferred',
        text: 'AISR guard transferred to {facility}',
        fields: [{ key: 'facility', label: 'Facility', default: 'FFO' }],
      },
      {
        label: 'NOTAMs Verified',
        text: 'NOTAMs verified; {discrepancies}',
        fields: [{ key: 'discrepancies', label: 'Discrepancies', default: 'no discrepancies' }],
      },
    ],
  },

  // ─── QRC ───
  {
    category: 'QRC',
    templates: [
      {
        label: 'QRC Initiated',
        text: 'QRC #{number} initiated',
        fields: [{ key: 'number', label: 'QRC Number' }],
      },
      {
        label: 'QRC Continued',
        text: 'QRC #{number} continued',
        fields: [{ key: 'number', label: 'QRC Number' }],
      },
      {
        label: 'QRC Completed',
        text: 'QRC #{number} completed',
        fields: [{ key: 'number', label: 'QRC Number' }],
      },
      {
        label: 'QRC Updated',
        text: 'QRC #{number} updated',
        fields: [{ key: 'number', label: 'QRC Number' }],
      },
    ],
  },

  // ─── PCAS/SCN TESTS & ACTIVATIONS ───
  {
    category: 'PCAS/SCN Tests & Activations',
    templates: [
      {
        label: 'PCAS Tested',
        text: 'PCAS tested loud and clear by {callsign}',
        fields: [twrCs],
      },
      {
        label: 'SCN Check Complete - All L&C',
        text: 'SCN check complete. All agencies loud and clear',
        fields: [],
      },
      {
        label: 'SCN Check Complete - Exceptions',
        text: 'SCN check complete. All agencies loud and clear besides stations {stations} who were out of office',
        fields: [{ key: 'stations', label: 'Stations Not Reached' }],
      },
      {
        label: 'Monthly Backup SCN - All L&C',
        text: 'Monthly backup SCN check complete by {callsign}. All agencies loud and clear',
        fields: [{ key: 'callsign', label: 'Callsign', default: 'CP/' }],
      },
      {
        label: 'Monthly Backup SCN - Exceptions',
        text: 'Monthly backup SCN check complete by {callsign}. All agencies loud and clear besides stations {stations}, who were out of office',
        fields: [{ key: 'callsign', label: 'Callsign', default: 'CP/' }, { key: 'stations', label: 'Stations Not Reached' }],
      },
      {
        label: 'PCAS Activated',
        text: 'PCAS activated by {callsign} for {reason}',
        fields: [twrCs, { key: 'reason', label: 'Reason for Activation' }],
      },
      {
        label: 'SCN Activated',
        text: 'SCN activated by {activator} for {reason}',
        fields: [{ key: 'activator', label: 'Activated By' }, { key: 'reason', label: 'Reason for Activation' }],
      },
    ],
  },

  // ─── PERSONNEL ON AIRFIELD ───
  {
    category: 'Personnel on Airfield',
    templates: [
      {
        label: 'Personnel On Airfield',
        text: '{name} on airfield for {reason}',
        fields: [{ key: 'name', label: 'Company/Callsign' }, { key: 'reason', label: 'Reason on Airfield' }],
      },
      {
        label: 'Personnel Off Airfield',
        text: '{name} off airfield',
        fields: [{ key: 'name', label: 'Company/Callsign' }],
      },
      {
        label: 'Personnel On Airfield - LMR Issued',
        text: '{name} on airfield, LMR #{lmr} issued',
        fields: [{ key: 'name', label: 'Company/Callsign' }, { key: 'lmr', label: 'LMR Number' }],
      },
      {
        label: 'Personnel Off Airfield - LMR Returned',
        text: '{name} off airfield, LMR #{lmr} returned',
        fields: [{ key: 'name', label: 'Company/Callsign' }, { key: 'lmr', label: 'LMR Number' }],
      },
    ],
  },

  // ─── NOTAMS ───
  {
    category: 'NOTAMs',
    templates: [
      {
        label: 'NOTAM Issued',
        text: 'NOTAM issued: {notam_id} - {description}. {effective_dates}. QRC #{qrc} complete',
        fields: [
          { key: 'notam_id', label: 'NOTAM ID (e.g. M0414/24)' },
          { key: 'description', label: 'Description' },
          { key: 'effective_dates', label: 'Effective Dates' },
          { key: 'qrc', label: 'QRC Number' },
        ],
      },
      {
        label: 'NOTAM Extended',
        text: 'NOTAM extended: {notam_id} NOTAMR {replaces_id} - {description}. {effective_dates}. QRC #{qrc} complete',
        fields: [
          { key: 'notam_id', label: 'New NOTAM ID' },
          { key: 'replaces_id', label: 'Replaces NOTAM ID' },
          { key: 'description', label: 'Description' },
          { key: 'effective_dates', label: 'Effective Dates' },
          { key: 'qrc', label: 'QRC Number' },
        ],
      },
      {
        label: 'NOTAM Replaced',
        text: 'NOTAM replaced: {notam_id} NOTAMR {replaces_id} - {description}. {effective_dates}. QRC #{qrc} complete',
        fields: [
          { key: 'notam_id', label: 'New NOTAM ID' },
          { key: 'replaces_id', label: 'Replaces NOTAM ID' },
          { key: 'description', label: 'Description' },
          { key: 'effective_dates', label: 'Effective Dates' },
          { key: 'qrc', label: 'QRC Number' },
        ],
      },
      {
        label: 'NOTAM Canceled',
        text: 'NOTAM canceled: {notam_id} NOTAMC {cancels_id} - {description}. {effective_dates}. QRC #{qrc} complete',
        fields: [
          { key: 'notam_id', label: 'New NOTAM ID' },
          { key: 'cancels_id', label: 'Cancels NOTAM ID' },
          { key: 'description', label: 'Description' },
          { key: 'effective_dates', label: 'Effective Dates' },
          { key: 'qrc', label: 'QRC Number' },
        ],
      },
    ],
  },

  // ─── ARFF ───
  {
    category: 'ARFF',
    templates: [
      {
        label: 'ARFF Daily Status - No Changes',
        text: 'ARFF daily status report reviewed, no changes',
        fields: [],
      },
      {
        label: 'ARFF Status Reduced',
        text: '{callsign} reports ARFF status is reduced. QRC #{qrc} initiated',
        fields: [{ key: 'callsign', label: 'Callsign', default: 'FD/' }, { key: 'qrc', label: 'QRC Number' }],
      },
      {
        label: 'ARFF Daily Status Reported',
        text: 'ARFF daily status reported by {callsign}, no changes',
        fields: [{ key: 'callsign', label: 'Callsign', default: 'FD/' }],
      },
    ],
  },

  // ─── IFE/GE ───
  {
    category: 'IFE/GE',
    templates: [
      {
        label: 'PCAS Activated',
        text: 'PCAS activated by {callsign} for {reason}',
        fields: [twrCs, { key: 'reason', label: 'Reason for Activation' }],
      },
      {
        label: 'Chief Reports',
        text: '{callsign} reports {details}',
        fields: [{ key: 'callsign', label: 'Callsign', default: 'CHIEF2/' }, { key: 'details', label: 'Details' }],
      },
      {
        label: 'Runway Operations Suspended',
        text: '{callsign} reports runway operations suspended',
        fields: [twrCs],
      },
      {
        label: 'Runway Operations Resumed',
        text: '{callsign} reports runway operations resumed',
        fields: [afld3],
      },
      {
        label: 'Area Closed',
        text: '{callsign} reports {area} closed',
        fields: [afld3, { key: 'area', label: 'Area (e.g. RWY/TAXIWAY/RAMP)' }],
      },
      {
        label: 'On Airfield for Emergency Check',
        text: '{callsign} on airfield for emergency check',
        fields: [afld3],
      },
    ],
  },

  // ─── CMA VIOLATIONS ───
  {
    category: 'CMA Violations',
    templates: [
      {
        label: 'Unauthorized Vehicle Report',
        text: '{callsign} reports unauthorized vehicle {details}',
        fields: [twrCs, { key: 'details', label: 'Details' }],
      },
      {
        label: 'On Airfield for CMAV',
        text: '{callsign} on airfield for CMAV',
        fields: [afld3],
      },
    ],
  },

  // ─── BWC DECLARATIONS ───
  {
    category: 'BWC Declarations',
    templates: [
      {
        label: 'BWC Change',
        text: '{callsign} reports BWC change, BWC/{bwc}. QRC #{qrc} initiated',
        fields: [afld3, { key: 'bwc', label: 'BWC Level (e.g. MODERATE)' }, { key: 'qrc', label: 'QRC Number' }],
      },
    ],
  },

  // ─── MISCELLANEOUS ───
  {
    category: 'Miscellaneous',
    templates: [
      {
        label: 'Out of Office',
        text: '{callsign} out of office to {reason}',
        fields: [afld3, { key: 'reason', label: 'Reason' }],
      },
      {
        label: 'Back in Office',
        text: '{callsign} back in office. {result}',
        fields: [afld3, { key: 'result', label: 'Result (e.g. Imaginary surfaces inspected; no discrepancies)' }],
      },
      {
        label: 'General Report',
        text: '{callsign} {details}',
        fields: [afld3, { key: 'details', label: 'Details', type: 'textarea' }],
      },
    ],
  },
]
