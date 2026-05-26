-- ============================================================
-- Phase 3b step 1 — Airport Emergency Plan: plan document table
--
-- AEP plans per 14 CFR §139.325. One active plan at a time per base
-- (active = replaced_by_id IS NULL); superseded versions retained for
-- the audit trail. The plan itself is uploaded as a PDF artifact
-- (lives under aep-plans/<base>/<plan>/... in the photos bucket); we
-- track its version, FAA acceptance, AE sign-off, and annual review.
--
-- §139.325(a-c)  → plan content + FAA approval (version, effective_date,
--                  approved_by_faa_at, faa_acceptance_ref, document_url)
-- §139.325(d)    → annual review by airport operator (last_reviewed_at,
--                  reviewed_by_user_id, review_notes)
-- ============================================================

CREATE TABLE IF NOT EXISTS aep_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id               UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  version               TEXT NOT NULL,                         -- e.g. '2026.1' or 'v3'
  effective_date        DATE NOT NULL,
  document_url          TEXT,                                  -- public URL of uploaded PDF
  storage_path          TEXT,                                  -- path within photos bucket (kept for delete-on-supersede)
  approved_by_faa_at    DATE,                                  -- §139.325(c) FAA acceptance date
  faa_acceptance_ref    TEXT,                                  -- letter / email reference
  ae_user_id            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ae_signed_at          TIMESTAMPTZ,                           -- initial AE sign-off
  last_reviewed_at      TIMESTAMPTZ,                           -- §139.325(d) annual review timestamp
  reviewed_by_user_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  review_notes          TEXT,
  replaced_by_id        UUID REFERENCES aep_plans(id) ON DELETE SET NULL,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (base_id, version)
);

CREATE INDEX IF NOT EXISTS idx_aep_plans_base_active
  ON aep_plans (base_id) WHERE replaced_by_id IS NULL;

COMMENT ON TABLE  aep_plans IS 'Airport Emergency Plan per 14 CFR §139.325. Versioned; active = replaced_by_id IS NULL.';
COMMENT ON COLUMN aep_plans.last_reviewed_at IS '§139.325(d) annual review timestamp. UI surfaces a chip when NOW() - last_reviewed_at > 12 months.';
COMMENT ON COLUMN aep_plans.storage_path IS 'Path within photos bucket: aep-plans/<base_id>/<plan_id>/plan-<ts>.<ext>. Kept so supersede can delete the artifact.';
