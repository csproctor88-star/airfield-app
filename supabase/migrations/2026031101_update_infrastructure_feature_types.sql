-- ═══════════════════════════════════════════════════════════════
-- Update infrastructure_features feature_type values and CHECK
-- ═══════════════════════════════════════════════════════════════

-- 1. Drop old CHECK constraint FIRST so updates don't violate it
ALTER TABLE infrastructure_features DROP CONSTRAINT IF EXISTS infrastructure_features_feature_type_check;

-- 2. Consolidate taxi types + airfield_light → taxiway_light
UPDATE infrastructure_features SET feature_type = 'taxiway_light'
  WHERE feature_type IN ('taxi_edge_light', 'taxi_edge_light_elev', 'taxilight', 'airfield_light');

-- 3. runway_light → runway_edge_light
UPDATE infrastructure_features SET feature_type = 'runway_edge_light'
  WHERE feature_type = 'runway_light';

-- 4. airfield_sign → location_sign
UPDATE infrastructure_features SET feature_type = 'location_sign'
  WHERE feature_type = 'airfield_sign';

-- 5. Delete marking_label features
DELETE FROM infrastructure_features WHERE feature_type = 'marking_label';

-- 6. Add new CHECK constraint with updated feature types
ALTER TABLE infrastructure_features ADD CONSTRAINT infrastructure_features_feature_type_check
  CHECK (feature_type IN (
    'runway_edge_light', 'taxiway_light',
    'taxiway_end_light', 'approach_light', 'runway_threshold',
    'location_sign', 'directional_sign', 'informational_sign', 'mandatory_sign',
    'obstruction_light'
  ));
