-- ============================================================
-- AMTR — Migration 3/6: per-member progress + AF form tables
--
-- Signature slot convention (mirrors daily_reviews signed_by/at):
-- each slot = {*_initials TEXT, *_signed_by UUID, *_signed_at TIMESTAMPTZ,
-- *_signed_role TEXT}. *_signed_by records the real authenticated signer
-- (even when a privileged user signs for an unlinked member), *_signed_role
-- records which AMTR role they used (one-signature-per-record rule).
--
-- All tables: base_id + member_id, RLS view=amtr:view / write=amtr:write /
-- delete=amtr:delete. Per-role signature validation is enforced by the
-- SECURITY DEFINER RPCs in migration 5 — generic row writes here use amtr:write.
-- ============================================================

-- ── QTP packages + lessons (Qualifications tab) ────────────
CREATE TABLE amtr_qtp (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id       UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  member_id     UUID NOT NULL REFERENCES amtr_members(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  complete_date DATE,
  ecd           DATE,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_amtr_qtp_member ON amtr_qtp(member_id);

CREATE TABLE amtr_qtp_lessons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id       UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  qtp_id        UUID NOT NULL REFERENCES amtr_qtp(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  start_date    DATE,
  complete_date DATE,
  sort_order    INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_amtr_qtp_lessons_qtp ON amtr_qtp_lessons(qtp_id);

-- ── Yes/No qualifications + SEIs ───────────────────────────
CREATE TABLE amtr_quals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id    UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES amtr_members(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  value      TEXT,            -- 'Yes' / 'No'
  notes      TEXT,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_amtr_quals_member ON amtr_quals(member_id);

-- ── Formal training progress (per catalog course) ──────────
CREATE TABLE amtr_formal_progress (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id       UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  member_id     UUID NOT NULL REFERENCES amtr_members(id) ON DELETE CASCADE,
  catalog_id    UUID NOT NULL REFERENCES amtr_formal_catalog(id) ON DELETE CASCADE,
  start_date    DATE,
  complete_date DATE,
  UNIQUE (member_id, catalog_id)
);
CREATE INDEX idx_amtr_formal_progress_member ON amtr_formal_progress(member_id);

-- ── DAF 623A narrative entries (4 sign-off columns) ────────
CREATE TABLE amtr_623a (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id          UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  member_id        UUID NOT NULL REFERENCES amtr_members(id) ON DELETE CASCADE,
  form_date        DATE,
  entry_type       TEXT,
  trainee_comment  TEXT, trainee_initials TEXT, trainee_signed_by UUID, trainee_signed_at TIMESTAMPTZ,
  trainer_comment  TEXT, trainer_initials TEXT, trainer_signed_by UUID, trainer_signed_at TIMESTAMPTZ,
  namt_comment     TEXT, namt_initials TEXT, namt_signed_by UUID, namt_signed_at TIMESTAMPTZ,
  afm_comment      TEXT, afm_initials TEXT, afm_signed_by UUID, afm_signed_at TIMESTAMPTZ,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_amtr_623a_member ON amtr_623a(member_id);

-- ── DAF 797 task certification log ─────────────────────────
CREATE TABLE amtr_797 (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id            UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  member_id          UUID NOT NULL REFERENCES amtr_members(id) ON DELETE CASCADE,
  task               TEXT NOT NULL,
  start_date         DATE,
  complete_date      DATE,
  requires_certifier BOOLEAN NOT NULL DEFAULT FALSE,
  milestone_window   TEXT,
  trainee_initials   TEXT, trainee_signed_by UUID, trainee_signed_at TIMESTAMPTZ,
  trainer_initials   TEXT, trainer_signed_by UUID, trainer_signed_at TIMESTAMPTZ,
  certifier_initials TEXT, certifier_signed_by UUID, certifier_signed_at TIMESTAMPTZ,
  added_by           UUID,
  sort_order         INT NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_amtr_797_member ON amtr_797(member_id);

-- ── DAF 803 task performance evaluations ───────────────────
CREATE TABLE amtr_803 (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id            UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  member_id          UUID NOT NULL REFERENCES amtr_members(id) ON DELETE CASCADE,
  section            TEXT NOT NULL CHECK (section IN ('apprenticeGrad','amslAmos','fiveLevel','sevenLevel','afm')),
  sts_item           TEXT,
  eval_date          DATE,
  in_ugt             TEXT,            -- 'Yes' / 'No'
  results            TEXT,            -- 'SAT' / 'UNSAT'
  unsat_comment      TEXT,
  evaluator_initials TEXT, evaluator_signed_by UUID, evaluator_signed_at TIMESTAMPTZ,
  sort_order         INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_amtr_803_member ON amtr_803(member_id, section);

-- ── Milestone progress (per catalog item) ──────────────────
CREATE TABLE amtr_milestone_progress (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id            UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  member_id          UUID NOT NULL REFERENCES amtr_members(id) ON DELETE CASCADE,
  catalog_id         UUID NOT NULL REFERENCES amtr_milestone_catalog(id) ON DELETE CASCADE,
  completed          BOOLEAN NOT NULL DEFAULT FALSE,
  completed_date     DATE,
  certifier_initials TEXT, certifier_signed_by UUID, certifier_signed_at TIMESTAMPTZ,
  UNIQUE (member_id, catalog_id)
);
CREATE INDEX idx_amtr_milestone_progress_member ON amtr_milestone_progress(member_id);

-- ── 1098 recurring-training progress (per year + task) ─────
CREATE TABLE amtr_1098_progress (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id            UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  member_id          UUID NOT NULL REFERENCES amtr_members(id) ON DELETE CASCADE,
  catalog_id         UUID NOT NULL REFERENCES amtr_1098_catalog(id) ON DELETE CASCADE,
  year_label         TEXT NOT NULL,
  start_date         DATE,
  last_completed     DATE,
  next_due           DATE,
  score_or_hours     TEXT,
  trainee_initials   TEXT, trainee_signed_by UUID, trainee_signed_at TIMESTAMPTZ,
  certifier_initials TEXT, certifier_signed_by UUID, certifier_signed_at TIMESTAMPTZ,
  UNIQUE (member_id, catalog_id, year_label)
);
CREATE INDEX idx_amtr_1098_progress_member ON amtr_1098_progress(member_id, year_label);

-- ── JQS-CFETP progress (per catalog item) ──────────────────
CREATE TABLE amtr_jqs_progress (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id            UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  member_id          UUID NOT NULL REFERENCES amtr_members(id) ON DELETE CASCADE,
  catalog_id         UUID NOT NULL REFERENCES amtr_jqs_catalog(id) ON DELETE CASCADE,
  start_date         DATE,
  complete_date      DATE,
  trainee_initials   TEXT, trainee_signed_by UUID, trainee_signed_at TIMESTAMPTZ,
  trainer_initials   TEXT, trainer_signed_by UUID, trainer_signed_at TIMESTAMPTZ,
  certifier_initials TEXT, certifier_signed_by UUID, certifier_signed_at TIMESTAMPTZ,
  UNIQUE (member_id, catalog_id)
);
CREATE INDEX idx_amtr_jqs_progress_member ON amtr_jqs_progress(member_id);

-- ── RAT progress (per catalog requirement) ─────────────────
CREATE TABLE amtr_rat_progress (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id    UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES amtr_members(id) ON DELETE CASCADE,
  catalog_id UUID NOT NULL REFERENCES amtr_rat_catalog(id) ON DELETE CASCADE,
  completed  DATE,
  due        DATE,
  UNIQUE (member_id, catalog_id)
);
CREATE INDEX idx_amtr_rat_progress_member ON amtr_rat_progress(member_id);

-- ── Supporting files (metadata; bytes live in Storage) ─────
CREATE TABLE amtr_files (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id      UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  member_id    UUID NOT NULL REFERENCES amtr_members(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  uploaded_at  DATE,
  size         TEXT,
  status       TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Verified','Pending','Missing')),
  storage_path TEXT,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_amtr_files_member ON amtr_files(member_id);

-- ── RLS: view=amtr:view, write=amtr:write, delete=amtr:delete ──
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'amtr_qtp','amtr_qtp_lessons','amtr_quals','amtr_formal_progress',
    'amtr_623a','amtr_797','amtr_803','amtr_milestone_progress',
    'amtr_1098_progress','amtr_jqs_progress','amtr_rat_progress','amtr_files'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), ''amtr:view''));',
      t || '_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), ''amtr:write''));',
      t || '_insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), ''amtr:write''));',
      t || '_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), ''amtr:delete''));',
      t || '_delete', t);
  END LOOP;
END $$;
