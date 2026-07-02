-- ============================================================
-- ppr_number_sequence — add permission half to the write policy
--
-- Finding (audit 2026-07-01, LOW): ppr_number_sequence_write was FOR ALL gated
-- only on user_has_base_access(base_id) — any base member could edit the per-base
-- PPR numbering row (dup/replay risk, mitigated by UNIQUE(base_id, ppr_number) on
-- entries). The sequence is only ever advanced by the PPR-entry creation flow, which
-- requires ppr:write; the public anon submission uses a SECURITY DEFINER RPC that
-- bypasses RLS, so adding the permission half is safe defense-in-depth.
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS ppr_number_sequence_write ON public.ppr_number_sequence;
CREATE POLICY ppr_number_sequence_write ON public.ppr_number_sequence
  FOR ALL TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'ppr:write')
  )
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'ppr:write')
  );

COMMIT;
