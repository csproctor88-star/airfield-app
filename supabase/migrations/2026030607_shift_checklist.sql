-- Shift Checklist: configurable items per base
CREATE TABLE shift_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id),
  label TEXT NOT NULL,
  shift TEXT NOT NULL DEFAULT 'day' CHECK (shift IN ('day', 'swing')),
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shift_checklist_items_base ON shift_checklist_items(base_id);

ALTER TABLE shift_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sci_select" ON shift_checklist_items FOR SELECT TO authenticated USING (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "sci_insert" ON shift_checklist_items FOR INSERT TO authenticated WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));
CREATE POLICY "sci_update" ON shift_checklist_items FOR UPDATE TO authenticated USING (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));
CREATE POLICY "sci_delete" ON shift_checklist_items FOR DELETE TO authenticated USING (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));

-- Daily checklist instances
CREATE TABLE shift_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id),
  checklist_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  completed_by UUID,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_id, checklist_date)
);

CREATE INDEX idx_shift_checklists_base_date ON shift_checklists(base_id, checklist_date);

ALTER TABLE shift_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sc_select" ON shift_checklists FOR SELECT TO authenticated USING (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "sc_insert" ON shift_checklists FOR INSERT TO authenticated WITH CHECK (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "sc_update" ON shift_checklists FOR UPDATE TO authenticated USING (user_has_base_access(auth.uid(), base_id));

-- Per-item responses
CREATE TABLE shift_checklist_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES shift_checklists(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES shift_checklist_items(id),
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_by UUID,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (checklist_id, item_id)
);

CREATE INDEX idx_shift_checklist_responses_checklist ON shift_checklist_responses(checklist_id);

ALTER TABLE shift_checklist_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scr_select" ON shift_checklist_responses FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM shift_checklists sc WHERE sc.id = checklist_id AND user_has_base_access(auth.uid(), sc.base_id))
);
CREATE POLICY "scr_insert" ON shift_checklist_responses FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM shift_checklists sc WHERE sc.id = checklist_id AND user_has_base_access(auth.uid(), sc.base_id))
);
CREATE POLICY "scr_update" ON shift_checklist_responses FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM shift_checklists sc WHERE sc.id = checklist_id AND user_has_base_access(auth.uid(), sc.base_id))
);
