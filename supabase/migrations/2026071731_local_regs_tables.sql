-- ============================================================
-- Local Regulations (Base Regs) — Migration 2/4: tables + RLS
--
-- Spec: docs/superpowers/specs/2026-07-16-local-regulations-review-design.md
--       (§Data model & migrations, §Design — sibling tables, not a
--       read_files extension)
--
-- local_regulations — one row per uploaded document at a base. `version`
-- is bumped when a manager replaces the PDF, which flips every user to
-- the "updated" review state regardless of when they last reviewed
-- (re-upload resets the cycle — see lib/local-regs/review-status.ts).
--
-- local_regulation_reviews — insert-only audit of recurring reviews
-- (qrc_monthly_reviews shape, NOT read_file_acknowledgments' shape):
-- one row per review event, NO unique index on (regulation_id, user_id,
-- …) — re-reviewing inside the same cycle inserts a fresh row; the
-- latest row per user per reg wins (see computeDueRegIds /
-- partitionCompliance). Immutable — no UPDATE/DELETE policy.
--
-- RLS uses ONLY user_has_base_access() + user_has_permission() — the
-- permission-matrix helpers (2026042200_permission_matrix_scaffold.sql
-- onward). Never user_can_write / user_is_admin / user_is_base_admin_at
-- (all dropped in 2026042208).
--
-- STAGED — NOT applied. Staged 2026-07-17 for owner review; apply in
-- order with `npx supabase db query --linked --file <path>` —
-- 2026071730_local_regs_permissions.sql first, then this file.
--
-- Post-apply verification:
--   SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'local_regulation%';
--   -- expect rowsecurity = true for both tables
--   SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename LIKE 'local_regulation%' ORDER BY tablename, cmd;
--   -- expect 4 policies on local_regulations (select/insert/update/delete)
--   -- expect 2 policies on local_regulation_reviews (select/insert only —
--   --   NO update/delete rows should appear)
--   SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename LIKE 'local_regulation%';
--   -- expect BOTH local_regulations and local_regulation_reviews present
-- ============================================================

CREATE TABLE local_regulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,
  version INT NOT NULL DEFAULT 1,
  review_interval TEXT NOT NULL DEFAULT 'monthly' CHECK (review_interval IN ('monthly', 'quarterly')),
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX local_regulations_base_active_idx ON local_regulations(base_id, is_archived, created_at DESC);

-- Immutable insert-per-review rows (qrc_monthly_reviews shape); NO unique
-- index on (regulation_id, user_id, …) — re-reviewing inserts a fresh row.
CREATE TABLE local_regulation_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  regulation_id UUID NOT NULL REFERENCES local_regulations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version_at_review INT NOT NULL,
  initials_snapshot TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX local_regulation_reviews_lookup_idx ON local_regulation_reviews(base_id, user_id, regulation_id, reviewed_at DESC);
CREATE INDEX local_regulation_reviews_base_idx ON local_regulation_reviews(base_id, regulation_id);

ALTER TABLE local_regulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE local_regulation_reviews ENABLE ROW LEVEL SECURITY;

-- local_regulations: read with view, mutate with manage (read_files shape).
CREATE POLICY "local_regulations_select" ON local_regulations
  FOR SELECT TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'local_regs:view')
  );

CREATE POLICY "local_regulations_insert" ON local_regulations
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'local_regs:manage')
  );

CREATE POLICY "local_regulations_update" ON local_regulations
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'local_regs:manage')
  )
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'local_regs:manage')
  );

CREATE POLICY "local_regulations_delete" ON local_regulations
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'local_regs:manage')
  );

-- local_regulation_reviews: read with view (so compliance visibility can
-- read every reviewer's rows at the base, not just your own).
CREATE POLICY "local_regulation_reviews_select" ON local_regulation_reviews
  FOR SELECT TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'local_regs:view')
  );

-- Own row only; version_at_review server-validated against the live doc
-- version from day one (the read_file module's 2026062104 hardening
-- built in here at inception, not patched on later). The subselect runs
-- under the inserter's RLS — a doc they can't see yields NULL and the
-- equality fails (insert denied), same as read_file_ack_insert.
CREATE POLICY "local_regulation_reviews_insert" ON local_regulation_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_id = auth.uid()
    AND user_has_permission(auth.uid(), 'local_regs:view')
    AND version_at_review = (SELECT version FROM local_regulations WHERE id = regulation_id)
    -- Pin base_id to the parent document's base so a multi-base user can't
    -- tag a review with the wrong base_id (which would otherwise pass the
    -- base-access + view checks against a base they legitimately belong to
    -- while pointing at a regulation_id owned by a different base).
    AND base_id = (SELECT base_id FROM local_regulations WHERE id = regulation_id)
  );
-- No UPDATE/DELETE policies — reviews are immutable (CASCADE on doc delete).

-- ============================================================
-- Realtime publication membership.
--
-- useSidebarBadgeCounts + the Base Regs tab subscribe to postgres_changes
-- on both tables so the due-count dot / chip clears within seconds of a
-- review or replace. Without publication membership those subscriptions
-- fire never and the 60s polling fallback silently carries the module
-- forever. Idempotent guard (pg_publication_tables) so a re-apply is a
-- no-op — plain `ALTER PUBLICATION ... ADD TABLE` errors if already added.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'local_regulations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.local_regulations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'local_regulation_reviews'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.local_regulation_reviews;
  END IF;
END $$;
