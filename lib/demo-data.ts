// Demo data matching the Airfield_OPS_Unified_Prototype.jsx
// Used for UI rendering until Supabase is connected (Step 9)

export const DEMO_DISCREPANCIES = [
  {
    id: 'demo-001', display_id: 'D-2026-0042', type: 'pavement', severity: 'critical' as const,
    status: 'submitted_to_afm' as const, title: 'Pavement spall TWY A intersection',
    description: '12x18 inch spall, 2 inch depth. FOD potential from loose aggregate.',
    location_text: 'TWY A/B', assigned_shop: 'CE Pavements', reported_by: 'demo-user',
    work_order_number: 'WO-2026-0038',
    photo_count: 2, linked_notam_id: null, created_at: new Date(Date.now() - 9 * 86400000).toISOString(),
    days_open: 9,
  },
  {
    id: 'demo-002', display_id: 'D-2026-0041', type: 'lighting', severity: 'critical' as const,
    status: 'in_progress' as const, title: 'MALSR RWY 01 Stations 7&8 OTS',
    description: 'MALSR stations 7 and 8 inoperative. Approach lighting degraded. Parts ETA Monday.',
    location_text: 'RWY 01 approach', assigned_shop: 'CE Electrical', reported_by: 'demo-user',
    work_order_number: 'WO-2026-0037',
    photo_count: 3, linked_notam_id: 'demo-notam-1', created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    days_open: 4,
  },
  {
    id: 'demo-003', display_id: 'D-2026-0039', type: 'marking', severity: 'medium' as const,
    status: 'open' as const, title: 'TDZ marking faded RWY 01',
    description: 'Touchdown zone markings below minimum reflectivity per UFC 3-260-01.',
    location_text: 'RWY 01 TDZ', assigned_shop: 'CE Pavements', reported_by: 'demo-user',
    work_order_number: null,
    photo_count: 1, linked_notam_id: null, created_at: new Date(Date.now() - 16 * 86400000).toISOString(),
    days_open: 16,
  },
  {
    id: 'demo-004', display_id: 'D-2026-0038', type: 'lighting', severity: 'low' as const,
    status: 'submitted_to_afm' as const, title: 'TWY B edge light #14 lens cracked',
    description: 'Blue edge light lens cracked but illuminating. Replacement on order.',
    location_text: 'TWY B', assigned_shop: 'CE Electrical', reported_by: 'demo-user',
    work_order_number: null,
    photo_count: 1, linked_notam_id: 'demo-notam-2', created_at: new Date(Date.now() - 18 * 86400000).toISOString(),
    days_open: 18,
  },
  {
    id: 'demo-005', display_id: 'D-2026-0037', type: 'drainage', severity: 'medium' as const,
    status: 'resolved' as const, title: 'Standing water near TWY C holdshort',
    description: 'Drain inlet cleared. Monitoring for recurrence.',
    location_text: 'TWY C', assigned_shop: 'CE Grounds', reported_by: 'demo-user',
    work_order_number: null,
    photo_count: 2, linked_notam_id: null, created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
    days_open: 0,
  },
  {
    id: 'demo-006', display_id: 'D-2026-0036', type: 'signage', severity: 'low' as const,
    status: 'closed' as const, title: 'Runway distance remaining sign tilted',
    description: 'Sign post base re-secured and leveled.',
    location_text: 'RWY 01 5000ft', assigned_shop: 'CE Structures', reported_by: 'demo-user',
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
    check_date: new Date().toISOString(), performed_by: 'TSgt Williams',
    data: { route: 'RWY 01/19', items_found: [{ description: 'Metal bolt (1/4") near TWY A', location: 'TWY A', disposed: true }, { description: 'Rubber fragment (3") midfield', location: 'Midfield', disposed: true }], clear: false },
    notes: 'Weather: Clear 28°F 310/08.', area: 'RWY 01/19', result: '2 FOUND',
  },
  {
    id: 'demo-check-2', display_id: 'AC-0097', check_type: 'bash' as const,
    check_date: new Date().toISOString(), performed_by: 'MSgt Proctor',
    data: { condition_code: 'LOW', species_observed: 'Canada geese (4, grazing N side), Red-tailed hawk (1, perched)', mitigation_actions: 'Vehicle horn hazed geese', habitat_attractants: '' },
    notes: null, area: 'Full Airfield', result: 'LOW',
  },
  {
    id: 'demo-check-3', display_id: 'AC-0096', check_type: 'rcr' as const,
    check_date: new Date(Date.now() - 86400000).toISOString(), performed_by: 'SrA Martinez',
    data: { equipment: 'RT3 Flight', runway: '01/19', readings: { rollout: 66, midpoint: 60, departure: 66 }, surface_condition: 'Dry', temperature_f: 28, rt3_imported: false },
    notes: 'Source: rt3grip.com.', area: 'RWY 01/19', result: 'AVG Mu: 64',
  },
  {
    id: 'demo-check-4', display_id: 'AC-0095', check_type: 'rsc' as const,
    check_date: '2026-02-05T06:30:00Z', performed_by: 'TSgt Williams',
    data: { runway: '01/19', contaminant: 'Frost', depth_inches: 0, coverage_percent: 40, treatment_applied: 'KAc', braking_action: 'Good' },
    notes: 'Cleared by 0730L.', area: 'RWY 01/19', result: 'Frost',
  },
  {
    id: 'demo-check-5', display_id: 'AC-0094', check_type: 'emergency' as const,
    check_date: '2026-02-04T14:22:00Z', performed_by: 'MSgt Proctor',
    data: { emergency_type: 'IFE', aircraft_type: 'KC-135R', callsign: 'BOLT 31', runway: '01', nature: 'Hydraulic failure', actions: [], agencies_notified: [], start_time: '2026-02-04T14:22:00Z', end_time: '2026-02-04T15:04:00Z', duration_minutes: 42 },
    notes: 'All AM actions completed. Landed safely. Runway inspected and released.', area: 'RWY 01', result: 'IFE',
  },
]
