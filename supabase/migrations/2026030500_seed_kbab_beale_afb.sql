-- Seed Beale Air Force Base (KBAB) installation.
-- Data sourced from FAA AIP, FAA NFDC 5010, and publicly available aviation
-- references. NOT FOR NAVIGATION USE.
-- Base admin should verify all values against current FAA Chart Supplement
-- before operational use.

-- ═══════════════════════════════════════════════════════════════
-- 1. Base record
-- ═══════════════════════════════════════════════════════════════
INSERT INTO bases (name, icao, unit, majcom, location, elevation_msl, timezone, ce_shops)
SELECT
  'Beale Air Force Base',
  'KBAB',
  '9th Reconnaissance Wing',
  'Air Combat Command (ACC)',
  'Marysville, California',
  113,
  'America/Los_Angeles',
  ARRAY[
    'CE Pavements',
    'CE Electrical',
    'CE Grounds',
    'CE Structures',
    'CE HVAC',
    'CES Engineering',
    'Airfield Management'
  ]
WHERE NOT EXISTS (SELECT 1 FROM bases WHERE icao = 'KBAB');

-- Update in case the base was already added via the settings UI
UPDATE bases SET
  name          = 'Beale Air Force Base',
  unit          = '9th Reconnaissance Wing',
  majcom        = 'Air Combat Command (ACC)',
  location      = 'Marysville, California',
  elevation_msl = 113,
  timezone      = 'America/Los_Angeles',
  ce_shops      = ARRAY[
    'CE Pavements',
    'CE Electrical',
    'CE Grounds',
    'CE Structures',
    'CE HVAC',
    'CES Engineering',
    'Airfield Management'
  ]
WHERE icao = 'KBAB';

-- Child rows (base_runways, base_navaids, base_areas) have ON DELETE CASCADE,
-- so we can safely delete and re-insert them below.
DELETE FROM base_runways WHERE base_id = (SELECT id FROM bases WHERE icao = 'KBAB');
DELETE FROM base_navaids WHERE base_id = (SELECT id FROM bases WHERE icao = 'KBAB');
DELETE FROM base_areas   WHERE base_id = (SELECT id FROM bases WHERE icao = 'KBAB');

-- ═══════════════════════════════════════════════════════════════
-- 2. Runway
--    Beale has one runway: 15/33.
--    12,001 × 300 ft (marked at 200 ft), concrete/grooved.
--    PCN 84/R/B/W/T.
--    True headings per FAA AIP; threshold coords from FAA 5010 data.
--    end1 = low-numbered end (15); end2 = high-numbered end (33).
-- ═══════════════════════════════════════════════════════════════

-- Runway 15/33 — 12,001 × 300 ft, PCN 84/R/B/W/T
-- 15: threshold elev 112.7 ft. ALSF-1 approach lighting. ILS equipped.
-- 33: threshold elev 105.1 ft. ALSF-1 approach lighting. ILS equipped.
INSERT INTO base_runways (
  base_id, runway_id, length_ft, width_ft, surface, true_heading,
  end1_designator, end1_latitude, end1_longitude, end1_heading, end1_approach_lighting, end1_elevation_msl,
  end2_designator, end2_latitude, end2_longitude, end2_heading, end2_approach_lighting, end2_elevation_msl
)
VALUES (
  (SELECT id FROM bases WHERE icao = 'KBAB'),
  '15/33', 12001, 300, 'Concrete/Grooved', 161,
  '15', 39.151710, -121.443351, 161, 'ALSF-1', 112.7,
  '33', 39.120491, -121.429823, 341, 'ALSF-1', 105.1
);

-- ═══════════════════════════════════════════════════════════════
-- 3. NAVAIDs
--    Both runway ends (15, 33) have ILS (LOC/GS) approaches.
--    ILS RWY 15: HI-ILS/LOC Z, ILS/LOC Y
--    ILS RWY 33: HI-ILS/LOC Z, ILS/LOC Y
--    TACAN: HI-TACAN Z and TACAN Y for both ends
--    PAPI: 4-light on left, both ends
-- ═══════════════════════════════════════════════════════════════
INSERT INTO base_navaids (base_id, navaid_name, sort_order) VALUES
  -- RWY 15
  ((SELECT id FROM bases WHERE icao = 'KBAB'), '15 Localizer',    1),
  ((SELECT id FROM bases WHERE icao = 'KBAB'), '15 Glideslope',   2),
  ((SELECT id FROM bases WHERE icao = 'KBAB'), '15 ILS',          3),
  ((SELECT id FROM bases WHERE icao = 'KBAB'), '15 PAPI',         4),
  -- RWY 33
  ((SELECT id FROM bases WHERE icao = 'KBAB'), '33 Localizer',    5),
  ((SELECT id FROM bases WHERE icao = 'KBAB'), '33 Glideslope',   6),
  ((SELECT id FROM bases WHERE icao = 'KBAB'), '33 ILS',          7),
  ((SELECT id FROM bases WHERE icao = 'KBAB'), '33 PAPI',         8),
  -- TACAN
  ((SELECT id FROM bases WHERE icao = 'KBAB'), 'TACAN',           9);

