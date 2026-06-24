-- 2026062305_flip_management.sql
-- FLIP Management module tables. All per-base, RLS via matrix helpers.

CREATE TABLE flip_text_sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id     UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL CHECK (section_key IN
                ('acct_info','appt_letter','ordering','responsibilities','change_directions')),
  content     TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE (base_id, section_key)
);

CREATE TABLE flip_list (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id    UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_flip_list_base ON flip_list(base_id);

CREATE TABLE flip_references (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id      UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  file_type    TEXT NOT NULL CHECK (file_type IN ('pdf','docx','pptx','xlsx','other')),
  storage_path TEXT NOT NULL,
  uploaded_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_flip_references_base ON flip_references(base_id);

CREATE TABLE flip_changes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id            UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  flip_title         TEXT NOT NULL,
  notam              TEXT,
  details            TEXT,
  submitted_by_name  TEXT NOT NULL,
  submitted_by_user  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  stage              TEXT NOT NULL DEFAULT 'coordination'
                       CHECK (stage IN ('coordination','submitted','completed')),
  rejected           BOOLEAN NOT NULL DEFAULT FALSE,
  afm_approved_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  afm_approved_at    TIMESTAMPTZ,
  creation_date      DATE,
  processed_date     DATE,
  published_date     DATE,
  posted_initials    TEXT,
  posted_date        DATE,
  pdf_filename       TEXT,
  pdf_storage_path   TEXT,
  coordinated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_flip_changes_base_stage ON flip_changes(base_id, stage);

CREATE TABLE flip_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id     UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  cycle       TEXT NOT NULL,
  review_date DATE NOT NULL,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_flip_reviews_base ON flip_reviews(base_id);

CREATE TABLE flip_review_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id         UUID NOT NULL REFERENCES flip_reviews(id) ON DELETE CASCADE,
  base_id           UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  flip_title        TEXT NOT NULL,
  effective_date    DATE,
  discrepancy       BOOLEAN NOT NULL DEFAULT FALSE,
  discrepancy_note  TEXT,
  corrective_action TEXT,
  date_corrected    DATE,
  sort_order        INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_flip_review_items_review ON flip_review_items(review_id);

CREATE TABLE flip_review_signoffs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id           UUID NOT NULL UNIQUE REFERENCES flip_reviews(id) ON DELETE CASCADE,
  base_id             UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  custodian_signed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  custodian_signed_at TIMESTAMPTZ,
  namo_signed_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  namo_signed_at      TIMESTAMPTZ,
  afm_signed_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  afm_signed_at       TIMESTAMPTZ
);

CREATE TABLE flip_role_assignments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id    UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('custodian','alternate','namo','afm')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_id, user_id, role)
);
CREATE INDEX idx_flip_roles_base_user ON flip_role_assignments(base_id, user_id);

ALTER TABLE flip_text_sections     ENABLE ROW LEVEL SECURITY;
ALTER TABLE flip_list              ENABLE ROW LEVEL SECURITY;
ALTER TABLE flip_references        ENABLE ROW LEVEL SECURITY;
ALTER TABLE flip_changes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE flip_reviews           ENABLE ROW LEVEL SECURITY;
ALTER TABLE flip_review_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE flip_review_signoffs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE flip_role_assignments  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['flip_text_sections','flip_list','flip_references',
                           'flip_changes','flip_reviews','flip_review_items']
  LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s_select" ON %1$s FOR SELECT TO authenticated
        USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:view'));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s_insert" ON %1$s FOR INSERT TO authenticated
        WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:write'));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s_update" ON %1$s FOR UPDATE TO authenticated
        USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:write'));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s_delete" ON %1$s FOR DELETE TO authenticated
        USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:write'));
    $f$, t);
  END LOOP;
END $$;

CREATE POLICY "flip_review_signoffs_select" ON flip_review_signoffs FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:view'));

CREATE POLICY "flip_roles_select" ON flip_role_assignments FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:view'));
CREATE POLICY "flip_roles_write" ON flip_role_assignments FOR ALL TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:manage'))
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'flip:manage'));
