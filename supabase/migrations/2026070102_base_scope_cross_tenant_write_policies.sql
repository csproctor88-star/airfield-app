-- Audit H-1/H-2/H-5 (HIGH): add the missing base-access half to write policies
-- that were permission-only in the end state.
--
-- user_has_permission() is NOT base-scoped: permissions are global per-role, so
-- a user with e.g. 'checks:write' or 'base_setup:write' could write to ANOTHER
-- base's rows. Every policy below combines the existing permission check with
-- user_has_base_access(auth.uid(), <base>) — for tables with a base_id column,
-- directly; for tables without one (waiver_* children, inspection_item_system_
-- links), via the same parent-EXISTS join their still-active SELECT policies use.
--
-- SAFETY: verified against every app write path. All legitimate writes are
-- same-base (base_id populated on insert or NOT NULL; parent rows belong to the
-- caller's base), so the added predicate passes for real callers. base_members
-- has no active session writer (management goes through the service-role admin
-- API) — its tightening is pure defense-in-depth. user_has_base_access refuses
-- NULL (2026062012), which only affects legacy NULL-base parents that are
-- already unreadable under the existing base-scoped SELECT policies.
--
-- Wrapped in a transaction so a mid-file failure rolls back rather than leaving
-- a table with a dropped-but-not-recreated policy.

BEGIN;

-- ── base_members (H-1): self-escalation into another base ──────────────────
-- base_id is NOT NULL.
DROP POLICY IF EXISTS "base_members_insert" ON base_members;
CREATE POLICY "base_members_insert" ON base_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_permission(auth.uid(), 'users:manage')
    AND user_has_base_access(auth.uid(), base_id)
  );

DROP POLICY IF EXISTS "base_members_update" ON base_members;
CREATE POLICY "base_members_update" ON base_members
  FOR UPDATE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'users:manage')
    AND user_has_base_access(auth.uid(), base_id)
  )
  WITH CHECK (
    user_has_permission(auth.uid(), 'users:manage')
    AND user_has_base_access(auth.uid(), base_id)
  );

DROP POLICY IF EXISTS "base_members_delete" ON base_members;
CREATE POLICY "base_members_delete" ON base_members
  FOR DELETE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'users:manage')
    AND user_has_base_access(auth.uid(), base_id)
  );

-- ── bases UPDATE (H-2): any base_setup:write holder editing any base ────────
-- bases IS the base row, so scope on its own id.
DROP POLICY IF EXISTS "bases_update" ON bases;
CREATE POLICY "bases_update" ON bases
  FOR UPDATE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'base_setup:write')
    AND user_has_base_access(auth.uid(), id)
  )
  WITH CHECK (
    user_has_permission(auth.uid(), 'base_setup:write')
    AND user_has_base_access(auth.uid(), id)
  );

-- ── check_comments (H-5): base_id column populated on insert ────────────────
DROP POLICY IF EXISTS "check_comments_insert" ON check_comments;
CREATE POLICY "check_comments_insert" ON check_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_permission(auth.uid(), 'checks:write')
    AND user_has_base_access(auth.uid(), base_id)
  );

DROP POLICY IF EXISTS "check_comments_update" ON check_comments;
CREATE POLICY "check_comments_update" ON check_comments
  FOR UPDATE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'checks:write')
    AND user_has_base_access(auth.uid(), base_id)
  )
  WITH CHECK (
    user_has_permission(auth.uid(), 'checks:write')
    AND user_has_base_access(auth.uid(), base_id)
  );

DROP POLICY IF EXISTS "check_comments_delete" ON check_comments;
CREATE POLICY "check_comments_delete" ON check_comments
  FOR DELETE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'checks:write')
    AND user_has_base_access(auth.uid(), base_id)
  );

-- ── custom_status_items (H-5): base_id NOT NULL ─────────────────────────────
DROP POLICY IF EXISTS "custom_status_items_insert" ON custom_status_items;
CREATE POLICY "custom_status_items_insert" ON custom_status_items
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_permission(auth.uid(), 'airfield_status:write')
    AND user_has_base_access(auth.uid(), base_id)
  );

