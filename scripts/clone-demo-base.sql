-- ============================================================
-- clone-demo-base.sql — deep-clone one base into a new demo base.
--
-- NOT a schema migration (do NOT put in supabase/migrations/). This is a
-- one-off DB seeding tool for standing up demo/marketing bases. It duplicates
-- every base-scoped row of a source base under a NEW base with deterministic
-- md5-remapped UUIDs, preserving all internal foreign-key links, and rebuilds
-- the lighting compliance to a chosen standard.
--
-- HOW IT WORKS
--   * new base id = md5(src || salt)::uuid — deterministic + reproducible.
--   * Every base-scoped table is cloned generically: id -> md5(id||salt),
--     base_id -> new base, intra-base FK columns -> md5(fk||salt), and the
--     globally-unique display_id / waiver_number get a fresh suffix.
--   * FK enforcement + triggers are disabled for the load
--     (SET LOCAL session_replication_role = replica) so insert order and the
--     discrepancies<->notams style cycles don't matter.
--   * Child tables that have NO base_id but hang off a base-scoped parent
--     (lighting_system_components, aep_comms_check_results,
--     base_inspection_sections, field_condition_thirds,
--     shift_checklist_responses) are handled explicitly.
--   * Lighting: the source's components are NOT copied. New 'overall'
--     components are created from outage_rule_templates for `new_lighting_std`
--     (one per active system whose type has a template), and features are
--     relinked to them — so the clone runs the TARGET standard's thresholds.
--   * Skipped: activity_log, page_view_daily (pure telemetry — the clone
--     starts with an empty event/analytics history).
--   * Re-run guard: aborts if the deterministic new base id already exists.
--
-- USAGE (via `npx supabase db query --linked --file scripts/clone-demo-base.sql`)
--   1. Edit the CONFIG block below (source base, salt, new identity+standards).
--   2. DRY RUN first: change the final COMMIT to ROLLBACK, run, read the
--      verification row, confirm counts match the source.
--   3. Flip ROLLBACK back to COMMIT and run for real.
--
-- Instance of record: EDGP "Demo International Airport" (ICAO Annex 14 demo)
--   was cloned from KDRA on 2026-07-23 with salt 'icao-clone-v1'.
-- ============================================================
BEGIN;
SET LOCAL session_replication_role = replica;  -- disable FK checks + triggers

DO $$
DECLARE
  -- ─── CONFIG ───────────────────────────────────────────────
  src                uuid := 'ea2b542e-72cc-4300-9037-bfe18c0bf7ae';  -- source base (KDRA)
  salt               text := 'icao-clone-v1';                          -- unique per clone
  new_icao           text := 'EDGP';
  new_name           text := 'Demo International Airport';
  new_lighting_std   text := 'icao';           -- dafman | faa | icao
  new_surface_set    text := 'icao_annex14';   -- ufc_3_260_01 | faa_part77 | icao_annex14
  excluded           text[] := ARRAY['page_view_daily', 'activity_log'];
  -- ──────────────────────────────────────────────────────────
  newbase    uuid := md5('ea2b542e-72cc-4300-9037-bfe18c0bf7ae' || 'icao-clone-v1')::uuid;
  basescoped text[];
  rec        record;
  collist    text;
  sellist    text;
