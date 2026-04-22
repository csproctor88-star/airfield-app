-- ============================================================
-- Phase D2c — Swap base-config + profiles + base_members + misc
--              tables to the permission matrix.
--
-- Covered tables (15):
--   profiles
--   base_members
--   bases                       (UPDATE only; INSERT/DELETE stay sys_admin)
--   base_runways
--   base_navaids
--   base_areas
--   base_arff_aircraft
--   base_taxiways
--   base_facilities
--   base_wildlife_species       → wildlife:write (domain fit)
--   base_inspection_templates
--   base_inspection_sections
--   base_inspection_items
--   inspection_item_system_links → inspections:write
--   navaid_statuses             → infrastructure:write (operational status)
--
-- Also grants `base_setup:write` to `amops` per the Phase C role
-- directive ("AMOPS: read and write on all modules for their base,
-- except User Management"). AMOPS previously could only write a
-- subset of base_* tables via `user_can_write`; this aligns AMOPS's
-- base-setup access with AFM/NAMO/admins.
--
-- After this migration, `user_can_write()` and `user_is_admin()` are
-- no longer referenced by any RLS policy. The helpers remain callable
-- until a follow-up cleanup migration drops them.
-- ============================================================

-- ── Grant base_setup:write to AMOPS ────────────────────────
INSERT INTO role_permissions (role, permission_key) VALUES
  ('amops', 'base_setup:write')
ON CONFLICT (role, permission_key) DO NOTHING;

-- ============================================================
-- profiles
-- ============================================================
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(auth.uid(), 'users:manage'));

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR user_has_permission(auth.uid(), 'users:manage')
  );

DROP POLICY IF EXISTS "profiles_delete" ON profiles;
CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE TO authenticated
  USING (user_is_sys_admin(auth.uid()));   -- hard delete stays sys-only

-- ============================================================
-- base_members
-- ============================================================
DROP POLICY IF EXISTS "base_members_insert" ON base_members;
CREATE POLICY "base_members_insert" ON base_members
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(auth.uid(), 'users:manage'));

DROP POLICY IF EXISTS "base_members_update" ON base_members;
CREATE POLICY "base_members_update" ON base_members
  FOR UPDATE TO authenticated
  USING (user_has_permission(auth.uid(), 'users:manage'));

DROP POLICY IF EXISTS "base_members_delete" ON base_members;
CREATE POLICY "base_members_delete" ON base_members
  FOR DELETE TO authenticated
  USING (user_has_permission(auth.uid(), 'users:manage'));

-- ============================================================
-- bases (config writes — creation/deletion stay sys_admin)
-- ============================================================
DROP POLICY IF EXISTS "bases_update" ON bases;
CREATE POLICY "bases_update" ON bases
  FOR UPDATE TO authenticated
  USING (user_has_permission(auth.uid(), 'base_setup:write'));

-- ============================================================
-- base_runways
-- ============================================================
DROP POLICY IF EXISTS "base_runways_insert" ON base_runways;
CREATE POLICY "base_runways_insert" ON base_runways
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'base_setup:write'));

DROP POLICY IF EXISTS "base_runways_update" ON base_runways;
CREATE POLICY "base_runways_update" ON base_runways
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'base_setup:write'));

DROP POLICY IF EXISTS "base_runways_delete" ON base_runways;
CREATE POLICY "base_runways_delete" ON base_runways
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'base_setup:write'));

-- ============================================================
-- base_navaids
-- ============================================================
DROP POLICY IF EXISTS "base_navaids_insert" ON base_navaids;
CREATE POLICY "base_navaids_insert" ON base_navaids
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'base_setup:write'));

DROP POLICY IF EXISTS "base_navaids_update" ON base_navaids;
CREATE POLICY "base_navaids_update" ON base_navaids
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'base_setup:write'));

DROP POLICY IF EXISTS "base_navaids_delete" ON base_navaids;
CREATE POLICY "base_navaids_delete" ON base_navaids
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'base_setup:write'));

-- ============================================================
-- base_areas
-- ============================================================
DROP POLICY IF EXISTS "base_areas_insert" ON base_areas;
CREATE POLICY "base_areas_insert" ON base_areas
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'base_setup:write'));

DROP POLICY IF EXISTS "base_areas_update" ON base_areas;
CREATE POLICY "base_areas_update" ON base_areas
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'base_setup:write'));

DROP POLICY IF EXISTS "base_areas_delete" ON base_areas;
CREATE POLICY "base_areas_delete" ON base_areas
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'base_setup:write'));

-- ============================================================
-- base_arff_aircraft
-- ============================================================
DROP POLICY IF EXISTS "base_arff_aircraft_insert" ON base_arff_aircraft;
CREATE POLICY "base_arff_aircraft_insert" ON base_arff_aircraft
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'base_setup:write'));

