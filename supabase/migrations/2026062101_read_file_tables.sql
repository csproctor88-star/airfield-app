-- ============================================================
-- Read File — Migration 2/4: tables + RLS
--
-- read_files: one row per uploaded document at a base. `version` is
-- bumped when a manager replaces the file, which (because acks are
-- version-stamped) re-triggers acknowledgment for everyone.
--
-- read_file_acknowledgments: insert-only audit of read & initial events.
-- One row per (file, user, version). Immutable — no UPDATE/DELETE policy.
-- ============================================================

CREATE TABLE read_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,
  version INT NOT NULL DEFAULT 1,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX read_files_base_active_idx
  ON read_files(base_id, is_archived, created_at DESC);

CREATE TABLE read_file_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  read_file_id UUID NOT NULL REFERENCES read_files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  acknowledged_version INT NOT NULL,
  initials_snapshot TEXT,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX read_file_ack_unique_idx
  ON read_file_acknowledgments(read_file_id, user_id, acknowledged_version);

CREATE INDEX read_file_ack_base_idx
  ON read_file_acknowledgments(base_id, read_file_id);

ALTER TABLE read_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE read_file_acknowledgments ENABLE ROW LEVEL SECURITY;

-- read_files: read with view, mutate with manage.
CREATE POLICY "read_files_select" ON read_files
  FOR SELECT TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'read_file:view')
  );

CREATE POLICY "read_files_insert" ON read_files
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'read_file:manage')
  );

CREATE POLICY "read_files_update" ON read_files
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'read_file:manage')
  )
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'read_file:manage')
  );

CREATE POLICY "read_files_delete" ON read_files
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'read_file:manage')
  );

-- read_file_acknowledgments: read with view (so the report can read all
-- acks at the base); insert only your own row. Immutable thereafter.
CREATE POLICY "read_file_ack_select" ON read_file_acknowledgments
  FOR SELECT TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'read_file:view')
  );

CREATE POLICY "read_file_ack_insert" ON read_file_acknowledgments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_id = auth.uid()
    AND user_has_permission(auth.uid(), 'read_file:view')
  );
-- No UPDATE / DELETE policies — acks are immutable (CASCADE on file delete).