-- ── NAVAID dashboard statuses ──
-- The dashboard reads from navaid_statuses (not base_navaids), so each
-- NAVAID needs a corresponding status row to appear on the home page.
DELETE FROM navaid_statuses WHERE base_id = (SELECT id FROM bases WHERE icao = 'KBAB');
INSERT INTO navaid_statuses (base_id, navaid_name, status) VALUES
  ((SELECT id FROM bases WHERE icao = 'KBAB'), '15 Localizer',    'green'),
  ((SELECT id FROM bases WHERE icao = 'KBAB'), '15 Glideslope',   'green'),
  ((SELECT id FROM bases WHERE icao = 'KBAB'), '15 ILS',          'green'),
  ((SELECT id FROM bases WHERE icao = 'KBAB'), '15 PAPI',         'green'),
  ((SELECT id FROM bases WHERE icao = 'KBAB'), '33 Localizer',    'green'),
  ((SELECT id FROM bases WHERE icao = 'KBAB'), '33 Glideslope',   'green'),
  ((SELECT id FROM bases WHERE icao = 'KBAB'), '33 ILS',          'green'),
  ((SELECT id FROM bases WHERE icao = 'KBAB'), '33 PAPI',         'green'),
  ((SELECT id FROM bases WHERE icao = 'KBAB'), 'TACAN',           'green');

-- ═══════════════════════════════════════════════════════════════
-- 4. Airfield areas
--    Taxiways sourced from FAA airport diagram.
--    Ramp/apron areas — admin should verify and add via settings UI.
-- ═══════════════════════════════════════════════════════════════
INSERT INTO base_areas (base_id, area_name, sort_order) VALUES
  ((SELECT id FROM bases WHERE icao = 'KBAB'), 'Entire Airfield',    0),
  ((SELECT id FROM bases WHERE icao = 'KBAB'), 'RWY 15/33',          1),
  ((SELECT id FROM bases WHERE icao = 'KBAB'), 'TWY A',              2),
  ((SELECT id FROM bases WHERE icao = 'KBAB'), 'TWY B',              3),
  ((SELECT id FROM bases WHERE icao = 'KBAB'), 'TWY C',              4),
  ((SELECT id FROM bases WHERE icao = 'KBAB'), 'TWY D',              5),
  ((SELECT id FROM bases WHERE icao = 'KBAB'), 'TWY E',              6),
  ((SELECT id FROM bases WHERE icao = 'KBAB'), 'TWY F',              7),
  ((SELECT id FROM bases WHERE icao = 'KBAB'), 'Main Ramp',          8),
  ((SELECT id FROM bases WHERE icao = 'KBAB'), 'South Ramp',         9),
  ((SELECT id FROM bases WHERE icao = 'KBAB'), 'Flight Line',       10);

-- ═══════════════════════════════════════════════════════════════
-- 5. Airfield status
--    Seed an initial status row so the dashboard works immediately.
--    Sets RWY 15 as the default active runway.
-- ═══════════════════════════════════════════════════════════════
INSERT INTO airfield_status (base_id, active_runway, runway_status, runway_statuses)
VALUES (
  (SELECT id FROM bases WHERE icao = 'KBAB'),
  '15',
  'open',
  '{
    "15/33": {"status": "open", "active_end": "15"}
  }'::jsonb
)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- DATA SOURCE: FAA AIP, FAA NFDC 5010 for BAB (Beale AFB,
-- Marysville, CA). Runway dimensions, threshold coordinates,
-- threshold elevations, and NAVAID data from publicly available
-- FAA records. NOT FOR NAVIGATION.
-- ═══════════════════════════════════════════════════════════════
