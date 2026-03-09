import type { QrcStep } from './supabase/types'

export type QrcSeedTemplate = {
  qrc_number: number
  title: string
  notes?: string
  steps: QrcStep[]
  references?: string
  has_scn_form?: boolean
  scn_fields?: Record<string, unknown>
}

/**
 * QRC seed data rebuilt from actual source PDFs (docs/QRCs/).
 * 25 QRCs from 127th Wing / Selfridge ANGB Airfield Management.
 */
export const QRC_SEED_DATA: QrcSeedTemplate[] = [
  // ── QRC #1 ─────────────────────────────────────────────────────────────
  {
    qrc_number: 1,
    title: 'In-Flight (IFE) / Ground (GE) Emergency',
    notes: 'Refer all questions to public affairs. Do not disclose information related to aircraft mishaps/incidents. Personnel will not discuss the incident beyond what is necessary to accomplish duties.',
    steps: [
      {
        id: '1', type: 'checkbox_with_note',
        label: 'Using the Secondary Crash Net Checklist obtain as much information as possible and initiate the SCN forwarding, verbatim all information received.',
        note: 'If notification was not received from Tower, notify them',
      },
      { id: '2', type: 'checkbox', label: 'Initiate other QRC\'s/checklists which apply to the emergency.' },
      { id: '3', type: 'checkbox', label: 'Perform an airfield check. Report airfield conditions and closed/suspended surfaces.' },
      { id: '4', type: 'checkbox', label: 'Issue NOTAMs for closed surfaces and runway suspensions that last longer than 1 hour.' },
      { id: '5', type: 'checkbox', label: 'Contact the AFM / DAFM or AMOM and brief on the situation and all actions taken.' },
      {
        id: '6', type: 'checkbox_with_note',
        label: 'Activate the SCN as necessary to relay evolving emergency information.',
        note: 'Log time, initials and information relayed',
      },
      { id: '7', type: 'checkbox', label: 'Activate SCN with termination of emergency.' },
      { id: '8', type: 'checkbox', label: 'Cancel NOTAMs as applicable.' },
      { id: '9', type: 'checkbox', label: 'Log all actions/events on AF Form 3616, Daily Record of Facility Operation.' },
    ],
    references: 'DAFMAN 13-204v2, 127th DAFI 91-204, 127th IEMP 10-2',
    has_scn_form: true,
    scn_fields: {
      fields: [
        { key: 'pcas_activation_time', label: 'PCAS Activation Time (Z)', type: 'text' },
        { key: 'pcas_tower_initials', label: 'Tower Initials', type: 'text' },
        { key: 'scn_activation_time', label: 'SCN Activation Time (Z)', type: 'text' },
        { key: 'scn_termination_time', label: 'SCN Termination Time (Z)', type: 'text' },
        { key: 'am_initials', label: 'AM Initials', type: 'text' },
        { key: 'call_sign', label: 'Call Sign', type: 'text' },
        { key: 'type_of_aircraft', label: 'Type of Aircraft', type: 'text' },
        { key: 'nature_of_emergency', label: 'Nature of Emergency', type: 'textarea' },
        { key: 'eta', label: 'ETA', type: 'text' },
        { key: 'landing_runway', label: 'Landing Runway', type: 'text' },
        { key: 'pob', label: 'POB (Persons on Board)', type: 'text' },
        { key: 'fuel_on_board', label: 'Fuel on Board', type: 'text' },
        { key: 'current_winds', label: 'Current Winds', type: 'text' },
        { key: 'location_grid', label: 'Location/Grid Coordinates', type: 'text' },
        { key: 'ordnance_type', label: 'Ordnance/Hazardous Cargo — Type', type: 'text' },
        { key: 'ordnance_quantity', label: 'Ordnance/Hazardous Cargo — Quantity', type: 'text' },
        { key: 'ordnance_new', label: 'Net Explosive Weight', type: 'text' },
        { key: 'remarks', label: 'Remarks', type: 'textarea' },
        { key: 'bwc', label: 'BWC', type: 'text' },
        { key: 'rsc', label: 'RSC', type: 'text' },
      ],
    },
  },

  // ── QRC #2 ─────────────────────────────────────────────────────────────
  {
    qrc_number: 2,
    title: 'Aircraft Mishap (On/Off Base)',
    notes: 'Refer all questions to public affairs. Do not disclose information related to aircraft mishaps/incidents. Personnel will not discuss the incident beyond what is necessary to accomplish duties.',
    steps: [
      {
        id: '1', type: 'checkbox_with_note',
        label: 'Using the Secondary Crash Net Checklist, obtain as much information as possible and initiate the SCN forwarding, verbatim all information received.',
        note: 'If notification was not received from Tower, notify them',
      },
      { id: '2', type: 'checkbox', label: 'Initiate other QRC\'s/checklists which apply to the emergency.' },
      { id: '3', type: 'checkbox', label: 'Perform an airfield check. Conduct FOD check as required. Do not touch or remove anything, e.g., FOD or debris from the runway. Inspect aircraft taxi routes affected by the mishap. Report airfield conditions and closed/suspended surfaces.' },
      { id: '4', type: 'checkbox', label: 'Ensure Coast Guard is responding to any overwater mishap.' },
      {
        id: '5', type: 'checkbox', label: 'Preservation of Evidence:',
        sub_steps: [
          { id: '5a', type: 'checkbox', label: 'No picking up "FOD" or tampering with anything that can be considered evidence.' },
          { id: '5b', type: 'checkbox', label: 'Safeguard all documentation from the time of the mishap: 3616, Flight Plan, Weather, NOTAMs, AISR messages, and any other information/forms pertaining to the flight.' },
        ],
      },
      { id: '6', type: 'checkbox', label: 'Issue NOTAMs for closed surfaces and runway suspensions that last longer than 1 hour.' },
      { id: '7', type: 'conditional', label: 'Complete QRC #25 Mishap Notification.', cross_ref_qrc: 25 },
      {
        id: '8', type: 'checkbox_with_note',
        label: 'Activate the SCN as necessary to relay evolving emergency information.',
        note: 'Log time, initials and information relayed',
      },
      { id: '9', type: 'checkbox', label: 'Activate SCN with termination of emergency.' },
      { id: '10', type: 'checkbox', label: 'Cancel NOTAMs as applicable.' },
      { id: '11', type: 'checkbox', label: 'Log all actions/events on AF Form 3616, Daily Record of Facility Operation.' },
    ],
    references: 'DAFMAN 13-204v2, DAFMAN 91-223, 127th 91-204, DAFMAN 13-204v1',
    has_scn_form: true,
    scn_fields: {
      fields: [
        { key: 'pcas_activation_time', label: 'PCAS Activation Time (Z)', type: 'text' },
        { key: 'pcas_tower_initials', label: 'Tower Initials', type: 'text' },
        { key: 'scn_activation_time', label: 'SCN Activation Time (Z)', type: 'text' },
        { key: 'scn_termination_time', label: 'SCN Termination Time (Z)', type: 'text' },
        { key: 'am_initials', label: 'AM Initials', type: 'text' },
        { key: 'call_sign', label: 'Call Sign', type: 'text' },
        { key: 'type_of_aircraft', label: 'Type of Aircraft', type: 'text' },
        { key: 'nature_of_emergency', label: 'Nature of Emergency', type: 'textarea' },
        { key: 'eta', label: 'ETA', type: 'text' },
        { key: 'landing_runway', label: 'Landing Runway', type: 'text' },
        { key: 'pob', label: 'POB (Persons on Board)', type: 'text' },
        { key: 'fuel_on_board', label: 'Fuel on Board', type: 'text' },
        { key: 'current_winds', label: 'Current Winds', type: 'text' },
        { key: 'location_grid', label: 'Location/Grid Coordinates', type: 'text' },
        { key: 'ordnance_type', label: 'Ordnance/Hazardous Cargo — Type', type: 'text' },
        { key: 'ordnance_quantity', label: 'Ordnance/Hazardous Cargo — Quantity', type: 'text' },
        { key: 'ordnance_new', label: 'Net Explosive Weight', type: 'text' },
        { key: 'remarks', label: 'Remarks', type: 'textarea' },
        { key: 'bwc', label: 'BWC', type: 'text' },
        { key: 'rsc', label: 'RSC', type: 'text' },
      ],
    },
  },

  // ── QRC #3 ─────────────────────────────────────────────────────────────
  {
    qrc_number: 3,
    title: 'Aircraft Rescue & Fire Fighting Capabilities (ARFF Status)',
    steps: [
      {
        id: '1', type: 'fill_field', label: 'Obtain the following information from the Fire Dept.',
        field_label: 'Vehicle outage details',
        sub_steps: [
          { id: '1a', type: 'fill_field', label: 'Type of Vehicle', field_label: 'Vehicle Type' },
          { id: '1b', type: 'fill_field', label: 'Reason for Outage', field_label: 'Reason' },
          { id: '1c', type: 'fill_field', label: 'ETIC (Estimated time for vehicle to return to service)', field_label: 'ETIC' },
          { id: '1d', type: 'fill_field', label: 'Aircraft Group Affected', field_label: 'Aircraft Group' },
          { id: '1e', type: 'fill_field', label: 'Type Aircraft Affected (annotate the specific aircraft affected)', field_label: 'Aircraft Type' },
          { id: '1f', type: 'fill_field', label: 'Risk Code for Each Group', field_label: 'Risk Code' },
        ],
      },
      { id: '2', type: 'checkbox', label: 'Send the following NOTAM and notify all applicable agencies: "QFFXX – AERODROME AIRCRAFT RESCUE AND FIRE FIGHTING CAPABILITY CONDITION FOR CATEGORY X AIRCRAFT IS AT A (Insert level of service and abilities)"' },
      { id: '3', type: 'checkbox', label: 'Log all actions/events on the AF Form 3616, Daily Record of Facility Operation.' },
    ],
    references: 'DAFMAN 13-204v2, AFPAM 32-2004',
  },

  // ── QRC #4 ─────────────────────────────────────────────────────────────
  {
    qrc_number: 4,
    title: 'Airfield Restrictions and Closure',
    steps: [
      { id: '1', type: 'fill_field', label: 'Surface(s) or Service(s) to be restricted or closed:', field_label: 'Surface/Service' },
      {
        id: '2', type: 'fill_field',
        label: 'Reason for restriction or closure:',
        field_label: 'Reason',
        note: 'If not received from AFM, DAFM, or AMOM, call AFM/AMOM for verification',
      },
      { id: '3', type: 'checkbox', label: 'Issue NOTAM to restrict or close the surface or service.' },
      { id: '4', type: 'checkbox', label: 'Notify ALL agencies applicable for NOTAMs.' },
      { id: '5', type: 'checkbox', label: 'If Airfield Management services are closing; complete the shift checklist, clean, and secure area.' },
      { id: '6', type: 'checkbox', label: 'Log all actions/events on the AF Form 3616, Daily Record of Facility Operation.' },
      { id: '7', type: 'checkbox', label: 'REOPENING: Before opening surfaces, conduct a check/inspection.' },
      { id: '8', type: 'checkbox', label: 'Cancel issued applicable NOTAMs.' },
      { id: '9', type: 'checkbox', label: 'Log all actions/events on the AF Form 3616, Daily Record of Facility Operation.' },
    ],
    references: 'DAFMAN 13-204v2, AFI 11-208',
  },

  // ── QRC #5 ─────────────────────────────────────────────────────────────
  {
    qrc_number: 5,
    title: 'Hot Brakes / Hung Ordnance & Hot Armament',
    notes: 'Refer all questions to public affairs. Do not disclose information related to aircraft mishaps/incidents. Personnel will not discuss the incident beyond what is necessary to accomplish duties.',
    steps: [
      {
        id: '1', type: 'checkbox_with_note',
        label: 'Using the Secondary Crash Net Checklist obtain as much information as possible and initiate the SCN forwarding, verbatim all information received.',
        note: 'If notification was not received from Tower, notify them',
      },
      { id: '2', type: 'checkbox', label: 'Initiate other QRC\'s/checklists which apply to the emergency.' },
      {
        id: '3', type: 'checkbox',
        label: 'Perform an airfield check. Report airfield conditions and closed/suspended surfaces. DO NOT position yourself downrange from the guns of the aircraft.',
        sub_steps: [
          { id: '3a', type: 'checkbox', label: 'HOT BRAKES: TWR may taxi aircraft to hot brakes areas on TWY E and K facing west.' },
          { id: '3b', type: 'checkbox', label: 'HUNG ORDNANCE / HOT GUN: TWR may taxi aircraft to face the Gun Butt on the west ramp. AC-130J\'s will point to the west with gun pointing at the Gun Butt. — See MFR in Read File' },
        ],
      },
      { id: '4', type: 'checkbox', label: 'Issue NOTAMs for closed surfaces and runway suspensions that last longer than 1 hour.' },
      { id: '5', type: 'checkbox', label: 'Contact the AFM / DAFM or AMOM and brief on the situation and all actions taken.' },
      {
        id: '6', type: 'checkbox_with_note',
        label: 'Activate the SCN as necessary to relay evolving emergency information.',
        note: 'Log time, initials and information relayed',
      },
      { id: '7', type: 'checkbox', label: 'Activate SCN with termination of emergency.' },
      { id: '8', type: 'checkbox', label: 'Cancel NOTAMs as applicable.' },
      { id: '9', type: 'checkbox', label: 'Log all actions/events on AF Form 3616, Daily Record of Facility Operation.' },
    ],
    references: 'DAFMAN 13-204v2, MFR with 16th SOS "Hot Gun and Round Jettison"',
    has_scn_form: true,
    scn_fields: {
      fields: [
        { key: 'pcas_activation_time', label: 'PCAS Activation Time (Z)', type: 'text' },
        { key: 'pcas_tower_initials', label: 'Tower Initials', type: 'text' },
        { key: 'scn_activation_time', label: 'SCN Activation Time (Z)', type: 'text' },
        { key: 'scn_termination_time', label: 'SCN Termination Time (Z)', type: 'text' },
        { key: 'am_initials', label: 'AM Initials', type: 'text' },
        { key: 'call_sign', label: 'Call Sign', type: 'text' },
        { key: 'type_of_aircraft', label: 'Type of Aircraft', type: 'text' },
        { key: 'nature_of_emergency', label: 'Nature of Emergency', type: 'textarea' },
        { key: 'eta', label: 'ETA', type: 'text' },
        { key: 'landing_runway', label: 'Landing Runway', type: 'text' },
        { key: 'pob', label: 'POB (Persons on Board)', type: 'text' },
        { key: 'fuel_on_board', label: 'Fuel on Board', type: 'text' },
        { key: 'current_winds', label: 'Current Winds', type: 'text' },
        { key: 'location_grid', label: 'Location/Grid Coordinates', type: 'text' },
        { key: 'ordnance_type', label: 'Ordnance/Hazardous Cargo — Type', type: 'text' },
        { key: 'ordnance_quantity', label: 'Ordnance/Hazardous Cargo — Quantity', type: 'text' },
        { key: 'ordnance_new', label: 'Net Explosive Weight', type: 'text' },
        { key: 'remarks', label: 'Remarks', type: 'textarea' },
        { key: 'bwc', label: 'BWC', type: 'text' },
        { key: 'rsc', label: 'RSC', type: 'text' },
      ],
    },
  },

  // ── QRC #6 ─────────────────────────────────────────────────────────────
  {
    qrc_number: 6,
    title: 'Building 50 Evacuation',
    steps: [
      { id: '1', type: 'checkbox', label: 'Notify all personnel in the building to evacuate.' },
      { id: '2', type: 'checkbox', label: 'Notify TWR/RAPCON and inform them that AMOPS will be evacuating to the alternate location.' },
      {
        id: '3', type: 'checkbox_with_note',
        label: 'Activate SCN: "AMOPS PERSONNEL ARE EVACUATING BLDG. 50. AMOPS CAN BE CONTACTED ON THE TOWER NET UNTIL FURTHER NOTICE."',
        note: 'Record SCN activation time and initials',
      },
      {
        id: '4', type: 'checkbox', label: 'Take the following items:',
        sub_steps: [
          { id: '4a', type: 'checkbox', label: 'Evacuation Kit' },
          { id: '4b', type: 'checkbox', label: 'LMR Radios' },
          { id: '4c', type: 'checkbox', label: 'Laptop' },
          { id: '4d', type: 'checkbox', label: 'RT3 Tablet' },
          { id: '4e', type: 'checkbox', label: 'Pyrotechnics' },
          { id: '4f', type: 'checkbox', label: 'Truck Keys' },
        ],
      },
      { id: '5', type: 'checkbox', label: 'Proceed to BLDG 560 room 318.' },
      { id: '6', type: 'checkbox', label: 'Once at the alternate facility, contact Tower/RAPCON and all agencies on the SCN and notify that AMOPS is operating from the alternate facility.' },
      {
        id: '7', type: 'checkbox', label: 'Once BLDG. 50 has returned to normal operations:',
        sub_steps: [
          { id: '7a', type: 'checkbox', label: 'Notify TWR/RAPCON and inform them that AMOPS has returned to Bldg. 50.' },
          { id: '7b', type: 'checkbox_with_note', label: 'Activate SCN: "AMOPS PERSONNEL HAVE RETURNED TO BLDG 50"', note: 'Record SCN activation time and initials' },
        ],
      },
      { id: '8', type: 'checkbox', label: 'Log all actions/events on AF Form 3616, Daily Record of Facility Operation.' },
    ],
    references: 'DAFMAN 13-204v2',
  },

  // ── QRC #7 ─────────────────────────────────────────────────────────────
  {
    qrc_number: 7,
    title: 'Air/Medical Evacuation',
    steps: [
      {
        id: '1', type: 'fill_field', label: 'Obtain the following information:',
        field_label: 'Air/Med Evac Details',
        sub_steps: [
          { id: '1a', type: 'fill_field', label: 'Type of Aircraft', field_label: 'Aircraft Type' },
          { id: '1b', type: 'fill_field', label: 'ETA', field_label: 'ETA' },
          { id: '1c', type: 'fill_field', label: 'Fuel on Board', field_label: 'Fuel' },
          { id: '1d', type: 'fill_field', label: 'Fuel Requested', field_label: 'Fuel Requested' },
          { id: '1e', type: 'fill_field', label: 'Number of Crew Members', field_label: 'Crew' },
          { id: '1f', type: 'fill_field', label: 'Number of Attendants', field_label: 'Attendants' },
          { id: '1g', type: 'fill_field', label: 'Number of PAX', field_label: 'PAX' },
          { id: '1h', type: 'fill_field', label: 'Number of Patients', field_label: 'Patients' },
          { id: '1i', type: 'fill_field', label: 'Number of Patients that are ambulatory', field_label: 'Ambulatory' },
          { id: '1j', type: 'fill_field', label: 'Is ERPS (Temp holding facility/staging area) required or already in place?', field_label: 'ERPS' },
        ],
      },
      {
        id: '2', type: 'notify_agencies',
        label: 'Contact the following agencies and pass all the above information:',
        agencies: ['Fire Department', 'Medical Clinic', 'TA or MOCC', 'Command Post', 'AFM', 'AMOM'],
      },
      { id: '3', type: 'checkbox', label: 'Create and issue PPRs as needed.' },
      { id: '4', type: 'checkbox', label: 'Log all actions/events on the AF Form 3616, Daily Record of Facility Operation.' },
    ],
    references: 'DAFMAN 13-204v2, DAFI 48-107v1',
  },

  // ── QRC #8 ─────────────────────────────────────────────────────────────
  {
    qrc_number: 8,
    title: 'Controlled Movement Area Violation (CMAV)',
    steps: [
      {
        id: '1', type: 'checkbox_with_note',
        label: 'When notified of a possible CMAV, respond to the reported area.',
        note: 'Record Who, What, When, and Where',
      },
      { id: '2', type: 'checkbox', label: 'When on scene escort driver back to AMOPS. Contact SFS (x4673) if needed.' },
      {
        id: '3', type: 'fill_field', label: 'Obtain the following information:',
        field_label: 'CMAV Details',
        sub_steps: [
          { id: '3a', type: 'fill_field', label: 'Name', field_label: 'Name' },
          { id: '3b', type: 'fill_field', label: 'Rank', field_label: 'Rank' },
          { id: '3c', type: 'fill_field', label: 'Organization', field_label: 'Organization' },
          { id: '3d', type: 'fill_field', label: 'Supervisor', field_label: 'Supervisor' },
          { id: '3e', type: 'fill_field', label: 'Duty Phone', field_label: 'Duty Phone' },
          { id: '3f', type: 'fill_field', label: 'Vehicle Type', field_label: 'Vehicle Type' },
          { id: '3g', type: 'fill_field', label: 'License Plate Number', field_label: 'License Plate' },
          { id: '3h', type: 'fill_field', label: 'Date/Time of CMAV', field_label: 'Date/Time' },
          { id: '3i', type: 'fill_field', label: 'Location of CMAV', field_label: 'Location' },
        ],
      },
      { id: '4', type: 'checkbox', label: 'Retrieve/confiscate the individual\'s AF Form 483, Certificate of Competency.' },
      { id: '5', type: 'checkbox', label: 'Have the individual fill out an AF Form 1168, Statement of Suspect/Witness/Complaint.' },
      { id: '6', type: 'checkbox', label: 'Complete AF Form 457, USAF Hazard Report and/or AF Form 651, Hazardous Air Traffic Report.' },
      {
        id: '7', type: 'notify_agencies',
        label: 'Notify the following:',
        agencies: ['AMOM', 'DAFM', 'AFM', 'Safety'],
      },
      { id: '8', type: 'checkbox', label: 'Add all applicable forms into the Daily Paperwork.' },
      { id: '9', type: 'checkbox', label: 'Log all actions/events on the AF Form 3616, Daily Record of Facility Operation.' },
    ],
    references: 'DAFMAN 13-204v2, AFMAN 91-223, ADI, AFI 13-213',
  },

  // ── QRC #9 ─────────────────────────────────────────────────────────────
  {
    qrc_number: 9,
    title: 'Hazardous Cargo',
    steps: [
      {
        id: '1', type: 'fill_field', label: 'Obtain the following information:',
        field_label: 'Hazardous Cargo Details',
        sub_steps: [
          { id: '1a', type: 'fill_field', label: 'Call Sign', field_label: 'Call Sign' },
          { id: '1b', type: 'fill_field', label: 'Type of Aircraft', field_label: 'Aircraft Type' },
          { id: '1c', type: 'fill_field', label: 'ETA', field_label: 'ETA' },
          { id: '1d', type: 'fill_field', label: 'Type of Cargo', field_label: 'Cargo Type' },
          { id: '1e', type: 'fill_field', label: 'Runway of Intended Landing', field_label: 'Landing Runway' },
          { id: '1f', type: 'fill_field', label: 'NET Explosive Weight (NEW) or Line Number', field_label: 'NEW/Line #' },
          { id: '1g', type: 'fill_field', label: 'Class Explosive', field_label: 'Class' },
          { id: '1h', type: 'fill_field', label: 'ETD', field_label: 'ETD' },
          { id: '1i', type: 'fill_field', label: 'Destination', field_label: 'Destination' },
          { id: '1j', type: 'fill_field', label: 'Runway of Intended Departure', field_label: 'Departure Runway' },
          { id: '1k', type: 'fill_field', label: 'Additional Information', field_label: 'Additional Info' },
        ],
      },
      { id: '2', type: 'checkbox', label: 'Aircraft will be parked on Hot Cargo Pad (Not usable for C-17s/C-5s).' },
      {
        id: '3', type: 'notify_agencies',
        label: 'When inbound is received via AISR, notify the following:',
        agencies: ['Tower (Hotline)', 'Fire Department', 'Ammo (x6950)', 'Command Post', 'ATOC', 'Security Forces'],
      },
      { id: '4', type: 'checkbox', label: 'Once aircraft is parked on Hot Cargo Pad, issue applicable NOTAMs closing any affected areas.' },
      { id: '5', type: 'checkbox', label: 'Log all actions/events on the AF Form 3616, Daily Record of Facility Operation.' },
    ],
    references: 'DAFMAN 13-204v2, IEMP 10-2',
  },

  // ── QRC #10 ────────────────────────────────────────────────────────────
  {
    qrc_number: 10,
    title: 'Overdue Aircraft',
    steps: [
      {
        id: '1', type: 'fill_field',
        label: 'All known info about the overdue aircraft:',
        field_label: 'Aircraft Info (Tail#, departure ICAO/Time, Fuel, SOB)',
      },
      {
        id: '2', type: 'notify_agencies',
        label: 'PRECOM: Initiate preliminary communications search by contacting the following agencies.',
        agencies: [
          'Tower/RAPCON (Verify aircraft is overdue & not in contact)',
          'Departure ICAO (Confirm departure data)',
          'CLE Flight Service Station (440-774-0490)',
          'DET Approach Control (734-955-5024)',
          'CLE ARTCC (440-774-0429)',
          'Flying Squadron and/or their MOCC',
          'Transmit QALQ Message (See AFI 13-202 Table A2.1)',
          'Washington Communications Control Center via Service B to KRWAYAYX',
        ],
      },
      { id: '3', type: 'checkbox', label: 'Once the aircraft is located, notify all agencies that have already been contacted.' },
      { id: '4', type: 'checkbox_with_note', label: 'INREQs: If Step 2 fails or the aircraft is more than 30 minutes overdue, declare the aircraft as officially overdue. Send Information Request (INREQs) AISR message.', note: 'Address to: Flight Plan Originator, Departure base, KZOBZRZA, KSARYCYX, Enroute ARTCCs, Departure tie-in facility' },
      { id: '5', type: 'checkbox', label: 'Call the AFM, AMOM, and Cleveland Rescue Coordination Center (800-851-3051).' },
      { id: '6', type: 'checkbox_with_note', label: 'ALNOT: If step 4 fails or the aircraft is more than 1 hour overdue, transmit AISR ALNOT message.', note: 'Address to: Flight Plan Originator, KSARYCYX, appropriate Regional Operations Center, ARTCCs 50 miles either side of route, home base of the aircraft' },
      { id: '7', type: 'checkbox', label: '10 minutes after ALNOT: Call Cleveland RCC (800-851-3051), CLE ARTCC (440-774-0429), and AF RCC (DSN: 94-523-5955, Backup: DSN 497-0680).' },
      { id: '8', type: 'checkbox', label: 'The Alert Notice remains current until the aircraft is located or the search is suspended by RCC. Transmit a cancellation message with the location of the aircraft, addressed to all recipients of the ALNOT.' },
      { id: '9', type: 'checkbox', label: 'Log all actions/events on the AF Form 3616, Daily Record of Facility Operation.' },
    ],
    references: 'DAFMAN 13-204v2, AFI 13-202, AFMAN 11-312',
  },

  // ── QRC #11 ────────────────────────────────────────────────────────────
  {
    qrc_number: 11,
    title: 'Fuel Spill',
    steps: [
      {
        id: '1', type: 'checkbox_with_note',
        label: 'Using the Secondary Crash Net Checklist, obtain as much information as possible and initiate the SCN forwarding, verbatim all information received.',
        note: 'If notification was not received from Tower, notify them',
      },
      { id: '2', type: 'checkbox', label: 'Initiate other QRC\'s/checklists which apply to the emergency. (Facility Evac, NOTAM, etc.)' },
      { id: '3', type: 'checkbox', label: 'Perform an airfield check. Report airfield conditions and closed/suspended surfaces.' },
      {
        id: '4', type: 'checkbox', label: 'Select the Class of Spill:',
        sub_steps: [
          { id: '4a', type: 'checkbox', label: 'CLASS I SPILLS — Less than 2 feet in any direction.' },
          { id: '4b', type: 'checkbox', label: 'CLASS II SPILLS — Less than 10 feet in any direction or less than 50 Sq ft.' },
          { id: '4c', type: 'checkbox', label: 'CLASS III SPILLS — More than 10 feet in any direction or more than 50 Sq ft.' },
        ],
      },
      { id: '5', type: 'checkbox', label: 'Issue NOTAMs for closed surfaces and runway suspensions that last longer than 1 hour.' },
      { id: '6', type: 'checkbox', label: 'Contact the AFM / DAFM or AMOM and brief on the situation and all actions taken.' },
      {
        id: '7', type: 'checkbox_with_note',
        label: 'Activate the SCN as necessary to relay evolving emergency information.',
        note: 'Log time, initials and information relayed',
      },
      { id: '8', type: 'checkbox', label: 'Activate SCN with termination of emergency.' },
      { id: '9', type: 'checkbox', label: 'Cancel NOTAMs as applicable.' },
      { id: '10', type: 'checkbox', label: 'Log all actions/events on AF Form 3616, Daily Record of Facility Operation.' },
    ],
    references: 'DAFMAN 13-204v2',
    has_scn_form: true,
    scn_fields: {
      fields: [
        { key: 'pcas_activation_time', label: 'PCAS Activation Time (Z)', type: 'text' },
        { key: 'pcas_tower_initials', label: 'Tower Initials', type: 'text' },
        { key: 'scn_activation_time', label: 'SCN Activation Time (Z)', type: 'text' },
        { key: 'scn_termination_time', label: 'SCN Termination Time (Z)', type: 'text' },
        { key: 'am_initials', label: 'AM Initials', type: 'text' },
        { key: 'call_sign', label: 'Call Sign', type: 'text' },
        { key: 'type_of_aircraft', label: 'Type of Aircraft', type: 'text' },
        { key: 'nature_of_emergency', label: 'Nature of Emergency', type: 'textarea' },
        { key: 'eta', label: 'ETA', type: 'text' },
        { key: 'landing_runway', label: 'Landing Runway', type: 'text' },
        { key: 'pob', label: 'POB (Persons on Board)', type: 'text' },
        { key: 'fuel_on_board', label: 'Fuel on Board', type: 'text' },
        { key: 'current_winds', label: 'Current Winds', type: 'text' },
        { key: 'location_grid', label: 'Location/Grid Coordinates', type: 'text' },
        { key: 'ordnance_type', label: 'Ordnance/Hazardous Cargo — Type', type: 'text' },
        { key: 'ordnance_quantity', label: 'Ordnance/Hazardous Cargo — Quantity', type: 'text' },
        { key: 'ordnance_new', label: 'Net Explosive Weight', type: 'text' },
        { key: 'remarks', label: 'Remarks', type: 'textarea' },
        { key: 'bwc', label: 'BWC', type: 'text' },
        { key: 'rsc', label: 'RSC', type: 'text' },
      ],
    },
  },

  // ── QRC #12 ────────────────────────────────────────────────────────────
  {
    qrc_number: 12,
    title: 'Tornado Warning',
    steps: [
      {
        id: '1', type: 'checkbox_with_note',
        label: 'Activate the SCN and pass the following information verbatim (Repeat Twice): "This is Airfield Management with a Tornado Warning # ___ Valid from ___ Z to ___ Z. Airfield Management services will be unavailable until further notice."',
        note: 'Record SCN time and initials',
      },
      { id: '2', type: 'checkbox', label: 'Take cover in BLDG 50 basement and follow Shelter in Place Plan.' },
      { id: '3', type: 'checkbox', label: 'After the Tornado Warning has been cancelled: Account for all Airfield Management personnel, their location, and physical condition.' },
      {
        id: '4', type: 'checkbox_with_note',
        label: 'Activate SCN upon cancellation of the Tornado Warning: "This is Airfield Management with a Tornado Warning # ___. Airfield Management services are now available."',
        note: 'Record SCN time and initials',
      },
      { id: '5', type: 'checkbox', label: 'Conduct an airfield inspection. Identify and report any resource damage to the AFM, Unit Control Center, or Command Post. Keep AFM and AMOM advised of the airfield status.' },
      { id: '6', type: 'checkbox', label: 'Close and NOTAM surfaces as needed.' },
      { id: '7', type: 'checkbox', label: 'Log all actions/events on the AF Form 3616, Daily Record of Facility Operation.' },
    ],
    references: 'DAFMAN 13-204v2, 127th Wing Emergency Actions and SIP Guide',
  },

  // ── QRC #13 ────────────────────────────────────────────────────────────
  {
    qrc_number: 13,
    title: 'Bomb Threat',
    notes: 'Refer all questions to public affairs. Do not disclose information related to the bomb threat. WARNING: DO NOT hang up the phone.',
    steps: [
      { id: '1', type: 'checkbox', label: 'Record all information exactly as received using AF Form 440, Bomb Threat.' },
      { id: '2', type: 'checkbox', label: 'Leave telephone line open for possible trace. DO NOT hang up until told to do so by Security Forces.' },
      { id: '3', type: 'checkbox', label: 'Immediately after receiving the threat, use a different phone and notify Security Forces at X4673.' },
      { id: '4', type: 'checkbox', label: 'Activate SCN and relay all information if the threat affects safety and security of airfield/flight operations.' },
      { id: '5', type: 'checkbox', label: 'Notify AFM and AMOM.' },
      {
        id: '6', type: 'conditional',
        label: 'If BLDG 50 is involved, initiate QRC #6, Building 50 Evacuation.',
        cross_ref_qrc: 6,
        note: 'Keep possible bomb location in mind when considering building entry/exit points. Brief all personnel NOT to make radio transmissions within 100 feet of affected area.',
      },
      { id: '7', type: 'checkbox', label: 'Log all actions/events on the AF Form 3616, Daily Record of Facility Operation.' },
      { id: '8', type: 'checkbox', label: 'Upload completed AF Form 440 to the daily paperwork.' },
    ],
    references: 'DAFMAN 13-204v2',
  },

  // ── QRC #14 ────────────────────────────────────────────────────────────
  {
    qrc_number: 14,
    title: 'Bird Strike',
    steps: [
      { id: '1', type: 'checkbox', label: 'Suspend runway operations immediately after receiving word of a possible or actual bird strike and conduct an airfield check.' },
      { id: '2', type: 'checkbox', label: 'If a dead bird is found, remove. Collect all remains and retain for Wing Safety/USDA.' },
      { id: '3', type: 'checkbox', label: 'After birds have been dispersed and runway check is completed, resume operations on the runway.' },
      {
        id: '4', type: 'checkbox',
        label: 'Have aircrew (if applicable) complete AF Form 853, Air Force Strike Report.',
        note: 'Must have a completed AF Form 853 & AF Form 2519 on file with remains.',
      },
      {
        id: '5', type: 'notify_agencies',
        label: 'Contact the agencies below and pass all known information, advise agencies if remains were found:',
        agencies: ['Tower', 'Wing Safety', 'AFM', 'MOCC/Flying Unit', 'Command Post', 'USDA'],
      },
      { id: '6', type: 'conditional', label: 'If changes to the BWC are warranted, complete QRC #15.', cross_ref_qrc: 15 },
      { id: '7', type: 'checkbox', label: 'Log all actions/events on the AF Form 3616, Daily Record of Facility Operation.' },
      { id: '8', type: 'checkbox', label: 'Attach all completed forms to the Daily Paperwork.' },
    ],
    references: 'DAFMAN 13-204v2, AFMAN 91-201, Wing BASH Plan, AFI 91-202',
  },

  // ── QRC #15 ────────────────────────────────────────────────────────────
  {
    qrc_number: 15,
    title: 'Bird Watch Condition (BWC) Change',
    steps: [
      {
        id: '1', type: 'fill_field',
        label: 'Obtain the following information upon notification of bird activity on or near the runway:',
        field_label: 'Bird Activity Details',
        sub_steps: [
          { id: '1a', type: 'fill_field', label: 'Reported by', field_label: 'Reported by' },
          { id: '1b', type: 'fill_field', label: 'Size of Flock', field_label: 'Flock Size' },
          { id: '1c', type: 'fill_field', label: 'Location of Birds relative to Runway', field_label: 'Location' },
          { id: '1d', type: 'fill_field', label: 'Type of Birds', field_label: 'Bird Type' },
          { id: '1e', type: 'fill_field', label: 'Description of Bird Activity', field_label: 'Activity Description' },
        ],
      },
      { id: '2', type: 'checkbox', label: 'Dispatch AMOPS personnel to the airfield, and disperse birds as required. If pyrotechnics will be used, complete QRC #22 Pyrotechnics Use. Contact USDA during normal duty hours to respond to airfield.' },
      { id: '3', type: 'checkbox', label: 'If the BWC is increased, record time and level (MODERATE / SEVERE).' },
      { id: '4', type: 'checkbox', label: 'Notify TWR.' },
      { id: '5', type: 'checkbox', label: 'Issue/update NOTAM: BASH BIRD WATCH CONDITION MODERATE/SEVERE.' },
      { id: '6', type: 'checkbox', label: 'Update the AFAS and BASH/Pyrotechnics Log.' },
      { id: '7', type: 'checkbox', label: 'Repeat steps 1–6 for additional BWC changes other than LOW.' },
      { id: '8', type: 'checkbox', label: 'Log all actions/events on AF Form 3616, Daily Record of Facility Operation.' },
      { id: '9', type: 'time_field', label: 'Once BWC LOW has been declared, record time:', field_label: 'BWC LOW Time (Z)' },
      { id: '10', type: 'checkbox', label: 'Notify TWR.' },
      { id: '11', type: 'checkbox', label: 'Cancel BASH NOTAM.' },
      { id: '12', type: 'checkbox', label: 'Update the AFAS and BASH/Pyrotechnics Log.' },
      { id: '13', type: 'checkbox', label: 'Log all actions/events on AF Form 3616, Daily Record of Facility Operation.' },
    ],
    references: 'DAFMAN 13-204v2, AFMAN 31-201, SANGB BASH Plan, AFI 91-202',
  },

  // ── QRC #16 ────────────────────────────────────────────────────────────
  {
    qrc_number: 16,
    title: 'Anti-Hijacking',
    notes: 'Refer all questions to public affairs. Do not disclose information related to aircraft mishaps/incidents. Personnel will not discuss the incident beyond what is necessary to accomplish duties. MISSION: Stop the launch of hijacked aircraft.',
    steps: [
      { id: '1', type: 'checkbox', label: 'Check resources to confirm possible hijacking: Flight Plans, Flying Schedules, Traffic Log, CP, and the MOCCs to ensure they are not conducting engine runs or tow operations on the aircraft.' },
      {
        id: '2', type: 'checkbox_with_note',
        label: 'Using the Secondary Crash Net Checklist obtain as much information as possible and initiate the SCN forwarding, verbatim all information received.',
        note: 'If notification was not received from Tower, notify them. Record Hijacked Aircraft Squawk (7500 = Hijacked, 7700 = Requesting armed intervention)',
      },
      { id: '3', type: 'checkbox', label: 'Initiate other QRC\'s/checklists which apply to the emergency.' },
      {
        id: '4', type: 'checkbox', label: 'Respond to the on-scene command center and provide assistance.',
        sub_steps: [
          { id: '4a', type: 'checkbox', label: 'If capable, establish communications with the aircrew/pilot. If pilot uses code words "Flaps full down" or attaches the word "Trip" to their call sign, these are positive signals for a hijacking situation.' },
          { id: '4b', type: 'checkbox', label: 'Aid the Incident Commander in establishing a blocking force for aircraft and ensuring personnel then abandon their vehicles.' },
        ],
      },
      { id: '5', type: 'checkbox', label: 'Issue NOTAMs for closed surfaces and runway suspensions that last longer than 1 hour.' },
      { id: '6', type: 'checkbox', label: 'If aircraft doors are Closed, aircraft is considered "In-Flight" — have ATC relay all information to the FAA. If aircraft doors are Open, aircraft is "On-Ground" — have SFS contact the FBI to respond to scene.' },
      { id: '7', type: 'checkbox', label: 'Contact the AFM / DAFM or AMOM and brief on the situation and all actions taken.' },
      { id: '8', type: 'checkbox', label: 'Activate SCN with termination of emergency.' },
      { id: '9', type: 'checkbox', label: 'Cancel NOTAMs and close other QRCs as applicable.' },
      { id: '10', type: 'checkbox', label: 'Log all actions/events on AF Form 3616.' },
    ],
    references: 'DAFMAN 13-204v2, 127th WG Integrated Defense Plan',
    has_scn_form: true,
    scn_fields: {
      fields: [
        { key: 'pcas_activation_time', label: 'PCAS Activation Time (Z)', type: 'text' },
        { key: 'pcas_tower_initials', label: 'Tower Initials', type: 'text' },
        { key: 'hijacked_squawk', label: 'Hijacked Aircraft Squawk', type: 'text' },
        { key: 'scn_activation_time', label: 'SCN Activation Time (Z)', type: 'text' },
        { key: 'scn_termination_time', label: 'SCN Termination Time (Z)', type: 'text' },
        { key: 'am_initials', label: 'AM Initials', type: 'text' },
        { key: 'call_sign', label: 'Call Sign', type: 'text' },
        { key: 'type_of_aircraft', label: 'Type of Aircraft', type: 'text' },
        { key: 'nature_of_emergency', label: 'Nature of Emergency', type: 'textarea' },
        { key: 'eta', label: 'ETA', type: 'text' },
        { key: 'landing_runway', label: 'Landing Runway', type: 'text' },
        { key: 'pob', label: 'POB (Persons on Board)', type: 'text' },
        { key: 'fuel_on_board', label: 'Fuel on Board', type: 'text' },
        { key: 'current_winds', label: 'Current Winds', type: 'text' },
        { key: 'location_grid', label: 'Location/Grid Coordinates', type: 'text' },
        { key: 'ordnance_type', label: 'Ordnance/Hazardous Cargo — Type', type: 'text' },
        { key: 'ordnance_quantity', label: 'Ordnance/Hazardous Cargo — Quantity', type: 'text' },
        { key: 'ordnance_new', label: 'Net Explosive Weight', type: 'text' },
        { key: 'remarks', label: 'Remarks', type: 'textarea' },
        { key: 'bwc', label: 'BWC', type: 'text' },
        { key: 'rsc', label: 'RSC', type: 'text' },
      ],
    },
  },

  // ── QRC #17 ────────────────────────────────────────────────────────────
  {
    qrc_number: 17,
    title: 'Alert / Recall Procedures',
    steps: [
      {
        id: '1', type: 'fill_field',
        label: 'When notified, collect all pertinent information regarding the recall.',
        field_label: 'Recall Details (Who, What, When, Where, Why)',
      },
      {
        id: '2', type: 'checkbox',
        label: 'Contact all personnel on the recall roster (located on the 127th OSS/OSA Phone Book).',
        sub_steps: [
          { id: '2a', type: 'checkbox', label: 'From the top down notify all Airfield Management personnel of the recall and its details. Call and leave a voicemail then follow up with a text.' },
          { id: '2b', type: 'fill_field', label: 'Enter initials for: Accounted for and Notified / Voicemail and/or Text sent / On Leave or TDY', field_label: 'Personnel Status' },
        ],
      },
      { id: '3', type: 'checkbox', label: 'Continue until all personnel are notified and accounted for. Notify the AFM of any personnel who cannot be contacted.' },
      { id: '4', type: 'checkbox', label: 'Log all actions/events on the AF Form 3616, Daily Record of Facility Operation.' },
    ],
    references: 'DAFMAN 13-204v2',
  },

  // ── QRC #18 ────────────────────────────────────────────────────────────
  {
    qrc_number: 18,
    title: 'Unauthorized Aircraft Landing',
    notes: 'Refer all questions to public affairs. Do not disclose information related to aircraft landings. Personnel will not discuss the incident beyond what is necessary to accomplish duties.',
    steps: [
      {
        id: '1', type: 'checkbox_with_note',
        label: 'Using the Secondary Crash Net Checklist obtain as much information as possible and initiate the SCN forwarding, verbatim all information received.',
        note: 'If notification was not received from Tower, notify them',
      },
      { id: '2', type: 'checkbox', label: 'Notify the AFM.' },
      { id: '3', type: 'checkbox', label: 'Aircraft should be parked on Hot Cargo Pad unless advised otherwise by the AFM.' },
      { id: '4', type: 'checkbox', label: 'Request Security Forces respond to ensure the aircraft and any personnel on board are secured.' },
      { id: '5', type: 'checkbox', label: 'The AFM or designated representative will respond to the aircraft location, as needed.' },
      {
        id: '6', type: 'checkbox_with_note',
        label: 'Activate the SCN as necessary to relay evolving emergency information.',
        note: 'Log time, initials and information relayed',
      },
      { id: '7', type: 'checkbox', label: 'Once Security Forces has secured the aircraft and personnel on board, activate the SCN with termination of emergency.' },
      {
        id: '8', type: 'checkbox', label: 'Advise Security Forces to escort personnel to AMOPS and obtain the following information:',
        sub_steps: [
          { id: '8a', type: 'checkbox', label: 'Original Flight Plan (If available)' },
          { id: '8b', type: 'checkbox', label: 'Pilot-In-Command will complete statement of events (AF Form 1168, Statement of Suspect/Witness/Complainant).' },
          { id: '8c', type: 'checkbox', label: 'With the assistance of the AFM, determine the type of unauthorized landing (refer to AFI 10-1001).' },
          { id: '8d', type: 'checkbox', label: 'Pilot-In-Command will complete DD Form 2402, Hold Harmless Agreement.' },
        ],
      },
      { id: '9', type: 'checkbox', label: 'Log all actions/events on AF Form 3616, Daily Record of Facility Operation.' },
      { id: '10', type: 'checkbox', label: 'Attach all completed forms to the Daily Paperwork.' },
    ],
    references: 'DAFMAN 13-204v2, AFI 10-1001',
    has_scn_form: true,
    scn_fields: {
      fields: [
        { key: 'pcas_activation_time', label: 'PCAS Activation Time (Z)', type: 'text' },
        { key: 'pcas_tower_initials', label: 'Tower Initials', type: 'text' },
        { key: 'scn_activation_time', label: 'SCN Activation Time (Z)', type: 'text' },
        { key: 'scn_termination_time', label: 'SCN Termination Time (Z)', type: 'text' },
        { key: 'am_initials', label: 'AM Initials', type: 'text' },
        { key: 'call_sign', label: 'Call Sign', type: 'text' },
        { key: 'type_of_aircraft', label: 'Type of Aircraft', type: 'text' },
        { key: 'nature_of_emergency', label: 'Nature of Emergency', type: 'textarea' },
        { key: 'eta', label: 'ETA', type: 'text' },
        { key: 'landing_runway', label: 'Landing Runway', type: 'text' },
        { key: 'pob', label: 'POB (Persons on Board)', type: 'text' },
        { key: 'fuel_on_board', label: 'Fuel on Board', type: 'text' },
        { key: 'current_winds', label: 'Current Winds', type: 'text' },
        { key: 'location_grid', label: 'Location/Grid Coordinates', type: 'text' },
        { key: 'ordnance_type', label: 'Ordnance/Hazardous Cargo — Type', type: 'text' },
        { key: 'ordnance_quantity', label: 'Ordnance/Hazardous Cargo — Quantity', type: 'text' },
        { key: 'ordnance_new', label: 'Net Explosive Weight', type: 'text' },
        { key: 'remarks', label: 'Remarks', type: 'textarea' },
        { key: 'bwc', label: 'BWC', type: 'text' },
        { key: 'rsc', label: 'RSC', type: 'text' },
      ],
    },
  },

  // ── QRC #19 ────────────────────────────────────────────────────────────
  {
    qrc_number: 19,
    title: 'Distinguished Visitor Inbound/Outbound',
    steps: [
      {
        id: '1', type: 'fill_field',
        label: 'When notified of an inbound DV, record the following information:',
        field_label: 'DV Details',
        sub_steps: [
          { id: '1a', type: 'fill_field', label: 'Name', field_label: 'Name' },
          { id: '1b', type: 'fill_field', label: 'Rank/DV Code', field_label: 'Rank/DV Code' },
          { id: '1c', type: 'fill_field', label: 'Title/Position', field_label: 'Title/Position' },
          { id: '1d', type: 'fill_field', label: 'Call Sign', field_label: 'Call Sign' },
          { id: '1e', type: 'fill_field', label: 'Type of Aircraft', field_label: 'Aircraft Type' },
          { id: '1f', type: 'fill_field', label: 'ETA', field_label: 'ETA' },
          { id: '1g', type: 'fill_field', label: 'ETD', field_label: 'ETD' },
          { id: '1h', type: 'fill_field', label: 'Next Stop', field_label: 'Next Stop' },
          { id: '1i', type: 'fill_field', label: 'ETE', field_label: 'ETE' },
          { id: '1j', type: 'fill_field', label: 'Reason for Visit', field_label: 'Reason' },
        ],
      },
      {
        id: '2', type: 'notify_agencies',
        label: 'Pass all information to the following agencies (Request initials):',
        agencies: ['AFM', 'AAFM', 'AOM', 'Command Post', 'Public Affairs (x5576)', 'Transient Alert (x5640)', 'BDOC (x4673)', 'Transportation (x3855)'],
      },
      { id: '3', type: 'checkbox', label: 'Request 15 mile out call from Tower.' },
      {
        id: '4', type: 'checkbox',
        label: 'Advise CP once the 15 mile out call has been received from Tower.',
        note: 'The most up to date ETA will be passed to the Command Post once it is received.',
      },
      { id: '5', type: 'checkbox', label: 'Upon departure from Selfridge ANGB, complete all information in Step 1 (as applicable) and make notifications in Step 2 and notify next location via AISR departure message.' },
      { id: '6', type: 'checkbox', label: 'Log all actions/events on the AF Form 3616, Daily Record of Facility Operation.' },
    ],
    references: 'DAFMAN 13-204v2',
  },

  // ── QRC #20 ────────────────────────────────────────────────────────────
  {
    qrc_number: 20,
    title: 'Hydrazine Incident',
    steps: [
      {
        id: '1', type: 'checkbox_with_note',
        label: 'Using the Secondary Crash Net Checklist obtain as much information as possible and initiate the SCN forwarding, verbatim all information received. Ensure to get and pass wind direction and speed.',
        note: 'If notification was not received from Tower, notify them',
        sub_steps: [
          { id: '1a', type: 'checkbox', label: 'Make an announcement on the Ground frequency (138.30) to advise all personnel of the hazard.' },
        ],
      },
      {
        id: '2', type: 'checkbox', label: 'Initiate other QRC\'s/checklists which apply to the emergency. (Facility Evac, NOTAM, etc.)',
        sub_steps: [
          { id: '2a', type: 'conditional', label: 'IFE/GE — Use QRC #1', cross_ref_qrc: 1 },
          { id: '2b', type: 'conditional', label: 'Hung Ordnance/Hot Brakes — Use QRC #5', cross_ref_qrc: 5 },
        ],
      },
      {
        id: '3', type: 'checkbox',
        label: 'Perform an airfield check. Report airfield conditions and closed/suspended surfaces. WARNING: ALWAYS REMAIN UPWIND OF ACFT. DO NOT GET NEAR UNTIL FD HAS DEEMED IT SAFE.',
        sub_steps: [
          { id: '3a', type: 'checkbox', label: 'Ensure Security Forces establishes a 300ft cordon, unless otherwise directed by the Incident Commander.' },
        ],
      },
      {
        id: '4', type: 'checkbox', label: 'Issue NOTAMs for closed surfaces and runway suspensions that last longer than 1 hour.',
        sub_steps: [
          { id: '4a', type: 'checkbox', label: 'Plot grid coordinates for cordon if applicable. Determine if runways, taxiways or ramps are affected. If so, process a NOTAM to close affected areas.' },
        ],
      },
      { id: '5', type: 'checkbox', label: 'Contact the AFM / DAFM or AMOM and brief on the situation and all actions taken.' },
      {
        id: '6', type: 'checkbox_with_note',
        label: 'Activate the SCN as necessary to relay evolving emergency information.',
        note: 'Log time, initials and information relayed',
      },
      { id: '7', type: 'checkbox', label: 'Activate SCN with termination of emergency.' },
      { id: '8', type: 'checkbox', label: 'Cancel NOTAMs as applicable.' },
      { id: '9', type: 'checkbox', label: 'Log all actions/events on AF Form 3616, Daily Record of Facility Operation.' },
    ],
    references: 'DAFMAN 13-204v2, AFMAN 91-201, AFI 91-202',
    has_scn_form: true,
    scn_fields: {
      fields: [
        { key: 'pcas_activation_time', label: 'PCAS Activation Time (Z)', type: 'text' },
        { key: 'pcas_tower_initials', label: 'Tower Initials', type: 'text' },
        { key: 'scn_activation_time', label: 'SCN Activation Time (Z)', type: 'text' },
        { key: 'scn_termination_time', label: 'SCN Termination Time (Z)', type: 'text' },
        { key: 'am_initials', label: 'AM Initials', type: 'text' },
        { key: 'call_sign', label: 'Call Sign', type: 'text' },
        { key: 'type_of_aircraft', label: 'Type of Aircraft', type: 'text' },
        { key: 'nature_of_emergency', label: 'Nature of Emergency', type: 'textarea' },
        { key: 'eta', label: 'ETA', type: 'text' },
        { key: 'landing_runway', label: 'Landing Runway', type: 'text' },
        { key: 'pob', label: 'POB (Persons on Board)', type: 'text' },
        { key: 'fuel_on_board', label: 'Fuel on Board', type: 'text' },
        { key: 'current_winds', label: 'Current Winds', type: 'text' },
        { key: 'location_grid', label: 'Location/Grid Coordinates', type: 'text' },
        { key: 'ordnance_type', label: 'Ordnance/Hazardous Cargo — Type', type: 'text' },
        { key: 'ordnance_quantity', label: 'Ordnance/Hazardous Cargo — Quantity', type: 'text' },
        { key: 'ordnance_new', label: 'Net Explosive Weight', type: 'text' },
        { key: 'remarks', label: 'Remarks', type: 'textarea' },
        { key: 'bwc', label: 'BWC', type: 'text' },
        { key: 'rsc', label: 'RSC', type: 'text' },
      ],
    },
  },

  // ── QRC #21 ────────────────────────────────────────────────────────────
  {
    qrc_number: 21,
    title: 'Emergency Locator Transmitter (ELT)',
    steps: [
      {
        id: '1', type: 'notify_agencies',
        label: 'Notify the following agencies that an ELT has been detected on 243.0 / 121.5:',
        agencies: ['Command Post', 'MOCC', 'Transient Alert', 'Flying Units'],
      },
      {
        id: '2', type: 'notify_agencies',
        label: 'Notify the following when the source is found or ELT has terminated:',
        agencies: ['Command Post', 'MOCC', 'Transient Alert', 'METRO (413-593-5543)'],
      },
      { id: '3', type: 'checkbox', label: 'Log all actions/events on the AF Form 3616, Daily Record of Facility Operation.' },
    ],
    references: 'DAFMAN 13-204v2, FAAO 7110.65',
  },

  // ── QRC #22 ────────────────────────────────────────────────────────────
  {
    qrc_number: 22,
    title: 'Pyrotechnics Use',
    steps: [
      {
        id: '1', type: 'notify_agencies',
        label: 'Notify the following agencies prior to/after employing pyrotechnic devices:',
        agencies: ['Tower', 'Security Forces'],
        note: 'Record Start Time, Tower Initials, SF Initials / Finish Time, Tower Initials, SF Initials',
      },
      {
        id: '2', type: 'notify_agencies',
        label: 'Notify the following if a mishap or accident occurs:',
        agencies: ['Ambulance (911)', 'Safety', 'Fire Department (ext 4103)', 'AFM', 'Command Post'],
      },
      { id: '3', type: 'checkbox', label: 'Complete Expenditure paperwork.' },
      { id: '4', type: 'checkbox', label: 'Log all actions/events on AF Form 3616, Daily Record of Facility Operation.' },
    ],
    references: 'DAFMAN 13-204v2, AFMAN 91-201',
  },

  // ── QRC #23 ────────────────────────────────────────────────────────────
  {
    qrc_number: 23,
    title: 'Customs/Agriculture',
    notes: 'The Regulated Trash container is located between Building 50 & Hangar 5, just East of the gate. Avflight Lansing (trashpickup@avflight.com) removes the trash. SFS oversees the pickup schedule.',
    steps: [
      { id: '1', type: 'checkbox', label: 'Before PPR is issued, call SF X5081 or X4673 to make arrangements for Customs/Agriculture.' },
      {
        id: '2', type: 'fill_field',
        label: 'Provide SF with the following information:',
        field_label: 'Customs Details',
        sub_steps: [
          { id: '2a', type: 'fill_field', label: 'Date/Time', field_label: 'Date/Time' },
          { id: '2b', type: 'fill_field', label: '# of PAX and Crew (# of Military & # of Civilians)', field_label: 'Personnel Count' },
          { id: '2c', type: 'fill_field', label: 'Countries Aircraft Visited', field_label: 'Countries Visited' },
        ],
        note: 'Security Forces will determine if they or Customs and Border Patrol will perform customs',
      },
      { id: '3', type: 'checkbox', label: 'Log all actions/events on the AF Form 3616, Daily Record of Facility Operations.' },
    ],
    references: 'DAFMAN 13-204v2, AFMAN 91-201',
  },

  // ── QRC #24 ────────────────────────────────────────────────────────────
  {
    qrc_number: 24,
    title: 'Civil/Foreign Aircraft Inbounds',
    notes: 'Civil aircraft inbound to Selfridge must have an approved Civil Aircraft Landing Permit (DD Form 2401) on board to land, plus a PPR number. An emergency landing does not require a Landing Permit or PPR. Civilian aircraft may conduct practice approaches but may only execute a low approach unless previously approved to land IAW AFI 10-1001. Foreign aircraft must have an Aircraft Landing Authorization Number (ALAN) at least 3 business days before intended use (Exception: emergency landing), plus a PPR number.',
    steps: [
      {
        id: '1', type: 'fill_field',
        label: 'Record aircraft authorization information:',
        field_label: 'Authorization Details',
        sub_steps: [
          { id: '1a', type: 'fill_field', label: 'PPR Number', field_label: 'PPR Number' },
          { id: '1b', type: 'fill_field', label: 'Aircraft Landing Authorization Number (ALAN) — Foreign aircraft only', field_label: 'ALAN' },
        ],
      },
      { id: '2', type: 'checkbox', label: 'Faxes/emails involving civil or foreign aircraft will be given to the Airfield Manager or Contract Manager as soon as possible.' },
      { id: '3', type: 'checkbox', label: 'Log all actions/events on the AF Form 3616, Daily Record of Facility Operation.' },
    ],
    references: 'DAFMAN 13-204v2, AFI 48-307v1',
  },

  // ── QRC #25 ────────────────────────────────────────────────────────────
  {
    qrc_number: 25,
    title: 'Mishap Notification',
    notes: 'Refer all questions to public affairs. Do not disclose information related to aircraft mishaps/incidents. Personnel will not discuss the incident beyond what is necessary to accomplish duties. Complete QRC #2 Aircraft Mishap for Emergency Response.',
    steps: [
      {
        id: '1', type: 'fill_field',
        label: 'Record the following information for the time of the mishap in the AF Form 3616:',
        field_label: 'Mishap Conditions',
        sub_steps: [
          { id: '1a', type: 'fill_field', label: 'Runway involved', field_label: 'Runway' },
          { id: '1b', type: 'fill_field', label: 'Runway Surface Condition', field_label: 'RSC' },
          { id: '1c', type: 'fill_field', label: 'ATCALS status', field_label: 'ATCALS Status' },
          { id: '1d', type: 'fill_field', label: 'Airfield lighting status', field_label: 'Lighting Status' },
          { id: '1e', type: 'fill_field', label: 'Bird Watch Condition', field_label: 'BWC' },
        ],
      },
      {
        id: '2', type: 'checkbox',
        label: 'Contact the Incident Commander and plot mishap location, cordon, entry control point, safe route, known hazards and other relevant information on crash grid maps.',
        sub_steps: [
          { id: '2a', type: 'checkbox', label: 'Relay ECP/cordon information over SCN.' },
          { id: '2b', type: 'conditional', label: 'If cordon affects Building 50, initiate building evacuation.', cross_ref_qrc: 6 },
          { id: '2c', type: 'checkbox', label: 'Close surface areas within cordon.' },
          { id: '2d', type: 'checkbox', label: 'When a facility, service, or RAWS is, or is suspected of being, involved in an aircraft mishap ATCALS must be notified (x5668) to record/document equipment performance and alignments.' },
        ],
      },
      { id: '3', type: 'checkbox', label: 'Print current NOTAMs and send to Flight Safety as needed.' },
      {
        id: '4', type: 'fill_field',
        label: 'Obtain mishap aircraft information:',
        field_label: 'Mishap Aircraft Info',
        sub_steps: [
          { id: '4a', type: 'fill_field', label: 'Aircraft call sign and tail number', field_label: 'Callsign/Tail#' },
          { id: '4b', type: 'fill_field', label: 'Departure base', field_label: 'Departure Base' },
          { id: '4c', type: 'fill_field', label: 'Home station or organization', field_label: 'Home Station/Org' },
          { id: '4d', type: 'fill_field', label: 'Name and rank of crew members', field_label: 'Crew Members' },
          { id: '4e', type: 'fill_field', label: 'Number of personnel on board', field_label: 'POB' },
        ],
      },
      { id: '5', type: 'notify_agencies', label: 'Notify:', agencies: ['AOF/CC', 'AFM', 'DAFM', 'AMOM'] },
      {
        id: '6', type: 'checkbox',
        label: 'Safeguard and print/make copies of the following documents:',
        sub_steps: [
          { id: '6a', type: 'checkbox', label: 'Flight Plan (Passenger Manifest, Weight and Balance if applicable).' },
          { id: '6b', type: 'checkbox', label: 'AF Form 3616, Daily Record of Facility Operation.' },
          { id: '6c', type: 'checkbox', label: 'Local airfield advisory information.' },
          { id: '6d', type: 'checkbox', label: 'Any other forms that pertain to the flight.' },
        ],
      },
    ],
    references: 'DAFMAN 13-204v2, DAFMAN 13-204v1',
  },
]
