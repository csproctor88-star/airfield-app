-- Seed Offutt Air Force Base (KOFF) installation.
-- Data sourced from FAA AIP effective 19 February 2026, FAA NFDC 5010, and
-- publicly available aviation references. NOT FOR NAVIGATION USE.
-- Base admin should verify all values against current FAA Chart Supplement
-- before operational use.

-- ═══════════════════════════════════════════════════════════════
-- 1. Base record
-- ═══════════════════════════════════════════════════════════════
INSERT INTO bases (name, icao, unit, majcom, location, elevation_msl, timezone, ce_shops)
SELECT
  'Offutt Air Force Base',
  'KOFF',
  '55th Wing',
  'Air Combat Command (ACC)',
  'Omaha, Nebraska',
  1048,
  'America/Chicago',
  ARRAY[
    'CE Pavements',
    'CE Electrical',
    'CE Grounds',
    'CE Structures',
    'CE HVAC',
    'CES Engineering',
    'Airfield Management'
  ]
WHERE NOT EXISTS (SELECT 1 FROM bases WHERE icao = 'KOFF');

-- Update in case the base was already added via the settings UI
UPDATE bases SET
  name          = 'Offutt Air Force Base',
  unit          = '55th Wing',
  majcom        = 'Air Combat Command (ACC)',
  location      = 'Omaha, Nebraska',
  elevation_msl = 1048,
  timezone      = 'America/Chicago',
  ce_shops      = ARRAY[
    'CE Pavements',
    'CE Electrical',
    'CE Grounds',
    'CE Structures',
    'CE HVAC',
    'CES Engineering',
    'Airfield Management'
  ]
WHERE icao = 'KOFF';

-- Child rows (base_runways, base_navaids, base_areas) have ON DELETE CASCADE,
-- so we can safely delete and re-insert them below.
DELETE FROM base_runways WHERE base_id = (SELECT id FROM bases WHERE icao = 'KOFF');
DELETE FROM base_navaids WHERE base_id = (SELECT id FROM bases WHERE icao = 'KOFF');
DELETE FROM base_areas   WHERE base_id = (SELECT id FROM bases WHERE icao = 'KOFF');

-- ═══════════════════════════════════════════════════════════════
-- 2. Runway
--    Offutt has one runway: 13/31.
--    11,703 × 150 ft, asphalt/concrete/grooved (PEM).
--    PCN 89/R/B/W/T.
--    True headings per FAA AIP; threshold coords from FAA 5010 data.
--    end1 = low-numbered end (13); end2 = high-numbered end (31).
--    Center 150 ft stressed for heavy; 75 ft edges not stressed for
--    aircraft over 100,000 lbs.
--    RWY 13: displaced threshold 1008 ft.
--    RWY 31: displaced threshold 1091 ft.
-- ═══════════════════════════════════════════════════════════════

-- Runway 13/31 — 11,703 × 150 ft, PCN 89/R/B/W/T
-- 13: threshold elev 1048.2 ft. ALSF-1 approach lighting. LOC/GS equipped. PAPI right (3.00°).
-- 31: threshold elev 971.7 ft. ALSF-1 approach lighting. ILS equipped. PAPI left (2.80°).
INSERT INTO base_runways (
  base_id, runway_id, length_ft, width_ft, surface, true_heading,
  end1_designator, end1_latitude, end1_longitude, end1_heading, end1_approach_lighting, end1_elevation_msl,
  end2_designator, end2_latitude, end2_longitude, end2_heading, end2_approach_lighting, end2_elevation_msl
)
VALUES (
  (SELECT id FROM bases WHERE icao = 'KOFF'),
  '13/31', 11703, 150, 'Asphalt/Concrete/Grooved', 129,
  '13', 41.129461, -95.924994, 129, 'ALSF-1', 1048.2,
  '31', 41.109194, -95.892044, 309, 'ALSF-1', 971.7
);

-- ═══════════════════════════════════════════════════════════════
-- 3. NAVAIDs
--    RWY 13: LOC/GS approach, PAPI (right, 3.00°)
--    RWY 31: ILS (LOC/GS) approach, PAPI (left, 2.80°)
--    Both ends: RNAV (GPS), HI-TACAN Z, TACAN Y
--    GCA (PAR) available: 290.55, 340.9, 378.8
--    VORTAC: Omaha (OVR) 116.30
-- ═══════════════════════════════════════════════════════════════
INSERT INTO base_navaids (base_id, navaid_name, sort_order) VALUES
  -- RWY 13
  ((SELECT id FROM bases WHERE icao = 'KOFF'), '13 Localizer',    1),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), '13 Glideslope',   2),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), '13 PAPI',         3),
  -- RWY 31
  ((SELECT id FROM bases WHERE icao = 'KOFF'), '31 Localizer',    4),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), '31 Glideslope',   5),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), '31 ILS',          6),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), '31 PAPI',         7),
  -- TACAN / VORTAC
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'TACAN',           8),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'GCA/PAR',         9);

-- ── NAVAID dashboard statuses ──
DELETE FROM navaid_statuses WHERE base_id = (SELECT id FROM bases WHERE icao = 'KOFF');
INSERT INTO navaid_statuses (base_id, navaid_name, status) VALUES
  ((SELECT id FROM bases WHERE icao = 'KOFF'), '13 Localizer',    'green'),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), '13 Glideslope',   'green'),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), '13 PAPI',         'green'),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), '31 Localizer',    'green'),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), '31 Glideslope',   'green'),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), '31 ILS',          'green'),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), '31 PAPI',         'green'),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'TACAN',           'green'),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'GCA/PAR',         'green');

-- ═══════════════════════════════════════════════════════════════
-- 4. Airfield areas
--    Taxiways from FAA airport diagram (NC-2, 19 FEB 2026).
--    Hot cargo pad located off TWY M North.
-- ═══════════════════════════════════════════════════════════════
INSERT INTO base_areas (base_id, area_name, sort_order) VALUES
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'Entire Airfield',      0),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'RWY 13/31',            1),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'TWY A',                2),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'TWY B',                3),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'TWY C',                4),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'TWY C1',               5),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'TWY C2',               6),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'TWY C3',               7),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'TWY C4',               8),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'TWY D',                9),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'TWY E',               10),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'TWY F',               11),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'TWY G',               12),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'TWY H',               13),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'TWY J1',              14),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'TWY J2',              15),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'TWY J3',              16),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'TWY K',               17),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'TWY L',               18),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'TWY M North',         19),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'TWY M South',         20),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'TWY P',               21),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'TWY Q',               22),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'NW Hammerhead',       23),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'SE Hammerhead',       24),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'Hot Cargo Pad',       25),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'Main Ramp',           26),
  ((SELECT id FROM bases WHERE icao = 'KOFF'), 'Flight Line',         27);

-- ═══════════════════════════════════════════════════════════════
-- 5. Airfield status
--    Seed an initial status row so the dashboard works immediately.
--    Sets RWY 13 as the default active runway.
-- ═══════════════════════════════════════════════════════════════
INSERT INTO airfield_status (base_id, active_runway, runway_status, runway_statuses)
VALUES (
  (SELECT id FROM bases WHERE icao = 'KOFF'),
  '13',
  'open',
  '{
    "13/31": {"status": "open", "active_end": "13"}
  }'::jsonb
)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- DATA SOURCE: FAA AIP effective 19 February 2026. Runway dimensions,
-- threshold coordinates, threshold elevations, and NAVAID data from
-- FAA NFDC 5010 for OFF (Offutt AFB, Omaha, NE). NOT FOR NAVIGATION.
-- ═══════════════════════════════════════════════════════════════
