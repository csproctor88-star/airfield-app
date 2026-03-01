-- ============================================================================
-- AOMS: Aircraft Characteristics Migration
-- ============================================================================
-- Source: USACE Transportation Systems Center Reports
--   TSC 13-2 (Military, Dec 2013 Rev 2) — 127 aircraft
--   TSC 13-3 (Commercial, Dec 2013) — 84 aircraft
--
-- Run this in Supabase SQL Editor or via CLI:
--   supabase db push
-- ============================================================================

-- 1. Create the aircraft_characteristics table
CREATE TABLE IF NOT EXISTS aircraft_characteristics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- === IDENTIFICATION ===
  aircraft TEXT NOT NULL,                          -- e.g., "C-17A Globemaster III", "737-800"
  manufacturer TEXT,                               -- e.g., "Boeing", "Lockheed Martin"
  category TEXT NOT NULL CHECK (category IN ('commercial', 'military')),
  alc_manager TEXT,                                -- Air Logistics Center (military only)
  group_index TEXT,                                -- AFMAN 32-1121V1 group index (military only)
  notes TEXT,                                      -- Additional context (helicopter type, UAS, etc.)

  -- === IMAGE ===
  image_url TEXT,                                  -- Supabase Storage public URL
  image_license TEXT,                              -- e.g., "Public domain", "CC BY-SA 4.0"
  image_source_url TEXT,                           -- Original source URL for attribution

  -- === DIMENSIONS (feet unless noted) ===
  wing_span_ft NUMERIC,                            -- Wing span or rotor diameter
  length_ft NUMERIC,
  height_ft NUMERIC,
  vertical_clearance_in NUMERIC,                   -- Min ground clearance (inches)

  -- === TURN DATA ===
  pivot_point_ft NUMERIC,                          -- Nose to pivot point distance
  turn_radius_ft NUMERIC,                          -- Minimum turn radius
  turn_diameter_180_ft NUMERIC,                    -- 180-degree turn diameter
  controlling_gear TEXT,                            -- 'Nose' or 'Main'

  -- === WEIGHTS (1,000 lbs) ===
  basic_empty_wt_klbs NUMERIC,
  basic_mission_to_wt_klbs NUMERIC,                -- Basic mission takeoff weight
  max_to_wt_klbs NUMERIC,                          -- Maximum takeoff weight
  basic_mission_ldg_wt_klbs NUMERIC,               -- Basic mission landing weight
  max_ldg_wt_klbs NUMERIC,                         -- Maximum landing weight

  -- === PERFORMANCE ===
  to_dist_ft NUMERIC,                              -- Takeoff distance (feet)
  ldg_dist_ft NUMERIC,                             -- Landing distance (feet)

  -- === LANDING GEAR ===
  gear_config TEXT,                                 -- FAA gear configuration description
  nose_assemblies_tires TEXT,                       -- Format: "assemblies-tires" e.g., "1-2"
  main_assemblies_tires TEXT,                       -- Format: "assemblies-tires" e.g., "2-4"

  -- === MAIN GEAR DATA ===
  main_pct_gross_load NUMERIC,                     -- % gross weight on main gear
  main_max_assembly_load_klbs NUMERIC,
  main_max_single_wheel_load_klbs NUMERIC,
  main_contact_pressure_psi NUMERIC,               -- Tire contact pressure (PSI)
  main_contact_area_sqin NUMERIC,                  -- Tire contact area (sq inches)
  main_footprint_width_in NUMERIC,                 -- Footprint width (inches)

  -- === NOSE GEAR DATA ===
  nose_pct_gross_load NUMERIC,
  nose_max_assembly_load_klbs NUMERIC,
  nose_max_single_wheel_load_klbs NUMERIC,
  nose_contact_pressure_psi NUMERIC,
  nose_contact_area_sqin NUMERIC,
  nose_footprint_width_in NUMERIC,

  -- === ACN VALUES (Aircraft Classification Numbers) ===
  -- Rigid pavement subgrades (K values: A=500, B=300, C=150, D=75)
  -- Flexible pavement subgrades (CBR values: A=15, B=10, C=6, D=3)
  acn_min_wt_klbs NUMERIC,                         -- Weight for min ACN values
  acn_min_rigid_a NUMERIC,
  acn_min_rigid_b NUMERIC,
  acn_min_rigid_c NUMERIC,
  acn_min_rigid_d NUMERIC,
  acn_min_flex_a NUMERIC,
  acn_min_flex_b NUMERIC,
  acn_min_flex_c NUMERIC,
  acn_min_flex_d NUMERIC,
  acn_max_wt_klbs NUMERIC,                         -- Weight for max ACN values
  acn_max_rigid_a NUMERIC,
  acn_max_rigid_b NUMERIC,
  acn_max_rigid_c NUMERIC,
  acn_max_rigid_d NUMERIC,
  acn_max_flex_a NUMERIC,
  acn_max_flex_b NUMERIC,
  acn_max_flex_c NUMERIC,
  acn_max_flex_d NUMERIC,

  -- === METADATA ===
  source_document TEXT,                            -- 'TSC 13-2' or 'TSC 13-3'
  source_page INTEGER,                             -- Page number in source PDF

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for common queries
CREATE INDEX idx_aircraft_category ON aircraft_characteristics(category);
CREATE INDEX idx_aircraft_manufacturer ON aircraft_characteristics(manufacturer);
CREATE INDEX idx_aircraft_name ON aircraft_characteristics(aircraft);
CREATE INDEX idx_aircraft_max_to_wt ON aircraft_characteristics(max_to_wt_klbs);
CREATE INDEX idx_aircraft_group_index ON aircraft_characteristics(group_index) WHERE group_index IS NOT NULL;

