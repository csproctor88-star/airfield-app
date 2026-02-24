-- Seed Bradley International Airport (KBDL) as the third base installation.
-- Data sourced from FAA AIP, FAA NFDC 5010, and publicly available aviation
-- references. NOT FOR NAVIGATION USE.
-- Base admin should verify all values against current FAA Chart Supplement
-- before operational use, particularly ILS frequencies and taxiway inventory.
--
-- NOTE: KBDL was already added via the in-app installation UI, so a bases row
-- with icao='KBDL' already exists. This migration updates that row in place
-- and uses its existing UUID for all child inserts.

-- ═══════════════════════════════════════════════════════════════
-- 1. Update the existing base record (added via settings UI)
-- ═══════════════════════════════════════════════════════════════
UPDATE bases SET
  name          = 'Bradley International Airport',
  unit          = '103rd Airlift Wing',
  majcom        = 'Connecticut Air National Guard',
  location      = 'Windsor Locks, Connecticut',
  elevation_msl = 173,
  timezone      = 'America/New_York',
  ce_shops      = ARRAY[
    'CE Pavements',
    'CE Electrical',
    'CE Grounds',
    'CE Structures',
    'CE HVAC',
    'CES Engineering',
    'Airfield Management'
  ]
WHERE icao = 'KBDL';

-- Child rows (base_runways, base_navaids, base_areas) have ON DELETE CASCADE,
-- so we can safely delete and re-insert them below.
DELETE FROM base_runways WHERE base_id = (SELECT id FROM bases WHERE icao = 'KBDL');
DELETE FROM base_navaids WHERE base_id = (SELECT id FROM bases WHERE icao = 'KBDL');
DELETE FROM base_areas   WHERE base_id = (SELECT id FROM bases WHERE icao = 'KBDL');

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
  (SELECT id FROM bases WHERE icao = 'KBDL'),
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
  (SELECT id FROM bases WHERE icao = 'KBDL'),
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
  ((SELECT id FROM bases WHERE icao = 'KBDL'), '06 Localizer',    1),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), '06 Glideslope',   2),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), '06 ILS',          3),
  -- RWY 24 — ILS identifier: I-MYQ
  ((SELECT id FROM bases WHERE icao = 'KBDL'), '24 Localizer',    4),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), '24 Glideslope',   5),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), '24 ILS',          6),
  -- RWY 33 — ILS identifier: I-IKX (108.55 MHz)
  ((SELECT id FROM bases WHERE icao = 'KBDL'), '33 Localizer',    7),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), '33 Glideslope',   8),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), '33 ILS',          9);

-- ── NAVAID dashboard statuses ──
-- The dashboard reads from navaid_statuses (not base_navaids), so each
-- NAVAID needs a corresponding status row to appear on the home page.
DELETE FROM navaid_statuses WHERE base_id = (SELECT id FROM bases WHERE icao = 'KBDL');
INSERT INTO navaid_statuses (base_id, navaid_name, status) VALUES
  ((SELECT id FROM bases WHERE icao = 'KBDL'), '06 Localizer',    'green'),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), '06 Glideslope',   'green'),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), '06 ILS',          'green'),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), '24 Localizer',    'green'),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), '24 Glideslope',   'green'),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), '24 ILS',          'green'),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), '33 Localizer',    'green'),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), '33 Glideslope',   'green'),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), '33 ILS',          'green');

-- ═══════════════════════════════════════════════════════════════
-- 4. Airfield areas
--    Taxiways: A, B, C, D, E, F, H, K per FAA airport diagram.
--    Aprons: Terminal, Cargo, ANG (103rd Airlift Wing).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO base_areas (base_id, area_name, sort_order) VALUES
  ((SELECT id FROM bases WHERE icao = 'KBDL'), 'Entire Airfield',    0),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), 'RWY 06/24',          1),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), 'RWY 15/33',          2),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), 'Terminal Apron',     3),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), 'Cargo Apron',        4),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), 'ANG Apron',          5),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), 'TWY A',              6),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), 'TWY B',              7),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), 'TWY C',              8),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), 'TWY D',              9),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), 'TWY E',             10),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), 'TWY F',             11),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), 'TWY H',             12),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), 'TWY K',             13),
  ((SELECT id FROM bases WHERE icao = 'KBDL'), 'Flight Line',       14);

-- ═══════════════════════════════════════════════════════════════
-- 5. Airfield status
--    Seed an initial status row so the dashboard works immediately.
--    Sets RWY 06 as the default active runway with per-runway JSONB.
-- ═══════════════════════════════════════════════════════════════
INSERT INTO airfield_status (base_id, active_runway, runway_status, runway_statuses)
VALUES (
  (SELECT id FROM bases WHERE icao = 'KBDL'),
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
