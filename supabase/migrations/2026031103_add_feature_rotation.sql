-- Add rotation column for orienting sign/feature icons on the map
ALTER TABLE infrastructure_features
  ADD COLUMN rotation SMALLINT NOT NULL DEFAULT 0;
