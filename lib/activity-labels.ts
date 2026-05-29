// Shared mapping from activity_log.entity_type → friendly module label.
//
// Extracted from the Events Log page so the user-engagement panel and any
// other consumer label modules consistently. When an entity_type isn't in the
// map, moduleLabel() falls back to a title-cased version of the raw type.

export const MODULE_LABELS: Record<string, string> = {
  discrepancy: 'Discrepancy',
  check: 'Check',
  airfield_check: 'Check',
  inspection: 'Inspection',
  obstruction_evaluation: 'Obstruction Eval',
  navaid_status: 'NAVAID',
  airfield_status: 'Runway',
  weather_info: 'Weather Info',
  arff_status: 'ARFF',
  contractor: 'Personnel',
  qrc: 'QRC',
  wildlife_sighting: 'Wildlife Sighting',
  wildlife_strike: 'Wildlife Strike',
  manual: 'Logged Entry',
  parking_plan: 'Parking Plan',
  ppr_entry: 'PPR',
  acsi_inspection: 'ACSI Inspection',
  waiver: 'Waiver',
  waiver_review: 'Waiver Review',
  scn: 'SCN',
  scn_backup: 'Monthly Back-up SCN',
  field_condition: 'Field Condition',
  custom_status_board: 'Status Board',
  aep_plan: 'AEP Plan',
  aep_response_agency: 'AEP Agency',
  aep_drill: 'AEP Drill',
  sms_policy: 'SMS Policy',
  sms_hazard: 'SMS Hazard',
  sms_mitigation: 'SMS Mitigation',
  sms_spis: 'SMS SPIs',
  sms_audit: 'SMS Audit',
  sms_moc: 'SMS MOC',
  sms_safety_report: 'SMS Safety Report',
  sms_communication: 'SMS Communication',
  training_topic: 'Training Topic',
  training_record: 'Training Record',
}

/** Friendly module name for an activity_log entity_type. */
export function moduleLabel(entityType: string): string {
  return (
    MODULE_LABELS[entityType] ||
    entityType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  )
}
