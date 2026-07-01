-- Add arresting_gear_marking_sign, do_not_enter_sign, reflector to the
-- infrastructure_features.feature_type CHECK constraint. Expand-only (widening
-- an IN list breaks no existing rows or code) — safe to apply on a live DB.
ALTER TABLE infrastructure_features DROP CONSTRAINT IF EXISTS infrastructure_features_feature_type_check;

ALTER TABLE infrastructure_features ADD CONSTRAINT infrastructure_features_feature_type_check
  CHECK (feature_type IN (
    'runway_edge_light', 'runway_end_light', 'taxiway_light',
    'taxiway_end_light', 'approach_light', 'runway_threshold',
    'location_sign', 'directional_sign', 'informational_sign', 'mandatory_sign',
    'obstruction_light', 'runway_distance_marker', 'papi',
    'threshold_light', 'pre_threshold_light', 'terminating_bar_light',
    'centerline_bar_light', 'thousand_ft_bar_light', 'sequenced_flasher',
    'reil', 'windcone', 'stadium_light', 'rotating_beacon',
    'arresting_gear_marking_sign', 'do_not_enter_sign', 'reflector'
  ));
