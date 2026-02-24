-- Seed Bradley International Airport (KBDL) as the third base installation.
-- Data sourced from FAA AIP, FAA NFDC 5010, and publicly available aviation
-- references. NOT FOR NAVIGATION USE.
-- Base admin should verify all values against current FAA Chart Supplement
-- before operational use, particularly ILS frequencies and taxiway inventory.

-- ═══════════════════════════════════════════════════════════════
-- 1. Base record
-- ═══════════════════════════════════════════════════════════════
-- INSERT the base row if it doesn't exist yet, otherwise UPDATE in place.
-- Many tables (airfield_status, inspections, etc.) reference bases(id)
-- WITHOUT ON DELETE CASCADE, so we cannot delete-and-reinsert.
INSERT INTO bases (id, name, icao, unit, majcom, location, elevation_msl, timezone, ce_shops)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'Bradley International Airport',
  'KBDL',
  '103rd Airlift Wing',
  'Connecticut Air National Guard',
  'Windsor Locks, Connecticut',
  173,
  'America/New_York',
  ARRAY[
    'CE Pavements',
    'CE Electrical',
    'CE Grounds',
    'CE Structures',
    'CE HVAC',
    'CES Engineering',
    'Airfield Management'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  name          = EXCLUDED.name,
  icao          = EXCLUDED.icao,
  unit          = EXCLUDED.unit,
  majcom        = EXCLUDED.majcom,
  location      = EXCLUDED.location,
  elevation_msl = EXCLUDED.elevation_msl,
  timezone      = EXCLUDED.timezone,
  ce_shops      = EXCLUDED.ce_shops;

-- Child rows (base_runways, base_navaids, base_areas) have ON DELETE CASCADE,
-- so we can safely delete and re-insert them below.
DELETE FROM base_runways WHERE base_id = '00000000-0000-0000-0000-000000000003';
DELETE FROM base_navaids WHERE base_id = '00000000-0000-0000-0000-000000000003';
DELETE FROM base_areas   WHERE base_id = '00000000-0000-0000-0000-000000000003';

-- ═══════════════════════════════════════════════════════════════
-- 2. Runways
--    Bradley has two runways: 06/24 (primary) and 15/33.
--    True headings per FAA AIP; threshold coords from FAA 5010 data.
--    end1 = low-numbered end; end2 = high-numbered end.
-- ═══════════════════════════════════════════════════════════════

-- Runway 06/24 — 9,510 × 200 ft, Asphalt, PCN per FAA 5010
-- 06: threshold elev 173.0 ft. ALSF-2 approach lighting.
--     ILS: I-BDL (111.1 MHz)
-- 24: threshold elev 160.9 ft. MALSR approach lighting.
--     ILS: I-MYQ
INSERT INTO base_runways (
  base_id, runway_id, length_ft, width_ft, surface, true_heading,
  end1_designator, end1_latitude, end1_longitude, end1_heading, end1_approach_lighting, end1_elevation_msl,
  end2_designator, end2_latitude, end2_longitude, end2_heading, end2_approach_lighting, end2_elevation_msl
)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '06/24', 9510, 200, 'Asphalt', 44,
  '06', 41.9320, -72.6966, 44, 'ALSF-2', 173.0,
  '24', 41.9507, -72.6721, 224, 'MALSR', 160.9
);

-- Runway 15/33 — 6,847 × 150 ft, Asphalt
-- 15: threshold elev 168.8 ft. REIL approach lighting.
--     No ILS.
-- 33: threshold elev 168.5 ft. MALSF approach lighting.
--     ILS: I-IKX (108.55 MHz)
INSERT INTO base_runways (
  base_id, runway_id, length_ft, width_ft, surface, true_heading,
  end1_designator, end1_latitude, end1_longitude, end1_heading, end1_approach_lighting, end1_elevation_msl,
  end2_designator, end2_latitude, end2_longitude, end2_heading, end2_approach_lighting, end2_elevation_msl
)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '15/33', 6847, 150, 'Asphalt', 136,
  '15', 41.9424, -72.6933, 136, 'REIL', 168.8,
  '33', 41.9293, -72.6753, 316, 'MALSF', 168.5
);

