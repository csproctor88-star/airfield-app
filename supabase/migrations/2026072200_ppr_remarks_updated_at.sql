-- ============================================================
-- PPR Remarks — track edits.
--
-- Authors can now edit (and delete) their own free-form remarks from
-- the PPR detail card (lib/supabase/ppr.ts updatePprRemark /
-- deletePprRemark, gated to created_by = auth.uid()). The existing
-- ppr_remarks_update RLS policy (2026042700, ppr:write) already admits
-- the UPDATE; this migration only adds an `updated_at` audit column plus
-- a trigger that stamps it, so the UI can show an honest "(edited)"
-- marker on a remark that was changed after it was first saved.
--
-- Additive and decoupled from the code: the write path sets only
-- `remark`, never `updated_at`, so edits work whether or not this has
-- been applied — before apply there's simply no "(edited)" marker.
--
-- Verify after apply:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'ppr_remarks' AND column_name = 'updated_at';
--   -- expect one row
--   SELECT tgname FROM pg_trigger WHERE tgrelid = 'ppr_remarks'::regclass
--   AND NOT tgisinternal;
--   -- expect trg_ppr_remarks_updated_at
-- ============================================================

ALTER TABLE ppr_remarks
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION ppr_remarks_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only a genuine remark edit bumps the marker; a no-op UPDATE that
  -- leaves the text untouched (or the mirror-insert path, which never
  -- UPDATEs) shouldn't flag the row as edited.
  IF NEW.remark IS DISTINCT FROM OLD.remark THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ppr_remarks_updated_at ON ppr_remarks;
CREATE TRIGGER trg_ppr_remarks_updated_at
  BEFORE UPDATE ON ppr_remarks
  FOR EACH ROW
  EXECUTE FUNCTION ppr_remarks_set_updated_at();
