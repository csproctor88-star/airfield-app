-- Add per-runway status support for multi-runway bases.
-- The new `runway_statuses` JSONB column stores independent status for each runway.
-- Structure: { "06L/24R": { "status": "open", "active_end": "06L" }, ... }
-- Legacy `active_runway` and `runway_status` columns are kept for backward compatibility
-- and are auto-synced from the first runway entry.

ALTER TABLE airfield_status
  ADD COLUMN IF NOT EXISTS runway_statuses JSONB DEFAULT '{}'::jsonb;

-- Backfill existing rows: convert single active_runway/runway_status into the JSONB format.
-- We use the active_runway value as a key with a synthetic label.
UPDATE airfield_status
SET runway_statuses = jsonb_build_object(
  active_runway,
  jsonb_build_object('status', runway_status, 'active_end', active_runway)
)
WHERE runway_statuses = '{}'::jsonb OR runway_statuses IS NULL;
