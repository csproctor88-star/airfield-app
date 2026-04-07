-- Add section column to custom_status_boards
-- Boards can be assigned to a section on the dashboard: runway, navaid, arff, or standalone
ALTER TABLE custom_status_boards
  ADD COLUMN IF NOT EXISTS section TEXT NOT NULL DEFAULT 'standalone'
  CHECK (section IN ('runway', 'navaid', 'arff', 'standalone'));
