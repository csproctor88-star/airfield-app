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
const initials: TemplateField = { key: 'initials', label: 'Initials' }
const afld3: TemplateField = { key: 'callsign', label: 'Callsign', default: 'AFLD3/' }
const twrCs: TemplateField = { key: 'callsign', label: 'Callsign', default: 'TWR/' }

export const ACTIVITY_TEMPLATES: TemplateCategory[] = [
  // ─── INSPECTIONS/CHECKS ───
  {
    category: 'Inspections/Checks',
    templates: [
      {
        label: 'On Airfield for Inspection',
        text: '{callsign} ON AFLD FOR AFLD INSPECTION...{initials}',
        fields: [afld3, initials],
      },
      {
        label: 'Advises RSC & BWC',
        text: '{callsign} ADVISES RSC/{rsc} & BWC/{bwc}...{initials}',
        fields: [afld3, { key: 'rsc', label: 'RSC Condition', default: 'DRY' }, { key: 'bwc', label: 'BWC Level', default: 'LOW' }, initials],
      },
      {
        label: 'Off Airfield - Inspection Complete',
        text: '{callsign} OFF AFLD. AFLD INSPECTION CMPLT; {discrepancies}...{initials}',
        fields: [afld3, { key: 'discrepancies', label: 'Discrepancies', default: 'NO NEW DISCREPANCIES' }, initials],
      },
      {
        label: 'On Airfield for Check',
        text: '{callsign} ON AFLD FOR {check_types} CHECK...{initials}',
        fields: [
          afld3,
          { key: 'check_types', label: 'Check Types', type: 'toggle-list', options: ['FOD', 'BASH', 'CONSTRUCTION', 'RSC/RCR', 'HEAVY ACFT'] },
          initials,
        ],
      },
      {
        label: 'Off Airfield - Check Complete',
        text: '{callsign} OFF AFLD. {check_types} CHECK CMPLT; {discrepancies}...{initials}',
        fields: [
          afld3,
          { key: 'check_types', label: 'Check Types', type: 'toggle-list', options: ['FOD', 'BASH', 'CONSTRUCTION', 'RSC/RCR', 'HEAVY ACFT'] },
          { key: 'discrepancies', label: 'Discrepancies', default: 'NO NEW DISCREPANCIES' },
          initials,
        ],
      },
      {
        label: 'On Airfield for Lighting Check',
        text: '{callsign} ON AFLD FOR LIGHTING CHECK...{initials}',
        fields: [afld3, initials],
      },
      {
        label: 'Off Airfield - Lighting Check Complete',
        text: '{callsign} OFF AFLD. AFLD LIGHTING CHECK CMPLT; {discrepancies}...{initials}',
        fields: [afld3, { key: 'discrepancies', label: 'Discrepancies', default: 'NO NEW DISCREPANCIES' }, initials],
      },
    ],
  },

  // ─── AMOPS REPORTING ───
  {
    category: 'AMOPS Reporting',
    templates: [
      {
        label: 'Area Closed',
        text: '{callsign} ADVISES {area} CLOSED...{initials}',
        fields: [afld3, { key: 'area', label: 'Area (e.g. RWY 18/36 / TWY A / EAST RAMP)' }, initials],
      },
      {
        label: 'Area Suspended',
        text: '{callsign} ADVISES {area} SUSPENDED...{initials}',
        fields: [afld3, { key: 'area', label: 'Area (e.g. RWY 18/36 / TWY A / EAST RAMP)' }, initials],
      },
      {
        label: 'Area Ops Resumed',
        text: '{callsign} ADVISES {area} OPS RESUMED...{initials}',
        fields: [afld3, { key: 'area', label: 'Area (e.g. RWY 18/36 / TWY A / EAST RAMP)' }, initials],
      },
      {
        label: 'Area RCR Report',
        text: '{callsign} ADVISES {area} RCR/{rcr}...{initials}',
        fields: [afld3, { key: 'area', label: 'Area (e.g. RWY 18/36 / TWY A)' }, { key: 'rcr', label: 'RCR Value' }, initials],
      },
      {
        label: 'Advises RSC & BWC',
        text: '{callsign} ADVISES RSC/{rsc} & BWC/{bwc}...{initials}',
        fields: [afld3, { key: 'rsc', label: 'RSC Condition' }, { key: 'bwc', label: 'BWC Level' }, initials],
      },
      {
        label: 'Advises RSC, BWC & RCR',
        text: '{callsign} ADVISES RSC/{rsc}, BWC/{bwc}, & RCR/{rcr}...{initials}',
        fields: [afld3, { key: 'rsc', label: 'RSC Condition' }, { key: 'bwc', label: 'BWC Level' }, { key: 'rcr', label: 'RCR Value' }, initials],
      },
    ],
  },

  // ─── TOWER REPORTING ───
  {
    category: 'Tower Reporting',
    templates: [
      {
        label: 'Tower Open',
        text: '{callsign} ADVISES SELFRIDGE TWR IS NOW OPEN; RWY {runway} IN USE...{initials}',
        fields: [twrCs, { key: 'runway', label: 'Runway' }, initials],
      },
      {
        label: 'Runway In Use',
        text: '{callsign} ADVISES RWY {runway} IN USE...{initials}',
        fields: [twrCs, { key: 'runway', label: 'Runway' }, initials],
      },
      {
        label: 'Area Closed',
        text: '{callsign} ADVISES {area} CLOSED...{initials}',
        fields: [twrCs, { key: 'area', label: 'Area (e.g. RWY 18/36 / TWY A)' }, initials],
      },
      {
        label: 'Area Suspended',
        text: '{callsign} ADVISES {area} SUSPENDED...{initials}',
        fields: [twrCs, { key: 'area', label: 'Area (e.g. RWY 18/36 / TWY A)' }, initials],
      },
    ],
  },

  // ─── SHIFT CHANGES ───
  {
    category: 'Shift Changes',
    templates: [
      {
        label: 'AMOPS Open',
        text: 'AMOPS OPEN. {amsl} AS AMSL AND {amoc} AS AMOC ON DUTY...{initials}',
        fields: [
          { key: 'amsl', label: 'AMSL (e.g. A. Smith/01)' },
          { key: 'amoc', label: 'AMOC (e.g. B. Jones/02)' },
          initials,
        ],
      },
      {
        label: 'Shift Change',
        text: 'SHIFT CHANGE. {amsl_on} AS AMSL AND {amoc_on} AS AMOC ON DUTY. SHIFT BRIEFING COMPLETED. {off_duty} OFF DUTY...{initials}',
        fields: [
          { key: 'amsl_on', label: 'Incoming AMSL' },
          { key: 'amoc_on', label: 'Incoming AMOC' },
          { key: 'off_duty', label: 'Off Duty Personnel' },
          initials,
        ],
      },
      {
        label: 'AMOPS Closed',
        text: 'AMOPS CLSD. {off_duty} OFF DUTY...{initials}',
        fields: [{ key: 'off_duty', label: 'Off Duty Personnel' }, initials],
      },
    ],
  },

  // ─── DAILY TASKS ───
  {
    category: 'Daily Tasks',
    templates: [
      {
        label: 'AISR Guard Removed',
        text: 'AISR GUARD REMOVED...{initials}',
        fields: [initials],
      },
      {
        label: 'AISR Guard Transferred',
        text: 'AISR GUARD TRANSFERRED TO {facility}...{initials}',
        fields: [{ key: 'facility', label: 'Facility', default: 'FFO' }, initials],
      },
      {
        label: 'NOTAMs Verified',
        text: 'NOTAMS VERIFIED; {discrepancies}...{initials}',
        fields: [{ key: 'discrepancies', label: 'Discrepancies', default: 'NO DISCREPANCIES' }, initials],
      },
    ],
  },

  // ─── QRC ───
  {
    category: 'QRC',
    templates: [
      {
        label: 'QRC Initiated',
        text: 'QRC #{number} INITIATED...{initials}',
        fields: [{ key: 'number', label: 'QRC Number' }, initials],
      },
      {
        label: 'QRC Continued',
        text: 'QRC #{number} CONTINUED...{initials}',
        fields: [{ key: 'number', label: 'QRC Number' }, initials],
      },
      {
        label: 'QRC Completed',
        text: 'QRC #{number} COMPLETED...{initials}',
        fields: [{ key: 'number', label: 'QRC Number' }, initials],
      },
      {
        label: 'QRC Updated',
        text: 'QRC #{number} UPDATED...{initials}',
        fields: [{ key: 'number', label: 'QRC Number' }, initials],
      },
    ],
  },

  // ─── PCAS/SCN TESTS & ACTIVATIONS ───
  {
    category: 'PCAS/SCN Tests & Activations',
    templates: [
      {
        label: 'PCAS Tested',
        text: 'PCAS TESTED L&C BY {callsign}...{initials}',
        fields: [twrCs, initials],
      },
      {
        label: 'SCN Check Complete - All L&C',
        text: 'SCN CK COMPLT. ALL AGENCIES L&C...{initials}',
        fields: [initials],
      },
      {
        label: 'SCN Check Complete - Exceptions',
        text: 'SCN CK COMPLT. ALL AGENCIES L&C BESIDES STATIONS {stations} WHO WERE OUT OF OFFICE...{initials}',
        fields: [{ key: 'stations', label: 'Stations Not Reached' }, initials],
      },
      {
        label: 'Monthly Backup SCN - All L&C',
        text: 'MONTHLY BACKUP SCN CK CMPLT BY {callsign}. ALL AGENCIES L&C...{initials}',
        fields: [{ key: 'callsign', label: 'Callsign', default: 'CP/' }, initials],
      },
      {
        label: 'Monthly Backup SCN - Exceptions',
        text: 'MONTHLY BACKUP SCN CK CMPLT BY {callsign}. ALL AGENCIES L&C BESIDES STATIONS {stations}, WHO WERE OUT OF OFFICE...{initials}',
        fields: [{ key: 'callsign', label: 'Callsign', default: 'CP/' }, { key: 'stations', label: 'Stations Not Reached' }, initials],
      },
      {
        label: 'PCAS Activated',
        text: 'PCAS ACTIVATED BY {callsign} FOR {reason}...{initials}',
        fields: [twrCs, { key: 'reason', label: 'Reason for Activation' }, initials],
      },
      {
        label: 'SCN Activated',
        text: 'SCN ACTIVATED BY {activator} FOR {reason}...{initials}',
        fields: [{ key: 'activator', label: 'Activated By' }, { key: 'reason', label: 'Reason for Activation' }, initials],
      },
    ],
  },

  // ─── PERSONNEL ON AIRFIELD ───
  {
    category: 'Personnel on Airfield',
    templates: [
      {
        label: 'Personnel On Airfield',
        text: '{name} ON AIRFIELD FOR {reason}...{initials}',
        fields: [{ key: 'name', label: 'Company/Callsign' }, { key: 'reason', label: 'Reason on Airfield' }, initials],
      },
      {
        label: 'Personnel Off Airfield',
        text: '{name} OFF AIRFIELD...{initials}',
        fields: [{ key: 'name', label: 'Company/Callsign' }, initials],
      },
      {
        label: 'Personnel On Airfield - LMR Issued',
        text: '{name} ON AFLD, LMR #{lmr} ISSUED...{initials}',
        fields: [{ key: 'name', label: 'Company/Callsign' }, { key: 'lmr', label: 'LMR Number' }, initials],
      },
      {
        label: 'Personnel Off Airfield - LMR Returned',
        text: '{name} OFF AFLD, LMR #{lmr} RETURNED...{initials}',
        fields: [{ key: 'name', label: 'Company/Callsign' }, { key: 'lmr', label: 'LMR Number' }, initials],
      },
    ],
  },

  // ─── NOTAMS ───
  {
    category: 'NOTAMs',
    templates: [
      {
        label: 'NOTAM Issued',
        text: 'NOTAM ISSUED: {notam_id} - {description}. {effective_dates}. QRC #{qrc} CMPLT...{initials}',
        fields: [
          { key: 'notam_id', label: 'NOTAM ID (e.g. M0414/24)' },
          { key: 'description', label: 'Description' },
          { key: 'effective_dates', label: 'Effective Dates' },
          { key: 'qrc', label: 'QRC Number' },
          initials,
        ],
      },
      {
        label: 'NOTAM Extended',
        text: 'NOTAM EXTENDED: {notam_id} NOTAMR {replaces_id} - {description}. {effective_dates}. QRC #{qrc} CMPLT...{initials}',
        fields: [
          { key: 'notam_id', label: 'New NOTAM ID' },
          { key: 'replaces_id', label: 'Replaces NOTAM ID' },
          { key: 'description', label: 'Description' },
          { key: 'effective_dates', label: 'Effective Dates' },
          { key: 'qrc', label: 'QRC Number' },
          initials,
        ],
      },
      {
        label: 'NOTAM Replaced',
        text: 'NOTAM REPLACED: {notam_id} NOTAMR {replaces_id} - {description}. {effective_dates}. QRC #{qrc} CMPLT...{initials}',
        fields: [
          { key: 'notam_id', label: 'New NOTAM ID' },
          { key: 'replaces_id', label: 'Replaces NOTAM ID' },
          { key: 'description', label: 'Description' },
          { key: 'effective_dates', label: 'Effective Dates' },
          { key: 'qrc', label: 'QRC Number' },
          initials,
        ],
      },
      {
        label: 'NOTAM Canceled',
        text: 'NOTAM CANCELED: {notam_id} NOTAMC {cancels_id} - {description}. {effective_dates}. QRC #{qrc} CMPLT...{initials}',
        fields: [
          { key: 'notam_id', label: 'New NOTAM ID' },
          { key: 'cancels_id', label: 'Cancels NOTAM ID' },
          { key: 'description', label: 'Description' },
          { key: 'effective_dates', label: 'Effective Dates' },
          { key: 'qrc', label: 'QRC Number' },
          initials,
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
        text: 'ARFF DAILY STATUS REPORT REVIEWED, NO CHANGES...{initials}',
        fields: [initials],
      },
      {
        label: 'ARFF Status Reduced',
        text: '{callsign} REPORTS ARFF STATUS IS REDUCED. QRC #{qrc} INITIATED...{initials}',
        fields: [{ key: 'callsign', label: 'Callsign', default: 'FD/' }, { key: 'qrc', label: 'QRC Number' }, initials],
      },
      {
        label: 'ARFF Daily Status Reported',
        text: 'ARFF DAILY STATUS REPORTED BY {callsign} NO CHANGES...{initials}',
        fields: [{ key: 'callsign', label: 'Callsign', default: 'FD/' }, initials],
      },
    ],
  },

  // ─── IFE/GE ───
  {
    category: 'IFE/GE',
    templates: [
      {
        label: 'PCAS Activated',
        text: 'PCAS ACTIVATED BY {callsign} FOR {reason}...{initials}',
        fields: [twrCs, { key: 'reason', label: 'Reason for Activation' }, initials],
      },
      {
        label: 'Chief Reports',
        text: '{callsign} REPORTS {details}...{initials}',
        fields: [{ key: 'callsign', label: 'Callsign', default: 'CHIEF2/' }, { key: 'details', label: 'Details' }, initials],
      },
      {
        label: 'Runway Operations Suspended',
        text: '{callsign} REPORTS RWY OPERATIONS SUSPENDED...{initials}',
        fields: [twrCs, initials],
      },
      {
        label: 'Runway Operations Resumed',
        text: '{callsign} REPORTS RWY OPERATIONS RESUMED...{initials}',
        fields: [afld3, initials],
      },
      {
        label: 'Area Closed',
        text: '{callsign} REPORTS {area} CLOSED...{initials}',
        fields: [afld3, { key: 'area', label: 'Area (e.g. RWY/TAXIWAY/RAMP)' }, initials],
      },
      {
        label: 'On Airfield for Emergency Check',
        text: '{callsign} ON AFLD FOR EMERGENCY CK...{initials}',
        fields: [afld3, initials],
      },
    ],
  },

  // ─── CMA VIOLATIONS ───
  {
    category: 'CMA Violations',
    templates: [
      {
        label: 'Unauthorized Vehicle Report',
        text: '{callsign} REPORTS UNAUTHORIZED VEHICLE {details}...{initials}',
        fields: [twrCs, { key: 'details', label: 'Details' }, initials],
      },
      {
        label: 'On Airfield for CMAV',
        text: '{callsign} ON AFLD FOR CMAV...{initials}',
        fields: [afld3, initials],
      },
    ],
  },

  // ─── BWC DECLARATIONS ───
  {
    category: 'BWC Declarations',
    templates: [
      {
        label: 'BWC Change',
        text: '{callsign} REPORTS BWC CHANGE, BWC/{bwc}. QRC #{qrc} INITIATED...{initials}',
        fields: [afld3, { key: 'bwc', label: 'BWC Level (e.g. MODERATE)' }, { key: 'qrc', label: 'QRC Number' }, initials],
      },
    ],
  },

  // ─── MISCELLANEOUS ───
  {
    category: 'Miscellaneous',
    templates: [
      {
        label: 'Out of Office',
        text: '{callsign} OUT OF OFFICE TO {reason}...{initials}',
        fields: [afld3, { key: 'reason', label: 'Reason' }, initials],
      },
      {
        label: 'Back in Office',
        text: '{callsign} BACK IN OFFICE. {result}...{initials}',
        fields: [afld3, { key: 'result', label: 'Result (e.g. IMAGINARY SURFACES INSPECTED; NO DISCREPANCIES)' }, initials],
      },
      {
        label: 'General Report',
        text: '{callsign} {details}...{initials}',
        fields: [afld3, { key: 'details', label: 'Details', type: 'textarea' }, initials],
      },
    ],
  },
]
