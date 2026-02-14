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
  inspection_type TEXT NOT NULL CHECK (inspection_type IN ('daily', 'semi_annual', 'annual')),
  inspector_id UUID NOT NULL REFERENCES profiles(id),
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  items JSONB NOT NULL DEFAULT '[]',
  total_items INTEGER NOT NULL DEFAULT 0,
  passed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  na_count INTEGER NOT NULL DEFAULT 0,
  completion_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5.2 Discrepancies
CREATE TABLE discrepancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'no' CHECK (severity IN ('yes', 'no', 'critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('open', 'submitted', 'assigned', 'in_progress', 'resolved', 'closed', 'completed', 'cancelled')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location_text TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  assigned_shop TEXT,
  assigned_to UUID REFERENCES profiles(id),
  reported_by UUID NOT NULL REFERENCES profiles(id),
  work_order_number TEXT,
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
  check_type TEXT NOT NULL CHECK (check_type IN ('fod', 'bash', 'rcr', 'rsc', 'emergency')),
  performed_by UUID NOT NULL REFERENCES profiles(id),
  check_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  data JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  photo_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_checks_type ON airfield_checks(check_type);
CREATE INDEX idx_checks_date ON airfield_checks(check_date DESC);

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
  new_status TEXT NOT NULL,
  notes TEXT,
  updated_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_status_updates_discrepancy ON status_updates(discrepancy_id, created_at DESC);

-- 5.8 Obstruction Evaluations
CREATE TABLE obstruction_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  runway_class TEXT NOT NULL CHECK (runway_class IN ('A', 'B')),
  object_height_agl NUMERIC(10,2) NOT NULL,
  object_distance_ft NUMERIC(10,2),
  object_elevation_msl NUMERIC(10,2),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  results JSONB NOT NULL DEFAULT '[]',
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

-- 5.12 Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active profiles" ON profiles FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage profiles" ON profiles FOR ALL USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('sys_admin', 'airfield_manager'))
);

ALTER TABLE discrepancies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AM roles full access" ON discrepancies FOR ALL USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('airfield_manager', 'am_ncoic', 'am_tech', 'sys_admin'))
);
CREATE POLICY "CE sees assigned" ON discrepancies FOR SELECT USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'ce_shop')
  AND assigned_shop = (SELECT shop FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "CE updates assigned" ON discrepancies FOR UPDATE USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'ce_shop')
  AND assigned_shop = (SELECT shop FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "Observers read all" ON discrepancies FOR SELECT USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('wing_safety', 'atc', 'observer'))
);

ALTER TABLE airfield_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AM roles full access" ON airfield_checks FOR ALL USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('airfield_manager', 'am_ncoic', 'am_tech', 'sys_admin'))
);
CREATE POLICY "Others read checks" ON airfield_checks FOR SELECT USING (true);

ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AM roles full access" ON inspections FOR ALL USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('airfield_manager', 'am_ncoic', 'am_tech', 'sys_admin'))
);
CREATE POLICY "Others read inspections" ON inspections FOR SELECT USING (true);

ALTER TABLE notams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AM roles manage notams" ON notams FOR ALL USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('airfield_manager', 'am_ncoic', 'sys_admin'))
);
CREATE POLICY "Everyone reads notams" ON notams FOR SELECT USING (true);

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AM roles manage photos" ON photos FOR ALL USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('airfield_manager', 'am_ncoic', 'am_tech', 'sys_admin'))
);
CREATE POLICY "Everyone reads photos" ON photos FOR SELECT USING (true);

ALTER TABLE status_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "AM roles manage status" ON status_updates FOR ALL USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role IN ('airfield_manager', 'am_ncoic', 'am_tech', 'sys_admin'))
);
CREATE POLICY "CE updates own" ON status_updates FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'ce_shop')
);
CREATE POLICY "Everyone reads status" ON status_updates FOR SELECT USING (true);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone reads activity" ON activity_log FOR SELECT USING (true);
CREATE POLICY "System inserts activity" ON activity_log FOR INSERT WITH CHECK (true);
