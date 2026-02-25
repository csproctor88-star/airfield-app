-- Seed Mountain Home Air Force Base (KMUO) base installation.
-- Data sourced from FAA AIP effective 19 February 2026, FAA NFDC 5010, and
-- publicly available aviation references. NOT FOR NAVIGATION USE.
-- Base admin should verify all values against current FAA Chart Supplement
-- before operational use.

-- ═══════════════════════════════════════════════════════════════
-- 1. Base record
-- ═══════════════════════════════════════════════════════════════
INSERT INTO bases (name, icao, unit, majcom, location, elevation_msl, timezone, ce_shops)
SELECT
  'Mountain Home Air Force Base',
  'KMUO',
  '366th Fighter Wing',
  'Air Combat Command (ACC)',
  'Mountain Home, Idaho',
  2996,
  'America/Boise',
  ARRAY[
    'CE Pavements',
    'CE Electrical',
    'CE Grounds',
    'CE Structures',
    'CE HVAC',
    'CES Engineering',
    'Airfield Management'
  ]
WHERE NOT EXISTS (SELECT 1 FROM bases WHERE icao = 'KMUO');

-- Update in case the base was already added via the settings UI
UPDATE bases SET
  name          = 'Mountain Home Air Force Base',
  unit          = '366th Fighter Wing',
  majcom        = 'Air Combat Command (ACC)',
  location      = 'Mountain Home, Idaho',
  elevation_msl = 2996,
  timezone      = 'America/Boise',
  ce_shops      = ARRAY[
    'CE Pavements',
    'CE Electrical',
    'CE Grounds',
    'CE Structures',
    'CE HVAC',
    'CES Engineering',
    'Airfield Management'
  ]
WHERE icao = 'KMUO';

-- Child rows (base_runways, base_navaids, base_areas) have ON DELETE CASCADE,
-- so we can safely delete and re-insert them below.
DELETE FROM base_runways WHERE base_id = (SELECT id FROM bases WHERE icao = 'KMUO');
DELETE FROM base_navaids WHERE base_id = (SELECT id FROM bases WHERE icao = 'KMUO');
DELETE FROM base_areas   WHERE base_id = (SELECT id FROM bases WHERE icao = 'KMUO');

-- ═══════════════════════════════════════════════════════════════
-- 2. Runway
--    Mountain Home has one runway: 12/30.
--    13,510 × 200 ft, PEM (concrete ends, asphalt/concrete middle).
--    True headings per FAA AIP; threshold coords from FAA 5010 data.
--    end1 = low-numbered end (12); end2 = high-numbered end (30).
--    BAK-12B arresting gear installed.
-- ═══════════════════════════════════════════════════════════════

-- Runway 12/30 — 13,510 × 200 ft, PCN 58/R/C/W/T
-- 12: threshold elev 2982.9 ft. ALSF-1 approach lighting. ILS equipped.
-- 30: threshold elev 2995.5 ft. ALSF-1 approach lighting. ILS equipped.
INSERT INTO base_runways (
  base_id, runway_id, length_ft, width_ft, surface, true_heading,
  end1_designator, end1_latitude, end1_longitude, end1_heading, end1_approach_lighting, end1_elevation_msl,
  end2_designator, end2_latitude, end2_longitude, end2_heading, end2_approach_lighting, end2_elevation_msl
)
VALUES (
  (SELECT id FROM bases WHERE icao = 'KMUO'),
  '12/30', 13510, 200, 'Asphalt/Concrete', 135,
  '12', 43.056714, -115.890278, 135, 'ALSF-1', 2982.9,
  '30', 43.030475, -115.854592, 315, 'ALSF-1', 2995.5
);

