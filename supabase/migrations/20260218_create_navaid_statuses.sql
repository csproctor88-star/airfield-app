-- NAVAID status tracking — shared across all users
CREATE TABLE IF NOT EXISTS navaid_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  navaid_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'green' CHECK (status IN ('green', 'yellow', 'red')),
  notes TEXT,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the 6 NAVAIDs
INSERT INTO navaid_statuses (navaid_name) VALUES
  ('01 Localizer'),
  ('01 Glideslope'),
  ('01 ILS'),
  ('19 Localizer'),
  ('19 Glideslope'),
  ('19 ILS')
ON CONFLICT (navaid_name) DO NOTHING;