DROP POLICY IF EXISTS "custom_status_items_update" ON custom_status_items;
CREATE POLICY "custom_status_items_update" ON custom_status_items
  FOR UPDATE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'airfield_status:write')
    AND user_has_base_access(auth.uid(), base_id)
  )
  WITH CHECK (
    user_has_permission(auth.uid(), 'airfield_status:write')
    AND user_has_base_access(auth.uid(), base_id)
  );

DROP POLICY IF EXISTS "custom_status_items_delete" ON custom_status_items;
CREATE POLICY "custom_status_items_delete" ON custom_status_items
  FOR DELETE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'airfield_status:write')
    AND user_has_base_access(auth.uid(), base_id)
  );

-- ── runway_status_log (H-5): INSERT only (append-only log); base_id populated
-- via resolveBaseId. Preserve the two-permission OR, then AND base access.
DROP POLICY IF EXISTS "runway_status_log_insert" ON runway_status_log;
CREATE POLICY "runway_status_log_insert" ON runway_status_log
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      user_has_permission(auth.uid(), 'airfield_status:write')
      OR user_has_permission(auth.uid(), 'airfield_status:write:rsc_bwc_only')
    )
    AND user_has_base_access(auth.uid(), base_id)
  );

-- ── waiver_* children (H-5): no base_id column → parent-EXISTS on waivers ────
-- Preserve each policy's original permission key (reviews use waivers:review
-- for insert/update, waivers:write for delete).

-- waiver_criteria
DROP POLICY IF EXISTS "waiver_criteria_insert" ON waiver_criteria;
CREATE POLICY "waiver_criteria_insert" ON waiver_criteria
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_permission(auth.uid(), 'waivers:write')
    AND EXISTS (SELECT 1 FROM waivers w WHERE w.id = waiver_criteria.waiver_id
                AND user_has_base_access(auth.uid(), w.base_id))
  );
DROP POLICY IF EXISTS "waiver_criteria_update" ON waiver_criteria;
CREATE POLICY "waiver_criteria_update" ON waiver_criteria
  FOR UPDATE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'waivers:write')
    AND EXISTS (SELECT 1 FROM waivers w WHERE w.id = waiver_criteria.waiver_id
                AND user_has_base_access(auth.uid(), w.base_id))
  );
DROP POLICY IF EXISTS "waiver_criteria_delete" ON waiver_criteria;
CREATE POLICY "waiver_criteria_delete" ON waiver_criteria
  FOR DELETE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'waivers:write')
    AND EXISTS (SELECT 1 FROM waivers w WHERE w.id = waiver_criteria.waiver_id
                AND user_has_base_access(auth.uid(), w.base_id))
  );

-- waiver_attachments (metadata table; the storage bucket is scoped separately)
DROP POLICY IF EXISTS "waiver_attachments_insert" ON waiver_attachments;
CREATE POLICY "waiver_attachments_insert" ON waiver_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_permission(auth.uid(), 'waivers:write')
    AND EXISTS (SELECT 1 FROM waivers w WHERE w.id = waiver_attachments.waiver_id
                AND user_has_base_access(auth.uid(), w.base_id))
  );
DROP POLICY IF EXISTS "waiver_attachments_update" ON waiver_attachments;
CREATE POLICY "waiver_attachments_update" ON waiver_attachments
  FOR UPDATE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'waivers:write')
    AND EXISTS (SELECT 1 FROM waivers w WHERE w.id = waiver_attachments.waiver_id
                AND user_has_base_access(auth.uid(), w.base_id))
  );
DROP POLICY IF EXISTS "waiver_attachments_delete" ON waiver_attachments;
CREATE POLICY "waiver_attachments_delete" ON waiver_attachments
  FOR DELETE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'waivers:write')
    AND EXISTS (SELECT 1 FROM waivers w WHERE w.id = waiver_attachments.waiver_id
                AND user_has_base_access(auth.uid(), w.base_id))
  );

-- waiver_reviews (insert/update = waivers:review, delete = waivers:write)
DROP POLICY IF EXISTS "waiver_reviews_insert" ON waiver_reviews;
CREATE POLICY "waiver_reviews_insert" ON waiver_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_permission(auth.uid(), 'waivers:review')
    AND EXISTS (SELECT 1 FROM waivers w WHERE w.id = waiver_reviews.waiver_id
                AND user_has_base_access(auth.uid(), w.base_id))
  );
