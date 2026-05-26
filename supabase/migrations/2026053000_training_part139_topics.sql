-- ============================================================
-- Phase 3a step 1 — §139.303 Training: topic catalog
--
-- Two-tier topic model: system rows (base_id NULL) seed the 13 FAA
-- §139.303(e) topics so every civilian base starts with the same
-- canonical catalog. Bases can clone-and-override or add custom topics
-- by inserting a row with their own base_id. Application layer renders
-- system rows + base rows together, sorted by sort_order.
--
-- `applies_to` defaults to '{faa_part139}' so the module is civilian-
-- only at first launch; a USAF base that wants to use the same UI for
-- non-1C7X1 training (one-off generic training records) can flip the
-- array on a base row to include 'usaf'. AMTR is untouched and stays
-- the canonical 1C7X1 record.
-- ============================================================

CREATE TABLE IF NOT EXISTS training_topics (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id                     UUID REFERENCES bases(id) ON DELETE CASCADE,  -- NULL = system seed row
  code                        TEXT NOT NULL,                                -- e.g. '139.303(e)(5)'
  title                       TEXT NOT NULL,
  description                 TEXT,
  source                      TEXT NOT NULL DEFAULT '14 CFR §139.303(e)',
  applies_to                  TEXT[] NOT NULL DEFAULT '{faa_part139}',
  initial_required            BOOLEAN NOT NULL DEFAULT TRUE,
  recurrent_frequency_months  INT NOT NULL DEFAULT 12,
  retention_months            INT NOT NULL DEFAULT 24,
  material_url                TEXT,                                          -- optional reference (slide deck / LMS URL)
  active                      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order                  INT NOT NULL DEFAULT 100,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (base_id, code)
);

CREATE INDEX IF NOT EXISTS idx_training_topics_base ON training_topics (base_id) WHERE base_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_training_topics_code ON training_topics (code);

COMMENT ON TABLE  training_topics IS '§139.303 training topic catalog. System rows (base_id NULL) seed the 13 FAA topics; base rows override or add custom.';
COMMENT ON COLUMN training_topics.retention_months IS 'How long a completed record must be retained beyond completed_at. §139.303 mandates 24 months.';
COMMENT ON COLUMN training_topics.recurrent_frequency_months IS 'How often the training must be repeated. §139.303 implies 12 months as the operational default; base rows can override.';

-- ── Seed: 13 §139.303(e) topics ─────────────────────────────
-- Each row is a system topic (base_id NULL). Descriptions are concise
-- summaries of the §139.303(e) language and intended audience — the
-- full reg text lives in the regulations library; this is the field
-- guide subset that admin pages render inline.
INSERT INTO training_topics (code, title, description, sort_order) VALUES
  ('139.303(e)(1)',  'Airport familiarization — signs, markings, and lighting',
                     'Identify airport sign/marking/lighting configurations and the meaning of each. Covers mandatory instruction signs, runway holding-position markings, taxiway directional markings, and the lighting state convention.', 10),
  ('139.303(e)(2)',  'Procedures for access to movement and safety areas',
                     'How personnel and vehicles access movement and safety areas, including authorization rules, escort requirements, and runway-incursion prevention.', 20),
  ('139.303(e)(3)',  'Aircraft rescue and firefighting (ARFF) familiarization',
                     'Familiarization with ARFF index, equipment, response routes, and coordination with the ARFF chief. Required of all personnel with movement-area duties, not just ARFF crew.', 30),
  ('139.303(e)(4)',  'Marking and lighting of obstructions',
                     'Identifying obstructions, applying FAA AC 70/7460-1 marking and lighting standards, and reporting obstruction outages.', 40),
  ('139.303(e)(5)',  'Procedures for reporting unsafe airport conditions',
                     'Who to notify and how to document unsafe conditions, with timing requirements per §139.339 (NOTAM issuance) and the airport''s internal escalation chain.', 50),
  ('139.303(e)(6)',  'Self-inspection program (§139.327)',
                     'Conducting and documenting the daily self-inspection: required inspection points, common findings, and the discrepancy lifecycle.', 60),
  ('139.303(e)(7)',  'Pedestrians and ground vehicles in movement areas',
                     'Rules for pedestrian and vehicle operations in movement areas, including radio procedures, escort, and reporting violations.', 70),
  ('139.303(e)(8)',  'Discrepancy reporting procedures',
                     'How to identify, document, and route airfield discrepancies through the airport''s tracking system.', 80),
  ('139.303(e)(9)',  'NOTAM issuance for airfield conditions',
                     'When a NOTAM is required, what content the FAA NOTAM system expects, and the airport''s own role in originating vs. relaying NOTAMs.', 90),
  ('139.303(e)(10)', 'Wildlife hazard management',
                     'Identifying wildlife hazards, recording sightings and strikes per AC 150/5200-32B, and the Wildlife Hazard Management Plan (WHMP) where applicable.', 100),
  ('139.303(e)(11)', 'Public protection and airport security',
                     'Public-side access controls, SIDA fundamentals, and coordination with 49 CFR Part 1542 security personnel.', 110),
  ('139.303(e)(12)', 'Fueling supervision and inspection',
                     'Supervising fueling agents, conducting periodic fueling-facility inspections, and the §139.321 inspection schedule.', 120),
  ('139.303(e)(13)', 'Snow and ice control procedures',
                     'Executing the Snow and Ice Control Plan: priorities, equipment staging, runway condition (RwyCC) assessment, FICON NOTAM generation, and TALPA reporting per AC 150/5200-30D.', 130)
ON CONFLICT (base_id, code) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
