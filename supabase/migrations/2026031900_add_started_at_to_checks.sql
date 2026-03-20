-- Add started_at column to airfield_checks to capture when the check began
-- This enables accurate duration tracking (started_at → completed_at)
ALTER TABLE airfield_checks ADD COLUMN IF NOT EXISTS started_at timestamptz;
