// Demo data matching the Airfield_OPS_Unified_Prototype.jsx
// Used for UI rendering until Supabase is connected (Step 9)

export const DEMO_DISCREPANCIES = [
  {
    id: 'demo-001', display_id: 'D-2026-0042', type: 'pavement', severity: 'critical' as const,
    status: 'open' as const, current_status: 'submitted_to_ces' as const,
    title: 'Pavement spall TWY A intersection',
    description: '12x18 inch spall, 2 inch depth. FOD potential from loose aggregate.',
    location_text: 'TWY', assigned_shop: 'CE Pavements', reported_by: 'demo-user',
    work_order_number: 'WO-2026-0038',
    photo_count: 2, linked_notam_id: null, created_at: new Date(Date.now() - 9 * 86400000).toISOString(),
    days_open: 9,
  },
  {
    id: 'demo-002', display_id: 'D-2026-0041', type: 'lighting', severity: 'critical' as const,
    status: 'open' as const, current_status: 'awaiting_action_by_ces' as const,
    title: 'MALSR RWY 01 Stations 7&8 OTS',
    description: 'MALSR stations 7 and 8 inoperative. Approach lighting degraded. Parts ETA Monday.',
    location_text: 'RWY', assigned_shop: 'CE Electrical', reported_by: 'demo-user',
    work_order_number: 'WO-2026-0037',
    photo_count: 3, linked_notam_id: 'demo-notam-1', created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    days_open: 4,
  },
  {
    id: 'demo-003', display_id: 'D-2026-0039', type: 'marking', severity: 'medium' as const,
    status: 'open' as const, current_status: 'submitted_to_afm' as const,
    title: 'TDZ marking faded RWY 01',
    description: 'Touchdown zone markings below minimum reflectivity per UFC 3-260-01.',
    location_text: 'RWY', assigned_shop: 'CE Pavements', reported_by: 'demo-user',
    work_order_number: null,
    photo_count: 1, linked_notam_id: null, created_at: new Date(Date.now() - 16 * 86400000).toISOString(),
    days_open: 16,
  },
  {
    id: 'demo-004', display_id: 'D-2026-0038', type: 'lighting', severity: 'low' as const,
    status: 'open' as const, current_status: 'submitted_to_afm' as const,
    title: 'TWY B edge light #14 lens cracked',
    description: 'Blue edge light lens cracked but illuminating. Replacement on order.',
    location_text: 'TWY', assigned_shop: 'CE Electrical', reported_by: 'demo-user',
    work_order_number: null,
    photo_count: 1, linked_notam_id: 'demo-notam-2', created_at: new Date(Date.now() - 18 * 86400000).toISOString(),
    days_open: 18,
  },
  {
    id: 'demo-005', display_id: 'D-2026-0037', type: 'drainage', severity: 'medium' as const,
    status: 'completed' as const, current_status: 'work_completed_awaiting_verification' as const,
    title: 'Standing water near TWY C holdshort',
    description: 'Drain inlet cleared. Monitoring for recurrence.',
    location_text: 'TWY', assigned_shop: 'CE Grounds', reported_by: 'demo-user',
    work_order_number: null,
    photo_count: 2, linked_notam_id: null, created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
    days_open: 0,
  },
  {
    id: 'demo-006', display_id: 'D-2026-0036', type: 'signage', severity: 'low' as const,
    status: 'completed' as const, current_status: 'work_completed_awaiting_verification' as const,
    title: 'Runway distance remaining sign tilted',
    description: 'Sign post base re-secured and leveled.',
    location_text: 'RWY', assigned_shop: 'CE Structures', reported_by: 'demo-user',
    work_order_number: null,
    photo_count: 1, linked_notam_id: null, created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    days_open: 0,
  },
]

export const DEMO_NOTAMS = [
  {
    id: 'demo-notam-1', notam_number: '01/003', source: 'faa' as const, status: 'active' as const,
    notam_type: 'Lighting', title: 'MALSR RWY 01 STA 7-8 OTS',
    full_text: 'KMTC MALSR RWY 01 STATIONS 7 AND 8 OUT OF SERVICE.',
    effective_start: '2026-02-03T00:00:00Z', effective_end: '2026-02-15T00:00:00Z',
    linked_discrepancy_id: 'demo-002', created_at: '2026-02-03T00:00:00Z',
  },
  {
    id: 'demo-notam-2', notam_number: '01/002', source: 'faa' as const, status: 'active' as const,
    notam_type: 'Lighting', title: 'TWY B EDGE LGT 14 REDUCED INTST',
    full_text: 'KMTC TWY B EDGE LIGHT 14 REDUCED INTENSITY.',
    effective_start: '2026-01-21T00:00:00Z', effective_end: '2026-03-01T00:00:00Z',
    linked_discrepancy_id: 'demo-004', created_at: '2026-01-21T00:00:00Z',
  },
  {
    id: 'demo-notam-3', notam_number: 'N-2026-0088', source: 'local' as const, status: 'active' as const,
    notam_type: 'Construction', title: 'TWY A/B REPAIR AREA',
    full_text: 'CAUTION: PAVEMENT REPAIR IN PROGRESS TWY A/B INTERSECTION.',
    effective_start: '2026-02-01T00:00:00Z', effective_end: '2026-02-28T00:00:00Z',
    linked_discrepancy_id: null, created_at: '2026-02-01T00:00:00Z',
  },
  {
    id: 'demo-notam-4', notam_number: '01/001', source: 'faa' as const, status: 'expired' as const,
    notam_type: 'NAVAID', title: 'ILS RWY 01 GP OTS FOR MAINT',
    full_text: 'KMTC ILS RWY 01 GLIDEPATH OUT OF SERVICE.',
    effective_start: '2026-01-10T00:00:00Z', effective_end: '2026-01-12T00:00:00Z',
    linked_discrepancy_id: null, created_at: '2026-01-10T00:00:00Z',
  },
]

