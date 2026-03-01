-- ============================================================
-- Phase 4: Child Tables & Inspection Templates
-- Child tables have no base_id — access checked via parent FK
-- ============================================================

-- ============================================================
-- Waiver child tables
-- Access: via parent waivers.base_id
-- Write: base access + writable role
-- ============================================================

-- waiver_criteria
ALTER TABLE waiver_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waiver_criteria_select" ON waiver_criteria
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM waivers
    WHERE waivers.id = waiver_criteria.waiver_id
      AND user_has_base_access(auth.uid(), waivers.base_id)
  ));

CREATE POLICY "waiver_criteria_insert" ON waiver_criteria
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM waivers
    WHERE waivers.id = waiver_criteria.waiver_id
      AND user_has_base_access(auth.uid(), waivers.base_id)
  ) AND user_can_write(auth.uid()));

CREATE POLICY "waiver_criteria_update" ON waiver_criteria
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM waivers
    WHERE waivers.id = waiver_criteria.waiver_id
      AND user_has_base_access(auth.uid(), waivers.base_id)
  ) AND user_can_write(auth.uid()));

CREATE POLICY "waiver_criteria_delete" ON waiver_criteria
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM waivers
    WHERE waivers.id = waiver_criteria.waiver_id
      AND user_has_base_access(auth.uid(), waivers.base_id)
  ) AND user_can_write(auth.uid()));

-- waiver_attachments
ALTER TABLE waiver_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waiver_attachments_select" ON waiver_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM waivers
    WHERE waivers.id = waiver_attachments.waiver_id
      AND user_has_base_access(auth.uid(), waivers.base_id)
  ));

CREATE POLICY "waiver_attachments_insert" ON waiver_attachments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM waivers
    WHERE waivers.id = waiver_attachments.waiver_id
      AND user_has_base_access(auth.uid(), waivers.base_id)
  ) AND user_can_write(auth.uid()));

CREATE POLICY "waiver_attachments_update" ON waiver_attachments
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM waivers
    WHERE waivers.id = waiver_attachments.waiver_id
      AND user_has_base_access(auth.uid(), waivers.base_id)
  ) AND user_can_write(auth.uid()));

CREATE POLICY "waiver_attachments_delete" ON waiver_attachments
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM waivers
    WHERE waivers.id = waiver_attachments.waiver_id
      AND user_has_base_access(auth.uid(), waivers.base_id)
  ) AND user_can_write(auth.uid()));

-- waiver_reviews
ALTER TABLE waiver_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waiver_reviews_select" ON waiver_reviews
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM waivers
    WHERE waivers.id = waiver_reviews.waiver_id
      AND user_has_base_access(auth.uid(), waivers.base_id)
  ));

CREATE POLICY "waiver_reviews_insert" ON waiver_reviews
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM waivers
    WHERE waivers.id = waiver_reviews.waiver_id
      AND user_has_base_access(auth.uid(), waivers.base_id)
  ) AND user_can_write(auth.uid()));

CREATE POLICY "waiver_reviews_update" ON waiver_reviews
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM waivers
    WHERE waivers.id = waiver_reviews.waiver_id
      AND user_has_base_access(auth.uid(), waivers.base_id)
  ) AND user_can_write(auth.uid()));

CREATE POLICY "waiver_reviews_delete" ON waiver_reviews
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM waivers
    WHERE waivers.id = waiver_reviews.waiver_id
      AND user_has_base_access(auth.uid(), waivers.base_id)
  ) AND user_can_write(auth.uid()));

-- waiver_coordination
ALTER TABLE waiver_coordination ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waiver_coordination_select" ON waiver_coordination
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM waivers
    WHERE waivers.id = waiver_coordination.waiver_id
      AND user_has_base_access(auth.uid(), waivers.base_id)
  ));

CREATE POLICY "waiver_coordination_insert" ON waiver_coordination
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM waivers
    WHERE waivers.id = waiver_coordination.waiver_id
      AND user_has_base_access(auth.uid(), waivers.base_id)
  ) AND user_can_write(auth.uid()));

CREATE POLICY "waiver_coordination_update" ON waiver_coordination
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM waivers
    WHERE waivers.id = waiver_coordination.waiver_id
      AND user_has_base_access(auth.uid(), waivers.base_id)
  ) AND user_can_write(auth.uid()));

CREATE POLICY "waiver_coordination_delete" ON waiver_coordination
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM waivers
    WHERE waivers.id = waiver_coordination.waiver_id
      AND user_has_base_access(auth.uid(), waivers.base_id)
  ) AND user_can_write(auth.uid()));

