-- Add bar_group_id to infrastructure_features
-- Groups individual lights that were placed together as a single bar.
-- Used by the outage engine to evaluate approach light system outages
-- at bar granularity rather than individual light granularity.

ALTER TABLE infrastructure_features
  ADD COLUMN bar_group_id UUID DEFAULT NULL;

-- Index for efficient grouping queries
CREATE INDEX IF NOT EXISTS idx_infra_features_bar_group
  ON infrastructure_features (bar_group_id)
  WHERE bar_group_id IS NOT NULL;