export const DEMO_CHECKS = [
  {
    id: 'demo-check-1', display_id: 'AC-0098', check_type: 'fod' as const,
    areas: ['RWY 01/19', 'TWY A', 'TWY B'],
    data: {},
    completed_by: 'TSgt Williams', completed_at: new Date().toISOString(),
    photo_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-check-2', display_id: 'AC-0097', check_type: 'bash' as const,
    areas: ['Entire Airfield'],
    data: { condition_code: 'LOW', species_observed: 'Canada geese (4, grazing N side), Red-tailed hawk (1, perched)' },
    completed_by: 'MSgt Proctor', completed_at: new Date().toISOString(),
    photo_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-check-3', display_id: 'AC-0096', check_type: 'rcr' as const,
    areas: ['RWY 01/19'],
    data: { rcr_value: '64', condition_type: 'Dry' },
    completed_by: 'SrA Martinez', completed_at: new Date(Date.now() - 86400000).toISOString(),
    photo_count: 0, created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'demo-check-4', display_id: 'AC-0095', check_type: 'rsc' as const,
    areas: ['RWY 01/19'],
    data: { condition: 'Wet' },
    completed_by: 'TSgt Williams', completed_at: '2026-02-05T06:30:00Z',
    photo_count: 0, created_at: '2026-02-05T06:30:00Z', updated_at: '2026-02-05T06:30:00Z',
  },
  {
    id: 'demo-check-5', display_id: 'AC-0094', check_type: 'ife' as const,
    areas: ['RWY 01/19'],
    data: { aircraft_type: 'KC-135R', callsign: 'BOLT 31', nature: 'Hydraulic failure', actions: ['Notified ATC / Tower', 'Activated crash phone / primary crash net', 'Coordinated with Fire Department / ARFF'], agencies_notified: ['SOF', 'Fire Chief / ARFF', 'ATC / Tower', 'Command Post'] },
    completed_by: 'MSgt Proctor', completed_at: '2026-02-04T14:22:00Z',
    photo_count: 0, created_at: '2026-02-04T14:22:00Z', updated_at: '2026-02-04T14:22:00Z',
  },
  {
    id: 'demo-check-6', display_id: 'AC-0093', check_type: 'heavy_aircraft' as const,
    areas: ['RWY 01/19', 'TWY A', 'Apron/Ramp'],
    data: { aircraft_type: 'C-17A Globemaster III' },
    completed_by: 'MSgt Proctor', completed_at: '2026-02-03T18:45:00Z',
    photo_count: 0, created_at: '2026-02-03T18:45:00Z', updated_at: '2026-02-03T18:45:00Z',
  },
  {
    id: 'demo-check-7', display_id: 'AC-0092', check_type: 'ground_emergency' as const,
    areas: ['Apron/Ramp'],
    data: { aircraft_type: 'A-10C', nature: 'Hot brakes', actions: ['Notified ATC / Tower', 'Coordinated with Fire Department / ARFF'], agencies_notified: ['Fire Chief / ARFF', 'MOC', 'Wing Safety'] },
    completed_by: 'TSgt Williams', completed_at: '2026-02-02T11:15:00Z',
    photo_count: 0, created_at: '2026-02-02T11:15:00Z', updated_at: '2026-02-02T11:15:00Z',
  },
]

export const DEMO_CHECK_COMMENTS = [
  {
    id: 'demo-cc-1', check_id: 'demo-check-1', comment: 'Metal bolt (1/4") found near TWY A intersection — disposed.',
    user_name: 'TSgt Williams', created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'demo-cc-2', check_id: 'demo-check-1', comment: 'Rubber fragment (3") found midfield — disposed. All areas clear.',
    user_name: 'TSgt Williams', created_at: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 'demo-cc-3', check_id: 'demo-check-5', comment: 'Aircraft landed safely RWY 01. Post-landing inspection complete. Runway released to ATC.',
    user_name: 'MSgt Proctor', created_at: '2026-02-04T15:04:00Z',
  },
]