DROP POLICY IF EXISTS "base_arff_aircraft_update" ON base_arff_aircraft;
CREATE POLICY "base_arff_aircraft_update" ON base_arff_aircraft
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'base_setup:write'));

DROP POLICY IF EXISTS "base_arff_aircraft_delete" ON base_arff_aircraft;
CREATE POLICY "base_arff_aircraft_delete" ON base_arff_aircraft
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'base_setup:write'));

-- ============================================================
-- base_taxiways
-- ============================================================
DROP POLICY IF EXISTS "base_taxiways_insert" ON base_taxiways;
CREATE POLICY "base_taxiways_insert" ON base_taxiways
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'base_setup:write'));

DROP POLICY IF EXISTS "base_taxiways_update" ON base_taxiways;
CREATE POLICY "base_taxiways_update" ON base_taxiways
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'base_setup:write'));

DROP POLICY IF EXISTS "base_taxiways_delete" ON base_taxiways;
CREATE POLICY "base_taxiways_delete" ON base_taxiways
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'base_setup:write'));

-- ============================================================
-- base_facilities
-- ============================================================
DROP POLICY IF EXISTS "base_facilities_insert" ON base_facilities;
CREATE POLICY "base_facilities_insert" ON base_facilities
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'base_setup:write'));

DROP POLICY IF EXISTS "base_facilities_update" ON base_facilities;
CREATE POLICY "base_facilities_update" ON base_facilities
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'base_setup:write'));

DROP POLICY IF EXISTS "base_facilities_delete" ON base_facilities;
CREATE POLICY "base_facilities_delete" ON base_facilities
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'base_setup:write'));

-- ============================================================
-- base_wildlife_species — wildlife domain
-- ============================================================
DROP POLICY IF EXISTS "base_wildlife_species_insert" ON base_wildlife_species;
CREATE POLICY "base_wildlife_species_insert" ON base_wildlife_species
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'wildlife:write'));

DROP POLICY IF EXISTS "base_wildlife_species_update" ON base_wildlife_species;
CREATE POLICY "base_wildlife_species_update" ON base_wildlife_species
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'wildlife:write'));

DROP POLICY IF EXISTS "base_wildlife_species_delete" ON base_wildlife_species;
CREATE POLICY "base_wildlife_species_delete" ON base_wildlife_species
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'wildlife:write'));

-- ============================================================
-- base_inspection_templates
-- ============================================================
DROP POLICY IF EXISTS "base_inspection_templates_insert" ON base_inspection_templates;
CREATE POLICY "base_inspection_templates_insert" ON base_inspection_templates
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'base_setup:write'));

DROP POLICY IF EXISTS "base_inspection_templates_update" ON base_inspection_templates;
CREATE POLICY "base_inspection_templates_update" ON base_inspection_templates
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'base_setup:write'));

DROP POLICY IF EXISTS "base_inspection_templates_delete" ON base_inspection_templates;
CREATE POLICY "base_inspection_templates_delete" ON base_inspection_templates
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'base_setup:write'));

-- ============================================================
-- base_inspection_sections (parent chain)
-- ============================================================
DROP POLICY IF EXISTS "base_inspection_sections_insert" ON base_inspection_sections;
CREATE POLICY "base_inspection_sections_insert" ON base_inspection_sections
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_permission(auth.uid(), 'base_setup:write')
    AND EXISTS (
      SELECT 1 FROM base_inspection_templates t
      WHERE t.id = template_id
        AND user_has_base_access(auth.uid(), t.base_id)
    )
  );

DROP POLICY IF EXISTS "base_inspection_sections_update" ON base_inspection_sections;
CREATE POLICY "base_inspection_sections_update" ON base_inspection_sections
  FOR UPDATE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'base_setup:write')
    AND EXISTS (
      SELECT 1 FROM base_inspection_templates t
      WHERE t.id = template_id
        AND user_has_base_access(auth.uid(), t.base_id)
    )
  );

DROP POLICY IF EXISTS "base_inspection_sections_delete" ON base_inspection_sections;
CREATE POLICY "base_inspection_sections_delete" ON base_inspection_sections
  FOR DELETE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'base_setup:write')
    AND EXISTS (
      SELECT 1 FROM base_inspection_templates t
      WHERE t.id = template_id
        AND user_has_base_access(auth.uid(), t.base_id)
    )
  );

