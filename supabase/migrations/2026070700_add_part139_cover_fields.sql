-- Part 139 certification-inspection audit: Form 5280-4 cover-field metadata.
--
-- The civilian /acsi module (annual Part 139 cert-inspection readiness audit)
-- reproduces FAA Form 5280-4, whose header carries three fields with no existing
-- home on acsi_inspections: the airport's current ARFF Index, its Airport
-- Classification (Class I-IV), and the named Inspector of record. These are
-- distinct from the filer-identity columns already present (inspector_name /
-- inspector_id / completed_by_name).
--
-- Additive + nullable (expand phase): USAF ACSI records leave all three NULL and
-- are unaffected; no live code reads these yet. RLS is unchanged — the columns
-- inherit the existing base-scoped table policies.
ALTER TABLE public.acsi_inspections
  ADD COLUMN IF NOT EXISTS arff_index    TEXT,
  ADD COLUMN IF NOT EXISTS airport_class TEXT,
  ADD COLUMN IF NOT EXISTS inspector     TEXT;
