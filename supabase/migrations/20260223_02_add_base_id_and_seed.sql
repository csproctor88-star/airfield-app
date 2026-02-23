-- Multi-Base Support: Add base_id columns to existing tables & seed Selfridge ANGB
-- Run AFTER 20260223_create_bases.sql

-- ═══════════════════════════════════════════════════════════════
-- 1. Seed Selfridge ANGB as the first base
-- ═══════════════════════════════════════════════════════════════
INSERT INTO bases (id, name, icao, unit, majcom, location, elevation_msl, timezone, ce_shops)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Selfridge Air National Guard Base',
  'KMTC',
  '127th Wing',
  'Michigan Air National Guard',
  'Harrison Township, Michigan',
  580,
  'America/Detroit',
  ARRAY['CE Pavements', 'CE Electrical', 'CE Grounds', 'CE Structures', 'CE HVAC', 'CES Engineering', 'Airfield Management']
)
ON CONFLICT (icao) DO NOTHING;

-- Runway 01/19
INSERT INTO base_runways (base_id, runway_id, length_ft, width_ft, surface, true_heading,
  end1_designator, end1_latitude, end1_longitude, end1_heading, end1_approach_lighting,
  end2_designator, end2_latitude, end2_longitude, end2_heading, end2_approach_lighting)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '01/19', 9000, 150, 'Asphalt', 2,
  '01', 42.601550, -82.837339, 8, 'SALS',
  '19', 42.626239, -82.836481, 188, 'ALSF-1'
)
ON CONFLICT (base_id, runway_id) DO NOTHING;

