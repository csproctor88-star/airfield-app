-- ============================================================
-- QRC Monthly Per-User Review
--
-- Tracks per-operator monthly review completion for each QRC
-- template. The existing template-level annual review on
-- qrc_templates.last_reviewed_at (NAMO/AFM cadence) stays
-- untouched. This new table holds the AMOPS monthly cadence:
-- one row per Mark-as-Reviewed event so we have a real audit
-- trail and can roll up cross-user compliance for the consolidated
-- PDF report on /qrc Reviews tab.
--
-- Snapshot column (template_updated_at_at_review) freezes the
-- template's updated_at value at the time of review so the
-- "Updated since your last review" amber banner can compare
-- without joining to the live template (and so post-hoc analysis
-- can prove which version each operator reviewed).
--
-- Reviews are immutable — no UPDATE/DELETE policies (matches the
-- activity_log pattern). Re-reviewing inserts a fresh row.
-- ============================================================

CREATE TABLE qrc_monthly_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES qrc_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  template_updated_at_at_review TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX qrc_monthly_reviews_lookup_idx
  ON qrc_monthly_reviews(base_id, user_id, template_id, reviewed_at DESC);

CREATE INDEX qrc_monthly_reviews_base_reviewed_at_idx
  ON qrc_monthly_reviews(base_id, reviewed_at DESC);

ALTER TABLE qrc_monthly_reviews ENABLE ROW LEVEL SECURITY;

-- Read: anyone with base access. Operational compliance is shift-visible
-- (peer review state appears on the consolidated PDF; same trust model
-- as the AF Form 3616 Events Log).
CREATE POLICY "qrc_monthly_reviews_select" ON qrc_monthly_reviews
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id));

-- Insert: only your own row at a base you have access to, and only if
-- you can execute QRCs (qrc:execute is the operational permission held
-- by airfield_manager / namo / amops — the same roles required to
-- review monthly).
CREATE POLICY "qrc_monthly_reviews_insert" ON qrc_monthly_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_id = auth.uid()
    AND user_has_permission(auth.uid(), 'qrc:execute')
  );

-- No UPDATE / DELETE policies — reviews are immutable.
