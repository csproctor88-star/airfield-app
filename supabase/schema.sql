-- Airfield OPS Management Suite — Supabase Schema
-- Source: SRS Section 5
-- Run this in Supabase SQL Editor to create all tables

-- 5.1 Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  rank TEXT,
  role TEXT NOT NULL DEFAULT 'observer',
  organization TEXT,
  shop TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5.7 NOTAMs (created before discrepancies due to FK)
CREATE TABLE notams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notam_number TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('faa', 'local')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'cancelled', 'expired')),
  notam_type TEXT,
  title TEXT NOT NULL,
  full_text TEXT NOT NULL,
  effective_start TIMESTAMPTZ NOT NULL,
  effective_end TIMESTAMPTZ,
  linked_discrepancy_id UUID,
  created_by UUID REFERENCES profiles(id),
  cancelled_by UUID REFERENCES profiles(id),
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notams_status ON notams(status);
CREATE INDEX idx_notams_source ON notams(source);
CREATE INDEX idx_notams_effective ON notams(effective_start, effective_end);

-- 5.6 Inspections (created before discrepancies due to FK)
CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id TEXT NOT NULL UNIQUE,
  inspection_type TEXT NOT NULL CHECK (inspection_type IN ('airfield', 'lighting', 'construction_meeting', 'joint_monthly')),
  inspector_id UUID REFERENCES profiles(id),
  inspector_name TEXT,
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  items JSONB NOT NULL DEFAULT '[]',
  total_items INTEGER NOT NULL DEFAULT 0,
  passed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  na_count INTEGER NOT NULL DEFAULT 0,
  completion_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  construction_meeting BOOLEAN NOT NULL DEFAULT false,
  joint_monthly BOOLEAN NOT NULL DEFAULT false,
  personnel TEXT[] NOT NULL DEFAULT '{}',
  bwc_value TEXT CHECK (bwc_value IS NULL OR bwc_value IN ('LOW', 'MOD', 'SEV', 'PROHIB')),
  weather_conditions TEXT,
  temperature_f NUMERIC(5,1),
  notes TEXT,
  daily_group_id UUID,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inspections_daily_group ON inspections(daily_group_id);

