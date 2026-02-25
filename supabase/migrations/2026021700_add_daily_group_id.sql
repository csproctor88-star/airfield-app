-- Add daily_group_id to link airfield + lighting inspection halves
-- When a daily inspection is filed, both halves share the same group UUID

ALTER TABLE inspections ADD COLUMN daily_group_id UUID;
CREATE INDEX idx_inspections_daily_group ON inspections(daily_group_id);