-- ═══════════════════════════════════════════════════════════════
-- 3. NAVAIDs
--    3 ILS-equipped runway ends (06, 24, 33), each with Localizer +
--    Glideslope + ILS entries. RWY 15 has no ILS.
--    ILS RWY 06: I-BDL (111.1 MHz)
--    ILS RWY 24: I-MYQ
--    ILS RWY 33: I-IKX (108.55 MHz)
-- ═══════════════════════════════════════════════════════════════
INSERT INTO base_navaids (base_id, navaid_name, sort_order) VALUES
  -- RWY 06 — ILS identifier: I-BDL (111.1 MHz)
  ('00000000-0000-0000-0000-000000000003', '06 Localizer',    1),
  ('00000000-0000-0000-0000-000000000003', '06 Glideslope',   2),
  ('00000000-0000-0000-0000-000000000003', '06 ILS',          3),
  -- RWY 24 — ILS identifier: I-MYQ
  ('00000000-0000-0000-0000-000000000003', '24 Localizer',    4),
  ('00000000-0000-0000-0000-000000000003', '24 Glideslope',   5),
  ('00000000-0000-0000-0000-000000000003', '24 ILS',          6),
  -- RWY 33 — ILS identifier: I-IKX (108.55 MHz)
  ('00000000-0000-0000-0000-000000000003', '33 Localizer',    7),
  ('00000000-0000-0000-0000-000000000003', '33 Glideslope',   8),
  ('00000000-0000-0000-0000-000000000003', '33 ILS',          9);

-- ═══════════════════════════════════════════════════════════════
-- 4. Airfield areas
--    Taxiways: A, B, C, D, E, F, H, K per FAA airport diagram.
--    Aprons: Terminal, Cargo, ANG (103rd Airlift Wing).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO base_areas (base_id, area_name, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000003', 'Entire Airfield',    0),
  ('00000000-0000-0000-0000-000000000003', 'RWY 06/24',          1),
  ('00000000-0000-0000-0000-000000000003', 'RWY 15/33',          2),
  ('00000000-0000-0000-0000-000000000003', 'Terminal Apron',     3),
  ('00000000-0000-0000-0000-000000000003', 'Cargo Apron',        4),
  ('00000000-0000-0000-0000-000000000003', 'ANG Apron',          5),
  ('00000000-0000-0000-0000-000000000003', 'TWY A',              6),
  ('00000000-0000-0000-0000-000000000003', 'TWY B',              7),
  ('00000000-0000-0000-0000-000000000003', 'TWY C',              8),
  ('00000000-0000-0000-0000-000000000003', 'TWY D',              9),
  ('00000000-0000-0000-0000-000000000003', 'TWY E',             10),
  ('00000000-0000-0000-0000-000000000003', 'TWY F',             11),
  ('00000000-0000-0000-0000-000000000003', 'TWY H',             12),
  ('00000000-0000-0000-0000-000000000003', 'TWY K',             13),
  ('00000000-0000-0000-0000-000000000003', 'Flight Line',       14);

-- ═══════════════════════════════════════════════════════════════
-- 5. Airfield status
--    Seed an initial status row so the dashboard works immediately.
--    Sets RWY 06 as the default active runway with per-runway JSONB.
-- ═══════════════════════════════════════════════════════════════
INSERT INTO airfield_status (base_id, active_runway, runway_status, runway_statuses)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '06',
  'open',
  '{
    "06/24": {"status": "open", "active_end": "06"},
    "15/33": {"status": "open", "active_end": "15"}
  }'::jsonb
)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- DATA SOURCE: Runway dimensions, threshold coordinates, and threshold
-- elevations from FAA AIP and FAA 5010 data for KBDL (Bradley International
-- Airport, Windsor Locks, CT). ILS identifiers and frequencies from FAA
-- Chart Supplement and instrument approach procedures.
-- ═══════════════════════════════════════════════════════════════
