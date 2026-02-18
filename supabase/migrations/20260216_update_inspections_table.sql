-- Migration: Update inspections table for dual Airfield/Lighting inspection system
-- Date: 2026-02-16

-- 1. Update inspection_type CHECK constraint
ALTER TABLE inspections
  DROP CONSTRAINT IF EXISTS inspections_inspection_type_check;

ALTER TABLE inspections
  ADD CONSTRAINT inspections_inspection_type_check
  CHECK (inspection_type IN ('airfield', 'lighting'));

-- 2. Add conditional section flags and BWC value
ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS construction_meeting BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS joint_monthly BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bwc_value TEXT CHECK (bwc_value IS NULL OR bwc_value IN ('LOW', 'MOD', 'SEV', 'PROHIB'));

-- 3. Migrate existing rows from old types to 'airfield'
UPDATE inspections
  SET inspection_type = 'airfield'
  WHERE inspection_type IN ('daily', 'semi_annual', 'annual');
