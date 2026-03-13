-- ═══════════════════════════════════════════════════════════════
-- Outage Events — structured log of status changes for timeline/reporting
-- Supplements the activity_log (which provides the standard audit trail)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE outage_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id             UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  feature_id          UUID NOT NULL REFERENCES infrastructure_features(id) ON DELETE CASCADE,
  system_component_id UUID REFERENCES lighting_system_components(id) ON DELETE SET NULL,
  event_type          TEXT NOT NULL CHECK (event_type IN ('reported', 'resolved')),
  reported_by         UUID REFERENCES profiles(id),
  discrepancy_id      UUID REFERENCES discrepancies(id) ON DELETE SET NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_outage_events_base ON outage_events(base_id, created_at DESC);
CREATE INDEX idx_outage_events_feature ON outage_events(feature_id);

-- ── RLS ──
ALTER TABLE outage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "outage_events_select" ON outage_events
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "outage_events_insert" ON outage_events
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id));
