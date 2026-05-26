-- ============================================================
-- Phase 3d — Field Conditions / TALPA module
--
-- Civilian Part 139 airports issue Field Condition Reports (FCRs)
-- per AC 150/5200-30D any time runway surface conditions degrade
-- (wet, frost, snow, slush, ice, anti-/de-iced surfaces, etc.).
-- Each report assesses the runway by thirds (touchdown / midpoint /
-- rollout), categorizes the contaminant, depth, and coverage per
-- third, derives a Runway Condition Code (RwyCC) from 6 (dry) down
-- to 0 (nil) per the AC 30D matrix, and generates the FICON NOTAM
-- text the operator copies into the FAA NOTAM Manager web tool.
--
-- Reports are append-only with a supersede_by_id chain — UPDATE is
-- never used to revise an issued report; the operator issues a new
-- report and the prior row's superseded_by_id is back-filled. This
-- preserves audit history (an FAA inspector can reconstruct the
-- exact reporting sequence over a snow event).
--
-- Regulatory anchors:
--   - 14 CFR §139.313  — Snow and Ice Control
--   - AC 150/5200-30D  — Airport Field Condition Assessments and
--                         Winter Operations Safety (TALPA / FICON /
--                         RwyCC matrix)
-- ============================================================

-- ── 1. field_condition_reports ──────────────────────────────
CREATE TABLE IF NOT EXISTS field_condition_reports (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id                     UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  runway_id                   UUID NOT NULL REFERENCES base_runways(id) ON DELETE CASCADE,
  generated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by                UUID REFERENCES profiles(id) ON DELETE SET NULL,
  generated_by_oi             TEXT,                                       -- operating initials for attribution
  valid_until                 TIMESTAMPTZ NOT NULL,                       -- §AC 30D §7 — operator-set validity
  temperature_f               NUMERIC,                                    -- ambient at report time
  treatments                  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],    -- 'plowed' / 'swept' / 'sanded' / etc.
  conditions_unchanged_since  UUID REFERENCES field_condition_reports(id),-- carry-forward when nothing changed
  superseded_by_id            UUID REFERENCES field_condition_reports(id) ON DELETE SET NULL,
  notes                       TEXT,
  ficon_text                  TEXT NOT NULL,                              -- materialized at insert (FAA NM paste target)
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial index for the active-report lookup (one per runway).
CREATE INDEX IF NOT EXISTS idx_fcr_base_runway_active
  ON field_condition_reports (base_id, runway_id)
  WHERE superseded_by_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_fcr_base_generated_at
  ON field_condition_reports (base_id, generated_at DESC);

COMMENT ON TABLE  field_condition_reports IS 'TALPA Field Condition Report per AC 150/5200-30D. Append-only with superseded_by_id chain.';
COMMENT ON COLUMN field_condition_reports.ficon_text IS 'Materialized FICON NOTAM body at insert time. Operator pastes verbatim into FAA NOTAM Manager.';
COMMENT ON COLUMN field_condition_reports.valid_until IS 'Per AC 30D §7, FCRs carry an operator-set validity window. Expired reports remain visible in history; the operator manually issues a new one when conditions change.';

-- ── 2. field_condition_thirds (per-third assessment) ────────
CREATE TABLE IF NOT EXISTS field_condition_thirds (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id              UUID NOT NULL REFERENCES field_condition_reports(id) ON DELETE CASCADE,
  third                  TEXT NOT NULL CHECK (third IN ('touchdown', 'midpoint', 'rollout')),
  contaminant            TEXT NOT NULL CHECK (contaminant IN (
                           'dry', 'wet', 'frost', 'slush', 'dry_snow', 'wet_snow',
                           'compacted_snow', 'ice', 'ice_patches', 'wet_ice',
                           'slippery_when_wet', 'water_on_compacted_snow', 'slush_on_ice'
                         )),
  depth_in               NUMERIC,                                        -- inches; required for snow/slush/water
  coverage_percent       INT CHECK (coverage_percent BETWEEN 0 AND 100),
  rwycc                  INT NOT NULL CHECK (rwycc BETWEEN 0 AND 6),
  rwycc_derived          INT NOT NULL CHECK (rwycc_derived BETWEEN 0 AND 6), -- engine-computed at save time
  rwycc_manual_override  BOOLEAN NOT NULL DEFAULT FALSE,
  override_reason        TEXT,                                            -- required when rwycc != rwycc_derived (UI-enforced)
  sort_order             INT NOT NULL,                                    -- 0=touchdown, 1=midpoint, 2=rollout
  UNIQUE (report_id, third)
);
CREATE INDEX IF NOT EXISTS idx_fcr_thirds_report ON field_condition_thirds (report_id);

