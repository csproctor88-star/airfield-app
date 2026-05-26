-- ============================================================
-- Phase 3e — Wildlife Hazard Management Plan (WHMP) module
--
-- 14 CFR §139.337 requires Part 139 airports with significant
-- wildlife hazards to maintain a written Wildlife Hazard Management
-- Plan, FAA-accepted, reviewed and updated annually by the airport
-- operator. AC 150/5200-33C (Hazardous Wildlife Attractants) and
-- AC 150/5200-32B (Strike Reporting) are the implementing guidance.
--
-- Schema: one row per (base, assessment_year). In-year revisions
-- (e.g. amended after a damaging strike) supersede via replaced_by_id
-- — same pattern as aep_plans / sms_policies. Each row carries:
--
--   - Hazardous species register (JSONB array — species, hazard level,
--     attractants, mitigations)
--   - Findings (JSONB array — narrative, category, recommended action,
--     optional sms_hazard_id back-fill when promoted to SMS register)
--   - AE annual sign-off (ae_signed_at + last_reviewed_at trio,
--     mirrors aep_plans pattern)
--   - FAA acceptance metadata (faa_accepted_at, faa_acceptance_ref)
--
-- Permission keys: reuses existing wildlife:read / wildlife:write
-- (WHMP is a wildlife sub-feature; the same role that owns sightings
-- and strikes owns the annual assessment). No new keys.
--
-- Civilian Part 139 only via module-config appliesTo: ['faa_part139'].
-- USAF bases that flip the gate later can use this module too — the
-- table itself is mode-agnostic.
-- ============================================================

CREATE TABLE IF NOT EXISTS wildlife_hazard_assessments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id                  UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  assessment_year          INT NOT NULL CHECK (assessment_year BETWEEN 2000 AND 2100),
  performed_by_user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  performed_by_external    TEXT,                                       -- e.g. 'USDA Wildlife Services'
  performed_at             DATE NOT NULL,                              -- field assessment date
  report_url               TEXT,                                       -- public URL of uploaded PDF
  storage_path             TEXT,                                       -- path within photos bucket
  faa_accepted_at          DATE,                                       -- §139.337(b) FAA acceptance
  faa_acceptance_ref       TEXT,                                       -- letter / email reference
  ae_user_id               UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ae_signed_at             TIMESTAMPTZ,                                -- initial AE sign-off
  last_reviewed_at         TIMESTAMPTZ,                                -- §139.337(c) annual review timestamp
  reviewed_by_user_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  review_notes             TEXT,
  hazardous_species        JSONB NOT NULL DEFAULT '[]'::jsonb,         -- [{id, species, hazard_level, attractants[], mitigations[]}]
  mitigation_summary       TEXT,                                       -- free-text overview
  findings                 JSONB NOT NULL DEFAULT '[]'::jsonb,         -- [{id, finding, category, recommended_action, sms_hazard_id?}]
  notes                    TEXT,
  replaced_by_id           UUID REFERENCES wildlife_hazard_assessments(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by               UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (base_id, assessment_year)
);

-- Partial index for the active-assessment lookup. Only one active row
-- per (base, year) — UNIQUE on (base, year) blocks duplicates; this
-- index optimizes "give me the active row" queries.
CREATE INDEX IF NOT EXISTS idx_whmp_base_active
  ON wildlife_hazard_assessments (base_id, assessment_year DESC)
  WHERE replaced_by_id IS NULL;

COMMENT ON TABLE  wildlife_hazard_assessments IS 'Annual Wildlife Hazard Management Plan per 14 CFR §139.337. One row per (base, assessment_year). In-year revisions supersede via replaced_by_id.';
COMMENT ON COLUMN wildlife_hazard_assessments.hazardous_species IS 'JSONB array: [{id, species, hazard_level, attractants[], mitigations[]}]. Editable in the assessment modal; surfaced on the active card.';
COMMENT ON COLUMN wildlife_hazard_assessments.findings IS 'JSONB array: [{id, finding, category, recommended_action, sms_hazard_id?}]. Each finding can deep-link to /sms/hazards/new to file a related SMS hazard.';

-- ── RLS — matrix-helper policies ────────────────────────────
-- Pattern mirrors 2026053003_training_part139_rls.sql and
-- 2026060900_field_conditions.sql. Reuses existing wildlife:* keys
-- since WHMP is a wildlife sub-feature.

ALTER TABLE wildlife_hazard_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whmp_select" ON wildlife_hazard_assessments;
CREATE POLICY "whmp_select" ON wildlife_hazard_assessments
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'wildlife:read'));

DROP POLICY IF EXISTS "whmp_insert" ON wildlife_hazard_assessments;
CREATE POLICY "whmp_insert" ON wildlife_hazard_assessments
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'wildlife:write'));

DROP POLICY IF EXISTS "whmp_update" ON wildlife_hazard_assessments;
CREATE POLICY "whmp_update" ON wildlife_hazard_assessments
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'wildlife:write'));

-- No DELETE policy — supersede via replaced_by_id chain.

-- ── Storage RLS for whmp/* upload prefix ───────────────────────
-- Separate INSERT policy gated on wildlife:write. Mirrors
-- 2026060705_aep_storage_rls.sql (path-scoped, base_id from segment 2).

DROP POLICY IF EXISTS "whmp_storage_insert" ON storage.objects;
CREATE POLICY "whmp_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'photos'
    AND name LIKE 'whmp/%'
    AND public.user_has_permission(auth.uid(), 'wildlife:write')
    AND public.user_has_base_access(
      auth.uid(),
      NULLIF(split_part(name, '/', 2), '')::uuid
    )
  );
