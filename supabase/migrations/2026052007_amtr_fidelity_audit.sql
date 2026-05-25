-- ============================================================
-- AMTR — Migration 7: e-signature locking, audit log, form fidelity
--
-- • Whole-row locking on signable tables: when all REQUIRED signature
--   slots for an item are filled, the row locks (locked_at/locked_by).
--   amtr_sign refuses to write a locked row; amtr_reopen (NAMT/AFM)
--   clears the lock. Every sign + reopen writes an amtr_audit_log row.
-- • amtr_audit_log — per-record History view source.
-- • amtr_803.remarks + amtr_milestone_catalog.haf_milestone (form parity).
-- ============================================================

-- ── Lock columns on every signable table ───────────────────
ALTER TABLE amtr_623a               ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS locked_by UUID;
ALTER TABLE amtr_797                ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS locked_by UUID;
ALTER TABLE amtr_803                ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS locked_by UUID;
ALTER TABLE amtr_jqs_progress       ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS locked_by UUID;
ALTER TABLE amtr_1098_progress      ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS locked_by UUID;
ALTER TABLE amtr_milestone_progress ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS locked_by UUID;

-- ── Form-fidelity columns ──────────────────────────────────
ALTER TABLE amtr_803                ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE amtr_milestone_catalog  ADD COLUMN IF NOT EXISTS haf_milestone TEXT;

-- ── Audit log ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS amtr_audit_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id        UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  member_id      UUID REFERENCES amtr_members(id) ON DELETE CASCADE,
  actor_user_id  UUID,
  action         TEXT NOT NULL,           -- sign | reopen | lock
  table_name     TEXT,
  row_id         UUID,
  detail         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amtr_audit_member ON amtr_audit_log(member_id, created_at DESC);

ALTER TABLE amtr_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "amtr_audit_select" ON amtr_audit_log FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:view'));
-- No INSERT/UPDATE/DELETE policies — only the SECURITY DEFINER RPCs write here.

