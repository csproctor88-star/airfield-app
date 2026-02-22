-- Shared airfield status — single row, visible to all users
CREATE TABLE IF NOT EXISTS airfield_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advisory_type TEXT CHECK (advisory_type IN ('INFO', 'CAUTION', 'WARNING')),
  advisory_text TEXT,
  active_runway TEXT NOT NULL DEFAULT '01' CHECK (active_runway IN ('01', '19')),
  runway_status TEXT NOT NULL DEFAULT 'open' CHECK (runway_status IN ('open', 'suspended', 'closed')),
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed with a single default row
INSERT INTO airfield_status (active_runway, runway_status)
VALUES ('01', 'open')
ON CONFLICT DO NOTHING;
