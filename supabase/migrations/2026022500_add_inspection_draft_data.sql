-- Add columns to support saving inspection drafts (in-progress inspections)
-- draft_data stores the raw InspectionHalfDraft JSON for resuming
-- saved_by tracks who last saved the draft and when

ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS draft_data JSONB,
  ADD COLUMN IF NOT EXISTS saved_by_name TEXT,
  ADD COLUMN IF NOT EXISTS saved_by_id UUID,
  ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ;

-- Index for efficiently finding in-progress inspections for a base
CREATE INDEX IF NOT EXISTS idx_inspections_status_base
  ON inspections (status, base_id);
