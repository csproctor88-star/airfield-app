-- Add draft persistence columns to airfield_checks
-- Mirrors the pattern from inspections table (status + draft_data + saved_by)
-- DEFAULT 'completed' grandfathers all existing rows — no backfill needed

ALTER TABLE airfield_checks
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('draft', 'completed')),
  ADD COLUMN IF NOT EXISTS draft_data JSONB,
  ADD COLUMN IF NOT EXISTS saved_by_name TEXT,
  ADD COLUMN IF NOT EXISTS saved_by_id UUID,
  ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_checks_status_base
  ON airfield_checks (status, base_id);
