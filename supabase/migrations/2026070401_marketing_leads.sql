-- Marketing-site demo-request leads (glidepath-site /api/demo). Deny-all
-- RLS: zero policies; only the service role (which bypasses RLS) writes.
-- The app never reads this table.
CREATE TABLE marketing_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  organization_type text NOT NULL
    CHECK (organization_type IN ('military', 'civilian', 'other')),
  role text,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE marketing_leads ENABLE ROW LEVEL SECURITY;
