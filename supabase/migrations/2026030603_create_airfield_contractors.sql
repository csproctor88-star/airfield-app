-- Airfield Contractors tracking table
CREATE TABLE airfield_contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID REFERENCES bases(id),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  location TEXT NOT NULL,
  work_description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_airfield_contractors_base_id ON airfield_contractors(base_id);
CREATE INDEX idx_airfield_contractors_status ON airfield_contractors(status);

ALTER TABLE airfield_contractors ENABLE ROW LEVEL SECURITY;

-- Any role with base access can read/insert/update
CREATE POLICY "airfield_contractors_select" ON airfield_contractors FOR SELECT TO authenticated USING (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "airfield_contractors_insert" ON airfield_contractors FOR INSERT TO authenticated WITH CHECK (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "airfield_contractors_update" ON airfield_contractors FOR UPDATE TO authenticated USING (user_has_base_access(auth.uid(), base_id));
-- Only admins can delete
CREATE POLICY "airfield_contractors_delete" ON airfield_contractors FOR DELETE TO authenticated USING (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));
