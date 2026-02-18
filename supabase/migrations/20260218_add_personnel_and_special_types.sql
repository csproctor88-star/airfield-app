-- Add personnel array column for construction meeting / joint monthly inspections
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS personnel TEXT[] NOT NULL DEFAULT '{}';

-- Update inspection_type CHECK constraint to allow new types
ALTER TABLE inspections DROP CONSTRAINT IF EXISTS inspections_inspection_type_check;
ALTER TABLE inspections ADD CONSTRAINT inspections_inspection_type_check
  CHECK (inspection_type IN ('airfield', 'lighting', 'construction_meeting', 'joint_monthly'));
