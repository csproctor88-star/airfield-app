-- ═══════════════════════════════════════════════════════════════
-- Link discrepancies to infrastructure features and lighting systems
-- Every outage auto-creates a discrepancy linked back to the feature
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE discrepancies
  ADD COLUMN infrastructure_feature_id UUID REFERENCES infrastructure_features(id) ON DELETE SET NULL,
  ADD COLUMN lighting_system_id UUID REFERENCES lighting_systems(id) ON DELETE SET NULL;

CREATE INDEX idx_discrepancies_infrastructure ON discrepancies(infrastructure_feature_id)
  WHERE infrastructure_feature_id IS NOT NULL;

CREATE INDEX idx_discrepancies_lighting_system ON discrepancies(lighting_system_id)
  WHERE lighting_system_id IS NOT NULL;