-- 5.2 Discrepancies
CREATE TABLE discrepancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'no' CHECK (severity IN ('yes', 'no', 'critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'cancelled')),
  current_status TEXT NOT NULL DEFAULT 'submitted_to_afm' CHECK (current_status IN ('submitted_to_afm', 'submitted_to_ces', 'awaiting_action_by_ces', 'work_completed_awaiting_verification')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location_text TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  assigned_shop TEXT,
  assigned_to UUID REFERENCES profiles(id),
  reported_by UUID NOT NULL REFERENCES profiles(id),
  work_order_number TEXT,
  notam_reference TEXT,
  linked_notam_id UUID REFERENCES notams(id),
  inspection_id UUID REFERENCES inspections(id),
  resolution_notes TEXT,
  resolution_date TIMESTAMPTZ,
  photo_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_discrepancies_status ON discrepancies(status);
CREATE INDEX idx_discrepancies_severity ON discrepancies(severity);
CREATE INDEX idx_discrepancies_type ON discrepancies(type);
CREATE INDEX idx_discrepancies_assigned_shop ON discrepancies(assigned_shop);
CREATE INDEX idx_discrepancies_created_at ON discrepancies(created_at DESC);

-- Add FK from notams back to discrepancies
ALTER TABLE notams ADD CONSTRAINT fk_notams_discrepancy
  FOREIGN KEY (linked_discrepancy_id) REFERENCES discrepancies(id);

-- 5.5 Airfield Checks
CREATE TABLE airfield_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id TEXT NOT NULL UNIQUE,
  check_type TEXT NOT NULL CHECK (check_type IN ('fod', 'rsc', 'ife', 'ground_emergency', 'heavy_aircraft', 'bash', 'rcr')),
  areas TEXT[] NOT NULL DEFAULT '{}',
  data JSONB NOT NULL DEFAULT '{}',
  completed_by TEXT,
  completed_at TIMESTAMPTZ,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  photo_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checks_type ON airfield_checks(check_type);
CREATE INDEX idx_checks_completed ON airfield_checks(completed_at DESC);

-- 5.5b Check Comments (remarks timeline)
CREATE TABLE check_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id UUID NOT NULL REFERENCES airfield_checks(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  user_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_check_comments_check ON check_comments(check_id, created_at ASC);

-- 5.3 Photos
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discrepancy_id UUID REFERENCES discrepancies(id) ON DELETE CASCADE,
  check_id UUID REFERENCES airfield_checks(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT photo_parent_check CHECK (
    (discrepancy_id IS NOT NULL AND check_id IS NULL) OR
    (discrepancy_id IS NULL AND check_id IS NOT NULL)
  )
);

-- 5.4 Status Updates (Audit Trail)
CREATE TABLE status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discrepancy_id UUID NOT NULL REFERENCES discrepancies(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT,
  notes TEXT,
  updated_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_status_updates_discrepancy ON status_updates(discrepancy_id, created_at DESC);

-- 5.8 Obstruction Evaluations
CREATE TABLE obstruction_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id TEXT UNIQUE,
  runway_class TEXT NOT NULL CHECK (runway_class IN ('A', 'B')),
  object_height_agl NUMERIC(10,2) NOT NULL,
  object_distance_ft NUMERIC(10,2),
  distance_from_centerline_ft NUMERIC(10,2),
  object_elevation_msl NUMERIC(10,2),
  obstruction_top_msl NUMERIC(10,2),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  description TEXT,
  photo_storage_path TEXT,
  results JSONB NOT NULL DEFAULT '[]',
  controlling_surface TEXT,
  violated_surfaces TEXT[] DEFAULT '{}',
  has_violation BOOLEAN NOT NULL DEFAULT false,
  evaluated_by UUID NOT NULL REFERENCES profiles(id),
  linked_discrepancy_id UUID REFERENCES discrepancies(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5.9 Activity Log
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  entity_display_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);

-- 5.9b NAVAID Status Tracking
CREATE TABLE navaid_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  navaid_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'green' CHECK (status IN ('green', 'yellow', 'red')),
  notes TEXT,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO navaid_statuses (navaid_name) VALUES
  ('01 Localizer'),
  ('01 Glideslope'),
  ('01 ILS'),
  ('19 Localizer'),
  ('19 Glideslope'),
  ('19 ILS');

-- 5.10 Sequences for display IDs
CREATE SEQUENCE discrepancy_seq START 1;
CREATE SEQUENCE work_order_seq START 1;
CREATE SEQUENCE check_seq START 1;
CREATE SEQUENCE inspection_seq START 1;
CREATE SEQUENCE local_notam_seq START 1;

CREATE OR REPLACE FUNCTION generate_display_id(prefix TEXT, seq_name TEXT)
RETURNS TEXT AS $$
DECLARE
  next_val INTEGER;
  current_year TEXT;
BEGIN
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_val;
  current_year := to_char(now(), 'YYYY');
  RETURN prefix || '-' || current_year || '-' || lpad(next_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- 5.11 Regulations Database
CREATE TABLE regulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reg_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  publication_date TEXT,
  url TEXT,
  source_section TEXT NOT NULL,
  source_volume TEXT,
  category TEXT NOT NULL,
  pub_type TEXT NOT NULL,
  is_core BOOLEAN NOT NULL DEFAULT false,
  is_cross_ref BOOLEAN NOT NULL DEFAULT false,
  is_scrubbed BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_regulations_category ON regulations(category);
CREATE INDEX idx_regulations_pub_type ON regulations(pub_type);
CREATE INDEX idx_regulations_source_section ON regulations(source_section);
CREATE INDEX idx_regulations_reg_id ON regulations(reg_id);

-- NOTE: Row Level Security policies are intentionally omitted from this schema.
-- RLS and role-based access control will be added in a later development phase.
-- For now, all authenticated users have full access to all tables.
