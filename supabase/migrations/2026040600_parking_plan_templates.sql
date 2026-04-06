-- Add is_template flag to parking_plans for reusable plan templates
ALTER TABLE parking_plans ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false;
