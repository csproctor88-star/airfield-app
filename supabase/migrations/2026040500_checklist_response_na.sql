-- Add N/A support for shift checklist responses
ALTER TABLE shift_checklist_responses
  ADD COLUMN IF NOT EXISTS is_na boolean NOT NULL DEFAULT false;