-- NAVAIDs for Selfridge
INSERT INTO base_navaids (base_id, navaid_name, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000001', '01 Localizer', 1),
  ('00000000-0000-0000-0000-000000000001', '01 Glideslope', 2),
  ('00000000-0000-0000-0000-000000000001', '01 ILS', 3),
  ('00000000-0000-0000-0000-000000000001', '19 Localizer', 4),
  ('00000000-0000-0000-0000-000000000001', '19 Glideslope', 5),
  ('00000000-0000-0000-0000-000000000001', '19 ILS', 6)
ON CONFLICT (base_id, navaid_name) DO NOTHING;

-- Airfield areas for Selfridge
INSERT INTO base_areas (base_id, area_name, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Entire Airfield', 0),
  ('00000000-0000-0000-0000-000000000001', 'RWY 01/19', 1),
  ('00000000-0000-0000-0000-000000000001', 'West Ramp', 2),
  ('00000000-0000-0000-0000-000000000001', 'East Ramp', 3),
  ('00000000-0000-0000-0000-000000000001', 'HAZ Cargo Pad', 4),
  ('00000000-0000-0000-0000-000000000001', 'USCG Apron', 5),
  ('00000000-0000-0000-0000-000000000001', 'DHS Apron', 6),
  ('00000000-0000-0000-0000-000000000001', 'Army Apron', 7),
  ('00000000-0000-0000-0000-000000000001', 'TWY A', 8),
  ('00000000-0000-0000-0000-000000000001', 'TWY G', 9),
  ('00000000-0000-0000-0000-000000000001', 'TWY K', 10),
  ('00000000-0000-0000-0000-000000000001', 'TWY E', 11),
  ('00000000-0000-0000-0000-000000000001', 'TWY B', 12),
  ('00000000-0000-0000-0000-000000000001', 'TWY L', 13),
  ('00000000-0000-0000-0000-000000000001', 'TWY H', 14),
  ('00000000-0000-0000-0000-000000000001', 'TWY J', 15),
  ('00000000-0000-0000-0000-000000000001', 'Access Road', 16)
ON CONFLICT (base_id, area_name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 2. Add base_id column to all operational tables
--    Default to Selfridge for existing data, then remove default
-- ═══════════════════════════════════════════════════════════════

-- profiles: add primary_base_id (which base user defaults to)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS primary_base_id UUID REFERENCES bases(id);

-- inspections
ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS base_id UUID REFERENCES bases(id);
UPDATE inspections SET base_id = '00000000-0000-0000-0000-000000000001' WHERE base_id IS NULL;

-- discrepancies
ALTER TABLE discrepancies
  ADD COLUMN IF NOT EXISTS base_id UUID REFERENCES bases(id);
UPDATE discrepancies SET base_id = '00000000-0000-0000-0000-000000000001' WHERE base_id IS NULL;

-- obstruction_evaluations
ALTER TABLE obstruction_evaluations
  ADD COLUMN IF NOT EXISTS base_id UUID REFERENCES bases(id);
UPDATE obstruction_evaluations SET base_id = '00000000-0000-0000-0000-000000000001' WHERE base_id IS NULL;

-- airfield_checks
ALTER TABLE airfield_checks
  ADD COLUMN IF NOT EXISTS base_id UUID REFERENCES bases(id);
UPDATE airfield_checks SET base_id = '00000000-0000-0000-0000-000000000001' WHERE base_id IS NULL;

-- notams
ALTER TABLE notams
  ADD COLUMN IF NOT EXISTS base_id UUID REFERENCES bases(id);
UPDATE notams SET base_id = '00000000-0000-0000-0000-000000000001' WHERE base_id IS NULL;

-- navaid_statuses
ALTER TABLE navaid_statuses
  ADD COLUMN IF NOT EXISTS base_id UUID REFERENCES bases(id);
UPDATE navaid_statuses SET base_id = '00000000-0000-0000-0000-000000000001' WHERE base_id IS NULL;

-- airfield_status: now supports N rows (one per base)
ALTER TABLE airfield_status
  ADD COLUMN IF NOT EXISTS base_id UUID REFERENCES bases(id);
UPDATE airfield_status SET base_id = '00000000-0000-0000-0000-000000000001' WHERE base_id IS NULL;

-- runway_status_log
ALTER TABLE runway_status_log
  ADD COLUMN IF NOT EXISTS base_id UUID REFERENCES bases(id);
UPDATE runway_status_log SET base_id = '00000000-0000-0000-0000-000000000001' WHERE base_id IS NULL;

-- activity_log
ALTER TABLE activity_log
  ADD COLUMN IF NOT EXISTS base_id UUID REFERENCES bases(id);
UPDATE activity_log SET base_id = '00000000-0000-0000-0000-000000000001' WHERE base_id IS NULL;

-- photos (explicit base_id for orphan cleanup)
ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS base_id UUID REFERENCES bases(id);
UPDATE photos SET base_id = '00000000-0000-0000-0000-000000000001' WHERE base_id IS NULL;

-- status_updates
ALTER TABLE status_updates
  ADD COLUMN IF NOT EXISTS base_id UUID REFERENCES bases(id);
UPDATE status_updates SET base_id = '00000000-0000-0000-0000-000000000001' WHERE base_id IS NULL;

-- check_comments (inherits from airfield_checks but explicit for queries)
ALTER TABLE check_comments
  ADD COLUMN IF NOT EXISTS base_id UUID REFERENCES bases(id);
UPDATE check_comments SET base_id = '00000000-0000-0000-0000-000000000001' WHERE base_id IS NULL;

-- ═══════════════════════════════════════════════════════════════
-- 3. Indexes on base_id for all tables
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_inspections_base ON inspections(base_id);
CREATE INDEX IF NOT EXISTS idx_discrepancies_base ON discrepancies(base_id);
CREATE INDEX IF NOT EXISTS idx_obstruction_evaluations_base ON obstruction_evaluations(base_id);
CREATE INDEX IF NOT EXISTS idx_airfield_checks_base ON airfield_checks(base_id);
CREATE INDEX IF NOT EXISTS idx_notams_base ON notams(base_id);
CREATE INDEX IF NOT EXISTS idx_navaid_statuses_base ON navaid_statuses(base_id);
CREATE INDEX IF NOT EXISTS idx_airfield_status_base ON airfield_status(base_id);
CREATE INDEX IF NOT EXISTS idx_runway_status_log_base ON runway_status_log(base_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_base ON activity_log(base_id);
CREATE INDEX IF NOT EXISTS idx_photos_base ON photos(base_id);
CREATE INDEX IF NOT EXISTS idx_status_updates_base ON status_updates(base_id);
CREATE INDEX IF NOT EXISTS idx_check_comments_base ON check_comments(base_id);

-- ═══════════════════════════════════════════════════════════════
-- 4. Add base_id-scoped unique constraint on airfield_status
-- ═══════════════════════════════════════════════════════════════
CREATE UNIQUE INDEX IF NOT EXISTS idx_airfield_status_base_unique
  ON airfield_status(base_id) WHERE base_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- 5. Update airfield_status RPC to accept base_id
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_airfield_status(
  p_updates    JSONB,
  p_updated_by UUID DEFAULT NULL,
  p_base_id    UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER AS $$
BEGIN
  UPDATE airfield_status
  SET
    advisory_type  = COALESCE((p_updates->>'advisory_type')::TEXT, advisory_type),
    advisory_text  = CASE WHEN p_updates ? 'advisory_text' THEN (p_updates->>'advisory_text')::TEXT ELSE advisory_text END,
    active_runway  = COALESCE((p_updates->>'active_runway')::TEXT, active_runway),
    runway_status  = COALESCE((p_updates->>'runway_status')::TEXT, runway_status),
    updated_by     = COALESCE(p_updated_by, updated_by),
    updated_at     = now()
  WHERE base_id = COALESCE(p_base_id, base_id)
    AND id = (
      SELECT id FROM airfield_status
      WHERE base_id = COALESCE(p_base_id, base_id)
      LIMIT 1
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 6. Assign all existing users to Selfridge as base members
-- ═══════════════════════════════════════════════════════════════
INSERT INTO base_members (base_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001', id, role
FROM profiles
WHERE is_active = true
ON CONFLICT (base_id, user_id) DO NOTHING;

-- Set primary_base_id for all existing users to Selfridge
UPDATE profiles SET primary_base_id = '00000000-0000-0000-0000-000000000001'
WHERE primary_base_id IS NULL;
