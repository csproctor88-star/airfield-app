-- ============================================================
-- Modifications & Exemptions — Migration 2/4: tables + RLS
--
-- Spec: docs/superpowers/specs/2026-07-18-modifications-exemptions-design.md
--       (§Data model) — APPROVED 2026-07-18 with §139.113 deviations
--       included as the third record_type (owner ruling, open question 1).
--
-- mods_exemptions — one row per Modification of Standards request
-- (FAA Order 5300.1G), Part 139 exemption petition (§139.111 / 14 CFR
-- Part 11), or §139.113 emergency deviation. FAA's MOS system of record
-- is the Airports GIS MOS Tool (5300.1G ¶12.a) — these rows are the
-- airport's own tracking record.
--
-- mods_exemption_reviews — insert-only audit of the 5280.5D §2.12.2
-- annual currency reviews ("Justification Still Valid" on Form 5280-4).
-- Immutable: no UPDATE/DELETE policies.
--
-- mods_exemption_attachments — metadata rows for the private
-- 'mods-exemptions' storage bucket (migration 3/4).
--
-- Status vocabulary (CHECK below): the petition track uses
-- draft → submitted → under_review → approved | partially_granted |
-- denied | withdrawn (partially_granted is exemption-only, and the
-- deviation-only values are notification_pending → notified → closed —
-- both enforced in lib/mods-exemptions/constants.ts + UI, not in SQL,
-- to keep the constraint one-dimensional). "Expired" is a COMPUTED
-- display state from expiration_date, never stored.
--
-- RLS uses ONLY user_has_base_access() + user_has_permission() — never
-- the helpers dropped in 2026042208.
--
-- Apply order: 2026071801 (permissions) first, then this file, then
-- 2026071803 (storage), then 2026071804 (enable module).
--
-- Post-apply verification:
--   SELECT tablename, rowsecurity FROM pg_tables WHERE tablename LIKE 'mods_exemption%';
--   -- expect rowsecurity = true for all three tables
--   SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename LIKE 'mods_exemption%' ORDER BY tablename, cmd;
--   -- expect 4 policies on mods_exemptions (select/insert/update/delete)
--   -- expect 2 on mods_exemption_reviews (select/insert ONLY — immutable)
--   -- expect 4 on mods_exemption_attachments
-- ============================================================

CREATE TABLE mods_exemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL CHECK (record_type IN ('mos', 'exemption', 'deviation')),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'under_review', 'approved', 'partially_granted',
    'denied', 'withdrawn', 'notification_pending', 'notified', 'closed'
  )),
  -- The exact standard the record deviates from: an AC 150/5300-13B design
  -- standard for a MOS, a 14 CFR section for an exemption, the Subpart D /
  -- ACM requirement for a deviation.
  standard_reference TEXT NOT NULL,
  baseline_summary TEXT,
  relief_summary TEXT,
  justification TEXT,
  public_interest TEXT,        -- §11.81(d), exemption petitions
  safety_justification TEXT,   -- §11.81(e) / 5300.1G acceptable level of safety
  mos_category TEXT,           -- Order 5300.1G Appendix A taxonomy (MOS only)
  mos_subcategory TEXT,
  approval_authority TEXT CHECK (approval_authority IN ('ado', 'regional', 'headquarters')),
  agis_tracking TEXT,          -- AGIS MOS id / NRA airspace case number
  docket_number TEXT,          -- exemption; arrives with the FAA letter (§11.91)
  arff_small_airport BOOLEAN NOT NULL DEFAULT FALSE, -- §139.111(b) petition path
  date_submitted DATE,
  date_decided DATE,
  effective_date DATE,
  expiration_date DATE,        -- from the decision letter (design MOS ≤5 yr per ¶8.f)
  decision_summary TEXT,
  decision_conditions TEXT,    -- ¶9 approval-letter conditions
  last_reviewed_date DATE,
  next_review_due DATE,        -- annual cadence per 5280.5D §2.12.2
  deviation_date DATE,         -- §139.113 emergency date (deviation only)
  notified_date DATE,          -- RADM notification date (14-day duty)
  written_notice_requested BOOLEAN NOT NULL DEFAULT FALSE,
  written_notice_provided BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mods_exemptions_base_type_idx ON mods_exemptions(base_id, record_type, status);
