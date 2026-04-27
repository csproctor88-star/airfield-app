-- ============================================================
-- PPR Remarks — free-form comment thread per PPR entry, similar
-- to discrepancy status_updates. Any user with `ppr:view` can
-- read and add remarks (the bar is intentionally low so anyone
-- in the loop on a given request can leave context). Edit and
-- delete are gated on `ppr:write`.
--
-- Coordination comments left via the existing coord modal are
-- ALSO persisted as remarks (handled in lib/supabase/ppr.ts), so
-- the remarks thread becomes the single timeline of human notes
-- on the entry.
-- ============================================================

CREATE TABLE IF NOT EXISTS ppr_remarks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id   UUID NOT NULL REFERENCES ppr_entries(id) ON DELETE CASCADE,
  base_id    UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  remark     TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ppr_remarks_entry ON ppr_remarks(entry_id, created_at DESC);

ALTER TABLE ppr_remarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ppr_remarks_select" ON ppr_remarks;
DROP POLICY IF EXISTS "ppr_remarks_insert" ON ppr_remarks;
DROP POLICY IF EXISTS "ppr_remarks_update" ON ppr_remarks;
DROP POLICY IF EXISTS "ppr_remarks_delete" ON ppr_remarks;

CREATE POLICY "ppr_remarks_select" ON ppr_remarks
  FOR SELECT TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'ppr:view')
  );

-- INSERT is open to any viewer. Per spec, "all users should be
-- able to leave remarks" — gating on ppr:view (not ppr:write)
-- mirrors the intent.
CREATE POLICY "ppr_remarks_insert" ON ppr_remarks
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'ppr:view')
  );

CREATE POLICY "ppr_remarks_update" ON ppr_remarks
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'ppr:write')
  );

CREATE POLICY "ppr_remarks_delete" ON ppr_remarks
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'ppr:write')
  );
