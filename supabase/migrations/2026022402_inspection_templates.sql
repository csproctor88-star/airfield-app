-- Multi-Base Scaling: Inspection templates + runway class
-- Moves inspection checklists from hardcoded constants to per-base database tables.

-- ═══════════════════════════════════════════════════════════════
-- 1. base_inspection_templates — one row per template type per base
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS base_inspection_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id       UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL CHECK (template_type IN ('airfield', 'lighting')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(base_id, template_type)
);

-- ═══════════════════════════════════════════════════════════════
-- 2. base_inspection_sections — sections within a template
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS base_inspection_sections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID NOT NULL REFERENCES base_inspection_templates(id) ON DELETE CASCADE,
  section_id    TEXT NOT NULL,
  title         TEXT NOT NULL,
  guidance      TEXT,
  conditional   TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(template_id, section_id)
);

-- ═══════════════════════════════════════════════════════════════
-- 3. base_inspection_items — individual checklist items
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS base_inspection_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id    UUID NOT NULL REFERENCES base_inspection_sections(id) ON DELETE CASCADE,
  item_key      TEXT NOT NULL,
  item_number   INTEGER NOT NULL,
  item_text     TEXT NOT NULL,
  item_type     TEXT NOT NULL DEFAULT 'pass_fail' CHECK (item_type IN ('pass_fail', 'bwc')),
  sort_order    INTEGER NOT NULL DEFAULT 0
);

-- ═══════════════════════════════════════════════════════════════
-- 4. Indexes
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX idx_inspection_templates_base ON base_inspection_templates(base_id);
CREATE INDEX idx_inspection_sections_template ON base_inspection_sections(template_id);
CREATE INDEX idx_inspection_items_section ON base_inspection_items(section_id);

-- ═══════════════════════════════════════════════════════════════
-- 5. Disable RLS (matches current convention)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE base_inspection_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE base_inspection_sections DISABLE ROW LEVEL SECURITY;
ALTER TABLE base_inspection_items DISABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════
-- 6. Add runway_class to base_runways
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE base_runways
  ADD COLUMN IF NOT EXISTS runway_class TEXT NOT NULL DEFAULT 'B'
    CHECK (runway_class IN ('B', 'Army_B'));

-- ═══════════════════════════════════════════════════════════════
-- 7. Seed Selfridge inspection templates
-- ═══════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_base_id UUID := '00000000-0000-0000-0000-000000000001';
  v_af_tmpl UUID;
  v_lt_tmpl UUID;
  v_sec UUID;
