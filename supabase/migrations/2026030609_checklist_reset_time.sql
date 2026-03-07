-- Add configurable checklist reset time to bases (HH:MM in local time, e.g. '06:00')
ALTER TABLE bases ADD COLUMN IF NOT EXISTS checklist_reset_time TEXT NOT NULL DEFAULT '06:00';
