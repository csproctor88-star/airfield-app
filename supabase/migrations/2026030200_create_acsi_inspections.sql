-- ============================================================
-- ACSI Inspections Table + Photo FK Columns + RLS
-- Airfield Compliance and Safety Inspection (DAFMAN 13-204v2, Para 5.4.3)
-- ============================================================

CREATE TABLE acsi_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id TEXT NOT NULL,
  base_id UUID REFERENCES bases(id),
  airfield_name TEXT NOT NULL DEFAULT '',
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  fiscal_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'staffed')),

  -- Checklist items (JSONB array)
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_items INTEGER NOT NULL DEFAULT 0,
  passed_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  na_count INTEGER NOT NULL DEFAULT 0,

  -- Inspection team (JSONB array of {role, name, rank, title})
  inspection_team JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Risk Management Certification signatures (JSONB array of {organization, name, rank, title})
  risk_cert_signatures JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- General
  notes TEXT,
  inspector_id UUID,
  inspector_name TEXT,

  -- Draft persistence
  draft_data JSONB,

  -- Workflow timestamps
  completed_at TIMESTAMPTZ,
  completed_by_name TEXT,
  completed_by_id UUID,
  filed_at TIMESTAMPTZ,
  filed_by_name TEXT,
  filed_by_id UUID,
  saved_at TIMESTAMPTZ,
  saved_by_name TEXT,
  saved_by_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for base-scoped queries
CREATE INDEX idx_acsi_inspections_base_id ON acsi_inspections(base_id);
CREATE INDEX idx_acsi_inspections_status ON acsi_inspections(status);

-- ============================================================
-- Add ACSI photo FK columns to photos table
-- ============================================================
ALTER TABLE photos ADD COLUMN IF NOT EXISTS acsi_inspection_id UUID REFERENCES acsi_inspections(id) ON DELETE CASCADE;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS acsi_item_id TEXT;

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE acsi_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acsi_inspections_select" ON acsi_inspections
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "acsi_inspections_insert" ON acsi_inspections
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "acsi_inspections_update" ON acsi_inspections
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));

CREATE POLICY "acsi_inspections_delete" ON acsi_inspections
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));
