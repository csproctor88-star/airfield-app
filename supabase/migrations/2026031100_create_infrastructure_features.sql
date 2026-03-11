-- ═══════════════════════════════════════════════════════════════
-- Infrastructure Features — airfield lighting, signage, markings
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS infrastructure_features (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id       UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  feature_type  TEXT NOT NULL CHECK (feature_type IN (
    'runway_light', 'airfield_light', 'taxi_edge_light',
    'taxi_edge_light_elev', 'taxilight', 'airfield_sign', 'marking_label'
  )),
  longitude     DOUBLE PRECISION NOT NULL,
  latitude      DOUBLE PRECISION NOT NULL,
  layer         TEXT,            -- original CAD layer name (null for user-added)
  block         TEXT,            -- fixture identifier (e.g. 'L-861+BASE')
  label         TEXT,            -- text label for signs/markings
  notes         TEXT,
  source        TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('import', 'user')),
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_infrastructure_features_base_id ON infrastructure_features(base_id);

-- ── RLS ──
ALTER TABLE infrastructure_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "infrastructure_features_select" ON infrastructure_features
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "infrastructure_features_insert" ON infrastructure_features
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));

CREATE POLICY "infrastructure_features_update" ON infrastructure_features
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));

CREATE POLICY "infrastructure_features_delete" ON infrastructure_features
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));
