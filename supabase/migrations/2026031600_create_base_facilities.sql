-- Create base_facilities table for per-installation facility numbers
CREATE TABLE IF NOT EXISTS base_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  facility_number TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_base_facilities_base_id ON base_facilities(base_id);

-- Add facility_number column to discrepancies
ALTER TABLE discrepancies ADD COLUMN IF NOT EXISTS facility_number TEXT;

-- RLS
ALTER TABLE base_facilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users with base access can read facilities" ON base_facilities;
CREATE POLICY "Users with base access can read facilities"
  ON base_facilities FOR SELECT
  USING (user_has_base_access(auth.uid(), base_id));

DROP POLICY IF EXISTS "Writers can manage facilities" ON base_facilities;
CREATE POLICY "Writers can manage facilities"
  ON base_facilities FOR ALL
  USING (user_can_write(auth.uid()))
  WITH CHECK (user_can_write(auth.uid()));