-- ============================================================
-- base_inspection_items (parent chain)
-- ============================================================
-- NB: base_inspection_sections has its OWN column also named
-- `section_id` (TEXT slug, distinct from the primary-key `id` UUID).
-- Unqualified `section_id` inside this EXISTS subquery would resolve
-- to the inner `s.section_id` (TEXT) and cause `uuid = text` errors.
-- Always qualify with the outer table name so it resolves to the
-- base_inspection_items foreign-key column (UUID).
DROP POLICY IF EXISTS "base_inspection_items_insert" ON base_inspection_items;
CREATE POLICY "base_inspection_items_insert" ON base_inspection_items
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_permission(auth.uid(), 'base_setup:write')
    AND EXISTS (
      SELECT 1 FROM base_inspection_sections s
      JOIN base_inspection_templates t ON t.id = s.template_id
      WHERE s.id = base_inspection_items.section_id
        AND user_has_base_access(auth.uid(), t.base_id)
    )
  );

DROP POLICY IF EXISTS "base_inspection_items_update" ON base_inspection_items;
CREATE POLICY "base_inspection_items_update" ON base_inspection_items
  FOR UPDATE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'base_setup:write')
    AND EXISTS (
      SELECT 1 FROM base_inspection_sections s
      JOIN base_inspection_templates t ON t.id = s.template_id
      WHERE s.id = base_inspection_items.section_id
        AND user_has_base_access(auth.uid(), t.base_id)
    )
  );

DROP POLICY IF EXISTS "base_inspection_items_delete" ON base_inspection_items;
CREATE POLICY "base_inspection_items_delete" ON base_inspection_items
  FOR DELETE TO authenticated
  USING (
    user_has_permission(auth.uid(), 'base_setup:write')
    AND EXISTS (
      SELECT 1 FROM base_inspection_sections s
      JOIN base_inspection_templates t ON t.id = s.template_id
      WHERE s.id = base_inspection_items.section_id
        AND user_has_base_access(auth.uid(), t.base_id)
    )
  );

-- ============================================================
-- inspection_item_system_links
-- ============================================================
DROP POLICY IF EXISTS "inspection_item_system_links_insert" ON inspection_item_system_links;
CREATE POLICY "inspection_item_system_links_insert" ON inspection_item_system_links
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(auth.uid(), 'inspections:write'));

DROP POLICY IF EXISTS "inspection_item_system_links_update" ON inspection_item_system_links;
CREATE POLICY "inspection_item_system_links_update" ON inspection_item_system_links
  FOR UPDATE TO authenticated
  USING (user_has_permission(auth.uid(), 'inspections:write'));

DROP POLICY IF EXISTS "inspection_item_system_links_delete" ON inspection_item_system_links;
CREATE POLICY "inspection_item_system_links_delete" ON inspection_item_system_links
  FOR DELETE TO authenticated
  USING (user_has_permission(auth.uid(), 'inspections:write'));

-- ============================================================
-- navaid_statuses — operational NAVAID OOO tracking
-- ============================================================
DROP POLICY IF EXISTS "navaid_statuses_insert" ON navaid_statuses;
CREATE POLICY "navaid_statuses_insert" ON navaid_statuses
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'infrastructure:write'));

DROP POLICY IF EXISTS "navaid_statuses_update" ON navaid_statuses;
CREATE POLICY "navaid_statuses_update" ON navaid_statuses
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'infrastructure:write'));

DROP POLICY IF EXISTS "navaid_statuses_delete" ON navaid_statuses;
CREATE POLICY "navaid_statuses_delete" ON navaid_statuses
  FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'infrastructure:write'));

-- ============================================================
-- PDF Library extraction tables → library:manage
-- (extraction runs server-side with the service role that bypasses
-- RLS, but when admins trigger a re-extract from the UI the write
-- goes through RLS. Gate on the same permission that controls the
-- Library admin actions.)
-- ============================================================
DROP POLICY IF EXISTS "Admins can insert extraction status" ON pdf_extraction_status;
CREATE POLICY "pdf_extraction_status_insert" ON pdf_extraction_status
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(auth.uid(), 'library:manage'));

DROP POLICY IF EXISTS "Admins can update extraction status" ON pdf_extraction_status;
CREATE POLICY "pdf_extraction_status_update" ON pdf_extraction_status
  FOR UPDATE TO authenticated
  USING (user_has_permission(auth.uid(), 'library:manage'))
  WITH CHECK (user_has_permission(auth.uid(), 'library:manage'));

DROP POLICY IF EXISTS "Admins can insert pdf text" ON pdf_text_pages;
CREATE POLICY "pdf_text_pages_insert" ON pdf_text_pages
  FOR INSERT TO authenticated
  WITH CHECK (user_has_permission(auth.uid(), 'library:manage'));

DROP POLICY IF EXISTS "Admins can delete pdf text" ON pdf_text_pages;
CREATE POLICY "pdf_text_pages_delete" ON pdf_text_pages
  FOR DELETE TO authenticated
  USING (user_has_permission(auth.uid(), 'library:manage'));