-- Full-text search index on aircraft name + manufacturer
CREATE INDEX idx_aircraft_fts ON aircraft_characteristics
  USING GIN (to_tsvector('english', coalesce(aircraft, '') || ' ' || coalesce(manufacturer, '') || ' ' || coalesce(notes, '')));

-- 3. Updated_at trigger
CREATE OR REPLACE FUNCTION update_aircraft_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_aircraft_updated_at
  BEFORE UPDATE ON aircraft_characteristics
  FOR EACH ROW EXECUTE FUNCTION update_aircraft_timestamp();

-- 4. RLS policies
ALTER TABLE aircraft_characteristics ENABLE ROW LEVEL SECURITY;

-- Everyone can read aircraft data (it's reference data, not sensitive)
CREATE POLICY "Aircraft data is publicly readable"
  ON aircraft_characteristics FOR SELECT
  USING (true);

-- Only admins/airfield managers can modify
CREATE POLICY "Admins can manage aircraft data"
  ON aircraft_characteristics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('sys_admin', 'airfield_manager')
    )
  );

-- 5. Create the storage bucket for aircraft images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'aircraft-images',
  'aircraft-images',
  true,                                            -- Public bucket (reference images, not sensitive)
  5242880,                                         -- 5MB max per image
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: public read, admin write
CREATE POLICY "Aircraft images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'aircraft-images');

CREATE POLICY "Admins can upload aircraft images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'aircraft-images'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('sys_admin', 'airfield_manager')
    )
  );

-- 6. Helper function: search aircraft by text
CREATE OR REPLACE FUNCTION search_aircraft(search_query TEXT)
RETURNS SETOF aircraft_characteristics AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM aircraft_characteristics
  WHERE to_tsvector('english', coalesce(aircraft, '') || ' ' || coalesce(manufacturer, '') || ' ' || coalesce(notes, ''))
        @@ plainto_tsquery('english', search_query)
  ORDER BY ts_rank(
    to_tsvector('english', coalesce(aircraft, '') || ' ' || coalesce(manufacturer, '') || ' ' || coalesce(notes, '')),
    plainto_tsquery('english', search_query)
  ) DESC;
END;
$$ LANGUAGE plpgsql;

-- 7. Helper view: aircraft summary (commonly needed fields)
CREATE OR REPLACE VIEW aircraft_summary AS
SELECT
  id,
  aircraft,
  manufacturer,
  category,
  image_url,
  wing_span_ft,
  length_ft,
  height_ft,
  max_to_wt_klbs,
  max_ldg_wt_klbs,
  gear_config,
  turn_radius_ft,
  turn_diameter_180_ft,
  main_contact_pressure_psi,
  group_index,
  controlling_gear
FROM aircraft_characteristics
ORDER BY category, aircraft;
