-- Add RSC/RCR columns to inspections table
-- Allows inspections to capture and persist runway condition data
ALTER TABLE inspections ADD COLUMN rsc_condition TEXT;
ALTER TABLE inspections ADD COLUMN rcr_value TEXT;
ALTER TABLE inspections ADD COLUMN rcr_condition TEXT;