-- ============================================================
-- Inspection template tables
-- Templates are base configuration — SELECT for base members,
-- write for admin roles only
-- ============================================================

-- base_inspection_templates (has base_id)
ALTER TABLE base_inspection_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "base_inspection_templates_select" ON base_inspection_templates
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

CREATE POLICY "base_inspection_templates_insert" ON base_inspection_templates
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));

CREATE POLICY "base_inspection_templates_update" ON base_inspection_templates
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));

CREATE POLICY "base_inspection_templates_delete" ON base_inspection_templates
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_is_admin(auth.uid()));

-- base_inspection_sections (FK to templates via template_id)
ALTER TABLE base_inspection_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "base_inspection_sections_select" ON base_inspection_sections
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM base_inspection_templates
    WHERE base_inspection_templates.id = base_inspection_sections.template_id
      AND user_has_base_access(auth.uid(), base_inspection_templates.base_id)
  ));

CREATE POLICY "base_inspection_sections_insert" ON base_inspection_sections
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM base_inspection_templates
    WHERE base_inspection_templates.id = base_inspection_sections.template_id
      AND user_has_base_access(auth.uid(), base_inspection_templates.base_id)
  ) AND user_is_admin(auth.uid()));

CREATE POLICY "base_inspection_sections_update" ON base_inspection_sections
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM base_inspection_templates
    WHERE base_inspection_templates.id = base_inspection_sections.template_id
      AND user_has_base_access(auth.uid(), base_inspection_templates.base_id)
  ) AND user_is_admin(auth.uid()));

CREATE POLICY "base_inspection_sections_delete" ON base_inspection_sections
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM base_inspection_templates
    WHERE base_inspection_templates.id = base_inspection_sections.template_id
      AND user_has_base_access(auth.uid(), base_inspection_templates.base_id)
  ) AND user_is_admin(auth.uid()));

-- base_inspection_items (FK to sections via section_id → template chain)
ALTER TABLE base_inspection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "base_inspection_items_select" ON base_inspection_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM base_inspection_sections
    JOIN base_inspection_templates ON base_inspection_templates.id = base_inspection_sections.template_id
    WHERE base_inspection_sections.id = base_inspection_items.section_id
      AND user_has_base_access(auth.uid(), base_inspection_templates.base_id)
  ));

CREATE POLICY "base_inspection_items_insert" ON base_inspection_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM base_inspection_sections
    JOIN base_inspection_templates ON base_inspection_templates.id = base_inspection_sections.template_id
    WHERE base_inspection_sections.id = base_inspection_items.section_id
      AND user_has_base_access(auth.uid(), base_inspection_templates.base_id)
  ) AND user_is_admin(auth.uid()));

CREATE POLICY "base_inspection_items_update" ON base_inspection_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM base_inspection_sections
    JOIN base_inspection_templates ON base_inspection_templates.id = base_inspection_sections.template_id
    WHERE base_inspection_sections.id = base_inspection_items.section_id
      AND user_has_base_access(auth.uid(), base_inspection_templates.base_id)
  ) AND user_is_admin(auth.uid()));

CREATE POLICY "base_inspection_items_delete" ON base_inspection_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM base_inspection_sections
    JOIN base_inspection_templates ON base_inspection_templates.id = base_inspection_sections.template_id
    WHERE base_inspection_sections.id = base_inspection_items.section_id
      AND user_has_base_access(auth.uid(), base_inspection_templates.base_id)
  ) AND user_is_admin(auth.uid()));

-- ============================================================
-- Fix update_airfield_status() RPC — add p_base_id parameter
-- so it scopes the update to the correct base
-- ============================================================
CREATE OR REPLACE FUNCTION update_airfield_status(
  p_updates    JSONB,
  p_updated_by UUID DEFAULT NULL,
  p_base_id    UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE airfield_status
  SET
    runway_status = COALESCE(p_updates->>'runway_status', runway_status),
    active_runway = COALESCE(p_updates->>'active_runway', active_runway),
    advisory_type = CASE WHEN p_updates ? 'advisory_type' THEN p_updates->>'advisory_type'
                         ELSE advisory_type END,
    advisory_text = CASE WHEN p_updates ? 'advisory_text' THEN p_updates->>'advisory_text'
                         ELSE advisory_text END,
    updated_by    = COALESCE(p_updated_by, updated_by),
    updated_at    = now()
  WHERE CASE
    WHEN p_base_id IS NOT NULL THEN base_id = p_base_id
    ELSE id = (SELECT id FROM airfield_status LIMIT 1)
  END;
END;
$$;
