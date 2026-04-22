-- ============================================================
-- Phase C — Swap wildlife + PPR RLS to the permission matrix
--
-- Background:
--   Both tables today gate writes via `user_can_write()`, which
--   only includes sys_admin / base_admin / airfield_manager / namo
--   / amops. That blocks two of the new Phase C roles:
--     • Safety (expected to log wildlife sightings + strikes)
--     • PPR    (expected to add / edit PPR entries)
--   Swapping these tables' INSERT/UPDATE/DELETE policies over to
--   `user_has_permission(..., '<key>')` is the first module
--   migration off the legacy helper, in line with the Phase D plan.
--
--   `user_can_write` stays alive; every role that had it also has
--   the equivalent matrix permission keys (`wildlife:write`,
--   `ppr:write`, etc.) seeded in the scaffold, so no change to the
--   other writable roles.
--
-- Idempotent — drop-then-recreate.
-- ============================================================

-- ── wildlife_sightings ─────────────────────────────────────
DROP POLICY IF EXISTS "wildlife_sightings_insert" ON wildlife_sightings;
CREATE POLICY "wildlife_sightings_insert" ON wildlife_sightings
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'wildlife:write')
  );

DROP POLICY IF EXISTS "wildlife_sightings_update" ON wildlife_sightings;
CREATE POLICY "wildlife_sightings_update" ON wildlife_sightings
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'wildlife:write')
  );

DROP POLICY IF EXISTS "wildlife_sightings_delete" ON wildlife_sightings;
CREATE POLICY "wildlife_sightings_delete" ON wildlife_sightings
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'wildlife:delete')
  );

-- ── wildlife_strikes ───────────────────────────────────────
DROP POLICY IF EXISTS "wildlife_strikes_insert" ON wildlife_strikes;
CREATE POLICY "wildlife_strikes_insert" ON wildlife_strikes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'wildlife:write')
  );

DROP POLICY IF EXISTS "wildlife_strikes_update" ON wildlife_strikes;
CREATE POLICY "wildlife_strikes_update" ON wildlife_strikes
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'wildlife:write')
  );

DROP POLICY IF EXISTS "wildlife_strikes_delete" ON wildlife_strikes;
CREATE POLICY "wildlife_strikes_delete" ON wildlife_strikes
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'wildlife:delete')
  );

-- ── bwc_history — Safety writes via BWC updates ────────────
DROP POLICY IF EXISTS "bwc_history_insert" ON bwc_history;
CREATE POLICY "bwc_history_insert" ON bwc_history
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'wildlife:write')
  );

-- ── ppr_entries — PPR role writes ──────────────────────────
DROP POLICY IF EXISTS "ppr_entries_insert" ON ppr_entries;
CREATE POLICY "ppr_entries_insert" ON ppr_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'ppr:write')
  );

DROP POLICY IF EXISTS "ppr_entries_update" ON ppr_entries;
CREATE POLICY "ppr_entries_update" ON ppr_entries
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'ppr:write')
  );

DROP POLICY IF EXISTS "ppr_entries_delete" ON ppr_entries;
CREATE POLICY "ppr_entries_delete" ON ppr_entries
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'ppr:delete')
  );
