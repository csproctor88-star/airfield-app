-- Add runway_distance_marker and papi feature types
ALTER TABLE infrastructure_features DROP CONSTRAINT IF EXISTS infrastructure_features_feature_type_check;
-- Constraint will be re-added by final migration 2026031107 with complete type list
