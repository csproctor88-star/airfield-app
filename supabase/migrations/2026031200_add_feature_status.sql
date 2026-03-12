-- ═══════════════════════════════════════════════════════════════
-- Add operational status to infrastructure_features
-- Binary: operational / inoperative (no maintenance status)
-- ═══════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'infrastructure_features' AND column_name = 'status') THEN
    ALTER TABLE infrastructure_features ADD COLUMN status TEXT NOT NULL DEFAULT 'operational' CHECK (status IN ('operational', 'inoperative'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'infrastructure_features' AND column_name = 'status_changed_at') THEN
    ALTER TABLE infrastructure_features ADD COLUMN status_changed_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'infrastructure_features' AND column_name = 'status_changed_by') THEN
    ALTER TABLE infrastructure_features ADD COLUMN status_changed_by UUID REFERENCES profiles(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'infrastructure_features' AND column_name = 'system_component_id') THEN
    ALTER TABLE infrastructure_features ADD COLUMN system_component_id UUID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_infrastructure_features_status ON infrastructure_features(base_id, status);
