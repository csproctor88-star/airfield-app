-- ============================================================
-- Phase 2 step 1 — SMS module schema
--
-- 10 tables implementing the four AC 150/5200-37A pillars:
--
--   Safety Policy          → sms_policies
--   Safety Risk Mgmt (SRM) → sms_hazards
--                            sms_risk_assessments  (5×5 matrix)
--                            sms_mitigations
--   Safety Assurance (SA)  → sms_spis
--                            sms_spi_measurements
--                            sms_audits
--                            sms_management_of_change
--   Safety Promotion       → sms_safety_reports
--                            sms_communications
--
-- Civilian-mode (`bases.airport_type = 'faa_part139'`) only.
-- USAF bases never see this module — gated at lib/modules-config.ts
-- via `appliesTo: ['faa_part139']`. The tables themselves don't
-- enforce mode (so a USAF base could theoretically have rows if
-- a future flag flip allowed it) — keeps the data model neutral.
--
-- All operational tables include base_id with FK + ON DELETE
-- CASCADE so removing a base cleans up its SMS data. RLS lands
-- in 2026052701; the matrix helpers `user_has_base_access` +
-- `user_has_permission` gate every policy.
--
-- Risk banding (AC 150/5200-37A figure 6-3 simplified):
--   risk_index = likelihood × severity, range 1-25
--   high:   risk_index ≥ 15
--   medium: risk_index 7-14
--   low:    risk_index ≤ 6
-- Stored as a generated column so the band drops out of any
-- residual recalc without a trigger round-trip.
-- ============================================================