-- ═══════════════════════════════════════════════════════════════
-- 3. NAVAIDs
--    Both runway ends (12, 30) have ILS and TACAN approaches.
--    ILS RWY 12: HI-ILS/LOC Y, ILS/LOC Z
--    ILS RWY 30: HI-ILS/LOC Y, ILS/LOC Z
--    TACAN: HI-TACAN Y and TACAN Z for both ends
-- ═══════════════════════════════════════════════════════════════
INSERT INTO base_navaids (base_id, navaid_name, sort_order) VALUES
  -- RWY 12
  ((SELECT id FROM bases WHERE icao = 'KMUO'), '12 Localizer',    1),
  ((SELECT id FROM bases WHERE icao = 'KMUO'), '12 Glideslope',   2),
  ((SELECT id FROM bases WHERE icao = 'KMUO'), '12 ILS',          3),
  -- RWY 30
  ((SELECT id FROM bases WHERE icao = 'KMUO'), '30 Localizer',    4),
  ((SELECT id FROM bases WHERE icao = 'KMUO'), '30 Glideslope',   5),
  ((SELECT id FROM bases WHERE icao = 'KMUO'), '30 ILS',          6),
  -- TACAN
  ((SELECT id FROM bases WHERE icao = 'KMUO'), 'TACAN',           7);

-- ── NAVAID dashboard statuses ──
-- The dashboard reads from navaid_statuses (not base_navaids), so each
-- NAVAID needs a corresponding status row to appear on the home page.
DELETE FROM navaid_statuses WHERE base_id = (SELECT id FROM bases WHERE icao = 'KMUO');
INSERT INTO navaid_statuses (base_id, navaid_name, status) VALUES
  ((SELECT id FROM bases WHERE icao = 'KMUO'), '12 Localizer',    'green'),
  ((SELECT id FROM bases WHERE icao = 'KMUO'), '12 Glideslope',   'green'),
  ((SELECT id FROM bases WHERE icao = 'KMUO'), '12 ILS',          'green'),
  ((SELECT id FROM bases WHERE icao = 'KMUO'), '30 Localizer',    'green'),
  ((SELECT id FROM bases WHERE icao = 'KMUO'), '30 Glideslope',   'green'),
  ((SELECT id FROM bases WHERE icao = 'KMUO'), '30 ILS',          'green'),
  ((SELECT id FROM bases WHERE icao = 'KMUO'), 'TACAN',           'green');

-- ═══════════════════════════════════════════════════════════════
-- 4. Airfield areas
--    Taxiways: A, B, C, D, E, F per FAA remarks.
--    No ramp/apron areas seeded — admin should add via settings UI.
-- ═══════════════════════════════════════════════════════════════
INSERT INTO base_areas (base_id, area_name, sort_order) VALUES
  ((SELECT id FROM bases WHERE icao = 'KMUO'), 'Entire Airfield',    0),
  ((SELECT id FROM bases WHERE icao = 'KMUO'), 'RWY 12/30',          1),
  ((SELECT id FROM bases WHERE icao = 'KMUO'), 'TWY A',              2),
  ((SELECT id FROM bases WHERE icao = 'KMUO'), 'TWY B',              3),
  ((SELECT id FROM bases WHERE icao = 'KMUO'), 'TWY C',              4),
  ((SELECT id FROM bases WHERE icao = 'KMUO'), 'TWY D',              5),
  ((SELECT id FROM bases WHERE icao = 'KMUO'), 'TWY E',              6),
  ((SELECT id FROM bases WHERE icao = 'KMUO'), 'TWY F',              7),
  ((SELECT id FROM bases WHERE icao = 'KMUO'), 'Flight Line',        8);

-- ═══════════════════════════════════════════════════════════════
-- 5. Airfield status
--    Seed an initial status row so the dashboard works immediately.
--    Sets RWY 12 as the default active runway.
-- ═══════════════════════════════════════════════════════════════
INSERT INTO airfield_status (base_id, active_runway, runway_status, runway_statuses)
VALUES (
  (SELECT id FROM bases WHERE icao = 'KMUO'),
  '12',
  'open',
  '{
    "12/30": {"status": "open", "active_end": "12"}
  }'::jsonb
)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- DATA SOURCE: FAA AIP effective 19 February 2026. Runway dimensions,
-- threshold coordinates, and threshold elevations from FAA 5010 data
-- for MUO (Mountain Home AFB, Mountain Home, ID). NOT FOR NAVIGATION.
-- ═══════════════════════════════════════════════════════════════