-- ── Required-slot set per signable table ───────────────────
CREATE OR REPLACE FUNCTION public.amtr_required_slots(p_table TEXT, p_row_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_req_cert BOOLEAN;
BEGIN
  CASE p_table
    WHEN 'amtr_623a'               THEN RETURN ARRAY['trainee','trainer'];
    WHEN 'amtr_jqs_progress'       THEN RETURN ARRAY['trainee','trainer','certifier'];
    WHEN 'amtr_1098_progress'      THEN RETURN ARRAY['trainee','certifier'];
    WHEN 'amtr_milestone_progress' THEN RETURN ARRAY['certifier'];
    WHEN 'amtr_803'                THEN RETURN ARRAY['evaluator'];
    WHEN 'amtr_797' THEN
      SELECT requires_certifier INTO v_req_cert FROM amtr_797 WHERE id = p_row_id;
      IF COALESCE(v_req_cert, FALSE) THEN RETURN ARRAY['trainee','trainer','certifier'];
      ELSE RETURN ARRAY['trainee','trainer']; END IF;
    ELSE RETURN NULL;
  END CASE;
END $$;
GRANT EXECUTE ON FUNCTION public.amtr_required_slots(TEXT, UUID) TO authenticated;

-- ── amtr_sign: lock-aware + auto-lock + audit ──────────────
CREATE OR REPLACE FUNCTION public.amtr_sign(
  p_table TEXT, p_row_id UUID, p_slot TEXT, p_initials TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_slots    TEXT[];
  v_base_id  UUID;
  v_member   UUID;
  v_caller   UUID := auth.uid();
  v_sibling  TEXT;
  v_other_by UUID;
  v_role_ok  BOOLEAN;
  v_locked   TIMESTAMPTZ;
  v_req      TEXT[];
  v_all      BOOLEAN := TRUE;
  v_by       UUID;
BEGIN
  v_slots := amtr_slots_for_table(p_table);
  IF v_slots IS NULL THEN RAISE EXCEPTION 'amtr_sign: table % is not signable', p_table; END IF;
  IF NOT (p_slot = ANY (v_slots)) THEN RAISE EXCEPTION 'amtr_sign: slot % invalid for %', p_slot, p_table; END IF;

  EXECUTE format('SELECT base_id, member_id, locked_at FROM %I WHERE id = $1', p_table)
    INTO v_base_id, v_member, v_locked USING p_row_id;
  IF v_base_id IS NULL THEN RAISE EXCEPTION 'amtr_sign: row not found'; END IF;
  IF v_locked IS NOT NULL THEN RAISE EXCEPTION 'amtr_sign: record is locked — reopen it first'; END IF;

  IF NOT (user_has_base_access(v_caller, v_base_id) AND user_has_permission(v_caller, 'amtr:write')) THEN
    RAISE EXCEPTION 'amtr_sign: not authorized';
  END IF;

  IF p_slot = 'evaluator' THEN
    SELECT EXISTS (SELECT 1 FROM amtr_role_assignments WHERE base_id=v_base_id AND user_id=v_caller AND role IN ('trainer','certifier','namt','afm')) INTO v_role_ok;
  ELSE
    SELECT EXISTS (SELECT 1 FROM amtr_role_assignments WHERE base_id=v_base_id AND user_id=v_caller AND role=p_slot) INTO v_role_ok;
  END IF;
  IF NOT v_role_ok THEN RAISE EXCEPTION 'amtr_sign: caller lacks AMTR role for slot %', p_slot; END IF;

  FOREACH v_sibling IN ARRAY v_slots LOOP
    IF v_sibling <> p_slot THEN
      EXECUTE format('SELECT %I FROM %I WHERE id = $1', v_sibling || '_signed_by', p_table) INTO v_other_by USING p_row_id;
      IF v_other_by = v_caller THEN
        RAISE EXCEPTION 'amtr_sign: you already signed this record as %, cannot also sign as %', v_sibling, p_slot;
      END IF;
    END IF;
  END LOOP;

  EXECUTE format('UPDATE %I SET %I = $1, %I = $2, %I = now() WHERE id = $3',
    p_table, p_slot || '_initials', p_slot || '_signed_by', p_slot || '_signed_at')
    USING p_initials, v_caller, p_row_id;

  INSERT INTO amtr_audit_log (base_id, member_id, actor_user_id, action, table_name, row_id, detail)
    VALUES (v_base_id, v_member, v_caller, 'sign', p_table, p_row_id, format('Signed %s slot', p_slot));

  -- Auto-lock when all required slots are filled.
  v_req := amtr_required_slots(p_table, p_row_id);
  IF v_req IS NOT NULL THEN
    FOREACH v_sibling IN ARRAY v_req LOOP
      EXECUTE format('SELECT %I FROM %I WHERE id = $1', v_sibling || '_signed_by', p_table) INTO v_by USING p_row_id;
      IF v_by IS NULL THEN v_all := FALSE; EXIT; END IF;
    END LOOP;
    IF v_all THEN
      EXECUTE format('UPDATE %I SET locked_at = now(), locked_by = $1 WHERE id = $2', p_table) USING v_caller, p_row_id;
      INSERT INTO amtr_audit_log (base_id, member_id, actor_user_id, action, table_name, row_id, detail)
        VALUES (v_base_id, v_member, v_caller, 'lock', p_table, p_row_id, 'All required signatures complete');
    END IF;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.amtr_sign(TEXT, UUID, TEXT, TEXT) TO authenticated;

-- ── amtr_reopen: NAMT/AFM only, clears lock + audit ────────
CREATE OR REPLACE FUNCTION public.amtr_reopen(p_table TEXT, p_row_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_base_id UUID; v_member UUID; v_caller UUID := auth.uid(); v_ok BOOLEAN;
BEGIN
  IF amtr_slots_for_table(p_table) IS NULL THEN RAISE EXCEPTION 'amtr_reopen: table % not signable', p_table; END IF;
  EXECUTE format('SELECT base_id, member_id FROM %I WHERE id = $1', p_table) INTO v_base_id, v_member USING p_row_id;
  IF v_base_id IS NULL THEN RAISE EXCEPTION 'amtr_reopen: row not found'; END IF;
  SELECT EXISTS (SELECT 1 FROM amtr_role_assignments WHERE base_id=v_base_id AND user_id=v_caller AND role IN ('namt','afm')) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'amtr_reopen: only NAMT or AFM may reopen a locked record'; END IF;

  EXECUTE format('UPDATE %I SET locked_at = NULL, locked_by = NULL WHERE id = $1', p_table) USING p_row_id;
  INSERT INTO amtr_audit_log (base_id, member_id, actor_user_id, action, table_name, row_id, detail)
    VALUES (v_base_id, v_member, v_caller, 'reopen', p_table, p_row_id, 'Reopened locked record');
END $$;
GRANT EXECUTE ON FUNCTION public.amtr_reopen(TEXT, UUID) TO authenticated;
