-- Fix inspection_item_system_links RLS write policy
-- Bug: was calling user_can_write(bt.base_id) instead of user_can_write(auth.uid())
-- Bug: FOR ALL USING without WITH CHECK blocks inserts

DROP POLICY IF EXISTS "iisl_write" ON inspection_item_system_links;

-- INSERT
CREATE POLICY "iisl_insert" ON inspection_item_system_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM base_inspection_items bi
      JOIN base_inspection_sections bs ON bs.id = bi.section_id
      JOIN base_inspection_templates bt ON bt.id = bs.template_id
      WHERE bi.id = inspection_item_system_links.item_id
        AND user_has_base_access(auth.uid(), bt.base_id)
        AND user_can_write(auth.uid())
    )
  );

-- UPDATE
CREATE POLICY "iisl_update" ON inspection_item_system_links FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM base_inspection_items bi
      JOIN base_inspection_sections bs ON bs.id = bi.section_id
      JOIN base_inspection_templates bt ON bt.id = bs.template_id
      WHERE bi.id = inspection_item_system_links.item_id
        AND user_has_base_access(auth.uid(), bt.base_id)
        AND user_can_write(auth.uid())
    )
  );

-- DELETE
CREATE POLICY "iisl_delete" ON inspection_item_system_links FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM base_inspection_items bi
      JOIN base_inspection_sections bs ON bs.id = bi.section_id
      JOIN base_inspection_templates bt ON bt.id = bs.template_id
      WHERE bi.id = inspection_item_system_links.item_id
        AND user_has_base_access(auth.uid(), bt.base_id)
        AND user_can_write(auth.uid())
    )
  );
