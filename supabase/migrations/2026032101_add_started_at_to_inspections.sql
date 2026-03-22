-- Add started_at column to inspections to capture when the inspector
-- actually begins the walkdown (not when the draft was created).
-- Enables accurate duration tracking: started_at → filed_at
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
