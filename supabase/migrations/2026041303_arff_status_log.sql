-- ARFF status change audit log — every change to arff_cat or per-aircraft readiness.
-- Mirrors runway_status_log; surfaces ARFF capability changes in the daily ops report and
-- provides audit evidence for CAT drops (mishap review / waiver support).

CREATE TABLE IF NOT EXISTS arff_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID REFERENCES bases(id) ON DELETE CASCADE,

  -- CAT change (null on aircraft-only entries)
  old_cat SMALLINT,
  new_cat SMALLINT,

  -- Aircraft readiness change (null on CAT-only entries)
  aircraft_name TEXT,
  old_readiness TEXT,
  new_readiness TEXT,

  changed_by UUID REFERENCES profiles(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arff_status_log_created_at ON arff_status_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arff_status_log_base ON arff_status_log (base_id);

ALTER TABLE arff_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arff_status_log_select" ON arff_status_log
  FOR SELECT USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "arff_status_log_insert" ON arff_status_log
  FOR INSERT WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_can_write(auth.uid()));
