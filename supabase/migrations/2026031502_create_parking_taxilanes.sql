-- Parking Taxilanes & Apron Boundaries
-- Tables: parking_taxilanes, parking_apron_boundaries

-- ── Parking Taxilanes ──
CREATE TABLE IF NOT EXISTS parking_taxilanes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES parking_plans(id) ON DELETE CASCADE,
  name TEXT,
  taxilane_type TEXT NOT NULL DEFAULT 'interior' CHECK (taxilane_type IN ('interior', 'peripheral')),
  design_aircraft TEXT,
  design_wingspan_ft DOUBLE PRECISION,
  line_coords JSONB NOT NULL DEFAULT '[]',
  is_transient BOOLEAN DEFAULT false,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_parking_taxilanes_plan ON parking_taxilanes(plan_id);
CREATE INDEX idx_parking_taxilanes_base ON parking_taxilanes(base_id);

-- ── Parking Apron Boundaries ──
CREATE TABLE IF NOT EXISTS parking_apron_boundaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES parking_plans(id) ON DELETE CASCADE,
  name TEXT,
  polygon_coords JSONB NOT NULL DEFAULT '[]',
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_parking_apron_boundaries_plan ON parking_apron_boundaries(plan_id);
CREATE INDEX idx_parking_apron_boundaries_base ON parking_apron_boundaries(base_id);

-- ── RLS Policies ──
ALTER TABLE parking_taxilanes ENABLE ROW LEVEL SECURITY;
ALTER TABLE parking_apron_boundaries ENABLE ROW LEVEL SECURITY;

-- ── Parking Taxilanes ──
CREATE POLICY "parking_taxilanes_select" ON parking_taxilanes
  FOR SELECT USING (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "parking_taxilanes_insert" ON parking_taxilanes
  FOR INSERT WITH CHECK (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "parking_taxilanes_update" ON parking_taxilanes
  FOR UPDATE USING (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "parking_taxilanes_delete" ON parking_taxilanes
  FOR DELETE USING (user_has_base_access(auth.uid(), base_id));

-- ── Parking Apron Boundaries ──
CREATE POLICY "parking_apron_boundaries_select" ON parking_apron_boundaries
  FOR SELECT USING (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "parking_apron_boundaries_insert" ON parking_apron_boundaries
  FOR INSERT WITH CHECK (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "parking_apron_boundaries_update" ON parking_apron_boundaries
  FOR UPDATE USING (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "parking_apron_boundaries_delete" ON parking_apron_boundaries
  FOR DELETE USING (user_has_base_access(auth.uid(), base_id));