BEGIN
  -- Airfield template
  INSERT INTO base_inspection_templates (base_id, template_type)
  VALUES (v_base_id, 'airfield')
  ON CONFLICT (base_id, template_type) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_af_tmpl;

  -- Lighting template
  INSERT INTO base_inspection_templates (base_id, template_type)
  VALUES (v_base_id, 'lighting')
  ON CONFLICT (base_id, template_type) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_lt_tmpl;

  -- ── Airfield Section 1: Obstacle Clearance Criteria ──
  INSERT INTO base_inspection_sections (template_id, section_id, title, guidance, sort_order)
  VALUES (v_af_tmpl, 'af-1', 'Section 1 — Obstacle Clearance Criteria',
    'Tree growth, vegetation, dirt piles, ponding, construction, depressions, mobile/fixed obstacles', 1)
  ON CONFLICT (template_id, section_id) DO UPDATE SET title = EXCLUDED.title
  RETURNING id INTO v_sec;

  INSERT INTO base_inspection_items (section_id, item_key, item_number, item_text, item_type, sort_order) VALUES
    (v_sec, 'af-1', 1, 'Primary Surface — 1000'' from runway centerline', 'pass_fail', 1),
    (v_sec, 'af-2', 2, 'Transitional Slope (7:1)', 'pass_fail', 2),
    (v_sec, 'af-3', 3, 'Runway Clear Zones — 3000''L x 3000''W', 'pass_fail', 3),
    (v_sec, 'af-4', 4, 'Graded Portion of Clear Zone — 1000''L x 3000''W', 'pass_fail', 4),
    (v_sec, 'af-5', 5, 'Approach / Departure Surface (50:1)', 'pass_fail', 5),
    (v_sec, 'af-6', 6, 'Taxiway — 200'' from centerline', 'pass_fail', 6),
    (v_sec, 'af-7', 7, 'Apron — 110'' from boundary marking', 'pass_fail', 7),
    (v_sec, 'af-8', 8, 'Construction Areas', 'pass_fail', 8);

  -- ── Airfield Section 2: Signs/Lights ──
  INSERT INTO base_inspection_sections (template_id, section_id, title, guidance, sort_order)
  VALUES (v_af_tmpl, 'af-2', 'Section 2 — Signs/Lights',
    'Correct background/legend, easy to read, unobstructed, frangible, illuminated', 2)
  ON CONFLICT (template_id, section_id) DO UPDATE SET title = EXCLUDED.title
  RETURNING id INTO v_sec;

  INSERT INTO base_inspection_items (section_id, item_key, item_number, item_text, item_type, sort_order) VALUES
    (v_sec, 'af-11', 11, 'VFR Holding Positions', 'pass_fail', 1),
    (v_sec, 'af-12', 12, 'Instrument Holding Positions', 'pass_fail', 2),
    (v_sec, 'af-13', 13, 'Elevation Signs', 'pass_fail', 3),
    (v_sec, 'af-14', 14, 'Taxiway Signs', 'pass_fail', 4),
    (v_sec, 'af-15', 15, 'Windcone', 'pass_fail', 5),
    (v_sec, 'af-16', 16, 'FOD/STOP', 'pass_fail', 6),
    (v_sec, 'af-17', 17, 'Runway Signs', 'pass_fail', 7),
    (v_sec, 'af-18', 18, 'NAVAID Ground Receiver Checkpoints', 'pass_fail', 8),
    (v_sec, 'af-19', 19, 'Closed Areas', 'pass_fail', 9);

  -- ── Airfield Section 3: Construction ──
  INSERT INTO base_inspection_sections (template_id, section_id, title, sort_order)
  VALUES (v_af_tmpl, 'af-3', 'Section 3 — Construction', 3)
  ON CONFLICT (template_id, section_id) DO UPDATE SET title = EXCLUDED.title
  RETURNING id INTO v_sec;

  INSERT INTO base_inspection_items (section_id, item_key, item_number, item_text, item_type, sort_order) VALUES
    (v_sec, 'af-20', 20, 'Parking', 'pass_fail', 1),
    (v_sec, 'af-21', 21, 'Rules Compliance', 'pass_fail', 2),
    (v_sec, 'af-22', 22, 'Construction Site Lighting/Marking', 'pass_fail', 3),
    (v_sec, 'af-23', 23, 'Storage', 'pass_fail', 4),
    (v_sec, 'af-24', 24, 'Vehicles Lighted/Marked', 'pass_fail', 5),
    (v_sec, 'af-25', 25, 'FOD Control (Debris/Trash/Vehicle Routes)', 'pass_fail', 6);

  -- ── Airfield Section 4: Habitat Management ──
  INSERT INTO base_inspection_sections (template_id, section_id, title, sort_order)
  VALUES (v_af_tmpl, 'af-4', 'Section 4 — Habitat Management', 4)
  ON CONFLICT (template_id, section_id) DO UPDATE SET title = EXCLUDED.title
  RETURNING id INTO v_sec;

  INSERT INTO base_inspection_items (section_id, item_key, item_number, item_text, item_type, sort_order) VALUES
    (v_sec, 'af-26', 26, 'Grass Height (7–14")', 'pass_fail', 1),
    (v_sec, 'af-27', 27, 'Ponding Effects', 'pass_fail', 2),
    (v_sec, 'af-28', 28, 'Bird/Animal Survey', 'pass_fail', 3),
    (v_sec, 'af-29', 29, 'Bird Watch Condition (BWC)', 'bwc', 4);

  -- ── Airfield Section 5: Pavement Condition / Markings ──
  INSERT INTO base_inspection_sections (template_id, section_id, title, guidance, sort_order)
  VALUES (v_af_tmpl, 'af-5', 'Section 5 — Pavement Condition / Markings',
    'Conditions: Rubber deposits, cracks, spalling, FOD. Markings: Chipped/peeling/faded, obscure, rubber buildup', 5)
  ON CONFLICT (template_id, section_id) DO UPDATE SET title = EXCLUDED.title
  RETURNING id INTO v_sec;

  INSERT INTO base_inspection_items (section_id, item_key, item_number, item_text, item_type, sort_order) VALUES
    (v_sec, 'af-30', 30, 'Runway/Overruns 01/19', 'pass_fail', 1),
    (v_sec, 'af-31', 31, 'Taxiways', 'pass_fail', 2),
    (v_sec, 'af-32', 32, 'Access Roads / FOD Checks', 'pass_fail', 3),
    (v_sec, 'af-33', 33, 'Grounding Points', 'pass_fail', 4);

  -- ── Airfield Section 6: Airfield Driving ──
  INSERT INTO base_inspection_sections (template_id, section_id, title, sort_order)
  VALUES (v_af_tmpl, 'af-6', 'Section 6 — Airfield Driving', 6)
  ON CONFLICT (template_id, section_id) DO UPDATE SET title = EXCLUDED.title
  RETURNING id INTO v_sec;

  INSERT INTO base_inspection_items (section_id, item_key, item_number, item_text, item_type, sort_order) VALUES
    (v_sec, 'af-34', 34, 'FOD Control', 'pass_fail', 1),
    (v_sec, 'af-35', 35, 'Compliance with Procedures', 'pass_fail', 2),
    (v_sec, 'af-36', 36, 'Properly Stowed/Secured Equipment', 'pass_fail', 3);

  -- ── Airfield Section 7: FOD Control ──
  INSERT INTO base_inspection_sections (template_id, section_id, title, sort_order)
  VALUES (v_af_tmpl, 'af-7', 'Section 7 — FOD Control', 7)
  ON CONFLICT (template_id, section_id) DO UPDATE SET title = EXCLUDED.title
  RETURNING id INTO v_sec;

  INSERT INTO base_inspection_items (section_id, item_key, item_number, item_text, item_type, sort_order) VALUES
    (v_sec, 'af-37', 37, 'Runways/Overruns, Taxiways/Shoulders', 'pass_fail', 1),
    (v_sec, 'af-38', 38, 'Parking Aprons', 'pass_fail', 2),
    (v_sec, 'af-39', 39, 'Infield Areas Between Runways/Taxiways', 'pass_fail', 3),
    (v_sec, 'af-40', 40, 'Perimeter/Access Roads', 'pass_fail', 4);

  -- ── Airfield Section 8: Pre or Post Construction ──
  INSERT INTO base_inspection_sections (template_id, section_id, title, conditional, sort_order)
  VALUES (v_af_tmpl, 'af-8', 'Section 8 — Pre or Post Construction Inspection',
    'Construction meeting inspection', 8)
  ON CONFLICT (template_id, section_id) DO UPDATE SET title = EXCLUDED.title
  RETURNING id INTO v_sec;

  INSERT INTO base_inspection_items (section_id, item_key, item_number, item_text, item_type, sort_order) VALUES
    (v_sec, 'af-41', 41, 'CE, Wing Safety', 'pass_fail', 1);

  -- ── Airfield Section 9: Joint Monthly ──
  INSERT INTO base_inspection_sections (template_id, section_id, title, conditional, sort_order)
  VALUES (v_af_tmpl, 'af-9', 'Section 9 — Joint Monthly Airfield Inspection',
    'Joint Monthly Airfield Inspection', 9)
  ON CONFLICT (template_id, section_id) DO UPDATE SET title = EXCLUDED.title
  RETURNING id INTO v_sec;

  INSERT INTO base_inspection_items (section_id, item_key, item_number, item_text, item_type, sort_order) VALUES
    (v_sec, 'af-42', 42, 'TERPS, Flight & Ground Safety, SOF, CE, SFS', 'pass_fail', 1);

  -- ══════════════════════════════════════════════════════════
  -- LIGHTING TEMPLATE
  -- ══════════════════════════════════════════════════════════

  -- ── Lighting Section 1: Runway 01 Lighting ──
  INSERT INTO base_inspection_sections (template_id, section_id, title, sort_order)
  VALUES (v_lt_tmpl, 'lt-1', 'Section 1 — Runway 01 Lighting', 1)
  ON CONFLICT (template_id, section_id) DO UPDATE SET title = EXCLUDED.title
  RETURNING id INTO v_sec;

  INSERT INTO base_inspection_items (section_id, item_key, item_number, item_text, item_type, sort_order) VALUES
    (v_sec, 'lt-1', 1, '01/19 Edge Lights', 'pass_fail', 1),
    (v_sec, 'lt-2', 2, '01 Approach Lighting (SALS)', 'pass_fail', 2),
    (v_sec, 'lt-3', 3, '01 Threshold Bar / 19 Runway End Lights', 'pass_fail', 3),
    (v_sec, 'lt-4', 4, '01 PAPI', 'pass_fail', 4),
    (v_sec, 'lt-5', 5, 'South Hammerhead Edge Lights', 'pass_fail', 5);

  -- ── Lighting Section 2: Runway 19 Lighting ──
  INSERT INTO base_inspection_sections (template_id, section_id, title, sort_order)
  VALUES (v_lt_tmpl, 'lt-2', 'Section 2 — Runway 19 Lighting', 2)
  ON CONFLICT (template_id, section_id) DO UPDATE SET title = EXCLUDED.title
  RETURNING id INTO v_sec;

  INSERT INTO base_inspection_items (section_id, item_key, item_number, item_text, item_type, sort_order) VALUES
    (v_sec, 'lt-6', 6, '19 Threshold Bar / 01 Runway End Lights', 'pass_fail', 1),
    (v_sec, 'lt-7', 7, '19 PAPI', 'pass_fail', 2),
    (v_sec, 'lt-8', 8, '19 REILs', 'pass_fail', 3),
    (v_sec, 'lt-9', 9, 'Intensity Level Check on HIRLs', 'pass_fail', 4);

  -- ── Lighting Section 3: Taxiway/Apron Lighting ──
  INSERT INTO base_inspection_sections (template_id, section_id, title, sort_order)
  VALUES (v_lt_tmpl, 'lt-3', 'Section 3 — Taxiway/Apron Lighting', 3)
  ON CONFLICT (template_id, section_id) DO UPDATE SET title = EXCLUDED.title
  RETURNING id INTO v_sec;

  INSERT INTO base_inspection_items (section_id, item_key, item_number, item_text, item_type, sort_order) VALUES
    (v_sec, 'lt-10', 10, 'TWY A', 'pass_fail', 1),
    (v_sec, 'lt-11', 11, 'TWY K', 'pass_fail', 2),
    (v_sec, 'lt-12', 12, 'TWY B', 'pass_fail', 3),
    (v_sec, 'lt-13', 13, 'TWY L', 'pass_fail', 4),
    (v_sec, 'lt-14', 14, 'TWY J', 'pass_fail', 5),
    (v_sec, 'lt-15', 15, 'TWY E', 'pass_fail', 6),
    (v_sec, 'lt-16', 16, 'TWY G', 'pass_fail', 7),
    (v_sec, 'lt-17', 17, 'East Ramp', 'pass_fail', 8),
    (v_sec, 'lt-18', 18, 'West Ramp', 'pass_fail', 9),
    (v_sec, 'lt-19', 19, 'USCG Ramp', 'pass_fail', 10),
    (v_sec, 'lt-20', 20, 'DHS Ramp', 'pass_fail', 11),
    (v_sec, 'lt-21', 21, 'West Side Stadium Lights', 'pass_fail', 12),
    (v_sec, 'lt-22', 22, 'East Side Stadium Lights', 'pass_fail', 13);

  -- ── Lighting Section 4: Signs & Markings ──
  INSERT INTO base_inspection_sections (template_id, section_id, title, sort_order)
  VALUES (v_lt_tmpl, 'lt-4', 'Section 4 — Signs & Markings', 4)
  ON CONFLICT (template_id, section_id) DO UPDATE SET title = EXCLUDED.title
  RETURNING id INTO v_sec;

  INSERT INTO base_inspection_items (section_id, item_key, item_number, item_text, item_type, sort_order) VALUES
    (v_sec, 'lt-23', 23, 'Runway Hold Signs', 'pass_fail', 1),
    (v_sec, 'lt-24', 24, 'Taxiway Guidance Signs', 'pass_fail', 2),
    (v_sec, 'lt-25', 25, 'Instrument Hold Signs', 'pass_fail', 3),
    (v_sec, 'lt-26', 26, '01/19 DRMs (Distance Remaining Markers)', 'pass_fail', 4),
    (v_sec, 'lt-27', 27, 'NAVAID Checkpoint', 'pass_fail', 5),
    (v_sec, 'lt-28', 28, 'Marking Retroreflectivity', 'pass_fail', 6);

  -- ── Lighting Section 5: Miscellaneous ──
  INSERT INTO base_inspection_sections (template_id, section_id, title, sort_order)
  VALUES (v_lt_tmpl, 'lt-5', 'Section 5 — Miscellaneous', 5)
  ON CONFLICT (template_id, section_id) DO UPDATE SET title = EXCLUDED.title
  RETURNING id INTO v_sec;

  INSERT INTO base_inspection_items (section_id, item_key, item_number, item_text, item_type, sort_order) VALUES
    (v_sec, 'lt-29', 29, 'Obstruction Lights', 'pass_fail', 1),
    (v_sec, 'lt-30', 30, 'Rotating Beacon', 'pass_fail', 2),
    (v_sec, 'lt-31', 31, 'Wind Cones', 'pass_fail', 3),
    (v_sec, 'lt-32', 32, 'Construction Barriers', 'pass_fail', 4);

END $$;
