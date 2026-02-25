-- Migration: Add inspector_name, weather_conditions, temperature_f to inspections
-- Date: 2026-02-17

ALTER TABLE inspections
  ADD COLUMN IF NOT EXISTS inspector_name TEXT,
  ADD COLUMN IF NOT EXISTS weather_conditions TEXT,
  ADD COLUMN IF NOT EXISTS temperature_f NUMERIC(5,1);

-- Make inspector_id nullable for demo mode / anonymous submissions
ALTER TABLE inspections
  ALTER COLUMN inspector_id DROP NOT NULL;