DROP POLICY IF EXISTS "waiver_reviews_update" ON waiver_reviews;
CREATE POLICY "waiver_reviews_update" ON waiver_reviews
  FOR UPDATE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'waivers:review')
    AND EXISTS (SELECT 1 FROM waivers w WHERE w.id = waiver_reviews.waiver_id
                AND user_has_base_access(auth.uid(), w.base_id))
  );
DROP POLICY IF EXISTS "waiver_reviews_delete" ON waiver_reviews;
CREATE POLICY "waiver_reviews_delete" ON waiver_reviews
  FOR DELETE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'waivers:write')
    AND EXISTS (SELECT 1 FROM waivers w WHERE w.id = waiver_reviews.waiver_id
                AND user_has_base_access(auth.uid(), w.base_id))
  );

-- waiver_coordination
DROP POLICY IF EXISTS "waiver_coordination_insert" ON waiver_coordination;
CREATE POLICY "waiver_coordination_insert" ON waiver_coordination
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_permission(auth.uid(), 'waivers:write')
    AND EXISTS (SELECT 1 FROM waivers w WHERE w.id = waiver_coordination.waiver_id
                AND user_has_base_access(auth.uid(), w.base_id))
  );
DROP POLICY IF EXISTS "waiver_coordination_update" ON waiver_coordination;
CREATE POLICY "waiver_coordination_update" ON waiver_coordination
  FOR UPDATE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'waivers:write')
    AND EXISTS (SELECT 1 FROM waivers w WHERE w.id = waiver_coordination.waiver_id
                AND user_has_base_access(auth.uid(), w.base_id))
  );
DROP POLICY IF EXISTS "waiver_coordination_delete" ON waiver_coordination;
CREATE POLICY "waiver_coordination_delete" ON waiver_coordination
  FOR DELETE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'waivers:write')
    AND EXISTS (SELECT 1 FROM waivers w WHERE w.id = waiver_coordination.waiver_id
                AND user_has_base_access(auth.uid(), w.base_id))
  );

-- ── inspection_item_system_links (H-5): no base_id → parent-EXISTS chain ─────
-- item_id → base_inspection_items → base_inspection_sections → templates.base_id
-- (join shape copied verbatim from the active iisl_select / former iisl_insert).
DROP POLICY IF EXISTS "inspection_item_system_links_insert" ON inspection_item_system_links;
CREATE POLICY "inspection_item_system_links_insert" ON inspection_item_system_links
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_permission(auth.uid(), 'inspections:write')
    AND EXISTS (
      SELECT 1
      FROM base_inspection_items bi
      JOIN base_inspection_sections bs ON bs.id = bi.section_id
      JOIN base_inspection_templates bt ON bt.id = bs.template_id
      WHERE bi.id = inspection_item_system_links.item_id
        AND user_has_base_access(auth.uid(), bt.base_id)
    )
  );
DROP POLICY IF EXISTS "inspection_item_system_links_update" ON inspection_item_system_links;
CREATE POLICY "inspection_item_system_links_update" ON inspection_item_system_links
  FOR UPDATE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'inspections:write')
    AND EXISTS (
      SELECT 1
      FROM base_inspection_items bi
      JOIN base_inspection_sections bs ON bs.id = bi.section_id
      JOIN base_inspection_templates bt ON bt.id = bs.template_id
      WHERE bi.id = inspection_item_system_links.item_id
        AND user_has_base_access(auth.uid(), bt.base_id)
    )
  );
DROP POLICY IF EXISTS "inspection_item_system_links_delete" ON inspection_item_system_links;
CREATE POLICY "inspection_item_system_links_delete" ON inspection_item_system_links
  FOR DELETE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'inspections:write')
    AND EXISTS (
      SELECT 1
      FROM base_inspection_items bi
      JOIN base_inspection_sections bs ON bs.id = bi.section_id
      JOIN base_inspection_templates bt ON bt.id = bs.template_id
      WHERE bi.id = inspection_item_system_links.item_id
        AND user_has_base_access(auth.uid(), bt.base_id)
    )
  );

COMMIT;