-- ── Helper: risk band classifier ─────────────────────────────
-- IMMUTABLE so it can drive a GENERATED column. Plain CASE — no
-- table reads, no time-dependent functions.
CREATE OR REPLACE FUNCTION public._sms_risk_band(p_index INT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_index IS NULL THEN NULL
    WHEN p_index >= 15 THEN 'high'
    WHEN p_index >= 7  THEN 'medium'
    ELSE 'low'
  END
$$;

-- ── sms_policies ─────────────────────────────────────────────
-- One active policy per base; older versions retained for audit.
-- AE sign-off is required before status = 'active'. The
-- safety_objectives JSONB holds the per-policy objectives array
-- so the schema doesn't churn each time a base reshapes its
-- objective taxonomy.
CREATE TABLE IF NOT EXISTS sms_policies (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id                       UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  version                       INT  NOT NULL DEFAULT 1,
  status                        TEXT NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','active','superseded','retired')),
  effective_date                DATE,
  review_due_date               DATE,
  document_url                  TEXT,
  safety_objectives             JSONB NOT NULL DEFAULT '[]'::jsonb,
  employee_reporting_pledge     TEXT,
  -- AE signature trio
  accountable_executive_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  signed_at                     TIMESTAMPTZ,
  signature_image_url           TEXT,
  -- Versioning links
  replaced_by_id                UUID REFERENCES sms_policies(id) ON DELETE SET NULL,
  -- Audit
  created_by                    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by                    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_policies_base ON sms_policies(base_id);
CREATE INDEX IF NOT EXISTS idx_sms_policies_status ON sms_policies(base_id, status);
-- Enforce at most one 'active' policy per base. Multiple drafts /
-- superseded versions are allowed.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sms_policies_active_per_base
  ON sms_policies(base_id) WHERE status = 'active';

ALTER TABLE sms_policies ENABLE ROW LEVEL SECURITY;

-- ── sms_hazards ──────────────────────────────────────────────
-- The hazard register. Each row is a unique hazard the base has
-- identified; risk assessments + mitigations attach via FK.
--
-- source_type lets a hazard be auto-spawned from another module
-- (discrepancy promotion, wildlife strike, safety report triage,
-- audit finding, MOC analysis). source_ref_id links back without
-- enforcing FK across tables — keeps the model flexible.
--
-- hazard_code is a per-base sequential identifier (HZ-001, HZ-002,
-- ...) minted server-side via _sms_generate_hazard_code() to
-- serialize concurrent inserts.
CREATE TABLE IF NOT EXISTS sms_hazards (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id             UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  hazard_code         TEXT NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  source_type         TEXT NOT NULL DEFAULT 'manual'
                      CHECK (source_type IN (
                        'manual','discrepancy','inspection','wildlife_strike',
                        'safety_report','audit','moc','reg_review','other'
                      )),
  source_ref_id       UUID,
  -- Lifecycle
  status              TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','under_review','controlled','closed','duplicate')),
  closed_at           TIMESTAMPTZ,
  closed_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closure_rationale   TEXT,
  -- Ownership
  risk_owner_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  identified_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  identified_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Cached "latest assessment" pointers — populated by trigger when a
  -- risk assessment row is inserted/updated. Speeds the register
  -- listing query (no per-row aggregate scan).
  latest_assessment_id UUID,
  current_band        TEXT,
  residual_band       TEXT,
  -- Audit
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_id, hazard_code)
);

CREATE INDEX IF NOT EXISTS idx_sms_hazards_base          ON sms_hazards(base_id);
CREATE INDEX IF NOT EXISTS idx_sms_hazards_status        ON sms_hazards(base_id, status);
CREATE INDEX IF NOT EXISTS idx_sms_hazards_source        ON sms_hazards(source_type, source_ref_id);
CREATE INDEX IF NOT EXISTS idx_sms_hazards_current_band  ON sms_hazards(base_id, current_band);

ALTER TABLE sms_hazards ENABLE ROW LEVEL SECURITY;

-- ── sms_risk_assessments ─────────────────────────────────────
-- 5×5 matrix per AC 150/5200-37A. Each row captures one
-- assessment snapshot — current (initial / inherent) + residual
-- (after planned mitigations). Multiple rows per hazard preserve
-- the assessment history.
--
-- risk_index + risk_band are generated columns so the band drops
-- out automatically on insert / update / residual recalc.
CREATE TABLE IF NOT EXISTS sms_risk_assessments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hazard_id              UUID NOT NULL REFERENCES sms_hazards(id) ON DELETE CASCADE,
  base_id                UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  assessed_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  assessed_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Current (inherent) risk
  likelihood             INT NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
  severity               INT NOT NULL CHECK (severity   BETWEEN 1 AND 5),
  risk_index             INT GENERATED ALWAYS AS (likelihood * severity) STORED,
  risk_band              TEXT GENERATED ALWAYS AS (public._sms_risk_band(likelihood * severity)) STORED,
  -- Residual (post-mitigation) risk — optional
  residual_likelihood    INT CHECK (residual_likelihood BETWEEN 1 AND 5),
  residual_severity      INT CHECK (residual_severity   BETWEEN 1 AND 5),
  residual_risk_index    INT GENERATED ALWAYS AS (
                            COALESCE(residual_likelihood, 0) * COALESCE(residual_severity, 0)
                         ) STORED,
  residual_risk_band     TEXT GENERATED ALWAYS AS (
                            public._sms_risk_band(
                              COALESCE(residual_likelihood, 0) * COALESCE(residual_severity, 0)
                            )
                         ) STORED,
  -- Rationale + notes
  likelihood_rationale   TEXT,
  severity_rationale     TEXT,
  notes                  TEXT,
  -- Audit
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_risk_hazard ON sms_risk_assessments(hazard_id, assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_risk_base   ON sms_risk_assessments(base_id);

ALTER TABLE sms_risk_assessments ENABLE ROW LEVEL SECURITY;

-- Cache-keeping trigger: on assessment write, update the parent
-- hazard's latest_assessment_id + current_band + residual_band so
-- the register list view doesn't need to aggregate.
CREATE OR REPLACE FUNCTION public._sms_refresh_hazard_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_latest sms_risk_assessments%ROWTYPE;
BEGIN
  SELECT * INTO v_latest
    FROM sms_risk_assessments
   WHERE hazard_id = COALESCE(NEW.hazard_id, OLD.hazard_id)
   ORDER BY assessed_at DESC, created_at DESC
   LIMIT 1;

  UPDATE sms_hazards
     SET latest_assessment_id = v_latest.id,
         current_band         = v_latest.risk_band,
         residual_band        = v_latest.residual_risk_band,
         updated_at           = now()
   WHERE id = COALESCE(NEW.hazard_id, OLD.hazard_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sms_risk_cache_ins ON sms_risk_assessments;
CREATE TRIGGER trg_sms_risk_cache_ins
  AFTER INSERT OR UPDATE OR DELETE ON sms_risk_assessments
  FOR EACH ROW EXECUTE FUNCTION public._sms_refresh_hazard_cache();

-- ── sms_mitigations ──────────────────────────────────────────
-- Per-hazard mitigation actions. Status is the kanban lane on
-- the hazard detail view. evidence_url points to the proof-of-
-- completion artifact (photo / PDF / link).
CREATE TABLE IF NOT EXISTS sms_mitigations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hazard_id       UUID NOT NULL REFERENCES sms_hazards(id) ON DELETE CASCADE,
  base_id         UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  control_type    TEXT NOT NULL DEFAULT 'administrative'
                  CHECK (control_type IN (
                    'elimination','substitution','engineering',
                    'administrative','ppe','training','other'
                  )),
  owner_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date        DATE,
  status          TEXT NOT NULL DEFAULT 'planned'
                  CHECK (status IN ('planned','in_progress','completed','rejected','superseded')),
  completed_at    TIMESTAMPTZ,
  completed_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  evidence_url    TEXT,
  notes           TEXT,
  -- Audit
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_mitigations_hazard ON sms_mitigations(hazard_id);
CREATE INDEX IF NOT EXISTS idx_sms_mitigations_base   ON sms_mitigations(base_id);
CREATE INDEX IF NOT EXISTS idx_sms_mitigations_due    ON sms_mitigations(base_id, due_date) WHERE status IN ('planned','in_progress');

ALTER TABLE sms_mitigations ENABLE ROW LEVEL SECURITY;

-- ── sms_spis (Safety Performance Indicators) ─────────────────
-- One row per indicator definition; sms_spi_measurements holds
-- the time series. Targets + alert levels drive the dashboard
-- card colour. computation_key identifies which built-in metric
-- nightly cron should compute (NULL for manually-tracked SPIs).
CREATE TABLE IF NOT EXISTS sms_spis (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id               UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  code                  TEXT NOT NULL,
  title                 TEXT NOT NULL,
  description           TEXT,
  -- Tracks the AC 150/5200-37A pairing: SPI (lagging) + SPT (target)
  unit                  TEXT NOT NULL DEFAULT 'count',
  target_value          NUMERIC,
  target_direction      TEXT NOT NULL DEFAULT 'lower'
                        CHECK (target_direction IN ('lower','higher')),
  alert_threshold       NUMERIC,
  -- Which built-in cron compute path drives this SPI; NULL = manual entry.
  computation_key       TEXT,
  measurement_frequency TEXT NOT NULL DEFAULT 'monthly'
                        CHECK (measurement_frequency IN ('daily','weekly','monthly','quarterly')),
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  -- Audit
  created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_id, code)
);

CREATE INDEX IF NOT EXISTS idx_sms_spis_base    ON sms_spis(base_id);
CREATE INDEX IF NOT EXISTS idx_sms_spis_compute ON sms_spis(computation_key) WHERE active = TRUE;

ALTER TABLE sms_spis ENABLE ROW LEVEL SECURITY;

-- ── sms_spi_measurements ─────────────────────────────────────
-- Append-only time series. period_start + period_end define the
-- measurement window so the dashboard can render sparklines
-- regardless of cadence. Status is derived from value vs target
-- + alert_threshold and persisted so historical badges stay
-- meaningful even after thresholds change.
CREATE TABLE IF NOT EXISTS sms_spi_measurements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spi_id        UUID NOT NULL REFERENCES sms_spis(id) ON DELETE CASCADE,
  base_id       UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  value         NUMERIC NOT NULL,
  status        TEXT NOT NULL DEFAULT 'on_target'
                CHECK (status IN ('on_target','warning','alert','no_data')),
  computed_by   TEXT NOT NULL DEFAULT 'manual'
                CHECK (computed_by IN ('manual','cron','rpc')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (spi_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_sms_spi_meas_spi  ON sms_spi_measurements(spi_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_sms_spi_meas_base ON sms_spi_measurements(base_id, period_start DESC);

ALTER TABLE sms_spi_measurements ENABLE ROW LEVEL SECURITY;

-- ── sms_audits ───────────────────────────────────────────────
-- Internal SMS audits required by §139.401(d). Each row is one
-- audit cycle with scope + findings_count rolled up; detailed
-- findings live in findings JSONB for now (separate table is
-- overkill at the volume small Class III/IV airports run).
CREATE TABLE IF NOT EXISTS sms_audits (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id             UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  audit_code          TEXT NOT NULL,
  title               TEXT NOT NULL,
  audit_type          TEXT NOT NULL DEFAULT 'internal'
                      CHECK (audit_type IN ('internal','external','self_assessment')),
  scope               TEXT,
  scheduled_date      DATE,
  performed_date      DATE,
  performed_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'scheduled'
                      CHECK (status IN ('scheduled','in_progress','completed','closed','canceled')),
  findings            JSONB NOT NULL DEFAULT '[]'::jsonb,
  findings_open       INT NOT NULL DEFAULT 0,
  findings_closed     INT NOT NULL DEFAULT 0,
  report_url          TEXT,
  notes               TEXT,
  -- Audit
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_id, audit_code)
);

CREATE INDEX IF NOT EXISTS idx_sms_audits_base   ON sms_audits(base_id);
CREATE INDEX IF NOT EXISTS idx_sms_audits_sched  ON sms_audits(base_id, scheduled_date);

ALTER TABLE sms_audits ENABLE ROW LEVEL SECURITY;

-- ── sms_management_of_change ─────────────────────────────────
-- §139.401(e). Any operational change with safety implication
-- routes through here. AE approval is gated by sms:approve_moc.
CREATE TABLE IF NOT EXISTS sms_management_of_change (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id                  UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  moc_code                 TEXT NOT NULL,
  title                    TEXT NOT NULL,
  change_description       TEXT NOT NULL,
  change_category          TEXT NOT NULL DEFAULT 'operational'
                           CHECK (change_category IN (
                             'operational','organizational','equipment',
                             'procedural','regulatory','facility','other'
                           )),
  triggered_by             TEXT,
  proposed_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  proposed_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_date           DATE,
  status                   TEXT NOT NULL DEFAULT 'proposed'
                           CHECK (status IN (
                             'proposed','risk_analysis','pending_approval',
                             'approved','rejected','implemented','closed'
                           )),
  -- Linked risk + mitigations
  linked_hazard_id         UUID REFERENCES sms_hazards(id) ON DELETE SET NULL,
  risk_analysis_summary    TEXT,
  -- AE approval trio
  approved_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at              TIMESTAMPTZ,
  approval_notes           TEXT,
  rejection_reason         TEXT,
  -- Audit
  created_by               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_id, moc_code)
);

CREATE INDEX IF NOT EXISTS idx_sms_moc_base   ON sms_management_of_change(base_id);
CREATE INDEX IF NOT EXISTS idx_sms_moc_status ON sms_management_of_change(base_id, status);

ALTER TABLE sms_management_of_change ENABLE ROW LEVEL SECURITY;

-- ── sms_safety_reports ───────────────────────────────────────
-- The raw funnel — public anonymous submissions, internal reports,
-- and triaged spawns of hazards all land here. Promotion to a
-- formal hazard creates a sms_hazards row referencing this one via
-- source_type='safety_report' + source_ref_id.
CREATE TABLE IF NOT EXISTS sms_safety_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id             UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  report_code         TEXT NOT NULL,
  -- Optional identification (anonymous by default — encourages reporting
  -- per AC 150/5200-37A §6.2.3). Reporter contact captured server-side
  -- via SECURITY DEFINER RPC; never exposed in public selects.
  reporter_name       TEXT,
  reporter_email      TEXT,
  reporter_phone      TEXT,
  reporter_role       TEXT,
  is_anonymous        BOOLEAN NOT NULL DEFAULT TRUE,
  -- Content
  category            TEXT NOT NULL DEFAULT 'other'
                      CHECK (category IN (
                        'wildlife','runway_incursion','ground_vehicle','aircraft',
                        'fuel','arff','weather','equipment','procedure','other'
                      )),
  occurred_at         TIMESTAMPTZ,
  location_text       TEXT,
  description         TEXT NOT NULL,
  immediate_action    TEXT,
  -- Triage
  source              TEXT NOT NULL DEFAULT 'public_form'
                      CHECK (source IN ('public_form','internal','email','phone','walk_in')),
  triage_status       TEXT NOT NULL DEFAULT 'new'
                      CHECK (triage_status IN ('new','reviewing','promoted','closed_no_action','duplicate')),
  triaged_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  triaged_at          TIMESTAMPTZ,
  promoted_hazard_id  UUID REFERENCES sms_hazards(id) ON DELETE SET NULL,
  triage_notes        TEXT,
  -- Audit
  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (base_id, report_code)
);

CREATE INDEX IF NOT EXISTS idx_sms_reports_base       ON sms_safety_reports(base_id);
CREATE INDEX IF NOT EXISTS idx_sms_reports_triage     ON sms_safety_reports(base_id, triage_status);
CREATE INDEX IF NOT EXISTS idx_sms_reports_submitted  ON sms_safety_reports(base_id, submitted_at DESC);

ALTER TABLE sms_safety_reports ENABLE ROW LEVEL SECURITY;

-- ── sms_communications ───────────────────────────────────────
-- Safety Promotion pillar. Newsletters, lessons-learned, training
-- announcements, just-in-time bulletins. Each row is one outbound
-- piece of safety communication.
CREATE TABLE IF NOT EXISTS sms_communications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_id       UUID NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  channel       TEXT NOT NULL DEFAULT 'bulletin'
                CHECK (channel IN ('bulletin','newsletter','training','briefing','email','other')),
  audience      TEXT,
  published_at  TIMESTAMPTZ,
  attachment_url TEXT,
  related_hazard_id UUID REFERENCES sms_hazards(id) ON DELETE SET NULL,
  -- Audit
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_comms_base ON sms_communications(base_id);

ALTER TABLE sms_communications ENABLE ROW LEVEL SECURITY;

-- ── updated_at maintenance triggers ──────────────────────────
CREATE OR REPLACE FUNCTION public._sms_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sms_policies',
    'sms_hazards',
    'sms_risk_assessments',
    'sms_mitigations',
    'sms_spis',
    'sms_audits',
    'sms_management_of_change',
    'sms_safety_reports',
    'sms_communications'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_touch ON %s', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_touch BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION public._sms_touch_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;

-- ── Per-base code generators ─────────────────────────────────
-- HZ-001, MOC-001, AUDIT-001, SR-001. Each table has its own
-- generator so contention is per-table, not global. The COUNT
-- approach is fine at the volume Class III/IV airports run; if
-- volume grows we'd swap to a sequence table per (base, kind).
CREATE OR REPLACE FUNCTION public._sms_next_code(p_base_id UUID, p_prefix TEXT, p_table TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_next   INT;
  v_count  INT;
BEGIN
  EXECUTE format(
    'SELECT COUNT(*) FROM %I WHERE base_id = $1', p_table
  ) INTO v_count USING p_base_id;
  v_next := v_count + 1;
  RETURN p_prefix || '-' || LPAD(v_next::TEXT, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public._sms_next_code(UUID, TEXT, TEXT) TO authenticated;

-- Seeded SPIs — created per civilian base when the SMS module is
-- enabled. The application layer (lib/supabase/sms.ts) calls
-- _sms_seed_default_spis(base_id) on first hazard insert or first
-- explicit SPI page visit so the cron has something to compute
-- against. Kept SECURITY DEFINER so the trigger path can call it
-- without leaking write perms.
CREATE OR REPLACE FUNCTION public._sms_seed_default_spis(p_base_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO sms_spis (base_id, code, title, description, unit, target_value,
                        target_direction, alert_threshold, computation_key, measurement_frequency)
  VALUES
    (p_base_id, 'SPI-001', 'Wildlife Strikes per 1,000 Operations',
     'Wildlife strikes normalized to operations volume (FAA strike database equivalent).',
     'rate', 1.0, 'lower', 2.0, 'wildlife_strikes_per_1k_ops', 'monthly'),
    (p_base_id, 'SPI-002', 'Open Safety Discrepancies Aging >30 Days',
     'Count of open safety-relevant discrepancies older than 30 days.',
     'count', 0, 'lower', 3, 'open_safety_discrepancies_30d', 'monthly'),
    (p_base_id, 'SPI-003', 'Daily Self-Inspection Completion Rate',
     'Percent of days in the period with a completed daily airfield self-inspection.',
     'percent', 100, 'higher', 95, 'daily_inspection_completion_rate', 'monthly'),
    (p_base_id, 'SPI-004', 'Overdue Mitigations',
     'Percent of open mitigations past their due date.',
     'percent', 0, 'lower', 10, 'overdue_mitigation_percent', 'monthly')
  ON CONFLICT (base_id, code) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public._sms_seed_default_spis(UUID) TO authenticated;

-- ── Activity log integration ─────────────────────────────────
-- SMS writes log to activity_log via the application layer
-- (lib/supabase/sms.ts uses logActivity). No DB-side triggers
-- here; matches the pattern in lib/supabase/ppr.ts and avoids
-- the auth.uid() unavailable-in-RPC pitfall.