CREATE INDEX mods_exemptions_base_created_idx ON mods_exemptions(base_id, created_at DESC);

CREATE TABLE mods_exemption_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  record_id UUID NOT NULL REFERENCES mods_exemptions(id) ON DELETE CASCADE,
  review_date DATE NOT NULL,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  justification_still_valid BOOLEAN NOT NULL,
  recommendation TEXT CHECK (recommendation IN ('retain', 'resubmit', 'terminate')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mods_exemption_reviews_record_idx ON mods_exemption_reviews(record_id, review_date DESC);
CREATE INDEX mods_exemption_reviews_base_idx ON mods_exemption_reviews(base_id);

CREATE TABLE mods_exemption_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  record_id UUID NOT NULL REFERENCES mods_exemptions(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT,
  kind TEXT NOT NULL DEFAULT 'other' CHECK (kind IN (
    'petition', 'decision_letter', 'srm', 'airspace_review', 'correspondence', 'other'
  )),
  caption TEXT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mods_exemption_attachments_record_idx ON mods_exemption_attachments(record_id, created_at DESC);
CREATE INDEX mods_exemption_attachments_base_idx ON mods_exemption_attachments(base_id);

ALTER TABLE mods_exemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mods_exemption_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE mods_exemption_attachments ENABLE ROW LEVEL SECURITY;

-- mods_exemptions: read with view, mutate with write.
CREATE POLICY "mods_exemptions_select" ON mods_exemptions
  FOR SELECT TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'mods_exemptions:view')
  );

CREATE POLICY "mods_exemptions_insert" ON mods_exemptions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'mods_exemptions:write')
  );

CREATE POLICY "mods_exemptions_update" ON mods_exemptions
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'mods_exemptions:write')
  )
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'mods_exemptions:write')
  );

CREATE POLICY "mods_exemptions_delete" ON mods_exemptions
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'mods_exemptions:write')
  );

-- Reviews: official record actions, so INSERT requires :write (unlike
-- local_regulation_reviews, where any viewer attests their own reading).
-- base_id pinned to the parent record's base so a multi-base user can't
-- tag a review with the wrong base_id (the 2026071731 hardening). The
-- subselect runs under the inserter's RLS — a record they can't see
-- yields NULL and the equality fails.
CREATE POLICY "mods_exemption_reviews_select" ON mods_exemption_reviews
  FOR SELECT TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'mods_exemptions:view')
  );

CREATE POLICY "mods_exemption_reviews_insert" ON mods_exemption_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'mods_exemptions:write')
    AND base_id = (SELECT base_id FROM mods_exemptions WHERE id = record_id)
  );
-- No UPDATE/DELETE policies — reviews are immutable (CASCADE on record delete).

-- Attachments: metadata rows follow the record's write permission; same
-- base pin as reviews.
CREATE POLICY "mods_exemption_attachments_select" ON mods_exemption_attachments
  FOR SELECT TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'mods_exemptions:view')
  );

CREATE POLICY "mods_exemption_attachments_insert" ON mods_exemption_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'mods_exemptions:write')
    AND base_id = (SELECT base_id FROM mods_exemptions WHERE id = record_id)
  );

CREATE POLICY "mods_exemption_attachments_update" ON mods_exemption_attachments
  FOR UPDATE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'mods_exemptions:write')
  )
  WITH CHECK (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'mods_exemptions:write')
  );

CREATE POLICY "mods_exemption_attachments_delete" ON mods_exemption_attachments
  FOR DELETE TO authenticated
  USING (
    user_has_base_access(auth.uid(), base_id)
    AND user_has_permission(auth.uid(), 'mods_exemptions:write')
  );
