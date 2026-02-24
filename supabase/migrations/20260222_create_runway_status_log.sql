-- Runway status change audit log — records every change to airfield_status
CREATE TABLE IF NOT EXISTS runway_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  old_runway_status TEXT,
  new_runway_status TEXT,
  old_active_runway TEXT,
  new_active_runway TEXT,
  old_advisory_type TEXT,
  new_advisory_type TEXT,
  old_advisory_text TEXT,
  new_advisory_text TEXT,
  changed_by UUID REFERENCES profiles(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for date-range queries in reports
CREATE INDEX IF NOT EXISTS idx_runway_status_log_created_at
  ON runway_status_log(created_at DESC);
