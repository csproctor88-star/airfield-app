-- ============================================================
-- Events Log (AF Form 3616 substitute) — base-scope UPDATE/DELETE
--
-- Finding (audit 2026-07-01, MED): activity_log_update / activity_log_delete
-- checked only (user_id = auth.uid() OR user_has_permission('activity_log:delete')).
-- The permission half had no base predicate, so a global activity_log:delete holder
-- could edit or erase entries at ANY base, and an editor could move an entry to a
-- base they don't administer.
--
-- Fix: require user_has_base_access(base_id) on both policies (USING + WITH CHECK on
-- UPDATE so the row can't be relocated to another base). The intentional, permission-
-- gated edit feature (notes + event time) is preserved — the "Amended" badge continues
-- to surface backdated corrections in the UI. Entity-linked cascade cleanups already
-- satisfied the author-or-permission half at their own base, so no workflow regresses.
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS activity_log_update ON public.activity_log;
CREATE POLICY activity_log_update ON public.activity_log
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND (
      user_id = auth.uid()
      OR user_has_permission(auth.uid(), 'activity_log:delete')
    )
  )
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND (
      user_id = auth.uid()
      OR user_has_permission(auth.uid(), 'activity_log:delete')
    )
  );

DROP POLICY IF EXISTS activity_log_delete ON public.activity_log;
CREATE POLICY activity_log_delete ON public.activity_log
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND (
      user_id = auth.uid()
      OR user_has_permission(auth.uid(), 'activity_log:delete')
    )
  );

COMMIT;
