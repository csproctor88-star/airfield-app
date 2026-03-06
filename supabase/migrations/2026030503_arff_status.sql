-- Config table for ARFF aircraft per base (follows base_navaids pattern)
CREATE TABLE base_arff_aircraft (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  aircraft_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(base_id, aircraft_name)
);
CREATE INDEX idx_base_arff_aircraft_base ON base_arff_aircraft(base_id);

-- RLS: read all, write admin (matches base_navaids/base_areas)
ALTER TABLE base_arff_aircraft ENABLE ROW LEVEL SECURITY;
CREATE POLICY "base_arff_aircraft_select" ON base_arff_aircraft FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "base_arff_aircraft_insert" ON base_arff_aircraft FOR INSERT TO authenticated WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));
CREATE POLICY "base_arff_aircraft_update" ON base_arff_aircraft FOR UPDATE TO authenticated USING (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));
CREATE POLICY "base_arff_aircraft_delete" ON base_arff_aircraft FOR DELETE TO authenticated USING (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));

-- Add ARFF columns to airfield_status (already has realtime enabled)
ALTER TABLE airfield_status ADD COLUMN arff_cat INTEGER CHECK (arff_cat BETWEEN 6 AND 10);
ALTER TABLE airfield_status ADD COLUMN arff_statuses JSONB DEFAULT '{}';
-- arff_statuses structure: { "A-10": "optimum", "K35R": "reduced" }

-- Seed Selfridge with A-10 and K35R
INSERT INTO base_arff_aircraft (base_id, aircraft_name, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'A-10', 0),
  ('00000000-0000-0000-0000-000000000001', 'K35R', 1);
