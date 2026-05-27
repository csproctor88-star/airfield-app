-- ============================================================
-- AMTR 1098 — Per-year catalog isolation, archive lock, manual due-date
--
-- Three coordinated changes to amtr_1098_* so historical years can be
-- frozen and so catalog edits stop bleeding across years.
--
-- 1. amtr_1098_catalog gains `year_label`. Each year owns its own set
--    of catalog rows; editing the 2026 catalog leaves the 2025 catalog
--    untouched. Existing rows are backfilled to the current year, then
--    a clone is created for every historical year that already has
--    progress rows so those records keep pointing at a row with the
--    same task name (the FK target is rewritten in the same migration).
--
-- 2. amtr_1098_years gains `archived` / `archived_at` / `archived_by`.
--    The new `is_1098_year_archived(base_id, year_label)` helper is
--    folded into the catalog and progress write policies so an
--    archived year is read-only — no date edits, no signatures, no
--    catalog edits — regardless of any caller's `amtr:write` /
--    `amtr:manage` grant. Unarchive restores write access.
--
-- 3. amtr_1098_progress gains `next_due_manual`. When NAMT manually
--    enters a due date the flag flips true; subsequent edits to
--    `last_completed` skip auto-recompute so the manual override
--    sticks. UI exposes a "reset to auto" action that clears the flag.
-- ============================================================

-- ── 1. amtr_1098_catalog.year_label ─────────────────────────
ALTER TABLE amtr_1098_catalog ADD COLUMN IF NOT EXISTS year_label TEXT;

-- Backfill existing rows to the current calendar year (UTC). After
-- the backfill every catalog row has a year_label.
UPDATE amtr_1098_catalog
SET year_label = TO_CHAR(now() AT TIME ZONE 'UTC', 'YYYY')
WHERE year_label IS NULL;

-- For each historical year_label that has progress rows pointing at
-- the freshly-tagged current-year catalog, clone the catalog rows
-- under that historical year_label. The clones are new UUIDs; we
-- carry task / type / frequency / sort_order forward.
INSERT INTO amtr_1098_catalog (base_id, task, type, frequency, sort_order, year_label)
SELECT DISTINCT c.base_id, c.task, c.type, c.frequency, c.sort_order, p.year_label
FROM amtr_1098_catalog c
JOIN amtr_1098_progress p ON p.catalog_id = c.id
WHERE p.year_label <> c.year_label
  AND NOT EXISTS (
    SELECT 1 FROM amtr_1098_catalog c2
    WHERE c2.base_id = c.base_id AND c2.task = c.task AND c2.year_label = p.year_label
  );

-- Rewrite progress.catalog_id to point at its year's clone. After
-- this pass every progress row references a catalog row with the
-- same year_label. Uses a CTE because UPDATE ... FROM ... JOIN can't
-- reference the target alias from inside the JOIN's ON clause.
WITH mapping AS (
  SELECT p.id AS progress_id, c2.id AS new_catalog_id
  FROM amtr_1098_progress p
  JOIN amtr_1098_catalog c1 ON c1.id = p.catalog_id
  JOIN amtr_1098_catalog c2
    ON c2.base_id    = c1.base_id
   AND c2.task       = c1.task
   AND c2.year_label = p.year_label
  WHERE p.year_label <> c1.year_label
)
UPDATE amtr_1098_progress p
SET catalog_id = m.new_catalog_id
FROM mapping m
WHERE m.progress_id = p.id;

-- Lock the column NOT NULL and add the per-year uniqueness index.
-- (One task per (base, year). Same task can repeat across years.)
ALTER TABLE amtr_1098_catalog ALTER COLUMN year_label SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_amtr_1098_catalog_year_task
  ON amtr_1098_catalog(base_id, year_label, task);

-- Replace the original base+sort_order index with one that includes year.
DROP INDEX IF EXISTS idx_amtr_1098_catalog_base;
CREATE INDEX IF NOT EXISTS idx_amtr_1098_catalog_year_sort
  ON amtr_1098_catalog(base_id, year_label, sort_order);

-- ── 2. amtr_1098_years archive columns + helper ─────────────
ALTER TABLE amtr_1098_years
  ADD COLUMN IF NOT EXISTS archived    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- A year is "managed" only when there's an amtr_1098_years row for
-- the (base, year_label) pair. If no row exists, the year is treated
-- as NOT archived (current year and unmanaged transcription years
-- still allow writes). Once a row exists with archived=true, writes
-- are blocked at the RLS layer.
CREATE OR REPLACE FUNCTION is_1098_year_archived(base_uuid UUID, year_text TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT archived FROM amtr_1098_years
     WHERE base_id = base_uuid AND year_label = year_text
     LIMIT 1),
    FALSE
  )
$$;

-- ── 3. amtr_1098_progress.next_due_manual ───────────────────
ALTER TABLE amtr_1098_progress
  ADD COLUMN IF NOT EXISTS next_due_manual BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 4. Replace write policies to gate on archive ────────────
-- amtr_1098_catalog: write policy was FOR ALL with amtr:manage.
DROP POLICY IF EXISTS "amtr_1098_catalog_write" ON amtr_1098_catalog;
CREATE POLICY "amtr_1098_catalog_write" ON amtr_1098_catalog FOR ALL TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'amtr:manage')
    AND NOT is_1098_year_archived(base_id, year_label)
  )
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'amtr:manage')
    AND NOT is_1098_year_archived(base_id, year_label)
  );

-- amtr_1098_years: write policy was FOR ALL with amtr:manage. Keep
-- the same shape but DON'T gate on archived — managers need to be
-- able to UPDATE this row to flip archived=false (unarchive).
DROP POLICY IF EXISTS "amtr_1098_years_write" ON amtr_1098_years;
CREATE POLICY "amtr_1098_years_write" ON amtr_1098_years FOR ALL TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:manage'))
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:manage'));

-- amtr_1098_progress: split INSERT/UPDATE/DELETE policies from
-- 2026052002 each gated on amtr:write. Add archive guard to all.
DROP POLICY IF EXISTS "amtr_1098_progress_insert" ON amtr_1098_progress;
CREATE POLICY "amtr_1098_progress_insert" ON amtr_1098_progress FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'amtr:write')
    AND NOT is_1098_year_archived(base_id, year_label)
  );
DROP POLICY IF EXISTS "amtr_1098_progress_update" ON amtr_1098_progress;
CREATE POLICY "amtr_1098_progress_update" ON amtr_1098_progress FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'amtr:write')
    AND NOT is_1098_year_archived(base_id, year_label)
  );
DROP POLICY IF EXISTS "amtr_1098_progress_delete" ON amtr_1098_progress;
CREATE POLICY "amtr_1098_progress_delete" ON amtr_1098_progress FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'amtr:delete')
    AND NOT is_1098_year_archived(base_id, year_label)
  );

-- 1098 resources are per-catalog-task; the catalog's year_label is
-- the authoritative source of archive state. RLS on the resources
-- table already gates on amtr:manage via the existing policy; we
-- could in theory gate it on the catalog row's year_label too, but
-- a resource link list isn't subject to the "freeze historical
-- records" intent — its rows are not per-year. Leave as-is.
