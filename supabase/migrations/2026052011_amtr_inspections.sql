-- ============================================================
-- AMTR — Migration 12: monthly training-record inspections.
--
-- • amtr_inspection_checklist — base-shared, editable checklist
--   config (sections + items) backing the Inspection Checklist
--   builder on the Training Admin page. Seeded from the standard
--   checklist; items carry an optional stable `auto_key` that the
--   gap engine keys off (renumbering/rewording never breaks auto).
-- • amtr_inspections — a per-member inspection: the filled checklist
--   responses (items JSONB), counts, notes, and completion metadata.
--   No signatures — an inspection is simply marked completed.
-- ============================================================

-- ── Editable checklist config (base-shared) ────────────────
CREATE TABLE IF NOT EXISTS amtr_inspection_checklist (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id      UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('section','item')),
  label        TEXT NOT NULL,
  item_number  TEXT,
  auto_key     TEXT,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amtr_insp_checklist_base ON amtr_inspection_checklist(base_id, sort_order);

ALTER TABLE amtr_inspection_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "amtr_insp_checklist_select" ON amtr_inspection_checklist FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:view'));
CREATE POLICY "amtr_insp_checklist_write" ON amtr_inspection_checklist FOR ALL TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:manage'))
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:manage'));

-- ── Per-member inspections ─────────────────────────────────
CREATE TABLE IF NOT EXISTS amtr_inspections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id           UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  member_id         UUID NOT NULL REFERENCES amtr_members(id) ON DELETE CASCADE,
  inspection_date   DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','completed')),
  items             JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes             TEXT,
  yes_count         INT NOT NULL DEFAULT 0,
  no_count          INT NOT NULL DEFAULT 0,
  na_count          INT NOT NULL DEFAULT 0,
  gap_count         INT NOT NULL DEFAULT 0,
  completed_at      TIMESTAMPTZ,
  completed_by      UUID,
  completed_by_name TEXT,
  created_623a_id   UUID,
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amtr_inspections_member ON amtr_inspections(member_id, inspection_date DESC);
CREATE INDEX IF NOT EXISTS idx_amtr_inspections_base ON amtr_inspections(base_id, inspection_date DESC);

ALTER TABLE amtr_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "amtr_inspections_select" ON amtr_inspections FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:view'));
CREATE POLICY "amtr_inspections_insert" ON amtr_inspections FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:write'));
CREATE POLICY "amtr_inspections_update" ON amtr_inspections FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:write'));
CREATE POLICY "amtr_inspections_delete" ON amtr_inspections FOR DELETE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'amtr:delete'));
