-- BASH/Wildlife Hazard Tracking Module
-- Tables: wildlife_sightings, wildlife_strikes, bwc_history

-- ── Wildlife Sightings ──
CREATE TABLE IF NOT EXISTS wildlife_sightings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID REFERENCES bases(id),
  display_id TEXT NOT NULL,

  -- What was seen
  species_common TEXT NOT NULL,
  species_scientific TEXT,
  species_group TEXT NOT NULL CHECK (species_group IN ('bird', 'mammal', 'reptile', 'bat')),
  size_category TEXT CHECK (size_category IN ('small', 'medium', 'large')),
  count_observed INTEGER NOT NULL DEFAULT 1,
  behavior TEXT,

  -- Where
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_text TEXT,
  airfield_zone TEXT,

  -- When / conditions
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  time_of_day TEXT,
  sky_condition TEXT,
  precipitation TEXT,

  -- Action taken
  action_taken TEXT DEFAULT 'none',
  dispersal_method TEXT,
  dispersal_effective BOOLEAN,

  -- Who
  observed_by TEXT NOT NULL,
  observed_by_id UUID,

  -- Links
  check_id UUID REFERENCES airfield_checks(id) ON DELETE SET NULL,
  inspection_id UUID REFERENCES inspections(id) ON DELETE SET NULL,
  discrepancy_id UUID REFERENCES discrepancies(id) ON DELETE SET NULL,

  photo_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wildlife_sightings_base ON wildlife_sightings(base_id);
CREATE INDEX idx_wildlife_sightings_observed ON wildlife_sightings(observed_at);
CREATE INDEX idx_wildlife_sightings_species ON wildlife_sightings(species_common);
CREATE INDEX idx_wildlife_sightings_coords ON wildlife_sightings(latitude, longitude);

-- ── Wildlife Strikes ──
CREATE TABLE IF NOT EXISTS wildlife_strikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID REFERENCES bases(id),
  display_id TEXT NOT NULL,

  -- Species
  species_common TEXT,
  species_scientific TEXT,
  species_group TEXT CHECK (species_group IN ('bird', 'mammal', 'reptile', 'bat')),
  size_category TEXT CHECK (size_category IN ('small', 'medium', 'large')),
  number_struck INTEGER DEFAULT 1,
  number_seen INTEGER,

  -- Location & conditions
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_text TEXT,
  strike_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  time_of_day TEXT,
  sky_condition TEXT,
  precipitation TEXT,

  -- Aircraft info
  aircraft_type TEXT,
  aircraft_registration TEXT,
  engine_type TEXT,

  -- Strike details
  phase_of_flight TEXT,
  altitude_agl INTEGER,
  speed_ias INTEGER,
  pilot_warned BOOLEAN,

  -- Damage assessment
  parts_struck TEXT[],
  parts_damaged TEXT[],
  damage_level TEXT DEFAULT 'none' CHECK (damage_level IN ('none', 'minor', 'substantial', 'destroyed')),
  engine_ingested BOOLEAN DEFAULT false,
  engines_ingested INTEGER[],

  -- Flight effect
  flight_effect TEXT DEFAULT 'none',

  -- Cost
  repair_cost DECIMAL,
  other_cost DECIMAL,
  hours_out_of_service INTEGER,

  -- Remains
  remains_collected BOOLEAN DEFAULT false,
  remains_sent_to_lab BOOLEAN DEFAULT false,
  lab_identification TEXT,

  -- Who reported
  reported_by TEXT NOT NULL,
  reported_by_id UUID,

  -- Links
  discrepancy_id UUID REFERENCES discrepancies(id) ON DELETE SET NULL,
  sighting_id UUID REFERENCES wildlife_sightings(id) ON DELETE SET NULL,

  photo_count INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wildlife_strikes_base ON wildlife_strikes(base_id);
CREATE INDEX idx_wildlife_strikes_date ON wildlife_strikes(strike_date);
CREATE INDEX idx_wildlife_strikes_species ON wildlife_strikes(species_common);

-- ── BWC History ──
CREATE TABLE IF NOT EXISTS bwc_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID REFERENCES bases(id),
  bwc_value TEXT NOT NULL,
  set_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  set_by TEXT,
  source TEXT,
  source_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bwc_history_base ON bwc_history(base_id);
CREATE INDEX idx_bwc_history_set_at ON bwc_history(set_at);

-- ── RLS Policies ──
ALTER TABLE wildlife_sightings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wildlife_strikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bwc_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wildlife_sightings_select" ON wildlife_sightings FOR SELECT USING (true);
CREATE POLICY "wildlife_sightings_insert" ON wildlife_sightings FOR INSERT WITH CHECK (true);
CREATE POLICY "wildlife_sightings_update" ON wildlife_sightings FOR UPDATE USING (true);
CREATE POLICY "wildlife_sightings_delete" ON wildlife_sightings FOR DELETE USING (true);

CREATE POLICY "wildlife_strikes_select" ON wildlife_strikes FOR SELECT USING (true);
CREATE POLICY "wildlife_strikes_insert" ON wildlife_strikes FOR INSERT WITH CHECK (true);
CREATE POLICY "wildlife_strikes_update" ON wildlife_strikes FOR UPDATE USING (true);
CREATE POLICY "wildlife_strikes_delete" ON wildlife_strikes FOR DELETE USING (true);

CREATE POLICY "bwc_history_select" ON bwc_history FOR SELECT USING (true);
CREATE POLICY "bwc_history_insert" ON bwc_history FOR INSERT WITH CHECK (true);
CREATE POLICY "bwc_history_update" ON bwc_history FOR UPDATE USING (true);
CREATE POLICY "bwc_history_delete" ON bwc_history FOR DELETE USING (true);
