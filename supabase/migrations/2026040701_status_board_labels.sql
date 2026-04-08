-- Custom labels for status board sections and NAVAID groups
-- Stores overrides like {"navaid_other": "WEATHER", "section_arff": "CRASH/RESCUE"}
ALTER TABLE bases
  ADD COLUMN IF NOT EXISTS status_labels JSONB NOT NULL DEFAULT '{}'::jsonb;
