-- Add per-user tracking: who completed each checklist half, who filed the inspection
ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS completed_by_name TEXT,
  ADD COLUMN IF NOT EXISTS completed_by_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS filed_by_name TEXT,
  ADD COLUMN IF NOT EXISTS filed_by_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS filed_at TIMESTAMPTZ;

-- Backfill existing rows: set completed_by from inspector_name/inspector_id
UPDATE inspections
  SET completed_by_name = inspector_name,
      completed_by_id = inspector_id,
      filed_by_name = inspector_name,
      filed_by_id = inspector_id,
      filed_at = completed_at
  WHERE completed_by_name IS NULL;