COMMENT ON TABLE  field_condition_thirds IS 'Per-third RwyCC assessment per AC 150/5200-30D Table 4-1. Three rows per report (TD / MID / RO).';

-- ── 3. Permission keys + role grants ────────────────────────
INSERT INTO permissions (key, label, category, description, applies_to) VALUES
  ('field_conditions:read',
   'View Field Condition Reports',
   'field_conditions',
   'See current and historical RwyCC reports for each runway.',
   '{faa_part139}'),
  ('field_conditions:write',
   'Issue Field Condition Reports',
   'field_conditions',
   'Create and supersede field condition reports + generate FICON text.',
   '{faa_part139}')
ON CONFLICT (key) DO UPDATE SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  description = COALESCE(EXCLUDED.description, permissions.description),
  applies_to = EXCLUDED.applies_to;

-- Role grants. Walkthrough rationale:
--   accountable_executive — read only (oversight; operator role does the assessment)
--   ops_supervisor / arff_chief / amops — full CRUD (the people standing on the runway)
--   sms_manager — read (FCR feeds future hazard correlation)
--   airfield_manager / base_admin / sys_admin — full CRUD
INSERT INTO role_permissions (role, permission_key) VALUES
  ('accountable_executive', 'field_conditions:read'),
  ('ops_supervisor',        'field_conditions:read'),
  ('ops_supervisor',        'field_conditions:write'),
  ('arff_chief',            'field_conditions:read'),
  ('arff_chief',            'field_conditions:write'),
  ('amops',                 'field_conditions:read'),
  ('amops',                 'field_conditions:write'),
  ('sms_manager',           'field_conditions:read'),
  ('airfield_manager',      'field_conditions:read'),
  ('airfield_manager',      'field_conditions:write'),
  ('base_admin',            'field_conditions:read'),
  ('base_admin',            'field_conditions:write'),
  ('sys_admin',             'field_conditions:read'),
  ('sys_admin',             'field_conditions:write')
ON CONFLICT (role, permission_key) DO NOTHING;

-- ── 4. RLS — matrix-helper policies ─────────────────────────
-- Pattern mirrors 2026053003_training_part139_rls.sql. Use only the
-- matrix helpers (user_has_permission + user_has_base_access) — never
-- the dropped user_can_write family.

ALTER TABLE field_condition_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fcr_select" ON field_condition_reports;
CREATE POLICY "fcr_select" ON field_condition_reports
  FOR SELECT TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'field_conditions:read'));

DROP POLICY IF EXISTS "fcr_insert" ON field_condition_reports;
CREATE POLICY "fcr_insert" ON field_condition_reports
  FOR INSERT TO authenticated
  WITH CHECK (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'field_conditions:write'));

DROP POLICY IF EXISTS "fcr_update" ON field_condition_reports;
CREATE POLICY "fcr_update" ON field_condition_reports
  FOR UPDATE TO authenticated
  USING (user_has_base_access(auth.uid(), base_id) AND user_has_permission(auth.uid(), 'field_conditions:write'));

-- No DELETE policy — reports are append-only via the supersede chain.

-- Child rows: parent-gate via EXISTS (mirrors aep_comms_check_results pattern)
ALTER TABLE field_condition_thirds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fcr_thirds_select" ON field_condition_thirds;
CREATE POLICY "fcr_thirds_select" ON field_condition_thirds
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM field_condition_reports r
       WHERE r.id = field_condition_thirds.report_id
         AND user_has_base_access(auth.uid(), r.base_id)
         AND user_has_permission(auth.uid(), 'field_conditions:read')
    )
  );

DROP POLICY IF EXISTS "fcr_thirds_insert" ON field_condition_thirds;
CREATE POLICY "fcr_thirds_insert" ON field_condition_thirds
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM field_condition_reports r
       WHERE r.id = field_condition_thirds.report_id
         AND user_has_base_access(auth.uid(), r.base_id)
         AND user_has_permission(auth.uid(), 'field_conditions:write')
    )
  );

-- No UPDATE / DELETE on thirds — they're set at report insert time and
-- corrected via a new (superseding) report.