BEGIN
  newbase := md5(src::text || salt)::uuid;

  IF EXISTS (SELECT 1 FROM bases WHERE id = newbase) THEN
    RAISE EXCEPTION 'Clone base % already exists — aborting', newbase;
  END IF;

  SELECT array_agg(DISTINCT table_name) INTO basescoped
  FROM information_schema.columns
  WHERE table_schema = 'public' AND column_name = 'base_id';

  -- 1) Clone the bases row (override identity + standards)
  SELECT
    string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position),
    string_agg(CASE column_name
      WHEN 'id'                      THEN quote_literal(newbase::text) || '::uuid'
      WHEN 'icao'                    THEN quote_literal(new_icao)
      WHEN 'name'                    THEN quote_literal(new_name)
      WHEN 'lighting_standard'       THEN quote_literal(new_lighting_std)
      WHEN 'obstruction_surface_set' THEN quote_literal(new_surface_set)
      ELSE quote_ident(column_name) END, ', ' ORDER BY ordinal_position)
    INTO collist, sellist
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'bases' AND is_generated <> 'ALWAYS';
  EXECUTE format('INSERT INTO public.bases (%s) SELECT %s FROM public.bases WHERE id = %L',
                 collist, sellist, src);

  -- 2) Generically clone every base-scoped table (deterministic remap)
  FOR rec IN
    SELECT DISTINCT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.column_name = 'base_id'
      AND c.table_name <> ALL (excluded)
    ORDER BY c.table_name
  LOOP
    SELECT
      string_agg(quote_ident(col.column_name), ', ' ORDER BY col.ordinal_position),
      string_agg(CASE
        WHEN col.column_name = 'base_id' THEN quote_literal(newbase::text) || '::uuid'
        WHEN col.column_name = 'id'      THEN 'md5(id::text || ' || quote_literal(salt) || ')::uuid'
        WHEN col.column_name IN ('display_id', 'waiver_number') THEN
          'CASE WHEN ' || quote_ident(col.column_name) || ' IS NULL THEN NULL ELSE split_part('
          || quote_ident(col.column_name) || ', ''-'', 1) || ''-'' || upper(substr(md5(id::text || '
          || quote_literal(salt) || '), 1, 6)) END'
        WHEN col.column_name IN (
          SELECT kcu.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
            AND tc.table_name = rec.table_name AND ccu.table_name = ANY (basescoped)
        )
        THEN 'CASE WHEN ' || quote_ident(col.column_name) || ' IS NULL THEN NULL ELSE md5('
             || quote_ident(col.column_name) || '::text || ' || quote_literal(salt) || ')::uuid END'
        ELSE quote_ident(col.column_name)
      END, ', ' ORDER BY col.ordinal_position)
      INTO collist, sellist
    FROM information_schema.columns col
    WHERE col.table_schema = 'public' AND col.table_name = rec.table_name AND col.is_generated <> 'ALWAYS';

    EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM public.%I WHERE base_id = %L',
                   rec.table_name, collist, sellist, rec.table_name, src);
  END LOOP;

  -- 3) Child tables WITHOUT base_id (scoped via parent FK): clone with id + FK remap.
  CREATE TEMP TABLE _accr ON COMMIT DROP AS
    SELECT * FROM aep_comms_check_results WHERE check_id IN (SELECT id FROM aep_comms_checks WHERE base_id = src);
  UPDATE _accr SET id = md5(id::text||salt)::uuid,
    check_id = md5(check_id::text||salt)::uuid,
    agency_id = CASE WHEN agency_id IS NULL THEN NULL ELSE md5(agency_id::text||salt)::uuid END;
  INSERT INTO aep_comms_check_results SELECT * FROM _accr;

  CREATE TEMP TABLE _bis ON COMMIT DROP AS
    SELECT * FROM base_inspection_sections WHERE template_id IN (SELECT id FROM base_inspection_templates WHERE base_id = src);
  UPDATE _bis SET id = md5(id::text||salt)::uuid, template_id = md5(template_id::text||salt)::uuid;
  INSERT INTO base_inspection_sections SELECT * FROM _bis;

  CREATE TEMP TABLE _fct ON COMMIT DROP AS
    SELECT * FROM field_condition_thirds WHERE report_id IN (SELECT id FROM field_condition_reports WHERE base_id = src);
  UPDATE _fct SET id = md5(id::text||salt)::uuid, report_id = md5(report_id::text||salt)::uuid;
  INSERT INTO field_condition_thirds SELECT * FROM _fct;

  CREATE TEMP TABLE _scr ON COMMIT DROP AS
    SELECT * FROM shift_checklist_responses WHERE checklist_id IN (SELECT id FROM shift_checklists WHERE base_id = src);
  UPDATE _scr SET id = md5(id::text||salt)::uuid,
    checklist_id = md5(checklist_id::text||salt)::uuid,
    item_id = CASE WHEN item_id IS NULL THEN NULL ELSE md5(item_id::text||salt)::uuid END;
  INSERT INTO shift_checklist_responses SELECT * FROM _scr;

  -- 4) Lighting: build components for `new_lighting_std` + relink features
  --    (the source's components are intentionally NOT copied).
  -- 4a) one 'overall' component per new system whose source system had a component
  INSERT INTO lighting_system_components
    (id, system_id, component_type, label, total_count,
     allowable_outage_pct, allowable_outage_count, allowable_outage_consecutive,
     allowable_no_adjacent, allowable_outage_text, is_zero_tolerance,
     requires_notam, requires_ce_notification, requires_system_shutoff,
     requires_terps_notification, requires_obstruction_notam_attrs,
     q_code, notam_text_template, sort_order)
  SELECT md5(ls.id::text || 'icao-comp')::uuid, ls.id, 'overall', tpl.label, 0,
     tpl.allowable_outage_pct, tpl.allowable_outage_count, tpl.allowable_outage_consecutive,
     tpl.allowable_no_adjacent, tpl.allowable_outage_text, tpl.is_zero_tolerance,
     tpl.requires_notam, tpl.requires_ce_notification, tpl.requires_system_shutoff,
     tpl.requires_terps_notification, tpl.requires_obstruction_notam_attrs,
     tpl.q_code, tpl.notam_text_template, tpl.sort_order
  FROM lighting_systems ls
  JOIN outage_rule_templates tpl
    ON tpl.standard = new_lighting_std AND tpl.system_type = ls.system_type AND tpl.component_type = 'overall'
  WHERE ls.base_id = newbase
    AND EXISTS (SELECT 1 FROM lighting_systems kls
                JOIN lighting_system_components kc ON kc.system_id = kls.id
                WHERE kls.base_id = src AND md5(kls.id::text || salt)::uuid = ls.id);

  -- 4b) relink cloned features (they still point at the source's components)
  UPDATE infrastructure_features f
  SET system_component_id = md5(md5(kc.system_id::text || salt)::uuid::text || 'icao-comp')::uuid
  FROM lighting_system_components kc
  WHERE f.base_id = newbase
    AND f.system_component_id = kc.id
    AND EXISTS (SELECT 1 FROM lighting_system_components ic
                WHERE ic.id = md5(md5(kc.system_id::text || salt)::uuid::text || 'icao-comp')::uuid);

  -- 4c) null any feature not now pointing at a component of the new base
  UPDATE infrastructure_features f
  SET system_component_id = NULL
  WHERE f.base_id = newbase AND f.system_component_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM lighting_system_components ic
                    JOIN lighting_systems ils ON ils.id = ic.system_id
                    WHERE ic.id = f.system_component_id AND ils.base_id = newbase);
END $$;

-- Verification (read before COMMIT; compare against the source base)
SELECT
  (SELECT lighting_standard FROM bases WHERE icao = 'EDGP') AS lstd,
  (SELECT obstruction_surface_set FROM bases WHERE icao = 'EDGP') AS surfset,
  (SELECT count(*) FROM lighting_systems WHERE base_id = (SELECT id FROM bases WHERE icao='EDGP')) AS systems,
  (SELECT count(*) FROM lighting_system_components c JOIN lighting_systems ls ON ls.id=c.system_id WHERE ls.base_id=(SELECT id FROM bases WHERE icao='EDGP')) AS components,
  (SELECT count(*) FROM infrastructure_features WHERE base_id=(SELECT id FROM bases WHERE icao='EDGP')) AS features,
  (SELECT count(*) FROM infrastructure_features WHERE base_id=(SELECT id FROM bases WHERE icao='EDGP') AND system_component_id IS NOT NULL) AS linked,
  (SELECT count(*) FROM airfield_checks WHERE base_id=(SELECT id FROM bases WHERE icao='EDGP')) AS checks,
  (SELECT count(*) FROM base_members WHERE base_id=(SELECT id FROM bases WHERE icao='EDGP')) AS members;

COMMIT;
