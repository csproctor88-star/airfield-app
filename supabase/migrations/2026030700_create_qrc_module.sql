-- QRC (Quick Reaction Checklist) Module
-- Templates: admin-configured per base
-- Executions: runtime instances with step responses

CREATE TABLE qrc_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id),
  qrc_number INT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  references TEXT,
  has_scn_form BOOLEAN NOT NULL DEFAULT false,
  scn_fields JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_id, qrc_number)
);

CREATE INDEX idx_qrc_templates_base ON qrc_templates(base_id);

ALTER TABLE qrc_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qrc_tmpl_select" ON qrc_templates FOR SELECT TO authenticated USING (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "qrc_tmpl_insert" ON qrc_templates FOR INSERT TO authenticated WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));
CREATE POLICY "qrc_tmpl_update" ON qrc_templates FOR UPDATE TO authenticated USING (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));
CREATE POLICY "qrc_tmpl_delete" ON qrc_templates FOR DELETE TO authenticated USING (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));

CREATE TABLE qrc_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id),
  template_id UUID NOT NULL REFERENCES qrc_templates(id),
  qrc_number INT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_by UUID,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  open_initials TEXT,
  closed_by UUID,
  closed_at TIMESTAMPTZ,
  close_initials TEXT,
  step_responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  scn_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qrc_executions_base ON qrc_executions(base_id);
CREATE INDEX idx_qrc_executions_template ON qrc_executions(template_id);
CREATE INDEX idx_qrc_executions_status ON qrc_executions(base_id, status);

ALTER TABLE qrc_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qrc_exec_select" ON qrc_executions FOR SELECT TO authenticated USING (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "qrc_exec_insert" ON qrc_executions FOR INSERT TO authenticated WITH CHECK (user_has_base_access(auth.uid(), base_id));
CREATE POLICY "qrc_exec_update" ON qrc_executions FOR UPDATE TO authenticated USING (user_has_base_access(auth.uid(), base_id));
