-- ═══════════════════════════════════════════════════════════════
-- Waivers Module v2 — Full rebuild with AF Form 505 schema
-- Drops old simple table, creates 5 tables for rich waiver mgmt
-- ═══════════════════════════════════════════════════════════════

-- Drop old simple waivers table (empty — safe to drop)
DROP TABLE IF EXISTS waivers CASCADE;

-- Add installation_code to bases for waiver numbering (P-CODE-YY-##)
ALTER TABLE bases ADD COLUMN IF NOT EXISTS installation_code TEXT;
UPDATE bases SET installation_code = 'VGLZ' WHERE icao = 'KMTC' AND installation_code IS NULL;

-- ───────────────────────────────────────────
-- 1. waivers — primary waiver record
-- ───────────────────────────────────────────
CREATE TABLE waivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID REFERENCES bases(id),
  waiver_number TEXT UNIQUE NOT NULL,
  classification TEXT NOT NULL CHECK (classification IN (
    'permanent','temporary','construction','event','extension','amendment'
  )),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','pending','approved','active','completed','cancelled','expired'
  )),
  hazard_rating TEXT CHECK (hazard_rating IN (
    'low','medium','high','extremely_high'
  )),
  action_requested TEXT CHECK (action_requested IN (
    'new','extension','amendment'
  )),
  description TEXT NOT NULL DEFAULT '',
  justification TEXT,
  risk_assessment_summary TEXT,
  corrective_action TEXT,
  criteria_impact TEXT,
  proponent TEXT,
  project_number TEXT,
  program_fy INTEGER,
  estimated_cost DECIMAL,
  project_status TEXT,
  faa_case_number TEXT,
  period_valid TEXT,
  date_submitted DATE,
  date_approved DATE,
  expiration_date DATE,
  last_reviewed_date DATE,
  next_review_due DATE,
  location_description TEXT,
  location_lat DECIMAL,
  location_lng DECIMAL,
  notes TEXT,
  photo_count INTEGER NOT NULL DEFAULT 0,
  attachment_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_waivers_base_id ON waivers(base_id);
CREATE INDEX idx_waivers_status ON waivers(status);
CREATE INDEX idx_waivers_classification ON waivers(classification);
CREATE INDEX idx_waivers_expiration_date ON waivers(expiration_date);
CREATE INDEX idx_waivers_next_review_due ON waivers(next_review_due);

ALTER TABLE waivers DISABLE ROW LEVEL SECURITY;

-- ───────────────────────────────────────────
-- 2. waiver_criteria — UFC/standards references
-- ───────────────────────────────────────────
CREATE TABLE waiver_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waiver_id UUID NOT NULL REFERENCES waivers(id) ON DELETE CASCADE,
  criteria_source TEXT NOT NULL CHECK (criteria_source IN (
    'ufc_3_260_01','ufc_3_260_04','ufc_3_535_01','other'
  )),
  reference TEXT,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_waiver_criteria_waiver_id ON waiver_criteria(waiver_id);

ALTER TABLE waiver_criteria DISABLE ROW LEVEL SECURITY;

-- ───────────────────────────────────────────
-- 3. waiver_attachments — photos, docs, maps
-- ───────────────────────────────────────────
CREATE TABLE waiver_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waiver_id UUID NOT NULL REFERENCES waivers(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN (
    'photo','site_map','risk_assessment','ufc_excerpt',
    'faa_report','coordination_sheet','af_form_505','other'
  )),
  file_size INTEGER,
  mime_type TEXT,
  caption TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_waiver_attachments_waiver_id ON waiver_attachments(waiver_id);

ALTER TABLE waiver_attachments DISABLE ROW LEVEL SECURITY;

-- ───────────────────────────────────────────
-- 4. waiver_reviews — annual review tracking
-- ───────────────────────────────────────────
CREATE TABLE waiver_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waiver_id UUID NOT NULL REFERENCES waivers(id) ON DELETE CASCADE,
  review_year INTEGER NOT NULL,
  review_date DATE,
  reviewed_by UUID REFERENCES profiles(id),
  recommendation TEXT CHECK (recommendation IN (
    'retain','modify','cancel','convert_to_temporary','convert_to_permanent'
  )),
  mitigation_verified BOOLEAN DEFAULT false,
  project_status_update TEXT,
  notes TEXT,
  presented_to_facilities_board BOOLEAN DEFAULT false,
  facilities_board_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(waiver_id, review_year)
);

CREATE INDEX idx_waiver_reviews_waiver_id ON waiver_reviews(waiver_id);
CREATE INDEX idx_waiver_reviews_year ON waiver_reviews(review_year);

ALTER TABLE waiver_reviews DISABLE ROW LEVEL SECURITY;

-- ───────────────────────────────────────────
-- 5. waiver_coordination — office coordination
-- ───────────────────────────────────────────
CREATE TABLE waiver_coordination (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waiver_id UUID NOT NULL REFERENCES waivers(id) ON DELETE CASCADE,
  office TEXT NOT NULL CHECK (office IN (
    'civil_engineer','airfield_manager','airfield_ops_terps',
    'base_safety','installation_cc','other'
  )),
  office_label TEXT,
  coordinator_name TEXT,
  coordinated_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','concur','non_concur'
  )),
  comments TEXT
);

CREATE INDEX idx_waiver_coordination_waiver_id ON waiver_coordination(waiver_id);

ALTER TABLE waiver_coordination DISABLE ROW LEVEL SECURITY;
