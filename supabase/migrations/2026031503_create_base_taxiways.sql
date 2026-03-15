-- Base Taxiways — installation-level taxiway centerline geometry
-- Used by obstruction evaluation engine for UFC 3-260-01 taxiway OFA/safety area surfaces

CREATE TABLE IF NOT EXISTS base_taxiways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  designator TEXT NOT NULL,                              -- e.g., 'A', 'B', 'K', 'Alpha'
  taxiway_type TEXT NOT NULL DEFAULT 'taxiway' CHECK (taxiway_type IN ('taxiway', 'taxilane')),
  tdg INTEGER NOT NULL DEFAULT 3 CHECK (tdg BETWEEN 1 AND 7),  -- Taxiway Design Group (1-7)
  width_ft DOUBLE PRECISION,                             -- Pavement width (ft)
  centerline_coords JSONB NOT NULL DEFAULT '[]',         -- Array of [lng, lat] coordinate pairs forming the centerline
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_base_taxiways_base ON base_taxiways(base_id);

-- RLS Policies
ALTER TABLE base_taxiways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "base_taxiways_select" ON base_taxiways
  FOR SELECT USING (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "base_taxiways_insert" ON base_taxiways
  FOR INSERT WITH CHECK (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "base_taxiways_update" ON base_taxiways
  FOR UPDATE USING (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "base_taxiways_delete" ON base_taxiways
  FOR DELETE USING (user_has_base_access(auth.uid(), base_id));
