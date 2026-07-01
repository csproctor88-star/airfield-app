-- Records-inspection 623A entries are signed by the Trainee + NAMT only (no
-- Trainer). Make the server-side required-slots helper entry-type-aware so the
-- fidelity audit agrees with the client gap engine. CREATE OR REPLACE preserves
-- the existing EXECUTE grant; no data change.
CREATE OR REPLACE FUNCTION public.amtr_required_slots(p_table TEXT, p_row_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_req_cert BOOLEAN; v_entry_type TEXT;
BEGIN
  CASE p_table
    WHEN 'amtr_623a' THEN
      SELECT entry_type INTO v_entry_type FROM amtr_623a WHERE id = p_row_id;
      IF v_entry_type = 'Monthly Training Records Inspection'
        THEN RETURN ARRAY['trainee','namt'];
        ELSE RETURN ARRAY['trainee','trainer'];
      END IF;
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
